import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  ComponentUpdatePreviewResponse,
  ConnectionRuleResultV1,
  ProjectFileV1,
} from '@hwsd/shared';

import { componentApi } from './component-api.js';
import { createEditorState, deriveEditorIndexes, editorReducer } from './editor-store.js';
import { projectApi } from './project-api.js';

type PortSelection = { readonly instanceId: string; readonly portId: string };
const id = (prefix: string) => `${prefix}-${crypto.randomUUID().replaceAll('-', '').toUpperCase()}`;

export function EngineeringEditor({
  document,
  disabled,
  onEdit,
  onServerDocument,
}: {
  readonly document: ProjectFileV1;
  readonly disabled: boolean;
  readonly onEdit: (document: ProjectFileV1) => void;
  readonly onServerDocument: (document: ProjectFileV1) => void;
}) {
  const [state, dispatch] = useReducer(editorReducer, document, createEditorState);
  const [librarySearch, setLibrarySearch] = useState('');
  const [ports, setPorts] = useState<PortSelection[]>([]);
  const [addressValues, setAddressValues] = useState<Record<string, number>>({});
  const [mappingValues, setMappingValues] = useState<Record<string, string>>({});
  const [joinConnectionId, setJoinConnectionId] = useState('');
  const [operatingFrequency, setOperatingFrequency] = useState('');
  const [serialBaud, setSerialBaud] = useState('');
  const [warningDialog, setWarningDialog] = useState(false);
  const [warningNote, setWarningNote] = useState('');
  const [dragPosition, setDragPosition] = useState<{
    readonly instanceId: string;
    readonly x: number;
    readonly y: number;
  } | null>(null);
  const [panPosition, setPanPosition] = useState<{ readonly x: number; readonly y: number } | null>(
    null,
  );
  const drag = useRef<{
    readonly instanceId: string;
    readonly pointerId: number;
    readonly startX: number;
    readonly startY: number;
    readonly originX: number;
    readonly originY: number;
  } | null>(null);
  const pan = useRef<{
    readonly pointerId: number;
    readonly startX: number;
    readonly startY: number;
    readonly originX: number;
    readonly originY: number;
  } | null>(null);
  const [result, setResult] = useState<ConnectionRuleResultV1 | null>(
    document.last_design_check?.result ?? null,
  );
  const [candidate, setCandidate] = useState<ProjectFileV1['connections'][number] | null>(null);
  const [updatePreview, setUpdatePreview] = useState<ComponentUpdatePreviewResponse | null>(null);
  const [note, setNote] = useState('');
  const indexes = useMemo(() => deriveEditorIndexes(state.present), [state.present]);
  const selectedInstance =
    state.selection?.kind === 'component' ? indexes.instances.get(state.selection.id) : undefined;
  const selectedConnection =
    state.selection?.kind === 'connection'
      ? indexes.connections.get(state.selection.id)
      : undefined;
  const library = useQuery({
    queryKey: ['editor-components', librarySearch],
    queryFn: () =>
      componentApi.list({
        ...(librarySearch ? { q: librarySearch } : {}),
        pageSize: 20,
        status: 'VERIFIED',
      }),
  });

  useEffect(() => {
    if (document.document_revision !== state.present.document_revision)
      dispatch({ type: 'RESET', document });
  }, [document, state.present.document_revision]);
  useEffect(() => {
    if (state.dirty) onEdit(state.present);
  }, [onEdit, state.dirty, state.present]);

  const acceptServer = (next: ProjectFileV1) => {
    dispatch({ type: 'RESET', document: next });
    onServerDocument(next);
    setPorts([]);
    setCandidate(null);
    setWarningDialog(false);
  };
  const addComponent = useMutation({
    mutationFn: ({ componentId, revision }: { componentId: string; revision: number }) =>
      projectApi.addComponent(document.project_id, {
        expectedDocumentRevision: state.present.document_revision,
        componentId,
        revision,
        layout: {
          x: 80 + state.present.component_instances.length * 32,
          y: 80 + state.present.component_instances.length * 24,
        },
      }),
    onSuccess: ({ document: next }) => acceptServer(next),
  });
  const previewConnection = useMutation({
    mutationFn: (connection: ProjectFileV1['connections'][number]) =>
      projectApi.previewConnection(document.project_id, {
        expectedDocumentRevision: state.present.document_revision,
        connection,
      }),
    onSuccess: ({ result: next }) => setResult(next),
  });
  const commitConnection = useMutation({
    mutationFn: ({ confirmWarnings }: { readonly confirmWarnings: boolean }) =>
      projectApi.commitConnection(document.project_id, {
        expectedDocumentRevision: state.present.document_revision,
        connection: candidate!,
        confirmedWarnings: confirmWarnings
          ? (result?.findings
              .filter(({ severity, acknowledged }) => severity === 'WARNING' && !acknowledged)
              .map(({ fingerprint }) => ({
                fingerprint,
                ...(warningNote.trim() ? { note: warningNote.trim() } : {}),
              })) ?? [])
          : [],
      }),
    onSuccess: ({ document: next, result: nextResult }) => {
      setResult(nextResult);
      acceptServer(next);
    },
  });
  const designCheck = useMutation({
    mutationFn: () =>
      projectApi.runDesignCheck(document.project_id, state.present.document_revision),
    onSuccess: ({ document: next, result: nextResult }) => {
      setResult(nextResult);
      acceptServer(next);
    },
  });
  const previewUpdate = useMutation({
    mutationFn: (instanceId: string) =>
      projectApi.previewComponentUpdate(document.project_id, instanceId, {
        expectedDocumentRevision: state.present.document_revision,
      }),
    onSuccess: setUpdatePreview,
  });
  const applyUpdate = useMutation({
    mutationFn: () =>
      projectApi.applyComponentUpdate(document.project_id, updatePreview!.instanceId, {
        expectedDocumentRevision: state.present.document_revision,
        targetRevision: updatePreview!.targetRevision,
        confirmedWarnings: updatePreview!.result.findings
          .filter(({ severity }) => severity === 'WARNING')
          .map(({ fingerprint }) => ({ fingerprint })),
      }),
    onSuccess: ({ document: next }) => {
      setUpdatePreview(null);
      acceptServer(next);
    },
  });
  const operationError = [
    addComponent,
    previewConnection,
    commitConnection,
    designCheck,
    previewUpdate,
    applyUpdate,
  ].find(({ isError }) => isError)?.error;

  const makeCandidate = () => {
    const selectedEndpoints = ports.map((selection) => {
      const selectedPort = indexes.instances
        .get(selection.instanceId)
        ?.component_snapshot.ports.find(({ port_id }) => port_id === selection.portId);
      const capabilities =
        indexes.instances
          .get(selection.instanceId)
          ?.component_snapshot.address_capabilities.filter(
            ({ port_id }) => port_id === selection.portId,
          ) ?? [];
      return {
        endpoint_id: id('ENDP'),
        component_instance_id: selection.instanceId,
        port_id: selection.portId,
        selected_mapping_ids: mappingValues[`${selection.instanceId}:${selection.portId}`]
          ? [mappingValues[`${selection.instanceId}:${selection.portId}`]!]
          : [],
        address_selections: [
          ...capabilities.map((capability) => ({
            address_id: capability.address_id,
            value:
              addressValues[`${selection.instanceId}:${capability.address_id}`] ??
              capability.allowed_values?.[0] ??
              capability.range?.min ??
              0,
          })),
          ...(selectedPort?.interface.type === 'SPI' && selectedPort.interface.bus_role === 'TARGET'
            ? [
                {
                  address_id: 'SPI_CS',
                  value: addressValues[`${selection.instanceId}:SPI_CS`] ?? 0,
                },
              ]
            : []),
        ],
      };
    });
    const existing = joinConnectionId ? indexes.connections.get(joinConnectionId) : undefined;
    const endpoints = [
      ...(existing?.endpoints ?? []),
      ...selectedEndpoints.filter(
        (selected) =>
          !existing?.endpoints.some(
            (current) =>
              current.component_instance_id === selected.component_instance_id &&
              current.port_id === selected.port_id,
          ),
      ),
    ];
    if (endpoints.length < 2) return;
    const firstPort = indexes.instances
      .get(ports[0]!.instanceId)
      ?.component_snapshot.ports.find(({ port_id }) => port_id === ports[0]!.portId);
    const connection = {
      connection_id: existing?.connection_id ?? id('CONN'),
      ...(existing?.name ? { name: existing.name } : {}),
      topology: existing?.topology ?? firstPort?.interface.bus_mode ?? 'POINT_TO_POINT',
      endpoints: endpoints as [
        (typeof endpoints)[number],
        (typeof endpoints)[number],
        ...(typeof endpoints)[number][],
      ],
      ...(operatingFrequency
        ? { operating_frequency: { value: Number(operatingFrequency), unit: 'Hz' as const } }
        : existing?.operating_frequency
          ? { operating_frequency: existing.operating_frequency }
          : {}),
      ...(serialBaud
        ? {
            serial_settings: {
              baud_rate: Number(serialBaud),
              data_bits: 8,
              parity: 'NONE' as const,
              stop_bits: 1 as const,
            },
          }
        : existing?.serial_settings
          ? { serial_settings: existing.serial_settings }
          : {}),
      visual: existing?.visual ?? { routing: 'AUTO', waypoints: [] },
    } satisfies ProjectFileV1['connections'][number];
    setCandidate(connection);
    previewConnection.mutate(connection);
  };
  const designCheckCurrent =
    !state.dirty &&
    state.present.last_design_check?.evaluated_engineering_revision ===
      state.present.engineering_revision;

  const mappingsFor = (selection: PortSelection) => {
    const snapshot = indexes.instances.get(selection.instanceId)?.component_snapshot;
    const port = snapshot?.ports.find(({ port_id }) => port_id === selection.portId);
    const resourceIds = new Set(
      port?.bindings.flatMap(({ resource_id }) => (resource_id ? [resource_id] : [])) ?? [],
    );
    return (
      snapshot?.resources
        .filter(({ resource_id }) => resourceIds.has(resource_id))
        .flatMap(({ compatible_pin_mappings }) => compatible_pin_mappings) ?? []
    );
  };

  const selectedPower = ports.flatMap((selection) => {
    const port = indexes.instances
      .get(selection.instanceId)
      ?.component_snapshot.ports.find(({ port_id }) => port_id === selection.portId);
    return port?.power ? [{ selection, power: port.power }] : [];
  });

  return (
    <div className="engineering-workspace">
      <aside className="editor-library" aria-label="Component library">
        <h2>Components</h2>
        <input
          aria-label="Search component library"
          type="search"
          placeholder="Search verified parts"
          value={librarySearch}
          onChange={(event) => setLibrarySearch(event.target.value)}
        />
        <div className="library-results">
          {library.data?.items.map((item) => (
            <button
              key={item.componentId}
              className="library-item"
              disabled={disabled || addComponent.isPending}
              onClick={() =>
                addComponent.mutate({
                  componentId: item.componentId,
                  revision: item.latestRevision,
                })
              }
            >
              <strong>{item.name}</strong>
              <small>
                {item.category} · r{item.latestRevision}
              </small>
            </button>
          ))}
          {library.data?.items.length === 0 ? <p>No verified components found.</p> : null}
        </div>
      </aside>

      <main className="editor-canvas-region">
        <div className="canvas-toolbar" aria-label="Canvas controls">
          <button
            className="secondary-button"
            disabled={!state.past.length}
            onClick={() => dispatch({ type: 'UNDO' })}
          >
            Undo
          </button>
          <button
            className="secondary-button"
            disabled={!state.future.length}
            onClick={() => dispatch({ type: 'REDO' })}
          >
            Redo
          </button>
          <button
            className="secondary-button"
            onClick={() =>
              dispatch({
                type: 'EXECUTE',
                command: {
                  type: 'SET_VIEWPORT',
                  x: state.present.canvas.viewport.x,
                  y: state.present.canvas.viewport.y,
                  zoom: Math.min(2, state.present.canvas.viewport.zoom + 0.1),
                },
              })
            }
          >
            Zoom +
          </button>
          <button
            className="secondary-button"
            onClick={() =>
              dispatch({
                type: 'EXECUTE',
                command: {
                  type: 'SET_VIEWPORT',
                  x: state.present.canvas.viewport.x,
                  y: state.present.canvas.viewport.y,
                  zoom: Math.max(0.25, state.present.canvas.viewport.zoom - 0.1),
                },
              })
            }
          >
            Zoom −
          </button>
          <button
            className="secondary-button"
            onClick={() =>
              dispatch({
                type: 'EXECUTE',
                command: { type: 'SET_VIEWPORT', x: 0, y: 0, zoom: 1 },
              })
            }
          >
            Reset view
          </button>
          <button disabled={disabled || designCheck.isPending} onClick={() => designCheck.mutate()}>
            Run Design Check
          </button>
          <span className={`check-state ${designCheckCurrent ? 'current' : 'stale'}`}>
            {designCheckCurrent ? 'Check current' : 'Check stale'}
          </span>
        </div>
        <div
          className="engineering-canvas"
          style={{ '--canvas-zoom': state.present.canvas.viewport.zoom } as CSSProperties}
          onWheel={(event) => {
            if (!event.ctrlKey) return;
            event.preventDefault();
            dispatch({
              type: 'EXECUTE',
              command: {
                type: 'SET_VIEWPORT',
                x: state.present.canvas.viewport.x,
                y: state.present.canvas.viewport.y,
                zoom: Math.min(
                  2,
                  Math.max(
                    0.25,
                    state.present.canvas.viewport.zoom + (event.deltaY < 0 ? 0.1 : -0.1),
                  ),
                ),
              },
            });
          }}
        >
          <div
            className="canvas-stage"
            style={{
              transform: `translate(${panPosition?.x ?? state.present.canvas.viewport.x}px, ${panPosition?.y ?? state.present.canvas.viewport.y}px) scale(${state.present.canvas.viewport.zoom})`,
            }}
            onPointerDown={(event) => {
              if (event.target !== event.currentTarget || event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              pan.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                originX: state.present.canvas.viewport.x,
                originY: state.present.canvas.viewport.y,
              };
            }}
            onPointerMove={(event) => {
              const current = pan.current;
              if (!current || current.pointerId !== event.pointerId) return;
              setPanPosition({
                x: current.originX + event.clientX - current.startX,
                y: current.originY + event.clientY - current.startY,
              });
            }}
            onPointerUp={(event) => {
              if (pan.current?.pointerId !== event.pointerId) return;
              if (panPosition)
                dispatch({
                  type: 'EXECUTE',
                  command: {
                    type: 'SET_VIEWPORT',
                    x: panPosition.x,
                    y: panPosition.y,
                    zoom: state.present.canvas.viewport.zoom,
                  },
                });
              pan.current = null;
              setPanPosition(null);
            }}
          >
            <svg className="connection-layer" aria-hidden="true">
              {state.present.connections.flatMap((connection) => {
                const [source, ...targets] = connection.endpoints;
                const sourceInstance = source
                  ? indexes.instances.get(source.component_instance_id)
                  : undefined;
                if (!sourceInstance) return [];
                const power = connection.endpoints.some((endpoint) => {
                  const port = indexes.instances
                    .get(endpoint.component_instance_id)
                    ?.component_snapshot.ports.find(({ port_id }) => port_id === endpoint.port_id);
                  return port?.power !== undefined;
                });
                return targets.flatMap((target) => {
                  const targetInstance = indexes.instances.get(target.component_instance_id);
                  if (!targetInstance) return [];
                  return [
                    <line
                      key={`${connection.connection_id}:${target.endpoint_id}`}
                      className={power ? 'connection-line power' : 'connection-line'}
                      x1={sourceInstance.layout.x + 104}
                      y1={sourceInstance.layout.y + 48}
                      x2={targetInstance.layout.x + 104}
                      y2={targetInstance.layout.y + 48}
                    />,
                  ];
                });
              })}
            </svg>
            {state.present.connections.map((connection) => (
              <button
                key={connection.connection_id}
                className={`connection-chip ${state.selection?.id === connection.connection_id ? 'selected' : ''}`}
                onClick={() =>
                  dispatch({
                    type: 'SELECT',
                    selection: { kind: 'connection', id: connection.connection_id },
                  })
                }
              >
                {connection.name ?? connection.connection_id} · {connection.topology}
              </button>
            ))}
            {state.present.component_instances.map((instance) => {
              const visual =
                dragPosition?.instanceId === instance.instance_id ? dragPosition : instance.layout;
              return (
                <article
                  key={instance.instance_id}
                  className={`canvas-node ${state.selection?.id === instance.instance_id ? 'selected' : ''}`}
                  style={{ left: visual.x, top: visual.y }}
                  tabIndex={0}
                  onClick={() =>
                    dispatch({
                      type: 'SELECT',
                      selection: { kind: 'component', id: instance.instance_id },
                    })
                  }
                  onKeyDown={(event) => {
                    const delta = event.shiftKey ? 16 : 4;
                    const movements: Record<string, [number, number]> = {
                      ArrowLeft: [-delta, 0],
                      ArrowRight: [delta, 0],
                      ArrowUp: [0, -delta],
                      ArrowDown: [0, delta],
                    };
                    const movement = movements[event.key];
                    if (movement) {
                      event.preventDefault();
                      const [x, y] = movement;
                      dispatch({
                        type: 'EXECUTE',
                        command: {
                          type: 'MOVE_COMPONENT',
                          instanceId: instance.instance_id,
                          x: instance.layout.x + x,
                          y: instance.layout.y + y,
                        },
                      });
                    }
                    if (event.key === 'Delete')
                      dispatch({
                        type: 'EXECUTE',
                        command: { type: 'DELETE_COMPONENT', instanceId: instance.instance_id },
                      });
                  }}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    drag.current = {
                      instanceId: instance.instance_id,
                      pointerId: event.pointerId,
                      startX: event.clientX,
                      startY: event.clientY,
                      originX: instance.layout.x,
                      originY: instance.layout.y,
                    };
                  }}
                  onPointerMove={(event) => {
                    const current = drag.current;
                    if (!current || current.pointerId !== event.pointerId) return;
                    const grid = state.present.canvas.grid;
                    const rawX =
                      current.originX +
                      (event.clientX - current.startX) / state.present.canvas.viewport.zoom;
                    const rawY =
                      current.originY +
                      (event.clientY - current.startY) / state.present.canvas.viewport.zoom;
                    setDragPosition({
                      instanceId: current.instanceId,
                      x: grid.snap_to_grid ? Math.round(rawX / grid.size) * grid.size : rawX,
                      y: grid.snap_to_grid ? Math.round(rawY / grid.size) * grid.size : rawY,
                    });
                  }}
                  onPointerUp={(event) => {
                    if (drag.current?.pointerId !== event.pointerId) return;
                    if (dragPosition)
                      dispatch({
                        type: 'EXECUTE',
                        command: {
                          type: 'MOVE_COMPONENT',
                          instanceId: dragPosition.instanceId,
                          x: dragPosition.x,
                          y: dragPosition.y,
                        },
                      });
                    drag.current = null;
                    setDragPosition(null);
                  }}
                >
                  <strong>
                    {instance.display_name ?? instance.component_snapshot.identity.name}
                  </strong>
                  <small>
                    {instance.component_snapshot.classification.category} · r
                    {instance.component_snapshot.revision}
                  </small>
                  <div className="node-ports">
                    {instance.component_snapshot.ports.map((port) => {
                      const active = ports.some(
                        ({ instanceId, portId }) =>
                          instanceId === instance.instance_id && portId === port.port_id,
                      );
                      return (
                        <button
                          key={port.port_id}
                          className={active ? 'port active' : 'port'}
                          title={`${port.interface.type} · ${port.direction}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setPorts((current) =>
                              active
                                ? current.filter(
                                    (value) =>
                                      value.instanceId !== instance.instance_id ||
                                      value.portId !== port.port_id,
                                  )
                                : current.length < 8
                                  ? [
                                      ...current,
                                      { instanceId: instance.instance_id, portId: port.port_id },
                                    ]
                                  : current,
                            );
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          {port.name}
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
            {!state.present.component_instances.length ? (
              <div className="canvas-empty">
                <h2>Add a component to begin</h2>
                <p>Choose a verified snapshot from the library.</p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="connection-setup">
          <strong>Connection setup</strong>
          <span>{ports.length} endpoints selected</span>
          <label className="connection-control">
            Bus
            <select
              aria-label="Join an existing bus"
              value={joinConnectionId}
              onChange={(event) => setJoinConnectionId(event.target.value)}
            >
              <option value="">New connection</option>
              {state.present.connections
                .filter(({ topology }) => ['SHARED_BUS', 'MULTI_DROP'].includes(topology))
                .map((connection) => (
                  <option key={connection.connection_id} value={connection.connection_id}>
                    Join {connection.name ?? connection.connection_id}
                  </option>
                ))}
            </select>
          </label>
          {ports.flatMap((selection) => {
            const selectedPort = indexes.instances
              .get(selection.instanceId)
              ?.component_snapshot.ports.find(({ port_id }) => port_id === selection.portId);
            const capabilities =
              indexes.instances
                .get(selection.instanceId)
                ?.component_snapshot.address_capabilities.filter(
                  ({ port_id }) => port_id === selection.portId,
                ) ?? [];
            const addressControls = capabilities.map((capability) => {
              const key = `${selection.instanceId}:${capability.address_id}`;
              const allowed = capability.allowed_values ?? [];
              const fallback = allowed[0] ?? capability.range?.min ?? 0;
              return (
                <label className="address-control" key={key}>
                  {capability.kind}
                  <input
                    aria-label={`${capability.kind} address for ${selection.instanceId}`}
                    type="number"
                    min={capability.range?.min ?? (allowed.length ? Math.min(...allowed) : 0)}
                    max={capability.range?.max ?? (allowed.length ? Math.max(...allowed) : 1023)}
                    value={addressValues[key] ?? fallback}
                    onChange={(event) =>
                      setAddressValues((current) => ({
                        ...current,
                        [key]: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              );
            });
            const mappings = mappingsFor(selection);
            if (mappings.length) {
              const key = `${selection.instanceId}:${selection.portId}`;
              addressControls.unshift(
                <label className="address-control" key={`${key}:mapping`}>
                  Pin mapping
                  <select
                    aria-label={`Pin mapping for ${selection.instanceId} ${selection.portId}`}
                    value={mappingValues[key] ?? ''}
                    onChange={(event) =>
                      setMappingValues((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select mapping</option>
                    {mappings.map((mapping) => (
                      <option key={mapping.mapping_id} value={mapping.mapping_id}>
                        {mapping.mapping_id}
                      </option>
                    ))}
                  </select>
                </label>,
              );
            }
            if (
              selectedPort?.interface.type === 'SPI' &&
              selectedPort.interface.bus_role === 'TARGET'
            ) {
              const key = `${selection.instanceId}:SPI_CS`;
              addressControls.push(
                <label className="address-control" key={key}>
                  SPI chip select
                  <input
                    aria-label={`SPI chip select for ${selection.instanceId}`}
                    type="number"
                    min={0}
                    value={addressValues[key] ?? 0}
                    onChange={(event) =>
                      setAddressValues((current) => ({
                        ...current,
                        [key]: Number(event.target.value),
                      }))
                    }
                  />
                </label>,
              );
            }
            return addressControls;
          })}
          <label className="address-control">
            Frequency (Hz)
            <input
              aria-label="Connection operating frequency in hertz"
              type="number"
              min={1}
              value={operatingFrequency}
              onChange={(event) => setOperatingFrequency(event.target.value)}
            />
          </label>
          <label className="address-control">
            Baud
            <input
              aria-label="Serial baud rate"
              type="number"
              min={1}
              value={serialBaud}
              onChange={(event) => setSerialBaud(event.target.value)}
            />
          </label>
          <button
            disabled={disabled || ports.length < 2 || previewConnection.isPending}
            onClick={makeCandidate}
          >
            Preview
          </button>
          {candidate && result && result.mode !== 'DESIGN_CHECK' ? (
            <button
              disabled={disabled || !result.allowed || commitConnection.isPending}
              onClick={() =>
                result.requires_confirmation
                  ? setWarningDialog(true)
                  : commitConnection.mutate({ confirmWarnings: false })
              }
            >
              {result.requires_confirmation ? 'Review warnings' : 'Commit connection'}
            </button>
          ) : null}
          {selectedPower.length ? (
            <div className="power-summary">
              <strong>Power flow</strong>
              <span>
                {selectedPower.filter(({ power }) => power.role === 'SOURCE').length} source ·{' '}
                {selectedPower.filter(({ power }) => power.role === 'LOAD').length} loads ·{' '}
                {selectedPower
                  .filter(({ power }) => power.role === 'LOAD')
                  .reduce(
                    (sum, { power }) =>
                      sum +
                      (power.peak_current?.value ??
                        power.max_current?.value ??
                        power.typical_current?.value ??
                        0),
                    0,
                  )}{' '}
                A conservative load
              </span>
            </div>
          ) : null}
        </div>
      </main>

      <aside className="editor-inspector" aria-label="Inspector">
        <h2>Inspector</h2>
        {selectedInstance ? (
          <>
            <h3>{selectedInstance.component_snapshot.identity.name}</h3>
            <p>
              {selectedInstance.component_snapshot.component_id} · revision{' '}
              {selectedInstance.component_snapshot.revision}
            </p>
            <span className="status-badge">
              {selectedInstance.component_snapshot.lifecycle.status}
            </span>
            <h3>Resources</h3>
            <ul>
              {selectedInstance.component_snapshot.resources.map((resource) => (
                <li key={resource.resource_id}>
                  {resource.name} ({resource.type}) · {resource.share_mode}
                  {resource.channels.length ? ` · ${resource.channels.length} channels` : ''}
                </li>
              ))}
            </ul>
            <p>
              {indexes.allocationsByInstance.get(selectedInstance.instance_id)?.length ?? 0} active
              allocations
            </p>
            <h3>Provenance</h3>
            <p>
              {selectedInstance.component_snapshot.provenance.origin} ·{' '}
              {selectedInstance.component_snapshot.provenance.datasheets.length} datasheets
            </p>
            <button
              className="secondary-button"
              disabled={disabled}
              onClick={() => previewUpdate.mutate(selectedInstance.instance_id)}
            >
              Check for update
            </button>
            <button
              className="danger-button"
              onClick={() =>
                dispatch({
                  type: 'EXECUTE',
                  command: { type: 'DELETE_COMPONENT', instanceId: selectedInstance.instance_id },
                })
              }
            >
              Delete component
            </button>
          </>
        ) : selectedConnection ? (
          <>
            <h3>{selectedConnection.name ?? selectedConnection.connection_id}</h3>
            <p>
              {selectedConnection.topology} · {selectedConnection.endpoints.length} endpoints
            </p>
            <h3>Allocations</h3>
            <ul>
              {(indexes.allocationsByConnection.get(selectedConnection.connection_id) ?? []).map(
                (allocation) => (
                  <li key={allocation.allocation_id}>
                    {allocation.resource_kind}: {allocation.resource_id}
                    {allocation.channel ? ` / ${allocation.channel}` : ''} ·{' '}
                    {allocation.allocation_mode}
                  </li>
                ),
              )}
            </ul>
            {selectedConnection.operating_frequency ? (
              <p>{selectedConnection.operating_frequency.value} Hz operating frequency</p>
            ) : null}
          </>
        ) : (
          <p>Select a component to inspect ports, resources, and provenance.</p>
        )}
        <h3>Engineering note</h3>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Record a design decision"
        />
        <button
          disabled={!note.trim()}
          onClick={() => {
            dispatch({
              type: 'EXECUTE',
              command: {
                type: 'ADD_NOTE',
                note: {
                  note_id: id('NOTE'),
                  scope: selectedInstance ? 'COMPONENT_INSTANCE' : 'PROJECT',
                  ...(selectedInstance ? { target_id: selectedInstance.instance_id } : {}),
                  text: note.trim(),
                  created_by: document.metadata.owner_user_id,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              },
            });
            setNote('');
          }}
        >
          Add note
        </button>
      </aside>

      <section
        className={`editor-issues ${result?.verdict.toLowerCase() ?? ''}`}
        aria-label="Engineering issues"
        aria-live="polite"
      >
        {operationError ? (
          <p className="form-error" role="alert">
            {operationError instanceof Error
              ? operationError.message
              : 'The editor operation failed.'}
          </p>
        ) : null}
        <div>
          <strong>
            {result
              ? `${result.verdict} · ${result.findings.length} findings`
              : 'No evaluation yet'}
          </strong>
          {result?.summary ? (
            <span>
              {result.summary.passed}/{result.summary.checks_evaluated} checks passed
            </span>
          ) : null}
        </div>
        <div className="issue-list">
          {result?.findings.map((finding) => (
            <button
              key={finding.fingerprint}
              className={`issue ${finding.severity.toLowerCase()}`}
              onClick={() => {
                const target = finding.locations.find(
                  ({ entity_type }) => entity_type === 'COMPONENT_INSTANCE',
                );
                if (target)
                  dispatch({
                    type: 'SELECT',
                    selection: { kind: 'component', id: target.entity_id },
                  });
              }}
            >
              <strong>{finding.code}</strong> {finding.message}
              {finding.acknowledged ? ' · acknowledged' : ''}
            </button>
          ))}
        </div>
      </section>

      {warningDialog && result ? (
        <section className="inline-dialog editor-modal" role="dialog" aria-modal="true">
          <h2>Confirm engineering warnings</h2>
          <p>The server will re-evaluate these warnings before the connection is committed.</p>
          <ul className="warning-review-list">
            {result.findings
              .filter(({ severity, acknowledged }) => severity === 'WARNING' && !acknowledged)
              .map((finding) => (
                <li key={finding.fingerprint}>
                  <strong>{finding.code}</strong> — {finding.message}
                </li>
              ))}
          </ul>
          <label>
            Engineering note (optional)
            <textarea
              value={warningNote}
              onChange={(event) => setWarningNote(event.target.value)}
            />
          </label>
          <div className="form-actions">
            <button className="secondary-button" autoFocus onClick={() => setWarningDialog(false)}>
              Go back
            </button>
            <button
              disabled={commitConnection.isPending}
              onClick={() => commitConnection.mutate({ confirmWarnings: true })}
            >
              Continue anyway
            </button>
          </div>
        </section>
      ) : null}

      {updatePreview ? (
        <section className="inline-dialog editor-modal" role="dialog" aria-modal="true">
          <h2>Component update impact</h2>
          <p>
            Revision {updatePreview.currentRevision} → {updatePreview.targetRevision};{' '}
            {updatePreview.affectedConnectionIds.length} connections affected.
          </p>
          <p>
            Design result: <strong>{updatePreview.result.verdict}</strong>
          </p>
          <div className="form-actions">
            <button className="secondary-button" onClick={() => setUpdatePreview(null)}>
              Keep current snapshot
            </button>
            <button
              disabled={
                !updatePreview.result.allowed ||
                updatePreview.targetRevision <= updatePreview.currentRevision ||
                applyUpdate.isPending
              }
              onClick={() => applyUpdate.mutate()}
            >
              Apply revision
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

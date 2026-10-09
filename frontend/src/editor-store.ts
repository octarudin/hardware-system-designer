import type { ProjectFileV1 } from '@hwsd/shared';

export type EditorSelection =
  | { readonly kind: 'component'; readonly id: string }
  | { readonly kind: 'connection'; readonly id: string }
  | null;

export type EditorCommand =
  | {
      readonly type: 'MOVE_COMPONENT';
      readonly instanceId: string;
      readonly x: number;
      readonly y: number;
    }
  | { readonly type: 'SET_VIEWPORT'; readonly x: number; readonly y: number; readonly zoom: number }
  | { readonly type: 'DELETE_COMPONENT'; readonly instanceId: string }
  | { readonly type: 'ADD_NOTE'; readonly note: ProjectFileV1['engineering_notes'][number] };

export interface EditorState {
  readonly present: ProjectFileV1;
  readonly past: readonly ProjectFileV1[];
  readonly future: readonly ProjectFileV1[];
  readonly selection: EditorSelection;
  readonly dirty: boolean;
  readonly baseDocumentRevision: number;
  readonly editRevision: number;
}

export interface EditorIndexes {
  readonly instances: ReadonlyMap<string, ProjectFileV1['component_instances'][number]>;
  readonly connections: ReadonlyMap<string, ProjectFileV1['connections'][number]>;
  readonly allocationsByInstance: ReadonlyMap<string, ProjectFileV1['allocations']>;
  readonly allocationsByConnection: ReadonlyMap<string, ProjectFileV1['allocations']>;
}

export type EditorAction =
  | { readonly type: 'EXECUTE'; readonly command: EditorCommand }
  | { readonly type: 'SELECT'; readonly selection: EditorSelection }
  | { readonly type: 'UNDO' }
  | { readonly type: 'REDO' }
  | { readonly type: 'RESET'; readonly document: ProjectFileV1 };

export function createEditorState(document: ProjectFileV1): EditorState {
  return {
    present: document,
    past: [],
    future: [],
    selection: null,
    dirty: false,
    baseDocumentRevision: document.document_revision,
    editRevision: 0,
  };
}

function execute(document: ProjectFileV1, command: EditorCommand): ProjectFileV1 {
  if (command.type === 'MOVE_COMPONENT')
    return {
      ...document,
      component_instances: document.component_instances.map((instance) =>
        instance.instance_id === command.instanceId
          ? { ...instance, layout: { ...instance.layout, x: command.x, y: command.y } }
          : instance,
      ),
    };
  if (command.type === 'SET_VIEWPORT')
    return {
      ...document,
      canvas: { ...document.canvas, viewport: { x: command.x, y: command.y, zoom: command.zoom } },
    };
  if (command.type === 'ADD_NOTE')
    return { ...document, engineering_notes: [...document.engineering_notes, command.note] };
  const removedConnections = new Set(
    document.connections
      .filter(({ endpoints }) =>
        endpoints.some(({ component_instance_id }) => component_instance_id === command.instanceId),
      )
      .map(({ connection_id }) => connection_id),
  );
  return {
    ...document,
    component_instances: document.component_instances.filter(
      ({ instance_id }) => instance_id !== command.instanceId,
    ),
    connections: document.connections.filter(
      ({ connection_id }) => !removedConnections.has(connection_id),
    ),
    allocations: document.allocations.filter(
      ({ component_instance_id, connection_id }) =>
        component_instance_id !== command.instanceId && !removedConnections.has(connection_id),
    ),
    engineering_notes: document.engineering_notes.filter(
      ({ target_id }) => target_id !== command.instanceId,
    ),
    warning_overrides: document.warning_overrides.filter(
      ({ subject }) =>
        subject.component_instance_id !== command.instanceId &&
        !removedConnections.has(subject.connection_id ?? ''),
    ),
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === 'RESET') return createEditorState(action.document);
  if (action.type === 'SELECT') return { ...state, selection: action.selection };
  if (action.type === 'UNDO') {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return {
      ...state,
      present: previous,
      past: state.past.slice(0, -1),
      future: [state.present, ...state.future],
      dirty: true,
      editRevision: state.editRevision + 1,
    };
  }
  if (action.type === 'REDO') {
    const next = state.future[0];
    if (!next) return state;
    return {
      ...state,
      present: next,
      past: [...state.past, state.present],
      future: state.future.slice(1),
      dirty: true,
      editRevision: state.editRevision + 1,
    };
  }
  const next = execute(state.present, action.command);
  if (next === state.present || JSON.stringify(next) === JSON.stringify(state.present))
    return state;
  return {
    ...state,
    present: next,
    past: [...state.past.slice(-49), state.present],
    future: [],
    selection:
      action.command.type === 'DELETE_COMPONENT' &&
      state.selection?.kind === 'component' &&
      state.selection.id === action.command.instanceId
        ? null
        : state.selection,
    dirty: true,
    editRevision: state.editRevision + 1,
  };
}

export function deriveEditorIndexes(document: ProjectFileV1): EditorIndexes {
  const allocationsByInstance = new Map<string, ProjectFileV1['allocations']>();
  const allocationsByConnection = new Map<string, ProjectFileV1['allocations']>();
  for (const allocation of document.allocations) {
    allocationsByInstance.set(allocation.component_instance_id, [
      ...(allocationsByInstance.get(allocation.component_instance_id) ?? []),
      allocation,
    ]);
    allocationsByConnection.set(allocation.connection_id, [
      ...(allocationsByConnection.get(allocation.connection_id) ?? []),
      allocation,
    ]);
  }
  return {
    instances: new Map(
      document.component_instances.map((instance) => [instance.instance_id, instance]),
    ),
    connections: new Map(
      document.connections.map((connection) => [connection.connection_id, connection]),
    ),
    allocationsByInstance,
    allocationsByConnection,
  };
}

import { describe, expect, it } from 'vitest';

import { type ProjectFileV1, validateConnectionRuleResultSchema } from '@hwsd/shared';

import { canonicalJson, sha256 } from './canonical.js';
import { evaluate, isDesignCheckCurrent, ProjectRevisionConflictError } from './engine.js';
import { RULE_REGISTRY } from './registry.js';

type Component = ProjectFileV1['component_instances'][number]['component_snapshot'];
type Port = Component['ports'][number];
type Connection = ProjectFileV1['connections'][number];

const voltage = (min = 3, max = 3.6) => ({
  min: { value: min, unit: 'V' as const },
  max: { value: max, unit: 'V' as const },
});

function port(
  id: string,
  type: Port['interface']['type'],
  direction: Port['direction'],
  overrides: Partial<Port> = {},
): Port {
  return {
    port_id: id,
    name: id,
    requirement: 'OPTIONAL',
    direction,
    interface: {
      type,
      bus_mode: 'POINT_TO_POINT',
      logic_voltage: voltage(),
      signal_voltage: voltage(),
    },
    bindings: [],
    ...overrides,
  };
}

function component(
  id: string,
  ports: Port[],
  status: Component['lifecycle']['status'] = 'VERIFIED',
): Component {
  return {
    schema_version: 'hwsd.component/1',
    component_id: id,
    revision: 1,
    identity: { name: id },
    classification: { category: 'GENERIC_BOARD', abstraction: 'BOARD' },
    lifecycle:
      status === 'VERIFIED'
        ? { status, verified_by: 'USR-ADMIN', verified_at: '2026-01-01T00:00:00.000Z' }
        : {
            status,
            ...(status === 'DEPRECATED' || status === 'DISABLED'
              ? { status_reason: 'fixture' }
              : {}),
          },
    provenance: { origin: 'MANUAL', datasheets: [], field_evidence: [] },
    pins: [],
    ports,
    resources: [],
    address_capabilities: [],
    notes: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    revision_notes: 'fixture',
  };
}

function connection(topology: Connection['topology'] = 'POINT_TO_POINT'): Connection {
  return {
    connection_id: 'CONN-TEST',
    topology,
    endpoints: [
      {
        endpoint_id: 'END-A',
        component_instance_id: 'INST-A',
        port_id: 'PORT-A',
        selected_mapping_ids: [],
        address_selections: [],
      },
      {
        endpoint_id: 'END-B',
        component_instance_id: 'INST-B',
        port_id: 'PORT-B',
        selected_mapping_ids: [],
        address_selections: [],
      },
    ],
    visual: { routing: 'AUTO', waypoints: [] },
  };
}

function project(left: Port, right: Port, candidate = connection()): ProjectFileV1 {
  return {
    schema_version: 'hwsd.project/1',
    ruleset_version: 'hwsd.connection-rules/1',
    project_id: 'PROJ-TEST',
    document_revision: 1,
    engineering_revision: 1,
    metadata: {
      name: 'Rule fixture',
      owner_user_id: 'USR-OWNER',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    settings: { autosave: { enabled: true, interval_ms: 3000 } },
    canvas: { viewport: { x: 0, y: 0, zoom: 1 }, grid: { size: 16, snap_to_grid: true } },
    component_instances: [
      {
        instance_id: 'INST-A',
        layout: { x: 0, y: 0 },
        component_snapshot: component('CMP-A', [left]),
      },
      {
        instance_id: 'INST-B',
        layout: { x: 100, y: 0 },
        component_snapshot: component('CMP-B', [right]),
      },
    ],
    connections: [candidate],
    allocations: [],
    engineering_notes: [],
    warning_overrides: [],
  };
}

function codes(result: ReturnType<typeof evaluate>): string[] {
  return result.findings.map(({ code }) => code);
}

describe('M5 registry, canonicalization, and aggregation', () => {
  it('registers every required immutable rule ID', () => {
    expect(RULE_REGISTRY).toHaveLength(38);
    expect(RULE_REGISTRY.map(({ ruleId }) => ruleId)).toEqual([
      'STRUCT-001',
      'STRUCT-002',
      'STRUCT-003',
      'STRUCT-004',
      'IFACE-001',
      'IFACE-002',
      'IFACE-003',
      'IFACE-004',
      'IFACE-005',
      'IFACE-006',
      'ELEC-001',
      'ELEC-002',
      'ELEC-003',
      'ELEC-004',
      'ALLOC-001',
      'ALLOC-002',
      'ALLOC-003',
      'ALLOC-004',
      'ALLOC-005',
      'ALLOC-006',
      'BUS-001',
      'BUS-002',
      'BUS-003',
      'BUS-004',
      'BUS-005',
      'BUS-006',
      'BUS-007',
      'POWER-001',
      'POWER-002',
      'POWER-003',
      'POWER-004',
      'POWER-005',
      'POWER-006',
      'COMP-001',
      'COMP-002',
      'COMP-003',
      'COMP-004',
      'COMP-005',
    ]);
  });

  it('produces the standard SHA-256 vector and key-order-independent canonical JSON', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(canonicalJson({ z: 1, a: { y: 2, x: 3 } })).toBe('{"a":{"x":3,"y":2},"z":1}');
  });

  it('is byte-stable and conforms to the result schema', () => {
    const candidate = connection();
    const input = {
      project: project(
        port('PORT-A', 'GPIO_OUTPUT', 'OUTPUT'),
        port('PORT-B', 'GPIO_INPUT', 'INPUT'),
        candidate,
      ),
      mode: 'CONNECTION_PREVIEW' as const,
      connection: candidate,
    };
    const first = evaluate(input);
    const second = evaluate(input);
    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(validateConnectionRuleResultSchema(first)).toMatchObject({ valid: true });
  });
});

describe('structural and interface conformance', () => {
  it('reports unresolved references and invalid endpoint cardinality', () => {
    const candidate = connection();
    candidate.endpoints.splice(1, 1);
    candidate.endpoints[0].component_instance_id = 'INST-MISSING';
    const result = evaluate({
      project: project(
        port('PORT-A', 'GPIO_OUTPUT', 'OUTPUT'),
        port('PORT-B', 'GPIO_INPUT', 'INPUT'),
        candidate,
      ),
      mode: 'CONNECTION_PREVIEW',
      connection: candidate,
    });
    expect(codes(result)).toEqual(
      expect.arrayContaining(['REFERENCE_NOT_FOUND', 'INVALID_ENDPOINT_COUNT']),
    );
  });

  it.each([
    ['GPIO_OUTPUT', 'OUTPUT', 'GPIO_INPUT', 'INPUT'],
    ['UART_TTL', 'BIDIRECTIONAL', 'UART_TTL', 'BIDIRECTIONAL'],
    ['I2C', 'BIDIRECTIONAL', 'I2C', 'BIDIRECTIONAL'],
    ['ANALOG_OUTPUT', 'OUTPUT', 'ADC_INPUT', 'INPUT'],
    ['RELAY_CONTACT', 'PASSIVE', 'DRY_CONTACT', 'INPUT'],
    ['POWER_OUTPUT', 'OUTPUT', 'POWER_INPUT', 'INPUT'],
  ] as const)(
    'accepts directly compatible %s to %s',
    (leftType, leftDirection, rightType, rightDirection) => {
      const candidate = connection();
      const result = evaluate({
        project: project(
          port('PORT-A', leftType, leftDirection),
          port('PORT-B', rightType, rightDirection),
          candidate,
        ),
        mode: 'CONNECTION_PREVIEW',
        connection: candidate,
      });
      expect(codes(result)).not.toContain('INTERFACE_INCOMPATIBLE');
    },
  );

  it.each([
    ['UART_TTL', 'RS485', 'INTERFACE_CONVERTER_REQUIRED'],
    ['UART_TTL', 'RS232', 'INTERFACE_CONVERTER_REQUIRED'],
    ['I2C', 'SPI', 'INTERFACE_INCOMPATIBLE'],
    ['WIFI', 'BLE', 'INTERFACE_INCOMPATIBLE'],
  ] as const)('rejects direct %s to %s', (leftType, rightType, expected) => {
    const candidate = connection();
    const result = evaluate({
      project: project(
        port('PORT-A', leftType, 'BIDIRECTIONAL'),
        port('PORT-B', rightType, 'BIDIRECTIONAL'),
        candidate,
      ),
      mode: 'CONNECTION_COMMIT',
      connection: candidate,
    });
    expect(codes(result)).toContain(expected);
    expect(result).toMatchObject({ verdict: 'ERROR', allowed: false, allocation_effects: [] });
  });

  it('reports duplicate, cardinality, topology, direction, custom, and protocol findings', () => {
    const candidate = connection('SHARED_BUS');
    candidate.endpoints.push({ ...candidate.endpoints[0], endpoint_id: 'END-C' });
    const left = port('PORT-A', 'CUSTOM', 'OUTPUT', {
      interface: {
        type: 'CUSTOM',
        custom_type: 'PRIVATE',
        bus_mode: 'POINT_TO_POINT',
        protocol: 'A',
      },
    });
    const right = port('PORT-B', 'CUSTOM', 'OUTPUT', {
      interface: {
        type: 'CUSTOM',
        custom_type: 'OTHER',
        bus_mode: 'POINT_TO_POINT',
        protocol: 'B',
      },
    });
    const result = evaluate({
      project: project(left, right, candidate),
      mode: 'CONNECTION_PREVIEW',
      connection: candidate,
    });
    expect(codes(result)).toEqual(
      expect.arrayContaining([
        'DUPLICATE_ENDPOINT',
        'TOPOLOGY_MISMATCH',
        'DIRECTION_CONFLICT',
        'CUSTOM_INTERFACE_UNVERIFIED',
        'PROTOCOL_MISMATCH',
      ]),
    );
  });

  it('warns when a protocol is declared by only one endpoint', () => {
    const candidate = connection();
    const left = port('PORT-A', 'UART_TTL', 'BIDIRECTIONAL', {
      interface: {
        type: 'UART_TTL',
        bus_mode: 'POINT_TO_POINT',
        protocol: 'MODBUS_RTU',
        logic_voltage: voltage(),
      },
    });
    const result = evaluate({
      project: project(left, port('PORT-B', 'UART_TTL', 'BIDIRECTIONAL'), candidate),
      mode: 'CONNECTION_PREVIEW',
      connection: candidate,
    });
    expect(codes(result)).toContain('PROTOCOL_VALIDATION_INCOMPLETE');
  });

  it('uses decimal-safe current arithmetic at an exact capacity boundary', () => {
    const candidate = connection('SHARED_BUS');
    candidate.endpoints.push({
      endpoint_id: 'END-C',
      component_instance_id: 'INST-C',
      port_id: 'PORT-C',
      selected_mapping_ids: [],
      address_selections: [],
    });
    const source = port('PORT-A', 'POWER_OUTPUT', 'OUTPUT', {
      interface: { type: 'POWER_OUTPUT', bus_mode: 'SHARED_BUS' },
      power: { role: 'SOURCE', max_current: { value: 0.3, unit: 'A' } },
    });
    const load = (id: string, current: number) =>
      port(id, 'POWER_INPUT', 'INPUT', {
        interface: { type: 'POWER_INPUT', bus_mode: 'SHARED_BUS' },
        power: { role: 'LOAD', max_current: { value: current, unit: 'A' } },
      });
    const fixture = project(source, load('PORT-B', 0.1), candidate);
    fixture.component_instances.push({
      instance_id: 'INST-C',
      layout: { x: 200, y: 0 },
      component_snapshot: component('CMP-C', [load('PORT-C', 0.2)]),
    });
    expect(
      codes(evaluate({ project: fixture, mode: 'CONNECTION_PREVIEW', connection: candidate })),
    ).not.toContain('POWER_CURRENT_EXCEEDED');
  });
});

describe('electrical, allocation, bus, and power conformance', () => {
  it('checks voltage and frequency boundaries', () => {
    const candidate = {
      ...connection(),
      operating_frequency: { value: 1_000_001, unit: 'Hz' as const },
    };
    const left = port('PORT-A', 'GPIO_OUTPUT', 'OUTPUT', {
      interface: {
        type: 'GPIO_OUTPUT',
        bus_mode: 'POINT_TO_POINT',
        logic_voltage: voltage(5, 5.5),
        max_frequency: { value: 1_000_000, unit: 'Hz' },
      },
    });
    const right = port('PORT-B', 'GPIO_INPUT', 'INPUT', {
      interface: { type: 'GPIO_INPUT', bus_mode: 'POINT_TO_POINT', logic_voltage: voltage(3, 3.6) },
    });
    const result = evaluate({
      project: project(left, right, candidate),
      mode: 'CONNECTION_PREVIEW',
      connection: candidate,
    });
    expect(codes(result)).toEqual(
      expect.arrayContaining(['LOGIC_VOLTAGE_INCOMPATIBLE', 'FREQUENCY_LIMIT_EXCEEDED']),
    );
  });

  it('rejects an analog source range that exceeds its input range', () => {
    const candidate = connection();
    const source = port('PORT-A', 'ANALOG_OUTPUT', 'OUTPUT', {
      interface: {
        type: 'ANALOG_OUTPUT',
        bus_mode: 'POINT_TO_POINT',
        signal_voltage: voltage(0, 10),
      },
    });
    const input = port('PORT-B', 'ANALOG_INPUT', 'INPUT', {
      interface: {
        type: 'ANALOG_INPUT',
        bus_mode: 'POINT_TO_POINT',
        signal_voltage: voltage(0, 5),
      },
    });
    expect(
      codes(
        evaluate({
          project: project(source, input, candidate),
          mode: 'CONNECTION_PREVIEW',
          connection: candidate,
        }),
      ),
    ).toContain('ANALOG_RANGE_INCOMPATIBLE');
  });

  it('detects an exclusive pin allocation and suppresses effects on error', () => {
    const candidate = connection();
    const left = port('PORT-A', 'GPIO_OUTPUT', 'OUTPUT', { bindings: [{ pin_id: 'PIN-A' }] });
    const fixture = project(left, port('PORT-B', 'GPIO_INPUT', 'INPUT'), candidate);
    fixture.allocations.push({
      allocation_id: 'ALLOC-OLD',
      connection_id: 'CONN-OLD',
      endpoint_id: 'END-OLD',
      component_instance_id: 'INST-A',
      resource_kind: 'PIN',
      resource_id: 'PIN-A',
      allocation_mode: 'EXCLUSIVE',
    });
    const result = evaluate({ project: fixture, mode: 'CONNECTION_COMMIT', connection: candidate });
    expect(codes(result)).toContain('PIN_ALREADY_ALLOCATED');
    expect(result.allocation_effects).toEqual([]);
  });

  it('detects mux, resource, channel, mapping, and exhausted-resource states', () => {
    const candidate = connection();
    const left = port('PORT-A', 'GPIO_OUTPUT', 'OUTPUT', {
      bindings: [
        {
          pin_id: 'PIN-A',
          function_id: 'FUNC-A',
          resource_id: 'RES-A',
          channel: 'CH-1',
        },
      ],
    });
    const fixture = project(left, port('PORT-B', 'GPIO_INPUT', 'INPUT'), candidate);
    const snapshot = fixture.component_instances[0]!.component_snapshot;
    snapshot.pins.push({
      pin_id: 'PIN-A',
      number: '1',
      name: 'A',
      direction: 'OUTPUT',
      electrical_type: 'DIGITAL',
      requirement: 'OPTIONAL',
      alternate_functions: [
        {
          function_id: 'FUNC-A',
          interface_type: 'GPIO_OUTPUT',
          signal: 'A',
          resource_id: 'RES-A',
          channel: 'CH-1',
          mux_group: 'MUX-A',
        },
        {
          function_id: 'FUNC-B',
          interface_type: 'PWM',
          signal: 'B',
          resource_id: 'RES-A',
          channel: 'CH-1',
          mux_group: 'MUX-A',
        },
      ],
    });
    snapshot.resources.push({
      resource_id: 'RES-A',
      type: 'GPIO',
      name: 'Resource A',
      share_mode: 'CHANNELIZED',
      channels: [{ channel: 'CH-1', signal: 'A' }],
      compatible_pin_mappings: [
        {
          mapping_id: 'MAP-A',
          assignments: [{ signal: 'A', pin_id: 'PIN-A', function_id: 'FUNC-A' }],
        },
      ],
    });
    fixture.allocations.push(
      {
        allocation_id: 'ALLOC-PIN',
        connection_id: 'CONN-OLD',
        endpoint_id: 'END-OLD',
        component_instance_id: 'INST-A',
        resource_kind: 'PIN',
        resource_id: 'PIN-A',
        allocation_mode: 'EXCLUSIVE',
      },
      {
        allocation_id: 'ALLOC-FUNCTION',
        connection_id: 'CONN-OLD',
        endpoint_id: 'END-OLD',
        component_instance_id: 'INST-A',
        resource_kind: 'FUNCTION',
        resource_id: 'FUNC-B',
        allocation_mode: 'EXCLUSIVE',
      },
      {
        allocation_id: 'ALLOC-RESOURCE',
        connection_id: 'CONN-OLD',
        endpoint_id: 'END-OLD',
        component_instance_id: 'INST-A',
        resource_kind: 'RESOURCE',
        resource_id: 'RES-A',
        allocation_mode: 'EXCLUSIVE',
      },
      {
        allocation_id: 'ALLOC-CHANNEL',
        connection_id: 'CONN-OLD',
        endpoint_id: 'END-OLD',
        component_instance_id: 'INST-A',
        resource_kind: 'CHANNEL',
        resource_id: 'RES-A',
        channel: 'CH-1',
        allocation_mode: 'EXCLUSIVE',
      },
    );
    const result = evaluate({
      project: fixture,
      mode: 'CONNECTION_PREVIEW',
      connection: candidate,
    });
    expect(codes(result)).toEqual(
      expect.arrayContaining([
        'PIN_ALREADY_ALLOCATED',
        'PIN_MUX_CONFLICT',
        'RESOURCE_ALREADY_ALLOCATED',
        'CHANNEL_ALREADY_ALLOCATED',
        'PIN_MAPPING_INCOMPLETE',
        'RESOURCE_FULLY_ALLOCATED',
      ]),
    );
  });

  it('reports invalid shared-bus roles and mixed families', () => {
    const candidate = connection('SHARED_BUS');
    const left = port('PORT-A', 'I2C', 'BIDIRECTIONAL', {
      interface: {
        type: 'I2C',
        bus_mode: 'SHARED_BUS',
        bus_role: 'TARGET',
        logic_voltage: voltage(),
      },
    });
    const right = port('PORT-B', 'SPI', 'BIDIRECTIONAL', {
      interface: {
        type: 'SPI',
        bus_mode: 'SHARED_BUS',
        bus_role: 'TARGET',
        logic_voltage: voltage(),
      },
    });
    const result = evaluate({ project: project(left, right, candidate), mode: 'DESIGN_CHECK' });
    expect(codes(result)).toEqual(
      expect.arrayContaining(['BUS_ROLE_INVALID', 'BUS_INTERFACE_MISMATCH']),
    );
  });

  it('enforces I2C address uniqueness and unresolved severity by mode', () => {
    const candidate = connection('SHARED_BUS');
    candidate.endpoints.push({
      endpoint_id: 'END-C',
      component_instance_id: 'INST-C',
      port_id: 'PORT-C',
      selected_mapping_ids: [],
      address_selections: [{ address_id: 'ADDR-C', value: 32 }],
    });
    candidate.endpoints[1].address_selections = [{ address_id: 'ADDR-B', value: 32 }];
    const controller = port('PORT-A', 'I2C', 'BIDIRECTIONAL', {
      interface: {
        type: 'I2C',
        bus_mode: 'SHARED_BUS',
        bus_role: 'CONTROLLER',
        logic_voltage: voltage(),
      },
    });
    const target = (id: string) =>
      port(id, 'I2C', 'BIDIRECTIONAL', {
        interface: {
          type: 'I2C',
          bus_mode: 'SHARED_BUS',
          bus_role: 'TARGET',
          logic_voltage: voltage(),
        },
      });
    const fixture = project(controller, target('PORT-B'), candidate);
    const targetB = fixture.component_instances[1]!.component_snapshot;
    targetB.address_capabilities.push({
      address_id: 'ADDR-B',
      port_id: 'PORT-B',
      kind: 'I2C_7_BIT',
      mode: 'SELECTABLE',
      allowed_values: [32, 33],
    });
    fixture.component_instances.push({
      instance_id: 'INST-C',
      layout: { x: 200, y: 0 },
      component_snapshot: component('CMP-C', [target('PORT-C')]),
    });
    fixture.component_instances[2]!.component_snapshot.address_capabilities.push({
      address_id: 'ADDR-C',
      port_id: 'PORT-C',
      kind: 'I2C_7_BIT',
      mode: 'SELECTABLE',
      allowed_values: [32, 34],
    });
    expect(
      codes(evaluate({ project: fixture, mode: 'CONNECTION_PREVIEW', connection: candidate })),
    ).toContain('I2C_ADDRESS_CONFLICT');
    candidate.endpoints[1].address_selections = [];
    const preview = evaluate({
      project: fixture,
      mode: 'CONNECTION_PREVIEW',
      connection: candidate,
    });
    const design = evaluate({ project: fixture, mode: 'DESIGN_CHECK' });
    expect(preview.findings.find(({ code }) => code === 'I2C_ADDRESS_UNRESOLVED')?.severity).toBe(
      'WARNING',
    );
    expect(design.findings.find(({ code }) => code === 'I2C_ADDRESS_UNRESOLVED')?.severity).toBe(
      'ERROR',
    );
  });

  it.each([
    [0, 'MODBUS_ADDRESS_INVALID'],
    [1, null],
    [247, null],
    [248, 'MODBUS_ADDRESS_INVALID'],
  ] as const)('validates Modbus address %s', (address, expected) => {
    const candidate = connection('MULTI_DROP');
    candidate.endpoints[1].address_selections = [{ address_id: 'ADDR-B', value: address }];
    const controller = port('PORT-A', 'RS485', 'BIDIRECTIONAL', {
      interface: {
        type: 'RS485',
        bus_mode: 'MULTI_DROP',
        bus_role: 'CONTROLLER',
        protocol: 'MODBUS_RTU',
        logic_voltage: voltage(),
      },
    });
    const target = port('PORT-B', 'RS485', 'BIDIRECTIONAL', {
      interface: {
        type: 'RS485',
        bus_mode: 'MULTI_DROP',
        bus_role: 'TARGET',
        protocol: 'MODBUS_RTU',
        logic_voltage: voltage(),
      },
    });
    const result = evaluate({
      project: project(controller, target, candidate),
      mode: 'CONNECTION_PREVIEW',
      connection: candidate,
    });
    if (expected) expect(codes(result)).toContain(expected);
    else expect(codes(result)).not.toContain('MODBUS_ADDRESS_INVALID');
  });

  it('detects duplicate SPI chip-select and Modbus addresses', () => {
    const spi = connection('SHARED_BUS');
    spi.endpoints.push({
      endpoint_id: 'END-C',
      component_instance_id: 'INST-C',
      port_id: 'PORT-C',
      selected_mapping_ids: [],
      address_selections: [{ address_id: 'ADDR-C', value: 1 }],
    });
    spi.endpoints[1].address_selections = [{ address_id: 'ADDR-B', value: 1 }];
    const spiController = port('PORT-A', 'SPI', 'BIDIRECTIONAL', {
      interface: {
        type: 'SPI',
        bus_mode: 'SHARED_BUS',
        bus_role: 'CONTROLLER',
        logic_voltage: voltage(),
      },
    });
    const spiTarget = (id: string) =>
      port(id, 'SPI', 'BIDIRECTIONAL', {
        interface: {
          type: 'SPI',
          bus_mode: 'SHARED_BUS',
          bus_role: 'TARGET',
          logic_voltage: voltage(),
        },
      });
    const spiProject = project(spiController, spiTarget('PORT-B'), spi);
    spiProject.component_instances.push({
      instance_id: 'INST-C',
      layout: { x: 200, y: 0 },
      component_snapshot: component('CMP-C', [spiTarget('PORT-C')]),
    });
    expect(codes(evaluate({ project: spiProject, mode: 'DESIGN_CHECK' }))).toContain(
      'SPI_CHIP_SELECT_CONFLICT',
    );

    const modbus = connection('MULTI_DROP');
    modbus.endpoints.push({
      endpoint_id: 'END-C',
      component_instance_id: 'INST-C',
      port_id: 'PORT-C',
      selected_mapping_ids: [],
      address_selections: [{ address_id: 'ADDR-C', value: 7 }],
    });
    modbus.endpoints[1].address_selections = [{ address_id: 'ADDR-B', value: 7 }];
    const controller = port('PORT-A', 'RS485', 'BIDIRECTIONAL', {
      interface: {
        type: 'RS485',
        bus_mode: 'MULTI_DROP',
        bus_role: 'CONTROLLER',
        protocol: 'MODBUS_RTU',
        logic_voltage: voltage(),
      },
    });
    const target = (id: string) =>
      port(id, 'RS485', 'BIDIRECTIONAL', {
        interface: {
          type: 'RS485',
          bus_mode: 'MULTI_DROP',
          bus_role: 'TARGET',
          protocol: 'MODBUS_RTU',
          logic_voltage: voltage(),
        },
      });
    const modbusProject = project(controller, target('PORT-B'), modbus);
    modbusProject.component_instances.push({
      instance_id: 'INST-C',
      layout: { x: 200, y: 0 },
      component_snapshot: component('CMP-C', [target('PORT-C')]),
    });
    expect(codes(evaluate({ project: modbusProject, mode: 'DESIGN_CHECK' }))).toContain(
      'MODBUS_ADDRESS_CONFLICT',
    );
  });

  it('reports power role, voltage, polarity, and incomplete-data failures', () => {
    const candidate = connection();
    const source = port('PORT-A', 'POWER_OUTPUT', 'OUTPUT', {
      interface: { type: 'POWER_OUTPUT', bus_mode: 'POINT_TO_POINT' },
      power: {
        role: 'SOURCE',
        voltage: voltage(12, 12),
        max_current: { value: 1, unit: 'A' },
        polarity: 'POSITIVE',
      },
    });
    const load = port('PORT-B', 'POWER_INPUT', 'INPUT', {
      interface: { type: 'POWER_INPUT', bus_mode: 'POINT_TO_POINT' },
      power: { role: 'LOAD', voltage: voltage(5, 5), polarity: 'NEGATIVE' },
    });
    const result = evaluate({
      project: project(source, load, candidate),
      mode: 'CONNECTION_PREVIEW',
      connection: candidate,
    });
    expect(codes(result)).toEqual(
      expect.arrayContaining([
        'POWER_VOLTAGE_INCOMPATIBLE',
        'POWER_DATA_INCOMPLETE',
        'POWER_POLARITY_MISMATCH',
      ]),
    );
    const twoSources = project(source, { ...load, power: { ...source.power! } }, candidate);
    expect(codes(evaluate({ project: twoSources, mode: 'DESIGN_CHECK' }))).toContain(
      'POWER_ROLE_INVALID',
    );
  });

  it.each([
    [0.81, 'POWER_MARGIN_LOW'],
    [0.8, null],
    [1.01, 'POWER_CURRENT_EXCEEDED'],
  ] as const)('checks power load boundary %s A', (loadCurrent, expected) => {
    const candidate = connection();
    const source = port('PORT-A', 'POWER_OUTPUT', 'OUTPUT', {
      interface: { type: 'POWER_OUTPUT', bus_mode: 'POINT_TO_POINT' },
      power: {
        role: 'SOURCE',
        voltage: voltage(5, 5),
        max_current: { value: 1, unit: 'A' },
        polarity: 'POSITIVE',
      },
    });
    const load = port('PORT-B', 'POWER_INPUT', 'INPUT', {
      interface: { type: 'POWER_INPUT', bus_mode: 'POINT_TO_POINT' },
      power: {
        role: 'LOAD',
        voltage: voltage(5, 5),
        max_current: { value: loadCurrent, unit: 'A' },
        polarity: 'POSITIVE',
      },
    });
    const result = evaluate({
      project: project(source, load, candidate),
      mode: 'CONNECTION_PREVIEW',
      connection: candidate,
    });
    if (expected) expect(codes(result)).toContain(expected);
    else expect(codes(result)).not.toContain('POWER_MARGIN_LOW');
  });
});

describe('Design Check completeness, lifecycle, overrides, and equivalence', () => {
  it('reports required ports, lifecycle state, and available revisions', () => {
    const required = port('PORT-A', 'GPIO_INPUT', 'INPUT', { requirement: 'REQUIRED' });
    const fixture = project(required, port('PORT-B', 'GPIO_OUTPUT', 'OUTPUT'));
    fixture.connections = [];
    fixture.component_instances[0]!.component_snapshot = component(
      'CMP-A',
      [required],
      'DEPRECATED',
    );
    const result = evaluate({
      project: fixture,
      mode: 'DESIGN_CHECK',
      latestComponentRevisions: { 'CMP-A': 2 },
    });
    expect(codes(result)).toEqual(
      expect.arrayContaining([
        'MISSING_REQUIRED_CONNECTION',
        'DEPRECATED_COMPONENT',
        'COMPONENT_UPDATE_AVAILABLE',
      ]),
    );
    expect(result.summary?.checks_evaluated).toBe(
      result.summary!.passed +
        result.summary!.infos +
        result.summary!.warnings +
        result.summary!.errors,
    );
  });

  it.each([
    ['REVIEW_REQUIRED', 'UNVERIFIED_COMPONENT'],
    ['DISABLED', 'DISABLED_COMPONENT'],
  ] as const)('reports lifecycle %s', (status, expected) => {
    const fixture = project(
      port('PORT-A', 'GPIO_OUTPUT', 'OUTPUT'),
      port('PORT-B', 'GPIO_INPUT', 'INPUT'),
    );
    fixture.component_instances[0]!.component_snapshot = component(
      'CMP-A',
      [port('PORT-A', 'GPIO_OUTPUT', 'OUTPUT')],
      status,
    );
    expect(codes(evaluate({ project: fixture, mode: 'DESIGN_CHECK' }))).toContain(expected);
  });

  it('acknowledges only an exact warning fingerprint', () => {
    const candidate = connection();
    const left = port('PORT-A', 'GPIO_OUTPUT', 'OUTPUT', {
      interface: { type: 'GPIO_OUTPUT', bus_mode: 'POINT_TO_POINT' },
    });
    const right = port('PORT-B', 'GPIO_INPUT', 'INPUT', {
      interface: { type: 'GPIO_INPUT', bus_mode: 'POINT_TO_POINT' },
    });
    const fixture = project(left, right, candidate);
    const first = evaluate({ project: fixture, mode: 'DESIGN_CHECK' });
    const warning = first.findings.find(({ severity }) => severity === 'WARNING')!;
    fixture.warning_overrides.push({
      override_id: 'OVR-TEST',
      ruleset_version: 'hwsd.connection-rules/1',
      rule_id: warning.rule_id,
      code: warning.code,
      message: warning.message,
      fingerprint: warning.fingerprint,
      subject: { project_id: fixture.project_id },
      confirmed_by: 'USR-OWNER',
      confirmed_at: '2026-01-01T00:00:00.000Z',
    });
    const acknowledged = evaluate({ project: fixture, mode: 'DESIGN_CHECK' });
    expect(
      acknowledged.findings.find(({ fingerprint }) => fingerprint === warning.fingerprint)
        ?.acknowledged,
    ).toBe(true);
  });

  it('matches candidate findings between preview and the same full project check', () => {
    const candidate = connection();
    const fixture = project(
      port('PORT-A', 'UART_TTL', 'BIDIRECTIONAL'),
      port('PORT-B', 'RS485', 'BIDIRECTIONAL'),
      candidate,
    );
    const preview = evaluate({
      project: fixture,
      mode: 'CONNECTION_PREVIEW',
      connection: candidate,
    });
    const full = evaluate({ project: fixture, mode: 'DESIGN_CHECK' });
    const previewCore = preview.findings
      .filter(({ rule_id }) => !rule_id.startsWith('COMP-'))
      .map(({ rule_id, code, severity, fingerprint }) => ({
        rule_id,
        code,
        severity,
        fingerprint,
      }));
    const fullCore = full.findings
      .filter(({ rule_id }) => !rule_id.startsWith('COMP-'))
      .map(({ rule_id, code, severity, fingerprint }) => ({
        rule_id,
        code,
        severity,
        fingerprint,
      }));
    expect(fullCore).toEqual(previewCore);
  });

  it('rejects a stale connection commit and detects stale stored Design Checks', () => {
    const candidate = connection();
    const fixture = project(
      port('PORT-A', 'GPIO_OUTPUT', 'OUTPUT'),
      port('PORT-B', 'GPIO_INPUT', 'INPUT'),
      candidate,
    );
    expect(() =>
      evaluate({
        project: fixture,
        mode: 'CONNECTION_COMMIT',
        connection: candidate,
        expectedDocumentRevision: 0,
      }),
    ).toThrow(ProjectRevisionConflictError);
    const result = evaluate({ project: fixture, mode: 'DESIGN_CHECK' });
    fixture.last_design_check = {
      evaluated_engineering_revision: fixture.engineering_revision,
      evaluated_at: '2026-01-01T00:00:00.000Z',
      result: { ...result, mode: 'DESIGN_CHECK' },
    };
    expect(isDesignCheckCurrent(fixture)).toBe(true);
    fixture.engineering_revision += 1;
    fixture.document_revision += 1;
    expect(isDesignCheckCurrent(fixture)).toBe(false);
  });
});

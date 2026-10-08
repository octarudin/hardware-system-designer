import type { ConnectionRuleResultV1, ProjectFileV1 } from '@hwsd/shared';

import { canonicalJson, sha256 } from './canonical.js';
import { compareSumToCapacity, isMarginBelowTwentyPercent } from './decimal.js';
import { RULE_REGISTRY, RULES_BY_ID } from './registry.js';
import type { AllocationEffect, EvaluationInput, Finding, ProjectConnection } from './types.js';

type Instance = ProjectFileV1['component_instances'][number];
type Port = Instance['component_snapshot']['ports'][number];
type Endpoint = ProjectConnection['endpoints'][number];
type Location = Finding['locations'][number];
type Severity = Finding['severity'];

interface ResolvedEndpoint {
  endpoint: Endpoint;
  instance: Instance;
  port: Port;
  portIndex: number;
}
interface Context {
  input: EvaluationInput;
  findings: Finding[];
  effects: AllocationEffect[];
  instances: Map<string, Instance>;
}

const severityOrder = { ERROR: 0, WARNING: 1, INFO: 2 } as const;
const powerTypes = new Set([
  'POWER_INPUT',
  'POWER_OUTPUT',
  'BATTERY_INPUT',
  'BATTERY_OUTPUT',
  'CHARGER_INPUT',
  'CHARGER_OUTPUT',
]);
const analogTypes = new Set([
  'ANALOG_INPUT',
  'ANALOG_OUTPUT',
  'ADC_INPUT',
  'DAC_OUTPUT',
  'ANALOG_0_10V',
  'ANALOG_4_20MA',
]);
const controllerBuses = new Set(['I2C', 'SPI', 'ONE_WIRE', 'LIN']);
const converterPairs = new Set(['RS485|UART_TTL', 'CAN|DIGITAL_CUSTOM', 'RS232|UART_TTL']);

function location(instance: Instance, path?: string): Location {
  return {
    entity_type: 'COMPONENT_INSTANCE',
    entity_id: instance.instance_id,
    ...(path ? { path } : {}),
  };
}

function connectionLocation(connection: ProjectConnection, path?: string): Location {
  return {
    entity_type: 'CONNECTION',
    entity_id: connection.connection_id,
    ...(path ? { path } : {}),
  };
}

function detail(key: string, value: unknown) {
  return { key, value: String(value) };
}

function addFinding(
  context: Context,
  ruleId: string,
  message: string,
  locations: readonly Location[],
  details: readonly { key: string; value: string }[] = [],
  suggestedActions: readonly string[] = [],
  severity?: Severity,
): void {
  const rule = RULES_BY_ID.get(ruleId);
  if (!rule) throw new Error(`Unknown rule: ${ruleId}`);
  const normalizedLocations = [...locations].sort((left, right) =>
    canonicalJson(left).localeCompare(canonicalJson(right)),
  );
  const normalizedDetails = [...details].sort((left, right) =>
    canonicalJson(left).localeCompare(canonicalJson(right)),
  );
  const fingerprint = sha256(
    canonicalJson({
      ruleset_version: 'hwsd.connection-rules/1',
      rule_id: ruleId,
      code: rule.code,
      locations: normalizedLocations,
      details: normalizedDetails,
    }),
  );
  const acknowledged = context.input.project.warning_overrides.some(
    (override) =>
      override.rule_id === ruleId &&
      override.code === rule.code &&
      override.fingerprint === fingerprint,
  );
  context.findings.push({
    rule_id: ruleId,
    code: rule.code,
    severity: severity ?? rule.defaultSeverity,
    message,
    locations: normalizedLocations as Finding['locations'],
    details: normalizedDetails,
    suggested_actions: [...suggestedActions],
    fingerprint,
    ...(acknowledged ? { acknowledged: true } : {}),
  });
}

function resolveEndpoints(context: Context, connection: ProjectConnection): ResolvedEndpoint[] {
  const resolved: ResolvedEndpoint[] = [];
  connection.endpoints.forEach((endpoint, index) => {
    const instance = context.instances.get(endpoint.component_instance_id);
    if (!instance) {
      addFinding(
        context,
        'STRUCT-001',
        `Component instance ${endpoint.component_instance_id} was not found.`,
        [connectionLocation(connection, `/endpoints/${index}/component_instance_id`)],
        [detail('reference', endpoint.component_instance_id)],
      );
      return;
    }
    const portIndex = instance.component_snapshot.ports.findIndex(
      (port) => port.port_id === endpoint.port_id,
    );
    const port = instance.component_snapshot.ports[portIndex];
    if (!port) {
      addFinding(
        context,
        'STRUCT-001',
        `Port ${endpoint.port_id} was not found in its component snapshot.`,
        [location(instance, `/ports/${endpoint.port_id}`)],
        [detail('reference', endpoint.port_id)],
      );
      return;
    }
    resolved.push({ endpoint, instance, port, portIndex });
  });
  return resolved;
}

function structural(
  context: Context,
  connection: ProjectConnection,
  endpoints: readonly ResolvedEndpoint[],
): void {
  const seen = new Set<string>();
  connection.endpoints.forEach((endpoint, index) => {
    const key = `${endpoint.component_instance_id}:${endpoint.port_id}`;
    if (seen.has(key))
      addFinding(
        context,
        'STRUCT-002',
        'The same component port appears more than once in this connection.',
        [connectionLocation(connection, `/endpoints/${index}`)],
        [detail('endpoint', key)],
      );
    seen.add(key);
  });
  const exactTwo =
    connection.topology === 'POINT_TO_POINT' || connection.topology === 'NOT_APPLICABLE';
  if (
    (exactTwo && connection.endpoints.length !== 2) ||
    (!exactTwo && connection.endpoints.length < 2)
  ) {
    addFinding(
      context,
      'STRUCT-003',
      `Topology ${connection.topology} has an invalid endpoint count.`,
      [connectionLocation(connection, '/endpoints')],
      [
        detail('endpoint_count', connection.endpoints.length),
        detail('topology', connection.topology),
      ],
    );
  }
  for (const endpoint of endpoints) {
    if (endpoint.port.interface.bus_mode !== connection.topology) {
      addFinding(
        context,
        'STRUCT-004',
        `Port bus mode ${endpoint.port.interface.bus_mode} does not match connection topology ${connection.topology}.`,
        [
          location(endpoint.instance, `/ports/${endpoint.portIndex}/interface/bus_mode`),
          connectionLocation(connection, '/topology'),
        ],
        [
          detail('bus_mode', endpoint.port.interface.bus_mode),
          detail('topology', connection.topology),
        ],
      );
    }
  }
}

function compatibleTypes(left: string, right: string): boolean {
  if (left === right) return true;
  const pair = new Set([left, right]);
  return (
    (pair.has('GPIO_OUTPUT') && pair.has('GPIO_INPUT')) ||
    (pair.has('GPIO_BIDIRECTIONAL') && (pair.has('GPIO_INPUT') || pair.has('GPIO_OUTPUT'))) ||
    ((pair.has('ANALOG_OUTPUT') || pair.has('DAC_OUTPUT')) &&
      (pair.has('ANALOG_INPUT') || pair.has('ADC_INPUT'))) ||
    (pair.has('RELAY_CONTACT') && pair.has('DRY_CONTACT')) ||
    (pair.has('POWER_OUTPUT') && (pair.has('POWER_INPUT') || pair.has('CHARGER_INPUT'))) ||
    (pair.has('BATTERY_OUTPUT') && (pair.has('POWER_INPUT') || pair.has('CHARGER_INPUT'))) ||
    (pair.has('CHARGER_OUTPUT') && (pair.has('BATTERY_INPUT') || pair.has('POWER_INPUT')))
  );
}

function directionsCompatible(left: Port, right: Port): boolean {
  if (left.interface.type === 'I2C' || left.interface.type === 'ONE_WIRE') return true;
  const pair = `${left.direction}|${right.direction}`;
  if (pair === 'OUTPUT|OUTPUT' || pair === 'INPUT|INPUT') return false;
  if (left.direction === 'PASSIVE' || right.direction === 'PASSIVE') return true;
  return true;
}

function interfaceRules(
  context: Context,
  connection: ProjectConnection,
  endpoints: readonly ResolvedEndpoint[],
): void {
  for (let leftIndex = 0; leftIndex < endpoints.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < endpoints.length; rightIndex += 1) {
      const left = endpoints[leftIndex]!;
      const right = endpoints[rightIndex]!;
      const leftType = left.port.interface.type;
      const rightType = right.port.interface.type;
      const locations = [
        location(left.instance, `/ports/${left.portIndex}`),
        location(right.instance, `/ports/${right.portIndex}`),
      ];
      const normalizedPair = [leftType, rightType].sort().join('|');
      if (converterPairs.has(normalizedPair)) {
        addFinding(
          context,
          'IFACE-003',
          `${leftType} cannot connect directly to ${rightType}; a converter or transceiver is required.`,
          locations,
          [
            detail('left_interface', leftType),
            detail('right_interface', rightType),
            detail('suggested_category', 'INTERFACE_CONVERTER_TRANSCEIVER'),
          ],
          ['Insert the required interface converter or transceiver.'],
        );
      } else if (!compatibleTypes(leftType, rightType)) {
        addFinding(
          context,
          'IFACE-001',
          `${leftType} and ${rightType} are not directly compatible.`,
          locations,
          [detail('left_interface', leftType), detail('right_interface', rightType)],
        );
      }
      if (
        !powerTypes.has(leftType) &&
        !powerTypes.has(rightType) &&
        !directionsCompatible(left.port, right.port)
      ) {
        addFinding(
          context,
          'IFACE-002',
          `Port directions ${left.port.direction} and ${right.port.direction} conflict.`,
          locations,
          [
            detail('left_direction', left.port.direction),
            detail('right_direction', right.port.direction),
          ],
        );
      }
      if (leftType === 'CUSTOM' || rightType === 'CUSTOM') {
        const verified =
          leftType === rightType &&
          left.port.interface.interface_id &&
          left.port.interface.interface_id === right.port.interface.interface_id &&
          left.port.interface.interface_revision === right.port.interface.interface_revision;
        if (!verified)
          addFinding(
            context,
            'IFACE-004',
            'The custom interface has no matching deterministic interface rule.',
            locations,
            [
              detail('left_interface_id', left.port.interface.interface_id ?? 'unknown'),
              detail('right_interface_id', right.port.interface.interface_id ?? 'unknown'),
            ],
          );
      }
      const leftProtocol = left.port.interface.protocol;
      const rightProtocol = right.port.interface.protocol;
      if (leftProtocol && rightProtocol && leftProtocol !== rightProtocol)
        addFinding(
          context,
          'IFACE-005',
          `Protocols ${leftProtocol} and ${rightProtocol} conflict.`,
          locations,
          [detail('left_protocol', leftProtocol), detail('right_protocol', rightProtocol)],
        );
      else if (Boolean(leftProtocol) !== Boolean(rightProtocol))
        addFinding(
          context,
          'IFACE-006',
          'Protocol validation is incomplete because only one endpoint declares a protocol.',
          locations,
          [detail('declared_protocol', leftProtocol ?? rightProtocol ?? 'unknown')],
        );
    }
  }
}

type Range = { min?: { value: number }; nominal?: { value: number }; max?: { value: number } };
function bounds(range: Range | undefined): [number, number] | null {
  if (!range) return null;
  const minimum = range.min?.value ?? range.nominal?.value;
  const maximum = range.max?.value ?? range.nominal?.value;
  return minimum === undefined || maximum === undefined ? null : [minimum, maximum];
}

function electricalRules(
  context: Context,
  connection: ProjectConnection,
  endpoints: readonly ResolvedEndpoint[],
): void {
  for (let leftIndex = 0; leftIndex < endpoints.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < endpoints.length; rightIndex += 1) {
      const left = endpoints[leftIndex]!;
      const right = endpoints[rightIndex]!;
      if (powerTypes.has(left.port.interface.type) || powerTypes.has(right.port.interface.type))
        continue;
      const locations = [
        location(left.instance, `/ports/${left.portIndex}/interface`),
        location(right.instance, `/ports/${right.portIndex}/interface`),
      ];
      const analog =
        analogTypes.has(left.port.interface.type) || analogTypes.has(right.port.interface.type);
      const leftRange = bounds(
        analog ? left.port.interface.signal_voltage : left.port.interface.logic_voltage,
      );
      const rightRange = bounds(
        analog ? right.port.interface.signal_voltage : right.port.interface.logic_voltage,
      );
      if (!leftRange || !rightRange)
        addFinding(context, 'ELEC-002', 'Electrical voltage limits are incomplete.', locations, [
          detail('quantity', analog ? 'signal_voltage' : 'logic_voltage'),
        ]);
      else {
        const disjoint = leftRange[1] < rightRange[0] || rightRange[1] < leftRange[0];
        const leftIsSource =
          left.port.direction === 'OUTPUT' ||
          left.port.interface.type === 'ANALOG_OUTPUT' ||
          left.port.interface.type === 'DAC_OUTPUT';
        const sourceRange = leftIsSource ? leftRange : rightRange;
        const inputRange = leftIsSource ? rightRange : leftRange;
        const analogOutside =
          analog && (sourceRange[0] < inputRange[0] || sourceRange[1] > inputRange[1]);
        if (disjoint || analogOutside)
          addFinding(
            context,
            analog ? 'ELEC-003' : 'ELEC-001',
            analog
              ? 'Analog source and input ranges are incompatible.'
              : 'Digital logic voltage ranges are incompatible.',
            locations,
            [
              detail('left_range', `${leftRange[0]}..${leftRange[1]}`),
              detail('right_range', `${rightRange[0]}..${rightRange[1]}`),
            ],
          );
        else if (
          !analog &&
          ((leftRange[0] < rightRange[0] && leftRange[1] < rightRange[1]) ||
            (rightRange[0] < leftRange[0] && rightRange[1] < leftRange[1]))
        )
          addFinding(
            context,
            'ELEC-002',
            'Digital voltage ranges overlap only partially.',
            locations,
            [
              detail('left_range', `${leftRange[0]}..${leftRange[1]}`),
              detail('right_range', `${rightRange[0]}..${rightRange[1]}`),
            ],
          );
      }
    }
  }
  if (connection.operating_frequency) {
    for (const endpoint of endpoints) {
      const maximum = endpoint.port.interface.max_frequency?.value;
      if (maximum !== undefined && connection.operating_frequency.value > maximum)
        addFinding(
          context,
          'ELEC-004',
          'Selected operating frequency exceeds an endpoint capability.',
          [
            location(endpoint.instance, `/ports/${endpoint.portIndex}/interface/max_frequency`),
            connectionLocation(connection, '/operating_frequency'),
          ],
          [
            detail('selected_hz', connection.operating_frequency.value),
            detail('maximum_hz', maximum),
          ],
        );
    }
  }
}

function effectKey(effect: AllocationEffect): string {
  return `${effect.component_instance_id}:${effect.resource_kind}:${effect.resource_id}:${effect.channel ?? ''}`;
}

function allocationRules(
  context: Context,
  connection: ProjectConnection,
  endpoints: readonly ResolvedEndpoint[],
): void {
  const proposed: AllocationEffect[] = [];
  const referencedResources = new Map<
    string,
    { instance: Instance; resource: Instance['component_snapshot']['resources'][number] }
  >();
  for (const resolved of endpoints) {
    const { endpoint, instance, port } = resolved;
    const selectedMappings = new Set(endpoint.selected_mapping_ids);
    for (const mappingId of selectedMappings) {
      const mapping = instance.component_snapshot.resources
        .flatMap((resource) => resource.compatible_pin_mappings)
        .find((candidate) => candidate.mapping_id === mappingId);
      if (!mapping) {
        addFinding(
          context,
          'STRUCT-001',
          `Selected pin mapping ${mappingId} was not found.`,
          [location(instance, `/resources/mappings/${mappingId}`)],
          [detail('mapping_id', mappingId)],
        );
        continue;
      }
      for (const assignment of mapping.assignments) {
        proposed.push({
          action: 'ALLOCATE',
          component_instance_id: instance.instance_id,
          resource_kind: 'PIN',
          resource_id: assignment.pin_id,
          connection_id: connection.connection_id,
        });
        proposed.push({
          action: 'ALLOCATE',
          component_instance_id: instance.instance_id,
          resource_kind: 'FUNCTION',
          resource_id: assignment.function_id,
          connection_id: connection.connection_id,
        });
      }
    }
    const needsMapping = port.bindings.some(
      (binding) =>
        binding.resource_id &&
        instance.component_snapshot.resources.find(
          (resource) => resource.resource_id === binding.resource_id,
        )?.compatible_pin_mappings.length,
    );
    if (needsMapping && selectedMappings.size === 0)
      addFinding(
        context,
        'ALLOC-005',
        'A required compatible pin mapping has not been selected.',
        [location(instance, `/ports/${resolved.portIndex}/bindings`)],
        [detail('port_id', port.port_id)],
      );
    for (const binding of port.bindings) {
      if (binding.pin_id)
        proposed.push({
          action: 'ALLOCATE',
          component_instance_id: instance.instance_id,
          resource_kind: 'PIN',
          resource_id: binding.pin_id,
          connection_id: connection.connection_id,
        });
      if (binding.function_id)
        proposed.push({
          action: 'ALLOCATE',
          component_instance_id: instance.instance_id,
          resource_kind: 'FUNCTION',
          resource_id: binding.function_id,
          connection_id: connection.connection_id,
        });
      if (binding.resource_id) {
        const resource = instance.component_snapshot.resources.find(
          (candidate) => candidate.resource_id === binding.resource_id,
        );
        if (resource)
          referencedResources.set(`${instance.instance_id}:${resource.resource_id}`, {
            instance,
            resource,
          });
        proposed.push({
          action: resource?.share_mode === 'SHARED_BUS' ? 'SHARE' : 'ALLOCATE',
          component_instance_id: instance.instance_id,
          resource_kind: 'RESOURCE',
          resource_id: binding.resource_id,
          connection_id: connection.connection_id,
        });
        if (binding.channel)
          proposed.push({
            action: 'ALLOCATE',
            component_instance_id: instance.instance_id,
            resource_kind: 'CHANNEL',
            resource_id: binding.resource_id,
            channel: binding.channel,
            connection_id: connection.connection_id,
          });
      }
    }
  }
  const unique = new Map(proposed.map((effect) => [effectKey(effect), effect]));
  for (const effect of unique.values()) {
    const conflicts = context.input.project.allocations.filter(
      (allocation) =>
        allocation.connection_id !== connection.connection_id &&
        allocation.component_instance_id === effect.component_instance_id &&
        allocation.resource_kind === effect.resource_kind &&
        allocation.resource_id === effect.resource_id &&
        (effect.resource_kind !== 'CHANNEL' || allocation.channel === effect.channel),
    );
    const sharing = effect.action === 'SHARE';
    if (conflicts.length && !sharing) {
      const rules = {
        PIN: 'ALLOC-001',
        FUNCTION: 'ALLOC-002',
        RESOURCE: 'ALLOC-003',
        CHANNEL: 'ALLOC-004',
      } as const;
      addFinding(
        context,
        rules[effect.resource_kind],
        `${effect.resource_kind.toLowerCase()} ${effect.resource_id} is already allocated.`,
        [
          location(
            context.instances.get(effect.component_instance_id)!,
            `/allocations/${effect.resource_id}`,
          ),
        ],
        [
          detail('resource_id', effect.resource_id),
          detail('existing_connection', conflicts[0]!.connection_id),
        ],
      );
    }
    if (!conflicts.length || sharing) context.effects.push(effect);
  }
  for (const resolved of endpoints) {
    const functions = resolved.port.bindings.flatMap((binding) =>
      binding.function_id ? [binding.function_id] : [],
    );
    for (const functionId of functions) {
      const selected = resolved.instance.component_snapshot.pins
        .flatMap((pin) => pin.alternate_functions.map((fn) => ({ pin, fn })))
        .find(({ fn }) => fn.function_id === functionId);
      if (!selected?.fn.mux_group) continue;
      const conflicting = context.input.project.allocations.find(
        (allocation) =>
          allocation.component_instance_id === resolved.instance.instance_id &&
          allocation.resource_kind === 'FUNCTION' &&
          allocation.resource_id !== functionId &&
          resolved.instance.component_snapshot.pins.some((pin) =>
            pin.alternate_functions.some(
              (fn) =>
                fn.function_id === allocation.resource_id && fn.mux_group === selected.fn.mux_group,
            ),
          ),
      );
      if (conflicting)
        addFinding(
          context,
          'ALLOC-002',
          `Mux group ${selected.fn.mux_group} is already consumed by another function.`,
          [location(resolved.instance, `/pins/${selected.pin.pin_id}`)],
          [detail('mux_group', selected.fn.mux_group), detail('function_id', functionId)],
        );
    }
  }
  for (const { instance, resource } of referencedResources.values()) {
    const committed = context.input.project.allocations.filter(
      (allocation) =>
        allocation.component_instance_id === instance.instance_id &&
        allocation.resource_id === resource.resource_id,
    );
    const proposedForResource = proposed.filter(
      (effect) =>
        effect.component_instance_id === instance.instance_id &&
        effect.resource_id === resource.resource_id,
    );
    const full =
      resource.share_mode === 'EXCLUSIVE'
        ? committed.length + proposedForResource.length > 0
        : resource.share_mode === 'CHANNELIZED' &&
          resource.channels.length > 0 &&
          new Set(
            [
              ...committed.map(({ channel }) => channel),
              ...proposedForResource.map(({ channel }) => channel),
            ].filter((channel): channel is string => Boolean(channel)),
          ).size >= resource.channels.length;
    if (full)
      addFinding(
        context,
        'ALLOC-006',
        `Resource ${resource.name} has no remaining V1 allocation capacity.`,
        [location(instance, `/resources/${resource.resource_id}`)],
        [detail('resource_id', resource.resource_id)],
      );
  }
}

function busRules(
  context: Context,
  connection: ProjectConnection,
  endpoints: readonly ResolvedEndpoint[],
): void {
  if (endpoints.length < 2) return;
  const types = new Set(endpoints.map(({ port }) => port.interface.type));
  if (
    (connection.topology === 'SHARED_BUS' || connection.topology === 'MULTI_DROP') &&
    types.size > 1
  )
    addFinding(
      context,
      'BUS-002',
      'Bus members do not use one compatible interface family.',
      endpoints.map(({ instance, portIndex }) =>
        location(instance, `/ports/${portIndex}/interface/type`),
      ),
      [detail('interfaces', [...types].sort().join(','))],
    );
  const type = endpoints[0]!.port.interface.type;
  if (
    controllerBuses.has(type) ||
    (type === 'RS485' && endpoints.some(({ port }) => port.interface.protocol === 'MODBUS_RTU'))
  ) {
    const controllers = endpoints.filter(
      ({ port }) => port.interface.bus_role === 'CONTROLLER',
    ).length;
    const targets = endpoints.filter(({ port }) => port.interface.bus_role === 'TARGET').length;
    if (controllers !== 1 || targets < 1)
      addFinding(
        context,
        'BUS-001',
        `${type} requires exactly one controller and at least one target.`,
        endpoints.map(({ instance, portIndex }) =>
          location(instance, `/ports/${portIndex}/interface/bus_role`),
        ),
        [detail('controllers', controllers), detail('targets', targets)],
      );
  } else if (
    type === 'CAN' &&
    endpoints.some(({ port }) => port.interface.bus_role && port.interface.bus_role !== 'PEER')
  )
    addFinding(
      context,
      'BUS-001',
      'CAN physical bus endpoints must use peer roles.',
      endpoints.map(({ instance, portIndex }) =>
        location(instance, `/ports/${portIndex}/interface/bus_role`),
      ),
    );

  if (type === 'I2C') {
    const used = new Map<number, ResolvedEndpoint>();
    for (const resolved of endpoints.filter(({ port }) => port.interface.bus_role === 'TARGET')) {
      const capabilities = resolved.instance.component_snapshot.address_capabilities.filter(
        (candidate) =>
          candidate.port_id === resolved.port.port_id && candidate.kind.startsWith('I2C'),
      );
      for (const capability of capabilities) {
        const selection =
          resolved.endpoint.address_selections.find(
            ({ address_id }) => address_id === capability.address_id,
          )?.value ?? (capability.mode === 'FIXED' ? capability.allowed_values?.[0] : undefined);
        if (selection === undefined)
          addFinding(
            context,
            'BUS-004',
            'An I2C target address has not been resolved.',
            [location(resolved.instance, `/address_capabilities/${capability.address_id}`)],
            [detail('address_id', capability.address_id)],
            ['Select a unique target address.'],
            context.input.mode === 'DESIGN_CHECK' ? 'ERROR' : 'WARNING',
          );
        else if (
          (capability.kind === 'I2C_7_BIT' && (selection < 8 || selection > 119)) ||
          used.has(selection)
        )
          addFinding(
            context,
            'BUS-003',
            used.has(selection)
              ? `I2C address ${selection} is used by more than one target.`
              : `I2C address ${selection} is reserved or invalid for an ordinary target.`,
            [
              location(resolved.instance, `/address_capabilities/${capability.address_id}`),
              ...(used.get(selection) ? [location(used.get(selection)!.instance)] : []),
            ],
            [detail('address', selection)],
          );
        else used.set(selection, resolved);
      }
    }
  }
  if (type === 'SPI') {
    const chipSelects = new Set<number>();
    for (const resolved of endpoints.filter(({ port }) => port.interface.bus_role === 'TARGET')) {
      for (const selection of resolved.endpoint.address_selections) {
        if (chipSelects.has(selection.value))
          addFinding(
            context,
            'BUS-005',
            `SPI chip-select ${selection.value} is assigned to multiple targets.`,
            [location(resolved.instance)],
            [detail('chip_select', selection.value)],
          );
        chipSelects.add(selection.value);
      }
    }
  }
  if (type === 'RS485' && endpoints.some(({ port }) => port.interface.protocol === 'MODBUS_RTU')) {
    const used = new Set<number>();
    for (const resolved of endpoints.filter(({ port }) => port.interface.bus_role === 'TARGET')) {
      const selections = resolved.endpoint.address_selections;
      if (!selections.length && context.input.mode === 'DESIGN_CHECK')
        addFinding(
          context,
          'BUS-007',
          'A Modbus target requires a slave address.',
          [location(resolved.instance)],
          [detail('address', 'unresolved')],
        );
      for (const selection of selections) {
        if (selection.value < 1 || selection.value > 247)
          addFinding(
            context,
            'BUS-007',
            `Modbus slave address ${selection.value} is outside 1..247.`,
            [location(resolved.instance)],
            [detail('address', selection.value)],
          );
        else if (used.has(selection.value))
          addFinding(
            context,
            'BUS-006',
            `Modbus slave address ${selection.value} is duplicated.`,
            [location(resolved.instance)],
            [detail('address', selection.value)],
          );
        used.add(selection.value);
      }
    }
  }
}

function powerRules(
  context: Context,
  connection: ProjectConnection,
  endpoints: readonly ResolvedEndpoint[],
): void {
  const powerEndpoints = endpoints.filter(({ port }) => powerTypes.has(port.interface.type));
  if (!powerEndpoints.length) return;
  const sources = powerEndpoints.filter(({ port }) => port.power?.role === 'SOURCE');
  const loads = powerEndpoints.filter(({ port }) => port.power?.role === 'LOAD');
  if (sources.length !== 1 || loads.length < 1)
    addFinding(
      context,
      'POWER-001',
      'A V1 power net requires exactly one source and at least one load.',
      powerEndpoints.map(({ instance, portIndex }) =>
        location(instance, `/ports/${portIndex}/power/role`),
      ),
      [detail('sources', sources.length), detail('loads', loads.length)],
    );
  if (sources.length !== 1) return;
  const source = sources[0]!;
  const sourceBounds = bounds(source.port.power?.voltage);
  let incomplete = !sourceBounds;
  for (const load of loads) {
    const loadBounds = bounds(load.port.power?.voltage);
    if (!sourceBounds || !loadBounds) incomplete = true;
    else if (sourceBounds[0] < loadBounds[0] || sourceBounds[1] > loadBounds[1])
      addFinding(
        context,
        'POWER-002',
        'Source voltage is outside a load accepted range.',
        [location(source.instance), location(load.instance)],
        [
          detail('source_range', `${sourceBounds[0]}..${sourceBounds[1]}`),
          detail('load_range', `${loadBounds[0]}..${loadBounds[1]}`),
        ],
      );
    const sourcePolarity = source.port.power?.polarity;
    const loadPolarity = load.port.power?.polarity;
    if (
      sourcePolarity &&
      loadPolarity &&
      sourcePolarity !== 'NOT_APPLICABLE' &&
      loadPolarity !== 'NOT_APPLICABLE' &&
      sourcePolarity !== loadPolarity
    )
      addFinding(
        context,
        'POWER-006',
        'Power source and load polarity are incompatible.',
        [location(source.instance), location(load.instance)],
        [detail('source_polarity', sourcePolarity), detail('load_polarity', loadPolarity)],
      );
  }
  const capacity = source.port.power?.max_current?.value;
  const currents = loads.map(
    ({ port }) =>
      port.power?.peak_current?.value ??
      port.power?.max_current?.value ??
      port.power?.typical_current?.value,
  );
  if (capacity === undefined || currents.some((value) => value === undefined)) incomplete = true;
  if (incomplete)
    addFinding(
      context,
      'POWER-005',
      'Power voltage or current budget cannot be fully proven.',
      powerEndpoints.map(({ instance }) => location(instance)),
      [detail('quantity', 'voltage_or_current')],
    );
  if (capacity !== undefined && currents.every((value): value is number => value !== undefined)) {
    const total = currents.reduce((sum, value) => sum + value, 0);
    if (compareSumToCapacity(currents, capacity) > 0)
      addFinding(
        context,
        'POWER-003',
        'Total conservative load current exceeds source capacity.',
        powerEndpoints.map(({ instance }) => location(instance)),
        [detail('source_capacity_a', capacity), detail('total_load_a', total)],
      );
    else if (isMarginBelowTwentyPercent(currents, capacity))
      addFinding(
        context,
        'POWER-004',
        'Remaining source current margin is below 20%.',
        powerEndpoints.map(({ instance }) => location(instance)),
        [
          detail('source_capacity_a', capacity),
          detail('total_load_a', total),
          detail('recommended_margin_percent', 20),
        ],
      );
  }
}

function completenessRules(context: Context, errorConnections: ReadonlySet<string>): void {
  for (const instance of context.instances.values()) {
    instance.component_snapshot.ports.forEach((port, portIndex) => {
      if (port.requirement !== 'REQUIRED') return;
      const connected = context.input.project.connections.some(
        (connection) =>
          !errorConnections.has(connection.connection_id) &&
          connection.endpoints.some(
            (endpoint) =>
              endpoint.component_instance_id === instance.instance_id &&
              endpoint.port_id === port.port_id,
          ),
      );
      if (!connected)
        addFinding(
          context,
          'COMP-001',
          `Required port ${port.name} is not connected by a valid connection.`,
          [location(instance, `/ports/${portIndex}`)],
          [detail('port_id', port.port_id)],
        );
    });
    const status = instance.component_snapshot.lifecycle.status;
    if (status === 'DEPRECATED')
      addFinding(
        context,
        'COMP-003',
        'The project uses a deprecated component snapshot.',
        [location(instance)],
        [
          detail('component_id', instance.component_snapshot.component_id),
          detail('revision', instance.component_snapshot.revision),
        ],
      );
    else if (status === 'DISABLED')
      addFinding(
        context,
        'COMP-004',
        'The project contains a historical disabled component snapshot.',
        [location(instance)],
        [
          detail('component_id', instance.component_snapshot.component_id),
          detail('revision', instance.component_snapshot.revision),
        ],
      );
    else if (status !== 'VERIFIED')
      addFinding(
        context,
        'COMP-002',
        'The component snapshot is not administrator verified.',
        [location(instance)],
        [detail('lifecycle_status', status)],
      );
    const latest =
      context.input.latestComponentRevisions?.[instance.component_snapshot.component_id];
    if (latest !== undefined && latest > instance.component_snapshot.revision)
      addFinding(
        context,
        'COMP-005',
        'A newer component revision is available.',
        [location(instance)],
        [
          detail('current_revision', instance.component_snapshot.revision),
          detail('latest_revision', latest),
        ],
      );
  }
}

function evaluateConnection(context: Context, connection: ProjectConnection): boolean {
  const before = context.findings.length;
  const endpoints = resolveEndpoints(context, connection);
  structural(context, connection, endpoints);
  interfaceRules(context, connection, endpoints);
  electricalRules(context, connection, endpoints);
  allocationRules(context, connection, endpoints);
  busRules(context, connection, endpoints);
  powerRules(context, connection, endpoints);
  return context.findings
    .slice(before)
    .some(
      ({ severity, acknowledged }) =>
        severity === 'ERROR' || (severity === 'WARNING' && !acknowledged),
    );
}

function stableFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity] ||
      left.rule_id.localeCompare(right.rule_id) ||
      canonicalJson(left.locations).localeCompare(canonicalJson(right.locations)) ||
      left.fingerprint.localeCompare(right.fingerprint),
  );
}

export function evaluate(input: EvaluationInput): ConnectionRuleResultV1 {
  if (input.project.ruleset_version !== 'hwsd.connection-rules/1')
    throw new Error(`Unsupported ruleset: ${input.project.ruleset_version}`);
  if (input.mode !== 'DESIGN_CHECK' && !input.connection)
    throw new Error(`${input.mode} requires a candidate connection.`);
  if (
    input.mode === 'CONNECTION_COMMIT' &&
    input.expectedDocumentRevision !== undefined &&
    input.expectedDocumentRevision !== input.project.document_revision
  )
    throw new ProjectRevisionConflictError();
  const context: Context = {
    input,
    findings: [],
    effects: [],
    instances: new Map(
      input.project.component_instances.map((instance) => [instance.instance_id, instance]),
    ),
  };
  const errorConnections = new Set<string>();
  const connections =
    input.mode === 'DESIGN_CHECK' ? input.project.connections : [input.connection!];
  for (const connection of connections)
    if (evaluateConnection(context, connection)) errorConnections.add(connection.connection_id);
  if (input.mode === 'DESIGN_CHECK') completenessRules(context, errorConnections);
  const findings = stableFindings(context.findings);
  const errors = findings.filter(({ severity }) => severity === 'ERROR').length;
  const warnings = findings.filter(({ severity }) => severity === 'WARNING').length;
  const infos = findings.filter(({ severity }) => severity === 'INFO').length;
  const verdict: ConnectionRuleResultV1['verdict'] = errors
    ? 'ERROR'
    : warnings
      ? 'WARNING'
      : 'VALID';
  const subject =
    input.mode === 'DESIGN_CHECK'
      ? { project_id: input.project.project_id }
      : { connection_id: input.connection!.connection_id };
  const base = {
    ruleset_version: 'hwsd.connection-rules/1' as const,
    mode: input.mode,
    subject,
    verdict,
    allowed: errors === 0,
    requires_confirmation: input.mode !== 'DESIGN_CHECK' && warnings > 0 && errors === 0,
    findings,
    allocation_effects:
      errors || input.mode === 'DESIGN_CHECK'
        ? []
        : [...new Map(context.effects.map((effect) => [effectKey(effect), effect])).values()].sort(
            (left, right) => effectKey(left).localeCompare(effectKey(right)),
          ),
  };
  if (input.mode !== 'DESIGN_CHECK') return base;
  const outcomes = errors + warnings + infos;
  const applications = Math.max(
    outcomes,
    RULE_REGISTRY.length * Math.max(1, connections.length) + context.instances.size,
  );
  return {
    ...base,
    mode: 'DESIGN_CHECK',
    summary: {
      checks_evaluated: applications,
      passed: applications - outcomes,
      infos,
      warnings,
      errors,
    },
  };
}

export class ProjectRevisionConflictError extends Error {
  public readonly code = 'PROJECT_REVISION_CONFLICT';
  public constructor() {
    super('The project revision changed before connection commit evaluation.');
    this.name = 'ProjectRevisionConflictError';
  }
}

export function isDesignCheckCurrent(project: ProjectFileV1): boolean {
  return Boolean(
    project.last_design_check &&
    project.last_design_check.evaluated_engineering_revision === project.engineering_revision &&
    project.last_design_check.result.ruleset_version === project.ruleset_version,
  );
}

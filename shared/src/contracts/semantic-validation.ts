import type {
  HardwareSystemDesignerComponentSchemaV1 as ComponentSchemaV1,
  Pin,
  Port,
  Resource,
} from '../generated/component-schema-v1.js';
import type { HardwareSystemDesignerProjectFileV1 as ProjectFileV1 } from '../generated/project-file-v1.js';

export interface SemanticValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface SemanticValidationResult {
  readonly valid: boolean;
  readonly issues: readonly SemanticValidationIssue[];
}

type MutableIssue = { code: string; path: string; message: string };

function addIssue(issues: MutableIssue[], code: string, path: string, message: string): void {
  issues.push({ code, path, message });
}

function duplicateIds<T>(
  values: readonly T[],
  idOf: (value: T) => string,
  path: string,
  issues: MutableIssue[],
): void {
  const firstIndex = new Map<string, number>();
  values.forEach((value, index) => {
    const id = idOf(value);
    if (firstIndex.has(id)) {
      addIssue(issues, 'SEMANTIC_DUPLICATE_ID', `${path}/${index}`, `Duplicate identifier: ${id}`);
    } else {
      firstIndex.set(id, index);
    }
  });
}

interface NumericRange {
  readonly min?: { readonly value: number };
  readonly nominal?: { readonly value: number };
  readonly max?: { readonly value: number };
}

function validateRange(
  range: NumericRange | undefined,
  path: string,
  issues: MutableIssue[],
): void {
  if (!range) return;
  const minimum = range.min?.value;
  const nominal = range.nominal?.value;
  const maximum = range.max?.value;
  if (minimum !== undefined && nominal !== undefined && minimum > nominal) {
    addIssue(issues, 'SEMANTIC_RANGE_ORDER', `${path}/nominal/value`, 'Nominal is below minimum');
  }
  if (nominal !== undefined && maximum !== undefined && nominal > maximum) {
    addIssue(issues, 'SEMANTIC_RANGE_ORDER', `${path}/max/value`, 'Maximum is below nominal');
  }
  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    addIssue(issues, 'SEMANTIC_RANGE_ORDER', `${path}/max/value`, 'Maximum is below minimum');
  }
}

function validatePortRanges(port: Port, path: string, issues: MutableIssue[]): void {
  validateRange(port.interface.logic_voltage, `${path}/interface/logic_voltage`, issues);
  validateRange(port.interface.signal_voltage, `${path}/interface/signal_voltage`, issues);
  validateRange(port.interface.signal_current, `${path}/interface/signal_current`, issues);
  validateRange(port.power?.voltage, `${path}/power/voltage`, issues);
  const typical = port.power?.typical_current?.value;
  const maximum = port.power?.max_current?.value;
  if (typical !== undefined && maximum !== undefined && typical > maximum) {
    addIssue(
      issues,
      'SEMANTIC_CURRENT_LIMIT',
      `${path}/power/typical_current/value`,
      'Typical current exceeds maximum current',
    );
  }
}

function validateResourceMappings(
  resource: Resource,
  resourceIndex: number,
  pins: ReadonlyMap<string, Pin>,
  issues: MutableIssue[],
): void {
  const path = `/resources/${resourceIndex}`;
  duplicateIds(
    resource.compatible_pin_mappings,
    (mapping) => mapping.mapping_id,
    `${path}/compatible_pin_mappings`,
    issues,
  );
  const channelSignals = new Set(resource.channels.map((channel) => channel.signal));

  resource.compatible_pin_mappings.forEach((mapping, mappingIndex) => {
    mapping.assignments.forEach((assignment, assignmentIndex) => {
      const assignmentPath = `${path}/compatible_pin_mappings/${mappingIndex}/assignments/${assignmentIndex}`;
      const pin = pins.get(assignment.pin_id);
      if (!pin) {
        addIssue(
          issues,
          'SEMANTIC_REFERENCE_NOT_FOUND',
          `${assignmentPath}/pin_id`,
          `Unknown pin: ${assignment.pin_id}`,
        );
        return;
      }
      const functionMatch = pin.alternate_functions.some(
        (candidate) => candidate.function_id === assignment.function_id,
      );
      if (!functionMatch) {
        addIssue(
          issues,
          'SEMANTIC_FUNCTION_PIN_MISMATCH',
          `${assignmentPath}/function_id`,
          `Function ${assignment.function_id} does not belong to pin ${assignment.pin_id}`,
        );
      }
      if (!channelSignals.has(assignment.signal)) {
        addIssue(
          issues,
          'SEMANTIC_SIGNAL_NOT_FOUND',
          `${assignmentPath}/signal`,
          `Signal is not declared by resource ${resource.resource_id}`,
        );
      }
    });
  });
}

function finish(issues: MutableIssue[]): SemanticValidationResult {
  issues.sort((left, right) =>
    `${left.path}:${left.code}:${left.message}`.localeCompare(
      `${right.path}:${right.code}:${right.message}`,
    ),
  );
  return { valid: issues.length === 0, issues };
}

export function validateComponentSemantics(component: ComponentSchemaV1): SemanticValidationResult {
  const issues: MutableIssue[] = [];
  duplicateIds(component.pins, (pin) => pin.pin_id, '/pins', issues);
  duplicateIds(component.ports, (port) => port.port_id, '/ports', issues);
  duplicateIds(component.resources, (resource) => resource.resource_id, '/resources', issues);
  duplicateIds(
    component.address_capabilities,
    (address) => address.address_id,
    '/address_capabilities',
    issues,
  );
  duplicateIds(component.notes, (note) => note.note_id, '/notes', issues);
  duplicateIds(
    component.provenance.datasheets,
    (datasheet) => datasheet.datasheet_id,
    '/provenance/datasheets',
    issues,
  );

  const pins = new Map(component.pins.map((pin) => [pin.pin_id, pin]));
  const ports = new Map(component.ports.map((port) => [port.port_id, port]));
  const resources = new Map(
    component.resources.map((resource) => [resource.resource_id, resource]),
  );
  const datasheets = new Set(
    component.provenance.datasheets.map((datasheet) => datasheet.datasheet_id),
  );

  component.provenance.field_evidence.forEach((evidence, index) => {
    if (evidence.datasheet_id && !datasheets.has(evidence.datasheet_id)) {
      addIssue(
        issues,
        'SEMANTIC_REFERENCE_NOT_FOUND',
        `/provenance/field_evidence/${index}/datasheet_id`,
        `Unknown datasheet: ${evidence.datasheet_id}`,
      );
    }
  });

  component.pins.forEach((pin, pinIndex) => {
    duplicateIds(
      pin.alternate_functions,
      (fn) => fn.function_id,
      `/pins/${pinIndex}/alternate_functions`,
      issues,
    );
    validateRange(pin.logic_voltage, `/pins/${pinIndex}/logic_voltage`, issues);
    validateRange(pin.absolute_voltage, `/pins/${pinIndex}/absolute_voltage`, issues);
    pin.alternate_functions.forEach((fn, functionIndex) => {
      const resource = fn.resource_id ? resources.get(fn.resource_id) : undefined;
      if (fn.resource_id && !resource) {
        addIssue(
          issues,
          'SEMANTIC_REFERENCE_NOT_FOUND',
          `/pins/${pinIndex}/alternate_functions/${functionIndex}/resource_id`,
          `Unknown resource: ${fn.resource_id}`,
        );
      }
      if (
        fn.channel &&
        resource &&
        !resource.channels.some((candidate) => candidate.channel === fn.channel)
      ) {
        addIssue(
          issues,
          'SEMANTIC_REFERENCE_NOT_FOUND',
          `/pins/${pinIndex}/alternate_functions/${functionIndex}/channel`,
          `Unknown channel on resource ${resource.resource_id}: ${fn.channel}`,
        );
      }
    });
  });

  component.ports.forEach((port, portIndex) => {
    validatePortRanges(port, `/ports/${portIndex}`, issues);
    port.bindings.forEach((binding, bindingIndex) => {
      const path = `/ports/${portIndex}/bindings/${bindingIndex}`;
      const pin = binding.pin_id ? pins.get(binding.pin_id) : undefined;
      const resource = binding.resource_id ? resources.get(binding.resource_id) : undefined;
      if (binding.pin_id && !pin) {
        addIssue(
          issues,
          'SEMANTIC_REFERENCE_NOT_FOUND',
          `${path}/pin_id`,
          `Unknown pin: ${binding.pin_id}`,
        );
      }
      if (
        binding.function_id &&
        pin &&
        !pin.alternate_functions.some((fn) => fn.function_id === binding.function_id)
      ) {
        addIssue(
          issues,
          'SEMANTIC_FUNCTION_PIN_MISMATCH',
          `${path}/function_id`,
          `Function ${binding.function_id} does not belong to pin ${binding.pin_id}`,
        );
      }
      if (binding.resource_id && !resource) {
        addIssue(
          issues,
          'SEMANTIC_REFERENCE_NOT_FOUND',
          `${path}/resource_id`,
          `Unknown resource: ${binding.resource_id}`,
        );
      }
      if (
        binding.channel &&
        resource &&
        !resource.channels.some((candidate) => candidate.channel === binding.channel)
      ) {
        addIssue(
          issues,
          'SEMANTIC_REFERENCE_NOT_FOUND',
          `${path}/channel`,
          `Unknown channel on resource ${resource.resource_id}: ${binding.channel}`,
        );
      }
      const boundFunction = binding.function_id
        ? pin?.alternate_functions.find(
            (candidate) => candidate.function_id === binding.function_id,
          )
        : undefined;
      const boundChannel = binding.channel
        ? resource?.channels.find((candidate) => candidate.channel === binding.channel)
        : undefined;
      if (
        binding.signal &&
        ((boundFunction && boundFunction.signal !== binding.signal) ||
          (boundChannel && boundChannel.signal !== binding.signal))
      ) {
        addIssue(
          issues,
          'SEMANTIC_SIGNAL_MISMATCH',
          `${path}/signal`,
          `Signal ${binding.signal} does not match its referenced function or channel`,
        );
      }
      if (
        port.requirement === 'REQUIRED' &&
        pin?.electrical_type === 'GROUND' &&
        pin.requirement === 'REQUIRED'
      ) {
        addIssue(
          issues,
          'SEMANTIC_REQUIRED_GROUND_PORT',
          path,
          'A required ground pin cannot be exposed as a required drawable port',
        );
      }
    });
  });

  component.resources.forEach((resource, index) =>
    validateResourceMappings(resource, index, pins, issues),
  );

  component.address_capabilities.forEach((address, index) => {
    const path = `/address_capabilities/${index}`;
    if (!ports.has(address.port_id)) {
      addIssue(
        issues,
        'SEMANTIC_REFERENCE_NOT_FOUND',
        `${path}/port_id`,
        `Unknown port: ${address.port_id}`,
      );
    }
    const [minimum, maximum] =
      address.kind === 'I2C_7_BIT'
        ? [0, 127]
        : address.kind === 'I2C_10_BIT'
          ? [0, 1023]
          : [1, 247];
    for (const [valueIndex, value] of (address.allowed_values ?? []).entries()) {
      if (value < minimum || value > maximum) {
        addIssue(
          issues,
          'SEMANTIC_ADDRESS_OUT_OF_RANGE',
          `${path}/allowed_values/${valueIndex}`,
          `${address.kind} address must be between ${minimum} and ${maximum}`,
        );
      }
    }
    if (address.range) {
      if (address.range.min > address.range.max) {
        addIssue(
          issues,
          'SEMANTIC_RANGE_ORDER',
          `${path}/range/max`,
          'Address range maximum is below minimum',
        );
      }
      if (address.range.min < minimum || address.range.max > maximum) {
        addIssue(
          issues,
          'SEMANTIC_ADDRESS_OUT_OF_RANGE',
          `${path}/range`,
          `${address.kind} range must be between ${minimum} and ${maximum}`,
        );
      }
    }
  });

  if (Date.parse(component.updated_at) < Date.parse(component.created_at)) {
    addIssue(issues, 'SEMANTIC_TIMESTAMP_ORDER', '/updated_at', 'updated_at precedes created_at');
  }
  return finish(issues);
}

export function validateProjectSemantics(project: ProjectFileV1): SemanticValidationResult {
  const issues: MutableIssue[] = [];
  duplicateIds(
    project.component_instances,
    (instance) => instance.instance_id,
    '/component_instances',
    issues,
  );
  duplicateIds(
    project.connections,
    (connection) => connection.connection_id,
    '/connections',
    issues,
  );
  duplicateIds(
    project.allocations,
    (allocation) => allocation.allocation_id,
    '/allocations',
    issues,
  );
  duplicateIds(project.engineering_notes, (note) => note.note_id, '/engineering_notes', issues);
  duplicateIds(
    project.warning_overrides,
    (override) => override.override_id,
    '/warning_overrides',
    issues,
  );

  if (project.engineering_revision > project.document_revision) {
    addIssue(
      issues,
      'SEMANTIC_REVISION_ORDER',
      '/engineering_revision',
      'engineering_revision exceeds document_revision',
    );
  }
  if (Date.parse(project.metadata.updated_at) < Date.parse(project.metadata.created_at)) {
    addIssue(
      issues,
      'SEMANTIC_TIMESTAMP_ORDER',
      '/metadata/updated_at',
      'updated_at precedes created_at',
    );
  }

  const instances = new Map(
    project.component_instances.map((instance) => [instance.instance_id, instance]),
  );
  const connections = new Map(
    project.connections.map((connection) => [connection.connection_id, connection]),
  );
  const endpoints = new Map<string, { connectionId: string; instanceId: string }>();

  project.component_instances.forEach((instance, index) => {
    for (const issue of validateComponentSemantics(instance.component_snapshot).issues) {
      addIssue(
        issues,
        issue.code,
        `/component_instances/${index}/component_snapshot${issue.path}`,
        issue.message,
      );
    }
  });

  project.connections.forEach((connection, connectionIndex) => {
    connection.endpoints.forEach((endpoint, endpointIndex) => {
      const path = `/connections/${connectionIndex}/endpoints/${endpointIndex}`;
      if (endpoints.has(endpoint.endpoint_id)) {
        addIssue(
          issues,
          'SEMANTIC_DUPLICATE_ID',
          `${path}/endpoint_id`,
          `Duplicate identifier: ${endpoint.endpoint_id}`,
        );
      } else {
        endpoints.set(endpoint.endpoint_id, {
          connectionId: connection.connection_id,
          instanceId: endpoint.component_instance_id,
        });
      }
      const instance = instances.get(endpoint.component_instance_id);
      if (!instance) {
        addIssue(
          issues,
          'SEMANTIC_REFERENCE_NOT_FOUND',
          `${path}/component_instance_id`,
          `Unknown component instance: ${endpoint.component_instance_id}`,
        );
        return;
      }
      if (!instance.component_snapshot.ports.some((port) => port.port_id === endpoint.port_id)) {
        addIssue(
          issues,
          'SEMANTIC_REFERENCE_NOT_FOUND',
          `${path}/port_id`,
          `Unknown port on component snapshot: ${endpoint.port_id}`,
        );
      }
      const mappings = new Set(
        instance.component_snapshot.resources.flatMap((resource) =>
          resource.compatible_pin_mappings.map((mapping) => mapping.mapping_id),
        ),
      );
      endpoint.selected_mapping_ids.forEach((mappingId, mappingIndex) => {
        if (!mappings.has(mappingId))
          addIssue(
            issues,
            'SEMANTIC_REFERENCE_NOT_FOUND',
            `${path}/selected_mapping_ids/${mappingIndex}`,
            `Unknown pin mapping: ${mappingId}`,
          );
      });
      const addresses = new Map(
        instance.component_snapshot.address_capabilities.map((address) => [
          address.address_id,
          address,
        ]),
      );
      duplicateIds(
        endpoint.address_selections,
        (selection) => selection.address_id,
        `${path}/address_selections`,
        issues,
      );
      const selectedValues = new Set<number>();
      endpoint.address_selections.forEach((selection, selectionIndex) => {
        const capability = addresses.get(selection.address_id);
        const selectionPath = `${path}/address_selections/${selectionIndex}`;
        if (selectedValues.has(selection.value)) {
          addIssue(
            issues,
            'SEMANTIC_DUPLICATE_ADDRESS',
            `${selectionPath}/value`,
            `Address ${selection.value} is selected more than once on this endpoint`,
          );
        }
        selectedValues.add(selection.value);
        if (!capability || capability.port_id !== endpoint.port_id) {
          addIssue(
            issues,
            'SEMANTIC_REFERENCE_NOT_FOUND',
            `${selectionPath}/address_id`,
            `Unknown address capability for endpoint port: ${selection.address_id}`,
          );
        } else if (
          capability.allowed_values &&
          !capability.allowed_values.includes(selection.value)
        ) {
          addIssue(
            issues,
            'SEMANTIC_ADDRESS_NOT_ALLOWED',
            `${selectionPath}/value`,
            `Address ${selection.value} is not allowed`,
          );
        } else if (
          capability.range &&
          (selection.value < capability.range.min || selection.value > capability.range.max)
        ) {
          addIssue(
            issues,
            'SEMANTIC_ADDRESS_NOT_ALLOWED',
            `${selectionPath}/value`,
            `Address ${selection.value} is outside the configured range`,
          );
        }
      });
    });
  });

  project.allocations.forEach((allocation, index) => {
    const path = `/allocations/${index}`;
    const endpoint = endpoints.get(allocation.endpoint_id);
    if (
      !connections.has(allocation.connection_id) ||
      endpoint?.connectionId !== allocation.connection_id
    ) {
      addIssue(
        issues,
        'SEMANTIC_REFERENCE_NOT_FOUND',
        `${path}/connection_id`,
        'Allocation does not resolve to its endpoint connection',
      );
    }
    if (!endpoint || endpoint.instanceId !== allocation.component_instance_id) {
      addIssue(
        issues,
        'SEMANTIC_REFERENCE_NOT_FOUND',
        `${path}/endpoint_id`,
        'Allocation endpoint does not resolve to its component instance',
      );
    }
    const snapshot = instances.get(allocation.component_instance_id)?.component_snapshot;
    const allocatedResource = snapshot?.resources.find(
      (resource) => resource.resource_id === allocation.resource_id,
    );
    const resourceExists =
      snapshot &&
      (allocation.resource_kind === 'PIN'
        ? snapshot.pins.some((pin) => pin.pin_id === allocation.resource_id)
        : allocation.resource_kind === 'FUNCTION'
          ? snapshot.pins.some((pin) =>
              pin.alternate_functions.some((fn) => fn.function_id === allocation.resource_id),
            )
          : Boolean(allocatedResource));
    if (!resourceExists)
      addIssue(
        issues,
        'SEMANTIC_REFERENCE_NOT_FOUND',
        `${path}/resource_id`,
        `Unknown allocated resource: ${allocation.resource_id}`,
      );
    if (
      allocation.resource_kind === 'CHANNEL' &&
      allocatedResource &&
      !allocatedResource.channels.some((channel) => channel.channel === allocation.channel)
    )
      addIssue(
        issues,
        'SEMANTIC_REFERENCE_NOT_FOUND',
        `${path}/channel`,
        `Unknown allocated channel: ${allocation.channel ?? ''}`,
      );
  });

  project.engineering_notes.forEach((note, index) => {
    if (Date.parse(note.updated_at) < Date.parse(note.created_at))
      addIssue(
        issues,
        'SEMANTIC_TIMESTAMP_ORDER',
        `/engineering_notes/${index}/updated_at`,
        'updated_at precedes created_at',
      );
    const targetExists =
      note.scope === 'PROJECT' ||
      (note.scope === 'COMPONENT_INSTANCE' && instances.has(note.target_id ?? '')) ||
      (note.scope === 'CONNECTION' && connections.has(note.target_id ?? '')) ||
      (note.scope === 'ALLOCATION' &&
        project.allocations.some((allocation) => allocation.allocation_id === note.target_id));
    if (!targetExists)
      addIssue(
        issues,
        'SEMANTIC_REFERENCE_NOT_FOUND',
        `/engineering_notes/${index}/target_id`,
        `Unknown note target: ${note.target_id ?? ''}`,
      );
  });

  project.warning_overrides.forEach((override, index) => {
    const path = `/warning_overrides/${index}/subject`;
    if (override.subject.project_id && override.subject.project_id !== project.project_id)
      addIssue(
        issues,
        'SEMANTIC_SUBJECT_MISMATCH',
        `${path}/project_id`,
        'Override does not target this project',
      );
    if (override.subject.connection_id && !connections.has(override.subject.connection_id))
      addIssue(
        issues,
        'SEMANTIC_REFERENCE_NOT_FOUND',
        `${path}/connection_id`,
        `Unknown connection: ${override.subject.connection_id}`,
      );
    if (
      override.subject.component_instance_id &&
      !instances.has(override.subject.component_instance_id)
    )
      addIssue(
        issues,
        'SEMANTIC_REFERENCE_NOT_FOUND',
        `${path}/component_instance_id`,
        `Unknown component instance: ${override.subject.component_instance_id}`,
      );
  });

  const check = project.last_design_check;
  if (check) {
    if (check.evaluated_engineering_revision > project.document_revision)
      addIssue(
        issues,
        'SEMANTIC_REVISION_ORDER',
        '/last_design_check/evaluated_engineering_revision',
        'Design check revision exceeds document revision',
      );
    if (check.result.subject.project_id !== project.project_id)
      addIssue(
        issues,
        'SEMANTIC_SUBJECT_MISMATCH',
        '/last_design_check/result/subject/project_id',
        'Design check does not target this project',
      );
    if (check.result.summary) {
      const counts = { INFO: 0, WARNING: 0, ERROR: 0 };
      check.result.findings.forEach((finding) => {
        counts[finding.severity] += 1;
      });
      if (
        check.result.summary.infos !== counts.INFO ||
        check.result.summary.warnings !== counts.WARNING ||
        check.result.summary.errors !== counts.ERROR
      )
        addIssue(
          issues,
          'SEMANTIC_SUMMARY_MISMATCH',
          '/last_design_check/result/summary',
          'Design check summary does not match its findings',
        );
      const evaluatedTotal =
        check.result.summary.passed +
        check.result.summary.infos +
        check.result.summary.warnings +
        check.result.summary.errors;
      if (check.result.summary.checks_evaluated !== evaluatedTotal)
        addIssue(
          issues,
          'SEMANTIC_SUMMARY_MISMATCH',
          '/last_design_check/result/summary/checks_evaluated',
          'checks_evaluated does not match passed and finding counts',
        );
    }
  }

  return finish(issues);
}

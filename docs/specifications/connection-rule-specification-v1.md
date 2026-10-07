# Connection & Rule Engine Specification V1
## Hardware System Designer

**Document Version:** 1.0

**Status:** Baseline Specification

**Target Release:** V1

**Ruleset Identifier:** `hwsd.connection-rules/1`

**Normative Result Schema:** `../schemas/connection-rule-result-v1.schema.json`

**Related Specifications:** `engineering-specification-v1.md`, `component-schema-v1.md`, `port-interface-schema-v1.md`

---

## 1. Purpose

This document defines deterministic V1 behavior for creating and validating engineering connections. It specifies rule inputs, evaluation order, interface compatibility, allocation behavior, bus rules, power checks, warning overrides, Design Check behavior, and machine-readable results.

The Rule Engine is the sole authority for connection validity. AI may help create component definitions, but shall not approve, reject, downgrade, or override a connection result at runtime.

---

## 2. Scope Boundary

This specification covers:

- Point-to-point, shared-bus, multi-drop, wireless, and power connections.
- Endpoint and topology validation.
- Interface, direction, and protocol compatibility.
- Pin, alternate-function, peripheral, and channel allocation.
- Pin multiplexing conflicts.
- I2C, SPI, 1-Wire, RS-485, CAN, and LIN topology behavior.
- I2C and Modbus RTU address validation.
- Voltage and current-budget validation.
- Required-port completeness.
- Component verification and lifecycle findings.
- Connection preview, commit validation, and full Design Check.
- Stable rule identifiers and structured findings.
- Warning confirmation and override invalidation.

This specification does not cover:

- AI-based validity decisions.
- Detailed signal integrity, timing closure, termination, or cable analysis.
- Regulator thermal analysis, inrush, transient, or battery runtime simulation.
- Detailed grounding, isolation, chassis ground, or protective earth.
- Automatic converter or transceiver insertion.
- Physical schematic nets or PCB routing.
- A complete persisted project-file shape, which is defined separately.

---

## 3. Normative Terms

- **Component definition:** immutable library revision conforming to Component Schema V1.
- **Component instance:** project-local use of a component snapshot.
- **Port:** connectable endpoint defined by Port/Interface Schema V1.
- **Endpoint:** reference to one component instance and one port, plus project selections.
- **Connection:** one logical net containing two or more endpoints.
- **Bus:** a connection whose topology permits more than two endpoints.
- **Allocation:** project-instance claim on a pin, function, resource, or channel.
- **Finding:** one rule outcome with stable ID, severity, locations, and evidence.
- **Verdict:** aggregate result for an evaluation.
- **Override:** recorded user confirmation accepting one warning fingerprint.

---

## 4. Deterministic Engine Principles

The Rule Engine shall:

1. Produce the same engineering result for the same ruleset, component snapshots, project state, and candidate change.
2. Read only explicit structured data; display labels and free-text notes shall not determine validity.
3. Evaluate a candidate against a project snapshot without mutating that snapshot.
4. Commit a connection and all allocations atomically only after an allowed result.
5. Never commit partial allocations after an error.
6. Return every applicable finding, not only the first error.
7. Sort findings by severity, rule ID, and location for stable output.
8. Use exact ruleset and schema versions.
9. Treat missing engineering data as unknown, never as zero, safe, or unlimited.
10. Keep timestamps, random IDs, localization, and UI formatting outside the pure evaluation result.

Floating-point comparisons shall use decimal engineering values without unit conversion ambiguity because schemas store canonical units. Implementations shall use decimal arithmetic or an equivalent deterministic representation; binary floating-point rounding shall not change verdicts.

---

## 5. Connection Graph Model

A V1 project is evaluated as a graph:

```text
Component instances
        ↓
Ports and selected bindings
        ↓
Logical connections / buses
        ↓
Pin, resource, channel, address, and power allocations
```

A logical connection has:

- Stable `connection_id`.
- A topology derived from its endpoints' `bus_mode`.
- Two or more endpoint references.
- Optional engineering note.
- Zero or more warning overrides.

Each endpoint identifies:

- `component_instance_id`.
- `port_id` in the component snapshot.
- Selected compatible pin mapping when alternatives exist.
- Resolved pin, function, resource, and channel allocations.
- Selected protocol address when required.

The exact persisted JSON representation belongs to Project File Specification V1. These logical fields are mandatory inputs to this Rule Engine.

### 5.1 Endpoint Cardinality

- `POINT_TO_POINT`: exactly two endpoints.
- `SHARED_BUS`: at least two endpoints; V1 requires exactly one controller where the interface uses controller/target roles.
- `MULTI_DROP`: at least two endpoints; controller cardinality follows the selected protocol.
- `WIRELESS`: at least two logical endpoints; physical bindings may be empty.
- `NOT_APPLICABLE`: exactly two endpoints unless an explicit rule states otherwise.

Duplicate endpoint references inside one connection are invalid. A port may participate in more than one connection only when its topology and allocation rules explicitly permit sharing.

---

## 6. Evaluation Modes

### 6.1 `CONNECTION_PREVIEW`

Used while the user selects or drags a candidate connection. It evaluates the candidate against current project state and returns proposed allocation effects without persistence.

### 6.2 `CONNECTION_COMMIT`

Re-evaluates the complete candidate immediately before persistence. The commit uses optimistic concurrency or an equivalent project revision check so allocations cannot become stale between evaluation and write.

### 6.3 `DESIGN_CHECK`

Evaluates the entire project from stored component snapshots and active connections. It includes project-wide rules such as missing required ports, power budgets, bus address conflicts, component lifecycle warnings, and update availability.

Incremental checks may be used for responsiveness, but a full Design Check shall produce the same findings as evaluating the same state from scratch.

---

## 7. Findings, Severity, and Verdict

Finding severities are:

- `INFO`: informative; no confirmation required.
- `WARNING`: questionable or incompletely verified; connection may proceed only after confirmation during connection creation.
- `ERROR`: invalid; connection or project check is blocked/failed.

Aggregate verdicts are:

- `ERROR` if at least one `ERROR` finding exists.
- `WARNING` if there is no error and at least one `WARNING` exists.
- `VALID` otherwise; `INFO` findings may still be present.

For connection preview or commit:

| Verdict | Allowed | Confirmation |
|---|---:|---:|
| `VALID` | yes | no |
| `WARNING` | yes | required before commit |
| `ERROR` | no | not permitted |

For Design Check, `requires_confirmation` is always false. A warning does not fail the check, while an error does.

---

## 8. Evaluation Pipeline

Rules execute in the following logical phases:

1. **Schema and reference resolution** — resolve snapshots, instances, ports, mappings, and selected addresses.
2. **Structural validation** — endpoint count, duplicates, topology, and connection shape.
3. **Interface validation** — type, direction, protocol, and converter/transceiver requirements.
4. **Electrical validation** — logic, analog, polarity, voltage, and current constraints.
5. **Allocation simulation** — pins, mux groups, resources, channels, and mappings.
6. **Bus validation** — controller roles, shared signals, device count, chip select, and addresses.
7. **Project-wide validation** — completeness, power budgets, lifecycle, and update findings.
8. **Aggregation** — stable ordering, fingerprint generation, verdict, and allocation effects.

An earlier phase error does not suppress later rules that still have sufficient valid input. A rule shall emit no speculative finding when its required input could not be resolved; the unresolved-input rule already reports the failure.

---

## 9. Direction Compatibility

Direction is evaluated from each owning component's perspective.

| Endpoint A | Endpoint B | Default result |
|---|---|---|
| `OUTPUT` | `INPUT` | compatible |
| `INPUT` | `OUTPUT` | compatible |
| `BIDIRECTIONAL` | `BIDIRECTIONAL` | compatible |
| `BIDIRECTIONAL` | `INPUT` or `OUTPUT` | compatible if the interface rule permits it |
| `PASSIVE` | compatible active/passive peer | interface-specific |
| `OUTPUT` | `OUTPUT` | error unless an explicit wired/open-drain rule permits it |
| `INPUT` | `INPUT` | error for a direct signal connection |

Shared open-drain interfaces such as I2C are validated by their bus rule and are not rejected as ordinary output-to-output connections.

---

## 10. Interface Compatibility

### 10.1 Directly Compatible Families

The following pairs are candidates for direct connection when direction, electrical, topology, and allocation checks also pass:

| Source/peer type | Destination/peer type |
|---|---|
| `GPIO_OUTPUT` | `GPIO_INPUT` |
| `GPIO_BIDIRECTIONAL` | `GPIO_BIDIRECTIONAL`, `GPIO_INPUT`, or `GPIO_OUTPUT` |
| `PWM` output | `PWM` input |
| `INTERRUPT` output | `INTERRUPT` input |
| `UART_TTL` | `UART_TTL` |
| `RS232` | `RS232` |
| `RS485` | `RS485` |
| `CAN` | `CAN` |
| `LIN` | `LIN` |
| `I2C` | `I2C` |
| `SPI` | `SPI` |
| `ONE_WIRE` | `ONE_WIRE` |
| `ANALOG_OUTPUT` or `DAC_OUTPUT` | `ANALOG_INPUT` or `ADC_INPUT` |
| `ANALOG_0_10V` | `ANALOG_0_10V` |
| `ANALOG_4_20MA` | `ANALOG_4_20MA` |
| `ETHERNET` | `ETHERNET` |
| Same wireless family | same wireless family |
| `RELAY_CONTACT` output/passive | `DRY_CONTACT` input/passive |
| `ENABLE` output | `ENABLE` input |
| `RESET` output | `RESET` input |
| `POWER_OUTPUT` | `POWER_INPUT` or `CHARGER_INPUT` |
| `BATTERY_OUTPUT` | `POWER_INPUT` or `CHARGER_INPUT` |
| `CHARGER_OUTPUT` | `BATTERY_INPUT` or `POWER_INPUT` |

This table establishes interface candidacy, not final validity.

### 10.2 Explicitly Incompatible Direct Pairs

At minimum, V1 shall reject:

- `UART_TTL` directly to `RS232`.
- `UART_TTL` directly to `RS485`.
- `UART_TTL` directly to physical `CAN`.
- `I2C` directly to `SPI`.
- Signal interfaces directly to power interfaces.
- Two ordinary push-pull outputs.
- Incompatible analog families without a converter.
- Different wireless families as if they were the same link.

When a known intermediate device category can resolve the mismatch, the finding code is `INTERFACE_CONVERTER_REQUIRED` and may suggest `INTERFACE_CONVERTER_TRANSCEIVER`. The engine shall not insert it automatically.

### 10.3 CAN and RS-485 Modeling Boundary

`CAN` and `RS485` represent their physical bus sides. Raw controller logic that still requires a transceiver shall not be modeled as an already converted physical port.

- MCU UART logic uses `UART_TTL`; connecting it to `RS485` requires an RS-485 transceiver.
- Raw CAN TX/RX logic uses `DIGITAL_CUSTOM` with `custom_type: "CAN_CONTROLLER_LOGIC"`; connecting it to `CAN` requires a CAN transceiver.

This explicit modeling rule prevents component category or name heuristics from deciding whether a transceiver exists.

### 10.4 Custom Interfaces

A custom interface is directly verifiable only when a registered deterministic rule matches its `interface_id` and revision, or an exact built-in rule matches its custom type and constraints.

Otherwise the engine returns `CUSTOM_INTERFACE_UNVERIFIED` as a warning. Matching custom names alone shall not produce a `VALID` verdict.

### 10.5 Protocol Compatibility

- If both endpoints declare the same protocol, protocol matching passes.
- If both declare different protocols, the direct functional connection is an error even when the physical interface matches.
- If exactly one declares a protocol, validation is incomplete and produces a warning.
- Missing protocol values do not invalidate a purely physical connection unless the rule explicitly requires a protocol.

Protocol compatibility never bypasses electrical or physical-interface checks.

---

## 11. Electrical Signal Validation

### 11.1 Digital Logic Voltage

For a digital output and input:

1. If both define compatible logic ranges and the source nominal/output range lies inside the receiver range, the voltage check passes.
2. If the modeled ranges do not overlap, return an error.
3. If ranges overlap only partially, return a warning unless explicit thresholds prove compatibility.
4. If required voltage data is absent, return `ELECTRICAL_LIMITS_INCOMPLETE` as a warning.

V1 does not infer 5 V tolerance from manufacturer, component name, or nominal voltage.

### 11.2 Analog Ranges

An analog source range shall be contained within the accepted input range. A source capable of exceeding the destination limit is an error. Missing range information produces a warning.

Standard `ANALOG_0_10V` and `ANALOG_4_20MA` types establish their named nominal signal family, while explicit stored limits remain authoritative for actual components.

### 11.3 Frequency

When a selected project operating frequency is known, it shall not exceed any endpoint's `max_frequency`. If no operating frequency is selected, the engine checks only whether peer capability ranges can support a common value and warns when the required data is incomplete.

Detailed rise time, impedance, cable length, and signal integrity are outside V1.

---

## 12. Allocation Rules

Allocation is simulated before commit from resolved port bindings and the selected compatible pin mapping.

### 12.1 Pins

- An exclusively used pin cannot be allocated to another incompatible connection.
- A pin may be shared only when the interface and resource explicitly represent the same shared bus.
- Sharing the physical pin across unrelated bus instances is an error.
- A required binding that cannot resolve to a pin is an error.

### 12.2 Alternate Functions and Mux Groups

- The selected function shall belong to the selected pin.
- Two selected functions in the same non-empty `mux_group` conflict unless they represent the same shared allocation.
- Selecting a peripheral function prevents incompatible GPIO or alternate-function use.
- A mux conflict is always an error in V1.

### 12.3 Peripheral Resources

- `EXCLUSIVE`: one active allocation consumes the resource.
- `SHARED_BUS`: one bus consumes the controller; additional targets on that same bus do not increment controller usage.
- `CHANNELIZED`: channels are allocated independently; reusing the same exclusive channel is an error.

Resource usage displays count committed allocations after applying these rules. Preview returns proposed allocation effects without changing counts.

### 12.4 Compatible Pin Mappings

When a resource has multiple compatible mappings:

- The endpoint shall select one complete mapping.
- All required signals in that mapping are allocated as a unit.
- Combining assignments from different mappings is invalid unless a separately declared mapping represents that combination.
- A mapping that conflicts with current allocation state is unavailable.

---

## 13. Shared Bus Rules

### 13.1 Common Rules

A shared or multi-drop bus requires:

- One interface family across all endpoints.
- Compatible physical/electrical constraints.
- Compatible bus mode.
- Valid bus roles.
- One shared bus identity for shared resource allocation.
- No endpoint duplicated in the bus.

Adding a target to an existing bus extends that bus; it shall not create an unrelated point-to-point connection that allocates the same controller again.

### 13.2 I2C

V1 I2C behavior:

- Exactly one `CONTROLLER` endpoint per bus.
- One or more `TARGET` endpoints.
- The controller resource is allocated once.
- SDA and SCL bindings are shared only within the same bus.
- All endpoints require compatible logic voltage.
- Selected target addresses shall be unique.
- Seven-bit target addresses shall be in `0x08` through `0x77`; reserved ranges are invalid for ordinary targets.
- A fixed duplicate address is an error.
- A selectable/configurable device without a resolved unique selection produces a warning during editing and an error in full Design Check.

Ten-bit addressing may be represented by Component Schema V1 but mixing seven-bit and ten-bit devices requires an explicit controller capability rule; otherwise validation is incomplete.

### 13.3 SPI

V1 SPI behavior:

- Exactly one `CONTROLLER` endpoint per bus.
- One or more `TARGET` endpoints.
- SCLK and data signals may be shared.
- Every target requires a distinct chip-select allocation unless the component explicitly declares a topology that does not use chip select.
- The controller resource is allocated once.
- Duplicate chip-select allocation across targets is an error.
- Selected clock frequency shall not exceed any endpoint limit.

### 13.4 1-Wire

V1 1-Wire behavior:

- Exactly one `CONTROLLER` endpoint.
- One or more `TARGET` endpoints.
- The shared data binding is allocated once for the bus.
- Device ROM identity is outside V1 address-conflict validation.

---

## 14. Multi-Drop Rules

### 14.1 RS-485

- Multiple physical `RS485` endpoints may share one bus.
- UART TTL endpoints cannot attach directly.
- Bus voltage and protocol declarations shall be compatible.
- Detailed biasing and termination analysis is outside V1.

For `MODBUS_RTU`:

- One controller/client endpoint is allowed in V1.
- Target/server endpoints use selected slave addresses from `1` through `247`.
- Address `0` is reserved for broadcast and cannot identify a target.
- Duplicate target addresses are errors.
- A configurable target without a selected address is an error in Design Check.

### 14.2 CAN

- Two or more physical `CAN` peer endpoints may share one bus.
- Raw controller-logic endpoints require a transceiver before joining the physical bus.
- All endpoints shall have compatible physical-layer voltage/capability data when modeled.
- Detailed termination and arbitration analysis are outside V1.

### 14.3 LIN

- One `CONTROLLER` and one or more `TARGET` endpoints are required.
- All endpoints shall use compatible physical LIN interfaces.
- Schedule-table analysis and identifier collision checks are outside V1.

---

## 15. Power Validation

Power validation runs per power net and across every load attached to the same source.

### 15.1 Source and Load Roles

- A power net requires at least one source and one load.
- Ordinary V1 power nets allow exactly one active source.
- Source-to-source connection is an error unless a future explicit power-sharing rule supports it.
- Signal-to-power connection is an error.
- Polarity mismatch is an error.

### 15.2 Voltage Compatibility

The source operating range shall remain inside every load's accepted range:

```text
source.min >= load.min
source.max <= load.max
```

When only nominal voltage is known, it shall fall inside the load range. A known source value exceeding a load maximum or falling below its minimum is an error. Missing limits produce a warning because compatibility is incomplete.

### 15.3 Current Budget

The engine uses the most conservative available load current in this order:

1. `peak_current`
2. `max_current`
3. `typical_current`

The sum of all loads shall not exceed source `max_current`. Exceeding capacity is an error. Missing source capacity or load current produces a warning.

### 15.4 Recommended Margin

The default recommended current margin is 20% of source capacity:

```text
margin_ratio = (source_capacity - total_load) / source_capacity
```

- Negative margin: error from current-budget rule.
- `0 <= margin_ratio < 0.20`: warning.
- `margin_ratio >= 0.20`: pass.

A future project setting may override the recommendation, but the applied threshold shall be an explicit engine input and part of the finding evidence.

### 15.5 Regulator Validation

A regulator is evaluated through separate input and output power ports. The input source shall satisfy the regulator input range, and the regulator output shall satisfy every downstream load. Detailed dropout behavior is checked only when explicitly represented by component limits; thermal analysis is outside V1.

Ground is implied by a valid power connection and is not separately allocated.

---

## 16. Completeness Rules

A required port is satisfied only when it participates in an active connection whose warning findings, if any, were confirmed and which has no error.

Component visual completeness is:

- `BLACK`: zero required ports are satisfied.
- `BLUE`: at least one but not all required ports are satisfied.
- `GREEN`: all required ports are satisfied and the component has no blocking error.

A component with no required ports is `GREEN` when it has no blocking error.

During connection preview, incomplete remaining ports may generate `INFO`. During full Design Check, every unsatisfied required port generates `MISSING_REQUIRED_CONNECTION` as an error.

---

## 17. Component Lifecycle Rules

Design Check shall report:

- `UNVERIFIED_COMPONENT` as a warning for snapshots not in `VERIFIED` status.
- `DEPRECATED_COMPONENT` as a warning.
- `DISABLED_COMPONENT` as a warning for an existing historical snapshot; disabled components are blocked by library insertion policy, not deleted from projects.
- `COMPONENT_UPDATE_AVAILABLE` as `INFO` when a newer library revision exists.

Availability of a newer revision is an external comparison input. The Rule Engine shall validate the stored project snapshot and shall not silently evaluate against the latest library revision.

---

## 18. Warning Overrides

Only warnings may be overridden. Errors cannot be overridden in V1.

A warning override stores:

- Rule ID and finding code.
- Finding fingerprint.
- User ID.
- Confirmation timestamp.
- Optional engineering note.

The fingerprint is SHA-256 over canonical JSON containing the ruleset version, rule ID, code, normalized locations, and rule-specific evidence values that caused the warning.

An override remains effective only while its fingerprint matches. Any relevant endpoint, component revision, electrical value, allocation, selected address, bus membership, or ruleset change invalidates the old override and requires confirmation again.

Design Check continues to display overridden warnings and marks them as acknowledged; it does not hide them.

---

## 19. Rule Registry

Every rule has immutable metadata:

- Stable `rule_id`.
- Stable machine `code`.
- Ruleset version.
- Category and evaluation phase.
- Default severity.
- Applicability conditions.
- Deterministic evaluation definition.
- Message template and suggested actions.

Rule IDs are never reused for a different meaning. Changing engineering meaning requires a new rule ID or ruleset version.

### 19.1 Required V1 Rule Catalog

| Rule ID | Code | Default severity | Purpose |
|---|---|---|---|
| `STRUCT-001` | `REFERENCE_NOT_FOUND` | ERROR | Endpoint, port, mapping, or allocation reference cannot resolve. |
| `STRUCT-002` | `DUPLICATE_ENDPOINT` | ERROR | Same endpoint appears more than once in a connection. |
| `STRUCT-003` | `INVALID_ENDPOINT_COUNT` | ERROR | Endpoint cardinality violates topology. |
| `STRUCT-004` | `TOPOLOGY_MISMATCH` | ERROR | Endpoint bus modes cannot form one connection. |
| `IFACE-001` | `INTERFACE_INCOMPATIBLE` | ERROR | Direct interface families are incompatible. |
| `IFACE-002` | `DIRECTION_CONFLICT` | ERROR | Endpoint directions cannot connect. |
| `IFACE-003` | `INTERFACE_CONVERTER_REQUIRED` | ERROR | Known converter/transceiver is missing. |
| `IFACE-004` | `CUSTOM_INTERFACE_UNVERIFIED` | WARNING | No verified deterministic custom rule exists. |
| `IFACE-005` | `PROTOCOL_MISMATCH` | ERROR | Declared higher-level protocols conflict. |
| `IFACE-006` | `PROTOCOL_VALIDATION_INCOMPLETE` | WARNING | Protocol is declared on only part of the connection. |
| `ELEC-001` | `LOGIC_VOLTAGE_INCOMPATIBLE` | ERROR | Digital voltage ranges are incompatible. |
| `ELEC-002` | `ELECTRICAL_LIMITS_INCOMPLETE` | WARNING | Required electrical data is missing. |
| `ELEC-003` | `ANALOG_RANGE_INCOMPATIBLE` | ERROR | Analog source exceeds accepted range. |
| `ELEC-004` | `FREQUENCY_LIMIT_EXCEEDED` | ERROR | Selected frequency exceeds capability. |
| `ALLOC-001` | `PIN_ALREADY_ALLOCATED` | ERROR | Pin has an incompatible existing allocation. |
| `ALLOC-002` | `PIN_MUX_CONFLICT` | ERROR | Mutually exclusive pin functions conflict. |
| `ALLOC-003` | `RESOURCE_ALREADY_ALLOCATED` | ERROR | Exclusive peripheral is already consumed. |
| `ALLOC-004` | `CHANNEL_ALREADY_ALLOCATED` | ERROR | Resource channel is already consumed. |
| `ALLOC-005` | `PIN_MAPPING_INCOMPLETE` | ERROR | Selected mapping lacks required assignments. |
| `ALLOC-006` | `RESOURCE_FULLY_ALLOCATED` | INFO | A resource has no remaining V1 allocation capacity. |
| `BUS-001` | `BUS_ROLE_INVALID` | ERROR | Controller/target/peer roles violate bus rules. |
| `BUS-002` | `BUS_INTERFACE_MISMATCH` | ERROR | Bus members use incompatible interface families. |
| `BUS-003` | `I2C_ADDRESS_CONFLICT` | ERROR | Selected/fixed I2C addresses conflict. |
| `BUS-004` | `I2C_ADDRESS_UNRESOLVED` | WARNING/ERROR | Configurable I2C address has no valid selection. |
| `BUS-005` | `SPI_CHIP_SELECT_CONFLICT` | ERROR | SPI targets share an invalid CS allocation. |
| `BUS-006` | `MODBUS_ADDRESS_CONFLICT` | ERROR | Modbus target addresses conflict. |
| `BUS-007` | `MODBUS_ADDRESS_INVALID` | ERROR | Slave address is outside `1..247`. |
| `POWER-001` | `POWER_ROLE_INVALID` | ERROR | Source/load roles are invalid. |
| `POWER-002` | `POWER_VOLTAGE_INCOMPATIBLE` | ERROR | Source voltage is outside a load range. |
| `POWER-003` | `POWER_CURRENT_EXCEEDED` | ERROR | Total conservative load exceeds capacity. |
| `POWER-004` | `POWER_MARGIN_LOW` | WARNING | Remaining current margin is below threshold. |
| `POWER-005` | `POWER_DATA_INCOMPLETE` | WARNING | Voltage or current budget cannot be proven. |
| `POWER-006` | `POWER_POLARITY_MISMATCH` | ERROR | Power polarity is incompatible. |
| `COMP-001` | `MISSING_REQUIRED_CONNECTION` | ERROR | Required port is unsatisfied in Design Check. |
| `COMP-002` | `UNVERIFIED_COMPONENT` | WARNING | Snapshot was not admin verified. |
| `COMP-003` | `DEPRECATED_COMPONENT` | WARNING | Snapshot is deprecated. |
| `COMP-004` | `DISABLED_COMPONENT` | WARNING | Historical snapshot is disabled for new use. |
| `COMP-005` | `COMPONENT_UPDATE_AVAILABLE` | INFO | Newer library revision is available. |

Rules with mode-dependent severity, such as `BUS-004`, shall declare the effective severity in the returned finding.

---

## 20. Structured Result Contract

Every evaluation shall conform to `connection-rule-result-v1.schema.json`.

Example blocked result:

```json
{
  "ruleset_version": "hwsd.connection-rules/1",
  "mode": "CONNECTION_PREVIEW",
  "subject": {
    "connection_id": "CONN-000018"
  },
  "verdict": "ERROR",
  "allowed": false,
  "requires_confirmation": false,
  "findings": [
    {
      "rule_id": "IFACE-003",
      "code": "INTERFACE_CONVERTER_REQUIRED",
      "severity": "ERROR",
      "message": "UART TTL cannot connect directly to RS-485.",
      "locations": [
        {
          "entity_type": "COMPONENT_INSTANCE",
          "entity_id": "INST-MCU",
          "path": "/ports/2"
        },
        {
          "entity_type": "COMPONENT_INSTANCE",
          "entity_id": "INST-SENSOR",
          "path": "/ports/1"
        }
      ],
      "details": [
        { "key": "left_interface", "value": "UART_TTL" },
        { "key": "right_interface", "value": "RS485" },
        { "key": "suggested_category", "value": "INTERFACE_CONVERTER_TRANSCEIVER" }
      ],
      "suggested_actions": [
        "Insert an RS-485 transceiver between the endpoints."
      ],
      "fingerprint": "69be6b2d88ed7c61b15a82bdc7062d9fe5d193d83f363f3713f0ca9323c58c5e"
    }
  ],
  "allocation_effects": []
}
```

`message` is the default English engineering message. UI localization may replace displayed text using `code`, but shall preserve the original rule ID, code, severity, details, and fingerprint.

---

## 21. Allocation Effects

Successful connection preview and commit evaluation returns normalized allocation effects. Each effect declares:

- `action`: `ALLOCATE` or `SHARE`.
- Component instance.
- Resource kind: `PIN`, `FUNCTION`, `RESOURCE`, or `CHANNEL`.
- Resource identifier.
- Optional channel.
- Connection that owns or shares the allocation.

Allocation effects are proposals during preview. During commit, the backend applies them atomically with the connection if the project revision still matches. On revision mismatch, the backend shall re-run validation against the new state.

---

## 22. Design Check Output

Design Check uses the same finding shape and ruleset version. It additionally returns a required `summary` object containing counts for `checks_evaluated`, `passed`, `infos`, `warnings`, and `errors`.

Every applicable rule/subject combination is one check application and has exactly one highest outcome: `PASS`, `INFO`, `WARNING`, or `ERROR`. Summary counts are computed as:

- `passed`: check applications that emitted no finding.
- `infos`: information findings.
- `warnings`: warning findings, including acknowledged warnings.
- `errors`: error findings.
- `checks_evaluated`: the sum of those four counts.

Connection preview and commit results omit `summary`.

The engine shall not store a stale “pass” flag independently of the evaluated project revision. Persisted Design Check results include the project revision/hash used for evaluation and become stale after any relevant project change.

---

## 23. Performance and Caching

Implementations may cache:

- Parsed component snapshots.
- Resolved port/reference indexes.
- Rule-independent graph indexes.
- Findings keyed by project revision and ruleset version.

Caches shall not alter results. Any change to a component snapshot, endpoint, selected mapping, connection membership, address, power load, or ruleset invalidates the affected cached findings.

Connection preview should evaluate only the affected graph neighborhood when possible. Full Design Check remains the canonical whole-project verification.

---

## 24. Failure Handling

An internal engine failure is not a `VALID` result. The application shall:

1. Refuse the connection commit.
2. Return a non-engine application error distinct from an engineering finding.
3. Preserve the existing project unchanged.
4. Record diagnostics without exposing sensitive implementation data.

Unknown future schema or ruleset versions are unsupported and shall fail closed.

---

## 25. Required Test Coverage

V1 automated tests shall include:

- Every direct compatibility and incompatibility pair in this specification.
- Direction combinations.
- Custom interface warning behavior.
- Protocol match, mismatch, and incomplete data.
- Logic and analog voltage boundary values.
- Pin, mux, resource, channel, and mapping conflicts.
- Shared-controller allocation counted once.
- I2C fixed, selectable, unresolved, reserved, and duplicate addresses.
- SPI shared signals and unique chip select.
- Modbus addresses `0`, `1`, `247`, `248`, and duplicates.
- Power voltage boundary values, conservative current selection, overload, and 20% margin boundary.
- Warning override creation and invalidation.
- Required-port completeness including zero-required-port components.
- Stable finding ordering and fingerprint reproduction.
- Equality between incremental and full Design Check results.
- Atomic commit rejection under concurrent project revision changes.

Golden tests shall pin rule IDs, codes, severities, and normalized details, not localized UI text.

---

## 26. V1 Acceptance Criteria

Connection & Rule Engine Specification V1 is correctly implemented when:

1. Connection decisions are deterministic and require no AI call.
2. Invalid interface, direction, electrical, allocation, and topology combinations are blocked.
3. Warnings require explicit confirmation and remain auditable.
4. Shared buses allocate controllers and pins correctly.
5. I2C and Modbus address conflicts are detected.
6. Power voltage, current budget, and margin are validated.
7. Required-port completeness matches the defined visual states.
8. Preview, commit, and Design Check share the same rules and structured findings.
9. Existing project snapshots remain the validation source of truth.
10. Every result conforms to the normative result schema and exact ruleset version.

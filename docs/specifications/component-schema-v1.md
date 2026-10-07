# Component Schema V1
## Hardware System Designer

**Document Version:** 1.0  
**Status:** Baseline Specification  
**Target Release:** V1  
**Schema Identifier:** `hwsd.component/1`  
**Normative Machine-Readable Schema:** `../schemas/component-schema-v1.schema.json`

---

## 1. Purpose

This document defines the canonical V1 data model for a reusable hardware component. It translates the component requirements in Engineering Specification V1 into a stable representation shared by the component library, datasheet extraction flow, backend, rule engine, project snapshots, and local project import/export.

The schema models engineering facts. It does not model the visual position of a component on a project canvas or the live allocation state of a project instance.

---

## 2. Scope Boundary

Component Schema V1 includes:

- Component identity and revision metadata.
- Library lifecycle and verification state.
- Category and physical abstraction.
- Datasheet references and extraction provenance.
- Physical pins and alternate functions.
- Exposed ports and their interface definitions.
- Internal peripheral resources and compatible pin mappings.
- Power source and load characteristics.
- Protocol address capabilities.
- Engineering notes and field-level extraction evidence.

Component Schema V1 does not include:

- Canvas position, size, or visual state.
- Project-specific pin or peripheral allocations.
- Connections between component instances.
- Warning overrides and Design Check results.
- Authentication or authorization records.
- Binary datasheet content.

Those values belong to project, connection, or persistence schemas.

---

## 3. Canonical Representation

The canonical serialization is JSON encoded as UTF-8. Every document shall validate against `component-schema-v1.schema.json`.

The root object shall contain:

| Field | Type | Required | Description |
|---|---|---:|---|
| `schema_version` | string | yes | Constant `hwsd.component/1`. |
| `component_id` | string | yes | Stable library identity, for example `CMP-000123`. |
| `revision` | integer | yes | Positive, monotonically increasing revision number. |
| `identity` | object | yes | Human and manufacturer identity. |
| `classification` | object | yes | Category and abstraction level. |
| `lifecycle` | object | yes | Review, verification, and availability state. |
| `provenance` | object | yes | Origin and datasheet traceability. |
| `pins` | array | yes | Physical pins; empty when not applicable. |
| `ports` | array | yes | User-connectable engineering endpoints. |
| `resources` | array | yes | Internal controllers or channels. |
| `address_capabilities` | array | yes | Selectable or fixed protocol addresses. |
| `notes` | array | yes | Component-level engineering notes. |
| `created_at` | string | yes | RFC 3339 UTC timestamp. |
| `updated_at` | string | yes | RFC 3339 UTC timestamp. |
| `revision_notes` | string | yes | Human-readable reason for this revision. |

Unknown fields are rejected at every schema level. A new field therefore requires a schema revision or an explicitly versioned extension mechanism in a future specification.

---

## 4. Identity and Classification

### 4.1 Identity

`identity` contains:

| Field | Required | Rule |
|---|---:|---|
| `name` | yes | Display name. |
| `manufacturer` | no | Manufacturer name when known. |
| `part_number` | no | Manufacturer part number when known. |
| `family` | no | Product family or series. |
| `variant` | no | Package, module, or commercial variant. |

An unknown value shall be omitted. Empty strings shall not be used as substitutes for unknown values.

### 4.2 Category

`classification.category` shall be one of:

- `MICROCONTROLLER`
- `SENSOR`
- `ACTUATOR`
- `RELAY`
- `DISPLAY`
- `ETHERNET_CONTROLLER`
- `GSM_LTE_MODULE`
- `RF_MODULE`
- `BATTERY`
- `CHARGER`
- `CONNECTOR`
- `EXTERNAL_SERVER_CLOUD`
- `COMPUTER_SBC`
- `POWER_SUPPLY`
- `VOLTAGE_REGULATOR`
- `INTERFACE_CONVERTER_TRANSCEIVER`
- `COMMUNICATION_MODULE`
- `GENERIC_IC`
- `GENERIC_MODULE`
- `GENERIC_BOARD`
- `CUSTOM_COMPONENT`

### 4.3 Physical Abstraction

`classification.abstraction` shall be one of:

- `RAW_IC`
- `MODULE`
- `FINISHED_SENSOR`
- `BOARD`
- `SYSTEM`
- `CUSTOM`

---

## 5. Lifecycle and Versioning

`lifecycle.status` shall be one of:

- `AI_GENERATED`
- `REVIEW_REQUIRED`
- `USER_REVIEWED`
- `PENDING_ADMIN_VERIFICATION`
- `VERIFIED`
- `DEPRECATED`
- `DISABLED`

The following rules are normative:

1. `component_id` identifies the component across revisions and shall not change.
2. `revision` starts at `1` and increases whenever any canonical field changes, including lifecycle or provenance metadata.
3. A published revision is immutable. An edit creates a new revision.
4. `VERIFIED` requires `verified_by` and `verified_at`.
5. Any status other than `VERIFIED` shall omit `verified_by` and `verified_at`.
6. `DEPRECATED` and `DISABLED` require `status_reason`.
7. `DISABLED` prevents new insertion but does not invalidate existing project snapshots.
8. `superseded_by_revision`, when present, shall be greater than the current revision.

Rules 4–8 are semantic constraints enforced by application validation because JSON Schema cannot express all of them reliably.

---

## 6. Identifiers and References

Nested records use stable, component-local identifiers:

- Pins: `PIN-<token>`
- Ports: `PORT-<token>`
- Resources: `RES-<token>`
- Functions: `FUNC-<token>`
- Pin mappings: `MAP-<token>`
- Addresses: `ADDR-<token>`
- Notes: `NOTE-<token>`
- Datasheets: `DS-<token>`

`<token>` contains uppercase ASCII letters, digits, `_`, or `-`. Identifiers shall be unique within their respective arrays. References shall resolve inside the same component revision.

IDs are stable across revisions when the represented engineering concept is unchanged. Renaming a pin or port does not by itself create a new ID. Removing and later recreating a concept shall use a new ID.

---

## 7. Quantities and Units

All numeric engineering quantities use explicit unit-bearing objects:

```json
{
  "value": 5.0,
  "unit": "V"
}
```

V1 canonical units are:

| Quantity | Unit |
|---|---|
| Voltage | `V` |
| Current | `A` |
| Frequency | `Hz` |

Values shall be converted to canonical units before storage. Display layers may render derived units such as mV, mA, kHz, or MHz.

Ranges use inclusive `min` and `max`. When only a nominal, typical, or maximum value is known, only that field shall be supplied. `min` shall not exceed `max`.

---

## 8. Pin Model

A pin represents a physical terminal. `pins` may be empty for logical systems such as an external cloud service.

Each pin contains:

- Stable `pin_id`.
- Physical `number` or designator.
- Datasheet `name`.
- Optional `gpio_number`.
- `direction`.
- `electrical_type`.
- Required/optional `requirement`.
- Optional voltage and source/sink current limits.
- Zero or more alternate functions.

Pin directions:

- `INPUT`
- `OUTPUT`
- `BIDIRECTIONAL`
- `POWER_INPUT`
- `POWER_OUTPUT`
- `PASSIVE`

Electrical types:

- `DIGITAL`
- `ANALOG`
- `POWER`
- `GROUND`
- `OPEN_DRAIN`
- `OPEN_COLLECTOR`
- `DIFFERENTIAL`
- `PASSIVE`
- `CUSTOM`

Pins may include ground pins for datasheet fidelity, but ground pins shall not be exposed as required drawable ports in V1. `connection_state` is deliberately absent because it belongs to a project instance.

### 8.1 Alternate Functions

An alternate function defines one role a multiplexed pin can perform. It includes:

- `function_id`.
- Interface `type`.
- Functional `signal`, such as `TX`, `SDA`, or `PWM_OUT`.
- Optional owning `resource_id` and `channel`.
- A `mux_group` for mutually exclusive functions.

Functions sharing the same non-empty `mux_group` are mutually exclusive on one component instance unless a future rule explicitly permits coexistence.

---

## 9. Port Model

A port is an endpoint exposed to the block-diagram connection system. A port is not the same as a physical pin or internal resource.

Each port contains:

- Stable `port_id` and display `name`.
- `requirement`: `REQUIRED` or `OPTIONAL`.
- `direction`.
- Structured `interface`.
- One or more `bindings` when backed by pins or resources.
- Optional power characteristics.
- Optional protocol capabilities.

Logical/system ports may have an empty `bindings` array. Physical ports normally bind to at least one pin, resource, or resource channel.

### 9.1 Interface Types

Supported `interface.type` values are:

```text
GPIO_INPUT, GPIO_OUTPUT, GPIO_BIDIRECTIONAL, PWM, INTERRUPT,
DIGITAL_CUSTOM, UART_TTL, RS232, RS485, CAN, LIN, I2C, SPI,
ONE_WIRE, ANALOG_INPUT, ANALOG_OUTPUT, ADC_INPUT, DAC_OUTPUT,
ANALOG_0_10V, ANALOG_4_20MA, ETHERNET, WIFI, BLE, GSM, LTE,
LORA, RF_CUSTOM, DRY_CONTACT, RELAY_CONTACT, ENABLE, RESET,
POWER_INPUT, POWER_OUTPUT, BATTERY_INPUT, BATTERY_OUTPUT,
CHARGER_INPUT, CHARGER_OUTPUT, CUSTOM
```

`interface.custom_type` is required only when `type` is `CUSTOM`, `DIGITAL_CUSTOM`, or `RF_CUSTOM`, and shall otherwise be omitted.

`interface.bus_mode` indicates topology:

- `POINT_TO_POINT`
- `SHARED_BUS`
- `MULTI_DROP`
- `WIRELESS`
- `NOT_APPLICABLE`

### 9.2 Port Bindings

A binding describes resources consumed when a port is allocated. It may reference:

- `pin_id`
- `function_id`
- `resource_id`
- `channel`

At least one of `pin_id` or `resource_id` is required for every binding. If `function_id` is present, it shall belong to the referenced pin. If a channel is present, it shall exist in the referenced resource.

Multiple bindings in one port are simultaneously required. Alternative valid assignments are represented by resource `compatible_pin_mappings`, not by ambiguous bindings.

---

## 10. Peripheral Resource Model

A resource represents an internal hardware controller or allocatable capability, such as `UART0`, `I2C0`, `ADC1`, or a GPIO bank.

Each resource contains:

- Stable `resource_id`.
- `type` and display `name`.
- `share_mode`.
- Available `channels`.
- Zero or more compatible pin mappings.

Resource types are:

- `GPIO`
- `UART`
- `SPI`
- `I2C`
- `ADC`
- `DAC`
- `PWM`
- `CAN`
- `LIN`
- `ONE_WIRE`
- `ETHERNET`
- `CUSTOM`

Share modes are:

- `EXCLUSIVE`: one allocation consumes the controller.
- `SHARED_BUS`: multiple devices may share one controller allocation.
- `CHANNELIZED`: channels are allocated independently.

A compatible pin mapping lists a complete supported set of signal-to-pin/function assignments. The rule engine shall choose or validate one mapping as a unit.

Allocation state is not stored in the component definition.

---

## 11. Power Model

Power is defined on a power-capable port through `power`.

`power.role` shall be:

- `SOURCE`
- `LOAD`
- `BIDIRECTIONAL`

Available characteristics are:

- Voltage range and nominal voltage.
- Typical, maximum, and peak current.
- Regulation type.
- Polarity.

`power` is permitted only on ports whose interface type is one of the V1 power interface types. A source normally uses an output interface; a load normally uses an input interface. The rule engine shall validate cross-field consistency.

Conservative current values should be stored whenever known. Detailed thermal, transient, and inrush models are outside V1.

---

## 12. Address Capabilities

`address_capabilities` describes protocol addresses supported by the component. V1 address kinds are:

- `I2C_7_BIT`
- `I2C_10_BIT`
- `MODBUS_RTU_SLAVE`

An address capability references the applicable `port_id` and defines either:

- `FIXED` with exactly one allowed address.
- `SELECTABLE` with two or more allowed addresses.
- `USER_CONFIGURABLE` with an inclusive numeric range.

I2C addresses are stored as decimal integers in JSON and may be displayed in hexadecimal. Modbus slave addresses are also integers. Project-specific selected addresses belong to the project component instance, not this schema.

---

## 13. Provenance and Confidence

`provenance.origin` shall be one of:

- `AI_DATASHEET_EXTRACTION`
- `MANUAL`
- `IMPORTED`
- `MIGRATED`

Datasheet metadata contains references to externally stored PDF files; the PDF binary shall not be embedded in a component document. Each reference records its media type and byte size, and the schema enforces the V1 limit of 10 MiB (`10,485,760` bytes) and 100 pages.

AI or manual review evidence is represented by `field_evidence`. Each record identifies a field using a JSON Pointer, with optional:

- Confidence from `0` through `1`.
- Datasheet reference.
- Page numbers.
- Source text excerpt.
- Reviewer note.

Confidence describes extraction certainty, not engineering validity. It never grants `VERIFIED` status.

---

## 14. Engineering Notes

Component notes use structured records with:

- `note_id`.
- `text`.
- `severity`: `INFO`, `WARNING`, or `CRITICAL`.
- Optional JSON Pointer `applies_to`.

Notes provide context and shall not replace machine-readable electrical limits or interface definitions.

---

## 15. Null, Empty, and Unknown Values

V1 follows these rules:

1. Optional unknown scalar fields are omitted, not set to `null`.
2. Required collection fields are present and may be empty.
3. Empty strings are invalid.
4. Zero is a valid measured value and shall not mean unknown.
5. A missing limit means “not modeled,” not “unlimited” or “zero.”
6. Consumers shall not infer engineering values that are absent.

---

## 16. Cross-Reference and Semantic Validation

After JSON Schema validation, the application shall enforce:

1. All IDs are unique within their respective collections.
2. Every reference resolves within the same component revision.
3. Every `function_id` reference belongs to its referenced pin.
4. Every pin mapping references valid signals, pins, and functions.
5. `min <= nominal <= max` whenever the applicable values coexist.
6. Typical current does not exceed maximum current when both exist.
7. Fixed/selectable/range address modes use the correct value representation.
8. Address values are valid for their address kind.
9. Custom interfaces include a non-empty custom type.
10. Verified lifecycle metadata is internally consistent.
11. Power characteristics occur only on compatible power interfaces.
12. Required ground pins do not become drawable required ports.
13. `updated_at` is not earlier than `created_at`.

Failure of semantic validation prevents publication of the revision. Draft AI candidates may be persisted separately while incomplete, but they are not valid published Component Schema V1 documents until all required fields and invariants pass.

---

## 17. Project Snapshot Contract

When a component revision is inserted into a project, the project stores the complete canonical component document as an immutable snapshot, plus project-instance state defined by Project File Specification V1.

The snapshot shall preserve:

- `schema_version`.
- `component_id`.
- `revision`.
- All engineering data used by validation.
- Provenance and verification status at insertion or update time.

The project shall not resolve engineering data dynamically from the latest library revision. Updating a project component is an explicit operation that compares the old snapshot with a selected newer revision.

---

## 18. Example: HC-SR04 Revision 1

```json
{
  "schema_version": "hwsd.component/1",
  "component_id": "CMP-000001",
  "revision": 1,
  "identity": {
    "name": "HC-SR04",
    "manufacturer": "Generic",
    "part_number": "HC-SR04"
  },
  "classification": {
    "category": "SENSOR",
    "abstraction": "MODULE"
  },
  "lifecycle": {
    "status": "USER_REVIEWED",
    "status_reason": "Initial user-reviewed definition"
  },
  "provenance": {
    "origin": "MANUAL",
    "datasheets": [],
    "field_evidence": []
  },
  "pins": [
    {
      "pin_id": "PIN-VCC",
      "number": "1",
      "name": "VCC",
      "direction": "POWER_INPUT",
      "electrical_type": "POWER",
      "requirement": "REQUIRED",
      "alternate_functions": []
    },
    {
      "pin_id": "PIN-TRIG",
      "number": "2",
      "name": "TRIG",
      "direction": "INPUT",
      "electrical_type": "DIGITAL",
      "requirement": "REQUIRED",
      "alternate_functions": []
    },
    {
      "pin_id": "PIN-ECHO",
      "number": "3",
      "name": "ECHO",
      "direction": "OUTPUT",
      "electrical_type": "DIGITAL",
      "requirement": "REQUIRED",
      "alternate_functions": []
    },
    {
      "pin_id": "PIN-GND",
      "number": "4",
      "name": "GND",
      "direction": "PASSIVE",
      "electrical_type": "GROUND",
      "requirement": "REQUIRED",
      "alternate_functions": []
    }
  ],
  "ports": [
    {
      "port_id": "PORT-VCC",
      "name": "VCC",
      "requirement": "REQUIRED",
      "direction": "INPUT",
      "interface": {
        "type": "POWER_INPUT",
        "bus_mode": "POINT_TO_POINT"
      },
      "bindings": [{ "pin_id": "PIN-VCC" }],
      "power": {
        "role": "LOAD",
        "voltage": {
          "nominal": { "value": 5, "unit": "V" }
        }
      }
    },
    {
      "port_id": "PORT-TRIG",
      "name": "TRIG",
      "requirement": "REQUIRED",
      "direction": "INPUT",
      "interface": {
        "type": "GPIO_INPUT",
        "bus_mode": "POINT_TO_POINT"
      },
      "bindings": [{ "pin_id": "PIN-TRIG" }]
    },
    {
      "port_id": "PORT-ECHO",
      "name": "ECHO",
      "requirement": "REQUIRED",
      "direction": "OUTPUT",
      "interface": {
        "type": "GPIO_OUTPUT",
        "bus_mode": "POINT_TO_POINT"
      },
      "bindings": [{ "pin_id": "PIN-ECHO" }]
    }
  ],
  "resources": [],
  "address_capabilities": [],
  "notes": [
    {
      "note_id": "NOTE-GROUND",
      "text": "Ground is represented in the pinout but implied by the V1 diagram power connection.",
      "severity": "INFO",
      "applies_to": "/pins/3"
    }
  ],
  "created_at": "2026-10-07T12:00:00Z",
  "updated_at": "2026-10-07T12:00:00Z",
  "revision_notes": "Initial component definition"
}
```

---

## 19. Compatibility and Evolution

Consumers shall dispatch on the exact `schema_version` value. They shall not silently reinterpret a future version as V1.

Non-breaking clarifications may update this prose document without changing the identifier. Any change that adds fields, changes field meaning, broadens accepted values, or alters invariants requires a new component schema version and an explicit migration path.

---

## 20. V1 Acceptance Criteria

Component Schema V1 is correctly implemented when:

1. A valid component can be serialized and validated consistently by frontend, backend, and shared tooling.
2. Pins, ports, resources, and pin mappings are distinguishable and cross-referenced.
3. Power and address data are machine-readable for deterministic validation.
4. AI confidence and source evidence remain distinct from admin verification.
5. Published component revisions are immutable and traceable.
6. A complete revision can be embedded unchanged in a project snapshot.
7. Invalid enums, malformed quantities, unresolved references, and inconsistent lifecycle data are rejected.

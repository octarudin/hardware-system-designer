# Port/Interface Schema V1
## Hardware System Designer

**Document Version:** 1.0

**Status:** Baseline Specification

**Target Release:** V1

**Schema Identifier:** `hwsd.port-interface/1`

**Normative Machine-Readable Schema:** `../schemas/port-interface-schema-v1.schema.json`

**Related Specification:** `component-schema-v1.md`

---

## 1. Purpose

This document defines the canonical V1 model for component ports and their interfaces. It establishes a shared contract for component authoring, datasheet extraction, connection creation, compatibility checks, power validation, bus allocation, and Design Check.

The schema separates three concepts:

- A **pin** is a physical terminal.
- A **resource** is an internal controller or allocatable capability.
- A **port** is the user-connectable endpoint that exposes an **interface** and binds it to pins or resources.

The schema describes endpoint capabilities. It does not decide whether two endpoints may connect; that decision belongs to the deterministic Connection Rule Specification.

---

## 2. Scope Boundary

Port/Interface Schema V1 includes:

- Port identity, direction, and required/optional state.
- Standard and custom interface types.
- Connection topology.
- Logic, analog, current-loop, and frequency constraints.
- Pin, alternate-function, resource, and channel bindings.
- Composite ports with named signals.
- Power-source and power-load characteristics.
- References to reusable custom interface profiles.

It does not include:

- A connection between component instances.
- Selected project-instance pins or pin mappings.
- Peripheral allocation state.
- Selected bus or device addresses.
- Connection validation outcomes or warning overrides.
- Cable, connector, termination, isolation, or signal-integrity simulation.
- Runtime network credentials or protocol configuration.

---

## 3. Serialization Forms

The canonical serialization is JSON encoded as UTF-8.

### 3.1 Standalone Envelope

The schema root validates a standalone port document:

```json
{
  "schema_version": "hwsd.port-interface/1",
  "port": {
    "port_id": "PORT-TRIG",
    "name": "TRIG",
    "requirement": "REQUIRED",
    "direction": "INPUT",
    "interface": {
      "type": "GPIO_INPUT",
      "bus_mode": "POINT_TO_POINT"
    },
    "bindings": [
      { "pin_id": "PIN-TRIG" }
    ]
  }
}
```

### 3.2 Embedded Component Form

Inside Component Schema V1, each item in `ports` is the envelope's `port` value only. It is validated by:

```text
port-interface-schema-v1.schema.json#/$defs/port
```

The component's `schema_version` governs the surrounding component document. The standalone `schema_version` is therefore not repeated inside an embedded port.

---

## 4. Port Model

A port is one connection endpoint presented by a component block.

| Field | Type | Required | Description |
|---|---|---:|---|
| `port_id` | string | yes | Stable component-local identifier. |
| `name` | string | yes | Human-readable endpoint label. |
| `requirement` | enum | yes | `REQUIRED` or `OPTIONAL`. |
| `direction` | enum | yes | Direction from the owning component's perspective. |
| `interface` | object | yes | Electrical, protocol, and topology contract. |
| `bindings` | array | yes | Pins/resources consumed by this port. |
| `power` | object | conditional | Required for power interface types; forbidden otherwise. |
| `description` | string | no | Concise engineering description. |

`port_id` uses `PORT-<token>` and shall be unique within one component revision. It remains stable across component revisions while the represented endpoint remains conceptually the same.

### 4.1 Requirement

- `REQUIRED`: the port participates in component completeness calculation.
- `OPTIONAL`: the port may remain disconnected without making the component incomplete.

Ground is implicit in V1. A component may retain ground pins for datasheet fidelity, but shall not expose them as required drawable ports.

### 4.2 Direction

Port direction is defined from the owning component's perspective:

- `INPUT`: receives signal, data, control, or power.
- `OUTPUT`: produces signal, data, control, or power.
- `BIDIRECTIONAL`: can transmit and receive on the same logical endpoint.
- `PASSIVE`: has no meaningful source/sink direction, such as a dry contact.

Direction describes behavior, not connector gender or drawing orientation.

---

## 5. Interface Model

An interface describes what a port exposes. Its core fields are:

| Field | Required | Description |
|---|---:|---|
| `type` | yes | Canonical V1 interface type. |
| `bus_mode` | yes | Connection topology. |
| `custom_type` | conditional | Required for custom interface families. |
| `interface_id` | no | Stable reusable custom-profile identity. |
| `interface_revision` | conditional | Revision paired with `interface_id`. |
| `logic_voltage` | no | Digital logic voltage capability. |
| `signal_voltage` | no | Analog or physical signal voltage capability. |
| `signal_current` | no | Analog/current-loop capability. |
| `max_frequency` | no | Maximum supported clock or signaling frequency. |
| `protocol` | no | Higher-level protocol carried by this interface. |

Unknown fields are omitted rather than stored as `null`. Missing electrical limits mean “not modeled,” not “unlimited.”

### 5.1 Reusable Custom Profiles

A saved custom interface may carry both `interface_id` and `interface_revision`. Both fields shall be present together or omitted together.

The complete interface data is embedded in the component revision even when a profile reference exists. The reference provides traceability; it shall not cause project validation to depend on the current external profile.

---

## 6. Interface Taxonomy

### 6.1 Digital

- `GPIO_INPUT`
- `GPIO_OUTPUT`
- `GPIO_BIDIRECTIONAL`
- `PWM`
- `INTERRUPT`
- `DIGITAL_CUSTOM`

### 6.2 Serial and Differential

- `UART_TTL`
- `RS232`
- `RS485`
- `CAN`
- `LIN`

### 6.3 Bus

- `I2C`
- `SPI`
- `ONE_WIRE`

### 6.4 Analog

- `ANALOG_INPUT`
- `ANALOG_OUTPUT`
- `ADC_INPUT`
- `DAC_OUTPUT`
- `ANALOG_0_10V`
- `ANALOG_4_20MA`

### 6.5 Network and Wireless

- `ETHERNET`
- `WIFI`
- `BLE`
- `GSM`
- `LTE`
- `LORA`
- `RF_CUSTOM`

### 6.6 Control

- `DRY_CONTACT`
- `RELAY_CONTACT`
- `ENABLE`
- `RESET`

### 6.7 Power

- `POWER_INPUT`
- `POWER_OUTPUT`
- `BATTERY_INPUT`
- `BATTERY_OUTPUT`
- `CHARGER_INPUT`
- `CHARGER_OUTPUT`

### 6.8 Custom

- `CUSTOM`

`custom_type` is required for `CUSTOM`, `DIGITAL_CUSTOM`, and `RF_CUSTOM`, and forbidden for all other types. A custom interface remains unverified unless covered by an approved compatibility rule.

---

## 7. Bus Mode

`bus_mode` shall be one of:

- `POINT_TO_POINT`: one endpoint connects to one peer endpoint.
- `SHARED_BUS`: multiple devices share a controller and common signals.
- `MULTI_DROP`: multiple nodes attach to one physical medium.
- `WIRELESS`: no drawable electrical pin path is required.
- `NOT_APPLICABLE`: used only when topology has no meaningful classification.

Canonical defaults are:

| Interface | Canonical bus mode |
|---|---|
| GPIO, PWM, interrupt, UART TTL, RS-232, analog, control, power | `POINT_TO_POINT` |
| I2C, SPI, 1-Wire | `SHARED_BUS` |
| RS-485, CAN, LIN | `MULTI_DROP` |
| Wi-Fi, BLE, GSM, LTE, LoRa, RF custom | `WIRELESS` |
| Ethernet | `POINT_TO_POINT` |
| Custom | Explicitly declared |

The machine schema accepts all bus-mode values because uncommon but valid hardware topologies exist. The semantic validator shall compare the declared mode with this table and require explicit review for a non-canonical combination.

---

## 8. Electrical Capabilities

All quantities use canonical units:

- Voltage: `V`
- Current: `A`
- Frequency: `Hz`

Ranges are inclusive and may contain `min`, `nominal`, and `max` where meaningful.

### 8.1 Logic Voltage

`logic_voltage` describes the logic-domain capability of digital interfaces. It does not imply tolerance beyond explicitly stored limits.

Example:

```json
{
  "logic_voltage": {
    "nominal": { "value": 3.3, "unit": "V" },
    "max": { "value": 3.6, "unit": "V" }
  }
}
```

### 8.2 Signal Voltage and Current

`signal_voltage` models an analog or physical-layer voltage range. `signal_current` models a current range such as 4–20 mA.

The standardized interface type remains authoritative where it encodes a named range. Explicit values provide extracted evidence and permit deterministic validation.

### 8.3 Maximum Frequency

`max_frequency` is a capability limit, not the selected project operating frequency. The connection or project instance stores the selected value in a future project schema.

---

## 9. Port Bindings

A binding links a port to component-local engineering objects.

| Field | Required | Description |
|---|---:|---|
| `pin_id` | conditional | Bound physical pin. |
| `function_id` | no | Alternate function on `pin_id`. |
| `resource_id` | conditional | Consumed peripheral resource. |
| `channel` | no | Channel within `resource_id`. |
| `signal` | no | Role within a composite port, such as `SDA`. |

Rules:

1. At least one of `pin_id` or `resource_id` is required.
2. `function_id` requires `pin_id` and shall belong to that pin.
3. `channel` requires `resource_id` and shall exist on that resource.
4. All references resolve within the containing component revision.
5. Multiple bindings are simultaneously required parts of one port.
6. In a multi-binding port, each binding shall have a unique `signal`.
7. Alternative pin mappings belong to the component resource's `compatible_pin_mappings`, not to parallel ambiguous bindings.

An empty `bindings` array is permitted only for a logical or wireless endpoint that has no physical allocation.

---

## 10. Composite Ports

A protocol bus is modeled as one port when users should connect it as one engineering endpoint. Its bindings identify the constituent signals.

Example I2C controller port:

```json
{
  "port_id": "PORT-I2C0",
  "name": "I2C0",
  "requirement": "OPTIONAL",
  "direction": "BIDIRECTIONAL",
  "interface": {
    "type": "I2C",
    "bus_mode": "SHARED_BUS",
    "logic_voltage": {
      "nominal": { "value": 3.3, "unit": "V" }
    },
    "max_frequency": { "value": 400000, "unit": "Hz" }
  },
  "bindings": [
    {
      "pin_id": "PIN-GPIO21",
      "function_id": "FUNC-GPIO21-I2C0-SDA",
      "resource_id": "RES-I2C0",
      "channel": "SDA",
      "signal": "SDA"
    },
    {
      "pin_id": "PIN-GPIO22",
      "function_id": "FUNC-GPIO22-I2C0-SCL",
      "resource_id": "RES-I2C0",
      "channel": "SCL",
      "signal": "SCL"
    }
  ]
}
```

SPI chip-select lines may be modeled as separate GPIO ports when each device consumes a distinct CS pin, while the shared SCLK/MOSI/MISO signals remain one SPI port.

---

## 11. Power Ports

Every V1 power interface requires a `power` object. Non-power interfaces shall not contain one.

`power.role` shall be:

- `SOURCE`
- `LOAD`

Power characteristics may include:

- Voltage range and nominal voltage.
- Typical current.
- Maximum current.
- Peak current.
- Regulation type.
- Polarity.

Input power interfaces use port direction `INPUT` and role `LOAD`. Output power interfaces use direction `OUTPUT` and role `SOURCE`. Bidirectional power negotiation is outside the V1 model.

Example:

```json
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
      "min": { "value": 4.5, "unit": "V" },
      "nominal": { "value": 5, "unit": "V" },
      "max": { "value": 5.5, "unit": "V" }
    },
    "max_current": { "value": 0.02, "unit": "A" },
    "polarity": "POSITIVE"
  }
}
```

Ground is implied by a valid V1 power connection and is not included as a separate power port.

---

## 12. Protocol Layer

`interface.type` identifies the engineering interface or physical transport. Optional `protocol` identifies a higher-level protocol transported over it.

Examples:

- `RS485` with `protocol: "MODBUS_RTU"`
- `ETHERNET` with `protocol: "MODBUS_TCP"`
- `WIFI` with `protocol: "MQTT"`

Protocol strings are normalized uppercase tokens with digits, `_`, `.`, `+`, or `-`. Protocol equality alone does not imply direct electrical compatibility.

Addresses such as I2C addresses and Modbus slave IDs are defined by the component's `address_capabilities`; a project-selected address is not stored on the port.

---

## 13. Custom Interfaces

A custom interface shall include:

- A custom-capable `type`.
- A non-empty `custom_type` name.
- An explicit `bus_mode`.
- Known electrical constraints.
- Bindings when physical resources are involved.
- Optional reusable profile identity and revision.

Example:

```json
{
  "port_id": "PORT-VENDOR-BUS",
  "name": "Vendor Bus",
  "requirement": "OPTIONAL",
  "direction": "BIDIRECTIONAL",
  "interface": {
    "type": "CUSTOM",
    "custom_type": "ACME_SENSOR_LINK",
    "interface_id": "IFACE-000042",
    "interface_revision": 2,
    "bus_mode": "MULTI_DROP",
    "signal_voltage": {
      "nominal": { "value": 5, "unit": "V" }
    }
  },
  "bindings": [
    { "pin_id": "PIN-DATA-A", "signal": "A" },
    { "pin_id": "PIN-DATA-B", "signal": "B" }
  ]
}
```

The Design Check shall warn when no verified compatibility rule exists for a custom interface.

---

## 14. Connection Compatibility Inputs

The Connection Rule Engine consumes at least:

- Interface type.
- Port direction.
- Bus mode.
- Logic and signal ranges.
- Power role and limits.
- Protocol where applicable.
- Required converter or transceiver rules.
- Selected project pin/resource allocations.

This schema provides those inputs but does not store compatibility verdicts. A verdict is contextual to two endpoints and their project state.

Examples reserved for the Connection Rule Specification include:

- `GPIO_OUTPUT` to `GPIO_INPUT`: normally valid.
- `UART_TTL` to `RS485`: invalid without a transceiver.
- `POWER_OUTPUT` to a signal input: invalid.
- Two non-tolerant output ports: invalid.
- Compatible I2C devices on one shared bus: potentially valid subject to voltage and address checks.

---

## 15. Semantic Validation

After JSON Schema validation, the application shall enforce:

1. `port_id` is unique within the component revision.
2. All binding references resolve inside that component revision.
3. A referenced alternate function belongs to its referenced pin.
4. A referenced channel belongs to its referenced resource.
5. Multi-binding signal names are present and unique.
6. Empty bindings are limited to logical or wireless endpoints.
7. Declared bus mode is canonical or explicitly reviewed.
8. `min <= nominal <= max` for every populated range.
9. Typical current does not exceed maximum current.
10. Power direction, interface type, and power role are consistent.
11. A custom interface has sufficient information for user review.
12. An `interface_id` resolves to the stated revision when the profile is available.
13. Interface data embedded in the component remains authoritative for snapshots.
14. Ground is not exposed as a required drawable port.

Semantic validation failure prevents publication of the containing component revision.

---

## 16. Null, Empty, and Unknown Values

1. Unknown optional values are omitted, not set to `null`.
2. Empty strings are invalid.
3. `bindings` is always present, even when legitimately empty.
4. Zero is a valid engineering value and never means unknown.
5. Missing limits shall not be inferred by consumers.
6. Unknown fields are rejected.

---

## 17. Evolution and Snapshot Rules

Consumers shall dispatch on the exact schema version. A future interface type or field requires a new schema version unless it was already represented through the V1 custom-interface mechanism.

When a component is inserted into a project, complete port and interface values are copied into its component snapshot. Later changes to built-in rules, custom profiles, or library revisions shall not silently mutate that snapshot.

---

## 18. V1 Acceptance Criteria

Port/Interface Schema V1 is correctly implemented when:

1. Standalone and component-embedded ports validate against one canonical definition.
2. Standard interface taxonomy matches Engineering Specification V1.
3. Composite bus ports preserve individual signal bindings.
4. Pin, function, resource, and channel references remain unambiguous.
5. Power properties cannot be attached to ordinary signal ports.
6. Custom interfaces are representable without being treated as verified automatically.
7. Port capabilities provide deterministic inputs to connection and Design Check rules.

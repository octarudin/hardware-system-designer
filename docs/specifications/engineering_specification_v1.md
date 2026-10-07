# Engineering Specification V1
## Hardware Block Diagram Design Application

**Document Version:** 1.0  
**Status:** Baseline Specification  
**Target Release:** V1  
**Application Type:** Web Application  
**Primary Use Case:** Early-stage product hardware architecture and system design  
**Language:** English terminology for engineering objects and interfaces

---

## 1. Purpose

This document defines the engineering behavior, validation logic, component model, connection rules, and design constraints for Version 1 of the Hardware Block Diagram Design Application.

The application is intended to support engineers during the early design stage of a new product by allowing users to:

- Create hardware system block diagrams using drag-and-drop blocks.
- Import component datasheets in PDF format.
- Automatically extract component information using AI.
- Create reusable hardware blocks from datasheets.
- Model hardware at pin-level detail.
- Track MCU peripheral usage and pin allocation.
- Validate communication interfaces and power connections.
- Detect incompatible electrical or protocol connections.
- Perform automated design checks.
- Store reusable components in a global component library.
- Save project data to the server and export/import project files locally.

The application does **not** generate schematics or PCB layouts in V1.

---

# 2. V1 Product Scope

## 2.1 Included in V1

V1 shall support:

- User authentication.
- Single-user project editing.
- Admin and User roles.
- Global component library.
- PDF datasheet import.
- Maximum datasheet file size: **10 MB**.
- Maximum datasheet length: **100 pages**.
- AI-assisted datasheet parsing.
- Multi-component candidate detection from one datasheet.
- User review of AI-extracted component data.
- Admin verification of components.
- Custom component editing before saving.
- Pin-level hardware modeling.
- Peripheral resource allocation.
- Pin multiplexing awareness.
- Power validation.
- Interface compatibility validation.
- Bus-aware connections.
- Selected device address conflict detection.
- Custom interfaces and ports.
- Design validation severity levels.
- Engineering notes on blocks and connections.
- Design Check function.
- Project autosave.
- Browser recovery cache.
- Local project export/import using `.txt` files.
- Component versioning.
- Component snapshots inside projects.
- Manual update to newer component revisions.

---

## 2.2 Explicitly Out of Scope for V1

The following features shall not be implemented in V1:

- Schematic generation.
- PCB layout generation.
- Gerber generation.
- KiCad export.
- EasyEDA export.
- Altium Designer export.
- Autodesk EAGLE export.
- Proteus export.
- Automatic BOM generation from schematic.
- Automatic PCB footprint assignment.
- Real-time multi-user collaboration.
- Offline full application mode.
- URL datasheet import.
- Product page parsing.
- Manual webpage parsing.
- Requirement-driven component selection.
- Automatic product architecture optimization.
- Advanced thermal analysis.
- Full signal integrity analysis.
- Full EMC analysis.
- Battery runtime simulation.
- Full regulator thermal simulation.
- Full analog circuit simulation.

---

# 3. User Roles

## 3.1 User

A User may:

- Create projects.
- Edit projects.
- Import datasheets.
- Review AI-generated component candidates.
- Edit candidate component data.
- Submit new components to the global library.
- Use verified and unverified global library components according to application policy.
- Create custom components.
- Add custom ports and custom interfaces.
- Add engineering notes.
- Run Design Check.
- Export projects.
- Import projects.
- Update project component instances to newer library revisions.

---

## 3.2 Admin

An Admin may perform all User functions and additionally:

- Review submitted components.
- Edit component definitions.
- Mark components as Verified.
- Reject incorrect component definitions.
- Deprecate components.
- Disable components from new use.
- Maintain global library quality.
- Review component revision history.

---

# 4. Component Library Architecture

## 4.1 Global Library

V1 uses one global component library.

Components added by one user may be visible and reusable by other users.

V1 does not implement separate System Library and User Library layers.

That separation is reserved for V2.

---

## 4.2 Component Status

Each library component shall have one of the following statuses:

- `AI_GENERATED`
- `REVIEW_REQUIRED`
- `USER_REVIEWED`
- `PENDING_ADMIN_VERIFICATION`
- `VERIFIED`
- `DEPRECATED`
- `DISABLED`

### VERIFIED

A component is considered officially verified in V1 only when approved by an Admin.

### DEPRECATED

A deprecated component remains available for historical projects but should not be recommended for new designs.

### DISABLED

A disabled component cannot be inserted into new projects but remains available inside projects that already contain a snapshot of it.

---

# 5. Component Versioning

Each component shall have:

- Component ID.
- Revision number.
- Creation timestamp.
- Last modification timestamp.
- Verification status.
- Datasheet reference.
- Revision notes.

Example:

```text
Component:
ATmega328P

Component ID:
CMP-000123

Revision:
3

Status:
VERIFIED
```

---

# 6. Project Component Snapshot

When a component is inserted into a project, the project shall store a snapshot of that exact component revision.

Future library changes shall not automatically modify existing project designs.

Example:

```text
Global Library:
ATmega328P Rev 4

Project A:
ATmega328P Rev 2 snapshot
```

The user may manually select:

```text
Update to Latest Version
```

The application shall then compare:

- Existing revision.
- Latest library revision.
- Changed ports.
- Changed peripherals.
- Changed electrical limits.
- Changed interface information.

The update shall not silently break existing connections.

---

# 7. Required V1 Component Categories

V1 shall support at least the following block categories:

1. Microcontroller
2. Sensor
3. Actuator
4. Relay
5. Display
6. Ethernet Controller
7. GSM/LTE Module
8. RF Module
9. Battery
10. Charger
11. Connector
12. External Server / Cloud
13. Computer / SBC
14. Power Supply
15. Voltage Regulator
16. Interface Converter / Transceiver
17. Communication Module
18. Generic IC
19. Generic Module
20. Generic Board
21. Custom Component

---

# 8. Physical Abstraction Type

The application shall distinguish the physical abstraction level of a component.

Supported values:

- `RAW_IC`
- `MODULE`
- `FINISHED_SENSOR`
- `BOARD`
- `SYSTEM`
- `CUSTOM`

Examples:

```text
MAX485 IC
→ RAW_IC

MAX485 Breakout Board
→ MODULE

A01NYUB V2
→ FINISHED_SENSOR

ESP32 Development Board
→ BOARD

External MQTT Server
→ SYSTEM
```

This distinction is important because the exposed ports of a raw IC may differ significantly from a finished module.

---

# 9. Hardware Understanding Level

V1 shall model hardware at **Level B: Pin-Level Engineering**.

The application shall understand:

- Physical pins.
- Logical pins.
- GPIO numbers.
- Peripheral functions.
- Alternate functions.
- Pin multiplexing.
- Electrical input/output role.
- Interface ownership.
- Peripheral allocation.
- Required and optional pins.

Example:

```text
GPIO17

Available Functions:
- GPIO
- UART2 TX
- PWM
```

If GPIO17 is assigned as UART2 TX, conflicting alternate functions shall become unavailable unless explicitly permitted by the component definition.

---

# 10. Component Internal Resource Model

Components may contain the following internal engineering resources:

- Pins.
- Ports.
- Peripheral controllers.
- Buses.
- Power inputs.
- Power outputs.
- Communication interfaces.
- Addresses.
- Logic voltage domains.
- Analog voltage ranges.
- Current limits.
- Required connections.
- Optional connections.

---

# 11. Pin Model

A pin may contain:

- Pin number.
- Pin name.
- GPIO number.
- Direction.
- Electrical type.
- Logic voltage.
- Maximum voltage.
- Minimum voltage.
- Alternate functions.
- Peripheral ownership.
- Required/optional status.
- Connection state.

Supported direction types should include:

- INPUT
- OUTPUT
- BIDIRECTIONAL
- POWER_INPUT
- POWER_OUTPUT
- PASSIVE

---

# 12. Pin Multiplexing

V1 shall support pin multiplexing.

Example:

```text
GPIO21
├── GPIO
├── I2C SDA
├── UART TX
└── PWM
```

When one mutually exclusive function is assigned, conflicting functions shall become unavailable.

The system shall support three validation outcomes:

```text
VALID
WARNING
ERROR
```

Behavior:

- VALID → connection allowed.
- WARNING → connection allowed after user confirmation.
- ERROR → connection shall be blocked.

---

# 13. Peripheral Resource Model

A peripheral resource represents an internal hardware controller.

Examples:

- UART0
- UART1
- SPI0
- SPI1
- I2C0
- ADC1
- CAN0

Each peripheral shall have:

- Type.
- Unique identifier.
- Available channels.
- Required pins.
- Optional pins.
- Current allocation state.
- Compatible pin mappings.

---

# 14. Peripheral Usage Display

MCU-type components shall display peripheral availability.

Example:

```text
UART   0 used / 1
SPI    0 used / 1
I2C    1 used / 2
ADC    2 used / 8
```

The application shall distinguish:

- Peripheral controller usage.
- Individual pin usage.
- Channel usage.

---

# 15. Ports vs Resources

The application shall distinguish between:

## Resource

Internal hardware capability.

Example:

```text
UART0
```

## Port

Connection point exposed by the component.

Example:

```text
TX
RX
```

Example mapping:

```text
Resource:
UART0

Ports:
TX
RX
```

A port connection may consume:

- One pin.
- One peripheral.
- One peripheral channel.
- Or a combination of these.

---

# 16. Required vs Optional Ports

Every port shall be classified as either:

- REQUIRED
- OPTIONAL

Example:

```text
HC-SR04

VCC   REQUIRED
TRIG  REQUIRED
ECHO  REQUIRED
```

Ground is handled implicitly in V1 and therefore does not need to be drawn.

Example MCU:

```text
ATmega328P

VCC   REQUIRED
UART  OPTIONAL
SPI   OPTIONAL
I2C   OPTIONAL
GPIO  OPTIONAL
```

A component does not need all optional interfaces connected to be considered complete.

---

# 17. Ground Handling

Ground shall not be drawn as a separate connection in V1.

A valid power connection automatically implies the associated ground reference unless the component explicitly requires isolation behavior.

V1 does not perform detailed isolated-ground domain modeling.

Future versions may add:

- Isolated grounds.
- Chassis ground.
- Analog ground.
- Digital ground.
- Protective earth.

---

# 18. Interface Taxonomy

V1 shall support structured interface types.

Minimum interface groups:

## 18.1 Digital

- GPIO_INPUT
- GPIO_OUTPUT
- GPIO_BIDIRECTIONAL
- PWM
- INTERRUPT
- DIGITAL_CUSTOM

## 18.2 Serial / Differential

- UART_TTL
- RS232
- RS485
- CAN
- LIN

## 18.3 Bus

- I2C
- SPI
- ONE_WIRE

## 18.4 Analog

- ANALOG_INPUT
- ANALOG_OUTPUT
- ADC_INPUT
- DAC_OUTPUT
- ANALOG_0_10V
- ANALOG_4_20MA

## 18.5 Network

- ETHERNET
- WIFI
- BLE
- GSM
- LTE
- LORA
- RF_CUSTOM

## 18.6 Control

- DRY_CONTACT
- RELAY_CONTACT
- ENABLE
- RESET

## 18.7 Power

- POWER_INPUT
- POWER_OUTPUT
- BATTERY_INPUT
- BATTERY_OUTPUT
- CHARGER_INPUT
- CHARGER_OUTPUT

## 18.8 Custom

- CUSTOM

---

# 19. Custom Interface Support

Users may create custom ports and interfaces.

Examples:

- PWM
- Analog 0–10 V
- 4–20 mA
- Dry Contact
- Proprietary serial interface
- Vendor-specific bus

A CUSTOM interface may be saved.

However:

- A custom interface is not automatically considered verified.
- Automatic compatibility rules may not apply.
- Design Check shall report that validation is incomplete.

Example:

```text
WARNING:
Custom interface has no verified compatibility rule.
```

---

# 20. Connection Rule Engine

The Connection Rule Engine is a core deterministic system.

AI shall not decide real-time connection validity.

AI may assist in creating component definitions.

The Rule Engine shall decide whether a connection is:

- Valid.
- Warning.
- Error.

---

# 21. Connection Severity

V1 shall support:

## INFO

Informational message only.

Connection is allowed.

Example:

```text
INFO:
UART0 is now fully allocated.
```

## WARNING

Connection is questionable but may still be valid.

User confirmation is required.

Example:

```text
WARNING:
Power margin is below recommended design margin.
```

The user may choose:

```text
Continue Anyway
```

The override shall be recorded.

## ERROR

Connection is electrically, logically, or architecturally invalid.

The connection shall not be created.

Example:

```text
ERROR:
UART TTL cannot be connected directly to RS-485.
```

---

# 22. Interface Compatibility Rules

Example default rules:

```text
UART_TTL ↔ UART_TTL
VALID

RS485 ↔ RS485
VALID

RS232 ↔ RS232
VALID

I2C ↔ I2C
VALID

SPI ↔ SPI
VALID

CAN ↔ CAN
VALID

GPIO_OUTPUT ↔ GPIO_INPUT
VALID

UART_TTL ↔ RS485
ERROR

UART_TTL ↔ RS232
ERROR

I2C ↔ SPI
ERROR

GPIO_OUTPUT ↔ GPIO_OUTPUT
ERROR unless explicitly supported

POWER_OUTPUT ↔ SIGNAL_INPUT
ERROR
```

---

# 23. Required Interface Converter

The application shall recognize that some interface pairs require an intermediate conversion block.

Example:

```text
MCU UART TTL
    ↓
MAX485
    ↓
RS-485 Sensor
```

Direct connection:

```text
UART TTL
    ↓
RS-485
```

shall generate:

```text
ERROR:
Interface conversion required.
```

The application may suggest a compatible converter category but does not need to automatically insert one.

---

# 24. Example: ATmega328P to RS-485 Sensor

Valid architecture:

```text
ATmega328P
UART0
   │
   ▼
MAX485
   │
   ▼
A01NYUB V2
RS-485
```

Expected resource behavior:

```text
ATmega328P

UART:
1 used / 1
```

The MAX485 connection consumes the MCU UART peripheral.

---

# 25. Bus Handling

V1 shall understand that certain interfaces operate as shared buses.

Supported bus-aware interfaces include:

- I2C
- SPI
- RS485
- CAN
- 1-Wire

---

# 26. I2C Behavior

One I2C controller may connect to multiple devices.

Example:

```text
ESP32
  │
  ├── AHT30
  ├── BH1750
  └── EEPROM
```

The MCU shall show:

```text
I2C:
1 used / 2
```

not:

```text
3 used / 2
```

The peripheral controller is allocated once.

Device count is tracked separately.

---

# 27. SPI Behavior

SPI may share:

- SCLK
- MOSI
- MISO

Each device may require a separate:

- CS / SS pin

The application shall track:

- SPI peripheral allocation.
- Shared bus pins.
- Per-device chip select pins.

---

# 28. RS-485 Behavior

RS-485 shall support multi-drop topology.

The application shall recognize:

- Shared differential bus.
- Multiple nodes.
- Optional Modbus addressing.
- Interface transceiver requirement from TTL UART.

Detailed line termination analysis is outside V1.

---

# 29. CAN Behavior

CAN shall support multi-node bus topology.

The application shall recognize:

- Shared CAN_H / CAN_L bus.
- CAN controller resource.
- CAN transceiver requirement when applicable.

Detailed bus termination analysis is outside V1.

---

# 30. Address-Aware Devices

V1 shall support address validation for selected protocols.

Initial supported cases should include:

- I2C address.
- Modbus RTU slave address.

Other address types may be added later.

---

# 31. I2C Address Conflict

If two devices with fixed identical I2C addresses are connected to the same bus, Design Check shall report an error or warning depending on whether the address is configurable.

Example:

```text
AHT30 #1
Address: 0x38

AHT30 #2
Address: 0x38
```

Possible output:

```text
ERROR:
I2C address conflict on I2C0.
```

If the device supports configurable address options, the application may request user selection.

---

# 32. Modbus Address Conflict

For RS-485 Modbus RTU networks, duplicate slave IDs on the same bus shall be detected.

Example:

```text
Sensor A
Modbus ID: 1

Sensor B
Modbus ID: 1
```

Expected:

```text
ERROR:
Duplicate Modbus slave address.
```

---

# 33. Power Model

V1 power validation shall include:

- Supply voltage.
- Device required voltage.
- Voltage range.
- Supply current capability.
- Device current requirement.
- Basic load summation.
- Basic polarity/type compatibility.

---

# 34. V1 Power Validation Scope

Included:

- Voltage compatibility.
- Current budget.
- Power source/load relation.
- Basic regulator input/output validation.

Not included:

- Detailed regulator thermal analysis.
- Detailed power dissipation.
- Dynamic startup behavior.
- Transient behavior.
- Inrush current simulation.
- Full battery runtime simulation.
- PCB trace current capacity.

---

# 35. Power Source Definition

A power source may expose:

- Nominal output voltage.
- Minimum output voltage.
- Maximum output voltage.
- Maximum output current.
- Output type.
- Regulation type.
- Notes.

Example:

```text
5V Adapter

Output:
5.0 V

Maximum Current:
2.0 A
```

---

# 36. Power Load Definition

A powered component may define:

- Nominal supply voltage.
- Minimum voltage.
- Maximum voltage.
- Typical current.
- Maximum current.
- Optional peak current.

For V1, maximum or conservative current should be preferred for validation when available.

---

# 37. Current Budget

Example:

```text
Supply:
5 V / 2 A

ESP32:
500 mA

Display:
150 mA

Sensor:
100 mA

Total:
750 mA
```

Expected:

```text
VALID

Available:
2000 mA

Required:
750 mA
```

---

# 38. Power Voltage Error

Example:

```text
12 V supply
    ↓
5 V-only sensor
```

Expected:

```text
ERROR:
Supply voltage exceeds component maximum input voltage.
```

The connection shall be blocked.

---

# 39. Power Connection Appearance

Valid power connections shall be visually distinct.

Recommended default:

- Power line: red.
- Slightly thicker than signal lines.

The application shall avoid using the same red style as a generic error indicator.

Errors should use separate warning/error UI indicators.

---

# 40. Component Connection Completeness

Each block shall have a connection completeness state.

## BLACK BORDER

No required connections have been satisfied.

## BLUE BORDER

At least one required connection is satisfied, but the block is not fully complete.

## GREEN BORDER

All required connections are satisfied and no blocking errors exist.

The green border should be slightly thicker than the default border.

---

# 41. Completeness Calculation

Example:

```text
HC-SR04

Required:
VCC
TRIG
ECHO
```

State:

```text
0 / 3
BLACK

1 / 3
BLUE

3 / 3
GREEN
```

Ground is not counted separately in V1.

---

# 42. Hover Behavior

When the cursor is positioned over a block:

- The block shall slightly increase in scale.
- Recommended visual scale increase: approximately 2–4%.
- The animation should be smooth.
- The animation shall not significantly move surrounding blocks.
- The effect is purely visual and does not affect block dimensions in project data.

---

# 43. Datasheet Import

V1 shall support PDF datasheets only.

Supported:

```text
.pdf
```

Not supported:

- URL.
- Web product page.
- HTML manual.
- Datasheet webpage.
- Datasheet from arbitrary cloud URL.
- Scanned user manuals outside the PDF flow.

---

# 44. Datasheet Limits

Maximum file size:

```text
10 MB
```

Maximum number of pages:

```text
100 pages
```

A file exceeding either limit shall be rejected before AI processing.

---

# 45. AI Datasheet Parsing

The AI parser shall attempt to extract:

- Manufacturer.
- Part number.
- Product family.
- Device category.
- Physical abstraction type.
- Supply voltage.
- Current requirements.
- Pinout.
- Pin names.
- GPIO mapping.
- Peripheral list.
- Peripheral quantity.
- Interface list.
- Electrical limits.
- Required pins.
- Optional pins.
- Protocols.
- Default addresses.
- Configurable addresses.
- Relevant notes.
- Package or module information when relevant.

---

# 46. Multi-Candidate Datasheets

A single PDF may describe multiple components or variants.

The AI parser may return multiple candidates.

Example:

```text
Detected Candidates:

1. ATmega328P
2. ATmega328PB
3. ATmega168P
```

The user shall choose which candidate(s) to create.

---

# 47. AI Confidence

AI-extracted fields may include confidence values.

Example:

```text
Device Type:
Sensor
Confidence: 96%

Protocol:
Modbus RTU
Confidence: 61%
```

Low-confidence fields shall trigger:

```text
REVIEW REQUIRED
```

---

# 48. User Review

Before a newly parsed component is submitted to the library, the user shall be able to:

- Rename the component.
- Change category.
- Change abstraction type.
- Edit power data.
- Edit pins.
- Edit ports.
- Edit peripheral resources.
- Add missing ports.
- Remove incorrect ports.
- Add custom ports.
- Edit interface types.
- Edit protocol data.
- Add engineering notes.
- Mark uncertain data for admin review.

---

# 49. Admin Verification

Admin review is required before a component receives:

```text
VERIFIED
```

The Admin may:

- Approve.
- Reject.
- Correct.
- Request revision.
- Deprecate.

---

# 50. Datasheet Retention

The original datasheet PDF should remain associated with the component record as a reference source.

The component record should retain:

- Datasheet file reference.
- Datasheet filename.
- Upload timestamp.
- Component revision.
- Extraction timestamp.

---

# 51. Custom Component Creation

Users may create components manually without AI extraction.

A manually created component shall support:

- Name.
- Category.
- Abstraction type.
- Pins.
- Ports.
- Interfaces.
- Power requirements.
- Resources.
- Required/optional state.
- Notes.

Manual components remain unverified until Admin approval.

---

# 52. Engineering Notes

Engineering Notes are required in V1.

Notes may be attached to:

- Component block.
- Connection.
- Peripheral assignment.
- Power connection.
- Custom interface.
- Project.

Example block note:

```text
MAX485 selected because the sensor uses RS-485
while the MCU provides UART TTL only.
```

Example connection note:

```text
9600 baud, 8N1
```

---

# 53. Warning Override Logging

If the user continues after a WARNING:

- The warning message shall be stored.
- The timestamp shall be stored.
- The user action shall be recorded.
- The optional engineering note may explain the decision.

Example:

```text
WARNING OVERRIDE

Reason:
Power margin accepted because load is intermittent.
```

---

# 54. Design Check

V1 shall include a Design Check function.

Suggested command:

```text
RUN DESIGN CHECK
```

The Design Check shall evaluate the current project against deterministic engineering rules.

---

# 55. Design Check Categories

At minimum:

- Missing required connections.
- Invalid interface connections.
- Pin conflicts.
- Peripheral conflicts.
- Pin multiplexing conflicts.
- Power voltage errors.
- Power current budget.
- Missing converter/transceiver.
- I2C address conflicts.
- Modbus address conflicts.
- Invalid custom interface validation state.
- Deprecated component warnings.
- Component update availability.
- Unverified component usage.

---

# 56. Design Check Result Format

Example:

```text
DESIGN CHECK

PASS
✓ MCU power connected
✓ UART allocation valid
✓ RS-485 transceiver present
✓ Sensor supply valid

WARNING
⚠ Component is not admin verified
⚠ Power margin below preferred threshold

ERROR
✕ I2C address conflict
✕ 5 V signal connected to 3.3 V non-tolerant input

SUMMARY
Passed: 4
Warnings: 2
Errors: 2
```

---

# 57. Project Saving

Projects shall be stored on the server/database.

A project shall include:

- Project metadata.
- Project name.
- User ID.
- Component instances.
- Component snapshots.
- Positions.
- Canvas configuration.
- Connections.
- Pin assignments.
- Peripheral allocations.
- Power connections.
- Interface assignments.
- Engineering notes.
- Warning overrides.
- Design Check results.
- Component revision references.
- Autosave timestamp.

---

# 58. Autosave

Autosave may be enabled by the user.

Default interval:

```text
3 seconds
```

Autosave shall be change-aware.

Recommended behavior:

```text
User changes project
      ↓
Project marked DIRTY
      ↓
3 seconds
      ↓
If still DIRTY
      ↓
Save
```

No database write is required when no project data has changed.

---

# 59. Browser Recovery Cache

The browser may store a temporary recovery copy.

Its purpose is recovery after:

- Browser crash.
- Temporary network failure.
- Unexpected page reload.
- Temporary backend failure.

The server remains the primary project storage.

---

# 60. Local Export

The application shall support local project export.

File extension in V1:

```text
.txt
```

The internal content should use structured JSON.

Example filename:

```text
aquasense_design.txt
```

---

# 61. Local Import

Users shall be able to load a local `.txt` project file.

The application shall validate:

- File structure.
- Schema version.
- Component snapshot data.
- Connection data.
- Unsupported future fields.
- Corrupt project data.

---

# 62. Project File Version

Every exported project file shall include a schema version.

Example:

```text
schema_version: 1
```

This allows future application versions to migrate old project files.

---

# 63. Project Editing

V1 shall support at minimum:

- Drag and drop.
- Move.
- Resize where permitted.
- Select.
- Multi-select.
- Delete.
- Copy.
- Paste.
- Undo.
- Redo.
- Zoom.
- Pan.
- Snap to grid.
- Connection creation.
- Connection deletion.
- Property editing.
- Engineering notes.

---

# 64. MCU-to-Sensor Connection Flow

Example:

```text
ATmega328P
    ↓
HC-SR04
```

When the user attempts to connect the devices, the application shall identify that the sensor requires:

```text
TRIG → GPIO
ECHO → GPIO
```

The application shall then present available compatible GPIOs.

Example:

```text
Connect HC-SR04

TRIG:
[ PD2 ]

ECHO:
[ PD3 ]
```

Only compatible and unused pins should be selectable unless a warning-state assignment is permitted.

---

# 65. Sensor Example: HC-SR04

Expected component model:

```text
Name:
HC-SR04

Category:
Sensor

Abstraction:
MODULE

Power:
5 V

Required Interfaces:
TRIG → GPIO
ECHO → GPIO
```

---

# 66. Sensor Example: A01NYUB V2

Expected high-level model:

```text
Name:
A01NYUB V2

Category:
Sensor

Abstraction:
FINISHED_SENSOR

Interfaces:
RS-485

Power:
According to datasheet
```

Direct connection:

```text
MCU UART TTL
     ↓
A01NYUB RS-485
```

shall be blocked.

Valid architecture:

```text
MCU UART
   ↓
RS-485 Transceiver
   ↓
A01NYUB
```

---

# 67. Regulator Example: LM7805

AI shall attempt to identify LM7805 as:

```text
Category:
Voltage Regulator

Abstraction:
RAW_IC
```

Expected high-level ports:

```text
VIN
VOUT
```

Ground is implicit for diagram purposes.

Relevant extracted values may include:

- Input voltage range.
- Output voltage.
- Output current limit.

---

# 68. AI Responsibility Boundary

AI is responsible for assisting with:

- Datasheet interpretation.
- Candidate component detection.
- Category suggestion.
- Interface extraction.
- Pin extraction.
- Power data extraction.
- Peripheral extraction.
- Confidence estimation.

AI is **not** the final authority for connection validity.

---

# 69. Deterministic Rule Engine Responsibility

The deterministic Rule Engine is responsible for:

- Connection compatibility.
- Peripheral allocation.
- Pin allocation.
- Pin conflict detection.
- Bus allocation.
- Address conflict detection.
- Power compatibility.
- Required connection completeness.
- Error blocking.
- Warning generation.
- Design Check results.

---

# 70. Component Verification Principle

The application shall clearly distinguish:

```text
AI extracted
```

from:

```text
Admin verified
```

A component shall not appear equivalent to a verified engineering source merely because AI generated it successfully.

---

# 71. UI Engineering Status Indicators

Recommended status indicators:

```text
BLACK BORDER
No required connections satisfied.

BLUE BORDER
Partially connected.

GREEN BORDER
All required connections satisfied.

WARNING ICON
Design warning exists.

ERROR ICON
Blocking design issue exists.

VERIFIED BADGE
Admin-verified component.

UNVERIFIED BADGE
Component not yet verified.
```

---

# 72. Audit and History

V1 should maintain a basic history for important actions, including:

- Component creation.
- Component revision.
- Admin verification.
- Component deprecation.
- Project component update.
- Warning override.
- Datasheet replacement.

Full enterprise audit logging is not required in V1.

---

# 73. Design Philosophy

The V1 application shall prioritize:

1. Engineering correctness.
2. Clear visual feedback.
3. Deterministic validation.
4. Reusable component definitions.
5. Traceability to datasheets.
6. User control over AI-generated data.
7. Non-destructive component versioning.
8. Early detection of architecture mistakes.

---

# 74. V1 Success Criteria

V1 shall be considered functionally successful when a user can:

1. Log in.
2. Create a new project.
3. Import a PDF datasheet.
4. Allow AI to extract component candidates.
5. Review and edit a candidate.
6. Submit the component.
7. Have an Admin verify the component.
8. Insert the component from the global library.
9. Connect components at pin/interface level.
10. Allocate MCU pins and peripherals.
11. Receive blocking errors for incompatible connections.
12. Receive warnings for questionable connections.
13. Validate power requirements.
14. Use shared buses correctly.
15. Detect selected address conflicts.
16. View connection completeness through block border state.
17. Add engineering notes.
18. Run Design Check.
19. Autosave the project.
20. Export the project to local `.txt`.
21. Import the project from local `.txt`.
22. Preserve old component revisions as project snapshots.
23. Optionally update components to newer library revisions.

---

# 75. Planned V2 Extensions

Potential V2 features include:

- System Library + User Library.
- Requirement blocks.
- Requirement-to-component matching.
- Product design requirement validation.
- More protocol address validation.
- Multi-user collaboration.
- Improved power domains.
- Isolation modeling.
- Advanced power analysis.
- Component recommendation.
- Datasheet URL import.
- Product page parsing.
- Manual page import.
- Library trust scoring.
- Advanced design history.
- Automated architecture suggestions.

---

# 76. Final V1 Architectural Principle

The application shall treat a product design as a structured engineering graph:

```text
COMPONENTS
    +
PORTS
    +
PINS
    +
RESOURCES
    +
INTERFACES
    +
POWER
    +
CONNECTIONS
    +
ENGINEERING RULES
```

The visible block diagram is the user interface representation of that structured engineering graph.

The application shall therefore not operate merely as a drawing tool.

It shall operate as an engineering-aware hardware architecture design system.

# Project File Specification V1
## Hardware System Designer

**Document Version:** 1.0

**Status:** Baseline Specification

**Target Release:** V1

**Schema Identifier:** `hwsd.project/1`

**Normative Machine-Readable Schema:** `../schemas/project-file-v1.schema.json`

**Related Specifications:** `component-schema-v1.md`, `port-interface-schema-v1.md`, `connection-rule-specification-v1.md`

---

## 1. Purpose

This document defines the canonical V1 project representation used by server persistence, autosave, browser recovery, and local `.txt` export/import.

A project file is a self-contained engineering snapshot. It stores exact component revisions together with diagram layout, connections, selected mappings and addresses, allocation state, engineering notes, warning overrides, and the latest Design Check result.

The server remains the primary project store. A local export is a portable serialization of the same canonical project document, not a separate reduced format.

---

## 2. Scope Boundary

Project File Schema V1 includes:

- Project identity, ownership, and revision metadata.
- Immutable component snapshots used by project instances.
- Canvas and block layout state.
- Logical connections and bus membership.
- Selected pin mappings, device addresses, and operating settings.
- Pin, function, peripheral, and channel allocations.
- Project-level engineering notes.
- Warning override audit records.
- Latest Design Check result.
- Autosave configuration and save timestamp.

It does not include:

- User credentials or authorization policy.
- Component library revision history beyond embedded snapshots.
- Datasheet PDF binaries.
- Browser undo/redo stacks.
- Temporary drag, selection, dialog, or incomplete-connection state.
- AI prompts, raw extraction responses, or model credentials.
- Server audit logs unrelated to the portable project.

---

## 3. File Format

V1 local exports use:

- File extension: `.txt`
- Encoding: UTF-8 without a required byte-order mark.
- Content: one JSON object conforming to `project-file-v1.schema.json`.
- Schema version: exact value `hwsd.project/1`.

Recommended filename:

```text
aquasense_design.txt
```

The filename is not authoritative. Project identity and name come from the document content.

JSON comments, trailing commas, `NaN`, and infinite numeric values are invalid.

---

## 4. Root Document

The root object contains:

| Field | Type | Required | Description |
|---|---|---:|---|
| `schema_version` | string | yes | Constant `hwsd.project/1`. |
| `ruleset_version` | string | yes | Constant `hwsd.connection-rules/1`. |
| `project_id` | string | yes | Stable project identity. |
| `document_revision` | integer | yes | Revision for persistence and concurrency. |
| `engineering_revision` | integer | yes | Revision of rule-relevant engineering state. |
| `metadata` | object | yes | Name, owner, timestamps, and optional description. |
| `settings` | object | yes | Autosave and project editing preferences. |
| `canvas` | object | yes | Viewport and grid state. |
| `component_instances` | array | yes | Project blocks with immutable component snapshots. |
| `connections` | array | yes | Logical point-to-point connections and buses. |
| `allocations` | array | yes | Committed resource allocation records. |
| `engineering_notes` | array | yes | User-authored project notes. |
| `warning_overrides` | array | yes | Warning confirmations and audit evidence. |
| `last_design_check` | object | no | Latest Design Check result for this project. |

Unknown fields are rejected at every schema level.

---

## 5. Project Revisions

### 5.1 Document Revision

`document_revision` starts at `1` and increments for every persisted project change, including layout, canvas, metadata, notes, and engineering state.

The backend uses it for optimistic concurrency:

1. The client submits its expected revision.
2. The server compares it with the stored revision.
3. A mismatch rejects the write without partial changes.
4. The client reloads or resolves the conflict before retrying.

### 5.2 Engineering Revision

`engineering_revision` starts at `1` and increments only when rule-relevant state changes, including:

- Adding, removing, or updating a component snapshot.
- Adding, removing, or changing a connection endpoint.
- Changing a selected mapping, address, frequency, or serial setting.
- Changing committed allocations.
- Adding or invalidating a warning override.

Moving a block, panning the canvas, renaming the project, or editing a purely explanatory note does not increment `engineering_revision`.

`engineering_revision` shall never exceed `document_revision`.

---

## 6. Metadata and Settings

`metadata` contains:

- `name`.
- Optional `description`.
- `owner_user_id`.
- `created_at` and `updated_at` as RFC 3339 UTC timestamps.

`settings.autosave` contains:

- `enabled`.
- `interval_ms`.
- Optional `last_saved_at`.

The default autosave interval is `3000` milliseconds. Autosave is change-aware: no write occurs when `document_revision` has not changed since the last successful save.

Autosave failure shall not replace the last valid server revision. The browser may keep a separate recovery copy of the complete project document.

---

## 7. Canvas State

Canvas state is presentation data and does not affect engineering validation.

It includes:

- Viewport origin `x` and `y`.
- Positive zoom factor.
- Positive grid size.
- Snap-to-grid setting.

Coordinates and dimensions use application canvas units. They are finite JSON numbers and have no electrical meaning.

Block border completeness, warning icons, error icons, and power-line colors are derived from engineering state and shall not be stored as authoritative style fields.

---

## 8. Component Instances

Each component instance contains:

| Field | Required | Description |
|---|---:|---|
| `instance_id` | yes | Stable project-local block identity. |
| `component_snapshot` | yes | Complete Component Schema V1 document. |
| `layout` | yes | Block position and optional explicit dimensions. |
| `display_name` | no | Project-local label override. |

The snapshot includes `component_id`, `revision`, ports, pins, resources, lifecycle status, and provenance. The project shall not fetch engineering values from the current global library definition during ordinary loading or validation.

### 8.1 Layout

`layout` contains:

- `x` and `y`.
- Optional positive `width` and `height`.
- Optional non-negative `z_index`.

Hover scaling and temporary drag transforms are not persisted.

### 8.2 Snapshot Update

Updating an instance to a newer component revision is explicit and atomic:

1. Compare old and new snapshots.
2. Identify changed/removed ports, pins, resources, limits, and address capabilities.
3. Re-resolve every affected endpoint and allocation.
4. Run Connection & Rule Engine V1 against the proposed state.
5. Block the update on errors.
6. Require confirmation for warnings.
7. Replace the snapshot and increment both project revisions only after success.

The old snapshot remains available in prior server revisions or export backups; it is not silently mutated.

---

## 9. Logical Connections

A connection is one logical net. Point-to-point connections contain exactly two endpoints; shared and multi-drop buses may contain more.

Each connection contains:

- `connection_id`.
- Optional display `name`.
- `topology`.
- Two or more `endpoints`.
- Optional selected operating frequency.
- Optional serial settings.
- Visual routing data.

Persisted connections are committed connections only. Draft drag lines or partially selected endpoints belong to transient UI or browser recovery state outside this schema.

### 9.1 Topology

`topology` shall be one of:

- `POINT_TO_POINT`
- `SHARED_BUS`
- `MULTI_DROP`
- `WIRELESS`
- `NOT_APPLICABLE`

The value shall agree with the endpoint interface definitions and Connection & Rule Engine rules.

### 9.2 Connection Endpoint

Each endpoint contains:

- Stable `endpoint_id`.
- `component_instance_id`.
- `port_id` from that instance's embedded component snapshot.
- `selected_mapping_ids`, which is always present and may be empty.
- `address_selections`, which is always present and may be empty.

A mapping ID shall resolve to `compatible_pin_mappings` in the endpoint's component snapshot. An address selection references an `address_id` defined by that snapshot and stores the selected integer value.

Address values are stored as decimal JSON integers. UI layers may display I2C values in hexadecimal.

Example connection with project-local selections:

```json
{
  "connection_id": "CONN-I2C0",
  "name": "Environmental Sensors",
  "topology": "SHARED_BUS",
  "endpoints": [
    {
      "endpoint_id": "ENDP-I2C-CONTROLLER",
      "component_instance_id": "INST-MCU",
      "port_id": "PORT-I2C0",
      "selected_mapping_ids": ["MAP-I2C0-GPIO21-22"],
      "address_selections": []
    },
    {
      "endpoint_id": "ENDP-I2C-AHT30",
      "component_instance_id": "INST-AHT30",
      "port_id": "PORT-I2C",
      "selected_mapping_ids": [],
      "address_selections": [
        { "address_id": "ADDR-I2C", "value": 56 }
      ]
    }
  ],
  "operating_frequency": {
    "value": 400000,
    "unit": "Hz"
  },
  "visual": {
    "routing": "AUTO",
    "waypoints": []
  }
}
```

### 9.3 Operating Frequency

`operating_frequency`, when present, uses canonical hertz:

```json
{
  "value": 400000,
  "unit": "Hz"
}
```

It represents the selected project operating point, not a component capability limit.

### 9.4 Serial Settings

Optional serial settings contain:

- Positive integer `baud_rate`.
- `data_bits` from `5` through `9`.
- `parity`: `NONE`, `EVEN`, or `ODD`.
- `stop_bits`: `1`, `1.5`, or `2`.

Every endpoint that participates in the serial connection is validated against these settings when capability data is available.

### 9.5 Visual Routing

Connection visual data contains:

- `routing`: `AUTO` or `MANUAL`.
- Ordered `waypoints`, which may be empty.

Manual routing requires at least one waypoint. Electrical meaning does not depend on visual route geometry.

---

## 10. Allocation Records

Committed pin and peripheral state is stored in `allocations` so usage can be reconstructed without relying on transient UI state.

Each allocation contains:

- `allocation_id`.
- Owning `connection_id` and `endpoint_id`.
- `component_instance_id`.
- `resource_kind`: `PIN`, `FUNCTION`, `RESOURCE`, or `CHANNEL`.
- Component-local `resource_id`.
- Optional `channel` for channel allocations.
- `allocation_mode`: `EXCLUSIVE` or `SHARED`.

Rules:

1. `connection_id`, `endpoint_id`, and `component_instance_id` shall resolve consistently.
2. `PIN` references a pin ID.
3. `FUNCTION` references an alternate-function ID belonging to an allocated pin.
4. `RESOURCE` references a peripheral resource ID.
5. `CHANNEL` references an existing channel and requires the `channel` field.
6. Non-channel allocations omit `channel`.
7. Shared allocations are valid only for the same compatible logical bus.
8. Allocation records shall exactly match the state recomputed by the Rule Engine.

On import, allocations are treated as assertions to validate, not as authority that can bypass rules.

---

## 11. Engineering Notes

Project notes contain:

- `note_id`.
- `scope`.
- Optional `target_id`.
- `text`.
- `created_by`.
- `created_at` and `updated_at`.

Scopes are:

- `PROJECT`: no `target_id`.
- `COMPONENT_INSTANCE`: target is an instance.
- `CONNECTION`: target is a connection.
- `ALLOCATION`: target is an allocation.

Notes provide rationale and context. They shall not replace structured electrical values, selected addresses, or allocations.

---

## 12. Warning Overrides

Each confirmed warning is retained as an audit record containing:

- `override_id`.
- `ruleset_version`.
- Rule ID, finding code, message, and fingerprint.
- Evaluation subject.
- Confirming user and timestamp.
- Optional engineering note.

Only a fingerprint matching the current Rule Engine finding is effective. Old records may remain for history but do not suppress or acknowledge a changed warning.

Errors cannot have overrides. Imports shall reject an override that claims an error rule was accepted when the current engine classifies it as non-overridable.

---

## 13. Latest Design Check

`last_design_check`, when present, contains:

- `evaluated_engineering_revision`.
- `evaluated_at`.
- A complete result conforming to Connection Rule Result V1.

The embedded result shall use `mode: "DESIGN_CHECK"`, target the containing project, use the same ruleset version as the project root, contain no allocation effects, and include its summary.

The result is current only when:

```text
last_design_check.evaluated_engineering_revision == engineering_revision
```

Otherwise it is retained only as stale historical information and the UI shall not present it as the current project status.

---

## 14. Canonical Example

The following example is intentionally small but complete:

```json
{
  "schema_version": "hwsd.project/1",
  "ruleset_version": "hwsd.connection-rules/1",
  "project_id": "PROJ-000001",
  "document_revision": 3,
  "engineering_revision": 2,
  "metadata": {
    "name": "Ultrasonic Sensor Test",
    "owner_user_id": "USR-000001",
    "created_at": "2026-10-07T12:00:00Z",
    "updated_at": "2026-10-07T12:10:00Z"
  },
  "settings": {
    "autosave": {
      "enabled": true,
      "interval_ms": 3000,
      "last_saved_at": "2026-10-07T12:10:00Z"
    }
  },
  "canvas": {
    "viewport": {
      "x": 0,
      "y": 0,
      "zoom": 1
    },
    "grid": {
      "size": 20,
      "snap_to_grid": true
    }
  },
  "component_instances": [
    {
      "instance_id": "INST-SENSOR",
      "display_name": "Distance Sensor",
      "layout": {
        "x": 400,
        "y": 200,
        "width": 180,
        "height": 120,
        "z_index": 1
      },
      "component_snapshot": {
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
            "bindings": [
              { "pin_id": "PIN-VCC" }
            ],
            "power": {
              "role": "LOAD",
              "voltage": {
                "nominal": { "value": 5, "unit": "V" }
              },
              "max_current": { "value": 0.02, "unit": "A" }
            }
          }
        ],
        "resources": [],
        "address_capabilities": [],
        "notes": [],
        "created_at": "2026-10-07T12:00:00Z",
        "updated_at": "2026-10-07T12:00:00Z",
        "revision_notes": "Initial component definition"
      }
    }
  ],
  "connections": [],
  "allocations": [],
  "engineering_notes": [
    {
      "note_id": "NOTE-PROJECT-1",
      "scope": "PROJECT",
      "text": "Initial sensor power validation project.",
      "created_by": "USR-000001",
      "created_at": "2026-10-07T12:05:00Z",
      "updated_at": "2026-10-07T12:05:00Z"
    }
  ],
  "warning_overrides": []
}
```

An empty `connections` array is valid while editing, even though full Design Check reports the missing required VCC connection.

---

## 15. Save and Autosave Contract

A project write is atomic:

1. Validate JSON Schema.
2. Validate cross-references and uniqueness.
3. Validate expected `document_revision`.
4. Persist the new complete document or equivalent transactional records.
5. Return the committed revision.

Autosave uses the same validation and concurrency rules as an explicit save. It shall not create a database write when there are no changes.

`last_saved_at` records successful persistence, not the start of a save attempt.

---

## 16. Local Export

Local export shall:

1. Serialize the latest successfully persisted or explicitly selected local project state.
2. Preserve every component snapshot and project engineering field.
3. Use UTF-8 JSON in a `.txt` file.
4. Exclude credentials, session tokens, and datasheet binaries.
5. Avoid rewriting IDs merely for export.

The export shall remain usable when the global library later changes or the user is temporarily unable to access it.

---

## 17. Local Import Pipeline

Import is fail-closed and ordered:

1. Enforce configured file-size limits before parsing.
2. Decode UTF-8 and parse strict JSON.
3. Require exact supported `schema_version`.
4. Validate against Project File Schema V1 and all referenced schemas.
5. Enforce unique IDs and resolve every internal reference.
6. Recompute allocation consistency.
7. Re-run the declared supported Rule Engine ruleset.
8. Mark a stored Design Check stale when its engineering revision or result is inconsistent.
9. Present validation findings before creating or replacing a server project.

A structurally corrupt file is rejected. An engineering-incomplete but structurally valid file may be imported when it contains no internally inconsistent or forbidden connection; Design Check then reports missing required connections and warnings.

### 17.1 Import Identity

The default import behavior is **Create Copy**:

- Generate a new `project_id`.
- Reset server-side `document_revision` to `1`.
- Preserve component instance, connection, endpoint, allocation, note, and override IDs because they are local to the new project.
- Preserve embedded component IDs and revisions.
- Set new ownership and timestamps from the importing account/action.
- Retain the source engineering state.

Replacing an existing project requires a separate explicit user action and normal concurrency authorization.

---

## 18. Browser Recovery Cache

The browser recovery cache may store the complete Project File V1 document plus cache metadata outside the canonical object.

On recovery, the application compares:

- Project ID.
- Document revision.
- Updated timestamp.
- Local dirty state.

Recovery never silently overwrites a newer server revision. The user chooses which state to retain when both contain divergent changes.

---

## 19. Cross-Reference and Semantic Validation

After JSON Schema validation, the application shall enforce:

1. Project-local instance, connection, endpoint, allocation, note, and override IDs are unique in their respective project scopes. Component-local IDs need only be unique inside each embedded snapshot and may repeat across instances.
2. `engineering_revision <= document_revision`.
3. `metadata.updated_at >= metadata.created_at`.
4. Every connection endpoint resolves to one instance and one port in its embedded snapshot.
5. Every selected mapping resolves within the endpoint snapshot.
6. Every selected address resolves to an address capability on the endpoint port, uses an allowed value, and appears at most once per endpoint.
7. Connection endpoint cardinality and topology follow Connection & Rule Engine V1.
8. Every allocation resolves to its connection, endpoint, instance, and snapshot resource.
9. Allocation records exactly match recomputed allocations.
10. Every scoped note target resolves and project notes omit `target_id`.
11. Every warning override uses the project ruleset and references a warning-capable rule.
12. The latest Design Check uses `DESIGN_CHECK`, targets this project, uses the project ruleset, and does not reference an engineering revision newer than the document.
13. Design Check summary counts match its findings and evaluated checks.
14. Manual routing has at least one waypoint; automatic routing may have none.
15. Every timestamp is valid RFC 3339 and chronological where ordering is defined.
16. Complete rule evaluation produces no forbidden persisted connection.

Schema-valid but semantically inconsistent files are rejected from normal editable import. Diagnostic tooling may open them read-only but shall not save them as valid projects.

---

## 20. Unknown, Empty, and Derived Values

1. Unknown optional scalar values are omitted, not `null`.
2. Required collections are present and may be empty.
3. Empty strings are invalid.
4. Zero is valid for coordinates and engineering quantities where allowed.
5. Missing engineering limits remain unknown.
6. Derived UI states are recalculated and not trusted from imported content.
7. Unknown fields are rejected rather than silently discarded.

---

## 21. Security and Robustness

Importers shall treat all file content as untrusted data:

- Do not execute note text, names, storage references, or other strings.
- Do not resolve arbitrary local paths from imported content.
- Do not fetch datasheets or URLs automatically during validation.
- Apply parser depth, collection-size, and total-file-size limits at the application boundary.
- Escape user-authored text when rendering.
- Reject duplicate JSON object keys during strict import parsing.
- Avoid returning server implementation details in import errors.

Schema validation alone is not an authorization check. The backend assigns ownership and verifies access independently.

---

## 22. Schema Evolution

Consumers dispatch on exact `schema_version` and `ruleset_version` values. They shall not interpret an unknown future version as V1.

A future project version requires:

- A new schema identifier.
- An explicit migration function.
- Migration tests using canonical V1 fixtures.
- Preservation of component snapshots and engineering intent.
- A migration report for values that cannot be represented exactly.

Migration never mutates the source export in place. It creates a new document and retains the original until successful validation.

---

## 23. Required Test Coverage

V1 tests shall include:

- Minimal empty project and representative populated project.
- Complete embedded component-schema validation with external references resolved.
- Duplicate instance, connection, endpoint, allocation, note, and override IDs.
- Missing instance, port, mapping, address, connection, endpoint, and resource references.
- Point-to-point and multi-endpoint bus cardinality.
- Allocation recomputation equality.
- Channel allocation with and without a channel value.
- Manual routing with and without waypoints.
- Project-scoped and entity-scoped notes.
- Current and stale Design Check results.
- Warning override fingerprint preservation and invalidation.
- Revision concurrency conflicts.
- Autosave with and without changes.
- Create Copy import identity handling.
- Unsupported future schema and ruleset versions.
- Invalid UTF-8, duplicate JSON keys, excessive nesting, and oversized imports.
- Round-trip export/import equality for canonical engineering state.

---

## 24. V1 Acceptance Criteria

Project File Schema V1 is correctly implemented when:

1. A project can be saved, exported, imported, and re-saved without losing engineering state.
2. Every instance retains its exact component revision independently of the global library.
3. Connections, selected mappings, addresses, and allocations can be reconstructed deterministically.
4. Canvas layout is preserved without becoming an engineering source of truth.
5. Warning confirmations remain auditable and invalidate when their finding changes.
6. Design Check freshness is tied to `engineering_revision`.
7. Corrupt, unsupported, or internally inconsistent files fail closed.
8. Import never executes or automatically fetches untrusted content.
9. Concurrent saves cannot silently overwrite a newer document revision.
10. The canonical document validates against all referenced V1 schemas.

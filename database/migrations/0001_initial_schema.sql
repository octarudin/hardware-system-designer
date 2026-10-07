BEGIN;

CREATE TABLE users (
    user_id TEXT PRIMARY KEY
        CHECK (user_id ~ '^USR-[A-Z0-9][A-Z0-9_-]*$'),
    email TEXT NOT NULL,
    display_name TEXT NOT NULL CHECK (length(display_name) > 0),
    password_hash TEXT NOT NULL CHECK (length(password_hash) > 0),
    role TEXT NOT NULL
        CHECK (role IN ('USER', 'ADMIN')),
    account_status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (account_status IN ('ACTIVE', 'DISABLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMPTZ,
    CHECK (email = btrim(email) AND length(email) > 3)
);

CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));

CREATE TABLE datasheets (
    datasheet_id TEXT PRIMARY KEY
        CHECK (datasheet_id ~ '^DS-[A-Z0-9][A-Z0-9_-]*$'),
    uploaded_by TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    original_filename TEXT NOT NULL CHECK (length(original_filename) > 0),
    media_type TEXT NOT NULL DEFAULT 'application/pdf'
        CHECK (media_type = 'application/pdf'),
    byte_size BIGINT NOT NULL CHECK (byte_size BETWEEN 1 AND 10485760),
    page_count INTEGER CHECK (page_count BETWEEN 1 AND 100),
    sha256 CHAR(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
    object_key TEXT NOT NULL CHECK (length(object_key) > 0),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    UNIQUE (sha256),
    UNIQUE (object_key),
    CHECK (deleted_at IS NULL OR deleted_at >= uploaded_at)
);

CREATE TABLE datasheet_import_jobs (
    import_id TEXT PRIMARY KEY
        CHECK (import_id ~ '^IMPORT-[A-Z0-9][A-Z0-9_-]*$'),
    datasheet_id TEXT NOT NULL REFERENCES datasheets(datasheet_id) ON DELETE RESTRICT,
    requested_by TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'QUEUED'
        CHECK (status IN ('QUEUED', 'PROCESSING', 'REVIEW_REQUIRED', 'COMPLETED', 'FAILED')),
    model_name TEXT CHECK (model_name IS NULL OR length(model_name) > 0),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_code TEXT CHECK (error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]*$'),
    error_message TEXT CHECK (error_message IS NULL OR length(error_message) > 0),
    CHECK (started_at IS NULL OR started_at >= requested_at),
    CHECK (completed_at IS NULL OR completed_at >= COALESCE(started_at, requested_at)),
    CHECK (
        (status = 'FAILED' AND error_code IS NOT NULL)
        OR (status <> 'FAILED' AND error_code IS NULL AND error_message IS NULL)
    )
);

CREATE TABLE components (
    component_id TEXT PRIMARY KEY
        CHECK (component_id ~ '^CMP-[A-Z0-9][A-Z0-9_-]*$'),
    created_by TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    latest_revision INTEGER NOT NULL DEFAULT 0 CHECK (latest_revision >= 0),
    canonical_name TEXT,
    manufacturer TEXT,
    part_number TEXT,
    category TEXT,
    abstraction TEXT,
    current_status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (canonical_name IS NULL OR length(canonical_name) > 0),
    CHECK (manufacturer IS NULL OR length(manufacturer) > 0),
    CHECK (part_number IS NULL OR length(part_number) > 0),
    CHECK (
        category IS NULL OR category IN (
            'MICROCONTROLLER', 'SENSOR', 'ACTUATOR', 'RELAY', 'DISPLAY',
            'ETHERNET_CONTROLLER', 'GSM_LTE_MODULE', 'RF_MODULE', 'BATTERY',
            'CHARGER', 'CONNECTOR', 'EXTERNAL_SERVER_CLOUD', 'COMPUTER_SBC',
            'POWER_SUPPLY', 'VOLTAGE_REGULATOR',
            'INTERFACE_CONVERTER_TRANSCEIVER', 'COMMUNICATION_MODULE',
            'GENERIC_IC', 'GENERIC_MODULE', 'GENERIC_BOARD', 'CUSTOM_COMPONENT'
        )
    ),
    CHECK (
        abstraction IS NULL OR abstraction IN (
            'RAW_IC', 'MODULE', 'FINISHED_SENSOR', 'BOARD', 'SYSTEM', 'CUSTOM'
        )
    ),
    CHECK (
        current_status IS NULL OR current_status IN (
            'AI_GENERATED', 'REVIEW_REQUIRED', 'USER_REVIEWED',
            'PENDING_ADMIN_VERIFICATION', 'VERIFIED', 'DEPRECATED', 'DISABLED'
        )
    ),
    CHECK (
        (latest_revision = 0 AND canonical_name IS NULL AND category IS NULL
            AND abstraction IS NULL AND current_status IS NULL)
        OR
        (latest_revision > 0 AND canonical_name IS NOT NULL AND category IS NOT NULL
            AND abstraction IS NOT NULL AND current_status IS NOT NULL)
    )
);

CREATE TABLE component_revisions (
    component_id TEXT NOT NULL REFERENCES components(component_id) ON DELETE RESTRICT,
    revision INTEGER NOT NULL CHECK (revision >= 1),
    schema_version TEXT NOT NULL DEFAULT 'hwsd.component/1'
        CHECK (schema_version = 'hwsd.component/1'),
    canonical_name TEXT NOT NULL CHECK (length(canonical_name) > 0),
    manufacturer TEXT,
    part_number TEXT,
    category TEXT NOT NULL
        CHECK (category IN (
            'MICROCONTROLLER', 'SENSOR', 'ACTUATOR', 'RELAY', 'DISPLAY',
            'ETHERNET_CONTROLLER', 'GSM_LTE_MODULE', 'RF_MODULE', 'BATTERY',
            'CHARGER', 'CONNECTOR', 'EXTERNAL_SERVER_CLOUD', 'COMPUTER_SBC',
            'POWER_SUPPLY', 'VOLTAGE_REGULATOR',
            'INTERFACE_CONVERTER_TRANSCEIVER', 'COMMUNICATION_MODULE',
            'GENERIC_IC', 'GENERIC_MODULE', 'GENERIC_BOARD', 'CUSTOM_COMPONENT'
        )),
    abstraction TEXT NOT NULL
        CHECK (abstraction IN ('RAW_IC', 'MODULE', 'FINISHED_SENSOR', 'BOARD', 'SYSTEM', 'CUSTOM')),
    lifecycle_status TEXT NOT NULL
        CHECK (lifecycle_status IN (
            'AI_GENERATED', 'REVIEW_REQUIRED', 'USER_REVIEWED',
            'PENDING_ADMIN_VERIFICATION', 'VERIFIED', 'DEPRECATED', 'DISABLED'
        )),
    definition JSONB NOT NULL,
    revision_notes TEXT NOT NULL CHECK (length(revision_notes) > 0),
    created_by TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_by TEXT REFERENCES users(user_id) ON DELETE RESTRICT,
    verified_at TIMESTAMPTZ,
    PRIMARY KEY (component_id, revision),
    CHECK (manufacturer IS NULL OR length(manufacturer) > 0),
    CHECK (part_number IS NULL OR length(part_number) > 0),
    CHECK (jsonb_typeof(definition) = 'object'),
    CHECK ((definition ->> 'schema_version') IS NOT DISTINCT FROM schema_version),
    CHECK ((definition ->> 'component_id') IS NOT DISTINCT FROM component_id),
    CHECK (((definition ->> 'revision')::INTEGER) IS NOT DISTINCT FROM revision),
    CHECK ((definition #>> '{identity,name}') IS NOT DISTINCT FROM canonical_name),
    CHECK ((definition #>> '{identity,manufacturer}') IS NOT DISTINCT FROM manufacturer),
    CHECK ((definition #>> '{identity,part_number}') IS NOT DISTINCT FROM part_number),
    CHECK ((definition #>> '{classification,category}') IS NOT DISTINCT FROM category),
    CHECK ((definition #>> '{classification,abstraction}') IS NOT DISTINCT FROM abstraction),
    CHECK ((definition #>> '{lifecycle,status}') IS NOT DISTINCT FROM lifecycle_status),
    CHECK ((definition ->> 'revision_notes') IS NOT DISTINCT FROM revision_notes),
    CHECK ((definition #>> '{lifecycle,verified_by}') IS NOT DISTINCT FROM verified_by),
    CHECK (
        ((definition #>> '{lifecycle,verified_at}')::TIMESTAMPTZ)
            IS NOT DISTINCT FROM verified_at
    ),
    CHECK (
        (lifecycle_status = 'VERIFIED' AND verified_by IS NOT NULL AND verified_at IS NOT NULL)
        OR
        (lifecycle_status <> 'VERIFIED' AND verified_by IS NULL AND verified_at IS NULL)
    )
);

CREATE TABLE component_revision_datasheets (
    component_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    datasheet_id TEXT NOT NULL REFERENCES datasheets(datasheet_id) ON DELETE RESTRICT,
    PRIMARY KEY (component_id, revision, datasheet_id),
    FOREIGN KEY (component_id, revision)
        REFERENCES component_revisions(component_id, revision) ON DELETE RESTRICT
);

CREATE TABLE component_candidates (
    candidate_id TEXT PRIMARY KEY
        CHECK (candidate_id ~ '^CAND-[A-Z0-9][A-Z0-9_-]*$'),
    import_id TEXT NOT NULL REFERENCES datasheet_import_jobs(import_id) ON DELETE RESTRICT,
    candidate_ordinal INTEGER NOT NULL CHECK (candidate_ordinal >= 1),
    detected_label TEXT CHECK (detected_label IS NULL OR length(detected_label) > 0),
    candidate_document JSONB NOT NULL
        CHECK (jsonb_typeof(candidate_document) = 'object'),
    overall_confidence NUMERIC(5,4)
        CHECK (overall_confidence BETWEEN 0 AND 1),
    status TEXT NOT NULL DEFAULT 'DETECTED'
        CHECK (status IN ('DETECTED', 'SELECTED', 'REJECTED', 'PUBLISHED')),
    published_component_id TEXT,
    published_revision INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (import_id, candidate_ordinal),
    FOREIGN KEY (published_component_id, published_revision)
        REFERENCES component_revisions(component_id, revision) ON DELETE RESTRICT,
    CHECK (
        (status = 'PUBLISHED' AND published_component_id IS NOT NULL AND published_revision IS NOT NULL)
        OR
        (status <> 'PUBLISHED' AND published_component_id IS NULL AND published_revision IS NULL)
    )
);

CREATE TABLE component_review_actions (
    review_action_id TEXT PRIMARY KEY
        CHECK (review_action_id ~ '^REVIEW-[A-Z0-9][A-Z0-9_-]*$'),
    component_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    actor_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    action TEXT NOT NULL
        CHECK (action IN (
            'SUBMITTED', 'APPROVED', 'REJECTED', 'CORRECTED',
            'REQUESTED_REVISION', 'DEPRECATED', 'DISABLED'
        )),
    note TEXT CHECK (note IS NULL OR length(note) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (component_id, revision)
        REFERENCES component_revisions(component_id, revision) ON DELETE RESTRICT
);

CREATE TABLE projects (
    project_id TEXT PRIMARY KEY
        CHECK (project_id ~ '^PROJ-[A-Z0-9][A-Z0-9_-]*$'),
    owner_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    name TEXT NOT NULL CHECK (length(name) > 0),
    description TEXT CHECK (description IS NULL OR length(description) > 0),
    document_revision BIGINT NOT NULL CHECK (document_revision >= 1),
    engineering_revision BIGINT NOT NULL CHECK (engineering_revision >= 1),
    schema_version TEXT NOT NULL DEFAULT 'hwsd.project/1'
        CHECK (schema_version = 'hwsd.project/1'),
    ruleset_version TEXT NOT NULL DEFAULT 'hwsd.connection-rules/1'
        CHECK (ruleset_version = 'hwsd.connection-rules/1'),
    document JSONB NOT NULL,
    autosave_enabled BOOLEAN NOT NULL,
    autosave_interval_ms INTEGER NOT NULL DEFAULT 3000
        CHECK (autosave_interval_ms BETWEEN 1000 AND 60000),
    last_saved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    CHECK (engineering_revision <= document_revision),
    CHECK (updated_at >= created_at),
    CHECK (last_saved_at IS NULL OR last_saved_at >= created_at),
    CHECK (deleted_at IS NULL OR deleted_at >= created_at),
    CHECK (jsonb_typeof(document) = 'object'),
    CHECK ((document ->> 'schema_version') IS NOT DISTINCT FROM schema_version),
    CHECK ((document ->> 'ruleset_version') IS NOT DISTINCT FROM ruleset_version),
    CHECK ((document ->> 'project_id') IS NOT DISTINCT FROM project_id),
    CHECK (((document ->> 'document_revision')::BIGINT) IS NOT DISTINCT FROM document_revision),
    CHECK (((document ->> 'engineering_revision')::BIGINT) IS NOT DISTINCT FROM engineering_revision),
    CHECK ((document #>> '{metadata,owner_user_id}') IS NOT DISTINCT FROM owner_user_id),
    CHECK ((document #>> '{metadata,name}') IS NOT DISTINCT FROM name),
    CHECK ((document #>> '{metadata,description}') IS NOT DISTINCT FROM description),
    CHECK (
        ((document #>> '{metadata,created_at}')::TIMESTAMPTZ)
            IS NOT DISTINCT FROM created_at
    ),
    CHECK (
        ((document #>> '{metadata,updated_at}')::TIMESTAMPTZ)
            IS NOT DISTINCT FROM updated_at
    ),
    CHECK (
        ((document #>> '{settings,autosave,enabled}')::BOOLEAN)
            IS NOT DISTINCT FROM autosave_enabled
    ),
    CHECK (
        ((document #>> '{settings,autosave,interval_ms}')::INTEGER)
            IS NOT DISTINCT FROM autosave_interval_ms
    ),
    CHECK (
        ((document #>> '{settings,autosave,last_saved_at}')::TIMESTAMPTZ)
            IS NOT DISTINCT FROM last_saved_at
    )
);

CREATE TABLE design_check_runs (
    design_check_id TEXT PRIMARY KEY
        CHECK (design_check_id ~ '^CHECK-[A-Z0-9][A-Z0-9_-]*$'),
    project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
    document_revision BIGINT NOT NULL CHECK (document_revision >= 1),
    engineering_revision BIGINT NOT NULL CHECK (engineering_revision >= 1),
    ruleset_version TEXT NOT NULL DEFAULT 'hwsd.connection-rules/1'
        CHECK (ruleset_version = 'hwsd.connection-rules/1'),
    result JSONB NOT NULL,
    initiated_by TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (engineering_revision <= document_revision),
    CHECK (jsonb_typeof(result) = 'object'),
    CHECK ((result ->> 'ruleset_version') IS NOT DISTINCT FROM ruleset_version),
    CHECK ((result ->> 'mode') IS NOT DISTINCT FROM 'DESIGN_CHECK'),
    CHECK (result ? 'summary')
);

CREATE TABLE audit_events (
    audit_event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id TEXT REFERENCES users(user_id) ON DELETE RESTRICT,
    entity_type TEXT NOT NULL
        CHECK (entity_type IN (
            'USER', 'DATASHEET', 'IMPORT_JOB', 'COMPONENT',
            'COMPONENT_REVISION', 'PROJECT', 'DESIGN_CHECK'
        )),
    entity_id TEXT NOT NULL CHECK (length(entity_id) > 0),
    action TEXT NOT NULL CHECK (action ~ '^[A-Z][A-Z0-9_]*$'),
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB
        CHECK (jsonb_typeof(metadata) = 'object'),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX datasheets_uploaded_by_idx
    ON datasheets (uploaded_by, uploaded_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX datasheet_import_jobs_requester_status_idx
    ON datasheet_import_jobs (requested_by, status, requested_at DESC);

CREATE INDEX component_candidates_import_idx
    ON component_candidates (import_id, candidate_ordinal);

CREATE INDEX components_library_status_category_idx
    ON components (current_status, category, lower(canonical_name))
    WHERE latest_revision > 0;

CREATE INDEX components_manufacturer_part_idx
    ON components (lower(manufacturer), lower(part_number))
    WHERE latest_revision > 0;

CREATE INDEX component_revisions_definition_gin_idx
    ON component_revisions USING GIN (definition jsonb_path_ops);

CREATE INDEX component_revision_datasheets_datasheet_idx
    ON component_revision_datasheets (datasheet_id);

CREATE INDEX component_review_actions_component_idx
    ON component_review_actions (component_id, revision, created_at DESC);

CREATE INDEX projects_owner_updated_idx
    ON projects (owner_user_id, updated_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX design_check_runs_project_idx
    ON design_check_runs (project_id, created_at DESC);

CREATE INDEX audit_events_entity_idx
    ON audit_events (entity_type, entity_id, occurred_at DESC);

CREATE INDEX audit_events_actor_idx
    ON audit_events (actor_user_id, occurred_at DESC)
    WHERE actor_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER candidates_set_updated_at
BEFORE UPDATE ON component_candidates
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION prepare_component_revision_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    expected_revision INTEGER;
BEGIN
    SELECT latest_revision + 1
      INTO expected_revision
      FROM components
     WHERE component_id = NEW.component_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'component % does not exist', NEW.component_id
            USING ERRCODE = '23503';
    END IF;

    IF NEW.revision <> expected_revision THEN
        RAISE EXCEPTION 'component % expects revision %, received %',
            NEW.component_id, expected_revision, NEW.revision
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER component_revision_sequence
BEFORE INSERT ON component_revisions
FOR EACH ROW EXECUTE FUNCTION prepare_component_revision_insert();

CREATE OR REPLACE FUNCTION update_component_latest_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE components
       SET latest_revision = NEW.revision,
           canonical_name = NEW.canonical_name,
           manufacturer = NEW.manufacturer,
           part_number = NEW.part_number,
           category = NEW.category,
           abstraction = NEW.abstraction,
           current_status = NEW.lifecycle_status,
           updated_at = CURRENT_TIMESTAMP
     WHERE component_id = NEW.component_id;

    RETURN NULL;
END;
$$;

CREATE TRIGGER component_revision_project_latest
AFTER INSERT ON component_revisions
FOR EACH ROW EXECUTE FUNCTION update_component_latest_revision();

CREATE OR REPLACE FUNCTION reject_immutable_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME
        USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER component_revisions_immutable
BEFORE UPDATE OR DELETE ON component_revisions
FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();

CREATE TRIGGER component_revision_datasheets_immutable
BEFORE UPDATE OR DELETE ON component_revision_datasheets
FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();

CREATE TRIGGER component_review_actions_immutable
BEFORE UPDATE OR DELETE ON component_review_actions
FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();

CREATE TRIGGER design_check_runs_immutable
BEFORE UPDATE OR DELETE ON design_check_runs
FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();

CREATE TRIGGER audit_events_immutable
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();

CREATE OR REPLACE FUNCTION save_project_v1(
    p_project_id TEXT,
    p_owner_user_id TEXT,
    p_expected_document_revision BIGINT,
    p_document JSONB
)
RETURNS projects
LANGUAGE plpgsql
AS $$
DECLARE
    saved projects;
    proposed_revision BIGINT;
BEGIN
    proposed_revision := (p_document ->> 'document_revision')::BIGINT;

    IF proposed_revision <> p_expected_document_revision + 1 THEN
        RAISE EXCEPTION 'new document revision must equal expected revision + 1'
            USING ERRCODE = '23514';
    END IF;

    UPDATE projects
       SET name = p_document #>> '{metadata,name}',
           description = p_document #>> '{metadata,description}',
           document_revision = proposed_revision,
           engineering_revision = (p_document ->> 'engineering_revision')::BIGINT,
           schema_version = p_document ->> 'schema_version',
           ruleset_version = p_document ->> 'ruleset_version',
           document = p_document,
           autosave_enabled = (p_document #>> '{settings,autosave,enabled}')::BOOLEAN,
           autosave_interval_ms = (p_document #>> '{settings,autosave,interval_ms}')::INTEGER,
           last_saved_at = (p_document #>> '{settings,autosave,last_saved_at}')::TIMESTAMPTZ,
           updated_at = (p_document #>> '{metadata,updated_at}')::TIMESTAMPTZ
     WHERE project_id = p_project_id
       AND owner_user_id = p_owner_user_id
       AND document_revision = p_expected_document_revision
       AND deleted_at IS NULL
     RETURNING * INTO saved;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'project save conflict or project unavailable'
            USING ERRCODE = '40001';
    END IF;

    RETURN saved;
END;
$$;

COMMENT ON TABLE component_revisions IS
    'Immutable canonical Component Schema V1 revisions.';

COMMENT ON COLUMN component_revisions.definition IS
    'Complete JSON document validated against component-schema-v1.schema.json before insert.';

COMMENT ON TABLE projects IS
    'Current canonical Project File V1 document with optimistic concurrency projections.';

COMMENT ON COLUMN projects.document IS
    'Complete JSON document validated against project-file-v1.schema.json and semantic rules before write.';

COMMENT ON FUNCTION save_project_v1(TEXT, TEXT, BIGINT, JSONB) IS
    'Compare-and-swap save for an already validated Project File V1 document.';

COMMIT;

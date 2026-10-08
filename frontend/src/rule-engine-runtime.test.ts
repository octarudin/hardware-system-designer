import { describe, expect, it } from 'vitest';

import { canonicalJson, evaluate } from '@hwsd/rule-engine';
import type { ProjectFileV1 } from '@hwsd/shared';

const project: ProjectFileV1 = {
  schema_version: 'hwsd.project/1',
  ruleset_version: 'hwsd.connection-rules/1',
  project_id: 'PROJ-BROWSER',
  document_revision: 1,
  engineering_revision: 1,
  metadata: {
    name: 'Browser runtime fixture',
    owner_user_id: 'USR-OWNER',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  settings: { autosave: { enabled: true, interval_ms: 3000 } },
  canvas: {
    viewport: { x: 0, y: 0, zoom: 1 },
    grid: { size: 16, snap_to_grid: true },
  },
  component_instances: [],
  connections: [],
  allocations: [],
  engineering_notes: [],
  warning_overrides: [],
};

describe('browser-side rule engine runtime', () => {
  it('produces the canonical server-compatible Design Check document', () => {
    const result = evaluate({ project, mode: 'DESIGN_CHECK' });

    expect(canonicalJson(result)).toBe(
      '{"allocation_effects":[],"allowed":true,"findings":[],"mode":"DESIGN_CHECK","requires_confirmation":false,"ruleset_version":"hwsd.connection-rules/1","subject":{"project_id":"PROJ-BROWSER"},"summary":{"checks_evaluated":38,"errors":0,"infos":0,"passed":38,"warnings":0},"verdict":"VALID"}',
    );
  });
});

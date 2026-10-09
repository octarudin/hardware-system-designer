import { describe, expect, it } from 'vitest';
import type { ProjectFileV1 } from '@hwsd/shared';
import { createEditorState, deriveEditorIndexes, editorReducer } from './editor-store.js';

const document = {
  project_id: 'PROJ-TEST',
  document_revision: 1,
  engineering_revision: 1,
  component_instances: [
    {
      instance_id: 'INST-A',
      layout: { x: 0, y: 0 },
      component_snapshot: { identity: { name: 'A' } },
    },
  ],
  connections: [],
  allocations: [],
  engineering_notes: [],
  warning_overrides: [],
  canvas: { viewport: { x: 0, y: 0, zoom: 1 } },
} as unknown as ProjectFileV1;

describe('editor command store', () => {
  it('moves components and supports undo/redo', () => {
    const moved = editorReducer(createEditorState(document), {
      type: 'EXECUTE',
      command: { type: 'MOVE_COMPONENT', instanceId: 'INST-A', x: 32, y: 48 },
    });
    expect(moved.present.component_instances[0]?.layout).toMatchObject({ x: 32, y: 48 });
    const undone = editorReducer(moved, { type: 'UNDO' });
    expect(undone.present.component_instances[0]?.layout.x).toBe(0);
    expect(editorReducer(undone, { type: 'REDO' }).present.component_instances[0]?.layout.x).toBe(
      32,
    );
    expect(moved).toMatchObject({ baseDocumentRevision: 1, editRevision: 1, dirty: true });
  });

  it('builds lookup indexes without mutating the document', () => {
    expect(deriveEditorIndexes(document).instances.get('INST-A')?.instance_id).toBe('INST-A');
    expect(document.component_instances[0]?.layout.x).toBe(0);
  });

  it('deletes dependent engineering state and clears a removed selection', () => {
    const selected = editorReducer(createEditorState(document), {
      type: 'SELECT',
      selection: { kind: 'component', id: 'INST-A' },
    });
    const removed = editorReducer(selected, {
      type: 'EXECUTE',
      command: { type: 'DELETE_COMPONENT', instanceId: 'INST-A' },
    });
    expect(removed.present.component_instances).toEqual([]);
    expect(removed.selection).toBeNull();
    expect(removed.editRevision).toBe(1);
  });

  it('bounds command history while retaining a monotonic edit revision', () => {
    const edited = Array.from({ length: 60 }).reduce<ReturnType<typeof createEditorState>>(
      (state, _, index) =>
        editorReducer(state, {
          type: 'EXECUTE',
          command: { type: 'MOVE_COMPONENT', instanceId: 'INST-A', x: index + 1, y: 0 },
        }),
      createEditorState(document),
    );
    expect(edited.past).toHaveLength(50);
    expect(edited.editRevision).toBe(60);
    expect(edited.baseDocumentRevision).toBe(1);
  });
});

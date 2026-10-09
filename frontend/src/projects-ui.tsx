import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type ProjectFileV1,
  type ProjectSummary,
  validateProjectFileSchema,
  validateProjectSemantics,
} from '@hwsd/shared';

import { ApiError } from './auth-api.js';
import { bytesToBase64, downloadText, projectApi } from './project-api.js';
import { EngineeringEditor } from './engineering-editor.js';

function projectKey(projectId: string) {
  return ['project', projectId] as const;
}
function recoveryKey(projectId: string) {
  return `hwsd:project-recovery:${projectId}`;
}

export function ProjectDashboard({ onOpen }: { readonly onOpen: (projectId: string) => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);
  const [renameTarget, setRenameTarget] = useState<ProjectSummary | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [importCandidate, setImportCandidate] = useState<{
    name: string;
    contentBase64: string;
    document: ProjectFileV1;
  } | null>(null);
  const [importError, setImportError] = useState('');
  const projects = useQuery({
    queryKey: ['projects', search],
    queryFn: () => projectApi.list(search),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['projects'] });
  const create = useMutation({
    mutationFn: projectApi.create,
    onSuccess: async (result) => {
      await refresh();
      onOpen(result.document.project_id);
    },
  });
  const remove = useMutation({
    mutationFn: projectApi.delete,
    onSuccess: async () => {
      setDeleteTarget(null);
      await refresh();
    },
  });
  const rename = useMutation({
    mutationFn: ({ project, name }: { project: ProjectSummary; name: string }) =>
      projectApi.rename(project.projectId, {
        expectedDocumentRevision: project.documentRevision,
        name,
      }),
    onSuccess: async () => {
      setRenameTarget(null);
      await refresh();
    },
  });
  const importProject = useMutation({
    mutationFn: projectApi.importCopy,
    onSuccess: async (result) => {
      setImportCandidate(null);
      await refresh();
      onOpen(result.document.project_id);
    },
  });
  const exportProject = useMutation({
    mutationFn: projectApi.export,
    onSuccess: ({ filename, content }) => downloadText(filename, content),
  });

  async function selectImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setImportError('');
    setImportCandidate(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.txt')) {
      setImportError('Choose one .txt project export.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImportError('The project file exceeds the 5 MiB limit.');
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const parsed = JSON.parse(text) as unknown;
      const schema = validateProjectFileSchema(parsed);
      if (!schema.valid) {
        setImportError(`Schema validation failed at ${schema.issues[0]?.path ?? '/'}.`);
        return;
      }
      const semantics = validateProjectSemantics(schema.value);
      if (!semantics.valid) {
        setImportError(`Semantic validation failed at ${semantics.issues[0]?.path ?? '/'}.`);
        return;
      }
      setImportCandidate({
        name: file.name,
        contentBase64: bytesToBase64(bytes),
        document: schema.value,
      });
    } catch {
      setImportError('The file is not valid UTF-8 JSON.');
    }
  }

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">M4 · Project persistence</p>
          <h1>Engineering projects.</h1>
        </div>
        <div className="form-actions">
          <label className="file-button">
            Import .txt
            <input
              type="file"
              accept=".txt,text/plain"
              onChange={(event) => void selectImport(event)}
            />
          </label>
          <button type="button" onClick={() => setShowNew(true)}>
            New Project
          </button>
        </div>
      </div>
      <div className="filter-bar">
        <label>
          Search projects
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Project name"
          />
        </label>
      </div>
      {showNew ? (
        <form
          className="inline-dialog"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            create.mutate({ name: newName });
          }}
        >
          <h2>Create project</h2>
          <label>
            Project name
            <input
              autoFocus
              required
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
          </label>
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={() => setShowNew(false)}>
              Cancel
            </button>
            <button disabled={create.isPending}>Create and open</button>
          </div>
        </form>
      ) : null}
      {importCandidate ? (
        <section className="inline-dialog">
          <h2>Import summary</h2>
          <p>
            <strong>{importCandidate.document.metadata.name}</strong> from {importCandidate.name}
          </p>
          <dl>
            <div>
              <dt>Components</dt>
              <dd>{importCandidate.document.component_instances.length}</dd>
            </div>
            <div>
              <dt>Connections</dt>
              <dd>{importCandidate.document.connections.length}</dd>
            </div>
          </dl>
          <p>
            The source remains unchanged. A new project ID, owner, and timestamps will be assigned.
          </p>
          <div className="form-actions">
            <button className="secondary-button" onClick={() => setImportCandidate(null)}>
              Cancel
            </button>
            <button
              disabled={importProject.isPending}
              onClick={() => importProject.mutate({ contentBase64: importCandidate.contentBase64 })}
            >
              Create Copy
            </button>
          </div>
        </section>
      ) : null}
      {importError ? (
        <p className="form-error" role="alert">
          {importError}
        </p>
      ) : null}
      {projects.isPending ? <p>Loading projects…</p> : null}
      {projects.isError ? <p className="form-error">Projects could not be loaded.</p> : null}
      <div className="project-list">
        {projects.data?.items.map((project) => (
          <article className="project-card" key={project.projectId}>
            <div>
              <span className="status-badge">Revision {project.documentRevision}</span>
              <h2>{project.name}</h2>
              <p>{project.description ?? 'No description'}</p>
              <small>Updated {new Date(project.updatedAt).toLocaleString()}</small>
            </div>
            <div className="project-actions">
              <button onClick={() => onOpen(project.projectId)}>Open</button>
              <button
                className="secondary-button"
                onClick={() => {
                  setRenameTarget(project);
                  setRenameValue(project.name);
                }}
              >
                Rename
              </button>
              <button
                className="secondary-button"
                onClick={() => exportProject.mutate(project.projectId)}
              >
                Export
              </button>
              <button className="danger-button" onClick={() => setDeleteTarget(project)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
      {projects.data?.items.length === 0 ? (
        <section className="empty-state">
          <h2>No projects yet</h2>
          <p>Create an empty project or import a portable Project File V1 export.</p>
        </section>
      ) : null}
      {renameTarget ? (
        <form
          className="inline-dialog"
          onSubmit={(event) => {
            event.preventDefault();
            rename.mutate({ project: renameTarget, name: renameValue });
          }}
        >
          <h2>Rename project</h2>
          <label>
            Project name
            <input
              autoFocus
              required
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setRenameTarget(null)}
            >
              Cancel
            </button>
            <button>Save name</button>
          </div>
        </form>
      ) : null}
      {deleteTarget ? (
        <section className="inline-dialog" role="dialog" aria-modal="true">
          <h2>Soft-delete “{deleteTarget.name}”?</h2>
          <p>
            The project leaves the active dashboard but remains retained according to the project
            data policy.
          </p>
          <div className="form-actions">
            <button autoFocus className="secondary-button" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button className="danger-button" onClick={() => remove.mutate(deleteTarget.projectId)}>
              Delete project
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}

type SaveState = 'Saved' | 'Unsaved changes' | 'Saving…' | 'Save failed' | 'Conflict';

export function ProjectEditor({
  projectId,
  onBack,
}: {
  readonly projectId: string;
  readonly onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const project = useQuery({
    queryKey: projectKey(projectId),
    queryFn: () => projectApi.get(projectId),
  });
  const [document, setDocument] = useState<ProjectFileV1 | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('Saved');
  const [recovery, setRecovery] = useState<ProjectFileV1 | null>(null);
  const save = useMutation({
    mutationFn: (value: ProjectFileV1) =>
      projectApi.save(projectId, value.document_revision, value),
    onMutate: () => setSaveState('Saving…'),
    onSuccess: (result) => {
      setDocument(result.document);
      setSaveState('Saved');
      localStorage.removeItem(recoveryKey(projectId));
      queryClient.setQueryData(projectKey(projectId), result);
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error) =>
      setSaveState(error instanceof ApiError && error.status === 409 ? 'Conflict' : 'Save failed'),
  });

  useEffect(() => {
    if (!project.data || document) return;
    setDocument(project.data.document);
    const cached = localStorage.getItem(recoveryKey(projectId));
    if (cached)
      try {
        const candidate = JSON.parse(cached) as { document: ProjectFileV1 };
        if (
          candidate.document.metadata.updated_at >= project.data.document.metadata.updated_at &&
          JSON.stringify(candidate.document) !== JSON.stringify(project.data.document)
        )
          setRecovery(candidate.document);
      } catch {
        localStorage.removeItem(recoveryKey(projectId));
      }
  }, [document, project.data, projectId]);

  useEffect(() => {
    if (!document || saveState !== 'Unsaved changes' || !document.settings.autosave.enabled) return;
    const timer = window.setTimeout(
      () => save.mutate(document),
      document.settings.autosave.interval_ms,
    );
    return () => window.clearTimeout(timer);
  }, [document, save, saveState]);

  function edit(mutator: (current: ProjectFileV1) => ProjectFileV1) {
    if (!document || saveState === 'Conflict') return;
    const next = mutator(document);
    setDocument(next);
    setSaveState('Unsaved changes');
    localStorage.setItem(
      recoveryKey(projectId),
      JSON.stringify({ document: next, cachedAt: new Date().toISOString(), dirty: true }),
    );
  }
  function downloadLocal() {
    if (document)
      downloadText(
        `${document.metadata.name.replaceAll(/[^a-zA-Z0-9_-]+/gu, '-')}-recovery.txt`,
        `${JSON.stringify(document, null, 2)}\n`,
      );
  }

  if (project.isPending || !document) return <p>Loading project…</p>;
  if (project.isError) return <p className="form-error">The project could not be loaded.</p>;
  return (
    <>
      <div className="project-bar">
        <button className="secondary-button" onClick={onBack}>
          Back to Projects
        </button>
        <label>
          Project name
          <input
            value={document.metadata.name}
            disabled={saveState === 'Conflict'}
            onChange={(event) =>
              edit((current) => ({
                ...current,
                metadata: { ...current.metadata, name: event.target.value },
              }))
            }
          />
        </label>
        <span className={`save-state save-${saveState.toLowerCase().replaceAll(/\W+/gu, '-')}`}>
          {saveState}
        </span>
        <button
          disabled={save.isPending || saveState === 'Saved' || saveState === 'Conflict'}
          onClick={() => save.mutate(document)}
        >
          Save now
        </button>
        <button
          className="secondary-button"
          onClick={async () => {
            const result = await projectApi.export(projectId);
            downloadText(result.filename, result.content);
          }}
        >
          Export
        </button>
      </div>
      <EngineeringEditor
        document={document}
        disabled={saveState !== 'Saved'}
        onEdit={(next) => edit(() => next)}
        onServerDocument={(next) => {
          setDocument(next);
          setSaveState('Saved');
          localStorage.removeItem(recoveryKey(projectId));
          queryClient.setQueryData(projectKey(projectId), { document: next, saved: true });
          void queryClient.invalidateQueries({ queryKey: ['projects'] });
        }}
      />
      {recovery ? (
        <section className="inline-dialog" role="dialog">
          <h2>Browser recovery copy found</h2>
          <p>
            Choose the local recovery state or keep revision {document.document_revision} from the
            server.
          </p>
          <div className="form-actions">
            <button
              className="secondary-button"
              onClick={() => {
                localStorage.removeItem(recoveryKey(projectId));
                setRecovery(null);
              }}
            >
              Use Server Version
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                downloadText(
                  `${recovery.metadata.name}-recovery.txt`,
                  `${JSON.stringify(recovery, null, 2)}\n`,
                );
              }}
            >
              Download Recovery Copy
            </button>
            <button
              onClick={() => {
                setDocument(recovery);
                setSaveState('Unsaved changes');
                setRecovery(null);
              }}
            >
              Open Recovery Copy
            </button>
          </div>
        </section>
      ) : null}
      {saveState === 'Conflict' ? (
        <section className="inline-dialog conflict-dialog" role="alertdialog">
          <h2>Save conflict</h2>
          <p>
            A newer server revision exists. Your local changes have not overwritten it and remain in
            browser recovery.
          </p>
          <div className="form-actions">
            <button className="secondary-button" onClick={downloadLocal}>
              Download Local Copy
            </button>
            <button
              onClick={() => {
                downloadLocal();
                localStorage.removeItem(recoveryKey(projectId));
                setDocument(project.data.document);
                setSaveState('Saved');
                void project.refetch();
              }}
            >
              Reload Server Version
            </button>
          </div>
        </section>
      ) : null}
      {saveState === 'Save failed' ? (
        <section className="validation-summary invalid">
          <h2>Save failed</h2>
          <p>The server version is unchanged. Your browser recovery copy is retained.</p>
          <button onClick={() => save.mutate(document)}>Retry</button>
        </section>
      ) : null}
    </>
  );
}

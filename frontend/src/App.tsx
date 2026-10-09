import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  SYSTEM_NAME,
  type AuthenticatedUser,
  type ComponentDraft,
  type ComponentListItem,
  type ComponentReviewAction,
  type SessionResponse,
  validateComponentSchema,
  validateComponentSemantics,
} from '@hwsd/shared';

import { ApiError, authApi } from './auth-api.js';
import { componentApi } from './component-api.js';
import { ProjectDashboard, ProjectEditor } from './projects-ui.js';
import { DatasheetImports } from './datasheet-ui.js';

const sessionKey = ['session'] as const;
type Screen =
  'projects' | 'project-editor' | 'components' | 'new-component' | 'datasheets' | 'review';

function Brand() {
  return (
    <a className="brand" href="/" aria-label={`${SYSTEM_NAME} home`}>
      <span className="brand-mark" aria-hidden="true">
        HS
      </span>
      <span>{SYSTEM_NAME}</span>
    </a>
  );
}

export function LoginScreen() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: (value) => queryClient.setQueryData(sessionKey, value),
  });
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    login.mutate({ email, password });
  }
  return (
    <main className="auth-layout">
      <section className="auth-intro" aria-labelledby="login-title">
        <Brand />
        <div>
          <p className="eyebrow">Engineering workspace</p>
          <h1 id="login-title">Design hardware systems with evidence.</h1>
          <p className="lede">
            Sign in to access role-aware component, project, and engineering workflows.
          </p>
        </div>
      </section>
      <section className="auth-card" aria-labelledby="sign-in-heading">
        <p className="eyebrow">Secure session</p>
        <h2 id="sign-in-heading">Sign in</h2>
        <form onSubmit={submit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {login.isError ? (
            <p className="form-error" role="alert">
              {login.error instanceof ApiError
                ? login.error.message
                : 'Sign in could not be completed.'}
            </p>
          ) : null}
          <button type="submit" disabled={login.isPending}>
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="security-note">
          Credentials and session tokens are never stored in the browser.
        </p>
      </section>
    </main>
  );
}

function ComponentDetail({
  item,
  onClose,
}: {
  readonly item: ComponentListItem;
  readonly onClose: () => void;
}) {
  const detail = useQuery({
    queryKey: ['component', item.componentId, item.latestRevision],
    queryFn: () => componentApi.revision(item.componentId, item.latestRevision),
  });
  return (
    <section className="detail-panel" aria-labelledby="component-detail-title">
      <div className="section-heading">
        <h2 id="component-detail-title">{item.name}</h2>
        <button className="secondary-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>
      {detail.isPending ? <p>Loading immutable revision…</p> : null}
      {detail.isError ? <p className="form-error">The revision could not be loaded.</p> : null}
      {detail.data ? (
        <>
          <dl className="detail-list">
            <div>
              <dt>Revision</dt>
              <dd>{detail.data.definition.revision}</dd>
            </div>
            <div>
              <dt>Lifecycle</dt>
              <dd>{detail.data.definition.lifecycle.status}</dd>
            </div>
            <div>
              <dt>Ports</dt>
              <dd>{detail.data.definition.ports.length}</dd>
            </div>
            <div>
              <dt>Pins</dt>
              <dd>{detail.data.definition.pins.length}</dd>
            </div>
            <div>
              <dt>Resources</dt>
              <dd>{detail.data.definition.resources.length}</dd>
            </div>
          </dl>
          <pre>{JSON.stringify(detail.data.definition, null, 2)}</pre>
        </>
      ) : null}
    </section>
  );
}

export function ComponentLibrary({ onCreate }: { readonly onCreate: () => void }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<ComponentListItem | null>(null);
  const components = useQuery({
    queryKey: ['components', q, status],
    queryFn: () =>
      componentApi.list({
        ...(q ? { q } : {}),
        ...(status ? { status: status as ComponentListItem['lifecycleStatus'] } : {}),
      }),
  });
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">M3 · Component library</p>
          <h1>Reusable hardware definitions.</h1>
        </div>
        <button type="button" onClick={onCreate}>
          Author component
        </button>
      </div>
      <div className="filter-bar">
        <label>
          Search
          <input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Name, manufacturer, part number"
          />
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option>VERIFIED</option>
            <option>PENDING_ADMIN_VERIFICATION</option>
            <option>REVIEW_REQUIRED</option>
            <option>DEPRECATED</option>
            <option>DISABLED</option>
          </select>
        </label>
      </div>
      {components.isPending ? <p>Loading component library…</p> : null}
      {components.isError ? (
        <p className="form-error" role="alert">
          The component library could not be loaded.
        </p>
      ) : null}
      <div className="component-grid">
        {components.data?.items.map((component) => (
          <article className="component-card" key={component.componentId}>
            <div>
              <span className={`status-badge status-${component.lifecycleStatus.toLowerCase()}`}>
                {component.lifecycleStatus.replaceAll('_', ' ')}
              </span>
              <h2>{component.name}</h2>
              <p>
                {component.manufacturer ?? 'Unknown manufacturer'} ·{' '}
                {component.partNumber ?? 'No part number'}
              </p>
            </div>
            <dl>
              <div>
                <dt>Type</dt>
                <dd>{component.category}</dd>
              </div>
              <div>
                <dt>Revision</dt>
                <dd>{component.latestRevision}</dd>
              </div>
              <div>
                <dt>Datasheet</dt>
                <dd>{component.hasDatasheet ? 'Linked' : 'None'}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSelected(component)}
            >
              View revision
            </button>
          </article>
        ))}
      </div>
      {components.data?.items.length === 0 ? (
        <section className="empty-state">
          <h2>No matching components</h2>
          <p>Adjust the filters or author the first definition.</p>
        </section>
      ) : null}
      {selected ? <ComponentDetail item={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}

function parseArray<T>(label: string, source: string): T[] {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error(`${label} must contain valid JSON.`);
  }
  if (!Array.isArray(value)) throw new Error(`${label} must be a JSON array.`);
  return value as T[];
}

export function ComponentAuthoring({ onComplete }: { readonly onComplete: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [category, setCategory] =
    useState<ComponentDraft['classification']['category']>('CUSTOM_COMPONENT');
  const [abstraction, setAbstraction] =
    useState<ComponentDraft['classification']['abstraction']>('CUSTOM');
  const [revisionNotes, setRevisionNotes] = useState('Initial manual definition');
  const [sections, setSections] = useState({
    pins: '[]',
    ports: '[]',
    resources: '[]',
    addresses: '[]',
    notes: '[]',
  });
  const [issues, setIssues] = useState<string[]>([]);
  const create = useMutation({
    mutationFn: componentApi.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['components'] });
      onComplete();
    },
  });
  function buildDraft(): ComponentDraft {
    return {
      identity: {
        name: name.trim(),
        ...(manufacturer.trim() ? { manufacturer: manufacturer.trim() } : {}),
        ...(partNumber.trim() ? { part_number: partNumber.trim() } : {}),
      },
      classification: { category, abstraction },
      provenance: { datasheets: [], field_evidence: [] },
      pins: parseArray('Pins', sections.pins),
      ports: parseArray('Ports and power', sections.ports),
      resources: parseArray('Resources', sections.resources),
      address_capabilities: parseArray('Address capabilities', sections.addresses),
      notes: parseArray('Notes', sections.notes),
      revision_notes: revisionNotes.trim(),
    };
  }
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    try {
      const definition = buildDraft();
      const preview = {
        ...definition,
        schema_version: 'hwsd.component/1',
        component_id: 'CMP-PREVIEW',
        revision: 1,
        lifecycle: { status: 'PENDING_ADMIN_VERIFICATION' },
        provenance: { ...definition.provenance, origin: 'MANUAL' },
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      };
      const schema = validateComponentSchema(preview);
      const validationIssues = schema.valid
        ? validateComponentSemantics(schema.value).issues
        : schema.issues;
      if (validationIssues.length) {
        setIssues(validationIssues.map((issue) => `${issue.path}: ${issue.message}`));
        return;
      }
      setIssues([]);
      create.mutate(definition);
    } catch (error) {
      setIssues([error instanceof Error ? error.message : 'The form is invalid.']);
    }
  }
  return (
    <>
      <p className="eyebrow">Manual authoring</p>
      <h1>Define a component.</h1>
      <form className="component-form" onSubmit={submit}>
        <fieldset>
          <legend>Identity and classification</legend>
          <div className="form-grid">
            <label>
              Name
              <input required value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              Manufacturer
              <input
                value={manufacturer}
                onChange={(event) => setManufacturer(event.target.value)}
              />
            </label>
            <label>
              Part number
              <input value={partNumber} onChange={(event) => setPartNumber(event.target.value)} />
            </label>
            <label>
              Category
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as typeof category)}
              >
                <option>CUSTOM_COMPONENT</option>
                <option>MICROCONTROLLER</option>
                <option>SENSOR</option>
                <option>ACTUATOR</option>
                <option>GENERIC_IC</option>
                <option>GENERIC_MODULE</option>
                <option>GENERIC_BOARD</option>
              </select>
            </label>
            <label>
              Abstraction
              <select
                value={abstraction}
                onChange={(event) => setAbstraction(event.target.value as typeof abstraction)}
              >
                <option>CUSTOM</option>
                <option>RAW_IC</option>
                <option>MODULE</option>
                <option>FINISHED_SENSOR</option>
                <option>BOARD</option>
                <option>SYSTEM</option>
              </select>
            </label>
          </div>
        </fieldset>
        {(
          [
            ['pins', 'Pins'],
            ['ports', 'Ports and power'],
            ['resources', 'Resources and mappings'],
            ['addresses', 'Address capabilities'],
            ['notes', 'Engineering notes'],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label} (JSON array)
            <textarea
              rows={5}
              value={sections[key]}
              onChange={(event) =>
                setSections((current) => ({ ...current, [key]: event.target.value }))
              }
            />
          </label>
        ))}
        <label>
          Revision notes
          <textarea
            required
            rows={3}
            value={revisionNotes}
            onChange={(event) => setRevisionNotes(event.target.value)}
          />
        </label>
        <section
          className={issues.length ? 'validation-summary invalid' : 'validation-summary'}
          aria-live="polite"
        >
          <h2>Validation summary</h2>
          {issues.length ? (
            <ul>
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : (
            <p>Complete the form, then submit to run schema and semantic validation.</p>
          )}
        </section>
        {create.isError ? (
          <p className="form-error" role="alert">
            {create.error instanceof ApiError
              ? create.error.message
              : 'The component could not be submitted.'}
          </p>
        ) : null}
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onComplete}>
            Cancel
          </button>
          <button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Submitting…' : 'Validate and submit'}
          </button>
        </div>
      </form>
    </>
  );
}

export function ReviewQueue() {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<ComponentListItem | null>(null);
  const queue = useQuery({ queryKey: ['component-reviews'], queryFn: componentApi.reviewQueue });
  const review = useMutation({
    mutationFn: ({ item, action }: { item: ComponentListItem; action: ComponentReviewAction }) =>
      componentApi.review(item.componentId, item.latestRevision, {
        action,
        note: notes[item.componentId] ?? '',
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['component-reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['components'] }),
      ]);
    },
  });
  return (
    <>
      <p className="eyebrow">Administrator workflow</p>
      <h1>Component review queue.</h1>
      <p className="lede">
        Every decision creates a new immutable revision and a complete audit record.
      </p>
      {queue.isPending ? <p>Loading review queue…</p> : null}
      {queue.isError ? <p className="form-error">The review queue could not be loaded.</p> : null}
      <div className="review-list">
        {queue.data?.items.map((item) => (
          <article className="review-card" key={item.componentId}>
            <div>
              <span className="status-badge">Revision {item.latestRevision}</span>
              <h2>{item.name}</h2>
              <p>
                {item.manufacturer ?? 'Unknown manufacturer'} · submitted by {item.submittedBy}
              </p>
            </div>
            <label>
              Decision note
              <textarea
                value={notes[item.componentId] ?? ''}
                onChange={(event) =>
                  setNotes((current) => ({ ...current, [item.componentId]: event.target.value }))
                }
              />
            </label>
            <div className="review-actions">
              <button className="secondary-button" type="button" onClick={() => setSelected(item)}>
                Compare revisions
              </button>
              {(['APPROVE', 'REQUEST_REVISION', 'REJECT', 'DEPRECATE', 'DISABLE'] as const).map(
                (action) => (
                  <button
                    className={action === 'APPROVE' ? '' : 'secondary-button'}
                    type="button"
                    key={action}
                    disabled={review.isPending || !notes[item.componentId]?.trim()}
                    onClick={() => review.mutate({ item, action })}
                  >
                    {action.replaceAll('_', ' ')}
                  </button>
                ),
              )}
            </div>
          </article>
        ))}
      </div>
      {queue.data?.items.length === 0 ? (
        <section className="empty-state">
          <h2>Queue clear</h2>
          <p>No component revisions are waiting for administrator verification.</p>
        </section>
      ) : null}
      {review.isError ? (
        <p className="form-error" role="alert">
          The review decision could not be published.
        </p>
      ) : null}
      {selected ? <ReviewComparison item={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}

function ReviewComparison({
  item,
  onClose,
}: {
  readonly item: ComponentListItem;
  readonly onClose: () => void;
}) {
  const current = useQuery({
    queryKey: ['component', item.componentId, item.latestRevision],
    queryFn: () => componentApi.revision(item.componentId, item.latestRevision),
  });
  const previous = useQuery({
    queryKey: ['component', item.componentId, item.latestRevision - 1],
    queryFn: () => componentApi.revision(item.componentId, item.latestRevision - 1),
    enabled: item.latestRevision > 1,
  });
  return (
    <section className="detail-panel" aria-labelledby="comparison-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Immutable revision comparison</p>
          <h2 id="comparison-title">{item.name}</h2>
        </div>
        <button className="secondary-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="revision-comparison">
        <div>
          <h3>
            {item.latestRevision > 1 ? `Revision ${item.latestRevision - 1}` : 'No predecessor'}
          </h3>
          {item.latestRevision === 1 ? <p>This is the first published revision.</p> : null}
          {previous.isPending ? <p>Loading predecessor...</p> : null}
          {previous.data ? <pre>{JSON.stringify(previous.data.definition, null, 2)}</pre> : null}
        </div>
        <div>
          <h3>Submitted revision {item.latestRevision}</h3>
          {current.isPending ? <p>Loading submission...</p> : null}
          {current.data ? <pre>{JSON.stringify(current.data.definition, null, 2)}</pre> : null}
        </div>
      </div>
    </section>
  );
}

export function AuthenticatedShell({ user }: { readonly user: AuthenticatedUser }) {
  const queryClient = useQueryClient();
  const [screen, setScreen] = useState<Screen>('projects');
  const [projectId, setProjectId] = useState<string | null>(null);
  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => queryClient.setQueryData<SessionResponse | null>(sessionKey, null),
  });
  const navigate = (target: Screen) => () => setScreen(target);
  return (
    <div className="app-shell">
      <header className="app-header">
        <Brand />
        <div className="account-menu">
          <span>
            {user.displayName} <small>{user.role}</small>
          </span>
          <button type="button" className="secondary-button" onClick={() => logout.mutate()}>
            Sign out
          </button>
          {logout.isError ? <span className="form-error">Sign out failed.</span> : null}
        </div>
      </header>
      <aside className="sidebar" aria-label="Primary navigation">
        <nav>
          <button
            type="button"
            className="nav-button"
            aria-current={screen === 'projects' || screen === 'project-editor' ? 'page' : undefined}
            onClick={navigate('projects')}
          >
            Projects
          </button>
          <button
            type="button"
            className="nav-button"
            aria-current={
              screen === 'components' || screen === 'new-component' ? 'page' : undefined
            }
            onClick={navigate('components')}
          >
            Components
          </button>
          <button
            type="button"
            className="nav-button"
            aria-current={screen === 'datasheets' ? 'page' : undefined}
            onClick={navigate('datasheets')}
          >
            Datasheets
          </button>
          {user.role === 'ADMIN' ? (
            <button
              type="button"
              className="nav-button"
              aria-current={screen === 'review' ? 'page' : undefined}
              onClick={navigate('review')}
            >
              Review queue
            </button>
          ) : null}
        </nav>
      </aside>
      <main className="workspace">
        {screen === 'projects' ? (
          <ProjectDashboard
            onOpen={(selectedProjectId) => {
              setProjectId(selectedProjectId);
              setScreen('project-editor');
            }}
          />
        ) : null}
        {screen === 'project-editor' && projectId ? (
          <ProjectEditor projectId={projectId} onBack={navigate('projects')} />
        ) : null}
        {screen === 'components' ? <ComponentLibrary onCreate={navigate('new-component')} /> : null}
        {screen === 'new-component' ? (
          <ComponentAuthoring onComplete={navigate('components')} />
        ) : null}
        {screen === 'datasheets' ? <DatasheetImports /> : null}
        {screen === 'review' && user.role === 'ADMIN' ? <ReviewQueue /> : null}
      </main>
    </div>
  );
}

export function App() {
  const session = useQuery({ queryKey: sessionKey, queryFn: authApi.current, retry: false });
  if (session.isPending)
    return (
      <main className="centered-state" aria-busy="true">
        Checking your secure session…
      </main>
    );
  if (session.isError && !(session.error instanceof ApiError && session.error.status === 401))
    return (
      <main className="centered-state" role="alert">
        <section className="auth-card">
          <p className="eyebrow">Service unavailable</p>
          <h1>We could not verify your session.</h1>
          <p>Check the API connection, then try again.</p>
          <button type="button" onClick={() => void session.refetch()}>
            Try again
          </button>
        </section>
      </main>
    );
  return session.data ? <AuthenticatedShell user={session.data.user} /> : <LoginScreen />;
}

import { API_VERSION, CONTRACT_VERSIONS, SYSTEM_NAME } from '@hwsd/shared';

const foundations = [
  ['Web application', 'React shell ready'],
  ['API contract', `${API_VERSION} baseline`],
  ['Engineering rules', CONTRACT_VERSIONS.ruleset],
  ['Project format', CONTRACT_VERSIONS.project],
] as const;

export function App() {
  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label={`${SYSTEM_NAME} home`}>
          <span className="brand-mark" aria-hidden="true">
            HS
          </span>
          <span>{SYSTEM_NAME}</span>
        </a>
        <span className="phase">Implementation foundation</span>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">M1 · Contract and validation foundation</p>
          <h1 id="page-title">A dependable foundation for engineering decisions.</h1>
          <p className="lede">
            The workspace, runtime boundaries, and V1 contracts are ready. Product workflows will be
            introduced milestone by milestone without bypassing the approved specifications.
          </p>
        </div>

        <aside className="status-card" aria-labelledby="foundation-status">
          <div className="status-heading">
            <h2 id="foundation-status">Foundation status</h2>
            <span className="status-badge">Ready</span>
          </div>
          <dl>
            {foundations.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <footer>
        V1 contracts now validate consistently across the browser and API. No engineering result is
        inferred by this shell.
      </footer>
    </main>
  );
}

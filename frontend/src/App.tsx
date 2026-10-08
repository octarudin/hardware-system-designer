import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { SYSTEM_NAME, type AuthenticatedUser, type SessionResponse } from '@hwsd/shared';

import { ApiError, authApi } from './auth-api.js';

const sessionKey = ['session'] as const;

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
    onSuccess: (session) => queryClient.setQueryData(sessionKey, session),
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

export function AuthenticatedShell({ user }: { readonly user: AuthenticatedUser }) {
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => queryClient.setQueryData<SessionResponse | null>(sessionKey, null),
  });

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
          {logout.isError ? (
            <span className="form-error" role="alert">
              Sign out failed.
            </span>
          ) : null}
        </div>
      </header>
      <aside className="sidebar" aria-label="Primary navigation">
        <nav>
          <a href="#projects" aria-current="page">
            Projects
          </a>
          <a href="#components">Components</a>
          <a href="#datasheets">Datasheets</a>
          {user.role === 'ADMIN' ? <a href="#review">Review queue</a> : null}
        </nav>
      </aside>
      <main className="workspace" id="projects">
        <p className="eyebrow">M2 · Authenticated application shell</p>
        <h1>Welcome back, {user.displayName}.</h1>
        <p className="lede">
          Your session and role are active. Project workflows arrive in M4; component workflows
          arrive in M3.
        </p>
        <section className="empty-state" aria-labelledby="workspace-status">
          <h2 id="workspace-status">Workspace ready</h2>
          <p>Identity and authorization checks now protect every upcoming business workflow.</p>
        </section>
      </main>
    </div>
  );
}

export function App() {
  const session = useQuery({
    queryKey: sessionKey,
    queryFn: authApi.current,
    retry: false,
  });

  if (session.isPending) {
    return (
      <main className="centered-state" aria-busy="true">
        Checking your secure session…
      </main>
    );
  }
  if (session.isError && !(session.error instanceof ApiError && session.error.status === 401)) {
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
  }
  return session.data ? <AuthenticatedShell user={session.data.user} /> : <LoginScreen />;
}

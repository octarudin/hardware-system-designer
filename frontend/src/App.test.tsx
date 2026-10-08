import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { AuthenticatedShell, LoginScreen } from './App.js';

function render(view: ReactNode): string {
  const client = new QueryClient();
  return renderToStaticMarkup(<QueryClientProvider client={client}>{view}</QueryClientProvider>);
}

describe('M2 application shell', () => {
  it('renders an accessible login form', () => {
    const markup = render(<LoginScreen />);
    expect(markup).toContain('Secure session');
    expect(markup).toContain('autoComplete="username"');
    expect(markup).toContain('autoComplete="current-password"');
  });

  it('shows admin navigation only to administrators', () => {
    const baseUser = {
      userId: 'USR-TEST',
      email: 'user@example.com',
      displayName: 'Engineer',
      role: 'USER' as const,
    };
    expect(render(<AuthenticatedShell user={baseUser} />)).not.toContain('Review queue');
    expect(render(<AuthenticatedShell user={{ ...baseUser, role: 'ADMIN' }} />)).toContain(
      'Review queue',
    );
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { AuthenticatedShell, ComponentAuthoring, LoginScreen, ReviewQueue } from './App.js';
import { DatasheetImports } from './datasheet-ui.js';
import { ProjectDashboard } from './projects-ui.js';

function render(view: ReactNode, prepare?: (client: QueryClient) => void): string {
  const client = new QueryClient();
  prepare?.(client);
  return renderToStaticMarkup(<QueryClientProvider client={client}>{view}</QueryClientProvider>);
}

describe('authenticated application shell', () => {
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

  it('exposes every required manual component section and validation summary', () => {
    const markup = render(<ComponentAuthoring onComplete={() => undefined} />);

    for (const label of [
      'Identity and classification',
      'Pins',
      'Ports and power',
      'Resources and mappings',
      'Address capabilities',
      'Engineering notes',
      'Validation summary',
    ]) {
      expect(markup).toContain(label);
    }
  });

  it('renders revision comparison and lifecycle actions for an admin review item', () => {
    const markup = render(<ReviewQueue />, (client) =>
      client.setQueryData(['component-reviews'], {
        items: [
          {
            componentId: 'CMP-TEST',
            name: 'Test component',
            manufacturer: 'HWSD',
            partNumber: 'T-1',
            category: 'GENERIC_BOARD',
            abstraction: 'BOARD',
            lifecycleStatus: 'PENDING_ADMIN_VERIFICATION',
            latestRevision: 2,
            hasDatasheet: false,
            updatedAt: '2026-10-08T00:00:00.000Z',
            submittedBy: 'USR-AUTHOR',
            submittedAt: '2026-10-08T00:00:00.000Z',
          },
        ],
      }),
    );

    expect(markup).toContain('Compare revisions');
    expect(markup).toContain('APPROVE');
    expect(markup).toContain('REQUEST REVISION');
    expect(markup).toContain('DISABLE');
  });

  it('renders dashboard actions and persisted project metadata', () => {
    const markup = render(<ProjectDashboard onOpen={() => undefined} />, (client) =>
      client.setQueryData(['projects', ''], {
        items: [
          {
            projectId: 'PROJ-TEST',
            name: 'Controller design',
            description: 'Persistent project',
            documentRevision: 3,
            engineeringRevision: 2,
            updatedAt: '2026-10-08T00:00:00.000Z',
            designCheck: null,
          },
        ],
      }),
    );

    expect(markup).toContain('New Project');
    expect(markup).toContain('Import .txt');
    expect(markup).toContain('Controller design');
    expect(markup).toContain('Revision 3');
    expect(markup).toContain('Export');
    expect(markup).toContain('Delete');
  });

  it('renders distinct reviewable datasheet candidates with provenance workflow controls', () => {
    const markup = render(<DatasheetImports />, (client) =>
      client.setQueryData(['datasheet-imports'], {
        items: [
          {
            importId: 'IMPORT-TEST',
            datasheetId: 'DS-TEST',
            filename: 'dual-device.pdf',
            byteSize: 2048,
            pageCount: 4,
            sha256: 'a'.repeat(64),
            status: 'REVIEW_REQUIRED',
            modelName: 'gpt-5.4-mini-test',
            attemptCount: 1,
            maxAttempts: 3,
            requestedAt: '2026-10-09T00:00:00.000Z',
            startedAt: '2026-10-09T00:00:01.000Z',
            completedAt: '2026-10-09T00:00:02.000Z',
            errorCode: null,
            errorMessage: null,
            candidates: [
              {
                candidateId: 'CAND-ONE',
                ordinal: 1,
                detectedLabel: 'Sensor A',
                overallConfidence: 0.9,
                status: 'DETECTED',
                document: {},
                publishedComponentId: null,
                publishedRevision: null,
              },
              {
                candidateId: 'CAND-TWO',
                ordinal: 2,
                detectedLabel: 'Sensor B',
                overallConfidence: 0.8,
                status: 'SELECTED',
                document: {},
                publishedComponentId: null,
                publishedRevision: null,
              },
            ],
          },
        ],
      }),
    );

    expect(markup).toContain('dual-device.pdf');
    expect(markup).toContain('Sensor A');
    expect(markup).toContain('Sensor B');
    expect(markup).toContain('Review');
    expect(markup).toContain('Reject');
  });
});

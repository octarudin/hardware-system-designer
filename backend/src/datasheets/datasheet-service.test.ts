import { describe, expect, it } from 'vitest';

import type {
  AuthenticatedUser,
  ComponentDraft,
  ComponentListResponse,
  ComponentReviewQueueResponse,
  DatasheetImportResponse,
} from '@hwsd/shared';

import { ComponentService } from '../components/component-service.js';
import type {
  ComponentRepository,
  Publication,
  StoredComponentRevision,
} from '../components/types.js';
import { DatasheetService } from './datasheet-service.js';
import type { DatasheetRepository, ObjectStore } from './types.js';

const user: AuthenticatedUser = {
  userId: 'USR-ENGINEER',
  email: 'engineer@example.com',
  displayName: 'Engineer',
  role: 'USER',
};

const trustedDatasheet = {
  datasheet_id: 'DS-TRUSTED',
  filename: 'trusted.pdf',
  media_type: 'application/pdf' as const,
  byte_size: 512,
  storage_ref: 'datasheets/trusted.pdf',
  sha256: 'a'.repeat(64),
  page_count: 1,
  uploaded_at: '2026-10-09T00:00:00.000Z',
};

function draft(datasheetId = 'DS-TAMPERED'): ComponentDraft {
  return {
    identity: { name: 'Reviewed sensor' },
    classification: { category: 'SENSOR', abstraction: 'RAW_IC' },
    provenance: {
      datasheets: [{ ...trustedDatasheet, datasheet_id: datasheetId }],
      field_evidence: [
        { field: '/identity/name', datasheet_id: datasheetId, pages: [1], confidence: 0.9 },
      ],
    },
    pins: [],
    ports: [],
    resources: [],
    address_capabilities: [],
    notes: [],
    revision_notes: 'Human-reviewed extraction',
  };
}

class ComponentMemory implements ComponentRepository {
  public publication: Publication | undefined;
  public async list(): Promise<ComponentListResponse> {
    return { items: [], page: 1, pageSize: 24, total: 0 };
  }
  public async listReviewQueue(): Promise<ComponentReviewQueueResponse> {
    return { items: [] };
  }
  public async getRevision() {
    return null;
  }
  public async getLatest() {
    return null;
  }
  public async publish(publication: Publication): Promise<StoredComponentRevision> {
    this.publication = publication;
    return {
      definition: publication.definition,
      createdBy: publication.actorUserId,
      createdAt: new Date('2026-10-09T00:00:00.000Z'),
    };
  }
}

class DatasheetMemory implements DatasheetRepository {
  public async createImport() {}
  public async list(): Promise<readonly DatasheetImportResponse[]> {
    return [];
  }
  public async get() {
    return null;
  }
  public async getCandidate() {
    return {
      candidateId: 'CAND-TEST',
      importId: 'IMPORT-TEST',
      document: draft('DS-TRUSTED'),
      status: 'SELECTED' as const,
      modelName: 'gpt-5.4-mini-test',
      datasheet: trustedDatasheet,
    };
  }
  public async updateCandidate() {
    return true;
  }
  public async retry() {
    return true;
  }
}

const objects: ObjectStore = {
  put: async () => undefined,
  signedDownload: async () => 'https://example.invalid/signed',
};

function setup() {
  const components = new ComponentMemory();
  const componentService = new ComponentService(
    components,
    { now: () => new Date('2026-10-09T00:00:00.000Z') },
    { componentId: () => 'CMP-AI-TEST' },
  );
  return {
    components,
    service: new DatasheetService(new DatasheetMemory(), objects, componentService),
  };
}

describe('datasheet candidate publication', () => {
  it('rejects evidence that points outside the authorized source import', async () => {
    const { components, service } = setup();

    await expect(service.publishCandidate('CAND-TEST', user, draft())).rejects.toMatchObject({
      statusCode: 422,
      code: 'DATASHEET_EVIDENCE_SOURCE_INVALID',
    });
    expect(components.publication).toBeUndefined();
  });

  it('binds publication to server-trusted datasheet metadata', async () => {
    const { components, service } = setup();
    const source = draft('DS-TRUSTED');
    const submitted: ComponentDraft = {
      ...source,
      provenance: {
        ...source.provenance,
        datasheets: [{ ...trustedDatasheet, storage_ref: 'datasheets/tampered.pdf' }],
      },
    };

    await service.publishCandidate('CAND-TEST', user, submitted);

    expect(components.publication?.definition.provenance).toMatchObject({
      origin: 'AI_DATASHEET_EXTRACTION',
      datasheets: [trustedDatasheet],
    });
  });
});

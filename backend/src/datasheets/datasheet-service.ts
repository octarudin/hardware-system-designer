import { createHash, randomBytes } from 'node:crypto';

import type {
  AuthenticatedUser,
  ComponentDraft,
  UpdateDatasheetCandidateRequest,
  UploadDatasheetRequest,
} from '@hwsd/shared';

import type { ComponentService } from '../components/component-service.js';
import { ApplicationError } from '../errors.js';
import { validatePdf } from './pdf.js';
import type { DatasheetIds, DatasheetRepository, ObjectStore } from './types.js';

const ids: DatasheetIds = {
  datasheetId: () => `DS-${randomBytes(12).toString('hex').toUpperCase()}`,
  importId: () => `IMPORT-${randomBytes(12).toString('hex').toUpperCase()}`,
};

export class DatasheetService {
  public constructor(
    private readonly repository: DatasheetRepository,
    private readonly objects: ObjectStore,
    private readonly components: ComponentService,
    private readonly generatedIds: DatasheetIds = ids,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async upload(user: AuthenticatedUser, request: UploadDatasheetRequest) {
    if (request.mediaType !== 'application/pdf')
      throw new ApplicationError(
        415,
        'DATASHEET_MEDIA_TYPE_INVALID',
        'Only application/pdf uploads are accepted.',
      );
    const filename = request.filename.trim();
    if (
      !filename ||
      filename.length > 255 ||
      !filename.toLowerCase().endsWith('.pdf') ||
      filename.includes('\\') ||
      filename.includes('/') ||
      [...filename].some((character) => character.codePointAt(0)! < 32)
    )
      throw new ApplicationError(
        400,
        'DATASHEET_FILENAME_INVALID',
        'Provide a safe PDF filename without path characters.',
      );
    if (
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(
        request.contentBase64,
      )
    )
      throw new ApplicationError(
        400,
        'DATASHEET_ENCODING_INVALID',
        'The uploaded file encoding is invalid.',
      );
    const bytes = Buffer.from(request.contentBase64, 'base64');
    const pageCount = await validatePdf(bytes);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const objectKey = `datasheets/${sha256}.pdf`;
    await this.objects.put(objectKey, bytes, 'application/pdf');
    const importId = this.generatedIds.importId();
    await this.repository.createImport(
      {
        datasheetId: this.generatedIds.datasheetId(),
        filename,
        mediaType: 'application/pdf',
        byteSize: bytes.byteLength,
        pageCount,
        sha256,
        objectKey,
        uploadedBy: user.userId,
      },
      importId,
    );
    return this.requireImport(importId, user);
  }

  public async list(user: AuthenticatedUser) {
    return { items: await this.repository.list(user) };
  }

  public get(importId: string, user: AuthenticatedUser) {
    return this.requireImport(importId, user);
  }

  public async download(importId: string, user: AuthenticatedUser) {
    const item = await this.requireImport(importId, user);
    const expiresInSeconds = 300;
    return {
      url: await this.objects.signedDownload(
        `datasheets/${item.sha256}.pdf`,
        item.filename,
        expiresInSeconds,
      ),
      expiresAt: new Date(this.now().getTime() + expiresInSeconds * 1000).toISOString(),
    };
  }

  public async updateCandidate(
    candidateId: string,
    user: AuthenticatedUser,
    request: UpdateDatasheetCandidateRequest,
  ) {
    if (
      request.document !== undefined &&
      (!request.document || typeof request.document !== 'object' || Array.isArray(request.document))
    )
      throw new ApplicationError(
        400,
        'DATASHEET_CANDIDATE_DOCUMENT_INVALID',
        'The candidate document must be a JSON object.',
      );
    const changed = await this.repository.updateCandidate(
      candidateId,
      user,
      request.status,
      request.document,
    );
    if (!changed)
      throw new ApplicationError(
        404,
        'DATASHEET_CANDIDATE_NOT_FOUND',
        'The datasheet candidate was not found.',
      );
    const candidate = await this.repository.getCandidate(candidateId, user);
    return this.requireImport(candidate!.importId, user);
  }

  public async publishCandidate(
    candidateId: string,
    user: AuthenticatedUser,
    definition: ComponentDraft,
  ) {
    const candidate = await this.repository.getCandidate(candidateId, user);
    if (!candidate)
      throw new ApplicationError(
        404,
        'DATASHEET_CANDIDATE_NOT_FOUND',
        'The datasheet candidate was not found.',
      );
    if (!['DETECTED', 'SELECTED'].includes(candidate.status))
      throw new ApplicationError(
        409,
        'DATASHEET_CANDIDATE_NOT_PUBLISHABLE',
        'The datasheet candidate is no longer publishable.',
      );
    if (!candidate.modelName)
      throw new ApplicationError(
        409,
        'DATASHEET_EXTRACTION_INCOMPLETE',
        'The extraction model record is missing.',
      );
    const mismatchedEvidence = definition.provenance.field_evidence.some(
      ({ datasheet_id }) => datasheet_id && datasheet_id !== candidate.datasheet.datasheet_id,
    );
    if (mismatchedEvidence)
      throw new ApplicationError(
        422,
        'DATASHEET_EVIDENCE_SOURCE_INVALID',
        'Candidate evidence must refer to the source datasheet for this import.',
      );
    const trustedDefinition: ComponentDraft = {
      ...definition,
      provenance: {
        datasheets: [candidate.datasheet],
        field_evidence: definition.provenance.field_evidence.map((evidence) => ({
          ...evidence,
          ...(evidence.datasheet_id ? { datasheet_id: candidate.datasheet.datasheet_id } : {}),
        })),
      },
    };
    return this.components.createFromCandidate(
      user,
      candidateId,
      trustedDefinition,
      candidate.modelName,
    );
  }

  public async retry(importId: string, user: AuthenticatedUser) {
    if (!(await this.repository.retry(importId, user)))
      throw new ApplicationError(
        409,
        'DATASHEET_IMPORT_NOT_RETRYABLE',
        'The import cannot be retried in its current state.',
      );
    return this.requireImport(importId, user);
  }

  private async requireImport(importId: string, user: AuthenticatedUser) {
    const item = await this.repository.get(importId, user);
    if (!item)
      throw new ApplicationError(
        404,
        'DATASHEET_IMPORT_NOT_FOUND',
        'The datasheet import was not found.',
      );
    return item;
  }
}

import type {
  ComponentDraft,
  DatasheetExtractionResult,
  ExtractedComponentCandidate,
} from '@hwsd/shared';

export interface SourceDatasheet {
  readonly datasheetId: string;
  readonly filename: string;
  readonly byteSize: number;
  readonly sha256: string;
  readonly objectKey: string;
  readonly pageCount: number;
  readonly uploadedAt: string;
}

export interface NormalizedCandidate {
  readonly label: string;
  readonly confidence: number;
  readonly document: ComponentDraft;
}

function normalizeCandidate(
  candidate: ExtractedComponentCandidate,
  source: SourceDatasheet,
): NormalizedCandidate {
  const identity = {
    name: candidate.name.trim(),
    ...(candidate.manufacturer?.trim() ? { manufacturer: candidate.manufacturer.trim() } : {}),
    ...(candidate.partNumber?.trim() ? { part_number: candidate.partNumber.trim() } : {}),
  };
  if (!identity.name) throw new Error('CANDIDATE_NAME_MISSING');
  return {
    label: candidate.label.trim() || identity.name,
    confidence: Math.min(1, Math.max(0, candidate.confidence)),
    document: {
      identity,
      classification: {
        category: candidate.category,
        abstraction: candidate.abstraction,
      },
      provenance: {
        datasheets: [
          {
            datasheet_id: source.datasheetId,
            filename: source.filename,
            media_type: 'application/pdf',
            byte_size: source.byteSize,
            storage_ref: source.objectKey,
            sha256: source.sha256,
            page_count: source.pageCount,
            uploaded_at: source.uploadedAt,
          },
        ],
        field_evidence: candidate.claims.map((claim) => ({
          field: claim.field,
          confidence: claim.confidence,
          datasheet_id: source.datasheetId,
          pages: [claim.page],
          source_excerpt: claim.sourceExcerpt,
          reviewer_note: `Extracted value: ${claim.value}`,
        })),
      },
      pins: [],
      ports: [],
      resources: [],
      address_capabilities: [],
      notes: [],
      revision_notes: 'AI-assisted datasheet extraction; requires human review.',
    },
  };
}

export function normalizeCandidates(
  result: DatasheetExtractionResult,
  source: SourceDatasheet,
): readonly NormalizedCandidate[] {
  if (
    !Array.isArray(result.candidates) ||
    result.candidates.length < 1 ||
    result.candidates.length > 20
  )
    throw new Error('CANDIDATE_COUNT_INVALID');
  return result.candidates.map((candidate) => normalizeCandidate(candidate, source));
}

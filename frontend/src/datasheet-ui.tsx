import { useMemo, useState, type ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ComponentDraft,
  type DatasheetCandidateSummary,
  validateComponentSchema,
  validateComponentSemantics,
} from '@hwsd/shared';

import { ApiError } from './auth-api.js';
import { datasheetApi } from './datasheet-api.js';
import { bytesToBase64 } from './project-api.js';

const stages = [
  'Uploading',
  'Validating PDF',
  'Extracting text/data',
  'Detecting candidates',
  'Preparing review',
] as const;

const reviewSteps = [
  'Identity and classification',
  'Power',
  'Pins and alternate functions',
  'Ports and interfaces',
  'Resources and mappings',
  'Addresses and protocols',
  'Evidence, confidence, and notes',
  'Validation and submission',
] as const;

function validateDraft(value: unknown): readonly string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return ['Draft must be an object.'];
  const draft = value as ComponentDraft;
  const preview = {
    ...draft,
    schema_version: 'hwsd.component/1',
    component_id: 'CMP-PREVIEW',
    revision: 1,
    lifecycle: { status: 'PENDING_ADMIN_VERIFICATION' },
    provenance: {
      ...draft.provenance,
      origin: 'AI_DATASHEET_EXTRACTION',
      extracted_at: '2026-01-01T00:00:00.000Z',
      extraction_model: 'preview',
    },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
  const schema = validateComponentSchema(preview);
  if (!schema.valid) return schema.issues.map(({ path, message }) => `${path}: ${message}`);
  return validateComponentSemantics(schema.value).issues.map(
    ({ path, message }) => `${path}: ${message}`,
  );
}

function CandidateReview({
  candidate,
  onClose,
}: {
  readonly candidate: DatasheetCandidateSummary;
  readonly onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [source, setSource] = useState(() => JSON.stringify(candidate.document, null, 2));
  const [parseError, setParseError] = useState('');
  const parsed = useMemo(() => {
    try {
      const value = JSON.parse(source) as unknown;
      return { value, issues: validateDraft(value) };
    } catch {
      return { value: null, issues: ['Candidate JSON is invalid.'] };
    }
  }, [source]);
  const save = useMutation({
    mutationFn: () =>
      datasheetApi.updateCandidate(candidate.candidateId, {
        status: 'SELECTED',
        document: parsed.value,
      }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['datasheet-imports'] }),
  });
  const publish = useMutation({
    mutationFn: () =>
      datasheetApi.publishCandidate(candidate.candidateId, {
        definition: parsed.value as ComponentDraft,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['datasheet-imports'] });
      await queryClient.invalidateQueries({ queryKey: ['components'] });
      onClose();
    },
  });
  const evidence =
    parsed.value && typeof parsed.value === 'object' && 'provenance' in parsed.value
      ? ((parsed.value as ComponentDraft).provenance?.field_evidence ?? [])
      : [];

  return (
    <section className="candidate-review" aria-labelledby="candidate-review-title">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Candidate review</p>
          <h2 id="candidate-review-title">{candidate.detectedLabel ?? candidate.candidateId}</h2>
        </div>
        <button className="secondary-button" onClick={onClose}>
          Close
        </button>
      </div>
      <nav className="review-steps" aria-label="Candidate review steps">
        {reviewSteps.map((label, index) => (
          <button
            key={label}
            className={step === index ? 'active' : 'secondary-button'}
            onClick={() => setStep(index)}
          >
            {index + 1}. {label}
          </button>
        ))}
      </nav>
      <p>
        Step {step + 1}: <strong>{reviewSteps[step]}</strong>. Extracted values remain editable and
        require human approval.
      </p>
      {step === 6 ? (
        <ul className="evidence-list">
          {evidence.map((item, index) => (
            <li key={`${item.field}:${index}`}>
              <strong>{item.field}</strong> · confidence {Math.round((item.confidence ?? 0) * 100)}%
              {item.pages?.length ? ` · page ${item.pages.join(', ')}` : ''}
              {item.source_excerpt ? <blockquote>{item.source_excerpt}</blockquote> : null}
            </li>
          ))}
          {!evidence.length ? <li>No extraction evidence was supplied.</li> : null}
        </ul>
      ) : null}
      <label>
        Candidate definition (Component Draft V1 JSON)
        <textarea
          className="candidate-json"
          rows={20}
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            setParseError('');
          }}
        />
      </label>
      <section
        className={parsed.issues.length ? 'validation-summary invalid' : 'validation-summary'}
      >
        <h3>Validation summary</h3>
        {parsed.issues.length ? (
          <ul>
            {parsed.issues.slice(0, 20).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p>
            Structural and semantic validation passed. Submission creates an unverified revision.
          </p>
        )}
      </section>
      {parseError || save.isError || publish.isError ? (
        <p className="form-error" role="alert">
          {parseError ||
            (save.error instanceof Error ? save.error.message : '') ||
            (publish.error instanceof Error
              ? publish.error.message
              : 'Candidate operation failed.')}
        </p>
      ) : null}
      <div className="form-actions">
        <button
          className="secondary-button"
          disabled={!parsed.value || save.isPending}
          onClick={() => {
            if (!parsed.value) setParseError('Correct the JSON before saving.');
            else save.mutate();
          }}
        >
          Save review
        </button>
        <button
          disabled={parsed.issues.length > 0 || publish.isPending}
          onClick={() => publish.mutate()}
        >
          Submit to component library
        </button>
      </div>
    </section>
  );
}

export function DatasheetImports() {
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState('');
  const [reviewCandidate, setReviewCandidate] = useState<DatasheetCandidateSummary | null>(null);
  const imports = useQuery({
    queryKey: ['datasheet-imports'],
    queryFn: datasheetApi.list,
    refetchInterval: (query) =>
      query.state.data?.items.some(({ status }) => ['QUEUED', 'PROCESSING'].includes(status))
        ? 2_000
        : false,
  });
  const upload = useMutation({
    mutationFn: datasheetApi.upload,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['datasheet-imports'] }),
  });
  const update = useMutation({
    mutationFn: ({
      candidateId,
      status,
    }: {
      candidateId: string;
      status: 'SELECTED' | 'REJECTED';
    }) => datasheetApi.updateCandidate(candidateId, { status }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['datasheet-imports'] }),
  });
  const retry = useMutation({
    mutationFn: datasheetApi.retry,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['datasheet-imports'] }),
  });

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setUploadError('');
    if (!file) return;
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Choose one PDF datasheet.');
      return;
    }
    if (file.size < 1 || file.size > 10 * 1024 * 1024) {
      setUploadError('The PDF must be between 1 byte and 10 MiB.');
      return;
    }
    upload.mutate({
      filename: file.name,
      mediaType: 'application/pdf',
      contentBase64: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
    });
    event.target.value = '';
  }

  if (reviewCandidate)
    return <CandidateReview candidate={reviewCandidate} onClose={() => setReviewCandidate(null)} />;

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">M7 · Evidence pipeline</p>
          <h1>Datasheet imports.</h1>
          <p>PDF only · maximum 10 MiB · maximum 100 pages.</p>
        </div>
        <label className="file-button">
          {upload.isPending ? 'Uploading…' : 'Import PDF'}
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => void chooseFile(event)}
          />
        </label>
      </div>
      {uploadError || upload.isError ? (
        <p className="form-error" role="alert">
          {uploadError ||
            (upload.error instanceof ApiError ? upload.error.message : 'Upload failed.')}
        </p>
      ) : null}
      <div className="import-list">
        {imports.data?.items.map((item) => {
          const stage = item.status === 'QUEUED' ? 1 : item.status === 'PROCESSING' ? 3 : 5;
          return (
            <article className="import-card" key={item.importId}>
              <div className="import-heading">
                <div>
                  <span className={`status-badge status-${item.status.toLowerCase()}`}>
                    {item.status}
                  </span>
                  <h2>{item.filename}</h2>
                  <p>
                    {item.pageCount} pages · {(item.byteSize / 1024).toFixed(1)} KiB
                  </p>
                </div>
                <small>
                  Attempt {item.attemptCount}/{item.maxAttempts}
                </small>
              </div>
              <ol className="import-progress">
                {stages.map((label, index) => (
                  <li key={label} className={index < stage ? 'complete' : ''}>
                    {label}
                  </li>
                ))}
              </ol>
              {item.errorMessage ? <p className="form-error">{item.errorMessage}</p> : null}
              {item.status === 'FAILED' && item.attemptCount < item.maxAttempts ? (
                <button onClick={() => retry.mutate(item.importId)}>Retry</button>
              ) : null}
              <div className="candidate-grid">
                {item.candidates.map((candidate) => (
                  <article className="candidate-card" key={candidate.candidateId}>
                    <span className="status-badge">{candidate.status}</span>
                    <h3>{candidate.detectedLabel ?? `Candidate ${candidate.ordinal}`}</h3>
                    <p>
                      Confidence{' '}
                      {candidate.overallConfidence === null
                        ? 'not supplied'
                        : `${Math.round(candidate.overallConfidence * 100)}%`}
                    </p>
                    {candidate.status === 'PUBLISHED' ? (
                      <p>Published as {candidate.publishedComponentId}</p>
                    ) : (
                      <div className="form-actions">
                        <button
                          className="secondary-button"
                          onClick={() =>
                            update.mutate({
                              candidateId: candidate.candidateId,
                              status: 'REJECTED',
                            })
                          }
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => {
                            if (candidate.status === 'DETECTED')
                              update.mutate({
                                candidateId: candidate.candidateId,
                                status: 'SELECTED',
                              });
                            setReviewCandidate(candidate);
                          }}
                        >
                          Review
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      {imports.data?.items.length === 0 ? (
        <section className="empty-state">
          <h2>No datasheet imports yet</h2>
          <p>Upload a PDF to create reviewable candidates.</p>
        </section>
      ) : null}
    </>
  );
}

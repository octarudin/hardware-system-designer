import { describe, expect, it, vi } from 'vitest';

import { normalizeCandidates, type SourceDatasheet } from './normalizer.js';
import { extractPdfText } from './pdf-extractor.js';
import { OpenAIExtractionProvider } from './provider.js';

const extraction = {
  candidates: [
    {
      label: 'TMP117 sensor',
      name: 'TMP117',
      manufacturer: 'Texas Instruments',
      partNumber: 'TMP117',
      category: 'SENSOR' as const,
      abstraction: 'RAW_IC' as const,
      confidence: 0.97,
      claims: [
        {
          field: '/identity/part_number',
          value: 'TMP117',
          page: 1,
          sourceExcerpt: 'TMP117 High-Accuracy Digital Temperature Sensor',
          confidence: 0.99,
        },
      ],
    },
  ],
};

const source: SourceDatasheet = {
  datasheetId: 'DS-TEST',
  filename: 'tmp117.pdf',
  byteSize: 512,
  sha256: 'a'.repeat(64),
  objectKey: `datasheets/${'a'.repeat(64)}.pdf`,
  pageCount: 1,
  uploadedAt: '2026-10-09T00:00:00.000Z',
};

function minimalPdf(label = 'Test Sensor'): Uint8Array {
  return new TextEncoder().encode(`%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 47 >> stream
BT /F1 12 Tf 72 720 Td (${label}) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
trailer << /Root 1 0 R >>
%%EOF`);
}

describe('datasheet extraction pipeline', () => {
  it('extracts bounded page-marked PDF text', async () => {
    const result = await extractPdfText(minimalPdf());

    expect(result.pageCount).toBe(1);
    expect(result.text).toContain('[Page 1]');
    expect(result.text).toContain('Test Sensor');
  });

  it('maps claims to immutable datasheet provenance without adding engineering values', () => {
    const [candidate] = normalizeCandidates(extraction, source);

    expect(candidate?.document).toMatchObject({
      identity: { name: 'TMP117', part_number: 'TMP117' },
      provenance: {
        datasheets: [{ datasheet_id: 'DS-TEST', sha256: 'a'.repeat(64) }],
        field_evidence: [
          {
            field: '/identity/part_number',
            pages: [1],
            confidence: 0.99,
            source_excerpt: 'TMP117 High-Accuracy Digital Temperature Sensor',
          },
        ],
      },
      pins: [],
      ports: [],
      resources: [],
      address_capabilities: [],
    });
  });

  it('records the provider-resolved model and requests strict, non-stored output', async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        store: boolean;
        text: { format: { strict: boolean } };
      };
      expect(body.store).toBe(false);
      expect(body.text.format.strict).toBe(true);
      return new Response(
        JSON.stringify({
          model: 'gpt-5.4-mini-2026-xx-xx',
          output: [{ content: [{ type: 'output_text', text: JSON.stringify(extraction) }] }],
        }),
      );
    });
    const provider = new OpenAIExtractionProvider(
      'test-key',
      'gpt-5.4-mini',
      'https://example.invalid/v1/responses',
      1_000,
      fetcher,
    );

    await expect(provider.extract('bounded input')).resolves.toMatchObject({
      model: 'gpt-5.4-mini-2026-xx-xx',
      result: extraction,
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('fails closed and does not retry invalid structured output', async () => {
    const fetcher = vi.fn(async () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            output: [{ content: [{ type: 'output_text', text: '{"candidates":[]}' }] }],
          }),
        ),
      ),
    );
    const provider = new OpenAIExtractionProvider(
      'test-key',
      'gpt-5.4-mini',
      'test',
      1_000,
      fetcher,
    );

    await expect(provider.extract('input')).rejects.toThrow('OPENAI_OUTPUT_INVALID');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('does not retry a non-retryable provider response', async () => {
    const fetcher = vi.fn(async () => Promise.resolve(new Response('{}', { status: 400 })));
    const provider = new OpenAIExtractionProvider(
      'test-key',
      'gpt-5.4-mini',
      'test',
      1_000,
      fetcher,
    );

    await expect(provider.extract('input')).rejects.toThrow('OPENAI_HTTP_400');
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

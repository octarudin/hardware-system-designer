import { describe, expect, it } from 'vitest';

import { validatePdf } from './pdf.js';

function minimalPdf(): Uint8Array {
  return new TextEncoder().encode(`%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj
trailer << /Root 1 0 R >>
%%EOF`);
}

describe('secure PDF validation', () => {
  it('accepts a parseable PDF within the V1 page limit', async () => {
    await expect(validatePdf(minimalPdf())).resolves.toBe(1);
  });

  it('rejects extension-spoofed content by signature', async () => {
    await expect(validatePdf(new TextEncoder().encode('not a PDF %%EOF'))).rejects.toMatchObject({
      statusCode: 422,
      code: 'DATASHEET_SIGNATURE_INVALID',
    });
  });

  it('rejects a truncated PDF', async () => {
    await expect(
      validatePdf(new TextEncoder().encode('%PDF-1.4 incomplete')),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DATASHEET_TRUNCATED' });
  });
});

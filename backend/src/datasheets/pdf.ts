import {
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from 'pdfjs-dist/legacy/build/pdf.mjs';

import { ApplicationError } from '../errors.js';

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 100;

export async function validatePdf(bytes: Uint8Array): Promise<number> {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PDF_BYTES)
    throw new ApplicationError(
      413,
      'DATASHEET_SIZE_INVALID',
      'The PDF must be between 1 byte and 10 MiB.',
    );
  if (new TextDecoder('ascii').decode(bytes.subarray(0, 5)) !== '%PDF-')
    throw new ApplicationError(
      422,
      'DATASHEET_SIGNATURE_INVALID',
      'The uploaded file does not have a valid PDF signature.',
    );
  const tail = new TextDecoder('ascii').decode(bytes.subarray(Math.max(0, bytes.length - 2048)));
  if (!tail.includes('%%EOF'))
    throw new ApplicationError(
      422,
      'DATASHEET_TRUNCATED',
      'The uploaded PDF appears to be truncated.',
    );
  let document: PDFDocumentProxy | undefined;
  let task: PDFDocumentLoadingTask | undefined;
  try {
    task = getDocument({ data: bytes.slice() });
    document = await task.promise;
    if (document.numPages < 1 || document.numPages > MAX_PDF_PAGES)
      throw new ApplicationError(
        422,
        'DATASHEET_PAGE_COUNT_INVALID',
        'The PDF must contain between 1 and 100 pages.',
      );
    return document.numPages;
  } catch (error) {
    if (error instanceof ApplicationError) throw error;
    throw new ApplicationError(
      422,
      'DATASHEET_PDF_INVALID',
      'The uploaded PDF could not be parsed safely.',
    );
  } finally {
    await task?.destroy();
  }
}

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export const MAX_PDF_PAGES = 100;
export const MAX_EXTRACTED_CHARACTERS = 200_000;

export interface ExtractedPdf {
  readonly pageCount: number;
  readonly text: string;
}

export async function extractPdfText(bytes: Uint8Array): Promise<ExtractedPdf> {
  const task = getDocument({ data: bytes.slice() });
  const document = await task.promise;
  try {
    if (document.numPages < 1 || document.numPages > MAX_PDF_PAGES)
      throw new Error('PDF_PAGE_COUNT_INVALID');
    const pages: string[] = [];
    let characters = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const content = await (await document.getPage(pageNumber)).getTextContent();
      const text = content.items
        .flatMap((item) => ('str' in item && typeof item.str === 'string' ? [item.str] : []))
        .join(' ')
        .replaceAll(/\s+/gu, ' ')
        .trim();
      const prefix = `[Page ${pageNumber}]\n`;
      const remaining = MAX_EXTRACTED_CHARACTERS - characters - prefix.length;
      if (remaining <= 0) break;
      const bounded = text.slice(0, remaining);
      pages.push(`${prefix}${bounded}`);
      characters += prefix.length + bounded.length + 1;
    }
    const text = pages.join('\n');
    if (!text.trim()) throw new Error('PDF_TEXT_EMPTY');
    return { pageCount: document.numPages, text };
  } finally {
    await task.destroy();
  }
}

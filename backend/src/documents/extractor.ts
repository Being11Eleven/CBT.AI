/* ============================================================
   CBT.AI Backend — Server-Side Document Processor
   PDF extraction using pdfjs-dist (no browser required)
   Supports: PDF, plain text, and image passthrough
   ============================================================ */
import * as fs from 'fs/promises';
import { logger } from '../logging/logger.js';

export interface ExtractedDocument {
  filename: string;
  mimeType: string;
  content: string;
  pageCount?: number;
  byteSize: number;
  extractedAt: number;
}

// ── PDF extraction using pdf.js in Node ────────────────────────
async function extractPDF(buffer: Buffer, filename: string): Promise<ExtractedDocument> {
  try {
    // Dynamically import pdfjs-dist for Node.js compatibility
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    // pdfjs requires a worker or legacy mode; in Node we use legacy without worker
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;

    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: unknown) => (item as { str?: string }).str || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (pageText) {
        pages.push(`[Page ${i}]\n${pageText}`);
      }
    }

    const content = pages.join('\n\n');
    logger.info({ filename, pages: pdf.numPages, chars: content.length }, 'PDF extracted');

    return {
      filename,
      mimeType: 'application/pdf',
      content: content || '[PDF appears to be empty or image-only]',
      pageCount: pdf.numPages,
      byteSize: buffer.byteLength,
      extractedAt: Date.now(),
    };
  } catch (err) {
    logger.error({ filename, err }, 'PDF extraction failed');
    throw new Error(
      `Could not extract text from PDF "${filename}". ` +
      `The file may be scanned (image-only), password-protected, or corrupted. ` +
      `Please upload a text-based PDF or a .txt file instead.`
    );
  }
}

// ── Plain text extraction ───────────────────────────────────────
async function extractText(buffer: Buffer, filename: string, mimeType: string): Promise<ExtractedDocument> {
  const content = buffer.toString('utf-8').replace(/\r\n/g, '\n').trim();
  logger.info({ filename, chars: content.length }, 'Text extracted');
  return {
    filename,
    mimeType,
    content,
    byteSize: buffer.byteLength,
    extractedAt: Date.now(),
  };
}

// ── Dispatcher ─────────────────────────────────────────────────
export async function extractDocument(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ExtractedDocument> {
  if (mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
    return extractPDF(buffer, filename);
  }

  if (mimeType.startsWith('text/') || filename.toLowerCase().endsWith('.txt') || filename.toLowerCase().endsWith('.md')) {
    return extractText(buffer, filename, mimeType);
  }

  if (mimeType.startsWith('image/')) {
    // Images are passed through with a note; future: OCR integration
    return {
      filename,
      mimeType,
      content: `[Image file: ${filename}. Visual content — questions will be generated based on the subject and syllabus instead.]`,
      byteSize: buffer.byteLength,
      extractedAt: Date.now(),
    };
  }

  // Attempt generic UTF-8 text fallback
  try {
    return await extractText(buffer, filename, mimeType);
  } catch {
    throw new Error(`Unsupported file type: ${mimeType} (${filename})`);
  }
}

// ── Read uploaded file from disk ────────────────────────────────
export async function extractDocumentFromPath(
  filePath: string,
  filename: string,
  mimeType: string
): Promise<ExtractedDocument> {
  const buffer = await fs.readFile(filePath);
  return extractDocument(buffer, filename, mimeType);
}

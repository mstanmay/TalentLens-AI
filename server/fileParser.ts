import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import mammoth from 'mammoth';

const require = createRequire(import.meta.url);
// Import lib directly to bypass pdf-parse's index.js `!module.parent` test fixture loader
const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (
  dataBuffer: Buffer,
) => Promise<{ text: string; numpages: number }>;

export const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx']);
export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream', // fallback when browser omits docx mime
]);

export function validateResumeFile(filename: string, mimeType: string, size: number): string | null {
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return `Unsupported file type "${ext || 'unknown'}". Only PDF and DOCX files are accepted.`;
  }
  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
    return `Invalid MIME type "${mimeType}". Only PDF and DOCX documents are supported.`;
  }
  if (size <= 0) {
    return `File "${filename}" appears to be empty.`;
  }
  if (size > MAX_RESUME_SIZE_BYTES) {
    return `File "${filename}" exceeds the 10 MB limit.`;
  }
  return null;
}

export async function extractResumeTextFromFile(filePath: string, originalFilename: string): Promise<string> {
  const ext = path.extname(originalFilename).toLowerCase();
  const buffer = await fs.readFile(filePath);

  if (ext === '.pdf') {
    const parsed = await pdfParse(buffer);
    const text = (parsed.text ?? '').trim();
    if (!text) {
      throw new Error(`No extractable text found in PDF "${originalFilename}".`);
    }
    return text;
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value ?? '').trim();
    if (!text) {
      throw new Error(`No extractable text found in DOCX "${originalFilename}".`);
    }
    return text;
  }

  throw new Error(`Unsupported file extension: ${ext}`);
}

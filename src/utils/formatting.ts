import type { MatchStatusLabel } from '../types.ts';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatShortDate(dateStr: string): string {
  const normalized = dateStr.length === 10 ? `${dateStr}T00:00:00Z` : dateStr;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export interface StatusMeta {
  dotClass: string;
  textClass: string;
  barClass: string;
}

export function getStatusMeta(status: MatchStatusLabel | string): StatusMeta {
  if (status === 'High Match') {
    return {
      dotClass: 'bg-[#16A34A]',
      textClass: 'text-[#16A34A]',
      barClass: 'bg-[#16A34A]',
    };
  }
  if (status === 'Moderate Match') {
    return {
      dotClass: 'bg-[#D97706]',
      textClass: 'text-[#D97706]',
      barClass: 'bg-[#D97706]',
    };
  }
  return {
    dotClass: 'bg-[#DC2626]',
    textClass: 'text-[#DC2626]',
    barClass: 'bg-[#DC2626]',
  };
}

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

export function validateClientResumeFile(file: { name: string; size: number }): string | null {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) {
    return `"${file.name}" is not a PDF or DOCX file.`;
  }
  if (file.size <= 0) {
    return `"${file.name}" is empty.`;
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return `"${file.name}" exceeds the 10 MB maximum file size.`;
  }
  return null;
}

import { useState } from 'react';
import {
  Download,
  Eye,
  Search,
  Star,
  Trash2,
  UploadCloud,
  Users,
} from 'lucide-react';
import { api } from '../api.ts';
import type { CandidateResume, NavSection } from '../types.ts';
import { formatBytes, formatDateTime, getStatusMeta } from '../utils/formatting.ts';

interface CandidateDatabaseViewProps {
  resumes: CandidateResume[];
  onRefresh: () => Promise<void>;
  onOpenCandidate: (resumeId: number) => void;
  onNavigate: (section: NavSection) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export function CandidateDatabaseView({
  resumes,
  onRefresh,
  onOpenCandidate,
  onNavigate,
  onNotify,
}: CandidateDatabaseViewProps) {
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = resumes.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.candidateName.toLowerCase().includes(q) ||
      r.filename.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.detectedSkills.some((s) => s.toLowerCase().includes(q))
    );
  });

  async function handleDelete(r: CandidateResume) {
    setDeletingId(r.id);
    try {
      await api.deleteResume(r.id);
      onNotify(`Removed "${r.candidateName}" from database.`);
      await onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to remove resume.', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-lg font-bold text-[#0F172A]">
            Candidate Resume Database
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Browse all extracted candidate profiles, parsed skill inventories, and top screening scores.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, skill, file..."
              aria-label="Search candidates"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none sm:w-64"
            />
          </div>
          <button
            type="button"
            onClick={() => onNavigate('upload')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F172A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E3A8A] shrink-0"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Upload
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-3 font-display text-base font-bold text-[#0F172A]">
              No matching candidates found
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {resumes.length === 0
                ? 'Upload PDF or DOCX resumes to populate your candidate database.'
                : 'Try adjusting your search keywords.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Candidate</th>
                  <th className="px-4 py-3.5">Detected Skills</th>
                  <th className="px-4 py-3.5">Top Match</th>
                  <th className="px-4 py-3.5">Uploaded</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const meta = c.topStatus ? getStatusMeta(c.topStatus) : null;
                  return (
                    <tr key={c.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenCandidate(c.id)}
                            className="font-semibold text-[#0F172A] hover:text-[#1E3A8A] hover:underline text-left"
                          >
                            {c.candidateName}
                          </button>
                          {c.isShortlisted && (
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500 shrink-0" />
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {c.filename} · {formatBytes(c.fileSize)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {c.detectedSkills.slice(0, 5).map((skill) => (
                            <span
                              key={skill}
                              className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-700"
                            >
                              {skill}
                            </span>
                          ))}
                          {c.detectedSkills.length > 5 && (
                            <span className="px-1 py-0.5 font-mono text-[11px] text-slate-500">
                              +{c.detectedSkills.length - 5}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {c.topScore !== null && meta ? (
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`font-mono text-xs font-bold tabular-nums ${meta.textClass}`}>
                                {c.topScore.toFixed(1)}%
                              </span>
                              <span className="text-xs text-slate-500 truncate max-w-[160px]">
                                · {c.topJobTitle}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Not analyzed yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {formatDateTime(c.uploadedAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenCandidate(c.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Profile
                          </button>
                          <a
                            href={`/api/resumes/${c.id}/download`}
                            download
                            aria-label={`Download resume for ${c.candidateName}`}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                          <button
                            type="button"
                            disabled={deletingId === c.id}
                            onClick={() => handleDelete(c)}
                            aria-label={`Delete ${c.candidateName}`}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-[#DC2626] disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Download, Eye, Star, Trash2 } from 'lucide-react';
import { api } from '../api.ts';
import type { JobDescription, ShortlistedCandidate } from '../types.ts';
import { formatDateTime, getStatusMeta } from '../utils/formatting.ts';

interface ShortlistedViewProps {
  jobs: JobDescription[];
  onOpenCandidate: (resumeId: number, jobId?: number) => void;
  onDataMutated: () => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export function ShortlistedView({
  jobs,
  onOpenCandidate,
  onDataMutated,
  onNotify,
}: ShortlistedViewProps) {
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [shortlists, setShortlists] = useState<ShortlistedCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadShortlists() {
    setLoading(true);
    try {
      const data = await api.getShortlists(selectedJobId ? Number(selectedJobId) : null);
      setShortlists(data);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to load shortlisted candidates.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadShortlists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId]);

  async function handleRemove(item: ShortlistedCandidate) {
    try {
      await api.removeShortlist(item.resumeId, item.jobId);
      onNotify(`Removed ${item.candidateName} from shortlist.`);
      await Promise.all([loadShortlists(), onDataMutated()]);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not remove from shortlist.', 'error');
    }
  }

  const exportUrl = `/api/shortlists/export.csv${
    selectedJobId ? `?jobId=${selectedJobId}` : ''
  }`;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-lg font-bold text-[#0F172A]">
            Shortlisted Candidates
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Review top-ranked candidates approved for interview scheduling and export shortlist reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <select
            aria-label="Filter shortlisted candidates by job role"
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none"
          >
            <option value="">All Job Roles</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>

          <a
            href={exportUrl}
            download
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0F172A] via-[#1E3A8A] to-[#4F46E5] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>
        </div>
      </div>

      {/* Shortlist Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : shortlists.length === 0 ? (
          <div className="p-12 text-center">
            <Star className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-3 font-display text-base font-bold text-[#0F172A]">
              No shortlisted candidates yet
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Star candidates in AI Resume Matching or Candidate Profiles to add them to your shortlist.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Candidate</th>
                  <th className="px-4 py-3.5">Job Role</th>
                  <th className="px-4 py-3.5">Match Score</th>
                  <th className="px-4 py-3.5">Matched Skills</th>
                  <th className="px-4 py-3.5">Shortlisted</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shortlists.map((item) => {
                  const meta = getStatusMeta(item.status);
                  return (
                    <tr key={item.shortlistId} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-5 py-3.5">
                        <button
                          type="button"
                          onClick={() => onOpenCandidate(item.resumeId, item.jobId)}
                          className="font-semibold text-[#0F172A] hover:text-[#1E3A8A] hover:underline text-left"
                        >
                          {item.candidateName}
                        </button>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {item.email || item.filename}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-xs font-semibold text-[#0F172A]">{item.jobTitle}</div>
                        <div className="text-[11px] text-slate-500">{item.company}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${meta.barClass}`}
                              style={{ width: `${Math.min(100, Math.max(4, item.overallScore))}%` }}
                            />
                          </div>
                          <span className={`font-mono text-xs font-bold tabular-nums ${meta.textClass}`}>
                            {item.overallScore.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {item.matchedSkills.slice(0, 4).map((skill) => (
                            <span
                              key={skill}
                              className="rounded border border-emerald-200 bg-emerald-50/60 px-1.5 py-0.5 text-[11px] font-medium text-[#16A34A]"
                            >
                              {skill}
                            </span>
                          ))}
                          {item.matchedSkills.length > 4 && (
                            <span className="px-1 py-0.5 font-mono text-[11px] text-slate-500">
                              +{item.matchedSkills.length - 4}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {formatDateTime(item.shortlistedAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenCandidate(item.resumeId, item.jobId)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Profile
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(item)}
                            aria-label={`Remove ${item.candidateName} from shortlist`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#DC2626] hover:border-red-200 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
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

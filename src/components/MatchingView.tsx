import { useEffect, useState } from 'react';
import {
  ArrowUpDown,
  Cpu,
  Download,
  Eye,
  Search,
  Star,
} from 'lucide-react';
import { api } from '../api.ts';
import type { JobDescription, MatchResultRow } from '../types.ts';
import { getStatusMeta } from '../utils/formatting.ts';

interface MatchingViewProps {
  jobs: JobDescription[];
  initialJobId: number | null;
  onOpenCandidate: (resumeId: number, jobId?: number) => void;
  onDataMutated: () => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export function MatchingView({
  jobs,
  initialJobId,
  onOpenCandidate,
  onDataMutated,
  onNotify,
}: MatchingViewProps) {
  const [selectedJobId, setSelectedJobId] = useState<string>(
    initialJobId ? String(initialJobId) : '',
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [shortlistedOnly, setShortlistedOnly] = useState(false);
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [matches, setMatches] = useState<MatchResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (initialJobId) {
      setSelectedJobId(String(initialJobId));
    }
  }, [initialJobId]);

  async function loadMatches() {
    setLoading(true);
    try {
      const rows = await api.getMatches({
        jobId: selectedJobId ? Number(selectedJobId) : null,
        search,
        status: statusFilter,
        shortlistedOnly,
        sort: sortDir,
      });
      setMatches(rows);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to load matches.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId, search, statusFilter, shortlistedOnly, sortDir]);

  async function handleAnalyzeResumes() {
    const targetId = selectedJobId ? Number(selectedJobId) : jobs[0]?.id;
    if (!targetId) {
      onNotify('Create a Job Description first before running resume matching.', 'error');
      return;
    }

    if (!selectedJobId) {
      setSelectedJobId(String(targetId));
    }

    setAnalyzing(true);
    try {
      const res = await api.analyzeResumes(targetId);
      onNotify(
        `ML Pipeline analyzed ${res.analyzedCount} candidate resumes for "${res.jobTitle}".`,
      );
      await Promise.all([loadMatches(), onDataMutated()]);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Analysis failed.', 'error');
    } finally {
      setAnalyzing(false);
    }
  }

  async function toggleShortlist(row: MatchResultRow) {
    try {
      if (row.isShortlisted) {
        await api.removeShortlist(row.resumeId, row.jobId);
        onNotify(`Removed ${row.candidateName} from shortlist.`);
      } else {
        await api.addShortlist(
          row.resumeId,
          row.jobId,
          `Shortlisted (${row.overallScore.toFixed(1)}% match)`,
        );
        onNotify(`Shortlisted ${row.candidateName} for ${row.jobTitle}.`);
      }
      await Promise.all([loadMatches(), onDataMutated()]);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not update shortlist.', 'error');
    }
  }

  return (
    <div className="space-y-6">
      {/* Control Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0F172A]">
              AI Resume Screening &amp; Ranking Engine
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Executes TF-IDF vectorization, cosine similarity, Logistic Regression scoring, and skill gap matching.
            </p>
          </div>
          <button
            type="button"
            disabled={analyzing || jobs.length === 0}
            onClick={handleAnalyzeResumes}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#0F172A] via-[#1E3A8A] to-[#4F46E5] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50 shrink-0"
          >
            <Cpu className="h-4 w-4" />
            {analyzing ? 'Running ML Pipeline...' : 'Analyze Resumes'}
          </button>
        </div>

        {/* Filters & Search */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <label htmlFor="match-job-filter" className="sr-only">
              Filter by job role
            </label>
            <select
              id="match-job-filter"
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none"
            >
              <option value="">All Job Roles</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} ({job.company})
                </option>
              ))}
            </select>
          </div>

          <div className="relative lg:col-span-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidate or skill..."
              aria-label="Search matching candidates"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none"
            />
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="match-status-filter" className="sr-only">
              Filter by match status
            </label>
            <select
              id="match-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="High Match">High Match</option>
              <option value="Moderate Match">Moderate Match</option>
              <option value="Low Match">Low Match</option>
            </select>
          </div>

          <div className="lg:col-span-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Score: {sortDir === 'desc' ? 'High → Low' : 'Low → High'}
            </button>

            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700 whitespace-nowrap">
              <input
                type="checkbox"
                checked={shortlistedOnly}
                onChange={(e) => setShortlistedOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#1E3A8A] focus:ring-[#1E3A8A]"
              />
              Shortlisted
            </label>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="p-12 text-center">
            <Cpu className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-3 font-display text-base font-bold text-[#0F172A]">
              No matching records found
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Select a Job Role and click Analyze Resumes to generate TF-IDF similarity rankings.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3.5 w-14">Rank</th>
                  <th className="px-4 py-3.5">Candidate</th>
                  <th className="px-4 py-3.5">Job Role</th>
                  <th className="px-4 py-3.5">Match Score</th>
                  <th className="px-4 py-3.5">Skills</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matches.map((row) => {
                  const meta = getStatusMeta(row.status);
                  const missingCount = row.missingSkills?.length ?? 0;
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-500 tabular-nums">
                        #{row.rank}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => onOpenCandidate(row.resumeId, row.jobId)}
                          className="font-semibold text-[#0F172A] hover:text-[#1E3A8A] hover:underline text-left"
                        >
                          {row.candidateName}
                        </button>
                        <div className="mt-0.5 text-xs text-slate-500 truncate max-w-[180px]">
                          {row.filename}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-[#0F172A] text-xs">{row.jobTitle}</div>
                        <div className="text-[11px] text-slate-500">{row.company}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${meta.barClass}`}
                              style={{ width: `${Math.min(100, Math.max(4, row.overallScore))}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-bold text-[#0F172A] tabular-nums">
                            {row.overallScore.toFixed(1)}%
                          </span>
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                          Skill {row.skillScore.toFixed(0)}% · Cosine {row.similarityScore.toFixed(1)}%
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {row.matchedSkills.slice(0, 3).map((s) => (
                            <span
                              key={s}
                              className="rounded border border-emerald-200 bg-emerald-50/60 px-1.5 py-0.5 text-[11px] font-medium text-[#16A34A]"
                            >
                              {s}
                            </span>
                          ))}
                          {row.matchedSkills.length > 3 && (
                            <span className="px-1 py-0.5 font-mono text-[11px] text-slate-500">
                              +{row.matchedSkills.length - 3}
                            </span>
                          )}
                        </div>
                        {missingCount > 0 && (
                          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
                            Missing {missingCount}: {row.missingSkills?.slice(0, 2).join(', ')}
                            {missingCount > 2 ? '…' : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${meta.textClass}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
                          {row.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenCandidate(row.resumeId, row.jobId)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleShortlist(row)}
                            aria-label={
                              row.isShortlisted
                                ? `Remove ${row.candidateName} from shortlist`
                                : `Shortlist ${row.candidateName}`
                            }
                            className={`rounded-lg border p-1.5 transition-colors ${
                              row.isShortlisted
                                ? 'border-amber-300 bg-amber-50 text-amber-600'
                                : 'border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-amber-600'
                            }`}
                          >
                            <Star
                              className={`h-3.5 w-3.5 ${row.isShortlisted ? 'fill-amber-400' : ''}`}
                            />
                          </button>
                          <a
                            href={`/api/matches/${row.id}/report`}
                            download
                            aria-label={`Download analysis report for ${row.candidateName}`}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
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

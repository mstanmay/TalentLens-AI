import {
  Activity,
  ArrowRight,
  Award,
  Briefcase,
  CheckCircle2,
  Cpu,
  FileText,
  Plus,
  Star,
  TrendingUp,
  UploadCloud,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { DashboardResponse, NavSection } from '../types.ts';
import { formatBytes, formatDateTime, getStatusMeta } from '../utils/formatting.ts';

interface DashboardViewProps {
  data: DashboardResponse | null;
  loading: boolean;
  onNavigate: (section: NavSection) => void;
  onOpenCandidate: (resumeId: number, jobId?: number) => void;
}

export function DashboardView({
  data,
  loading,
  onNavigate,
  onOpenCandidate,
}: DashboardViewProps) {
  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white p-5"
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  const stats = data?.stats ?? {
    totalResumes: 0,
    totalJobs: 0,
    candidatesAnalyzed: 0,
    successfulMatches: 0,
    shortlistedCount: 0,
    averageMatchScore: 0,
  };

  const kpiCards = [
    {
      label: 'Total Resumes Uploaded',
      value: stats.totalResumes.toLocaleString(),
      subtext: 'PDF & DOCX candidate files',
      icon: FileText,
      accent: 'text-[#1E3A8A] bg-blue-50',
    },
    {
      label: 'Total Job Descriptions',
      value: stats.totalJobs.toLocaleString(),
      subtext: 'Active open requisitions',
      icon: Briefcase,
      accent: 'text-indigo-700 bg-indigo-50',
    },
    {
      label: 'Candidates Analyzed',
      value: stats.candidatesAnalyzed.toLocaleString(),
      subtext: 'Screened via TF-IDF & ML',
      icon: Cpu,
      accent: 'text-slate-700 bg-slate-100',
    },
    {
      label: 'Successful Matches',
      value: stats.successfulMatches.toLocaleString(),
      subtext: `Score >= ${data?.thresholds.highThreshold ?? 70}% threshold`,
      icon: CheckCircle2,
      accent: 'text-[#16A34A] bg-emerald-50',
    },
    {
      label: 'Shortlisted Candidates',
      value: stats.shortlistedCount.toLocaleString(),
      subtext: 'Selected for recruiter review',
      icon: Star,
      accent: 'text-[#D97706] bg-amber-50',
    },
    {
      label: 'Average Match Score',
      value: `${stats.averageMatchScore.toFixed(1)}%`,
      subtext: 'Across evaluated pairings',
      icon: TrendingUp,
      accent: 'text-indigo-700 bg-indigo-50',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Quick Actions Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-lg font-bold text-[#0F172A]">
            Recruitment Screening Overview
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Real-time metrics computed from uploaded resumes, active jobs, and TF-IDF cosine similarity models.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('upload')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Upload Resumes
          </button>
          <button
            type="button"
            onClick={() => onNavigate('jobs')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Job Role
          </button>
          <button
            type="button"
            onClick={() => onNavigate('matching')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0F172A] via-[#1E3A8A] to-[#4F46E5] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95"
          >
            <Cpu className="h-3.5 w-3.5" />
            Analyze Resumes
          </button>
        </div>
      </div>

      {/* 6 Statistics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {card.label}
                </p>
                <p className="mt-2 font-display text-3xl font-bold tracking-tight text-[#0F172A] tabular-nums">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-slate-500">{card.subtext}</p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.accent}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Split: Latest Matching Results + Recent Uploads & Activity */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Latest Matching Results */}
        <div className="rounded-xl border border-slate-200 bg-white xl:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-[#1E3A8A]" />
              <h3 className="font-display text-sm font-bold text-[#0F172A]">
                Latest Matching Results
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('matching')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A8A] hover:underline"
            >
              View full matrix
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            {data && data.latestMatches.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3">Candidate</th>
                    <th className="px-4 py-3">Job Role</th>
                    <th className="px-4 py-3">Match Score</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.latestMatches.map((m) => {
                    const meta = getStatusMeta(m.status);
                    return (
                      <tr
                        key={m.id}
                        onClick={() => onOpenCandidate(m.resumeId, m.jobId)}
                        className="cursor-pointer transition-colors hover:bg-slate-50"
                      >
                        <td className="px-5 py-3">
                          <div className="font-semibold text-[#0F172A]">{m.candidateName}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[180px]">
                            {m.filename}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-700">
                          {m.jobTitle}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${meta.barClass}`}
                                style={{ width: `${Math.min(100, Math.max(4, m.overallScore))}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs font-semibold text-[#0F172A] tabular-nums">
                              {m.overallScore.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${meta.textClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-sm text-slate-500">
                No matching analyses recorded yet. Click Analyze Resumes to run the ML pipeline.
              </div>
            )}
          </div>
        </div>

        {/* Right Stack: Recent Resume Uploads + Recently Analyzed + Activity */}
        <div className="space-y-6 xl:col-span-5">
          {/* Recent Resume Uploads */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#1E3A8A]" />
                <h3 className="font-display text-sm font-bold text-[#0F172A]">
                  Recent Resume Uploads
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('candidates')}
                className="text-xs font-semibold text-[#1E3A8A] hover:underline"
              >
                All candidates
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {(data?.recentUploads ?? []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenCandidate(item.id)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#0F172A] truncate">
                      {item.candidateName}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 truncate">
                      {item.filename} · {formatBytes(item.fileSize)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-[11px] font-medium text-slate-600 tabular-nums">
                      {item.detectedSkills.length} skills
                    </span>
                    <div className="text-[11px] text-slate-400 tabular-nums">
                      {formatDateTime(item.uploadedAt)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Recently Analyzed & Recent Activities */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#1E3A8A]" />
                <h3 className="font-display text-sm font-bold text-[#0F172A]">
                  Recently Analyzed &amp; Pipeline Log
                </h3>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {(data?.recentlyAnalyzed ?? []).slice(0, 3).map((item, idx) => {
                const meta = getStatusMeta(item.status);
                return (
                  <button
                    key={`${item.resumeId}-${item.jobId}-${idx}`}
                    type="button"
                    onClick={() => onOpenCandidate(item.resumeId, item.jobId)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-[#0F172A]">
                        {item.candidateName}
                      </span>
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span className="text-xs text-slate-500 truncate">{item.jobTitle}</span>
                    </div>
                    <span className={`font-mono text-xs font-semibold tabular-nums ${meta.textClass}`}>
                      {item.overallScore.toFixed(1)}%
                    </span>
                  </button>
                );
              })}

              {(data?.recentActivities ?? []).slice(0, 4).map((act) => (
                <div key={act.id} className="flex items-start justify-between gap-3 px-5 py-2.5">
                  <p className="text-xs text-slate-600">{act.description}</p>
                  <span className="shrink-0 font-mono text-[11px] text-slate-400 tabular-nums">
                    {formatDateTime(act.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

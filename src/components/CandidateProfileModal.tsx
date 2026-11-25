import { useEffect, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Download,
  FileText,
  GraduationCap,
  Mail,
  Phone,
  Star,
  X,
  XCircle,
} from 'lucide-react';
import { api } from '../api.ts';
import type { CandidateMatchDetail, CandidateProfileDetail } from '../types.ts';
import { formatBytes, formatDateTime, getStatusMeta } from '../utils/formatting.ts';

interface CandidateProfileModalProps {
  resumeId: number | null;
  preferredJobId?: number;
  onClose: () => void;
  onDataMutated: () => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export function CandidateProfileModal({
  resumeId,
  preferredJobId,
  onClose,
  onDataMutated,
  onNotify,
}: CandidateProfileModalProps) {
  const [profile, setProfile] = useState<CandidateProfileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [updatingShortlist, setUpdatingShortlist] = useState(false);

  async function loadProfile(id: number) {
    setLoading(true);
    try {
      const data = await api.getCandidateProfile(id);
      setProfile(data);
      if (preferredJobId && data.matches.some((m) => m.jobId === preferredJobId)) {
        setSelectedJobId(preferredJobId);
      } else if (data.matches.length > 0) {
        setSelectedJobId(data.matches[0].jobId);
      } else {
        setSelectedJobId(null);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to load candidate profile.', 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (resumeId !== null) {
      void loadProfile(resumeId);
    } else {
      setProfile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId, preferredJobId]);

  if (resumeId === null) return null;

  const activeMatch: CandidateMatchDetail | undefined = profile?.matches.find(
    (m) => m.jobId === selectedJobId,
  );

  async function handleToggleShortlist() {
    if (!profile || !activeMatch) return;
    setUpdatingShortlist(true);
    try {
      if (activeMatch.isShortlisted) {
        await api.removeShortlist(profile.id, activeMatch.jobId);
        onNotify(`Removed ${profile.candidateName} from shortlist.`);
      } else {
        await api.addShortlist(
          profile.id,
          activeMatch.jobId,
          `Shortlisted from profile (${activeMatch.overallScore.toFixed(1)}% match)`,
        );
        onNotify(`Shortlisted ${profile.candidateName} for ${activeMatch.jobTitle}.`);
      }
      await Promise.all([loadProfile(profile.id), onDataMutated()]);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to update shortlist.', 'error');
    } finally {
      setUpdatingShortlist(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Candidate profile"
    >
      <div className="flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
        {/* Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Candidate Screening Profile
            </p>
            <h2 className="font-display text-lg font-bold text-[#0F172A] truncate">
              {profile?.candidateName ?? 'Loading candidate...'}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {profile && (
              <a
                href={`/api/resumes/${profile.id}/download`}
                download
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                Download Resume
              </a>
            )}
            {activeMatch && (
              <>
                <a
                  href={`/api/matches/${activeMatch.id}/report`}
                  download
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Analysis Report
                </a>
                <button
                  type="button"
                  disabled={updatingShortlist}
                  onClick={handleToggleShortlist}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    activeMatch.isShortlisted
                      ? 'border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                      : 'bg-gradient-to-r from-[#0F172A] to-[#4F46E5] text-white hover:opacity-95'
                  }`}
                >
                  <Star
                    className={`h-3.5 w-3.5 ${activeMatch.isShortlisted ? 'fill-amber-500' : ''}`}
                  />
                  {activeMatch.isShortlisted ? 'Shortlisted' : 'Shortlist Candidate'}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close candidate profile"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading || !profile ? (
            <div className="space-y-4">
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-44 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : (
            <>
              {/* Candidate Info Card */}
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2">
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span>{profile.email || 'Email not parsed'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{profile.phone || 'Phone not parsed'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-medium text-slate-800">{profile.filename}</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      ({formatBytes(profile.fileSize)})
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                    <span>{profile.experienceSummary}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                    <span>{profile.educationSummary}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                    Uploaded {formatDateTime(profile.uploadedAt)}
                  </div>
                </div>
              </div>

              {/* Job Analysis Selector & ML Score Breakdown */}
              {profile.matches.length > 0 && activeMatch ? (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="font-display text-sm font-bold text-[#0F172A]">
                        ML Screening Evaluation
                      </h3>
                      <p className="text-xs text-slate-500">
                        {activeMatch.jobTitle} · {activeMatch.company} ({activeMatch.employmentType})
                      </p>
                    </div>
                    {profile.matches.length > 1 && (
                      <select
                        aria-label="Select evaluated job role"
                        value={activeMatch.jobId}
                        onChange={(e) => setSelectedJobId(Number(e.target.value))}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A]"
                      >
                        {profile.matches.map((m) => (
                          <option key={m.jobId} value={m.jobId}>
                            {m.jobTitle} ({m.overallScore.toFixed(1)}%)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="text-[11px] font-semibold uppercase text-slate-400">
                        Overall Match
                      </div>
                      <div
                        className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
                          getStatusMeta(activeMatch.status).textClass
                        }`}
                      >
                        {activeMatch.overallScore.toFixed(1)}%
                      </div>
                      <div className="text-[11px] font-semibold text-slate-600">
                        {activeMatch.status}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="text-[11px] font-semibold uppercase text-slate-400">
                        Skill Score (60%)
                      </div>
                      <div className="mt-1 font-mono text-2xl font-bold text-[#0F172A] tabular-nums">
                        {activeMatch.skillScore.toFixed(1)}%
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {activeMatch.matchedSkills.length}/{activeMatch.requiredSkills.length} required
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="text-[11px] font-semibold uppercase text-slate-400">
                        TF-IDF Cosine (40%)
                      </div>
                      <div className="mt-1 font-mono text-2xl font-bold text-[#0F172A] tabular-nums">
                        {activeMatch.similarityScore.toFixed(1)}%
                      </div>
                      <div className="text-[11px] text-slate-500">Vector similarity</div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="text-[11px] font-semibold uppercase text-slate-400">
                        ML Classifier
                      </div>
                      <div className="mt-1 font-mono text-2xl font-bold text-[#1E3A8A] tabular-nums">
                        {activeMatch.mlProbability.toFixed(1)}%
                      </div>
                      <div className="text-[11px] font-semibold text-slate-600">
                        {activeMatch.mlPrediction}
                      </div>
                    </div>
                  </div>

                  {/* Matched & Missing Skills */}
                  <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#16A34A]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Matched Skills ({activeMatch.matchedSkills.length})
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {activeMatch.matchedSkills.length > 0 ? (
                          activeMatch.matchedSkills.map((s) => (
                            <span
                              key={s}
                              className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-[#16A34A]"
                            >
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">No direct skill overlap</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#DC2626]">
                        <XCircle className="h-3.5 w-3.5" />
                        Missing Required Skills ({activeMatch.missingSkills.length})
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {activeMatch.missingSkills.length > 0 ? (
                          activeMatch.missingSkills.map((s) => (
                            <span
                              key={s}
                              className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-[#DC2626]"
                            >
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">All required skills covered</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Selected Job Description */}
                  <div className="border-t border-slate-100 pt-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Evaluated Job Description
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                      {activeMatch.jobDescription}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  This candidate has not been analyzed against a job description yet.
                </div>
              )}

              {/* All Candidate Detected Skills */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="font-display text-sm font-bold text-[#0F172A]">
                  Detected Skills Inventory ({profile.detectedSkills.length})
                </h3>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {profile.detectedSkills.length > 0 ? (
                    profile.detectedSkills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">
                      No dictionary skills detected in resume text.
                    </span>
                  )}
                </div>
              </div>

              {/* Extracted Resume Text */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="font-display text-sm font-bold text-[#0F172A]">
                  Extracted Resume Text
                </h3>
                <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700">
                  {profile.extractedText}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

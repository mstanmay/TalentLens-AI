import { useState } from 'react';
import { BarChart3, CheckCircle2, Star, TrendingUp, Users } from 'lucide-react';
import type { AnalyticsResponse } from '../types.ts';
import { formatShortDate } from '../utils/formatting.ts';

interface AnalyticsViewProps {
  analytics: AnalyticsResponse | null;
  loading: boolean;
}

export function AnalyticsView({ analytics, loading }: AnalyticsViewProps) {
  const [hoveredBucket, setHoveredBucket] = useState<string | null>(null);
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  if (loading && !analytics) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
    );
  }

  const summary = analytics?.summary ?? {
    totalCandidates: 0,
    shortlistedCandidates: 0,
    totalAnalyses: 0,
    averageScore: 0,
    highMatchRate: 0,
  };

  const scoreBuckets = analytics?.scoreBuckets ?? [];
  const maxBucket = Math.max(1, ...scoreBuckets.map((b) => b.count));

  const distribution = analytics?.matchDistribution ?? [];
  const totalDist = Math.max(
    1,
    distribution.reduce((sum, d) => sum + d.count, 0),
  );

  // Build SVG Donut arcs
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  const uploadActivity = analytics?.uploadActivity ?? [];
  const maxUpload = Math.max(1, ...uploadActivity.map((u) => u.count));

  const topSkills = analytics?.topSkills ?? [];
  const maxSkillCount = Math.max(1, ...topSkills.map((s) => s.count));

  return (
    <div className="space-y-6">
      {/* Statistics Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Users className="h-3.5 w-3.5 text-[#1E3A8A]" />
            Total Candidates
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-[#0F172A] tabular-nums">
            {summary.totalCandidates}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Star className="h-3.5 w-3.5 text-[#D97706]" />
            Shortlisted Candidates
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-[#0F172A] tabular-nums">
            {summary.shortlistedCandidates}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <BarChart3 className="h-3.5 w-3.5 text-indigo-600" />
            Total ML Evaluations
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-[#0F172A] tabular-nums">
            {summary.totalAnalyses}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <TrendingUp className="h-3.5 w-3.5 text-[#1E3A8A]" />
            Avg Match Score
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-[#0F172A] tabular-nums">
            {summary.averageScore.toFixed(1)}%
          </div>
        </div>

        <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-4 lg:col-span-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" />
            High Match Rate
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-[#16A34A] tabular-nums">
            {summary.highMatchRate.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Charts 2x2 Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Bar Chart - Candidates by Match Score */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-display text-sm font-bold text-[#0F172A]">
                Candidates by Match Score
              </h3>
              <p className="text-xs text-slate-500">
                Distribution of evaluated candidate-role scores across 20% intervals
              </p>
            </div>
            {hoveredBucket && (
              <span className="font-mono text-xs font-semibold text-[#1E3A8A] tabular-nums">
                {hoveredBucket}
              </span>
            )}
          </div>

          <div className="mt-5 flex h-56 items-end justify-between gap-3 px-2 pt-4">
            {scoreBuckets.map((b) => {
              const heightPct = Math.round((b.count / maxBucket) * 100);
              return (
                <div
                  key={b.label}
                  onMouseEnter={() => setHoveredBucket(`${b.label}: ${b.count} match(es)`)}
                  onMouseLeave={() => setHoveredBucket(null)}
                  className="group flex flex-1 flex-col items-center gap-2"
                >
                  <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                    {b.count}
                  </span>
                  <div className="flex h-36 w-full items-end rounded-md bg-slate-50 p-1">
                    <div
                      className="w-full rounded-sm bg-gradient-to-t from-[#0F172A] via-[#1E3A8A] to-[#4F46E5] transition-all duration-300 group-hover:opacity-85"
                      style={{ height: `${Math.max(b.count > 0 ? 10 : 2, heightPct)}%` }}
                    />
                  </div>
                  <span className="font-mono text-[11px] font-medium text-slate-500 tabular-nums">
                    {b.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Pie / Donut Chart - High, Moderate & Low Matches */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-display text-sm font-bold text-[#0F172A]">
                Match Tier Breakdown
              </h3>
              <p className="text-xs text-slate-500">
                High, Moderate, and Low Match proportions using configured thresholds
              </p>
            </div>
            {hoveredSlice && (
              <span className="font-mono text-xs font-semibold text-[#0F172A] tabular-nums">
                {hoveredSlice}
              </span>
            )}
          </div>

          <div className="mt-6 flex flex-col items-center justify-around gap-6 sm:flex-row">
            <div className="relative flex h-44 w-44 items-center justify-center">
              <svg viewBox="0 0 160 160" className="h-44 w-44 -rotate-90" aria-label="Match tier distribution chart">
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke="#F1F5F9"
                  strokeWidth="22"
                />
                {distribution.map((slice) => {
                  const pct = slice.count / totalDist;
                  const dashLen = pct * circumference;
                  const offset = -cumulativeOffset;
                  cumulativeOffset += dashLen;
                  if (slice.count === 0) return null;
                  return (
                    <circle
                      key={slice.label}
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth="22"
                      strokeDasharray={`${dashLen} ${circumference}`}
                      strokeDashoffset={offset}
                      className="cursor-pointer transition-opacity hover:opacity-80"
                      onMouseEnter={() =>
                        setHoveredSlice(`${slice.label}: ${slice.count} (${(pct * 100).toFixed(1)}%)`)
                      }
                      onMouseLeave={() => setHoveredSlice(null)}
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono text-2xl font-bold text-[#0F172A] tabular-nums">
                  {summary.totalAnalyses}
                </span>
                <span className="text-[11px] font-medium text-slate-500">Evaluations</span>
              </div>
            </div>

            <div className="w-full max-w-xs space-y-3">
              {distribution.map((slice) => {
                const pct = summary.totalAnalyses > 0 ? (slice.count / summary.totalAnalyses) * 100 : 0;
                return (
                  <div
                    key={slice.label}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="text-xs font-semibold text-[#0F172A]">{slice.label}</span>
                    </div>
                    <div className="font-mono text-xs tabular-nums">
                      <span className="font-bold text-[#0F172A]">{slice.count}</span>
                      <span className="ml-1.5 text-slate-500">({pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Line Chart - Resume Upload Activity */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-display text-sm font-bold text-[#0F172A]">
                Resume Upload Activity
              </h3>
              <p className="text-xs text-slate-500">
                Chronological daily resume ingestion volume
              </p>
            </div>
            {hoveredPoint !== null && uploadActivity[hoveredPoint] && (
              <span className="font-mono text-xs font-semibold text-[#1E3A8A] tabular-nums">
                {formatShortDate(uploadActivity[hoveredPoint].date)}:{' '}
                {uploadActivity[hoveredPoint].count} resume(s)
              </span>
            )}
          </div>

          {uploadActivity.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-400">
              No upload timestamps recorded yet.
            </div>
          ) : (
            <div className="mt-4">
              <svg viewBox="0 0 420 180" className="h-52 w-full overflow-visible" aria-label="Resume upload activity line chart">
                {/* Horizontal gridlines */}
                {[0, 0.5, 1].map((ratio) => {
                  const y = 140 - ratio * 110;
                  return (
                    <line
                      key={ratio}
                      x1="28"
                      y1={y}
                      x2="400"
                      y2={y}
                      stroke="#E2E8F0"
                      strokeDasharray="3 3"
                    />
                  );
                })}

                {(() => {
                  const pts = uploadActivity.map((d, idx) => {
                    const x =
                      uploadActivity.length === 1
                        ? 214
                        : 36 + (idx / (uploadActivity.length - 1)) * 356;
                    const y = 140 - (d.count / maxUpload) * 105;
                    return { x, y, ...d, idx };
                  });
                  const polylinePoints = pts.map((p) => `${p.x},${p.y}`).join(' ');
                  const areaPoints = `36,140 ${polylinePoints} ${pts[pts.length - 1].x},140`;

                  return (
                    <>
                      {pts.length > 1 && (
                        <>
                          <polygon points={areaPoints} fill="rgba(79, 70, 229, 0.09)" />
                          <polyline
                            fill="none"
                            stroke="#1E3A8A"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            points={polylinePoints}
                          />
                        </>
                      )}
                      {pts.map((p) => (
                        <g key={p.date}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={hoveredPoint === p.idx ? 6 : 4.5}
                            fill="#4F46E5"
                            stroke="#FFFFFF"
                            strokeWidth="2"
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredPoint(p.idx)}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                          <text
                            x={p.x}
                            y="164"
                            textAnchor="middle"
                            className="fill-slate-500 text-[10px] font-mono"
                          >
                            {formatShortDate(p.date)}
                          </text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>
            </div>
          )}
        </div>

        {/* 4. Horizontal Bar Chart - Most Frequently Detected Skills */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-display text-sm font-bold text-[#0F172A]">
              Most Frequently Detected Skills
            </h3>
            <p className="text-xs text-slate-500">
              Top technical &amp; domain skills extracted across all candidate resumes
            </p>
          </div>

          {topSkills.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-400">
              Upload resumes to inspect detected skill frequencies.
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {topSkills.map((item) => {
                const widthPct = Math.round((item.count / maxSkillCount) * 100);
                return (
                  <div key={item.skill} className="flex items-center gap-3">
                    <div className="w-32 shrink-0 truncate text-xs font-semibold text-slate-700">
                      {item.skill}
                    </div>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#1E3A8A] to-[#4F46E5]"
                        style={{ width: `${Math.max(8, widthPct)}%` }}
                      />
                    </div>
                    <div className="w-8 shrink-0 text-right font-mono text-xs font-bold text-[#0F172A] tabular-nums">
                      {item.count}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { Cpu, Menu, UploadCloud } from 'lucide-react';
import type { NavSection } from '../types.ts';

interface TopHeaderProps {
  activeSection: NavSection;
  onOpenMobileMenu: () => void;
  onNavigate: (section: NavSection) => void;
}

const SECTION_LABELS: Record<NavSection, string> = {
  dashboard: 'Dashboard',
  upload: 'Resume Upload',
  jobs: 'Job Descriptions',
  candidates: 'Candidate Database',
  matching: 'AI Resume Matching',
  shortlisted: 'Shortlisted Candidates',
  analytics: 'Analytics & Reports',
  settings: 'Settings',
};

export function TopHeader({ activeSection, onOpenMobileMenu, onNavigate }: TopHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="hidden font-medium text-slate-400 sm:inline">TalentLens AI</span>
          <span className="hidden text-slate-300 sm:inline">/</span>
          <h1 className="font-display text-base font-bold text-[#0F172A] truncate">
            {SECTION_LABELS[activeSection]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {activeSection !== 'upload' && (
          <button
            type="button"
            onClick={() => onNavigate('upload')}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <UploadCloud className="h-3.5 w-3.5 text-slate-500" />
            <span>Upload Resumes</span>
          </button>
        )}
        {activeSection !== 'matching' && (
          <button
            type="button"
            onClick={() => onNavigate('matching')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0F172A] via-[#1E3A8A] to-[#4F46E5] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-95 whitespace-nowrap shrink-0"
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>AI Matching</span>
          </button>
        )}
      </div>
    </header>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { api } from './api.ts';
import { AnalyticsView } from './components/AnalyticsView.tsx';
import { CandidateDatabaseView } from './components/CandidateDatabaseView.tsx';
import { CandidateProfileModal } from './components/CandidateProfileModal.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { JobDescriptionsView } from './components/JobDescriptionsView.tsx';
import { MatchingView } from './components/MatchingView.tsx';
import { ResumeUploadView } from './components/ResumeUploadView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { ShortlistedView } from './components/ShortlistedView.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { TopHeader } from './components/TopHeader.tsx';
import type {
  AnalyticsResponse,
  AppSettings,
  CandidateResume,
  DashboardResponse,
  JobDescription,
  NavSection,
} from './types.ts';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [resumes, setResumes] = useState<CandidateResume[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    highThreshold: 70,
    moderateThreshold: 45,
    autoAnalyzeOnUpload: true,
    companyDefault: 'Northstar Systems',
  });
  const [loading, setLoading] = useState(true);

  const [matchingJobId, setMatchingJobId] = useState<number | null>(null);
  const [profileModal, setProfileModal] = useState<{
    resumeId: number | null;
    preferredJobId?: number;
  }>({ resumeId: null });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const [dashData, jobsData, resumesData, analyticsData, settingsData] = await Promise.all([
        api.getDashboard(),
        api.getJobs(),
        api.getResumes(),
        api.getAnalytics(),
        api.getSettings(),
      ]);
      setDashboard(dashData);
      setJobs(jobsData);
      setResumes(resumesData);
      setAnalytics(analyticsData);
      setSettings(settingsData);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load workspace data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  function handleOpenCandidate(resumeId: number, preferredJobId?: number) {
    setProfileModal({ resumeId, preferredJobId });
  }

  function handleSelectJobForMatching(jobId: number) {
    setMatchingJobId(jobId);
    setActiveSection('matching');
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <Sidebar
        activeSection={activeSection}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        onSelectSection={setActiveSection}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onCloseMobile={() => setMobileMenuOpen(false)}
        shortlistCount={dashboard?.stats.shortlistedCount ?? 0}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader
          activeSection={activeSection}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onNavigate={setActiveSection}
        />

        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6">
          {activeSection === 'dashboard' && (
            <DashboardView
              data={dashboard}
              loading={loading}
              onNavigate={setActiveSection}
              onOpenCandidate={handleOpenCandidate}
            />
          )}

          {activeSection === 'upload' && (
            <ResumeUploadView
              jobs={jobs}
              autoAnalyzeDefault={settings.autoAnalyzeOnUpload}
              onUploadComplete={() => {
                void refreshAll();
                notify('Resumes uploaded and processed by the ML pipeline.');
              }}
              onNavigate={setActiveSection}
              onOpenCandidate={(id) => handleOpenCandidate(id)}
            />
          )}

          {activeSection === 'jobs' && (
            <JobDescriptionsView
              jobs={jobs}
              defaultCompany={settings.companyDefault}
              onRefreshJobs={refreshAll}
              onSelectJobForMatching={handleSelectJobForMatching}
              onNotify={notify}
            />
          )}

          {activeSection === 'candidates' && (
            <CandidateDatabaseView
              resumes={resumes}
              onRefresh={refreshAll}
              onOpenCandidate={(id) => handleOpenCandidate(id)}
              onNavigate={setActiveSection}
              onNotify={notify}
            />
          )}

          {activeSection === 'matching' && (
            <MatchingView
              jobs={jobs}
              initialJobId={matchingJobId}
              onOpenCandidate={handleOpenCandidate}
              onDataMutated={refreshAll}
              onNotify={notify}
            />
          )}

          {activeSection === 'shortlisted' && (
            <ShortlistedView
              jobs={jobs}
              onOpenCandidate={handleOpenCandidate}
              onDataMutated={refreshAll}
              onNotify={notify}
            />
          )}

          {activeSection === 'analytics' && (
            <AnalyticsView analytics={analytics} loading={loading} />
          )}

          {activeSection === 'settings' && (
            <SettingsView
              settings={settings}
              onSettingsUpdated={async (next) => {
                setSettings(next);
                await refreshAll();
              }}
              onNotify={notify}
            />
          )}
        </main>
      </div>

      <CandidateProfileModal
        resumeId={profileModal.resumeId}
        preferredJobId={profileModal.preferredJobId}
        onClose={() => setProfileModal({ resumeId: null })}
        onDataMutated={refreshAll}
        onNotify={notify}
      />

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs font-semibold shadow-lg ${
                t.type === 'error'
                  ? 'border-red-200 bg-red-50 text-[#DC2626]'
                  : 'border-slate-200 bg-[#0F172A] text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                {t.type === 'error' ? (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                )}
                <span>{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                aria-label="Dismiss notification"
                className="opacity-70 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

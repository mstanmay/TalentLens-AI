import {
  BarChart3,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Cpu,
  LayoutDashboard,
  Settings,
  Star,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import type { NavSection } from '../types.ts';

interface SidebarProps {
  activeSection: NavSection;
  collapsed: boolean;
  mobileOpen: boolean;
  onSelectSection: (section: NavSection) => void;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  shortlistCount: number;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'upload', label: 'Resume Upload', icon: UploadCloud },
  { id: 'jobs', label: 'Job Descriptions', icon: Briefcase },
  { id: 'candidates', label: 'Candidate Database', icon: Users },
  { id: 'matching', label: 'AI Resume Matching', icon: Cpu },
  { id: 'shortlisted', label: 'Shortlisted Candidates', icon: Star },
  { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({
  activeSection,
  collapsed,
  mobileOpen,
  onSelectSection,
  onToggleCollapse,
  onCloseMobile,
  shortlistCount,
}: SidebarProps) {
  const sidebarBody = (
    <div className="flex h-full flex-col bg-[#0F172A] text-slate-200 select-none">
      {/* Brand header */}
      <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#2563EB] to-[#6366F1] text-white font-display font-bold text-sm shadow-sm">
            TL
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-sm font-bold tracking-tight text-white truncate">
                TalentLens AI
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                Recruitment Intelligence
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation items */}
      <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-2.5 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectSection(item.id);
                onCloseMobile();
              }}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
                isActive
                  ? 'bg-gradient-to-r from-[#1E3A8A] to-[#4338CA] text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              {!collapsed && (
                <span className="flex-1 truncate">{item.label}</span>
              )}
              {!collapsed && item.id === 'shortlisted' && shortlistCount > 0 && (
                <span className="font-mono text-[11px] font-semibold tabular-nums text-indigo-200">
                  {shortlistCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle (desktop) */}
      <div className="hidden border-t border-slate-800 p-2.5 lg:block">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse Menu</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside
        className={`hidden shrink-0 border-r border-slate-800 transition-all duration-200 lg:block ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {sidebarBody}
      </aside>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 max-w-[85vw] shadow-xl">
            {sidebarBody}
          </aside>
        </div>
      )}
    </>
  );
}

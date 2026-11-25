import { useEffect, useState, type FormEvent } from 'react';
import { Save, Sliders } from 'lucide-react';
import { api } from '../api.ts';
import type { AppSettings } from '../types.ts';

interface SettingsViewProps {
  settings: AppSettings;
  onSettingsUpdated: (next: AppSettings) => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export function SettingsView({
  settings,
  onSettingsUpdated,
  onNotify,
}: SettingsViewProps) {
  const [highThreshold, setHighThreshold] = useState(settings.highThreshold);
  const [moderateThreshold, setModerateThreshold] = useState(settings.moderateThreshold);
  const [autoAnalyzeOnUpload, setAutoAnalyzeOnUpload] = useState(settings.autoAnalyzeOnUpload);
  const [companyDefault, setCompanyDefault] = useState(settings.companyDefault);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHighThreshold(settings.highThreshold);
    setModerateThreshold(settings.moderateThreshold);
    setAutoAnalyzeOnUpload(settings.autoAnalyzeOnUpload);
    setCompanyDefault(settings.companyDefault);
  }, [settings]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (moderateThreshold >= highThreshold) {
      onNotify('Moderate Match threshold must be lower than High Match threshold.', 'error');
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updateSettings({
        highThreshold,
        moderateThreshold,
        autoAnalyzeOnUpload,
        companyDefault,
      });
      await onSettingsUpdated(updated);
      onNotify('Settings saved and match categories recalculated across database.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-[#1E3A8A]">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-[#0F172A]">
              Screening Thresholds &amp; Pipeline Preferences
            </h2>
            <p className="text-sm text-slate-500">
              Configure how overall ML scores map to High, Moderate, and Low Match labels.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label
                htmlFor="high-threshold"
                className="flex items-center justify-between text-xs font-semibold text-slate-700"
              >
                <span>High Match Minimum Score (%)</span>
                <span className="font-mono text-[#16A34A] tabular-nums">{highThreshold}%</span>
              </label>
              <input
                id="high-threshold"
                type="range"
                min={50}
                max={95}
                value={highThreshold}
                onChange={(e) => setHighThreshold(Number(e.target.value))}
                className="mt-2 w-full accent-[#16A34A]"
              />
              <p className="mt-1 text-xs text-slate-500">
                Candidates scoring at or above {highThreshold}% are labeled High Match.
              </p>
            </div>

            <div>
              <label
                htmlFor="moderate-threshold"
                className="flex items-center justify-between text-xs font-semibold text-slate-700"
              >
                <span>Moderate Match Minimum Score (%)</span>
                <span className="font-mono text-[#D97706] tabular-nums">{moderateThreshold}%</span>
              </label>
              <input
                id="moderate-threshold"
                type="range"
                min={15}
                max={highThreshold - 5}
                value={moderateThreshold}
                onChange={(e) => setModerateThreshold(Number(e.target.value))}
                className="mt-2 w-full accent-[#D97706]"
              />
              <p className="mt-1 text-xs text-slate-500">
                Scores between {moderateThreshold}% and {highThreshold - 1}% are Moderate Match; below {moderateThreshold}% is Low Match.
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <label htmlFor="default-company" className="block text-xs font-semibold text-slate-700">
              Default Organization Name
            </label>
            <input
              id="default-company"
              type="text"
              value={companyDefault}
              onChange={(e) => setCompanyDefault(e.target.value)}
              className="mt-1.5 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none"
            />
          </div>

          <div className="border-t border-slate-100 pt-5">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={autoAnalyzeOnUpload}
                onChange={(e) => setAutoAnalyzeOnUpload(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#1E3A8A] focus:ring-[#1E3A8A]"
              />
              <div>
                <div className="text-sm font-semibold text-[#0F172A]">
                  Auto-analyze resumes immediately after upload
                </div>
                <div className="text-xs text-slate-500">
                  Automatically compute TF-IDF cosine similarity and skill scores when PDF/DOCX files are uploaded.
                </div>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-5">
            <div className="text-xs text-slate-500">
              Formula: <span className="font-mono text-slate-700">0.60 × Skill Score + 0.40 × Cosine Similarity</span>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#0F172A] via-[#1E3A8A] to-[#4F46E5] px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

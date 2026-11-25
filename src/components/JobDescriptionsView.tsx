import { useState, type FormEvent } from 'react';
import {
  Briefcase,
  Building2,
  Cpu,
  GraduationCap,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../api.ts';
import type { JobDescription, JobPayload } from '../types.ts';

interface JobDescriptionsViewProps {
  jobs: JobDescription[];
  defaultCompany: string;
  onRefreshJobs: () => Promise<void>;
  onSelectJobForMatching: (jobId: number) => void;
  onNotify: (message: string, type?: 'success' | 'error') => void;
}

const EMPTY_FORM: JobPayload = {
  title: '',
  company: '',
  requiredSkills: [],
  experienceReq: '',
  educationReq: '',
  description: '',
  employmentType: 'Full-time',
};

export function JobDescriptionsView({
  jobs,
  defaultCompany,
  onRefreshJobs,
  onSelectJobForMatching,
  onNotify,
}: JobDescriptionsViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [form, setForm] = useState<JobPayload>({ ...EMPTY_FORM, company: defaultCompany });
  const [skillsInput, setSkillsInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function openCreateModal() {
    setEditingJobId(null);
    setForm({ ...EMPTY_FORM, company: defaultCompany });
    setSkillsInput('');
    setModalOpen(true);
  }

  function openEditModal(job: JobDescription) {
    setEditingJobId(job.id);
    setForm({
      title: job.title,
      company: job.company,
      requiredSkills: job.requiredSkills,
      experienceReq: job.experienceReq,
      educationReq: job.educationReq,
      description: job.description,
      employmentType: job.employmentType,
    });
    setSkillsInput(job.requiredSkills.join(', '));
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      onNotify('Job Title and Job Description are required.', 'error');
      return;
    }

    setSaving(true);
    const payload: JobPayload = {
      ...form,
      requiredSkills: skillsInput
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      if (editingJobId) {
        await api.updateJob(editingJobId, payload);
        onNotify(`Updated "${payload.title}".`);
      } else {
        await api.createJob(payload);
        onNotify(`Created job description "${payload.title}".`);
      }
      setModalOpen(false);
      await onRefreshJobs();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save job description.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(job: JobDescription) {
    setDeletingId(job.id);
    try {
      await api.deleteJob(job.id);
      onNotify(`Deleted "${job.title}".`);
      await onRefreshJobs();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to delete job.', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-lg font-bold text-[#0F172A]">
            Job Descriptions &amp; Role Requirements
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Create and manage open job requisitions. Select any role to execute TF-IDF similarity and skill screening.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0F172A] via-[#1E3A8A] to-[#4F46E5] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95 shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Job Description
        </button>
      </div>

      {/* Job Grid */}
      {jobs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-slate-400" />
          <h3 className="mt-3 font-display text-base font-bold text-[#0F172A]">
            No job descriptions yet
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Create your first job description to start matching candidate resumes.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#0F172A] px-4 py-2 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Job Description
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-[#0F172A]">
                      {job.title}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        {job.company}
                      </span>
                      <span>·</span>
                      <span>{job.employmentType}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(job)}
                      aria-label={`Edit ${job.title}`}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-[#0F172A]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === job.id}
                      onClick={() => handleDelete(job)}
                      aria-label={`Delete ${job.title}`}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-[#DC2626] disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">
                  {job.description}
                </p>

                <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="font-semibold text-slate-700">Experience:</span>
                    <span className="truncate">{job.experienceReq || 'Not specified'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="font-semibold text-slate-700">Education:</span>
                    <span className="truncate">{job.educationReq || 'Not specified'}</span>
                  </div>
                </div>

                {job.requiredSkills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {job.requiredSkills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <div className="flex items-center gap-3 text-xs text-slate-500 tabular-nums">
                  <span>{job.matchCount} analyzed</span>
                  <span>·</span>
                  <span>{job.shortlistedCount} shortlisted</span>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectJobForMatching(job.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F172A] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1E3A8A]"
                >
                  <Cpu className="h-3.5 w-3.5" />
                  Match Resumes
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="job-modal-title"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 id="job-modal-title" className="font-display text-base font-bold text-[#0F172A]">
                {editingJobId ? 'Edit Job Description' : 'Create New Job Description'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close job modal"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="job-title" className="block text-xs font-semibold text-slate-700">
                    Job Title *
                  </label>
                  <input
                    id="job-title"
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Senior Python Backend Engineer"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="job-company" className="block text-xs font-semibold text-slate-700">
                    Company Name *
                  </label>
                  <input
                    id="job-company"
                    type="text"
                    required
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="e.g. Northstar Systems"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="job-type" className="block text-xs font-semibold text-slate-700">
                    Employment Type
                  </label>
                  <select
                    id="job-type"
                    value={form.employmentType}
                    onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                    <option value="Remote">Remote</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="job-exp" className="block text-xs font-semibold text-slate-700">
                    Experience Requirements
                  </label>
                  <input
                    id="job-exp"
                    type="text"
                    value={form.experienceReq}
                    onChange={(e) => setForm({ ...form, experienceReq: e.target.value })}
                    placeholder="e.g. 3+ years"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="job-edu" className="block text-xs font-semibold text-slate-700">
                    Educational Qualifications
                  </label>
                  <input
                    id="job-edu"
                    type="text"
                    value={form.educationReq}
                    onChange={(e) => setForm({ ...form, educationReq: e.target.value })}
                    placeholder="e.g. Bachelor's in CS"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="job-skills" className="block text-xs font-semibold text-slate-700">
                  Required Skills (comma-separated)
                </label>
                <input
                  id="job-skills"
                  type="text"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  placeholder="python, sql, flask, machine learning, docker, rest api"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="job-desc" className="block text-xs font-semibold text-slate-700">
                  Job Description *
                </label>
                <textarea
                  id="job-desc"
                  required
                  rows={5}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe role responsibilities, technical stack, and qualifications..."
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-gradient-to-r from-[#0F172A] via-[#1E3A8A] to-[#4F46E5] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingJobId ? 'Save Changes' : 'Create Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

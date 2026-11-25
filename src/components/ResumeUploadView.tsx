import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  FileText,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { api } from '../api.ts';
import type { JobDescription, NavSection, UploadFileResult } from '../types.ts';
import { formatBytes, validateClientResumeFile } from '../utils/formatting.ts';

interface ResumeUploadViewProps {
  jobs: JobDescription[];
  autoAnalyzeDefault: boolean;
  onUploadComplete: () => void;
  onNavigate: (section: NavSection) => void;
  onOpenCandidate: (resumeId: number) => void;
}

interface QueuedFile {
  id: string;
  file: File;
  error: string | null;
}

export function ResumeUploadView({
  jobs,
  autoAnalyzeDefault,
  onUploadComplete,
  onNavigate,
  onOpenCandidate,
}: ResumeUploadViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [autoAnalyze, setAutoAnalyze] = useState<boolean>(autoAnalyzeDefault);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [results, setResults] = useState<UploadFileResult[]>([]);

  function enqueueFiles(fileList: FileList | null) {
    if (!fileList) return;
    setUploadError(null);
    const incoming: QueuedFile[] = Array.from(fileList).map((file, idx) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${idx}`,
      file,
      error: validateClientResumeFile(file),
    }));
    setQueue((prev) => [...prev, ...incoming]);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    enqueueFiles(e.dataTransfer.files);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    enqueueFiles(e.target.files);
    e.target.value = '';
  }

  function removeQueuedFile(id: string) {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }

  async function handleUpload() {
    const validFiles = queue.filter((q) => !q.error).map((q) => q.file);
    if (validFiles.length === 0) {
      setUploadError('Please add at least one valid PDF or DOCX resume file.');
      return;
    }

    setUploading(true);
    setProgress(8);
    setUploadError(null);
    setResults([]);

    try {
      const response = await api.uploadResumesWithProgress(
        validFiles,
        {
          jobId: selectedJobId ? Number(selectedJobId) : null,
          autoAnalyze,
        },
        (pct) => setProgress(pct),
      );
      setResults(response.results);
      setQueue([]);
      onUploadComplete();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Resume upload failed.');
    } finally {
      setUploading(false);
    }
  }

  const validCount = queue.filter((q) => !q.error).length;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0F172A]">
              Multi-Resume Ingestion &amp; Text Extraction
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Upload PDF or DOCX resumes up to 10 MB each. Text is extracted automatically and routed into the TF-IDF &amp; Logistic Regression screening pipeline.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('matching')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E3A8A] hover:underline shrink-0"
          >
            Go to AI Resume Matching
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Configuration Options */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="upload-target-job"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              Screening Target Job Role
            </label>
            <select
              id="upload-target-job"
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none"
            >
              <option value="">All Active Job Descriptions (Recommended)</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} — {job.company}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end pb-1">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={autoAnalyze}
                onChange={(e) => setAutoAnalyze(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#1E3A8A] focus:ring-[#1E3A8A]"
              />
              <span>Automatically trigger ML matching pipeline after text extraction</span>
            </label>
          </div>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`mt-5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragActive
              ? 'border-[#4F46E5] bg-indigo-50/40'
              : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#0F172A] to-[#4F46E5] text-white shadow-sm">
            <UploadCloud className="h-6 w-6" />
          </div>
          <p className="mt-3 font-display text-sm font-bold text-[#0F172A]">
            Drag and drop PDF or DOCX resumes here
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Supports batch multi-file upload · Max 10 MB per file · .pdf, .docx
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Select resume files"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#0F172A] shadow-xs hover:bg-slate-50"
          >
            Browse Resume Files
          </button>
        </div>

        {/* Error banner */}
        {uploadError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#DC2626]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* File Queue */}
        {queue.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Staged Files ({queue.length})
              </h3>
              <button
                type="button"
                onClick={() => setQueue([])}
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Clear Queue
              </button>
            </div>

            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText
                      className={`h-4 w-4 shrink-0 ${
                        item.error ? 'text-[#DC2626]' : 'text-[#1E3A8A]'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#0F172A] truncate">
                        {item.file.name}
                      </div>
                      <div className="text-xs text-slate-500 tabular-nums">
                        {formatBytes(item.file.size)}
                        {item.error && (
                          <span className="ml-2 font-medium text-[#DC2626]">
                            — {item.error}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-xs font-semibold ${
                        item.error ? 'text-[#DC2626]' : 'text-[#16A34A]'
                      }`}
                    >
                      {item.error ? 'Invalid' : 'Ready'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeQueuedFile(item.id)}
                      aria-label={`Remove ${item.file.name}`}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {uploading && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                  <span>Uploading, extracting text &amp; running ML pipeline...</span>
                  <span className="font-mono tabular-nums">{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#1E3A8A] to-[#4F46E5] transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={uploading || validCount === 0}
                onClick={handleUpload}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#0F172A] via-[#1E3A8A] to-[#4F46E5] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Cpu className="h-4 w-4" />
                {uploading
                  ? 'Processing Resumes...'
                  : `Upload & Extract ${validCount} Resume${validCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Processed Upload Results */}
      {results.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="font-display text-sm font-bold text-[#0F172A]">
              Ingestion &amp; ML Extraction Summary
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('matching')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F172A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              View Ranked Matches
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {results.map((r, idx) => (
              <div key={`${r.filename}-${idx}`} className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  {r.status === 'uploaded' ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" />
                  )}
                  <div>
                    <div className="text-sm font-semibold text-[#0F172A]">
                      {r.candidateName ?? r.filename}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        ({r.filename})
                      </span>
                    </div>
                    {r.error ? (
                      <p className="text-xs text-[#DC2626]">{r.error}</p>
                    ) : (
                      <p className="mt-0.5 text-xs text-slate-600">
                        Detected skills:{' '}
                        {r.detectedSkills && r.detectedSkills.length > 0
                          ? r.detectedSkills.join(', ')
                          : 'General profile extracted'}
                      </p>
                    )}
                  </div>
                </div>
                {r.resumeId && (
                  <button
                    type="button"
                    onClick={() => onOpenCandidate(r.resumeId!)}
                    className="self-start rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#1E3A8A] hover:bg-slate-50 sm:self-center"
                  >
                    Open Profile
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

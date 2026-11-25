import type {
  AnalyticsResponse,
  AppSettings,
  CandidateProfileDetail,
  CandidateResume,
  DashboardResponse,
  JobDescription,
  JobPayload,
  MatchResultRow,
  ShortlistedCandidate,
  UploadResponse,
} from './types.ts';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // ignore non-json body
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export const api = {
  getDashboard: () => requestJson<DashboardResponse>('/api/dashboard'),

  getJobs: () => requestJson<JobDescription[]>('/api/jobs'),
  createJob: (payload: JobPayload) =>
    requestJson<JobDescription>('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updateJob: (id: number, payload: JobPayload) =>
    requestJson<JobDescription>(`/api/jobs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteJob: (id: number) =>
    requestJson<{ deleted: boolean; id: number }>(`/api/jobs/${id}`, {
      method: 'DELETE',
    }),

  getResumes: (search = '') =>
    requestJson<CandidateResume[]>(
      `/api/resumes${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    ),
  getCandidateProfile: (id: number) =>
    requestJson<CandidateProfileDetail>(`/api/resumes/${id}`),
  deleteResume: (id: number) =>
    requestJson<{ deleted: boolean; id: number }>(`/api/resumes/${id}`, {
      method: 'DELETE',
    }),

  uploadResumesWithProgress: (
    files: File[],
    options: { jobId?: number | null; autoAnalyze: boolean },
    onProgress: (percent: number) => void,
  ): Promise<UploadResponse> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file);
      }
      if (options.jobId) {
        formData.append('jobId', String(options.jobId));
      }
      formData.append('autoAnalyze', String(options.autoAnalyze));

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/resumes/upload');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.min(92, Math.round((e.loaded / e.total) * 90)));
        }
      };

      xhr.onload = () => {
        onProgress(100);
        try {
          const parsed = JSON.parse(xhr.responseText) as UploadResponse & { error?: string };
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error || `Upload failed (${xhr.status})`));
          }
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error while uploading resumes.'));
      xhr.send(formData);
    });
  },

  analyzeResumes: (jobId: number, resumeIds?: number[]) =>
    requestJson<{ jobId: number; jobTitle: string; analyzedCount: number }>('/api/match/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, resumeIds }),
    }),

  getMatches: (params: {
    jobId?: number | null;
    search?: string;
    status?: string;
    shortlistedOnly?: boolean;
    sort?: 'desc' | 'asc';
  }) => {
    const sp = new URLSearchParams();
    if (params.jobId) sp.set('jobId', String(params.jobId));
    if (params.search) sp.set('search', params.search);
    if (params.status && params.status !== 'All') sp.set('status', params.status);
    if (params.shortlistedOnly) sp.set('shortlistedOnly', 'true');
    if (params.sort) sp.set('sort', params.sort);
    const qs = sp.toString();
    return requestJson<MatchResultRow[]>(`/api/matches${qs ? `?${qs}` : ''}`);
  },

  getShortlists: (jobId?: number | null) =>
    requestJson<ShortlistedCandidate[]>(
      `/api/shortlists${jobId ? `?jobId=${jobId}` : ''}`,
    ),
  addShortlist: (resumeId: number, jobId: number, notes = '') =>
    requestJson<{ shortlisted: boolean }>('/api/shortlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeId, jobId, notes }),
    }),
  removeShortlist: (resumeId: number, jobId: number) =>
    requestJson<{ removed: boolean }>(
      `/api/shortlists?resumeId=${resumeId}&jobId=${jobId}`,
      { method: 'DELETE' },
    ),

  getAnalytics: () => requestJson<AnalyticsResponse>('/api/analytics'),

  getSettings: () => requestJson<AppSettings>('/api/settings'),
  updateSettings: (settings: Partial<AppSettings>) =>
    requestJson<AppSettings>('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    }),
};

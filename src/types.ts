export type NavSection =
  | 'dashboard'
  | 'upload'
  | 'jobs'
  | 'candidates'
  | 'matching'
  | 'shortlisted'
  | 'analytics'
  | 'settings';

export type MatchStatusLabel = 'High Match' | 'Moderate Match' | 'Low Match';

export interface DashboardStats {
  totalResumes: number;
  totalJobs: number;
  candidatesAnalyzed: number;
  successfulMatches: number;
  shortlistedCount: number;
  averageMatchScore: number;
}

export interface RecentUploadItem {
  id: number;
  candidateName: string;
  email: string;
  filename: string;
  fileSize: number;
  detectedSkills: string[];
  status: string;
  uploadedAt: string;
}

export interface RecentlyAnalyzedItem {
  resumeId: number;
  candidateName: string;
  filename: string;
  jobId: number;
  jobTitle: string;
  overallScore: number;
  status: MatchStatusLabel;
  analyzedAt: string;
}

export interface MatchResultRow {
  id: number;
  resumeId: number;
  jobId: number;
  candidateName: string;
  email?: string;
  filename: string;
  experienceSummary?: string;
  educationSummary?: string;
  jobTitle: string;
  company: string;
  overallScore: number;
  skillScore: number;
  similarityScore: number;
  mlPrediction?: string;
  mlProbability?: number;
  candidateSkills?: string[];
  requiredSkills?: string[];
  matchedSkills: string[];
  missingSkills?: string[];
  status: MatchStatusLabel;
  analyzedAt: string;
  isShortlisted: boolean;
  rank?: number;
}

export interface ActivityItem {
  id: number;
  actionType: string;
  description: string;
  entityName: string;
  createdAt: string;
}

export interface DashboardResponse {
  stats: DashboardStats;
  thresholds: {
    highThreshold: number;
    moderateThreshold: number;
  };
  recentUploads: RecentUploadItem[];
  recentlyAnalyzed: RecentlyAnalyzedItem[];
  latestMatches: MatchResultRow[];
  recentActivities: ActivityItem[];
}

export interface JobDescription {
  id: number;
  title: string;
  company: string;
  requiredSkills: string[];
  experienceReq: string;
  educationReq: string;
  description: string;
  employmentType: string;
  createdAt: string;
  updatedAt: string;
  matchCount: number;
  shortlistedCount: number;
}

export interface JobPayload {
  title: string;
  company: string;
  requiredSkills: string[];
  experienceReq: string;
  educationReq: string;
  description: string;
  employmentType: string;
}

export interface CandidateResume {
  id: number;
  candidateName: string;
  email: string;
  phone: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  extractedText: string;
  detectedSkills: string[];
  experienceSummary: string;
  educationSummary: string;
  status: string;
  uploadedAt: string;
  topScore: number | null;
  topJobTitle: string | null;
  topStatus: MatchStatusLabel | null;
  isShortlisted: boolean;
}

export interface CandidateMatchDetail {
  id: number;
  resumeId: number;
  jobId: number;
  jobTitle: string;
  company: string;
  jobDescription: string;
  experienceReq: string;
  educationReq: string;
  employmentType: string;
  overallScore: number;
  skillScore: number;
  similarityScore: number;
  mlPrediction: string;
  mlProbability: number;
  candidateSkills: string[];
  requiredSkills: string[];
  matchedSkills: string[];
  missingSkills: string[];
  status: MatchStatusLabel;
  analyzedAt: string;
  isShortlisted: boolean;
}

export interface CandidateProfileDetail {
  id: number;
  candidateName: string;
  email: string;
  phone: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  extractedText: string;
  detectedSkills: string[];
  experienceSummary: string;
  educationSummary: string;
  status: string;
  uploadedAt: string;
  matches: CandidateMatchDetail[];
}

export interface ShortlistedCandidate {
  shortlistId: number;
  matchId: number;
  resumeId: number;
  jobId: number;
  notes: string;
  shortlistedAt: string;
  candidateName: string;
  email: string;
  phone: string;
  filename: string;
  experienceSummary: string;
  educationSummary: string;
  jobTitle: string;
  company: string;
  overallScore: number;
  skillScore: number;
  similarityScore: number;
  mlProbability: number;
  matchedSkills: string[];
  missingSkills: string[];
  status: MatchStatusLabel;
}

export interface AnalyticsResponse {
  scoreBuckets: Array<{ label: string; count: number }>;
  matchDistribution: Array<{ label: MatchStatusLabel; count: number; color: string }>;
  uploadActivity: Array<{ date: string; count: number }>;
  topSkills: Array<{ skill: string; count: number }>;
  summary: {
    totalCandidates: number;
    shortlistedCandidates: number;
    totalAnalyses: number;
    averageScore: number;
    highMatchRate: number;
  };
}

export interface AppSettings {
  highThreshold: number;
  moderateThreshold: number;
  autoAnalyzeOnUpload: boolean;
  companyDefault: string;
}

export interface UploadFileResult {
  filename: string;
  status: 'uploaded' | 'error';
  resumeId?: number;
  candidateName?: string;
  detectedSkills?: string[];
  error?: string;
}

export interface UploadResponse {
  uploadedCount: number;
  analyzed: boolean;
  results: UploadFileResult[];
}

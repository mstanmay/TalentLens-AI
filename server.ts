import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { buildShortlistCsv } from './server/csvUtils.ts';
import {
  UPLOADS_DIR,
  db,
  getSettings,
  invalidateMLModelCache,
  logActivity,
  runMatchForJobAndResumes,
  seedInitialDataIfEmpty,
  updateSettings,
  type JobRow,
  type ResumeRow,
} from './server/db.ts';
import {
  MAX_RESUME_SIZE_BYTES,
  extractResumeTextFromFile,
  validateResumeFile,
} from './server/fileParser.ts';
import {
  extractCandidateMetadata,
  extractSkills,
  parseSkillList,
} from './server/mlEngine.ts';

seedInitialDataIfEmpty();

const app = express();
app.use(express.json({ limit: '4mb' }));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_RESUME_SIZE_BYTES,
    files: 15,
  },
});

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function formatJob(row: JobRow & { match_count?: number; shortlisted_count?: number }) {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    requiredSkills: parseJsonArray(row.required_skills),
    experienceReq: row.experience_req,
    educationReq: row.education_req,
    description: row.description,
    employmentType: row.employment_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    matchCount: row.match_count ?? 0,
    shortlistedCount: row.shortlisted_count ?? 0,
  };
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Dashboard summary endpoint (all stats computed from SQLite)
app.get('/api/dashboard', (_req, res) => {
  const settings = getSettings();

  const totalResumes = (db.prepare('SELECT COUNT(*) AS c FROM resumes').get() as { c: number }).c;
  const totalJobs = (db.prepare('SELECT COUNT(*) AS c FROM jobs').get() as { c: number }).c;
  const candidatesAnalyzed = (
    db.prepare('SELECT COUNT(DISTINCT resume_id) AS c FROM match_results').get() as { c: number }
  ).c;
  const successfulMatches = (
    db
      .prepare('SELECT COUNT(*) AS c FROM match_results WHERE overall_score >= ?')
      .get(settings.highThreshold) as { c: number }
  ).c;
  const shortlistedCount = (
    db.prepare('SELECT COUNT(*) AS c FROM shortlists').get() as { c: number }
  ).c;
  const avgRow = db
    .prepare('SELECT AVG(overall_score) AS avg_score FROM match_results')
    .get() as { avg_score: number | null };
  const averageMatchScore = avgRow.avg_score ? Number(avgRow.avg_score.toFixed(1)) : 0;

  const recentUploads = (
    db
      .prepare(
        `SELECT id, candidate_name, email, filename, file_size, detected_skills, status, uploaded_at
         FROM resumes ORDER BY uploaded_at DESC, id DESC LIMIT 5`,
      )
      .all() as Array<{
      id: number;
      candidate_name: string;
      email: string;
      filename: string;
      file_size: number;
      detected_skills: string;
      status: string;
      uploaded_at: string;
    }>
  ).map((r) => ({
    id: r.id,
    candidateName: r.candidate_name,
    email: r.email,
    filename: r.filename,
    fileSize: r.file_size,
    detectedSkills: parseJsonArray(r.detected_skills),
    status: r.status,
    uploadedAt: r.uploaded_at,
  }));

  const recentlyAnalyzed = (
    db
      .prepare(
        `SELECT
           r.id AS resume_id,
           r.candidate_name,
           r.filename,
           j.id AS job_id,
           j.title AS job_title,
           m.overall_score,
           m.status,
           m.analyzed_at
         FROM match_results m
         JOIN resumes r ON r.id = m.resume_id
         JOIN jobs j ON j.id = m.job_id
         ORDER BY m.analyzed_at DESC, m.overall_score DESC
         LIMIT 5`,
      )
      .all() as Array<{
      resume_id: number;
      candidate_name: string;
      filename: string;
      job_id: number;
      job_title: string;
      overall_score: number;
      status: string;
      analyzed_at: string;
    }>
  ).map((row) => ({
    resumeId: row.resume_id,
    candidateName: row.candidate_name,
    filename: row.filename,
    jobId: row.job_id,
    jobTitle: row.job_title,
    overallScore: row.overall_score,
    status: row.status,
    analyzedAt: row.analyzed_at,
  }));

  const latestMatches = (
    db
      .prepare(
        `SELECT
           m.id,
           m.resume_id,
           m.job_id,
           r.candidate_name,
           r.filename,
           j.title AS job_title,
           j.company,
           m.overall_score,
           m.skill_score,
           m.similarity_score,
           m.matched_skills,
           m.status,
           m.analyzed_at,
           CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END AS is_shortlisted
         FROM match_results m
         JOIN resumes r ON r.id = m.resume_id
         JOIN jobs j ON j.id = m.job_id
         LEFT JOIN shortlists s ON s.resume_id = m.resume_id AND s.job_id = m.job_id
         ORDER BY m.overall_score DESC, m.analyzed_at DESC
         LIMIT 6`,
      )
      .all() as Array<{
      id: number;
      resume_id: number;
      job_id: number;
      candidate_name: string;
      filename: string;
      job_title: string;
      company: string;
      overall_score: number;
      skill_score: number;
      similarity_score: number;
      matched_skills: string;
      status: string;
      analyzed_at: string;
      is_shortlisted: number;
    }>
  ).map((m) => ({
    id: m.id,
    resumeId: m.resume_id,
    jobId: m.job_id,
    candidateName: m.candidate_name,
    filename: m.filename,
    jobTitle: m.job_title,
    company: m.company,
    overallScore: m.overall_score,
    skillScore: m.skill_score,
    similarityScore: m.similarity_score,
    matchedSkills: parseJsonArray(m.matched_skills),
    status: m.status,
    analyzedAt: m.analyzed_at,
    isShortlisted: m.is_shortlisted === 1,
  }));

  const recentActivities = (
    db
      .prepare(
        'SELECT id, action_type, description, entity_name, created_at FROM activities ORDER BY id DESC LIMIT 8',
      )
      .all() as Array<{
      id: number;
      action_type: string;
      description: string;
      entity_name: string;
      created_at: string;
    }>
  ).map((a) => ({
    id: a.id,
    actionType: a.action_type,
    description: a.description,
    entityName: a.entity_name,
    createdAt: a.created_at,
  }));

  res.json({
    stats: {
      totalResumes,
      totalJobs,
      candidatesAnalyzed,
      successfulMatches,
      shortlistedCount,
      averageMatchScore,
    },
    thresholds: {
      highThreshold: settings.highThreshold,
      moderateThreshold: settings.moderateThreshold,
    },
    recentUploads,
    recentlyAnalyzed,
    latestMatches,
    recentActivities,
  });
});

// Jobs CRUD
app.get('/api/jobs', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT j.*,
        (SELECT COUNT(*) FROM match_results m WHERE m.job_id = j.id) AS match_count,
        (SELECT COUNT(*) FROM shortlists s WHERE s.job_id = j.id) AS shortlisted_count
       FROM jobs j
       ORDER BY j.created_at DESC, j.id DESC`,
    )
    .all() as Array<JobRow & { match_count: number; shortlisted_count: number }>;

  res.json(rows.map(formatJob));
});

app.post('/api/jobs', (req, res) => {
  const { title, company, requiredSkills, experienceReq, educationReq, description, employmentType } =
    req.body ?? {};

  if (!title?.trim() || !description?.trim()) {
    res.status(400).json({ error: 'Job Title and Job Description are required.' });
    return;
  }

  const parsedSkills = parseSkillList(requiredSkills);
  const now = new Date().toISOString();
  const settings = getSettings();

  const info = db
    .prepare(
      `INSERT INTO jobs (
        title, company, required_skills, experience_req, education_req,
        description, employment_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      title.trim(),
      (company ?? settings.companyDefault).trim(),
      JSON.stringify(parsedSkills),
      (experienceReq ?? 'Not specified').trim(),
      (educationReq ?? 'Not specified').trim(),
      description.trim(),
      (employmentType ?? 'Full-time').trim(),
      now,
      now,
    );

  const jobId = Number(info.lastInsertRowid);
  invalidateMLModelCache();
  logActivity('job_created', `Created job description "${title.trim()}"`, title.trim());

  const created = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as JobRow;
  res.status(201).json(formatJob(created));
});

app.put('/api/jobs/:id', (req, res) => {
  const jobId = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as JobRow | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Job description not found.' });
    return;
  }

  const { title, company, requiredSkills, experienceReq, educationReq, description, employmentType } =
    req.body ?? {};

  if (!title?.trim() || !description?.trim()) {
    res.status(400).json({ error: 'Job Title and Job Description are required.' });
    return;
  }

  const parsedSkills = parseSkillList(requiredSkills);
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE jobs SET
      title = ?, company = ?, required_skills = ?, experience_req = ?,
      education_req = ?, description = ?, employment_type = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    title.trim(),
    (company ?? existing.company).trim(),
    JSON.stringify(parsedSkills),
    (experienceReq ?? existing.experience_req).trim(),
    (educationReq ?? existing.education_req).trim(),
    description.trim(),
    (employmentType ?? existing.employment_type).trim(),
    now,
    jobId,
  );

  invalidateMLModelCache();
  logActivity('job_created', `Updated job description "${title.trim()}"`, title.trim());

  const updated = db
    .prepare(
      `SELECT j.*,
        (SELECT COUNT(*) FROM match_results m WHERE m.job_id = j.id) AS match_count,
        (SELECT COUNT(*) FROM shortlists s WHERE s.job_id = j.id) AS shortlisted_count
       FROM jobs j WHERE j.id = ?`,
    )
    .get(jobId) as JobRow & { match_count: number; shortlisted_count: number };

  res.json(formatJob(updated));
});

app.delete('/api/jobs/:id', (req, res) => {
  const jobId = Number(req.params.id);
  const existing = db.prepare('SELECT title FROM jobs WHERE id = ?').get(jobId) as
    | { title: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Job description not found.' });
    return;
  }

  db.prepare('DELETE FROM jobs WHERE id = ?').run(jobId);
  invalidateMLModelCache();
  logActivity('job_created', `Deleted job description "${existing.title}"`, existing.title);
  res.json({ deleted: true, id: jobId });
});

// Resumes list & detail
app.get('/api/resumes', (req, res) => {
  const search = String(req.query.search ?? '').trim().toLowerCase();
  const rows = db
    .prepare(
      `SELECT r.*,
        (SELECT MAX(m.overall_score) FROM match_results m WHERE m.resume_id = r.id) AS top_score,
        (SELECT j.title FROM match_results m JOIN jobs j ON j.id = m.job_id
          WHERE m.resume_id = r.id ORDER BY m.overall_score DESC LIMIT 1) AS top_job_title,
        (SELECT m.status FROM match_results m WHERE m.resume_id = r.id
          ORDER BY m.overall_score DESC LIMIT 1) AS top_status,
        (SELECT COUNT(*) FROM shortlists s WHERE s.resume_id = r.id) AS shortlist_count
       FROM resumes r
       ORDER BY r.uploaded_at DESC, r.id DESC`,
    )
    .all() as Array<
    ResumeRow & {
      top_score: number | null;
      top_job_title: string | null;
      top_status: string | null;
      shortlist_count: number;
    }
  >;

  const formatted = rows
    .map((r) => ({
      id: r.id,
      candidateName: r.candidate_name,
      email: r.email,
      phone: r.phone,
      filename: r.filename,
      mimeType: r.mime_type,
      fileSize: r.file_size,
      extractedText: r.extracted_text,
      detectedSkills: parseJsonArray(r.detected_skills),
      experienceSummary: r.experience_summary,
      educationSummary: r.education_summary,
      status: r.status,
      uploadedAt: r.uploaded_at,
      topScore: r.top_score,
      topJobTitle: r.top_job_title,
      topStatus: r.top_status,
      isShortlisted: r.shortlist_count > 0,
    }))
    .filter((r) => {
      if (!search) return true;
      return (
        r.candidateName.toLowerCase().includes(search) ||
        r.filename.toLowerCase().includes(search) ||
        r.email.toLowerCase().includes(search) ||
        r.detectedSkills.some((s) => s.toLowerCase().includes(search))
      );
    });

  res.json(formatted);
});

app.get('/api/resumes/:id', (req, res) => {
  const resumeId = Number(req.params.id);
  const row = db.prepare('SELECT * FROM resumes WHERE id = ?').get(resumeId) as ResumeRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Candidate resume not found.' });
    return;
  }

  const matches = (
    db
      .prepare(
        `SELECT m.*, j.title AS job_title, j.company, j.description AS job_description,
           j.experience_req, j.education_req, j.employment_type,
           CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END AS is_shortlisted
         FROM match_results m
         JOIN jobs j ON j.id = m.job_id
         LEFT JOIN shortlists s ON s.resume_id = m.resume_id AND s.job_id = m.job_id
         WHERE m.resume_id = ?
         ORDER BY m.overall_score DESC`,
      )
      .all(resumeId) as Array<
      Record<string, unknown>
    >
  ).map((m) => ({
    id: Number(m.id),
    resumeId: Number(m.resume_id),
    jobId: Number(m.job_id),
    jobTitle: String(m.job_title),
    company: String(m.company),
    jobDescription: String(m.job_description),
    experienceReq: String(m.experience_req),
    educationReq: String(m.education_req),
    employmentType: String(m.employment_type),
    overallScore: Number(m.overall_score),
    skillScore: Number(m.skill_score),
    similarityScore: Number(m.similarity_score),
    mlPrediction: String(m.ml_prediction),
    mlProbability: Number(m.ml_probability),
    candidateSkills: parseJsonArray(String(m.candidate_skills)),
    requiredSkills: parseJsonArray(String(m.required_skills)),
    matchedSkills: parseJsonArray(String(m.matched_skills)),
    missingSkills: parseJsonArray(String(m.missing_skills)),
    status: String(m.status),
    analyzedAt: String(m.analyzed_at),
    isShortlisted: Number(m.is_shortlisted) === 1,
  }));

  res.json({
    id: row.id,
    candidateName: row.candidate_name,
    email: row.email,
    phone: row.phone,
    filename: row.filename,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    extractedText: row.extracted_text,
    detectedSkills: parseJsonArray(row.detected_skills),
    experienceSummary: row.experience_summary,
    educationSummary: row.education_summary,
    status: row.status,
    uploadedAt: row.uploaded_at,
    matches,
  });
});

// Resume upload (multi-file PDF & DOCX) -> validates -> extracts text -> stores in DB -> runs ML pipeline
app.post('/api/resumes/upload', upload.array('files', 15), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (files.length === 0) {
    res.status(400).json({ error: 'Please select at least one PDF or DOCX file to upload.' });
    return;
  }

  const targetJobIdRaw = req.body?.jobId ? Number(req.body.jobId) : null;
  const settings = getSettings();
  const shouldAnalyze = req.body?.autoAnalyze === 'true' || (req.body?.autoAnalyze !== 'false' && settings.autoAnalyzeOnUpload);

  const results: Array<{
    filename: string;
    status: 'uploaded' | 'error';
    resumeId?: number;
    candidateName?: string;
    detectedSkills?: string[];
    error?: string;
  }> = [];

  const createdResumeIds: number[] = [];

  for (const file of files) {
    const validationErr = validateResumeFile(file.originalname, file.mimetype, file.size);
    if (validationErr) {
      await fsPromises.unlink(file.path).catch(() => {});
      results.push({ filename: file.originalname, status: 'error', error: validationErr });
      continue;
    }

    try {
      const extractedText = await extractResumeTextFromFile(file.path, file.originalname);
      const meta = extractCandidateMetadata(extractedText, file.originalname);
      const detectedSkills = extractSkills(extractedText);
      const now = new Date().toISOString();

      const info = db
        .prepare(
          `INSERT INTO resumes (
            candidate_name, email, phone, filename, stored_path, mime_type,
            file_size, extracted_text, detected_skills, experience_summary,
            education_summary, status, uploaded_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Processed', ?)`,
        )
        .run(
          meta.candidateName,
          meta.email,
          meta.phone,
          file.originalname,
          file.path,
          file.mimetype,
          file.size,
          extractedText,
          JSON.stringify(detectedSkills),
          meta.experienceSummary,
          meta.educationSummary,
          now,
        );

      const resumeId = Number(info.lastInsertRowid);
      createdResumeIds.push(resumeId);
      results.push({
        filename: file.originalname,
        status: 'uploaded',
        resumeId,
        candidateName: meta.candidateName,
        detectedSkills,
      });
    } catch (err) {
      await fsPromises.unlink(file.path).catch(() => {});
      results.push({
        filename: file.originalname,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to parse resume file.',
      });
    }
  }

  if (createdResumeIds.length > 0) {
    invalidateMLModelCache();
    logActivity(
      'upload',
      `Uploaded and parsed ${createdResumeIds.length} resume${createdResumeIds.length > 1 ? 's' : ''}`,
      results.find((r) => r.status === 'uploaded')?.candidateName ?? 'Resume Upload',
    );

    if (shouldAnalyze) {
      if (targetJobIdRaw) {
        runMatchForJobAndResumes(targetJobIdRaw, createdResumeIds);
      } else {
        const allJobs = db.prepare('SELECT id FROM jobs').all() as Array<{ id: number }>;
        for (const j of allJobs) {
          runMatchForJobAndResumes(j.id, createdResumeIds);
        }
      }
      logActivity(
        'analysis',
        `Automatically screened ${createdResumeIds.length} newly uploaded resume(s) with ML pipeline`,
        'ML Screening Engine',
      );
    }
  }

  const allFailed = createdResumeIds.length === 0;
  res.status(allFailed ? 400 : 201).json({
    uploadedCount: createdResumeIds.length,
    analyzed: shouldAnalyze && createdResumeIds.length > 0,
    results,
  });
});

// Download original resume file (or formatted extract if seeded)
app.get('/api/resumes/:id/download', async (req, res) => {
  const resumeId = Number(req.params.id);
  const row = db.prepare('SELECT * FROM resumes WHERE id = ?').get(resumeId) as ResumeRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Resume not found.' });
    return;
  }

  if (row.stored_path && fs.existsSync(row.stored_path)) {
    res.download(row.stored_path, row.filename);
    return;
  }

  const baseName = row.filename.replace(/\.[^.]+$/, '');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${baseName}_extract.txt"`);
  res.send(
    `CANDIDATE RESUME RECORD\n` +
      `Candidate: ${row.candidate_name}\n` +
      `Original File: ${row.filename}\n` +
      `Email: ${row.email || 'N/A'}\n` +
      `Phone: ${row.phone || 'N/A'}\n` +
      `Uploaded: ${row.uploaded_at}\n` +
      `----------------------------------------\n\n` +
      `${row.extracted_text}\n`,
  );
});

app.delete('/api/resumes/:id', async (req, res) => {
  const resumeId = Number(req.params.id);
  const row = db.prepare('SELECT * FROM resumes WHERE id = ?').get(resumeId) as ResumeRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Resume not found.' });
    return;
  }

  if (row.stored_path && fs.existsSync(row.stored_path)) {
    await fsPromises.unlink(row.stored_path).catch(() => {});
  }
  db.prepare('DELETE FROM resumes WHERE id = ?').run(resumeId);
  invalidateMLModelCache();
  logActivity('upload', `Removed candidate "${row.candidate_name}" from database`, row.candidate_name);
  res.json({ deleted: true, id: resumeId });
});

// Trigger ML pipeline matching for a job
app.post('/api/match/analyze', (req, res) => {
  const jobId = Number(req.body?.jobId);
  if (!jobId) {
    res.status(400).json({ error: 'Please select a valid Job Description to analyze.' });
    return;
  }

  const job = db.prepare('SELECT id, title FROM jobs WHERE id = ?').get(jobId) as
    | { id: number; title: string }
    | undefined;
  if (!job) {
    res.status(404).json({ error: 'Selected job description not found.' });
    return;
  }

  const resumeIds = Array.isArray(req.body?.resumeIds)
    ? req.body.resumeIds.map(Number).filter((n: number) => Number.isFinite(n))
    : undefined;

  const analyzed = runMatchForJobAndResumes(jobId, resumeIds);
  logActivity(
    'analysis',
    `Analyzed ${analyzed.length} resumes against "${job.title}" using TF-IDF & Logistic Regression`,
    job.title,
  );

  res.json({
    jobId: job.id,
    jobTitle: job.title,
    analyzedCount: analyzed.length,
  });
});

// Query ranked AI matching results
app.get('/api/matches', (req, res) => {
  const jobId = req.query.jobId ? Number(req.query.jobId) : null;
  const search = String(req.query.search ?? '').trim().toLowerCase();
  const statusFilter = String(req.query.status ?? '').trim();
  const shortlistedOnly = req.query.shortlistedOnly === 'true';
  const sortDir = req.query.sort === 'asc' ? 'ASC' : 'DESC';

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (jobId) {
    whereClauses.push('m.job_id = ?');
    params.push(jobId);
  }
  if (statusFilter && statusFilter !== 'All') {
    whereClauses.push('m.status = ?');
    params.push(statusFilter);
  }
  if (shortlistedOnly) {
    whereClauses.push('s.id IS NOT NULL');
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const rows = db
    .prepare(
      `SELECT
         m.*,
         r.candidate_name,
         r.email,
         r.filename,
         r.experience_summary,
         r.education_summary,
         j.title AS job_title,
         j.company,
         CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END AS is_shortlisted
       FROM match_results m
       JOIN resumes r ON r.id = m.resume_id
       JOIN jobs j ON j.id = m.job_id
       LEFT JOIN shortlists s ON s.resume_id = m.resume_id AND s.job_id = m.job_id
       ${whereSql}
       ORDER BY m.overall_score ${sortDir}, m.similarity_score ${sortDir}`,
    )
    .all(...params) as Array<Record<string, unknown>>;

  const formatted = rows
    .map((m) => ({
      id: Number(m.id),
      resumeId: Number(m.resume_id),
      jobId: Number(m.job_id),
      candidateName: String(m.candidate_name),
      email: String(m.email ?? ''),
      filename: String(m.filename),
      experienceSummary: String(m.experience_summary ?? ''),
      educationSummary: String(m.education_summary ?? ''),
      jobTitle: String(m.job_title),
      company: String(m.company),
      overallScore: Number(m.overall_score),
      skillScore: Number(m.skill_score),
      similarityScore: Number(m.similarity_score),
      mlPrediction: String(m.ml_prediction),
      mlProbability: Number(m.ml_probability),
      candidateSkills: parseJsonArray(String(m.candidate_skills)),
      requiredSkills: parseJsonArray(String(m.required_skills)),
      matchedSkills: parseJsonArray(String(m.matched_skills)),
      missingSkills: parseJsonArray(String(m.missing_skills)),
      status: String(m.status),
      analyzedAt: String(m.analyzed_at),
      isShortlisted: Number(m.is_shortlisted) === 1,
    }))
    .filter((row) => {
      if (!search) return true;
      return (
        row.candidateName.toLowerCase().includes(search) ||
        row.filename.toLowerCase().includes(search) ||
        row.jobTitle.toLowerCase().includes(search) ||
        row.matchedSkills.some((s) => s.toLowerCase().includes(search)) ||
        row.candidateSkills.some((s) => s.toLowerCase().includes(search))
      );
    })
    .map((row, idx) => ({
      ...row,
      rank: idx + 1,
    }));

  res.json(formatted);
});

// Download individual ML analysis report
app.get('/api/matches/:id/report', (req, res) => {
  const matchId = Number(req.params.id);
  const m = db
    .prepare(
      `SELECT m.*, r.candidate_name, r.email, r.filename, r.experience_summary, r.education_summary,
              j.title AS job_title, j.company, j.description AS job_description
       FROM match_results m
       JOIN resumes r ON r.id = m.resume_id
       JOIN jobs j ON j.id = m.job_id
       WHERE m.id = ?`,
    )
    .get(matchId) as Record<string, unknown> | undefined;

  if (!m) {
    res.status(404).json({ error: 'Analysis report not found.' });
    return;
  }

  const matched = parseJsonArray(String(m.matched_skills));
  const missing = parseJsonArray(String(m.missing_skills));
  const candidateSkills = parseJsonArray(String(m.candidate_skills));
  const safeSlug = String(m.candidate_name).toLowerCase().replace(/[^a-z0-9]+/g, '_');

  const reportText = [
    'TALENTLENS AI — CANDIDATE SCREENING ANALYSIS REPORT',
    '===================================================',
    `Generated: ${new Date().toISOString()}`,
    `Candidate: ${m.candidate_name} (${m.email || 'Email not provided'})`,
    `Resume File: ${m.filename}`,
    `Target Job Role: ${m.job_title} — ${m.company}`,
    '',
    'MACHINE LEARNING SCORING BREAKDOWN',
    '----------------------------------',
    `Overall Match Score: ${Number(m.overall_score).toFixed(2)}%`,
    `Match Category: ${m.status}`,
    `Skill Match Score (60% weight): ${Number(m.skill_score).toFixed(2)}%`,
    `TF-IDF Cosine Similarity (40% weight): ${Number(m.similarity_score).toFixed(2)}%`,
    `Logistic Regression Classification: ${m.ml_prediction} (${Number(m.ml_probability).toFixed(2)}% probability)`,
    '',
    'SKILLS ANALYSIS',
    '---------------',
    `Matched Skills (${matched.length}): ${matched.length ? matched.join(', ') : 'None'}`,
    `Missing Required Skills (${missing.length}): ${missing.length ? missing.join(', ') : 'None'}`,
    `All Candidate Skills (${candidateSkills.length}): ${candidateSkills.length ? candidateSkills.join(', ') : 'None'}`,
    '',
    'CANDIDATE SUMMARY',
    '-----------------',
    `Experience: ${m.experience_summary}`,
    `Education: ${m.education_summary}`,
    `Analyzed Timestamp: ${m.analyzed_at}`,
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeSlug}_screening_report.txt"`);
  res.send(reportText);
});

// Shortlisted candidates
app.get('/api/shortlists', (req, res) => {
  const jobId = req.query.jobId ? Number(req.query.jobId) : null;
  const whereSql = jobId ? 'WHERE s.job_id = ?' : '';
  const params = jobId ? [jobId] : [];

  const rows = db
    .prepare(
      `SELECT
         s.id AS shortlist_id,
         s.resume_id,
         s.job_id,
         s.notes,
         s.shortlisted_at,
         r.candidate_name,
         r.email,
         r.phone,
         r.filename,
         r.experience_summary,
         r.education_summary,
         j.title AS job_title,
         j.company,
         COALESCE(m.id, 0) AS match_id,
         COALESCE(m.overall_score, 0) AS overall_score,
         COALESCE(m.skill_score, 0) AS skill_score,
         COALESCE(m.similarity_score, 0) AS similarity_score,
         COALESCE(m.ml_probability, 0) AS ml_probability,
         COALESCE(m.matched_skills, '[]') AS matched_skills,
         COALESCE(m.missing_skills, '[]') AS missing_skills,
         COALESCE(m.status, 'Moderate Match') AS status
       FROM shortlists s
       JOIN resumes r ON r.id = s.resume_id
       JOIN jobs j ON j.id = s.job_id
       LEFT JOIN match_results m ON m.resume_id = s.resume_id AND m.job_id = s.job_id
       ${whereSql}
       ORDER BY overall_score DESC, s.shortlisted_at DESC`,
    )
    .all(...params) as Array<Record<string, unknown>>;

  res.json(
    rows.map((row) => ({
      shortlistId: Number(row.shortlist_id),
      matchId: Number(row.match_id),
      resumeId: Number(row.resume_id),
      jobId: Number(row.job_id),
      notes: String(row.notes ?? ''),
      shortlistedAt: String(row.shortlisted_at),
      candidateName: String(row.candidate_name),
      email: String(row.email ?? ''),
      phone: String(row.phone ?? ''),
      filename: String(row.filename),
      experienceSummary: String(row.experience_summary ?? ''),
      educationSummary: String(row.education_summary ?? ''),
      jobTitle: String(row.job_title),
      company: String(row.company),
      overallScore: Number(row.overall_score),
      skillScore: Number(row.skill_score),
      similarityScore: Number(row.similarity_score),
      mlProbability: Number(row.ml_probability),
      matchedSkills: parseJsonArray(String(row.matched_skills)),
      missingSkills: parseJsonArray(String(row.missing_skills)),
      status: String(row.status),
    })),
  );
});

app.post('/api/shortlists', (req, res) => {
  const resumeId = Number(req.body?.resumeId);
  const jobId = Number(req.body?.jobId);
  const notes = String(req.body?.notes ?? '').trim();

  if (!resumeId || !jobId) {
    res.status(400).json({ error: 'resumeId and jobId are required.' });
    return;
  }

  const candidate = db.prepare('SELECT candidate_name FROM resumes WHERE id = ?').get(resumeId) as
    | { candidate_name: string }
    | undefined;
  const job = db.prepare('SELECT title FROM jobs WHERE id = ?').get(jobId) as
    | { title: string }
    | undefined;

  if (!candidate || !job) {
    res.status(404).json({ error: 'Candidate or Job not found.' });
    return;
  }

  db.prepare(
    `INSERT INTO shortlists (resume_id, job_id, notes, shortlisted_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(resume_id, job_id) DO UPDATE SET notes = excluded.notes`,
  ).run(resumeId, jobId, notes, new Date().toISOString());

  logActivity(
    'shortlist',
    `Shortlisted ${candidate.candidate_name} for "${job.title}"`,
    candidate.candidate_name,
  );
  res.status(201).json({ shortlisted: true, resumeId, jobId });
});

app.delete('/api/shortlists', (req, res) => {
  const resumeId = Number(req.query.resumeId ?? req.body?.resumeId);
  const jobId = Number(req.query.jobId ?? req.body?.jobId);

  if (!resumeId || !jobId) {
    res.status(400).json({ error: 'resumeId and jobId are required.' });
    return;
  }

  const candidate = db.prepare('SELECT candidate_name FROM resumes WHERE id = ?').get(resumeId) as
    | { candidate_name: string }
    | undefined;

  db.prepare('DELETE FROM shortlists WHERE resume_id = ? AND job_id = ?').run(resumeId, jobId);
  if (candidate) {
    logActivity(
      'shortlist',
      `Removed ${candidate.candidate_name} from shortlist`,
      candidate.candidate_name,
    );
  }
  res.json({ removed: true, resumeId, jobId });
});

app.get('/api/shortlists/export.csv', (req, res) => {
  const jobId = req.query.jobId ? Number(req.query.jobId) : null;
  const whereSql = jobId ? 'WHERE s.job_id = ?' : '';
  const params = jobId ? [jobId] : [];

  const rows = db
    .prepare(
      `SELECT
         r.candidate_name, r.email, r.filename,
         j.title AS job_title, j.company,
         COALESCE(m.overall_score, 0) AS overall_score,
         COALESCE(m.skill_score, 0) AS skill_score,
         COALESCE(m.similarity_score, 0) AS similarity_score,
         COALESCE(m.status, 'Moderate Match') AS status,
         COALESCE(m.matched_skills, '[]') AS matched_skills,
         s.shortlisted_at
       FROM shortlists s
       JOIN resumes r ON r.id = s.resume_id
       JOIN jobs j ON j.id = s.job_id
       LEFT JOIN match_results m ON m.resume_id = s.resume_id AND m.job_id = s.job_id
       ${whereSql}
       ORDER BY overall_score DESC`,
    )
    .all(...params) as Array<Record<string, unknown>>;

  const csv = buildShortlistCsv(
    rows.map((r) => ({
      candidateName: String(r.candidate_name),
      email: String(r.email ?? ''),
      filename: String(r.filename),
      jobTitle: String(r.job_title),
      company: String(r.company),
      overallScore: Number(r.overall_score),
      skillScore: Number(r.skill_score),
      similarityScore: Number(r.similarity_score),
      status: String(r.status),
      matchedSkills: parseJsonArray(String(r.matched_skills)),
      shortlistedAt: String(r.shortlisted_at),
    })),
  );

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="shortlisted_candidates.csv"');
  res.send(csv);
});

// Real database-backed Analytics endpoint
app.get('/api/analytics', (_req, res) => {
  const allMatches = db
    .prepare('SELECT overall_score, status FROM match_results')
    .all() as Array<{ overall_score: number; status: string }>;

  const buckets = [
    { label: '0-20%', min: 0, max: 20, count: 0 },
    { label: '21-40%', min: 20.0001, max: 40, count: 0 },
    { label: '41-60%', min: 40.0001, max: 60, count: 0 },
    { label: '61-80%', min: 60.0001, max: 80, count: 0 },
    { label: '81-100%', min: 80.0001, max: 100, count: 0 },
  ];

  let highCount = 0;
  let moderateCount = 0;
  let lowCount = 0;

  for (const m of allMatches) {
    const score = m.overall_score;
    for (const b of buckets) {
      if (score >= b.min && score <= b.max) {
        b.count++;
        break;
      }
    }
    if (m.status === 'High Match') highCount++;
    else if (m.status === 'Moderate Match') moderateCount++;
    else lowCount++;
  }

  const uploadActivity = (
    db
      .prepare(
        `SELECT substr(uploaded_at, 1, 10) AS date, COUNT(*) AS count
         FROM resumes
         GROUP BY substr(uploaded_at, 1, 10)
         ORDER BY date ASC`,
      )
      .all() as Array<{ date: string; count: number }>
  ).map((d) => ({ date: d.date, count: d.count }));

  const resumeSkillsRows = db
    .prepare('SELECT detected_skills FROM resumes')
    .all() as Array<{ detected_skills: string }>;
  const skillFrequency = new Map<string, number>();
  for (const row of resumeSkillsRows) {
    for (const skill of parseJsonArray(row.detected_skills)) {
      skillFrequency.set(skill, (skillFrequency.get(skill) ?? 0) + 1);
    }
  }
  const topSkills = Array.from(skillFrequency.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([skill, count]) => ({ skill, count }));

  const totalCandidates = (db.prepare('SELECT COUNT(*) AS c FROM resumes').get() as { c: number }).c;
  const shortlistedCandidates = (
    db.prepare('SELECT COUNT(DISTINCT resume_id) AS c FROM shortlists').get() as { c: number }
  ).c;
  const totalAnalyses = allMatches.length;
  const averageScore =
    totalAnalyses > 0
      ? Number(
          (allMatches.reduce((acc, m) => acc + m.overall_score, 0) / totalAnalyses).toFixed(1),
        )
      : 0;

  res.json({
    scoreBuckets: buckets.map(({ label, count }) => ({ label, count })),
    matchDistribution: [
      { label: 'High Match', count: highCount, color: '#16A34A' },
      { label: 'Moderate Match', count: moderateCount, color: '#D97706' },
      { label: 'Low Match', count: lowCount, color: '#DC2626' },
    ],
    uploadActivity,
    topSkills,
    summary: {
      totalCandidates,
      shortlistedCandidates,
      totalAnalyses,
      averageScore,
      highMatchRate: totalAnalyses > 0 ? Number(((highCount / totalAnalyses) * 100).toFixed(1)) : 0,
    },
  });
});

// Settings endpoints
app.get('/api/settings', (_req, res) => {
  res.json(getSettings());
});

app.put('/api/settings', (req, res) => {
  const updated = updateSettings(req.body ?? {});
  res.json(updated);
});

// Global error handler (including multer file size errors)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'Uploaded file exceeds the 10 MB size limit.' });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : 'Unexpected server error';
  res.status(500).json({ error: message });
});

async function startServer() {
  const PORT = Number(process.env.PORT ?? 3000);
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && fs.existsSync(path.resolve(process.cwd(), 'dist'))) {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TalentLens AI server listening on http://localhost:${PORT}`);
  });
}

startServer();

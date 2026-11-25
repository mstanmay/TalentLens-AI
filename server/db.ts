import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import {
  type MLModelBundle,
  type TrainingSample,
  categorizeMatchScore,
  extractCandidateMetadata,
  extractSkills,
  parseSkillList,
  predictResumeMatch,
  trainMLPipeline,
} from './mlEngine.ts';

export interface JobRow {
  id: number;
  title: string;
  company: string;
  required_skills: string;
  experience_req: string;
  education_req: string;
  description: string;
  employment_type: string;
  created_at: string;
  updated_at: string;
}

export interface ResumeRow {
  id: number;
  candidate_name: string;
  email: string;
  phone: string;
  filename: string;
  stored_path: string;
  mime_type: string;
  file_size: number;
  extracted_text: string;
  detected_skills: string;
  experience_summary: string;
  education_summary: string;
  status: string;
  uploaded_at: string;
}

export interface MatchResultRow {
  id: number;
  resume_id: number;
  job_id: number;
  overall_score: number;
  skill_score: number;
  similarity_score: number;
  ml_prediction: string;
  ml_probability: number;
  candidate_skills: string;
  required_skills: string;
  matched_skills: string;
  missing_skills: string;
  status: string;
  analyzed_at: string;
}

export interface AppSettings {
  highThreshold: number;
  moderateThreshold: number;
  autoAnalyzeOnUpload: boolean;
  companyDefault: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const DB_PATH = path.join(DATA_DIR, 'talentlens.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    required_skills TEXT NOT NULL,
    experience_req TEXT NOT NULL,
    education_req TEXT NOT NULL,
    description TEXT NOT NULL,
    employment_type TEXT NOT NULL DEFAULT 'Full-time',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    filename TEXT NOT NULL,
    stored_path TEXT NOT NULL DEFAULT '',
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    extracted_text TEXT NOT NULL,
    detected_skills TEXT NOT NULL DEFAULT '[]',
    experience_summary TEXT NOT NULL DEFAULT '',
    education_summary TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Processed',
    uploaded_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS match_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    overall_score REAL NOT NULL,
    skill_score REAL NOT NULL,
    similarity_score REAL NOT NULL,
    ml_prediction TEXT NOT NULL,
    ml_probability REAL NOT NULL,
    candidate_skills TEXT NOT NULL DEFAULT '[]',
    required_skills TEXT NOT NULL DEFAULT '[]',
    matched_skills TEXT NOT NULL DEFAULT '[]',
    missing_skills TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL,
    analyzed_at TEXT NOT NULL,
    UNIQUE(resume_id, job_id)
  );

  CREATE TABLE IF NOT EXISTS shortlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    notes TEXT NOT NULL DEFAULT '',
    shortlisted_at TEXT NOT NULL,
    UNIQUE(resume_id, job_id)
  );

  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    entity_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export function getSettings(): AppSettings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    highThreshold: Number(map.get('high_threshold') ?? 70),
    moderateThreshold: Number(map.get('moderate_threshold') ?? 45),
    autoAnalyzeOnUpload: (map.get('auto_analyze_on_upload') ?? 'true') === 'true',
    companyDefault: map.get('company_default') ?? 'Northstar Systems',
  };
}

export function updateSettings(next: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const merged: AppSettings = {
    highThreshold: Math.max(10, Math.min(99, Number(next.highThreshold ?? current.highThreshold))),
    moderateThreshold: Math.max(5, Math.min(95, Number(next.moderateThreshold ?? current.moderateThreshold))),
    autoAnalyzeOnUpload:
      typeof next.autoAnalyzeOnUpload === 'boolean'
        ? next.autoAnalyzeOnUpload
        : current.autoAnalyzeOnUpload,
    companyDefault: (next.companyDefault ?? current.companyDefault).trim() || 'Northstar Systems',
  };

  if (merged.moderateThreshold >= merged.highThreshold) {
    merged.moderateThreshold = Math.max(5, merged.highThreshold - 10);
  }

  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  const tx = db.transaction(() => {
    upsert.run('high_threshold', String(merged.highThreshold));
    upsert.run('moderate_threshold', String(merged.moderateThreshold));
    upsert.run('auto_analyze_on_upload', String(merged.autoAnalyzeOnUpload));
    upsert.run('company_default', merged.companyDefault);

    // Recategorize existing match_results immediately when thresholds change
    const allMatches = db.prepare('SELECT id, overall_score FROM match_results').all() as Array<{
      id: number;
      overall_score: number;
    }>;
    const updateStatus = db.prepare('UPDATE match_results SET status = ? WHERE id = ?');
    for (const m of allMatches) {
      updateStatus.run(
        categorizeMatchScore(m.overall_score, merged.highThreshold, merged.moderateThreshold),
        m.id,
      );
    }
  });
  tx();

  logActivity(
    'settings',
    `Updated scoring thresholds (High >= ${merged.highThreshold}%, Moderate >= ${merged.moderateThreshold}%)`,
    'Scoring Thresholds',
  );
  return merged;
}

export function logActivity(actionType: string, description: string, entityName = ''): void {
  db.prepare(
    'INSERT INTO activities (action_type, description, entity_name, created_at) VALUES (?, ?, ?, ?)',
  ).run(actionType, description, entityName, new Date().toISOString());
}

// Balanced reference corpus from the resume screening domain so TF-IDF & LogisticRegression
// always have rich vocabulary and reliable positive/negative decision boundaries.
const REFERENCE_TRAINING_CORPUS: TrainingSample[] = [
  {
    resumeText:
      'Senior Python Developer with strong experience in Python, SQL, Flask, Django, Machine Learning, REST API, Pandas, NumPy, Scikit-learn, Docker, Git, and AWS.',
    jobRole: 'Python ML Engineer',
    jobDescription:
      'Seeking a Python ML Engineer skilled in Python, SQL, Flask, Machine Learning, Pandas, NumPy, Scikit-learn, REST API, and Docker.',
    label: 1,
  },
  {
    resumeText:
      'Full-Stack Software Engineer experienced in React, TypeScript, JavaScript, Node.js, HTML, CSS, MongoDB, SQL, REST API, Docker, and Git.',
    jobRole: 'Full-Stack React Developer',
    jobDescription:
      'Looking for a Full-Stack Developer proficient in React, TypeScript, JavaScript, Node.js, HTML, CSS, SQL, and REST API.',
    label: 1,
  },
  {
    resumeText:
      'Data Analyst and Business Intelligence Engineer specializing in SQL, Python, Data Analysis, Data Visualization, Power BI, Tableau, Excel, Statistics, and Communication.',
    jobRole: 'Data Analytics Specialist',
    jobDescription:
      'Hiring a Data Analyst with expertise in SQL, Python, Data Analysis, Data Visualization, Power BI, Tableau, Excel, and Statistics.',
    label: 1,
  },
  {
    resumeText:
      'Cloud DevOps Engineer with Linux, AWS, Azure, Docker, Kubernetes, Python, Git, and Project Management experience building CI/CD infrastructure.',
    jobRole: 'Cloud DevOps Architect',
    jobDescription:
      'Cloud DevOps Architect role requiring AWS, Azure, Docker, Kubernetes, Linux, Python, and Git automation.',
    label: 1,
  },
  {
    resumeText:
      'Enterprise Backend Engineer skilled in Java, Spring Boot, SQL, MySQL, REST API, Docker, Kubernetes, Git, and Microservices.',
    jobRole: 'Java Backend Engineer',
    jobDescription:
      'Backend Developer fluent in Java, Spring Boot, SQL, MySQL, REST API, and Docker.',
    label: 1,
  },
  {
    resumeText:
      'Deep Learning Researcher with PyTorch, TensorFlow, Python, NumPy, Machine Learning, Deep Learning, Artificial Intelligence, and Statistics.',
    jobRole: 'AI Research Scientist',
    jobDescription:
      'AI Scientist focused on Deep Learning, Artificial Intelligence, TensorFlow, PyTorch, Python, and Machine Learning.',
    label: 1,
  },
  {
    resumeText:
      'Graphic Designer proficient in Photoshop, Illustrator, branding, print layout, typography, logo design, and video editing.',
    jobRole: 'Python ML Engineer',
    jobDescription:
      'Seeking a Python ML Engineer skilled in Python, SQL, Flask, Machine Learning, Pandas, NumPy, Scikit-learn, REST API, and Docker.',
    label: 0,
  },
  {
    resumeText:
      'Fitness Coach and Personal Trainer specializing in injury prevention, nutrition, strength conditioning, client motivation, and workout programming.',
    jobRole: 'Full-Stack React Developer',
    jobDescription:
      'Looking for a Full-Stack Developer proficient in React, TypeScript, JavaScript, Node.js, HTML, CSS, SQL, and REST API.',
    label: 0,
  },
  {
    resumeText:
      'Supply Chain Coordinator with logistics, procurement, vendor negotiation, warehouse inventory, and freight scheduling experience.',
    jobRole: 'AI Research Scientist',
    jobDescription:
      'AI Scientist focused on Deep Learning, Artificial Intelligence, TensorFlow, PyTorch, Python, and Machine Learning.',
    label: 0,
  },
  {
    resumeText:
      'Registered Physician with clinical pharmacology, medical terminology, patient care, surgical triage, and ACLS certification.',
    jobRole: 'Cloud DevOps Architect',
    jobDescription:
      'Cloud DevOps Architect role requiring AWS, Azure, Docker, Kubernetes, Linux, Python, and Git automation.',
    label: 0,
  },
  {
    resumeText:
      'Retail Store Manager experienced in merchandising, point of sale, shift scheduling, customer service, and cash handling.',
    jobRole: 'Data Analytics Specialist',
    jobDescription:
      'Hiring a Data Analyst with expertise in SQL, Python, Data Analysis, Data Visualization, Power BI, Tableau, Excel, and Statistics.',
    label: 0,
  },
  {
    resumeText:
      'Elementary School Teacher skilled in curriculum planning, classroom management, student assessment, and parent communication.',
    jobRole: 'Java Backend Engineer',
    jobDescription:
      'Backend Developer fluent in Java, Spring Boot, SQL, MySQL, REST API, and Docker.',
    label: 0,
  },
];

let cachedModel: MLModelBundle | null = null;

export function invalidateMLModelCache(): void {
  cachedModel = null;
}

export function getMLModel(): MLModelBundle {
  if (cachedModel) return cachedModel;

  const jobs = db.prepare('SELECT title, description FROM jobs').all() as Array<{
    title: string;
    description: string;
  }>;
  const resumes = db.prepare('SELECT extracted_text FROM resumes').all() as Array<{
    extracted_text: string;
  }>;

  const extraCorpusDocs: string[] = [
    ...jobs.map((j) => `${j.title} ${j.description}`),
    ...resumes.map((r) => r.extracted_text),
  ];

  cachedModel = trainMLPipeline(REFERENCE_TRAINING_CORPUS, extraCorpusDocs);
  return cachedModel;
}

export function runMatchForJobAndResumes(jobId: number, resumeIds?: number[]): MatchResultRow[] {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as JobRow | undefined;
  if (!job) {
    throw new Error(`Job #${jobId} not found`);
  }

  const resumes = (
    resumeIds && resumeIds.length > 0
      ? db
          .prepare(`SELECT * FROM resumes WHERE id IN (${resumeIds.map(() => '?').join(',')})`)
          .all(...resumeIds)
      : db.prepare('SELECT * FROM resumes').all()
  ) as ResumeRow[];

  const settings = getSettings();
  const model = getMLModel();
  const explicitJobSkills = parseSkillList(JSON.parse(job.required_skills) as string[]);
  const now = new Date().toISOString();

  const upsertMatch = db.prepare(`
    INSERT INTO match_results (
      resume_id, job_id, overall_score, skill_score, similarity_score,
      ml_prediction, ml_probability, candidate_skills, required_skills,
      matched_skills, missing_skills, status, analyzed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(resume_id, job_id) DO UPDATE SET
      overall_score = excluded.overall_score,
      skill_score = excluded.skill_score,
      similarity_score = excluded.similarity_score,
      ml_prediction = excluded.ml_prediction,
      ml_probability = excluded.ml_probability,
      candidate_skills = excluded.candidate_skills,
      required_skills = excluded.required_skills,
      matched_skills = excluded.matched_skills,
      missing_skills = excluded.missing_skills,
      status = excluded.status,
      analyzed_at = excluded.analyzed_at
  `);

  const markResumeAnalyzed = db.prepare("UPDATE resumes SET status = 'Analyzed' WHERE id = ?");

  const tx = db.transaction(() => {
    for (const resume of resumes) {
      const pred = predictResumeMatch({
        resumeText: resume.extracted_text,
        jobRole: job.title,
        jobDescription: `${job.description} ${job.experience_req} ${job.education_req}`,
        explicitJobSkills,
        highThreshold: settings.highThreshold,
        moderateThreshold: settings.moderateThreshold,
        model,
      });

      upsertMatch.run(
        resume.id,
        job.id,
        pred.overallScore,
        pred.skillScore,
        pred.similarityScore,
        pred.mlPrediction,
        pred.mlProbability,
        JSON.stringify(pred.candidateSkills),
        JSON.stringify(pred.requiredSkills),
        JSON.stringify(pred.matchedSkills),
        JSON.stringify(pred.missingSkills),
        pred.status,
        now,
      );
      markResumeAnalyzed.run(resume.id);
    }
  });

  tx();

  return db
    .prepare('SELECT * FROM match_results WHERE job_id = ? ORDER BY overall_score DESC')
    .all(jobId) as MatchResultRow[];
}

function isoDaysAgo(daysAgo: number, hourOffset = 10): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hourOffset, 15, 0, 0);
  return d.toISOString();
}

export function seedInitialDataIfEmpty(): void {
  const jobCount = (db.prepare('SELECT COUNT(*) as c FROM jobs').get() as { c: number }).c;
  const resumeCount = (db.prepare('SELECT COUNT(*) as c FROM resumes').get() as { c: number }).c;

  // Ensure default settings exist
  const settingsCount = (db.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number }).c;
  if (settingsCount === 0) {
    const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('high_threshold', '70');
    insertSetting.run('moderate_threshold', '45');
    insertSetting.run('auto_analyze_on_upload', 'true');
    insertSetting.run('company_default', 'Northstar Systems');
  }

  if (jobCount > 0 || resumeCount > 0) {
    return;
  }

  const seedJobs = [
    {
      title: 'Senior Python & ML Engineer',
      company: 'Northstar Systems',
      required_skills: ['python', 'sql', 'flask', 'machine learning', 'pandas', 'scikit-learn', 'rest api', 'docker'],
      experience_req: '4+ years building ML pipelines and REST APIs',
      education_req: "Bachelor's or Master's in Computer Science or Data Science",
      description:
        'We are looking for a Senior Python & ML Engineer with strong experience in Python, SQL, Flask, Machine Learning, Pandas, NumPy, Scikit-learn, REST API architecture, and Docker containerization to productionize talent intelligence models.',
      employment_type: 'Full-time',
      created_at: isoDaysAgo(6, 9),
    },
    {
      title: 'Full-Stack React & TypeScript Engineer',
      company: 'Northstar Systems',
      required_skills: ['react', 'typescript', 'javascript', 'node.js', 'html', 'css', 'sql', 'rest api', 'git'],
      experience_req: '3+ years with modern React, TypeScript, and Node.js',
      education_req: "Bachelor's degree in Software Engineering or equivalent",
      description:
        'Join our product engineering team as a Full-Stack React & TypeScript Engineer. You will build high-density SaaS interfaces using React, TypeScript, JavaScript, HTML, CSS, Node.js, SQL, REST API integration, and Git workflows.',
      employment_type: 'Full-time',
      created_at: isoDaysAgo(5, 11),
    },
    {
      title: 'Data Analytics & BI Specialist',
      company: 'Veridian Health Analytics',
      required_skills: ['sql', 'python', 'data analysis', 'data visualization', 'power bi', 'tableau', 'excel', 'statistics'],
      experience_req: '2-5 years in quantitative analytics or BI reporting',
      education_req: "Bachelor's in Statistics, Economics, or Applied Mathematics",
      description:
        'Seeking a Data Analytics & BI Specialist proficient in SQL, Python, Data Analysis, Data Visualization, Power BI, Tableau, Excel, and Statistics to deliver executive reporting and predictive workforce insights.',
      employment_type: 'Full-time',
      created_at: isoDaysAgo(4, 14),
    },
    {
      title: 'Cloud DevOps & Platform Architect',
      company: 'Aether Cloud Labs',
      required_skills: ['aws', 'azure', 'docker', 'kubernetes', 'linux', 'python', 'git', 'project management'],
      experience_req: '5+ years managing multi-region Kubernetes & cloud infra',
      education_req: "Bachelor's in Computer Systems or Cloud Computing",
      description:
        'We need a Cloud DevOps & Platform Architect experienced in AWS, Azure, Docker, Kubernetes, Linux administration, Python scripting, GitOps, and cross-functional Project Management.',
      employment_type: 'Contract',
      created_at: isoDaysAgo(2, 16),
    },
  ];

  const insertJob = db.prepare(`
    INSERT INTO jobs (
      title, company, required_skills, experience_req, education_req,
      description, employment_type, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const jobIds: number[] = [];
  for (const job of seedJobs) {
    const info = insertJob.run(
      job.title,
      job.company,
      JSON.stringify(job.required_skills),
      job.experience_req,
      job.education_req,
      job.description,
      job.employment_type,
      job.created_at,
      job.created_at,
    );
    jobIds.push(Number(info.lastInsertRowid));
  }

  const seedResumes = [
    {
      filename: 'priya_nair_ml_resume.pdf',
      mime_type: 'application/pdf',
      daysAgo: 6,
      text: `Priya Nair
priya.nair@example.com | (415) 890-2311
Senior Machine Learning Engineer with 6+ years of experience designing NLP and predictive scoring systems.
Education: Master's in Computer Science, University of Washington.
Technical Skills: Python, SQL, Flask, Machine Learning, Deep Learning, Pandas, NumPy, Scikit-learn, TensorFlow, REST API, Docker, Git, AWS.
Experience:
- Lead ML Engineer at QuantMetric Labs (2022-Present): Built TF-IDF cosine similarity and logistic regression ranking APIs using Python, Flask, Scikit-learn, and Docker.
- Data Scientist at FinPulse (2019-2022): Engineered ETL pipelines in Python, SQL, Pandas, and NumPy deployed on AWS.`,
    },
    {
      filename: 'marcus_chen_fullstack.pdf',
      mime_type: 'application/pdf',
      daysAgo: 5,
      text: `Marcus Chen
marcus.chen@example.com | (206) 441-7820
Full-Stack Software Engineer with 5+ years of experience building enterprise SaaS applications.
Education: Bachelor's in Software Engineering, UC San Diego.
Technical Skills: React, TypeScript, JavaScript, Node.js, HTML, CSS, SQL, MongoDB, REST API, Docker, Git, Communication.
Experience:
- Senior Frontend & Platform Engineer at CloudLedger (2021-Present): Architected React and TypeScript dashboards backed by Node.js REST APIs and SQL databases.
- Software Developer at BrightStack (2019-2021): Built responsive HTML, CSS, JavaScript, and MongoDB customer portals.`,
    },
    {
      filename: 'elena_rostova_data_analyst.docx',
      mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      daysAgo: 4,
      text: `Elena Rostova
elena.rostova@example.com | (312) 609-4432
Senior Data & Business Intelligence Analyst with 4+ years of experience turning complex operational datasets into executive dashboards.
Education: Master's in Applied Statistics, University of Chicago.
Skills: SQL, Python, Data Analysis, Data Visualization, Power BI, Tableau, Excel, Statistics, Pandas, Communication, Project Management.
Experience:
- Lead BI Analyst at MedCore Systems (2022-Present): Built automated Power BI and Tableau suites using SQL, Python, and statistical forecasting.
- Operations Analyst at FreightGrid (2020-2022): Automated Excel and SQL reporting pipelines.`,
    },
    {
      filename: 'david_okonkwo_devops.pdf',
      mime_type: 'application/pdf',
      daysAgo: 3,
      text: `David Okonkwo
david.okonkwo@example.com | (646) 712-9034
Principal Cloud & DevOps Engineer with 7+ years of experience automating multi-cloud Kubernetes workloads.
Education: Bachelor's in Computer Engineering, Georgia Tech.
Core Competencies: AWS, Azure, Docker, Kubernetes, Linux, Python, Git, Project Management, REST API, Communication.
Experience:
- Staff DevOps Architect at NimbusPay (2021-Present): Orchestrated zero-downtime Kubernetes clusters across AWS and Azure using Docker, Linux, and Python automation.
- Site Reliability Engineer at ScaleOps (2018-2021): Managed CI/CD pipelines with Git and Docker.`,
    },
    {
      filename: 'sofia_alvarez_python_dev.pdf',
      mime_type: 'application/pdf',
      daysAgo: 2,
      text: `Sofia Alvarez
sofia.alvarez@example.com | (512) 338-1145
Python Backend Developer with 3 years of experience building APIs and analytics integrations.
Education: Bachelor's in Information Systems, UT Austin.
Technical Stack: Python, SQL, MySQL, Flask, Django, REST API, Git, Linux, HTML, CSS, Excel.
Experience:
- Backend Developer at MetricFlow (2022-Present): Developed Python, Flask, and Django microservices backed by MySQL and REST API endpoints.
- Junior Developer at CivicTech (2021-2022): Maintained Linux scripts and SQL reports.`,
    },
    {
      filename: 'liam_patel_ai_junior.docx',
      mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      daysAgo: 1,
      text: `Liam Patel
liam.patel@example.com | (617) 803-5521
Junior Machine Learning & Data Engineer with 2 years of experience in academic and startup environments.
Education: Bachelor's in Data Science, Northeastern University.
Skills: Python, Pandas, NumPy, Scikit-learn, PyTorch, Machine Learning, Data Analysis, SQL, Git, Statistics.
Experience:
- Junior ML Associate at SynthBio (2023-Present): Trained Scikit-learn and PyTorch classification models with Python, Pandas, NumPy, and SQL.`,
    },
    {
      filename: 'hannah_brooks_frontend.pdf',
      mime_type: 'application/pdf',
      daysAgo: 1,
      text: `Hannah Brooks
hannah.brooks@example.com | (303) 491-6678
Frontend UI Engineer with 3+ years of experience crafting accessible web applications.
Education: Bachelor's in Interactive Media, University of Colorado.
Skills: React, JavaScript, TypeScript, HTML, CSS, Git, Communication, Data Visualization.
Experience:
- UI Engineer at CivicPortal (2022-Present): Built React and TypeScript component systems with responsive CSS and accessible HTML.`,
    },
    {
      filename: 'owen_carter_creative_lead.pdf',
      mime_type: 'application/pdf',
      daysAgo: 0,
      text: `Owen Carter
owen.carter@example.com | (404) 225-8890
Brand & Visual Designer with 6 years of experience in Photoshop, Illustrator, brand identity, typography, motion graphics, and video editing.
Education: Bachelor's in Fine Arts, SCAD.
Skills: Communication, Project Management, Adobe Creative Suite, Brand Strategy, Copywriting, Packaging Design.
Experience:
- Creative Lead at StudioBeacon (2020-Present): Directed multi-channel visual branding campaigns and video production for consumer retail clients.`,
    },
  ];

  const insertResume = db.prepare(`
    INSERT INTO resumes (
      candidate_name, email, phone, filename, stored_path, mime_type,
      file_size, extracted_text, detected_skills, experience_summary,
      education_summary, status, uploaded_at
    ) VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, 'Processed', ?)
  `);

  const resumeIds: number[] = [];
  for (const r of seedResumes) {
    const meta = extractCandidateMetadata(r.text, r.filename);
    const skills = extractSkills(r.text);
    const uploadedAt = isoDaysAgo(r.daysAgo, 10 + (resumeIds.length % 6));
    const info = insertResume.run(
      meta.candidateName,
      meta.email,
      meta.phone,
      r.filename,
      r.mime_type,
      Buffer.byteLength(r.text, 'utf8') * 14,
      r.text,
      JSON.stringify(skills),
      meta.experienceSummary,
      meta.educationSummary,
      uploadedAt,
    );
    resumeIds.push(Number(info.lastInsertRowid));
  }

  // Run the real ML pipeline across all seeded jobs & resumes
  invalidateMLModelCache();
  for (const jId of jobIds) {
    runMatchForJobAndResumes(jId);
  }

  // Shortlist the highest-scoring real matches
  const topMatches = db
    .prepare(
      `SELECT resume_id, job_id, overall_score FROM match_results
       WHERE status = 'High Match'
       ORDER BY overall_score DESC LIMIT 3`,
    )
    .all() as Array<{ resume_id: number; job_id: number; overall_score: number }>;

  const insertShortlist = db.prepare(
    'INSERT OR IGNORE INTO shortlists (resume_id, job_id, notes, shortlisted_at) VALUES (?, ?, ?, ?)',
  );
  for (const m of topMatches) {
    insertShortlist.run(
      m.resume_id,
      m.job_id,
      `Auto-shortlisted top candidate (${m.overall_score.toFixed(1)}% ML match score)`,
      isoDaysAgo(0, 11),
    );
  }

  logActivity('job_created', 'Initialized 4 active recruitment job descriptions', 'Job Pipeline');
  logActivity('upload', `Ingested ${resumeIds.length} candidate resumes into repository`, 'Resume Repository');
  logActivity(
    'analysis',
    `Completed TF-IDF cosine similarity & Logistic Regression screening across ${jobIds.length} roles`,
    'ML Screening Engine',
  );
  if (topMatches.length > 0) {
    logActivity(
      'shortlist',
      `Shortlisted ${topMatches.length} High Match candidates for recruiter review`,
      'Candidate Shortlist',
    );
  }
}

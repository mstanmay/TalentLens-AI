export const SKILL_DICTIONARY: readonly string[] = [
  'python',
  'java',
  'javascript',
  'typescript',
  'c++',
  'c#',
  '.net',
  'sql',
  'mysql',
  'mongodb',
  'react',
  'node.js',
  'django',
  'flask',
  'html',
  'css',
  'machine learning',
  'deep learning',
  'artificial intelligence',
  'data analysis',
  'data visualization',
  'pandas',
  'numpy',
  'tensorflow',
  'pytorch',
  'scikit-learn',
  'power bi',
  'tableau',
  'excel',
  'aws',
  'azure',
  'docker',
  'kubernetes',
  'git',
  'linux',
  'communication',
  'project management',
  'statistics',
  'rest api',
  'spring boot',
];

// Standard English stop words matching sklearn's ENGLISH_STOP_WORDS
const ENGLISH_STOP_WORDS = new Set([
  'a', 'about', 'above', 'across', 'after', 'afterwards', 'again', 'against', 'all', 'almost',
  'alone', 'along', 'already', 'also', 'although', 'always', 'am', 'among', 'amongst', 'amoungst',
  'amount', 'an', 'and', 'another', 'any', 'anyhow', 'anyone', 'anything', 'anyway', 'anywhere',
  'are', 'around', 'as', 'at', 'back', 'be', 'became', 'because', 'become', 'becomes', 'becoming',
  'been', 'before', 'beforehand', 'behind', 'being', 'below', 'beside', 'besides', 'between',
  'beyond', 'bill', 'both', 'bottom', 'but', 'by', 'call', 'can', 'cannot', 'cant', 'co', 'con',
  'could', 'couldnt', 'cry', 'de', 'describe', 'detail', 'do', 'done', 'down', 'due', 'during',
  'each', 'eg', 'eight', 'either', 'eleven', 'else', 'elsewhere', 'empty', 'enough', 'etc', 'even',
  'ever', 'every', 'everyone', 'everything', 'everywhere', 'except', 'few', 'fifteen', 'fifty',
  'fill', 'find', 'fire', 'first', 'five', 'for', 'former', 'formerly', 'forty', 'found', 'four',
  'from', 'front', 'full', 'further', 'get', 'give', 'go', 'had', 'has', 'hasnt', 'have', 'he',
  'hence', 'her', 'here', 'hereafter', 'hereby', 'herein', 'hereupon', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'however', 'hundred', 'i', 'ie', 'if', 'in', 'inc', 'indeed',
  'interest', 'into', 'is', 'it', 'its', 'itself', 'keep', 'last', 'latter', 'latterly', 'least',
  'less', 'ltd', 'made', 'many', 'may', 'me', 'meanwhile', 'might', 'mill', 'mine', 'more',
  'moreover', 'most', 'mostly', 'move', 'much', 'must', 'my', 'myself', 'name', 'namely',
  'neither', 'never', 'nevertheless', 'next', 'nine', 'no', 'nobody', 'none', 'noone', 'nor',
  'not', 'nothing', 'now', 'nowhere', 'of', 'off', 'often', 'on', 'once', 'one', 'only', 'onto',
  'or', 'other', 'others', 'otherwise', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'part',
  'per', 'perhaps', 'please', 'put', 'rather', 're', 'same', 'see', 'seem', 'seemed', 'seeming',
  'seems', 'serious', 'several', 'she', 'should', 'show', 'side', 'since', 'sincere', 'six',
  'sixty', 'so', 'some', 'somehow', 'someone', 'something', 'sometime', 'sometimes', 'somewhere',
  'still', 'such', 'system', 'take', 'ten', 'than', 'that', 'the', 'their', 'them', 'themselves',
  'then', 'thence', 'there', 'thereafter', 'thereby', 'therefore', 'therein', 'thereupon', 'these',
  'they', 'thick', 'thin', 'third', 'this', 'those', 'though', 'three', 'through', 'throughout',
  'thru', 'thus', 'to', 'together', 'too', 'top', 'toward', 'towards', 'twelve', 'twenty', 'two',
  'un', 'under', 'until', 'up', 'upon', 'us', 'very', 'via', 'was', 'we', 'well', 'were', 'what',
  'whatever', 'when', 'whence', 'whenever', 'where', 'whereafter', 'whereas', 'whereby', 'wherein',
  'whereupon', 'wherever', 'whether', 'which', 'while', 'whither', 'who', 'whoever', 'whole',
  'whom', 'whose', 'why', 'will', 'with', 'within', 'without', 'would', 'yet', 'you', 'your',
  'yours', 'yourself', 'yourselves',
]);

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? m)
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Exact implementation of notebook's `clean_text(text)` function:
 * 1. Convert to string
 * 2. Decode HTML entities
 * 3. Remove HTML tags (<[^>]+>)
 * 4. Lowercase
 * 5. Remove URLs (http\S+|www\S+)
 * 6. Collapse whitespace & trim
 */
export function cleanText(text: unknown): string {
  let cleaned = String(text ?? '');
  cleaned = decodeHtmlEntities(cleaned);
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');
  cleaned = cleaned.toLowerCase();
  cleaned = cleaned.replace(/http\S+|www\S+/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ');
  return cleaned.trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractSkills(text: string, extraSkills: string[] = []): string[] {
  const cleaned = cleanText(text);
  const candidates = new Set<string>(SKILL_DICTIONARY);
  for (const extra of extraSkills) {
    const norm = cleanText(extra);
    if (norm.length >= 2) {
      candidates.add(norm);
    }
  }

  const found: string[] = [];
  for (const skill of candidates) {
    const pattern = new RegExp(`(?<!\\w)${escapeRegex(skill)}(?!\\w)`, 'i');
    if (pattern.test(cleaned)) {
      found.push(skill);
    }
  }
  return found.sort();
}

export interface SkillMatchResult {
  candidateSkills: string[];
  requiredSkills: string[];
  matchedSkills: string[];
  missingSkills: string[];
  skillScore: number;
}

export function parseSkillList(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : raw.split(/[,;\n]+/);
  return Array.from(
    new Set(
      items
        .map((item) => cleanText(item))
        .filter((item) => item.length >= 2),
    ),
  ).sort();
}

/**
 * Preserves notebook's `match_skills(resume, job_description)` logic while also
 * honoring any explicit skills listed on custom job descriptions.
 */
export function matchSkills(
  resume: string,
  jobDescription: string,
  explicitJobSkills: string[] = [],
): SkillMatchResult {
  const cleanedExplicit = parseSkillList(explicitJobSkills);
  const candidateSkills = extractSkills(resume, cleanedExplicit);
  const extractedJobSkills = extractSkills(jobDescription, cleanedExplicit);

  const requiredSet = new Set<string>([...extractedJobSkills, ...cleanedExplicit]);
  const requiredSkills = Array.from(requiredSet).sort();

  const candidateSet = new Set(candidateSkills);
  const matchedSkills = requiredSkills.filter((skill) => candidateSet.has(skill)).sort();
  const missingSkills = requiredSkills.filter((skill) => !candidateSet.has(skill)).sort();

  const skillScore =
    requiredSkills.length > 0 ? (matchedSkills.length / requiredSkills.length) * 100 : 0;

  return {
    candidateSkills,
    requiredSkills,
    matchedSkills,
    missingSkills,
    skillScore,
  };
}

export type SparseVector = Map<number, number>;

function tokenizeText(cleaned: string): string[] {
  // Tokenize words (2+ chars) and preserve technical tokens like c++, c#, .net, node.js
  const rawTokens = cleaned.match(/[a-z0-9]+(?:[+#.][a-z0-9+#]+)*/g) ?? [];
  const unigrams = rawTokens.filter(
    (tok) => tok.length >= 2 && !ENGLISH_STOP_WORDS.has(tok),
  );

  const ngrams: string[] = [...unigrams];
  for (let i = 0; i < unigrams.length - 1; i++) {
    ngrams.push(`${unigrams[i]} ${unigrams[i + 1]}`);
  }
  return ngrams;
}

/**
 * TF-IDF Vectorizer implementing:
 * - max_features = 20000
 * - stop_words = "english"
 * - ngram_range = (1, 2)
 * - min_df = 2 (auto-adapts to 1 if corpus has fewer than 4 documents)
 * - sublinear_tf = True
 * - L2 normalization (sklearn default norm='l2', smooth_idf=True)
 */
export class TfidfVectorizer {
  private readonly maxFeatures: number;
  private readonly minDf: number;
  private vocabulary = new Map<string, number>();
  private idf: number[] = [];

  constructor(options?: { maxFeatures?: number; minDf?: number }) {
    this.maxFeatures = options?.maxFeatures ?? 20000;
    this.minDf = options?.minDf ?? 2;
  }

  fit(documents: string[]): void {
    const nDocs = documents.length;
    const effectiveMinDf = nDocs < 4 ? 1 : this.minDf;

    const dfCounts = new Map<string, number>();
    const totalTfCounts = new Map<string, number>();

    for (const doc of documents) {
      const tokens = tokenizeText(cleanText(doc));
      const seenInDoc = new Set<string>();
      for (const token of tokens) {
        totalTfCounts.set(token, (totalTfCounts.get(token) ?? 0) + 1);
        if (!seenInDoc.has(token)) {
          seenInDoc.add(token);
          dfCounts.set(token, (dfCounts.get(token) ?? 0) + 1);
        }
      }
    }

    const eligibleTerms = Array.from(dfCounts.entries())
      .filter(([, df]) => df >= effectiveMinDf)
      .sort((a, b) => {
        const tfDiff = (totalTfCounts.get(b[0]) ?? 0) - (totalTfCounts.get(a[0]) ?? 0);
        return tfDiff !== 0 ? tfDiff : a[0].localeCompare(b[0]);
      })
      .slice(0, this.maxFeatures);

    this.vocabulary = new Map<string, number>();
    this.idf = [];

    eligibleTerms.forEach(([term, df], idx) => {
      this.vocabulary.set(term, idx);
      // sklearn smooth_idf=True formula: ln((1 + n) / (1 + df)) + 1
      this.idf.push(Math.log((1 + nDocs) / (1 + df)) + 1);
    });
  }

  transformSingle(document: string): SparseVector {
    const tokens = tokenizeText(cleanText(document));
    const tfCounts = new Map<number, number>();

    for (const token of tokens) {
      const termIdx = this.vocabulary.get(token);
      if (termIdx !== undefined) {
        tfCounts.set(termIdx, (tfCounts.get(termIdx) ?? 0) + 1);
      }
    }

    const vector: SparseVector = new Map();
    let normSq = 0;

    for (const [termIdx, tf] of tfCounts.entries()) {
      // sublinear_tf = True => 1 + ln(tf)
      const weightedTf = 1 + Math.log(tf);
      const tfidf = weightedTf * this.idf[termIdx];
      vector.set(termIdx, tfidf);
      normSq += tfidf * tfidf;
    }

    if (normSq > 0) {
      const norm = Math.sqrt(normSq);
      for (const [termIdx, val] of vector.entries()) {
        vector.set(termIdx, val / norm);
      }
    }

    return vector;
  }

  get featureCount(): number {
    return this.vocabulary.size;
  }
}

export function cosineSimilarity(vecA: SparseVector, vecB: SparseVector): number {
  if (vecA.size === 0 || vecB.size === 0) return 0;
  const [smaller, larger] = vecA.size <= vecB.size ? [vecA, vecB] : [vecB, vecA];
  let dot = 0;
  for (const [idx, valA] of smaller.entries()) {
    const valB = larger.get(idx);
    if (valB !== undefined) {
      dot += valA * valB;
    }
  }
  return Math.max(0, Math.min(1, dot));
}

/**
 * L2-regularized binary Logistic Regression trained on TF-IDF features of
 * (resume_clean + job_role_clean + job_description_clean) pairs, matching
 * sklearn's LogisticRegression(max_iter=2000, random_state=42).
 */
export class LogisticRegressionClassifier {
  private weights: Float64Array = new Float64Array(0);
  private bias = 0;

  fit(vectors: SparseVector[], labels: number[], featureCount: number, maxIter = 400): void {
    this.weights = new Float64Array(featureCount);
    this.bias = 0;
    const n = vectors.length;
    if (n === 0 || featureCount === 0) return;

    const lr = 0.8;
    const l2Lambda = 1.0 / Math.max(1, n);

    for (let iter = 0; iter < maxIter; iter++) {
      const gradW = new Float64Array(featureCount);
      let gradB = 0;

      for (let i = 0; i < n; i++) {
        const vec = vectors[i];
        const y = labels[i];
        let z = this.bias;
        for (const [idx, val] of vec.entries()) {
          z += this.weights[idx] * val;
        }
        const prob = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
        const err = prob - y;
        gradB += err;
        for (const [idx, val] of vec.entries()) {
          gradW[idx] += err * val;
        }
      }

      this.bias -= (lr * gradB) / n;
      for (let j = 0; j < featureCount; j++) {
        const grad = gradW[j] / n + l2Lambda * this.weights[j];
        this.weights[j] -= lr * grad;
      }
    }
  }

  predictProbability(vector: SparseVector): number {
    let z = this.bias;
    for (const [idx, val] of vector.entries()) {
      if (idx < this.weights.length) {
        z += this.weights[idx] * val;
      }
    }
    return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
  }
}

export interface MLModelBundle {
  vectorizer: TfidfVectorizer;
  classifier: LogisticRegressionClassifier;
}

export interface TrainingSample {
  resumeText: string;
  jobRole: string;
  jobDescription: string;
  label: 0 | 1;
}

export function trainMLPipeline(
  samples: TrainingSample[],
  extraCorpusDocs: string[] = [],
): MLModelBundle {
  const corpusDocs: string[] = [];
  const combinedTexts: string[] = [];
  const labels: number[] = [];

  for (const sample of samples) {
    const resumeClean = cleanText(sample.resumeText);
    const jobClean = `${cleanText(sample.jobRole)} ${cleanText(sample.jobDescription)}`.trim();
    const combined = `${resumeClean} ${jobClean}`.trim();
    corpusDocs.push(resumeClean, jobClean, combined);
    combinedTexts.push(combined);
    labels.push(sample.label);
  }

  for (const doc of extraCorpusDocs) {
    const cleaned = cleanText(doc);
    if (cleaned) {
      corpusDocs.push(cleaned);
    }
  }

  const vectorizer = new TfidfVectorizer({ maxFeatures: 20000, minDf: 2 });
  vectorizer.fit(corpusDocs);

  const combinedVectors = combinedTexts.map((doc) => vectorizer.transformSingle(doc));
  const classifier = new LogisticRegressionClassifier();
  classifier.fit(combinedVectors, labels, vectorizer.featureCount, 350);

  return { vectorizer, classifier };
}

export type MatchStatusLabel = 'High Match' | 'Moderate Match' | 'Low Match';

export function categorizeMatchScore(
  score: number,
  highThreshold = 70,
  moderateThreshold = 45,
): MatchStatusLabel {
  if (score >= highThreshold) return 'High Match';
  if (score >= moderateThreshold) return 'Moderate Match';
  return 'Low Match';
}

export interface ResumeMatchPrediction {
  finalResult: 'Match' | 'Not Match';
  status: MatchStatusLabel;
  overallScore: number;
  skillScore: number;
  similarityScore: number;
  mlPrediction: 'Match' | 'Not Match';
  mlProbability: number;
  candidateSkills: string[];
  requiredSkills: string[];
  matchedSkills: string[];
  missingSkills: string[];
}

export function predictResumeMatch(params: {
  resumeText: string;
  jobRole: string;
  jobDescription: string;
  explicitJobSkills?: string[];
  highThreshold?: number;
  moderateThreshold?: number;
  model: MLModelBundle;
}): ResumeMatchPrediction {
  const {
    resumeText,
    jobRole,
    jobDescription,
    explicitJobSkills = [],
    highThreshold = 70,
    moderateThreshold = 45,
    model,
  } = params;

  const resumeClean = cleanText(resumeText);
  const roleClean = cleanText(jobRole);
  const descriptionClean = cleanText(jobDescription);
  const jobText = `${roleClean} ${descriptionClean}`.trim();
  const combinedText = `${resumeClean} ${jobText}`.trim();

  const textVector = model.vectorizer.transformSingle(combinedText);
  const rawProb = model.classifier.predictProbability(textVector);
  const mlProbability = Number((rawProb * 100).toFixed(2));
  const mlPrediction: 'Match' | 'Not Match' = rawProb >= 0.5 ? 'Match' : 'Not Match';

  const resumeVector = model.vectorizer.transformSingle(resumeClean);
  const jobVector = model.vectorizer.transformSingle(jobText);
  const similarityScore = Number((cosineSimilarity(resumeVector, jobVector) * 100).toFixed(2));

  const skillOutcome = matchSkills(
    resumeText,
    `${jobRole} ${jobDescription}`,
    explicitJobSkills,
  );

  // Exact weighting from notebook's predict_resume_match:
  // 0.60 * skill_score + 0.40 * similarity_score when required skills are present
  const overallRaw =
    skillOutcome.requiredSkills.length > 0
      ? 0.6 * skillOutcome.skillScore + 0.4 * similarityScore
      : similarityScore;
  const overallScore = Number(overallRaw.toFixed(1));
  const finalResult: 'Match' | 'Not Match' = overallScore >= highThreshold ? 'Match' : 'Not Match';
  const status = categorizeMatchScore(overallScore, highThreshold, moderateThreshold);

  return {
    finalResult,
    status,
    overallScore,
    skillScore: Number(skillOutcome.skillScore.toFixed(2)),
    similarityScore,
    mlPrediction,
    mlProbability,
    candidateSkills: skillOutcome.candidateSkills,
    requiredSkills: skillOutcome.requiredSkills,
    matchedSkills: skillOutcome.matchedSkills,
    missingSkills: skillOutcome.missingSkills,
  };
}

export interface ParsedCandidateMeta {
  candidateName: string;
  email: string;
  phone: string;
  experienceSummary: string;
  educationSummary: string;
}

export function extractCandidateMetadata(text: string, filename: string): ParsedCandidateMeta {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/);

  let candidateName = '';
  for (const line of lines.slice(0, 5)) {
    const cleanLine = line.replace(/[^a-zA-Z\s.'-]/g, '').trim();
    const words = cleanLine.split(/\s+/);
    if (
      words.length >= 2 &&
      words.length <= 4 &&
      cleanLine.length >= 4 &&
      cleanLine.length <= 45 &&
      !/resume|curriculum|vitae|summary|profile|experience|skills|proficient/i.test(cleanLine)
    ) {
      candidateName = cleanLine;
      break;
    }
  }

  if (!candidateName) {
    const baseName = filename
      .replace(/\.(pdf|docx|doc|txt)$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b(resume|cv|final|updated)\b/gi, '')
      .trim();
    candidateName = baseName
      ? baseName.replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Uploaded Candidate';
  }

  const expMatch = text.match(
    /(\d+\+?\s*years?\s*(?:of\s*)?(?:experience|exp)?|\b(?:senior|mid-level|junior|lead|principal)-?(?:level)?\s*experience\b)/i,
  );
  const eduMatch = text.match(
    /\b(?:Ph\.?D\.?|Master'?s(?:\s+degree)?|Bachelor'?s(?:\s+degree)?|B\.?S\.?|M\.?S\.?|B\.?Tech|M\.?Tech|MBA|B\.?E\.?)\b[^.\n]{0,70}/i,
  );

  return {
    candidateName,
    email: emailMatch ? emailMatch[0] : '',
    phone: phoneMatch ? phoneMatch[0] : '',
    experienceSummary: expMatch ? expMatch[0].trim() : 'Experience parsed from resume',
    educationSummary: eduMatch ? eduMatch[0].trim() : 'Education details in full text',
  };
}

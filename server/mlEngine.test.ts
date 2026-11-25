import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SKILL_DICTIONARY,
  categorizeMatchScore,
  cleanText,
  cosineSimilarity,
  extractCandidateMetadata,
  extractSkills,
  matchSkills,
  predictResumeMatch,
  trainMLPipeline,
  TfidfVectorizer,
} from './mlEngine.ts';

test('cleanText decodes HTML entities, strips tags and URLs, and normalizes whitespace', () => {
  const dirty = '  <p>Senior &amp; Lead <b>Python</b> Developer! Visit https://example.com/cv or www.test.org</p>\n\t  ';
  assert.equal(cleanText(dirty), 'senior & lead python developer! visit or');
});

test('extractSkills respects word boundaries and supports C++, C#, .NET, Node.js', () => {
  assert.equal(SKILL_DICTIONARY.length, 40);
  const text = 'Experienced in JavaScript, Node.js, C++, .NET, Scikit-learn, and REST API.';
  const skills = extractSkills(text);
  assert.deepEqual(skills, ['.net', 'c++', 'javascript', 'node.js', 'rest api', 'scikit-learn']);
  assert.equal(skills.includes('java'), false);
});

test('matchSkills matches notebook calculation for candidate, required, matched, missing, and score', () => {
  const sampleResume = 'Python developer with experience in Python, SQL, Flask, Machine Learning and Pandas.';
  const sampleJob = 'Looking for a Python developer with Python, SQL, Flask, Machine Learning and TensorFlow.';
  const result = matchSkills(sampleResume, sampleJob);

  assert.deepEqual(result.candidateSkills, ['flask', 'machine learning', 'pandas', 'python', 'sql']);
  assert.deepEqual(result.requiredSkills, ['flask', 'machine learning', 'python', 'sql', 'tensorflow']);
  assert.deepEqual(result.matchedSkills, ['flask', 'machine learning', 'python', 'sql']);
  assert.deepEqual(result.missingSkills, ['tensorflow']);
  assert.equal(result.skillScore, 80);
});

test('TfidfVectorizer + cosineSimilarity ranks matching domain resume far above unrelated resume', () => {
  const docs = [
    'Python developer with Flask, SQL, Machine Learning, REST API, Pandas, NumPy',
    'Looking for Python developer with Python, SQL, Flask, Machine Learning and REST API',
    'Graphic designer with Photoshop, Illustrator, branding, logo design and video editing',
    'Senior React and TypeScript frontend developer building web apps with CSS and HTML',
  ];

  const vectorizer = new TfidfVectorizer({ maxFeatures: 20000, minDf: 1 });
  vectorizer.fit(docs);

  const jobVec = vectorizer.transformSingle(docs[1]);
  const strongSim = cosineSimilarity(vectorizer.transformSingle(docs[0]), jobVec);
  const unrelatedSim = cosineSimilarity(vectorizer.transformSingle(docs[2]), jobVec);

  assert.ok(strongSim > unrelatedSim, `Expected strongSim (${strongSim}) > unrelatedSim (${unrelatedSim})`);
  assert.ok(strongSim > 0.35);
  assert.ok(unrelatedSim < 0.1);
});

test('predictResumeMatch produces weighted overall score, ML classifier output, and threshold status', () => {
  const trainingSamples = [
    {
      resumeText: 'Python Developer with strong experience in Python, SQL, Flask, Machine Learning, REST API, Pandas, NumPy and Scikit-learn.',
      jobRole: 'Python Developer',
      jobDescription: 'Python Developer with skills in Python, SQL, Flask, Machine Learning and REST API.',
      label: 1 as const,
    },
    {
      resumeText: 'React TypeScript Frontend Engineer proficient in HTML, CSS, JavaScript, React, Git.',
      jobRole: 'Frontend Engineer',
      jobDescription: 'Frontend Engineer skilled in React, TypeScript, HTML, CSS, JavaScript.',
      label: 1 as const,
    },
    {
      resumeText: 'Graphic designer with Photoshop, Illustrator, logo design, video editing and branding.',
      jobRole: 'Python Developer',
      jobDescription: 'Python Developer with skills in Python, SQL, Flask, Machine Learning and REST API.',
      label: 0 as const,
    },
    {
      resumeText: 'Fitness Coach skilled in injury prevention, nutrition, workout planning and motivation.',
      jobRole: 'Frontend Engineer',
      jobDescription: 'Frontend Engineer skilled in React, TypeScript, HTML, CSS, JavaScript.',
      label: 0 as const,
    },
  ];

  const model = trainMLPipeline(trainingSamples);
  const strongPrediction = predictResumeMatch({
    resumeText: 'Senior Python Developer skilled in Python, SQL, Flask, Machine Learning, REST API, Pandas, Docker.',
    jobRole: 'Python Developer',
    jobDescription: 'Looking for Python Developer with Python, SQL, Flask, Machine Learning and REST API.',
    model,
    highThreshold: 70,
    moderateThreshold: 45,
  });

  const weakPrediction = predictResumeMatch({
    resumeText: 'Graphic designer with Photoshop, Illustrator, branding and video editing.',
    jobRole: 'Python Developer',
    jobDescription: 'Looking for Python Developer with Python, SQL, Flask, Machine Learning and REST API.',
    model,
    highThreshold: 70,
    moderateThreshold: 45,
  });

  assert.equal(strongPrediction.status, 'High Match');
  assert.ok(strongPrediction.overallScore >= 70);
  assert.equal(strongPrediction.skillScore, 100);
  assert.equal(weakPrediction.status, 'Low Match');
  assert.ok(weakPrediction.overallScore < 45);
  assert.ok(strongPrediction.mlProbability > weakPrediction.mlProbability);
});

test('categorizeMatchScore respects configurable thresholds', () => {
  assert.equal(categorizeMatchScore(75, 70, 45), 'High Match');
  assert.equal(categorizeMatchScore(60, 70, 45), 'Moderate Match');
  assert.equal(categorizeMatchScore(40, 70, 45), 'Low Match');
  assert.equal(categorizeMatchScore(75, 80, 50), 'Moderate Match');
});

test('extractCandidateMetadata extracts name, email, phone, experience, and education', () => {
  const sample = `Priya Nair\npriya.nair@example.com | (415) 555-0192\nSenior ML Engineer with 6+ years of experience designing NLP systems.\nEducation: Master's in Computer Science, University of Washington.`;
  const meta = extractCandidateMetadata(sample, 'priya_nair_resume.pdf');
  assert.equal(meta.candidateName, 'Priya Nair');
  assert.equal(meta.email, 'priya.nair@example.com');
  assert.equal(meta.phone, '(415) 555-0192');
  assert.ok(meta.experienceSummary.toLowerCase().includes('6+ years'));
  assert.ok(meta.educationSummary.includes("Master's in Computer Science"));
});

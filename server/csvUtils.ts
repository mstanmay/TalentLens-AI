export function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildShortlistCsv(
  rows: Array<{
    candidateName: string;
    email: string;
    filename: string;
    jobTitle: string;
    company: string;
    overallScore: number;
    skillScore: number;
    similarityScore: number;
    status: string;
    matchedSkills: string[];
    shortlistedAt: string;
  }>,
): string {
  const headers = [
    'Candidate Name',
    'Email',
    'Resume Filename',
    'Job Role',
    'Company',
    'Overall Match (%)',
    'Skill Score (%)',
    'Cosine Similarity (%)',
    'Match Status',
    'Matched Skills',
    'Shortlisted Date',
  ];

  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.candidateName,
        row.email,
        row.filename,
        row.jobTitle,
        row.company,
        row.overallScore.toFixed(2),
        row.skillScore.toFixed(2),
        row.similarityScore.toFixed(2),
        row.status,
        row.matchedSkills.join('; '),
        row.shortlistedAt,
      ]
        .map(escapeCsvCell)
        .join(','),
    );
  }
  return lines.join('\r\n');
}

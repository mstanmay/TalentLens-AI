import assert from 'node:assert/strict';
import test from 'node:test';
import { buildShortlistCsv, escapeCsvCell } from './csvUtils.ts';

test('escapeCsvCell properly quotes commas, quotes, and newlines', () => {
  assert.equal(escapeCsvCell('simple'), 'simple');
  assert.equal(escapeCsvCell('Python, SQL'), '"Python, SQL"');
  assert.equal(escapeCsvCell('He said "Hi"'), '"He said ""Hi"""');
});

test('buildShortlistCsv renders header and formatted candidate rows', () => {
  const csv = buildShortlistCsv([
    {
      candidateName: 'Priya Nair',
      email: 'priya@example.com',
      filename: 'priya_nair.pdf',
      jobTitle: 'Senior Python & ML Engineer',
      company: 'Northstar Systems',
      overallScore: 86.5,
      skillScore: 100,
      similarityScore: 66.25,
      status: 'High Match',
      matchedSkills: ['python', 'sql', 'flask'],
      shortlistedAt: '2026-11-24T10:15:00.000Z',
    },
  ]);

  const lines = csv.split('\r\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith('Candidate Name,Email,Resume Filename'));
  assert.ok(lines[1].includes('Priya Nair,priya@example.com,priya_nair.pdf'));
  assert.ok(lines[1].includes('86.50,100.00,66.25,High Match'));
  assert.ok(lines[1].includes('python; sql; flask'));
});

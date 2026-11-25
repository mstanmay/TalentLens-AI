import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatBytes,
  formatShortDate,
  getStatusMeta,
  validateClientResumeFile,
} from './formatting.ts';

test('formatBytes formats bytes, KB, and MB cleanly', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(1048576), '1.00 MB');
});

test('formatShortDate formats ISO dates deterministically', () => {
  assert.equal(formatShortDate('2026-11-24'), 'Nov 24');
});

test('getStatusMeta maps High, Moderate, Low Match to semantic palette', () => {
  assert.equal(getStatusMeta('High Match').textClass, 'text-[#16A34A]');
  assert.equal(getStatusMeta('Moderate Match').textClass, 'text-[#D97706]');
  assert.equal(getStatusMeta('Low Match').textClass, 'text-[#DC2626]');
});

test('validateClientResumeFile validates PDF/DOCX extensions and size limits', () => {
  assert.equal(validateClientResumeFile({ name: 'resume.pdf', size: 12000 }), null);
  assert.equal(validateClientResumeFile({ name: 'cv.DOCX', size: 45000 }), null);
  assert.ok(validateClientResumeFile({ name: 'image.png', size: 1000 })?.includes('not a PDF or DOCX'));
  assert.ok(validateClientResumeFile({ name: 'empty.pdf', size: 0 })?.includes('empty'));
  assert.ok(
    validateClientResumeFile({ name: 'huge.pdf', size: 11 * 1024 * 1024 })?.includes('exceeds'),
  );
});

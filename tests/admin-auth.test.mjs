import assert from 'node:assert/strict';
import test from 'node:test';

import { isAdminEmail, parseAdminEmails } from '../lib/admin-auth.js';

test('parseAdminEmails normalises comma-separated allowlist values', () => {
  assert.deepEqual(parseAdminEmails(' Holly@Example.com, toby@example.com , '), [
    'holly@example.com',
    'toby@example.com',
  ]);
});

test('isAdminEmail checks case-insensitive allowlist membership', () => {
  assert.equal(isAdminEmail('HOLLY@example.com', ['holly@example.com']), true);
  assert.equal(isAdminEmail('other@example.com', ['holly@example.com']), false);
});

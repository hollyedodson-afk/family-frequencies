import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

const requiredStrings = [
  'Social Queue',
  'Daylight Disco launch',
  'view-inbox',
  'view-calendar',
  'view-library',
  'post-inspector',
  'new-post-drawer',
  'loadPosts',
  'renderQueue',
  'renderInspector',
  'submitNewPost',
  'APPROVE_URL',
  'UPDATE_URL',
  'SUBMIT_URL',
];

for (const value of requiredStrings) {
  assert.ok(html.includes(value), `Expected index.html to contain ${value}`);
}

const fixture = JSON.parse(readFileSync(new URL('./sample-posts.json', import.meta.url), 'utf8'));
assert.ok(Array.isArray(fixture), 'sample-posts.json must be an array');
assert.ok(fixture.length >= 3, 'sample-posts.json should include at least three posts');

for (const post of fixture) {
  assert.ok(post.id, 'fixture post needs id');
  assert.ok(post.type, 'fixture post needs type');
  assert.ok(post.status, 'fixture post needs status');
  assert.ok(post.media_url, 'fixture post needs media_url');
}

console.log('FF social scheduler smoke test passed');

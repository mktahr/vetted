// node --test lib/network/canonicalize-url.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeLinkedInUrl, sameLinkedInProfile } from './canonicalize-url.ts';

const C = 'linkedin.com/in/john-doe-123';

test('standard https + www + trailing slash', () => {
  assert.equal(canonicalizeLinkedInUrl('https://www.linkedin.com/in/john-doe-123/'), C);
});

test('no protocol', () => {
  assert.equal(canonicalizeLinkedInUrl('www.linkedin.com/in/john-doe-123'), C);
  assert.equal(canonicalizeLinkedInUrl('linkedin.com/in/john-doe-123'), C);
});

test('locale subdomain', () => {
  assert.equal(canonicalizeLinkedInUrl('https://uk.linkedin.com/in/john-doe-123'), C);
});

test('query params + tracking stripped', () => {
  assert.equal(canonicalizeLinkedInUrl('https://www.linkedin.com/in/john-doe-123/?trk=abc&original=xyz'), C);
});

test('fragment + extra path segments stripped', () => {
  assert.equal(canonicalizeLinkedInUrl('https://www.linkedin.com/in/john-doe-123/detail/contact-info/#foo'), C);
});

test('uppercase slug lowercased', () => {
  assert.equal(canonicalizeLinkedInUrl('https://www.linkedin.com/in/John-Doe-123'), C);
});

test('surrounding quotes stripped', () => {
  assert.equal(canonicalizeLinkedInUrl('"https://www.linkedin.com/in/john-doe-123"'), C);
});

test('blank / null / email / non-linkedin → null', () => {
  assert.equal(canonicalizeLinkedInUrl(''), null);
  assert.equal(canonicalizeLinkedInUrl(null), null);
  assert.equal(canonicalizeLinkedInUrl('   '), null);
  assert.equal(canonicalizeLinkedInUrl('jane@example.com'), null);
  assert.equal(canonicalizeLinkedInUrl('https://example.com/in/john'), null);
  assert.equal(canonicalizeLinkedInUrl('https://www.linkedin.com/company/acme'), null);
});

test('sameLinkedInProfile across raw/varied forms', () => {
  assert.equal(sameLinkedInProfile('https://www.linkedin.com/in/john-doe-123/', 'linkedin.com/in/JOHN-DOE-123'), true);
  assert.equal(sameLinkedInProfile('https://www.linkedin.com/in/john', 'https://www.linkedin.com/in/jane'), false);
  assert.equal(sameLinkedInProfile(null, null), false);
});

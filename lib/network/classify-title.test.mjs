// node --test lib/network/classify-title.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTitle } from './classify-title.ts';

const b = (t) => classifyTitle(t, 'engineering').bucket;

test('YES — clear engineers', () => {
  assert.equal(b('Senior Software Engineer'), 'yes');
  assert.equal(b('SDE II'), 'yes');
  assert.equal(b('Frontend Developer'), 'yes');
  assert.equal(b('Full-Stack Engineer'), 'yes');
  assert.equal(b('Machine Learning Engineer'), 'yes');
  assert.equal(b('Mechanical Engineer'), 'yes');
  assert.equal(b('Member of Technical Staff'), 'yes');
  assert.equal(b('Engineering Manager'), 'yes');
  assert.equal(b('VP of Engineering'), 'yes');
  assert.equal(b('CTO'), 'yes');
});

test('NO — exclusions win over eng-ish words', () => {
  assert.equal(b('Technical Recruiter'), 'no');   // "technical" present, still NO
  assert.equal(b('Product Manager'), 'no');
  assert.equal(b('UX Designer'), 'no');
  assert.equal(b('Account Executive'), 'no');
  assert.equal(b('HR Business Partner'), 'no');
  assert.equal(b('Growth Marketing Lead'), 'no');
  assert.equal(b('Corporate Counsel'), 'no');
});

test('MAYBE — ambiguous / bare / obfuscated / blank', () => {
  assert.equal(b('Engineer'), 'maybe');        // bare, no discipline
  assert.equal(b('Founder'), 'maybe');
  assert.equal(b('Co-Founder & CEO'), 'maybe');
  assert.equal(b('Wizard'), 'maybe');
  assert.equal(b('Banker'), 'maybe');
  assert.equal(b(''), 'maybe');
  assert.equal(b(null), 'maybe');
});

test('source + reason are populated', () => {
  const c = classifyTitle('Technical Recruiter', 'engineering');
  assert.equal(c.source, 'taxonomy');
  assert.match(c.reason, /^exclude:/);
});

// node --test lib/network/parse-csv.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseConnectionsCsv, parseConnectedOn } from './parse-csv.ts';

const SAMPLE = [
  'Notes:',
  '"When exporting your connection data, you may notice..."',
  '',
  'First Name,Last Name,URL,Email Address,Company,Position,Connected On',
  'Jane,Doe,https://www.linkedin.com/in/jane-doe,,Anduril Industries,Senior Software Engineer,15 Jun 2024',
  'John,Smith,https://www.linkedin.com/in/john-smith,john@x.com,"Smith, Jones & Co","Partner, Engineering",02 Jan 2023',
  'Blank,Title,https://www.linkedin.com/in/blank-title,,,,01 Mar 2022',
].join('\n');

test('skips junk preamble and finds the real header', () => {
  const r = parseConnectionsCsv(SAMPLE);
  assert.equal(r.headerFound, true);
  // Blank lines are filtered before indexing, so the 2 'Notes' lines precede
  // the header → skippedPreamble = 2.
  assert.equal(r.skippedPreamble, 2);
  assert.equal(r.rows.length, 3);
});

test('parses quoted fields containing commas', () => {
  const r = parseConnectionsCsv(SAMPLE);
  const john = r.rows[1];
  assert.equal(john.company, 'Smith, Jones & Co');
  assert.equal(john.position, 'Partner, Engineering');
  assert.equal(john.email, 'john@x.com');
});

test('maps the six fields correctly', () => {
  const r = parseConnectionsCsv(SAMPLE);
  const jane = r.rows[0];
  assert.equal(jane.first_name, 'Jane');
  assert.equal(jane.url, 'https://www.linkedin.com/in/jane-doe');
  assert.equal(jane.position, 'Senior Software Engineer');
  assert.equal(jane.connected_on, '15 Jun 2024');
});

test('tolerates missing trailing cells (blank company/position)', () => {
  const r = parseConnectionsCsv(SAMPLE);
  const blank = r.rows[2];
  assert.equal(blank.company, '');
  assert.equal(blank.position, '');
});

test('returns headerFound=false when no header present', () => {
  const r = parseConnectionsCsv('just,some\nrandom,data');
  assert.equal(r.headerFound, false);
  assert.equal(r.rows.length, 0);
});

test('parseConnectedOn', () => {
  assert.equal(parseConnectedOn('15 Jun 2024'), '2024-06-15');
  assert.equal(parseConnectedOn('2 Jan 2023'), '2023-01-02');
  assert.equal(parseConnectedOn(''), null);
  assert.equal(parseConnectedOn('garbage'), null);
});

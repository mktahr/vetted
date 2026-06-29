// node --test --import ./scripts/ts-test-register.mjs lib/ingest/mappers/crust-enrich.test.mjs
//
// Tests mapEnrichToCanonical against a fixture that MIRRORS the live /person/enrich
// person_data shape verified by the 2026-06-28 probe (fields=[basic_profile,
// experience,education,skills]): employer keys (name/title/start_date/end_date/
// is_default/employment_type/description/company_professional_network_profile_url/
// crustdata_company_id/professional_network_id/seniority_level/function_category),
// school keys (school/degree/field_of_study/start_year/end_year/
// activities_and_societies), and skills.professional_network_skills.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapEnrichToCanonical, ENRICH_MAPPER_VERSION } from './crust-enrich.ts';

const URL = 'https://www.linkedin.com/in/abhilashchowdhary';

// Faithful person_data fixture (shape per the live probe).
const PERSON_DATA = {
  basic_profile: {
    name: 'Abhilash Chowdhary',
    current_title: 'Co-Founder & CEO',
    headline: 'Co-founder at Crustdata (YC F24)',
    location: { raw: 'San Francisco, California, United States', city: 'San Francisco', state: 'California', country: 'United States' },
  },
  experience: {
    employment_details: {
      current: [
        {
          name: 'Crustdata (YC F24)',
          title: 'Co-Founder & CEO',
          start_date: '2023-01-01T00:00:00',
          end_date: null,
          is_default: true,
          employment_type: 'Full-time',
          description: 'Building structured people + company data APIs.',
          company_professional_network_profile_url: 'https://www.linkedin.com/company/crustdata',
          crustdata_company_id: 123456,
          professional_network_id: '98765',
          seniority_level: 'c_suite',
          function_category: 'founder',
        },
        {
          // A second concurrent current role that is NOT the primary (is_default=false).
          name: 'Some Advisory Board',
          title: 'Advisor',
          start_date: '2022-06-01T00:00:00',
          end_date: null,
          is_default: false,
          employment_type: 'Advisory',
          description: 'Advisory role.',
        },
      ],
      past: [
        {
          name: 'Uber',
          title: 'Senior Software Engineer',
          start_date: '2018-05-01T00:00:00',
          end_date: '2022-12-01T00:00:00',
          is_default: false,
          employment_type: 'Full-time',
          description: 'Worked on distributed systems.',
        },
      ],
    },
  },
  education: {
    schools: [
      {
        school: 'Carnegie Mellon University',
        degree: 'Master of Science',
        field_of_study: 'Computer Science',
        start_year: 2016,
        end_year: 2018,
        activities_and_societies: 'Robotics Club',
      },
    ],
  },
  skills: { professional_network_skills: ['Machine Learning', 'Python', 'Distributed Systems', '  ', 'C++'] },
};

test('maps the live enrich shape into a canonical payload', () => {
  const out = mapEnrichToCanonical(PERSON_DATA, URL);
  assert.ok(out, 'should not be null');
  assert.equal(out.linkedin_url, URL, 'uses the caller-supplied URL (no social_handles in blob)');
  assert.equal(out.full_name, 'Abhilash Chowdhary');
  assert.equal(out.source, 'crust_person_enrich');
  assert.equal(out.mapper_version, ENRICH_MAPPER_VERSION);
});

test('PRESERVES the fields the search mapper drops (description, employment_type, field_of_study, skills)', () => {
  const c = mapEnrichToCanonical(PERSON_DATA, URL).canonical_json;

  const uber = c.experiences.find(e => e.company_name === 'Uber');
  assert.ok(uber, 'Uber experience present');
  assert.equal(uber.description, 'Worked on distributed systems.', 'description preserved');
  assert.equal(uber.employment_type, 'Full-time', 'employment_type preserved');

  const edu = c.education[0];
  assert.equal(edu.field_of_study, 'Computer Science', 'field_of_study preserved');

  assert.deepEqual(c.skills_tags, ['Machine Learning', 'Python', 'Distributed Systems', 'C++'],
    'skills mapped + trimmed, blanks dropped');
});

test('primary current role is the is_default=true one; dates stripped to YYYY-MM-DD', () => {
  const c = mapEnrichToCanonical(PERSON_DATA, URL).canonical_json;
  assert.equal(c.current_company, 'Crustdata (YC F24)', 'is_default current wins over the advisory role');
  assert.equal(c.current_title, 'Co-Founder & CEO');
  assert.equal(c.current_company_linkedin_url, 'https://www.linkedin.com/company/crustdata');
  assert.equal(c.current_company_crustdata_id, 123456);

  const primary = c.experiences.find(e => e.company_name === 'Crustdata (YC F24)');
  assert.equal(primary.is_primary_current, true);
  assert.equal(primary.start_date, '2023-01-01', 'ISO time component stripped');

  // Both current roles + the past role survive (advisory is not dropped by the mapper).
  assert.equal(c.experiences.length, 3);
});

test('returns null when name or URL is missing', () => {
  assert.equal(mapEnrichToCanonical(PERSON_DATA, ''), null, 'no URL → null');
  assert.equal(mapEnrichToCanonical({ basic_profile: {} }, URL), null, 'no name → null');
  assert.equal(mapEnrichToCanonical(null, URL), null, 'no person_data → null');
});

test('handles a blob with no experience/education/skills (basic-only, e.g. fields not requested)', () => {
  const basicOnly = { basic_profile: { name: 'Jane Doe', current_title: 'Engineer' } };
  const out = mapEnrichToCanonical(basicOnly, URL);
  assert.ok(out);
  assert.equal(out.canonical_json.full_name, 'Jane Doe');
  assert.deepEqual(out.canonical_json.experiences, []);
  assert.deepEqual(out.canonical_json.education, []);
  assert.equal(out.canonical_json.skills_tags, null);
  assert.equal(out.canonical_json.current_title, 'Engineer', 'falls back to basic_profile.current_title');
});

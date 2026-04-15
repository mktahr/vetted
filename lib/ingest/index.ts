// lib/ingest/index.ts
// Barrel export for ingest mappers.

export { mapCrustToCanonical } from './mappers/crust'
export type {
  IngestPayload,
  CanonicalProfile,
  RawExperience,
  RawEducation,
  CrustPerson,
  CrustEmployer,
  CrustEducationEntry,
  CrustLocationDetails,
} from './mappers/crust'

export { mapGenericToCanonical } from './mappers/generic'

export type MapperName = 'crust' | 'generic'

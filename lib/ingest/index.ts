// lib/ingest/index.ts
// Barrel export for ingest mappers.

export { mapCrustToCanonical, MAPPER_VERSION as CRUST_V1_MAPPER_VERSION } from './mappers/crust'
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

export { mapPersonSearchToCanonical, MAPPER_VERSION as CRUST_V2_MAPPER_VERSION } from './mappers/crust-v2'

export { mapGenericToCanonical, MAPPER_VERSION as GENERIC_MAPPER_VERSION } from './mappers/generic'

export type MapperName = 'crust' | 'crust-v2' | 'generic'

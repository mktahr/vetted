// app/constants.ts
// Shared constants across the Vetted app.

/**
 * Curated list of company-scoreable functions.
 * These are the functions for which companies can receive per-function
 * quality scores (0-5). Not the full function_dictionary — just the
 * ones that matter for company scoring.
 */
export const COMPANY_FUNCTIONS = [
  { value: 'engineering', label: 'Engineering' },
  { value: 'product', label: 'Product' },
  { value: 'design', label: 'Design' },
  { value: 'go_to_market', label: 'Go-to-Market' },
  { value: 'operations', label: 'Operations' },
  { value: 'customer_success', label: 'Customer Success' },
] as const

export type CompanyFunction = typeof COMPANY_FUNCTIONS[number]['value']

// lib/signals/extractPatterns.ts
//
// Pattern-based signal extractor. Loads signal_dictionary into memory,
// builds regex patterns from aliases, and matches against candidate text.
//
// Named entries get confidence 1.0; catchall entries (canonical_name
// ending with "(generic)") get confidence 0.65.

import { SupabaseClient } from '@supabase/supabase-js'
import { SourceFieldHint } from '@/types/signals'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DictionaryEntry {
  id: string
  canonical_name: string
  category: string
  aliases: string[]
  source_field_hints: string[]
  is_catchall: boolean
}

export interface PatternMatch {
  signal_id: string
  matched_alias: string
  confidence: number
  is_catchall: boolean
}

// ─── Module-level cache ─────────────────────────────────────────────────────

let cachedEntries: DictionaryEntry[] | null = null

// Pre-compiled regex patterns per entry: Map<entry.id, Array<{pattern, alias}>>
let compiledPatterns: Map<string, Array<{ pattern: RegExp; alias: string }>> | null = null

// ─── Pattern building ───────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Build a regex for a single alias string.
 *
 * Short tokens (<5 chars) get stricter boundary rules to avoid
 * matching inside words (e.g., "ctf" inside "craftsmanship" or
 * "imo" inside "imodium").
 *
 * Multi-word and longer tokens use standard \b word boundaries.
 */
function buildPattern(alias: string): RegExp {
  const escaped = escapeRegex(alias)
  const isShort = alias.length < 5 && !alias.includes(' ')

  if (isShort) {
    // Short token: require non-alphanumeric boundary on both sides,
    // and must not be preceded by :// (URL) or @ (email).
    // Uses negative lookbehind for URL/email context.
    return new RegExp(
      `(?<![a-zA-Z0-9@/])${escaped}(?![a-zA-Z0-9])`,
      'i'
    )
  }

  // Multi-word or longer tokens: standard word boundaries
  return new RegExp(`\\b${escaped}\\b`, 'i')
}

// ─── Dictionary loading ─────────────────────────────────────────────────────

export async function loadSignalDictionary(
  supabase: SupabaseClient,
  forceReload = false,
): Promise<DictionaryEntry[]> {
  if (cachedEntries && !forceReload) return cachedEntries

  const { data, error } = await supabase
    .from('signal_dictionary')
    .select('id, canonical_name, category, aliases, source_field_hints')
    .eq('is_active', true)

  if (error) throw new Error(`Failed to load signal_dictionary: ${error.message}`)

  cachedEntries = (data || []).map(row => ({
    id: row.id,
    canonical_name: row.canonical_name,
    category: row.category,
    aliases: row.aliases || [],
    source_field_hints: row.source_field_hints || [],
    is_catchall: row.canonical_name.endsWith('(generic)'),
  }))

  // Pre-compile regex patterns
  compiledPatterns = new Map()
  for (const entry of cachedEntries) {
    const patterns: Array<{ pattern: RegExp; alias: string }> = []

    // Add canonical_name as a matchable pattern too
    patterns.push({
      pattern: buildPattern(entry.canonical_name.replace(/\s*\(generic\)$/, '').toLowerCase()),
      alias: entry.canonical_name,
    })

    for (const alias of entry.aliases) {
      patterns.push({
        pattern: buildPattern(alias.toLowerCase()),
        alias,
      })
    }

    compiledPatterns.set(entry.id, patterns)
  }

  console.log(`[signals] Loaded ${cachedEntries.length} dictionary entries, compiled ${compiledPatterns.size} pattern sets`)
  return cachedEntries
}

export function refreshDictionary(): void {
  cachedEntries = null
  compiledPatterns = null
}

// ─── Extractor ──────────────────────────────────────────────────────────────

export function extractSignalsFromText(
  text: string,
  sourceFieldHint: SourceFieldHint,
): PatternMatch[] {
  if (!cachedEntries || !compiledPatterns) {
    throw new Error('Signal dictionary not loaded. Call loadSignalDictionary() first.')
  }
  if (!text || text.trim().length === 0) return []

  const textLower = text.toLowerCase()
  const matches: Map<string, PatternMatch> = new Map()

  // Track which character ranges have been matched by named entries
  // so we can suppress catchall matches on the same region
  const namedMatchRanges: Array<{ start: number; end: number }> = []

  // First pass: named entries
  for (const entry of cachedEntries) {
    if (entry.is_catchall) continue

    // Filter by source_field_hint
    if (entry.source_field_hints.length > 0 && !entry.source_field_hints.includes(sourceFieldHint)) {
      continue
    }

    const patterns = compiledPatterns.get(entry.id)
    if (!patterns) continue

    for (const { pattern, alias } of patterns) {
      const match = pattern.exec(textLower)
      if (match) {
        const existing = matches.get(entry.id)
        if (!existing) {
          matches.set(entry.id, {
            signal_id: entry.id,
            matched_alias: alias,
            confidence: 1.0,
            is_catchall: false,
          })
        }
        // Record match range for catchall suppression
        namedMatchRanges.push({
          start: match.index,
          end: match.index + match[0].length,
        })
        break // one match per entry is enough
      }
    }
  }

  // Second pass: catchall entries (only if no named entry covered the same region)
  for (const entry of cachedEntries) {
    if (!entry.is_catchall) continue

    if (entry.source_field_hints.length > 0 && !entry.source_field_hints.includes(sourceFieldHint)) {
      continue
    }

    const patterns = compiledPatterns.get(entry.id)
    if (!patterns) continue

    for (const { pattern, alias } of patterns) {
      const match = pattern.exec(textLower)
      if (match) {
        // Only suppress if this match region overlaps with a named match
        const overlaps = namedMatchRanges.some(range =>
          match.index < range.end && (match.index + match[0].length) > range.start
        )
        if (overlaps) continue

        if (!matches.has(entry.id)) {
          matches.set(entry.id, {
            signal_id: entry.id,
            matched_alias: alias,
            confidence: 0.65,
            is_catchall: true,
          })
        }
        break
      }
    }
  }

  return Array.from(matches.values())
}

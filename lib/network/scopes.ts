// lib/network/scopes.ts
//
// Classification scopes for the network-connections title classifier.
//
// Engineering is the scope for V1, but it is a PARAMETER, not hardcoded — other
// function families (design, product, GTM, …) can be enabled later by adding a
// ClassificationScope here and selecting it per upload/org. The classifier in
// classify-title.ts is scope-agnostic; all the vocabulary lives here.
//
// Ordering contract: excludePatterns are evaluated FIRST and override includes,
// so "Technical Recruiter" → NO despite containing "technical". includePatterns
// then promote clear engineers to YES. Anything matching neither (bare
// "engineer", "founder", obfuscated/cute titles, blank) falls through to MAYBE.

export interface ClassificationScope {
  key: string;
  label: string;
  excludePatterns: RegExp[]; // → NO  (checked first; override includes)
  includePatterns: RegExp[]; // → YES (clear in-scope engineers)
}

// ─── Engineering ─────────────────────────────────────────────────────────────

const ENGINEERING: ClassificationScope = {
  key: 'engineering',
  label: 'Engineering',

  // Clear non-engineering roles. Specific role nouns, not bare adjectives, so we
  // never catch "design engineer" on a "design" rule. Recruiting/HR/GTM/finance/
  // legal/PM/standalone-designer all exclude even when an eng-ish word appears.
  excludePatterns: [
    /\brecruit(er|ing)?\b/,
    /\bsourcer\b/,
    /\btalent\b/,
    /\bhuman resources\b|\bpeople operations\b|\bhr\b|\bhrbp\b/,
    /\baccount executive\b|\bsales\b|\bbusiness development\b|\bbdr\b|\bsdr\b|\baccount manager\b/,
    /\bmarketing\b|\bgrowth\b(?!\s*engineer)|\bbrand\b|\bcontent\b|\bcommunications\b|\bpublic relations\b/,
    /\bcustomer success\b|\bcustomer support\b|\bsupport specialist\b/,
    /\bfinance\b|\baccountant\b|\baccounting\b|\bcontroller\b|\bbookkeeper\b/,
    /\blegal\b|\bcounsel\b|\battorney\b|\bparalegal\b/,
    /\bproduct manager\b|\bprogram manager\b|\bproject manager\b|\bproduct owner\b|\btpm\b/,
    /\bdesigner\b|\bux\b|\bui\b(?!\s*engineer)|\bgraphic\b|\billustrator\b/,
    /\boperations manager\b|\boffice manager\b|\bexecutive assistant\b/,
  ],

  // Generous engineering inclusion. Each pattern requires a discipline qualifier
  // so bare "engineer" / "engineering" does NOT match here (falls to MAYBE).
  includePatterns: [
    /\bsoftware\s+(engineer|developer)\b|\bswe\b|\bsde\b|\bsdet\b/,
    /\b(front[- ]?end|back[- ]?end|full[- ]?stack)\b/,
    /\bweb\s+developer\b|\bapplication\s+developer\b|\bprogrammer\b/,
    /\b(mobile|ios|android)\s+(engineer|developer)\b/,
    /\b(machine learning|ml|ai|deep learning|nlp|computer vision|cv)\s+engineer\b/,
    /\bdata\s+engineer\b|\bdataops\b/,
    /\b(devops|sre|site reliability|platform|infrastructure|cloud|backend platform)\s+engineer\b/,
    /\bsecurity\s+engineer\b|\bappsec\b|\bsecops\b/,
    /\b(embedded|firmware|hardware|electrical|mechanical|robotics|systems|controls|aerospace|materials|manufacturing|test|optics|chip|fpga|asic|rtl|photonics|mechatronics)\s+engineer\b/,
    /\b(qa|quality|reliability|validation|verification)\s+engineer\b/,
    /\b(research|applied|forward deployed|solutions architect)\s+engineer\b/,
    /\bmember of technical staff\b|\bmts\b|\bsmts\b/,
    /\b(staff|principal|distinguished|senior staff)\s+engineer\b/,
    /\bapplied scientist\b|\bresearch scientist\b(?=.*\b(ml|ai|machine learning)\b)/,
    /\b(cto|chief technology officer)\b/,
    /\b(vp|vice president|head|director|sr\.? director|svp)\s+(of\s+)?engineering\b/,
    /\bengineering\s+(manager|lead|director)\b|\btech(nical)?\s+lead\b|\btlm\b/,
  ],
};

// ─── Registry ────────────────────────────────────────────────────────────────

export const CLASSIFICATION_SCOPES: Record<string, ClassificationScope> = {
  engineering: ENGINEERING,
};

export const DEFAULT_SCOPE_KEY = 'engineering';

export function getScope(key: string | null | undefined): ClassificationScope {
  return CLASSIFICATION_SCOPES[key ?? DEFAULT_SCOPE_KEY] ?? ENGINEERING;
}

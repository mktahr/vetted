// lib/network/parse-csv.ts
//
// Parser for LinkedIn "Connections.csv" exports.
//
// The export has a few junk "Notes:" preamble lines above the real header, then
// the header row:
//   First Name,Last Name,URL,Email Address,Company,Position,Connected On
// Email is blank ~80-90% of the time; Company/Position are CURRENT-only (no
// history/school/location — those only arrive via Crust enrichment later); URL
// is the only reliable unique key.
//
// Quoting follows the same RFC-4180-ish rules as scripts/sync-reference.mjs
// (doubled "" escapes, commas inside quotes preserved).

export interface RawConnectionRow {
  first_name: string;
  last_name: string;
  url: string;
  email: string;
  company: string;
  position: string;
  connected_on: string;
}

export interface ParseCsvResult {
  rows: RawConnectionRow[];
  headerFound: boolean;
  totalLines: number;     // data lines after the header
  skippedPreamble: number; // junk lines skipped before the header
}

// Header detection: the real header contains First Name + URL columns. We match
// loosely (case-insensitive, whitespace-tolerant) so minor export variations
// still resolve.
function looksLikeHeader(cells: string[]): boolean {
  const norm = cells.map((c) => c.toLowerCase().trim());
  return norm.includes('first name') && norm.includes('url');
}

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuote = false;
      } else {
        cur += c;
      }
    } else {
      if (c === ',') {
        out.push(cur);
        cur = '';
      } else if (c === '"') {
        inQuote = true;
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out;
}

/**
 * Parse a LinkedIn Connections.csv. Skips the junk preamble, locates the real
 * header, and returns one RawConnectionRow per data line (verbatim field
 * values, only trimmed). Rows shorter than the header are tolerated (missing
 * trailing cells → '').
 */
export function parseConnectionsCsv(text: string): ParseCsvResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  let headerIdx = -1;
  let header: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    if (looksLikeHeader(cells)) {
      headerIdx = i;
      header = cells.map((c) => c.toLowerCase().trim());
      break;
    }
  }

  if (headerIdx === -1) {
    return { rows: [], headerFound: false, totalLines: 0, skippedPreamble: lines.length };
  }

  const col = (name: string) => header.indexOf(name);
  const iFirst = col('first name');
  const iLast = col('last name');
  const iUrl = col('url');
  const iEmail = col('email address');
  const iCompany = col('company');
  const iPosition = col('position');
  const iConnected = col('connected on');

  const at = (cells: string[], idx: number) => (idx >= 0 ? (cells[idx] ?? '').trim() : '');

  const rows: RawConnectionRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    rows.push({
      first_name: at(cells, iFirst),
      last_name: at(cells, iLast),
      url: at(cells, iUrl),
      email: at(cells, iEmail),
      company: at(cells, iCompany),
      position: at(cells, iPosition),
      connected_on: at(cells, iConnected),
    });
  }

  return {
    rows,
    headerFound: true,
    totalLines: rows.length,
    skippedPreamble: headerIdx,
  };
}

/**
 * Parse LinkedIn's "Connected On" date string ("15 Jun 2024") into an ISO date
 * (YYYY-MM-DD) for the connections.connected_on DATE column. Returns null when
 * unparseable — the raw string is preserved separately in connected_on_raw.
 */
const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

export function parseConnectedOn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (!m) return null;
  const day = m[1].padStart(2, '0');
  const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
  const year = m[3];
  if (!mon) return null;
  return `${year}-${mon}-${day}`;
}

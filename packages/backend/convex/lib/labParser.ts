import { DEFAULT_LAB_ANALYTES, type LabAnalyteCatalogEntry } from "./labAnalyteCatalogData";

export interface ParsedResult {
  name: string;
  value: number;
  unit: string;
  referenceMin: number;
  referenceMax: number;
  category: string;
}

export interface ParseOutput {
  results: ParsedResult[];
  unrecognized: string[];
  totalLines: number;
  parsedCount: number;
}

const VALUE_PATTERN = /(?<value>[+-]?\d+(?:[.,]\d+)?)/;
const VALUE_PATTERN_GLOBAL = new RegExp(VALUE_PATTERN.source, "g");
const RANGE_PATTERN =
  /(?:ref[:.]?\s*)?(?<reference>(?:<|>)\s*[+-]?\d+(?:[.,]\d+)?|\(?\s*[+-]?\d+(?:[.,]\d+)?\s*[-–]\s*[+-]?\d+(?:[.,]\d+)?\s*\)?)/i;

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function normalizeLine(value: string) {
  return value
    .replace(/\.{2,}/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*([:()])/g, " $1")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value: string) {
  return Number.parseFloat(value.replace(",", "."));
}

function parseRange(raw: string) {
  const normalized = raw.replace(/\s+/g, " ").trim();

  if (/^[<>]/.test(normalized)) {
    const sign = normalized[0];
    const numeric = parseNumber(normalized.slice(1).trim());

    if (Number.isNaN(numeric)) {
      return null;
    }

    if (sign === "<") {
      return { referenceMin: 0, referenceMax: numeric };
    }

    return { referenceMin: numeric, referenceMax: Number.MAX_SAFE_INTEGER };
  }

  const parts = normalized
    .replace(/[()]/g, "")
    .split(/[-–]/)
    .map((part) => parseNumber(part.trim()));

  if (parts.length !== 2 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const [referenceMin, referenceMax] = parts;
  return { referenceMin, referenceMax };
}

function findCatalogEntry(rawName: string, catalog: ReadonlyArray<LabAnalyteCatalogEntry>) {
  const name = normalizeText(rawName);
  let bestMatch: LabAnalyteCatalogEntry | null = null;
  let bestScore = 0;

  for (const entry of catalog) {
    if (!entry.isActive) {
      continue;
    }

    const canonical = normalizeText(entry.name);
    const aliasMatches = entry.aliases.map((alias) => normalizeText(alias));

    let score = 0;

    if (name === canonical) {
      score = 1_000 + canonical.length;
    } else {
      const exactAlias = aliasMatches.find((alias) => alias === name);
      if (exactAlias) {
        score = 1_000 + exactAlias.length;
      } else if (canonical.includes(name) || name.includes(canonical)) {
        score = canonical.length;
      } else {
        const aliasScore = aliasMatches.reduce((currentBest, alias) => {
          if (!alias.includes(name) && !name.includes(alias)) {
            return currentBest;
          }

          return Math.max(currentBest, alias.length);
        }, 0);
        score = aliasScore;
      }
    }

    if (score > bestScore) {
      bestMatch = entry;
      bestScore = score;
    }
  }

  return bestMatch;
}

function findExactCatalogEntry(rawName: string, catalog: ReadonlyArray<LabAnalyteCatalogEntry>) {
  const name = normalizeText(rawName);

  for (const entry of catalog) {
    if (!entry.isActive) {
      continue;
    }

    if (normalizeText(entry.name) === name) {
      return entry;
    }

    if (entry.aliases.some((alias) => normalizeText(alias) === name)) {
      return entry;
    }
  }

  return null;
}

function findValueCandidate(
  normalizedLine: string,
  catalog: ReadonlyArray<LabAnalyteCatalogEntry>,
) {
  const matches = Array.from(normalizedLine.matchAll(VALUE_PATTERN_GLOBAL));
  const fallback = matches[0];

  for (const match of matches) {
    if (match.index === undefined) {
      continue;
    }

    const rawName = normalizedLine
      .slice(0, match.index)
      .replace(/[:\- ]+$/g, "")
      .trim();

    if (!rawName) {
      continue;
    }

    const entry = findExactCatalogEntry(rawName, catalog);
    if (entry) {
      return {
        rawName,
        valueMatch: match,
        entry,
      };
    }
  }

  if (!fallback || fallback.index === undefined) {
    return null;
  }

  const rawName = normalizedLine
    .slice(0, fallback.index)
    .replace(/[:\- ]+$/g, "")
    .trim();

  if (!rawName) {
    return null;
  }

  return {
    rawName,
    valueMatch: fallback,
    entry: null,
  };
}

/**
 * Chopo PDF reverse format: `<range> <unit><value><name>`
 * e.g. "55 - 99 mg/dL99Glucosa" or "< 200 mg/dL274Colesterol"
 *
 * Since unit and value are concatenated without separator, we use the catalog
 * name as an anchor: find the name at the end, then parse backwards for value and unit.
 */

/** Match a leading reference range (e.g. "55 - 99", "< 200", ">60") */
const CHOPO_RANGE_PREFIX =
  /^(?<range>(?:[<>]\s*)?[+-]?\d+(?:[.,]\d+)?(?:\s*[-–]\s*[+-]?\d+(?:[.,]\d+)?)?)\s+/;

function parseLineChopo(line: string, catalog: ReadonlyArray<LabAnalyteCatalogEntry>) {
  const normalizedLine = normalizeLine(line);
  if (!normalizedLine) {
    return null;
  }

  // Step 1: Check if line starts with a reference range
  const rangeMatch = normalizedLine.match(CHOPO_RANGE_PREFIX);
  if (!rangeMatch?.groups?.range) {
    return null;
  }

  const reference = parseRange(rangeMatch.groups.range);
  if (!reference) {
    return null;
  }

  // Step 2: Everything after the range is `<unit><value><name>`
  const remainder = normalizedLine.slice(rangeMatch[0].length);
  if (!remainder) {
    return null;
  }

  // Step 3: Find the catalog entry name anywhere in the remainder.
  // The name may be at the end or followed by trailing text from the next segment.
  let bestEntry: LabAnalyteCatalogEntry | null = null;
  let bestNameLength = 0;
  let nameStartIndex = -1;

  const remainderNorm = normalizeText(remainder);

  for (const entry of catalog) {
    if (!entry.isActive) continue;

    const candidates = [entry.name, ...entry.aliases];
    for (const candidate of candidates) {
      const norm = normalizeText(candidate);
      if (norm.length <= bestNameLength) continue;

      const idx = remainderNorm.indexOf(norm);
      if (idx >= 0) {
        bestEntry = entry;
        bestNameLength = norm.length;
        nameStartIndex = idx;
      }
    }
  }

  if (!bestEntry || nameStartIndex <= 0) {
    return null;
  }

  // Step 4: The part before the name is `<unit><value>`.
  // Units can end with digit suffixes like "m2" in "mL/min/1.73m2".
  // We normalize known unit suffixes (m2, m3) by inserting a separator before the value.
  const prefixRaw = remainderNorm.slice(0, nameStartIndex);
  const prefixNorm = prefixRaw.replace(/(m[2³]|m[3³])(\d)/, "$1 $2");

  // Now extract value as the last number in the prefix
  const valueMatch = prefixNorm.match(/([+-]?\d+(?:[.,]\d+)?)\s*$/);
  if (!valueMatch || valueMatch.index === undefined) {
    return null;
  }

  const value = parseNumber(valueMatch[1]);
  if (Number.isNaN(value)) {
    return null;
  }

  const unit = prefixNorm.slice(0, valueMatch.index).trim();
  if (!unit) {
    return null;
  }

  return {
    recognized: true,
    result: {
      name: bestEntry.name,
      value,
      unit,
      referenceMin: reference.referenceMin,
      referenceMax: reference.referenceMax,
      category: bestEntry.category,
    },
  } as const;
}

function parseLineStandard(line: string, catalog: ReadonlyArray<LabAnalyteCatalogEntry>) {
  const normalizedLine = normalizeLine(line);
  if (!normalizedLine) {
    return null;
  }

  const candidate = findValueCandidate(normalizedLine, catalog);
  if (!candidate?.valueMatch.groups?.value || candidate.valueMatch.index === undefined) {
    return null;
  }

  const rest = normalizedLine
    .slice(candidate.valueMatch.index + candidate.valueMatch[0].length)
    .trim();
  if (!rest) {
    return null;
  }

  const referenceMatch = rest.match(RANGE_PATTERN);
  const unit = (referenceMatch?.index !== undefined ? rest.slice(0, referenceMatch.index) : rest)
    .replace(/[:\- ]+$/g, "")
    .trim();

  if (!unit) {
    return null;
  }

  const reference = referenceMatch?.groups?.reference
    ? parseRange(referenceMatch.groups.reference)
    : null;
  if (!reference) {
    return null;
  }

  const value = parseNumber(candidate.valueMatch.groups.value);
  if (Number.isNaN(value)) {
    return null;
  }

  const entry = candidate.entry ?? findCatalogEntry(candidate.rawName, catalog);
  if (!entry) {
    return {
      recognized: false,
      line: normalizedLine,
    } as const;
  }

  return {
    recognized: true,
    result: {
      name: entry.name,
      value,
      unit,
      referenceMin: reference.referenceMin,
      referenceMax: reference.referenceMax,
      category: entry.category,
    },
  } as const;
}

function parseLine(line: string, catalog: ReadonlyArray<LabAnalyteCatalogEntry>) {
  return parseLineChopo(line, catalog) ?? parseLineStandard(line, catalog);
}

/**
 * Chopo PDFs often extract as a single continuous line. This function splits
 * the text into logical lines by finding each reference range pattern and
 * extracting the segment from that range to the next one.
 */
function splitChopoText(text: string): string[] {
  // Find all positions where a Chopo-style range starts:
  // "55 - 99", "16.6 - 48.5", "< 200", ">60", "0.70 - 1.2"
  const rangeStarts: number[] = [];
  const rangeStartPattern =
    /(?:^|(?<=\s))(?:(?:[<>]\s*)?\d+(?:[.,]\d+)?\s*[-–]\s*\d+(?:[.,]\d+)?|[<>]\s*\d+(?:[.,]\d+)?)\s+[a-zA-Z%µμ]/g;

  let match: RegExpExecArray | null;
  while ((match = rangeStartPattern.exec(text)) !== null) {
    rangeStarts.push(match.index);
  }

  if (rangeStarts.length === 0) {
    return [text];
  }

  const segments: string[] = [];
  for (let i = 0; i < rangeStarts.length; i++) {
    const start = rangeStarts[i];
    const end = i + 1 < rangeStarts.length ? rangeStarts[i + 1] : text.length;
    const segment = text.slice(start, end).trim();
    if (segment) {
      segments.push(segment);
    }
  }

  return segments;
}

export function parseLabResults(
  text: string,
  examType: string,
  catalog: ReadonlyArray<LabAnalyteCatalogEntry> = DEFAULT_LAB_ANALYTES,
): ParseOutput {
  void examType;

  // First try splitting by newlines (standard format)
  let lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // If we get very few lines but text is long, it's likely Chopo continuous format
  if (lines.length < 5 && text.length > 200) {
    lines = splitChopoText(text);
  }

  const results: ParsedResult[] = [];
  const unrecognized: string[] = [];

  for (const line of lines) {
    const parsed = parseLine(line, catalog);

    if (!parsed) {
      continue;
    }

    if (parsed.recognized) {
      results.push(parsed.result);
      continue;
    }

    unrecognized.push(parsed.line);
  }

  return {
    results,
    unrecognized,
    totalLines: lines.length,
    parsedCount: results.length,
  };
}

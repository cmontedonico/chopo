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

function parseLine(line: string, catalog: ReadonlyArray<LabAnalyteCatalogEntry>) {
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

export function parseLabResults(
  text: string,
  examType: string,
  catalog: ReadonlyArray<LabAnalyteCatalogEntry> = DEFAULT_LAB_ANALYTES,
): ParseOutput {
  void examType;

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

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

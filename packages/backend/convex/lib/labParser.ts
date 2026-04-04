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

type CatalogEntry = {
  name: string;
  category: string;
  aliases: string[];
};

const CATALOG: CatalogEntry[] = [
  {
    name: "Glucosa",
    category: "METABOLISMO",
    aliases: ["glucosa"],
  },
  {
    name: "Hemoglobina glucosilada (HbA1c)",
    category: "METABOLISMO",
    aliases: ["hemoglobina glucosilada", "hba1c", "hemoglobina glucosilada hba1c"],
  },
  {
    name: "Insulina",
    category: "METABOLISMO",
    aliases: ["insulina"],
  },
  {
    name: "Ácido úrico",
    category: "METABOLISMO",
    aliases: ["acido urico", "ácido úrico"],
  },
  {
    name: "Colesterol total",
    category: "LÍPIDOS",
    aliases: ["colesterol total", "cholesterol total"],
  },
  {
    name: "Colesterol HDL",
    category: "LÍPIDOS",
    aliases: ["colesterol hdl", "hdl"],
  },
  {
    name: "Colesterol LDL",
    category: "LÍPIDOS",
    aliases: ["colesterol ldl", "ldl"],
  },
  {
    name: "Triglicéridos",
    category: "LÍPIDOS",
    aliases: ["trigliceridos", "triglicéridos"],
  },
  {
    name: "Colesterol VLDL",
    category: "LÍPIDOS",
    aliases: ["colesterol vldl", "vldl"],
  },
  {
    name: "Índice aterogénico",
    category: "LÍPIDOS",
    aliases: ["indice aterogenico", "índice aterogénico", "indice aterogénico"],
  },
  {
    name: "Hemoglobina",
    category: "HEMATOLOGÍA",
    aliases: ["hemoglobina"],
  },
  {
    name: "Hematocrito",
    category: "HEMATOLOGÍA",
    aliases: ["hematocrito"],
  },
  {
    name: "Eritrocitos",
    category: "HEMATOLOGÍA",
    aliases: ["eritrocitos", "globulos rojos", "glóbulos rojos"],
  },
  {
    name: "Leucocitos",
    category: "HEMATOLOGÍA",
    aliases: ["leucocitos"],
  },
  {
    name: "Plaquetas",
    category: "HEMATOLOGÍA",
    aliases: ["plaquetas"],
  },
  {
    name: "VCM",
    category: "HEMATOLOGÍA",
    aliases: ["vcm", "volumen corpuscular medio"],
  },
  {
    name: "HCM",
    category: "HEMATOLOGÍA",
    aliases: ["hcm", "hemoglobina corpuscular media"],
  },
  {
    name: "CMHC",
    category: "HEMATOLOGÍA",
    aliases: ["cmhc", "concentracion media de hemoglobina corpuscular"],
  },
  {
    name: "Neutrófilos",
    category: "HEMATOLOGÍA",
    aliases: ["neutrofilos", "neutrófilos"],
  },
  {
    name: "Linfocitos",
    category: "HEMATOLOGÍA",
    aliases: ["linfocitos"],
  },
  {
    name: "Monocitos",
    category: "HEMATOLOGÍA",
    aliases: ["monocitos"],
  },
  {
    name: "Eosinófilos",
    category: "HEMATOLOGÍA",
    aliases: ["eosinofilos", "eosinófilos"],
  },
  {
    name: "Basófilos",
    category: "HEMATOLOGÍA",
    aliases: ["basofilos", "basófilos"],
  },
  {
    name: "Creatinina",
    category: "RENAL",
    aliases: ["creatinina"],
  },
  {
    name: "Nitrógeno ureico (BUN)",
    category: "RENAL",
    aliases: ["nitrogeno ureico", "nitrógeno ureico", "bun"],
  },
  {
    name: "Urea",
    category: "RENAL",
    aliases: ["urea"],
  },
  {
    name: "Tasa de filtración glomerular (TFG)",
    category: "RENAL",
    aliases: ["tasa de filtracion glomerular", "tfg", "filtracion glomerular"],
  },
  {
    name: "Bilirrubina total",
    category: "HEPÁTICO",
    aliases: ["bilirrubina total"],
  },
  {
    name: "Bilirrubina directa",
    category: "HEPÁTICO",
    aliases: ["bilirrubina directa"],
  },
  {
    name: "Bilirrubina indirecta",
    category: "HEPÁTICO",
    aliases: ["bilirrubina indirecta"],
  },
  {
    name: "AST (TGO)",
    category: "HEPÁTICO",
    aliases: ["ast", "tgo", "ast tgo"],
  },
  {
    name: "ALT (TGP)",
    category: "HEPÁTICO",
    aliases: ["alt", "tgp", "alt tgp"],
  },
  {
    name: "Fosfatasa alcalina",
    category: "HEPÁTICO",
    aliases: ["fosfatasa alcalina"],
  },
  {
    name: "GGT",
    category: "HEPÁTICO",
    aliases: ["ggt", "gamma glutamil transferasa"],
  },
  {
    name: "Proteínas totales",
    category: "HEPÁTICO",
    aliases: ["proteinas totales", "proteínas totales"],
  },
  {
    name: "Albúmina",
    category: "HEPÁTICO",
    aliases: ["albumina", "albúmina"],
  },
  {
    name: "Globulinas",
    category: "HEPÁTICO",
    aliases: ["globulinas"],
  },
  {
    name: "Sodio",
    category: "ELECTROLITOS",
    aliases: ["sodio"],
  },
  {
    name: "Potasio",
    category: "ELECTROLITOS",
    aliases: ["potasio"],
  },
  {
    name: "Cloro",
    category: "ELECTROLITOS",
    aliases: ["cloro"],
  },
  {
    name: "Calcio",
    category: "ELECTROLITOS",
    aliases: ["calcio"],
  },
  {
    name: "Fósforo",
    category: "ELECTROLITOS",
    aliases: ["fosforo", "fósforo"],
  },
  {
    name: "Magnesio",
    category: "ELECTROLITOS",
    aliases: ["magnesio"],
  },
  {
    name: "TSH",
    category: "TIROIDES",
    aliases: ["tsh"],
  },
  {
    name: "T3 libre",
    category: "TIROIDES",
    aliases: ["t3 libre", "triiodotironina libre"],
  },
  {
    name: "T4 libre",
    category: "TIROIDES",
    aliases: ["t4 libre", "tiroxina libre"],
  },
  {
    name: "Vitamina D (25-OH)",
    category: "VITAMINAS",
    aliases: ["vitamina d", "vitamina d 25 oh", "25 oh vitamina d", "25-oh vitamina d"],
  },
  {
    name: "Vitamina B12",
    category: "VITAMINAS",
    aliases: ["vitamina b12", "b12"],
  },
  {
    name: "Ácido fólico",
    category: "VITAMINAS",
    aliases: ["acido folico", "ácido fólico", "folato"],
  },
  {
    name: "Proteína C reactiva (PCR)",
    category: "INFLAMACIÓN",
    aliases: ["proteina c reactiva", "pcr", "proteina c reactiva pcr"],
  },
  {
    name: "Velocidad de sedimentación (VSG)",
    category: "INFLAMACIÓN",
    aliases: ["velocidad de sedimentacion", "vsg", "velocidad de sedimentacion globular"],
  },
  {
    name: "Ferritina",
    category: "MARCADORES",
    aliases: ["ferritina"],
  },
  {
    name: "Hierro sérico",
    category: "MARCADORES",
    aliases: ["hierro serico", "hierro sérico"],
  },
  {
    name: "Transferrina",
    category: "MARCADORES",
    aliases: ["transferrina"],
  },
];

const VALUE_PATTERN = /(?<value>[+-]?\d+(?:[.,]\d+)?)/;
const RANGE_PATTERN =
  /(?:ref[:.]?\s*)?(?<reference>(?:<|>)\s*[+-]?\d+(?:[.,]\d+)?|\(?\s*[+-]?\d+(?:[.,]\d+)?\s*[-–]\s*[+-]?\d+(?:[.,]\d+)?\s*\)?)/i;

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\u2010-\u2015]/g, "-")
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

function findCatalogEntry(rawName: string) {
  const name = normalizeText(rawName);
  let bestMatch: CatalogEntry | null = null;
  let bestScore = 0;

  for (const entry of CATALOG) {
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

function parseLine(line: string) {
  const normalizedLine = normalizeLine(line);
  if (!normalizedLine) {
    return null;
  }

  const valueMatch = normalizedLine.match(VALUE_PATTERN);
  if (!valueMatch?.groups?.value || valueMatch.index === undefined) {
    return null;
  }

  const rawName = normalizedLine
    .slice(0, valueMatch.index)
    .replace(/[:\- ]+$/g, "")
    .trim();
  if (!rawName) {
    return null;
  }

  const rest = normalizedLine.slice(valueMatch.index + valueMatch[0].length).trim();
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

  const value = parseNumber(valueMatch.groups.value);
  if (Number.isNaN(value)) {
    return null;
  }

  const entry = findCatalogEntry(rawName);
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

export function parseLabResults(text: string, examType: string): ParseOutput {
  void examType;

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const results: ParsedResult[] = [];
  const unrecognized: string[] = [];

  for (const line of lines) {
    const parsed = parseLine(line);

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

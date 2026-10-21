export interface BloodTestResult {
  id: string;
  name: string;
  value: number;
  unit: string;
  referenceMin: number;
  referenceMax: number;
  category: string;
  status: "normal" | "low" | "high" | "critical";
}

export interface HistoricalResult {
  date: string;
  value: number;
}

export interface BloodTestWithHistory extends BloodTestResult {
  history: HistoricalResult[];
}

function getStatus(value: number, min: number, max: number): BloodTestResult["status"] {
  if (value < min * 0.8 || value > max * 1.2) return "critical";
  if (value < min) return "low";
  if (value > max) return "high";
  return "normal";
}

function generateHistory(current: number, min: number, max: number): HistoricalResult[] {
  const dates = ["2025-06", "2025-09", "2025-12", "2026-03"];
  const range = max - min;
  return dates.map((date, i) => ({
    date,
    value:
      i === dates.length - 1 ? current : Math.round((min + Math.random() * range * 1.3) * 10) / 10,
  }));
}

const raw: Omit<BloodTestResult, "id" | "status">[] = [
  {
    name: "Glucosa",
    value: 95,
    unit: "mg/dL",
    referenceMin: 70,
    referenceMax: 100,
    category: "Metabolismo",
  },
  {
    name: "Hemoglobina glucosilada (HbA1c)",
    value: 5.4,
    unit: "%",
    referenceMin: 4.0,
    referenceMax: 5.6,
    category: "Metabolismo",
  },
  {
    name: "Insulina",
    value: 8.2,
    unit: "μU/mL",
    referenceMin: 2.6,
    referenceMax: 24.9,
    category: "Metabolismo",
  },
  {
    name: "Colesterol total",
    value: 210,
    unit: "mg/dL",
    referenceMin: 0,
    referenceMax: 200,
    category: "Lípidos",
  },
  {
    name: "Colesterol HDL",
    value: 55,
    unit: "mg/dL",
    referenceMin: 40,
    referenceMax: 60,
    category: "Lípidos",
  },
  {
    name: "Colesterol LDL",
    value: 130,
    unit: "mg/dL",
    referenceMin: 0,
    referenceMax: 130,
    category: "Lípidos",
  },
  {
    name: "Triglicéridos",
    value: 145,
    unit: "mg/dL",
    referenceMin: 0,
    referenceMax: 150,
    category: "Lípidos",
  },
  {
    name: "VLDL",
    value: 29,
    unit: "mg/dL",
    referenceMin: 2,
    referenceMax: 30,
    category: "Lípidos",
  },
  {
    name: "Hemoglobina",
    value: 15.2,
    unit: "g/dL",
    referenceMin: 13.5,
    referenceMax: 17.5,
    category: "Hematología",
  },
  {
    name: "Hematocrito",
    value: 45,
    unit: "%",
    referenceMin: 38.8,
    referenceMax: 50,
    category: "Hematología",
  },
  {
    name: "Eritrocitos",
    value: 5.1,
    unit: "M/μL",
    referenceMin: 4.5,
    referenceMax: 5.5,
    category: "Hematología",
  },
  {
    name: "Leucocitos",
    value: 7200,
    unit: "/μL",
    referenceMin: 4500,
    referenceMax: 11000,
    category: "Hematología",
  },
  {
    name: "Plaquetas",
    value: 250000,
    unit: "/μL",
    referenceMin: 150000,
    referenceMax: 400000,
    category: "Hematología",
  },
  {
    name: "VCM",
    value: 88,
    unit: "fL",
    referenceMin: 80,
    referenceMax: 100,
    category: "Hematología",
  },
  {
    name: "HCM",
    value: 29.8,
    unit: "pg",
    referenceMin: 27,
    referenceMax: 33,
    category: "Hematología",
  },
  {
    name: "CHCM",
    value: 33.8,
    unit: "g/dL",
    referenceMin: 32,
    referenceMax: 36,
    category: "Hematología",
  },
  {
    name: "Neutrófilos",
    value: 60,
    unit: "%",
    referenceMin: 40,
    referenceMax: 70,
    category: "Hematología",
  },
  {
    name: "Linfocitos",
    value: 30,
    unit: "%",
    referenceMin: 20,
    referenceMax: 40,
    category: "Hematología",
  },
  {
    name: "Monocitos",
    value: 6,
    unit: "%",
    referenceMin: 2,
    referenceMax: 8,
    category: "Hematología",
  },
  {
    name: "Eosinófilos",
    value: 3,
    unit: "%",
    referenceMin: 1,
    referenceMax: 4,
    category: "Hematología",
  },
  {
    name: "Basófilos",
    value: 0.5,
    unit: "%",
    referenceMin: 0,
    referenceMax: 1,
    category: "Hematología",
  },
  {
    name: "Creatinina",
    value: 1.0,
    unit: "mg/dL",
    referenceMin: 0.7,
    referenceMax: 1.3,
    category: "Renal",
  },
  {
    name: "BUN (Nitrógeno ureico)",
    value: 15,
    unit: "mg/dL",
    referenceMin: 7,
    referenceMax: 20,
    category: "Renal",
  },
  {
    name: "Ácido úrico",
    value: 6.5,
    unit: "mg/dL",
    referenceMin: 3.5,
    referenceMax: 7.2,
    category: "Renal",
  },
  {
    name: "TFG estimada",
    value: 95,
    unit: "mL/min",
    referenceMin: 90,
    referenceMax: 120,
    category: "Renal",
  },
  {
    name: "AST (TGO)",
    value: 25,
    unit: "U/L",
    referenceMin: 10,
    referenceMax: 40,
    category: "Hepático",
  },
  {
    name: "ALT (TGP)",
    value: 30,
    unit: "U/L",
    referenceMin: 7,
    referenceMax: 56,
    category: "Hepático",
  },
  {
    name: "Fosfatasa alcalina",
    value: 70,
    unit: "U/L",
    referenceMin: 44,
    referenceMax: 147,
    category: "Hepático",
  },
  { name: "GGT", value: 35, unit: "U/L", referenceMin: 9, referenceMax: 48, category: "Hepático" },
  {
    name: "Bilirrubina total",
    value: 0.9,
    unit: "mg/dL",
    referenceMin: 0.1,
    referenceMax: 1.2,
    category: "Hepático",
  },
  {
    name: "Bilirrubina directa",
    value: 0.25,
    unit: "mg/dL",
    referenceMin: 0.0,
    referenceMax: 0.3,
    category: "Hepático",
  },
  {
    name: "Albúmina",
    value: 4.2,
    unit: "g/dL",
    referenceMin: 3.5,
    referenceMax: 5.5,
    category: "Hepático",
  },
  {
    name: "Proteínas totales",
    value: 7.0,
    unit: "g/dL",
    referenceMin: 6.0,
    referenceMax: 8.3,
    category: "Hepático",
  },
  {
    name: "Sodio",
    value: 140,
    unit: "mEq/L",
    referenceMin: 136,
    referenceMax: 145,
    category: "Electrolitos",
  },
  {
    name: "Potasio",
    value: 4.2,
    unit: "mEq/L",
    referenceMin: 3.5,
    referenceMax: 5.0,
    category: "Electrolitos",
  },
  {
    name: "Cloro",
    value: 102,
    unit: "mEq/L",
    referenceMin: 98,
    referenceMax: 106,
    category: "Electrolitos",
  },
  {
    name: "Calcio",
    value: 9.5,
    unit: "mg/dL",
    referenceMin: 8.5,
    referenceMax: 10.5,
    category: "Electrolitos",
  },
  {
    name: "Fósforo",
    value: 3.5,
    unit: "mg/dL",
    referenceMin: 2.5,
    referenceMax: 4.5,
    category: "Electrolitos",
  },
  {
    name: "Magnesio",
    value: 2.0,
    unit: "mg/dL",
    referenceMin: 1.7,
    referenceMax: 2.2,
    category: "Electrolitos",
  },
  {
    name: "Hierro sérico",
    value: 90,
    unit: "μg/dL",
    referenceMin: 60,
    referenceMax: 170,
    category: "Electrolitos",
  },
  {
    name: "TSH",
    value: 2.5,
    unit: "mIU/L",
    referenceMin: 0.4,
    referenceMax: 4.0,
    category: "Tiroides",
  },
  {
    name: "T4 libre",
    value: 1.2,
    unit: "ng/dL",
    referenceMin: 0.8,
    referenceMax: 1.8,
    category: "Tiroides",
  },
  {
    name: "T3 libre",
    value: 3.1,
    unit: "pg/mL",
    referenceMin: 2.3,
    referenceMax: 4.2,
    category: "Tiroides",
  },
  {
    name: "Vitamina D",
    value: 32,
    unit: "ng/mL",
    referenceMin: 30,
    referenceMax: 100,
    category: "Vitaminas",
  },
  {
    name: "Vitamina B12",
    value: 450,
    unit: "pg/mL",
    referenceMin: 200,
    referenceMax: 900,
    category: "Vitaminas",
  },
  {
    name: "Ácido fólico",
    value: 12,
    unit: "ng/mL",
    referenceMin: 3.0,
    referenceMax: 17,
    category: "Vitaminas",
  },
  {
    name: "Ferritina",
    value: 120,
    unit: "ng/mL",
    referenceMin: 20,
    referenceMax: 250,
    category: "Vitaminas",
  },
  {
    name: "PCR (Proteína C reactiva)",
    value: 0.5,
    unit: "mg/L",
    referenceMin: 0,
    referenceMax: 3.0,
    category: "Inflamación",
  },
  {
    name: "VSG",
    value: 8,
    unit: "mm/h",
    referenceMin: 0,
    referenceMax: 15,
    category: "Inflamación",
  },
  {
    name: "PSA",
    value: 1.2,
    unit: "ng/mL",
    referenceMin: 0,
    referenceMax: 4.0,
    category: "Marcadores",
  },
];

export const BLOOD_TEST_RESULTS: BloodTestWithHistory[] = raw.map((r, i) => ({
  ...r,
  id: `bt-${i}`,
  status: getStatus(r.value, r.referenceMin, r.referenceMax),
  history: generateHistory(r.value, r.referenceMin, r.referenceMax),
}));

export const CATEGORIES = [...new Set(raw.map((r) => r.category))];

export interface Correlation {
  id: string;
  title: string;
  description: string;
  risk: "low" | "moderate" | "high";
  relatedTests: string[];
  recommendation: string;
}

export const CORRELATIONS: Correlation[] = [
  {
    id: "c1",
    title: "Riesgo cardiovascular",
    description:
      "Tu colesterol total está ligeramente elevado (210 mg/dL). Combinado con tu perfil de triglicéridos en el límite superior, existe un riesgo cardiovascular moderado.",
    risk: "moderate",
    relatedTests: ["Colesterol total", "Triglicéridos", "Colesterol HDL", "Colesterol LDL"],
    recommendation:
      "Incrementar actividad física aeróbica y reducir grasas saturadas. Reevaluar en 3 meses.",
  },
  {
    id: "c2",
    title: "Función tiroidea",
    description:
      "Tus niveles de TSH, T4 libre y T3 libre están dentro de rangos normales. No se detectan alteraciones tiroideas.",
    risk: "low",
    relatedTests: ["TSH", "T4 libre", "T3 libre"],
    recommendation: "Continuar monitoreo anual de función tiroidea.",
  },
  {
    id: "c3",
    title: "Metabolismo glucídico",
    description:
      "Glucosa en ayunas de 95 mg/dL y HbA1c de 5.4% están en rango normal, pero cercanos al límite para prediabetes. Considerando tu edad y perfil lipídico, es importante vigilar.",
    risk: "moderate",
    relatedTests: ["Glucosa", "Hemoglobina glucosilada (HbA1c)", "Insulina"],
    recommendation:
      "Mantener dieta baja en azúcares refinados. Considerar prueba de tolerancia a la glucosa si la glucosa sube por encima de 100 mg/dL.",
  },
  {
    id: "c4",
    title: "Función hepática",
    description:
      "Todos los marcadores hepáticos (AST, ALT, GGT, bilirrubinas, albúmina) están dentro de rangos normales. No se detecta daño hepático.",
    risk: "low",
    relatedTests: ["AST (TGO)", "ALT (TGP)", "GGT", "Bilirrubina total", "Albúmina"],
    recommendation: "Sin acciones necesarias. Mantener hábitos saludables.",
  },
  {
    id: "c5",
    title: "Función renal",
    description:
      "Creatinina, BUN y TFG estimada en rangos normales. Ácido úrico de 6.5 mg/dL está dentro del rango pero en el cuartil superior.",
    risk: "low",
    relatedTests: ["Creatinina", "BUN (Nitrógeno ureico)", "Ácido úrico", "TFG estimada"],
    recommendation:
      "Mantener hidratación adecuada. Monitorear ácido úrico si se presentan síntomas articulares.",
  },
  {
    id: "c6",
    title: "Deficiencia de Vitamina D",
    description:
      "Tu vitamina D está en 32 ng/mL, justo en el límite inferior del rango óptimo. En combinación con tu calcio normal, no hay riesgo óseo inmediato, pero mejorar los niveles sería beneficioso.",
    risk: "moderate",
    relatedTests: ["Vitamina D", "Calcio", "Fósforo"],
    recommendation:
      "Suplementar con 2000 UI de vitamina D3 diaria. Exposición solar moderada 15 min/día.",
  },
  {
    id: "c7",
    title: "Estado inflamatorio",
    description:
      "PCR de 0.5 mg/L y VSG de 8 mm/h indican ausencia de inflamación sistémica significativa.",
    risk: "low",
    relatedTests: ["PCR (Proteína C reactiva)", "VSG"],
    recommendation: "Sin acciones necesarias.",
  },
  {
    id: "c8",
    title: "Perfil hematológico",
    description:
      "Biometría hemática completa dentro de parámetros normales. Sin anemia, sin alteraciones en líneas celulares.",
    risk: "low",
    relatedTests: ["Hemoglobina", "Hematocrito", "Eritrocitos", "Leucocitos", "Plaquetas"],
    recommendation: "Continuar alimentación rica en hierro y ácido fólico.",
  },
];

export interface UserProfile {
  name: string;
  age: number;
  sex: string;
  weight: number;
  height: number;
  bloodType: string;
  conditions: string[];
  medications: string[];
}

export const USER_PROFILE: UserProfile = {
  name: "Carlos Montedonico",
  age: 38,
  sex: "Masculino",
  weight: 82,
  height: 178,
  bloodType: "O+",
  conditions: ["Hipercolesterolemia leve"],
  medications: ["Ninguno"],
};

export interface ExamRecord {
  id: string;
  date: string;
  lab: string;
  type: string;
  fileCount: number;
  status: "processed" | "pending" | "error";
}

export const EXAM_RECORDS: ExamRecord[] = [
  {
    id: "e1",
    date: "2026-03-10",
    lab: "Chopo Sucursal Centro",
    type: "Biometría hemática + Química sanguínea",
    fileCount: 2,
    status: "processed",
  },
  {
    id: "e2",
    date: "2025-12-15",
    lab: "Chopo Sucursal Polanco",
    type: "Panel tiroideo",
    fileCount: 1,
    status: "processed",
  },
  {
    id: "e3",
    date: "2025-09-20",
    lab: "Chopo Sucursal Santa Fe",
    type: "Perfil lipídico",
    fileCount: 1,
    status: "processed",
  },
  {
    id: "e4",
    date: "2025-06-05",
    lab: "Chopo Sucursal Condesa",
    type: "Química sanguínea 40 elementos",
    fileCount: 3,
    status: "processed",
  },
];

export interface ParsedLabResult {
  marker: string;
  value: number;
  unit: string;
  refRange?: string;
  confidence: number;
  raw: string;
  provider?: 'gemotest' | 'helix' | 'invitro' | 'kdl' | 'unknown';
}

// Маркер → стандартный код (расширенный)
const MARKER_ALIASES: Record<string, string> = {
  'АЛТ': 'ALT', 'ALT': 'ALT', 'Аланинаминотрансфераза': 'ALT', 'АЛАТ': 'ALT', 'Alat': 'ALT', 'Gpt': 'ALT',
  'АСТ': 'AST', 'AST': 'AST', 'Аспартатаминотрансфераза': 'AST', 'АСАТ': 'AST', 'Asat': 'AST', 'Got': 'AST',
  'ГГТ': 'GGT', 'GGT': 'GGT', 'Гамма-глутамилтрансфераза': 'GGT', 'Гамма-ГТ': 'GGT', 'Gamma-GT': 'GGT',
  'Билирубин общий': 'TBIL', 'Билирубин': 'TBIL', 'Общий билирубин': 'TBIL', 'Total Bilirubin': 'TBIL', 'Bil T': 'TBIL',
  'Гематокрит': 'HCT', 'HCT': 'HCT', 'Hematocrit': 'HCT',
  'Гемоглобин': 'HGB', 'HGB': 'HGB', 'Hemoglobin': 'HGB', 'Hb': 'HGB',
  'Тромбоциты': 'PLT', 'PLT': 'PLT', 'Thrombocytes': 'PLT', 'Тромбоциты (PLT)': 'PLT',
  'Лейкоциты': 'WBC', 'WBC': 'WBC', 'Leukocytes': 'WBC', 'Белые кровяные клетки': 'WBC',
  'Тестостерон': 'TT', 'Тестостерон общий': 'TT', 'TT': 'TT', 'Testosterone Total': 'TT', 'Test': 'TT',
  'Эстрадиол': 'E2', 'E2': 'E2', 'Estradiol': 'E2', 'Эстрадиол (E2)': 'E2',
  'Пролактин': 'PRL', 'PRL': 'PRL', 'Prolactin': 'PRL', 'Пролактин макромолекулярный': 'PRL_MACRO',
  'ЛГ': 'LH', 'LH': 'LH', 'Лютеинизирующий гормон': 'LH', 'Luteinizing Hormone': 'LH',
  'ФСГ': 'FSH', 'FSH': 'FSH', 'Фолликулостимулирующий гормон': 'FSH', 'Follicle Stimulating Hormone': 'FSH',
  'Глюкоза': 'GLU', 'GLU': 'GLU', 'Сахар': 'GLU', 'Glucose': 'GLU', 'Gluc': 'GLU',
  'Холестерин общий': 'CHOL', 'Холестерин': 'CHOL', 'Total Cholesterol': 'CHOL',
  'ЛПНП': 'LDL', 'LDL': 'LDL', 'Липопротеины низкой плотности': 'LDL', 'LDL Cholesterol': 'LDL',
  'ЛПВП': 'HDL', 'HDL': 'HDL', 'Липопротеины высокой плотности': 'HDL', 'HDL Cholesterol': 'HDL',
  'Триглицериды': 'TG', 'TG': 'TG', 'Triglycerides': 'TG', 'ТГ': 'TG',
  'Креатинин': 'CREATININE', 'CREAT': 'CREATININE', 'CR': 'CREATININE', 'Creatinine': 'CREATININE', 'Кр': 'CREATININE',
  'Мочевина': 'UREA', 'Urea': 'UREA', 'BUN': 'UREA',
  'ТТГ': 'TSH', 'TSH': 'TSH', 'Тиреотропный гормон': 'TSH', 'Thyroid Stimulating Hormone': 'TSH',
  'Т3 свободный': 'FT3', 'FT3': 'FT3', 'Free T3': 'FT3', 'Т3 своб.': 'FT3',
  'Т4 свободный': 'FT4', 'FT4': 'FT4', 'Free T4': 'FT4', 'Т4 своб.': 'FT4',
  'Ферритин': 'FERRITIN', 'Ferritin': 'FERRITIN', 'Fer': 'FERRITIN',
  'Витамин D': 'VITD', '25-OH Vitamin D': 'VITD', 'Витамин D общий': 'VITD', 'Vitamin D Total': 'VITD',
  'HbA1c': 'HbA1c', 'Гликированный гемоглобин': 'HbA1c', 'HbA1': 'HbA1c', 'Гликогемоглобин': 'HbA1c',
  'ИФР-1': 'IGF1', 'IGF-1': 'IGF1', 'Insulin-like Growth Factor 1': 'IGF1',
  'Кальций': 'CA', 'Ca': 'CA', 'Calcium': 'CA',
  'Натрий': 'NA', 'Na': 'NA', 'Sodium': 'NA',
  'Калий': 'K', 'K': 'K', 'Potassium': 'K',
  'Хлор': 'CL', 'Cl': 'CL', 'Chloride': 'CL',
  'Цинк': 'ZN', 'Zn': 'ZN', 'Zinc': 'ZN',
  'Медь': 'CU', 'Cu': 'CU', 'Copper': 'CU',
  'Железо': 'FE', 'Fe': 'FE', 'Iron': 'FE',
  'ОЖСС': 'TIBC', 'Total Iron Binding Capacity': 'TIBC',
  'СРБ': 'CRP', 'CRP': 'CRP', 'C-Reactive Protein': 'CRP', 'С-реактивный белок': 'CRP',
  'Гомоцистеин': 'HOMOCYSTEINE', 'Homocysteine': 'HOMOCYSTEINE', 'Hcy': 'HOMOCYSTEINE',
  'Кортизол': 'CORTISOL', 'Cortisol': 'CORTISOL', 'Корт': 'CORTISOL',
  'Инсулин': 'INSULIN', 'Insulin': 'INSULIN', 'Ins': 'INSULIN',
  'HOMA-IR': 'HOMA', 'HOMA': 'HOMA', 'Индекс HOMA': 'HOMA',
  'Лейкоциты в сперме': 'SPERM_WBC', 'Лейкоспермия': 'SPERM_WBC',
  'MAR-тест': 'MAR', 'MAR-test': 'MAR', 'MAR test': 'MAR',
  'Подвижность (PR)': 'PR', 'PR': 'PR', 'Progressive motility': 'PR',
  'Морфология': 'MORPHOLOGY', 'Morphology': 'MORPHOLOGY', 'Крюгер': 'MORPHOLOGY'
};

const UNIT_ALIASES: Record<string, string> = {
  'ед/л': 'U/L', 'ед/мл': 'U/mL', 'U/L': 'U/L', 'U/l': 'U/L', 'U/ml': 'U/mL',
  'нг/мл': 'ng/mL', 'нг/дл': 'ng/dL', 'ng/ml': 'ng/mL', 'ng/dl': 'ng/dL',
  'пг/мл': 'pg/mL', 'pg/ml': 'pg/mL', 'мкМЕ/мл': 'mIU/mL', 'миу/мл': 'mIU/mL', 'mIU/ml': 'mIU/mL',
  'ммоль/л': 'mmol/L', 'моль/л': 'mol/L', 'mmol/l': 'mmol/L',
  'г/л': 'g/L', 'г/дл': 'g/dL', 'g/l': 'g/L', 'g/dl': 'g/dL',
  '%': '%', 'процентов': '%', 'тыс/мкл': 'K/uL', '10^9/л': '10^9/L',
  'мкг/дл': 'mcg/dL', 'мкг/л': 'mcg/L', 'мкг/мл': 'mcg/mL',
  'нмоль/л': 'nmol/L', 'пмоль/л': 'pmol/L'
};

function detectProvider(text: string): ParsedLabResult['provider'] {
  const t = text.toLowerCase();
  if (t.includes('гемотест') || t.includes('gemotest')) return 'gemotest';
  if (t.includes('хеликс') || t.includes('helix')) return 'helix';
  if (t.includes('инвитро') || t.includes('invitro')) return 'invitro';
  if (t.includes('кдл') || t.includes('kdl') || t.includes('клинико-диагностическая лаборатория')) return 'kdl';
  return 'unknown';
}

function normalizeMarker(raw: string): string | null {
  const clean = raw.replace(/[()\[\]{}]/g, '').replace(/\s+/g, ' ').trim();
  if (MARKER_ALIASES[clean]) return MARKER_ALIASES[clean];
  // Fuzzy match by first word or abbreviation
  const parts = clean.split(/\s+/);
  for (const p of parts) {
    const upper = p.replace(/[,.:;]/g, '').toUpperCase();
    if (MARKER_ALIASES[upper]) return MARKER_ALIASES[upper];
  }
  return null;
}

function normalizeUnit(raw: string): string {
  if (!raw) return 'ед.';
  const clean = raw.replace(/[(),.]/g, '').trim().toLowerCase();
  return UNIT_ALIASES[clean] || raw;
}

export function parseLabText(text: string): ParsedLabResult[] {
  const provider = detectProvider(text);
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 4);
  const results: ParsedLabResult[] = [];

  for (const line of lines) {
    // Skip headers, footers, empty lines
    if (/^(номер|дата|пациент|врач|лаборатория|референс|примечание|тест|код|страница|page|patient|doctor|lab|result|unit|reference)/i.test(line.trim())) continue;

    // Main pattern: Marker Value [Unit] [Ref]
    const mainMatch = line.match(
      /([А-ЯA-Z][а-яa-z\s\-\/\(\)\.\,]{2,30}?)\s+([\d,]+(?:\.[\d]+)?)\s*([А-ЯA-Za-z\/°%\^~\*]+)?\s*(?:[<>=≤≥]?\s*[\d,]+(?:\.[\d]+)?\s*[-–—]?\s*[\d,]+(?:\.[\d]+)?|Рефер[\w\s:]*[\d,]+(?:\.[\d]+)?\s*[-–—]\s*[\d,]+(?:\.[\d]+)?)?/i
    );

    if (mainMatch) {
      const valStr = mainMatch[2].replace(',', '.');
      const value = parseFloat(valStr);
      if (isNaN(value) || value <= 0 || value > 99999) continue;

      const marker = normalizeMarker(mainMatch[1]);
      if (!marker) continue;

      const refMatch = line.match(/(?:[<>=≤≥]?\s*[\d,]+(?:\.[\d]+)?\s*[-–—]\s*[\d,]+(?:\.[\d]+)?|Рефер[\w\s:]*[\d,]+(?:\.[\d]+)?\s*[-–—]\s*[\d,]+(?:\.[\d]+)?)/i);

      results.push({
        marker,
        value,
        unit: normalizeUnit(mainMatch[3] || ''),
        refRange: refMatch ? refMatch[0].replace(/\s+/g, ' ').trim() : undefined,
        confidence: provider !== 'unknown' ? 0.95 : 0.85,
        raw: line.trim(),
        provider
      });
    }
  }

  return results;
}
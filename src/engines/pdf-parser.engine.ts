export interface ParsedLabValue {
  code: string;
  name: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
  isAbnormal?: boolean;
}

export interface ParsedLabResult {
  values: ParsedLabValue[];
  rawText: string;
  source: 'pdf' | 'image' | 'text';
  date?: string;
  warnings?: string[];
}

const LAB_PATTERNS: { code: string; names: string[]; unitPatterns: string[]; refPattern?: RegExp }[] = [
  { code: 'ALT', names: ['АЛТ', 'ALT', 'аланин', 'аланинаминотрансфераза', 'Alanine aminotransferase'], unitPatterns: ['Е/л', 'U/L', 'U/l', 'ед/л', 'ЕД/л'] },
  { code: 'AST', names: ['АСТ', 'AST', 'аспартат', 'аспартатаминотрансфераза', 'Aspartate aminotransferase'], unitPatterns: ['Е/л', 'U/L', 'U/l', 'ед/л', 'ЕД/л'] },
  { code: 'GGT', names: ['ГГТ', 'GGT', 'гамма-глутамилтранспептидаза', 'Gamma-GT', 'гамма-ГТ'], unitPatterns: ['Е/л', 'U/L', 'U/l', 'ед/л'] },
  { code: 'ALP', names: ['щелочная фосфатаза', 'ЩФ', 'ALP', 'Alkaline Phosphatase', 'щелоч'], unitPatterns: ['Е/л', 'U/L', 'U/l', 'ед/л'] },
  { code: 'BIL', names: ['билирубин', 'Bilirubin', 'BIL', 'билирубин общий', 'общий билирубин', 'Bilirubin total'], unitPatterns: ['мкмоль/л', 'umol/L', 'мкм/л'] },
  { code: 'BILD', names: ['билирубин прямой', 'прямой билирубин', 'Bilirubin direct', 'BIL-D'], unitPatterns: ['мкмоль/л', 'umol/L'] },
  { code: 'GLU', names: ['глюкоза', 'Glucose', 'GLU', 'сахар крови'], unitPatterns: ['ммоль/л', 'mmol/L', 'mg/dL', 'mM'] },
  { code: 'CREAT', names: ['креатинин', 'Creatinine', 'CREAT', 'CREA', 'креат'], unitPatterns: ['мкмоль/л', 'umol/L', 'мг/дл', 'mg/dL', 'мкМ/л'] },
  { code: 'UREA', names: ['мочевина', 'Urea', 'BUN', 'азот мочевины'], unitPatterns: ['ммоль/л', 'mmol/L', 'mg/dL', 'mM'] },
  { code: 'URIC', names: ['мочевая кислота', 'Uric acid', 'UA', 'моч.кислота'], unitPatterns: ['мкмоль/л', 'umol/L', 'мг/дл', 'mg/dL'] },
  { code: 'TP', names: ['общий белок', 'Total Protein', 'TP', 'белок общий'], unitPatterns: ['г/л', 'g/L'] },
  { code: 'ALB', names: ['альбумин', 'Albumin', 'ALB'], unitPatterns: ['г/л', 'g/L'] },
  { code: 'HGB', names: ['гемоглобин', 'Hemoglobin', 'HGB', 'Hb'], unitPatterns: ['г/л', 'g/L', 'g/dL'] },
  { code: 'WBC', names: ['лейкоциты', 'WBC', 'лейкоцит', 'White blood cells'], unitPatterns: ['10^9/л', '10\\^9/L', '×10⁹/л', '/л', 'тыс/мкл'] },
  { code: 'RBC', names: ['эритроциты', 'RBC', 'эритроцит', 'Red blood cells'], unitPatterns: ['10^12/л', '10\\^12/L', '×10¹²/л', '/л', 'млн/мкл'] },
  { code: 'PLT', names: ['тромбоциты', 'PLT', 'Platelet', 'тромбоцит'], unitPatterns: ['10^9/л', '10\\^9/L', '×10⁹/л', '/л', 'тыс/мкл'] },
  { code: 'HCT', names: ['гематокрит', 'Hematocrit', 'HCT', 'Ht'], unitPatterns: ['%', '%'] },
  { code: 'MCV', names: ['MCV', 'средний объем эритроцита'], unitPatterns: ['фл', 'fl', 'мкм³'] },
  { code: 'MCH', names: ['MCH', 'среднее содержание Hb в эр'], unitPatterns: ['пг', 'pg'] },
  { code: 'MCHC', names: ['MCHC', 'средняя конц. Hb в эр'], unitPatterns: ['г/л', 'g/L'] },
  { code: 'NEUT', names: ['нейтрофилы', 'NEUT', 'Neutrophils'], unitPatterns: ['%', '10^9/л'] },
  { code: 'LYMPH', names: ['лимфоциты', 'LYMPH', 'Lymphocytes'], unitPatterns: ['%', '10^9/л'] },
  { code: 'MONO', names: ['моноциты', 'MONO', 'Monocytes'], unitPatterns: ['%', '10^9/л'] },
  { code: 'EO', names: ['эозинофилы', 'EO', 'Eosinophils'], unitPatterns: ['%', '10^9/л'] },
  { code: 'BASO', names: ['базофилы', 'BASO', 'Basophils'], unitPatterns: ['%', '10^9/л'] },
  { code: 'CHOL', names: ['холестерин', 'холестерол', 'Cholesterol', 'CHOL', 'ХС общий', 'холестерин общий'], unitPatterns: ['ммоль/л', 'mmol/L', 'mg/dL', 'mM'] },
  { code: 'HDL', names: ['ЛПВП', 'HDL', 'ЛПВП-ХС', 'холестерин ЛПВП', 'HDL-C'], unitPatterns: ['ммоль/л', 'mmol/L', 'mM'] },
  { code: 'LDL', names: ['ЛПНП', 'LDL', 'ЛПНП-ХС', 'холестерин ЛПНП', 'LDL-C'], unitPatterns: ['ммоль/л', 'mmol/L', 'mM'] },
  { code: 'VLDL', names: ['ЛПОНП', 'VLDL', 'ЛПОНП-ХС'], unitPatterns: ['ммоль/л', 'mmol/L'] },
  { code: 'TG', names: ['триглицериды', 'Triglycerides', 'TG', 'ТГ'], unitPatterns: ['ммоль/л', 'mmol/L', 'mg/dL', 'mM'] },
  { code: 'CRP', names: ['С-реактивный белок', 'СРБ', 'CRP', 'C-Reactive', 'hsCRP', 'hs-СРБ'], unitPatterns: ['мг/л', 'mg/L'] },
  { code: 'ESR', names: ['СОЭ', 'ESR', 'скорость оседания', 'РОЭ'], unitPatterns: ['мм/ч', 'mm/h'] },
  { code: 'FER', names: ['ферритин', 'Ferritin', 'FER'], unitPatterns: ['мкг/л', 'ug/L', 'нг/мл', 'ng/mL', 'мк/л'] },
  { code: 'TSH', names: ['ТТГ', 'TSH', 'тиреотропный', 'тиротропин'], unitPatterns: ['мЕд/л', 'mIU/L', 'мМЕ/л', 'мЕд/мл'] },
  { code: 'FT4', names: ['Т4 свободный', 'Т4 св', 'FT4', 'Free T4', 'тироксин свободный'], unitPatterns: ['пмоль/л', 'pmol/L'] },
  { code: 'FT3', names: ['Т3 свободный', 'Т3 св', 'FT3', 'Free T3', 'трийодтиронин свободный'], unitPatterns: ['пмоль/л', 'pmol/L'] },
  { code: 'T4', names: ['Т4 общий', 'тироксин общий', 'Total T4'], unitPatterns: ['нмоль/л', 'nmol/L'] },
  { code: 'T3', names: ['Т3 общий', 'трийодтиронин общий', 'Total T3'], unitPatterns: ['нмоль/л', 'nmol/L'] },
  { code: 'TESTO', names: ['тестостерон', 'Testosterone', 'тестостерон общий', 'общий тестостерон'], unitPatterns: ['нмоль/л', 'nmol/L', 'нг/мл', 'ng/mL', 'нг/дл', 'ng/dL'] },
  { code: 'FTESTO', names: ['тестостерон свободный', 'свободный тестостерон', 'Free Testosterone', 'Free T'], unitPatterns: ['пмоль/л', 'pmol/L', 'пг/мл', 'pg/mL'] },
  { code: 'SHBG', names: ['SHBG', 'ГСПГ', 'глобулин связывающий половые'], unitPatterns: ['нмоль/л', 'nmol/L'] },
  { code: 'DHEA', names: ['DHEA', 'ДГЭА', 'DHEA-S', 'ДГЭА-С', 'дегидроэпиандростерон'], unitPatterns: ['мкг/дл', 'ug/dL', 'мкмоль/л', 'umol/L', 'нг/мл'] },
  { code: 'ANDRO', names: ['андростендион', 'Androstenedione'], unitPatterns: ['нг/мл', 'ng/mL', 'нмоль/л'] },
  { code: 'ESTR', names: ['эстрадиол', 'Estradiol', 'E2', 'EII'], unitPatterns: ['пмоль/л', 'pmol/L', 'pg/mL'] },
  { code: 'PROG', names: ['прогестерон', 'Progesterone', 'PROG'], unitPatterns: ['нмоль/л', 'nmol/L', 'нг/мл'] },
  { code: 'PROL', names: ['пролактин', 'Prolactin', 'PRL'], unitPatterns: ['мЕд/л', 'mIU/L', 'нг/мл', 'ng/mL', 'мМЕ/л'] },
  { code: 'LH', names: ['ЛГ', 'LH', 'лютеинизирующий', 'лютропин'], unitPatterns: ['мЕд/л', 'mIU/L', 'мМЕ/мл'] },
  { code: 'FSH', names: ['ФСГ', 'FSH', 'фолликулостимулирующий', 'фоллитропин'], unitPatterns: ['мЕд/л', 'mIU/L', 'мМЕ/мл'] },
  { code: 'CORT', names: ['кортизол', 'Cortisol', 'CORT'], unitPatterns: ['нмоль/л', 'nmol/L', 'мкг/дл', 'ug/dL'] },
  { code: 'INSULIN', names: ['инсулин', 'Insulin', 'INS', 'IMMUNOREACTIVE INSULIN'], unitPatterns: ['мкЕд/мл', 'uIU/mL', 'пмоль/л', 'pmol/L'] },
  { code: 'HOMOCYSTEINE', names: ['гомоцистеин', 'Homocysteine', 'Hcy'], unitPatterns: ['мкмоль/л', 'umol/L'] },
  { code: 'HBA1C', names: ['HbA1c', 'гликированный гемоглобин', 'HBA1C', 'гликогемоглобин', 'HbA1'], unitPatterns: ['%', '%', 'ммоль/моль'] },
  { code: 'PSA', names: ['PSA', 'ПСА', 'простатический антиген', 'PSA общий'], unitPatterns: ['нг/мл', 'ng/mL'] },
  { code: 'PSAF', names: ['PSA свободный', 'ПСА свободный', 'Free PSA'], unitPatterns: ['нг/мл', 'ng/mL'] },
  { code: 'CA125', names: ['CA-125', 'СА-125', 'CA125'], unitPatterns: ['Е/мл', 'U/mL'] },
  { code: 'AFP', names: ['AFP', 'АФП', 'альфа-фетопротеин'], unitPatterns: ['МЕ/мл', 'IU/mL'] },
  { code: 'CEA', names: ['CEA', 'РЭА', 'раково-эмбриональный антиген'], unitPatterns: ['нг/мл', 'ng/mL'] },
  { code: 'VITD', names: ['витамин D', '25-OH витамин D', 'Vitamin D', '25(OH)D', '25-гидроксивитамин D', 'кальциферол'], unitPatterns: ['нг/мл', 'ng/mL', 'нмоль/л', 'nmol/L'] },
  { code: 'B12', names: ['витамин B12', 'B12', 'Cobalamin', 'кобаламин', 'цианокобаламин'], unitPatterns: ['пг/мл', 'pg/mL', 'пмоль/л', 'pmol/L'] },
  { code: 'FOLATE', names: ['фолиевая кислота', 'фолат', 'Folate', 'витамин B9', 'B9'], unitPatterns: ['нг/мл', 'ng/mL', 'нмоль/л'] },
  { code: 'IRON', names: ['железо', 'Iron', 'Fe', 'сывороточное железо'], unitPatterns: ['мкмоль/л', 'umol/L', 'мкг/дл', 'ug/dL'] },
  { code: 'TRANSF', names: ['трансферрин', 'Transferrin', 'TRF'], unitPatterns: ['г/л', 'g/L'] },
  { code: 'TIBC', names: ['ОЖСС', 'TIBC', 'железосвязывающая способность'], unitPatterns: ['мкмоль/л', 'umol/L'] },
  { code: 'K', names: ['калий', 'Potassium', 'K\\+', 'K', 'Kalium'], unitPatterns: ['ммоль/л', 'mmol/L', 'mM'] },
  { code: 'NA', names: ['натрий', 'Sodium', 'Na\\+', 'Na', 'Natrium'], unitPatterns: ['ммоль/л', 'mmol/L', 'mM'] },
  { code: 'CL', names: ['хлор', 'Chloride', 'Cl\\-', 'Cl'], unitPatterns: ['ммоль/л', 'mmol/L'] },
  { code: 'CA', names: ['кальций', 'Calcium', 'Ca', 'кальций общий'], unitPatterns: ['ммоль/л', 'mmol/L', 'mM', 'мг/дл'] },
  { code: 'MG', names: ['магний', 'Magnesium', 'Mg'], unitPatterns: ['ммоль/л', 'mmol/L', 'mM'] },
  { code: 'PHOS', names: ['фосфор', 'Phosphorus', 'P', 'фосфат'], unitPatterns: ['ммоль/л', 'mmol/L', 'mM'] },
  { code: 'LDH', names: ['ЛДГ', 'LDH', 'лактатдегидрогеназа'], unitPatterns: ['Е/л', 'U/L'] },
  { code: 'CK', names: ['КФК', 'CK', 'креатинкиназа', 'CPK'], unitPatterns: ['Е/л', 'U/L'] },
  { code: 'CKMB', names: ['КФК-МВ', 'CK-MB', 'креатинкиназа MB'], unitPatterns: ['Е/л', 'U/L', 'нг/мл'] },
  { code: 'TROP', names: ['тропонин', 'Troponin', 'TnI', 'TnT'], unitPatterns: ['нг/мл', 'ng/mL', 'пг/мл'] },
  { code: 'MYOG', names: ['миоглобин', 'Myoglobin', 'MYO'], unitPatterns: ['нг/мл', 'ng/mL'] },
  { code: 'FIB', names: ['фибриноген', 'Fibrinogen', 'FIB'], unitPatterns: ['г/л', 'g/L', 'мг/дл'] },
  { code: 'DIMER', names: ['D-димер', 'D-dimer', 'DDIMER'], unitPatterns: ['нг/мл', 'ng/mL', 'мкг/л'] },
  { code: 'PT', names: ['протромбиновое время', 'PT', 'Prothrombin time'], unitPatterns: ['сек', 's'] },
  { code: 'INR', names: ['МНО', 'INR', 'международное нормализованное'], unitPatterns: [''] },
  { code: 'APTT', names: ['АЧТВ', 'APTT', 'aPTT', 'Activated partial thromboplastin time'], unitPatterns: ['сек', 's'] },
  { code: 'IGA', names: ['IgA', 'иммуноглобулин A', 'Ig A'], unitPatterns: ['г/л', 'g/L', 'мг/дл'] },
  { code: 'IGG', names: ['IgG', 'иммуноглобулин G', 'Ig G'], unitPatterns: ['г/л', 'g/L', 'мг/дл'] },
  { code: 'IGM', names: ['IgM', 'иммуноглобулин M', 'Ig M'], unitPatterns: ['г/л', 'g/L', 'мг/дл'] },
  { code: 'IGE', names: ['IgE', 'иммуноглобулин E', 'Ig E', 'общий IgE'], unitPatterns: ['МЕ/мл', 'IU/mL'] },
  { code: 'HIV', names: ['ВИЧ', 'HIV', 'антитела к ВИЧ'], unitPatterns: [''] },
  { code: 'HBSAG', names: ['HBsAg', 'австралийский антиген', 'гепатит B'], unitPatterns: [''] },
  { code: 'HCV', names: ['антитела к гепатиту C', 'Anti-HCV', 'HCV'], unitPatterns: [''] },
  { code: 'ABO', names: ['группа крови', 'ABO', 'Blood type'], unitPatterns: [''] },
  { code: 'RH', names: ['резус-фактор', 'Rh', 'RH factor'], unitPatterns: [''] },
  { code: 'SOD', names: ['СОД', 'супероксиддисмутаза', 'SOD'], unitPatterns: ['Е/мл'] },
  { code: 'GLUT', names: ['глутатион', 'Glutathione', 'GSH'], unitPatterns: ['мкмоль/л'] },
  { code: 'GPX', names: ['глутатионпероксидаза', 'GPX', 'Glutathione peroxidase'], unitPatterns: ['Е/г Hb'] },
  { code: 'IGF1', names: ['ИФР-1', 'IGF-1', 'IGF1', 'соматомедин C', 'инсулиноподобный фактор роста'], unitPatterns: ['нг/мл', 'ng/mL', 'нмоль/л'] },
  { code: 'GH', names: ['ГР', 'GH', 'соматотропный', 'гормон роста'], unitPatterns: ['нг/мл', 'ng/mL', 'мЕд/л'] },
  { code: 'PTH', names: ['ПТГ', 'PTH', 'паратгормон', 'паратиреоидный'], unitPatterns: ['пг/мл', 'pg/mL', 'пмоль/л'] },
  { code: 'CT', names: ['кальцитонин', 'Calcitonin', 'CT'], unitPatterns: ['пг/мл', 'pg/mL'] },
  { code: 'RENIN', names: ['ренин', 'Renin', 'RENIN'], unitPatterns: ['мкМЕ/мл', 'pg/mL'] },
  { code: 'ALD', names: ['альдостерон', 'Aldosterone', 'ALD'], unitPatterns: ['пг/мл', 'pg/mL', 'нмоль/л'] },
  { code: 'METAN', names: ['метанефрин', 'Metanephrine', 'MN'], unitPatterns: ['мкг/сут'] },
  { code: 'NMETAN', names: ['норметанефрин', 'Normetanephrine', 'NMN'], unitPatterns: ['мкг/сут'] },
  { code: 'AMY', names: ['амилаза', 'Amylase', 'AMY', 'альфа-амилаза'], unitPatterns: ['Е/л', 'U/L'] },
  { code: 'LIP', names: ['липаза', 'Lipase', 'LIP', 'LPS'], unitPatterns: ['Е/л', 'U/L'] },
];

function extractNumber(text: string): number | null {
  const match = text.match(/[\d]+[.,]?[\d]*/);
  if (!match) return null;
  return parseFloat(match[0].replace(',', '.'));
}

function extractRefRange(text: string): { low?: number; high?: number } {
  const patterns = [
    /(\d+[\.,]?\d*)\s*[-–]\s*(\d+[\.,]?\d*)/,
    /(\d+[\.,]?\d*)\s*[-–]\s*(\d+[\.,]?\d*)\s/,
    /от\s*(\d+[\.,]?\d*)\s*до\s*(\d+[\.,]?\d*)/i,
    /<=\s*(\d+[\.,]?\d*)/,
    />=\s*(\d+[\.,]?\d*)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      if (p === patterns[3]) {
        const high = parseFloat(m[1].replace(',', '.'));
        if (!isNaN(high)) return { low: 0, high };
      }
      if (p === patterns[4]) {
        const low = parseFloat(m[1].replace(',', '.'));
        if (!isNaN(low)) return { low, high: Infinity };
      }
      const low = parseFloat(m[1].replace(',', '.'));
      const high = parseFloat(m[2].replace(',', '.'));
      if (!isNaN(low) && !isNaN(high)) return { low, high };
    }
  }
  return {};
}

const PROVIDER_HEADERS: Record<string, string[]> = {
  invitro: ['наименование', 'результат', 'референс', 'единицы'],
  gemotest: ['наименование', 'результат', 'референс', 'ед'],
  kdl: ['наименование', 'результат', 'референс', 'единицы'],
  helix: ['показатель', 'результат', 'референс', 'единицы'],
};

function detectProviderFromText(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('gemotest')) return 'gemotest';
  if (lower.includes('инвитро') || lower.includes('invitro')) return 'invitro';
  if (lower.includes('helix') || lower.includes('хеликс')) return 'helix';
  if (lower.includes('kdl') || lower.includes('кдл')) return 'kdl';
  return null;
}

interface TextItem { str: string; x: number; y: number; width: number; height: number; }

function groupByRows(items: TextItem[], yTolerance = 5): TextItem[][] {
  const sorted = [...items].sort((a, b) => {
    const dy = a.y - b.y;
    if (Math.abs(dy) > yTolerance) return dy;
    return a.x - b.x;
  });
  const rows: TextItem[][] = [];
  let currentRow: TextItem[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (Math.abs(curr.y - prev.y) <= yTolerance) {
      currentRow.push(curr);
    } else {
      rows.push(currentRow);
      currentRow = [curr];
    }
  }
  if (currentRow.length) rows.push(currentRow);
  return rows;
}

function rowToString(items: TextItem[]): string {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let result = '';
  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (i === 0) {
      result += item.str;
    } else {
      const gap = sorted[i].x - (sorted[i - 1].x + sorted[i - 1].width);
      if (Math.abs(item.x - (sorted[i - 1].x + sorted[i - 1].width)) < 3) {
        result += item.str;
      } else if (gap > 5) {
        result += '\t' + item.str;
      } else {
        result += ' ' + item.str;
      }
    }
  }
  return result;
}

function tryParseTableRows(lines: string[], provider: string | null): ParsedLabValue[] {
  const values: ParsedLabValue[] = [];

  const colDelim = lines.some(l => l.includes('\t')) ? '\t' : /\s{3,}/;

  for (const line of lines) {
    const cols = typeof colDelim === 'string'
      ? line.split(colDelim).map(c => c.trim()).filter(Boolean)
      : line.split(colDelim).map(c => c.trim()).filter(Boolean);

    if (cols.length < 2) continue;

    const combined = cols.join(' | ').toLowerCase();

    for (const labDef of LAB_PATTERNS) {
      const nameMatch = labDef.names.some(n => combined.includes(n.toLowerCase()));
      if (!nameMatch) continue;

      let val: number | null = null;
      let unit = '';
      let refLow: number | undefined;
      let refHigh: number | undefined;

      for (let ci = 0; ci < cols.length; ci++) {
        const cell = cols[ci];
        const num = extractNumber(cell);
        if (num !== null && num > 0 && cell.length < 30) {
          if (val === null) {
            val = num;
            const ref = extractRefRange(cell);
            if (ref.low !== undefined || ref.high !== undefined) {
              refLow = ref.low;
              refHigh = ref.high;
            }
          }
        }
        const unitMatch = cell.match(/^([A-Za-z%\/0-9.\-^]{1,20})$/);
        if (unitMatch && !unit) {
          unit = unitMatch[1];
        }
      }

      if (val === null) continue;
      if (val > 100000) continue;

      values.push({
        code: labDef.code,
        name: labDef.names[0],
        value: val,
        unit: unit || labDef.unitPatterns[0],
        refLow,
        refHigh,
        isAbnormal: refHigh !== undefined ? val > refHigh : refLow !== undefined ? val < refLow : undefined,
      });
      break;
    }
  }

  return values;
}

function providerSpecificParse(lines: string[], provider: string): ParsedLabValue[] {
  const headers = PROVIDER_HEADERS[provider];
  if (!headers) return [];

  const headerLineIdx = lines.findIndex(l => {
    const lower = l.toLowerCase();
    return headers.every(h => lower.includes(h));
  });

  const dataLines = headerLineIdx >= 0
    ? lines.slice(headerLineIdx + 1).filter(l => l.trim().length > 0)
    : lines;

  return tryParseTableRows(dataLines, provider);
}

export function parseLabText(rawText: string): ParsedLabResult {
  const provider = detectProviderFromText(rawText);

  const lines = rawText.split(/\n/).map(l => l.trim()).filter(Boolean);

  let values: ParsedLabValue[] = [];

  if (provider) {
    values = providerSpecificParse(lines, provider);
  }

  if (values.length === 0) {
    for (const labDef of LAB_PATTERNS) {
      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        const nameMatch = labDef.names.some(n => lowerLine.includes(n.toLowerCase()));
        if (!nameMatch) continue;

        const val = extractNumber(line.replace(/[^\d.,\s\-–]/g, ' '));
        if (val === null || val > 100000) continue;

        const ref = extractRefRange(line);

        values.push({
          code: labDef.code,
          name: labDef.names[0],
          value: val,
          unit: labDef.unitPatterns[0],
          refLow: ref.low,
          refHigh: ref.high,
          isAbnormal: ref.high !== undefined ? val > ref.high : ref.low !== undefined ? val < ref.low : undefined,
        });
        break;
      }
    }
  }

  const dateMatch = rawText.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  let date: string | undefined;
  if (dateMatch) {
    const d = dateMatch[1].padStart(2, '0');
    const m = dateMatch[2].padStart(2, '0');
    const y = dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3];
    date = `${y}-${m}-${d}`;
  }

  return { values, rawText, source: 'text', date };
}

export async function parsePDF(file: File): Promise<ParsedLabResult> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items: TextItem[] = content.items.map((item: any) => ({
        str: item.str || '',
        x: item.transform?.[4] ?? 0,
        y: item.transform?.[5] ?? 0,
        width: item.width ?? 0,
        height: item.height ?? 0,
      })).filter((it: TextItem) => it.str.trim().length > 0);

      const rows = groupByRows(items);
      for (const row of rows) {
        fullText += rowToString(row) + '\n';
      }
    }
    const result = parseLabText(fullText);
    if (result.values.length === 0 && fullText.length > 50) {
      result.warnings = ['Предупреждение: PDF распознан, но показатели не найдены. Попробуйте ввести данные вручную.'];
    }
    return result;
  } catch (err: any) {
    return { values: [], rawText: err?.message || String(err), source: 'pdf', warnings: ['Ошибка PDF parsing. Используйте вручную.'] };
  }
}

export async function parseLabFile(file: File): Promise<ParsedLabResult> {
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    return parsePDF(file);
  }
  if (file.type.startsWith('image/') || file.name.match(/\.(png|jpg|jpeg|webp)$/i)) {
    const text = await extractTextFromImage(file);
    return parseLabText(text);
  }
  const text = await file.text();
  return parseLabText(text);
}

async function extractTextFromImage(file: File): Promise<string> {
  try {
    const Tesseract = await import('tesseract.js') as any;
    const result = await Tesseract.recognize(file, 'rus+eng');
    return result.data.text || '';
  } catch {
    return '';
  }
}

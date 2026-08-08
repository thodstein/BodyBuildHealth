export interface ParsedLabValue {
  code: string;
  name: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
  isAbnormal?: boolean;
  raw?: string;
  confidence?: number;
}

export interface ParsedLabResult {
  values: ParsedLabValue[];
  rawText: string;
  originalText?: string;
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
  { code: 'TP', names: ['общий белок', 'Total Protein', 'TP', 'белок общий', 'общ белок', 'общ.белок'], unitPatterns: ['г/л', 'g/L'] },
  { code: 'ALB', names: ['альбумин', 'Albumin', 'ALB', 'альб.'], unitPatterns: ['г/л', 'g/L'] },
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
  { code: 'OH17P', names: ['17-он-прогестерон', '17-гидроксипрогестерон', 'OH17P'], unitPatterns: ['нмоль/л', 'nmol/L'] },
  { code: 'PROG', names: ['прогестерон', 'Progesterone', 'PROG'], unitPatterns: ['нмоль/л', 'nmol/L', 'нг/мл'] },
  { code: 'PROL', names: ['пролактин', 'Prolactin', 'PRL'], unitPatterns: ['мЕд/л', 'mIU/L', 'нг/мл', 'ng/mL', 'мМЕ/л'] },
  { code: 'LH', names: ['ЛГ', 'LH', 'лютеинизирующий', 'лютропин'], unitPatterns: ['мЕд/л', 'mIU/L', 'мМЕ/мл'] },
  { code: 'FSH', names: ['ФСГ', 'FSH', 'фолликулостимулирующий', 'фоллитропин'], unitPatterns: ['мЕд/л', 'mIU/L', 'мМЕ/мл'] },
  { code: 'CORT', names: ['кортизол', 'Cortisol', 'CORT'], unitPatterns: ['нмоль/л', 'nmol/L', 'мкг/дл', 'ug/dL'] },
  { code: 'PROINSULIN', names: ['проинсулин', 'Proinsulin', 'PROINSULIN'], unitPatterns: ['пмоль/л', 'pmol/L'] },
  { code: 'INSULIN', names: ['инсулин', 'Insulin', 'INS', 'IMMUNOREACTIVE INSULIN'], unitPatterns: ['мкЕд/мл', 'uIU/mL', 'пмоль/л', 'pmol/L'] },
  { code: 'FRUCTOSAMINE', names: ['фруктозамин', 'Fructosamine', 'фруктоз.'], unitPatterns: ['мкмоль/л', 'mcmol/L'] },
  { code: 'HOMOCYSTEINE', names: ['гомоцистеин', 'Homocysteine', 'Hcy'], unitPatterns: ['мкмоль/л', 'umol/L'] },
  { code: 'HBA1C', names: ['HbA1c', 'гликированный гемоглобин', 'HBA1C', 'гликогемоглобин', 'HbA1'], unitPatterns: ['%', '%', 'ммоль/моль'] },
  { code: 'PSA', names: ['PSA', 'ПСА', 'простатический антиген', 'PSA общий'], unitPatterns: ['нг/мл', 'ng/mL'] },
  { code: 'PSAF', names: ['PSA свободный', 'ПСА свободный', 'Free PSA'], unitPatterns: ['нг/мл', 'ng/mL'] },
  { code: 'CA125', names: ['CA-125', 'СА-125', 'CA125'], unitPatterns: ['Е/мл', 'U/mL'] },
  { code: 'AFP', names: ['AFP', 'АФП', 'альфа-фетопротеин'], unitPatterns: ['МЕ/мл', 'IU/mL'] },
  { code: 'CEA', names: ['CEA', 'РЭА', 'раково-эмбриональный антиген'], unitPatterns: ['нг/мл', 'ng/mL'] },
  { code: 'VITD', names: ['витамин D', '25-OH витамин D', 'Vitamin D', '25(OH)D', '25-гидроксивитамин D', 'кальциферол'], unitPatterns: ['нг/мл', 'ng/mL', 'нмоль/л', 'nmol/L'] },
  { code: 'B12', names: ['витамин B12', 'B12', 'Cobalamin', 'кобаламин', 'цианокобаламин'], unitPatterns: ['пг/мл', 'pg/mL', 'пмоль/л', 'pmol/L'] },
  { code: 'VITAMIN_B6', names: ['витамин B6', 'Vitamin B6', 'B6', 'пиридоксалин'], unitPatterns: ['нмоль/л', 'nmol/L'] },
  { code: 'VITAMIN_E', names: ['витамин E', 'Vitamin E', 'токоферол'], unitPatterns: ['мкмоль/л', 'mcmol/L'] },
  { code: 'VITAMIN_A', names: ['витамин A', 'Vitamin A', 'ретинол'], unitPatterns: ['мкмоль/л', 'mcmol/L'] },
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
  { code: 'ACTH', names: ['АКТГ', 'ACTH', 'адренокортикотропный гормон'], unitPatterns: ['пг/мл', 'pg/mL'] },
  { code: 'TPO_AB', names: ['АТ к ТПО', 'anti-TPO', 'антитела к тиреопероксидазе'], unitPatterns: ['МЕ/мл', 'IU/mL'] },
  { code: 'TG_AB', names: ['АТ к ТГ', 'АТ к тиреоглобулину', 'anti-TG', 'антитела к тиреоглобулину'], unitPatterns: ['МЕ/мл', 'IU/mL'] },
  { code: 'MPV', names: ['МПВ', 'MPV', 'средний объем тромбоцита'], unitPatterns: ['фл', 'fL'] },
  { code: 'UIBC', names: ['лат. жсс', 'uibc', 'unsaturated iron', 'unsat iron binding', 'лат жсс'], unitPatterns: ['мкмоль/л', 'umol/L'] },
  { code: 'GLOB', names: ['глобулины', 'globulin', 'глобулин общий'], unitPatterns: ['г/л', 'g/L'] },
  { code: 'C_PEPTIDE', names: ['с-пептид', 'c-peptide', 'c peptide', 'с пептид'], unitPatterns: ['пмоль/л', 'pmol/L', 'нг/мл'] },
  { code: 'AG_RATIO', names: ['а/г', 'a/g', 'альбумин/глобулин', 'альбумино-глобулиновый'], unitPatterns: ['', ''] },
  { code: 'BILIR', names: ['билирубин непрямой', 'непрямой билирубин', 'indirect bilirubin', 'BIL-IR'], unitPatterns: ['мкмоль/л', 'umol/L'] },
];

function containsLabName(text: string, name: string): boolean {
  const needle = name.toLowerCase();
  if (needle.length > 3) return text.toLowerCase().includes(needle);
  return new RegExp(`(^|[^a-zа-яё0-9])${needle.replace(/[+]/g, '\\$&')}(?=$|[^a-zа-яё0-9])`, 'i').test(text);
}

function normalizeOcrText(text: string): string {
  return text
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[‐‑‒–—]/g, '-')
    // Remove strikethrough artifacts: word ending with ~ or - (Tesseract reads struck text as "word~" or "word-")
    // Only match when the strike character is followed by whitespace, punctuation, or end of string.
    // This avoids removing parts of reference ranges like "62-106".
    .replace(/\b\w+[~-]+(?=\s|[.,;!?]|$)/g, '')
    .replace(/(\d)[,](\d)/g, '$1.$2')
    // Tesseract occasionally reads zero as Cyrillic O inside numeric cells.
    .replace(/(?<=\d)[ОO](?=\d|[.,])/g, '0')
    .replace(/(?<=\d)[ОO](?=\s|$)/g, '0')
    .replace(/\b(мкмоль|ммоль|мг|нг|пг|мкг)\s*\/\s*(л|мл|дл)\b/gi, '$1/$2')
    // Keep tabs: PDF text extraction uses them as reliable column separators.
    .replace(/ {2,}/g, ' ')
    .trim();
}

function extractNumber(text: string): number | null {
  // Try to find the first standalone number that looks like a lab value (not part of a range)
  const rangeMatch = text.match(/(\d+[\.,]?\d*)\s*[-–]\s*(\d+[\.,]?\d*)/);
  const allNums = text.match(/[\d]+[.,]?[\d]*/g);
  if (!allNums) return null;
  // Filter: skip numbers that appear in a reference range (2.5-5.5 or 2.5 – 5.5)
  const rangeNums = new Set<string>();
  if (rangeMatch) { rangeNums.add(rangeMatch[1]); rangeNums.add(rangeMatch[2]); }
  for (const n of allNums) {
    if (rangeNums.has(n)) continue;
    // Skip if it looks like a year, phone number, etc.
    const clean = n.replace(',', '.');
    const val = parseFloat(clean);
    if (isNaN(val) || val <= 0) continue;
    return val;
  }
  // All numbers are part of a range — not a value column
  return null;
}

function extractResultNumber(text: string): number | null {
  const cleaned = text.replace(/\b(?:от|до|референс|норма|ref)\b/gi, ' ');
  const range = cleaned.match(/(\d+[.,]?\d*)\s*[-–]\s*(\d+[.,]?\d*)/);
  const numbers = cleaned.match(/\d+[.,]?\d*/g) || [];
  const rangeNumbers = range ? new Set([range[1], range[2]]) : new Set<string>();
  for (const token of numbers) {
    if (rangeNumbers.has(token)) continue;
    const value = Number(token.replace(',', '.'));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function extractRefRange(text: string): { low?: number; high?: number } {
  const patterns = [
    /(?:ref|референс|норма|от|до)\s*[:\-]?\s*(\d+[\.,]?\d*)\s*[-–]\s*(\d+[\.,]?\d*)/i,
    /(\d+[\.,]?\d*)\s*[-–]\s*(\d+[\.,]?\d*)\s*(?:единиц|ед\.?|unit|u\/l|mmol|umol|mg|ng|pg|g|мг\/дл|мкмоль|ммоль|нг\/мл|пг\/мл|г\/л|%|сек)/i,
    /(\d+[\.,]?\d*)\s*[-–]\s*(\d+[\.,]?\d*)(?=[^0-9.,]|$)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      if (p === patterns[2]) {
        const rangeMatch = text.match(/(\d+[\.,]?\d*)\s*[-–]\s*(\d+[\.,]?\d*)/);
        if (rangeMatch && rangeMatch[0] === m[0]) {
          const low = parseFloat(m[1].replace(',', '.'));
          const high = parseFloat(m[2].replace(',', '.'));
          if (!isNaN(low) && !isNaN(high) && low < high && low > 0 && high < 100000) {
            return { low, high };
          }
        }
        continue;
      }
      const low = parseFloat(m[1].replace(',', '.'));
      const high = parseFloat(m[2].replace(',', '.'));
      if (!isNaN(low) && !isNaN(high) && low < high && low > 0 && high < 100000) {
        return { low, high };
      }
    }
  }
  return {};
}

function extractUnit(text: string): string {
  const match = text.match(/(?:мк\s*моль|ммоль|моль|мг|нг|пг|мкг|м\s*[ЕEеe]д|мМЕ|Е|ед|г|мл|л)\s*\/\s*(?:дл|мл|л)|(?:umol|mmol|nmol|pmol|mg|ng|pg|ug|mIU|IU|U|g)\s*\/\s*(?:dL|mL|L)|%|сек|s\b/i);
  return match?.[0].replace(/\s+/g, '') || '';
}

function isUnitCell(text: string): boolean {
  return /^(?:%|сек|s|(?:мк\s*моль|ммоль|моль|мг|нг|пг|мкг|м\s*[ЕEеe]д|мМЕ|Е|ед|г|мл|л)\s*\/\s*(?:дл|мл|л)|(?:umol|mmol|nmol|pmol|mg|ng|pg|ug|mIU|IU|U|g)\s*\/\s*(?:dL|mL|L))$/i.test(text.trim());
}

function candidateScore(value: ParsedLabValue): number {
  let score = 0;
  if (value.unit) score += 2;
  if (value.refLow !== undefined || value.refHigh !== undefined) score += 4;
  if (value.raw && /[А-Яа-яA-Za-z]/.test(value.raw)) score += 1;
  if (value.raw && /\d/.test(value.raw)) score += 1;
  return Math.max(0, Math.min(1, score / 8));
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

async function openPdfDocument(pdfjsLib: any, data: ArrayBuffer): Promise<any> {
  try {
    return await pdfjsLib.getDocument({ data }).promise;
  } catch (workerError) {
    // Some WebViews and Telegram Mini App environments cannot load the CDN
    // worker. PDF.js can still extract/render pages in its main thread.
    console.warn('PDF.js worker failed, retrying without worker:', workerError);
    return pdfjsLib.getDocument({ data, disableWorker: true }).promise;
  }
}

function enhanceOcrCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d');
  if (!context) return source;
  context.drawImage(source, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  // Convert to grayscale with strong contrast boost for faint lab text.
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.5 + 128));
    const val = gray < 160 ? Math.max(0, contrast - 20) : 255;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function detectWatermarkText(text: string): string[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const watermarks: string[] = [];
  for (const line of lines) {
    const ratio = (line.match(/[a-zA-Zа-яА-ЯёЁ]/g) || []).length / Math.max(1, line.length);
    if (line.length < 15 && ratio > 0.8 && /[a-zA-Zа-яА-ЯёЁ]{3,}/.test(line)) {
      watermarks.push(line);
    }
  }
  return watermarks;
}

async function recognizeOcrCanvas(Tesseract: any, canvas: HTMLCanvasElement): Promise<string> {
  const enhanced = enhanceOcrCanvas(canvas);
  try {
    const result = await Tesseract.recognize(enhanced, 'rus+eng');
    return result.data.text || '';
  } catch (languageError) {
    console.warn('Russian OCR language data failed, retrying in English:', languageError);
    const result = await Tesseract.recognize(enhanced, 'eng');
    return result.data.text || '';
  }
}

function groupByRows(items: TextItem[], yTolerance = 5): TextItem[][] {
  if (items.length === 0) return [];
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

  // Try tab → 3+ spaces → single space as fallback
  const hasTab = lines.some(l => l.includes('\t'));
  const hasTripleSpace = lines.some(l => /\s{3,}/.test(l));

  const colDelim: string | RegExp = hasTab ? '\t' : (hasTripleSpace ? /\s{3,}/ : /\s+/);

  for (const line of lines) {
    let cols = typeof colDelim === 'string'
      ? line.split(colDelim).map(c => c.trim()).filter(Boolean)
      : line.split(colDelim).map(c => c.trim()).filter(Boolean);

    // Single-space fallback: if we have 4+ words and at least 2 look numeric, use them
    if (!hasTab && !hasTripleSpace && cols.length < 3) {
      const spaceSplit = line.split(/\s+/).map(c => c.trim()).filter(Boolean);
      const numCount = spaceSplit.filter(s => /^[\d,.]+$/.test(s)).length;
      if (spaceSplit.length >= 3 && numCount >= 1) cols = spaceSplit;
    }

    if (cols.length < 2) continue;

    const combined = cols.join(' | ').toLowerCase();

    for (const labDef of LAB_PATTERNS) {
      const nameMatch = labDef.names.some(n => containsLabName(combined, n));
      if (!nameMatch) continue;

      let val: number | null = null;
      let unit = '';
      let refLow: number | undefined;
      let refHigh: number | undefined;

      for (let ci = 0; ci < cols.length; ci++) {
        const cell = cols[ci];
        const isNameCell = labDef.names.some(name => containsLabName(cell, name));
        // Extract reference range from any cell that has a range pattern
        const ref = extractRefRange(cell);
        if (ref.low !== undefined || ref.high !== undefined) {
          refLow = ref.low;
          refHigh = ref.high;
        }
        // Names such as 25(OH)D, T3, T4 and HbA1c contain digits which are
        // not the measured result. Never use the marker/name cell as value.
        const num = isNameCell ? null : extractResultNumber(cell);
        if (num !== null && num > 0 && cell.length < 30) {
          if (val === null) {
            val = num;
          }
        }
        const cellUnit = extractUnit(cell) || (isUnitCell(cell) ? cell : '');
        if (cellUnit && !unit) unit = cellUnit;
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
        raw: line,
        confidence: candidateScore({ code: labDef.code, name: labDef.names[0], value: val, unit: unit || labDef.unitPatterns[0], refLow, refHigh, raw: line }),
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

function parseLabLineGeneric(line: string, val: number): { unit: string; refLow?: number; refHigh?: number } {
  // Try to extract unit from the line
  let unit = '';
  unit = extractUnit(line);
  
  const ref = extractRefRange(line);

  // If no explicit ref range, try to match typical reference pattern from UCUM_MAP
  if (ref.low === undefined || ref.high === undefined) {
    // The ref range might be on the same line after the value
    const refMatch = line.match(/(\d+[\.,]?\d*)\s*[-–]\s*(\d+[\.,]?\d*)/);
    if (refMatch) {
      const rl = parseFloat(refMatch[1].replace(',', '.'));
      const rh = parseFloat(refMatch[2].replace(',', '.'));
      if (!isNaN(rl) && !isNaN(rh)) {
        if (ref.low === undefined) ref.low = rl;
        if (ref.high === undefined) ref.high = rh;
      }
    }
  }

  return { unit, refLow: ref.low, refHigh: ref.high };
}

function tryParseLabFromLine(line: string): { code: string; name: string; value: number; unit: string; refLow?: number; refHigh?: number; raw?: string; confidence?: number } | null {
  const lowerLine = line.toLowerCase();
  
  for (const labDef of LAB_PATTERNS) {
    const nameMatch = labDef.names.some(n => containsLabName(lowerLine, n));
    if (!nameMatch) continue;

    const nameMatchText = labDef.names.find(n => containsLabName(lowerLine, n)) || '';
    const valueText = nameMatchText
      ? line.replace(new RegExp(nameMatchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ')
      : line;
    const val = extractNumber(valueText.replace(/[^\d.,\s\-–]/g, ' '));
    if (val === null || val > 100000) continue;

    const parsed = parseLabLineGeneric(line, val);
    return {
      code: labDef.code,
      name: labDef.names[0],
      value: val,
      unit: parsed.unit || labDef.unitPatterns[0],
      refLow: parsed.refLow,
      refHigh: parsed.refHigh,
      raw: line,
      confidence: candidateScore({ code: labDef.code, name: labDef.names[0], value: val, unit: parsed.unit || labDef.unitPatterns[0], refLow: parsed.refLow, refHigh: parsed.refHigh, raw: line }),
    };
  }
  return null;
}

export function parseLabText(rawText: string): ParsedLabResult {
  const originalText = rawText;
  const normalizedText = normalizeOcrText(rawText);
  const provider = detectProviderFromText(normalizedText);

  const lines = normalizedText.split(/\n/).map(l => l.trim()).filter(Boolean);

  let values: ParsedLabValue[] = [];

  // Watermark detection: filter out short all-alpha lines (common Tesseract watermark artifacts)
  const watermarkLines = detectWatermarkText(normalizedText);

  if (provider && values.length === 0) {
    values = providerSpecificParse(lines, provider);
  }

  // Always run the generic parser as a second pass. Provider PDFs often
  // contain mixed rows where only part of the table was split correctly.
  for (const line of lines) {
    const result = tryParseLabFromLine(line);
    if (!result || values.some(v => v.code === result.code)) continue;
    values.push({
      ...result,
      isAbnormal: result.refHigh !== undefined ? result.value > result.refHigh : result.refLow !== undefined ? result.value < result.refLow : undefined,
      confidence: candidateScore(result),
    });
  }

  if (values.length > 0 || lines.length > 1) {
    // Try combined adjacent lines for codes not yet matched
    for (let i = 0; i < lines.length - 1; i++) {
      const combined = lines[i] + ' ' + lines[i + 1];
      const result = tryParseLabFromLine(combined);
      if (!result) continue;
      if (values.some(v => v.code === result.code)) continue;
      values.push({
        ...result,
        isAbnormal: result.refHigh !== undefined ? result.value > result.refHigh : result.refLow !== undefined ? result.value < result.refLow : undefined,
        confidence: candidateScore(result),
      });
    }
  }

  const dateMatch = normalizedText.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  let date: string | undefined;
  if (dateMatch) {
    const d = dateMatch[1].padStart(2, '0');
    const m = dateMatch[2].padStart(2, '0');
    const y = dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3];
    date = `${y}-${m}-${d}`;
  }

  const warnings: string[] = [];
  if (watermarkLines.length > 0) {
    warnings.push(`Обнаружены возможные водяные знаки (${watermarkLines.length} строк). Они исключены из результатов.`);
  }

  return { values, rawText: normalizedText, originalText, source: 'text', date, warnings };
}

export async function parsePDF(fileOrBuffer: File | ArrayBuffer): Promise<ParsedLabResult> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    const arrayBuffer = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();
    const pdf = await openPdfDocument(pdfjsLib, arrayBuffer);
    let fullText = '';
    let allItems: TextItem[] = [];
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
      allItems.push(...items);

      const rows = groupByRows(items);
      for (const row of rows) {
        fullText += rowToString(row) + '\n';
      }
    }
    const result = parseLabText(fullText);
    // Row grouping may lose columns in PDFs with unusual coordinate layouts.
    // Always parse the raw item stream and use it only to fill missing markers.
    const rawText = allItems.map(it => it.str).join(' ');
    const rawResult = rawText.length > 20 ? parseLabText(rawText) : null;
    if (rawResult) {
      const valuesByCode = new Map<string, ParsedLabValue>();
      for (const value of [...result.values, ...rawResult.values]) {
        const current = valuesByCode.get(value.code);
        if (!current || candidateScore(value) > candidateScore(current)) {
          valuesByCode.set(value.code, value);
        }
      }
      result.values = [...valuesByCode.values()];
    }
    if (result.values.length === 0 && fullText.length > 50) {
      if (rawResult?.values.length) {
        rawResult.warnings = ['Предупреждение: PDF распознан в сыром режиме (таблица не разобрана).'];
        return rawResult;
      }
      result.warnings = ['Предупреждение: PDF распознан, но показатели не найдены. Попробуйте ввести данные вручную.'];
    }
    return result;
  } catch (err: any) {
    return { values: [], rawText: err?.message || String(err), source: 'pdf', warnings: ['Ошибка PDF parsing. Используйте вручную.'] };
  }
}

/** OCR pages of a scanned PDF that has no usable text layer. */
export async function ocrScannedPdf(fileOrBuffer: File | ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  const Tesseract = await import('tesseract.js') as any;
  const arrayBuffer = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();
  const pdf = await openPdfDocument(pdfjsLib, arrayBuffer);
  const texts: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) continue;
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const text = await recognizeOcrCanvas(Tesseract, canvas);
    if (text) texts.push(text);
  }
  return texts.join('\n');
}

export async function parseLabFile(file: File, arrayBuffer?: ArrayBuffer): Promise<ParsedLabResult> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    return parsePDF(arrayBuffer ?? file);
  }
  if (file.type.startsWith('image/') || file.name.match(/\.(png|jpg|jpeg|webp)$/i)) {
    const text = await extractTextFromImage(file);
    return parseLabText(text);
  }
  const text = await file.text();
  return parseLabText(text);
}

async function extractTextFromImage(file: File): Promise<string> {
  const Tesseract = await import('tesseract.js') as any;
  try {
    if (typeof createImageBitmap !== 'function') throw new Error('createImageBitmap is unavailable');
    const bitmap = await createImageBitmap(file);
    const scale = 3;
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width * scale;
    canvas.height = bitmap.height * scale;
    const context = canvas.getContext('2d');
    if (!context) return '';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const enhanced = enhanceOcrCanvas(canvas);
    const result = await Tesseract.recognize(enhanced, 'rus+eng');
    let text = result.data.text || '';
    if (!text.trim()) {
      const fallback = await Tesseract.recognize(canvas, 'rus+eng');
      text = fallback.data.text || '';
    }
    return text;
  } catch (imageProcessingError) {
    console.warn('Enhanced image preprocessing failed, using direct OCR:', imageProcessingError);
    try {
      const result = await Tesseract.recognize(file, 'rus+eng');
      return result.data.text || '';
    } catch (languageError) {
      console.warn('Russian image OCR failed, retrying in English:', languageError);
      try {
        const result = await Tesseract.recognize(file, 'eng');
        return result.data.text || '';
      } catch {
        return '';
      }
    }
  }
}

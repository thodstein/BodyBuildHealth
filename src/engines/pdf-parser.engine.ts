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
  { code: 'ALT', names: ['АЛТ', 'ALT', 'аланин', 'аланинаминотрансфераза'], unitPatterns: ['Е/л', 'U/L', 'U/l', 'ед/л'] },
  { code: 'AST', names: ['АСТ', 'AST', 'аспартат', 'аспартатаминотрансфераза'], unitPatterns: ['Е/л', 'U/L', 'U/l', 'ед/л'] },
  { code: 'GLU', names: ['глюкоза', 'Glucose', 'GLU', 'сахар крови'], unitPatterns: ['ммоль/л', 'mmol/L', 'mg/dL'] },
  { code: 'CREAT', names: ['креатинин', 'Creatinine', 'CREAT', 'креат'], unitPatterns: ['мкмоль/л', 'umol/L', 'umol/l', 'мг/дл', 'mg/dL'] },
  { code: 'HGB', names: ['гемоглобин', 'Hemoglobin', 'HGB', 'Hb'], unitPatterns: ['г/л', 'g/L', 'g/dL'] },
  { code: 'WBC', names: ['лейкоциты', 'WBC', 'лейкоцит'], unitPatterns: ['10^9/л', '10\\^9/L', '×10⁹/л', '/л'] },
  { code: 'RBC', names: ['эритроциты', 'RBC', 'эритроцит'], unitPatterns: ['10^12/л', '10\\^12/L', '×10¹²/л', '/л'] },
  { code: 'PLT', names: ['тромбоциты', 'PLT', 'Platelet', 'тромбоцит'], unitPatterns: ['10^9/л', '10\\^9/L', '×10⁹/л', '/л'] },
  { code: 'CHOL', names: ['холестерин', 'холестерол', 'Cholesterol', 'CHOL', 'ХС общий'], unitPatterns: ['ммоль/л', 'mmol/L', 'mg/dL'] },
  { code: 'HDL', names: ['ЛПВП', 'HDL', 'ЛПВП-ХС', 'холестерин ЛПВП'], unitPatterns: ['ммоль/л', 'mmol/L'] },
  { code: 'LDL', names: ['ЛПНП', 'LDL', 'ЛПНП-ХС', 'холестерин ЛПНП'], unitPatterns: ['ммоль/л', 'mmol/L'] },
  { code: 'TG', names: ['триглицериды', 'Triglycerides', 'TG', 'ТГ'], unitPatterns: ['ммоль/л', 'mmol/L'] },
  { code: 'BIL', names: ['билирубин', 'Bilirubin', 'BIL', 'билирубин общий'], unitPatterns: ['мкмоль/л', 'umol/L'] },
  { code: 'UREA', names: ['мочевина', 'Urea', 'BUN'], unitPatterns: ['ммоль/л', 'mmol/L', 'mg/dL'] },
  { code: 'K', names: ['калий', 'Potassium', 'K\\+', 'K'], unitPatterns: ['ммоль/л', 'mmol/L'] },
  { code: 'NA', names: ['натрий', 'Sodium', 'Na\\+', 'Na'], unitPatterns: ['ммоль/л', 'mmol/L'] },
  { code: 'CA', names: ['кальций', 'Calcium', 'Ca'], unitPatterns: ['ммоль/л', 'mmol/L'] },
  { code: 'TSH', names: ['ТТГ', 'TSH', 'тиреотропный'], unitPatterns: ['мЕд/л', 'mIU/L', 'мМЕ/л'] },
  { code: 'T4', names: ['Т4 свободный', 'Т4 св', 'FT4', 'Free T4'], unitPatterns: ['пмоль/л', 'pmol/L'] },
  { code: 'T3', names: ['Т3 свободный', 'Т3 св', 'FT3', 'Free T3'], unitPatterns: ['пмоль/л', 'pmol/L'] },
  { code: 'FER', names: ['ферритин', 'Ferritin', 'FER'], unitPatterns: ['мкг/л', 'ug/L', 'нг/мл', 'ng/mL'] },
  { code: 'CRP', names: ['С-реактивный белок', 'СРБ', 'CRP', 'C-Reactive'], unitPatterns: ['мг/л', 'mg/L'] },
  { code: 'ESR', names: ['СОЭ', 'ESR', 'скорость оседания'], unitPatterns: ['мм/ч', 'mm/h'] },
  { code: 'TESTO', names: ['тестостерон', 'Testosterone', 'тестостерон общий'], unitPatterns: ['нмоль/л', 'nmol/L', 'нг/мл', 'ng/mL'] },
  { code: 'ESTR', names: ['эстрадиол', 'Estradiol', 'E2'], unitPatterns: ['пмоль/л', 'pmol/L', 'pg/mL'] },
  { code: 'PROL', names: ['пролактин', 'Prolactin', 'PRL'], unitPatterns: ['мЕд/л', 'mIU/L', 'нг/мл', 'ng/mL'] },
  { code: 'ALB', names: ['альбумин', 'Albumin', 'ALB'], unitPatterns: ['г/л', 'g/L'] },
  { code: 'TP', names: ['общий белок', 'Total Protein', 'TP'], unitPatterns: ['г/л', 'g/L'] },
  { code: 'GGT', names: ['ГГТ', 'GGT', 'гамма-глутамилтранспептидаза'], unitPatterns: ['Е/л', 'U/L'] },
  { code: 'ALP', names: ['щелочная фосфатаза', 'ЩФ', 'ALP', 'Alkaline Phosphatase'], unitPatterns: ['Е/л', 'U/L'] },
  { code: 'LH', names: ['ЛГ', 'LH', 'лютеинизирующий'], unitPatterns: ['мЕд/л', 'mIU/L'] },
  { code: 'FSH', names: ['ФСГ', 'FSH', 'фолликулостимулирующий'], unitPatterns: ['мЕд/л', 'mIU/L'] },
  { code: 'VITD', names: ['витамин D', '25-OH витамин D', 'Vitamin D', '25(OH)D'], unitPatterns: ['нг/мл', 'ng/mL', 'нмоль/л', 'nmol/L'] },
  { code: 'B12', names: ['витамин B12', 'B12', 'Cobalamin', 'кобаламин'], unitPatterns: ['пг/мл', 'pg/mL', 'пмоль/л', 'pmol/L'] },
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
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const low = parseFloat(m[1].replace(',', '.'));
      const high = parseFloat(m[2].replace(',', '.'));
      if (!isNaN(low) && !isNaN(high)) return { low, high };
    }
  }
  return {};
}

export function parseLabText(rawText: string): ParsedLabResult {
  const values: ParsedLabValue[] = [];
  const lines = rawText.split(/\n/).map(l => l.trim()).filter(Boolean);

  for (const labDef of LAB_PATTERNS) {
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      let matched = false;
      for (const name of labDef.names) {
        if (lowerLine.includes(name.toLowerCase())) {
          matched = true;
          break;
        }
      }
      if (!matched) continue;

      const val = extractNumber(line.replace(/[^\d.,\s\-–]/g, ' '));
      if (val === null) continue;

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

  const dateMatch = rawText.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  const date = dateMatch ? `${dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}` : undefined;

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
      const strings = content.items.map((item: any) => item.str).filter(Boolean);
      fullText += strings.join(' ') + '\n';
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
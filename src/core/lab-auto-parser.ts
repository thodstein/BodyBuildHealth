import { resolveLabMarker, normalizedRatio } from './labs-mapping';
import { UCUM_MAP } from './constants';

export interface ParsedLabResult {
  marker: string;
  value: number;
  unit: string;
  refRange?: string;
  refLow?: number;
  refHigh?: number;
  confidence: number;
  raw: string;
  provider?: 'gemotest' | 'helix' | 'invitro' | 'kdl' | 'unknown';
  isAbnormal?: boolean;
  deviation?: 'low' | 'high' | 'normal';
  labName?: string;
}

const LAB_REFERENCE_RANGES: Record<string, Partial<Record<string, { low: number; high: number }>>> = {
  gemotest: {},
  helix: {},
  invitro: {},
  kdl: {}
};

const LINE_PATTERNS = [
   /([A-Za-zА-Яа-я0-9().\/ -]{2,60}?)[\s:]+([\d,.]+)\s*([A-Za-z%\/0-9.\-^]{1,20})/i,
   /([\d,.]+)\s*([A-Za-z%\/0-9.\-^]{1,20})\s+([A-Za-zА-Яа-я0-9().\/ -]{2,60}?)/i,
   /([A-Za-zА-Яа-я0-9().\/ -]{2,60}?)\s+([\d,.]+)\s*([A-Za-z%\/0-9.\-^]{1,20})/i,
   /([A-Za-zА-Яа-я0-9().\/ -]{2,60}?)[\s:]+([\d,.]+)\s*([A-Za-z%\/0-9.\-^]{1,20})\s*[\(\[\{]\s*([\d,.]+)\s*[-–]\s*([\d,.]+)\s*[\)\]\}]/i,
   /([A-Za-zА-Яа-я0-9().\/ -]{2,60}?)[\s:]+([\d,.]+)\s*([A-Za-z%\/0-9.\-^]{1,20})\s*([\d,.]+)\s*[-–]\s*([\d,.]+)/i,
];

export function parseLabReference(text: string): { low?: number; high?: number; text?: string } {
  const source = text.replace(/[‐‑‒–—]/g, '-').replace(/,/g, '.');
  const n = '(\\d+(?:\\.\\d+)?)';
  const lt = source.match(new RegExp(`(?:^|[\\s(\\[])(<|≤|<=)\\s*${n}`));
  if (lt) return { high: Number(lt[2]), text: `<${lt[2]}` };
  const gt = source.match(new RegExp(`(?:^|[\\s(\\[])(>|≥|>=)\\s*${n}`));
  if (gt) return { low: Number(gt[2]), text: `>${gt[2]}` };
  const fromTo = source.match(new RegExp(`(?:от|from)\\s*${n}\\s*(?:до|to)\\s*${n}`, 'i'));
  if (fromTo) return { low: Number(fromTo[1]), high: Number(fromTo[2]), text: `${fromTo[1]}-${fromTo[2]}` };
  const range = source.match(new RegExp(`(?:^|[\\s(\\[])(\\d+(?:\\.\\d+)?)\\s*(?:-|\\.\\.)\\s*(\\d+(?:\\.\\d+)?)(?=$|[\\s)\\],;:])`));
  if (range) return { low: Number(range[1]), high: Number(range[2]), text: `${range[1]}-${range[2]}` };
  // Односторонние границы реальных бланков: «до 21», «не более 6.0» — верх;
  // «не менее 3.5», «от 0.15» — низ. Дата «от 15.03.2024» отсекается
  // lookahead'ом (число не кончается на точку перед цифрой).
  const startBoundary = "(?:^|[\\s(\\[«»\"''])";
  const highOnly = source.match(new RegExp(`${startBoundary}(?:до|не\\s*более|(?<!не\\s?)менее|≤)\\s*${n}(?=$|[^0-9.,])`, 'i'));
  const lowOnly = source.match(new RegExp(`${startBoundary}(?:не\\s*менее|от|≥)\\s*${n}(?=$|[^0-9.,])`, 'i'));
  const high = highOnly ? Number(highOnly[1]) : undefined;
  const low = lowOnly ? Number(lowOnly[1]) : undefined;
  if (high !== undefined && Number.isFinite(high) && high >= 0 && high < 100000
    && (low === undefined || low < high)) {
    return { ...(low !== undefined ? { low } : {}), high, text: low !== undefined ? `${low}-${high}` : `<${high}` };
  }
  if (low !== undefined && Number.isFinite(low) && low >= 0 && low < 100000) {
    return { low, text: `>${low}` };
  }
  return {};
}

function parseLabNumber(value: string): number {
  return parseFloat(value.trim().replace(/\s/g, '').replace(',', '.'));
}

function markerPart(raw: string): { name: string; value?: number; unit?: string } {
  // нмоль/пмоль — ДО «моль», иначе префикс теряется и коэффициент
  // пересчёта единиц не применяется.
  const valueUnit = raw.match(/(\d+(?:[.,]\d+)?)\s*((?:мк|н|п)\s*моль|ммоль|мг|нг|пг|мкг|м\s*[ЕEеe]д|мМЕ|МЕ|Е|ед|г|%)(?:\s*\/\s*(л|мл|дл))?/i);
  const name = raw
    .replace(/\d+(?:[.,]\d+)?/g, ' ')
    .replace(/(?:мк|н|п)\s*моль|ммоль|мг|нг|пг|мкг|м\s*[ЕEеe]д|мМЕ|МЕ|Е|ед|г|%/gi, ' ')
    .replace(/[\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    name,
    value: valueUnit ? parseLabNumber(valueUnit[1]) : undefined,
    unit: valueUnit ? `${valueUnit[2]}${valueUnit[3] ? `/${valueUnit[3]}` : ''}` : undefined,
  };
}

/**
 * Настоящая единица измерения обязана содержать букву (кириллицу/латиницу)
 * или «%». Голое число единицей не является: без этой проверки строка
 * «Дата 12.08.2026» разбиралась как «значение 12.08 в единицах 2026»,
 * а нечёткое сопоставление имени «Дата» давало ложный ДГЭА-С.
 */
function isPlausibleUnit(unit: string): boolean {
  const token = unit.replace(/\s/g, '');
  if (!token) return false;
  if (!/[A-Za-zА-Яа-яЁё%µμ]/.test(token)) return false;
  if (/^\d{4}$/.test(token)) return false;
  return true;
}

/**
 * Найти настоящий токен единицы в строке. Нужен, когда «единица», попавшая
 * в общий regex, на деле оказалась референсным диапазоном («7-40», «3,9-5,5»)
 * или иным числом: такие строки раньше либо терялись, либо сохранялись
 * с единицей «7-40».
 */
function findUnitToken(line: string): string | undefined {
  const match = line.match(/(?:мк\s*моль|н\s*моль|п\s*моль|ммоль|моль|мкг|мг|нг|пг|мк\s*[ЕEеe]\s*д|мкМЕ|мМЕ|м\s*[ЕEеe]\s*д|МЕ|ЕД|Е|ед|г|мл|л)\s*\/\s*(?:дл|мл|л|мкл)|(?:umol|mmol|nmol|pmol|mg|ng|pg|ug|mIU|MIU|IU|U|g)\s*\/\s*(?:dL|mL|L|uL)|10\^?\d+\s*\/\s*(?:л|L)|%|мм\/ч|сек|фл|fl\b/iu);
  return match?.[0].replace(/\s/g, '');
}

/**
 * resolveLabMarker возвращает сырое имя в верхнем регистре, если синоним не
 * найден. Для лабораторного парсера это недопустимо: «TR» (OCR «ТТГ») и
 * «КРЕАТИНИН 88 62 -» попадали в результат отдельными показателями.
 * Принимаем только канонические UCUM-коды и реально распознанные синонимы.
 */
function isResolvedMarker(marker: string, rawName: string): boolean {
  if (!marker) return false;
  if (UCUM_MAP[marker]) return true;
  return marker !== rawName.trim().toUpperCase();
}

/**
 * Табличная строка из PDF/OCR с настоящими колонками (табы).
 * Разбор «по паттернам» здесь ненадёжен: «Витамин D 25-OH\t42\t…» давал
 * VITD=25 (цифра из названия), «HbA1c\t5.2\t<6.0\t%» — 5 вместо 5.2.
 * Колонки разбираем напрямую: 1-я — название, первая числовая — результат.
 */
function parseTabLine(line: string, provider: ParsedLabResult['provider']): ParsedLabResult | null {
  if (!line.includes('\t')) return null;
  const cols = line.split('\t').map(c => c.trim()).filter(Boolean);
  if (cols.length < 2) return null;

  // Название может быть не в первой колонке: у Гемотеста бывает колонка
  // кода услуги («A09.05.023»). Ищем первую колонку, которая реально
  // распознаётся как маркер, в пределах первых трёх.
  let nameIdx = -1;
  let marker = '';
  for (let ci = 0; ci < Math.min(cols.length - 1, 3); ci++) {
    const resolved = resolveLabMarker(cols[ci]);
    if (resolved && isResolvedMarker(resolved, cols[ci])) {
      nameIdx = ci;
      marker = resolved;
      break;
    }
  }
  if (nameIdx < 0) return null;

  let value: number | undefined;
  for (const col of cols.slice(nameIdx + 1)) {
    const m = col.match(/^[<>≤≥]?\s*(\d+(?:[.,]\d+)?)(?:\s*[+*])?$/);
    if (m) {
      const parsed = parseLabNumber(m[1]);
      if (Number.isFinite(parsed) && parsed > 0) { value = parsed; break; }
    }
  }
  if (value === undefined) return null;

  const unit = findUnitToken(line) || '';
  const ref = parseLabReference(cols.slice(nameIdx + 1).join(' '));
  const ucum = UCUM_MAP[marker];
  const isAbnormal = ref.low !== undefined || ref.high !== undefined
    ? (ref.low !== undefined && value < ref.low) || (ref.high !== undefined && value > ref.high)
    : ucum ? value < ucum.lln || value > ucum.uln : undefined;
  return {
    marker, value, unit,
    refRange: ref.text, refLow: ref.low, refHigh: ref.high,
    confidence: ref.text ? 0.95 : 0.85,
    raw: line, provider, isAbnormal,
    deviation: isAbnormal ? (ref.low !== undefined && value < ref.low ? 'low' : 'high') : undefined,
  };
}

function parseStructuredLine(line: string, provider: ParsedLabResult['provider']): ParsedLabResult | null {
  const match = line.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([A-Za-zА-Яа-я%µμ0-9]+\s*\/\s*[A-Za-zА-Яа-я0-9]+|%)\s*(.*)$/);
  if (!match) return null;
  if (!isPlausibleUnit(match[3])) return null;
  const marker = resolveLabMarker(match[1].replace(/[|¦]/g, ' '));
  if (!marker || !isResolvedMarker(marker, match[1])) return null;
  const value = parseLabNumber(match[2]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const ref = parseLabReference(match[4]);
  const ucum = UCUM_MAP[marker];
  const isAbnormal = ref.low !== undefined || ref.high !== undefined
    ? (ref.low !== undefined && value < ref.low) || (ref.high !== undefined && value > ref.high)
    : ucum ? value < ucum.lln || value > ucum.uln : undefined;
  return { marker, value, unit: match[3].replace(/\s/g, ''), refRange: ref.text, refLow: ref.low, refHigh: ref.high, confidence: ref.text ? 0.95 : 0.85, raw: line, provider, isAbnormal, deviation: isAbnormal ? (ref.low !== undefined && value < ref.low ? 'low' : 'high') : undefined };
}

export function detectProvider(text: string): ParsedLabResult['provider'] {
  const lower = text.toLowerCase();
  // Реальные бланки печатают бренд кириллицей («ГЕМОТЕСТ», «ИНВИТРО»,
  // «Хеликс», «КДЛ»), а OCR фото часто перемешивает кириллицу и латиницу
  // посимвольно («ГеmоТесТ», «КДL»). Символьные классы допускают оба
  // алфавита в каждой позиции; латинские бренды проверяются отдельно.
  if (/gemotest|г[еeё][мm][оo0][тt][еeё][сc]?[тt]/.test(lower)) return 'gemotest';
  if (/invitro|[иi][нн][вв][иi]?[тt][рр][оo0]/.test(lower)) return 'invitro';
  if (/helix|[хx][еe][лl][иi][кк][сc]/.test(lower)) return 'helix';
  // «/» не считается границей слова: единица «нг/дл» («мг/дл») иначе
  // ложно детектируется как «КДЛ».
  if (/(?:^|[^а-яa-z0-9/])k?дл(?:[^а-яa-z]|$)/.test(lower)) return 'kdl';
  if (/(?:^|[^а-яa-z0-9/])[кk][дd][лl](?:[^а-яa-z]|$)/.test(lower)) return 'kdl';
  return 'unknown';
}

export function parseLabText(text: string): ParsedLabResult[] {
  const results: ParsedLabResult[] = [];
  const provider = detectProvider(text);
  const lines = text.replace(/\r\n/g, '\n')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/(\d),(\d)/g, '$1.$2')
    .split('\n').map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let matched = false;

    const tabParsed = parseTabLine(line, provider);
    if (tabParsed) {
      results.push(tabParsed);
      matched = true;
    }
    // Табличные строки разбираются по колонкам; паттерны по сырой строке
    // давали мусор («Витамин D 25-OH\t42» → 25 в единицах «-OH»).
    if (line.includes('\t')) continue;

    const structured = matched ? null : parseStructuredLine(line, provider);
    if (structured) {
      results.push(structured);
      matched = true;
    }

    for (const pat of matched ? [] : LINE_PATTERNS) {
      const match = line.match(pat);
      if (!match) continue;

      let markerRaw = '';
      let valStr = '';
      let unit = '';
      let refLow: string | undefined;
      let refHigh: string | undefined;

      if (pat === LINE_PATTERNS[0]) {
        markerRaw = match[1];
        valStr = match[2];
        unit = match[3];
      } else if (pat === LINE_PATTERNS[1]) {
        valStr = match[1];
        unit = match[2];
        markerRaw = match[3];
      } else if (pat === LINE_PATTERNS[2]) {
        markerRaw = match[1];
        valStr = match[2];
        unit = match[3];
      } else if (pat === LINE_PATTERNS[3]) {
        markerRaw = match[1];
        valStr = match[2];
        unit = match[3];
        refLow = match[4];
        refHigh = match[5];
      } else if (pat === LINE_PATTERNS[4]) {
        markerRaw = match[1];
        valStr = match[2];
        unit = match[3];
        refLow = match[4];
        refHigh = match[5];
      }

       const value = parseLabNumber(valStr);
        const marker = resolveLabMarker(markerRaw.replace(/[|¦]/g, ' '));
        if (!marker || !isResolvedMarker(marker, markerRaw) || Number.isNaN(value) || value <= 0) continue;
        // «Единица» из общего regex часто оказывается референсом («7-40»).
        // Не выбрасываем строку — ищем настоящую единицу во всей строке.
        // Дата «12.08.2026» по-прежнему отсекается: токена единицы в ней нет.
        if (!isPlausibleUnit(unit)) {
          const realUnit = findUnitToken(line);
          if (!realUnit) continue;
          unit = realUnit;
        }
      let refRange: string | undefined;
      let refLowNum: number | undefined;
      let refHighNum: number | undefined;
      let isAbnormal: boolean | undefined;
      let deviation: 'low' | 'high' | 'normal' | undefined;

       const explicitRef = parseLabReference(line);
       if (explicitRef.low !== undefined || explicitRef.high !== undefined) {
         refRange = explicitRef.text;
         refLowNum = explicitRef.low;
         refHighNum = explicitRef.high;
         isAbnormal = (refLowNum !== undefined && value < refLowNum)
           || (refHighNum !== undefined && value > refHighNum);
         if (isAbnormal) {
           deviation = refLowNum !== undefined && value < refLowNum ? 'low' : 'high';
        }
      } else {
        const ucum = UCUM_MAP[marker];
        if (ucum) {
           isAbnormal = value > ucum.uln || value < ucum.lln;
           if (isAbnormal) {
             deviation = value < ucum.lln ? 'low' : 'high';
          }
        }
      }

      results.push({
        marker,
        value,
        unit: unit.trim(),
        refRange,
        refLow: refLowNum,
        refHigh: refHighNum,
        confidence: 0.85,
        raw: line,
        provider,
        isAbnormal,
        deviation
      });
      matched = true;
      break;
    }

    if (!matched) {
      // Склейка с соседней строкой нужна только для разорванных бланков
      // («Название» / «18.4 Ед/л 8.6-29»). Если в текущей строке уже есть
      // число, а единица просто не распознана («АСТ 30 0-40 E/n»), брать
      // единицу следующей строки нельзя: она принадлежит другому показателю.
      if (/\d/.test(line)) continue;
      const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
      const combined = (line + ' ' + nextLine).trim();
      for (const pat of LINE_PATTERNS) {
        const m = combined.match(pat);
        if (!m) continue;
        let markerRaw = '';
        let valStr = '';
        let u = '';
        if (pat === LINE_PATTERNS[0] || pat === LINE_PATTERNS[2]) {
          markerRaw = m[1]; valStr = m[2]; u = m[3];
        } else { continue; }
         const value = parseLabNumber(valStr);
         const marker = resolveLabMarker(markerRaw.replace(/[|¦]/g, ' '));
        if (!marker || !isResolvedMarker(marker, markerRaw) || Number.isNaN(value) || value <= 0) continue;
        if (!isPlausibleUnit(u)) {
          const realUnit = findUnitToken(combined);
          if (!realUnit) continue;
          u = realUnit;
        }
        results.push({
          marker, value, unit: u.trim(),
          confidence: 0.6, raw: combined, provider,
        });
        break;
      }
    }
  }

  const bestByMarker = new Map<string, ParsedLabResult>();
  for (const result of results) {
    const current = bestByMarker.get(result.marker);
    if (!current) { bestByMarker.set(result.marker, result); continue; }
    const currentHasRef = current.refLow !== undefined || current.refHigh !== undefined;
    const nextHasRef = result.refLow !== undefined || result.refHigh !== undefined;
    if ((nextHasRef && !currentHasRef) || (nextHasRef === currentHasRef && result.confidence > current.confidence)) {
      bestByMarker.set(result.marker, result);
    }
  }
  return [...bestByMarker.values()];
}

export async function extractTextFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsText(file);
  });
}

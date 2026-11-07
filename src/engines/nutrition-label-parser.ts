/**
 * nutrition-label-parser.ts — разбор КБЖУ с фотографии упаковки.
 *
 * Парсер намеренно отделён от `nutrition-ocr-parser`: там разбирают скриншоты
 * дневников (FatSecret/MyFitnessPal), где строка — уже съеденная порция.
 * Здесь строка — этикетка производителя: «на 100 г», таблица «белки/жиры/
 * углеводы» и энергетическая ценность в ккал или кДж.
 *
 * Инвариант проекта: все значения приводятся к 100 г. Если на упаковке
 * указана только порция, пересчитываем по её массе; без массы — не выдумываем
 * множитель, а честно помечаем basis='unknown'.
 */
import { parseMicroLine, repairOcrNumericToken, type NutritionMicros } from './nutrition-ocr-parser';
import type { CustomFoodEntry } from './meal-custom-food';

export type NutritionLabelBasis = '100g' | 'serving' | 'unknown';

export interface ParsedNutritionLabel {
  name: string;
  brand?: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  micros: NutritionMicros;
  servingSize: string;
  basis: NutritionLabelBasis;
  confidence: number;
  rawText: string;
  warnings: string[];
}

const ZERO_CONFUSION = /[ОоOo]/g;
/** Буквы, которыми OCR заменяет цифры в числах этикетки. */
const OCR_DIGITS = '0-9OoОоЗзSsLlIбБ';
/**
 * Число на этикетке: обычная запись, буквы-двойники OCR («1O» → 10,
 * «Жиры З г» → 3 г) и разряды через пробел («1 500 кДж»). Первая ветка
 * жадная, поэтому «1500» не распадается на «1» + «500».
 */
const LABEL_NUMBER = `([${OCR_DIGITS}]+(?:[.,][${OCR_DIGITS}]+)?|[${OCR_DIGITS}]{1,3}(?:[ ][${OCR_DIGITS}]{3})+(?:[.,][${OCR_DIGITS}]+)?)`;
const SINGLE_OCR_DIGIT: Record<string, number> = {
  'З': 3, 'з': 3, 'О': 0, 'о': 0, O: 0, o: 0, l: 1, I: 1, S: 5, s: 5,
};

function numeric(raw: string | undefined): number {
  if (!raw) return 0;
  const compact = raw.replace(/\s+/g, '');
  const repaired = repairOcrNumericToken(compact);
  const value = Number.parseFloat(repaired.replace(ZERO_CONFUSION, '0').replace(',', '.'));
  if (Number.isFinite(value)) return value;
  // Отдельная буква-двойник: «Жиры З г» → 3 г, «Белки O г» → 0 г.
  if (compact.length === 1 && SINGLE_OCR_DIGIT[compact] !== undefined) return SINGLE_OCR_DIGIT[compact];
  return 0;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeLabelText(text: string): string {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[|;]/g, ' ')
    .replace(/[“”„‟«»]/g, '"')
    // Схлопываем пробелы/табы, но НЕ переводы строк: по ним отделяются
    // название, подписи таблицы и значения на следующей строке.
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

const NOISE_LINE = /(пищева[яой]\s+ценност|энергетическ[аяой]\s+ценност|калорийност|состав\b|ингредиент|изготовител|производител|адрес|срок\s+годност|годен\s+до|услови[яе]\s+хранен|масса\s+нетто|нетто\b|брутто|гост\b|ту\s*\d|техническ|упакован|произведен|страна\s+происхожден|пищевые\s+волокна|клетчатк|ккал|кдж|kcal|kj|nutrition\s+facts|typical\s+values|per\s+100|на\s+100|в\s+100|1[0-9]{3}\s*кдж)/i;
// Строка-подпись таблицы, а не название продукта. Границу после кириллицы
// делаем явной: «Белковый батончик» — имя, «Белки, г» — подпись.
const NUTRIENT_LINE = /^(?:белки?|жиры?|углеводы?|энергетическая\s+ценность|калорийность|protein|fat|carbohydrates?|carbs?|energy)(?:\s|,|:|$)/i;
const LEGAL_LINE = /(ооо|зао|пао|ао\b|ип\b|оао|общество\s+с\s+ограниченной|индивидуальный\s+предприниматель)/i;
const DATE_LINE = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$|^\d{4}-\d{2}-\d{2}$/;
const SITE_LINE = /(www\.|https?:\/\/|@|\.ru\b|\.com\b)/i;

function isNameLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 2 || trimmed.length > 90) return false;
  if (!/[A-Za-zА-Яа-яЁё]{2,}/.test(trimmed)) return false;
  if (NOISE_LINE.test(trimmed) || NUTRIENT_LINE.test(trimmed) || LEGAL_LINE.test(trimmed) || DATE_LINE.test(trimmed) || SITE_LINE.test(trimmed)) return false;
  // Строка из одних цифр/процентов — это колонка таблицы, не название.
  if (!/[A-Za-zА-Яа-яЁё]{2,}/.test(trimmed.replace(/\d|[%.,/\\()-]/g, ''))) return false;
  return true;
}

function cleanName(line: string): string {
  return line
    .replace(/^[•·*\-–—\s]+/, '')
    .replace(/[•·*]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*[,;:]$/, '')
    .trim();
}

/**
 * Название обычно стоит над блоком «Пищевая ценность». Берём первую
 * осмысленную строку; если она короткая (бренд), добавляем следующую —
 * «Простоквашино» + «Молоко 3,2%» даёт читаемое имя, а не только бренд.
 */
export function extractLabelProductName(text: string): { name: string; brand?: string } {
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const cutoff = lines.findIndex(line => /(пищева[яой]\s+ценност|энергетическ[аяой]\s+ценност|nutrition\s+facts|typical\s+values|per\s+100)/i.test(line));
  const scope = lines.slice(0, cutoff > 0 ? cutoff : Math.min(lines.length, 8));
  const candidates = scope.filter(isNameLine).map(cleanName).filter(Boolean);
  if (candidates.length === 0) return { name: 'Продукт с упаковки' };

  const first = candidates[0];
  const second = candidates[1];
  const firstWords = first.split(/\s+/).length;
  const firstLooksLikeBrand = firstWords <= 2 && first.length <= 28;
  if (second && firstLooksLikeBrand && second !== first) {
    const combined = `${first} ${second}`;
    if (combined.length <= 90 && isNameLine(combined)) {
      return { name: combined, brand: first };
    }
  }
  return { name: first };
}

function isPer100(text: string): boolean {
  return /(?:на|в)\s*100\s*(?:г|мл|g|ml)|per\s*100\s*(?:g|ml)|100\s*(?:г|мл|g|ml)\s*(?:продукта|product)?/i.test(text);
}

function servingGrams(text: string): number {
  const sources = [
    /(?:на|в)\s*(?:1\s*)?порци[а-яё]*([^\d\n]{0,28})(\d+(?:[.,]\d+)?)\s*(?:г|g|мл|ml)/i,
    /(?:1\s*)?порци[а-яё]*([^\d\n]{0,16})(\d+(?:[.,]\d+)?)\s*(?:г|g|мл|ml)/i,
    /(?:serving\s*(?:size)?|per\s*serving)([^\d\n]{0,20})(\d+(?:[.,]\d+)?)\s*(?:g|ml)/i,
  ];
  for (const pattern of sources) {
    const match = text.match(pattern);
    if (!match) continue;
    // «Пищевая ценность в порции» и «Белки 24 г» на соседних строках — это не
    // масса порции. Иначе 24 г становились «порцией», и все значения этикетки
    // умножались на 100/24 ≈ 4,2 без единого предупреждения.
    if (/(?:белк|жир|углевод|ккал|калор|энерг|protein|fat|carb|kcal|energy)/i.test(match[1] || '')) continue;
    const grams = numeric(match[2]);
    if (grams > 0 && grams <= 5000) return grams;
  }
  return 0;
}

function isServingBasis(text: string): boolean {
  return /(?:на|в)\s*(?:1\s*)?порци|per\s*(?:serving|portion)|1\s*порци/i.test(text);
}

/** Ккал из текста; если только кДж — переводим (1 ккал = 4,184 кДж). */
function findCalories(text: string, basis: NutritionLabelBasis): { kcal: number; fromKj: boolean } {
  // Подпись «Энергетическая ценность, кДж/ккал» и пара значений «1256/300»:
  // числа идут в том же порядке, что единицы в подписи. Раньше первое число
  // (килоджоули) уезжало в дневник как килокалории.
  const combined = text.match(new RegExp(
    `(кдж|kcal|ккал|kj)\\s*[/\\\\]\\s*(кдж|kcal|ккал|kj)[^\\d]{0,12}${LABEL_NUMBER}\\s*[/\\\\]\\s*${LABEL_NUMBER}`,
    'i',
  ));
  if (combined) {
    const firstIsKcal = /ккал|kcal/i.test(combined[1]);
    const value = numeric(firstIsKcal ? combined[3] : combined[4]);
    if (value > 0) return { kcal: value, fromKj: !firstIsKcal };
  }

  const matches: Array<{ value: number; index: number; serving: boolean }> = [];
  const kcalPattern = new RegExp(`${LABEL_NUMBER}\\s*(?:ккал|kcal|cal\\b|calories?)`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = kcalPattern.exec(text)) !== null) {
    const value = numeric(match[1]);
    if (value <= 0) continue;
    const around = text.slice(Math.max(0, match.index - 24), match.index + match[0].length + 24);
    matches.push({ value, index: match.index, serving: /порци|serving|portion/i.test(around) });
  }
  if (matches.length > 0) {
    const picked = basis === 'serving'
      ? (matches.find(item => item.serving) || matches[matches.length - 1])
      : (matches.find(item => !item.serving) || matches[0]);
    return { kcal: picked.value, fromKj: false };
  }

  // Таблица, где число стоит на следующей строке под «Энергетическая
  // ценность, ккал». Отдельный проход нужен, потому что прямой regex ищет
  // число ПЕРЕД «ккал» и такую раскладку пропускает.
  const verticalKcal = text.match(new RegExp(`(?:энергетическая\\s+ценность|калорийность)[^\\d]{0,16}(?:ккал|kcal)(?:\\s*[/на]*\\s*100\\s*(?:г|g))?[^\\d]{0,12}${LABEL_NUMBER}`, 'i'));
  if (verticalKcal) {
    const value = numeric(verticalKcal[1]);
    if (value > 0) return { kcal: value, fromKj: false };
  }

  const kjMatches: Array<{ value: number; index: number; serving: boolean }> = [];
  const kjPattern = new RegExp(`${LABEL_NUMBER}\\s*(?:кдж|kj)`, 'gi');
  while ((match = kjPattern.exec(text)) !== null) {
    const value = numeric(match[1]);
    if (value <= 0) continue;
    const around = text.slice(Math.max(0, match.index - 24), match.index + match[0].length + 24);
    kjMatches.push({ value, index: match.index, serving: /порци|serving|portion/i.test(around) });
  }
  if (kjMatches.length === 0) return { kcal: 0, fromKj: false };
  const picked = basis === 'serving'
    ? (kjMatches.find(item => item.serving) || kjMatches[kjMatches.length - 1])
    : (kjMatches.find(item => !item.serving) || kjMatches[0]);
  return { kcal: picked.value / 4.184, fromKj: true };
}

type MacroKey = 'p' | 'f' | 'c';

const MACRO_PATTERNS: Record<MacroKey, RegExp[]> = {
  p: [new RegExp(`(?:белк[а-яё]*|протеин[а-яё]*|proteins?)\\s*(?:,?\\s*(?:г|g))?\\s*[:\\-–—]?\\s*${LABEL_NUMBER}`, 'i'), new RegExp(`(?:^|\\s)б\\s*[:\\-–—]\\s*${LABEL_NUMBER}`, 'i')],
  f: [new RegExp(`(?:жир[а-яё]*|fats?)\\s*(?:,?\\s*(?:г|g))?\\s*[:\\-–—]?\\s*${LABEL_NUMBER}`, 'i'), new RegExp(`(?:^|\\s)ж\\s*[:\\-–—]\\s*${LABEL_NUMBER}`, 'i')],
  c: [new RegExp(`(?:углевод[а-яё]*|carbohydrates?|carbs?)\\s*(?:,?\\s*(?:г|g))?\\s*[:\\-–—]?\\s*${LABEL_NUMBER}`, 'i'), new RegExp(`(?:^|\\s)у\\s*[:\\-–—]\\s*${LABEL_NUMBER}`, 'i')],
};

// Подпись без значения («Белки, г»), за которой число стоит на следующей
// строке. Паттерн обязан быть привязан к конкретному нутриенту, иначе строка
// «Белки, г» подставит белки ещё и в жиры/углеводы.
const BARE_MACRO_LINE: Record<MacroKey, RegExp> = {
  p: /^(?:белк[а-яё]*|протеин[а-яё]*|proteins?)(?:\s*,?\s*(?:г|g))?\s*$/i,
  f: /^(?:жир[а-яё]*|fats?)(?:\s*,?\s*(?:г|g))?\s*$/i,
  c: /^(?:углевод[а-яё]*|carbohydrates?|carbs?)(?:\s*,?\s*(?:г|g))?\s*$/i,
};
const BARE_NUMBER_LINE = new RegExp(`^${LABEL_NUMBER}\\s*(?:г|g)?$`, 'i');

function macroFromLine(line: string, key: MacroKey): number {
  for (const pattern of MACRO_PATTERNS[key]) {
    const match = line.match(pattern);
    if (!match) continue;
    // «белки 3,0 жиры 2,5» — pattern останавливается на первом числе после
    // своей подписи и не перескакивает через соседний нутриент.
    const value = numeric(match[1]);
    if (value > 0) return value;
  }
  return 0;
}

function parseMacros(lines: string[]): Record<MacroKey, number> {
  const result: Record<MacroKey, number> = { p: 0, f: 0, c: 0 };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const key of ['p', 'f', 'c'] as MacroKey[]) {
      if (result[key] > 0) continue;
      const direct = macroFromLine(line, key);
      if (direct > 0) { result[key] = direct; continue; }
      // Таблица вида «Белки, г» / «3,0»: значение стоит отдельной строкой.
      if (BARE_MACRO_LINE[key].test(line)) {
        const next = lines[index + 1]?.trim() || '';
        const bare = next.match(BARE_NUMBER_LINE);
        if (bare) result[key] = numeric(bare[1]);
      }
    }
  }
  // Строка без подписей, но с тремя числами в порядке Б-Ж-У (OCR потерял
  // подписи). Используем только когда ни один макрос не распознан.
  if (result.p === 0 && result.f === 0 && result.c === 0) {
    for (const line of lines) {
      const compact = line.trim().match(new RegExp(`^${LABEL_NUMBER}\\s+${LABEL_NUMBER}\\s+${LABEL_NUMBER}(?:\\s*(?:г|g))?$`));
      if (compact) {
        result.p = numeric(compact[1]);
        result.f = numeric(compact[2]);
        result.c = numeric(compact[3]);
        break;
      }
    }
  }
  return result;
}

function findFiber(text: string): number {
  const match = text.match(new RegExp(`(?:пищевые\\s+волокна|клетчатк[а-яё]*|fiber)\\s*(?:,?\\s*(?:г|g))?\\s*[:\\-–—]?\\s*${LABEL_NUMBER}`, 'i'));
  return match ? numeric(match[1]) : 0;
}

/**
 * Разобрать текст этикетки. Возвращает null, если это не похоже на КБЖУ
 * (фото состава/цены/пустая упаковка) — UI покажет понятную ошибку, а не
 * сохранит в базу продукт с нулями.
 */
export function parseNutritionLabel(text: string): ParsedNutritionLabel | null {
  const normalized = normalizeLabelText(text);
  if (!normalized) return null;
  const lines = normalized.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const warnings: string[] = [];

  const per100 = isPer100(normalized);
  const serving = servingGrams(normalized);
  const servingBasis = !per100 && (isServingBasis(normalized) || serving > 0);
  const basis: NutritionLabelBasis = per100 ? '100g' : servingBasis ? (serving > 0 ? 'serving' : 'unknown') : 'unknown';
  if (servingBasis && serving <= 0) warnings.push('На упаковке указана порция, но её масса не распознана — значения оставлены как на упаковке.');

  const calories = findCalories(normalized, basis);
  const macros = parseMacros(lines);
  const fiber = findFiber(normalized);

  let kcal = calories.kcal;
  let protein = macros.p;
  let fat = macros.f;
  let carbs = macros.c;

  if (hasNoNutritionValues(kcal, protein, fat, carbs)) {
    // Совсем без цифр — это не этикетка КБЖУ.
    return null;
  }

  const factor = basis === 'serving' && serving > 0 ? 100 / serving : 1;
  if (factor !== 1) {
    kcal *= factor;
    protein *= factor;
    fat *= factor;
    carbs *= factor;
  }

  if (kcal <= 0 && (protein > 0 || fat > 0 || carbs > 0)) {
    kcal = protein * 4 + fat * 9 + carbs * 4;
    warnings.push('Ккал на этикетке не найдены — рассчитаны по БЖУ (4/9/4).');
  }
  if (protein <= 0 && fat <= 0 && carbs <= 0) {
    // Одни ккал без макросов не позволяют честно вести дневник.
    return null;
  }

  const micros: NutritionMicros = {};
  for (const line of lines) {
    const parsed = parseMicroLine(line);
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) micros[key] = value;
    }
  }
  if (fiber > 0) micros.fiber_g = round1(fiber);

  const macroKcal = protein * 4 + fat * 9 + carbs * 4;
  if (kcal > 0 && macroKcal > 0 && (macroKcal < kcal * 0.55 || macroKcal > kcal * 1.45)) {
    warnings.push('БЖУ и ккал на этикетке расходятся — проверьте, не перепутаны ли колонки «на 100 г» и «на порцию».');
  }

  const nameInfo = extractLabelProductName(normalized);
  const filled = [kcal > 0, protein > 0, fat > 0, carbs > 0].filter(Boolean).length;
  let confidence = filled >= 4 ? 0.95 : filled === 3 ? 0.8 : filled === 2 ? 0.6 : 0.4;
  if (factor !== 1) confidence -= 0.05;
  if (nameInfo.name === 'Продукт с упаковки') confidence -= 0.1;

  return {
    name: nameInfo.name,
    brand: nameInfo.brand,
    kcal: Math.round(kcal),
    protein: round1(protein),
    fat: round1(fat),
    carbs: round1(carbs),
    fiber: round1(fiber),
    micros,
    servingSize: '100 г',
    basis,
    confidence: Math.round(Math.max(0.2, Math.min(1, confidence)) * 100) / 100,
    rawText: text,
    warnings,
  };
}

function hasNoNutritionValues(kcal: number, protein: number, fat: number, carbs: number): boolean {
  return kcal <= 0 && protein <= 0 && fat <= 0 && carbs <= 0;
}

const CATEGORY_KEYWORDS: Array<[CustomFoodEntry['category'], RegExp]> = [
  ['protein', /(мясо|куриц|индейк|говяд|свинин|рыб|лосос|тунец|яйц|творог|протеин|фарш|колбас|сосиск)/i],
  ['dairy', /(молок|кефир|йогурт|сыр|сливк|масло\s+сливочн|ряженк|сметан)/i],
  ['carb', /(хлеб|батон|макарон|паст|рис|греч|овсян|хлопь|круп|мука|сахар|шоколад|печень|конфет)/i],
  ['fat', /(орех|семеч|масло|авокадо|оливк)/i],
  ['veg_fruit', /(овощ|фрукт|яблок|банан|ягод|помидор|огур|капуст|морков|салат)/i],
  ['grain', /(зерн|отруб|киноа|булгур|перлов|пшен)/i],
  ['supplement', /(витамин|добавк|bcaa|креатин|протеин\s+порош)/i],
];

export function detectLabelCategory(name: string): CustomFoodEntry['category'] {
  for (const [category, pattern] of CATEGORY_KEYWORDS) {
    if (pattern.test(name)) return category;
  }
  return 'other';
}

/** Продукт с этикетки → запись своей еды (значения уже на 100 г). */
export function labelToCustomFood(
  label: ParsedNutritionLabel,
  opts?: { id?: string; barcode?: string; brand?: string },
): CustomFoodEntry {
  const id = opts?.id || `custom_label_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const micros = label.micros || {};
  return {
    id,
    name: label.name,
    brand: opts?.brand || label.brand,
    description: 'Распознано с фото упаковки (на 100 г)',
    source: 'label_photo',
    barcode: String(opts?.barcode ?? '').replace(/\D/g, '') || undefined,
    category: detectLabelCategory(label.name),
    kcal: Math.max(0, Math.round(label.kcal)),
    protein: Math.max(0, round1(label.protein)),
    fat: Math.max(0, round1(label.fat)),
    carbs: Math.max(0, round1(label.carbs)),
    fiber: Math.max(0, round1(label.fiber || micros.fiber_g || 0)),
    servingSize: '100 г',
    labelText: label.rawText,
    potassium_mg: micros.potassium_mg,
    magnesium_mg: micros.magnesium_mg,
    calcium_mg: micros.calcium_mg,
    sodium_mg: micros.sodium_mg,
    phosphorus_mg: micros.phosphorus_mg,
    zinc_mg: micros.zinc_mg,
    iron_mg: micros.iron_mg,
    selenium_mcg: micros.selenium_mcg,
    copper_mg: micros.copper_mg,
    manganese_mg: micros.manganese_mg,
    iodine_mcg: micros.iodine_mcg,
    vitamin_a_mcg: micros.vitamin_a_mcg,
    vitamin_c_mg: micros.vitamin_c_mg,
    vitamin_d_mcg: micros.vitamin_d_mcg,
    vitamin_e_mg: micros.vitamin_e_mg,
    vitamin_k_mcg: micros.vitamin_k_mcg,
    vitamin_b12_mcg: micros.vitamin_b12_mcg,
  };
}

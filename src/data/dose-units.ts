/**
 * dose-units.ts — единая единица дозирования на вещество.
 *
 * Проблема (аудит 2026-11): дозы в калькуляторе поддержки хранятся в
 * «естественной» единице вещества (мкг для селена, МЕ для D3), но UI
 * (`CalcSubstanceDetail`, `CalcSafetyLayer`, отчёты, PDF) подписывал ВСЁ как
 * «мг». 200 мкг селена показывались как «200 мг» — 1000× ошибка, а 5000 МЕ
 * витамина D — как «5000 мг».
 *
 * Здесь один список: id → единица отображения. Форматтер выводит число с
 * правильным суффиксом. Для витамина D внутренняя единица — мкг (как в
 * `NUTRIENT_UL`), но при значении ≥ 1000 МЕ показываем МЕ (так привычнее).
 *
 * ВАЖНО про внутренние единицы (иначе легко вернуть ×1000-ошибку):
 *  - `DEFAULT_DOSAGES` (support-meta) хранит значения в НАТУРАЛЬНОЙ единице:
 *    selenium 200 = 200 мкг, vitamin_d3 2000 = 2000 МЕ, probiotics 20 = 20 млрд КОЕ.
 *    Для них — `formatDefaultDose`.
 *  - Витамины A и E ведутся в единицах РЕЕСТРА пределов (A — мкг RAE, E — мг
 *    α-токоферола), а не в МЕ. Раньше оба были в `IU_IDS`, поэтому каталог
 *    (мг) подписывался как «1 МЕ» витамина A (в 3300 раз меньше реального) и
 *    «200 МЕ» витамина E. МЕ пользователю показываем в тексте формы.
 *  - `SUPPORT_CATALOG_DATA[id].dosage.mg` хранит МИЛЛИГРАММЫ (selenium 0.2 мг,
 *    vitamin_d3 0.05 мг), кроме hcg/пробиотиков, где значение уже в МЕ/млрд КОЕ.
 *    Для них — `formatDoseFromMg`.
 *  - Фибринолитики (наттокиназа/серрапептаза) дозируются в МГ: 100 мг ≈ 2000 ФЕ,
 *    поэтому «ФЕ» здесь не используется — значение не в фибринолитических единицах.
 */

export type DoseUnit = 'мг' | 'мкг' | 'МЕ' | 'Ед' | 'млрд КОЕ';

/** Вещества, чья внутренняя доза хранится в микрограммах. */
const MCG_IDS = new Set<string>([
  'selenium', 'selenium_yeast', 'folate', 'methylfolate', 'vitamin_b12', 'methylcobalamin',
  'vitamin_k2', 'biotin', 'iodine', 'molybdenum', 'chromium', 'vitamin_d3', 'vitamin_d',
  // Витамин A — преформированный ретинол; единица реестра UL — мкг RAE.
  'vitamin_a',
  'bpc157', 'tb500', 'ghk_cu', 'melanotan2', 'semax', 'selank',
  // PED в мкг
  'clenbuterol', 't3', 't4', 'igf1_lr3', 'igf1_des', 'mgf', 'peg_mgf',
]);

/** Вещества, чья внутренняя доза хранится в международных единицах (МЕ/IU). */
const IU_IDS = new Set<string>([
  'hcg', 'vitamin_d', 'hgh',
]);

/** Инсулины — в «ед» (units). */
const UNIT_IDS = new Set<string>([
  'ins_short', 'ins_long', 'ins_aspart', 'ins_detemir', 'insulin',
]);

/** Пробиотики — в миллиардах КОЕ (колониеобразующих единиц). */
const CFU_IDS = new Set<string>(['probiotics']);

/** Сколько мкг в 1 МЕ витамина D (1 мкг = 40 МЕ). */
export const IU_PER_MCG_VITAMIN_D = 40;

/**
 * Плановая доза витамина D хранится в МЕ (`DEFAULT_DOSAGES`), а реестр
 * пределов (`NUTRIENT_UL`) — в мкг. Один пересчёт, чтобы UL-контур не
 * сравнивал 2000 МЕ с порогом 100 «мкг».
 */
export function vitaminDMcgFromIu(iu: number): number {
  if (!Number.isFinite(iu) || iu <= 0) return 0;
  return round2(iu / IU_PER_MCG_VITAMIN_D);
}

/**
 * Единица отображения для вещества.
 * Для витамина D возвращает 'мкг' (внутренняя единица), а `formatDose`
 * сам решает показать МЕ, если значение большое.
 */
export function doseUnit(id: string): DoseUnit {
  const k = String(id || '').toLowerCase();
  if (k === 'vitamin_d3' || k === 'vitamin_d') return 'мкг';
  if (MCG_IDS.has(k)) return 'мкг';
  if (IU_IDS.has(k)) return 'МЕ';
  if (UNIT_IDS.has(k)) return 'Ед';
  if (CFU_IDS.has(k)) return 'млрд КОЕ';
  return 'мг';
}

/** Подпись единицы для UI («мкг», «МЕ» …). */
export function doseUnitLabel(id: string): string {
  return doseUnit(id);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Форматирует дозу с правильной единицей.
 * @param id — id вещества
 * @param value — значение во внутренней единице (как в `applyTitration`)
 */
export function formatDose(id: string, value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  const k = String(id || '').toLowerCase();
  const rounded = round2(value);
  if (k === 'vitamin_d3' || k === 'vitamin_d') {
    const iu = Math.round(rounded * IU_PER_MCG_VITAMIN_D);
    return iu >= 1000 ? `${iu} МЕ` : `${rounded} мкг`;
  }
  return `${rounded} ${doseUnit(k)}`;
}

/**
 * Форматирует дозу из мг-шкалы каталога (`SUPPORT_CATALOG_DATA[id].dosage.mg`).
 *
 * Каталог хранит именно миллиграммы, поэтому:
 *  - мкг-вещества переводятся и подписываются в мкг (0.2 мг → «200 мкг»);
 *  - витамин D — в МЕ (0.05 мг → «2000 МЕ»);
 *  - крупные мг (≥1000) показываем в граммах («2 г»);
 *  - МЕ/Ед/млрд КОЕ — значение уже в этой единице (hcg 500 → «500 МЕ»).
 */
export function formatDoseFromMg(id: string, mg: number): string {
  if (!Number.isFinite(mg) || mg <= 0) return '—';
  const unit = doseUnit(id);
  if (unit === 'мкг') return formatDose(id, round2(mg * 1000));
  if (unit === 'мг') return mg >= 1000 ? `${round2(mg / 1000)} г` : `${round2(mg)} мг`;
  return formatDose(id, mg);
}

/**
 * Обратное к `toMgEquivalent`: значение из мг-шкалы каталога →
 * НАТУРАЛЬНАЯ единица вещества (в ней живут `DEFAULT_DOSAGES`,
 * `PlanSubstance.doseMg` и `PlanResult.dosages[id].mg`).
 *
 * Нужно там, где мг-фолбэк каталога попадает в поле, которое читатели
 * подписывают через `formatDefaultDose` (шеринг плана, «Мои планы»,
 * сравнение с фактическим приёмом). Иначе биотина «5 мг» из каталога
 * отображался как «5 мкг» — 1000× ниже реальной дозы.
 * Для МЕ/Ед/млрд КОЕ каталог уже хранит значение в этой единице — не трогаем.
 */
export function naturalFromMg(id: string, mg: number): number {
  if (!Number.isFinite(mg) || mg <= 0) return mg;
  const k = String(id || '').toLowerCase();
  // Витамин D: натуральная единица DEFAULT_DOSAGES — МЕ (1 МЕ = 0.025 мкг).
  if (k === 'vitamin_d3' || k === 'vitamin_d') return Math.round(mg * 1000 * IU_PER_MCG_VITAMIN_D);
  return doseUnit(k) === 'мкг' ? round2(mg * 1000) : mg;
}

/**
 * Приводит дозу к мг-эквиваленту для нутрициологической математики
 * (суммарная нагрузка, UL). Возвращает `undefined`, если вещество
 * не является нутриентом в мг/мкг-шкале (МЕ/Ед/млрд КОЕ не конвертируем).
 */
export function toMgEquivalent(id: string, value: number): number | undefined {
  const k = String(id || '').toLowerCase();
  if (!Number.isFinite(value)) return undefined;
  if (k === 'vitamin_d3' || k === 'vitamin_d') return value / 1000; // мкг → мг
  const unit = doseUnit(k);
  if (unit === 'мкг') return value / 1000;
  if (unit === 'мг') return value;
  return undefined;
}

/**
 * Единицы, в которых записаны значения `DEFAULT_DOSAGES` (support-meta.ts).
 * Там поле называется `mg`, но фактически хранит «натуральную» единицу:
 * vitamin_d3: 2000 = 2000 МЕ, selenium: 200 = 200 мкг, probiotics: 20 = 20 млрд КОЕ.
 */
const DEFAULT_UNIT: Record<string, DoseUnit> = {
  vitamin_d3: 'МЕ',
  vitamin_d: 'МЕ',
  // A/E — единицы реестра пределов (мкг RAE / мг α-токоферола), см. шапку файла.
  vitamin_a: 'мкг',
  vitamin_e: 'мг',
  selenium: 'мкг',
  folate: 'мкг',
  vitamin_b12: 'мкг',
  vitamin_k2: 'мкг',
  chromium: 'мкг',
  biotin: 'мкг',
  iodine: 'мкг',
  molybdenum: 'мкг',
  bpc157: 'мкг',
  tb500: 'мкг',
};

/** Единица, в которой лежит значение из `DEFAULT_DOSAGES` для этого id. */
export function defaultDoseUnit(id: string): DoseUnit {
  const k = String(id || '').toLowerCase();
  return DEFAULT_UNIT[k] || doseUnit(k);
}

/**
 * Форматирует «дефолтную» дозу из `DEFAULT_DOSAGES`.
 * Не конвертирует шкалу — только подписывает правильной единицей;
 * крупные миллиграммы показываем в граммах («5 г» вместо «5000 мг»).
 */
export function formatDefaultDose(id: string, value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  const unit = defaultDoseUnit(id);
  if (unit === 'мг' && value >= 1000) return `${round2(value / 1000)} г`;
  return `${round2(value)} ${unit}`;
}

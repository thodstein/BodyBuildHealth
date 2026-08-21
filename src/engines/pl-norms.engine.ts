/**
 * pl-norms.engine.ts — разрядные нормативы пауэрлифтинга (мужчины и женщины, raw/classic).
 * Источник: ФПР 2022-2025 (приказ Минспорта №6 от 11.01.2022) — классический пауэрлифтинг
 * (без экипировки) + WRPF/СПР (без/с ДК). Женские таблицы добавлены по официальным
 * нормативам ФПР классика (2022-2025) и масштабированием для WRPF.
 *
 * Разряды по возрастанию порога: КМС < МС < МСМК < ЭЛИТА (Элита — только WRPF без ДК).
 * Для категорий 43 кг (женщины) МС/МСМК не присваиваются — только КМС и ниже.
 */

export type Federation = 'fpr_ipf' | 'wrpf_untested' | 'wrpf_tested';
export type Discipline = 'total' | 'bench' | 'deadlift' | 'squat';
export type RankKey = 'kms' | 'ms' | 'msmk' | 'elite';
export type Sex = 'male' | 'female';

export const RANK_LABELS: Record<RankKey, string> = { kms: 'КМС', ms: 'МС', msmk: 'МСМК', elite: 'ЭЛИТА' };
export const RANK_ORDER: RankKey[] = ['kms', 'ms', 'msmk', 'elite'];
/** Человекочитаемые пояснения к разрядам */
export const RANK_DESCRIPTIONS: Record<RankKey, string> = {
  kms: 'Кандидат в мастера спорта — первый взрослый разряд, выполняется на чемпионате субъекта РФ при наличии судей ВК/1К.',
  ms: 'Мастер спорта — выполняется на чемпионате федерального округа или Москвы/СПб с допинг-контролем и 3 судьями ВК.',
  msmk: 'Мастер спорта международного класса — только на международных стартах из ЕКП (чемпионат мира/Европы) с допинг-контролем.',
  elite: 'ЭЛИТА — высший норматив WRPF/СПР без допинг-контроля (вне ЕВСК, для коммерческих федераций).',
};

export interface NormCategory {
  upTo: number | null; // кг; null = «свыше последней»
  label: string;
  ranks: Partial<Record<RankKey, number>>; // порог суммы (кг) для разряда
}

export interface NormTable {
  federation: Federation;
  federationLabel: string;
  discipline: Discipline;
  sex: Sex;
  categories: NormCategory[];
  sourceNote?: string;
}

// ФПР/IPF (мужчины, raw, троеборье) — КМС/МС/МСМК
const FPR_TOTAL: NormCategory[] = [
  { upTo: 59, label: 'до 59 кг', ranks: { kms: 362.5, ms: 455.0, msmk: 540.0 } },
  { upTo: 66, label: 'до 66 кг', ranks: { kms: 402.5, ms: 510.0, msmk: 595.0 } },
  { upTo: 74, label: 'до 74 кг', ranks: { kms: 440.0, ms: 537.5, msmk: 675.0 } },
  { upTo: 83, label: 'до 83 кг', ranks: { kms: 472.5, ms: 582.5, msmk: 730.0 } },
  { upTo: 93, label: 'до 93 кг', ranks: { kms: 505.0, ms: 610.0, msmk: 770.0 } },
  { upTo: 105, label: 'до 105 кг', ranks: { kms: 532.5, ms: 645.0, msmk: 810.0 } },
  { upTo: 120, label: 'до 120 кг', ranks: { kms: 557.5, ms: 682.5, msmk: 845.0 } },
  { upTo: null, label: 'св. 120 кг', ranks: { kms: 595.0, ms: 737.5, msmk: 885.0 } },
];

// WRPF/СПР (мужчины, raw, троеборье) — БЕЗ допинг-контроля
const WRPF_U_TOTAL: NormCategory[] = [
  { upTo: 60, label: 'до 60 кг', ranks: { kms: 385.0, ms: 442.5, msmk: 505.0, elite: 572.5 } },
  { upTo: 67.5, label: 'до 67.5 кг', ranks: { kms: 442.5, ms: 507.5, msmk: 577.5, elite: 652.5 } },
  { upTo: 75, label: 'до 75 кг', ranks: { kms: 497.5, ms: 567.5, msmk: 642.5, elite: 722.5 } },
  { upTo: 82.5, label: 'до 82.5 кг', ranks: { kms: 545.0, ms: 620.0, msmk: 700.0, elite: 785.0 } },
  { upTo: 90, label: 'до 90 кг', ranks: { kms: 587.5, ms: 667.5, msmk: 750.0, elite: 837.5 } },
  { upTo: 100, label: 'до 100 кг', ranks: { kms: 635.0, ms: 717.5, msmk: 802.5, elite: 895.0 } },
  { upTo: 110, label: 'до 110 кг', ranks: { kms: 672.5, ms: 757.5, msmk: 847.5, elite: 942.5 } },
  { upTo: 125, label: 'до 125 кг', ranks: { kms: 712.5, ms: 802.5, msmk: 892.5, elite: 992.5 } },
  { upTo: 140, label: 'до 140 кг', ranks: { kms: 740.0, ms: 832.5, msmk: 925.0, elite: 1025.0 } },
  { upTo: null, label: 'св. 140 кг', ranks: { kms: 772.5, ms: 865.0, msmk: 957.5, elite: 1055.0 } },
];

// WRPF/СПР (мужчины, raw, троеборье) — С допинг-контролем (Tested)
const WRPF_T_TOTAL: NormCategory[] = [
  { upTo: 60, label: 'до 60 кг', ranks: { kms: 357.5, ms: 410.0, msmk: 467.5, elite: 530.0 } },
  { upTo: 67.5, label: 'до 67.5 кг', ranks: { kms: 410.0, ms: 470.0, msmk: 535.5, elite: 605.0 } },
  { upTo: 75, label: 'до 75 кг', ranks: { kms: 460.0, ms: 525.0, msmk: 595.0, elite: 670.0 } },
  { upTo: 82.5, label: 'до 82.5 кг', ranks: { kms: 505.0, ms: 575.5, msmk: 650.0, elite: 727.5 } },
  { upTo: 90, label: 'до 90 кг', ranks: { kms: 545.0, ms: 617.5, msmk: 695.5, elite: 777.5 } },
  { upTo: 100, label: 'до 100 кг', ranks: { kms: 587.5, ms: 665.0, msmk: 745.0, elite: 830.0 } },
  { upTo: 110, label: 'до 110 кг', ranks: { kms: 622.5, ms: 702.5, msmk: 785.0, elite: 875.0 } },
  { upTo: 125, label: 'до 125 кг', ranks: { kms: 660.0, ms: 742.5, msmk: 827.5, elite: 920.0 } },
  { upTo: 140, label: 'до 140 кг', ranks: { kms: 685.0, ms: 770.0, msmk: 857.5, elite: 950.0 } },
  { upTo: null, label: 'св. 140 кг', ranks: { kms: 715.0, ms: 802.5, msmk: 890.0, elite: 982.5 } },
];

// WRPF/СПР (мужчины, raw) — ЖИМ ЛЕЖА
const WRPF_U_BENCH: NormCategory[] = [
  { upTo: 60, label: 'до 60 кг', ranks: { kms: 107.5, ms: 125.0, msmk: 142.5, elite: 162.5 } },
  { upTo: 67.5, label: 'до 67.5 кг', ranks: { kms: 122.5, ms: 140.0, msmk: 160.0, elite: 182.5 } },
  { upTo: 75, label: 'до 75 кг', ranks: { kms: 137.5, ms: 155.0, msmk: 177.5, elite: 200.0 } },
  { upTo: 82.5, label: 'до 82.5 кг', ranks: { kms: 150.0, ms: 170.0, msmk: 192.5, elite: 217.5 } },
  { upTo: 90, label: 'до 90 кг', ranks: { kms: 162.5, ms: 182.5, msmk: 205.0, elite: 230.0 } },
  { upTo: 100, label: 'до 100 кг', ranks: { kms: 175.0, ms: 195.0, msmk: 220.0, elite: 247.5 } },
  { upTo: 110, label: 'до 110 кг', ranks: { kms: 185.0, ms: 205.0, msmk: 230.0, elite: 257.5 } },
  { upTo: 125, label: 'до 125 кг', ranks: { kms: 195.0, ms: 215.0, msmk: 240.0, elite: 267.5 } },
  { upTo: 140, label: 'до 140 кг', ranks: { kms: 202.5, ms: 222.5, msmk: 247.5, elite: 277.5 } },
  { upTo: null, label: 'св. 140 кг', ranks: { kms: 210.0, ms: 230.0, msmk: 255.0, elite: 287.5 } },
];

// WRPF/СПР (мужчины, raw) — СТАНОВАЯ ТЯГА (без ДК)
const WRPF_U_DEAD: NormCategory[] = [
  { upTo: 60, label: 'до 60 кг', ranks: { kms: 172.5, ms: 195.0, msmk: 220.0, elite: 250.0 } },
  { upTo: 67.5, label: 'до 67.5 кг', ranks: { kms: 195.0, ms: 220.0, msmk: 247.5, elite: 280.0 } },
  { upTo: 75, label: 'до 75 кг', ranks: { kms: 215.5, ms: 242.5, msmk: 272.5, elite: 307.5 } },
  { upTo: 82.5, label: 'до 82.5 кг', ranks: { kms: 232.5, ms: 262.5, msmk: 295.0, elite: 332.5 } },
  { upTo: 90, label: 'до 90 кг', ranks: { kms: 247.5, ms: 277.5, msmk: 312.5, elite: 350.0 } },
  { upTo: 100, label: 'до 100 кг', ranks: { kms: 262.5, ms: 295.0, msmk: 330.0, elite: 370.0 } },
  { upTo: 110, label: 'до 110 кг', ranks: { kms: 275.0, ms: 307.5, msmk: 342.5, elite: 385.0 } },
  { upTo: 125, label: 'до 125 кг', ranks: { kms: 287.5, ms: 320.0, msmk: 357.5, elite: 400.0 } },
  { upTo: 140, label: 'до 140 кг', ranks: { kms: 297.5, ms: 330.0, msmk: 367.5, elite: 412.5 } },
  { upTo: null, label: 'св. 140 кг', ranks: { kms: 305.0, ms: 342.5, msmk: 380.0, elite: 430.0 } },
];

// WRPF/СПР (мужчины, raw) — ПРИСЕДАНИЯ (без ДК)
const WRPF_U_SQUAT: NormCategory[] = [
  { upTo: 75, label: 'до 75 кг', ranks: { kms: 185.0, ms: 210.0, msmk: 237.5, elite: 270.0 } },
  { upTo: 82.5, label: 'до 82.5 кг', ranks: { kms: 202.5, ms: 230.0, msmk: 260.0, elite: 295.0 } },
  { upTo: 90, label: 'до 90 кг', ranks: { kms: 217.5, ms: 247.5, msmk: 280.0, elite: 315.0 } },
  { upTo: 100, label: 'до 100 кг', ranks: { kms: 235.0, ms: 265.0, msmk: 300.0, elite: 337.5 } },
  { upTo: 110, label: 'до 110 кг', ranks: { kms: 247.5, ms: 280.5, msmk: 315.0, elite: 355.0 } },
  { upTo: 125, label: 'до 125 кг', ranks: { kms: 262.5, ms: 297.5, msmk: 332.5, elite: 375.0 } },
  { upTo: null, label: 'св. 125 кг', ranks: { kms: 272.5, ms: 310.0, msmk: 347.5, elite: 392.5 } },
];

// ── Женщины: ФПР классический пауэрлифтинг 2022-2025 (приказ Минспорта №6, без экипировки, КМС/МС/МСМК) ──
// Источник: fprz.ru/Norm — таблицы «Классический пауэрлифтинг ЖЕНЩИНЫ» (категории 43/47/52/57/63/69/76/84/84+)
const FPR_F_CLASSIC_TOTAL: NormCategory[] = [
  { upTo: 43, label: 'до 43 кг', ranks: { kms: 170.0 } },
  { upTo: 47, label: 'до 47 кг', ranks: { kms: 210.0, ms: 270.0, msmk: 335.0 } },
  { upTo: 52, label: 'до 52 кг', ranks: { kms: 245.0, ms: 300.0, msmk: 370.0 } },
  { upTo: 57, label: 'до 57 кг', ranks: { kms: 275.0, ms: 325.0, msmk: 390.0 } },
  { upTo: 63, label: 'до 63 кг', ranks: { kms: 305.0, ms: 350.0, msmk: 422.5 } },
  { upTo: 69, label: 'до 69 кг', ranks: { kms: 320.0, ms: 365.0, msmk: 440.0 } },
  { upTo: 76, label: 'до 76 кг', ranks: { kms: 340.0, ms: 385.0, msmk: 457.5 } },
  { upTo: 84, label: 'до 84 кг', ranks: { kms: 350.0, ms: 395.0, msmk: 475.0 } },
  { upTo: null, label: 'св. 84 кг', ranks: { kms: 375.0, ms: 420.0, msmk: 525.0 } },
];
// ФПР троеборье (экипировка) женщины 2022-2025 — для справки, используется как fallback для fpr_ipf total (экип/классика близки)
const FPR_F_EQUIPPED_TOTAL: NormCategory[] = [
  { upTo: 43, label: 'до 43 кг', ranks: { kms: 242.5 } },
  { upTo: 47, label: 'до 47 кг', ranks: { kms: 262.5, ms: 310.0, msmk: 405.0 } },
  { upTo: 52, label: 'до 52 кг', ranks: { kms: 290.0, ms: 365.0, msmk: 435.0 } },
  { upTo: 57, label: 'до 57 кг', ranks: { kms: 312.5, ms: 390.0, msmk: 485.0 } },
  { upTo: 63, label: 'до 63 кг', ranks: { kms: 337.5, ms: 420.0, msmk: 540.0 } },
  { upTo: 69, label: 'до 69 кг', ranks: { kms: 350.0, ms: 435.0, msmk: 560.0 } },
  { upTo: 76, label: 'до 76 кг', ranks: { kms: 375.0, ms: 450.0, msmk: 580.0 } },
  { upTo: 84, label: 'до 84 кг', ranks: { kms: 405.0, ms: 465.0, msmk: 600.0 } },
  { upTo: null, label: 'св. 84 кг', ranks: { kms: 422.5, ms: 480.0, msmk: 620.0 } },
];
// Женский жим ФПР классика/экипировка (берём жим лёжа ФПР 2022-2025 женщины: МСМК/МС/КМС)
const FPR_F_BENCH: NormCategory[] = [
  { upTo: 43, label: 'до 43 кг', ranks: { kms: 57.5 } },
  { upTo: 47, label: 'до 47 кг', ranks: { kms: 65.0, ms: 82.5, msmk: 100.0 } },
  { upTo: 52, label: 'до 52 кг', ranks: { kms: 72.5, ms: 95.0, msmk: 112.5 } },
  { upTo: 57, label: 'до 57 кг', ranks: { kms: 80.0, ms: 102.5, msmk: 122.5 } },
  { upTo: 63, label: 'до 63 кг', ranks: { kms: 90.0, ms: 112.5, msmk: 132.5 } },
  { upTo: 69, label: 'до 69 кг', ranks: { kms: 95.0, ms: 122.5, msmk: 140.0 } },
  { upTo: 76, label: 'до 76 кг', ranks: { kms: 100.0, ms: 130.0, msmk: 150.0 } },
  { upTo: 84, label: 'до 84 кг', ranks: { kms: 105.0, ms: 137.5, msmk: 157.5 } },
  { upTo: null, label: 'св. 84 кг', ranks: { kms: 112.5, ms: 145.0, msmk: 172.5 } },
];
// WRPF женщины — масштабирование от мужских (≈0.58-0.64 по DOTS/IPF GL, усреднённо 0.60)
function scaleCats(cats: NormCategory[], factor: number, extra: number = 0): NormCategory[] {
  return cats.map(c => {
    const ranks: Partial<Record<RankKey, number>> = {};
    for (const k of RANK_ORDER) {
      const v = c.ranks[k];
      if (v !== undefined) ranks[k] = Math.round((v * factor + extra) * 10) / 10;
    }
    return { ...c, ranks };
  });
}
// Для WRPF женщины берём женские ФПР-нормы и умножаем на 1.12 (без ДК выше ФПР) / 1.04 (с ДК)
const WRPF_U_F_TOTAL: NormCategory[] = scaleCats(FPR_F_CLASSIC_TOTAL, 1.12);
const WRPF_T_F_TOTAL: NormCategory[] = scaleCats(FPR_F_CLASSIC_TOTAL, 1.04);
// Женский жим/тяга/присед WRPF — масштабирование от мужских WRPF-жимов с коэффициентом 0.55
const WRPF_U_F_BENCH: NormCategory[] = scaleCats(WRPF_U_BENCH, 0.55);
const WRPF_U_F_DEAD: NormCategory[] = scaleCats(WRPF_U_DEAD, 0.55);
const WRPF_U_F_SQUAT: NormCategory[] = scaleCats(WRPF_U_SQUAT, 0.55);

export const PL_NORM_TABLES: NormTable[] = [
  { federation: 'fpr_ipf', federationLabel: 'ФПР / IPF (с допинг-контролем)', discipline: 'total', sex: 'male', categories: FPR_TOTAL, sourceNote: 'ФПР 2022-2025, классика мужчины: КМС/МС/МСМК. Вес — классические категории IPF (59-120+).' },
  { federation: 'wrpf_untested', federationLabel: 'WRPF / СПР (без допинг-контроля)', discipline: 'total', sex: 'male', categories: WRPF_U_TOTAL, sourceNote: 'WRPF без ДК, мужчины: КМС/МС/МСМК/Элита.' },
  { federation: 'wrpf_tested', federationLabel: 'WRPF / СПР (с допинг-контролем)', discipline: 'total', sex: 'male', categories: WRPF_T_TOTAL, sourceNote: 'WRPF с ДК, мужчины: КМС/МС/МСМК/Элита.' },
  { federation: 'wrpf_untested', federationLabel: 'WRPF / СПР (без ДК) — жим', discipline: 'bench', sex: 'male', categories: WRPF_U_BENCH },
  { federation: 'wrpf_untested', federationLabel: 'WRPF / СПР (без ДК) — тяга', discipline: 'deadlift', sex: 'male', categories: WRPF_U_DEAD },
  { federation: 'wrpf_untested', federationLabel: 'WRPF / СПР (без ДК) — присед', discipline: 'squat', sex: 'male', categories: WRPF_U_SQUAT },
  // — Женщины —
  { federation: 'fpr_ipf', federationLabel: 'ФПР / IPF (классика) — женщины', discipline: 'total', sex: 'female', categories: FPR_F_CLASSIC_TOTAL, sourceNote: 'ФПР 2022-2025 классический пауэрлифтинг женщины: категории 43-84+, КМС/МС/МСМК. Приказ Минспорта №6.' },
  { federation: 'wrpf_untested', federationLabel: 'WRPF / СПР (без ДК) — женщины', discipline: 'total', sex: 'female', categories: WRPF_U_F_TOTAL, sourceNote: 'WRPF без ДК женщины — масштабирование ФПР×1.12.' },
  { federation: 'wrpf_tested', federationLabel: 'WRPF / СПР (с ДК) — женщины', discipline: 'total', sex: 'female', categories: WRPF_T_F_TOTAL, sourceNote: 'WRPF с ДК женщины — масштабирование ФПР×1.04.' },
  { federation: 'wrpf_untested', federationLabel: 'WRPF / СПР (без ДК) — жим, женщины', discipline: 'bench', sex: 'female', categories: WRPF_U_F_BENCH },
  { federation: 'wrpf_untested', federationLabel: 'WRPF / СПР (без ДК) — тяга, женщины', discipline: 'deadlift', sex: 'female', categories: WRPF_U_F_DEAD },
  { federation: 'wrpf_untested', federationLabel: 'WRPF / СПР (без ДК) — присед, женщины', discipline: 'squat', sex: 'female', categories: WRPF_U_F_SQUAT },
  // Дополнительно: женский жим ФПР (отдельная дисциплина, только fpr_ipf bench)
  { federation: 'fpr_ipf', federationLabel: 'ФПР / IPF — жим, женщины', discipline: 'bench', sex: 'female', categories: FPR_F_BENCH },
];

export function getNormTable(federation: Federation, discipline: Discipline, sex: Sex = 'male'): NormTable | undefined {
  // Сначала точное совпадение по полу, затем fallback на male (для старых вызовов без пола)
  return PL_NORM_TABLES.find(t => t.federation === federation && t.discipline === discipline && t.sex === sex)
    || PL_NORM_TABLES.find(t => t.federation === federation && t.discipline === discipline && t.sex === 'male');
}

/** Найти весовую категорию по собственному весу (округление вверх). */
export function findCategory(table: NormTable, bodyWeight: number): NormCategory {
  const bw = Math.max(30, Math.min(250, bodyWeight));
  for (const cat of table.categories) {
    if (cat.upTo === null) return cat;
    if (bw <= cat.upTo) return cat;
  }
  return table.categories[table.categories.length - 1];
}

export interface ClassificationResult {
  category: NormCategory;
  achievedRank: RankKey | null;
  achievedLabel: string;
  nextRank: RankKey | null;
  nextLabel: string;
  kgToNext: number;
  allRanks: { key: RankKey; label: string; threshold: number; achieved: boolean }[];
}

export function classifyTotal(table: NormTable, bodyWeight: number, total: number): ClassificationResult {
  const category = findCategory(table, bodyWeight);
  return classifyTotalForCategory(table, category, total);
}

/** Найти категорию по человекочитаемой метке (для ручного выбора категории на просмотр). */
export function findCategoryByLabel(table: NormTable, label: string): NormCategory | undefined {
  return table.categories.find(c => c.label === label);
}

/** Классификация для ЯВНО выбранной категории (не по весу) — для просмотра «что если». */
export function classifyTotalForCategory(table: NormTable, category: NormCategory, total: number): ClassificationResult {
  const allRanks: { key: RankKey; label: string; threshold: number; achieved: boolean }[] = [];
  for (const key of RANK_ORDER) {
    const thr = category.ranks[key];
    if (thr === undefined) continue;
    allRanks.push({ key, label: RANK_LABELS[key], threshold: thr, achieved: total >= thr });
  }
  let achieved: RankKey | null = null;
  for (const r of allRanks) if (r.achieved) achieved = r.key;
  const achievedIdx = achieved ? allRanks.findIndex(r => r.key === achieved) : -1;
  // Если ничего не выполнено, next — первый разряд; если есть next после achieved — следующий.
  const effectiveNext = achieved ? (achievedIdx >= 0 && achievedIdx < allRanks.length - 1 ? allRanks[achievedIdx + 1] : null) : (allRanks[0] || null);
  return {
    category,
    achievedRank: achieved,
    achievedLabel: achieved ? RANK_LABELS[achieved] : 'нет разряда',
    nextRank: effectiveNext && effectiveNext.key !== achieved ? effectiveNext.key : null,
    nextLabel: effectiveNext && effectiveNext.key !== achieved ? effectiveNext.label : achieved ? 'высший разряд' : allRanks[0]?.label || '—',
    kgToNext: effectiveNext && effectiveNext.key !== achieved ? Math.round((effectiveNext.threshold - total) * 100) / 100 : (achieved ? 0 : 0),
    allRanks,
  };
}

/** Сколько процентов до следующего разряда (для прогресс-бара). 0 — только начали, 100 — выполнили. */
export function progressToNextRank(result: ClassificationResult, total: number): number {
  if (!result.nextRank) return result.achievedRank ? 100 : 0;
  const nextThr = result.allRanks.find(r => r.key === result.nextRank)?.threshold;
  const curThr = result.achievedRank ? result.allRanks.find(r => r.key === result.achievedRank)?.threshold : 0;
  if (nextThr === undefined) return 0;
  const base = curThr ?? 0;
  const span = nextThr - base;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(100, ((total - base) / span) * 100));
}

/** Все доступные категории для селектора (label + upTo). */
export function listCategoryOptions(table: NormTable): { label: string; upTo: number | null }[] {
  return table.categories.map(c => ({ label: c.label, upTo: c.upTo }));
}

/** Краткое описание для UI: как определяется категория. */
export const CATEGORY_EXPLANATION = 'Весовая категория определяется по собственному весу: атлет попадает в первую категорию, где его вес ≤ границы (upTo). Например, 82 кг → «до 83 кг» у мужчин ФПР. Граница «св. 120 кг» — открытая, для всех тяжелее последней границы.';
/** Полное пояснение к нормативам для графиков */
export const NORM_EXPLANATIONS = {
  howRank: 'Разряд определяется сравнением суммы (или результата в движении) с табличными порогами выбранной категории. Если ваш тотал ≥ порога КМС, но < МС — у вас КМС. Пороги растут с весом категории, но не линейно — тяжёлые категории требуют больше килограммов, но относительно меньше на кг собственного веса.',
  federation: 'ФПР/IPF — официальные нормативы Минспорта с допинг-контролем (требуют судей ВК и определённый статус соревнований). WRPF/СПР без ДК — коммерческие, пороги выше из-за отсутствия контроля; с ДК — чуть ниже без-ДК. Выбирайте федерацию, где планируете выступать.',
  discipline: 'Дисциплина «троеборье (сумма)» — сумма присед+жим+тяга. Отдельные дисциплины (жим, тяга, присед) оцениваются только по WRPF (ФПР жим только у женщин).',
  sex: 'Нормы разделены по полу: у женщин пороги ниже (≈60-65% от мужских в тех же весах по DOTS/IPF GL). Категории весов тоже разные: женщины 43-84+ кг, мужчины 53-120+ кг. Переключатель пола меняет и категории, и пороги, и очковую формулу (Wilks/DOTS/IPF GL считаются с разными коэффициентами).',
  points: 'Очки относительной силы (IPF GL, DOTS, Wilks, Glossbrenner) позволяют сравнивать атлетов разного веса: чем больше очков, тем сильнее относительно. DOTS — актуальный IPF с 2019, Wilks — старый (до 2019), IPF GL — новая шкала 0-120 (100+ элита), Glossbrenner — альтернативная. Все считаются по каноническим формулам с разным весом/полом.',
  relative: 'Относительная сила = результат / вес тела (×). 1× — подняли свой вес, 2× — удвоили. Пороги по движениям (мужчины): присед 1.5 средний, 2.0 опытный, 2.5 элита; жим 1.0/1.3/1.6; тяга 2.0/2.5/3.0. У женщин пороги ниже ≈30%.',
};
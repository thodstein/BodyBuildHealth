/**
 * pl-norms.engine.ts — разрядные нормативы пауэрлифтинга (мужчины, raw).
 * Источник: спецификация 2026 (ФПР/IPF, WRPF/СПР — дивизионы без/с допинг-контролем).
 * Таблицы — дляRAW (без экипировки). Женские таблицы в источник не входили — добавить позже.
 *
 * Разряды по возрастанию порога: КМС < МС < МСМК < ЭЛИТА.
 */

export type Federation = 'fpr_ipf' | 'wrpf_untested' | 'wrpf_tested';
export type Discipline = 'total' | 'bench' | 'deadlift' | 'squat';
export type RankKey = 'kms' | 'ms' | 'msmk' | 'elite';

export const RANK_LABELS: Record<RankKey, string> = { kms: 'КМС', ms: 'МС', msmk: 'МСМК', elite: 'ЭЛИТА' };
export const RANK_ORDER: RankKey[] = ['kms', 'ms', 'msmk', 'elite'];

export interface NormCategory {
  upTo: number | null; // кг; null = «свыше последней»
  label: string;
  ranks: Partial<Record<RankKey, number>>; // порог суммы (кг) для разряда
}

export interface NormTable {
  federation: Federation;
  federationLabel: string;
  discipline: Discipline;
  categories: NormCategory[];
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

export const PL_NORM_TABLES: NormTable[] = [
  { federation: 'fpr_ipf', federationLabel: 'ФПР / IPF (с допинг-контролем)', discipline: 'total', categories: FPR_TOTAL },
  { federation: 'wrpf_untested', federationLabel: 'WRPF / СПР (без допинг-контроля)', discipline: 'total', categories: WRPF_U_TOTAL },
  { federation: 'wrpf_tested', federationLabel: 'WRPF / СПР (с допинг-контролем)', discipline: 'total', categories: WRPF_T_TOTAL },
  { federation: 'wrpf_untested', federationLabel: 'WRPF / СПР (без ДК) — жим', discipline: 'bench', categories: WRPF_U_BENCH },
  { federation: 'wrpf_untested', federationLabel: 'WRPF / СПР (без ДК) — тяга', discipline: 'deadlift', categories: WRPF_U_DEAD },
  { federation: 'wrpf_untested', federationLabel: 'WRPF / СПР (без ДК) — присед', discipline: 'squat', categories: WRPF_U_SQUAT },
];

export function getNormTable(federation: Federation, discipline: Discipline): NormTable | undefined {
  return PL_NORM_TABLES.find(t => t.federation === federation && t.discipline === discipline);
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
  const allRanks: { key: RankKey; label: string; threshold: number; achieved: boolean }[] = [];
  for (const key of RANK_ORDER) {
    const thr = category.ranks[key];
    if (thr === undefined) continue;
    allRanks.push({ key, label: RANK_LABELS[key], threshold: thr, achieved: total >= thr });
  }
  let achieved: RankKey | null = null;
  for (const r of allRanks) if (r.achieved) achieved = r.key;
  const achievedIdx = achieved ? allRanks.findIndex(r => r.key === achieved) : -1;
  const next = achievedIdx >= 0 && achievedIdx < allRanks.length - 1 ? allRanks[achievedIdx + 1] : null;
  return {
    category,
    achievedRank: achieved,
    achievedLabel: achieved ? RANK_LABELS[achieved] : 'нет разряда',
    nextRank: next ? next.key : null,
    nextLabel: next ? next.label : achieved ? 'высший разряд' : allRanks[0]?.label || '—',
    kgToNext: next ? Math.round((next.threshold - total) * 100) / 100 : (achieved ? 0 : (allRanks[0]?.threshold ? Math.round((allRanks[0].threshold - total) * 100) / 100 : 0)),
    allRanks,
  };
}
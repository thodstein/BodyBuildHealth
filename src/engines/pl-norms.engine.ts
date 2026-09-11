/**
 * pl-norms.engine.ts — разрядные нормативы пауэрлифтинга (мужчины и женщины).
 * Источник ФПР: ЕВСК 2022-2025 (приказ Минспорта №6 от 11.01.2022, сверено с fprz.ru/Norm
 * и frs24.ru/st/normativ-powerlifting, янв.2025): троеборье + троеборье классическое +
 * жим лёжа, полная лесенка МСМК/МС/КМС/I/II/III/I(ю)/II(ю)/III(ю).
 * WRPF/СПР (без/с ДК) — только мужские официальные таблицы (женских официальных нет —
 * масштабированные WRPF-Ж таблицы удалены как выдумка, getNormTable честно возвращает undefined).
 *
 * Порядок по возрастанию порога: III(ю) < II(ю) < I(ю) < III < II < I < КМС < МС < МСМК < ЭЛИТА
 * (Элита — только WRPF без ДК). Для категорий 53 (М) / 43 (Ж) МС/МСМК не присваиваются.
 * Возраст присвоения: КМС с 14, МС с 16, МСМК с 17, I–III и юношеские с 12 лет.
 */

export type Federation = 'fpr_ipf' | 'fpr_classic' | 'fpr_equipped' | 'wrpf_untested' | 'wrpf_tested';
export type Discipline = 'total' | 'bench' | 'deadlift' | 'squat';
export type RankKey = 'kms' | 'ms' | 'msmk' | 'elite' | 'i' | 'ii' | 'iii' | 'youth1' | 'youth2' | 'youth3';
export type Sex = 'male' | 'female';
export type AgeGroup = 'open' | 'youth_12_13' | 'youth_14_18' | 'junior_19_23' | 'masters_40plus';

export const AGE_GROUPS: { id: AgeGroup; label: string; desc: string }[] = [
  { id: 'open', label: 'Открытая (12+ лет)', desc: 'Все разряды: КМС с 14, МС с 16, МСМК с 17' },
  { id: 'youth_12_13', label: 'Юноши 12-13 лет', desc: 'Только юношеские и I-III, без КМС' },
  { id: 'youth_14_18', label: 'Юноши/Девушки 14-18', desc: 'КМС с 14, I-III и юношеские' },
  { id: 'junior_19_23', label: 'Юниоры 19-23', desc: 'Все взрослые разряды, МСМК на первенстве мира/Европы среди юниоров' },
  { id: 'masters_40plus', label: 'Мастера 40+', desc: 'Ветераны — нормативы как в открытой, но с коэффициентом' },
];

export function eligibleRanksForAge(ageGroup: AgeGroup): RankKey[] {
  const youth: RankKey[] = ['youth3', 'youth2', 'youth1'];
  const mass: RankKey[] = ['iii', 'ii', 'i'];
  switch (ageGroup) {
    case 'youth_12_13': return [...youth, ...mass];
    case 'youth_14_18': return [...youth, ...mass, 'kms'];
    case 'junior_19_23': return [...mass, 'kms', 'ms', 'msmk'];
    case 'masters_40plus': return [...youth, ...mass, 'kms', 'ms', 'msmk', 'elite'];
    default: return [...youth, ...mass, 'kms', 'ms', 'msmk', 'elite'];
  }
}

export function ageEligibilityNote(ageGroup: AgeGroup, achieved: RankKey | null): string | null {
  if (!achieved) return null;
  const eligible = eligibleRanksForAge(ageGroup);
  if (eligible.includes(achieved)) return null;
  if (ageGroup === 'youth_12_13') return 'В 12-13 лет КМС/МС/МСМК не присваиваются — доступны только юношеские и I–III.';
  if (ageGroup === 'youth_14_18' && (achieved === 'ms' || achieved === 'msmk' || achieved === 'elite')) return `В 14-18 лет МС/МСМК ещё не присваиваются (МС с 16, МСМК с 17) — ваш результат соответствует взрослому нормативу ${RANK_LABELS[achieved]}, но зачесть можно только КМС.`;
  return null;
}

export const RANK_LABELS: Record<RankKey, string> = {
  kms: 'КМС', ms: 'МС', msmk: 'МСМК', elite: 'ЭЛИТА',
  i: 'I', ii: 'II', iii: 'III', youth1: 'I(ю)', youth2: 'II(ю)', youth3: 'III(ю)',
};
export const RANK_ORDER: RankKey[] = ['youth3', 'youth2', 'youth1', 'iii', 'ii', 'i', 'kms', 'ms', 'msmk', 'elite'];
/** Человекочитаемые пояснения к разрядам */
export const RANK_DESCRIPTIONS: Record<RankKey, string> = {
  kms: 'Кандидат в мастера спорта (с 14 лет) — первый взрослый разряд, выполняется на чемпионате субъекта РФ при наличии судей ВК/1К.',
  ms: 'Мастер спорта (с 16 лет) — выполняется на чемпионате федерального округа или Москвы/СПб с допинг-контролем и 3 судьями ВК.',
  msmk: 'Мастер спорта международного класса (с 17 лет) — только на международных стартах из ЕКП (чемпионат мира/Европы) с допинг-контролем.',
  elite: 'ЭЛИТА — высший норматив WRPF/СПР без допинг-контроля (вне ЕВСК, для коммерческих федераций).',
  i: 'I взрослый разряд (с 12 лет) — выполняется на официальных соревнованиях субъекта РФ.',
  ii: 'II взрослый разряд (с 12 лет) — выполняется на официальных соревнованиях любого статуса.',
  iii: 'III взрослый разряд (с 12 лет) — выполняется на официальных соревнованиях любого статуса.',
  youth1: 'I юношеский разряд (с 12 лет) — выполняется на официальных соревнованиях любого статуса.',
  youth2: 'II юношеский разряд (с 12 лет) — выполняется на официальных соревнованиях любого статуса.',
  youth3: 'III юношеский разряд (с 12 лет) — выполняется на официальных соревнованиях любого статуса.',
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

// ФПР (мужчины, троеборье классическое) — ЕВСК 2022-2025, полная лесенка
const FPR_CLASSIC_TOTAL_M: NormCategory[] = [
  { upTo: 53, label: 'до 53 кг', ranks: { kms: 340.0, i: 300.0, ii: 265.0, iii: 240.0, youth1: 215.0, youth2: 200.0, youth3: 185.0 } },
  { upTo: 59, label: 'до 59 кг', ranks: { msmk: 545.0, ms: 465.0, kms: 385.0, i: 340.0, ii: 300.0, iii: 275.0, youth1: 245.0, youth2: 225.0, youth3: 205.0 } },
  { upTo: 66, label: 'до 66 кг', ranks: { msmk: 620.0, ms: 525.0, kms: 425.0, i: 380.0, ii: 335.0, iii: 305.0, youth1: 270.0, youth2: 245.0, youth3: 215.0 } },
  { upTo: 74, label: 'до 74 кг', ranks: { msmk: 685.0, ms: 580.0, kms: 460.0, i: 415.0, ii: 365.0, iii: 325.0, youth1: 295.0, youth2: 260.0, youth3: 230.0 } },
  { upTo: 83, label: 'до 83 кг', ranks: { msmk: 750.0, ms: 640.0, kms: 500.0, i: 455.0, ii: 400.0, iii: 350.0, youth1: 320.0, youth2: 290.0, youth3: 255.0 } },
  { upTo: 93, label: 'до 93 кг', ranks: { msmk: 785.0, ms: 690.0, kms: 540.0, i: 480.0, ii: 430.0, iii: 385.0, youth1: 345.0, youth2: 315.0, youth3: 275.0 } },
  { upTo: 105, label: 'до 105 кг', ranks: { msmk: 822.5, ms: 720.0, kms: 585.0, i: 510.0, ii: 460.0, iii: 415.0, youth1: 370.0, youth2: 330.0, youth3: 300.0 } },
  { upTo: 120, label: 'до 120 кг', ranks: { msmk: 855.0, ms: 770.0, kms: 635.0, i: 555.0, ii: 505.0, iii: 455.0, youth1: 395.0, youth2: 355.0, youth3: 325.0 } },
  { upTo: null, label: 'св. 120 кг', ranks: { msmk: 925.0, ms: 815.0, kms: 690.0, i: 585.0, ii: 525.0, iii: 485.0, youth1: 425.0, youth2: 370.0, youth3: 345.0 } },
];

// ФПР (мужчины, троеборье в экипировке) — ЕВСК 2022-2025, полная лесенка
const FPR_EQUIPPED_TOTAL_M: NormCategory[] = [
  { upTo: 53, label: 'до 53 кг', ranks: { kms: 410.0, i: 325.0, ii: 282.5, iii: 260.0, youth1: 232.5, youth2: 215.0, youth3: 195.0 } },
  { upTo: 59, label: 'до 59 кг', ranks: { msmk: 635.0, ms: 540.0, kms: 455.0, i: 362.5, ii: 315.0, iii: 290.0, youth1: 260.0, youth2: 240.0, youth3: 212.5 } },
  { upTo: 66, label: 'до 66 кг', ranks: { msmk: 720.0, ms: 595.0, kms: 510.0, i: 402.5, ii: 350.0, iii: 320.0, youth1: 287.5, youth2: 257.5, youth3: 227.5 } },
  { upTo: 74, label: 'до 74 кг', ranks: { msmk: 785.0, ms: 675.0, kms: 537.5, i: 440.0, ii: 385.0, iii: 352.5, youth1: 317.5, youth2: 280.0, youth3: 247.5 } },
  { upTo: 83, label: 'до 83 кг', ranks: { msmk: 850.0, ms: 775.0, kms: 582.5, i: 482.5, ii: 422.5, iii: 387.5, youth1: 352.5, youth2: 307.5, youth3: 277.5 } },
  { upTo: 93, label: 'до 93 кг', ranks: { msmk: 925.0, ms: 800.0, kms: 610.0, i: 520.0, ii: 465.0, iii: 412.5, youth1: 382.5, youth2: 340.0, youth3: 307.5 } },
  { upTo: 105, label: 'до 105 кг', ranks: { msmk: 970.0, ms: 840.0, kms: 645.0, i: 552.5, ii: 500.0, iii: 460.0, youth1: 397.5, youth2: 355.0, youth3: 330.0 } },
  { upTo: 120, label: 'до 120 кг', ranks: { msmk: 1005.0, ms: 875.0, kms: 687.5, i: 600.0, ii: 530.0, iii: 497.5, youth1: 422.5, youth2: 372.5, youth3: 347.5 } },
  { upTo: null, label: 'св. 120 кг', ranks: { msmk: 1035.0, ms: 890.0, kms: 735.0, i: 617.5, ii: 545.0, iii: 510.0, youth1: 455.0, youth2: 390.0, youth3: 372.5 } },
];

// ФПР (мужчины, жим лёжа) — ЕВСК 2022-2025. В источнике таблица «Жим лёжа» без деления
// классика/экип — отнесена к классике как нижняя оценка (sourceNote честно указывает).
const FPR_BENCH_M: NormCategory[] = [
  { upTo: 53, label: 'до 53 кг', ranks: { kms: 105.0, i: 90.0, ii: 80.0, iii: 72.5, youth1: 62.5, youth2: 57.5, youth3: 52.5 } },
  { upTo: 59, label: 'до 59 кг', ranks: { msmk: 180.0, ms: 145.0, kms: 120.0, i: 105.0, ii: 95.0, iii: 85.0, youth1: 72.5, youth2: 65.0, youth3: 57.5 } },
  { upTo: 66, label: 'до 66 кг', ranks: { msmk: 215.0, ms: 180.0, kms: 135.0, i: 120.0, ii: 105.0, iii: 92.5, youth1: 80.0, youth2: 72.5, youth3: 65.0 } },
  { upTo: 74, label: 'до 74 кг', ranks: { msmk: 240.0, ms: 205.0, kms: 155.0, i: 135.0, ii: 120.0, iii: 112.5, youth1: 95.0, youth2: 85.0, youth3: 77.5 } },
  { upTo: 83, label: 'до 83 кг', ranks: { msmk: 270.0, ms: 225.0, kms: 175.0, i: 150.0, ii: 135.0, iii: 122.5, youth1: 105.0, youth2: 95.0, youth3: 85.0 } },
  { upTo: 93, label: 'до 93 кг', ranks: { msmk: 297.5, ms: 245.0, kms: 195.0, i: 165.0, ii: 150.0, iii: 135.0, youth1: 115.0, youth2: 102.5, youth3: 92.5 } },
  { upTo: 105, label: 'до 105 кг', ranks: { msmk: 315.0, ms: 260.0, kms: 210.0, i: 180.0, ii: 160.0, iii: 145.0, youth1: 122.5, youth2: 110.0, youth3: 100.0 } },
  { upTo: 120, label: 'до 120 кг', ranks: { msmk: 330.0, ms: 275.0, kms: 225.0, i: 190.0, ii: 170.0, iii: 155.0, youth1: 132.5, youth2: 120.0, youth3: 107.5 } },
  { upTo: null, label: 'св. 120 кг', ranks: { msmk: 345.0, ms: 290.0, kms: 240.0, i: 205.0, ii: 180.0, iii: 165.0, youth1: 140.0, youth2: 127.5, youth3: 115.0 } },
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

// ── Женщины: ФПР классический пауэрлифтинг 2022-2025 (приказ Минспорта №6, полная лесенка) ──
// Источник: fprz.ru/Norm + frs24.ru/st/normativ-powerlifting (категории 43/47/52/57/63/69/76/84/84+)
const FPR_F_CLASSIC_TOTAL: NormCategory[] = [
  { upTo: 43, label: 'до 43 кг', ranks: { kms: 170.0, i: 145.0, ii: 125.0, iii: 115.0, youth1: 105.0, youth2: 97.5, youth3: 90.0 } },
  { upTo: 47, label: 'до 47 кг', ranks: { msmk: 335.0, ms: 270.0, kms: 210.0, i: 170.0, ii: 145.0, iii: 125.0, youth1: 115.0, youth2: 105.0, youth3: 97.5 } },
  { upTo: 52, label: 'до 52 кг', ranks: { msmk: 370.0, ms: 300.0, kms: 245.0, i: 195.0, ii: 170.0, iii: 145.0, youth1: 125.0, youth2: 115.0, youth3: 105.0 } },
  { upTo: 57, label: 'до 57 кг', ranks: { msmk: 390.0, ms: 325.0, kms: 275.0, i: 205.0, ii: 185.0, iii: 165.0, youth1: 145.0, youth2: 125.0, youth3: 115.0 } },
  { upTo: 63, label: 'до 63 кг', ranks: { msmk: 422.5, ms: 350.0, kms: 305.0, i: 230.0, ii: 200.0, iii: 180.0, youth1: 160.0, youth2: 140.0, youth3: 125.0 } },
  { upTo: 69, label: 'до 69 кг', ranks: { msmk: 440.0, ms: 365.0, kms: 320.0, i: 252.5, ii: 222.5, iii: 190.0, youth1: 170.0, youth2: 150.0, youth3: 137.5 } },
  { upTo: 76, label: 'до 76 кг', ranks: { msmk: 457.5, ms: 385.0, kms: 340.0, i: 277.5, ii: 242.5, iii: 210.0, youth1: 190.0, youth2: 170.0, youth3: 150.0 } },
  { upTo: 84, label: 'до 84 кг', ranks: { msmk: 475.0, ms: 395.0, kms: 350.0, i: 295.0, ii: 255.0, iii: 220.0, youth1: 200.0, youth2: 180.0, youth3: 160.0 } },
  { upTo: null, label: 'св. 84 кг', ranks: { msmk: 525.0, ms: 420.0, kms: 375.0, i: 317.5, ii: 285.0, iii: 250.0, youth1: 220.0, youth2: 200.0, youth3: 180.0 } },
];
// ФПР троеборье (экипировка) женщины 2022-2025 — полная лесенка, тот же источник
const FPR_F_EQUIPPED_TOTAL: NormCategory[] = [
  { upTo: 43, label: 'до 43 кг', ranks: { kms: 242.5, i: 175.0, ii: 150.0, iii: 137.5, youth1: 122.5, youth2: 112.5, youth3: 97.5 } },
  { upTo: 47, label: 'до 47 кг', ranks: { msmk: 367.5, ms: 297.5, kms: 262.5, i: 190.0, ii: 165.0, iii: 150.0, youth1: 135.0, youth2: 122.5, youth3: 105.0 } },
  { upTo: 52, label: 'до 52 кг', ranks: { msmk: 405.0, ms: 325.0, kms: 290.0, i: 210.0, ii: 182.5, iii: 167.5, youth1: 147.5, youth2: 135.0, youth3: 117.5 } },
  { upTo: 57, label: 'до 57 кг', ranks: { msmk: 435.0, ms: 352.5, kms: 312.5, i: 227.5, ii: 200.0, iii: 182.5, youth1: 162.5, youth2: 147.5, youth3: 127.5 } },
  { upTo: 63, label: 'до 63 кг', ranks: { msmk: 475.0, ms: 385.0, kms: 337.5, i: 252.5, ii: 220.0, iii: 202.5, youth1: 180.0, youth2: 162.5, youth3: 142.5 } },
  { upTo: 69, label: 'до 69 кг', ranks: { msmk: 560.0, ms: 435.0, kms: 350.0, i: 275.0, ii: 237.5, iii: 215.0, youth1: 190.0, youth2: 175.0, youth3: 152.5 } },
  { upTo: 76, label: 'до 76 кг', ranks: { msmk: 580.0, ms: 450.0, kms: 375.0, i: 300.0, ii: 265.0, iii: 235.0, youth1: 205.0, youth2: 190.0, youth3: 167.5 } },
  { upTo: 84, label: 'до 84 кг', ranks: { msmk: 600.0, ms: 465.0, kms: 405.0, i: 327.5, ii: 285.0, iii: 260.0, youth1: 220.0, youth2: 205.0, youth3: 177.5 } },
  { upTo: null, label: 'св. 84 кг', ranks: { msmk: 620.0, ms: 480.0, kms: 422.5, i: 352.5, ii: 320.0, iii: 285.0, youth1: 235.0, youth2: 217.5, youth3: 192.5 } },
];
// Женский жим ФПР 2022-2025 — полная лесенка, тот же источник
const FPR_F_BENCH: NormCategory[] = [
  { upTo: 43, label: 'до 43 кг', ranks: { kms: 57.5, i: 50.0, ii: 45.0, iii: 40.0, youth1: 35.0, youth2: 30.0, youth3: 25.0 } },
  { upTo: 47, label: 'до 47 кг', ranks: { msmk: 100.0, ms: 82.5, kms: 65.0, i: 55.0, ii: 50.0, iii: 45.0, youth1: 40.0, youth2: 35.0, youth3: 30.0 } },
  { upTo: 52, label: 'до 52 кг', ranks: { msmk: 112.5, ms: 95.0, kms: 72.5, i: 60.0, ii: 55.0, iii: 50.0, youth1: 45.0, youth2: 40.0, youth3: 35.0 } },
  { upTo: 57, label: 'до 57 кг', ranks: { msmk: 122.5, ms: 102.5, kms: 80.0, i: 67.5, ii: 60.0, iii: 55.0, youth1: 50.0, youth2: 45.0, youth3: 40.0 } },
  { upTo: 63, label: 'до 63 кг', ranks: { msmk: 132.5, ms: 112.5, kms: 90.0, i: 75.0, ii: 67.5, iii: 60.0, youth1: 55.0, youth2: 50.0, youth3: 45.0 } },
  { upTo: 69, label: 'до 69 кг', ranks: { msmk: 140.0, ms: 122.5, kms: 95.0, i: 80.0, ii: 72.5, iii: 65.0, youth1: 60.0, youth2: 55.0, youth3: 50.0 } },
  { upTo: 76, label: 'до 76 кг', ranks: { msmk: 150.0, ms: 130.0, kms: 100.0, i: 85.0, ii: 75.0, iii: 67.5, youth1: 62.5, youth2: 57.5, youth3: 52.5 } },
  { upTo: 84, label: 'до 84 кг', ranks: { msmk: 157.5, ms: 137.5, kms: 105.0, i: 90.0, ii: 80.0, iii: 72.5, youth1: 65.0, youth2: 60.0, youth3: 55.0 } },
  { upTo: null, label: 'св. 84 кг', ranks: { msmk: 172.5, ms: 145.0, kms: 112.5, i: 95.0, ii: 85.0, iii: 77.5, youth1: 70.0, youth2: 65.0, youth3: 60.0 } },
];

export const PL_NORM_TABLES: NormTable[] = [
  { federation: 'fpr_classic', federationLabel: 'ФПР / IPF — классика', discipline: 'total', sex: 'male', categories: FPR_CLASSIC_TOTAL_M, sourceNote: 'ФПР 2022-2025, классика мужчины (59–120+): МСМК/МС/КМС/I/II/III/юношеские. Приказ Минспорта №6.' },
  { federation: 'fpr_equipped', federationLabel: 'ФПР — экипировка', discipline: 'total', sex: 'male', categories: FPR_EQUIPPED_TOTAL_M, sourceNote: 'ФПР 2022-2025, экипировка мужчины: МСМК/МС/КМС/I/II/III/юношеские.' },
  { federation: 'fpr_classic', federationLabel: 'ФПР — жим (классика, нижняя оценка)', discipline: 'bench', sex: 'male', categories: FPR_BENCH_M, sourceNote: 'ФПР 2022-2025, жим лёжа мужчины: таблица источника без деления классика/экип — отнесена к классике как нижняя оценка.' },
  { federation: 'wrpf_untested', federationLabel: 'WRPF / СПР (без допинг-контроля)', discipline: 'total', sex: 'male', categories: WRPF_U_TOTAL, sourceNote: 'WRPF без ДК, мужчины: КМС/МС/МСМК/Элита.' },
  { federation: 'wrpf_tested', federationLabel: 'WRPF / СПР (с допинг-контролем)', discipline: 'total', sex: 'male', categories: WRPF_T_TOTAL, sourceNote: 'WRPF с ДК, мужчины: КМС/МС/МСМК/Элита.' },
  { federation: 'wrpf_untested', federationLabel: 'WRPF / СПР (без ДК) — жим', discipline: 'bench', sex: 'male', categories: WRPF_U_BENCH },
  { federation: 'wrpf_untested', federationLabel: 'WRPF / СПР (без ДК) — тяга', discipline: 'deadlift', sex: 'male', categories: WRPF_U_DEAD },
  { federation: 'wrpf_untested', federationLabel: 'WRPF / СПР (без ДК) — присед', discipline: 'squat', sex: 'male', categories: WRPF_U_SQUAT },
  // — Женщины (только ФПР — официальных женских WRPF-таблиц нет) —
  { federation: 'fpr_classic', federationLabel: 'ФПР / IPF (классика) — женщины', discipline: 'total', sex: 'female', categories: FPR_F_CLASSIC_TOTAL, sourceNote: 'ФПР 2022-2025 классика женщины: категории 43-84+, полная лесенка. Приказ Минспорта №6.' },
  { federation: 'fpr_equipped', federationLabel: 'ФПР (экипировка) — женщины', discipline: 'total', sex: 'female', categories: FPR_F_EQUIPPED_TOTAL, sourceNote: 'ФПР 2022-2025 экипировка женщины: полная лесенка.' },
  { federation: 'fpr_classic', federationLabel: 'ФПР / IPF — жим, женщины', discipline: 'bench', sex: 'female', categories: FPR_F_BENCH, sourceNote: 'ФПР 2022-2025 жим лёжа женщины: полная лесенка.' },
];

/** @deprecated алиас: старый id 'fpr_ipf' = классика (IPF = raw/classic в современном понимании). */
export function resolveFederation(fed: Federation): Exclude<Federation, 'fpr_ipf'> {
  return fed === 'fpr_ipf' ? 'fpr_classic' : fed;
}

export function getNormTable(federation: Federation, discipline: Discipline, sex: Sex = 'male'): NormTable | undefined {
  const fed = resolveFederation(federation);
  // Точное совпадение по полу; кросс-полового fallback НЕТ (женские WRPF-таблицы удалены как выдумка —
  // честно undefined вместо мужских порогов для женщин). Backward-compat: вызовы без пола → male.
  return PL_NORM_TABLES.find(t => t.federation === fed && t.discipline === discipline && t.sex === sex);
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
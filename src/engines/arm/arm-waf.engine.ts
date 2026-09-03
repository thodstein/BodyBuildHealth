/**
 * arm-waf.engine.ts — WAF-комплаенс 2025 (эпик A PRO-плана).
 *
 * Источник: WAF 2025 Rules (waf-armwrestling.com): Senior M11 / F8,
 * Master 40-49, Grand 50-59, SeniorGrand 60-69, SuperSenior 70+,
 * SubJunior 14-15, Junior 16-18, Youth 19-23 + Para (PID/PIU/VI/HI/CP, упрощённо).
 * Левая и правая руки — отдельные зачёты.
 *
 * Чистый модуль без импортов (изолирован). Все веса в кг.
 */

export type WafSex = 'male' | 'female';
export type WafArm = 'left' | 'right' | 'both';
export type WafAgeGroup =
  | 'subjunior' // 14-15
  | 'junior' // 16-18
  | 'youth23' // 19-23
  | 'senior'
  | 'master40' // 40-49
  | 'grandmaster50' // 50-59
  | 'sgrandmaster60' // 60-69
  | 'ssgrandmaster70'; // 70+

export type WafParaClass = 'none' | 'PID' | 'PIU' | 'PIDH' | 'PIUH' | 'VI' | 'HI' | 'CPD' | 'CPU';

export interface WafClassInfo {
  label: string; // '85' | '110+' | 'Open'
  ceilingKg: number; // верхняя граница (Infinity для открытой)
  deltaKg: number; // ceiling - bw (может быть отрицательным = перевес)
  fits: boolean; // deltaKg >= 0
}

const OPEN = Number.POSITIVE_INFINITY;

function classesToInfos(classes: Array<number | 'open'>, bwKg: number): WafClassInfo[] {
  return classes.map((c) => {
    if (c === 'open') return { label: 'Open', ceilingKg: OPEN, deltaKg: OPEN, fits: true };
    const label = `${c}`;
    const delta = Math.round((c - bwKg) * 10) / 10;
    return { label, ceilingKg: c, deltaKg: delta, fits: delta >= 0 };
  });
}

/** Возрастной зачёт по полных лет (границы WAF). 70+ → ssgrandmaster70. */
export function wafAgeGroupFor(ageYears: number): WafAgeGroup {
  const a = Number.isFinite(ageYears) ? ageYears : 30;
  if (a < 14) return 'subjunior';
  if (a <= 15) return 'subjunior';
  if (a <= 18) return 'junior';
  if (a <= 23) return 'youth23';
  if (a <= 39) return 'senior';
  if (a <= 49) return 'master40';
  if (a <= 59) return 'grandmaster50';
  if (a <= 69) return 'sgrandmaster60';
  return 'ssgrandmaster70';
}

/** Все весовые категории зачёта (верхние границы). */
export function wafClassesFor(
  sex: WafSex,
  ageGroup: WafAgeGroup,
  para: WafParaClass = 'none',
): Array<number | 'open'> {
  if (para !== 'none') {
    if (para === 'PID') return sex === 'male' ? [55, 65, 75, 100, 'open'] : [55, 65, 'open'];
    if (para === 'PIU') return sex === 'male' ? [60, 70, 80, 90, 'open'] : [55, 65, 'open'];
    if (para === 'PIDH') return [80, 'open'];
    if (para === 'PIUH') return sex === 'female' ? [65, 'open'] : [85, 'open'];
    if (para === 'VI' || para === 'HI')
      return sex === 'male' ? [60, 70, 80, 90, 100, 'open'] : [60, 70, 'open'];
    // CPD/CPU
    return sex === 'male' ? [55, 65, 'open'] : [55, 65, 'open'];
  }
  const m = sex === 'male';
  switch (ageGroup) {
    case 'subjunior':
      return m ? [45, 50, 55, 60, 65, 70, 'open'] : [40, 45, 50, 55, 60, 70, 'open'];
    case 'junior':
      return m ? [50, 55, 60, 65, 70, 75, 80, 90, 'open'] : [45, 50, 55, 60, 65, 70, 'open'];
    case 'youth23':
    case 'senior':
      return m ? [55, 60, 65, 70, 75, 80, 85, 90, 100, 110, 'open'] : [50, 55, 60, 65, 70, 80, 90, 'open'];
    case 'master40':
      return m ? [60, 70, 80, 90, 100, 110, 'open'] : [60, 70, 80, 'open'];
    case 'grandmaster50':
    case 'sgrandmaster60':
      return m ? [70, 80, 90, 100, 'open'] : [60, 70, 80, 'open'];
    case 'ssgrandmaster70':
      return ['open'];
  }
}

/** Текущая весовая для фактического веса (первая подходящая сверху). */
export function wafClassFor(
  bwKg: number,
  sex: WafSex,
  ageGroup: WafAgeGroup,
  para: WafParaClass = 'none',
): WafClassInfo {
  const bw = Number.isFinite(bwKg) && bwKg > 25 && bwKg < 250 ? bwKg : 80;
  const infos = classesToInfos(wafClassesFor(sex, ageGroup, para), bw);
  return infos.find((i) => i.fits) || infos[infos.length - 1];
}

/** Следующая (более лёгкая) цель при сгонке: ближайший потолок строго ниже текущего веса. */
export function wafCutTargetFor(
  bwKg: number,
  sex: WafSex,
  ageGroup: WafAgeGroup,
  para: WafParaClass = 'none',
): WafClassInfo | null {
  const bw = Number.isFinite(bwKg) ? bwKg : 80;
  const ceilings = (wafClassesFor(sex, ageGroup, para).filter((c) => c !== 'open') as number[])
    .slice()
    .sort((a, b) => a - b);
  const below = ceilings.filter((c) => c < bw - 1e-9);
  if (below.length === 0) return null;
  const target = below[below.length - 1];
  return { label: `${target}`, ceilingKg: target, deltaKg: Math.round((target - bw) * 10) / 10, fits: false };
}

export interface WafStartCard {
  sex: WafSex;
  ageYears: number;
  ageGroup: WafAgeGroup;
  bodyWeightKg: number;
  weightClass: WafClassInfo;
  cutTarget: WafClassInfo | null;
  arms: WafArm[];
  entriesCount: number; // 1 или 2 (both = левая+правая отдельно)
  strapNote: string;
  weighInNote: string;
}

/**
 * Карточка старта: категория + сгонка + руки-зачёты + ремень/взвешивание.
 * strapExpected — ожидается ли борьба в ремнях (судейский ремень при срыве хвата).
 */
export function buildWafStartCard(input: {
  sex?: string;
  ageYears?: number;
  bodyWeightKg?: number;
  arm?: WafArm;
  para?: WafParaClass;
  strapExpected?: boolean;
}): WafStartCard {
  const sex: WafSex = input.sex === 'female' ? 'female' : 'male';
  const ageYears = Number.isFinite(Number(input.ageYears)) ? Number(input.ageYears) : 30;
  const bw = Number.isFinite(Number(input.bodyWeightKg)) ? Number(input.bodyWeightKg) : 80;
  const arm: WafArm = input.arm === 'left' || input.arm === 'right' ? input.arm : 'both';
  const para: WafParaClass = input.para || 'none';
  const ageGroup = wafAgeGroupFor(ageYears);
  const weightClass = wafClassFor(bw, sex, ageGroup, para);
  const cutTarget = wafCutTargetFor(bw, sex, ageGroup, para);
  const arms: WafArm[] = arm === 'both' ? ['left', 'right'] : [arm];
  const strapNote =
    input.strapExpected === false
      ? 'Ремень не ожидается — хват-упор на containment.'
      : 'Судейский ремень при срыве хвата — добавить strap-сессии (эпик D).';
  const weighInNote =
    weightClass.label === 'Open'
      ? 'Открытая — взвешивание формально, фокус на силу.'
      : weightClass.fits
        ? `Зачёт до ${weightClass.label} кг, запас ${weightClass.deltaKg.toFixed(1)} кг.`
        : `Перевес ${Math.abs(weightClass.deltaKg).toFixed(1)} кг — нужна сгонка (эпик H).`;
  return {
    sex,
    ageYears,
    ageGroup,
    bodyWeightKg: bw,
    weightClass,
    cutTarget,
    arms,
    entriesCount: arms.length,
    strapNote,
    weighInNote,
  };
}

/** Сколько зачётов (рук) у атлета на турнире. */
export function wafEntriesCount(arm: WafArm): number {
  return arm === 'both' ? 2 : 1;
}

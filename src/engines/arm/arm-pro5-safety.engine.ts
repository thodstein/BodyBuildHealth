/**
 * arm-pro5-safety.engine.ts — PRO-5 P1 safety-гейты (чистый модуль без импортов).
 *
 * Источники: Öğümsöğütlü & Özcan 2026 (ось/ротация/защита 62%), Marotta 2026
 * (hook грузит flexor-pronator), ретроспектива AMC 2023 (холод/без разминки).
 * Всё gated на явных входах — без входов функции no-op (старые планы целы).
 */

export interface Pro5AxisInput {
  trunkRotatedTowardAttack?: boolean;
  wristElbowShoulderAligned?: boolean;
  wristBehindShoulder?: boolean;
  fightingFromDefense?: boolean;
  wristExtendedDorsally?: boolean;
  coldNoWarmup?: boolean;
  sideMaxAttempt?: boolean;
}

export interface Pro5SafetyInput {
  axisCheck?: Pro5AxisInput;
  warmupDone?: boolean;
  elbowPain?: number; // 0–10 из diary/check-in
  hookCapSets?: number; // недельный кап hook-объёма (дефолт 12)
  technique?: string;
  level?: string;
  weeksToStart?: number | null; // недель до старта (весогонка/проигрыш-гейт)
}

export interface Pro5SafetyResult {
  /** side тяж→техника при high-риске; hook RIR+1 при боли/капе; stress→heavy при losing. */
  forceSideTechnique: boolean;
  hookRirShift: number;
  forbidStressSingles: boolean;
  warmupRequired: boolean;
  blocked: string[]; // критично — кандидат в validator.blocked
  warnings: string[];
  notes: string[]; // строки в rationale
}

/** Подсчёт красных флагов оси (паритет checkHumerusAxis: score≥3 high, ≥1 guarded). */
export function axisScoreOf(a: Pro5AxisInput = {}): number {
  let s = 0;
  if (a.trunkRotatedTowardAttack) s++;
  if (a.wristElbowShoulderAligned === false) s++;
  if (a.wristBehindShoulder) s++;
  if (a.wristExtendedDorsally) s++;
  if (a.coldNoWarmup) s++;
  if (a.fightingFromDefense && a.sideMaxAttempt) s++;
  return s;
}

export function applyPro5Safety(input: Pro5SafetyInput = {}): Pro5SafetyResult {
  const res: Pro5SafetyResult = {
    forceSideTechnique: false,
    hookRirShift: 0,
    forbidStressSingles: false,
    warmupRequired: false,
    blocked: [],
    warnings: [],
    notes: [],
  };
  const score = axisScoreOf(input.axisCheck);
  // S1: axis-gate — high-риск режет боковое в процедуру.
  if (score >= 3) {
    res.forceSideTechnique = true;
    res.blocked.push(`Ось high (${score} флага): side_pressure только техника/изометрия, макс запрещён.`);
    res.notes.push('PRO-5 safety: ось high — боковое переведено в технику (процедура без лифта).');
  } else if (score >= 1) {
    res.warnings.push(`Ось guarded (${score} флага): держать локоть-якорь, side без максимума.`);
  }
  // S3: warmup-gate — холод без разминки.
  if (input.axisCheck?.coldNoWarmup && input.warmupDone !== true) {
    res.warmupRequired = true;
    res.warnings.push('Холод без разминки: блок 10–15 мин (кисть/локоть/плечо) обязателен перед столом.');
    res.notes.push('PRO-5 safety: warmup-блок назначен (холод/без разминки).');
  }
  // S2: hook-cap — боль медиального локтя или превышение капа.
  const pain = Number(input.elbowPain ?? 0);
  if (pain >= 3) {
    res.hookRirShift = 1;
    res.notes.push('PRO-5 safety: боль локтя ≥3 — hook RIR+1 + эксцентрик flexor-pronator (Marotta-протокол).');
    res.warnings.push('Медиальный локоть: hook-объём урезан, добавить эксцентрик сгибателей-пронаторов 3×12.');
  }
  // S4: losing-gate — защита + близкий старт = без стресс-синглов.
  if (input.axisCheck?.fightingFromDefense && input.weeksToStart != null && input.weeksToStart <= 2) {
    res.forbidStressSingles = true;
    res.notes.push('PRO-5 safety: защита + старт ≤2 нед — стресс-синглы 100–125% запрещены (только heavy).');
  }
  return res;
}

/** Недельный hook-объём (supinators + wrist_flexors в sup-режиме) против капа. */
export function hookVolumeOf(week: {
  sessions: Array<{ exercises: Array<{ muscle: string; sets: number }> }>;
}): number {
  let s = 0;
  for (const sess of week.sessions)
    for (const ex of sess.exercises)
      if (ex.muscle === 'supinators' || ex.muscle === 'wrist_flexors') s += ex.sets;
  return s;
}

export function checkHookCap(
  weeks: Array<{ week: number; sessions: Array<{ exercises: Array<{ muscle: string; sets: number }> }> }>,
  cap = 12,
): string[] {
  const out: string[] = [];
  for (const wk of weeks) {
    const vol = hookVolumeOf(wk);
    if (vol > cap) out.push(`Н${wk.week}: hook-объём ${vol} > капа ${cap} — flexor-pronator перегруз (Marotta 2026), часть перенести в toproll.`);
  }
  return out;
}

/** Эксцентрик flexor-pronator (Marotta-реабилитация как назначаемый блок, не диагноз). */
export function flexorPronatorEccentric(): { name: string; sets: number; reps: string; tempo: string; note: string } {
  return {
    name: 'Эксцентрик сгибателей-пронаторов (гантель/резина)',
    sets: 3,
    reps: '12',
    tempo: '4-0-1-0',
    note: 'Медленное опускание 4с + пауза; при острой боли — к врачу, не в план.',
  };
}

/**
 * PRO-5 №5: humerus-чеклист хаба → axisCheck/warmupDone моста.
 * Маппинг (документирован, без выдумок):
 * - 'axis' (ось разорвана) → wristElbowShoulderAligned: false;
 * - 'wrist' (запястье позади) → wristBehindShoulder: true;
 * - 'shoulder' (плечо внутрь) → trunkRotatedTowardAttack: true (плечо внутрь ≈ ротация в атаку);
 * - 'warmup' провален → coldNoWarmup: true; пройден → warmupDone: true;
 * - 'elbow' (локоть едет) — прямого флага оси нет, честно не маппим.
 */
export function humerusChecksToAxis(failedIds: string[]): { axisCheck?: Pro5AxisInput; warmupDone?: true } {
  const failed = new Set((failedIds || []).map(String));
  const axisCheck: Pro5AxisInput = {};
  if (failed.has('axis')) axisCheck.wristElbowShoulderAligned = false;
  if (failed.has('wrist')) axisCheck.wristBehindShoulder = true;
  if (failed.has('shoulder')) axisCheck.trunkRotatedTowardAttack = true;
  if (failed.has('warmup')) axisCheck.coldNoWarmup = true;
  const out: { axisCheck?: Pro5AxisInput; warmupDone?: true } = {};
  if (Object.keys(axisCheck).length > 0) out.axisCheck = axisCheck;
  if (!failed.has('warmup')) out.warmupDone = true;
  return out;
}

/** Чтение моста из стора: нет записи → null (неизвестно ≠ сделано). */
export function readHumerusBridge(getItem: (key: string) => string | null): { armAxisCheck?: Pro5AxisInput; armWarmupDone?: true } | null {
  try {
    const raw = getItem('he_arm_humerus_checks');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { failed?: unknown };
    if (!parsed || !Array.isArray(parsed.failed)) return null;
    const mapped = humerusChecksToAxis(parsed.failed as string[]);
    if (!mapped.axisCheck && mapped.warmupDone !== true) return null;
    const out: { armAxisCheck?: Pro5AxisInput; armWarmupDone?: true } = {};
    if (mapped.axisCheck) out.armAxisCheck = mapped.axisCheck;
    if (mapped.warmupDone === true) out.armWarmupDone = true;
    return out;
  } catch {
    return null;
  }
}

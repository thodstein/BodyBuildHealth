/**
 * combat-safety.engine.ts — безопасность единоборств (P3 PRO).
 * teen-гейт 14–15 + concussion-протокол + спарринг-гейты к таперу/ACWR/HRV/шее/травме.
 * Чистые функции; сборка решает errors vs warnings (см. combat-builder).
 * Источники: Frontiers RWL 2025 (запрет сгонок <18), подростки регби 2024
 * (cutoff экстензии 32.1кг / 3.71 N/кг, flex/ext 0.74), BJSM Delphi 2025,
 * Boxing Science / 369MMAFIT fight-week (hard spar за 10–14 дней, дальше technical).
 */

export interface CombatRedFlag {
  id: string;
  label: string;
  /** true = сборка блочится (medical block), false = предупреждение с лимитами */
  blocksBuild: boolean;
}

export interface TeenGates {
  isTeen: boolean;
  /** id упражнений, запрещённых подросткам (динамика шеи/мост/плио/сани) */
  bannedExerciseIds: string[];
  isometricNeckOnly: boolean;
  noHardSpar: boolean;
  noWeightManipulation: boolean;
}

/** Подросток 14–15: изометрия шеи only, без hard spar, без водных/Na/угле-манипуляций и сауны. */
export const TEEN_BANNED_EXERCISES: string[] = [
  'neck_bridge_wrestler',
  'neck_harness_ext',
  'neck_harness_rotation',
  'neck_eccentric_flexion',
  'neck_flexion',
  'neck_lateral_flex',
  'neck_rotation',
  'depth_jump',
  'sled_push',
  'sled_pull',
];

export function teenCombatGates(age: number | null | undefined): TeenGates {
  const isTeen = typeof age === 'number' && Number.isFinite(age) && age <= 15;
  return {
    isTeen,
    bannedExerciseIds: isTeen ? [...TEEN_BANNED_EXERCISES] : [],
    isometricNeckOnly: isTeen,
    noHardSpar: isTeen,
    noWeightManipulation: isTeen,
  };
}

/** Манипуляции весогонки задействованы? (вода-load/Na-срез/угле-слив/сауна) */
export function hasWeightManipulation(proto: {
  waterMode?: string;
  sodiumMode?: string;
  carbMode?: string;
  heatSessions?: boolean;
} | null | undefined): boolean {
  if (!proto) return false;
  return proto.waterMode === 'load_cut'
    || proto.sodiumMode === 'moderate_cut'
    || proto.carbMode === 'deplete_reload'
    || proto.heatSessions === true;
}

/**
 * №4: teen-фолбэк динамики шеи в изометрию той же плоскости.
 * Авто-добавка шеи идёт мимо filterPool — без этого teen получал бы banned-динамику.
 */
const TEEN_NECK_ISO_FALLBACK: Record<string, string> = {
  neck_harness_ext: 'neck_isometric_back',
  neck_bridge_wrestler: 'neck_isometric_back',
  neck_flexion: 'neck_isometric_front',
  neck_eccentric_flexion: 'neck_isometric_front',
  neck_lateral_flex: 'neck_isometric_side',
  neck_rotation: 'neck_band_rotation_isometric',
  neck_harness_rotation: 'neck_band_rotation_isometric',
};

export function teenNeckIsoFallback(id: string): string {
  return TEEN_NECK_ISO_FALLBACK[id] || id;
}

/**
 * Порог экстензии шеи в кг из относительного cutoff 3.71 N/кг (подростки регби 2024):
 * kg = 3.71 × BW / 9.81 ≈ 0.378 × BW (для 80кг ≈ 30кг, рядом с абс. 32.1кг).
 */
export function neckExtensionCutoffKg(bodyweightKg: number | null | undefined): number | null {
  if (typeof bodyweightKg !== 'number' || !Number.isFinite(bodyweightKg) || bodyweightKg <= 30) return null;
  return Math.round(bodyweightKg * 0.378 * 10) / 10;
}

export interface ConcussionProtocol {
  stage: 'clear' | 'limited' | 'blocked';
  maxHardSpar: number;
  neckLevelMin: number;
  flexExtMax: number;
  checklist: string[];
  note: string;
}

/** Concussion-протокол по анамнезу (сотрясения за 12 мес). */
export function concussionProtocol(history: number | null | undefined): ConcussionProtocol {
  const h = typeof history === 'number' && Number.isFinite(history) ? Math.max(0, Math.round(history)) : 0;
  if (h >= 2) {
    return {
      stage: 'blocked',
      maxHardSpar: 0,
      neckLevelMin: 2,
      flexExtMax: 0.74,
      checklist: [
        'Покой до исчезновения симптомов (минимум 7–14 дней)',
        'Лёгкая аэробка → тех-работа без контакта → спарринг только после врача',
        'Шея уровень ≥2 + flex/ext ≤0.74 перед возвратом',
      ],
      note: '≥2 сотрясения за 12 мес — сборка заблокирована до врача (return-протокол)',
    };
  }
  if (h === 1) {
    return {
      stage: 'limited',
      maxHardSpar: 1,
      neckLevelMin: 2,
      flexExtMax: 0.74,
      checklist: [
        'Hard spar ≤1×/нед, только technical сверх того',
        'Шея уровень ≥2, flex/ext ≤0.74',
        'При любом симптоме — стоп и к врачу',
      ],
      note: '1 сотрясение за 12 мес — лимиты: hard spar ≤1×, шея ≥L2',
    };
  }
  return { stage: 'clear', maxHardSpar: 3, neckLevelMin: 1, flexExtMax: 1, checklist: [], note: '' };
}

export interface SparringSafetyCtx {
  isFightWeek: boolean;
  isDeloadWeek: boolean;
  isTaperWeek: boolean;
  acwrZone?: string | null;
  hrvGrade?: string | null;
  neckBelowMev: boolean;
  hasExcludeInjury: boolean;
}

/** Спарринг-гейты (блокирующие). Предупреждения (taper 2нед) — в builder/P1, здесь только errors. */
export function sparringSafetyErrors(
  hardSparSessions: number,
  ctx: SparringSafetyCtx
): string[] {
  const errs: string[] = [];
  const hard = Math.max(0, Math.round(hardSparSessions || 0));
  if (hard <= 0) return errs;
  if (ctx.isFightWeek) errs.push('Hard spar в fight week запрещён — только technical 50%, дриллинг полным объёмом');
  if (ctx.isDeloadWeek) errs.push('Hard spar в делод-неделю запрещён — восстановление (только technical/дриллинг)');
  if (ctx.acwrZone === 'dangerous') errs.push('Hard spar при ACWR dangerous запрещён — делод 40% объёма, RIR+2');
  if (ctx.hrvGrade === 'dangerous') errs.push('Hard spar при HRV dangerous запрещён — недовосстановление (RIR+1, объём −15%)');
  if (ctx.neckBelowMev) errs.push('Hard spar при шее ниже MEV запрещён — сначала шея (Collins: сила шеи = защита)');
  if (ctx.hasExcludeInjury) errs.push('Hard spar при исключающей травме запрещён — только technical/дриллинг до снятия флага');
  return errs;
}

/** Red-flags экран (кардио needsMedicalBlock-прецедент): мед-блок + teen-флаги. */
export function screenCombatRedFlags(input: {
  age?: number | null;
  concussionHistory?: number | null;
  weightCutKg?: number | null;
  bodyweightKg?: number | null;
  manipulation?: boolean;
}): { flags: CombatRedFlag[]; blocked: boolean; text: string } {
  const flags: CombatRedFlag[] = [];
  const teen = teenCombatGates(input.age);
  if (teen.isTeen) {
    flags.push({ id: 'teen', label: 'Подросток 14–15: только изометрия шеи, без hard spar и весогонки-манипуляций', blocksBuild: false });
    if (input.manipulation) flags.push({ id: 'teen_cut', label: 'Подросткам запрещены водные/Na/угле-манипуляции и сауна (только gradual под врачом)', blocksBuild: true });
  }
  const conc = concussionProtocol(input.concussionHistory);
  if (conc.stage === 'blocked') flags.push({ id: 'concussion2', label: `Сотрясения ×${Math.round(input.concussionHistory || 0)} за 12 мес — до врача (return-протокол)`, blocksBuild: true });
  else if (conc.stage === 'limited') flags.push({ id: 'concussion1', label: '1 сотрясение за 12 мес — hard spar ≤1×, шея ≥L2, flex/ext ≤0.74', blocksBuild: false });
  if (typeof input.weightCutKg === 'number' && typeof input.bodyweightKg === 'number' && input.bodyweightKg > 30) {
    const pct = input.weightCutKg / input.bodyweightKg;
    if (pct > 0.08) flags.push({ id: 'cut8', label: `Сгонка ${(pct * 100).toFixed(1)}% >8% — требуется врач`, blocksBuild: true });
  }
  const blocked = flags.some(f => f.blocksBuild);
  const text = flags.length
    ? `${blocked ? '⛔ Мед-блок: ' : '⚠ Флаги безопасности: '}${flags.map(f => f.label).join(' · ')}`
    : 'Флагов безопасности нет';
  return { flags, blocked, text };
}

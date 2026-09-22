/**
 * arm-correction-pro2.engine.ts — ARM-CORRECTIVE-PRO-2: роли, баланс, дриллы, волна, доза v2.
 * Аддитивный слой поверх ARM_CORRECTIONS / doseForCause / rankCorrectionsForArm.
 * Без новых id каталога: все ids проверены в exercise-catalog-arm.ts.
 * Чистые функции, без мутаций и storage.
 *
 * Источники доз/ролей:
 * - GoldenGrip 2025 (15 best exercises: cup/pron/rising/side цепочка, 4×6–8 heavy + 2×15 pump)
 * - Armwrestling Praxis top-3 (cup / pronation-hold / rise-radial)
 * - ArmwrestlingPros pronation (изоляция 8–20×3–4 + статика max-pronated 8–25с + low-cable 45°)
 * - StrengthLog 8-week (Phase1 RPE 7–8 → Phase2 RPE 8–9, спец-объём растёт)
 * - GripStrength 12-week Table-Ready (high-rep база → heavy + side-изо → speed + pin-holds, делод −40%)
 * - Devon Larratt 2024–2025 (high/low pronation + cupping + back pressure, 17–18 singles, table-first)
 */
import type { ArmWeakPoint } from './arm-biomechanics.engine';
import { ARM_CORRECTIONS } from './arm-weakpoint-corrections';
import { doseForCause, type ArmDose } from './arm-correction-dose.engine';
import type { ArmWeakCause } from './arm-weak-cause.engine';

export type CorrectionRole = 'heavy' | 'static' | 'pulse' | 'iso' | 'table' | 'pump';

export const CORRECTION_ROLE_RU: Record<CorrectionRole, string> = {
  heavy: 'тяжёлая',
  static: 'статика-lock',
  pulse: 'пульсы (сухожилие)',
  iso: 'изоляция',
  table: 'стол-ремень',
  pump: 'памп/кровоток',
};

/**
 * Роль каждого упражнения пулов §3.1 + C1-добавки.
 * Порядок ARM_CORRECTIONS не меняется — роль только подписывает существующий id.
 */
export const CORRECTION_ROLE: Record<string, CorrectionRole> = {
  // cup
  wrist_curl_belt: 'table',
  cup_to_little: 'iso',
  wrist_curl_bb: 'heavy',
  wrist_roller: 'pump',
  wrist_curl_db: 'iso',
  wrist_curl_behind: 'heavy',
  cup_to_thumb: 'iso',
  riser_lift: 'static',
  // rising
  finger_containment_band: 'iso',
  plate_pinch_hold: 'static',
  radial_dev_heavy: 'heavy',
  ulnar_dev_heavy: 'heavy',
  radial_dev: 'iso',
  // pronation
  pronation_cable: 'heavy',
  pronation_sledge: 'heavy',
  pronation_strap: 'table',
  indian_clubs: 'pump',
  pron_high_strap: 'static',
  sledge_choke: 'static',
  lever_top: 'static',
  pronation_pulses: 'pulse',
  // supination / hook
  supination_cable: 'heavy',
  supination_hammer: 'iso',
  hammer_curl_thick: 'heavy',
  sup_high_strap: 'static',
  hook_drag_cable: 'table',
  hammer_belt: 'table',
  reverse_ez_curl: 'pump',
  preacher_hammer: 'iso',
  // side (только безопасные роли: статика/ремень/манжета)
  side_press_cable: 'heavy',
  side_belt_table: 'table',
  side_press_table: 'static',
  table_pushdown_iso: 'static',
  internal_rotation_band: 'iso',
  // back
  lat_drag_belt: 'table',
  row_strap_hip: 'heavy',
  landmine_row_under: 'heavy',
  anti_rotation_hold: 'static',
  towel_pullup: 'heavy',
  hammer_rope_cable: 'pump',
  // fingers / pinch
  hub_pinch: 'static',
  rolling_thunder: 'heavy',
  apollon_axle: 'heavy',
  coc_gripper: 'iso',
  coc_no1: 'iso',
  little_big_horn: 'static',
  pinch_block_80: 'static',
  // профилактика (не пулы точек)
  wrist_ext_bb: 'pump',
  external_rotation_band: 'iso',
};

export function roleOf(exId: string): CorrectionRole | null {
  return CORRECTION_ROLE[String(exId)] ?? null;
}

export function roleLabel(exId: string): string {
  const r = roleOf(exId);
  return r ? CORRECTION_ROLE_RU[r] : '—';
}

/**
 * C1-добавки в пулы (все ids — из каталога, проверено чтением exercise-catalog-arm.ts).
 * Не мутируют ARM_CORRECTIONS: порядок базы цел, добавки идут хвостом.
 */
export const POOL_TOPUP: Partial<Record<ArmWeakPoint, string[]>> = {
  cup_start: ['wrist_curl_db'],
  cup_hold: ['wrist_curl_db'],
  rising_top: ['pinch_block_80'],
  pron_open: ['pronation_pulses', 'lever_top'],
  pron_lock: ['pronation_pulses', 'pronation_sledge'],
  sup_cup: ['reverse_ez_curl', 'indian_clubs'],
  sup_drag: ['reverse_ez_curl'],
  side_mid: ['anti_rotation_hold'],
  side_pin: ['anti_rotation_hold'],
  back_start: ['towel_pullup', 'hammer_rope_cable'],
  back_drag: ['towel_pullup'],
  contain_fingers: ['pinch_block_80'],
};

export function poolWithTopup(wp: ArmWeakPoint): string[] {
  const base = ARM_CORRECTIONS[wp]?.exercises || [];
  const add = POOL_TOPUP[wp] || [];
  return [...base, ...add.filter((id) => !base.includes(id))];
}

/**
 * C5: антагонист-профилактика точки (1 строка, без сетов — не трогает бюджет).
 * cup → экстензоры; pron → sup-пульсы; side → манжета; back → антиротация уже в пуле.
 */
export const ANTAGONIST_FOR: Record<ArmWeakPoint, { id: string; label: string }> = {
  cup_start: { id: 'wrist_ext_bb', label: 'Антагонист: разгибатели 2×15–20 (tennis elbow)' },
  cup_hold: { id: 'wrist_ext_bb', label: 'Антагонист: разгибатели 2×15–20 (tennis elbow)' },
  rising_top: { id: 'wrist_ext_bb', label: 'Антагонист: разгибатели 2×15 (баланс flex/ext)' },
  pron_open: { id: 'indian_clubs', label: 'Антагонист: супинация лёгкая 2×12 (баланс ротации)' },
  pron_lock: { id: 'indian_clubs', label: 'Антагонист: супинация лёгкая 2×12 (баланс ротации)' },
  sup_cup: { id: 'pronation_pulses', label: 'Антагонист: пронация-пульсы 2×15 (баланс ротации)' },
  sup_drag: { id: 'pronation_pulses', label: 'Антагонист: пронация-пульсы 2×15 (баланс ротации)' },
  side_mid: { id: 'external_rotation_band', label: 'Антагонист: наружная ротация 2×15 (манжета)' },
  side_pin: { id: 'external_rotation_band', label: 'Антагонист: наружная ротация 2×15 (манжета)' },
  back_start: { id: 'anti_rotation_hold', label: 'Якорь: антиротация уже в пуле — держать корпус квадрат' },
  back_drag: { id: 'anti_rotation_hold', label: 'Якорь: антиротация уже в пуле — держать корпус квадрат' },
  contain_fingers: { id: 'wrist_ext_bb', label: 'Антагонист: экстензоры-раскрытия 2×20–25 (перегруз сгибателей)' },
};

export function preventiveFor(wp: ArmWeakPoint): { id: string; label: string } | null {
  return ANTAGONIST_FOR[wp] ?? null;
}

export interface TableDrill {
  id: string;
  label: string;
  dose: string;
  phases: string[];
}

/**
 * C6: table-time дриллы (не gym-упражнения): реакция/ремень/короткие схватки не в отказ.
 * Источники: StrengthLog table 20–30 мин; GripStrength спарринги 3–5×10–15с; Larratt table-first.
 */
export const TABLE_DRILLS: TableDrill[] = [
  { id: 'drill_reaction_go', label: 'Реакция на Go (партнёр/таймер)', dose: '5× старт, не в отказ', phases: ['setup', 'start'] },
  { id: 'drill_strap_hold', label: 'Удержания в ремне 10с (своя слабая фаза)', dose: '10×10с, отдых 60–90с', phases: ['start', 'mid'] },
  { id: 'drill_short_pull', label: 'Короткие схватки 10–15с (сброс хвата между)', dose: '3–5 раундов, не в отказ', phases: ['mid', 'pin'] },
];

export function drillsForPhase(phase: string | null | undefined): TableDrill[] {
  const p = String(phase || '').toLowerCase();
  if (!p) return TABLE_DRILLS;
  return TABLE_DRILLS.filter((d) => d.phases.includes(p));
}

export interface WaveStep {
  setsDelta: number;
  intensityDeltaPct: number;
  note: string;
}

/**
 * C4: 3-нед волна коррекции (GripStrength-де lod −40% + StrengthLog RPE-лестница).
 * Н1 база/техника → Н2 объём (+1 сет) → Н3 делод (−1 сет, изометрия).
 * Чистая функция; инъекция применяет только setsDelta (интенсивность — строкой).
 */
export function correctiveWaveForWeek(week1based: number): WaveStep {
  const w = ((Math.max(1, Math.round(week1based)) - 1) % 3) + 1;
  if (w === 2) return { setsDelta: 1, intensityDeltaPct: 0, note: 'Н2: объём +1 сет @65–70%' };
  if (w === 3) return { setsDelta: -1, intensityDeltaPct: -5, note: 'Н3: делод −1 сет, изометрия' };
  return { setsDelta: 0, intensityDeltaPct: 0, note: 'Н1: техника 8–12 @60–65%' };
}

export function waveSetsFor(baseSets: number, week1based: number | null | undefined): number {
  if (week1based == null) return baseSets;
  const st = correctiveWaveForWeek(week1based);
  return Math.max(2, baseSets + st.setsDelta);
}

export interface DoseV2Opts {
  level?: string | null;
  /** Перегруз сухожилий (tendon ACWR danger/caution или боль ≥4): только пульсы/изо. */
  tendonOverload?: boolean;
  /** 50+: делодная доза по умолчанию. */
  age50plus?: boolean;
}

/**
 * D3: единое условие «доза v2 vs база» для инъекции и симулятора.
 * v2 включается только когда меняет результат: флаги tendon/50+,
 * side-guard при strength-причине, beginner-гард при известной причине.
 * Иначе база 1-в-1 (паритет Δ = факт инъекции).
 */
export function shouldUseDoseV2(
  cause: ArmWeakCause | null | undefined,
  level: string | null | undefined,
  opts: { tendonOverload?: boolean; age50plus?: boolean },
): boolean {
  if (opts.tendonOverload || opts.age50plus) return true;
  if (cause === 'strength') return true;
  if (String(level || '').toLowerCase() === 'beginner' && cause) return true;
  return false;
}

/**
 * C3: доза v2 = база doseForCause + гарды уровня/tendon/side/возраста.
 * Без opts — байт-в-байт с doseForCause (старые тесты целы).
 * - side_* + cause strength → НЕ 5×5 (humerus): 3×6 статика ремнём.
 * - tendonOverload → 2 сета, пульсы/high-rep, RIR≥3, −5п.п.
 * - beginner → RIR≥3, −5п.п. (не в отказ; rising/side деликатные).
 * - age50plus → −1 сет (мин 2), RIR+1.
 */
export function doseForCauseV2(
  wp: ArmWeakPoint,
  cause: ArmWeakCause | null | undefined,
  opts: DoseV2Opts = {},
): ArmDose | null {
  const base = doseForCause(wp, cause);
  if (!base) return null;
  const isSide = wp === 'side_mid' || wp === 'side_pin';
  // side-guard: сила чинится статикой, а не 5×5 (спиральный перелом humerus — PMC 10315927)
  if (isSide && cause === 'strength') {
    return {
      sets: 3,
      reps: [6, 6],
      rir: 3,
      intensityPct: 0.6,
      holdSeconds: 10,
      tempo: '3-1-1-0',
      adjusted: true,
      note: 'strength-side: статика ремнём 3×6, без 5×5 (humerus)',
    };
  }
  if (!opts.level && !opts.tendonOverload && !opts.age50plus) return base;
  if (opts.tendonOverload) {
    return {
      sets: 2,
      reps: [base.reps[0], Math.max(base.reps[1], 15)],
      rir: Math.max(base.rir, 3),
      intensityPct: Math.max(0.5, Math.round((base.intensityPct - 0.05) * 100) / 100),
      ...(base.holdSeconds != null ? { holdSeconds: base.holdSeconds } : {}),
      ...(base.tempo ? { tempo: base.tempo } : {}),
      adjusted: true,
      note: 'tendon: пульсы/high-rep 2 сета, RIR≥3, −5п.п.',
    };
  }
  const level = String(opts.level || '').toLowerCase();
  if (level === 'beginner') {
    return {
      ...base,
      rir: Math.max(base.rir, 3),
      intensityPct: Math.max(0.5, Math.round((base.intensityPct - 0.05) * 100) / 100),
      adjusted: true,
      note: (base.note ? base.note + ' · ' : '') + 'beginner: RIR≥3, −5п.п.',
    };
  }
  if (opts.age50plus) {
    return {
      ...base,
      sets: Math.max(2, base.sets - 1),
      rir: Math.min(4, base.rir + 1),
      adjusted: true,
      note: (base.note ? base.note + ' · ' : '') + '50+: −1 сет, RIR+1',
    };
  }
  return base;
}

/** Строка дозы с ролью топ-1 + профилактикой — для моста/печати (всё через esc у потребителя). */
export function correctiveDetailLine(wp: ArmWeakPoint, cause: ArmWeakCause | null | undefined, topId?: string | null): string {
  const d = doseForCause(wp, cause);
  const top = topId || ARM_CORRECTIONS[wp]?.exercises[0] || '';
  const role = top ? roleLabel(top) : '';
  const prev = preventiveFor(wp);
  let s = `${wp}: ${top}${role !== '—' ? ` (${role})` : ''}`;
  if (d) s += ` ${d.sets}×${d.reps[0]}–${d.reps[1]} @${Math.round(d.intensityPct * 100)}% RIR ${d.rir}`;
  if (prev) s += ` + ${prev.id} (профилактика)`;
  return s;
}

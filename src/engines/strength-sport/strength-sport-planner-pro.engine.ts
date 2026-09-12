/**
 * strength-sport-planner-pro.engine.ts — PRO-планировщик стронгмена P1–P7 (чистые функции).
 * Источники: MyStrengthBook 2026 (RPE-cap/weight-class/check-ins), Torokhtiy 10w (toro4 taper 65%),
 * Winwood 2014 + Sports Medicine syst.review 2026 (cessation М/Ж), PMC8237209 (mixed-механизм),
 * BarBend/FitnessVolt log-press, Rogerson 2024 (делод≠тапер).
 * Без localStorage внутри чистых функций; персист — отдельными хелперами с try/catch.
 */

// ——— P1: весовая категория ———
export type SmSex = 'male' | 'female';
export interface SmWeightClass { id: string; label: string; capKg: number | null }

export const SM_WEIGHT_CLASSES_M: SmWeightClass[] = [
  { id: '<80', label: 'до 80', capKg: 80 },
  { id: '<90', label: 'до 90', capKg: 90 },
  { id: '<105', label: 'до 105', capKg: 105 },
  { id: '105+', label: '105+', capKg: null },
  { id: 'open', label: 'Open', capKg: null },
];
export const SM_WEIGHT_CLASSES_F: SmWeightClass[] = [
  { id: '<55', label: 'до 55', capKg: 55 },
  { id: '<65', label: 'до 65', capKg: 65 },
  { id: '<75', label: 'до 75', capKg: 75 },
  { id: '75+', label: '75+', capKg: null },
  { id: 'open', label: 'Open', capKg: null },
];

export function smWeightClassesFor(sex: SmSex): SmWeightClass[] {
  return sex === 'female' ? SM_WEIGHT_CLASSES_F : SM_WEIGHT_CLASSES_M;
}

/** Дефолтный класс по весу: первый кап, в который влезает вес; иначе первый открытый (105+/75+, не open). */
export function weightClassFor(bodyweightKg: number, sex: SmSex): string {
  const list = smWeightClassesFor(sex);
  const bw = Number(bodyweightKg) || 0;
  for (const c of list) {
    if (c.capKg != null && bw <= c.capKg) return c.id;
  }
  return list.find((c) => c.capKg == null)?.id || 'open';
}

/** Сколько кг до границы класса (0 — впритык/вне; null — у открытого класса границы нет). */
export function weightToClassBoundary(bodyweightKg: number, cls: string, sex: SmSex): number | null {
  const c = smWeightClassesFor(sex).find((x) => x.id === cls);
  if (!c || c.capKg == null) return null;
  const diff = Math.round((c.capKg - (Number(bodyweightKg) || 0)) * 10) / 10;
  return diff;
}

export function weightClassLine(bodyweightKg: number, cls: string, sex: SmSex): string {
  const to = weightToClassBoundary(bodyweightKg, cls, sex);
  if (to == null) return `Класс ${cls} · открытая категория`;
  if (to < 0) return `Класс ${cls} · перевес ${Math.abs(to)} кг — сгонка или класс выше`;
  if (to === 0) return `Класс ${cls} · впритык к границе`;
  return `Класс ${cls} · до границы −${to} кг`;
}

// ——— P2: RPE-cap топ-сингла ———
export const RPE_CAP_DEFAULT = 9.5;
export const RPE_CAP_OPTIONS = [8.5, 9, 9.5, 10];

export function applyRpeCap(weightKg: number, rpe: number, cap: number): { weight: number; cut: boolean } {
  const w = Number(weightKg) || 0;
  const c = Number(cap);
  if (!Number.isFinite(c) || rpe < c) return { weight: w, cut: false };
  return { weight: Math.round((w * 0.975) / 2.5) * 2.5, cut: true };
}

// ——— P3: безопасность хвата ———
export type DeadliftGrip = 'overhand' | 'straps' | 'mixed';

export function deadliftGripWarning(grip: DeadliftGrip | string, pct01: number): string | null {
  if (grip !== 'mixed') return null;
  if (!(pct01 >= 0.85)) return null;
  return 'Разнохват ≥85%: 100% разрывов дистального бицепса — супинированная рука (PMC8237209) → hook/лямки';
}

export const STONE_ARMS_CUE = 'руки-канаты, локти прямые';
export const VIKING_GATE_NOTE = 'без двойного сгибания колен (no-rep)';

export function isStoneId(id: string): boolean {
  return ['atlas_stone_load', 'atlas_stone_over_bar', 'natural_stone_shoulder', 'stone_lift', 'sandbag_shoulder', 'sandbag_load', 'sandbag_over_bar', 'keg_toss', 'keg_over_bar', 'keg_load'].includes(String(id));
}
export function isDeadliftId(id: string): boolean {
  const s = String(id).toLowerCase();
  return s.includes('deadlift') || s === 'sumo_dl' || s === 'axle_deadlift' || s === 'car_deadlift_18' || s === 'car_deadlift_side' || s === 'deadlift_max';
}

// ——— P4: чекины недели ———
export interface SsCheckin { eventFatigue: number; grip: number; back: number; sleep: number; appetite: number }
export const SS_CHECKIN_KEY = 'he_ss_checkin_v1';
export const SS_CHECKIN_CAP = 12;

export function scoreCheckin(c: SsCheckin): { score: number; suggestDeload: boolean } {
  const vals = [c.eventFatigue, c.grip, c.back, c.sleep, c.appetite].map((v) => Math.max(1, Math.min(5, Number(v) || 1)));
  const score = Math.round(((vals[0] + vals[1] + vals[2] + vals[3] + vals[4]) / 5) * 10) / 10;
  return { score, suggestDeload: score <= 2 };
}

export function pushCheckin(list: Array<SsCheckin & { date: string }>, c: SsCheckin, dateISO?: string): Array<SsCheckin & { date: string }> {
  const next = [...(Array.isArray(list) ? list : []), { ...c, date: dateISO || new Date().toISOString().slice(0, 10) }];
  return next.slice(-SS_CHECKIN_CAP);
}

export function loadCheckins(): Array<SsCheckin & { date: string }> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SS_CHECKIN_KEY) : null;
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => x && typeof x === 'object').slice(-SS_CHECKIN_CAP) : [];
  } catch { return []; }
}
export function saveCheckins(list: Array<SsCheckin & { date: string }>): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SS_CHECKIN_KEY, JSON.stringify(list.slice(-SS_CHECKIN_CAP)));
  } catch { /* quota — тихо */ }
}

// ——— P5: block-модель + делод ———
export type SsBlockModel = 'strong5' | 'toro4' | 'wave';
export const SS_BLOCK_MODELS: Array<{ id: SsBlockModel; label: string; desc: string }> = [
  { id: 'strong5', label: 'Strong 5-фаз', desc: 'наш дефолт GPP/Str/Integ/Peak/Taper' },
  { id: 'toro4', label: 'Torokhtiy 4-фаз', desc: '3/3/3/1 + тапер 65% (нед.10)' },
  { id: 'wave', label: 'Wave/DUP', desc: 'волна heavy/medium/light по неделям' },
];
// taperMultForWeek — канон в strength-sport-taper.engine.ts (дубль здесь удалён, P6).

export function deloadWeeksFor(totalWeeks: number, autoDeload: boolean): number[] {
  if (autoDeload === false) return [];
  const cand = [4, 7, 11];
  return cand.filter((w) => w < totalWeeks && w >= 4);
}

export const DELOAD_VS_TAPER_NOTE = 'Делод (нед 4/7/11) — плановый сброс внутри цикла; тапер — острый пик к дате старта (Rogerson 2024)';
// waveForWeek удалён: волна считается внутри applyDUP (strength-sport-dup.ts, idx%3),
// отдельный хелпер с другой индексацией врал бы. P6.

// ——— P6: гигиена входов ———
/** Stale-VBT: смена цикла/режима инвалидирует замеры week-day-ex-set. */
export function shouldClearVbt(prevCycleId: string, nextCycleId: string, prevMode: string, nextMode: string): boolean {
  return prevCycleId !== nextCycleId || prevMode !== nextMode;
}

export function progHashOf(p: Record<string, unknown>): string {
  return JSON.stringify(p);
}

// ——— P7: половой cessation + opener ———
/** Дни cessation с половой поправкой (syst.review 2026: М 4.5 / Ж 3.9). Без пола — база, байт-в-байт. */
export function cessationDaysFor(baseDays: number, sex?: SmSex | string): number {
  const b = Number(baseDays) || 5;
  if (sex === 'male') return b + 1;
  return b;
}

export const OPENER_SINGLE_NOTE = 'Opener 90% 1×1 — репетиция старта (последняя неделя)';

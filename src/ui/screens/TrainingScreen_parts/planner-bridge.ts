/** planner-bridge.ts — канал «калькулятор → планировщик»: калькуляторы пишут
 * корректировку/рекомендацию, планировщик (ПЛ/ББ/ручной) читает и применяет.
 * localStorage + CustomEvent, без дублей состояния.
 *
 * Поддерживаемые kind:
 *  - split     : { cycle: string[][], name }                       — структура дней (группы мышц)
 *  - pm        : { squat?, bench?, dead?, lift?, value? }          — предельные максимумы (все или один)
 *  - weakpoints: { groups: string[], lift?, plWeakPoints?, diagnosticExerciseMap?, diagnosticDayMap?, weakGroupExerciseMap?, weakGroupDayMap? } — слабые группы + диагностика движения (карточка «Слабые мышцы → Слабые точки → Мёртвые точки → Движение штанги»)
 *  - pri       : { volumeMult, rirShift }                          — готовность → объём/RIR
 *  - tempo     : { eccentric, bottomPause, concentric, topPause, label } — темп повторений
 *  - rir       : { rirShift, label }                               — корректировка RIR
 *  - mrv       : { mrv: number, label }                            — индивидуальный MRV (сет/м/нед)
 *  - deload    : { volumeMult, rirShift, weeks: number[], label }  — делод-недели
 *  - volume    : { sets: Record<string, number>, label }           — целевой объём по группам
 *  - peak      : { volumeMult, rirTarget, label }                   — пиковая неделя (объём ↓, RIR→target)
 *  - methodology: { methodName, category }                          — набор методик (из библиотеки)
 *  - program   : { cycleId }                                       — программа/цикл целиком (заменяет)
 *  - design    : { design: MacrocycleDesign, fillExercises?, daysPerWeek?, level?, goal? } — применить дизайн периодизации к новой/текущей программе
 *  - macrocycle: { macro: Macrocycle, level?, goal?, daysPerWeek? } — применить макроцикл ПЛ-авто как ББ-программу
 *  - cardio    : { cycleId?, cycle? } — подключить CardioCycle к силовому плану (ссылка, не копия)
 *  - annual_block: { blockKey, program? } — блок годового плана: загрузить в редактор;
 *                  при сохранении программы изменения возвращаются в блок (he_annual_block_pending)
 */
const KEY = 'he_planner_apply';
type Listener = (payload: PlannerApply | null) => void;

export type PlannerApplyKind = 'split' | 'pri' | 'weakpoints' | 'pm' | 'tempo' | 'rir' | 'mrv' | 'deload' | 'volume' | 'peak' | 'methodology' | 'program' | 'design' | 'macrocycle' | 'cardio' | 'annual_block' | 'limiter';

export interface SplitPayload { cycle: string[][]; name?: string }
export interface PmPayload { squat?: number; bench?: number; dead?: number; lift?: string; value?: number }
export interface WeakpointsPayload { groups?: string[]; lift?: string; orthopedic?: unknown; currentPain?: string[]; diagnosticExerciseMap?: Record<string, string[]>; diagnosticDayMap?: Record<string, number[]>; plWeakPoints?: { lift: string; weakPoint: string; days?: number[] }[]; weakGroupExerciseMap?: Record<string, string[]>; weakGroupDayMap?: Record<string, number[]> }
export interface PriPayload { volumeMult: number; rirShift: number }
export interface TempoPayload { eccentric: number; bottomPause?: number; concentric: number; topPause?: number; label?: string }
export interface RirPayload { rirShift: number; label?: string }
export interface MrvPayload { mrv: number; label?: string }
export interface DeloadPayload { volumeMult: number; rirShift: number; weeks: number[]; label?: string }
export interface VolumePayload { sets: Record<string, number>; label?: string }
export interface PeakPayload { volumeMult?: number; rirTarget?: number; label?: string; weeks?: unknown; protocol?: unknown; peakCycleId?: string }
export interface MethodologyPayload { methodName: string; category?: string }
export interface ProgramPayload { cycleId?: string; [key: string]: unknown }
export interface DesignPayload { design: unknown; fillExercises?: boolean; daysPerWeek?: number; level?: string; goal?: string }
export interface MacrocyclePayload { macro: unknown; level?: string; goal?: string; daysPerWeek?: number }
export interface CardioPayload { cycleId?: string; cycle?: unknown }
export interface AnnualBlockPayload { blockKey: string; program?: unknown }

/** Калькулятор «Лимитирующие факторы движения»: выбранные упражнения + категорийные протоколы.
 *  key = `${lift}|${category}|${optionId}`. Протокол — из опции (не из раскладки цикла). */
export interface LimiterProtocolShape { sets: number; reps: number; pct: number; rir: number; tempo?: string; rest?: string; holdSec?: number; note?: string }
export interface LimiterPayload {
  limiterExerciseMap?: Record<string, string[]>;
  limiterProtocolMap?: Record<string, { protocol: LimiterProtocolShape; category: string }>;
  limiterDayMap?: Record<string, number[]>;
}

export type PlannerApplyData = SplitPayload | PmPayload | WeakpointsPayload | PriPayload | TempoPayload | RirPayload | MrvPayload | DeloadPayload | VolumePayload | PeakPayload | MethodologyPayload | ProgramPayload | DesignPayload | MacrocyclePayload | CardioPayload | AnnualBlockPayload | LimiterPayload;

/** Типобезопасная карта данных для публичного канала. */
export interface PlannerApplyDataByKind {
  split: SplitPayload;
  pm: PmPayload;
  weakpoints: WeakpointsPayload;
  pri: PriPayload;
  tempo: TempoPayload;
  rir: RirPayload;
  mrv: MrvPayload;
  deload: DeloadPayload;
  volume: VolumePayload & Record<string, unknown>;
  peak: PeakPayload;
  methodology: MethodologyPayload;
  // Program bridge accepts both a cycle id and a full legacy cycle template.
  program: ProgramPayload;
  design: DesignPayload;
  macrocycle: MacrocyclePayload;
  cardio: CardioPayload;
  annual_block: AnnualBlockPayload;
  limiter: LimiterPayload;
}

export interface PlannerApply {
  kind: PlannerApplyKind;
  label: string;
  /** Discriminated payload; narrow via `kind` and cast: `(p.data as PmPayload).lift`.
   *  Kept as `any` for backward-compat with existing consumers — see payload interfaces above. */
  data: any;
  ts: number;
}

export function getPlannerApply(): PlannerApply | null {
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v; } catch { return null; }
}

export function applyToPlanner<K extends PlannerApplyKind>(p: {
  kind: K;
  label: string;
  data: PlannerApplyDataByKind[K];
}): void {
  const payload: PlannerApply = { ...p, ts: Date.now() };
  try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('planner-apply', { detail: payload }));
}

export function clearPlannerApply(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('planner-apply', { detail: null }));
}

export function subscribePlannerApply(cb: Listener): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail ?? getPlannerApply());
  window.addEventListener('planner-apply', handler);
  return () => window.removeEventListener('planner-apply', handler);
}

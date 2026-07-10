/** planner-bridge.ts — канал «калькулятор → планировщик»: калькуляторы пишут
 * корректировку/рекомендацию, планировщик (ПЛ/ББ/ручной) читает и применяет.
 * localStorage + CustomEvent, без дублей состояния.
 *
 * Поддерживаемые kind:
 *  - split     : { cycle: string[][], name }                       — структура дней (группы мышц)
 *  - pm        : { squat?, bench?, dead?, lift?, value? }          — предельные максимумы (все или один)
 *  - weakpoints: { groups: string[], lift? }                      — слабые группы для приоритета
 *  - pri       : { volumeMult, rirShift }                          — готовность → объём/RIR
 *  - tempo     : { eccentric, bottomPause, concentric, topPause, label } — темп повторений
 *  - rir       : { rirShift, label }                               — корректировка RIR
 *  - mrv       : { mrv: number, label }                            — индивидуальный MRV (сет/м/нед)
 *  - deload    : { volumeMult, rirShift, weeks: number[], label }  — делод-недели
 *  - volume    : { sets: Record<string, number>, label }           — целевой объём по группам
 *  - peak      : { volumeMult, rirTarget, label }                   — пиковая неделя (объём ↓, RIR→target)
 *  - methodology: { methodName, category }                          — набор методик (из библиотеки)
 */
const KEY = 'he_planner_apply';
type Listener = (payload: PlannerApply | null) => void;

export type PlannerApplyKind = 'split' | 'pri' | 'weakpoints' | 'pm' | 'tempo' | 'rir' | 'mrv' | 'deload' | 'volume' | 'peak' | 'methodology';

export interface PlannerApply {
  kind: PlannerApplyKind;
  label: string;        // человеко-читаемое описание
  data: any;            // специфичные данные (см. kind-комментарии выше)
  ts: number;
}

export function getPlannerApply(): PlannerApply | null {
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v; } catch { return null; }
}

export function applyToPlanner(p: Omit<PlannerApply, 'ts'>): void {
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
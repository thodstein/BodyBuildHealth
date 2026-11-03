/**
 * bb-plan-snapshot.engine.ts — ЕДИНАЯ точка «снимков факта плана».
 *
 * Зачем. План несёт производные объекты, которые читают отчёт, печать, CSV,
 * карточки качества и UI: `weeklyVolume`, `validation`, `balanceReport`,
 * `fatigueReport`, `expandedSummary`, `report` + текст `rationale`
 * («Частота на группу/нед», «⚠ Валидация: …»). Каждый из них — ОБЕЩАНИЕ
 * пользователю: «в неделе 1 у спины 12.5 эффективных сетов», «план валиден»,
 * «итого 84 рабочих сета/нед».
 *
 * Проблема была в том, что снимки делались в одном месте (конец `finalizeBBPlan`)
 * и НЕ пересчитывались после последующих изменений плана:
 *  - билдер после финализатора делает ещё ~15 проходов (rehab-возврат, VBT,
 *    RIR-волна, схемы интенсивности, BFR, blast/cruise, рампа) — замер
 *    192 плана: weeklyVolume расходился в 191/192, в 20 планах validation
 *    хранил ошибки, которых в итоговом плане нет;
 *  - UI-правки (`revalidateEditedPlan`: finalize + prioritizeBackSessions +
 *    рампа) — замер 12 планов: expandedSummary расходился в 9/12;
 *  - внутри самого финализатора `fatigueReport`/`expandedSummary` снимались до
 *    поздних проходов (рампа, доводка PPL, финальный трим).
 *
 * Правило: любой, кто изменил состав/сеты плана, вызывает
 * `refreshBBPlanSnapshots` последним. Отчёт собирается ВНУТРИ последним, иначе
 * он скопирует устаревшие цифры.
 *
 * Модуль листовой (импортирует только движки, у которых из builder — лишь
 * `import type`), поэтому его можно звать и из билдера, и из финализатора, и из
 * UI без циклов.
 */
import { aggregateBBVolume } from './bb-volume.engine';
import { validateBBPlan } from './bb-validator.engine';
import { analyzeBBBalance } from './bb-balance.engine';
import { estimateBBSessionCost } from './bb-fatigue.engine';
import { buildBBPlanReport } from './bb-report.engine';
import { buildBBExpandedSummary } from './bb-summary.engine';
import {
  applyFrequencyDriftNote,
  frequencyDriftNote,
  reconcileFrequencyClaim,
} from './bb-frequency';

export interface BBPlanSnapshotOptions {
  /** Опции валидатора. Без них `plan.validation` не пересчитывается (остаётся как есть). */
  validationOptions?: Record<string, unknown>;
  /** Приоритетные/спец-мышцы для баланса; по умолчанию `plan.priorityMuscles`. */
  specTargets?: string[];
  /** Канонизация алиасов мышц (`chest_upper` → `chest`). Нужна для сверки частоты. */
  canonicalMuscle?: (muscle: string) => string;
  /** Пересчитать строку «Частота на группу/нед (факт)» и заметку о расхождении. */
  refreshFrequency?: boolean;
  /** Пересобрать строки «⚠ Валидация: …» в rationale (иначе они описывают старое состояние). */
  refreshValidationRationale?: boolean;
}

const VALIDATION_LINE_PREFIX = '⚠ Валидация:';
/** Коды, которые на промежуточной стадии ожидаемы и снимаются финализатором. */
const TRANSIENT_VALIDATION_CODES = new Set(['target_volume_deficit', 'effective_mrv_overflow']);

/**
 * Пересчитывает все производные объекты плана по его текущему содержимому.
 * Идемпотентна: повторный вызов на неизменённом плане даёт те же значения.
 */
export function refreshBBPlanSnapshots(plan: any, opts: BBPlanSnapshotOptions = {}): void {
  if (!plan || !Array.isArray(plan.weeks)) return;

  plan.weeklyVolume = Object.fromEntries(
    plan.weeks.map((week: any) => [week.week, aggregateBBVolume(week.sessions || [])]),
  );

  if (opts.validationOptions) {
    plan.validation = validateBBPlan(plan, opts.validationOptions as any);
  }

  plan.balanceReport = analyzeBBBalance(plan, { specTargets: opts.specTargets ?? plan.priorityMuscles ?? [] });
  plan.fatigueReport = plan.weeks.map((week: any) => ({
    week: week.week,
    sessions: (week.sessions || []).map((session: any) => estimateBBSessionCost(session)),
  }));
  plan.expandedSummary = buildBBExpandedSummary(plan);

  if (opts.refreshFrequency && opts.canonicalMuscle) {
    const freq = reconcileFrequencyClaim(plan, { canonical: opts.canonicalMuscle });
    applyFrequencyDriftNote(plan, frequencyDriftNote(freq));
  }

  if (opts.refreshValidationRationale && plan.validation) {
    const fresh = ((plan.validation.issues || []) as any[])
      .filter((issue) => issue.level === 'warning')
      .filter((issue) => !TRANSIENT_VALIDATION_CODES.has(String(issue.code)))
      .slice(0, 20)
      .map((issue) => `${VALIDATION_LINE_PREFIX} ${issue.message}`);
    const rationale: string[] = (Array.isArray(plan.rationale) ? plan.rationale : [])
      .filter((line: string) => !String(line).startsWith(VALIDATION_LINE_PREFIX));
    for (const line of fresh) if (!rationale.includes(line)) rationale.push(line);
    plan.rationale = rationale;
  }

  // Отчёт — ПОСЛЕДНИМ: он копирует в себя weeklyVolume/validation/balanceReport/
  // expandedSummary и текст rationale.
  plan.report = buildBBPlanReport(plan);
}

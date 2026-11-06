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
import { analyzeBBRotation } from './bb-rotation.engine';
import { backQualityIssues, armQualityIssues } from './bb-back-quality.engine';
import { analyzePlanStress } from './bb-injury-prevention.engine';
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
  /** Пересобрать строки «⚠ Ротация: …» в rationale (иначе описывают до-финальный состав). */
  refreshRotationRationale?: boolean;
}

const VALIDATION_LINE_PREFIX = '⚠ Валидация:';
const ROTATION_LINE_PREFIX = '⚠ Ротация:';
const BACK_SUMMARY_PREFIX = '🧩 Спина по паттернам:';
const ARM_SUMMARY_PREFIX = '💪 Руки по паттернам:';
const BACK_ISSUE_PREFIX = '⚠ Качество спины:';
const ARM_ISSUE_PREFIX = '⚠ Качество рук:';
const JOINT_LINE_PREFIX = '🦿 Суставы:';
const ERROR_LINE_PREFIX = '🚫 Валидация:';

/** Сумма сетов по movement-паттернам для выбранных мышц (как в финализаторе). */
function patternSummary(weeks: any[], muscles: string[]): string {
  const acc: Record<string, number> = {};
  for (const week of weeks) {
    for (const session of week.sessions || []) {
      for (const exercise of session.exercises || []) {
        if (!muscles.includes(exercise.muscle)) continue;
        const pattern = exercise.movementPattern || 'other';
        acc[pattern] = (acc[pattern] || 0) + (exercise.sets || 0);
      }
    }
  }
  return Object.entries(acc).map(([key, value]) => `${key}=${value}`).join(', ') || 'нет прямой работы';
}
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

  // Ротация: стабильность основных движений внутри фазы. В финализаторе она
  // считалась в середине прохода — до поздних замен/удалений (реализм сессии,
  // гарды дней, доводка головок рук). Замер 17 планов (generic/cycle/program):
  // расходились все, например upper_lower_4 — 56 issue в плане против 65
  // фактических; отчёт и карточка качества показывали до-финальное число.
  plan.rotationReport = analyzeBBRotation(plan);
  if (opts.refreshRotationRationale) {
    const issues = ((plan.rotationReport.issues || []) as any[]);
    const message = (issue: any) => `${ROTATION_LINE_PREFIX} ${issue.message}`;
    const prev = (Array.isArray(plan.rationale) ? plan.rationale : [])
      .filter((line: string) => String(line).startsWith(ROTATION_LINE_PREFIX));
    // «primary_changed» сохраняем, только если финализатор уже решил его
    // показать (reorder=false); остальные строки — по фактическому составу.
    const keptPrimary = prev.filter((line: string) =>
      issues.some((issue) => issue.code === 'primary_changed' && message(issue) === line));
    const fresh = issues
      .filter((issue) => issue.code !== 'primary_changed')
      .slice(0, 20)
      .map(message);
    const lines = [...new Set([...keptPrimary, ...fresh])];
    plan.rationale = (Array.isArray(plan.rationale) ? plan.rationale : [])
      .filter((line: string) => !String(line).startsWith(ROTATION_LINE_PREFIX))
      .concat(lines);
  }

  // Паттерны спины/рук и их качество — тоже факт состава: финализатор считал
  // их до поздних замен/удалений (гарантия головок рук, гейт уровней, реализм
  // сессии, пост-финальный MRV-трим цикл/программа-путей). Замер: строка спины
  // расходилась в 14/17 планов, рук — в 9/17, «Качество рук» держало до 14
  // снятых предупреждений.
  {
    const rationale = (Array.isArray(plan.rationale) ? plan.rationale : [])
      .filter((line: string) => {
        const text = String(line);
        return !text.startsWith(BACK_SUMMARY_PREFIX)
          && !text.startsWith(ARM_SUMMARY_PREFIX)
          && !text.startsWith(BACK_ISSUE_PREFIX)
          && !text.startsWith(ARM_ISSUE_PREFIX);
      });
    rationale.push(`${BACK_SUMMARY_PREFIX} ${patternSummary(plan.weeks, ['back'])}`);
    for (const issue of backQualityIssues(plan.weeks)) rationale.push(`${BACK_ISSUE_PREFIX} ${issue}`);
    rationale.push(`${ARM_SUMMARY_PREFIX} ${patternSummary(plan.weeks, ['biceps', 'triceps', 'forearms'])}`);
    for (const issue of armQualityIssues(plan.weeks)) rationale.push(`${ARM_ISSUE_PREFIX} ${issue}`);
    plan.rationale = rationale;
  }

  // Суставной стресс (объём × вес × RIR-проксимити + PED): в финализаторе он
  // считался до гарантии головок рук, гейта уровней, реализма сессии и
  // пост-финального трима — строка расходилась во всех 23 собранных планах.
  {
    const rationale = (Array.isArray(plan.rationale) ? plan.rationale : [])
      .filter((line: string) => !String(line).startsWith(JOINT_LINE_PREFIX));
    const jointIssues = analyzePlanStress(plan).issues;
    if (jointIssues.length) rationale.push(`${JOINT_LINE_PREFIX} ${jointIssues.join(' ')}`);
    plan.rationale = rationale;
  }

  if (opts.refreshFrequency && opts.canonicalMuscle) {
    const freq = reconcileFrequencyClaim(plan, { canonical: opts.canonicalMuscle });
    applyFrequencyDriftNote(plan, frequencyDriftNote(freq));
  }

  if (opts.refreshValidationRationale && plan.validation) {
    const issues = ((plan.validation.issues || []) as any[]);
    const fresh = issues
      .filter((issue) => issue.level === 'warning')
      .filter((issue) => !TRANSIENT_VALIDATION_CODES.has(String(issue.code)))
      .slice(0, 20)
      .map((issue) => `${VALIDATION_LINE_PREFIX} ${issue.message}`);
    // Ошибки — то же обещание: цикл-путь после трима гасил их в плане, а строки
    // «🚫 Валидация» оставались (замер: 3 фантомные ошибки на 3 циклах).
    const freshErrors = issues
      .filter((issue) => issue.level === 'error')
      .slice(0, 20)
      .map((issue) => `${ERROR_LINE_PREFIX} ${issue.message}`);
    const rationale: string[] = (Array.isArray(plan.rationale) ? plan.rationale : [])
      .filter((line: string) => !String(line).startsWith(VALIDATION_LINE_PREFIX)
        && !String(line).startsWith(ERROR_LINE_PREFIX));
    for (const line of fresh) if (!rationale.includes(line)) rationale.push(line);
    for (const line of freshErrors) if (!rationale.includes(line)) rationale.push(line);
    plan.rationale = rationale;
  }

  // Отчёт — ПОСЛЕДНИМ: он копирует в себя weeklyVolume/validation/balanceReport/
  // expandedSummary и текст rationale.
  plan.report = buildBBPlanReport(plan);
}

/**
 * strength-sport-ss-annual.engine.ts — годовой план из интернет-циклов.
 * Каждый id собирается своим шаблоном (buildSSCyclePlan, дословно/adapt),
 * блоки компонуются через buildAnnualWithTaper: дата старта якорится
 * на последний блок (mock/тейпер цикла + taperWeeks).
 * Ядро annual (strength-sport-annual) не меняется — только композиция.
 */
import { getSSCycleById } from '../../data/ss-cycles/ss-cycle-index';
import { buildSSCyclePlan, type SSCycleMode } from './strength-sport-ss-cycle-to-plan.engine';
import { buildAnnualWithTaper, validateAnnualSS, type AnnualSS } from './strength-sport-annual';
import type { StrengthSportInput, StrengthSportPlan } from './strength-sport.types';

export interface SSAnnualBuildOpts {
  cycleMode?: SSCycleMode; // дефолт faithful
  competitionDate?: string;
  taperWeeks?: number;
}

export function buildAnnualFromSSCycles(
  cycleIds: string[],
  baseInput: StrengthSportInput,
  opts?: SSAnnualBuildOpts,
): AnnualSS {
  if (!cycleIds.length) throw new Error('Нет циклов для годового плана');
  const mode = opts?.cycleMode || 'faithful';
  const plans: StrengthSportPlan[] = cycleIds.map((id, idx) => {
    const t = getSSCycleById(id);
    if (!t) throw new Error(`SS-цикл не найден: ${id}`);
    const last = idx === cycleIds.length - 1;
    const days = Math.min(t.meta.sessionsPerWeekMax ?? t.meta.sessionsPerWeek, 6);
    return buildSSCyclePlan(
      t,
      {
        ...baseInput,
        weeks: t.meta.weeks,
        daysPerWeek: days,
        competitionDate: last ? opts?.competitionDate || baseInput.competitionDate : undefined,
      } as StrengthSportInput,
      { cycleMode: mode, bodyweight: (baseInput as any).bodyweight, sex: (baseInput as any).sex },
    );
  });
  const annual = buildAnnualWithTaper(plans, {
    competitionDate: opts?.competitionDate || baseInput.competitionDate,
    taperWeeks: opts?.taperWeeks ?? 1,
  });
  return annual;
}

export function validateSSAnnual(annual: AnnualSS): { ok: boolean; warnings: string[]; errors: string[] } {
  return validateAnnualSS(annual);
}

/**
 * strength-sport-ss-annual.engine.ts — годовой план из интернет-циклов.
 * Каждый id собирается своим шаблоном (buildSSCyclePlan, дословно/adapt),
 * ПМ прогрессируют между блоками (applyMesocycleProgression — следующий блок
 * стартует с максимумов предыдущего, а не с тех же), блоки компонуются через
 * buildAnnualWithTaper: дата старта якорится на последний блок.
 * Ядро annual (strength-sport-annual) не меняется — только композиция.
 */
import { getSSCycleById } from '../../data/ss-cycles/ss-cycle-index';
import { buildSSCyclePlan, type SSCycleMode } from './strength-sport-ss-cycle-to-plan.engine';
import { applyMesocycleProgression } from './strength-sport-mesocycle';
import { buildAnnualWithTaper, validateAnnualSS, type AnnualSS } from './strength-sport-annual';
import type { StrengthSportInput, StrengthSportPlan } from './strength-sport.types';

export interface SSAnnualBuildOpts {
  cycleMode?: SSCycleMode; // дефолт faithful
  competitionDate?: string;
  taperWeeks?: number;
  /** false = каждый блок со стартовыми ПМ (legacy); true (дефолт) = прогрессия между блоками */
  progressBetweenBlocks?: boolean;
}

export function buildAnnualFromSSCycles(
  cycleIds: string[],
  baseInput: StrengthSportInput,
  opts?: SSAnnualBuildOpts,
): AnnualSS {
  if (!cycleIds.length) throw new Error('Нет циклов для годового плана');
  const mode = opts?.cycleMode || 'faithful';
  const progress = opts?.progressBetweenBlocks ?? true;
  const plans: StrengthSportPlan[] = [];
  let carryInput: StrengthSportInput = baseInput;
  cycleIds.forEach((id, idx) => {
    const t = getSSCycleById(id);
    if (!t) throw new Error(`SS-цикл не найден: ${id}`);
    const last = idx === cycleIds.length - 1;
    const days = Math.min(t.meta.sessionsPerWeekMax ?? t.meta.sessionsPerWeek, 6);
    const blockInput = {
      ...carryInput,
      weeks: t.meta.weeks,
      daysPerWeek: days,
      competitionDate: last ? opts?.competitionDate || baseInput.competitionDate : undefined,
    } as StrengthSportInput;
    const built = buildSSCyclePlan(
      t,
      blockInput,
      { cycleMode: mode, bodyweight: (baseInput as any).bodyweight, sex: (baseInput as any).sex },
    );
    plans.push(built);
    // Следующий блок — с прогрессией от построенного (ПМ растут, а не стоят)
    if (progress) {
      try {
        const before = JSON.stringify(carryInput.workMax || {});
        carryInput = applyMesocycleProgression(built, { ...carryInput, workMax: { ...(carryInput.workMax || {}) } }) as StrengthSportInput;
        if (JSON.stringify(carryInput.workMax || {}) === before) {
          built.rationale.push('Год: блок без прогрессии ПМ — предыдущий мезоцикл перегружен (warnings/ACWR), следующий стартует с тех же максимумов');
        } else {
          built.rationale.push('Год: ПМ прогрессируют в следующий блок (кросс-мезоцикл)');
        }
      } catch { /* прогрессия недоступна — следующий блок со стартовыми ПМ */ }
    }
  });
  const annual = buildAnnualWithTaper(plans, {
    competitionDate: opts?.competitionDate || baseInput.competitionDate,
    taperWeeks: opts?.taperWeeks ?? 1,
  });
  return annual;
}

export function validateSSAnnual(annual: AnnualSS): { ok: boolean; warnings: string[]; errors: string[] } {
  const base = validateAnnualSS(annual);
  const warnings = [...base.warnings];
  if (annual.totalWeeks > 52) {
    warnings.push(`Год длиннее 52 недель: ${annual.totalWeeks} нед — урежьте блоки или разбейте на сезоны`);
  }
  return { ok: base.ok, warnings, errors: base.errors };
}

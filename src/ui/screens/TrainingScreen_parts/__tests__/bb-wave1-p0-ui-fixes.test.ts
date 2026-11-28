/**
 * UI-замки Волны 1 (docs/BB-AUTO-FULL-AUDIT-PLAN-2026-11.md):
 * P0-1  effectivePedDoses + гейт MGF/IGF1 в bb-step-ped
 * P0-2  Шаг 4 Trial в Contest Prep видим (не заперт в contestWizard === 5)
 * P0-8  Упражнения со своим весом (0 кг) не превращаются в 80 кг
 * P0-9  Инлайн-правка reps обновляет все подходы, не только i === 0
 * P0-10 Инлайн-ввод RIR зажат в 0..5 (согласован с валидатором)
 * P0-12 Единый computePlanSafety во всех сейв-гейтах, runtime и TXT-экспорте
 * P0-16 inputSnapshot сохраняет поля билдера (...plan.inputSnapshot)
 * P0-18 he_pl_runtime передаёт канонический EN `muscle`
 * P0-19 returnAction вынесен из-под условия swaps/preferred
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { planSetsBreakdown } from '../bb-technique-display';

const PARTS_DIR = path.resolve(__dirname, '..');
const readPart = (rel: string) => fs.readFileSync(path.join(PARTS_DIR, rel), 'utf8');

describe('Wave 1 P0 UI audit locks', () => {
  it('P0-8: planSetsBreakdown сохраняет weight: 0 (не откатывается на 80/ws[0])', () => {
    const ex = {
      sets: 3,
      rir: 2,
      workSets: [
        { reps: 12, weight: 80, rir: 2 },
        { reps: 12, weight: 80, rir: 2 },
        { reps: 12, weight: 80, rir: 2 },
      ],
    };
    const { lines } = planSetsBreakdown(ex, { sets: 3, reps: 12, weight: 0 });
    expect(lines).toEqual(['0×12 @RIR2', '0×12 @RIR2', '0×12 @RIR2']);
  });

  it('P0-8 & P0-10: bb-step-plan и bb-step-adjust не используют `|| 80`, RIR ограничен 0..5', () => {
    const stepPlan = readPart('bb-step-plan.tsx');
    const stepAdjust = readPart('bb-step-adjust.tsx');
    expect(stepPlan).not.toContain('e.workSets[0]?.weight || 80');
    expect(stepPlan).toContain('e.workSets[0]?.weight ?? 0');
    expect(stepAdjust).not.toContain('e.workSets[0]?.weight || 80');
    expect(stepAdjust).toContain('e.workSets[0]?.weight ?? 0');
    expect(stepAdjust).toContain('clampInlineNumber(e2.target.value, 0, 5,');
    expect(stepAdjust).not.toContain('clampInlineNumber(e2.target.value, 0, 10,');
  });

  it('P0-1: bb-step-ped не показывает фазу MGF/IGF1 натуралам, а BbAutoConstructor использует effectivePedDoses', () => {
    const stepPed = readPart('bb-step-ped.tsx');
    expect(stepPed).toContain("peds.includes('MGF') && peds.includes('IGF1')");

    const ctor = readPart('BbAutoConstructor.tsx');
    expect(ctor).toContain('const effectivePedDoses = useMemo');
    expect(ctor).toContain('pedDoses: effectivePedDoses');
  });

  it('P0-2: Contest Prep wizard 4 (Test Peak Week) видим при contestWizard === 4', () => {
    const ctor = readPart('BbAutoConstructor.tsx');
    const prepSec = readPart('bb-contest-prep-sections.tsx');
    expect(ctor).toContain('(contestWizard===4 || contestWizard===5)');
    expect(prepSec).toContain("contestWizard===4 ? 'block' : 'none'");
    expect(prepSec).toContain("contestWizard===5 ? 'block' : 'none'");
  });

  it('P0-9, P0-12, P0-16, P0-18, P0-19: структурные замки в BbAutoConstructor.tsx', () => {
    const ctor = readPart('BbAutoConstructor.tsx');
    // P0-9: reps обновляются во всех сетах
    expect(ctor).not.toContain('if (repsChanged && i === 0)');
    expect(ctor).toContain('if (repsChanged) next.reps =');
    // P0-12: ни один гейт сохранения не зовёт calculatePlanSafetyScore напрямую с calculateACWR()
    expect(ctor).not.toMatch(/calculatePlanSafetyScore\([^)]*acwrRatio:\s*calculateACWR\(\)/s);
    expect(ctor).toContain('const computePlanSafety = useCallback');
    // P0-16: сохраняем полный inputSnapshot билдера
    expect(ctor).toContain('...((plan as any).inputSnapshot || {})');
    // P0-18: пишем канонический EN muscle в he_pl_runtime
    expect(ctor).toContain('muscle: e.muscle');
    // P0-19: returnAction не зависит от наличия swaps/preferred
    expect(ctor).toContain('const hasReturnCut =');
    expect(ctor).toContain('|| hasReturnCut)');
    expect(ctor).toContain('bannedPatterns: returnAction?.bannedPatterns');
  });
});

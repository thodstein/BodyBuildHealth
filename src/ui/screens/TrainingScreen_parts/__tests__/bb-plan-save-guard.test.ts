import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { bbPlanSaveBlockReason } from '../bb-plan-save-guard';

/**
 * Волна 0, п. 0.2: план с ошибками валидации (sets_mismatch) или
 * SafetyScore < 60 НЕ достигает he_bb_plan_saved.
 * Критерий плана: «план с sets_mismatch не достигает he_bb_plan_saved».
 */
const validPlan = { validation: { valid: true, issues: [] } };
const mismatchedPlan = {
  validation: {
    valid: false,
    issues: [{ level: 'error', message: 'Сеты не совпадают с workSets (sets_mismatch)' }],
  },
};
const safe = { score: 82, riskLevel: 'safe' as const, recommendations: [] };
const dangerous = { score: 41, riskLevel: 'dangerous' as const, recommendations: ['🚨 КРИТИЧНО: план небезопасен.'] };

describe('bb-plan-save-guard — исполнение валидатора (Волна 0, п.0.2)', () => {
  it('sets_mismatch: сохранение блокируется с причиной из валидатора', () => {
    const reason = bbPlanSaveBlockReason(mismatchedPlan, safe);
    expect(reason).toBeTruthy();
    expect(reason).toContain('ошибки валидации');
    expect(reason).toContain('sets_mismatch');
  });

  it('SafetyScore < 60 (dangerous) блокирует даже валидный план', () => {
    const reason = bbPlanSaveBlockReason(validPlan, dangerous);
    expect(reason).toBeTruthy();
    expect(reason).toContain('41/100');
  });

  it('валидный безопасный план сохраняется (null)', () => {
    expect(bbPlanSaveBlockReason(validPlan, safe)).toBeNull();
  });

  it('caution-скор (<75, >=60) не блокирует — предупреждение остаётся UI-заботой', () => {
    expect(bbPlanSaveBlockReason(validPlan, { score: 66, riskLevel: 'caution', recommendations: [] })).toBeNull();
  });

  it('source-guard: все три точки сохранения используют единый гейт', () => {
    const src = readFileSync('src/ui/screens/TrainingScreen_parts/BbAutoConstructor.tsx', 'utf8');
    const calls = src.match(/bbPlanSaveBlockReason\(/g) || [];
    // Ровно 3 вызова: handleSavePlan / handleSaveToMyPlans / handleSaveVariant.
    expect(calls.length).toBe(3);
    expect(src).toMatch(/from '\.\/bb-plan-save-guard'/);
    expect(src).toMatch(/he_bb_plan_saved/);
  });
});

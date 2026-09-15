import { describe, expect, it } from 'vitest';
import { getPattern, validateSplitPatterns } from '../bb-split-patterns';
import { rankBBSplits } from '../bb-selector.engine';
import { buildBBPlan } from '../bb-builder.engine';
import { validateBBPlan } from '../bb-validator.engine';

/**
 * M2 (план §8.2): женские сплиты в выборе — состав, инварианты, сборка, sex-скоринг.
 */
const WM = { chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 100, glutes: 120, biceps: 50, triceps: 60, calves: 80, traps: 70, forearms: 40 };
const FEMALE_IDS = ['female_glute_5', 'female_lower_upper_4', 'female_bikini_5', 'female_wellness_5', 'female_upper_glute_4'];

describe('M2: женские сплиты', () => {
  it('все женские сплиты присутствуют; инварианты паттернов чисты', () => {
    for (const id of FEMALE_IDS) expect(getPattern(id), id).toBeDefined();
    expect(validateSplitPatterns()).toEqual([]);
  });

  it('каждый женский сплит собирается без error-уровня валидатора (female)', () => {
    for (const id of FEMALE_IDS) {
      const plan = buildBBPlan({ patternId: id, level: 'intermediate', goal: 'mass', weeks: 6, workMax: WM, sex: 'female', trainingYears: 3 } as never);
      const r = validateBBPlan(plan as never, { level: 'intermediate' });
      expect(r.issues.filter((i: { level?: string }) => i.level === 'error').map((i: { message: string }) => i.message), id).toHaveLength(0);
    }
  }, 180000);

  it('selector: female — женский сплит в топ-3; male — не женский топ', () => {
    const fem = rankBBSplits({ level: 'intermediate', goal: 'mass', daysPerWeek: 5, sex: 'female' });
    const male = rankBBSplits({ level: 'intermediate', goal: 'mass', daysPerWeek: 5, sex: 'male' });
    expect(fem.slice(0, 3).some(r => r.pattern.id.startsWith('female_'))).toBe(true);
    expect(male[0].pattern.id.startsWith('female_')).toBe(false);
  });

  it('базовые женские сплиты действительно glute-heavy (сессии Glutes/GlutesHams/Lower)', () => {
    for (const id of ['female_lower_upper_4', 'female_bikini_5', 'female_wellness_5']) {
      const p = getPattern(id)!;
      const gluteish = p.schedule.filter(d => d.kind === 'тренировка' && ['Glutes', 'GlutesHams', 'Lower', 'Legs'].includes(String(d.sessionTag))).length;
      expect(gluteish, id).toBeGreaterThanOrEqual(2);
    }
  });
});

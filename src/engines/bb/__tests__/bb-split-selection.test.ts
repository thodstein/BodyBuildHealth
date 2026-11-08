import { describe, expect, it } from 'vitest';
import { rankBBSplits } from '../bb-selector.engine';
import { buildBBPlan } from '../bb-builder.engine';

const WM = { chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 100, glutes: 120, biceps: 50, triceps: 60, calves: 80, traps: 70, forearms: 40 };

describe('выбор сплита: day-fit (было: fullbody_3 выигрывал всегда)', () => {
  it('6 дней → рекомендация с ≥5 сессий/нед (не 3-дневная)', () => {
    const top = rankBBSplits({ level: 'intermediate', goal: 'mass', daysPerWeek: 6 })[0];
    expect(top.pattern.sessionsPerRotation).toBeGreaterThanOrEqual(5);
  });
  it('5 дней → не 3-дневка (4–5 сессий; 5-дневные — bro_5/female_*)', () => {
    // Аудит женского слоя: раньше на 5 днях топ-1 был female_glute_5 даже при
    // неизвестном поле. Теперь unknown-sex получает штраф на женские сплиты,
    // поэтому для intermediate/mass реально доступен 4-дневный upper/lower
    // (5-дневная плотность — только bro_5 с мета-штрафом или женский glute).
    const top = rankBBSplits({ level: 'intermediate', goal: 'mass', daysPerWeek: 5 })[0];
    expect(top.pattern.sessionsPerRotation).toBeGreaterThanOrEqual(4);
    expect(top.pattern.id.startsWith('female_')).toBe(false);
  });
  it('3 дня → ≤4 сессий', () => {
    const top = rankBBSplits({ level: 'intermediate', goal: 'mass', daysPerWeek: 3 })[0];
    expect(top.pattern.sessionsPerRotation).toBeLessThanOrEqual(4);
  });
  it('4 дня → 3–5 сессий', () => {
    const top = rankBBSplits({ level: 'intermediate', goal: 'mass', daysPerWeek: 4 })[0];
    expect(top.pattern.sessionsPerRotation).toBeGreaterThanOrEqual(3);
    expect(top.pattern.sessionsPerRotation).toBeLessThanOrEqual(5);
  });

  it('явно выбранный patternId не подменяется движком (ppl_6)', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', goal: 'mass', weeks: 4, workMax: WM });
    expect(plan.pattern?.id).toBe('ppl_6');
    expect(plan.weeks[0].sessions.map(s => s.sessionTag).join(',')).toBe('Push,Pull,Legs,Push,Pull,Legs');
  });
  it('явно выбранный bro_5 не превращается в fullbody', () => {
    const plan = buildBBPlan({ patternId: 'bro_5', level: 'intermediate', goal: 'mass', weeks: 4, workMax: WM });
    expect(plan.pattern?.id).toBe('bro_5');
    expect(plan.weeks[0].sessions.map(s => s.sessionTag).join(',')).toBe('Chest,Back,Shoulders,Arms,Legs');
  });
});

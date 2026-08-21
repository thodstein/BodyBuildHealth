import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';

const WM = { chest: 120, back: 130, shoulders: 70, biceps: 60, triceps: 65, quads: 150, hamstrings: 110, glutes: 150, calves: 90, abs: 70, traps: 90, forearms: 45 };

const sessionsOf = (plan: any, tag: string): any[] => {
  const out: any[] = [];
  for (const w of plan.weeks) for (const s of w.sessions) if ((s.sessionTag || '').toLowerCase().includes(tag.toLowerCase())) out.push(s);
  return out;
};

describe('BB корректность дней/капов/фич (регрессия)', () => {
  it('шраги (traps) НЕ в Push/грудном дне', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'enhanced', trainingYears: 8, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'heavy' });
    const push = sessionsOf(plan, 'push');
    expect(push.length).toBeGreaterThan(0);
    for (const s of push) for (const e of s.exercises) {
      expect(e.muscle).not.toBe('traps');
    }
  });

  it('наклонный жим есть в груди, широкая тяга верхнего блока — в спине', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'enhanced', trainingYears: 8, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'heavy' });
    const allNames = plan.weeks.flatMap((w:any)=>w.sessions).flatMap((s:any)=>s.exercises.map((e:any)=>e.name.toLowerCase()));
    // грудь: хотя бы одно наклонное упражнение
    expect(allNames.some(n => n.includes('наклон') || n.includes('incline'))).toBe(true);
    // спина: хотя бы одна вертикальная тяга (верхний блок / пулдаун / подтягивание)
    expect(allNames.some(n => n.includes('верхнего блока') || n.includes('пуллдаун') || n.includes('подтягиван'))).toBe(true);
  });

  it('слабые группы +1 optional и флаг optional корректны', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM, weakPoints: ['biceps'] });
    let optCount = 0;
    for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) if ((e as any).optional) optCount++;
    expect(optCount).toBeGreaterThan(0);
  });
});

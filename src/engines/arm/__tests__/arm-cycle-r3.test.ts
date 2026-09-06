import { describe, it, expect } from 'vitest';
import { buildArmBlock } from '../arm-annual';
import { applyArmPro } from '../arm-pro-integration.engine';

function armPlanSets(res: any, idx: number): number {
  const wk = res.armPlan.weeks[idx];
  return wk.sessions.reduce((s: number, ss: any) => s + ss.exercises.reduce((a: number, e: any) => a + e.sets, 0), 0);
}

describe('arm-cycle-r3 (annual taper + medley fact)', () => {
  it('годовой WAF-тейпер хронологичен: пик легче предпика, маркеры только на хвосте', () => {
    const res: any = buildArmBlock(
      { blockKey: 'waf', weeks: 6, phase: 'peaking' },
      { level: 'intermediate', taperEnabled: true, taperWeeks: 2 } as any,
    );
    expect(res.taperApplied).toBe(true);
    const notes = res.armPlan.weeks.map((w: any) => String(w.note || ''));
    // хвост w5/w6 размечен, рабочие недели — нет
    expect(/\[arm-taper:/.test(notes[4])).toBe(true);
    expect(/\[arm-taper:/.test(notes[5])).toBe(true);
    expect(/\[arm-taper:/.test(notes[3])).toBe(false);
    // направление вшито в маркер: предпик 0.65, пик 0.45 (не наоборот)
    expect(notes[4]).toMatch('[arm-taper:0.65]');
    expect(notes[5]).toMatch('[arm-taper:0.45]');
    // итоги: пик не тяжелее предпика сверх rounding-допуска (+2)
    expect(armPlanSets(res, 5)).toBeLessThanOrEqual(armPlanSets(res, 4) + 2);
  });
  it('без taperEnabled — маркеров нет (байт-в-байт)', () => {
    const res: any = buildArmBlock(
      { blockKey: 'plain', weeks: 6, phase: 'strength' },
      { level: 'intermediate' } as any,
    );
    expect(res.taperApplied).toBe(false);
    expect(res.armPlan.weeks.every((w: any) => !/\[arm-taper:/.test(String(w.note || '')))).toBe(true);
  });
  it('медли-факт: сводка лучших + флаг срыва', () => {
    const r: any = applyArmPro({
      discipline: 'armlifting', patternId: 'grip_3_support', level: 'advanced', goal: 'strength', technique: 'balanced', weeks: 4,
      medleyId: 'rt_saxon_hub',
      medleyAttempts: [
        { eventIdx: 0, weightKg: 100, success: true },
        { eventIdx: 0, weightKg: 110, success: false },
        { eventIdx: 1, weightKg: 80, success: true },
      ],
    } as any);
    expect(r.medleyLine).toMatch('100 + 80 + 0 = 180');
    expect(r.rationale.some((l: string) => /срывы/.test(l))).toBe(true);
  });
  it('медли без попыток — только ротация, без факта', () => {
    const r: any = applyArmPro({
      discipline: 'armlifting', patternId: 'grip_3_support', level: 'advanced', goal: 'strength', technique: 'balanced', weeks: 4,
      medleyId: 'rt_saxon_hub',
    } as any);
    expect(r.medleyLine).toMatch('Ротация недели');
    expect(r.rationale.some((l: string) => /Медли-факт/.test(l))).toBe(false);
  });
});

/**
 * strength-sport-planner-pro-build.test.ts — PRO-проводка в билдере (интеграция, не юниты).
 * Каждый тест сравнивает план с PRO-входом против дефолта на том же сиде.
 */
import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';

const WM_SM = { backSquat: 140, deadlift: 180, overheadPress: 70, yokeWalk: 320, farmersWalk: 140, atlasStone: 120 } as any;

function baseInput(over: Record<string, unknown> = {}): any {
  return {
    mode: 'strongman', goal: 'strength', level: 'intermediate',
    weeks: 8, daysPerWeek: 3, bodyweight: 104.1, sex: 'male', age: 30,
    workMax: WM_SM,
    ...over,
  };
}

function allComments(plan: any): string[] {
  return plan.weeksData.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises.map((e: any) => String(e.comment || ''))));
}

describe('PRO build: класс + rationale', () => {
  it('P1: 104.1кг → класс + до границы −0.9', () => {
    const p = buildStrengthSportPlan(baseInput());
    expect(p.rationale.join(' | ')).toContain('−0.9');
  });
  it('P1: явный класс + перевес честно', () => {
    const p = buildStrengthSportPlan(baseInput({ bodyweight: 106, weightClass: '<90' }));
    expect(p.rationale.join(' | ')).toContain('перевес');
  });
});

describe('PRO build: RPE-cap', () => {
  it('P2: cap режет только вниз (не накачивает) + помечает сеты', () => {
    const a = buildStrengthSportPlan(baseInput({ goal: 'peaking' }));
    const b = buildStrengthSportPlan(baseInput({ goal: 'peaking', rpeCap: 8 }));
    const maxW = (p: any) => Math.max(...p.weeksData.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises.flatMap((e: any) => e.workSets.map((ws: any) => ws.weight)))));
    expect(maxW(b)).toBeLessThanOrEqual(maxW(a));
    expect(b.rationale.join(' | ')).toContain('RPE-cap 8');
    const capped = b.weeksData.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises.flatMap((e: any) => e.workSets))).filter((ws: any) => ws.rpeCapped);
    expect(capped.length).toBeGreaterThan(0);
  });
});

describe('PRO build: хват + камень', () => {
  it('P3: mixed → warn в технике + static-строка; камень — канаты', () => {
    const p = buildStrengthSportPlan(baseInput({ goal: 'peaking', deadliftGrip: 'mixed' }));
    const comments = allComments(p);
    expect(p.rationale.join(' | ')).toContain('разнохват');
    expect(comments.some((c) => c.includes('PMC8237209'))).toBe(true);
    expect(comments.some((c) => c.includes('руки-канаты'))).toBe(true);
  });
  it('P3: лямки → тихо (без PMC-warn)', () => {
    const p = buildStrengthSportPlan(baseInput({ goal: 'peaking', deadliftGrip: 'straps' }));
    expect(allComments(p).some((c) => c.includes('PMC8237209'))).toBe(false);
  });
});

describe('PRO build: делод + кондиция', () => {
  it('P5: opt-out гасит авто-делоды и static-строку', () => {
    const on = buildStrengthSportPlan(baseInput({ weeks: 12 }));
    const off = buildStrengthSportPlan(baseInput({ weeks: 12, autoDeload: false }));
    expect(on.rationale.join(' | ')).toContain('Авто-разгрузка');
    expect(off.rationale.join(' | ')).not.toContain('Авто-разгрузка');
    const deloadCount = (p: any) => p.weeksData.filter((w: any) => w.deload).length;
    expect(deloadCount(off)).toBeLessThanOrEqual(deloadCount(on));
  });
  it('P5: conditioningDay:false → ноль cond_day', () => {
    const off = buildStrengthSportPlan(baseInput({ conditioningDay: false }));
    const cond = off.weeksData.flatMap((w: any) => w.sessions).filter((s: any) => s.sessionTag === 'cond_day');
    expect(cond.length).toBe(0);
  });
});

describe('PRO build: toro4 + opener', () => {
  it('P5: toro4 помечен в rationale', () => {
    const p = buildStrengthSportPlan(baseInput({ blockModel: 'toro4' }));
    expect(p.rationale.join(' | ')).toContain('Torokhtiy');
  });
  it('P5: wave включает DUP-волну (vs strong5 без волны)', () => {
    const s = buildStrengthSportPlan(baseInput({ blockModel: 'strong5' }));
    const w = buildStrengthSportPlan(baseInput({ blockModel: 'wave' }));
    expect(w.rationale.join(' | ')).toContain('Wave/DUP');
    const waveTempo = w.weeksData.flatMap((x: any) => x.sessions.flatMap((x2: any) => x2.exercises)).filter((e: any) => String(e.tempo || '').includes('X-0-X-0')).length;
    const strongTempo = s.weeksData.flatMap((x: any) => x.sessions.flatMap((x2: any) => x2.exercises)).filter((e: any) => String(e.tempo || '').includes('X-0-X-0')).length;
    expect(waveTempo).toBeGreaterThanOrEqual(strongTempo);
  });
  it('P7: competitionDate → opener-строка', () => {
    const p = buildStrengthSportPlan(baseInput({ competitionDate: '2026-12-01' }));
    expect(p.rationale.join(' | ')).toContain('Opener');
  });
});

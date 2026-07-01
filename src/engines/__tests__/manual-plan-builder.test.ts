import { describe, it, expect } from 'vitest';
import { buildPlanDays } from '../manual-plan-builder';

const pct = { 0: 1.0, 1: 0.96, 2: 0.92, 3: 0.87, 4: 0.82, 5: 0.77 };
const baseInput = {
  cycle: [['chest'], ['back']] as string[][],
  mrv: 20,
  goal: 'hypertrophy',
  level: 'intermediate',
  mesoLength: 12,
  weakPoints: [] as string[],
  equipment: [] as string[],
  workMax: { chest: 100, back: 110 },
  manualWorkMax: {} as Record<string, number>,
  injuries: [] as { muscle: string; from: string; to?: string }[],
  pctForRir: pct,
};

describe('buildPlanDays (ядро генерации плана)', () => {
  it('строит по дню на каждую группу цикла', () => {
    const r = buildPlanDays(baseInput);
    expect(r.days.length).toBe(2);
    expect(r.days[0].day).toBe(1);
    expect(r.days[0].groups).toEqual(['chest']);
    expect(r.days[0].exercises.length).toBeGreaterThan(0);
    const ex = r.days[0].exercises[0];
    expect(ex.name).toBeTruthy();
    expect(ex.sets).toBeGreaterThan(0);
    expect(ex.group).toBe('chest');
    expect(ex.weight).toBeGreaterThan(0);
  });

  it('накапливает недельные сеты по группам', () => {
    const r = buildPlanDays(baseInput);
    expect(r.weeklySets.chest).toBeGreaterThan(0);
    expect(r.weeklySets.back).toBeGreaterThan(0);
  });

  it('groupCorrections — массив', () => {
    const r = buildPlanDays(baseInput);
    expect(Array.isArray(r.groupCorrections)).toBe(true);
  });

  it('исключает травмированную группу и пишет коррекцию', () => {
    const today = new Date().toISOString().slice(0, 10);
    const r = buildPlanDays({ ...baseInput, injuries: [{ muscle: 'chest', from: today }] });
    expect(r.days[0].exercises.length).toBe(0);
    expect(r.groupCorrections.some(c => c.includes('Группа «chest» пропущена по травме'))).toBe(true);
    expect(r.weeklySets.chest ?? 0).toBe(0);
  });

  it('ограничивает объём по MRV', () => {
    const r = buildPlanDays({ ...baseInput, mrv: 1 });
    // при MRV=1 после первой группы-упражнения дальнейшие превышения отсекаются
    expect(r.groupCorrections.some(c => c.includes('объём достиг MRV'))).toBe(true);
  });
});
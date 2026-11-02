/**
 * bb-progression-rule.test.ts — итерация C (D-1): «как прогрессировать».
 *
 * Юнит-правила + интеграция: финализатор обязан заполнить правило у КАЖДОГО
 * упражнения любого плана (сплит/цикл/программа/повторная финализация), иначе
 * пользователь снова видит только «3×10 @ 80 кг».
 */
import { describe, expect, it } from 'vitest';
import { buildProgressionRule } from '../bb-progression-rule';
import { buildBBPlan } from '../bb-builder.engine';

const ex = (o: Partial<{ role: 'primary' | 'accessory'; character: 'тяж' | 'памп' | 'лёг'; repsRange: [number, number]; rir: number }> = {}) => ({
  role: (o.role ?? 'primary') as 'primary' | 'accessory',
  character: (o.character ?? 'тяж') as 'тяж' | 'памп' | 'лёг',
  repsRange: (o.repsRange ?? [6, 8]) as [number, number],
  rir: o.rir ?? 2,
});

describe('buildProgressionRule: фазы', () => {
  it('делод — возврат к весу прошлой рабочей недели, а не «новый рекорд»', () => {
    const rule = buildProgressionRule(ex(), { phase: 'deload', isDeload: true });
    expect(rule).toMatch(/Разгрузка/i);
    expect(rule).toMatch(/прошлой рабочей недели/i);
  });

  it('пик — вес держим, объём снижен', () => {
    const rule = buildProgressionRule(ex(), { phase: 'peaking' });
    expect(rule).toMatch(/Пик/i);
    expect(rule).toMatch(/вес держим/i);
  });
});

describe('buildProgressionRule: типы упражнений', () => {
  it('compound: двойная прогрессия до верхней границы и шаг веса', () => {
    const rule = buildProgressionRule(ex({ repsRange: [6, 8], rir: 2 }));
    expect(rule).toContain('8');
    expect(rule).toContain('6');
    expect(rule).toMatch(/Двойная прогрессия/i);
    expect(rule).toMatch(/шаг веса/i);
    expect(rule).toMatch(/RIR 2/);
  });

  it('памп/изоляция: +1 повтор в неделю', () => {
    const rule = buildProgressionRule(ex({ role: 'accessory', character: 'памп', repsRange: [12, 20], rir: 3 }));
    expect(rule).toMatch(/прибавляйте 1 повтор в неделю/i);
    expect(rule).toContain('20');
  });

  it('спец-мышца: +2 %/нед с капом +6 % (как в loadProgressMult)', () => {
    const rule = buildProgressionRule(ex(), { isSpecMuscle: true });
    expect(rule).toMatch(/\+2 %/);
    expect(rule).toMatch(/\+6 %/);
  });

  it('силовой фокус добавляет RIR 1-2', () => {
    const rule = buildProgressionRule(ex(), { trainingFocus: 'strength' });
    expect(rule).toMatch(/RIR 1-2/);
  });
});

describe('интеграция: правило прогрессии есть у каждого упражнения плана', () => {
  it('buildBBPlan (upper_lower_4, 2 недели) заполняет progressionRule', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 2 } as any);
    const exercises = plan.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises as any[]));
    expect(exercises.length).toBeGreaterThan(10);
    const missing = exercises.filter(e => !e.progressionRule);
    expect(missing.map((e: any) => e.name)).toEqual([]);
    // Правило не общее на весь план: у разных фаз/упражнений текст разный.
    const distinct = new Set(exercises.map((e: any) => String(e.progressionRule)));
    expect(distinct.size).toBeGreaterThan(1);
  });
});

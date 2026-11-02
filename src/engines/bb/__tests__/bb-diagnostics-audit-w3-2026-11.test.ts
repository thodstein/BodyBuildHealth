/**
 * bb-diagnostics-audit-w3-2026-11.test.ts — регрессии волны 3 (формулы движков).
 *
 * Каждый тест падал ДО фикса: YBT-композит, пауза в темпе, локоть от leg curl,
 * запятая в LVP, ICS-стабильность, делод-неделя, числовые sets в ACWR.
 */
import { describe, it, expect } from 'vitest';
import { parseBbLvpText } from '../bb-lvp.engine';
import { assessBbTendonGuard } from '../bb-tendon-guard.engine';
import { buildBBSpecIcs } from '../bb-spec-ics.engine';
import { computePerMuscleACWR } from '../bb-progression-feedback.engine';
import { diagnoseExercise } from '../bb-exercise-diagnosis.engine';
import { injectBBWeakPoints } from '../bb-diagnostics-injection.engine';
import type { BBPlan } from '../bb-builder.engine';

describe('W3-1 LVP: запятая как десятичный разделитель в ОБОИХ числах', () => {
  it('«80,5 0,62» парсится целиком (раньше скорость → NaN)', () => {
    const pts = parseBbLvpText('80,5 0,62');
    expect(pts).toHaveLength(1);
    expect(pts[0].weightKg).toBe(80.5);
    expect(pts[0].velocity).toBe(0.62);
  });

  it('точка по-прежнему работает', () => {
    const pts = parseBbLvpText('100 0.55\n110 0.44');
    expect(pts.map(p => p.weightKg)).toEqual([100, 110]);
  });
});

describe('W3-2 локоть: сгибание ног не считается нагрузкой на локоть', () => {
  const sess = (name: string, sets = 4) => [{ exercises: [{ name, exerciseName: '', sets }] }];

  it('leg curl не даёт elbow warn/stop', () => {
    const g = assessBbTendonGuard(sess('Сгибание ног лёжа (leg curl)', 6), { level: 'beginner' });
    expect(g.elbow.heavySets).toBe(0);
    expect(g.elbow.level).toBe('ok');
  });

  it('бицепс/тяга по-прежнему грузят локоть', () => {
    const g = assessBbTendonGuard(sess('Подъём штанги на бицепс', 6), { level: 'beginner' });
    expect(g.elbow.heavySets).toBeGreaterThan(0);
  });
});

describe('W3-3 ICS: UID стабилен, DTSTAMP в UTC с Z', () => {
  const spec = { weeks: [{ week: 1, targetSets: { chest_upper: 12 }, note: '' }], weakZones: ['chest_upper'] };

  it('DTSTAMP заканчивается на Z', () => {
    const ics = buildBBSpecIcs(spec as any, { startDate: '2026-11-02' })!;
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });

  it('UID не зависит от времени генерации (повторный импорт обновляет, а не дублирует)', () => {
    const a = buildBBSpecIcs(spec as any, { startDate: '2026-11-02' })!;
    const b = buildBBSpecIcs(spec as any, { startDate: '2026-11-02' })!;
    const uid = (s: string) => (s.match(/UID:[^\r\n]+/) || [''])[0];
    expect(uid(a)).toBe(uid(b));
    const other = buildBBSpecIcs({ ...spec, weakZones: ['delt_mid'] } as any, { startDate: '2026-11-02' })!;
    expect(uid(other)).not.toBe(uid(a));
  });
});

describe('W3-4 инъекция: делод-неделя по phase, а не только по deload:true', () => {
  const mkPlan = (): BBPlan => ({
    pattern: { id: 'p', name: 'P', sessionsPerRotation: 4 } as any,
    weeks: [
      { week: 1, phase: 'taper', sessions: [{ day: 1, weekOffset: 0, character: 'light', exercises: [{ muscle: 'chest', name: 'Жим штанги лёжа', sets: 4, role: 'primary', exerciseName: 'bench_bar', workSets: [] }] }] },
      { week: 2, sessions: [{ day: 1, weekOffset: 1, character: 'heavy', exercises: [{ muscle: 'chest', name: 'Жим штанги лёжа', sets: 4, role: 'primary', exerciseName: 'bench_bar', workSets: [] }] }] },
    ],
    rationale: [],
    level: 'intermediate',
  } as any);

  it('подводка (phase: taper) не получает вставок', () => {
    const plan = mkPlan();
    const before = JSON.stringify(plan.weeks[0]);
    const res = injectBBWeakPoints(plan, ['delt_mid'], { weekIdxs: [0, 1] } as any);
    expect(JSON.stringify(res.plan.weeks[0])).toBe(before);
    expect(res.injected).toBe(1);
  });
});

describe('W3-5 ACWR: числовое поле sets тоже считается', () => {
  const weeks = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'];
  const sessions = weeks.map((d, i) => ({
    date: d,
    exercises: [{ muscleGroup: 'chest', sets: i === 4 ? 12 : 10 }],
  }));

  it('sets: 12 (число) даёт объём, а не ноль', () => {
    const acwr = computePerMuscleACWR(sessions as any);
    expect(acwr.chest).toBeTruthy();
    expect(acwr.chest.ratio).toBeGreaterThan(0);
  });
});

describe('W3-6 темп: «паузы нет» говорим только когда темп известен', () => {
  const ex = { name: 'Французский жим лёжа', muscle: 'triceps' };

  it('без темпа — флаг линии НЕ ставится (данных нет)', () => {
    const d = diagnoseExercise({ ...ex } as any, {});
    expect(d.flags).not.toContain('resistanceLineGap');
  });

  it('явный темп 3-0-1-0 — паузы нет, флаг линии ставится', () => {
    const d = diagnoseExercise({ ...ex, tempo: '3-0-1-0' } as any, {});
    expect(d.flags).toContain('resistanceLineGap');
  });

  it('явный темп с паузой 3-1-1-0 — флага линии нет', () => {
    const d = diagnoseExercise({ ...ex, tempo: '3-1-1-0' } as any, {});
    expect(d.flags).not.toContain('resistanceLineGap');
  });
});

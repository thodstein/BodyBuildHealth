/**
 * planner-weight-adaptation-real-only.test.ts — B17 (аудит 2026-10).
 *
 * Находка: при первом открытии планировщик создаёт 3 сид-записи текущего веса с
 * пометкой `synthetic: true`. Они корректно НЕ пишутся в канонический лог профиля,
 * но в `weightLogWeek` (вход адаптации калорийности) уходил весь список, включая
 * сид. Итог: адаптация видела «вес не меняется» на фейковых данных и молча
 * урезала дефицит/калораж.
 *
 * Замок: в адаптацию уходят только реальные замеры.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { realWeightSeries } from '../planner-targets';

describe('B17: синтетические записи веса не питают адаптацию', () => {
  it('контекст действительно кормит адаптацию через realWeightSeries', () => {
    const src = readFileSync(join(__dirname, '..', 'IndividualPlanContext.tsx'), 'utf8');
    expect(src).toMatch(/setWeightLogWeek\(\s*realWeightSeries\(/);
    // старой «сырой» записи быть не должно
    expect(src).not.toMatch(/setWeightLogWeek\(\s*weightLogEntries\s*\.filter/);
  });

  it('сид из 3 записей не даёт серию для тренда', () => {
    const seed = [
      { date: '2026-10-27', weight: 95, synthetic: true },
      { date: '2026-10-28', weight: 95, synthetic: true },
      { date: '2026-10-29', weight: 95, synthetic: true },
    ];
    // РАНЬШЕ: [95, 95, 95] → «нет потери» → weightAdj < 1 (урезание калоража)
    expect(realWeightSeries(seed)).toEqual([]);
  });

  it('реальные замеры сохраняются, синтетические выкидываются', () => {
    const entries = [
      { date: '2026-10-01', weight: 95, synthetic: true },
      { date: '2026-10-08', weight: 94.2 },
      { date: '2026-10-15', weight: 93.4 },
    ];
    expect(realWeightSeries(entries)).toEqual([94.2, 93.4]);
  });

  it('порядок — по дате, а не по порядку в массиве (тренд не инвертируется)', () => {
    const entries = [
      { date: '2026-10-15', weight: 93.4 },
      { date: '2026-10-01', weight: 95 },
      { date: '2026-10-08', weight: 94.2 },
    ];
    expect(realWeightSeries(entries)).toEqual([95, 94.2, 93.4]);
  });

  it('одна реальная запись — меньше двух точек, адаптация не включается', () => {
    expect(realWeightSeries([{ date: '2026-10-08', weight: 94 }])).toHaveLength(1);
  });

  it('мусорные веса отбрасываются', () => {
    const entries = [
      { date: '2026-10-01', weight: 0 },
      { date: '2026-10-02', weight: -5 },
      { date: '2026-10-03', weight: NaN },
      { date: '2026-10-04', weight: 94 },
    ];
    expect(realWeightSeries(entries as any)).toEqual([94]);
  });

  it('synthetic:false (или отсутствие флага) считается реальной записью', () => {
    expect(realWeightSeries([
      { date: '2026-10-01', weight: 95, synthetic: false },
      { date: '2026-10-02', weight: 94 },
    ])).toEqual([95, 94]);
  });

  it('пустой/битый вход не бросает', () => {
    expect(realWeightSeries([])).toEqual([]);
    expect(realWeightSeries(null)).toEqual([]);
    expect(realWeightSeries(undefined)).toEqual([]);
  });
});

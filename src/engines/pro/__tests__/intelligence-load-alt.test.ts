import { describe, expect, it } from 'vitest';
import {
  differentialLoad, sacwr, loadClassification, loadAltFromSessions,
  SACWR_METHOD_NOTE, LOAD_CLASS_NOTE,
} from '../intelligence-load-alt.engine';
import {
  muscleLoadReport, normalizeMuscleEntries, rirIntensityFactor,
  planVsActualPerMuscle, muscleDailyMatrix, PER_MUSCLE_NOTE,
  type MuscleSetEntry,
} from '../intelligence-permuscle.engine';
import { toDailyLoads, type DayLoad } from '../training-load.engine';

function loads(pairs: [string, number][]): DayLoad[] {
  return pairs.map(([date, load]) => ({ date, load })).sort((a, b) => a.date < b.date ? -1 : 1);
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function back(n: number, from = new Date(2026, 8, 28)): string {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() - n);
  return iso(d);
}

describe('E5 sACWR / дифф-загрузка', () => {
  it('диффы 1/7/28д считаются к предыдущему окну', () => {
    const rows: [string, number][] = [];
    for (let i = 27; i >= 0; i--) rows.push([back(i), 300]);
    // последний день — 600 (предыдущий остаётся 300, чтобы окно «1 день назад» было сравнимым)
    rows[rows.length - 1][1] = 600;
    const d = differentialLoad(loads(rows), back(0));
    const w1 = d.windows.find(w => w.days === 1)!;
    const w7 = d.windows.find(w => w.days === 7)!;
    const w28 = d.windows.find(w => w.days === 28)!;
    expect(w1.current).toBe(600); expect(w1.previous).toBe(300); expect(w1.deltaPct).toBe(100);
    expect(w7.current).toBe(300 * 6 + 600); expect(w7.previous).toBe(300 * 7);
    expect(w7.deltaPct).toBe(14);   // 2100 → 2400 (последний день 600 вместо 300)
    expect(w28.deltaPct).toBeNull(); // предыдущие 28 дней пусты — базы нет, а не «0%»
    // среднесуточные — окна одинаковой длины
    expect(d.perDay.find(p => p.days === 7)!.current).toBeCloseTo(w7.current / 7, 5);
  });

  it('28-дневная дельта считается, когда база есть (56 дней данных)', () => {
    const rows: [string, number][] = [];
    for (let i = 55; i >= 0; i--) rows.push([back(i), i < 28 ? 600 : 300]);
    const d = differentialLoad(loads(rows), back(0));
    const w28 = d.windows.find(w => w.days === 28)!;
    expect(w28.current).toBe(600 * 28);
    expect(w28.previous).toBe(300 * 28);
    expect(w28.deltaPct).toBe(100);
  });

  it('отпуск читается как спад, а не как рост (нулевые дни в базе)', () => {
    const rows: [string, number][] = [];
    for (let i = 27; i >= 0; i--) rows.push([back(i), i < 7 ? 0 : 500]);
    const d = differentialLoad(loads(rows), back(0));
    const w7 = d.windows.find(w => w.days === 7)!;
    expect(w7.current).toBe(0);
    expect(w7.deltaPct).toBe(-100);
  });

  it('нет данных → deltaPct null (не «0%» и не деление на ноль)', () => {
    const d = differentialLoad([{ date: back(0), load: 400 }], back(0));
    expect(d.windows.find(w => w.days === 7)!.deltaPct).toBeNull();
    expect(d.windows.find(w => w.days === 1)!.deltaPct).toBeNull();
  });

  it('sACWR: ровная нагрузка = 1.00, отличие от coupled RA показано', () => {
    const rows: [string, number][] = [];
    for (let i = 27; i >= 0; i--) rows.push([back(i), 500]);
    const s = sacwr(loads(rows), back(0), 1)!;
    expect(s.ratio).toBeCloseTo(1, 2);
    expect(s.method).toBe('sacwr_ewma');
    expect(s.note).toBe(SACWR_METHOD_NOTE);
    expect(s.vsCoupledRa).toBeCloseTo(0, 2);
  });

  it('sACWR реагирует на всплеск так же, как растёт острое EWMA', () => {
    const rows: [string, number][] = [];
    for (let i = 27; i >= 0; i--) rows.push([back(i), 300]);
    rows[rows.length - 1][1] = 900;
    const s = sacwr(loads(rows), back(0))!;
    expect(s.ratio).toBeGreaterThan(1.2);
    expect(s.acuteEwma).toBeGreaterThan(s.chronicEwma);
  });

  it('пустой ряд → sACWR null, а не 0 (0 читался бы как «нет нагрузки»)', () => {
    expect(sacwr([], back(0))).toBeNull();
  });

  it('классификация: недотрен/норма/высокая/всплеск + честная оговорка', () => {
    expect(loadClassification(0.7, 0).class).toBe('undertrained');
    expect(loadClassification(1.1, 5).class).toBe('normal');
    expect(loadClassification(1.45, 10).class).toBe('high');
    expect(loadClassification(1.2, 80).class).toBe('spike'); // всплеск важнее зоны
    expect(loadClassification(1.1, 0).note).toBe(LOAD_CLASS_NOTE);
  });

  it('точка входа из сессий: дифф + sACWR + классификация одним вызовом', () => {
    const sessions = Array.from({ length: 21 }, (_, i) => ({ date: back(20 - i), sRPE: 8, durationMin: 60 }));
    const res = loadAltFromSessions(sessions as any, back(0), 1);
    expect(res.sacwr).not.toBeNull();
    expect(res.classification).not.toBeNull();
    expect(res.diff.windows).toHaveLength(3);
    // детерминизм
    const again = loadAltFromSessions(sessions as any, back(0), 1);
    expect(again.sacwr!.ratio).toBe(res.sacwr!.ratio);
  });
});

describe('E5 нагрузка по мышцам и перекос', () => {
  const entries: MuscleSetEntry[] = [];
  // последняя неделя: грудь 12 подходов @RIR2, спина 8 @RIR1
  for (let i = 0; i < 6; i++) entries.push({ date: back(i), muscle: 'chest', sets: 2, avgRir: 2, rirKnown: true });
  for (let i = 0; i < 4; i++) entries.push({ date: back(i), muscle: 'back', sets: 2, avgRir: 1, rirKnown: true });
  // предыдущая неделя: грудь была 8 подходов (4 дня), т.е. +50% за неделю
  for (let i = 7; i < 11; i++) entries.push({ date: back(i), muscle: 'chest', sets: 2, avgRir: 2, rirKnown: true });
  // 28-дневная база
  for (let i = 20; i < 27; i++) entries.push({ date: back(i), muscle: 'back', sets: 2, avgRir: 1, rirKnown: true });

  it('коэффициент RIR: ближе к отказу = тяжелее', () => {
    expect(rirIntensityFactor(0)).toBe(1);
    expect(rirIntensityFactor(2)).toBeLessThan(rirIntensityFactor(1));
    expect(rirIntensityFactor(4)).toBeLessThan(rirIntensityFactor(3));
    expect(rirIntensityFactor(undefined)).toBe(0.9); // нейтраль, не «отказ»
  });

  it('санация входа: мусорные даты/мышцы/сеты отбрасываются', () => {
    const clean = normalizeMuscleEntries([
      { date: 'не-дата', muscle: 'chest', sets: 3, rirKnown: false },
      { date: back(0), muscle: '  ', sets: 3, rirKnown: false },
      { date: back(0), muscle: 'chest', sets: 0, rirKnown: false },
      { date: back(0), muscle: 'chest', sets: NaN, rirKnown: false },
      { date: back(0), muscle: 'legs', sets: 4, avgRir: 3, rirKnown: true },
    ]);
    expect(clean).toHaveLength(1);
    expect(clean[0].muscle).toBe('legs');
  });

  it('недельная нагрузка и дельта к 7/28-дневной базе', () => {
    const rep = muscleLoadReport(entries, back(0));
    const chest = rep.muscles.find(m => m.muscle === 'chest')!;
    const backMuscle = rep.muscles.find(m => m.muscle === 'back')!;
    expect(chest.sets).toBe(12);
    expect(backMuscle.sets).toBe(8);
    // грудь: 12 подходов × 0.9 = 10.8
    expect(chest.load).toBeCloseTo(10.8, 5);
    // спина: 8 × 0.95 = 7.6
    expect(backMuscle.load).toBeCloseTo(7.6, 5);
    expect(chest.delta7dPct).toBe(50);   // было 8, стало 12
    expect(backMuscle.delta28dPct).toBeLessThan(0); // в 28-дневной базе спины больше
    expect(chest.rirKnownShare).toBe(1);
  });

  it('индекс перекоса: 100 = вся нагрузка в одной мышце, 0 = пусто', () => {
    const single = muscleLoadReport([{ date: back(0), muscle: 'chest', sets: 10, rirKnown: true }], back(0));
    expect(single.imbalance.score).toBe(100);
    const empty = muscleLoadReport([], back(0));
    expect(empty.imbalance.score).toBe(0);
    expect(empty.totalSets).toBe(0);
  });

  it('честная доля известного RIR (прокси не выдаётся за точный)', () => {
    const rep = muscleLoadReport([
      { date: back(0), muscle: 'chest', sets: 2, avgRir: 2, rirKnown: true },
      { date: back(0), muscle: 'back', sets: 2, rirKnown: false },
    ], back(0));
    expect(rep.muscles.find(m => m.muscle === 'chest')!.rirKnownShare).toBe(1);
    expect(rep.muscles.find(m => m.muscle === 'back')!.rirKnownShare).toBe(0);
    expect(rep.note).toBe(PER_MUSCLE_NOTE);
  });

  it('план vs факт по мышцам: дельта подходов и доля', () => {
    const rep = muscleLoadReport(entries, back(0));
    const rows = planVsActualPerMuscle(rep, { chest: 10, legs: 6 });
    const chest = rows.find(r => r.muscle === 'chest')!;
    expect(chest.planSets).toBe(10); expect(chest.actualSets).toBe(12);
    expect(chest.deltaSets).toBe(2); expect(chest.deltaPct).toBe(20);
    const legs = rows.find(r => r.muscle === 'legs')!;
    expect(legs.actualSets).toBe(0); expect(legs.deltaSets).toBe(-6);
    expect(legs.deltaPct).toBe(-100);
  });

  it('матрица мышца×день для графика (28 дней, нули заполнены)', () => {
    const m = muscleDailyMatrix(entries, back(0), 28);
    expect(m.dates).toHaveLength(28);
    expect(m.muscles).toEqual(['back', 'chest']);
    expect(m.rows.chest.reduce((a, b) => a + b, 0)).toBe(12 + 8);
  });

  it('детерминизм: два прогона на одних данных совпадают', () => {
    const a = muscleLoadReport(entries, back(0));
    const b = muscleLoadReport([...entries], back(0));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

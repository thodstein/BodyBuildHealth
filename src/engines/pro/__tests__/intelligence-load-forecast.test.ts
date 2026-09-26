import { describe, expect, it } from 'vitest';
import { loadForecast, performanceTrajectory, LOAD_FORECAST_NOTE, CONSECUTIVE_DAYS_NOTE, TRAJECTORY_NOTE, type TrajectoryPoint } from '../intelligence-load-forecast.engine';
import { generateReadinessForecast, runWhatIf } from '../../predictive.engine';
import type { DayLoad } from '../training-load.engine';

function iso(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function back(n: number, from = new Date(2026, 8, 28)): string { const d = new Date(from.getTime()); d.setDate(d.getDate()-n); return iso(d); }
function loads(v: number, days: number, from = new Date(2026, 8, 28)): DayLoad[] {
  const out: DayLoad[] = [];
  for (let i = days-1; i >= 0; i--) { const d = new Date(from.getTime()); d.setDate(d.getDate()-i); out.push({ date: iso(d), load: v }); }
  return out;
}

describe('E6 прогноз нагрузки (EWMA)', () => {
  it('ровная нагрузка: уровень = факту, неделя = 7×уровень, разброс симметричен', () => {
    const f = loadForecast(loads(100, 21), back(0), 7);
    expect(f.level).toBeCloseTo(100, 0);
    expect(f.weeklyTotal).toBe(700);
    expect(f.weeklyBand[0]).toBeLessThanOrEqual(700);
    expect(f.weeklyBand[1]).toBeGreaterThanOrEqual(700);
    expect(f.perDay).toHaveLength(7);
    expect(f.perDay[0].date).toBe(back(-1));
  });

  it('3+ дня подряд → мягкий ориентир на следующий день и честный текст', () => {
    const f = loadForecast(loads(100, 5), back(0), 7);
    expect(f.consecutiveDays).toBe(5);
    expect(f.suggestedCap).toBe(Math.round(f.level * 0.85));
    expect(f.guidance).toContain('Ориентир');
    expect(f.guidance).toContain('Решение за вами');
    expect(f.note).toBe(`${LOAD_FORECAST_NOTE} ${CONSECUTIVE_DAYS_NOTE}`);
    expect(f.note).toContain('не автоблокировка');
  });

  it('разрыв нагрузки обнуляет счётчик дней подряд', () => {
    // 3 дня нагрузки ЗАКАНЧИВАЮТСЯ на back(2), дальше 4 нулевых дня (включая сегодня) —
    // окна не перекрываются, иначе нули «сложились» бы с нагрузкой тех же дат.
    const threeDaysAgo = new Date(new Date(2026, 8, 28).getTime()); threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
    const rows = [...loads(300, 3, threeDaysAgo), ...loads(0, 4)];
    const f = loadForecast(rows, back(0), 7);
    expect(f.consecutiveDays).toBe(0); // сегодня отдых
    expect(f.suggestedCap).toBeNull();
    expect(f.guidance).toContain('порог на 1-й день не применяется');
  });

  it('нет данных — нули не выдаются за прогноз (текст объясняет)', () => {
    const f = loadForecast([], back(0), 7);
    expect(f.level).toBe(0);
    expect(f.guidance).toContain('Нет данных о нагрузке');
  });

  it('прогноз детерминирован', () => {
    const a = loadForecast(loads(120, 14), back(0), 7);
    const b = loadForecast([...loads(120, 14)].reverse(), back(0), 7);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('E6 траектория показателей', () => {
  const rising = (n: number, from: number, step: number): TrajectoryPoint[] =>
    Array.from({ length: n }, (_, i) => ({ date: back((n - 1 - i) * 7), value: from + i * step }));

  it('растущий e1RM: направление up, проекция продолжает тренд', () => {
    const [e1rm] = performanceTrajectory({ e1rm: rising(6, 100, 5) }, back(0), 7);
    expect(e1rm.current).toBe(125);
    expect(e1rm.direction).toBe('up');
    expect(e1rm.changePct).toBeGreaterThan(0);
    expect(e1rm.projection).toHaveLength(7);
    expect(e1rm.projection[6].value).toBeGreaterThan(e1rm.current!);
    expect(e1rm.measurable).toBe(true);
  });

  it('вес падает → down; объём без точек → честная пустая серия', () => {
    const series = performanceTrajectory({ bodyweight: rising(5, 90, -0.5), volume: [] }, back(0), 7);
    const bw = series.find(s => s.key === 'bodyweight')!;
    const vol = series.find(s => s.key === 'volume')!;
    expect(bw.direction).toBe('down');
    expect(vol.current).toBeNull();
    expect(vol.direction).toBe('unknown');
    expect(vol.projection).toHaveLength(0);
    expect(vol.note).toContain('нужно ≥2 замера');
  });

  it('<3 точек помечается как низкая уверенность, ≥3 — нет', () => {
    const [two, three] = performanceTrajectory({ e1rm: rising(2, 100, 1), bodyweight: rising(3, 80, 0.2) }, back(0));
    expect(two.lowConfidence).toBe(true);
    expect(two.note).toContain('ориентировочное');
    expect(three.lowConfidence).toBe(false);
  });

  it('мусорные точки (NaN/битая дата) отбрасываются, а не ломают тренд', () => {
    const [s] = performanceTrajectory({ e1rm: [
      { date: 'мусор', value: 100 }, { date: back(7), value: Number.NaN }, { date: back(0), value: 110 },
    ] }, back(0));
    expect(s.points).toHaveLength(1);
    expect(s.changePerWeek).toBeNull();
    expect(s.direction).toBe('unknown');
  });

  it('оговорка честно разделяет измеримое и производное', () => {
    expect(TRAJECTORY_NOTE).toContain('измеримые');
    expect(TRAJECTORY_NOTE).toContain('невалидированн');
  });
});

describe('E6/F1–F3+F5 починенные дефекты прогноза', () => {
  it('F1: <2 точек → пустой прогноз с предупреждением, а не «уверенные нули»', () => {
    const f = generateReadinessForecast([]);
    expect(f.hasData).toBe(false);
    expect(f.values).toEqual([]);
    expect(f.ci95).toEqual([]);
    expect(f.warnings.length).toBeGreaterThan(0);
    expect(f.warnings[0]).toContain('Нет истории готовности');
    const one = generateReadinessForecast([70]);
    expect(one.hasData).toBe(false);
  });

  it('F2: предупреждение про спад привязано к ~5-му дню, а не к 3-му', () => {
    // падающий ряд: 90 → 30 за 5 шагов
    const f = generateReadinessForecast([90, 84, 78, 72, 66, 60, 54, 48, 42, 36]);
    expect(f.hasData).toBe(true);
    const warn = f.warnings.join(' ');
    expect(warn).toMatch(/упадёт примерно до [\d.]+ через ~5 дней/);
    // бессмысленного «Fatigue превысит 70» при ВЫСОКОЙ готовности больше нет
    const high = generateReadinessForecast([60, 66, 72, 78, 84, 88, 90, 92]);
    expect(high.warnings.join(' ')).not.toContain('Fatigue');
  });

  it('F2: устойчивый спад без падения <40 всё равно даёт сигнал про делод', () => {
    const f = generateReadinessForecast([70, 67, 64, 61, 58, 55, 52, 49]);
    expect(f.warnings.join(' ')).toMatch(/Устойчивый спад/);
  });

  it('F3: шаг сценария масштабируется — +1 и +500 ккал дают разный эффект', () => {
    const tiny = runWhatIf(30, 70, { calorieChange: 1 });
    const mid = runWhatIf(30, 70, { calorieChange: 500 });
    const big = runWhatIf(30, 70, { calorieChange: 1000 });
    expect(tiny.readinessDelta).toBe(0);
    expect(mid.readinessDelta).toBe(2);
    expect(big.readinessDelta).toBe(4); // плато
    expect(runWhatIf(30, 70, { calorieChange: -1000 }).readinessDelta).toBe(-4);
    expect(tiny.note).toContain('±250 ккал');
  });

  it('F3: сон масштабируется и клампится, мусорные входы игнорируются', () => {
    expect(runWhatIf(30, 70, { sleepChange: 1 }).readinessDelta).toBe(5);
    expect(runWhatIf(30, 70, { sleepChange: -5 }).readinessDelta).toBe(-15);
    const junk = runWhatIf(Number.NaN, Number.NaN, { calorieChange: Number.NaN, sleepChange: Number.NaN, drugChange: { X: Number.NaN } });
    expect(Number.isFinite(junk.riskDelta)).toBe(true);
    expect(junk.riskDelta).toBe(0);
    expect(junk.readinessDelta).toBe(0);
  });

  it('F3: база сценария — фактическое значение, дельта считается от него', () => {
    const r = runWhatIf(48, 62, { drugChange: { AAS: 1.5 } });
    expect(r.riskDelta).toBe(6); // (1.5-1)*12
    expect(r.readinessDelta).toBe(0);
    expect(r.note).toContain('AAS');
  });

  it('F5: NaN в истории не попадает в координаты', () => {
    const f = generateReadinessForecast([60, Number.NaN, 70, 72, 74, 76, 78, 80]);
    expect(f.hasData).toBe(true);
    expect(f.values.every(v => Number.isFinite(v))).toBe(true);
    expect(f.ci95.every(([a, b]) => Number.isFinite(a) && Number.isFinite(b))).toBe(true);
  });

  it('ранний прогноз (<7 точек) по-прежнему помечается как ориентир', () => {
    const f = generateReadinessForecast([60, 62, 64]);
    expect(f.confidence).toBe('early');
    expect(f.warnings.join(' ')).toContain('Ранний прогноз');
  });
});

import { describe, expect, it } from 'vitest';
import {
  acuteChronicRatio,
  trainingLoadReport,
  ACWR_DISCLAIMER,
  ACWR_ZONE_META,
  ACWR_CHRONIC_FLOOR_DEFAULT,
  type DayLoad,
} from '../training-load.engine';

function flatLoads(days: number, load: number, end = '2026-07-28'): DayLoad[] {
  const out: DayLoad[] = [];
  const e = new Date(end);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(e);
    d.setDate(d.getDate() - i);
    out.push({ date: d.toISOString().slice(0, 10), load });
  }
  return out;
}

describe('P1 честный ACWR', () => {
  it('дефолт — coupled_ra для совместимости (40+ потребителей не меняются)', () => {
    const loads = [...flatLoads(21, 300, '2026-07-21'), ...flatLoads(7, 600, '2026-07-28')];
    const r = acuteChronicRatio(loads, '2026-07-28');
    expect(r.method).toBe('coupled_ra');
    expect(r.lowBase).toBe(false);
    expect(r.acute).toBe(600);
    expect(r.chronic).toBe((21 * 300 + 7 * 600) / 28); // 375 — острая входит в хроническую
    expect(r.ratio).toBeCloseTo(1.6, 2);
  });

  it('ewma_uncoupled исключает острую неделю из хронической', () => {
    const loads = [...flatLoads(21, 300, '2026-07-21'), ...flatLoads(7, 600, '2026-07-28')];
    const r = acuteChronicRatio(loads, '2026-07-28', 7, 28, { method: 'ewma_uncoupled' });
    expect(r.method).toBe('ewma_uncoupled');
    expect(r.chronic).toBeCloseTo(300, 1); // константа 300 — EWMA даёт ровно 300
    expect(r.acute).toBeCloseTo(600, 1);
    expect(r.ratio).toBeCloseTo(2, 1);
    expect(r.zone).toBe('dangerous');
  });

  it('EWMA взвешивает свежие дни сильнее (пик в последний день > пика в первый)', () => {
    const base = flatLoads(28, 300, '2026-07-28');
    const lateSpike = base.map((d, i) => (i === 27 ? { ...d, load: 900 } : d));
    const earlySpike = base.map((d, i) => (i === 21 ? { ...d, load: 900 } : d));
    const late = acuteChronicRatio(lateSpike, '2026-07-28', 7, 28, { method: 'ewma_uncoupled' });
    const early = acuteChronicRatio(earlySpike, '2026-07-28', 7, 28, { method: 'ewma_uncoupled' });
    expect(late.acute).toBeGreaterThan(early.acute);
    // coupled RA оба пика считает одинаково (среднее окна)
    const lateC = acuteChronicRatio(lateSpike, '2026-07-28');
    const earlyC = acuteChronicRatio(earlySpike, '2026-07-28');
    expect(lateC.acute).toBeCloseTo(earlyC.acute, 6);
  });

  it('тонкая база: lowBase + зона не выше caution', () => {
    const loads = [...flatLoads(21, 20, '2026-07-21'), ...flatLoads(7, 200, '2026-07-28')];
    const r = acuteChronicRatio(loads, '2026-07-28', 7, 28, { method: 'ewma_uncoupled' });
    expect(r.chronic).toBeLessThan(ACWR_CHRONIC_FLOOR_DEFAULT);
    expect(r.lowBase).toBe(true);
    expect(r.ratio).toBeGreaterThan(1.5);
    expect(r.zone).toBe('caution'); // красную на тонкой базе не ставим
  });

  it('пусто — undertrained без флага', () => {
    const r = acuteChronicRatio([], undefined, 7, 28, { method: 'ewma_uncoupled' });
    expect(r.zone).toBe('undertrained');
    expect(r.ratio).toBe(0);
    expect(r.lowBase).toBe(false);
  });

  it('дисклеймер в отчёте честно ограничивает интерпретацию', () => {
    expect(ACWR_DISCLAIMER).toContain('Impellizzeri');
    const report = trainingLoadReport(
      [
        { date: '2026-07-20', sRPE: 7, durationMin: 60 },
        { date: '2026-07-22', sRPE: 8, durationMin: 60 },
      ],
      '2026-07-28',
    );
    expect(report.disclaimer).toBe(ACWR_DISCLAIMER);
  });

  it('канон зон един: метки/цвета совпадают с хабом', () => {
    expect(ACWR_ZONE_META.undertrained).toEqual({ label: 'Недотрен', color: '#3b82f6' });
    expect(ACWR_ZONE_META.optimal).toEqual({ label: 'Оптимум', color: '#22c55e' });
    expect(ACWR_ZONE_META.caution).toEqual({ label: 'Осторожно', color: '#eab308' });
    expect(ACWR_ZONE_META.dangerous).toEqual({ label: 'Опасно', color: '#ef4444' });
  });
});

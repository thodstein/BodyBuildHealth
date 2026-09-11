import { describe, expect, it } from 'vitest';
import {
  acuteChronicRatio,
  toDailyLoads,
  trainingLoadReport,
  banisterForm,
  monotonyStreak,
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

  it('F1 отчёт тем же методом: цифры совпадают с прямым расчётом пульта', () => {
    const sessions = Array.from({ length: 28 }, (_, i) => ({
      date: `2026-07-${String(i + 1).padStart(2, '0')}`,
      sRPE: 7,
      durationMin: 60,
    }));
    const rep = trainingLoadReport(sessions, '2026-07-28', { method: 'ewma_uncoupled' });
    const direct = acuteChronicRatio(toDailyLoads(sessions), '2026-07-28', 7, 28, { method: 'ewma_uncoupled' });
    expect(rep.acwr.method).toBe('ewma_uncoupled');
    expect(rep.acwr.ratio).toBe(direct.ratio);
    expect(rep.acwr.zone).toBe(direct.zone);
  });

  it('F2 нестандартные окна работают тем же методом', () => {
    const loads = [...flatLoads(7, 300, '2026-07-21'), ...flatLoads(7, 600, '2026-07-28')];
    const r = acuteChronicRatio(loads, '2026-07-28', 7, 14, { method: 'ewma_uncoupled' });
    expect(r.method).toBe('ewma_uncoupled');
    expect(r.chronicDays).toBe(14);
    expect(r.ratio).toBeGreaterThan(1);
  });

  it('канон зон един: метки/цвета совпадают с хабом', () => {
    expect(ACWR_ZONE_META.undertrained).toEqual({ label: 'Недотрен', color: '#3b82f6' });
    expect(ACWR_ZONE_META.optimal).toEqual({ label: 'Оптимум', color: '#22c55e' });
    expect(ACWR_ZONE_META.caution).toEqual({ label: 'Осторожно', color: '#eab308' });
    expect(ACWR_ZONE_META.dangerous).toEqual({ label: 'Опасно', color: '#ef4444' });
  });
});

describe('P6 Banister-форма z-трендом', () => {
  it('null при <7 точек', () => {
    expect(banisterForm(flatLoads(5, 400))).toBeNull();
  });

  it('плато на долгой ровной нагрузке (5τ фитнеса ≈ 210+ дн)', () => {
    const f = banisterForm(flatLoads(300, 400))!;
    expect(f.trend).toBe('flat');
  });

  it('на ramp-up форма растёт (фитнес копится быстрее утомления)', () => {
    const f = banisterForm(flatLoads(14, 400))!;
    expect(f.trend).toBe('up');
  });

  it('разгрузка после нагрузки — форма растёт', () => {
    const loads = [...flatLoads(14, 500, '2026-07-21'), ...flatLoads(7, 0, '2026-07-28')];
    const f = banisterForm(loads)!;
    expect(f.trend).toBe('up');
  });

  it('ударная неделя после отдыха — форма падает', () => {
    const loads = [...flatLoads(14, 100, '2026-07-21'), ...flatLoads(7, 900, '2026-07-28')];
    const f = banisterForm(loads)!;
    expect(f.trend).toBe('down');
  });
});

describe('D2 monotonyStreak — честные 2 недели подряд', () => {
  // почти ровные недели 500 (один день 480): mean/sd >> 2 — настоящее однообразие по Фостеру
  function flatWeek(end: string): DayLoad[] {
    const out: DayLoad[] = [];
    const e = new Date(end);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(e);
      d.setDate(d.getDate() - i);
      out.push({ date: d.toISOString().slice(0, 10), load: i === 3 ? 480 : 500 });
    }
    return out;
  }
  // рваная неделя 200/800 через день: высокая вариативность
  function variedWeek(end: string): DayLoad[] {
    const out: DayLoad[] = [];
    const e = new Date(end);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(e);
      d.setDate(d.getDate() - i);
      out.push({ date: d.toISOString().slice(0, 10), load: i % 2 === 0 ? 200 : 800 });
    }
    return out;
  }

  it('пусто — не sustained', () => {
    expect(monotonyStreak([]).sustainedHigh).toBe(false);
  });

  it('одна монотонная неделя — не sustained (нужны две)', () => {
    const s = monotonyStreak(flatWeek('2026-07-28'), 2);
    expect(s.current).toBeGreaterThan(2);
    expect(s.sustainedHigh).toBe(false); // прошлой недели нет в данных
  });

  it('две монотонные недели подряд — sustained', () => {
    const loads = [...flatWeek('2026-07-21'), ...flatWeek('2026-07-28')];
    const s = monotonyStreak(loads, 2);
    expect(s.sustainedHigh).toBe(true);
  });

  it('рваная текущая неделя сбрасывает флаг', () => {
    const loads = [...flatWeek('2026-07-21'), ...variedWeek('2026-07-28')];
    const s = monotonyStreak(loads, 2);
    expect(s.current).toBeLessThanOrEqual(2);
    expect(s.sustainedHigh).toBe(false);
  });

  it('F2 три недели: все ровные — sustained, третья рваная — нет', () => {
    const even = [...flatWeek('2026-07-14'), ...flatWeek('2026-07-21'), ...flatWeek('2026-07-28')];
    expect(monotonyStreak(even, 3).sustainedHigh).toBe(true);
    const broken = [...flatWeek('2026-07-14'), ...flatWeek('2026-07-21'), ...variedWeek('2026-07-28')];
    expect(monotonyStreak(broken, 3).sustainedHigh).toBe(false);
  });
});

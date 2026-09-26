import { describe, expect, it } from 'vitest';
import {
  acuteChronicRatio,
  toDailyLoads,
  weeklyMonotony,
  trainingLoadReport,
  banisterForm,
  monotonyStreak,
  ACWR_DISCLAIMER,
  ACWR_ZONE_META,
  ACWR_WINDOW_NOTE,
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
  it('дефолт — ewma_uncoupled; coupled_ra остаётся доступен явно (P0-В, было→стало)', () => {
    const loads = [...flatLoads(21, 300, '2026-07-21'), ...flatLoads(7, 600, '2026-07-28')];
    // БЫЛО: дефолт = coupled_ra «для совместимости 40+ потребителей».
    // СТАЛО: дефолт = EWMA uncoupled (Impellizzeri 2020, PMID 31846477: rolling-average
    // coupled непригоден на 2-дневной неделе). coupled_ra сохранён как явная опция.
    const dflt = acuteChronicRatio(loads, '2026-07-28');
    expect(dflt.method).toBe('ewma_uncoupled');
    expect(dflt.chronic).toBeCloseTo(300, 1); // хроническая БЕЗ острой недели

    const coupled = acuteChronicRatio(loads, '2026-07-28', 7, 28, { method: 'coupled_ra' });
    expect(coupled.method).toBe('coupled_ra');
    expect(coupled.lowBase).toBe(false);
    expect(coupled.acute).toBe(600);
    expect(coupled.chronic).toBe((21 * 300 + 7 * 600) / 28); // 375 — острая входит в хроническую
    expect(coupled.ratio).toBeCloseTo(1.6, 2);
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
    // coupled RA оба пика считает одинаково (среднее окна) — метод указываем ЯВНО:
    // до P0-В этот блок неявно брал дефолт, т.е. тест назывался EWMA, а проверял coupled.
    const lateC = acuteChronicRatio(lateSpike, '2026-07-28', 7, 28, { method: 'coupled_ra' });
    const earlyC = acuteChronicRatio(earlySpike, '2026-07-28', 7, 28, { method: 'coupled_ra' });
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

  it('P0-В: coupled тоже не пугает красным на тонкой базе (было ratio 2 → dangerous)', () => {
    // Регрессия, закрытая P0-В: при chronic=0 и acute>0 coupled-путь ставил ratio=2 → 'dangerous'
    // при lowBase:false. Две тренировки в дневнике = артефакт данных, а не «опасная зона».
    const sparse = [{ date: '2026-07-28', load: 200 }];
    const r = acuteChronicRatio(sparse, '2026-07-28', 7, 28, { method: 'coupled_ra' });
    expect(r.lowBase).toBe(true);
    expect(r.zone).not.toBe('dangerous');
    expect(r.zone).toBe('caution');
  });

  it('P0-В: дефолт = EWMA даже без opts (2-дневная неделя не читается как скачок)', () => {
    // coupled на 2-дневной неделе: 28-дневное окно = 20 нулевых дней → chronic занижен → ratio взлетает.
    const twoPerWeek: DayLoad[] = [];
    for (let w = 0; w < 4; w++) {
      twoPerWeek.push({ date: `2026-07-0${(w * 2) + 7}`, load: 600 });
      twoPerWeek.push({ date: `2026-07-${(w * 2) + 10}`, load: 600 });
    }
    const dflt = acuteChronicRatio(twoPerWeek, '2026-07-10');
    expect(dflt.method).toBe('ewma_uncoupled');
    const coupled = acuteChronicRatio(twoPerWeek, '2026-07-10', 7, 28, { method: 'coupled_ra' });
    expect(dflt.ratio).toBeLessThan(coupled.ratio);
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

  it('канон зон един: метки/цвета совпадают с хабом + честный хинт у каждой зоны', () => {
    // было→стало: у зон появился `hint` (короткое объяснение, что делать), поэтому strict toEqual
    // на {label,color} заменён на проверку label/color + непустой hint.
    const expectZone = (zone: keyof typeof ACWR_ZONE_META, label: string, color: string) => {
      const m = ACWR_ZONE_META[zone] as { label: string; color: string; hint: string };
      expect(m.label).toBe(label);
      expect(m.color).toBe(color);
      expect(typeof m.hint).toBe('string');
      expect(m.hint.length).toBeGreaterThan(10);
    };
    expectZone('undertrained', 'Недотрен', '#3b82f6');
    expectZone('optimal', 'Оптимум', '#22c55e');
    expectZone('caution', 'Осторожно', '#eab308');
    expectZone('dangerous', 'Опасно', '#ef4444');
  });

  it('ACWR_WINDOW_NOTE — оговорка про окно 0.8–1.3 и его неоднозначность', () => {
    // тире в тексте типографское (–), поэтому матчим по классу тире
    expect(ACWR_WINDOW_NOTE).toMatch(/0\.8[–-]1\.3/);
    expect(ACWR_WINDOW_NOTE).toMatch(/эвристик|неоднозначн|спорн/i);
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

  // ── P0: идеально ровная неделя (SD=0) ──
  // было: monotony = mean/0 → Infinity в UI, потом «починено» делением на 1 → monotony ровно 2,
  // и monotonyStreak (>2) НЕ считал такую неделю однообразной. Неделя без единого дня отдыха —
  // самое рискованное однообразие, а хаб показывал её как «норма» (UI-тест ловил именно это).
  function perfectWeek(end: string, load = 500): DayLoad[] {
    const out: DayLoad[] = [];
    const e = new Date(end);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(e);
      d.setDate(d.getDate() - i);
      out.push({ date: d.toISOString().slice(0, 10), load });
    }
    return out;
  }

  it('weeklyMonotony: ровная неделя помечается uniform (SD=0, monotony=2, не «норма»)', () => {
    const m = weeklyMonotony(perfectWeek('2026-07-28'), '2026-07-28');
    expect(m.stdev).toBe(0);
    expect(m.uniform).toBe(true);
    expect(m.monotony).toBe(2); // ровно 2 — и это провал, а не «норма»
    expect(m.meanDailyLoad).toBe(500);
    expect(m.weeklyLoad).toBe(3500);
  });

  it('рваная неделя uniform=false (признак не ловит вариативность)', () => {
    expect(weeklyMonotony(variedWeek('2026-07-28'), '2026-07-28').uniform).toBe(false);
  });

  it('monotonyStreak: ровные недели дают sustainedHigh И uniformWeeks (было: false)', () => {
    const one = monotonyStreak(perfectWeek('2026-07-28'), 2);
    expect(one.sustainedHigh).toBe(false); // прошлой недели нет
    expect(one.uniform).toBe(true);
    expect(one.uniformWeeks).toBe(1);

    const three = monotonyStreak([...perfectWeek('2026-07-14'), ...perfectWeek('2026-07-21'), ...perfectWeek('2026-07-28')], 3);
    expect(three.sustainedHigh).toBe(true);
    expect(three.uniformWeeks).toBe(3);
  });

  it('uniformWeeks обнуляется, как только появился разброс', () => {
    const mixed = [...perfectWeek('2026-07-14'), ...perfectWeek('2026-07-21'), ...variedWeek('2026-07-28')];
    expect(monotonyStreak(mixed, 3).uniformWeeks).toBe(0);
  });

  it('trainingLoadReport рекомендует действие по uniform, а не молчит (было: ratio вместо зоны)', () => {
    // trainingLoadReport принимает СЕССИИ ({date, sRPE, durationMin}), а не DayLoad
    // 28 дней данных, иначе хроника делится на 28 и ratio завышается разреженностью (это отдельный кейс lowBase)
    const sessions: { date: string; sRPE: number; durationMin: number }[] = [];
    for (const d of [...perfectWeek('2026-07-07'), ...perfectWeek('2026-07-14'), ...perfectWeek('2026-07-21'), ...perfectWeek('2026-07-28')]) {
      sessions.push({ date: d.date, sRPE: 8, durationMin: 62.5 }); // 8×62.5 = 500 AU — идентично каждый день
    }
    const rep = trainingLoadReport(sessions, '2026-07-28');
    expect(rep.monotony.uniform).toBe(true);
    expect(rep.recommendations.join(' ')).toMatch(/SD=0/);
    // зона ACWR в рекомендации — из канона и совпадает с фактом (500/500 = 1.0)
    expect(rep.recommendations[0]).toContain('зона «Оптимум»');
  });

  it('toDailyLoads игнорирует мусорные даты (null/некорректная) — был риск NaN в окнах', () => {
    const loads = toDailyLoads([
      { date: '2026-07-26', sRPE: 7, durationMin: 60 },
      { date: null as unknown as string, sRPE: 9, durationMin: 60 },
      { date: 'не-дата', sRPE: 9, durationMin: 60 },
      { date: '2026-07-27', sRPE: 7, durationMin: 60 },
    ] as any, '2026-07-28');
    expect(loads).toHaveLength(2);
    expect(loads.every(d => Number.isFinite(d.load) && d.load > 0)).toBe(true);
  });
});

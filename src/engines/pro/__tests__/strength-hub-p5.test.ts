import { describe, expect, it } from 'vitest';
import { planPLAttempts, planMeetAttempts } from '../pl-attempts.engine';
import {
  buildStrengthHistoryCsv,
  buildStrengthCoachJson,
  buildStrengthTestDayIcs,
  nextSaturday,
  csvCell,
} from '../strength-export.engine';

describe('P5 раскладка попыток', () => {
  it('180 кг стандарт: 167.5 / 175 / 185 (шаг 2.5)', () => {
    const a = planPLAttempts(180, 'standard');
    expect(a.opener).toBe(167.5);
    expect(a.second).toBe(175);
    expect(a.third).toBe(185);
  });
  it('цели: safe ≤ standard ≤ record; third ≥ second', () => {
    const s = planPLAttempts(200, 'safe');
    const st = planPLAttempts(200, 'standard');
    const r = planPLAttempts(200, 'record');
    expect(s.third).toBeLessThanOrEqual(st.third);
    expect(st.third).toBeLessThanOrEqual(r.third);
    expect(r.third).toBeGreaterThanOrEqual(r.second);
    expect(r.opener).toBeLessThan(r.second);
  });
  it('ноль/мусор → нули; сумма тройки сходится', () => {
    expect(planPLAttempts(0)).toEqual({ opener: 0, second: 0, third: 0 });
    const m = planMeetAttempts(180, 120, 220, 'standard');
    expect(m.totalThird).toBeCloseTo(m.squat.third + m.bench.third + m.deadlift.third, 1);
  });
});

describe('P5 экспорт: CSV/JSON/ICS', () => {
  it('CSV: BOM + заголовок + формул-защита', () => {
    const csv = buildStrengthHistoryCsv([
      { date: '2026-09-01', lift: 'bench', e1RM: 120, weight: 100, reps: 5 },
      { date: '2026-09-02', lift: '=cmd', e1RM: 1, weight: 1, reps: 1 },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('date,lift,e1RM_kg,weight_kg,reps');
    expect(csv).toContain("'=cmd");
    expect(csvCell('a"b')).toBe('"a""b"');
  });
  it('JSON: парсится, несёт снапшот+очки', () => {
    const j = JSON.parse(buildStrengthCoachJson(
      { sex: 'male', bw: 83, squat: 180, bench: 120, dead: 220, ohp: 60, total: 520, dots: 350, wilks: 340, ipfgl: 70, relative: 6.27, levelLabel: 'Средний' },
      { method: 'trimmed', sinclair: 400 },
    ));
    expect(j.kind).toBe('strength_analysis');
    expect(j.lifts.total).toBe(520);
    expect(j.scores.dots).toBe(350);
    expect(j.method).toBe('trimmed');
  });
  it('ICS: детерминированная ближайшая суббота + esc', () => {
    // 2026-09-11 — пятница → суббота 2026-09-12
    expect(nextSaturday(new Date(2026, 8, 11))).toBe('20260912');
    // суббота → следующая суббота (+7)
    expect(nextSaturday(new Date(2026, 8, 12))).toBe('20260919');
    const ics = buildStrengthTestDayIcs(
      { sex: 'male', bw: 83, squat: 180, bench: 120, dead: 220, ohp: 60, total: 520, dots: 350, wilks: 340, ipfgl: 70, relative: 6.27, levelLabel: 'Средний' },
      new Date(2026, 8, 11),
    );
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260912');
  });
});

/**
 * bb-taper-pro3-e10.test.ts — PRO-3 Э10 «недельный луп v2»:
 *   сон из дневника (avgSleep7d при сохранении чек-ина), шаги как NEAT-метрика
 *   (prepStepsTrend: ≤ −20% за 2 нед → предупреждение), колонки в отчёте/CSV.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { avgSleep7d, prepStepsTrend, loadPrepWeekCheckins, savePrepWeekCheckin } from '../bb-prep-weekly-log';
import { buildPrepCheckinsCsv, buildPrepWeeklyReportHtml, buildBBContestPrepPlan, type BBContestPrepConfig, isoAddDays, isoToday } from '../bb-contest-prep.engine';

describe('PRO-3 Э10 — сон из дневника', () => {
  it('avgSleep7d: среднее, мусор/аномалии отброшены', () => {
    const log = [
      { date: '2026-09-10', hours: 7 },
      { date: '2026-09-11', hours: 8 },
      { date: '2026-09-12', hours: 6.5 },
      { date: '2026-09-12', hours: 0 },     // мусор
      { date: '2026-09-12', hours: 22 },    // аномалия >16
    ];
    expect(avgSleep7d(log, '2026-09-12')).toBe(7.2); // (7+8+6.5)/3
    expect(avgSleep7d([], '2026-09-12')).toBeUndefined();
  });

  it('чек-ин хранит stepsAvg (roundtrip)', () => {
    try { localStorage.clear(); } catch {}
    savePrepWeekCheckin('p10', { week: 2, date: '2026-09-16', stepsAvg: 8500 });
    expect(loadPrepWeekCheckins('p10')[0].stepsAvg).toBe(8500);
  });
});

describe('PRO-3 Э10 — NEAT-тренд шагов', () => {
  it('−20% и ниже → warning; −10% — тихо; одна запись → null', () => {
    const drop = prepStepsTrend([
      { week: 3, date: 'a', stepsAvg: 10000 },
      { week: 4, date: 'b', stepsAvg: 7800 },
    ]);
    expect(drop?.warning).toBe(true);
    expect(drop?.deltaPct).toBe(-22);
    const mild = prepStepsTrend([
      { week: 3, date: 'a', stepsAvg: 10000 },
      { week: 4, date: 'b', stepsAvg: 9000 },
    ]);
    expect(mild?.warning).toBe(false);
    expect(prepStepsTrend([{ week: 3, date: 'a', stepsAvg: 9000 }])).toBeNull();
    expect(prepStepsTrend(null)).toBeNull();
  });
});

describe('PRO-3 Э10 — отчёт/CSV', () => {
  const cfg = (): BBContestPrepConfig => ({
    sex: 'male', category: 'mens_physique', weightKg: 80,
    experienceLevel: 'intermediate', enhanced: false, prepCount: 0,
    showDate: isoAddDays(isoToday(), 10 * 7), weeksOut: 2, trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate', waterStrategy: 'stable', sodiumStrategy: 'stable',
  });

  it('CSV содержит колонку stepsAvg и значение', () => {
    const csv = buildPrepCheckinsCsv([{ week: 2, date: '2026-09-16', sleepAvg: 7.5, stepsAvg: 8200 }]);
    expect(csv.split('\n')[0]).toContain('stepsAvg');
    expect(csv).toContain('"8200"');
  });

  it('HTML-отчёт тренеру содержит колонку «Шаги»', () => {
    const plan = buildBBContestPrepPlan(cfg(), { prepWeeks: 8, taperWeeks: 2 });
    const html = buildPrepWeeklyReportHtml(plan, { checkins: [{ week: 1, date: '2026-09-16', stepsAvg: 8100 }], strengthDowns: [] });
    expect(html).toContain('Шаги');
    expect(html).toContain('8100');
  });
});

describe('PRO-3 Э10 — UI source-guard', () => {
  it('инпут шагов + тренд-предупреждение + автосон в конструкторе', () => {
    const sec = readFileSync(resolve(__dirname, '..', '..', '..', 'ui', 'screens', 'TrainingScreen_parts', 'bb-contest-prep-sections.tsx'), 'utf8');
    const bb = readFileSync(resolve(__dirname, '..', '..', '..', 'ui', 'screens', 'TrainingScreen_parts', 'BbAutoConstructor.tsx'), 'utf8');
    expect(sec).toMatch(/placeholder="Шаги\/дн"/);
    expect(sec).toMatch(/data-bb="steps-trend"/);
    expect(bb).toMatch(/avgSleep7d\(/);
    expect(bb).toMatch(/stepsAvg: num\(wkSteps\)/);
  });
});

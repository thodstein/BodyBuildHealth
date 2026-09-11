import { describe, it, expect } from 'vitest';
import {
  buildArmliftingReport,
  prescriptionForWeakest,
  assessLiftRules,
  liftTrendFromLog,
  buildArmliftingHtml,
  buildArmliftingCsv,
} from '../armlifting-diagnostics.engine';
import { planLastManStanding, platformWrFor } from '../arm-platform.engine';
import { armliftClassFor, armliftClassLine } from '../armlift-weight-class.engine';

/** PRO-4: армлифтинг-диагностика — доработка и улучшение. */
describe('PRO-4 A1: честные WR (добивка: сверены с IronMind)', () => {
  it('Hub М 44.8 (Толонен 2019) / Ж 28.51 (Кулагина 2021)', () => {
    expect(platformWrFor('hub', 'male')).toBe(44.8);
    expect(platformWrFor('hub', 'female')).toBe(28.51);
    const r = buildArmliftingReport({ hubKg: 44.8, sex: 'male' });
    expect(r.rows[0].scorePct).toBe(100);
    expect(r.rows[0].note).toContain('44.80');
    const rf = buildArmliftingReport({ hubKg: 28.51, sex: 'female' });
    expect(rf.rows[0].scorePct).toBe(100);
  });
  it('Apollon WR М237.5/Ж137.9 (Майерско 2022 / Гайдученко 2019), не internal', () => {
    expect(platformWrFor('apollon_axle', 'male')).toBe(237.5);
    expect(platformWrFor('apollon_axle', 'female')).toBe(137.9);
    const r = buildArmliftingReport({ axleKg: 237.5, axleImpl: 'apollon', sex: 'male' });
    expect(r.rows[0].scorePct).toBe(100);
    expect(r.rows[0].internal).toBe(false);
  });
  it('RT WR неизменен 130.5/77.2', () => {
    expect(platformWrFor('rolling_thunder', 'male')).toBe(130.5);
    expect(platformWrFor('rolling_thunder', 'female')).toBe(77.2);
  });
  it('Silver: опорные времена без %', () => {
    const r = buildArmliftingReport({ silverSec: 55.6, silverGripper: '3', sex: 'male' });
    expect(r.rows[0].scorePct).toBeNull();
    expect(r.rows[0].note).toContain('55.6');
  });
});

describe('PRO-4 A9: раздельный avg + тотал только кг', () => {
  it('avgWr и avgInternal раздельно, avg legacy = общее', () => {
    const r = buildArmliftingReport({ rtKg: 65.25, pinchSec: 15, sex: 'male' });
    // RT 50% WR + pinch 100% internal
    expect(r.avgWrPct).toBe(50);
    expect(r.avgInternalPct).toBe(100);
    expect(r.avgPct).toBe(75);
    expect(r.weakestWr).toBe('rolling_thunder');
    expect(r.verdict).toContain('WR-среднее 50%');
  });
  it('тотал не суммирует секунды/CoC', () => {
    const r = buildArmliftingReport({ rtKg: 60, pinchSec: 15, cocLevel: 2, excalKg: 40, sex: 'male' });
    expect(r.totalKg).toBe(100);
  });
  it('только факты без % — честный вердикт без avg', () => {
    const r = buildArmliftingReport({ excalKg: 40, raptorKg: 50, sex: 'male' });
    expect(r.avgPct).toBeNull();
    expect(r.weakest).toBeNull();
    expect(r.verdict).toContain('факты без %');
  });
});

describe('PRO-4 A2/A3: pinch кг+сек и Silver Bullet', () => {
  it('pinch кг — %WR и не-internal; сек — internal и вне avgWR', () => {
    const r = buildArmliftingReport({ pinchKg: 40, pinchSec: 15, sex: 'male' });
    const kg = r.rows.find((x) => x.implement === 'pinch_block')!;
    const hold = r.rows.find((x) => x.implement === 'pinch_hold')!;
    expect(kg.internal).toBe(false);
    expect(kg.scorePct).toBe(50);
    expect(hold.internal).toBe(true);
    expect(hold.scorePct).toBe(100);
    expect(r.avgWrPct).toBe(50);
    expect(r.avgInternalPct).toBe(100);
  });
  it('Silver Bullet — время без %, с гриппером', () => {
    const r = buildArmliftingReport({ silverSec: 20, silverGripper: '3', sex: 'male' });
    const s = r.rows.find((x) => x.implement === 'silver_bullet')!;
    expect(s.scorePct).toBeNull();
    expect(s.display).toContain('№3');
    expect(s.note).toContain('личный рекорд');
  });
});

describe('PRO-4 A7: L/R + асимметрия', () => {
  it('RT по-рукам: две строки + асимметрия', () => {
    const r = buildArmliftingReport({ rtL: 60, rtR: 66, sex: 'male' });
    expect(r.rows.some((x) => x.implement === 'rolling_thunder_L')).toBe(true);
    expect(r.rows.some((x) => x.implement === 'rolling_thunder_R')).toBe(true);
    expect(r.rtAsymPct).toBeCloseTo(9.1, 0);
    expect(r.verdict).toContain('асимметрия');
  });
  it('без пары — null, legacy rtKg работает', () => {
    const r = buildArmliftingReport({ rtKg: 60, sex: 'male' });
    expect(r.rtAsymPct).toBeNull();
    expect(r.rows[0].implement).toBe('rolling_thunder');
  });
});

describe('PRO-4 A8: чек-лист правил', () => {
  it('все да — зачётный; один нет — тренировочный', () => {
    expect(assessLiftRules([true, true, true, true, true]).official).toBe(true);
    const r = assessLiftRules([true, true, false, true, true]);
    expect(r.official).toBe(false);
    expect(r.note).toContain('тренировочный');
  });
  it('пусто — честно тренировочный', () => {
    expect(assessLiftRules([]).official).toBe(false);
  });
});

describe('PRO-4 A4: last-man-standing', () => {
  it('монотонная лесенка без спуска', () => {
    const steps = planLastManStanding(100);
    expect(steps[steps.length - 1]).toBe(100);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    expect(planLastManStanding(0)).toEqual([]);
  });
});

describe('PRO-4 A5: весовые классы 2026', () => {
  it('М/Ж классы и граница', () => {
    expect(armliftClassFor(85, 'male').label).toBe('М-90');
    expect(armliftClassFor(85, 'male').toLimitKg).toBe(5);
    expect(armliftClassFor(200, 'male').label).toBe('М-125+');
    expect(armliftClassFor(58, 'female').label).toBe('Ж-60');
    expect(armliftClassLine(85, 'male')).toContain('М-90');
  });
});

describe('PRO-4 A6: новые снаряды фактом без %', () => {
  it('Raptor/Crush/Clock/Anvil/Medley не ломают weakest/avg', () => {
    const r = buildArmliftingReport({ rtKg: 65.25, raptorKg: 50, anvilKg: 20, sex: 'male' });
    expect(r.rows.find((x) => x.implement === 'raptor_175')!.scorePct).toBeNull();
    expect(r.rows.find((x) => x.implement === 'anvil')!.scorePct).toBeNull();
    expect(r.avgWrPct).toBe(50);
    expect(r.weakest).toBe('rolling_thunder');
  });
});

describe('PRO-4 A10: тренд и рецепт', () => {
  it('тренд: первые 3 vs последние 3, только успехи', () => {
    const t = liftTrendFromLog([
      { implement: 'rolling_thunder', weightKg: 60, success: true },
      { implement: 'rolling_thunder', weightKg: 60, success: true },
      { implement: 'rolling_thunder', weightKg: 60, success: true },
      { implement: 'rolling_thunder', weightKg: 70, success: true },
      { implement: 'rolling_thunder', weightKg: 70, success: true },
      { implement: 'rolling_thunder', weightKg: 70, success: true },
      { implement: 'rolling_thunder', weightKg: 50, success: false },
      { implement: 'rolling_thunder', weightKg: 0, success: true },
    ]);
    expect(t[0].deltaKg).toBeCloseTo(10, 0);
    expect(t[0].n).toBe(6);
    expect(liftTrendFromLog([{ implement: 'hub', weightKg: 30, success: true }])).toEqual([]);
  });
  it('рецепт по слабейшему: support/pinch/crush', () => {
    expect(prescriptionForWeakest('rolling_thunder')).toContain('Support');
    expect(prescriptionForWeakest('pinch_block')).toContain('Pinch');
    expect(prescriptionForWeakest('coc_gripper')).toContain('Crush');
    expect(prescriptionForWeakest(null)).toBe('');
  });
  it('экспорт содержит рецепт и last-man-standing', () => {
    const report = buildArmliftingReport({ rtKg: 60, sex: 'male' });
    const data = { date: '2026-09-11', sex: 'М', report, lmsAttempts: [50, 55, 60], lmsLabel: 'RT' };
    expect(buildArmliftingHtml(data)).toContain('Рецепт:');
    expect(buildArmliftingHtml(data)).toContain('Last-man-standing');
    expect(buildArmliftingCsv(data)).toContain('prescription;');
    expect(buildArmliftingCsv(data)).toContain('last_man_standing;');
  });
});

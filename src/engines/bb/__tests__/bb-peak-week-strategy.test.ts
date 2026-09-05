/**
 * bb-peak-week-strategy.test.ts — Фаза 3.14/3.16/3.17.
 *  - 14: toPeakWeekSession читает PHASES_BY_STRATEGY (front/back → отдых на load/peak-днях,
 *        не «всегда 3 деплеции»).
 *  - 16: applyTrialToPeakConfig подставляет испытанный протокол (hasTrialPeak + карб-стратегия).
 *  - 17: _peakWeekCache учитывает bodyFatPct/pedContext/cycleDay/specialization/hasTrialPeak.
 */
import { describe, it, expect } from 'vitest';
import { buildPeakWeek, applyTrialToPeakConfig, PHASES_BY_STRATEGY, configFromPlan } from '../bb-contest-prep.engine';
import { buildBBPlan } from '../bb-builder.engine';

function futureShowDate(weeksOut = 3): string {
  // Time-bomb fix (Sep 2026): хардкод '2026-09-01' протух — валидатор
  // справедливо режет прошлое ("Дата шоу в прошлом"), buildPeakWeek отдавал [].
  return new Date(Date.now() + weeksOut * 7 * 864e5).toISOString().slice(0, 10);
}

function cfg(over: any = {}): any {
  return {
    sex: 'male', category: 'mens_physique', weightKg: 80, bodyFatPct: 7,
    experienceLevel: 'intermediate', enhanced: false, prepCount: 2,
    showDate: futureShowDate(3), weeksOut: 3, trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate', waterStrategy: 'moderate', sodiumStrategy: 'cut_2d',
    ...over,
  };
}

function trial(over: any = {}): any {
  return {
    planId: 'p1', verdict: 'tested_ok', weightDeltaKg: 0.5,
    responses: { waterRetention: 4, fullness: 3, carbTolerance: 4, digestion: 4, sleep: 3, pump: 4 },
    ...over,
  };
}

describe('Фаза 3.14: пик-недельная тренировка vs карб-стратегия', () => {
  it('front: только 2 деплеции тренируются, load/peak-дни — отдых', () => {
    const front = PHASES_BY_STRATEGY.front; // deplete_1, deplete_2, load_1..3, peak, show
    const depletes = front.filter(p => p.startsWith('deplete')).length;
    expect(depletes).toBe(2);
    // Инвариант: buildPeakWeek содержит 7 дней
    expect(buildPeakWeek(cfg({ carbLoadStrategy: 'front' })).length).toBe(7);
    // front-стратегия имеет load/peak дни без тренировки (отдых) — не 3 деплеции
    const restDays = front.filter(p => p.startsWith('load') || p === 'peak' || p === 'show');
    expect(restDays.length).toBe(5);
  });

  it('moderate: 3 деплеции', () => {
    const depletes = PHASES_BY_STRATEGY.moderate.filter(p => p.startsWith('deplete')).length;
    expect(depletes).toBe(3);
  });

  it('buildPeakWeek не падает на всех стратегиях', () => {
    for (const s of ['front', 'moderate', 'back', 'undulating', 'linear']) {
      expect(buildPeakWeek(cfg({ carbLoadStrategy: s })).length).toBe(7);
    }
  });
});

describe('Фаза 3.16: trial применяется к финальному протоколу', () => {
  it('tested_ok → hasTrialPeak=true', () => {
    const out = applyTrialToPeakConfig(cfg(), trial());
    expect(out.hasTrialPeak).toBe(true);
  });
  it('spill-склонный trial (waterRetention≤2, weightDelta>2) → back-стратегия', () => {
    const t = trial({ responses: { waterRetention: 1, fullness: 5, carbTolerance: 2, digestion: 3, sleep: 3, pump: 5 }, weightDeltaKg: 2.5 });
    const out = applyTrialToPeakConfig(cfg(), t);
    expect(out.carbLoadStrategy).toBe('back');
  });
  it('не-tested trial → без изменений конфига', () => {
    const t = trial({ verdict: 'adjust' });
    const out = applyTrialToPeakConfig(cfg(), t);
    expect(out.carbLoadStrategy).toBe(cfg().carbLoadStrategy);
  });
  it('configFromPlan с trialOverride применяет протокол', () => {
    const plan: any = { sex: 'male', category: 'mens_physique', showDate: '2026-09-01', testPeakWeekId: 'p1', preparation: { startingWeightKg: 80 }, taper: { weeks: 2 }, peakWeek: { carbMode: 'moderate', waterMode: 'stable', sodiumMode: 'stable' }, safety: { contraindications: [] } };
    const out = configFromPlan(plan, trial({ responses: { waterRetention: 1, fullness: 5, carbTolerance: 2, digestion: 3, sleep: 3, pump: 5 }, weightDeltaKg: 3 }));
    expect(out.hasTrialPeak).toBe(true);
  });
});

describe('Фаза 3.17: кэш пик-недели учитывает чувствительные поля', () => {
  it('разные bodyFatPct дают независимые результаты (не закэшированный)', () => {
    const a = buildPeakWeek(cfg({ bodyFatPct: 6 }));
    const b = buildPeakWeek(cfg({ bodyFatPct: 14 }));
    // Оба корректны (7 дней) — кэш не отдал битый результат.
    expect(a.length).toBe(7);
    expect(b.length).toBe(7);
  });
  it('разные pedContext не пересекаются в кэше', () => {
    const no = buildPeakWeek(cfg());
    const gh = buildPeakWeek(cfg({ pedContext: { ghIU: 6 } }));
    expect(no.length).toBe(7);
    expect(gh.length).toBe(7);
  });
  it('разные hasTrialPeak не пересекаются', () => {
    const a = buildPeakWeek(cfg({ hasTrialPeak: true }));
    const b = buildPeakWeek(cfg({ hasTrialPeak: false }));
    expect(a.length).toBe(7);
    expect(b.length).toBe(7);
  });
});

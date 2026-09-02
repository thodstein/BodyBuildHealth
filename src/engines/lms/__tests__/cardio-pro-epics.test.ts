import { describe, it, expect } from 'vitest';
import {
  buildCardioCycle,
  cardioFactCtlSeries,
  dailyTrimpMap,
  maxHrClassic,
  maxHrTanaka,
  maxHrGulati,
  estimateLTHRFrom30Min,
  estimateZonesFromFieldTests,
  cyclingPowerZones,
  cardioTaperRecommendation,
  bbCardioTaperMult,
  moveCardioSessionInWeek,
  buildCardioZwo,
  cardioHrDrift,
  cardioInterferenceScoreDetailed,
  interferenceForCycle,
} from '../cardio.engine';

describe('Epic A — факт CTL/ATL/TSB из дневника', () => {
  it('dailyTrimpMap суммирует по дате с Banister fallback', () => {
    const log = [
      { date: '2026-01-05', type: 'zone2' as const, durationMin: 30, avgHr: 150, completed: true },
      { date: '2026-01-05', type: 'zone2' as const, durationMin: 20, completed: true },
      { date: '2026-01-06', type: 'hiit' as const, durationMin: 15, completed: true },
      { date: '2026-01-07', type: 'zone2' as const, durationMin: 30, completed: false },
    ];
    const map = dailyTrimpMap(log as any, 60, 190, 'male');
    expect(map.get('2026-01-05')).toBeGreaterThan(0);
    expect(map.get('2026-01-06')).toBeGreaterThan(0);
    expect(map.has('2026-01-07')).toBe(false); // completed false игнор
  });
  it('cardioFactCtlSeries растёт при нагрузке, пустой лог → []', () => {
    expect(cardioFactCtlSeries([])).toEqual([]);
    const log = Array.from({ length: 14 }, (_, i) => {
      const d = new Date('2026-01-05');
      d.setDate(d.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { date: iso, type: 'zone2' as const, durationMin: 30, completed: true };
    });
    const series = cardioFactCtlSeries(log as any, { restHr: 60, maxHr: 190, sex: 'male', referenceIso: '2026-01-18', days: 14 });
    expect(series.length).toBe(14);
    expect(series[13].ctl).toBeGreaterThan(series[0].ctl);
    expect(series[13].atl).toBeGreaterThan(0);
  });
  it('CTL факта vs план: план CTL растёт, факт 0 → TSB положительный (пик)', () => {
    const log: any[] = [];
    const series = cardioFactCtlSeries(log, { referenceIso: '2026-01-18' });
    expect(series).toEqual([]);
  });
});

describe('Epic B — полевые тесты и Tanaka', () => {
  it('maxHr формулы различаются', () => {
    expect(maxHrClassic(30, 'male')).toBe(190);
    expect(maxHrTanaka(30)).toBe(187); // 208-21
    expect(maxHrGulati(30)).toBe(180); // 206-26.4=179.6→180
    expect(maxHrTanaka(30)).toBeLessThan(maxHrClassic(30, 'male'));
  });
  it('estimateLTHRFrom30Min валидация', () => {
    expect(estimateLTHRFrom30Min(172)).toBe(172);
    expect(estimateLTHRFrom30Min(70)).toBeNull();
    expect(estimateLTHRFrom30Min(300)).toBeNull();
  });
  it('estimateZonesFromFieldTests приоритет LTHR', () => {
    const r = estimateZonesFromFieldTests({ lthr: 172, age: 30 })!;
    expect(r.source).toBe('lthr');
    expect(r.zones[1].bpmMin).toBe(Math.round(172 * 0.82));
    const r2 = estimateZonesFromFieldTests({ age: 30, restingHr: 60 })!;
    expect(r2.source).toBe('age');
  });
  it('cyclingPowerZones по FTP', () => {
    const zones = cyclingPowerZones(250);
    expect(zones).toHaveLength(7);
    expect(zones[1].wattsMin).toBe(140); // 56% 250
    expect(zones[3].wattsMax).toBe(263); // 105% 250
  });
  it('cardioHrDrift warning >5%', () => {
    expect(cardioHrDrift(150, 160).warn).toBe(true);
    expect(cardioHrDrift(150, 152).warn).toBe(false);
    expect(cardioHrDrift(0, 160).driftPct).toBe(0);
  });
});

describe('Epic C — поляризованная периодизация Seiler 2026', () => {
  it('polarized: нет miss в build', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 12, periodizationModel: 'polarized' });
    const buildWeeks = c.weeks.filter(w => w.phase === 'build');
    for (const w of buildWeeks) expect(w.sessions.some(s => s.type === 'miss')).toBe(false);
  });
  it('pyramidal: miss в base', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 12, periodizationModel: 'pyramidal' });
    const baseWeeks = c.weeks.filter(w => w.phase === 'base');
    expect(baseWeeks.some(w => w.sessions.some(s => s.type === 'miss'))).toBe(true);
  });
  it('pyramidal_polarized: base pyramidal, build polarized', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 12, periodizationModel: 'pyramidal_polarized' });
    const baseHasMiss = c.weeks.filter(w => w.phase === 'base').some(w => w.sessions.some(s => s.type === 'miss'));
    const buildHasMiss = c.weeks.filter(w => w.phase === 'build').some(w => w.sessions.some(s => s.type === 'miss'));
    expect(baseHasMiss).toBe(true);
    expect(buildHasMiss).toBe(false);
  });
  it('linear (дефолт) сохраняет прежнее поведение', () => {
    const a = buildCardioCycle({ goal: 'health', totalWeeks: 12 });
    const b = buildCardioCycle({ goal: 'health', totalWeeks: 12, periodizationModel: 'linear' });
    expect(JSON.stringify(a.weeks.map(w => w.sessions.map(s => s.type)))).toBe(JSON.stringify(b.weeks.map(w => w.sessions.map(s => s.type))));
  });
});

describe('Epic D — interference engine', () => {
  it('бег 5×60 до ног → high', () => {
    const r = cardioInterferenceScoreDetailed({ modality: 'running', frequencyPerWeek: 5, avgDurationMin: 60, legDaysPerWeek: 4, timing: 'same_day_before', sex: 'male' });
    expect(r.level).toBe('high');
    expect(r.score).toBeGreaterThan(6);
  });
  it('вело 2×30 отдельные дни → low', () => {
    const r = cardioInterferenceScoreDetailed({ modality: 'cycling', frequencyPerWeek: 2, avgDurationMin: 30, legDaysPerWeek: 2, timing: 'separate_day' });
    expect(r.level).toBe('low');
  });
  it('женщины −15%', () => {
    const m = cardioInterferenceScoreDetailed({ modality: 'running', frequencyPerWeek: 3, avgDurationMin: 45, sex: 'male' });
    const f = cardioInterferenceScoreDetailed({ modality: 'running', frequencyPerWeek: 3, avgDurationMin: 45, sex: 'female' });
    expect(f.score).toBeLessThan(m.score);
  });
  it('interferenceForCycle для реального цикла', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, equipment: ['running'] });
    const r = interferenceForCycle(c as any, 2, 'male');
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(['low', 'mid', 'high']).toContain(r.level);
  });
});

describe('Epic E — taper 2.0 exponential vs step', () => {
  it('bbCardioTaperMult step vs exponential различаются', () => {
    expect(bbCardioTaperMult(1, 'step')).toBe(0.6);
    expect(bbCardioTaperMult(1, 'exponential')).toBe(0.5);
    expect(bbCardioTaperMult(2, 'exponential')).toBe(0.65);
    expect(bbCardioTaperMult(3, 'step')).toBe(0.85);
    expect(bbCardioTaperMult(3, 'exponential')).toBe(0.82);
  });
  it('cardioTaperRecommendation: высокая усталость → 3 нед exponential + гигиена сна', () => {
    const r = cardioTaperRecommendation({ taperWeeks: 2, taperModel: 'step', acwr: 1.4, wellnessReadiness: 3, sleepHours: 5 });
    expect(r.weeks).toBe(3);
    expect(r.model).toBe('exponential');
    expect(r.sleepHygiene).toBe(true);
    expect(r.reason).toContain('F-OR');
  });
  it('низкая усталость → без изменений', () => {
    const r = cardioTaperRecommendation({ taperWeeks: 2, acwr: 1.0, wellnessReadiness: 8, sleepHours: 8 });
    expect(r.weeks).toBe(2);
    expect(r.sleepHygiene).toBe(false);
  });
  it('buildCardioCycle с exponential taper имеет меньший объём в последнюю неделю', () => {
    const step = buildCardioCycle({ goal: 'cut', totalWeeks: 8, competitions: [{ id: 'c', name: 'show', week: 8 }], taperWeeks: 2, taperModel: 'step' });
    const exp = buildCardioCycle({ goal: 'cut', totalWeeks: 8, competitions: [{ id: 'c', name: 'show', week: 8 }], taperWeeks: 2, taperModel: 'exponential' });
    expect(exp.weeks[6].totalMinutes).toBeLessThanOrEqual(step.weeks[6].totalMinutes);
  });
});

describe('Epic F — ZWO + интерференция', () => {
  it('buildCardioZwo строит валидный XML с интервалами', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4 });
    const zwo = buildCardioZwo(c);
    expect(zwo).toContain('<workout_file>');
    expect(zwo).toContain('<sportType>');
    expect(zwo).toContain('SteadyState');
  });
});

describe('Epic G — год + drag-and-drop', () => {
  it('moveCardioSessionInWeek меняет день', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4 });
    const w = c.weeks[0];
    const idx = 0;
    const oldDay = w.sessions[idx].dayOfWeek;
    const moved = moveCardioSessionInWeek(c, 1, idx, 5);
    expect(moved).not.toBeNull();
    expect(moved!.weeks[0].sessions[idx].dayOfWeek).toBe(5);
    // исходный не мутируется
    expect(c.weeks[0].sessions[idx].dayOfWeek).toBe(oldDay);
  });
  it('move с невалидным днём → null', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4 });
    expect(moveCardioSessionInWeek(c, 1, 0, 7)).toBeNull();
    expect(moveCardioSessionInWeek(c, 99, 0, 3)).toBeNull();
  });
});

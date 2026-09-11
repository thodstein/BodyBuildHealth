import { describe, it, expect } from 'vitest';
import { diagnoseStonePhaseTiming } from '../strength-sport-sm-phase-timing.engine';
import { carryPhysics } from '../strength-sport-carry-physics.engine';
import { axialMomentCheck } from '../strength-sport-sm-safety.engine';
import { smFarmersWeightClass } from '../strength-sport-sm-hold.engine';
import { scoreSM } from '../strength-sport-sm-scoring.engine';
import { smWeeklySetsByLift, smLiftKeyForWeakPoint } from '../strength-sport-sm-diary.engine';

describe('SM PRO-3: камень 5 фаз', () => {
  it('хват дольше 1.5с — варнинг', () => {
    const r = diagnoseStonePhaseTiming({ pull1S: 2, lapS: 1, pull2S: 2, gripS: 2.2 });
    expect(r).not.toBeNull();
    expect(r!.lines.join(' ')).toContain('Хват');
    expect(r!.verdict).toBe('warn');
  });
  it('zero-lap даёт топ-линию и не требует коленей', () => {
    const r = diagnoseStonePhaseTiming({ pull1S: 2, pull2S: 2, zeroLap: true, lapS: 1.5 });
    expect(r!.lines.join(' ')).toContain('Zero-lap');
  });
  it('гейт ≥90% вне пика — варнинг, в пик — тихо', () => {
    const out = diagnoseStonePhaseTiming({ pull1S: 2, pull2S: 2, workPct: 95 });
    expect(out!.lines.join(' ')).toContain('91%');
    const peak = diagnoseStonePhaseTiming({ pull1S: 2, pull2S: 2, workPct: 95, isPeakWeek: true });
    expect(peak!.lines.join(' ')).not.toContain('91%');
  });
  it('cessation <4дн — варнинг', () => {
    const r = diagnoseStonePhaseTiming({ pull1S: 2, pull2S: 2, cessationDays: 2 });
    expect(r!.lines.join(' ')).toContain('стоп');
  });
  it('pop/grind линии', () => {
    const pop = diagnoseStonePhaseTiming({ pull1S: 2, pull2S: 2, pull2Style: 'pop' });
    expect(pop!.lines.join(' ')).toContain('pop');
    const grind = diagnoseStonePhaseTiming({ pull1S: 2, pull2S: 2, pull2Style: 'grind' });
    expect(grind!.verdict).not.toBe('ok');
  });
  it('старый вход без новых полей — как раньше', () => {
    const r = diagnoseStonePhaseTiming({ pull1S: 2, lapS: 1, pull2S: 2, sex: 'male' });
    expect(r!.verdict).toBe('ok');
  });
});

describe('SM PRO-3: йок-модель rateLimited', () => {
  it('лёгкий йок — не упёрт', () => {
    const r = carryPhysics({ loadKg: 100, bodyweightKg: 100, type: 'yoke' });
    expect(r!.rateLimited).toBe(false);
  });
  it('тяжёлый йок ≥1.5×BW — упёрт + строка Hindle', () => {
    const r = carryPhysics({ loadKg: 300, bodyweightKg: 100, type: 'yoke' });
    expect(r!.rateLimited).toBe(true);
    expect(r!.note).toContain('темп упёрся');
  });
});

describe('SM PRO-3: осевой бюджет раздельный', () => {
  it('breakdown всегда 3 строки', () => {
    const r = axialMomentCheck({ yokeKg: 200, bodyweightKg: 100, carryMeters: 60, stoneMomentNm: 100, axialSets: 6 });
    expect(r.breakdown).toHaveLength(3);
  });
  it('йок 3.5×BW — HIGH', () => {
    const r = axialMomentCheck({ yokeKg: 350, bodyweightKg: 100, carryMeters: 0, stoneMomentNm: 0, axialSets: 0 });
    expect(r.risk).toBe('high');
    expect(r.breakdown[0]).toContain('HIGH');
  });
});

describe('SM PRO-3: весовые классы фермера', () => {
  it('границы М', () => {
    expect(smFarmersWeightClass(80)).toContain('Beginner');
    expect(smFarmersWeightClass(150)).toContain('Intermediate');
    expect(smFarmersWeightClass(250)).toContain('Elite');
  });
  it('Ж ×0.6: 90кг жен = 150 муж → Intermediate', () => {
    expect(smFarmersWeightClass(90, 'female')).toContain('Intermediate');
  });
  it('пусто → null', () => {
    expect(smFarmersWeightClass(null)).toBeNull();
  });
});

describe('SM PRO-3: скоринг ACWR-мост', () => {
  it('без acwrZone — как раньше', () => {
    const a = scoreSM({ weakCount: 1, hasVideo: false, hasVbt: false, hasMobility: true, hasGrip: false });
    const b = scoreSM({ weakCount: 1, hasVideo: false, hasVbt: false, hasMobility: true, hasGrip: false, acwrZone: 'optimal' });
    expect(a.score).toBe(b.score);
  });
  it('dangerous режет скор', () => {
    const base = scoreSM({ weakCount: 0, hasVideo: false, hasVbt: false, hasMobility: true, hasGrip: false });
    const d = scoreSM({ weakCount: 0, hasVideo: false, hasVbt: false, hasMobility: true, hasGrip: false, acwrZone: 'dangerous' });
    expect(d.score).toBeLessThan(base.score);
  });
});

describe('SM PRO-3: недельные сеты дневника', () => {
  const day = (offsetDays: number, name: string, weight: number) => ({
    date: new Date(Date.now() - offsetDays * 24 * 3600 * 1000).toISOString().slice(0, 10),
    exerciseName: name,
    sets: [{ weight, reps: 5 }],
  });
  it('считает только последние 7 дней', () => {
    const logs = [day(2, 'yoke walk', 200), day(3, 'yoke walk', 200), day(30, 'yoke walk', 200)];
    const m = smWeeklySetsByLift(logs as any);
    expect(m.yoke).toBe(2);
  });
  it('маппинг фаз → ключи', () => {
    expect(smLiftKeyForWeakPoint('yoke_walk')).toBe('yoke');
    expect(smLiftKeyForWeakPoint('stone_lap')).toBe('stone');
    expect(smLiftKeyForWeakPoint('farmers_grip')).toBe('farmers');
    expect(smLiftKeyForWeakPoint('log_dip')).toBe('log');
  });
});

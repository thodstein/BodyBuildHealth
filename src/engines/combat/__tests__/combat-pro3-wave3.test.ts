/**
 * combat-pro3-wave3.test.ts — локи волны В3 (P1-1…P1-33) плана
 * docs/COMBAT-PLANNER-PRO-3-PLAN.md.
 */
import { describe, it, expect } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import { phaseForCombatWeekATR } from '../combat-periodization.engine';
import { inCombatGroup, weekGroupSets } from '../combat-groups';
import { sessionLimitsForCombat } from '../combat-limits';
import { combatWeightCutToMealInput, buildWeightCutProtocol, weightCutNutritionForWeek } from '../combat-weight-cut.engine';
import { weightClassLine } from '../combat-weight-class.engine';
import { sparringWeeklyLoad, sparringToOutsideLoad } from '../combat-sparring.engine';
import { sparringJournalToLoad, rtpIncomplete, cutWeightAdvice, type WeighIn } from '../combat-measurements.engine';

function base(extra: Record<string, unknown> = {}) {
  return { discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 6, daysPerWeek: 3, bodyweight: 80, age: 28, ...extra } as any;
}
function allEx(plan: any) {
  return plan.weeksData.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises));
}
const iso = (daysAgo: number) => {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('В3 · P1-5 — группы без двойного счёта', () => {
  it('neck_rotation — шея, не ротация; battle_rope — ротация, не хват', () => {
    expect(inCombatGroup('neck_rotation', 'neck')).toBe(true);
    expect(inCombatGroup('neck_rotation', 'rotational')).toBe(false);
    expect(inCombatGroup('neck_harness_rotation', 'rotational')).toBe(false);
    expect(inCombatGroup('battle_rope', 'rotational')).toBe(true);
    expect(inCombatGroup('battle_rope', 'grip')).toBe(false);
  });

  it('weekGroupSets: farmer_carry виден в хвате, шея не удваивается', () => {
    const sessions = [{ exercises: [{ id: 'farmer_carry', sets: 3 }, { id: 'neck_rotation', sets: 2 }] }];
    expect(weekGroupSets(sessions as any, 'grip')).toBe(3);
    expect(weekGroupSets(sessions as any, 'neck')).toBe(2);
    expect(weekGroupSets(sessions as any, 'rotational')).toBe(0);
  });
});

describe('В3 · P1-6 — кап упражнения из единого источника', () => {
  it('buildCombatPlan не выпускает сетов выше perExerciseCap', () => {
    const cap = sessionLimitsForCombat('intermediate').perExerciseCap;
    for (const level of ['beginner', 'intermediate', 'advanced']) {
      const p = buildCombatPlan(base({ level, fightStyle: 'grappler' }));
      for (const e of allEx(p)) expect(e.sets).toBeLessThanOrEqual(sessionLimitsForCombat(level).perExerciseCap);
    }
    expect(cap).toBe(5);
  });
});

describe('В3 · P1-2 — weight_cut 2 недели имеют рабочую фазу', () => {
  it('2-недельный weight_cut: неделя 1 — gpp, не taper', () => {
    expect(phaseForCombatWeekATR(1, 2, 'weight_cut')).toBe('gpp');
    expect(phaseForCombatWeekATR(2, 2, 'weight_cut')).toBe('deload');
  });
});

describe('В3 · P1-16/17 — жиры и ORS едины', () => {
  it('мост питания: женский пол 40 г, ORS в коридоре 50-90', () => {
    const proto = buildWeightCutProtocol(4, { startWeightKg: 45, orsSodiumMmolPerDl: 120 } as any)!;
    const meal = combatWeightCutToMealInput(1, 8, proto, 45, 'female')!;
    expect(meal.fat).toBeGreaterThanOrEqual(40);
    expect(meal.orsMmol).toBeLessThanOrEqual(90);
    const nut = weightCutNutritionForWeek(1, 8, proto, 45, 'female');
    expect(nut.orsMmol).toBeLessThanOrEqual(90);
    expect(nut.notes.some(n => n.includes('Na 1г/кг'))).toBe(false);
  });
});

describe('В3 · P1-18 — длительность спарринга из журнала', () => {
  it('avgDurationMin масштабирует нагрузку; журнал даёт rounds×roundMinutes', () => {
    const def = sparringWeeklyLoad({ hardSparSessions: 1, techSparSessions: 0, wrestlingSessions: 0 });
    const short = sparringWeeklyLoad({ hardSparSessions: 1, techSparSessions: 0, wrestlingSessions: 0, avgDurationMin: 25 });
    expect(short).toBeLessThan(def);
    const load = sparringJournalToLoad([
      { date: iso(1), type: 'hard', rounds: 5, roundMinutes: 5, rpe: 8 } as any,
    ], iso(0));
    expect(load?.avgDurationMin).toBe(25);
    const outside = sparringToOutsideLoad(load!);
    expect(outside?.avgDurationMin).toBe(25);
  });
});

describe('В3 · P1-25 — открытая категория', () => {
  it('weightClassLine для Infinity говорит «без лимита»', () => {
    const line = weightClassLine(95, 0, Infinity, '+92 кг');
    expect(line).toContain('без лимита');
  });
});

describe('В3 · P1-27 — RTP-гейт', () => {
  it('начатый незавершённый RTP → true; пусто/полный → false', () => {
    expect(rtpIncomplete([])).toBe(false);
    expect(rtpIncomplete([{ date: iso(1), stage: 'aerobic', symptomsFree: true } as any])).toBe(true);
    const full = [
      { date: iso(6), stage: 'rest_light', symptomsFree: true },
      { date: iso(5), stage: 'aerobic', symptomsFree: true },
      { date: iso(4), stage: 'strength', symptomsFree: true },
      { date: iso(3), stage: 'tech', symptomsFree: true },
      { date: iso(2), stage: 'light_contact', symptomsFree: true },
      { date: iso(1), stage: 'full', symptomsFree: true },
    ] as any;
    expect(rtpIncomplete(full)).toBe(false);
  });

  it('buildCombatPlan: RTP незавершён + hard spar → error; без hard spar — RIR≥3', () => {
    const spar = { hardSparSessions: 1, techSparSessions: 0, wrestlingSessions: 0 } as any;
    const withSpar = buildCombatPlan(base({ rtpIncomplete: true, sparringLoad: spar }));
    expect(withSpar.validation.errors.some(e => e.includes('RTP'))).toBe(true);
    const noSpar = buildCombatPlan(base({ rtpIncomplete: true }));
    for (const e of allEx(noSpar)) expect(e.rir).toBeGreaterThanOrEqual(3);
  });
});

describe('В3 · P1-28 — совет по темпу сгона', () => {
  const weigh = (daysAgo: number, kg: number): WeighIn => ({ date: iso(daysAgo), weightKg: kg } as WeighIn);

  it('too_fast при быстром темпе, on_track при целевом, taper — без коррекций', () => {
    const fast = cutWeightAdvice([weigh(13, 81), weigh(12, 81), weigh(6, 80), weigh(5, 80)]);
    expect(fast.status).toBe('too_fast');
    expect(fast.action.kind).toBe('calories');
    const onTrack = cutWeightAdvice([weigh(13, 80.4), weigh(12, 80.4), weigh(6, 80), weigh(5, 80)]);
    expect(onTrack.status).toBe('on_track');
    const taper = cutWeightAdvice([weigh(13, 81), weigh(12, 81), weigh(6, 80), weigh(5, 80)], { phase: 'taper' });
    expect(taper.action.kind).toBe('none');
    expect(cutWeightAdvice([weigh(2, 80)]).status).toBe('no_data');
  });
});

describe('В3 · P1-21/31/32 — тапер-флаг, 4 плоскости шеи, teen-сауна', () => {
  it('fightDate на нед 6-7 (старт задан): realization нед 11-12 без флага taper (вне окна)', () => {
    const fd = iso(-42); // через 6 недель от старта
    const p = buildCombatPlan(base({ weeks: 12, fightDate: fd, taperWeeks: 2, startDate: iso(0) }));
    const late = p.weeksData.filter((w: any) => w.week >= 11);
    for (const w of late) expect(w.taper).toBeFalsy();
    // окно тапера реально помечено
    expect(p.weeksData.find((w: any) => w.week === 6)?.taper).toBe(true);
    expect(p.weeksData.find((w: any) => w.week === 7)?.taper).toBe(true);
  });

  it('шея добивается до 4 плоскостей на рабочей неделе', () => {
    const p = buildCombatPlan(base({ patternId: 'combat_3' }));
    const w1 = p.weeksData[0];
    const ids = w1.sessions.flatMap((s: any) => s.exercises.map((e: any) => e.id));
    const hasFlex = ids.some((id: string) => ['neck_flexion', 'neck_isometric_front', 'neck_eccentric_flexion'].includes(id));
    const hasExt = ids.some((id: string) => ['neck_harness_ext', 'neck_bridge_wrestler', 'neck_isometric_back'].includes(id));
    const hasLat = ids.some((id: string) => ['neck_lateral_flex', 'neck_isometric_side'].includes(id));
    const hasRot = ids.some((id: string) => ['neck_rotation', 'neck_harness_rotation', 'neck_band_rotation_isometric'].includes(id));
    expect(hasFlex && hasExt && hasLat && hasRot).toBe(true);
  });

  it('teen + дата боя: rationale не советует сауну 15-20', () => {
    const p = buildCombatPlan(base({ age: 14, fightDate: iso(-21), taperWeeks: 1 }));
    expect(p.rationale.some(r => /сауна 15/.test(r))).toBe(false);
    expect(p.rationale.some(r => r.includes('teen-гейт'))).toBe(true);
  });
});

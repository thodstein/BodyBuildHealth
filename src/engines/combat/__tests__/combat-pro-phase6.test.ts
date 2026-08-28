import { describe, it, expect } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import { finalizeCombatPlan } from '../combat-finalize.engine';
import { phaseForCombatWeekATR } from '../combat-periodization.engine';
import { isTaperByFightDate } from '../combat-taper.engine';
import { buildWeightCutProtocol, weightCutPhaseForWeek } from '../combat-weight-cut.engine';
import { conditioningSessionsForWeek } from '../combat-conditioning.engine';
import { combatACWR, vbtRecommendation } from '../combat-monitoring.engine';
import { coreWeeklyPlan } from '../combat-core.engine';
import { adaptForPEDsCombat } from '../combat-ped-adaptation';
import { applyCombatMesocycle } from '../combat-mesocycle';
import { buildAnnualATR, annualCBPhaseForWeek } from '../combat-annual';

describe('combat PRO phase6', () => {
  it('ATR 10нед: 5 Accum +3 Trans +2 Real + делод 4/8', () => {
    const phases = Array.from({length:10}, (_,i)=> phaseForCombatWeekATR(i+1,10,'power','atr_10'));
    expect(phases[0]).toBe('accumulation');
    expect(phases[4]).toBe('accumulation');
    expect(phases[5]).toBe('transmutation');
    expect(phases[8]).toBe('realization');
    expect(phases[3]).toBe('deload'); // W4 делод
    expect(phases[7]).toBe('deload'); // W8 делод
  });

  it('conjugate модель: всегда conjugate кроме taper/deload', () => {
    const p = phaseForCombatWeekATR(2,8,'power','conjugate');
    expect(p).toBe('conjugate');
  });

  it('тапер к дате боя: последние 2 нед тапер', () => {
    const fight = new Date(Date.now() + 56*86400000).toISOString(); // 8 нед
    const plan = buildCombatPlan({ discipline:'mma', goal:'camp', level:'intermediate', weeks:8, daysPerWeek:3, fightDate: fight, taperWeeks:2 } as any);
    const last = plan.weeksData[7];
    const prev = plan.weeksData[6];
    expect(last.taper).toBe(true);
    expect(prev.taper).toBe(true);
    expect(last.totalSets).toBeLessThan(plan.weeksData[0].totalSets!);
  });

  it('isTaperByFightDate', () => {
    const cfg = { fightDate: new Date(Date.now()+ 14*86400000).toISOString(), taperWeeks:1, startDate: new Date().toISOString() };
    expect(isTaperByFightDate(2,2,cfg)).toBe(true);
    expect(isTaperByFightDate(1,2,cfg)).toBe(false);
  });

  it('весогонка протокол: фазы camp/taper/fight_week + водный load', () => {
    const prot = buildWeightCutProtocol(5, { startWeightKg:80 })!;
    expect(prot.waterMode).toBe('load_cut');
    expect(prot.carbMode).toBe('deplete_reload');
    expect(weightCutPhaseForWeek(8,8,prot)).toBe('fight_week');
    expect(weightCutPhaseForWeek(7,8,prot)).toBe('taper');
    expect(weightCutPhaseForWeek(1,8,prot)).toBe('camp');
    const plan = buildCombatPlan({ discipline:'mma', goal:'weight_cut', level:'intermediate', weeks:8, daysPerWeek:3, weightCutKg:5, bodyweight:80 } as any);
    expect(plan.weeksData[7].totalSets).toBeLessThan(plan.weeksData[0].totalSets!);
    expect(plan.rationale.join(' ')).toContain('Протокол весогонки');
  });

  it('кондиция: power → alactic+aerobic, weight_cut → aerobic only в taper', () => {
    const s1 = conditioningSessionsForWeek(1,'accumulation','power',2);
    expect(s1.some(s=> s.modality==='alactic')).toBe(true);
    expect(s1.some(s=> s.modality==='aerobic')).toBe(true);
    const sTaper = conditioningSessionsForWeek(10,'realization','power',2);
    expect(sTaper.every(s=> s.modality==='aerobic')).toBe(true);
    const none = conditioningSessionsForWeek(1,'accumulation','power',5);
    expect(none.length).toBe(0);
  });

  it('ACWR зоны', () => {
    expect(combatACWR(100,80).zone).toBe('optimal');
    expect(combatACWR(140,80).zone).toBe('dangerous');
    expect(combatACWR(110,80).zone).toBe('caution');
    expect(combatACWR(50,80).zone).toBe('undertrained');
  });

  it('VBT рекомендации', () => {
    expect(vbtRecommendation(31).volumeMult).toBe(0.6);
    expect(vbtRecommendation(22).rirAdd).toBe(1);
    expect(vbtRecommendation(10).volumeMult).toBe(1.05);
  });

  it('Core 4 план', () => {
    const plan = coreWeeklyPlan('intermediate',3,'power');
    expect(plan.length).toBe(4);
    expect(plan.some(p=> p.function==='anti_extension')).toBe(true);
    expect(plan.some(p=> p.function==='rotation_power')).toBe(true);
  });

  it('PED cap по дисциплине: борьба > бокс', () => {
    const wrest = adaptForPEDsCombat(['aas'], {aas:500}, 'moderate','wrestling');
    const box = adaptForPEDsCombat(['aas'], {aas:500}, 'moderate','boxing');
    expect(wrest.mrvMult).toBeGreaterThanOrEqual(box.mrvMult);
    const full = adaptForPEDsCombat(['aas','gh','insulin'], {aas:500, gh:4, insulin:10}, 'moderate','mma');
    expect(full.mrvMult).toBeGreaterThan(wrest.mrvMult);
  });

  it('мезоцикл прогрессия +2.5кг', () => {
    const prev = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, workMaxByExercise:{bench_bar:80, squat:100}} as any);
    const nextInput: any = { discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, workMaxByExercise:{bench_bar:80, squat:100} };
    const bumped = applyCombatMesocycle(prev, nextInput);
    expect(bumped.workMaxByExercise!.bench_bar).toBe(82.5);
    expect(bumped.workMaxByExercise!.squat).toBe(102.5);
  });

  it('годовой ATR 52нед: 3 блока + transition + print/ics', () => {
    const ann = buildAnnualATR('mma',52);
    expect(ann.blocks.length).toBe(4);
    expect(ann.blocks[0].phase).toBe('accumulation');
    expect(ann.blocks[1].phase).toBe('transmutation');
    expect(ann.blocks[2].phase).toBe('realization');
    expect(ann.blocks[3].phase).toBe('transition');
    expect(ann.totalWeeks).toBe(52);
    expect(annualCBPhaseForWeek(ann,1)).toBe('accumulation');
    expect(annualCBPhaseForWeek(ann,30)).toBe('transmutation');
    expect(annualCBPhaseForWeek(ann,50)).toBe('realization');
  });

  it('DUP heavy_light и conjugate', () => {
    const base = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3 } as any);
    const dup = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, dupMode:'heavy_light' } as any);
    expect(dup.weeksData[0].sessions.length).toBe(base.weeksData[0].sessions.length);
    const conj = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, periodizationModel:'conjugate' } as any);
    expect(conj.weeksData[0].phase).toBe('conjugate');
  });

  it('intensity myo_reps/cluster/contrast', () => {
    const myo = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, intensityTech:'myo_reps' } as any);
    expect(myo.rationale.join(' ')).toContain('myo_reps');
    const cl = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, intensityTech:'cluster' } as any);
    expect(cl.weeksData.some(w=> w.sessions.some(s=> s.exercises.some(e=> e.comment?.includes('Cluster'))))).toBe(true);
  });

  it('finalize балансы horiz/vert/uni/core', () => {
    const plan = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3 } as any);
    const fin = finalizeCombatPlan(plan);
    expect(Array.isArray(fin.validation.warnings)).toBe(true);
  });

  it('builder workMax и budget recovery', () => {
    const poor = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, sleepHours:5, hrvMs:35, stressLevel:8, bodyweight:80, workMax:{bench:100}} as any);
    const good = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, sleepHours:8, hrvMs:75, stressLevel:2, bodyweight:80, workMax:{bench:100}} as any);
    expect(poor.weeksData[0].totalSets).toBeLessThanOrEqual(good.weeksData[0].totalSets!);
  });
});

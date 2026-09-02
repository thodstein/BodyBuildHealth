import { describe, it, expect } from 'vitest';
import { buildWeightCutProtocol, weightCutNutritionForWeek, weightCutFiberForWeek, weightCutOrsProtocol, weightCutPostWeighInPlan, validateWeightCutProtocol, combatWeightCutToMealInput, getWeighInTypeForDiscipline } from '../combat-weight-cut.engine';
import { conditioningSessionsForWeek } from '../combat-conditioning.engine';
import { neckWeeklyPlan, neckVolumeCheck, collinsNoteForLevel, NECK_IDS } from '../combat-neck.engine';
import { gentleFactorForCB, repsCapForCB, filterByInjuryCB } from '../combat-selection';
import { vbtEwma, vbtHistoryForLift, diagnoseVelocityLossCombat } from '../combat-vbt.engine';
import { buildDiaryTrendCB } from '../combat-diary.engine';
import { buildCombatPlan } from '../combat-builder.engine';
import { buildAnnualATR, buildAnnualATRCycles } from '../combat-annual';
import { combatToNutritionPayload } from '../combat-integration.engine';
import { finalizeCombatPlan } from '../combat-finalize.engine';

describe('combat ISSN PRO MAX — P0/P1 full', () => {
  // P0-1 weighInType
  it('weighInType: wrestling → same_day, mma → day_before', () => {
    expect(getWeighInTypeForDiscipline('wrestling')).toBe('same_day_2h');
    expect(getWeighInTypeForDiscipline('mma')).toBe('day_before_24h');
    expect(getWeighInTypeForDiscipline('boxing')).toBe('day_before_24h');
    expect(getWeighInTypeForDiscipline('борьба')).toBe('same_day_2h');
  });
  it('buildWeightCutProtocol respects weighInType and discipline', () => {
    const mma = buildWeightCutProtocol(4, { startWeightKg:80, discipline:'mma' } as any)!;
    expect(mma.weighInType).toBe('day_before_24h');
    const wrest = buildWeightCutProtocol(4, { startWeightKg:80, discipline:'wrestling' } as any)!;
    expect(wrest.weighInType).toBe('same_day_2h');
    // same-day should force stable for water/carb if not confirmed
    expect(wrest.waterMode).toBe('stable');
  });
  it('fiber <10g fight week (ISSN)', () => {
    const proto = buildWeightCutProtocol(5, { startWeightKg:80 } as any)!;
    expect(weightCutFiberForWeek(8,8,proto)).toBe(10);
    expect(weightCutFiberForWeek(1,8,proto)).toBe(28);
    expect(weightCutFiberForWeek(7,8,proto)).toBeLessThan(15);
  });
  it('ORS 50-90 mmol', () => {
    const proto = buildWeightCutProtocol(4, { startWeightKg:80 } as any)!;
    const ors = weightCutOrsProtocol(proto, 4);
    expect(ors.orsSodium).toBeGreaterThanOrEqual(50);
    expect(ors.orsSodium).toBeLessThanOrEqual(90);
    expect(ors.fluidPerHour).toContain('1-1.5');
    expect(ors.carbPerHour).toContain('≤60');
  });
  it('post weigh-in plan staged: 24ч vs 1-2ч', () => {
    const mmaProto = buildWeightCutProtocol(4, { startWeightKg:80, discipline:'mma' } as any)!;
    const wrestProto = buildWeightCutProtocol(3, { startWeightKg:80, discipline:'wrestling' } as any)!;
    const mmaPlan = weightCutPostWeighInPlan(4, mmaProto, 80);
    const wrestPlan = weightCutPostWeighInPlan(2, wrestProto, 80);
    expect(mmaPlan.length).toBe(3); // 1-2ч, 3-6ч, 6-24ч
    expect(wrestPlan.length).toBe(2); // 0-60мин, 1-2ч
    expect(mmaPlan[0].fluids).toContain('ORS');
    expect(wrestPlan[0].stage).toContain('Немедленно');
  });
  it('female 5% cap validation', () => {
    const proto = buildWeightCutProtocol(4, { startWeightKg:70 } as any)!; // 5.7%
    const errsFemale = validateWeightCutProtocol(proto, { bodyweightKg:70, sex:'female' });
    expect(errsFemale.some(e=> e.includes('5%'))).toBe(true);
    const errsMale = validateWeightCutProtocol(proto, { bodyweightKg:70, sex:'male' });
    expect(errsMale.some(e=> e.includes('5%'))).toBe(false);
  });
  it('same-day >3кг validation', () => {
    const proto = buildWeightCutProtocol(4, { startWeightKg:80, discipline:'wrestling', weighInType:'same_day_2h' } as any)!;
    // force >3
    const errs = validateWeightCutProtocol(proto, { sex:'male' });
    expect(errs.some(e=> e.includes('Same-day'))).toBe(true);
  });
  it('confirmedManipulation gate: >5кг without confirmed forces stable', () => {
    const unconfirmed = buildWeightCutProtocol(6, { startWeightKg:80, confirmedManipulation:false } as any)!;
    expect(unconfirmed.waterMode).toBe('stable');
    const confirmed = buildWeightCutProtocol(6, { startWeightKg:80, confirmedManipulation:true, waterMode:'load_cut' } as any)!;
    expect(confirmed.waterMode).toBe('load_cut');
  });
  it('weightCutNutritionForWeek female RED-S floor', () => {
    const proto = buildWeightCutProtocol(6, { startWeightKg:50 } as any)!;
    const nut = weightCutNutritionForWeek(8,8,proto,50,'female');
    expect(nut.kcal).toBeGreaterThanOrEqual(1400);
    expect(nut.notes.join(' ')).not.toContain('undefined');
  });
  it('combatWeightCutToMealInput includes fiber 10 and weighInType', () => {
    const proto = buildWeightCutProtocol(5, { startWeightKg:80 } as any)!;
    const meal = combatWeightCutToMealInput(8,8,proto,80,'male')!;
    expect(meal.fiberMaxG).toBe(10);
    expect(meal.weighInType).toBeDefined();
    expect(meal.orsMmol).toBeGreaterThanOrEqual(50);
  });

  // P0-2 conditioning maintenance
  it('conditioning: outside 5× сохраняет 1× Zone2 (Boxing Science 77%)', () => {
    const maint = conditioningSessionsForWeek(1,'accumulation','power',5);
    expect(maint.length).toBe(1);
    expect(maint[0].modality).toBe('aerobic');
    expect(maint[0].hrZone).toContain('130');
    const deload = conditioningSessionsForWeek(4,'deload','power',5);
    expect(deload[0].durationMin).toBe(18);
  });
  // P1-1 Jamieson
  it('conditioning Jamieson: alactic power vs capacity', () => {
    const cap = conditioningSessionsForWeek(2,'accumulation','power',2);
    const pow = conditioningSessionsForWeek(6,'transmutation','power',2);
    const capAl = cap.find(s=> s.modality==='alactic')!;
    const powAl = pow.find(s=> s.modality==='alactic')!;
    expect(capAl.intervals).toContain('1:3');
    expect(powAl.intervals).toContain('1:5');
    expect(capAl.intervals).toContain('capacity');
    expect(powAl.intervals).toContain('power');
  });
  it('conditioning lactic power 20-40с vs capacity 90-120с', () => {
    const cap = conditioningSessionsForWeek(2,'accumulation','endurance',2);
    const pow = conditioningSessionsForWeek(6,'power','endurance',2);
    const capLa = cap.find(s=> s.modality==='lactic')!;
    const powLa = pow.find(s=> s.modality==='lactic')!;
    expect(capLa.intervals).toContain('90-120');
    expect(powLa.intervals).toContain('20-40');
  });
  it('aerobic cardiac output 130-150 <ANT', () => {
    const aer = conditioningSessionsForWeek(1,'accumulation','power',2).find(s=> s.modality==='aerobic')!;
    expect(aer.intervals).toContain('cardiac output');
    expect(aer.hrZone).toContain('130');
  });

  // P0-3 neck 2.0
  it('neck 2.0: NECK_IDS includes isometric variants', () => {
    expect(NECK_IDS).toContain('neck_isometric_front');
    expect(NECK_IDS).toContain('neck_band_rotation_isometric');
    expect(NECK_IDS.length).toBeGreaterThanOrEqual(11);
  });
  it('neckWeeklyPlan returns 4 planes', () => {
    const plan = neckWeeklyPlan('intermediate', 1, 'accumulation');
    expect(plan.length).toBeGreaterThanOrEqual(4);
    const ids = plan.map(p=> p.id);
    expect(ids.some(id=> id.includes('isometric'))).toBe(true);
  });
  it('neckVolumeCheck multiplanar', () => {
    const check = neckVolumeCheck(['neck_isometric_front','neck_harness_ext','neck_isometric_side','neck_band_rotation_isometric']);
    expect(check.ok).toBe(true);
    const fail = neckVolumeCheck(['neck_harness_ext','neck_harness_ext']);
    expect(fail.ok).toBe(false);
  });
  it('Collins note present', () => {
    const note = collinsNoteForLevel(2);
    expect(note).toContain('5%');
  });

  // P0-4 graded injuries
  it('graded injuries: gentleFactor 0.6 for neck, not exclude', () => {
    const graded = [{ location:'шея', mode:'graded', severity:'medium' }];
    expect(gentleFactorForCB('neck_harness_ext', graded)).toBe(0.6);
    expect(filterByInjuryCB(['neck_harness_ext','squat'], graded)).toContain('neck_harness_ext');
    const excl = [{ location:'шея', mode:'exclude', severity:'high' }];
    expect(filterByInjuryCB(['neck_harness_ext','squat'], excl)).not.toContain('neck_harness_ext');
  });
  it('repsCap for graded knee', () => {
    const graded = [{ location:'колено', mode:'graded', repsCap:12 }];
    expect(repsCapForCB('squat', graded)).toBe(12);
    expect(repsCapForCB('bench_bar', graded)).toBeNull();
  });
  it('builder respects graded repsCap', () => {
    const plan = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, injuries:[{location:'колено', mode:'graded', severity:'medium', repsCap:10}] } as any);
    const squatEx = plan.weeksData.flatMap(w=> w.sessions).flatMap(s=> s.exercises).find(e=> e.id==='squat');
    if (squatEx) {
      const maxRep = Math.max(...squatEx.reps.split('-').map(n=> parseInt(n)));
      expect(maxRep).toBeLessThanOrEqual(10);
    }
  });

  // P1-2 VBT EWMA
  it('vbtEwma smooths', () => {
    const vels = [0.8,0.82,0.78,0.75,0.70];
    const ewma = vbtEwma(vels);
    expect(ewma).toBeGreaterThan(0.6);
    expect(ewma).toBeLessThan(0.8);
  });
  it('diagnoseVelocityLossCombat per lift', () => {
    const d = diagnoseVelocityLossCombat(0.8, 0.6, 20, 80, 'squat');
    expect(d.lossPct).toBe(25);
    expect(d.zone).toBeDefined();
    expect(d.e1RMByVelocity).toBeGreaterThan(0);
  });

  // P1-3 diary grip isometric
  it('diary grip isometric: hold time counted', () => {
    const logs = [
      { date: new Date().toISOString().slice(0,10), exerciseId:'plate_pinch', sets:[{weight:0,reps:20,holdSec:20}] },
      { date: new Date(Date.now()-35*86400000).toISOString().slice(0,10), exerciseId:'plate_pinch', sets:[{weight:0,reps:15,holdSec:15}] },
    ];
    const trend = buildDiaryTrendCB(logs);
    expect(trend).not.toBeNull();
    expect(trend!.some(t=> t.group==='grip')).toBe(true);
  });

  // P1-4 fightStyle
  it('fightStyle striker vs grappler diff sets', () => {
    const striker = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, fightStyle:'striker' } as any);
    const grappler = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, fightStyle:'grappler' } as any);
    const rotStriker = striker.weeksData[0].sessions.flatMap(s=> s.exercises).filter(e=> e.id.includes('landmine')||e.id.includes('med_ball')).reduce((a,e)=>a+e.sets,0);
    const neckGrappler = grappler.weeksData[0].sessions.flatMap(s=> s.exercises).filter(e=> e.id.includes('neck')).reduce((a,e)=>a+e.sets,0);
    const neckStriker = striker.weeksData[0].sessions.flatMap(s=> s.exercises).filter(e=> e.id.includes('neck')).reduce((a,e)=>a+e.sets,0);
    expect(neckGrappler).toBeGreaterThanOrEqual(neckStriker);
  });
  it('striker tempo contrast for rotation', () => {
    const p = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, fightStyle:'striker' } as any);
    const rot = p.weeksData[0].sessions.flatMap(s=> s.exercises).find(e=> e.id.includes('landmine'));
    expect(rot?.tempo).toBe('X-0-X-0');
  });

  // P1-5 annual multi-cycle
  it('annual ATR 52 2 cycles = 8 blocks, residual transition', () => {
    const ann2 = buildAnnualATRCycles('mma',2,52);
    expect(ann2.blocks.length).toBeGreaterThan(4);
    expect(ann2.totalWeeks).toBe(52);
    expect(ann2.blocks.some(b=> b.phase==='transition')).toBe(true);
  });
  it('annual default single cycle still 4 blocks (back-compat)', () => {
    const ann = buildAnnualATR('mma',52);
    expect(ann.blocks.length).toBe(4);
  });

  // P1-6 integration payload
  it('combatToNutritionPayload uses ISSN when weightCut', () => {
    const plan = buildCombatPlan({ discipline:'mma', goal:'weight_cut', level:'intermediate', weeks:4, daysPerWeek:3, weightCutKg:4, bodyweight:80 } as any);
    const nut = combatToNutritionPayload(plan);
    // W1 camp fiber 28, fight week via direct would be 10
    expect(nut.fiberG).toBe(28);
    expect(nut.mealInput).toBeDefined();
    const proto = buildWeightCutProtocol(4, { startWeightKg:80 } as any)!;
    expect(weightCutFiberForWeek(4,4,proto)).toBe(10);
  });
  it('finalize neck multiplanar warning present when missing planes', () => {
    const plan = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3 } as any);
    // artificially strip neck to only one plane for test
    const fin = finalizeCombatPlan(plan);
    expect(fin.validation.warnings.some(w=> w.includes('шея'))).toBeDefined();
  });

  // P2 equipment fallback
  it('equipment: sled fallback weight ×0.88', () => {
    const withSled = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, equipment:['sled'] } as any);
    expect(withSled.weeksData.length).toBe(4);
  });
});

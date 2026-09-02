import { describe, it, expect } from 'vitest';
import { calcWater, calcSteps, calcKBJU, calcBodyFat, calcCortisol, calcStressLoad, calcHematology, calcTrendFromHistory, calcAdaptiveAdjustment, calcEnergyAvailability, calcAlcohol, calcProteinTiming, calcMaintenanceFinder, calcGoalTimeline, calcAdaptiveThermogenesis, calcReverseDiet, calcNEAT, calcThyroidImpact, calcHomaIRWrap } from '../metabolic-hub.engine';
import { bmrCunningham, bmrOwen, bmrTenHaaf, bmrHarrisRevised, bmrHenry, bmrLivingston, calcTEF as calcTEFConst, calcTrendWithConfidence as calcTrendConf2, energyDensityPerKg, hallAdaptationFactor, calcSweatElectrolytes, calcJPBodyFat, calcDurninBodyFat, computeBMR } from '../../core/metabolic-constants';

const base = { weight: 80, height: 180, age: 30, sex: 'male' as const };

describe('metabolic-hub — TEF waterfall', () => {
  it('steps: tef ~10% tdee (fallback без макросов)', () => {
    const r = calcSteps({ ...base, activityLevel:'medium', trainingDays:4, cardioMin:60 });
    // без макросов fallback 10%
    expect(r.tefNat).toBe(Math.round(r.tdeeNat*0.10));
  });
  it('kbju: neat/eat/tef breakdown совпадает с pal — TEF персональный', () => {
    const r = calcKBJU({ ...base, activityLevel:'medium', trainingDays:4 });
    expect(r.neat + r.eat + r.bmr + r.tefNat).toBeGreaterThan(r.nat.tdee * 0.9);
    // персональный TEF 6-15%, не фикс 10%
    expect(r.tefNat).toBeGreaterThanOrEqual(Math.round(r.nat.kcal*0.06));
    expect(r.tefNat).toBeLessThanOrEqual(Math.round(r.nat.kcal*0.15));
  });
  it('steps neat растёт с activity low→high', () => {
    const low = calcSteps({ ...base, activityLevel:'low' });
    const high = calcSteps({ ...base, activityLevel:'high' });
    expect(high.neat).toBeGreaterThan(low.neat);
    expect(high.tdeeNat).toBeGreaterThan(low.tdeeNat);
  });
  it('kbju eat растёт с trainingDays/cardio', () => {
    const a = calcKBJU({ ...base, trainingDays:2, cardioMin:0 });
    const b = calcKBJU({ ...base, trainingDays:6, cardioMin:180 });
    expect(b.eat).toBeGreaterThan(a.eat);
  });
});

describe('metabolic-hub — calcWater', () => {
  it('база 35мл/кг без bf', () => {
    const r = calcWater({ ...base, trainingDays:0, cardioMin:0 });
    expect(r.breakdown.base).toBe(80*35);
  });
  it('lean40/жир20 экономит при ожирении (baseLeanModel vs baseIOM)', () => {
    const lean = calcWater({ weight: 110, height:180, age:30, sex:'male', bodyFat:35, trainingDays:0, cardioMin:0 });
    const generic = calcWater({ weight:110, height:180, age:30, sex:'male', trainingDays:0, cardioMin:0 });
    // Pro: IOM база одинакова, lean-модель экспериментальная — экономит (показываем отдельно)
    expect(lean.breakdown.baseLeanModel).toBeLessThan(generic.breakdown.baseIOM);
    expect(lean.baseIOM).toBe(generic.baseIOM);
  });
  it('климат hot +600 cold -150', () => {
    const t = calcWater({ ...base, climate:'temperate', trainingDays:0, cardioMin:0 });
    const h = calcWater({ ...base, climate:'hot', trainingDays:0, cardioMin:0 });
    const c = calcWater({ ...base, climate:'cold', trainingDays:0, cardioMin:0 });
    expect(h.nat - t.nat).toBe(600);
    expect(c.nat - t.nat).toBe(-150);
  });
  it('ААС дозозависимо: 0 < 500 < 1500', () => {
    const n = calcWater({ ...base, onAAS:false });
    const l = calcWater({ ...base, onAAS:true, aasDose:0 });
    const m = calcWater({ ...base, onAAS:true, aasDose:500 });
    const hh = calcWater({ ...base, onAAS:true, aasDose:1500 });
    expect(l.aas).toBeGreaterThan(n.nat);
    expect(m.aas).toBeGreaterThan(l.aas);
    expect(hh.aas).toBeGreaterThan(m.aas);
    expect(hh.aas - n.nat).toBeLessThanOrEqual(Math.round(n.nat*0.12)+1);
  });
  it('perHour = nat/16', () => {
    const r = calcWater({ ...base });
    expect(r.perHour).toBe(Math.round(r.nat/16));
  });
});

describe('metabolic-hub — calcSteps', () => {
  it('BMR Katch vs Mifflin', () => {
    const katch = calcSteps({ ...base, bodyFat:12 });
    const mif = calcSteps({ ...base, bodyFat: undefined });
    expect(katch.tdeeNat).not.toBe(mif.tdeeNat);
  });
  it('cut < maintain < bulk по target', () => {
    const cut = calcSteps({ ...base, goal:'cut' });
    const maint = calcSteps({ ...base, goal:'maintain' });
    const bulk = calcSteps({ ...base, goal:'bulk' });
    expect(cut.targetNat).toBeLessThan(maint.targetNat);
    expect(bulk.targetNat).toBeGreaterThan(maint.targetNat);
  });
  it('шаги в диапазоне 3000-22000 и kcalPerStep 0.025-0.07', () => {
    const r = calcSteps({ ...base, goal:'cut' });
    expect(r.stepsNat).toBeGreaterThanOrEqual(3000);
    expect(r.stepsNat).toBeLessThanOrEqual(22000);
    expect(r.kcalPerStep).toBeGreaterThanOrEqual(0.025);
    expect(r.kcalPerStep).toBeLessThanOrEqual(0.07);
  });
  it('ААС: tdee выше, шагов меньше', () => {
    const nat = calcSteps({ ...base, onAAS:false });
    const aas = calcSteps({ ...base, onAAS:true, aasDose:800 });
    expect(aas.tdeeAAS).toBeGreaterThan(nat.tdeeNat);
    expect(aas.stepsAAS).toBeLessThan(nat.stepsNat);
  });
});

describe('metabolic-hub — calcKBJU', () => {
  it('белок Helms: сухая cut выше обычной', () => {
    const leanCut = calcKBJU({ ...base, bodyFat:9, goal:'cut' });
    const fatCut = calcKBJU({ ...base, bodyFat:24, goal:'cut' });
    expect(leanCut.nat.protPerKg).toBeGreaterThan(fatCut.nat.protPerKg);
  });
  it('потолок углеводов 5г/кг (6 на ААС)', () => {
    const r = calcKBJU({ weight: 110, height:190, age:25, sex:'male', activityLevel:'high', trainingDays:6, goal:'bulk' });
    expect(r.nat.c).toBeLessThanOrEqual(110*5);
    const aas = calcKBJU({ weight:110, height:190, age:25, sex:'male', activityLevel:'high', trainingDays:6, goal:'bulk', onAAS:true, aasDose:800 });
    expect(aas.aas.c).toBeLessThanOrEqual(110*6);
  });
  it('PAL влияет на tdee', () => {
    const low = calcKBJU({ ...base, activityLevel:'low' });
    const high = calcKBJU({ ...base, activityLevel:'high' });
    expect(high.nat.tdee).toBeGreaterThan(low.nat.tdee);
  });
  it('ААС +0.4-0.8 белка и +10% TDEE дозозависимо', () => {
    const nat = calcKBJU({ ...base });
    const low = calcKBJU({ ...base, onAAS:true, aasDose:200 });
    const high = calcKBJU({ ...base, onAAS:true, aasDose:1500 });
    expect(low.aas.p).toBeGreaterThan(nat.nat.p);
    expect(high.aas.p).toBeGreaterThan(low.aas.p);
  });
  it('клетчатка 14г/1000ккал — пропорциональна ккал', () => {
    const m = calcKBJU({ ...base, sex:'male' });
    const f = calcKBJU({ ...base, sex:'female' });
    // male TDEE выше => fiber выше или равна (разница BMR 166ккал => ~2г)
    expect(m.fiber.nat).toBeGreaterThanOrEqual(f.fiber.nat);
    expect(m.fiber.nat).toBe(Math.round(m.nat.kcal/1000*14));
  });
});

describe('metabolic-hub — calcBodyFat Navy', () => {
  it('male Navy ~14% для 180/84/39', () => {
    const r = calcBodyFat({ weight:83, height:180, age:30, sex:'male', waist:84, neck:39 });
    // 84см талия 39 шея 180 рост ≈14-15% в дюймах
    expect(r.navy).toBeGreaterThan(10);
    expect(r.navy).toBeLessThan(20);
  });
  it('cm→in фикс: без конверсии было бы ~20% ошибка', () => {
    // проверяем что navy использует дюймы: если бы см, было бы >18
    const r = calcBodyFat({ weight:83, height:180, age:30, sex:'male', waist:84, neck:39 });
    expect(r.navy).toBeLessThan(17);
  });
  it('female требует hip', () => {
    const noHip = calcBodyFat({ weight:60, height:165, age:28, sex:'female', waist:72, neck:32 });
    expect(noHip.navy).toBeNull();
    const withHip = calcBodyFat({ weight:60, height:165, age:28, sex:'female', waist:72, neck:32, hip:96 });
    expect(withHip.navy).not.toBeNull();
  });
  it('честный Navy без осевой (инфо только)', () => {
    const low = calcBodyFat({ ...base, waist:84, neck:39, trainingDays:2 });
    const high = calcBodyFat({ ...base, waist:84, neck:39, trainingDays:6 });
    // осевая больше не правит Navy — axialAdd legacy 0
    expect(low.axialAdd).toBe(0);
    expect(high.axialAdd).toBe(0);
    expect(low.navy).toBe(high.navy);
    expect(low.crossCheck).toContain('Navy');
  });
  it('FFMI_norm + аас надбавка + лимит 26.2 Helms 2023', () => {
    const nat = calcBodyFat({ ...base, waist:84, neck:39 });
    const aas = calcBodyFat({ ...base, waist:84, neck:39, onAAS:true, aasDose:600 });
    expect(aas.ffmiNormAdj).toBeGreaterThan(nat.ffmiNorm);
    expect(nat.natLimit).toBe(26.2);
    expect(nat.deurenberg).toBeGreaterThan(0);
  });
  it('waist<=neck → navy null', () => {
    const r = calcBodyFat({ ...base, waist:38, neck:40 });
    expect(r.navy).toBeNull();
  });
});

describe('metabolic-hub — calcCortisol HPA', () => {
  it('зоны low/norm/high/very_high', () => {
    const low = calcCortisol({ ...base, stress:1, sleepHours:9, sleepQuality:5, acwr:1 });
    const high = calcCortisol({ ...base, stress:10, sleepHours:4, sleepQuality:1, acwr:2.2 });
    expect(low.zoneNat).toBe('low');
    expect(high.zoneNat === 'high' || high.zoneNat==='very_high').toBeTruthy();
  });
  it('ААС снижает индекс на ~14%', () => {
    const nat = calcCortisol({ ...base, stress:6, sleepHours:6, acwr:1.2 });
    const aas = calcCortisol({ ...base, stress:6, sleepHours:6, acwr:1.2, onAAS:true });
    expect(aas.aas).toBeLessThan(nat.nat);
  });
  it('whatIf сон+1 снижает, стресс+2 повышает', () => {
    const r = calcCortisol({ ...base, stress:5, sleepHours:7, acwr:1 });
    expect(r.whatIf(1,0,0)).toBeLessThan(r.nat);
    expect(r.whatIf(0,2,0)).toBeGreaterThan(r.nat);
  });
  it('ACWR зоны', () => {
    const under = calcCortisol({ ...base, acwr:0.6 });
    const opt = calcCortisol({ ...base, acwr:1.1 });
    const danger = calcCortisol({ ...base, acwr:1.8 });
    expect(under.acwrZone).toBe('undertrained');
    expect(opt.acwrZone).toBe('optimal');
    expect(danger.acwrZone).toBe('dangerous');
  });
});

describe('metabolic-hub — адаптивный TDEE', () => {
  it('calcTrendFromHistory <3 точек → 0', () => {
    expect(calcTrendFromHistory([])).toBe(0);
    expect(calcTrendFromHistory([{date:'2026-01-01',kg:80},{date:'2026-01-03',kg:79.5}])).toBe(0);
  });
  it('тренд -0.5кг/нед по 7 дням', () => {
    const h = [
      {date:'2026-01-01',kg:80},
      {date:'2026-01-04',kg:79.7},
      {date:'2026-01-08',kg:79.5},
    ];
    const t = calcTrendFromHistory(h);
    expect(t).toBeCloseTo(-0.5, 0.2);
  });
  it('adaptive: cut плато → реком +500ккал?', () => {
    // при сушке ожидаем -0.5, факт 0 → diff +0.5 → +385ккал (в кап 500)
    const { adjustment } = calcAdaptiveAdjustment(0, 'cut', 2600);
    expect(adjustment).toBeGreaterThan(300);
  });
  it('adaptive в calcSteps при weightHistory', () => {
    const wh = [
      {date:'2026-01-01',kg:83},{date:'2026-01-04',kg:82.6},{date:'2026-01-08',kg:82.3},{date:'2026-01-11',kg:82.0},
    ];
    const r = calcSteps({ ...base, goal:'cut', weightHistory: wh });
    expect(r.adaptive).not.toBeNull();
    expect(typeof r.adaptive!.trend).toBe('number');
  });
  it('adaptive null без истории', () => {
    const r = calcSteps({ ...base });
    expect(r.adaptive).toBeNull();
  });
});

describe('metabolic-hub — calcHematology (ESC/ASA)', () => {
  it('unknown без HCT', () => {
    const r = calcHematology({ weight:80 });
    expect(r.zone).toBe('unknown');
    expect(r.waterAdjMl).toBe(0);
    expect(r.donation.needed).toBe(false);
  });
  it('зоны 45/49/52/55/61', () => {
    expect(calcHematology({ weight:80, hct:45 }).zone).toBe('normal');
    expect(calcHematology({ weight:80, hct:49 }).zone).toBe('attention');
    expect(calcHematology({ weight:80, hct:52 }).zone).toBe('phlebotomy');
    expect(calcHematology({ weight:80, hct:55 }).zone).toBe('stop');
    expect(calcHematology({ weight:80, hct:61 }).zone).toBe('critical');
  });
  it('вода +300/500/750 по порогам', () => {
    expect(calcHematology({ weight:80, hct:49 }).waterAdjMl).toBe(300);
    expect(calcHematology({ weight:80, hct:52 }).waterAdjMl).toBe(500);
    expect(calcHematology({ weight:80, hct:55 }).waterAdjMl).toBe(750);
    expect(calcHematology({ weight:80, hct:45 }).waterAdjMl).toBe(0);
  });
  it('железо ZERO при >51, cap при 48-51', () => {
    expect(calcHematology({ weight:80, hct:52 }).ironRec).toBe('zero');
    expect(calcHematology({ weight:80, hct:49 }).ironRec).toBe('cap_15');
    expect(calcHematology({ weight:80, hct:45 }).ironRec).toBe('normal');
  });
  it('донация elective/soon/urgent', () => {
    expect(calcHematology({ weight:80, hct:52 }).donation.urgency).toBe('elective');
    expect(calcHematology({ weight:80, hct:53 }).donation.urgency).toBe('soon');
    expect(calcHematology({ weight:80, hct:55 }).donation.urgency).toBe('urgent');
    expect(calcHematology({ weight:80, hct:45 }).donation.needed).toBe(false);
  });
  it('вязкость + GFR/ферритин флаги', () => {
    const v1 = calcHematology({ weight:80, hct:52, waterL:1.2 });
    expect(v1.viscosityFlag).toBe(true);
    const v2 = calcHematology({ weight:80, hct:52, waterL:2.5 });
    expect(v2.viscosityFlag).toBe(false);
    expect(calcHematology({ weight:80, hct:45, gfr:55 }).gfrFlag).toBe(true);
    expect(calcHematology({ weight:80, hct:45, ferritin:20 }).ferritinFlag).toBe(true);
  });
  it('nutritionMult растёт с дефицитами', () => {
    const good = calcHematology({ weight:80, hct:45, waterL:2.5, sodiumG:3, potassiumG:3, proteinPerKg:1.8, fiberG:30, omega3G:1.5 });
    const bad = calcHematology({ weight:80, hct:45, waterL:1.2, sodiumG:5, potassiumG:2, proteinPerKg:1.0, fiberG:10, omega3G:0.2 });
    expect(bad.nutritionMult).toBeGreaterThan(good.nutritionMult);
    expect(bad.nutritionMult).toBeLessThanOrEqual(1.25);
  });
  it('HGB оценка HCT*3.4', () => {
    const r = calcHematology({ weight:80, hct:50 });
    expect(r.hgbEstimated).toBe(170);
    const withHgb = calcHematology({ weight:80, hct:50, hgb:180 });
    expect(withHgb.hgbEstimated).toBe(180);
  });
  it('health цель: 1.8г/кг в КБЖУ, maintain ~2.1', () => {
    const health = calcKBJU({ ...base, goal:'health' });
    const maintain = calcKBJU({ ...base, goal:'maintain' });
    expect(health.nat.protPerKg).toBe(1.8);
    expect(maintain.nat.protPerKg).toBeCloseTo(2.1, 0.15);
    expect(health.nat.protPerKg).toBeLessThan(maintain.nat.protPerKg);
  });
});

describe('metabolic-hub PRO — BMR формулы', () => {
  it('Cunningham атлет LBM>60 даёт выше Katch', () => {
    const lean=75; expect(bmrCunningham(lean)).toBeGreaterThan(370+21.6*lean);
  });
  it('Owen ожирение vs Mifflin', () => {
    expect(bmrOwen(110,'male')).toBeGreaterThan(0);
    expect(bmrTenHaaf(80,180,25,'male')).toBeGreaterThan(1500);
  });
  it('TEF персональный 25%/7%/3% vs 10% fallback', () => {
    const tef = calcTEFConst(150,300,70);
    expect(tef).toBeGreaterThan(250);
    expect(tef).toBeLessThan(500);
  });
  it('trend confidence R2', () => {
    const h=[{date:'2026-01-01',kg:80},{date:'2026-01-04',kg:79.7},{date:'2026-01-08',kg:79.5},{date:'2026-01-11',kg:79.2}];
    const c=calcTrendConf2(h);
    expect(c.r2).toBeGreaterThan(0.3);
    expect(c.trend).toBeCloseTo(-0.6, 0.3);
  });
});

describe('metabolic-hub PRO — новые калькуляторы', () => {
  it('EA: LEA sex-специфично (F <30, M <25 Mountjoy 2018)', () => {
    // female LEA <30, male <25 — 2100 ккал → 23.8 <25 low для обоих, 2200 → 25.4 reduced для M но low для F
    const eaLowF = calcEnergyAvailability({ weight:70, bodyFat:10, height:180, intakeKcal:2100, eeeKcal:600, sex:'female' } as any);
    expect(eaLowF.ea).not.toBeNull();
    expect(eaLowF.zone).toBe('low');
    const eaReducedM = calcEnergyAvailability({ weight:70, bodyFat:10, height:180, intakeKcal:2200, eeeKcal:600, sex:'male' } as any);
    // 25.4 >25 для M → reduced (граница), не low — проверяем sex-специфичность
    expect(eaReducedM.zone).toBe('reduced');
    const eaOpt = calcEnergyAvailability({ weight:70, bodyFat:10, height:180, intakeKcal:3400, eeeKcal:400, sex:'female' } as any);
    expect(eaOpt.zone).toBe('optimal');
  });
  it('алкоголь 40г = 284ккал + блок', () => {
    const a=calcAlcohol(40,80);
    expect(a.kcal).toBe(284);
    expect(a.fatOxidationBlockedPct).toBeGreaterThan(40);
    expect(a.stepsEq).toBeGreaterThan(6000);
  });
  it('protein timing 120г -> 30г/прием -> 3.3г leuc', () => {
    const pt=calcProteinTiming(120,80,4);
    expect(pt.perMeal).toBe(30);
    expect(pt.leucinePerMeal).toBeCloseTo(3.3,0.2);
    const pt2=calcProteinTiming(80,80,3);
    expect(pt2.leucinePerMeal).toBeCloseTo(2.9,0.2);
  });
  it('maintenance finder R2', () => {
    const wh=[{date:'2026-01-01',kg:83},{date:'2026-01-04',kg:82.8},{date:'2026-01-08',kg:82.6},{date:'2026-01-11',kg:82.5},{date:'2026-01-14',kg:82.4},{date:'2026-01-17',kg:82.3},{date:'2026-01-20',kg:82.2}];
    const mf=calcMaintenanceFinder(wh, 2800);
    expect(mf).not.toBeNull();
    expect(mf!.r2).toBeGreaterThan(0.2);
  });
  it('goal timeline Hall density (Pro)', () => {
    const gt=calcGoalTimeline({ weight:85, targetWeight:80, tdee:2800 });
    expect(gt).not.toBeNull();
    // Hall density p*9400 теперь — 5кг при 85кг lean ≈44→48д, не 88д старым 7700
    expect(gt!.days).toBeGreaterThan(35);
    expect(gt!.days).toBeLessThan(120);
    expect((gt as any).model).toContain('Hall');
  });
  it('лютеин +250ккал', () => {
    const baseF={ weight:60, height:165, age:28, sex:'female' as const, menstrualPhase:'luteal' as const };
    const luteal=calcKBJU(baseF);
    const follic=calcKBJU({ ...baseF, menstrualPhase:'follicular' as const });
    expect(luteal.nat.tdee).toBeGreaterThan(follic.nat.tdee);
    expect(luteal.lutealAdd).toBeGreaterThan(150);
  });
  it('стоячие часы и fidget влияют на PAL/TDEE', () => {
    const low=calcSteps({ ...base, standingHours:0, fidgetLevel:1 });
    const high=calcSteps({ ...base, standingHours:6, fidgetLevel:3 });
    expect(high.tdeeNat).toBeGreaterThan(low.tdeeNat);
    expect(high.pal).toBeGreaterThan(low.pal);
  });
  it('water с влажностью и Na', () => {
    const dry=calcWater({ ...base, climate:'hot', humidity:40 });
    const humid=calcWater({ ...base, climate:'hot', humidity:85 });
    expect(humid.nat).toBeGreaterThan(dry.nat);
    expect(humid.sweatNaG).toBeGreaterThan(0);
  });
});

describe('metabolic-hub PRO v2 — новые Pro-исправления', () => {
  it('BMR: Harris/Henry/Livingston формулы работают + allMethods 8 ключей', () => {
    expect(bmrHarrisRevised(80,180,30,'male')).toBeGreaterThan(1700);
    expect(bmrHarrisRevised(80,180,30,'female')).toBeLessThan(bmrHarrisRevised(80,180,30,'male'));
    expect(bmrHenry(80,30,'male')).toBeGreaterThan(1400); // Henry 11.4*80+541=1453
    expect(bmrLivingston(110,40,'male')).toBeGreaterThan(1800);
    const withBF = computeBMR({ weight:80, height:180, age:30, sex:'male', bodyFat:12 });
    expect(withBF.method).toBe('cunningham'); // lean>60 → Cunningham, not age gate
    expect(withBF.allMethods).toBeUndefined(); // с BF — allMethods не нужен
    const noBF = computeBMR({ weight:80, height:180, age:30, sex:'male' });
    expect(noBF.allMethods).toBeDefined();
    expect(Object.keys(noBF.allMethods!).length).toBe(9); // + henry_full
    expect(noBF.allMethods!.harris_revised).toBeGreaterThan(1500);
    expect(noBF.allMethods!.livingston).toBeGreaterThan(1500);
    expect(noBF.lean).toBeGreaterThan(50); // Deurenberg lean, not 15% fix
  });
  it('BMR default lean via Deurenberg, не фикс 15%', () => {
    const noBF = computeBMR({ weight:100, height:180, age:35, sex:'male' });
    // 100кг 180см 35л male BF Deurenberg ≈1.2*30.8+8-10.8-5.4≈27% → lean 73кг, не 85кг (15%)
    expect(noBF.lean).toBeLessThan(80);
    expect(noBF.lean).toBeGreaterThan(60);
  });
  it('FFMI cap 26.2 Helms (не 28) + continuous sarcopenia', () => {
    const tall = computeBMR({ weight:110, height:190, age:65, sex:'male', bodyFat:8 });
    // 110кг 8% lean 101кг FFMI ~28 → кламп к 26.2
    expect(tall.lean).toBeLessThan(101);
    const r50 = computeBMR({ weight:80, height:180, age:50, sex:'male', bodyFat:12 }).bmr;
    const r65 = computeBMR({ weight:80, height:180, age:65, sex:'male', bodyFat:12 }).bmr;
    expect(r65).toBeLessThan(r50); // continuous 15лет ×0.0015 = −2.25%
    expect(r50 - r65).toBeGreaterThan(20);
  });
  it('PAL MET-калиброван 0.040 + very_high 1.95 + dlwBand', () => {
    const low = calcSteps({ ...base, activityLevel:'low' });
    const vh = calcSteps({ ...base, activityLevel:'very_high' as any });
    expect(vh.tdeeNat).toBeGreaterThan(low.tdeeNat);
    expect(vh.pal).toBeGreaterThan(1.75);
    expect(vh.dlwBand.low).toBeLessThan(vh.tdeeNat);
    expect(vh.dlwBand.high).toBeGreaterThan(vh.tdeeNat);
  });
  it('Hall density composition-зависим + maintenance AT', () => {
    expect(energyDensityPerKg(10)).toBeLessThan(energyDensityPerKg(35));
    expect(energyDensityPerKg(35)).toBeGreaterThan(5000);
    const mfLean = calcMaintenanceFinder([{date:'2026-01-01',kg:70},{date:'2026-01-04',kg:69.8},{date:'2026-01-07',kg:69.6},{date:'2026-01-10',kg:69.4},{date:'2026-01-13',kg:69.2},{date:'2026-01-16',kg:69},{date:'2026-01-19',kg:68.8}], 2200, 10);
    const mfFat = calcMaintenanceFinder([{date:'2026-01-01',kg:70},{date:'2026-01-04',kg:69.8},{date:'2026-01-07',kg:69.6},{date:'2026-01-10',kg:69.4},{date:'2026-01-13',kg:69.2},{date:'2026-01-16',kg:69},{date:'2026-01-19',kg:68.8}], 2200, 35);
    expect(mfLean!.density).toBeLessThan(mfFat!.density);
    expect(mfLean!.note).toContain('Hall');
  });
  it('Water Baker полный панель + IOM base', () => {
    const w = calcWater({ ...base, bodyFat:15, trainingHours:1.2, sweatSodiumMgPerL:900 });
    expect(w.electrolytes).toBeDefined();
    expect(w.electrolytes.chlorideMg).toBeGreaterThan(w.electrolytes.sodiumMg);
    expect(w.electrolytes.potassiumMg).toBeGreaterThan(100);
    expect(w.baseIOM).toBe(80*35);
    expect(w.baseLeanModel).toBeGreaterThan(0);
    expect(w.sweatClG).toBeGreaterThan(w.sweatNaG);
  });
  it('BodyFat JP/Durnin/BIA + Deurenberg warn', () => {
    const jp = calcJPBodyFat(50,30,'male');
    expect(jp).not.toBeNull();
    expect(jp!).toBeGreaterThan(8); expect(jp!).toBeLessThan(25);
    const durn = calcDurninBodyFat(45,30,'male');
    expect(durn).not.toBeNull();
    const withJP = calcBodyFat({ ...base, waist:84, neck:39, skinfoldSum3:40 });
    expect(withJP.jp).not.toBeNull();
    expect(withJP.measured).toBe(withJP.jp);
    const obese = calcBodyFat({ weight:100, height:170, age:30, sex:'male', waist:100, neck:40 });
    expect(obese.deurenbergWarn).toContain('BMI');
  });
  it('Stress Load Index alias + дисклеймер E', () => {
    const s = calcStressLoad({ ...base, stress:5, sleepHours:7, acwr:1 });
    const c = calcCortisol({ ...base, stress:5, sleepHours:7, acwr:1 });
    expect(s.nat).toBe(c.nat);
    expect(s.note).toContain('эвристика');
    expect(s.scaleNote).toContain('invented');
  });
  it('Protein timing plant DIAAS + ceiling + pre-sleep', () => {
    const plant = calcProteinTiming(120,80,4, true);
    const animal = calcProteinTiming(120,80,4, false);
    expect(plant.leucinePerMeal).toBeLessThan(animal.leucinePerMeal);
    expect(plant.plantNote).toContain('DIAAS');
    const over = calcProteinTiming(220,70,4);
    expect(over.perMealGPerKg).toBeGreaterThan(0.55);
    expect(over.note).toContain('waste');
    expect(over.preSleepG).toBe(35);
  });
  it('AT Trexler + Reverse MATADOR', () => {
    const at = calcAdaptiveThermogenesis({ weight:80, height:180, age:30, sex:'male', bodyFat:12, deficitKcal:500, weeksInDeficit:6, weightLostKg:3 });
    expect(at.atKcal).toBeGreaterThan(30);
    expect(at.rmrPred).toBeGreaterThan(at.rmrMeasEst);
    const rev = calcReverseDiet(2200,2600);
    expect(rev.length).toBeGreaterThan(2);
    expect(rev[0].kcal).toBe(2300);
  });
  it('NEAT Levine 2002', () => {
    const n = calcNEAT({ weight:80, standingHours:6, fidgetLevel:3, steps:10000 });
    expect(n.total).toBeGreaterThan(300);
    expect(n.standing).toBe(240); // 6*40
    const low = calcNEAT({ weight:80, standingHours:0, fidgetLevel:1, steps:2000 });
    expect(n.total).toBeGreaterThan(low.total);
  });
  it('Thyroid Kim + HOMA-IR Wallace', () => {
    const norm = calcThyroidImpact(17, undefined);
    expect(norm.mult).toBe(1);
    const hypo = calcThyroidImpact(10, undefined);
    expect(hypo.mult).toBeLessThan(1);
    const hyper = calcThyroidImpact(25, undefined);
    expect(hyper.mult).toBeGreaterThan(1);
    const homaOpt = calcHomaIRWrap(80,5); // 0.98 optimal
    expect(homaOpt.zone).toBe('optimal');
    const homaMid = calcHomaIRWrap(92,10); // ≈2.2 attention
    expect(homaMid.zone).toBe('attention');
    const homaIR = calcHomaIRWrap(110,22); // ≈5.99 ir
    expect(homaIR.zone).toBe('ir');
  });
  it('Sweat electrolytes Baker + hallAdaptation continuous', () => {
    const e = calcSweatElectrolytes(1200, 900);
    expect(e.sodiumMg).toBe(1080);
    expect(e.chlorideMg).toBe(1620);
    expect(hallAdaptationFactor(21)).toBeGreaterThan(hallAdaptationFactor(60));
    expect(hallAdaptationFactor(0)).toBe(1);
  });
  it('P3 Lipid Mensink + FLI Bedogni + PSMF + menstrual', async () => {
    const { estimateLipidImpact, calcFLI, checkPSMF, menstrualWaterRetention } = await import('../../core/metabolic-constants');
    const lip = estimateLipidImpact(30, 15, 120);
    expect(lip).not.toBeNull();
    expect(lip!.ldlDelta).toBeGreaterThan(0);
    const fli = calcFLI({ bmi: 28, waistCm: 102, tgMgDl: 180, ggt: 45 });
    expect(fli).not.toBeNull();
    expect(fli!).toBeGreaterThan(30); expect(fli!).toBeLessThan(100);
    const fliLean = calcFLI({ bmi: 22, waistCm: 78, tgMgDl: 80, ggt: 15 });
    expect(fliLean!).toBeLessThan(30);
    expect(checkPSMF(12).risk).toBe(true);
    expect(checkPSMF(25).risk).toBe(false);
    expect(menstrualWaterRetention('luteal').kg).toBe(1.2);
    expect(menstrualWaterRetention('follicular').kg).toBe(0);
  });
});

describe('metabolic-hub v3 — Adaptive TDEE v2, MET, RED-S, Sweat, WHtR, MetS', () => {
  it('Adaptive TDEE v2: intake 2800 trend -0.4 -> TDEE ~3200 ±AT', async () => {
    const { calcAdaptiveTDEE } = await import('../metabolic-hub.engine');
    const wh = [
      { date:'2026-01-01', kg:83},{date:'2026-01-04', kg:82.8},{date:'2026-01-08', kg:82.6},{date:'2026-01-11', kg:82.45},{date:'2026-01-14', kg:82.3},{date:'2026-01-17', kg:82.15},{date:'2026-01-20', kg:82.0},{date:'2026-01-23', kg:81.85}
    ];
    const r = calcAdaptiveTDEE({ weightHistory: wh, avgIntakeKcal: 2800, bodyFatPct: 15, goal:'cut' });
    expect(r).not.toBeNull();
    expect(r!.tdee).toBeGreaterThan(3000);
    expect(r!.tdee).toBeLessThan(3600);
    expect(r!.r2).toBeGreaterThan(0.3);
    expect(r!.targets.cut).toBe(r!.tdee-500);
    expect(r!.targets.bulk).toBe(r!.tdee+300);
  });
  it('Adaptive TDEE v2: <7 points -> null', async () => {
    const { calcAdaptiveTDEE } = await import('../metabolic-hub.engine');
    const wh=[{date:'2026-01-01',kg:80},{date:'2026-01-03',kg:79.9}];
    expect(calcAdaptiveTDEE({ weightHistory: wh, avgIntakeKcal: 2500 } as any)).toBeNull();
  });
  it('Adaptive TDEE v2 plateau detection', async () => {
    const { calcAdaptiveTDEE } = await import('../metabolic-hub.engine');
    const wh=[
      {date:'2026-01-01',kg:80},{date:'2026-01-04',kg:80.0},{date:'2026-01-08',kg:80.0},{date:'2026-01-11',kg:79.98},{date:'2026-01-14',kg:80.02},{date:'2026-01-17',kg:80.01},{date:'2026-01-20',kg:80}
    ];
    const r=calcAdaptiveTDEE({ weightHistory: wh, avgIntakeKcal: 2200, bodyFatPct: 12, goal:'cut' });
    expect(r?.plateau).toBe(true);
  });
  it('MET PAL: 18 met-h -> +0.12 vs base', async () => {
    const { palFromMetHours, computePalFromMet } = await import('../../core/metabolic-constants');
    expect(palFromMetHours(18)).toBeCloseTo(0.12, 0.02);
    const pal = computePalFromMet({ basePal:1.55, metHoursPerWeek:18 });
    expect(pal).toBeGreaterThan(1.60);
    expect(pal).toBeLessThan(1.75);
  });
  it('MET: getEffectivePal via calcSteps', async () => {
    const { calcSteps } = await import('../metabolic-hub.engine');
    const base={ weight:80, height:180, age:30, sex:'male' as const };
    const low=calcSteps({ ...base, activityLevel:'medium', trainingDays:3 });
    const met=calcSteps({ ...base, activityLevel:'medium', metHoursPerWeek:30 } as any);
    expect(met.pal).toBeGreaterThan(low.pal);
    expect(met.tdeeNat).toBeGreaterThan(low.tdeeNat);
  });
  it('RED-S screening: low EA -> high', async () => {
    const { calcRedsScreening } = await import('../metabolic-hub.engine');
    const high=calcRedsScreening({ ea:20, sex:'female', leafScore:9, boneFlag:true } as any);
    expect(high.risk).toBe('high');
    expect(high.score).toBeGreaterThanOrEqual(4);
    const low=calcRedsScreening({ ea:46, sex:'male', leafScore:1 } as any);
    expect(low.risk).toBe('low');
  });
  it('RED-S: RMR ratio <0.90 adds flag', async () => {
    const { calcRedsScreening } = await import('../metabolic-hub.engine');
    const r=calcRedsScreening({ ea:35, sex:'male', rmrRatio:0.85 } as any);
    expect(r.flags.join(',')).toContain('RMR ratio');
    expect(r.score).toBeGreaterThanOrEqual(2);
  });
  it('Sweat rate: (80-79.2+0.5)/1 =1.3 L/h', async () => {
    const { calcSweatTest } = await import('../metabolic-hub.engine');
    const r=calcSweatTest({ preKg:80, postKg:79.2, fluidL:0.5, hours:1, sodiumMgPerL:900, weightKg:80 });
    expect(r).not.toBeNull();
    expect(r!.rateLPerH).toBeCloseTo(1.3, 0.05);
    expect(r!.plan.preMl).toBeGreaterThan(300);
    expect(r!.plan.bottles05).toBeGreaterThan(1);
  });
  it('Sweat: hyponatremia risk when long + plain water', async () => {
    const { calcSweatTest } = await import('../metabolic-hub.engine');
    const r=calcSweatTest({ preKg:75, postKg:74, fluidL:4, hours:4, sodiumMgPerL:400, weightKg:75 });
    expect(r?.plan.hyponatremiaRisk).toBe(true);
  });
  it('WHtR / ABSI / BAI', async () => {
    const { calcWHtR, calcABSI, calcBAI } = await import('../../core/metabolic-constants');
    expect(calcWHtR(84,180)).toBeCloseTo(0.467,0.01);
    expect(calcABSI(84,180,80)).toBeGreaterThan(0.07);
    expect(calcABSI(84,180,80)).toBeLessThan(0.09);
    expect(calcBAI(96,180)).toBeGreaterThan(15);
  });
  it('TyG >=8.8 IR', async () => {
    const { calcTyG } = await import('../../core/metabolic-constants');
    expect(calcTyG(150,100)).toBeGreaterThan(8.8);
    expect(calcTyG(80,85)).toBeLessThan(8.8);
    expect(calcTyG(undefined as any, 100)).toBeNull();
  });
  it('MetS ATP III', async () => {
    const { calcMetS_ATP3 } = await import('../../core/metabolic-constants');
    const mets=calcMetS_ATP3({ waistCm:102, tgMgDl:180, hdlMgDl:35, systolic:135, diastolic:88, glucoseMgDl:105, sex:'male' });
    expect(mets.score).toBeGreaterThanOrEqual(3);
    expect(mets.hasMetS).toBe(true);
    const ok=calcMetS_ATP3({ waistCm:80, tgMgDl:90, hdlMgDl:55, systolic:115, diastolic:75, glucoseMgDl:85, sex:'male' });
    expect(ok.hasMetS).toBe(false);
  });
  it('FIB-4 and QUICKI', async () => {
    const { calcFIB4, calcQUICKI, calcAPRI } = await import('../../core/metabolic-constants');
    const fib=calcFIB4(45,30,35,220);
    expect(fib).toBeGreaterThan(0.5); expect(fib).toBeLessThan(3);
    const q=calcQUICKI(90,10);
    expect(q).toBeGreaterThan(0.3); expect(q).toBeLessThan(0.4);
    const apri=calcAPRI(40,200);
    expect(apri).toBeGreaterThan(0);
  });
  it('Caffeine curve HL 5h', async () => {
    const { calcCaffeineCurve } = await import('../../core/metabolic-constants');
    const c0=calcCaffeineCurve(200,0);
    expect(c0.remainingMg).toBe(200);
    const c5=calcCaffeineCurve(200,5);
    expect(c5.remainingMg).toBeCloseTo(100,5);
    expect(c5.sleepCutoffH).toBe(6);
  });
  it('Diet break MATADOR 12w', async () => {
    const { buildDietBreakPlan, calcRefeedNeed } = await import('../metabolic-hub.engine');
    const p=buildDietBreakPlan(12,9);
    expect(p.length).toBe(12);
    expect(p.filter(x=>x.phase==='maintenance').length).toBeGreaterThan(0);
    const re=calcRefeedNeed(7,12,22);
    expect(re.needed).toBe(true);
    expect(calcRefeedNeed(2,18,40).needed).toBe(false);
  });
  it('Sweat electrolytes still correct after refactor', async () => {
    const { calcSweatElectrolytes } = await import('../../core/metabolic-constants');
    const e=calcSweatElectrolytes(1000,900);
    expect(e.sodiumMg).toBe(900);
    expect(e.chlorideMg).toBe(1350);
  });
  it('Carb/Sodium loading', async () => {
    const { calcCarbLoading, calcSodiumLoading } = await import('../metabolic-hub.engine');
    const c=calcCarbLoading(80,2,10);
    expect(c.dailyG).toBe(800); expect(c.totalCarbG).toBe(1600);
    const s=calcSodiumLoading(80,2,5);
    expect(s.dailyG).toBe(5); expect(s.totalSodiumG).toBe(10);
  });
  it('Body comp hold_ffmi vs hold_bf', async () => {
    const { calcBodyCompProjection } = await import('../metabolic-hub.engine');
    const bf=calcBodyCompProjection({ weight:80, height:180, bodyFat:12, years:3, mode:'hold_bf' });
    const ff=calcBodyCompProjection({ weight:80, height:180, bodyFat:12, years:3, mode:'hold_ffmi' });
    expect(bf[3].ffmi).toBeGreaterThan(ff[3].ffmi);
    expect(ff[3].ffmi).toBeCloseTo(bf[0].ffmi, 0.1);
    expect(ff[3].bodyFat).toBeLessThan(12);
  });
  it('parseWeeklyScheduleText 45мин and 1.5ч', async () => {
    const { parseWeeklyScheduleText, buildMetHours } = await import('../metabolic-hub.engine');
    const p1=parseWeeklyScheduleText('пн: силовая 45мин, вт: бег 1.5ч');
    expect(p1).not.toBeNull();
    expect(p1!.find(x=>x.key==='strength')!.hours).toBeCloseTo(0.75,0.05);
    expect(p1!.find(x=>x.key==='running_moderate')!.hours).toBeCloseTo(1.5,0.05);
    const mh=buildMetHours(p1!);
    expect(mh).toBeGreaterThan(10);
  });
  it('calcLeafScore 8q', async () => {
    const { calcLeafScore } = await import('../metabolic-hub.engine');
    const r=calcLeafScore([true,true,false,false,true,false,false,false]);
    expect(r.score).toBe(6); expect(r.risk).toBe('moderate');
    expect(calcLeafScore(Array(8).fill(true)).risk).toBe('high');
  });
  it('beverage rank', async () => {
    const { calcBeverageRank } = await import('../metabolic-hub.engine');
    const r=calcBeverageRank(1500, 1350);
    expect(r[0].score).toBeGreaterThanOrEqual(r[1].score);
    expect(r.length).toBe(6);
  });
  it('scheduleMetHours integration', async () => {
    const { calcSteps } = await import('../metabolic-hub.engine');
    const base={ weight:80, height:180, age:30, sex:'male' as const };
    const s1=calcSteps({ ...base, activityLevel:'medium', trainingDays:3 });
    const s2=calcSteps({ ...base, activityLevel:'medium', metHoursPerWeek:25 } as any);
    expect(s2.pal).toBeGreaterThan(s1.pal);
  });
});

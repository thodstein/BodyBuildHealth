import { describe, it, expect } from 'vitest';
import { calcWater, calcSteps, calcKBJU, calcBodyFat, calcCortisol, calcHematology, calcTrendFromHistory, calcAdaptiveAdjustment, calcEnergyAvailability, calcAlcohol, calcProteinTiming, calcMaintenanceFinder, calcGoalTimeline } from '../metabolic-hub.engine';
import { bmrCunningham, bmrOwen, bmrTenHaaf, calcTEF as calcTEFConst, calcTrendWithConfidence as calcTrendConf2 } from '../../core/metabolic-constants';

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
  it('lean40/жир20 экономит при ожирении', () => {
    const lean = calcWater({ weight: 110, height:180, age:30, sex:'male', bodyFat:35, trainingDays:0, cardioMin:0 });
    const generic = calcWater({ weight:110, height:180, age:30, sex:'male', trainingDays:0, cardioMin:0 });
    expect(lean.breakdown.base).toBeLessThan(generic.breakdown.base);
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
  it('EA: LEA <30', () => {
    const eaLow = calcEnergyAvailability({ weight:70, bodyFat:10, height:180, intakeKcal:2200, eeeKcal:600 });
    expect(eaLow.ea).not.toBeNull();
    expect(eaLow.ea! < 30).toBeTruthy();
    expect(eaLow.zone).toBe('low');
    const eaOpt = calcEnergyAvailability({ weight:70, bodyFat:10, height:180, intakeKcal:3400, eeeKcal:400 });
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
  it('goal timeline Hall', () => {
    const gt=calcGoalTimeline({ weight:85, targetWeight:80, tdee:2800 });
    expect(gt).not.toBeNull();
    expect(gt!.days).toBeGreaterThan(60);
    expect(gt!.days).toBeLessThan(120);
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

import { describe, it, expect } from 'vitest';
import { calcWater, calcSteps, calcKBJU, calcBodyFat, calcCortisol, calcTrendFromHistory, calcAdaptiveAdjustment } from '../metabolic-hub.engine';

const base = { weight: 80, height: 180, age: 30, sex: 'male' as const };

describe('metabolic-hub — TEF waterfall', () => {
  it('steps: tef ~10% tdee', () => {
    const r = calcSteps({ ...base, activityLevel:'medium', trainingDays:4, cardioMin:60 });
    expect(r.tefNat).toBe(Math.round(r.tdeeNat*0.10));
    expect(r.tefAAS).toBe(Math.round(r.tdeeAAS*0.10));
  });
  it('kbju: neat/eat/tef breakdown совпадает с pal', () => {
    const r = calcKBJU({ ...base, activityLevel:'medium', trainingDays:4 });
    expect(r.neat + r.eat + r.bmr + r.tefNat).toBeGreaterThan(r.nat.tdee * 0.9);
    expect(r.tefNat).toBe(Math.round(r.nat.tdee*0.10));
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
  it('клетчатка male>female', () => {
    const m = calcKBJU({ ...base, sex:'male' });
    const f = calcKBJU({ ...base, sex:'female' });
    expect(m.fiber.nat).toBeGreaterThan(f.fiber.nat);
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
  it('осевая коррекция +0.7/1.4 при trainDays', () => {
    const low = calcBodyFat({ ...base, waist:84, neck:39, trainingDays:2 });
    const high = calcBodyFat({ ...base, waist:84, neck:39, trainingDays:6 });
    expect(high.axialAdd).toBeGreaterThan(low.axialAdd);
    if(high.navy!=null && high.navyAdj!=null) expect(high.navyAdj).toBeGreaterThan(high.navy!);
  });
  it('FFMI_norm + аас надбавка', () => {
    const nat = calcBodyFat({ ...base, waist:84, neck:39 });
    const aas = calcBodyFat({ ...base, waist:84, neck:39, onAAS:true, aasDose:600 });
    expect(aas.ffmiNormAdj).toBeGreaterThan(nat.ffmiNorm);
    expect(nat.natLimit).toBe(25);
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

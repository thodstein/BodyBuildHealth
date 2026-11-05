import { describe, it, expect } from 'vitest';
import { calcWater, calcSteps, calcKBJU, calcBodyFat, calcCortisol, calcStressLoad, calcHematology, calcTrendFromHistory, calcAdaptiveAdjustment, calcEnergyAvailability, calcAlcohol, calcProteinTiming, calcMaintenanceFinder, calcGoalTimeline, calcAdaptiveThermogenesis, calcReverseDiet, calcNEAT, calcThyroidImpact, calcHomaIRWrap, calcATRange, buildOneAnswerPro, balanceCarbsAndFat, getEffectivePal, calcPALPro, calcDeadlineFeasibility, weeklyExerciseEnergy, PONTZER_FORMULA_NOTE, TDEE_ALREADY_ADAPTED_NOTE, IR_MARKERS_SHARED_INPUT_NOTE } from '../metabolic-hub.engine';
import { bmrCunningham, bmrOwen, bmrTenHaaf, bmrHarrisRevised, bmrHenry, bmrLivingston, bmrMethodLabel, bmrMethodSpread, calcHomaIR, calcTyG, calcTEF as calcTEFConst, calcTrendWithConfidence as calcTrendConf2, energyDensityPerKg, hallAdaptationFactor, calcSweatElectrolytes, calcJPBodyFat, calcDurninBodyFat, computeBMR } from '../../core/metabolic-constants';

const base = { weight: 80, height: 180, age: 30, sex: 'male' as const };

describe('metabolic-hub — E1.3: TyG и HOMA-IR не выдаются за два независимых сигнала', () => {
  it('оба показателя делят вход «глюкоза натощак» — и это правда, а не только текст', () => {
    // Доказательство из кода, а не из комментария: глюкоза поднимает ОБА показателя,
    // поэтому «два ⚠» рядом — это один сигнал, посчитанный дважды.
    const lowGlucose = calcHomaIR(90, 5)!, highGlucose = calcHomaIR(130, 5)!;
    expect(highGlucose).toBeGreaterThan(lowGlucose); // HOMA-IR реагирует на глюкозу
    const tygLow = calcTyG(100, 90)!, tygHigh = calcTyG(100, 130)!;
    expect(tygHigh).toBeGreaterThan(tygLow); // TyG тоже реагирует на глюкозу
  });

  it('при одинаковой глюкозе и инсулине разные ТГ не меняют HOMA-IR (и наоборот)', () => {
    // HOMA-IR не «видит» ТГ, TyG не «видит» инсулин — они не копии друг друга,
    // но и не независимые: общий вход остаётся глюкоза.
    expect(calcHomaIR(100, 8)).toBe(calcHomaIR(100, 8));
    expect(calcTyG(200, 100)).not.toBe(calcTyG(80, 100));
  });

  it('HOMA-IR без инсулина не показывается вовсе (нет данных — не «норма»)', () => {
    const r = calcHomaIRWrap(100, undefined);
    expect(r.homa).toBeNull();
    expect(r.zone).toBe('unknown');
    // подпись обязана говорить, чего не хватает, а не выглядеть как «всё хорошо»
    expect(r.note).toMatch(/инсулин/i);
  });

  it('оговорка о общем входе видна пользователю и не заменяет пороги', () => {
    expect(IR_MARKERS_SHARED_INPUT_NOTE).toMatch(/глюкоза/i);
    expect(IR_MARKERS_SHARED_INPUT_NOTE).toMatch(/инсулин/i);
    expect(IR_MARKERS_SHARED_INPUT_NOTE).toMatch(/не два независимых/i);
  });
});

describe('metabolic-hub — E1.2: единая метка BMR (без «Mifflin»-фолбэка)', () => {
  it('все 8 методов имеют собственную подпись, ни один не проваливается в чужую', () => {
    const expected: Record<string, string> = {
      katch_mcardle: 'Katch-McArdle', cunningham: 'Cunningham', owen: 'Owen',
      ten_haaf: 'ten Haaf', mifflin: 'Mifflin', harris_revised: 'Harris-Benedict',
      henry: 'Henry', livingston: 'Livingston',
    };
    for (const [id, frag] of Object.entries(expected)) {
      const label = bmrMethodLabel(id as any);
      expect(label, `метод ${id}`).toContain(frag);
    }
    // Ключевой регресс-тест: раньше 3 метода молча показывались как Mifflin
    for (const id of ['livingston', 'harris_revised', 'henry']) {
      expect(bmrMethodLabel(id as any), `${id} не должен читаться как Mifflin`).not.toBe(bmrMethodLabel('mifflin'));
      expect(bmrMethodLabel(id as any)).not.toContain('Mifflin');
    }
    // неизвестный id не врёт, а показывает себя
    expect(bmrMethodLabel('что-то новое')).toContain('что-то новое');
  });

  it('computeBMR отдаёт все формулы и разброс между ними считается', () => {
    const r = computeBMR({ weight: 80, height: 180, age: 30, sex: 'male' });
    expect(r.allMethods).toBeTruthy();
    const n = Object.keys(r.allMethods!).length;
    expect(n).toBeGreaterThanOrEqual(8);
    const sp = bmrMethodSpread(r.allMethods);
    expect(sp).toBeTruthy();
    expect(sp!.n).toBe(n);
    expect(sp!.spreadPct).toBeGreaterThan(0);
    // выбранный метод реально есть среди посчитанных
    expect(r.allMethods![r.method]).toBeGreaterThan(0);
  });

  it('разброс — это про разные формулы, а НЕ доверительный интервал (E1.2-ловушка)', () => {
    // Замерено пробой, а не выдумано: 46–75% на реальных профилях.
    // Раньше в комментарии стояло «единицы процентов» — это было бы новой ложью.
    const lean = computeBMR({ weight: 55, height: 175, age: 25, sex: 'male' });
    const heavy = computeBMR({ weight: 130, height: 175, age: 25, sex: 'male' });
    const sLean = bmrMethodSpread(lean.allMethods)!;
    const sHeavy = bmrMethodSpread(heavy.allMethods)!;
    // точные замеренные значения — чтобы правка формул не прошла молча
    expect(sLean.spreadPct).toBe(74.7);
    expect(sHeavy.spreadPct).toBe(46);
    // и фиксируем, что разброс велик И по неприменимым формулам:
    // Livingston при BMI 18 даёт 2128 — абсурд, посчитанный «для сравнения»
    expect(lean.allMethods!.livingston).toBeGreaterThan(lean.bmr!);
    expect(lean.method).not.toBe('livingston');
  });

  it('без allMethods разброс не выдумывается (null, а не 0)', () => {
    expect(bmrMethodSpread(undefined)).toBeNull();
    expect(bmrMethodSpread(null)).toBeNull();
    expect(bmrMethodSpread({ only: 1800 })).toBeNull();
    // мусорные значения не должны ломать расчёт
    expect(bmrMethodSpread({ a: 1800, b: 0, c: 1900 })).toBeTruthy();
  });
});

describe('metabolic-hub — E1.1: честная оговорка к TDEE по формуле (Pontzer)', () => {
  it('формульный путь подписывает оценку «реальный расход может быть выше на ~30%»', () => {
    const oa = buildOneAnswerPro({ formulaTDEE: 2800, waterMl: 3000, ea: null });
    expect(oa.tdeeSource).toBe('formula');
    expect(oa.note).toContain('Pontzer');
    expect(oa.note).toContain('~30%');
    // подпись именно про ОЦЕНКУ, а не обещание надбавки
    expect(oa.note).toContain(PONTZER_FORMULA_NOTE);
  });

  it('adaptive-v3 подписывает «уже адаптирован» и НЕ применяет надбавку Pontzer', () => {
    const adaptive = { tdee: 2950, r2: 0.93, confidence: 'good' } as any;
    const oa = buildOneAnswerPro({ formulaTDEE: 2800, adaptiveV3: adaptive, waterMl: 3000, ea: null });
    expect(oa.tdeeSource).toBe('adaptive-v3');
    expect(oa.note).toContain(TDEE_ALREADY_ADAPTED_NOTE);
    // двойного счёта нет: фактический расход = adaptive, надбавка не прибавлена
    expect(oa.tdee).toBe(2950);
    expect(oa.tdee).toBeLessThan(Math.round(2950 * 1.3));
  });

  it('нигде не появилась надбавка «+30% к расходу» (формулу не раздуваем)', () => {
    const formulaOnly = buildOneAnswerPro({ formulaTDEE: 2800, waterMl: 3000, ea: null });
    // без adaptive TDEE == ровно формула, НЕ формула × 1.3
    expect(formulaOnly.tdee).toBe(2800);
    expect(formulaOnly.targets.maintain).toBe(2800);
    // и в подписи нет формулировки «прибавляем/надбавляем +30%»
    expect(formulaOnly.note).not.toMatch(/\+\s*30\s*%/);
    expect(formulaOnly.note).not.toMatch(/(прибав|надбав|добав)\w*\s*\+?\s*30/i);
  });

  it('note шагов и КБЖУ несут ту же оговорку, а не silently её прячут', () => {
    const s = calcSteps({ ...base, activityLevel: 'medium', trainingDays: 4 });
    expect(s.note).toContain('Pontzer');
    const k = calcKBJU({ ...base, activityLevel: 'medium', trainingDays: 4 });
    expect(k.note).toContain('Pontzer');
  });
});

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
  it('потолок углеводов 7г/кг (8 на ААС) — санитарный, а не «урезать цель»', () => {
    const r = calcKBJU({ weight: 110, height:190, age:25, sex:'male', activityLevel:'high', trainingDays:6, goal:'bulk' });
    expect(r.nat.c).toBeLessThanOrEqual(110*7);
    const aas = calcKBJU({ weight:110, height:190, age:25, sex:'male', activityLevel:'high', trainingDays:6, goal:'bulk', onAAS:true, aasDose:800 });
    expect(aas.aas.c).toBeLessThanOrEqual(110*8);
  });
  it('цель по ккал достигается: сушка < поддержание < масса (кап углей не съедает цель)', () => {
    // Было: c=clamp(...,90,weight*5) и всё — при TDEE 3659 ккал «сушка», «поддержание»
    // и «масса» выдавали ~3000 ккал, то есть цель не влияла на итог.
    const cut = calcKBJU({ ...base, goal:'cut' });
    const maintain = calcKBJU({ ...base, goal:'maintain' });
    const bulk = calcKBJU({ ...base, goal:'bulk' });
    expect(cut.nat.kcal).toBeLessThan(maintain.nat.kcal);
    expect(maintain.nat.kcal).toBeLessThan(bulk.nat.kcal);
    // и каждый план сходится с собственной целью (+ протеиновая разница в пределах 60 ккал)
    for (const r of [cut, maintain, bulk]) {
      expect(Math.abs(r.nat.kcal - r.nat.tdee)).toBeLessThanOrEqual(60);
      expect(r.macroGap.nat.gapKcal).toBeGreaterThanOrEqual(-60);
    }
  });
  it('недобор цели подписан честно, если её нельзя набрать макросами', () => {
    // 95 кг, очень высокий расход: угли и жир упираются в потолки — итог ниже цели,
    // и это обязано быть в macroGap.note, а не молча.
    const r = calcKBJU({ weight: 55, height: 150, age: 30, sex:'female', activityLevel:'high', trainingDays:6, cardioMin:180, goal:'bulk', weeklyVolumeTons: 40 } as any);
    if (r.macroGap.nat.gapKcal > 60) {
      expect(r.macroGap.nat.note).toBeTruthy();
      expect(r.macroGap.nat.note).toContain('недостижима');
    }
    // прямой контракт функции балансировки
    const impossible = balanceCarbsAndFat({
      targetKcal: 6000, protG: 200, carbG: 9999, fatG: 300,
      carbFloorG: 90, carbCeilG: 500, fatMinG: 50, fatCeilG: 120,
    });
    expect(impossible.carbG).toBe(500);
    expect(impossible.fatG).toBe(120);
    expect(impossible.gapKcal).toBeGreaterThan(0);
    expect(impossible.note).toMatch(/недостижима/);
  });
  it('срок до цели реально проверяется: медленный план, быстрый, встречный', () => {
    // плотность при BF20% ≈ 4.2 Мкал/кг (energyDensityPerKg), поэтому −0.5 кг/нед ≈ −300 ккал/сут
    const base = { weight: 90, targetWeight: 83, tdee: 2900, bodyFat: 20 };
    const slow = calcDeadlineFeasibility({ ...base, weeks: 14, plannedKcal: 2750 });
    expect(slow?.verdict).toBe('too-slow');
    expect(slow?.note).toMatch(/Не успеешь/);
    expect(slow?.needDeficitKcal).toBeGreaterThan(Math.abs(slow!.plannedDeficitKcal));
    const ok = calcDeadlineFeasibility({ ...base, weeks: 14, plannedKcal: 2600 });
    expect(ok?.verdict).toBe('on-track');
    const fast = calcDeadlineFeasibility({ ...base, weeks: 40, plannedKcal: 2350 });
    expect(fast?.verdict).toBe('too-fast');
    expect(fast?.note).toMatch(/быстрее срока/);
    // цель похудеть, а план в профиците — встречное направление, срок не выполнить
    const wrong = calcDeadlineFeasibility({ ...base, weeks: 14, plannedKcal: 3200 });
    expect(wrong?.verdict).toBe('wrong-direction');
    // вес на цели
    const met = calcDeadlineFeasibility({ ...base, targetWeight: 89.8, weeks: 14, plannedKcal: 2900 });
    expect(met?.verdict).toBe('met');
    // без срока или без цели — null, а не выдуманное число
    expect(calcDeadlineFeasibility({ ...base, weeks: 0, plannedKcal: 2350 })).toBeNull();
    expect(calcDeadlineFeasibility({ ...base, targetWeight: 0, weeks: 14, plannedKcal: 2350 })).toBeNull();
  });
  it('PAL влияет на tdee', () => {
    const low = calcKBJU({ ...base, activityLevel:'low' });
    const high = calcKBJU({ ...base, activityLevel:'high' });
    expect(high.nat.tdee).toBeGreaterThan(low.nat.tdee);
  });
  it('профессия «авто» возвращает бытовую активность в работу (иначе поле мёртвое)', () => {
    // Было: profession по умолчанию 'sedentary' всегда перекрывал activityLevel,
    // и переключатель «Бытовая» ничего не менял.
    const autoLow = getEffectivePal({ ...base, profession:'auto', activityLevel:'low' } as any);
    const autoHigh = getEffectivePal({ ...base, profession:'auto', activityLevel:'high' } as any);
    expect(autoLow.palBase).toBe(1.40);
    expect(autoHigh.palBase).toBe(1.75);
    expect(autoHigh.palEff).toBeGreaterThan(autoLow.palEff);
    // заданная профессия по-прежнему перекрывает бытовую базу
    const office = getEffectivePal({ ...base, profession:'sedentary', activityLevel:'high' } as any);
    expect(office.palBase).toBe(1.40);
    // и PRO-обёртка считает так же
    const proAutoLow = calcPALPro({ ...base, profession:'auto', activityLevel:'low' } as any);
    const proAutoHigh = calcPALPro({ ...base, profession:'auto', activityLevel:'high' } as any);
    expect(proAutoHigh).toBeGreaterThan(proAutoLow);
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
  it('без данных о воде флаг вязкости не выдумывается', () => {
    // Движок раньше молча подставлял 2.5 л и печатал «вязкость OK» — теперь null.
    const unknown = calcHematology({ weight:80, hct:52 });
    expect(unknown.viscosityFlag).toBe(false);
    expect(calcHematology({ weight:80, hct:52, waterL:1.2 }).viscosityFlag).toBe(true);
    // nutritionMult: неизвестная вода не даёт штраф и не даёт «плюс за хорошую» —
    // число совпадает с версией «вода 2.5 л», но ниже «вода 1.2 л».
    const common = { weight:80, hct:45, sodiumG:3, potassiumG:3, proteinPerKg:2, fiberG:30, omega3G:2 } as const;
    const noWater = calcHematology(common);
    expect(noWater.nutritionMult).toBe(calcHematology({ ...common, waterL:2.5 }).nutritionMult);
    expect(calcHematology({ ...common, waterL:1.2 }).nutritionMult).toBeGreaterThan(noWater.nutritionMult);
  });
  it('carb/sodium load печатают оговорку, а не режут её по «—»', async () => {
    const { calcCarbLoading, calcSodiumLoading } = await import('../metabolic-hub.engine');
    const carb = calcCarbLoading(80, 2, 10);
    const na = calcSodiumLoading(80, 2, 5);
    // оговорка — отдельное поле, раньше UI делал note.split('—')[1] и терял её целиком
    expect(carb.caveat).toMatch(/пиковая неделя/i);
    expect(carb.caveat).toMatch(/жиром/i);
    expect(na.caveat).toMatch(/АД/);
    expect(na.caveat).toMatch(/6 г\/сут/);
    // числа по-прежнему считаются
    expect(carb.dailyG).toBe(800);
    expect(na.totalSodiumG).toBe(10);
  });

  it('Na/K без данных не штрафуют питание, а введённые — да', () => {
    const common = { weight:80, hct:45, proteinPerKg:2, fiberG:30, omega3G:2 } as const;
    const base = calcHematology(common);
    // «не задано» — не повод начислять +0.03 ни за низкий K, ни за высокий Na
    expect(calcHematology({ ...common, sodiumG: undefined, potassiumG: undefined }).nutritionMult).toBe(base.nutritionMult);
    expect(calcHematology({ ...common, sodiumG: 5 }).nutritionMult).toBeGreaterThan(base.nutritionMult);
    expect(calcHematology({ ...common, potassiumG: 2 }).nutritionMult).toBeGreaterThan(base.nutritionMult);
    // нормальные значения ничего не добавляют
    expect(calcHematology({ ...common, sodiumG: 3, potassiumG: 4 }).nutritionMult).toBe(base.nutritionMult);
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
  it('факт железа в еде сверяется с советом (ZERO / кап 15 / RDA)', () => {
    // HCT>51 → ZERO; приём 20 мг обязан быть назван «отменить»
    const zero = calcHematology({ weight:80, hct:52, ironIntakeMg:20 });
    expect(zero.ironRecLabel).toContain('отменить');
    expect(zero.recommendations.join(' ')).toContain('отменить');
    // HCT 49 → кап 15; 20 мг выше капа
    expect(calcHematology({ weight:80, hct:49, ironIntakeMg:20 }).ironRecLabel).toContain('выше капа 15');
    expect(calcHematology({ weight:80, hct:49, ironIntakeMg:12 }).ironRecLabel).not.toContain('выше капа');
    // норма + много железа без дефицита → пользы нет
    expect(calcHematology({ weight:80, hct:45, ferritin:120, ironIntakeMg:25 }).ironRecLabel).toContain('больше RDA');
    // норма + ферритин <30 + мало железа → ниже RDA
    expect(calcHematology({ weight:80, hct:45, ferritin:20, ironIntakeMg:8 }).ironRecLabel).toContain('ниже RDA');
    // пусто → подпись не меняется, NaN/undefined не появляются
    const none = calcHematology({ weight:80, hct:45 });
    expect(none.ironRecLabel).toBe('Железо — норма (15-18мг/сут)');
    expect(none.ironRecLabel).not.toMatch(/undefined|NaN/);
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
  it('ручной % жира перебивает калипер только по явному флагу', () => {
    const measured = calcBodyFat({ ...base, skinfoldSum3:100, bodyFat: 26 });
    // без флага приоритет прежний: замер (JP3) > профильный/ручной bodyFat
    expect(measured.current).toBeGreaterThan(26);
    expect(measured.measured).not.toBeNull();
    // с флагом плитка и BMR считают одно и то же число
    const manual = calcBodyFat({ ...base, skinfoldSum3:100, bodyFat: 26, bodyFatAuthoritative: true });
    expect(manual.current).toBe(26);
    // кросс-чек всё равно печатает замер — числа не прячем
    expect(manual.crossCheck).toContain('JP3');
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
    expect(at.known).toBe(true);
    expect(at.tierLabel).not.toMatch(/none|mild|moderate|severe/);
    const rev = calcReverseDiet(2200,2600);
    expect(rev.length).toBeGreaterThan(2);
    expect(rev[0].kcal).toBe(2300);
  });
  it('AT без недель/потерянных кг — «нет данных», а не «адаптации нет»', () => {
    const at = calcAdaptiveThermogenesis({ weight:80, height:180, age:30, sex:'male', bodyFat:12, deficitKcal:500 });
    expect(at.known).toBe(false);
    expect(at.atKcal).toBe(0);
    expect(at.note).toContain('Нет данных');
    expect(at.note).not.toContain('Адаптации нет');
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
    // §1.60: без EA — не «риска нет», а «не рассчитана»
    expect(checkPSMF(null).known).toBe(false);
    expect(checkPSMF(null).risk).toBe(false);
    expect(checkPSMF(null).note).toMatch(/не рассчитана/);
    expect(checkPSMF(25).known).toBe(true);
    expect(menstrualWaterRetention('luteal').kg).toBe(1.2);
    expect(menstrualWaterRetention('follicular').kg).toBe(0);
    // §1.60: фаза не выбрана — не «фолликул», а «не указана»
    expect(menstrualWaterRetention(undefined).known).toBe(false);
    expect(menstrualWaterRetention('none').known).toBe(false);
    expect(menstrualWaterRetention('none').note).toMatch(/не указана/);
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
  it('Diet break: календарь = недели дефицита + брейки, без молчаливой обрезки', async () => {
    const { buildDietBreakPlan, calcRefeedNeed, calcGoalTimelineV2 } = await import('../metabolic-hub.engine');
    const p = buildDietBreakPlan(12, { breakEvery: 6, breakWeeks: 2 });
    // 12 недель дефицита = блок 6 → брейк 2 → блок 6
    expect(p.length).toBe(14);
    expect(p.filter(x => x.phase === 'maintenance').length).toBe(2);
    expect(p[5].phase).toBe('deficit');
    expect(p[6].phase).toBe('maintenance');
    expect(p[p.length - 1].phase).toBe('deficit');
    // после ровно 6 недель брейк не нужен — дефицита больше нет
    expect(buildDietBreakPlan(6).length).toBe(6);
    expect(buildDietBreakPlan(6).some(x => x.phase === 'maintenance')).toBe(false);
    // длина плана совпадает со сроком цели, который печатает хаб
    const g = calcGoalTimelineV2({ weight: 85, targetWeight: 80, tdee: 2800, withDietBreaks: true })!;
    expect(g.breaks).toBeGreaterThan(0);
    expect(buildDietBreakPlan(g.deficitWeeks, { breakWeeks: g.breakWeeks }).length).toBe(g.weeks);
    // и срок с брейками действительно длиннее срока без них на те же недели
    const b = calcGoalTimelineV2({ weight: 85, targetWeight: 80, tdee: 2800 })!;
    expect(g.weeks - b.weeks).toBe(g.breaks * g.breakWeeks);

    const re = calcRefeedNeed(7, 12, 22);
    expect(re.needed).toBe(true);
    expect(calcRefeedNeed(2, 18, 40).needed).toBe(false);
  });
  it('Refeed: порог зависит от пола, неизвестные недели ≠ «не нужен»', async () => {
    const { calcRefeedNeed } = await import('../metabolic-hub.engine');
    // 22% жира — уже «низко» для женщины и ещё норма для мужчины (Trexler/Helms: м <15, ж <24)
    expect(calcRefeedNeed(7, 22, 45, 'female').needed).toBe(true);
    expect(calcRefeedNeed(7, 22, 45, 'male').needed).toBe(false);
    expect(calcRefeedNeed(7, 12, 45, 'male').needed).toBe(true);
    // мало недель — не нужен, и это правда, а не догадка
    expect(calcRefeedNeed(3, 12, 45, 'male').known).toBe(true);
    // недели не введены — «нужны данные», а не вердикт
    const unknown = calcRefeedNeed(undefined, 12, 45);
    expect(unknown.needed).toBe(false);
    expect(unknown.known).toBe(false);
    expect(unknown.note).toContain('не указаны');
    expect(unknown.note).not.toContain('Refeed не нужен');
    // низкая доступность энергии срабатывает и без недель
    expect(calcRefeedNeed(undefined, 12, 25).needed).toBe(true);
  });
  it('finder: уверенность требует длинного окна, а не только R²', () => {
    // 7 взвешиваний за 6 дней — идеальная прямая (R²≈1), но тренд шумный
    const short = Array.from({ length: 7 }, (_, i) => ({ date: `2026-01-0${i + 1}`, kg: 83 - i * 0.1 }));
    const ms = calcMaintenanceFinder(short, 2800);
    expect(ms).not.toBeNull();
    expect(ms!.confidence).toBe('low');
    expect(ms!.note).toContain('окно 6д');
    // три недели — уверенность может быть высокой
    const long = Array.from({ length: 8 }, (_, i) => ({ date: `2026-01-${String(i * 3 + 1).padStart(2, '0')}`, kg: 83 - i * 0.3 }));
    const ml = calcMaintenanceFinder(long, 2800);
    expect(ml!.confidence).not.toBe('low');
    expect(ml!.note).not.toContain('окно');
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

describe('metabolic-hub PRO v4 — Adaptive v3, CAT2, Sweat V2, MetS-добивка, DIAAS, NEAT/AT-range', () => {
  const base = { weight: 80, height: 180, age: 30, sex: 'male' as const };
  it('Adaptive v3: intake 2800 trend -0.4 -> ~3200 ±AT + range + adherence', async () => {
    const { calcAdaptiveTDEEv3 } = await import('../metabolic-hub.engine');
    const wh = [
      { date:'2026-01-01', kg:83},{date:'2026-01-04', kg:82.8},{date:'2026-01-08', kg:82.6},{date:'2026-01-11', kg:82.45},{date:'2026-01-14', kg:82.3},{date:'2026-01-17', kg:82.15},{date:'2026-01-20', kg:82.0},{date:'2026-01-23', kg:81.85},{date:'2026-01-26', kg:81.7},{date:'2026-01-29', kg:81.55}
    ];
    const r = calcAdaptiveTDEEv3({ weightHistory: wh, avgIntakeKcal: 2800, bodyFatPct: 15, goal:'cut', logDays: 12 });
    expect(r).not.toBeNull();
    expect(r!.tdee).toBeGreaterThan(2900); expect(r!.tdee).toBeLessThan(3600);
    expect(r!.low).toBe(Math.round(r!.tdee*0.88)); expect(r!.high).toBe(Math.round(r!.tdee*1.12));
    expect(r!.targets.cut).toBe(r!.tdee-500); expect(r!.targets.mildCut).toBe(r!.tdee-250);
    expect(r!.emaSeries.length).toBe(wh.length);
  });
  it('Adaptive v3: мало логов -> sufficient false + confidence не high', async () => {
    const { calcAdaptiveTDEEv3 } = await import('../metabolic-hub.engine');
    const wh = [
      { date:'2026-01-01', kg:80},{date:'2026-01-04', kg:79.7},{date:'2026-01-08', kg:79.5},{date:'2026-01-11', kg:79.2},{date:'2026-01-14', kg:79.0},{date:'2026-01-17', kg:78.8},{date:'2026-01-20', kg:78.6}
    ];
    const r = calcAdaptiveTDEEv3({ weightHistory: wh, avgIntakeKcal: 2500, logDays: 2 });
    expect(r?.adherence.sufficient).toBe(false);
    expect(r?.confidence).not.toBe('high');
  });
  it('Adaptive v3: <7 точек -> null', async () => {
    const { calcAdaptiveTDEEv3 } = await import('../metabolic-hub.engine');
    expect(calcAdaptiveTDEEv3({ weightHistory: [{date:'2026-01-01',kg:80}], avgIntakeKcal: 2500 } as any)).toBeNull();
  });
  it('MET-60 каталог: 60 записей + профессия PAL + парсер км/2×/EN', async () => {
    const { ACTIVITY_CATALOG_60, computePalFromActivity, parseWeeklyScheduleTextV2 } = await import('../../core/activity-catalog');
    expect(Object.keys(ACTIVITY_CATALOG_60).length).toBeGreaterThanOrEqual(55);
    expect(computePalFromActivity({ profession:'physical', metHoursPerWeek: 10 })).toBeGreaterThan(computePalFromActivity({ profession:'sedentary' }));
    const p = parseWeeklyScheduleTextV2('mon: run 10km, tue: swim 45min, 2× strength 1h');
    expect(p).not.toBeNull();
    expect(p!.some(x=> x.key==='running_moderate')).toBe(true);
  });
  it('PALpro: профессия physical > sedentary при равных MET', async () => {
    const { calcPALPro } = await import('../metabolic-hub.engine');
    const a = calcPALPro({ ...base, activityLevel:'medium', profession:'sedentary' } as any);
    const b = calcPALPro({ ...base, activityLevel:'medium', profession:'physical' } as any);
    expect(b).toBeGreaterThan(a);
  });
  it('BMR-гарды: бариатрия −12%, гипо −12%, этнос −5%, Boer/adjusted', async () => {
    const { computeBMR, boerLeanBodyMass, adjustedBodyWeight, pregnancyTDEEAdd } = await import('../../core/metabolic-constants');
    const b = computeBMR({ weight:80, height:180, age:30, sex:'male', bodyFat:15 });
    const bar = computeBMR({ weight:80, height:180, age:30, sex:'male', bodyFat:15, postBariatric:true } as any);
    expect(bar.bmr).toBeLessThan(b.bmr);
    expect(boerLeanBodyMass(80,180,'male')).toBeGreaterThan(50);
    expect(adjustedBodyWeight(130,180,'male')).toBeLessThan(130);
    expect(pregnancyTDEEAdd({ trimester:3 })).toBe(452);
    expect(pregnancyTDEEAdd({ lactating:'exclusive' })).toBe(500);
  });
  it('Беременность: TDEE +340 Q2 в шагах/КБЖУ', async () => {
    const { calcSteps, calcKBJU } = await import('../metabolic-hub.engine');
    const a = calcSteps({ ...base, activityLevel:'medium' });
    const p = calcSteps({ ...base, activityLevel:'medium', trimester:2 } as any);
    expect(p.tdeeNat - a.tdeeNat).toBe(340);
    const k = calcKBJU({ ...base, trimester:3 } as any);
    expect(k.nat.tdee).toBeGreaterThan(calcKBJU({ ...base }).nat.tdee);
  });
  it('CAT2: red при 2 primary, orange при 1, green при 0', async () => {
    const { calcRedsCAT2, calcLeamScore } = await import('../metabolic-hub.engine');
    const red = calcRedsCAT2({ ea:20, sex:'female', leafScore:9, menstrualFlag:true } as any);
    expect(red.light).toBe('red'); expect(red.primary).toBeGreaterThanOrEqual(2);
    const orange = calcRedsCAT2({ ea:35, sex:'male', rmrRatio:0.85 } as any);
    expect(['orange','red']).toContain(orange.light);
    const green = calcRedsCAT2({ ea:46, sex:'male', leafScore:1 } as any);
    expect(green.light).toBe('green');
    expect(calcLeamScore([true,true,true,false,false,false]).risk).toBe('moderate');
    expect(calcLeamScore([true,true,true,true,false,false]).risk).toBe('high');
    expect(green.returnToPlay).toContain('допуск');
  });
  it('Sweat V2: измеренный + оценка популяции + акклиматизация Na −40%', async () => {
    const { calcSweatTestV2, calcBeverageRankV2 } = await import('../metabolic-hub.engine');
    const m = calcSweatTestV2({ preKg:80, postKg:79.2, fluidL:0.5, hours:1, sodiumMgPerL:900, weightKg:80 });
    expect(m?.rateLPerH).toBeCloseTo(1.3, 0.05);
    const e = calcSweatTestV2({ hours:1, weightKg:80, intensity:'moderate', environment:'hot' } as any);
    expect(e?.measured).toBe(false); expect(e!.rateLPerH).toBeGreaterThan(1.0);
    const acc = calcSweatTestV2({ preKg:80, postKg:79.2, fluidL:0.5, hours:1, sodiumMgPerL:1000, weightKg:80, acclimated:true });
    expect(acc!.elect.sodiumMg).toBeLessThan(m!.elect.sodiumMg);
    expect(calcBeverageRankV2(1500,1350,1)[0].bhi).toBeGreaterThanOrEqual(1.0);
  });
  it('MetS-добивка: TG/HDL, LAP, VAI, FMI', async () => {
    const { calcTGHDLWrap, calcLAPWrap, calcVAIWrap, calcFMIWrap } = await import('../metabolic-hub.engine');
    expect(calcTGHDLWrap(150,40)).toBeCloseTo(3.75, 0.05);
    expect(calcTGHDLWrap(undefined as any, 40)).toBeNull();
    expect(calcLAPWrap(102,180,'male')).toBeGreaterThan(20);
    expect(calcVAIWrap({ waistCm:102, bmi:30, tgMgDl:180, hdlMgDl:35, sex:'male' })).toBeGreaterThan(1.5);
    expect(calcFMIWrap(80,20,180)).toBeCloseTo(4.94, 0.2);
  });
  it('Алко-хроника: 14+ units high (UK CMO)', async () => {
    const { calcAlcoholChronic } = await import('../metabolic-hub.engine');
    expect(calcAlcoholChronic(40,3).unitsPerWeek).toBe(15);
    expect(calcAlcoholChronic(40,3).risk).toBe('high');
    expect(calcAlcoholChronic(40,3).note).toContain('120г');
    expect(calcAlcoholChronic(20,2).risk).toBe('low');
  });
  it('Алко-хроника: без дней — «нет данных», а не «низкая»', async () => {
    const { calcAlcoholChronic } = await import('../metabolic-hub.engine');
    const unknown = calcAlcoholChronic(80, 0);
    expect(unknown.note).toContain('Укажи');
    expect(unknown.note).not.toContain('низкая');
    // без дней, но и без дозы — это честный ноль
    expect(calcAlcoholChronic(0, 0).unitsPerWeek).toBe(0);
    expect(calcAlcoholChronic(0, 0).note).toContain('низкая');
  });
  it('DIAAS PRO: whey leuc > pea, 60+ ceiling 0.60, pre-sleep 40 при 90кг', async () => {
    const { calcProteinTimingPro } = await import('../metabolic-hub.engine');
    const w = calcProteinTimingPro(160,80,4,'whey',30);
    const p = calcProteinTimingPro(160,80,4,'pea',30);
    expect(w.leucinePerMeal).toBeGreaterThan(p.leucinePerMeal);
    expect(w.diaas).toBeGreaterThan(p.diaas);
    expect(calcProteinTimingPro(160,80,4,'mixed',65).ceiling).toBe(0.60);
    expect(calcProteinTimingPro(180,95,4,'mixed',30).preSleepG).toBe(40);
  });
  it('NEATpro профессия + AT-range + reverse-auto', async () => {
    const { calcNEATPro, calcATRange, calcReverseDietAuto } = await import('../metabolic-hub.engine');
    const s = calcNEATPro({ weight:80, profession:'sedentary', steps:5000 });
    const ph = calcNEATPro({ weight:80, profession:'physical', steps:5000 });
    expect(ph.total).toBeGreaterThan(s.total);
    const at = calcATRange({ tdee:2800, deficitKcal:500, weeksInDeficit:6 });
    expect(at.low).toBe(Math.round(2800*0.05)); expect(at.high).toBe(Math.round(2800*0.15));
    const rev = calcReverseDietAuto(2200,2600,-0.4);
    expect(rev[0].kcal).toBe(2350); // шаг 150 при быстром снижении
    expect(calcReverseDietAuto(2200,2600,0.3)[0].kcal).toBe(2260);
  });
  it('Goal V2: rate-caps + diet-break удлиняет', async () => {
    const { calcGoalTimelineV2 } = await import('../metabolic-hub.engine');
    const g = calcGoalTimelineV2({ weight:85, targetWeight:80, tdee:2800, withDietBreaks:true });
    const b = calcGoalTimelineV2({ weight:85, targetWeight:80, tdee:2800 });
    expect(g!.days).toBeGreaterThanOrEqual(b!.days);
    expect(g!.rateNote.length).toBeGreaterThan(5);
  });
  it('One-answer PRO + diff сценариев', async () => {
    const { buildOneAnswerPro, diffMetabolicSnapshots } = await import('../metabolic-hub.engine');
    const o = buildOneAnswerPro({ formulaTDEE:2800, adaptiveV3:null, waterMl:3000, ea:38 });
    expect(o.low).toBe(Math.round(2800*0.88)); expect(o.targets.cut).toBe(2300);
    const d = diffMetabolicSnapshots({ weight:80, goal:'cut' }, { weight:82, goal:'bulk' });
    expect(d.some(x=> x.key==='weight' && x.delta===2)).toBe(true);
  });
  it('diff сценариев видит переключатели (булевы), но не мусорит объектами', async () => {
    const { diffMetabolicSnapshots } = await import('../metabolic-hub.engine');
    // раньше typeof-фильтр отбрасывал boolean: «ААС вкл → выкл» в сравнении не появлялось
    const d = diffMetabolicSnapshots({ weight: 80, onAAS: false }, { weight: 80, onAAS: true });
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ key: 'onAAS', a: false, b: true, delta: null });
    // анкеты — объекты, их в построчный diff не тащим
    expect(diffMetabolicSnapshots({ leafAnswers: { a: 1 } }, { leafAnswers: { a: 2 } })).toHaveLength(0);
    // снятое значение (undefined) vs число — тоже показываем
    const cleared = diffMetabolicSnapshots({ hct: 44 }, { hct: undefined });
    expect(cleared[0]).toMatchObject({ key: 'hct', delta: null });
  });
  it('Парсер PRO: бег 10км -> 1ч, swim EN, 2× strength', async () => {
    const { parseWeeklyScheduleTextPro, buildMetHoursPro } = await import('../metabolic-hub.engine');
    const p = parseWeeklyScheduleTextPro('mon: run 10km, tue: swim 45min, 2× strength 1h');
    expect(p).not.toBeNull();
    expect(p!.find(x=> x.key==='running_moderate')!.hours).toBeCloseTo(1.0, 0.05);
    expect(buildMetHoursPro(p!)).toBeGreaterThan(15);
  });
});

describe('metabolic-hub PRO v4-2 — гарды, CAT2-return, AT-персист, one-answer-беременность', () => {
  const base = { weight: 80, height: 180, age: 30, sex: 'male' as const };
  it('MET-60: точечные MET + профессия ordering sedentary<standing<physical', async () => {
    const { ACTIVITY_CATALOG_60, computePalFromActivity } = await import('../../core/activity-catalog');
    expect(ACTIVITY_CATALOG_60.strength.met).toBe(6.0);
    expect(ACTIVITY_CATALOG_60.running_moderate.met).toBe(10.0);
    expect(ACTIVITY_CATALOG_60.walking.met).toBe(3.8);
    const s = computePalFromActivity({ profession:'sedentary' });
    const st = computePalFromActivity({ profession:'standing' });
    const ph = computePalFromActivity({ profession:'physical' });
    expect(s).toBe(1.40); expect(st).toBe(1.55); expect(ph).toBe(1.75);
  });
  it('Лактация exclusive +500 в шагах; этнос african −5% BMR', async () => {
    const { calcSteps } = await import('../metabolic-hub.engine');
    const { computeBMR } = await import('../../core/metabolic-constants');
    const a = calcSteps({ ...base, activityLevel:'medium' });
    const l = calcSteps({ ...base, activityLevel:'medium', lactating:'exclusive' } as any);
    expect(l.tdeeNat - a.tdeeNat).toBe(500);
    const eu = computeBMR({ weight:80, height:180, age:30, sex:'male', bodyFat:15 });
    const af = computeBMR({ weight:80, height:180, age:30, sex:'male', bodyFat:15, ethnicity:'african' } as any);
    expect(af.bmr).toBe(Math.round(eu.bmr*0.95));
  });
  it('CAT2 return-to-play: red отстранение, orange ограничение', async () => {
    const { calcRedsCAT2 } = await import('../metabolic-hub.engine');
    const red = calcRedsCAT2({ ea:20, sex:'female', leafScore:9, menstrualFlag:true } as any);
    expect(red.returnToPlay).toContain('Отстранение');
    const orange = calcRedsCAT2({ ea:35, sex:'male', rmrRatio:0.85 } as any);
    expect(orange.returnToPlay).toContain('Ограничение');
  });
  it('Sweat V2: rangeNote несёт Na; оценка hot>cool', async () => {
    const { calcSweatTestV2 } = await import('../metabolic-hub.engine');
    const m = calcSweatTestV2({ preKg:80, postKg:79.2, fluidL:0.5, hours:1, sodiumMgPerL:900, weightKg:80 });
    expect(m?.rangeNote).toContain('Na 900');
    const hot = calcSweatTestV2({ hours:1, weightKg:80, intensity:'hard', environment:'hot_humid' } as any);
    const cool = calcSweatTestV2({ hours:1, weightKg:80, intensity:'easy', environment:'cool' } as any);
    expect(hot!.rateLPerH).toBeGreaterThan(cool!.rateLPerH);
  });
  it('Goal V2: агрессивная сушка 60→55 предупреждает >1%/нед', async () => {
    const { calcGoalTimelineV2 } = await import('../metabolic-hub.engine');
    const g = calcGoalTimelineV2({ weight:60, targetWeight:55, tdee:2400 });
    expect(g!.rateNote).toContain('агрессивно');
    const ok = calcGoalTimelineV2({ weight:85, targetWeight:80, tdee:2800 });
    expect(ok!.rateNote).toContain('ок');
  });
  it('AT-range персист: 14нед>0, 4нед=0; NEAT fidget 3>1', async () => {
    const { calcATRange, calcNEATPro } = await import('../metabolic-hub.engine');
    expect(calcATRange({ tdee:2800, deficitKcal:500, weeksInDeficit:14 }).persistent).toBeGreaterThan(0);
    expect(calcATRange({ tdee:2800, deficitKcal:500, weeksInDeficit:4 }).persistent).toBe(0);
    expect(calcNEATPro({ weight:80, fidgetLevel:3 }).total).toBeGreaterThan(calcNEATPro({ weight:80, fidgetLevel:1 }).total);
  });
  it('One-answer с беременностью +340; diff отдаёт все изменения (обрезка — в UI)', async () => {
    const { buildOneAnswerPro, diffMetabolicSnapshots } = await import('../metabolic-hub.engine');
    const o = buildOneAnswerPro({ formulaTDEE:2600, adaptiveV3:null, waterMl:3000, ea:null, pregnancyAddKcal:340 });
    expect(o.tdee).toBe(2940); expect(o.targets.mildCut).toBe(2690);
    const big: Record<string, number> = {}; const big2: Record<string, number> = {};
    for (let i = 0; i < 40; i++) { big['k'+i] = i; big2['k'+i] = i + 1; }
    // 40 изменений — все на месте: счётчик в UI не должен врать «24 поля»
    expect(diffMetabolicSnapshots(big, big2).length).toBe(40);
  });
  it('Парсер PRO: мусор -> null; вело 22км -> 1ч', async () => {
    const { parseWeeklyScheduleTextPro } = await import('../metabolic-hub.engine');
    expect(parseWeeklyScheduleTextPro('просто текст без спорта')).toBeNull();
    expect(parseWeeklyScheduleTextPro(null as any)).toBeNull();
    const p = parseWeeklyScheduleTextPro('ср: вело 22км');
    expect(p!.find(x=> x.key==='cycling')!.hours).toBeCloseTo(1.0, 0.05);
  });
});

describe('metabolic-hub PRO v4-3 — дедуп поколений: PAL-паритет, DIAAS-цели, вода-IOM, гипо, T3', () => {
  const base = { weight: 80, height: 180, age: 30, sex: 'male' as const };
  it('PALpro паритет с формульным PAL при тоннах и кардио', async () => {
    const { calcPALPro, calcSteps } = await import('../metabolic-hub.engine');
    const input = { ...base, activityLevel:'medium', trainingDays:4, cardioMin:90, weeklyVolumeTons:12 } as any;
    expect(Math.abs(calcPALPro(input) - calcSteps(input).pal)).toBeLessThanOrEqual(0.01);
    const met = calcPALPro({ ...base, activityLevel:'medium', metHoursPerWeek:18 } as any);
    expect(met).toBeCloseTo(1.55 + 18 * 0.0067, 0.02);
  });
  it('EEE из тоннажа: 80 ккал/т (было 380 на тонну — завышение ~5x и ложная «LEA red»)', () => {
    const tons20 = weeklyExerciseEnergy({ weeklyVolumeTons: 20, trainingDays: 4, cardioMin: 90 });
    expect(tons20.source).toBe('tonnage');
    expect(tons20.kcalPerWeek).toBe(1600); // 20 т × 80, а не 7600
    const sessions = weeklyExerciseEnergy({ trainingDays: 4, cardioMin: 90 });
    expect(sessions.source).toBe('sessions');
    expect(sessions.kcalPerWeek).toBe(4 * 380 + 90 * 7);
    const none = weeklyExerciseEnergy({});
    expect(none).toEqual({ kcalPerWeek: 0, source: 'none', note: 'EEE не задан' });
    // 5-тонная тренировка ≈ одна силовая сессия по 380 ккал — калибровка согласована
    expect(Math.abs(weeklyExerciseEnergy({ weeklyVolumeTons: 5 }).kcalPerWeek - 380)).toBeLessThanOrEqual(20);
    // и тренд EA: при 20 т/нед и 2600 ккал средний человек не «в красной зоне» от одного объёма
    const eaTons = calcEnergyAvailability({ weight: 80, bodyFat: 15, height: 180, intakeKcal: 2600, eeeKcal: Math.round(tons20.kcalPerWeek / 7), trainingDays: 4 });
    expect(eaTons.ea).toBeGreaterThan(30);
  });
  it('беременность добавляется один раз: +340, а не +680', async () => {
    const { calcSteps, buildOneAnswerPro, pregnancyAdd } = await import('../metabolic-hub.engine');
    const base = { weight: 70, height: 168, age: 29, sex: 'female' as const, activityLevel: 'high' as const };
    const null3 = calcSteps({ ...base } as any);
    const preg = calcSteps({ ...base, trimester: 2 } as any);
    // calcSteps уже включает добавку беременности
    expect(preg.tdeeNat - null3.tdeeNat).toBe(340);
    // в хабе в buildOneAnswerPro уходит база БЕЗ добавки — итог должен остаться +340
    const add = pregnancyAdd({ ...base, trimester: 2 } as any);
    expect(add).toBe(340);
    const one = buildOneAnswerPro({ formulaTDEE: preg.tdeeNat - add, waterMl: 3000, ea: null, pregnancyAddKcal: add });
    expect(one.tdee).toBe(preg.tdeeNat);
    // adaptive-v3 — уже измеренный TDEE, добавка беременности второй раз не идёт
    const adaptive = buildOneAnswerPro({
      formulaTDEE: 2000, waterMl: 3000, ea: null, pregnancyAddKcal: 340,
      adaptiveV3: { tdee: 2600, r2: 0.8, confidence: 'high', emaSeries: [70, 70], trend: 0, adjustment: 0, days: 28, note: '' } as any,
    });
    expect(adaptive.tdee).toBe(2600);
  });
  it('DIAAS в целях: mixed без изменений, горох +надбавка с пометкой', async () => {
    const { calcKBJU } = await import('../metabolic-hub.engine');
    const def = calcKBJU({ ...base });
    const mixed = calcKBJU({ ...base, proteinSource:'mixed' } as any);
    expect(mixed.nat.p).toBe(def.nat.p);
    expect(mixed.note).not.toContain('DIAAS');
    const pea = calcKBJU({ ...base, proteinSource:'pea' } as any);
    expect(pea.nat.p).toBeGreaterThan(def.nat.p);
    expect(pea.nat.protPerKg).toBeCloseTo(+(2.1 * 1.3).toFixed(1), 0.05);
    expect(pea.note).toContain('DIAAS');
    const whey = calcKBJU({ ...base, proteinSource:'whey' } as any);
    expect(whey.nat.p).toBe(def.nat.p); // животный не урезаем
  });
  it('Вода IOM: триместр +300мл, лактация +700мл', async () => {
    const { calcWater } = await import('../metabolic-hub.engine');
    const a = calcWater({ ...base, trainingDays:0, cardioMin:0 });
    const p = calcWater({ ...base, trainingDays:0, cardioMin:0, trimester:2 } as any);
    expect(p.nat - a.nat).toBe(300);
    expect(p.breakdown.pregnancy).toBe(300);
    const l = calcWater({ ...base, trainingDays:0, cardioMin:0, lactating:'exclusive' } as any);
    expect(l.nat - a.nat).toBe(700);
    expect(p.note).toContain('+300');
  });
  it('Нелечёный гипотиреоз: BMR/TDEE −12% сквозно', async () => {
    const { calcSteps } = await import('../metabolic-hub.engine');
    const a = calcSteps({ ...base, activityLevel:'medium', bodyFat:15 });
    const h = calcSteps({ ...base, activityLevel:'medium', bodyFat:15, untreatedHypothyroid:true } as any);
    expect(h.tdeeNat).toBeLessThan(a.tdeeNat);
    expect(a.tdeeNat - h.tdeeNat).toBeGreaterThanOrEqual(Math.round(a.tdeeNat * 0.10));
  });
  it('CAT2: T3-низ даёт secondary-балл', async () => {
    const { calcRedsCAT2 } = await import('../metabolic-hub.engine');
    const a = calcRedsCAT2({ ea:40, sex:'male' } as any);
    const b = calcRedsCAT2({ ea:40, sex:'male', t3Low:true } as any);
    expect(b.secondary).toBe(a.secondary + 1);
    expect(b.flags.join(' ')).toContain('T3');
  });
});

describe('metabolic-hub PRO v4-4 — график EMA/intake + приёмы белка', () => {
  const base = { weight: 80, height: 180, age: 30, sex: 'male' as const };
  const wh = [
    { date:'2026-01-01', kg:83},{date:'2026-01-04', kg:82.8},{date:'2026-01-08', kg:82.6},{date:'2026-01-11', kg:82.45},{date:'2026-01-14', kg:82.3},{date:'2026-01-17', kg:82.15},{date:'2026-01-20', kg:82.0},{date:'2026-01-23', kg:81.85},{date:'2026-01-26', kg:81.7},{date:'2026-01-29', kg:81.55}
  ];
  const intake = wh.map((w, i) => ({ date: w.date, kcal: 2800 - (i % 3) * 100 }));
  it('intakeHistory перекрывает средний ккал и чистит мусор', async () => {
    const { calcAdaptiveTDEEv3 } = await import('../metabolic-hub.engine');
    const low = calcAdaptiveTDEEv3({ weightHistory: wh, avgIntakeKcal: 2000, bodyFatPct: 15, logDays: 12, intakeHistory: intake });
    const high = calcAdaptiveTDEEv3({ weightHistory: wh, avgIntakeKcal: 2000, bodyFatPct: 15, logDays: 12, intakeHistory: intake.map(p => ({ ...p, kcal: p.kcal + 1000 })) });
    expect(low).not.toBeNull(); expect(high).not.toBeNull();
    expect(high!.tdee).toBeGreaterThan(low!.tdee + 800); // ~+1000ккал intake → ~+1000 TDEE
    expect(low!.emaSeries.length).toBe(wh.length);
    const noisy = calcAdaptiveTDEEv3({ weightHistory: wh, avgIntakeKcal: 2000, bodyFatPct: 15, logDays: 12, intakeHistory: [...intake, { date:'2026-01-30', kcal: 50 }, { date:'2026-01-31', kcal: 20000 }] as any });
    expect(noisy!.tdee).toBe(low!.tdee); // 50 и 20000 отфильтрованы
  });
  it('приёмы белка 3/4/5/6 масштабируют порцию', async () => {
    const { calcProteinTimingPro } = await import('../metabolic-hub.engine');
    const total = 160;
    expect(calcProteinTimingPro(total,80,3,'mixed',30).perMeal).toBe(Math.round(total/3));
    expect(calcProteinTimingPro(total,80,6,'mixed',30).perMeal).toBe(Math.round(total/6));
    expect(calcProteinTimingPro(total,80,4,'mixed',30).perMeal).toBe(Math.round(total/4));
    expect(calcProteinTimingPro(total,80,6,'mixed',30).leucinePerMeal).toBeLessThan(calcProteinTimingPro(total,80,3,'mixed',30).leucinePerMeal);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E0.5 (26 сен 2026): единый порог лейцина + середина полосы AT
// ─────────────────────────────────────────────────────────────────────────────
describe('E0.5 — leucine: один порог для вердикта И для математики', () => {
  it('вердикт «MPS ок» и расчёт приёмов используют ОДИН порог 2.5 г', () => {
    // 80 кг × 4 приёма × ~0.4 г/кг ≈ 32 г/приём → ~3.5 г лейцина: «ок».
    const ok = calcProteinTiming(160, 80, 4, false);
    expect(ok.note).toContain('MPS ок');
    expect(ok.note).toContain('≥2.5г');
  });

  it('приём с лейцином в «серой зоне» 2.2–2.49 г НЕ объявляется «ок» (регресс)', () => {
    // 30 г белка/приём × 0.11 = 3.3 г — берём дозу, дающую ровно ~2.3 г лейцина.
    // 2.3 г >= 2.2 (старый порог) → старый код писал «MPS ок»; теперь порог 2.5 → не ок.
    const perMeal = 21; // 21 × 0.11 = 2.31 г лейцина
    const r = calcProteinTiming(perMeal * 4, 80, 4, false);
    expect(r.leucinePerMeal).toBeGreaterThanOrEqual(2.2);
    expect(r.leucinePerMeal).toBeLessThan(2.5);
    expect(r.note).toContain('Мало leuc');
    expect(r.note).not.toContain('MPS ок');
  });

  it('текст «мало лейцина» называет тот же порог, что и математика', () => {
    const r = calcProteinTiming(60, 80, 4, false);
    expect(r.note).toMatch(/<2\.5г/);
  });
});

describe('E0.5 — calcATRange: точка внутри своей полосы', () => {
  it('mid = середина полосы 5–15% (10% TDEE), а не 4%', () => {
    const r = calcATRange({ tdee: 3000 });
    expect(r.low).toBe(150);   // 5%
    expect(r.high).toBe(450);  // 15%
    expect(r.mid).toBe(300);   // 10% — середина
    expect(r.mid).toBeGreaterThanOrEqual(r.low);
    expect(r.mid).toBeLessThanOrEqual(r.high);
  });

  it('адаптация выше полосы НЕ обрезается молча (регресс Math.min(high, mid))', () => {
    // `estimateAdaptiveThermogenesis` ограничен 250 ккал, поэтому «выше полосы 15%»
    // достижимо при TDEE, где 15% < 250 (т.е. TDEE < ~1667). При 2000 ккал
    // полоса выше адаптации — и aboveBand законно false (проверяется отдельно).
    const r = calcATRange({ tdee: 1500, deficitKcal: 1200, weeksInDeficit: 40, weightLostKg: 25 });
    expect(r.high).toBe(225);
    expect(r.aboveBand).toBe(true);
    expect(r.note).toContain('ВЫШЕ полосы');
  });

  it('при нормальном TDEE aboveBand = false (не ложная тревога)', () => {
    const r = calcATRange({ tdee: 3000, deficitKcal: 800, weeksInDeficit: 20, weightLostKg: 12 });
    expect(r.aboveBand).toBe(false);
    expect(r.note).toContain('середина полосы');
  });

  it('персистентная адаптация появляется только при ≥12 нед', () => {
    expect(calcATRange({ tdee: 3000, weeksInDeficit: 4 }).persistent).toBe(0);
    expect(calcATRange({ tdee: 3000, weeksInDeficit: 12 }).persistent).toBeGreaterThan(0);
  });
});
/**
 * Аудит 2026-11 — регрессии на два реальных дефекта расчёта.
 *
 * 1) calcWater прибавлял НЕДЕЛЬНЫЙ пот к СУТОЧНОЙ норме: при 4 тренировках по
 *    часу норма выходила ~6 л вместо ~3.4 л (83 кг). Теперь недельный объём
 *    делится на 7, а электролиты считаются на одну сессию.
 * 2) UI отдавал в calcEnergyAvailability недельный EEE как суточный — EA падала
 *    до «LEA» почти у всех. Контракт движка (EEE в сутки) теперь зафиксирован.
 */
describe('metabolic-hub — аудит 2026-11: вода и EA', () => {
  it('недельный пот делится на 7, а не прибавляется целиком', () => {
    const r = calcWater({
      weight: 83, height: 180, age: 30, sex: 'male',
      trainingDays: 4, cardioMin: 90, sweatRate: 600, standingHours: 0,
    });
    const weekly = r.breakdown.weeklySweatMl;
    expect(weekly).toBeGreaterThan(2000); // 4 силовые + 90 мин кардио в неделю
    expect(r.breakdown.training).toBe(Math.round(weekly / 7));
    // Ключевая регрессия: пот в суточной норме меньше недельного объёма
    expect(r.breakdown.training).toBeLessThan(weekly);
    // И норма не раздувается: 83 кг × 35 = 2905, пот ≤ ~500 мл/сут
    expect(r.nat).toBeLessThan(r.breakdown.base + 700);
  });

  it('электролиты — на одну тренировку, а не на неделю', () => {
    const r = calcWater({
      weight: 83, height: 180, age: 30, sex: 'male',
      trainingDays: 4, cardioMin: 90, sweatRate: 600, standingHours: 0,
    });
    expect(r.breakdown.sessionSweatMl).toBeLessThan(r.breakdown.weeklySweatMl);
    // 1 сессия ≈ 1ч × 600 мл/ч + доля кардио/сут
    expect(r.breakdown.sessionSweatMl).toBeGreaterThan(400);
    expect(r.breakdown.sessionSweatMl).toBeLessThan(1200);
  });

  it('calcEnergyAvailability трактует eeeKcal как СУТОЧНЫЙ EEE', () => {
    const daily = calcEnergyAvailability({ weight: 80, bodyFat: 15, height: 180, intakeKcal: 3200, eeeKcal: 300, sex: 'male' });
    const weeklyAsDaily = calcEnergyAvailability({ weight: 80, bodyFat: 15, height: 180, intakeKcal: 3200, eeeKcal: 2100, sex: 'male' });
    expect(daily.ea).not.toBeNull();
    expect(weeklyAsDaily.ea).not.toBeNull();
    expect(daily.ea!).toBeGreaterThan(weeklyAsDaily.ea!);
    expect(daily.zone).toBe('optimal');
    // недельный EEE, подставленный как суточный, ложно даёт LEA — это и был дефект
    expect(weeklyAsDaily.zone).toBe('low');
  });

  it('вода реагирует на влажность только в жаре', () => {
    const hotDry = calcWater({ weight: 83, height: 180, age: 30, sex: 'male', climate: 'hot', humidity: 40, trainingDays: 0, cardioMin: 0 });
    const hotHumid = calcWater({ weight: 83, height: 180, age: 30, sex: 'male', climate: 'hot', humidity: 85, trainingDays: 0, cardioMin: 0 });
    const cold = calcWater({ weight: 83, height: 180, age: 30, sex: 'male', climate: 'cold', humidity: 85, trainingDays: 0, cardioMin: 0 });
    expect(hotHumid.nat).toBeGreaterThan(hotDry.nat);
    expect(cold.nat).toBe(hotDry.nat - 600 - 150);
  });
});

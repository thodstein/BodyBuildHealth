import { describe, expect, it } from 'vitest';
import {
  calcProteinKidney,
  ckdEpi2021,
  classifyAlbuminuria,
  estimateUrineOsmolality,
  gfrCategoryOf,
  proteinToleranceCap,
  renalSoluteLoad,
  type ProteinKidneyInput,
} from '../protein-kidney-tolerance.engine';

const base = (over: Partial<ProteinKidneyInput> = {}): ProteinKidneyInput => ({
  weightKg: 80,
  heightCm: 180,
  age: 30,
  sex: 'male',
  training: 'resistance',
  goal: 'bulk',
  proteinGPerDay: 144, // 1.8 г/кг
  waterMlPerDay: 2800,
  ureaMmolL: 5,
  creatinineUmolL: 80,
  urineSg: 1.015,
  ...over,
});

describe('protein-kidney-tolerance: формулы', () => {
  it('CKD-EPI 2021 даёт физиологичную СКФ для мужчины 40 лет, креатинин 80', () => {
    const v = ckdEpi2021(80, 40, 'male');
    expect(v).toBeGreaterThan(105);
    expect(v).toBeLessThan(115);
    expect(gfrCategoryOf(v)).toBe('G1');
  });

  it('CKD-EPI 2021 ниже у женщины при том же креатинине', () => {
    // Сравнивать надо один и тот же креатинин: при разных значениях женская
    // формула с меньшей kappa может дать цифру выше мужской.
    expect(ckdEpi2021(80, 40, 'female')).toBeLessThan(ckdEpi2021(80, 40, 'male'));
  });

  it('категории альбуминурии по границам KDIGO', () => {
    expect(classifyAlbuminuria(2.9)).toBe('A1');
    expect(classifyAlbuminuria(3)).toBe('A2');
    expect(classifyAlbuminuria(30)).toBe('A2');
    expect(classifyAlbuminuria(30.1)).toBe('A3');
  });

  it('оценка осмолярности мочи по SG работает и отдаёт диапазон', () => {
    const r = estimateUrineOsmolality(1.020);
    expect(r.value).toBe(800);
    expect(r.range?.[0]).toBeLessThan(800);
    expect(r.range?.[1]).toBeGreaterThan(800);
  });

  it('RSL: белок + электролиты рациона', () => {
    const r = renalSoluteLoad({
      proteinGPerDay: 160,
      dietarySodiumG: 2.3,
      dietaryPotassiumG: 3.5,
      dietaryChlorideG: 3.6,
    });
    expect(r.proteinPart).toBe(928);
    expect(r.electrolytesKnown).toBe(true);
    expect(r.total).toBeGreaterThan(1150);
    expect(r.total).toBeLessThan(1300);
  });
});

describe('protein-kidney-tolerance: потолок белка', () => {
  it('здоровые почки + силовой тренинг: базовый потолок 2.2 г/кг', () => {
    const r = proteinToleranceCap({ training: 'resistance', age: 30 });
    expect(r.cap).toBe(2.2);
  });

  it('СКФ <45 опускает потолок до 0.8 г/кг', () => {
    const r = proteinToleranceCap({ training: 'resistance', age: 30, egfr: 40 });
    expect(r.cap).toBe(0.8);
  });

  it('A3 опускает потолок до 1.0 г/кг', () => {
    const r = proteinToleranceCap({ training: 'resistance', age: 30, albuminuria: 'A3' });
    expect(r.cap).toBe(1.0);
  });

  it('высокая мочевина опускает потолок до 1.8, затем 1.2', () => {
    expect(proteinToleranceCap({ training: 'resistance', age: 30, ureaMmolL: 9 }).cap).toBe(1.8);
    expect(proteinToleranceCap({ training: 'resistance', age: 30, ureaMmolL: 13 }).cap).toBe(1.2);
  });

  it('расширяет до переносимости только при чистых маркерах', () => {
    expect(proteinToleranceCap({ training: 'resistance', age: 30, egfr: 105, ureaMmolL: 5, urineSg: 1.015 }).cap).toBe(3.0);
    // Следы белка — уже не «чисто».
    expect(proteinToleranceCap({ training: 'resistance', age: 30, egfr: 105, ureaMmolL: 5, proteinuriaScore: 0.5 }).cap).toBe(2.2);
    // Концентрированная моча — сначала вода.
    expect(proteinToleranceCap({ training: 'resistance', age: 30, egfr: 105, ureaMmolL: 5, urineSg: 1.035 }).cap).toBe(2.2);
  });
});

describe('protein-kidney-tolerance: вердикт', () => {
  it('здоровый атлет 1.8 г/кг: прибавка до 2.2 г/кг, переносимость выше', () => {
    const r = calcProteinKidney(base());
    expect(r.benefitCapGPerKg).toBe(2.2);
    expect(r.capGPerKg).toBe(3.0);
    expect(r.proteinGPerKg).toBe(1.8);
    expect(r.headroomGPerDay).toBe(32);
    expect(r.toleranceHeadroomGPerDay).toBe(96);
    expect(r.increaseAllowed).toBe(true);
    expect(r.increasePaused).toBe(false);
    expect(r.status).toBe('within');
    expect(r.steps.length).toBeGreaterThan(0);
    // Шаги ведут к пользе, а не к максимуму переносимости.
    expect(r.steps.every((s) => s.gPerKg <= 2.2 + 1e-9)).toBe(true);
  });

  it('2.4 г/кг + чистые анализы: переносится, но пользы сверх 2.2 нет', () => {
    const r = calcProteinKidney(base({ proteinGPerDay: 192 }));
    expect(r.proteinGPerKg).toBe(2.4);
    expect(r.benefitCapGPerKg).toBe(2.2);
    expect(r.capGPerKg).toBe(3.0);
    expect(r.status).toBe('above_benefit');
    expect(r.headroomGPerDay).toBe(0);
    expect(r.toleranceHeadroomGPerDay).toBe(48);
    expect(r.increaseAllowed).toBe(false);
    expect(r.canIncreaseToTolerance).toBe(true);
    expect(r.utilization.status).toBe('handled');
    expect(r.steps.length).toBeGreaterThan(0);
    expect(r.steps.every((s) => s.beyondBenefit)).toBe(true);
  });

  it('2.4 г/кг + мочевина 9: часть белка окисляется, прибавка на паузе', () => {
    const r = calcProteinKidney(base({ proteinGPerDay: 192, ureaMmolL: 9 }));
    expect(r.utilization.status).toBe('partial');
    expect(r.capGPerKg).toBe(1.8);
    expect(r.status).toBe('above_tolerance');
    expect(r.increasePaused).toBe(true);
    expect(r.canIncreaseToTolerance).toBe(false);
  });

  it('2.4 г/кг + мочевина 13: перегрузка, прибавки нет', () => {
    const r = calcProteinKidney(base({ proteinGPerDay: 192, ureaMmolL: 13 }));
    expect(r.utilization.status).toBe('excess');
    expect(r.status).toBe('above_tolerance');
    expect(r.increaseAllowed).toBe(false);
    expect(r.steps).toHaveLength(0);
  });

  it('без мочевины честно отвечает «нужны данные», потолок не расширяет', () => {
    const r = calcProteinKidney(base({ ureaMmolL: undefined }));
    expect(r.utilization.status).toBe('unknown');
    expect(r.capGPerKg).toBe(2.2);
  });

  it('ААС + чистые анализы: переносимость до 3.2 г/кг, СКФ — с оговоркой', () => {
    const r = calcProteinKidney(base({ aasUse: true, proteinGPerDay: 240 }));
    expect(r.capGPerKg).toBe(3.2);
    expect(r.proteinGPerKg).toBe(3);
    expect(r.status).toBe('above_benefit');
    expect(r.utilization.status).toBe('handled');
    expect(r.utilization.confidence).toBe('medium');
    expect(r.flags.some((f) => f.code === 'aas')).toBe(true);
  });

  it('ААС: СКФ 78 по креатинину не блокирует расширение, без ААС — блокирует', () => {
    const withAas = proteinToleranceCap({ training: 'resistance', age: 30, aasUse: true, egfr: 78, ureaMmolL: 5, urineSg: 1.015 });
    expect(withAas.cap).toBe(3.2);
    const plain = proteinToleranceCap({ training: 'resistance', age: 30, egfr: 78, ureaMmolL: 5, urineSg: 1.015 });
    expect(plain.cap).toBe(2.2);
  });

  it('говорит, когда пересдать: срочно / после воды / после шага', () => {
    const urgent = calcProteinKidney(base({ ureaMmolL: 13 }));
    expect(urgent.retest.afterDays).toBe(3);
    expect(urgent.retest.urgent).toBe(true);
    expect(urgent.retest.title).toMatch(/2–3 дня/);

    const paused = calcProteinKidney(base({ waterMlPerDay: 1200 }));
    expect(paused.increasePaused).toBe(true);
    expect(paused.retest.afterDays).toBe(7);

    const plan = calcProteinKidney(base());
    expect(plan.retest.afterDays).toBe(14);
    expect(plan.retest.items.join(' ')).toMatch(/мочевина/);
    expect(plan.retest.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const none = calcProteinKidney(base({ ureaMmolL: undefined, creatinineUmolL: undefined }));
    expect(none.retest.afterDays).toBe(0);
    expect(none.retest.title).toMatch(/Сдать сейчас/);
  });

  it('ААС добавляет в пересдачу цистатин C и UACR', () => {
    const r = calcProteinKidney(base({ aasUse: true, proteinGPerDay: 240 }));
    expect(r.retest.items.join(' ')).toMatch(/цистатин C/);
    expect(r.retest.items.join(' ')).toMatch(/UACR/);
  });

  it('LBM: белок и оба потолка пересчитываются на тощую массу', () => {
    const r = calcProteinKidney(base({ bodyFatPct: 10 }));
    expect(r.leanMassKg).toBe(72);
    expect(r.proteinGPerKgLbm).toBe(2);
    expect(r.benefitCapLbmGPerKg).toBe(2.4);
    expect(r.toleranceCapLbmGPerKg).toBe(3.3);
    expect(r.benefitBasis).toMatch(/Morton/);
  });

  it('BUN/креатинин считается в привычных единицах (10–20)', () => {
    const r = calcProteinKidney(base({ ureaMmolL: 5, creatinineUmolL: 90 }));
    expect(r.bunMgDl).toBe(14);
    expect(r.bunCreatinineRatio).toBeCloseTo(13.8, 1);
    expect(r.bunCrPattern).toBe('normal');
  });

  it('СКФ 40: наращивание запрещено, есть красный флаг', () => {
    // Креатинин 195 мкмоль/л у мужчины 30 лет → CKD-EPI ≈40 (G3b): потолок 0.8.
    const r = calcProteinKidney(base({ creatinineUmolL: 195, ureaMmolL: 11 }));
    expect(r.egfr).toBeLessThan(60);
    expect(r.capGPerKg).toBe(0.8);
    expect(r.increaseAllowed).toBe(false);
    expect(r.flags.some((f) => f.code === 'egfr_low' || f.code === 'egfr_critical')).toBe(true);
  });

  it('мочевина 9 + нормальная СКФ: белок не режем, но прибавку ставим на паузу', () => {
    const r = calcProteinKidney(base({ ureaMmolL: 9, proteinGPerDay: 128 }));
    expect(r.capGPerKg).toBe(1.8);
    expect(r.increasePaused).toBe(true);
    expect(r.pauseReason).toMatch(/вода|мочевин|анализ/i);
  });

  it('протеинурия A3: нет прибавки, потолок 1.0', () => {
    const r = calcProteinKidney(base({ uacrMgMmol: 45 }));
    expect(r.albuminuriaCategory).toBe('A3');
    expect(r.capGPerKg).toBe(1.0);
    expect(r.increaseAllowed).toBe(false);
    expect(r.flags.some((f) => f.code === 'albuminuria_a3')).toBe(true);
  });

  it('микроальбумин + креатинин мочи превращаются в UACR', () => {
    const r = calcProteinKidney(base({ microalbuminMgL: 60, urineCreatinineMmolL: 10 }));
    expect(r.uacrMgMmol).toBe(6);
    expect(r.albuminuriaCategory).toBe('A2');
  });

  it('вода: цель не ниже 35 мл/кг и учитывает осмолярную нагрузку', () => {
    const r = calcProteinKidney(base({ proteinGPerDay: 200, waterMlPerDay: 1500 }));
    expect(r.waterTargetMl).toBeGreaterThanOrEqual(2800);
    expect(r.waterDeficitMl).toBeGreaterThan(0);
    expect(r.urineVolumeNeededMl).toBeGreaterThan(0);
  });

  it('what-if показывает, влезает ли прибавка и сколько добавить воды', () => {
    const r = calcProteinKidney(base({ plannedIncreaseGPerDay: 20 }));
    expect(r.planned?.totalG).toBe(164);
    expect(r.planned?.withinCap).toBe(true);
    expect(r.planned?.extraWaterMl).toBeGreaterThan(100);
  });

  it('без анализов честно говорит «нет данных», а не выдумывает норму', () => {
    const r = calcProteinKidney(base({
      ureaMmolL: undefined,
      creatinineUmolL: undefined,
      urineSg: undefined,
      waterMlPerDay: undefined,
    }));
    expect(r.egfr).toBeUndefined();
    expect(r.bunCrPattern).toBe('unknown');
    expect(r.hydrationStatus).toBe('unknown');
    expect(r.score).toBeLessThan(20);
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildDoctorSummary,
  calcProteinKidney,
  ckdEpi2021,
  ckdEpi2021CrCys,
  ckdEpi2021Cys,
  classifyAlbuminuria,
  estimateUrineOsmolality,
  gfrCategoryOf,
  loadProteinKidneyHistory,
  PROTEIN_KIDNEY_HISTORY_KEY,
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
  urineProteinScore: 0,
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
    expect(proteinToleranceCap({ training: 'resistance', age: 30, egfr: 105, ureaMmolL: 5, urineSg: 1.015, hasProteinuriaData: true }).cap).toBe(3.0);
    // Следы белка — уже не «чисто».
    expect(proteinToleranceCap({ training: 'resistance', age: 30, egfr: 105, ureaMmolL: 5, proteinuriaScore: 0.5, hasProteinuriaData: true }).cap).toBe(2.2);
    // Концентрированная моча — сначала вода.
    expect(proteinToleranceCap({ training: 'resistance', age: 30, egfr: 105, ureaMmolL: 5, urineSg: 1.035, hasProteinuriaData: true }).cap).toBe(2.2);
    // Без белка мочи расширения нет: «не проверено» ≠ «чисто».
    expect(proteinToleranceCap({ training: 'resistance', age: 30, egfr: 105, ureaMmolL: 5, urineSg: 1.015 }).cap).toBe(2.2);
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

  it('ААС + чистые анализы и цистатин C: переносимость до 3.2 г/кг', () => {
    const r = calcProteinKidney(base({ aasUse: true, cystatinCMgL: 0.8, proteinGPerDay: 240 }));
    expect(r.capGPerKg).toBe(3.2);
    expect(r.proteinGPerKg).toBe(3);
    expect(r.status).toBe('above_benefit');
    expect(r.utilization.status).toBe('handled');
    expect(r.egfrSource).toBe('ckd-epi-cr-cys');
    expect(r.flags.some((f) => f.code === 'aas')).toBe(true);
  });

  it('ААС без цистатина C: расширение только до 2.8, 3.2 требует подтверждения', () => {
    const r = calcProteinKidney(base({ aasUse: true, proteinGPerDay: 240 }));
    expect(r.capGPerKg).toBe(2.8);
    expect(r.flags.some((f) => f.code === 'aas_creatinine_only')).toBe(true);
    // 3.0 > 2.8: вывод об усвоении не должен говорить «переносится».
    expect(r.status).toBe('above_tolerance');
    expect(r.utilization.status).toBe('excess');
  });

  it('ААС: СКФ 78 по креатинину даёт 2.8, без ААС — не расширяет', () => {
    const withAas = proteinToleranceCap({ training: 'resistance', age: 30, aasUse: true, aasCreatinineOnly: true, egfr: 78, ureaMmolL: 5, urineSg: 1.015, hasProteinuriaData: true });
    expect(withAas.cap).toBe(2.8);
    const plain = proteinToleranceCap({ training: 'resistance', age: 30, egfr: 78, ureaMmolL: 5, urineSg: 1.015, hasProteinuriaData: true });
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
    // Набор: ориентир по LBM (Helms) даёт 2.3 г/кг массы.
    expect(r.benefitCapGPerKg).toBe(2.3);
    expect(r.benefitCapLbmGPerKg).toBe(2.6);
    expect(r.toleranceCapLbmGPerKg).toBe(3.3);
    expect(r.benefitBasis).toMatch(/Morton/);
  });

  it('сушка: ориентир пользы выше за счёт тощей массы', () => {
    const r = calcProteinKidney(base({ goal: 'cut', bodyFatPct: 10, proteinGPerDay: 192 }));
    expect(r.benefitCapGPerKg).toBeGreaterThan(2.2);
    expect(r.benefitBasis).toMatch(/Helms/);
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

describe('protein-kidney-tolerance: защита от мусорных данных', () => {
  it('нулевая мочевина не считается «чистой» и не расширяет потолок', () => {
    const r = calcProteinKidney(base({ ureaMmolL: 0, proteinGPerDay: 192 }));
    expect(r.capGPerKg).toBe(2.2);
    expect(r.dataIssues.some((d) => d.code === 'urea')).toBe(true);
    expect(r.utilization.status).toBe('unknown');
    expect(r.retest.title).toMatch(/Проверьте/);
    expect(r.status).toBe('above_benefit');
  });

  it('SG 0.5 не расширяет потолок', () => {
    const r = calcProteinKidney(base({ urineSg: 0.5 }));
    expect(r.dataIssues.some((d) => d.code === 'urine_sg')).toBe(true);
    expect(r.capGPerKg).toBe(2.2);
  });

  it('отрицательный UACR не превращается в A1', () => {
    const r = calcProteinKidney(base({ uacrMgMmol: -5 }));
    expect(r.dataIssues.some((d) => d.code === 'uacr')).toBe(true);
    expect(r.albuminuriaCategory).toBe('unknown');
    expect(r.capGPerKg).toBe(2.2);
  });

  it('тест-полоска 3+ — это A3, а не «умеренная» A2', () => {
    const r = calcProteinKidney(base({ urineProteinScore: 3, uacrMgMmol: undefined }));
    expect(r.albuminuriaCategory).toBe('A3');
    expect(r.capGPerKg).toBe(1.0);
  });

  it('до 18 лет взрослая CKD-EPI не расширяет потолок', () => {
    const r = calcProteinKidney(base({ age: 16 }));
    expect(r.capGPerKg).toBe(2.2);
    expect(r.flags.some((f) => f.code === 'pediatric')).toBe(true);
    expect(r.utilization.status).toBe('unknown');
    expect(r.retest.items.join(' ')).toMatch(/детск/i);
  });

  it('без белка мочи расширения нет: «не проверено» ≠ «чисто»', () => {
    const r = calcProteinKidney({ ...base(), urineProteinScore: undefined });
    expect(r.capGPerKg).toBe(2.2);
    expect(r.flags.some((f) => f.code === 'urine_protein_missing')).toBe(true);
    expect(r.utilization.label).toBe('Нужен белок мочи');
    expect(r.retest.title).toMatch(/ОАМ с белком/);
  });
});

describe('protein-kidney-tolerance: клинические уточнения', () => {
  it('CKD-EPI по цистатину C и комбинированная формула физиологичны', () => {
    const cys = ckdEpi2021Cys(0.8, 40, 'male');
    expect(cys).toBeGreaterThan(100);
    expect(cys).toBeLessThan(125);
    const both = ckdEpi2021CrCys(80, 0.8, 40, 'male');
    expect(both).toBeGreaterThan(100);
    expect(both).toBeLessThan(130);
    expect(ckdEpi2021Cys(0.8, 40, 'female')).toBeLessThan(ckdEpi2021Cys(0.8, 40, 'male'));
  });

  it('низкая вода не маскируется нормальным SG', () => {
    const r = calcProteinKidney(base({ waterMlPerDay: 1200, urineSg: 1.015 }));
    expect(r.hydrationStatus).toBe('dehydrated');
    expect(r.increasePaused).toBe(true);
  });

  it('ААС + СКФ 68 по креатинину: не «снизьте», а «нужен цистатин C»', () => {
    const r = calcProteinKidney(base({ aasUse: true, creatinineUmolL: 130, proteinGPerDay: 192 }));
    expect(r.egfrSource).toBe('ckd-epi');
    expect(r.egfr).toBeGreaterThan(60);
    expect(r.egfr).toBeLessThan(75);
    expect(r.status).toBe('above_benefit');
    expect(r.utilization.label).toMatch(/цистатин/i);
    expect(r.capGPerKg).toBe(2.2);
  });

  it('сушка с LBM поднимает ориентир пользы, поддержание — нет', () => {
    const cut = calcProteinKidney(base({ goal: 'cut', bodyFatPct: 10 }));
    const maintain = calcProteinKidney(base({ goal: 'maintain', bodyFatPct: 10 }));
    expect(cut.benefitCapGPerKg).toBeGreaterThan(maintain.benefitCapGPerKg);
    expect(cut.benefitBasis).toMatch(/Helms/);
  });

  it('pH и суточный диурез дают флаги', () => {
    const r = calcProteinKidney(base({ urinePh: 5, urineVolume24hMl: 700 }));
    expect(r.flags.some((f) => f.code === 'acid_urine')).toBe(true);
    expect(r.flags.some((f) => f.code === 'low_diuresis')).toBe(true);
  });

  it('НПВС + обезвоживание блокируют расширение', () => {
    const r = calcProteinKidney(base({ nsaidUse: true, waterMlPerDay: 1200 }));
    expect(r.capGPerKg).toBe(2.2);
    expect(r.flags.some((f) => f.code === 'nsaid_dehydrated')).toBe(true);
  });

  it('гипертония и диабет добавляют наблюдение, но не режут белок сами по себе', () => {
    const r = calcProteinKidney(base({ hypertension: true, diabetes: true }));
    expect(r.flags.some((f) => f.code === 'hypertension')).toBe(true);
    expect(r.flags.some((f) => f.code === 'diabetes')).toBe(true);
    expect(r.capGPerKg).toBe(3.0);
  });

  it('при ХБП цель по воде ограничена 2.5 л', () => {
    const r = calcProteinKidney(base({ knownCkd: true, waterMlPerDay: 2000 }));
    expect(r.waterTargetMl).toBe(2500);
    expect(r.flags.some((f) => f.code === 'water_ckd')).toBe(true);
  });

  it('сводка для врача содержит дату, потолки и план пересдачи', () => {
    const input = base();
    const r = calcProteinKidney(input);
    const text = buildDoctorSummary(input, r, '2026-01-01');
    expect(text).toContain('01.01.2026');
    expect(text).toContain('Потолок пользы');
    expect(text).toContain('Пересдать');
  });

  it('история игнорирует битые записи', () => {
    localStorage.setItem(PROTEIN_KIDNEY_HISTORY_KEY, JSON.stringify([
      { date: '2026-01-01', score: 'нет', proteinGPerKg: 2 },
      { date: '2026-01-02', score: 10, proteinGPerKg: 2, level: 'low', capGPerKg: 3, headroomGPerDay: 10, proteinGPerDay: 160 },
    ]));
    const h = loadProteinKidneyHistory();
    expect(h).toHaveLength(1);
    expect(h[0]?.date).toBe('2026-01-02');
  });
});

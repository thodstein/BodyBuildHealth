/**
 * Замки Волны 1 (docs/BB-AUTO-FULL-AUDIT-PLAN-2026-11.md):
 * P0-1  Утечка дефолтных pedDoses натуралам / несовершеннолетним (<18) / одиночному стеку AAS
 * P0-3  Загрузка сохранённого плана Contest Prep после даты шоу (фаза post_show)
 * P0-4  Стратегия `back` пик-недели распределяет 100% углеводного бюджета
 * P0-5  Prep-цикл: нисходящий тапер, корректный ratePct (не ×100), реальные peds/baseMrv
 * P0-7  scoreBBShowPrep берёт bodyFatPct из plan.config, не штрафуя на -70
 * P0-16 Полный inputSnapshot в buildBBPlan (specialization, dcMode, packingV2, bannedPatterns и др.)
 * P0-18 normalizeBBMuscle понимает русские лейблы из дневника
 * P0-19 bannedPatterns ступени возврата исключают запрещённые шаблоны в buildBBPlan
 */
import { describe, it, expect } from 'vitest';
import { buildBBPlan, sanitizePedDosesForInput } from '../bb-builder.engine';
import {
  buildBBContestPrepPlan,
  buildPeakWeek,
  CARB_DISTRIBUTION,
  deserializeBBContestPrepPlan,
  deserializeBBPrepConfig,
  isoAddDays,
  isoToday,
  PHASES_BY_STRATEGY,
  serializeBBContestPrepPlan,
  validateBBContestPrepConfig,
  type BBContestPrepConfig,
} from '../bb-contest-prep.engine';
import { buildPrepCycle, buildPrepNutritionPlan, buildPrepProgression, type PrepCycleConfig } from '../bb-prep-cycle.engine';
import { scoreBBShowPrep } from '../bb-show-coach.engine';
import { normalizeBBMuscle } from '../bb-volume.engine';

function futureIso(days: number): string {
  return isoAddDays(isoToday(), days);
}

function makePrepConfig(over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig {
  return {
    sex: 'male',
    category: 'mens_bb',
    weightKg: 85,
    heightCm: 178,
    bodyFatPct: 8,
    experienceLevel: 'advanced',
    enhanced: false,
    prepCount: 2,
    showDate: futureIso(56),
    weeksOut: 3,
    trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate',
    waterStrategy: 'stable',
    sodiumStrategy: 'stable',
    ...over,
  };
}

describe('Wave 1 P0 audit locks (engines)', () => {
  it('P0-1: sanitizePedDosesForInput & buildBBPlan не пропускают дефолтные GH/insulin/AAS натуралу, <18 и на соло-AAS', () => {
    const defaultUiDoses = { AAS: 500, insulin: 10, MGF: 200, IGF1: 50, GH: 4 };

    expect(sanitizePedDosesForInput({ peds: [], pedDoses: defaultUiDoses })).toEqual({});
    expect(sanitizePedDosesForInput({ peds: ['AAS', 'GH', 'insulin'], pedDoses: defaultUiDoses, age: 16 })).toEqual({});
    expect(sanitizePedDosesForInput({ peds: ['AAS'], pedDoses: defaultUiDoses, age: 28 })).toEqual({ AAS: 500 });
    // Обратная совместимость: прямой вызов без peds
    expect(sanitizePedDosesForInput({ pedDoses: { GH: 4, insulin: 10 } })).toEqual({ GH: 4, insulin: 10 });

    const naturalPlan = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 4,
      peds: [],
      pedDoses: defaultUiDoses,
      age: 26,
    });
    const natRationale = (naturalPlan.rationale || []).join('\n');
    expect(natRationale).not.toMatch(/Insulin window|GH\+insulin|пересчитаны под фарму/i);
    const natComments = naturalPlan.weeks.flatMap(w => w.sessions.flatMap(s => s.exercises.map(e => e.comment || ''))).join('\n');
    expect(natComments).not.toMatch(/Insulin window/i);

    const minorPlan = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 4,
      peds: ['AAS', 'GH', 'insulin'],
      pedDoses: defaultUiDoses,
      age: 16,
    });
    expect((minorPlan.rationale || []).join('\n')).not.toMatch(/Insulin window|GH\+insulin|пересчитаны под фарму/i);
    expect((minorPlan.inputSnapshot as any)?.peds).toEqual([]);
    expect((minorPlan.inputSnapshot as any)?.pedDoses).toEqual({});
  });

  it('P0-3: сохранённый Contest Prep план и конфиг читаются после showDate (post_show до 120 дней), новый конфиг в прошлом по-прежнему валидатор режет', () => {
    const yesterday = isoAddDays(isoToday(), -1);
    const tenDaysAgo = isoAddDays(isoToday(), -10);
    const tooOld = isoAddDays(isoToday(), -200);

    // Новый конфиг в прошлом — ошибка как раньше
    expect(validateBBContestPrepConfig(makePrepConfig({ showDate: yesterday })).ok).toBe(false);
    // С allowPastShow в окне post_show — валиден, старше 120 дней — отклоняется
    expect(validateBBContestPrepConfig(makePrepConfig({ showDate: yesterday }), { allowPastShow: true }).ok).toBe(true);
    expect(validateBBContestPrepConfig(makePrepConfig({ showDate: tenDaysAgo }), { allowPastShow: true }).ok).toBe(true);
    expect(validateBBContestPrepConfig(makePrepConfig({ showDate: tooOld }), { allowPastShow: true }).ok).toBe(false);

    // Десериализация сохранённого плана после даты шоу не возвращает null
    const built = buildBBContestPrepPlan(makePrepConfig({ showDate: futureIso(21) }));
    const aged = {
      ...built,
      showDate: tenDaysAgo,
      config: { ...(built.config!), showDate: tenDaysAgo },
    };
    const json = serializeBBContestPrepPlan(aged);
    const loaded = deserializeBBContestPrepPlan(json);
    expect(loaded).not.toBeNull();
    expect(loaded?.showDate).toBe(tenDaysAgo);

    const cfgLoaded = deserializeBBPrepConfig(JSON.stringify(aged.config));
    expect(cfgLoaded).not.toBeNull();
    expect(cfgLoaded?.showDate).toBe(tenDaysAgo);
  });

  it('P0-4: back carb-load распределяет ~100% углеводного бюджета (не теряет 55%)', () => {
    const cfg = makePrepConfig({ carbLoadStrategy: 'back', weightKg: 80, category: 'mens_bb' });
    const backDays = buildPeakWeek(cfg);
    const modDays = buildPeakWeek(makePrepConfig({ carbLoadStrategy: 'moderate', weightKg: 80, category: 'mens_bb' }));

    const backLoadPhases = PHASES_BY_STRATEGY.back.filter(p => p.startsWith('load'));
    expect(CARB_DISTRIBUTION.back.length).toBe(backLoadPhases.length);
    expect(CARB_DISTRIBUTION.back.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 5);

    const backTotal = backDays.filter(d => d.phase.startsWith('load')).reduce((a, d) => a + d.carbsG, 0);
    const modTotal = modDays.filter(d => d.phase.startsWith('load')).reduce((a, d) => a + d.carbsG, 0);
    expect(backTotal).toBeGreaterThan(modTotal * 0.92);
    expect(backTotal).toBeLessThan(modTotal * 1.08);
  });

  it('P0-5: Prep-цикл имеет нисходящий тапер (75% → 65% → 55%), корректный ratePct и не завышает дефицит в 100×', () => {
    const cfg: PrepCycleConfig = {
      category: 'mens_bb',
      sex: 'male',
      weeks: 12,
      taperWeeks: 3,
      showDate: futureIso(84),
      level: 'advanced',
      experienceLevel: 'advanced',
      weightKg: 90,
      heightCm: 178,
      bodyFat: 11,
      accentMuscles: ['shoulders'],
      minimalMuscles: [],
      minimalMode: 'mev',
      enhanced: true,
      pedDoses: { AAS: 500, GH: 4 },
    };
    const res = buildPrepCycle(cfg);
    const prog = buildPrepProgression(res.prepPlan, cfg);
    const taperProg = prog.weeks.filter(w => w.phase === 'taper');
    expect(taperProg.length).toBe(3);
    const pcts = taperProg.map(w => Number((w.weightNote.match(/~(\d+)%/) || [])[1]));
    expect(pcts).toEqual([75, 65, 55]);

    const nut = buildPrepNutritionPlan(res.prepPlan, cfg);
    expect(nut.note).not.toMatch(/Дефицит [1-9]\d%/);
    expect(nut.note).toMatch(/Дефицит 0\.\d+%/);
    const prepNote = nut.weeks.find(w => w.phase === 'preparation')?.note || '';
    expect(prepNote).not.toMatch(/дефицит ~[1-9]\d%/);
    expect(prepNote).toMatch(/дефицит ~0\.\d+%/);
  });

  it('P0-7: scoreBBShowPrep использует plan.config.bodyFatPct без ложного штрафа -70', () => {
    const plan = buildBBContestPrepPlan(makePrepConfig({ bodyFatPct: 6, category: 'mens_bb' }));
    const verdict = scoreBBShowPrep({ plan });
    expect(verdict.score).toBeGreaterThan(60);
  });

  it('P0-16 & P0-19: buildBBPlan сохраняет specialization/dcMode/packingV2/bannedPatterns в inputSnapshot и фильтрует bannedPatterns', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 4,
      specialization: true,
      weakPoints: ['chest'],
      packingV2: true,
      bannedPatterns: ['жим', 'press'],
    });
    const snap: any = plan.inputSnapshot;
    expect(snap.specialization).toBe(true);
    expect(snap.packingV2).toBe(true);
    expect(snap.bannedPatterns).toEqual(['жим', 'press']);

    const allNames = plan.weeks.flatMap(w => w.sessions.flatMap(s => s.exercises.map(e => e.name.toLowerCase())));
    expect(allNames.some(n => n.includes('жим') || n.includes('press'))).toBe(false);
  });

  it('P0-18: normalizeBBMuscle канонизирует русские названия мышц из дневника', () => {
    expect(normalizeBBMuscle('Грудь')).toBe('chest');
    expect(normalizeBBMuscle('Спина')).toBe('back');
    expect(normalizeBBMuscle('Трицепс')).toBe('triceps');
    expect(normalizeBBMuscle('Бицепс бедра')).toBe('hamstrings');
    expect(normalizeBBMuscle('Передняя дельта')).toBe('delt_front');
    expect(normalizeBBMuscle('Пресс / Кор')).toBe('abs');
  });
});

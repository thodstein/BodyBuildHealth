/**
 * recommendation-screen-targets.test.ts — проход 104: «цель курса» и «граница» —
 * разными словами, из одного места, и порог в тексте — тот, что реально применён.
 *
 * Было: в таблице `labRules` стояли литералы-цели — АЛТ/АСТ ♂ 30 / ♀ 25, ГГТ ♂ 40 /
 * ♀ 30, креатинин ♂ 106 / ♀ 97, ферритин ♂ 300 / ♀ 150, — и рекомендация печаталась
 * как «АЛТ: 32 > 30», то есть как отклонение, хотя у мужчины ВГН 40 и значение в
 * норме. Ещё три текста печатали не то число, которое применяли: ферритин всегда
 * «> 300» (женщине с ферритином 170 показывалось 300, которого она не превышает),
 * ДГЕА-С всегда «< 100 мкг/дл» при возрастном пороге 200/150/100/50, а билирубин в
 * этой таблице жил на 21, тогда как флаг на обоих экранах — от ВГН 17.1.
 *
 * Стало: цели собраны в `SCREEN_TARGETS` (`lab-norms.engine`), правило помечено
 * `goal: true` и печатает «(цель курса)», билирубин идёт от `BILIRUBIN_FLAG_STEPS.mild`,
 * ферритин различает «выше ВГН» и «выше цели», ДГЕА-С печатает свой возрастной порог.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateRecommendations } from '../recommendation-engine';
import { SCREEN_TARGETS } from '../lab-norms.engine';

const mkState = (sex: 'male' | 'female', labs: Record<string, Record<string, string>>, age = 30) => ({
  profile: { weight: 80, age, sex, workoutsPerWeek: 3, avgWorkoutMinutes: 60, sleepHours: 7, stressLevel: 4, smoker: false, alcohol: 'rare', caffeineMg: 100 },
  neuro: { dopamineScore: 2, serotoninScore: 2, gabaBalance: 'balance', memoryIssues: false, focusIssues: false, slowThinking: false, coordinationIssues: false, aggressionScore: 2, headaches: false, weatherDependent: false, sleepQuality: 'good' },
  // Курс пустой: проверяем именно скрининговые правила, без конкурирующей «печени».
  pharma: { phase: 'off', aas: [] },
  goals: { healthMaintenance: true, competitionPrep: false, sleepRecovery: false, lipidCorrection: false, bloodThinning: false, liverDetox: false, bpControl: false, trainingCycle: 'mass', cycleWeeks: 12, previousCycles: 0, timeSinceLastCycle: 'none' },
  hepatobiliary: { altAstElevation: 'none', ggtElevation: 'none', bilirubinElevation: 'none', fattyLiver: false, cholecystitis: false, alcoholHistory: 'none' },
  urinary: { creatinineElevation: 'none', ureaElevation: 'none', proteinuria: false, nephrotoxicDrugs: false, hypertension: false, diabetes: false, urinationPattern: 'normal' },
  cardio: { bpStage: 'normal', heartRate: 72, ldlElevation: 'none', hdlLow: false, triglycerides: 'normal', hctElevation: 'none', previousCVD: false, familyCVD: false },
  oda: { jointPain: 'none', ligamentIssues: false, backPain: false, injuries: [] },
  labs: { preCourse: null, midCourse: null, postPCT: null, fullPanel: { panelBiochem: {}, panelSex: {}, panelLipid: {}, panelIron: {}, panelAdrenal: {}, panelThyroid: {}, panelVitamin: {}, ...labs } },
  nutrition: { calories: 2500, proteinG: 160, fatG: 80, carbsG: 300, waterL: 2, saltIntake: 'normal', omega3: false, fiberG: 25, proteinGPerKg: 1.8, sodiumMg: 3500, potassiumMg: 4500 },
  contraindications: { allergies: '', hasCVD: false, hasThrombophilia: false, hasGI: false, hasProstateIssues: false, hasDiabetes: false, hasEpilepsy: false, hasMentalIllness: false, hasLiverDisease: false, hasKidneyDisease: false },
  journal: { positive: [], negative: [] },
  epicrisis: { pastGyno: false, pastLibidoDrop: false, pastHctSpike: false, pastLiverIssues: false, pastKidneyIssues: false },
  toxicLoad: { hazardousWork: false, regularNSAIDs: false, otherHeavyDrugs: false, bowelFrequency: 'regular' },
  dental: { bleedingGums: false, looseTeeth: false, nightGrinding: false, boneFractures: false, cramps: false },
  genetics: { cyp19a1: 'unknown', srd5a2: 'unknown', arSensitivity: 'unknown', mthfr: 'unknown' },
  gi: { bloating: false, heartburn: false, diarrhea: false, constipation: false, diagnosedIBS: false, enzymeSupport: false, probioticUse: false },
  psych: { fearOfLoss: 1, mirrorObsession: 1, apathyOffCycle: 1 },
  injection: { glutes: '', quads: '', delts: '', localAreas: '' },
  powerLevel: 'mid',
  courseWeek: 6,
});

const byId = (sex: 'male' | 'female', labs: Record<string, Record<string, string>>, id: string, age = 30) =>
  evaluateRecommendations(mkState(sex, labs, age) as any, {} as any).find((r) => r.id === id);

describe('проход 104: цели скрининга объявлены и не сдвинуты', () => {
  it('SCREEN_TARGETS — документированные числа', () => {
    expect(SCREEN_TARGETS.ALT).toEqual({ male: 30, female: 25 });
    expect(SCREEN_TARGETS.AST).toEqual({ male: 30, female: 25 });
    expect(SCREEN_TARGETS.GGT).toEqual({ male: 40, female: 30 });
    expect(SCREEN_TARGETS.CREATININE).toEqual({ male: 106, female: 97 });
    expect(SCREEN_TARGETS.FERRITIN).toEqual({ male: 300, female: 150 });
  });
});

describe('проход 104: рекомендация по цели говорит «цель курса»', () => {
  it('АСТ 32 у мужчины — выше цели 30 при ВГН 40, и это видно в тексте', () => {
    // Берём АСТ, а не АЛТ: у АЛТ сначала срабатывает блок «Гепатотоксичность» и
    // забирает те же гепатопротекторы, поэтому правило `lab_ALT` до выдачи не доходит.
    const rec = byId('male', { panelBiochem: { AST: '32' } }, 'lab_AST');
    expect(rec).toBeDefined();
    expect(rec!.title).toContain('> 30');
    expect(rec!.title).toContain('цель курса');
  });

  it('АСТ 25 у мужчины — молчание; у женщины 27 — выше её цели 25', () => {
    expect(byId('male', { panelBiochem: { AST: '25' } }, 'lab_AST')).toBeUndefined();
    expect(byId('female', { panelBiochem: { AST: '27' } }, 'lab_AST')).toBeDefined();
    expect(byId('female', { panelBiochem: { AST: '24' } }, 'lab_AST')).toBeUndefined();
  });

  it('ГГТ 45 у мужчины — цель 40; 35 — молчание', () => {
    expect(byId('male', { panelBiochem: { GGT: '45' } }, 'lab_GGT')!.title).toContain('> 40');
    expect(byId('male', { panelBiochem: { GGT: '45' } }, 'lab_GGT')!.title).toContain('цель курса');
    expect(byId('male', { panelBiochem: { GGT: '35' } }, 'lab_GGT')).toBeUndefined();
  });

  it('креатинин 108 у мужчины — цель 106; 100 — молчание', () => {
    expect(byId('male', { panelBiochem: { Creatinine: '108' } }, 'lab_Creatinine')).toBeDefined();
    expect(byId('male', { panelBiochem: { Creatinine: '100' } }, 'lab_Creatinine')).toBeUndefined();
  });

  it('билирубин — граница ВГН, а не цель: 18 даёт совет без слова «цель»', () => {
    const rec = byId('male', { panelBiochem: { Bilirubin: '18' } }, 'lab_Bilirubin');
    expect(rec).toBeDefined();
    expect(rec!.title).toContain('17.1');
    expect(rec!.title).not.toContain('цель курса');
  });
});

describe('проход 104: в тексте — то число, которое применено', () => {
  it('ферритин 170 у женщины: «выше цели 150», без «> 300» и без «избытка»', () => {
    const rec = byId('female', { panelIron: { Ferritin: '170' } }, 'lab_ferritin');
    expect(rec).toBeDefined();
    expect(rec!.title).toContain('150');
    expect(rec!.title).toContain('цель курса');
    expect(rec!.title).not.toContain('300');
    expect(rec!.title).not.toContain('избыток');
  });

  it('ферритин 320 у мужчины: «выше ВГН 300» — избыток железа', () => {
    const rec = byId('male', { panelIron: { Ferritin: '320' } }, 'lab_ferritin');
    expect(rec!.title).toContain('300');
    expect(rec!.title).toContain('ВГН');
    expect(rec!.title).toContain('избыток');
  });

  it('ДГЕА-С 180 у мужчины 25 лет: печатается его порог 200, а не «< 100»', () => {
    const rec = byId('male', { panelAdrenal: { 'DHEA-S': '180' } }, 'lab_dheas', 25);
    expect(rec).toBeDefined();
    expect(rec!.title).toContain('< 200');
    expect(rec!.title).toContain('цель для 25 лет');
    expect(rec!.title).not.toContain('< 100');
  });
});

describe('проход 104: источник порогов в движке', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/engines/recommendation-engine.ts'), 'utf8');

  it('таблица читает SCREEN_TARGETS и ВГН билирубина', () => {
    expect(src).toContain('value: SCREEN_TARGETS.ALT[sexT]');
    expect(src).toContain('value: SCREEN_TARGETS.AST[sexT]');
    expect(src).toContain('value: SCREEN_TARGETS.GGT[sexT]');
    expect(src).toContain('value: SCREEN_TARGETS.CREATININE[sexT]');
    expect(src).toContain('value: SCREEN_TARGETS.FERRITIN[sexT]');
    expect(src).toContain('value: BILIRUBIN_FLAG_STEPS.mild');
    expect(src).toContain("rule.goal ? ' (цель курса)' : ''");
  });

  it('литералов половых целей больше нет', () => {
    expect(src).not.toContain("sex === 'male' ? 30 : 25");
    expect(src).not.toContain("sex === 'female' ? 150 : 300");
    expect(src).not.toContain('value:21');
    expect(src).not.toContain('Ферритин: ${ferVal} > 300');
    expect(src).not.toContain('DHEA-S: ${dheaVal} < 100 мкг/дл');
  });
});

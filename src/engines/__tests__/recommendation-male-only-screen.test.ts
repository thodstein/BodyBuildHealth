/**
 * recommendation-male-only-screen.test.ts — проход 99: мужские гормональные
 * пороги женщине не применяются.
 *
 * Было: три пути в `recommendation-engine` были написаны мужчине и не спрашивали пол:
 *  — блок ароматизации: триггер E2 > 40 pg/mL и «+Анастрозол» при E2 > 55. Женщина
 *    на курсе с нормальной лютеиновой E2 70 получала рекомендацию снижать эстроген
 *    и ингибитор ароматазы (её коридор — 40–200 / 70–500 по фазе);
 *  — блок пролактина: триггер 25, каберголин при 40 в мужской шкале нг/мл; у женщины
 *    норма до 800 мМЕ/л;
 *  — таблица `labRules`: E2 40, пролактин 25, ДГЕА-С по мужским возрастным границам
 *    (женский путь ДГЕА-С в движке и так был `sex === 'male'`).
 *
 * Стало: пороги берутся из `FEMALE_HORMONE_ULN` (E2 400/800 pg/mL, PRL 800/1500 мМЕ/л
 * → 38/71 нг/мл через `PRL_NG_TO_MIU`), ИА и каберголин женщине без врача не
 * выдаются, а `MALE_ONLY_SCREEN` убирает из скрининговой таблицы E2/пролактин/ДГЕА-С.
 * Мужской путь и общие маркеры не изменились.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateRecommendations, isMaleOnlyScreenMarker } from '../recommendation-engine';

const mkState = (sex: 'male' | 'female', labs: Record<string, Record<string, string>>) => ({
  profile: { weight: 80, age: 30, sex, workoutsPerWeek: 3, avgWorkoutMinutes: 60, sleepHours: 7, stressLevel: 4, smoker: false, alcohol: 'rare', caffeineMg: 100 },
  neuro: { dopamineScore: 2, serotoninScore: 2, gabaBalance: 'balance', memoryIssues: false, focusIssues: false, slowThinking: false, coordinationIssues: false, aggressionScore: 2, headaches: false, weatherDependent: false, sleepQuality: 'good' },
  pharma: { phase: 'course', aas: [{ id: 'test_enan', doseMgWeek: 500, weeks: 12 }] },
  goals: { healthMaintenance: true, competitionPrep: false, sleepRecovery: false, lipidCorrection: false, bloodThinning: false, liverDetox: false, bpControl: false, trainingCycle: 'mass', cycleWeeks: 12, previousCycles: 0, timeSinceLastCycle: 'none' },
  hepatobiliary: { altAstElevation: 'none', ggtElevation: 'none', bilirubinElevation: 'none', fattyLiver: false, cholecystitis: false, alcoholHistory: 'none' },
  urinary: { creatinineElevation: 'none', ureaElevation: 'none', proteinuria: false, nephrotoxicDrugs: false, hypertension: false, diabetes: false, urinationPattern: 'normal' },
  cardio: { bpStage: 'normal', heartRate: 72, ldlElevation: 'none', hdlLow: false, triglycerides: 'normal', hctElevation: 'none', previousCVD: false, familyCVD: false },
  oda: { jointPain: 'none', ligamentIssues: false, backPain: false, injuries: [] },
  labs: { preCourse: null, midCourse: null, postPCT: null, fullPanel: { panelBiochem: {}, panelSex: {}, panelLipid: {}, panelIron: {}, panelAdrenal: {}, panelThyroid: {}, ...labs } },
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

const run = (sex: 'male' | 'female', labs: Record<string, Record<string, string>>) =>
  evaluateRecommendations(mkState(sex, labs) as any, {} as any);

const byId = (sex: 'male' | 'female', labs: Record<string, Record<string, string>>, id: string) =>
  run(sex, labs).find((r) => r.id === id);

describe('проход 99: гормональные триггеры — по полу', () => {
  it('E2 70 у женщины: ароматизации нет; у мужчины — есть', () => {
    expect(byId('female', { panelSex: { E2: '70' } }, 'estradiol')).toBeUndefined();
    expect(byId('male', { panelSex: { E2: '70' } }, 'estradiol')).toBeDefined();
  });

  it('женская E2 выше её коридора: без анастрозола, с шагом «пересдать по фазе + УЗИ»', () => {
    // 1600 мМЕ-шкалы интерпретируется как pmol/L → 436 pg/mL, выше женских 400.
    const rec = byId('female', { panelSex: { E2: '1600' } }, 'estradiol');
    expect(rec).toBeDefined();
    const subs = rec!.substances.map((s) => s.id);
    expect(subs).not.toContain('anastrozole');
    expect(subs).not.toContain('letrozole');
    expect(rec!.severity).toBe('high');
    expect(rec!.escalation).toContain('УЗИ яичников');
    expect(rec!.escalation).toContain('AI без гинеколога не назначать');
  });

  it('мужская высокая E2 остаётся «критичной» и с анастрозолом', () => {
    const rec = byId('male', { panelSex: { E2: '500' } }, 'estradiol');
    expect(rec!.severity).toBe('critical');
    expect(rec!.substances.map((s) => s.id)).toContain('anastrozole');
    expect(rec!.escalation).toContain('Анастрозол');
  });

  it('пролактин 300 мМЕ/л (женская норма) молчит; мужские 30 нг/мл дают каберголин', () => {
    expect(byId('female', { panelSex: { Prolactin: '300' } }, 'prolactin')).toBeUndefined();
    const male = byId('male', { panelSex: { Prolactin: '30' } }, 'prolactin');
    expect(male!.substances.map((s) => s.id)).toContain('cabergoline');
  });

  it('женский пролактин: 900 мМЕ/л — шаги без каберголина, 1600 — с каберголином и «критично»', () => {
    const moderate = byId('female', { panelSex: { Prolactin: '900' } }, 'prolactin');
    expect(moderate).toBeDefined();
    expect(moderate!.substances.map((s) => s.id)).not.toContain('cabergoline');
    expect(moderate!.severity).toBe('high');
    expect(moderate!.escalation).toContain('макропролактином');

    const severe = byId('female', { panelSex: { Prolactin: '1600' } }, 'prolactin');
    expect(severe!.severity).toBe('critical');
    expect(severe!.substances.map((s) => s.id)).toContain('cabergoline');
  });

  it('ДГЕА-С 100: у женщины совета нет, у мужчины — «низко» по его границам', () => {
    expect(byId('female', { panelAdrenal: { 'DHEA-S': '100' } }, 'lab_dheas')).toBeUndefined();
    expect(byId('male', { panelAdrenal: { 'DHEA-S': '100' } }, 'lab_dheas')).toBeDefined();
  });

  it('общие маркеры не тронуты: ТТГ 6 и кортизол 700 дают совет обоим полам', () => {
    expect(byId('female', { panelThyroid: { TSH: '6' } }, 'lab_TSH')).toBeDefined();
    expect(byId('male', { panelThyroid: { TSH: '6' } }, 'lab_TSH')).toBeDefined();
    expect(byId('female', { panelSex: { Cortisol: '700' } }, 'lab_Cortisol')).toBeDefined();
    expect(byId('male', { panelSex: { Cortisol: '700' } }, 'lab_Cortisol')).toBeDefined();
  });

  it('список закрыт и живёт в движке, а не в UI', () => {
    expect(isMaleOnlyScreenMarker('E2')).toBe(true);
    expect(isMaleOnlyScreenMarker('Prolactin')).toBe(true);
    expect(isMaleOnlyScreenMarker('DHEA-S')).toBe(true);
    expect(isMaleOnlyScreenMarker('ALT')).toBe(false);
    expect(isMaleOnlyScreenMarker('TSH')).toBe(false);

    const src = readFileSync(resolve(process.cwd(), 'src/engines/recommendation-engine.ts'), 'utf8');
    expect(src).toContain("const MALE_ONLY_SCREEN = new Set(['E2', 'Prolactin', 'DHEA-S']);");
    expect(src).toContain("if (sex === 'female' && isMaleOnlyScreenMarker(rule.marker)) continue;");
    // Пороги — из резолвера: литералов E2 «40/55» в гормональных блоках нет.
    expect(src).toContain("const e2Trigger = sex === 'female' ? FEMALE_HORMONE_ULN.E2.high : E2_MALE_BAND.steps[0];");
    expect(src).toContain("const e2SevereAt = sex === 'female' ? FEMALE_HORMONE_ULN.E2.criticalHigh : E2_MALE_BAND.steps[1];");
    expect(src).toContain('const prlTriggerNg = sex === \'female\' ? FEMALE_HORMONE_ULN.PRL.high / PRL_NG_TO_MIU : 25;');
    expect(src).toContain("if (sex !== 'female' && e2Val !== null && e2Val > E2_MALE_BAND.steps[0])");
  });
});

/**
 * lab-unit-read.test.ts — проход 106: единица бланка вместо догадки.
 *
 * Было: `normalizeLabValue` угадывал единицу по величине — «E2 > 300 значит пмоль/л».
 * Для мужчины это ещё работает, для женщины нет: её 500 пг/мл (реально высокая
 * эстрадиоляция) делились на 3.671 и превращались в 136 пг/мл, то есть в норму, —
 * и повод для анастрозола/УЗИ исчезал. Обратный случай так же слеп: 800 пмоль/л
 * (218 пг/мл) без единицы читались как 800 пг/мл.
 *
 * Стало: единица — часть данных бланка (`LabSlice.units`, выбор в поле ввода), и
 * чтение идёт по ней (`readLabValue`). Нет единицы — прежняя эвристика, но с
 * пометкой `guessed` (интерфейс говорит «единица не указана, прочитано по величине»).
 * Единственное исключение — эстрадиол у женщины: без единицы он больше не делится,
 * потому что деление и было ложноотрицательным. Мужской путь и путь без пола
 * (в т. ч. `normalizeLabValue`) не изменены.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readLabValue, normalizeLabValue, LAB_UNIT_CHOICES, LAB_UNIT_READ, LAB_READ_UNIT } from '../../core/constants';
import { normalizeLabMeasurement } from '../../core/labs-mapping';
import { evaluateRecommendations } from '../../engines/recommendation-engine';
import { buildLabFindings } from '../support-plan/display';
import { normalizeCalculatorState } from '../../ui/screens/Calculator/Calc.types';

describe('проход 106: readLabValue — единица есть, догадки нет', () => {
  it('E2: пг/мл как есть, пмоль/л делим на 3.671', () => {
    expect(readLabValue('E2', 500, 'пг/мл')).toEqual({ value: 500, guessed: false });
    expect(readLabValue('E2', 500, 'пмоль/л')).toEqual({ value: 136.2, guessed: false });
  });

  it('E2 без единицы: мужчине/без пола — прежняя догадка, женщине — не делим', () => {
    // Мужской путь не изменился: 500 без единицы по-прежнему читается как пмоль/л.
    expect(readLabValue('E2', 500)).toEqual({ value: 136.2, guessed: true });
    expect(readLabValue('E2', 500, undefined, 'male')).toEqual({ value: 136.2, guessed: true });
    // А у женщины 500 пг/мл — реальное значение, деление его прятало.
    expect(readLabValue('E2', 500, undefined, 'female')).toEqual({ value: 500, guessed: true });
  });

  it('пролактин: нг/мл как есть, мМЕ/л делим на 21.2', () => {
    expect(readLabValue('Prolactin', 120, 'нг/мл')).toEqual({ value: 120, guessed: false });
    expect(readLabValue('Prolactin', 318, 'мМЕ/л')).toEqual({ value: 15, guessed: false });
  });

  it('тестостерон: нмоль/л как есть, нг/дл делим на 28.84', () => {
    expect(readLabValue('Total T', 20, 'нмоль/л')).toEqual({ value: 20, guessed: false });
    expect(readLabValue('Total T', 600, 'нг/дл')).toEqual({ value: 20.8, guessed: false });
  });

  it('кортизол: нмоль/л как есть, мкг/дл умножаем на 27.59', () => {
    expect(readLabValue('Cortisol', 400, 'нмоль/л')).toEqual({ value: 400, guessed: false });
    expect(readLabValue('Cortisol', 15, 'мкг/дл')).toEqual({ value: 413.9, guessed: false });
  });

  it('ДГЭА-С: мкг/дл как есть, мкмоль/л умножаем на 36.9', () => {
    expect(readLabValue('DHEA-S', 200, 'мкг/дл')).toEqual({ value: 200, guessed: false });
    expect(readLabValue('DHEA-S', 5, 'мкмоль/л')).toEqual({ value: 184.5, guessed: false });
  });

  it('написание единицы распознаётся: pg/mL, pmol/L, mIU/L, µmol/L, нг/дл', () => {
    expect(readLabValue('E2', 500, 'pg/mL')).toEqual({ value: 500, guessed: false });
    expect(readLabValue('E2', 500, 'pmol/L')).toEqual({ value: 136.2, guessed: false });
    expect(readLabValue('Prolactin', 318, 'mIU/L')).toEqual({ value: 15, guessed: false });
    expect(readLabValue('DHEA-S', 5, 'µmol/L')).toEqual({ value: 184.5, guessed: false });
    expect(readLabValue('Total T', 600, 'ng/dL')).toEqual({ value: 20.8, guessed: false });
  });

  it('незнакомая единица не толкуется как известная — читаем по величине с пометкой', () => {
    expect(readLabValue('E2', 500, 'мг/дл')).toEqual({ value: 136.2, guessed: true });
  });

  it('маркеры без проблемной единицы не трогаются', () => {
    expect(readLabValue('ALT', 45)).toEqual({ value: 45, guessed: false });
    expect(readLabValue('HCT', 52, '')).toEqual({ value: 52, guessed: false });
  });
});

describe('проход 106: выбор единицы на месте, эвристика не тронута', () => {
  it('в бланке есть выбор единицы для гормональных маркеров с двумя единицами', () => {
    // проход 118: прогестерон; 119: свободный тестостерон; 120: свободные Т3/Т4;
    // 121–123: витамин D, фолат, B12 — везде единицы расходятся, догадка не работает
    expect(Object.keys(LAB_UNIT_CHOICES)).toEqual(['E2', 'Prolactin', 'Total T', 'Cortisol', 'DHEA-S', 'Progesterone', 'Free T', 'T3 free', 'T4 free', 'Vitamin D (25-OH)', 'Folate', 'B12']);
    for (const opts of Object.values(LAB_UNIT_CHOICES)) expect(opts.length).toBe(2);
  });

  it('`normalizeLabValue` остался прежним — мужской путь байт-в-байт', () => {
    expect(normalizeLabValue('E2', 500)).toBe(136.2);
    expect(normalizeLabValue('Prolactin', 300)).toBe(14.2);
    expect(normalizeLabValue('E2', 300)).toBe(300);
  });

  it('источник: чтение гормонов идёт через readLabValue, а не через normalizeLabValue', () => {
    const rec = readFileSync(resolve(process.cwd(), 'src/engines/recommendation-engine.ts'), 'utf8');
    const helpers = readFileSync(resolve(process.cwd(), 'src/engines/support-plan/engine-helpers.ts'), 'utf8');
    expect(rec).toContain('readLabValue(key, raw, unit, sex)');
    expect(rec).not.toContain('normalizeLabValue');
    expect(helpers).toContain('readLabValue(marker, raw, unitOf(panel, marker), sex)');
    expect(helpers).not.toContain("normalizeLabValue('E2'");
  });
});

// ── Живой движок: женский E2 без единицы больше не прячется ──
const mkState = (sex: 'male' | 'female', labs: Record<string, any>) => ({
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

const e2Rec = (sex: 'male' | 'female', labs: Record<string, any>) =>
  evaluateRecommendations(mkState(sex, labs) as any, {} as any).find(r => r.id === 'estradiol');

describe('проход 106: женский E2 — вердикт по единице бланка', () => {
  it('500 пг/мл без единицы: совет есть (было: 136 пг/мл и тишина), в тексте — оба числа', () => {
    const rec = e2Rec('female', { panelSex: { E2: '500' } });
    expect(rec).toBeDefined();
    expect(rec!.escalation).toContain('Единица E2 не указана');
    expect(rec!.escalation).toContain('136.2');
  });

  it('1600 без единицы: не громче «высоко» — это и 1600 пг/мл, и 436 пг/мл', () => {
    const rec = e2Rec('female', { panelSex: { E2: '1600' } });
    expect(rec).toBeDefined();
    expect(rec!.severity).toBe('high');
  });

  it('1600 пг/мл с явной единицей — уже «критично»: там догадки нет', () => {
    const rec = e2Rec('female', { panelSex: { E2: '1600' }, units: { panelSex: { E2: 'пг/мл' } } });
    expect(rec!.severity).toBe('critical');
    expect(rec!.escalation).not.toContain('Единица E2 не указана');
  });

  it('та же цифра, но пмоль/л — 136 пг/мл, совета нет', () => {
    expect(e2Rec('female', { panelSex: { E2: '500' }, units: { panelSex: { E2: 'пмоль/л' } } })).toBeUndefined();
  });

  it('500 пг/мл с явной единицей — тот же совет, что без единицы', () => {
    const noUnit = e2Rec('female', { panelSex: { E2: '500' } });
    const withUnit = e2Rec('female', { panelSex: { E2: '500' }, units: { panelSex: { E2: 'пг/мл' } } });
    expect(withUnit!.severity).toBe(noUnit!.severity);
    expect(withUnit!.substances.map(s => s.id)).not.toContain('anastrozole');
  });

  it('мужчина без изменений: 500 без единицы — по-прежнему критично и с анастрозолом', () => {
    const rec = e2Rec('male', { panelSex: { E2: '500' } });
    expect(rec!.severity).toBe('critical');
    expect(rec!.substances.map(s => s.id)).toContain('anastrozole');
  });
});

describe('проход 106: единица переживает сохранение', () => {
  it('normalizeCalculatorState переносит units вместе с бланком', () => {
    const st = normalizeCalculatorState({
      labs: { fullPanel: { date: '2026-11-01', panelSex: { E2: '500' }, units: { panelSex: { E2: 'пг/мл' } } } },
    });
    expect(st.labs.fullPanel!.panelSex?.E2).toBe('500');
    expect(st.labs.fullPanel!.units?.panelSex?.E2).toBe('пг/мл');
  });

  it('без единицы поле не выдумывается', () => {
    const st = normalizeCalculatorState({ labs: { fullPanel: { panelSex: { E2: '500' } } } });
    expect(st.labs.fullPanel!.units).toBeUndefined();
  });
});

/**
 * Проход 107: один анализ — один совет. В таблице `labRules` стояли правила для
 * маркеров, у которых уже есть свой блок с тем же порогом и теми же веществами:
 * АЛТ (гепатоблок), ферритин, гомоцистеин, СРБ, витамин D, B12, E2, пролактин,
 * ДГЕА-С. Такие правила либо молча умирали (`addRec` отбрасывает рекомендацию, все
 * вещества которой уже выданы), либо грозили вторым советом по одному анализу.
 * Теперь в таблице только маркеры без блока; эти проверки держат инвариант живым
 * прогоном движка, а не чтением исходника.
 */
describe('проход 107: один анализ — один совет', () => {
  const recIds = (labs: Record<string, any>) =>
    evaluateRecommendations(mkState('male', labs) as any, {} as any).map(r => r.id);

  /** id, которые убраны из таблицы — они не должны появляться ни при каких числах. */
  const REMOVED = /^lab_(ALT|Ferritin|Homocysteine|CRP|Vitamin D \(25-OH\)|B12|E2|Prolactin|DHEA-S)/;

  const CASES: Array<[string, Record<string, any>, string]> = [
    ['АЛТ 80 → гепатоблок', { panelBiochem: { ALT: '80' } }, 'hepatic'],
    ['ферритин 400 → блок железа', { panelIron: { Ferritin: '400' }, panelBiochem: { ALT: '20' } }, 'lab_ferritin'],
    ['гомоцистеин 20 → метилирование', { panelBiochem: { Homocysteine: '20' } }, 'lab_hcy'],
    ['СРБ 8 → воспаление', { panelBiochem: { CRP: '8' } }, 'lab_crp'],
    ['витамин D 20 → дефицит', { panelVitamin: { 'Vitamin D (25-OH)': '20' } }, 'lab_vitd'],
    ['B12 150 → дефицит', { panelVitamin: { B12: '150' } }, 'lab_b12'],
    ['E2 120 (мужчина) → ароматизация', { panelSex: { E2: '120' } }, 'estradiol'],
    ['пролактин 50 (мужчина) → пролактин', { panelSex: { Prolactin: '50' } }, 'prolactin'],
    ['ДГЕА-С 60 → надпочечники', { panelAdrenal: { 'DHEA-S': '60' } }, 'lab_dheas'],
    ['АСТ 60 → таблица', { panelBiochem: { AST: '60' } }, 'lab_AST'],
    ['ГГТ 80 → таблица', { panelBiochem: { GGT: '80' } }, 'lab_GGT'],
    ['билирубин 30 → таблица', { panelBiochem: { Bilirubin: '30' } }, 'lab_Bilirubin'],
    ['креатинин 120 → таблица', { panelBiochem: { Creatinine: '120' } }, 'lab_Creatinine'],
    ['мочевина 10 → таблица', { panelBiochem: { Urea: '10' } }, 'lab_Urea'],
    ['ТГ 2.5 → таблица', { panelLipid: { Triglycerides: '2.5' } }, 'lab_Triglycerides'],
    ['ЛПВП 0.8 → таблица', { panelLipid: { HDL: '0.8' } }, 'lab_HDL'],
    ['кортизол 700 → таблица', { panelSex: { Cortisol: '700' } }, 'lab_Cortisol'],
    ['фибриноген 6 → таблица', { panelCoagulation: { Fibrinogen: '6' } }, 'lab_Fibrinogen'],
    ['ТТГ 7 → таблица', { panelThyroid: { TSH: '7' } }, 'lab_TSH'],
    ['ПСА 5 → таблица', { panelTumor: { 'PSA total': '5' } }, 'lab_PSA total'],
  ];

  it('каждый маркер даёт свой совет, а убранных дублей нет', () => {
    for (const [name, labs, expectedId] of CASES) {
      const ids = recIds(labs);
      expect(ids, `${name}: нет ${expectedId} в ${ids.join(',')}`).toContain(expectedId);
      expect(ids.filter(id => REMOVED.test(id)), `${name}: дубль правила таблицы`).toHaveLength(0);
    }
  });

  it('в таблице `labRules` больше нет маркеров со своим блоком', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/recommendation-engine.ts'), 'utf8');
    for (const marker of ['ALT', 'Ferritin', 'Homocysteine', 'CRP', 'Vitamin D (25-OH)', 'B12', 'E2', 'Prolactin', 'DHEA-S']) {
      expect(src, `в labRules вернулся ${marker}`).not.toContain(`{ marker:'${marker}'`);
    }
  });
});

/**
 * Проход 108: находка не исчезает из-за того, что её вещества уже в плане. Раньше
 * `addRec` при «все вещества уже выданы» молчал, а `buildLabFindings` выбрасывал
 * записи без веществ — и повышенная глюкоза 7.0 или D-димер 1.5 не появлялись нигде:
 * «нет записи» читалось как «всё в норме».
 */
describe('проход 108: находка без новых веществ остаётся видимой', () => {
  const findings = (labs: Record<string, any>) =>
    buildLabFindings(mkState('male', labs) as any, {} as any);

  it('глюкоза 7: находка есть, веществ нет — и это сказано словами', () => {
    const f = findings({ panelBiochem: { Glucose: '7' } }).find(x => x.title.includes('Glucose'));
    expect(f, 'находки по глюкозе нет').toBeDefined();
    expect(f!.substances).toHaveLength(0);
    expect(f!.escalation).toContain('Поддержка по этому маркеру уже выдана другими блоками');
  });

  it('D-димер 1.5: находка есть (свёртываемость — не тишина)', () => {
    const f = findings({ panelCoagulation: { 'D-dimer': '1.5' } }).find(x => x.title.includes('D-dimer'));
    expect(f, 'находки по D-димеру нет').toBeDefined();
  });

  it('АСТ 60: находка с веществами — пустой она не становится', () => {
    const f = findings({ panelBiochem: { AST: '60' } }).find(x => x.title.includes('AST'));
    expect(f).toBeDefined();
    expect(f!.substances.length).toBeGreaterThan(0);
  });
});

/**
 * Проход 109: тот же режим у блоков, а не только у таблицы. Блоки «Гепатотоксичность»,
 * гематокрит, эстрадиол, пролактин, витамин D, B12, ферритин, ДГЕА-С, гомоцистеин и СРБ
 * тоже молчали, если их вещества уже забрали другие блоки. Порядок находок — по тяжести
 * (срез до двадцати снят в 113-м проходе).
 */
describe('проход 109: находка из блока и порядок тяжести', () => {
  const SEV_W: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const findings = (labs: Record<string, any>) =>
    buildLabFindings(mkState('male', labs) as any, {} as any);

  it('блоки анализов включают режим «находка без новых веществ»', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/recommendation-engine.ts'), 'utf8');
    for (const marker of ['HCT', 'ALT', 'E2', 'PRL', 'VITD', 'B12', 'FERRITIN', 'DHEA_S', 'HOMOCYSTEINE', 'CRP']) {
      expect(src, `${marker}: блок снова молчит при занятых веществах`).toContain(`'${marker}', { allowEmpty: true });`);
    }
  });

  it('тяжёлые находки идут первыми', () => {
    const list = findings({
      panelBiochem: { ALT: '200' },
      panelHematology: { HCT: '58' },
      panelIron: { Ferritin: '500' },
      panelVitamin: { 'Vitamin D (25-OH)': '12' },
    });
    expect(list.length).toBeGreaterThan(3);
    const w = list.map(f => SEV_W[f.severity] ?? 5);
    expect([...w].sort((a, b) => a - b)).toEqual(w);
  });
});

/**
 * Проход 113: находки не режутся молча. Раньше `buildLabFindings` обрезал список
 * до двадцати, а «всего N» в интерфейсе показывало уже обрезанное число: часть
 * отклонений исчезала, и какие именно — решал порядок блоков в движке, а не
 * тяжесть. Теперь список отдаётся целиком (сгруппировать по органам — дело UI).
 */
describe('проход 113: находки не режутся', () => {
  const findings = (labs: Record<string, any>) =>
    buildLabFindings(mkState('male', labs) as any, {} as any);

  it('при большом бланке находок больше двадцати — никто не срезан', () => {
    const list = findings({
      panelBiochem: { ALT: '300', AST: '280', GGT: '400', Bilirubin: '80', Glucose: '7.5', Creatinine: '160', Urea: '14', 'Uric acid': '700', CRP: '25', Homocysteine: '35' },
      panelHematology: { HCT: '58', Hemoglobin: '200', RBC: '6.6', WBC: '12', Platelets: '450' },
      panelSex: { 'Total T': '60', 'Free T': '60', E2: '120', Prolactin: '40', SHBG: '90', DHT: '3000', Progesterone: '4', Cortisol: '900', LH: '0.1', FSH: '0.1' },
      panelThyroid: { TSH: '9', 'T3 free': '9', 'T4 free': '30', 'Anti-TPO': '700' },
      panelLipid: { LDL: '6', HDL: '0.5', Triglycerides: '5', 'Total Cholesterol': '9', ApoB: '2' },
      panelIron: { Ferritin: '1200', Iron: '40', TIBC: '700', 'Transferrin Sat': '70' },
      panelVitamin: { 'Vitamin D (25-OH)': '6', B12: '120', Folate: '1.5' },
      panelCoagulation: { 'D-dimer': '3', Fibrinogen: '7' },
      panelInflammatory: { hsCRP: '20', 'IL-6': '20', 'TNF-alpha': '40' },
      panelAdrenal: { 'DHEA-S': '900', Aldosterone: '700', PTH: '900' },
      panelMineral: { Calcium: '3.2', Potassium: '6', Sodium: '150', Magnesium: '0.5', Phosphorus: '2' },
      panelTumor: { 'PSA total': '9' },
      panelCardiac: { CK: '2000', 'CK-MB': '60', 'NT-proBNP': '900' },
      panelUrinalysis: { Protein: '0.5' },
    });
    expect(list.length, 'список снова обрезан').toBeGreaterThan(20);
    expect(list[0].severity).toBe('critical');
  });

  it('в display.ts нет молчаливых срезов находок, конфликтов и мониторинга', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/support-plan/display.ts'), 'utf8');
    expect(src).not.toContain('.slice(0, 20)');
    expect(src).not.toContain('out.slice(0, 15)');
    // остаток синергий и конфликтов называется словами, а не прячется
    expect(src).toContain('…и ещё');
  });
});

/**
 * Проход 115: исключение в движке не выглядит как «отклонений нет». Раньше
 * `buildLabFindings` глушил любую ошибку (`catch {}`), возвращал пустой список,
 * и секция находок просто не показывалась — ошибка читалась как чистая картина.
 */
describe('проход 115: ошибка разбора анализов видна', () => {
  it('исключение движка даёт находку, а не пустой список', () => {
    const list = buildLabFindings(
      mkState('male', {}) as any,
      {} as any,
      () => { throw new Error('boom'); },
    );
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('__lab_analysis_failed');
    expect(list[0].severity).toBe('low');
    expect(list[0].escalation).toContain('не значит');
    expect(list[0].escalation).toContain('boom');
  });

  it('без ошибки лишней находки нет', () => {
    const list = buildLabFindings(mkState('male', { ALT: '45' }) as any, {} as any);
    expect(list.every(f => f.id !== '__lab_analysis_failed')).toBe(true);
  });
});

/**
 * Проход 118: прогестерон приходит в двух единицах — нг/мл и нмоль/л (разница
 * 3.18). Пока единицы не было, 60 нмоль/л лютеиновой фазы ложились в движок
 * как 60 нг/мл: нормальная лютеиновая фаза читалась как беременность, а
 * «ановуляция» ставилась по числу, которого в бланке не было.
 */
describe('проход 118: прогестерон читается по единице бланка', () => {
  it('нмоль/л приводится к нг/мл, догадки нет', () => {
    const r = readLabValue('Progesterone', 60, 'нмоль/л');
    expect(r.guessed).toBe(false);
    expect(r.value).toBe(18.9);
  });

  it('нг/мл остаётся как есть', () => {
    const r = readLabValue('Progesterone', 18.9, 'нг/мл');
    expect(r.guessed).toBe(false);
    expect(r.value).toBe(18.9);
  });

  it('без единицы число не пересчитывается и помечается догадкой', () => {
    const r = readLabValue('Progesterone', 60);
    expect(r.guessed).toBe(true);
    expect(r.value).toBe(60);
  });

  it('в форме есть выбор единицы, поэтому подсказка не нужна', () => {
    expect(LAB_UNIT_CHOICES['Progesterone']).toEqual(['нг/мл', 'нмоль/л']);
  });

  it('движок берёт прогестерон через чтение с единицей, а не сырым числом', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/support-plan/engine-helpers.ts'), 'utf8');
    expect(src).toContain("v['PROG'] = readHormone('Progesterone', 'panelSex'");
  });
});

/**
 * Проход 119: свободный тестостерон — та же ловушка, что у прогестерона.
 * Лаборатории дают его в пмоль/л и в пг/мл (разница 3.47). Пока единицы не
 * было, 30 пмоль/л входили в движок как 30 пг/мл — «высокий свободный тест» и
 * ложный повод снижать дозу.
 */
describe('проход 119: свободный тестостерон читается по единице бланка', () => {
  it('пмоль/л приводится к пг/мл, догадки нет', () => {
    const r = readLabValue('Free T', 30, 'пмоль/л');
    expect(r.guessed).toBe(false);
    expect(r.value).toBe(8.7);
  });

  it('пг/мл остаётся как есть', () => {
    const r = readLabValue('Free T', 8.7, 'пг/мл');
    expect(r.guessed).toBe(false);
    expect(r.value).toBe(8.7);
  });

  it('без единицы число не меняется и помечается догадкой', () => {
    const r = readLabValue('Free T', 30);
    expect(r.guessed).toBe(true);
    expect(r.value).toBe(30);
  });

  it('пересчёт совпадает с конвертером импорта', () => {
    const fromImport = normalizeLabMeasurement('FT', 30, 'pmol/L');
    expect(readLabValue('Free T', 30, 'пмоль/л').value).toBeCloseTo(fromImport.value, 0);
  });

  it('движок берёт свободный тест через чтение с единицей', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/support-plan/engine-helpers.ts'), 'utf8');
    expect(src).toContain("v['FT'] = readHormone('Free T', 'panelSex'");
  });
});

/**
 * Проход 120: свободные Т3/Т4. Нормы приложения — в пмоль/л (Т3 3.5–6.5,
 * Т4 9–22), а бланк может дать пг/мл. 3.2 пг/мл свободного Т4 — это 4.1 пмоль/л
 * (тяжёлый гипотиреоз), а читалось как 3.2 пмоль/л — «почти норма».
 */
describe('проход 120: свободные Т3/Т4 читаются по единице бланка', () => {
  it('пг/мл приводится к пмоль/л', () => {
    const t3 = readLabValue('T3 free', 3.2, 'пг/мл');
    expect(t3.guessed).toBe(false);
    expect(t3.value).toBe(4.9);
    const t4 = readLabValue('T4 free', 1.2, 'пг/мл');
    expect(t4.guessed).toBe(false);
    expect(t4.value).toBe(1.5);
  });

  it('пмоль/л остаётся как есть', () => {
    expect(readLabValue('T3 free', 4.9, 'пмоль/л')).toEqual({ value: 4.9, guessed: false });
    expect(readLabValue('T4 free', 15, 'пмоль/л')).toEqual({ value: 15, guessed: false });
  });

  it('пересчёт совпадает с конвертером импорта', () => {
    const fromImport = normalizeLabMeasurement('FT4', 1.2, 'pg/mL');
    expect(readLabValue('T4 free', 1.2, 'пг/мл').value).toBeCloseTo(fromImport.value, 0);
  });

  it('движок берёт Т3/Т4 через чтение с единицей', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/support-plan/engine-helpers.ts'), 'utf8');
    expect(src).toContain("v['T3'] = readHormone('T3 free', 'panelThyroid'");
    expect(src).toContain("v['T4'] = readHormone('T4 free', 'panelThyroid'");
  });
});

/**
 * Проход 121: витамин D. Канон приложения — нг/мл (нормы 30–100), а российские
 * бланки чаще дают нмоль/л. 62 нмоль/л — это 24.8 нг/мл, то есть дефицит; как
 * 62 нг/мл то же число выглядело бы «выше нормы», и дефицит исчезал.
 */
describe('проход 121: витамин D читается по единице бланка', () => {
  it('нмоль/л приводится к нг/мл, догадки нет', () => {
    const r = readLabValue('Vitamin D (25-OH)', 62, 'нмоль/л');
    expect(r.guessed).toBe(false);
    expect(r.value).toBe(24.8);
  });

  it('нг/мл остаётся как есть', () => {
    expect(readLabValue('Vitamin D (25-OH)', 24.8, 'нг/мл')).toEqual({ value: 24.8, guessed: false });
  });

  it('пересчёт совпадает с конвертером импорта', () => {
    const fromImport = normalizeLabMeasurement('VITD', 62, 'nmol/L');
    expect(readLabValue('Vitamin D (25-OH)', 62, 'нмоль/л').value).toBeCloseTo(fromImport.value, 0);
  });

  it('движок берёт витамин D через чтение с единицей', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/support-plan/engine-helpers.ts'), 'utf8');
    expect(src).toContain("v['VITD'] = readHormone('Vitamin D (25-OH)', 'panelVitamin'");
  });
});

/**
 * Проход 122: фолат. Норма приложения — 7–50 нг/мл, а бланк может дать нмоль/л
 * (разница 2.27). 15 нмоль/л — это 6.6 нг/мл, пограничный дефицит; прочитанное
 * как 15 нг/мл число давало «уверенную норму» и снимало вопрос с B12/гомоцистеином.
 */
describe('проход 122: фолат читается по единице бланка', () => {
  it('нмоль/л приводится к нг/мл, догадки нет', () => {
    const r = readLabValue('Folate', 15, 'нмоль/л');
    expect(r.guessed).toBe(false);
    expect(r.value).toBe(6.6);
  });

  it('нг/мл остаётся как есть', () => {
    expect(readLabValue('Folate', 6.6, 'нг/мл')).toEqual({ value: 6.6, guessed: false });
  });

  it('пересчёт совпадает с конвертером импорта', () => {
    const fromImport = normalizeLabMeasurement('FOL', 15, 'nmol/L');
    expect(readLabValue('Folate', 15, 'нмоль/л').value).toBeCloseTo(fromImport.value, 0);
  });

  it('движок берёт фолат через чтение с единицей', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/support-plan/engine-helpers.ts'), 'utf8');
    expect(src).toContain("v['FOLATE'] = readHormone('Folate', 'panelVitamin'");
  });
});

/**
 * Проход 123: B12. Норма приложения — 200–900 пг/мл, а бланк может дать пмоль/л
 * (1 пг/мл = 0.738 пмоль/л). 300 пмоль/л — это 406.6 пг/мл (уверенная норма),
 * а прочитанное как 300 пг/мл число попадало в пограничную зону.
 */
describe('проход 123: B12 читается по единице бланка', () => {
  it('пмоль/л приводится к пг/мл, догадки нет', () => {
    const r = readLabValue('B12', 300, 'пмоль/л');
    expect(r.guessed).toBe(false);
    expect(r.value).toBe(406.6);
  });

  it('пг/мл остаётся как есть', () => {
    expect(readLabValue('B12', 406.6, 'пг/мл')).toEqual({ value: 406.6, guessed: false });
  });

  it('пересчёт совпадает с конвертером импорта', () => {
    const fromImport = normalizeLabMeasurement('B12', 300, 'pmol/L');
    expect(readLabValue('B12', 300, 'пмоль/л').value).toBeCloseTo(fromImport.value, 0);
  });

  it('движок берёт B12 через чтение с единицей', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/support-plan/engine-helpers.ts'), 'utf8');
    expect(src).toContain("v['B12'] = readHormone('B12', 'panelVitamin'");
  });
});

/**
 * Проход 124: выбор единицы и пересчёт — одна таблица.
 * Пока канон и множитель жили в разных местах (список канонов + `switch`), можно
 * было дать маркеру выбор единицы и забыть пересчёт: выбранная единица молча
 * ничего не делала, и 1800 «пг/мл» из пмольных 1800 читались как канон. Направление
 * пересчёта тоже выбиралось руками, а ошибка в нём — та же тишина.
 */
describe('проход 124: выбор единицы не бывает без пересчёта', () => {
  it('у каждого маркера с выбором единицы есть запись в таблице', () => {
    for (const marker of Object.keys(LAB_UNIT_CHOICES)) {
      expect(LAB_UNIT_READ[marker], `${marker}: выбор единицы без пересчёта`).toBeTruthy();
    }
  });

  it('варианты в форме = канон + другая единица из таблицы', () => {
    for (const [marker, choices] of Object.entries(LAB_UNIT_CHOICES)) {
      const rec = LAB_UNIT_READ[marker];
      expect(rec.canon, `${marker}: первым в форме идёт канон`).toBe(choices[0]);
      expect(Object.keys(rec.others), `${marker}: варианты формы и таблицы`).toEqual(choices.slice(1));
    }
  });

  it('выбранная единица действительно пересчитывает число', () => {
    for (const [marker, choices] of Object.entries(LAB_UNIT_CHOICES)) {
      const conv = LAB_UNIT_READ[marker].others[choices[1]];
      const raw = 100;
      const expected = conv.op === 'div' ? raw / conv.factor : raw * conv.factor;
      expect(readLabValue(marker, raw, choices[1]).value, `${marker} (${choices[1]})`)
        .toBeCloseTo(Math.round(expected * 10) / 10, 5);
    }
  });

  it('канон чтения — производная таблицы, а не второй список', () => {
    for (const [marker, rec] of Object.entries(LAB_UNIT_READ)) {
      expect(LAB_READ_UNIT[marker]).toBe(rec.canon);
      expect(LAB_UNIT_CHOICES[marker], `${marker}: пересчёт без выбора единицы в форме`).toBeTruthy();
    }
  });
});

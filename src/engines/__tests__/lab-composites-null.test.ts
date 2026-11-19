/**
 * lab-composites-null.test.ts — проход 153: составные индексы не выдумывают
 * «норму» за отсутствующий анализ.
 *
 * Было: `metric(labs, 'LDL', 2.5)`, `'CRP', 1.5`, `defaultLft = 30` подставляли
 * значения, когда маркера нет. Поэтому `interpretLabs([])` возвращал «стресс
 * печени 75», «кардиориск 40», «воспаление 2.5», «стресс почек 73», а экраны
 * печатали ASI 72 % / HMI 77 / CR 45 — оценку здоровья без единого анализа.
 *
 * Стало: индекс считается только по измеренным маркерам (вес нормируется на
 * присутствующие), нет ни одного — `null`. `computeHealthIndices` — одна формула
 * ASI/HMI/CR на экраны «Анализы» и «Риск», и неизмеренный вход даёт `null`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { interpretLabs, computeHealthIndices, computeRiskByModel, computePharmaAdjustedDose } from '../lab-analysis.engine';
import { generateTrainingRecommendations } from '../training-recommendations.engine';
import { labTrainingAdjust } from '../../ui/screens/TrainingScreen_parts/lab-training-adjust';
import { LFT_ULN, CREATININE_ULN } from '../lab-norms.engine';

const point = (code: string, value: number, extra: Record<string, unknown> = {}) => ({
  id: `${code}-${value}-${String(extra.bound || '')}`,
  code,
  name: code,
  value,
  unit: '',
  date: '2026-11-01',
  ...extra,
}) as any;

describe('проход 153: нет анализов — нет индексов', () => {
  it('пустой список: ни один составной индекс не посчитан', () => {
    const res = interpretLabs([]);
    expect(res.liverStress).toBeNull();
    expect(res.cardioRisk).toBeNull();
    expect(res.inflammation).toBeNull();
    expect(res.kidneyStress).toBeNull();
    expect(res.hormoneScore).toBeNull();
  });

  it('ASI/HMI/CR без анализов — null, а не «здоровье 72 %»', () => {
    expect(computeHealthIndices(interpretLabs([]))).toEqual({ asi: null, hmi: null, cr: null });
  });

  it('чужой маркер не оживляет индексы: только глюкоза', () => {
    const res = interpretLabs([point('GLUCOSE', 5.0)]);
    expect(res.liverStress).toBeNull();
    expect(res.cardioRisk).toBeNull();
    expect(res.inflammation).toBeNull();
    expect(res.kidneyStress).toBeNull();
    expect(res.hormoneScore).toBeNull();
  });
});

describe('проход 153: индекс считается по измеренному, а не по норме', () => {
  it('один АЛТ: стресс печени есть, остальные индексы неизвестны', () => {
    const res = interpretLabs([point('ALT', LFT_ULN.ALT.male)], 'male');
    expect(res.liverStress).toBe(100);
    expect(res.cardioRisk).toBeNull();
    expect(res.kidneyStress).toBeNull();
    expect(res.inflammation).toBeNull();
    // HMI = печень 1.2 + воспаление 0.5 — воспаление не измерено → индекса нет.
    expect(computeHealthIndices(res).hmi).toBeNull();
  });

  it('два АЛТ/АСТ — среднее их долей ВГН (АЛТ 80 и АСТ 40 при 40 = 150 %)', () => {
    const res = interpretLabs([point('ALT', 80), point('AST', 40)], 'male');
    expect(res.liverStress).toBe(150);
  });

  it('креатинин один: почки считают от ВГН пола, без подставленной мочевины', () => {
    const male = interpretLabs([point('CREATININE', CREATININE_ULN.male)], 'male');
    const female = interpretLabs([point('CREATININE', CREATININE_ULN.female)], 'female');
    expect(male.kidneyStress).toBe(100);
    expect(female.kidneyStress).toBe(100);
  });

  it('мочевина одна: вес 40 нормируется на измеренное, а не на отсутствующий креатинин', () => {
    const res = interpretLabs([point('UREA', 8.3)]);
    expect(res.kidneyStress).toBe(100);
  });

  it('СРБ один: воспаление = СРБ, без подставленного ферритина 100', () => {
    expect(interpretLabs([point('CRP', 2)]).inflammation).toBe(2);
  });

  it('ферритин один: воспаление = ферритин/100', () => {
    expect(interpretLabs([point('FERRITIN', 400)]).inflammation).toBe(4);
  });

  it('ЛПНП без ЛПВП кардиоиндекс не даёт: ядро формулы не измерено', () => {
    expect(interpretLabs([point('LDL', 4)]).cardioRisk).toBeNull();
  });

  it('ЛПНП + ЛПВП: кардиоиндекс по ядру, АПОБ и ТГ не выдуманы', () => {
    const res = interpretLabs([point('LDL', 2), point('HDL', 1.25)]);
    // ((2 + 0*3 + 0/2) / 1.25) * 10 = 16
    expect(res.cardioRisk).toBe(16);
  });

  it('ТГ и АПОБ входят, когда измерены', () => {
    const res = interpretLabs([point('LDL', 2), point('HDL', 1.25), point('TRIGLYCERIDES', 1), point('APOB', 0.5)]);
    // ((2 + 0.5*3 + 1/2) / 1.25) * 10 = 32
    expect(res.cardioRisk).toBe(32);
  });
});

describe('проход 153: гормональный балл не «идеален» по умолчанию', () => {
  it('нормальный E2 мужчине — измеренный балл 0 (как раньше)', () => {
    expect(interpretLabs([point('ESTRADIOL', 100)], 'male').hormoneScore).toBe(0);
  });

  it('нормальный ФСГ женщине — измеренный балл 0, а не «нет данных»', () => {
    expect(interpretLabs([point('FSH', 7)], 'female').hormoneScore).toBe(0);
  });

  it('без гормонов — балл неизвестен, и ASI не считается', () => {
    const res = interpretLabs([point('ALT', 20), point('CREATININE', 80), point('CRP', 1)]);
    expect(res.hormoneScore).toBeNull();
    expect(computeHealthIndices(res).asi).toBeNull();
  });

  it('все входы ASI измерены — индекс считается', () => {
    const res = interpretLabs([
      point('ESTRADIOL', 100), point('CRP', 1), point('CREATININE', CREATININE_ULN.male),
      point('ALT', 20), point('LDL', 2), point('HDL', 1.25),
    ], 'male');
    const idx = computeHealthIndices(res);
    expect(idx.asi).not.toBeNull();
    expect(idx.hmi).not.toBeNull();
    expect(idx.cr).not.toBeNull();
  });
});

describe('проход 153: риск по модели не растёт от отсутствующих анализов', () => {
  const base = { cardio: 10, hepatic: 10, renal: 10, neuro: 10, endocrine: 10, hematologic: 10, reproductive: 10, musculoskeletal: 10 };

  it('пустые композиты: lab_weighted = standard', () => {
    const res = interpretLabs([]);
    const standard = computeRiskByModel('standard', res, base, {}, {});
    const weighted = computeRiskByModel('lab_weighted', res, base, {}, {});
    expect(weighted).toEqual(standard);
  });

  it('измеренный АЛТ поднимает печёночный риск', () => {
    const res = interpretLabs([point('ALT', 200)]);
    const weighted = computeRiskByModel('lab_weighted', res, base, {}, {});
    expect(weighted.hepatic.raw).toBeGreaterThan(base.hepatic);
  });
});

describe('проход 153: источник — без подставленных норм', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/engines/lab-analysis.engine.ts'), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');

  it('в движке нет значений по умолчанию для составных индексов', () => {
    expect(src).not.toContain('defaultLft');
    expect(src).not.toContain("metric(labs, 'LDL', 2.5)");
    expect(src).not.toContain("metric(labs, 'CRP', 1.5)");
    expect(src).not.toContain("metric(labs, 'UREA', 5)");
    expect(src).toContain('function weightedRatio(');
  });

  it('оба экрана берут ASI/HMI/CR из одной формулы', () => {
    const labs = readFileSync(resolve(process.cwd(), 'src/ui/screens/LabsScreen.tsx'), 'utf8');
    const risk = readFileSync(resolve(process.cwd(), 'src/ui/screens/RiskScreen.tsx'), 'utf8');
    expect(labs).toContain('computeHealthIndices(');
    expect(risk).toContain('computeHealthIndices(');
    expect(labs).not.toContain('(r.hormoneScore || 0)');
    expect(risk).not.toContain('(r.hormoneScore||0)');
  });
});

describe('проход 153: потребитель не принимает «нет данных» за норму', () => {
  const empty = interpretLabs([]);

  it('labTrainingAdjust без индексов не режет объём и молчит', () => {
    const adj = labTrainingAdjust(empty);
    expect(adj.mrvMultiplier).toBe(1);
    expect(adj.warnings).toEqual([]);
    expect(adj.deloadRecommended).toBe(false);
  });

  it('измеренный стресс печени по-прежнему режет объём', () => {
    const adj = labTrainingAdjust(interpretLabs([point('ALT', 200)]));
    expect(adj.mrvMultiplier).toBeLessThan(1);
    expect(adj.warnings.length).toBeGreaterThan(0);
  });

  it('тренерские советы по неизмеренным индексам не появляются', () => {
    const recs = generateTrainingRecommendations({
      historyWorkouts: [], level: 'intermediate', weakPoints: [], labAnalysis: empty,
    });
    expect(recs.some((r) => r.id.startsWith('lab-'))).toBe(false);
  });

  it('снижение дозы без измеренных индексов = базовая доза', () => {
    expect(computePharmaAdjustedDose(100, null, null, 100).finalDose).toBe(100);
  });

  it('SupportScreen не кладёт неизмеренный индекс в лабораторную надбавку', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/SupportScreen.tsx'), 'utf8');
    // Каждая надбавка стоит под проверкой на `null`: подставленное «нормальное»
    // число больше не может попасть в план как измеренный стресс.
    const assignments = src.split(/\r?\n/).filter((l) => /labStress\.\w+ = labRes\./.test(l));
    expect(assignments.length).toBeGreaterThan(0);
    for (const line of assignments) expect(line.trim().startsWith('if (')).toBe(true);
  });
});

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
 *
 * Проход 194: числа для «воспаления», «стресса печени» и «стресса почек» больше не
 * свои — их даёт главная модель механизмов (`labMechanismIndex` → `getMiLabStep`), и
 * индекс печатает ступень в процентах: 0 / 33 / 67 / 100. Поэтому ожидания ниже
 * читаются ступенями модели, а не долями ВГН.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { interpretLabs, computeHealthIndices, computeRiskByModel } from '../lab-analysis.engine';
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

describe('проход 153 / 194: индекс считается по измеренному, а не по норме', () => {
  it('один АЛТ на ВГН: ступень 1 модели = 33 %, остальные индексы неизвестны', () => {
    const res = interpretLabs([point('ALT', LFT_ULN.ALT.male)], 'male');
    expect(res.liverStress).toBe(33);
    expect(res.cardioRisk).toBeNull();
    expect(res.kidneyStress).toBeNull();
    expect(res.inflammation).toBeNull();
    // HMI = печень 1.2 + воспаление 0.5 — воспаление не измерено → индекса нет.
    expect(computeHealthIndices(res).hmi).toBeNull();
  });

  it('АЛТ 80 (ступень 2) и АСТ 40 (ступень 1) — берётся худшая: 67 %', () => {
    const res = interpretLabs([point('ALT', 80), point('AST', 40)], 'male');
    expect(res.liverStress).toBe(67);
  });

  it('креатинин один: почки берут ступени пола, без подставленной мочевины', () => {
    const male = interpretLabs([point('CREATININE', CREATININE_ULN.male)], 'male');
    const female = interpretLabs([point('CREATININE', CREATININE_ULN.female)], 'female');
    expect(male.kidneyStress).toBe(33);
    expect(female.kidneyStress).toBe(33);
  });

  it('мочевина одна: ступень читается, отсутствующий креатинин не подставляется', () => {
    const res = interpretLabs([point('UREA', 8.3)]);
    expect(res.kidneyStress).toBe(33);
  });

  it('СРБ 2 ниже первой ступени — воспаления нет (0 %), а не «СРБ»', () => {
    expect(interpretLabs([point('CRP', 2)]).inflammation).toBe(0);
  });

  it('ферритин 350 — ступень 1 модели: 33 % (без подставленного СРБ)', () => {
    expect(interpretLabs([point('FERRITIN', 350)]).inflammation).toBe(33);
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
    // Проход 194: свои формулы воспаления/печени/почек убраны — числа даёт
    // главная модель через `labMechanismIndex`.
    expect(src).toContain('labMechanismIndex(');
    expect(src).not.toContain('function weightedRatio(');
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
    // Проход 198: подпись честная — «67/100», а не число из шкалы 0..10.
    expect(adj.warnings.join(' ')).toContain('/100');
  });

  it('hormoneScore — штраф: объём режет высокий балл, а не низкий (проход 198)', () => {
    const mk = (hormoneScore: number) => labTrainingAdjust({
      ...empty,
      hormoneScore,
    } as ReturnType<typeof interpretLabs>);
    // Идеальный профиль — штраф 0, объём не режется.
    expect(mk(0).mrvMultiplier).toBe(1);
    // Отклонения копятся — и только тогда снижается объём.
    expect(mk(75).mrvMultiplier).toBeLessThan(1);
    expect(mk(75).warnings.join(' ')).toContain('Гормональные отклонения');
  });

  it('тренерские советы по неизмеренным индексам не появляются', () => {
    const recs = generateTrainingRecommendations({
      historyWorkouts: [], level: 'intermediate', weakPoints: [], labAnalysis: empty,
    });
    expect(recs.some((r) => r.id.startsWith('lab-'))).toBe(false);
  });

  it('снижения дозы «по стрессу органов» не осталось ни в движке, ни на экране', () => {
    // Проход 202: `computePharmaAdjustedDose` не вызывалась ни одним экраном —
    // в контексте `SupportScreen` лежал неиспользованный вход. Дозу ведут
    // правила курса, а не выдуманное снижение по индексу стресса: второго
    // способа нет и он не должен вернуться в контекст экрана.
    const engine = readFileSync(resolve(process.cwd(), 'src/engines/lab-analysis.engine.ts'), 'utf8');
    const screen = readFileSync(resolve(process.cwd(), 'src/ui/screens/SupportScreen.tsx'), 'utf8');
    expect(engine.includes('computePharmaAdjustedDose')).toBe(false);
    expect(screen.includes('computePharmaAdjustedDose')).toBe(false);
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

describe('проход 198: подпись и сторона индекса — в его шкале', () => {
  it('CalcQualityTab печатает «/100» и красит гормоны за высокий штраф', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/TrainingScreen_parts/CalcQualityTab.tsx'), 'utf8');
    expect(src).toContain('}/100`');
    // Прежняя проверка красила янтарным НИЗКИЙ балл («хорошо») — сторона штрафа.
    expect(src).not.toContain('hormoneScore < 60');
  });

  it('lab-training-adjust и training-recommendations не держат десятибалльных порогов', () => {
    const adjust = readFileSync(resolve(process.cwd(), 'src/ui/screens/TrainingScreen_parts/lab-training-adjust.ts'), 'utf8');
    const recs = readFileSync(resolve(process.cwd(), 'src/engines/training-recommendations.engine.ts'), 'utf8');
    expect(adjust).not.toContain('hormoneScore < 40');
    expect(recs).not.toContain('/10)');
    expect(recs).toContain('LAB_INDEX_STEP2');
  });
});

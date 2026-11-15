/**
 * lab-analysis-sex.test.ts — проход 61: `interpretLabs` знает пол.
 *
 * Было: `REFERENCE_RANGES` — один мужской ряд для всех, и композитные индексы
 * считались от мужских знаменателей (печень /40, почки /110). Женщина с АЛТ 35,
 * ГГТ 40, HCT 49, HGB 160, креатинином 100, эстрадиолом 200 пг/мл или
 * пролактином 600 мЕд/л читала «норма», а тестостерон 1 нмоль/л давал ей
 * «андрогенный дефицит».
 *
 * Стало: женские границы из резолвера (`LFT_ULN`, `GGT_ULN`, `HCT_THRESHOLDS`,
 * `HGB_THRESHOLDS`, `CREATININE_ULN`, `FEMALE_HORMONE_ULN`) и индексы в долях
 * ВГН пациента. Без `sex` — прежний мужской путь байт-в-байт.
 *
 * Проход 77: у женщины верх E2 — коридор её фазы (`cycle`), и значок маркера, и
 * гормональный балл читают его; красный бэнд 800 не меняется.
 * Проход 82: ЛГ и ФСГ у женщины — тоже фазовые, а высокий гонадотропин не
 * получает мужской механизм «подавление оси» (это не подавление).
 * Проход 89: прогестерон у женщины — лютеиновый сигнал ановуляции; мужской шкалы
 * у него нет вовсе, а без дня цикла он не судится.
 * Проход 90: высокие ЛГ/ФСГ у женщины — своя линия (резерв / СПКЯ) в базовой фазе.
 * Проход 91: те же механизмы входят в гормональный балл по тем же условиям.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { interpretLabs } from '../lab-analysis.engine';
import { cycleState } from '../female-cycle-phase.engine';
import {
  LFT_ULN, GGT_ULN, HCT_THRESHOLDS, HGB_THRESHOLDS, CREATININE_ULN,
  FEMALE_HORMONE_BANDS, FEMALE_HORMONE_ULN,
} from '../lab-norms.engine';

const one = (code: string, value: number) => [{ code, value } as any];
const interp = (code: string, value: number, sex?: 'male' | 'female') =>
  interpretLabs(one(code, value), sex).interpretations.find(i => i.code === code);
const status = (code: string, value: number, sex?: 'male' | 'female') =>
  interp(code, value, sex)?.status;

describe('маркеры: женские границы из резолвера', () => {
  it('АЛТ 35: у мужчины норма, у женщины высоко (её ВГН 31)', () => {
    expect(status('ALT', 35, 'male')).toBeUndefined();
    expect(status('ALT', 35, 'female')).toBe('high');
    expect(LFT_ULN.ALT.female).toBe(31);
  });

  it('ГГТ 40: у мужчины норма, у женщины высоко (её ВГН 31)', () => {
    expect(status('GGT', 40, 'male')).toBeUndefined();
    expect(status('GGT', 40, 'female')).toBe('high');
    expect(GGT_ULN.female).toBe(31);
  });

  it('HCT 49 и HGB 160: женские пороги 48/150', () => {
    expect(status('HEMATOCRIT', 49, 'male')).toBeUndefined();
    expect(status('HEMATOCRIT', 49, 'female')).toBe('high');
    expect(status('HEMOGLOBIN', 160, 'male')).toBeUndefined();
    expect(status('HEMOGLOBIN', 160, 'female')).toBe('high');
    expect(HCT_THRESHOLDS.female.erythrocytosis).toBe(48);
    expect(HGB_THRESHOLDS.female.upper).toBe(150);
  });

  it('креатинин 100: у мужчины норма, у женщины высоко (ВГН 97)', () => {
    expect(status('CREATININE', 100, 'male')).toBeUndefined();
    expect(status('CREATININE', 100, 'female')).toBe('high');
    expect(CREATININE_ULN.female).toBe(97);
  });
});

describe('гормоны: мужское окно не выдаётся за общее', () => {
  it('тестостерон 1 нмоль/л — «дефицит» только у мужчины', () => {
    expect(status('TESTOSTERONE_TOTAL', 1, 'male')).toBe('low');
    expect(status('TESTOSTERONE_TOTAL', 1, 'female')).toBeUndefined();
  });

  it('пролактин: у женщины высоко только от 800 мЕд/л', () => {
    expect(status('PROLACTIN', 400, 'male')).toBe('high');
    expect(status('PROLACTIN', 600, 'female')).toBeUndefined();
    expect(status('PROLACTIN', 900, 'female')).toBe('high');
    expect(FEMALE_HORMONE_ULN.PRL.high).toBe(800);
  });

  it('E2: у женщины 200 — норма, 500 — высоко, 900 — критично, 20 — низко', () => {
    // Мужской ряд 10–40, критично >60: 200 пг/мл — критично.
    expect(status('ESTRADIOL', 200, 'male')).toBe('critical_high');
    expect(status('ESTRADIOL', 200, 'female')).toBeUndefined();
    expect(status('ESTRADIOL', 500, 'female')).toBe('high');
    expect(status('ESTRADIOL', 900, 'female')).toBe('critical_high');
    expect(status('ESTRADIOL', 20, 'female')).toBe('low');
    // Числовые границы совпадают с текстовыми бэндами (40–400 зелёный, >800 красный).
    expect(FEMALE_HORMONE_ULN.E2.high).toBe(400);
    expect(FEMALE_HORMONE_BANDS.E2.red).toBe('>800 или <30');
  });

  it('E2 у женщины не штрафует гормональный балл в фазовой норме', () => {
    expect(interpretLabs(one('ESTRADIOL', 200), 'female').hormoneScore).toBe(0);
    expect(interpretLabs(one('ESTRADIOL', 200), 'male').hormoneScore).toBe(25);
  });

  // Проход 77: верхняя граница E2 — коридор ЕЁ фазы, а не красный бэнд 800.
  // Иначе нормальная лютеиновая 450 и фолликулярная 300 оценивались одинаково.
  it('E2 по фазе: 300 в лютеиновую — норма, в фолликулярную — высоко', () => {
    const luteal = { phase: 'luteal' as const, cycleDay: 21, cycleLength: 28, label: 'Лютеиновая' };
    const follicular = { phase: 'follicular' as const, cycleDay: 8, cycleLength: 28, label: 'Фолликулярная' };
    expect(interpretLabs(one('ESTRADIOL', 300), 'female', luteal).hormoneScore).toBe(0);
    expect(interpretLabs(one('ESTRADIOL', 300), 'female', follicular).hormoneScore).toBe(25);
  });

  it('E2 в овуляторную и менструальную — без ложных срабатываний', () => {
    // Овуляторная: своего коридора нет (пик шире любого), остаётся бэнд 800.
    const ovul = { phase: 'ovulatory' as const, cycleDay: 14, cycleLength: 28, label: 'Овуляторная' };
    expect(interpretLabs(one('ESTRADIOL', 600), 'female', ovul).hormoneScore).toBe(0);
    // Менструальная: E2 низкий по природе — нижняя граница остаётся красной (<30).
    const menstr = { phase: 'menstrual' as const, cycleDay: 2, cycleLength: 28, label: 'Менструальная' };
    expect(interpretLabs(one('ESTRADIOL', 35), 'female', menstr).hormoneScore).toBe(0);
    expect(interpretLabs(one('ESTRADIOL', 25), 'female', menstr).hormoneScore).toBe(25);
  });

  // Значок маркера и балл — один источник: иначе Labs показывал «высоко» там,
  // где балл уже считал норму (и наоборот).
  it('значок E2 читает тот же коридор фазы, что и балл', () => {
    const luteal = { phase: 'luteal' as const, cycleDay: 21, cycleLength: 28, label: 'Лютеиновая' };
    const follicular = { phase: 'follicular' as const, cycleDay: 8, cycleLength: 28, label: 'Фолликулярная' };
    const badge = (v: number, cyc?: typeof luteal | typeof follicular) =>
      interpretLabs(one('ESTRADIOL', v), 'female', cyc).interpretations.find(i => i.code === 'ESTRADIOL')?.status;
    expect(badge(300, follicular)).toBe('high'); // верх фолликулярной — 200
    expect(badge(300, luteal)).toBeUndefined(); // в лютеиновой до 500 — норма
    expect(badge(300)).toBeUndefined(); // без фазы — прежние 400
    expect(badge(450, luteal)).toBeUndefined();
    expect(badge(450)).toBe('high');
    // Красный бэнд 800 остаётся: фаза не поднимает критический порог.
    expect(badge(900, luteal)).toBe('critical_high');
  });
});

describe('композитные индексы — в долях ВГН пациента', () => {
  it('индекс печени: женские 31 эквивалентны мужским 40', () => {
    const fem = interpretLabs(one('ALT', LFT_ULN.ALT.female), 'female').liverStress;
    const male = interpretLabs(one('ALT', LFT_ULN.ALT.male), 'male').liverStress;
    expect(Math.abs(fem - male)).toBeLessThanOrEqual(1);
  });

  it('индекс почек: женские 97 эквивалентны мужским 110', () => {
    const fem = interpretLabs(one('CREATININE', CREATININE_ULN.female), 'female').kidneyStress;
    const male = interpretLabs(one('CREATININE', CREATININE_ULN.male), 'male').kidneyStress;
    expect(Math.abs(fem - male)).toBeLessThanOrEqual(1);
  });

  it('без sex — прежний мужской путь', () => {
    const labs = one('ALT', 90);
    expect(JSON.stringify(interpretLabs(labs))).toBe(JSON.stringify(interpretLabs(labs, 'male')));
  });
});

describe('исходник: мужские знаменатели индексов убраны', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/engines/lab-analysis.engine.ts'), 'utf8')
    .split(/\r?\n/)
    .map(l => l.replace(/\/\/.*$/, ''))
    .join('\n');

  it('печень и почки считают от ВГН пола', () => {
    expect(src).toContain('LFT_ULN.ALT.female');
    expect(src).toContain('CREATININE_ULN.female');
    expect(src).not.toContain('/ 3 / 40)');
    expect(src).not.toContain('creatinine / 110');
  });
});

describe('проход 82: женские ЛГ и ФСГ — по фазе, без мужской механики', () => {
  const luteal = cycleState({ sex: 'female', lastPeriodStart: '2026-10-30', cycleLengthDays: 28 }, '2026-11-14');
  const ovulatory = cycleState({ sex: 'female', lastPeriodStart: '2026-11-02', cycleLengthDays: 28 }, '2026-11-14');
  const female = (code: string, value: number, cycle = luteal) =>
    interpretLabs(one(code, value), 'female', cycle).interpretations.find(i => i.code === code);

  it('ЛГ 20 в лютеиновую — внутри 5–25, значка нет; мужчине та же 20 — «критично»', () => {
    expect(female('LH', 20)).toBeUndefined();
    expect(interp('LH', 20, 'male')?.status).toBe('critical_high');
    expect(interp('LH', 20, 'male')?.mechanism).toBe('HPTA_SUPPRESSION');
  });

  it('ЛГ 60 (пик овуляции) женщине не «критично»: мужского порога 15 у неё нет', () => {
    expect(female('LH', 60, ovulatory)).toBeUndefined();
    expect(interp('LH', 60, 'male')?.status).toBe('critical_high');
  });

  it('ФСГ 20: мужчине «критично», женщине — ни значка, ни механизма', () => {
    expect(interp('FSH', 20, 'male')?.status).toBe('critical_high');
    expect(female('FSH', 20)).toBeUndefined();
  });

  it('низкий ЛГ у женщины остаётся сигналом подавления оси', () => {
    const low = female('LH', 0.5);
    expect(low?.status).toBe('low');
    expect(low?.mechanism).toBe('HPTA_SUPPRESSION');
  });

  it('источник: у женщины верх ЛГ/ФСГ из фазового коридора и без красной границы', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/lab-analysis.engine.ts'), 'utf8');
    expect(src).toContain("code === 'LH' || code === 'FSH'");
    expect(src).toContain('criticalHigh: Number.POSITIVE_INFINITY');
    expect(src).toContain('maleFramedHigh');
  });
});

describe('проход 89: прогестерон — женский лютеиновый сигнал, а не общая норма', () => {
  const luteal = cycleState({ sex: 'female', lastPeriodStart: '2026-10-30', cycleLengthDays: 28 }, '2026-11-14');
  const follicular = cycleState({ sex: 'female', lastPeriodStart: '2026-11-05', cycleLengthDays: 28 }, '2026-11-14');
  const prog = (value: number, sex?: 'male' | 'female', cycle?: ReturnType<typeof cycleState> | null) =>
    interpretLabs(one('PROG', value), sex, cycle).interpretations.find(i => i.code === 'PROGESTERONE');

  it('лютеиновая 2 нг/мл — овуляции, вероятно, не было', () => {
    const r = prog(2, 'female', luteal);
    expect(r?.status).toBe('low');
    expect(r?.mechanism).toBe('ANOVULATION');
    expect(r?.risk).toBe('HORMONE_LOW_PROG');
  });

  it('лютеиновая 12 нг/мл — в коридоре 5–20, значка нет', () => {
    expect(prog(12, 'female', luteal)).toBeUndefined();
  });

  it('фолликулярная 0.5 — норма: низкий прогестерон в этой фазе ожидаем', () => {
    expect(prog(0.5, 'female', follicular)).toBeUndefined();
  });

  it('без дня цикла не судим вовсе', () => {
    expect(prog(2, 'female', null)).toBeUndefined();
    expect(prog(2, 'female')).toBeUndefined();
  });

  it('мужчине и без пола прогестерон не «низкий»: мужской шкалы нет', () => {
    expect(prog(2, 'male')).toBeUndefined();
    expect(prog(0.2)).toBeUndefined();
  });

  it('источник: блок гейтится лютеиновой фазой, а не полом целиком', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/lab-analysis.engine.ts'), 'utf8');
    expect(src).toContain("if (fem && cycle?.phase === 'luteal')");
    expect(src).toContain('ANOVULATION');
  });
});

describe('проход 90: высокие гонадотропины у женщины — своя линия, базовая фаза', () => {
  const follicular = cycleState({ sex: 'female', lastPeriodStart: '2026-11-05', cycleLengthDays: 28 }, '2026-11-14');
  const luteal = cycleState({ sex: 'female', lastPeriodStart: '2026-10-30', cycleLengthDays: 28 }, '2026-11-14');
  const ovulatory = cycleState({ sex: 'female', lastPeriodStart: '2026-11-02', cycleLengthDays: 28 }, '2026-11-14');
  const both = (lh: number, fsh: number, sex: 'male' | 'female', cycle: ReturnType<typeof cycleState> | null) =>
    interpretLabs([{ code: 'LH', value: lh } as any, { code: 'FSH', value: fsh } as any], sex, cycle).interpretations;

  it('базовая фаза: ФСГ 14 — снижение овариального резерва', () => {
    const r = both(5, 14, 'female', follicular).find(i => i.code === 'FSH');
    expect(r?.status).toBe('high');
    expect(r?.mechanism).toBe('OVARIAN_RESERVE_LOW');
    expect(r?.risk).toBe('FERTILITY_LOW_RESERVE');
  });

  it('базовая фаза: ЛГ 18 при ФСГ 7 — повод исключить СПКЯ', () => {
    expect(both(18, 7, 'female', follicular).find(i => i.code === 'LH')?.mechanism).toBe('PCOS_SUSPECT');
  });

  it('базовая фаза: ЛГ 12 при ФСГ 9 (отношение 1.3) — не СПКЯ', () => {
    expect(both(12, 9, 'female', follicular).some(i => i.mechanism === 'PCOS_SUSPECT')).toBe(false);
  });

  it('лютеиновая ЛГ 20 — физиология: ни СПКЯ, ни резерва', () => {
    const r = both(20, 6, 'female', luteal);
    expect(r.some(i => i.mechanism === 'PCOS_SUSPECT')).toBe(false);
    expect(r.some(i => i.mechanism === 'OVARIAN_RESERVE_LOW')).toBe(false);
  });

  it('пик овуляции ЛГ 60 — тоже не СПКЯ', () => {
    expect(both(60, 8, 'female', ovulatory).some(i => i.mechanism === 'PCOS_SUSPECT')).toBe(false);
  });

  it('мужчине эта линия не применяется', () => {
    expect(both(18, 14, 'male', follicular)
      .some(i => i.mechanism === 'PCOS_SUSPECT' || i.mechanism === 'OVARIAN_RESERVE_LOW')).toBe(false);
  });

  it('источник: линия гейтится базовыми фазами', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/lab-analysis.engine.ts'), 'utf8');
    expect(src).toContain("cycle?.phase === 'follicular' || cycle?.phase === 'menstrual'");
    expect(src).toContain('PCOS_SUSPECT');
  });
});

describe('проход 91: женские механизмы входят в гормональный балл', () => {
  const luteal = cycleState({ sex: 'female', lastPeriodStart: '2026-10-30', cycleLengthDays: 28 }, '2026-11-14');
  const follicular = cycleState({ sex: 'female', lastPeriodStart: '2026-11-05', cycleLengthDays: 28 }, '2026-11-14');
  const score = (
    labs: Array<{ code: string; value: number }>,
    sex?: 'male' | 'female',
    cycle: ReturnType<typeof cycleState> | null = null,
  ) => interpretLabs(labs as any, sex, cycle).hormoneScore;

  it('ановуляция (лютеиновая PROG 2) добавляет 20, лютеиновая 12 — ничего', () => {
    expect(score([{ code: 'PROG', value: 2 }], 'female', luteal)).toBe(20);
    expect(score([{ code: 'PROG', value: 12 }], 'female', luteal)).toBe(0);
  });

  it('базовый ФСГ 14 добавляет 15, ФСГ 7 — ничего', () => {
    expect(score([{ code: 'FSH', value: 14 }], 'female', follicular)).toBe(15);
    expect(score([{ code: 'FSH', value: 7 }], 'female', follicular)).toBe(0);
  });

  it('СПКЯ-подозрение (ЛГ 18 / ФСГ 7) добавляет 15', () => {
    expect(score([{ code: 'LH', value: 18 }, { code: 'FSH', value: 7 }], 'female', follicular)).toBe(15);
  });

  it('лютеиновая ЛГ 20 в балл не идёт — это физиология', () => {
    expect(score([{ code: 'LH', value: 20 }], 'female', luteal)).toBe(0);
  });

  it('мужчине женские механизмы балл не поднимают', () => {
    expect(score([{ code: 'PROG', value: 2 }], 'male')).toBe(0);
  });

  it('источник: балл читает интерпретации, а не второй набор порогов', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/lab-analysis.engine.ts'), 'utf8');
    expect(src).toContain("interp.mechanism === 'ANOVULATION'");
    expect(src).toContain("interp.mechanism === 'OVARIAN_RESERVE_LOW' || interp.mechanism === 'PCOS_SUSPECT'");
  });
});

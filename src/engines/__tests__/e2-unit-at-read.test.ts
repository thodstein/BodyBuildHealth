/**
 * e2-unit-at-read.test.ts — проход 84: единица бланка важнее эвристики.
 *
 * Было: `normalizeLabValue` угадывает единицу по величине («E2 >300 — значит
 * пмоль/л»). Для мужчины это ещё работает, для женщины — нет: её лютеиновая
 * E2 450 пг/мл (норма 70–500) превращалась в 122.6 пг/мл, и «плоский» список
 * анализов (`normalizeFlatLabs` → риск-модель) читал её как низкую. Обратный
 * случай тоже был слепым: 900 пмоль/л (245 пг/мл) без конвертации давало «выше
 * коридора» по строке результата.
 *
 * Стало: `LabPoint` всегда носит `unit`, поэтому на чтении E2 переводится по
 * единице (`e2PgPerMl`): пмоль/л → ÷3.671, пг/мл → как есть. Эвристика осталась
 * только там, где единицы действительно нет (быстрый ввод в настройках
 * «Мужского протокола»). Мужской путь и путь без пола не изменены.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LabPoint } from '../../core/types';
import { e2PgPerMl } from '../lab-norms.engine';
import { interpretLabs } from '../lab-analysis.engine';
import { normalizeFlatLabs } from '../support-plan/engine-helpers';
import { cycleState } from '../female-cycle-phase.engine';

const point = (code: string, value: number, unit: string): LabPoint => ({
  id: `${code}-1`, code, name: code, value, unit, date: '2026-11-10', phase: 'any',
});

const luteal = cycleState({ sex: 'female', lastPeriodStart: '2026-10-30', cycleLengthDays: 28 }, '2026-11-14');

describe('e2PgPerMl: перевод по единице бланка', () => {
  it('пг/мл — как есть, в любом написании', () => {
    expect(e2PgPerMl(450, 'пг/мл')).toBe(450);
    expect(e2PgPerMl(450, 'pg/mL')).toBe(450);
    expect(e2PgPerMl(450, '')).toBe(450);
    expect(e2PgPerMl(450, undefined)).toBe(450);
  });

  it('пмоль/л — делим на 3.671 с одним знаком', () => {
    expect(e2PgPerMl(900, 'пмоль/л')).toBe(245.2);
    expect(e2PgPerMl(900, 'pmol/L')).toBe(245.2);
  });

  it('нечисло не превращается в NaN', () => {
    expect(Number.isNaN(e2PgPerMl(Number.NaN, 'пмоль/л'))).toBe(true);
  });
});

describe('строка результата: единица бланка, а не догадка', () => {
  it('женщина, лютеиновая E2 450 пг/мл — норма, значка нет', () => {
    expect(interpretLabs([point('E2', 450, 'пг/мл')], 'female', luteal).interpretations).toHaveLength(0);
  });

  it('женщина, 900 пмоль/л (=245 пг/мл) — тоже норма, а не «высоко»', () => {
    expect(interpretLabs([point('E2', 900, 'пмоль/л')], 'female', luteal).interpretations).toHaveLength(0);
  });

  it('женщина, 3000 пмоль/л (=817 пг/мл) — критично', () => {
    const res = interpretLabs([point('E2', 3000, 'пмоль/л')], 'female', luteal).interpretations;
    expect(res).toHaveLength(1);
    expect(res[0].status).toBe('critical_high');
  });

  it('мужчина: 70 пг/мл — критично, 70 пмоль/л (=19 пг/мл) — норма', () => {
    expect(interpretLabs([point('E2', 70, 'пг/мл')], 'male').interpretations[0]?.status).toBe('critical_high');
    expect(interpretLabs([point('E2', 70, 'пмоль/л')], 'male').interpretations).toHaveLength(0);
  });

  it('без пола — прежний путь: 70 пг/мл критично', () => {
    expect(interpretLabs([point('E2', 70, 'пг/мл')]).interpretations[0]?.status).toBe('critical_high');
  });
});

describe('normalizeFlatLabs: единица есть — эвристика не работает', () => {
  it('450 пг/мл остаётся 450 (было 122.6)', () => {
    expect(normalizeFlatLabs([{ code: 'E2', value: 450, unit: 'пг/мл' }]).E2).toBe(450);
  });

  it('900 пмоль/л даёт 245.2 пг/мл', () => {
    expect(normalizeFlatLabs([{ code: 'ESTRADIOL', value: 900, unit: 'пмоль/л' }]).ESTRADIOL).toBe(245.2);
  });

  it('единицы нет (быстрый ввод настроек) — прежняя эвристика', () => {
    expect(normalizeFlatLabs([{ code: 'E2', value: 450 }]).E2).toBe(122.6);
  });

  it('другие маркеры не тронуты: пролактин 300 без единицы — прежний пересчёт', () => {
    expect(normalizeFlatLabs([{ code: 'PRL', value: 300 }]).PRL).toBe(14.2);
  });
});

describe('источник: единица применяется на обоих путях чтения', () => {
  const analysis = readFileSync(resolve(process.cwd(), 'src/engines/lab-analysis.engine.ts'), 'utf8');
  const helpers = readFileSync(resolve(process.cwd(), 'src/engines/support-plan/engine-helpers.ts'), 'utf8');

  it('интерпретация читает E2 через e2PgPerMl', () => {
    expect(analysis).toContain("if (upper === 'ESTRADIOL') return e2PgPerMl(lab.value, lab.unit);");
  });

  it('плоский список анализов читает E2 через e2PgPerMl', () => {
    expect(helpers).toContain('e2PgPerMl(l.value, l.unit)');
  });
});

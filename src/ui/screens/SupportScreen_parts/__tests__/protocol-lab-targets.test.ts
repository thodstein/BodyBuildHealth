/**
 * protocol-lab-targets.test.ts — проход 29: целевые значения в мониторинге
 * протокола «Печень» = нормы приложения (`UCUM_MAP`), а не третий набор чисел.
 *
 * Было: таблица мониторинга обещала «ЩФ <150 Ед/л» и «билирубин <21 мкмоль/л»,
 * а экран «Анализы» помечал 140 и 18 как отклонение (нормы 130 и 17.1). Женская
 * пометка называла ГГТ 32 при ULN 31 из `LAB_REFERENCES_FEMALE` и «мужские 51/54»,
 * которых в приложении нет (мужской ULN 52, ургент >54).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { UCUM_MAP } from '../../../../core/constants';

const ucum = UCUM_MAP as Record<string, { uln: number }>;
const read = (name: string) =>
  readFileSync(resolve(process.cwd(), 'src/ui/screens/SupportScreen_parts', name), 'utf8');

const hepatic = read('supportProtocolHepatic.tsx');
const hemato = read('supportProtocolHemato.tsx');

describe('протокол «Печень»: цели мониторинга = нормы приложения', () => {
  it('АЛТ/АСТ/ГГТ в целях — ULN приложения', () => {
    expect(hepatic).toContain(`АЛТ (аланинаминотрансфераза)', target:'<${ucum.ALT.uln} Ед/л'`);
    expect(hepatic).toContain(`АСТ (аспартатаминотрансфераза)', target:'<${ucum.AST.uln} Ед/л'`);
    expect(hepatic).toContain(`ГГТ (гамма-глутамилтрансфераза)', target:'<${ucum.GGT.uln} Ед/л'`);
  });

  it('ЩФ и билирубин не обещают больше нормы экрана «Анализы»', () => {
    expect(hepatic).toContain(`target:'<${ucum.ALP.uln} Ед/л'`);
    expect(hepatic).toContain(`target:'<${ucum.BIL.uln} / <5 мкмоль/л'`);
    expect(hepatic).not.toContain("target:'<150 Ед/л'");
    expect(hepatic).not.toContain("target:'<21 / <5 мкмоль/л'");
  });

  it('женская пометка называет ГГТ 31 и не выдумывает «мужские 51/54»', () => {
    expect(hepatic).toContain('ГГТ — 31');
    expect(hepatic).not.toContain('ГГТ — 32');
  });
});

describe('протокол «Гематология»: женские пороги', () => {
  it('женская пометка: норма 36–48, пороги 48/52, без выдуманных мужских 51/54', () => {
    expect(hemato).toContain('Hct 36–48%');
    expect(hemato).toContain('48% (усиленный контроль) и 52% (флеботомия)');
    expect(hemato).not.toContain('не мужские 51/54');
  });
});

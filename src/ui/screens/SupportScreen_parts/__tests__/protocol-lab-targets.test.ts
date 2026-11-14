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
import { STOP_COURSE_TABLE } from '../supportProtocolsShared';
import { FEMALE_LAB_GROUPS } from '../supportProtocolWomenData';

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

describe('стеатоз и предкурсовой чеклист: те же нормы', () => {
  const steatosis = read('supportProtocolSteatosis.tsx');
  const shared = read('supportProtocolsShared.tsx');

  it('стеатоз: АЛТ/АСТ с женским порогом, ГГТ и ЩФ по нормам приложения', () => {
    expect(steatosis).toContain('♂ <40 / ♀ <31 Ед/л');
    expect(steatosis).toContain(`ЩФ <${ucum.ALP.uln}`);
    expect(steatosis).not.toContain('ГГТ <60');
    expect(steatosis).not.toContain('ЩФ <150');
  });

  it('предкурсовой чеклист: билирубин и ЩФ по нормам приложения', () => {
    expect(shared).toContain(`билирубин', target:`);
    expect(shared).toContain(`билирубин', target:'АЛТ/АСТ <40 (♀ <31) · ГГТ <55 (♀ <31) · ЩФ <${ucum.ALP.uln} · бил <${ucum.BIL.uln} мкмоль/л'`);
    expect(shared).not.toContain('бил <21 мкмоль/л');
  });

  it('предкурсовой чеклист: пролактин = ULN экрана «Анализы», не 28 нг/мл', () => {
    expect(shared).toContain(`PRL <320 мМЕ/л (<${ucum.PRL.uln} нг/мл)`);
    expect(shared).not.toContain('<28 нг/мл');
  });
});

describe('мониторинг веществ (LAB_MONITOR_DB): те же нормы', () => {
  const unified = read('UnifiedSynergyCalculator.tsx');

  it('билирубин — 17.1, а не 21 мкмоль/л', () => {
    expect(unified).toContain(`target:'<${ucum.BIL.uln} мкмоль/л'`);
    expect(unified).not.toContain("<21 мкмоль/л'");
  });

  it('пролактин — 320 мМЕ/л (15 нг/мл), как на экране «Анализы»', () => {
    expect(unified).toContain("when:'Каждые 4 нед', target:'<320 мМЕ/л'");
    // <400 у каберголина — терапевтическая цель (не переподавить PRL), это не норма.
    expect(unified).toContain("Каберголин — мощный D2-агонист");
  });
});

describe('СТОП-таблица «отмена курса»: гормональные пороги обоих полов', () => {
  const e2Row = () => STOP_COURSE_TABLE.find((r) => /\bE2\b/.test(r.cond));

  it('E2: мужские 120/20 и женские 800/30 в одной строке', () => {
    const row = e2Row();
    expect(row).toBeTruthy();
    // Раньше строка знала только мужскую шкалу: женщина с E2 300 (норма цикла)
    // читала «AI-титрация», а с E2 700 — что всё в порядке.
    expect(row!.cond).toContain('♂');
    expect(row!.cond).toContain('♀');
    expect(row!.cond).toContain('800');
    expect(row!.cond).toContain('30');
    expect(row!.action).toContain('не обнулять');
  });

  it('женские числа строки = красная зона женского протокола E2', () => {
    const e2 = FEMALE_LAB_GROUPS.flatMap((g) => g.rows).find((r) => /Эстрадиол/.test(r.marker));
    expect(e2?.red).toBeTruthy();
    const row = e2Row()!;
    for (const n of (e2!.red || '').match(/\d+/g) ?? []) {
      expect(row.cond, `женский порог ${n}`).toContain(n);
    }
  });

  it('PRL: мужской триггер МРТ 2000 + женский 1500 из женской панели', () => {
    const row = STOP_COURSE_TABLE.find((r) => /PRL/.test(r.cond));
    expect(row).toBeTruthy();
    const prl = FEMALE_LAB_GROUPS.flatMap((g) => g.rows).find((r) => /Пролактин/.test(r.marker));
    const femaleRed = (prl?.red || '').match(/\d+/g)?.[0];
    expect(femaleRed).toBeTruthy();
    expect(row!.cond).toContain('2000');
    expect(row!.cond).toContain(`♀ >${femaleRed}`);
  });
});

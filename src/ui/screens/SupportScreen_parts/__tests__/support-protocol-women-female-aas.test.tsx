/**
 * support-protocol-women-female-aas.test.tsx — раунд «Женщины и ААС: практические схемы».
 * Проверяет: данные (дозы/поддержка/лабы/таймлайн/цели/взаимодействия/либидо/экстренно),
 * живой калькулятор Virilization Score и сохранность старых табов (регрессия).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { SupportProtocolWomen } from '../supportProtocolWomen';
import {
  FEMALE_INJECT_DOSES, FEMALE_ORAL_DOSES, FEMALE_PEPTIDE_DOSES, FEMALE_SARM_DOSES, DECA_125_NOTE,
  FEMALE_SUPPORT_PROTOCOLS, FEMALE_LAB_GROUPS, FEMALE_STOP_THRESHOLDS, FEMALE_STOP_SYMPTOMS,
  FEMALE_TIMELINE, FEMALE_GOALS, FEMALE_AGE_GROUPS, FEMALE_SAFE_COMBOS, FEMALE_DANGER_COMBOS,
  FEMALE_FORBIDDEN_COMBOS, FEMALE_LIBIDO_EFFECTS, FEMALE_EMERGENCY_CRITICAL, FEMALE_EMERGENCY_URGENT,
  FEMALE_VIRILIZATION_CALC, femaleVirilizationScore,
} from '../supportProtocolWomenData';

afterEach(cleanup);

const P = () => render(<SupportProtocolWomen s={{}} />);

describe('women-aas: данные — полнота', () => {
  it('таблицы доз: инъекционные 14, оральные 8, пептиды 11, SARMs 8', () => {
    expect(FEMALE_INJECT_DOSES.length).toBe(14);
    expect(FEMALE_ORAL_DOSES.length).toBe(8);
    expect(FEMALE_PEPTIDE_DOSES.length).toBe(11);
    expect(FEMALE_SARM_DOSES.length).toBe(8);
    for (const row of [...FEMALE_INJECT_DOSES, ...FEMALE_ORAL_DOSES, ...FEMALE_PEPTIDE_DOSES, ...FEMALE_SARM_DOSES]) {
      expect(row.name, row.name).toBeTruthy();
      expect(row.green, row.name).toBeTruthy();
      expect(row.yellow, row.name).toBeTruthy();
      expect(row.red, row.name).toBeTruthy();
      expect(row.overall, row.name).toBeTruthy();
    }
  });
  it('DHB, мастерон, инсулин, GH, IGF-1, MGF и SARMs присутствуют', () => {
    const names = [...FEMALE_INJECT_DOSES, ...FEMALE_ORAL_DOSES, ...FEMALE_PEPTIDE_DOSES, ...FEMALE_SARM_DOSES].map((x) => x.name).join(' | ');
    for (const needle of ['Дигидроболденон', 'Дростанолон', 'Инсулин', 'GH', 'IGF-1', 'MGF', 'Остарин', 'Лигандрол', 'YK-11']) {
      expect(names).toContain(needle);
    }
  });
  it('Deca 125 мг/нед честно разобран как верхняя красная граница', () => {
    expect(DECA_125_NOTE).toContain('125');
    expect(DECA_125_NOTE).toContain('красной границе');
  });
  it('протоколы поддержки: 11 штук, все с дозировками и показаниями', () => {
    expect(FEMALE_SUPPORT_PROTOCOLS.length).toBe(11);
    for (const id of ['virilization', 'hepatic', 'lipid', 'hematocrit', 'libidoLow', 'libidoHigh', 'femalePct', 'prolactin', 'glycemic', 'thyroid', 'psyche']) {
      const p = FEMALE_SUPPORT_PROTOCOLS.find((x) => x.id === id);
      expect(p, id).toBeTruthy();
      expect(p!.rows.length, id).toBeGreaterThan(0);
      for (const r of p!.rows) {
        expect(r.name, id).toBeTruthy();
        expect(r.dose, id).toBeTruthy();
        expect(r.timing, id).toBeTruthy();
      }
    }
  });
  it('support: ключевые позиции (спиронолактон, TUDCA, каберголин, финастерид-ограничение)', () => {
    const all = FEMALE_SUPPORT_PROTOCOLS.map((p) => p.rows.map((r) => r.name + ' ' + r.note).join(' ') + ' ' + (p.footer || '')).join(' ');
    expect(all).toContain('Спиронолактон');
    expect(all).toContain('TUDCA');
    expect(all).toContain('Каберголин');
    expect(all).toContain('Финастерид');
    expect(all).toContain('Витекс');
  });
  it('лабы: 9 групп, критические пороги и симптомы на месте', () => {
    expect(FEMALE_LAB_GROUPS.length).toBe(9);
    const markers = FEMALE_LAB_GROUPS.flatMap((g) => g.rows.map((r) => r.marker)).join(' | ');
    for (const m of ['Гематокрит', 'АЛТ', 'СКФ', 'ЛПВП', 'Тестостерон общий', 'Эстрадиол', 'Пролактин', 'HOMA-IR', 'ТТГ', 'Гомоцистеин']) {
      expect(markers).toContain(m);
    }
    expect(FEMALE_STOP_THRESHOLDS.length).toBe(14);
    expect(FEMALE_STOP_SYMPTOMS.length).toBe(10);
    expect(FEMALE_STOP_THRESHOLDS.map((x) => x.threshold + x.action).join(' ')).toContain('>52');
  });
  it('таймлайн 5 фаз, цели 8, возраст 5, взаимодействия/либидо/экстренно заполнены', () => {
    expect(FEMALE_TIMELINE.length).toBe(5);
    expect(FEMALE_GOALS.length).toBe(8);
    expect(FEMALE_AGE_GROUPS.length).toBe(5);
    expect(FEMALE_SAFE_COMBOS.length).toBe(8);
    expect(FEMALE_DANGER_COMBOS.length).toBe(8);
    expect(FEMALE_FORBIDDEN_COMBOS.length).toBe(6);
    expect(FEMALE_LIBIDO_EFFECTS.length).toBe(13);
    expect(FEMALE_EMERGENCY_CRITICAL.length).toBe(9);
    expect(FEMALE_EMERGENCY_URGENT.length).toBe(6);
    expect(FEMALE_VIRILIZATION_CALC.length).toBe(14);
  });
});

describe('women-aas: Virilization Score — формула', () => {
  it('Deca 50 мг/нед 8 нед: ~14 → 🟢 безопасно', () => {
    const r = femaleVirilizationScore([{ id: 'nand_deca', dose: 50 }], 8);
    expect(r.score).toBe(14);
    expect(r.band).toBe('safe');
  });
  it('Тестостерон 25 мг/нед 8 нед: 75 → 🔴 высокий риск', () => {
    const r = femaleVirilizationScore([{ id: 'test_prop', dose: 25 }], 8);
    expect(r.score).toBe(75);
    expect(r.band).toBe('high');
  });
  it('Тренболон: абсолютное противопоказание → 100 critical', () => {
    const r = femaleVirilizationScore([{ id: 'tren_ace', dose: 50 }], 8);
    expect(r.score).toBe(100);
    expect(r.band).toBe('critical');
    expect(r.recommendations.join(' ')).toContain('НЕМЕДЛЕННАЯ ОТМЕНА');
  });
  it('пустой стек → 0; возраст <25 усиливает, >45 ослабляет', () => {
    expect(femaleVirilizationScore([], 8).score).toBe(0);
    const young = femaleVirilizationScore([{ id: 'nand_deca', dose: 50 }], 8, { age: 22 });
    const mid = femaleVirilizationScore([{ id: 'nand_deca', dose: 50 }], 8, { age: 30 });
    const old = femaleVirilizationScore([{ id: 'nand_deca', dose: 50 }], 8, { age: 50 });
    expect(young.score).toBeGreaterThan(mid.score);
    expect(old.score).toBeLessThan(mid.score);
  });
  it('генетическая чувствительность и прошлые циклы повышают скор', () => {
    const base = femaleVirilizationScore([{ id: 'nand_deca', dose: 50 }], 8);
    const gen = femaleVirilizationScore([{ id: 'nand_deca', dose: 50 }], 8, { geneticSensitivity: true });
    const prev = femaleVirilizationScore([{ id: 'nand_deca', dose: 50 }], 8, { previousCycles: true });
    expect(gen.score).toBeGreaterThan(base.score);
    expect(prev.score).toBeGreaterThan(base.score);
  });
  it('неизвестное вещество игнорируется, мусорные дозы → 0', () => {
    expect(femaleVirilizationScore([{ id: 'nope', dose: 100 }], 8).score).toBe(0);
    expect(femaleVirilizationScore([{ id: 'nand_deca', dose: NaN }], 8).score).toBe(0);
    expect(femaleVirilizationScore([{ id: 'nand_deca', dose: -50 }], 8).score).toBe(0);
  });
});

describe('women-aas: UI — новые табы и калькулятор', () => {
  it('дефолт — вирилизация (регрессия), калькулятор в табе доз', () => {
    const { container, getByText } = P();
    expect(container.querySelector('.sup-proto-women')).not.toBeNull();
    expect(container.textContent).toContain('virilism-дневник');
    fireEvent.click(getByText('⚖️ Дозы веществ'));
    expect(container.querySelector('[data-vircalc="root"]')).not.toBeNull();
    expect(container.textContent).toContain('Калькулятор Virilization Score');
  });
  it('калькулятор: дефолт Deca 50/8 → 14/100; Test 25 → 75 и высокий риск', () => {
    const { container, getByText, getByLabelText } = P();
    fireEvent.click(getByText('⚖️ Дозы веществ'));
    expect(container.textContent).toContain('14 / 100');
    fireEvent.change(getByLabelText('Вещество'), { target: { value: 'test_prop' } });
    fireEvent.change(getByLabelText(/^Доза/), { target: { value: '25' } });
    expect(container.textContent).toContain('75 / 100');
    expect(container.textContent).toContain('Высокий риск');
  });
  it('калькулятор: тренболон → 100 и КРИТИЧНО; тогл чувствительности усиливает', () => {
    const { container, getByText, getByLabelText } = P();
    fireEvent.click(getByText('⚖️ Дозы веществ'));
    fireEvent.change(getByLabelText('Вещество'), { target: { value: 'tren_ace' } });
    expect(container.textContent).toContain('100 / 100');
    expect(container.textContent).toContain('КРИТИЧНО');
    fireEvent.change(getByLabelText('Вещество'), { target: { value: 'nand_deca' } });
    fireEvent.change(getByLabelText(/^Доза/), { target: { value: '50' } });
    fireEvent.click(getByText('Генет. чувствительность (акне/гирсутизм до курса)'));
    expect(container.textContent).toContain('21 / 100');
  });
  it('таб «Дозы»: DHB, мастерон, GH/IGF-1/MGF, инсулин, SARMs', () => {
    const { container, getByText } = P();
    fireEvent.click(getByText('⚖️ Дозы веществ'));
    for (const needle of ['Дигидроболденон', 'Дростанолон', 'соматропин', 'IGF-1 LR3', 'MGF', 'Инсулин быстрый', 'Остарин', 'YK-11', '125']) {
      expect(container.textContent, needle).toContain(needle);
    }
  });
  it('таб «Поддержка»: спиронолактон, TUDCA, каберголин, женский PCT', () => {
    const { container, getByText } = P();
    fireEvent.click(getByText('🧪 Поддержка'));
    for (const needle of ['Спиронолактон', 'TUDCA', 'Каберголин', 'Женское восстановление', 'Низкое либидо']) {
      expect(container.textContent, needle).toContain(needle);
    }
  });
  it('таб «Лабы»: гематокрит/ЛПВП/ЛГ и СТОП-порог >52%', () => {
    const { container, getByText } = P();
    fireEvent.click(getByText('🧬 Лабы и СТОП'));
    for (const needle of ['Гематокрит', 'ЛПВП', 'ЛГ', 'СТОП ДЛЯ ЖЕНЩИН']) {
      expect(container.textContent, needle).toContain(needle);
    }
  });
  it('таб «Либидо»: эффекты веществ + низкое/высокое', () => {
    const { container, getByText } = P();
    fireEvent.click(getByText('❤️ Либидо'));
    for (const needle of ['Эффекты веществ', 'Станозолол', 'Тренболон', 'Низкое либидо', 'Высокое либидо']) {
      expect(container.textContent, needle).toContain(needle);
    }
  });
  it('таб «Таймлайн»: 5 фаз + запись голоса и контрацепция', () => {
    const { container, getByText } = P();
    fireEvent.click(getByText('🗓 Таймлайн цикла'));
    for (const needle of ['Фаза 0', 'Фаза 4', 'запись голоса', 'Контрацепция']) {
      expect(container.textContent, needle).toContain(needle);
    }
  });
  it('таб «Цели и возраст»: бикини + возрастные группы', () => {
    const { container, getByText } = P();
    fireEvent.click(getByText('🏆 Цели и возраст'));
    for (const needle of ['Бикини', 'Women', 'Бег', '18–25 лет', '55+']) {
      expect(container.textContent, needle).toContain(needle);
    }
  });
  it('таб «Взаимодействия»: запрещённые комбинации и трен-бан', () => {
    const { container, getByText } = P();
    fireEvent.click(getByText('⚡ Взаимодействия'));
    for (const needle of ['Практичные сочетания', 'ЗАПРЕЩЁННЫЕ КОМБИНАЦИИ', 'АБСОЛЮТНОЕ ПРОТИВОПОКАЗАНИЕ']) {
      expect(container.textContent, needle).toContain(needle);
    }
  });
  it('таб «Экстренно»: критические и срочные', () => {
    const { container, getByText } = P();
    fireEvent.click(getByText('🚑 Экстренно'));
    for (const needle of ['НЕМЕДЛЕННАЯ ОТМЕНА', 'Срочно (24–48 ч)', 'Критические симптомы']) {
      expect(container.textContent, needle).toContain(needle);
    }
  });
  it('старые табы целы: препараты и контрацепция', () => {
    const { container, getByText } = P();
    fireEvent.click(getByText('💊 Препараты'));
    expect(container.textContent).toContain('Гестринон');
    expect(container.textContent).toContain('Финастерид / дутастерид');
    fireEvent.click(getByText('💊 Контрацепция'));
    expect(container.textContent).toContain('ВМС');
    fireEvent.click(getByText('🔬 Пороги гормонов'));
    expect(container.textContent).toContain('DHT');
  });
});

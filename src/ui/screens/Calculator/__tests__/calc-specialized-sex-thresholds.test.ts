/**
 * calc-specialized-sex-thresholds.test.ts — проход 28: триггеры системных
 * попапов считают пороги по полу, а не мужским литералом.
 *
 * Дефект: `SPECIALIZED_DOMAINS` держал пятую копию порогов — HCT>48, АЛТ/АСТ>40,
 * ГГТ>55, ЩФ>120, билирубин>21, креатинин>105, E2>40. Для женщины это значило:
 *  - АЛТ 35 (женский ULN 31) не включает «Цитолиз»;
 *  - HCT 45 (женский ULN 48) не включает «Эндотелий/тромбоз»;
 *  - креатинин 100 (женский ULN 97) не включает «Фильтрацию»;
 *  - E2 60 (нормальная фолликулярная фаза) включает мужской AI-триггер.
 * При этом на экране «Анализы» те же значения уже помечены как отклонение.
 *
 * Мужской путь сохранён: HCT-коррекция 48, АЛТ/АСТ 40, ГГТ 55 — те же числа.
 */
import { describe, it, expect } from 'vitest';
import { SPECIALIZED_DOMAINS } from '../Calc.mapper';

const trigger = (system: string, id: string, labs: Record<string, number>, sex: 'male' | 'female') => {
  const d = SPECIALIZED_DOMAINS[system].find((x) => x.id === id)!;
  expect(d, `${system}/${id}`).toBeTruthy();
  return d.trigger!({ ...labs }, { profile: { sex } } as never);
};

describe('системные триггеры: пороги по полу', () => {
  it('эндотелий/тромбоз: ♂ коррекция 48, ♀ 44', () => {
    expect(trigger('cardio', 'endothelium', { HCT: 49 }, 'male')).toBe(true);
    expect(trigger('cardio', 'endothelium', { HCT: 47 }, 'male')).toBe(false);
    expect(trigger('cardio', 'endothelium', { HCT: 45 }, 'female')).toBe(true);
    expect(trigger('cardio', 'endothelium', { HCT: 43 }, 'female')).toBe(false);
  });

  it('цитолиз: у женщины АЛТ 35 — уже отклонение, у мужчины — норма', () => {
    expect(trigger('hepatic', 'cytolysis', { ALT: 35 }, 'female')).toBe(true);
    expect(trigger('hepatic', 'cytolysis', { ALT: 35 }, 'male')).toBe(false);
    expect(trigger('hepatic', 'cytolysis', { ALT: 45 }, 'male')).toBe(true);
    expect(trigger('hepatic', 'cytolysis', { AST: 33 }, 'female')).toBe(true);
  });

  it('холестаз: ГГТ ♀ 31 / ♂ 55, билирубин — общий предел 17.1', () => {
    expect(trigger('hepatic', 'cholestasis', { GGT: 35 }, 'female')).toBe(true);
    expect(trigger('hepatic', 'cholestasis', { GGT: 35 }, 'male')).toBe(false);
    expect(trigger('hepatic', 'cholestasis', { GGT: 60 }, 'male')).toBe(true);
    expect(trigger('hepatic', 'cholestasis', { BILIRUBIN: 18 }, 'male')).toBe(true);
    expect(trigger('hepatic', 'cholestasis', { BILIRUBIN: 16 }, 'male')).toBe(false);
  });

  it('фильтрация: креатинин ♀ 97 / ♂ 110', () => {
    expect(trigger('renal', 'filtration', { CREATININE: 100 }, 'female')).toBe(true);
    expect(trigger('renal', 'filtration', { CREATININE: 100 }, 'male')).toBe(false);
    expect(trigger('renal', 'filtration', { CREATININE: 115 }, 'male')).toBe(true);
  });

  it('E2>40 — мужской AI-триггер, у женщины не срабатывает', () => {
    expect(trigger('endocrine', 'e2', { E2: 60 }, 'male')).toBe(true);
    expect(trigger('endocrine', 'e2', { E2: 60 }, 'female')).toBe(false);
    expect(trigger('endocrine', 'e2', { E2: 30 }, 'male')).toBe(false);
  });

  it('клинические пороги без полового разделения не тронуты', () => {
    expect(trigger('endocrine', 'prl', { PRL: 30 }, 'male')).toBe(true);
    expect(trigger('endocrine', 'prl', { PRL: 20 }, 'female')).toBe(false);
    expect(trigger('metabolic', 'glucose', { GLU: 6.0 }, 'female')).toBe(true);
  });
});

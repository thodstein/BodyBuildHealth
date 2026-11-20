/**
 * lab-unit-incommensurable.test.ts — проход 178: единица анализа — часть данных.
 *
 * `interpretLabs` приводит число к единице приложения через `convertToUnit`.
 * Когда коэффициент вещества неизвестен (инсулин «пмоль/л» против «мкЕд/мл»,
 * АпоB «ммоль/л» против «г/л»), пересчёт возвращал `null`, и число шло в
 * сравнение со шкалой КАК ЕСТЬ: 60 пмоль/л инсулина читались как 60 мкЕд/мл —
 * «критически высоко» из сопоставления двух разных величин. АпоB в ммоль/л
 * точно так же превращался в г/л.
 *
 * Теперь такой записи нет для вывода: это «нормы в этой единице нет», а не
 * отклонение. Граница поведения — пустая единица: без единицы анализ по-прежнему
 * читается в единице приложения (пометка «единица не указана»), иначе быстрый
 * ввод в настройках (число без единицы) перестал считаться вовсе.
 *
 * `interpretLabs` печатает только отклонения: значение внутри нормы строки не
 * создаёт. Поэтому «прежний путь чтения» проверяется отклонением в правильную
 * сторону, а не отсутствием строки.
 */
import { describe, it, expect } from 'vitest';
import { interpretLabs } from '../lab-analysis.engine';
import type { LabPoint } from '../../core/types';

function point(code: string, value: number, unit?: string): LabPoint {
  return { id: code + value + (unit || ''), code, name: code, value, unit, date: '2026-01-01' } as LabPoint;
}

const find = (code: string, value: number, unit?: string) =>
  interpretLabs([point(code, value, unit)]).interpretations.find((i) => i.code === code.toUpperCase());

describe('проход 178: число в чужой величине не сравнивается со шкалой', () => {
  it('инсулин 60 пмоль/л — записи нет (было «критически высоко» против мкЕд/мл)', () => {
    expect(find('INSULIN', 60, 'пмоль/л')).toBeUndefined();
  });

  it('инсулин 60 пмоль/л не даёт HOMA-IR', () => {
    const r = interpretLabs([point('GLUCOSE', 5.2, 'ммоль/л'), point('INSULIN', 60, 'пмоль/л')]);
    expect(r.homaIR).toBeNull();
  });

  it('инсулин 12 мкЕд/мл — по-прежнему выше нормы (10)', () => {
    expect(find('INSULIN', 12, 'мкЕд/мл')?.status).toBe('high');
  });

  it('инсулин 12 без единицы — прежний путь (единица приложения)', () => {
    expect(find('INSULIN', 12)?.status).toBe('high');
  });

  it('АпоB 1.2 ммоль/л — записи нет; 120 мг/дл = 1.2 г/л — выше нормы', () => {
    expect(find('APOB', 1.2, 'ммоль/л')).toBeUndefined();
    expect(find('APOB', 120, 'мг/дл')?.status).toBe('high');
  });

  it('пересчитываемые единицы — прежний путь чтения', () => {
    // 2000 нг/дл тестостерона = ~69 нмоль/л при верхней 35.
    expect(find('TESTOSTERONE_TOTAL', 2000, 'нг/дл')?.status).toBe('critical_high');
    // 3.0 мг/дл креатинина = 265 мкмоль/л при верхней 110.
    expect(find('CREATININE', 3.0, 'мг/дл')?.status).toBe('critical_high');
    // 40 нг/мл пролактина = 848 мЕд/л при критической 500.
    expect(find('PROLACTIN', 40, 'нг/мл')?.status).toBe('critical_high');
    // Калий — та же величина: ммоль/л как есть.
    expect(find('POTASSIUM', 6.5, 'ммоль/л')?.status).toBe('critical_high');
  });
});

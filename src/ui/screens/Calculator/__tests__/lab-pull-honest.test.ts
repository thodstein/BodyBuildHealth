/**
 * lab-pull-honest.test.ts — проход 151: мост «склад анализов → форма» берёт
 * свежую запись маркера, а не последнюю строку базы.
 *
 * Было:
 * — `labPointsToSlice` перебирал `labs_log` в порядке выдачи базы, и последняя
 *   строка перекрывала все предыдущие. Анализ, введённый вчера за прошлый месяц,
 *   «побеждал» свежий бланк: форма считала риск по старому числу;
 * — дата среза бралась у первой строки массива, поэтому смешанный бланк
 *   подписывался старой датой, а `currentLabSlice` сравнивал бланки по ней;
 * — архивные записи (удалённые из Лаборатории) возвращались в форму, и удалённый
 *   анализ продолжал считать риск;
 * — «Анализы загружены (12)» считало строки базы, а не распознанные маркеры.
 */
import { describe, it, expect } from 'vitest';
import { labPointsToSlice, latestLabPoints, countSliceMarkers } from '../Calc.labs-derived';

const row = (code: string, value: any, date?: string, extra: Record<string, unknown> = {}) => ({
  id: `${code}-${String(value)}-${date || ''}`,
  code,
  name: code,
  value,
  unit: '',
  ...(date ? { date } : {}),
  ...extra,
});

describe('проход 151: у маркера побеждает дата, а не порядок хранения', () => {
  it('старая запись, введённая позже, не перекрывает свежий бланк', () => {
    const slice = labPointsToSlice([
      row('ALT', 20, '2026-01-10'),
      row('ALT', 180, '2026-09-20'),
      row('ALT', 30, '2025-06-01'),
    ])!;
    expect(slice.panelBiochem!.ALT).toBe('180');
  });

  it('дата среза — самая поздняя из прочитанных, а не первая строка', () => {
    const slice = labPointsToSlice([
      row('ALT', 20, '2026-01-10'),
      row('GLU', 5.1, '2026-09-20'),
    ])!;
    expect(slice.date).toBe('2026-09-20');
  });

  it('запись без даты считается самой старой', () => {
    const slice = labPointsToSlice([row('ALT', 20), row('ALT', 55, '2026-03-01')])!;
    expect(slice.panelBiochem!.ALT).toBe('55');
  });

  it('`GLU` и `Glucose` — один маркер, даты сравниваются', () => {
    const slice = labPointsToSlice([
      row('GLU', 6.5, '2026-05-01'),
      row('Glucose', 4.9, '2026-09-01'),
    ])!;
    expect(slice.panelBiochem!.Glucose).toBe('4.9');
    // Второго поля «глюкоза» не появилось: это тот же анализ.
    expect(Object.keys(slice.panelBiochem!).filter((k) => k === 'Glucose')).toHaveLength(1);
  });

  it('архивная запись не воскресает в форме', () => {
    expect(labPointsToSlice([row('CRP', 5, '2026-09-01', { archived: true })])).toBeNull();
    const slice = labPointsToSlice([
      row('CRP', 5, '2026-09-01', { archived: true }),
      row('CRP', 2, '2026-08-01'),
    ])!;
    // Свежая, но удалённая запись не побеждает живую.
    expect(slice.panelBiochem!.CRP).toBe('2');
  });

  it('строка без значения не считается записью', () => {
    const kept = latestLabPoints([row('ALT', '', '2026-09-01'), row('ALT', 25, '2026-01-01')]);
    expect(kept).toHaveLength(1);
    expect(kept[0].value).toBe(25);
  });
});

describe('проход 151: «загружено (N)» — распознанные маркеры, а не строки базы', () => {
  it('считаются только маркеры, легшие в форму', () => {
    const slice = labPointsToSlice([
      row('ALT', 30, '2026-09-01'),
      row('НЕИЗВЕСТНО', 1, '2026-09-01'),
      row('CRP', 2, '2026-09-01'),
    ])!;
    expect(countSliceMarkers(slice)).toBe(2);
    expect(countSliceMarkers(null)).toBe(0);
  });

  it('единица в срезе не считается маркером', () => {
    const slice = labPointsToSlice([row('PRL', 15, '2026-09-01', { unit: 'ng/mL' })])!;
    expect(slice.units?.panelSex?.Prolactin).toBe('нг/мл');
    expect(countSliceMarkers(slice)).toBe(1);
  });
});

/**
 * problem-panels-sex.test.ts — проход 80: сценарий одного пола не показывается
 * другому.
 *
 * Было: панели «По проблеме» отдавались всем подряд. Женщина видела
 * «Грудь болит / гинекомастия» с целями `E2 20-35 пг/мл` и `прогестерон <0.8`,
 * «Гормональный паспорт» с `TT >400 нг/дл`, ингибином Б и АМГ по клеткам
 * Сертоли, «Спермограмма 0» и «Не восстанавливается ось после ПКТ». Цели там
 * мужские — печатать их женщине это тот же класс ошибки, что мужская норма E2 в
 * строке результата (проход 78), только крупнее: целый сценарий.
 *
 * Контракт: панель с `sex` видна только своему полу; нейтральная — всем; пол
 * неизвестен — показываем всё (скрыть полезное хуже, чем показать лишнее, но
 * чужие цели печатать нельзя).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROBLEM_PANELS, panelsForSex, isPanelForSex } from '../labs-problem-panels';

/** Мужские сценарии — список закрыт: новая панель обязана пройти триаж. */
const MALE_ONLY = [
  'ed_libido_workup',
  'fertility_extended',
  'gynecomastia_workup',
  'hormone_passport',
  'hpta_recovery_fail',
];

const ids = (sex?: 'male' | 'female') => panelsForSex(sex).map((p) => p.id);
const malePanel = () => PROBLEM_PANELS.find((p) => p.sex === 'male')!;

/** Женские сценарии — тоже закрытый список. */
const FEMALE_ONLY = ['female_fertility_workup', 'female_hormone_passport', 'female_libido_workup'];

describe('панели «По проблеме» и пол', () => {
  it('сценарии одного пола размечены ровно эти', () => {
    expect(PROBLEM_PANELS.filter((p) => p.sex === 'male').map((p) => p.id).sort()).toEqual(MALE_ONLY);
    expect(PROBLEM_PANELS.filter((p) => p.sex === 'female').map((p) => p.id).sort()).toEqual(FEMALE_ONLY);
  });

  it('женщина не видит мужских сценариев, но видит нейтральные и свой паспорт', () => {
    const fem = ids('female');
    for (const id of MALE_ONLY) expect(fem).not.toContain(id);
    for (const id of ['cardio_full', 'hepatotoxicity_workup', 'polycythemia_workup', 'renal_workup', 'nutritional_passport']) {
      expect(fem).toContain(id);
    }
    expect(fem).toContain('female_hormone_passport');
  });

  it('мужчина видит все сценарии, кроме женского паспорта', () => {
    const male = ids('male');
    expect(male).toHaveLength(PROBLEM_PANELS.length - FEMALE_ONLY.length);
    for (const id of MALE_ONLY) expect(male).toContain(id);
    for (const id of FEMALE_ONLY) expect(male).not.toContain(id);
  });

  it('пол неизвестен — показываем всё, а не гадаем', () => {
    expect(ids(undefined)).toHaveLength(PROBLEM_PANELS.length);
    expect(isPanelForSex(malePanel(), undefined)).toBe(true);
    expect(isPanelForSex(malePanel(), 'female')).toBe(false);
    expect(isPanelForSex(malePanel(), 'male')).toBe(true);
  });

  it('гематокритная панель остаётся общей: в заголовке оба порога', () => {
    const p = PROBLEM_PANELS.find((x) => x.id === 'polycythemia_workup')!;
    expect(p.sex).toBeUndefined();
    expect(p.title).toContain('♀');
  });
});

describe('женский гормональный паспорт', () => {
  const panel = () => PROBLEM_PANELS.find((x) => x.id === 'female_hormone_passport')!;
  const target = (code: string) => panel().markers.find((m) => m.code === code)?.target || '';

  it('цели фазовые: E2, ЛГ, ФСГ и прогестерон — коридорами, а не одним числом', () => {
    expect(panel().sex).toBe('female');
    expect(target('E2')).toContain('по фазе');
    expect(target('E2')).toContain('200');
    expect(target('E2')).toContain('500');
    expect(target('PROG')).toContain('0.1');
    expect(target('PROG')).toContain('5–20');
    expect(target('LH')).toContain('по фазе');
    expect(target('FSH')).toContain('по фазе');
  });

  it('тестостерон — женский 0.3–2.5, без мужских 400 нг/дл', () => {
    expect(target('TT')).toContain('0.3');
    expect(target('TT')).toContain('2.5');
    expect(target('TT')).not.toContain('400');
  });

  it('фаза замера названа: 2–5 день цикла и середина лютеиновой', () => {
    expect(panel().clinicalNotes).toContain('2–5 день цикла');
    expect(panel().clinicalNotes).toContain('за 7 дней до');
  });
});

describe('женские сценарии либидо и фертильности', () => {
  const panel = (id: string) => PROBLEM_PANELS.find((x) => x.id === id)!;
  const target = (id: string, code: string) => panel(id).markers.find((m) => m.code === code)?.target || '';

  it('либидо: тестостерон женский, мужских 400 нг/дл нет', () => {
    expect(panel('female_libido_workup').sex).toBe('female');
    expect(target('female_libido_workup', 'TT')).toContain('0.3');
    expect(target('female_libido_workup', 'TT')).not.toContain('400');
  });

  it('либидо не сводится к тестостерону: пролактин, ТТГ, ферритин, прогестерон', () => {
    const codes = panel('female_libido_workup').markers.map((m) => m.code);
    for (const c of ['PRL', 'TSH', 'FT4', 'FERRITIN', 'PROG', 'SHBG']) expect(codes).toContain(c);
    expect(panel('female_libido_workup').clinicalNotes).toContain('КОК');
  });

  it('фертильность: овуляцию подтверждает прогестерон лютеиновой, день цикла назван', () => {
    expect(panel('female_fertility_workup').sex).toBe('female');
    expect(target('female_fertility_workup', 'PROG')).toContain('5');
    expect(target('female_fertility_workup', 'PROG')).toContain('20');
    expect(panel('female_fertility_workup').clinicalNotes).toContain('2–5 день');
    expect(panel('female_fertility_workup').clinicalNotes).toContain('за 7 дней до');
  });

  it('фертильность: спермограмма — про пару, а не мужская цель женщине', () => {
    const notes = panel('female_fertility_workup').clinicalNotes;
    expect(notes).toContain('спермограмма');
    expect(notes).toContain('Партнёру');
  });
});

describe('проводка пола в экран «Лаборатории»', () => {
  const tab = readFileSync(resolve(process.cwd(), 'src/ui/screens/LabsScreen_parts/LabsProblemPanelsTab.tsx'), 'utf8');
  const screen = readFileSync(resolve(process.cwd(), 'src/ui/screens/LabsScreen.tsx'), 'utf8');

  it('таб берёт панели через panelsForSex, а не PROBLEM_PANELS напрямую', () => {
    expect(tab).toContain('panelsForSex(sex)');
    expect(tab).not.toContain('useMemo(() => PROBLEM_PANELS');
  });

  it('поиск по симптому отбрасывает невидимые панели', () => {
    expect(tab).toContain('.filter(id => visible.has(id))');
  });

  it('экран передаёт пол в таб и не выдумывает его при пустом профиле', () => {
    expect(screen).toContain("profileSex === 'male' || profileSex === 'female' ? profileSex : undefined");
  });
});

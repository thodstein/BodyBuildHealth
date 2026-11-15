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

describe('панели «По проблеме» и пол', () => {
  it('мужские сценарии размечены ровно эти', () => {
    expect(PROBLEM_PANELS.filter((p) => p.sex === 'male').map((p) => p.id).sort()).toEqual(MALE_ONLY);
    expect(PROBLEM_PANELS.filter((p) => p.sex === 'female')).toHaveLength(0);
  });

  it('женщина не видит мужских сценариев, но видит нейтральные', () => {
    const fem = ids('female');
    for (const id of MALE_ONLY) expect(fem).not.toContain(id);
    for (const id of ['cardio_full', 'hepatotoxicity_workup', 'polycythemia_workup', 'renal_workup', 'nutritional_passport']) {
      expect(fem).toContain(id);
    }
  });

  it('мужчина видит все сценарии', () => {
    expect(ids('male')).toHaveLength(PROBLEM_PANELS.length);
    for (const id of MALE_ONLY) expect(ids('male')).toContain(id);
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

/**
 * symptom-lab-link-sex.test.ts — проход 74: ВГН симптом-лабораторной подсветки
 * зависят от пола.
 *
 * Было: `LAB_NORMS` держал одну мужскую таблицу (АЛТ 40, ГГТ 55, креатинин 110,
 * HGB 170, HCT 50) и сравнивал с ней всех. Женщина с АЛТ 35 читала «АЛТ 35
 * (норма 40)», хотя её ВГН — 31, то есть реальное отклонение не подсвечивалось.
 *
 * Контракт: без `sex` путь прежний (мужская запись байт-в-байт), с `female` —
 * женские границы из резолвера; общая поверхность (без sex) называет оба пола.
 */
import { describe, it, expect } from 'vitest';
import { linkSymptomsToLabs } from '../symptom-lab-link';
import { FEMALE_LAB_BOUNDS } from '../lab-norms.engine';

describe('symptom-lab-link: ВГН по полу', () => {
  it('АЛТ 35: мужчина — норма, женщина — отклонение (её ВГН 31)', () => {
    expect(linkSymptomsToLabs({ ALT: 35 }, ['liver_pain'], 'male').linked).toHaveLength(0);

    const female = linkSymptomsToLabs({ ALT: 35 }, ['liver_pain'], 'female');
    expect(female.linked).toHaveLength(1);
    expect(female.linked[0].explanation).toContain('♀');
    expect(female.alerts[0]).toContain(`♀ ${FEMALE_LAB_BOUNDS.ALT.lln}–${FEMALE_LAB_BOUNDS.ALT.uln}`);
  });

  it('без sex — прежняя мужская запись (35 не отклонение)', () => {
    expect(linkSymptomsToLabs({ ALT: 35 }, ['liver_pain']).linked).toHaveLength(0);
  });

  it('общая поверхность (без sex) называет оба пола', () => {
    const r = linkSymptomsToLabs({ ALT: 60 }, ['liver_pain']);
    expect(r.linked).toHaveLength(1);
    expect(r.alerts[0]).toContain(`♂ 0–40 / ♀ ${FEMALE_LAB_BOUNDS.ALT.lln}–${FEMALE_LAB_BOUNDS.ALT.uln}`);
  });

  it('HCT 49: у женщины выше нормы (48), у мужчины — нет (52)', () => {
    expect(linkSymptomsToLabs({ HEMATOCRIT: 49 }, ['flushed_skin'], 'male').linked).toHaveLength(0);
    expect(linkSymptomsToLabs({ HEMATOCRIT: 49 }, ['flushed_skin'], 'female').linked).toHaveLength(1);
  });

  it('креатинин 105: у мужчины норма (110), у женщины — нет (97)', () => {
    expect(linkSymptomsToLabs({ CREATININE: 105 }, ['lower_back_pain'], 'male').linked).toHaveLength(0);
    const female = linkSymptomsToLabs({ CREATININE: 105 }, ['lower_back_pain'], 'female');
    expect(female.linked).toHaveLength(1);
    expect(female.alerts[0]).toContain(`♀ ${FEMALE_LAB_BOUNDS.CREATININE.lln}–${FEMALE_LAB_BOUNDS.CREATININE.uln}`);
  });

  it('пол-нейтральные маркеры не получают ♀-подписи', () => {
    const r = linkSymptomsToLabs({ TROPONIN: 0.2 }, ['chest_pain'], 'female');
    expect(r.alerts[0]).toContain('(норма 0–0.04)');
    expect(r.alerts[0]).not.toContain('♀');
  });
});

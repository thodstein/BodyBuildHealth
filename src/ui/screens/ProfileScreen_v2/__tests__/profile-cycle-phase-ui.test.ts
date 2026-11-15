/**
 * profile-cycle-phase-ui.test.ts — проход 77: дата цикла не только читается, но
 * и вводится, а фаза доходит до поверхностей.
 *
 * До прохода `settings.lifestyle.lastPeriodStart` читали кардио-автотюн и
 * пик-неделя, но записать её было негде: поле в кардио-попапе жило только в
 * состоянии компонента, поэтому фазовая модель всегда получала `null`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cycleState } from '../../../../engines/female-cycle-phase.engine';

const src = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('ввод даты цикла и её доставка до UI', () => {
  it('секция «1.4 Образ жизни» даёт женщине поля даты и длины цикла', () => {
    const s = src('src/ui/screens/ProfileScreen_v2/sections/UserLifestyleSection.tsx');
    expect(s).toContain('Последняя менструация');
    expect(s).toContain('Длина цикла');
    expect(s).toContain('lastPeriodStart');
    expect(s).toContain('cycleLengthDays');
    // Фаза считается на месте — женщина видит, что поле работает.
    expect(s).toContain('cycleState');
    expect(s).toContain('personal?.sex === \'female\'');
  });

  it('кардио-коррекция по циклу сохраняет ту же дату в профиль', () => {
    const s = src('src/ui/screens/TrainingScreen_parts/CardioAutoTunePanel.tsx');
    expect(s).toContain("updateSection('lifestyle'");
    expect(s).toContain('lastPeriodStart: periodStart');
    expect(s).toContain('cycleLengthDays: len');
  });

  it('отчёт печатает фазу в шапке, а не только считает её', () => {
    const screen = src('src/ui/screens/ReportsScreen.tsx');
    expect(screen).toContain('meta.cyclePhase');
    expect(screen).toContain('Цикл:');
  });

  it('фаза из сохранённой даты совпадает с тем, что напечатает UI', () => {
    const s = cycleState({ sex: 'female', lastPeriodStart: '2026-10-30', cycleLengthDays: 28 }, '2026-11-14');
    expect(s?.label).toBe('Лютеиновая');
    expect(`Сейчас: ${s?.label.toLowerCase()} фаза, ${s?.cycleDay}-й день из ${s?.cycleLength}`)
      .toBe('Сейчас: лютеиновая фаза, 16-й день из 28');
  });

  it('без пола/даты секция молчит — фазовой строки нет', () => {
    expect(cycleState({ sex: 'male', lastPeriodStart: '2026-10-30' }, '2026-11-14')).toBeNull();
    expect(cycleState({ sex: 'female' }, '2026-11-14')).toBeNull();
  });
});

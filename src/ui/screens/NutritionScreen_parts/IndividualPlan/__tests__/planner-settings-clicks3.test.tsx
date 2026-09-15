/**
 * planner-settings-clicks3.test.tsx — батч 3: попапы/селекты/тоглы/времена.
 * Клик → состояние/персист (быстро, без генерации).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { IndividualPlan } from '../index';

const seedBase = () => {
  try {
    localStorage.setItem('he_planner_mode', 'pro');
    localStorage.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 85, height: 180, age: 30, sex: 'male', bodyFat: 18 },
        training: { primaryGoal: 'mass' },
        pharma: { phase: 'course' },
        nutrition: {},
      },
    }));
  } catch {}
};
const boot = () => {
  render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
};
const allButtons = () => Array.from(document.querySelectorAll('button'));
const btns = (re: RegExp) => allButtons().filter((b) => re.test(b.textContent || ''));
const clickBtn = (re: RegExp) => {
  const found = btns(re);
  if (found.length === 0) throw new Error(`button not found: ${re}`);
  fireEvent.click(found[found.length - 1]);
};
const allDivs = () => Array.from(document.querySelectorAll('div'));
// Самый глубокий div, содержащий label и button (строка-тогл).
const deepestRowDiv = (labelRe: RegExp, needButton: boolean) =>
  allDivs().filter((d) => labelRe.test(d.textContent || '') && (!needButton || d.querySelector('button'))).pop();
// PopupNumber: открыть карточку → ввести → OK → вернуть текст карточки.
const setPopupNumber = (labelRe: RegExp, value: string): string => {
  const card = btns(labelRe);
  if (card.length === 0) throw new Error(`popup card not found: ${labelRe}`);
  fireEvent.click(card[0]);
  const num = document.querySelector('input[type="number"]') as HTMLInputElement | null;
  if (!num) throw new Error('number input did not open');
  fireEvent.change(num, { target: { value } });
  const ok = allButtons().find((b) => (b.textContent || '').trim() === 'OK');
  if (!ok) throw new Error('OK button not found');
  fireEvent.click(ok);
  return btns(labelRe)[0]?.textContent || '';
};
// PopupSelect: открыть → выбрать опцию, отличную от текущей (только новые кнопки оверлея) → текст карточки.
const chooseOtherPopupSelect = (labelRe: RegExp): { before: string; after: string } => {
  const card = btns(labelRe);
  if (card.length === 0) throw new Error(`select card not found: ${labelRe}`);
  const before = card[0].textContent || '';
  const oldSet = new Set(allButtons());
  fireEvent.click(card[0]);
  const fresh = allButtons().filter((b) => !oldSet.has(b));
  const pick = fresh.find((b) => {
    const t = (b.textContent || '').replace(/ ✓$/, '').trim();
    return t.length > 0 && !before.includes(t);
  });
  if (!pick) throw new Error(`no alternative option for: ${labelRe} (fresh=${fresh.length})`);
  fireEvent.click(pick);
  return { before, after: btns(labelRe)[0]?.textContent || '' };
};
// Кастомный pickerBtn/pickerModal (div-based): открыть и выбрать вариант по тексту опции.
const pickFromPicker = (labelRe: RegExp, optionText: string): string => {
  const opener = deepestRowDiv(labelRe, false);
  if (!opener) throw new Error(`picker opener not found: ${labelRe}`);
  fireEvent.click(opener);
  // опция модалки: короткий div с маркером ○/✓ + меткой (не описание под пикером)
  const opt = allDivs().filter((d) => {
    const t = (d.textContent || '').trim();
    return /^[○✓]/.test(t) && t.includes(optionText) && t.length < optionText.length + 3;
  }).pop();
  if (!opt) throw new Error(`picker option not found: ${optionText}`);
  fireEvent.click(opt);
  // после выбора пикер показывает выбранную метку + ▼
  const shown = allDivs().filter((d) => {
    const t = (d.textContent || '').trim();
    return t.includes(optionText) && t.endsWith('▼');
  }).pop();
  return shown?.textContent || '';
};

describe('Кнопки настроек: клик → состояние (батч 3: попапы и тоглы)', () => {
  beforeEach(() => {
    cleanup();
    try { localStorage.clear(); } catch {}
    seedBase();
  });
  afterEach(() => cleanup());

  it('user-карточка: вес/рост/возраст меняют отображаемое значение', () => {
    boot();
    expect(setPopupNumber(/Вес \(кг\)/, '90')).toMatch(/90/);
    expect(setPopupNumber(/Рост \(см\)/, '185')).toMatch(/185/);
    expect(setPopupNumber(/Возраст/, '35')).toMatch(/35/);
  });

  it('sex: Женский выбирается и виден в карточке', () => {
    boot();
    const { after } = chooseOtherPopupSelect(/Пол/);
    expect(after).toMatch(/Женский/);
  });

  it('шаги/готовка/жир/сон/стресс: значения применяются', () => {
    boot();
    expect(setPopupNumber(/Шагов\/день/, '12000')).toMatch(/12000/);
    expect(setPopupNumber(/Время на готовку/, '45')).toMatch(/45/);
    expect(setPopupNumber(/% жира/, '20')).toMatch(/20/);
    expect(setPopupNumber(/Сон \(часы\)/, '8')).toMatch(/8/);
    expect(setPopupNumber(/Стресс/, '7')).toMatch(/7/);
  });

  it('навык/частота готовки, тип/интенсивность, активность: опции переключаются', () => {
    boot();
    const checks: RegExp[] = [/Навык готовки/, /Частота готовки/, /Тип тренировок/, /Интенсивность/, /Быт. активность/];
    for (const re of checks) {
      const { before, after } = chooseOtherPopupSelect(re);
      expect(after, `select ${re} должно измениться`).not.toBe(before);
    }
  });

  it('workFood: портативный вариант выбирается (div-picker)', () => {
    boot();
    const after = pickFromPicker(/Любая \(можно разогреть\)/, 'Только порошок/хлопья/протеин');
    expect(after).toMatch(/Только порошок/);
  });

  it('времена: обед меняется', () => {
    boot();
    const { before, after } = chooseOtherPopupSelect(/Обед/);
    expect(after).not.toBe(before);
  });

  it('bbCategory: выбор категории виден в карточке', () => {
    boot();
    const { before, after } = chooseOtherPopupSelect(/Категория шоу/);
    expect(after).not.toBe(before);
  });

  it('nightCarbs: 20 активируется', () => {
    boot();
    clickBtn(/^20$/);
    expect(btns(/^20$/)[0].style.border).toMatch(/99, 102, 241/);
  });

  it('утро/вечер: взаимоисключение работает в обе стороны', () => {
    boot();
    clickBtn(/Загрузка под утреннюю тренировку/);
    expect(document.body.textContent || '').toMatch(/Загрузка под утреннюю тренировку: ВКЛ/);
    // включаем вечерний knob → утро гаснет
    const row = deepestRowDiv(/Вечер — минимум углеводов/, true);
    expect(row).toBeTruthy();
    fireEvent.click(row!.querySelector('button')!);
    expect(document.body.textContent || '').toMatch(/Загрузка под утреннюю тренировку: ВЫКЛ/);
  });

  it('diaryAdaptation: knob-тогл меняет и персистит he_diary_adaptation', () => {
    boot();
    const before = localStorage.getItem('he_diary_adaptation');
    const row = deepestRowDiv(/Компенсация по дневнику/, true);
    expect(row).toBeTruthy();
    fireEvent.click(row!.querySelector('button')!);
    expect(localStorage.getItem('he_diary_adaptation')).not.toBe(before);
  });

  it('v2Phase: Пик пишет PEAK_WEEK', () => {
    boot();
    clickBtn(/Пик/);
    expect(localStorage.getItem('he_planner_v2_phase')).toBe('PEAK_WEEK');
  });

  it('v2Pharma: чип тоглится в he_planner_pharma', () => {
    boot();
    clickBtn(/Инсулин/);
    const after1 = JSON.parse(localStorage.getItem('he_planner_pharma') || '{}');
    expect(Object.values(after1).some((v) => v === true)).toBe(true);
    clickBtn(/Инсулин/);
    const after2 = JSON.parse(localStorage.getItem('he_planner_pharma') || '{}');
    expect(Object.values(after2).some((v) => v === true)).toBe(false);
  });

  it('вкусы: слайдер меняет значение', () => {
    boot();
    const range = Array.from(document.querySelectorAll('input[type="range"]')).find((r) =>
      /Острое/.test(r.parentElement?.parentElement?.textContent || ''));
    expect(range).toBeTruthy();
    fireEvent.change(range!, { target: { value: '3' } });
    expect(range!.parentElement?.parentElement?.textContent || '').toMatch(/3/);
  });

  it('заметки (PopupText): текст применяется из оверлея после OK', () => {
    boot();
    const card = btns(/Заметки по питанию/);
    expect(card.length).toBeGreaterThan(0);
    fireEvent.click(card[0]);
    const area = document.querySelector('textarea') as HTMLTextAreaElement | null;
    expect(area).toBeTruthy();
    fireEvent.change(area!, { target: { value: 'тестовая заметка' } });
    const ok = allButtons().find((b) => (b.textContent || '').trim() === 'OK');
    expect(ok).toBeTruthy();
    fireEvent.click(ok!);
    expect(btns(/Заметки по питанию/)[0]?.textContent || '').toMatch(/тестовая заметка/);
  });
});

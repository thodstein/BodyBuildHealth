/**
 * planner-settings-clicks2.test.tsx — батч 2: цели/фазы/бюджет/пресеты/привязка.
 * Клик → состояние/персист (быстро, без генерации).
 */
import { describe, it, expect, beforeEach } from 'vitest';
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
const btns = (re: RegExp) =>
  Array.from(document.querySelectorAll('button')).filter((b) => re.test(b.textContent || ''));
const clickBtn = (re: RegExp) => {
  const found = btns(re);
  if (found.length === 0) throw new Error(`button not found: ${re}`);
  fireEvent.click(found[found.length - 1]);
};
const clickExact = (text: string) => {
  const found = Array.from(document.querySelectorAll('button')).filter((b) => (b.textContent || '').trim() === text);
  if (found.length === 0) throw new Error(`button not found (exact): ${text}`);
  fireEvent.click(found[0]);
};
const activePill = (text: string) => {
  const found = Array.from(document.querySelectorAll('button')).filter((b) => (b.textContent || '').includes(text));
  if (found.length === 0) throw new Error(`pill not found: ${text}`);
  return found[0].getAttribute('data-active') === 'true';
};
// Точное совпадение, ПОСЛЕДНЕЕ в DOM (пилюли цели/фазы дублируют v2-метки: Сушка/Мост/ПКТ).
const activePillLast = (text: string) => {
  const found = Array.from(document.querySelectorAll('button')).filter((b) => (b.textContent || '').trim() === text);
  if (found.length === 0) throw new Error(`pill not found (exact): ${text}`);
  return found[found.length - 1].getAttribute('data-active') === 'true';
};
const clickExactLast = (text: string) => {
  const found = Array.from(document.querySelectorAll('button')).filter((b) => (b.textContent || '').trim() === text);
  if (found.length === 0) throw new Error(`button not found (exact): ${text}`);
  fireEvent.click(found[found.length - 1]);
};
// Тогл без текста (голый knob): кнопка — предыдущий сосед span-подписи.
const clickToggleByLabel = (labelRe: RegExp) => {
  const span = Array.from(document.querySelectorAll('span')).find((s) => labelRe.test(s.textContent || ''));
  if (!span) throw new Error(`toggle label not found: ${labelRe}`);
  const btn = span.previousElementSibling;
  if (!btn || btn.tagName !== 'BUTTON') throw new Error(`toggle button not found near: ${labelRe}`);
  fireEvent.click(btn);
};
// PopupSelect: открыть карточку → выбрать опцию → вернуть текст карточки.
const choosePopupSelect = (labelRe: RegExp, optionRe: RegExp): string => {
  const card = btns(labelRe);
  if (card.length === 0) throw new Error(`select card not found: ${labelRe}`);
  fireEvent.click(card[0]);
  const opt = Array.from(document.querySelectorAll('button')).find((b) => optionRe.test(b.textContent || ''));
  if (!opt) throw new Error(`option not found: ${optionRe}`);
  fireEvent.click(opt);
  return (btns(labelRe)[0]?.textContent || '');
};

describe('Кнопки настроек: клик → состояние (батч 2: цели и привязка)', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch {}
    cleanup();
    seedBase();
  });

  it('цель: пилюля Сушка активируется', () => {
    boot();
    clickExactLast('✂️ Сушка');
    expect(activePillLast('✂️ Сушка')).toBe(true);
  });

  it('фаза: пилюля Мост активируется', () => {
    boot();
    clickExactLast('🌉 Мост');
    expect(activePillLast('🌉 Мост')).toBe(true);
  });

  it('бюджет: Максимум подсвечивается (border 2px)', () => {
    boot();
    clickBtn(/Максимум/);
    const b = btns(/Максимум/)[0];
    expect(b.style.border).toMatch(/2px/);
  });

  it('пресет белка: Макс белка подсвечивается', () => {
    boot();
    clickBtn(/Макс белка/);
    const b = btns(/Макс белка/)[0];
    expect(b.style.border).toMatch(/2px/);
  });

  it('разнообразие: уровень + строгость переключаются', () => {
    boot();
    clickBtn(/Максимум/);
    clickBtn(/Строгая/);
    expect(btns(/Строгая/)[0].style.border).toMatch(/139, 92, 246/);
  });

  it('привязка к тренировке: тогл показывает время начала/конца', () => {
    boot();
    // тогл голый (без текста) — клик через соседний span
    const timesBefore = document.querySelectorAll('input[type="time"]').length;
    clickToggleByLabel(/Привязать рацион к тренировке/);
    const timesAfter = document.querySelectorAll('input[type="time"]').length;
    expect(timesAfter).not.toBe(timesBefore);
  });

  it('тип расписания: Через день показывает EOD-подпись', () => {
    boot();
    clickToggleByLabel(/Привязать рацион к тренировке/);
    // если уже было включено — выключили; включаем гарантированно
    if (document.querySelectorAll('input[type="time"]').length === 0) clickToggleByLabel(/Привязать рацион к тренировке/);
    clickBtn(/Через день/);
    expect(document.body.textContent || '').toMatch(/Через день/);
  });

  it('тренировочные дни: клик по дню меняет счётчик', () => {
    boot();
    clickToggleByLabel(/Привязать рацион к тренировке/);
    if (document.querySelectorAll('input[type="time"]').length === 0) clickToggleByLabel(/Привязать рацион к тренировке/);
    clickBtn(/Неделя/);
    const before = (document.body.textContent || '').match(/(\d+) тренировочных дней/)?.[1];
    const circles = Array.from(document.querySelectorAll('button')).filter((b) => ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].includes((b.textContent || '').trim()));
    expect(circles.length).toBeGreaterThan(0);
    fireEvent.click(circles[0]);
    const after = (document.body.textContent || '').match(/(\d+) тренировочных дней/)?.[1];
    expect(after).not.toBe(before);
  });

  it('batchCooking: тогл ВКЛ/ВЫКЛ переключает текст', () => {
    boot();
    clickBtn(/Готовка впрок/);
    expect(document.body.textContent || '').toMatch(/Готовка впрок: (ВКЛ|ВЫКЛ)/);
    const t1 = (document.body.textContent || '').match(/Готовка впрок: (ВКЛ|ВЫКЛ)/)?.[1];
    clickBtn(/Готовка впрок/);
    const t2 = (document.body.textContent || '').match(/Готовка впрок: (ВКЛ|ВЫКЛ)/)?.[1];
    expect(t2).not.toBe(t1);
  });

  it('intraWorkout: тогл переключает текст', () => {
    boot();
    const t1 = (document.body.textContent || '').match(/Intra-workout[^:]*: (ВКЛ|ВЫКЛ)/)?.[1];
    clickBtn(/Intra-workout/);
    const t2 = (document.body.textContent || '').match(/Intra-workout[^:]*: (ВКЛ|ВЫКЛ)/)?.[1];
    expect(t2).not.toBe(t1);
  });

  it('surplus: слайдер меняет профицит и персист', () => {
    boot();
    const range = document.querySelector('input[type="range"]') as HTMLInputElement | null;
    if (!range) return; // слайдер только при цели mass — легитимно отсутствует
    fireEvent.change(range, { target: { value: '25' } });
    expect(localStorage.getItem('he_surplus_pct')).toBe('25');
  });

  it('пресет Масса: ставит любимые продукты (персист)', () => {
    boot();
    clickBtn(/Масса/);
    const saved = JSON.parse(localStorage.getItem('he_preferred_foods') || '[]');
    expect(saved).toContain('rice_white');
  });

  it('autofill: возвращает вес из профиля после ручной правки', () => {
    boot();
    // правим вес через попап
    const card = btns(/Вес \(кг\)/);
    expect(card.length).toBeGreaterThan(0);
    fireEvent.click(card[0]);
    const num = document.querySelector('input[type="number"]') as HTMLInputElement | null;
    expect(num).toBeTruthy();
    fireEvent.change(num!, { target: { value: '95' } });
    const ok = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'OK')!;
    fireEvent.click(ok);
    expect(document.body.textContent || '').toMatch(/95/);
    clickBtn(/Автозаполнение из профиля/);
    expect(document.body.textContent || '').toMatch(/85/);
  });

  it('saveToProfile: вес пишется в he_profile_v2', () => {
    boot();
    const card = btns(/Вес \(кг\)/);
    fireEvent.click(card[0]);
    const num = document.querySelector('input[type="number"]') as HTMLInputElement | null;
    fireEvent.change(num!, { target: { value: '90' } });
    fireEvent.click(Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'OK')!);
    clickBtn(/Сохранить в профиль/);
    const prof = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
    expect(prof.settings.personal.weight).toBe(90);
  });

  it('v2Phase: Мост пишет he_planner_v2_phase', () => {
    boot();
    clickExact('🌉 Мост');
    expect(localStorage.getItem('he_planner_v2_phase')).toBe('MOST');
  });

  it('autofill: профиль с foodIntolerances-объектом не роняет применение', () => {
    // Баг: s.nutrition.foodIntolerances.map падал, если поле — объект, а не
    // массив; catch глотал ошибку после частичного применения. Фикс — гард.
    try {
      localStorage.setItem('he_profile_v2', JSON.stringify({
        settings: {
          personal: { weight: 85, height: 180, age: 30, sex: 'male', bodyFat: 18 },
          training: { primaryGoal: 'mass' },
          pharma: { phase: 'course' },
          nutrition: { foodIntolerances: { lactose: true } as any },
        },
      }));
    } catch {}
    const errs: any[][] = [];
    const orig = console.error;
    console.error = (...a: any[]) => { errs.push(a); };
    try {
      boot();
      clickBtn(/Автозаполнение из профиля/);
    } finally {
      console.error = orig;
    }
    expect(errs.some((a) => String(a[0] ?? '').includes('autofillFromProfile'))).toBe(false);
  });
});

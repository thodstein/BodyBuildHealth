/**
 * planner-settings-clicks4.test.tsx — батч 4: модалки (инъекции/БАД/любимые/
 * исключения), план-тип, периодизация, адаптация, спецприём, степперы.
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
const allDivs = () => Array.from(document.querySelectorAll('div'));
const btns = (re: RegExp) => allButtons().filter((b) => re.test(b.textContent || ''));
const clickBtn = (re: RegExp) => {
  const found = btns(re);
  if (found.length === 0) throw new Error(`button not found: ${re}`);
  fireEvent.click(found[found.length - 1]);
};
const clickExactLast = (text: string) => {
  const found = allButtons().filter((b) => (b.textContent || '').trim() === text);
  if (found.length === 0) throw new Error(`button not found (exact): ${text}`);
  fireEvent.click(found[found.length - 1]);
};
const activePillLast = (text: string) => {
  const found = allButtons().filter((b) => (b.textContent || '').trim() === text);
  if (found.length === 0) throw new Error(`pill not found (exact): ${text}`);
  return found[found.length - 1].getAttribute('data-active') === 'true';
};
// Самый глубокий div с подписью и (кнопкой|чекбоксом) — строка-контрол.
const deepestDivWith = (labelRe: RegExp, sel: string) =>
  allDivs().filter((d) => labelRe.test(d.textContent || '') && d.querySelector(sel)).pop();
// Первая строка-опция ВНУТРИ последней открытой модалки (маркер ○/✓ + имя).
// Скоуп обязателен: на странице есть маркерные чипы аллергенов вне модалки.
const clickFirstMarkerRow = () => {
  const modal = allDivs()
    .filter((d) => d.style.position === 'fixed' && /rgba\(0, 0, 0/.test(d.style.background || ''))
    .pop();
  if (!modal) throw new Error('no modal open');
  const rows = Array.from(modal.querySelectorAll('div')).filter((d) => {
    const t = (d.textContent || '').trim();
    return /^○/.test(t) && t.length < 90; // именно НЕвыбранная строка
  });
  if (rows.length === 0) throw new Error('no unselected marker rows in modal');
  // у некоторых модалок onClick — на span-маркере, не на строке (клик всплывает и в div-варианте)
  fireEvent.click(rows[0].querySelector('span') || rows[0]);
};

describe('Кнопки настроек: клик → состояние (батч 4: модалки и адаптации)', () => {
  beforeEach(() => {
    cleanup();
    try { localStorage.clear(); } catch {}
    seedBase();
  });
  afterEach(() => cleanup());

  it('инъекция: тип + доза → добавление в список', () => {
    boot();
    clickBtn(/\+ Добавить инъекцию/);
    clickBtn(/^⚡ААС$/); // inline-чип типа (точное совпадение, не флаг V2)
    const dose = document.querySelector('input[type="number"]') as HTMLInputElement | null;
    expect(dose).toBeTruthy();
    fireEvent.change(dose!, { target: { value: '100' } });
    clickBtn(/✓ Добавить/);
    expect(document.body.textContent || '').toMatch(/100mg/);
  });

  it('БАД: выбор из пикера меняет счётчик', () => {
    boot();
    expect(document.body.textContent || '').toMatch(/Принимаю БАД: 0/);
    clickBtn(/\+ Выбрать/);
    clickFirstMarkerRow();
    expect(document.body.textContent || '').toMatch(/Принимаю БАД: 1/);
  });

  it('любимые продукты: выбор в модалке меняет счётчик', () => {
    boot();
    const count = () => Number((document.body.textContent || '').match(/Любимые продукты \((\d+)\)/)?.[1] || '-1');
    const before = count();
    expect(before).toBeGreaterThanOrEqual(0);
    const header = deepestDivWith(/Любимые продукты \(/, 'button');
    expect(header).toBeTruthy();
    fireEvent.click(header!.querySelector('button')!);
    clickFirstMarkerRow();
    expect(count()).toBe(before + 1);
  });

  it('исключения: выбор в модалке + персист he_excluded_foods', () => {
    boot();
    const header = deepestDivWith(/Исключённые продукты \(/, 'button');
    expect(header).toBeTruthy();
    fireEvent.click(header!.querySelector('button')!);
    clickFirstMarkerRow();
    const saved = JSON.parse(localStorage.getItem('he_excluded_foods') || '[]');
    expect(saved.length).toBe(1);
    expect(document.body.textContent || '').toMatch(/Исключённые продукты \(1\)/);
  });

  it('план-тип: Кето активируется', () => {
    boot();
    clickBtn(/🥑 Кето/);
    const el = btns(/🥑 Кето/)[0];
    expect(el.getAttribute('data-active')).toBe('true');
  });

  it('периодизация углеводов: БУЧ активируется', () => {
    boot();
    clickBtn(/БУЧ/);
    expect(btns(/БУЧ/)[0].getAttribute('data-active')).toBe('true');
  });

  it('адаптация веса: чекбокс открывает модалку', () => {
    boot();
    const row = deepestDivWith(/Адаптация веса/, 'input[type="checkbox"]');
    expect(row).toBeTruthy();
    const cb = row!.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(cb);
    expect(document.body.textContent || '').toMatch(/⚖️ Адаптация веса/);
  });

  it('спецприём: тогл включает режим (⚙️ Настроить + ✓ Вкл)', () => {
    boot();
    const row = deepestDivWith(/Постоянный спецприём/, 'button');
    expect(row).toBeTruthy();
    const rowBtns = Array.from(row!.querySelectorAll('button'));
    fireEvent.click(rowBtns[rowBtns.length - 1]);
    expect(document.body.textContent || '').toMatch(/✓ Вкл/);
    expect(document.body.textContent || '').toMatch(/⚙️ Настроить/);
  });

  it('приёмы пищи: пилюля 6 активна', () => {
    boot();
    clickExactLast('6');
    expect(activePillLast('6')).toBe(true);
  });
});

describe('Кнопки настроек: клик → состояние (батч 5: женский цикл и спецприём)', () => {
  const seedFemale = () => {
    try {
      localStorage.setItem('he_planner_mode', 'pro');
      localStorage.setItem('he_profile_v2', JSON.stringify({
        settings: {
          personal: { weight: 60, height: 168, age: 28, sex: 'female', bodyFat: 22 },
          training: { primaryGoal: 'recomposition' },
          pharma: { phase: 'none' },
          nutrition: {},
        },
      }));
    } catch {}
  };

  beforeEach(() => {
    cleanup();
    try { localStorage.clear(); } catch {}
    seedFemale();
  });
  afterEach(() => cleanup());

  it('🌸 фаза цикла: выбор виден в карточке', () => {
    boot();
    const card = btns(/🌸 Фаза цикла/);
    expect(card.length).toBeGreaterThan(0);
    const before = card[0].textContent || '';
    const oldSet = new Set(allButtons());
    fireEvent.click(card[0]);
    const fresh = allButtons().filter((b) => !oldSet.has(b));
    const pick = fresh.find((b) => {
      const t = (b.textContent || '').replace(/ ✓$/, '').trim();
      return t.length > 0 && !before.includes(t);
    });
    expect(pick).toBeTruthy();
    fireEvent.click(pick!);
    expect(btns(/🌸 Фаза цикла/)[0]?.textContent || '').not.toBe(before);
  });

  it('📅 календарь цикла: отметка начала пишется в he_cycle_log', () => {
    boot();
    clickBtn(/📅 Отметить начало \(сегодня\)/);
    const log = JSON.parse(localStorage.getItem('he_cycle_log') || '[]');
    expect(Array.isArray(log)).toBe(true);
    expect(log.length).toBeGreaterThanOrEqual(1);
  });

  it('спецприём: ⚙️ Настроить открывает модалку настроек', () => {
    boot();
    const row = deepestDivWith(/Постоянный спецприём/, 'button');
    expect(row).toBeTruthy();
    const rowBtns = Array.from(row!.querySelectorAll('button'));
    fireEvent.click(rowBtns[rowBtns.length - 1]); // Выкл → ✓ Вкл
    clickBtn(/⚙️ Настроить/);
    expect(document.body.textContent || '').toMatch(/🍽️ Настройка спецприёма/);
  });
});

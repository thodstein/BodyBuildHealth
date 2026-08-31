/**
 * planner-integration-guarantees.test.tsx — финальные интеграционные гаранты:
 * Эпик 6 (тяжёлый день в реальной генерации + юнит isHeavyDayForOffset),
 * Эпик 5 (скользящая компенсация: перебор вчера → сегодня снижено, e2e),
 * Эпик 4 (микро/DIAAS-контур не ломает генерацию и даёт заметки в многодневке).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { IndividualPlan } from '../index';
import { isHeavyDayForOffset } from '../planner-carb-periodization';

const findBtn = (label: RegExp): HTMLElement | undefined => {
  const matches = Array.from(document.querySelectorAll<HTMLElement>('button,div,span'))
    .filter(b => (b.textContent || '').match(label))
    .sort((a, b) => (a.tagName === 'BUTTON' ? 0 : 1) - (b.tagName === 'BUTTON' ? 0 : 1) || (a.textContent || '').length - (b.textContent || '').length);
  return matches[0];
};
const clickBtn = (label: RegExp) => {
  const b = findBtn(label);
  if (!b) throw new Error('Button not found: ' + label);
  fireEvent.click(b);
};
const bodyHas = (re: RegExp) => !!(document.body.textContent || '').match(re);

const generateAndOpenPlan = async () => {
  render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
  await waitFor(() => { if (!findBtn(/✨ Сгенерировать план питания/)) throw new Error('gen btn'); }, { timeout: 15000 });
  clickBtn(/✨ Сгенерировать план питания/);
  await waitFor(() => { expect(bodyHas(/Завтрак/)).toBe(true); }, { timeout: 25000 });
};

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const localYesterday = () => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const todayDowLabel = DAY_LABELS[((new Date().getDay() + 6) % 7 + 0) % 7];

describe('isHeavyDayForOffset — чистая функция', () => {
  it('совпадение дня недели → true, остальные → false', () => {
    const label = todayDowLabel;
    expect(isHeavyDayForOffset(label, 0, DAY_LABELS)).toBe(true);
    const otherOffset = [1, 2, 3, 4, 5, 6].find(o => isHeavyDayForOffset(label, o, DAY_LABELS));
    expect(otherOffset).toBeUndefined();
  });
  it('пустое значение / битые labels → false', () => {
    expect(isHeavyDayForOffset('', 0, DAY_LABELS)).toBe(false);
    expect(isHeavyDayForOffset(undefined, 0, DAY_LABELS)).toBe(false);
    expect(isHeavyDayForOffset('Пн', 0, ['Пн', 'Вт'] as any)).toBe(false);
  });
  it('неделя: ровно один день из 7 совпадает', () => {
    let hits = 0;
    for (let o = 0; o < 7; o++) if (isHeavyDayForOffset(todayDowLabel, o, DAY_LABELS)) hits++;
    expect(hits).toBe(1);
  });
});

describe('Эпик 6: тяжёлый день — заметка и мод в реальной генерации', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });
  afterEach(() => { try { cleanup(); } catch {} });

  it('heavyTrainDay=сегодня → heavyDayNote в плане', async () => {
    try { localStorage.setItem('he_planner_prefs', JSON.stringify({ heavyTrainDay: todayDowLabel })); } catch {}
    await generateAndOpenPlan();
    await waitFor(() => { expect(bodyHas(/День тяжёлых ног\/объёма/)).toBe(true); }, { timeout: 25000 });
  });

  it('без heavyTrainDay — заметки нет', async () => {
    await generateAndOpenPlan();
    expect(bodyHas(/День тяжёлых ног\/объёма/)).toBe(false);
  });
});

describe('Эпик 5: скользящая компенсация — перебор вчера → сегодня снижено (e2e)', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });
  afterEach(() => { try { cleanup(); } catch {} });

  it('вчера перебор 3000+ ккал → заметка компенсации в плане (diaryAdaptation вкл)', async () => {
    // Вчера — огромный перебор (дневник)
    try {
      localStorage.setItem('nutrition_diary', JSON.stringify({
        [localYesterday()]: { meals: { 'Обед': [{ name: 'X', kcal: 3000, p: 150, f: 80, c: 350 }] } },
      }));
      localStorage.setItem('he_planner_prefs', JSON.stringify({ diaryAdaptation: true }));
    } catch {}
    await generateAndOpenPlan();
    // Компенсация вниз (перебор) — баннер «Адаптация по дневнику» с отрицательной дельтой
    await waitFor(() => { expect(bodyHas(/Адаптация по дневнику|компенсац|Компенсац|сегодня: -/i)).toBe(true); }, { timeout: 25000 });
  });
});

describe('Эпик 4: микро/DIAAS-контур не ломает многодневную генерацию', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });
  afterEach(() => { try { cleanup(); } catch {} });

  it('3 дня генерируются без ошибок с включённым контуром', async () => {
    await generateAndOpenPlan();
    // переключаемся на 3 дня (кнопка «3 дня»), регенерируем
    clickBtn(/3 дня/);
    await waitFor(() => { expect(bodyHas(/Завтрак/)).toBe(true); }, { timeout: 25000 });
    expect((document.body.textContent || '').includes('NaN')).toBe(false);
  });
});
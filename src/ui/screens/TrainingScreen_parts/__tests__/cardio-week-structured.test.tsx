/**
 * cardio-week-structured.test.tsx — конструктор недели: оборудование ручной
 * сессии и редактор структуры интервалов (⚡).
 *
 * Проверяем то, что видит атлет в APK: выбор оборудования меняет ккал,
 * структура сохраняется в сессию, длительность поднимается до неё (структура
 * не режется), а таймер получает ровно то, что показал редактор.
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CardioWeekEditor } from '../CardioWeekEditor';
import {
  buildCardioCycle, loadCardioCycles, setActiveCardioCycle,
  buildCardioIntervalPlan, cardioStructuredMainSec, kcalForCardio, cycleBodyWeight, cycleFfmKg,
  type CardioCycle,
} from '../../../../engines/lms/cardio.engine';

const CYCLES_KEY = 'he_cardio_cycles';
const ACTIVE_KEY = 'he_active_cardio_cycle';

/** Цикл из одной hiit-сессии на 20 минут в неделе 1. */
function oneWeekCycle(): CardioCycle {
  const base = buildCardioCycle({ goal: 'cut', totalWeeks: 2, daysAvailable: 3, bodyWeight: 80 });
  const session = { type: 'hiit' as const, durationMin: 20, weeklyFrequency: 1, intensity: 'high' as const, kcalPerSession: 250, purpose: 'Ручная сессия' };
  const cycle: CardioCycle = {
    ...base,
    weeks: base.weeks.map(w => (w.week === 1 ? { ...w, sessions: [session], totalMinutes: 20, totalKcal: 250 } : w)),
  };
  return cycle;
}

function seed(): CardioCycle {
  const c = oneWeekCycle();
  localStorage.setItem(CYCLES_KEY, JSON.stringify([c]));
  setActiveCardioCycle(c);
  return c;
}

const savedSession = () => loadCardioCycles()[0].weeks[0].sessions[0];

beforeEach(() => {
  try {
    localStorage.removeItem(CYCLES_KEY);
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem('he_cardio_cycle_history');
    localStorage.removeItem('he_cardio_sessions');
  } catch { /* ignore */ }
});

describe('конструктор недели: оборудование сессии', () => {
  it('выбор «Вело» сохраняется в сессию и пересчитывает ккал', () => {
    const c = seed();
    const before = c.weeks[0].sessions[0].kcalPerSession;
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));

    fireEvent.click(screen.getByLabelText('Оборудование сессии 1'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Вело/ }));

    const after = savedSession();
    expect(after.equipment).toBe('cycling');
    // Ккал пересчитаны тем же движком и с тем же оборудованием (а не «на глаз»).
    expect(after.kcalPerSession).toBe(kcalForCardio('hiit', 20, cycleBodyWeight(c), 'cycling', c.config?.sex, cycleFfmKg(c)));
    expect(after.kcalPerSession).not.toBe(before);
  });

  it('новую сессию можно добавить сразу с оборудованием', () => {
    const c = seed();
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Оборудование новой сессии'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Гребля/ }));
    fireEvent.click(screen.getByRole('button', { name: /Добавить сессию/ }));

    const sessions = loadCardioCycles()[0].weeks[0].sessions;
    expect(sessions).toHaveLength(2);
    expect(sessions[1].equipment).toBe('rowing');
  });
});

describe('конструктор недели: структура интервалов (⚡)', () => {
  it('структура сохраняется, длительность поднимается до неё, таймер получает все отрезки', () => {
    const c = seed();
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));
    fireEvent.click(screen.getByRole('button', { name: '+ Отрезок' }));

    // 15 × (60 с работа + 60 с отдых) = 30 мин > 20 мин сессии.
    const reps = screen.getByLabelText('Повторов отрезка 1') as HTMLInputElement;
    fireEvent.change(reps, { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    const s = savedSession();
    expect(s.structured).toHaveLength(1);
    expect(s.structured![0].reps).toBe(15);
    expect(s.durationMin).toBe(30);
    expect(s.purpose).toContain('⚡ Структура: 15×1 мин/1 мин');

    // Таймер не обрезает структуру: все 15 подходов в плане и total ≤ бюджета.
    const plan = buildCardioIntervalPlan({ type: s.type, durationMin: s.durationMin, structured: s.structured })!;
    expect(plan.steps.filter(st => st.kind === 'work')).toHaveLength(15);
    expect(plan.totalSec).toBeLessThanOrEqual(s.durationMin * 60);
    expect(cardioStructuredMainSec(s.structured)).toBe(1800);
  });

  it('«Очистить» + сохранить убирает структуру — сессия снова ровным темпом', () => {
    const c = seed();
    // Сессия уже со структурой.
    const withStruct: CardioCycle = {
      ...c,
      weeks: c.weeks.map(w => (w.week === 1
        ? { ...w, sessions: [{ ...w.sessions[0], structured: [{ workSec: 30, restSec: 30, reps: 6 }], purpose: 'Ручная сессия · ⚡ Структура: 6×30 с/30 с' }] }
        : w)),
    };
    localStorage.setItem(CYCLES_KEY, JSON.stringify([withStruct]));
    setActiveCardioCycle(withStruct);
    render(<CardioWeekEditor cycle={withStruct} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    // Кнопка показывает текущую структуру из сессии.
    expect(screen.getByRole('button', { name: /Интервалы сессии 1/ }).textContent).toContain('6×30 с/30 с');
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));
    fireEvent.click(screen.getByRole('button', { name: 'Очистить' }));
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    const s = savedSession();
    expect(s.structured).toBeUndefined();
    expect(s.purpose).not.toContain('⚡ Структура');
  });
});

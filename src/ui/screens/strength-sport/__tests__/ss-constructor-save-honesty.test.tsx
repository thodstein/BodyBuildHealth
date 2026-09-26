/**
 * ss-constructor-save-honesty.test.tsx — ветка «НЕ сохранён» должна быть достижима.
 *
 * Конструктор пишет «✓ Спец-блок встроен» / «✓ Волна коррекции встроена» / «↩ откачена»
 * только если запись реально легла в хранилище. Раньше сообщение было безусловным:
 * при полном хранилище пользователь видел «готово» и терял работу при перезагрузке.
 *
 * Лок нужен, чтобы честная ветка не оказалась мёртвым кодом (её легко сломать
 * рефакторингом, и никто не заметит — сообщения-то зелёные).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { StrengthSportConstructor } from '../StrengthSportConstructor';

const PLAN_KEYS = ['he_strength_sport_plan_v1', 'he_strength_sport_plans_v1'];

let real: Storage;
let throwOnPlan: boolean;

beforeEach(() => {
  localStorage.clear();
  real = localStorage;
  throwOnPlan = true;
  // Проксируем localStorage: обычные ключи пишутся как раньше, план — падает (квота).
  const backing: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (k in backing ? backing[k] : null),
      setItem: (k: string, v: string) => {
        if (throwOnPlan && PLAN_KEYS.includes(k)) { const e: any = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
        backing[k] = String(v);
      },
      removeItem: (k: string) => { delete backing[k]; },
      clear: () => { for (const k of Object.keys(backing)) delete backing[k]; },
      key: (i: number) => Object.keys(backing)[i] ?? null,
      get length() { return Object.keys(backing).length; },
    } as any,
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: real });
});

function goToSplit(container: HTMLElement) {
  fireEvent.click(screen.getByText(/Далее → 2 👤 Атлет/));
  fireEvent.click(screen.getByText(/Далее → 3 🏃 Вне зала/));
  fireEvent.click(screen.getByText(/Далее → 4 🧩 Сплит/));
  expect(container.textContent).toContain('Интернет-цикл');
}

async function buildFirstPlan() {
  const { container } = render(<StrengthSportConstructor />);
  goToSplit(container);
  fireEvent.click(screen.getByLabelText('Цикл'));
  fireEvent.click(within(await screen.findByRole('dialog', { name: 'Цикл' })).getByText(/общая база/));
  await waitFor(() => expect(container.textContent).toContain('Дословно'));
  fireEvent.click(screen.getByText(/Собрать план/));
  await waitFor(() => expect(container.textContent).toContain('cycle:ss-ta-general-8'), { timeout: 5000 });
  return container;
}

describe('конструктор: честность сохранения (квота хранилища)', () => {
  it('при отказе записи показывает предупреждение, а не «собрано» молча', async () => {
    const container = await buildFirstPlan();
    await waitFor(() => expect(container.textContent).toMatch(/НЕ сохран/));
    expect(container.textContent).toMatch(/нет места|пропадёт/);
  });

  it('тот же сценарий без квоты НЕ показывает предупреждение (иначе враньё наоборот)', async () => {
    throwOnPlan = false;
    const container = await buildFirstPlan();
    // даём тостам отработать
    await new Promise(r => setTimeout(r, 200));
    expect(container.textContent).not.toMatch(/НЕ сохран/);
  });
});

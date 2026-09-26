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
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { StrengthSportConstructor } from '../StrengthSportConstructor';

const PLAN_KEYS = ['he_strength_sport_plan_v1', 'he_strength_sport_plans_v1'];
const ANNUAL_KEY = 'he_strength_annual_v1';

let real: Storage;
let throwOnPlan: boolean;
let corruptList: boolean;
let backing: Record<string, string>;

beforeEach(() => {
  localStorage.clear();
  real = localStorage;
  throwOnPlan = true;
  corruptList = false;
  // Проксируем localStorage: обычные ключи пишутся как раньше, план — падает (квота).
  const store: Record<string, string> = {};
  backing = store;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => {
        if (k === 'he_strength_sport_plans_v1' && corruptList) return '{битое';
        return k in store ? store[k] : null;
      },
      setItem: (k: string, v: string) => {
        if (throwOnPlan && PLAN_KEYS.includes(k)) { const e: any = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
        store[k] = String(v);
      },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length; },
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

describe('конструктор: правка сета сохраняется (updater-функция должна быть чистой)', () => {
  const firstSetInput = (container: HTMLElement): HTMLInputElement => {
    const row = container.querySelector('[data-ss="set-row"]');
    if (!row) throw new Error('в плане нет строки сета — тест не проверит ничего');
    return row.querySelector('input') as HTMLInputElement;
  };

  it('правка веса сета реально попадает в хранилище', async () => {
    throwOnPlan = false;
    const container = await buildFirstPlan();
    const input = firstSetInput(container);
    fireEvent.change(input, { target: { value: '123' } });
    await waitFor(() => {
      expect(backing['he_strength_sport_plan_v1'] || '').toContain('123');
    });
  });

  it('при отказе хранилища правка предупреждает честно, а не пропадает молча', async () => {
    throwOnPlan = true;   // любая запись плана падает
    const container = await buildFirstPlan();
    const input = firstSetInput(container);
    fireEvent.change(input, { target: { value: '77' } });
    await waitFor(() => expect(container.textContent).toMatch(/Правка не сохранена/));
  });

  it('валидация диапазона живёт ВНЕ updater (вес 0–500) и не трогает план', async () => {
    throwOnPlan = false;
    const container = await buildFirstPlan();
    const rirInput = container.querySelectorAll('input[placeholder="RIR"]')[0] as HTMLInputElement;
    expect(rirInput).toBeTruthy();
    fireEvent.change(rirInput, { target: { value: '9' } });   // вне 0–5
    await waitFor(() => expect(container.textContent).toMatch(/RIR 0–5/));
  });

  it('source-guard: внутри setPlan(updater) нет записи в хранилище и сообщений', () => {
    // Поведенческие тесты выше НЕ ловят возврат side-effect внутрь updater
    // (проверено мутацией: тесты остаются зелёными). Ловит именно этот гард —
    // в updater-функциях, которые тут редактируют план, запрещены и запись,
    // и setMsg: updarter обязан быть чистым (StrictMode зовёт его дважды).
    const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/strength-sport/StrengthSportConstructor.tsx'), 'utf8');
    const updaterБлоки = src.split(/setPlan\s*\(\s*(prev|p)\s*=>/).slice(1);
    expect(updaterБлоки.length, 'не найдено ни одного setPlan(updater) — гард проверяет не то').toBeGreaterThan(0);
    const виновники: string[] = [];
    updaterБлоки.forEach((блок, i) => {
      const тело = блок.slice(0, блок.indexOf('\n  };') + 5 || блок.length);
      if (/saveStrengthSportPlan\(|setMsg\(/.test(тело)) виновники.push(`#${i + 1}: ${тело.match(/saveStrengthSportPlan\(|setMsg\(/)?.[0]}`);
    });
    expect(виновники, `side-effect внутри updater-функции:\n${виновники.join('\n')}`).toEqual([]);
  });
});

describe('конструктор: год не собирается «из пустоты»', () => {
  it('битая история планов → год НЕ создаётся и показан честный провал', async () => {
    throwOnPlan = false;   // запись плана идёт — фокус на истории
    corruptList = true;    // список не читается → loadStrengthSportPlans() даёт []
    const container = await buildFirstPlan();

    await waitFor(() => expect(container.textContent).toMatch(/год не собран/));
    // Ключ года не записан — «Год: 0нед · 0 блоков» показать нечем
    expect(ANNUAL_KEY in backing).toBe(false);
    expect(container.textContent).not.toMatch(/Год: 0нед/);
  });

  it('нечего сохранили → нечего строить год (обе честные ветки сразу)', async () => {
    // Пустая история САМА ПО СЕБЕ не повод для ошибки: если запись удалась,
    // в истории появляется план и год строится законно (проверено другим тестом).
    // Ошибка возникает ровно тогда, когда сохранить не удалось — тогда и года нет.
    throwOnPlan = true;
    corruptList = false;
    backing['he_strength_sport_plans_v1'] = '[]';   // валидный пустой список, не битый
    const container = await buildFirstPlan();

    await waitFor(() => expect(container.textContent).toMatch(/НЕ сохран/));
    expect(container.textContent).toMatch(/год не собран/);
    expect(ANNUAL_KEY in backing).toBe(false);
    expect(container.textContent).not.toMatch(/Год: 0нед/);
  });

  it('при успешной записи год строится (страховка: ловушка не ломает обычный путь)', async () => {
    throwOnPlan = false;
    await buildFirstPlan();
    // Проверяем факт, а не видимость: карточка года живёт на другом шаге,
    // а контракт — «год реально записан и в нём есть блоки».
    await waitFor(() => expect(ANNUAL_KEY in backing).toBe(true));
    const ann = JSON.parse(backing[ANNUAL_KEY]);
    expect(ann.blocks.length).toBe(1);
    expect(ann.totalWeeks).toBeGreaterThan(0);
  });
});

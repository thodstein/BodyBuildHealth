/**
 * risk-labs-markers-bound.test.tsx — проход 152: карточка «Маркеры с
 * отклонениями» на экране «Риск» не выдаёт обрезанное число за измерение.
 *
 * Было: у карточки была своя копия правила — число из бланка сравнивалось с
 * нормой напрямую. «ЛПНП >5» печаталось как «5 ↑66%» (процент от предела
 * метода, а не от значения), а «ЛВП >0.5» при нижней 0.9 давало стрелку «↓» и
 * процент, будто низкий ЛВП измерен. Записи, чью сторону граница не доказывает,
 * просто исчезали из списка.
 *
 * Стало: карточка берёт `computeMarkerDeviations` (тот же модуль, что на экране
 * «Анализы»): знак печатается рядом с числом, процент есть только у точного
 * числа, а «без вывода» считается отдельно и называется всегда.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const state = vi.hoisted(() => ({ labs: [] as any[] }));

vi.mock('../../core/db', () => ({
  db: {
    init: vi.fn(async () => {}),
    put: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    getByIndex: vi.fn(async () => []),
    getAll: vi.fn(async () => []),
  },
}));

vi.mock('../../core/data-link', async () => {
  const actual = await vi.importActual<typeof import('../../core/data-link')>('../../core/data-link');
  return {
    ...actual,
    notifyDataChange: vi.fn(),
    useDataLink: () => ({ labs: state.labs, profile: { settings: {} }, course: [] }),
  };
});

import { LabsRisksTab } from '../screens/RiskScreen';

const lab = (code: string, value: number, extra: Record<string, unknown> = {}) => ({
  id: `${code}-${value}-${String(extra.bound || '')}`,
  code,
  name: code,
  value,
  unit: '',
  date: '2026-11-01',
  ...extra,
});

const row = (container: HTMLElement, code: string) =>
  container.querySelector(`[data-risk-marker="${code}"]`) as HTMLElement | null;

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  state.labs = [];
});

afterEach(cleanup);

describe('проход 152: «Маркеры с отклонениями» уважают границу бланка', () => {
  it('«ЛПНП >5» — стрелка без процента, знак у числа', () => {
    state.labs = [lab('LDL', 5, { bound: '>' })];
    const { container } = render(<LabsRisksTab />);
    const r = row(container, 'LDL');
    expect(r).not.toBeNull();
    expect(r!.textContent).toContain('>5');
    expect(r!.textContent).toContain('↑');
    expect(r!.textContent).not.toContain('%');
    expect(r!.getAttribute('data-risk-marker-bound')).toBe('yes');
  });

  it('точное число печатается с процентом, как раньше', () => {
    state.labs = [lab('LDL', 6)];
    const { container } = render(<LabsRisksTab />);
    const r = row(container, 'LDL');
    expect(r).not.toBeNull();
    expect(r!.textContent).toContain('%');
    expect(r!.getAttribute('data-risk-marker-bound')).toBeNull();
  });

  it('«ЛВП >0.5» не становится низким: строки нет, запись названа «без вывода»', () => {
    state.labs = [lab('HDL', 0.5, { bound: '>' })];
    const { container } = render(<LabsRisksTab />);
    expect(row(container, 'HDL')).toBeNull();
    const note = container.querySelector('[data-risk-unproven]') as HTMLElement | null;
    expect(note).not.toBeNull();
    expect(note!.getAttribute('data-risk-unproven')).toBe('1');
    expect(note!.textContent).toContain('Без вывода: 1');
    // «Все маркеры в норме» по недоказанной записи не печатается.
    expect(container.textContent).not.toContain('Все маркеры в норме');
  });

  it('«СРБ <5» при верхней 3 — без вывода, а не «норма»', () => {
    state.labs = [lab('CRP', 5, { bound: '<' })];
    const { container } = render(<LabsRisksTab />);
    expect(row(container, 'CRP')).toBeNull();
    expect(container.textContent).toContain('Без вывода: 1');
    expect(container.textContent).not.toContain('Все маркеры в норме');
  });

  it('доказанное отклонение и недоказанная запись живут рядом', () => {
    state.labs = [lab('LDL', 5, { bound: '>' }), lab('HDL', 0.5, { bound: '>' })];
    const { container } = render(<LabsRisksTab />);
    expect(row(container, 'LDL')).not.toBeNull();
    expect(row(container, 'HDL')).toBeNull();
    // Счётчик «без вывода» печатается и при наличии отклонений — запись не исчезает.
    const note = container.querySelector('[data-risk-unproven]') as HTMLElement | null;
    expect(note!.getAttribute('data-risk-unproven')).toBe('1');
  });

  it('«Все системы в норме» не печатается, когда риск не посчитан из-за границы', () => {
    state.labs = [lab('HDL', 0.5, { bound: '>' })];
    const { container } = render(<LabsRisksTab />);
    expect(container.textContent).not.toContain('Все системы в норме');
    expect(container.textContent).toContain('Отклонений по системам нет, но 1 записей без вывода');
  });

  it('точные числа в норме — «Все системы в норме» остаётся', () => {
    state.labs = [lab('LDL', 2)];
    const { container } = render(<LabsRisksTab />);
    expect(container.textContent).toContain('Все системы в норме');
  });
});

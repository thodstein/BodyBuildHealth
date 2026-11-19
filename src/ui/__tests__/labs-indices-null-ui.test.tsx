/**
 * labs-indices-null-ui.test.tsx — проход 149: карточка «Риски и индексы» не
 * печатает «0%» вместо «нет данных».
 *
 * Было: индексы строились из нулей за отсутствующие маркеры, поэтому сданный
 * один АЛТ показывал «Воспаление 0%», «Метаболизм 0%», «HOMA-IR 0%» — ноль,
 * который читается как «в норме», хотя эти маркеры никто не сдавал.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

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

import { LabsScreen } from '../screens/LabsScreen';

const lab = (code: string, value: number, extra: Record<string, unknown> = {}) => ({
  id: `${code}-${value}`,
  code,
  name: code,
  value,
  unit: '',
  phase: 'baseline',
  date: '2026-11-01',
  ...extra,
});

const openRisks = () => {
  const { container } = render(<LabsScreen />);
  const card = container.querySelector('.labs-hero-card[data-id="risks"]') as HTMLElement | null;
  expect(card).not.toBeNull();
  fireEvent.click(card!);
  return container;
};

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  state.labs = [];
});

afterEach(cleanup);

describe('проход 149: индексы без измерений', () => {
  it('один АЛТ — воспаление «нет данных», а не «0%»', () => {
    state.labs = [lab('ALT', 30)];
    const container = openRisks();
    const empty = container.querySelector('[data-lab-index="inflammation"]') as HTMLElement | null;
    expect(empty).not.toBeNull();
    expect(empty!.getAttribute('data-lab-index-null')).toBe('yes');
    expect(empty!.textContent).toContain('нет данных');
    expect(empty!.textContent).not.toContain('%');

    const hepatic = container.querySelector('[data-lab-index="hepaticStress"]') as HTMLElement | null;
    expect(hepatic).not.toBeNull();
    expect(hepatic!.getAttribute('data-lab-index-null')).toBeNull();
    expect(hepatic!.textContent).toContain('%');
  });

  it('частичный индекс говорит, сколько маркеров учтено', () => {
    state.labs = [lab('FERRITIN', 100)];
    const container = openRisks();
    const row = container.querySelector('[data-lab-index="inflammation"]') as HTMLElement | null;
    expect(row).not.toBeNull();
    expect(row!.getAttribute('data-lab-index-partial')).toBe('1/2');
  });
});

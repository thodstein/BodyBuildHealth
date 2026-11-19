/**
 * labs-marker-risks-ui.test.tsx — проход 147: экран рисков не выдаёт
 * обрезанное число за измерение и неизвестное за норму.
 *
 * «Ферритин >1000» показывался строкой «1000 ↑233%», а маркер, чью сторону
 * граница не доказывает («>5» при верхней 300), исчезал из списка — и экран
 * писал «Все маркеры в норме».
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';

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

describe('проход 147: маркеры с отклонениями', () => {
  it('обрезанное «>1000» печатается со знаком и без процента', () => {
    state.labs = [lab('FERRITIN', 1000, { bound: '>' })];
    const container = openRisks();
    const row = container.querySelector('[data-lab-marker-percent="none"]') as HTMLElement | null;
    expect(row).not.toBeNull();
    expect(row!.getAttribute('data-lab-marker-side')).toBe('high');
    expect(row!.textContent).toContain('>1000');
    expect(row!.textContent).toContain('вне нормы');
    expect(row!.textContent).not.toContain('%');
  });

  it('недоказанная сторона — «без вывода», а не «в норме»', () => {
    state.labs = [lab('FERRITIN', 5, { bound: '>' }), lab('ALT', 30)];
    const container = openRisks();
    expect(container.querySelector('[data-lab-marker-percent]')).toBeNull();
    expect(container.textContent).toContain('В норме: 1 · без вывода: 1');
    expect(container.textContent).not.toContain('Все маркеры в норме');
  });

  it('все доказанно в норме — прежний текст', () => {
    state.labs = [lab('ALT', 30)];
    const container = openRisks();
    expect(container.textContent).toContain('Все маркеры в норме');
    expect(screen.queryByText(/без вывода/)).toBeNull();
  });
});

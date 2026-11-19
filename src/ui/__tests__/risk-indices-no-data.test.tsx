/**
 * risk-indices-no-data.test.tsx — проход 153: карточка «Композитные индексы
 * здоровья» не показывает ASI/HMI/CR, когда считать их не из чего.
 *
 * Было: `interpretLabs` подставлял «нормы», поэтому при одном глюкозном анализе
 * (или вовсе без анализов, если экран не гейтился) карточка печатала
 * «ASI 72 % Хорошо · HMI 75 · CR 45» — оценку по несуществующим ЛПНП/СРБ/АЛТ.
 *
 * Стало: индекс без измеренных маркеров — `null`, карточка пишет «Нет данных».
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';

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
  id: `${code}-${value}`,
  code,
  name: code,
  value,
  unit: '',
  date: '2026-11-01',
  ...extra,
});

const indexCard = (container: HTMLElement, key: 'ASI' | 'HMI' | 'CR') =>
  container.querySelector(`[data-health-index="${key}"]`) as HTMLElement | null;

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  state.labs = [];
});

afterEach(cleanup);

describe('проход 153: индексы здоровья без данных', () => {
  it('один глюкозный анализ — все три индекса «Нет данных»', () => {
    state.labs = [lab('GLUCOSE', 5.0)];
    const { container } = render(<LabsRisksTab />);
    for (const key of ['ASI', 'HMI', 'CR'] as const) {
      const card = indexCard(container, key);
      expect(card).not.toBeNull();
      expect(card!.getAttribute('data-health-index-value')).toBe('none');
      expect(card!.textContent).toContain('Нет данных');
      expect(card!.textContent).not.toContain('%');
    }
  });

  it('полная панель — индексы считаются и печатают проценты', () => {
    state.labs = [
      lab('LDL', 2), lab('HDL', 1.25), lab('CRP', 1), lab('ALT', 20),
      lab('CREATININE', 110), lab('ESTRADIOL', 100),
    ];
    const { container } = render(<LabsRisksTab />);
    for (const key of ['ASI', 'HMI', 'CR'] as const) {
      const card = indexCard(container, key);
      expect(card).not.toBeNull();
      expect(card!.getAttribute('data-health-index-value')).not.toBe('none');
      expect(card!.textContent).toContain('%');
    }
  });
});

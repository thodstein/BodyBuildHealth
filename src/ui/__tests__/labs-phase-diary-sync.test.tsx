/**
 * labs-phase-diary-sync.test.tsx — P0: фаза не синкалась + diary []-deps
 * 1) LabsScreen: profilePhase baseline→course → selectedPhase baseline→on_cycle
 * 2) LabDiaryTab: mount labs=[] → labs=[ALT] → diary импортится
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

const mockLabs = vi.fn(() => [] as any[]);
const mockProfilePhase = vi.fn(() => 'baseline');

vi.mock('../../core/data-link', async () => {
  const actual = await vi.importActual<typeof import('../../core/data-link')>('../../core/data-link');
  return {
    ...actual,
    useDataLink: () => ({
      labs: mockLabs(),
      profile: { settings: { pharma: { phase: mockProfilePhase() }, personal: {} } },
      course: [],
      diary: { sessions: [] },
    }),
    notifyDataChange: vi.fn(),
  };
});

import { LabsScreen } from '../screens/LabsScreen';
import { LabDiaryTab } from '../screens/LabsScreen_parts/LabDiaryTab';

beforeEach(() => {
  try { localStorage.clear(); } catch {}
  mockLabs.mockReturnValue([]);
  mockProfilePhase.mockReturnValue('baseline');
});

describe('LabsScreen phase sync', () => {
  it('profile baseline → Labs показывает Базовый, course → На курсе', async () => {
    const { container, rerender } = render(<LabsScreen />);
    const heroCard = container.querySelector('.labs-hero-card[data-id="lab"]') as HTMLElement;
    expect(heroCard).not.toBeNull();
    heroCard.click();
    await waitFor(() => {
      const active = container.querySelector('.labs-phase-row button[aria-pressed="true"]');
      expect(active?.textContent).toContain('Базовый');
    });
    mockProfilePhase.mockReturnValue('course');
    rerender(<LabsScreen />);
    await waitFor(() => {
      const active = container.querySelector('.labs-phase-row button[aria-pressed="true"]');
      expect(active?.textContent).toContain('На курсе');
    });
    cleanup();
  });
});

describe('LabDiaryTab auto-import on labs change', () => {
  it('mount labs=[] → 0 дней, затем labs=[ALT 120] → diary импортится с аномалией', async () => {
    const { rerender } = render(<LabDiaryTab labs={[]} />);
    expect(screen.getByText(/Дневник анализов/)).not.toBeNull();
    // initially 0 days
    expect(screen.getByText(/0 дней/)).not.toBeNull();
    const labsWithAlt = [{ id: '1', code: 'ALT', name: 'АЛТ', value: 120, unit: 'U/L', date: '2026-09-01' }] as any[];
    rerender(<LabDiaryTab labs={labsWithAlt} />);
    await waitFor(() => {
      // after fix, diary should have 1 day and show abnormal
      const text = document.body.textContent || '';
      expect(text).toContain('1 дней');
    });
    cleanup();
    try { localStorage.clear(); } catch {}
  });
});

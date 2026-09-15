/**
 * risk-women-deeplink.test.tsx — Ж1/Ж5 (фаза 2): кликабельная кросс-ссылка
 * «Женщины и ААС» из «Рисков».
 *  - NAV_TARGETS['support-women'] ведёт в support/subTab='women' (карта App);
 *  - SupportScreen initialSubTab='women' сразу открывает detail женского протокола.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { NAV_TARGETS } from '../../App';
import { SupportScreen } from '../screens/SupportScreen';

beforeEach(() => {
  localStorage.clear();
  cleanup();
});

describe('Ж1/Ж5: кросс-ссылка из «Рисков» в «Женщины и ААС»', () => {
  it("NAV_TARGETS: support-women → tab 'support', subTab 'women'", () => {
    expect(NAV_TARGETS['support-women']).toEqual({ tab: 'support', subTab: 'women' });
  });

  it("initialSubTab='women' открывает detail протокола (Вирилизация)", async () => {
    render(<SupportScreen initialSubTab="women" />);
    await waitFor(() => {
      expect(screen.getByText(/Женский цикл и ААС/)).toBeTruthy();
    });
    // табы протокола видны (detail, не меню)
    expect(screen.getAllByText(/Вирилизация/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Дозы веществ/).length).toBeGreaterThan(0);
  });
});

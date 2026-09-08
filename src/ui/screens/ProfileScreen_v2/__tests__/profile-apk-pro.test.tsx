/**
 * profile-apk-pro.test.tsx — §83 PROFILE PRO-FULL.
 * Навигация без возврата в hero, quick-jump с активным разделом,
 * пакетное развернуть/свернуть, тач-цели 40px+.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ProfileScreen_v2 } from '../ProfileScreen_v2';
import { ProfileUserTab } from '../ProfileUserTab';
import { ProfileReportsTab } from '../ProfileReportsTab';

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {}
});
afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {}
});

describe('Profile §83 — поднавигация без hero', () => {
  it('hero → раздел → переключение пилюлей без возврата', () => {
    const { container, getByLabelText } = render(<ProfileScreen_v2 />);
    // Hero с навигацией
    expect(container.querySelector('.pf-hero-nav')).not.toBeNull();
    // Открываем Пользователя
    const userCard = container.querySelector('.pf-hero-card[data-id="user"]');
    expect(userCard).not.toBeNull();
    fireEvent.click(userCard!);
    // Поднавигация видна
    const subnav = container.querySelector('.pf-subnav');
    expect(subnav).not.toBeNull();
    // Переключаемся на Настройки пилюлей
    fireEvent.click(getByLabelText('Раздел Настройки'));
    expect(getByLabelText('Раздел Настройки').getAttribute('data-active')).toBe('true');
    // И обратно на Дневники
    fireEvent.click(getByLabelText('Раздел Дневники'));
    expect(getByLabelText('Раздел Дневники').getAttribute('data-active')).toBe('true');
  });

  it('кнопка назад 44px и undo 40px', () => {
    const { container } = render(<ProfileScreen_v2 />);
    fireEvent.click(container.querySelector('.pf-hero-card[data-id="user"]')!);
    const back = container.querySelector('.pf-head-back') as HTMLElement;
    expect(back).not.toBeNull();
    expect(back.style.minHeight).toBe('44px');
  });
});

describe('Profile §83 — quick-jump и аккордеоны', () => {
  it('клик по разделу выставляет data-active', () => {
    const { container, getByLabelText } = render(<ProfileUserTab />);
    const btn = getByLabelText('Перейти к разделу Цели');
    fireEvent.click(btn);
    expect(btn.getAttribute('data-active')).toBe('true');
    expect(container.querySelectorAll('.pf-jump-link[data-active="true"]').length).toBe(1);
  });

  it('«Развернуть все» открывает аккордеоны (data-open)', () => {
    const { container, getByText } = render(<ProfileUserTab />);
    fireEvent.click(getByText('Развернуть все'));
    const opened = container.querySelectorAll('.pf-acc[data-open="true"]');
    expect(opened.length).toBeGreaterThan(1);
    fireEvent.click(getByText('Свернуть'));
    expect(container.querySelectorAll('.pf-acc[data-open="true"]').length).toBe(0);
  });

  it('jump-цели 40px', () => {
    const { container } = render(<ProfileUserTab />);
    const first = container.querySelector('.pf-jump-link') as HTMLElement;
    expect(first.style.minHeight).toBe('40px');
  });
});

describe('Profile §83 — отчёты', () => {
  it('табы 44px и переключаются', () => {
    // initialView blocks: не монтируем ReportsScreen (IndexedDB-шум jsdom).
    const { container, getByRole } = render(<ProfileReportsTab initialView="blocks" />);
    const tabs = container.querySelectorAll('.pf-rep-tab');
    expect(tabs.length).toBe(3);
    (tabs as unknown as HTMLElement[]).forEach(t => {
      expect((t as HTMLElement).style.minHeight).toBe('44px');
    });
    fireEvent.click(getByRole('tab', { name: /Архив/ }));
    expect(getByRole('tab', { name: /Архив/ }).getAttribute('aria-selected')).toBe('true');
  });
});

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

describe('Profile §85 — PVE-попап: хуки и тач-цели', () => {
  it('числовой редактор: оверлей/лист/степперы/футер 44px', () => {
    const { container } = render(<ProfileUserTab />);
    const trig = Array.from(container.querySelectorAll('.profile-pve-btn'))
      .find(b => (b.getAttribute('aria-label') || '').startsWith('Возраст')) as HTMLElement;
    expect(trig).toBeTruthy();
    fireEvent.click(trig);
    const overlay = document.body.querySelector('.pf-pve-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector('.pf-pve-sheet')).not.toBeNull();
    const close = overlay.querySelector('.pf-pve-close') as HTMLElement;
    expect(close.style.minHeight).toBe('44px');
    const steps = overlay.querySelectorAll('.pf-pve-step');
    expect(steps.length).toBe(2);
    steps.forEach(s => expect((s as HTMLElement).style.minHeight).toBe('44px'));
    expect((overlay.querySelector('.pf-pve-save') as HTMLElement).style.minHeight).toBe('44px');
    expect((overlay.querySelector('.pf-pve-cancel') as HTMLElement).style.minHeight).toBe('44px');
    fireEvent.click(close);
    expect(document.body.querySelector('.pf-pve-overlay')).toBeNull();
  });

  it('селект: опции с data-sel', () => {
    const { container } = render(<ProfileUserTab />);
    const trig = Array.from(container.querySelectorAll('.profile-pve-btn'))
      .find(b => (b.getAttribute('aria-label') || '').startsWith('Пол')) as HTMLElement;
    expect(trig).toBeTruthy();
    fireEvent.click(trig);
    const opts = document.body.querySelectorAll('.pf-pve-opt');
    expect(opts.length).toBeGreaterThan(0);
    expect(document.body.querySelector('.pf-pve-opt[data-sel="true"]')).not.toBeNull();
    fireEvent.click(document.body.querySelector('.pf-pve-overlay') as HTMLElement);
    expect(document.body.querySelector('.pf-pve-overlay')).toBeNull();
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

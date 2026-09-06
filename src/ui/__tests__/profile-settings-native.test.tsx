/**
 * profile-settings-native.test.tsx — Настройки профиля: раздел «Телефон · APK»
 * виден только в native, в Telegram/web его нет (классика 1-в-1).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ProfileSettingsTab } from '../screens/ProfileScreen_v2/ProfileSettingsTab';

function setCapacitorNative() {
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
  };
}

async function resetPlatform() {
  const { resetAppPlatformCache } = await import('../../core/app-platform');
  resetAppPlatformCache();
}

beforeEach(async () => {
  vi.unstubAllEnvs();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  try {
    window.location.hash = '';
  } catch {
    /* ignore */
  }
  await resetPlatform();
});

afterEach(async () => {
  cleanup();
  vi.unstubAllEnvs();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  await resetPlatform();
});

describe('ProfileSettingsTab phone section', () => {
  it('1. native → раздел 4.4 с виджетами, биометрией и возможностями', async () => {
    setCapacitorNative();
    await resetPlatform();
    render(<ProfileSettingsTab />);
    expect(screen.getByText('4.4 Телефон · APK')).not.toBeNull();
    // Аккордеон закрыт по умолчанию — раскрываем
    fireEvent.click(screen.getByText('4.4 Телефон · APK'));
    expect(screen.getByText('Виджеты на рабочий стол')).not.toBeNull();
    expect(screen.getByText('Биометрия')).not.toBeNull();
    expect(screen.getByText('Возможности APK')).not.toBeNull();
  });

  it('2. native → кнопка пина виджета и инструкция на месте', async () => {
    setCapacitorNative();
    await resetPlatform();
    render(<ProfileSettingsTab />);
    fireEvent.click(screen.getByText('4.4 Телефон · APK'));
    expect(screen.getAllByText('📌 На стол').length).toBe(4);
    expect(screen.getByText('Как добавить вручную')).not.toBeNull();
  });

  it('3. web/Telegram → раздела нет, классика нетронута (4.1–4.3)', async () => {
    await resetPlatform();
    const { container } = render(<ProfileSettingsTab />);
    expect(screen.queryByText('4.4 Телефон · APK')).toBeNull();
    expect(container.querySelector('.native-feature-card')).toBeNull();
    expect(screen.getByText('4.1 Системные')).not.toBeNull();
    expect(screen.getByText('4.2 Экспорт / Импорт')).not.toBeNull();
    expect(screen.getByText('4.3 Сброс')).not.toBeNull();
  });

  it('4. native → биометрия показывает проверку доступности', async () => {
    setCapacitorNative();
    await resetPlatform();
    render(<ProfileSettingsTab />);
    fireEvent.click(screen.getByText('4.4 Телефон · APK'));
    // Шапка — SVG-щит, не эмодзи (PRO-правило 1.4).
    const icons = document.querySelectorAll('.native-feature-icon');
    expect(icons.length).toBeGreaterThanOrEqual(4);
    for (const el of Array.from(icons)) {
      expect(el.querySelector('svg'), el.textContent).not.toBeNull();
      expect(el.textContent ?? '').not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('5. волна 16: все 4 шапки §4.4 — штриховые SVG 24×24', async () => {
    setCapacitorNative();
    await resetPlatform();
    render(<ProfileSettingsTab />);
    fireEvent.click(screen.getByText('4.4 Телефон · APK'));
    const svgs = document.querySelectorAll('.native-feature-icon svg');
    expect(svgs.length).toBeGreaterThanOrEqual(4);
    for (const svg of Array.from(svgs)) {
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    }
  });
});

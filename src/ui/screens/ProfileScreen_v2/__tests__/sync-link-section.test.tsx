/**
 * sync-link-section.test.tsx — поле ввода кода привязки обязано быть видно
 * везде, кроме Telegram Mini App.
 *
 * Регрессия на жалобу «в АПК нет возможности ввести код из телеграма»:
 * ввод показывался только при mode==='native' (мемоизированная платформа),
 * поэтому АПК со сбоем детекции Capacitor или dist с VITE_APP_PLATFORM=telegram
 * падал в ветку 'web' («только просмотр») без поля ввода.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

function setTelegram(userId?: number) {
  const w = window as unknown as { Telegram?: unknown };
  if (userId === undefined) {
    w.Telegram = { WebApp: { initData: '', initDataUnsafe: {} } };
    return;
  }
  w.Telegram = {
    WebApp: {
      initData: 'query_id=test',
      initDataUnsafe: { user: { id: userId } },
    },
  };
}

function setCapacitorNative(native: boolean) {
  const w = window as unknown as { Capacitor?: unknown };
  if (!native) {
    delete w.Capacitor;
    return;
  }
  w.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    platform: 'android',
  };
}

async function renderSection() {
  vi.resetModules();
  const { SyncLinkSection } = await import('../SyncLinkSection');
  render(<SyncLinkSection />);
}

describe('SyncLinkSection — видимость ввода кода', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    delete (window as unknown as { Telegram?: unknown }).Telegram;
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  });

  it('native (АПК): поле ввода кода видно', async () => {
    setCapacitorNative(true);
    await renderSection();
    expect(screen.getByLabelText('Код привязки из Telegram')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Привязать к Telegram/ })).toBeTruthy();
  });

  it('web (браузер, Capacitor не детектится): поле ввода кода ВСЁ РАВНО видно', async () => {
    setTelegram(); // голый скрипт без user — не Telegram-контекст
    setCapacitorNative(false);
    await renderSection();
    expect(screen.getByLabelText('Код привязки из Telegram')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Привязать к Telegram/ })).toBeTruthy();
  });

  it('telegram: поле ввода скрыто, видна генерация кода', async () => {
    setTelegram(12345);
    setCapacitorNative(false);
    await renderSection();
    expect(screen.queryByLabelText('Код привязки из Telegram')).toBeNull();
    expect(screen.getByRole('button', { name: /Создать код для АПК/ })).toBeTruthy();
  });

  it('native + форсированный VITE_APP_PLATFORM=telegram: ввод всё равно виден', async () => {
    // dist, собранный с оверрайдом для ТГ, но запущенный в АПК:
    // живые детекторы игнорируют VITE_APP_PLATFORM, ввод не прячется.
    setTelegram(); // в АПК нет TG-пользователя — только голый скрипт
    setCapacitorNative(true);
    vi.stubEnv('VITE_APP_PLATFORM', 'telegram');
    await renderSection();
    expect(screen.getByLabelText('Код привязки из Telegram')).toBeTruthy();
  });
});

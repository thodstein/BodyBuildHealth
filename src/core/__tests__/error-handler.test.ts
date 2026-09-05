/**
 * error-handler.test.ts — оверлей «Приложение восстановлено» только для
 * фатального краша ДО готовности. Фоновый шум после — тихо в лог, иначе
 * пользователь получает вечный цикл «ошибка → перезагрузка».
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { initErrorHandler, markBooted } from '../error-handler';

function overlay(): HTMLElement | null {
  return document.getElementById('error-fallback');
}

function overlayShown(): boolean {
  return overlay()?.style.display === 'flex';
}

beforeEach(() => {
  try {
    document.getElementById('error-fallback')?.remove();
    if (!document.getElementById('app')) {
      const root = document.createElement('div');
      root.id = 'app';
      document.body.appendChild(root);
    }
  } catch {}
  try {
    localStorage.clear();
  } catch {}
});

describe('error-handler overlay policy', () => {
  it('фатальная ошибка до готовности → оверлей виден', () => {
    initErrorHandler('app');
    window.dispatchEvent(
      new ErrorEvent('error', { message: 'boot crash', error: new Error('boot crash') }),
    );
    expect(overlayShown()).toBe(true);
    const reports = JSON.parse(localStorage.getItem('he_crash_reports') || '[]');
    expect(reports.length).toBeGreaterThan(0);
  });

  it('после markBooted: ошибка ресурса и реджект — без оверлея, но в лог', () => {
    markBooted();
    // Ошибка ресурса (нет e.error, target — элемент): вообще не краш.
    const img = document.createElement('img');
    document.body.appendChild(img);
    img.dispatchEvent(new Event('error'));
    expect(overlayShown()).toBe(false);
    // Фоновый реджект после готовности: в отчёты, без оверлея.
    // (jsdom не знает PromiseRejectionEvent — собираем вручную.)
    const rejection = new Event('unhandledrejection') as Event & { reason?: unknown };
    rejection.reason = new Error('bg sync fail');
    window.dispatchEvent(rejection);
    expect(overlayShown()).toBe(false);
    const reports = JSON.parse(localStorage.getItem('he_crash_reports') || '[]');
    expect(reports.length).toBeGreaterThan(0);
    img.remove();
  });
});

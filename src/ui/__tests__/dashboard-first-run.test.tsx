/**
 * dashboard-first-run.test.tsx — first-run empty state Главной (только APK).
 * Нулевая история → карточка NativeEmpty с CTA; после первой сессии её нет.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@testing-library/react';
import { DashboardNative } from '../screens/DashboardScreen.native';
import { resetAppPlatformCache } from '../../core/app-platform';
import {
  startSession,
  finishSession,
} from '../../engines/workout-logger.engine';

function setCapacitorNative() {
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
  };
}

beforeEach(async () => {
  try {
    localStorage.clear();
  } catch {}
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  resetAppPlatformCache();
});

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {}
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  resetAppPlatformCache();
});

describe('DashboardNative first-run', () => {
  it('пустая история → CTA первой тренировки ведёт в тренинг', () => {
    setCapacitorNative();
    resetAppPlatformCache();
    const calls: string[] = [];
    render(<DashboardNative onNavigate={(s) => calls.push(s)} />);
    expect(screen.getByText('Первая тренировка ждёт')).not.toBeNull();
    fireEvent.click(screen.getByText(/К тренингу/));
    expect(calls).toEqual(['training']);
  });

  it('после первой сессии карточки нет', () => {
    setCapacitorNative();
    resetAppPlatformCache();
    const s = startSession('Тест', 1);
    finishSession({ ...s, date: '2026-09-05' }, '');
    render(<DashboardNative />);
    expect(screen.queryByText('Первая тренировка ждёт')).toBeNull();
  });
});

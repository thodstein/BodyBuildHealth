/**
 * native-back-interceptors.test.ts — аппаратная «назад» в APK.
 *
 * Регрессия: открытый лист выбора / диалог подтверждения / шаг мастера
 * закрывались не сами, а выбрасывали пользователя на главную вкладку
 * (глобальный обработчик App). Тест фиксирует порядок LIFO и то, что
 * обработанное событие не доходит до глобального onBack.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const listeners: Array<{ event: string; cb: () => void }> = [];

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (event: string, cb: () => void) => {
      listeners.push({ event, cb });
      return { remove: vi.fn() };
    }),
    minimizeApp: vi.fn(async () => undefined),
    exitApp: vi.fn(async () => undefined),
  },
}));

vi.mock('../app-platform', () => ({
  isCapacitorNative: () => true,
  isNativeApp: () => true,
}));

vi.mock('../telegram', () => ({ hapticImpact: vi.fn() }));

import { registerBackInterceptor, setupNativeBackButton } from '../native-bridge';

describe('APK back interceptors', () => {
  beforeEach(() => {
    listeners.length = 0;
  });

  it('открытый оверлей перехватывает «назад» и не пускает глобальный обработчик', async () => {
    const globalBack = vi.fn(() => true);
    const closeSheet = vi.fn(() => true);
    await setupNativeBackButton(globalBack);
    const off = registerBackInterceptor(closeSheet);
    const cb = listeners.find(l => l.event === 'backButton')!.cb;

    cb();
    expect(closeSheet).toHaveBeenCalledTimes(1);
    expect(globalBack).not.toHaveBeenCalled();

    off();
    cb();
    expect(closeSheet).toHaveBeenCalledTimes(1);
    expect(globalBack).toHaveBeenCalledTimes(1);
  });

  it('LIFO: последний зарегистрированный обрабатывает первым', async () => {
    const order: string[] = [];
    await setupNativeBackButton(() => { order.push('global'); return true; });
    const offA = registerBackInterceptor(() => { order.push('a'); return true; });
    const offB = registerBackInterceptor(() => { order.push('b'); return true; });
    const cb = listeners.find(l => l.event === 'backButton')!.cb;

    cb();
    expect(order).toEqual(['b']);
    offB();
    cb();
    expect(order).toEqual(['b', 'a']);
    offA();
    cb();
    expect(order).toEqual(['b', 'a', 'global']);
  });

  it('перехватчик, вернувший false, пропускает событие дальше', async () => {
    const globalBack = vi.fn(() => true);
    await setupNativeBackButton(globalBack);
    registerBackInterceptor(() => false);
    const cb = listeners.find(l => l.event === 'backButton')!.cb;

    cb();
    expect(globalBack).toHaveBeenCalledTimes(1);
  });
});

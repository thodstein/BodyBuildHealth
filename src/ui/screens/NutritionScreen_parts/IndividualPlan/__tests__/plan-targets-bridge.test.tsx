/**
 * plan-targets-bridge.test.tsx — единый мост «цели плана → hero/дневник».
 *
 * Регресс на баг: hero Питания и дневник считали цели отдельно (calcNutrition из
 * профиля) и не совпадали с целями, заданными пользователем в Плане.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import {
  publishPlanTargets,
  readPlanTargets,
  parsePlanTargets,
  clearPlanTargets,
  PLAN_TARGETS_KEY,
  PLAN_TARGETS_EVENT,
} from '../plan-targets-bridge';
import { NutritionScreen } from '../../../NutritionScreen';

function setCapacitorNative() {
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
  };
}

async function resetPlatform() {
  const { resetAppPlatformCache } = await import('../../../../../core/app-platform');
  resetAppPlatformCache();
}

describe('plan-targets-bridge — публикация и чтение целей плана', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
  });

  it('1. publish → localStorage + read возвращает те же цели', () => {
    publishPlanTargets({ kcal: 2650, protein: 190, fats: 80, carbs: 300 });
    expect(readPlanTargets()).toEqual({ kcal: 2650, protein: 190, fats: 80, carbs: 300 });
    expect(JSON.parse(localStorage.getItem(PLAN_TARGETS_KEY) as string).kcal).toBe(2650);
  });

  it('2. publish диспатчит событие с detail', () => {
    const spy = vi.fn();
    window.addEventListener(PLAN_TARGETS_EVENT, spy as EventListener);
    publishPlanTargets({ kcal: 2400, protein: 180, fats: 70, carbs: 250 });
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener(PLAN_TARGETS_EVENT, spy as EventListener);
  });

  it('3. мусор/частичный объект не публикуется и не читается', () => {
    publishPlanTargets({ kcal: 0, protein: 100, fats: 50, carbs: 200 });
    expect(readPlanTargets()).toBeNull();
    localStorage.setItem(PLAN_TARGETS_KEY, JSON.stringify({ kcal: 2000, protein: 100 }));
    expect(readPlanTargets()).toBeNull();
    localStorage.setItem(PLAN_TARGETS_KEY, '{broken');
    expect(readPlanTargets()).toBeNull();
  });

  it('4. parsePlanTargets: валидное/NaN/отрицательное', () => {
    expect(parsePlanTargets(null)).toBeNull();
    expect(parsePlanTargets({ kcal: 2200, protein: 160, fats: 60, carbs: 280 })).toEqual({ kcal: 2200, protein: 160, fats: 60, carbs: 280 });
    expect(parsePlanTargets({ kcal: NaN, protein: 160, fats: 60, carbs: 280 })).toBeNull();
    expect(parsePlanTargets({ kcal: 2200, protein: -1, fats: 60, carbs: 280 })).toBeNull();
  });

  it('5. clearPlanTargets убирает публикацию', () => {
    publishPlanTargets({ kcal: 2300, protein: 170, fats: 75, carbs: 270 });
    expect(readPlanTargets()).not.toBeNull();
    clearPlanTargets();
    expect(readPlanTargets()).toBeNull();
  });
});

describe('NutritionScreen hero — цели совпадают с целями плана', () => {
  beforeEach(async () => {
    try { localStorage.clear(); } catch { /* ignore */ }
    vi.unstubAllEnvs();
    delete (window as unknown as { Telegram?: unknown }).Telegram;
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
    await resetPlatform();
  });

  afterEach(async () => {
    cleanup();
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
    await resetPlatform();
  });

  it('6. hero показывает цель из Плана, а не профильный расчёт', async () => {
    publishPlanTargets({ kcal: 2650, protein: 190, fats: 80, carbs: 300 });
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<NutritionScreen />);
    expect(container.querySelector('.nutrition-hero-stats')).not.toBeNull();
    expect(screen.getByText(/\/ 2650/)).not.toBeNull();
    expect(screen.getByText(/\/ 190 г/)).not.toBeNull();
  });

  it('7. без целей плана hero показывает цель из профильного расчёта (регресс не сломан)', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<NutritionScreen />);
    expect(container.querySelector('.nutrition-hero-stats')).not.toBeNull();
    // Есть цель ккал/белка (значение зависит от профиля), но не 2650 из плана.
    expect(screen.queryByText(/\/ 2650/)).toBeNull();
    expect(container.querySelectorAll('.nutrition-hero-stat-v').length).toBeGreaterThan(0);
  });

  it('8. обновление целей плана вживую меняет hero через событие', async () => {
    setCapacitorNative();
    await resetPlatform();
    render(<NutritionScreen />);
    publishPlanTargets({ kcal: 3100, protein: 200, fats: 90, carbs: 350 });
    expect(await screen.findByText(/\/ 3100/)).not.toBeNull();
    expect(await screen.findByText(/\/ 200 г/)).not.toBeNull();
  });
});

/**
 * hubs-deep-native.test.tsx — глубокий слой: кит планировщика, сабтабы
 * анализов/рисков, таббар плана. Поведение не изменилось.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GlassCard, PillBtn } from '../screens/NutritionScreen_parts/IndividualPlan/ui';
import { LabsScreen } from '../screens/LabsScreen';
import { RiskScreen } from '../screens/RiskScreen';
import { NutritionScreen } from '../screens/NutritionScreen';

async function resetPlatform() {
  const { resetAppPlatformCache } = await import('../../core/app-platform');
  resetAppPlatformCache();
}

function setCapacitorNative() {
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
  };
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

describe('plan kit (ui.tsx)', () => {
  it('1. GlassCard рендерит заголовок и класс', () => {
    const { container } = render(
      <GlassCard title="Тест" icon="📅" color="#00e68a">
        <div>тело</div>
      </GlassCard>,
    );
    expect(container.querySelector('.plan-glass')).not.toBeNull();
    expect(screen.getByText('Тест')).not.toBeNull();
    expect(screen.getByText('тело')).not.toBeNull();
  });

  it('2. PillBtn маркирует active и кликается', () => {
    const onClick = vi.fn();
    const { container, rerender } = render(
      <PillBtn active={false} onClick={onClick}>
        Пилюля
      </PillBtn>,
    );
    const btn = container.querySelector('.plan-pill') as HTMLElement;
    expect(btn?.dataset.active).toBe('false');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <PillBtn active={true} onClick={onClick}>
        Пилюля
      </PillBtn>,
    );
    expect(btn?.dataset.active).toBe('true');
  });
});

describe('labs/risk deep nav', () => {
  it('3. Labs: раздел → сабтабы с хуками', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<LabsScreen />);
    fireEvent.click(
      container.querySelector('.labs-hero-card[data-id="lab"]') as HTMLElement,
    );
    const subtabs = container.querySelectorAll('.labs-subtab');
    expect(subtabs.length).toBeGreaterThan(0);
    expect(
      container.querySelector('.labs-subtab[data-active="true"]'),
    ).not.toBeNull();
  });

  it('4. Risk: раздел → сабтабы с хуками', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<RiskScreen />);
    fireEvent.click(
      container.querySelector('.risk-hero-card[data-id="tz_spec"]') as HTMLElement,
    );
    expect(container.querySelectorAll('.risk-subtab').length).toBeGreaterThan(0);
  });

  it('5. Nutrition: рацион → таббар конструктора', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<NutritionScreen />);
    fireEvent.click(
      container.querySelector(
        '.nutrition-hero-card[data-section="ration"]',
      ) as HTMLElement,
    );
    // Бургер-меню: чипы открываются по ☰ — жмём именно «План», первый чип теперь Дневник.
    fireEvent.click(
      container.querySelector('[aria-label="Меню питания"]') as HTMLElement,
    );
    const planChip = Array.from(container.querySelectorAll('.nutrition-chip')).find((c) =>
      c.textContent?.includes('План'),
    ) as HTMLElement;
    fireEvent.click(planChip);
    expect(container.querySelector('.plan-tabbar')).not.toBeNull();
    expect(
      container.querySelectorAll('.plan-tab').length,
    ).toBeGreaterThan(0);
  });
});

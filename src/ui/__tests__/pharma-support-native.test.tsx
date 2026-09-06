/**
 * pharma-support-native.test.tsx — Фарма и БАДы: hero цел на обеих платформах,
 * native-классы на месте, навигация работает.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { PharmaScreen } from '../screens/PharmaScreen_parts/index';
import { SupportHomeView } from '../screens/SupportScreen_parts/SupportHomeView';

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

describe('PharmaScreen hero', () => {
  it('1. native → hero + квик-статы + 4 карточки', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<PharmaScreen />);
    const img = container.querySelector(
      '.pharma-hero img',
    ) as HTMLImageElement | null;
    expect(img?.getAttribute('src')).toContain('pharma-hero.png');
    expect(container.querySelector('.pharma-hero-quickstats')).not.toBeNull();
    expect(container.querySelectorAll('.pharma-hero-card').length).toBe(4);
  });

  it('2. web → та же классика (hero, статы, 4 карточки)', async () => {
    await resetPlatform();
    const { container } = render(<PharmaScreen />);
    expect(container.querySelector('.pharma-hero')).not.toBeNull();
    expect(container.querySelectorAll('.pharma-hero-card').length).toBe(4);
  });

  it('3. навигация hero → Курс работает', async () => {
    await resetPlatform();
    const { container } = render(<PharmaScreen />);
    const course = container.querySelector(
      '.pharma-hero-card[data-key="course"]',
    ) as HTMLElement;
    expect(course).not.toBeNull();
    fireEvent.click(course);
    expect(container.querySelector('.pharma-hero')).toBeNull();
  });
});

describe('SupportHomeView hero', () => {
  const mockS = () => ({
    setSection: vi.fn(),
    setTab: vi.fn(),
    setSupportView: vi.fn(),
    setCalcView: vi.fn(),
    setInfoView: vi.fn(),
    setProtocolTab: vi.fn(),
  });

  it('4. hero + 3 карточки на месте', async () => {
    await resetPlatform();
    const { container } = render(<SupportHomeView s={mockS()} />);
    const img = container.querySelector(
      '.support-hero img',
    ) as HTMLImageElement | null;
    expect(img?.getAttribute('src')).toContain('support-hero.jpg');
    expect(container.querySelectorAll('.support-hero-card').length).toBe(3);
  });

  it('5. клик по карточке ведёт в калькулятор', async () => {
    await resetPlatform();
    const s = mockS();
    const { container } = render(<SupportHomeView s={s} />);
    const calc = container.querySelector(
      '.support-hero-card[data-key="calc"]',
    ) as HTMLElement;
    fireEvent.click(calc);
    expect(s.setSection).toHaveBeenCalledWith('generator');
    expect(s.setCalcView).toHaveBeenCalledWith('main');
  });

  it('6. клик по протоколам открывает протоколы', async () => {
    setCapacitorNative();
    await resetPlatform();
    const s = mockS();
    const { container } = render(<SupportHomeView s={s} />);
    const proto = container.querySelector(
      '.support-hero-card[data-key="protocols"]',
    ) as HTMLElement;
    fireEvent.click(proto);
    expect(s.setSection).toHaveBeenCalledWith('protocols');
  });
});

describe('волна 12: pharma-subtabs', () => {
  it('7. калькуляторы и каталог несут липкий саббар', async () => {
    await resetPlatform();
    const { container } = render(<PharmaScreen />);
    const calc = container.querySelector(
      '.pharma-hero-card[data-key="calculators"]',
    ) as HTMLElement;
    fireEvent.click(calc);
    expect(container.querySelector('.pharma-subtabs')).not.toBeNull();
    cleanup();
    const second = render(<PharmaScreen />);
    const info = second.container.querySelector(
      '.pharma-hero-card[data-key="info"]',
    ) as HTMLElement;
    fireEvent.click(info);
    expect(second.container.querySelector('.pharma-subtabs')).not.toBeNull();
  });
});

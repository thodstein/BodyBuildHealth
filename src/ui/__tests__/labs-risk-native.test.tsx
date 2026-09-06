/**
 * labs-risk-native.test.tsx — Анализы и Риски: native hero со сводкой,
 * классика без изменений, навигация hero ↔ разделы на обеих платформах.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LabsScreen } from '../screens/LabsScreen';
import { RiskScreen } from '../screens/RiskScreen';

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

describe('LabsScreen native hero', () => {
  it('1. native → тот же hero + сводка (маркеры/панель/тревоги)', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<LabsScreen />);
    const img = container.querySelector(
      '.labs-hero img',
    ) as HTMLImageElement | null;
    expect(img?.getAttribute('src')).toContain('lab-hero.png');
    expect(container.querySelector('.labs-hero-stats')).not.toBeNull();
    expect(screen.getByText('маркеров')).not.toBeNull();
    expect(screen.getByText('панель готова')).not.toBeNull();
    expect(container.querySelectorAll('.labs-hero-card').length).toBe(2);
  });

  it('2. web/Telegram → hero без сводки (классика нетронута)', async () => {
    await resetPlatform();
    const { container } = render(<LabsScreen />);
    expect(container.querySelector('.labs-hero-stats')).toBeNull();
    expect(screen.getByText('Лаборатория')).not.toBeNull();
  });

  it('3. навигация hero → раздел работает на native', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<LabsScreen />);
    const card = container.querySelector(
      '.labs-hero-card[data-id="lab"]',
    ) as HTMLElement;
    expect(card).not.toBeNull();
    fireEvent.click(card);
    expect(container.querySelector('.labs-topnav')).not.toBeNull();
  });
});

describe('RiskScreen native hero', () => {
  it('4. native → тот же hero + сводка (нетто/брутто)', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<RiskScreen />);
    const img = container.querySelector(
      '.risk-hero img',
    ) as HTMLImageElement | null;
    expect(img?.getAttribute('src')).toContain('risk-hero.png');
    expect(container.querySelector('.risk-hero-stats')).not.toBeNull();
    expect(screen.getByText(/нетто ·/)).not.toBeNull();
    expect(container.querySelectorAll('.risk-hero-card').length).toBe(3);
  });

  it('5. web/Telegram → hero без сводки (классика нетронута)', async () => {
    await resetPlatform();
    const { container } = render(<RiskScreen />);
    expect(container.querySelector('.risk-hero-stats')).toBeNull();
    expect(screen.getByText('Оценка рисков')).not.toBeNull();
  });

  it('6. навигация hero → раздел работает в web', async () => {
    await resetPlatform();
    const { container } = render(<RiskScreen />);
    const card = container.querySelector(
      '.risk-hero-card[data-id="tz_spec"]',
    ) as HTMLElement;
    fireEvent.click(card);
    expect(container.querySelector('.risk-topnav')).not.toBeNull();
  });
});

describe('волна 12: липкая внутренняя навигация', () => {
  it('7. CSS §69: сабтабы липнут под шапкой (labs/risk/pharma)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const css = fs.readFileSync(path.join(process.cwd(), 'src', 'styles-native.css'), 'utf-8');
    const i = css.indexOf('69. STICKY INNER NAV');
    expect(i).toBeGreaterThan(-1);
    const block = css.slice(i, i + 2500);
    expect(block).toContain('.labs-subtabs');
    expect(block).toContain('.risk-subtabs');
    expect(block).toContain('.pharma-subtabs');
    expect(block).toContain('position: sticky');
    expect(block).toContain('top: calc(env(safe-area-inset-top, 0px) + 46px)');
    // Все селекторы слоя — только под html.app-native (TG 1-в-1).
    for (const line of block.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('/*') || t.startsWith('*')) continue;
      if (!t.endsWith('{')) continue;
      const sel = t.slice(0, -1).trim();
      if (!sel || sel.startsWith('@')) continue;
      for (const p of sel.split(',').map((s) => s.trim()).filter(Boolean)) {
        expect(p.startsWith('html.app-native'), p).toBe(true);
      }
    }
  });

  it('8. labs: сабтабы остаются в DOM после входа в раздел', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<LabsScreen />);
    const card = container.querySelector(
      '.labs-hero-card[data-id="lab"]',
    ) as HTMLElement;
    fireEvent.click(card);
    expect(container.querySelector('.labs-subtabs')).not.toBeNull();
    expect(container.querySelectorAll('.labs-subtab').length).toBeGreaterThan(0);
  });
});

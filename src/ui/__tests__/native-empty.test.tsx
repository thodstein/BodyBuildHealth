/**
 * native-empty.test.tsx — пустые состояния APK: SVG-арт, CTA,
 * native-гейты (в Telegram классика без изменений).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NativeEmpty, NativeEmptyArt } from '../native/NativeEmpty';
import { DayMealsList } from '../screens/NutritionScreen_parts/diary/DayMealsList';
import { CompetitionPlansView } from '../screens/TrainingScreen_parts/CompetitionPlansView';
import { EmptyState } from '../screens/TrainingScreen_parts/CardioUI';

function setCapacitorNative() {
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
  };
}

async function resetPlatform() {
  const { resetAppPlatformCache } = await import('../../core/app-platform');
  resetAppPlatformCache();
}

const noop = () => {};

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

describe('NativeEmpty kit', () => {
  it('1. все 11 артов рендерят SVG', () => {
    for (const kind of ['plate', 'dumbbell', 'chart', 'trophy', 'clipboard', 'shield', 'flask', 'pill', 'leaf', 'message', 'file'] as const) {
      const { container, unmount } = render(<NativeEmptyArt kind={kind} />);
      const svg = container.querySelector('.native-empty-art svg');
      expect(svg, kind).not.toBeNull();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 96 96');
      unmount();
    }
  });

  it('1b. арты красятся переменными акцента, не hex', () => {
    for (const kind of ['shield', 'flask', 'pill', 'leaf', 'message', 'file'] as const) {
      const { container, unmount } = render(<NativeEmptyArt kind={kind} />);
      const html = container.innerHTML;
      expect(html, kind).toContain('var(--accent)');
      expect(html, kind).not.toMatch(/#c9f73a|#00e68a/i);
      unmount();
    }
  });

  it('2. CTA вызывает хендлер, без экшена кнопки нет', () => {
    const onAction = vi.fn();
    const { container, rerender } = render(
      <NativeEmpty title="Пусто" hint="Подсказка" actionLabel="Добавить" onAction={onAction} />,
    );
    expect(screen.getByText('Пусто')).not.toBeNull();
    fireEvent.click(screen.getByText('Добавить'));
    expect(onAction).toHaveBeenCalledTimes(1);
    rerender(<NativeEmpty title="Пусто" />);
    expect(container.querySelector('.native-empty-cta')).toBeNull();
  });
});

describe('DayMealsList empty', () => {
  const props = {
    dayMeals: {},
    onEditItem: noop,
    onDeleteItem: noop,
    onCopyMeal: noop,
    onSavePreset: noop,
    onClearDay: noop,
    onFillMicros: noop,
    selectedDate: '2026-01-01',
    copySource: null,
    onPasteMeal: noop,
    onCancelCopy: noop,
  };

  it('3. native → арт + CTA импорта из плана', async () => {
    setCapacitorNative();
    await resetPlatform();
    const onImport = vi.fn();
    const { container } = render(<DayMealsList {...props} onImportFromPlan={onImport} />);
    expect(container.querySelector('.day-empty')).not.toBeNull();
    expect(container.querySelector('.day-empty .native-empty-art svg')).not.toBeNull();
    fireEvent.click(screen.getByText('📥 Импорт из плана'));
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it('4. web → классика без изменений (эмодзи, без CTA)', async () => {
    await resetPlatform();
    const { container } = render(<DayMealsList {...props} onImportFromPlan={noop} />);
    expect(container.querySelector('.day-empty')).not.toBeNull();
    expect(container.querySelector('.native-empty-art')).toBeNull();
    expect(container.querySelector('.day-empty-cta')).toBeNull();
    expect(screen.getByText('Пока пусто — начните день')).not.toBeNull();
  });
});

describe('CompetitionPlansView + EmptyState', () => {
  it('5. native → арт трофея в пустом состоянии', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<CompetitionPlansView />);
    expect(container.querySelector('.comp-empty')).not.toBeNull();
    expect(container.querySelector('.comp-empty .native-empty-art svg')).not.toBeNull();
    expect(screen.getByText(/Пока нет сохранённых соревновательных циклов/)).not.toBeNull();
  });

  it('6. web → без арта, текст на месте', async () => {
    await resetPlatform();
    const { container } = render(<CompetitionPlansView />);
    expect(container.querySelector('.comp-empty')).not.toBeNull();
    expect(container.querySelector('.native-empty-art')).toBeNull();
  });

  it('7. EmptyState: кастомный арт и класс', () => {
    const { container } = render(
      <EmptyState
        icon="📭"
        title="Пусто"
        desc="Описание"
        art={<div className="custom-art">арт</div>}
      />,
    );
    expect(container.querySelector('.kit-empty')).not.toBeNull();
    expect(container.querySelector('.custom-art')).not.toBeNull();
  });

  it('8. EmptyState: по умолчанию иконка-эмодзи', async () => {
    const { container } = render(<EmptyState icon="📭" title="Пусто" />);
    expect(screen.getByText('📭')).not.toBeNull();
    expect(container.querySelector('.custom-art')).toBeNull();
  });
});

describe('CSS §71 (состояния контента)', () => {
  it('9. кромки/stale/error под html.app-native', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const css = fs.readFileSync(path.join(process.cwd(), 'src', 'styles-native.css'), 'utf-8');
    const i = css.indexOf('71. CONTENT STATES PRO');
    expect(i).toBeGreaterThan(-1);
    const block = css.slice(i, i + 5000);
    for (const sel of ['.native-edge-ok', '.native-edge-warn', '.native-edge-bad', '.native-edge-info', '.native-stale', '.native-error']) {
      expect(block, sel).toContain(sel);
    }
    expect(block).toContain("data-level='fresh'");
    expect(block).toContain("data-level='stale'");
    expect(block).toContain('tabular-nums');
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
});

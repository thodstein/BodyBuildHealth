/**
 * articles-reader-controls.test.tsx — читалка статей: панель A-/A+, прогресс,
 * персист кегля. Только подача (white text / 44px / мобайл), логика не тронута.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ArticlesScreen } from '../screens/ArticlesScreen';

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

function goToList(container: HTMLElement) {
  const first = container.querySelector('.articles-hero-card') as HTMLElement;
  expect(first).not.toBeNull();
  fireEvent.click(first);
  expect(container.querySelector('.articles-toolbar')).not.toBeNull();
}

/** Кликает первую НЕ-pdf карточку; возвращает true если открылась читалка. */
function openFirstMarkdownArticle(container: HTMLElement): boolean {
  const grid = container.querySelector('.articles-grid');
  if (!grid) return false;
  for (const child of Array.from(grid.children)) {
    const el = child as HTMLElement;
    if (el.textContent && el.textContent.includes('Открыть PDF')) continue;
    fireEvent.click(el);
    if (container.querySelector('.articles-reader')) return true;
  }
  return false;
}

describe('ArticlesScreen reader controls', () => {
  it('1. читалка открывается с панелью шрифта и прогрессом', () => {
    const { container } = render(<ArticlesScreen />);
    goToList(container);
    expect(openFirstMarkdownArticle(container)).toBe(true);
    expect(container.querySelector('.articles-reader')).not.toBeNull();
    expect(container.querySelector('.articles-progress')).not.toBeNull();
    expect(container.querySelector('.articles-fontbar')).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Увеличить шрифт"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Уменьшить шрифт"]'),
    ).not.toBeNull();
  });

  it('2. A+ / A- меняют кегль и пишут персист', () => {
    const { container } = render(<ArticlesScreen />);
    goToList(container);
    expect(openFirstMarkdownArticle(container)).toBe(true);
    const plus = container.querySelector(
      '[aria-label="Увеличить шрифт"]',
    ) as HTMLElement;
    const minus = container.querySelector(
      '[aria-label="Уменьшить шрифт"]',
    ) as HTMLElement;
    expect(minus.hasAttribute('disabled')).toBe(true); // дефолт 14 — минимум
    fireEvent.click(plus);
    expect(localStorage.getItem('he_articles_font_v1')).toBe('16');
    fireEvent.click(plus);
    expect(localStorage.getItem('he_articles_font_v1')).toBe('18');
    expect(plus.hasAttribute('disabled')).toBe(true); // упор в максимум
    fireEvent.click(minus);
    expect(localStorage.getItem('he_articles_font_v1')).toBe('16');
  });

  it('3. кегль восстанавливается после переоткрытия читалки', () => {
    const { container } = render(<ArticlesScreen />);
    goToList(container);
    expect(openFirstMarkdownArticle(container)).toBe(true);
    fireEvent.click(
      container.querySelector('[aria-label="Увеличить шрифт"]') as HTMLElement,
    );
    // назад к списку и открыть заново — init идёт из localStorage
    fireEvent.click(
      container.querySelector('.articles-reader-bar button') as HTMLElement,
    );
    expect(container.querySelector('.articles-reader')).toBeNull();
    expect(openFirstMarkdownArticle(container)).toBe(true);
    expect(container.querySelector('.articles-fontbar')?.textContent).toContain(
      '16',
    );
  });
});

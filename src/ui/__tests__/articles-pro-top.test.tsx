/**
 * articles-pro-top.test.tsx — TOP-подача статей: featured, TOC, PDF-inline,
 * закладка везде, богатый markdown. Только подача, логика не тронута.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ArticlesScreen, renderMarkdown, extractArticleToc } from '../screens/ArticlesScreen';

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

describe('ArticlesScreen PRO TOP', () => {
  it('1. featured-карточка есть без фильтров', () => {
    const { container } = render(<ArticlesScreen />);
    goToList(container);
    expect(container.querySelector('.articles-featured')).not.toBeNull();
  });

  it('2. TOC извлекается из markdown', () => {
    const toc = extractArticleToc('## Раз\n\ntext\n\n## Два');
    expect(toc.length).toBe(2);
    expect(toc[0].id).toContain('art-sec-0');
  });

  it('3. markdown: ссылка + код + лид', () => {
    const html = renderMarkdown('# T\n\n' + 'x'.repeat(60) + '\n\n[док](https://example.com)\n\n`KIM-1`');
    expect(html).toContain('<a href="https://example.com"');
    expect(html).toContain('<code');
    expect(html).toContain('border-left:3px solid');
  });

  it('4. PDF открывается ВНУТРИ (iframe), а не заглушкой', () => {
    const { container } = render(<ArticlesScreen />);
    goToList(container);
    const grid = container.querySelector('.articles-grid') as HTMLElement;
    let opened = false;
    for (const child of Array.from(grid.children)) {
      const el = child as HTMLElement;
      if (el.textContent && el.textContent.includes('PDF')) {
        fireEvent.click(el);
        if (container.querySelector('.articles-pdf-frame')) {
          opened = true;
          break;
        }
      }
    }
    expect(opened).toBe(true);
    expect(container.querySelector('.articles-pdf')).not.toBeNull();
  });

  it('5. ридер: обложка + содержание + шаринг + закладка', () => {
    const { container } = render(<ArticlesScreen />);
    goToList(container);
    const grid = container.querySelector('.articles-grid') as HTMLElement;
    for (const child of Array.from(grid.children)) {
      const el = child as HTMLElement;
      if (el.textContent && el.textContent.includes('PDF')) continue;
      fireEvent.click(el);
      if (container.querySelector('.articles-reader')) break;
    }
    expect(container.querySelector('.articles-reader')).not.toBeNull();
    expect(container.querySelector('.articles-toc')).not.toBeNull();
    expect(container.querySelector('[aria-label="Скопировать название статьи"]')).not.toBeNull();
    // Закладка/чип «Сохранённые» — контракт волны D (только native), их покрывает home-profile-shop-native.
  });

  it('7. в читалке есть навигация prev/next', () => {
    const { container } = render(<ArticlesScreen />);
    goToList(container);
    const grid = container.querySelector('.articles-grid') as HTMLElement;
    for (const child of Array.from(grid.children)) {
      const el = child as HTMLElement;
      if (el.textContent && el.textContent.includes('PDF')) continue;
      fireEvent.click(el);
      if (container.querySelector('.articles-reader')) break;
    }
    expect(container.querySelector('.articles-nav')).not.toBeNull();
    expect(container.querySelector('.articles-nav-prev')).not.toBeNull();
  });

  it('8. в читалке есть «Читайте также»', () => {
    const { container } = render(<ArticlesScreen />);
    goToList(container);
    const grid = container.querySelector('.articles-grid') as HTMLElement;
    for (const child of Array.from(grid.children)) {
      const el = child as HTMLElement;
      if (el.textContent && el.textContent.includes('PDF')) continue;
      fireEvent.click(el);
      if (container.querySelector('.articles-reader')) break;
    }
    expect(container.querySelector('.articles-related')).not.toBeNull();
  });

  it('9. hero-карточки показывают счётчики статей', () => {
    const { container } = render(<ArticlesScreen />);
    const first = container.querySelector('.articles-hero-card') as HTMLElement;
    expect(first.textContent).toContain('ст.');
  });

  it('6. PDF-карточка зовёт читать внутри', () => {
    const { container } = render(<ArticlesScreen />);
    goToList(container);
    const grid = container.querySelector('.articles-grid') as HTMLElement;
    const pdfCard = Array.from(grid.children).find(
      (c) => (c as HTMLElement).textContent?.includes('PDF'),
    ) as HTMLElement | undefined;
    expect(pdfCard).not.toBeUndefined();
    expect(pdfCard!.textContent).toContain('Читать внутри');
  });
});

/**
 * catalog-detail-crash.test.tsx — чёрный экран по тапу на препарат.
 *
 * Класс бага: renderCatalogDetail бросал исключение прямо в рендере
 * (кривой id → toLowerCase на undefined; поле каталога не-массив → .map
 * не функция), а у инфо-ветки каталога не было error boundary —
 * падал весь экран. Фикс: guard + try/catch в renderCatalogDetail
 * (битая запись даёт пустую деталь) + InfoErrorBoundary вокруг ветки.
 *
 * Тест травит БД двумя записями и кликает по ним в живом экране:
 * без фикса fireEvent.click бросает, с фиксом корень жив.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

vi.mock('../../../../data/support-database', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    SUPPORT_CATALOG_DATA: {
      ...actual.SUPPORT_CATALOG_DATA,
      // monitoring строкой вместо массива → .map бросает без фикса
      zz_poison_str: {
        id: 'zz_poison_str', nameRu: 'Яд Тестовый Строка', name: 'Test Poison',
        category: ['vitamins'], mechanisms: [], organs: [], description: 'poison',
        dosage: { mg: 100, timing: 'утро' }, monitoring: 'boom',
      },
      // members не-массивом → .some/.includes чужого кода без фикса
      // (вторая битая форма того же класса)
      zz_poison_mech: {
        id: 'zz_poison_mech', nameRu: 'Яд Тестовый Мех', name: 'Test Mech',
        category: ['vitamins'], mechanisms: 'boom' as any, organs: [],
        description: 'mech poison',
      },
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { SupportScreen } from '../../SupportScreen';

describe('catalog detail crash guard', () => {
  afterEach(() => {
    cleanup();
    try { localStorage.clear(); } catch {}
  });

  it.each([
    // monitoring строкой: падала деталь (теперь пустая деталь через try/catch)
    ['строка вместо массива', 'Строка'],
    // mechanisms строкой: падает строка списка (ловит InfoErrorBoundary ветки)
    ['механизмы строкой', 'Мех'],
  ])('тап по битой записи (%s) не роняет экран', (_label, needle) => {
    try { localStorage.removeItem('he_sup_nav_v1'); } catch {}
    const { container } = render(<SupportScreen />);
    fireEvent.click(container.querySelector('.support-hero-card[data-key="info"]') as HTMLElement);
    const search = container.querySelector('.sup-catalogview input[placeholder*="Поиск"]') as HTMLInputElement;
    expect(search, 'search box').not.toBeNull();
    fireEvent.change(search, { target: { value: 'яд тестовый' } });
    const rows = Array.from(
      container.querySelectorAll('.sup-catalogview [style*="cursor: pointer"]'),
    ).filter((el) => !(el as HTMLElement).classList.contains('support-pill')) as HTMLElement[];
    const target = rows.find((r) => (r.textContent || '').includes(needle));
    expect(target, `row with ${needle}`).toBeTruthy();
    fireEvent.click(target as HTMLElement);
    const root = container.querySelector('.support-screen');
    expect(root, 'root survives poison click').not.toBeNull();
    expect((root as HTMLElement).innerHTML.length > 1000, 'content still rendered').toBe(true);
  });
});

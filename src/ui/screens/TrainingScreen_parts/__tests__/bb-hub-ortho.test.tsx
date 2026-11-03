/**
 * bb-hub-ortho.test.tsx — BB-D-19 (хвост): орто-скрининг хаба «Суставы и ортопедия»
 * в ББ-диагностике.
 *
 * Локи:
 *  - хаб читает ОБЩЕЕ хранилище `he_ortho_screen_v1`, а не заводит второй ввод;
 *  - флаги видны в карточке, urgent не прячется, прехаб подписан «сустав: … (прехаб)»;
 *  - орто-флаги НЕ создают слабых зон (в плане не появляется спец-блок по больному суставу);
 *  - «показано = напечатано»: та же секция уходит в HTML печати;
 *  - возврат из ортопедии (focus окна) обновляет карточку без перезагрузки.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BBDiagnosticsHub } from '../BBDiagnosticsHub';

const ORTHO_KEY = 'he_ortho_screen_v1';

const seedOrtho = (flags: Array<{ id: string; joint: string; level: string; label: string }>) => {
  localStorage.setItem(ORTHO_KEY, JSON.stringify({ at: new Date().toISOString(), flags }));
};

const goScreening = () => {
  render(<BBDiagnosticsHub />);
  fireEvent.click(screen.getByRole('button', { name: /Скрининг/ }));
};

const summaryText = () => document.querySelector('[data-bb="ortho-summary"]')?.textContent || '';
const prehabList = () => document.querySelector('[data-bb="ortho-prehab"]');

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('орто-скрининг в ББ-диагностике', () => {
  it('пустое хранилище: честно «флагов нет» и «в план не попадут», без выдуманного прехаба', () => {
    goScreening();
    expect(summaryText()).toBe('флагов нет');
    expect(prehabList()).toBeNull();
    expect(document.querySelector('[data-bb="ortho-note"]')?.textContent).toMatch(/не заполнен/i);
    expect(document.querySelector('[data-bb="ortho-urgent"]')).toBeNull();
  });

  it('флаг «наблюдение»: сводка, прехаб с зоной «сустав: колено (прехаб)» и оговоркой', () => {
    seedOrtho([{ id: 'knee_valgus_pos', joint: 'knee', level: 'watch', label: '🟡 Вальгус колена: щадить вальгусную нагрузку' }]);
    goScreening();
    expect(summaryText()).toContain('флагов 1');
    const list = prehabList();
    expect(list).not.toBeNull();
    expect(list!.textContent).toMatch(/сустав: колено \(прехаб\)/);
    expect(list!.textContent).toMatch(/\d+×\d+–\d+ RIR\d/);
    // оговорка «не делает мышцу слабой» — не косметика, а контракт с планом
    expect(document.querySelector('[data-bb="ortho-note"]')?.textContent).toMatch(/не делает мышцу «слабой»/);
  });

  it('стоп-флаг (urgent): предупреждение есть, прехаба нет', () => {
    seedOrtho([{ id: 'shoulder_urgent', joint: 'shoulder', level: 'urgent', label: '🔴 Плечо: стоп' }]);
    goScreening();
    expect(summaryText()).toContain('🔴 1');
    expect(document.querySelector('[data-bb="ortho-urgent"]')?.textContent).toMatch(/на паузе до врача/);
    expect(prehabList()).toBeNull();
  });

  it('орто-флаги не создают слабых зон: «Выбрано» остаётся балансом', () => {
    seedOrtho([
      { id: 'knee_valgus_pos', joint: 'knee', level: 'watch', label: 'вальгус' },
      { id: 'shoulder_cluster_pos', joint: 'shoulder', level: 'doctor', label: 'плечо' },
    ]);
    goScreening();
    // Ни одной измеренной зоны → хаб не имеет права показать «слабые» из орто-флагов.
    expect(document.querySelector('[data-bb="footer"]')?.textContent).toMatch(/Выбрано: — баланс/);
  });

  it('«показано = напечатано»: орто-секция и прехаб попадают в HTML печати', () => {
    const written: string[] = [];
    const fakeWin: any = {
      document: { write: (h: string) => { written.push(h); }, close: () => {} },
      focus: () => {},
      print: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(fakeWin as any);
    seedOrtho([{ id: 'achilles_watch', joint: 'ankle', level: 'doctor', label: '🟡 Ахилл: щадить' }]);
    goScreening();
    fireEvent.click(document.querySelector('[data-bb="export-print"]') as HTMLElement);
    const html = written.join('');
    expect(html).toContain('Орто-скрининг (хаб Ортопедия)');
    expect(html).toContain('Ахилл: щадить');
    expect(html).toContain('после допуска врача');
  });

  it('возврат из хаба Ортопедия (focus) обновляет карточку без перезагрузки', () => {
    goScreening();
    expect(summaryText()).toBe('флагов нет');
    seedOrtho([{ id: 'hip_watch', joint: 'hip', level: 'watch', label: '🟡 ТБС: щадить' }]);
    fireEvent(window, new Event('focus'));
    expect(summaryText()).toContain('флагов 1');
    expect(prehabList()?.textContent).toMatch(/сустав: тазобедренный \(прехаб\)/);
  });
});

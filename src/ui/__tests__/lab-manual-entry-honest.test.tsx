/**
 * lab-manual-entry-honest.test.tsx — проход 155: ручной ввод анализов.
 *
 * Три поверхности «Анализов» и панель фертильности писали в `labs_log` своим
 * `parseFloat`:
 *  - каталог и расширенная панель делали `continue` при `NaN` — поле выглядело
 *    заполненным, кнопка показывала «Сохранено», а записи не было;
 *  - `UnifiedLabPanel` писал `parseFloat(value) || 0` — очищенное поле становилось
 *    измерением «ноль» (ферритин 0 = тяжёлый дефицит из ничего);
 *  - «>1000» либо вовсе отвергалось, либо сохранялось точным 1000.
 *
 * Теперь число читает `labFieldEntry` (то же правило, что и расчёт), знак границы
 * едет в запись, а поле без числа называется с причиной.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LabsCatalogTab from '../screens/LabsScreen_parts/LabsCatalogTab';
import ExtendedLabsTab from '../screens/LabsScreen_parts/ExtendedLabsTab';
import { UnifiedLabPanel } from '../components/UnifiedLabPanel';
import { db } from '../../core/db';

beforeEach(async () => {
  localStorage.clear();
  cleanup();
  await db.init();
  await db.clear('labs_log');
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const rows = () => db.getAll<any>('labs_log');

const saveButton = () => screen.getAllByRole('button').find(b => (b.textContent || '').includes('💾'))!;

describe('проход 155: каталог сохраняет запись, а не «галочку»', () => {
  const renderCatalog = () => render(
    <LabsCatalogTab labs={[]} selectedPhase="baseline" onPhaseChange={() => {}} tick={0} />,
  );

  it('«>1000» — число 1000 со знаком «>», а не точное измерение', async () => {
    renderCatalog();
    fireEvent.change(screen.getByLabelText(/Феррит/i), { target: { value: '>1000' } });
    fireEvent.click(saveButton());
    await waitFor(async () => {
      const row = (await rows()).find(r => r.code === 'FERRITIN');
      expect(row).toMatchObject({ value: 1000, bound: '>' });
    });
  });

  it('«1 000» читается как тысяча, а не как единица', async () => {
    renderCatalog();
    fireEvent.change(screen.getByLabelText(/Феррит/i), { target: { value: '1 000' } });
    fireEvent.click(saveButton());
    await waitFor(async () => {
      const row = (await rows()).find(r => r.code === 'FERRITIN');
      expect(row?.value).toBe(1000);
    });
  });

  it('«1+» не сохраняется молча: поле названо с причиной', async () => {
    const { container } = renderCatalog();
    fireEvent.change(screen.getByLabelText(/Феррит/i), { target: { value: '1+' } });
    fireEvent.click(saveButton());
    const banner = await waitFor(() => {
      const el = container.querySelector('[data-lab-save-skipped]');
      if (!el) throw new Error('нет баннера');
      return el as HTMLElement;
    });
    expect(banner.textContent).toContain('Не сохранено');
    expect(banner.textContent).toContain('полоска');
    expect((await rows()).find(r => r.code === 'FERRITIN')).toBeUndefined();
  });

  it('«>5» при норме 30–300 не выдаёт сторону', () => {
    const { container } = renderCatalog();
    fireEvent.change(screen.getByLabelText(/Феррит/i), { target: { value: '>5' } });
    // Ячейка-стрелка печатает сам знак, а не «▼»: сторона не доказана.
    expect(container.textContent).not.toContain('▼');
    expect(container.textContent).not.toContain('▲');
  });
});

describe('проход 155: расширенная панель', () => {
  const renderExtended = () => render(
    <ExtendedLabsTab labs={[]} selectedPhase="baseline" onPhaseChange={() => {}} tick={0} />,
  );

  it('«отр.» помечается в строке и не попадает в склад', async () => {
    const { container } = renderExtended();
    const input = screen.getByLabelText(/Феррит/i);
    fireEvent.change(input, { target: { value: 'отр.' } });
    expect(container.querySelector('[data-lab-unread-inline]')).not.toBeNull();
    fireEvent.click(saveButton());
    const banner = await waitFor(() => {
      const el = container.querySelector('[data-lab-save-skipped]');
      if (!el) throw new Error('нет баннера');
      return el as HTMLElement;
    });
    expect(banner.textContent).toContain('отрицательно');
    expect(await rows()).toHaveLength(0);
  });

  it('«<0.5» доезжает до склада со знаком', async () => {
    renderExtended();
    fireEvent.change(screen.getByLabelText(/СРБ/i), { target: { value: '<0.5' } });
    fireEvent.click(saveButton());
    await waitFor(async () => {
      const row = (await rows()).find(r => r.code === 'CRP');
      expect(row).toMatchObject({ value: 0.5, bound: '<' });
    });
  });
});

describe('проход 155: панель фертильности не пишет «ноль» из текста', () => {
  const openPanel = () => {
    const view = render(<UnifiedLabPanel />);
    fireEvent.change(view.container.querySelector('input[type="text"]')!, { target: { value: 'АЛТ' } });
    const valueInput = view.container.querySelectorAll('input[type="text"]')[1] as HTMLInputElement;
    return { view, valueInput };
  };

  it('«1+» — «не число», в складе пусто', async () => {
    const { view, valueInput } = openPanel();
    fireEvent.change(valueInput, { target: { value: '1+' } });
    expect(view.container.querySelector('[data-lab-unread-status]')).not.toBeNull();
    expect(await rows()).toHaveLength(0);
  });

  it('очищенное поле не превращается в измерение «0»', async () => {
    const { valueInput } = openPanel();
    fireEvent.change(valueInput, { target: { value: '40' } });
    await waitFor(async () => { expect(await rows()).toHaveLength(1); }, { timeout: 2000 });
    fireEvent.change(valueInput, { target: { value: '' } });
    await new Promise(r => setTimeout(r, 950));
    expect((await rows()).some(r => r.value === 0)).toBe(false);
    expect(await rows()).toHaveLength(1);
  });
});

describe('проход 155: ручное добавление на экране «Анализы»', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/LabsScreen.tsx'), 'utf8');

  it('значение читает labFieldEntry, а знак границы сохраняется', () => {
    expect(src).toContain('const entry = labFieldEntry(text);');
    expect(src).toContain('bound: entry.bound,');
    expect(src).not.toContain('const val = parseFloat(inputValue);');
  });

  it('поле принимает границу («>1000»), а не только число', () => {
    expect(src).toContain('placeholder="40 или >1000"');
    expect(src).toContain('inputMode="decimal"');
  });

  it('отказ называет причину, а не «Введите код и значение»', () => {
    expect(src).toContain('labFieldUnreadReason(text)');
    expect(src).not.toContain("'Введите код и значение'");
  });
});

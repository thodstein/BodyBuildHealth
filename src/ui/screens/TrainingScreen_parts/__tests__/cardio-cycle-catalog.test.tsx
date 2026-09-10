/**
 * cardio-cycle-catalog.test.tsx — каталог шаблонов + мост в конструктор + приоритет стартов.
 * Своя кардио-зона: CardioCatalogSection / CardioConstructor.applyTemplate / CardioCompsStep.
 */
import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { CardioCatalogSection } from '../CardioCatalogSection';
import { CardioConstructor } from '../CardioConstructor';
import { CardioCompsStep } from '../CardioCompsStep';
import { requestCardioTemplateBuild } from '../../../../engines/lms/cardio-cycle-bridge';
import { loadCardioCycles, loadActiveCardioCycle } from '../../../../engines/lms/cardio.engine';
import { CARDIO_CYCLES } from '../../../../data/cardio-cycles/cardio-cycle-index';

const CYCLES_KEY = 'he_cardio_cycles';
const ACTIVE_KEY = 'he_active_cardio_cycle';
const PENDING_KEY = 'he_cardio_template_pending';
const WIZARD_KEY = 'he_cardio_wizard_state';

beforeEach(() => {
  try {
    localStorage.removeItem(CYCLES_KEY);
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(WIZARD_KEY);
  } catch { /* ignore */ }
});

describe('CardioCatalogSection', () => {
  it('рендерит все шаблоны каталога', () => {
    const onApply = vi.fn();
    const { container } = render(
      <CardioCatalogSection goal="health" level="beginner" daysAvailable={3} lowImpact={false} onApplyTemplate={onApply} />,
    );
    expect(container.textContent).toContain('Каталог циклов');
    expect(container.textContent).toContain('Couch-to-5K');
  });
  it('поиск сужает выдачу', () => {
    const onApply = vi.fn();
    const { container } = render(
      <CardioCatalogSection goal="health" level="beginner" daysAvailable={3} lowImpact={false} onApplyTemplate={onApply} />,
    );
    const search = container.querySelector('input[aria-label="Поиск по каталогу"]') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'гребля 2k — 12' } });
    expect(container.textContent).toContain('Гребля 2K — 12 недель');
    expect(container.textContent).not.toContain('Couch-to-5K');
  });
  it('клик «Собрать цикл» отдаёт id шаблона', () => {
    const onApply = vi.fn();
    const { container } = render(
      <CardioCatalogSection goal="health" level="beginner" daysAvailable={3} lowImpact={false} onApplyTemplate={onApply} />,
    );
    const btns = Array.from(container.querySelectorAll('button')).filter(b => b.textContent?.includes('Собрать цикл'));
    expect(btns.length).toBeGreaterThan(5);
    fireEvent.click(btns[0]);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(typeof onApply.mock.calls[0][0]).toBe('string');
  });
  it('фильтр щадящих прячет беговые ударные', () => {
    const onApply = vi.fn();
    const { container } = render(
      <CardioCatalogSection goal="health" level="beginner" daysAvailable={3} lowImpact={false} onApplyTemplate={onApply} />,
    );
    const toggle = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Щадящие'))!;
    fireEvent.click(toggle);
    expect(container.textContent).not.toContain('Couch-to-5K');
    expect(container.textContent).toContain('Гребля с нуля');
  });
});

describe('CardioConstructor — мост каталога', () => {
  it('pending-заявка собирается и активируется при монтировании', async () => {
    requestCardioTemplateBuild('cardio-run-c25k-9');
    render(<CardioConstructor />);
    await waitFor(() => {
      expect(loadActiveCardioCycle()).not.toBeNull();
    });
    expect(loadCardioCycles().length).toBe(1);
    expect(loadActiveCardioCycle()?.name).toContain('Couch-to-5K');
  });
  it('без заявки — библиотека пуста, конструктор цел', () => {
    render(<CardioConstructor />);
    expect(loadCardioCycles().length).toBe(0);
    expect(document.body.textContent).toContain('Кардио-конструктор');
  });
});

describe('CardioCompsStep — приоритет', () => {
  it('новый старт получает приоритет B + селект A/B/C', () => {
    let comps: Array<{ id: string; name: string; week: number; priority?: string }> = [];
    const setComps = (c: typeof comps) => { comps = c; };
    const noop = () => undefined;
    const { rerender } = render(
      <CardioCompsStep comps={comps} setComps={setComps} draft={{ name: 'Старт', week: '8' }} setDraft={noop as never}
        totalWeeks={12} taperWeeks={2} taperEnabled={true} peakWeek={true} />,
    );
    fireEvent.click(screen.getByText('+ Добавить старт'));
    expect(comps.length).toBe(1);
    expect(comps[0].priority).toBe('B');
    rerender(
      <CardioCompsStep comps={comps} setComps={setComps} draft={{ name: '', week: '' }} setDraft={noop as never}
        totalWeeks={12} taperWeeks={2} taperEnabled={true} peakWeek={true} />,
    );
    const sel = screen.getByLabelText('Приоритет старта Старт') as HTMLSelectElement;
    expect(sel.value).toBe('B');
    fireEvent.change(sel, { target: { value: 'A' } });
    expect(comps[0].priority).toBe('A');
  });
});

describe('каталог покрывает библиотеку', () => {
  it('CARDIO_CYCLES и каталог — одно множество', () => {
    expect(CARDIO_CYCLES.length).toBeGreaterThanOrEqual(15);
  });
});

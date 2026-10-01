/**
 * ss-season-planner-ui.test.tsx — PRO-карточка «Профессиональный сезон ТА/стронг».
 * Локи: карточка в экспорте, шаги пресета, «Рассчитать сезон» → блоки фаз,
 * «Собрать сезон» → год записан (AnnualSS), смена пресета сбрасывает превью.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { StrengthSportConstructor } from '../StrengthSportConstructor';
import { loadAnnualSS } from '../../../../engines/strength-sport/strength-sport-annual';
import { loadStrengthSportPlan } from '../../../../engines/strength-sport/strength-sport-storage';
import { loadSeasonPlan, recommendSeasonPlan, saveSeasonPlan } from '../../../../engines/strength-sport/strength-sport-season-planner.engine';

beforeEach(() => { localStorage.clear(); });

async function buildPlanAndGoExport(container: HTMLElement) {
  fireEvent.click(screen.getByText(/Далее → 2 Атлет/));
  fireEvent.click(screen.getByText(/Далее → 3 Вне зала/));
  fireEvent.click(screen.getByText(/Далее → 4 Сплит/));
  fireEvent.click(screen.getByText(/Собрать план/));
  // план собран → появляется навигация на качество/экспорт
  const toQuality = await screen.findByText(/Далее → 6 Качество/, {}, { timeout: 8000 });
  fireEvent.click(toQuality);
  const toExport = await screen.findByText(/Далее → 📤 Экспорт/, {}, { timeout: 5000 });
  fireEvent.click(toExport);
  await waitFor(() => expect(container.textContent).toContain('Профессиональный сезон'), { timeout: 5000 });
}

async function openSeasonCard(container: HTMLElement) {
  fireEvent.click(screen.getByText(/Профессиональный сезон ТА\/стронг/));
  return screen.findByText('🧭 Рассчитать сезон', {}, { timeout: 5000 });
}

describe('PRO-планировщик сезона: UI', () => {
  it('карточка в экспорте: пресет + рассчитать → блоки фаз с неделями', async () => {
    const { container } = render(<StrengthSportConstructor />);
    await buildPlanAndGoExport(container);
    await openSeasonCard(container);

    expect(screen.getByLabelText('Пресет сезона')).toBeTruthy();
    fireEvent.click(screen.getByText('🧭 Рассчитать сезон'));

    await waitFor(() => {
      const blocks = container.querySelectorAll('[data-ss="season-block"]');
      expect(blocks.length).toBeGreaterThanOrEqual(3);
    }, { timeout: 5000 });
    // Пилюли блоков показывают «фаза·Nн» с неделями
    const chips = Array.from(container.querySelectorAll('[data-ss="season-block"]')).map(el => el.textContent || '');
    for (const c of chips) expect(c, c).toMatch(/^(GPP|База|Наращ\.|Пик|Тейп\.|Перех\.)·\d+н$/);
    expect(container.textContent).toMatch(/Нед 1–/);
  });

  it('собрать сезон → AnnualSS записан + честное сообщение', async () => {
    const { container } = render(<StrengthSportConstructor />);
    await buildPlanAndGoExport(container);
    await openSeasonCard(container);

    fireEvent.click(screen.getByText('✦ Собрать сезон'));

    await waitFor(() => expect(container.textContent).toMatch(/Сезон собран/), { timeout: 8000 });
    const annual = loadAnnualSS();
    expect(annual).toBeTruthy();
    expect(annual!.blocks.length).toBeGreaterThanOrEqual(3);
    expect(annual!.totalWeeks).toBe(annual!.blocks.reduce((a, b) => a + b.weeks, 0));
    // Каждый блок — реальный план цикла
    for (const b of annual!.blocks) {
      expect(b.plan, b.id).toBeTruthy();
      expect(b.plan!.patternId.startsWith('cycle:')).toBe(true);
    }
  });

  it('смена пресета сбрасывает превью (нет устаревших блоков)', async () => {
    const { container } = render(<StrengthSportConstructor />);
    await buildPlanAndGoExport(container);
    await openSeasonCard(container);

    fireEvent.click(screen.getByText('🧭 Рассчитать сезон'));
    await waitFor(() => expect(container.querySelectorAll('[data-ss="season-block"]').length).toBeGreaterThanOrEqual(3));

    // Открываем селект пресета и выбираем «Один пик к старту»
    fireEvent.click(screen.getByLabelText('Пресет сезона'));
    const dlg = await screen.findByRole('dialog', { name: 'Пресет сезона' });
    fireEvent.click(await screen.findByText(/Один пик к старту/));
    void dlg;
    await waitFor(() => expect(container.querySelectorAll('[data-ss="season-block"]').length).toBe(0));
  });

  it('таймлайн: ячейка на каждую неделю сезона + персист переживает ремаунт', async () => {
    const { container, unmount } = render(<StrengthSportConstructor />);
    await buildPlanAndGoExport(container);
    await openSeasonCard(container);
    fireEvent.click(screen.getByText('🧭 Рассчитать сезон'));
    await waitFor(() => expect(container.querySelectorAll('[data-ss="season-block"]').length).toBeGreaterThanOrEqual(3));

    const blocks = container.querySelectorAll('[data-ss="season-block"]').length;
    const cells = container.querySelectorAll('[data-ss="season-week"]');
    expect(cells.length).toBeGreaterThan(0);
    // Ячейка = неделя: их не меньше, чем сумма недель блоков
    const saved = loadSeasonPlan();
    expect(saved).toBeTruthy();
    expect(cells.length).toBe(saved!.totalWeeks);

    // Ремаунт: сезон восстановлен из персиста без «Рассчитать»
    unmount();
    const { container: c2 } = render(<StrengthSportConstructor />);
    await buildPlanAndGoExport(c2);
    await waitFor(() => expect(c2.textContent).toMatch(/Профессиональный сезон ТА\/стронг/));
    expect(c2.textContent).toMatch(/блоков/);
    fireEvent.click(screen.getByText(/Профессиональный сезон ТА\/стронг/));
    await waitFor(() => expect(c2.querySelectorAll('[data-ss="season-block"]').length).toBe(blocks));
  });

  it('копировать сводку сезона → тост (clipboard)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const { container } = render(<StrengthSportConstructor />);
    await buildPlanAndGoExport(container);
    await openSeasonCard(container);
    fireEvent.click(screen.getByText('🧭 Рассчитать сезон'));
    await waitFor(() => expect(container.querySelectorAll('[data-ss="season-block"]').length).toBeGreaterThanOrEqual(3));

    fireEvent.click(container.querySelector('[data-ss="season-copy"]') as HTMLElement);
    await waitFor(() => expect(container.textContent).toMatch(/Сводка сезона скопирована/));
    expect(writeText).toHaveBeenCalledTimes(1);
    const txt = writeText.mock.calls[0][0] as string;
    expect(txt).toContain('СЕЗОН');
    expect(txt).toContain('БЛОКИ:');
  });

  it('сброс сезона очищает персист и превью', async () => {
    const { container } = render(<StrengthSportConstructor />);
    await buildPlanAndGoExport(container);
    await openSeasonCard(container);
    fireEvent.click(screen.getByText('🧭 Рассчитать сезон'));
    await waitFor(() => expect(container.querySelectorAll('[data-ss="season-block"]').length).toBeGreaterThanOrEqual(3));
    expect(loadSeasonPlan()).toBeTruthy();

    fireEvent.click(container.querySelector('[data-ss="season-clear"]') as HTMLElement);
    await waitFor(() => expect(container.querySelectorAll('[data-ss="season-block"]').length).toBe(0));
    expect(loadSeasonPlan()).toBeNull();
  });

  it('календарь сезона .ics выгружается (Blob + объект-URL)', async () => {
    const createUrl = vi.fn(() => 'blob:mock');
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    const { container } = render(<StrengthSportConstructor />);
    await buildPlanAndGoExport(container);
    await openSeasonCard(container);
    fireEvent.click(screen.getByText('🧭 Рассчитать сезон'));
    await waitFor(() => expect(container.querySelectorAll('[data-ss="season-block"]').length).toBeGreaterThanOrEqual(3));

    fireEvent.click(container.querySelector('[data-ss="season-ics"]') as HTMLElement);
    await waitFor(() => expect(container.textContent).toMatch(/Календарь сезона выгружен/));
    expect(createUrl).toHaveBeenCalledTimes(1);
  });

  it('открыть блок сезона → активный план = этот блок', async () => {
    const { container } = render(<StrengthSportConstructor />);
    await buildPlanAndGoExport(container);
    await openSeasonCard(container);
    fireEvent.click(screen.getByText('✦ Собрать сезон'));
    await waitFor(() => expect(container.textContent).toMatch(/Сезон собран/), { timeout: 8000 });

    const opens = container.querySelectorAll('[data-ss="season-open"]');
    expect(opens.length).toBeGreaterThanOrEqual(3);
    const season = loadSeasonPlan()!;

    fireEvent.click(opens[0] as HTMLElement);
    await waitFor(() => expect(container.textContent).toMatch(/Открыт блок 1/));
    expect(loadStrengthSportPlan()?.patternId).toBe(`cycle:${season.blocks[0].cycleId}`);
    expect(loadStrengthSportPlan()?.weeksData?.length).toBe(season.blocks[0].weeks);
    // На шаге плана виден индикатор «где я в сезоне» (сезон стартует сегодня → нед 1)
    await waitFor(() => expect(container.querySelector('[data-ss="season-now"]')).toBeTruthy());
    expect(container.textContent).toMatch(/Сезон: нед 1 из/);
  });

  it('stale-детект: сезон из стора с чужой сигнатурой → плашка, пересчёт убирает', async () => {
    const seed = recommendSeasonPlan({ mode: 'weightlifting', level: 'intermediate', daysPerWeek: 5, weeks: 12, goal: 'strength' } as any);
    saveSeasonPlan({ ...seed, inputSig: 'stale-signature' });

    const { container } = render(<StrengthSportConstructor />);
    await buildPlanAndGoExport(container);
    await openSeasonCard(container);
    await waitFor(() => expect(container.querySelector('[data-ss="season-stale"]')).toBeTruthy());

    fireEvent.click(screen.getByText('🧭 Рассчитать сезон'));
    await waitFor(() => expect(container.querySelector('[data-ss="season-stale"]')).toBeNull());
  });
});

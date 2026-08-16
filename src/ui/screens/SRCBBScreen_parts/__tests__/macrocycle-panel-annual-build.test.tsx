/**
 * macrocycle-panel-annual-build.test.tsx — карточка «🧩 Сборка года по
 * конструкторам» в годовой панели: сборка всех блоков, сборка выбранного
 * блока, экспорт в ручной режим, статусы и stale-флаги.
 */
import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MacrocyclePanel } from '../MacrocyclePanel';
import { ANNUAL_PLAN_KEY, loadAnnualTrainingPlan } from '../../../../engines/annual-training/annual-training-storage';
import { serializeMacro, type Macrocycle } from '../../../../engines/lms/macrocycle.engine';

vi.mock('../../../../core/profile-manager', () => ({
  getProfile: () => ({ settings: { personal: { weight: 80, sex: 'male' }, goals: {} } }),
}));

beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

/** Построить ПЛ-макроцикл без соревнований (5 фаз) и дождаться карточки сборки. */
async function buildPlMacroAndOpen(): Promise<void> {
  render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={() => {}} />);
  fireEvent.click(screen.getByText('Построить макроцикл'));
  await waitFor(() => expect(screen.getByText('🧩 Сборка года по конструкторам')).toBeTruthy());
}

describe('MacrocyclePanel — сборка года по конструкторам', () => {
  it('карточка сборки появляется после построения макроцикла', async () => {
    await buildPlMacroAndOpen();
    expect(screen.getByText('📦 Собрать весь год')).toBeTruthy();
    expect(screen.getByText('⚙️ Собрать блок')).toBeTruthy();
    expect(screen.getByText('📥 В ручной режим')).toBeTruthy();
  });

  it('«📦 Собрать весь год» собирает все блоки их конструкторами и сохраняет план', async () => {
    await buildPlMacroAndOpen();
    fireEvent.click(screen.getByText('📦 Собрать весь год'));
    await waitFor(() => expect(screen.getByText(/📦 Годовой план: собрано/)).toBeTruthy(), { timeout: 30000 });
    const plan = loadAnnualTrainingPlan();
    expect(plan).toBeTruthy();
    expect(plan!.blocks.every(b => b.status === 'built')).toBe(true);
    expect(localStorage.getItem(ANNUAL_PLAN_KEY)).toBeTruthy();
    // ПЛ-блоки собраны СРЦ-циклами, BB-блок — ББ-конструктором.
    expect(plan!.blocks.some(b => b.ref.kind === 'PL' && b.result?.program?.pl?.sourceCycleId)).toBe(true);
  });

  it('⚙️ Собрать блок: собирается только выбранный блок', async () => {
    await buildPlMacroAndOpen();
    // Клик по строке блока в списке сборки выбирает его (нед 1–N первой строки).
    const row = screen.getByText(/^· нед 1–/);
    fireEvent.click(row);
    fireEvent.click(screen.getByText('⚙️ Собрать блок'));
    await waitFor(() => expect(screen.getByText(/✅ Блок «/)).toBeTruthy(), { timeout: 30000 });
    const plan = loadAnnualTrainingPlan();
    expect(plan).toBeTruthy();
    expect(plan!.blocks[0].status).toBe('built');
    expect(plan!.blocks.slice(1).every(b => b.status === 'unbuilt')).toBe(true);
  });

  it('📥 В ручной режим без собранных блоков → предупреждение, без записи в мост', async () => {
    await buildPlMacroAndOpen();
    fireEvent.click(screen.getByText('📥 В ручной режим'));
    await waitFor(() => expect(screen.getByText(/⚠ Сначала соберите хотя бы один блок/)).toBeTruthy());
  });

  it('📥 В ручной режим после сборки → программа года в мост планировщика', async () => {
    await buildPlMacroAndOpen();
    fireEvent.click(screen.getByText('📦 Собрать весь год'));
    await waitFor(() => expect(loadAnnualTrainingPlan()?.status).toBe('built'), { timeout: 30000 });
    fireEvent.click(screen.getByText('📥 В ручной режим'));
    await waitFor(() => expect(screen.getByText(/✅ .*передана в ручной конструктор/)).toBeTruthy());
    const payload = JSON.parse(localStorage.getItem('he_planner_apply') || 'null');
    expect(payload).toBeTruthy();
    expect(payload.kind).toBe('program');
    expect(payload.data?.program?.meta?.direction).toBe('pl');
    expect(payload.data?.program?.pl?.sourceCycleId).toBeTruthy();
  });

  it('изменение макро после сборки → блоки помечаются устаревшими (stale)', async () => {
    await buildPlMacroAndOpen();
    fireEvent.click(screen.getByText('📦 Собрать весь год'));
    await waitFor(() => expect(loadAnnualTrainingPlan()?.status).toBe('built'), { timeout: 30000 });
    // Смена недели соревнования меняет layout блоков → синхронизация помечает stale.
    fireEvent.click(screen.getByText('Неделя главного соревнования'));
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.click(screen.getByText('OK'));
    fireEvent.click(screen.getByText('Построить макроцикл'));
    await waitFor(() => expect(screen.getByText(/устарело|статус: stale/)).toBeTruthy(), { timeout: 30000 });
    expect(screen.getAllByText(/— изменился: пересоберите/).length).toBeGreaterThan(0);
  });

  it('десериализация макро с cycleId: PL-блоки получают цикл по умолчанию', async () => {
    const macro = buildPlMacroFixture();
    localStorage.setItem('he_pl_macro', serializeMacro(macro));
    render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={() => {}} />);
    await waitFor(() => expect(screen.getByText('🧩 Сборка года по конструкторам')).toBeTruthy());
    fireEvent.click(screen.getByText('📦 Собрать весь год'));
    await waitFor(() => expect(loadAnnualTrainingPlan()?.status).toBe('built'), { timeout: 30000 });
    const plan = loadAnnualTrainingPlan();
    expect(plan!.blocks.filter(b => b.ref.kind === 'PL').every(b => b.result?.program?.pl?.sourceCycleId)).toBe(true);
  });
});

/** ПЛ-макроцикл с 3 блоками (два SRC + один BB). */
function buildPlMacroFixture(): Macrocycle {
  return {
    blocks: [
      { phase: 'endurance', weeks: 6, weekOffset: 1, kind: 'SRC', cycleId: 'cycle-01', description: 'Выносливость' },
      { phase: 'strength', weeks: 6, weekOffset: 7, kind: 'BB', description: 'Силовой BB' },
      { phase: 'transition', weeks: 2, weekOffset: 13, kind: 'SRC', cycleId: 'cycle-01', description: 'Переход' },
    ],
    totalWeeks: 14,
    rationale: [],
  };
}

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

  it('выбор блока открывает панель настроек (конструктор/цикл/taper)', async () => {
    await buildPlMacroAndOpen();
    fireEvent.click(screen.getByText(/^· нед 1–/));
    await waitFor(() => expect(screen.getByText('⚙️ Блок: нед', { exact: false })).toBeTruthy());
    expect(screen.getByText('ПЛ (СРЦ-цикл)')).toBeTruthy();
    expect(screen.getByText('ББ (ББ-авто)')).toBeTruthy();
    expect(screen.getByText('✍ Ручной')).toBeTruthy();
    expect(screen.getByText('📉 Taper внутри блока (2 нед)')).toBeTruthy();
  });

  it('смена конструктора блока → блок помечается устаревшим', async () => {
    await buildPlMacroAndOpen();
    fireEvent.click(screen.getByText(/^· нед 1–/));
    await waitFor(() => expect(screen.getByText('✍ Ручной')).toBeTruthy());
    fireEvent.click(screen.getByText('⚙️ Собрать блок'));
    await waitFor(() => expect(loadAnnualTrainingPlan()?.blocks[0].status).toBe('built'), { timeout: 30000 });
    fireEvent.click(screen.getByText('✍ Ручной'));
    await waitFor(() => expect(screen.getByText(/Конструктор блока изменён/)).toBeTruthy());
    const plan = loadAnnualTrainingPlan();
    expect(plan!.blocks[0].ref.kind).toBe('MANUAL');
    expect(plan!.blocks[0].status).toBe('stale');
    expect(plan!.blocks[0].result).toBeTruthy(); // результат не потерян
  });

  it('✍ В редактор без собранного блока → предупреждение', async () => {
    await buildPlMacroAndOpen();
    fireEvent.click(screen.getByText(/^· нед 1–/));
    await waitFor(() => expect(screen.getByText('✍ В редактор')).toBeTruthy());
    fireEvent.click(screen.getByText('✍ В редактор'));
    await waitFor(() => expect(screen.getByText(/⚠ Блок не собран/)).toBeTruthy());
  });

  it('✍ В редактор после сборки → мост annual_block с blockKey', async () => {
    await buildPlMacroAndOpen();
    fireEvent.click(screen.getByText('📦 Собрать весь год'));
    await waitFor(() => expect(loadAnnualTrainingPlan()?.status).toBe('built'), { timeout: 30000 });
    fireEvent.click(screen.getByText(/^✅ нед 1–/));
    await waitFor(() => expect(screen.getByText('✍ В редактор')).toBeTruthy());
    fireEvent.click(screen.getByText('✍ В редактор'));
    await waitFor(() => expect(screen.getByText(/✍ Блок открыт в ручном конструкторе/)).toBeTruthy());
    const payload = JSON.parse(localStorage.getItem('he_planner_apply') || 'null');
    expect(payload.kind).toBe('annual_block');
    expect(payload.data.blockKey).toBeTruthy();
    expect(payload.data.program?.meta).toBeTruthy();
  });

  it('BB-блок с «🎭 Пик-неделя»: сборка применяет пик с конфигом из профиля', async () => {
    const macro = buildPlMacroFixture();
    localStorage.setItem('he_pl_macro', serializeMacro(macro));
    render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={() => {}} />);
    await waitFor(() => expect(screen.getByText('🧩 Сборка года по конструкторам')).toBeTruthy());
    // Выбрать BB-блок (strength, индекс 1) в списке сборки.
    fireEvent.click(screen.getByText(/strength · ББ/));
    await waitFor(() => expect(screen.getByLabelText(/Пик-неделя/)).toBeTruthy());
    fireEvent.click(screen.getByLabelText(/Пик-неделя/));
    await waitFor(() => expect(screen.getByText(/Настройки блока сохранены/)).toBeTruthy());
    fireEvent.click(screen.getByText('⚙️ Собрать блок'));
    await waitFor(() => expect(screen.getByText(/✅ Блок «/)).toBeTruthy(), { timeout: 30000 });
    const plan = loadAnnualTrainingPlan();
    const bb = plan!.blocks.find(b => b.ref.phase === 'strength')!;
    expect(bb.status).toBe('built');
    expect(bb.result!.peakApplied).toBe(true);
    expect(bb.config.peakConfig).toBeTruthy();
    expect((bb.config.peakConfig as any).category).toBe('mens_physique');
  });

  it('🚀 В ББ-авто: собранный BB-блок передаётся через he_bb_plan_saved', async () => {
    const macro = buildPlMacroFixture();
    localStorage.setItem('he_pl_macro', serializeMacro(macro));
    render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={() => {}} />);
    await waitFor(() => expect(screen.getByText('🧩 Сборка года по конструкторам')).toBeTruthy());
    fireEvent.click(screen.getByText(/strength · ББ/));
    await waitFor(() => expect(screen.getByText('⚙️ Блок: нед', { exact: false })).toBeTruthy());
    fireEvent.click(screen.getByText('⚙️ Собрать блок'));
    await waitFor(() => expect(loadAnnualTrainingPlan()?.blocks[1].status).toBe('built'), { timeout: 30000 });
    await waitFor(() => expect(screen.getByText('🚀 В ББ-авто')).toBeTruthy());
    fireEvent.click(screen.getByText('🚀 В ББ-авто'));
    await waitFor(() => expect(screen.getByText(/🚀 Блок передан в ББ-авто/)).toBeTruthy());
    const saved = JSON.parse(localStorage.getItem('he_bb_plan_saved') || 'null');
    expect(saved).toBeTruthy();
    expect(saved.plan?.weeks?.length).toBe(6);
  });

  it('живое обновление: событие he-annual-training-plan-updated перечитывает план', async () => {
    await buildPlMacroAndOpen();
    fireEvent.click(screen.getByText('📦 Собрать весь год'));
    await waitFor(() => expect(loadAnnualTrainingPlan()?.status).toBe('built'), { timeout: 30000 });
    // Имитация внешнего обновления (roundtrip из ручного конструктора).
    const plan = loadAnnualTrainingPlan()!;
    plan.blocks[0].result!.warnings = ['Импортировано из ручного конструктора.'];
    localStorage.setItem(ANNUAL_PLAN_KEY, JSON.stringify(plan));
    window.dispatchEvent(new CustomEvent('he-annual-training-plan-updated', { detail: { planId: plan.id } }));
    await waitFor(() => {
      const stored = loadAnnualTrainingPlan();
      expect(stored!.blocks[0].result!.warnings).toContain('Импортировано из ручного конструктора.');
    });
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

/**
 * macrocycle-panel-audit-fixes.test.tsx — регрессионные тесты фиксов аудита
 * годового планировщика (Aug 18 2026):
 *  - P2-4: ICS DTEND = начало + 1 день (эксклюзивный конец);
 *  - P2-3: storageKey изолирует оба направления (bbKey не зависит от isBB);
 *  - P0-1: «🚀 В ББ-авто» работает после перезагрузки (bbPlan не хранится —
 *    блок пересобирается движком).
 */
import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MacrocyclePanel, buildMacroIcs } from '../MacrocyclePanel';
import { ANNUAL_PLAN_KEY, loadAnnualTrainingPlan, toStoredPlan } from '../../../../engines/annual-training/annual-training-storage';
import { buildAnnualPlan, annualPlanFromMacro } from '../../../../engines/annual-training/block-builders.engine';
import { serializeMacro, serializeBbMacro, buildBbMacrocycle, macroWeekStartDate, type Macrocycle } from '../../../../engines/lms/macrocycle.engine';

vi.mock('../../../../core/profile-manager', () => ({
  getProfile: () => ({ settings: { personal: { weight: 80, sex: 'male' }, goals: {} } }),
}));

beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

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

describe('P2-4: ICS-экспорт (DTEND эксклюзивен)', () => {
  it('фаза: DTEND = старт следующей недели (первый блок 6 нед → +42 дня)', () => {
    const macro = buildPlMacroFixture();
    const ics = buildMacroIcs(macro, '2026-01-01');
    const startIso = '20260101';
    const endDate = new Date(2026, 0, 1 + 42); // нед 1-6 → конец утра нед 7
    const endIso = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, '0')}${String(endDate.getDate()).padStart(2, '0')}`;
    expect(ics).toContain(`DTSTART;VALUE=DATE:${startIso}`);
    expect(ics).toContain(`DTEND;VALUE=DATE:${endIso}`);
    // 3 блока × по 1 VEVENT; DTEND нигде не равен DTSTART.
    expect((ics.match(/DTEND;VALUE=DATE:/g) || []).length).toBe(3);
  });

  it('соревнование с датой: DTEND = дата + 1 день', () => {
    const macro = buildPlMacroFixture();
    macro.competitions = [{ id: 'c1', name: 'Шоу', week: 7, date: '2026-02-15', priority: 'A' }];
    const ics = buildMacroIcs(macro, '2026-01-01');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260215');
    expect(ics).toContain('DTEND;VALUE=DATE:20260216');
  });
});

describe('P2-3: storageKey изолирует оба направления', () => {
  it('BB-макро в storageKey подхватывается при bodybuilding (таймлайн виден)', async () => {
    const bb = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12 });
    localStorage.setItem('he_bb_macro', serializeBbMacro(bb));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" storageKey="he_bb_macro" onApplyMacrocycle={() => {}} />);
    await waitFor(() => expect(screen.getByText('📅 Таймлайн (12 нед)')).toBeTruthy());
  });

  it('PL-макро в storageKey НЕ подхватывается PL-веткой (ключ изолирован)', async () => {
    // В he_pl_macro лежит ББ-сериализация — десериализация в PL-формат не удаётся → нет таймлайна.
    const bb = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12 });
    localStorage.setItem('he_pl_macro', serializeBbMacro(bb));
    render(<MacrocyclePanel level="advanced" goal="powerlifting" storageKey="he_pl_macro" onApplyCycle={() => {}} />);
    await waitFor(() => expect(screen.getByText('Построить макроцикл')).toBeTruthy());
    expect(screen.queryByText(/📅 Таймлайн/)).toBeNull();
  });
});

describe('P0-1: «🚀 В ББ-авто» после перезагрузки (bbPlan не хранится)', () => {
  it('bbPlan=null в storage → кнопка пересобирает блок и передаёт план', async () => {
    const macro = buildPlMacroFixture();
    localStorage.setItem('he_pl_macro', serializeMacro(macro));
    // Собрать год движком напрямую (как «📦 Собрать весь год»), сохранить — компактная форма.
    const plan = buildAnnualPlan(annualPlanFromMacro(macro), macro, { daysPerWeek: 4, level: 'intermediate' }).plan;
    localStorage.setItem(ANNUAL_PLAN_KEY, JSON.stringify(toStoredPlan(plan)));
    const loaded = loadAnnualTrainingPlan()!;
    const bb = loaded.blocks.find(b => b.ref.kind === 'BB')!;
    expect(bb.status).toBe('built');
    expect(bb.result!.bbPlan).toBeNull(); // компактная форма: bbPlan не хранится

    render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={() => {}} />);
    await waitFor(() => expect(screen.getByText('🧩 Сборка года по конструкторам')).toBeTruthy());
    fireEvent.click(screen.getByLabelText(/^Блок .*недели 7-12/));
    await waitFor(() => expect(screen.getByText('🚀 В ББ-авто')).toBeTruthy());
    fireEvent.click(screen.getByText('🚀 В ББ-авто'));
    await waitFor(() => expect(screen.getByText(/🚀 Блок передан в ББ-авто/)).toBeTruthy());
    const saved = JSON.parse(localStorage.getItem('he_bb_plan_saved') || 'null');
    expect(saved).toBeTruthy();
    expect(saved.plan?.weeks?.length).toBe(6);
    const ctx = JSON.parse(localStorage.getItem('he_bb_plan_saved_ctx') || 'null');
    expect(ctx.phase).toBe('strength');
  });
});

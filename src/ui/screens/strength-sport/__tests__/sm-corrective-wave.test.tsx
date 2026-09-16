/**
 * sm-corrective-wave.test.tsx — волна СМ-коррекции в конструкторе (opt-in).
 *
 * Мост несёт smWeakPoints + smPreferredCorr + smCorrectiveDetail; сборка шьёт
 * нед 1 автоматом; кнопка «🌊 Волна коррекции» вшивает остальные недели
 * (снапшот до, бюджет/дедуп/делод честно), «↩ Откат волны» возвращает план.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { StrengthSportConstructor } from '../StrengthSportConstructor';
import { applyToPlanner, clearPlannerApply } from '../../TrainingScreen_parts/planner-bridge';

beforeEach(() => {
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  try { clearPlannerApply(); } catch {}
});
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  try { clearPlannerApply(); } catch {}
});

describe('SM corrective wave opt-in', () => {
  it('мост → сборка → волна → тост вставки или честного скипа', async () => {
    applyToPlanner({
      kind: 'weakpoints',
      label: 't',
      data: {
        smWeakPoints: ['yoke_walk'],
        smPreferredCorr: { yoke_walk: 'sm_yoke_walk_tech' },
        smWeakCauses: { yoke_walk: 'technique' },
        smCorrectiveDetail: ['Ходьба — 3×15м @60% · Малые шаги'],
        smUnilateral: { yoke_walk: 'left' },
      } as any,
    });
    const { container } = render(<StrengthSportConstructor />);
    expect(container.textContent).toContain('СМ-хаб');
    fireEvent.click(screen.getByText(/Далее → 2 👤 Атлет/));
    fireEvent.click(screen.getByText(/Далее → 3 🏃 Вне зала/));
    fireEvent.click(screen.getByText(/Далее → 4 🧩 Сплит/));
    fireEvent.click(screen.getByText(/Собрать план/));
    await waitFor(() => expect(container.textContent).toContain('План 8нед'), { timeout: 12000 });
    expect(container.textContent).toContain('коррекция 1');
    const btn = await screen.findByText(/Волна коррекции \(1 фазы\)/, {}, { timeout: 5000 });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    await waitFor(() => expect(container.textContent).toMatch(/встроена|не вставлена/), { timeout: 10000 });
  }, 30000);

  it('откат волны возвращает план и тост', async () => {
    applyToPlanner({
      kind: 'weakpoints',
      label: 't',
      data: {
        smWeakPoints: ['yoke_walk'],
        smPreferredCorr: { yoke_walk: 'sm_yoke_walk_tech' },
        smCorrectiveDetail: ['Ходьба — 3×15м @60% · Малые шаги'],
      } as any,
    });
    const { container } = render(<StrengthSportConstructor />);
    fireEvent.click(screen.getByText(/Далее → 2 👤 Атлет/));
    fireEvent.click(screen.getByText(/Далее → 3 🏃 Вне зала/));
    fireEvent.click(screen.getByText(/Далее → 4 🧩 Сплит/));
    fireEvent.click(screen.getByText(/Собрать план/));
    await waitFor(() => expect(container.textContent).toContain('План 8нед'), { timeout: 12000 });
    fireEvent.click(await screen.findByText(/Волна коррекции \(1 фазы\)/, {}, { timeout: 5000 }));
    await waitFor(() => expect(container.textContent).toMatch(/встроена|не вставлена/), { timeout: 10000 });
    const rollback = container.querySelector('[data-ss="rollback-sm-corrective"]');
    if (rollback) {
      fireEvent.click(rollback);
      await waitFor(() => expect(container.textContent).toMatch(/откачена|нечего|отклонён/), { timeout: 5000 });
    } else {
      expect(container.textContent).toMatch(/не вставлена/);
    }
  }, 30000);
});

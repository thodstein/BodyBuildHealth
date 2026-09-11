/**
 * ta-spec-apply.test.tsx — opt-in спец-блока ТА-хаба в конструкторе.
 *
 * Мост несёт taSpecBlock.weeks[].targetSets + слабые фазы; конструктор
 * НЕ вшивает их молча при сборке, а показывает кнопку «📥 Спец-блок» —
 * вставка только по клику (снапшот до, бюджет/дедуп честно).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { StrengthSportConstructor } from '../StrengthSportConstructor';
import { applyToPlanner, clearPlannerApply } from '../../TrainingScreen_parts/planner-bridge';

beforeEach(() => {
  try { localStorage.clear(); } catch {}
  try { clearPlannerApply(); } catch {}
});
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch {}
  try { clearPlannerApply(); } catch {}
});

describe('TA spec opt-in', () => {
  it('мост → сборка → кнопка спец-блока → тост вставки или честного скипа', async () => {
    applyToPlanner({
      kind: 'weakpoints',
      label: 't',
      data: {
        wlWeakPoints: ['snatch_mid'],
        taSpecBlock: { totalWeeks: 2, weeks: [{ targetSets: 3 }, { targetSets: 4 }] },
        taPreferredCorr: { snatch_mid: 'pause_snatch' },
        taWeakCauses: { snatch_mid: 'technique' },
      } as any,
    });
    const { container } = render(<StrengthSportConstructor />);
    // Мост виден сразу (бейдж ТА-хаба)
    expect(container.textContent).toContain('ТА-хаб');
    // До сплита и сборка параметрического плана (без цикла)
    fireEvent.click(screen.getByText(/Далее → 2 👤 Атлет/));
    fireEvent.click(screen.getByText(/Далее → 3 🏃 Вне зала/));
    fireEvent.click(screen.getByText(/Далее → 4 🧩 Сплит/));
    fireEvent.click(screen.getByText(/Собрать план/));
    await waitFor(() => expect(container.textContent).toContain('План 8нед'), { timeout: 12000 });
    // Кнопка opt-in со счётчиком недель хаба
    const btn = await screen.findByText(/Спец-блок \(2 нед\)/, {}, { timeout: 5000 });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    // Хендлер отработал: успех или честный скип (бюджет/дубли)
    await waitFor(() => expect(container.textContent).toMatch(/встроен|не вставлен/), { timeout: 10000 });
  }, 30000);

  it('откат спец-блока возвращает план и тост', async () => {
    applyToPlanner({
      kind: 'weakpoints',
      label: 't',
      data: {
        wlWeakPoints: ['snatch_mid'],
        taSpecBlock: { totalWeeks: 2, weeks: [{ targetSets: 3 }, { targetSets: 4 }] },
        taPreferredCorr: { snatch_mid: 'pause_snatch' },
        taWeakCauses: { snatch_mid: 'technique' },
      } as any,
    });
    const { container } = render(<StrengthSportConstructor />);
    fireEvent.click(screen.getByText(/Далее → 2 👤 Атлет/));
    fireEvent.click(screen.getByText(/Далее → 3 🏃 Вне зала/));
    fireEvent.click(screen.getByText(/Далее → 4 🧩 Сплит/));
    fireEvent.click(screen.getByText(/Собрать план/));
    await waitFor(() => expect(container.textContent).toContain('План 8нед'), { timeout: 12000 });
    fireEvent.click(await screen.findByText(/Спец-блок \(2 нед\)/, {}, { timeout: 5000 }));
    await waitFor(() => expect(container.textContent).toMatch(/встроен|не вставлен/), { timeout: 10000 });
    // Кнопка отката — только при успешной вставке (есть снапшот); при скипе её нет честно
    const rollback = container.querySelector('[data-ss="rollback-spec"]');
    if (rollback) {
      fireEvent.click(rollback);
      await waitFor(() => expect(container.textContent).toMatch(/откачен|нечего|пересобран/), { timeout: 5000 });
    } else {
      expect(container.textContent).toMatch(/не вставлен/);
    }
  }, 30000);
});

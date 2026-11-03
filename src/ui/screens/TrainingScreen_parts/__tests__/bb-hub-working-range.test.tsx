/**
 * bb-hub-working-range.test.tsx — BB-D-33 (хвост): рабочий коридор из LVP-профиля.
 *
 * Локи:
 *  - сохранённый профиль виден после перезагрузки (иначе «сохранено профилей: N»
 *    показывало профили, которых не видно, а мета слала workingRange: null);
 *  - коридор считается ТОЛЬКО из индивидуального e1RM: нет профиля — нет строки;
 *  - хаб отдаёт в мету то же значение, что показал на экране (паритет).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BBDiagnosticsHub } from '../BBDiagnosticsHub';

const SRC = readFileSync(resolve(__dirname, '..', 'BBDiagnosticsHub.tsx'), 'utf8');

const squatProfile = {
  lift: 'squat', vbtLift: 'squat',
  points: [{ weightKg: 100, velocity: 0.7 }, { weightKg: 120, velocity: 0.55 }, { weightKg: 140, velocity: 0.4 }],
  slope: -0.0075, intercept: 1.45, r2: 0.98, count: 3,
  valid: true, mvt: 0.3, e1rm: 153.5,
  text: 'LVP squat: r² 0.98, e1RM ≈ 153.5 кг (при MVT 0.3 м/с)',
};

const openExerciseTab = () => fireEvent.click(screen.getByRole('button', { name: /Разбор/ }));

describe('BB-D-33 · рабочий вес (ориентир) из LVP', () => {
  beforeEach(() => { localStorage.clear(); });

  it('без профиля строки нет (не выдумываем вес)', () => {
    render(<BBDiagnosticsHub />);
    openExerciseTab();
    expect(document.querySelector('[data-bb="working-range"]')).toBeNull();
  });

  it('сохранённый профиль поднимается из хранилища и даёт коридор', () => {
    localStorage.setItem('he_bb_lvp_profile', JSON.stringify({ squat: squatProfile }));
    render(<BBDiagnosticsHub />);
    openExerciseTab();
    const el = document.querySelector('[data-bb="working-range"]');
    expect(el).not.toBeNull();
    const text = el!.textContent || '';
    // 153.5 × 0.65 / 0.8 с шагом 2.5 кг → 100 и 122.5
    expect(text).toContain('Присед');
    expect(text).toContain('100–122.5 кг');
    expect(text).toContain('индивид. LVP');
    expect(text).toContain('e1RM 153.5 кг');
  });

  it('движение берётся по выбранному лифту, а не «первый профиль»', () => {
    localStorage.setItem('he_bb_lvp_profile', JSON.stringify({
      squat: squatProfile,
      bench: { ...squatProfile, lift: 'bench', vbtLift: 'bench', e1rm: 100, text: 'LVP bench' },
    }));
    render(<BBDiagnosticsHub />);
    openExerciseTab();
    expect(document.querySelector('[data-bb="working-range"]')!.textContent).toContain('Присед');
    // выбор лифта — через шторку селекта (это не нативный <select>)
    fireEvent.click(screen.getByTestId('bb-lvp-lift'));
    const bench = Array.from(document.querySelectorAll('[data-bb="sheet-option"]'))
      .find((b) => (b.textContent || '').includes('Жим лёжа')) as HTMLElement;
    fireEvent.click(bench);
    expect(document.querySelector('[data-bb="working-range"]')!.textContent).toContain('Жим лёжа');
  });

  it('хаб отдаёт в мету тот же коридор, что показывает (паритет BB-D-33)', () => {
    expect(SRC).toContain('workingRange: lvpWorkingRange');
    expect(SRC).not.toContain('workingRange: null');
    expect(SRC).toContain('bbWorkingRangeNote(');
    // источник один — движок, а не своя арифметика процентов в хабе
    expect(SRC).not.toMatch(/0\.65\s*\*\s*e/);
  });
});

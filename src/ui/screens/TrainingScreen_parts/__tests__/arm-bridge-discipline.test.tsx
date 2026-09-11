import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';
import { applyToPlanner, clearPlannerApply } from '../planner-bridge';

/** PRO-3 W5a: приёмник armDiscipline — мост из армлифтинг-хаба ставит дисциплину. */
describe('W5a приёмник armlifting-моста', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* noop */ }
    clearPlannerApply();
  });
  afterEach(() => {
    cleanup();
    try { localStorage.clear(); } catch { /* noop */ }
    clearPlannerApply();
  });

  it('payload с armDiscipline armlifting → чип «Армлифтинг» активен + флеш', () => {
    applyToPlanner({
      kind: 'weakpoints',
      label: 'Армлифтинг-диагностика: тест',
      data: {
        groups: [],
        armDiscipline: 'armlifting',
        armLiftingVerdict: 'Отстаёт: Saxon Bar (50%)',
        armLifting: { weakest: 'saxon_bar', avgPct: 50, totalKg: 160, rows: [] },
      },
      source: 'intellectual',
    });
    render(<ArmAutoConstructor />);
    const chip = screen.getByRole('button', { name: 'Армлифтинг' });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(document.body.textContent).toContain('дисциплина «Армлифтинг»');
  });

  it('без armDiscipline — дисциплина не переключается (armwrestling по умолчанию)', () => {
    applyToPlanner({
      kind: 'weakpoints',
      label: 'Арм диагностика',
      data: { groups: ['wrist_flexors'] },
      source: 'intellectual',
    });
    render(<ArmAutoConstructor />);
    expect(screen.getByRole('button', { name: 'Армлифтинг' }).getAttribute('aria-pressed')).toBe('false');
    expect(document.body.textContent).not.toContain('дисциплина «Армлифтинг»');
  });

  it('PRO-4 добивка: класс/рецепт/LMS/правила видны строкой', () => {
    applyToPlanner({
      kind: 'weakpoints',
      label: 'Армлифтинг-диагностика: тест',
      data: {
        groups: [],
        armDiscipline: 'armlifting',
        armLiftingVerdict: 'Отстаёт: RT',
        armLifting: {
          weakest: 'rolling_thunder', weakestWr: 'rolling_thunder',
          avgPct: 50, avgWrPct: 50, avgInternalPct: null, totalKg: 60, rows: [],
          prescription: 'Support отстаёт',
          weightClass: 'М-90',
          rulesNote: 'замер по правилам',
          lms: { label: 'Rolling Thunder', steps: [50, 55, 60] },
        },
      },
      source: 'intellectual',
    });
    render(<ArmAutoConstructor />);
    const body = document.body.textContent || '';
    expect(body).toContain('класс М-90');
    expect(body).toContain('Support отстаёт');
    expect(body).toContain('LMS');
    expect(body).toContain('замер по правилам');
  });

  it('PRO-4 добивка: pinchKg/RT едут в рабочие максимумы (пустые не затираем)', () => {
    applyToPlanner({
      kind: 'weakpoints',
      label: 'Армлифтинг-диагностика: тест',
      data: {
        groups: [],
        armDiscipline: 'armlifting',
        armProfile: { pinchKg: 40, rtKg: 80 },
      },
      source: 'intellectual',
    });
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '🎯 Атлет' }));
    expect((screen.getByLabelText(/Pinch \(кг\)/) as HTMLInputElement).value).toBe('40');
    expect((screen.getByLabelText(/Support RT\/Axle \(кг\)/) as HTMLInputElement).value).toBe('80');
  });
});

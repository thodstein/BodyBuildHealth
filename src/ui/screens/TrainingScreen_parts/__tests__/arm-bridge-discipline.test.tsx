import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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
});

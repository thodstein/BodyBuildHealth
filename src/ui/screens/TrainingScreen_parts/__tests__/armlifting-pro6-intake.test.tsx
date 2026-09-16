import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';
import { applyToPlanner, clearPlannerApply } from '../planner-bridge';

/** PRO-6 M10: приёмник M9-полей моста — видимые строки, сборку не меняем. */
describe('M10 приёмник движения в конструкторе', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* noop */ }
    clearPlannerApply();
  });
  afterEach(() => {
    cleanup();
    try { localStorage.clear(); } catch { /* noop */ }
    clearPlannerApply();
  });

  const seed = (armLifting: Record<string, unknown>) => {
    applyToPlanner({
      kind: 'weakpoints',
      label: 'Армлифтинг-диагностика: тест',
      data: {
        groups: [],
        armDiscipline: 'armlifting',
        armLiftingVerdict: 'Отстаёт: RT',
        armLifting: { weakest: 'rolling_thunder', avgPct: 50, totalKg: 60, rows: [], ...armLifting } as any,
      },
      source: 'intellectual',
    });
  };

  it('M9-поля видны строками', () => {
    seed({
      diagTimelinePhase: { id: 'mid', label: 'Протяжка', weakLinks: ['fingers'] },
      diagAttemptPlan: { implement: 'rolling_thunder', opener: 92.5, second: 97.5, third: 102.5 },
      diagHandNote: 'Размах <20 см — RT 60 мм дорогие',
      diagHoldCurve: { curve: 'peak_gap', note: 'Пик плывёт' },
      diagConditionsNote: 'Замер тренировочный: жидкий мел',
      diagVideoNote: 'Трек: гуляние 12 см',
      diagPainNote: 'Большой болит: щипок стоп',
    });
    render(<ArmAutoConstructor />);
    const body = document.body.textContent || '';
    expect(body).toContain('фаза срыва: Протяжка');
    expect(body).toContain('попытки: 92.5/97.5/102.5');
    expect(body).toContain('дорогие');
    expect(body).toContain('Пик плывёт');
    expect(body).toContain('тренировочный');
    expect(body).toContain('гуляние');
    expect(body).toContain('щипок стоп');
  });

  it('красные флаги карты боли — стоп-строка в линии моста', () => {
    seed({ diagPainNote: 'Стоп: онемение — к врачу' });
    render(<ArmAutoConstructor />);
    expect(document.body.textContent).toContain('Стоп: онемение');
  });

  it('без M9-полей — строк движения нет (байт-в-байт)', () => {
    seed({});
    render(<ArmAutoConstructor />);
    const body = document.body.textContent || '';
    expect(body).not.toContain('фаза срыва:');
    expect(body).not.toContain('попытки:');
  });
});

/**
 * cardio-pro2-ui.test.tsx — UI-поверхность PRO-2 (№5): чек-лист + предиктор
 * в CompsStep, 6 пресетов в HIIT-секции, кнопка +HIIT в валидаторе,
 * сквозняки тоглов конструктора (№5-добивка: red-flag/tid/durability → сборка).
 */
import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { buildCardioCycle, loadCardioCycles } from '../../../../engines/lms/cardio.engine';
import { buildBbMacrocycle } from '../../../../engines/lms/macrocycle.engine';
import { annualPlanFromMacro } from '../../../../engines/annual-training/block-builders.engine';
import { saveAnnualTrainingPlan } from '../../../../engines/annual-training/annual-training-storage';
import { CardioCompsStep } from '../CardioCompsStep';
import { CardioHiitSection } from '../CardioHiitSection';
import { CardioValidationCard } from '../CardioPlanExtras';
import { CardioConstructor } from '../CardioConstructor';

const RECORDS_KEY = 'he_cardio_records';
const CYCLES_KEY = 'he_cardio_cycles';
const ACTIVE_KEY = 'he_active_cardio_cycle';
const WIZARD_KEY = 'he_cardio_wizard_state';
const ANNUAL_PLAN_KEY = 'he_annual_training_plan_v1';
const ANNUAL_CARDIO_KEY = 'he_annual_cardio_cycles';

beforeEach(() => {
  try {
    localStorage.removeItem(RECORDS_KEY);
    localStorage.removeItem(CYCLES_KEY);
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(WIZARD_KEY);
    localStorage.removeItem(ANNUAL_PLAN_KEY);
    localStorage.removeItem(ANNUAL_CARDIO_KEY);
  } catch { /* ignore */ }
});

function seedAnnualPlan(): void {
  const macro = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 52 });
  saveAnnualTrainingPlan(annualPlanFromMacro(macro));
}

const compsProps = {
  comps: [],
  setComps: () => {},
  draft: { name: '', week: '' },
  setDraft: () => {},
  totalWeeks: 12,
  taperWeeks: 2,
  taperEnabled: true,
  peakWeek: true,
};

describe('CompsStep PRO-2', () => {
  it('чек-лист гоночной недели из 5 пунктов', () => {
    const { container } = render(<CardioCompsStep {...compsProps} />);
    expect(container.textContent).toContain('Гоночная неделя');
    expect(container.textContent).toContain('Shakeout');
  });
  it('предиктор: ручной ввод 10К 44:30 → 4 прогноза', () => {
    render(<CardioCompsStep {...compsProps} />);
    fireEvent.change(screen.getByLabelText('Дистанция лучшего результата, км'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Время лучшего результата'), { target: { value: '44:30' } });
    expect(screen.getByText(/Полумарафон/)).toBeTruthy();
    expect(screen.getByText(/Марафон/)).toBeTruthy();
  });
  it('предиктор: «Из рекордов» подтягивает 10К из журнала', () => {
    localStorage.setItem(RECORDS_KEY, JSON.stringify([
      { id: 'r1', kind: 'run10k', value: 2700, date: '2026-01-05' },
    ]));
    render(<CardioCompsStep {...compsProps} />);
    fireEvent.click(screen.getByLabelText('Взять лучший результат из журнала рекордов'));
    expect((screen.getByLabelText('Время лучшего результата') as HTMLInputElement).value).toBe('45:00');
    expect(screen.getByText(/Полумарафон/)).toBeTruthy();
  });
  it('предиктор без рекордов — честная подсказка', () => {
    render(<CardioCompsStep {...compsProps} />);
    fireEvent.click(screen.getByLabelText('Взять лучший результат из журнала рекордов'));
    expect(screen.getByText(/В журнале рекордов пусто/)).toBeTruthy();
  });
});

describe('HiitSection PRO-2', () => {
  it('6 пресетов, включая RST/SIT/HIIT-opt', () => {
    const { container } = render(<CardioHiitSection onAdd={() => {}} totalWeeks={8} />);
    for (const t of ['Norwegian 4×4', 'Billat 30-30', 'Tabata', 'RST 10×10', 'SIT 8×20', 'HIIT-opt']) {
      expect(container.textContent).toContain(t);
    }
  });
});

describe('ValidationCard +HIIT (№3)', () => {
  it('warn без HIIT + кнопка зовёт onAddHiit', () => {
    const onAdd = vi.fn();
    const c = buildCardioCycle({ goal: 'mass', totalWeeks: 6 });
    const { container } = render(<CardioValidationCard cycle={c} beginner={false} onAddHiit={onAdd} />);
    expect(container.textContent).toContain('Низкий объём (<150 мин/нед) без HIIT');
    const btn = screen.getByLabelText('Добавить HIIT в неделю 1');
    fireEvent.click(btn);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
  it('без onAddHiit кнопки нет', () => {
    const c = buildCardioCycle({ goal: 'mass', totalWeeks: 6 });
    render(<CardioValidationCard cycle={c} beginner={false} />);
    expect(screen.queryByLabelText('Добавить HIIT в неделю 1')).toBeNull();
  });
});

describe('Constructor toggles → сборка (№5-добивка)', () => {
  const next = () => fireEvent.click(screen.getByRole('button', { name: /^Далее/ }));
  const back = () => fireEvent.click(screen.getByRole('button', { name: /Назад/ }));
  const buildHere = () => fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
  const redFlagBtns = () => Array.from(document.querySelectorAll('[data-cardio="red-flag"]')) as HTMLElement[];
  // data-*={false} React не рендерит — состояние читаем по aria-pressed.
  const pressedOf = (sel: string) => (document.querySelector(sel) as HTMLElement | null)?.getAttribute('aria-pressed');
  const redOn = () => redFlagBtns().map(b => b.getAttribute('aria-pressed'));

  it('red-flag на Атлете → сборка без HIIT/MISS + rationale к врачу', () => {
    render(<CardioConstructor />);
    next(); // athlete
    fireEvent.click(screen.getByRole('button', { name: /Боль\/давление в груди/ }));
    next(); next(); next(); // load → comps → preview
    buildHere();
    const saved = loadCardioCycles()[0];
    expect(saved.config?.redFlags).toContain('chest_pain');
    expect(saved.weeks.some(w => w.sessions.some(s => s.type === 'hiit' || s.type === 'miss'))).toBe(false);
    expect(saved.rationale.join(' ')).toContain('врача');
  });

  it('PYR→POL на Нагрузке → сборка со свитчем', () => {
    render(<CardioConstructor />);
    next(); next(); // load
    const sw = document.querySelector('[data-cardio="tid-switch"]') as HTMLElement;
    expect(sw).not.toBeNull();
    fireEvent.click(sw);
    next(); next(); // comps → preview
    buildHere();
    const saved = loadCardioCycles()[0];
    expect(saved.config?.tidSwitchWeek).toBeGreaterThanOrEqual(2);
    expect(saved.rationale.join(' ')).toContain('PYR→POL');
  });

  it('durability на Нагрузке → длинная Z2 в сборке', () => {
    render(<CardioConstructor />);
    next(); next(); // load
    const dw = document.querySelector('[data-cardio="durability"]') as HTMLElement;
    expect(dw).not.toBeNull();
    fireEvent.click(dw);
    next(); next(); // comps → preview
    buildHere();
    const saved = loadCardioCycles()[0];
    expect(saved.config?.durabilitySession).toBe(true);
    expect(saved.weeks.some(w => w.sessions.some(s => s.purpose.includes('Durability')))).toBe(true);
  });

  it('editConfig гасит флаги из чужого цикла (№2-финал)', () => {
    render(<CardioConstructor />);
    next(); next(); next(); next(); // preview
    buildHere(); // цикл без флагов
    back(); back(); back(); // → athlete
    fireEvent.click(screen.getByRole('button', { name: /Боль\/давление в груди/ }));
    expect(redOn().some(v => v === 'true')).toBe(true);
    next(); next(); next(); // → preview
    fireEvent.click(screen.getByRole('button', { name: /Изменить параметры/ }));
    fireEvent.click(screen.getByRole('button', { name: /Атлет/ }));
    expect(redFlagBtns().length).toBeGreaterThan(0);
    expect(redOn().every(v => v === 'false')).toBe(true);
  });

  it('reset гасит все тоглы (№3-финал)', () => {
    render(<CardioConstructor />);
    next(); next(); // load
    fireEvent.click(document.querySelector('[data-cardio="tid-switch"]') as HTMLElement);
    fireEvent.click(document.querySelector('[data-cardio="durability"]') as HTMLElement);
    expect(pressedOf('[data-cardio="tid-switch"]')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Сбросить параметры/ }));
    expect(pressedOf('[data-cardio="tid-switch"]')).toBe('false');
    expect(pressedOf('[data-cardio="durability"]')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: /Атлет/ }));
    expect(redOn().every(v => v === 'false')).toBe(true);
  });

  it('dirty не зависит от порядка кликов дней ног (№4-финал)', () => {
    render(<CardioConstructor />);
    next(); next(); // load
    const equipHeader = screen.queryByRole('button', { name: /Оборудование и ограничения/ });
    if (equipHeader && equipHeader.getAttribute('aria-expanded') === 'false') fireEvent.click(equipHeader);
    fireEvent.click(screen.getByRole('button', { name: /Ноги: Пн/ }));
    fireEvent.click(screen.getByRole('button', { name: /Ноги: Чт/ }));
    next(); next(); // comps → preview
    buildHere(); // config legDays [0,3]
    back(); back(); // → load
    fireEvent.click(screen.getByRole('button', { name: /Ноги: Пн/ })); // снять → [3]
    fireEvent.click(screen.getByRole('button', { name: /Ноги: Пн/ })); // вернуть → [3,0]
    next(); next(); // → preview
    expect(screen.queryByText(/Параметры в мастере изменены/)).toBeNull();
  });

  it('годовой флеш говорит про мед-блок (добивка-8)', () => {
    seedAnnualPlan();
    render(<CardioConstructor />);
    next(); // athlete
    fireEvent.click(screen.getByRole('button', { name: /Боль\/давление в груди/ }));
    next(); next(); next(); next(); // load → comps → preview → manage
    fireEvent.click(screen.getByRole('button', { name: /Собрать кардио по блокам года/ }));
    expect(screen.getAllByRole('status').some(s => (s.textContent || '').includes('мед-блок'))).toBe(true);
    const annual = loadCardioCycles().filter(c => c.id.startsWith('annual-cardio-'));
    expect(annual.length).toBeGreaterThan(0);
    expect(annual.every(c => !c.weeks.some(w => w.sessions.some(s => s.type === 'hiit' || s.type === 'miss')))).toBe(true);
  });

  it('selectVariant сохраняет флаги (добивка-8)', () => {
    render(<CardioConstructor />);
    next(); // athlete
    fireEvent.click(screen.getByRole('button', { name: /Боль\/давление в груди/ }));
    next(); next(); next(); // load → comps → preview
    buildHere();
    fireEvent.click(screen.getByRole('button', { name: /⇄ Варианты/ }));
    fireEvent.click(screen.getByRole('button', { name: /Вариант: Интенсивный/ }));
    const saved = loadCardioCycles()[0];
    expect(saved.config?.redFlags).toContain('chest_pain');
    expect(saved.weeks.some(w => w.sessions.some(s => s.type === 'hiit' || s.type === 'miss'))).toBe(false);
  });
});

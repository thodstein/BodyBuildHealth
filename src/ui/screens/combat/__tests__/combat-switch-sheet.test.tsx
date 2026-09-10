/**
 * combat-switch-sheet.test.tsx — свитчи вместо галочек + шиты вместо селектов.
 *
 * role=switch с aria-checked/data-on; шит открывается диалогом, выбор ставит
 * значение, бэкдроп/«Готово» закрывают; нативных checkbox/select в зоне ноль.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { CombatConstructor } from '../CombatConstructor';
import { CombatPlanView } from '../CombatPlanView';
import { buildCombatPlan } from '../../../../engines/combat/combat-builder.engine';
import { finalizeCombatPlan } from '../../../../engines/combat/combat-finalize.engine';
import { buildAnnualATR, saveAnnualCB } from '../../../../engines/combat/combat-annual';

beforeEach(() => {
  localStorage.clear();
});

function go(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
}

function openSec(re: RegExp) {
  const head = screen.getAllByRole('button', { name: re }).find((b) => b.getAttribute('aria-expanded') != null);
  expect(head).toBeTruthy();
  if (head && head.getAttribute('aria-expanded') === 'false') fireEvent.click(head);
}

describe('Combat switch', () => {
  it('тоггл меняет aria-checked и data-on', () => {
    render(<CombatConstructor />);
    go('3 Вне зала');
    openSec(/Вне зала — спарринг/);
    const sw = screen.getByRole('switch', { name: /Учитывать нагрузку вне зала/ });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(sw.getAttribute('data-on')).toBe('false');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });

  it('красный свитч осевой нагрузки тоже тогглится', () => {
    render(<CombatConstructor />);
    go('3 Вне зала');
    openSec(/Стиль боя/);
    const sw = screen.getByRole('switch', { name: /Избегать осевой нагрузки/ });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });

  it('нативных чекбоксов и селектов в конструкторе не осталось', () => {
    const { container } = render(<CombatConstructor />);
    for (const s of ['2 Атлет', '3 Вне зала', '4 Сплит', '7 Экспорт']) go(s);
    expect(container.querySelectorAll("input[type='checkbox']").length).toBe(0);
    expect(container.querySelectorAll('select').length).toBe(0);
  });
});

describe('Combat sheet select', () => {
  it('годовые шиты: открытие, выбор, закрытие', () => {
    const ann = buildAnnualATR('mma' as any, 12, null, { cycles: 1 } as any);
    saveAnnualCB(ann);
    render(<CombatConstructor />);
    go('7 Экспорт');
    const trig = screen.getByRole('button', { name: 'Длина года' });
    expect(trig.textContent).toContain('52 нед');
    fireEvent.click(trig);
    const dlg = screen.getByRole('dialog', { name: 'Длина года' });
    fireEvent.click(within(dlg).getByText('24 нед'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Длина года' }).textContent).toContain('24 нед');
  });

  it('бэкдроп закрывает шит без выбора', () => {
    const ann = buildAnnualATR('mma' as any, 12, null, { cycles: 1 } as any);
    saveAnnualCB(ann);
    render(<CombatConstructor />);
    go('7 Экспорт');
    fireEvent.click(screen.getByRole('button', { name: 'Длина года' }));
    expect(screen.getByRole('dialog', { name: 'Длина года' })).toBeTruthy();
    fireEvent.click(document.querySelector('.cb-pop-backdrop')!);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Длина года' }).textContent).toContain('52 нед');
  });

  it('замена упражнения через шит зовёт onSwapEx', () => {
    const plan = finalizeCombatPlan(buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 2, daysPerWeek: 3 } as any));
    const onSwapEx = vi.fn();
    render(
      <CombatPlanView
        plan={plan}
        historyLen={0}
        onUndo={() => {}}
        onUpdateEx={() => {}}
        onMoveEx={() => {}}
        onSwapEx={onSwapEx}
      />,
    );
    const triggers = screen.getAllByRole('button', { name: 'Замена' });
    expect(triggers.length).toBeGreaterThan(0);
    let picked: { trig: HTMLElement; target: HTMLElement } | null = null;
    for (const t of triggers) {
      fireEvent.click(t);
      const dlg = screen.queryByRole('dialog', { name: 'Замена' });
      if (!dlg) continue;
      const opts = within(dlg).getAllByRole('button').filter((b) => b.textContent !== 'Готово');
      if (opts.length > 1) {
        const target = opts.find((b) => !b.textContent!.includes('· текущий')) || opts[opts.length - 1];
        picked = { trig: t, target };
        break;
      }
      fireEvent.click(document.querySelector('.cb-pop-backdrop')!);
    }
    expect(picked).not.toBeNull();
    fireEvent.click(picked!.target);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onSwapEx).toHaveBeenCalledTimes(1);
    expect(typeof onSwapEx.mock.calls[0][3]).toBe('string');
  });
}); // end Combat sheet select

describe('Combat quality step', () => {
  it('карта качества рендерится в плане', () => {
    const plan = finalizeCombatPlan(buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 2, daysPerWeek: 3 } as any));
    render(
      <CombatPlanView
        plan={plan}
        historyLen={0}
        onUndo={() => {}}
        onUpdateEx={() => {}}
        onMoveEx={() => {}}
        onSwapEx={() => {}}
      />,
    );
    expect(screen.getByText('Карта качества')).toBeTruthy();
    expect(screen.getByText('Шея')).toBeTruthy();
    expect(screen.getByText('Хват')).toBeTruthy();
  });

  it('e2e: сборка → шаг Качество с картой и отчётом-аккордеоном', async () => {
    render(<CombatConstructor />);
    go('4 Сплит');
    fireEvent.click(screen.getByRole('button', { name: /Собрать PRO-план/ }));
    await screen.findByText('Сводка плана', {}, { timeout: 12000 });
    go('6 Качество');
    expect(screen.getByText('Карта качества')).toBeTruthy();
    openSec(/Подробный отчёт/);
    expect(document.body.textContent).toContain('Единоборства:');
  }, 15000);
});

describe('Combat plan controls', () => {
  it('в плане нет нативных селектов', () => {
    const plan = finalizeCombatPlan(buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 2, daysPerWeek: 3 } as any));
    const { container } = render(
      <CombatPlanView
        plan={plan}
        historyLen={0}
        onUndo={() => {}}
        onUpdateEx={() => {}}
        onMoveEx={() => {}}
        onSwapEx={() => {}}
      />,
    );
    expect(container.querySelectorAll('select').length).toBe(0);
    expect(container.querySelectorAll("input[type='checkbox']").length).toBe(0);
  });
}); // end Combat plan controls

describe('Combat RU guard', () => {
  it('ни одного английского id в интерфейсе всех шагов', () => {
    render(<CombatConstructor />);
    for (const s of ['1 Параметры', '2 Атлет', '3 Вне зала', '4 Сплит', '7 Экспорт']) go(s);
    const txt = document.body.textContent || '';
    const banned = ['bench_bar', 'row_bar', 'compound_first', 'pre_exhaust', 'post_exhaust', 'power_endurance', 'heavy_light', 'rest_pause', 'myo_reps', 'upper_power', 'lower_power', 'full_power', 'OutsideLoad', 'P0-6', 'fight week', 'low fiber', 'Hard spar', 'Tech spar', 'day_before_24h', 'same_day_2h', 'load_cut', 'deplete_reload', 'moderate_cut', 'mma · power', 'striker +', 'grappler +'];
    for (const b of banned) expect(txt, b).not.toContain(b);
  });
});

describe('Combat cycles', () => {  it('применение цикла выставляет сплит и тост', () => {
    render(<CombatConstructor />);
    go('4 Сплит');
    expect(screen.getByText(/Готовые циклы/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Применить «ММА · кэмп к бою 8 нед»/ }));
    expect(screen.getByRole('button', { name: /Собрать PRO-план.*combat_4/ })).toBeTruthy();
    expect(document.body.textContent).toContain('применён');
  });

  it('фильтр по виду спорта режет список', () => {
    render(<CombatConstructor />);
    go('4 Сплит');
    const group = screen.getByRole('group', { name: 'Фильтр циклов по виду спорта' });
    fireEvent.click(within(group).getByRole('button', { name: /Борьба/ }));
    expect(screen.queryByText('Бокс · база 8 нед')).toBeNull();
    expect(screen.getByText('Борьба · база 6 нед')).toBeTruthy();
    expect(screen.getByText('Борьба · пик 8 нед')).toBeTruthy();
    fireEvent.click(within(group).getByRole('button', { name: 'Все' }));
    expect(screen.getByText('Бокс · база 8 нед')).toBeTruthy();
  });

  it('авторские бейджи видны, применение ставит уровень', () => {
    render(<CombatConstructor />);
    go('4 Сплит');
    expect(screen.getByText(/EliteFTS · Matt Mills/)).toBeTruthy();
    expect(screen.getByText(/Train Like a Champion/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Применить «ММА · кэмп к бою 8 нед»/ }));
    go('1 Параметры');
    expect(document.body.textContent).toContain('Продвинутый');
  });
});

describe('Combat bugfixes', () => {
  it('смена дней сбрасывает вручную выбранный сплит', () => {
    const { container } = render(<CombatConstructor />);
    go('4 Сплит');
    fireEvent.click(screen.getByRole('button', { name: /4×\/нед — Верх\/Низ ×2/ }));
    expect(screen.getByRole('button', { name: /Собрать PRO-план.*combat_4/ }).textContent).toContain('combat_4');
    go('1 Параметры');
    const daysInput = Array.from(container.querySelectorAll('input[type="range"]')).find(
      (i) => i.getAttribute('max') === '4' && i.getAttribute('min') === '2',
    ) as HTMLInputElement;
    expect(daysInput).toBeTruthy();
    fireEvent.change(daysInput, { target: { value: '2' } });
    expect(document.body.textContent).toContain('Сплит сброшен');
    go('4 Сплит');
    expect(screen.getByRole('button', { name: /Собрать PRO-план/ }).textContent).not.toContain('combat_4');
  });

  it('смена уровня на новичка сбрасывает combat_4', () => {
    render(<CombatConstructor />);
    go('4 Сплит');
    fireEvent.click(screen.getByRole('button', { name: /4×\/нед — Верх\/Низ ×2/ }));
    expect(screen.getByRole('button', { name: /Собрать PRO-план.*combat_4/ })).toBeTruthy();
    go('1 Параметры');
    fireEvent.click(screen.getByRole('button', { name: 'Уровень' }));
    const dlg = screen.getByRole('dialog', { name: 'Уровень' });
    fireEvent.click(within(dlg).getByText('Новичок'));
    expect(document.body.textContent).toContain('Сплит сброшен под уровень');
    go('4 Сплит');
    expect(screen.getByRole('button', { name: /Собрать PRO-план/ }).textContent).not.toContain('combat_4');
  });

  it('весогонка в 0 сбрасывает моды воды/натрия/углей', () => {
    const { container } = render(<CombatConstructor />);
    go('3 Вне зала');
    openSec(/Весогонка/);
    const cutInput = Array.from(container.querySelectorAll('input[type="range"]')).find(
      (i) => i.getAttribute('max') === '8',
    ) as HTMLInputElement;
    expect(cutInput).toBeTruthy();
    fireEvent.change(cutInput, { target: { value: '6' } });
    expect(screen.getByRole('button', { name: 'Вода' }).textContent).toContain('Load 8л');
    fireEvent.change(cutInput, { target: { value: '0' } });
    expect(screen.queryByRole('button', { name: 'Вода' })).toBeNull();
    fireEvent.change(cutInput, { target: { value: '2' } });
    expect(screen.getByRole('button', { name: 'Вода' }).textContent).toContain('Стабильно');
    expect(screen.getByRole('button', { name: 'Натрий' }).textContent).toContain('Стабильно');
    expect(screen.getByRole('button', { name: 'Углеводы' }).textContent).toContain('Стабильно');
  });
});

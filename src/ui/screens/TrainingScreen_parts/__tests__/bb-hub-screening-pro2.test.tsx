/**
 * R1–R8 PRO-2 — UI хаба скрининга: жим, боль-мониторинг, задняя цепь, шарнир под весом,
 * ER:IR, приоритет, teen-гейт, LSI-оговорка, снимок v:3.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BBDiagnosticsHub } from '../BBDiagnosticsHub';

beforeEach(() => { localStorage.clear(); });

const goScreening = () => {
  render(<BBDiagnosticsHub />);
  fireEvent.click(screen.getByRole('button', { name: /Скрининг/ }));
};

describe('bb-hub R1 жим', () => {
  it('широкий хват (BAW из ширины плеч) → fix «сузь» + список правок', () => {
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({ circ: { shoulderWidth: '40' } }));
    goScreening();
    expect(document.querySelector('[data-bb="bench-screen"]')).not.toBeNull();
    fireEvent.change(screen.getByTestId('bb-bench-grip'), { target: { value: '72' } });
    expect(document.querySelector('[data-bb="bench-verdict"]')?.textContent).toMatch(/сузь/);
    expect(document.querySelector('[data-bb="bench-disclaimer"]')?.textContent).toMatch(/1\.8 BAW|BAW/);
    // вторая правка (боль) → полный список правок виден
    fireEvent.click(screen.getByRole('switch', { name: /Без боли в жиме/ }));
    const list = document.querySelector('[data-bb="bench-fixes"]');
    expect(list).not.toBeNull();
    expect(list?.textContent).toMatch(/сузь/);
    expect(list?.textContent).toMatch(/Боль в жиме/);
  });
  it('касание у шеи через шит → fix-строка', () => {
    goScreening();
    fireEvent.click(screen.getByTestId('bb-bench-touch'));
    fireEvent.click(screen.getAllByText('У шеи')[0]);
    expect(document.querySelector('[data-bb="bench-verdict"]')?.textContent).toMatch(/шеи/);
  });
});

describe('bb-hub R2 боль-мониторинг', () => {
  it('боль 7/10 → красный вердикт + провокация + дисклеймер', () => {
    goScreening();
    expect(document.querySelector('[data-bb="pain-monitor"]')).not.toBeNull();
    fireEvent.change(screen.getByTestId('bb-pm-during'), { target: { value: '7' } });
    expect(document.querySelector('[data-bb="pm-verdict"]')?.textContent).toMatch(/красный/);
    expect(document.querySelector('[data-bb="pm-advice"]')?.textContent).toMatch(/≤3/);
    expect(document.querySelector('[data-bb="pm-disclaimer"]')?.textContent).toMatch(/не диагноз/);
  });
  it('снимок ловит pm-red (v:3)', () => {
    localStorage.setItem('he_bb_screen_history', JSON.stringify([]));
    goScreening();
    fireEvent.change(screen.getByTestId('bb-pm-during'), { target: { value: '8' } });
    fireEvent.click(screen.getByText('Снимок сегодня'));
    const hist = JSON.parse(localStorage.getItem('he_bb_screen_history') || '[]');
    expect(hist[0].v).toBe(3);
    expect(hist[0].fails).toContain('pm-red');
  });
});

describe('bb-hub R3 задняя цепь', () => {
  it('NHE 3 повтора → вердикт со слабым эксцентриком и дозой', () => {
    goScreening();
    expect(document.querySelector('[data-bb="posterior-readiness"]')).not.toBeNull();
    fireEvent.change(screen.getByTestId('bb-nhe-l'), { target: { value: '3' } });
    const t = document.querySelector('[data-bb="nhe-verdict"]')?.textContent || '';
    expect(t).toMatch(/NHE/);
    expect(t).toMatch(/NHE: 2×\/нед|повторов/);
    expect(document.querySelector('[data-bb="nhe-disclaimer"]')?.textContent).toMatch(/экстраполяция/);
  });
  it('аддукторы: асимметрия 20 кг vs 16 кг → weak + честность', () => {
    goScreening();
    fireEvent.change(screen.getByTestId('bb-add-l'), { target: { value: '16' } });
    fireEvent.change(screen.getByTestId('bb-add-r'), { target: { value: '20' } });
    expect(document.querySelector('[data-bb="adductor-verdict"]')?.textContent).toMatch(/20%/);
    expect(document.querySelector('[data-bb="adductor-honesty"]')?.textContent).toMatch(/не доказано/);
  });
});

describe('bb-hub R5/R6 шарнир-нагрузка и ER:IR', () => {
  it('RDL «поясница уходит» → degraded-строка', () => {
    goScreening();
    fireEvent.click(screen.getByTestId('bb-rdl-loaded'));
    fireEvent.click(screen.getAllByText('Поясница уходит')[0]);
    expect(document.querySelector('[data-bb="loaded-hinge-verdict"]')?.textContent).toMatch(/снизь вес/);
  });
  it('ER 10 / IR 16 → ER/IR 0.63 warn', () => {
    goScreening();
    fireEvent.change(screen.getByTestId('bb-er-kg'), { target: { value: '10' } });
    fireEvent.change(screen.getByTestId('bb-ir-kg'), { target: { value: '16' } });
    expect(document.querySelector('[data-bb="erir-verdict"]')?.textContent).toMatch(/0\.63/);
    expect(document.querySelector('[data-bb="erir-verdict"]')?.textContent).toMatch(/наружную ротацию/);
  });
});

describe('bb-hub R7 приоритет / teen / LSI', () => {
  it('приоритет-блок с драйвером виден', () => {
    goScreening();
    fireEvent.click(screen.getByRole('switch', { name: /Пятки плоско/ }));
    fireEvent.click(screen.getByRole('switch', { name: /Таз ниже параллели/ }));
    const box = document.querySelector('[data-bb="screen-priority"]');
    expect(box).not.toBeNull();
    expect(box?.textContent).toMatch(/Что чинить первым/);
    expect(box?.textContent).toMatch(/Голеностоп/);
  });
  it('14 лет → teen-гейт на экране + RDL-проба не едет в снимок', () => {
    localStorage.setItem('he_profile_v2', JSON.stringify({ settings: { personal: { age: 14 } } }));
    goScreening();
    expect(document.querySelector('[data-bb="teen-gate"]')?.textContent).toMatch(/14–15/);
    expect(document.querySelector('[data-bb="loaded-hinge-verdict"]')?.textContent).toMatch(/14–15/);
    expect(document.querySelector('[data-bb="hinge-load-note"]')).toBeNull();
  });
  it('LSI-оговорка в карточке L/R (таб «Слабые»)', () => {
    render(<BBDiagnosticsHub />);
    expect(document.querySelector('[data-bb="lr-disclaimer"]')?.textContent).toMatch(/не прогноз/);
  });
});

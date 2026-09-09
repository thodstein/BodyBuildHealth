import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import React from 'react';
import { ArmDiagnosticsHub } from '../ArmDiagnosticsHub';
import { ArmAutoConstructor } from '../ArmAutoConstructor';
import { applyToPlanner } from '../planner-bridge';

beforeEach(() => {
  localStorage.clear();
});

function pickSheet(triggerRe: RegExp, optionRe: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: triggerRe }));
  fireEvent.click(within(screen.getByRole('dialog')).getByText(optionRe));
}

function flipSwitch(nameRe: RegExp) {
  fireEvent.click(screen.getByRole('switch', { name: nameRe }));
}

function openSec(re: RegExp) {
  const head = screen.getAllByRole('button', { name: re }).find((b) => b.getAttribute('aria-expanded') != null);
  expect(head).toBeTruthy();
  if (head && head.getAttribute('aria-expanded') === 'false') fireEvent.click(head);
}

function openPressure() {
  render(<ArmDiagnosticsHub />);
  fireEvent.click(screen.getByRole('button', { name: /Давление/ }));
}

describe('Arm TOP UI: матчап + Table-IQ', () => {
  it('pressure-таб показывает TOP-блок', () => {
    openPressure();
    expect(document.body.textContent).toContain('TOP: матчап + Table-IQ журнал');
  });

  it('добавление схватки даёт Table-IQ разбор', () => {
    openPressure();
    fireEvent.change(screen.getByLabelText('Фолы за схватку'), { target: { value: '2' } });
    fireEvent.click(screen.getByText(/＋ Схватка/));
    expect(document.body.textContent).toContain('Table-IQ 1 схваток');
    expect(document.body.textContent).toMatch(/Фолы/);
  });

  it('отмена схватки работает', () => {
    openPressure();
    fireEvent.click(screen.getByText(/＋ Схватка/));
    expect(document.body.textContent).toContain('Table-IQ 1 схваток');
    fireEvent.click(screen.getByText(/↩ Отменить/));
    expect(document.body.textContent).not.toContain('Table-IQ 1 схваток');
  });

  it('выбор стиля оппонента даёт матчап-план', () => {
    openPressure();
    pickSheet(/^Оппонент:/, /Топролл/);
    expect(document.body.textContent).toContain('Матчап:');
    expect(document.body.textContent).toContain('pronators');
  });

  it('конструктор показывает TOP-карточку', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '✊ Стол и хват' }));
    expect(document.body.textContent).toContain('TOP: матчап');
  });

  it('Grip-RPE превью в конструкторе', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '✊ Стол и хват' }));
    openSec(/TOP: матчап/);
    pickSheet(/^Grip-RPE неделя:/, /3 \(интенс\.\)/);
    expect(document.body.textContent).toContain('Grip-RPE:');
  });

  it('recovery-таб показывает return-to-pull', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Сухожилие/ }));
    expect(document.body.textContent).toContain('Return-to-pull');
    pickSheet(/^Травма для return-to-pull:/, /UCL\/связка локтя/);
    fireEvent.change(screen.getByLabelText('Недель с травмы'), { target: { value: '8' } });
    expect(document.body.textContent).toContain('Фаза 2');
  });

  it('TOP-карта: CNS-поля на месте', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '✊ Стол и хват' }));
    expect(document.body.textContent).toContain('Тяж. хвата/нед (CNS)');
    expect(document.body.textContent).toContain('Часов с тяж. тяг');
    expect(document.body.textContent).toContain('Grip-RPE авто-волна');
  });

  it('мост хаб→конструктор: профиль и RFD применяются', () => {
    render(<ArmAutoConstructor />);
    act(() => {
      applyToPlanner({
        kind: 'weakpoints',
        label: 'test',
        data: {
          groups: ['pronators'],
          armProfile: { leftKg: 70, rightKg: 80, bwKg: 85, rtKg: 60 },
          armRfd: { explosivePct: 45 },
        },
      } as any);
    });
    fireEvent.click(screen.getByRole('button', { name: '🎯 Атлет' }));
    expect(screen.getByDisplayValue('70')).toBeTruthy();
    expect(screen.getByDisplayValue('85')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '✊ Стол и хват' }));
    fireEvent.click(screen.getByRole('button', { name: /TOP: матчап/ }));
    expect(screen.getByRole('switch', { name: /RFD speed-блок/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('кросс-мезо: сборка с прошлым планом', () => {
    localStorage.setItem('he_arm_last_plan', JSON.stringify({
      weeks: [{ sessions: [{ exercises: [{ muscle: 'wrist_flexors', workSets: [{ weight: 40 }] }] }] }],
    }));
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '✊ Стол и хват' }));
    fireEvent.click(screen.getByRole('button', { name: /TOP: матчап/ }));
    flipSwitch(/С прошлого плана/);
    fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    fireEvent.click(screen.getByRole('button', { name: '📤 Экспорт' }));
    expect(document.body.textContent).toContain('Cross-meso');
  });

  it('sim-план: заметки недели видны в плане', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '✊ Стол и хват' }));
    fireEvent.click(screen.getByRole('button', { name: /TOP: матчап/ }));
    flipSwitch(/Contest-sim неделя/);
    fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    fireEvent.click(screen.getByRole('button', { name: '📤 Экспорт' }));
    expect(document.body.textContent).toContain('Contest-sim');
  });

  it('FOR-7: включение показывает селект домена', () => {
    render(<ArmAutoConstructor />);
    expect(document.body.textContent).not.toContain('ФОР-домен');
    fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
    openSec(/Именной цикл/);
    flipSwitch(/ФОР-7/);
    expect(document.body.textContent).toContain('ФОР-домен');
    pickSheet(/^ФОР-домен:/, /Дробление/);
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    fireEvent.click(screen.getByRole('button', { name: '📤 Экспорт' }));
    expect(document.body.textContent).toContain('FOR-7');
  });

  it('цикл: выбор toproll_6 показывает fit-подсказку', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
    openSec(/Именной цикл/);
    fireEvent.click(screen.getByRole('button', { name: /^Цикл:/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByText(/Toproll 6-week/));
    // окно 8 vs цикл 6 → proposed + просьба согласия
    expect(document.body.textContent).toMatch(/Цикл: Окно 8/);
    expect(document.body.textContent).toMatch(/согласие/);
  });

  it('ось humerus-2026: флаги дают строку и предупреждение', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
    fireEvent.click(screen.getByRole('button', { name: /Именной цикл/ }));
    flipSwitch(/Ось humerus-2026/);
    flipSwitch(/Скрут корпуса в атаку/);
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    fireEvent.click(screen.getByRole('button', { name: '📤 Экспорт' }));
    // строка оси в rationale плана (предупреждение — в safetyWarnings шага качества)
    expect(document.body.textContent).toMatch(/Ось: риск guarded/);
  });

  it('медли: ввод попыток даёт Медли-факт в плане', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
    fireEvent.click(screen.getByRole('button', { name: /Именной цикл/ }));
    pickSheet(/^Медли/, /Классика \(RT/);
    expect(document.body.textContent).toContain('Попытки медли');
    fireEvent.change(screen.getByLabelText('Попытка 1 кг'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Попытка 2 кг'), { target: { value: '80' } });
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    fireEvent.click(screen.getByRole('button', { name: '📤 Экспорт' }));
    expect(document.body.textContent).toMatch(/Медли-факт/);
  });

  it('печать: PRO-сводка со циклом попадает в HTML', () => {
    const origOpen = window.open;
    const writes: string[] = [];
    (window as any).open = () => ({ document: { write: (s: string) => writes.push(s), close: () => {} } });
    try {
      render(<ArmAutoConstructor />);
      fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
      openSec(/Именной цикл/);
      fireEvent.click(screen.getByRole('button', { name: /^Цикл:/ }));
      fireEvent.click(within(screen.getByRole('dialog')).getByText(/StrengthLog 8-week/));
      fireEvent.click(screen.getByText('⚡ Собрать план'));
      fireEvent.click(screen.getByRole('button', { name: '📤 Экспорт' }));
      fireEvent.click(screen.getByText('🖨 Печать'));
      expect(writes.length).toBe(1);
      expect(writes[0]).toContain('PRO-сводка тренера');
      expect(writes[0]).toContain('StrengthLog');
    } finally {
      (window as any).open = origOpen;
    }
  });
});

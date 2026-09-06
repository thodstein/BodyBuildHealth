import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { ArmDiagnosticsHub } from '../ArmDiagnosticsHub';
import { ArmAutoConstructor } from '../ArmAutoConstructor';
import { applyToPlanner } from '../planner-bridge';

beforeEach(() => {
  localStorage.clear();
});

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
    fireEvent.change(screen.getByDisplayValue('Неизвестен'), { target: { value: 'toproll' } });
    expect(document.body.textContent).toContain('Матчап:');
    expect(document.body.textContent).toContain('pronators');
  });

  it('конструктор показывает TOP-карточку', () => {
    render(<ArmAutoConstructor />);
    expect(document.body.textContent).toContain('TOP: матчап');
  });

  it('Grip-RPE превью в конструкторе', () => {
    render(<ArmAutoConstructor />);
    fireEvent.change(screen.getByLabelText('Grip-RPE неделя'), { target: { value: '3' } });
    expect(document.body.textContent).toContain('Grip-RPE:');
  });

  it('recovery-таб показывает return-to-pull', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Сухожилие/ }));
    expect(document.body.textContent).toContain('Return-to-pull');
    fireEvent.change(screen.getByLabelText('Травма для return-to-pull'), { target: { value: 'ucl' } });
    fireEvent.change(screen.getByLabelText('Недель с травмы'), { target: { value: '8' } });
    expect(document.body.textContent).toContain('Фаза 2');
  });

  it('TOP-карта: CNS-поля на месте', () => {
    render(<ArmAutoConstructor />);
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
    expect(screen.getByDisplayValue('70')).toBeTruthy();
    expect(screen.getByDisplayValue('85')).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: /RFD speed-блок/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('кросс-мезо: сборка с прошлым планом', () => {
    localStorage.setItem('he_arm_last_plan', JSON.stringify({
      weeks: [{ sessions: [{ exercises: [{ muscle: 'wrist_flexors', workSets: [{ weight: 40 }] }] }] }],
    }));
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByLabelText(/С прошлого плана/));
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    expect(document.body.textContent).toContain('Cross-meso');
  });

  it('sim-план: заметки недели видны в плане', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByLabelText(/Contest-sim неделя/));
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    expect(document.body.textContent).toContain('Contest-sim');
  });

  it('FOR-7: включение показывает селект домена', () => {
    render(<ArmAutoConstructor />);
    expect(document.body.textContent).not.toContain('FOR-домен');
    fireEvent.click(screen.getByLabelText(/FOR-7/));
    expect(document.body.textContent).toContain('FOR-домен');
    fireEvent.change(screen.getByDisplayValue('Поддержка'), { target: { value: 'crush' } });
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    expect(document.body.textContent).toContain('FOR-7');
  });

  it('цикл: выбор toproll_6 показывает fit-подсказку', () => {
    render(<ArmAutoConstructor />);
    const sel = screen.getByDisplayValue('— обычный план —') as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: 'toproll_6' } });
    // окно 8 vs цикл 6 → proposed + просьба согласия
    expect(document.body.textContent).toMatch(/Цикл: Окно 8/);
    expect(document.body.textContent).toMatch(/согласие/);
  });
});

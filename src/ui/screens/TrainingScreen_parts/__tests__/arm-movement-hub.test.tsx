/**
 * arm-movement-hub.test.tsx — UI: движение схватки в хабе (давление).
 * Живой маунт хаба: таб Давление → секция P1–P6, вводы пишут диагнозы.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArmDiagnosticsHub } from '../ArmDiagnosticsHub';

beforeEach(() => {
  localStorage.clear();
});

function goPressure(): void {
  render(<ArmDiagnosticsHub />);
  fireEvent.click(screen.getByRole('button', { name: /Давление/ }));
}

describe('Arm movement hub UI', () => {
  it('секция движения на месте', () => {
    goPressure();
    expect(document.body.textContent).toContain('Движение схватки P1');
  });

  it('фаза срыва: выбор mid даёт диагноз', () => {
    goPressure();
    fireEvent.click(screen.getByRole('button', { name: /Где сыпешься/ }));
    fireEvent.click(screen.getByRole('button', { name: /Середина/ }));
    expect(document.body.textContent).toContain('Слабая фаза: Середина');
  });

  it('старт: ввод реакции даёт вердикт', () => {
    goPressure();
    fireEvent.change(screen.getByLabelText('Реакция на Go, мс'), { target: { value: '280' } });
    fireEvent.change(screen.getByLabelText('Фальстарты'), { target: { value: '0' } });
    expect(document.body.textContent).toContain('280');
  });

  it('векторы: ввод старта/пина даёт просадку', () => {
    goPressure();
    fireEvent.change(screen.getByLabelText('Старт райзинг'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Старт пронация'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Пин райзинг'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Пин пронация'), { target: { value: '4' } });
    expect(document.body.textContent).toContain('containment');
  });

  it('сила стола: ввод кг даёт слабое звено', () => {
    goPressure();
    fireEvent.change(screen.getByLabelText('Сила сгибания кисти, кг'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Сила пронации, кг'), { target: { value: '22' } });
    fireEvent.change(screen.getByLabelText('Сила райзинга, кг'), { target: { value: '30' } });
    expect(document.body.textContent).toContain('пронация');
  });

  it('danger: дожим в проигрыше даёт стоп', () => {
    goPressure();
    fireEvent.click(screen.getByRole('switch', { name: 'Проигрыш' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Дожим max' }));
    expect(document.body.textContent).toContain('humerus-danger');
  });

  it('сценарии: движение снимается и восстанавливается', () => {
    goPressure();
    fireEvent.click(screen.getByRole('button', { name: /Где сыпешься/ }));
    fireEvent.click(screen.getByRole('button', { name: /Середина/ }));
    fireEvent.change(screen.getByLabelText('Деталь срыва'), { target: { value: 'открывают пальцы' } });
    fireEvent.click(screen.getByRole('button', { name: /Снапшот текущего/ }));
    expect(document.body.textContent).toContain('движение: фаза mid');
    fireEvent.change(screen.getByLabelText('Деталь срыва'), { target: { value: 'другое' } });
    fireEvent.click(screen.getByRole('button', { name: /Загрузить/ }));
    expect((screen.getByLabelText('Деталь срыва') as HTMLInputElement).value).toBe('открывают пальцы');
  });

  it('коррекция: фаза схватки видна и объясняет бонус', () => {
    goPressure();
    fireEvent.click(screen.getByRole('button', { name: /Где сыпешься/ }));
    fireEvent.click(screen.getByRole('button', { name: /Середина/ }));
    fireEvent.click(screen.getByRole('button', { name: /Коррекция/ }));
    expect(document.body.textContent).toContain('Фаза схватки: mid');
  });
});

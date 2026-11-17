/**
 * lab-unit-cleared.test.tsx — проход 117: очистка значения уносит и его единицу.
 *
 * Единица бланка — часть данных о числе, а не настройка поля. Раньше она
 * оставалась в срезе после очистки значения, и следующее число, вписанное из
 * другого бланка, читалось по старой единице: 1800 пмоль/л → очистка → 500
 * (это уже пг/мл) превращалось в 136 пг/мл — молча и без следа.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { LabSliceInput, withLabValue } from '../Calc.lab';

afterEach(cleanup);

const base = () => ({
  date: '',
  panelSex: { E2: '1800', Prolactin: '12' },
  panelBiochem: {},
  panelHematology: {},
  panelThyroid: {},
  units: { panelSex: { E2: 'пмоль/л', Prolactin: 'нг/мл' } },
}) as any;

describe('проход 117: пустое значение не оставляет единицу', () => {
  it('очистка убирает только свою единицу', () => {
    const next = withLabValue(base(), 'panelSex', 'E2', '');
    expect(next.panelSex.E2).toBe('');
    expect(next.units.panelSex).toEqual({ Prolactin: 'нг/мл' });
    expect(next.panelSex.Prolactin).toBe('12');
  });

  it('новое число единицу сохраняет — это осознанный выбор человека', () => {
    const next = withLabValue(base(), 'panelSex', 'E2', '500');
    expect(next.panelSex.E2).toBe('500');
    expect(next.units.panelSex.E2).toBe('пмоль/л');
  });

  it('срез без единиц не ломается', () => {
    const plain = { date: '', panelSex: {}, panelBiochem: {}, panelHematology: {}, panelThyroid: {} } as any;
    const next = withLabValue(plain, 'panelSex', 'E2', '');
    expect(next.panelSex.E2).toBe('');
    expect(next.units).toBeUndefined();
  });

  it('очистка в форме идёт через тот же путь', () => {
    const onChange = vi.fn();
    const { container } = render(<LabSliceInput label="До курса" slice={base()} onChange={onChange} />);
    const input = Array.from(container.querySelectorAll('input'))
      .find(i => (i as HTMLInputElement).value === '1800') as HTMLInputElement;
    expect(input, 'поле эстрадиола с введённым значением').toBeTruthy();
    fireEvent.change(input, { target: { value: '' } });
    const next = onChange.mock.calls[0][0];
    expect(next.panelSex.E2).toBe('');
    expect(next.units.panelSex.E2).toBeUndefined();
    expect(next.units.panelSex.Prolactin).toBe('нг/мл');
  });
});

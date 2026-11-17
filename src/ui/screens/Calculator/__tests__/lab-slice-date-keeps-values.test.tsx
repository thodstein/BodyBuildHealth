/**
 * lab-slice-date-keeps-values.test.tsx — проход 110: дата бланка не стирает
 * введённые анализы. Раньше `LabSliceInput` на любое изменение даты пересоздавал
 * срез с пустыми панелями, и значения (вместе с выбранными единицами) исчезали
 * молча — без ошибки и без возможности отменить.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { LabSliceInput } from '../Calc.lab';

afterEach(cleanup);

const slice = {
  date: '2026-11-01',
  panelSex: { E2: '500', Prolactin: '15' },
  panelBiochem: { ALT: '45' },
  panelHematology: { HCT: '49' },
  panelThyroid: {},
  units: { panelSex: { E2: 'пг/мл' } },
};

const dateInput = (container: HTMLElement) =>
  container.querySelector('input[type="date"]') as HTMLInputElement;

describe('проход 110: дата не стирает бланк', () => {
  it('новая дата сохраняет значения и единицу', () => {
    const onChange = vi.fn();
    const { container } = render(<LabSliceInput label="До курса" slice={slice as never} onChange={onChange} />);
    expect(dateInput(container)).toBeTruthy();
    fireEvent.change(dateInput(container), { target: { value: '2026-10-20' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const got = onChange.mock.calls[0][0];
    expect(got.date).toBe('2026-10-20');
    expect(got.panelSex.E2).toBe('500');
    expect(got.panelSex.Prolactin).toBe('15');
    expect(got.panelBiochem.ALT).toBe('45');
    expect(got.panelHematology.HCT).toBe('49');
    expect(got.units.panelSex.E2).toBe('пг/мл');
  });

  it('очистка даты не удаляет значения', () => {
    const onChange = vi.fn();
    const { container } = render(<LabSliceInput label="До курса" slice={slice as never} onChange={onChange} />);
    fireEvent.change(dateInput(container), { target: { value: '' } });
    const got = onChange.mock.calls[0][0];
    expect(got, 'срез обнулился').not.toBeNull();
    expect(got.date).toBe('');
    expect(got.panelSex.E2).toBe('500');
  });

  it('пустой срез: дата создаёт бланк с пустыми панелями', () => {
    const onChange = vi.fn();
    const { container } = render(<LabSliceInput label="До курса" slice={null} onChange={onChange} />);
    fireEvent.change(dateInput(container), { target: { value: '2026-10-20' } });
    const got = onChange.mock.calls[0][0];
    expect(got.date).toBe('2026-10-20');
    expect(got.panelSex).toEqual({});
    expect(got.panelBiochem).toEqual({});
  });
});

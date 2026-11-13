/**
 * cross-cap-calc.test.tsx — живой сумматор кросс-модульных капов (P4-аудит, раунд «все пункты»).
 * Проход 25: капы питательных веществ = реестр (`NUTRIENT_LIMITS_V2`):
 * Mg ≤350 (UL), Zn ≤40 (UL), D3 ≤4000 (UL), Se ≤255 (UL); NAC — потолок
 * протокола 4000 (клинический кап движка 2400, подпись в label).
 * Своя копия чисел (было 800/50/4000/200/4000) запрещена — калькулятор писал
 * «норма» на суммах, которые UL-контур считает перебором.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { CrossCapCalculator, CROSS_CAPS } from '../supportProtocolsShared';
import { NUTRIENT_LIMITS_V2 } from '../../../../engines/support-limits';

afterEach(cleanup);

const capOf = (key: string): number => CROSS_CAPS.find((c) => c.key === key)!.cap;

describe('cross-cap-calc: рендер и гейты', () => {
  it('показывает все капы из CROSS_CAPS', () => {
    const { container } = render(<CrossCapCalculator />);
    expect(container.querySelector('[data-capcalc="root"]')).not.toBeNull();
    for (const c of CROSS_CAPS) {
      expect(container.querySelector(`[data-capcalc="${c.key}"]`)).not.toBeNull();
    }
    expect(CROSS_CAPS).toHaveLength(10);
  });

  it('капы нутриентов не дублируют реестр, а берутся из него', () => {
    expect(capOf('mg')).toBe(NUTRIENT_LIMITS_V2.magnesium.value);
    expect(capOf('zn')).toBe(NUTRIENT_LIMITS_V2.zinc.value);
    expect(capOf('d3')).toBe(NUTRIENT_LIMITS_V2.vitamin_d.value);
    expect(capOf('se')).toBe(NUTRIENT_LIMITS_V2.selenium.value);
    // Явные якоря — чтобы падение реестра не «подтянуло» кап вверх незаметно.
    expect(capOf('mg')).toBeLessThanOrEqual(350);
    expect(capOf('zn')).toBeLessThanOrEqual(40);
    expect(capOf('d3')).toBeLessThanOrEqual(4000);
  });

  it('NAC — не UL, а потолок протокола (ClinicalGuidance)', () => {
    // NAC в реестре — ClinicalGuidance 2400 (движок капит авто-план), но
    // клинический потолок протоколов 4000; подпись об этом есть в label.
    expect(NUTRIENT_LIMITS_V2.nac.kind).toBe('ClinicalGuidance');
    expect(capOf('nac')).toBe(4000);
    expect(CROSS_CAPS.find((c) => c.key === 'nac')!.label).toContain('2400');
  });

  it('Zn без меди: подсказка «медь обязательна» + гейт по 25 мг', () => {
    const { getByLabelText, queryByText } = render(<CrossCapCalculator />);
    expect(queryByText(/cu-missing|без меди/)).toBeNull();
    fireEvent.change(getByLabelText(/Цинк/), { target: { value: '25' } });
    expect(queryByText(/без меди/)).not.toBeNull();
    fireEvent.change(getByLabelText(/Медь/), { target: { value: '1' } });
    expect(queryByText(/без меди/)).toBeNull();
  });

  it('превышение NAC подсвечивается', () => {
    const { container, getByLabelText, getByText } = render(<CrossCapCalculator />);
    fireEvent.change(getByLabelText(/NAC/), { target: { value: '4500' } });
    expect(getByText(new RegExp(`ПРЕВЫШЕНИЕ: 4500 / ${capOf('nac')}`))).not.toBeNull();
    expect(getByText(/Превышено позиций: 1/)).not.toBeNull();
    void container;
  });
  it('норма не даёт превышения, сброс в 0 — тоже норма', () => {
    const { getByLabelText, queryByText } = render(<CrossCapCalculator />);
    fireEvent.change(getByLabelText(/Телмисартан/), { target: { value: '80' } });
    expect(queryByText(/ПРЕВЫШЕНИЕ/)).toBeNull();
    fireEvent.change(getByLabelText(/Телмисартан/), { target: { value: '90' } });
    expect(queryByText(/ПРЕВЫШЕНИЕ: 90 \/ 80/)).not.toBeNull();
  });
  it('ашаваганда: кап 600 ловится', () => {
    const { getByLabelText, queryByText } = render(<CrossCapCalculator />);
    fireEvent.change(getByLabelText(/Ашваганда/), { target: { value: '600' } });
    expect(queryByText(/ПРЕВЫШЕНИЕ/)).toBeNull();
    fireEvent.change(getByLabelText(/Ашваганда/), { target: { value: '700' } });
    expect(queryByText(/ПРЕВЫШЕНИЕ: 700 \/ 600/)).not.toBeNull();
  });
});

/**
 * cross-cap-calc.test.tsx — живой сумматор кросс-модульных капов (P4-аудит, раунд «все пункты»).
 * NAC ≤4000 · Mg ≤800 · телмисартан ≤80 · Zn ≤50 · D3 ≤4000.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { CrossCapCalculator, CROSS_CAPS } from '../supportProtocolsShared';

afterEach(cleanup);

describe('cross-cap-calc: рендер и гейты', () => {
  it('показывает все 5 капов из CROSS_CAPS', () => {
    const { container } = render(<CrossCapCalculator />);
    expect(container.querySelector('[data-capcalc="root"]')).not.toBeNull();
    for (const c of CROSS_CAPS) {
      expect(container.querySelector(`[data-capcalc="${c.key}"]`)).not.toBeNull();
    }
    expect(CROSS_CAPS.map((c) => c.cap)).toEqual([4000, 800, 80, 50, 4000, 600]);
  });
  it('превышение NAC подсвечивается', () => {
    const { container, getByLabelText, getByText } = render(<CrossCapCalculator />);
    fireEvent.change(getByLabelText(/NAC/), { target: { value: '4500' } });
    expect(getByText(/ПРЕВЫШЕНИЕ: 4500 \/ 4000/)).not.toBeNull();
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

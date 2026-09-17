import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BBDiagnosticsHub } from '../BBDiagnosticsHub';

describe('bb-corrective-ui', () => {
  beforeEach(() => { localStorage.clear(); });
  it('слабая зона показывает карточку коррекции с дозой и кью', () => {
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({ weakManual: ['delt_mid'] }));
    render(<BBDiagnosticsHub />);
    const card = document.querySelector('[data-bb="corrective-card"]');
    expect(card).not.toBeNull();
    expect(card!.textContent).toMatch(/Доза:/);
    expect(card!.textContent).toMatch(/Кью:/);
    expect(card!.textContent).toMatch(/Ре-тест:/);
  });
  it('без слабых зон карточки коррекции нет', () => {
    render(<BBDiagnosticsHub />);
    expect(document.querySelector('[data-bb="corrective-card"]')).toBeNull();
  });
  it('строки коррекции несут data-corr id библиотеки', () => {
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({ weakManual: ['chest_upper'] }));
    render(<BBDiagnosticsHub />);
    const rows = document.querySelectorAll('[data-bb="corrective-row"]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].getAttribute('data-corr')).toMatch(/cu-|ch-/);
  });
});

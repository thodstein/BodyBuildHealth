import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BBDiagnosticsHub } from '../BBDiagnosticsHub';

const HUB_SRC = readFileSync(resolve(__dirname, '..', 'BBDiagnosticsHub.tsx'), 'utf8');

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
  it('оборудование профиля режет зал: гантели+вес — без тренажёров в выдаче', () => {
    localStorage.setItem('he_profile_v2', JSON.stringify({ settings: { training: { equipment: ['dumbbell', 'bodyweight'] } } }));
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({ weakManual: ['quads'] }));
    render(<BBDiagnosticsHub />);
    const rows = Array.from(document.querySelectorAll('[data-bb="corrective-row"]'));
    expect(rows.length).toBe(2);
    const ids = rows.map((r) => r.getAttribute('data-corr'));
    expect(ids).not.toContain('q-legpress-moment');
    expect(ids).not.toContain('q-leg-ext-finish');
    // все показанные — гантельные/вес тела (движок это гарантирует, UI лишь рендерит)
    for (const id of ids) expect(id).toMatch(/^(q-split-unilateral|q-goblet-heel|lh-tempo-split|ybt-split-reach)$/);
  });
  it('паритет путей: карточка и оба экспорта считают через corrSignalsFor (без инлайн-дублей)', () => {
    const uses = HUB_SRC.match(/corrSignalsFor\(/g) || [];
    expect(uses.length).toBeGreaterThanOrEqual(3); // карточка + HTML + CSV (def без скобки не считается)
    expect(HUB_SRC.includes('rankCorrectives({')).toBe(false);
  });
  it('жёлтая боль режет дозу на карточке как во вставке (2×12–15 RIR2 вместо 3×12–15 RIR1)', () => {
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({ weakManual: ['delt_mid'], pmLoc: 'elbow', pmMorning: '5' }));
    render(<BBDiagnosticsHub />);
    const card = document.querySelector('[data-bb="corrective-card"]');
    expect(card).not.toBeNull();
    expect(card!.textContent).toMatch(/2×12–15 RIR2/);
  });
  it('доза везде через corrDoseFlags: base-вызовов correctiveDose(..., {}) не осталось', () => {
    const uses = HUB_SRC.match(/corrDoseFlags\(\)/g) || [];
    expect(uses.length).toBeGreaterThanOrEqual(5); // мост + HTML + CSV + карточка + вставка
    expect(HUB_SRC.includes('cause ?? null, {})')).toBe(false);
  });
});

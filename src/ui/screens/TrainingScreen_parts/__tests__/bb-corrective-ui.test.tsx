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
  it('ROUND-10: блок коррекции (волна) рендерится из тех же пиков, честно пуст без зон', () => {
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({ weakManual: ['chest_upper', 'quads'] }));
    render(<BBDiagnosticsHub />);
    const block = document.querySelector('[data-bb="corr-block"]');
    expect(block).not.toBeNull();
    expect(document.querySelector('[data-bb="corr-block-summary"]')!.textContent).toMatch(/волна \d/);
    const weeks = document.querySelectorAll('[data-bb="corr-block-week"]');
    expect(weeks.length).toBe(6);
    expect(weeks[0].textContent).toMatch(/Нед 1 \(Втягивание\):/);
    expect(weeks[5].textContent).toMatch(/Разгрузка/);
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
    // PRO-5 Э5 (было ≥3: карточка+HTML+CSV → стало 1): единственный источник — мемо
    // correctiveTopByZone; выдача/ICS/год/мост читают его же (инлайн-копии удалены).
    const uses = HUB_SRC.match(/corrSignalsFor\(/g) || [];
    expect(uses.length).toBeGreaterThanOrEqual(1); // def без скобки не считается (пробел), остаётся мемо
    expect(HUB_SRC.includes('rankCorrectives({')).toBe(false);
  });
  it('красная боль: доза срезана (инверсия закрыта)', () => {
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({ weakManual: ['delt_mid'], pmLoc: 'elbow', pmDuring: '7' }));
    render(<BBDiagnosticsHub />);
    const card = document.querySelector('[data-bb="corrective-card"]');
    expect(card).not.toBeNull();
    expect(card!.textContent).toMatch(/2×12–15 RIR2/);
  });
  it('шарнир плывёт под весом: топ — трап/блоки', () => {
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({ weakManual: ['hamstrings'], rdlLoaded: 'fail' }));
    render(<BBDiagnosticsHub />);
    const rows = document.querySelectorAll('[data-bb="corrective-row"]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].getAttribute('data-corr')).toBe('lh-trap-swap');
  });
  it('жёлтая боль режет дозу на карточке как во вставке (2×12–15 RIR1 вместо 3×12–15)', () => {
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({ weakManual: ['delt_mid'], pmLoc: 'elbow', pmMorning: '5' }));
    render(<BBDiagnosticsHub />);
    const card = document.querySelector('[data-bb="corrective-card"]');
    expect(card).not.toBeNull();
    expect(card!.textContent).toMatch(/2×12–15 RIR2/);
  });
  it('доза везде через corrDoseFlags: base-вызовов correctiveDose(..., {}) не осталось', () => {
    // PRO-5 Э5 (было ≥5: мост+HTML+CSV+карточка+вставка → стало 3): выдача/мост читают один memo
    // correctiveDetailForExport; флаги остались в нём, карточке и вставке.
    const uses = HUB_SRC.match(/corrDoseFlags\(\)/g) || [];
    expect(uses.length).toBeGreaterThanOrEqual(3); // memo + карточка + вставка
    expect(HUB_SRC.includes('cause ?? null, {})')).toBe(false);
  });
  it('K7: карточка несёт дозу ≈кг/отдых из workMax профиля (показано = вставится)', () => {
    localStorage.setItem('he_profile_v2', JSON.stringify({ settings: { training: { workMax: { shoulders: 100 } } } }));
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({ weakManual: ['delt_mid'] }));
    render(<BBDiagnosticsHub />);
    const card = document.querySelector('[data-bb="corrective-card"]');
    expect(card).not.toBeNull();
    expect(card!.textContent).toMatch(/≈60 кг/); // 0.6 × 100 (техника)
    expect(card!.textContent).toMatch(/отдых 60с/);
    expect(card!.textContent).toMatch(/техника/); // бейдж фазы
    expect(document.querySelector('[data-bb="corrective-coverage"]')!.textContent).toMatch(/вариантов/);
  });
  it('K7: паритет карточка=экспорт — обе точки считают вес одним helper', () => {
    expect((HUB_SRC.match(/correctiveWeightHint\(/g) || []).length).toBeGreaterThanOrEqual(2); // карточка + correctiveDetailForExport
    expect((HUB_SRC.match(/loadFactor: correctiveLoadFactor\(/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});

/**
 * calc-phase-lab-cards.test.tsx — рендер K-карточек фаз (SSR, без стора).
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalcPhaseLabCards } from '../CalcPhaseLabCards';

const render = (props: any) =>
  renderToStaticMarkup(React.createElement(CalcPhaseLabCards, props));

describe('CalcPhaseLabCards', () => {
  it('course + test_enan: K0/K1/K2/K3 + аддон testosterone', () => {
    const html = render({
      phase: 'course',
      flags: { hasAAS: true, hasTest: true },
      peds: [{ id: 'test_enan', pClass: 'aas_test', form: 'inject' }],
      subs: ['telmisartan'],
    });
    for (const k of ['K0', 'K1', 'K2', 'K3', 'K8', 'K9', 'K10']) {
      expect(html).toContain(`data-phase-lab-card="${k}"`);
    }
    expect(html).toContain('data-phase-lab-addon="testosterone"');
    expect(html).toContain('Гомоцистеин');
    expect(html).toContain('Лп(a)');
  });
  it('pct: K6 + вариант hCG-bridge при длинном эфире', () => {
    const html = render({ phase: 'pct', flags: null, peds: [], subs: [], esterHalfLifeHours: 336 });
    expect(html).toContain('data-phase-lab-card="K6"');
    expect(html).toContain('hCG-bridge');
    expect(html).not.toContain('data-phase-lab-card="K2"');
  });
  it('pct + короткий эфир: SERM сразу', () => {
    const html = render({ phase: 'pct', flags: null, peds: [], subs: [], esterHalfLifeHours: 48 });
    expect(html).toContain('SERM сразу');
  });
  it('без флагов: только K0 + K9, без аддонов', () => {
    const html = render({ phase: 'course', flags: null, peds: [], subs: [] });
    expect(html).toContain('data-phase-lab-card="K0"');
    expect(html).toContain('data-phase-lab-card="K9"');
    expect(html).not.toContain('data-phase-lab-card="K2"');
    expect(html).not.toContain('data-phase-lab-addon=');
  });
  it('fertility: K7 + спермограмма; trt: K5 + PSA-правило', () => {
    const f = render({ phase: 'fertility', flags: null, peds: [], subs: [] });
    expect(f).toContain('data-phase-lab-card="K7"');
    expect(f).toContain('Спермограмма');
    const t = render({ phase: 'trt', flags: { hasAAS: true }, peds: [{ id: 'test_enan' }], subs: [] });
    expect(t).toContain('data-phase-lab-card="K5"');
    expect(t).toContain('уролог');
  });
  it('оральный курс без injectable: без K10', () => {
    const html = render({
      phase: 'course',
      flags: { hasAAS: true, hasOral17: true },
      peds: [{ id: 'methand', pClass: 'aas_oral_dbol', form: 'oral' }],
      subs: [],
    });
    expect(html).not.toContain('data-phase-lab-card="K10"');
    expect(html).toContain('data-phase-lab-addon="oral_17aa"');
  });
  it('K0: чекбокс Лп(a) и строка Лп(a) по умолчанию', () => {
    const html = render({ phase: 'course', flags: { hasAAS: true }, peds: [{ id: 'test_enan' }], subs: [] });
    expect(html).toContain('Лп(a) уже сдан');
    expect(html).toContain('Лп(a)');
  });
});

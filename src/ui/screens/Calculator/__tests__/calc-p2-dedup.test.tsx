/**
 * calc-p2-dedup.test.tsx — P2 аудита калькулятора поддержки:
 *  Д12: единый маппер курса (deriveCourseLinkPatch) — чистая функция + один путь в AutoCalculator;
 *  Д1/Д2: полный/компакт не дублируются — единые якоря calc-ped-risk-summary / calc-female-layer-summary + ссылки;
 *  Д11/Д13: подписи источников (ограничения по состоянию; PHASE_PROTOCOL);
 *  P2-UX: PillBurden в hero, якорный индекс чипов → карточки веществ.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AutoCalculator } from '../AutoCalculator';
import { CalcMapperCard } from '../Calc.mapper';
import { normalizeCalculatorState, DEFAULT_STATE } from '../Calc.types';
import { deriveCourseLinkPatch, courseFrequency } from '../calc-course-link';

beforeEach(() => {
  localStorage.clear();
});

const seedProfile = (sex: 'male' | 'female') => {
  localStorage.setItem('he_profile_v2', JSON.stringify({ settings: { personal: { sex, weight: 80, age: 30 } } }));
};

const course = (substanceId: string, doseValue: number, extra: Record<string, unknown> = {}) => [
  { id: '1', substanceId, doseValue, doseUnit: 'mg', frequency: 1, startWeek: 1, endWeek: 12, ...extra },
];

describe('Д12: единый маппер курса', () => {
  it('courseFrequency: число/строка/мусор', () => {
    expect(courseFrequency(2)).toBe(2);
    expect(courseFrequency('2x/wk')).toBe(2);
    expect(courseFrequency('2/нед')).toBe(2);
    expect(courseFrequency('')).toBe(1);
    expect(courseFrequency(undefined)).toBe(1);
    expect(courseFrequency(0)).toBe(1);
  });

  it('deriveCourseLinkPatch: AAS+флаги+дозы, недели клампятся', () => {
    const patch = deriveCourseLinkPatch([
      { substanceId: 'test_enan', doseValue: 250, frequency: '2x/wk', startWeek: 1, endWeek: 12 },
      { substanceId: 'hcg', doseValue: 500, frequency: 2, startWeek: 1, endWeek: 8 },
      { substanceId: 'somatropin', doseValue: 4, frequency: 7, startWeek: 3, endWeek: 2 },
      { substanceId: 'mystery_sub', doseValue: 10 },
    ] as never);
    expect(patch).toBeTruthy();
    const ids = patch!.aas.map(a => a.id);
    expect(ids).toContain('test_enan');
    expect(ids).toContain('hcg');
    expect(ids).not.toContain('mystery_sub');
    const test = patch!.aas.find(a => a.id === 'test_enan')!;
    expect(test.doseMgWeek).toBe(500);
    expect(test.weeks).toBe(11);
    // битые недели (end<start) клампятся к 1
    const gh = patch!.aas.find(a => a.id === 'somatropin')!;
    expect(gh.weeks).toBe(1);
    expect(patch!.flags.hasHCG).toBe(true);
    expect(patch!.flags.hasGH).toBe(true);
    expect(patch!.doses.ghIU).toBeGreaterThan(0);
  });

  it('пустой/битый список → null', () => {
    expect(deriveCourseLinkPatch([])).toBeNull();
    expect(deriveCourseLinkPatch(undefined)).toBeNull();
    expect(deriveCourseLinkPatch([{ substanceId: 'mystery' }] as never)).toBeNull();
  });

  it('AutoCalculator использует один путь (source-lock: дубль удалён)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/Calculator/AutoCalculator.tsx'), 'utf8');
    expect((src.match(/deriveCourseLinkPatch\(/g) || []).length).toBe(2); // эффект + «Фарма курс»
    expect(src).not.toContain('aasClasses');
    expect(src).not.toContain('courseFrequency');
  });
});

describe('Д1: PED-risk — одна сводка + ссылка', () => {
  it('трен 500: «Нейрозащита LV» ровно один раз, якорь и ссылка на месте', async () => {
    render(React.createElement(AutoCalculator, { embedded: true, courseWeek: 6, courseLinked: course('tren_acet', 500), onApply: () => {} } as never));
    await waitFor(() => expect(screen.queryAllByText(/Нейрозащита LV/).length).toBe(1), { timeout: 8000 });
    expect(document.getElementById('calc-ped-risk-summary')).not.toBeNull();
    expect(document.querySelector('[data-ped-risk-link]')).not.toBeNull();
    // строка компакта осталась (уровни/вещества), но без полного дубля рисков
    expect(screen.queryAllByText(/О подборе: авто-защита/).length).toBe(1);
  });
});

describe('Д2: женский слой — одна сводка + ссылка', () => {
  it('женщина + Deca 50: дозо-индекс один раз, якорь и ссылка на месте', async () => {
    seedProfile('female');
    render(React.createElement(AutoCalculator, { embedded: true, courseWeek: 6, courseLinked: course('deca', 50), onApply: () => {} } as never));
    await waitFor(() => expect(screen.queryAllByText(/Женский слой/).length).toBeGreaterThan(0), { timeout: 8000 });
    expect(screen.queryAllByText(/Дозо-индекс вирилизации/).length).toBe(1);
    expect(document.getElementById('calc-female-layer-summary')).not.toBeNull();
    expect(document.querySelector('[data-female-layer-link]')).not.toBeNull();
  });
});

describe('Д11/Д13: подписи источников', () => {
  it('медицинские ограничения по состоянию + отсылка к противопоказаниям веществ', async () => {
    localStorage.setItem('he_autocalc_state', JSON.stringify({ contraindications: { hasCVD: true } }));
    render(React.createElement(AutoCalculator, { embedded: true, courseWeek: 6, onApply: () => {} } as never));
    await waitFor(() => expect(screen.queryAllByText(/Медицинские ограничения \(по состоянию здоровья\)/).length).toBeGreaterThan(0), { timeout: 8000 });
    expect(screen.queryAllByText(/Противопоказания конкретных веществ/).length).toBeGreaterThan(0);
  });

  it('фаза: подпись источника PHASE_PROTOCOL', async () => {
    render(React.createElement(AutoCalculator, { embedded: true, courseWeek: 6, courseLinked: course('test_enan', 250), onApply: () => {} } as never));
    await waitFor(() => expect(document.querySelector('[data-phase-source]')).not.toBeNull(), { timeout: 8000 });
  });
});

describe('P2-UX: PillBurden в hero и якорный индекс веществ', () => {
  it('hero показывает таблеточную нагрузку из planResult', () => {
    const st = normalizeCalculatorState({ ...DEFAULT_STATE });
    render(React.createElement(CalcMapperCard, {
      state: st,
      onStateChange: () => {},
      onApply: () => {},
      planResult: { pillBurden: { estimatedPillsPerDay: 12, totalSubstances: 20, morningPills: 4, afternoonPills: 4, eveningPills: 4, feasibility: 'high', message: 'ок' } } as never,
    } as never));
    const hero = document.querySelector('[data-pill-hero]');
    expect(hero).not.toBeNull();
    expect(hero!.textContent).toContain('12');
  });

  it('чип списка скроллит к карточке вещества (якорь calc-sub-*)', () => {
    const st = normalizeCalculatorState({
      ...DEFAULT_STATE,
      pharma: { ...DEFAULT_STATE.pharma, aas: [{ id: 'test_enan', doseMgWeek: 250, weeks: 12, startWeek: 1, endWeek: 12 }] as never },
    });
    render(React.createElement(CalcMapperCard, { state: st, onStateChange: () => {}, onApply: () => {} } as never));
    const chip = document.querySelector('[data-sub-chip]') as HTMLElement;
    expect(chip).not.toBeNull();
    const anchorId = `calc-sub-${chip.getAttribute('data-sub-chip')}`;
    expect(document.getElementById(anchorId)).not.toBeNull();
    fireEvent.click(chip);
    expect(document.getElementById(anchorId)).not.toBeNull();
  });
});

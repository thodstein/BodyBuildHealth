/**
 * macrocycle-cardio-layer.test.tsx — кардио-слой в «Итог года» (MacrocyclePanel):
 * при привязке cardioCycleId и наличии цикла в библиотеке рендерится блок «❤️ Кардио»;
 * кардио-слой на heatmap недель (минуты из годовых кардио-циклов / цикла макро).
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MacrocyclePanel } from '../../SRCBBScreen_parts/MacrocyclePanel';
import { buildBbMacrocycle, attachCardioToMacro, serializeBbMacro } from '../../../../engines/lms/macrocycle.engine';
import { buildCardioCycle, saveCardioCycle } from '../../../../engines/lms/cardio.engine';
import { annualPlanFromMacro } from '../../../../engines/annual-training/block-builders.engine';
import { buildAnnualCardioCycles } from '../../../../engines/annual-training/annual-training-cardio.engine';
import { saveAnnualTrainingPlan, saveAnnualCardioCycles, ANNUAL_PLAN_KEY } from '../../../../engines/annual-training/annual-training-storage';
import type { BBMacrocycle } from '../../../../engines/lms/macrocycle.engine';

const BB_KEY = 'he_bb_macro';
const CYCLES_KEY = 'he_cardio_cycles';

const baseProps = { level: 'advanced', goal: 'bodybuilding' as const, onApplyCycle: () => {} };

beforeEach(() => {
  try {
    localStorage.removeItem(BB_KEY);
    localStorage.removeItem(CYCLES_KEY);
    localStorage.removeItem(ANNUAL_PLAN_KEY);
    localStorage.removeItem('he_annual_cardio_cycles');
  } catch { /* ignore */ }
});

describe('MacrocyclePanel — кардио-слой «Итог года»', () => {
  it('без привязки кардио: блок «❤️ Кардио» не рендерится', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    localStorage.setItem(BB_KEY, serializeBbMacro(macro));
    const html = renderToStaticMarkup(<MacrocyclePanel {...baseProps} />);
    expect(html).not.toContain('❤️ Кардио:');
  });

  it('с привязкой и циклом в библиотеке: блок рендерится с минутами/ккал', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    const linked = attachCardioToMacro(macro, 'cc-year');
    localStorage.setItem(BB_KEY, serializeBbMacro(linked as typeof macro));
    const cardio = buildCardioCycle({ goal: 'cut', totalWeeks: 12, id: 'cc-year', name: 'Кардио года' });
    saveCardioCycle(cardio);
    const html = renderToStaticMarkup(<MacrocyclePanel {...baseProps} />);
    expect(html).toContain('❤️ Кардио: Кардио года');
    expect(html).toContain('мин/нед');
  });

  it('с привязкой, но цикл не в библиотеке: предупреждение', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    const linked = attachCardioToMacro(macro, 'missing-id');
    localStorage.setItem(BB_KEY, serializeBbMacro(linked as typeof macro));
    const html = renderToStaticMarkup(<MacrocyclePanel {...baseProps} />);
    expect(html).toContain('не найден в библиотеке');
  });
});

describe('MacrocyclePanel — кардио-слой на heatmap недель (пункт 389 плана)', () => {
  it('годовой план с кардио-циклами по блокам: legend + минуты в aria-label недель', () => {
    const macro: BBMacrocycle = {
      blocks: [
        { phase: 'hypertrophy', weeks: 6, weekOffset: 1, description: 'Гипертрофия', trainingFocus: 'hypertrophy' },
        { phase: 'contest_prep', weeks: 6, weekOffset: 7, description: 'Prep', trainingFocus: 'endurance' },
      ],
      totalWeeks: 12,
      trainingFocus: 'hypertrophy',
      rationale: [],
    };
    localStorage.setItem(BB_KEY, serializeBbMacro(macro));
    const plan = annualPlanFromMacro(macro);
    saveAnnualTrainingPlan(plan);
    const out = buildAnnualCardioCycles(plan, { referenceIso: '2026-01-01', bodyWeight: 80 });
    for (const key of Object.keys(out.cycles)) saveCardioCycle(out.cycles[key]);
    saveAnnualCardioCycles(Object.fromEntries(Object.entries(out.cycles).map(([k, c]) => [k, c.id])));
    const html = renderToStaticMarkup(<MacrocyclePanel {...baseProps} />);
    expect(html).toContain('▮ Кардио-слой: минуты/нед');
    expect(html).toContain('по блокам года');
    expect(html).toContain('❤️ кардио');
    // aria-label первой недели блока prep (Нед 7) содержит кардио-минуты.
    expect(html).toContain('Нед 7:');
    expect(html).toMatch(/aria-label="Нед 1:[^"]*❤️ кардио \d+ мин"/);
  });

  it('без годового плана: fallback на цикл, привязанный к макро («цикл макро»)', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    const linked = attachCardioToMacro(macro, 'cc-year');
    localStorage.setItem(BB_KEY, serializeBbMacro(linked as typeof macro));
    const cardio = buildCardioCycle({ goal: 'cut', totalWeeks: 12, id: 'cc-year', name: 'Кардио года' });
    saveCardioCycle(cardio);
    const html = renderToStaticMarkup(<MacrocyclePanel {...baseProps} />);
    expect(html).toContain('▮ Кардио-слой: минуты/нед');
    expect(html).toContain('цикл макро');
    expect(html).toMatch(/aria-label="Нед 1:[^"]*❤️ кардио \d+ мин"/);
  });

  it('без кардио: legend кардио-слоя не рендерится', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    localStorage.setItem(BB_KEY, serializeBbMacro(macro));
    const html = renderToStaticMarkup(<MacrocyclePanel {...baseProps} />);
    expect(html).not.toContain('▮ Кардио-слой');
  });
});

/**
 * macrocycle-cardio-layer.test.tsx — кардио-слой в «Итог года» (MacrocyclePanel):
 * при привязке cardioCycleId и наличии цикла в библиотеке рендерится блок «❤️ Кардио».
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MacrocyclePanel } from '../../SRCBBScreen_parts/MacrocyclePanel';
import { buildBbMacrocycle, attachCardioToMacro, serializeBbMacro } from '../../../../engines/lms/macrocycle.engine';
import { buildCardioCycle, saveCardioCycle } from '../../../../engines/lms/cardio.engine';

const BB_KEY = 'he_bb_macro';
const CYCLES_KEY = 'he_cardio_cycles';

const baseProps = { level: 'advanced', goal: 'bodybuilding' as const, onApplyCycle: () => {} };

beforeEach(() => {
  try {
    localStorage.removeItem(BB_KEY);
    localStorage.removeItem(CYCLES_KEY);
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

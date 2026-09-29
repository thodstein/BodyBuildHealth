/**
 * calc-options-card.test.tsx — хвост опций подбора (по заказу «все выполнено полностью?»):
 *  1) карточка «⚙️ Опции подбора» рендерится с 3 тумблерами (SSR);
 *  2) опция «📥 Анализы из дневника» реально подтягивает he_lab_diary новее fullPanel (RTL-монтаж);
 *  3) лок доз протоколов (аудит §9): исправленные дозы-хардкоды не могут незаметно регресснуть.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AutoCalculator } from '../AutoCalculator';
import { DEFAULT_STATE, normalizeCalculatorState } from '../Calc.types';

const courseLinked = [
  { id: '1', substanceId: 'test_enan', doseValue: 250, doseUnit: 'mg', frequency: '2x/wk', startWeek: 1, endWeek: 12 },
];

const mount = () => render(
  React.createElement(AutoCalculator, { embedded: true, courseWeek: 6, courseLinked: courseLinked as any, onApply: () => {} })
);

describe('карточка «⚙️ Опции подбора» (SSR)', () => {
  beforeEach(() => { localStorage.clear(); });

  it('рендерится с 3 тумблерами, по умолчанию выключены', () => {
    const html = renderToStaticMarkup(
      React.createElement(AutoCalculator, { embedded: true, courseWeek: 6, courseLinked: courseLinked as any, onApply: () => {} })
    );
    // срез только карточки опций (aria-pressed=true встречается и в других карточках)
    const i = html.indexOf('data-calc="options"');
    const card = html.slice(i, i + 5000);
    for (const key of ['diaryLabs', 'dietAware', 'geneticsOn']) {
      expect(card).toContain(`data-calc-option="${key}"`);
    }
    expect(card.match(/aria-pressed="false"/g)?.length).toBe(3);
  });
});

describe('📥 diaryLabs: авто-подстановка свежих анализов из дневника (монтаж)', () => {
  beforeEach(() => {
    localStorage.clear();
    // Опция ВКЛ + старый fullPanel (январь) — через he_autocalc_state (его читает hydrateState)
    localStorage.setItem('he_autocalc_state', JSON.stringify({
      ...DEFAULT_STATE,
      labs: { ...DEFAULT_STATE.labs, fullPanel: { date: '2026-01-01', panelBiochem: { ALT: '40' } } },
      options: { diaryLabs: true },
    }));
    // Дневник лаборатории: запись от сентября — НОВЕЕ fullPanel
    localStorage.setItem('he_lab_diary', JSON.stringify([
      { date: '2026-09-20', totalMarkers: 1, abnormalCount: 1, markers: [{ code: 'ALT', name: 'АЛТ', value: 180, unit: 'U/L', inRange: false }] },
    ]));
  });

  it('fullPanel заменяется записью дневника с датой, статус-флеш с датой', async () => {
    mount();
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('he_autocalc_state') || '{}');
      expect(saved?.labs?.fullPanel?.date).toBe('2026-09-20');
      expect(saved?.labs?.fullPanel?.panelBiochem?.ALT).toBe('180');
    }, { timeout: 6000 });
    // честный флеш с датой (эффект ставит fillStatus)
    await waitFor(() => {
      expect(screen.getAllByText(/подставлены из дневника/).length).toBeGreaterThan(0);
    }, { timeout: 6000 });
  });

  it('дневник СТАРШЕ fullPanel → перезаписи нет (реф-гард по дате)', async () => {
    localStorage.setItem('he_lab_diary', JSON.stringify([
      { date: '2025-01-01', totalMarkers: 1, abnormalCount: 0, markers: [{ code: 'ALT', name: 'АЛТ', value: 99, unit: 'U/L', inRange: true }] },
    ]));
    mount();
    await new Promise(r => setTimeout(r, 700));
    const saved = JSON.parse(localStorage.getItem('he_autocalc_state') || '{}');
    expect(saved?.labs?.fullPanel?.date).toBe('2026-01-01');
    expect(saved?.labs?.fullPanel?.panelBiochem?.ALT).toBe('40');
  });

  it('клик по тумблеру выключает опцию (aria-pressed)', async () => {
    const { container } = mount();
    await waitFor(() => {
      expect(container.querySelector('[data-calc-option="diaryLabs"]')?.getAttribute('aria-pressed')).toBe('true');
    }, { timeout: 6000 });
    fireEvent.click(container.querySelector('[data-calc-option="dietAware"]')!);
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('he_autocalc_state') || '{}');
      expect(saved?.options?.dietAware).toBe(true);
    }, { timeout: 6000 });
  });
});

describe('лок доз протоколов (аудит §9: исправленные хардкоды не регрессируют)', () => {
  // Источник-лок по канонической дозе: регресс («старая доза вернулась» = канон исчез)
  // роняет тест. Чтение исходника, т.к. SSR покрывает только дефолтный таб.
  const src = (f: string): string =>
    readFileSync(join(process.cwd(), 'src/ui/screens/SupportScreen_parts', f), 'utf8');

  it('B6 → 10-25 мг (Prolactin/PostCycle), 25 (Adaptogen); глицирризиновая 50-100', () => {
    expect(src('supportProtocolProlactin.tsx')).toContain("dose:'10-25 мг'");
    expect(src('supportProtocolPostCycle.tsx')).toContain('B6 10-25 мг');
    expect(src('supportProtocolAdaptogen.tsx')).toContain('+ B6 25 мг');
    expect(src('supportProtocolAdaptogen.tsx')).toContain("dose:'50-100 мг'");
  });

  it('метформин 2550 (GH); глюкарат макс 2000 (E2); ашваганда /сут (Thyroid)', () => {
    expect(src('supportProtocolGH.tsx')).toContain('2550');
    expect(src('supportProtocolE2.tsx')).toContain('макс 2000 мг/сут');
    expect(src('supportProtocolThyroid.tsx')).toContain('300-600 мг/сут');
    expect(src('supportProtocolThyroid.tsx')).not.toContain("timing:'2×/день', note:'Адаптоген. Повышает ТТГ");
  });

  it('CoQ10 100-300 ×3 (Cardio/Renal/Immune); пентоксифиллин ≤800 (Cardio)', () => {
    for (const f of ['supportProtocolCardio.tsx', 'supportProtocolRenal.tsx', 'supportProtocolImmune.tsx']) {
      expect(src(f), f).toContain('100-300 мг (типично 200)');
    }
    expect(src('supportProtocolCardio.tsx')).toContain('макс 800 мг/сут');
  });

  it('соль ≠ элемент: Mg-треонат ≈140 эл. Mg (Neuro); Zn-карнозин ≈17 эл. Zn (GI)', () => {
    expect(src('supportProtocolNeuro.tsx')).toContain('≈140 мг эл. Mg');
    expect(src('supportProtocolGI.tsx')).toContain('≈ 17 мг элементарного Zn');
  });

  it('пробиотики 10-50 млрд (Immune/GI); TUDCA с едой + силимарин 300-600 (Steatosis)', () => {
    expect(src('supportProtocolImmune.tsx')).toContain('10-50 млрд КОЕ');
    expect(src('supportProtocolGI.tsx')).toContain('10-50 млрд КОЕ');
    expect(src('supportProtocolSteatosis.tsx')).toContain('300-600 мг');
    expect(src('supportProtocolSteatosis.tsx')).not.toContain('Вечер натощак');
  });
});

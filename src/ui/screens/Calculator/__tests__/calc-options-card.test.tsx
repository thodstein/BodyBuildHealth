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
import { db } from '../../../../core/db';

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

  it('запись без поля в бланке названа в статусе, а не исчезает (проход 196)', async () => {
    localStorage.setItem('he_lab_diary', JSON.stringify([
      { date: '2026-09-20', markers: [
        { code: 'ALT', value: 180, unit: 'U/L' },
        { code: 'MCV', value: 88, unit: 'fL' },
      ] },
    ]));
    mount();
    await waitFor(() => {
      expect(screen.getAllByText(/не перенесено 1/).length).toBeGreaterThan(0);
    }, { timeout: 6000 });
    expect(screen.getAllByText(/Средний объём эритроцита/).length).toBeGreaterThan(0);
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('he_autocalc_state') || '{}');
      expect(saved?.labs?.fullPanel?.panelBiochem?.ALT).toBe('180');
    }, { timeout: 6000 });
  });

  it('абсолютные ретикулоциты не подписываются процентами (проход 196)', async () => {
    localStorage.setItem('he_lab_diary', JSON.stringify([
      { date: '2026-09-20', markers: [
        { code: 'RETICULOCYTES', value: 50, unit: '10⁹/л' },
      ] },
    ]));
    mount();
    // Одного поля нет — но и «подставлено» без объяснения не звучит.
    await waitFor(() => {
      expect(screen.getAllByText(/Ретикулоциты 50 10⁹\/л — единица другой величины/).length).toBeGreaterThan(0);
    }, { timeout: 6000 });
    const saved = JSON.parse(localStorage.getItem('he_autocalc_state') || '{}');
    expect(saved?.labs?.fullPanel?.panelHematology?.Reticulocytes).toBeUndefined();
  });

  it('дневник СТАРШЕ fullPanel → перезаписи нет (реф-гард по дате)', async () => {    localStorage.setItem('he_lab_diary', JSON.stringify([
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

describe('📥 diaryLabs: склад Лаборатории (labs_log) — главный источник (проход 151)', () => {
  const seed = async () => {
    localStorage.clear();
    localStorage.setItem('he_autocalc_state', JSON.stringify({
      ...DEFAULT_STATE,
      labs: { ...DEFAULT_STATE.labs, fullPanel: { date: '2026-01-01', panelBiochem: { ALT: '40' } } },
      options: { diaryLabs: true },
    }));
    await db.init();
    for (const r of await db.getAll<any>('labs_log')) await db.delete('labs_log', r.id);
    // Свежий бланк, старая запись (введена позже) и архивная — в форме должны
    // остаться свежий ALT и GLU, а удалённый CRP вернуться не должен.
    await db.put('labs_log', { id: 'l1', code: 'GLU', name: 'Глюкоза', value: 5.4, unit: 'mmol/L', date: '2026-09-20', patientId: 'current-user' });
    await db.put('labs_log', { id: 'l2', code: 'ALT', name: 'АЛТ', value: 180, unit: 'U/L', date: '2026-09-20', patientId: 'current-user' });
    await db.put('labs_log', { id: 'l3', code: 'ALT', name: 'АЛТ', value: 25, unit: 'U/L', date: '2026-01-05', patientId: 'current-user' });
    await db.put('labs_log', { id: 'l4', code: 'CRP', name: 'СРБ', value: 9, unit: 'мг/л', date: '2026-01-05', patientId: 'current-user', archived: true });
  };

  it('авто-подстановка читает склад, а не только зеркало дневника', async () => {
    await seed();
    mount();
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('he_autocalc_state') || '{}');
      expect(saved?.labs?.fullPanel?.date).toBe('2026-09-20');
      expect(saved?.labs?.fullPanel?.panelBiochem?.ALT).toBe('180');
      expect(saved?.labs?.fullPanel?.panelBiochem?.Glucose).toBe('5.4');
      // Архивная запись не воскресает.
      expect(saved?.labs?.fullPanel?.panelBiochem?.CRP).toBeUndefined();
    }, { timeout: 10000 });
    await waitFor(() => {
      expect(screen.getAllByText(/из Лаборатории/).length).toBeGreaterThan(0);
    }, { timeout: 10000 });
  });

  it('кнопка «Анализы»: свежая запись маркера главнее порядка строк, счёт — маркеры', async () => {
    await seed();
    const { container } = mount();
    const btn = Array.from(container.querySelectorAll('button')).find((b) => (b.textContent || '').includes('из лаборатории'));
    expect(btn).toBeTruthy();
    fireEvent.click(btn!);
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('he_autocalc_state') || '{}');
      expect(saved?.labs?.fullPanel?.panelBiochem?.ALT).toBe('180');
      expect(saved?.labs?.fullPanel?.panelBiochem?.CRP).toBeUndefined();
    }, { timeout: 10000 });
    // Два распознанных маркера, а не три строки склада (архивная не в счёт).
    await waitFor(() => {
      expect(screen.getAllByText(/Анализы загружены \(2/).length).toBeGreaterThan(0);
    }, { timeout: 10000 });
  });
});

describe('📥 diaryLabs: удалённый бланк не воскресает из зеркала (проход 160)', () => {
  it('зеркало новее склада не подставляется, если в складе есть записи', async () => {
    localStorage.clear();
    localStorage.setItem('he_autocalc_state', JSON.stringify({
      ...DEFAULT_STATE,
      labs: { ...DEFAULT_STATE.labs, fullPanel: { date: '2026-01-01', panelBiochem: { ALT: '40' } } },
      options: { diaryLabs: true },
    }));
    await db.init();
    for (const r of await db.getAll<any>('labs_log')) await db.delete('labs_log', r.id);
    // В складе — один бланк; зеркало держит день, которого в складе НЕТ
    // (бланк удалили, а дневник не открывали).
    await db.put('labs_log', { id: 's1', code: 'ALT', name: 'АЛТ', value: 180, unit: 'U/L', date: '2026-09-20', patientId: 'current-user' });
    localStorage.setItem('he_lab_diary', JSON.stringify([
      { date: '2026-10-05', totalMarkers: 1, abnormalCount: 1, markers: [{ code: 'CRP', name: 'СРБ', value: 9, unit: 'мг/л' }] },
    ]));
    mount();
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('he_autocalc_state') || '{}');
      expect(saved?.labs?.fullPanel?.date).toBe('2026-09-20');
      expect(saved?.labs?.fullPanel?.panelBiochem?.ALT).toBe('180');
    }, { timeout: 10000 });
    // Удалённый CRP не вернулся, хотя зеркало «новее».
    expect(JSON.parse(localStorage.getItem('he_autocalc_state') || '{}')?.labs?.fullPanel?.panelBiochem?.CRP).toBeUndefined();
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

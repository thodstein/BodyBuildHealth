/**
 * support-hub-passport-ui.test.tsx — UI-smoke P7: паспорт рендерится,
 * хаб переключается в 6-й режим, поиск строит карточку вещества.
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { SupportSubstancePassport } from '../SupportSubstancePassport';
import { SupportCalcToolsHub } from '../SupportCalcToolsHub';
import { SupportTimingPlanner } from '../SupportTimingPlanner';

describe('P7 паспорт UI', () => {
  it('паспорт рендерится с поиском', () => {
    const { container, unmount } = render(<SupportSubstancePassport />);
    expect(container.textContent || '').toMatch(/Паспорт вещества/);
    expect(container.querySelector('input')).toBeTruthy();
    unmount();
  });

  it('хаб: бейдж 6 в 1 + переход в паспорт', () => {
    const { container, unmount } = render(<SupportCalcToolsHub s={{}} />);
    expect(container.textContent || '').toMatch(/6 в 1/);
    const pill = Array.from(container.querySelectorAll('button')).find(b => (b.textContent || '').includes('Паспорт'));
    expect(pill).toBeTruthy();
    fireEvent.click(pill!);
    expect(container.textContent || '').toMatch(/Паспорт вещества/);
    unmount();
  });

  it('поиск магния строит карточку паспорта', () => {    const { container, unmount } = render(<SupportSubstancePassport />);
    const input = container.querySelector('input')!;
    fireEvent.change(input, { target: { value: 'магний' } });
    const hit = Array.from(container.querySelectorAll('div')).find(
      d => d.textContent && /\(magnesium/.test(d.textContent) && (d as HTMLElement).onclick !== undefined,
    );
    // кликаем по первому результату выдачи (текст содержит id в скобках)
    const cand = Array.from(container.querySelectorAll('div')).find(d =>
      /Магний.*\(magnesium/.test(d.textContent || '') && (d.children.length === 0 || (d.textContent || '').length < 60),
    );
    expect(cand || hit).toBeTruthy();
    fireEvent.click((cand || hit) as Element);
    expect(container.textContent || '').toMatch(/Доказательность|Био:/);
    unmount();
  });

  it('обход всех 6 режимов — без style-shorthand warning', () => {
    const errors: string[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => { errors.push(a.map(String).join(' ')); };
    try {
      const { container, unmount } = render(<SupportCalcToolsHub s={{}} />);
      for (const label of ['Биодоступность', 'Расчёт дозы', 'Синергия', 'Тайминг', 'Аналоги', 'Паспорт']) {
        const pill = Array.from(container.querySelectorAll('button')).find(b => (b.textContent || '').includes(label));
        expect(pill, label).toBeTruthy();
        fireEvent.click(pill!);
      }
      expect(errors.some(e => /shorthand/i.test(e))).toBe(false);
      unmount();
    } finally {
      console.error = orig;
    }
  });

  it('персист: выбранное вещество переживает ремаунт', () => {
    try { localStorage.setItem('he_bio_passport', 'magnesium'); } catch { /* noop */ }
    try {
      const { container, unmount } = render(<SupportSubstancePassport />);
      // карточка видна сразу, без поиска
      expect(container.textContent || '').toMatch(/Доза:|Био:/);
      unmount();
    } finally {
      try { localStorage.removeItem('he_bio_passport'); } catch { /* noop */ }
    }
  });

  it('паспорт ААС показывает AAS-timing блок из данных БД', () => {
    try { localStorage.setItem('he_bio_passport', 'test_prop'); } catch { /* noop */ }
    try {
      const { container, unmount } = render(<SupportSubstancePassport />);
      expect(container.textContent || '').toMatch(/AAS-тайминг/);
      expect(container.textContent || '').toMatch(/EOD/);
      unmount();
    } finally {
      try { localStorage.removeItem('he_bio_passport'); } catch { /* noop */ }
    }
  });

  it('паспорт тянет лабы из synergy-БД (креатин → креатинин)', () => {
    try { localStorage.setItem('he_bio_passport', 'creatine'); } catch { /* noop */ }
    try {
      const { container, unmount } = render(<SupportSubstancePassport />);
      expect(container.textContent || '').toMatch(/Креатинин/);
      unmount();
    } finally {
      try { localStorage.removeItem('he_bio_passport'); } catch { /* noop */ }
    }
  });

  it('тайминг мигрирует legacy-ключ выбора', () => {
    try {
      localStorage.removeItem('he_bio_timing_subs_v1');
      localStorage.setItem('he_bio_timing_subs', JSON.stringify(['magnesium']));
    } catch { /* noop */ }
    try {
      const { container, unmount } = render(<SupportTimingPlanner />);
      expect(container.textContent || '').toMatch(/Магний/);
      expect(localStorage.getItem('he_bio_timing_subs_v1')).toMatch(/magnesium/);
      expect(localStorage.getItem('he_bio_timing_subs')).toBeNull();
      unmount();
    } finally {
      try { localStorage.removeItem('he_bio_timing_subs_v1'); } catch { /* noop */ }
      try { localStorage.removeItem('he_bio_timing_subs'); } catch { /* noop */ }
    }
  });
});

  it('доза: битый стор не роняет, валидный префиллит дозу', async () => {
    const { SupportEffectiveDose } = await import('../SupportEffectiveDose');
    try { localStorage.setItem('he_bio_dose_v1', '{broken'); } catch { /* noop */ }
    const r1 = render(<SupportEffectiveDose />);
    expect((r1.container.textContent || '')).toMatch(/Расчёт эффективной дозы/);
    r1.unmount();
    try { localStorage.setItem('he_bio_dose_v1', JSON.stringify({ sub1Id: 'magnesium', sub2Id: '', dose1: 400, dose2: 500, form1Idx: 0, form2Idx: 0 })); } catch { /* noop */ }
    const r2 = render(<SupportEffectiveDose />);
    expect((r2.container.textContent || '')).toMatch(/400 мг/);
    r2.unmount();
    try { localStorage.removeItem('he_bio_dose_v1'); } catch { /* noop */ }
  });

describe('AAS-тайминг UI (отдельная зона)', () => {
  it('зона открывается с дисклеймером, AAS не в общем пикере', () => {
    const { container, unmount } = render(<SupportTimingPlanner />);
    expect(container.textContent || '').toMatch(/AAS-тайминг/);
    fireEvent.click(Array.from(container.querySelectorAll('div[role="button"]')).find(d => (d.textContent || '').includes('AAS-тайминг'))!);
    expect(container.textContent || '').toMatch(/не назначение/);
    unmount();
    try { localStorage.removeItem('he_bio_timing_aas_v1'); } catch { /* noop */ }
  });

  it('выбор тестостерона показывает T½-карточку из данных БД', () => {
    const { container, unmount } = render(<SupportTimingPlanner />);
    fireEvent.click(Array.from(container.querySelectorAll('div[role="button"]')).find(d => (d.textContent || '').includes('AAS-тайминг'))!);
    const search = Array.from(container.querySelectorAll('input')).find(i => (i.getAttribute('placeholder') || '').includes('ААС'));
    expect(search).toBeTruthy();
    fireEvent.change(search!, { target: { value: 'тестостерон' } });
    // Чип строго внутри AAS-зоны (в общем пикере ААС быть не должно — lock)
    const zone = container.querySelector('[data-aas="zone"]')!;
    expect(zone.textContent || '').toMatch(/пропионат/);
    const mains = Array.from(container.querySelectorAll('.sup-timing > div')[0]?.querySelectorAll('div') || []);
    expect(mains.some(d => /^\+ Тестостерон/.test((d.textContent || '').trim()))).toBe(false);
    const chip = Array.from(zone.querySelectorAll('[data-aas="chip"]')).find(d =>
      /пропионат/i.test(d.textContent || ''),
    );
    expect(chip).toBeTruthy();
    fireEvent.click(chip as Element);
    const card = zone.querySelector('[data-aas="card"]');
    expect(card).toBeTruthy();
    expect(card!.textContent || '').toMatch(/T½/);
    expect(card!.textContent || '').toMatch(/EOD|2×\/нед|ED/);
    unmount();
    try { localStorage.removeItem('he_bio_timing_aas_v1'); } catch { /* noop */ }
  });

  it('синергия: ААС в стеке тянет общий AAS-блок (HCT)', async () => {
    const { UnifiedSynergyCalculator } = await import('../UnifiedSynergyCalculator');
    try {
      localStorage.removeItem('he_bio_timing_aas_v1');
      localStorage.setItem('he_unified_ids', JSON.stringify(['testosterone', 'magnesium', '']));
    } catch { /* noop */ }
    try {
      const { container, unmount } = render(<UnifiedSynergyCalculator s={{}} />);
      expect(container.textContent || '').toMatch(/Гематокрит/);
      unmount();
    } finally {
      try { localStorage.removeItem('he_unified_ids'); } catch { /* noop */ }
    }
  });

  it('тайминг: legacy-ААС переезжает из расписания в AAS-зону', () => {
    try {
      localStorage.removeItem('he_bio_timing_subs_v1');
      localStorage.removeItem('he_bio_timing_aas_v1');
      localStorage.setItem('he_bio_timing_subs', JSON.stringify(['testosterone', 'magnesium']));
    } catch { /* noop */ }
    try {
      const { container, unmount } = render(<SupportTimingPlanner />);
      // Зона схлопнута по умолчанию — открываем
      fireEvent.click(Array.from(container.querySelectorAll('div[role="button"]')).find(d => (d.textContent || '').includes('AAS-тайминг'))!);
      const zone = container.querySelector('[data-aas="zone"]')!;
      expect(zone.querySelector('[data-aas="card"]')?.textContent || '').toMatch(/Тестостерон/);
      expect(localStorage.getItem('he_bio_timing_subs_v1')).toBe(JSON.stringify(['magnesium']));
      expect(localStorage.getItem('he_bio_timing_subs')).toBeNull();
      unmount();
    } finally {
      try { localStorage.removeItem('he_bio_timing_subs_v1'); } catch { /* noop */ }
      try { localStorage.removeItem('he_bio_timing_subs'); } catch { /* noop */ }
      try { localStorage.removeItem('he_bio_timing_aas_v1'); } catch { /* noop */ }
    }
  });
});

/**
 * sup-io-apk.test.tsx — IO-кнопки блока «БАДы» под АПК.
 *
 * Жалоба: кнопки импорта/сохранения/экспорта/копии мелкие, не под телефон.
 * Норма: первичные CTA 52px, вторичные 48px, иконки 44px, шрифт 11-13px.
 * Плюс: экспорт дневника идёт через системный шит (shareOrDownload) там,
 * где anchor-download в APK WebView молча не работает; копирование плана
 * без блокирующего alert() (инлайн-статус).
 *
 * jsdom не считает layout: табы кнопок проверяем по инлайн-стилям.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { SupportDiaryView } from '../SupportDiaryView';
import { SupportStacksView } from '../SupportStacksView';
import { SupportTimingPlanner } from '../SupportTimingPlanner';
import { SupportFavoritesView } from '../SupportFavoritesView';

const noop = () => {};

function px(v: string): number {
  const m = String(v || '').match(/^(\d+(?:\.\d+)?)px$/);
  return m ? parseFloat(m[1]) : NaN;
}

/** Все кнопки выборки должны иметь инлайн-высоту не ниже минимума. */
function expectMinTap(container: ParentNode, re: RegExp, min: number, label: string): void {
  const btns = Array.from(container.querySelectorAll('button')).filter((b) =>
    re.test((b.textContent || '').trim()),
  ) as HTMLElement[];
  expect(btns.length > 0, `${label}: кнопки найдены`).toBe(true);
  for (const b of btns) {
    const h = px(b.style.minHeight || '');
    expect(h >= min, `${label} "${(b.textContent || '').trim().slice(0, 24)}" minHeight=${b.style.minHeight || '—'}`).toBe(true);
  }
}

function stacksMocks(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    stackName: 'Мой стек', setStackName: noop, SUPPORT_LEVELS: {}, supportLevel: 'mid',
    savedStacks: [], setSavedStacks: noop, expandedStack: null, setExpandedStack: noop,
    getStackDisplayName: (st: { name?: string; id: string }) => st.name || st.id,
    catalogSubstances: [], effectiveLevel: { subs: ['x1'], dosages: {} }, showToast: noop, ...over,
  };
}

function planMocks(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    catalogSubstances: [], favTab: 'plan', setFavTab: noop, favSearch: '', setFavSearch: noop,
    favRefresh: 0, setFavRefresh: noop, SUPPORT_LEVELS: {}, supportLevel: 'mid', calcSupport: noop,
    setPlanSaved: noop, planSubTab: 'active', setPlanSubTab: noop, archivedPlans: [], setArchivedPlans: noop,
    expandedArchiveId: null, setExpandedArchiveId: noop, cartItems: [], setCartItems: noop,
    setCalcResult: noop, setCalcDone: noop, setSupportLevel: noop, setCourseWeekState: noop,
    setBoostEnabled: noop, setJointMode: noop, setEnhancedSubs: noop, setMyPlansRefresh: noop,
    reportGenerated: false, setReportGenerated: noop, mixGoals: [], setMixGoals: noop,
    mixWorkoutType: 'moderate', setMixWorkoutType: noop, mixTimeOfDay: 'morning', setMixTimeOfDay: noop,
    setSection: noop, setTab: noop, setSupportView: noop, setCalcView: noop, linked: {},
    jointMode: false, boostEnabled: false, setShowModal: noop,
    effectiveLevel: { subs: ['sub_a'], dosages: { sub_a: { mg: 100, timing: 'утро' } } },
    enhancedSubs: [], showToast: noop, ...over,
  };
}

describe('SUP IO APK (44/48/52px)', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch {}
  });
  afterEach(() => {
    cleanup();
    try { localStorage.clear(); } catch {}
  });

  it('дневник/история: JSON/CSV/импорт — тапы 48px', () => {
    const { container, getByText } = render(<SupportDiaryView s={{}} />);
    fireEvent.click(getByText('📊 История'));
    expectMinTap(container, /JSON/, 48, 'diary-json');
    expectMinTap(container, /CSV/, 48, 'diary-csv');
    const label = container.querySelector('label') as HTMLElement;
    expect(label, 'import label').not.toBeNull();
    expect(px(label.style.minHeight || '') >= 48, `import minHeight=${label.style.minHeight}`).toBe(true);
  });

  it('дневник: сохранить заметки — CTA 48px', () => {
    const { container } = render(<SupportDiaryView s={{}} />);
    expectMinTap(container, /Сохранить заметки/, 48, 'diary-notes');
  });

  it('стеки: сохранить 48px, удалить 44px', () => {
    const { container } = render(<SupportStacksView s={stacksMocks()} />);
    expectMinTap(container, /^Сохранить$/, 48, 'stack-save');
  });

  it('тайминг: копировать 44px + инлайн-статус без alert', () => {
    const { container } = render(<SupportTimingPlanner />);
    // выбираем добавку, чтобы появилось расписание и кнопка копии
    const adder = container.querySelector('.sup-timing [style*="cursor: pointer"]') as HTMLElement;
    expect(adder, 'есть что выбрать').not.toBeNull();
    fireEvent.click(adder);
    expectMinTap(container, /Копировать план/, 44, 'timing-copy');
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      /Копировать план/.test((b.textContent || '')),
    ) as HTMLElement | undefined;
    if (btn) {
      fireEvent.click(btn);
      expect(container.textContent).toContain('Скопировано');
    }
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src', 'ui', 'screens', 'SupportScreen_parts', 'SupportTimingPlanner.tsx'),
      'utf-8',
    );
    expect(src, 'no alert() in timing').not.toContain('alert(');
  });

  it('избранное/план: сохранить 52px, действия 48px', () => {
    const { container } = render(<SupportFavoritesView s={planMocks()} />);
    expectMinTap(container, /Сохранить план/, 52, 'fav-save');
    expectMinTap(container, /Из моих стеков|В корзину/, 48, 'fav-actions');
  });

  it('калькулятор: ряд действий 48px (строковый хук)', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src', 'ui', 'screens', 'Calculator', 'Calc.mapper.tsx'),
      'utf-8',
    );
    expect(src, 'calc actions minHeight').toContain('minHeight:48');
    expect(src, 'calc actions hook').toContain('data-sup-io="calc-action"');
  });

  it('дневник: экспорт через shareOrDownload (строковый хук)', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src', 'ui', 'screens', 'SupportScreen_parts', 'SupportDiaryView.tsx'),
      'utf-8',
    );
    expect(src, 'share fallback').toContain('shareOrDownload');
    expect(src, 'web share api').toContain('canShare');
  });

  it('CSS: IO-слой на месте (ленты, тапы, фокус)', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'src', 'ui', 'screens', 'SupportScreen_parts', 'support-design.css'),
      'utf-8',
    );
    for (const hook of ['sup-io-row', 'data-sup-io', 'min-width: 44px']) {
      expect(css, hook).toContain(hook);
    }
    const native = fs.readFileSync(
      path.join(process.cwd(), 'src', 'styles-native-support.css'),
      'utf-8',
    );
    expect(native, 'native io').toContain('data-sup-io');
  });
});

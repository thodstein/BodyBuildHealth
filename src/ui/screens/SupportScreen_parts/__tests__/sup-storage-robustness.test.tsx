/**
 * sup-storage-robustness.test.tsx — битый localStorage не роняет раздел БАД.
 *
 * P0-класс: JSON.parse без проверки формы. Скаляр/объект от старой версии
 * ронял рендер (.map/.find/spread) или кнопки (.push/.splice) — чёрный экран
 * и мёртвые кнопки. Мутации: каждый ключ по очереди — скаляр, объект,
 * битый JSON; рендер табов + клики сейвов/удалений не должны бросать.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { readSupportArr, readSupportStrArr, readSupportObj, writeSupportJSON } from '../support-storage';
import { SupportFavoritesView } from '../SupportFavoritesView';
import { SupportCatalogView } from '../SupportCatalogView';
import { SupportDiaryView } from '../SupportDiaryView';

const noop = (): void => {};

const CORRUPTIONS: Array<[string, string]> = [
  ['scalar-string', '"just-a-string"'],
  ['scalar-number', '42'],
  ['object', '{"foo":"bar"}'],
  ['broken-json', '{not json'],
  ['null', 'null'],
];

const SUPPORT_KEYS = [
  'he_support_favorites',
  'he_my_substances',
  'he_my_stacks',
  'supportCart',
  'he_saved_support_plans',
  'supportPlanArchive',
  'he_my_plans',
  'he_saved_calc_results',
  'he_support_plan_result',
  'he_general_plan',
  'he_support_reports_archive',
  'he_support_diary',
  'he_finder_saved_stacks',
];

function seedCorrupt(key: string, variant: string): void {
  try {
    localStorage.setItem(key, variant);
  } catch {}
}

const favBase: Record<string, unknown> = {
  catalogSubstances: [{ id: 'creatine', name: 'Креатин', categories: [], mechanisms: [] }],
  favSearch: '',
  setFavSearch: noop,
  favRefresh: 0,
  setFavRefresh: noop,
  SUPPORT_LEVELS: { mid: { label: 'mid', subs: [] } },
  supportLevel: 'mid',
  calcSupport: noop,
  setPlanSaved: noop,
  archivedPlans: [],
  setArchivedPlans: noop,
  expandedArchiveId: null,
  setExpandedArchiveId: noop,
  cartItems: [],
  setCartItems: noop,
  setCalcResult: noop,
  setCalcDone: noop,
  setSupportLevel: noop,
  setCourseWeekState: noop,
  setBoostEnabled: noop,
  setJointMode: noop,
  setEnhancedSubs: noop,
  setMyPlansRefresh: noop,
  effectiveLevel: { subs: [], dosages: {} },
  enhancedSubs: [],
  showToast: noop,
  jointMode: false,
  boostEnabled: false,
  setShowModal: noop,
  courseWeekState: 6,
  reportGenerated: false,
  setReportGenerated: noop,
  mixGoals: [],
  setMixGoals: noop,
  mixWorkoutType: '',
  setMixWorkoutType: noop,
  mixTimeOfDay: '',
  setMixTimeOfDay: noop,
  setSection: noop,
  setTab: noop,
  setSupportView: noop,
  setCalcView: noop,
  linked: { profile: null, course: [] },
};

const catalogBase: Record<string, unknown> = {
  catalogSubTab: 'stack',
  setCatalogSubTab: noop,
  searchQuery: '',
  setSearchQuery: noop,
  expandedCategories: {},
  setExpandedCategories: noop,
  selectedSub: null,
  setSelectedSub: noop,
  enhancedSubs: [],
  setEnhancedSubs: noop,
  setFavRefresh: noop,
  catalogSubstances: [],
  groupedSubstances: [],
  OrganGroupedSubstances: [],
  typeGroupedSubstances: [],
  SUPPORT_TIER_GROUPS: {},
  filteredStacks: [
    {
      id: 'st1',
      name: 'Тестовый стек',
      problem: 'тест',
      description: 'd',
      system: 's',
      substances: [{ id: 'creatine', dose: '5г' }],
      synergyScore: 80,
    },
  ],
  stackSystems: [],
  stkFilterSystem: 'all',
  setStkFilterSystem: noop,
  stkFilterQty: 'all',
  setStkFilterQty: noop,
  stkFilterScore: 'all',
  setStkFilterScore: noop,
  stackExpanded: null,
  setStackExpanded: noop,
  mergedInteractions: [],
  catDetailInteractions: () => null,
  renderCatalogDetail: () => null,
  toast: null,
};

describe('support-storage helpers', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {}
  });
  afterEach(() => {
    cleanup();
    try {
      localStorage.clear();
    } catch {}
  });

  it('readSupportArr: массивы целы, мусор → fallback', () => {
    localStorage.setItem('k_arr', '[1,2]');
    expect(readSupportArr('k_arr')).toEqual([1, 2]);
    for (const [, variant] of CORRUPTIONS) {
      localStorage.setItem('k_bad', variant);
      expect(readSupportArr('k_bad'), variant).toEqual([]);
    }
    expect(readSupportArr('k_missing'), 'missing').toEqual([]);
  });

  it('readSupportStrArr: режет не-строки', () => {
    localStorage.setItem('k_mix', '["a",1,null,{"x":1},"b"]');
    expect(readSupportStrArr('k_mix')).toEqual(['a', 'b']);
    localStorage.setItem('k_str', '"abc"');
    expect(readSupportStrArr('k_str')).toEqual([]);
  });

  it('readSupportObj + writeSupportJSON roundtrip', () => {
    expect(readSupportObj('k_o', { a: 1 })).toEqual({ a: 1 });
    localStorage.setItem('k_o', '{"x":5}');
    expect(readSupportObj('k_o', {})).toEqual({ x: 5 });
    localStorage.setItem('k_o', '[1]');
    expect(readSupportObj('k_o', { d: 1 })).toEqual({ d: 1 });
    expect(writeSupportJSON('k_w', { a: [1] })).toBe(true);
    expect(readSupportObj('k_w', {})).toEqual({ a: [1] });
  });
});

describe('corrupted support storage does not crash UI', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {}
  });
  afterEach(() => {
    cleanup();
    try {
      localStorage.clear();
    } catch {}
  });

  it('Избранное: все табы живы при битом сторе каждого ключа', () => {
    const tabs = ['favorites', 'mySubstances', 'myStacks', 'plan', 'reports', 'calculator', 'mixes'] as const;
    for (const key of SUPPORT_KEYS) {
      for (const [cname, variant] of CORRUPTIONS) {
        seedCorrupt(key, variant);
        for (const favTab of tabs) {
          const planSubTab = 'active';
          let err: unknown = null;
          try {
            const { unmount } = render(
              <SupportFavoritesView s={{ ...favBase, favTab, setFavTab: noop, planSubTab, setPlanSubTab: noop }} />,
            );
            unmount();
          } catch (e) {
            err = e;
          }
          expect(err, `${key}/${cname}/tab=${favTab}`).toBeNull();
        }
        try {
          localStorage.removeItem(key);
        } catch {}
      }
    }
  });

  it('План: «Сохранить план» и «В корзину» работают поверх битого стора', () => {
    seedCorrupt('he_saved_support_plans', '"scalar"');
    seedCorrupt('supportCart', '{"o":1}');
    const s = {
      ...favBase,
      favTab: 'plan',
      setFavTab: noop,
      planSubTab: 'active',
      setPlanSubTab: noop,
      effectiveLevel: { subs: ['creatine'], dosages: { creatine: { mg: 5000, timing: 'утро' } } },
    };
    const { container, unmount } = render(<SupportFavoritesView s={s} />);
    const saveBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent || '').includes('Сохранить план'),
    );
    expect(saveBtn, 'save btn present').not.toBeUndefined();
    expect(() => saveBtn && fireEvent.click(saveBtn)).not.toThrow();
    expect(readSupportArr('he_saved_support_plans').length, 'plan persisted').toBe(1);
    const cartBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent || '').includes('В корзину'),
    );
    expect(() => cartBtn && fireEvent.click(cartBtn)).not.toThrow();
    expect(readSupportArr('supportCart').length, 'cart persisted').toBe(1);
    unmount();
  });

  it('Каталог стеков: «+ Мой стек» / «В мои стеки» поверх битого стора', () => {
    seedCorrupt('he_finder_saved_stacks', '42');
    seedCorrupt('he_my_stacks', '"x"');
    const { container, unmount } = render(<SupportCatalogView s={{ ...catalogBase }} />);
    const addBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent || '').includes('Мой стек'),
    );
    expect(addBtn, 'stack btn present').not.toBeUndefined();
    expect(() => addBtn && fireEvent.click(addBtn)).not.toThrow();
    expect(readSupportArr('he_finder_saved_stacks').length, 'finder stacks persisted').toBe(1);
    const myBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent || '').includes('В мои стеки'),
    );
    expect(() => myBtn && fireEvent.click(myBtn)).not.toThrow();
    expect(readSupportArr('he_my_stacks').length, 'my stacks persisted').toBe(1);
    unmount();
  });

  it('Дневник: скаляр вместо массива не роняет рендер', () => {
    for (const [, variant] of CORRUPTIONS) {
      seedCorrupt('he_support_diary', variant);
      let err: unknown = null;
      try {
        const { unmount } = render(<SupportDiaryView s={{}} />);
        unmount();
      } catch (e) {
        err = e;
      }
      expect(err, `diary/${variant}`).toBeNull();
    }
  });

  it('Дневник: битые элементы режутся при загрузке', () => {
    localStorage.setItem(
      'he_support_diary',
      JSON.stringify([
        { date: '2026-01-01', substances: { creatine: { taken: true } } },
        'scalar',
        null,
        { date: 42, substances: {} },
        { nodate: true },
      ]),
    );
    expect(() => {
      const { unmount } = render(<SupportDiaryView s={{}} />);
      unmount();
    }).not.toThrow();
  });
});

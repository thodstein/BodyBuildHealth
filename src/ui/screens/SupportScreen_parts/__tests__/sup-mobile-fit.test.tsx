/**
 * sup-mobile-fit.test.tsx — адаптация вкладки «БАДы» под телефон (360px).
 *
 * 1. Ни один раздел не задаёт инлайн width/min-width шире вьюпорта
 *    (главный источник горизонтального переполнения на телефоне;
 *    maxWidth/fluid-контейнеры разрешены).
 * 2. CSS несёт телефонные правила: 16px в полях (без iOS-зума),
 *    dvh-шиты модалок, safe-area (верх/низ), 1-колоночные сетки ≤380px.
 *
 * jsdom не считает layout: инлайн-стили сканируем в DOM,
 * табличные правила — строковыми ассертами по CSS-файлам.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { SupportScreen } from '../../SupportScreen';
import { SupportDiaryView } from '../SupportDiaryView';
import { SupportCalcToolsHub } from '../SupportCalcToolsHub';
import { SupportGeneratorInfo } from '../SupportGeneratorInfo';
import { SupportFavoritesView } from '../SupportFavoritesView';
import { SupportResearch } from '../SupportResearch';
import { SupportStacksView } from '../SupportStacksView';
import { SupportCatalogView } from '../SupportCatalogView';
import { SupportPeptideCalc } from '../SupportPeptideCalc';
import { SupportTimingPlanner } from '../SupportTimingPlanner';
import { SupportEffectiveDose } from '../SupportEffectiveDose';
import { SupportAnalogCalculator } from '../SupportAnalogCalculator';
import { SupportBioavailability } from '../SupportBioavailability';
import { UnifiedSynergyCalculator } from '../UnifiedSynergyCalculator';
import { SymptomSolverTab } from '../SymptomSolverTab';
import { ComplaintsTab } from '../ComplaintsTab';
import { SupportProtocols } from '../SupportProtocols';
import { SupportManualPicker } from '../SupportManualPicker';
import { SupportModals } from '../SupportModals';
import { SupportProtocolNeuro } from '../supportProtocolNeuro';
import { SupportProtocolCardio } from '../supportProtocolCardio';
import { SupportProtocolHepatic } from '../supportProtocolHepatic';
import { SupportProtocolRenal } from '../supportProtocolRenal';
import { SupportProtocolJoints } from '../supportProtocolJoints';
import { SupportProtocolAcne } from '../supportProtocolAcne';
import { SupportProtocolInjections } from '../supportProtocolInjections';
import { SupportProtocolHemato } from '../supportProtocolHemato';
import { SupportProtocolMetabolic } from '../supportProtocolMetabolic';
import { SupportProtocolGI } from '../supportProtocolGI';
import { SupportProtocolHair } from '../supportProtocolHair';
import { SupportProtocolThyroid } from '../supportProtocolThyroid';
import { SupportProtocolImmune } from '../supportProtocolImmune';
import { SupportProtocolE2 } from '../supportProtocolE2';
import { SupportProtocolSleep } from '../supportProtocolSleep';
import { SupportProtocolDetox } from '../supportProtocolDetox';
import { SupportProtocolGH } from '../supportProtocolGH';
import { SupportProtocolGLP1 } from '../supportProtocolGLP1';
import { SupportProtocolMito } from '../supportProtocolMito';
import { SupportProtocolSteatosis } from '../supportProtocolSteatosis';
import { SupportProtocolRAAS } from '../supportProtocolRAAS';
import { SupportProtocolElectrolytes } from '../supportProtocolElectrolytes';
import { SupportProtocolProlactin } from '../supportProtocolProlactin';
import { SupportProtocolAdaptogen } from '../supportProtocolAdaptogen';
import { SupportProtocolPeptide } from '../supportProtocolPeptide';
import { SupportProtocolPostCycle } from '../supportProtocolPostCycle';
import { SupportProtocolEmergency } from '../supportProtocolEmergency';
import { SupportProtocolInteractions } from '../supportProtocolInteractions';
import { SupportProtocolCost } from '../supportProtocolCost';
import { SupportProtocolWomen } from '../supportProtocolWomen';

const PHONE_W = 360;

function setPhoneViewport(): void {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: PHONE_W });
  window.dispatchEvent(new Event('resize'));
}

/** Инлайн width/min-width в px шире телефона. */
function fixedOverflows(root: ParentNode): string[] {
  const bad: string[] = [];
  root.querySelectorAll('*').forEach((el) => {
    const e = el as HTMLElement;
    if (!e.style) return;
    for (const prop of ['width', 'minWidth'] as const) {
      const v = (e.style[prop] || '').trim();
      const m = v.match(/^(\d+(?:\.\d+)?)px$/);
      if (m && parseFloat(m[1]) > PHONE_W) {
        const cls = String(e.className || '').slice(0, 40);
        bad.push(`${e.tagName}${cls ? `.${cls}` : ''} ${prop}=${v}`);
      }
    }
  });
  return bad;
}

function readDesignCss(): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'src', 'ui', 'screens', 'SupportScreen_parts', 'support-design.css'),
    'utf-8',
  );
}

function readNativeCss(): string {
  return fs.readFileSync(path.join(process.cwd(), 'src', 'styles-native-support.css'), 'utf-8');
}

const noop = (): void => {};

const catalogMocks: Record<string, unknown> = {
  catalogSubTab: 'type',
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
  filteredStacks: [],
  stackSystems: [],
  stkFilterSystem: '',
  setStkFilterSystem: noop,
  stkFilterQty: '',
  setStkFilterQty: noop,
  stkFilterScore: '',
  setStkFilterScore: noop,
  stackExpanded: {},
  setStackExpanded: noop,
  mergedInteractions: [],
  catDetailInteractions: [],
  renderCatalogDetail: () => null,
  toast: null,
};

const stacksMock: Record<string, unknown> = {
  stackName: '',
  setStackName: noop,
  SUPPORT_LEVELS: {},
  supportLevel: 'base',
  savedStacks: [],
  setSavedStacks: noop,
  expandedStack: null,
  setExpandedStack: noop,
  getStackDisplayName: (id: string) => id,
  catalogSubstances: [],
};

const researchMocks: Record<string, unknown> = {
  pubMedQuery: '',
  setPubMedQuery: noop,
  pubMedResults: [],
  setPubMedResults: noop,
  pubMedLoading: false,
  setPubMedLoading: noop,
  pubMedError: null,
  pubchemResults: [],
  setPubchemResults: noop,
  pubchemLoading: false,
  pubchemError: null,
  fdaResults: [],
  setFdaResults: noop,
  fdaLoading: false,
  fdaError: null,
  pharmaSearchQ: '',
  pharmaSearchResults: [],
  researchSource: 'pubmed',
  setResearchSource: noop,
  setTab: noop,
  handlePubMedSearch: noop,
  doPharmaSearch: noop,
  handlePubchemSearch: noop,
  handleFDASearch: noop,
};

const peptideMock: Record<string, unknown> = {
  peptideId: '',
  setPeptideId: noop,
  pepAmount: 2,
  setPepAmount: noop,
  pepDose: 100,
  setPepDose: noop,
  pepDilution: 2,
  setPepDilution: noop,
  pepSyringe: 'U100_1ml',
  setPepSyringe: noop,
  pepProtocol: null,
  setPepProtocol: noop,
  pepSchedule: ['Пн'],
  setPepSchedule: noop,
  pepTotalDays: 30,
  setPepTotalDays: noop,
  goBack: noop,
};

const modalsMock: Record<string, unknown> = {
  showModal: 'intel',
  setShowModal: noop,
  modalLevel: null,
  setModalLevel: noop,
  modalSearch: '',
  setModalSearch: noop,
  modalSelected: [],
  setModalSelected: noop,
  modalAddMode: false,
  setModalAddMode: noop,
  showSavedPicker: false,
  setShowSavedPicker: noop,
  setEnhancedSubs: noop,
  setBoostEnabled: noop,
  setSupportLevel: noop,
  setManualLevelSelected: noop,
  calcSupport: noop,
  catalogSupport: [],
  allSupport: [],
  catalogSubstances: [],
  jointMode: false,
  setJointMode: noop,
  boostEnabled: false,
  getStackDisplayName: (id: string) => id,
  savedStacks: [],
  MECH_TRANSLATIONS_RU: {},
  SUPPORT_LEVELS: {},
  courseWeekState: 6,
  setCourseWeekState: noop,
  maxCourseWeek: 12,
  onWeekChange: noop,
};

const PROTO_MODULES: Array<React.FC<{ s: Record<string, unknown> }>> = [
  SupportProtocolNeuro,
  SupportProtocolCardio,
  SupportProtocolHepatic,
  SupportProtocolRenal,
  SupportProtocolJoints,
  SupportProtocolAcne,
  SupportProtocolInjections,
  SupportProtocolHemato,
  SupportProtocolMetabolic,
  SupportProtocolGI,
  SupportProtocolHair,
  SupportProtocolThyroid,
  SupportProtocolImmune,
  SupportProtocolE2,
  SupportProtocolSleep,
  SupportProtocolDetox,
  SupportProtocolGH,
  SupportProtocolGLP1,
  SupportProtocolMito,
  SupportProtocolSteatosis,
  SupportProtocolRAAS,
  SupportProtocolElectrolytes,
  SupportProtocolProlactin,
  SupportProtocolAdaptogen,
  SupportProtocolPeptide,
  SupportProtocolPostCycle,
  SupportProtocolEmergency,
  SupportProtocolInteractions,
  SupportProtocolCost,
  SupportProtocolWomen,
];

describe('SUP mobile fit (360px)', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {}
    setPhoneViewport();
  });
  afterEach(() => {
    cleanup();
    try {
      localStorage.clear();
    } catch {}
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  });

  it('экраны: hero, таб каталога, меню протоколов — без фиксированных ширин', () => {
    const cases: Array<[string, React.ReactElement]> = [
      ['hero', <SupportScreen />],
      ['catalog-tab', <SupportScreen initialTab="catalog" />],
      [
        'protocols-menu',
        <SupportProtocols s={{ protocolTab: '', protocolView: 'menu', setProtocolTab: noop, setProtocolView: noop }} />,
      ],
    ];
    for (const [name, el] of cases) {
      const { container, unmount } = render(el);
      expect(fixedOverflows(container), name).toEqual([]);
      unmount();
    }
  });

  it('инфо-разделы: дневник, хаб расчётов, каталог, стеки, исследования — без фиксированных ширин', () => {
    const cases: Array<[string, React.ReactElement]> = [
      ['diary', <SupportDiaryView s={{}} />],
      ['calctools', <SupportCalcToolsHub s={{}} />],
      ['geninfo', <SupportGeneratorInfo s={{}} />],
      ['favorites', <SupportFavoritesView s={{}} />],
      ['research', <SupportResearch s={researchMocks} />],
      ['stacks', <SupportStacksView s={stacksMock} />],
      ['catalog', <SupportCatalogView s={catalogMocks} />],
      ['peptides', <SupportPeptideCalc s={peptideMock} />],
      ['timing', <SupportTimingPlanner />],
      ['effdose', <SupportEffectiveDose />],
      ['analog', <SupportAnalogCalculator />],
      ['bio', <SupportBioavailability s={{}} />],
      ['synergy', <UnifiedSynergyCalculator s={{}} />],
      ['solver', <SymptomSolverTab s={{}} />],
      ['complaints', <ComplaintsTab />],
    ];
    for (const [name, el] of cases) {
      const { container, unmount } = render(el);
      expect(fixedOverflows(container), name).toEqual([]);
      unmount();
    }
  });

  it('протоколы-модули (30 шт) — без фиксированных ширин', () => {
    for (const Mod of PROTO_MODULES) {
      const { container, unmount } = render(<Mod s={{}} />);
      expect(fixedOverflows(container), Mod.name || 'module').toEqual([]);
      unmount();
    }
  });

  it('модалки: пикер и оверлей — dialog-хуки и без фиксированных ширин', () => {
    const picker = render(
      <SupportManualPicker
        onClose={noop}
        enhancedSubs={[]}
        setEnhancedSubs={noop}
        catalogSubstances={[]}
        allSupport={[]}
        ALL_STACKS={[]}
        catalogSupport={[]}
        SUPPORT_LEVELS={{}}
        supportLevel="base"
        MECH_TRANSLATIONS_RU={{}}
        MECH_LABELS={{}}
      />,
    );
    expect(picker.container.querySelector('.sup-manualpick'), 'pick root').not.toBeNull();
    expect(fixedOverflows(picker.container), 'picker').toEqual([]);
    picker.unmount();
    const modals = render(<SupportModals {...(modalsMock as never)} />);
    expect(modals.container.querySelector('.sup-modals'), 'modals root').not.toBeNull();
    expect(fixedOverflows(modals.container), 'modals').toEqual([]);
    modals.unmount();
  });

  it('CSS: телефонные правила на месте (16px, dvh, safe-area, 1 колонка)', () => {
    const css = readDesignCss();
    for (const hook of [
      'max-width: 480px',
      'font-size: 16px',
      '92dvh',
      'safe-area-inset-bottom',
      'grid-template-columns: 1fr',
      'bottom:70',
      'overflow-wrap: break-word',
      '-webkit-tap-highlight-color: transparent',
      'text-size-adjust: 100%',
      'text-overflow: ellipsis',
      'sup-dialog',
      '86dvh',
      '68dvh',
      'top: 132px',
      'min-width: 0',
    ]) {
      expect(css, hook).toContain(hook);
    }
    const native = readNativeCss();
    for (const hook of ['safe-area-inset-top', 'safe-area-inset-bottom', 'supApkSheetUp']) {
      expect(native, hook).toContain(hook);
    }
  });

  it('легаси-каталог: twin-записи БД не дают дублей строк и ключей', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<SupportScreen initialTab="catalog" />);
      const keyWarns = err.mock.calls.filter((a) => String(a[0]).includes('same key'));
      expect(keyWarns).toEqual([]);
    } finally {
      err.mockRestore();
    }
  });

  it('нижний таббар стоит НАД глобальной навигацией, контент чистит обе панели', () => {
    const { container } = render(<SupportScreen />);
    const nav = container.querySelector("[data-sup='nav']") as HTMLElement;
    expect(nav, 'inner nav').not.toBeNull();
    // не bottom:0 (так он крыл глобальный таббар и тапы уходили не туда)
    expect(nav.style.bottom).toContain('var(--nav-height');
    const root = container.querySelector('.support-screen') as HTMLElement;
    expect(root.style.paddingBottom).toContain('var(--nav-height');
    // hero-контент поднят над обеими панелями
    const heroHtml = container.querySelector('.support-hero')?.innerHTML || '';
    expect(heroHtml).toContain('140px');
  });

  it('топбары не перекрывают контент: отступ ≥ высоты шапки, горизонталь зажата', () => {
    // персист навигации (he_sup_nav_v1) сбрасываем — каждый кейс стартует с hero
    localStorage.removeItem('he_sup_nav_v1');
    const { container } = render(<SupportScreen />);
    const root = container.querySelector('.support-screen') as HTMLElement;
    expect(root.style.overflowX, 'no page h-scroll').toBe('clip');
    // Генератор: шапка BackNav+пилюли ≈120px → отступ 124px
    const calc = container.querySelector('.support-hero-card[data-key="calc"]') as HTMLElement;
    expect(calc, 'calc card').not.toBeNull();
    fireEvent.click(calc as HTMLElement);
    expect(container.querySelector("[data-sup='topbar']"), 'gen topbar').not.toBeNull();
    expect(root.style.paddingTop, 'gen offset').toBe('124px');
    cleanup();
    // Протоколы: шапка BackNav ≈57px → отступ 60px
    localStorage.removeItem('he_sup_nav_v1');
    const second = render(<SupportScreen />);
    const proto = second.container.querySelector('.support-hero-card[data-key="protocols"]') as HTMLElement;
    fireEvent.click(proto);
    const root2 = second.container.querySelector('.support-screen') as HTMLElement;
    expect(root2.style.paddingTop, 'protocols offset').toBe('60px');
    second.unmount();
    // Инфо: шапка BackNav+пилюли ≈123px на 360px → отступ 132px
    localStorage.removeItem('he_sup_nav_v1');
    const third = render(<SupportScreen />);
    const info = third.container.querySelector('.support-hero-card[data-key="info"]') as HTMLElement;
    expect(info, 'info card').not.toBeNull();
    fireEvent.click(info);
    expect(third.container.querySelector("[data-sup='topbar']"), 'info topbar').not.toBeNull();
    const root3 = third.container.querySelector('.support-screen') as HTMLElement;
    expect(root3.style.paddingTop, 'info offset').toBe('132px');
    third.unmount();
  });
});

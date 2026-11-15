/**
 * bb-auto-nav.test.ts — «экран в ББ-авто сам перескакивает на другой».
 *
 * 1. Чистая политика навигации (`bb-auto-nav.ts`) — открытие конструктора и право
 *    внешнего плана уводить на «План».
 * 2. Source-guard'ы на три файла: монтирование больше не ставит шаг, hand-off
 *    годового плана не уводит в «Contest prep», выход в плеер — событием, а не
 *    подделкой storage.
 * 3. P2: кросс-оконные storage-события и скролл наверх при смене шага.
 *
 * jsdom-рендер god-компонента BbAutoConstructor виснет (пред-существующее), поэтому
 * UI-часть проверяется по исходнику — как в bb-wave-p0-fixes.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BB_AUTO_STEPS,
  BB_EDITING_STEPS,
  ANNUAL_CTX_TTL_MS,
  isBbAutoStep,
  validBbAutoStep,
  resolveBbAutoOpenStep,
  shouldFollowExternalPlan,
  annualBlockCtxIsFresh,
  clampBbWeek,
  shouldNavigateOnStorageEvent,
} from '../bb-auto-nav';

const DIR = resolve(__dirname, '..');
const SRC = readFileSync(resolve(DIR, 'BbAutoConstructor.tsx'), 'utf8');
const TRAINING = readFileSync(resolve(DIR, '..', 'TrainingScreen.tsx'), 'utf8');
const MACRO = readFileSync(resolve(DIR, '..', 'SRCBBScreen_parts', 'MacrocyclePanel.tsx'), 'utf8');
const TRAINING_UI = readFileSync(resolve(DIR, 'training-ui.tsx'), 'utf8');

describe('resolveBbAutoOpenStep — вход в конструктор не прыгает на «План»', () => {
  it('нет сохранённой позиции → «1 Параметры» (раньше был безусловный «План»)', () => {
    expect(resolveBbAutoOpenStep(undefined, { hasPlan: true })).toBe('params');
    expect(resolveBbAutoOpenStep(null, { hasPlan: true })).toBe('params');
  });

  it('мусор в хранилище → «1 Параметры», без исключений', () => {
    for (const junk of [42, '', 'nope', {}, [], true, NaN]) {
      expect(resolveBbAutoOpenStep(junk, { hasPlan: true })).toBe('params');
    }
  });

  it('сохранённый шаг пользователя восстанавливается', () => {
    expect(resolveBbAutoOpenStep('contest', { hasPlan: true })).toBe('contest');
    expect(resolveBbAutoOpenStep('adjust', { hasPlan: true })).toBe('adjust');
    expect(resolveBbAutoOpenStep('annual', { hasPlan: true })).toBe('annual');
    expect(resolveBbAutoOpenStep('params', { hasPlan: true })).toBe('params');
  });

  it('шаг, невозможный без плана, не восстанавливается', () => {
    for (const s of ['plan', 'quality', 'adjust', 'contest'] as const) {
      expect(resolveBbAutoOpenStep(s, { hasPlan: false })).toBe('params');
    }
  });

  it('«Реальные веса» — транзиентный шаг: после перезагрузки → «План»', () => {
    expect(resolveBbAutoOpenStep('weights', { hasPlan: true })).toBe('plan');
    expect(resolveBbAutoOpenStep('weights', { hasPlan: false })).toBe('params');
  });

  it('режим «Программы»: шага «Сплит» нет в ленте', () => {
    expect(resolveBbAutoOpenStep('split', { hasPlan: true, programMode: true })).toBe('params');
    expect(resolveBbAutoOpenStep('split', { hasPlan: true, programMode: false })).toBe('split');
  });
});

describe('validBbAutoStep / BB_AUTO_STEPS', () => {
  it('каждый шаг ленты валиден при плане', () => {
    expect(BB_AUTO_STEPS).toHaveLength(10);
    for (const s of BB_AUTO_STEPS) {
      expect(isBbAutoStep(s)).toBe(true);
      expect(validBbAutoStep(s, { hasPlan: true })).toBe(s);
    }
  });
});

describe('shouldFollowExternalPlan — внешний план не уводит с рабочего шага', () => {
  it('редактирующие шаги (в т.ч. «Годовой план» со встроенным планировщиком) — остаёмся', () => {
    for (const s of ['params', 'ped', 'split', 'contest', 'annual', 'tools'] as const) {
      expect(BB_EDITING_STEPS.has(s)).toBe(true);
      expect(shouldFollowExternalPlan(s)).toBe(false);
    }
  });

  it('просмотр плана/качества — переходим на «План»', () => {
    for (const s of ['plan', 'weights', 'quality', 'adjust'] as const) {
      expect(shouldFollowExternalPlan(s)).toBe(true);
    }
  });
});

describe('annualBlockCtxIsFresh — старый контекст блока не «выстреливает»', () => {
  const now = Date.parse('2026-11-15T12:00:00.000Z');

  it('свежий ts → можно предзаполнять', () => {
    expect(annualBlockCtxIsFresh({ ts: now - 5 * 60_000 }, null, now)).toBe(true);
  });

  it('старше суток → чужой хвост', () => {
    expect(annualBlockCtxIsFresh({ ts: now - ANNUAL_CTX_TTL_MS - 60_000 }, null, now)).toBe(false);
  });

  it('без ts берём дату сохранённого плана', () => {
    expect(annualBlockCtxIsFresh({}, '2026-11-15T11:30:00.000Z', now)).toBe(true);
    expect(annualBlockCtxIsFresh({}, '2026-11-13T11:30:00.000Z', now)).toBe(false);
  });

  it('ни ts, ни даты → не свежий', () => {
    expect(annualBlockCtxIsFresh(null, null, now)).toBe(false);
    expect(annualBlockCtxIsFresh({}, 'not-a-date', now)).toBe(false);
  });

  it('часы чуть впереди — допускаем (±5 мин)', () => {
    expect(annualBlockCtxIsFresh({ ts: now + 2 * 60_000 }, null, now)).toBe(true);
    expect(annualBlockCtxIsFresh({ ts: now + 10 * 60_000 }, null, now)).toBe(false);
  });
});

describe('clampBbWeek', () => {
  it('держит неделю в границах плана и чинит мусор', () => {
    expect(clampBbWeek(undefined, 6)).toBe(1);
    expect(clampBbWeek(0, 6)).toBe(1);
    expect(clampBbWeek('4', 6)).toBe(4);
    expect(clampBbWeek(99, 6)).toBe(6);
    expect(clampBbWeek(2.6, 6)).toBe(3);
    expect(clampBbWeek(3, 0)).toBe(3);
  });
});

describe('source-guard: BbAutoConstructor', () => {
  it('позиция (шаг + неделя) сохраняется и восстанавливается', () => {
    expect(SRC).toContain("from './bb-auto-nav'");
    expect(SRC).toContain('step, bbWeekSel,');
    expect(SRC).toContain('persistedStep = state.step');
    expect(SRC).toContain('persistedWeek = state.bbWeekSel');
    expect(SRC).toContain('resolveBbAutoOpenStep(persistedStep');
    expect(SRC).toContain('clampBbWeek(persistedWeek');
  });

  it('персист не затирает сохранённую позицию до восстановления (порядок эффектов)', () => {
    // Эффект автосохранения объявлен ВЫШЕ эффекта восстановления: без этого
    // гейта первый проход писал дефолты в he_bb_auto_state_v1 до чтения.
    expect(SRC).toContain('persistReadyRef');
    expect(SRC).toContain('if (persistReadyRef.current) persist();');
  });

  it('предзаполнение Contest prep не меняет шаг (нет setStep внутри applyAnnualBlockCtx)', () => {
    // Прежняя регрессия: `applyAnnualBlockCtx` всегда делала `setStep('contest')` —
    // передача блока выбрасывала пользователя из «Годового плана» в форму тапера.
    expect(SRC).not.toContain('applyAnnualBlockCtx(consumeAnnualBlockCtx())');
    const at = SRC.indexOf('const applyAnnualBlockCtx = (');
    expect(at).toBeGreaterThan(0);
    const body = SRC.slice(at, SRC.indexOf('\n  };', at));
    expect(body).toContain('annualBlockCtxToPrepPatch');
    expect(body).not.toContain('setStep(');
    // Оба вызова — без опций: шаг решают монтирование/обработчик события.
    expect(SRC).toContain('applyAnnualBlockCtx(handoffCtx);');
    expect(SRC).toContain('const prefilled = handoff ? applyAnnualBlockCtx(ctx) : false;');
  });

  it('внешний he-bb-plan-saved решает по текущему шагу (stepRef), а не ставит «План» вслепую', () => {
    expect(SRC).toContain('const stepRef = useRef<Step>(step)');
    expect(SRC).toContain('shouldFollowExternalPlan(stepRef.current)');
    expect(SRC).toContain("window.addEventListener('he-bb-plan-saved', onExternalPlan)");
  });

  it('замена плана извне сбрасывает правки/веса прежней структуры', () => {
    const at = SRC.indexOf('const onExternalPlan = (e: Event)');
    expect(at).toBeGreaterThan(0);
    const body = SRC.slice(at, SRC.indexOf("window.addEventListener('he-bb-plan-saved'", at));
    expect(body).toContain('setExerciseEdits({})');
    expect(body).toContain('setWeightEntries([])');
  });

  it('выход в плеер — явное событие, подделки storage больше нет', () => {
    expect(SRC).toContain("new CustomEvent('training-exit-constructor'");
    expect(SRC).not.toContain("new StorageEvent('storage', { key: 'he_training_tab' })");
    // План, ушедший в плеер, теперь сохраняется (раньше терялся при ремаунте).
    expect(SRC).toMatch(/he_bb_plan_saved/);
  });
});

describe('source-guard: TrainingScreen и MacrocyclePanel', () => {
  it('TrainingScreen закрывает окно конструктора по training-exit-constructor', () => {
    expect(TRAINING).toContain("window.addEventListener('training-exit-constructor', h)");
    expect(TRAINING).toContain("window.removeEventListener('training-exit-constructor', h)");
  });

  it('контекст передачи блока несёт метку времени', () => {
    expect(MACRO).toContain('ts: Date.now(),');
  });
});

describe('P2: кросс-оконные storage-события не уводят экран', () => {
  it('событие своего документа (isTrusted=false) — по-прежнему навигация', () => {
    for (const page of ['hero', 'planning', 'tabs', 'constructor']) {
      expect(shouldNavigateOnStorageEvent({ isTrusted: false, page })).toBe(true);
    }
  });

  it('чужое окно не выдёргивает пользователя из открытого конструктора', () => {
    expect(shouldNavigateOnStorageEvent({ isTrusted: true, page: 'constructor' })).toBe(false);
  });

  it('чужое окно вне конструктора навигацию не ломает (как было)', () => {
    expect(shouldNavigateOnStorageEvent({ isTrusted: true, page: 'tabs' })).toBe(true);
    expect(shouldNavigateOnStorageEvent({ isTrusted: true, page: 'hero' })).toBe(true);
  });

  it('TrainingScreen гейтит storage-обработчик этой политикой и знает текущую страницу', () => {
    expect(TRAINING).toContain('shouldNavigateOnStorageEvent({ isTrusted: e.isTrusted, page: pageRef.current })');
    expect(TRAINING).toContain('pageRef.current = page;');
    // Трек 'arm' раньше выпадал из белого списка и превращался в 'pl'.
    expect(TRAINING).toMatch(/const allowed: PlanningTrack\[\] = \[[^\]]*'arm'/);
  });
});

describe('P2: смена шага скроллит реальный скроллер конструктора', () => {
  it('usePlannerStepScroll берёт тело окна конструктора (.tp-cbody), а не экран под оверлеем', () => {
    const at = TRAINING_UI.indexOf('export function usePlannerStepScroll');
    expect(at).toBeGreaterThan(0);
    const body = TRAINING_UI.slice(at, TRAINING_UI.indexOf('\n}', at));
    expect(body).toContain("nav?.closest('.tp-cbody')");
    // Фолбэк на старый контейнер остаётся только как страховка.
    expect(body).toContain(".screen.training-screen");
    // Скроллер ищем ПОСЛЕ навигации (нужен её предок), а не из документа целиком.
    expect(body.indexOf("data-planner-step-nav")).toBeLessThan(body.indexOf("closest('.tp-cbody')"));
  });
});

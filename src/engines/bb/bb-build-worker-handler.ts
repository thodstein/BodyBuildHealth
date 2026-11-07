/**
 * bb-build-worker-handler.ts — чистая обработка задачи сборки плана.
 *
 * Вынесено из `bb-build.worker.ts`, чтобы логику можно было:
 *  • тестировать в jsdom без настоящего Worker;
 *  • переиспользовать в синхронном fallback.
 *
 * ЗАЧЕМ ВОРКЕР. Сборка BB-плана — сотни миллисекунд синхронной работы
 * (после итерации AP: ~200 мс generic 8 нед, ~420 мс enhanced 12 нед на
 * десктопе; на телефоне в 2–3 раза дольше). На главном потоке это
 * «замороженный» UI. Профиль показал, что вынос безопасен:
 *  • вход и выход — простые данные (проверено обходом плана: ни функций,
 *    ни классов, ни Date);
 *  • из хранилища движок читает ровно 4 ключа (замер):
 *    `he_bb_mev_calibration`, `he_hrv_log`, `he_srpe_sessions`,
 *    `he_workout_log_v2` — их снимок приходит с главного потока. Ключи,
 *    которых нет в снимке, собираются и возвращаются в `missingKeys`:
 *    клиент по ним понимает, что план надо пересчитать в основном потоке.
 * В воркере `localStorage` нет, поэтому на время сборки подставляется шим
 * со снимком (иначе личные ориентиры объёма / HRV / sRPE / журнал молча
 * выпали бы и план отличался от собранного в основном потоке).
 */
import { buildBBPlan } from './bb-builder.engine';
import { programToBBPlan } from './cycle-to-plan';
import { replanBBMesoFromFact } from './bb-replan.engine';
import { autodraftBBPlan } from '../manual-constructor/manual-draft.engine';
import { buildPrepCycle, buildPrepSeason } from './bb-prep-cycle.engine';
import { buildBBContestPrepPlan } from './bb-contest-prep.engine';

export type BBTaskRequest =
  | { kind: 'build'; input: any; pedAdapt?: any }
  | { kind: 'program'; program: any; opts: any }
  /** Пересборка остатка мезоцикла по факту («Пересобрать остаток» в ББ-авто). */
  | { kind: 'replan'; plan: any; sessions: any; opts: any }
  /** Авто-черновик плана (ручной конструктор, «Весь год в программу», сборка блока). */
  | { kind: 'autodraft'; opts: any }
  /** Подготовка к соревнованиям: один prep-цикл / сезон / contest-prep план. */
  | { kind: 'prep-cycle'; cfg: any; opts: any }
  | { kind: 'prep-season'; cfg: any; opts: any }
  | { kind: 'prep-plan'; cfg: any; opts: any }
  /** Прогрев: заставляет воркер загрузить модуль и каталог заранее. */
  | { kind: 'warmup' };

export interface BBTaskPayload {
  /** Снимок localStorage: ключ → значение (null = ключа нет). */
  storage?: Record<string, string | null>;
}

export type BBTaskResult =
  | {
      ok: true;
      plan: any;
      /**
       * Ключи localStorage, которые задача запросила, но их не было в снимке.
       * Клиент в этом случае план выбрасывает и пересчитывает синхронно
       * (в основном потоке хранилище полное) — иначе воркер молча посчитал бы
       * план по другим данным, чем основной поток.
       */
      missingKeys?: string[];
    }
  | { ok: false; error: string };

function makeStorageShim(snapshot: Record<string, string | null>, onMissing?: (key: string) => void) {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(snapshot || {})) if (v != null) map.set(k, String(v));
  return {
    getItem: (k: string) => {
      if (!map.has(k)) {
        // Ключ в снимке (значение null) — значит, его просто нет в хранилище.
        if (!(k in (snapshot || {})) && onMissing) onMissing(k);
        return null;
      }
      return map.get(k)!;
    },
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
}

/**
 * Выполнить задачу со «снимком» localStorage вместо настоящего.
 * В воркере localStorage нет — шим просто появляется; в браузере/тестах
 * исходный объект восстанавливается в finally.
 */
export function withStorageSnapshot<T>(
  snapshot: Record<string, string | null>,
  fn: () => T,
  onMissing?: (key: string) => void,
): T {
  const g: any = globalThis;
  let previous: PropertyDescriptor | undefined;
  try {
    previous = Object.getOwnPropertyDescriptor(g, 'localStorage');
  } catch { previous = undefined; }
  let installed = false;
  try {
    Object.defineProperty(g, 'localStorage', {
      value: makeStorageShim(snapshot, onMissing),
      configurable: true,
      writable: true,
      enumerable: false,
    });
    installed = true;
  } catch {
    installed = false; // не смогли подменить — движок сработает на своём хранилище
  }
  try {
    return fn();
  } finally {
    if (installed) {
      try {
        if (previous) Object.defineProperty(g, 'localStorage', previous);
        else delete g.localStorage;
      } catch { /* ignore */ }
    }
  }
}

/** Собрать план по задаче (чистая функция, без postMessage). */
export function runBBTask(req: BBTaskRequest, payload: BBTaskPayload = {}): BBTaskResult {
  if (!req || req.kind === 'warmup') return { ok: true, plan: null, missingKeys: [] };
  const missing = new Set<string>();
  try {
    const plan = withStorageSnapshot(payload.storage || {}, () => {
      switch (req.kind) {
        case 'program':
          return programToBBPlan(req.program, req.opts);
        case 'replan':
          return replanBBMesoFromFact(req.plan, req.sessions, req.opts);
        case 'autodraft':
          return autodraftBBPlan(req.opts);
        case 'prep-cycle':
          return buildPrepCycle(req.cfg, req.opts);
        case 'prep-season':
          return buildPrepSeason(req.cfg, req.opts);
        case 'prep-plan':
          return buildBBContestPrepPlan(req.cfg, req.opts);
        case 'build':
        default:
          return buildBBPlan(req.input, req.pedAdapt);
      }
    }, (key) => { missing.add(key); });
    return { ok: true, plan, missingKeys: [...missing] };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

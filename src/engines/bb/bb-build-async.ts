/**
 * bb-build-async.ts — сборка BB-плана вне главного потока.
 *
 * ЗАЧЕМ. После итерации AP движок собирает план за ~200 мс (8 недель) —
 * ~420 мс (12 недель, enhanced) на десктопе; на телефоне это 0.5–1.5 с
 * синхронной работы, то есть «замороженный» интерфейс на каждое «Собрать».
 * Вынос в Worker убирает фриз полностью: главный поток только отправляет
 * вход и получает готовый план.
 *
 * ПОЧЕМУ ЭТО БЕЗОПАСНО (замер перед реализацией):
 *  • вход и выход — простые данные (обход готового плана: ни функций, ни
 *    классов, ни Date);
 *  • из хранилища движок читает ровно 4 ключа — их снимок уходит в воркер,
 *    поэтому план в воркере получается байт-в-байт таким же, как в основном
 *    потоке (это закреплено тестом). Если задача запросит ключ вне снимка,
 *    воркер сообщает его в `missingKeys`, а клиент пересчитывает всё в
 *    основном потоке — корректность не зависит от полноты списка.
 *
 * ЧЕРЕЗ ВОРКЕР ИДУТ ВСЕ «ДОЛГИЕ» СБОРКИ (замер AR): план из сплита и из
 * ПРО-программы/цикла, авто-черновик, пересборка остатка мезоцикла, prep-цикл
 * и сезон подготовки. Дешёвые обёртки (макроцикл поверх готового плана,
 * разворот шаблона цикла, contest-prep план) остаются синхронными: 0.1–3 мс.
 *
 * FALLBACK (обязателен): нет `Worker` (старый WebView, jsdom), ошибка
 * создания, DataCloneError, падение воркера или таймаут — считаем
 * синхронно в основном потоке. Пользователь никогда не остаётся без плана.
 */
import { buildBBPlan, type BBPlan } from './bb-builder.engine';
import { programToBBPlan } from './cycle-to-plan';
import { replanBBMesoFromFact, type ReplanBBResult } from './bb-replan.engine';
import { autodraftBBPlan } from '../manual-constructor/manual-draft.engine';
import { buildPrepCycle, buildPrepSeason } from './bb-prep-cycle.engine';
import type { PrepCycleResult, PrepSeasonResult } from './bb-prep-cycle.engine';
import { buildBBContestPrepPlan } from './bb-contest-prep.engine';
import type { BBTaskRequest } from './bb-build-worker-handler';

/**
 * Ключи localStorage, которые читает сборка плана (замер 2026-11-07:
 * перехват `getItem` за два прогона `buildBBPlan`). Если движок начнёт
 * читать новое хранилище — ключ обязан появиться здесь, иначе воркер даст
 * план, отличный от основного потока.
 */
export const BB_WORKER_STORAGE_KEYS = [
  'he_bb_mev_calibration',
  'he_hrv_log',
  'he_srpe_sessions',
  'he_workout_log_v2',
  // Prep/peak-задачи (buildPrepCycle/buildPrepSeason/buildBBContestPrepPlan)
  // читают эти ключи; без них каждый такой вызов уходил в sync-fallback.
  'he_bb_test_peak_weeks',
  'he_prep_posing_v1',
  'he_prep_show_checklist',
  'he_prep_peak_days_v1',
  'he_prep_emergency_v1',
  'he_prep_labs_v1',
  'he_prep_week_checkins_v1',
  'he_prep_postshow_v1',
  'he_wearable_daily',
  'he_bb_lvp_profile',
] as const;

const DEFAULT_TIMEOUT_MS = 30000;

interface PendingEntry {
  req: BBTaskRequest;
  resolve: (plan: any) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

let worker: Worker | null = null;
let workerUnavailable = false;
let seq = 0;
const pending = new Map<number, PendingEntry>();

function readStorageSnapshot(): Record<string, string | null> {
  const snapshot: Record<string, string | null> = {};
  let ls: Storage | null = null;
  try {
    ls = typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    ls = null; // приватный режим / заблокированное хранилище
  }
  for (const key of BB_WORKER_STORAGE_KEYS) {
    try {
      snapshot[key] = ls ? ls.getItem(key) : null;
    } catch {
      snapshot[key] = null;
    }
  }
  return snapshot;
}

/** Синхронная сборка — общий путь для fallback (всё в одном месте с воркером). */
function runSync(req: BBTaskRequest): any {
  switch (req.kind) {
    case 'warmup':
      return null;
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
}

let missingWarned = false;
/** Один раз в консоль: задача запросила хранилище, которого нет в снимке воркера. */
function warnMissingStorage(keys: string[]): void {
  if (missingWarned) return;
  missingWarned = true;
  try {
    console.warn(
      '[bb-build-async] сборка запросила ключи хранилища вне снимка воркера, '
      + 'считаем в основном потоке: ' + keys.join(', '),
    );
  } catch { /* ignore */ }
}

function failAll(reason: string): void {
  const items = Array.from(pending.entries());
  pending.clear();
  for (const [, entry] of items) {
    if (entry.timer) clearTimeout(entry.timer);
    // Падение воркера не должно ломать UX — считаем в основном потоке.
    try {
      entry.resolve(runSync(entry.req));
    } catch (e: any) {
      entry.reject(e instanceof Error ? e : new Error(String(e?.message || e || reason)));
    }
  }
}

function getWorker(): Worker | null {
  if (worker) return worker;
  if (workerUnavailable) return null;
  try {
    if (typeof Worker === 'undefined') {
      workerUnavailable = true;
      return null;
    }
    const created = new Worker(new URL('./bb-build.worker.ts', import.meta.url), { type: 'module' });
    created.onmessage = (event: MessageEvent) => {
      const data = event.data || {};
      const entry = pending.get(data.id);
      if (!entry) return;
      pending.delete(data.id);
      if (entry.timer) clearTimeout(entry.timer);
      const settleFromMainThread = () => {
        try {
          entry.resolve(runSync(entry.req));
        } catch (e: any) {
          entry.reject(e instanceof Error ? e : new Error(String(e?.message || e)));
        }
      };
      if (data.ok) {
        // Воркер запросил ключ хранилища, которого нет в снимке. Молча принять
        // такой план нельзя: он посчитан по другим данным, чем на главном
        // потоке. Считаем заново здесь — там хранилище полное.
        const missing: string[] = Array.isArray(data.missingKeys) ? data.missingKeys : [];
        if (missing.length === 0) {
          entry.resolve(data.plan);
          return;
        }
        warnMissingStorage(missing);
        settleFromMainThread();
        return;
      }
      // Воркер не смог собрать (или не смог склонировать) — честный fallback.
      settleFromMainThread();
    };
    created.onerror = () => {
      workerUnavailable = true;
      try { created.terminate(); } catch { /* ignore */ }
      if (worker === created) worker = null;
      failAll('worker-error');
    };
    created.onmessageerror = () => {
      workerUnavailable = true;
      try { created.terminate(); } catch { /* ignore */ }
      if (worker === created) worker = null;
      failAll('worker-message-error');
    };
    worker = created;
    return created;
  } catch {
    workerUnavailable = true;
    return null;
  }
}

/** Доступен ли фоновый воркер (для тестов и диагностики). */
export function isBBWorkerAvailable(): boolean {
  return !!getWorker();
}

/**
 * Прогреть воркер заранее (модуль + каталог грузятся один раз).
 * Вызывать из `useEffect` на экране конструктора — тогда первое «Собрать»
 * не платит за запуск воркера. Запуск откладывается до простоя, чтобы
 * мегабайтный бандл воркера не конкурировал с первым кадром экрана.
 */
export function prewarmBBWorker(): void {
  const warm = () => {
    const w = getWorker();
    if (!w) return;
    try {
      w.postMessage({ id: ++seq, kind: 'warmup' });
    } catch { /* ignore */ }
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(warm, { timeout: 2000 });
  else setTimeout(warm, 300);
}

/** Общая отправка задачи в воркер с fallback на синхронную сборку. */
function submit<T = BBPlan>(req: BBTaskRequest, timeoutMs: number): Promise<T> {
  const w = getWorker();
  if (!w) {
    try {
      return Promise.resolve(runSync(req) as T);
    } catch (e: any) {
      return Promise.reject(e instanceof Error ? e : new Error(String(e?.message || e)));
    }
  }

  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    const fallback = () => {
      try {
        resolve(runSync(req) as T);
      } catch (e: any) {
        reject(e instanceof Error ? e : new Error(String(e?.message || e)));
      }
    };
    const timer = setTimeout(() => {
      pending.delete(id);
      // Воркер молчит дольше таймаута — не держим пользователя в вечном спиннере.
      fallback();
    }, timeoutMs);
    pending.set(id, { req, resolve: resolve as (p: any) => void, reject, timer });
    try {
      w.postMessage({ ...req, id, storage: readStorageSnapshot() });
    } catch {
      // DataCloneError и подобное — вход не клонируется, собираем на месте.
      pending.delete(id);
      clearTimeout(timer);
      fallback();
    }
  });
}

/** Собрать BB-план: в воркере, с синхронным fallback. */
export async function buildBBPlanAsync(
  input: any,
  pedAdapt?: any,
  options: { timeoutMs?: number } = {},
): Promise<BBPlan> {
  return submit({ kind: 'build', input, pedAdapt }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}

/** Собрать план из FullProgram (путь «ПРО-цикл/программа») вне главного потока. */
export async function programToBBPlanAsync(
  program: any,
  opts: any,
  options: { timeoutMs?: number } = {},
): Promise<BBPlan> {
  return submit({ kind: 'program', program, opts }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}

/** Пересобрать остаток мезоцикла по факту («Пересобрать остаток», ~190 мс). */
/** Пересобрать остаток мезоцикла по факту («Пересобрать остаток», ~190 мс). */
export async function replanBBMesoAsync(
  plan: any,
  sessions: any,
  opts: any,
  options: { timeoutMs?: number } = {},
): Promise<ReplanBBResult | null> {
  return submit<ReplanBBResult | null>({ kind: 'replan', plan, sessions, opts }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}

/** Авто-черновик плана (ручной конструктор, годовой план, сборка блока, ~240 мс). */
export async function autodraftBBPlanAsync(
  opts: any,
  options: { timeoutMs?: number } = {},
): Promise<BBPlan> {
  return submit({ kind: 'autodraft', opts }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}

/** Prep-цикл подготовки к соревнованиям (~350 мс). */
export async function buildPrepCycleAsync(
  cfg: any,
  opts: any = {},
  options: { timeoutMs?: number } = {},
): Promise<PrepCycleResult> {
  return submit<PrepCycleResult>({ kind: 'prep-cycle', cfg, opts }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}

/** Сезон подготовки (N стартов × prep-цикл — самый дорогой экран препа). */
export async function buildPrepSeasonAsync(
  cfg: any,
  opts: any = {},
  options: { timeoutMs?: number } = {},
): Promise<PrepSeasonResult> {
  return submit<PrepSeasonResult>({ kind: 'prep-season', cfg, opts }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}

/** Contest-prep план (дёшево — ~0.1 мс; вынесен для единообразия вызовов). */
export async function buildContestPrepPlanAsync(
  cfg: any,
  opts: any = {},
  options: { timeoutMs?: number } = {},
): Promise<any> {
  return submit({ kind: 'prep-plan', cfg, opts }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}

/** Только для тестов: сбросить состояние клиента (воркер, очередь). */
export function __resetBBWorkerClient(): void {
  for (const [, entry] of pending) if (entry.timer) clearTimeout(entry.timer);
  pending.clear();
  if (worker) {
    try { worker.terminate(); } catch { /* ignore */ }
  }
  worker = null;
  workerUnavailable = false;
  seq = 0;
}

/**
 * bb-build-worker.test.ts — контракт выноса сборки BB-плана в воркер.
 *
 * Главный риск выноса: в воркере нет `localStorage`, а движок читает из него
 * личные ориентиры объёма (`he_bb_mev_calibration`), HRV, sRPE и журнал
 * тренировок. Без передачи снимка план в воркере молча отличался бы от плана
 * в основном потоке. Здесь три вещи держатся под замком:
 *  1. набор ключей хранилища (ратчет: новый ключ без обновления
 *     `BB_WORKER_STORAGE_KEYS` → красный тест);
 *  2. `runBBTask` подставляет снимок на время сборки и возвращает план,
 *     идентичный синхронной сборке;
 *  3. клиент всегда отдаёт план — и через воркер, и при любом сбое
 *     (нет Worker, DataCloneError, падение воркера).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { runBBTask, withStorageSnapshot } from '../bb-build-worker-handler';
import {
  BB_WORKER_STORAGE_KEYS,
  __resetBBWorkerClient,
  buildBBPlanAsync,
  isBBWorkerAvailable,
} from '../bb-build-async';

const INPUT: any = { patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4 };
const INPUT_2: any = { patternId: 'ppl_6', level: 'advanced', goal: 'hypertrophy', weeks: 5, trainingYears: 6 };

const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const hadWorker = 'Worker' in globalThis;
const originalWorker = (globalThis as any).Worker;

function restoreLocalStorage() {
  try {
    if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
    else delete (globalThis as any).localStorage;
  } catch { /* ignore */ }
}

function installLocalStorageShim(): Set<string> {
  const seen = new Set<string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => { seen.add(k); return null; },
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    },
    configurable: true,
    writable: true,
  });
  return seen;
}

afterEach(() => {
  __resetBBWorkerClient();
  restoreLocalStorage();
  if (hadWorker) (globalThis as any).Worker = originalWorker;
  else delete (globalThis as any).Worker;
});

describe('BB build worker — контракт', () => {
  it('ратчет: сборка читает ровно ключи BB_WORKER_STORAGE_KEYS', () => {
    const seen = installLocalStorageShim();
    buildBBPlan(INPUT);
    buildBBPlan(INPUT_2);
    const actual = [...seen].sort();
    // Если тест упал: движок начал читать новое хранилище. Добавьте ключ в
    // BB_WORKER_STORAGE_KEYS — иначе план в воркере разойдётся с основным потоком.
    // Снимок — надмножество: prep/peak-задачи читают свои ключи, и они должны
    // пересылаться без sync-fallback.
    expect(actual.every(key => BB_WORKER_STORAGE_KEYS.includes(key as any))).toBe(true);
    expect(BB_WORKER_STORAGE_KEYS).toEqual(expect.arrayContaining(actual));
  });

  it('withStorageSnapshot подставляет снимок и восстанавливает хранилище', () => {
    const before = localStorage;
    const value = withStorageSnapshot({ demo_key: '42' }, () => {
      expect(localStorage.getItem('demo_key')).toBe('42');
      expect(localStorage.getItem('missing')).toBeNull();
      return 'ok';
    });
    expect(value).toBe('ok');
    expect(localStorage).toBe(before);
  });

  it('runBBTask отдаёт план, идентичный синхронной сборке, и не меняет хранилище', () => {
    const before = localStorage;
    const expected = buildBBPlan(INPUT);
    const result = runBBTask({ kind: 'build', input: INPUT }, { storage: {} });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan).toEqual(expected);
    expect(localStorage).toBe(before);
  });

  it('прогрев и пустая задача не роняют обработчик', () => {
    expect(runBBTask({ kind: 'warmup' })).toEqual({ ok: true, plan: null, missingKeys: [] });
    expect(runBBTask(null as any)).toEqual({ ok: true, plan: null, missingKeys: [] });
  });

  it('ошибка внутри сборки не бросается наружу, а возвращается как результат', () => {
    const result = runBBTask({ kind: 'build', input: null });
    expect(result.ok).toBe(false);
  });

  /**
   * Все «долгие» пути UI идут через тот же воркер (каждый строит полный план:
   * пересборка остатка ~190 мс, авто-черновик ~240 мс, prep-цикл ~350 мс).
   * Держим под замком две вещи: результат — простые данные (клонируются
   * postMessage) и задача не запрашивает хранилище вне снимка.
   */
  const SNAPSHOT: Record<string, string | null> = Object.fromEntries(BB_WORKER_STORAGE_KEYS.map((k) => [k, null]));
  const LONG_INPUT: any = { patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 12 };
  const PREP_CFG: any = {
    category: 'mens_physique', sex: 'male', accentMuscles: ['shoulders', 'back'],
    minimalMuscles: ['quads', 'arms'], weeks: 12, taperWeeks: 3, showDate: '2027-03-01',
    level: 'intermediate', trainingYears: 4, enhanced: false, weightKg: 82, experienceLevel: 'intermediate',
  };

  const TASKS: Array<[string, () => any]> = [
    ['replan', () => ({ plan: buildBBPlan(LONG_INPUT), sessions: [], opts: { currentWeek: 4 } })],
    ['autodraft', () => ({ opts: { level: 'intermediate', goal: 'hypertrophy', daysPerWeek: 4, weeks: 12, splitPattern: 'upper_lower_4', equipment: [], weakPoints: [], trainingFocus: 'hypertrophy' } })],
    ['prep-cycle', () => ({ cfg: PREP_CFG, opts: {} })],
  ];

  for (const [kind, make] of TASKS) {
    it(`задача «${kind}» считается в воркере и возвращает клонируемые данные`, () => {
      const result = runBBTask({ kind, ...make() } as any, { storage: SNAPSHOT });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.plan).toBeTruthy();
      expect(result.missingKeys).toEqual([]);
      // postMessage требует клонируемых данных — иначе воркер молча уйдёт в fallback.
      expect(() => structuredClone(result.plan)).not.toThrow();
    });
  }

  it('задача, запросившая ключ вне снимка, сообщает его (клиент пересчитает в основном потоке)', () => {
    const result = runBBTask({ kind: 'build', input: INPUT }, { storage: {} });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Пустой снимок = «ничего не объявлено»: движку нечего отдать, это видно клиенту.
    expect(result.missingKeys?.length).toBeGreaterThan(0);
  });
});

describe('BB build worker — клиент и fallback', () => {
  it('без Worker (jsdom) считает синхронно и отдаёт тот же план', async () => {
    delete (globalThis as any).Worker;
    __resetBBWorkerClient();
    expect(isBBWorkerAvailable()).toBe(false);
    const plan = await buildBBPlanAsync(INPUT);
    expect(plan).toEqual(buildBBPlan(INPUT));
  });

  it('через воркер: план приходит ответом, снимок хранилища отправляется', async () => {
    const sent: any[] = [];
    class FakeWorker {
      onmessage: ((e: any) => void) | null = null;
      onerror: ((e: any) => void) | null = null;
      onmessageerror: ((e: any) => void) | null = null;
      constructor(_url: URL, _opts?: any) {}
      postMessage(msg: any) {
        sent.push(msg);
        if (msg.kind === 'warmup') return;
        const plan = runBBTask(msg, { storage: msg.storage });
        // Асинхронно, как настоящий воркер.
        setTimeout(() => this.onmessage?.({ data: { id: msg.id, ...plan } }), 0);
      }
      terminate() {}
    }
    (globalThis as any).Worker = FakeWorker;
    __resetBBWorkerClient();
    localStorage.setItem('he_bb_mev_calibration', '{"x":1}');

    const plan = await buildBBPlanAsync(INPUT);
    expect(plan).toEqual(buildBBPlan(INPUT));

    const buildMsg = sent.find((m) => m.kind === 'build');
    expect(buildMsg).toBeTruthy();
    expect(Object.keys(buildMsg.storage).sort()).toEqual([...BB_WORKER_STORAGE_KEYS].sort());
    expect(buildMsg.storage.he_bb_mev_calibration).toBe('{"x":1}');
  });

  it('DataCloneError при отправке — план считается в основном потоке', async () => {
    class ThrowingWorker {
      onmessage: ((e: any) => void) | null = null;
      onerror: ((e: any) => void) | null = null;
      onmessageerror: ((e: any) => void) | null = null;
      constructor(_url: URL, _opts?: any) {}
      postMessage(_msg: any) { throw new DOMException('could not be cloned', 'DataCloneError'); }
      terminate() {}
    }
    (globalThis as any).Worker = ThrowingWorker;
    __resetBBWorkerClient();
    const plan = await buildBBPlanAsync(INPUT);
    expect(plan).toEqual(buildBBPlan(INPUT));
  });

  it('падение воркера — запрос всё равно завершается планом', async () => {
    class CrashingWorker {
      onmessage: ((e: any) => void) | null = null;
      onerror: ((e: any) => void) | null = null;
      onmessageerror: ((e: any) => void) | null = null;
      constructor(_url: URL, _opts?: any) {}
      postMessage(_msg: any) {
        setTimeout(() => this.onerror?.(new Error('boom')), 0);
      }
      terminate() {}
    }
    (globalThis as any).Worker = CrashingWorker;
    __resetBBWorkerClient();
    const plan = await buildBBPlanAsync(INPUT);
    expect(plan).toEqual(buildBBPlan(INPUT));
  });
});

/**
 * bb-build.worker.ts — воркер сборки BB-плана.
 *
 * Тонкая обвязка: принимает `{ id, kind, input|program+opts, storage }`,
 * отвечает `{ id, ok, plan | error }`. Вся логика — в
 * `bb-build-worker-handler.ts` (её можно тестировать без воркера).
 *
 * Подключение: `src/engines/bb/bb-build-async.ts`
 * (`new Worker(new URL('./bb-build.worker.ts', import.meta.url), { type: 'module' })`).
 */
import { runBBTask, type BBTaskPayload, type BBTaskRequest } from './bb-build-worker-handler';

type IncomingMessage = (BBTaskRequest & BBTaskPayload) & { id: number };

// `any` намеренно: файл компилируется и с lib.dom (tsc проекта), и с
// webworker (сборка Vite) — пересечение типов `self` там конфликтует.
const ctx: any = self as any;

ctx.onmessage = (event: MessageEvent<IncomingMessage>) => {
  const data = event.data;
  const id = data?.id;
  const result = runBBTask(data, { storage: data?.storage });
  try {
    ctx.postMessage({ id, ...result });
  } catch (e: any) {
    // Структурное клонирование не переварило план — честно сообщаем наверх,
    // клиент сделает синхронную сборку в основном потоке.
    ctx.postMessage({ id, ok: false, error: 'clone-failed: ' + String(e?.message || e) });
  }
};

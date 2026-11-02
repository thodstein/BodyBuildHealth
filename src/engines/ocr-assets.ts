// Centralized configuration for OCR/PDF worker assets.
// All resources are served from /tesseract and /pdfjs under the app origin
// (synced from node_modules by scripts/sync-ocr-assets.mjs), eliminating the
// CDN dependency that was breaking lab recognition when jsdelivr/cdnjs were
// unreachable. CDN paths are kept only as last-resort fallbacks.

import { isCapacitorNative } from '../core/app-platform';

const TESSERACT_VERSION = '7.0.0';
const TESSERACT_CORE_VERSION = '7.0.0';

// The app is built with `base: './'` and may be hosted below the domain root.
// Absolute `/tesseract` paths then point at the wrong location and break OCR.
function appAssetPath(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const relative = `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  // Telegram Mini Apps can be opened from a nested URL. Resolve the relative
  // asset against the actual document URL instead of the domain root.
  try { return new URL(relative, document.baseURI).href; } catch { return relative; }
}

export interface OcrAssetPaths {
  workerPath: string;
  corePath: string;
  /**
   * Каталог traineddata. `undefined` = НЕ ПЕРЕДАВАТЬ langPath в createWorker:
   * tesseract.js тогда строит URL на каждый язык сам
   * (`.../@tesseract.js-data/<lang>/4.0.0_best_int/<lang>.traineddata.gz`).
   *
   * Раньше для CDN сюда подставлялся корень пакета
   * `.../npm/@tesseract.js-data`, и воркер запрашивал
   * `.../@tesseract.js-data/rus.traineddata.gz` — такого файла НЕТ (пакет
   * разложен по `<lang>/<version>/`), фолбэк был 404-ным по построению.
   */
  langPath?: string;
  pdfjsWorkerSrc: string;
}

/**
 * Returns asset paths for Tesseract.js createWorker and pdfjs worker.
 * Uses local /tesseract and /pdfjs paths first; falls back to CDN only if
 * the caller explicitly requests it via `prefer: 'cdn'` (e.g. for diagnostics).
 */
export function getOcrAssetPaths(prefer: 'local' | 'cdn' = 'local'): OcrAssetPaths {
  if (prefer === 'cdn') {
    return {
      workerPath: `https://cdn.jsdelivr.net/npm/tesseract.js@v${TESSERACT_VERSION}/dist/worker.min.js`,
      corePath: `https://cdn.jsdelivr.net/npm/tesseract.js-core@v${TESSERACT_CORE_VERSION}`,
      // БЕЗ langPath: единого каталога под все языки на jsdelivr нет, а
      // свой URL tesseract.js соберёт корректно для каждого языка.
      pdfjsWorkerSrc: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${getPdfjsVersionForCdn()}/pdf.worker.min.mjs`,
    };
  }
  const tesseractBase = appAssetPath('tesseract');
  const pdfjsBase = appAssetPath('pdfjs');
  return {
    workerPath: `${tesseractBase}/worker.min.js`,
    corePath: `${tesseractBase}/core`,
    langPath: `${tesseractBase}/lang`,
    pdfjsWorkerSrc: `${pdfjsBase}/pdf.worker.min.mjs`,
  };
}

// Lazily read pdfjs-dist version for CDN fallback only.
let _pdfjsVersionForCdn: string | undefined;
function getPdfjsVersionForCdn(): string {
  if (_pdfjsVersionForCdn) return _pdfjsVersionForCdn;
  // Hardcoded fallback matching the version pinned in package.json; the local
  // worker is always preferred so this only matters for the CDN fallback path.
  _pdfjsVersionForCdn = '6.0.227';
  return _pdfjsVersionForCdn;
}

/**
 * Configure pdfjs-dist to use the local worker. Must be called after
 * `import('pdfjs-dist')` and before any `getDocument`/`render` call.
 * Returns true if the local worker URL was set; false if we fell back to CDN.
 */
export function configurePdfjsWorker(pdfjsLib: any, prefer: 'local' | 'cdn' = 'local'): boolean {
  const paths = getOcrAssetPaths(prefer);
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = paths.pdfjsWorkerSrc;
    return prefer === 'local';
  } catch {
    return false;
  }
}

/**
 * Try a local HEAD fetch to verify the asset exists. Returns false on any
 * network/HTTP error so callers can fall back to CDN.
 */
export async function localAssetAvailable(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (head.ok) return true;
  } catch {
    // Some Telegram WebViews/proxies reject HEAD although GET works.
  }
  try {
    const get = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, cache: 'no-store' });
    return get.ok;
  } catch { return false; }
}

/**
 * Опции createWorker из резолвера. langPath передаётся ТОЛЬКО когда он
 * задан: для CDN его нет специально (см. OcrAssetPaths.langPath), и
 * tesseract.js достроит корректный URL на каждый язык сам.
 */
export function tesseractWorkerOptions(src: {
  workerPath: string;
  corePath: string;
  langPath?: string;
  gzip?: boolean;
}): { workerPath: string; corePath: string; langPath?: string; gzip?: boolean } {
  const opts: { workerPath: string; corePath: string; langPath?: string; gzip?: boolean } = {
    workerPath: src.workerPath,
    corePath: src.corePath,
  };
  if (src.langPath) opts.langPath = src.langPath;
  if (typeof src.gzip === 'boolean') opts.gzip = src.gzip;
  return opts;
}

/**
 * Resolve Tesseract worker options with automatic CDN fallback.
 * If the local worker.min.js is unreachable (e.g. assets not synced),
 * we transparently fall back to the CDN so OCR still works.
 *
 * АПК-фикс Sep 2026: раньше проверялся ТОЛЬКО worker.min.js. При этом
 * *-lstm ядра (обязательные для OEM.LSTM_ONLY, см. sync-ocr-assets.mjs)
 * могли отсутствовать — резолвер возвращал 'local', а воркер падал уже
 * внутри с "Failed to load TesseractCore". Теперь пробуем и ядро, и
 * русский traineddata: любой провал → честный fallback на CDN.
 */
export async function resolveTesseractOptions(): Promise<{
  workerPath: string;
  corePath: string;
  langPath: string | undefined;
  source: 'local' | 'cdn';
  /** true — модели берутся как `*.traineddata.gz`, false — как `*.traineddata`. */
  gzip: boolean;
}> {
  const local = getOcrAssetPaths('local');
  const cdn = getOcrAssetPaths('cdn');
  // Capacitor bundles these files into the APK. Some Android WebViews reject
  // HEAD/Range probes even though the bundled assets are readable by Tesseract;
  // probing here would incorrectly switch to an unavailable CDN.
  // В APK/WebView ассеты лежат локально (file:// или capacitor://). Даже если
  // Capacitor-объект не распознался, протокол выдаёт нативное окружение —
  // пробовать сеть (CDN) в таком случае бессмысленно и ломает оффлайн-OCR.
  const isNativeLike = isCapacitorNative()
    || (typeof window !== 'undefined' && /^file:|^capacitor:|^ionic:/i.test(window.location?.protocol || ''));
  // Языковые модели. Важно: AAPT при упаковке APK РАСПАКОВЫВАЕТ `*.gz`,
  // поэтому внутри APK файл называется `rus.traineddata` без суффикса —
  // запрос `rus.traineddata.gz` даёт 404, воркер висит до таймаута и всё
  // распознавание падает с «движок OCR не запустился». Проверяем оба имени.
  const langProbe = await detectLocalLangAssets(local.langPath, ['rus', 'eng']);
  if (langProbe.kind === 'missing') {
    console.warn('[ocr-assets] local traineddata не найдены, используем CDN.');
    return { workerPath: cdn.workerPath, corePath: cdn.corePath, langPath: cdn.langPath, source: 'cdn', gzip: true };
  }
  if (isNativeLike) {
    return {
      workerPath: local.workerPath,
      corePath: local.corePath,
      langPath: local.langPath,
      source: 'local',
      gzip: langProbe.gzip,
    };
  }
  const workerOk = await localAssetAvailable(local.workerPath);
  if (workerOk) {
    // Ядро, которое getCore запросит первым на большинстве современных
    // телефонов (relaxed-SIMD + LSTM). Без него воркер падает уже внутри
    // с "Failed to load TesseractCore".
    const coreProbe = `${local.corePath.replace(/\/$/, '')}/tesseract-core-lstm.wasm.js`;
    const coreOk = await localAssetAvailable(coreProbe);
    if (coreOk) {
      return {
        workerPath: local.workerPath,
        corePath: local.corePath,
        langPath: local.langPath,
        source: 'local',
        gzip: langProbe.gzip,
      };
    }
    console.warn('[ocr-assets] local tesseract core incomplete, falling back to CDN.');
  } else {
    console.warn('[ocr-assets] local tesseract worker not reachable, falling back to CDN.');
  }
  return { workerPath: cdn.workerPath, corePath: cdn.corePath, langPath: cdn.langPath, source: 'cdn', gzip: true };
}

/** Статус одного URL ассета: HTTP-код либо «запрос не дошёл». */
interface AssetStatus {
  status: number | null;
  unreachable: boolean;
  contentType: string;
}

/**
 * Дешёвая проверка существования ассета: GET + сразу отменяем тело.
 * HEAD/Range в Capacitor WebView отвечают ошибкой даже на существующие
 * файлы, поэтому используем обычный GET (для локальных ассетов он бесплатный).
 */
async function probeAssetStatus(url: string): Promise<AssetStatus> {
  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    const contentType = res.headers?.get?.('content-type') || '';
    try { await res.body?.cancel(); } catch { /* ignore */ }
    return { status: res.status, unreachable: false, contentType };
  } catch {
    return { status: null, unreachable: true, contentType: '' };
  }
}

/** Ассет реально существует (SPA-фолбэк с index.html не считается). */
function assetPresent(s: AssetStatus): boolean {
  if (s.unreachable || s.status === null) return false;
  if (s.status < 200 || s.status >= 300) return false;
  return !/text\/html/i.test(s.contentType);
}

export interface OcrLangProbe {
  /** found — файлы есть; missing — сервер явно ответил 404; unknown — проверить нельзя. */
  kind: 'found' | 'missing' | 'unknown';
  /** true — модели лежат как `*.traineddata.gz`. */
  gzip: boolean;
  /** Языки, которые реально нашлись (могут быть не все). */
  langs: string[];
}

let cachedLangProbe: { key: string; value: OcrLangProbe } | null = null;

/** Сброс кэша проверки моделей (тесты, диагностика, повторная попытка). */
export function resetOcrLangProbeCache(): void {
  cachedLangProbe = null;
}

/**
 * Определить, в каком виде лежат языковые модели и какие языки доступны.
 *
 * Порядок важен: сначала ищем несжатые `*.traineddata` (так они лежат внутри
 * APK), затем `*.traineddata.gz` (так они лежат в dist/ и в OTA-бандле).
 * Если ни один запрос не дошёл (нет fetch / политика WebView), возвращаем
 * `unknown` — вызывающий код должен попробовать локальные ассеты как раньше,
 * а не объявлять их отсутствующими.
 */
export async function detectLocalLangAssets(
  langPath: string | undefined,
  want: string[],
): Promise<OcrLangProbe> {
  const base = (langPath || '').replace(/\/$/, '');
  if (!base || typeof fetch !== 'function') {
    return { kind: 'unknown', gzip: true, langs: want };
  }
  const key = `${base}|${want.join(',')}`;
  if (cachedLangProbe?.key === key) return cachedLangProbe.value;
  const remember = (value: OcrLangProbe): OcrLangProbe => {
    cachedLangProbe = { key, value };
    return value;
  };
  for (const gzip of [false, true]) {
    // Параллельно: иначе на медленном WebView проверка съедает лишние секунды.
    const statuses = await Promise.all(
      want.map((lang) => probeAssetStatus(`${base}/${lang}.traineddata${gzip ? '.gz' : ''}`)),
    );
    const found = want.filter((_lang, i) => assetPresent(statuses[i]));
    const unreachable = statuses.filter((s) => s.unreachable).length;
    if (found.length > 0) return remember({ kind: 'found', gzip, langs: found });
    // Ни один запрос не дошёл — это не «файла нет», а «не проверить».
    if (unreachable >= want.length) return remember({ kind: 'unknown', gzip: true, langs: want });
  }
  return remember({ kind: 'missing', gzip: true, langs: want });
}

/** Одна попытка поднять воркер tesseract. */
export interface OcrWorkerAttempt {
  /** Метка для диагностики/логов («local-direct», «local-blob», «cdn-blob»). */
  label: string;
  workerPath: string;
  corePath: string;
  langPath?: string;
  /** true — модели запрашиваются как `*.traineddata.gz`, false — без сжатия. */
  gzip: boolean;
  /** Языки, реально доступные в этой попытке (rus+eng или только rus). */
  langs: string[];
  source: 'local' | 'cdn';
  /** true — воркер создаётся из Blob (importScripts), false — напрямую по URL. */
  blobWorker: boolean;
}

/**
 * Упорядоченный список попыток запуска воркера.
 *
 * Порядок важен: локальные ассеты лежат в APK/dist и не требуют сети, поэтому
 * пробуем их ПЕРВЫМИ. CDN — только последняя попытка и только когда устройство
 * в сети: в офлайне он гарантированно даёт «Failed to fetch», который
 * пользователь видит как «нет соединения».
 *
 * Формат моделей определяется на месте (см. detectLocalLangAssets): в APK
 * AAPT распаковывает `*.gz`, поэтому там файлы лежат без суффикса и запрос
 * `rus.traineddata.gz` отдаёт 404 — именно это вешало OCR на 83с таймаута.
 *
 * В АПК перебираем два механизма создания воркера: Blob (штатный для
 * tesseract.js и не зависящий от того, как WebView отдаёт скрипт воркера по
 * абсолютному URL) и прямой URL.
 */
export async function tesseractWorkerAttempts(opts?: {
  nativeLike?: boolean;
  online?: boolean;
  langs?: string[];
}): Promise<OcrWorkerAttempt[]> {
  const nativeLike = opts?.nativeLike === true;
  const online = opts?.online !== false;
  const want = opts?.langs ?? ['rus', 'eng'];
  const local = getOcrAssetPaths('local');
  const cdn = getOcrAssetPaths('cdn');
  // В APK ядро выбираем явно (-lstm): SIMD-проба на старых WebView даёт
  // ложное срабатывание, после которого падает компиляция wasm.
  const nativeCore = (corePath: string) => `${corePath.replace(/\/$/, '')}/tesseract-core-lstm.wasm.js`;
  const langProbe = await detectLocalLangAssets(local.langPath, want);
  const list: OcrWorkerAttempt[] = [];
  // Если сервер ЯВНО ответил 404 на все варианты — локальных моделей нет,
  // тратить 80с на заведомо провальный запуск воркера незачем.
  if (langProbe.kind !== 'missing') {
    const shared = {
      langPath: local.langPath,
      gzip: langProbe.gzip,
      langs: langProbe.langs.length > 0 ? langProbe.langs : want,
      source: 'local' as const,
    };
    const pushLocal = (label: string, blobWorker: boolean) => {
      list.push({
        label,
        workerPath: local.workerPath,
        corePath: nativeLike ? nativeCore(local.corePath) : local.corePath,
        ...shared,
        blobWorker,
      });
    };
    if (nativeLike) {
      pushLocal('local-blob', true);
      pushLocal('local-direct', false);
    } else {
      pushLocal('local-blob', true);
    }
  }
  if (online) {
    list.push({
      label: 'cdn-blob',
      workerPath: cdn.workerPath,
      corePath: cdn.corePath,
      langPath: cdn.langPath,
      // jsdelivr отдаёт модели сжатыми.
      gzip: true,
      langs: want,
      source: 'cdn',
      blobWorker: true,
    });
  }
  return list;
}

/** Результат проверки одного ассета OCR (для экрана диагностики). */
export interface OcrAssetProbe {
  url: string;
  ok: boolean;
  status: number | null;
  error?: string;
}

/** Проверить, читаются ли ассеты OCR по текущим путям. Никогда не бросает. */
export async function probeOcrAssets(): Promise<OcrAssetProbe[]> {
  const local = getOcrAssetPaths('local');
  const base = local.corePath.replace(/\/$/, '');
  const lang = (local.langPath || '').replace(/\/$/, '');
  const urls = [
    local.workerPath,
    `${base}/tesseract-core-lstm.wasm.js`,
    `${base}/tesseract-core-lstm.wasm`,
    // Оба имени: в APK модели распакованы (без .gz), в dist/OTA — сжатые.
    lang ? `${lang}/rus.traineddata` : '',
    lang ? `${lang}/rus.traineddata.gz` : '',
    lang ? `${lang}/eng.traineddata` : '',
    lang ? `${lang}/eng.traineddata.gz` : '',
  ].filter(Boolean);
  const out: OcrAssetProbe[] = [];
  for (const url of urls) {
    const st = await probeAssetStatus(url);
    if (st.unreachable) {
      out.push({ url, ok: false, status: null, error: 'запрос не дошёл' });
    } else {
      out.push({ url, ok: assetPresent(st), status: st.status });
    }
  }
  return out;
}

/**
 * Resolve pdfjs worker src with automatic CDN fallback.
 */
export async function resolvePdfjsWorkerSrc(): Promise<{ workerSrc: string; source: 'local' | 'cdn' }> {
  const local = getOcrAssetPaths('local');
  // PDF parsing in the APK uses the main thread because Capacitor WebViews
  // frequently reject module workers and external CDN URLs.
  const isNativeLike = isCapacitorNative()
    || (typeof window !== 'undefined' && /^file:|^capacitor:|^ionic:/i.test(window.location?.protocol || ''));
  if (isNativeLike) return { workerSrc: local.pdfjsWorkerSrc, source: 'local' };
  const localOk = await localAssetAvailable(local.pdfjsWorkerSrc);
  if (localOk) {
    return { workerSrc: local.pdfjsWorkerSrc, source: 'local' };
  }
  console.warn('[ocr-assets] local pdfjs worker not reachable, falling back to CDN.');
  const cdn = getOcrAssetPaths('cdn');
  return { workerSrc: cdn.pdfjsWorkerSrc, source: 'cdn' };
}

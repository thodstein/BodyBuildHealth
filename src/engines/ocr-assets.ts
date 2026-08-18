// Centralized configuration for OCR/PDF worker assets.
// All resources are served from /tesseract and /pdfjs under the app origin
// (synced from node_modules by scripts/sync-ocr-assets.mjs), eliminating the
// CDN dependency that was breaking lab recognition when jsdelivr/cdnjs were
// unreachable. CDN paths are kept only as last-resort fallbacks.

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
  langPath: string;
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
      langPath: `https://cdn.jsdelivr.net/npm/@tesseract.js-data`,
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
 * Resolve Tesseract worker options with automatic CDN fallback.
 * If the local worker.min.js is unreachable (e.g. assets not synced),
 * we transparently fall back to the CDN so OCR still works.
 */
export async function resolveTesseractOptions(): Promise<{
  workerPath: string;
  corePath: string;
  langPath: string;
  source: 'local' | 'cdn';
}> {
  const local = getOcrAssetPaths('local');
  const localOk = await localAssetAvailable(local.workerPath);
  if (localOk) {
    return { workerPath: local.workerPath, corePath: local.corePath, langPath: local.langPath, source: 'local' };
  }
  console.warn('[ocr-assets] local tesseract worker not reachable, falling back to CDN.');
  const cdn = getOcrAssetPaths('cdn');
  return { workerPath: cdn.workerPath, corePath: cdn.corePath, langPath: cdn.langPath, source: 'cdn' };
}

/**
 * Resolve pdfjs worker src with automatic CDN fallback.
 */
export async function resolvePdfjsWorkerSrc(): Promise<{ workerSrc: string; source: 'local' | 'cdn' }> {
  const local = getOcrAssetPaths('local');
  const localOk = await localAssetAvailable(local.pdfjsWorkerSrc);
  if (localOk) {
    return { workerSrc: local.pdfjsWorkerSrc, source: 'local' };
  }
  console.warn('[ocr-assets] local pdfjs worker not reachable, falling back to CDN.');
  const cdn = getOcrAssetPaths('cdn');
  return { workerSrc: cdn.pdfjsWorkerSrc, source: 'cdn' };
}

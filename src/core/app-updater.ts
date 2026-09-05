/**
 * app-updater.ts — самообновление APK без сторов (GitHub Releases как сервер).
 *
 * Контракт:
 * - чистые функции (parse/compare/pick) — детерминированы, покрыты тестами;
 * - сеть изолирована в fetchLatestRelease (таймаут, любой сбой = null, не throw);
 * - состояние (lastCheck/skippedVersion) — localStorage `he_app_update_v1`;
 * - вне native не вызывается вообще (гейт в AppUpdateBanner).
 *
 * Источник по умолчанию — latest-релиз репозитория; переопределяется
 * переменной сборки VITE_APP_UPDATE_URL (например, JSON на своём хостинге).
 * Ожидаемый формат ответа: GitHub Release ({ tag_name, assets[], body })
 * либо плоский { version, apkUrl, notes? }.
 */

export interface UpdateAsset {
  name?: string;
  browser_download_url?: string;
}

export interface UpdateRelease {
  /** Версия без префикса v: "3.0.1". */
  version: string;
  /** Прямая ссылка на .apk (полное обновление). */
  apkUrl: string;
  /** Прямая ссылка на web-bundle .zip (быстрое OTA) или null. */
  bundleUrl: string | null;
  notes: string;
}

export const UPDATE_STATE_KEY = 'he_app_update_v1';
/** Пауза между авто-проверками: сутки. */
export const UPDATE_CHECK_INTERVAL_MS = 24 * 3600 * 1000;

const DEFAULT_ENDPOINT =
  'https://api.github.com/repos/thodstein/BodyBuildHealth/releases/latest';

/** URL фида обновлений: env-оверрайд → GitHub Releases по умолчанию. */
export function updateEndpoint(): string {
  try {
    const env = (
      import.meta as unknown as { env?: Record<string, string> }
    )?.env;
    if (env?.VITE_APP_UPDATE_URL) return env.VITE_APP_UPDATE_URL;
  } catch {
    /* ignore */
  }
  return DEFAULT_ENDPOINT;
}

/** "v3.0.1 " → "3.0.1". */
export function parseVersionTag(tag: string): string {
  return (tag || '').trim().replace(/^[vV]/, '');
}

/** Числовое сравнение версий: 3.0.10 > 3.0.9 (строковое дало бы наоборот). */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = parseVersionTag(a).split('.');
  const pb = parseVersionTag(b).split('.');
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = Number(pa[i]);
    const y = Number(pb[i]);
    const nx = Number.isFinite(x) ? x : 0;
    const ny = Number.isFinite(y) ? y : 0;
    if (nx > ny) return 1;
    if (nx < ny) return -1;
  }
  return 0;
}

/** True, когда latest строго новее installed. Пустые входы = false. */
export function isNewerVersion(latest: string, installed: string): boolean {
  if (!latest || !installed) return false;
  if (!parseVersionTag(latest) || !parseVersionTag(installed)) return false;
  return compareVersions(latest, installed) === 1;
}

/**
 * Выбор APK из ассетов релиза: приоритет подписанному app-release.apk,
 * иначе первый .apk. Не-APK и записи без URL отбрасываются.
 */
export function pickApkAssetUrl(assets: unknown): string | null {
  if (!Array.isArray(assets)) return null;
  const apks = (assets as UpdateAsset[]).filter(
    (a) =>
      a &&
      typeof a.browser_download_url === 'string' &&
      a.browser_download_url.length > 0 &&
      /\.apk($|\?)/i.test(a.name || ''),
  );
  if (apks.length === 0) return null;
  const signed = apks.find((a) => /release/i.test(a.name || ''));
  return (signed ?? apks[0]).browser_download_url as string;
}

/**
 * Выбор web-бандла (.zip с dist) из ассетов релиза для OTA.
 * Имя канона: web-bundle-<tag>.zip (кладёт CI, см. android-apk.yml).
 */
export function pickBundleAssetUrl(assets: unknown): string | null {
  if (!Array.isArray(assets)) return null;
  const found = (assets as UpdateAsset[]).find(
    (a) =>
      a &&
      typeof a.browser_download_url === 'string' &&
      a.browser_download_url.length > 0 &&
      /\.zip($|\?)/i.test(a.name || '') &&
      /bundle/i.test(a.name || ''),
  );
  return found?.browser_download_url ?? null;
}

type FetchFn = (
  input: string,
  init?: Record<string, unknown>,
) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

/** latest-релиз фида. Любая проблема сети/формы = null (баннера не будет). */
export async function fetchLatestRelease(
  fetchFn?: FetchFn,
  timeoutMs = 12000,
): Promise<UpdateRelease | null> {
  try {
    const impl: FetchFn =
      fetchFn ??
      ((globalThis as unknown as { fetch?: FetchFn }).fetch as FetchFn);
    if (typeof impl !== 'function') return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      try {
        ctrl.abort();
      } catch {
        /* ignore */
      }
    }, timeoutMs);
    try {
      const res = await impl(updateEndpoint(), {
        signal: ctrl.signal,
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res || !res.ok) return null;
      const json = (await res.json()) as Record<string, unknown>;
      const version = parseVersionTag(String(json?.tag_name ?? json?.version ?? ''));
      const apkUrl =
        typeof json?.apkUrl === 'string' && json.apkUrl
          ? (json.apkUrl as string)
          : pickApkAssetUrl(json?.assets);
      if (!version || !apkUrl) return null;
      const notes = String(json?.body ?? json?.notes ?? '').slice(0, 2000);
      return { version, apkUrl, bundleUrl: pickBundleAssetUrl(json?.assets), notes };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

export interface UpdateCheckState {
  lastCheck: number;
  skippedVersion: string;
}

/** Состояние проверок (терпит битый storage — отдаёт дефолт). */
export function readUpdateState(): UpdateCheckState {
  const fallback: UpdateCheckState = { lastCheck: 0, skippedVersion: '' };
  try {
    const raw = localStorage.getItem(UPDATE_STATE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<UpdateCheckState>;
    return {
      lastCheck:
        typeof parsed.lastCheck === 'number' && Number.isFinite(parsed.lastCheck)
          ? parsed.lastCheck
          : 0,
      skippedVersion:
        typeof parsed.skippedVersion === 'string' ? parsed.skippedVersion : '',
    };
  } catch {
    return fallback;
  }
}

/** Частичное обновление состояния (merge, не затирает соседние поля). */
export function writeUpdateState(patch: Partial<UpdateCheckState>): void {
  try {
    const next = { ...readUpdateState(), ...patch };
    localStorage.setItem(UPDATE_STATE_KEY, JSON.stringify(next));
  } catch {
    /* quota/SSR — молча */
  }
}

/** True, когда с прошлой проверки прошло ≥ суток (или её не было). */
export function shouldCheckNow(now = Date.now()): boolean {
  const { lastCheck } = readUpdateState();
  if (!lastCheck) return true;
  return now - lastCheck >= UPDATE_CHECK_INTERVAL_MS;
}

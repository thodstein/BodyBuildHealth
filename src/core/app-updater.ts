/**
 * app-updater.ts — самообновление APK без сторов (GitHub Releases как сервер).
 *
 * Контракт:
 * - чистые функции (parse/compare/pick) — детерминированы, покрыты тестами;
 * - сеть изолирована в fetchLatestRelease (таймаут, любой сбой = null, не throw);
 * - состояние (lastCheck/skippedVersion) — localStorage `he_app_update_v1`;
 * - вне native не вызывается вообще (гейт в AppUpdateBanner).
 *
 * Источник по умолчанию — latest-релиз репозитория, приоритет:
 * api.github.com → зеркало ungh.cc (тот же релиз, другие имена полей);
 * переопределяется переменной сборки VITE_APP_UPDATE_URL (например, JSON на
 * своём хостинге, тогда источник один).
 * Ожидаемый формат ответа: GitHub Release ({ tag_name, assets[], body }),
 * ответ ungh.cc ({ release: { tag, assets[].downloadUrl } }) либо плоский
 * { version, apkUrl, notes? }.
 */

export interface UpdateAsset {
  name?: string;
  browser_download_url?: string;
  /** ungh.cc отдаёт то же поле под этим именем. */
  downloadUrl?: string;
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

const REPO = 'thodstein/BodyBuildHealth';
/**
 * Фид обновлений — несколько независимых источников. api.github.com отдаёт
 * 60 запросов/час на IP и в части сетей недоступен вовсе; ungh.cc — публичное
 * CORS-зеркало релизов GitHub без лимитов. Порядок = приоритет.
 */
const DEFAULT_ENDPOINTS = [
  `https://api.github.com/repos/${REPO}/releases/latest`,
  `https://ungh.cc/repos/${REPO}/releases/latest`,
];

/** URL фидов обновлений: env-оверрайд → GitHub API → зеркало. */
export function updateEndpoints(): string[] {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> })?.env;
    if (env?.VITE_APP_UPDATE_URL) return [env.VITE_APP_UPDATE_URL];
  } catch {
    /* ignore */
  }
  return DEFAULT_ENDPOINTS;
}

/** Основной URL фида (совместимость с прежним API модуля). */
export function updateEndpoint(): string {
  return updateEndpoints()[0];
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
 * URL ассета в обеих формах: GitHub REST кладёт browser_download_url,
 * зеркало ungh.cc — downloadUrl (те же байты, тот же адрес).
 */
export function assetUrl(asset: UpdateAsset): string {
  if (!asset || typeof asset !== 'object') return '';
  const url = asset.browser_download_url || asset.downloadUrl || '';
  return typeof url === 'string' ? url : '';
}

/**
 * Выбор APK из ассетов релиза: приоритет подписанному app-release.apk,
 * иначе первый .apk. Не-APK и записи без URL отбрасываются.
 */
export function pickApkAssetUrl(assets: unknown): string | null {
  if (!Array.isArray(assets)) return null;
  const apks = (assets as UpdateAsset[]).filter(
    (a) => a && /\.apk($|\?)/i.test(a.name || '') && assetUrl(a).length > 0,
  );
  if (apks.length === 0) return null;
  const signed = apks.find((a) => /release/i.test(a.name || ''));
  return assetUrl(signed ?? apks[0]);
}

/**
 * Выбор web-бандла (.zip с dist) из ассетов релиза для OTA.
 * Имя канона: web-bundle-<tag>.zip (кладёт CI, см. android-apk.yml).
 */
export function pickBundleAssetUrl(assets: unknown): string | null {
  if (!Array.isArray(assets)) return null;
  const found = (assets as UpdateAsset[]).find(
    (a) => a && /\.zip($|\?)/i.test(a.name || '') && /bundle/i.test(a.name || '') && assetUrl(a).length > 0,
  );
  return found ? assetUrl(found) : null;
}

type FetchFn = (
  input: string,
  init?: Record<string, unknown>,
) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

/**
 * Тело ответа → UpdateRelease. Понимает все формы фида: GitHub REST
 * (`tag_name` + `assets[].browser_download_url`), зеркало ungh.cc
 * (`{ release: { tag, assets[].downloadUrl } }`) и плоскую конфигурацию
 * (`{ version, apkUrl, notes }`) для self-hosted VITE_APP_UPDATE_URL.
 */
export function parseReleasePayload(payload: unknown): UpdateRelease | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const inner = root.release && typeof root.release === 'object' ? (root.release as Record<string, unknown>) : root;
  const version = parseVersionTag(String(inner.tag_name ?? inner.tag ?? inner.version ?? ''));
  if (!version) return null;
  const explicit = typeof inner.apkUrl === 'string' && inner.apkUrl ? inner.apkUrl : null;
  const apkUrl = explicit ?? pickApkAssetUrl(inner.assets);
  if (!apkUrl) return null;
  const notes = String(inner.body ?? inner.notes ?? inner.markdown ?? '').slice(0, 2000);
  return { version, apkUrl, bundleUrl: pickBundleAssetUrl(inner.assets), notes };
}

/** Один фид со своим таймаутом: любая проблема сети/формы = null. */
async function fetchReleaseFrom(url: string, impl: FetchFn, timeoutMs: number): Promise<UpdateRelease | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => {
    try {
      ctrl.abort();
    } catch {
      /* ignore */
    }
  }, timeoutMs);
  try {
    const res = await impl(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res || !res.ok) return null;
    return parseReleasePayload(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * latest-релиз с первого ответившего фида. Источники перебираются по
 * приоритету: api.github.com лимитирован (60/час на IP) и в части сетей
 * недоступен вовсе, зеркало отдаёт тот же релиз. Все упали = null.
 * Таймаут действует на каждый фид отдельно: зависший первый не съедает
 * шанс второго.
 */
export async function fetchLatestRelease(fetchFn?: FetchFn, timeoutMs = 8000): Promise<UpdateRelease | null> {
  const impl = fetchFn ?? (globalThis as unknown as { fetch?: FetchFn }).fetch;
  if (typeof impl !== 'function') return null;
  for (const url of updateEndpoints()) {
    const release = await fetchReleaseFrom(url, impl, timeoutMs);
    if (release) return release;
  }
  return null;
}

export interface UpdateCheckState {
  lastCheck: number;
  skippedVersion: string;
  /**
   * Человеческий итог последней проверки («Установлена последняя версия 3.0.20»,
   * «Нет связи с GitHub»…). Живёт в storage, чтобы настройки могли ответить на
   * вопрос «почему нет баннера», даже если тост не заметили.
   */
  lastResult: string;
}

/** Итог проверки для настроек: пишет writeUpdateState и рассылает событие. */
export const UPDATE_STATE_EVENT = 'he:update-state';

/** Состояние проверок (терпит битый storage — отдаёт дефолт). */
export function readUpdateState(): UpdateCheckState {
  const fallback: UpdateCheckState = {
    lastCheck: 0,
    skippedVersion: '',
    lastResult: '',
  };
  try {
    const raw = localStorage.getItem(UPDATE_STATE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<UpdateCheckState>;
    return {
      lastCheck: typeof parsed.lastCheck === 'number' && Number.isFinite(parsed.lastCheck) ? parsed.lastCheck : 0,
      skippedVersion: typeof parsed.skippedVersion === 'string' ? parsed.skippedVersion : '',
      lastResult: typeof parsed.lastResult === 'string' ? parsed.lastResult : '',
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
  // Настройки слушают это событие: итог виден даже без тоста.
  try {
    window.dispatchEvent(new Event(UPDATE_STATE_EVENT));
  } catch {
    /* SSR/без window */
  }
}

/** True, когда с прошлой проверки прошло ≥ суток (или её не было). */
export function shouldCheckNow(now = Date.now()): boolean {
  const { lastCheck } = readUpdateState();
  if (!lastCheck) return true;
  return now - lastCheck >= UPDATE_CHECK_INTERVAL_MS;
}

/**
 * Ручная проверка обновлений из настроек.
 *
 * Проверка живёт в баннере (`AppUpdateBanner`) — там же скачивание и установка.
 * Дублировать этот поток в настройках нельзя: два места = две разные ошибки.
 * Поэтому кнопка в настройках лишь просит баннер проверить прямо сейчас.
 */
export const UPDATE_CHECK_EVENT = 'he:check-updates';

export function requestUpdateCheck(): void {
  try {
    window.dispatchEvent(new Event(UPDATE_CHECK_EVENT));
  } catch {
    /* SSR/без window — нечего проверять */
  }
}

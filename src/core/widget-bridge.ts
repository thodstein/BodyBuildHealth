/**
 * widget-bridge.ts — JS-фасад homescreen-виджетов APK.
 *
 * Контракт как у native-bridge: безопасен на ЛЮБОЙ платформе.
 * - native (APK): Capacitor-плагин WidgetBridge (SharedPreferences + AppWidgetManager);
 * - telegram/web: виджетов нет — вызовы молча уходят в localStorage-фолбэк
 *   (очередь и снапшоты продолжают работать для тестов/логики, UI их не показывает).
 *
 * Telegram Mini App поведением не меняется: ни один вызов не бросает наружу.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

export type WidgetKind = 'training' | 'timer' | 'compliance' | 'nutrition';
export type WidgetTarget = 'training' | 'nutrition' | 'support' | 'home';
export type TimerAction = 'preset' | 'start' | 'pause' | 'toggle' | 'reset';

export interface QueuedItem {
  type: 'water' | 'food';
  ml?: number;
  name?: string;
  kcal?: number;
  p?: number;
  f?: number;
  c?: number;
  meal?: string;
  ts: number;
}

export interface TimerState {
  running: boolean;
  remainingSec: number;
  durationSec: number;
}

interface WidgetBridgeNative {
  syncTraining(o: { title: string; subtitle: string; meta: string }): Promise<{ ok: boolean }>;
  syncCompliance(o: { pct: number; label: string; detail: string }): Promise<{ ok: boolean }>;
  syncNutrition(o: { kcal: number; targetKcal: number; protein: number; waterMl: number }): Promise<{ ok: boolean }>;
  queueWater(o: { ml: number }): Promise<{ ok: boolean; queue: number }>;
  queueNutrition(o: { name: string; kcal: number; p: number; f: number; c: number; meal: string }): Promise<{ ok: boolean; queue: number }>;
  drainQueue(): Promise<{ items: string; count: number }>;
  queueSize(): Promise<{ queue: number }>;
  timerCommand(o: { action: string; seconds: number }): Promise<TimerState>;
  getTimerState(): Promise<TimerState>;
  getLaunchTarget(): Promise<{ target: string | null }>;
  requestPinWidget(o: { kind: string }): Promise<{ requested: boolean; reason?: string }>;
  refreshAll(): Promise<{ ok: boolean }>;
}

const FB_QUEUE = 'he_widget_fallback_queue';
const FB_PREFIX = 'he_widget_fallback_';

function storageGet(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch {
    /* quota — silent */
  }
}

function storageRemove(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** True только внутри нативного Capacitor WebView (APK). */
export function isNativeWidgetHost(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

let cachedPlugin: WidgetBridgeNative | null | undefined;
function plugin(): WidgetBridgeNative | null {
  if (cachedPlugin !== undefined) return cachedPlugin;
  try {
    if (!isNativeWidgetHost()) {
      cachedPlugin = null;
      return null;
    }
    cachedPlugin = registerPlugin<WidgetBridgeNative>('WidgetBridge');
    return cachedPlugin;
  } catch {
    cachedPlugin = null;
    return null;
  }
}

/** Только для тестов: сбросить кэш плагина. */
export function resetWidgetBridgeCache(): void {
  cachedPlugin = undefined;
}

export function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function clampMl(ml: number): number {
  if (!Number.isFinite(ml) || ml <= 0) return 250;
  return Math.min(2000, Math.round(ml));
}

/** MM:SS для виджета таймера и UI. */
export function formatTimer(totalSec: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSec) ? totalSec : 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m < 10 ? '0' + m : m}:${r < 10 ? '0' + r : r}`;
}

export function parseQueueItems(raw: string): QueuedItem[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (it): it is QueuedItem =>
        !!it && typeof it === 'object' && (it.type === 'water' || it.type === 'food'),
    );
  } catch {
    return [];
  }
}

function fbReadQueue(): QueuedItem[] {
  return parseQueueItems(storageGet(FB_QUEUE) ?? '[]');
}

function fbWriteQueue(items: QueuedItem[]): void {
  try {
    storageSet(FB_QUEUE, JSON.stringify(items.slice(-50)));
  } catch {
    /* ignore */
  }
}

function fbSnapshot(key: string, value: unknown): void {
  try {
    storageSet(FB_PREFIX + key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function readFallbackSnapshot(key: string): unknown {
  try {
    const raw = storageGet(FB_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* ---------------- sync ---------------- */

export async function syncTrainingWidget(input: {
  title: string;
  subtitle: string;
  meta: string;
}): Promise<boolean> {
  const p = plugin();
  if (p) {
    try {
      await p.syncTraining(input);
      return true;
    } catch {
      /* fallback ниже */
    }
  }
  fbSnapshot('training', { ...input, updatedAt: Date.now() });
  return false;
}

export async function syncComplianceWidget(input: {
  pct: number;
  label: string;
  detail: string;
}): Promise<boolean> {
  const pct = clampPct(input.pct);
  const p = plugin();
  if (p) {
    try {
      await p.syncCompliance({ ...input, pct });
      return true;
    } catch {
      /* fallback ниже */
    }
  }
  fbSnapshot('compliance', { ...input, pct, updatedAt: Date.now() });
  return false;
}

export async function syncNutritionWidget(input: {
  kcal: number;
  targetKcal: number;
  protein: number;
  waterMl: number;
}): Promise<boolean> {
  const p = plugin();
  if (p) {
    try {
      await p.syncNutrition(input);
      return true;
    } catch {
      /* fallback ниже */
    }
  }
  fbSnapshot('nutrition', { ...input, updatedAt: Date.now() });
  return false;
}

/* ---------------- queue ---------------- */

export async function queueWaterMl(ml: number): Promise<number> {
  const clean = clampMl(ml);
  const p = plugin();
  if (p) {
    try {
      const r = await p.queueWater({ ml: clean });
      return typeof r.queue === 'number' ? r.queue : 0;
    } catch {
      /* fallback ниже */
    }
  }
  const q = fbReadQueue();
  q.push({ type: 'water', ml: clean, ts: Date.now() });
  fbWriteQueue(q);
  return Math.min(50, q.length);
}

export async function queueFood(input: {
  name: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  meal: string;
}): Promise<number> {
  const item: QueuedItem = {
    type: 'food',
    name: String(input.name || '').slice(0, 120),
    kcal: Math.max(0, Math.round(input.kcal) || 0),
    p: Math.max(0, Math.round(input.p) || 0),
    f: Math.max(0, Math.round(input.f) || 0),
    c: Math.max(0, Math.round(input.c) || 0),
    meal: String(input.meal || 'snack').slice(0, 32),
    ts: Date.now(),
  };
  const p = plugin();
  if (p) {
    try {
      const r = await p.queueNutrition({
        name: item.name ?? '',
        kcal: item.kcal ?? 0,
        p: item.p ?? 0,
        f: item.f ?? 0,
        c: item.c ?? 0,
        meal: item.meal ?? 'snack',
      });
      return typeof r.queue === 'number' ? r.queue : 0;
    } catch {
      /* fallback ниже */
    }
  }
  const q = fbReadQueue();
  q.push(item);
  fbWriteQueue(q);
  return Math.min(50, q.length);
}

export async function queueWidgetSize(): Promise<number> {
  const p = plugin();
  if (p) {
    try {
      const r = await p.queueSize();
      return typeof r.queue === 'number' ? r.queue : 0;
    } catch {
      /* fallback ниже */
    }
  }
  return fbReadQueue().length;
}

/**
 * Забрать очередь (виджет -> дневники). Возвращает элементы и очищает хранилище.
 * Вызывать при старте приложения и при возврате из фона.
 */
export async function drainWidgetQueue(): Promise<QueuedItem[]> {
  const p = plugin();
  if (p) {
    try {
      const r = await p.drainQueue();
      return parseQueueItems(r.items ?? '[]');
    } catch {
      /* fallback ниже */
    }
  }
  const q = fbReadQueue();
  storageRemove(FB_QUEUE);
  return q;
}

/* ---------------- timer ---------------- */

export async function widgetTimerCommand(
  action: TimerAction,
  seconds = 0,
): Promise<TimerState> {
  const fallback: TimerState = {
    running: action === 'preset' || action === 'start',
    remainingSec: seconds > 0 ? Math.min(3600, seconds) : 90,
    durationSec: seconds > 0 ? Math.min(3600, seconds) : 90,
  };
  const p = plugin();
  if (p) {
    try {
      const r = await p.timerCommand({ action, seconds });
      return {
        running: !!r.running,
        remainingSec: Math.max(0, Math.round(r.remainingSec ?? 0)),
        durationSec: Math.max(1, Math.round(r.durationSec ?? 90)),
      };
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export async function getWidgetTimerState(): Promise<TimerState> {
  const p = plugin();
  if (p) {
    try {
      const r = await p.getTimerState();
      return {
        running: !!r.running,
        remainingSec: Math.max(0, Math.round(r.remainingSec ?? 0)),
        durationSec: Math.max(1, Math.round(r.durationSec ?? 90)),
      };
    } catch {
      /* fallback ниже */
    }
  }
  return { running: false, remainingSec: 90, durationSec: 90 };
}

/* ---------------- launch target / pin ---------------- */

/** One-shot цель из тапа по виджету. null — обычный запуск. */
export async function consumeWidgetLaunchTarget(): Promise<WidgetTarget | null> {
  const p = plugin();
  if (p) {
    try {
      const r = await p.getLaunchTarget();
      const t = r.target;
      if (t === 'training' || t === 'nutrition' || t === 'support' || t === 'home') return t;
      return null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Попросить лаунчер закрепить виджет (Android 8+, системный диалог).
 * Вне native всегда { requested: false }.
 */
export async function requestPinWidget(
  kind: WidgetKind,
): Promise<{ requested: boolean; reason?: string }> {
  const p = plugin();
  if (!p) return { requested: false, reason: 'not-native' };
  try {
    const r = await p.requestPinWidget({ kind });
    return { requested: !!r.requested, reason: r.reason };
  } catch {
    return { requested: false, reason: 'error' };
  }
}

export async function refreshAllWidgets(): Promise<boolean> {
  const p = plugin();
  if (!p) return false;
  try {
    await p.refreshAll();
    return true;
  } catch {
    return false;
  }
}

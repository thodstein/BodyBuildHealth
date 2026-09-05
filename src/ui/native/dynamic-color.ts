/**
 * dynamic-color.ts — системный акцент Material You (Android 12+).
 * ТОЛЬКО native: читает палитру через локальный Capacitor-плагин
 * DynamicColor (см. android/.../DynamicColorPlugin.java).
 * Вне APK — всегда null (TG/web без изменений, silent fallback).
 */

import { isCapacitorNative } from '../../core/app-platform';

export interface SystemAccent {
  accent: string;
  accent2: string;
}

export interface DynamicColorRaw {
  available?: unknown;
  [tone: string]: unknown;
}

const ACCENT_PREFERENCE = ['accent1_600', 'accent1_500', 'accent1_400', 'accent1_200'];
const ACCENT2_PREFERENCE = ['accent2_500', 'accent2_400', 'accent3_500', 'accent1_400'];

function pickHex(raw: DynamicColorRaw, keys: string[]): string | null {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) return v;
  }
  return null;
}

/**
 * Системный акцент устройства или null (не native / < Android 12 /
 * плагин недоступен / палитра не распарсилась). Никогда не бросает.
 */
export async function getSystemDynamicColors(): Promise<SystemAccent | null> {
  try {
    if (!isCapacitorNative()) return null;
    const { registerPlugin } = await import('@capacitor/core');
    const plugin = registerPlugin('DynamicColor') as unknown as {
      getDynamicColors: (opts?: Record<string, never>) => Promise<DynamicColorRaw>;
    };
    const raw = await plugin.getDynamicColors();
    if (!raw || raw.available !== true) return null;
    const accent = pickHex(raw, ACCENT_PREFERENCE);
    if (!accent) return null;
    return { accent, accent2: pickHex(raw, ACCENT2_PREFERENCE) ?? accent };
  } catch {
    return null;
  }
}

/**
 * nav-badges.ts — живые бейджи нижнего навбара. ТОЛЬКО APK
 * (CSS-точка `[data-badge]` уже в styles-native.css §58.2).
 * Telegram/web data-атрибут не выставляют — визуал Mini App 1-в-1.
 *
 * Сигналы (все синхронные, localStorage, try/catch):
 * - support: критические лекарственные взаимодействия (he_drug_warnings).
 * - profile: профиль заполнен < 50% (доты — сигналы внимания, чисел нет).
 * Точка расширения: добавить таб → посчитать → вернуть строку.
 */

import { getProfile } from '../../core/profile-manager';

export type NavBadgeMap = Record<string, string>;

/** Порог hero-CTA «Заполните профиль» (ProfileHero) — дот гаснет вместе с ним. */
export const PROFILE_BADGE_THRESHOLD = 50;

function readDrugHighCount(): number {
  try {
    const raw = localStorage.getItem('he_drug_warnings');
    if (!raw) return 0;
    const d = JSON.parse(raw) as { highCount?: unknown };
    const n = typeof d.highCount === 'number' ? d.highCount : 0;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function fmtCount(n: number): string {
  if (n <= 0) return '';
  return n > 99 ? '99+' : String(n);
}

/**
 * Те же 13 проверок, что calcCompleteness в ProfileHero (копипаст осознанный:
 * тащить UI-компонент в мост навбара нельзя). Возвращает 0–100.
 */
export function profileCompleteness(settings: unknown): number {
  try {
    const s = (settings || {}) as Record<string, Record<string, unknown>>;
    const checks = [
      s.personal?.age,
      s.personal?.sex,
      s.personal?.height,
      s.personal?.weight,
      s.training?.primaryGoal,
      s.training?.level,
      s.training?.daysPerWeek,
      s.lifestyle?.sleepHours,
      s.lifestyle?.stressLevel,
      s.health?.bpStage,
      s.nutrition?.dietType,
      s.nutrition?.proteinPerKg,
      s.goals?.primaryGoal,
    ];
    const filled = checks.filter(
      (v) => v !== undefined && v !== null && v !== '',
    ).length;
    return Math.round((filled / checks.length) * 100);
  } catch {
    return 0;
  }
}

function readProfileBadge(): string {
  try {
    const p = getProfile() as { settings?: unknown };
    return profileCompleteness(p?.settings) < PROFILE_BADGE_THRESHOLD ? '!' : '';
  } catch {
    return '';
  }
}

/** Бейджи для PRIMARY_NAV. Пустая строка = точки нет (CSS-селектор скрывает). */
export function getNavBadges(): NavBadgeMap {
  try {
    return {
      support: fmtCount(readDrugHighCount()),
      profile: readProfileBadge(),
    };
  } catch {
    return {};
  }
}

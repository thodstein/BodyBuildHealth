/**
 * bb-mdup.ts — muscle Daily Undulating Periodization (mDUP).
 *
 * Исследования (PMC9987427, Willoughby 1993) показывают, что вариация
 * интенсивности/объёма в пределах недели для каждой мышцы отдельно
 * может быть эффективнее линейной прогрессии.
 *
 * Пример: грудь тренируется 3 раза в неделю:
 * - День 1: тяжёлая (3-5 повт, RIR 1-2)
 * - День 2: средняя (8-10 повт, RIR 2-3)
 * - День 3: лёгкая (12-15 повт, RIR 3-4)
 */

/** mDUP-профиль для мышцы */
export interface MdupProfile {
  muscle: string;
  /** Тяжёлый день: %1RM, RIR */
  heavy: { pct: number; rir: number };
  /** Средний день: %1RM, RIR */
  medium: { pct: number; rir: number };
  /** Лёгкий день: %1RM, RIR */
  light: { pct: number; rir: number };
}

/** Дефолтные mDUP-профили */
const DEFAULT_MDUP_PROFILES: Record<string, Omit<MdupProfile, 'muscle'>> = {
  chest: { heavy: { pct: 0.90, rir: 1 }, medium: { pct: 0.80, rir: 2 }, light: { pct: 0.70, rir: 3 } },
  back: { heavy: { pct: 0.90, rir: 1 }, medium: { pct: 0.80, rir: 2 }, light: { pct: 0.70, rir: 3 } },
  quads: { heavy: { pct: 0.90, rir: 1 }, medium: { pct: 0.80, rir: 2 }, light: { pct: 0.70, rir: 3 } },
  hamstrings: { heavy: { pct: 0.90, rir: 1 }, medium: { pct: 0.80, rir: 2 }, light: { pct: 0.70, rir: 3 } },
  delts: { heavy: { pct: 0.85, rir: 2 }, medium: { pct: 0.75, rir: 3 }, light: { pct: 0.65, rir: 4 } },
  biceps: { heavy: { pct: 0.85, rir: 2 }, medium: { pct: 0.75, rir: 3 }, light: { pct: 0.65, rir: 4 } },
  triceps: { heavy: { pct: 0.85, rir: 2 }, medium: { pct: 0.75, rir: 3 }, light: { pct: 0.65, rir: 4 } },
};

/** Хранилище mDUP-профилей */
const profiles = new Map<string, MdupProfile>();

/** Получить mDUP-профиль для мышцы */
export function getMdupProfile(muscle: string): MdupProfile {
  return profiles.get(muscle) ?? {
    muscle,
    ...DEFAULT_MDUP_PROFILES[muscle] ?? { heavy: { pct: 0.85, rir: 2 }, medium: { pct: 0.75, rir: 3 }, light: { pct: 0.65, rir: 4 } },
  };
}

/** Обновить mDUP-профиль */
export function updateMdupProfile(
  muscle: string,
  heavy: { pct: number; rir: number },
  medium: { pct: number; rir: number },
  light: { pct: number; rir: number },
): MdupProfile {
  const profile: MdupProfile = {
    muscle,
    heavy: { pct: Math.max(0.5, Math.min(1.0, heavy.pct)), rir: Math.max(0, Math.min(5, heavy.rir)) },
    medium: { pct: Math.max(0.5, Math.min(1.0, medium.pct)), rir: Math.max(0, Math.min(5, medium.rir)) },
    light: { pct: Math.max(0.5, Math.min(1.0, light.pct)), rir: Math.max(0, Math.min(5, light.rir)) },
  };
  profiles.set(muscle, profile);
  return profile;
}

/** Получить все mDUP-профили */
export function getAllMdupProfiles(): MdupProfile[] {
  return Array.from(profiles.values());
}

/** Очистить все профили (для тестов) */
export function clearMdupProfiles(): void {
  profiles.clear();
}

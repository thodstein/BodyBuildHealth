/**
 * bb-taper-adaptive.engine.ts — адаптивный тапер ББ: модификаторы кривой по
 * тренированности, категории, ПЭД-статусу, возрасту и фазе цикла.
 *
 * P0-1: Длина и крутизна тапера зависят от тренированности (Bosquet 2007, Helms 2020).
 * P0-4: Категория влияет на распределение объёма (bikini/wellness — ноги режутся сильнее).
 * P0-5: ПЭД-статус позволяет держать объём дольше (enhanced) или резать раньше (натурал).
 * Гликоген-коррекция карб-дозы (Burke 2011): низкий гликоген → +15% бюджета.
 * Визуализация кривой (taperCurveSVG) + сравнение стратегий (compareTaperStrategies).
 *
 * Чистый движок: без UI-импортов, детерминирован, входы валидируются.
 */
import type { BBContestPrepConfig, BBContestCategory, TrainingTaperWeek, CarbLoadStrategy } from './bb-contest-prep.engine';
import { buildTrainingTaper, CATEGORY_PROFILES } from './bb-contest-prep.engine';

// ═══════════════════════════════════════════════════════════════════════════
// Типы
// ═══════════════════════════════════════════════════════════════════════════

/** Данные о тренированности атлета (из дневника тренировок / профиля). */
export interface TrainingExperienceData {
  /** Годов регулярных тренировок. */
  yearsTraining?: number;
  /** Тренировок в неделю (среднее). */
  sessionsPerWeek?: number;
  /** Средний объём за сессию (сетов). */
  avgVolumePerSession?: number;
  /** Общее число тренировок в дневнике. */
  totalSessions?: number;
}

/** Модификаторы кривой тапера (множители, 1.0 = без изменений). */
export interface TaperModifiers {
  /** Множитель объёма (сетов). */
  volumeMult?: number;
  /** Множитель интенсивности (веса). */
  intensityMult?: number;
  /** Сдвиг RIR (добавить к min/max). */
  rirShift?: number;
  /** Переопределить длину тапера (недель). */
  taperLength?: number;
}

export interface TaperModifierSource {
  cfg: BBContestPrepConfig;
  experience?: TrainingExperienceData;
}

/** Уровень гликогена 1-10 (1 = сильно истощён, 10 = полный). */
export type GlycogenLevel = number;

// ═══════════════════════════════════════════════════════════════════════════
// Оценка тренированности
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Оценка тренированности 0..1 на основе данных дневника/профиля.
 * Годы: 0..10 → 0..0.5; сессии: 0..2000 → 0..0.3; частота: 1..7 → 0..0.2.
 */
export function estimateTrainingExperience(exp?: TrainingExperienceData): number {
  if (!exp) return 0.5;
  const hasAny = exp.yearsTraining != null || exp.totalSessions != null || exp.sessionsPerWeek != null;
  if (!hasAny) return 0.5;
  const years = Math.max(0, Math.min(10, exp.yearsTraining ?? 0));
  const sessions = Math.max(0, Math.min(2000, exp.totalSessions ?? 0));
  const spw = Math.max(1, Math.min(7, exp.sessionsPerWeek ?? 3));
  const yearScore = (years / 10) * 0.5;
  const sessionScore = (sessions / 2000) * 0.3;
  const freqScore = ((spw - 1) / 6) * 0.2;
  return Math.round((yearScore + sessionScore + freqScore) * 100) / 100;
}

/**
 * Оценка тренированности из дневника тренировок.
 * Принимает плоский список сессий с полями date/sets/reps/weight.
 */
export function estimateDiaryExperience(
  sessions: Array<{ date?: string; sets?: number; weight?: number }>,
): TrainingExperienceData {
  if (!Array.isArray(sessions) || sessions.length === 0) return {};
  const valid = sessions.filter(s => s.date && typeof s.sets === 'number' && s.sets > 0);
  if (valid.length === 0) return {};
  const dates = valid.map(s => s.date!).sort();
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const daysDiff = Math.max(1, Math.round(
    (new Date(lastDate).getTime() - new Date(firstDate).getTime()) / 86400000,
  ));
  const weeks = Math.max(1, daysDiff / 7);
  const spw = Math.round((valid.length / weeks) * 10) / 10;
  const avgVol = Math.round(
    valid.reduce((a, s) => a + (s.sets || 0), 0) / valid.length,
  );
  return {
    totalSessions: valid.length,
    sessionsPerWeek: Math.min(7, Math.max(1, spw)),
    avgVolumePerSession: avgVol,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Модификаторы тапера
// ═══════════════════════════════════════════════════════════════════════════

/** Per-category модификаторы объёма тапера (bikini/wellness — ноги режутся сильнее). */
export const CATEGORY_TAPER_VOLUME_MOD: Record<string, number> = {
  bikini: 0.90,
  wellness: 0.90,
  figure: 0.95,
  womens_physique: 0.95,
};

/**
 * Построить модификаторы тапера из конфига + данных о тренированности.
 *
 * Логика:
 * - Продвинутый (exp ≥ 0.7): короткий тапер (2 нед), объём режется сильнее (×0.95),
 *   интенсивность выше (×1.02) — Helms 2020.
 * - Новичок (exp ≤ 0.3): длинный тапер (4 нед), объём режется мягче (×1.05),
 *   интенсивность ниже (×0.98) — Bosquet 2007.
 * - Категория bikini/wellness: объём дополнительно ×0.90 (ноги режем сильнее).
 * - Enhanced (курс): объём ×0.95 (держим дольше), интенсивность ×1.025.
 * - Возраст 40+: тапер 4 нед, объём ×1.05, интенсивность ×0.98.
 * - Лютеиновая фаза (женщины, cycleDay ≥ 14): интенсивность ×0.95.
 */
export function buildTaperModifiers(src: TaperModifierSource): TaperModifiers {
  const { cfg, experience } = src;
  const mods: TaperModifiers = {};

  const expScore = estimateTrainingExperience(experience);
  if (experience) {
    if (expScore >= 0.7) {
      mods.taperLength = 2;
      mods.volumeMult = 0.95;
      mods.intensityMult = 1.02;
    } else if (expScore <= 0.3) {
      mods.taperLength = 4;
      mods.volumeMult = 1.05;
      mods.intensityMult = 0.98;
    }
  }

  const catMod = CATEGORY_TAPER_VOLUME_MOD[cfg.category];
  if (catMod != null) {
    mods.volumeMult = (mods.volumeMult ?? 1) * catMod;
  }

  if (cfg.enhanced) {
    mods.volumeMult = (mods.volumeMult ?? 1) * 0.95;
    mods.intensityMult = (mods.intensityMult ?? 1) * 1.025;
  }

  if (cfg.age && cfg.age >= 40) {
    mods.taperLength = 4;
    mods.volumeMult = (mods.volumeMult ?? 1) * 1.05;
    mods.intensityMult = (mods.intensityMult ?? 1) * 0.98;
  }

  if (cfg.sex === 'female' && cfg.cycleDay && cfg.cycleDay >= 14) {
    mods.intensityMult = (mods.intensityMult ?? 1) * 0.95;
  }

  return mods;
}

// ═══════════════════════════════════════════════════════════════════════════
// Адаптивный тапер
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Построить адаптивный тапер с учётом модиторов.
 *
 * Без модификаторов (нет данных о тренированности/опыте/ПЭД) — байт-в-байт
 * с buildTrainingTaper (дефолтные кривая). С модификаторами — длина,
 * объём, интенсивность и RIR корректируются.
 */
export function buildAdaptiveTaper(
  cfg: BBContestPrepConfig,
  opts?: {
    experience?: TrainingExperienceData;
    volumeMult?: number;
    modifiers?: TaperModifiers;
  },
): TrainingTaperWeek[] {
  const mods = opts?.modifiers ?? buildTaperModifiers({ cfg, experience: opts?.experience });
  const weeksOut = mods.taperLength ?? cfg.weeksOut;
  const cfgWithWeeks: BBContestPrepConfig = { ...cfg, weeksOut };
  const base = buildTrainingTaper(cfgWithWeeks, { volumeMult: opts?.volumeMult });

  const volM = mods.volumeMult ?? 1;
  const intM = mods.intensityMult ?? 1;
  const rirS = mods.rirShift ?? 0;

  return base.map(w => ({
    ...w,
    volumePct: Math.round(w.volumePct * volM * 100) / 100,
    intensityPct: Math.round(w.intensityPct * intM * 100) / 100,
    rirMin: Math.max(0, w.rirMin + rirS),
    rirMax: Math.max(0, w.rirMax + rirS),
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Гликоген-коррекция карб-дозы
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Коррекция карб-дозы по уровню гликогена (Burke 2011).
 *
 * - Гликоген низкий (1-3): +15% бюджета (нужно больше для суперкомпенсации).
 * - Гликоген высокий (8-10): −10% бюджета (плато близко).
 * - Средний (4-7): без изменений.
 *
 * Без данных (null/undefined) — байт-в-байт.
 */
export function glycogenAdjustedDose(
  baseDose: number,
  glycogenLevel?: GlycogenLevel,
): number {
  if (glycogenLevel == null || !Number.isFinite(glycogenLevel)) return baseDose;
  const level = Math.max(1, Math.min(10, Math.round(glycogenLevel)));
  if (level <= 3) return baseDose * 1.15;
  if (level >= 8) return baseDose * 0.90;
  return baseDose;
}

/**
 * Оценка гликогена из дневника питания/чек-ина.
 *
 * Эвристика: среднее потребление углеводов за последние 3 дня → 1-10.
 * <2 г/кг → 1-3 (истощён); 2-4 → 4-6; >4 → 7-10.
 */
export function estimateGlycogenFromCarbs(
  avgCarbsGPerDay: number,
  weightKg: number,
): GlycogenLevel {
  const perKg = avgCarbsGPerDay / Math.max(1, weightKg);
  if (perKg < 2) return 2;
  if (perKg < 3) return 4;
  if (perKg < 4) return 6;
  if (perKg < 5) return 8;
  return 9;
}

// ═══════════════════════════════════════════════════════════════════════════
// Визуализация и сравнение
// ═══════════════════════════════════════════════════════════════════════════

/** SVG-график кривой тапера (объём/интенсивность/RIR). */
export function taperCurveSVG(taper: TrainingTaperWeek[]): string {
  if (!taper.length) return '';
  const w = 400;
  const h = 200;
  const pad = 30;
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  const pt = (i: number, v: number) => {
    const x = pad + (i / Math.max(1, taper.length - 1)) * iw;
    const y = pad + ih - v * ih;
    return `${x},${y}`;
  };
  const volPts = taper.map((t, i) => pt(i, t.volumePct)).join(' ');
  const intPts = taper.map((t, i) => pt(i, t.intensityPct)).join(' ');
  const rirPts = taper.map((t, i) => pt(i, t.rirMin / 5)).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<polyline points="${volPts}" fill="none" stroke="#22c55e" stroke-width="2"/>` +
    `<polyline points="${intPts}" fill="none" stroke="#3b82f6" stroke-width="2"/>` +
    `<polyline points="${rirPts}" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4"/>` +
    `<text x="${pad}" y="${pad - 10}" font-size="10" fill="#22c55e">объём</text>` +
    `<text x="${pad + 30}" y="${pad - 10}" font-size="10" fill="#3b82f6">инт.</text>` +
    `<text x="${pad + 55}" y="${pad - 10}" font-size="10" fill="#f59e0b">RIR</text>` +
    `</svg>`;
}

export interface TaperStrategyComparison {
  strategy: CarbLoadStrategy;
  label: string;
  carbBudgetGPerKg: [number, number];
  spillRisk: 'low' | 'medium' | 'high';
  bestFor: string;
}

/** Сравнительная таблица стратегий углеводной загрузки. */
export function compareTaperStrategies(category: BBContestCategory): TaperStrategyComparison[] {
  const profile = CATEGORY_PROFILES[category];
  const [bMin, bMax] = profile.carbTotalBudgetGPerKg;
  return [
    { strategy: 'front', label: 'Ранняя (front)', carbBudgetGPerKg: [bMin, bMax], spillRisk: 'low', bestFor: 'Опытные, с контролем инсулина' },
    { strategy: 'moderate', label: 'Умеренная (moderate)', carbBudgetGPerKg: [bMin, bMax], spillRisk: 'medium', bestFor: 'Большинство атлетов' },
    { strategy: 'back', label: 'Поздняя (back)', carbBudgetGPerKg: [bMin, bMax], spillRisk: 'medium', bestFor: 'С хорошей инсулин-чувствительностью' },
    { strategy: 'undulating', label: 'Волна (undulating)', carbBudgetGPerKg: [bMin, bMax], spillRisk: 'medium', bestFor: 'Непредсказуемый отклик' },
    { strategy: 'linear', label: 'Линейная (linear)', carbBudgetGPerKg: [bMin, bMax], spillRisk: 'medium', bestFor: 'Стабильный метаболизм' },
    { strategy: 'direct', label: 'Прямая (direct)', carbBudgetGPerKg: [bMin, bMax], spillRisk: 'low', bestFor: 'Без деплеции, быстрая загрузка' },
  ];
}

/**
 * bb-taper-adaptive.engine.ts — адаптивный тапер ББ: модификаторы кривой по
 * тренированности, категории, ПЭД-статусу, возрасту и фазе цикла.
 *
 * P0-1: Длина и крутизна тапера зависят от тренированности (Bosquet 2007, Helms 2020).
 * P0-4: Категория влияет на распределение объёма (bikini/wellness — ноги режутся сильнее).
 * P0-5: ПЭД-статус позволяет держать объём дольше (enhanced) или резать раньше (натурал).
 * Гликоген-коррекция карб-дозы (Burke 2011): низкий гликоген → +15% бюджета.
 *
 * Чистый движок: без UI-импортов, детерминирован, входы валидируются.
 */
import type { BBContestPrepConfig, BBContestCategory, TrainingTaperWeek } from './bb-contest-prep.engine';
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
// P1-3: Протокол «stable_full» — без водных манипуляций
// ═══════════════════════════════════════════════════════════════════════════

export interface StableFullProtocol {
  waterLitersPerDay: number;
  sodiumMgPerDay: number;
  carbsGPerDay: number;
  notes: string[];
}

/**
 * Протокол «stable_full»: вода 3-4 л/день от D-7 до D-0 без колебаний,
 * натрий constant, углеводы по выбранной стратегии загрузки.
 * Для атлетов, которые не хотят манипуляции водой.
 */
export function buildStableFullProtocol(
  cfg: BBContestPrepConfig,
  carbBudgetGPerKg: number,
): StableFullProtocol {
  const w = cfg.weightKg;
  const isFemale = cfg.sex === 'female';
  const water = Math.round((isFemale ? 3.0 : 3.5) * 10) / 10;
  const sodium = 2800;
  const carbs = Math.round(w * carbBudgetGPerKg);
  return {
    waterLitersPerDay: water,
    sodiumMgPerDay: sodium,
    carbsGPerDay: carbs,
    notes: [
      'Без водных манипуляций: вода стабильна всю неделю',
      `Вода ${water}л/день (35мл/кг)`,
      `Натрий ${sodium}мг/день (constant)`,
      `Углеводы ${carbs}г/день (${carbBudgetGPerKg} г/кг)`,
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// P1-5: Протокол для РПП/РЕД-С — без дефицита, без манипуляций
// ═══════════════════════════════════════════════════════════════════════════

export interface RedSafeProtocol {
  minKcalPerDay: number;
  proteinGPerDay: number;
  waterLitersPerDay: number;
  sodiumMgPerDay: number;
  notes: string[];
}

/**
 * Протокол для атлетов с РПП/РЕД-С:
 * - Без дефицита калорий в тапере (поддержание или лёгкий профицит)
 * - Без манипуляций водой/натрием
 * - Повышенный белок (2.2 г/кг)
 * - Мониторинг настроения в чек-инах
 */
export function buildRedSafeProtocol(cfg: BBContestPrepConfig): RedSafeProtocol {
  const w = cfg.weightKg;
  const isFemale = cfg.sex === 'female';
  const minKcal = isFemale ? 1400 : 1600;
  const protein = Math.round(w * 2.2);
  const water = Math.round((isFemale ? 3.0 : 3.5) * 10) / 10;
  return {
    minKcalPerDay: minKcal,
    proteinGPerDay: protein,
    waterLitersPerDay: water,
    sodiumMgPerDay: 2800,
    notes: [
      'РЕД-С протокол: без дефицита калорий в тапере',
      `Минимум ${minKcal} ккал/день`,
      `Белок ${protein}г/день (2.2 г/кг)`,
      `Вода ${water}л/день, натрий 2800мг/день (стабильно)`,
      'Мониторинг настроения в чек-инах (1-5)',
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// P1-8: Соматотип — коррекция углеводной загрузки и воды
// ═══════════════════════════════════════════════════════════════════════════

export type Somatotype = 'ectomorph' | 'mesomorph' | 'endomorph';

export interface SomatotypeTaperMod {
  carbBudgetDeltaGPerKg: number;
  waterDeltaL: number;
  note: string;
}

/**
 * Модификатор тапера по соматотипу.
 * Эктоморф: +1 г/кг углеводов (медленный метаболизм, нужен запас).
 * Эндоморф: −1 г/кг углеводов (быстрый метаболизм, риск spill).
 * Мезоморф: без изменений.
 */
export function somatotypeTaperMod(somatotype?: Somatotype): SomatotypeTaperMod {
  switch (somatotype) {
    case 'ectomorph':
      return { carbBudgetDeltaGPerKg: 1, waterDeltaL: 0.2, note: 'Эктоморф: +1 г/кг углеводов, +0.2л воды' };
    case 'endomorph':
      return { carbBudgetDeltaGPerKg: -1, waterDeltaL: -0.2, note: 'Эндоморф: −1 г/кг углеводов, −0.2л воды' };
    default:
      return { carbBudgetDeltaGPerKg: 0, waterDeltaL: 0, note: 'Мезоморф: без изменений' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// P1-6: Интеграция с лабораторными анализами
// ═══════════════════════════════════════════════════════════════════════════

export interface LabMarkers {
  ferritin?: number;
  cortisol?: number;
  testosterone?: number;
  estradiol?: number;
  tsh?: number;
  glucose?: number;
  hba1c?: number;
}

export interface LabTaperWarning {
  marker: string;
  value: number;
  threshold: string;
  warning: string;
  taperImpact: 'none' | 'mild' | 'moderate' | 'severe';
}

/**
 * Предупреждения по лабораторным маркерам, влияющие на тапер.
 */
export function labTaperWarnings(labs: LabMarkers): LabTaperWarning[] {
  const warnings: LabTaperWarning[] = [];
  if (labs.ferritin != null && labs.ferritin < 30) {
    warnings.push({ marker: 'ферритин', value: labs.ferritin, threshold: '<30 нг/мл', warning: 'Дефицит железа: утомляемость, снижение выносливости', taperImpact: 'moderate' });
  }
  if (labs.cortisol != null && labs.cortisol > 20) {
    warnings.push({ marker: 'кортизол', value: labs.cortisol, threshold: '>20 мкг/дл', warning: 'Повышенный кортизол: задержка воды, катаболизм', taperImpact: 'moderate' });
  }
  if (labs.testosterone != null && labs.testosterone < 300) {
    warnings.push({ marker: 'тестостерон', value: labs.testosterone, threshold: '<300 нг/дл', warning: 'Низкий тестостерон: снижение силы и восстановления', taperImpact: 'moderate' });
  }
  if (labs.estradiol != null && labs.estradiol > 40) {
    warnings.push({ marker: 'эстрадиол', value: labs.estradiol, threshold: '>40 пг/мл', warning: 'Повышенный эстрадиол: задержка воды', taperImpact: 'mild' });
  }
  if (labs.tsh != null && labs.tsh > 4.5) {
    warnings.push({ marker: 'ТТГ', value: labs.tsh, threshold: '>4.5 мМЕ/л', warning: 'Гипотиреоз: утомляемость, сухость кожи', taperImpact: 'mild' });
  }
  if (labs.glucose != null && labs.glucose > 100) {
    warnings.push({ marker: 'глюкоза', value: labs.glucose, threshold: '>100 мг/дл', warning: 'Повышенная глюкоза: риск spill при загрузке', taperImpact: 'mild' });
  }
  if (labs.hba1c != null && labs.hba1c > 5.7) {
    warnings.push({ marker: 'HbA1c', value: labs.hba1c, threshold: '>5.7%', warning: 'Преддиабет: риск spill при загрузке', taperImpact: 'mild' });
  }
  return warnings;
}

// ═══════════════════════════════════════════════════════════════════════════
// P1-7: Детальный протокол мульти-шоу
// ═══════════════════════════════════════════════════════════════════════════

export interface MultiShowSegment {
  showDate: string;
  weeksBefore: number;
  phase: 'base' | 'overreach' | 'peak' | 'recovery';
  volumeMult: number;
  intensityMult: number;
  note: string;
}

/**
 * Построение детального протокола для серии шоу.
 * Между шоу: неделя overreach (+20% объёма), затем возврат к базе.
 * Два полных пика подряд запрещены (Escalante 2021).
 */
export function buildMultiShowProtocol(
  showDates: string[],
  baseVolumeMult: number = 1.0,
  baseIntensityMult: number = 0.95,
): MultiShowSegment[] {
  if (!showDates.length) return [];
  const sorted = [...showDates].sort();
  const segments: MultiShowSegment[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const date = sorted[i];
    const prevDate = i > 0 ? sorted[i - 1] : null;
    const daysSincePrev = prevDate
      ? Math.round((new Date(date).getTime() - new Date(prevDate).getTime()) / 86400000)
      : null;

    if (i === 0) {
      segments.push({
        showDate: date,
        weeksBefore: 0,
        phase: 'peak',
        volumeMult: 0.6,
        intensityMult: 0.85,
        note: 'Первое шоу: стандартный тапер',
      });
    } else if (daysSincePrev != null && daysSincePrev < 14) {
      segments.push({
        showDate: date,
        weeksBefore: 0,
        phase: 'peak',
        volumeMult: 0.65,
        intensityMult: 0.88,
        note: `Только ${daysSincePrev} дн после предыдущего: мягкий тапер, без overreach`,
      });
    } else {
      segments.push({
        showDate: date,
        weeksBefore: 2,
        phase: 'overreach',
        volumeMult: baseVolumeMult * 1.2,
        intensityMult: baseIntensityMult,
        note: 'За 2 недели до шоу: overreach (+20% объёма) для компенсации',
      });
      segments.push({
        showDate: date,
        weeksBefore: 1,
        phase: 'peak',
        volumeMult: 0.6,
        intensityMult: 0.85,
        note: 'Финальная неделя перед шоу: стандартный тапер',
      });
    }
  }

  return segments;
}

// ═══════════════════════════════════════════════════════════════════════════
// P2: Визуализация, сравнение, экспорт, напоминания, отмена, путешествия, ветераны
// ═══════════════════════════════════════════════════════════════════════════

/** SVG-график кривой тапера (объём/интенсивность/RIR). */
export function taperCurveSVG(taper: TrainingTaperWeek[]): string {
  if (!taper.length) return '';
  const w = 400;
  const h = 200;
  const pad = 30;
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  const maxVol = 1;
  const maxInt = 1;
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

export interface PeakWeekExport {
  html: string;
  ics: string;
  csv: string;
}

/** Экспорт пик-недели в HTML (печать), ICS (календарь) и CSV. */
export function exportPeakWeek(
  plan: PeakWeekDayPlan[],
  showDate: string,
): PeakWeekExport {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<html><head><meta charset="utf-8"><title>Пик-неделя ${esc(showDate)}</title></head><body>` +
    `<h1>Пик-неделя: ${esc(showDate)}</h1>` +
    `<table><tr><th>День</th><th>Фаза</th><th>Ккал</th><th>Б</th><th>У</th><th>Ж</th><th>Вода</th><th>Натрий</th><th>Тренировка</th></tr>` +
    plan.map(d =>
      `<tr><td>D-${7 - d.day}</td><td>${esc(d.phaseLabel)}</td><td>${d.kcal}</td><td>${d.proteinG}</td><td>${d.carbsG}</td><td>${d.fatG}</td><td>${d.waterLiters}</td><td>${d.sodiumMg}</td><td>${esc(d.training.type)}</td></tr>`,
    ).join('') +
    `</table></body></html>`;

  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//bb-taper//peak-week//RU']
    .concat(plan.map(d => [
      'BEGIN:VEVENT',
      `DTSTART;VALUE=DATE=${d.date.replace(/-/g, '')}`,
      `SUMMARY:Пик D-${7 - d.day} — ${d.phaseLabel}`,
      `DESCRIPTION:Ккал ${d.kcal} · Вода ${d.waterLiters}л · Na ${d.sodiumMg}мг`,
      'END:VEVENT',
    ]).flat())
    .concat(['END:VCALENDAR'])
    .join('\r\n');

  const csv = 'day,phase,kcal,protein,carbs,fat,water,sodium,training\n' +
    plan.map(d =>
      `${d.day},${d.phaseLabel},${d.kcal},${d.proteinG},${d.carbsG},${d.fatG},${d.waterLiters},${d.sodiumMg},${d.training.type}`,
    ).join('\n');

  return { html, ics, csv };
}

export interface PeakReminder {
  date: string;
  dayIndex: number;
  title: string;
  detail: string;
}

/** Напоминания пик-недели (утренний чек-ин каждый день). */
export function buildPeakReminders(plan: PeakWeekDayPlan[]): PeakReminder[] {
  return plan.map(d => ({
    date: d.date,
    dayIndex: d.day,
    title: `Пик D-${7 - d.day}: ${d.phaseLabel}`,
    detail: `Вес · Вода ${d.waterLiters}л · Na ${d.sodiumMg}мг · Тренировка: ${d.training.type}`,
  }));
}

export interface CancellationProtocol {
  days: Array<{ day: number; waterTarget: string; sodiumTarget: string; carbsTarget: string; note: string }>;
  notes: string[];
}

/**
 * Протокол отмены пик-недели: постепенный возврат к нормальной воде/натрию/углеводам за 3-5 дней.
 */
export function buildPeakCancellationPlan(): CancellationProtocol {
  return {
    days: [
      { day: 1, waterTarget: '3.5л', sodiumTarget: '2800мг', carbsTarget: 'обычная', note: 'Возврат к базовому протоколу' },
      { day: 2, waterTarget: '3.5л', sodiumTarget: '2800мг', carbsTarget: 'обычная', note: 'Без резких изменений' },
      { day: 3, waterTarget: '3.5л', sodiumTarget: '2800мг', carbsTarget: 'обычная', note: 'Нормализация' },
    ],
    notes: [
      'Отмена пика не опасна: водные манипуляции обратимы',
      'Не обнуляйте воду и натрий — вернитесь к плану за 3 дня',
      'После отмены можно начать новую подготовку',
    ],
  };
}

export interface TravelTaperMod {
  waterDeltaL: number;
  sodiumDeltaMg: number;
  note: string;
}

/** Модификатор тапера для путешествий (смена часового пояса, перелёт). */
export function travelTaperMod(traveling: boolean, timeZoneShiftHours?: number): TravelTaperMod {
  if (!traveling) return { waterDeltaL: 0, sodiumDeltaMg: 0, note: '' };
  const shift = Math.abs(timeZoneShiftHours ?? 0);
  const waterDelta = shift >= 6 ? 0.5 : 0.3;
  return {
    waterDeltaL: waterDelta,
    sodiumDeltaMg: 0,
    note: `Перелёт ${shift}ч: +${waterDelta}л воды в день перелёта и первые 2 дня`,
  };
}

export interface VeteranTaperMod {
  taperLength: number;
  volumeMult: number;
  intensityMult: number;
  note: string;
}

/** Модификатор для ветеранов 40+: длинный тапер, мягче интенсивность. */
export function veteranTaperMod(age?: number): VeteranTaperMod {
  if (age == null || age < 40) return { taperLength: 4, volumeMult: 1, intensityMult: 1, note: '' };
  return {
    taperLength: 4,
    volumeMult: 1.05,
    intensityMult: 0.97,
    note: `Возраст ${age}: восстановление медленнее, интенсивность −3%`,
  };
}

export interface TaperCalendarDay {
  week: number;
  date: string;
  phase: string;
  volumePct: number;
  intensityPct: number;
  rirMin: number;
  rirMax: number;
  isDeload: boolean;
}

/** Календарь тапера (недели × фазы × множители). */
export function buildTaperCalendar(
  taper: TrainingTaperWeek[],
  showDate: string,
  weeksOut: number,
): TaperCalendarDay[] {
  const days: TaperCalendarDay[] = [];
  const show = new Date(`${showDate}T00:00:00`);
  for (let i = weeksOut - 1; i >= 0; i--) {
    const weekDate = new Date(show);
    weekDate.setDate(weekDate.getDate() - i * 7);
    const iso = `${weekDate.getFullYear()}-${String(weekDate.getMonth() + 1).padStart(2, '0')}-${String(weekDate.getDate()).padStart(2, '0')}`;
    const t = taper[i];
    if (!t) continue;
    days.push({
      week: weeksOut - i,
      date: iso,
      phase: t.label,
      volumePct: t.volumePct,
      intensityPct: t.intensityPct,
      rirMin: t.rirMin,
      rirMax: t.rirMax,
      isDeload: t.volumePct < 0.65,
    });
  }
  return days;
}

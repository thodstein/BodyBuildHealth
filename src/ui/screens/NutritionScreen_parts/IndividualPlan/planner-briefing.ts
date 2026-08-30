/**
 * planner-briefing.ts — 🧭 Брифинг дня: компактная сводка помощника спортсмена.
 *
 * Что готовить сегодня (выбранные рецепты), ближайший приём по времени суток,
 * факт vs цель по КБЖУ, вода, тип дня и 2–3 ситуативных совета (углеводное окно,
 * добор белка, перебор калорий). Чистая функция — покрывается прямыми тестами.
 */

export interface BriefingArgs {
  /** Тоталы плана дня */
  totals: { kcal: number; p: number; f: number; c: number };
  /** Цели дня */
  goals: { kcal: number; p: number; f: number; c: number };
  /** Приёмы дня (label/time/items) — опционально recipeApplied */
  meals: Array<{ label?: string; time?: string; recipeApplied?: string; recipeApplied2?: string }>;
  /** Тренировочный день? */
  isTrainingDay: boolean;
  /** Время тренировки 'HH:MM' (опционально) */
  trainTime?: string;
  /** Текущее время 'HH:MM' */
  nowTime: string;
  /** Норма воды дня, л */
  waterL?: number;
  /** Факт из дневника питания за сегодня (что реально съедено), опционально */
  fact?: { kcal: number; p: number } | null;}

export interface DayBriefing {
  /** Что готовить сегодня: уникальные выбранные рецепты в порядке приёмов */
  cookToday: string[];
  /** Ближайший приём (time ≥ now) или null, если день завершён */
  nextMeal: { label: string; time: string } | null;
  /** Отклонение ккал от цели, % (со знаком) */
  kcalDeltaPct: number;
  /** Добор белка до цели, г (>0 если недобор ≥10 г) */
  proteinLeftG: number;
  /** Ситуативные советы (0–4) */
  tips: string[];
  /** Тип дня для заголовка */
  dayTypeLabel: string;
  /** Факт/план по ккал, % (null — дневник пуст) */
  factVsPlanPct: number | null;
  /** Осталось до цели по ккал (факт учтён), может быть отрицательным */
  remainingKcalToGoal: number | null;
  /** G3 (Эпик G): факт/план по БЕЛКУ, % (null — в дневнике нет белка) */
  factProteinVsPlanPct: number | null;
  /** G3: осталось белка до цели с учётом факта, г (null — нет факта) */
  remainingProteinG: number | null;
}

const toMin = (hhmm?: string): number => {
  try {
    const [h, m] = String(hhmm || '').split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
    return h * 60 + m;
  } catch { return NaN; }
};

export function buildDayBriefing(args: BriefingArgs): DayBriefing {
  const { totals, goals, meals, isTrainingDay, trainTime, nowTime, waterL, fact } = args;

  // Что готовить: применённые рецепты в порядке следования приёмов, без дублей
  const seen = new Set<string>();
  const cookToday: string[] = [];
  (meals || []).forEach(m => {
    if (m?.recipeApplied && !seen.has(m.recipeApplied)) {
      seen.add(m.recipeApplied);
      cookToday.push(m.recipeApplied);
    }
    if (m?.recipeApplied2 && !seen.has(m.recipeApplied2)) {
      seen.add(m.recipeApplied2);
      cookToday.push(m.recipeApplied2);
    }
  });

  // Ближайший приём: первый с временем ≥ текущего
  const nowMin = toMin(nowTime);
  let nextMeal: { label: string; time: string } | null = null;
  if (Number.isFinite(nowMin)) {
    for (const m of meals || []) {
      const t = toMin(m?.time);
      if (Number.isFinite(t) && t >= nowMin) { nextMeal = { label: m.label || 'Приём', time: m.time || '' }; break; }
    }
  }

  const goalK = Math.max(1, goals.kcal || 1);
  const kcalDeltaPct = Math.round(((totals.kcal || 0) - goalK) / goalK * 1000) / 10;
  const proteinLeftG = Math.max(0, Math.round((goals.p || 0) - (totals.p || 0)));

  // Советы (макс. 3, детерминированный порядок важности)
  const tips: string[] = [];
  if (isTrainingDay && trainTime) {
    const tr = toMin(trainTime); const now = toMin(nowTime);
    if (Number.isFinite(tr) && Number.isFinite(now) && now >= tr && now - tr <= 90) {
      tips.push('⚡ Углеводно-белковое окно открыто (~60–90 мин после тренировки) — закройте его пост-тренировочным приёмом');
    }
  }
  if (proteinLeftG >= 10) {
    tips.push(`🥩 До цели по белку осталось ~${proteinLeftG} г — доберите творогом/курицей/шейком`);
  }
  if (kcalDeltaPct >= 6) {
    tips.push(`⚠️ План выше цели на ${kcalDeltaPct}% — урежьте перекус или увеличьте активность`);
  }

  // Факт из дневника: % от плана + остаток до цели
  let factVsPlanPct: number | null = null;
  let remainingKcalToGoal: number | null = null;
  // G3 (Эпик G): факт по БЕЛКУ — главный макрос бодибилдера, раньше в брифинге был только ккал
  let factProteinVsPlanPct: number | null = null;
  let remainingProteinG: number | null = null;
  const factKcal = fact?.kcal ?? 0;
  const factP = fact?.p ?? 0;
  if (factKcal > 0) {
    const planK = Math.max(1, totals.kcal || goalK);
    factVsPlanPct = Math.round(factKcal / planK * 100);
    remainingKcalToGoal = Math.round(goalK - factKcal);
    if (factVsPlanPct >= 115) {
      tips.push(`🍽 Факт уже ${factVsPlanPct}% плана (${Math.round(factKcal)} ккал) — остаток дня держите лёгким`);
    }
  }
  if (factP > 0) {
    const planP = Math.max(1, totals.p || goals.p || 1);
    factProteinVsPlanPct = Math.round(factP / planP * 100);
    remainingProteinG = Math.round((goals.p || 0) - factP);
    if (remainingProteinG > 0) {
      tips.push(`🥩 Факт: ${Math.round(factP)} г белка (${factProteinVsPlanPct}% плана) — осталось ~${remainingProteinG} г`);
    }
  }

  return {
    cookToday,
    nextMeal,
    kcalDeltaPct,
    proteinLeftG,
    tips: tips.slice(0, 4),
    dayTypeLabel: isTrainingDay ? '🏋️ Тренировочный день' : '😴 День отдыха',
    factVsPlanPct,
    remainingKcalToGoal,
    factProteinVsPlanPct,
    remainingProteinG,
  };
}

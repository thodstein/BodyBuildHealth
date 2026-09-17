/**
 * planner-day-explain.ts — «Почему день не сошёлся» (волна-3): чистый разбор notes движка.
 *
 * Движок уже пишет причины и компенсации в notes дня:
 *   ⚠ «Не сошлось»: отклонение дня от целей N% (>8%) …
 *   ⚠ Корректор дневных целей: осталось отклонение N% (>3%) …
 *   ⚠ «Перекус 2»: 36У из цели 120У (<60%) — капы семейств/комната ккал не дали долить …
 *   ⚠ Точность рациона: отклонение >5% (Б …) …
 *   ➕ Финальный добор сходимости / 🍚 Финальная дотяжка / 🍚 Болюс-день … / ⚖️ белок ужат …
 * Здесь — только классификация (причина / компенсация / проверка) и человеческие подсказки.
 * Движок и его notes НЕ меняются; UI показывает то, что уже посчитано.
 */

export type DayExplainLevel = 'problem' | 'fix' | 'check';

export interface DayExplainReason {
  id: string;
  level: DayExplainLevel;
  title: string;
  hint: string;
  raw: string;
}

export interface DayExplainResult {
  devPct: number | null;
  tolerance: number;
  within: boolean | null;
  headline: string | null;
  causes: DayExplainReason[];
  fixes: DayExplainReason[];
  checks: DayExplainReason[];
}

interface ExplainPlanLike {
  totals?: { kcal?: number; p?: number; f?: number; c?: number; fiber?: number } | null;
  meals?: Array<{ total?: any; totals?: any }> | null;
  notes?: string[] | null;
  deviationPct?: number | null;
  withinTolerance?: boolean | null;
}

interface ExplainTargets {
  kcal?: number;
  p?: number;
  f?: number;
  c?: number;
}

/** Правила классификации notes. Порядок = порядок показа. */
const RULES: Array<{ id: string; level: DayExplainLevel; re: RegExp; title: string; hint: string }> = [
  {
    // Только итоговая нота движка «⚠ «Не сошлось»: …» — note-приёмов «(<60%) … не сошлось: …»
    // содержит эту фразу как пояснение и не должна классифицироваться как итог дня.
    id: 'not-converged', level: 'problem', re: /Не сошлось»/i,
    title: 'День не сошёлся с целями',
    hint: 'Это честный best-effort: цели/капы порций/квоты не дали закрыть день. Проверьте бюджет, число приёмов и исключения.',
  },
  {
    id: 'corrector-left', level: 'problem', re: /Корректор дневных целей: осталось отклонение/i,
    title: 'Корректор не дотянул день',
    hint: 'Остаток — цена капов порций/семейств и квот (порошок, фрукты, масла). Ослабьте кап или добавьте приём.',
  },
  {
    id: 'meal-carb-short', level: 'problem', re: /\(<60%\)/,
    title: 'В приёме не хватает углеводов',
    hint: 'Капы семейств/комната ккал не дали долить — дотяните вручную или смените носитель в этом приёме.',
  },
  {
    id: 'meal-overload', level: 'problem', re: /Перегрузка приёма/i,
    title: 'Часть приёмов перегружена порциями',
    hint: 'Крупа упирается в лимит порции — число приёмов подбирается автоматически; увеличьте объём дня',
  },
  {
    id: 'macro-mismatch', level: 'problem', re: /Точность рациона: отклонение >5%/i,
    title: 'Перекос по макросу',
    hint: 'Отклонение в основном из-за целевого белка/жиров — проверьте пулы и исключённые продукты.',
  },
  {
    id: 'fiber-low', level: 'check', re: /Клетчатка: \d+г \/ \d+г — добавьте/i,
    title: 'Клетчатка ниже коридора',
    hint: 'Добавьте овощи/цельнозерновые/ягоды.',
  },
  {
    id: 'mps-gap', level: 'check', re: /MPS gap/i,
    title: 'Большой интервал между приёмами',
    hint: 'Между белковыми приёмами больше 3-4 ч — добавьте белковый перекус ≥25 г.',
  },
  {
    id: 'sodium-low', level: 'check', re: /Натрий низкий/i,
    title: 'Натрий ниже цели',
    hint: 'На тренировочном дне риск гипонатриемии — добавьте соль в приёмы.',
  },
  {
    id: 'fruit-cap', level: 'fix', re: /Фруктовый кап/i,
    title: 'Фруктовый кап применён',
    hint: 'Фрукт убран из позднего приёма (лимит ≤4 приёма с фруктом), угли перенесены в гарнир.',
  },
  {
    id: 'extreme-carb', level: 'fix', re: /Экстрим-добор|Экстрим-углеводный день|Финальная дотяжка углеводов|Финальный добор сходимости/i,
    title: 'Движок дотянул углеводы',
    hint: 'Плотные носители довели день ближе к цели (кап съедобности).',
  },
  {
    id: 'bolus-lean', level: 'fix', re: /Болюс-день: .*ужат/i,
    title: 'Болюс-день: белок приведён к капу',
    hint: 'Протеин-плотные носители ужаты — окна инсулина и дневной кап белка целы.',
  },
  {
    id: 'mps-ceiling', level: 'fix', re: /белок ужат до MPS-потолка/i,
    title: 'Белок приёма приведён к MPS-потолку',
    hint: 'Мейн не выходит за 0.62 г/кг LBM (Schoenfeld & Aragon 2018).',
  },
  {
    id: 'snack-protein', level: 'fix', re: /Белковый пункт восстановлен|белковый пункт восстановлен/i,
    title: 'Перекус добрал белок',
    hint: 'Перекус без белка получил лёгкий белковый пункт.',
  },
  {
    id: 'portion-trimmed', level: 'fix', re: /ужат|ужаты до съедобных|съедобных \d+/i,
    title: 'Порции ужаты до съедобных',
    hint: 'Движок срезал «вёдра» до реалистичных граммовок.',
  },
];

const MAX_DEVIATIONS = ['kcal', 'p', 'f', 'c'] as const;

/** Отклонение дня от целей (максимум по 4 осям, %). null — нет данных. */
export function dayDeviationPct(
  totals: ExplainPlanLike['totals'],
  targets: ExplainTargets | null | undefined,
): number | null {
  if (!totals || !targets) return null;
  let maxDev = 0;
  let hasAny = false;
  for (const k of MAX_DEVIATIONS) {
    const goal = Number((targets as any)[k] || 0);
    if (!(goal > 0)) continue;
    const fact = Number((totals as any)[k] || 0);
    hasAny = true;
    maxDev = Math.max(maxDev, Math.abs(fact - goal) / goal);
  }
  if (!hasAny) return null;
  return Math.round(maxDev * 1000) / 10;
}

/**
 * Разбор дня: причины несошедшести + компенсации движка + точечные проверки.
 * Карточка рисуется, если есть отклонение > tolerance или хотя бы одна причина.
 */
export function explainDayPlan(
  plan: ExplainPlanLike | null | undefined,
  targets?: ExplainTargets | null,
  opts?: { tolerance?: number; maxPerGroup?: number },
): DayExplainResult {
  const tolerance = Math.max(1, Number(opts?.tolerance) || 8);
  if (!plan) {
    return { devPct: null, tolerance, within: null, headline: null, causes: [], fixes: [], checks: [] };
  }
  const computed = dayDeviationPct(plan.totals, targets);
  const devPct = typeof plan.deviationPct === 'number' && Number.isFinite(plan.deviationPct)
    ? Math.round(plan.deviationPct * 10) / 10
    : computed;
  const within = typeof plan.withinTolerance === 'boolean'
    ? plan.withinTolerance
    : (devPct == null ? null : devPct <= tolerance);

  const causes: DayExplainReason[] = [];
  const fixes: DayExplainReason[] = [];
  const checks: DayExplainReason[] = [];
  const seen = new Set<string>();
  for (const n of (plan.notes || [])) {
    const raw = String(n || '').trim();
    if (!raw || raw.length > 400) continue;
    for (const rule of RULES) {
      if (!rule.re.test(raw)) continue;
      if (seen.has(rule.id)) break;
      seen.add(rule.id);
      const item: DayExplainReason = { id: rule.id, level: rule.level, title: rule.title, hint: rule.hint, raw };
      if (rule.level === 'problem') causes.push(item);
      else if (rule.level === 'fix') fixes.push(item);
      else checks.push(item);
      break;
    }
  }

  const cap = Math.max(1, Number(opts?.maxPerGroup) || 4);
  let headline: string | null = null;
  if (devPct != null) {
    headline = within
      ? `День сошёлся: отклонение ${devPct}% (норма ≤${tolerance}%)`
      : `Отклонение дня ${devPct}% — выше нормы ≤${tolerance}%`;
  } else if (causes.length > 0) {
    headline = 'Есть замечания движка — разбор ниже';
  }
  return {
    devPct,
    tolerance,
    within,
    headline,
    causes: causes.slice(0, cap),
    fixes: fixes.slice(0, cap),
    checks: checks.slice(0, cap),
  };
}

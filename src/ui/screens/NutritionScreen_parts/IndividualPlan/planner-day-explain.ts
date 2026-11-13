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

import { PLANNER_CONVERGENCE_PCT } from './day-target-corrector';

export type DayExplainLevel = 'problem' | 'fix' | 'check';

/** Шаг 7 рефактора: запись журнала проходов движка (монотонное улучшение dev). */
export interface PassJournalEntry {
  id: string;
  label: string;
  /** max-отклонение дня до прохода, % (0 = точно в цель). */
  devBefore: number;
  /** max-отклонение дня после прохода, %. */
  devAfter: number;
}

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
  /** Шаг 7: журнал проходов (сборка → сведение → P4b → P4c → reconciliation → финал). */
  journal: PassJournalEntry[];
  /** Реальные числа по осям (факт/цель/разница) — основа человеческой карточки. */
  axes: DayAxisDeviation[];
}

interface ExplainPlanLike {
  totals?: { kcal?: number; p?: number; f?: number; c?: number; fiber?: number } | null;
  meals?: Array<{ total?: any; totals?: any }> | null;
  notes?: string[] | null;
  deviationPct?: number | null;
  withinTolerance?: boolean | null;
  passJournal?: PassJournalEntry[] | null;
}

interface ExplainTargets {
  kcal?: number;
  p?: number;
  f?: number;
  c?: number;
  /**
   * Алиасы: `planTargets` в контексте хранит цели как {kcal, protein, fats, carbs}
   * (имена из настроек КБЖУ), а движок — как {kcal, p, f, c}. Раньше карточка читала
   * только p/f/c, поэтому у живого плана сравнивалась ОДНА ось — ккал: день с белком
   * 141 из 112 г и углеводами 337 из 393 объявлялся «сошёлся 0.6%».
   */
  protein?: number;
  fats?: number;
  carbs?: number;
  fat?: number;
  calories?: number;
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

/** Оси дня: подпись для карточки + имена полей цели (движок и настройки КБЖУ). */
const AXES: Array<{ key: 'kcal' | 'p' | 'f' | 'c'; label: string; unit: string; aliases: string[] }> = [
  { key: 'kcal', label: 'Ккал', unit: '', aliases: ['kcal', 'calories'] },
  { key: 'p', label: 'Б', unit: 'г', aliases: ['p', 'protein'] },
  { key: 'f', label: 'Ж', unit: 'г', aliases: ['f', 'fats', 'fat'] },
  { key: 'c', label: 'У', unit: 'г', aliases: ['c', 'carbs'] },
];

function goalOf(targets: ExplainTargets | null | undefined, aliases: string[]): number {
  if (!targets) return 0;
  for (const a of aliases) {
    // P2-fix: isFinite-гарды — строковое/битое значение из any-данных (старые сохранённые
    // планы/импорт) давали NaN, который уезжал в текст объяснения и отклонение.
    const raw = Number((targets as any)[a]);
    if (Number.isFinite(raw) && raw > 0) return raw;
  }
  return 0;
}

/** Одна ось дня: факт/цель/разница в единицах оси и в процентах. */
export interface DayAxisDeviation {
  key: 'kcal' | 'p' | 'f' | 'c';
  label: string;
  unit: string;
  fact: number;
  goal: number;
  /** факт − цель (в единицах оси). */
  diff: number;
  /** diff / цель × 100, округлено до 0.1. */
  diffPct: number;
  /** §8.91: ось — ПОЛ (белок): перебор не дефект, недобор — дефект. */
  floor: boolean;
}

/**
 * §8.91 (решение владельца «а»): «промах» оси для вердикта дня.
 * Обычные оси — |отклонение|; белок (пол) — только НЕДОБОР. Перебор белка не делает
 * день несошедшимся (ядра рецептов и MPS-полы приёмов не режутся), но виден в чипе оси.
 */
export function axisMissPct(a: DayAxisDeviation): number {
  return a.floor ? Math.max(0, -a.diffPct) : Math.abs(a.diffPct);
}

/** Разбор дня по осям — ровно те числа, что пользователь видит в «ИТОГО ЗА ДЕНЬ». */
export function dayAxisDeviations(
  totals: ExplainPlanLike['totals'],
  targets: ExplainTargets | null | undefined,
): DayAxisDeviation[] {
  if (!totals || !targets) return [];
  const out: DayAxisDeviation[] = [];
  for (const axis of AXES) {
    const goal = goalOf(targets, axis.aliases);
    if (!(goal > 0)) continue;
    const rawFact = Number((totals as any)[axis.key]);
    const fact = Number.isFinite(rawFact) ? rawFact : 0;
    const diff = fact - goal;
    out.push({
      key: axis.key,
      label: axis.label,
      unit: axis.unit,
      fact: Math.round(fact),
      goal: Math.round(goal),
      diff: Math.round(diff),
      diffPct: Math.round((diff / goal) * 1000) / 10,
      floor: axis.key === 'p',
    });
  }
  return out;
}

/** Ось с максимальным промахом — её и называем в заголовке. */
export function dayWorstAxis(axes: DayAxisDeviation[]): DayAxisDeviation | null {
  let worst: DayAxisDeviation | null = null;
  for (const a of axes) {
    if (!worst || axisMissPct(a) > axisMissPct(worst)) worst = a;
  }
  return worst;
}

/** Промах дня от целей (максимум по 4 осям, белок — только недобор, %). null — нет данных. */
export function dayDeviationPct(
  totals: ExplainPlanLike['totals'],
  targets: ExplainTargets | null | undefined,
): number | null {
  const axes = dayAxisDeviations(totals, targets);
  if (axes.length === 0) return null;
  let maxDev = 0;
  for (const a of axes) maxDev = Math.max(maxDev, axisMissPct(a));
  return Math.round(maxDev * 10) / 10;
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
  // E0: канон допуска — PLANNER_CONVERGENCE_PCT (3%); 5/8 остаются визуальными градациями.
  const tolerance = Math.max(1, Number(opts?.tolerance) || PLANNER_CONVERGENCE_PCT);
  const journal: PassJournalEntry[] = Array.isArray(plan?.passJournal)
    ? plan!.passJournal!.filter(e => e && typeof e.devAfter === 'number').slice(0, 12)
    : [];
  if (!plan) {
    return { devPct: null, tolerance, within: null, headline: null, causes: [], fixes: [], checks: [], journal: [], axes: [] };
  }
  // Реальные числа дня: считаем ВСЕГДА из фактических тоталов и целей, а не только когда
  // движок прислал deviationPct. Причина: рецептурный контур и пост-проходы UI меняют
  // тарелку ПОСЛЕ движка (DIAAS-ремонт, ручные цели приёма, второй рецепт), поэтому
  // `plan.deviationPct` устаревает. Живой пример: день 2509/141/67/337 при цели
  // 2524/112/56/393 показывался как «сошёлся 0.6%» — сравнивалась одна ось (ккал).
  const axes = dayAxisDeviations(plan.totals, targets);
  const computed = dayDeviationPct(plan.totals, targets);
  const fromPlan = typeof plan.deviationPct === 'number' && Number.isFinite(plan.deviationPct)
    ? Math.round(plan.deviationPct * 10) / 10
    : null;
  // Итоговые числа дня — авторитет; оценка движка нужна только как fallback (нет тоталов).
  const devPct = computed == null ? fromPlan : computed;
  // Флаг движка тоже устаревает (считается до пост-проходов): при наличии итоговых чисел
  // верим им, иначе — флагу/порогу.
  const within = devPct == null ? null : devPct <= tolerance;

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

  // ── Вердикт дня приводим к ФИНАЛЬНЫМ числам ────────────────────────────────
  // Нота «⚠ «Не сошлось»: отклонение дня 3.7%» пишется до пост-проходов (добор,
  // дотяжка, §8.88/рецепты), поэтому в живом плане спорила с итогами: день
  // 141/112 г белка объявлял «сошёлся 0.6%», а нота — «не сошлось 3.7%».
  const worstAxis = axes.length > 0 ? dayWorstAxis(axes) : null;
  const verdictRaw = () => {
    if (devPct == null) return '';
    if (!worstAxis) return `Отклонение дня ${devPct}% — сравнить не с чем: цели не переданы`;
    return `Отклонение дня ${devPct}% — главная ось «${worstAxis.label}»: ${worstAxis.fact} из ${worstAxis.goal}${worstAxis.unit} (${worstAxis.diff > 0 ? '+' : ''}${worstAxis.diff}${worstAxis.unit}, ${worstAxis.diffPct > 0 ? '+' : ''}${worstAxis.diffPct}%)`;
  };
  if (devPct != null) {
    const nci = causes.findIndex(c => c.id === 'not-converged');
    // Дневные вердикты (несошедшийся день / корректор / перекос макроса) снимаются, если
    // ИТОГОВЫЙ день в каноне: они описывают промежуточный проход. Приёмо-уровневые причины
    // («<60%» в приёме) остаются — это точечная подсказка, а не вердикт дня.
    const DAY_VERDICTS = new Set(['not-converged', 'corrector-left', 'macro-mismatch']);
    if (devPct <= tolerance) {
      for (let i = causes.length - 1; i >= 0; i--) if (DAY_VERDICTS.has(causes[i].id)) causes.splice(i, 1);
    } else if (nci >= 0) {
      causes[nci] = { ...causes[nci], raw: verdictRaw() };
    } else {
      causes.unshift({
        id: 'not-converged', level: 'problem', title: 'День не сошёлся с целями',
        hint: 'Цели/капы порций/квоты не дали закрыть день — различия по осям выше.', raw: verdictRaw(),
      });
    }
  }

  const cap = Math.max(1, Number(opts?.maxPerGroup) || 4);
  let headline: string | null = null;
  if (devPct != null) {
    // Называем ОСЬ, а не абстрактный процент: «белок 141 из 112 г» — это то, что человек
    // видит в итогах дня. Без этого карточка сообщала «0.6%», пока белок был +26%.
    const axisNote = worstAxis && worstAxis.key !== 'kcal' && axisMissPct(worstAxis) > tolerance
      ? ` — главное: ${worstAxis.label} ${worstAxis.fact} из ${worstAxis.goal}${worstAxis.unit}`
      : '';
    headline = within
      ? `День сошёлся: отклонение ${devPct}% (норма ≤${tolerance}%)`
      : `Отклонение дня ${devPct}% — выше нормы ≤${tolerance}%${axisNote}`;
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
    journal,
    axes,
  };
}

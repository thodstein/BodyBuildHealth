/**
 * bb-training-recommendations.engine.ts — профессиональные рекомендации по
 * бодибилдингу, связанные со всеми блоками приложения:
 *  - план/цикл пользователя (BB-auto: сплит, фаза, объём, паттерны);
 *  - PED (дозы, капы, суставы, пери-WO углеводы);
 *  - план питания (белок/калораж из профиля и дневника питания);
 *  - план добавок (покрытие поддержки по системам);
 *  - дневник тренировок (выполнение плана, прогрессия, готовность, ACWR).
 *
 * Стиль: конкретный, тренерский, без воды. Числа — из реальных данных.
 * Отдельно от ПЛ-рекомендаций: только бодибилдинг.
 */
import type { WorkoutLog } from '../../core/types';
import { getExerciseById } from '../../core/exercise-catalog';
import { getPedCap } from './bb-ped-adaptation.engine';

export interface BBRecItem {
  id: string;
  severity: 'info' | 'warn' | 'critical';
  text: string;
}

export interface BBRecSection {
  id: string;
  title: string;
  icon: string;
  items: BBRecItem[];
}

export interface BBRecNutrition {
  avgKcal: number;
  avgProtein: number;
  avgCarbs: number;
  days: number;
}

export interface BBRecProfile {
  weightKg?: number;
  sex?: 'male' | 'female';
  proteinPerKg?: number;
  manualTargets?: { kcal: number; protein: number; fat: number; carbs: number };
  goalKcal?: number;
  surplusPct?: number;
}

export interface BBRecContext {
  /** Текущий BB-план (результат buildBBPlan/finalizeBBPlan). */
  plan?: any;
  /** Параметры построения плана (peds/doses/level/goal/weeks/weakPoints/focusGroup). */
  params?: {
    patternName?: string;
    level?: string;
    goal?: string;
    weeks?: number;
    daysPerWeek?: number;
    peds?: string[];
    pedDoses?: Record<string, number>;
    courseIntensity?: string;
    weakPoints?: string[];
    focusGroup?: string;
    trainingFocus?: string;
  };
  historyWorkouts?: WorkoutLog[];
  profile?: BBRecProfile;
  /** Среднедневное питание за последние дни (из nutrition_diary_v2). */
  nutrition?: BBRecNutrition;
  /** Активные добавки плана поддержки (id). */
  supportSubs?: string[];
  /** Последняя готовность (0-100) и число низких дней подряд. */
  readiness?: { lastRecovery?: number; lowDays?: number };
  acwr?: number;
  lastSleepHours?: number | null;
  /** Текущая неделя плана (1-based). */
  currentWeek?: number;
}

const GRP_RU: Record<string, string> = {
  chest: 'грудь', back: 'спина', shoulders: 'плечи', quads: 'квадрицепсы',
  hamstrings: 'бицепс бедра', glutes: 'ягодицы', calves: 'икры', biceps: 'бицепс',
  triceps: 'трицепс', forearms: 'предплечья', traps: 'трапеции', abs: 'пресс',
};

const weekStart = (d: Date): Date => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; };

/** Недельные прямые сеты по мышцам за последние N недель (факт из дневника). */
export function weeklySetsByMuscle(workouts: WorkoutLog[], weeks = 3): Record<string, number[]> {
  const now = new Date();
  const starts: Date[] = [];
  for (let i = weeks - 1; i >= 0; i--) { const s = weekStart(now); s.setDate(s.getDate() - i * 7); starts.push(s); }
  const res: Record<string, number[]> = {};
  starts.forEach((s, wi) => {
    const e = new Date(s); e.setDate(e.getDate() + 6);
    const ss = s.toISOString().slice(0, 10), ee = e.toISOString().slice(0, 10);
    workouts.forEach(w => {
      if (w.date < ss || w.date > ee) return;
      (w.exercises || []).forEach(ex => {
        const cat = getExerciseById(ex.exerciseId);
        if (!cat) return;
        const muscle = cat.group;
        if (!res[muscle]) res[muscle] = new Array(weeks).fill(0);
        res[muscle][wi] += (ex.sets?.length || 0);
      });
    });
  });
  return res;
}

/** Суммарные прямые сеты недели плана по сессиям (без warmup). */
export function planWeeklySets(plan: any): number {
  if (!plan?.weeks?.[0]) return 0;
  return plan.weeks[0].sessions.reduce((s: number, sess: any) =>
    s + (sess.exercises || []).filter((e: any) => !(e as any).warmupActivator).reduce((a: number, e: any) => a + (e.sets || 0), 0), 0);
}

/** Средний RIR последней тренировки (факт). */
function lastAvgRir(workouts: WorkoutLog[] | undefined): number | null {
  if (!workouts?.length) return null;
  const last = workouts[0];
  const rirs: number[] = [];
  (last.exercises || []).forEach((ex: any) => (ex.sets || []).forEach((s: any) => {
    if (typeof s.rir === 'number' && Number.isFinite(s.rir)) rirs.push(s.rir);
  }));
  return rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null;
}

/** Фактическая частота тренировок за последние 7 дней. */
function sessionsLast7(workouts: WorkoutLog[] | undefined): number {
  if (!workouts?.length) return 0;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
  const key = cutoff.toISOString().slice(0, 10);
  return workouts.filter(w => w.date >= key).length;
}

export function generateBBRecommendations(ctx: BBRecContext): BBRecSection[] {
  const sections: BBRecSection[] = [];
  const { plan, params, historyWorkouts, profile, nutrition, supportSubs, readiness, acwr, lastSleepHours, currentWeek } = ctx;

  // ═══ 1. Текущая программа ═══
  const progItems: BBRecItem[] = [];
  if (plan) {
    const name = plan.pattern?.name || params?.patternName || 'ББ-план';
    const sessions = plan.weeks?.[0]?.sessions?.length || 0;
    const totalSets = planWeeklySets(plan);
    progItems.push({
      id: 'prog-summary', severity: 'info',
      text: `Текущая программа: «${name}», ${sessions} тренировок/нед, ${totalSets} рабочих сетов на неделю. Держите объём и RIR по плану — не импровизируйте сеты/веса без причины.`,
    });
    if (params?.focusGroup && params.focusGroup !== '') {
      progItems.push({ id: 'prog-focus', severity: 'info', text: `Акцент на «${GRP_RU[params.focusGroup] || params.focusGroup}» — этот объём неприкосновенен, при нехватке времени срезайте второстепенные изоляции, не специализацию.` });
    }
    const rationale = plan.rationale || [];
    const qualityIssues = rationale.filter((r: string) => r.includes('⚠ Качество'));
    for (const issue of qualityIssues.slice(0, 2)) {
      progItems.push({ id: 'prog-quality', severity: 'warn', text: issue.replace(/^⚠ /, '') });
    }
    const weekCount = plan.weeks?.length || params?.weeks || 0;
    if (weekCount > 1 && currentWeek && currentWeek > 0) {
      const week = plan.weeks[Math.min(currentWeek - 1, weekCount - 1)];
      const phase = week?.phase || 'accumulation';
      const PHASE_RU: Record<string, string> = { accumulation: 'накопление', intensification: 'интенсификация', peaking: 'пик', deload: 'разгрузка' };
      progItems.push({ id: 'prog-phase', severity: 'info', text: `Неделя ${currentWeek}/${weekCount} — фаза «${PHASE_RU[phase] || phase}». ${phase === 'deload' ? 'Это разгрузка: вес/объём снижены намеренно, не добивайте до отказа.' : phase === 'peaking' ? 'Пик: RIR минимален, сохраняйте веса, объём уже срезан — это нормально.' : 'Рабочая фаза: прогрессируйте по плану (повторы → вес).'}` });
    }
  } else {
    progItems.push({ id: 'prog-none', severity: 'info', text: 'Активного ББ-плана нет: постройте план в «BB-auto» (Сплит → План) — рекомендации по объёму/фазам заработают автоматически.' });
  }
  sections.push({ id: 'program', title: 'Программа', icon: '🏗️', items: progItems });

  // ═══ 2. PED ═══
  const pedItems: BBRecItem[] = [];
  const peds = params?.peds || [];
  const doses = params?.pedDoses || {};
  const intensity = params?.courseIntensity || 'moderate';
  const pedAdapt = plan?.pedAdaptation as { combinedMrvMultiplier?: number; activePEDs?: string[]; risks?: string[] } | undefined;
  const mrvMult = pedAdapt?.combinedMrvMultiplier ?? (peds.length ? (intensity === 'heavy' ? 1.35 : intensity === 'mild' ? 1.15 : 1.25) : 1);
  if (peds.length > 0 || (pedAdapt && (pedAdapt.combinedMrvMultiplier ?? 1) > 1)) {
    pedItems.push({ id: 'ped-mrv', severity: 'info', text: `Курс: MRV ×${mrvMult.toFixed(2)} (${peds.length ? peds.join('+') : 'активная фарма'}). Объём плана уже учитывает это — не добавляйте сеты сверх плана «на курсе».` });
    for (const p of peds) {
      const dose = doses[p] || 0;
      const cap = getPedCap(p as any);
      if (cap > 0 && dose > cap) {
        pedItems.push({ id: `ped-cap-${p}`, severity: 'warn', text: `${p} ${dose} выше капа ${cap}: повышение дозы не даёт большего MRV — только токсичность. Либо снизьте дозу, либо направьте усилия на питание/восстановление.` });
      }
    }
    if (mrvMult >= 1.3) {
      pedItems.push({ id: 'ped-joints', severity: 'warn', text: 'Сухожилия и связки адаптируются медленнее мышц: разминайтесь дольше, не форсируйте негативную фазу на тяжёлых сетах, добавьте преабилитацию (колено/локоть/плечо) в разминку каждой сессии.' });
    }
    if (doses['insulin'] > 0) {
      pedItems.push({ id: 'ped-insulin', severity: 'info', text: 'Инсулин: суперкомпенсация гликогена — ешьте 0.4-0.8 г/кг углеводов вокруг тренировки (приём до/после), иначе гипогликемия на тренировке.' });
    }
    if (doses['GH'] > 0) {
      pedItems.push({ id: 'ped-gh', severity: 'info', text: 'ГР: ремонт соединительной ткани — используйте это: тренируйте растянутую позицию (RDL, наклонные жимы, incline-сгибания) без страха перегрузить сухожилия.' });
    }
    if (pedAdapt?.risks?.length) {
      for (const r of pedAdapt.risks.slice(0, 1)) pedItems.push({ id: 'ped-risk', severity: 'warn', text: r });
    }
  } else {
    pedItems.push({ id: 'ped-none', severity: 'info', text: 'Без PED: объём по натуральным ориентирам. Восстановление — главный лимит: сон 7-9 ч, белок 1.6-2.0 г/кг, делод каждые 6-8 недель.' });
  }
  sections.push({ id: 'ped', title: 'Фарма и восстановление', icon: '💉', items: pedItems });

  // ═══ 3. Питание ═══
  const nutrItems: BBRecItem[] = [];
  const goal = params?.goal || 'mass';
  const bw = profile?.weightKg || 80;
  if (profile?.proteinPerKg != null && bw > 0) {
    const targetProtein = goal === 'cut' ? 2.0 : 1.6;
    const pkg = profile.proteinPerKg;
    if (pkg < targetProtein) {
      nutrItems.push({ id: 'nutr-protein-low', severity: 'warn', text: `Белок ${pkg.toFixed(1)} г/кг ниже ориентира ${targetProtein.toFixed(1)} г/кг (${goal === 'cut' ? 'сушка: защита мышц' : 'гипертрофия'}) — добавьте ${Math.round((targetProtein - pkg) * bw)} г белка в день (порции по 30-40 г).` });
    } else {
      nutrItems.push({ id: 'nutr-protein-ok', severity: 'info', text: `Белок ${pkg.toFixed(1)} г/кг — в норме (ориентир ${targetProtein.toFixed(1)}+).` });
    }
  }
  if (nutrition && nutrition.days > 0) {
    const kcalPerKg = nutrition.avgKcal / bw;
    if (goal === 'mass' && kcalPerKg < 30) {
      nutrItems.push({ id: 'nutr-kcal-mass', severity: 'warn', text: `Питание ${Math.round(nutrition.avgKcal)} ккал (${kcalPerKg.toFixed(0)} ккал/кг) — для набора массы нужно ~32-38 ккал/кг. Дефицит съедает рост: прогрессия весов встанет.` });
    }
    if (goal === 'cut' && kcalPerKg > 27) {
      nutrItems.push({ id: 'nutr-kcal-cut', severity: 'warn', text: `Питание ${Math.round(nutrition.avgKcal)} ккал (${kcalPerKg.toFixed(0)} ккал/кг) — для сушки нужно ~24-27 ккал/кг. На профиците вы не сушитесь.` });
    }
    if (nutrition.avgCarbs > 0 && nutrition.avgCarbs / bw < 2 && goal === 'mass') {
      nutrItems.push({ id: 'nutr-carbs', severity: 'info', text: `Углеводы ${(nutrition.avgCarbs / bw).toFixed(1)} г/кг — мало для набора. Углеводы — топливо для объёма: доведите до 3-4 г/кг, особенно в дни тренировок.` });
    }
  } else if (profile?.weightKg) {
    nutrItems.push({ id: 'nutr-no-diary', severity: 'info', text: 'Дневник питания пуст: запишите питание в блоке «Питание» — рекомендации станут точнее (калораж/белок/углеводы).' });
  }
  sections.push({ id: 'nutrition', title: 'Питание', icon: '🍗', items: nutrItems });

  // ═══ 4. Добавки (связь с планом поддержки) ═══
  const suppItems: BBRecItem[] = [];
  const subs = (supportSubs || []).map(s => s.toLowerCase());
  const has = (names: string[]) => names.some(n => subs.includes(n.toLowerCase()));
  const onOral = peds.length > 0; // грубо: любой курс — оральный/инъекционный
  if (peds.length > 0 && !has(['nac', 'tudca', 'udca', 'расторопша', 'silybin', 'молочный чертополох'])) {
    suppItems.push({ id: 'supp-liver', severity: 'warn', text: 'Курс без гепатопротектора: добавьте NAC 600-1200 мг или TUDCA 500-1000 мг/день — печень под нагрузкой оралов/ААС.' });
  }
  if (mrvMult >= 1.3 && !has(['collagen', 'коллаген', 'uc-ii', 'uc2', 'glucosamine', 'глюкозамин', 'omega-3', 'омега'])) {
    suppItems.push({ id: 'supp-joints', severity: 'warn', text: 'Повышенный объём без суставной поддержки: коллаген 10-15 г/день (или UC-II) + омега-3 2-3 г EPA/DHA — суставы будут благодарны на фоне роста весов.' });
  }
  if (doses['insulin'] > 0 && !has(['taurine', 'таурин', 'agmatine', 'агматин'])) {
    suppItems.push({ id: 'supp-insulin', severity: 'info', text: 'Инсулин: таурин 3-5 г/день поддерживает чувствительность к инсулину; цитруллин перед тренировкой — пампинг и переносимость объёма.' });
  }
  if (goal === 'cut' && !has(['creatine', 'креатин'])) {
    suppItems.push({ id: 'supp-cut', severity: 'info', text: 'Сушка: креатин 3-5 г/день сохраняет силу и объём мышц, не мешает сушке.' });
  }
  if (subs.length === 0 && !has(['creatine', 'креатин', 'omega', 'омега', 'vitamin d', 'витамин d'])) {
    suppItems.push({ id: 'supp-base', severity: 'info', text: 'База добавок: креатин 3-5 г, омега-3 2-3 г, витамин D 2000-4000 МЕ — дёшево и работает для всех.' });
  }
  sections.push({ id: 'supplements', title: 'Добавки', icon: '💊', items: suppItems });

  // ═══ 5. Выполнение плана и прогрессия ═══
  const execItems: BBRecItem[] = [];
  const plannedSessions = plan?.weeks?.[0]?.sessions?.length || params?.daysPerWeek || 0;
  const factSessions = sessionsLast7(historyWorkouts);
  if (plannedSessions > 0) {
    if (factSessions < plannedSessions - 1) {
      execItems.push({ id: 'exec-missed', severity: 'warn', text: `За 7 дней выполнено ${factSessions} из ${plannedSessions} тренировок плана. Пропуски складываются в стагнацию: переносите день, не сливайте объём.` });
    } else {
      execItems.push({ id: 'exec-ok', severity: 'info', text: `Частота за 7 дней: ${factSessions} из ${plannedSessions} — держите ритм.` });
    }
  }
  const rir = lastAvgRir(historyWorkouts);
  if (rir != null) {
    if (rir < 0.5) execItems.push({ id: 'exec-rir-hard', severity: 'warn', text: `Последняя тренировка: средний RIR ${rir.toFixed(1)} — работаете в отказ слишком часто. Оставляйте 1-2 повтора в запасе на рабочих сетах, иначе ЦНС/суставы ответят стагнацией.` });
    else if (rir > 3) execItems.push({ id: 'exec-rir-easy', severity: 'info', text: `Последняя тренировка: средний RIR ${rir.toFixed(1)} — слишком легко. Для гипертрофии рабочие сеты: RIR 1-2. Доведите вес до планового.` });
    else execItems.push({ id: 'exec-rir-ok', severity: 'info', text: `RIR ${rir.toFixed(1)} на последней сессии — в целевом диапазоне (1-2).` });
  }
  if (acwr != null) {
    if (acwr > 1.5) execItems.push({ id: 'exec-acwr', severity: 'critical', text: `ACWR ${acwr.toFixed(2)} (>1.5) — нагрузка растёт быстрее восстановления: снизьте объём на 15-20% на неделю или вставьте лёгкую сессию.` });
    else if (acwr < 0.8) execItems.push({ id: 'exec-acwr-low', severity: 'info', text: `ACWR ${acwr.toFixed(2)} (<0.8) — недогрузка: окно для прогрессии, добавляйте по плану.` });
  }
  if (readiness?.lastRecovery != null && readiness.lastRecovery < 60) {
    execItems.push({ id: 'exec-readiness', severity: 'warn', text: `Готовность ${Math.round(readiness.lastRecovery)}% (<60) — сегодня снизьте объём на 10-15%, RIR +1 к плановому.` });
  }
  if (lastSleepHours != null && lastSleepHours < 6) {
    execItems.push({ id: 'exec-sleep', severity: 'warn', text: `Сон ${lastSleepHours} ч — менее 6 ч: тренировка будет слабее, восстановление хуже. Приоритет: лечь раньше, тренировку — по самочувствию.` });
  }
  sections.push({ id: 'execution', title: 'Выполнение и прогрессия', icon: '📈', items: execItems });

  return sections;
}

/** Сводка: количество предупреждений по секциям (для UI-заголовка). */
export function bbRecSummary(sections: BBRecSection[]): { total: number; warns: number; criticals: number } {
  const all = sections.flatMap(s => s.items);
  return {
    total: all.length,
    warns: all.filter(i => i.severity === 'warn').length,
    criticals: all.filter(i => i.severity === 'critical').length,
  };
}

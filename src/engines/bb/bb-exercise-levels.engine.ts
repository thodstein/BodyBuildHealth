/**
 * bb-exercise-levels.engine.ts — минимальный уровень атлета для упражнения.
 *
 * Проблема: тиры (`bb-exercise-tier`) меряют ЭКЗОТИЧНОСТЬ, а не уровень —
 * штанговый присед/становая/гудморнинг это tier 1–2 и едут даже новичкам.
 * Поле `difficulty` в каталоге есть (590 записей), но отбор его игнорирует
 * (только мягкий скоринг −10/+5, который почти никогда не решает).
 *
 * Решение: жёсткий гейт по minLevel (наука и практика):
 *  - Kompf et al. 2022 (Delphi, PMC11873903): 41 упражнение ок новичкам,
 *    отбор по технической сложности low/moderate/high;
 *  - NSCA PTQ 2023: новичкам — низкая сложность (опора: сидя/лёжа/тренажёр,
 *    билатеральные), дальше свободные веса, затем унилатеральные;
 *  - Aerenhouts 2020 (RCT): тренажёры ≈ свободные веса у новичков, переход
 *    «тренажёры → свободные» без отката — старт на тренажёрах не ущерб;
 *  - лесенки: присед вес тела → гоблет → фронт → задний (StrengthLog);
 *    hinge dowel/стена → гиря сумо → трап-гриф → RDL → классика с пола
 *    (OPEX, StrongFirst); тяга австралийские → негативы/резина → строгие
 *    → +вес (вес только после ~10 строгих).
 *
 * beginner видит только beginner; intermediate — beginner+intermediate;
 * advanced/enhanced — всё (минус тиры как раньше). Без флага-опции:
 * это фикс безопасности, дефолт для всех. Явный выбор пользователя
 * (избранное, своп, source цикла/программы) гейт не трогает.
 */

import { isAxialLoadExercise } from '../exercise-selector.engine';
import { isMobilityRestricted } from './bb-mobility.engine';

export type BBMinLevel = 'beginner' | 'intermediate' | 'advanced';

const LEVEL_RANK: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2, enhanced: 3 };
const MIN_RANK: Record<BBMinLevel, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/**
 * ЖЁСТКИЙ СПИСОК (ядро гейта): движения, запрещённые новичку И любителю.
 * Критерий: высокая техническая сложность + осевая/взрывная нагрузка
 * (спина/суставы дороже прогрессии). Остальное intermediate из каталога
 * любителю разрешено (ACSM 2009: новички/любители — многосуставные со
 * свободными весами 60–70% 1RM; опасность — в скилл-движениях, не в железе).
 */
const ADVANCED_ID = new Set([
  // Штанговый присед под нагрузкой (регрессии: гоблет/жим ногами/сплит).
  'squat_bar', 'squat_back', 'squat_lowbar',
  // Фронт/оверход (мобильность запястий/торакалки) — в каталоге advanced, дубль для надёжности.
  'front_squat', 'front_squat_v2', 'front_squat_v3', 'front_squat_clean', 'front_squat_clean_grip',
  'overhead_squat', 'overhead_squat_v2', 'snatch_balance',
  // Тяга с пола и тяжёлые hinge (регрессии: трап-гиря/RDL/гиперэкстензия).
  'deadlift', 'sumo_dl', 'sumo_dl_v2', 'deadlift_stiff_leg', 'deadlift_deficit',
  'deadlift_snatch_grip', 'paused_deadlift', 'car_deadlift_18', 'deadlift_hold',
  // Швунг/жимовой швунг (взрывной оверхед).
  'push_press', 'push_press_jerk',
  // Пистолетик и родственники (одноногие скилл-движения).
  'pistol_squat', 'shrimp_squat', 'cossack_squat',
  // Плиометрика (NSCA: не новичкам).
  'jump_squat', 'jump_lunge', 'squat_jump_banded', 'squat_jump',
  // Взвешенные скилл-движения уже advanced в каталоге (belt-and-braces).
  'pullup_weighted', 'chinup_weighted', 'sissy_squat_weighted',
]);

const ADVANCED_NAME_RE =
  /присед.*штанг.*спин|back.?squat|фронт.*присед|front.?squat|good.?morning|гудморнинг|пистолет|pistol|креветк|shrimp|казац|cossack|подъём.*турец|tgu/i;
const PLYO_RE = /прыг|jump/i;
const BANDED_RE = /banded|резин/i;

/** Раньше каталога: доказанно щадящие (исследования выше). */
const BEGINNER_IDS = new Set([
  'deadlift_trapbar', // трап-гриф: короткий рычаг на позвоночник, forgiving hinge
  'row_inverted', // австралийские: supported horizontal pull (NSCA ранний шаг)
]);

/** Лесенки регрессий: сложное → более простые (id из каталога, проверены). */
export const LEVEL_REGRESSIONS: Record<string, string[]> = {
  squat_bar: ['goblet_squat', 'leg_press', 'squat_split'],
  squat_back: ['goblet_squat', 'leg_press', 'squat_split'],
  squat_lowbar: ['goblet_squat', 'leg_press', 'squat_split'],
  front_squat: ['goblet_squat', 'leg_press', 'squat_split'],
  deadlift: ['deadlift_trapbar', 'rdl_db', 'hyperextension'],
  sumo_dl: ['deadlift_trapbar', 'rdl_db', 'hyperextension'],
  good_morning: ['rdl_db', 'hyperextension', 'banded_good_morning'],
  pullup: ['pulldown', 'pulldown_wide', 'row_inverted', 'dead_hang'],
  pullup_neutral: ['pulldown_rev', 'row_inverted', 'dead_hang'],
  chinup: ['pulldown_rev', 'row_inverted', 'dead_hang'],
  dips_chest: ['bench_dips', 'pushup_incline', 'pushup'],
  dips_tricep: ['tricep_bench_dip', 'pushup_incline', 'pushup'],
  ohp: ['ohp_smith', 'landmine_press_shoulder', 'machine_chest_press'],
  ohp_bar: ['ohp_smith', 'landmine_press_shoulder', 'machine_chest_press'],
  bench_bar: ['machine_chest_press', 'pushup_incline', 'pushup'],
  row_bar: ['row_db', 'seated_row', 'row_inverted'],
  pistol_squat: ['squat_split', 'curtsy_lunge', 'lunge_reverse'],
  overhead_squat: ['goblet_squat', 'ohp_smith', 'squat_split'],
};

/** Минимальный уровень упражнения (каталог + оверрайды выше). */
export function minLevelFor(ex: { id?: string; name?: string; difficulty?: string }): BBMinLevel {
  const id = String((ex as any)?.id || '').toLowerCase();
  const nm = String((ex as any)?.name || '');
  if (ADVANCED_ID.has(id) && !BANDED_RE.test(id)) return 'advanced';
  if (!BANDED_RE.test(id) && !BANDED_RE.test(nm) && (ADVANCED_NAME_RE.test(nm) || ADVANCED_NAME_RE.test(id))) return 'advanced';
  if (PLYO_RE.test(id) || PLYO_RE.test(nm)) return 'advanced';
  if (BEGINNER_IDS.has((ex as any)?.id) || BEGINNER_IDS.has(id)) return 'beginner';
  const d = String((ex as any)?.difficulty || '').toLowerCase();
  if (d === 'beginner') return 'beginner';
  if (d === 'advanced') return 'advanced';
  if (d === 'intermediate') return 'intermediate';
  return 'intermediate';
}

/** Доступен ли снаряд уровню (enhanced наследует advanced — PED ≠ скилл). */
export function isLevelAllowed(userLevel: string | undefined, ex: { id?: string; name?: string; difficulty?: string }): boolean {
  const rank = LEVEL_RANK[String(userLevel || '').toLowerCase()];
  if (rank === undefined) return true;
  return rank >= MIN_RANK[minLevelFor(ex)];
}

/** Жёсткий бан: входит ли в HARD-список (вне зависимости от каталога). */
export function isHardAdvanced(ex: { id?: string; name?: string }): boolean {
  const id = String((ex as any)?.id || '').toLowerCase();
  const nm = String((ex as any)?.name || '');
  if (ADVANCED_ID.has(id) && !BANDED_RE.test(id)) return true;
  if (!BANDED_RE.test(id) && !BANDED_RE.test(nm) && ADVANCED_NAME_RE.test(nm)) return true;
  if (!BANDED_RE.test(id) && !BANDED_RE.test(nm) && ADVANCED_NAME_RE.test(id)) return true;
  if (PLYO_RE.test(id) || PLYO_RE.test(nm)) return true;
  return false;
}

/** Точечный гейт: новичку и любителю запрещён только HARD-список.
 *  Используется в weak-optional добивке. Пул отбора НЕ трогаем (полный
 *  minLevel-гейт пула душил отбор и рвал объёмы — доказано матрицей);
 *  опасное из отбора и поздних проходов вычищает swap-backstop
 *  финализатора. Intermediate-движения разрешены всем по ACSM 2009. */
export function isPoolAllowed(userLevel: string | undefined, ex: { id?: string; name?: string; difficulty?: string }): boolean {
  const rank = LEVEL_RANK[String(userLevel || '').toLowerCase()];
  if (rank === undefined || rank >= 2) return true;
  return !isHardAdvanced(ex);
}

/** Ранг-гейт для пулов с релаксом (пустой пул новичка → intermediate, но никогда advanced). */
export function maxLevelRankFor(userLevel: string | undefined, relaxed: boolean): number {
  const rank = LEVEL_RANK[String(userLevel || '').toLowerCase()];
  if (rank === undefined) return 3;
  if (rank >= 2) return 3;
  return relaxed ? 1 : rank;
}

/** Допуск по рангу (внутреннее; isLevelAllowed — публичная обёртка). */
export function isLevelAllowedRank(ex: { id?: string; name?: string; difficulty?: string }, maxRank: number): boolean {
  return MIN_RANK[minLevelFor(ex)] <= maxRank;
}

/** Регрессии якоря (id проще → сложные), только существующие в каталоге фильтрует вызывающий. */
export function regressionFor(exerciseId: string): string[] {
  return LEVEL_REGRESSIONS[exerciseId] || [];
}

/** Коэффициент пересчёта веса при замене (прецедент safety-replacement):
 *  штанга 1.0, Смит 0.9, машина 0.85, гантели/гиря 0.8, кабель 0.8, свой вес 0.7. */
const EQUIP_LOAD_RATIO: Record<string, number> = {
  barbell: 1, smith: 0.9, machine: 0.85, dumbbell: 0.8, kettlebell: 0.8, cable: 0.8, bodyweight: 0.7,
};

function equipOfName(name: string): string {
  const v = (name || '').toLowerCase();
  if (/гантел|dumbbell/.test(v)) return 'dumbbell';
  if (/штанг|barbell|гриф/.test(v)) return 'barbell';
  if (/тренаж|машин|smith|смит/.test(v)) return 'machine';
  if (/блок|кроссовер|кабел|трос|cable/.test(v)) return 'cable';
  if (/свой вес|собственн|bodyweight|подтяг|отжим/.test(v)) return 'bodyweight';
  return 'other';
}

export interface LevelSwapCtx {
  equipment?: string[];
  excludedIds?: string[];
  /** Алиас excludedIds (имя поля BBFinalizeOptions). */
  excludedExercises?: string[];
  usedNames?: Set<string> | string[];
  mobilityRestrictions?: string[];
  avoidAxialLoad?: boolean;
  /** Истинная мышца цели (дефолт — trueMuscleOf кандидата/исходника). */
  trueMuscle?: string;
}

/**
 * Замена упражнения на разрешённое уровню с сохранением мышцы:
 * сначала явные регрессии якоря, затем любое разрешённое той же истинной
 * мышцы (канон/машина/кабель приоритетнее гири/ match по имени).
 * Возвращает null, если менять не на что (вызывающий держит исходник —
 * объём не трогаем никогда).
 */
export function swapExerciseForLevel(
  exercise: { id?: string; name?: string },
  userLevel: string,
  trueMuscleOfFn: (ex: any) => string | null,
  catalog: Array<{ id?: string; name?: string; type?: string; equipment?: any }>,
  ctx: LevelSwapCtx = {},
): { name: string; loadRatio: number } | null {
  const used: Set<string> = ctx.usedNames instanceof Set
    ? ctx.usedNames
    : new Set(ctx.usedNames || []);
  const equipOk = (c: any): boolean => {
    if (mobilityBlocked(c)) return false;
    const excl = [...(ctx.excludedIds || []), ...((ctx as any).excludedExercises || [])];
    if (excl.includes(c.id) || excl.includes(c.name)) return false;
    if (ctx.avoidAxialLoad && isAxialLoadLike(c)) return false;
    if (ctx.equipment?.length) {
      const eq = Array.isArray(c.equipment) ? c.equipment : [String(c.equipment || '')];
      if (eq.length && !eq.includes('bodyweight') && !eq.some((e: string) => ctx.equipment!.includes(e))) return false;
    }
    return true;
  };
  const mobilityBlocked = (c: any): boolean => {
    try { return !!ctx.mobilityRestrictions?.length && isMobilityRestricted(c, ctx.mobilityRestrictions); }
    catch { return false; }
  };
  const isAxialLoadLike = (c: any): boolean => {
    try { return !!ctx.avoidAxialLoad && isAxialLoadExercise(c); }
    catch { return false; }
  };
  const targetMuscle = ctx.trueMuscle || (() => { try { return trueMuscleOfFn(exercise) || ''; } catch { return ''; } })();
  // 1. Явные регрессии якоря.
  const regs = regressionFor(String((exercise as any)?.id || ''));
  for (const rid of regs) {
    const cand = catalog.find(c => (c as any).id === rid);
    if (!cand || used.has(String((cand as any).name))) continue;
    if (!isLevelAllowed(userLevel, cand as any)) continue;
    if (!equipOk(cand)) continue;
    if (targetMuscle && (() => { try { return trueMuscleOfFn(cand); } catch { return ''; } })() !== targetMuscle) continue;
    return { name: String((cand as any).name), loadRatio: loadRatioFor(exercise, cand) };
  }
  // 2. Любое разрешённое той же мышцы (стабильный порядок каталога — детерминизм).
  const pool = catalog.filter(c => {
    if (used.has(String((c as any).name))) return false;
    try { if (targetMuscle && trueMuscleOfFn(c) !== targetMuscle) return false; } catch { return false; }
    if (!isLevelAllowed(userLevel, c as any)) return false;
    return equipOk(c);
  });
  // Канон/машина/кабель раньше гири и экзотики.
  const rankEquip = (c: any): number => {
    const e = String((c as any).equipment || '').toLowerCase();
    if (/barbell|dumbbell/.test(e)) return 0;
    if (/machine|smith|cable/.test(e)) return 1;
    return 2;
  };
  pool.sort((a, b) => rankEquip(a) - rankEquip(b));
  const best = pool[0];
  if (!best) return null;
  return { name: String((best as any).name), loadRatio: loadRatioFor(exercise, best) };
}

function equipKey(ex: any): string {
  const raw = (ex as any)?.equipment;
  const arr = Array.isArray(raw) ? raw : (raw ? [String(raw)] : []);
  const known = arr.map(e => String(e).toLowerCase()).find(e => EQUIP_LOAD_RATIO[e] != null);
  if (known) return known;
  return equipOfName(String((ex as any)?.name || ''));
}

function loadRatioFor(from: any, to: any): number {
  const r = (EQUIP_LOAD_RATIO[equipKey(to)] || 1) / (EQUIP_LOAD_RATIO[equipKey(from)] || 1);
  return Math.round(r * 100) / 100;
}

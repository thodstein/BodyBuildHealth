import type { FoodItem } from '../../../../core/nutrition-database';

/**
 * РЕЕСТР РЕАЛИЗМА ПРОДУКТОВ (эпик A, «профессиональный планировщик»)
 * ─────────────────────────────────────────────────────────────────────
 * Задача: генератор плана не должен класть в тарелку то, чего нет в
 * обычном супермаркете РФ, и то, что не является едой (добавки, специи,
 * травы-приправы). Три уровня доступности:
 *  - 'core'      — любой супермаркет/рынок (по умолчанию для всех, не перечисленных ниже);
 *  - 'specialty' — спортпит/healthy-магазины/заморозка (годжи, спирулина и т.п.) —
 *                  в автопланы НЕ попадают, только если пользователь добавил в любимые;
 *  - 'exotic'    — недоступно/не едят в РФ — исключено из генерации полностью.
 *
 * Правило правки: добавляй id в списки ниже; незнакомый id = 'core'.
 */

// ─── 1. Экзотика: из генерации полностью ──────────────────────────────
export const EXOTIC_FOOD_IDS: ReadonlySet<string> = new Set([
  // моллюски/деликатесы, которых нет в рознице
  'seafood_geoduck', 'seafood_conch', 'whelk', 'protein_whelk', 'seafood_abalone',
  'seafood_sea_urchin', 'seafood_lobster', 'seafood_oysters',
  // P1a: улитки-эскарго — деликатес, не тарелка автоплана (лезли в предтрен).
  'escargot', 'exotic_escargots', 'snails', 'seafood_snails',
  // фрукты
  'fruit_cherimoya', 'fruit_jackfruit', 'fruit_jackfruit_fresh', 'fruit_durian_fresh',
  'fruit_lychee', 'fruit_lychee_fresh', 'fruit_rambutan', 'fruit_rambutan_fresh',
  'fruit_mangosteen_fresh', 'fruit_starfruit', 'fruit_soursop', 'fruit_ugli_fruit',
  'fruit_passion_fruit', 'fruit_dragonfruit', 'fruit_medlar', 'fruit_acai',
  'fruit_goji_berries', 'fruit_goji_dried', 'fruit_pawpaw', 'fruit_sapodilla',
  'fruit_boysenberry', 'fruit_cloudberry', 'fruit_loganberry', 'fruit_elderberry',
  'berry_boysenberry', 'berry_cloudberry', 'berry_loganberry', 'berry_elderberry', 'berry_acerola',
  'berry_golden_berry', 'fruit_cactus_pear', 'fruit_cornelian_cherry_dogwood', 'fruit_mulberry',
  'root_scorzonera', 'root_lotus_root', 'dried_papaya',
  // овощи
  'veg_jicama', 'veg_jicama_mexican', 'veg_purslane', 'veg_bamboo_shoots_canned',
  'veg_collard_greens', 'veg_okra', 'veg_samphire',
  // орехи/семена
  'nut_kukui', 'nut_pili', 'nut_hickory', 'nut_brazil', 'seed_coriander', 'seed_fennel', 'fennel_seeds',
  'tiger_nuts', 'mustard_seeds',
  // субпродукты-диковины (печень оставляем — классика ББ)
  'lamb_kidney', 'lamb_kidney_organ', 'beef_kidney', 'beef_kidney_cooked', 'pork_kidney',
  'meat_heart_tripe', 'meat_brain', 'meat_sweetbread', 'meat_tongue',
  // крупы-диковины и джанк-лапша
  'grain_freekeh', 'grain_kamut', 'grain_einkorn', 'grain_teff', 'grain_sorghum', 'cereal_sorghum',
  'grain_glutinous_rice', 'pasta_ramen', 'legume_pigeon_pea',
  // масла-джанк (не для тарелки автогенерации)
  'oil_palm', 'oil_cocoa', 'butter_cocoa', 'sauce_cheese', 'cheese_sauce', 'sauce_cheddar',
  'duck_fat', 'oil_chili', 'flaxseed_oil', 'avocado_oil',
  // рыба-диковина
  'crucian',
  // прочее
  'meat_ostrich', 'meat_kangaroo', 'meat_alligator', 'meat_bison_ribeye',
]);

// ─── 2. Specialty: только по явному предпочтению пользователя ─────────
export const SPECIALTY_FOOD_IDS: ReadonlySet<string> = new Set([
  'wakame', 'seaweed_nori', 'spirulina', 'chlorella', 'moringa',
  'fruit_papaya', 'fruit_feijoa', 'fruit_pomelo', 'fruit_kumquat',
  'veg_chard', 'veg_radicchio', 'veg_watercress', 'veg_artichoke_globe',
  'grain_quinoa_puffed', 'quinoa_flakes', 'amaranth_grain', 'teff_grain',
  'spelt_bread', 'khorasan_pasta', 'lentil_pasta', 'chickpea_pasta',
  'bison_ground', 'venison_steak', 'boar_meat',
  'fruit_mangosteen', 'fruit_pitaya', 'fruit_longan',
  'oil_mct', 'supp_mct_powder', 'fat_goose', 'goose_fat', 'oil_ghee', 'butter_ghee',
]);

// ─── 3. Травы и специи: приправы, не тарелка ──────────────────────────
export function isHerbSpiceId(id: string): boolean {
  if (!id) return false;
  if (id.startsWith('herb_')) return true;
  if (id.startsWith('spice_')) return true;
  if (/^(seed|seeds)_?(fennel|anise|caraway|cumin|coriander|mustard|dill|celery)$/.test(id)) return true;
  return id === 'veg_garlic' || id === 'veg_ginger' || id === 'veg_horseradish'
    || id === 'veg_samphire' || id === 'veg_parsley' || id === 'seed_dill' || id === 'dill_seeds';
}

// ─── 4. Добавки: не еда ───────────────────────────────────────────────
/** Спортпит, легально попадающий в приёмы (белковые порошки/углеводные окна). */
export const MEAL_LEGAL_SUPPLEMENT_IDS: ReadonlySet<string> = new Set([
  // белковые порошки
  'whey_protein', 'whey_isolate', 'whey_concentrate', 'casein', 'casein_micellar',
  'supp_hydrolyzed_whey', 'supp_goat_whey', 'supp_beef_protein', 'supp_beef_protein_iso',
  'supp_egg_protein', 'supp_egg_white_powder', 'supp_soy_isolate', 'supp_pea_protein',
  'supp_pea_protein_iso', 'supp_rice_protein', 'supp_hemp_protein', 'supp_pumpkin_protein',
  'supp_collagen_peptides', 'collagen_hydrolysate', 'supp_collagen_hydro', 'supp_gelatin',
  'supp_bone_broth_protein',
  // углеводные окна / аминокислоты
  'supp_eaa', 'bcaa', 'aminos_complex', 'amylopectin', 'dextrose', 'isotonic',
  'maltodextrin', 'vitargo', 'cyclic_dextrin',
  // батончики как перекус (кап по SUPPLEMENT_MAX_G)
  'protein_bar', 'bar_protein',
]);

/** Все остальные category === 'supplement' — НЕ еда (креатин/витамины/стимуляторы/…).
 *  Если передана category не-'supplement' — это обычный продукт (не добавка). */
export function isPureSupplementId(id: string, category?: string): boolean {
  if (category && category !== 'supplement') return false;
  if (!id) return false;
  return !MEAL_LEGAL_SUPPLEMENT_IDS.has(id);
}

/** id, которые считаются «протеиновым порошком» для дневного лимита. */
const POWDER_PROTEIN_IDS: ReadonlySet<string> = new Set([
  'whey_protein', 'whey_isolate', 'whey_concentrate', 'casein', 'casein_micellar',
  'supp_hydrolyzed_whey', 'supp_goat_whey', 'supp_beef_protein', 'supp_beef_protein_iso',
  'supp_egg_protein', 'supp_egg_white_powder', 'supp_soy_isolate', 'supp_pea_protein',
  'supp_pea_protein_iso', 'supp_rice_protein', 'supp_hemp_protein', 'supp_pumpkin_protein',
  'supp_mass_gainer', 'mass_gainer', 'egg_white_dried', 'egg_white_powder', 'egg_protein_dried',
  'milk_powder_full', 'milk_powder_skim',
]);

export function isProteinPowderId(id: string): boolean {
  return POWDER_PROTEIN_IDS.has(id);
}

// ─── 5. Семейства «стейплов» для дневной ротации ──────────────────────
/** Продукт → семейство (гарнир/жир/фрукт), чтобы один и тот же вид не повторялся в каждом приёме. */
export function stapleFamilyOf(id: string): string | null {
  if (!id) return null;
  // крупы/гарниры
  if (/oat|hercules|porridge/.test(id)) return 'oats';
  if (/^rice|rice_/.test(id) && !/cake/.test(id)) return 'rice';
  if (/buckwheat|grechka/.test(id)) return 'buckwheat';
  if (/pasta|noodle|spaghetti|macaroni/.test(id)) return 'pasta';
  if (/potato/.test(id)) return 'potato';
  if (/bulgur|couscous|quinoa|millet|barley|pearl|polenta|corn_grits|cereal|muesli|granola/.test(id)) return 'other_grain';
  if (/bread/.test(id)) return 'bread';
  // орехи/семена
  if (/nut|almond|walnut|cashew|pistachio|hazelnut|funduk|pecan|macadamia|peanut/.test(id)) return 'nuts';
  if (/seed|chia|flax|lin_|sesame|poppy|hemp_seed|pumpkin_seed|sunflower/.test(id)) return 'seeds';
  // масла/жирные добавки
  if (/oil|mct|mayonnaise|mayo_/.test(id)) return 'oils';
  // фрукты считаются на уровне роли, не семейства
  return null;
}

export const EXCLUDED_FAMILIES_FROM_PLATE: ReadonlySet<string> = new Set(['oils_mayonnaise']);

// ─── 6. Гейт доступности для пулов генератора ─────────────────────────
/**
 * Может ли продукт попасть в автогенерируемую тарелку.
 * @param preferredIds любимые продукты пользователя (specialty разрешён, exotic — нет)
 */
export function foodAvailableForPlan(f: { id: string }, preferredIds?: Set<string>): boolean {
  const id = f.id || '';
  if (EXOTIC_FOOD_IDS.has(id)) return false; // экзотика — никогда (даже в любимых не предлагаем в авто-план)
  if (SPECIALTY_FOOD_IDS.has(id) && !(preferredIds && preferredIds.has(id))) return false;
  return true;
}

/** Дневные квоты реалистичной тарелки (эпик B). */
export interface DailyQuotaState {
  powderMeals: number;      // приёмы с протеиновым порошком
  familyUses: Map<string, number>; // семейство → число приёмов
  familyGrams: Map<string, number>; // семейство → сумма граммов за день
  fruitMeals: number;       // приёмы с фруктом
  eggWhGrams: number;       // суммарные граммы яиц (egg_whole)
  /** B8 (Эпик B): масштаб грамм-лимитов от веса (80 кг = 1.0, кламп 0.75–1.6).
   *  120+ кг атлет на 5000+ ккал не должен упираться в орехово-масляный потолок 80-кг атлета. */
  weightScale: number;
}

/** B8: масштаб квот от веса. Без веса/некорректный вес → 1.0 (обратно-совместимо). */
export function quotaWeightScale(weightKg?: number): number {
  const w = Math.max(0, Number(weightKg) || 0);
  if (!w) return 1;
  return Math.max(0.75, Math.min(1.6, w / 80));
}

export function createDailyQuota(weightKg?: number): DailyQuotaState {
  return { powderMeals: 0, familyUses: new Map(), familyGrams: new Map(), fruitMeals: 0, eggWhGrams: 0, weightScale: quotaWeightScale(weightKg) };
}

// ── Лимиты (доказательная база: см. план «Профессиональный планировщик») ──
export const QUOTA_LIMITS = {
  /** Максимум приёмов с протеиновым порошком в день (postw + presleep/перекус). */
  maxPowderMeals: 2,
  /** Одно семейство гарнира не чаще N приёмов в день (рис на обед + пост-трен — норма ББ;
   *  3 для не-овсяных — иначе большие цели по углеводам недосдаются). */
  maxFamilyMeals: 3,
  /** Овсяное семейство разрешено 2 приёма (завтрак + перекус) — это завтрак-стейпл. */
  maxOatsFamilyMeals: 2,
  /** Орехи/семена: максимум приёмов и граммов в день (2 приёма × ~20 г + Mg-доза pre-sleep). */
  maxNutMeals: 2, maxNutsGramsPerDay: 60,
  /** Масла/жирные заправки: максимум приёмов в день и суммарных граммов. */
  maxOilMeals: 2, maxOilGramsPerDay: 25,
  /** Фрукты: максимум приёмов в день (3 + melatonin-порция pre-sleep). */
  maxFruitMeals: 4,
  /** Яйца целиком: максимум граммов в день (~4 шт). */
  maxEggWholeGramsPerDay: 230,
} as const;

/**
 * Семейства, заблокированные для СЛЕДУЮЩЕГО приёма с учётом уже собранного дня.
 * Возвращает Set id-шных паттернов — движок фильтрует пулы по foodAvailableWithQuota().
 */
export function blockedIdsForNextMeal(q: DailyQuotaState, nextMealType: string): Set<string> {
  const blocked = new Set<string>();
  // B8: грамм-лимиты масштабируются от веса атлета (приём-лимиты — нет).
  const sc = (q as DailyQuotaState).weightScale || 1;
  const nutCapG = Math.round(QUOTA_LIMITS.maxNutsGramsPerDay * sc);
  const oilCapG = Math.round(QUOTA_LIMITS.maxOilGramsPerDay * sc);
  const eggCapG = Math.round(QUOTA_LIMITS.maxEggWholeGramsPerDay * sc);
  // Один слот порошка резервируется под post-workout (трен-день) — перекусы не съедают оба.
  const _powderCap = nextMealType === 'postworkout' ? QUOTA_LIMITS.maxPowderMeals : QUOTA_LIMITS.maxPowderMeals - 1;
  if (q.powderMeals >= _powderCap) {
    for (const id of POWDER_PROTEIN_IDS) blocked.add(id);
  }
  const familyMealCap = (fam: string) => (fam === 'oats' ? QUOTA_LIMITS.maxOatsFamilyMeals : QUOTA_LIMITS.maxFamilyMeals);
  for (const [fam, uses] of q.familyUses) {
    const cap = fam === 'nuts' || fam === 'seeds' ? QUOTA_LIMITS.maxNutMeals
      : fam === 'oils' ? QUOTA_LIMITS.maxOilMeals
      : familyMealCap(fam);
    if (uses >= cap) markFamilyBlocked(blocked, fam);
  }
  const nutGrams = (q.familyGrams.get('nuts') || 0) + (q.familyGrams.get('seeds') || 0);
  if (nutGrams >= nutCapG) { markFamilyBlocked(blocked, 'nuts'); markFamilyBlocked(blocked, 'seeds'); }
  if ((q.familyGrams.get('oils') || 0) >= oilCapG) markFamilyBlocked(blocked, 'oils');
  if (q.fruitMeals >= QUOTA_LIMITS.maxFruitMeals) blocked.add('__ALL_FRUIT__');
  if (q.eggWhGrams >= eggCapG) blocked.add('egg_whole');
  void nextMealType;
  return blocked;
}

function markFamilyBlocked(blocked: Set<string>, fam: string) {
  blocked.add(`__FAM__${fam}`);
}

/** Проверка конкретного продукта против блок-листа следующего приёма. */
export function foodAvailableWithQuota(
  f: { id: string; category?: string; carbs?: number; fiber?: number },
  blocked: Set<string>,
  allowIds?: Set<string>,
): boolean {
  const id = f.id || '';
  if (allowIds && allowIds.has(id)) return true;
  if (blocked.has(id)) return false;
  if (blocked.has('__ALL_FRUIT__') && f.category === 'veg_fruit' && (f.carbs || 0) >= 8 && (f.fiber || 0) >= 1.5) return false;
  for (const b of blocked) {
    if (b.startsWith('__FAM__') && stapleFamilyOf(id) === b.slice(7)) return false;
  }
  return true;
}

/** Регистрация собранного приёма в дневных квотах. */
export function registerMealInQuota(q: DailyQuotaState, items: { id?: string; amount: number; role?: string; category?: string; carbs?: number; fiber?: number }[]): { usedPowder: boolean; usedFruit: boolean } {
  let usedPowder = false, usedFruit = false;
  const famsTouched = new Map<string, number>();
  for (const it of items) {
    const id = it.id || '';
    const fam = stapleFamilyOf(id);
    if (fam) {
      famsTouched.set(fam, (famsTouched.get(fam) || 0) + 1);
      q.familyGrams.set(fam, (q.familyGrams.get(fam) || 0) + it.amount);
    }
    if (isProteinPowderId(id)) usedPowder = true;
    if (id === 'egg_whole') q.eggWhGrams += it.amount;
    if (it.role === 'fruit' || (it.category === 'veg_fruit' && (it.carbs || 0) >= 8 && (it.fiber || 0) >= 1.5 && !fam)) usedFruit = true;
  }
  if (usedPowder) q.powderMeals += 1;
  if (usedFruit) q.fruitMeals += 1;
  for (const [fam] of famsTouched) {
    q.familyUses.set(fam, (q.familyUses.get(fam) || 0) + 1);
  }
  return { usedPowder, usedFruit };
}

/**
 * Итоговый гейт «продукт может войти в автотарелку»:
 * доступность (эпик A) + квоты дня (эпик B).
 */
export function foodPlannable(
  f: { id: string; category?: string; carbs?: number; fiber?: number },
  opts: { preferredIds?: Set<string>; blocked?: Set<string>; allowIds?: Set<string> } = {},
): boolean {
  if (!foodAvailableForPlan(f, opts.preferredIds)) return false;
  if (opts.blocked && !foodAvailableWithQuota(f, opts.blocked, opts.allowIds)) return false;
  return true;
}

// ─── B3/B8 (Эпик B): единые катчелл-потолки ──────────────────────────────
// Раньше лимит орехов существовал в ТРЁХ вариантах (квота 60 / катчелл 70 / тест 75),
// масел — в двух (25/30). Теперь катчелл = квота × масштаб веса + фиксированный запас
// (пост-коррекции идут мимо квот, запас нужен на сведение ≤3%).
/** Катчелл-потолок орехов/семян за день (г). */
export function nutCatchupCap(weightScale: number): number {
  return Math.round(QUOTA_LIMITS.maxNutsGramsPerDay * (weightScale || 1)) + 10;
}
/** Катчелл-потолок масел за день (г). */
export function oilCatchupCap(weightScale: number): number {
  return Math.round(QUOTA_LIMITS.maxOilGramsPerDay * (weightScale || 1)) + 5;
}
/** Катчелл-потолок цельных яиц за день (г). */
export function eggCatchupCap(weightScale: number): number {
  return Math.round(QUOTA_LIMITS.maxEggWholeGramsPerDay * (weightScale || 1)) + 10;
}

// ─── Итерация C (HIGH-VOLUME): инсулин-окна как peri ───────────────────────
// Болюс-окно (`⚡ Углеводы под инсулин`) типизировано как 'snack' (исторически),
// но физиологически это фиксированное окно: dose×10 быстрых У, жиры 0.
// Маркер закрывает его для всех коррекций/ребалансов/вторых рецептов — как peri.
/** Маркер инсулин-окна на объекте приёма (тип остаётся 'snack' для совместимости UI). */
export const INSULIN_WINDOW_MARK = '_insulinWindow';
/** true для peri-окон (pre/post/intra/presleep) и инсулин-окон. */
export function isPeriLikeMeal(m: { type?: string } | null | undefined): boolean {
  if (!m) return false;
  const t = String((m as any).type || '');
  if (t === 'preworkout' || t === 'postworkout' || t === 'intra' || t === 'presleep') return true;
  return (m as any)[INSULIN_WINDOW_MARK] === true;
}

// ─── Центральные баны гарниров (единая точка для ВСЕХ путей добора) ─────────
// Иначе каждый путь (primary/посадка/dense/корректор/рецепт) ведёт свой список
// и новый мусор (фунчоза, перловка, батат в завтраке) пролезает через забытый путь.
// Источник: интернет-практика высокоуровневых дней — рис/крем/хлопья/хлеб/паста,
// остальное (перловка/гречка/киноа/батат/крахмалы/мука) — объём/клетчатка/ЖКТ.
/** HV-степлы вне сборки: объёмные/клетчаточные/ингредиенты (перловка/гречка/киноа/батат/крахмал/мука). */
export const HV_STAPLE_BAN: ReadonlySet<string> = new Set([
  'buckwheat', 'barley', 'grain_barley_pearl', 'quinoa', 'quinoa_flakes', 'grain_quinoa_flakes',
  'oat_bran', 'grain_oat_bran', 'rice_bran', 'grain_rice_bran', 'wheat_bran', 'sweet_potato',
  'grain_tapioca_starch', 'grain_arrowroot_starch', 'grain_coconut_flour',
]);
/** true если гарнир запрещён в HV-сборке (объём/клетчатка/ингредиент). */
export function isHvStapleBanned(id: string): boolean {
  if (!id) return false;
  return HV_STAPLE_BAN.has(id);
}
/** В завтраке никогда: макароны/лапша/кус-кус + HV-объёмные (батат/перловка/киноа/крахмал).
 * PRO-типология (все дни, не только HV): картошка/рис-гарнир/фунчоза в завтраке — мусорная
 * корзина (кейсы MC3: potato_baked 150г в творог; P60: glass_noodles в обед + potato ведром).
 * Завтрак = овсяная семья (oats/corn_flakes/cream_of_rice/rice_cream/muesli/хлеб), не гарнир. */
const BREAKFAST_BAN_RE = /pasta|noodle|macaroni|spaghetti|couscous|quinoa|tapioca|arrowroot|potato|glass|funchose|ramen|udon|soba|lagman/;
export function isBreakfastBannedCarb(id: string): boolean {
  if (!id) return false;
  const lid = id.toLowerCase();
  if (BREAKFAST_BAN_RE.test(lid)) return true;
  if (isHvStapleBanned(id)) return true;
  if (lid === 'rice_white' || lid === 'rice_brown' || lid === 'rice_basmati' || lid === 'sweet_potato') return true;
  if (lid === 'buckwheat' || lid === 'barley' || lid === 'grain_barley_pearl') return true;
  // P1a: булгур — обеденный гарнир, не завтрашный (корректор тащил bulgur 181 г в завтрак).
  if (lid.includes('bulgur')) return true;
  return false;
}
/** В завтраке никогда как белок: мясо/птица/рыба (курица/говядина/тунец/лосось в кашу — мусор).
 * Завтрак = яйца/творог/йогурт/сыворотка/казеин/тофу. */
const BREAKFAST_MEAT_RE = /chicken|turkey|beef|pork|tuna|salmon|trout|mackerel|cod|hake|pollock|tilapia|minced|farsh|sausage|bacon|ham|duck|goose|lamb|veal|rabbit|sardine|herring|sprat/;
export function isBreakfastBannedProtein(id: string): boolean {
  if (!id) return false;
  return BREAKFAST_MEAT_RE.test(id.toLowerCase());
}
/** В завтраке никогда как жир: наливаемые масла/животные жиры (соевое масло в творог — мусор).
 * Завтрак-жир = орехи/авокадо/сливочное мало/молоко, не ложка масла. */
const BREAKFAST_OIL_RE = /^oil_|_oil$|tallow|lard|goose_fat|duck_fat|mayonnaise|mayo_/;
export function isBreakfastBannedFat(id: string): boolean {
  if (!id) return false;
  return BREAKFAST_OIL_RE.test(id.toLowerCase());
}
/** Тяжёлые животные жиры — никогда как отдельный пункт тарелки (tallow 26г к курице — мусор).
 * Допустимы только внутри продукта, не ложкой. */
export function isHeavyAnimalFat(id: string): boolean {
  if (!id) return false;
  const lid = id.toLowerCase();
  return lid === 'tallow' || lid.includes('tallow') || lid.includes('lard') || lid.includes('goose_fat') || lid.includes('duck_fat');
}
/** Сладость как основа гарнира — никогда (печенье 40г + фунчоза 300г в обед — мусор).
 * Сладости — только топ-ап ≤30г, не второй гарнир. */
const SWEET_BASE_RE = /honey|jam|marmalade|zefir|pastila|pryaniki|sushki|sugar_cookies|cookie|chocolate|candy|halva|waffle/;
export function isSweetBaseId(id: string): boolean {
  if (!id) return false;
  return SWEET_BASE_RE.test(id.toLowerCase());
}
/** Сколько углеводных пунктов (carb_slow/carb_fast) уже в приёме. */
export function countCarbItems(m: { items?: Array<{ role?: string }> } | null | undefined): number {
  if (!m || !Array.isArray((m as any).items)) return 0;
  return (m as any).items.filter((it: any) => it.role === 'carb_slow' || it.role === 'carb_fast').length;
}

// ─── Portable-еда (работа: без разогрева, без запаха, без контейнера) ────
// на работу/в дорогу БЕЗ разогрева: порошки/хлопья/мюсли/хлеб/рисовые хлебцы, фрукты/ягоды,
// орехи/масла, молочка в упаковке (йогурт/творог/кефир), консервированная рыба, варёные яйца.
// Супы/горячие каши/жареное/фастфуд — НЕ портативны (их исключаем при portableMode).
const NON_PORTABLE_TOKENS = ['soup','porridge_','kfc','mcd','bk_','big_mac','royale','whopper','big_smoke','pizza','french_fries','fried','cheburek','pyanse','khachapuri','shaurma','ramen','gyros','falafel_pita','pancake','pelmeni','blini','pirozhok','borscht','hot_dog','hamburger','manti','samsa','kebab','shawarma','mayonnaise','ketchup','cream_sauce','bouillon_cube','ice_cream','marmalade','cookie','chocolate','coca_cola','soda','juice_apple','juice_orange'];
/** Портативный ли продукт для рабочего окна (единая точка — движок, корректор, ребаланс). */
export function isPortableFood(f: { id: string; name?: string; category?: string }): boolean {
  const lid = (f.id || '').toLowerCase();
  const lname = (f.name || '').toLowerCase();
  if (NON_PORTABLE_TOKENS.some(t => lid.includes(t) || lname.includes(t))) return false;
  if (f.category === 'supplement') return true;        // порошки/батончики
  if (f.category === 'veg_fruit') return true;          // фрукты/ягоды/сырые овощи
  if (f.category === 'fat') {
    // Орехи/семечки — можно есть руками. Масла/пасты — нет (нужна ложка, пачкают).
    if (lid.includes('oil') || lid.includes('butter') || lid.includes('paste') || lid.includes('mayonnaise') || lid.includes('cream_sauce') || lid.includes('spread')) return false;
    return true;  // орехи/семечки/сухофрукты — едим руками
  }
  if (f.category === 'dairy') {
    // Только питьевые молочные (молоко/кефир в бутылке) — можно пить на работе.
    // Творог/йогурт/сыр — требуют ложки/контейнера, пахнут.
    if (lid.includes('milk') || lid.includes('kefir') || lid.includes('ayran')) return true;
    return false;
  }
  if (f.category === 'protein') {
    // «Хлопья на работе» = БЕЗ разогрева, БЕЗ запаха, БЕЗ контейнера.
    // Только протеиновый порошок (сыворотка/казеин/вега) — разводится водой в шейкере.
    // Никакого мяса, рыбы, яиц, творога — всё это требует контейнера, вилки, пахнет.
    if (lid.includes('whey') || lid.includes('casein') || lid.includes('isolate') || lid.includes('pea_protein') || lid.includes('soy_isolate') || lid.includes('rice_protein') || lid.includes('supp_eaa') || lid.includes('bcaa') || lid.includes('collagen')) return true;
    return false;
  }
  if (f.category === 'grain' || f.category === 'carb') {
    // готовые к употреблению злаки (хлопья/мюсли/хлеб/рисовый крем/хлебцы) — портативны
    // buckwheat/barley (гречка/ячка — горячие) — НЕ портативны, требуют варки
    // 'bar' убран — иначе barley ложно портативен (barley contains 'bar')
    return ['oats','cereal','muesli','rice_cream','bread','rice_cake','crispbread','flakes','cream_of_rice'].some(k => lid.includes(k) || lname.includes(k));
  }
  return false;
}
/** true если приём попадает в рабочее окно (для portable-гейта добивок). */
export function isWorkWindowMeal(timeStr: string | undefined, ws: number | undefined, we: number | undefined): boolean {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return false;
  const [h, m] = timeStr.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return false;
  if (!Number.isFinite(ws) || !Number.isFinite(we)) return false;
  const tm = h * 60 + m;
  if (ws === we) return false;
  if ((we as number) > (ws as number)) return tm >= (ws as number) && tm <= (we as number);
  return tm >= (ws as number) || tm <= (we as number);
}

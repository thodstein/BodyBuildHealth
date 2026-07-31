/**
 * planner-preferences.ts — 5 механизмов подбора продуктов под пользователя.
 *
 * A. Вкусовой профиль (spicy/sweet/salty/sour) — boosting, не замена preferred.
 * B. Адаптивная история — продукты, которые часто заменяли, деприоритизируются.
 * C. Категорийные предпочтения — «люблю всю птицу» / «не люблю капусту».
 * D. Специфичность — повседневные / разнообразные / гурман (ортогонально бюджету).
 * E. Непереносимости — lowFODMAP, lowHistamine, lowOxalate (авто-исключение групп).
 */

import type { FoodItem } from "../../../../core/nutrition-database";

// ── D: Specificity levels ──
export type Specificity = 'everyday' | 'varied' | 'gourmet';

const EVERYDAY_EXCLUDE = new Set([
  'lobster','crab','mussels','clams','squid','oysters','octopus','scallop','langoust','crayfish','sea_cucumber',
  'abalone','sea_urchin','caviar','roe','truffle','saffron','vanilla','quail_egg','duck_egg','goose_egg',
  'venison','rabbit','duck_breast','duck_leg','goose_roasted','ostrich','bear','whale','medlar','loquat',
  'oil_truffle','oil_macadamia','oil_perilla','oil_camelina','oil_black_cumin','oil_hazelnut','oil_almond',
  'oil_walnut','oil_cedar','oil_pistachio','oil_rice_bran_organic','oil_grapeseed_cold','oil_hemp_organic',
  'chestnut','pine_nut','macadamia',
]);

export function isEverydayFood(id: string): boolean {
  const lid = id.toLowerCase();
  if (EVERYDAY_EXCLUDE.has(lid)) return false;
  for (const k of EVERYDAY_EXCLUDE) if (lid.includes(k)) return false;
  if (lid.startsWith('lamb')) return false;
  return true;
}

export function filterBySpecificity(foods: FoodItem[], level: Specificity): FoodItem[] {
  if (level === 'gourmet') return foods;
  if (level === 'everyday') return foods.filter(f => isEverydayFood(f.id));
  return foods; // 'varied' = current behavior
}

// ── C: Category preferences ──
export type CategoryPref = { preferred: string[]; excluded: string[] };

const CATEGORY_PATTERNS: Record<string, string[]> = {
  fish: ['salmon','tuna','cod','mackerel','sardine','trout','pollock','herring','haddock','sea_bass','dorado','red_fish','red_caviar','caviar','roe','anchovy'],
  dairy: ['milk','cheese','yogurt','kefir','cottage','cream_33','creme','whey','casein','ricotta','mascarpone','feta','parmesan','mozzarella'],
  legumes: ['lentils','chickpeas','beans','tofu','tempeh','edamame','hummus','peas','pea_protein','soy'],
  cabbage: ['cabbage','broccoli','cauliflower','brussels','kale','bok_choy','sauerkraut'],
  nuts: ['almond','cashew','walnut','hazelnut','pistachio','pecan','peanut','macadamia','brazil_nut','pine_nut','seed','nut'],
  pork: ['pork','bacon','ham','sausage','lard'],
  shellfish: ['shrimp','lobster','crab','mussels','clams','squid','oysters','octopus','scallop','crayfish'],
  mushroom: ['mushroom','champignon','shiitake','porcini','truffle'],
};

export function matchesCategoryPref(food: FoodItem, pref: CategoryPref): boolean {
  const id = food.id.toLowerCase();
  for (const ex of pref.excluded) {
    const patterns = CATEGORY_PATTERNS[ex.toLowerCase()];
    if (patterns) {
      if (patterns.some(p => id.includes(p))) return false;
    } else if (id.includes(ex.toLowerCase())) {
      return false;
    }
  }
  return true;
}

export function isPreferredCategory(food: FoodItem, pref: CategoryPref): boolean {
  const cat = food.category || '';
  const id = food.id.toLowerCase();
  return pref.preferred.some(p => cat === p || id.includes(p.toLowerCase()));
}

// ── E: Intolerances ──
export type Intolerances = {
  lowFODMAP?: boolean;
  lowHistamine?: boolean;
  lowOxalate?: boolean;
};

// High-histamine foods (fermented, aged, cured, certain fish)
const HIGH_HISTAMINE = new Set([
  'tuna_canned','sardines','mackerel','anchovies','fermented_cheese','cheese_aged','parmesan',
  'sausage','salami','pepperoni','bacon','ham','kefir','sauerkraut','kimchi','soy_sauce',
  'red_wine','beer','vinegar','yeast_extract','spinach','tomato','eggplant','avocado',
  'strawberry','citrus','chocolate','walnuts','peanuts',
]);

// High-oxalate foods
const HIGH_OXALATE = new Set([
  'spinach','rhubarb','beetroot','chard','cocoa','chocolate','nuts_almonds','nuts_cashews','nuts_hazelnuts',
  'tea_black','tea_green','wheat_bran','buckwheat','soy_textured','tofu','black_pepper',
]);

export function filterByIntolerance(food: FoodItem, into: Intolerances): boolean {
  const id = food.id.toLowerCase();
  if (into.lowFODMAP) {
    const fg = food.gastro_tags?.fodmap_group;
    if (fg === 'HIGH') return false;
  }
  if (into.lowHistamine) {
    for (const h of HIGH_HISTAMINE) if (id.includes(h)) return false;
  }
  if (into.lowOxalate) {
    for (const o of HIGH_OXALATE) if (id.includes(o)) return false;
  }
  return true;
}

// ── A: Taste profile ──
export type TasteProfile = {
  spicy: number;   // 0-3
  sweet: number;
  salty: number;
  sour: number;
  umami: number;   // 0-3 (5th basic taste ? glutamate-rich savory foods)
};

// Taste tags for common foods (by id pattern). Missing = neutral (0).
const TASTE_TAGS: Record<string, Partial<TasteProfile>> = {
  // ?? Spicy (0-3) ??
  chili: { spicy: 3 }, pepper_chili: { spicy: 3 }, hot_sauce: { spicy: 3 }, harissa: { spicy: 3 },
  ginger: { spicy: 1 }, mustard: { spicy: 1 }, horseradish: { spicy: 2 }, wasabi: { spicy: 3 },
  cayenne: { spicy: 3 }, paprika: { spicy: 2 }, red_pepper: { spicy: 3 }, jalapeno: { spicy: 3 },
  sriracha: { spicy: 3 }, tabasco: { spicy: 3 }, pepperoncini: { spicy: 2 }, adjika: { spicy: 3 },
  chili_flakes: { spicy: 3 }, chili_powder: { spicy: 3 }, chipotle: { spicy: 3 }, serrano: { spicy: 3 },
  habanero: { spicy: 3 }, peri_peri: { spicy: 3 }, jerk: { spicy: 3 }, buffalo: { spicy: 3 },
  black_pepper: { spicy: 1 }, white_pepper: { spicy: 1 }, curry: { spicy: 2 }, turmeric: { spicy: 1 },
  cumin: { spicy: 1 }, coriander: { spicy: 1 }, garlic: { spicy: 1 }, garlic_powder: { spicy: 1 },
  shawarma: { spicy: 2 }, kfc: { spicy: 2 }, wings: { spicy: 2 }, spicy: { spicy: 2 },

  // ?? Sweet (0-3) ??
  banana: { sweet: 2 }, honey: { sweet: 3 }, maple: { sweet: 3 }, dates: { sweet: 3 },
  apple: { sweet: 2 }, berries: { sweet: 1 }, papaya: { sweet: 2 }, mango: { sweet: 3 },
  sweet_potato: { sweet: 1 }, carrot: { sweet: 1 }, corn: { sweet: 1 }, rice_cream: { sweet: 2 },
  beetroot: { sweet: 1 }, raisins: { sweet: 3 }, dried_apricots: { sweet: 2 }, prunes: { sweet: 2 },
  fig: { sweet: 2 }, grapes: { sweet: 2 }, pear: { sweet: 2 }, peach: { sweet: 2 },
  nectarine: { sweet: 2 }, apricot: { sweet: 2 }, pineapple: { sweet: 2 }, kiwi: { sweet: 1 },
  pomegranate: { sweet: 1 }, watermelon: { sweet: 2 }, melon: { sweet: 2 }, cantaloupe: { sweet: 2 },
  strawberry: { sweet: 2 }, strawberries: { sweet: 2 }, blueberries: { sweet: 2 }, raspberry: { sweet: 2 },
  blackberry: { sweet: 2 }, cranberry: { sweet: 1 }, cherry: { sweet: 2 }, plum: { sweet: 2 },
  orange: { sweet: 1 }, mandarin: { sweet: 2 }, tangerine: { sweet: 2 }, grapefruit: { sweet: 1 },
  coconut: { sweet: 1 }, coconut_urbec: { sweet: 2 }, marmalade: { sweet: 3 }, jam: { sweet: 3 },
  chocolate: { sweet: 3 }, dark_chocolate: { sweet: 2 }, cocoa: { sweet: 2 }, granola: { sweet: 2 },
  corn_flakes: { sweet: 2 }, protein_bar: { sweet: 2 }, condensed: { sweet: 3 }, marshmallow: { sweet: 3 },
  caramel: { sweet: 3 }, fudge: { sweet: 3 }, cake: { sweet: 3 }, cookie: { sweet: 3 },
  biscuit: { sweet: 2 }, donut: { sweet: 3 }, waffle: { sweet: 2 }, pancake: { sweet: 2 },
  muffin: { sweet: 3 }, brownie: { sweet: 3 }, ice_cream: { sweet: 3 }, sorbet: { sweet: 2 },
  pudding: { sweet: 2 }, custard: { sweet: 2 }, rice_pudding: { sweet: 3 }, cheesecake: { sweet: 3 },
  agave: { sweet: 3 }, sugar: { sweet: 3 }, dextrose: { sweet: 3 }, maltodextrin: { sweet: 2 },
  amylopectin: { sweet: 2 }, molasses: { sweet: 3 }, corn_syrup: { sweet: 3 }, sweet: { sweet: 1 },

  // ?? Salty (0-3) ??
  soy_sauce: { salty: 3, umami: 3 }, cheese: { salty: 2 }, feta: { salty: 3 }, olives: { salty: 2 },
  ham: { salty: 2, umami: 1 }, bacon: { salty: 3, umami: 2 }, canned: { salty: 1 }, broth: { salty: 1, umami: 2 },
  parmesan: { salty: 3, umami: 3 }, gouda: { salty: 2 }, cheddar: { salty: 2 }, mozzarella: { salty: 1 },
  brie: { salty: 1 }, camembert: { salty: 1 }, roquefort: { salty: 3 }, blue_cheese: { salty: 3 },
  processed_cheese: { salty: 2 }, cheese_hard: { salty: 2 }, cheese_aged: { salty: 3 },
  salt: { salty: 3 }, sea_salt: { salty: 3 }, himalayan_salt: { salty: 3 }, salted: { salty: 3 },
  pretzel: { salty: 3 }, crackers: { salty: 2 }, chips: { salty: 3 }, crisps: { salty: 3 },
  jerky: { salty: 3 }, beef_jerky: { salty: 3 }, salted_fish: { salty: 3 }, dried_fish: { salty: 3 },
  sprats: { salty: 3, umami: 2 }, herring: { salty: 2, umami: 2 }, anchovies: { salty: 3, umami: 3 }, caviar: { salty: 2, umami: 2 },
  red_caviar: { salty: 2, umami: 2 }, miso: { salty: 3, umami: 3 }, bouillon: { salty: 2, umami: 2 }, stock: { salty: 1 },
  tamari: { salty: 3 }, fish_sauce: { salty: 3, umami: 3 }, worcestershire: { salty: 2 }, teriyaki: { salty: 2 },
  salami: { salty: 3, umami: 2 }, pepperoni: { salty: 3 }, sausage: { salty: 2, umami: 1 }, chorizo: { salty: 3 },
  prosciutto: { salty: 3, umami: 2 }, soy: { salty: 1 }, cured: { salty: 2 },

  // ?? Sour (0-3) ??
  lemon: { sour: 3 }, lime: { sour: 3 }, yogurt: { sour: 1 }, kefir: { sour: 2 },
  sauerkraut: { sour: 2 }, kimchi: { sour: 2 }, vinegar: { sour: 3 }, pickles: { sour: 2 },
  cottage_cheese: { sour: 1 }, tomato: { sour: 1, umami: 1 }, lemon_juice: { sour: 3 }, lime_juice: { sour: 3 },
  cranberry_sour: { sour: 2 }, sour_cherry: { sour: 3 }, green_apple: { sour: 2 }, rhubarb: { sour: 3 },
  tamarind: { sour: 3 }, passionfruit: { sour: 2 }, currant: { sour: 2 }, gooseberry: { sour: 2 },
  sea_buckthorn: { sour: 3 }, sorrel: { sour: 3 }, kefir_2: { sour: 2 }, ryazhenka: { sour: 1 },
  ayran: { sour: 1 }, tan: { sour: 1 }, matsoni: { sour: 2 }, sour_cream: { sour: 1 },
  smetana: { sour: 1 }, cultured: { sour: 2 }, fermented: { sour: 2 }, kombucha: { sour: 2 },
  kvass: { sour: 2 }, skyr: { sour: 2 }, buttermilk: { sour: 2 }, sourdough: { sour: 2 },
  yuzu: { sour: 3 }, calamansi: { sour: 3 }, sumac: { sour: 2 }, verjuice: { sour: 3 },
  amchur: { sour: 2 }, pomegranate_molasses: { sour: 2 }, yogurt_natural: { sour: 1 },
  greek_yogurt: { sour: 1 }, yogurt_greek: { sour: 1 }, tomato_juice: { sour: 1 },
  // -- Umami (0-3) -- glutamate-rich savory depth --
  mushroom: { umami: 2 }, mushrooms: { umami: 2 }, champignon: { umami: 2 }, shiitake: { umami: 3 },
  porcini: { umami: 3 }, truffle: { umami: 3 }, oyster_mushroom: { umami: 2 }, enoki: { umami: 1 },
  dried_mushroom: { umami: 3 }, mushroom_broth: { umami: 3 }, seaweed_nori: { umami: 3 },
  seaweed: { umami: 2 }, wakame: { umami: 3 }, kombu: { umami: 3 }, dulse: { umami: 2 },
  kelp: { umami: 3 }, nori: { umami: 3 }, dashi: { umami: 3 }, bonito: { umami: 3 },
  katsuobushi: { umami: 3 }, bonito_flakes: { umami: 3 },
  sun_dried_tomato: { umami: 3 }, tomato_sauce: { umami: 2 },
  pecorino: { umami: 3 }, grana: { umami: 3 }, gruyere: { umami: 3 }, emmental: { umami: 2 },
  asiago: { umami: 2 }, pecorino_romano: { umami: 3 },
  natto: { umami: 3 }, oyster_sauce: { umami: 3 },
  yeast_extract: { umami: 3 }, nutritional_yeast: { umami: 3 }, marmite: { umami: 3 },
  vegemite: { umami: 3 }, msg: { umami: 3 }, glutamate: { umami: 3 },
  beef_broth: { umami: 3 }, consomme: { umami: 3 }, demiglace: { umami: 3 }, gravy: { umami: 2 },
  aged_beef: { umami: 3 }, dry_aged: { umami: 3 }, jamon: { umami: 2 },
  fish_roe: { umami: 2 }, tobiko: { umami: 2 },
  sea_urchin: { umami: 3 }, uni: { umami: 3 }, clams: { umami: 2 },
  smoked_fish: { umami: 2 }, gravlax: { umami: 2 },

  // -- More spicy (warm spices & herbs, mild) --
  oregano: { spicy: 1 }, thyme: { spicy: 1 }, rosemary: { spicy: 1 }, sage: { spicy: 1 },
  bay_leaf: { spicy: 1 }, cloves: { spicy: 1 }, nutmeg: { spicy: 1 }, cinnamon: { spicy: 1 },
  cardamom: { spicy: 1 }, allspice: { spicy: 1 }, star_anise: { spicy: 1 }, fennel: { spicy: 1 },
  anise: { spicy: 1 }, dill: { spicy: 1 }, basil: { spicy: 1 }, zaatar: { spicy: 1 },
  garam_masala: { spicy: 2 }, berbere: { spicy: 3 }, ras_el_hanout: { spicy: 2 },
  gochugaru: { spicy: 3 }, gochujang: { spicy: 3 }, doubanjiang: { spicy: 3 },
  togarashi: { spicy: 3 }, sichuan: { spicy: 3 }, szechuan: { spicy: 3 },
  chili_oil: { spicy: 3 }, chili_garlic: { spicy: 3 }, nduja: { spicy: 3 },
  soppressata: { spicy: 2 }, ventricina: { spicy: 2 }, merguez: { spicy: 3 },
  boerewors: { spicy: 2 }, longaniza: { spicy: 2 },

  // -- More sweet (tropical/exotic fruits + syrups + sweets) --
  lychee: { sweet: 3 }, rambutan: { sweet: 3 }, mangosteen: { sweet: 2 }, dragonfruit: { sweet: 1 },
  persimmon: { sweet: 3 }, guava: { sweet: 2 }, feijoa: { sweet: 2 }, carambola: { sweet: 2 },
  jackfruit: { sweet: 3 }, plantain: { sweet: 1 }, loquat: { sweet: 2 }, kumquat: { sweet: 1 },
  satsuma: { sweet: 2 }, ponkan: { sweet: 2 }, sapodilla: { sweet: 3 }, longan: { sweet: 3 },
  date_syrup: { sweet: 3 }, rice_syrup: { sweet: 3 }, coconut_sugar: { sweet: 3 },
  palm_sugar: { sweet: 3 }, panela: { sweet: 3 }, muscovado: { sweet: 3 },
  demerara: { sweet: 2 }, turbinado: { sweet: 2 }, jaggery: { sweet: 3 },
  baklava: { sweet: 3 }, halva: { sweet: 3 }, kozinaki: { sweet: 3 }, pastila: { sweet: 3 },
  nougat: { sweet: 3 }, praline: { sweet: 3 }, marzipan: { sweet: 3 }, ganache: { sweet: 3 },
  frosting: { sweet: 3 }, honey_cake: { sweet: 3 }, napoleon: { sweet: 3 }, eclair: { sweet: 3 },
  profiterole: { sweet: 3 }, tiramisu: { sweet: 3 }, creme_brulee: { sweet: 3 },
  panna_cotta: { sweet: 3 }, macaron: { sweet: 3 }, madeleine: { sweet: 2 },
  brioche: { sweet: 2 }, cinnamon_roll: { sweet: 3 }, pain_au_chocolat: { sweet: 3 },
  danish: { sweet: 2 }, strudel: { sweet: 2 }, granola_bar: { sweet: 3 }, energy_bar: { sweet: 2 },
  fruit_leather: { sweet: 3 }, gummy: { sweet: 3 }, licorice: { sweet: 2 },

  // -- More salty (cured meats, fish, snacks) --
  bresaola: { salty: 3 }, pancetta: { salty: 3 }, coppa: { salty: 3 }, lardo: { salty: 2 },
  guanciale: { salty: 3 }, speck: { salty: 3 }, kielbasa: { salty: 2 }, bratwurst: { salty: 2 },
  frankfurter: { salty: 2 }, cabanossi: { salty: 3 }, landjager: { salty: 3 },
  droewors: { salty: 3 }, biltong: { salty: 3 }, kippered: { salty: 3 },
  pickled_herring: { salty: 3 }, rollmops: { salty: 3 }, lutefisk: { salty: 3 },
  surstromming: { salty: 3 }, bacalao: { salty: 3 }, stockfish: { salty: 3 },
  gravadlax: { salty: 2 }, salt_cod: { salty: 3 }, brined_fish: { salty: 3 },
  popcorn: { salty: 1 }, roasted_nuts: { salty: 2 }, salted_almonds: { salty: 3 },
  salted_cashew: { salty: 3 }, salted_sunflower: { salty: 3 }, roasted_seeds: { salty: 2 },
  rye_crisp: { salty: 2 }, rice_cake_salt: { salty: 2 }, matzo: { salty: 2 }, crispbread: { salty: 2 },
  rice_crackers: { salty: 2 }, senbei: { salty: 2 }, prawn_crackers: { salty: 2 },
  doritos: { salty: 3 }, cheetos: { salty: 3 }, pretzels: { salty: 3 }, corn_nuts: { salty: 3 },
  pork_rinds: { salty: 3 }, chicharrones: { salty: 3 }, brined_olives: { salty: 3 },
  tapenade: { salty: 3 }, capers: { salty: 3 }, caperberry: { salty: 3 },

  // -- More sour (ferments, sour fruits, sour dairy) --
  umeboshi: { sour: 3 }, takuan: { sour: 2 }, tsukemono: { sour: 2 }, kasuzuke: { sour: 2 },
  nukazuke: { sour: 2 }, shiozuke: { sour: 2 }, atchara: { sour: 2 }, cortido: { sour: 2 },
  saueruben: { sour: 2 }, lacto_fermented: { sour: 2 }, lactic: { sour: 2 }, brine: { sour: 1 },
  brined: { sour: 1 }, pickled_veg: { sour: 2 }, pickled_cucumber: { sour: 2 },
  pickled_pepper: { sour: 2 }, pickled_onion: { sour: 2 }, pickled_cabbage: { sour: 2 },
  blood_orange: { sour: 2 }, moro: { sour: 2 }, sanguinello: { sour: 2 },
  buddha_hand: { sour: 2 }, finger_lime: { sour: 3 }, calamansi_fruit: { sour: 3 },
  sudachi: { sour: 3 }, filmjolk: { sour: 2 }, langfil: { sour: 2 }, piima: { sour: 2 },
  viili: { sour: 2 }, kefir_drink: { sour: 2 }, laban: { sour: 2 }, doogh: { sour: 1 },
  chaas: { sour: 1 }, lassi: { sour: 1 }, sourdough_bread: { sour: 2 }, sourdough_rye: { sour: 2 },
  apple_cider_vinegar: { sour: 3 }, balsamic: { sour: 2 }, balsamico: { sour: 2 },
  rice_vinegar: { sour: 2 }, apple_vinegar: { sour: 3 }, wine_vinegar: { sour: 3 },
  malt_vinegar: { sour: 3 }, sherry_vinegar: { sour: 3 },
  citrus: { sour: 1 }, tomato_paste: { sour: 1 },
};

export function getTasteTags(food: FoodItem): TasteProfile {
  const id = food.id.toLowerCase();
  const name = (food.name || '').toLowerCase();
  let tags: Partial<TasteProfile> = {};
  // match by id or name substring
  for (const [key, val] of Object.entries(TASTE_TAGS)) {
    if (id.includes(key) || name.includes(key)) {
      tags = { ...tags, ...val };
    }
  }
  return { spicy: tags.spicy || 0, sweet: tags.sweet || 0, salty: tags.salty || 0, sour: tags.sour || 0, umami: tags.umami || 0 };
}

export function tasteMatchScore(food: FoodItem, profile: TasteProfile): number {
  if (!profile || (profile.spicy + profile.sweet + profile.salty + profile.sour + (profile.umami || 0) === 0)) return 0;
  const tags = getTasteTags(food);
  // positive: user likes a taste and food has it
  let score = 0;
  if (tags.spicy > 0 && profile.spicy > 0) score += tags.spicy * profile.spicy;
  if (tags.sweet > 0 && profile.sweet > 0) score += tags.sweet * profile.sweet;
  if (tags.salty > 0 && profile.salty > 0) score += tags.salty * profile.salty;
  if (tags.sour > 0 && profile.sour > 0) score += tags.sour * profile.sour;
  if (tags.umami > 0 && (profile.umami || 0) > 0) score += tags.umami * (profile.umami || 0);
  return score;
}

// ── B: Adaptive history ──
const HISTORY_KEY = 'he_food_replace_history';

export function loadReplaceHistory(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}'); } catch { return {}; }
}

export function recordReplacement(oldFoodId: string): void {
  try {
    const h = loadReplaceHistory();
    h[oldFoodId] = (h[oldFoodId] || 0) + 1;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  } catch {}
}

export function getDeprioritizedIds(): Set<string> {
  const h = loadReplaceHistory();
  const result = new Set<string>();
  for (const [id, count] of Object.entries(h)) {
    if ((count as number) >= 3) result.add(id); // replaced 3+ times → deprioritize
  }
  return result;
}

export function clearReplaceHistory(): void {
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

// ── Recipe decomposition ──
// When a recipe is in preferredFoods (id starts with __recipe__ or __user_recipe__),
// decompose it into its ingredient food IDs by matching ingredient names to FOOD_DB.
export function expandRecipePreferred(preferredFoods: string[], recipes: any[], foodDb: any[]): string[] {
  const result = new Set<string>();
  for (const pf of Array.isArray(preferredFoods) ? preferredFoods : []) {
    if (typeof pf !== 'string') continue;
    if (pf.startsWith('__recipe__') || pf.startsWith('__user_recipe__')) {
      // extract recipe name from id
      const rname = pf.replace(/^__user_recipe__|^__recipe__/, '');
      const recipe = (Array.isArray(recipes) ? recipes : []).find((r: any) => r.name === rname);
      if (recipe && Array.isArray(recipe.ingredients)) {
        for (const ing of recipe.ingredients) {
          if (typeof ing !== 'string') continue;
          // match ingredient name to FOOD_DB by name substring (case-insensitive)
          const ingLower = ing.toLowerCase().split(' ')[0]; // first word
          const match = (Array.isArray(foodDb) ? foodDb : []).find((f: any) => (f.name || '').toLowerCase().includes(ingLower) || (f.id || '').toLowerCase().includes(ingLower));
          if (match) result.add(match.id);
        }
      }
    } else {
      result.add(pf); // regular food id
    }
  }
  return [...result];
}

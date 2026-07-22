/**
 * planner-food-interactions.ts — Синергии и конфликты продуктов в приёме пищи.
 *
 * Принцип 6 движка заявлял: «витамин C × железо (растит.), жиры × ADEK,
 * пиперин × куркумин; конфликты: оксалаты × кальций, танины × железо».
 * Но в коде это не исполнялось. Этот модуль — реализация.
 *
 * Конфликты (ухудшают всасывание/усвоение при совместном приёме):
 *   - оксалаты × кальций        (шпинат/свёкла + молоко/сыр → Ca-оксалат, Ca не усваивается)
 *   - танины × железо            (чай/кофе + красное мясо/печень → Fe³⁺ осаждается)
 *   - фитаты × цинк/железо       (отруби/цельнозерновые + мясо → хелатирование Zn/Fe)
 *   - кальций × железо (высокая доза) (молоко + красное мясо → Ca блокирует Fe-абсорбцию)
 *   - клетчатка (очень высокая) × минералы
 *
 * Синергии (усиливают всасывание/эффект):
 *   - витамин C × растительное железо  (цитрус/перец + чечевица/шпинат → Fe²⁺, +3-6× абсорбция)
 *   - жиры × жирорастворимые (A/D/E/K)  (олив.масло/авокадо + морковь/яйцо/зелень)
 *   - пиперин × куркумин               (чёрный перец + куркума → +2000% биодоступность)
 *   - витамин D × кальций              (жирная рыба/яйцо + молоко/зелень)
 *   - лецитин × омега-3                (яйцо + рыба/льняное)
 */

export interface FoodItemLike { id: string; name?: string; category?: string; }

export interface InteractionWarning {
  type: 'conflict' | 'synergy';
  severity: 'low' | 'medium' | 'high';
  text: string;
}

// Группы продуктов по id-substring (совместимо с taste-matching подходом).
const OXALATE_FOODS = ['spinach', 'beetroot', 'beet', 'rhubarb', 'chard', 'sorrel', 'cocoa', 'dark_chocolate', 'almond', 'cashew', 'green_tea'];
const TANNIN_FOODS = ['tea', 'coffee', 'wine', 'cocoa', 'dark_chocolate', 'pomegranate', 'persimmon', 'quince'];
const PHYTATE_FOODS = ['wheat_bran', 'oat_bran', 'rice_bran', 'whole_grain', 'bran', 'soy_textured', 'seitan'];
const HIGH_CALCIUM = ['milk', 'cheese', 'yogurt', 'kefir', 'cottage_cheese', 'sardines', 'tofu', 'sesame', 'chia', 'almond', 'kale'];
const HEME_IRON = ['beef_liver', 'beef_lean', 'red_meat', 'liver', 'rabbit', 'turkey_leg', 'venison', 'lamb'];
const PLANT_IRON = ['lentils', 'spinach', 'chickpeas', 'beans', 'tofu', 'pumpkin_seeds', 'quinoa', 'oats', 'buckwheat'];
const VITC_FOODS = ['pepper', 'citrus', 'kiwi', 'strawberry', 'broccoli', 'kale', 'papaya', 'pineapple', 'berries', 'cranberry', 'lemon', 'orange'];
const FAT_SOURCE = ['olive_oil', 'avocado', 'butter', 'nuts', 'almond', 'walnut', 'peanut', 'flaxseed', 'chia', 'coconut', 'oil_'];
const ADEK_FOODS = ['carrot', 'sweet_potato', 'spinach', 'kale', 'egg_whole', 'egg_yolk', 'salmon', 'mackerel', 'liver', 'pumpkin'];
const CURCUMIN = ['turmeric', 'curcumin'];
const BLACK_PEPPER = ['black_pepper', 'pepper_black'];
const VITD_FOODS = ['salmon', 'mackerel', 'sardines', 'egg_yolk', 'tuna', 'red_fish', 'mushroom_uv'];

// Token-based matching: key must be a full underscore-delimited token of the id,
// OR (for keys >=4 chars) a substring. This avoids false positives like 'tea' matching 'steak'.
function matchesAny(id: string, list: string[]): boolean {
  const lid = id.toLowerCase();
  const tokens = lid.split(/[^a-z0-9]+/);
  return list.some(k => {
    if (k.length < 4) return tokens.includes(k);
    return lid.includes(k);
  });
}

function anyPair(items: FoodItemLike[], listA: string[], listB: string[]): [FoodItemLike, FoodItemLike] | null {
  const a = items.filter(it => matchesAny(it.id, listA));
  const b = items.filter(it => matchesAny(it.id, listB));
  if (a.length === 0 || b.length === 0) return null;
  // убедимся, что это разные продукты
  for (const xa of a) for (const xb of b) if (xa.id !== xb.id) return [xa, xb];
  return null;
}

/**
 * Анализирует набор продуктов одного приёма на конфликты и синергии.
 */
export function detectMealInteractions(items: FoodItemLike[]): InteractionWarning[] {
  const out: InteractionWarning[] = [];
  if (!items || items.length < 2) return out;

  // ── Конфликты ──
  const oxCal = anyPair(items, OXALATE_FOODS, HIGH_CALCIUM);
  if (oxCal) out.push({ type: 'conflict', severity: 'medium', text: `Оксалаты × кальций: ${oxCal[0].name||oxCal[0].id} + ${oxCal[1].name||oxCal[1].id} → кальций связывается в оксалат. Разнесите в разные приёмы.` });

  const tanFe = anyPair(items, TANNIN_FOODS, HEME_IRON);
  if (tanFe) out.push({ type: 'conflict', severity: 'medium', text: `Танины × железо: ${tanFe[0].name||tanFe[0].id} + ${tanFe[1].name||tanFe[1].id} → танины осаждают Fe³⁺. Пейте чай/кофе через 30+ мин после мяса.` });

  const tanFePlant = anyPair(items, TANNIN_FOODS, PLANT_IRON);
  if (tanFePlant) out.push({ type: 'conflict', severity: 'low', text: `Танины × растительное железо: ${tanFePlant[0].name||tanFePlant[0].id} + ${tanFePlant[1].name||tanFePlant[1].id} → снижает всасывание Fe.` });

  const phytZn = anyPair(items, PHYTATE_FOODS, [...HEME_IRON, ...['oysters', 'pumpkin_seeds', 'cashew']]);
  if (phytZn) out.push({ type: 'conflict', severity: 'low', text: `Фитаты × минералы: ${phytZn[0].name||phytZn[0].id} + ${phytZn[1].name||phytZn[1].id} → фитаты хелатируют Zn/Fe. Замочите отруби/зерно.` });

  const calFe = anyPair(items, HIGH_CALCIUM, HEME_IRON);
  if (calFe) out.push({ type: 'conflict', severity: 'low', text: `Кальций × железо: ${calFe[0].name||calFe[0].id} + ${calFe[1].name||calFe[1].id} → высокая доза Ca тормозит абсорбцию Fe (≥300мг Ca за раз).` });

  // ── Синергии ──
  const vitCPlantFe = anyPair(items, VITC_FOODS, PLANT_IRON);
  if (vitCPlantFe) out.push({ type: 'synergy', severity: 'low', text: `✨ Синергия: витамин C (${vitCPlantFe[0].name||vitCPlantFe[0].id}) × растительное железо (${vitCPlantFe[1].name||vitCPlantFe[1].id}) → +3-6× абсорбция Fe²⁺.` });

  const fatAdek = anyPair(items, FAT_SOURCE, ADEK_FOODS);
  if (fatAdek) out.push({ type: 'synergy', severity: 'low', text: `✨ Синергия: жиры (${fatAdek[0].name||fatAdek[0].id}) × A/D/E/K (${fatAdek[1].name||fatAdek[1].id}) → жирорастворимые витамины усваиваются.` });

  const pepCur = anyPair(items, BLACK_PEPPER, CURCUMIN);
  if (pepCur) out.push({ type: 'synergy', severity: 'low', text: `✨ Синергия: пиперин (${pepCur[0].name||pepCur[0].id}) × куркумин (${pepCur[1].name||pepCur[1].id}) → +2000% биодоступность куркумина.` });

  const vitDCa = anyPair(items, VITD_FOODS, HIGH_CALCIUM);
  if (vitDCa) out.push({ type: 'synergy', severity: 'low', text: `✨ Синергия: витамин D (${vitDCa[0].name||vitDCa[0].id}) × кальций (${vitDCa[1].name||vitDCa[1].id}) → D усиливает абсорбцию Ca.` });

  return out;
}


// ── #9 Способ приготовления — влияние на биодоступность ──────────────
// Совет по способу обработки ключевых продуктов в приёме (raw vs cooked vs fried).
export function cookMethodGuidance(items: FoodItemLike[]): string[] {
  const out: string[] = [];
  if (!items || items.length === 0) return out;
  const has = (list: string[]) => items.some(it => matchesAny(it.id, list));

  if (has(['spinach','chard','sorrel','beetroot','beet'])) {
    out.push('🍗 Оксалаты: шпинат/свёкла бланшируйте 1-2 мин (оксалаты ↓, блокируют Ca/Fe) — но не варите долго (вит C ↓). С вит C (лимон) для Fe.');
  }
  if (has(['carrot','pumpkin','sweet_potato','tomato'])) {
    out.push('🍅 Жирорастворимые: морковь/томат лучше треть/варить + капля жира (вит A/ликопен +биодоступность).');
  }
  if (has(['garlic','onion'])) {
    out.push('🧄 Чеснок/лук: дайте порезанным отстоять 10 мин (аллицин формируется) — добавляйте в конце готовки.');
  }
  if (has(['broccoli','cauliflower','brussels','kale','cabbage'])) {
    out.push('🥦 Крестоцветные: пар/бланш 3-5 мин (сульфорафан сохраняется). Не варить долго — гойтрогены ↓, вит C ↓.');
  }
  if (has(['potato_boiled','potato','rice_white','pasta'])) {
    out.push('❄️ Резистентный крахмал: картофель/рис/паста отстаять отваренными 12-24ч (охлаждение → resistant starch, ниже GI, кормит микробиом).');
  }
  if (has(['shawarma','pizza','burger','kfc','mcd','bk_','vt_','fast_food','fried','fries'])) {
    out.push('⚠️ Фастфуд/жареное: +калории (впитывает масло), канцерогены (акриламид при жарке), транс-жиры. Минимизируйте или запекайте/гриль.');
  }
  if (has(['egg_whole','egg'])) {
    out.push('🥚 Яйца: желток варить (биотин усваивается, сальмонелла ↓); белок обязательно термообработка (авидин).');
  }
  if (has(['beef_lean','beef_minced','chicken_breast','turkey','salmon'])) {
    out.push('🥩 Мясо/рыба: запекание/гриль/пар предпочтительнее жарки (меньше канцерогенов, сохранение аминокислот). Рыбу не пережаривать (омега-3 страдает).');
  }
  // limit to 2 notes per meal to avoid clutter
  return out.slice(0, 2);
}

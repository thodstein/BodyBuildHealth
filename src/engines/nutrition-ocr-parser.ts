export interface ParsedMeal {
  date: string;
  mealType: string;
  items: Array<{ name: string; qty: string; kcal: number; p: number; f: number; c: number }>;
}

const FATSECRET_ITEM_REGEX = /^\s*(.+?)\s+(\d+)\s*(г|мл|шт|кусок|порция|сервинг|ст\.л\.)?\s*[,/]?\s*(\d+)\s*(ккал|кал)/i;
const FATSECRET_TOTAL_REGEX = /итого|всего|total|daily\s+total/i;
const FATSUCCESS_MACRO_LINE = /(\d+(?:[.,]\d+)?)\s*(ккал|кал|белки?|жиры?|углевод|угл|жиры|бел|б|ж|у|carb|protein|fat|calori)/gi;
const MFP_LINE_REGEX = /^(.+?)\s+(\d+)\s*(?:(?:г|мл|шт|oz|serving|srvg|slice|cup|tbsp|шт|кус|порц)[,.]?\s*)?(\d+)\s*(ккал|кал|cal)/i;

const RUSSIAN_FOOD_NAMES: Record<string, string> = {
  'куриная грудка': 'chicken_breast', 'курица': 'chicken_breast', 'грудка куриная': 'chicken_breast',
  'говядина': 'beef_lean', 'стейк': 'beef_lean', 'говяжий': 'beef_lean',
  'лосось': 'salmon', 'семга': 'salmon', 'рыба': 'salmon',
  'рис': 'rice_white', 'рис белый': 'rice_white', 'рис бурый': 'rice_brown',
  'гречка': 'buckwheat', 'гречневая каша': 'buckwheat',
  'овсянка': 'oats', 'овсяные хлопья': 'oats', 'капуста овсяная': 'oats',
  'яйца': 'egg_whole', 'яйцо': 'egg_whole', 'яичный белок': 'egg_white',
  'творог': 'cottage_cheese_5', 'творог 5%': 'cottage_cheese_5',
  'банан': 'banana', 'яблоко': 'apple', 'брокколи': 'broccoli',
  'макароны': 'pasta_durum', 'паста': 'pasta_durum',
  'картофель': 'potato_boiled', 'картошка': 'potato_boiled',
  'хлеб ржаной': 'bread_rye', 'хлеб': 'bread_rye',
  'кефир': 'kefir', 'молоко': 'milk', 'сыр': 'cheese_hard',
  'орехи': 'nuts_mix', 'грецкие орехи': 'nuts_mix', 'миндаль': 'nuts_mix',
  'авокадо': 'avocado', 'шпинат': 'spinach', 'огурец': 'cucumber',
  'помидор': 'tomato', 'томат': 'tomato', 'перец': 'pepper',
  'масло оливковое': 'olive_oil', 'оливковое масло': 'olive_oil',
  'сельдь': 'fish_oil_food', 'скумбрия': 'fish_oil_food',
  'протеин': 'whey_protein', 'сывороточный протеин': 'whey_protein',
  'казеин': 'casein', 'креатин': 'creatine',
  'индейка': 'turkey_breast', 'свинина': 'pork_tenderloin',
  'тунец': 'tuna_canned', 'тунец консервированный': 'tuna_canned',
  'батат': 'sweet_potato', 'ягоды': 'berries',
  'семена льна': 'seeds', 'чиа': 'seeds',
  'сливочное масло': 'butter', 'масло сливочное': 'butter',
  'йогурт': 'yogurt_greek', 'греческий йогурт': 'yogurt_greek',
  'шаурма': 'shawarma', 'пицца': 'pizza_margherita', 'бургер': 'burger',
};

function matchRussianFood(text: string): string | null {
  const lower = text.toLowerCase().trim();
  for (const [ru, id] of Object.entries(RUSSIAN_FOOD_NAMES)) {
    if (lower.includes(ru)) return id;
  }
  return null;
}

function parseMacroValue(text: string, patterns: RegExp[]): { kcal: number; p: number; f: number; c: number } {
  const result = { kcal: 0, p: 0, f: 0, c: 0 };
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(text)) !== null) {
      const val = parseFloat(m[1].replace(',', '.'));
      const unit = m[2].toLowerCase();
      if (/ккал|кал|cal/i.test(unit)) result.kcal = val;
      else if (/бел|прот|б|protein/i.test(unit)) result.p = val;
      else if (/жир|ж|fat/i.test(unit)) result.f = val;
      else if (/угл|карб|у|carb/i.test(unit)) result.c = val;
    }
  }
  return result;
}

export function parseNutritionScreenshot(text: string): ParsedMeal[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 2);
  const meals: ParsedMeal[] = [];
  let currentMeal: ParsedMeal | null = null;

  const dateRegex = /(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/;
  const mealRegex = /(завтрак|обед|ужин|перекус|бранч|полдник|snack|lunch|dinner|breakfast|перекус\s*\d)/i;
  const totalRegex = /итого|всего|total|daily\s*total|дневная|дневной/i;
  const macroPattern = FATSUCCESS_MACRO_LINE;

  for (const line of lines) {
    if (totalRegex.test(line)) continue;

    const dateMatch = line.match(dateRegex);
    if (dateMatch && !currentMeal) {
      currentMeal = { date: dateMatch[0], mealType: 'Общее', items: [] };
      meals.push(currentMeal);
    }

    const mealMatch = line.match(mealRegex);
    if (mealMatch) {
      currentMeal = { date: currentMeal?.date || new Date().toISOString().slice(0, 10), mealType: mealMatch[0], items: [] };
      meals.push(currentMeal);
    }

    if (!currentMeal) {
      currentMeal = { date: new Date().toISOString().slice(0, 10), mealType: 'Общее', items: [] };
      meals.push(currentMeal);
    }

    const fsMatch = line.match(FATSECRET_ITEM_REGEX);
    if (fsMatch) {
      const name = fsMatch[1].trim();
      const kcal = parseInt(fsMatch[4]) || 0;
      const qtyStr = fsMatch[2] ? `${fsMatch[2]} ${fsMatch[3] || 'г'}` : '100 г';
      const foodId = matchRussianFood(name);
      const macros = parseMacroValue(line, [macroPattern]);
      currentMeal.items.push({
        name,
        qty: qtyStr,
        kcal: kcal || macros.kcal,
        p: macros.p,
        f: macros.f,
        c: macros.c,
      });
      continue;
    }

    const mfpMatch = line.match(MFP_LINE_REGEX);
    if (mfpMatch) {
      const name = mfpMatch[1].trim();
      const kcal = parseInt(mfpMatch[3]) || 0;
      const qtyStr = mfpMatch[2] ? `${mfpMatch[2]} г` : '100 г';
      const macros = parseMacroValue(line, [macroPattern]);
      currentMeal.items.push({
        name,
        qty: qtyStr,
        kcal: kcal || macros.kcal,
        p: macros.p,
        f: macros.f,
        c: macros.c,
      });
      continue;
    }

    const macros = parseMacroValue(line, [macroPattern]);
    if (macros.kcal > 0 || macros.p > 0 || macros.f > 0 || macros.c > 0) {
      const namePart = line.split(/\d+(\s*)(ккал|кал|к|бел|жир|угл|г|мл)/i)[0].trim() || 'Неизвестно';
      const qtyMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(г|мл|шт|кусок|ложк|порц)/i);
      const qty = qtyMatch ? qtyMatch[0] : '100 г';
      currentMeal.items.push({
        name: namePart,
        qty,
        kcal: macros.kcal,
        p: macros.p,
        f: macros.f,
        c: macros.c,
      });
    }
  }

  return meals.filter(m => m.items.length > 0);
}

export function parseFatSecretText(text: string): ParsedMeal[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 1);
  const meals: ParsedMeal[] = [];
  let currentMeal: ParsedMeal | null = null;
  let currentDate = new Date().toISOString().slice(0, 10);

  for (const line of lines) {
    const totalCheck = /итого|всего|total|дневной/i.test(line);
    if (totalCheck) continue;

    const dateMatch = line.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
    if (dateMatch) currentDate = dateMatch[0];

    const mealMatch = line.match(/(завтрак|обед|ужин|перекус|бранч|полдник)/i);
    if (mealMatch) {
      currentMeal = { date: currentDate, mealType: mealMatch[1], items: [] };
      meals.push(currentMeal);
    }

    if (!currentMeal) {
      currentMeal = { date: currentDate, mealType: 'Приём пищи', items: [] };
      meals.push(currentMeal);
    }

    const kcalMatch = line.match(/(\d+)\s*ккал/);
    const proteinMatch = line.match(/(?:белки?|б|протеин)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i);
    const fatMatch = line.match(/(?:жиры?|ж)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i);
    const carbMatch = line.match(/(?:углевод|угл|у|карбо)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i);

    if (kcalMatch) {
      const namePart = line.slice(0, line.indexOf(kcalMatch[0])).replace(/^[\s\-–—•·*]+/, '').trim() || 'Блюдо';
      const qtyMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(г|мл|шт|порц|кусок)/i);
      currentMeal.items.push({
        name: namePart,
        qty: qtyMatch ? qtyMatch[0] : '100 г',
        kcal: parseInt(kcalMatch[1]) || 0,
        p: proteinMatch ? parseFloat(proteinMatch[1].replace(',', '.')) : 0,
        f: fatMatch ? parseFloat(fatMatch[1].replace(',', '.')) : 0,
        c: carbMatch ? parseFloat(carbMatch[1].replace(',', '.')) : 0,
      });
    }
  }

  return meals.filter(m => m.items.length > 0);
}
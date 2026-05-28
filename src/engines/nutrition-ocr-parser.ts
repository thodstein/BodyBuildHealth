export interface ParsedMeal {
  date: string;
  mealType: string;
  items: Array<{ name: string; qty: string; kcal: number; p: number; f: number; c: number }>;
}

export function parseNutritionScreenshot(text: string): ParsedMeal[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 3);
  const meals: ParsedMeal[] = [];
  let currentMeal: ParsedMeal | null = null;
  
  const dateRegex = /(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/;
  const mealRegex = /(завтрак|обед|ужин|перекус|бранч|полдник|snack|lunch|dinner|breakfast)/i;
  const macroRegex = /(\d+(?:[.,]\d+)?)\s*(ккал|кал|к|белки?|жиры?|углевод|угл|б|ж|у)/gi;
  const qtyRegex = /(\d+(?:[.,]\d+)?)\s*(г|мл|шт|кусок|ложк)/i;

  lines.forEach(line => {
    // Дата
    const dateMatch = line.match(dateRegex);
    if (dateMatch && !currentMeal) {
      currentMeal = { date: dateMatch[0], mealType: 'Общее', items: [] };
      meals.push(currentMeal);
    }

    // Тип приёма
    const mealMatch = line.match(mealRegex);
    if (mealMatch) {
      currentMeal = { date: currentMeal?.date || new Date().toISOString().slice(0,10), mealType: mealMatch[0], items: [] };
      meals.push(currentMeal);
    }

    if (!currentMeal) return;

    // Макросы/ккал в строке блюда
    const macros = line.match(macroRegex);
    if (macros) {
      const vals: Record<string, number> = {};
      macros.forEach(m => {
        const [num, unit] = m.replace(',', '.').split(/\s+/);
        const val = parseFloat(num);
        if (unit.match(/ккал|кал|к/i)) vals.kcal = val;
        else if (unit.match(/бел|б/i)) vals.p = val;
        else if (unit.match(/жир|ж/i)) vals.f = val;
        else if (unit.match(/углев|угл|у/i)) vals.c = val;
      });

      // Имя блюда (всё до макросов/веса)
      const namePart = line.split(/[0-9,.\s]+(?:ккал|к|бел|жир|угл|г|мл)/i)[0].trim() || 'Неизвестно';
      const qtyPart = line.match(qtyRegex)?.[0] || '';

      currentMeal.items.push({
        name: namePart,
        qty: qtyPart,
        kcal: vals.kcal || 0,
        p: vals.p || 0,
        f: vals.f || 0,
        c: vals.c || 0
      });
    }
  });

  // Группировка по дате, если приёмы не размечены
  return meals.filter(m => m.items.length > 0);
}
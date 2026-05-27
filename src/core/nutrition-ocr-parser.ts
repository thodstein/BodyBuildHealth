export interface ParsedMeal {
  name: string;
  protein: number;
  fats: number;
  carbs: number;
  calories: number;
  confidence: number;
  raw: string;
}

export function parseNutritionScreenshot(text: string): ParsedMeal[] {
  const meals: ParsedMeal[] = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 3);
  
  for (const line of lines) {
    // Pattern: Food Name Protein Fats Carbs Calories
    const mealMatch = line.match(
      /([А-ЯA-Z][а-яa-z\s\-\(\)\.]{3,40}?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i
    );
    
    if (mealMatch) {
      const protein = parseFloat(mealMatch[2]);
      const fats = parseFloat(mealMatch[3]);
      const carbs = parseFloat(mealMatch[4]);
      const calories = parseFloat(mealMatch[5]);
      
      if (protein > 0 && calories > 0) {
        meals.push({
          name: mealMatch[1].trim(),
          protein,
          fats,
          carbs,
          calories,
          confidence: 0.85,
          raw: line.trim()
        });
      }
    }
  }
  
  return meals;
}

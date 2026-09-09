export interface DiaryItem {
  name: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  qty?: number | string;
  category?: string;
  foodId?: string;
  micros?: Record<string, number>;
  confidence?: number;
  qtyGrams?: number;
}

export type FoodItemLike = { id: string; name: string; kcal: number; protein: number; fat: number; carbs: number; fiber?: number; category?: string; tier?: string; description?: string; isVegetarian?: boolean; isGlutenFree?: boolean; isDairyFree?: boolean };

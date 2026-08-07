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

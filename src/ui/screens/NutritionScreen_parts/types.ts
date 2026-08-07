export interface DiaryItem {
  name: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  qty?: number;
  category?: string;
  foodId?: string;
  micros?: Record<string, number>;
}

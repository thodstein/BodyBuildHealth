import { useState, useMemo } from 'react';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { aggregateDiaryMicros } from '../../diary-storage';
import { calcMealQuality, getQualityLabel } from '../../../../../engines/nutrition-quality.engine';
import { useRecentFoods } from '../../useNutritionDiary';
import { formatDate, parseDateOnly } from '../../../../../core/utils/date-utils';
import { readJSONArr } from '../../diary-storage-v2';

export function useDiaryDay({ diaryData, refreshKey }: {
  diaryData: Record<string, any>;
  refreshKey: number;
}) {
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));

  const weekStart = useMemo(() => { const d = parseDateOnly(selectedDate); const day = d.getDay(); d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); return d; }, [selectedDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return formatDate(d); }), [weekStart]);

  const dayMeals = diaryData[selectedDate]?.meals || {};

  const dayTotals = useMemo(() => {
    try {
      const items = Object.values(dayMeals).filter(Array.isArray).flat().filter((i: any) => i && typeof i === 'object');
      return {
        kcal: items.reduce((s: number, i: any) => s + (i.kcal || 0), 0),
        p: items.reduce((s: number, i: any) => s + (i.p || 0), 0),
        f: items.reduce((s: number, i: any) => s + (i.f || 0), 0),
        c: items.reduce((s: number, i: any) => s + (i.c || 0), 0),
      };
    } catch { return { kcal: 0, p: 0, f: 0, c: 0 }; }
  }, [dayMeals, diaryData, refreshKey]);

  const dayMicros = useMemo(() => aggregateDiaryMicros(diaryData[selectedDate]), [diaryData, selectedDate, refreshKey]);

  const mealQuality = useMemo(() => {
    try {
      const items = Object.values(dayMeals).flat() as any[];
      if (items.length === 0) return null;
      return calcMealQuality(items);
    } catch { return null; }
  }, [dayMeals, refreshKey]);

  // Per-product usefulness from bb_quality_score stored in diary entries
  const dayQuality = useMemo(() => {
    try {
      const items = Object.values(dayMeals).flat().filter((i: any) => i && typeof i === 'object') as any[];
      if (items.length === 0) return null;
      let totalScore = 0;
      let scoredCount = 0;
      const perProduct: Array<{ name: string; score?: number; label: string; color: string }> = [];
      items.forEach((item: any) => {
        let score: number | undefined = item.qualityScore;
        if (score == null && item.foodId) {
          const food = FOOD_DB.find(f => f.id === item.foodId);
          score = food?.bb_quality_score;
        }
        if (score == null && item.name) {
          const food = FOOD_DB.find(f => f.name.toLowerCase() === (item.name || '').toLowerCase());
          score = food?.bb_quality_score;
        }
        if (score != null && Number.isFinite(score)) {
          totalScore += score;
          scoredCount++;
          const { label, color } = getQualityLabel(score * 10); // scale 1-10 → 0-100
          perProduct.push({ name: item.name, score, label, color });
        }
      });
      const avg = scoredCount > 0 ? Math.round(totalScore / scoredCount * 10) / 10 : null;
      return { avg, scoredCount, total: items.length, perProduct };
    } catch { return null; }
  }, [dayMeals, refreshKey]);

  const favoriteFoods = useMemo(() => {
    const favs = readJSONArr<string>('he_food_favs');
    return favs.map(id => FOOD_DB.find(f => f.id === id)).filter(Boolean) as typeof FOOD_DB;
  }, [refreshKey]);

  const recentFoods = useRecentFoods(diaryData as any, 10);

  return {
    selectedDate, setSelectedDate, weekStart, weekDays,
    dayMeals, dayTotals, dayMicros, mealQuality, dayQuality,
    favoriteFoods, recentFoods,
  };
}

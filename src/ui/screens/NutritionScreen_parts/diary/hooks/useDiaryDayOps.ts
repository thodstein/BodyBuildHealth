import { useState, useCallback } from 'react';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { fillMissingMicros, quantityToGrams } from '../../../../../engines/nutrition-ocr-parser';
import { addFiberMicros } from '../../../../../core/nutrition-micros';
import { mergeMealsFromPrevious, previousDateKey } from '../diary-quick-repeat';
import { withDiaryItemQty } from '../diary-item-qty';

export function useDiaryDayOps({ diaryData, selectedDate, saveDiary, showToast, safeSet }: {
  diaryData: Record<string, any>;
  selectedDate: string;
  saveDiary: (data: any) => void;
  showToast: (msg: string) => void;
  safeSet: (key: string, data: any) => void;
}) {
  const [editItem, setEditItem] = useState<{ meal: string; idx: number; item: any } | null>(null);
  const [editQty, setEditQty] = useState(100);
  const [copySource, setCopySource] = useState<string | null>(null);
  const [copiedDay, setCopiedDay] = useState<string | null>(null);
  const [clearDayConfirmOpen, setClearDayConfirmOpen] = useState(false);
  const [foodPatterns, setFoodPatterns] = useState<Record<string, string[]>>(() => { try { return JSON.parse(localStorage.getItem('he_food_patterns') || '{}'); } catch { return {}; } });
  const [foodTriggers, setFoodTriggers] = useState<Record<string, string[]>>(() => { try { return JSON.parse(localStorage.getItem('he_food_triggers') || '{}'); } catch { return {}; } });
  const [mealMood, setMealMood] = useState<Record<string, { satiety: number; enjoyment: number; note: string }>>(() => { try { return JSON.parse(localStorage.getItem('he_meal_mood') || '{}'); } catch { return {}; } });

  const deleteItem = useCallback((meal: string, idx: number) => {
    const data = { ...diaryData };
    if (!data[selectedDate]?.meals?.[meal]) return;
    data[selectedDate].meals[meal] = data[selectedDate].meals[meal].filter((_: any, i: number) => i !== idx);
    if (data[selectedDate].meals[meal].length === 0) delete data[selectedDate].meals[meal];
    if (Object.keys(data[selectedDate].meals).length === 0) delete data[selectedDate];
    saveDiary(data);
    showToast('🗑 Удалено');
  }, [diaryData, selectedDate, saveDiary, showToast]);

  const clearDay = useCallback(() => {
    if (!diaryData[selectedDate]) return;
    setClearDayConfirmOpen(true);
  }, [diaryData, selectedDate]);

  const confirmClearDay = useCallback(() => {
    const data = { ...diaryData };
    delete data[selectedDate];
    saveDiary(data);
    setClearDayConfirmOpen(false);
    showToast('🗑 День очищен');
  }, [diaryData, selectedDate, saveDiary, showToast]);

  const openEdit = useCallback((meal: string, idx: number, item: any) => {
    setEditItem({ meal, idx, item });
    // qty бывает и строкой «100 г» (продукты), и числом (рецепт из «Кухни»).
    const match = typeof item.qty === 'number'
      ? String(Math.round(item.qty))
      : String(item.qty ?? '').match(/(\d+(?:[.,]\d+)?)/)?.[1];
    setEditQty(match ? Number.parseFloat(match.replace(',', '.')) : 100);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editItem) return;
    const data = { ...diaryData };
    if (!data[selectedDate]?.meals?.[editItem.meal]) return;
    const day = data[selectedDate];
    const items = [...day.meals[editItem.meal]];
    const current = items[editItem.idx];
    if (!current) return;
    // Пересчёт порции живёт в `diary-item-qty`: тем же кодом правит запись
    // виджет, иначе дневник и домашний экран показывали бы разные числа.
    items[editItem.idx] = withDiaryItemQty(current, editQty);
    data[selectedDate] = { ...day, meals: { ...day.meals, [editItem.meal]: items } };
    saveDiary(data);
    setEditItem(null);
    showToast('✅ Количество обновлено');
  }, [editItem, diaryData, selectedDate, editQty, saveDiary, showToast]);

  const copyMeal = useCallback((meal: string) => {
    setCopySource(meal);
    showToast(`📋 «${meal}» скопирован. Выберите день.`);
  }, [showToast]);

  const pasteMeal = useCallback((targetDate: string) => {
    if (!copySource || !diaryData[selectedDate]?.meals?.[copySource]) {
      showToast('❌ Буфер пуст — скопируйте приём сначала');
      return;
    }
    const data = { ...diaryData };
    if (!data[targetDate]) data[targetDate] = { meals: {} };
    data[targetDate].meals[copySource] = JSON.parse(JSON.stringify(diaryData[selectedDate].meals[copySource]));
    saveDiary(data);
    setCopySource(null);
    showToast(`✅ Вставлено в ${targetDate}`);
  }, [copySource, diaryData, selectedDate, saveDiary, showToast]);

  const copyDay = useCallback(() => {
    if (!diaryData[selectedDate]?.meals) { showToast('❌ День пуст'); return; }
    setCopiedDay(selectedDate);
    showToast(`📋 День ${selectedDate} скопирован — выберите дату и Вставить`);
  }, [diaryData, selectedDate, showToast]);

  const pasteDay = useCallback((targetDate: string) => {
    if (!copiedDay || !diaryData[copiedDay]) {
      showToast('❌ Буфер пуст — скопируйте день сначала');
      return;
    }
    const data = { ...diaryData };
    data[targetDate] = { meals: JSON.parse(JSON.stringify(diaryData[copiedDay].meals)) };
    saveDiary(data);
    showToast(`✅ День ${copiedDay} → ${targetDate}`);
  }, [copiedDay, diaryData, saveDiary, showToast]);

  /**
   * «Как вчера»: переносит приёмы предыдущего дня в выбранный.
   * Только добавление, дубликаты (то же имя и количество) пропускаются —
   * повторное нажатие не удваивает калории.
   */
  const repeatPreviousDay = useCallback(() => {
    const sourceDate = previousDateKey(selectedDate);
    const source = diaryData[sourceDate]?.meals as Record<string, any[]> | undefined;
    if (!source || Object.keys(source).length === 0) {
      showToast(`❌ За ${sourceDate} записей нет`);
      return;
    }
    const target = diaryData[selectedDate]?.meals as Record<string, any[]> | undefined;
    const { meals, added, skipped } = mergeMealsFromPrevious(target, source);
    if (added === 0) {
      showToast('ℹ️ Всё уже перенесено — дубликатов нет');
      return;
    }
    const data = { ...diaryData };
    data[selectedDate] = { ...(data[selectedDate] || {}), meals };
    saveDiary(data);
    showToast(`↩ Из ${sourceDate}: +${added} поз.${skipped > 0 ? ` (${skipped} уже были)` : ''}`);
  }, [diaryData, selectedDate, saveDiary, showToast]);

  const saveMealMood = useCallback((date: string, mood: { satiety: number; enjoyment: number; note: string }) => {    const upd = { ...mealMood, [date]: mood };
    setMealMood(upd);
    safeSet('he_meal_mood', upd);
  }, [mealMood, safeSet]);

  const savePatterns = useCallback((date: string, patterns: string[]) => {
    const upd = { ...foodPatterns, [date]: patterns };
    setFoodPatterns(upd);
    safeSet('he_food_patterns', upd);
  }, [foodPatterns, safeSet]);

  const saveTriggers = useCallback((date: string, triggers: string[]) => {
    const upd = { ...foodTriggers, [date]: triggers };
    setFoodTriggers(upd);
    safeSet('he_food_triggers', upd);
  }, [foodTriggers, safeSet]);

  const importFromPlan = useCallback(() => {
    try {
      const plans = JSON.parse(localStorage.getItem('he_saved_nutrition_plans') || '[]');
      if (plans.length === 0) { showToast('❌ Нет сохранённых планов'); return; }
      const latest = plans[0];
      const meals = latest.dayPlan?.meals || [];
      if (meals.length === 0) { showToast('❌ План пуст — нет приёмов'); return; }
      const data = { ...diaryData };
      if (!data[selectedDate]) data[selectedDate] = { meals: {} };
      meals.forEach((m: any) => {
        const label = m.label || 'Приём пищи';
        if (!data[selectedDate].meals[label]) data[selectedDate].meals[label] = [];
        (Array.isArray(m.items) ? m.items : []).forEach((it: any) => {
          // Позиции плана приходят без микросов: клетчатку берём из каталога,
          // остальные микро импорт плана не дополняет (это его прежнее поведение).
          const planFoodId = it.id || it.foodId;
          const planFood = (planFoodId ? FOOD_DB.find((f) => f.id === planFoodId) : undefined)
            || FOOD_DB.find((f) => f.name.toLowerCase() === String(it.name || '').toLowerCase());
          data[selectedDate].meals[label].push({ name: it.name, qty: Number(it.amount) || 100, kcal: it.kcal || 0, p: it.p || 0, f: it.f || 0, c: it.c || 0, category: it.category, foodId: it.id || it.foodId, micros: addFiberMicros(it.micros, planFood as any, Number(it.amount) || 100) });
        });
      });
      saveDiary(data);
      showToast('✅ Импортировано из плана');
    } catch { showToast('❌ Ошибка импорта плана'); }
  }, [diaryData, selectedDate, saveDiary, showToast]);

  const fillDayMicros = useCallback(() => {
    const data = { ...diaryData };
    const day = data[selectedDate];
    if (!day?.meals) return;
    (Object.values(day.meals) as any[][]).forEach(items => items.forEach((item: any) => {
      const food = FOOD_DB.find(f => f.id === item.foodId) || FOOD_DB.find(f => f.name === item.name);
      const grams = quantityToGrams(String(item.qty || '100 г'), food);
      item.micros = fillMissingMicros(item.name, grams, item.micros);
    }));
    saveDiary(data);
    showToast('✨ Микронутриенты дополнены');
  }, [diaryData, selectedDate, saveDiary, showToast]);

  return {
    editItem, setEditItem, editQty, setEditQty, copySource, setCopySource, copiedDay,
    clearDayConfirmOpen, setClearDayConfirmOpen,
    foodPatterns, foodTriggers, mealMood,
    deleteItem, clearDay, confirmClearDay, openEdit, saveEdit,
    copyMeal, pasteMeal, copyDay, pasteDay, repeatPreviousDay,
    saveMealMood, savePatterns, saveTriggers,
    importFromPlan, fillDayMicros,
  };
}

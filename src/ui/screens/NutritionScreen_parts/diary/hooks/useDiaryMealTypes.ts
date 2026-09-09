import { useState, useEffect, useMemo, useCallback } from 'react';

const MEAL_PRESETS = ['Завтрак', 'Второй завтрак', 'Обед', 'Полдник', 'Ужин', 'Перекус', 'До тренировки', 'После тренировки', 'Поздний перекус'];

export function useDiaryMealTypes({ tab, safeSet, showToast }: {
  tab: string;
  safeSet: (key: string, data: any) => void;
  showToast: (msg: string) => void;
}) {
  const [mealType, setMealType] = useState('');
  const [customMeals, setCustomMeals] = useState<string[]>(() => { try { const value = JSON.parse(localStorage.getItem('he_custom_meals') || '[]'); return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []; } catch { return []; } });
  const [customMealInput, setCustomMealInput] = useState('');

  const allMealTypes = useMemo(() => [...MEAL_PRESETS, ...customMeals], [customMeals]);

  // Auto-select first meal type
  useEffect(() => { if (!mealType && allMealTypes.length > 0) setMealType(allMealTypes[0]); }, [tab, allMealTypes, mealType]);

  const addCustomMeal = useCallback(() => {
    const name = customMealInput.trim();
    if (!name) {
      showToast('❌ Введите название приёма');
      return;
    }
    if (customMeals.includes(name)) {
      showToast('⚠️ Такой приём уже есть');
      return;
    }
    const updated = [...customMeals, name];
    setCustomMeals(updated);
    safeSet('he_custom_meals', updated);
    setCustomMealInput('');
    showToast('✅ Приём добавлен');
  }, [customMealInput, customMeals, safeSet, showToast]);

  return { mealType, setMealType, allMealTypes, customMealInput, setCustomMealInput, addCustomMeal };
}

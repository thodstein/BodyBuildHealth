import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

const MEAL_PRESETS = ['Завтрак', 'Второй завтрак', 'Обед', 'Полдник', 'Ужин', 'Перекус', 'До тренировки', 'После тренировки', 'Поздний перекус'];

/** Приём пищи по времени суток — разумный дефолт вместо всегда «Завтрак»:
 *  в 20:00 добавленная еда не должна молча падать в завтрак. */
export function mealForNow(date: Date = new Date()): string {
  const h = date.getHours();
  if (h >= 5 && h < 11) return 'Завтрак';
  if (h >= 11 && h < 16) return 'Обед';
  if (h >= 16 && h < 22) return 'Ужин';
  return 'Перекус';
}

export function useDiaryMealTypes({ tab, safeSet, showToast }: {
  tab: string;
  safeSet: (key: string, data: any) => void;
  showToast: (msg: string) => void;
}) {
  const [mealType, setMealTypeState] = useState('');
  const [customMeals, setCustomMeals] = useState<string[]>(() => { try { const value = JSON.parse(localStorage.getItem('he_custom_meals') || '[]'); return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []; } catch { return []; } });
  const [customMealInput, setCustomMealInput] = useState('');

  const allMealTypes = useMemo(() => [...MEAL_PRESETS, ...customMeals], [customMeals]);

  // Выбор пользователя (в т.ч. сброс чипа) не перетираем: дефолт ставим один раз.
  const mealTouched = useRef(false);
  const setMealType = useCallback((v: string) => { mealTouched.current = true; setMealTypeState(v); }, []);

  useEffect(() => {
    if (mealTouched.current || allMealTypes.length === 0) return;
    const guess = mealForNow();
    setMealTypeState(allMealTypes.includes(guess) ? guess : allMealTypes[0]);
  }, [tab, allMealTypes]);

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

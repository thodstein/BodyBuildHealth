import { useEffect, useState } from 'react';
import { CUSTOM_FOODS_CHANGED_EVENT, loadCustomFoods, type CustomFoodEntry } from '../../../../../engines/meal-custom-food';

/** Свои продукты с живым обновлением после фото упаковки/сканера. */
export function useCustomFoods(): CustomFoodEntry[] {
  const [foods, setFoods] = useState<CustomFoodEntry[]>(() => loadCustomFoods());

  useEffect(() => {
    const reload = () => setFoods(loadCustomFoods());
    window.addEventListener(CUSTOM_FOODS_CHANGED_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(CUSTOM_FOODS_CHANGED_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  return foods;
}

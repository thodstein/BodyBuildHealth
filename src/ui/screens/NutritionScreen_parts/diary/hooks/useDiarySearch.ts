import { useState, useEffect } from 'react';
import { type FoodItemLike } from '../../types';

export function useDiarySearch() {
  const [foodSearch, setFoodSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [usdaFoods, setUsdaFoods] = useState<FoodItemLike[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(foodSearch), 250);
    return () => clearTimeout(t);
  }, [foodSearch]);

  // Lazy-load USDA
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      import('../../../../../data/usda-foods').then(m => {
        if (!cancelled && m.USDA_FOODS) {
          try { setUsdaFoods(m.USDA_FOODS.slice(0, 5000)); } catch { setUsdaFoods([]); }
        }
      }).catch(() => { setUsdaFoods([]); });
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  return { foodSearch, setFoodSearch, debouncedSearch, usdaFoods };
}

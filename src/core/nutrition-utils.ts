export const CAT_MAP_LABEL: Record<string, string> = {
  protein: '🥩 Мясо/Рыба', carb: '🥔 Углеводы', fat: '🧈 Жиры', dairy: '🥛 Молочка',
  veg_fruit: '🥦 Овощи/Фрукты', grain: '🌾 Крупы', supplement: '💊 Добавки',
  fast_food: '🍔 Фаст-фуд', other: '📦 Прочее',
};

export const CAT_MAP_EMOJI: Record<string, string> = {
  protein: '🥩', carb: '🥔', fat: '🧈', dairy: '🥛',
  veg_fruit: '🥦', grain: '🌾', supplement: '💊', fast_food: '🍔', other: '📦',
};

export function addToCart(item: { name: string; kcal: number; amount?: number; category?: string }) {
  try {
    const cart = JSON.parse(localStorage.getItem('he_nutrition_cart') || '[]');
    cart.push({ ...item, kcal: Math.round(item.kcal), amount: item.amount ?? 100, category: item.category ?? 'other' });
    localStorage.setItem('he_nutrition_cart', JSON.stringify(cart));
  } catch {}
}

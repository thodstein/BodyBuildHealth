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
    const storeId = localStorage.getItem('he_active_store_id') || '';
    const carts: CartStore[] = JSON.parse(localStorage.getItem('he_nutrition_carts') || '[]');
    if (!storeId || !carts.find(s => s.id === storeId)) {
      const id = 'store_' + Date.now();
      carts.push({ id, name: 'Основной список', notes: '', sortOrder: 0, items: [] });
      localStorage.setItem('he_active_store_id', id);
    }
    const si = carts.findIndex(s => s.id === (storeId && carts.find(ss => ss.id === storeId) ? storeId : carts[0].id));
    if (si >= 0) {
      carts[si].items.push({
        id: 'ci_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: item.name, kcal: Math.round(item.kcal), amount: item.amount ?? 100,
        category: item.category ?? 'other', price: 0, note: '',
      });
      localStorage.setItem('he_nutrition_carts', JSON.stringify(carts));
    }
  } catch {}
}

export interface CartItemEnhanced {
  id: string;
  name: string;
  kcal: number;
  amount: number;
  category: string;
  price: number;
  note: string;
}
export interface CartStore {
  id: string;
  name: string;
  notes: string;
  sortOrder: number;
  items: CartItemEnhanced[];
}
export const CART_CAT_LABELS: Record<string, string> = {
  protein: '🥩 Мясо/рыба', dairy: '🥛 Молочка', carb: '🍚 Крупы', grain: '🌾 Зерновые',
  fat: '🧈 Жиры/масла', veg_fruit: '🥦 Овощи/фрукты', fast_food: '🍔 Фастфуд',
  supplement: '💊 Добавки', other: '📦 Прочее',
};
export function getCarts(): CartStore[] {
  try { return JSON.parse(localStorage.getItem('he_nutrition_carts') || '[]'); } catch { return []; }
}
export function saveCarts(carts: CartStore[]) {
  localStorage.setItem('he_nutrition_carts', JSON.stringify(carts));
}
export function getActiveStoreId(): string {
  return localStorage.getItem('he_active_store_id') || '';
}
export function setActiveStoreId(id: string) {
  localStorage.setItem('he_active_store_id', id);
}

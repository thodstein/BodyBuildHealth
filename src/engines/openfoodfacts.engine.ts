import { db } from '../core/db';

export interface OFFProduct {
  id: string;
  barcode: string;
  name: string;
  nameRu?: string;
  brand?: string;
  categories?: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  servingSize: string;
  imageUrl?: string;
  cachedAt: number;
}

const OFF_API = 'https://ru.openfoodfacts.org/api/v0';
const CACHE_STORE = 'food_cache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

function normalizeProduct(p: any): OFFProduct | null {
  const nutriments = p.nutriments || {};
  const name = p.product_name_ru || p.product_name || '';
  if (!name) return null;
  return {
    id: p.code || p._id || '',
    barcode: p.code || '',
    name,
    nameRu: p.product_name_ru || undefined,
    brand: p.brands || undefined,
    categories: p.categories || undefined,
    kcal: Math.round(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0),
    protein: Math.round((nutriments.proteins_100g || 0) * 10) / 10,
    fat: Math.round((nutriments.fat_100g || 0) * 10) / 10,
    carbs: Math.round((nutriments.carbohydrates_100g || 0) * 10) / 10,
    fiber: Math.round((nutriments.fiber_100g || 0) * 10) / 10,
    servingSize: p.serving_quantity ? `${p.serving_quantity} г` : '100 г',
    imageUrl: p.image_small_url || p.image_front_small_url || undefined,
    cachedAt: Date.now(),
  };
}

async function getCached(barcode: string): Promise<OFFProduct | null> {
  try {
    const cached = await db.get<OFFProduct>(CACHE_STORE, barcode);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) return cached;
    if (cached) await db.delete(CACHE_STORE, barcode);
    return null;
  } catch {
    return null;
  }
}

async function cacheProduct(product: OFFProduct): Promise<void> {
  try {
    await db.put(CACHE_STORE, product);
  } catch {}
}

export async function searchByBarcode(barcode: string): Promise<OFFProduct | null> {
  const cached = await getCached(barcode);
  if (cached) return cached;

  try {
    const res = await fetch(`${OFF_API}/product/${barcode}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const product = normalizeProduct(data.product);
    if (!product) return null;
    await cacheProduct(product);
    return product;
  } catch {
    return null;
  }
}

export async function searchByName(query: string, pageSize = 20): Promise<OFFProduct[]> {
  const cached = await searchCacheByName(query);
  if (cached.length > 0) return cached;

  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(`${OFF_API}/search?search_terms=${encoded}&page_size=${pageSize}&json=1`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.products) return [];
    const products: OFFProduct[] = [];
    for (const p of data.products) {
      const norm = normalizeProduct(p);
      if (norm) {
        await cacheProduct(norm);
        products.push(norm);
      }
    }
    return products;
  } catch {
    return [];
  }
}

async function searchCacheByName(query: string): Promise<OFFProduct[]> {
  try {
    const all = await db.getAll<OFFProduct>(CACHE_STORE);
    const q = query.toLowerCase();
    return all.filter(p =>
      Date.now() - p.cachedAt < CACHE_TTL &&
      (p.name.toLowerCase().includes(q) || (p.nameRu && p.nameRu.toLowerCase().includes(q)) || (p.brand && p.brand.toLowerCase().includes(q)))
    ).slice(0, 20);
  } catch {
    return [];
  }
}

export function productToFoodItem(p: OFFProduct) {
  return {
    id: p.barcode || p.id,
    name: p.name,
    category: 'other' as const,
    kcal: p.kcal,
    protein: p.protein,
    fat: p.fat,
    carbs: p.carbs,
    fiber: p.fiber,
    gi: 0,
    servingSize: p.servingSize,
    description: [p.brand, p.categories].filter(Boolean).join(' • '),
    tier: 'basic' as const,
  };
}
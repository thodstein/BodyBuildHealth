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
  micros?: {
    saturatedFat?: number;
    sugars?: number;
    sodium?: number;
    calcium?: number;
    iron?: number;
    magnesium?: number;
    potassium?: number;
    vitaminC?: number;
    vitaminD?: number;
    vitaminB12?: number;
  };
}

const OFF_API = 'https://ru.openfoodfacts.org/api/v0';
const CACHE_STORE = 'food_cache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

function round1(v: number | undefined): number | undefined {
  return v !== undefined && v !== null ? Math.round(v * 10) / 10 : undefined;
}

function normalizeProduct(p: any): OFFProduct | null {
  const nutriments = p.nutriments || {};
  const name = p.product_name_ru || p.product_name || '';
  if (!name) return null;
  const n = (field: string) => nutriments[field + '_100g'] ?? nutriments[field];
  return {
    id: p.code || p._id || '',
    barcode: p.code || '',
    name,
    nameRu: p.product_name_ru || undefined,
    brand: p.brands || undefined,
    categories: p.categories || undefined,
    kcal: Math.round(n('energy-kcal') || 0),
    protein: round1(n('proteins')) || 0,
    fat: round1(n('fat')) || 0,
    carbs: round1(n('carbohydrates')) || 0,
    fiber: round1(n('fiber')) || 0,
    servingSize: p.serving_quantity ? `${p.serving_quantity} г` : '100 г',
    imageUrl: p.image_small_url || p.image_front_small_url || undefined,
    cachedAt: Date.now(),
    micros: {
      saturatedFat: round1(n('saturated-fat')),
      sugars: round1(n('sugars')),
      sodium: round1(n('sodium')),
      calcium: round1(n('calcium')),
      iron: round1(n('iron')),
      magnesium: round1(n('magnesium')),
      potassium: round1(n('potassium')),
      vitaminC: round1(n('vitamin-c')),
      vitaminD: n('vitamin-d'),
      vitaminB12: n('vitamin-b12'),
    },
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
    saturatedFat: p.micros?.saturatedFat,
    sugars: p.micros?.sugars,
    sodium: p.micros?.sodium,
    calcium: p.micros?.calcium,
    iron: p.micros?.iron,
    magnesium: p.micros?.magnesium,
    potassium: p.micros?.potassium,
    vitaminC: p.micros?.vitaminC,
    vitaminD: p.micros?.vitaminD,
    vitaminB12: p.micros?.vitaminB12,
    gi: 0,
    servingSize: p.servingSize,
    description: [p.brand, p.categories].filter(Boolean).join(' • '),
    tier: 'basic' as const,
  };
}
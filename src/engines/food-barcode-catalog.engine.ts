import type { OFFProduct } from './openfoodfacts.engine';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const TABLE = 'food_barcode_catalog';

function cleanBarcode(raw: string): string {
  return (raw || '').replace(/\D/g, '').trim();
}

function enabled(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON);
}

function headers(): HeadersInit {
  return { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, Accept: 'application/json' };
}

function mapRow(row: any): OFFProduct | null {
  const barcode = cleanBarcode(String(row?.barcode || ''));
  const name = String(row?.name || '').trim();
  if (!barcode || !name) return null;
  return {
    id: barcode,
    barcode,
    name,
    brand: row.brand || undefined,
    kcal: Number(row.kcal) || 0,
    protein: Number(row.protein) || 0,
    fat: Number(row.fat) || 0,
    carbs: Number(row.carbs) || 0,
    fiber: Number(row.fiber) || 0,
    servingSize: row.serving_size || '100 г',
    category: row.category || 'other',
    cachedAt: Date.now(),
  };
}

export async function searchSharedBarcode(barcode: string): Promise<OFFProduct | null> {
  const bc = cleanBarcode(barcode);
  if (!enabled() || !bc) return null;
  try {
    const query = `${SUPABASE_URL}/rest/v1/${TABLE}?select=*&barcode=eq.${encodeURIComponent(bc)}&limit=1`;
    const res = await fetch(query, { headers: headers(), signal: AbortSignal.timeout?.(5000) });
    if (!res.ok) return null;
    const rows = await res.json();
    return mapRow(Array.isArray(rows) ? rows[0] : null);
  } catch {
    return null;
  }
}

export async function saveSharedBarcode(product: OFFProduct): Promise<boolean> {
  const barcode = cleanBarcode(product.barcode || product.id);
  if (!enabled() || !barcode || barcode.length < 8) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({
        barcode,
        name: product.name.trim(),
        brand: product.brand || null,
        kcal: Math.max(0, Number(product.kcal) || 0),
        protein: Math.max(0, Number(product.protein) || 0),
        fat: Math.max(0, Number(product.fat) || 0),
        carbs: Math.max(0, Number(product.carbs) || 0),
        fiber: Math.max(0, Number(product.fiber) || 0),
        serving_size: product.servingSize || '100 г',
        category: product.category || 'other',
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { saveOrUpdateCustomFood, type CustomFoodEntry } from '../../../../engines/meal-custom-food';
import type { FoodItem } from '../../../../core/nutrition-database';

/**
 * AddToBaseModal — «Добавить продукт в базу» с указанием КБЖУ, марки,
 * штрихкода и порции. Открывается из поиска (с уже заполненными полями
 * найденного продукта) и из плитки «Добавить продукт» на пустом поиске.
 *
 * Сохраняет через saveOrUpdateCustomFood: повторный товар с тем же
 * штрихкодом/названием обновляет запись, а не плодит дубли. При наличии
 * штрихкода кладёт товар и в общий кэш/базу штрихкодов — сканер найдет
 * продукт без интернета.
 */

export interface BaseFoodInitial {
  id?: string;
  name?: string;
  brand?: string;
  barcode?: string;
  kcal?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
  servingSize?: string;
  category?: FoodItem['category'];
  description?: string;
}

interface Props {
  open: boolean;
  initial?: BaseFoodInitial | null;
  onClose: () => void;
  onSaved?: (entry: CustomFoodEntry) => void;
}

const CATEGORIES: { value: FoodItem['category']; label: string }[] = [
  { value: 'protein', label: 'Белки' },
  { value: 'carb', label: 'Углеводы' },
  { value: 'fat', label: 'Жиры' },
  { value: 'dairy', label: 'Молочные' },
  { value: 'veg_fruit', label: 'Овощи/Фрукты' },
  { value: 'grain', label: 'Злаки' },
  { value: 'supplement', label: 'Добавки' },
  { value: 'fast_food', label: 'Фастфуд' },
  { value: 'other', label: 'Другое' },
];

interface FormState {
  name: string;
  brand: string;
  barcode: string;
  servingSize: string;
  kcal: string;
  protein: string;
  fat: string;
  carbs: string;
  fiber: string;
  category: FoodItem['category'];
  description: string;
}

const EMPTY: FormState = {
  name: '', brand: '', barcode: '', servingSize: '100 г',
  kcal: '', protein: '', fat: '', carbs: '', fiber: '',
  category: 'other', description: '',
};

const num = (v: string): number => {
  const n = Number.parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 12,
  background: '#242428', border: '1px solid rgba(255,255,255,0.09)', color: '#fff',
  fontSize: 16, outline: 'none', minHeight: 46,
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
  marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3,
};

function fromInitial(initial?: BaseFoodInitial | null): FormState {
  if (!initial) return { ...EMPTY };
  const put = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
  return {
    name: initial.name || '',
    brand: initial.brand || '',
    barcode: String(initial.barcode || '').replace(/\D/g, ''),
    servingSize: initial.servingSize || '100 г',
    kcal: put(initial.kcal),
    protein: put(initial.protein),
    fat: put(initial.fat),
    carbs: put(initial.carbs),
    fiber: put(initial.fiber),
    category: initial.category || 'other',
    description: initial.description || '',
  };
}

export const AddToBaseModal: React.FC<Props> = ({ open, initial, onClose, onSaved }) => {
  const [form, setForm] = useState<FormState>(() => fromInitial(initial));
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(fromInitial(initial));
      setError('');
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = (key: keyof FormState, value: string) => setForm(f => ({ ...f, [key]: value }));

  const save = () => {
    const name = form.name.trim();
    if (!name) { setError('Укажите название продукта'); return; }
    const kcal = num(form.kcal);
    if (kcal <= 0) { setError('Укажите калорийность на 100 г'); return; }

    const barcode = form.barcode.replace(/\D/g, '');
    const entry: CustomFoodEntry = {
      id: initial?.id || `custom_${Date.now()}`,
      name,
      brand: form.brand.trim() || undefined,
      barcode: barcode || undefined,
      description: form.description.trim() || 'Свой продукт',
      kcal,
      protein: num(form.protein),
      fat: num(form.fat),
      carbs: num(form.carbs),
      fiber: num(form.fiber),
      category: form.category,
      servingSize: form.servingSize.trim() || '100 г',
      source: 'manual',
    };

    const saved = saveOrUpdateCustomFood(entry);

    // Штрихкод — в общий кэш и shared-базу: сканер должен находить продукт
    // офлайн. Fire-and-forget: без сети локальная запись уже сохранена.
    if (barcode.length >= 8) {
      void (async () => {
        try {
          const off = await import('../../../../engines/openfoodfacts.engine');
          const product = {
            id: barcode,
            barcode,
            name: saved.name,
            brand: saved.brand,
            category: saved.category,
            kcal: saved.kcal,
            protein: saved.protein,
            fat: saved.fat,
            carbs: saved.carbs,
            fiber: saved.fiber,
            servingSize: saved.servingSize,
            cachedAt: Date.now(),
          } as import('../../../../engines/openfoodfacts.engine').OFFProduct;
          await off.saveToCache(product);
          const shared = await import('../../../../engines/food-barcode-catalog.engine');
          await shared.saveSharedBarcode(product);
        } catch { /* офлайн — локальная запись уже есть */ }
      })();
    }

    onSaved?.(saved);
    try {
      if (typeof (window as any).showToast === 'function') {
        (window as any).showToast(`🏷 «${saved.name}» добавлен в базу`, 'success');
      }
    } catch { /* ignore */ }
    onClose();
  };

  const sheet = (
    <div
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1210,
        background: 'rgba(0,0,0,0.66)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Добавить продукт в базу"
        className="nd-base-modal"
        style={{
          width: '100%', maxWidth: 560, maxHeight: '92dvh', overflowY: 'auto',
          background: 'linear-gradient(180deg,#1d1d21,#161619)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none',
          boxShadow: '0 -18px 50px rgba(0,0,0,0.55)',
          padding: '14px 14px calc(14px + max(env(safe-area-inset-bottom, 0px), 12px))',
          color: '#fff',
        }}
      >
        <div style={{ width: 42, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.2)', margin: '0 auto 12px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏷</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Добавить продукт в базу</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>КБЖУ на 100 г · сохранится для поиска и сканера</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть добавление продукта"
            style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <label style={labelStyle} htmlFor="nd-base-name">Название *</label>
            <input id="nd-base-name" value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Например: Творог 5% Простоквашино" aria-label="Название продукта"
              style={inputStyle} autoComplete="off" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle} htmlFor="nd-base-brand">Марка</label>
              <input id="nd-base-brand" value={form.brand} onChange={e => set('brand', e.target.value)}
                placeholder="Простоквашино" aria-label="Марка" style={inputStyle} autoComplete="off" />
            </div>
            <div>
              <label style={labelStyle} htmlFor="nd-base-barcode">Штрихкод</label>
              <input id="nd-base-barcode" value={form.barcode} onChange={e => set('barcode', e.target.value)}
                placeholder="4600000000000" aria-label="Штрихкод" inputMode="numeric" style={inputStyle} autoComplete="off" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle} htmlFor="nd-base-serving">Порция / упаковка</label>
              <input id="nd-base-serving" value={form.servingSize} onChange={e => set('servingSize', e.target.value)}
                placeholder="100 г" aria-label="Размер порции" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="nd-base-cat">Категория</label>
              <select id="nd-base-cat" value={form.category} onChange={e => set('category', e.target.value)}
                aria-label="Категория" style={inputStyle}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {([
              { k: 'kcal', l: 'Ккал', v: form.kcal },
              { k: 'protein', l: 'Белки', v: form.protein },
              { k: 'fat', l: 'Жиры', v: form.fat },
              { k: 'carbs', l: 'Углев.', v: form.carbs },
            ] as const).map(f => (
              <div key={f.k}>
                <label style={labelStyle} htmlFor={`nd-base-${f.k}`}>{f.l}</label>
                <input id={`nd-base-${f.k}`} type="number" inputMode="decimal" min={0} value={f.v}
                  onChange={e => set(f.k, e.target.value)} aria-label={f.l} style={inputStyle} />
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
            <div>
              <label style={labelStyle} htmlFor="nd-base-fiber">Клетчатка</label>
              <input id="nd-base-fiber" type="number" inputMode="decimal" min={0} value={form.fiber}
                onChange={e => set('fiber', e.target.value)} aria-label="Клетчатка" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="nd-base-desc">Описание</label>
              <input id="nd-base-desc" value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Состав, особенности" aria-label="Описание" style={inputStyle} />
            </div>
          </div>

          {error && (
            <div role="alert" style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 11, fontWeight: 600 }}>{error}</div>
          )}

          <button
            type="button"
            onClick={save}
            aria-label="Сохранить продукт в базу"
            className="nd-base-save"
            style={{ width: '100%', minHeight: 52, borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: '#fff', fontWeight: 800, fontSize: 13, marginTop: 2 }}
          >＋ Добавить в продукты</button>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.42)', textAlign: 'center', lineHeight: 1.4 }}>
            Продукт появится в поиске дневника и в разделе «Свои продукты». Повторное сохранение с тем же штрихкодом обновит запись.
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
};

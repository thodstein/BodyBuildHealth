import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { FOOD_DB } from '../../core/nutrition-database';
import { useDataLink, derivePAL } from '../../core/data-link';
import { getRecipes } from '../../engines/nutrition-periodization.engine';
import { calcNutrition } from '../../engines/nutrition.engine';
import { calcNutritionV2 } from '../../engines/nutrition-v2.engine';
import { checkMetabolicAdaptation, suggestNextPhase } from '../../engines/nutrition-periodization-v2.engine';
import { NutritionDiary } from './NutritionScreen_parts/NutritionDiary';
import { IndividualPlan } from './NutritionScreen_parts/IndividualPlan';
import { NutritionReference } from './NutritionScreen_parts/NutritionReference';
import { addToCart, getCarts, saveCarts, getActiveStoreId, setActiveStoreId, CART_CAT_LABELS, CartStore, CartItemEnhanced } from '../../core/nutrition-utils';
import { NutritionCustomFood } from './NutritionScreen_parts/NutritionCustomFood';
import { NutritionOverview } from './NutritionScreen_parts/NutritionOverview';
import { ProductUsefulnessPlanner } from './NutritionScreen_parts/ProductUsefulnessPlanner';
import { ProgressTracker } from './NutritionScreen_parts/ProgressTracker';
import { NutriAdvisor } from './NutritionScreen_parts/NutriAdvisor';
import { CustomProducts } from './NutritionScreen_parts/CustomProducts';
import { MealVisualizer } from './NutritionScreen_parts/MealVisualizer';
import { Achievements } from './NutritionScreen_parts/Achievements';
import { DailyQuests } from './NutritionScreen_parts/DailyQuests';
import { PeriWorkoutCard } from './NutritionScreen_parts/PeriWorkoutCard';

const NutritionCharts = lazy(() => import('./NutritionScreen_parts/NutritionCharts').then(m => ({ default: m.NutritionCharts })));
import { generateNutritionReport, NutritionReport } from '../../engines/nutrition-report.engine';
import { getNutritionV2Data, saveNutritionV2Data } from '../../core/nutrition-v2-data';
import { getQualityLabel } from '../../engines/nutrition-quality.engine';
import { InfoErrorBoundary } from './SupportScreen_parts/SupportScreenData';

interface DiaryEntry { name: string; kcal: number; p: number; f: number; c: number; date?: string; }
type NutritionPage = 'hero' | 'tabs';
type NutritionSection = 'diary' | 'planning' | 'overview' | 'analytics' | 'all';
type ActiveTab = 'diary' | 'charts' | 'mealplan' | 'cart' | 'favorites' | 'catalog' | 'reference' | 'recipes' | 'reports' | 'restaurant' | 'info' | 'customfood' | 'overview' | 'usefulness' | 'progress' | 'nutria' | 'visualize' | 'achievements' | 'quests' | 'peri';

const SECTION_TABS: Record<NutritionSection, string[]> = {
  overview: ['diary', 'charts', 'mealplan', 'cart', 'favorites', 'catalog', 'reference', 'recipes', 'reports', 'restaurant', 'customfood', 'overview', 'usefulness', 'progress', 'nutria', 'visualize', 'achievements', 'quests'],
  analytics: ['charts', 'reports'],
  diary: ['diary', 'charts', 'reports', 'peri'],
  planning: ['mealplan', 'catalog', 'favorites', 'reference', 'info', 'usefulness', 'recipes'],
  all: ['diary', 'charts', 'mealplan', 'cart', 'favorites', 'catalog', 'reference', 'recipes', 'reports', 'restaurant', 'customfood', 'overview', 'usefulness', 'progress', 'nutria', 'visualize', 'achievements', 'quests', 'peri'],
};

const TAB_LABELS: Record<string, string> = {
  diary: '📝 Дневник', charts: '📈 Графики',
  mealplan: '🥗 План', cart: '🛒 Корзина',
  restaurant: '🍽 Ресторан',
  favorites: '⭐ Избранное', catalog: '📦 Каталог',
  reference: '📖 Справочник', recipes: '🍳 Рецепты', reports: '📊 Отчёты', info: 'ℹ️ Инфо',
  usefulness: '🧮 Полезность',
  progress: '📈 Прогресс',
  nutria: '🧑‍⚕️ Нутрициолог',
  customfood: '📝 Свои',
  visualize: '🍽️ Блюдо',
  achievements: '🏆 Достижения',
  quests: '🎯 Квесты',
  peri: '🥤 Пери-воркаут',
};

const cardBg = { background: '#18181b', borderRadius: 18, border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 2px 16px rgba(0,0,0,0.2)' };
const pillActive = { background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontWeight: 700 as const, border: 'none', boxShadow: '0 2px 12px rgba(0,230,138,0.25)' };
const pillInactive = { background: '#202023', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.06)' };
const inputStyle: React.CSSProperties = { width:'100%', padding:'10px 14px', borderRadius:12, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:13, boxSizing:'border-box', outline:'none' };
const labelSec: React.CSSProperties = { fontSize:14, fontWeight:600, color:'#fff', marginBottom:10, letterSpacing:-0.3 };

const CartTab: React.FC = () => {
  const [refresh, setRefresh] = useState(0);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<Record<string, string>>({});
  const [editingNote, setEditingNote] = useState<Record<string, string>>({});
  const [storeNotes, setStoreNotes] = useState<Record<string, string>>({});
  const [newStoreName, setNewStoreName] = useState('');
  const [showNewStore, setShowNewStore] = useState(false);

  const carts = useMemo(() => getCarts(), [refresh]);
  const activeId = getActiveStoreId();
  let activeStore = carts.find(s => s.id === activeId);
  if (!activeStore && carts.length > 0) { activeStore = carts[0]; setActiveStoreId(carts[0].id); }
  const activeIdx = activeStore ? carts.findIndex(s => s.id === activeStore!.id) : -1;

  const rerender = () => setRefresh(n => n + 1);
  const updateCarts = (newCarts: CartStore[]) => { saveCarts(newCarts); rerender(); };

  const switchStore = (id: string) => { setActiveStoreId(id); rerender(); };

  const addStore = () => {
    const name = newStoreName.trim() || 'Магазин ' + (carts.length + 1);
    const nc: CartStore = { id: 'store_' + Date.now(), name, notes: '', sortOrder: carts.length, items: [] };
    updateCarts([...carts, nc]);
    setActiveStoreId(nc.id);
    setNewStoreName('');
    setShowNewStore(false);
  };

  const deleteStore = (id: string) => {
    const filtered = carts.filter(s => s.id !== id);
    updateCarts(filtered);
    if (getActiveStoreId() === id && filtered.length > 0) setActiveStoreId(filtered[0].id);
  };

  const renameStore = (id: string, name: string) => {
    updateCarts(carts.map(s => s.id === id ? { ...s, name } : s));
  };

  const duplicateStore = (id: string) => {
    const src = carts.find(s => s.id === id);
    if (!src) return;
    const dup: CartStore = { ...src, id: 'store_' + Date.now(), name: src.name + ' (копия)', sortOrder: carts.length };
    updateCarts([...carts, dup]);
  };

  const updateStoreNotes = (id: string, notes: string) => {
    updateCarts(carts.map(s => s.id === id ? { ...s, notes } : s));
  };

  const addItem = (name: string, kcal: number, amount?: number, category?: string) => {
    addToCart({ name, kcal, amount, category });
    rerender();
  };

  const removeItem = (itemId: string) => {
    if (activeIdx < 0) return;
    const newCarts = [...carts];
    newCarts[activeIdx] = { ...newCarts[activeIdx], items: newCarts[activeIdx].items.filter(i => i.id !== itemId) };
    updateCarts(newCarts);
  };

  const updateQty = (itemId: string, delta: number) => {
    if (activeIdx < 0) return;
    const newCarts = [...carts];
    newCarts[activeIdx] = { ...newCarts[activeIdx], items: newCarts[activeIdx].items.map(i => i.id === itemId ? { ...i, amount: Math.max(10, i.amount + delta), kcal: Math.round(i.kcal * Math.max(10, i.amount + delta) / Math.max(1, i.amount)) } : i) };
    updateCarts(newCarts);
  };

  const setItemPrice = (itemId: string, price: string) => {
    setEditingPrice(p => ({ ...p, [itemId]: price }));
  };
  const confirmPrice = (itemId: string) => {
    if (activeIdx < 0) return;
    const price = parseFloat(editingPrice[itemId] || '0') || 0;
    const newCarts = [...carts];
    newCarts[activeIdx] = { ...newCarts[activeIdx], items: newCarts[activeIdx].items.map(i => i.id === itemId ? { ...i, price } : i) };
    updateCarts(newCarts);
  };

  const setItemNote = (itemId: string, note: string) => {
    if (activeIdx < 0) return;
    const newCarts = [...carts];
    newCarts[activeIdx] = { ...newCarts[activeIdx], items: newCarts[activeIdx].items.map(i => i.id === itemId ? { ...i, note } : i) };
    updateCarts(newCarts);
  };

  const clearStore = () => {
    if (activeIdx < 0) return;
    const newCarts = [...carts];
    newCarts[activeIdx] = { ...newCarts[activeIdx], items: [] };
    updateCarts(newCarts);
  };

  const items = activeStore?.items || [];
  const totalKcal = items.reduce((s, i) => s + (i.kcal || 0), 0);
  const totalPrice = items.reduce((s, i) => s + (i.price || 0), 0);
  const groups: Record<string, CartItemEnhanced[]> = {};
  (items || []).forEach(item => { const cat = item.category || 'other'; if (!groups[cat]) groups[cat] = []; groups[cat].push(item); });

  const storeBtn = (isActive: boolean, onClick: () => void, children: React.ReactNode, extra?: React.CSSProperties) => (
    <button onClick={onClick} style={{ padding:'4px 10px', borderRadius:8, fontSize:9, cursor:'pointer', border: isActive ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)', background: isActive ? 'rgba(0,230,138,0.12)' : '#202023', color: isActive ? '#00e68a' : 'rgba(255,255,255,0.85)', fontWeight: isActive ? 700 : 400, whiteSpace:'nowrap', ...extra }}>{children}</button>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {/* Stores bar */}
      <div style={{ padding:14, ...cardBg }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#fff', letterSpacing:-0.3 }}>🛒 Корзина</div>
          <button onClick={() => setShowNewStore(!showNewStore)} style={{ padding:'5px 10px', borderRadius:8, fontSize:9, cursor:'pointer', border:'1px solid rgba(0,230,138,0.3)', background:'rgba(0,230,138,0.08)', color:'#00e68a', fontWeight:600 }}>+ Магазин</button>
        </div>
        {showNewStore && (
          <div style={{ display:'flex', gap:4, marginBottom:8 }}>
            <input value={newStoreName} onChange={e => setNewStoreName(e.target.value)} placeholder="Название магазина" style={{ flex:1, padding:'6px 10px', borderRadius:8, fontSize:9, border:'1px solid rgba(255,255,255,0.06)', background:'#202023', color:'#fff', outline:'none' }}
              onKeyDown={e => { if (e.key === 'Enter') addStore(); }} />
            <button onClick={addStore} style={{ padding:'6px 12px', borderRadius:8, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontSize:9, fontWeight:700 }}>✅</button>
            <button onClick={() => setShowNewStore(false)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.06)', cursor:'pointer', background:'#202023', color:'rgba(255,255,255,0.7)', fontSize:9 }}>✕</button>
          </div>
        )}
        <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:6 }}>
          {carts.map(s => (
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:2 }}>
              {storeBtn(s.id === (activeStore?.id || ''), () => switchStore(s.id), `${s.name} (${s.items.length})`)}
              <button onClick={() => duplicateStore(s.id)} style={{ padding:'2px 4px', borderRadius:4, border:'none', cursor:'pointer', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.8)', fontSize:7 }}>📋</button>
              {carts.length > 1 && <button onClick={() => deleteStore(s.id)} style={{ padding:'2px 4px', borderRadius:4, border:'none', cursor:'pointer', background:'rgba(239,68,68,0.08)', color:'#ef4444', fontSize:7 }}>✕</button>}
            </div>
          ))}
        </div>

        {!activeStore ? (
          <div style={{ textAlign:'center', padding:16, color:'rgba(255,255,255,0.8)', fontSize:11 }}>
            Создайте магазин, чтобы начать собирать список покупок.
          </div>
        ) : (
          <>
            {/* Store name + rename */}
            <input value={editingStoreId === activeStore.id ? (editingStoreId === activeStore.id ? storeNotes['_name'] ?? activeStore.name : activeStore.name) : activeStore.name}
              onChange={e => { setEditingStoreId(activeStore.id); setStoreNotes(p => ({ ...p, _name: e.target.value })); }}
              onBlur={() => { if (editingStoreId === activeStore.id) { renameStore(activeStore.id, storeNotes['_name'] ?? activeStore.name); setEditingStoreId(null); } }}
              placeholder="🏪 Название магазина" style={{ ...inputStyle, marginBottom:4, fontSize:12, fontWeight:600 }} />

            {/* Summary */}
            <div style={{ display:'flex', gap:8, marginBottom:6 }}>
              <div style={{ flex:1, background:'#202023', borderRadius:8, padding:'5px 8px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.85)' }}>Позиций</div>
                <div style={{ fontSize:14, fontWeight:800, color:'#00e68a' }}>{items.length}</div>
              </div>
              <div style={{ flex:1, background:'#202023', borderRadius:8, padding:'5px 8px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.85)' }}>Ккал</div>
                <div style={{ fontSize:14, fontWeight:800, color:'#8b5cf6' }}>{Math.round(totalKcal)}</div>
              </div>
              <div style={{ flex:1, background:'#202023', borderRadius:8, padding:'5px 8px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.85)' }}>Сумма</div>
                <div style={{ fontSize:14, fontWeight:800, color:'#f59e0b' }}>{totalPrice.toFixed(0)}в‚Ѕ</div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display:'flex', gap:3, marginBottom:6, flexWrap:'wrap' }}>
              <button onClick={clearStore} style={{ padding:'4px 8px', borderRadius:6, fontSize:8, cursor:'pointer', border:'1px solid rgba(239,68,68,0.2)', background:'rgba(239,68,68,0.08)', color:'#ef4444' }}>✕ Очистить список</button>
              <button onClick={() => duplicateStore(activeStore.id)} style={{ padding:'4px 8px', borderRadius:6, fontSize:8, cursor:'pointer', border:'1px solid rgba(139,92,246,0.2)', background:'rgba(139,92,246,0.08)', color:'#8b5cf6' }}>📋 Дублировать</button>
            </div>

            {/* General notes */}
            <textarea value={storeNotes[activeStore.id] ?? activeStore.notes ?? ''}
              onChange={e => { setStoreNotes(p => ({ ...p, [activeStore.id]: e.target.value })); }}
              onBlur={() => { updateStoreNotes(activeStore.id, storeNotes[activeStore.id] ?? activeStore.notes ?? ''); }}
              placeholder="📝 Общие заметки к списку..." style={{ width:'100%', boxSizing:'border-box', padding:'6px 10px', borderRadius:8, fontSize:9, border:'1px solid rgba(255,255,255,0.06)', background:'#202023', color:'#fff', outline:'none', resize:'vertical', minHeight:36, marginBottom:6, fontFamily:'inherit' }} />

            {items.length === 0 ? (
              <div style={{ textAlign:'center', padding:16, color:'rgba(255,255,255,0.8)', fontSize:10 }}>
                Список пуст. Добавляйте продукты из плана питания кнопкой «🛒».
              </div>
            ) : (
              <div style={{ maxHeight:400, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
                {Object.entries(groups).map(([cat, catItems]) => (
                  <div key={cat}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#f97316', marginBottom:3, padding:'2px 0', borderBottom:'1px solid rgba(249,115,22,0.1)', display:'flex', alignItems:'center', gap:4 }}>
                      {CART_CAT_LABELS[cat] || cat} <span style={{ fontSize:8, color:'rgba(255,255,255,0.8)', fontWeight:400 }}>({catItems.length})</span>
                      <span style={{ marginLeft:'auto', fontSize:8, color:'#f59e0b' }}>{catItems.reduce((s,i) => s+(i.price||0),0).toFixed(0)}в‚Ѕ</span>
                    </div>
                    {catItems.map(item => (
                      <div key={item.id} style={{ padding:'6px 8px', borderRadius:8, background:'#202023', border:'1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:10, fontWeight:600, color:'#fff' }}>{item.name}</div>
                            <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:1 }}>
                              <button onClick={() => updateQty(item.id, -10)} style={{ width:18, height:18, borderRadius:4, border:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.03)', color:'#fff', cursor:'pointer', fontSize:9, display:'flex', alignItems:'center', justifyContent:'center' }}>в€’</button>
                              <span style={{ fontSize:9, fontWeight:700, color:'#00e68a' }}>{item.amount}г</span>
                              <button onClick={() => updateQty(item.id, 10)} style={{ width:18, height:18, borderRadius:4, border:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.03)', color:'#fff', cursor:'pointer', fontSize:9, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                            <div style={{ fontSize:11, fontWeight:800, color:'#00e68a' }}>{Math.round(item.kcal)}</div>
                            <button onClick={() => removeItem(item.id)} style={{ padding:'2px 5px', borderRadius:4, border:'none', cursor:'pointer', background:'rgba(239,68,68,0.12)', color:'#ef4444', fontSize:8 }}>✕</button>
                          </div>
                        </div>
                        {/* Price + Note row */}
                        <div style={{ display:'flex', gap:4, marginTop:3, alignItems:'center' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:2, background:'#18181b', borderRadius:6, padding:'2px 6px' }}>
                            <span style={{ fontSize:8, color:'rgba(255,255,255,0.8)' }}>в‚Ѕ</span>
                            <input value={editingPrice[item.id] ?? (item.price ? item.price.toString() : '')} onChange={e => setItemPrice(item.id, e.target.value)}
                              onBlur={() => confirmPrice(item.id)}
                              style={{ width:45, padding:'2px 4px', borderRadius:4, border:'none', background:'transparent', color:'#f59e0b', fontSize:9, fontWeight:600, textAlign:'right', outline:'none' }}
                              placeholder="0" />
                          </div>
                          <input value={item.note} onChange={e => setItemNote(item.id, e.target.value)}
                            placeholder="📌 Заметка к продукту..." style={{ flex:1, padding:'3px 6px', borderRadius:6, fontSize:8, border:'1px solid rgba(255,255,255,0.04)', background:'#18181b', color:'rgba(255,255,255,0.85)', outline:'none' }} />
                          {item.price > 0 && <span style={{ fontSize:8, color:'#f59e0b', fontWeight:700 }}>{(item.price).toFixed(0)}в‚Ѕ</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const ReferenceTab: React.FC = () => (
  <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'4px 0' }}>
    <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:2, padding:'0 4px', letterSpacing:-0.2 }}>📖 Справочник питания</div>
    <NutritionReference />
  </div>
);

const CATEGORY_LABELS: Record<string, string> = {
  protein: '🥩 Мясо/Рыба',
  dairy: '🥛 Молочка',
  grain: '🌾 Крупы',
  carb: '🥔 Углеводы',
  veg_fruit: '🥦 Овощи/Фрукты',
  fat: '🧈 Жиры/Масла',
  fast_food: '🍔 Фаст-фуд',
  supplement: '💊 Добавки',
  other: '📦 Прочее',
};

const CatalogTab: React.FC = () => {
  const [catSearch, setCatSearch] = React.useState('');
  const [catFilter, setCatFilter] = React.useState('all');
  const [showExclusive, setShowExclusive] = React.useState(false);
  const [catExpanded, setCatExpanded] = React.useState<string | null>(null);
  const [usdaFoods, setUsdaFoods] = React.useState<Array<{id:string;name:string;kcal:number;protein:number;fat:number;carbs:number;fiber?:number;category?:string;tier?:string;description?:string}>>([]);

  React.useEffect(() => {
    let ok = true;
    import('../../data/usda-foods').then(m => { if (ok && m.USDA_FOODS) setUsdaFoods(m.USDA_FOODS); }).catch(() => {});
    return () => { ok = false; };
  }, []);

  const allFoods = React.useMemo(() => [...FOOD_DB as any[], ...usdaFoods.map(f => ({...f, category: f.category || 'other', tier: f.tier || 'standard', fiber: f.fiber || 0, gi: 0, servingSize: '100g', allergens: [], isVegetarian: false, isVegan: false, isGlutenFree: false, isDairyFree: false, dietTags: [] as string[], description: f.description || '', micros: {} }))], [usdaFoods]);

  const categories = React.useMemo(() => [...new Set(allFoods.map(f => f.category).filter(Boolean) as string[])], [allFoods]);
  const addFav = (food: { id: string; name: string; kcal: number; protein: number; fat: number; carbs: number }) => {
    try { const ids: string[] = JSON.parse(localStorage.getItem('he_food_favs') || '[]'); const updated = [food.id, ...ids.filter(f => f !== food.id)].slice(0, 100); localStorage.setItem('he_food_favs', JSON.stringify(updated)); } catch {}
  };
  const filtered = React.useMemo(() => {
    const q = (catSearch || '').toLowerCase().trim();
    let result = allFoods;
    if (catFilter !== 'all') result = result.filter((f: any) => f.category === catFilter);
    if (showExclusive) result = result.filter((f: any) => f.tier === 'max');
    if (q) {
      result = result.filter((f: any) => (f.name || '').toLowerCase().includes(q) || (f.description || '').toLowerCase().includes(q));
    }
    return result.slice(0, 100);
  }, [catFilter, catSearch, showExclusive, allFoods]);
  const filterBtn = (isActive: boolean, onClick: () => void, children: React.ReactNode) => (
    <button onClick={onClick} style={{ padding:'5px 10px', borderRadius:8, fontSize:8, cursor:'pointer', fontWeight: isActive ? 700 : 400, letterSpacing:0.2, whiteSpace:'nowrap', border: isActive ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)', background: isActive ? 'linear-gradient(135deg,rgba(0,230,138,0.2),rgba(0,200,160,0.12))' : '#202023', color: isActive ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>{children}</button>
  );
  const toggleExpanded = (id: string) => setCatExpanded(prev => prev === id ? null : id);
  return (<div style={{ display:'flex', flexDirection:'column', gap:8 }}>
    <div style={{ padding:14, ...cardBg }}>
      <div style={labelSec}>📦 Каталог продуктов ({allFoods.length})</div>
      <input value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder="🔍 Поиск по названию..." style={inputStyle} />
      <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
        {filterBtn(catFilter === 'all', () => { setShowExclusive(false); setCatFilter('all'); }, `Все (${allFoods.length})`)}
        {categories.map(c => {
          const count = allFoods.filter(f => f.category === c).length;
          return filterBtn(catFilter === c, () => { setShowExclusive(false); setCatFilter(c); }, `${CATEGORY_LABELS[c] || c} (${count})`);
        })}
        <button onClick={() => { setShowExclusive(e => !e); setCatFilter('all'); }} style={{
          padding:'5px 10px', borderRadius:8, fontSize:8, cursor:'pointer', fontWeight: showExclusive ? 700 : 400, letterSpacing:0.2, whiteSpace:'nowrap',
          border: showExclusive ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.06)',
          background: showExclusive ? 'rgba(168,85,247,0.14)' : '#202023',
          color: showExclusive ? '#a855f7' : 'rgba(255,255,255,0.85)',
        }}>⭐ Exclusive ({allFoods.filter((f: any) => f.tier === 'max').length})</button>
      </div>
      <div style={{ marginTop:6, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        {catFilter === 'all' ? (
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.7)' }}>Показаны все продукты</div>
        ) : (
          <div style={{ fontSize:10, fontWeight:700, color:'#00e68a', background:'rgba(0,230,138,0.12)', padding:'4px 10px', borderRadius:6, border:'1px solid rgba(0,230,138,0.3)' }}>
            🔍 Фильтр: {CATEGORY_LABELS[catFilter] || catFilter} — {filtered.length} из {allFoods.length}
          </div>
        )}
      </div>
      <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:3, borderRadius:8 }}>
        {filtered.map(f => {
          const isExpanded = catExpanded === f.id;
          const bbScore = f.bb_quality_score;
          const scoreLabel = bbScore ? (bbScore >= 7 ? '✅' : '⚠️') : '';
          return (<div key={f.id}>
            <div onClick={() => toggleExpanded(f.id)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderRadius:10, background: isExpanded ? 'rgba(0,230,138,0.04)' : '#202023', border: isExpanded ? '1px solid rgba(0,230,138,0.12)' : '1px solid rgba(255,255,255,0.06)', cursor:'pointer' }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ fontSize:11, fontWeight:600, color:'#fff' }}>{f.name}</span>
                  {bbScore && <span style={{ fontSize:8, padding:'1px 5px', borderRadius:4, background: bbScore >= 7 ? 'rgba(0,230,138,0.1)' : bbScore >= 5 ? 'rgba(249,115,22,0.1)' : 'rgba(239,68,68,0.1)', color: bbScore >= 7 ? '#00e68a' : bbScore >= 5 ? '#f97316' : '#ef4444' }}>{bbScore.toFixed(1)}</span>}
                  <span style={{ fontSize:7, color:'rgba(255,255,255,0.9)' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.8)', marginTop:1 }}>{CATEGORY_LABELS[f.category] || f.category} • {f.kcal}ккал • Б{f.protein} Ж{f.fat} У{f.carbs} {f.fiber ? `• В{f.fiber}г` : ''}</div>
              </div>
              <div style={{ display:'flex', gap:3, alignItems:'center' }}>
                <button onClick={e => { e.stopPropagation(); addFav(f); }} style={{ padding:'4px 8px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', color:'#8b5cf6' }}>⭐</button>
                <button onClick={e => { e.stopPropagation(); addToCart({ name: f.name, kcal: f.kcal, amount: 100, category: f.category }); }} style={{ padding:'4px 8px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(0,230,138,0.15)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a' }}>🛒</button>
              </div>
            </div>
            {isExpanded && (() => {
              const m = f.macro_100g || {};
              const aa = f.amino_acid_profile_100g || {};
              const el = f.electrolytes_100g || {};
              const vit = f.vitamins_100g || {};
              const tr = f.trace_elements_100g || {};
              const bio = f.bioactive_compounds_100g || {};
              const gt = f.gastro_tags || {};
              const mf = f.metabolic_flags || {};
              const sc = f.specific_compounds_100g || {};
              const row = (items: any[], color = 'rgba(255,255,255,0.7)') => (
                <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginBottom:2, fontSize:7, color }}>
                  {items.map((item: any,i: number) => <span key={i}>{item}</span>)}
                </div>
              );
              return (
              <div style={{ padding:'8px 12px', marginBottom:2, borderRadius:'0 0 10px 10px', background:'rgba(32,32,35,0.6)', border:'1px solid rgba(255,255,255,0.04)', borderTop:'none', fontSize:8, color:'rgba(255,255,255,0.7)' }}>
                {f.description && <div style={{ marginBottom:3, lineHeight:1.3, fontSize:7 }}>{f.description}</div>}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2, marginBottom:3 }}>
                  <span>⏱ ГИ: {f.gi ?? '—'} | ИИ: {m.insulin_index ?? '—'}</span>
                  <span>⚡ Клетчатка: {f.fiber ?? '—'}г</span>
                  {m.proteins_animal !== undefined ? <span>🥩 Белок жив.: {m.proteins_animal}г</span> : null}
                  {m.proteins_plant !== undefined ? <span>🌱 Белок раст.: {m.proteins_plant}г</span> : null}
                  {m.fats_saturated !== undefined ? <span>🧈 Насыщ.: {m.fats_saturated}г</span> : null}
                  {m.fats_monounsaturated !== undefined ? <span>🫒 Моно: {m.fats_monounsaturated}г</span> : null}
                  {m.fats_polyunsaturated !== undefined ? <span>🌻 Поли: {m.fats_polyunsaturated}г</span> : null}
                  {m.omega_3_mg !== undefined ? <span>🐟 Омега-3: {m.omega_3_mg}мг</span> : null}
                  {m.omega_6_mg !== undefined ? <span>🔴 Омега-6: {m.omega_6_mg}мг</span> : null}
                  {m.mct_oil_g !== undefined ? <span>🫐 MCT: {m.mct_oil_g}г</span> : null}
                  {m.cholesterol_mg !== undefined ? <span>🫀 Холестерин: {m.cholesterol_mg}мг</span> : null}
                  {m.carbs_sugar !== undefined ? <span>🍬 Сахара: {m.carbs_sugar}г</span> : null}
                </div>
                {aa.leucine_mg !== undefined && row([
                  <span style={{color:'#8b5cf6'}}>🧬 АК:</span>,
                  <span>лей {aa.leucine_mg}мг</span>,
                  aa.isoleucine_mg !== undefined && <span>• илей {aa.isoleucine_mg}мг</span>,
                  aa.valine_mg !== undefined && <span>• вал {aa.valine_mg}мг</span>,
                  aa.lysine_mg !== undefined && <span>• лиз {aa.lysine_mg}мг</span>,
                  aa.methionine_mg !== undefined && <span>• мет {aa.methionine_mg}мг</span>,
                  aa.threonine_mg !== undefined && <span>• тре {aa.threonine_mg}мг</span>,
                  aa.tryptophan_mg !== undefined && <span>• три {aa.tryptophan_mg}мг</span>,
                  aa.phenylalanine_mg !== undefined && <span>• фен {aa.phenylalanine_mg}мг</span>,
                  aa.histidine_mg !== undefined && <span>• гис {aa.histidine_mg}мг</span>,
                  aa.arginine_mg !== undefined && <span>• арг {aa.arginine_mg}мг</span>,
                  aa.glutamine_mg !== undefined && <span>• глу {aa.glutamine_mg}мг</span>,
                  aa.cysteine_mg !== undefined && <span>• цис {aa.cysteine_mg}мг</span>,
                ], '#8b5cf6')}
                {el.sodium_mg !== undefined && row([
                  <span style={{color:'#60a5fa'}}>⚡ Электролиты:</span>,
                  <span>Na {el.sodium_mg}мг</span>,
                  el.potassium_mg !== undefined && <span>• K {el.potassium_mg}мг</span>,
                  el.magnesium_mg !== undefined && <span>• Mg {el.magnesium_mg}мг</span>,
                  el.calcium_mg !== undefined && <span>• Ca {el.calcium_mg}мг</span>,
                  el.phosphorus_mg !== undefined && <span>• P {el.phosphorus_mg}мг</span>,
                  el.pral_index !== undefined && <span>• PRAL {el.pral_index}</span>,
                ], '#60a5fa')}
                {vit.vitamin_a_mcg !== undefined && row([
                  <span style={{color:'#f97316'}}>💊 Витамины:</span>,
                  <span>A {vit.vitamin_a_mcg}мкг</span>,
                  vit.vitamin_c_mg !== undefined && <span>• C {vit.vitamin_c_mg}мг</span>,
                  vit.vitamin_d_mcg !== undefined && <span>• D {vit.vitamin_d_mcg}мкг</span>,
                  vit.vitamin_e_mg !== undefined && <span>• E {vit.vitamin_e_mg}мг</span>,
                  vit.vitamin_k_mcg !== undefined && <span>• K {vit.vitamin_k_mcg}мкг</span>,
                  vit.vitamin_b1_mg !== undefined && <span>• B1 {vit.vitamin_b1_mg}мг</span>,
                  vit.vitamin_b2_mg !== undefined && <span>• B2 {vit.vitamin_b2_mg}мг</span>,
                  vit.vitamin_b3_mg !== undefined && <span>• B3 {vit.vitamin_b3_mg}мг</span>,
                  vit.vitamin_b5_mg !== undefined && <span>• B5 {vit.vitamin_b5_mg}мг</span>,
                  vit.vitamin_b6_mg !== undefined && <span>• B6 {vit.vitamin_b6_mg}мг</span>,
                  vit.vitamin_b7_mcg !== undefined && <span>• B7 {vit.vitamin_b7_mcg}мкг</span>,
                  vit.vitamin_b9_mcg !== undefined && <span>• B9 {vit.vitamin_b9_mcg}мкг</span>,
                  vit.vitamin_b12_mcg !== undefined && <span>• B12 {vit.vitamin_b12_mcg}мкг</span>,
                ], '#f97316')}
                {tr.iron_total_mg !== undefined && row([
                  <span style={{color:'#22c55e'}}>⚙️ Микроэлементы:</span>,
                  <span>Fe {tr.iron_total_mg}мг{tr.iron_heme_mg ? `(гем ${tr.iron_heme_mg})` : ''}</span>,
                  tr.zinc_mg !== undefined && <span>• Zn {tr.zinc_mg}мг</span>,
                  tr.selenium_mcg !== undefined && <span>• Se {tr.selenium_mcg}мкг</span>,
                  tr.copper_mg !== undefined && <span>• Cu {tr.copper_mg}мг</span>,
                  tr.manganese_mg !== undefined && <span>• Mn {tr.manganese_mg}мг</span>,
                  tr.iodine_mcg !== undefined && <span>• I {tr.iodine_mcg}мкг</span>,
                  tr.chromium_mcg !== undefined && <span>• Cr {tr.chromium_mcg}мкг</span>,
                ], '#22c55e')}
                {bio.creatine_mg !== undefined && row([
                  <span style={{color:'#a78bfa'}}>🧪 Биоактивные:</span>,
                  <span>креатин {bio.creatine_mg}мг</span>,
                  bio.beta_alanine_mg !== undefined && <span>• β-аланин {bio.beta_alanine_mg}мг</span>,
                  bio.taurine_mg !== undefined && <span>• таурин {bio.taurine_mg}мг</span>,
                  bio.lignan_mg !== undefined && <span>• лигнан {bio.lignan_mg}мг</span>,
                  bio.indol_3_carbinol_mg !== undefined && <span>• I3C {bio.indol_3_carbinol_mg}мг</span>,
                ], '#a78bfa')}
                {sc.polyphenols_mg !== undefined && row([
                  <span style={{color:'#f59e0b'}}>🌿 Соединения:</span>,
                  <span>полифенолы {sc.polyphenols_mg}мг</span>,
                  sc.flavonoids_mg !== undefined && <span>• флав. {sc.flavonoids_mg}мг</span>,
                  sc.curcumin_mg !== undefined && <span>• куркумин {sc.curcumin_mg}мг</span>,
                  sc.sulforaphane_mg !== undefined && <span>• сульф. {sc.sulforaphane_mg}мг</span>,
                  sc.resveratrol_mg !== undefined && <span>• ресвер. {sc.resveratrol_mg}мг</span>,
                  sc.lectins_mg !== undefined && <span>• лектины {sc.lectins_mg}мг</span>,
                  sc.oxalates_mg !== undefined && <span>• оксалаты {sc.oxalates_mg}мг</span>,
                  sc.phytoestrogens_mg !== undefined && <span>• фитоэстр. {sc.phytoestrogens_mg}мг</span>,
                  sc.alpha_lipoic_acid_mg !== undefined && <span>• АЛК {sc.alpha_lipoic_acid_mg}мг</span>,
                  sc.coenzyme_q10_mg !== undefined && <span>• CoQ10 {sc.coenzyme_q10_mg}мг</span>,
                  sc.berberine_mg !== undefined && <span>• берберин {sc.berberine_mg}мг</span>,
                ], '#f59e0b')}
                {gt.fodmap_group && row([
                  <span style={{color:'#f97316'}}>🫃 ЖКТ:</span>,
                  <span>FODMAP {gt.fodmap_group}</span>,
                  gt.enzyme_demand_score !== undefined && <span>• Ферм.нагрузка {gt.enzyme_demand_score}/10</span>,
                  gt.gastric_emptying_speed && <span>• Опорожнение: {gt.gastric_emptying_speed === 'FAST' ? 'быстрое' : gt.gastric_emptying_speed === 'SLOW' ? 'медленное' : 'среднее'}</span>,
                  gt.gut_irritant_potential && <span>• Раздражение: {gt.gut_irritant_potential}</span>,
                  gt.allergen_flags && gt.allergen_flags.length > 0 && <span>• Аллергены: {gt.allergen_flags.join(',')}</span>,
                ], '#f97316')}
                {row([
                  <span style={{color:'#a78bfa'}}>🏷 Флаги:</span>,
                  mf.atherogenic_potential === 'HIGH' && <span style={{color:'#ef4444'}}>🚨 Атероген.</span>,
                  mf.glycation_potential === 'HIGH' && <span style={{color:'#f59e0b'}}>🔥 Гликация</span>,
                  mf.ammonia_source_level === 'HIGH' && <span style={{color:'#ef4444'}}>💨 Аммиак HIGH</span>,
                  mf.ammonia_source_level === 'MEDIUM' && <span style={{color:'#a78bfa'}}>💨 Аммиак MED</span>,
                  mf.heavy_metal_risk === 'HIGH' && <span style={{color:'#ef4444'}}>☢️ Тяж.мет.</span>,
                  mf.heavy_metal_risk === 'MEDIUM' && <span style={{color:'#f59e0b'}}>☢️ Тяж.мет.MED</span>,
                  mf.cns_impact === 'STIMULANT' && <span style={{color:'#f97316'}}>🧠 Стим.</span>,
                  mf.cns_impact === 'SEDATIVE' && <span style={{color:'#8b5cf6'}}>😴 Седат.</span>,
                  mf.anabolic_potential === 'HIGH' && <span style={{color:'#00e68a'}}>💪 Анабол</span>,
                  mf.anabolic_potential === 'MEDIUM' && <span style={{color:'#f59e0b'}}>💪 Анабол MED</span>,
                  mf.hepatoprotective && <span style={{color:'#22c55e'}}>🫁 Гепатопр.</span>,
                  mf.insulin_sensitivity_impact === 'NEGATIVE' && <span style={{color:'#ef4444'}}>📉 Инс.-сенс NEG</span>,
                  mf.insulin_sensitivity_impact === 'POSITIVE' && <span style={{color:'#00e68a'}}>📈 Инс.-сенс POS</span>,
                  mf.goitrogenic_potential === 'HIGH' && <span style={{color:'#f59e0b'}}>🦋 Зобоген.</span>,
                  mf.detox_support_level === 'HIGH' && <span style={{color:'#22c55e'}}>🧹 Детокс</span>,
                  mf.histamine_level === 'HIGH' && <span style={{color:'#ef4444'}}>🧪 Гистамин HIGH</span>,
                  mf.thyroid_support_level === 'HIGH' && <span style={{color:'#22c55e'}}>🦋 Щит. HIGH</span>,
                ], '#a78bfa')}
                {row([
                  <span style={{color:'rgba(255,255,255,0.65)'}}>📊 {f.tier === 'max' ? 'Уровень: Максимум' : f.tier === 'mid' ? 'Уровень: Средний' : 'Уровень: Базовый'}</span>,
                  f.bb_quality_score ? <span>| BB Score: {f.bb_quality_score.toFixed(1)}</span> : null,
                ], 'rgba(255,255,255,0.65)')}
              </div>);
            })()}
          </div>);
        })}
      </div>
    </div>
  </div>);
};

const RecipesTab: React.FC = () => {
  const [recMeal, setRecMeal] = React.useState('all');
  const [recSearch, setRecSearch] = React.useState('');
  const [recExpanded, setRecExpanded] = React.useState<Record<number, boolean>>({});
  const [showRecipeModal, setShowRecipeModal] = React.useState(false);
  const [recName, setRecName] = React.useState('');
  const [recIngredients, setRecIngredients] = React.useState('');
  const [recInstructions, setRecInstructions] = React.useState('');
  const [recKcal, setRecKcal] = React.useState(0);
  const [recProtein, setRecProtein] = React.useState(0);
  const [recFat, setRecFat] = React.useState(0);
  const [recCarbs, setRecCarbs] = React.useState(0);
  const [myRecipes, setMyRecipes] = React.useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_recipes') || '[]'); } catch { return []; }
  });
  const [myRecExpanded, setMyRecExpanded] = React.useState(false);
  const recipes = React.useMemo(() => getRecipes(), []);
  const list = React.useMemo(() => {
    let filtered = recipes;
    if (recMeal !== 'all') filtered = filtered.filter((r: any) => r.meal === recMeal);
    if (recSearch.trim()) { const q = recSearch.toLowerCase(); filtered = filtered.filter((r: any) => r.name?.toLowerCase().includes(q) || r.ingredients?.some((i: string) => i.toLowerCase().includes(q)) || r.tags?.some((t: string) => t.toLowerCase().includes(q))); }
    return filtered;
  }, [recipes, recMeal, recSearch]);
  const mealBtn = (isActive: boolean, onClick: () => void, children: React.ReactNode) => (
    <button onClick={onClick} style={{ padding:'5px 12px', borderRadius:8, fontSize:10, cursor:'pointer', border: isActive ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)', background: isActive ? 'linear-gradient(135deg,rgba(0,230,138,0.2),rgba(0,200,160,0.12))' : '#202023', color: isActive ? '#00e68a' : 'rgba(255,255,255,0.85)', fontWeight: isActive ? 700 : 400 }}>{children}</button>
  );
  const mealLabel = (m: string) => m === 'breakfast' ? '🌅' : m === 'lunch' ? '☀️' : m === 'dinner' ? '🌙' : m === 'snack' ? '🍿' : '';
  const saveRecipe = () => {
    if (!recName.trim()) return;
    const newRecipe = {
      id: Date.now().toString(),
      name: recName.trim(),
      ingredients: recIngredients.split('\n').filter(s => s.trim()),
      instructions: recInstructions,
      kcal: recKcal,
      protein: recProtein,
      fat: recFat,
      carbs: recCarbs,
    };
    const updated = [...myRecipes, newRecipe];
    setMyRecipes(updated);
    localStorage.setItem('he_recipes', JSON.stringify(updated));
    setRecName(''); setRecIngredients(''); setRecInstructions('');
    setRecKcal(0); setRecProtein(0); setRecFat(0); setRecCarbs(0);
    setShowRecipeModal(false);
  };
  const deleteMyRecipe = (id: string) => {
    const updated = myRecipes.filter((r: any) => r.id !== id);
    setMyRecipes(updated);
    localStorage.setItem('he_recipes', JSON.stringify(updated));
  };
  return (<div style={{ display:'flex', flexDirection:'column', gap:8 }}>
    <div style={{ padding:14, ...cardBg }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={labelSec}>🍳 Рецепты ({recipes.length + myRecipes.length})</div>
        <button onClick={() => setShowRecipeModal(true)} style={{
          padding:'6px 12px', borderRadius:8, cursor:'pointer', fontSize:9, fontWeight:700,
          border:'1px solid rgba(0,230,138,0.3)', background:'rgba(0,230,138,0.1)', color:'#00e68a',
        }}>+ Рецепт</button>
      </div>
      {/* My recipes collapsible */}
      {myRecipes.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div onClick={() => setMyRecExpanded(!myRecExpanded)} style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'6px 8px', borderRadius:6, cursor:'pointer',
            background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.1)',
          }}>
            <span style={{ fontSize:9, color:'#a78bfa', fontWeight:600 }}>📝 Мои рецепты ({myRecipes.length})</span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.8)' }}>{myRecExpanded ? '▲' : '▼'}</span>
          </div>
          {myRecExpanded && (
            <div style={{ marginTop:4, maxHeight:200, overflowY:'auto' }}>
              {myRecipes.map((r: any) => (
                <div key={r.id} style={{
                  padding:'6px 8px', borderRadius:6, marginBottom:3, position:'relative',
                  background:'rgba(167,139,250,0.03)', border:'1px solid rgba(167,139,250,0.08)',
                }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <span style={{ fontSize:9, fontWeight:600, color:'#fff' }}>{r.name}</span>
                      <span style={{ fontSize:8, color:'rgba(255,255,255,0.75)', marginLeft:4 }}>
                        {r.kcal} ккал · Б{r.protein} Ж{r.fat} У{r.carbs}
                      </span>
                    </div>
                    <button onClick={() => deleteMyRecipe(r.id)} style={{
                      padding:'2px 6px', borderRadius:4, cursor:'pointer', fontSize:8,
                      background:'rgba(239,68,68,0.08)', border:'none', color:'#ef4444',
                    }}>✕</button>
                  </div>
                  {r.ingredients?.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:3 }}>
                      {r.ingredients.map((ing: string, j: number) => (
                        <span key={j} style={{ padding:'1px 5px', borderRadius:4, fontSize:7, background:'rgba(255,255,255,0.03)', color:'rgba(255,255,255,0.8)' }}>{ing}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Recipe creation modal */}
      {showRecipeModal && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }}
          onClick={() => setShowRecipeModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:400, maxHeight:'85vh', padding:16, borderRadius:16, background:'#18181b', border:'1px solid rgba(0,230,138,0.12)', overflowY:'auto' }}>
            <div style={{ fontSize:15, fontWeight:700, color:'#00e68a', marginBottom:12, textAlign:'center' }}>🍳 Создать рецепт</div>
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:3 }}>Название рецепта</div>
              <input value={recName} onChange={e => setRecName(e.target.value)} placeholder="Например: Овсяноблин" style={inputStyle} />
            </div>
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:3 }}>Ингредиенты (по одному на строку)</div>
              <textarea value={recIngredients} onChange={e => setRecIngredients(e.target.value)} placeholder="Яйца 2 шт&#10;Овсянка 30 г&#10;Творог 50 г" style={{ ...inputStyle, resize:'vertical', minHeight:70, fontSize:10 }} rows={3} />
            </div>
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:3 }}>Приготовление</div>
              <textarea value={recInstructions} onChange={e => setRecInstructions(e.target.value)} placeholder="Описание процесса приготовления..." style={{ ...inputStyle, resize:'vertical', minHeight:60, fontSize:10 }} rows={3} />
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:4 }}>КБЖУ на порцию</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4 }}>
                {[
                  { l:'Ккал', v: recKcal, s: setRecKcal, c:'#00e68a' },
                  { l:'Белки', v: recProtein, s: setRecProtein, c:'#3b82f6' },
                  { l:'Жиры', v: recFat, s: setRecFat, c:'#f59e0b' },
                  { l:'Углеводы', v: recCarbs, s: setRecCarbs, c:'#f97316' },
                ].map(m => (
                  <div key={m.l} style={{ textAlign:'center' }}>
                    <input type="number" value={m.v || ''} onChange={e => m.s(+e.target.value || 0)} placeholder="0" style={{
                      width:'100%', padding:'8px 4px', borderRadius:8, fontSize:11, fontWeight:700, textAlign:'center',
                      background:'#202023', border:`1px solid ${m.c}30`, color:m.c, outline:'none', boxSizing:'border-box',
                    }} />
                    <div style={{ fontSize:7, color:'rgba(255,255,255,0.9)', marginTop:1 }}>{m.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={saveRecipe} style={{
              width:'100%', padding:'12px', borderRadius:10, cursor:'pointer', border:'none',
              background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontSize:11, fontWeight:700,
            }}>✓ Сохранить рецепт</button>
          </div>
        </div>
      )}
      <input value={recSearch} onChange={e => setRecSearch(e.target.value)} placeholder="🔍 Поиск рецептов..." style={{ ...inputStyle, marginTop: 6 }} />
      <div style={{ marginTop:8, display:'flex', gap:3, flexWrap:'wrap', marginBottom:6 }}>
        {mealBtn(recMeal === 'all', () => setRecMeal('all'), 'Все')}
        {mealBtn(recMeal === 'breakfast', () => setRecMeal('breakfast'), 'Завтрак')}
        {mealBtn(recMeal === 'lunch', () => setRecMeal('lunch'), 'Обед')}
        {mealBtn(recMeal === 'dinner', () => setRecMeal('dinner'), 'Ужин')}
        {mealBtn(recMeal === 'snack', () => setRecMeal('snack'), 'Перекус')}
      </div>
      <div style={{ maxHeight:420, overflowY:'auto' }}>
        {list.map((r: any, i: number) => {
          const isExpanded = recExpanded[i] || false;
          return <div key={i} style={{ padding:'8px 10px', borderRadius:10, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', marginBottom:4 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ fontSize:11, fontWeight:600, color:'#fff' }}>{mealLabel(r.meal)} {r.name}</span>
                  <span style={{ fontSize:8, color:'rgba(255,255,255,0.75)' }}>{r.prepTimeMin} мин</span>
                </div>
                <div style={{ fontSize:10, display:'flex', gap:4, marginTop:2, alignItems:'center' }}>
                  <span style={{ color:'#00e68a', fontWeight:700 }}>{r.kcal} ккал</span>
                  <span style={{ color:'#60a5fa' }}>Б{r.protein}</span>
                  <span style={{ color:'#fbbf24' }}>Ж{r.fat}</span>
                  <span style={{ color:'#fb923c' }}>У{r.carbs}</span>
                  {(() => { const qs = r.kcal > 0 ? Math.min(10, Math.round((r.protein * 4 / r.kcal) * 25)) : 0; const qc = qs >= 8 ? '#22c55e' : qs >= 5 ? '#f59e0b' : '#ef4444'; return <span style={{ fontSize:8, fontWeight:700, padding:'1px 5px', borderRadius:4, background:qc+'20', color:qc, border:'1px solid '+qc+'30' }}>⭐{qs}/10</span>; })()}
                </div>
              </div>
              <button onClick={() => setRecExpanded(prev => ({...prev, [i]: !prev[i]}))} style={{ padding:'4px 8px', borderRadius:6, fontSize:9, cursor:'pointer', border:'1px solid rgba(255,255,255,0.06)', background:'#18181b', color:'rgba(255,255,255,0.7)' }}>{isExpanded ? '▲' : '▼'}</button>
            </div>
            {r.tags && <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:3 }}>
              {r.tags.map((t: string, j: number) => <span key={j} style={{ padding:'1px 6px', borderRadius:8, fontSize:8, background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.65)' }}>{t}</span>)}
            </div>}
            {r.ingredients && <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:3 }}>
              {r.ingredients.map((ing: string, j: number) => <span key={j} style={{ padding:'2px 6px', borderRadius:6, fontSize:9, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.85)' }}>{ing}</span>)}
            </div>}
            {isExpanded && r.instructions && <div style={{ marginTop:6, paddingTop:6, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#00e68a', marginBottom:4 }}>📝 Приготовление</div>
              {r.instructions.map((step: string, j: number) => <div key={j} style={{ display:'flex', gap:4, fontSize:10, color:'rgba(255,255,255,0.85)', marginBottom:3 }}>
                <span style={{ color:'#00e68a', fontWeight:700, minWidth:16, fontSize:9 }}>{j+1}.</span>
                <span>{step}</span>
              </div>)}
            </div>}
          </div>;
        })}
      </div>
    </div>
  </div>);
};

const RESTAURANT_CUISINE: Record<string, string[]> = {
  russian: ['харчо','лагман','долма','хачапури','чебуреки','пян-се','шницель','котлета по-киевски','бефстроганов','щавелевый суп'],
  asian: ['рамен','жареный рис','курица терияки','вок','поке','том ям','мисо суп','оладьи','курица карри','греческий','оладьи'],
  italian: ['пицца'],
  fastfood: ['шаурма','бургер','kfc','mcdonald','burger king','макнаггетс','big mac','whopper','вкусно и точка','биг смоук','чизбургер','чизбургер','лонг чикен','twister','твистер','боксмастер','гриль-ролл','куриные фри','наггетс','цезарь','картофель фри','луковые кольца','фалафель','гирос','сэндвич с тунцом','картофель фри'],
};
function detectCuisine(name: string): string {
  const low = name.toLowerCase();
  for (const [cuisine, keywords] of Object.entries(RESTAURANT_CUISINE)) {
    for (const kw of keywords) { if (low.includes(kw)) return cuisine; }
  }
  return 'fastfood';
}

const RestaurantTab: React.FC = () => {
  const [g, setG] = React.useState<'all'|'russian'|'asian'|'italian'|'fastfood'>('all');
  const [search, setSearch] = React.useState('');
  const [portions, setPortions] = React.useState<Record<string, number>>({});
  const restaurantDishes = useMemo(() => FOOD_DB.filter(f => f.category === 'fast_food'), []);
  const filtered = useMemo(() => {
    let list = g === 'all' ? restaurantDishes : restaurantDishes.filter(f => detectCuisine(f.name) === g);
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(f => (f.name||'').toLowerCase().includes(q)); }
    return list;
  }, [g, search, restaurantDishes]);
  const totals = useMemo(() => ({
    kcal: filtered.reduce((s,f) => s + f.kcal * (portions[f.id] || 1), 0),
    p: filtered.reduce((s,f) => s + f.protein * (portions[f.id] || 1), 0),
    f: filtered.reduce((s,f) => s + f.fat * (portions[f.id] || 1), 0),
    c: filtered.reduce((s,f) => s + f.carbs * (portions[f.id] || 1), 0),
  }), [filtered, portions]);
  const cuisineBtn = (v: typeof g, label: string) => (
    <button onClick={() => setG(v)} style={{ padding:'3px 8px', borderRadius:6, fontSize:8, cursor:'pointer', border: g === v ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)', background: g === v ? 'rgba(0,230,138,0.15)' : '#202023', color: g === v ? '#00e68a' : 'rgba(255,255,255,0.85)', fontWeight: g === v ? 600 : 400 }}>{label}</button>
  );
  return (<div style={{ display:'flex', flexDirection:'column', gap:8 }}>
    {/* КБЖУ сводка */}
    {filtered.length > 0 && (
      <div style={{ padding:14, ...cardBg }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:6 }}>📊 КБЖУ выбранных блюд</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6 }}>
          {[{l:'Калории',v:Math.round(totals.kcal),c:'#00e68a',u:'ккал'},{l:'Белки',v:Math.round(totals.p),c:'#3b82f6',u:'г'},{l:'Жиры',v:Math.round(totals.f),c:'#f59e0b',u:'г'},{l:'Углеводы',v:Math.round(totals.c),c:'#f97316',u:'г'}].map((s,i) => (
            <div key={i} style={{ background:'#202023', borderRadius:8, padding:'5px 8px', textAlign:'center' }}>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.85)' }}>{s.l}</div>
              <div style={{ fontSize:16, fontWeight:800, color:s.c }}>{s.v}<span style={{ fontSize:9, fontWeight:400, color:'rgba(255,255,255,0.8)' }}> {s.u}</span></div>
            </div>
          ))}
        </div>
      </div>
    )}
    {/* Фильтры */}
    <div style={{ padding:14, ...cardBg }}>
      <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:6 }}>
        {cuisineBtn('all', 'Все')}
        {cuisineBtn('russian', '🇷🇺 Русская')}
        {cuisineBtn('asian', '🥟 Азиатская')}
        {cuisineBtn('italian', '🍝 Итальянская')}
        {cuisineBtn('fastfood', '🍔 Фаст-фуд')}
      </div>
      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск блюд..." style={{ width:'100%', boxSizing:'border-box', padding:'6px 10px', borderRadius:8, fontSize:9, border:'1px solid rgba(255,255,255,0.06)', background:'#202023', color:'#fff', outline:'none' }} />
    </div>
    {/* Список блюд с КБЖУ */}
    <div style={{ padding:14, ...cardBg }}>
      <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:6 }}>🍽 Блюда ресторанов ({filtered.length})</div>
      {filtered.length === 0 ? (
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.8)', textAlign:'center', padding:20 }}>Нет блюд по выбранному фильтру.</div>
      ) : (
        <div style={{ maxHeight:400, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
          {filtered.map(food => {
            const portion = portions[food.id] || 1;
            return (<div key={food.id} style={{ padding:'6px 8px', borderRadius:8, background:'#202023', border:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:9, fontWeight:600, color:'#fff' }}>{food.name}</div>
                  <div style={{ fontSize:7, color:'rgba(255,255,255,0.8)' }}>{food.servingSize || ''} · {detectCuisine(food.name)}</div>
                </div>
                <div style={{ display:'flex', gap:2 }}>
                  {[-1,1].map(d => <button key={d} onClick={() => setPortions(p => ({...p, [food.id]: Math.max(0.25, (p[food.id]||1) + d * 0.25)}))} style={{ width:18, height:18, borderRadius:4, border:'1px solid rgba(255,255,255,0.06)', background:'#18181b', color:'rgba(255,255,255,0.85)', cursor:'pointer', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center' }}>{d>0?'+':'-'}</button>)}
                </div>
                <button onClick={() => addToCart({ name: food.name, amount: Math.round(portion * (parseInt(food.servingSize) || 100)), kcal: Math.round(food.kcal * portion), category: 'fast_food' })} style={{ padding:'3px 6px', borderRadius:4, border:'1px solid rgba(0,230,138,0.3)', background:'rgba(0,230,138,0.08)', color:'#00e68a', cursor:'pointer', fontSize:7, fontWeight:600 }}>🛒</button>
                <button onClick={() => { try { const planItems = JSON.parse(localStorage.getItem('he_quick_plan_items') || '[]'); planItems.push({ name: food.name, id: food.id, amount: Math.round(portion * 100), kcal: Math.round(food.kcal * portion), p: Math.round(food.protein * portion), f: Math.round(food.fat * portion), c: Math.round(food.carbs * portion) }); localStorage.setItem('he_quick_plan_items', JSON.stringify(planItems)); alert('✅ Добавлено в план питания'); } catch {} }} style={{ padding:'3px 6px', borderRadius:4, border:'1px solid rgba(139,92,246,0.3)', background:'rgba(139,92,246,0.08)', color:'#a78bfa', cursor:'pointer', fontSize:7, fontWeight:600 }}>📋</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:3, marginTop:4 }}>
                <div style={{ background:'#18181b', borderRadius:4, padding:'2px 4px', textAlign:'center', fontSize:7, color:'rgba(255,255,255,0.85)' }}>🔥 {Math.round(food.kcal * portion)}</div>
                <div style={{ background:'rgba(59,130,246,0.08)', borderRadius:4, padding:'2px 4px', textAlign:'center', fontSize:7, color:'#60a5fa' }}>Б {Math.round(food.protein * portion)}</div>
                <div style={{ background:'rgba(245,158,11,0.08)', borderRadius:4, padding:'2px 4px', textAlign:'center', fontSize:7, color:'#fbbf24' }}>Ж {Math.round(food.fat * portion)}</div>
                <div style={{ background:'rgba(249,115,22,0.08)', borderRadius:4, padding:'2px 4px', textAlign:'center', fontSize:7, color:'#fb923c' }}>У {Math.round(food.carbs * portion)}</div>
              </div>
              {portion !== 1 && <div style={{ fontSize:7, color:'rgba(255,255,255,0.8)', marginTop:2 }}>× {portion.toFixed(2)} порции</div>}
            </div>);
          })}
        </div>
      )}
    </div>
  </div>);
};

const TravelGuide: React.FC = () => {
  const [travelAdvice] = React.useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('travel_workouts') || '[]'); } catch { return []; } });
  return (<>
    <div style={{ fontSize:12, fontWeight:600, color:'#fff', marginBottom:6 }}>✈ Питание в дороге</div>
    {travelAdvice.length > 0 ? travelAdvice.map((a, i) => <div key={i} style={{ fontSize:9, color:'#fff', marginBottom:4 }}>{a}</div>) : <div style={{ fontSize:10, color:'rgba(255,255,255,0.8)', padding:10 }}>Нет сохранённых советов.</div>}
    <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginTop:6 }}>
      🥜 Берите с собой: орехи, протеиновые батончики, сухофрукты<br />
      🍗 В ресторане: выбирайте белковую основу, просите соус отдельно<br />
      💧 В самолёте: пейте больше воды, ограничьте алкоголь
    </div>
  </>);
};

const SleepGuide: React.FC = () => {
  const sleepStacks = useMemo(() => { try { return JSON.parse(localStorage.getItem('sleep_stacks') || '[]'); } catch { return []; } }, []);
  return (<>
    <div style={{ fontSize:12, fontWeight:600, color:'#fff', marginBottom:6 }}>💤 Сон и восстановление</div>
    {sleepStacks.length > 0 ? sleepStacks.map((s: any, i: number) => <div key={i} style={{ fontSize:9, color:'#fff', marginBottom:4 }}>{s}</div>) : <div style={{ fontSize:10, color:'rgba(255,255,255,0.8)', padding:10 }}>Нет сохранённых стеков.</div>}
    <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginTop:6 }}>
      🌙 Последний приём за 2-3 ч до сна<br />
      🥛 Казеин/творог 30г на ночь ↓ катаболизм<br />
      ? Магний 400-600 мг + глицинат улучшают качество сна
    </div>
  </>);
};

const ReportsTab: React.FC<{ foodEntries: DiaryEntry[]; profile?: any; targets?: { kcal: number; protein: number; fats: number; carbs: number } }> = ({ foodEntries, profile, targets }) => {
  const [reportMode, setReportMode] = React.useState<'day'|'week'|'month'>('day');
  const [reportDate, setReportDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [reportSubTab, setReportSubTab] = React.useState<'overview' | 'full' | 'archive'>('overview');
  const [fullReport, setFullReport] = React.useState<NutritionReport | null>(null);
  const [archiveReports, setArchiveReports] = React.useState<NutritionReport[]>(() => { try { return JSON.parse(localStorage.getItem('he_nutrition_report_archive') || '[]'); } catch { return []; } });
  const [reportEditMode, setReportEditMode] = React.useState(false);
  const [reportEditText, setReportEditText] = React.useState('');
  const raw = React.useMemo(() => { try { return JSON.parse(localStorage.getItem('nutrition_diary') || '{}'); } catch { return {}; } }, [foodEntries]);
  const dayData = raw[reportDate];
  const weekStart = React.useMemo(() => { const d = new Date(reportDate); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().split('T')[0]; }, [reportDate]);
  const weekData = React.useMemo(() => {
    const start = new Date(weekStart); const entries: any[] = [];
    for (let i=0;i<7;i++) { const d = new Date(start); d.setDate(d.getDate()+i); const ds = d.toISOString().split('T')[0]; if (raw[ds]) Object.values(raw[ds].meals||{}).forEach((m:any) => m.forEach((e:any) => entries.push({...e, date:ds}))); }
    return entries;
  }, [raw, weekStart]);
  const monthKey = reportDate.slice(0,7);
  const monthData = React.useMemo(() => {
    const entries: any[] = [];
    Object.entries(raw).forEach(([date, d]: [string,any]) => { if (date.startsWith(monthKey)) Object.values(d.meals||{}).forEach((m:any) => m.forEach((e:any) => entries.push({...e, date}))); });
    return entries;
  }, [raw, monthKey]);
  const data = reportMode === 'day' ? (dayData ? Object.entries(dayData.meals||{}).flatMap(([meal,items]:[string,any]) => (items||[]).map((i:any) => ({...i, meal}))) : []) : reportMode === 'week' ? weekData : monthData;
  const totals = { kcal: data.reduce((s:number,i:any)=>s+(i.kcal||0),0), p: data.reduce((s:number,i:any)=>s+(i.p||0),0), f: data.reduce((s:number,i:any)=>s+(i.f||0),0), c: data.reduce((s:number,i:any)=>s+(i.c||0),0), count: data.length };
  const byMeal: Record<string,{kcal:number;p:number;f:number;c:number;count:number}> = reportMode === 'day' && dayData ? Object.fromEntries(Object.entries(dayData.meals||{}).map(([meal,items]:[string,any]) => { const mealItems = items||[]; return [meal, {kcal:mealItems.reduce((s:number,i:any)=>s+(i.kcal||0),0), p:mealItems.reduce((s:number,i:any)=>s+(i.p||0),0), f:mealItems.reduce((s:number,i:any)=>s+(i.f||0),0), c:mealItems.reduce((s:number,i:any)=>s+(i.c||0),0), count:mealItems.length}]; })) : {};
  const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const reportBtn = (isActive: boolean, onClick: () => void, children: React.ReactNode) => (
    <button onClick={onClick} style={{ padding:'5px 12px', borderRadius:8, fontSize:9, cursor:'pointer', border: isActive ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)', background: isActive ? 'linear-gradient(135deg,rgba(0,230,138,0.2),rgba(0,200,160,0.12))' : '#202023', color: isActive ? '#00e68a' : 'rgba(255,255,255,0.85)', fontWeight: isActive ? 700 : 400 }}>{children}</button>
  );
  const saveReportToArchive = (report: NutritionReport) => {
    const currentArchive = JSON.parse(localStorage.getItem('he_nutrition_report_archive') || '[]');
    const updated = [report, ...currentArchive].slice(0, 50);
    setArchiveReports(updated);
    localStorage.setItem('he_nutrition_report_archive', JSON.stringify(updated));
    try {
      const profileReports = JSON.parse(localStorage.getItem('he_profile_nutrition_reports') || '[]');
      profileReports.push({ date: reportDate, summary: { grade: report.overallGrade, kcalPct: report.kbjuPct.kcal, pPct: report.kbjuPct.p, deficits: report.microDeficiencies.length } });
      localStorage.setItem('he_profile_nutrition_reports', JSON.stringify(profileReports.slice(-100)));
    } catch {}
  };
  const curTab = reportSubTab;

  const tabButtons = (
    <div style={{ display:'flex', gap:4, marginBottom:8 }}>
      {reportBtn(curTab === 'overview', () => setReportSubTab('overview'), '📊 Обзор')}
      {reportBtn(curTab === 'full', () => setReportSubTab('full'), '📋 Полный отчёт')}
      {reportBtn(curTab === 'archive', () => setReportSubTab('archive'), '🗄 Архив')}
    </div>
  );

  return (<div style={{ display:'flex', flexDirection:'column', gap:8 }}>
    {reportSubTab === 'full' && (<div style={{ padding:14, ...cardBg }}>
      {tabButtons}
      <div style={labelSec}>📋 Полный отчёт о питании</div>
      {data.length === 0 ? (
        <div style={{ textAlign:'center', padding:20, color:'rgba(255,255,255,0.7)', fontSize:10 }}>
          Нет данных за выбранный период. Вносите приёмы пищи в дневник.
        </div>
      ) : !fullReport ? (
        <div style={{ textAlign:'center', padding:20 }}>
          <button onClick={() => {
            const meals = reportMode === 'day' && dayData ? Object.entries(dayData.meals||{}).map(([label, items]:[string,any]) => ({
              label, items: (items||[]).map((i:any) => ({ name: i.name, id: i.id || '', amount: i.amount || 100, kcal: i.kcal||0, p: i.p||0, f: i.f||0, c: i.c||0 })),
              totals: { kcal: (items||[]).reduce((s:number,i:any)=>s+(i.kcal||0),0), p: (items||[]).reduce((s:number,i:any)=>s+(i.p||0),0), f: (items||[]).reduce((s:number,i:any)=>s+(i.f||0),0), c: (items||[]).reduce((s:number,i:any)=>s+(i.c||0),0) },
            })) : [{ label: reportMode === 'week' ? 'Неделя' : 'Месяц', items: data.map((i:any) => ({ name: i.name, id: i.id || '', amount: i.amount || 100, kcal: i.kcal||0, p: i.p||0, f: i.f||0, c: i.c||0 })), totals }];
            const rep = generateNutritionReport({ meals, totals,
              targets: targets || { kcal: 2500, protein: 160, fats: 70, carbs: 300 },
              userWeight: profile?.settings?.weight || 80,
              userTDEE: targets?.kcal || 2500,
              healthIssues: [], planType: 'classic', variety: 'max', budget: 'medium',
              allergens: [], cyclingMode: 'none', goal: 'maintenance',
            });
            setFullReport(rep);
            setReportEditText(JSON.stringify(rep, null, 2));
            setReportEditMode(false);
            try { localStorage.setItem('he_nutrition_report_current', JSON.stringify(rep)); } catch {}
            saveReportToArchive(rep);
          }} style={{ padding:'10px 24px', borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontWeight:700, fontSize:12, boxShadow:'0 4px 16px rgba(0,230,138,0.2)' }}>
            📊 Сгенерировать полный отчёт
          </button>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.9)', marginTop:8 }}>Отчёт будет сохранён в архив и профиль</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:'calc(100vh - 320px)', overflowY:'auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderRadius:8, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)', fontSize:10 }}>
            <span>Оценка: <strong style={{ color: fullReport.overallGrade === 'A' ? '#00e68a' : fullReport.overallGrade === 'B' ? '#8b5cf6' : fullReport.overallGrade === 'C' ? '#f59e0b' : '#ef4444', fontSize:14 }}>{fullReport.overallGrade}</strong> — {fullReport.overallGradeLabel}</span>
            <span style={{ color:'rgba(255,255,255,0.8)', fontSize:8 }}>{fullReport.generatedAt.slice(0,10)}</span>
          </div>

          {/* KBJU % */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>📊 Выполнение КБЖУ</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4 }}>
              {[{l:'Ккал',v:fullReport.kbjuPct.kcal,c:'#00e68a'},{l:'Белки',v:fullReport.kbjuPct.p,c:'#60a5fa'},{l:'Жиры',v:fullReport.kbjuPct.f,c:'#fbbf24'},{l:'Углеводы',v:fullReport.kbjuPct.c,c:'#fb923c'}].map(s => (
                <div key={s.l} style={{ background:'#18181b', borderRadius:6, padding:'4px', textAlign:'center' }}>
                  <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>{s.l}</div>
                  <div style={{ fontSize:16, fontWeight:800, color: s.v >= 85 && s.v <= 115 ? '#00e68a' : s.v >= 70 ? '#f59e0b' : '#ef4444' }}>{s.v}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Weight dynamics */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>⚖️ Динамика веса</div>
            <div style={{ display:'flex', gap:6, marginBottom:4 }}>
              <div style={{ flex:1, background:'rgba(59,130,246,0.08)', borderRadius:6, padding:'4px 6px' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Базовая</div>
                <div style={{ fontSize:12, fontWeight:700, color: fullReport.weightDynamicsBasic.direction === 'loss' ? '#00e68a' : fullReport.weightDynamicsBasic.direction === 'gain' ? '#f59e0b' : '#fff' }}>
                  {fullReport.weightDynamicsBasic.direction === 'loss' ? '−' : fullReport.weightDynamicsBasic.direction === 'gain' ? '+' : '∼'}{fullReport.weightDynamicsBasic.weeklyKg} кг/нед
                </div>
              </div>
              <div style={{ flex:1, background:'rgba(139,92,246,0.08)', borderRadius:6, padding:'4px 6px' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Усиленная</div>
                <div style={{ fontSize:12, fontWeight:700, color:'#8b5cf6', display:'flex', alignItems:'center', gap:2 }}>
                  {fullReport.weightDynamicsEnhanced.weeklyKg} кг/нед
                  <span style={{ fontSize:7, color:'rgba(255,255,255,0.8)', fontWeight:400 }}>({fullReport.weightDynamicsEnhanced.confidence === 'high' ? '✓' : '?'})</span>
                </div>
              </div>
            </div>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)', lineHeight:1.4 }}>{fullReport.weightDynamicsBasic.explanation}</div>
            {fullReport.weightDynamicsEnhanced.factors.length > 0 && <div style={{ fontSize:7, color:'rgba(255,255,255,0.9)', marginTop:2 }}>Факторы: {fullReport.weightDynamicsEnhanced.factors.join('; ')}</div>}
          </div>

          {/* Micros */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>🧬 Микронутриенты</div>
            {fullReport.microDeficiencies.length > 0 && <div style={{ fontSize:8, color:'#f59e0b', marginBottom:4 }}>⚠ {fullReport.microDeficiencies.length} дефицитов</div>}
            <div style={{ maxHeight:100, overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }}>
              {Object.entries(fullReport.micros).slice(0,15).map(([k, v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:8, padding:'1px 0', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ color:'rgba(255,255,255,0.85)' }}>{k}</span>
                  <span style={{ color: v.status === 'ok' ? '#00e68a' : v.status === 'low' ? '#f59e0b' : '#ef4444', fontWeight:600 }}>{v.actual}/{v.target} ({v.pct}%)</span>
                </div>
              ))}
            </div>
            {fullReport.microDeficiencies.length > 0 && <div style={{ fontSize:7, color:'#f59e0b', marginTop:4, lineHeight:1.4 }}>Рекомендации: {fullReport.microDeficiencies.slice(0,3).join('; ')}</div>}
          </div>

          {/* Quality */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>⭐ Качество продуктов</div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ fontSize:18, fontWeight:800, color: fullReport.foodQualityScore >= 7 ? '#00e68a' : fullReport.foodQualityScore >= 5 ? '#f59e0b' : '#ef4444' }}>{fullReport.foodQualityScore}/10</div>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Средний тир: {fullReport.foodQualityDetails.avgTier} · {fullReport.foodQualityDetails.bestItems.length} лучших</div>
            </div>
          </div>

          {/* Water Balance */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>💧 Водный баланс</div>
            <div style={{ display:'flex', gap:4, marginBottom:2 }}>
              <div style={{ flex:1, background:'rgba(6,182,212,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Выпито</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.waterBalance.status === 'ok' ? '#00e68a' : fullReport.waterBalance.status === 'low' ? '#f59e0b' : '#ef4444' }}>{fullReport.waterBalance.intakeMl} мл</div>
              </div>
              <div style={{ flex:1, background:'rgba(6,182,212,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Норма</div>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{fullReport.waterBalance.targetMl} мл</div>
              </div>
              <div style={{ flex:1, background:'rgba(6,182,212,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>мл/кг</div>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{fullReport.waterBalance.intakePerKg}/{fullReport.waterBalance.targetPerKg}</div>
              </div>
            </div>
            {fullReport.waterBalance.deficitMl > 0 && <div style={{ fontSize:7, color:'#f59e0b' }}>Дефицит {fullReport.waterBalance.deficitMl} мл</div>}
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)', marginTop:2, lineHeight:1.4 }}>{fullReport.waterBalance.recommendation}</div>
          </div>

          {/* Sodium/Potassium */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>🧂 Натрий/Калий</div>
            <div style={{ display:'flex', gap:4, marginBottom:2 }}>
              <div style={{ flex:1, background:'rgba(251,191,36,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Na</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.sodiumPotassium.status === 'high' ? '#ef4444' : '#00e68a' }}>{fullReport.sodiumPotassium.naMg} мг</div>
              </div>
              <div style={{ flex:1, background:'rgba(59,130,246,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>K</div>
                <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa' }}>{fullReport.sodiumPotassium.kMg} мг</div>
              </div>
              <div style={{ flex:1, background:'rgba(139,92,246,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Na/K</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.sodiumPotassium.ratio > 1.5 ? '#ef4444' : fullReport.sodiumPotassium.ratio > 1 ? '#f59e0b' : '#00e68a' }}>{fullReport.sodiumPotassium.ratio}</div>
              </div>
            </div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)', lineHeight:1.4 }}>{fullReport.sodiumPotassium.recommendation}</div>
          </div>

          {/* Protein Timing */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>⏱ Тайминг белка</div>
            <div style={{ display:'flex', gap:4, marginBottom:2 }}>
              <div style={{ flex:1, background:'rgba(59,130,246,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Равномерность</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.proteinTiming.evennessScore >= 80 ? '#00e68a' : fullReport.proteinTiming.evennessScore >= 60 ? '#f59e0b' : '#ef4444' }}>{fullReport.proteinTiming.evennessScore}%</div>
              </div>
              <div style={{ flex:1, background:'rgba(59,130,246,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Макс разрыв</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.proteinTiming.maxGapHours > 5 ? '#f59e0b' : '#00e68a' }}>{fullReport.proteinTiming.maxGapHours}С‡</div>
              </div>
            </div>
            {fullReport.proteinTiming.gaps.length > 0 && <div style={{ fontSize:7, color:'#f59e0b', lineHeight:1.3 }}>{fullReport.proteinTiming.gaps.slice(0, 2).join('; ')}</div>}
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)', marginTop:2, lineHeight:1.4 }}>{fullReport.proteinTiming.recommendation}</div>
          </div>

          {/* Glycemic Load */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>🍚 Гликемическая нагрузка</div>
            <div style={{ display:'flex', gap:4, marginBottom:2 }}>
              <div style={{ flex:1, background:'rgba(251,191,36,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Общая ГН</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.glycemicLoad.status === 'high' ? '#ef4444' : '#00e68a' }}>{fullReport.glycemicLoad.totalGL}</div>
              </div>
              <div style={{ flex:1, background:'rgba(251,191,36,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Средний GI</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.glycemicLoad.avgGI > 60 ? '#f59e0b' : '#00e68a' }}>{fullReport.glycemicLoad.avgGI}</div>
              </div>
              <div style={{ flex:1, background:'rgba(251,191,36,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Макс/приём</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.glycemicLoad.maxPerMeal > 25 ? '#ef4444' : '#00e68a' }}>{fullReport.glycemicLoad.maxPerMeal}</div>
              </div>
            </div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)', lineHeight:1.4 }}>{fullReport.glycemicLoad.recommendation}</div>
          </div>

          {/* Fat Quality */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>🥑 Качество жиров</div>
            <div style={{ display:'flex', gap:4, marginBottom:2 }}>
              <div style={{ flex:1, background:'rgba(251,191,36,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Насыщ.</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.fatQuality.satPct > 15 ? '#ef4444' : '#00e68a' }}>{fullReport.fatQuality.satPct}%</div>
              </div>
              <div style={{ flex:1, background:'rgba(59,130,246,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Омега-3</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.fatQuality.omega3G >= 1.6 ? '#00e68a' : '#f59e0b' }}>{fullReport.fatQuality.omega3G}г</div>
              </div>
              <div style={{ flex:1, background:'rgba(139,92,246,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Ом-6/3</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.fatQuality.omega6to3ratio > 6 ? '#ef4444' : '#00e68a' }}>{fullReport.fatQuality.omega6to3ratio}:1</div>
              </div>
            </div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)', lineHeight:1.4 }}>{fullReport.fatQuality.recommendation}</div>
          </div>

          {/* Meal Timing */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>🕐 Режим питания</div>
            <div style={{ display:'flex', gap:4, marginBottom:2, flexWrap:'wrap' }}>
              <div style={{ background:'rgba(99,102,241,0.06)', borderRadius:6, padding:'3px 6px', fontSize:8, color:'#fff' }}>Приёмов: {fullReport.mealTiming.mealCount}</div>
              <div style={{ background:'rgba(99,102,241,0.06)', borderRadius:6, padding:'3px 6px', fontSize:8, color: fullReport.mealTiming.longestGapHours > 5 ? '#f59e0b' : '#fff' }}>Разрыв: {fullReport.mealTiming.longestGapHours}ч</div>
              <div style={{ background: fullReport.mealTiming.hasPreWorkout ? 'rgba(0,230,138,0.1)' : 'rgba(239,68,68,0.06)', borderRadius:6, padding:'3px 6px', fontSize:8, color: fullReport.mealTiming.hasPreWorkout ? '#00e68a' : '#ef4444' }}>{fullReport.mealTiming.hasPreWorkout ? '✓ Предтрен' : '✕ Предтрен'}</div>
              <div style={{ background: fullReport.mealTiming.hasPostWorkout ? 'rgba(0,230,138,0.1)' : 'rgba(239,68,68,0.06)', borderRadius:6, padding:'3px 6px', fontSize:8, color: fullReport.mealTiming.hasPostWorkout ? '#00e68a' : '#ef4444' }}>{fullReport.mealTiming.hasPostWorkout ? '✓ Посттрен' : '✕ Посттрен'}</div>
            </div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)', lineHeight:1.4 }}>{fullReport.mealTiming.recommendation}</div>
          </div>

          {/* Fiber */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>🥬 Клетчатка</div>
            <div style={{ display:'flex', gap:4, alignItems:'center' }}>
              <div style={{ flex:1, background:'rgba(34,197,94,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Факт</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.fiberAnalysis.status === 'ok' ? '#00e68a' : fullReport.fiberAnalysis.status === 'low' ? '#f59e0b' : '#ef4444' }}>{fullReport.fiberAnalysis.totalG}г</div>
              </div>
              <div style={{ flex:1, background:'rgba(34,197,94,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Цель</div>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{fullReport.fiberAnalysis.targetG}г</div>
              </div>
              <div style={{ flex:1, background:'rgba(34,197,94,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>%</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.fiberAnalysis.pct >= 80 ? '#00e68a' : '#f59e0b' }}>{fullReport.fiberAnalysis.pct}%</div>
              </div>
            </div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)', marginTop:2, lineHeight:1.4 }}>{fullReport.fiberAnalysis.recommendation}</div>
          </div>

          {/* Ca/Mg */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>🦴 Кальций/Магний</div>
            <div style={{ display:'flex', gap:4, marginBottom:2 }}>
              <div style={{ flex:1, background:'rgba(168,85,247,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Ca</div>
                <div style={{ fontSize:11, fontWeight:700, color:'#a78bfa' }}>{fullReport.calciumMagnesium.caMg} мг</div>
              </div>
              <div style={{ flex:1, background:'rgba(168,85,247,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Mg</div>
                <div style={{ fontSize:11, fontWeight:700, color:'#a78bfa' }}>{fullReport.calciumMagnesium.mgMg} мг</div>
              </div>
              <div style={{ flex:1, background:'rgba(168,85,247,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Ca/Mg</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.calciumMagnesium.ratio > 3.5 ? '#ef4444' : fullReport.calciumMagnesium.ratio < 1.5 ? '#f59e0b' : '#00e68a' }}>{fullReport.calciumMagnesium.ratio}</div>
              </div>
            </div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)', lineHeight:1.4 }}>{fullReport.calciumMagnesium.recommendation}</div>
          </div>

          {/* Plan decisions */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>📋 Параметры составления рациона</div>
            {fullReport.planDecisions.map((d, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:8, padding:'2px 0', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ color:'rgba(255,255,255,0.9)' }}>{d.param}</span>
                <span style={{ color:'#fff', fontWeight:600, textAlign:'right', maxWidth:'60%' }}>{d.value}</span>
              </div>
            ))}
          </div>

          {/* Risks */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>⚠ Анализ рисков</div>
            {fullReport.riskAnalysis.map((r, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:8, padding:'2px 0', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ color:'rgba(255,255,255,0.85)' }}>{r.system}</span>
                <span style={{ color: r.score > 4 ? '#ef4444' : r.score > 2 ? '#f59e0b' : '#00e68a', fontWeight:600 }}>{r.score}/{r.maxScore}</span>
              </div>
            ))}
          </div>

          {/* Allergens */}
          {fullReport.allergenWarnings.length > 0 && <div style={{ padding:'6px 10px', borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#ef4444', marginBottom:4 }}>🚫 Аллергены</div>
            {fullReport.allergenWarnings.map((w, i) => <div key={i} style={{ fontSize:8, color:'rgba(255,255,255,0.85)' }}>• {w.food}: {w.allergens.join(', ')}</div>)}
          </div>}

          {/* Recommendations */}
          {fullReport.recommendations.length > 0 && <div style={{ padding:'6px 10px', borderRadius:8, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.15)' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#a855f7', marginBottom:4 }}>💡 Рекомендации</div>
            {fullReport.recommendations.map((r, i) => <div key={i} style={{ fontSize:8, color:'rgba(255,255,255,0.85)', lineHeight:1.5, marginBottom:2 }}>• {r}</div>)}
          </div>}
          {/* Edit/Save buttons */}
          <div style={{ display:'flex', gap:4, marginTop:4 }}>
            <button onClick={() => { if (reportEditMode) { try { localStorage.setItem('he_nutrition_report_current', reportEditText); } catch {} }; setReportEditMode(!reportEditMode); }} style={{ flex:1, padding:'6px', borderRadius:8, cursor:'pointer', border:'1px solid rgba(96,165,250,0.3)', background: reportEditMode ? 'rgba(96,165,250,0.15)' : 'rgba(96,165,250,0.06)', color:'#60a5fa', fontSize:9, fontWeight:600 }}>
              {reportEditMode ? '💾 Сохранить правки' : '✏️ Редактировать отчёт'}
            </button>
            <button onClick={() => { try { const edited = reportEditMode ? JSON.parse(reportEditText) : fullReport; saveReportToArchive(edited); } catch(e) { alert('Ошибка сохранения: ' + e); } }} style={{ flex:1, padding:'6px', borderRadius:8, cursor:'pointer', border:'1px solid rgba(0,230,138,0.3)', background:'rgba(0,230,138,0.06)', color:'#00e68a', fontSize:9, fontWeight:600 }}>
              📥 Сохранить в архив
            </button>
          </div>
          {reportEditMode && (
            <textarea value={reportEditText} onChange={e => setReportEditText(e.target.value)} style={{ width:'100%', height:200, padding:8, borderRadius:8, background:'#18181b', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:9, fontFamily:'monospace', marginTop:4, boxSizing:'border-box' }} />
          )}
        </div>
      )}
    </div>)}

    {reportSubTab === 'archive' && (<div style={{ padding:14, ...cardBg }}>
      {tabButtons}
      <div style={labelSec}>🗄 Архив отчётов</div>
      {archiveReports.length === 0 ? (
        <div style={{ textAlign:'center', padding:20, color:'rgba(255,255,255,0.7)', fontSize:10 }}>Нет сохранённых отчётов. Сгенерируйте полный отчёт.</div>
      ) : (
        <div style={{ maxHeight:400, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
          {archiveReports.map((rep, idx) => (
            <div key={idx} style={{ padding:'6px 10px', borderRadius:8, background:'#202023', border:'1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}
              onClick={() => { setFullReport(rep); setReportSubTab('full'); }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:10, fontWeight:600, color:'#fff' }}>Отчёт от {rep.generatedAt?.slice(0,10) || 'N/A'}</span>
                <span style={{ fontSize:12, fontWeight:800, color: rep.overallGrade === 'A' ? '#00e68a' : rep.overallGrade === 'B' ? '#8b5cf6' : rep.overallGrade === 'C' ? '#f59e0b' : '#ef4444' }}>{rep.overallGrade}</span>
              </div>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.9)', marginTop:2 }}>{rep.overallGradeLabel} · КБЖУ {rep.kbjuPct.kcal}% · {rep.microDeficiencies.length} дефицитов</div>
            </div>
          ))}
        </div>
      )}
      {archiveReports.length > 0 && <button onClick={() => { setArchiveReports([]); localStorage.removeItem('he_nutrition_report_archive'); localStorage.removeItem('he_nutrition_report_current'); localStorage.removeItem('he_profile_nutrition_reports'); }} style={{ marginTop:6, padding:'4px 8px', borderRadius:6, fontSize:8, cursor:'pointer', border:'1px solid rgba(239,68,68,0.2)', background:'rgba(239,68,68,0.06)', color:'#ef4444' }}>🗑 Очистить архив</button>}
    </div>)}

    {reportSubTab === 'overview' && (<div style={{ padding:14, ...cardBg }}>
      {tabButtons}
      <div style={labelSec}>📊 Обзор питания</div>
      <div style={{ display:'flex', gap:4, marginBottom:8 }}>
        {reportBtn(reportMode === 'day', () => setReportMode('day'), 'День')}
        {reportBtn(reportMode === 'week', () => setReportMode('week'), 'Неделя')}
        {reportBtn(reportMode === 'month', () => setReportMode('month'), 'Месяц')}
      </div>
      {reportMode === 'day' && <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} style={{ ...inputStyle, marginBottom:8 }} />}
      {/* Generate + save button */}
      <button onClick={() => {
        try {
          const report = { id: Date.now().toString(), date: new Date().toISOString().slice(0,10), kcal: Math.round(totals.kcal), protein: Math.round(totals.p), fat: Math.round(totals.f), carbs: Math.round(totals.c), items: data.length, timestamp: Date.now(), overallGrade: '—', kbjuPct: { kcal: Math.round(totals.kcal), protein: Math.round(totals.p), fat: Math.round(totals.f), carbs: Math.round(totals.c) }, mealCount: data.length, dietQuality: { score: 0, label: '—' }, risks: [], recommendations: [], plan: { days: [] } };
          localStorage.setItem('he_nutrition_report_current', JSON.stringify(report));
          const archive = JSON.parse(localStorage.getItem('he_nutrition_report_archive') || '[]');
          archive.unshift(report);
          localStorage.setItem('he_nutrition_report_archive', JSON.stringify(archive.slice(0, 20)));
        } catch {}
      }} style={{ width:'100%', padding:'8px', borderRadius:8, border:'1px solid rgba(0,230,138,0.25)', background:'rgba(0,230,138,0.06)', color:'#00e68a', cursor:'pointer', fontSize:9, fontWeight:600, marginBottom:8 }}>📄 Сгенерировать и сохранить отчёт</button>
      {reportMode === 'week' && <div style={{ display:'flex', gap:2, marginBottom:8 }}>
        {Array.from({length:7}, (_,i) => { const d = new Date(new Date(weekStart)); d.setDate(d.getDate()+i); const ds = d.toISOString().split('T')[0]; const hasData = !!raw[ds]; return <div key={i} style={{ flex:1, textAlign:'center', padding:'5px 2px', borderRadius:8, background: hasData ? 'rgba(0,230,138,0.12)' : '#202023', fontSize:8, color: hasData ? '#00e68a' : 'rgba(255,255,255,0.8)' }}>
          <div>{dayNames[i]}</div><div style={{ fontWeight:700, fontSize:11 }}>{d.getDate()}</div>
        </div>; })}
      </div>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:6, marginBottom:8 }}>
        {[{l:'Ккал',v:Math.round(totals.kcal),c:'#00e68a'},{l:'Белки',v:Math.round(totals.p),c:'#3b82f6'},{l:'Жиры',v:Math.round(totals.f),c:'#f59e0b'},{l:'Угл.',v:Math.round(totals.c),c:'#f97316'},{l:'Ед.',v:totals.count,c:'#a78bfa'}].map((s,i) => <div key={i} style={{ background:'#202023', borderRadius:8, padding:'5px', textAlign:'center' }}>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.85)' }}>{s.l}</div><div style={{ fontSize:15, fontWeight:800, color:s.c }}>{s.v}</div>
        </div>)}
      </div>
      {(function() {
        try {
          const nv2 = getNutritionV2Data();
          if (nv2.qualityScore <= 0) return null;
          const ql = getQualityLabel(nv2.qualityScore);
          return (
            <div style={{ padding:'8px 10px', borderRadius:8, background:'#202023', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)' }}>{ql.emoji} Качество рациона</div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.8)' }}>Клетчатка: {nv2.qualityBreakdown.fiber}/15 · Микро: {nv2.qualityBreakdown.microDensity}/30</div>
              </div>
              <div style={{ fontSize:20, fontWeight:800, color:ql.color }}>{nv2.qualityScore}<span style={{ fontSize:10, fontWeight:400 }}>/100</span></div>
            </div>
          );
        } catch { return null; }
      })()}
      {reportMode === 'day' && Object.keys(byMeal).length > 0 && <div>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:4 }}>По приёмам пищи:</div>
        {Object.entries(byMeal).map(([meal, vals]) => <div key={meal} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:9, color:'#fff' }}>
          <span style={{ fontWeight:600 }}>{meal}</span>
          <span style={{ color:'rgba(255,255,255,0.85)' }}>{Math.round(vals.kcal)} ккал | Б{Math.round(vals.p)} Ж{Math.round(vals.f)} У{Math.round(vals.c)}</span>
        </div>)}
      </div>}
      {data.length > 0 && <div style={{ marginTop:6 }}>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:4 }}>Продукты:</div>
        <div style={{ maxHeight:120, overflowY:'auto' }}>
          {data.map((i:any, idx:number) => <div key={idx} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', fontSize:8, color:'rgba(255,255,255,0.85)' }}>
            <span>{i.name} {i.meal ? <span style={{ color:'rgba(255,255,255,0.8)' }}>({i.meal})</span> : ''}</span>
            <span>{Math.round(i.kcal||0)}ккал</span>
          </div>)}
        </div>
      </div>}
    </div>)}
  </div>);
};

const InfoTab: React.FC = () => {
  const sections = [
    { title: '🎯 Расчёт КБЖУ — формула Миффлина-Сан-Жеора', body: 'BMR (базовый обмен):\n• Мужчины: 10×вес(кг) + 6.25×рост(см) − 5×возраст − 161 + 166\n• Женщины: 10×вес(кг) + 6.25×рост(см) − 5×возраст − 161\n\nTDEE = BMR × PAL (уровень активности). PAL рассчитывается как 1.2 + тренировки/нед × 0.075 + бонус за длительность >60 мин.\n\nЦелевые ккал: набор массы +10-15%, сушка −20%, поддержание = TDEE. Белок: 1.8-2.5 г/кг. Жиры: 0.8-1.2 г/кг. Остаток — углеводы.' },
    { title: '🥗 Как работает генерация плана питания', body: '1) Определяются целевые КБЖУ по вашим параметрам\n2) Выбираются приёмы пищи (3-5 в день) с учётом тренировок и предпочтений\n3) Для каждого приёма подбираются продукты из FOOD_DB (500+ продуктов) по категориям: белки, углеводы, жиры, овощи\n4) Алгоритм учитывает: аллергены, проблемы здоровья, предпочтения (веган, без глютена, без молочки), бюджет, разнообразие\n5) Проверяется DIAAS (усвояемость белка), PRAL (кислотная нагрузка), mTOR-стимуляция, гликемическая нагрузка\n6) Применяется v2-движок: BB Quality Score (1-10) + Overall Dietary Score с учётом фазы и фармакологии' },
    { title: '🔄 Циклирование и специальные режимы', body: '• Циклирование углеводов: высокоуглеводные дни в дни тренировок, низкоуглеводные — в дни отдыха. Автоматическая привязка к дням из профиля\n• Ленивый день: минимум готовки, простые блюда (tier=basic), 1 продукт на приём, 85% калорий\n• Читмил: запланированное отклонение от диеты с контролем калорий\n• Углеводная загрузка: повышенные углеводы перед соревнованиями/тяжёлыми тренировками\n• Компенсация: автоматическая корректировка калорий при переедании\n• Адаптация метаболизма: при длительном дефиците калорий алгоритм снижает TDEE на 5-15%' },
    { title: '⏱ Тайминг и распределение нутриентов', body: '• Белок: равномерно 20-40 г каждые 3-4 часа для максимальной стимуляции MPS. Быстрый белок (сыворотка) — после тренировки, медленный (казеин) — перед сном\n• Углеводы: основная масса вокруг тренировки (до и после). Предтренировочный приём за 1.5-2 часа\n• Жиры: равномерно в течение дня. Омега-3 не менее 1.6 г/день. Насыщенные жиры <15% от общих калорий\n• Вода: 30-40 мл/кг + 500-1000 мл за час тренировки' },
    { title: '🧬 v2 Скоринг: BB Quality + Overall Dietary', body: 'BB Quality Score (1-10): статический рейтинг продукта для бодибилдинга. Учитывает: белок/100 ккал, лейцин, аминокислотный профиль, клетчатку, гликемический индекс, насыщенные жиры, натрий.\n\nOverall Dietary Score: динамический рейтинг с учётом:\n• Фазы (набор/сушка/ПКТ/мост)\n• Фармакологии (ААС оральные/инъекционные, HGH, инсулин, диуретики, стимуляторы)\n• Лабораторных данных (гематокрит, ЛПНП, ЛПВП, АЛТ, АСТ, СРБ, эстрадиол, пролактин, тестостерон, глюкоза, инсулин, HOMA-IR)\n• Тайминга приёма\n\nВключите в ⚙️ Настройки → вкладка v2.' },
    { title: '🍳 Компоновщик приёмов', body: 'После генерации плана вкладка «Компоновщик» позволяет:\n• Заменить любой продукт на аналогичный (кнопка «🔄» на карточке)\n• Изменить количество продукта (кнопка «✏️»)\n• Удалить продукт из приёма\n• Добавить рецепт в приём целиком\n\nВсе изменения сохраняются в текущем плане. Дни недели переключаются кнопками Пн-Вс.' },
    { title: '📊 DailyDietDashboard — анализ рациона', body: '7 прогресс-баров в реальном времени:\n• mTOR-активация: достаточно ли лейцина для стимуляции синтеза белка\n• ЖКТ-нагрузка: FODMAP, клетчатка, ферментная нагрузка\n• PRAL (кислотная нагрузка): баланс кислых/щелочных продуктов\n• Аммиак-риск: избыток белка без достаточного выведения\n• Омега-баланс: соотношение Омега-6/Омега-3\n• Электролиты: Na/K/Mg баланс\n• Инсулин-риск: гликемическая нагрузка + HOMA-IR' },
    { title: '📋 Отчёт о питании', body: 'Полный отчёт включает:\n• КБЖУ факт vs цель с процентным отклонением\n• Микронутриенты vs RDA (витамины, минералы)\n• Качество продуктов: средний tier, лучшие позиции\n• Водный баланс: выпито vs норма (мл/кг)\n• Натрий/Калий: соотношение, рекомендации\n• Тайминг белка: равномерность, максимальный разрыв между приёмами\n• Гликемическая нагрузка: общая ГН, средний GI, максимум на приём\n• Качество жиров: % насыщенных, Омега-3, соотношение Ом-6/3\n• Клетчатка: факт vs 25-35 г норма\n• Итоговая оценка: A (>85%), B (>70%), C (>55%), D (<55%)' },
    { title: '🛒 Корзина с магазинами', body: '• Поддержка нескольких магазинов (добавление, переименование, удаление)\n• Каждый продукт в корзине сохраняет: название, количество, категорию, цену, заметку, магазин\n• Итоговая сумма и калорийность по каждому магазину\n• Активный магазин сохраняется между сессиями\n• Кнопка «В корзину» доступна в каталоге и на карточках продуктов' },
    { title: '🩺 Здоровье — интеграция с планировщиком', body: 'Вкладка «Здоровье» (внутри Планировщика):\n• Ввод 8+ маркеров крови (гематокрит, гемоглобин, ЛПВП, ЛПНП, АЛТ, АСТ, СРБ, тестостерон) с цветовой индикацией\n• 8 предустановленных проблем здоровья: отёки, непереносимость лактозы/глютена, диабет, гипертония, ЖКТ, подагра, камни в почках\n• При выборе проблемы — автоматическое исключение конфликтующих продуктов из плана\n• Список аллергенов: лактоза, глютен, орехи, яйца, соя, морепродукты, гистамин, сульфиты\n• Данные синхронизируются с v2-движком скоринга' },
    { title: '⚡ Быстрые пресеты настроек', body: '🥩 Мясной — высокий белок, стандартные жиры\n🥬 Вегетарианский — растительные источники белка, без мяса/рыбы\n🫒 Средиземноморский — оливковое масло, рыба, овощи, орехи\n🥑 Кето — <50 г углеводов, высокие жиры\n🍚 High Carb — повышенные углеводы для массонабора\n💰 Бюджетный — недорогие продукты (курица, гречка, яйца)\n💪 Массонаборный — профицит 15%, белок 2.2 г/кг, частые приёмы\n🔥 Жиросжигающий — дефицит 20%, белок 2.5 г/кг, клетчатка 35 г' },
  ];
  return (<div style={{ display:'flex', flexDirection:'column', gap:8 }}>
    <div style={{ padding:14, ...cardBg }}>
      <div style={labelSec}>ℹ️ Как работает приложение</div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {sections.map((s, i) => (
          <div key={i} style={{ padding:'8px 10px', borderRadius:10, background:'#202023', border:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#fff', marginBottom:3 }}>{s.title}</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{s.body}</div>
          </div>
        ))}
      </div>
    </div>
  </div>);
};

const FavoritesTab: React.FC = () => {
  const [favTab, setFavTab] = useState<'products'|'recipes'|'plans'|'stacks'>('products');
  const [favs, setFavs] = useState<typeof FOOD_DB>(() => { try { const ids: string[] = JSON.parse(localStorage.getItem('he_food_favs') || '[]'); return ids.map(id => FOOD_DB.find(f => f.id === id)).filter(Boolean) as typeof FOOD_DB; } catch { return []; } });
  const removeFav = (id: string) => { try { const ids: string[] = JSON.parse(localStorage.getItem('he_food_favs') || '[]'); localStorage.setItem('he_food_favs', JSON.stringify(ids.filter(f => f !== id))); setFavs(prev => prev.filter(f => f.id !== id)); } catch {} };
  const [myRecipes] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('he_recipes') || '[]'); } catch { return []; } });
  const [savedPlans] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('he_my_plans') || '[]'); } catch { return []; } });
  const [savedStacks] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('he_finder_saved_stacks') || '[]'); } catch { return []; } });
  const catLabels: Record<string, string> = { protein:'🥩 Мясо', dairy:'🥛 Молочка', carb:'🍚 Крупы', grain:'🌾 Зерно', fat:'🧈 Жиры', veg_fruit:'🥦 Овощи', fast_food:'🍔 Фастфуд', supplement:'💊 Добавки', other:'📦 Прочее' };
  const groups: Record<string, typeof FOOD_DB> = {};
  favs.forEach(f => { const g = catLabels[f.category] || '📦 Прочее'; if (!groups[g]) groups[g] = []; groups[g].push(f); });
  const pill = (t: string, icon: string, label: string) => (
    <button onClick={() => setFavTab(t as any)} style={{ padding:'5px 10px', borderRadius:16, fontSize:8, fontWeight: favTab === t ? 700 : 400, cursor:'pointer', border: favTab === t ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)', background: favTab === t ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : '#202023', color: favTab === t ? '#000' : 'rgba(255,255,255,0.8)' }}>{icon} {label}</button>
  );
  return (<div style={{ display:'flex', flexDirection:'column', gap:8, paddingBottom:80 }}>
    <div style={{ display:'flex', gap:3, flexWrap:'wrap', padding:'4px 0' }}>
      {pill('products','⭐','Продукты')}{pill('recipes','🍳','Рецепты')}{pill('plans','📋','Планы')}{pill('stacks','🧩','Стеки')}
    </div>
    {favTab === 'products' && <div style={{ padding:14, ...cardBg }}>
      <div style={labelSec}>⭐ Избранные продукты ({favs.length}/100)</div>
      {favs.length === 0 ? <div style={{ textAlign:'center', padding:16, color:'rgba(255,255,255,0.8)', fontSize:10 }}>Нет избранных. Добавляйте из каталога ⭐.</div> : <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {Object.entries(groups).map(([cat, items]) => (
          <div key={cat}>
            <div style={{ fontSize:9, fontWeight:700, color:'#f97316', marginBottom:2, padding:'2px 0', borderBottom:'1px solid rgba(249,115,22,0.08)', display:'flex', alignItems:'center', gap:4 }}>
              {cat} <span style={{ fontSize:7, color:'rgba(255,255,255,0.85)', fontWeight:400 }}>({items.length})</span>
            </div>
            {items.map(f => (
              <div key={f.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 8px', borderRadius:8, background:'#202023', border:'1px solid rgba(255,255,255,0.04)', marginBottom:2 }}>
                <div><div style={{ fontSize:10, fontWeight:600, color:'#fff' }}>{f.name}</div><div style={{ fontSize:7, color:'rgba(255,255,255,0.8)' }}>{f.kcal}ккал • Б{f.protein} Ж{f.fat} У{f.carbs}</div></div>
                <div style={{ display:'flex', gap:2, alignItems:'center' }}>
                  <button onClick={() => addToCart({ name: f.name, kcal: f.kcal, amount: 100, category: f.category })} style={{ padding:'3px 6px', borderRadius:5, fontSize:8, cursor:'pointer', background:'rgba(0,230,138,0.12)', border:'1px solid rgba(0,230,138,0.2)', color:'#00e68a' }}>🛒</button>
                  <button onClick={() => removeFav(f.id)} style={{ padding:'3px 6px', borderRadius:5, border:'none', cursor:'pointer', background:'rgba(239,68,68,0.12)', color:'#ef4444', fontSize:8 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>}
    </div>}
    {favTab === 'recipes' && <div style={{ padding:14, ...cardBg }}>
      <div style={labelSec}>🍳 Сохранённые рецепты ({myRecipes.length})</div>
      {myRecipes.length === 0 ? <div style={{ textAlign:'center', padding:16, color:'rgba(255,255,255,0.8)', fontSize:10 }}>Нет рецептов. Создайте в 🍳 Рецепты.</div> : myRecipes.slice(0,50).map((r,i) => (
        <div key={i} style={{ padding:'6px 8px', borderRadius:8, background:'#202023', border:'1px solid rgba(255,255,255,0.04)', marginBottom:3 }}>
          <div style={{ fontSize:10, fontWeight:600, color:'#fff' }}>{r.name || 'Рецепт'}</div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.8)' }}>Ккал: {r.kcal || '—'} • Б{r.protein||0} Ж{r.fat||0} У{r.carbs||0}</div>
        </div>
      ))}
    </div>}
    {favTab === 'plans' && <div style={{ padding:14, ...cardBg }}>
      <div style={labelSec}>📋 Сохранённые планы ({savedPlans.length})</div>
      {savedPlans.length === 0 ? <div style={{ textAlign:'center', padding:16, color:'rgba(255,255,255,0.8)', fontSize:10 }}>Нет планов. Сохраните в 🥗 План.</div> : savedPlans.slice(0,30).map((p,i) => (
        <div key={i} style={{ padding:'6px 8px', borderRadius:8, background:'#202023', border:'1px solid rgba(255,255,255,0.04)', marginBottom:3 }}>
          <div style={{ fontSize:10, fontWeight:600, color:'#fff' }}>{p.name || `План ${i+1}`}</div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.8)' }}>{p.kcal ? `${Math.round(p.kcal)} ккал` : ''}</div>
        </div>
      ))}
    </div>}
    {favTab === 'stacks' && <div style={{ padding:14, ...cardBg }}>
      <div style={labelSec}>🧩 Сохранённые стеки ({savedStacks.length})</div>
      {savedStacks.length === 0 ? <div style={{ textAlign:'center', padding:16, color:'rgba(255,255,255,0.8)', fontSize:10 }}>Нет стеков. Сохраните в Бады → Готовые стеки.</div> : savedStacks.map((ids, i) => (
        <div key={i} style={{ padding:'6px 8px', borderRadius:8, background:'#202023', border:'1px solid rgba(255,255,255,0.04)', marginBottom:3 }}>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)' }}>{Array.isArray(ids) ? ids.join(', ') : JSON.stringify(ids)}</div>
        </div>
      ))}
    </div>}
  </div>);
};

export const NutritionScreen: React.FC = () => {
  const linked = useDataLink();
  const [tab, setTab] = useState<ActiveTab>('mealplan');
  const [page, setPage] = useState<NutritionPage>('hero');
  const [nutritionSection, setNutritionSection] = useState<NutritionSection>('all');
  const [foodEntries, setFoodEntries] = useState<DiaryEntry[]>([]);
  const [dailyLogs, setDailyLogs] = useState<Record<string, DiaryEntry[]>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem('nutrition_diary');
      if (raw) {
        const diary = JSON.parse(raw);
        const allEntries: DiaryEntry[] = [];
        const logs: Record<string, DiaryEntry[]> = {};
        Object.entries(diary).forEach(([date, d]: [string, any]) => {
          const dayEntries: DiaryEntry[] = [];
          Object.values(d.meals || {}).flat().forEach((m: any) => {
            const entry = { name: m.name, kcal: m.kcal, p: m.p, f: m.f, c: m.c, date };
            allEntries.push(entry);
            dayEntries.push(entry);
          });
          logs[date] = dayEntries;
        });
        setFoodEntries(allEntries);
        setDailyLogs(logs);
      }
    } catch {}
  }, []);

  // Daily aggregates: group food entries by date for correct weekly averages and charts
  const dailyAggregates = useMemo(() => {
    const days = Object.entries(dailyLogs).sort(([a], [b]) => a.localeCompare(b));
    return days.map(([date, entries]) => ({
      date,
      kcal: entries.reduce((s, e) => s + (e.kcal || 0), 0),
      protein: entries.reduce((s, e) => s + (e.p || 0), 0),
      fat: entries.reduce((s, e) => s + (e.f || 0), 0),
      carbs: entries.reduce((s, e) => s + (e.c || 0), 0),
    }));
  }, [dailyLogs]);

  const avgWeeklyKcal = useMemo(() => {
    if (dailyAggregates.length === 0) return 0;
    return dailyAggregates.reduce((s, d) => s + d.kcal, 0) / dailyAggregates.length;
  }, [dailyAggregates]);
  const avgWeeklyProtein = useMemo(() => {
    if (dailyAggregates.length === 0) return 0;
    return dailyAggregates.reduce((s, d) => s + d.protein, 0) / dailyAggregates.length;
  }, [dailyAggregates]);
  const avgWeeklyFat = useMemo(() => {
    if (dailyAggregates.length === 0) return 0;
    return dailyAggregates.reduce((s, d) => s + d.fat, 0) / dailyAggregates.length;
  }, [dailyAggregates]);
  const avgWeeklyCarbs = useMemo(() => {
    if (dailyAggregates.length === 0) return 0;
    return dailyAggregates.reduce((s, d) => s + d.carbs, 0) / dailyAggregates.length;
  }, [dailyAggregates]);

  // Chart data arrays (7/14/30 day ranges)
  const chartKcalData = useMemo(() => {
    return dailyAggregates.slice(-30).map(d => d.kcal);
  }, [dailyAggregates]);
  const chartProteinData = useMemo(() => {
    return dailyAggregates.slice(-30).map(d => d.protein);
  }, [dailyAggregates]);
  const chartLabels = useMemo(() => {
    return dailyAggregates.slice(-30).map(d => d.date.slice(5));
  }, [dailyAggregates]);

  const cartCount = useMemo(() => { try { return JSON.parse(localStorage.getItem('he_nutrition_carts') || '[]').reduce((s:number,st:any) => s + (st.items?.length || 0), 0); } catch { return 0; } }, [tab]);

  const macroTargets = useMemo(() => {
    const s = linked.profile?.settings;
    if (!s?.weight) return { kcal: 2500, protein: 160, fats: 70, carbs: 300 };
    const pal = derivePAL(s.workoutsPerWeek, s.avgWorkoutMinutes);
    const goal = (s.primaryGoal as string) || 'maintenance';
    try {
      const t = calcNutrition({ weightKg: s.weight, heightCm: s.height || 175, age: s.age || 30, sex: s.sex || 'male', pal, goal });
      return { kcal: t.kcal, protein: t.protein, fats: t.fats, carbs: t.carbs };
    } catch { return { kcal: 2500, protein: 160, fats: 70, carbs: 300 }; }
  }, [linked.profile]);

  const renderContent = () => {
    switch (tab) {
      case 'diary': return <InfoErrorBoundary label="Дневник питания"><NutritionDiary foodEntries={foodEntries} targets={macroTargets} weight={linked.profile?.settings?.weight} age={linked.profile?.settings?.age} sex={linked.profile?.settings?.sex} /></InfoErrorBoundary>;
      case 'charts': return <InfoErrorBoundary label="Графики"><Suspense fallback={<div style={{padding:20,textAlign:'center',color:'var(--text-dim)',fontSize:11}}>Загрузка графиков...</div>}><NutritionCharts kcalData={chartKcalData} proteinData={chartProteinData} labels={chartLabels} dailyLogs={dailyLogs} /></Suspense></InfoErrorBoundary>;
      case 'mealplan': return <InfoErrorBoundary label="План питания"><IndividualPlan profile={linked.profile} course={linked.course} /></InfoErrorBoundary>;
      case 'cart': return <CartTab />;
      case 'restaurant': return <RestaurantTab />;
      case 'favorites': return <FavoritesTab />;
      case 'catalog': return <CatalogTab />;
      case 'reference': return <ReferenceTab />;
      case 'recipes': return <RecipesTab />;
      case 'reports': return <InfoErrorBoundary label="Отчёты"><ReportsTab foodEntries={foodEntries} profile={linked.profile} targets={macroTargets} /></InfoErrorBoundary>;
      case 'customfood': return <InfoErrorBoundary label="Свои продукты"><NutritionCustomFood /></InfoErrorBoundary>;
      case 'overview': return <InfoErrorBoundary label="Обзор"><NutritionOverview
        profile={linked.profile}
        avgWeeklyKcal={avgWeeklyKcal}
        avgWeeklyProtein={avgWeeklyProtein}
        avgWeeklyFat={avgWeeklyFat}
        avgWeeklyCarbs={avgWeeklyCarbs}
      /></InfoErrorBoundary>;
      case 'info': return <InfoTab />;
      case 'progress': return <InfoErrorBoundary label="Прогресс"><ProgressTracker /></InfoErrorBoundary>;
      case 'nutria': return <InfoErrorBoundary label="Нутрициолог"><NutriAdvisor /></InfoErrorBoundary>;
      case 'visualize': return <InfoErrorBoundary label="Блюдо"><MealVisualizer items={[]} /></InfoErrorBoundary>;
      case 'achievements': return <InfoErrorBoundary label="Достижения"><Achievements /></InfoErrorBoundary>;
      case 'quests': return <InfoErrorBoundary label="Квесты"><DailyQuests /></InfoErrorBoundary>;
      case 'peri': return <InfoErrorBoundary label="Пери-воркаут"><PeriWorkoutCard /></InfoErrorBoundary>;
      case 'usefulness': return <InfoErrorBoundary label="Полезность"><ProductUsefulnessPlanner /></InfoErrorBoundary>;
      default: return null;
    }
  };

  if (page === 'hero') {
    return (
      <div style={{ position:'fixed', inset:0, display:'flex', flexDirection:'column' }}>
        <img src="/nutrition-hero.jpg" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 45%, rgba(0,0,0,0.85))' }} />
        <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#fff', margin:'0 0 2px', textShadow:'0 2px 14px rgba(0,0,0,0.9)' }}>Питание</h1>
          <p style={{ fontSize:11, color:'rgba(255,255,255,0.9)', margin:'0 0 14px', textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>Рекомендации и составление рациона под указанные параметры</p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { section: 'diary' as NutritionSection, tab: 'diary' as ActiveTab, icon: '📋', title: 'Дневник и аналитика', desc: 'Дневник, графики, отчёты', color: '#22c55e' },
              { section: 'planning' as NutritionSection, tab: 'mealplan' as ActiveTab, icon: '🥗', title: 'Планирование питания', desc: 'План, справочник, инфо', color: '#f97316' },
            ].map(card => (
              <button key={card.tab} onClick={() => { setPage('tabs'); setNutritionSection(card.section); setTab(card.tab); }} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%',
                background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)', color:'var(--text)',
              }}>
                <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background: card.color + '20', fontSize:20 }}>{card.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:1, color: card.color, letterSpacing:-0.2 }}>{card.title}</div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)' }}>{card.desc}</div>
                </div>
                <span style={{ color: card.color, fontSize:16, opacity:0.5 }}>→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen nutrition" style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'auto', padding:0 }}>
      <div style={{
        display:'flex', alignItems:'center', gap:8, padding:'8px 12px', flexShrink:0,
        background:'#18181b',
        borderBottom:'1px solid rgba(255,255,255,0.06)',
        position:'sticky', top:0, zIndex:20,
      }}>
        <button onClick={() => setPage('hero')} style={{
          padding:'4px 8px', cursor:'pointer', fontSize:20, color:'rgba(255,255,255,0.85)',
          border:'none', background:'transparent', display:'flex', alignItems:'center',
        }}>←</button>
        <div style={{ flex:1, fontSize:15, fontWeight:700, color:'#fff', letterSpacing:-0.3 }}>Питание</div>
        <span style={{ fontSize:9, color:'#fff' }}>
          {nutritionSection === 'diary' ? 'Дневник' : 'Всё'}
        </span>
      </div>

      {/* V2 adjustments bar — shows on mealplan tab */}
      {tab === 'mealplan' && (function() {
        const nv2 = getNutritionV2Data();
        const s = linked.profile?.settings;
        const v2Result = (() => {
          if (!s) return null;
          try {
            const engineGoal = ({ mass:'bulk', strength:'strength', fat_loss:'cut', cutting:'cut', maintenance:'maintenance', recomposition:'recomp' } as any)[s.primaryGoal || 'maintenance'] || 'maintenance';
            return calcNutritionV2({ weightKg: s.weight || 80, heightCm: s.height || 175, age: s.age || 30, sex: s.sex || 'male', pal: 1.55, goal: engineGoal, bodyFatPercent: s.bodyFat });
          } catch { return null; }
        })();
        const active: string[] = [];
        if (nv2.lazyDayActive) active.push('🛋 Ленивый день');
        if (nv2.cravingMode) active.push('🍬 Хочу сладкое');
        if (nv2.compensationActive) active.push(`⚖ Компенсация ${nv2.compensationRemaining}ккал`);
        if (nv2.hungryLevel > 7) active.push('🔴 Высокий голод');
        if (nv2.metabolicAdaptation > 0) active.push(`📉 Адаптация -${Math.round(nv2.metabolicAdaptation * 100)}%`);
        if (v2Result && v2Result.adjustment !== 0) active.push(`📊 TDEE корр. ${v2Result.adjustment > 0 ? '+' : ''}${v2Result.adjustment}ккал`);
        if (s.bodyFat) active.push(`🧬 %жира: ${s.bodyFat}%`);
        // Periodization suggestions
        const metaCheck = checkMetabolicAdaptation();
        metaCheck.suggestions.forEach(sug => {
          active.push(`${sug.urgency === 'critical' ? '🔴' : sug.urgency === 'warning' ? '🟡' : 'ℹ️'} ${sug.action.slice(0, 40)}`);
        });

        if (active.length === 0) return null;
        return (
          <div style={{ display:'flex', gap:3, padding:'4px 8px', overflowX:'auto', scrollbarWidth:'none', flexShrink:0 }}>
            {active.map((a,i) => (
              <span key={i} style={{ padding:'3px 8px', borderRadius:6, fontSize:8, background:'rgba(0,230,138,0.1)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.2)', whiteSpace:'nowrap' }}>{a}</span>
            ))}
          </div>
        );
      })()}

      <div style={{ flex:1, minHeight:0, overflowY:'auto', padding:'0 8px 80px' }}>
        <div style={{
          display:'flex', gap:3, flexWrap:'nowrap', overflowX:'auto', overflowY:'hidden',
          padding:'8px 4px 10px',
          scrollbarWidth:'none', msOverflowStyle:'none',
          WebkitOverflowScrolling:'touch', whiteSpace:'nowrap',
        }}>
          {(SECTION_TABS[nutritionSection] || SECTION_TABS.all).map(t => {
            const isActive = tab === t;
            return (
              <button key={t} onClick={() => setTab(t as ActiveTab)} style={{
                flexShrink:0, padding:'6px 14px', borderRadius:20, cursor:'pointer',
                fontSize:10, fontWeight: isActive ? 700 : 500, letterSpacing:0.2,
                border: isActive ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
                background: isActive ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : '#18181b',
                color: isActive ? '#000' : '#fff',
                transition:'all 0.2s cubic-bezier(0.22,1,0.36,1)',
              }}>
                {TAB_LABELS[t] || t}
                {t === 'cart' && cartCount > 0 && (
                  <span style={{ marginLeft:3, background:'rgba(0,0,0,0.2)', borderRadius:8, padding:'1px 5px', fontSize:8, fontWeight:700 }}>{cartCount}</span>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ animation:'fadeSlideIn 0.3s ease' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};


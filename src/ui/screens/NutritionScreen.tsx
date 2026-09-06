import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { HeroImg } from '../HeroImg';
import { FOOD_DB } from '../../core/nutrition-database';
import { useDataLink, derivePAL } from '../../core/data-link';
import { getRecipes, calculateUserRecipeUsefulness } from '../../engines/nutrition-periodization.engine';
import { calcNutrition } from '../../engines/nutrition.engine';
import { calcNutritionV2 } from '../../engines/nutrition-v2.engine';
import { NutritionDiary } from './NutritionScreen_parts/NutritionDiary';
import { searchByName as searchOFF, productToFoodItem } from '../../engines/openfoodfacts.engine';
import { RETAIL_CHAINS, retailToFoodItem, searchRetailProducts, type RetailProduct } from '../../engines/retail-search.engine';
import { IndividualPlan } from './NutritionScreen_parts/IndividualPlan';
import { NutritionReference } from './NutritionScreen_parts/NutritionReference';
import { addToCart, getCarts, saveCarts, getActiveStoreId, setActiveStoreId, CART_CAT_LABELS, CartStore, CartItemEnhanced } from '../../core/nutrition-utils';
import { NutritionCustomFood } from './NutritionScreen_parts/NutritionCustomFood';
import { NutritionOverview } from './NutritionScreen_parts/NutritionOverview';
import { ProductUsefulnessPlanner } from './NutritionScreen_parts/ProductUsefulnessPlanner';
import { ProgressTracker } from './NutritionScreen_parts/ProgressTracker';
import { NutriAdvisor } from './NutritionScreen_parts/NutriAdvisor';
import { MealVisualizer } from './NutritionScreen_parts/MealVisualizer';
import { Achievements } from './NutritionScreen_parts/Achievements';
import { DailyQuests } from './NutritionScreen_parts/DailyQuests';
import { PeriWorkoutCard } from './NutritionScreen_parts/PeriWorkoutCard';
import { NutritionWeeklyComparison } from './NutritionScreen_parts/NutritionWeeklyComparison';
import { readDiaryV2, onDiaryChangeV2, addMealEntryV2 } from './NutritionScreen_parts/diary-storage-v2';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { NativeIcon } from '../native/NativeIcons';
import { MetabolicHub } from './Shared/MetabolicHub';
import { RecipesTabModern } from './NutritionScreen_parts/RecipesTabModern';
import { ModernHero, ModernPill, ModernSearch, modernCardBg } from './NutritionScreen_parts/nutrition-modern-kit';

const NutritionCharts = lazy(() => import('./NutritionScreen_parts/NutritionCharts').then(m => ({ default: m.NutritionCharts })));
import { generateNutritionReport, NutritionReport } from '../../engines/nutrition-report.engine';
import { isNativeApp } from '../../core/app-platform';
import { getNutritionV2Data } from '../../core/nutrition-v2-data';
import { getQualityLabel } from '../../engines/nutrition-quality.engine';
import { InfoErrorBoundary } from './SupportScreen_parts/SupportScreenData';

interface DiaryEntry { name: string; kcal: number; p: number; f: number; c: number; date?: string; }
type NutritionPage = 'hero' | 'tabs';
type NutritionSection = 'diary' | 'planning' | 'overview' | 'analytics' | 'all';
type ActiveTab = 'diary' | 'charts' | 'mealplan' | 'cart' | 'favorites' | 'catalog' | 'reference' | 'recipes' | 'reports' | 'restaurant' | 'info' | 'customfood' | 'overview' | 'usefulness' | 'progress' | 'nutria' | 'visualize' | 'achievements' | 'quests' | 'peri' | 'metabolic';

const SECTION_TABS: Record<NutritionSection, string[]> = {
  overview: ['diary', 'charts', 'mealplan', 'cart', 'favorites', 'catalog', 'reference', 'recipes', 'restaurant', 'reports', 'customfood', 'overview', 'usefulness', 'progress', 'nutria', 'visualize', 'achievements', 'quests', 'metabolic'],
  analytics: ['charts', 'reports'],
  diary: ['diary', 'charts', 'reports', 'peri'],
  planning: ['mealplan', 'catalog', 'favorites', 'reference', 'info', 'usefulness', 'recipes', 'restaurant', 'metabolic'],
  all: ['diary', 'charts', 'mealplan', 'cart', 'favorites', 'catalog', 'reference', 'recipes', 'restaurant', 'reports', 'customfood', 'overview', 'usefulness', 'progress', 'nutria', 'visualize', 'achievements', 'quests', 'peri', 'metabolic'],
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
  metabolic: '⚖️ Метаболика',
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
    updateCarts([...carts, nc]); setActiveStoreId(nc.id); setNewStoreName(''); setShowNewStore(false);
  };
  const deleteStore = (id: string) => {
    const filtered = carts.filter(s => s.id !== id);
    updateCarts(filtered);
    if (getActiveStoreId() === id && filtered.length > 0) setActiveStoreId(filtered[0].id);
  };
  const renameStore = (id: string, name: string) => { updateCarts(carts.map(s => s.id === id ? { ...s, name } : s)); };
  const duplicateStore = (id: string) => {
    const src = carts.find(s => s.id === id);
    if (!src) return;
    const dup: CartStore = { ...src, id: 'store_' + Date.now(), name: src.name + ' (копия)', sortOrder: carts.length };
    updateCarts([...carts, dup]);
  };
  const updateStoreNotes = (id: string, notes: string) => { updateCarts(carts.map(s => s.id === id ? { ...s, notes } : s)); };
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
  const setItemPrice = (itemId: string, price: string) => { setEditingPrice(p => ({ ...p, [itemId]: price })); };
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

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <ModernHero icon="🛒" title="Корзина" subtitle="Списки покупок по магазинам — с КБЖУ, ценами и заметками. Синхронизируется с планом питания." count={carts.length} stats={[
        { k:'Магазинов', v: carts.length, sub:'списков', col:'#00e68a', bg:'rgba(0,230,138,0.08)' },
        { k:'Позиций', v: items.length, sub:'товаров', col:'#60a5fa', bg:'rgba(96,165,250,0.08)' },
        { k:'Ккал', v: Math.round(totalKcal), sub:'всего', col:'#f59e0b', bg:'rgba(245,158,11,0.08)' },
      ]} action={<button onClick={() => setShowNewStore(!showNewStore)} style={{ padding:'8px 14px', borderRadius:10, border:'1px solid rgba(0,230,138,0.25)', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontWeight:750, fontSize:11, cursor:'pointer', boxShadow:'0 4px 12px rgba(0,230,138,0.2)' }}>＋ Магазин</button>} />
      {showNewStore && (
        <div style={{ ...modernCardBg, padding:12, display:'flex', gap:8 }}>
          <input value={newStoreName} onChange={e => setNewStoreName(e.target.value)} placeholder="Название магазина (например: Перекрёсток)" style={{ flex:1, padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.07)', background:'#202023', color:'#fff', outline:'none', fontSize:12 }} onKeyDown={e => { if (e.key === 'Enter') addStore(); }} />
          <button onClick={addStore} style={{ padding:'10px 14px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontWeight:700, cursor:'pointer' }}>Создать</button>
          <button onClick={() => setShowNewStore(false)} style={{ padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.07)', background:'#202023', color:'rgba(255,255,255,0.6)', cursor:'pointer' }}>✕</button>
        </div>
      )}
      <div style={{ ...modernCardBg, padding:12 }}>
        <div style={{ fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.45)', letterSpacing:0.6, textTransform:'uppercase', marginBottom:8 }}>Магазины</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {carts.length===0 ? <span style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>Нет списков — создай первый</span> : carts.map(s => {
            const isActive = s.id === (activeStore?.id || '');
            return (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 4px 4px 8px', borderRadius:999, background: isActive ? 'rgba(0,230,138,0.10)' : '#202023', border: isActive ? '1px solid rgba(0,230,138,0.22)' : '1px solid rgba(255,255,255,0.06)', cursor:'pointer' }} onClick={() => switchStore(s.id)}>
                <span style={{ fontSize:11, fontWeight: isActive?700:500, color: isActive?'#00e68a':'rgba(255,255,255,0.75)' }}>{s.name}</span>
                <span style={{ fontSize:9, padding:'2px 6px', borderRadius:999, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.6)' }}>{s.items.length}</span>
                <button onClick={e => { e.stopPropagation(); duplicateStore(s.id); }} style={{ width:22, height:22, borderRadius:999, border:'none', background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:10 }}>⎘</button>
                {carts.length>1 && <button onClick={e => { e.stopPropagation(); deleteStore(s.id); }} style={{ width:22, height:22, borderRadius:999, border:'none', background:'rgba(239,68,68,0.10)', color:'#ef4444', cursor:'pointer', fontSize:10 }}>✕</button>}
              </div>
            );
          })}
        </div>
      </div>
      {!activeStore ? (
        <div style={{ ...modernCardBg, padding:24, textAlign:'center' }}>
          <div style={{ fontSize:28 }}>🛒</div>
          <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginTop:6 }}>Нет активного списка</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginTop:4 }}>Создай магазин, чтобы собирать продукты из плана.</div>
        </div>
      ) : (
        <>
          <div style={{ ...modernCardBg, padding:12 }}>
            <input value={editingStoreId === activeStore.id ? (storeNotes['_name'] ?? activeStore.name) : activeStore.name}
              onChange={e => { setEditingStoreId(activeStore.id); setStoreNotes(p => ({ ...p, _name: e.target.value })); }}
              onBlur={() => { if (editingStoreId === activeStore.id) { renameStore(activeStore.id, storeNotes['_name'] ?? activeStore.name); setEditingStoreId(null); } }}
              placeholder="🏪 Название магазина" style={{ width:'100%', boxSizing:'border-box', padding:'10px 12px', borderRadius:10, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:13, fontWeight:600, outline:'none' }} />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:10 }}>
              {[
                {k:'Позиций',v:items.length,col:'#00e68a',bg:'rgba(0,230,138,0.08)'},
                {k:'Ккал',v:Math.round(totalKcal),col:'#a78bfa',bg:'rgba(167,139,250,0.08)'},
                {k:'Сумма',v:`${totalPrice.toFixed(0)}₽`,col:'#f59e0b',bg:'rgba(245,158,11,0.08)'},
              ].map(s=>(
                <div key={s.k} style={{ background:s.bg, border:`1px solid ${s.col}18`, borderRadius:12, padding:'10px', textAlign:'center' }}>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', letterSpacing:0.4, textTransform:'uppercase', fontWeight:600 }}>{s.k}</div>
                  <div style={{ fontSize:16, fontWeight:800, color:s.col, marginTop:2 }}>{s.v}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
              <button onClick={clearStore} style={{ padding:'7px 12px', borderRadius:10, border:'1px solid rgba(239,68,68,0.18)', background:'rgba(239,68,68,0.08)', color:'#ef4444', cursor:'pointer', fontSize:10, fontWeight:600 }}>✕ Очистить</button>
              <button onClick={() => duplicateStore(activeStore.id)} style={{ padding:'7px 12px', borderRadius:10, border:'1px solid rgba(139,92,246,0.18)', background:'rgba(139,92,246,0.08)', color:'#a78bfa', cursor:'pointer', fontSize:10, fontWeight:600 }}>⎘ Дублировать</button>
            </div>
            <textarea value={storeNotes[activeStore.id] ?? activeStore.notes ?? ''} onChange={e => { setStoreNotes(p => ({ ...p, [activeStore.id]: e.target.value })); }} onBlur={() => { updateStoreNotes(activeStore.id, storeNotes[activeStore.id] ?? activeStore.notes ?? ''); }} placeholder="📝 Заметки к списку (например: без сахара, только акции)…" style={{ width:'100%', boxSizing:'border-box', marginTop:10, padding:'10px 12px', borderRadius:10, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', outline:'none', fontSize:11, minHeight:48, resize:'vertical' as const }} />
          </div>
          {items.length===0 ? (
            <div style={{ ...modernCardBg, padding:24, textAlign:'center' }}>
              <div style={{ fontSize:26 }}>📭</div>
              <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginTop:6 }}>Список пуст</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginTop:4 }}>Добавляй продукты из каталога или плана кнопкой «🛒»</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {Object.entries(groups).map(([cat, catItems]) => (
                <div key={cat} style={{ ...modernCardBg, padding:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, paddingBottom:8, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#f97316' }}>{CART_CAT_LABELS[cat] || cat}</span>
                    <span style={{ fontSize:9, padding:'2px 6px', borderRadius:999, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.5)' }}>{catItems.length}</span>
                    <span style={{ marginLeft:'auto', fontSize:9, fontWeight:700, color:'#f59e0b' }}>{catItems.reduce((s,i)=>s+(i.price||0),0).toFixed(0)}₽</span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {catItems.map(item => (
                      <div key={item.id} style={{ padding:'10px 12px', borderRadius:12, background:'#202023', border:'1px solid rgba(255,255,255,0.05)', display:'flex', flexDirection:'column', gap:8 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{item.name}</div>
                            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                              <button onClick={() => updateQty(item.id, -10)} style={{ width:26, height:26, borderRadius:8, border:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.04)', color:'#fff', cursor:'pointer', fontWeight:700 }}>-</button>
                              <span style={{ fontSize:11, fontWeight:800, color:'#00e68a', minWidth:40, textAlign:'center' }}>{item.amount}г</span>
                              <button onClick={() => updateQty(item.id, 10)} style={{ width:26, height:26, borderRadius:8, border:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.04)', color:'#fff', cursor:'pointer', fontWeight:700 }}>+</button>
                              <span style={{ marginLeft:8, fontSize:11, fontWeight:800, color:'#00e68a' }}>{Math.round(item.kcal)} ккал</span>
                            </div>
                          </div>
                          <button onClick={() => removeItem(item.id)} style={{ width:30, height:30, borderRadius:10, border:'1px solid rgba(239,68,68,0.15)', background:'rgba(239,68,68,0.08)', color:'#ef4444', cursor:'pointer', fontWeight:700 }}>✕</button>
                        </div>
                        <div style={{ display:'flex', gap:6 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, background:'#18181b', borderRadius:10, padding:'6px 8px', border:'1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>₽</span>
                            <input value={editingPrice[item.id] ?? (item.price ? item.price.toString() : '')} onChange={e => setItemPrice(item.id, e.target.value)} onBlur={() => confirmPrice(item.id)} placeholder="цена" style={{ width:60, background:'transparent', border:'none', color:'#f59e0b', fontSize:11, fontWeight:700, outline:'none', textAlign:'right' }} />
                          </div>
                          <input value={item.note || ''} onChange={e => setItemNote(item.id, e.target.value)} placeholder="📌 Заметка…" style={{ flex:1, padding:'8px 10px', borderRadius:10, background:'#18181b', border:'1px solid rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.75)', outline:'none', fontSize:10 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
const ReferenceTab: React.FC = () => (
  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
    <ModernHero icon="📖" title="Справочник питания" subtitle="Твоя база знаний по нутрициологии — от БЖУ до микронутриентов. Быстрый доступ к проверенной инфо." stats={[
      { k:'Разделов', v: '12+', sub:'тем', col:'#00e68a', bg:'rgba(0,230,138,0.08)' },
      { k:'Проверено', v: '100%', sub:'наука', col:'#60a5fa', bg:'rgba(96,165,250,0.08)' },
      { k:'Обновлено', v: '2026', sub:'год', col:'#a78bfa', bg:'rgba(167,139,250,0.08)' },
    ]} />
    <div style={{ ...modernCardBg, padding:12 }}>
      <NutritionReference />
    </div>
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
    import('../../data/usda-foods').then(m => { if (ok && m.USDA_FOODS) setUsdaFoods(m.USDA_FOODS.slice(0, 2000)); }).catch(() => {});
    return () => { ok = false; };
  }, []);

  const allFoods = React.useMemo(() => [...FOOD_DB as any[], ...usdaFoods.map(f => ({...f, category: f.category || 'other', tier: f.tier || 'standard', fiber: f.fiber || 0, gi: 0, servingSize: '100g', allergens: [], isVegetarian: false, isVegan: false, isGlutenFree: false, isDairyFree: false, dietTags: [] as string[], description: f.description || '', micros: {} }))], [usdaFoods]);

  const categories = React.useMemo(() => [...new Set(allFoods.map(f => f.category).filter(Boolean) as string[])], [allFoods]);
  const addFav = (food: { id: string; name: string; kcal: number; protein: number; fat: number; carbs: number }) => {
    try { const ids: string[] = JSON.parse(localStorage.getItem('he_food_favs') || '[]'); const updated = [food.id, ...ids.filter(f => f !== food.id)].slice(0, 100); localStorage.setItem('he_food_favs', JSON.stringify(updated)); } catch {}
  };
  const filtered = React.useMemo(() => {
    const q = (catSearch || '').toLowerCase().replace(/ё/g,'е').trim();
    let result = allFoods;
    if (catFilter !== 'all') result = result.filter((f: any) => f.category === catFilter);
    if (showExclusive) result = result.filter((f: any) => f.tier === 'max');
    if (q) {
      const norm = (s:string) => (s||'').toLowerCase().replace(/ё/g,'е');
      result = result.filter((f: any) => norm(f.name).includes(q) || norm(f.description).includes(q) || norm(f.category).includes(q));
    }
    return result.slice(0, 120);
  }, [catFilter, catSearch, showExclusive, allFoods]);
  const [catInternet, setCatInternet] = React.useState<any[]>([]);
  const [catSearching, setCatSearching] = React.useState(false);
  const [catRetail, setCatRetail] = React.useState<RetailProduct[]>([]);
  const [catSearchingRetail, setCatSearchingRetail] = React.useState(false);
  React.useEffect(() => {
    const q = catSearch.trim();
    if (!q || q.length < 3) { setCatInternet([]); return; }
    if (filtered.length >= 6) { setCatInternet([]); return; }
    let cancelled = false;
    setCatSearching(true);
    searchOFF(q, 8).then(res => {
      if (cancelled) return;
      const mapped = res.map(productToFoodItem as any).filter((f:any)=> f && f.kcal > 0).slice(0, 6);
      setCatInternet(mapped);
    }).catch(()=>{ if(!cancelled) setCatInternet([]); }).finally(()=>{ if(!cancelled) setCatSearching(false); });
    return () => { cancelled = true; };
  }, [catSearch]);
  React.useEffect(() => {
    const q = catSearch.trim();
    if (!q || q.length < 3 || filtered.length >= 6) { setCatRetail([]); return; }
    let cancelled = false;
    setCatSearchingRetail(true);
    searchRetailProducts(q, 9).then(res => {
      if (!cancelled) setCatRetail(res.available ? res.items.slice(0, 9) : []);
    }).catch(() => { if (!cancelled) setCatRetail([]); }).finally(() => { if (!cancelled) setCatSearchingRetail(false); });
    return () => { cancelled = true; };
  }, [catSearch]);
  const toggleExpanded = (id: string) => setCatExpanded(prev => prev === id ? null : id);
  const exclusiveCount = allFoods.filter((f: any) => f.tier === 'max').length;
  return (<div style={{ display:'flex', flexDirection:'column', gap:10 }}>
    <ModernHero icon="📦" title="Каталог продуктов" subtitle="База FOOD_DB + USDA — с BB-оценкой, фильтрами по категориям и tier. Все для точного плана." count={allFoods.length} stats={[
      { k:'Всего', v: allFoods.length, sub:'позиций', col:'#00e68a', bg:'rgba(0,230,138,0.08)' },
      { k:'Категорий', v: categories.length, sub:'групп', col:'#60a5fa', bg:'rgba(96,165,250,0.08)' },
      { k:'Exclusive', v: exclusiveCount, sub:'max tier', col:'#a78bfa', bg:'rgba(167,139,250,0.08)' },
    ]} />
    <div style={{ ...modernCardBg, padding:12 }}>
      <ModernSearch value={catSearch} onChange={setCatSearch} placeholder="Поиск по названию, описанию, категории…" />
      <div style={{ marginTop:10 }}>
        <div style={{ fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.45)', letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>Категории</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <ModernPill active={catFilter==='all' && !showExclusive} onClick={() => { setShowExclusive(false); setCatFilter('all'); }}>{`Все (${allFoods.length})`}</ModernPill>
          {categories.map(c => {
            const count = allFoods.filter(f => f.category === c).length;
            return <ModernPill key={c} active={catFilter===c && !showExclusive} onClick={() => { setShowExclusive(false); setCatFilter(c); }}>{`${CATEGORY_LABELS[c] || c} (${count})`}</ModernPill>;
          })}
          <ModernPill active={showExclusive} onClick={() => { setShowExclusive(e => !e); setCatFilter('all'); }} accent="#a78bfa">{`⭐ Exclusive (${exclusiveCount})`}</ModernPill>
        </div>
      </div>
      {catFilter !== 'all' && !showExclusive && (
        <div style={{ marginTop:10, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#00e68a', background:'rgba(0,230,138,0.10)', padding:'5px 10px', borderRadius:999, border:'1px solid rgba(0,230,138,0.18)' }}>
            🔍 {CATEGORY_LABELS[catFilter] || catFilter} — {filtered.length} из {allFoods.length}
          </div>
          <span style={{ fontSize:9, color:'rgba(255,255,255,0.4)' }}>{showExclusive ? 'Exclusive' : ''}</span>
        </div>
      )}
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:8 }}>
      {filtered.map(f => {
        const isExpanded = catExpanded === f.id;
        const bbScore = (f as any).bb_quality_score;
        const scoreCol = bbScore ? (bbScore >= 7 ? '#00e68a' : bbScore >= 5 ? '#f59e0b' : '#ef4444') : 'rgba(255,255,255,0.2)';
        return (
          <div key={f.id} style={{ padding:12, borderRadius:16, background:'#202023', border: isExpanded ? '1px solid rgba(0,230,138,0.14)' : '1px solid rgba(255,255,255,0.06)', boxShadow:'0 4px 16px rgba(0,0,0,0.16)', display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:26, height:26, borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10 }}>{f.category==='protein'?'🥩':f.category==='dairy'?'🥛':f.category==='grain'?'🌾':f.category==='carb'?'🥔':f.category==='veg_fruit'?'🥦':f.category==='fat'?'🧈':f.category==='supplement'?'💊':'📦'}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:'#fff', lineHeight:1.2 }}>{f.name}</span>
                  {bbScore !== undefined && <span style={{ fontSize:8, fontWeight:800, padding:'2px 6px', borderRadius:999, background: scoreCol+'14', color: scoreCol, border:`1px solid ${scoreCol}30` }}>{bbScore.toFixed(1)}</span>}
                </div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:3, letterSpacing:0.2, textTransform:'uppercase' }}>{CATEGORY_LABELS[f.category] || f.category} • {f.servingSize || '100г'}</div>
              </div>
              <button onClick={() => toggleExpanded(f.id)} style={{ width:28, height:28, borderRadius:8, border:'1px solid rgba(255,255,255,0.07)', background: isExpanded ? 'rgba(0,230,138,0.10)' : 'rgba(255,255,255,0.04)', color: isExpanded ? '#00e68a' : 'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:10 }}>{isExpanded ? '▲' : '▼'}</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6 }}>
              {[
                {l:'ккал',v:f.kcal,col:'#00e68a',bg:'rgba(0,230,138,0.08)'},
                {l:'Б',v:f.protein,col:'#60a5fa',bg:'rgba(96,165,250,0.08)'},
                {l:'Ж',v:f.fat,col:'#fbbf24',bg:'rgba(251,191,36,0.08)'},
                {l:'У',v:f.carbs,col:'#fb923c',bg:'rgba(251,146,60,0.08)'},
              ].map(b => (
                <div key={b.l} style={{ background:b.bg, border:`1px solid ${b.col}18`, borderRadius:10, padding:'5px 2px', textAlign:'center' }}>
                  <div style={{ fontSize:7, fontWeight:700, color:'rgba(255,255,255,0.45)', letterSpacing:0.3, textTransform:'uppercase' }}>{b.l}</div>
                  <div style={{ fontSize:11, fontWeight:800, color:b.col }}>{b.v}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={e => { e.stopPropagation(); addFav(f); }} style={{ flex:1, padding:'7px 8px', borderRadius:10, border:'1px solid rgba(139,92,246,0.18)', background:'rgba(139,92,246,0.08)', color:'#a78bfa', cursor:'pointer', fontSize:10, fontWeight:600 }}>⭐ В избранное</button>
              <button onClick={e => { e.stopPropagation(); addToCart({ name: f.name, kcal: f.kcal, amount: 100, category: f.category }); }} style={{ flex:1, padding:'7px 8px', borderRadius:10, border:'1px solid rgba(0,230,138,0.18)', background:'rgba(0,230,138,0.08)', color:'#00e68a', cursor:'pointer', fontSize:10, fontWeight:600 }}>🛒 В корзину</button>
            </div>
            {isExpanded && (() => {
              const m = (f as any).macro_100g || {};
              const aa = (f as any).amino_acid_profile_100g || {};
              const el = (f as any).electrolytes_100g || {};
              const vit = (f as any).vitamins_100g || {};
              const tr = (f as any).trace_elements_100g || {};
              const bio = (f as any).bioactive_compounds_100g || {};
              const gt = (f as any).gastro_tags || {};
              const mf = (f as any).metabolic_flags || {};
              const sc = (f as any).specific_compounds_100g || {};
              const row = (items: any[], color='rgba(255,255,255,0.7)') => (
                <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:4, fontSize:8, color }}>{items.filter(Boolean).map((it:any,i:number)=><span key={i}>{typeof it==='string'?it:it}</span>)}</div>
              );
              return (
                <div style={{ padding:10, borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.04)', display:'flex', flexDirection:'column', gap:6 }}>
                  {f.description && <div style={{ fontSize:9, color:'rgba(255,255,255,0.65)', lineHeight:1.4 }}>{f.description}</div>}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:8 }}>
                    <span>⏱ ГИ: {f.gi ?? '—'} | ИИ: {m.insulin_index ?? '—'}</span>
                    <span>⚡ Клетчатка: {f.fiber ?? '—'}г</span>
                    {m.proteins_animal !== undefined && <span>🥩 Жив.белок: {m.proteins_animal}г</span>}
                    {m.proteins_plant !== undefined && <span>🌱 Раст.белок: {m.proteins_plant}г</span>}
                    {m.fats_saturated !== undefined && <span>🧈 Насыщ: {m.fats_saturated}г</span>}
                    {m.omega_3_mg !== undefined && <span>🐟 Омега-3: {m.omega_3_mg}мг</span>}
                    {m.cholesterol_mg !== undefined && <span>🫀 Хол: {m.cholesterol_mg}мг</span>}
                  </div>
                  {aa.leucine_mg !== undefined && row([<span key="a" style={{color:'#a78bfa'}}>🧬 АК:</span>, <span key="b">лей {aa.leucine_mg}мг</span>, aa.isoleucine_mg!==undefined && <span key="c">• илей {aa.isoleucine_mg}мг</span>, aa.valine_mg!==undefined && <span key="d">• вал {aa.valine_mg}мг</span>], '#a78bfa')}
                  {el.sodium_mg !== undefined && row([<span key="a" style={{color:'#60a5fa'}}>⚡ Эл:</span>, <span key="b">Na {el.sodium_mg}мг</span>, el.potassium_mg!==undefined && <span key="c">• K {el.potassium_mg}мг</span>, el.magnesium_mg!==undefined && <span key="d">• Mg {el.magnesium_mg}мг</span>], '#60a5fa')}
                  {vit.vitamin_a_mcg !== undefined && row([<span key="a" style={{color:'#f97316'}}>💊 Вит:</span>, <span key="b">A {vit.vitamin_a_mcg}мкг</span>, vit.vitamin_c_mg!==undefined && <span key="c">• C {vit.vitamin_c_mg}мг</span>, vit.vitamin_d_mcg!==undefined && <span key="d">• D {vit.vitamin_d_mcg}мкг</span>], '#f97316')}
                  {tr.iron_total_mg !== undefined && row([<span key="a" style={{color:'#22c55e'}}>⚙️ Микро:</span>, <span key="b">Fe {tr.iron_total_mg}мг</span>, tr.zinc_mg!==undefined && <span key="c">• Zn {tr.zinc_mg}мг</span>, tr.selenium_mcg!==undefined && <span key="d">• Se {tr.selenium_mcg}мкг</span>], '#22c55e')}
                  {bio.creatine_mg !== undefined && <div style={{ fontSize:7, color:'#a78bfa' }}>🧪 креатин {bio.creatine_mg}мг {bio.beta_alanine_mg!==undefined?`• β-ала {bio.beta_alanine_mg}мг`:''} {bio.taurine_mg!==undefined?`• тау {bio.taurine_mg}мг`:''}</div>}
                  {(gt.fodmap_group || mf.atherogenic_potential) && <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', display:'flex', gap:6, flexWrap:'wrap' }}>{gt.fodmap_group && <span>FODMAP {gt.fodmap_group}</span>}{mf.atherogenic_potential==='HIGH' && <span style={{color:'#ef4444'}}>🚨 Атероген</span>}{mf.anabolic_potential==='HIGH' && <span style={{color:'#00e68a'}}>💪 Анабол</span>}</div>}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
    {catSearching && <div style={{ ...modernCardBg, padding:12, textAlign:'center', fontSize:11, color:'rgba(96,165,250,0.8)', border:'1px solid rgba(59,130,246,0.12)', background:'rgba(59,130,246,0.06)', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><span style={{ width:14, height:14, border:'2px solid rgba(96,165,250,0.3)', borderTop:'2px solid #60a5fa', borderRadius:'50%', display:'inline-block', animation:'spin 0.8s linear infinite' }} /> 🌐 Ищем в базе РФ...</div>}
    {catInternet.length>0 && (
      <div style={{ ...modernCardBg, padding:12 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>🌐 Найдено в интернете (РФ) <span style={{ fontSize:9, padding:'2px 6px', borderRadius:999, background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.18)' }}>{catInternet.length}</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:8 }}>
          {catInternet.map(f => {
            const isExpanded = catExpanded === f.id;
            return (
              <div key={f.id} style={{ padding:12, borderRadius:16, background:'#202023', border: isExpanded ? '1px solid rgba(59,130,246,0.18)' : '1px solid rgba(255,255,255,0.06)', boxShadow:'0 4px 16px rgba(0,0,0,0.16)', display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ width:26, height:26, borderRadius:8, background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10 }}>🌐</span>
                      <span style={{ fontSize:11, fontWeight:700, color:'#fff', lineHeight:1.2 }}>{f.name}</span>
                    </div>
                    <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:3 }}>{f.brand || 'Интернет'} • {f.servingSize || '100г'}</div>
                  </div>
                  <span style={{ fontSize:8, fontWeight:800, padding:'2px 6px', borderRadius:999, background:'rgba(59,130,246,0.12)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.18)' }}>RF</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6 }}>
                  {[
                    {l:'ккал',v:f.kcal,col:'#60a5fa',bg:'rgba(59,130,246,0.08)'},
                    {l:'Б',v:f.protein,col:'#60a5fa',bg:'rgba(96,165,250,0.08)'},
                    {l:'Ж',v:f.fat,col:'#fbbf24',bg:'rgba(251,191,36,0.08)'},
                    {l:'У',v:f.carbs,col:'#fb923c',bg:'rgba(251,146,60,0.08)'},
                  ].map(b => (
                    <div key={b.l} style={{ background:b.bg, border:`1px solid ${b.col}18`, borderRadius:10, padding:'5px 2px', textAlign:'center' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'rgba(255,255,255,0.45)', letterSpacing:0.3, textTransform:'uppercase' }}>{b.l}</div>
                      <div style={{ fontSize:11, fontWeight:800, color:b.col }}>{b.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => addFav(f)} style={{ flex:1, padding:'7px 8px', borderRadius:10, border:'1px solid rgba(59,130,246,0.18)', background:'rgba(59,130,246,0.08)', color:'#60a5fa', cursor:'pointer', fontSize:10, fontWeight:600 }}>⭐ В избранное</button>
                  <button onClick={() => addToCart({ name: f.name, kcal: f.kcal, amount: 100, category: f.category } as any)} style={{ flex:1, padding:'7px 8px', borderRadius:10, border:'1px solid rgba(0,230,138,0.18)', background:'rgba(0,230,138,0.08)', color:'#00e68a', cursor:'pointer', fontSize:10, fontWeight:600 }}>🛒 В корзину</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}
    {(catSearchingRetail || catRetail.length > 0) && (
      <div style={{ ...modernCardBg, padding:12 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#00e68a', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>🏪 Супермаркеты РФ {catRetail.length > 0 && <span style={{ fontSize:9, padding:'2px 6px', borderRadius:999, background:'rgba(0,230,138,0.12)', border:'1px solid rgba(0,230,138,0.18)' }}>{catRetail.length}</span>}</div>
        {catSearchingRetail && catRetail.length === 0 && <div style={{ textAlign:'center', fontSize:11, color:'rgba(0,230,138,0.8)', padding:8 }}>🏪 Ищем в каталогах сетей…</div>}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:8 }}>
          {catRetail.map(p => {
            const meta = RETAIL_CHAINS[p.source];
            return (
              <div key={`${p.source}-${p.id}`} style={{ padding:12, borderRadius:16, background:'#202023', border:'1px solid rgba(0,230,138,0.10)', boxShadow:'0 4px 16px rgba(0,0,0,0.16)', display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:9, fontWeight:700, padding:'3px 7px', borderRadius:999, background:`${meta.color}1c`, color:meta.color, border:`1px solid ${meta.color}35`, whiteSpace:'nowrap' }}>{meta.emoji} {meta.label}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:'#fff', lineHeight:1.2 }}>{p.name}</span>
                    </div>
                    <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:3 }}>{[p.brand, p.weight].filter(Boolean).join(' • ') || meta.label} • на 100 г</div>
                  </div>
                  <span style={{ fontSize:8, fontWeight:800, padding:'2px 6px', borderRadius:999, background:'rgba(0,230,138,0.12)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.18)' }}>🏪</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6 }}>
                  {[
                    {l:'ккал',v:p.kcal,col:'#00e68a',bg:'rgba(0,230,138,0.08)'},
                    {l:'Б',v:p.protein,col:'#60a5fa',bg:'rgba(96,165,250,0.08)'},
                    {l:'Ж',v:p.fat,col:'#fbbf24',bg:'rgba(251,191,36,0.08)'},
                    {l:'У',v:p.carbs,col:'#fb923c',bg:'rgba(251,146,60,0.08)'},
                  ].map(b => (
                    <div key={b.l} style={{ background:b.bg, border:`1px solid ${b.col}18`, borderRadius:10, padding:'5px 2px', textAlign:'center' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'rgba(255,255,255,0.45)', letterSpacing:0.3, textTransform:'uppercase' }}>{b.l}</div>
                      <div style={{ fontSize:11, fontWeight:800, color:b.col }}>{b.v}</div>
                    </div>
                  ))}
                </div>
                <button onClick={() => addFav({ id: `retail:${p.source}:${p.id}`, name: p.name, kcal: p.kcal, protein: p.protein, fat: p.fat, carbs: p.carbs })} style={{ width:'100%', padding:'7px 8px', borderRadius:10, border:'1px solid rgba(0,230,138,0.18)', background:'rgba(0,230,138,0.08)', color:'#00e68a', cursor:'pointer', fontSize:10, fontWeight:600 }}>⭐ В избранное</button>
              </div>
            );
          })}
        </div>
      </div>
    )}
    {filtered.length===0 && catInternet.length===0 && catRetail.length===0 && !catSearching && !catSearchingRetail && <div style={{ ...modernCardBg, padding:24, textAlign:'center' }}><div style={{fontSize:22}}>🔍</div><div style={{fontSize:12,fontWeight:700,color:'#fff',marginTop:6}}>Ничего не нашлось</div><div style={{fontSize:10,color:'rgba(255,255,255,0.5)',marginTop:4}}>Попробуй сбросить фильтр или изменить запрос — или проверь написание «Ратимир»</div></div>}
  </div>);
};
const RecipesTab = RecipesTabModern;
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
  const [rtToast, setRtToast] = React.useState<string | null>(null);
  const showRtToast = (msg: string) => { setRtToast(msg); setTimeout(() => setRtToast(null), 2000); };
  const [g, setG] = React.useState<'all'|'russian'|'asian'|'italian'|'fastfood'>('all');
  const [search, setSearch] = React.useState('');
  const [portions, setPortions] = React.useState<Record<string, number>>({});
  const restaurantDishes = useMemo(() => FOOD_DB.filter(f => f.category === 'fast_food'), []);
  const filtered = useMemo(() => {
    let list = g === 'all' ? restaurantDishes : restaurantDishes.filter(f => detectCuisine(f.name) === g);
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(f => (f.name||'').toLowerCase().includes(q)); }
    return list;
  }, [g, search, restaurantDishes]);
  const selectedIds = useMemo(() => Object.keys(portions), [portions]);
  const totals = useMemo(() => {
    const selected = filtered.filter(f => portions[f.id] !== undefined);
    if (selected.length === 0) return { kcal: 0, p: 0, f: 0, c: 0, count: 0 };
    return {
      kcal: selected.reduce((s,f) => s + f.kcal * (portions[f.id] || 1), 0),
      p: selected.reduce((s,f) => s + f.protein * (portions[f.id] || 1), 0),
      f: selected.reduce((s,f) => s + f.fat * (portions[f.id] || 1), 0),
      c: selected.reduce((s,f) => s + f.carbs * (portions[f.id] || 1), 0),
      count: selected.length,
    };
  }, [filtered, portions]);
  const clearSelection = () => setPortions({});
  return (<div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {rtToast && <div style={{ position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)', zIndex:999, padding:'10px 24px', borderRadius:14, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', boxShadow:'0 4px 20px rgba(0,0,0,0.3)', color:'#fff', fontSize:11, fontWeight:600 }}>{rtToast}</div>}
      <ModernHero icon="🍽" title="Рестораны" subtitle="Фастфуд с точным КБЖУ — выбирай кухню, порцию и сразу в корзину или план. Порции не суммируются в фоне — считается только выбранное." count={restaurantDishes.length} stats={[
        { k:'Позиций', v: restaurantDishes.length, sub:'блюд', col:'#f59e0b', bg:'rgba(245,158,11,0.08)' },
        { k:'Выбрано', v: totals.count, sub:'блюд', col: totals.count>0?'#00e68a':'rgba(255,255,255,0.3)', bg: totals.count>0?'rgba(0,230,138,0.08)':'rgba(255,255,255,0.03)' },
        { k:'Ккал', v: totals.count>0 ? Math.round(totals.kcal) : '—', sub: totals.count>0?'выбрано':'—', col:'#00e68a', bg:'rgba(0,230,138,0.08)' },
      ]} action={totals.count>0 ? <button onClick={clearSelection} style={{ padding:'7px 12px', borderRadius:10, border:'1px solid rgba(239,68,68,0.18)', background:'rgba(239,68,68,0.08)', color:'#ef4444', cursor:'pointer', fontSize:10, fontWeight:600 }}>✕ Сбросить выбор</button> : undefined} />
      {totals.count > 0 ? (
        <div style={{ ...modernCardBg, padding:12, border:'1px solid rgba(0,230,138,0.14)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#00e68a' }}>📊 КБЖУ выбранных блюд</div>
            <span style={{ fontSize:8, padding:'3px 7px', borderRadius:999, background:'rgba(0,230,138,0.10)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.18)', fontWeight:600 }}>{totals.count} блюд</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6 }}>
            {[{l:'Калории',v:Math.round(totals.kcal),c:'#00e68a',u:'ккал'},{l:'Белки',v:Math.round(totals.p),c:'#60a5fa',u:'г'},{l:'Жиры',v:Math.round(totals.f),c:'#fbbf24',u:'г'},{l:'Углеводы',v:Math.round(totals.c),c:'#fb923c',u:'г'}].map((s,i) => (
              <div key={i} style={{ background:'#202023', borderRadius:12, padding:'8px', textAlign:'center', border:`1px solid ${s.c}14` }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', letterSpacing:0.4, textTransform:'uppercase', fontWeight:600 }}>{s.l}</div>
                <div style={{ fontSize:16, fontWeight:800, color:s.c }}>{s.v}<span style={{ fontSize:9, fontWeight:400, color:'rgba(255,255,255,0.5)' }}> {s.u}</span></div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', marginTop:6, textAlign:'center' }}>Считается только то, где ты нажал порцию (0.5/1/1.5/2) — не все отфильтрованные</div>
        </div>
      ) : (
        <div style={{ ...modernCardBg, padding:12, textAlign:'center', border:'1px dashed rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)' }}>Выбери порцию у блюда — и здесь появится сводка КБЖУ выбранных</div>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', marginTop:4 }}>Нажми 0.5 / 1 / 1.5 / 2 на карточке блюда</div>
        </div>
      )}
      <div style={{ ...modernCardBg, padding:12 }}>
        <div style={{ fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.45)', letterSpacing:0.6, textTransform:'uppercase', marginBottom:8 }}>Кухня</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
          <ModernPill active={g==='all'} onClick={() => setG('all')}>Все</ModernPill>
          <ModernPill active={g==='russian'} onClick={() => setG('russian')}>🇷🇺 Русская</ModernPill>
          <ModernPill active={g==='asian'} onClick={() => setG('asian')}>🥟 Азиатская</ModernPill>
          <ModernPill active={g==='italian'} onClick={() => setG('italian')}>🍝 Итальянская</ModernPill>
          <ModernPill active={g==='fastfood'} onClick={() => setG('fastfood')}>🍔 Фаст-фуд</ModernPill>
        </div>
        <ModernSearch value={search} onChange={setSearch} placeholder="Поиск блюд, например: шаурма, бургер, плов…" />
      </div>
      <div style={{ ...modernCardBg, padding:12 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>🍽 Блюда ресторанов</div>
          <span style={{ fontSize:9, padding:'3px 7px', borderRadius:999, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.5)', border:'1px solid rgba(255,255,255,0.06)' }}>{filtered.length} блюд</span>
        </div>
        {filtered.length === 0 ? (
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', textAlign:'center', padding:24 }}>Нет блюд по выбранному фильтру.</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:8, maxHeight:520, overflowY:'auto' }}>
            {filtered.map(food => {
              const portion = portions[food.id] || 0;
              const isSelected = portion !== 0 && portions[food.id] !== undefined;
              return (<div key={food.id} style={{ padding:12, borderRadius:14, background: isSelected ? 'rgba(0,230,138,0.06)' : '#202023', border: isSelected ? '1px solid rgba(0,230,138,0.14)' : '1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                  <span style={{ width:28, height:28, borderRadius:8, background: isSelected ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>{food.category==='fast_food'?'🍔':'🍽'}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#fff', lineHeight:1.2 }}>{food.name}</div>
                    <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', marginTop:2 }}>{food.servingSize || '100г'} • {detectCuisine(food.name)} {isSelected && <span style={{ color:'#00e68a', fontWeight:600 }}>• выбрано ×{portion}</span>}</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                  <span style={{ fontSize:8, color:'rgba(255,255,255,0.4)', fontWeight:600 }}>Порция:</span>
                  <div style={{ display:'flex', gap:4 }}>
                    {[0.5, 1, 1.5, 2].map(p => <button key={p} onClick={() => setPortions(pp => ({...pp, [food.id]: p}))} style={{ minWidth:32, padding:'5px 6px', borderRadius:8, border: (portions[food.id]||0) === p ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.07)', background: (portions[food.id]||0) === p ? 'rgba(0,230,138,0.14)' : '#18181b', color: (portions[food.id]||0) === p ? '#00e68a' : 'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:10, fontWeight:700 }}>{p}</button>)}
                  </div>
                  {isSelected && <button onClick={() => setPortions(pp => { const n={...pp}; delete n[food.id]; return n; })} style={{ marginLeft:'auto', padding:'4px 8px', borderRadius:8, border:'1px solid rgba(239,68,68,0.14)', background:'rgba(239,68,68,0.06)', color:'#ef4444', cursor:'pointer', fontSize:9 }}>✕</button>}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4 }}>
                  <div style={{ background:isSelected?'rgba(0,230,138,0.08)':'#18181b', borderRadius:8, padding:'6px 2px', textAlign:'center', border:'1px solid rgba(255,255,255,0.04)' }}><div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', letterSpacing:0.3 }}>ККАЛ</div><div style={{ fontSize:11, fontWeight:800, color: isSelected?'#00e68a':'rgba(255,255,255,0.7)' }}>{Math.round(food.kcal * (portion||1))}</div></div>
                  <div style={{ background:'rgba(96,165,250,0.06)', borderRadius:8, padding:'6px 2px', textAlign:'center', border:'1px solid rgba(96,165,250,0.08)' }}><div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>Б</div><div style={{ fontSize:11, fontWeight:700, color:'#60a5fa' }}>{Math.round(food.protein * (portion||1))}</div></div>
                  <div style={{ background:'rgba(251,191,36,0.06)', borderRadius:8, padding:'6px 2px', textAlign:'center', border:'1px solid rgba(251,191,36,0.08)' }}><div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>Ж</div><div style={{ fontSize:11, fontWeight:700, color:'#fbbf24' }}>{Math.round(food.fat * (portion||1))}</div></div>
                  <div style={{ background:'rgba(251,146,60,0.06)', borderRadius:8, padding:'6px 2px', textAlign:'center', border:'1px solid rgba(251,146,60,0.08)' }}><div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>У</div><div style={{ fontSize:11, fontWeight:700, color:'#fb923c' }}>{Math.round(food.carbs * (portion||1))}</div></div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  <button onClick={() => addToCart({ name: food.name, amount: Math.round((portion||1) * (parseInt(food.servingSize) || 100)), kcal: Math.round(food.kcal * (portion||1)), category: 'fast_food' })} style={{ padding:'8px', borderRadius:10, border:'1px solid rgba(0,230,138,0.18)', background:'rgba(0,230,138,0.08)', color:'#00e68a', cursor:'pointer', fontSize:10, fontWeight:700 }}>🛒 В корзину</button>
                  <button onClick={() => { try { const planItems = JSON.parse(localStorage.getItem('he_quick_plan_items') || '[]'); planItems.push({ name: food.name, id: food.id, amount: Math.round((portion||1) * 100), kcal: Math.round(food.kcal * (portion||1)), p: Math.round(food.protein * (portion||1)), f: Math.round(food.fat * (portion||1)), c: Math.round(food.carbs * (portion||1)) }); localStorage.setItem('he_quick_plan_items', JSON.stringify(planItems)); showRtToast('✅ В план'); } catch {} }} style={{ padding:'8px', borderRadius:10, border:'1px solid rgba(139,92,246,0.18)', background:'rgba(139,92,246,0.08)', color:'#a78bfa', cursor:'pointer', fontSize:10, fontWeight:700 }}>📋 В план</button>
                </div>
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
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('he_nutrition_report_current');
      if (saved) { const p = JSON.parse(saved); if (p.overallGrade && p.overallGrade !== '—') { setFullReport(p); setReportEditText(JSON.stringify(p, null, 2)); setReportSubTab('full'); } }
    } catch {}
  }, []);
  const raw = React.useMemo(() => readDiaryV2(), [foodEntries]);
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
    try {
      const currentArchive = JSON.parse(localStorage.getItem('he_nutrition_report_archive') || '[]');
      const updated = [report, ...currentArchive].slice(0, 50);
      setArchiveReports(updated);
      localStorage.setItem('he_nutrition_report_archive', JSON.stringify(updated));
    } catch {}
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
      <ModernHero icon="📊" title="Отчёты" subtitle="Аналитика питания — от дня до месяца, с оценкой, КБЖУ, микронутриентами и архивом." stats={[{k:'Периодов',v:3,sub:'день/нед/мес',col:'#00e68a',bg:'rgba(0,230,138,0.08)'},{k:'Метрик',v:12,sub:'показателей',col:'#60a5fa',bg:'rgba(96,165,250,0.08)'},{k:'Архив',v: archiveReports.length,sub:'отчётов',col:'#a78bfa',bg:'rgba(167,139,250,0.08)'}]} />
    {reportSubTab === 'full' && (<div style={{ padding:14, ...modernCardBg }}>
      {tabButtons}
      <div style={labelSec}>📋 Полный отчёт о питании</div>
      {data.length === 0 ? (
        <div style={{ textAlign:'center', padding:20, color:'rgba(255,255,255,0.7)', fontSize:10 }}>
          Нет данных за выбранный период. Вносите приёмы пищи в дневник.
        </div>
      ) : !fullReport ? (
        <div style={{ textAlign:'center', padding:20 }}>
          <button onClick={() => {
            try {
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
            } catch {}
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
                  <div style={{ fontSize:11, fontWeight:700, color: (fullReport.fatQuality.omega6to3ratio ?? 0) > 6 ? '#ef4444' : '#00e68a' }}>{fullReport.fatQuality.omega6to3ratio ?? '-'}:1</div>
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

    {reportSubTab === 'archive' && (<div style={{ padding:14, ...modernCardBg }}>
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

    {reportSubTab === 'overview' && (<div style={{ padding:14, ...modernCardBg }}>
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
          const meals = [{ label: reportMode === 'day' ? 'День' : reportMode === 'week' ? 'Неделя' : 'Месяц', items: data.map((i:any) => ({ name: i.name, id: i.id || '', amount: i.amount || 100, kcal: i.kcal||0, p: i.p||0, f: i.f||0, c: i.c||0 })), totals }];
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
      <NutritionWeeklyComparison diaryData={raw} selectedDate={reportDate} targets={targets} />
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
  return (<div style={{ display:'flex', flexDirection:'column', gap:10 }}><ModernHero icon="ℹ️" title="Инфо" subtitle="Полезная информация о питании, гиде и советах." /><div style={{ display:'flex', flexDirection:'column', gap:8 }}>
    <div style={{ padding:14, ...modernCardBg }}>
      <div style={labelSec}>ℹ️ Как работает приложение</div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {sections.map((s, i) => {
          const icon = s.title.split(' ')[0];
          const titleText = s.title.slice(icon.length+1);
          const colors = ['#22c55e','#3b82f6','#f59e0b','#a78bfa','#f97316','#06b6d4','#ef4444','#8b5cf6'];
          const col = colors[i % colors.length];
          return (
            <div key={i} style={{ padding:12, borderRadius:14, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:10, alignItems:'flex-start' }}>
              <span style={{ width:32, height:32, borderRadius:10, background: col+'18', border:`1px solid ${col}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>{icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff', marginBottom:4 }}>{titleText}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.75)', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{s.body}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div></div>);
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
    <button onClick={() => setFavTab(t as any)} style={{ padding:'6px 12px', borderRadius:999, fontSize:10, fontWeight: favTab === t ? 700 : 500, cursor:'pointer', border: favTab === t ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.07)', background: favTab === t ? 'linear-gradient(135deg,rgba(0,230,138,0.18),rgba(0,200,160,0.12))' : '#202023', color: favTab === t ? '#00e68a' : 'rgba(255,255,255,0.7)', boxShadow: favTab === t ? '0 2px 8px rgba(0,230,138,0.2)' : 'none' }}>{icon} {label}</button>
  );
  return (<div style={{ display:'flex', flexDirection:'column', gap:10 }}><ModernHero icon="⭐" title="Избранное" subtitle="Твои сохранённые продукты и блюда — быстрый доступ к любимому." /><div style={{ display:'flex', flexDirection:'column', gap:8, paddingBottom:80 }}>
    <div style={{ display:'flex', gap:3, flexWrap:'wrap', padding:'4px 0' }}>
      {pill('products','⭐','Продукты')}{pill('recipes','🍳','Рецепты')}{pill('plans','📋','Планы')}{pill('stacks','🧩','Стеки')}
    </div>
    {favTab === 'products' && <div style={{ padding:14, ...modernCardBg }}>
      <div style={labelSec}>⭐ Избранные продукты ({favs.length}/100)</div>
      {favs.length === 0 ? <div style={{ textAlign:'center', padding:16, color:'rgba(255,255,255,0.8)', fontSize:10 }}>Нет избранных. Добавляйте из каталога ⭐.</div> : <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {Object.entries(groups).map(([cat, items]) => (
          <div key={cat}>
            <div style={{ fontSize:9, fontWeight:700, color:'#f97316', marginBottom:2, padding:'2px 0', borderBottom:'1px solid rgba(249,115,22,0.08)', display:'flex', alignItems:'center', gap:4 }}>
              {cat} <span style={{ fontSize:7, color:'rgba(255,255,255,0.85)', fontWeight:400 }}>({items.length})</span>
            </div>
            {items.map(f => (
              <div key={f.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', borderRadius:12, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', marginBottom:4, boxShadow:'0 2px 8px rgba(0,0,0,0.08)' }}>
                <div><div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{f.name}</div><div style={{ fontSize:8, color:'rgba(255,255,255,0.6)', marginTop:2 }}>{f.kcal}ккал • Б{f.protein} Ж{f.fat} У{f.carbs}</div></div>
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
    {favTab === 'recipes' && <div style={{ padding:14, ...modernCardBg }}>
      <div style={labelSec}>🍳 Сохранённые рецепты ({myRecipes.length})</div>
      {myRecipes.length === 0 ? <div style={{ textAlign:'center', padding:16, color:'rgba(255,255,255,0.8)', fontSize:10 }}>Нет рецептов. Создайте в 🍳 Рецепты.</div> : myRecipes.slice(0,50).map((r,i) => (
        <div key={i} style={{ padding:'6px 8px', borderRadius:8, background:'#202023', border:'1px solid rgba(255,255,255,0.04)', marginBottom:3 }}>
          <div style={{ fontSize:10, fontWeight:600, color:'#fff' }}>{r.name || 'Рецепт'}</div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.8)' }}>Ккал: {r.kcal || '—'} • Б{r.protein||0} Ж{r.fat||0} У{r.carbs||0}</div>
        </div>
      ))}
    </div>}
    {favTab === 'plans' && <div style={{ padding:14, ...modernCardBg }}>
      <div style={labelSec}>📋 Сохранённые планы ({savedPlans.length})</div>
      {savedPlans.length === 0 ? <div style={{ textAlign:'center', padding:16, color:'rgba(255,255,255,0.8)', fontSize:10 }}>Нет планов. Сохраните в 🥗 План.</div> : savedPlans.slice(0,30).map((p,i) => (
        <div key={i} style={{ padding:'6px 8px', borderRadius:8, background:'#202023', border:'1px solid rgba(255,255,255,0.04)', marginBottom:3 }}>
          <div style={{ fontSize:10, fontWeight:600, color:'#fff' }}>{p.name || `План ${i+1}`}</div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.8)' }}>{p.kcal ? `${Math.round(p.kcal)} ккал` : ''}</div>
        </div>
      ))}
    </div>}
    {favTab === 'stacks' && <div style={{ padding:14, ...modernCardBg }}>
      <div style={labelSec}>🧩 Сохранённые стеки ({savedStacks.length})</div>
      {savedStacks.length === 0 ? <div style={{ textAlign:'center', padding:16, color:'rgba(255,255,255,0.8)', fontSize:10 }}>Нет стеков. Сохраните в Бады → Готовые стеки.</div> : savedStacks.map((ids, i) => (
        <div key={i} style={{ padding:'6px 8px', borderRadius:8, background:'#202023', border:'1px solid rgba(255,255,255,0.04)', marginBottom:3 }}>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)' }}>{Array.isArray(ids) ? ids.join(', ') : JSON.stringify(ids)}</div>
        </div>
      ))}
    </div>}
  </div></div>);
};

/** NutritionHeroStats — «съедено сегодня» в hero, ТОЛЬКО APK (isNativeApp гейт).
 *  Telegram его не рендерит вообще. */
const NutritionHeroStats: React.FC<{
  kcal: number;
  protein: number;
  targetKcal: number;
  targetProtein: number;
  dishes: number;
}> = ({ kcal, protein, targetKcal, targetProtein, dishes }) => {
  const kcalPct = targetKcal > 0 ? Math.min(100, Math.round((kcal / targetKcal) * 100)) : 0;
  const pPct = targetProtein > 0 ? Math.min(100, Math.round((protein / targetProtein) * 100)) : 0;
  const bar = (pct: number) => (
    <span className="nutrition-hero-bar">
      <span className="nutrition-hero-bar-fill" style={{ width: `${pct}%` }} />
    </span>
  );
  return (
    <div className="nutrition-hero-stats" aria-label="Съедено сегодня">
      <div className="nutrition-hero-stat">
        <span className="nutrition-hero-stat-v">{Math.round(kcal)} / {targetKcal}</span>
        <span className="nutrition-hero-stat-l">ккал · {kcalPct}%</span>
        {bar(kcalPct)}
      </div>
      <div className="nutrition-hero-stat">
        <span className="nutrition-hero-stat-v">{Math.round(protein)} / {targetProtein} г</span>
        <span className="nutrition-hero-stat-l">белок · {pPct}%</span>
        {bar(pPct)}
      </div>
      <div className="nutrition-hero-stat">
        <span className="nutrition-hero-stat-v">{dishes}</span>
        <span className="nutrition-hero-stat-l">блюд сегодня</span>
      </div>
    </div>
  );
};

export const NutritionScreen: React.FC<{ initialSubTab?: string }> = ({ initialSubTab }) => {
  const linked = useDataLink();
  const [tab, setTab] = useState<ActiveTab>('mealplan');
  const [page, setPage] = useState<NutritionPage>('hero');
  const [scanOpen, setScanOpen] = useState(false);

  const onScanProduct = (p: { name?: string; kcal?: number; protein?: number; fat?: number; carbs?: number }) => {
    try {
      const item = productToFoodItem(p as any);
      const today = new Date().toISOString().split('T')[0];
      addMealEntryV2(today, 'snack', {
        name: String(item.name || 'Сканированный продукт').slice(0, 120),
        kcal: Math.max(0, Math.round(item.kcal || 0)),
        p: Math.max(0, Math.round(item.protein || 0)),
        f: Math.max(0, Math.round(item.fat || 0)),
        c: Math.max(0, Math.round(item.carbs || 0)),
        qty: 100,
      });
      setScanOpen(false);
      setTab('diary');
      setPage('tabs');
      setNutritionSection('diary');
    } catch {
      setScanOpen(false);
    }
  };
  const [nutritionSection, setNutritionSection] = useState<NutritionSection>('all');
  const [foodEntries, setFoodEntries] = useState<DiaryEntry[]>([]);
  const [dailyLogs, setDailyLogs] = useState<Record<string, DiaryEntry[]>>({});

  useEffect(() => {
    try {
      const diary = readDiaryV2();
      if (Object.keys(diary).length > 0) {
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

  useEffect(() => {
    if (initialSubTab === 'diary') {
      setTab('diary'); setPage('tabs'); setNutritionSection('diary');
    } else if (initialSubTab === 'reports') {
      setTab('reports'); setPage('tabs'); setNutritionSection('analytics');
    }
  }, [initialSubTab]);

  // B3: Reload diary data from localStorage when NutritionDiary reports changes
  const reloadDiary = () => {
    try {
      const diary = readDiaryV2();
      if (Object.keys(diary).length > 0) {
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
      } else {
        setFoodEntries([]);
        setDailyLogs({});
      }
    } catch {}
  };

  useEffect(() => onDiaryChangeV2(() => reloadDiary()), []);

  // Open diary tab directly when navigated from Profile → diaries → Питание
  useEffect(() => {
    try {
      if (localStorage.getItem('he_nav_nutrition_diary') === '1') {
        localStorage.removeItem('he_nav_nutrition_diary');
        setTab('diary');
        setPage('tabs');
        setNutritionSection('diary');
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

  const avgDailyKcal = useMemo(() => {
    if (dailyAggregates.length === 0) return 0;
    return dailyAggregates.reduce((s, d) => s + d.kcal, 0) / dailyAggregates.length;
  }, [dailyAggregates]);
  const avgDailyProtein = useMemo(() => {
    if (dailyAggregates.length === 0) return 0;
    return dailyAggregates.reduce((s, d) => s + d.protein, 0) / dailyAggregates.length;
  }, [dailyAggregates]);
  const avgDailyFat = useMemo(() => {
    if (dailyAggregates.length === 0) return 0;
    return dailyAggregates.reduce((s, d) => s + d.fat, 0) / dailyAggregates.length;
  }, [dailyAggregates]);
  const avgDailyCarbs = useMemo(() => {
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
    const s: any = linked.profile?.settings;
    const p = s?.personal;
    const tr = s?.training;
    if (!p?.weight) return { kcal: 2500, protein: 160, fats: 70, carbs: 300 };
    const pal = derivePAL(tr?.daysPerWeek, tr?.minutesPerSession);
    const goal = tr?.primaryGoal || 'maintenance';
    try {
      const t = calcNutrition({ weightKg: p.weight, heightCm: p.height || 175, age: p.age || 30, sex: p.sex || 'male', pal, goal });
      return { kcal: t.kcal, protein: t.protein, fats: t.fats, carbs: t.carbs };
    } catch { return { kcal: 2500, protein: 160, fats: 70, carbs: 300 }; }
  }, [linked.profile]);

  // B2: Build meal visualizer items from saved day plan or today's diary
  const visualizerItems = useMemo(() => {
    try {
      // Try day plan first
      const planRaw = localStorage.getItem('he_plan_day');
      if (planRaw) {
        const plan = JSON.parse(planRaw);
        if (plan?.meals) {
          const items = plan.meals.flatMap((m: any) => (m.items || []).map((it: any) => ({
            id: it.id || it.name, name: it.name, weightG: it.amount || 100,
          }))).filter((it: any) => it.weightG > 0);
          if (items.length > 0) return items;
        }
      }
    } catch {}
    // Fallback: today's diary entries (estimate weight from kcal using ~2 kcal/g average)
    try {
      const today = new Date().toISOString().split('T')[0];
      const diary = readDiaryV2();
      const todayData = diary[today];
      if (todayData?.meals) {
        const items = Object.values(todayData.meals).flat().map((it: any, i: number) => ({
          id: it.name + '_' + i, name: it.name, weightG: Math.max(50, Math.round((it.kcal || 0) / 2)),
        })).filter((it: any) => it.weightG > 0);
        if (items.length > 0) return items;
      }
    } catch {}
    return [];
  }, [tab, foodEntries]);

  const renderContent = () => {
    switch (tab) {
      case 'diary': return <InfoErrorBoundary label="Дневник питания"><NutritionDiary foodEntries={foodEntries} targets={macroTargets} weight={(linked.profile?.settings as any)?.personal?.weight} age={(linked.profile?.settings as any)?.personal?.age} sex={(linked.profile?.settings as any)?.personal?.sex} onDiaryChange={reloadDiary} /></InfoErrorBoundary>;
      case 'charts': return <InfoErrorBoundary label="Графики"><Suspense fallback={<div className="native-skeleton-row" style={{padding:20}} aria-label="Загрузка графиков"><div className="native-skeleton" /><div className="native-skeleton" /><div className="native-skeleton" /></div>}><NutritionCharts kcalData={chartKcalData} proteinData={chartProteinData} labels={chartLabels} dailyLogs={dailyLogs} targets={macroTargets} /></Suspense></InfoErrorBoundary>;
      case 'mealplan': return <InfoErrorBoundary label="План питания"><IndividualPlan profile={linked.profile} course={linked.course} labs={linked.labs} labAnalysis={linked.labAnalysis} /></InfoErrorBoundary>;
      case 'cart': return <InfoErrorBoundary label="Корзина"><CartTab /></InfoErrorBoundary>;
      case 'restaurant': return <InfoErrorBoundary label="Ресторан"><RestaurantTab /></InfoErrorBoundary>;
      case 'favorites': return <InfoErrorBoundary label="Избранное"><FavoritesTab /></InfoErrorBoundary>;
      case 'catalog': return <InfoErrorBoundary label="Каталог"><CatalogTab /></InfoErrorBoundary>;
      case 'reference': return <InfoErrorBoundary label="Справочник"><ReferenceTab /></InfoErrorBoundary>;
      case 'recipes': return <InfoErrorBoundary label="Рецепты"><RecipesTab /></InfoErrorBoundary>;
      case 'reports': return <InfoErrorBoundary label="Отчёты"><ReportsTab foodEntries={foodEntries} profile={linked.profile} targets={macroTargets} /></InfoErrorBoundary>;
      case 'customfood': return <InfoErrorBoundary label="Свои продукты"><NutritionCustomFood /></InfoErrorBoundary>;
      case 'overview': return <InfoErrorBoundary label="Обзор"><NutritionOverview
        profile={linked.profile}
        avgDailyKcal={avgDailyKcal}
        avgDailyProtein={avgDailyProtein}
        avgDailyFat={avgDailyFat}
        avgDailyCarbs={avgDailyCarbs}
      /></InfoErrorBoundary>;
      case 'info': return <InfoErrorBoundary label="Инфо"><InfoTab /></InfoErrorBoundary>;
      case 'progress': return <InfoErrorBoundary label="Прогресс"><ProgressTracker /></InfoErrorBoundary>;
      case 'nutria': return <InfoErrorBoundary label="Нутрициолог"><NutriAdvisor /></InfoErrorBoundary>;
      case 'visualize': return <InfoErrorBoundary label="Блюдо"><MealVisualizer items={visualizerItems} /></InfoErrorBoundary>;
      case 'achievements': return <InfoErrorBoundary label="Достижения"><Achievements /></InfoErrorBoundary>;
      case 'quests': return <InfoErrorBoundary label="Квесты"><DailyQuests /></InfoErrorBoundary>;
      case 'peri': return <InfoErrorBoundary label="Пери-воркаут"><PeriWorkoutCard /></InfoErrorBoundary>;
      case 'usefulness': return <InfoErrorBoundary label="Полезность"><ProductUsefulnessPlanner /></InfoErrorBoundary>;
      case 'metabolic': return <InfoErrorBoundary label="Метаболика"><MetabolicHub /></InfoErrorBoundary>;
      default: return null;
    }
  };

  if (page === 'hero') {
    const todayISO = (() => { try { return new Date().toISOString().split('T')[0]; } catch { return ''; } })();
    const todayEntries = todayISO ? (dailyLogs[todayISO] || []) : [];
    const todayKcal = todayEntries.reduce((s, e) => s + (e.kcal || 0), 0);
    const todayProtein = todayEntries.reduce((s, e) => s + (e.p || 0), 0);
    return (
      <div className="nutrition-hero" style={{ position:'fixed', inset:0, display:'flex', flexDirection:'column' }}>
        <HeroImg webp="/nutrition-hero.webp" src="/nutrition-hero.jpg" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 45%, rgba(0,0,0,0.85))' }} />
        <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
          <h1 className="nutrition-hero-title" style={{ fontSize:22, fontWeight:800, color:'#fff', margin:'0 0 2px', textShadow:'0 2px 14px rgba(0,0,0,0.9)' }}>Питание</h1>
          <p className="nutrition-hero-sub" style={{ fontSize:11, color:'rgba(255,255,255,0.9)', margin:'0 0 14px', textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>Рекомендации и составление рациона под указанные параметры</p>
          {isNativeApp() && (
            <NutritionHeroStats
              kcal={todayKcal}
              protein={todayProtein}
              targetKcal={macroTargets.kcal}
              targetProtein={macroTargets.protein}
              dishes={todayEntries.length}
            />
          )}
          <div className="nutrition-hero-cards" style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { section: 'diary' as NutritionSection, tab: 'diary' as ActiveTab, icon: 'notebook' as const, title: 'Дневник и аналитика', desc: 'Дневник, графики, отчёты', color: '#22c55e' },
              { section: 'planning' as NutritionSection, tab: 'mealplan' as ActiveTab, icon: 'bowl' as const, title: 'Планирование питания', desc: 'План, каталог, рецепты, рестораны, справочник', color: '#f97316' },
            ].map(card => (
              <button key={card.tab} onClick={() => { setPage('tabs'); setNutritionSection(card.section); setTab(card.tab); }} className="nutrition-hero-card" data-section={card.section} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%',
                background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)', color:'var(--text)',
              }}>
                <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background: card.color + '20', color: card.color }}><NativeIcon name={card.icon} size={20} /></div>
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
    <div className="screen nutrition nutrition-screen nutrition-tabs" style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'auto', padding:0 }}>
      <div className="nutrition-tabs-head" style={{
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
        {isNativeApp() && (
          <button
            onClick={() => setScanOpen(true)}
            aria-label="Сканировать штрихкод"
            title="Сканировать штрихкод"
            className="nutrition-scan-btn"
            style={{
              width:36, height:36, borderRadius:12, cursor:'pointer', flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center',
              background:'rgba(var(--nut-accent-rgb, 0,230,138),0.12)',
              border:'1px solid rgba(var(--nut-accent-rgb, 0,230,138),0.25)',
              color:'var(--nut-accent, #00e68a)',
            }}
          >
            <NativeIcon name="scan" size={17} />
          </button>
        )}
        <span style={{ fontSize:9, color:'#fff' }}>
          {nutritionSection === 'diary' ? 'Дневник' : 'Всё'}
        </span>
      </div>
      {isNativeApp() && scanOpen && (
        <BarcodeScanner onProductFound={(p) => onScanProduct(p)} onClose={() => setScanOpen(false)} />
      )}

      {/* V2 adjustments bar — shows on mealplan tab */}
      {tab === 'mealplan' && (function() {
        const nv2 = getNutritionV2Data();
        const s: any = linked.profile?.settings;
        const v2Result = (() => {
          if (!s) return null;
          const p = s.personal || {};
          const tr = s.training || {};
          try {
            const engineGoal = ({ mass:'bulk', strength:'strength', fat_loss:'cut', cutting:'cut', maintenance:'maintenance', recomposition:'recomp' } as any)[tr.primaryGoal || 'maintenance'] || 'maintenance';
            return calcNutritionV2({ weightKg: p.weight || 80, heightCm: p.height || 175, age: p.age || 30, sex: p.sex || 'male', pal: 1.55, goal: engineGoal, bodyFatPercent: p.bodyFat });
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

        if (active.length === 0) return null;
        return (
          <div style={{ display:'flex', gap:3, padding:'4px 8px', overflowX:'auto', scrollbarWidth:'none', flexShrink:0 }}>
            {active.map((a,i) => (
              <span key={i} style={{ padding:'3px 8px', borderRadius:6, fontSize:8, background:'rgba(var(--nut-accent-rgb, 0,230,138),0.1)', color:'var(--nut-accent, #00e68a)', border:'1px solid rgba(var(--nut-accent-rgb, 0,230,138),0.2)', whiteSpace:'nowrap' }}>{a}</span>
            ))}
          </div>
        );
      })()}

      <div className="nutrition-tabs-body" style={{ flex:1, minHeight:0, overflowY:'auto', padding:'0 8px 80px' }}>
        <div className="nutrition-chips" style={{
          display:'flex', gap:6, flexWrap:'nowrap', overflowX:'auto', overflowY:'hidden',
          padding:'10px 4px 12px',
          scrollbarWidth:'none', msOverflowStyle:'none',
          WebkitOverflowScrolling:'touch', whiteSpace:'nowrap',
        }}>
          {(SECTION_TABS[nutritionSection] || SECTION_TABS.all).map(t => {
            const isActive = tab === t;
            return (
              <button key={t} onClick={() => setTab(t as ActiveTab)} className="nutrition-chip" data-active={isActive} style={{
                flexShrink:0, padding:'10px 16px', borderRadius:14, cursor:'pointer',
                fontSize:13, fontWeight: isActive ? 800 : 600, letterSpacing:-0.2,
                border: isActive ? '1.5px solid #00e68a' : '1px solid rgba(255,255,255,0.07)',
                background: isActive ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : '#202023',
                color: isActive ? '#000' : 'rgba(255,255,255,0.85)',
                transition:'all 0.2s cubic-bezier(0.22,1,0.36,1)',
                boxShadow: isActive ? '0 4px 16px rgba(0,230,138,0.25), 0 1px 0 rgba(255,255,255,0.1) inset' : '0 2px 8px rgba(0,0,0,0.12)',
                minHeight:40, display:'inline-flex', alignItems:'center', gap:6,
                transform: isActive ? 'translateY(-1px)' : 'none',
              }}>
                {TAB_LABELS[t] || t}
                {t === 'cart' && cartCount > 0 && (
                  <span style={{ marginLeft:2, background: isActive ? 'rgba(0,0,0,0.12)' : 'rgba(0,230,138,0.12)', borderRadius:999, padding:'2px 7px', fontSize:10, fontWeight:800, color: isActive ? '#000' : '#00e68a', border: isActive ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(0,230,138,0.18)' }}>{cartCount}</span>
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

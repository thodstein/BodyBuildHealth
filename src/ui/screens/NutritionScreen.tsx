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
import { HealthAnalytics } from './NutritionScreen_parts/HealthAnalytics';
import { ProgressTracker } from './NutritionScreen_parts/ProgressTracker';
import { NutriAdvisor } from './NutritionScreen_parts/NutriAdvisor';
import { CustomProducts } from './NutritionScreen_parts/CustomProducts';
import { MealVisualizer } from './NutritionScreen_parts/MealVisualizer';
import { Achievements } from './NutritionScreen_parts/Achievements';
import { DailyQuests } from './NutritionScreen_parts/DailyQuests';

const NutritionCharts = lazy(() => import('./NutritionScreen_parts/NutritionCharts').then(m => ({ default: m.NutritionCharts })));
import { generateNutritionReport, NutritionReport } from '../../engines/nutrition-report.engine';
import { getNutritionV2Data, saveNutritionV2Data } from '../../core/nutrition-v2-data';
import { getQualityLabel } from '../../engines/nutrition-quality.engine';
import { InfoErrorBoundary } from './SupportScreen_parts/SupportScreenData';

interface DiaryEntry { name: string; kcal: number; p: number; f: number; c: number; date?: string; }
type NutritionPage = 'hero' | 'tabs';
type NutritionSection = 'diary' | 'planning' | 'overview' | 'analytics' | 'all';
type ActiveTab = 'diary' | 'charts' | 'mealplan' | 'cart' | 'favorites' | 'catalog' | 'reference' | 'recipes' | 'reports' | 'restaurant' | 'info' | 'customfood' | 'overview' | 'usefulness' | 'health' | 'progress' | 'nutria' | 'visualize' | 'achievements' | 'quests';

const SECTION_TABS: Record<NutritionSection, string[]> = {
  overview: ['diary', 'charts', 'mealplan', 'cart', 'favorites', 'catalog', 'reference', 'recipes', 'reports', 'restaurant', 'customfood', 'overview', 'usefulness', 'progress', 'nutria', 'visualize', 'achievements', 'quests'],
  analytics: ['charts', 'reports'],
  diary: ['diary', 'charts', 'reports'],
  planning: ['mealplan', 'catalog', 'reference', 'info', 'usefulness', 'health', 'recipes'],
  all: ['diary', 'charts', 'mealplan', 'cart', 'favorites', 'catalog', 'reference', 'recipes', 'reports', 'restaurant', 'customfood', 'overview', 'usefulness', 'progress', 'nutria', 'visualize', 'achievements', 'quests'],
};

const TAB_LABELS: Record<string, string> = {
  diary: 'рџ“ќ Р”РЅРµРІРЅРёРє', charts: 'рџ“€ Р“СЂР°С„РёРєРё',
  mealplan: 'рџҐ— РџР»Р°РЅ', cart: 'рџ›’ РљРѕСЂР·РёРЅР°',
  restaurant: 'рџЌЅ Р РµСЃС‚РѕСЂР°РЅ',
  favorites: 'в­ђ РР·Р±СЂР°РЅРЅРѕРµ', catalog: 'рџ“¦ РљР°С‚Р°Р»РѕРі',
  reference: 'рџ“– РЎРїСЂР°РІРѕС‡РЅРёРє', recipes: 'рџЌі Р РµС†РµРїС‚С‹', reports: 'рџ“Љ РћС‚С‡С‘С‚С‹', info: 'в„№пёЏ РРЅС„Рѕ',
  usefulness: 'рџ§® РџРѕР»РµР·РЅРѕСЃС‚СЊ',
  health: 'рџ©є Р—РґРѕСЂРѕРІСЊРµ',
  progress: 'рџ“€ РџСЂРѕРіСЂРµСЃСЃ',
  nutria: 'рџ§‘вЂЌвљ•пёЏ РќСѓС‚СЂРёС†РёРѕР»РѕРі',
  customfood: 'рџ“ќ РЎРІРѕРё',
  visualize: 'рџЌЅпёЏ Р‘Р»СЋРґРѕ',
  achievements: 'рџЏ† Р”РѕСЃС‚РёР¶РµРЅРёСЏ',
  quests: 'рџЋЇ РљРІРµСЃС‚С‹',
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
    const name = newStoreName.trim() || 'РњР°РіР°Р·РёРЅ ' + (carts.length + 1);
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
    const dup: CartStore = { ...src, id: 'store_' + Date.now(), name: src.name + ' (РєРѕРїРёСЏ)', sortOrder: carts.length };
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
          <div style={{ fontSize:15, fontWeight:700, color:'#fff', letterSpacing:-0.3 }}>рџ›’ РљРѕСЂР·РёРЅР°</div>
          <button onClick={() => setShowNewStore(!showNewStore)} style={{ padding:'5px 10px', borderRadius:8, fontSize:9, cursor:'pointer', border:'1px solid rgba(0,230,138,0.3)', background:'rgba(0,230,138,0.08)', color:'#00e68a', fontWeight:600 }}>+ РњР°РіР°Р·РёРЅ</button>
        </div>
        {showNewStore && (
          <div style={{ display:'flex', gap:4, marginBottom:8 }}>
            <input value={newStoreName} onChange={e => setNewStoreName(e.target.value)} placeholder="РќР°Р·РІР°РЅРёРµ РјР°РіР°Р·РёРЅР°" style={{ flex:1, padding:'6px 10px', borderRadius:8, fontSize:9, border:'1px solid rgba(255,255,255,0.06)', background:'#202023', color:'#fff', outline:'none' }}
              onKeyDown={e => { if (e.key === 'Enter') addStore(); }} />
            <button onClick={addStore} style={{ padding:'6px 12px', borderRadius:8, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontSize:9, fontWeight:700 }}>вњ…</button>
            <button onClick={() => setShowNewStore(false)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.06)', cursor:'pointer', background:'#202023', color:'rgba(255,255,255,0.7)', fontSize:9 }}>вњ•</button>
          </div>
        )}
        <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:6 }}>
          {carts.map(s => (
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:2 }}>
              {storeBtn(s.id === (activeStore?.id || ''), () => switchStore(s.id), `${s.name} (${s.items.length})`)}
              <button onClick={() => duplicateStore(s.id)} style={{ padding:'2px 4px', borderRadius:4, border:'none', cursor:'pointer', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.8)', fontSize:7 }}>рџ“‹</button>
              {carts.length > 1 && <button onClick={() => deleteStore(s.id)} style={{ padding:'2px 4px', borderRadius:4, border:'none', cursor:'pointer', background:'rgba(239,68,68,0.08)', color:'#ef4444', fontSize:7 }}>вњ•</button>}
            </div>
          ))}
        </div>

        {!activeStore ? (
          <div style={{ textAlign:'center', padding:16, color:'rgba(255,255,255,0.8)', fontSize:11 }}>
            РЎРѕР·РґР°Р№С‚Рµ РјР°РіР°Р·РёРЅ, С‡С‚РѕР±С‹ РЅР°С‡Р°С‚СЊ СЃРѕР±РёСЂР°С‚СЊ СЃРїРёСЃРѕРє РїРѕРєСѓРїРѕРє.
          </div>
        ) : (
          <>
            {/* Store name + rename */}
            <input value={editingStoreId === activeStore.id ? (editingStoreId === activeStore.id ? storeNotes['_name'] ?? activeStore.name : activeStore.name) : activeStore.name}
              onChange={e => { setEditingStoreId(activeStore.id); setStoreNotes(p => ({ ...p, _name: e.target.value })); }}
              onBlur={() => { if (editingStoreId === activeStore.id) { renameStore(activeStore.id, storeNotes['_name'] ?? activeStore.name); setEditingStoreId(null); } }}
              placeholder="рџЏЄ РќР°Р·РІР°РЅРёРµ РјР°РіР°Р·РёРЅР°" style={{ ...inputStyle, marginBottom:4, fontSize:12, fontWeight:600 }} />

            {/* Summary */}
            <div style={{ display:'flex', gap:8, marginBottom:6 }}>
              <div style={{ flex:1, background:'#202023', borderRadius:8, padding:'5px 8px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.85)' }}>РџРѕР·РёС†РёР№</div>
                <div style={{ fontSize:14, fontWeight:800, color:'#00e68a' }}>{items.length}</div>
              </div>
              <div style={{ flex:1, background:'#202023', borderRadius:8, padding:'5px 8px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.85)' }}>РљРєР°Р»</div>
                <div style={{ fontSize:14, fontWeight:800, color:'#8b5cf6' }}>{Math.round(totalKcal)}</div>
              </div>
              <div style={{ flex:1, background:'#202023', borderRadius:8, padding:'5px 8px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.85)' }}>РЎСѓРјРјР°</div>
                <div style={{ fontSize:14, fontWeight:800, color:'#f59e0b' }}>{totalPrice.toFixed(0)}в‚Ѕ</div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display:'flex', gap:3, marginBottom:6, flexWrap:'wrap' }}>
              <button onClick={clearStore} style={{ padding:'4px 8px', borderRadius:6, fontSize:8, cursor:'pointer', border:'1px solid rgba(239,68,68,0.2)', background:'rgba(239,68,68,0.08)', color:'#ef4444' }}>вњ• РћС‡РёСЃС‚РёС‚СЊ СЃРїРёСЃРѕРє</button>
              <button onClick={() => duplicateStore(activeStore.id)} style={{ padding:'4px 8px', borderRadius:6, fontSize:8, cursor:'pointer', border:'1px solid rgba(139,92,246,0.2)', background:'rgba(139,92,246,0.08)', color:'#8b5cf6' }}>рџ“‹ Р”СѓР±Р»РёСЂРѕРІР°С‚СЊ</button>
            </div>

            {/* General notes */}
            <textarea value={storeNotes[activeStore.id] ?? activeStore.notes ?? ''}
              onChange={e => { setStoreNotes(p => ({ ...p, [activeStore.id]: e.target.value })); }}
              onBlur={() => { updateStoreNotes(activeStore.id, storeNotes[activeStore.id] ?? activeStore.notes ?? ''); }}
              placeholder="рџ“ќ РћР±С‰РёРµ Р·Р°РјРµС‚РєРё Рє СЃРїРёСЃРєСѓ..." style={{ width:'100%', boxSizing:'border-box', padding:'6px 10px', borderRadius:8, fontSize:9, border:'1px solid rgba(255,255,255,0.06)', background:'#202023', color:'#fff', outline:'none', resize:'vertical', minHeight:36, marginBottom:6, fontFamily:'inherit' }} />

            {items.length === 0 ? (
              <div style={{ textAlign:'center', padding:16, color:'rgba(255,255,255,0.8)', fontSize:10 }}>
                РЎРїРёСЃРѕРє РїСѓСЃС‚. Р”РѕР±Р°РІР»СЏР№С‚Рµ РїСЂРѕРґСѓРєС‚С‹ РёР· РїР»Р°РЅР° РїРёС‚Р°РЅРёСЏ РєРЅРѕРїРєРѕР№ В«рџ›’В».
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
                              <span style={{ fontSize:9, fontWeight:700, color:'#00e68a' }}>{item.amount}Рі</span>
                              <button onClick={() => updateQty(item.id, 10)} style={{ width:18, height:18, borderRadius:4, border:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.03)', color:'#fff', cursor:'pointer', fontSize:9, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                            <div style={{ fontSize:11, fontWeight:800, color:'#00e68a' }}>{Math.round(item.kcal)}</div>
                            <button onClick={() => removeItem(item.id)} style={{ padding:'2px 5px', borderRadius:4, border:'none', cursor:'pointer', background:'rgba(239,68,68,0.12)', color:'#ef4444', fontSize:8 }}>вњ•</button>
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
                            placeholder="рџ“Њ Р—Р°РјРµС‚РєР° Рє РїСЂРѕРґСѓРєС‚Сѓ..." style={{ flex:1, padding:'3px 6px', borderRadius:6, fontSize:8, border:'1px solid rgba(255,255,255,0.04)', background:'#18181b', color:'rgba(255,255,255,0.85)', outline:'none' }} />
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
    <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:2, padding:'0 4px', letterSpacing:-0.2 }}>рџ“– РЎРїСЂР°РІРѕС‡РЅРёРє РїРёС‚Р°РЅРёСЏ</div>
    <NutritionReference />
  </div>
);

const CATEGORY_LABELS: Record<string, string> = {
  protein: 'рџҐ© РњСЏСЃРѕ/Р С‹Р±Р°',
  dairy: 'рџҐ› РњРѕР»РѕС‡РєР°',
  grain: 'рџЊѕ РљСЂСѓРїС‹',
  carb: 'рџҐ” РЈРіР»РµРІРѕРґС‹',
  veg_fruit: 'рџҐ¦ РћРІРѕС‰Рё/Р¤СЂСѓРєС‚С‹',
  fat: 'рџ§€ Р–РёСЂС‹/РњР°СЃР»Р°',
  fast_food: 'рџЌ” Р¤Р°СЃС‚-С„СѓРґ',
  supplement: 'рџ’Љ Р”РѕР±Р°РІРєРё',
  other: 'рџ“¦ РџСЂРѕС‡РµРµ',
};

const CatalogTab: React.FC = () => {
  const [catSearch, setCatSearch] = React.useState('');
  const [catFilter, setCatFilter] = React.useState('all');
  const [showExclusive, setShowExclusive] = React.useState(false);
  const [catExpanded, setCatExpanded] = React.useState<string | null>(null);
  const categories = React.useMemo(() => [...new Set(FOOD_DB.map(f => f.category).filter(Boolean) as string[])], []);
  const addFav = (food: { id: string; name: string; kcal: number; protein: number; fat: number; carbs: number }) => {
    try { const ids: string[] = JSON.parse(localStorage.getItem('he_food_favs') || '[]'); const updated = [food.id, ...ids.filter(f => f !== food.id)].slice(0, 100); localStorage.setItem('he_food_favs', JSON.stringify(updated)); } catch {}
  };
  const filtered = React.useMemo(() => {
    return FOOD_DB.filter(f => {
      if (catFilter !== 'all' && f.category !== catFilter) return false;
      if (showExclusive && f.tier !== 'max') return false;
      if (catSearch && !(f.name||'').toLowerCase().includes(catSearch.toLowerCase())) return false;
      return true;
    });
  }, [catFilter, catSearch, showExclusive]);
  const filterBtn = (isActive: boolean, onClick: () => void, children: React.ReactNode) => (
    <button onClick={onClick} style={{ padding:'5px 10px', borderRadius:8, fontSize:8, cursor:'pointer', fontWeight: isActive ? 700 : 400, letterSpacing:0.2, whiteSpace:'nowrap', border: isActive ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)', background: isActive ? 'linear-gradient(135deg,rgba(0,230,138,0.2),rgba(0,200,160,0.12))' : '#202023', color: isActive ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>{children}</button>
  );
  const toggleExpanded = (id: string) => setCatExpanded(prev => prev === id ? null : id);
  return (<div style={{ display:'flex', flexDirection:'column', gap:8 }}>
    <div style={{ padding:14, ...cardBg }}>
      <div style={labelSec}>рџ“¦ РљР°С‚Р°Р»РѕРі РїСЂРѕРґСѓРєС‚РѕРІ ({FOOD_DB.length})</div>
      <input value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder="рџ”Ќ РџРѕРёСЃРє РїРѕ РЅР°Р·РІР°РЅРёСЋ..." style={inputStyle} />
      <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
        {filterBtn(catFilter === 'all', () => { setShowExclusive(false); setCatFilter('all'); }, `Р’СЃРµ (${FOOD_DB.length})`)}
        {categories.map(c => {
          const count = FOOD_DB.filter(f => f.category === c).length;
          return filterBtn(catFilter === c, () => { setShowExclusive(false); setCatFilter(c); }, `${CATEGORY_LABELS[c] || c} (${count})`);
        })}
        <button onClick={() => { setShowExclusive(e => !e); setCatFilter('all'); }} style={{
          padding:'5px 10px', borderRadius:8, fontSize:8, cursor:'pointer', fontWeight: showExclusive ? 700 : 400, letterSpacing:0.2, whiteSpace:'nowrap',
          border: showExclusive ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.06)',
          background: showExclusive ? 'rgba(168,85,247,0.14)' : '#202023',
          color: showExclusive ? '#a855f7' : 'rgba(255,255,255,0.85)',
        }}>в­ђ Exclusive ({FOOD_DB.filter(f => f.tier === 'max').length})</button>
      </div>
      <div style={{ marginTop:6, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.7)' }}>
          {catFilter === 'all' ? 'РџРѕРєР°Р·Р°РЅС‹ РІСЃРµ РїСЂРѕРґСѓРєС‚С‹' : `${CATEGORY_LABELS[catFilter] || catFilter} вЂ” ${filtered.length} РїСЂРѕРґСѓРєС‚РѕРІ`}
        </div>
      </div>
      <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:3, borderRadius:8 }}>
        {filtered.map(f => {
          const isExpanded = catExpanded === f.id;
          const bbScore = f.bb_quality_score;
          const scoreLabel = bbScore ? (bbScore >= 7 ? 'вњ…' : 'вљ пёЏ') : '';
          return (<div key={f.id}>
            <div onClick={() => toggleExpanded(f.id)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderRadius:10, background: isExpanded ? 'rgba(0,230,138,0.04)' : '#202023', border: isExpanded ? '1px solid rgba(0,230,138,0.12)' : '1px solid rgba(255,255,255,0.06)', cursor:'pointer' }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ fontSize:11, fontWeight:600, color:'#fff' }}>{f.name}</span>
                  {bbScore && <span style={{ fontSize:8, padding:'1px 5px', borderRadius:4, background: bbScore >= 7 ? 'rgba(0,230,138,0.1)' : bbScore >= 5 ? 'rgba(249,115,22,0.1)' : 'rgba(239,68,68,0.1)', color: bbScore >= 7 ? '#00e68a' : bbScore >= 5 ? '#f97316' : '#ef4444' }}>{bbScore.toFixed(1)}</span>}
                  <span style={{ fontSize:7, color:'rgba(255,255,255,0.6)' }}>{isExpanded ? 'в–І' : 'в–ј'}</span>
                </div>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.8)', marginTop:1 }}>{CATEGORY_LABELS[f.category] || f.category} вЂў {f.kcal}РєРєР°Р» вЂў Р‘{f.protein} Р–{f.fat} РЈ{f.carbs} {f.fiber ? `вЂў Р’{f.fiber}Рі` : ''}</div>
              </div>
              <div style={{ display:'flex', gap:3, alignItems:'center' }}>
                <button onClick={e => { e.stopPropagation(); addFav(f); }} style={{ padding:'4px 8px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', color:'#8b5cf6' }}>в­ђ</button>
                <button onClick={e => { e.stopPropagation(); addToCart({ name: f.name, kcal: f.kcal, amount: 100, category: f.category }); }} style={{ padding:'4px 8px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(0,230,138,0.15)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a' }}>рџ›’</button>
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
                  <span>вЏ± Р“Р: {f.gi ?? 'вЂ”'} | РР: {m.insulin_index ?? 'вЂ”'}</span>
                  <span>вљЎ РљР»РµС‚С‡Р°С‚РєР°: {f.fiber ?? 'вЂ”'}Рі</span>
                  {m.proteins_animal !== undefined ? <span>рџҐ© Р‘РµР»РѕРє Р¶РёРІ.: {m.proteins_animal}Рі</span> : null}
                  {m.proteins_plant !== undefined ? <span>рџЊ± Р‘РµР»РѕРє СЂР°СЃС‚.: {m.proteins_plant}Рі</span> : null}
                  {m.fats_saturated !== undefined ? <span>рџ§€ РќР°СЃС‹С‰.: {m.fats_saturated}Рі</span> : null}
                  {m.fats_monounsaturated !== undefined ? <span>рџ«’ РњРѕРЅРѕ: {m.fats_monounsaturated}Рі</span> : null}
                  {m.fats_polyunsaturated !== undefined ? <span>рџЊ» РџРѕР»Рё: {m.fats_polyunsaturated}Рі</span> : null}
                  {m.omega_3_mg !== undefined ? <span>рџђџ РћРјРµРіР°-3: {m.omega_3_mg}РјРі</span> : null}
                  {m.omega_6_mg !== undefined ? <span>рџ”ґ РћРјРµРіР°-6: {m.omega_6_mg}РјРі</span> : null}
                  {m.mct_oil_g !== undefined ? <span>рџ«ђ MCT: {m.mct_oil_g}Рі</span> : null}
                  {m.cholesterol_mg !== undefined ? <span>рџ«Ђ РҐРѕР»РµСЃС‚РµСЂРёРЅ: {m.cholesterol_mg}РјРі</span> : null}
                  {m.carbs_sugar !== undefined ? <span>рџЌ¬ РЎР°С…Р°СЂР°: {m.carbs_sugar}Рі</span> : null}
                </div>
                {aa.leucine_mg !== undefined && row([
                  <span style={{color:'#8b5cf6'}}>рџ§¬ РђРљ:</span>,
                  <span>Р»РµР№ {aa.leucine_mg}РјРі</span>,
                  aa.isoleucine_mg !== undefined && <span>вЂў РёР»РµР№ {aa.isoleucine_mg}РјРі</span>,
                  aa.valine_mg !== undefined && <span>вЂў РІР°Р» {aa.valine_mg}РјРі</span>,
                  aa.lysine_mg !== undefined && <span>вЂў Р»РёР· {aa.lysine_mg}РјРі</span>,
                  aa.methionine_mg !== undefined && <span>вЂў РјРµС‚ {aa.methionine_mg}РјРі</span>,
                  aa.threonine_mg !== undefined && <span>вЂў С‚СЂРµ {aa.threonine_mg}РјРі</span>,
                  aa.tryptophan_mg !== undefined && <span>вЂў С‚СЂРё {aa.tryptophan_mg}РјРі</span>,
                  aa.phenylalanine_mg !== undefined && <span>вЂў С„РµРЅ {aa.phenylalanine_mg}РјРі</span>,
                  aa.histidine_mg !== undefined && <span>вЂў РіРёСЃ {aa.histidine_mg}РјРі</span>,
                  aa.arginine_mg !== undefined && <span>вЂў Р°СЂРі {aa.arginine_mg}РјРі</span>,
                  aa.glutamine_mg !== undefined && <span>вЂў РіР»Сѓ {aa.glutamine_mg}РјРі</span>,
                  aa.cysteine_mg !== undefined && <span>вЂў С†РёСЃ {aa.cysteine_mg}РјРі</span>,
                ], '#8b5cf6')}
                {el.sodium_mg !== undefined && row([
                  <span style={{color:'#60a5fa'}}>вљЎ Р­Р»РµРєС‚СЂРѕР»РёС‚С‹:</span>,
                  <span>Na {el.sodium_mg}РјРі</span>,
                  el.potassium_mg !== undefined && <span>вЂў K {el.potassium_mg}РјРі</span>,
                  el.magnesium_mg !== undefined && <span>вЂў Mg {el.magnesium_mg}РјРі</span>,
                  el.calcium_mg !== undefined && <span>вЂў Ca {el.calcium_mg}РјРі</span>,
                  el.phosphorus_mg !== undefined && <span>вЂў P {el.phosphorus_mg}РјРі</span>,
                  el.pral_index !== undefined && <span>вЂў PRAL {el.pral_index}</span>,
                ], '#60a5fa')}
                {vit.vitamin_a_mcg !== undefined && row([
                  <span style={{color:'#f97316'}}>рџ’Љ Р’РёС‚Р°РјРёРЅС‹:</span>,
                  <span>A {vit.vitamin_a_mcg}РјРєРі</span>,
                  vit.vitamin_c_mg !== undefined && <span>вЂў C {vit.vitamin_c_mg}РјРі</span>,
                  vit.vitamin_d_mcg !== undefined && <span>вЂў D {vit.vitamin_d_mcg}РјРєРі</span>,
                  vit.vitamin_e_mg !== undefined && <span>вЂў E {vit.vitamin_e_mg}РјРі</span>,
                  vit.vitamin_k_mcg !== undefined && <span>вЂў K {vit.vitamin_k_mcg}РјРєРі</span>,
                  vit.vitamin_b1_mg !== undefined && <span>вЂў B1 {vit.vitamin_b1_mg}РјРі</span>,
                  vit.vitamin_b2_mg !== undefined && <span>вЂў B2 {vit.vitamin_b2_mg}РјРі</span>,
                  vit.vitamin_b3_mg !== undefined && <span>вЂў B3 {vit.vitamin_b3_mg}РјРі</span>,
                  vit.vitamin_b5_mg !== undefined && <span>вЂў B5 {vit.vitamin_b5_mg}РјРі</span>,
                  vit.vitamin_b6_mg !== undefined && <span>вЂў B6 {vit.vitamin_b6_mg}РјРі</span>,
                  vit.vitamin_b7_mcg !== undefined && <span>вЂў B7 {vit.vitamin_b7_mcg}РјРєРі</span>,
                  vit.vitamin_b9_mcg !== undefined && <span>вЂў B9 {vit.vitamin_b9_mcg}РјРєРі</span>,
                  vit.vitamin_b12_mcg !== undefined && <span>вЂў B12 {vit.vitamin_b12_mcg}РјРєРі</span>,
                ], '#f97316')}
                {tr.iron_total_mg !== undefined && row([
                  <span style={{color:'#22c55e'}}>вљ™пёЏ РњРёРєСЂРѕСЌР»РµРјРµРЅС‚С‹:</span>,
                  <span>Fe {tr.iron_total_mg}РјРі{tr.iron_heme_mg ? `(РіРµРј ${tr.iron_heme_mg})` : ''}</span>,
                  tr.zinc_mg !== undefined && <span>вЂў Zn {tr.zinc_mg}РјРі</span>,
                  tr.selenium_mcg !== undefined && <span>вЂў Se {tr.selenium_mcg}РјРєРі</span>,
                  tr.copper_mg !== undefined && <span>вЂў Cu {tr.copper_mg}РјРі</span>,
                  tr.manganese_mg !== undefined && <span>вЂў Mn {tr.manganese_mg}РјРі</span>,
                  tr.iodine_mcg !== undefined && <span>вЂў I {tr.iodine_mcg}РјРєРі</span>,
                  tr.chromium_mcg !== undefined && <span>вЂў Cr {tr.chromium_mcg}РјРєРі</span>,
                ], '#22c55e')}
                {bio.creatine_mg !== undefined && row([
                  <span style={{color:'#a78bfa'}}>рџ§Є Р‘РёРѕР°РєС‚РёРІРЅС‹Рµ:</span>,
                  <span>РєСЂРµР°С‚РёРЅ {bio.creatine_mg}РјРі</span>,
                  bio.beta_alanine_mg !== undefined && <span>вЂў ОІ-Р°Р»Р°РЅРёРЅ {bio.beta_alanine_mg}РјРі</span>,
                  bio.taurine_mg !== undefined && <span>вЂў С‚Р°СѓСЂРёРЅ {bio.taurine_mg}РјРі</span>,
                  bio.lignan_mg !== undefined && <span>вЂў Р»РёРіРЅР°РЅ {bio.lignan_mg}РјРі</span>,
                  bio.indol_3_carbinol_mg !== undefined && <span>вЂў I3C {bio.indol_3_carbinol_mg}РјРі</span>,
                ], '#a78bfa')}
                {sc.polyphenols_mg !== undefined && row([
                  <span style={{color:'#f59e0b'}}>рџЊї РЎРѕРµРґРёРЅРµРЅРёСЏ:</span>,
                  <span>РїРѕР»РёС„РµРЅРѕР»С‹ {sc.polyphenols_mg}РјРі</span>,
                  sc.flavonoids_mg !== undefined && <span>вЂў С„Р»Р°РІ. {sc.flavonoids_mg}РјРі</span>,
                  sc.curcumin_mg !== undefined && <span>вЂў РєСѓСЂРєСѓРјРёРЅ {sc.curcumin_mg}РјРі</span>,
                  sc.sulforaphane_mg !== undefined && <span>вЂў СЃСѓР»СЊС„. {sc.sulforaphane_mg}РјРі</span>,
                  sc.resveratrol_mg !== undefined && <span>вЂў СЂРµСЃРІРµСЂ. {sc.resveratrol_mg}РјРі</span>,
                  sc.lectins_mg !== undefined && <span>вЂў Р»РµРєС‚РёРЅС‹ {sc.lectins_mg}РјРі</span>,
                  sc.oxalates_mg !== undefined && <span>вЂў РѕРєСЃР°Р»Р°С‚С‹ {sc.oxalates_mg}РјРі</span>,
                  sc.phytoestrogens_mg !== undefined && <span>вЂў С„РёС‚РѕСЌСЃС‚СЂ. {sc.phytoestrogens_mg}РјРі</span>,
                  sc.alpha_lipoic_acid_mg !== undefined && <span>вЂў РђР›Рљ {sc.alpha_lipoic_acid_mg}РјРі</span>,
                  sc.coenzyme_q10_mg !== undefined && <span>вЂў CoQ10 {sc.coenzyme_q10_mg}РјРі</span>,
                  sc.berberine_mg !== undefined && <span>вЂў Р±РµСЂР±РµСЂРёРЅ {sc.berberine_mg}РјРі</span>,
                ], '#f59e0b')}
                {gt.fodmap_group && row([
                  <span style={{color:'#f97316'}}>рџ«ѓ Р–РљРў:</span>,
                  <span>FODMAP {gt.fodmap_group}</span>,
                  gt.enzyme_demand_score !== undefined && <span>вЂў Р¤РµСЂРј.РЅР°РіСЂСѓР·РєР° {gt.enzyme_demand_score}/10</span>,
                  gt.gastric_emptying_speed && <span>вЂў РћРїРѕСЂРѕР¶РЅРµРЅРёРµ: {gt.gastric_emptying_speed === 'FAST' ? 'Р±С‹СЃС‚СЂРѕРµ' : gt.gastric_emptying_speed === 'SLOW' ? 'РјРµРґР»РµРЅРЅРѕРµ' : 'СЃСЂРµРґРЅРµРµ'}</span>,
                  gt.gut_irritant_potential && <span>вЂў Р Р°Р·РґСЂР°Р¶РµРЅРёРµ: {gt.gut_irritant_potential}</span>,
                  gt.allergen_flags && gt.allergen_flags.length > 0 && <span>вЂў РђР»Р»РµСЂРіРµРЅС‹: {gt.allergen_flags.join(',')}</span>,
                ], '#f97316')}
                {row([
                  <span style={{color:'#a78bfa'}}>рџЏ· Р¤Р»Р°РіРё:</span>,
                  mf.atherogenic_potential === 'HIGH' && <span style={{color:'#ef4444'}}>рџљЁ РђС‚РµСЂРѕРіРµРЅ.</span>,
                  mf.glycation_potential === 'HIGH' && <span style={{color:'#f59e0b'}}>рџ”Ґ Р“Р»РёРєР°С†РёСЏ</span>,
                  mf.ammonia_source_level === 'HIGH' && <span style={{color:'#ef4444'}}>рџ’Ё РђРјРјРёР°Рє HIGH</span>,
                  mf.ammonia_source_level === 'MEDIUM' && <span style={{color:'#a78bfa'}}>рџ’Ё РђРјРјРёР°Рє MED</span>,
                  mf.heavy_metal_risk === 'HIGH' && <span style={{color:'#ef4444'}}>вўпёЏ РўСЏР¶.РјРµС‚.</span>,
                  mf.heavy_metal_risk === 'MEDIUM' && <span style={{color:'#f59e0b'}}>вўпёЏ РўСЏР¶.РјРµС‚.MED</span>,
                  mf.cns_impact === 'STIMULANT' && <span style={{color:'#f97316'}}>рџ§  РЎС‚РёРј.</span>,
                  mf.cns_impact === 'SEDATIVE' && <span style={{color:'#8b5cf6'}}>рџґ РЎРµРґР°С‚.</span>,
                  mf.anabolic_potential === 'HIGH' && <span style={{color:'#00e68a'}}>рџ’Є РђРЅР°Р±РѕР»</span>,
                  mf.anabolic_potential === 'MEDIUM' && <span style={{color:'#f59e0b'}}>рџ’Є РђРЅР°Р±РѕР» MED</span>,
                  mf.hepatoprotective && <span style={{color:'#22c55e'}}>рџ«Ѓ Р“РµРїР°С‚РѕРїСЂ.</span>,
                  mf.insulin_sensitivity_impact === 'NEGATIVE' && <span style={{color:'#ef4444'}}>рџ“‰ РРЅСЃ.-СЃРµРЅСЃ NEG</span>,
                  mf.insulin_sensitivity_impact === 'POSITIVE' && <span style={{color:'#00e68a'}}>рџ“€ РРЅСЃ.-СЃРµРЅСЃ POS</span>,
                  mf.goitrogenic_potential === 'HIGH' && <span style={{color:'#f59e0b'}}>рџ¦‹ Р—РѕР±РѕРіРµРЅ.</span>,
                  mf.detox_support_level === 'HIGH' && <span style={{color:'#22c55e'}}>рџ§№ Р”РµС‚РѕРєСЃ</span>,
                  mf.histamine_level === 'HIGH' && <span style={{color:'#ef4444'}}>рџ§Є Р“РёСЃС‚Р°РјРёРЅ HIGH</span>,
                  mf.thyroid_support_level === 'HIGH' && <span style={{color:'#22c55e'}}>рџ¦‹ Р©РёС‚. HIGH</span>,
                ], '#a78bfa')}
                {row([
                  <span style={{color:'rgba(255,255,255,0.65)'}}>рџ“Љ {f.tier === 'max' ? 'РЈСЂРѕРІРµРЅСЊ: РњР°РєСЃРёРјСѓРј' : f.tier === 'mid' ? 'РЈСЂРѕРІРµРЅСЊ: РЎСЂРµРґРЅРёР№' : 'РЈСЂРѕРІРµРЅСЊ: Р‘Р°Р·РѕРІС‹Р№'}</span>,
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
  const mealLabel = (m: string) => m === 'breakfast' ? 'рџЊ…' : m === 'lunch' ? 'вЂпёЏ' : m === 'dinner' ? 'рџЊ™' : m === 'snack' ? 'рџЌї' : '';
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
        <div style={labelSec}>рџЌі Р РµС†РµРїС‚С‹ ({recipes.length + myRecipes.length})</div>
        <button onClick={() => setShowRecipeModal(true)} style={{
          padding:'6px 12px', borderRadius:8, cursor:'pointer', fontSize:9, fontWeight:700,
          border:'1px solid rgba(0,230,138,0.3)', background:'rgba(0,230,138,0.1)', color:'#00e68a',
        }}>+ Р РµС†РµРїС‚</button>
      </div>
      {/* My recipes collapsible */}
      {myRecipes.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div onClick={() => setMyRecExpanded(!myRecExpanded)} style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'6px 8px', borderRadius:6, cursor:'pointer',
            background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.1)',
          }}>
            <span style={{ fontSize:9, color:'#a78bfa', fontWeight:600 }}>рџ“ќ РњРѕРё СЂРµС†РµРїС‚С‹ ({myRecipes.length})</span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.8)' }}>{myRecExpanded ? 'в–І' : 'в–ј'}</span>
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
                        {r.kcal} РєРєР°Р» В· Р‘{r.protein} Р–{r.fat} РЈ{r.carbs}
                      </span>
                    </div>
                    <button onClick={() => deleteMyRecipe(r.id)} style={{
                      padding:'2px 6px', borderRadius:4, cursor:'pointer', fontSize:8,
                      background:'rgba(239,68,68,0.08)', border:'none', color:'#ef4444',
                    }}>вњ•</button>
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
            <div style={{ fontSize:15, fontWeight:700, color:'#00e68a', marginBottom:12, textAlign:'center' }}>рџЌі РЎРѕР·РґР°С‚СЊ СЂРµС†РµРїС‚</div>
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:3 }}>РќР°Р·РІР°РЅРёРµ СЂРµС†РµРїС‚Р°</div>
              <input value={recName} onChange={e => setRecName(e.target.value)} placeholder="РќР°РїСЂРёРјРµСЂ: РћРІСЃСЏРЅРѕР±Р»РёРЅ" style={inputStyle} />
            </div>
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:3 }}>РРЅРіСЂРµРґРёРµРЅС‚С‹ (РїРѕ РѕРґРЅРѕРјСѓ РЅР° СЃС‚СЂРѕРєСѓ)</div>
              <textarea value={recIngredients} onChange={e => setRecIngredients(e.target.value)} placeholder="РЇР№С†Р° 2 С€С‚&#10;РћРІСЃСЏРЅРєР° 30 Рі&#10;РўРІРѕСЂРѕРі 50 Рі" style={{ ...inputStyle, resize:'vertical', minHeight:70, fontSize:10 }} rows={3} />
            </div>
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:3 }}>РџСЂРёРіРѕС‚РѕРІР»РµРЅРёРµ</div>
              <textarea value={recInstructions} onChange={e => setRecInstructions(e.target.value)} placeholder="РћРїРёСЃР°РЅРёРµ РїСЂРѕС†РµСЃСЃР° РїСЂРёРіРѕС‚РѕРІР»РµРЅРёСЏ..." style={{ ...inputStyle, resize:'vertical', minHeight:60, fontSize:10 }} rows={3} />
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:4 }}>РљР‘Р–РЈ РЅР° РїРѕСЂС†РёСЋ</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4 }}>
                {[
                  { l:'РљРєР°Р»', v: recKcal, s: setRecKcal, c:'#00e68a' },
                  { l:'Р‘РµР»РєРё', v: recProtein, s: setRecProtein, c:'#3b82f6' },
                  { l:'Р–РёСЂС‹', v: recFat, s: setRecFat, c:'#f59e0b' },
                  { l:'РЈРіР»РµРІРѕРґС‹', v: recCarbs, s: setRecCarbs, c:'#f97316' },
                ].map(m => (
                  <div key={m.l} style={{ textAlign:'center' }}>
                    <input type="number" value={m.v || ''} onChange={e => m.s(+e.target.value || 0)} placeholder="0" style={{
                      width:'100%', padding:'8px 4px', borderRadius:8, fontSize:11, fontWeight:700, textAlign:'center',
                      background:'#202023', border:`1px solid ${m.c}30`, color:m.c, outline:'none', boxSizing:'border-box',
                    }} />
                    <div style={{ fontSize:7, color:'rgba(255,255,255,0.6)', marginTop:1 }}>{m.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={saveRecipe} style={{
              width:'100%', padding:'12px', borderRadius:10, cursor:'pointer', border:'none',
              background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontSize:11, fontWeight:700,
            }}>вњ“ РЎРѕС…СЂР°РЅРёС‚СЊ СЂРµС†РµРїС‚</button>
          </div>
        </div>
      )}
      <input value={recSearch} onChange={e => setRecSearch(e.target.value)} placeholder="рџ”Ќ РџРѕРёСЃРє СЂРµС†РµРїС‚РѕРІ..." style={{ ...inputStyle, marginTop: 6 }} />
      <div style={{ marginTop:8, display:'flex', gap:3, flexWrap:'wrap', marginBottom:6 }}>
        {mealBtn(recMeal === 'all', () => setRecMeal('all'), 'Р’СЃРµ')}
        {mealBtn(recMeal === 'breakfast', () => setRecMeal('breakfast'), 'Р—Р°РІС‚СЂР°Рє')}
        {mealBtn(recMeal === 'lunch', () => setRecMeal('lunch'), 'РћР±РµРґ')}
        {mealBtn(recMeal === 'dinner', () => setRecMeal('dinner'), 'РЈР¶РёРЅ')}
        {mealBtn(recMeal === 'snack', () => setRecMeal('snack'), 'РџРµСЂРµРєСѓСЃ')}
      </div>
      <div style={{ maxHeight:420, overflowY:'auto' }}>
        {list.map((r: any, i: number) => {
          const isExpanded = recExpanded[i] || false;
          return <div key={i} style={{ padding:'8px 10px', borderRadius:10, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', marginBottom:4 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ fontSize:11, fontWeight:600, color:'#fff' }}>{mealLabel(r.meal)} {r.name}</span>
                  <span style={{ fontSize:8, color:'rgba(255,255,255,0.75)' }}>{r.prepTimeMin} РјРёРЅ</span>
                </div>
                <div style={{ fontSize:10, display:'flex', gap:4, marginTop:2 }}>
                  <span style={{ color:'#00e68a', fontWeight:700 }}>{r.kcal} РєРєР°Р»</span>
                  <span style={{ color:'#60a5fa' }}>Р‘{r.protein}</span>
                  <span style={{ color:'#fbbf24' }}>Р–{r.fat}</span>
                  <span style={{ color:'#fb923c' }}>РЈ{r.carbs}</span>
                </div>
              </div>
              <button onClick={() => setRecExpanded(prev => ({...prev, [i]: !prev[i]}))} style={{ padding:'4px 8px', borderRadius:6, fontSize:9, cursor:'pointer', border:'1px solid rgba(255,255,255,0.06)', background:'#18181b', color:'rgba(255,255,255,0.7)' }}>{isExpanded ? 'в–І' : 'в–ј'}</button>
            </div>
            {r.tags && <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:3 }}>
              {r.tags.map((t: string, j: number) => <span key={j} style={{ padding:'1px 6px', borderRadius:8, fontSize:8, background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.65)' }}>{t}</span>)}
            </div>}
            {r.ingredients && <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:3 }}>
              {r.ingredients.map((ing: string, j: number) => <span key={j} style={{ padding:'2px 6px', borderRadius:6, fontSize:9, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.85)' }}>{ing}</span>)}
            </div>}
            {isExpanded && r.instructions && <div style={{ marginTop:6, paddingTop:6, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#00e68a', marginBottom:4 }}>рџ“ќ РџСЂРёРіРѕС‚РѕРІР»РµРЅРёРµ</div>
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
  russian: ['С…Р°СЂС‡Рѕ','Р»Р°РіРјР°РЅ','РґРѕР»РјР°','С…Р°С‡Р°РїСѓСЂРё','С‡РµР±СѓСЂРµРєРё','РїСЏРЅ-СЃРµ','С€РЅРёС†РµР»СЊ','РєРѕС‚Р»РµС‚Р° РїРѕ-РєРёРµРІСЃРєРё','Р±РµС„СЃС‚СЂРѕРіР°РЅРѕРІ','С‰Р°РІРµР»РµРІС‹Р№ СЃСѓРї'],
  asian: ['СЂР°РјРµРЅ','Р¶Р°СЂРµРЅС‹Р№ СЂРёСЃ','РєСѓСЂРёС†Р° С‚РµСЂРёСЏРєРё','РІРѕРє','РїРѕРєРµ','С‚РѕРј СЏРј','РјРёСЃРѕ СЃСѓРї','РѕР»Р°РґСЊРё','РєСѓСЂРёС†Р° РєР°СЂСЂРё','РіСЂРµС‡РµСЃРєРёР№','РѕР»Р°РґСЊРё'],
  italian: ['РїРёС†С†Р°'],
  fastfood: ['С€Р°СѓСЂРјР°','Р±СѓСЂРіРµСЂ','kfc','mcdonald','burger king','РјР°РєРЅР°РіРіРµС‚СЃ','big mac','whopper','РІРєСѓСЃРЅРѕ Рё С‚РѕС‡РєР°','Р±РёРі СЃРјРѕСѓРє','С‡РёР·Р±СѓСЂРіРµСЂ','С‡РёР·Р±СѓСЂРіРµСЂ','Р»РѕРЅРі С‡РёРєРµРЅ','twister','С‚РІРёСЃС‚РµСЂ','Р±РѕРєСЃРјР°СЃС‚РµСЂ','РіСЂРёР»СЊ-СЂРѕР»Р»','РєСѓСЂРёРЅС‹Рµ С„СЂРё','РЅР°РіРіРµС‚СЃ','С†РµР·Р°СЂСЊ','РєР°СЂС‚РѕС„РµР»СЊ С„СЂРё','Р»СѓРєРѕРІС‹Рµ РєРѕР»СЊС†Р°','С„Р°Р»Р°С„РµР»СЊ','РіРёСЂРѕСЃ','СЃСЌРЅРґРІРёС‡ СЃ С‚СѓРЅС†РѕРј','РєР°СЂС‚РѕС„РµР»СЊ С„СЂРё'],
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
    {/* РљР‘Р–РЈ СЃРІРѕРґРєР° */}
    {filtered.length > 0 && (
      <div style={{ padding:14, ...cardBg }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:6 }}>рџ“Љ РљР‘Р–РЈ РІС‹Р±СЂР°РЅРЅС‹С… Р±Р»СЋРґ</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6 }}>
          {[{l:'РљР°Р»РѕСЂРёРё',v:Math.round(totals.kcal),c:'#00e68a',u:'РєРєР°Р»'},{l:'Р‘РµР»РєРё',v:Math.round(totals.p),c:'#3b82f6',u:'Рі'},{l:'Р–РёСЂС‹',v:Math.round(totals.f),c:'#f59e0b',u:'Рі'},{l:'РЈРіР»РµРІРѕРґС‹',v:Math.round(totals.c),c:'#f97316',u:'Рі'}].map((s,i) => (
            <div key={i} style={{ background:'#202023', borderRadius:8, padding:'5px 8px', textAlign:'center' }}>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.85)' }}>{s.l}</div>
              <div style={{ fontSize:16, fontWeight:800, color:s.c }}>{s.v}<span style={{ fontSize:9, fontWeight:400, color:'rgba(255,255,255,0.8)' }}> {s.u}</span></div>
            </div>
          ))}
        </div>
      </div>
    )}
    {/* Р¤РёР»СЊС‚СЂС‹ */}
    <div style={{ padding:14, ...cardBg }}>
      <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:6 }}>
        {cuisineBtn('all', 'Р’СЃРµ')}
        {cuisineBtn('russian', 'рџ‡·рџ‡є Р СѓСЃСЃРєР°СЏ')}
        {cuisineBtn('asian', 'рџҐџ РђР·РёР°С‚СЃРєР°СЏ')}
        {cuisineBtn('italian', 'рџЌќ РС‚Р°Р»СЊСЏРЅСЃРєР°СЏ')}
        {cuisineBtn('fastfood', 'рџЌ” Р¤Р°СЃС‚-С„СѓРґ')}
      </div>
      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="рџ”Ќ РџРѕРёСЃРє Р±Р»СЋРґ..." style={{ width:'100%', boxSizing:'border-box', padding:'6px 10px', borderRadius:8, fontSize:9, border:'1px solid rgba(255,255,255,0.06)', background:'#202023', color:'#fff', outline:'none' }} />
    </div>
    {/* РЎРїРёСЃРѕРє Р±Р»СЋРґ СЃ РљР‘Р–РЈ */}
    <div style={{ padding:14, ...cardBg }}>
      <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:6 }}>рџЌЅ Р‘Р»СЋРґР° СЂРµСЃС‚РѕСЂР°РЅРѕРІ ({filtered.length})</div>
      {filtered.length === 0 ? (
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.8)', textAlign:'center', padding:20 }}>РќРµС‚ Р±Р»СЋРґ РїРѕ РІС‹Р±СЂР°РЅРЅРѕРјСѓ С„РёР»СЊС‚СЂСѓ.</div>
      ) : (
        <div style={{ maxHeight:400, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
          {filtered.map(food => {
            const portion = portions[food.id] || 1;
            return (<div key={food.id} style={{ padding:'6px 8px', borderRadius:8, background:'#202023', border:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:9, fontWeight:600, color:'#fff' }}>{food.name}</div>
                  <div style={{ fontSize:7, color:'rgba(255,255,255,0.8)' }}>{food.servingSize || ''} В· {detectCuisine(food.name)}</div>
                </div>
                <div style={{ display:'flex', gap:2 }}>
                  {[-1,1].map(d => <button key={d} onClick={() => setPortions(p => ({...p, [food.id]: Math.max(0.25, (p[food.id]||1) + d * 0.25)}))} style={{ width:18, height:18, borderRadius:4, border:'1px solid rgba(255,255,255,0.06)', background:'#18181b', color:'rgba(255,255,255,0.85)', cursor:'pointer', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center' }}>{d>0?'+':'-'}</button>)}
                </div>
                <button onClick={() => addToCart({ name: food.name, amount: Math.round(portion * (parseInt(food.servingSize) || 100)), kcal: Math.round(food.kcal * portion), category: 'fast_food' })} style={{ padding:'3px 6px', borderRadius:4, border:'1px solid rgba(0,230,138,0.3)', background:'rgba(0,230,138,0.08)', color:'#00e68a', cursor:'pointer', fontSize:7, fontWeight:600 }}>рџ›’</button>
                <button onClick={() => { try { const planItems = JSON.parse(localStorage.getItem('he_quick_plan_items') || '[]'); planItems.push({ name: food.name, id: food.id, amount: Math.round(portion * 100), kcal: Math.round(food.kcal * portion), p: Math.round(food.protein * portion), f: Math.round(food.fat * portion), c: Math.round(food.carbs * portion) }); localStorage.setItem('he_quick_plan_items', JSON.stringify(planItems)); alert('вњ… Р”РѕР±Р°РІР»РµРЅРѕ РІ РїР»Р°РЅ РїРёС‚Р°РЅРёСЏ'); } catch {} }} style={{ padding:'3px 6px', borderRadius:4, border:'1px solid rgba(139,92,246,0.3)', background:'rgba(139,92,246,0.08)', color:'#a78bfa', cursor:'pointer', fontSize:7, fontWeight:600 }}>рџ“‹</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:3, marginTop:4 }}>
                <div style={{ background:'#18181b', borderRadius:4, padding:'2px 4px', textAlign:'center', fontSize:7, color:'rgba(255,255,255,0.85)' }}>рџ”Ґ {Math.round(food.kcal * portion)}</div>
                <div style={{ background:'rgba(59,130,246,0.08)', borderRadius:4, padding:'2px 4px', textAlign:'center', fontSize:7, color:'#60a5fa' }}>Р‘ {Math.round(food.protein * portion)}</div>
                <div style={{ background:'rgba(245,158,11,0.08)', borderRadius:4, padding:'2px 4px', textAlign:'center', fontSize:7, color:'#fbbf24' }}>Р– {Math.round(food.fat * portion)}</div>
                <div style={{ background:'rgba(249,115,22,0.08)', borderRadius:4, padding:'2px 4px', textAlign:'center', fontSize:7, color:'#fb923c' }}>РЈ {Math.round(food.carbs * portion)}</div>
              </div>
              {portion !== 1 && <div style={{ fontSize:7, color:'rgba(255,255,255,0.8)', marginTop:2 }}>Г— {portion.toFixed(2)} РїРѕСЂС†РёРё</div>}
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
    <div style={{ fontSize:12, fontWeight:600, color:'#fff', marginBottom:6 }}>вњ€ РџРёС‚Р°РЅРёРµ РІ РґРѕСЂРѕРіРµ</div>
    {travelAdvice.length > 0 ? travelAdvice.map((a, i) => <div key={i} style={{ fontSize:9, color:'#fff', marginBottom:4 }}>{a}</div>) : <div style={{ fontSize:10, color:'rgba(255,255,255,0.8)', padding:10 }}>РќРµС‚ СЃРѕС…СЂР°РЅС‘РЅРЅС‹С… СЃРѕРІРµС‚РѕРІ.</div>}
    <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginTop:6 }}>
      рџҐњ Р‘РµСЂРёС‚Рµ СЃ СЃРѕР±РѕР№: РѕСЂРµС…Рё, РїСЂРѕС‚РµРёРЅРѕРІС‹Рµ Р±Р°С‚РѕРЅС‡РёРєРё, СЃСѓС…РѕС„СЂСѓРєС‚С‹<br />
      рџЌ— Р’ СЂРµСЃС‚РѕСЂР°РЅРµ: РІС‹Р±РёСЂР°Р№С‚Рµ Р±РµР»РєРѕРІСѓСЋ РѕСЃРЅРѕРІСѓ, РїСЂРѕСЃРёС‚Рµ СЃРѕСѓСЃ РѕС‚РґРµР»СЊРЅРѕ<br />
      рџ’§ Р’ СЃР°РјРѕР»С‘С‚Рµ: РїРµР№С‚Рµ Р±РѕР»СЊС€Рµ РІРѕРґС‹, РѕРіСЂР°РЅРёС‡СЊС‚Рµ Р°Р»РєРѕРіРѕР»СЊ
    </div>
  </>);
};

const SleepGuide: React.FC = () => {
  const sleepStacks = useMemo(() => { try { return JSON.parse(localStorage.getItem('sleep_stacks') || '[]'); } catch { return []; } }, []);
  return (<>
    <div style={{ fontSize:12, fontWeight:600, color:'#fff', marginBottom:6 }}>рџ’¤ РЎРѕРЅ Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ</div>
    {sleepStacks.length > 0 ? sleepStacks.map((s: any, i: number) => <div key={i} style={{ fontSize:9, color:'#fff', marginBottom:4 }}>{s}</div>) : <div style={{ fontSize:10, color:'rgba(255,255,255,0.8)', padding:10 }}>РќРµС‚ СЃРѕС…СЂР°РЅС‘РЅРЅС‹С… СЃС‚РµРєРѕРІ.</div>}
    <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginTop:6 }}>
      рџЊ™ РџРѕСЃР»РµРґРЅРёР№ РїСЂРёС‘Рј Р·Р° 2-3 С‡ РґРѕ СЃРЅР°<br />
      рџҐ› РљР°Р·РµРёРЅ/С‚РІРѕСЂРѕРі 30Рі РЅР° РЅРѕС‡СЊ в†“ РєР°С‚Р°Р±РѕР»РёР·Рј<br />
      рџ§ РњР°РіРЅРёР№ 400-600 РјРі + РіР»РёС†РёРЅР°С‚ СѓР»СѓС‡С€Р°СЋС‚ РєР°С‡РµСЃС‚РІРѕ СЃРЅР°
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
  const dayNames = ['РџРЅ','Р’С‚','РЎСЂ','Р§С‚','РџС‚','РЎР±','Р’СЃ'];
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
      {reportBtn(curTab === 'overview', () => setReportSubTab('overview'), 'рџ“Љ РћР±Р·РѕСЂ')}
      {reportBtn(curTab === 'full', () => setReportSubTab('full'), 'рџ“‹ РџРѕР»РЅС‹Р№ РѕС‚С‡С‘С‚')}
      {reportBtn(curTab === 'archive', () => setReportSubTab('archive'), 'рџ—„ РђСЂС…РёРІ')}
    </div>
  );

  return (<div style={{ display:'flex', flexDirection:'column', gap:8 }}>
    {reportSubTab === 'full' && (<div style={{ padding:14, ...cardBg }}>
      {tabButtons}
      <div style={labelSec}>рџ“‹ РџРѕР»РЅС‹Р№ РѕС‚С‡С‘С‚ Рѕ РїРёС‚Р°РЅРёРё</div>
      {data.length === 0 ? (
        <div style={{ textAlign:'center', padding:20, color:'rgba(255,255,255,0.7)', fontSize:10 }}>
          РќРµС‚ РґР°РЅРЅС‹С… Р·Р° РІС‹Р±СЂР°РЅРЅС‹Р№ РїРµСЂРёРѕРґ. Р’РЅРѕСЃРёС‚Рµ РїСЂРёС‘РјС‹ РїРёС‰Рё РІ РґРЅРµРІРЅРёРє.
        </div>
      ) : !fullReport ? (
        <div style={{ textAlign:'center', padding:20 }}>
          <button onClick={() => {
            const meals = reportMode === 'day' && dayData ? Object.entries(dayData.meals||{}).map(([label, items]:[string,any]) => ({
              label, items: (items||[]).map((i:any) => ({ name: i.name, id: i.id || '', amount: i.amount || 100, kcal: i.kcal||0, p: i.p||0, f: i.f||0, c: i.c||0 })),
              totals: { kcal: (items||[]).reduce((s:number,i:any)=>s+(i.kcal||0),0), p: (items||[]).reduce((s:number,i:any)=>s+(i.p||0),0), f: (items||[]).reduce((s:number,i:any)=>s+(i.f||0),0), c: (items||[]).reduce((s:number,i:any)=>s+(i.c||0),0) },
            })) : [{ label: reportMode === 'week' ? 'РќРµРґРµР»СЏ' : 'РњРµСЃСЏС†', items: data.map((i:any) => ({ name: i.name, id: i.id || '', amount: i.amount || 100, kcal: i.kcal||0, p: i.p||0, f: i.f||0, c: i.c||0 })), totals }];
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
            рџ“Љ РЎРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ РїРѕР»РЅС‹Р№ РѕС‚С‡С‘С‚
          </button>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.6)', marginTop:8 }}>РћС‚С‡С‘С‚ Р±СѓРґРµС‚ СЃРѕС…СЂР°РЅС‘РЅ РІ Р°СЂС…РёРІ Рё РїСЂРѕС„РёР»СЊ</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:'calc(100vh - 320px)', overflowY:'auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderRadius:8, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)', fontSize:10 }}>
            <span>РћС†РµРЅРєР°: <strong style={{ color: fullReport.overallGrade === 'A' ? '#00e68a' : fullReport.overallGrade === 'B' ? '#8b5cf6' : fullReport.overallGrade === 'C' ? '#f59e0b' : '#ef4444', fontSize:14 }}>{fullReport.overallGrade}</strong> вЂ” {fullReport.overallGradeLabel}</span>
            <span style={{ color:'rgba(255,255,255,0.8)', fontSize:8 }}>{fullReport.generatedAt.slice(0,10)}</span>
          </div>

          {/* KBJU % */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>рџ“Љ Р’С‹РїРѕР»РЅРµРЅРёРµ РљР‘Р–РЈ</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4 }}>
              {[{l:'РљРєР°Р»',v:fullReport.kbjuPct.kcal,c:'#00e68a'},{l:'Р‘РµР»РєРё',v:fullReport.kbjuPct.p,c:'#60a5fa'},{l:'Р–РёСЂС‹',v:fullReport.kbjuPct.f,c:'#fbbf24'},{l:'РЈРіР»РµРІРѕРґС‹',v:fullReport.kbjuPct.c,c:'#fb923c'}].map(s => (
                <div key={s.l} style={{ background:'#18181b', borderRadius:6, padding:'4px', textAlign:'center' }}>
                  <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>{s.l}</div>
                  <div style={{ fontSize:16, fontWeight:800, color: s.v >= 85 && s.v <= 115 ? '#00e68a' : s.v >= 70 ? '#f59e0b' : '#ef4444' }}>{s.v}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Weight dynamics */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>вљ–пёЏ Р”РёРЅР°РјРёРєР° РІРµСЃР°</div>
            <div style={{ display:'flex', gap:6, marginBottom:4 }}>
              <div style={{ flex:1, background:'rgba(59,130,246,0.08)', borderRadius:6, padding:'4px 6px' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Р‘Р°Р·РѕРІР°СЏ</div>
                <div style={{ fontSize:12, fontWeight:700, color: fullReport.weightDynamicsBasic.direction === 'loss' ? '#00e68a' : fullReport.weightDynamicsBasic.direction === 'gain' ? '#f59e0b' : '#fff' }}>
                  {fullReport.weightDynamicsBasic.direction === 'loss' ? 'в€’' : fullReport.weightDynamicsBasic.direction === 'gain' ? '+' : 'в€ј'}{fullReport.weightDynamicsBasic.weeklyKg} РєРі/РЅРµРґ
                </div>
              </div>
              <div style={{ flex:1, background:'rgba(139,92,246,0.08)', borderRadius:6, padding:'4px 6px' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>РЈСЃРёР»РµРЅРЅР°СЏ</div>
                <div style={{ fontSize:12, fontWeight:700, color:'#8b5cf6', display:'flex', alignItems:'center', gap:2 }}>
                  {fullReport.weightDynamicsEnhanced.weeklyKg} РєРі/РЅРµРґ
                  <span style={{ fontSize:7, color:'rgba(255,255,255,0.8)', fontWeight:400 }}>({fullReport.weightDynamicsEnhanced.confidence === 'high' ? 'вњ“' : '?'})</span>
                </div>
              </div>
            </div>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)', lineHeight:1.4 }}>{fullReport.weightDynamicsBasic.explanation}</div>
            {fullReport.weightDynamicsEnhanced.factors.length > 0 && <div style={{ fontSize:7, color:'rgba(255,255,255,0.6)', marginTop:2 }}>Р¤Р°РєС‚РѕСЂС‹: {fullReport.weightDynamicsEnhanced.factors.join('; ')}</div>}
          </div>

          {/* Micros */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>рџ§¬ РњРёРєСЂРѕРЅСѓС‚СЂРёРµРЅС‚С‹</div>
            {fullReport.microDeficiencies.length > 0 && <div style={{ fontSize:8, color:'#f59e0b', marginBottom:4 }}>вљ  {fullReport.microDeficiencies.length} РґРµС„РёС†РёС‚РѕРІ</div>}
            <div style={{ maxHeight:100, overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }}>
              {Object.entries(fullReport.micros).slice(0,15).map(([k, v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:8, padding:'1px 0', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ color:'rgba(255,255,255,0.85)' }}>{k}</span>
                  <span style={{ color: v.status === 'ok' ? '#00e68a' : v.status === 'low' ? '#f59e0b' : '#ef4444', fontWeight:600 }}>{v.actual}/{v.target} ({v.pct}%)</span>
                </div>
              ))}
            </div>
            {fullReport.microDeficiencies.length > 0 && <div style={{ fontSize:7, color:'#f59e0b', marginTop:4, lineHeight:1.4 }}>Р РµРєРѕРјРµРЅРґР°С†РёРё: {fullReport.microDeficiencies.slice(0,3).join('; ')}</div>}
          </div>

          {/* Quality */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>в­ђ РљР°С‡РµСЃС‚РІРѕ РїСЂРѕРґСѓРєС‚РѕРІ</div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ fontSize:18, fontWeight:800, color: fullReport.foodQualityScore >= 7 ? '#00e68a' : fullReport.foodQualityScore >= 5 ? '#f59e0b' : '#ef4444' }}>{fullReport.foodQualityScore}/10</div>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>РЎСЂРµРґРЅРёР№ С‚РёСЂ: {fullReport.foodQualityDetails.avgTier} В· {fullReport.foodQualityDetails.bestItems.length} Р»СѓС‡С€РёС…</div>
            </div>
          </div>

          {/* Water Balance */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>рџ’§ Р’РѕРґРЅС‹Р№ Р±Р°Р»Р°РЅСЃ</div>
            <div style={{ display:'flex', gap:4, marginBottom:2 }}>
              <div style={{ flex:1, background:'rgba(6,182,212,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Р’С‹РїРёС‚Рѕ</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.waterBalance.status === 'ok' ? '#00e68a' : fullReport.waterBalance.status === 'low' ? '#f59e0b' : '#ef4444' }}>{fullReport.waterBalance.intakeMl} РјР»</div>
              </div>
              <div style={{ flex:1, background:'rgba(6,182,212,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>РќРѕСЂРјР°</div>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{fullReport.waterBalance.targetMl} РјР»</div>
              </div>
              <div style={{ flex:1, background:'rgba(6,182,212,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>РјР»/РєРі</div>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{fullReport.waterBalance.intakePerKg}/{fullReport.waterBalance.targetPerKg}</div>
              </div>
            </div>
            {fullReport.waterBalance.deficitMl > 0 && <div style={{ fontSize:7, color:'#f59e0b' }}>Р”РµС„РёС†РёС‚ {fullReport.waterBalance.deficitMl} РјР»</div>}
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)', marginTop:2, lineHeight:1.4 }}>{fullReport.waterBalance.recommendation}</div>
          </div>

          {/* Sodium/Potassium */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>рџ§‚ РќР°С‚СЂРёР№/РљР°Р»РёР№</div>
            <div style={{ display:'flex', gap:4, marginBottom:2 }}>
              <div style={{ flex:1, background:'rgba(251,191,36,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Na</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.sodiumPotassium.status === 'high' ? '#ef4444' : '#00e68a' }}>{fullReport.sodiumPotassium.naMg} РјРі</div>
              </div>
              <div style={{ flex:1, background:'rgba(59,130,246,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>K</div>
                <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa' }}>{fullReport.sodiumPotassium.kMg} РјРі</div>
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
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>вЏ± РўР°Р№РјРёРЅРі Р±РµР»РєР°</div>
            <div style={{ display:'flex', gap:4, marginBottom:2 }}>
              <div style={{ flex:1, background:'rgba(59,130,246,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Р Р°РІРЅРѕРјРµСЂРЅРѕСЃС‚СЊ</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.proteinTiming.evennessScore >= 80 ? '#00e68a' : fullReport.proteinTiming.evennessScore >= 60 ? '#f59e0b' : '#ef4444' }}>{fullReport.proteinTiming.evennessScore}%</div>
              </div>
              <div style={{ flex:1, background:'rgba(59,130,246,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>РњР°РєСЃ СЂР°Р·СЂС‹РІ</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.proteinTiming.maxGapHours > 5 ? '#f59e0b' : '#00e68a' }}>{fullReport.proteinTiming.maxGapHours}С‡</div>
              </div>
            </div>
            {fullReport.proteinTiming.gaps.length > 0 && <div style={{ fontSize:7, color:'#f59e0b', lineHeight:1.3 }}>{fullReport.proteinTiming.gaps.slice(0, 2).join('; ')}</div>}
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)', marginTop:2, lineHeight:1.4 }}>{fullReport.proteinTiming.recommendation}</div>
          </div>

          {/* Glycemic Load */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>рџЌљ Р“Р»РёРєРµРјРёС‡РµСЃРєР°СЏ РЅР°РіСЂСѓР·РєР°</div>
            <div style={{ display:'flex', gap:4, marginBottom:2 }}>
              <div style={{ flex:1, background:'rgba(251,191,36,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>РћР±С‰Р°СЏ Р“Рќ</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.glycemicLoad.status === 'high' ? '#ef4444' : '#00e68a' }}>{fullReport.glycemicLoad.totalGL}</div>
              </div>
              <div style={{ flex:1, background:'rgba(251,191,36,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>РЎСЂРµРґРЅРёР№ GI</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.glycemicLoad.avgGI > 60 ? '#f59e0b' : '#00e68a' }}>{fullReport.glycemicLoad.avgGI}</div>
              </div>
              <div style={{ flex:1, background:'rgba(251,191,36,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>РњР°РєСЃ/РїСЂРёС‘Рј</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.glycemicLoad.maxPerMeal > 25 ? '#ef4444' : '#00e68a' }}>{fullReport.glycemicLoad.maxPerMeal}</div>
              </div>
            </div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)', lineHeight:1.4 }}>{fullReport.glycemicLoad.recommendation}</div>
          </div>

          {/* Fat Quality */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>рџҐ‘ РљР°С‡РµСЃС‚РІРѕ Р¶РёСЂРѕРІ</div>
            <div style={{ display:'flex', gap:4, marginBottom:2 }}>
              <div style={{ flex:1, background:'rgba(251,191,36,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>РќР°СЃС‹С‰.</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.fatQuality.satPct > 15 ? '#ef4444' : '#00e68a' }}>{fullReport.fatQuality.satPct}%</div>
              </div>
              <div style={{ flex:1, background:'rgba(59,130,246,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>РћРјРµРіР°-3</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.fatQuality.omega3G >= 1.6 ? '#00e68a' : '#f59e0b' }}>{fullReport.fatQuality.omega3G}Рі</div>
              </div>
              <div style={{ flex:1, background:'rgba(139,92,246,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>РћРј-6/3</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.fatQuality.omega6to3ratio > 6 ? '#ef4444' : '#00e68a' }}>{fullReport.fatQuality.omega6to3ratio}:1</div>
              </div>
            </div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)', lineHeight:1.4 }}>{fullReport.fatQuality.recommendation}</div>
          </div>

          {/* Meal Timing */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>рџ•ђ Р РµР¶РёРј РїРёС‚Р°РЅРёСЏ</div>
            <div style={{ display:'flex', gap:4, marginBottom:2, flexWrap:'wrap' }}>
              <div style={{ background:'rgba(99,102,241,0.06)', borderRadius:6, padding:'3px 6px', fontSize:8, color:'#fff' }}>РџСЂРёС‘РјРѕРІ: {fullReport.mealTiming.mealCount}</div>
              <div style={{ background:'rgba(99,102,241,0.06)', borderRadius:6, padding:'3px 6px', fontSize:8, color: fullReport.mealTiming.longestGapHours > 5 ? '#f59e0b' : '#fff' }}>Р Р°Р·СЂС‹РІ: {fullReport.mealTiming.longestGapHours}С‡</div>
              <div style={{ background: fullReport.mealTiming.hasPreWorkout ? 'rgba(0,230,138,0.1)' : 'rgba(239,68,68,0.06)', borderRadius:6, padding:'3px 6px', fontSize:8, color: fullReport.mealTiming.hasPreWorkout ? '#00e68a' : '#ef4444' }}>{fullReport.mealTiming.hasPreWorkout ? 'вњ“ РџСЂРµРґС‚СЂРµРЅ' : 'вњ• РџСЂРµРґС‚СЂРµРЅ'}</div>
              <div style={{ background: fullReport.mealTiming.hasPostWorkout ? 'rgba(0,230,138,0.1)' : 'rgba(239,68,68,0.06)', borderRadius:6, padding:'3px 6px', fontSize:8, color: fullReport.mealTiming.hasPostWorkout ? '#00e68a' : '#ef4444' }}>{fullReport.mealTiming.hasPostWorkout ? 'вњ“ РџРѕСЃС‚С‚СЂРµРЅ' : 'вњ• РџРѕСЃС‚С‚СЂРµРЅ'}</div>
            </div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)', lineHeight:1.4 }}>{fullReport.mealTiming.recommendation}</div>
          </div>

          {/* Fiber */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>рџҐ¬ РљР»РµС‚С‡Р°С‚РєР°</div>
            <div style={{ display:'flex', gap:4, alignItems:'center' }}>
              <div style={{ flex:1, background:'rgba(34,197,94,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Р¤Р°РєС‚</div>
                <div style={{ fontSize:11, fontWeight:700, color: fullReport.fiberAnalysis.status === 'ok' ? '#00e68a' : fullReport.fiberAnalysis.status === 'low' ? '#f59e0b' : '#ef4444' }}>{fullReport.fiberAnalysis.totalG}Рі</div>
              </div>
              <div style={{ flex:1, background:'rgba(34,197,94,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Р¦РµР»СЊ</div>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{fullReport.fiberAnalysis.targetG}Рі</div>
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
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>рџ¦ґ РљР°Р»СЊС†РёР№/РњР°РіРЅРёР№</div>
            <div style={{ display:'flex', gap:4, marginBottom:2 }}>
              <div style={{ flex:1, background:'rgba(168,85,247,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Ca</div>
                <div style={{ fontSize:11, fontWeight:700, color:'#a78bfa' }}>{fullReport.calciumMagnesium.caMg} РјРі</div>
              </div>
              <div style={{ flex:1, background:'rgba(168,85,247,0.06)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>Mg</div>
                <div style={{ fontSize:11, fontWeight:700, color:'#a78bfa' }}>{fullReport.calciumMagnesium.mgMg} РјРі</div>
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
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>рџ“‹ РџР°СЂР°РјРµС‚СЂС‹ СЃРѕСЃС‚Р°РІР»РµРЅРёСЏ СЂР°С†РёРѕРЅР°</div>
            {fullReport.planDecisions.map((d, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:8, padding:'2px 0', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ color:'rgba(255,255,255,0.6)' }}>{d.param}</span>
                <span style={{ color:'#fff', fontWeight:600, textAlign:'right', maxWidth:'60%' }}>{d.value}</span>
              </div>
            ))}
          </div>

          {/* Risks */}
          <div style={{ padding:'6px 10px', borderRadius:8, background:'#202023' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>вљ  РђРЅР°Р»РёР· СЂРёСЃРєРѕРІ</div>
            {fullReport.riskAnalysis.map((r, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:8, padding:'2px 0', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ color:'rgba(255,255,255,0.85)' }}>{r.system}</span>
                <span style={{ color: r.score > 4 ? '#ef4444' : r.score > 2 ? '#f59e0b' : '#00e68a', fontWeight:600 }}>{r.score}/{r.maxScore}</span>
              </div>
            ))}
          </div>

          {/* Allergens */}
          {fullReport.allergenWarnings.length > 0 && <div style={{ padding:'6px 10px', borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#ef4444', marginBottom:4 }}>рџљ« РђР»Р»РµСЂРіРµРЅС‹</div>
            {fullReport.allergenWarnings.map((w, i) => <div key={i} style={{ fontSize:8, color:'rgba(255,255,255,0.85)' }}>вЂў {w.food}: {w.allergens.join(', ')}</div>)}
          </div>}

          {/* Recommendations */}
          {fullReport.recommendations.length > 0 && <div style={{ padding:'6px 10px', borderRadius:8, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.15)' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#a855f7', marginBottom:4 }}>рџ’Ў Р РµРєРѕРјРµРЅРґР°С†РёРё</div>
            {fullReport.recommendations.map((r, i) => <div key={i} style={{ fontSize:8, color:'rgba(255,255,255,0.85)', lineHeight:1.5, marginBottom:2 }}>вЂў {r}</div>)}
          </div>}
          {/* Edit/Save buttons */}
          <div style={{ display:'flex', gap:4, marginTop:4 }}>
            <button onClick={() => { if (reportEditMode) { try { localStorage.setItem('he_nutrition_report_current', reportEditText); } catch {} }; setReportEditMode(!reportEditMode); }} style={{ flex:1, padding:'6px', borderRadius:8, cursor:'pointer', border:'1px solid rgba(96,165,250,0.3)', background: reportEditMode ? 'rgba(96,165,250,0.15)' : 'rgba(96,165,250,0.06)', color:'#60a5fa', fontSize:9, fontWeight:600 }}>
              {reportEditMode ? 'рџ’ѕ РЎРѕС…СЂР°РЅРёС‚СЊ РїСЂР°РІРєРё' : 'вњЏпёЏ Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ РѕС‚С‡С‘С‚'}
            </button>
            <button onClick={() => { try { const edited = reportEditMode ? JSON.parse(reportEditText) : fullReport; saveReportToArchive(edited); } catch(e) { alert('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ: ' + e); } }} style={{ flex:1, padding:'6px', borderRadius:8, cursor:'pointer', border:'1px solid rgba(0,230,138,0.3)', background:'rgba(0,230,138,0.06)', color:'#00e68a', fontSize:9, fontWeight:600 }}>
              рџ“Ґ РЎРѕС…СЂР°РЅРёС‚СЊ РІ Р°СЂС…РёРІ
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
      <div style={labelSec}>рџ—„ РђСЂС…РёРІ РѕС‚С‡С‘С‚РѕРІ</div>
      {archiveReports.length === 0 ? (
        <div style={{ textAlign:'center', padding:20, color:'rgba(255,255,255,0.7)', fontSize:10 }}>РќРµС‚ СЃРѕС…СЂР°РЅС‘РЅРЅС‹С… РѕС‚С‡С‘С‚РѕРІ. РЎРіРµРЅРµСЂРёСЂСѓР№С‚Рµ РїРѕР»РЅС‹Р№ РѕС‚С‡С‘С‚.</div>
      ) : (
        <div style={{ maxHeight:400, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
          {archiveReports.map((rep, idx) => (
            <div key={idx} style={{ padding:'6px 10px', borderRadius:8, background:'#202023', border:'1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}
              onClick={() => { setFullReport(rep); setReportSubTab('full'); }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:10, fontWeight:600, color:'#fff' }}>РћС‚С‡С‘С‚ РѕС‚ {rep.generatedAt?.slice(0,10) || 'N/A'}</span>
                <span style={{ fontSize:12, fontWeight:800, color: rep.overallGrade === 'A' ? '#00e68a' : rep.overallGrade === 'B' ? '#8b5cf6' : rep.overallGrade === 'C' ? '#f59e0b' : '#ef4444' }}>{rep.overallGrade}</span>
              </div>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.6)', marginTop:2 }}>{rep.overallGradeLabel} В· РљР‘Р–РЈ {rep.kbjuPct.kcal}% В· {rep.microDeficiencies.length} РґРµС„РёС†РёС‚РѕРІ</div>
            </div>
          ))}
        </div>
      )}
      {archiveReports.length > 0 && <button onClick={() => { setArchiveReports([]); localStorage.removeItem('he_nutrition_report_archive'); }} style={{ marginTop:6, padding:'4px 8px', borderRadius:6, fontSize:8, cursor:'pointer', border:'1px solid rgba(239,68,68,0.2)', background:'rgba(239,68,68,0.06)', color:'#ef4444' }}>рџ—‘ РћС‡РёСЃС‚РёС‚СЊ Р°СЂС…РёРІ</button>}
    </div>)}

    {reportSubTab === 'overview' && (<div style={{ padding:14, ...cardBg }}>
      {tabButtons}
      <div style={labelSec}>рџ“Љ РћР±Р·РѕСЂ РїРёС‚Р°РЅРёСЏ</div>
      <div style={{ display:'flex', gap:4, marginBottom:8 }}>
        {reportBtn(reportMode === 'day', () => setReportMode('day'), 'Р”РµРЅСЊ')}
        {reportBtn(reportMode === 'week', () => setReportMode('week'), 'РќРµРґРµР»СЏ')}
        {reportBtn(reportMode === 'month', () => setReportMode('month'), 'РњРµСЃСЏС†')}
      </div>
      {reportMode === 'day' && <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} style={{ ...inputStyle, marginBottom:8 }} />}
      {/* Generate + save button */}
      <button onClick={() => {
        try {
          const report = { id: Date.now().toString(), date: new Date().toISOString().slice(0,10), kcal: Math.round(totals.kcal), protein: Math.round(totals.p), fat: Math.round(totals.f), carbs: Math.round(totals.c), items: data.length, timestamp: Date.now(), overallGrade: 'вЂ”', kbjuPct: { kcal: 0, protein: 0, fat: 0, carbs: 0 }, mealCount: data.length, dietQuality: { score: 0, label: 'вЂ”' }, risks: [], recommendations: [], plan: { days: [] } };
          const archive = JSON.parse(localStorage.getItem('he_nutrition_report_archive') || '[]');
          archive.unshift(report);
          localStorage.setItem('he_nutrition_report_archive', JSON.stringify(archive.slice(0, 20)));
        } catch {}
      }} style={{ width:'100%', padding:'8px', borderRadius:8, border:'1px solid rgba(0,230,138,0.25)', background:'rgba(0,230,138,0.06)', color:'#00e68a', cursor:'pointer', fontSize:9, fontWeight:600, marginBottom:8 }}>рџ“„ РЎРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ Рё СЃРѕС…СЂР°РЅРёС‚СЊ РѕС‚С‡С‘С‚</button>
      {reportMode === 'week' && <div style={{ display:'flex', gap:2, marginBottom:8 }}>
        {Array.from({length:7}, (_,i) => { const d = new Date(new Date(weekStart)); d.setDate(d.getDate()+i); const ds = d.toISOString().split('T')[0]; const hasData = !!raw[ds]; return <div key={i} style={{ flex:1, textAlign:'center', padding:'5px 2px', borderRadius:8, background: hasData ? 'rgba(0,230,138,0.12)' : '#202023', fontSize:8, color: hasData ? '#00e68a' : 'rgba(255,255,255,0.8)' }}>
          <div>{dayNames[i]}</div><div style={{ fontWeight:700, fontSize:11 }}>{d.getDate()}</div>
        </div>; })}
      </div>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:6, marginBottom:8 }}>
        {[{l:'РљРєР°Р»',v:Math.round(totals.kcal),c:'#00e68a'},{l:'Р‘РµР»РєРё',v:Math.round(totals.p),c:'#3b82f6'},{l:'Р–РёСЂС‹',v:Math.round(totals.f),c:'#f59e0b'},{l:'РЈРіР».',v:Math.round(totals.c),c:'#f97316'},{l:'Р•Рґ.',v:totals.count,c:'#a78bfa'}].map((s,i) => <div key={i} style={{ background:'#202023', borderRadius:8, padding:'5px', textAlign:'center' }}>
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
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)' }}>{ql.emoji} РљР°С‡РµСЃС‚РІРѕ СЂР°С†РёРѕРЅР°</div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.8)' }}>РљР»РµС‚С‡Р°С‚РєР°: {nv2.qualityBreakdown.fiber}/15 В· РњРёРєСЂРѕ: {nv2.qualityBreakdown.microDensity}/30</div>
              </div>
              <div style={{ fontSize:20, fontWeight:800, color:ql.color }}>{nv2.qualityScore}<span style={{ fontSize:10, fontWeight:400 }}>/100</span></div>
            </div>
          );
        } catch { return null; }
      })()}
      {reportMode === 'day' && Object.keys(byMeal).length > 0 && <div>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:4 }}>РџРѕ РїСЂРёС‘РјР°Рј РїРёС‰Рё:</div>
        {Object.entries(byMeal).map(([meal, vals]) => <div key={meal} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:9, color:'#fff' }}>
          <span style={{ fontWeight:600 }}>{meal}</span>
          <span style={{ color:'rgba(255,255,255,0.85)' }}>{Math.round(vals.kcal)} РєРєР°Р» | Р‘{Math.round(vals.p)} Р–{Math.round(vals.f)} РЈ{Math.round(vals.c)}</span>
        </div>)}
      </div>}
      {data.length > 0 && <div style={{ marginTop:6 }}>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:4 }}>РџСЂРѕРґСѓРєС‚С‹:</div>
        <div style={{ maxHeight:120, overflowY:'auto' }}>
          {data.map((i:any, idx:number) => <div key={idx} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', fontSize:8, color:'rgba(255,255,255,0.85)' }}>
            <span>{i.name} {i.meal ? <span style={{ color:'rgba(255,255,255,0.8)' }}>({i.meal})</span> : ''}</span>
            <span>{Math.round(i.kcal||0)}РєРєР°Р»</span>
          </div>)}
        </div>
      </div>}
    </div>)}
  </div>);
};

const InfoTab: React.FC = () => {
  const sections = [
    { title: 'рџЋЇ Р Р°СЃС‡С‘С‚ С†РµР»РµР№ РљР‘Р–РЈ', body: 'РљР°Р»СЊРєСѓР»СЏС‚РѕСЂ РёСЃРїРѕР»СЊР·СѓРµС‚ С„РѕСЂРјСѓР»Сѓ РњРёС„С„Р»РёРЅР°-РЎР°РЅ-Р–РµРѕСЂР° РґР»СЏ РѕРїСЂРµРґРµР»РµРЅРёСЏ Р±Р°Р·РѕРІРѕРіРѕ РјРµС‚Р°Р±РѕР»РёР·РјР° (BMR), СѓРјРЅРѕР¶Р°РµС‚ РЅР° РєРѕСЌС„С„РёС†РёРµРЅС‚ Р°РєС‚РёРІРЅРѕСЃС‚Рё (PAL) Рё РєРѕСЂСЂРµРєС‚РёСЂСѓРµС‚ РїРѕРґ С†РµР»СЊ: РґРµС„РёС†РёС‚ 20% РґР»СЏ РїРѕС…СѓРґРµРЅРёСЏ, РїСЂРѕС„РёС†РёС‚ 10-15% РґР»СЏ РЅР°Р±РѕСЂР° РјР°СЃСЃС‹, РїРѕРґРґРµСЂР¶Р°РЅРёРµ РЅР° СѓСЂРѕРІРЅРµ TDEE.' },
    { title: 'рџ”„ Р¦РёРєР»РёСЂРѕРІР°РЅРёРµ СѓРіР»РµРІРѕРґРѕРІ', body: 'Р§РµСЂРµРґРѕРІР°РЅРёРµ РІС‹СЃРѕРєРѕ- Рё РЅРёР·РєРѕСѓРіР»РµРІРѕРґРЅС‹С… РґРЅРµР№ РґР»СЏ СѓСЃРєРѕСЂРµРЅРёСЏ РјРµС‚Р°Р±РѕР»РёР·РјР°. Р’ С‚СЂРµРЅРёСЂРѕРІРѕС‡РЅС‹Рµ РґРЅРё вЂ” РЅРѕСЂРјР° РёР»Рё РїРѕРІС‹С€РµРЅРёРµ СѓРіР»РµРІРѕРґРѕРІ, РІ РґРЅРё РѕС‚РґС‹С…Р° вЂ” СЃРЅРёР¶РµРЅРёРµ РЅР° 30-50%. РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё РїСЂРёРІСЏР·С‹РІР°РµС‚СЃСЏ Рє РґРЅСЏРј С‚СЂРµРЅРёСЂРѕРІРѕРє РёР· РїСЂРѕС„РёР»СЏ.' },
    { title: 'вЏ± РўР°Р№РјРёРЅРі Р±РµР»РєР°', body: 'Р Р°РІРЅРѕРјРµСЂРЅРѕРµ СЂР°СЃРїСЂРµРґРµР»РµРЅРёРµ Р±РµР»РєР° (20-40Рі РЅР° РїСЂРёС‘Рј) РєР°Р¶РґС‹Рµ 3-4 С‡Р°СЃР° РґР»СЏ РјР°РєСЃРёРјР°Р»СЊРЅРѕР№ СЃС‚РёРјСѓР»СЏС†РёРё MPS (РјС‹С€РµС‡РЅРѕРіРѕ РїСЂРѕС‚РµРёРЅРѕРІРѕРіРѕ СЃРёРЅС‚РµР·Р°). РџСЂРёРѕСЂРёС‚РµС‚: РїРѕСЃР»Рµ С‚СЂРµРЅРёСЂРѕРІРєРё (Р±С‹СЃС‚СЂС‹Р№ Р±РµР»РѕРє), РїРµСЂРµРґ СЃРЅРѕРј (РєР°Р·РµРёРЅ).' },
    { title: 'рџ’‰ РРЅСЃСѓР»РёРЅРѕРІРѕРµ РїСЂР°РІРёР»Рѕ', body: '10Рі СѓРіР»РµРІРѕРґРѕРІ РЅР° 1 Р•Р” РёРЅСЃСѓР»РёРЅР° РєРѕСЂРѕС‚РєРѕРіРѕ РґРµР№СЃС‚РІРёСЏ вЂ” Р±Р°Р·РѕРІРѕРµ РїСЂР°РІРёР»Рѕ РєРѕСЂСЂРµРєС†РёРё. РђР»РіРѕСЂРёС‚Рј СѓС‡РёС‚С‹РІР°РµС‚ РіР»РёРєРµРјРёС‡РµСЃРєРёР№ РёРЅРґРµРєСЃ РїСЂРѕРґСѓРєС‚РѕРІ Рё РїРѕРґР±РёСЂР°РµС‚ РёСЃС‚РѕС‡РЅРёРєРё СѓРіР»РµРІРѕРґРѕРІ С‚Р°Рє, С‡С‚РѕР±С‹ РёР·Р±РµР¶Р°С‚СЊ СЂРµР·РєРёС… СЃРєР°С‡РєРѕРІ СЃР°С…Р°СЂР°.' },
    { title: 'рџҐ¦ РђР»РіРѕСЂРёС‚Рј РїРѕРґР±РѕСЂР° РїСЂРѕРґСѓРєС‚РѕРІ', body: '1) Р’С‹Р±РѕСЂ РєР°С‚РµРіРѕСЂРёРё РїРѕРґ С†РµР»СЊ 2) Р¤РёР»СЊС‚СЂ РїРѕ Р±СЋРґР¶РµС‚Сѓ Рё РїСЂРµРґРїРѕС‡С‚РµРЅРёСЏРј 3) РџСЂРѕРІРµСЂРєР° Р°Р»Р»РµСЂРіРµРЅРѕРІ 4) РСЃРєР»СЋС‡РµРЅРёРµ РєРѕРЅС„Р»РёРєС‚СѓСЋС‰РёС… СЃ С„Р°СЂРјР°РєРѕР»РѕРіРёРµР№ РїСЂРѕРґСѓРєС‚РѕРІ 5) Р Р°РЅРґРѕРјРёР·Р°С†РёСЏ РІ СЂР°РјРєР°С… РїСѓР»Р° РґР»СЏ СЂР°Р·РЅРѕРѕР±СЂР°Р·РёСЏ.' },
    { title: 'вљ  РўРёРїРёС‡РЅС‹Рµ РѕС€РёР±РєРё', body: 'вЂў РџСЂРѕРїСѓСЃРє СѓРіР»РµРІРѕРґРѕРІ РІ С‚СЂРµРЅРёСЂРѕРІРѕС‡РЅС‹Р№ РґРµРЅСЊ\nвЂў РќРµРґРѕСЃС‚Р°С‚РѕРє Р¶РёСЂРѕРІ (РЅРёР¶Рµ 0.8Рі/РєРі)\nвЂў РЎР»РёС€РєРѕРј Р±С‹СЃС‚СЂС‹Р№ РґРµС„РёС†РёС‚ (>30% РѕС‚ TDEE)\nвЂў РРіРЅРѕСЂРёСЂРѕРІР°РЅРёРµ РєР»РµС‚С‡Р°С‚РєРё (РЅСѓР¶РЅРѕ 25-35Рі/РґРµРЅСЊ)\nвЂў РћРґРЅРѕРѕР±СЂР°Р·РЅС‹Р№ СЂР°С†РёРѕРЅ (РґРµС„РёС†РёС‚ РјРёРєСЂРѕРЅСѓС‚СЂРёРµРЅС‚РѕРІ)' },
    { title: 'рџ›’ РљРѕСЂР·РёРЅР° СЃ РјР°РіР°Р·РёРЅР°РјРё', body: 'РџРѕРґРґРµСЂР¶РєР° РЅРµСЃРєРѕР»СЊРєРёС… РјР°РіР°Р·РёРЅРѕРІ: РґРѕР±Р°РІР»СЏР№С‚Рµ, РїРµСЂРµРёРјРµРЅРѕРІС‹РІР°Р№С‚Рµ, СѓРґР°Р»СЏР№С‚Рµ СЃРїРёСЃРєРё РїРѕРєСѓРїРѕРє. РС‚РѕРіРѕРІР°СЏ СЃСѓРјРјР° Рё РєР°Р»РѕСЂРёР№РЅРѕСЃС‚СЊ РїРѕ РјР°РіР°Р·РёРЅСѓ. РђРєС‚РёРІРЅС‹Р№ РјР°РіР°Р·РёРЅ СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РјРµР¶РґСѓ СЃРµСЃСЃРёСЏРјРё.' },
    { title: 'рџЋљ РљРѕРЅС‚СЂРѕР»СЊ СЂР°Р·РЅРѕРѕР±СЂР°Р·РёСЏ', body: 'РўСЂРё СЂРµР¶РёРјР°: В«РњРёРЅРёРјСѓРјВ» (2 РїСЂРѕРґСѓРєС‚Р° РЅР° РєР°С‚РµРіРѕСЂРёСЋ), В«РЎСЂРµРґРЅРёР№В» (4), В«РњР°РєСЃРёРјСѓРјВ» (РІРµСЃСЊ РїСѓР»). РџСѓР» СЃРѕСЂС‚РёСЂСѓРµС‚СЃСЏ РґРµС‚РµСЂРјРёРЅРёСЂРѕРІР°РЅРЅРѕ РїРѕ seed.' },
    { title: 'рџ©є РџСЂРѕР±Р»РµРјС‹ СЃРѕ Р·РґРѕСЂРѕРІСЊРµРј', body: '8 РїСЂРµРґСѓСЃС‚Р°РЅРѕРІР»РµРЅРЅС‹С… РїСЂРѕР±Р»РµРј: РѕС‚С‘РєРё, РЅРµРїРµСЂРµРЅРѕСЃРёРјРѕСЃС‚СЊ Р»Р°РєС‚РѕР·С‹/РіР»СЋС‚РµРЅР°, РґРёР°Р±РµС‚, РіРёРїРµСЂС‚РѕРЅРёСЏ, Р–РљРў, РїРѕРґР°РіСЂР°, РєР°РјРЅРё РІ РїРѕС‡РєР°С…. Р’С‹Р±РѕСЂ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РёСЃРєР»СЋС‡Р°РµС‚ РїСЂРѕРґСѓРєС‚С‹.' },
    { title: 'рџ“‹ РџРѕР»РЅС‹Р№ РѕС‚С‡С‘С‚ Рѕ РїРёС‚Р°РЅРёРё', body: 'Р“РµРЅРµСЂРёСЂСѓРµС‚ РґРµС‚Р°Р»СЊРЅС‹Р№ РѕС‚С‡С‘С‚: РљР‘Р–РЈ, РјРёРєСЂРѕРЅСѓС‚СЂРёРµРЅС‚С‹ vs RDA, РґРµС„РёС†РёС‚С‹, РґРёРЅР°РјРёРєР° РІРµСЃР°, РєР°С‡РµСЃС‚РІРѕ РїСЂРѕРґСѓРєС‚РѕРІ, СЂРёСЃРєРё, Р°Р»Р»РµСЂРіРµРЅС‹, СЂРµРєРѕРјРµРЅРґР°С†РёРё, РёС‚РѕРіРѕРІР°СЏ РѕС†РµРЅРєР° A/B/C/D.' },
    { title: 'рџ‘ЁвЂЌрџЌі Р РµС†РµРїС‚С‹ СЃ РёРЅСЃС‚СЂСѓРєС†РёСЏРјРё', body: '60 СЂРµС†РµРїС‚РѕРІ СЃ РїРѕС€Р°РіРѕРІС‹РјРё РёРЅСЃС‚СЂСѓРєС†РёСЏРјРё, РІСЂРµРјРµРЅРµРј РїСЂРёРіРѕС‚РѕРІР»РµРЅРёСЏ, С‚РµРіР°РјРё Рё С‚РёРїРѕРј РїСЂРёС‘РјР° РїРёС‰Рё. Р¤РёР»СЊС‚СЂ РїРѕ С‚РёРїСѓ Рё РїРѕРёСЃРє.' },
    { title: 'вљЎ Р‘С‹СЃС‚СЂС‹Рµ РїСЂРµСЃРµС‚С‹', body: 'Р“РѕС‚РѕРІС‹Рµ РЅР°Р±РѕСЂС‹ РЅР°СЃС‚СЂРѕРµРє: РјСЏСЃРЅРѕР№, РІРµРіРµС‚Р°СЂРёР°РЅСЃРєРёР№, СЃСЂРµРґРёР·РµРјРЅРѕРјРѕСЂСЃРєРёР№, РєРµС‚Рѕ, High Carb, Р±СЋРґР¶РµС‚РЅС‹Р№, РјР°СЃСЃРѕРЅР°Р±РѕСЂРЅС‹Р№, Р¶РёСЂРѕСЃР¶РёРіР°СЋС‰РёР№.' },
    // РќРћР’РћР•:
    { title: 'рџ§¬ v2 РЎРєРѕСЂРёРЅРі РїСЂРѕРґСѓРєС‚РѕРІ (BB Quality + Overall Dietary)', body: 'РќРѕРІС‹Р№ РґРІРёР¶РѕРє РѕС†РµРЅРєРё РїСЂРѕРґСѓРєС‚РѕРІ: BB Quality Score (1-10) вЂ” СЃС‚Р°С‚РёС‡РµСЃРєРёР№ СЂРµР№С‚РёРЅРі РєР°С‡РµСЃС‚РІР° РґР»СЏ Р±РѕРґРёР±РёР»РґРёРЅРіР° РЅР° РѕСЃРЅРѕРІРµ РјР°РєСЂРѕРЅСѓС‚СЂРёРµРЅС‚РѕРІ, Р°РјРёРЅРѕРєРёСЃР»РѕС‚, РєР»РµС‚С‡Р°С‚РєРё. Overall Dietary Score вЂ” РґРёРЅР°РјРёС‡РµСЃРєРёР№ СЂРµР№С‚РёРЅРі СЃ СѓС‡С‘С‚РѕРј С„Р°Р·С‹ (РЅР°Р±РѕСЂ/СЃСѓС€РєР°/РџРљРў/РјРѕСЃС‚), С„Р°СЂРјР°РєРѕР»РѕРіРёРё (РђРђРЎ, РёРЅСЃСѓР»РёРЅ, HGH, РґРёСѓСЂРµС‚РёРєРё), Р°РЅР°Р»РёР·РѕРІ РєСЂРѕРІРё (РіРµРјР°С‚РѕРєСЂРёС‚, Р»РёРїРёРґС‹, РїРµС‡РµРЅСЊ, CRP, HOMA-IR) Рё С‚Р°Р№РјРёРЅРіР° РїСЂРёС‘РјР°. Р’РєР»СЋС‡РёС‚Рµ РІ вљ™пёЏ РџР°СЂР°РјРµС‚СЂС‹ в†’ РІРєР»Р°РґРєР° v2.' },
    { title: 'рџ“Љ DailyDietDashboard', body: 'РџР°РЅРµР»СЊ Р°РЅР°Р»РёР·Р° СЃСѓС‚РѕС‡РЅРѕРіРѕ СЂР°С†РёРѕРЅР° РІ РїР»Р°РЅРёСЂРѕРІС‰РёРєРµ: 7 РїСЂРѕРіСЂРµСЃСЃ-Р±Р°СЂРѕРІ (mTOR, Р–РљРў-РЅР°РіСЂСѓР·РєР°, PRAL, РђРјРјРёР°Рє-СЂРёСЃРє, РћРјРµРіР°-Р±Р°Р»Р°РЅСЃ, Р­Р»РµРєС‚СЂРѕР»РёС‚С‹, РРЅСЃСѓР»РёРЅ-СЂРёСЃРє). РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРёРµ РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёСЏ: РґРµС„РёС†РёС‚ Р»РµР№С†РёРЅР°, СЂРёСЃРє РіРёРїРѕРіР»РёРєРµРјРёРё, РЅРµС…РІР°С‚РєР° РјРёРєСЂРѕРЅСѓС‚СЂРёРµРЅС‚РѕРІ.' },
    { title: 'рџ©є РђРЅР°Р»РёС‚РёРєР° Р·РґРѕСЂРѕРІСЊСЏ', body: 'Р’РєР»Р°РґРєР° В«Р—РґРѕСЂРѕРІСЊРµВ»: РІРІРѕРґ Р°РЅР°Р»РёР·РѕРІ РєСЂРѕРІРё (12 РјР°СЂРєРµСЂРѕРІ) СЃ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕР№ С†РІРµС‚РѕРІРѕР№ РёРЅРґРёРєР°С†РёРµР№ (Р·РµР»С‘РЅС‹Р№/Р¶С‘Р»С‚С‹Р№/РєСЂР°СЃРЅС‹Р№). РўРµРєСЃС‚РѕРІС‹Рµ РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёСЏ Рё СЂРµРєРѕРјРµРЅРґР°С†РёРё РїСЂРё РѕС‚РєР»РѕРЅРµРЅРёСЏС…. РљР°СЂС‚Р° РґРµС„РёС†РёС‚РѕРІ РјРёРєСЂРѕРЅСѓС‚СЂРёРµРЅС‚РѕРІ (С†РёРЅРє, РјР°РіРЅРёР№, Р¶РµР»РµР·Рѕ, РєР°Р»СЊС†РёР№, D, B12, РѕРјРµРіР°-3, Р№РѕРґ). РљРЅРѕРїРєР° В«РћРїС‚РёРјРёР·РёСЂРѕРІР°С‚СЊ РєР°С‚Р°Р»РѕРіВ» вЂ” СЃРєСЂС‹С‚СЊ РїСЂРѕРґСѓРєС‚С‹ СЃ СЂРµР№С‚РёРЅРіРѕРј <4.0.' },
    { title: 'рџ“€ РўСЂРµРєРµСЂ РїСЂРѕРіСЂРµСЃСЃР°', body: 'Р’РєР»Р°РґРєР° В«РџСЂРѕРіСЂРµСЃСЃВ»: РµР¶РµРґРЅРµРІРЅС‹Р№ РІРІРѕРґ РІРµСЃР° Рё %Р¶РёСЂР°. Р“СЂР°С„РёРє РґРёРЅР°РјРёРєРё РІРµСЃР° СЃ С†РІРµС‚РѕРІРѕР№ РёРЅРґРёРєР°С†РёРµР№ (Р·РµР»С‘РЅС‹Р№ вЂ” СЃРЅРёР¶РµРЅРёРµ, РєСЂР°СЃРЅС‹Р№ вЂ” РїРѕРІС‹С€РµРЅРёРµ). РЎС‚Р°СЂС‚/С‚РµРєСѓС‰РёР№ РІРµСЃ Рё РґРµР»СЊС‚Р°. Р’ РїР»Р°РЅР°С…: РіСЂР°С„РёРєРё Р°РЅР°Р»РёР·РѕРІ РєСЂРѕРІРё Рё В«СѓРјРЅС‹С…В» РїРѕРєР°Р·Р°С‚РµР»РµР№ (Р°РјРјРёР°Рє, РѕРјРµРіР°, Р–РљРў, РјРёРєСЂРѕРЅСѓС‚СЂРёРµРЅС‚С‹).' },
    { title: 'рџ§‘вЂЌвљ•пёЏ РќСѓС‚СЂРёС†РёРѕР»РѕРі (FAQ)', body: 'Р’РєР»Р°РґРєР° В«РќСѓС‚СЂРёС†РёРѕР»РѕРіВ»: 8 РєР°СЂС‚РѕС‡РµРє-РѕС‚РІРµС‚РѕРІ РЅР° С‡Р°СЃС‚С‹Рµ РІРѕРїСЂРѕСЃС‹ (РїРѕС‡РµРјСѓ РЅРёР·РєРёР№ СЂРµР№С‚РёРЅРі, HOMA-IR, Р·Р°С‰РёС‚Р° РїРµС‡РµРЅРё, С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅ, CRP, mTOR, K/Na, СЌРЅРµСЂРіРёСЏ). Р¤РёР»СЊС‚СЂ РїРѕ С‚РµРіР°Рј. РћС‚РІРµС‚С‹ Р°РґР°РїС‚РёСЂРѕРІР°РЅС‹ РїРѕРґ РїСЂРѕС„РёР»СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.' },
    { title: 'рџ“ќ РЎРІРѕРё РїСЂРѕРґСѓРєС‚С‹', body: 'Р’РєР»Р°РґРєР° В«РЎРІРѕРёВ»: РґРѕР±Р°РІР»РµРЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёС… РїСЂРѕРґСѓРєС‚РѕРІ СЃ СѓРєР°Р·Р°РЅРёРµРј РЅР°Р·РІР°РЅРёСЏ, РљР‘Р–РЈ Рё РєР»РµС‚С‡Р°С‚РєРё. РЎРѕС…СЂР°РЅРµРЅРёРµ РІ localStorage. РџСЂРѕРґСѓРєС‚С‹ РѕС‚РѕР±СЂР°Р¶Р°СЋС‚СЃСЏ РІ СЃРїРёСЃРєРµ СЃ РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊСЋ СѓРґР°Р»РµРЅРёСЏ.' },
    { title: 'рџЌЅ Р’РёР·СѓР°Р»РёР·Р°С‚РѕСЂ Р±Р»СЋРґР°', body: 'Р’РєР»Р°РґРєР° В«Р‘Р»СЋРґРѕВ»: С†РІРµС‚РѕРІР°СЏ РіРёСЃС‚РѕРіСЂР°РјРјР° СЃРѕСЃС‚Р°РІР° Р±Р»СЋРґР° СЃ РїСЂРѕР·СЂР°С‡РЅРѕСЃС‚СЊСЋ РїРѕ BB Quality Score. РљР°Р¶РґС‹Р№ РїСЂРѕРґСѓРєС‚ вЂ” С†РІРµС‚РЅРѕР№ СЃРµРіРјРµРЅС‚ СЃ РїРѕРґРїРёСЃСЊСЋ РІРµСЃР°.' },
    { title: 'рџЏ† Р”РѕСЃС‚РёР¶РµРЅРёСЏ (12)', body: 'Р’РєР»Р°РґРєР° В«Р”РѕСЃС‚РёР¶РµРЅРёСЏВ»: 12 Р±РµР№РґР¶РµР№ (Р¶РµР»РµР·РЅР°СЏ РІРѕР»СЏ, Р±РёРѕС…РёРјРёРє, mTOR-РјР°СЃС‚РµСЂ, РїРёРє С„РѕСЂРјС‹, РіСѓСЂРјР°РЅ, РјР°СЃС‚РµСЂ РґРµС‚РѕРєСЃР°, РѕРјРµРіР°-Р±Р°Р»Р°РЅСЃ, С‡РёСЃС‚С‹Рµ РїРѕС‡РєРё, Р°РЅС‚Рё-Р°РјРјРёР°Рє, РёРЅСЃСѓР»РёРЅРѕРІС‹Р№ РєРѕРЅС‚СЂРѕР»СЊ, РІРёС‚Р°РјРёРЅРЅС‹Р№ Р±Р°Р»Р°РЅСЃ, РєРІРµСЃС‚-РјР°СЃС‚РµСЂ). РџСЂРѕРіСЂРµСЃСЃ-Р±Р°СЂ РѕР±С‰РµРіРѕ РІС‹РїРѕР»РЅРµРЅРёСЏ.' },
    { title: 'рџЋЇ Р•Р¶РµРґРЅРµРІРЅС‹Рµ РєРІРµСЃС‚С‹', body: 'Р’РєР»Р°РґРєР° В«РљРІРµСЃС‚С‹В»: 8 РєРІРµСЃС‚РѕРІ (Р±РµР»РѕРє 2.5Рі/РєРі, РєР»РµС‚С‡Р°С‚РєР° 30Рі, РѕРјРµРіР°-Р±Р°Р»Р°РЅСЃ, РґРµС‚РѕРєСЃ, С„РµСЂРјРµРЅС‚С‹, РёР·Р±РµРіР°С‚СЊ Р°С‚РµСЂРѕРіРµРЅРЅРѕСЃС‚Рё, С…СЂРѕРј/Р±РµСЂР±РµСЂРёРЅ, Р№РѕРґ 100РјРєРі). РљРІРµСЃС‚ РґРЅСЏ +10 Р±Р°Р»Р»РѕРІ. РЎРёСЃС‚РµРјР° Р±Р°Р»Р»РѕРІ СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РІ localStorage.' },
  ];
  return (<div style={{ display:'flex', flexDirection:'column', gap:8 }}>
    <div style={{ padding:14, ...cardBg }}>
      <div style={labelSec}>в„№пёЏ РљР°Рє СЂР°Р±РѕС‚Р°РµС‚ РїСЂРёР»РѕР¶РµРЅРёРµ</div>
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
      case 'charts': return <InfoErrorBoundary label="Р“СЂР°С„РёРєРё"><Suspense fallback={<div style={{padding:20,textAlign:'center',color:'var(--text-dim)',fontSize:11}}>Р—Р°РіСЂСѓР·РєР° РіСЂР°С„РёРєРѕРІ...</div>}><NutritionCharts kcalData={chartKcalData} proteinData={chartProteinData} labels={chartLabels} dailyLogs={dailyLogs} /></Suspense></InfoErrorBoundary>;
      case 'mealplan': return <InfoErrorBoundary label="План питания"><IndividualPlan profile={linked.profile} course={linked.course} /></InfoErrorBoundary>;
      case 'cart': return <CartTab />;
      case 'restaurant': return <RestaurantTab />;
      case 'favorites': return <FavoritesTab />;
      case 'catalog': return <CatalogTab />;
      case 'reference': return <ReferenceTab />;
      case 'recipes': return <RecipesTab />;
      case 'reports': return <InfoErrorBoundary label="РћС‚С‡С‘С‚С‹"><ReportsTab foodEntries={foodEntries} profile={linked.profile} targets={macroTargets} /></InfoErrorBoundary>;
      case 'customfood': return <InfoErrorBoundary label="РЎРІРѕРё РїСЂРѕРґСѓРєС‚С‹"><NutritionCustomFood /></InfoErrorBoundary>;
      case 'overview': return <InfoErrorBoundary label="РћР±Р·РѕСЂ"><NutritionOverview
        profile={linked.profile}
        avgWeeklyKcal={avgWeeklyKcal}
        avgWeeklyProtein={avgWeeklyProtein}
        avgWeeklyFat={avgWeeklyFat}
        avgWeeklyCarbs={avgWeeklyCarbs}
      /></InfoErrorBoundary>;
      case 'info': return <InfoTab />;
      case 'progress': return <InfoErrorBoundary label="РџСЂРѕРіСЂРµСЃСЃ"><ProgressTracker /></InfoErrorBoundary>;
      case 'nutria': return <InfoErrorBoundary label="РќСѓС‚СЂРёС†РёРѕР»РѕРі"><NutriAdvisor /></InfoErrorBoundary>;
      case 'visualize': return <InfoErrorBoundary label="Р‘Р»СЋРґРѕ"><MealVisualizer items={[]} /></InfoErrorBoundary>;
      case 'achievements': return <InfoErrorBoundary label="Р”РѕСЃС‚РёР¶РµРЅРёСЏ"><Achievements /></InfoErrorBoundary>;
      case 'quests': return <InfoErrorBoundary label="РљРІРµСЃС‚С‹"><DailyQuests /></InfoErrorBoundary>;
      case 'usefulness': return <InfoErrorBoundary label="РџРѕР»РµР·РЅРѕСЃС‚СЊ"><ProductUsefulnessPlanner /></InfoErrorBoundary>;
      case 'health': return <InfoErrorBoundary label="РђРЅР°Р»РёС‚РёРєР° Р·РґРѕСЂРѕРІСЊСЏ"><HealthAnalytics /></InfoErrorBoundary>;
      default: return null;
    }
  };

  if (page === 'hero') {
    return (
      <div style={{ position:'fixed', inset:0, display:'flex', flexDirection:'column' }}>
        <img src="/nutrition-hero.jpg" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 45%, rgba(0,0,0,0.85))' }} />
        <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#fff', margin:'0 0 2px', textShadow:'0 2px 14px rgba(0,0,0,0.9)' }}>РџРёС‚Р°РЅРёРµ</h1>
          <p style={{ fontSize:11, color:'rgba(255,255,255,0.9)', margin:'0 0 14px', textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>Р РµРєРѕРјРµРЅРґР°С†РёРё Рё СЃРѕСЃС‚Р°РІР»РµРЅРёРµ СЂР°С†РёРѕРЅР° РїРѕРґ СѓРєР°Р·Р°РЅРЅС‹Рµ РїР°СЂР°РјРµС‚СЂС‹</p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { section: 'diary' as NutritionSection, tab: 'diary' as ActiveTab, icon: 'рџ“‹', title: 'Р”РЅРµРІРЅРёРє Рё Р°РЅР°Р»РёС‚РёРєР°', desc: 'Р”РЅРµРІРЅРёРє, РіСЂР°С„РёРєРё, РѕС‚С‡С‘С‚С‹', color: '#22c55e' },
              { section: 'planning' as NutritionSection, tab: 'mealplan' as ActiveTab, icon: 'рџҐ—', title: 'РџР»Р°РЅРёСЂРѕРІР°РЅРёРµ РїРёС‚Р°РЅРёСЏ', desc: 'РџР»Р°РЅ, СЃРїСЂР°РІРѕС‡РЅРёРє, РёРЅС„Рѕ', color: '#f97316' },
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
                <span style={{ color: card.color, fontSize:16, opacity:0.5 }}>в†’</span>
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
        }}>в†ђ</button>
        <div style={{ flex:1, fontSize:15, fontWeight:700, color:'#fff', letterSpacing:-0.3 }}>РџРёС‚Р°РЅРёРµ</div>
        <span style={{ fontSize:9, color:'#fff' }}>
          {nutritionSection === 'diary' ? 'Р”РЅРµРІРЅРёРє' : 'Р’СЃС‘'}
        </span>
      </div>

      {/* V2 adjustments bar вЂ” shows on mealplan tab */}
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
        if (nv2.lazyDayActive) active.push('рџ›‹ Р›РµРЅРёРІС‹Р№ РґРµРЅСЊ');
        if (nv2.cravingMode) active.push('рџЌ¬ РҐРѕС‡Сѓ СЃР»Р°РґРєРѕРµ');
        if (nv2.compensationActive) active.push(`вљ– РљРѕРјРїРµРЅСЃР°С†РёСЏ ${nv2.compensationRemaining}РєРєР°Р»`);
        if (nv2.hungryLevel > 7) active.push('рџ‹ Р’С‹СЃРѕРєРёР№ РіРѕР»РѕРґ');
        if (nv2.metabolicAdaptation > 0) active.push(`рџ“‰ РђРґР°РїС‚Р°С†РёСЏ -${Math.round(nv2.metabolicAdaptation * 100)}%`);
        if (v2Result && v2Result.adjustment !== 0) active.push(`рџ“Љ TDEE РєРѕСЂСЂ. ${v2Result.adjustment > 0 ? '+' : ''}${v2Result.adjustment}РєРєР°Р»`);
        if (s.bodyFat) active.push(`рџ§¬ %Р¶РёСЂР°: ${s.bodyFat}%`);
        // Periodization suggestions
        const metaCheck = checkMetabolicAdaptation();
        metaCheck.suggestions.forEach(sug => {
          active.push(`${sug.urgency === 'critical' ? 'рџ”ґ' : sug.urgency === 'warning' ? 'рџџЎ' : 'в„№пёЏ'} ${sug.action.slice(0, 40)}`);
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


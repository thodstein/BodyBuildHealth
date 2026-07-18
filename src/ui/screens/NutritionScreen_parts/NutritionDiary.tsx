import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { type OFFProduct, productToFoodItem } from '../../../engines/openfoodfacts.engine';
import { parseFatSecretText, parseNutritionScreenshot } from '../../../engines/nutrition-ocr-parser';
import { processUploadedFile, saveParsedMeals } from '../../../core/ocr-engine';
import { FOOD_DB } from '../../../core/nutrition-database';
import { CAT_MAP_EMOJI } from '../../../core/nutrition-utils';
import { calcMealQuality, getQualityLabel } from '../../../engines/nutrition-quality.engine';
import { NutritionQualityCard } from '../../components/NutritionQualityCard';
import { NutritionDiaryCharts } from './NutritionDiaryCharts';

type FoodItemLike = { id: string; name: string; kcal: number; protein: number; fat: number; carbs: number; fiber?: number; category?: string; tier?: string; description?: string; isVegetarian?: boolean; isGlutenFree?: boolean; isDairyFree?: boolean };

const MEAL_PRESETS = ['Завтрак', 'Второй завтрак', 'Обед', 'Полдник', 'Ужин', 'Перекус', 'До тренировки', 'После тренировки', 'Поздний перекус'];
const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

interface DiaryItem { name: string; kcal: number; p: number; f: number; c: number; qty?: number; category?: string; }

interface NutritionTargets { kcal: number; protein: number; fats: number; carbs: number; }

export const NutritionDiary: React.FC<{ foodEntries: { name: string; kcal: number; p: number; f: number; c: number }[]; targets?: NutritionTargets; weight?: number; age?: number; sex?: 'male' | 'female'; onDiaryChange?: () => void }> = ({ foodEntries, targets, weight: w, age: a, sex: s, onDiaryChange }) => {
  const weight = w || 80;
  const age = a || 30;
  const sex = s || 'male';
  const [tab, setTab] = useState<'add'|'day'>('add');
  const [showOCR, setShowOCR] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [foodSearch, setFoodSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(foodSearch), 200);
    return () => clearTimeout(t);
  }, [foodSearch]);
  const [mealType, setMealType] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [parsedItems, setParsedItems] = useState<DiaryItem[]>([]);
  const [ocrError, setOcrError] = useState('');
  const [ocrFileLoading, setOcrFileLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [customMealInput, setCustomMealInput] = useState('');
  const [showCustomMeal, setShowCustomMeal] = useState(false);
  const [customMeals, setCustomMeals] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_custom_meals') || '[]'); } catch { return []; } });
  const [usdaFoods, setUsdaFoods] = useState<FoodItemLike[]>([]);

  // Lazy-load USDA database
  useEffect(() => {
    let cancelled = false;
    // Defer loading to avoid blocking initial render (5MB data file)
    const timer = setTimeout(() => {
      import('../../../data/usda-foods').then(m => {
        if (!cancelled && m.USDA_FOODS) {
          try { setUsdaFoods(m.USDA_FOODS.slice(0, 5000)); } catch { setUsdaFoods([]); }
        }
      }).catch(() => { setUsdaFoods([]); });
    }, 800);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);
  const [diaryData, setDiaryData] = useState<any>(() => { try { return JSON.parse(localStorage.getItem('nutrition_diary') || '{}'); } catch { return {}; } });
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCustomFood, setShowCustomFood] = useState(false);
  const [customFoodName, setCustomFoodName] = useState('');
  const [customFoodKcal, setCustomFoodKcal] = useState('100');
  const [customFoodP, setCustomFoodP] = useState('10');
  const [customFoodF, setCustomFoodF] = useState('5');
  const [customFoodC, setCustomFoodC] = useState('10');
  const [editItem, setEditItem] = useState<{ meal: string; idx: number; item: any } | null>(null);
  const [editQty, setEditQty] = useState(100);
  const [copySource, setCopySource] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mealPresets, setMealPresets] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('he_meal_presets') || '[]'); } catch { return []; } });
  // Bug 27: Food patterns & triggers
  const [foodPatterns, setFoodPatterns] = useState<Record<string, string[]>>(() => { try { return JSON.parse(localStorage.getItem('he_food_patterns') || '{}'); } catch { return {}; } });
  const [foodTriggers, setFoodTriggers] = useState<Record<string, string[]>>(() => { try { return JSON.parse(localStorage.getItem('he_food_triggers') || '{}'); } catch { return {}; } });
  const [mealMood, setMealMood] = useState<Record<string, { satiety: number; enjoyment: number; note: string }>>(() => { try { return JSON.parse(localStorage.getItem('he_meal_mood') || '{}'); } catch { return {}; } });
  const saveMealMood = (date: string, mood: { satiety: number; enjoyment: number; note: string }) => {
    const upd = { ...mealMood, [date]: mood };
    setMealMood(upd);
    safeSet('he_meal_mood', upd);
  };
  const savePatterns = (date: string, patterns: string[]) => {
    const upd = { ...foodPatterns, [date]: patterns };
    setFoodPatterns(upd);
    safeSet('he_food_patterns', upd);
  };
  const saveTriggers = (date: string, triggers: string[]) => {
    const upd = { ...foodTriggers, [date]: triggers };
    setFoodTriggers(upd);
    safeSet('he_food_triggers', upd);
  };
  const ocrFileRef = useRef<HTMLInputElement>(null);
  const ocrCameraRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000); };
  const safeSet = (key: string, data: any) => { try { localStorage.setItem(key, JSON.stringify(data)); } catch {} };

  useEffect(() => { try { setDiaryData(JSON.parse(localStorage.getItem('nutrition_diary') || '{}')); } catch {} }, [refreshKey]);
  const saveDiary = (data: any) => { safeSet('nutrition_diary', data); setDiaryData(data); setRefreshKey(k => k+1); onDiaryChange?.(); };
  const addCustomMeal = () => { const name = customMealInput.trim(); if (!name || customMeals.includes(name)) return; const updated = [...customMeals, name]; setCustomMeals(updated); safeSet('he_custom_meals', updated); setCustomMealInput(''); setShowCustomMeal(false); showToast('✅ Приём добавлен'); };

  const allMealTypes = [...MEAL_PRESETS, ...customMeals];

  // Auto-select first meal type if none selected
  useEffect(() => { if (!mealType && allMealTypes.length > 0) setMealType(allMealTypes[0]); }, [tab]);

  const foodSearchResults = useMemo(() => {
    if (!debouncedSearch.trim()) return [];
    const q = debouncedSearch.toLowerCase();
    const internal = FOOD_DB.filter((f: any) => (f.name||'').toLowerCase().indexOf(q) >= 0);
    const usda = usdaFoods.filter((f: any) => (f.name||'').toLowerCase().indexOf(q) >= 0 || (f.description||'').toLowerCase().indexOf(q) >= 0);
    return [...internal.slice(0, 5), ...usda.slice(0, 10)].slice(0, 15);
  }, [debouncedSearch, usdaFoods]);

  const addFoodFromDB = (food: FoodItemLike) => {
    setParsedItems(prev => [...prev, { name: food.name, kcal: food.kcal, p: food.protein, f: food.fat, c: food.carbs, qty: 100, category: food.category || 'other' }]);
    setFoodSearch('');
    try { const favs = JSON.parse(localStorage.getItem('he_food_favs') || '[]'); const updated = [food.id, ...favs.filter((f: string) => f !== food.id)].slice(0, 12); localStorage.setItem('he_food_favs', JSON.stringify(updated)); } catch {}
  };

  const favoriteFoods = useMemo(() => { try { const favs: string[] = JSON.parse(localStorage.getItem('he_food_favs') || '[]'); return favs.map(id => FOOD_DB.find(f => f.id === id)).filter(Boolean) as typeof FOOD_DB; } catch { return []; } }, [refreshKey]);

  const handleBarcodeProduct = (product: OFFProduct) => { setShowBarcode(false); const item = productToFoodItem(product); setParsedItems(prev => [...prev, { name: item.name, kcal: item.kcal, p: item.protein, f: item.fat, c: item.carbs, qty: 100 }]); };

  const handleOcrFileUpload = async (file: File) => { setOcrFileLoading(true); setOcrError(''); try { const result = await processUploadedFile(file); if (result.meals.length > 0) { const converted = result.meals.flatMap(m => m.items.map(item => ({ name: item.name || m.mealType || 'Блюдо', kcal: Math.round(item.kcal) || 0, p: Math.round((item.p || 0)*10)/10, f: Math.round((item.f || 0)*10)/10, c: Math.round((item.c || 0)*10)/10, qty: 100 }))); setParsedItems(prev => [...prev, ...converted]); } if (result.meals.length === 0 && result.labs.length === 0) setOcrError('Не удалось распознать данные питания.'); } catch (e) { setOcrError('Ошибка: ' + (e instanceof Error ? e.message : String(e))); } setOcrFileLoading(false); };

  const handleOCR = () => { if (!ocrText.trim()) return; setOcrError(''); try { let items = parseFatSecretText(ocrText); if (items.length === 0) items = parseNutritionScreenshot(ocrText); const converted = items.flatMap(m => m.items.map(item => ({ name: item.name || m.mealType || '', kcal: Math.round(item.kcal) || 0, p: Math.round((item.p || 0)*10)/10, f: Math.round((item.f || 0)*10)/10, c: Math.round((item.c || 0)*10)/10, qty: 100 }))); setParsedItems(converted); } catch (e) { setOcrError('' + (e instanceof Error ? e.message : String(e))); } };

  const saveItemsToDiary = (items: DiaryItem[]) => {
    if (items.length === 0) return;
    const data = { ...diaryData };
    if (!data[selectedDate]) data[selectedDate] = { meals: {} };
    const mt = mealType || 'Приём пищи';
    if (!data[selectedDate].meals[mt]) data[selectedDate].meals[mt] = [];
    items.forEach(item => {
      const q = item.qty || 100;
      data[selectedDate].meals[mt].push({
        name: item.name, qty: `${q} г`, kcal: Math.round(item.kcal * q / 100),
        p: Math.round((item.p * q / 100) * 10) / 10,
        f: Math.round((item.f * q / 100) * 10) / 10,
        c: Math.round((item.c * q / 100) * 10) / 10,
        category: item.category,
      });
    });
    saveDiary(data);
    setParsedItems([]);
    setOcrText('');
    showToast(`✅ ${items.length} позиций → ${mt}`);
  };

  const deleteItem = (mealName: string, idx: number) => {
    const data = { ...diaryData };
    if (!data[selectedDate]?.meals?.[mealName]) return;
    data[selectedDate].meals[mealName] = data[selectedDate].meals[mealName].filter((_: any, i: number) => i !== idx);
    if (data[selectedDate].meals[mealName].length === 0) delete data[selectedDate].meals[mealName];
    if (Object.keys(data[selectedDate].meals).length === 0) delete data[selectedDate];
    saveDiary(data);
    showToast('🗑 Удалено');
  };

  const clearDay = () => { if (!diaryData[selectedDate]) return; const data = { ...diaryData }; delete data[selectedDate]; saveDiary(data); showToast('🗑 День очищен'); };

  const openEdit = (meal: string, idx: number, item: any) => { setEditItem({ meal, idx, item }); const match = item.qty?.match(/(\d+)/); setEditQty(match ? +match[1] : 100); };
  const saveEdit = () => {
    if (!editItem) return;
    const data = { ...diaryData };
    if (!data[selectedDate]?.meals?.[editItem.meal]) return;
    const item = data[selectedDate].meals[editItem.meal][editItem.idx];
    const ratio = editQty / 100;
    const origItem = FOOD_DB.find(f => f.name === item.name);
    if (origItem) {
      item.qty = `${editQty} г`; item.kcal = Math.round(origItem.kcal * ratio); item.p = Math.round(origItem.protein * ratio * 10) / 10;
      item.f = Math.round(origItem.fat * ratio * 10) / 10; item.c = Math.round(origItem.carbs * ratio * 10) / 10;
    } else { item.qty = `${editQty} г`; }
    saveDiary(data); setEditItem(null); showToast('✅ Количество обновлено');
  };

  const copyMeal = (meal: string) => { setCopySource(meal); showToast(`📋 «${meal}» скопирован. Выберите день для вставки.`); };
  const pasteMeal = (targetDate: string) => {
    if (!copySource || !diaryData[selectedDate]?.meals?.[copySource]) return;
    const data = { ...diaryData };
    if (!data[targetDate]) data[targetDate] = { meals: {} };
    data[targetDate].meals[copySource] = JSON.parse(JSON.stringify(diaryData[selectedDate].meals[copySource]));
    saveDiary(data); setCopySource(null); showToast(`✅ Вставлено в ${targetDate}`);
  };

  const addCustomFood = () => {
    const name = customFoodName.trim();
    if (!name) return;
    setParsedItems(prev => [...prev, { name, kcal: Math.round(+customFoodKcal || 0), p: Math.round((+customFoodP || 0)*10)/10, f: Math.round((+customFoodF || 0)*10)/10, c: Math.round((+customFoodC || 0)*10)/10, qty: 100 }]);
    setCustomFoodName(''); setCustomFoodKcal('100'); setCustomFoodP('10'); setCustomFoodF('5'); setCustomFoodC('10'); setShowCustomFood(false);
  };

  const weekStart = useMemo(() => { const d = new Date(selectedDate); const day = d.getDay(); d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); return d; }, [selectedDate]);
  const weekDays = useMemo(() => Array.from({length:7}, (_,i) => { const d = new Date(weekStart); d.setDate(d.getDate()+i); return d.toISOString().split('T')[0]; }), [weekStart]);
  const dayMeals = diaryData[selectedDate]?.meals || {};

  const dayTotals = useMemo(() => {
    try {
      const items = Object.values(dayMeals).filter(Array.isArray).flat().filter((i:any) => i && typeof i === 'object');
      const kcal = items.reduce((s: number, i: any) => s + (i.kcal || 0), 0);
      const p = items.reduce((s: number, i: any) => s + (i.p || 0), 0);
      const f = items.reduce((s: number, i: any) => s + (i.f || 0), 0);
      const c = items.reduce((s: number, i: any) => s + (i.c || 0), 0);
      return { kcal, p, f, c };
    } catch { return { kcal:0, p:0, f:0, c:0 }; }
  }, [dayMeals, refreshKey]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {toast && <div style={{ position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)', zIndex:999, padding:'10px 24px', borderRadius:14, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', boxShadow:'0 4px 20px rgba(0,0,0,0.3)', color:'#fff', fontSize:11, fontWeight:600, letterSpacing:'-0.1px' }}>{toast}</div>}

      <div style={{ padding:12, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'flex', gap:2, marginBottom:6 }}>
          {weekDays.map((ds, i) => {
            const isToday = ds === new Date().toISOString().split('T')[0];
            const isSelected = ds === selectedDate;
            const hasData = !!diaryData[ds];
            return (
              <div key={i} onClick={() => setSelectedDate(ds)} style={{
                flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'6px 0', borderRadius:12, cursor:'pointer',
                background: isSelected ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : 'transparent',
                color: isSelected ? '#000' : 'rgba(255,255,255,0.6)', fontWeight: isSelected ? 800 : 500,
                transition:'all 0.15s',
                border: isSelected ? '2px solid #00e68a' : '1px solid transparent',
              }}>
                <span style={{ fontSize:14, fontWeight:700, color: isToday ? '#00e68a' : isSelected ? '#fff' : 'rgba(255,255,255,0.8)', marginTop:1 }}>{new Date(ds).getDate()}</span>
                {hasData && <div style={{ width:5, height:5, borderRadius:'50%', background:'#00e68a', marginTop:2 }} />}
              </div>
            );
          })}
        </div>
        {copySource && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 8px', borderRadius:8, background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', fontSize:9, color:'#8b5cf6' }}>
            <span>📋 Вставить «{copySource}» →</span>
            <div style={{ display:'flex', gap:4 }}>
              <button onClick={() => pasteMeal(selectedDate)} style={{ padding:'3px 8px', borderRadius:6, border:'none', cursor:'pointer', background:'rgba(139,92,246,0.2)', color:'#8b5cf6', fontSize:8, fontWeight:600 }}>Сюда</button>
              <button onClick={() => setCopySource(null)} style={{ padding:'3px 8px', borderRadius:6, border:'none', cursor:'pointer', background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.85)', fontSize:8 }}>✕</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display:'flex', gap:3, padding:'2px 0' }}>
        {(['add','day'] as const).map(t => <button key={t} onClick={() => setTab(t)} style={{
          flex:1, padding:'7px', borderRadius:10, cursor:'pointer', fontSize:10, fontWeight: tab===t ? 800 : 500,
          border: tab===t ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
          background: tab===t ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : '#202023',
          color: tab===t ? '#000' : 'rgba(255,255,255,0.6)',
        }}>{t === 'add' ? '➕ Добавить' : '📋 День'}</button>)}
      </div>

      {/* Today's KBJU summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4 }}>
        {[
          { l:'Ккал', v:Math.round(dayTotals.kcal), t:targets?.kcal || 2500, u:'', c:'#00e68a', icon:'🔥', bg:'rgba(0,230,138,0.08)', border:'rgba(0,230,138,0.15)' },
          { l:'Белки', v:Math.round(dayTotals.p), t:targets?.protein || 160, u:'г', c:'#3b82f6', icon:'🥩', bg:'rgba(59,130,246,0.08)', border:'rgba(59,130,246,0.15)' },
          { l:'Жиры', v:Math.round(dayTotals.f), t:targets?.fats || 70, u:'г', c:'#f59e0b', icon:'🧈', bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.15)' },
          { l:'Углев.', v:Math.round(dayTotals.c), t:targets?.carbs || 300, u:'г', c:'#f97316', icon:'🍞', bg:'rgba(249,115,22,0.08)', border:'rgba(249,115,22,0.15)' },
        ].map(m => {
          const pct = m.t > 0 ? Math.min(100, Math.round(m.v / m.t * 100)) : 0;
          return (
            <div key={m.l} style={{ padding:'8px 6px', borderRadius:12, background:m.bg, border:`1px solid ${m.border}`, display:'flex', flexDirection:'column', gap:3 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:8, color:m.c, fontWeight:600 }}>{m.icon} {m.l}</span>
                <span style={{ fontSize:8, color:'rgba(255,255,255,0.5)', fontWeight:500 }}>{pct}%</span>
              </div>
              <div style={{ fontSize:13, fontWeight:800, color:'#fff', lineHeight:1 }}>
                {m.v}<span style={{ fontSize:8, color:'rgba(255,255,255,0.4)', fontWeight:400 }}>/{m.t}{m.u}</span>
              </div>
              <div style={{ height:3, borderRadius:2, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${Math.min(100, pct)}%`, borderRadius:2, background:m.c, transition:'width 0.4s' }} />
              </div>
            </div>
          );
        })}
      </div>

      {tab === 'add' && (
        <>
          <div style={{ padding:14, borderRadius:18, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 2px 12px rgba(0,0,0,0.15)' }}>
            <input type="text" value={foodSearch} onChange={e => setFoodSearch(e.target.value)}
              placeholder="🔍 Поиск продуктов (начните печатать...)"
              autoFocus
              style={{ width:'100%', padding:'10px 12px', borderRadius:10, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:12, boxSizing:'border-box', marginBottom:8, outline:'none' }} />
            {foodSearchResults.length > 0 && (
              <div style={{ maxHeight:220, overflowY:'auto', marginBottom:6, borderRadius:8 }}>
                {foodSearchResults.map(f => (
                  <div key={f.id} onClick={() => addFoodFromDB(f)} style={{
                    padding:'6px 10px', cursor:'pointer', fontSize:10, borderBottom:'1px solid rgba(255,255,255,0.06)',
                    display:'flex', justifyContent:'space-between', alignItems:'center', color:'#fff', borderRadius:6,
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:12 }}>{CAT_MAP_EMOJI[f.category || 'other'] || '📦'}</span>
                      <span style={{ fontWeight:500 }}>{f.name}</span>
                    </div>
                    <div style={{ display:'flex', gap:3, fontSize:8, color:'rgba(255,255,255,0.85)' }}>
                      <span style={{ color:'#00e68a', fontWeight:700 }}>{f.kcal}</span>
                      <span style={{ color:'#3b82f6' }}>{f.protein}</span>
                      <span style={{ color:'#f59e0b' }}>{f.fat}</span>
                      <span style={{ color:'#f97316' }}>{f.carbs}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginBottom:4 }}>
              {allMealTypes.slice(0, 8).map(mt => (
                <button key={mt} onClick={() => setMealType(mealType === mt ? '' : mt)} style={{
                  padding:'3px 8px', borderRadius:6, fontSize:8, cursor:'pointer',
                  background: mealType === mt ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : '#202023',
                  border: mealType === mt ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
                  color: mealType === mt ? '#000' : 'rgba(255,255,255,0.7)', fontWeight: mealType === mt ? 800 : 500,
                }}>{mt}</button>
              ))}
              <button onClick={() => setShowCustomMeal(!showCustomMeal)} style={{ padding:'3px 8px', borderRadius:6, fontSize:8, cursor:'pointer', background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', color:'#8b5cf6' }}>+</button>
            </div>
            {showCustomMeal && <div style={{ display:'flex', gap:4, marginBottom:6 }}>
              <input value={customMealInput} onChange={e => setCustomMealInput(e.target.value)} placeholder="Название приёма..." style={{ flex:1, padding:'6px', borderRadius:6, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:9 }} />
              <button onClick={addCustomMeal} style={{ padding:'6px 12px', borderRadius:6, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontWeight:600, fontSize:9 }}>Добавить</button>
            </div>}
            <button onClick={() => setShowCustomFood(!showCustomFood)} style={{ width:'100%', padding:'6px 10px', borderRadius:8, fontSize:9, cursor:'pointer', background: showCustomFood ? 'rgba(139,92,246,0.15)' : '#202023', border:'1px solid rgba(139,92,246,0.3)', color:'#8b5cf6', marginTop:2 }}>
              {showCustomFood ? '✕ Скрыть' : '🍎 Своя еда (ввести вручную)'}
            </button>
            {showCustomFood && (
              <div style={{ marginTop:4, padding:'8px', background:'#202023', borderRadius:8, border:'1px solid rgba(139,92,246,0.2)' }}>
                <input value={customFoodName} onChange={e => setCustomFoodName(e.target.value)} placeholder="Название" style={{ width:'100%', padding:'5px 8px', borderRadius:6, background:'#18181b', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:9, marginBottom:4, boxSizing:'border-box' }} />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:3 }}>
                  {[{l:'Ккал',v:customFoodKcal,s:setCustomFoodKcal},{l:'Белки',v:customFoodP,s:setCustomFoodP},{l:'Жиры',v:customFoodF,s:setCustomFoodF},{l:'Угл.',v:customFoodC,s:setCustomFoodC}].map((x,i) => (
                    <div key={i}><label style={{ fontSize:7, color:'rgba(255,255,255,0.85)' }}>{x.l}</label><input type="number" value={x.v} onChange={e => x.s(e.target.value)} style={{ width:'100%', padding:'4px', borderRadius:4, background:'#18181b', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:8, boxSizing:'border-box' }} /></div>
                  ))}
                </div>
                <button onClick={addCustomFood} style={{ width:'100%', marginTop:4, padding:'5px', borderRadius:6, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontWeight:600, fontSize:9 }}>+ Добавить</button>
              </div>
            )}
            {mealPresets.length > 0 && (
              <div style={{ marginTop:6, padding:'8px 10px', borderRadius:10, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.1)' }}>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.8)', marginBottom:4 }}>📦 Пресеты приёмов</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                  {mealPresets.map((p, i) => (
                    <button key={i} onClick={() => setParsedItems(prev => [...prev, ...p.items])} style={{ padding:'3px 8px', borderRadius:6, fontSize:7, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.15)', color:'#00e68a', fontWeight:600 }}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {favoriteFoods.length > 0 && (
            <div style={{ padding:'10px 14px', borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:4 }}>⭐ Избранное</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                {favoriteFoods.slice(0,8).map(f => (
                  <button key={f.id} onClick={() => addFoodFromDB(f)} style={{ padding:'4px 10px', borderRadius:8, fontSize:8, cursor:'pointer', background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', color:'#8b5cf6', whiteSpace:'nowrap' }}>
                    {CAT_MAP_EMOJI[f.category] || ''} {f.name.slice(0,14)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
            <button onClick={() => setShowBarcode(!showBarcode)} style={{ flex:1, padding:'7px 10px', borderRadius:8, fontSize:9, cursor:'pointer', background: showBarcode ? 'rgba(0,230,138,0.15)' : '#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', minWidth:80 }}>📱 Штрих-код</button>
            <button onClick={() => ocrFileRef.current?.click()} disabled={ocrFileLoading} style={{ flex:1, padding:'7px 10px', borderRadius:8, fontSize:9, cursor:'pointer', background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', opacity: ocrFileLoading ? 0.5 : 1, minWidth:80 }}>{ocrFileLoading ? '⏳' : '📁 Файл'}</button>
            <button onClick={() => ocrCameraRef.current?.click()} style={{ flex:1, padding:'7px 10px', borderRadius:8, fontSize:9, cursor:'pointer', background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', minWidth:80 }}>📸 Скан</button>
            <button onClick={() => setShowOCR(!showOCR)} style={{ flex:1, padding:'7px 10px', borderRadius:8, fontSize:9, cursor:'pointer', background: showOCR ? 'rgba(0,230,138,0.15)' : '#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', minWidth:80 }}>📋 OCR</button>
          </div>
          <input ref={ocrFileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleOcrFileUpload(f); }} />
          <input ref={ocrCameraRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleOcrFileUpload(f); }} />
          {showBarcode && <BarcodeScanner onProductFound={handleBarcodeProduct} onClose={() => setShowBarcode(false)} />}

          {showOCR && (
            <div style={{ padding:14, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)' }}>Вставьте текст из FatSecret / MyFitnessPal:</div>
                <button onClick={() => { setShowOCR(false); setOcrText(''); }} style={{ padding:'2px 6px', borderRadius:4, cursor:'pointer', border:'none', background:'rgba(239,68,68,0.1)', color:'#ef4444', fontSize:8 }}>✕</button>
              </div>
              <textarea value={ocrText} onChange={e => setOcrText(e.target.value)} placeholder="Название 100г 250 ккал Б:15 Ж:10 У:20 ..."
                style={{ width:'100%', minHeight:70, padding:8, borderRadius:8, border:'1px solid rgba(255,255,255,0.06)', background:'#202023', color:'#fff', fontSize:11, resize:'vertical', boxSizing:'border-box', marginBottom:6 }} />
              <button onClick={handleOCR} style={{ padding:'7px 14px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontWeight:600, fontSize:10, cursor:'pointer' }}>Распознать</button>
              {ocrError && <div style={{ color:'#ef4444', fontSize:9, marginTop:4 }}>{ocrError}</div>}
            </div>
          )}

          {parsedItems.length > 0 && (
            <div style={{ padding:14, borderRadius:16, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:11, color:'#00e68a', fontWeight:700 }}>📋 На очереди ({parsedItems.length})</span>
                <span style={{ fontSize:10, color:'rgba(255,255,255,0.85)' }}>{mealType || 'Приём пищи'}</span>
              </div>
              {parsedItems.map((item,i) => {
                const q = item.qty || 100;
                const kcal = Math.round(item.kcal * q / 100);
                const p = Math.round(((item.p||0) * q / 100) * 10) / 10;
                const f = Math.round(((item.f||0) * q / 100) * 10) / 10;
                const c = Math.round(((item.c||0) * q / 100) * 10) / 10;
                return (
                <div key={i} style={{ padding:'6px 10px', borderRadius:10, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', marginBottom:4 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:'#fff' }}>{item.name}</span>
                    <button onClick={() => setParsedItems(prev => prev.filter((_,j) => j !== i))} style={{ padding:'2px 6px', borderRadius:4, border:'none', cursor:'pointer', background:'rgba(239,68,68,0.12)', color:'#ef4444', fontSize:9 }}>✕</button>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:3, background:'#18181b', borderRadius:8, padding:'2px 4px' }}>
                      <button onClick={() => setParsedItems(prev => prev.map((x,j) => j===i ? {...x, qty: Math.max(10, (x.qty||100) - 10)} : x))} style={{ width:24, height:24, borderRadius:6, border:'none', background:'rgba(255,255,255,0.06)', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                      <input type="number" value={q} onChange={e => { const v = +e.target.value || 0; setParsedItems(prev => prev.map((x,j) => j===i ? {...x, qty: v} : x)); }}
                        style={{ width:50, padding:'4px 2px', borderRadius:4, background:'transparent', border:'none', color:'#fff', fontSize:13, fontWeight:700, textAlign:'center', outline:'none' }} />
                      <button onClick={() => setParsedItems(prev => prev.map((x,j) => j===i ? {...x, qty: Math.min(1000, (x.qty||100) + 10)} : x))} style={{ width:24, height:24, borderRadius:6, border:'none', background:'rgba(255,255,255,0.06)', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                    </div>
                    <span style={{ fontSize:9, color:'rgba(255,255,255,0.85)' }}>г</span>
                    <div style={{ display:'flex', gap:3, marginLeft:'auto' }}>
                      {[50,100,200,300].map(v => <button key={v} onClick={() => setParsedItems(prev => prev.map((x,j) => j===i ? {...x, qty: v} : x))} style={{ padding:'3px 8px', borderRadius:6, border:'1px solid rgba(255,255,255,0.06)', background: q===v ? 'rgba(0,230,138,0.12)' : '#18181b', color: q===v ? '#00e68a' : 'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:8, fontWeight: q===v ? 700 : 400 }}>{v}г</button>)}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, marginTop:4, fontSize:8 }}>
                    <span style={{ color:'#00e68a', fontWeight:700 }}>{kcal} ккал</span>
                    <span style={{ color:'#60a5fa' }}>Б {p}г</span>
                    <span style={{ color:'#fbbf24' }}>Ж {f}г</span>
                    <span style={{ color:'#fb923c' }}>У {c}г</span>
                  </div>
                </div>);
              })}
              <button onClick={() => saveItemsToDiary(parsedItems)} style={{ width:'100%', marginTop:6, padding:'10px 0', borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontWeight:700, fontSize:11, boxShadow:'0 4px 16px rgba(0,230,138,0.2)' }}>💾 Сохранить {parsedItems.length} позиций</button>
            </div>
          )}
        </>
      )}

      {tab === 'day' && (
        <>
          {/* Quality score card */}
          {(function() {
            try {
              const items = Object.values(dayMeals).flat() as any[];
              if (items.length === 0) return null;
              const q = calcMealQuality(items);
              const ql = getQualityLabel(q.total);
              return (
                <div style={{ padding:'8px 12px', borderRadius:12, background:'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.04)', marginBottom:4 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{ql.emoji} Качество рациона</span>
                    <span style={{ fontSize:16, fontWeight:800, color:ql.color }}>{q.total}/100</span>
                  </div>
                  <div style={{ fontSize:9, color:ql.color, marginTop:2 }}>{ql.label}</div>
                  {q.microDeficiencies.length > 0 && (
                    <div style={{ marginTop:4, display:'flex', gap:2, flexWrap:'wrap' }}>
                      {q.microDeficiencies.slice(0, 4).map((d: any, i: number) => (
                        <span key={i} style={{ padding:'2px 6px', borderRadius:4, fontSize:7, background:'rgba(239,68,68,0.08)', color:'#ef4444' }}>
                          {d.nutrient}: {d.current}/{d.target} {d.unit}
                        </span>
                      ))}
                      {q.microDeficiencies.length > 4 && <span style={{ fontSize:7, color:'rgba(255,255,255,0.8)' }}>+{q.microDeficiencies.length-4}</span>}
                    </div>
                  )}
                </div>
              );
            } catch { return null; }
          })()}

          <div style={{ padding:14, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#fff' }}>📋 {selectedDate}</div>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  {Object.keys(dayMeals).length > 0 && (
                    <button onClick={clearDay} style={{ padding:'4px 10px', borderRadius:6, border:'none', cursor:'pointer', background:'rgba(239,68,68,0.15)', color:'#ef4444', fontSize:8, fontWeight:600 }}>✕ Очистить</button>
                  )}
                  <button onClick={() => {
                    try {
                      const plans = JSON.parse(localStorage.getItem('he_saved_nutrition_plans') || '[]');
                      if (plans.length === 0) { showToast('❌ Нет сохранённых планов'); return; }
                      const latest = plans[0];
                      const meals = latest.dayPlan?.meals || [];
                      if (meals.length === 0) { showToast('❌ План пуст — нет приёмов пищи'); return; }
                      const data = { ...diaryData };
                      if (!data[selectedDate]) data[selectedDate] = { meals: {} };
                      meals.forEach((m: any) => {
                        const label = m.label || 'Приём пищи';
                        if (!data[selectedDate].meals[label]) data[selectedDate].meals[label] = [];
                        m.items.forEach((it: any) => {
                          data[selectedDate].meals[label].push({ name: it.name, qty: `${it.amount || 100} г`, kcal: it.kcal || 0, p: it.p || 0, f: it.f || 0, c: it.c || 0, category: it.category });
                        });
                      });
                      saveDiary(data);
                      showToast('✅ Импортировано из плана');
                    } catch { showToast('❌ Ошибка импорта плана'); }
                  }} style={{ padding:'4px 10px', borderRadius:6, cursor:'pointer', border:'1px solid rgba(0,230,138,0.2)', background:'rgba(0,230,138,0.08)', color:'#00e68a', fontSize:8, fontWeight:600 }}>📥 Из плана</button>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.85)' }}>{Object.keys(dayMeals).length} приёмов</span>
                </div>
              </div>

            {Object.keys(dayMeals).length > 0 && (
              <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:10, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.15)' }}>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', marginBottom:4 }}>🎯 Прогресс за день</div>
                {[
                  { l:'Ккал', v:dayTotals.kcal, t:targets?.kcal || 2500, c:'#00e68a' },
                  { l:'Белки', v:dayTotals.p, t:targets?.protein || 160, c:'#3b82f6' },
                  { l:'Жиры', v:dayTotals.f, t:targets?.fats || 70, c:'#f59e0b' },
                  { l:'Углеводы', v:dayTotals.c, t:targets?.carbs || 300, c:'#f97316' },
                ].map(m => {
                  const pct = Math.min(100, Math.round(m.v / m.t * 100));
                  return <div key={m.l} style={{ marginBottom:3 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, marginBottom:1 }}>
                      <span style={{ color:m.c }}>{m.l}</span>
                      <span style={{ color:'rgba(255,255,255,0.8)' }}>{Math.round(m.v)} / {m.t} <span style={{ fontWeight:700, color:m.c }}>{pct}%</span></span>
                    </div>
                    <div style={{ height:6, borderRadius:3, background:'#202023', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, borderRadius:3, background:m.c, transition:'width 0.4s cubic-bezier(0.22,1,0.36,1)' }} />
                    </div>
                  </div>;
                })}
              </div>
            )}

            {/* Diet stability index & correlations */}
            {(() => {
              try {
                const entries = Object.entries(diaryData).filter(([date]) => date <= selectedDate).slice(-30);
                if (entries.length < 3) return null;
                const kcalValues: number[] = [];
                entries.forEach(([date, day]: [string, any]) => {
                  const total = Object.values(day?.meals || {}).reduce((s: number, items: any) => s + (items as any[]).reduce((ss: number, i: any) => ss + (i.kcal||0), 0), 0);
                  kcalValues.push(total);
                });
                const avg = kcalValues.reduce((s, v) => s + v, 0) / kcalValues.length;
                const variance = kcalValues.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / kcalValues.length;
                const stdDev = Math.sqrt(variance);
                const stabilityIndex = Math.max(0, Math.min(100, Math.round(100 - (stdDev / avg) * 100)));
                // Sleep deprivation correlation
                let sleepDepAvgKcal = 0;
                let normalAvgKcal = 0;
                let sleepDepCount = 0, normalCount = 0;
                entries.forEach(([date, day]: [string, any]) => {
                  const total = Object.values(day?.meals || {}).reduce((s: number, items: any) => s + (items as any[]).reduce((ss: number, i: any) => ss + (i.kcal||0), 0), 0);
                  if ((foodTriggers[date]||[]).includes('sleep_dep')) { sleepDepAvgKcal += total; sleepDepCount++; }
                  else { normalAvgKcal += total; normalCount++; }
                });
                sleepDepAvgKcal = sleepDepCount > 0 ? sleepDepAvgKcal / sleepDepCount : 0;
                normalAvgKcal = normalCount > 0 ? normalAvgKcal / normalCount : 0;
                const kcalDiff = sleepDepAvgKcal > 0 && normalAvgKcal > 0 ? Math.round((sleepDepAvgKcal - normalAvgKcal) / normalAvgKcal * 100) : 0;
                return (
                  <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:10, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.15)' }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'#22c55e', marginBottom:4 }}>📊 Индекс стабильности диеты</div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                      <span style={{ fontSize:8, color:'rgba(255,255,255,0.85)' }}>Стабильность:</span>
                      <span style={{ fontSize:13, fontWeight:800, color: stabilityIndex >= 70 ? '#22c55e' : stabilityIndex >= 50 ? '#f59e0b' : '#ef4444' }}>{stabilityIndex}%</span>
                    </div>
                    <div style={{ width:'100%', height:4, borderRadius:2, background:'rgba(255,255,255,0.06)', marginBottom:4 }}>
                      <div style={{ height:'100%', borderRadius:2, width:`${stabilityIndex}%`, background: stabilityIndex >= 70 ? '#22c55e' : stabilityIndex >= 50 ? '#f59e0b' : '#ef4444', transition:'width 0.5s' }} />
                    </div>
                    {kcalDiff !== 0 && <div style={{ fontSize:8, color: kcalDiff > 0 ? '#f59e0b' : '#22c55e' }}>
                      {sleepDepCount > 0 ? `В дни недосыпа калории ${kcalDiff > 0 ? '+' : ''}${kcalDiff}%` : 'Нет данных по недосыпу'}
                    </div>}
                    <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', marginTop:1 }}>
                      {entries.length} дней · Среднее {Math.round(avg)} ккал · σ={Math.round(stdDev)}
                    </div>
                  </div>
                );
              } catch { return null; }
            })()}

            {/* NutritionDiaryCharts - enhanced visualizations */}
            <NutritionDiaryCharts
              dayMeals={dayMeals}
              dayTotals={dayTotals}
              targets={targets}
              diaryData={diaryData}
              selectedDate={selectedDate}
              refreshKey={refreshKey}
            />

            {/* Meal satisfaction / mood rating */}
            <div style={{ padding:'8px 10px', borderRadius:10, background:'rgba(236,72,153,0.06)', border:'1px solid rgba(236,72,153,0.15)', marginBottom:8 }}>
              <div style={{ fontSize:9, fontWeight:700, color:'#ec4899', marginBottom:4 }}>😋 Оценка питания</div>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)', marginBottom:2 }}>Сытость</div>
                  <div style={{ display:'flex', gap:2 }}>
                    {[1,2,3,4,5].map(s => {
                      const active = s <= (mealMood[selectedDate]?.satiety || 0);
                      return (
                        <button key={s} onClick={() => saveMealMood(selectedDate, { ...(mealMood[selectedDate] || { satiety: 0, enjoyment: 0, note: '' }), satiety: s === mealMood[selectedDate]?.satiety ? 0 : s })}
                          style={{ fontSize:14, cursor:'pointer', background:'none', border:'none', padding:0, opacity: active ? 1 : 0.3, filter: active ? 'none' : 'grayscale(1)', transition:'all 0.15s' }}>
                          🟢
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)', marginBottom:2 }}>Удовольствие</div>
                  <div style={{ display:'flex', gap:2 }}>
                    {[1,2,3,4,5].map(s => {
                      const active = s <= (mealMood[selectedDate]?.enjoyment || 0);
                      return (
                        <button key={s} onClick={() => saveMealMood(selectedDate, { ...(mealMood[selectedDate] || { satiety: 0, enjoyment: 0, note: '' }), enjoyment: s === mealMood[selectedDate]?.enjoyment ? 0 : s })}
                          style={{ fontSize:14, cursor:'pointer', background:'none', border:'none', padding:0, opacity: active ? 1 : 0.3, filter: active ? 'none' : 'grayscale(1)', transition:'all 0.15s' }}>
                          ⭐
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <input
                value={mealMood[selectedDate]?.note || ''}
                onChange={e => saveMealMood(selectedDate, { ...(mealMood[selectedDate] || { satiety: 0, enjoyment: 0, note: '' }), note: e.target.value })}
                placeholder="Заметка о питании..."
                style={{ width:'100%', padding:'4px 8px', borderRadius:6, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:8, boxSizing:'border-box', outline:'none' }}
              />
            </div>

            {/* Nutrition Quality Card */}
            {(() => {
              const meals = Object.entries(dayMeals).map(([mealName, raw]: [string, any]) => {
                const items = Array.isArray(raw) ? raw : [];
                return {
                  foods: items.map((i: any) => ({
                    id: i.name || 'unknown',
                    name: i.name || '',
                    grams: parseInt(i.qty) || 100,
                    protein: i.p || 0,
                    fat: i.f || 0,
                    carbs: i.c || 0,
                    kcal: i.kcal || 0,
                    fiber: 0,
                  })),
                };
              });
              return (
                <NutritionQualityCard
                  meals={meals}
                  weight={weight}
                  age={age}
                  sex={sex}
                  goal={sex === 'male' ? 'maintain' : 'maintain'}
                  activityLevel="moderate"
                />
              );
            })()}

            {/* Food patterns & triggers */}
            <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:8, padding:'8px 10px', borderRadius:10, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.15)' }}>
              <div style={{ fontSize:9, fontWeight:700, color:'#a78bfa', marginBottom:3 }}>📊 Пищевые паттерны</div>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:4 }}>
                {['evening_over','morning_under','binge_day'].map(p => {
                  const labels: Record<string,string> = { evening_over:'🌙 Переедание вечером', morning_under:'🌅 Недоедание утром', binge_day:'🔥 Срывной день' };
                  const active = (foodPatterns[selectedDate]||[]).includes(p);
                  return (
                    <button key={p} onClick={() => {
                      const current = foodPatterns[selectedDate] || [];
                      const upd = active ? current.filter(x => x !== p) : [...current, p];
                      savePatterns(selectedDate, upd);
                    }} style={{
                      padding:'3px 8px', borderRadius:10, fontSize:8, fontWeight:600, cursor:'pointer', border:'1px solid',
                      background: active ? 'rgba(167,139,250,0.15)' : 'transparent',
                      color: active ? '#a78bfa' : 'rgba(255,255,255,0.6)',
                      borderColor: active ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.08)',
                    }}>{labels[p]}</button>
                  );
                })}
              </div>
              <div style={{ fontSize:9, fontWeight:700, color:'#f59e0b', marginBottom:3 }}>⚠️ Триггеры переедания</div>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                {['stress','alcohol','sleep_dep','social'].map(t => {
                  const labels: Record<string,string> = { stress:'😰 Стресс', alcohol:'🍷 Алкоголь', sleep_dep:'😴 Недосып', social:'🎉 Событие' };
                  const active = (foodTriggers[selectedDate]||[]).includes(t);
                  return (
                    <button key={t} onClick={() => {
                      const current = foodTriggers[selectedDate] || [];
                      const upd = active ? current.filter(x => x !== t) : [...current, t];
                      saveTriggers(selectedDate, upd);
                    }} style={{
                      padding:'3px 8px', borderRadius:10, fontSize:8, fontWeight:600, cursor:'pointer', border:'1px solid',
                      background: active ? 'rgba(245,158,11,0.15)' : 'transparent',
                      color: active ? '#f59e0b' : 'rgba(255,255,255,0.6)',
                      borderColor: active ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)',
                    }}>{labels[t]}</button>
                  );
                })}
              </div>
            </div>

            {Object.keys(dayMeals).length === 0 ? (
              <div style={{ textAlign:'center', padding:20, color:'rgba(255,255,255,0.8)', fontSize:10 }}>
                Нет записей. Переключитесь на «➕ Добавить», чтобы внести продукты.
              </div>
            ) : (
              Object.entries(dayMeals).map(([meal, raw]: [string, any]) => {
                const items = Array.isArray(raw) ? raw : [];
                const mealKcal = items.reduce((s:number,i:any)=>s+(i.kcal||0),0);
                const mealP = items.reduce((s:number,i:any)=>s+(i.p||0),0);
                const mealF = items.reduce((s:number,i:any)=>s+(i.f||0),0);
                const mealC = items.reduce((s:number,i:any)=>s+(i.c||0),0);
                return <div key={meal} style={{ marginBottom:6 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 8px', borderRadius:8, background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.15)', marginBottom:3 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ fontWeight:600, fontSize:10, color:'#00e68a' }}>{meal}</span>
                      <button onClick={() => copyMeal(meal)} style={{ padding:'2px 6px', borderRadius:4, border:'none', cursor:'pointer', background:'rgba(139,92,246,0.15)', color:'#8b5cf6', fontSize:7 }} title="Копировать">📋</button>
                      <button onClick={() => { let name = ''; try { name = prompt('Название пресета:', meal) || ''; } catch { name = meal + ' (пресет)'; } if (name) { const preset = { name, items: items.map((i: any) => ({ name: i.name, kcal: i.kcal, p: i.p, f: i.f, c: i.c })) }; const upd = [...mealPresets, preset]; setMealPresets(upd); safeSet('he_meal_presets', upd); } }} style={{ padding:'2px 6px', borderRadius:4, border:'none', cursor:'pointer', background:'rgba(0,230,138,0.15)', color:'#00e68a', fontSize:7 }} title="Сохранить как пресет">💾</button>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:8 }}>
                      <span style={{ color:'rgba(255,255,255,0.85)' }}>Б{Math.round(mealP)} Ж{Math.round(mealF)} У{Math.round(mealC)}</span>
                      <span style={{ color:'#00e68a', fontWeight:700, fontSize:10 }}>{Math.round(mealKcal)}</span>
                    </div>
                  </div>
                  {items.map((item:any, idx:number) => (
                    <div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'3px 8px', fontSize:9, color:'rgba(255,255,255,0.8)', borderRadius:6 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, flex:1 }}>
                        <span>{item.name}</span>
                        <span style={{ fontSize:7, color:'rgba(255,255,255,0.25)' }}>{item.qty || '100 г'}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                        <span style={{ fontSize:8, color:'rgba(255,255,255,0.35)' }}>{Math.round(item.kcal||0)} Б{item.p||0} Ж{item.f||0} У{item.c||0}</span>
                        <button onClick={() => openEdit(meal, idx, item)} style={{ padding:'2px 5px', borderRadius:4, border:'none', cursor:'pointer', background:'rgba(59,130,246,0.15)', color:'#3b82f6', fontSize:8, lineHeight:1 }} title="Изменить количество">✎</button>
                        <button onClick={() => deleteItem(meal, idx)} style={{ padding:'2px 5px', borderRadius:4, border:'none', cursor:'pointer', background:'rgba(239,68,68,0.15)', color:'#ef4444', fontSize:8, lineHeight:1 }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>;
              })
            )}
          </div>

          {editItem && (
            <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center', background:'rgba(0,0,0,0.7)' }}
              onClick={() => setEditItem(null)}>
              <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:400, padding:'14px 20px 28px', borderRadius:'20px 20px 0 0', background:'#18181b', boxShadow:'0 -4px 30px rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.06)', borderBottom:'none' }}>
                <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.15)', margin:'0 auto 16px' }} />
                <div style={{ fontSize:15, fontWeight:700, color:'#fff', marginBottom:2, letterSpacing:-0.3 }}>✎ {editItem.item.name}</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginBottom:12 }}>Изменить количество</div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <button onClick={() => setEditQty(Math.max(10, editQty - 10))} style={{ width:40, height:40, borderRadius:12, border:'1px solid rgba(255,255,255,0.06)', background:'#202023', color:'#fff', cursor:'pointer', fontSize:18, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>−</button>
                  <div style={{ flex:1, textAlign:'center' }}>
                    <input type="number" value={editQty} onChange={e => setEditQty(+e.target.value || 0)} style={{ width:80, padding:'8px', borderRadius:10, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:20, fontWeight:700, textAlign:'center', outline:'none' }} />
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', marginTop:4, letterSpacing:0.5 }}>грамм</div>
                  </div>
                  <button onClick={() => setEditQty(Math.min(1000, editQty + 10))} style={{ width:40, height:40, borderRadius:12, border:'1px solid rgba(255,255,255,0.06)', background:'#202023', color:'#fff', cursor:'pointer', fontSize:18, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>+</button>
                </div>
                <div style={{ display:'flex', gap:5, justifyContent:'center', marginBottom:10 }}>
                  {[50,100,150,200,300].map(v => <button key={v} onClick={() => setEditQty(v)} style={{ padding:'4px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.06)', background: editQty===v ? 'rgba(0,230,138,0.15)' : '#202023', color: editQty===v ? '#00e68a' : 'rgba(255,255,255,0.8)', cursor:'pointer', fontSize:9, fontWeight: editQty===v ? 600 : 400, transition:'all 0.15s' }}>{v}г</button>)}
                </div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginBottom:12, textAlign:'center', letterSpacing:'-0.1px' }}>
                  → <span style={{ color:'#00e68a', fontWeight:700 }}>{Math.round(editQty * (editItem.item.kcal || 0) / 100)} ккал</span> · <span style={{ color:'#60a5fa' }}>{Math.round(((editItem.item.p||0) * editQty / 100) * 10)/10}г Б</span> · <span style={{ color:'#fbbf24' }}>{Math.round(((editItem.item.f||0) * editQty / 100) * 10)/10}г Ж</span> · <span style={{ color:'#fb923c' }}>{Math.round(((editItem.item.c||0) * editQty / 100) * 10)/10}г У</span>
                </div>
                <button onClick={saveEdit} style={{ width:'100%', padding:'10px', borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontWeight:700, fontSize:12, boxShadow:'0 4px 20px rgba(0,230,138,0.2)', letterSpacing:'-0.1px' }}>✓ Сохранить</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

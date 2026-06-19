import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { type OFFProduct, productToFoodItem } from '../../../engines/openfoodfacts.engine';
import { parseFatSecretText, parseNutritionScreenshot } from '../../../engines/nutrition-ocr-parser';
import { processUploadedFile, saveParsedMeals } from '../../../core/ocr-engine';
import { FOOD_DB } from '../../../core/nutrition-database';
import { CAT_MAP_EMOJI } from '../../../core/nutrition-utils';

const MEAL_PRESETS = ['Завтрак', 'Второй завтрак', 'Обед', 'Полдник', 'Ужин', 'Перекус', 'До тренировки', 'После тренировки', 'Поздний перекус'];
const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

interface DiaryItem { name: string; kcal: number; p: number; f: number; c: number; qty?: number; category?: string; }

interface NutritionTargets { kcal: number; protein: number; fats: number; carbs: number; }

export const NutritionDiary: React.FC<{ foodEntries: { name: string; kcal: number; p: number; f: number; c: number }[]; targets?: NutritionTargets }> = ({ foodEntries, targets }) => {
  const [tab, setTab] = useState<'add'|'day'>('add');
  const [showOCR, setShowOCR] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [foodSearch, setFoodSearch] = useState('');
  const [mealType, setMealType] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [parsedItems, setParsedItems] = useState<DiaryItem[]>([]);
  const [ocrError, setOcrError] = useState('');
  const [ocrFileLoading, setOcrFileLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [customMealInput, setCustomMealInput] = useState('');
  const [showCustomMeal, setShowCustomMeal] = useState(false);
  const [customMeals, setCustomMeals] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_custom_meals') || '[]'); } catch { return []; } });
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
  const ocrFileRef = useRef<HTMLInputElement>(null);
  const ocrCameraRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  useEffect(() => { try { setDiaryData(JSON.parse(localStorage.getItem('nutrition_diary') || '{}')); } catch {} }, [refreshKey, foodEntries]);
  const saveDiary = (data: any) => { localStorage.setItem('nutrition_diary', JSON.stringify(data)); setDiaryData(data); setRefreshKey(k => k+1); };
  const addCustomMeal = () => { const name = customMealInput.trim(); if (!name || customMeals.includes(name)) return; const updated = [...customMeals, name]; setCustomMeals(updated); localStorage.setItem('he_custom_meals', JSON.stringify(updated)); setCustomMealInput(''); setShowCustomMeal(false); showToast('✅ Приём добавлен'); };

  const allMealTypes = [...MEAL_PRESETS, ...customMeals];

  const foodSearchResults = useMemo(() => {
    if (!foodSearch.trim()) return [];
    const q = foodSearch.toLowerCase();
    return FOOD_DB.filter(f => f.name.toLowerCase().includes(q)).slice(0, 10);
  }, [foodSearch]);

  const addFoodFromDB = (food: typeof FOOD_DB[number]) => {
    setParsedItems(prev => [...prev, { name: food.name, kcal: food.kcal, p: food.protein, f: food.fat, c: food.carbs, qty: 100, category: food.category }]);
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
    const items = Object.values(dayMeals).flat();
    const kcal = items.reduce((s: number, i: any) => s + (i.kcal || 0), 0);
    const p = items.reduce((s: number, i: any) => s + (i.p || 0), 0);
    const f = items.reduce((s: number, i: any) => s + (i.f || 0), 0);
    const c = items.reduce((s: number, i: any) => s + (i.c || 0), 0);
    return { kcal, p, f, c };
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
                background: isSelected ? 'linear-gradient(135deg,rgba(0,230,138,0.2),rgba(0,200,160,0.12))' : 'transparent',
                border: isSelected ? '1px solid #00e68a' : '1px solid transparent',
                transition:'all 0.15s',
              }}>
                <span style={{ fontSize:8, color: isSelected ? '#00e68a' : 'rgba(255,255,255,0.4)', fontWeight: isSelected ? 700 : 400 }}>{DAY_NAMES[i]}</span>
                <span style={{ fontSize:14, fontWeight:700, color: isToday ? '#00e68a' : isSelected ? '#fff' : 'rgba(255,255,255,0.5)', marginTop:1 }}>{new Date(ds).getDate()}</span>
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
              <button onClick={() => setCopySource(null)} style={{ padding:'3px 8px', borderRadius:6, border:'none', cursor:'pointer', background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.4)', fontSize:8 }}>✕</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display:'flex', gap:3, padding:'2px 0' }}>
        {(['add','day'] as const).map(t => <button key={t} onClick={() => setTab(t)} style={{
          flex:1, padding:'7px', borderRadius:10, cursor:'pointer', fontSize:10, fontWeight: tab===t ? 700 : 400,
          border: tab===t ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
          background: tab===t ? 'linear-gradient(135deg,rgba(0,230,138,0.2),rgba(0,200,160,0.12))' : '#202023',
          color: tab===t ? '#00e68a' : 'rgba(255,255,255,0.5)',
        }}>{t === 'add' ? '➕ Добавить' : '📋 День'}</button>)}
      </div>

      {tab === 'add' && (
        <>
          <div style={{ padding:14, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.06)' }}>
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
                      <span style={{ fontSize:12 }}>{CAT_MAP_EMOJI[f.category] || '📦'}</span>
                      <span style={{ fontWeight:500 }}>{f.name}</span>
                    </div>
                    <div style={{ display:'flex', gap:3, fontSize:8, color:'rgba(255,255,255,0.4)' }}>
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
                  background: mealType === mt ? 'rgba(0,230,138,0.2)' : '#202023',
                  border: mealType === mt ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
                  color: mealType === mt ? '#00e68a' : 'rgba(255,255,255,0.5)', fontWeight: mealType === mt ? 600 : 400,
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
                    <div key={i}><label style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>{x.l}</label><input type="number" value={x.v} onChange={e => x.s(e.target.value)} style={{ width:'100%', padding:'4px', borderRadius:4, background:'#18181b', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:8, boxSizing:'border-box' }} /></div>
                  ))}
                </div>
                <button onClick={addCustomFood} style={{ width:'100%', marginTop:4, padding:'5px', borderRadius:6, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontWeight:600, fontSize:9 }}>+ Добавить</button>
              </div>
            )}
          </div>

          {favoriteFoods.length > 0 && (
            <div style={{ padding:'10px 14px', borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>⭐ Избранное</div>
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
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>Вставьте текст из FatSecret / MyFitnessPal:</div>
              <textarea value={ocrText} onChange={e => setOcrText(e.target.value)} placeholder="Название 100г 250 ккал Б:15 Ж:10 У:20 ..."
                style={{ width:'100%', minHeight:70, padding:8, borderRadius:8, border:'1px solid rgba(255,255,255,0.06)', background:'#202023', color:'#fff', fontSize:11, resize:'vertical', boxSizing:'border-box', marginBottom:6 }} />
              <button onClick={handleOCR} style={{ padding:'7px 14px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontWeight:600, fontSize:10, cursor:'pointer' }}>Распознать</button>
              {ocrError && <div style={{ color:'#ef4444', fontSize:9, marginTop:4 }}>{ocrError}</div>}
            </div>
          )}

          {parsedItems.length > 0 && (
            <div style={{ padding:14, borderRadius:16, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <span style={{ fontSize:10, color:'#00e68a', fontWeight:600 }}>📋 На очереди ({parsedItems.length})</span>
                <span style={{ fontSize:9, color:'rgba(255,255,255,0.4)' }}>{mealType || 'Приём пищи'}</span>
              </div>
              {parsedItems.map((item,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 8px', borderRadius:8, background:'#202023', marginBottom:2 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, flex:1 }}>
                    <span style={{ fontSize:10, fontWeight:500, color:'#fff' }}>{item.name}</span>
                    <input type="number" value={item.qty || 100} onChange={e => { const v = +e.target.value || 0; setParsedItems(prev => prev.map((x,j) => j===i ? {...x, qty: v} : x)); }}
                      style={{ width:45, padding:'2px 4px', borderRadius:4, background:'#18181b', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:8, textAlign:'center' }} />
                    <span style={{ fontSize:7, color:'rgba(255,255,255,0.3)' }}>г</span>
                  </div>
                  <div style={{ display:'flex', gap:3, fontSize:8, color:'rgba(255,255,255,0.4)' }}>
                    <span style={{ color:'#00e68a' }}>{Math.round(item.kcal * (item.qty||100) / 100)}</span>
                    <button onClick={() => setParsedItems(prev => prev.filter((_,j) => j !== i))} style={{ padding:'1px 5px', borderRadius:4, border:'none', cursor:'pointer', background:'rgba(239,68,68,0.15)', color:'#ef4444', fontSize:8, lineHeight:1 }}>✕</button>
                  </div>
                </div>
              ))}
              <button onClick={() => saveItemsToDiary(parsedItems)} style={{ width:'100%', marginTop:6, padding:8, borderRadius:8, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontWeight:600, fontSize:10 }}>💾 Сохранить {parsedItems.length} позиций</button>
            </div>
          )}
        </>
      )}

      {tab === 'day' && (
        <>
          <div style={{ padding:14, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#fff' }}>📋 {selectedDate}</div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                {Object.keys(dayMeals).length > 0 && (
                  <button onClick={clearDay} style={{ padding:'4px 10px', borderRadius:6, border:'none', cursor:'pointer', background:'rgba(239,68,68,0.15)', color:'#ef4444', fontSize:8, fontWeight:600 }}>✕ Очистить</button>
                )}
                <span style={{ fontSize:9, color:'rgba(255,255,255,0.4)' }}>{Object.keys(dayMeals).length} приёмов</span>
              </div>
            </div>

            {Object.keys(dayMeals).length > 0 && (
              <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:10, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.15)' }}>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>🎯 Прогресс за день</div>
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
                      <span style={{ color:'rgba(255,255,255,0.5)' }}>{Math.round(m.v)} / {m.t} <span style={{ fontWeight:700, color:m.c }}>{pct}%</span></span>
                    </div>
                    <div style={{ height:6, borderRadius:3, background:'#202023', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, borderRadius:3, background:m.c, transition:'width 0.4s cubic-bezier(0.22,1,0.36,1)' }} />
                    </div>
                  </div>;
                })}
              </div>
            )}

            {Object.keys(dayMeals).length === 0 ? (
              <div style={{ textAlign:'center', padding:20, color:'rgba(255,255,255,0.3)', fontSize:10 }}>
                Нет записей. Переключитесь на «➕ Добавить», чтобы внести продукты.
              </div>
            ) : (
              Object.entries(dayMeals).map(([meal, items]: [string, any]) => {
                const mealKcal = items.reduce((s:number,i:any)=>s+(i.kcal||0),0);
                const mealP = items.reduce((s:number,i:any)=>s+(i.p||0),0);
                const mealF = items.reduce((s:number,i:any)=>s+(i.f||0),0);
                const mealC = items.reduce((s:number,i:any)=>s+(i.c||0),0);
                return <div key={meal} style={{ marginBottom:6 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 8px', borderRadius:8, background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.15)', marginBottom:3 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ fontWeight:600, fontSize:10, color:'#00e68a' }}>{meal}</span>
                      <button onClick={() => copyMeal(meal)} style={{ padding:'2px 6px', borderRadius:4, border:'none', cursor:'pointer', background:'rgba(139,92,246,0.15)', color:'#8b5cf6', fontSize:7 }} title="Копировать приём">📋</button>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:8 }}>
                      <span style={{ color:'rgba(255,255,255,0.4)' }}>Б{Math.round(mealP)} Ж{Math.round(mealF)} У{Math.round(mealC)}</span>
                      <span style={{ color:'#00e68a', fontWeight:700, fontSize:10 }}>{Math.round(mealKcal)}</span>
                    </div>
                  </div>
                  {items.map((item:any, idx:number) => (
                    <div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'3px 8px', fontSize:9, color:'rgba(255,255,255,0.5)', borderRadius:6 }}>
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
            <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)' }}
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
                  {[50,100,150,200,300].map(v => <button key={v} onClick={() => setEditQty(v)} style={{ padding:'4px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.06)', background: editQty===v ? 'rgba(0,230,138,0.15)' : '#202023', color: editQty===v ? '#00e68a' : 'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:9, fontWeight: editQty===v ? 600 : 400, transition:'all 0.15s' }}>{v}г</button>)}
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

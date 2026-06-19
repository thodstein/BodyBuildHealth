import React, { useState, useRef, useMemo, useEffect } from 'react';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { type OFFProduct, productToFoodItem } from '../../../engines/openfoodfacts.engine';
import { parseFatSecretText, parseNutritionScreenshot } from '../../../engines/nutrition-ocr-parser';
import { processUploadedFile, saveParsedMeals } from '../../../core/ocr-engine';
import { FOOD_DB } from '../../../core/nutrition-database';

const MEAL_PRESETS = ['Завтрак', 'Второй завтрак', 'Обед', 'Полдник', 'Ужин', 'Перекус', 'До тренировки', 'После тренировки', 'Поздний перекус'];
const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const NutritionDiary: React.FC<{
  foodEntries: { name: string; kcal: number; p: number; f: number; c: number }[];
}> = ({ foodEntries }) => {
  const [showOCR, setShowOCR] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [foodSearch, setFoodSearch] = useState('');
  const [mealType, setMealType] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [parsedItems, setParsedItems] = useState<{ name: string; kcal: number; p: number; f: number; c: number }[]>([]);
  const [ocrError, setOcrError] = useState('');
  const [ocrFileLoading, setOcrFileLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [customMealInput, setCustomMealInput] = useState('');
  const [showCustomMeal, setShowCustomMeal] = useState(false);
  const [customMeals, setCustomMeals] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_custom_meals') || '[]'); } catch { return []; } });
  const [diaryData, setDiaryData] = useState<any>(() => { try { return JSON.parse(localStorage.getItem('nutrition_diary') || '{}'); } catch { return {}; } });
  const [refreshKey, setRefreshKey] = useState(0);
  const ocrFileRef = useRef<HTMLInputElement>(null);
  const ocrCameraRef = useRef<HTMLInputElement>(null);

  // Reload diary data on changes
  useEffect(() => {
    try { setDiaryData(JSON.parse(localStorage.getItem('nutrition_diary') || '{}')); } catch {}
  }, [refreshKey, foodEntries]);

  const saveDiary = (data: any) => { localStorage.setItem('nutrition_diary', JSON.stringify(data)); setDiaryData(data); setRefreshKey(k => k+1); };
  const addCustomMeal = () => { const name = customMealInput.trim(); if (!name || customMeals.includes(name)) return; const updated = [...customMeals, name]; setCustomMeals(updated); localStorage.setItem('he_custom_meals', JSON.stringify(updated)); setCustomMealInput(''); setShowCustomMeal(false); };

  const allMealTypes = [...MEAL_PRESETS, ...customMeals];

  const foodSearchResults = useMemo(() => {
    if (!foodSearch.trim()) return [];
    const q = foodSearch.toLowerCase();
    return FOOD_DB.filter(f => f.name.toLowerCase().includes(q)).slice(0, 8);
  }, [foodSearch]);

  const addFoodFromDB = (food: typeof FOOD_DB[number]) => {
    setParsedItems(prev => [...prev, {
      name: food.name, kcal: food.kcal, p: food.protein, f: food.fat, c: food.carbs,
    }]);
    setFoodSearch('');
    try {
      const favs = JSON.parse(localStorage.getItem('he_food_favs') || '[]');
      const updated = [food.id, ...favs.filter((f: string) => f !== food.id)].slice(0, 12);
      localStorage.setItem('he_food_favs', JSON.stringify(updated));
    } catch {}
  };

  const favoriteFoods = useMemo(() => {
    try {
      const favs: string[] = JSON.parse(localStorage.getItem('he_food_favs') || '[]');
      return favs.map(id => FOOD_DB.find(f => f.id === id)).filter(Boolean) as typeof FOOD_DB;
    } catch { return []; }
  }, [refreshKey]);

  const handleBarcodeProduct = (product: OFFProduct) => {
    setShowBarcode(false);
    const item = productToFoodItem(product);
    setParsedItems(prev => [...prev, {
      name: item.name, kcal: item.kcal, p: item.protein, f: item.fat, c: item.carbs,
    }]);
  };

  const handleOcrFileUpload = async (file: File) => {
    setOcrFileLoading(true); setOcrError('');
    try {
      const result = await processUploadedFile(file);
      if (result.meals.length > 0) {
        const converted = result.meals.flatMap(m =>
          m.items.map(item => ({
            name: item.name || m.mealType || 'Блюдо',
            kcal: Math.round(item.kcal) || 0,
            p: Math.round((item.p || 0) * 10) / 10,
            f: Math.round((item.f || 0) * 10) / 10,
            c: Math.round((item.c || 0) * 10) / 10,
          }))
        );
        setParsedItems(prev => [...prev, ...converted]);
      }
      if (result.meals.length === 0 && result.labs.length === 0) setOcrError('Не удалось распознать данные питания.');
    } catch (e) { setOcrError('Ошибка: ' + (e instanceof Error ? e.message : String(e))); }
    setOcrFileLoading(false);
  };

  const handleOCR = () => {
    if (!ocrText.trim()) return;
    setOcrError('');
    try {
      let items = parseFatSecretText(ocrText);
      if (items.length === 0) items = parseNutritionScreenshot(ocrText);
      const converted = items.flatMap(m =>
        m.items.map(item => ({
          name: item.name || m.mealType || '',
          kcal: Math.round(item.kcal) || 0,
          p: Math.round((item.p || 0) * 10) / 10,
          f: Math.round((item.f || 0) * 10) / 10,
          c: Math.round((item.c || 0) * 10) / 10,
        }))
      );
      setParsedItems(converted);
    } catch (e) { setOcrError('' + (e instanceof Error ? e.message : String(e))); }
  };

  // Save parsed items immediately with meal type and date
  const saveItemsToDiary = (items: typeof parsedItems) => {
    if (items.length === 0) return;
    const data = { ...diaryData };
    if (!data[selectedDate]) data[selectedDate] = { meals: {} };
    const mt = mealType || 'Приём пищи';
    if (!data[selectedDate].meals[mt]) data[selectedDate].meals[mt] = [];
    items.forEach(item => {
      data[selectedDate].meals[mt].push({
        name: item.name, qty: '100 г', kcal: item.kcal, p: item.p, f: item.f, c: item.c,
      });
    });
    saveDiary(data);
    setParsedItems([]);
    setOcrText('');
  };

  // Week calculation
  const weekStart = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d;
  }, [selectedDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }, [weekStart]);

  // Day's meals from diaryData
  const dayMeals = diaryData[selectedDate]?.meals || {};

  return (
    <div className="nutrition-diary" style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {/* Apple-style week selector */}
      <div style={{ padding:12, borderRadius:14, background:'linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'flex', gap:2, marginBottom:6 }}>
          {weekDays.map((ds, i) => {
            const isToday = ds === new Date().toISOString().split('T')[0];
            const isSelected = ds === selectedDate;
            const hasData = !!diaryData[ds];
            return (
              <div key={i} onClick={() => setSelectedDate(ds)} style={{
                flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'5px 0', borderRadius:10, cursor:'pointer',
                background: isSelected ? 'rgba(0,230,138,0.15)' : 'transparent',
                border: isSelected ? '1px solid rgba(0,230,138,0.3)' : '1px solid transparent',
                transition:'all 0.15s',
              }}>
                <span style={{ fontSize:8, color: isSelected ? '#00e68a' : 'rgba(255,255,255,0.3)', fontWeight: isSelected ? 700 : 400 }}>{DAY_NAMES[i]}</span>
                <span style={{ fontSize:13, fontWeight:700, color: isToday ? '#00e68a' : isSelected ? '#fff' : 'rgba(255,255,255,0.5)', marginTop:1 }}>{new Date(ds).getDate()}</span>
                {hasData && <div style={{ width:4, height:4, borderRadius:'50%', background:'#00e68a', marginTop:2 }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick food search + meal type */}
      <div style={{ padding:12, borderRadius:14, background:'linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.06)' }}>
        <input type="text" value={foodSearch} onChange={e => setFoodSearch(e.target.value)}
          placeholder="🔍 Поиск продуктов..."
          style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text)', fontSize:11, boxSizing:'border-box', marginBottom:6 }} />
        {/* Meal type pills */}
        <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginBottom:4 }}>
          {allMealTypes.slice(0, 8).map(mt => (
            <button key={mt} onClick={() => setMealType(mealType === mt ? '' : mt)} style={{
              padding:'2px 7px', borderRadius:6, fontSize:8, cursor:'pointer',
              background: mealType === mt ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.03)',
              border: mealType === mt ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
              color: mealType === mt ? '#00e68a' : 'rgba(255,255,255,0.5)', fontWeight: mealType === mt ? 600 : 400,
            }}>{mt}</button>
          ))}
          <button onClick={() => setShowCustomMeal(!showCustomMeal)} style={{ padding:'2px 7px', borderRadius:6, fontSize:8, cursor:'pointer', background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', color:'#8b5cf6' }}>+</button>
        </div>
        {showCustomMeal && <div style={{ display:'flex', gap:4, marginBottom:6 }}>
          <input value={customMealInput} onChange={e => setCustomMealInput(e.target.value)} placeholder="Название приёма..." style={{ flex:1, padding:'5px', borderRadius:6, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text)', fontSize:9 }} />
          <button onClick={addCustomMeal} style={{ padding:'5px 10px', borderRadius:6, border:'none', cursor:'pointer', background:'var(--accent)', color:'#000', fontWeight:600, fontSize:9 }}>Добавить</button>
        </div>}
        {/* Search results */}
        {foodSearchResults.length > 0 && (
          <div style={{ maxHeight:160, overflowY:'auto', marginBottom:4 }}>
            {foodSearchResults.map(f => (
              <div key={f.id} onClick={() => addFoodFromDB(f)} style={{ padding:'4px 8px', cursor:'pointer', fontSize:10, borderBottom:'1px solid rgba(255,255,255,0.03)', display:'flex', justifyContent:'space-between', color:'var(--text)', borderRadius:4 }}>
                <span style={{ fontWeight:500 }}>{f.name}</span>
                <span style={{ color:'rgba(255,255,255,0.3)', fontSize:9 }}>{f.kcal}ккал Б{f.protein} Ж{f.fat} У{f.carbs}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Favorites quick-add */}
      {favoriteFoods.length > 0 && (
        <div style={{ padding:'8px 12px', borderRadius:14, background:'linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', marginBottom:4 }}>⭐ Избранное</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
            {favoriteFoods.slice(0,6).map(f => (
              <button key={f.id} onClick={() => addFoodFromDB(f)} style={{ padding:'3px 8px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', color:'#8b5cf6', whiteSpace:'nowrap' }}>{f.name.slice(0,14)}</button>
            ))}
          </div>
        </div>
      )}

      {/* Barcode + File/OCR */}
      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
        <button onClick={() => setShowBarcode(!showBarcode)} style={{ padding:'6px 10px', borderRadius:8, fontSize:9, cursor:'pointer', background: showBarcode ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'var(--text)' }}>📱 Штрих-код</button>
        <button onClick={() => ocrFileRef.current?.click()} disabled={ocrFileLoading} style={{ padding:'6px 10px', borderRadius:8, fontSize:9, cursor:'pointer', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'var(--text)', opacity: ocrFileLoading ? 0.5 : 1 }}>{ocrFileLoading ? '⏳' : '📁 Файл'}</button>
        <button onClick={() => { if (ocrCameraRef.current) ocrCameraRef.current.click(); }} style={{ padding:'6px 10px', borderRadius:8, fontSize:9, cursor:'pointer', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'var(--text)' }}>📸 Снимок</button>
        <button onClick={() => setShowOCR(!showOCR)} style={{ padding:'6px 10px', borderRadius:8, fontSize:9, cursor:'pointer', background: showOCR ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'var(--text)' }}>📋 OCR</button>
      </div>
      <input ref={ocrFileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleOcrFileUpload(f); }} />
      <input ref={ocrCameraRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleOcrFileUpload(f); }} />

      {showBarcode && <BarcodeScanner onProductFound={handleBarcodeProduct} onClose={() => setShowBarcode(false)} />}

      {/* OCR paste */}
      {showOCR && (
        <div style={{ padding:12, borderRadius:14, background:'linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', marginBottom:4 }}>Вставьте текст из FatSecret / MyFitnessPal:</div>
          <textarea value={ocrText} onChange={e => setOcrText(e.target.value)} placeholder="Название 100г 250 ккал Б:15 Ж:10 У:20 ..."
            style={{ width:'100%', minHeight:80, padding:8, borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-primary)', color:'inherit', fontSize:11, resize:'vertical', boxSizing:'border-box', marginBottom:6 }} />
          <button onClick={handleOCR} style={{ padding:'6px 14px', borderRadius:8, border:'none', background:'#00e68a', color:'#000', fontWeight:600, fontSize:10, cursor:'pointer' }}>Распознать</button>
          {ocrError && <div style={{ color:'#ef4444', fontSize:9, marginTop:4 }}>{ocrError}</div>}
          {parsedItems.length > 0 && (
            <div style={{ marginTop:6 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)' }}>Распознано: {parsedItems.length} позиций</div>
              {parsedItems.map((item,i) => <div key={i} style={{ padding:'3px 6px', fontSize:9, display:'flex', justifyContent:'space-between', background:'rgba(255,255,255,0.02)', borderRadius:4, marginTop:2 }}>
                <span>{item.name}</span><span style={{ color:'rgba(255,255,255,0.4)' }}>{item.kcal}ккал Б{item.p} Ж{item.f} У{item.c}</span>
              </div>)}
              <button onClick={() => saveItemsToDiary(parsedItems)} style={{ width:'100%', marginTop:6, padding:7, borderRadius:8, border:'none', cursor:'pointer', background:'var(--accent)', color:'#000', fontWeight:600, fontSize:10 }}>💾 Сохранить в дневник</button>
            </div>
          )}
        </div>
      )}

      {/* Parsed items quick-save bar */}
      {parsedItems.length > 0 && !showOCR && (
        <button onClick={() => saveItemsToDiary(parsedItems)} style={{ padding:'8px', borderRadius:8, border:'none', cursor:'pointer', background:'var(--accent)', color:'#000', fontWeight:600, fontSize:11 }}>
          💾 Сохранить {parsedItems.length} позиций{mealType ? ` → ${mealType}` : ''} ({selectedDate})
        </button>
      )}

      {/* Day meal view */}
      <div style={{ padding:12, borderRadius:14, background:'linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <span style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:500 }}>📋 {selectedDate}</span>
          <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)' }}>{Object.keys(dayMeals).length} приёмов</span>
        </div>
        {Object.keys(dayMeals).length === 0 ? (
          <div style={{ textAlign:'center', padding:12, color:'rgba(255,255,255,0.25)', fontSize:10 }}>Нет записей. Добавьте продукты через поиск, OCR или избранное.</div>
        ) : (
          Object.entries(dayMeals).map(([meal, items]: [string, any]) => {
            const kcal = items.reduce((s:number,i:any)=>s+(i.kcal||0),0);
            return <div key={meal} style={{ marginBottom:4 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 6px', borderRadius:6, background:'rgba(0,230,138,0.04)', marginBottom:2 }}>
                <span style={{ fontWeight:600, fontSize:10 }}>{meal}</span>
                <span style={{ fontSize:9, color:'#00e68a' }}>{Math.round(kcal)} ккал</span>
              </div>
              {items.map((item:any, idx:number) => (
                <div key={idx} style={{ display:'flex', justifyContent:'space-between', padding:'2px 6px', fontSize:9, color:'rgba(255,255,255,0.4)' }}>
                  <span>{item.name}</span>
                  <span>{Math.round(item.kcal||0)}ккал Б{item.p||0} Ж{item.f||0} У{item.c||0}</span>
                </div>
              ))}
            </div>;
          })
        )}
      </div>

      {/* Weekly summary */}
      {foodEntries.length > 0 && (() => {
        const totalKcal = foodEntries.reduce((s, e) => s + e.kcal, 0);
        const totalP = foodEntries.reduce((s, e) => s + e.p, 0);
        const totalF = foodEntries.reduce((s, e) => s + e.f, 0);
        const totalC = foodEntries.reduce((s, e) => s + e.c, 0);
        const days = Math.max(1, new Set(foodEntries.map(e => (e as any).date).filter(Boolean)).size || foodEntries.length / 3);
        return (
          <div style={{ padding:12, borderRadius:14, background:'linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', marginBottom:6 }}>📊 Сводка (~{days} дн)</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4 }}>
              {[
                { l:'Ккал', v:Math.round(totalKcal/days), c:'#22c55e' },
                { l:'Белки', v:Math.round(totalP/days)+'г', c:'#3b82f6' },
                { l:'Жиры', v:Math.round(totalF/days)+'г', c:'#f97316' },
                { l:'Угл.', v:Math.round(totalC/days)+'г', c:'#a855f7' },
              ].map(m => <div key={m.l} style={{ textAlign:'center', background:'rgba(255,255,255,0.02)', borderRadius:6, padding:'4px 2px' }}>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.3)' }}>{m.l}</div>
                <div style={{ fontWeight:700, color:m.c, fontSize:12 }}>{m.v}</div>
              </div>)}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

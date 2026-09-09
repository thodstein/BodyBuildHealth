import React, { useState, useRef, useCallback } from 'react';
import { findFood, quantityToGrams } from '../../../engines/nutrition-ocr-parser';
import { readDiaryV2, writeDiaryV2, exportDiaryJSON, exportDiaryCSV, importDiaryJSON, getStorageInfo } from './diary-storage-v2';
import { NutritionDiaryCharts } from './NutritionDiaryCharts';
import { NutritionQualityCard } from '../../components/NutritionQualityCard';
import { ModernHero, modernCardBg } from './nutrition-modern-kit';
import { useDiaryToast } from './diary/hooks/useDiaryToast';
import { useDiaryData } from './diary/hooks/useDiaryData';
import { useDiarySearch } from './diary/hooks/useDiarySearch';
import { useDiaryMealTypes } from './diary/hooks/useDiaryMealTypes';
import { useDiaryQueue } from './diary/hooks/useDiaryQueue';
import { useDiaryDay } from './diary/hooks/useDiaryDay';
import { useDiaryDayOps } from './diary/hooks/useDiaryDayOps';
import { useDiaryPresets } from './diary/hooks/useDiaryPresets';

// Extracted components
import { DiarySection } from './diary/DiarySection';
import { WeekDaySelector } from './diary/WeekDaySelector';
import { StorageErrorBanner } from './diary/StorageErrorBanner';
import { MacroSummary } from './diary/MacroSummary';
import { MealCard } from './diary/MealCard';
import { AddFoodPanel } from './diary/AddFoodPanel';
import { DayMealsList } from './diary/DayMealsList';
import { QualityInsights } from './diary/QualityInsights';
import { WeekView } from './diary/WeekView';
import { FrequentFoodsPanel } from './diary/FrequentFoodsPanel';

export type { FoodItemLike } from './types';

interface NutritionTargets { kcal: number; protein: number; fats: number; carbs: number; }

export const NutritionDiary: React.FC<{ foodEntries: { name: string; kcal: number; p: number; f: number; c: number }[]; targets?: NutritionTargets; weight?: number; age?: number; sex?: 'male' | 'female'; onDiaryChange?: () => void }> = ({ foodEntries, targets, weight: w, age: a, sex: s, onDiaryChange }) => {
  const weight = w || 80;
  const age = a || 30;
  const sex = s || 'male';
  const [tab, setTab] = useState<'add' | 'day' | 'week'>('add');
  const [showOCR, setShowOCR] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);

  // Состояние разбито по хукам diary/hooks/* (структурный разрез, поведение 1-в-1)
  const { toast, showToast, safeSet } = useDiaryToast();
  const { diaryData, setDiaryData, refreshKey, bumpRefresh, saveDiary, storageError, setStorageError } = useDiaryData({ onDiaryChange });
  const { foodSearch, setFoodSearch, debouncedSearch, usdaFoods } = useDiarySearch();
  const { mealType, setMealType, allMealTypes, customMealInput, setCustomMealInput, addCustomMeal } = useDiaryMealTypes({ tab, safeSet, showToast });
  const { selectedDate, setSelectedDate, weekDays, dayMeals, dayTotals, dayMicros, mealQuality, dayQuality, favoriteFoods, recentFoods } = useDiaryDay({ diaryData, refreshKey });
  const {
    ocrText, setOcrText, parsedItems, setParsedItems, ocrError, ocrHint, ocrFileLoading,
    showCustomFood, setShowCustomFood,
    customFoodName, setCustomFoodName, customFoodKcal, setCustomFoodKcal, customFoodP, setCustomFoodP,
    customFoodF, setCustomFoodF, customFoodC, setCustomFoodC,
    addFoodFromDB, handleDirectAdd, handleBarcodeProduct,
    fillQueuedMicros, handleOcrFileUpload, handleOCR, saveItemsToDiary,
    addCustomFood, updateParsedItemQty, extractQty, addPresetItems,
  } = useDiaryQueue({ diaryData, selectedDate, mealType, usdaFoods, saveDiary, showToast, bumpRefresh, setShowBarcode, setFoodSearch });
  const {
    editItem, setEditItem, editQty, setEditQty, copySource, setCopySource, copiedDay,
    clearDayConfirmOpen, setClearDayConfirmOpen,
    foodPatterns, foodTriggers, mealMood,
    deleteItem, clearDay, confirmClearDay, openEdit, saveEdit,
    copyMeal, pasteMeal, copyDay, pasteDay,
    saveMealMood, savePatterns, saveTriggers,
    importFromPlan, fillDayMicros,
  } = useDiaryDayOps({ diaryData, selectedDate, saveDiary, showToast, safeSet });
  const {
    dayPresets, mealPresets,
    presetDialog, setPresetDialog, presetName, setPresetName,
    dayPresetDialogOpen, setDayPresetDialogOpen, dayPresetName, setDayPresetName,
    savePreset, confirmSavePreset, saveDayPreset, confirmSaveDayPreset, loadDayPreset,
  } = useDiaryPresets({ diaryData, selectedDate, saveDiary, showToast, safeSet, extractQty });

  const microLabels: Record<string, { name: string; unit: string; target: number }> = {
    sodium_mg: { name: 'Натрий', unit: 'мг', target: 2300 }, potassium_mg: { name: 'Калий', unit: 'мг', target: 3500 }, magnesium_mg: { name: 'Магний', unit: 'мг', target: 400 }, calcium_mg: { name: 'Кальций', unit: 'мг', target: 1000 }, iron_mg: { name: 'Железо', unit: 'мг', target: sex === 'female' ? 18 : 8 }, zinc_mg: { name: 'Цинк', unit: 'мг', target: sex === 'female' ? 8 : 11 }, vitamin_c_mg: { name: 'Витамин C', unit: 'мг', target: sex === 'female' ? 75 : 90 }, vitamin_d_mcg: { name: 'Витамин D', unit: 'мкг', target: 15 }, vitamin_b12_mcg: { name: 'Витамин B12', unit: 'мкг', target: 2.4 }, fiber_g: { name: 'Клетчатка', unit: 'г', target: 30 },
  };

  // Состояние поиска/очереди/дня/пресетов — см. diary/hooks/* (разрез без смены поведения)

  const ocrFileRef = useRef<HTMLInputElement>(null);
  const ocrCameraRef = useRef<HTMLInputElement>(null);

  // (хуки данных/поиска/типов приёмов/недели — см. выше)

  // (итоги/микро дня — useDiaryDay; microLabels определён выше в композиции)

  // (качество/избранное/недавнее — useDiaryDay)

  // (очередь/OCR/поиск еды — useDiaryQueue)

  // (операции дня/правка/копирование/настроение — useDiaryDayOps)
  const [clearDiaryConfirmOpen, setClearDiaryConfirmOpen] = useState(false);
  const confirmClearDiary = useCallback(() => {
    writeDiaryV2({});
    setDiaryData({});
    bumpRefresh();
    setClearDiaryConfirmOpen(false);
    showToast('🗑 Дневник очищен');
  }, [showToast, setDiaryData, bumpRefresh]);

  // (своя еда/пресеты очереди — useDiaryQueue)

  // (пресеты приёмов/дней — useDiaryPresets; clearDiaryConfirmOpen — шелл ниже)

  const printDay = useCallback(() => {
    const day = diaryData[selectedDate];
    if (!day?.meals) { showToast('❌ День пуст — нечего печатать'); return; }
    const esc = (s:string)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const rows = Object.entries(day.meals).flatMap(([meal, items]:any)=>
      (items as any[]).map((it:any)=>`<tr><td>${esc(meal)}</td><td>${esc(it.name)}</td><td>${esc(it.qty||'')}</td><td>${it.kcal||0}</td><td>${it.p||0}</td><td>${it.f||0}</td><td>${it.c||0}</td></tr>` )
    ).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Дневник ${selectedDate}</title><style>body{font-family:system-ui;padding:20px;color:#111}h2{margin:0 0 10px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px;font-size:12px;text-align:left}th{background:#f5f5f5}tfoot td{font-weight:700;background:#f9f9f9}</style></head><body><h2>🍽 Дневник ${selectedDate} — ${Math.round(dayTotals.kcal)} ккал (Б${Math.round(dayTotals.p)} Ж${Math.round(dayTotals.f)} У${Math.round(dayTotals.c)})</h2><table><tr><th>Приём</th><th>Продукт</th><th>Кол-во</th><th>Ккал</th><th>Б</th><th>Ж</th><th>У</th></tr>${rows}<tr><td colspan="3"><b>Итого</b></td><td><b>${Math.round(dayTotals.kcal)}</b></td><td><b>${Math.round(dayTotals.p)}</b></td><td><b>${Math.round(dayTotals.f)}</b></td><td><b>${Math.round(dayTotals.c)}</b></td></tr></table><p style="font-size:10px;color:#666;margin-top:10px">Печать из BodyBuildHealth • ${new Date().toLocaleDateString('ru-RU')}</p></body></html>`;
    const w = window.open('', '_blank', 'width=800,height=900'); if(!w) return; w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>{ try{ w.print(); }catch{} }, 300);
  }, [diaryData, selectedDate, dayTotals, showToast]);

  return (
    <div className="food-diary nd-root" data-tab={tab} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toast && (
        <div className="nut-diary-toast" style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 999,
          padding: '10px 24px', borderRadius: 14, background: '#202023', border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', color: '#fff', fontSize: 12, fontWeight: 600, letterSpacing: '-0.1px' }}>
          {toast}
        </div>
      )}
      
      {/* Живой баннер ошибок хранилища (PRO-стекло + детали; без recovery-кнопок: экспорта хватает в секции Данные) */}
      <StorageErrorBanner error={storageError} onDismiss={() => setStorageError(null)} />
      
      
      <ModernHero icon="📓" title="Дневник питания" subtitle="Учёт приёмов, КБЖУ, микронутриенты и качество — с OCR, штрихкодом и аналитикой. Все данные локально." count={Object.keys(diaryData).length} stats={[
        { k:'Дней', v: Object.keys(diaryData).length, sub:'записей', col:'#00e68a', bg:'rgba(0,230,138,0.08)' },
        { k:'Ккал', v: Math.round(dayTotals.kcal), sub:'сегодня', col:'#f59e0b', bg:'rgba(245,158,11,0.08)' },
        { k:'Приёмов', v: Object.values(dayMeals).flat().length, sub:'сегодня', col:'#60a5fa', bg:'rgba(96,165,250,0.08)' },
      ]} />

      {/* Week day selector */}
      <WeekDaySelector weekDays={weekDays} selectedDate={selectedDate} onSelectDate={setSelectedDate} diaryData={diaryData} />

      {/* Tab bar — сегменты дневника: липкая лента в APK (§89), в TG — те же инлайны */}
      <div className="nd-tabs" role="tablist" aria-label="Разделы дневника" style={{ display:'flex', gap:8, padding:8, borderRadius:16, background:'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border:'1px solid rgba(255,255,255,0.06)', backdropFilter:'blur(12px)', boxShadow:'0 4px 20px rgba(0,0,0,0.15)' }}>
        {([
          { key: 'add', label: 'Добавить', icon:'➕', badge: parsedItems.length>0 ? parsedItems.length : null, color:'#00e68a', desc:'поиск' },
          { key: 'day', label: 'День', icon:'📋', badge: Object.values(dayMeals).flat().length || null, color:'#60a5fa', desc:'приёмы' },
          { key: 'week', label: 'Неделя', icon:'📊', badge: Object.keys(diaryData).length || null, color:'#a78bfa', desc:'итоги' },
        ] as const).map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} aria-label={t.label} data-active={tab === t.key} className="nd-tab" onClick={() => setTab(t.key as any)} style={{
            flex: 1, padding:'14px 10px', borderRadius:12, cursor:'pointer', fontSize:13, fontWeight: tab === t.key ? 800 : 600, position:'relative', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3,
            border: tab === t.key ? `1.5px solid ${t.color}` : '1px solid rgba(255,255,255,0.06)',
            background: tab === t.key ? `linear-gradient(135deg, ${t.color}18, ${t.color}0d)` : '#202023',
            color: tab === t.key ? t.color : 'rgba(255,255,255,0.65)', minHeight: 56, transition:'all 0.2s cubic-bezier(0.22,1,0.36,1)', boxShadow: tab === t.key ? `0 6px 20px ${t.color}28, inset 0 1px 0 rgba(255,255,255,0.08)` : '0 2px 8px rgba(0,0,0,0.1)',
            transform: tab === t.key ? 'translateY(-1px)' : 'none',
          }}>
            <span style={{ fontSize:18, filter: tab===t.key ? 'none' : 'grayscale(0.2)', transition:'all 0.2s' }}>{t.icon}</span>
            <span style={{ fontSize:13, fontWeight:800, letterSpacing:-0.2 }}>{t.label}</span>
            <span style={{ fontSize:8, fontWeight:600, color: tab===t.key ? t.color+'b0' : 'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:0.5 }}>{t.desc}</span>
            {t.badge ? <span style={{ position:'absolute', top:6, right:8, fontSize:9, background: tab===t.key ? t.color : 'rgba(255,255,255,0.08)', color: tab===t.key ? '#000' : t.color, padding:'2px 6px', borderRadius:999, fontWeight:800, minWidth:18, textAlign:'center', boxShadow: tab===t.key ? `0 2px 6px ${t.color}40` : 'none' }}>{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* Macro summary — modern card */}
      <div className="nd-macros-card" style={{ ...modernCardBg, padding:12, border:'1px solid rgba(0,230,138,0.10)' }}>
        <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.5)', letterSpacing:0.6, textTransform:'uppercase', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ width:22, height:22, borderRadius:8, background:'rgba(0,230,138,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10 }}>📊</span> КБЖУ за день
          <span style={{ marginLeft:'auto', fontSize:9, padding:'3px 7px', borderRadius:999, background: dayTotals.kcal > (targets?.kcal||2500) ? 'rgba(239,68,68,0.10)' : 'rgba(0,230,138,0.08)', color: dayTotals.kcal > (targets?.kcal||2500) ? '#ef4444' : '#00e68a', border:`1px solid ${dayTotals.kcal > (targets?.kcal||2500) ? 'rgba(239,68,68,0.15)' : 'rgba(0,230,138,0.12)'}` }}>{Math.round(dayTotals.kcal)}/{targets?.kcal||2500} ккал</span>
        </div>
        <MacroSummary dayTotals={dayTotals} targets={targets} />
      </div>
      
      
      
      
      
      {/* Tab content */}
      {tab === 'add' && (
        <>
        <DiarySection id="add" icon="🔍" title="Добавление" sub="поиск · штрихкод · фото · очередь" color="#00e68a" count={parsedItems.length > 0 ? `${parsedItems.length} в очереди` : null}>
        <AddFoodPanel
          foodSearch={foodSearch} onFoodSearchChange={setFoodSearch} debouncedSearch={debouncedSearch}
          usdaFoods={usdaFoods} mealType={mealType} onMealTypeChange={setMealType}
          allMealTypes={allMealTypes} onAddFoodFromDB={addFoodFromDB} onDirectAdd={handleDirectAdd}
          customMealInput={customMealInput} onCustomMealInputChange={setCustomMealInput} onAddCustomMeal={addCustomMeal}
           onShowBarcode={() => setShowBarcode(true)} onCloseBarcode={() => setShowBarcode(false)} showBarcode={showBarcode} onBarcodeProduct={handleBarcodeProduct}
          onOcrFile={handleOcrFileUpload} ocrFileLoading={ocrFileLoading}
          onShowOCR={() => setShowOCR(!showOCR)} showOCR={showOCR}
          ocrText={ocrText} onOcrTextChange={setOcrText} onOcrSubmit={handleOCR}
          ocrError={ocrError} ocrHint={ocrHint} onOcrClose={() => { setShowOCR(false); setOcrText(''); }}
          parsedItems={parsedItems} onRemoveParsedItem={(i) => setParsedItems(prev => prev.filter((_, j) => j !== i))}
          onUpdateParsedItemQty={updateParsedItemQty} onFillMicros={fillQueuedMicros}
          onSaveItems={() => saveItemsToDiary(parsedItems)}
          onEditParsedItem={(idx, updated) => setParsedItems(prev => prev.map((item, i) => i === idx ? { ...item, ...updated } : item))}
          onFixAllLowConfidence={() => setParsedItems(prev => prev.map(item => {
            if (typeof item.confidence === 'number' && item.confidence < 0.5) {
              const food = findFood(item.name);
              if (food) {
                const qty = Math.max(1, item.qtyGrams || quantityToGrams(String(item.qty ?? '100 г'), food));
                const mult = qty / 100;
                return {
                  ...item,
                  name: food.name,
                  qty: qty + ' г',
                  qtyGrams: qty,
                  kcal: Math.round(food.kcal * mult),
                  p: Math.round(food.protein * mult * 10) / 10,
                  f: Math.round(food.fat * mult * 10) / 10,
                  c: Math.round(food.carbs * mult * 10) / 10,
                  foodId: food.id,
                  category: food.category,
                  confidence: 0.9,
                };
              }
            }
            return item;
          }))}
          favoriteFoods={favoriteFoods} mealPresets={mealPresets} onAddPreset={addPresetItems}
          showCustomFood={showCustomFood} onToggleCustomFood={() => setShowCustomFood(!showCustomFood)}
          customFoodName={customFoodName} onCustomFoodNameChange={setCustomFoodName}
          customFoodKcal={customFoodKcal} customFoodP={customFoodP} customFoodF={customFoodF} customFoodC={customFoodC}
          onCustomFoodFieldChange={(f, v) => {
            if (f === 'customFoodKcal') setCustomFoodKcal(v);
            else if (f === 'customFoodP') setCustomFoodP(v);
            else if (f === 'customFoodF') setCustomFoodF(v);
            else if (f === 'customFoodC') setCustomFoodC(v);
          }}
          onAddCustomFood={addCustomFood}
          ocrFileRef={ocrFileRef} ocrCameraRef={ocrCameraRef}
        />
        </DiarySection>
        {/* FatSecret-уровень: частые продукты 1-клик */}
        <FrequentFoodsPanel diary={diaryData} onAddFood={(food, mealType) => {
          const data = { ...diaryData };
          if (!data[selectedDate]) data[selectedDate] = { meals: {} };
          if (!data[selectedDate].meals[mealType]) data[selectedDate].meals[mealType] = [];
          data[selectedDate].meals[mealType].push({ ...food });
          saveDiary(data);
          showToast(`⚡ ${food.name} → ${mealType}`);
        }} />
        {recentFoods.length > 0 && (
          <div className="nd-recent" style={{ padding: 12, borderRadius: 16, background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(59,130,246,0.02))', border: '1px solid rgba(59,130,246,0.12)', backdropFilter: 'blur(12px)', marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 24, height: 24, borderRadius: 8, background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🕒</span>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Недавние</div>
              <span style={{ fontSize: 9, background: 'rgba(59,130,246,0.12)', color: '#60a5fa', padding: '2px 7px', borderRadius: 999, border: '1px solid rgba(59,130,246,0.18)', fontWeight: 700 }}>1-клик</span>
              <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{recentFoods.length} блюд</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {recentFoods.slice(0, 8).map(f => (
                <button key={f.name} onClick={() => {
                  const data = { ...diaryData };
                  if (!data[selectedDate]) data[selectedDate] = { meals: {} };
                  const mt = mealType || 'Перекус';
                  if (!data[selectedDate].meals[mt]) data[selectedDate].meals[mt] = [];
                  data[selectedDate].meals[mt].push({ ...f });
                  saveDiary(data);
                  showToast(`🕒 ${f.name} → ${mt}`);
                }} className="nd-recent-chip" style={{ padding: '10px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer', minHeight: 44, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.14)', color: '#60a5fa', whiteSpace: 'nowrap', fontWeight: 600, transition: 'all 0.15s', backdropFilter: 'blur(8px)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.14)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(59,130,246,0.08)'}>
                  {f.name.length>14 ? f.name.slice(0,13)+'…' : f.name} <span style={{ opacity: 0.7, fontWeight: 400 }}>· {Math.round(f.kcal)}ккал</span>
                </button>
              ))}
            </div>
          </div>
        )}
        </>
       )}

      {tab === 'day' && (
        <>
          {/* Полезность — внутри секции «Качество дня» ниже */}

          {Object.keys(dayMicros).length > 0 && (<DiarySection id="micros" icon="🧪" title="Микронутриенты" sub="витамины · минералы · клетчатка" color="#22c55e"><div className="nd-micros" style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', marginBottom: 6 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}><div style={{ fontSize: 10, fontWeight: 700, color: '#86efac' }}>🧪 Микронутриенты за день</div><button onClick={() => { const txt = Object.entries(dayMicros).filter(([k]) => microLabels[k]).map(([k, v]) => { const info = microLabels[k]; return `${info.name}: ${Math.round(v * 10) / 10} ${info.unit} (${Math.round(v / info.target * 100)}%)`; }).join('\n'); try { void navigator.clipboard?.writeText(`Микро ${selectedDate}\n${txt}`); showToast('📋 Микро скопированы'); } catch { showToast('❌ Не удалось скопировать'); } }} aria-label="Копировать микронутриенты" style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, cursor: 'pointer', minHeight: 44, minWidth: 44 }}>📋</button></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>{Object.entries(dayMicros).filter(([key]) => microLabels[key]).map(([key, value]) => { const info = microLabels[key]; const pct = Math.round(value / info.target * 100); return <div key={key} style={{ padding: '4px 6px', borderRadius: 7, background: 'rgba(255,255,255,0.04)' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8 }}><span style={{ color: 'rgba(255,255,255,0.75)' }}>{info.name}</span><span style={{ color: pct >= 80 ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>{Math.round(value * 10) / 10} {info.unit}</span></div><div style={{ marginTop: 3, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}><div style={{ height: '100%', width: `${Math.min(100, pct)}%`, borderRadius: 2, background: pct >= 80 ? '#22c55e' : '#f59e0b' }} /></div><div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{pct}% от ориентира</div></div>; })}</div></div></DiarySection>)}
          <DiarySection id="actions" icon="⚡" title="Действия дня" sub="копия · шаблоны · печать" color="#00e68a">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            <button onClick={copyDay} className="nd-copyday" style={{ padding:'12px', borderRadius:12, border:'1px solid rgba(0,230,138,0.18)', background:'rgba(0,230,138,0.08)', color:'#00e68a', fontSize:12, fontWeight:700, cursor:'pointer', minHeight:44, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><span style={{ width:22, height:22, borderRadius:8, background:'rgba(0,230,138,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>📋</span> Копировать день</button>
            {copiedDay ? <button onClick={() => pasteDay(selectedDate)} className="nd-pasteday" style={{ padding:'12px', borderRadius:12, border:'1px solid rgba(139,92,246,0.18)', background:'rgba(139,92,246,0.08)', color:'#a78bfa', fontSize:12, fontWeight:700, cursor:'pointer', minHeight:44, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><span style={{ width:22, height:22, borderRadius:8, background:'rgba(139,92,246,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>📥</span> Вставить {copiedDay.slice(5)}</button> : <button onClick={saveDayPreset} className="nd-daypreset-save" style={{ padding:'12px', borderRadius:12, border:'1px solid rgba(245,158,11,0.18)', background:'rgba(245,158,11,0.08)', color:'#f59e0b', fontSize:12, fontWeight:700, cursor:'pointer', minHeight:44, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><span style={{ width:22, height:22, borderRadius:8, background:'rgba(245,158,11,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>💾</span> Шаблон дня</button>}
            <button onClick={printDay} className="nd-printday" style={{ padding:'12px', borderRadius:12, border:'1px solid rgba(59,130,246,0.18)', background:'rgba(59,130,246,0.08)', color:'#60a5fa', fontSize:12, fontWeight:700, cursor:'pointer', minHeight:44, display:'flex', alignItems:'center', justifyContent:'center', gap:6, gridColumn: copiedDay ? 'span 2' : 'auto' }}><span style={{ width:22, height:22, borderRadius:8, background:'rgba(59,130,246,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>🖨</span> Печать дня</button>
          </div>
          {dayPresets.length>0 && (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
              {dayPresets.slice(0,6).map((p:any,i:number)=>(
                <button key={i} onClick={()=>loadDayPreset(p)} className="nd-daypreset" style={{ padding:'10px 14px', borderRadius:10, fontSize:12, cursor:'pointer', minHeight:44, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.15)', color:'#f59e0b' }}>📦 {p.name}</button>
              ))}
            </div>
          )}
          </DiarySection>
          <DiarySection id="meals" icon="🍽" title="Приёмы пищи" sub={selectedDate} color="#60a5fa" count={`${Object.values(dayMeals).flat().length} поз.`}>
          <DayMealsList
            dayMeals={dayMeals}
            onEditItem={openEdit} onDeleteItem={deleteItem}
            onCopyMeal={copyMeal} onSavePreset={savePreset}
            onImportFromPlan={importFromPlan} onClearDay={clearDay}
            onFillMicros={fillDayMicros}
            selectedDate={selectedDate} copySource={copySource}
            onPasteMeal={pasteMeal} onCancelCopy={() => setCopySource(null)}
          />
          </DiarySection>
          <DiarySection id="quality" icon="⭐" title="Качество дня" sub="полезность · настроение · паттерны" color="#a78bfa">
          {dayQuality && dayQuality.scoredCount > 0 && (
            <div className="nd-useful" style={{ padding: '10px 14px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.06))', border: '1px solid rgba(139,92,246,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>⭐ Полезность продуктов</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
                  {dayQuality.scoredCount}/{dayQuality.total} оценено · средний {dayQuality.avg}/10
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {dayQuality.perProduct.slice(0, 12).map((p, i) => (
                  <span key={i} title={`${p.name}: ${p.score}/10`} style={{
                    padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: `${p.color}18`, border: `1px solid ${p.color}30`,
                    color: p.color, whiteSpace: 'nowrap',
                  }}>{p.name.length > 16 ? p.name.slice(0, 15) + '…' : p.name} {p.score}</span>
                ))}
                {dayQuality.perProduct.length > 12 && (
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', padding: '3px 6px' }}>
                    +{dayQuality.perProduct.length - 12} ещё
                  </span>
                )}
              </div>
            </div>
          )}
          <QualityInsights
            mealQuality={mealQuality} selectedDate={selectedDate} dayMeals={dayMeals}
            foodPatterns={foodPatterns} foodTriggers={foodTriggers}
            onSavePattern={savePatterns} onSaveTrigger={saveTriggers}
            mealMood={mealMood} onSaveMealMood={saveMealMood}
          />

          <NutritionQualityCard
            meals={Object.entries(dayMeals).map(([mealName, raw]: [string, any]) => {
              const items = Array.isArray(raw) ? raw : [];
              return {
                foods: items.map((i: any) => ({
                  id: i.name || 'unknown', name: i.name || '', grams: parseInt(i.qty) || 100,
                  protein: i.p || 0, fat: i.f || 0, carbs: i.c || 0, kcal: i.kcal || 0, fiber: 0,
                })),
              };
            })}
            weight={weight} age={age} sex={sex} goal={sex === 'male' ? 'maintain' : 'maintain'} activityLevel="moderate"
          />
          </DiarySection>
          {Object.keys(dayMeals).length > 0 && (
          <DiarySection id="charts" icon="📈" title="Аналитика" sub="баланс · динамика · топ продуктов" color="#8b5cf6">
          <NutritionDiaryCharts
            dayMeals={dayMeals} dayTotals={dayTotals} targets={targets}
            diaryData={diaryData} selectedDate={selectedDate} refreshKey={refreshKey}
          />
          </DiarySection>
          )}
        </>
      )}

      {tab === 'week' && (
        <DiarySection id="week" icon="📊" title="Неделя" sub="итоги · по дням" color="#a78bfa">
        <WeekView diaryData={diaryData} targets={targets || { kcal: 2500, protein: 160, fats: 70, carbs: 300 }} selectedDate={selectedDate} onSelectDate={(d)=>{ setSelectedDate(d); setTab('day'); }} />
        </DiarySection>
      )}

      {/* Edit modal */}
      {editItem && (
        <div role="dialog" aria-modal="true" aria-label="Изменить количество" className="nd-edit" style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', padding: '12px' }}
          onClick={() => setEditItem(null)}
          onKeyDown={e => { if (e.key === 'Escape') setEditItem(null); }}>
          <div onClick={e => e.stopPropagation()} className="nd-editsheet" style={{ width: '100%', maxWidth: 400, padding: '16px 20px 28px', borderRadius: '20px', background: '#18181b', boxShadow: '0 18px 54px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 2, letterSpacing: -0.3 }}>✎ {editItem.item.name}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>Изменить количество</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <button onClick={() => setEditQty(Math.max(10, editQty - 10))} aria-label="Уменьшить количество" style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: '#202023', color: '#fff', cursor: 'pointer', fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <input type="number" value={editQty} onChange={e => { const raw = parseFloat(e.target.value); setEditQty(Number.isFinite(raw) && raw >= 10 ? Math.round(raw) : 10); }} aria-label="Количество, грамм" style={{ width: 80, padding: '8px', borderRadius: 10, background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 20, fontWeight: 700, textAlign: 'center', outline: 'none' }} />
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>грамм</div>
              </div>
              <button onClick={() => setEditQty(Math.min(1000, editQty + 10))} aria-label="Увеличить количество" style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: '#202023', color: '#fff', cursor: 'pointer', fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
            <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 10 }}>
              {[50, 100, 150, 200, 300].map(v => (
                <button key={v} onClick={() => setEditQty(v)} aria-label={`${v} грамм`} aria-pressed={editQty === v} className="nd-editqty" style={{ padding: '6px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: editQty === v ? 'rgba(0,230,138,0.12)' : '#202023', color: editQty === v ? '#00e68a' : 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 12, fontWeight: editQty === v ? 600 : 400, minHeight: 44 }}>
                  {v}г
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 12, textAlign: 'center' }}>
              → <span style={{ color: '#00e68a', fontWeight: 700 }}>{Math.round(editQty * (editItem.item.kcal || 0) / 100)} ккал</span> · 
              <span style={{ color: '#60a5fa' }}> {Math.round(((editItem.item.p || 0) * editQty / 100) * 10) / 10}г Б</span> · 
              <span style={{ color: '#fbbf24' }}> {Math.round(((editItem.item.f || 0) * editQty / 100) * 10) / 10}г Ж</span> · 
              <span style={{ color: '#fb923c' }}> {Math.round(((editItem.item.c || 0) * editQty / 100) * 10) / 10}г У</span>
            </div>
            <button onClick={saveEdit} aria-label="Сохранить изменения" style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontWeight: 700, fontSize: 13, minHeight: 48, boxShadow: '0 4px 20px rgba(0,230,138,0.2)' }}>
              ✓ Сохранить
            </button>
          </div>
        </div>
      )}
      
      {/* Данные: экспорт/импорт/очистка — modern PRO (хуки nd-import/nd-wipeall сохранены для APK-CSS) */}
      <DiarySection id="data" icon="💾" title="Данные" sub="экспорт · импорт · очистка" color="#60a5fa">
      <div className="nd-data-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <button
          onClick={() => {
            const json = exportDiaryJSON();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `diary_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
          }}
          className="nd-data-btn"
          style={{ padding: '12px', borderRadius: 14, border: '1px solid rgba(0,230,138,0.18)', background: 'rgba(0,230,138,0.06)', color: '#00e68a', cursor: 'pointer', fontSize: 12, fontWeight: 700, minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <span style={{ width: 22, height: 22, borderRadius: 8, background: 'rgba(0,230,138,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>📥</span> Экспорт JSON
        </button>
        
        <button
          onClick={() => {
            const csv = exportDiaryCSV();
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `diary_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
          }}
          className="nd-data-btn"
          style={{ padding: '12px', borderRadius: 14, border: '1px solid rgba(59,130,246,0.20)', background: 'rgba(59,130,246,0.06)', color: '#60a5fa', cursor: 'pointer', fontSize: 12, fontWeight: 700, minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <span style={{ width: 22, height: 22, borderRadius: 8, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>📥</span> Экспорт CSV
        </button>
        
        <label className="nd-import" style={{ gridColumn: 'span 2', padding: '12px', borderRadius: 14, border: '1px solid rgba(245,158,11,0.20)', background: 'rgba(245,158,11,0.06)', color: '#fbbf24', cursor: 'pointer', fontSize: 12, fontWeight: 700, minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{ width: 22, height: 22, borderRadius: 8, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>📤</span> Импорт JSON
          <input
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const json = ev.target?.result as string;
                  const result = importDiaryJSON(json);
                  if (result.success) {
                    setDiaryData(readDiaryV2());
                    bumpRefresh();
                  } else {
                    setStorageError('Ошибка импорта: ' + result.error);
                  }
                };
                reader.readAsText(file);
              }
            }}
          />
        </label>
        
        </div>
        <button
          onClick={() => setClearDiaryConfirmOpen(true)}
          aria-label="Очистить весь дневник"
          className="nd-wipeall"
          style={{ width: '100%', padding: '12px', borderRadius: 14, border: '1px solid rgba(239,68,68,0.20)', background: 'rgba(239,68,68,0.06)', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 700, minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <span style={{ width: 22, height: 22, borderRadius: 8, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>🗑</span> Очистить всё
        </button>
        <div className="nd-data-meta" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
          {Object.keys(diaryData).length} дн. в дневнике · данные только локально
          {process.env.NODE_ENV === 'development' && (
            <span> · {getStorageInfo().daysStored} дн. · {getStorageInfo().estimatedSizeKB.toFixed(1)} KB</span>
          )}
        </div>
      </DiarySection>
      {tab !== 'add' && (
        <button onClick={()=>setTab('add')} aria-label="Быстро добавить" className="nut-diary-fab" style={{ position:'fixed', bottom:20, right:20, width:56, height:56, borderRadius:16, background:'linear-gradient(135deg,#00e68a,#00c8a0)', border:'none', boxShadow:'0 6px 20px rgba(0,230,138,0.35)', fontSize:26, cursor:'pointer', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', color:'#000', fontWeight:700 }}>＋</button>
      )}

      {/* Modern popups */}
      {presetDialog && (
        <div role="dialog" aria-modal="true" aria-label="Сохранить набор" className="nd-pdlg" onClick={e => { if (e.target===e.currentTarget) setPresetDialog(null); }} style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div className="nd-pdlg-sheet" style={{ width:'100%', maxWidth:380, padding:20, borderRadius:20, background:'linear-gradient(135deg, #1a1c26 0%, #18181b 100%)', border:'1px solid rgba(0,230,138,0.2)', boxShadow:'0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,230,138,0.08)', backdropFilter:'blur(20px)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <span style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#00e68a,#00c8a0)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>📦</span>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:'#00e68a' }}>Сохранить набор</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>{presetDialog.items.length} поз. • {presetDialog.meal}</div>
              </div>
              <button onClick={()=>setPresetDialog(null)} aria-label="Закрыть" className="nd-pdlg-close" style={{ marginLeft:'auto', width:44, height:44, borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:14 }}>✕</button>
            </div>
            <input autoFocus value={presetName} onChange={e=>setPresetName(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') confirmSavePreset(); if(e.key==='Escape') setPresetDialog(null); }} placeholder="Название набора, например: Завтрак спортсмена" aria-label="Название набора" className="nd-pdlg-input" style={{ width:'100%', boxSizing:'border-box', padding:'12px 14px', borderRadius:12, background:'#202023', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:16, outline:'none', minHeight:48 }} />
            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              <button onClick={()=>setPresetDialog(null)} className="nd-pdlg-cancel" style={{ flex:1, padding:'11px', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.7)', fontWeight:600, cursor:'pointer', minHeight:48 }}>Отмена</button>
              <button onClick={confirmSavePreset} className="nd-pdlg-save" style={{ flex:1, padding:'11px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontWeight:700, cursor:'pointer', minHeight:48, boxShadow:'0 4px 16px rgba(0,230,138,0.25)' }}>💾 Сохранить</button>
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:8, textAlign:'center' }}>Сохранит КБЖУ на 100г • при сборке можно менять граммы</div>
          </div>
        </div>
      )}
      {dayPresetDialogOpen && (
        <div role="dialog" aria-modal="true" aria-label="Шаблон дня" className="nd-ddlg" onClick={e => { if (e.target===e.currentTarget) setDayPresetDialogOpen(false); }} style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div className="nd-ddlg-sheet" style={{ width:'100%', maxWidth:380, padding:20, borderRadius:20, background:'linear-gradient(135deg, #1a1c26 0%, #18181b 100%)', border:'1px solid rgba(245,158,11,0.2)', boxShadow:'0 20px 60px rgba(0,0,0,0.6)', backdropFilter:'blur(20px)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <span style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#f59e0b,#f97316)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>💾</span>
              <div><div style={{ fontSize:14, fontWeight:800, color:'#f59e0b' }}>Шаблон дня</div><div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>{selectedDate} • {Object.values(dayMeals).flat().length} поз.</div></div>
              <button onClick={()=>setDayPresetDialogOpen(false)} aria-label="Закрыть" className="nd-ddlg-close" style={{ marginLeft:'auto', width:44, height:44, borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:14 }}>✕</button>
            </div>
            <input autoFocus value={dayPresetName} onChange={e=>setDayPresetName(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') confirmSaveDayPreset(); if(e.key==='Escape') setDayPresetDialogOpen(false); }} placeholder="Название шаблона" aria-label="Название шаблона" className="nd-ddlg-input" style={{ width:'100%', boxSizing:'border-box', padding:'12px 14px', borderRadius:12, background:'#202023', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:16, outline:'none', minHeight:48 }} />
            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              <button onClick={()=>setDayPresetDialogOpen(false)} className="nd-ddlg-cancel" style={{ flex:1, padding:'11px', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.7)', fontWeight:600, cursor:'pointer', minHeight:48 }}>Отмена</button>
              <button onClick={confirmSaveDayPreset} className="nd-ddlg-save" style={{ flex:1, padding:'11px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#f59e0b,#f97316)', color:'#000', fontWeight:700, cursor:'pointer', minHeight:48 }}>💾 Сохранить</button>
            </div>
          </div>
        </div>
      )}
      {clearDayConfirmOpen && (
        <div role="alertdialog" aria-modal="true" aria-label="Очистить день" className="nd-confirm" onClick={e => { if (e.target===e.currentTarget) setClearDayConfirmOpen(false); }} onKeyDown={e => { if (e.key === 'Escape') setClearDayConfirmOpen(false); }} style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div className="nd-confirm-sheet" style={{ width:'100%', maxWidth:360, padding:20, borderRadius:20, background:'linear-gradient(135deg, #1a1c26 0%, #18181b 100%)', border:'1px solid rgba(239,68,68,0.25)', boxShadow:'0 20px 60px rgba(0,0,0,0.6)', backdropFilter:'blur(20px)' }}>
            <div style={{ fontSize:14, fontWeight:800, color:'#ef4444', marginBottom:8 }}>⚠️ Очистить день?</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', lineHeight:1.5, marginBottom:16 }}>Все приёмы за <b style={{color:'#fff'}}>{selectedDate}</b> будут удалены. Это нельзя отменить.</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setClearDayConfirmOpen(false)} className="nd-confirm-cancel" style={{ flex:1, padding:'11px', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'#fff', fontWeight:600, cursor:'pointer', minHeight:48 }}>Отмена</button>
              <button onClick={confirmClearDay} className="nd-confirm-go" style={{ flex:1, padding:'11px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff', fontWeight:700, cursor:'pointer', minHeight:48 }}>🗑 Очистить</button>
            </div>
          </div>
        </div>
      )}
      {clearDiaryConfirmOpen && (
        <div role="alertdialog" aria-modal="true" aria-label="Очистить весь дневник" className="nd-confirm" onClick={e => { if (e.target===e.currentTarget) setClearDiaryConfirmOpen(false); }} onKeyDown={e => { if (e.key === 'Escape') setClearDiaryConfirmOpen(false); }} style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div className="nd-confirm-sheet" style={{ width:'100%', maxWidth:360, padding:20, borderRadius:20, background:'linear-gradient(135deg, #1a1c26 0%, #18181b 100%)', border:'1px solid rgba(239,68,68,0.25)', boxShadow:'0 20px 60px rgba(0,0,0,0.6)', backdropFilter:'blur(20px)' }}>
            <div style={{ fontSize:14, fontWeight:800, color:'#ef4444', marginBottom:8 }}>⚠️ Очистить весь дневник?</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', lineHeight:1.5, marginBottom:16 }}>Удалятся все дни и приёмы без возможности восстановления. Рекомендуем сначала сделать экспорт JSON/CSV.</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setClearDiaryConfirmOpen(false)} className="nd-confirm-cancel" style={{ flex:1, padding:'11px', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'#fff', fontWeight:600, cursor:'pointer', minHeight:48 }}>Отмена</button>
              <button onClick={confirmClearDiary} className="nd-confirm-go" style={{ flex:1, padding:'11px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff', fontWeight:700, cursor:'pointer', minHeight:48 }}>🗑 Удалить всё</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

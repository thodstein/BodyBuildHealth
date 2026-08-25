import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FOOD_DB } from '../../../../core/nutrition-database';
import { CAT_MAP_EMOJI } from '../../../../core/nutrition-utils';
import { type FoodItemLike } from '../NutritionDiary';
import { BarcodeScanner } from '../../../components/BarcodeScanner';
import { type OFFProduct, productToFoodItem } from '../../../../engines/openfoodfacts.engine';
import { processUploadedFile } from '../../../../core/ocr-engine';
import { parseNutritionText, findFood } from '../../../../engines/nutrition-ocr-parser';

interface AddFoodPanelProps {
  foodSearch: string;
  onFoodSearchChange: (v: string) => void;
  debouncedSearch: string;
  usdaFoods: FoodItemLike[];
  mealType: string;
  onMealTypeChange: (v: string) => void;
  allMealTypes: string[];
  onAddFoodFromDB: (food: FoodItemLike) => void;
  onDirectAdd?: (food: FoodItemLike) => void;
  customMealInput: string;
  onCustomMealInputChange: (value: string) => void;
  onAddCustomMeal: () => void;
  onShowBarcode: () => void;
  onCloseBarcode: () => void;
  showBarcode: boolean;
  onBarcodeProduct: (product: OFFProduct) => void;
  onOcrFile: (file: File) => void;
  ocrFileLoading: boolean;
  onShowOCR: () => void;
  showOCR: boolean;
  ocrText: string;
  onOcrTextChange: (v: string) => void;
  onOcrSubmit: () => void;
  ocrError: string;
  ocrHint?: string;
  onOcrClose: () => void;
  parsedItems: any[];
  onRemoveParsedItem: (idx: number) => void;
  onUpdateParsedItemQty: (idx: number, qty: number) => void;
  onFillMicros: () => void;
  onSaveItems: () => void;
  onEditParsedItem?: (idx: number, item: any) => void;
  onFixAllLowConfidence?: () => void;
  favoriteFoods: any[];
  mealPresets: any[];
  onAddPreset: (items: any[]) => void;
  showCustomFood: boolean;
  onToggleCustomFood: () => void;
  customFoodName: string;
  onCustomFoodNameChange: (v: string) => void;
  customFoodKcal: string;
  customFoodP: string;
  customFoodF: string;
  customFoodC: string;
  onCustomFoodFieldChange: (field: string, v: string) => void;
  onAddCustomFood: () => void;
  ocrFileRef: React.RefObject<HTMLInputElement>;
  ocrCameraRef: React.RefObject<HTMLInputElement>;
}

export const AddFoodPanel: React.FC<AddFoodPanelProps> = ({
  foodSearch, onFoodSearchChange, debouncedSearch, usdaFoods, mealType, onMealTypeChange,
  allMealTypes, onAddFoodFromDB, onDirectAdd, customMealInput, onCustomMealInputChange, onAddCustomMeal, onShowBarcode, onCloseBarcode, showBarcode, onBarcodeProduct, onOcrFile,
  ocrFileLoading, onShowOCR, showOCR, ocrText, onOcrTextChange, onOcrSubmit, ocrError, ocrHint, onOcrClose,
  parsedItems, onRemoveParsedItem, onUpdateParsedItemQty, onFillMicros, onSaveItems, onEditParsedItem,
  onFixAllLowConfidence,
  favoriteFoods, mealPresets, onAddPreset, showCustomFood, onToggleCustomFood,
  customFoodName, onCustomFoodNameChange, customFoodKcal, customFoodP, customFoodF, customFoodC,
  onCustomFoodFieldChange, onAddCustomFood, ocrFileRef, ocrCameraRef,
}) => {
  const foodSearchResults = useMemo(() => {
    if (!debouncedSearch.trim()) return [];
    const q = debouncedSearch.toLowerCase();
    const internal = FOOD_DB.filter((f: any) => (f.name || '').toLowerCase().indexOf(q) >= 0);
    const usda = usdaFoods.filter((f: any) => (f.name || '').toLowerCase().indexOf(q) >= 0 || (f.description || '').toLowerCase().indexOf(q) >= 0);
    return [...internal.slice(0, 5), ...usda.slice(0, 10)].slice(0, 15);
  }, [debouncedSearch, usdaFoods]);

  const [history, setHistory] = useState<string[]>(() => { try { const v = JSON.parse(localStorage.getItem('he_search_history') || '[]'); return Array.isArray(v) ? v.filter((x:any)=>typeof x==='string').slice(0,5) : []; } catch { return []; } });
  useEffect(() => {
    if (debouncedSearch.trim() && foodSearchResults.length>0) {
      const q = debouncedSearch.trim();
      setHistory(prev => {
        if (prev[0]===q) return prev;
        const next = [q, ...prev.filter(x=>x!==q)].slice(0,5);
        try { localStorage.setItem('he_search_history', JSON.stringify(next)); } catch {}
        return next;
      });
    }
  }, [debouncedSearch, foodSearchResults.length]);

  const [editingIdx, setEditingIdx] = useState<number>(-1);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState(100);
  const [editKcal, setEditKcal] = useState(0);
  const [editP, setEditP] = useState(0);
  const [editF, setEditF] = useState(0);
  const [editC, setEditC] = useState(0);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickTab, setQuickTab] = useState<'fav'|'recent'|'presets'>('fav');

  const startEdit = (idx: number, item: any) => {
    setEditingIdx(idx);
    setEditName(item.name || '');
    setEditQty(item.qty || 100);
    setEditKcal(Math.round(item.kcal || 0));
    setEditP(Math.round((item.p || 0) * 10) / 10);
    setEditF(Math.round((item.f || 0) * 10) / 10);
    setEditC(Math.round((item.c || 0) * 10) / 10);
  };

  const saveEdit = () => {
    if (editingIdx < 0 || !onEditParsedItem) return;
    onEditParsedItem(editingIdx, {
      name: editName || 'Блюдо',
      qty: Math.max(10, editQty),
      kcal: Math.max(0, editKcal),
      p: Math.max(0, editP),
      f: Math.max(0, editF),
      c: Math.max(0, editC),
    });
    setEditingIdx(-1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Search */}
      <div style={{ padding: 14, borderRadius: 18, background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <input type="text" value={foodSearch} onChange={e => onFoodSearchChange(e.target.value)} 
            aria-label="Поиск продуктов" placeholder="🔍 Поиск продуктов... (начните вводить 2 буквы)" autoFocus
            style={{ flex:1, padding: '12px 14px', borderRadius: 12, background: '#202023', 
              border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 14, boxSizing: 'border-box', 
              outline: 'none', minHeight: 44 }} />
          {foodSearch && <button onClick={() => onFoodSearchChange('')} aria-label="Очистить поиск" style={{ width:36, height:36, borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:14 }}>✕</button>}
        </div>
        
        {foodSearchResults.length > 0 && (
          <div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 8, borderRadius: 10, background: '#202023', border:'1px solid rgba(255,255,255,0.04)' }}>
            {foodSearchResults.map(f => (
              <div key={f.id} style={{ padding: '10px 12px', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff', minHeight: 48, transition:'background 0.12s', borderRadius:8, margin:'2px 4px', background:'rgba(255,255,255,0.01)' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(0,230,138,0.06)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.01)'}>
                <div onClick={() => onAddFoodFromDB(f)} role="button" aria-label={`Добавить ${f.name}`} style={{ display: 'flex', alignItems: 'center', gap: 8, flex:1, cursor:'pointer' }}>
                  <span style={{ fontSize: 16, width:20, textAlign:'center' }}>{CAT_MAP_EMOJI[f.category || 'other'] || '📦'}</span>
                  <span style={{ fontWeight: 600, flex:1, lineHeight:1.2 }}>{f.name}</span>
                  <div style={{ display: 'flex', gap: 6, fontSize: 9, color: 'rgba(255,255,255,0.7)', flexShrink:0 }}>
                    <span style={{ color: '#00e68a', fontWeight: 700 }}>{f.kcal}</span>
                    <span style={{ color: '#3b82f6' }}>Б{f.protein}</span>
                    <span style={{ color: '#f59e0b' }}>Ж{f.fat}</span>
                    <span style={{ color: '#f97316' }}>У{f.carbs}</span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:4, marginLeft:8, flexShrink:0 }}>
                  <button onClick={() => onAddFoodFromDB(f)} title="В очередь (потом Сохранить)" style={{ padding:'5px 8px', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.7)', fontSize:10, cursor:'pointer', minHeight:28 }}>＋</button>
                  {onDirectAdd && <button onClick={() => onDirectAdd(f)} title={`Сразу в ${mealType || 'дневник'} 100г`} style={{ padding:'5px 9px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontSize:10, fontWeight:700, cursor:'pointer', minHeight:28, boxShadow:'0 2px 8px rgba(0,230,138,0.2)' }}>⚡ 100г</button>}
                </div>
              </div>
            ))}
          </div>
        )}
        {debouncedSearch.trim() && foodSearchResults.length===0 && (
          <div style={{ marginTop:8, fontSize:10, color:'rgba(255,255,255,0.4)', textAlign:'center', padding:'8px 10px', background:'rgba(255,255,255,0.02)', borderRadius:8, border:'1px solid rgba(255,255,255,0.04)' }}>Ничего не найдено — попробуйте другое написание или создайте <span style={{ color:'#8b5cf6' }}>свою еду</span></div>
        )}
        {!debouncedSearch.trim() && history.length>0 && (
          <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontSize:9, color:'rgba(255,255,255,0.35)' }}>История:</span>
            {history.map(h=>(
              <button key={h} onClick={()=>onFoodSearchChange(h)} style={{ padding:'4px 8px', borderRadius:8, fontSize:9, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.6)', cursor:'pointer' }}>{h}</button>
            ))}
            <button onClick={()=>{ setHistory([]); try{localStorage.removeItem('he_search_history');}catch{} }} style={{ fontSize:9, color:'rgba(255,255,255,0.3)', background:'none', border:'none', cursor:'pointer' }}>✕</button>
          </div>
        )}

        {/* Meal type selector — premium */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {allMealTypes.map(mt => {
            const isActive = mealType === mt;
            const icon = mt.toLowerCase().includes('завтрак') ? '🌅' : mt.toLowerCase().includes('обед') ? '☀️' : mt.toLowerCase().includes('ужин') ? '🌙' : mt.toLowerCase().includes('перекус') ? '🍿' : mt.toLowerCase().includes('трениров') ? '💪' : '🍽';
            return (
            <button key={mt} onClick={() => onMealTypeChange(isActive ? '' : mt)} 
              aria-label={`Приём: ${mt}`}
              style={{ padding: '7px 12px', borderRadius: 999, fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap', display:'flex', alignItems:'center', gap:6,
                background: isActive ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : '#202023',
                border: isActive ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.07)',
                color: isActive ? '#000' : 'rgba(255,255,255,0.7)', fontWeight: isActive ? 700 : 500,
                minHeight: 34, transition: 'all 0.15s', boxShadow: isActive ? '0 2px 8px rgba(0,230,138,0.2)' : 'none' }}>
              <span style={{ fontSize:11 }}>{icon}</span> {mt}
            </button>
          )})}
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
          <input value={customMealInput} onChange={e => onCustomMealInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onAddCustomMeal(); }}
            placeholder="Новый тип приёма пищи" aria-label="Новый тип приёма пищи"
            style={{ flex: 1, padding: '7px 10px', borderRadius: 9, background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 10, minHeight: 36 }} />
          <button onClick={onAddCustomMeal} aria-label="Добавить тип приёма пищи"
            style={{ padding: '7px 10px', borderRadius: 9, border: '1px solid rgba(0,230,138,0.2)', background: 'rgba(0,230,138,0.08)', color: '#00e68a', fontSize: 10, minHeight: 36 }}>＋</button>
        </div>

        {/* Quick actions — modern */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
          <button type="button" onClick={onShowBarcode} aria-label="Штрих-код"
            style={{ padding: '14px 8px', borderRadius: 14, fontSize: 11, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              background: showBarcode ? 'linear-gradient(135deg, rgba(0,230,138,0.18), rgba(0,200,160,0.08))' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${showBarcode ? 'rgba(0,230,138,0.3)' : 'rgba(255,255,255,0.06)'}`,
              color: showBarcode ? '#00e68a' : 'rgba(255,255,255,0.85)', minHeight: 72, fontWeight: 600, backdropFilter: 'blur(8px)', transition: 'all 0.2s', boxShadow: showBarcode ? '0 4px 16px rgba(0,230,138,0.15)' : 'none' }}>
            <span style={{ fontSize: 20, filter: showBarcode ? 'none' : 'grayscale(0.3)' }}>📱</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>Штрих-код</span>
          </button>
          <label style={{ padding: '14px 8px', borderRadius: 14, fontSize: 11, cursor: ocrFileLoading ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              background: ocrFileLoading ? 'linear-gradient(135deg, rgba(0,230,138,0.18), rgba(0,200,160,0.08))' : 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(139,92,246,0.02))',
              border: `1px solid ${ocrFileLoading ? 'rgba(0,230,138,0.3)' : 'rgba(139,92,246,0.12)'}`,
              color: ocrFileLoading ? '#00e68a' : 'rgba(255,255,255,0.9)', minHeight: 72, fontWeight: 600, backdropFilter: 'blur(8px)', transition: 'all 0.2s', boxShadow: ocrFileLoading ? '0 4px 16px rgba(0,230,138,0.15)' : '0 2px 8px rgba(0,0,0,0.1)', opacity: ocrFileLoading ? 0.9 : 1, justifyContent: 'center', pointerEvents: ocrFileLoading ? 'none' : 'auto' }}>
            <input ref={ocrFileRef} type="file" accept="image/*" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
              onChange={e => { const f = e.target.files?.[0] as File | undefined; e.currentTarget.value = ''; onOcrFile(f as any); }} />
            <span style={{ fontSize: 20 }}>{ocrFileLoading ? '⏳' : '📸'}</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>{ocrFileLoading ? 'Сканируем…' : 'Фото'}</span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', marginTop: -2 }}>скрин / камера</span>
          </label>
          <button onClick={onShowOCR} aria-label="Текст"
            style={{ padding: '14px 8px', borderRadius: 14, fontSize: 11, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              background: showOCR ? 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(59,130,246,0.08))' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${showOCR ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)'}`,
              color: showOCR ? '#60a5fa' : 'rgba(255,255,255,0.85)', minHeight: 72, fontWeight: 600, backdropFilter: 'blur(8px)', transition: 'all 0.2s', boxShadow: showOCR ? '0 4px 16px rgba(59,130,246,0.15)' : 'none' }}>
            <span style={{ fontSize: 20 }}>📋</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>Текст</span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', marginTop: -2 }}>вставить</span>
          </button>
         </div>
        {/* Быстрое добавление — отдельной красивой кнопкой */}
        <button onClick={() => setShowQuickAdd(v => !v)} style={{ width: '100%', marginTop: 10, padding: '12px 14px', borderRadius: 14, border: `1px solid ${showQuickAdd ? 'rgba(0,230,138,0.25)' : 'rgba(255,255,255,0.06)'}`, background: showQuickAdd ? 'linear-gradient(135deg, rgba(0,230,138,0.12), rgba(0,200,160,0.06))' : 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', color: showQuickAdd ? '#00e68a' : 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backdropFilter: 'blur(12px)', transition: 'all 0.2s', boxShadow: showQuickAdd ? '0 4px 16px rgba(0,230,138,0.12)' : 'none' }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <span>Быстрое добавление</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.6, background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 999 }}>{showQuickAdd ? '▲ Свернуть' : '▼ Развернуть'}</span>
        </button>
        {showQuickAdd && (
          <div style={{ marginTop: 10, padding: 12, borderRadius: 16, background: 'linear-gradient(135deg, rgba(18,18,20,0.9), rgba(24,24,27,0.8))', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[
                { id: 'fav', label: '⭐ Избранное', count: favoriteFoods.length },
                { id: 'recent', label: '🕒 Часто', count: history.length },
                { id: 'presets', label: '📦 Наборы', count: mealPresets.length },
              ].map(tab => (
                <button key={tab.id} onClick={() => setQuickTab(tab.id as any)} style={{ flex: 1, padding: '9px 6px', borderRadius: 10, fontSize: 10, fontWeight: quickTab === tab.id ? 700 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: quickTab === tab.id ? 'linear-gradient(135deg, rgba(0,230,138,0.15), rgba(0,200,160,0.08))' : 'rgba(255,255,255,0.03)', border: `1px solid ${quickTab === tab.id ? 'rgba(0,230,138,0.3)' : 'rgba(255,255,255,0.06)'}`, color: quickTab === tab.id ? '#00e68a' : 'rgba(255,255,255,0.6)', transition: 'all 0.15s' }}>
                  {tab.label}
                  {tab.count > 0 && <span style={{ background: quickTab === tab.id ? '#00e68a' : 'rgba(255,255,255,0.08)', color: quickTab === tab.id ? '#000' : 'rgba(255,255,255,0.6)', padding: '1px 6px', borderRadius: 999, fontSize: 9, fontWeight: 700 }}>{tab.count}</span>}
                </button>
              ))}
            </div>
            {quickTab === 'fav' && (
              favoriteFoods.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {favoriteFoods.slice(0, 8).map(f => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(139,92,246,0.03))', border: '1px solid rgba(139,92,246,0.12)', backdropFilter: 'blur(8px)' }}>
                      <span style={{ fontSize: 18, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(139,92,246,0.12)', borderRadius: 8 }}>{CAT_MAP_EMOJI[f.category || 'other'] || '📦'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                        <div style={{ display: 'flex', gap: 6, fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                          <span style={{ color: '#00e68a', fontWeight: 700 }}>{f.kcal} ккал</span>
                          <span>Б{f.protein}</span><span>Ж{f.fat}</span><span>У{f.carbs}</span>
                        </div>
                      </div>
                      <button onClick={() => onAddFoodFromDB(f)} style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(139,92,246,0.3)' }}>＋</button>
                      {onDirectAdd && <button onClick={() => onDirectAdd(f)} style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(0,230,138,0.2)', background: 'rgba(0,230,138,0.08)', color: '#00e68a', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>⚡</button>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px', color: 'rgba(255,255,255,0.4)', fontSize: 11, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.06)' }}>Нет избранного — добавляйте ⭐ из поиска</div>
              )
            )}
            {quickTab === 'recent' && (
              history.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {history.map(h => {
                      const food = findFood(h);
                      return (
                        <button key={h} onClick={() => onFoodSearchChange(h)} style={{ padding: '7px 12px', borderRadius: 999, fontSize: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>🕒</span> {h}
                          {food && <span style={{ background: 'rgba(0,230,138,0.12)', color: '#00e68a', padding: '1px 6px', borderRadius: 999, fontSize: 9 }}>＋</span>}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 4 }}>Нажми на историю чтобы найти, или добавь напрямую:</div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {history.slice(0, 4).map(h => {
                      const f = findFood(h);
                      if (!f) return null;
                      return (
                        <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <span style={{ fontSize: 14 }}>{CAT_MAP_EMOJI[f.category || 'other'] || '📦'}</span>
                          <span style={{ flex: 1, fontSize: 11, color: '#fff', fontWeight: 500 }}>{f.name}</span>
                          <button onClick={() => onAddFoodFromDB(f)} style={{ padding: '5px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 10, cursor: 'pointer' }}>＋ В очередь</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px', color: 'rgba(255,255,255,0.4)', fontSize: 11, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.06)' }}>История пуста — начни поиск продуктов</div>
              )
            )}
            {quickTab === 'presets' && (
              mealPresets.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {mealPresets.map((p, i) => (
                    <div key={i} style={{ padding: '10px 12px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(0,230,138,0.06), rgba(0,200,160,0.03))', border: '1px solid rgba(0,230,138,0.12)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#00e68a,#00c8a0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>📦</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{p.items?.length || 0} продуктов • {p.items?.reduce((s: any, it: any) => s + (it.kcal || 0), 0) || 0} ккал</div>
                      </div>
                      <button onClick={() => onAddPreset(p.items)} style={{ padding: '7px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontWeight: 700, fontSize: 11, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,230,138,0.2)' }}>Добавить</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px', color: 'rgba(255,255,255,0.4)', fontSize: 11, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.06)' }}>Нет сохранённых наборов — собери продукты и сохрани как пресет</div>
              )
            )}
          </div>
        )}
        {/* Hidden camera input kept for compat — not rendered as button */}
        <input ref={ocrCameraRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={() => {}} />

          {ocrError && (
            <div role="alert" style={{ padding: '9px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 11, lineHeight: 1.35 }}>
              {ocrError}
            </div>
          )}
          {ocrHint && !ocrError && (
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.15)', color: '#86efac', fontSize: 11, lineHeight: 1.35 }}>
              {ocrHint}
            </div>
          )}
          {ocrText && !ocrError && ocrHint && (
            <details style={{ padding: '8px 10px', borderRadius: 10, background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>
              <summary style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}>Сырой текст OCR (для отладки)</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 6, maxHeight: 120, overflowY: 'auto' }}>{ocrText.slice(0, 1500)}</pre>
            </details>
          )}
      </div>

      {showBarcode && (
        <BarcodeScanner onProductFound={onBarcodeProduct} onClose={onCloseBarcode} />
      )}

      {/* OCR Panel */}
      {showOCR && (
        <div style={{ padding: 14, borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Вставьте текст из приложения калорий:</span>
            <button onClick={onOcrClose} aria-label="Закрыть OCR"
              style={{ padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 10, minHeight: 32 }}>
              ✕
            </button>
          </div>
          <textarea aria-label="Текст для распознавания" value={ocrText} onChange={e => onOcrTextChange(e.target.value)} 
            placeholder="Курица 200 г 330 ккал Б:35 Ж:7 У:0"
            style={{ width: '100%', minHeight: 80, padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)',
              background: '#202023', color: '#fff', fontSize: 12, resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 }} />
          <button onClick={onOcrSubmit} aria-label="Распознать"
            style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontWeight: 700, 
              fontSize: 12, cursor: 'pointer', minHeight: 44 }}>
            ✨ Распознать
          </button>
          {ocrError && <div style={{ color: '#ef4444', fontSize: 10, marginTop: 6 }}>{ocrError}</div>}
        </div>
      )}

      {/* Parsed items queue */}
      {parsedItems.length > 0 && (
        <div style={{ padding: 14, borderRadius: 16, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#00e68a', fontWeight: 700 }}>📋 На очереди ({parsedItems.length})</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{mealType || 'Приём пищи'}</span>
          </div>
          
          {parsedItems.map((item, i) => {
            const q = item.qty || 100;
            const kcal = Math.round(item.kcal * q / 100);
            const p = Math.round(((item.p || 0) * q / 100) * 10) / 10;
            const f = Math.round(((item.f || 0) * q / 100) * 10) / 10;
            const c = Math.round(((item.c || 0) * q / 100) * 10) / 10;
            const isLowConf = typeof item.confidence === 'number' && item.confidence < 0.5;
            const isEditing = editingIdx === i;
            
            return (
              <div key={i} style={{ padding: '10px 12px', borderRadius: 12, background: isEditing ? 'rgba(245,158,11,0.06)' : '#202023', border: `1px solid ${isEditing ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.06)'}`, marginBottom: 6 }}>
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Название"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#18181b', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 11, minHeight: 36 }} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                      {[
                        { l: 'г', v: editQty, f: setEditQty },
                        { l: 'ккал', v: editKcal, f: setEditKcal },
                        { l: 'Б', v: editP, f: setEditP },
                        { l: 'Ж', v: editF, f: setEditF },
                        { l: 'У', v: editC, f: setEditC },
                      ].map((x, xi) => (
                        <div key={xi}>
                          <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', marginBottom: 1, display: 'block' }}>{x.l}</label>
                          <input type="number" value={x.v} onChange={e => x.f(Number.parseFloat(e.target.value) || 0)}
                            style={{ width: '100%', padding: '6px', borderRadius: 6, background: '#18181b', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 11, minHeight: 28 }} />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <button onClick={saveEdit} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontWeight: 700, fontSize: 11, minHeight: 32 }}>✓</button>
                      <button onClick={() => setEditingIdx(-1)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#18181b', color: 'rgba(255,255,255,0.7)', fontSize: 11, minHeight: 32 }}>✕</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', cursor: isLowConf ? 'pointer' : 'default', textDecoration: isLowConf ? 'underline dotted' : 'none' }} onClick={() => isLowConf && startEdit(i, item)}>{item.name}</span>
                        {isLowConf && (
                          <span onClick={() => startEdit(i, item)} style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700, background: 'rgba(245,158,11,0.12)', padding: '2px 6px', borderRadius: 6, cursor: 'pointer' }}>⚠ проверьте</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {!isLowConf && (
                          <button onClick={() => startEdit(i, item)} aria-label="Изменить"
                            style={{ padding: '4px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                              background: 'rgba(59,130,246,0.12)', color: '#3b82f6', fontSize: 10, minHeight: 28 }}>
                            ✎
                          </button>
                        )}
                        <button onClick={() => onRemoveParsedItem(i)} aria-label="Удалить"
                          style={{ padding: '4px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 10, minHeight: 28 }}>
                          ✕
                        </button>
                      </div>
                    </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#18181b', borderRadius: 10, padding: '2px 4px' }}>
                    <button onClick={() => onUpdateParsedItemQty(i, Math.max(10, q - 10))} aria-label="Уменьшить"
                      style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)',
                        color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      −
                    </button>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', width: 48, textAlign: 'center' }}>{q}г</span>
                    <button onClick={() => onUpdateParsedItemQty(i, Math.min(1000, q + 10))} aria-label="Увеличить"
                      style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)',
                        color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      +
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                    {[50, 100, 200, 300].map(v => (
                      <button key={v} onClick={() => onUpdateParsedItemQty(i, v)} aria-label={`${v} грамм`}
                        style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)',
                          background: q === v ? 'rgba(0,230,138,0.12)' : '#18181b',
                          color: q === v ? '#00e68a' : 'rgba(255,255,255,0.7)', cursor: 'pointer', 
                          fontSize: 9, fontWeight: q === v ? 700 : 400, minHeight: 28 }}>
                        {v}г
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 9 }}>
                  <span style={{ color: '#00e68a', fontWeight: 700 }}>{kcal} ккал</span>
                  <span style={{ color: '#60a5fa' }}>Б {p}г</span>
                  <span style={{ color: '#fbbf24' }}>Ж {f}г</span>
                  <span style={{ color: '#fb923c' }}>У {c}г</span>
                </div>
              </>
              )}
            </div>
            );
          })}
          
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {parsedItems.some(item => typeof item.confidence === 'number' && item.confidence < 0.5) && onFixAllLowConfidence && (
              <button onClick={onFixAllLowConfidence} aria-label="Исправить все"
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(245,158,11,0.25)',
                  background: 'rgba(245,158,11,0.06)', color: '#fbbf24', cursor: 'pointer', fontSize: 10, fontWeight: 700, minHeight: 40 }}>
                ⚡ Исправить все ({parsedItems.filter(item => typeof item.confidence === 'number' && item.confidence < 0.5).length})
              </button>
            )}
            <button onClick={onFillMicros} aria-label="Микронутриенты"
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(34,197,94,0.2)',
                background: 'rgba(34,197,94,0.06)', color: '#86efac', cursor: 'pointer', fontSize: 10, fontWeight: 700, minHeight: 40 }}>
              ✨ Микронутриенты
            </button>
            <button onClick={onSaveItems} aria-label="Сохранить"
              style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontWeight: 700, 
                fontSize: 12, minHeight: 40, boxShadow: '0 4px 16px rgba(0,230,138,0.2)' }}>
              💾 Сохранить {parsedItems.length} поз.
            </button>
          </div>
        </div>
      )}



      {/* Custom food */}
      <button onClick={onToggleCustomFood} aria-label="Своя еда"
        style={{ width: '100%', padding: '10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
          background: showCustomFood ? 'rgba(139,92,246,0.12)' : '#202023',
          border: `1px solid ${showCustomFood ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.06)'}`,
          color: '#8b5cf6', minHeight: 44, fontWeight: 500 }}>
        {showCustomFood ? '✕ Скрыть' : '🍎 Своя еда (ввести вручную)'}
      </button>
      
      {showCustomFood && (
        <div style={{ padding: 12, borderRadius: 14, background: '#202023', border: '1px solid rgba(139,92,246,0.15)' }}>
          <input value={customFoodName} onChange={e => onCustomFoodNameChange(e.target.value)} placeholder="Название"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: '#18181b',
              border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 12, marginBottom: 8, boxSizing: 'border-box', minHeight: 40 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {[
              { l: 'Ккал', v: customFoodKcal, f: 'customFoodKcal' },
              { l: 'Белки', v: customFoodP, f: 'customFoodP' },
              { l: 'Жиры', v: customFoodF, f: 'customFoodF' },
              { l: 'Угл.', v: customFoodC, f: 'customFoodC' },
            ].map((x, i) => (
              <div key={i}>
                <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginBottom: 2, display: 'block' }}>{x.l}</label>
                <input type="number" value={x.v} onChange={e => onCustomFoodFieldChange(x.f, e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, background: '#18181b',
                    border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 12, boxSizing: 'border-box', minHeight: 36 }} />
              </div>
            ))}
          </div>
          <button onClick={onAddCustomFood} style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 10,
            border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c8a0)',
            color: '#000', fontWeight: 700, fontSize: 12, minHeight: 40 }}>
            + Добавить
          </button>
        </div>
      )}
    </div>
  );
};

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
  ocrFileLoading, onShowOCR, showOCR, ocrText, onOcrTextChange, onOcrSubmit, ocrError, onOcrClose,
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
              <div key={f.id} style={{ padding: '8px 10px', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff', minHeight: 44, transition:'background 0.12s' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
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

        {/* Meal type selector */}
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 10, maxWidth: '100%', overflowX: 'auto' }}>
          {allMealTypes.map(mt => (
            <button key={mt} onClick={() => onMealTypeChange(mealType === mt ? '' : mt)} 
              aria-label={`Приём: ${mt}`}
              style={{ padding: '6px 12px', borderRadius: 20, fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap',
                background: mealType === mt ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : '#202023',
                border: mealType === mt ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
                color: mealType === mt ? '#000' : 'rgba(255,255,255,0.7)', fontWeight: mealType === mt ? 700 : 500,
                minHeight: 32, transition: 'all 0.15s' }}>
              {mt}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
          <input value={customMealInput} onChange={e => onCustomMealInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onAddCustomMeal(); }}
            placeholder="Новый тип приёма пищи" aria-label="Новый тип приёма пищи"
            style={{ flex: 1, padding: '7px 10px', borderRadius: 9, background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 10, minHeight: 36 }} />
          <button onClick={onAddCustomMeal} aria-label="Добавить тип приёма пищи"
            style={{ padding: '7px 10px', borderRadius: 9, border: '1px solid rgba(0,230,138,0.2)', background: 'rgba(0,230,138,0.08)', color: '#00e68a', fontSize: 10, minHeight: 36 }}>＋</button>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <button type="button" onClick={onShowBarcode} aria-label="Штрих-код"
            style={{ flex: 1, padding: '10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
              background: showBarcode ? 'rgba(0,230,138,0.12)' : '#202023',
              border: `1px solid ${showBarcode ? 'rgba(0,230,138,0.25)' : 'rgba(255,255,255,0.06)'}`,
              color: '#fff', minHeight: 44, fontWeight: 500 }}>
            📱 Штрих-код
          </button>
          <button onClick={() => ocrFileRef.current?.click()} disabled={ocrFileLoading} aria-label="Сканировать"
            style={{ flex: 1, padding: '10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
              background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: '#fff',
              opacity: ocrFileLoading ? 0.5 : 1, minHeight: 44, fontWeight: 500 }}>
             {ocrFileLoading ? '⏳ Распознаём' : '📸 Фото/файл'}
           </button>
           <button onClick={() => ocrCameraRef.current?.click()} disabled={ocrFileLoading} aria-label="Камера"
             style={{ flex: 1, padding: '10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
               background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: '#fff',
               opacity: ocrFileLoading ? 0.5 : 1, minHeight: 44, fontWeight: 500 }}>
              {ocrFileLoading ? '⏳ Ждём ответ' : '📷 Камера'}
           </button>
          <button onClick={onShowOCR} aria-label="Текст"
            style={{ flex: 1, padding: '10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
              background: showOCR ? 'rgba(0,230,138,0.12)' : '#202023',
              border: `1px solid ${showOCR ? 'rgba(0,230,138,0.25)' : 'rgba(255,255,255,0.06)'}`,
              color: '#fff', minHeight: 44, fontWeight: 500 }}>
            📋 Текст
          </button>
         </div>

         {ocrError && !showOCR && (
           <div role="alert" style={{ padding: '9px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 11, lineHeight: 1.35 }}>
             {ocrError}
           </div>
         )}

         <input ref={ocrFileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" style={{ display: 'none' }} 
           onChange={e => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) onOcrFile(f); }} />
         <input ref={ocrCameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
           onChange={e => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) onOcrFile(f); }} />
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

      {/* Favorites */}
      {favoriteFoods.length > 0 && (
        <div style={{ padding: '12px 14px', borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: 600, marginBottom: 6 }}>⭐ Избранное</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {favoriteFoods.slice(0, 8).map(f => (
              <button key={f.id} onClick={() => onAddFoodFromDB(f)} aria-label={`Добавить ${f.name}`}
                style={{ padding: '6px 12px', borderRadius: 10, fontSize: 10, cursor: 'pointer',
                  background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)',
                  color: '#8b5cf6', whiteSpace: 'nowrap', minHeight: 32 }}>
                {CAT_MAP_EMOJI[f.category] || ''} {f.name.length > 14 ? f.name.slice(0, 13) + '…' : f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Meal presets */}
      {mealPresets.length > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 14, background: '#18181b', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: 600, marginBottom: 6 }}>📦 Быстрые пресеты</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {mealPresets.map((p, i) => (
              <button key={i} onClick={() => onAddPreset(p.items)}
                style={{ padding: '6px 12px', borderRadius: 10, fontSize: 10, cursor: 'pointer',
                  background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.15)',
                  color: '#00e68a', fontWeight: 600, minHeight: 32 }}>
                {p.name}
              </button>
            ))}
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

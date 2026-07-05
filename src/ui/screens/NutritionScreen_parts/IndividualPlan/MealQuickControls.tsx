import React, { useState } from "react";
import { usePlanCtx } from "./IndividualPlanContext";
import { FOOD_DB } from "../../../../core/nutrition-database";
import { getRecipesByMeal } from "../../../../engines/nutrition-periodization.engine";
import {
  scoreFoodsForKBJU, getMealKBJUTarget, getMealCurrentKBJU,
  type KbjuMatchResult, type AdvancedFilter,
} from "../../../../engines/kbju-food-match.engine";
import { scoreFoodsWithGapPriority, type GapAwareScore } from "../../../../engines/composer-targeting-integration";
import type { NutrientGapResult } from "../../../../engines/nutrient-gap-filler.engine";
import type { ComposerMode } from "./MealComposerMode";

const btnCard: React.CSSProperties = {
  flex: 1, minWidth: 0,
  padding: '10px 6px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
  background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.06)',
  color: '#fff', fontWeight: 600, fontSize: 9,
  transition: 'all 0.15s', lineHeight: 1.3,
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
};

const iconStyle: React.CSSProperties = { fontSize: 16, lineHeight: 1 };

const popupOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 100,
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  background: 'rgba(0,0,0,0.7)',
};

const popupSheet: React.CSSProperties = {
  width: '100%', maxWidth: 400,
  padding: '14px 20px 28px', borderRadius: '20px 20px 0 0',
  background: '#18181b', boxShadow: '0 -4px 30px rgba(0,0,0,0.4)',
  border: '1px solid rgba(255,255,255,0.06)', borderBottom: 'none',
  maxHeight: '75vh', overflowY: 'auto', boxSizing: 'border-box',
};

const handle: React.CSSProperties = {
  width: 36, height: 4, borderRadius: 2,
  background: 'rgba(255,255,255,0.15)', margin: '0 auto 16px',
};

const mealBtn: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  cursor: 'pointer', textAlign: 'left',
  background: '#202023', border: '1px solid rgba(255,255,255,0.06)',
  color: '#fff', fontSize: 9, fontWeight: 600,
  marginBottom: 4, transition: 'all 0.15s',
};

const productBtn: React.CSSProperties = {
  ...mealBtn, fontSize: 8, fontWeight: 400,
};

const CATEGORY_LABELS: Record<string, string> = {
  protein: '🥩 Мясо/Рыба', dairy: '🥛 Молочка', grain: '🌾 Крупы',
  carb: '🥔 Овощи', veg_fruit: '🥦 Овощи/Фрукты', fat: '🥑 Жиры/Орехи',
  supplement: '💊 Спортпит', other: '📦 Прочее',
};

interface Props {
  mode?: ComposerMode;
  advancedFilter?: AdvancedFilter;
  gapResult?: NutrientGapResult | null;
}

export const MealQuickControls: React.FC<Props> = ({ mode = 'basic', advancedFilter = {}, gapResult = null }) => {
  const ctx = usePlanCtx();
  const {
    dayPlan, generated,
    saveUndo, setDayPlan, undoStack, setUndoStack,
    setRecipePickerMeal,
  } = ctx;

  const [popup, setPopup] = useState<{
    mode: 'recipe' | 'replace_product' | 'edit_weight' | 'add_product' | 'duplicate_meal' | 'delete_meal';
    step: 'select_meal' | 'select_product' | 'select_replacement' | 'enter_weight' | 'search_product' | 'confirm';
    selectedMealIdx?: number;
    selectedItemIdx?: number;
    searchQuery?: string;
    searchResults?: any[];
    scoredResults?: KbjuMatchResult[];
    editWeight?: number;
  } | null>(null);

  if (!generated || !dayPlan) return null;
  const meals = dayPlan.meals || [];

  const closePopup = () => setPopup(null);

  const openPopup = (mode: typeof popup extends { mode: infer M } ? M : string) => {
    setPopup({ mode: mode as any, step: 'select_meal' });
  };

  const selectMeal = (idx: number) => {
    if (!popup) return;
    const p = { ...popup, selectedMealIdx: idx };
    if (p.mode === 'recipe') {
      closePopup();
      setRecipePickerMeal({ dayIdx: 0, mealIdx: idx, label: meals[idx]?.label || `Приём ${idx + 1}` });
      return;
    }
    if (p.mode === 'duplicate_meal') {
      saveUndo();
      const copy = JSON.parse(JSON.stringify(meals[idx]));
      if (!copy) return;
      setDayPlan((prev: any) => {
        if (!prev) return prev;
        const m = [...prev.meals];
        const insertAt = Math.min(idx + 1, m.length);
        const dup = {
          ...copy,
          label: copy.label + ' (копия)',
          time: (() => { const [h, m2] = (copy.time || '12:00').split(':').map(Number); const t = h * 60 + m2 + 30; return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; })(),
        };
        m.splice(insertAt, 0, dup);
        const totals = { kcal: m.reduce((s: number, x: any) => s + (x.totals?.kcal || 0), 0), p: m.reduce((s: number, x: any) => s + (x.totals?.p || 0), 0), f: m.reduce((s: number, x: any) => s + (x.totals?.f || 0), 0), c: m.reduce((s: number, x: any) => s + (x.totals?.c || 0), 0) };
        return { ...prev, meals: m, totals };
      });
      closePopup();
      return;
    }
    if (p.mode === 'delete_meal') {
      saveUndo();
      setDayPlan((prev: any) => {
        if (!prev) return prev;
        const m = prev.meals.filter((_: any, i: number) => i !== idx);
        const totals = { kcal: m.reduce((s: number, x: any) => s + (x.totals?.kcal || 0), 0), p: m.reduce((s: number, x: any) => s + (x.totals?.p || 0), 0), f: m.reduce((s: number, x: any) => s + (x.totals?.f || 0), 0), c: m.reduce((s: number, x: any) => s + (x.totals?.c || 0), 0) };
        return { ...prev, meals: m, totals };
      });
      closePopup();
      return;
    }
    if (p.mode === 'replace_product' || p.mode === 'edit_weight') {
      const items = meals[idx]?.items || [];
      if (items.length === 0) { closePopup(); return; }
      setPopup({ ...p, step: 'select_product' });
      return;
    }
    if (p.mode === 'add_product') {
      const mealTarget = getMealKBJUTarget(dayPlan, idx);
      const mealCurrent = getMealCurrentKBJU(dayPlan, idx);
      setPopup({ ...p, step: 'search_product', searchQuery: '', searchResults: [], scoredResults: [] });
      return;
    }
    closePopup();
  };

  const selectProduct = (itemIdx: number) => {
    if (!popup || popup.selectedMealIdx === undefined) return;
    const mealIdx = popup.selectedMealIdx;
    const p = { ...popup, selectedItemIdx: itemIdx };
    if (p.mode === 'replace_product') {
      const item = meals[mealIdx]?.items?.[itemIdx];
      if (!item) return;
      const similar = FOOD_DB.filter((f: any) => {
        return f.id !== item.id && f.name !== item.name && f.category === item.category;
      }).slice(0, 10);
      setPopup({ ...p, step: 'select_replacement', searchResults: similar });
      return;
    }
    if (p.mode === 'edit_weight') {
      const item = meals[mealIdx]?.items?.[itemIdx];
      setPopup({ ...p, step: 'enter_weight', editWeight: item?.amount || 100 });
      return;
    }
    closePopup();
  };

  const doReplaceProduct = (food: any) => {
    if (!popup || popup.selectedMealIdx === undefined || popup.selectedItemIdx === undefined) return;
    saveUndo();
    setDayPlan((prev: any) => {
      if (!prev) return prev;
      const meals2 = prev.meals.map((m: any, mi: number) => {
        if (mi !== popup.selectedMealIdx) return m;
        const items = m.items.map((it: any, ii: number) => {
          if (ii !== popup.selectedItemIdx) return it;
          return { ...it, name: food.name || food.foodName, id: food.id || food.foodId, kcal: food.kcal, p: food.protein ?? food.p, f: food.fat ?? food.f, c: food.carbs ?? food.c };
        });
        const totals = { kcal: items.reduce((s: number, x: any) => s + x.kcal, 0), p: items.reduce((s: number, x: any) => s + x.p, 0), f: items.reduce((s: number, x: any) => s + x.f, 0), c: items.reduce((s: number, x: any) => s + x.c, 0) };
        return { ...m, items, totals };
      });
      const totals = { kcal: meals2.reduce((s: number, m2: any) => s + (m2.totals?.kcal || 0), 0), p: meals2.reduce((s: number, m2: any) => s + (m2.totals?.p || 0), 0), f: meals2.reduce((s: number, m2: any) => s + (m2.totals?.f || 0), 0), c: meals2.reduce((s: number, m2: any) => s + (m2.totals?.c || 0), 0) };
      return { ...prev, meals: meals2, totals };
    });
    closePopup();
  };

  const doUpdateWeight = () => {
    if (!popup || popup.selectedMealIdx === undefined || popup.selectedItemIdx === undefined || !popup.editWeight) return;
    saveUndo();
    const w = popup.editWeight;
    setDayPlan((prev: any) => {
      if (!prev) return prev;
      const meals2 = prev.meals.map((m: any, mi: number) => {
        if (mi !== popup.selectedMealIdx) return m;
        const items = m.items.map((it: any, ii: number) => {
          if (ii !== popup.selectedItemIdx) return it;
          const ratio = w / (it.amount || 100);
          return { ...it, amount: w, kcal: Math.round((it.kcal || 0) * ratio), p: Math.round((it.p || 0) * ratio * 10) / 10, f: Math.round((it.f || 0) * ratio * 10) / 10, c: Math.round((it.c || 0) * ratio * 10) / 10 };
        });
        const totals = { kcal: items.reduce((s: number, x: any) => s + x.kcal, 0), p: items.reduce((s: number, x: any) => s + x.p, 0), f: items.reduce((s: number, x: any) => s + x.f, 0), c: items.reduce((s: number, x: any) => s + x.c, 0) };
        return { ...m, items, totals };
      });
      const totals = { kcal: meals2.reduce((s: number, m2: any) => s + (m2.totals?.kcal || 0), 0), p: meals2.reduce((s: number, m2: any) => s + (m2.totals?.p || 0), 0), f: meals2.reduce((s: number, m2: any) => s + (m2.totals?.f || 0), 0), c: meals2.reduce((s: number, m2: any) => s + (m2.totals?.c || 0), 0) };
      return { ...prev, meals: meals2, totals };
    });
    closePopup();
  };

  const doAddProduct = (result: KbjuMatchResult) => {
    if (!popup || popup.selectedMealIdx === undefined) return;
    saveUndo();
    const food = FOOD_DB.find(f => f.id === result.foodId);
    const amount = Math.round(food?.servingSize ? parseInt(food.servingSize) : 100);
    setDayPlan((prev: any) => {
      if (!prev) return prev;
      const meals2 = prev.meals.map((m: any, mi: number) => {
        if (mi !== popup.selectedMealIdx) return m;
        const items = [...m.items, { name: result.foodName, id: result.foodId, amount, kcal: Math.round(result.kcal * amount / 100), p: Math.round(result.protein * amount / 100 * 10) / 10, f: Math.round(result.fat * amount / 100 * 10) / 10, c: Math.round(result.carbs * amount / 100 * 10) / 10 }];
        const totals = { kcal: items.reduce((s: number, x: any) => s + x.kcal, 0), p: items.reduce((s: number, x: any) => s + x.p, 0), f: items.reduce((s: number, x: any) => s + x.f, 0), c: items.reduce((s: number, x: any) => s + x.c, 0) };
        return { ...m, items, totals };
      });
      const totals = { kcal: meals2.reduce((s: number, m2: any) => s + (m2.totals?.kcal || 0), 0), p: meals2.reduce((s: number, m2: any) => s + (m2.totals?.p || 0), 0), f: meals2.reduce((s: number, m2: any) => s + (m2.totals?.f || 0), 0), c: meals2.reduce((s: number, m2: any) => s + (m2.totals?.c || 0), 0) };
      return { ...prev, meals: meals2, totals };
    });
    setPopup({ ...popup, step: 'search_product', searchQuery: '', searchResults: [], scoredResults: [] });
  };

  const handleSearch = (q: string) => {
    if (!popup || popup.selectedMealIdx === undefined) return;
    setPopup({ ...popup, searchQuery: q, scoredResults: [] });
    if (q.trim().length > 0) {
      const raw = FOOD_DB.filter((f: any) => (f.name || '').toLowerCase().includes(q.toLowerCase()));
      const mealTarget = getMealKBJUTarget(dayPlan, popup.selectedMealIdx);
      const mealCur = getMealCurrentKBJU(dayPlan, popup.selectedMealIdx);
      const defaultTarget = mealTarget || { kcal: 600, protein: 40, fat: 20, carbs: 60 };
      let scored: any[];
      if (mode === 'targeting' && gapResult) {
        scored = scoreFoodsWithGapPriority(raw, defaultTarget, gapResult, mealCur || undefined, advancedFilter, 20, 0.4);
      } else {
        scored = scoreFoodsForKBJU(raw, defaultTarget, mealCur || undefined, mode === 'advanced' ? advancedFilter : undefined, 20);
      }
      setPopup({ ...popup, searchQuery: q, searchResults: raw.slice(0, 20), scoredResults: scored });
    }
  };

  const undoLast = () => {
    if (undoStack.length === 0) return;
    setDayPlan(undoStack[0]);
    setUndoStack(undoStack.slice(1));
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>🍳 Управление приёмами</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        <div style={btnCard} onClick={() => openPopup('recipe')}>
          <span style={iconStyle}>🍳</span>
          <span>Рецепт</span>
        </div>
        <div style={btnCard} onClick={() => openPopup('replace_product')}>
          <span style={iconStyle}>🔄</span>
          <span>Заменить</span>
        </div>
        <div style={btnCard} onClick={() => openPopup('edit_weight')}>
          <span style={iconStyle}>✏️</span>
          <span>Вес</span>
        </div>
        <div style={btnCard} onClick={() => openPopup('add_product')}>
          <span style={iconStyle}>➕</span>
          <span>Продукт</span>
        </div>
        <div style={btnCard} onClick={() => openPopup('duplicate_meal')}>
          <span style={iconStyle}>📋</span>
          <span>Дубль</span>
        </div>
        <div style={btnCard} onClick={() => openPopup('delete_meal')}>
          <span style={iconStyle}>✕</span>
          <span>Удалить</span>
        </div>
        <div style={{ ...btnCard, opacity: undoStack.length > 0 ? 1 : 0.3, gridColumn: 'span 2' }} onClick={() => undoStack.length > 0 && undoLast()}>
          <span style={iconStyle}>↩</span>
          <span>Отменить ({undoStack.length})</span>
          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)' }}>последнее действие</span>
        </div>
      </div>

      {/* POPUP: select meal */}
      {popup && (popup.step === 'select_meal') && (
        <div style={popupOverlay} onClick={closePopup}>
          <div onClick={e => e.stopPropagation()} style={popupSheet}>
            <div style={handle} />
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
              {popup.mode === 'recipe' && '🍳 Заменить приём рецептом'}
              {popup.mode === 'replace_product' && '🔄 Заменить продукт'}
              {popup.mode === 'edit_weight' && '✏️ Изменить граммовку'}
              {popup.mode === 'add_product' && '➕ Добавить продукт в приём'}
              {popup.mode === 'duplicate_meal' && '📋 Дублировать приём'}
              {popup.mode === 'delete_meal' && '✕ Удалить приём'}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Выберите приём:</div>
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {meals.map((m: any, i: number) => {
                const kcal = Math.round(m.totals?.kcal || 0);
                const items = (m.items || []).length;
                return (
                  <button key={i} onClick={() => selectMeal(i)}
                    style={mealBtn}
                    onMouseEnter={e => (e.target as HTMLElement).style.borderColor = 'rgba(0,230,138,0.3)'}
                    onMouseLeave={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ color: '#00e68a', fontWeight: 700, marginRight: 6 }}>{m.time}</span>
                        <span>{m.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>{items} прод.</span>
                        <span style={{ fontWeight: 800, color: '#00e68a' }}>{kcal} ккал</span>
                      </div>
                    </div>
                    {(popup.mode === 'replace_product' || popup.mode === 'edit_weight') && (
                      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                        {(m.items || []).map((it: any) => it.name).join(', ')}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <button onClick={closePopup} style={{
              width: '100%', marginTop: 8, padding: '6px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.06)', background: '#202023',
              color: 'rgba(255,255,255,0.6)', fontSize: 8, fontWeight: 600,
            }}>✕ Отмена</button>
          </div>
        </div>
      )}

      {/* POPUP: select product (for replace/edit weight) */}
      {popup && (popup.step === 'select_product') && popup.selectedMealIdx !== undefined && (
        <div style={popupOverlay} onClick={closePopup}>
          <div onClick={e => e.stopPropagation()} style={popupSheet}>
            <div style={handle} />
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
              {popup.mode === 'replace_product' ? '🔄 Выберите продукт для замены' : '✏️ Выберите продукт'}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
              Приём: <span style={{ color: '#00e68a' }}>{meals[popup.selectedMealIdx]?.label}</span>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {(meals[popup.selectedMealIdx]?.items || []).map((it: any, ii: number) => (
                <button key={ii} onClick={() => selectProduct(ii)}
                  style={productBtn}
                  onMouseEnter={e => (e.target as HTMLElement).style.borderColor = 'rgba(0,230,138,0.3)'}
                  onMouseLeave={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>{it.name}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8 }}>{it.amount}г · {Math.round(it.kcal)} ккал</span>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={closePopup} style={{
              width: '100%', marginTop: 8, padding: '6px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.06)', background: '#202023',
              color: 'rgba(255,255,255,0.6)', fontSize: 8, fontWeight: 600,
            }}>✕ Отмена</button>
          </div>
        </div>
      )}

      {/* POPUP: select replacement food */}
      {popup && (popup.step === 'select_replacement') && popup.selectedMealIdx !== undefined && popup.selectedItemIdx !== undefined && (
        <div style={popupOverlay} onClick={closePopup}>
          <div onClick={e => e.stopPropagation()} style={popupSheet}>
            <div style={handle} />
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>🔄 Замена продукта</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
              {meals[popup.selectedMealIdx]?.items?.[popup.selectedItemIdx]?.name}
              {' → '}выберите замену:
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {popup.searchResults && popup.searchResults.length > 0 ? popup.searchResults.map((food: any) => (
                <button key={food.id} onClick={() => doReplaceProduct(food)}
                  style={productBtn}
                  onMouseEnter={e => (e.target as HTMLElement).style.borderColor = 'rgba(0,230,138,0.3)'}
                  onMouseLeave={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 700 }}>{food.name}</span>
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>
                        {CATEGORY_LABELS[food.category] || food.category || ''}
                      </span>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8 }}>
                      {Math.round(food.kcal)} ккал · Б{food.protein}/Ж{food.fat}/У{food.carbs}
                    </span>
                  </div>
                </button>
              )) : (
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: 12 }}>
                  Нет подходящих замен в этой категории
                </div>
              )}
            </div>
            <button onClick={closePopup} style={{
              width: '100%', marginTop: 8, padding: '6px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.06)', background: '#202023',
              color: 'rgba(255,255,255,0.6)', fontSize: 8, fontWeight: 600,
            }}>✕ Отмена</button>
          </div>
        </div>
      )}

      {/* POPUP: enter weight */}
      {popup && (popup.step === 'enter_weight') && popup.selectedMealIdx !== undefined && popup.selectedItemIdx !== undefined && (
        <div style={popupOverlay} onClick={closePopup}>
          <div onClick={e => e.stopPropagation()} style={popupSheet}>
            <div style={handle} />
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>✏️ Изменить граммовку</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
              {meals[popup.selectedMealIdx]?.items?.[popup.selectedItemIdx]?.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input type="number" value={popup.editWeight || 100}
                onChange={e => setPopup({ ...popup, editWeight: +e.target.value || 0 })}
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: 12,
                  background: '#202023', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#fff', fontSize: 16, fontWeight: 700, textAlign: 'center',
                  outline: 'none', boxSizing: 'border-box',
                }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>г</span>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[50, 100, 150, 200, 250, 300].map(v => (
                <button key={v} onClick={() => setPopup({ ...popup, editWeight: v })}
                  style={{
                    padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 8, fontWeight: 600,
                    background: popup.editWeight === v ? 'rgba(0,230,138,0.15)' : '#202023',
                    border: popup.editWeight === v ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    color: popup.editWeight === v ? '#00e68a' : 'rgba(255,255,255,0.7)',
                  }}>{v}г</button>
              ))}
            </div>
            <button onClick={doUpdateWeight} style={{
              width: '100%', padding: '10px', borderRadius: 10, cursor: 'pointer',
              border: 'none', background: 'linear-gradient(135deg,#00e68a,#00c8a0)',
              color: '#000', fontSize: 11, fontWeight: 700, marginBottom: 4,
            }}>✓ Применить</button>
            <button onClick={closePopup} style={{
              width: '100%', padding: '6px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.06)', background: '#202023',
              color: 'rgba(255,255,255,0.6)', fontSize: 8, fontWeight: 600,
            }}>✕ Отмена</button>
          </div>
        </div>
      )}

      {/* POPUP: search and add product — WITH KBJU MATCH + ADVANCED MODE */}
      {popup && (popup.step === 'search_product') && (
        <div style={popupOverlay} onClick={closePopup}>
          <div onClick={e => e.stopPropagation()} style={popupSheet}>
            <div style={handle} />
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
              ➕ Добавить продукт
              {mode === 'advanced' && <span style={{ fontSize: 9, marginLeft: 6, color: '#a78bfa', fontWeight: 500 }}>Продвинутый режим</span>}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
              {popup.selectedMealIdx !== undefined
                ? `В приём: ${meals[popup.selectedMealIdx]?.label}`
                : 'Сначала выберите приём'}
            </div>
            {popup.selectedMealIdx === undefined ? (
              <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {meals.map((m: any, i: number) => (
                  <button key={i} onClick={() => { setPopup({ ...popup, selectedMealIdx: i }); }}
                    style={mealBtn}
                    onMouseEnter={e => (e.target as HTMLElement).style.borderColor = 'rgba(0,230,138,0.3)'}
                    onMouseLeave={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span><span style={{ color: '#00e68a' }}>{m.time}</span> {m.label}</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8 }}>{Math.round(m.totals?.kcal || 0)} ккал</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <input type="text" value={popup.searchQuery || ''}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Поиск продукта..." autoFocus
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12,
                    background: '#202023', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    marginBottom: 8,
                  }} />
                {/* KBJU remaining info for the selected meal */}
                {popup.selectedMealIdx !== undefined && (() => {
                  const target = getMealKBJUTarget(dayPlan, popup.selectedMealIdx);
                  const cur = getMealCurrentKBJU(dayPlan, popup.selectedMealIdx);
                  if (!target) return null;
                  const remP = Math.max(0, target.protein - (cur?.protein || 0));
                  const remF = Math.max(0, target.fat - (cur?.fat || 0));
                  const remC = Math.max(0, target.carbs - (cur?.carbs || 0));
                  return (
                    <div style={{ marginBottom: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.08)', fontSize: 8 }}>
                      <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>Осталось добрать в приём:</div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <span style={{ color: '#60a5fa' }}>Б: <b>{remP}г</b></span>
                        <span style={{ color: '#f59e0b' }}>Ж: <b>{remF}г</b></span>
                        <span style={{ color: '#f97316' }}>У: <b>{remC}г</b></span>
                      </div>
                    </div>
                  );
                })()}
                <div style={{ maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {popup.scoredResults && popup.scoredResults.length > 0 ? popup.scoredResults.map((result) => (
                    <button key={result.foodId} onClick={() => doAddProduct(result)}
                      style={{ ...productBtn, padding: mode === 'advanced' ? '8px 10px' : '10px 12px' }}
                      onMouseEnter={e => (e.target as HTMLElement).style.borderColor = 'rgba(0,230,138,0.3)'}
                      onMouseLeave={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'}>
                      {/* Row 1: name + match badge + KBJU */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: 9 }}>{result.foodName}</span>
                            <span style={{
                              fontSize: 7, padding: '1px 5px', borderRadius: 4,
                              background: `${result.color}18`, color: result.color, fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}>
                              {result.matchScore}% {result.label}
                            </span>
                            <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', marginLeft: 2 }}>
                              {CATEGORY_LABELS[result.category]?.split(' ')[0] || result.category}
                            </span>
                          </div>
                          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                            {Math.round(result.kcal)} ккал/100г · Б{result.protein} Ж{result.fat} У{result.carbs}
                            {result.fiber > 0 && <span style={{ color: '#22c55e' }}> · клетч.{result.fiber}г</span>}
                          </div>
                        </div>
                        {/* Match score mini bar */}
                        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', flexShrink: 0, marginTop: 4 }}>
                          <div style={{ width: `${result.matchScore}%`, height: '100%', borderRadius: 2, background: result.color }} />
                        </div>
                      </div>
                      {/* Gap-filler badge for targeting mode */}
                      {mode === 'targeting' && (result as any).isGapFiller && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 6, padding: '1px 5px', borderRadius: 4, background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.15)', fontWeight: 600 }}>
                            🎯 Закрывает {(result as any).gapsCovered}/{((result as any).totalGaps)} дефицитов
                          </span>
                          {(result as any).gapNutrients?.slice(0, 3).map((n: string) => {
                            const gap = gapResult?.gaps?.find(g => g.nutrient === n);
                            return gap ? (
                              <span key={n} style={{ fontSize: 6, padding: '1px 4px', borderRadius: 3, background: 'rgba(239,68,68,0.06)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.1)' }}>
                                {gap.label} {gap.percentCovered}%
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                      {/* Row 2: advanced mode details */}
                      {(mode === 'advanced' || mode === 'targeting') && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', fontSize: 7 }}>
                          {result.diaas !== undefined && result.diaas > 0 && (
                            <span style={{ color: result.diaas >= 1 ? '#00e68a' : result.diaas >= 0.75 ? '#f59e0b' : '#ef4444' }}>
                              🧬 DIAAS {result.diaas}
                            </span>
                          )}
                          {result.gi > 0 && (
                            <span style={{ color: result.gi <= 55 ? '#22c55e' : result.gi <= 70 ? '#f59e0b' : '#ef4444' }}>
                              🍬 ГИ {result.gi}
                            </span>
                          )}
                          {result.pral !== undefined && (
                            <span style={{ color: (result.pral ?? 0) < 0 ? '#22c55e' : (result.pral ?? 0) <= 5 ? '#f59e0b' : '#ef4444' }}>
                              ⚡ PRAL {(result.pral ?? 0).toFixed(1)}
                            </span>
                          )}
                          {result.bbQuality !== undefined && (
                            <span style={{ color: (result.bbQuality ?? 5) >= 7 ? '#00e68a' : (result.bbQuality ?? 5) >= 5 ? '#f59e0b' : '#ef4444' }}>
                              ⭐ {result.bbQuality?.toFixed(1)}
                            </span>
                          )}
                          {result.aminoScore !== undefined && result.aminoScore > 0 && (
                            <span style={{ color: '#60a5fa' }}>💪 Амино {result.aminoScore}/8</span>
                          )}
                          {result.processingLevel && (
                            <span style={{ color: result.processingLevel === 'минимальная' ? '#22c55e' : '#f59e0b' }}>
                              🏭 {result.processingLevel}
                            </span>
                          )}
                          {result.omega3mg !== undefined && result.omega3mg > 100 && (
                            <span style={{ color: '#60a5fa' }}>🐟 Ω3 {result.omega3mg}мг</span>
                          )}
                        </div>
                      )}
                    </button>
                  )) : popup.searchQuery && popup.searchQuery.trim().length > 0 ? (
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: 12 }}>
                      Ничего не найдено. Попробуйте другой запрос.
                    </div>
                  ) : (
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 12 }}>
                      {mode === 'basic'
                        ? 'Начните вводить название продукта. Будет показан скор КБЖУ-соответствия.'
                        : 'Начните вводить название. Продукты будут отфильтрованы по заданным параметрам полезности.'}
                    </div>
                  )}
                </div>
              </>
            )}
            <button onClick={closePopup} style={{
              width: '100%', marginTop: 8, padding: '6px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.06)', background: '#202023',
              color: 'rgba(255,255,255,0.6)', fontSize: 8, fontWeight: 600,
            }}>✕ Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MealQuickControls;

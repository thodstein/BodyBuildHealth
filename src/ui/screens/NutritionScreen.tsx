import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { calcNutrition, generateStructuredAdvice } from '../../engines/nutrition.engine';
import { generateMacroCycle } from '../../engines/nutrition-cycling.engine';
import { generateDayMealPlan, type DayMealPlan, type MealSlot } from '../../engines/nutrition-meal-plan.engine';
import { getProfile } from '../../core/profile-manager';
import { useDataLink } from '../../core/data-link';
import { FOOD_DB, searchFood, RATION_TIERS, getTopByProtein, getTopByCarbs, getTopByFat } from '../../core/nutrition-database';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { productToFoodItem, type OFFProduct } from '../../engines/openfoodfacts.engine';
import { parseNutritionScreenshot, type ParsedMeal } from '../../engines/nutrition-ocr-parser';
import type { NutritionInput, NutritionTargets, FoodItem } from '../../core/types';

type TabId = 'diary' | 'calc' | 'advice' | 'ration';
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type ProductSection = 'protein' | 'carbs' | 'fats' | null;
type RationTier = 'basic' | 'mid' | 'max' | null;

interface DiaryEntry {
  foodId: string;
  name: string;
  weight: number;
  kcal: number;
  p: number;
  f: number;
  c: number;
  fiber: number;
}

interface DayDiary {
  date: string;
  meals: Record<MealType, DiaryEntry[]>;
  water: number;
}

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
};

const STORAGE_KEY = 'nutrition_diary';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadDiary(): Record<string, DayDiary> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDiary(diary: Record<string, DayDiary>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(diary));
}

function emptyDay(date: string): DayDiary {
  return { date, meals: { breakfast: [], lunch: [], dinner: [], snack: [] }, water: 0 };
}

function calcEntryTotals(entries: DiaryEntry[]) {
  return entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      p: acc.p + e.p,
      f: acc.f + e.f,
      c: acc.c + e.c,
      fiber: acc.fiber + e.fiber,
    }),
    { kcal: 0, p: 0, f: 0, c: 0, fiber: 0 },
  );
}

function calcDayTotals(day: DayDiary) {
  let kcal = 0, p = 0, f = 0, c = 0, fiber = 0;
  for (const mt of Object.values(day.meals)) {
    const t = calcEntryTotals(mt);
    kcal += t.kcal;
    p += t.p;
    f += t.f;
    c += t.c;
    fiber += t.fiber;
  }
  return { kcal: Math.round(kcal), p: Math.round(p), f: Math.round(f), c: Math.round(c), fiber: Math.round(fiber), water: day.water };
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, height: 8, width: '100%', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 4, transition: 'width 0.3s' }} />
    </div>
  );
}

function FoodSearchModal({ onSelect, onClose }: { onSelect: (food: typeof FOOD_DB[number], weight: number) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [weight, setWeight] = useState(100);
  const results = useMemo(() => searchFood(query), [query]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: 20, maxWidth: 520, width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Добавить продукт</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 20, cursor: 'pointer' }}>x</button>
        </div>
        <input
          type="text"
          placeholder="Поиск продукта..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, marginBottom: 8, boxSizing: 'border-box' }}
        />
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
          <label style={{ fontSize:12, color:'var(--text-light)', whiteSpace:'nowrap' }}>Порция (г):</label>
          <input
            type="number"
            value={weight}
            onChange={e => setWeight(Number(e.target.value))}
            min={1}
            style={{ width:70, padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:13, boxSizing:'border-box' }}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {results.map(food => (
            <div
              key={food.id}
              onClick={() => onSelect(food, weight)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 6, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{food.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{food.servingSize} {food.description ? `— ${food.description.slice(0, 50)}...` : ''}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>
                <div>{food.kcal} ккал</div>
                <div>Б:{food.protein} Ж:{food.fat} У:{food.carbs}</div>
              </div>
            </div>
          ))}
          {query && !results.length && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)' }}>Ничего не найдено</div>}
        </div>
      </div>
    </div>
  );
}

function DiaryTab({ diary, setDiary, targets }: { diary: Record<string, DayDiary>; setDiary: React.Dispatch<React.SetStateAction<Record<string, DayDiary>>>; targets: NutritionTargets | null }) {
  const d = today();
  const day: DayDiary = diary[d] || emptyDay(d);
  const totals = calcDayTotals(day);
  const [addingMeal, setAddingMeal] = useState<MealType | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrPreview, setOcrPreview] = useState<ParsedMeal[] | null>(null);

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    try {
      const Tesseract = await import('tesseract.js');
      const result = await (Tesseract as any).recognize(file, 'rus+eng');
      const text = result.data.text || '';
      if (text.trim()) {
        const parsed = parseNutritionScreenshot(text);
        if (parsed.length > 0) {
          setOcrPreview(parsed);
        }
      }
    } catch (err) {
      console.error('OCR error:', err);
    } finally {
      setOcrLoading(false);
      e.target.value = '';
    }
  };

  const confirmOcrImport = () => {
    if (!ocrPreview) return;
    const updated = { ...diary };
    if (!updated[d]) updated[d] = emptyDay(d);
    const mealMap: Record<string, MealType> = {
      'завтрак': 'breakfast', 'breakfast': 'breakfast',
      'обед': 'lunch', 'lunch': 'lunch',
      'ужин': 'dinner', 'dinner': 'dinner',
      'перекус': 'snack', 'snack': 'snack', 'полдник': 'snack', 'бранч': 'breakfast',
    };
    for (const meal of ocrPreview) {
      const mealType = mealMap[meal.mealType.toLowerCase()] || 'snack';
      for (const item of meal.items) {
        const entry: DiaryEntry = {
          foodId: `ocr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: item.name,
          weight: parseInt(item.qty) || 100,
          kcal: item.kcal,
          p: item.p,
          f: item.f,
          c: item.c,
          fiber: 0,
        };
        updated[d] = { ...updated[d], meals: { ...updated[d].meals, [mealType]: [...updated[d].meals[mealType], entry] } };
      }
    }
    setDiary(updated);
    saveDiary(updated);
    setOcrPreview(null);
  };

  const addFood = (meal: MealType, food: typeof FOOD_DB[number], weight: number) => {
    const mult = weight / 100;
    const entry: DiaryEntry = {
      foodId: food.id,
      name: food.name,
      weight,
      kcal: Math.round(food.kcal * mult),
      p: Math.round(food.protein * mult * 10) / 10,
      f: Math.round(food.fat * mult * 10) / 10,
      c: Math.round(food.carbs * mult * 10) / 10,
      fiber: Math.round(food.fiber * mult * 10) / 10,
    };
    const updated = { ...diary };
    if (!updated[d]) updated[d] = emptyDay(d);
    updated[d] = { ...updated[d], meals: { ...updated[d].meals, [meal]: [...updated[d].meals[meal], entry] } };
    setDiary(updated);
    saveDiary(updated);
    setAddingMeal(null);
  };

  const removeFood = (meal: MealType, idx: number) => {
    const updated = { ...diary };
    const meals = { ...updated[d].meals };
    meals[meal] = meals[meal].filter((_, i) => i !== idx);
    updated[d] = { ...updated[d], meals };
    setDiary(updated);
    saveDiary(updated);
  };

  const updateWeight = (meal: MealType, idx: number, newWeight: number) => {
    const updated = { ...diary };
    const meals = { ...updated[d].meals };
    const food = FOOD_DB.find(f => f.id === meals[meal][idx].foodId);
    if (!food) return;
    const mult = newWeight / 100;
    const entry: DiaryEntry = {
      foodId: food.id,
      name: food.name,
      weight: newWeight,
      kcal: Math.round(food.kcal * mult),
      p: Math.round(food.protein * mult * 10) / 10,
      f: Math.round(food.fat * mult * 10) / 10,
      c: Math.round(food.carbs * mult * 10) / 10,
      fiber: Math.round(food.fiber * mult * 10) / 10,
    };
    meals[meal] = meals[meal].map((e, i) => i === idx ? entry : e);
    updated[d] = { ...updated[d], meals };
    setDiary(updated);
    saveDiary(updated);
  };

  const addWater = () => {
    const updated = { ...diary };
    if (!updated[d]) updated[d] = emptyDay(d);
    updated[d] = { ...updated[d], water: (updated[d].water || 0) + 0.25 };
    setDiary(updated);
    saveDiary(updated);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <label style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
          📸 Загрузить скриншот (FatSecret/MFP)
          <input type="file" accept="image/*" capture="environment" onChange={handleScreenshotUpload} style={{ display: 'none' }} disabled={ocrLoading} />
        </label>
        {ocrLoading && <span style={{ fontSize: 12, color: 'var(--accent-blue)' }}>Распознавание...</span>}
      </div>

      {ocrPreview && ocrPreview.length > 0 && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 12, marginBottom: 12, border: '1px solid var(--accent-blue)' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Распознано из скриншота</div>
          {ocrPreview.map((meal, mi) => (
            <div key={mi} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)' }}>{meal.mealType} ({meal.date})</div>
              {meal.items.map((item, ii) => (
                <div key={ii} style={{ fontSize: 12, padding: '2px 0', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.name} {item.qty}</span>
                  <span style={{ color: 'var(--text-dim)' }}>{item.kcal} ккал Б:{item.p} Ж:{item.f} У:{item.c}</span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={confirmOcrImport} style={{ padding: '6px 14px', background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>✓ Подтвердить</button>
            <button onClick={() => setOcrPreview(null)} style={{ padding: '6px 14px', background: 'var(--bg-tertiary)', color: 'var(--text-dim)', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Отмена</button>
          </div>
        </div>
      )}

      {(Object.keys(MEAL_LABELS) as MealType[]).map(meal => {
        const entries = day.meals[meal];
        const mt = calcEntryTotals(entries);
        return (
          <div key={meal} style={{ marginBottom: 16, background: 'var(--bg-secondary)', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{MEAL_LABELS[meal]}</span>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{mt.kcal} ккал | Б:{Math.round(mt.p)} Ж:{Math.round(mt.f)} У:{Math.round(mt.c)}</span>
            </div>
            {entries.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>Пусто</div>}
            {entries.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 13 }}>
                <span style={{ flex: 1 }}>{e.name}</span>
                <input
                  type="number"
                  value={e.weight}
                  onChange={ev => { const v = parseInt(ev.target.value); if (v > 0) updateWeight(meal, i, v); }}
                  style={{ width: 50, padding: '2px 4px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12, textAlign: 'center' }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 30 }}>г</span>
                <span style={{ fontSize: 11, minWidth: 70 }}>{e.kcal} ккал</span>
                <span style={{ fontSize: 11, color: 'var(--accent-blue)', minWidth: 40 }}>Б:{e.p}</span>
                <span style={{ fontSize: 11, color: 'var(--accent-yellow)', minWidth: 40 }}>Ж:{e.f}</span>
                <span style={{ fontSize: 11, color: 'var(--accent-green)', minWidth: 40 }}>У:{e.c}</span>
                <button onClick={() => removeFood(meal, i)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14, padding: 0 }}>&#10005;</button>
              </div>
            ))}
            <button
              onClick={() => setAddingMeal(meal)}
              style={{ marginTop: 6, background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}
            >
              + Добавить
            </button>
          </div>
        );
      })}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Вода</span>
        <span style={{ fontSize: 14 }}>{day.water.toFixed(1)} / {targets?.water || 3} л</span>
        <button onClick={addWater} style={{ background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>+250</button>
        <button onClick={() => { const updated = { ...diary }; if (!updated[d]) updated[d] = emptyDay(d); updated[d] = { ...updated[d], water: (updated[d].water || 0) + 0.5 }; setDiary(updated); saveDiary(updated); }} style={{ background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>+500</button>
      </div>

      {targets && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 15 }}>Итого за день</h3>
          {[
            { label: 'Ккалории', val: totals.kcal, max: targets.kcal, color: 'var(--accent-blue)' },
            { label: 'Белки', val: Math.round(totals.p), max: targets.protein, color: 'var(--accent-blue)' },
            { label: 'Жиры', val: Math.round(totals.f), max: targets.fats, color: 'var(--accent-yellow)' },
            { label: 'Углеводы', val: Math.round(totals.c), max: targets.carbs, color: 'var(--accent-green)' },
            { label: 'Клетчатка', val: Math.round(totals.fiber), max: targets.fiber, color: 'var(--accent-green)' },
            { label: 'Вода', val: Math.round(day.water * 10) / 10, max: targets.water, color: 'var(--accent-blue)' },
          ].map(row => (
            <div key={row.label} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                <span>{row.label}</span>
                <span>{row.val} / {row.max}{row.label === 'Вода' ? ' л' : row.label === 'Ккалории' ? '' : ' г'}</span>
              </div>
              <ProgressBar value={row.val} max={row.max} color={row.color} />
            </div>
          ))}
        </div>
      )}

      {addingMeal && (
        <FoodSearchModal
          onSelect={(food, weight) => addFood(addingMeal, food, weight)}
          onClose={() => setAddingMeal(null)}
        />
      )}
    </div>
  );
}

function CalcTab({ targets, setTargets }: { targets: NutritionTargets | null; setTargets: React.Dispatch<React.SetStateAction<NutritionTargets | null>> }) {
  const profile = getProfile();
  const [form, setForm] = useState<NutritionInput>({
    weightKg: profile.settings?.weight || 80,
    heightCm: profile.settings?.height || 178,
    age: profile.settings?.age || 30,
    sex: profile.settings?.sex || 'male',
    pal: 1.55,
    goal: profile.settings?.primaryGoal || profile.settings?.goal || 'maintenance',
    bodyFatPercent: profile.settings?.bodyFat,
  });

  const calculate = () => {
    const result = calcNutrition(form);
    setTargets(result);
  };

  useEffect(() => { calculate(); }, []);

  const set = (key: keyof NutritionInput, val: any) => setForm(f => ({ ...f, [key]: val }));

  const topProtein = useMemo(() => getTopByProtein(5), []);
  const topCarbs = useMemo(() => getTopByCarbs(5), []);
  const topFats = useMemo(() => getTopByFat(4), []);

  return (
    <div>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 15 }}>Параметры</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ fontSize: 12 }}>
            Вес (кг)
            <input type="number" value={form.weightKg} onChange={e => set('weightKg', +e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, marginTop: 2, boxSizing: 'border-box' }} />
          </label>
          <label style={{ fontSize: 12 }}>
            Рост (см)
            <input type="number" value={form.heightCm} onChange={e => set('heightCm', +e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, marginTop: 2, boxSizing: 'border-box' }} />
          </label>
          <label style={{ fontSize: 12 }}>
            Возраст
            <input type="number" value={form.age} onChange={e => set('age', +e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, marginTop: 2, boxSizing: 'border-box' }} />
          </label>
          <label style={{ fontSize: 12 }}>
            Пол
            <select value={form.sex} onChange={e => set('sex', e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, marginTop: 2, boxSizing: 'border-box' }}>
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
            </select>
          </label>
          <label style={{ fontSize: 12 }}>
            PAL
            <select value={form.pal} onChange={e => set('pal', +e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, marginTop: 2, boxSizing: 'border-box' }}>
              <option value={1.2}>1.2 - Сидячий</option>
              <option value={1.375}>1.375 - Лёгкая активность</option>
              <option value={1.55}>1.55 - Средняя</option>
              <option value={1.725}>1.725 - Высокая</option>
              <option value={1.9}>1.9 - Очень высокая</option>
            </select>
          </label>
          <label style={{ fontSize: 12 }}>
            Цель
            <select value={form.goal} onChange={e => set('goal', e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, marginTop: 2, boxSizing: 'border-box' }}>
              <option value="maintenance">Поддержание</option>
              <option value="bulk">Набор</option>
              <option value="cut">Похудение</option>
              <option value="recomp">Рекомпозиция</option>
              <option value="rehab">Восстановление</option>
              <option value="strength">Силовой</option>
            </select>
          </label>
          <label style={{ fontSize: 12 }}>
            % жира (опц.)
            <input type="number" value={form.bodyFatPercent || ''} onChange={e => set('bodyFatPercent', e.target.value ? +e.target.value : undefined)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, marginTop: 2, boxSizing: 'border-box' }} />
          </label>
        </div>
        <button onClick={calculate} style={{ marginTop: 12, background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 14, cursor: 'pointer', width: '100%' }}>Рассчитать</button>
      </div>

      {targets && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 15 }}>Результаты</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Базовый метаболизм (BMR)', value: `${targets.bmr} ккал` },
              { label: 'Суточный расход (TDEE)', value: `${targets.tdee} ккал` },
              { label: 'Целевые ккал', value: `${targets.kcal}` },
              { label: 'Белки', value: `${targets.protein} г` },
              { label: 'Жиры', value: `${targets.fats} г` },
              { label: 'Углеводы', value: `${targets.carbs} г` },
              { label: 'Вода', value: `${targets.water} л` },
              { label: 'Клетчатка', value: `${targets.fiber} г` },
            ].map(r => (
              <div key={r.label} style={{ background: 'var(--bg-primary)', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{r.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{r.value}</div>
              </div>
            ))}
          </div>
          {Object.keys(targets.micros).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Микронутриенты</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {Object.entries(targets.micros).map(([k, v]) => (
                  <div key={k} style={{ fontSize: 12 }}>{k}: {v} мг</div>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Рекомендуемые продукты</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 4 }}>Белки</div>
              {topProtein.map(f => (
                <div key={f.id} style={{ fontSize: 12, padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{f.name}</span>
                  <span style={{ color: 'var(--text-dim)' }}>Б:{f.protein} г</span>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-green)', marginBottom: 4 }}>Углеводы</div>
              {topCarbs.map(f => (
                <div key={f.id} style={{ fontSize: 12, padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{f.name}</span>
                  <span style={{ color: 'var(--text-dim)' }}>У:{f.carbs} GI:{f.gi}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-yellow)', marginBottom: 4 }}>Жиры</div>
              {topFats.map(f => (
                <div key={f.id} style={{ fontSize: 12, padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{f.name}</span>
                  <span style={{ color: 'var(--text-dim)' }}>Ж:{f.fat} г</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FoodCard({ food, deficit }: { food: typeof FOOD_DB[number]; deficit?: number }) {
  const [open, setOpen] = useState(false);
  const gramsToCover = deficit && food.protein > 0 && food.category === 'protein'
    ? Math.ceil(deficit / food.protein * 100)
    : deficit && food.carbs > 0 && food.category !== 'protein' && food.category !== 'fat'
    ? Math.ceil(deficit / food.carbs * 100)
    : 0;
  const tierColor: Record<string, string> = { basic: '#4CAF50', mid: '#2196F3', max: '#FF9800' };
  const tierLabel: Record<string, string> = { basic: 'База', mid: 'Средний', max: 'Макс' };

  return (
    <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: '8px 10px', marginBottom: 6, border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{food.name}</span>
          {food.tier && <span style={{ marginLeft: 6, fontSize: 10, color: tierColor[food.tier] || '#888', background: `${tierColor[food.tier] || '#888'}20`, padding: '1px 6px', borderRadius: 4 }}>{tierLabel[food.tier] || food.tier}</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>
          <div>{food.kcal} ккал / 100 г</div>
          <div>Б:{food.protein} Ж:{food.fat} У:{food.carbs}</div>
        </div>
      </div>
      {gramsToCover > 0 && (
        <div style={{ fontSize: 11, color: 'var(--accent-green)', marginTop: 2 }}>
          ~{gramsToCover} г для покрытия дефицита
        </div>
      )}
      {food.gi > 0 && <div style={{ fontSize: 10, color: food.gi > 55 ? 'var(--danger)' : 'var(--success)', marginTop: 1 }}>GI: {food.gi}</div>}
      {open && (
        <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {food.description && <div style={{ color: 'var(--text-primary)', marginBottom: 4 }}>{food.description}</div>}
          {food.pharmaNote && <div style={{ color: '#FFA726', marginBottom: 4 }}>Фармако: {food.pharmaNote}</div>}
          {food.timing && <div style={{ color: 'var(--accent-blue)', marginBottom: 4 }}>Время: {food.timing === 'after_train' ? 'После тренировки' : food.timing === 'morning' ? 'Утро' : food.timing === 'before_sleep' ? 'Перед сном' : food.timing === 'lunch' ? 'Обед' : 'Любое'}</div>}
          {(food.bestFor && food.bestFor.length > 0) && <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>Подходит для: {food.bestFor.join(', ')}</div>}
          <div style={{ color: 'var(--text-dim)' }}>Порция: {food.servingSize} | Клетчатка: {food.fiber} г</div>
        </div>
      )}
    </div>
  );
}

function AdviceTab({ targets, diary, goal }: { targets: NutritionTargets | null; diary: Record<string, DayDiary>; goal: string }) {
  const profile = getProfile();
  const d = today();
  const day: DayDiary = diary[d] || emptyDay(d);
  const totals = calcDayTotals(day);

  const drugs = [
    ...(profile.settings?.currentMedications || []).map((m: any) => typeof m === 'string' ? m : m.name),
    ...(profile.settings?.currentSupplements || []).map((s: any) => typeof s === 'string' ? s : s.name),
  ];

  const [productSection, setProductSection] = useState<ProductSection>(null);
  const [rationTier, setRationTier] = useState<RationTier>(null);
  const [showMacroCycle, setShowMacroCycle] = useState(false);

  const advice = useMemo(() => {
    if (!targets) return null;
    return generateStructuredAdvice(
      targets,
      goal,
      { kcal: totals.kcal, pro: totals.p, fiber: totals.fiber, water: totals.water },
      drugs
    );
  }, [targets, goal, totals, drugs]);

  const macroCycle = useMemo(() => {
    if (!targets) return null;
    const trainingDays: boolean[] = (profile as any).settings?.trainingSchedule?.map((d: number) => [1,0,1,0,1,1,0][d] === 1) || [true, false, true, false, true, true, false];
    return generateMacroCycle(targets, trainingDays, today());
  }, [targets]);

  if (!targets || !advice) {
    return (
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 14, color: 'var(--text-dim)' }}>Сначала рассчитайте цели в калькуляторе.</div>
      </div>
    );
  }

  const proteinDeficit = Math.max(0, targets.protein - Math.round(totals.p));
  const carbsDeficit = Math.max(0, targets.carbs - Math.round(totals.c));
  const fatsDeficit = Math.max(0, targets.fats - Math.round(totals.f));

  const sectionBtnStyle = (active: boolean) => ({
    flex: 1,
    padding: '10px 8px',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    background: active ? 'var(--accent-blue)' : 'var(--bg-primary)',
    color: active ? '#fff' : 'var(--text-dim)',
    transition: 'all 0.2s',
  });

  const tierBtnStyle = (active: boolean, color: string) => ({
    flex: 1,
    padding: '8px 6px',
    border: `1px solid ${active ? color : 'var(--border)'}`,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    background: active ? `${color}20` : 'var(--bg-primary)',
    color: active ? color : 'var(--text-dim)',
    transition: 'all 0.2s',
  });

  return (
    <div>
      {advice.goalComment && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 15, color: 'var(--accent-blue)' }}>{advice.goalComment.title}</h3>
          <div style={{ fontSize: 12, lineHeight: 1.7 }}>
            <div style={{ marginBottom: 6 }}><strong>Белки:</strong> {advice.goalComment.protein}</div>
            <div style={{ marginBottom: 6 }}><strong>Жиры:</strong> {advice.goalComment.fats}</div>
            <div style={{ marginBottom: 6 }}><strong>Углеводы:</strong> {advice.goalComment.carbs}</div>
            <div><strong>Тайминг:</strong> {advice.goalComment.timing}</div>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: 15 }}>Дефициты</h3>
        {advice.deficits.map(d => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
            <span style={{ minWidth: 80 }}>{d.label}</span>
            <ProgressBar value={d.current} max={d.target} color={d.isLow ? 'var(--danger)' : 'var(--success)'} />
            <span style={{ minWidth: 45, textAlign: 'right', color: d.isLow ? 'var(--danger)' : 'var(--success)', fontSize: 12 }}>{d.pct}%</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 60 }}>{d.current}/{d.target} {d.unit}</span>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: 15 }}>Подбор продуктов</h3>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button onClick={() => setProductSection(productSection === 'protein' ? null : 'protein')} style={sectionBtnStyle(productSection === 'protein')}>
            Белки{proteinDeficit > 0 ? ` (-${proteinDeficit}г)` : ' ✅'}
          </button>
          <button onClick={() => setProductSection(productSection === 'carbs' ? null : 'carbs')} style={sectionBtnStyle(productSection === 'carbs')}>
            Углеводы{carbsDeficit > 0 ? ` (-${carbsDeficit}г)` : ' ✅'}
          </button>
          <button onClick={() => setProductSection(productSection === 'fats' ? null : 'fats')} style={sectionBtnStyle(productSection === 'fats')}>
            Жиры{fatsDeficit > 0 ? ` (-${fatsDeficit}г)` : ' ✅'}
          </button>
        </div>

        {productSection && (
          <div>
            {productSection === 'protein' && advice.topProtein.map(f => (
              <FoodCard key={f.id} food={f} deficit={proteinDeficit} />
            ))}
            {productSection === 'carbs' && advice.topCarbs.map(f => (
              <FoodCard key={f.id} food={f} deficit={carbsDeficit} />
            ))}
            {productSection === 'fats' && advice.topFats.map(f => (
              <FoodCard key={f.id} food={f} deficit={fatsDeficit} />
            ))}
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: 15 }}>Рацион по уровням</h3>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button onClick={() => setRationTier(rationTier === 'basic' ? null : 'basic')} style={tierBtnStyle(rationTier === 'basic', '#4CAF50')}>
            Базовый
          </button>
          <button onClick={() => setRationTier(rationTier === 'mid' ? null : 'mid')} style={tierBtnStyle(rationTier === 'mid', '#2196F3')}>
            Средний
          </button>
          <button onClick={() => setRationTier(rationTier === 'max' ? null : 'max')} style={tierBtnStyle(rationTier === 'max', '#FF9800')}>
            Максимум
          </button>
        </div>

        {rationTier && advice.rationTiers
          .filter(t => t.level === rationTier)
          .map(tier => (
            <div key={tier.level}>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8, fontStyle: 'italic' }}>{tier.desc}</div>
              {tier.foods.map(cat => (
                <div key={cat.category} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--accent-blue)' }}>{cat.category}</div>
                  {cat.items.length > 0 ? cat.items.map(f => (
                    <FoodCard key={f.id} food={f} />
                  )) : (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>Нет продуктов в этой категории</div>
                  )}
                </div>
              ))}
            </div>
          ))}
      </div>

      {advice.pharmaNotes.length > 0 && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 15, color: '#FFA726' }}>Фармако-пищевые заметки</h3>
          {advice.pharmaNotes.map(pn => (
            <div key={pn.drug} style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: '8px 10px', marginBottom: 8, borderLeft: '3px solid #FFA726' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{pn.drug}</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 6 }}>{pn.note}</div>
              {pn.foods.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3 }}>Рекомендуемые продукты:</div>
                  {pn.foods.map(fd => (
                    <div key={fd.id} style={{ fontSize: 12, marginLeft: 8, marginBottom: 2 }}>
                      <strong>{fd.name}</strong> {fd.reason && <span style={{ color: 'var(--text-dim)' }}>— {fd.reason}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {advice.timingAdvice.length > 0 && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 15 }}>Советы по таймингу</h3>
          {advice.timingAdvice.map((ta, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 12 }}>
              <span style={{ minWidth: 140, fontWeight: 600, color: 'var(--accent-blue)' }}>{ta.period}</span>
              <span style={{ lineHeight: 1.5 }}>{ta.foods}</span>
            </div>
          ))}
        </div>
      )}

      {drugs.length > 0 && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 15 }}>Активные препараты</h3>
          {drugs.map((d: string, i: number) => (
            <div key={i} style={{ fontSize: 13, marginBottom: 4, padding: '4px 8px', background: 'var(--bg-primary)', borderRadius: 6 }}>{d}</div>
          ))}
        </div>
      )}

      <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Макроцикл (неделя)</h3>
          <button onClick={() => setShowMacroCycle(!showMacroCycle)} style={{ background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}>
            {showMacroCycle ? 'Скрыть' : 'Показать'}
          </button>
        </div>
        {!showMacroCycle && <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Тренировочные дни: +8% ккал, +15% углеводов. Дни отдыха: -5% ккал, -15% углеводов.</div>}
        {showMacroCycle && macroCycle && (
          <div>
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((dayName, i) => {
              const d = macroCycle.days[i];
              if (!d) return null;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, padding: '6px 8px', background: 'var(--bg-primary)', borderRadius: 6, fontSize: 12 }}>
                  <span style={{ fontWeight: 700, minWidth: 24, color: d.isTrainingDay ? 'var(--accent-green)' : 'var(--text-dim)' }}>{dayName}</span>
                  <span style={{ minWidth: 16, fontSize: 10, color: d.isTrainingDay ? 'var(--accent-green)' : 'var(--text-dim)' }}>{d.isTrainingDay ? 'Тр' : 'Отд'}</span>
                  <span style={{ minWidth: 55 }}>{d.targets.kcal} ккал</span>
                  <span style={{ color: 'var(--accent-blue)', minWidth: 40 }}>Б:{d.targets.p}</span>
                  <span style={{ color: 'var(--accent-yellow)', minWidth: 40 }}>Ж:{d.targets.f}</span>
                  <span style={{ color: 'var(--accent-green)', minWidth: 40 }}>У:{d.targets.c}</span>
                </div>
              );
            })}
            <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg-primary)', borderRadius: 6, fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Среднее за день</div>
              <span>{macroCycle.avgDaily.kcal} ккал | Б:{macroCycle.avgDaily.p} Ж:{macroCycle.avgDaily.f} У:{macroCycle.avgDaily.c}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const RationTab: React.FC<{ plan: DayMealPlan }> = ({ plan }) => {
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null);

  const mealColors: Record<string, string> = {
    'Завтрак': '#FF9800', 'Перекус 1': '#4CAF50', 'Обед': '#2196F3',
    'Перекус 2': '#9C27B0', 'Ужин': '#f44336', 'Перед сном': '#3F51B5',
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Итого за день</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{plan.totals.kcal}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>ккал</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#2196F3' }}>{plan.totals.protein}г</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Белки</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#FF9800' }}>{plan.totals.fat}г</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Жиры</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#4CAF50' }}>{plan.totals.carbs}г</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Углеводы</div>
          </div>
        </div>
      </div>

      {plan.warnings.length > 0 && (
        <div className="card" style={{ marginBottom: 12, borderLeft: '3px solid #FF9800' }}>
          {plan.warnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: '#FF9800', marginBottom: 2 }}>⚠️ {w}</div>)}
        </div>
      )}

      {plan.meals.map((meal, idx) => (
        <div key={idx} className="card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpandedMeal(expandedMeal === idx ? null : idx)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: mealColors[meal.label] || '#888' }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>{meal.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{meal.time}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-light)' }}>
              <span>{meal.totalKcal} ккал</span>
              <span>Б{meal.totalP}</span>
              <span>Ж{meal.totalF}</span>
              <span>У{meal.totalC}</span>
            </div>
          </div>
          {expandedMeal === idx && (
            <div style={{ marginTop: 8 }}>
              {meal.foods.map((item, j) => (
                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>{item.name}</span>
                    <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>{item.grams}г</span>
                    {item.reason && <div style={{ fontSize: 10, color: 'var(--accent-green)' }}>{item.reason}</div>}
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {item.kcal} ккал | Б{item.protein} Ж{item.fat} У{item.carbs}
                  </div>
                </div>
              ))}
              {meal.pharmaNotes.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  {meal.pharmaNotes.map((n, k) => <div key={k} style={{ fontSize: 10, color: '#FF9800' }}>💊 {n}</div>)}
                </div>
              )}
              {meal.timingNote && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>⏰ {meal.timingNote}</div>}
            </div>
          )}
        </div>
      ))}

      {plan.pharmaRules.length > 0 && (
        <div className="card" style={{ marginTop: 8 }}>
          <h4 style={{ margin: '0 0 8px 0' }}>Фарма-пищевые правила</h4>
          {plan.pharmaRules.map((rule, i) => (
            <div key={i} style={{ fontSize: 12, marginBottom: 6, padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
              <span style={{ fontWeight: 600 }}>{rule.drug}</span>: {rule.details}
              {rule.gramsCarbs && <span style={{ color: 'var(--accent-green)', marginLeft: 6 }}>→ {rule.gramsCarbs}г углеводов</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const NutritionScreen: React.FC<{ initialTab?: TabId }> = ({ initialTab }) => {
  const [tab, setTab] = useState<TabId>(initialTab || 'diary');
  const [diary, setDiary] = useState<Record<string, DayDiary>>(loadDiary);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);

  const linked = useDataLink();
  const profile = linked.profile;
  const goal = profile.settings?.primaryGoal || profile.settings?.goal || 'maintenance';

  useEffect(() => {
    const p = linked.profile;
    const g = p.settings?.primaryGoal || p.settings?.goal || 'maintenance';
    if (p.settings?.weight) {
      const result = calcNutrition({
        weightKg: p.settings.weight,
        heightCm: p.settings.height || 178,
        age: p.settings.age || 30,
        sex: p.settings.sex || 'male',
        pal: 1.55,
        goal: g,
        bodyFatPercent: p.settings.bodyFat,
      });
      setTargets(result);
    }
  }, [linked.profile]);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'diary', label: 'Дневник' },
    { id: 'calc', label: 'Калькулятор' },
    { id: 'ration', label: 'Рацион' },
    { id: 'advice', label: 'Советы' },
  ];

  const [showScanner, setShowScanner] = useState(false);
  const [mealPlan, setMealPlan] = useState<DayMealPlan | null>(null);

  const handleProductFound = useCallback((product: OFFProduct) => {
    setShowScanner(false);
  }, []);

  useEffect(() => {
    if (tab === 'ration' && !mealPlan) {
      const p = getProfile();
      const g = p.settings?.primaryGoal || p.settings?.goal || 'maintenance';
      const plan = generateDayMealPlan(
        targets || { bmr: 1800, tdee: 2800, kcal: 2500, protein: 150, fats: 80, carbs: 280, water: 2.5, fiber: 30, micros: {} },
        g,
        [],
        null,
      );
      setMealPlan(plan);
    }
  }, [tab, mealPlan]);

  return (
    <div className="screen nutrition" style={{ maxWidth: 600, margin: '0 auto', padding: '0 12px 20px' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Питание</h1>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: tab === t.id ? 'var(--accent-blue)' : 'var(--bg-secondary)',
              color: tab === t.id ? '#fff' : 'var(--text-dim)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={() => setShowScanner(true)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text-dim)' }}>
          📷 Сканировать штрихкод
        </button>
      </div>
      {tab === 'diary' && <DiaryTab diary={diary} setDiary={setDiary} targets={targets} />}
      {tab === 'calc' && <CalcTab targets={targets} setTargets={setTargets} />}
      {tab === 'ration' && mealPlan && <RationTab plan={mealPlan} />}
      {tab === 'advice' && <AdviceTab targets={targets} diary={diary} goal={goal} />}
      {showScanner && <BarcodeScanner onProductFound={handleProductFound} onClose={() => setShowScanner(false)} />}
    </div>
  );
};
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { calcNutrition, generateNutritionAdvice } from '../../engines/nutrition.engine';
import { getProfile } from '../../core/profile-manager';
import { FOOD_DB, searchFood } from '../../core/nutrition-database';
import type { NutritionInput, NutritionTargets, FoodItem } from '../../core/types';

type TabId = 'diary' | 'calc' | 'advice';
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

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
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{food.servingSize}</div>
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
        </div>
      )}
    </div>
  );
}

function AdviceTab({ targets, diary }: { targets: NutritionTargets | null; diary: Record<string, DayDiary> }) {
  const profile = getProfile();
  const d = today();
  const day: DayDiary = diary[d] || emptyDay(d);
  const totals = calcDayTotals(day);

  const drugs = [
    ...(profile.settings?.currentMedications || []),
    ...(profile.settings?.currentSupplements || []),
  ];

  const adviceText = useMemo(() => {
    if (!targets) return 'Сначала рассчитайте цели в калькуляторе.';
    return generateNutritionAdvice(targets, { kcal: totals.kcal, pro: totals.p, fiber: totals.fiber, water: totals.water }, drugs);
  }, [targets, totals, drugs]);

  return (
    <div>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: 15 }}>Рекомендации</h3>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, fontFamily: 'inherit', margin: 0 }}>{adviceText}</pre>
      </div>

      {drugs.length > 0 && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 15 }}>Активные препараты</h3>
          {drugs.map((d: string, i: number) => (
            <div key={i} style={{ fontSize: 13, marginBottom: 4, padding: '4px 8px', background: 'var(--bg-primary)', borderRadius: 6 }}>{d}</div>
          ))}
        </div>
      )}

      {targets && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14, marginTop: 16 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 15 }}>Дефициты</h3>
          {[
            { label: 'Ккалории', current: totals.kcal, target: targets.kcal },
            { label: 'Белки (г)', current: Math.round(totals.p), target: targets.protein },
            { label: 'Жиры (г)', current: Math.round(totals.f), target: targets.fats },
            { label: 'Углеводы (г)', current: Math.round(totals.c), target: targets.carbs },
            { label: 'Клетчатка (г)', current: Math.round(totals.fiber), target: targets.fiber },
            { label: 'Вода (л)', current: Math.round(day.water * 10) / 10, target: targets.water },
          ].map(r => {
            const pct = r.target > 0 ? Math.round((r.current / r.target) * 100) : 0;
            const isLow = pct < 80;
            return (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
                <span style={{ minWidth: 110 }}>{r.label}</span>
                <ProgressBar value={r.current} max={r.target} color={isLow ? 'var(--danger)' : 'var(--success)'} />
                <span style={{ minWidth: 50, textAlign: 'right', color: isLow ? 'var(--danger)' : 'var(--success)' }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const NutritionScreen: React.FC = () => {
  const [tab, setTab] = useState<TabId>('diary');
  const [diary, setDiary] = useState<Record<string, DayDiary>>(loadDiary);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);

  useEffect(() => {
    const p = getProfile();
    const goal = p.settings?.primaryGoal || p.settings?.goal || 'maintenance';
    if (p.settings?.weight) {
      const result = calcNutrition({
        weightKg: p.settings.weight,
        heightCm: p.settings.height || 178,
        age: p.settings.age || 30,
        sex: p.settings.sex || 'male',
        pal: 1.55,
        goal,
        bodyFatPercent: p.settings.bodyFat,
      });
      setTargets(result);
    }
  }, []);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'diary', label: 'Дневник' },
    { id: 'calc', label: 'Калькулятор' },
    { id: 'advice', label: 'Советы' },
  ];

  return (
    <div className="screen nutrition" style={{ maxWidth: 600, margin: '0 auto', padding: '0 12px 20px' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Питание</h1>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
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
      {tab === 'diary' && <DiaryTab diary={diary} setDiary={setDiary} targets={targets} />}
      {tab === 'calc' && <CalcTab targets={targets} setTargets={setTargets} />}
      {tab === 'advice' && <AdviceTab targets={targets} diary={diary} />}
    </div>
  );
};
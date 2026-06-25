import React, { useState, useMemo } from 'react';
import { FOOD_DB, calcBBQualityScore } from '../../../core/nutrition-database';
import { useDataLink } from '../../../core/data-link';
import { scoreAllProducts, compareProducts, calcMealScore, CATEGORY_LABELS, GOAL_MAP_RU } from '../../../engines/product-usefulness.engine';
import type { MealProduct, SavedMeal, MealScore } from '../../../engines/product-usefulness.engine';
import { calculateOverallScore, scoreAllProductsV2, compareProductsV2, calcMealScoreV2, analyzeDailyDiet, getDefaultProfile, type UserDietProfile, type V2ScoreResult } from '../../../engines/product-usefulness-v2.engine';

type PlannerTab = 'settings' | 'catalog' | 'compare' | 'meal';
type SortKey = 'score' | 'name' | 'protein' | 'kcal';

const PILL = (active: boolean, color = '#00e68a') => ({
  padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 8, fontWeight: active ? 700 : 400,
  background: active ? `${color}18` : '#202023',
  border: active ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.06)',
  color: active ? color : 'rgba(255,255,255,0.85)', transition: 'all 0.15s',
} as React.CSSProperties);

const INPUT = (w = '80px') => ({
  padding: '6px 8px', borderRadius: 8, fontSize: 9, background: '#202023',
  border: '1px solid rgba(255,255,255,0.06)', color: '#fff', outline: 'none', width: w, boxSizing: 'border-box' as const,
});

const ScoreBadge: React.FC<{ score: number; max: number; color: string; label: string }> = ({ score, max, color, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `${color}18`, border: `2px solid ${color}`, fontSize: 12, fontWeight: 800, color }}>
      {score}
    </div>
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color }}>{label}</div>
      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>из {max}</div>
    </div>
  </div>
);

const ScoreBar: React.FC<{ label: string; value: number; max: number; color: string }> = ({ label, value, max, color }) => {
  const pct = Math.min(100, Math.round(value / max * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', minWidth: 50 }}>{label}</span>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', minWidth: 20, textAlign: 'right' }}>{value}</span>
    </div>
  );
};

const MODULE_LABELS: Record<string, { label: string; color: string }> = {
  A: { label: '🅰 Питат. плотность', color: '#22c55e' },
  B: { label: '🅱 Контекст', color: '#3b82f6' },
  C: { label: '🅲 Цена/эффект.', color: '#f59e0b' },
};

export const ProductUsefulnessPlanner: React.FC = () => {
  const linked = useDataLink();
  const profileGoal = linked.profile?.settings?.primaryGoal || linked.profile?.settings?.goal;
  const profileWeight = linked.profile?.settings?.weight || 80;
  const profileWorkouts = linked.profile?.settings?.workoutsPerWeek || 0;
  const courseEntries = linked.course ?? [];
  const profileAAS = Array.isArray(courseEntries) && courseEntries.some((e: any) => e.type === 'ААС' || e.class === 'aas');

  const [plannerTab, setPlannerTab] = useState<PlannerTab>('catalog');
  const [enableA, setEnableA] = useState(true);
  const [enableB, setEnableB] = useState(true);
  const [enableC, setEnableC] = useState(true);

  const [manualGoal, setManualGoal] = useState(profileGoal || '');
  const [manualWeight, setManualWeight] = useState(profileWeight.toString());
  const [manualWorkouts, setManualWorkouts] = useState(profileWorkouts.toString());
  const [manualAAS, setManualAAS] = useState(profileAAS);
  const [manualInsulin, setManualInsulin] = useState(false);
  const [manualPrice, setManualPrice] = useState('');

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);

  const [mealProducts, setMealProducts] = useState<MealProduct[]>([]);
  const [mealSearch, setMealSearch] = useState('');
  const [mealResult, setMealResult] = useState<MealScore | null>(null);
  const [mealName, setMealName] = useState('');
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_saved_meals') || '[]'); }
    catch { return []; }
  });
  const [mealTab, setMealTab] = useState<'compose' | 'saved'>('compose');
  const [sourcePicker, setSourcePicker] = useState<{ source: string; title: string; items: Array<{ id: string; name: string; label?: string }> } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [useV2, setUseV2] = useState(false);
  const [v2Profile, setV2Profile] = useState<UserDietProfile>(getDefaultProfile());

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 2000); };

  const opts = useMemo(() => ({
    goal: manualGoal || profileGoal,
    weightKg: parseInt(manualWeight) || profileWeight,
    workoutsPerWeek: parseInt(manualWorkouts) || profileWorkouts,
    hasAAS: manualAAS,
    hasInsulin: manualInsulin,
    pricePerKg: manualPrice ? parseInt(manualPrice) : undefined,
    enableA, enableB, enableC,
  }), [manualGoal, profileGoal, manualWeight, profileWeight, manualWorkouts, profileWorkouts, manualAAS, manualInsulin, manualPrice, enableA, enableB, enableC]);

  const fillFromProfile = () => {
    setManualGoal(profileGoal || '');
    setManualWeight(profileWeight.toString());
    setManualWorkouts(profileWorkouts.toString());
    setManualAAS(profileAAS);
    setManualInsulin(false);
    setManualPrice('');
  };

  const scored = useMemo(() => {
    return scoreAllProducts({ ...opts, category: category === 'all' ? undefined : category });
  }, [opts, category]);

  const v2Scored = useMemo(() => {
    if (!useV2) return new Map<string, V2ScoreResult>();
    const results = scoreAllProductsV2(v2Profile, category === 'all' ? undefined : category as any);
    return new Map(results.map(r => [r.food.id, r.score]));
  }, [useV2, v2Profile, category]);

  const filtered = useMemo(() => {
    if (!search) return scored;
    const q = search.toLowerCase();
    return scored.filter(s => (s.food.name || '').toLowerCase().includes(q) || (s.food.id || '').toLowerCase().includes(q));
  }, [scored, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortKey) {
      case 'score': arr.sort((a, b) => b.score.total - a.score.total); break;
      case 'name': arr.sort((a, b) => a.food.name.localeCompare(b.food.name)); break;
      case 'protein': arr.sort((a, b) => (b.food.protein || 0) - (a.food.protein || 0)); break;
      case 'kcal': arr.sort((a, b) => (a.food.kcal || 0) - (b.food.kcal || 0)); break;
    }
    return arr;
  }, [filtered, sortKey]);

  const displayed = useMemo(() => showAll ? sorted : sorted.slice(0, 50), [sorted, showAll]);

  const compareData = useMemo(() => {
    if (compareIds.length < 2) return [];
    return compareProducts(compareIds, opts);
  }, [compareIds, opts]);

  const toggleCompare = (id: string) => {
    if (compareIds.includes(id)) {
      setCompareIds(compareIds.filter(x => x !== id));
    } else {
      if (compareIds.length >= 3) setCompareIds([...compareIds.slice(1), id]);
      else setCompareIds([...compareIds, id]);
    }
  };

  const openSourcePicker = (source: string) => {
    try {
      if (source === 'plan') {
        const raw = JSON.parse(localStorage.getItem('he_daily_plan') || '[]');
        const fallback = JSON.parse(localStorage.getItem('he_quick_plan_items') || '[]');
        const list = raw.length > 0 ? raw : fallback;
        if (list.length === 0) { showToast('Нет сохранённого плана'); return; }
        const items = list.map((i: any) => ({ foodId: i.id || i.foodId, weightGrams: i.amount || i.weightGrams || 100 }));
        setMealProducts(prev => [...prev, ...items]);
        showToast(`✅ Добавлено ${items.length} продуктов из плана`);
        return;
      }
      if (source === 'recipe') {
        const recipes = JSON.parse(localStorage.getItem('he_recipes') || '[]');
        if (recipes.length === 0) { showToast('Нет рецептов'); return; }
        setSourcePicker({ source: 'recipe', title: '📝 Выберите рецепт', items: recipes.map((r: any) => ({ id: r.id, name: r.name, label: `${r.kcal || 0} ккал · Б${r.protein || 0} Ж${r.fat || 0} У${r.carbs || 0}` })) });
        return;
      }
      if (source === 'saved') {
        if (savedMeals.length === 0) { showToast('Нет сохранённых приёмов'); return; }
        setSourcePicker({ source: 'saved', title: '💾 Выберите приём', items: savedMeals.map(m => ({ id: m.id, name: m.name, label: `${m.products.length} продуктов` })) });
        return;
      }
      if (source === 'diary') {
        const diary = JSON.parse(localStorage.getItem('nutrition_diary') || '{}');
        const today = new Date().toISOString().split('T')[0];
        const dayData = diary[today]?.meals || {};
        const entries: { foodId: string; weightGrams: number }[] = [];
        Object.keys(dayData).forEach(mealName => {
          (dayData[mealName] || []).forEach((item: any) => {
            const q = (item.name || '').toLowerCase().trim();
            const found = FOOD_DB.find(f => f.name.toLowerCase() === q) || FOOD_DB.find(f => f.name.toLowerCase().includes(q) || q.includes(f.name.toLowerCase()));
            if (found) entries.push({ foodId: found.id, weightGrams: parseInt(item.qty) || 100 });
          });
        });
        if (entries.length === 0) { showToast('Нет записей в дневнике за сегодня'); return; }
        setMealProducts(prev => [...prev, ...entries]);
        showToast(`✅ Добавлено ${entries.length} продуктов из дневника`);
        return;
      }
    } catch { showToast('Ошибка загрузки'); }
  };

  const handlePickerSelect = (id: string) => {
    if (!sourcePicker) return;
    try {
      if (sourcePicker.source === 'saved') {
        const meal = savedMeals.find(m => m.id === id);
        if (meal) { setMealProducts(prev => [...prev, ...meal.products]); showToast(`✅ Загружен «${meal.name}»`); }
      }
      if (sourcePicker.source === 'recipe') {
        const allRecipes = JSON.parse(localStorage.getItem('he_recipes') || '[]');
        const recipe = allRecipes.find((r: any) => r.id === id);
        if (recipe) {
          const mapped: MealProduct[] = [];
          (recipe.ingredients || []).forEach((ing: string) => {
            const q = ing.toLowerCase().trim();
            const found = FOOD_DB.find(f => f.name.toLowerCase() === q) || FOOD_DB.find(f => f.name.toLowerCase().includes(q) || q.includes(f.name.toLowerCase()));
            if (found) mapped.push({ foodId: found.id, weightGrams: 100 });
          });
          if (mapped.length > 0) { setMealProducts(prev => [...prev, ...mapped]); showToast(`✅ Добавлено ${mapped.length} продуктов из «${recipe.name}»`); }
          else showToast('Не удалось сопоставить ингредиенты с базой');
        }
      }
    } catch { showToast('Ошибка'); }
    setSourcePicker(null);
  };

  const activeModules = [
    ...(enableA ? [MODULE_LABELS.A] : []),
    ...(enableB ? [MODULE_LABELS.B] : []),
    ...(enableC ? [MODULE_LABELS.C] : []),
  ];

  const modulesDesc = [
    ...(enableA ? ['🅰 Питательная плотность (белок, микро, клетчатка, категория)'] : []),
    ...(enableB ? ['🅱 Контекст (цель, время, фарма-синергия)'] : []),
    ...(enableC ? ['🅲 Цена/эффективность (стоимость белка)'] : []),
  ];

  return (
    <div style={{ padding: '0 2px' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        <button onClick={() => setPlannerTab('settings')} style={PILL(plannerTab === 'settings', '#f59e0b')}>⚙️</button>
        <button onClick={() => setPlannerTab('catalog')} style={PILL(plannerTab === 'catalog', '#3b82f6')}>📦 {filtered.length > 0 && `(${filtered.length})`}</button>
        <button onClick={() => setPlannerTab('compare')} style={PILL(plannerTab === 'compare', '#8b5cf6')}>⚖️ {compareIds.length > 0 && `(${compareIds.length})`}</button>
        <button onClick={() => setPlannerTab('meal')} style={PILL(plannerTab === 'meal', '#f97316')}>🍽️ Приём</button>
      </div>

      {plannerTab === 'settings' && (
        <div style={{ borderRadius: 12, padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>⚙️ Параметры расчёта</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Цель</div>
              <select value={manualGoal} onChange={e => setManualGoal(e.target.value)} style={{
                ...INPUT('100%'), padding: '6px 8px', appearance: 'none' as const,
              }}>
                <option value="">Авто ({profileGoal ? GOAL_MAP_RU[profileGoal] || profileGoal : 'не указана'})</option>
                {Object.entries(GOAL_MAP_RU).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Вес (кг)</div>
              <input type="number" value={manualWeight} onChange={e => setManualWeight(e.target.value)} style={INPUT('100%')} />
            </div>
            <div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Тренировок/нед</div>
              <input type="number" value={manualWorkouts} onChange={e => setManualWorkouts(e.target.value)} style={INPUT('100%')} />
            </div>
            <div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Цена за кг (₽)</div>
              <input type="number" value={manualPrice} onChange={e => setManualPrice(e.target.value)} placeholder="Авто" style={INPUT('100%')} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
              <input type="checkbox" checked={manualAAS} onChange={e => setManualAAS(e.target.checked)} style={{ accentColor: '#ef4444' }} />
              ААС в курсе
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
              <input type="checkbox" checked={manualInsulin} onChange={e => setManualInsulin(e.target.checked)} style={{ accentColor: '#8b5cf6' }} />
              Инсулин
            </label>
            <button onClick={fillFromProfile} style={{
              marginLeft: 'auto', padding: '5px 10px', borderRadius: 8, fontSize: 7, border: '1px solid rgba(0,230,138,0.2)',
              background: 'rgba(0,230,138,0.08)', color: '#00e68a', cursor: 'pointer',
            }}>📋 Автозаполнение</button>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 8, marginTop: 4 }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Модули оценки:</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
              {([
                { key: 'A', color: '#22c55e', state: enableA, set: setEnableA },
                { key: 'B', color: '#3b82f6', state: enableB, set: setEnableB },
                { key: 'C', color: '#f59e0b', state: enableC, set: setEnableC },
              ] as const).map(m => (
                <button key={m.key} onClick={() => { m.set(!m.state); setShowAll(false); }} style={{
                  ...PILL(m.state, m.color), fontSize: 7, padding: '4px 8px',
                }}>
                  {m.state ? '✓' : '○'} {MODULE_LABELS[m.key].label}
                </button>
              ))}
            </div>
            {modulesDesc.length > 0 && (
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', lineHeight: 1.4 }}>
                Активны: {modulesDesc.join(' · ')}
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid rgba(0,230,138,0.1)', paddingTop: 6, marginTop: 6 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
              <span style={{ fontSize:9, fontWeight:700, color:'#00e68a' }}>🧬 v2 Скоринг</span>
              <button onClick={() => setUseV2(!useV2)} style={{
                padding:'3px 10px', borderRadius:10, fontSize:7, fontWeight:700, cursor:'pointer',
                background: useV2 ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.03)',
                border: useV2 ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                color: useV2 ? '#00e68a' : 'rgba(255,255,255,0.4)',
              }}>{useV2 ? '✅ Включён' : '○ Выключен'}</button>
            </div>
            {useV2 && (
              <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:4 }}>
                {['LEAN_MASS','EXTREME_CUT','PEAK_WEEK','POST_CYCLE','MOST'].map(ph => (
                  <button key={ph} onClick={() => setV2Profile(prev => ({...prev, phase: ph as any}))} style={{
                    padding:'2px 6px', borderRadius:6, fontSize:7, fontWeight:600, cursor:'pointer',
                    background: v2Profile.phase === ph ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                    border: v2Profile.phase === ph ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.04)',
                    color: v2Profile.phase === ph ? '#c4b5fd' : 'rgba(255,255,255,0.5)',
                  }}>{ph === 'LEAN_MASS' ? '💪 Набор' : ph === 'EXTREME_CUT' ? '🔥 Сушка' : ph === 'PEAK_WEEK' ? '⚡ Пик' : ph === 'POST_CYCLE' ? '🔄 ПКТ' : '🌉 Мост'}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {plannerTab === 'catalog' && (
        <>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск продуктов..." style={{
                width: '100%', padding: '8px 28px 8px 10px', borderRadius: 10, fontSize: 10, background: '#202023',
                border: '1px solid rgba(255,255,255,0.06)', color: '#fff', outline: 'none', boxSizing: 'border-box',
              }} />
              {search && (
                <span onClick={() => setSearch('')} style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                }}>×</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 8 }}>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button key={key} onClick={() => { setCategory(key); setShowAll(false); }} style={PILL(category === key, '#3b82f6')}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {(['score', 'name', 'protein', 'kcal'] as SortKey[]).map(k => (
              <button key={k} onClick={() => setSortKey(k)} style={PILL(sortKey === k, '#f59e0b')}>
                {k === 'score' ? '⭐ По скору' : k === 'name' ? '📝 По имени' : k === 'protein' ? '🥩 По белку' : '🔥 По калориям'}
              </button>
            ))}
            <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}>
              {filtered.length} из {scored.length}
            </span>
          </div>
          {activeModules.length > 0 && (
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
              {activeModules.map(m => (
                <span key={m.label} style={{ fontSize: 6, padding: '2px 5px', borderRadius: 4, background: `${m.color}12`, color: m.color, border: `1px solid ${m.color}20` }}>
                  {m.label}
                </span>
              ))}
              {(manualGoal || manualAAS || manualInsulin) && (
                <span style={{ fontSize: 6, padding: '2px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)' }}>
                  {manualGoal ? `${GOAL_MAP_RU[manualGoal] || manualGoal}` : ''}
                  {manualAAS ? ' · ААС' : ''}
                  {manualInsulin ? ' · Инсулин' : ''}
                </span>
              )}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {displayed.map(({ food, score }) => {
              const exp = expandedId === food.id;
              const isCompared = compareIds.includes(food.id);
              return (
                <div key={food.id} style={{
                  borderRadius: 12, padding: 10, background: exp ? `${score.color}06` : 'rgba(255,255,255,0.02)',
                  border: exp ? `1px solid ${score.color}20` : '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                    <div onClick={() => setExpandedId(exp ? null : food.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <ScoreBadge score={score.total} max={score.maxPossible} color={score.color} label={score.label} />
                      {useV2 && v2Scored.has(food.id) && (() => {
                        const vs = v2Scored.get(food.id)!;
                        return <div style={{ padding:'2px 6px', borderRadius:6, fontSize:7, fontWeight:700, background: vs.total >= 7 ? 'rgba(0,230,138,0.1)' : vs.total >= 5 ? 'rgba(249,115,22,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${vs.color}30`, color: vs.color }}>v2 {vs.total.toFixed(1)}</div>;
                      })()}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{food.name}</div>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                          {CATEGORY_LABELS[food.category] || food.category}
                          {food.tier && <span style={{ marginLeft: 4 }}>· {food.tier === 'max' ? '🔸' : food.tier === 'mid' ? '🔹' : '⚪'} {food.tier}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ textAlign: 'right', marginRight: 4 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#22c55e' }}>{food.protein}г</div>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{food.kcal} ккал</div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); toggleCompare(food.id); }} style={{
                        padding: '4px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 9, fontWeight: 600, whiteSpace: 'nowrap',
                        background: isCompared ? 'rgba(0,230,138,0.15)' : 'rgba(0,230,138,0.08)',
                        border: isCompared ? '1px solid #00e68a' : '1px solid rgba(0,230,138,0.2)',
                        color: isCompared ? '#00e68a' : 'rgba(0,230,138,0.8)',
                      }}>{isCompared ? '✓ В сравнении' : '⚖ Сравнить'}</button>
                    </div>
                  </div>
                  {exp && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${score.color}15` }}>
                      {enableA && <><div style={{ fontSize: 8, color: score.color, fontWeight: 600, marginBottom: 4 }}>📊 Разбивка скора</div>
                        <ScoreBar label="Белок" value={score.breakdown.proteinDensity} max={30} color="#3b82f6" />
                        <ScoreBar label="Микро" value={score.breakdown.microDensity} max={30} color="#22c55e" />
                        <ScoreBar label="Клетчатка" value={score.breakdown.fiberQuality} max={20} color="#f97316" />
                        <ScoreBar label="Аминокислоты" value={score.breakdown.aminoScore} max={25} color="#ec4899" />
                        <ScoreBar label="Категория" value={score.breakdown.tierScore} max={20} color="#f59e0b" /></>}
                      {enableB && <div style={{ marginTop: 4, fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>
                        {score.contextBonus.goalMatch > 0 && <span style={{ color: '#22c55e' }}>✓ Цель совпадает </span>}
                        {score.contextBonus.timingMatch > 0 && <span style={{ color: '#60a5fa' }}>✓ Время подходит </span>}
                        {score.contextBonus.pharmaMatch > 0 && <span style={{ color: '#8b5cf6' }}>✓ Фарма-синергия </span>}
                        {score.contextBonus.pharmaMatch < 0 && <span style={{ color: '#ef4444' }}>⚠️ Фарма-конфликт </span>}
                        {score.contextBonus.goalMatch === 0 && score.contextBonus.timingMatch === 0 && score.contextBonus.pharmaMatch === 0 && (
                          <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>
                        )}
                      </div>}
                      {enableC && score.costEfficiency && (
                        <div style={{ marginTop: 4, fontSize: 8, color: 'rgba(255,255,255,0.35)', display: 'flex', gap: 8 }}>
                          <span>💰 {score.costEfficiency.proteinCostRub} ₽/10г белка</span>
                          <span>💳 <span style={{ color: score.costEfficiency.efficiencyScore >= 50 ? '#22c55e' : '#f59e0b' }}>{score.costEfficiency.efficiencyScore}/100</span></span>
                        </div>
                      )}
                      {useV2 && v2Scored.has(food.id) && (() => {
                        const vs = v2Scored.get(food.id)!;
                        return (
                          <div style={{ marginTop: 4, fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>
                            <div style={{ color: '#00e68a', fontWeight: 700, marginBottom: 2 }}>🧬 v2: BB {vs.bbScore.toFixed(1)} → Overall {vs.total.toFixed(1)}</div>
                            {vs.factors.slice(0, 3).map((f, i) => (
                              <div key={i} style={{ color: f.impact > 0 ? '#22c55e' : '#ef4444' }}>{f.icon} {f.text}</div>
                            ))}
                            {vs.factors.length > 3 && <span style={{ color: 'rgba(255,255,255,0.2)' }}>+{vs.factors.length - 3} факторов</span>}
                          </div>
                        );
                      })()}
                      {food.bestFor && food.bestFor.length > 0 && (
                        <div style={{ marginTop: 4, fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>
                          🎯 Для: {food.bestFor.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {sorted.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
                {search ? 'Ничего не найдено' : 'Нет продуктов в этой категории'}
              </div>
            )}
            {sorted.length > 50 && !showAll && (
              <button onClick={() => setShowAll(true)} style={{
                padding: '8px', borderRadius: 8, fontSize: 8, border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.02)', color: '#3b82f6', cursor: 'pointer',
              }}>
                📄 Показать все ({sorted.length})
              </button>
            )}
          </div>
        </>
      )}

      {plannerTab === 'compare' && (
        <div>
          {compareIds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
              Нажмите ⚖ на продукте в каталоге, чтобы добавить в сравнение (до 3)
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6' }}>⚖️ Сравнение:</span>
                {compareIds.map(id => {
                  const f = FOOD_DB.find(x => x.id === id);
                  return (
                    <span key={id} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 8, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {f?.name || id}
                      <span onClick={() => toggleCompare(id)} style={{ cursor: 'pointer', fontWeight: 700, color: '#ef4444' }}>×</span>
                    </span>
                  );
                })}
                <button onClick={() => setCompareIds([])} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 7, border: 'none', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer' }}>Очистить</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(compareData.length, 3)}, 1fr)`, gap: 6 }}>
                {compareData.map(({ food, score }) => (
                  <div key={food.id} style={{ borderRadius: 12, padding: 10, background: `rgba(255,255,255,0.02)`, border: `1px solid ${score.color}20` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 4, textAlign: 'center' }}>{food.name}</div>
                    <div style={{ textAlign: 'center', marginBottom: 6 }}>
                      <ScoreBadge score={score.total} max={score.maxPossible} color={score.color} label={score.label} />
                    </div>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 4, textAlign: 'center' }}>
                      {food.kcal} ккал · {food.protein}г б · {food.fat}г ж · {food.carbs}г у
                    </div>
                    {enableA && <>
                      <ScoreBar label="Белок" value={score.breakdown.proteinDensity} max={30} color="#3b82f6" />
                      <ScoreBar label="Микро" value={score.breakdown.microDensity} max={30} color="#22c55e" />
                      <ScoreBar label="Клетчатка" value={score.breakdown.fiberQuality} max={20} color="#f97316" />
                      <ScoreBar label="Аминокислоты" value={score.breakdown.aminoScore} max={25} color="#ec4899" />
                      <ScoreBar label="Категория" value={score.breakdown.tierScore} max={20} color="#f59e0b" />
                    </>}
                    {enableC && score.costEfficiency && (
                      <div style={{ marginTop: 4, fontSize: 7, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                        💰 {score.costEfficiency.proteinCostRub} ₽/10г белка · <span style={{ color: score.costEfficiency.efficiencyScore >= 50 ? '#22c55e' : '#f59e0b' }}>{score.costEfficiency.efficiencyScore}/100</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {plannerTab === 'meal' && (
        <div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button onClick={() => setMealTab('compose')} style={PILL(mealTab === 'compose', '#f97316')}>🍽️ Состав приёма</button>
            <button onClick={() => setMealTab('saved')} style={PILL(mealTab === 'saved', '#a855f7')}>💾 Сохранённые ({savedMeals.length})</button>
          </div>

          {toastMsg && (
            <div style={{ marginBottom: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', fontSize: 9, color: '#00e68a', textAlign: 'center' }}>
              {toastMsg}
            </div>
          )}

          {mealTab === 'compose' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                {[
                  { key: 'plan', icon: '📋', label: 'Из плана' },
                  { key: 'recipe', icon: '📝', label: 'Из рецептов' },
                  { key: 'saved', icon: '💾', label: 'Из сохранённых' },
                  { key: 'diary', icon: '📓', label: 'Из дневника' },
                ].map(btn => (
                  <button key={btn.key} onClick={() => openSourcePicker(btn.key)} style={{
                    padding: '8px', borderRadius: 12, cursor: 'pointer', fontSize: 9, fontWeight: 600,
                    background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#fff',
                  }}>
                    {btn.icon} {btn.label}
                  </button>
                ))}
              </div>
              {sourcePicker && (
                <div style={{ marginBottom: 8, borderRadius: 10, padding: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#00e68a' }}>{sourcePicker.title}</span>
                    <span onClick={() => setSourcePicker(null)} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: 700 }}>×</span>
                  </div>
                  <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                    {sourcePicker.items.map(item => (
                      <div key={item.id} onClick={() => handlePickerSelect(item.id)} style={{
                        padding: '6px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 3,
                        background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.08)',
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: '#fff' }}>{item.name}</div>
                        {item.label && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>{item.label}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <input value={mealSearch} onChange={e => setMealSearch(e.target.value)} placeholder="🔍 Добавить продукт к приёму..." style={{
                  width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 10, background: '#202023',
                  border: '1px solid rgba(255,255,255,0.06)', color: '#fff', outline: 'none', boxSizing: 'border-box',
                }} />
              </div>
              {mealSearch && (
                <div style={{ maxHeight: 150, overflowY: 'auto', marginBottom: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                  {FOOD_DB.filter(f => (f.name || '').toLowerCase().includes(mealSearch.toLowerCase()) || f.id.includes(mealSearch)).slice(0, 8).map(food => (
                    <div key={food.id} onClick={() => {
                      const existing = mealProducts.find(p => p.foodId === food.id);
                      if (existing) {
                        setMealProducts(mealProducts.map(p => p.foodId === food.id ? { ...p, weightGrams: p.weightGrams + 100 } : p));
                      } else {
                        setMealProducts([...mealProducts, { foodId: food.id, weightGrams: 100 }]);
                      }
                      setMealSearch('');
                    }} style={{
                      padding: '6px 10px', cursor: 'pointer', fontSize: 9, color: 'rgba(255,255,255,0.8)',
                      borderBottom: '1px solid rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between',
                    }}>
                      <span>{food.name}</span>
                      <span style={{ color: 'rgba(255,255,255,0.3)' }}>{food.kcal} ккал · {food.protein}г б</span>
                    </div>
                  ))}
                </div>
              )}
              {mealProducts.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Продукты в приёме:</div>
                  {mealProducts.map((mp, idx) => {
                    const food = FOOD_DB.find(f => f.id === mp.foodId);
                    return (
                      <div key={mp.foodId} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 8,
                        background: 'rgba(255,255,255,0.02)', marginBottom: 3, fontSize: 8,
                      }}>
                        <span style={{ flex: 1, color: '#fff' }}>{food?.name || mp.foodId}</span>
                        <input type="number" value={mp.weightGrams} onChange={e => {
                          const w = parseInt(e.target.value) || 0;
                          const updated = [...mealProducts];
                          updated[idx] = { ...mp, weightGrams: w };
                          setMealProducts(updated);
                        }} style={{
                          width: 50, padding: '3px 5px', borderRadius: 5, fontSize: 8, background: '#202023',
                          border: '1px solid rgba(255,255,255,0.06)', color: '#fff', outline: 'none', textAlign: 'center',
                        }} />
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>г</span>
                        <span style={{ color: '#22c55e', minWidth: 30, textAlign: 'right' }}>
                          {food ? Math.round((food.protein || 0) * mp.weightGrams / 100) : 0}г
                        </span>
                        <span onClick={() => setMealProducts(mealProducts.filter((_, i) => i !== idx))} style={{
                          cursor: 'pointer', color: '#ef4444', fontWeight: 700, fontSize: 10, padding: '0 4px',
                        }}>×</span>
                      </div>
                    );
                  })}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px',
                    marginTop: 4, borderRadius: 8, background: 'rgba(255,255,255,0.03)', fontSize: 8, color: 'rgba(255,255,255,0.5)',
                  }}>
                    <span>∑ {mealProducts.reduce((s, mp) => {
                      const f = FOOD_DB.find(x => x.id === mp.foodId);
                      return s + ((f?.kcal || 0) * mp.weightGrams / 100);
                    }, 0).toFixed(0)} ккал</span>
                    <span>🥩 {mealProducts.reduce((s, mp) => {
                      const f = FOOD_DB.find(x => x.id === mp.foodId);
                      return s + ((f?.protein || 0) * mp.weightGrams / 100);
                    }, 0).toFixed(1)}г</span>
                    <span>🧈 {mealProducts.reduce((s, mp) => {
                      const f = FOOD_DB.find(x => x.id === mp.foodId);
                      return s + ((f?.fat || 0) * mp.weightGrams / 100);
                    }, 0).toFixed(1)}г</span>
                    <span>🍚 {mealProducts.reduce((s, mp) => {
                      const f = FOOD_DB.find(x => x.id === mp.foodId);
                      return s + ((f?.carbs || 0) * mp.weightGrams / 100);
                    }, 0).toFixed(1)}г</span>
                    <span>⚖️ {mealProducts.reduce((s, mp) => s + mp.weightGrams, 0).toFixed(0)}г</span>
                  </div>
                </div>
              )}
              {mealProducts.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  <button onClick={() => {
                    const result = calcMealScore(mealProducts, opts);
                    setMealResult(result);
                  }} style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 9, border: 'none',
                    background: 'linear-gradient(135deg, #f97316, #ef4444)', color: '#fff', cursor: 'pointer', fontWeight: 700,
                  }}>
                    🧮 Рассчитать полезность
                  </button>
                  <button onClick={() => setMealProducts([])} style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 8, border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                  }}>Очистить</button>
                  {mealResult && (
                    <button onClick={() => {
                      const name = mealName.trim() || `Приём от ${new Date().toLocaleDateString('ru-RU')}`;
                      const meal: SavedMeal = {
                        id: Date.now().toString(36),
                        name,
                        products: mealProducts,
                        createdAt: new Date().toISOString(),
                      };
                      const updated = [...savedMeals, meal];
                      setSavedMeals(updated);
                      localStorage.setItem('he_saved_meals', JSON.stringify(updated));
                      setMealName('');
                    }} style={{
                      padding: '7px 14px', borderRadius: 8, fontSize: 8, border: '1px solid rgba(168,85,247,0.2)',
                      background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer',
                    }}>💾 Сохранить приём</button>
                  )}
                </div>
              )}
              {mealResult && (
                <div style={{ borderRadius: 12, padding: 12, background: `${mealResult.color}06`, border: `1px solid ${mealResult.color}20`, marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: mealResult.color }}>🍽️ Композитный скор</div>
                      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>средневзвешенный по граммовке</div>
                    </div>
                    <ScoreBadge score={mealResult.compositeScore} max={mealResult.maxPossible} color={mealResult.color} label={mealResult.label} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
                    {[
                      ['🔥', 'Калории', `${mealResult.totalKcal} ккал`],
                      ['🥩', 'Белок', `${mealResult.totalProtein}г`],
                      ['🧈', 'Жиры', `${mealResult.totalFat}г`],
                      ['🍚', 'Углеводы', `${mealResult.totalCarbs}г`],
                      ['🌾', 'Клетчатка', `${mealResult.totalFiber}г`],
                      ['⚖️', 'Вес', `${mealResult.totalWeight}г`],
                      ['📊', 'Ккал/г', `${mealResult.kcalPerGram}`],
                    ].map(([icon, label, val]) => (
                      <div key={label} style={{ padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)' }}>{icon} {label}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: label === 'Белок' ? '#22c55e' : label === 'Жиры' ? '#f59e0b' : label === 'Углеводы' ? '#3b82f6' : '#fff' }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>БЖУ %</div>
                    <div style={{ display: 'flex', gap: 4, height: 6, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ flex: mealResult.pfcRatio.proteinPct, background: '#22c55e' }} />
                      <div style={{ flex: mealResult.pfcRatio.fatPct, background: '#f59e0b' }} />
                      <div style={{ flex: mealResult.pfcRatio.carbsPct, background: '#3b82f6' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 6, color: 'rgba(255,255,255,0.3)' }}>
                      <span>🥩 {mealResult.pfcRatio.proteinPct}%</span>
                      <span>🧈 {mealResult.pfcRatio.fatPct}%</span>
                      <span>🍚 {mealResult.pfcRatio.carbsPct}%</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 8, color: mealResult.color, fontWeight: 600, marginBottom: 4 }}>📊 Продукты</div>
                  {mealResult.productScores.map(ps => (
                    <div key={ps.foodId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 7, fontWeight: 800, border: `2px solid ${ps.score >= 55 ? '#22c55e' : ps.score >= 40 ? '#f59e0b' : '#ef4444'}`,
                        color: ps.score >= 55 ? '#22c55e' : ps.score >= 40 ? '#f59e0b' : '#ef4444',
                      }}>{ps.score}</div>
                      <span style={{ flex: 1, fontSize: 8, color: '#fff' }}>{ps.name}</span>
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>{ps.weight}г</span>
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>вклад {ps.contribution}%</span>
                    </div>
                  ))}
                  {mealResult.weakLink && (
                    <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)' }}>
                      <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 600 }}>⚠️ Слабый продукт: {mealResult.weakLink.name}</div>
                      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>{mealResult.weakLink.reason}</div>
                    </div>
                  )}
                  {mealResult.microCoverage.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Микронутриенты (% от суточной нормы)</div>
                      {mealResult.microCoverage.slice(0, 10).map(m => (
                        <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', minWidth: 24 }}>{m.name}</span>
                          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, m.percent)}%`, height: '100%',
                              background: m.percent >= 50 ? '#22c55e' : m.percent >= 20 ? '#f59e0b' : '#ef4444',
                              borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', minWidth: 30, textAlign: 'right' }}>
                            {m.percent}% · {m.current}{m.key.startsWith('Vit') ? 'мкг' : 'мг'}
                          </span>
                        </div>
                      ))}
                      {mealResult.microCoverage.length > 10 && (
                        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>
                          + ещё {mealResult.microCoverage.length - 10}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {mealTab === 'saved' && (
            <div>
              {savedMeals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
                  Нет сохранённых приёмов. Соберите приём на вкладке «Состав» и нажмите 💾
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[...savedMeals].reverse().map(meal => (
                    <div key={meal.id} style={{
                      borderRadius: 12, padding: 10, background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{meal.name}</span>
                        <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>
                          {new Date(meal.createdAt).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                        {meal.products.map(p => {
                          const f = FOOD_DB.find(x => x.id === p.foodId);
                          return `${f?.name || p.foodId} (${p.weightGrams}г)`;
                        }).join(', ')}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => {
                          setMealProducts(meal.products);
                          setPlannerTab('meal');
                          setMealTab('compose');
                        }} style={{
                          padding: '4px 8px', borderRadius: 6, fontSize: 7, border: '1px solid rgba(59,130,246,0.2)',
                          background: 'rgba(59,130,246,0.08)', color: '#60a5fa', cursor: 'pointer',
                        }}>📂 Загрузить</button>
                        <button onClick={() => {
                          const updated = savedMeals.filter(m => m.id !== meal.id);
                          setSavedMeals(updated);
                          localStorage.setItem('he_saved_meals', JSON.stringify(updated));
                        }} style={{
                          padding: '4px 8px', borderRadius: 6, fontSize: 7, border: '1px solid rgba(239,68,68,0.2)',
                          background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer',
                        }}>🗑️ Удалить</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

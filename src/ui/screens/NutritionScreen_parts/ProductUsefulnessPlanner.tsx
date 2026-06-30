import React, { useState, useMemo } from 'react';
import { FOOD_DB, calcBBQualityScore } from '../../../core/nutrition-database';
import { useDataLink } from '../../../core/data-link';
import { scoreAllProducts, compareProducts, calcMealScore, CATEGORY_LABELS, GOAL_MAP_RU } from '../../../engines/product-usefulness.engine';
import type { MealProduct, SavedMeal, MealScore } from '../../../engines/product-usefulness.engine';
import { calculateOverallScore, scoreAllProductsV2, compareProductsV2, calcMealScoreV2, calcDIAAS, analyzeDailyDiet, getDefaultProfile, type UserDietProfile, type V2ScoreResult } from '../../../engines/product-usefulness-v2.engine';
import { PopupBool, PopupNumber, PopupSelect } from '../../components/PopupXxx';

type PlannerTab = 'dashboard' | 'settings' | 'catalog' | 'compare' | 'meal' | 'swap';
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
      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.9)' }}>из {max}</div>
    </div>
  </div>
);

const ScoreBar: React.FC<{ label: string; value: number; max: number; color: string }> = ({ label, value, max, color }) => {
  const pct = Math.min(100, Math.round(value / max * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.8)', minWidth: 50 }}>{label}</span>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)', minWidth: 20, textAlign: 'right' }}>{value}</span>
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
  const [swapFrom, setSwapFrom] = useState('');
  const [swapResults, setSwapResults] = useState<{ food: any; score: any; improvement: number }[]>([]);
  const [mealTiming, setMealTiming] = useState<'any' | 'pre' | 'post'>('any');
  const [scoreHistory, setScoreHistory] = useState<{ date: string; avg: number; count: number }[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_usefulness_history') || '[]'); } catch { return []; }
  });

  const [useV2, setUseV2] = useState(true);
  const [v2Profile, setV2Profile] = useState<UserDietProfile>(getDefaultProfile());

  const opts = useMemo(() => ({
    goal: manualGoal || profileGoal,
    weightKg: parseInt(manualWeight) || profileWeight,
    workoutsPerWeek: parseInt(manualWorkouts) || profileWorkouts,
    hasAAS: manualAAS,
    hasInsulin: manualInsulin,
    pricePerKg: manualPrice ? parseInt(manualPrice) : undefined,
    enableA, enableB, enableC,
  }), [manualGoal, profileGoal, manualWeight, profileWeight, manualWorkouts, profileWorkouts, manualAAS, manualInsulin, manualPrice, enableA, enableB, enableC]);

  const scored = useMemo(() => {
    return scoreAllProducts({ ...opts, category: category === 'all' ? undefined : category });
  }, [opts, category]);

  const fillFromProfile = () => {
    setManualGoal(profileGoal || '');
    setManualWeight(profileWeight.toString());
    setManualWorkouts(profileWorkouts.toString());
    setManualAAS(profileAAS);
    setManualInsulin(false);
    setManualPrice('');
  };

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 2000); };

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
      case 'score':
        if (useV2) {
          arr.sort((a, b) => (v2Scored.get(b.food.id)?.total ?? 0) - (v2Scored.get(a.food.id)?.total ?? 0));
        } else {
          arr.sort((a, b) => b.score.total - a.score.total);
        }
        break;
      case 'name': arr.sort((a, b) => a.food.name.localeCompare(b.food.name)); break;
      case 'protein': arr.sort((a, b) => (b.food.protein || 0) - (a.food.protein || 0)); break;
      case 'kcal': arr.sort((a, b) => (a.food.kcal || 0) - (b.food.kcal || 0)); break;
    }
    return arr;
  }, [filtered, sortKey, useV2, v2Scored]);

  const displayed = useMemo(() => showAll ? sorted : sorted.slice(0, 50), [sorted, showAll]);

  React.useEffect(() => {
    if (plannerTab === 'dashboard') {
      const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, x) => s + x.score.total, 0) / scored.length) : 0;
      if (avgScore > 0) {
        const today = new Date().toLocaleDateString('ru-RU');
        const updated = [...scoreHistory.filter(h => h.date !== today), { date: today, avg: avgScore, count: scored.length }].slice(-30);
        setScoreHistory(updated);
        localStorage.setItem('he_usefulness_history', JSON.stringify(updated));
      }
    }
  }, [plannerTab, scored]);

  const compareData = useMemo(() => {
    if (compareIds.length < 2) return [];
    return useV2 ? compareProductsV2(compareIds, v2Profile) : compareProducts(compareIds, opts);
  }, [compareIds, opts, useV2, v2Profile]);

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
        showToast(`✅ Добавлено ${items.length} продуктов иИз плана`);
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
        showToast(`✅ Добавлено ${entries.length} продуктов иИз дневника`);
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
        <button onClick={() => setPlannerTab('dashboard')} style={PILL(plannerTab === 'dashboard', '#00e68a')}>📊 Дашборд</button>
        <button onClick={() => setPlannerTab('settings')} style={PILL(plannerTab === 'settings', '#f59e0b')}>⚙️</button>
        <button onClick={() => setPlannerTab('catalog')} style={PILL(plannerTab === 'catalog', '#3b82f6')}>📦 {filtered.length > 0 && `(${filtered.length})`}</button>
        <button onClick={() => setPlannerTab('compare')} style={PILL(plannerTab === 'compare', '#8b5cf6')}>⚖️ {compareIds.length > 0 && `(${compareIds.length})`}</button>
        <button onClick={() => setPlannerTab('meal')} style={PILL(plannerTab === 'meal', '#f97316')}>🍽️ Приём</button>
        <button onClick={() => setPlannerTab('swap')} style={PILL(plannerTab === 'swap', '#ec4899')}>🔄 Замена</button>
      </div>

      {plannerTab === 'dashboard' && (() => {
        const sorted = [...scored].sort((a, b) => b.score.total - a.score.total);
        const top5 = sorted.slice(0, 5);
        const worst5 = sorted.slice(-5).reverse();
        const catAvg: Record<string, { total: number; count: number }> = {};
        scored.forEach(({ food, score }) => {
          const cat = CATEGORY_LABELS[food.category] || food.category;
          if (!catAvg[cat]) catAvg[cat] = { total: 0, count: 0 };
          catAvg[cat].total += score.total; catAvg[cat].count++;
        });
        const avgByCat = Object.entries(catAvg).map(([cat, d]) => ({ cat, avg: Math.round(d.total / d.count), count: d.count }));
        avgByCat.sort((a, b) => b.avg - a.avg);
        const phaseRecs: Record<string, { title: string; tips: string[] }> = {
          mass: { title: '🏋️ Набор массы', tips: ['Высокий белок (≥20г/100г)','Высокая калорийная плотность','Быстрые углеводы вокруг тренировки','Красное мясо, яйца, рис, картофель','Молочные продукты для доп. калорий'] },
          cut: { title: '🔥 Сушка', tips: ['Низкая калорийная плотность','Высокий белок (≥25г/100г)','Много клетчатки (≥3г/100г)','Овощи, куриная грудка, рыба','Минимум насыщенных жиров'] },
          strength: { title: '💪 Сила', tips: ['Белок 2.0-2.5 г/кг','Углеводы для энергии','Креатин-богатые продукты','Калий для нервно-мышечной','Достаточно калорий для восстановления'] },
          maintenance: { title: '⚖️ Поддержка', tips: ['Сбалансированные макросы','Разнообразие продуктов','Контроль порций','Минимум переработанного','Омега-3 ежедневно'] },
        };
        const goal = manualGoal || profileGoal || 'maintenance';
        const rec = phaseRecs[goal] || phaseRecs.maintenance;
        const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, x) => s + x.score.total, 0) / scored.length) : 0;

        return <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ borderRadius:12, padding:14, background:'rgba(0,230,138,0.05)', border:'1px solid rgba(0,230,138,0.1)', textAlign:'center' }}>
            <div style={{ fontSize:28, fontWeight:800, color:'#00e68a' }}>{avgScore}</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.9)' }}>средний скор по {scored.length} продуктам</div>
            <div style={{ marginTop:8, display:'flex', justifyContent:'center', gap:12 }}>
              <div style={{ textAlign:'center' }}><div style={{ fontSize:18, fontWeight:800, color:'#22c55e' }}>{top5.length}</div><div style={{ fontSize:7, color:'rgba(255,255,255,0.5)' }}>топ-5</div></div>
              <div style={{ textAlign:'center' }}><div style={{ fontSize:18, fontWeight:800, color:'#ef4444' }}>{worst5.length}</div><div style={{ fontSize:7, color:'rgba(255,255,255,0.5)' }}>худшие-5</div></div>
              <div style={{ textAlign:'center' }}><div style={{ fontSize:18, fontWeight:800, color:'#8b5cf6' }}>{Object.keys(catAvg).length}</div><div style={{ fontSize:7, color:'rgba(255,255,255,0.5)' }}>категорий</div></div>
            </div>
            {scoreHistory.length > 1 && (
              <div style={{ marginTop:10, padding:'8px 10px', borderRadius:8, background:'rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)', marginBottom:4 }}>📈 Тренд качества</div>
                <div style={{ display:'flex', gap:2, alignItems:'flex-end', justifyContent:'center', height:30 }}>
                  {scoreHistory.slice(-10).map((h, i) => {
                    const maxH = Math.max(...scoreHistory.map(x => x.avg), 1);
                    const hPct = Math.round(h.avg / maxH * 100);
                    return <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
                      <div style={{ width:'80%', height:Math.max(2,Math.round(hPct/100*25)), borderRadius:2, background:h.avg>=7?'#22c55e':h.avg>=5?'#f59e0b':'#ef4444' }} />
                      <div style={{ fontSize:5, color:'rgba(255,255,255,0.3)', marginTop:1 }}>{h.avg}</div>
                    </div>;
                  })}
                </div>
                <div style={{ fontSize:6, color:'rgba(255,255,255,0.3)', marginTop:2 }}>
                  {scoreHistory[0]?.date} — {scoreHistory[scoreHistory.length-1]?.date}
                  {scoreHistory.length>=2&&<span style={{marginLeft:4,color:scoreHistory[scoreHistory.length-1].avg>=scoreHistory[0].avg?'#22c55e':'#ef4444'}}>
                    {scoreHistory[scoreHistory.length-1].avg>=scoreHistory[0].avg?'↑':'↓'} {Math.abs(scoreHistory[scoreHistory.length-1].avg-scoreHistory[0].avg)} пунктов
                  </span>}
                </div>
              </div>
            )}
          </div>

          <div style={{ borderRadius:12, padding:12, background:'rgba(34,197,94,0.05)', border:'1px solid rgba(34,197,94,0.1)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:8 }}>🏆 Топ-5 продуктов</div>
            {top5.map(({ food, score }) => (
              <div key={food.id} style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 8px',borderRadius:8,marginBottom:3,background:'rgba(34,197,94,0.04)',border:'1px solid rgba(34,197,94,0.08)' }}>
                <div style={{ width:28,height:28,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:'#22c55e20',fontSize:13,fontWeight:800,color:'#22c55e',flexShrink:0 }}>{score.total}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:9,fontWeight:600,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{food.name}</div>
                  <div style={{ fontSize:7,color:'rgba(255,255,255,0.9)' }}>{food.kcal}ккал · Б{food.protein} Ж{food.fat} У{food.carbs}</div>
                </div>
                <span style={{ fontSize:7,color:'#22c55e',fontWeight:700 }}>{score.label}</span>
              </div>
            ))}
          </div>

          <div style={{ borderRadius:12, padding:12, background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.1)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:8 }}>⚠️ Требуют улучшения</div>
            {worst5.map(({ food, score }) => (
              <div key={food.id} style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 8px',borderRadius:8,marginBottom:3,background:'rgba(239,68,68,0.04)',border:'1px solid rgba(239,68,68,0.08)' }}>
                <div style={{ width:28,height:28,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:'#ef444420',fontSize:13,fontWeight:800,color:'#ef4444',flexShrink:0 }}>{score.total}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:9,fontWeight:600,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{food.name}</div>
                  <div style={{ fontSize:7,color:'rgba(255,255,255,0.9)' }}>{food.kcal}ккал · Б{food.protein} Ж{food.fat} У{food.carbs}</div>
                </div>
                <span style={{ fontSize:7,color:'#ef4444',fontWeight:700 }}>{score.label}</span>
              </div>
            ))}
          </div>

          <div style={{ borderRadius:12, padding:12, background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.1)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#8b5cf6', marginBottom:8 }}>📊 Средний скор по категориям</div>
            {avgByCat.map(({ cat, avg, count }) => (
              <div key={cat} style={{ display:'flex',alignItems:'center',gap:6,marginBottom:4 }}>
                <span style={{ fontSize:8,color:'rgba(255,255,255,0.8)',minWidth:80 }}>{cat}</span>
                <div style={{ flex:1,height:5,borderRadius:3,background:'rgba(255,255,255,0.06)',overflow:'hidden' }}>
                  <div style={{ width:`${Math.min(100,avg*10)}%`,height:'100%',borderRadius:3,background:avg>=7?'#22c55e':avg>=5?'#f59e0b':'#ef4444',transition:'width 0.3s' }}/>
                </div>
                <span style={{ fontSize:8,fontWeight:700,color:avg>=7?'#22c55e':avg>=5?'#f59e0b':'#ef4444',minWidth:24,textAlign:'right' }}>{avg}</span>
                <span style={{ fontSize:6,color:'rgba(255,255,255,0.4)',minWidth:16 }}>({count})</span>
              </div>
            ))}
          </div>

          <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.05)', border:'1px solid rgba(245,158,11,0.1)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>{rec.title}</div>
            {rec.tips.map((tip, i) => (
              <div key={i} style={{ fontSize:8, color:'rgba(255,255,255,0.85)', padding:'3px 0', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                • {tip}
              </div>
            ))}
            <div style={{ marginTop:6, fontSize:7, color:'rgba(255,255,255,0.5)', lineHeight:1.4 }}>
              💡 Используйте фильтры в каталоге и сортировку по скору, чтобы найти лучшие продукты под вашу цель.
              Включите модули A (нутриенты), B (контекст) и C (цена) для полной оценки.
            </div>
          </div>
        </div>;
      })()}

      {plannerTab === 'settings' && (
        <div style={{ borderRadius: 12, padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>⚙️ Параметры расчёта</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <PopupSelect label="🎯 Цель" value={manualGoal} options={[{id:'',label:`Авто (${profileGoal?GOAL_MAP_RU[profileGoal]||profileGoal:'не указана'})`},...Object.entries(GOAL_MAP_RU).map(([k,v])=>({id:k,label:v}))]} onChange={setManualGoal} />
            <PopupNumber label="⚖️ Вес (кг)" value={parseInt(manualWeight)||0} min={40} max={200} suffix="кг" onChange={v=>setManualWeight(String(v))} />
            <PopupNumber label="🏋️ Тренировок/нед" value={parseInt(manualWorkouts)||0} min={0} max={14} suffix="раз" onChange={v=>setManualWorkouts(String(v))} />
            <PopupNumber label="💰 Цена за кг (₽)" value={manualPrice?parseInt(manualPrice):0} min={0} max={5000} step={50} suffix="₽" onChange={v=>setManualPrice(v?String(v):'')} />
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.9)', marginBottom: 4, lineHeight: 1.3 }}>
            🧬 <b>ААС</b> — штраф −4.5 продуктам с атерогенными жирами.&nbsp;
            💉 <b>Инсулин</b> — штраф продуктам с высоким ГИ/ИИ.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 60px', gap: 6, marginBottom: 8 }}>
            <PopupBool label={manualAAS?'💉 ААС активен':'💉 ААС выключен'} value={manualAAS} onChange={setManualAAS} />
            <PopupBool label={manualInsulin?'💉 Инсулин активен':'💉 Инсулин выключен'} value={manualInsulin} onChange={setManualInsulin} />
            <button onClick={fillFromProfile} style={{ padding:'8px 6px', borderRadius:10, cursor:'pointer', background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.15)', color:'#00e68a', fontWeight:600, fontSize:8 }}>📋 Авто</button>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 8, marginTop: 4 }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>Модули оценки:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 6 }}>
              <PopupBool label={`${enableA?'✓':'○'} ${MODULE_LABELS.A.label}`} value={enableA} onChange={v=>{setEnableA(v);setShowAll(false)}} />
              <PopupBool label={`${enableB?'✓':'○'} ${MODULE_LABELS.B.label}`} value={enableB} onChange={v=>{setEnableB(v);setShowAll(false)}} />
              <PopupBool label={`${enableC?'✓':'○'} ${MODULE_LABELS.C.label}`} value={enableC} onChange={v=>{setEnableC(v);setShowAll(false)}} />
            </div>
            {modulesDesc.length > 0 && (
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', lineHeight: 1.4 }}>
                Активны: {modulesDesc.join(' · ')}
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid rgba(0,230,138,0.1)', paddingTop: 6, marginTop: 6 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:4 }}>
              <PopupBool label={useV2?'🧬 v2 Скоринг ✅ Включён':'🧬 v2 Скоринг ○ Выключен'} value={useV2} onChange={setUseV2} />
              {useV2 && (
                <PopupSelect label="📋 Фаза" value={v2Profile.phase} options={[
                  {id:'LEAN_MASS',label:'💪 Набор'},{id:'EXTREME_CUT',label:'🔥 Сушка'},{id:'PEAK_WEEK',label:'⚡ Пик'},{id:'POST_CYCLE',label:'🔄 ПКТ'},{id:'MOST',label:'🌉 Мост'}
                ]} onChange={v=>setV2Profile(prev=>({...prev,phase:v as any}))} />
              )}
            </div>
            {useV2 && (
              <div style={{ marginTop:4 }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.75)', marginBottom:2 }}>💊 Фармакология</div>
                <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                  {[
                    { id:'AAS_ORAL', label:'Орал.ААС', color:'#ef4444' },
                    { id:'AAS_INJECTABLE', label:'Инъекц.ААС', color:'#ef4444' },
                    { id:'HGH', label:'HGH', color:'#8b5cf6' },
                    { id:'DIURETICS', label:'Диуретики', color:'#f59e0b' },
                    { id:'STIMULATORS', label:'Стимуляторы', color:'#f97316' },
                    { id:'INSULIN_USE', label:'Инсулин', color:'#8b5cf6' },
                    { id:'LIVER_SUPPORT', label:'Гепато', color:'#22c55e' },
                    { id:'GUT_SUPPORT', label:'ЖКТ', color:'#22c55e' },
                  ].map(p => (
                    <button key={p.id} onClick={() => setV2Profile(prev => ({ ...prev, pharma: { ...prev.pharma, [p.id]: !prev.pharma[p.id as keyof typeof prev.pharma] } }))} style={{
                      padding:'2px 6px', borderRadius:6, fontSize:6, fontWeight:600, cursor:'pointer',
                      background: v2Profile.pharma[p.id as keyof typeof v2Profile.pharma] ? `${p.color}15` : '#202023',
                      border: v2Profile.pharma[p.id as keyof typeof v2Profile.pharma] ? `1px solid ${p.color}30` : '1px solid rgba(255,255,255,0.04)',
                      color: v2Profile.pharma[p.id as keyof typeof v2Profile.pharma] ? p.color : 'rgba(255,255,255,0.75)',
                    }}>{p.label}</button>
                  ))}
                </div>
              </div>
            )}
            {useV2 && (
              <div style={{ marginTop:4 }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.75)', marginBottom:2 }}>🩸 Анализы</div>
                <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                  {['HCT','LDL','HDL','ALT','AST','CRP'].map(lab => (
                    <div key={lab} style={{ display:'flex', alignItems:'center', gap:2 }}>
                      <span style={{ fontSize:6, color:'rgba(255,255,255,0.75)' }}>{lab}</span>
                      <input type="number" value={(v2Profile.labs as any)[lab.toLowerCase()] ?? ''} onChange={e => setV2Profile(prev => ({ ...prev, labs: { ...prev.labs, [lab.toLowerCase()]: e.target.value ? parseFloat(e.target.value) : undefined } }))} placeholder="—" style={{ width:36, padding:'2px 4px', borderRadius:4, fontSize:6, background:'#202023', border:'1px solid rgba(255,255,255,0.04)', color:'#fff', outline:'none' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {useV2 && (
            <div style={{ borderTop:'1px solid rgba(255,255,255,0.04)', paddingTop:8, marginTop:8 }}>
              <div style={{ fontSize:9, fontWeight:700, color:'#8b5cf6', marginBottom:6 }}>🧬 Как считается скор (v2)</div>
              <div style={{ display:'flex',flexDirection:'column',gap:4 }}>
                {[
                  { label:'🥩 Белок/калории', desc:'Белок (г) × 4 / ккал. Идеал >0.35. Базовый фактор качества.', max:'40%' },
                  { label:'🧬 Аминокислоты', desc:'Лейцин (мг/100г) + EAA баланс. Критично для mTOR.', max:'15%' },
                  { label:'🌾 Клетчатка', desc:'г/100г. Сытость, микробиом, гликемический контроль.', max:'10%' },
                  { label:'📊 ГИ/ИИ', desc:'Гликемический и инсулиновый индекс. Ниже = лучше (кроме pre-workout).', max:'10%' },
                  { label:'🧈 Жиры', desc:'Насыщенные vs омега-3. Штраф при ААС/курсе.', max:'10%' },
                  { label:'⚡ Микронутриенты', desc:'Плотность витаминов и минералов на 100 ккал.', max:'15%' },
                ].map((f,i) => (
                  <div key={i} style={{ display:'flex',alignItems:'center',gap:6,padding:'4px 6px',borderRadius:6,background:'rgba(255,255,255,0.02)' }}>
                    <span style={{ fontSize:7,color:'rgba(255,255,255,0.8)',minWidth:80 }}>{f.label}</span>
                    <span style={{ fontSize:6,color:'rgba(255,255,255,0.5)',flex:1 }}>{f.desc}</span>
                    <span style={{ fontSize:7,fontWeight:700,color:'#8b5cf6' }}>{f.max}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:6,fontSize:7,color:'rgba(255,255,255,0.5)',lineHeight:1.4 }}>
                Финальный скор = средневзвешенная сумма модулей с поправками: контекст (фаза ×0.15, фарма ×0.15, анализы ×0.10), цена (белок/₽ ×0.10). Итог: 0-100.
              </div>
            </div>
          )}
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
                  color: 'rgba(255,255,255,0.9)', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                }}>✕</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 8 }}>
            <button key="all" onClick={() => { setCategory('all'); setShowAll(false); }} style={PILL(category === 'all', '#3b82f6')}>Все</button>
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
                <span style={{ fontSize: 6, padding: '2px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.9)' }}>
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
              const vs = useV2 ? v2Scored.get(food.id) : null;
              const displayScore = vs || score;
              const dsTotal = vs ? vs.total : score.total;
              const dsColor = vs ? vs.color : score.color;
              const dsLabel = vs ? vs.label : score.label;
              return (
                <div key={food.id} style={{
                  borderRadius: 12, padding: 10, background: exp ? `${dsColor}06` : 'rgba(255,255,255,0.02)',
                  border: exp ? `1px solid ${dsColor}20` : '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                    <div onClick={() => setExpandedId(exp ? null : food.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      {vs ? (
                        <div style={{
                          width: 40, height: 40, borderRadius: 10, display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          background: `${dsColor}18`, border: `1px solid ${dsColor}30`,
                        }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: dsColor, lineHeight: 1 }}>{dsTotal.toFixed(1)}</span>
                          <span style={{ fontSize: 5, color: dsColor + 'aa', lineHeight: 1 }}>v2</span>
                        </div>
                      ) : (
                        <ScoreBadge score={score.total} max={score.maxPossible} color={score.color} label={score.label} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{food.name}</div>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.9)', marginTop: 1 }}>
                          {CATEGORY_LABELS[food.category] || food.category}
                          {food.tier && <span style={{ marginLeft: 4 }}>· {food.tier === 'max' ? '🔸' : food.tier === 'mid' ? '🔹' : '⚪'} {food.tier}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ textAlign: 'right', marginRight: 4 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#22c55e' }}>{food.protein}г</div>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.9)' }}>{food.kcal} ккал</div>
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
                      {vs ? (
  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)' }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, marginBottom: 4 }}>
      <div style={{ padding: '3px 6px', borderRadius: 6, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.08)' }}>
        <span style={{ color: '#8b5cf6' }}>BB Score</span>
        <span style={{ float: 'right', fontWeight: 700, color: '#00e68a' }}>{vs.bbScore.toFixed(1)}</span>
      </div>
      <div style={{ padding: '3px 6px', borderRadius: 6, background: vs.phaseMod !== 0 ? 'rgba(249,115,22,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${vs.phaseMod < 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)'}` }}>
        <span style={{ color: '#8b5cf6' }}>Фаза</span>
        <span style={{ float: 'right', fontWeight: 700, color: vs.phaseMod < 0 ? '#ef4444' : '#22c55e' }}>{vs.phaseMod > 0 ? '+' : ''}{vs.phaseMod.toFixed(1)}</span>
      </div>
      <div style={{ padding: '3px 6px', borderRadius: 6, background: vs.pharmaMod !== 0 ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${vs.pharmaMod < 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)'}` }}>
        <span style={{ color: '#8b5cf6' }}>Фарма</span>
        <span style={{ float: 'right', fontWeight: 700, color: vs.pharmaMod < 0 ? '#ef4444' : '#22c55e' }}>{vs.pharmaMod > 0 ? '+' : ''}{vs.pharmaMod.toFixed(1)}</span>
      </div>
      <div style={{ padding: '3px 6px', borderRadius: 6, background: vs.labMod !== 0 ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${vs.labMod < 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)'}` }}>
        <span style={{ color: '#8b5cf6' }}>Анализы</span>
        <span style={{ float: 'right', fontWeight: 700, color: vs.labMod < 0 ? '#ef4444' : '#22c55e' }}>{vs.labMod > 0 ? '+' : ''}{vs.labMod.toFixed(1)}</span>
      </div>
      {vs.timingMod !== 0 && (
        <div style={{ padding: '3px 6px', borderRadius: 6, background: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.1)' }}>
          <span style={{ color: '#8b5cf6' }}>Тайминг</span>
          <span style={{ float: 'right', fontWeight: 700, color: vs.timingMod < 0 ? '#ef4444' : '#22c55e' }}>{vs.timingMod > 0 ? '+' : ''}{vs.timingMod.toFixed(1)}</span>
        </div>
      )}
    </div>
    {vs.factors.length > 0 ? (
      <div>
        <div style={{ fontSize: 7, fontWeight: 600, color: '#00e68a', marginBottom: 2 }}>🧬 Почему такой рейтинг:</div>
        {vs.factors.map((f, i) => (
          <div key={i} style={{ padding: '2px 6px', marginBottom: 1, borderRadius: 4, background: f.impact > 0 ? 'rgba(0,230,138,0.04)' : 'rgba(239,68,68,0.04)', border: `1px solid ${f.impact > 0 ? 'rgba(0,230,138,0.08)' : 'rgba(239,68,68,0.08)'}`, fontSize: 7, color: f.impact > 0 ? '#22c55e' : '#ef4444', lineHeight: 1.4 }}>
            {f.icon} {f.text} <b>({f.impact > 0 ? '+' : ''}{f.impact.toFixed(1)})</b>
          </div>
        ))}
      </div>
    ) : (
      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.9)' }}>Нет дополнительных факторов</div>
    )}
    {(() => {
      const diaas = calcDIAAS(food);
      return diaas.diaas > 0 ? (
        <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:7, marginTop:2, padding:'2px 6px', borderRadius:4, background: diaas.diaas >= 1 ? 'rgba(0,230,138,0.04)' : diaas.diaas >= 0.75 ? 'rgba(245,158,11,0.04)' : 'rgba(239,68,68,0.04)', border:`1px solid ${diaas.diaas >= 1 ? 'rgba(0,230,138,0.15)' : diaas.diaas >= 0.75 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
          <span style={{ color: '#8b5cf6', fontWeight:600 }}>💪 DIAAS</span>
          <span style={{ fontWeight:700, color: diaas.diaas >= 1 ? '#22c55e' : diaas.diaas >= 0.75 ? '#f59e0b' : '#ef4444' }}>{diaas.diaas.toFixed(2)}</span>
          <span style={{ color:'rgba(255,255,255,0.75)' }}>• лимит: {diaas.limitingAA}</span>
        </div>
      ) : null;
    })()}
    <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>Настройте фазу и фармакологию в ⚙️ Параметры → вкладка v2</div>
  </div>
) : (
<><div style={{ fontSize: 8, color: score.color, fontWeight: 600, marginBottom: 4 }}>📊 Разбивка скора</div>
  {enableA && <>
  <ScoreBar label="Белок" value={score.breakdown.proteinDensity} max={30} color="#3b82f6" />
  <ScoreBar label="Микро" value={score.breakdown.microDensity} max={30} color="#22c55e" />
  <ScoreBar label="Клетчатка" value={score.breakdown.fiberQuality} max={20} color="#f97316" />
  <ScoreBar label="Аминокислоты" value={score.breakdown.aminoScore} max={25} color="#ec4899" />
  <ScoreBar label="Категория" value={score.breakdown.tierScore} max={20} color="#f59e0b" /></>}
  {enableB && <div style={{ marginTop: 4, fontSize: 8, color: 'rgba(255,255,255,0.65)' }}>
    {score.contextBonus.goalMatch > 0 && <span style={{ color: '#22c55e' }}>✓ Цель совпадает </span>}
    {score.contextBonus.timingMatch > 0 && <span style={{ color: '#60a5fa' }}>✓ Время подходит </span>}
    {score.contextBonus.pharmaMatch > 0 && <span style={{ color: '#8b5cf6' }}>✓ Фарма-синергия </span>}
    {score.contextBonus.pharmaMatch < 0 && <span style={{ color: '#ef4444' }}>⚠️ Фарма-конфликт </span>}
    {(score.contextBonus.goalMatch === 0 && score.contextBonus.timingMatch === 0 && score.contextBonus.pharmaMatch === 0) && (<span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>)}
  </div>}
  {enableC && score.costEfficiency && (
    <div style={{ marginTop: 4, fontSize: 8, color: 'rgba(255,255,255,0.65)', display: 'flex', gap: 8 }}>
      <span>💰 {score.costEfficiency.proteinCostRub} ₽/10г белка</span>
      <span>💳 <span style={{ color: score.costEfficiency.efficiencyScore >= 50 ? '#22c55e' : '#f59e0b' }}>{score.costEfficiency.efficiencyScore}/100</span></span>
    </div>
  )}
  </>)
}
                      {food.bestFor && food.bestFor.length > 0 && (
                        <div style={{ marginTop: 4, fontSize: 8, color: 'rgba(255,255,255,0.9)' }}>
                          🎯 Для: {food.bestFor.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {sorted.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.9)', fontSize: 10 }}>
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
            <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.9)', fontSize: 10 }}>
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
                      <span onClick={() => toggleCompare(id)} style={{ cursor: 'pointer', fontWeight: 700, color: '#ef4444' }}>✕</span>
                    </span>
                  );
                })}
                <button onClick={() => setCompareIds([])} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 7, border: 'none', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer' }}>Очистить</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(compareData.length, 3)}, 1fr)`, gap: 6 }}>
                {compareData.map(({ food, score }: any) => (
                  <div key={food.id} style={{ borderRadius: 12, padding: 10, background: `rgba(255,255,255,0.02)`, border: `1px solid ${score.color}20` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 4, textAlign: 'center' }}>{food.name}</div>
                    <div style={{ textAlign: 'center', marginBottom: 6 }}>
                      <ScoreBadge score={score.total} max={score.maxPossible || 10} color={score.color} label={score.label} />
                    </div>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)', marginBottom: 4, textAlign: 'center' }}>
                      {food.kcal} ккал · {food.protein}г б · {food.fat}г ж · {food.carbs}г у
                    </div>
                    {score.breakdown && enableA && <>
                      <ScoreBar label="Белок" value={score.breakdown.proteinDensity} max={30} color="#3b82f6" />
                      <ScoreBar label="Микро" value={score.breakdown.microDensity} max={30} color="#22c55e" />
                      <ScoreBar label="Клетчатка" value={score.breakdown.fiberQuality} max={20} color="#f97316" />
                      <ScoreBar label="АК" value={score.breakdown.aminoScore} max={25} color="#ec4899" />
                      <ScoreBar label="Категория" value={score.breakdown.tierScore} max={20} color="#f59e0b" />
                    </>}
                    {score.factors && useV2 && (
                      <div style={{ marginTop: 4 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, fontSize: 7, marginBottom: 4 }}>
                          <div style={{ color: '#22c55e' }}>🟢 База {score.bbScore?.toFixed(1)||'—'}</div>
                          <div style={{ color: '#a78bfa' }}>🟣 Фаза {score.phaseMod?.toFixed(1)||'—'}</div>
                          {score.pharmaMod !== undefined && <div style={{ color: score.pharmaMod >= 0 ? '#22c55e' : '#ef4444' }}>{score.pharmaMod >= 0 ? '🟢' : '🔴'} Фарма {score.pharmaMod.toFixed(1)}</div>}
                          {score.labMod !== undefined && <div style={{ color: score.labMod >= 0 ? '#22c55e' : '#ef4444' }}>{score.labMod >= 0 ? '🟢' : '🔴'} Лабы {score.labMod.toFixed(1)}</div>}
                          {score.timingMod !== undefined && <div style={{ color: score.timingMod >= 0 ? '#22c55e' : '#ef4444' }}>{score.timingMod >= 0 ? '🟢' : '🔴'} Тайминг {score.timingMod.toFixed(1)}</div>}
                        </div>
                        {score.factors.length > 0 && (
                          <div style={{ maxHeight: 80, overflowY: 'auto', fontSize: 7, color: 'rgba(255,255,255,0.65)' }}>
                            {score.factors.map((f: any, i: number) => (
                              <div key={i} style={{ color: f.impact > 0 ? '#22c55e' : '#ef4444', marginBottom: 1 }}>{f.icon} {f.text}</div>
                            ))}
                          </div>
                        )}
                        {(() => {
                          const d = calcDIAAS(food);
                          return d.diaas > 0 ? (
                            <div style={{ marginTop: 2, fontSize: 7, color: d.diaas >= 1 ? '#22c55e' : d.diaas >= 0.75 ? '#f59e0b' : '#ef4444' }}>
                              💪 DIAAS {d.diaas.toFixed(2)} · {d.limitingAA}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                    {enableC && score.costEfficiency && (
                      <div style={{ marginTop: 4, fontSize: 7, color: 'rgba(255,255,255,0.9)', textAlign: 'center' }}>
                        💰 {score.costEfficiency.proteinCostRub} ₽/10г белка · <span style={{ color: score.costEfficiency.efficiencyScore >= 50 ? '#22c55e' : '#f59e0b' }}>{score.costEfficiency.efficiencyScore}/100</span>
                      </div>
                    )}
                    {(() => {
                      const found = FOOD_DB.find(f => f.id === food.id);
                      if (!found) return null;
                      const f = found as any;
                      const diaas = calcDIAAS(food);
                      return (
                        <div style={{ marginTop:6, borderTop:`1px solid ${score.color}10`, paddingTop:4 }}>
                          <div style={{ fontSize:7, fontWeight:700, color:'#8b5cf6', marginBottom:4, cursor:'pointer', userSelect:'none' }}
                            onClick={() => { const el = document.getElementById(`compare_detail_${food.id}`); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; }}>
                            📊 Полный профиль ▾
                          </div>
                          <div id={`compare_detail_${food.id}`} style={{ display:'none', fontSize:7, color:'rgba(255,255,255,0.75)' }}>
                            {f.carbs !== undefined && (
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2, marginBottom:4, padding:'3px 6px', borderRadius:6, background:'rgba(255,255,255,0.02)' }}>
                                <div>🔥 Ккал: <b>{f.kcal||'—'}</b></div>
                                <div>🥩 Белок: <b>{f.protein||'—'}г</b></div>
                                <div>🧈 Жиры: <b>{f.fat||'—'}г</b></div>
                                <div>🍚 Углеводы: <b>{f.carbs||'—'}г</b></div>
                                <div>🌾 Клетчатка: <b>{f.carbs_fiber||'—'}г</b></div>
                              </div>
                            )}
                            {diaas.diaas > 0 && (
                              <div style={{ marginBottom:4, padding:'3px 6px', borderRadius:6, background: diaas.diaas >= 1 ? 'rgba(0,230,138,0.04)' : diaas.diaas >= 0.75 ? 'rgba(245,158,11,0.04)' : 'rgba(239,68,68,0.04)', border:`1px solid ${diaas.diaas >= 1 ? 'rgba(0,230,138,0.1)' : diaas.diaas >= 0.75 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)'}` }}>
                                💪 DIAAS: <b style={{color: diaas.diaas >= 1 ? '#22c55e' : diaas.diaas >= 0.75 ? '#f59e0b' : '#ef4444'}}>{diaas.diaas.toFixed(2)}</b> · лимит: {diaas.limitingAA}
                              </div>
                            )}
                            {(f.leucine_mg || f.isoleucine_mg || f.valine_mg) && (
                              <div style={{ marginBottom:4, padding:'3px 6px', borderRadius:6, background:'rgba(0,230,138,0.03)' }}>
                                🧬 АК (мг): Лейцин <b>{f.leucine_mg||'—'}</b> · Илей <b>{f.isoleucine_mg||'—'}</b> · Валин <b>{f.valine_mg||'—'}</b>
                              </div>
                            )}
                            {(f.sodium_mg || f.potassium_mg || f.magnesium_mg) && (
                              <div style={{ marginBottom:4, padding:'3px 6px', borderRadius:6, background:'rgba(59,130,246,0.03)' }}>
                                ⚡ Электролиты (мг): Na <b>{f.sodium_mg||'—'}</b> · K <b>{f.potassium_mg||'—'}</b> · Mg <b>{f.magnesium_mg||'—'}</b>
                              </div>
                            )}
                            {f.fodmap_group && (
                              <div style={{ marginBottom:4, padding:'3px 6px', borderRadius:6, background:'rgba(245,158,11,0.03)' }}>
                                🏷️ FODMAP: <b style={{color: f.fodmap_group === 'LOW' ? '#22c55e' : '#ef4444'}}>{f.fodmap_group}</b>
                                {f.enzyme_demand_score && <span> · Ферм.нагрузка: <b>{f.enzyme_demand_score}/10</b></span>}
                                {f.gastric_emptying_speed && <span> · Опорожн.: <b>{f.gastric_emptying_speed}</b></span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
              {compareData.length >= 2 && (() => {
                const catKeys = ['kcal','protein','fat','carbs','carbs_fiber','leucine_mg','isoleucine_mg','valine_mg','sodium_mg','potassium_mg','magnesium_mg'] as const;
                const catLabels: Record<string,string> = {kcal:'🔥 Ккал', protein:'🥩 Белок', fat:'🧈 Жиры', carbs:'🍚 Углев.', carbs_fiber:'🌾 Клетч.', leucine_mg:'🧬 Лейцин', isoleucine_mg:'🧬 Илей', valine_mg:'🧬 Валин', sodium_mg:'⚡ Na', potassium_mg:'⚡ K', magnesium_mg:'⚡ Mg'};
                const rows = catKeys.map(key => {
                  const vals = compareData.map((c:any) => { const ff = FOOD_DB.find((x:any) => x.id === c.food.id); return { id: c.food.id, v: ff ? (ff as any)[key] ?? null : null }; });
                  const numeric = vals.filter(v => v.v !== null && typeof v.v === 'number');
                  if (numeric.length < 2) return null;
                  const best = key === 'kcal' ? Math.min(...numeric.map(v=>v.v)) : Math.max(...numeric.map(v=>v.v));
                  return { label: catLabels[key] || key, vals: vals.map(v => ({ id: v.id, v: v.v, win: v.v !== null && typeof v.v === 'number' && v.v === best })) };
                }).filter(Boolean);
                return (
                  <div style={{ marginTop:10, borderRadius:12, padding:10, background:'rgba(139,92,246,0.04)', border:'1px solid rgba(139,92,246,0.1)' }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'#8b5cf6', marginBottom:6 }}>🏆 Сравнение метрик (победитель)</div>
                    <div style={{ display:'grid', gridTemplateColumns:`60px repeat(${compareData.length}, 1fr)`, gap:2, fontSize:7 }}>
                      <div style={{ fontWeight:600, color:'rgba(255,255,255,0.5)', padding:'2px 4px' }}>Метрика</div>
                      {compareData.map((c:any) => <div key={c.food.id} style={{ fontWeight:600, color:'#fff', textAlign:'center', padding:'2px 4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:6 }}>{c.food.name}</div>)}
                      {(rows as any[]).map((row:any, ri:number) => (
                        <React.Fragment key={ri}>
                          <div style={{ padding:'2px 4px', color:'rgba(255,255,255,0.6)' }}>{row.label}</div>
                          {row.vals.map((v:any) => (
                            <div key={v.id} style={{ textAlign:'center', padding:'2px 4px', borderRadius:4, background:v.win ? 'rgba(0,230,138,0.08)' : 'transparent' }}>
                              {v.v !== null && v.v !== undefined ? <span style={{ color: v.win ? '#00e68a' : 'rgba(255,255,255,0.65)', fontWeight: v.win ? 700 : 400 }}>{typeof v.v === 'number' ? v.v.toFixed(1) : v.v}</span> : <span style={{ color:'rgba(255,255,255,0.2)' }}>—</span>}
                              {v.win && <span style={{ marginLeft:2 }}>✅</span>}
                            </div>
                          ))}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })()}
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
                    <span onClick={() => setSourcePicker(null)} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 700 }}>✕</span>
                  </div>
                  <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                    {sourcePicker.items.map(item => (
                      <div key={item.id} onClick={() => handlePickerSelect(item.id)} style={{
                        padding: '6px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 3,
                        background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.08)',
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: '#fff' }}>{item.name}</div>
                        {item.label && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)' }}>{item.label}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {([
                  { key: 'any', label: '🕐 Любое время' },
                  { key: 'pre', label: '🔥 Пред-тренировка' },
                  { key: 'post', label: '🍗 Пост-тренировка' },
                ] as const).map(t => (
                  <button key={t.key} onClick={() => setMealTiming(t.key)} style={{
                    flex:1, padding:'6px 4px', borderRadius:8, cursor:'pointer', fontSize:8, fontWeight:600,
                    background: mealTiming===t.key?'rgba(249,115,22,0.12)':'rgba(255,255,255,0.03)',
                    border: mealTiming===t.key?'1px solid rgba(249,115,22,0.25)':'1px solid rgba(255,255,255,0.06)',
                    color: mealTiming===t.key?'#f97316':'rgba(255,255,255,0.7)',
                  }}>{t.label}</button>
                ))}
              </div>
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
                      <span style={{ color: 'rgba(255,255,255,0.9)' }}>{food.kcal} ккал · {food.protein}г б</span>
                    </div>
                  ))}
                </div>
              )}
              {mealProducts.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>Продукты в приёме:</div>
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
                        <span style={{ color: 'rgba(255,255,255,0.75)' }}>г</span>
                        <span style={{ color: '#22c55e', minWidth: 30, textAlign: 'right' }}>
                          {food ? Math.round((food.protein || 0) * mp.weightGrams / 100) : 0}г
                        </span>
                        <span onClick={() => setMealProducts(mealProducts.filter((_, i) => i !== idx))} style={{
                          cursor: 'pointer', color: '#ef4444', fontWeight: 700, fontSize: 10, padding: '0 4px',
                        }}>✕</span>
                      </div>
                    );
                  })}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px',
                    marginTop: 4, borderRadius: 8, background: 'rgba(255,255,255,0.03)', fontSize: 8, color: 'rgba(255,255,255,0.8)',
                  }}>
                    <span>в€‘ {mealProducts.reduce((s, mp) => {
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
                    const result = useV2 ? calcMealScoreV2(mealProducts, v2Profile) : calcMealScore(mealProducts, opts);
                    if (result && mealTiming !== 'any') {
                      const timingMod = mealTiming === 'pre' ? 1.05 : 1.08;
                      (result as any).compositeScore = Math.min(100, Math.round((result as any).compositeScore * timingMod));
                      (result as any).label = (result as any).compositeScore >= 85 ? '💎 Элитный' : (result as any).compositeScore >= 70 ? '⭐ Отличный' : (result as any).compositeScore >= 50 ? '👍 Хороший' : (result as any).compositeScore >= 30 ? '⚡ Базовый' : '⚠️ Слабый';
                      (result as any).timingNote = mealTiming === 'pre' ? '🔥 Pre-workout: +5% за быстрые углеводы, кофеин' : '🍗 Post-workout: +8% за белок и восстановление';
                    }
                    setMealResult(result as any);
                  }} style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 9, border: 'none',
                    background: 'linear-gradient(135deg, #f97316, #ef4444)', color: '#fff', cursor: 'pointer', fontWeight: 700,
                  }}>
                    🧮 Рассчитать полезность
                  </button>
                  <button onClick={() => setMealProducts([])} style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 8, border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer',
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
                      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.9)' }}>средневзвешенный по граммовке</div>
                    </div>
                    <ScoreBadge score={mealResult.compositeScore} max={mealResult.maxPossible} color={mealResult.color} label={mealResult.label} />
                  </div>
                  {(mealResult as any).timingNote && (
                    <div style={{ fontSize:7, color:'#f97316', marginBottom:8, padding:'4px 8px', borderRadius:6, background:'rgba(249,115,22,0.06)', border:'1px solid rgba(249,115,22,0.1)' }}>
                      {(mealResult as any).timingNote}
                    </div>
                  )}
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
                        <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.9)' }}>{icon} {label}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: label === 'Белок' ? '#22c55e' : label === 'Жиры' ? '#f59e0b' : label === 'Углеводы' ? '#3b82f6' : '#fff' }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>БЖУ %</div>
                    <div style={{ display: 'flex', gap: 4, height: 6, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ flex: mealResult.pfcRatio.proteinPct, background: '#22c55e' }} />
                      <div style={{ flex: mealResult.pfcRatio.fatPct, background: '#f59e0b' }} />
                      <div style={{ flex: mealResult.pfcRatio.carbsPct, background: '#3b82f6' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 6, color: 'rgba(255,255,255,0.9)' }}>
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
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.9)' }}>{ps.weight}г</span>
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)' }}>вклад {ps.contribution}%</span>
                      <div style={{ display:'flex', gap:2, justifyContent:'flex-end' }}>
                        <button onClick={() => { try { const favs = JSON.parse(localStorage.getItem('he_food_favs') || '[]'); const updated = [ps.foodId, ...favs.filter((f: string) => f !== ps.foodId)].slice(0, 100); localStorage.setItem('he_food_favs', JSON.stringify(updated)); showToast(`✅ ${ps.name} в избранном`); } catch {} }} style={{
                          padding:'1px 5px', borderRadius:4, fontSize:6, cursor:'pointer', background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.15)', color:'#8b5cf6'
                        }}>⭐</button>
                      </div>
                    </div>
                  ))}
                  {mealResult.weakLink && (
                    <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)' }}>
                      <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 600 }}>⚠️ Слабый продукт: {mealResult.weakLink.name}</div>
                      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)' }}>{mealResult.weakLink.reason}</div>
                    </div>
                  )}
                  {mealResult.productScores.some((ps:any)=>ps.score<50) && (
                    <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.1)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#00e68a', marginBottom:6 }}>🔄 Точечные замены (улучшение скора)</div>
                      {mealResult.productScores.filter((ps:any)=>ps.score<50).slice(0,3).map((ps:any)=>{
                        const food = FOOD_DB.find(f=>f.id===ps.foodId);
                        if(!food) return null;
                        const sameCat = scored.filter((p:any)=>p.food.category===food.category&&p.food.id!==food.id);
                        const best = sameCat.sort((a,b)=>b.score.total-a.score.total)[0];
                        if(!best||best.score.total<=ps.score) return null;
                        const improvement = Math.round((best.score.total-ps.score)/ps.score*100);
                        return (
                          <div key={ps.foodId} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 0',fontSize:8}}>
                            <span style={{color:'#ef4444',textDecoration:'line-through'}}>{ps.name} ({ps.score})</span>
                            <span style={{color:'rgba(255,255,255,0.3)'}}>→</span>
                            <span style={{color:'#22c55e',fontWeight:600}}>{best.food.name} ({best.score.total})</span>
                            <span style={{color:'#22c55e',fontWeight:700,marginLeft:'auto'}}>+{improvement}%</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {mealResult.microCoverage.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>Микронутриенты (% от суточной нормы)</div>
                      {mealResult.microCoverage.slice(0, 10).map(m => (
                        <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.8)', minWidth: 24 }}>{m.name}</span>
                          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, m.percent)}%`, height: '100%',
                              background: m.percent >= 50 ? '#22c55e' : m.percent >= 20 ? '#f59e0b' : '#ef4444',
                              borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.9)', minWidth: 30, textAlign: 'right' }}>
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
                  <div style={{ display:'flex', gap:6, marginTop:8 }}>
                    <button onClick={() => {
                      try {
                        const plan = JSON.parse(localStorage.getItem('he_daily_plan') || '[]');
                        mealProducts.forEach(mp => {
                          const food = FOOD_DB.find(f => f.id === mp.foodId);
                          if (food) plan.push({ id: food.id, name: food.name, amount: mp.weightGrams, kcal: (food.kcal || 0) * mp.weightGrams / 100, protein: (food.protein || 0) * mp.weightGrams / 100, fat: (food.fat || 0) * mp.weightGrams / 100, carbs: (food.carbs || 0) * mp.weightGrams / 100 });
                        });
                        localStorage.setItem('he_daily_plan', JSON.stringify(plan));
                        showToast(`✅ Рацион (${mealProducts.length} продуктов) добавлен в план`);
                      } catch {}
                    }} style={{
                      padding:'6px 12px', borderRadius:8, fontSize:8, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.2)', color:'#00e68a', fontWeight:600
                    }}>📋 Добавить рацион в план</button>
                  </div>
                </div>
              )}
              {mealResult && mealProducts.length > 0 && (() => {
                const diets = analyzeDailyDiet(
                  [{ products: mealProducts.map(mp => ({ foodId: mp.foodId, weightGrams: mp.weightGrams })) }],
                  v2Profile
                );
                if (!diets) return null;
                const bars = [
                  { label:'🥩 mTOR-активация', value:diets.mtorDeficitMg>0?Math.max(0,100-Math.round(diets.mtorDeficitMg/30*100)):100, max:100, color:'#22c55e', ok:diets.mtorTriggered },
                  { label:'🧬 Гликемическая нагрузка', value:Math.min(100,Math.round((1-diets.giLoad/100)*100)), max:100, color:diets.giLoadWarning?'#f59e0b':'#22c55e', hint:diets.giLoad.toFixed(0)+' GL' },
                  { label:'⚖️ PRAL (кислотность)', value:Math.max(0,Math.min(100,50-diets.pralTotal*2)), max:100, color:diets.pralWarning?'#ef4444':'#8b5cf6', hint:diets.pralTotal.toFixed(1) },
                  { label:'🩸 Аммиак-риск', value:100-diets.ammoniaScore, max:100, color:diets.ammoniaRisk?'#ef4444':'#22c55e' },
                  { label:'🐟 Омега-баланс', value:Math.min(100,Math.round((1/Math.max(0.1,diets.omegaRatio))*10)), max:100, color:diets.omegaWarning?'#ef4444':'#3b82f6', hint:diets.omegaRatio.toFixed(1)+':1' },
                  { label:'⚡ Электролиты', value:diets.electrolyteRisk?40:80, max:100, color:diets.electrolyteRisk?'#f59e0b':'#06b6d4', hint:'K:'+diets.potassiumMg.toFixed(0)+' Mg:'+diets.magnesiumMg.toFixed(0) },
                  { label:'🍬 Инсулин-риск', value:diets.insulinRicohet?30:85, max:100, color:diets.insulinRicohet?'#f97316':'#22c55e' },
                ];
                return (
                  <div style={{ borderRadius:12, padding:12, background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.1)', marginTop:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#8b5cf6', marginBottom:8 }}>📊 Анализ дневного рациона</div>
                    <div style={{ display:'flex',flexDirection:'column',gap:4 }}>
                      {bars.map(b => (
                        <div key={b.label} style={{ display:'flex',alignItems:'center',gap:6 }}>
                          <span style={{ fontSize:7,color:'rgba(255,255,255,0.8)',minWidth:110 }}>{b.label}</span>
                          <div style={{ flex:1,height:5,borderRadius:3,background:'rgba(255,255,255,0.06)',overflow:'hidden' }}>
                            <div style={{ width:`${Math.min(100,b.value)}%`,height:'100%',borderRadius:3,background:b.color,transition:'width 0.5s' }}/>
                          </div>
                          <span style={{ fontSize:7,fontWeight:700,color:b.color,minWidth:28,textAlign:'right' }}>{b.value}</span>
                          {(b as any).hint && <span style={{ fontSize:6,color:'rgba(255,255,255,0.4)',minWidth:30,textAlign:'right' }}>{(b as any).hint}</span>}
                        </div>
                      ))}
                    </div>
                    {(diets.pralWarning || diets.omegaWarning || diets.diaasWarning || diets.antinutrientWarning || diets.glutathioneWarning || diets.histamineWarning) && (
                      <div style={{ marginTop:8,fontSize:7,color:'#ef4444',lineHeight:1.4 }}>
                        {[diets.pralWarning,diets.omegaWarning,diets.diaasWarning,diets.antinutrientWarning,diets.glutathioneWarning,diets.histamineWarning].filter(Boolean).map((w,i)=><div key={i}>⚠️ {w}</div>)}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {mealTab === 'saved' && (
            <div>
              {savedMeals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.9)', fontSize: 10 }}>
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
                        <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.9)' }}>
                          {new Date(meal.createdAt).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>
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

      {plannerTab === 'swap' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ borderRadius:12, padding:12, background:'rgba(236,72,153,0.05)', border:'1px solid rgba(236,72,153,0.1)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#ec4899', marginBottom:6 }}>🔄 Найти лучшую замену</div>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.8)', marginBottom:8, lineHeight:1.4 }}>
              Выберите продукт — алгоритм найдёт лучшие альтернативы в той же категории с более высоким скором полезности.
            </div>
            <div style={{ position:'relative', marginBottom:10 }}>
              <input value={swapFrom} onChange={e => setSwapFrom(e.target.value)} placeholder="🔍 Название продукта..." style={{
                width:'100%', padding:'10px 12px', borderRadius:10, fontSize:11, background:'#202023',
                border:'1px solid rgba(236,72,153,0.2)', color:'#fff', outline:'none', boxSizing:'border-box',
              }} />
              {swapFrom && <span onClick={()=>{setSwapFrom('');setSwapResults([]);}} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,0.8)',cursor:'pointer',fontSize:14}}>✕</span>}
            </div>
            <button onClick={() => {
              const searchQ = swapFrom.toLowerCase().trim();
              if (!searchQ) return;
              const found = scored.filter(({food}) => food.name.toLowerCase().includes(searchQ));
              if (found.length === 0) { setSwapResults([]); return; }
              const target = found[0];
              const targetCat = target.food.category;
              const sameCat = scored.filter(({food}) => food.category === targetCat && food.id !== target.food.id);
              const withImprovement = sameCat
                .filter(({score}) => score.total > target.score.total)
                .sort((a,b) => b.score.total - a.score.total)
                .slice(0, 8)
                .map(({food,score}) => ({ food, score, improvement: Math.round((score.total - target.score.total) / target.score.total * 100) }));
              setSwapResults(withImprovement);
              if (withImprovement.length === 0) showToast('Нет продуктов с более высоким скором в этой категории');
            }} style={{
              width:'100%', padding:'10px', borderRadius:10, cursor:'pointer', fontSize:11, fontWeight:700,
              background:'linear-gradient(135deg,#ec4899,#db2777)', border:'none', color:'#fff',
            }}>🔍 Найти замену</button>
          </div>

          {swapResults.length > 0 && (
            <div style={{ borderRadius:12, padding:12, background:'rgba(34,197,94,0.05)', border:'1px solid rgba(34,197,94,0.1)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:8 }}>
                ✅ Найдено {swapResults.length} улучшений для «{swapFrom}»
              </div>
              {swapResults.map(({ food, score, improvement }) => (
                <div key={food.id} style={{ display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:10,marginBottom:4,background:'rgba(34,197,94,0.04)',border:'1px solid rgba(34,197,94,0.08)' }}>
                  <div style={{ width:32,height:32,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',background:'#22c55e18',fontSize:14,fontWeight:800,color:'#22c55e',flexShrink:0 }}>
                    +{improvement}%
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:10,fontWeight:600,color:'#fff' }}>{food.name}</div>
                    <div style={{ fontSize:7,color:'rgba(255,255,255,0.9)' }}>
                      Скор {score.total}/100 · {food.kcal}ккал · Б{food.protein} Ж{food.fat} У{food.carbs} · {CATEGORY_LABELS[food.category]||food.category}
                    </div>
                  </div>
                  <div style={{ fontSize:9,fontWeight:700,color:'#22c55e' }}>↑{improvement}%</div>
                  <div style={{ display:'flex', gap:4 }}>
                    <button onClick={() => { try { const favs = JSON.parse(localStorage.getItem('he_food_favs') || '[]'); const updated = [food.id, ...favs.filter((f: string) => f !== food.id)].slice(0, 100); localStorage.setItem('he_food_favs', JSON.stringify(updated)); showToast(`✅ ${food.name} добавлен в избранное`); } catch {} }} style={{
                      padding:'3px 8px', borderRadius:6, fontSize:7, cursor:'pointer', background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.2)', color:'#8b5cf6'
                    }}>⭐ В избранное</button>
                    <button onClick={() => { try { const plan = JSON.parse(localStorage.getItem('he_daily_plan') || '[]'); plan.push({ id: food.id, name: food.name, amount: 100, kcal: food.kcal, protein: food.protein, fat: food.fat, carbs: food.carbs }); localStorage.setItem('he_daily_plan', JSON.stringify(plan)); showToast(`✅ ${food.name} добавлен в план`); } catch {} }} style={{
                      padding:'3px 8px', borderRadius:6, fontSize:7, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.2)', color:'#00e68a'
                    }}>📋 В план</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {swapResults.length === 0 && swapFrom && (
            <div style={{ borderRadius:12, padding:20, textAlign:'center', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>🔍</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.8)', marginBottom:4 }}>
                Введите название продукта и нажмите «Найти замену»
              </div>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', lineHeight:1.4 }}>
                Алгоритм найдёт продукты той же категории с более высоким<br/>
                скором полезности (v2 или классическим) и покажет % улучшения.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


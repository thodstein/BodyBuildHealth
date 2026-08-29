import React, { useState, useMemo, useRef } from "react";
import { usePlanCtx } from "./IndividualPlanContext";
import { FOOD_DB } from "../../../../core/nutrition-database";
import { getRecipesByMeal } from "../../../../engines/nutrition-periodization.engine";
import { recipeMacroDistance } from "./recipe-engine";
import { MealQuickControls } from "./MealQuickControls";
import { MealComposerMode, type ComposerMode } from "./MealComposerMode";
import type { AdvancedFilter } from "../../../../engines/kbju-food-match.engine";
import { analyzeNutrientGaps, type NutrientGapResult } from "../../../../engines/nutrient-gap-filler.engine";
import { getGapAwareComboResult, buildGapSummary, applyGapComboToPlan, type GapAwareScore } from "../../../../engines/composer-targeting-integration";

const KbjuProgressBars: React.FC<{ dayPlan: any; targetKcal: number; targetP: number; targetF: number; targetC: number }> = ({
  dayPlan, targetKcal, targetP, targetF, targetC,
}) => {
  if (!dayPlan?.totals) return null;
  const t = dayPlan.totals;
  const pct = (val: number, target: number) => Math.min(100, Math.round(val / Math.max(1, target) * 100));
  const color = (pct: number) => {
    if (pct >= 90 && pct <= 110) return '#22c55e';
    if (pct >= 70 && pct <= 130) return '#f59e0b';
    return '#ef4444';
  };

  const items = [
    { label: 'Ккал', actual: Math.round(t.kcal), target: targetKcal, pct: pct(t.kcal, targetKcal), icon: '🔥', grad: 'linear-gradient(90deg,#22c55e,#4ade80)' },
    { label: 'Белки', actual: Math.round(t.p), target: targetP, pct: pct(t.p, targetP), icon: '🥩', grad: 'linear-gradient(90deg,#3b82f6,#60a5fa)' },
    { label: 'Жиры', actual: Math.round(t.f), target: targetF, pct: pct(t.f, targetF), icon: '🧈', grad: 'linear-gradient(90deg,#f59e0b,#fbbf24)' },
    { label: 'Углев.', actual: Math.round(t.c), target: targetC, pct: pct(t.c, targetC), icon: '🍚', grad: 'linear-gradient(90deg,#f97316,#fb923c)' },
  ];

  return (
    <div style={{ padding: '12px 14px', borderRadius: 14, background: 'linear-gradient(180deg, rgba(24,24,27,0.86), rgba(18,18,20,0.92))', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 10, boxShadow:'0 6px 20px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', marginBottom: 8, display:'flex', alignItems:'center', gap:6 }}>
        <span style={{width:22,height:22,borderRadius:7,background:'rgba(0,230,138,0.10)',border:'1px solid rgba(0,230,138,0.14)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11}}>📊</span> КБЖУ дня
        <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.42)', marginLeft: 6, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.06)', padding:'2px 7px', borderRadius:999 }}>
          факт / цель
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px' }}>
        {items.map(item => (
          <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.68)', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}>
                <span style={{fontSize:10}}>{item.icon}</span> {item.label}
              </span>
              <span style={{ fontSize: 11, fontWeight: 800, color: color(item.pct) }}>
                {item.actual}<span style={{fontWeight:600, color:'rgba(255,255,255,0.32)'}}>/{item.target}</span>
                <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 4, background: color(item.pct)+'18', border:`1px solid ${color(item.pct)}22`, padding:'1px 5px', borderRadius:999 }}>{item.pct}%</span>
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <div style={{
                width: `${item.pct}%`, height: '100%', borderRadius: 999,
                background: (item as any).grad,
                boxShadow: `0 0 8px ${color(item.pct)}44`,
                transition: 'width 0.35s cubic-bezier(0.16,1,0.3,1)',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const getProductsFromDayPlan = (dp: any): { foodId: string; weightGrams: number }[] => {
  if (!dp?.meals) return [];
  const items: { foodId: string; weightGrams: number }[] = [];
  for (const meal of dp.meals) {
    for (const item of (meal.items || [])) {
      if (item.id) items.push({ foodId: item.id, weightGrams: item.amount || 100 });
    }
  }
  return items;
};

export const MealComposer: React.FC = () => {
  const {
    dayPlan, threeDayPlan, weekPlan, generatePlan,
    DAY_LABELS, planDays, setPlanDays,
    selectedDayIndex, setSelectedDayIndex,
    generated, setGenerated,
    renderMealList,
    recipePickerMeal, setRecipePickerMeal, replaceMealWithRecipe,
    favoriteRecipes, isFavoriteRecipe, toggleFavoriteRecipe,
    effectiveKcal, effectiveP, effectiveF, effectiveC,
    setDayPlan, setThreeDayPlan, setWeekPlan, saveUndo,
     setPlanTab, plannerMode,
  } = usePlanCtx();

  const [composerMode, setComposerMode] = useState<ComposerMode>('basic');
  const [advancedFilter, setAdvancedFilter] = useState<AdvancedFilter>({});
  const [selectedMealForTargeting, setSelectedMealForTargeting] = useState<number | null>(null);
  // 🧠 Умный пикер: сортировка рецептов под конкретный приём (КБЖУ-дистанция) + ⭐ избранное
  const sortedPickerRecipes = useMemo(() => {
    if (!recipePickerMeal) return [];
    const mealType = recipePickerMeal.label === 'Завтрак' ? 'breakfast' : recipePickerMeal.label === 'Обед' || recipePickerMeal.label === 'Второй завтрак' ? 'lunch' : recipePickerMeal.label === 'Ужин' ? 'dinner' : 'snack';
    const day = dayPlan || (threeDayPlan?.days ? threeDayPlan.days[selectedDayIndex] : null) || (weekPlan?.days ? weekPlan.days[selectedDayIndex] : null);
    const m = day?.meals?.[recipePickerMeal.mealIdx];
    const tgt = m?.target || { p: m?.totals?.p ?? 30, c: m?.totals?.c ?? 40, f: m?.totals?.f ?? 15 };
    const tKcal = m?.totals?.kcal || Math.round((tgt.p || 0) * 4 + (tgt.c || 0) * 4 + (tgt.f || 0) * 9) || 300;
    try {
      return getRecipesByMeal(mealType as any).map((r: any) => ({
        r,
        dist: recipeMacroDistance(r, { targetKcal: tKcal, targetProteinG: tgt.p || 30, targetCarbsG: tgt.c || 40, targetFatG: tgt.f || 15 }),
      })).sort((a: any, b: any) => a.dist - b.dist).map((x: any) => x.r);
    } catch { return getRecipesByMeal(mealType as any); }
  }, [recipePickerMeal, dayPlan, threeDayPlan, weekPlan, selectedDayIndex]);
  const allowAdvancedComposer = plannerMode === 'pro';
  React.useEffect(() => {
    if (!allowAdvancedComposer && composerMode !== 'basic') {
      setComposerMode('basic');
      setSelectedMealForTargeting(null);
      setAdvancedFilter({});
    }
  }, [allowAdvancedComposer, composerMode]);

  const currentDay = dayPlan || (threeDayPlan?.days ? threeDayPlan.days[selectedDayIndex] : null) || (weekPlan?.days ? weekPlan.days[selectedDayIndex] : null);
  const dayProducts = useMemo(() => getProductsFromDayPlan(currentDay), [currentDay]);

  const gapCacheRef = useRef<{ key: string; result: NutrientGapResult | null }>({ key: '', result: null });
  const gapResult = useMemo(() => {
    if (composerMode !== 'targeting' || dayProducts.length === 0) return null;
    const key = JSON.stringify(dayProducts);
    if (gapCacheRef.current.key === key) return gapCacheRef.current.result;
    const result = analyzeNutrientGaps(dayProducts);
    gapCacheRef.current = { key, result };
    return result;
  }, [composerMode, dayProducts]);
  const gapSummary = useMemo(() => {
    if (!gapResult) return [];
    return buildGapSummary(gapResult);
  }, [gapResult]);

  const comboCacheRef = useRef<{ key: string; result: { gaps: NutrientGapResult; suggestions: GapAwareScore[] } | null }>({ key: '', result: null });
  const comboResult = useMemo(() => {
    if (composerMode !== 'targeting' || dayProducts.length === 0) return null;
    const key = JSON.stringify(dayProducts);
    if (comboCacheRef.current.key === key) return comboCacheRef.current.result;
    const result = getGapAwareComboResult(dayProducts, 5);
    comboCacheRef.current = { key, result };
    return result;
  }, [composerMode, dayProducts]);

  // Sync dayPlan edits back to multi-day plan.
  // E7-фикс: раньше ключ по totals терял правки без изменения сумм (замена 1:1 по ккал,
  // перестановки). Теперь — содержательный JSON-ключ meals + multiDay-сравнение.
  const dayPlanKeyRef = useRef('');
  React.useEffect(() => {
    if (!planDays || planDays === 1 || !dayPlan || !dayPlan.meals) return;
    const multiDay = planDays === 3 ? threeDayPlan : weekPlan;
    if (!multiDay?.days?.[selectedDayIndex]) return;
    const key = JSON.stringify(dayPlan.meals.map((m: any) => ({ t: m.time, l: m.label, i: (m.items || []).map((x: any) => `${x.id}:${x.amount}`) })));
    if (key === dayPlanKeyRef.current) return;
    const oldKey = JSON.stringify((multiDay.days[selectedDayIndex]?.meals || []).map((m: any) => ({ t: m.time, l: m.label, i: (m.items || []).map((x: any) => `${x.id}:${x.amount}`) })));
    if (key === oldKey) { dayPlanKeyRef.current = key; return; }
    dayPlanKeyRef.current = key;
    const days = [...multiDay.days];
    days[selectedDayIndex] = JSON.parse(JSON.stringify(dayPlan));
    const allTotals = { kcal: days.reduce((s: number, d: any) => s + (d.totals?.kcal || 0), 0), p: days.reduce((s: number, d: any) => s + (d.totals?.p || 0), 0), f: days.reduce((s: number, d: any) => s + (d.totals?.f || 0), 0), c: days.reduce((s: number, d: any) => s + (d.totals?.c || 0), 0) };
    if (planDays === 3) setThreeDayPlan({ ...multiDay, days, totals: allTotals });
    else setWeekPlan({ ...multiDay, days, totals: allTotals });
  }, [dayPlan, planDays, selectedDayIndex]);

  const handleApplyCombo = (foodId: string, weightGrams: number) => {
    if (selectedMealForTargeting === null) return;
    saveUndo();
    const newPlan = applyGapComboToPlan(currentDay, selectedMealForTargeting, [{ foodId, weightGrams }]);
    if (newPlan) setDayPlan(newPlan);
    setSelectedMealForTargeting(null);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{
        padding:'12px 14px', borderRadius:14,
        background:'linear-gradient(135deg, rgba(0,230,138,0.08), rgba(0,230,138,0.03))',
        border:'1px solid rgba(0,230,138,0.12)', boxShadow:'0 4px 16px rgba(0,230,138,0.06)',
        display:'flex', gap:10, alignItems:'flex-start',
      }}>
        <span style={{width:30,height:30,borderRadius:10,background:'rgba(0,230,138,0.12)',border:'1px solid rgba(0,230,138,0.18)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>🍳</span>
        <div>
          <div style={{ fontSize:12, fontWeight:800, color:'#00e68a', marginBottom:3, letterSpacing:'-0.2px' }}>Компоновщик приёмов</div>
          <div style={{ fontSize:10.5, color:'rgba(255,255,255,0.68)', lineHeight:1.45 }}>
            {composerMode === 'basic' ? (
              <><b style={{color:'#fff'}}>Обычный</b> — подбор по КБЖУ · <b style={{color:'#6ee7b7'}}>Заменить</b> — найдите замену · <b style={{color:'#93c5fd'}}>Кол-во</b> — граммовку · <b style={{color:'#c4b5fd'}}>↩</b> Отменить</>
            ) : (
              <><b style={{color:'#fff'}}>Продвинутый</b> — фильтрация по <span style={{color:'#a78bfa'}}>DIAAS</span> · <span style={{color:'#fb923c'}}>GI</span> · <span style={{color:'#fbbf24'}}>PRAL</span> · обработка и качество</>
            )}
          </div>
        </div>
      </div>

      {!generated && (
        <div style={{ padding:16, textAlign:'center', background:'rgba(0,230,138,0.03)', borderRadius:12, border:'1px solid rgba(0,230,138,0.1)' }}>
          <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
            {/* E7-фикс: setGenerated ВНУТРИ generatePlan после успешной сборки, а не до
                (раньше кнопка маскировала пустой план при ошибке генерации) */}
            <button onClick={async () => { await generatePlan(1); setGenerated(true); }} style={{
              padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:10, fontWeight:700,
              background:'linear-gradient(135deg,#00e68a,#00c8a0)', border:'none', color:'#000',
            }}>✨ Создать план</button>
            <button onClick={() => setPlanTab('plan')} style={{
              padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:10, fontWeight:600,
              background:'#202023', border:'1px solid rgba(255,255,255,0.15)', color:'#fff',
            }}>📋 К плану</button>
          </div>
        </div>
      )}

      {generated && (
        <>
          {/* Mode switcher */}
          <MealComposerMode
            mode={composerMode}
            onModeChange={setComposerMode}
            advancedFilter={advancedFilter}
            onAdvancedFilterChange={setAdvancedFilter}
            gapResult={gapResult}
            gapSummary={gapSummary}
            allowAdvanced={allowAdvancedComposer}
          />

          {/* KBJU progress bars */}
          <KbjuProgressBars
            dayPlan={dayPlan}
            targetKcal={effectiveKcal}
            targetP={effectiveP}
            targetF={effectiveF}
            targetC={effectiveC}
          />

          {composerMode === 'targeting' && gapResult && comboResult && Array.isArray(comboResult.suggestions) && comboResult.suggestions.length > 0 && (
            <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.12)', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#06b6d4' }}>🎯 Продукты для закрытия дефицитов</span>
                <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)' }}>Выберите приём для добавления</span>
              </div>
              {selectedMealForTargeting === null && Array.isArray(dayPlan?.meals) ? (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
                  {dayPlan.meals.map((m: any, i: number) => (
                    <button key={i} onClick={() => setSelectedMealForTargeting(i)} style={{
                      padding: '4px 8px', borderRadius: 6, fontSize: 7, cursor: 'pointer',
                      background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)',
                      color: '#06b6d4', fontWeight: 600,
                    }}>{m.time} {m.label}</button>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 7, color: '#06b6d4', marginBottom: 6 }}>
                  Добавление в: <b>{dayPlan?.meals?.[selectedMealForTargeting ?? 0]?.label}</b>
                  <span onClick={() => setSelectedMealForTargeting(null)} style={{ marginLeft: 6, cursor: 'pointer', color: '#ef4444', fontWeight: 700 }}>✕</span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {comboResult.suggestions.slice(0, 5).map((s: GapAwareScore) => (
                  <div key={s.foodId} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 8,
                    background: s.gapCoveragePct >= 50 ? 'rgba(0,230,138,0.04)' : 'rgba(245,158,11,0.04)',
                    border: `1px solid ${s.gapCoveragePct >= 50 ? 'rgba(0,230,138,0.12)' : 'rgba(245,158,11,0.12)'}`,
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: `${s.color}15`, border: `1px solid ${s.color}25`, flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.gapsCovered}</span>
                      <span style={{ fontSize: 5, color: s.color + 'aa', lineHeight: 1 }}>{s.totalGaps > 0 ? `/ ${s.totalGaps}` : ''}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 8, fontWeight: 600, color: '#fff' }}>{s.foodName}</div>
                      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)' }}>
                        {s.gapNutrients.slice(0, 3).map((n: string) => {
                          const gap = gapResult.gaps.find(g => g.nutrient === n);
                          return gap?.label || n;
                        }).join(', ')}
                        {s.gapNutrients.length > 3 && <span style={{ color: 'rgba(255,255,255,0.3)' }}> +{s.gapNutrients.length - 3}</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', flexShrink: 0, textAlign: 'right' }}>
                      {s.kcal} ккал<br/>
                      <span style={{ color: '#00e68a', fontWeight: 600 }}>{s.recommendedGrams}г</span>
                    </div>
                    {selectedMealForTargeting !== null && (
                      <button onClick={() => handleApplyCombo(s.foodId, s.recommendedGrams)} style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 7, fontWeight: 600, cursor: 'pointer',
                        background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a', flexShrink: 0,
                      }}>+</button>
                    )}
                  </div>
                ))}
              </div>
              {Array.isArray(comboResult.suggestions) && comboResult.suggestions.length === 0 && (
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: 8 }}>
                  Все дефициты покрыты текущими продуктами
                </div>
              )}
            </div>
          )}

          <MealQuickControls mode={composerMode} advancedFilter={advancedFilter} gapResult={composerMode === 'targeting' ? gapResult : null} />

          <div style={{ display:'flex', gap:4, justifyContent:'center', flexWrap:'wrap' }}>
            {DAY_LABELS.map((label: string, idx: number) => {
              // E3-паритет: клик по дню = ПРОСМОТР существующего дня (неделя/3дн), регенерация только если дня нет
              const openDay = () => {
                setPlanDays(1); setSelectedDayIndex(idx);
                const weekDay = weekPlan?.days?.[idx];
                const threeDay = planDays === 3 ? threeDayPlan?.days?.[idx] : null;
                if (weekDay) { try { setDayPlan(JSON.parse(JSON.stringify(weekDay))); } catch { setDayPlan(weekDay); } }
                else if (threeDay) { try { setDayPlan(JSON.parse(JSON.stringify(threeDay))); } catch { setDayPlan(threeDay); } }
                else { generatePlan(1, undefined, idx); }
              };
              return (
                <button key={idx} onClick={openDay} style={{
                  padding:'6px 10px', borderRadius:20, cursor:'pointer', fontSize:10,
                  border: planDays===1 && selectedDayIndex===idx ? '2px solid #00e68a' : '1px solid #3f3f46',
                  background: planDays===1 && selectedDayIndex===idx ? 'rgba(0,230,138,0.15)' : '#202023',
                  color: planDays===1 && selectedDayIndex===idx ? '#00e68a' : 'rgba(255,255,255,0.7)',
                  fontWeight: planDays===1 && selectedDayIndex===idx ? 700 : 500,
                }}>{label}</button>
              );
            })}
          </div>

          <div style={{ display:'flex', gap:6, justifyContent:'center', marginBottom:6 }}>
            <button onClick={() => { setPlanDays(3); generatePlan(3); }} style={{
              padding:'4px 10px', borderRadius:12, cursor:'pointer', fontSize:8, fontWeight:600,
              background: planDays===3?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.03)',
              border: planDays===3?'1px solid rgba(0,230,138,0.25)':'1px solid rgba(255,255,255,0.06)',
              color: planDays===3?'#00e68a':'rgba(255,255,255,0.6)',
            }}>📅 3 дня</button>
            <button onClick={() => { setPlanDays(7); generatePlan(7); }} style={{
              padding:'4px 10px', borderRadius:12, cursor:'pointer', fontSize:8, fontWeight:600,
              background: planDays===7?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.03)',
              border: planDays===7?'1px solid rgba(0,230,138,0.25)':'1px solid rgba(255,255,255,0.06)',
              color: planDays===7?'#00e68a':'rgba(255,255,255,0.6)',
            }}>📅 Неделя</button>
          </div>

          {renderMealList ? (
            // FIX button-audit: dayIdx по единой конвенции — правки применяются к видимому дню
            renderMealList(dayPlan || (threeDayPlan?.days ? threeDayPlan.days[selectedDayIndex] : null) || (weekPlan?.days ? weekPlan.days[selectedDayIndex] : null), true,
              planDays === 7 ? selectedDayIndex + 7 : planDays === 3 ? selectedDayIndex + 1 : 0)
          ) : (
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', textAlign:'center', padding:20 }}>
              Выберите день для просмотра состава приёмов
            </div>
          )}

          {recipePickerMeal && generated && dayPlan && (
            <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.7)', padding:'12px' }}
              onClick={() => setRecipePickerMeal(null)}>
              <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:400, padding:'14px 20px 28px', borderRadius:'20px', background:'#18181b', boxShadow:'0 18px 54px rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.15)', margin:'0 auto 16px' }} />
                <div style={{ fontSize:14, fontWeight:700, color:'#fff', marginBottom:4 }}>🍳 Заменить «{recipePickerMeal.label}» рецептом</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:12 }}>Подходящие рецепты</div>
                <div style={{ maxHeight:300, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
                  {sortedPickerRecipes.length === 0 ? (
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', textAlign:'center', padding:10 }}>Нет рецептов для этого приёма.</div>
                  ) : sortedPickerRecipes.map((r: any, i: number) => (
                    <div key={i} style={{ display:'flex', gap:4, alignItems:'stretch' }}>
                      <span onClick={(e) => { e.stopPropagation(); toggleFavoriteRecipe(r.name); }} title={isFavoriteRecipe(r.name) ? 'Убрать из избранного' : 'В избранное (приоритет в подборе)'} style={{ display:'flex', alignItems:'center', justifyContent:'center', width:30, borderRadius:12, cursor:'pointer', background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color: isFavoriteRecipe(r.name) ? '#f59e0b' : 'rgba(255,255,255,0.3)', fontSize:13 }}>{isFavoriteRecipe(r.name) ? '⭐' : '☆'}</span>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); replaceMealWithRecipe(r, recipePickerMeal.mealIdx, recipePickerMeal.dayIdx); setRecipePickerMeal(null); }} style={{ flex:1, padding:'10px 12px', borderRadius:12, cursor:'pointer', textAlign:'left', background:'#202023', border:`1px solid ${isFavoriteRecipe(r.name) ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.06)'}`, color:'#fff', fontSize:9 }}>
                        <div style={{ fontWeight:700, color:'#a78bfa', fontSize:10, marginBottom:2 }}>{isFavoriteRecipe(r.name) ? '⭐ ' : ''}{r.name}</div>
                        <div style={{ color:'rgba(255,255,255,0.85)' }}>⏱{r.prepTimeMin}мин · {r.kcal}ккал · Б{r.protein}/Ж{r.fat}/У{r.carbs}</div>
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setRecipePickerMeal(null)} style={{ width:'100%', marginTop:8, padding:'6px', borderRadius:8, cursor:'pointer', border:'1px solid rgba(255,255,255,0.06)', background:'#202023', color:'rgba(255,255,255,0.85)', fontSize:8, fontWeight:600 }}>✕ Отмена</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MealComposer;

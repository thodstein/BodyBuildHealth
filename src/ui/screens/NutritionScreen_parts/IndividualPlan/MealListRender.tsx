/**
 * MealListRender.tsx — P1-7: renderMealList вынесен из IndividualPlanContext.tsx (267 строк).
 *
 * Хук useRenderMealList() возвращает функцию рендера, которая использует контекст планировщика.
 * В IndividualPlanContext: const renderMealList = useRenderMealList();
 */
import React, { useState } from "react";
import { addToCart } from "../../../../core/nutrition-utils";
import { FOOD_DB } from "../../../../core/nutrition-database";
import { calcMealDIAAS } from "../../../../engines/product-usefulness-v2.engine";
import { scoreFoodsForKBJU, getMealKBJUTarget, getMealCurrentKBJU } from "../../../../engines/kbju-food-match.engine";
import type { PlanCtx } from "./IndividualPlanContext";
import { NUTRITION_LEVELS } from "./types";
import { OrganLoadBadgeGroup } from "./OrganLoadBadges";
import { readDiaryV2, writeDiaryV2 } from "../diary-storage-v2";
import { kbjuFormulaDeviationPct, RECIPE_PRESETS, recipeMatchesPreset } from "./planner-recipe-mode";

// FIX week-perf: кэш тяжёлых метрик приёма (DIAAS/GL/II) по объекту приёма.
// Объекты приёмов иммутабельны (заменяются при правках), поэтому WeakMap-кэш всегда валиден
// и избавляет от пересчёта DIAAS/GL/II на КАЖДЫЙ рендер (drag/печать/ввод веса).
// Оформление не меняется — только вычисления.
const _mealMetricsCache = new WeakMap<object, { diaas: number; gl: number; ii: number }>();
const _dayMicrosCache = new WeakMap<object, { visibleMicros: any[] } | null>();
// FIX week-perf: findSimilarFoods сканирует FOOD_DB+сортирует — кэш по объекту продукта
const _similarFoodsCache = new WeakMap<object, any[]>();

// Этап 3 (Пробел-1): редактирование времени — теперь через современный модал (без window.prompt)
function useMealTimeEdit(plan: any, saveUndo: () => void, setDayPlan: (v:any)=>void) {
  const [edit, setEdit] = React.useState<{ idx:number; value:string } | null>(null);
  const open = (idx:number) => {
    const cur = plan?.meals?.[idx]?.time || '12:00';
    setEdit({ idx, value: cur });
  };
  const confirm = () => {
    if (!edit) return;
    const res = edit.value.trim();
    const mt = res.split(':');
    if (mt.length !== 2) return;
    const h = parseInt(mt[0],10), mm = parseInt(mt[1],10);
    if (isNaN(h)||isNaN(mm)||h<0||h>23||mm<0||mm>59) return;
    const nt = `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
    saveUndo();
    setDayPlan((prev:any)=>{
      if(!prev) return prev;
      const meals = prev.meals.slice();
      if (meals[edit.idx]) meals[edit.idx] = Object.assign({}, meals[edit.idx], { time: nt });
      const totals={kcal:meals.reduce((s:number,m:any)=>s+(m.totals?.kcal||0),0),p:meals.reduce((s:number,m:any)=>s+(m.totals?.p||0),0),f:meals.reduce((s:number,m:any)=>s+(m.totals?.f||0),0),c:meals.reduce((s:number,m:any)=>s+(m.totals?.c||0),0)};
      return { ...prev, meals, totals };
    });
    setEdit(null);
  };
  const modal = edit ? (
    <div onClick={e=>{ if(e.target===e.currentTarget) setEdit(null); }} style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ width:'100%', maxWidth:340, padding:18, borderRadius:16, background:'linear-gradient(135deg,#1a1c26 0%,#18181b 100%)', border:'1px solid rgba(59,130,246,0.22)', boxShadow:'0 16px 40px rgba(0,0,0,0.5)', backdropFilter:'blur(16px)' }}>
        <div style={{ fontSize:13, fontWeight:800, color:'#60a5fa', marginBottom:4 }}>🕒 Время приёма</div>
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginBottom:10 }}>ЧЧ:ММ — например 12:30</div>
        <input type="time" value={edit.value} onChange={e=>setEdit({ ...edit, value:e.target.value })} autoFocus style={{ width:'100%', boxSizing:'border-box', padding:'10px 12px', borderRadius:10, background:'#202023', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:16, outline:'none' }} />
        <div style={{ display:'flex', gap:8, marginTop:12 }}>
          <button onClick={()=>setEdit(null)} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.7)', fontWeight:600, cursor:'pointer' }}>Отмена</button>
          <button onClick={confirm} style={{ flex:1, padding:'10px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#3b82f6,#60a5fa)', color:'#fff', fontWeight:700, cursor:'pointer' }}>Сохранить</button>
        </div>
      </div>
    </div>
  ) : null;
  return { open, modal };
}

export function useRenderMealList(ctx: Omit<PlanCtx, 'renderMealList'>) {
  const { calcTargets, dayPlan, draggedItem, dropTarget, drugCompatReport, editAmount, editItem, effectiveC, effectiveF, effectiveKcal, effectiveP, excludedFoods, findSimilarFoods, healthIssues, injections, linkToTraining, lockedFoodIds, moveFoodItem, nutritionReport, nutrLevel, phase, plannerMode, preferredFoods, quickAddMealIdx, quickAddSearch, removeFoodItem, replaceFoodItem, replacingItem, saveUndo, setDayPlan: _setDayPlan, setDraggedItem, setDropTarget, setEditAmount: _setEditAmount, setEditItem, setExcludedFoods, setQuickAddMealIdx, setQuickAddSearch, setRecipePickerMeal, setReplacingItem, toggleLockFood, trainEnd, trainStart, updateItemAmount, waterCalc, weight, weightLogEntries, addFoodToMeal, addSnackComboToMeal, generationMode, pickRecipeOption, moreRecipeOptions, refreshRecipeSuggestions, favoriteRecipes, toggleFavoriteRecipe, isFavoriteRecipe } = ctx;
  const _nutrMult = NUTRITION_LEVELS.find(l => l.id === nutrLevel)?.mult || 1.0;
  const setDayPlan = _setDayPlan as any;
  const setEditAmount = _setEditAmount as any;
  const timeEdit = useMealTimeEdit(dayPlan, saveUndo, setDayPlan);
  // UX чипов: пресеты рецептов (масса = большое У, сушка, белок…)
  const [recipePreset, setRecipePreset] = useState<string | null>(null);
  const _planKeyRef = React.useRef<string>('');
  try {
    const planKey = `${dayPlan?.totals?.kcal || 0}-${(dayPlan?.meals || []).length}`;
    if (_planKeyRef.current && _planKeyRef.current !== planKey && recipePreset) setRecipePreset(null);
    _planKeyRef.current = planKey;
  } catch {}
  // Чипы пресетов: показывать только если ≥2 активных; рендер-хелпер
  const renderPresetRow = (pool: any[]) => {
    const activePresets = RECIPE_PRESETS.filter(p => pool.some(o => p.match(o)));
    if (activePresets.length < 2) return null;
    const visibleCount = pool.filter((r: any) => recipeMatchesPreset(r, recipePreset)).length;
    return (
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 2, alignItems: 'center' }}>
        {activePresets.map(p => (
          <span key={p.id} title={p.hint} onClick={() => setRecipePreset(recipePreset === p.id ? null : p.id)} style={{ cursor: 'pointer', padding: '1px 6px', borderRadius: 6, fontSize: 7, fontWeight: 700, border: `1px solid ${recipePreset === p.id ? 'rgba(249,115,22,0.55)' : 'rgba(249,115,22,0.18)'}`, background: recipePreset === p.id ? 'rgba(249,115,22,0.15)' : 'transparent', color: recipePreset === p.id ? '#fb923c' : 'rgba(255,255,255,0.6)' }}>{p.label}</span>
        ))}
        {recipePreset && (
          <>
            <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)' }}>{visibleCount}/{pool.length}</span>
            <span onClick={() => setRecipePreset(null)} title="Сбросить фильтр" style={{ cursor: 'pointer', fontSize: 8, color: '#fb923c', padding: '0 3px', fontWeight: 800 }}>✕</span>
          </>
        )}
      </div>
    );
  };
  return (dayData: any, editable = false, dayIdx = 0) => {
    if (!dayData) return null;
    const d = dayData; const totalKcal = Math.round(d.totals?.kcal || 0); const totalP = Math.round(d.totals?.p || 0); const totalF = Math.round(d.totals?.f || 0); const totalC = Math.round(d.totals?.c || 0); const totalFiber = Math.round(d.totals?.fiber || 0);
    const pKcalPct = totalKcal > 0 ? (totalP * 4 / totalKcal) * 100 : 0; const fKcalPct = totalKcal > 0 ? (totalF * 9 / totalKcal) * 100 : 0; const cKcalPct = totalKcal > 0 ? (totalC * 4 / totalKcal) * 100 : 0;
    return (
      <div>
        {/* ИНВАРИАНТ per100 — обязательно сверху плана */}
        <div style={{marginBottom:8,padding:'8px 10px',borderRadius:10,background:'rgba(0,230,138,0.06)',border:'1px solid rgba(0,230,138,0.18)',fontSize:8,color:'rgba(255,255,255,0.85)',lineHeight:1.4}}>
          <span style={{fontWeight:800,color:'#00e68a'}}>ⓘ per100</span> — все КБЖУ на <b>100г съедобной части в указанном виде</b>: <span style={{color:'#00e68a'}}>готовый</span> (варёный/запечённый 100г готового), <span style={{color:'#f59e0b'}}>сухой</span> (крупа 100г сухого), <span style={{color:'#a78bfa'}}>порошок</span> (whey 100г порошка), <span style={{color:'#60a5fa'}}>как есть</span> (фрукт/орех). `КБЖУ_порции = per100 × граммы/100`. Граммы в плане — честный вес в этом виде.
        </div>
        <div style={{marginBottom:10,borderRadius:12,overflow:'hidden',border:d.isTrainingDay?'1px solid rgba(0,230,138,0.2)':'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{padding:'10px 12px',background:d.isTrainingDay?'linear-gradient(135deg, rgba(0,230,138,0.1), rgba(0,200,160,0.03))':'#202023'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <span style={{fontSize:20,filter:d.isTrainingDay?'none':'grayscale(0.5)'}}>{d.isTrainingDay?'🏋️':'😴'}</span>
              <div style={{flex:1}}><div style={{fontSize:12,fontWeight:800,color:d.isTrainingDay?'#00e68a':'rgba(255,255,255,0.85)'}}>{d.isTrainingDay?'🏆 ТРЕНИРОВОЧНЫЙ ДЕНЬ':'😴 ДЕНЬ ОТДЫХА'}</div> {plannerMode === 'pro' && <span style={{fontSize:10,fontWeight:700,color:'#a78bfa',background:'rgba(167,139,250,0.12)',padding:'1px 5px',borderRadius:6,border:'1px solid rgba(167,139,250,0.25)',marginLeft:4,verticalAlign:'middle'}}>Pro движок</span>}
              {weightLogEntries.length >= 3 && (() => { const vals = weightLogEntries.map(e => e.weight); const min = Math.min(...vals); const max = Math.max(...vals); const range = max - min || 1; const h = 24; const w = 80; const pts = vals.map((v,i) => `${Math.round(i/(vals.length-1)*w)},${Math.round(h-(v-min)/range*h)}`).join(' '); const trend = vals.length >= 2 && vals[vals.length-1] < vals[0]; return (<div style={{display:'inline-flex',alignItems:'center',gap:3,marginLeft:6}}><svg width={w} height={h} style={{verticalAlign:'middle'}}><polyline points={pts} fill="none" stroke={trend?'#22c55e':'#ef4444'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/></svg><span style={{fontSize:10,color:trend?'#22c55e':'#ef4444',fontWeight:600}}>{trend?'↓':'↑'} {Math.abs(vals[vals.length-1]-vals[0]).toFixed(1)} кг</span></div>); })()}</div>
              <div style={{padding:'4px 10px',borderRadius:8,background:d.isTrainingDay?'rgba(0,230,138,0.1)':'rgba(255,255,255,0.03)',border:d.isTrainingDay?'1px solid rgba(0,230,138,0.2)':'1px solid rgba(255,255,255,0.06)'}}>
                <div style={{fontSize:16,fontWeight:900,color:Math.abs(totalKcal-(effectiveKcal||0))<=Math.max(50,(effectiveKcal||0)*0.08)?'#00e68a':'#f59e0b',lineHeight:1}}>{totalKcal}<span style={{fontSize:8,fontWeight:400,color:'rgba(255,255,255,0.5)'}}>/{effectiveKcal||'---'}</span></div>
                {effectiveKcal>0 && (() => { const dk=Math.round(totalKcal-effectiveKcal); const dkp=Math.round((totalKcal-effectiveKcal)/effectiveKcal*100); const ok=Math.abs(dk)<=Math.max(50,Math.round(effectiveKcal*0.05)); return <div style={{fontSize:10,fontWeight:700,color:ok?'#22c55e':(dk>0?'#f59e0b':'#60a5fa')}}>Δ{dk>=0?'+':''}{dk} ({dk>=0?'+':''}{dkp}%)</div>; })()}
                <div style={{fontSize:10,color:'rgba(255,255,255,0.85)',textAlign:'center'}}>ккал</div>
              </div>
            </div>
                        <div style={{display:'flex',gap:8,fontSize:9,flexWrap:'wrap',alignItems:'center'}}>
              {(() => {
                // КБЖУ: Цель/Факт/Δ явно — расхождение должно быть понятным, а не «непонятный перебор»
                const fmt = (val:number, tgt:number, unit:string) => {
                  if (!tgt) return `${val}${unit}`;
                  const d = Math.round(val - tgt);
                  const dp = Math.round((val - tgt) / tgt * 100);
                  const ok = Math.abs(d) <= Math.max(5, Math.round(tgt * 0.05));
                  const col = ok ? '#22c55e' : (d > 0 ? '#f59e0b' : '#60a5fa');
                  return <><b style={{fontWeight:800}}>{val}{unit}</b><span style={{fontSize:10,color:'rgba(255,255,255,0.45)'}}>/{tgt}{unit}</span> <span style={{fontSize:10,color:col,fontWeight:700}}>Δ{d>=0?'+':''}{d}{unit} ({d>=0?'+':''}{dp}%)</span></>;
                };
                return <>
                  <span style={{color:'#3b82f6',fontWeight:600}}>💪 Б {fmt(totalP, effectiveP||0, 'г')}</span>
                  <span style={{color:'#f59e0b',fontWeight:600}}>🧈 Ж {fmt(totalF, effectiveF||0, 'г')}</span>
                  <span style={{color:'#f97316',fontWeight:600}}>🌾 У {fmt(totalC, effectiveC||0, 'г')}</span>
                  {totalFiber > 0 && <span style={{color:'#22c55e',fontSize:8,fontWeight:600}}>🌱 {totalFiber}г</span>}
                  {/* A3: консистентность КБЖУ — расхождение калорийности с формулой 4Б+9Ж+4У ≤3% */}
                  {totalKcal > 0 && (() => { const dev = Math.round(kbjuFormulaDeviationPct(totalKcal, totalP, totalF, totalC) * 10) / 10; const ok = dev <= 3; return (
                    <span title={`Расхождение ккал с формулой 4×Б + 9×Ж + 4×У (норма ≤3%): формула ≈ ${Math.round((totalP*4+totalF*9+totalC*4))} ккал`} style={{fontSize:8,fontWeight:700,padding:'1px 6px',borderRadius:5,border:`1px solid ${ok?'rgba(34,197,94,0.35)':'rgba(245,158,11,0.4)'}`,background:ok?'rgba(34,197,94,0.08)':'rgba(245,158,11,0.1)',color:ok?'#22c55e':'#f59e0b'}}>⚖️ формула ±{dev}%</span>
                  ); })()}
                  <span style={{marginLeft:'auto',color:'rgba(255,255,255,0.85)'}}>{weight>0?`${Math.round(totalP/weight)}г/кг`:''}</span>
                </>;
              })()}
            </div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.42)',marginTop:3,lineHeight:1.3}}>
              Цель собрана из: база <b style={{color:'#3b82f6'}}>{calcTargets.protein}г</b> · множ. уровня <b style={{color:'#00e68a'}}>{(_nutrMult||1).toFixed(2)}×</b> · фаза «<b style={{color:'#a78bfa'}}>{phase}</b>»{injections.some(i=>i.type==='ААС')?(' · +AAS ' + Math.round(weight*0.3) + 'г'):''} → итого <b style={{color:'#fff'}}>{effectiveP}г</b> белка / <b style={{color:'#fff'}}>{effectiveKcal}</b> ккал
            </div>
          </div>
          {nutritionReport && (() => { const r = nutritionReport; const chip = (ok: boolean, label: string, val: string) => (<div style={{display:'inline-flex',alignItems:'center',gap:3,padding:'2px 6px',borderRadius:6,fontSize:10,fontWeight:600,background:ok?'rgba(0,230,138,0.08)':'rgba(245,158,11,0.08)',border:`1px solid ${ok?'rgba(0,230,138,0.2)':'rgba(245,158,11,0.25)'}`,color:ok?'#22c55e':'#f59e0b'}}><span style={{width:5,height:5,borderRadius:'50%',background:ok?'#22c55e':'#f59e0b'}} />{label} {val}</div>); const mpsOk = (r.proteinTiming?.evennessScore||0) >= 70; const fibOk = (r.fiberAnalysis?.pct||0) >= 80; const glOk = r.glycemicLoad?.status !== 'high'; const satOk = (r.fatQuality?.satPct||0) <= 15; const nakOk = r.sodiumPotassium?.status === 'ok'; const pralOk = r.pral?.status === 'ok' || r.pral?.status === 'mild'; const o3 = r.fatQuality?.omega3G||0; const o3Ok = o3 >= 1.6; return (<div style={{marginTop:6,padding:'6px 8px',borderRadius:8,background:'rgba(139,92,246,0.04)',border:'1px solid rgba(139,92,246,0.12)'}}><div style={{fontSize:8,fontWeight:700,color:'#a78bfa',marginBottom:4}}>🩺 Диетология</div><div style={{display:'flex',flexWrap:'wrap',gap:4}}>{chip(mpsOk,'MPS',(r.proteinTiming?.evennessScore||0).toFixed(0)+'%')}{chip(fibOk,'Клетч.',(r.fiberAnalysis?.totalG||0).toFixed(0)+'г')}{chip(glOk,'ГН',r.glycemicLoad?.status==='high'?'выс.':r.glycemicLoad?.status==='low'?'низк.':'норма')}{chip(satOk,'Нас.жир',(r.fatQuality?.satPct||0).toFixed(0)+'%')}{chip(nakOk,'Na:K',(r.sodiumPotassium?.ratio||0).toFixed(1)+':1')}{chip(pralOk,'PRAL',(r.pral?.mEq||0)+'мэкв')}{chip(o3Ok,'Ω3',o3.toFixed(1)+'г')}</div></div>); })()}
          {drugCompatReport?.warnings && drugCompatReport.warnings.length > 0 && drugCompatReport.warnings[0] && !drugCompatReport.warnings[0].includes('совместимы') && (<div style={{marginTop:6,padding:'6px 8px',borderRadius:8,background:'rgba(239,68,68,0.04)',border:'1px solid rgba(239,68,68,0.12)'}}><div style={{fontSize:8,fontWeight:700,color:'#ef4444',marginBottom:4}}>⚠ Лекарства × питание</div>{drugCompatReport.warnings.slice(0,4).map((w: string, i: number) => <div key={i} style={{fontSize:10,color:'rgba(255,255,255,0.75)',marginBottom:2}}>{w}</div>)}</div>)}

          <div style={{height:4,display:'flex'}}>
            <div style={{height:'100%',width:`${Math.max(2,pKcalPct)}%`,background:'#3b82f6',minWidth:2}}/>
            <div style={{height:'100%',width:`${Math.max(2,fKcalPct)}%`,background:'#f59e0b',minWidth:2}}/>
            <div style={{height:'100%',width:`${Math.max(2,cKcalPct)}%`,background:'#f97316',minWidth:2,flex:1}}/>
          </div>
        </div>
        {d.allergenWarnings?.length > 0 && <div style={{padding:'6px 10px',borderRadius:8,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',fontSize:8,color:'#ef4444',marginBottom:8,display:'flex',alignItems:'center',gap:4}}><span style={{fontSize:10}}>⚠️</span><span>{d.allergenWarnings.map((w: any) => typeof w === 'string' ? w : `${w.food}: ${w.allergens.join(', ')}`).join('; ')}</span></div>}
        {d.meals.map((m: any, mi: number) => {
          const mealKcal = Math.round(m.totals?.kcal || 0); const mealP = Math.round(m.totals?.p || 0); const mealF = Math.round(m.totals?.f || 0); const mealC = Math.round(m.totals?.c || 0);
          // FIX week-perf: метрики считаются один раз на объект приёма (WeakMap)
           let _mm = plannerMode === 'pro' ? _mealMetricsCache.get(m) : undefined;
           if (plannerMode === 'pro' && !_mm) {
            _mm = {
              diaas: calcMealDIAAS((m.items || []).map((it: any) => ({ foodId: it.id || it.name, weightGrams: it.amount || 100 }))).diaas,
              gl: Math.round((m.items || []).reduce((s: number, it: any) => { const fd = FOOD_DB.find((f: any) => f.id === it.id); const gi = fd?.gi || 0; return s + (gi * (it.c || 0) / 100); }, 0)),
              ii: (() => { let wII = 0, wK = 0; (m.items || []).forEach((it: any) => { const fd = FOOD_DB.find((f: any) => f.id === it.id); const ii = fd?.macro_100g?.insulin_index; const k = it.kcal || 0; if (ii != null && k > 0) { wII += ii * k; wK += k; } }); return wK > 0 ? Math.round(wII / wK) : 0; })(),
            };
            _mealMetricsCache.set(m, _mm);
          }
           const mealDiaas = { diaas: _mm?.diaas || 0 };
           const mealGL = _mm?.gl || 0;
           const mealII = _mm?.ii || 0;
          const isPreWorkout = m.label?.toLowerCase().includes('предтрен') || m.type === 'preworkout'; const isPostWorkout = m.label?.toLowerCase().includes('пост-трен') || m.type === 'postworkout'; const isIntraWorkout = m.type === 'intra' || m.label?.toLowerCase().includes('intra'); const accentColor = isPreWorkout ? '#8b5cf6' : isPostWorkout ? '#f59e0b' : isIntraWorkout ? '#22c55e' : '#00e68a';
          return (
            <div key={mi} style={{marginBottom:6,borderRadius:10,overflow:'hidden',border:`1px solid ${dropTarget===mi?'rgba(0,230,138,0.4)':isPreWorkout?'rgba(139,92,246,0.2)':isPostWorkout?'rgba(245,158,11,0.2)':isIntraWorkout?'rgba(34,197,94,0.2)':'rgba(255,255,255,0.15)'}`,transition:'all 0.2s',background:dropTarget===mi?'rgba(0,230,138,0.04)':undefined}}
              onDragOver={e=>{e.preventDefault();setDropTarget(mi);}} onDragLeave={()=>setDropTarget(null)} onDrop={e=>{e.preventDefault();if(draggedItem&&draggedItem.mealIdx!==mi)moveFoodItem(draggedItem.mealIdx,mi,draggedItem.itemIdx, dayIdx);setDropTarget(null);}}>
              <div style={{padding:'7px 10px 5px',background:isPreWorkout?'rgba(139,92,246,0.06)':isPostWorkout?'rgba(245,158,11,0.06)':isIntraWorkout?'rgba(34,197,94,0.06)':'#202023',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.04)',flexWrap:'wrap',gap:4,wordBreak:'break-word'}}>
                <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                  <span style={{fontSize:8,fontWeight:600,color:'rgba(255,255,255,0.85)'}}>{m.time}</span>
                  <span style={{width:3,height:12,borderRadius:2,background:accentColor}}/>
                  <span style={{fontSize:10,fontWeight:700,color:accentColor}}>{m.label}</span>
                  {isPreWorkout&&<span style={{fontSize:10,padding:'1px 5px',borderRadius:4,background:'rgba(139,92,246,0.15)',color:'#a855f7',fontWeight:600}}>ДО</span>}
                  {isPostWorkout&&<span style={{fontSize:10,padding:'1px 5px',borderRadius:4,background:'rgba(245,158,11,0.15)',color:'#f59e0b',fontWeight:600}}>ПОСЛЕ</span>}
                  {isIntraWorkout&&<span style={{fontSize:10,padding:'1px 5px',borderRadius:4,background:'rgba(34,197,94,0.15)',color:'#22c55e',fontWeight:600}}>ВО ВРЕМЯ</span>}
                  {(m.type==='snack'||m.type==='snack2'||m.type==='snack3'||m.type==='snack4')&&<span onClick={()=>addSnackComboToMeal(dayIdx, mi)} title="Добавить протеин-порошок + овсяные хлопья" style={{fontSize:10,padding:'1px 5px',borderRadius:4,background:'rgba(167,139,250,0.12)',border:'1px solid rgba(167,139,250,0.25)',color:'#a78bfa',cursor:'pointer',fontWeight:600}}>🥣 Порошок+хлопья</span>}
                  {d.timingScores?.[mi] && (
                    <span style={{fontSize:10,padding:'1px 5px',borderRadius:4,fontWeight:600,
                      background:d.timingScores[mi].status==='ideal'?'rgba(34,197,94,0.1)':d.timingScores[mi].status==='good'?'rgba(245,158,11,0.1)':'rgba(239,68,68,0.08)',
                      color:d.timingScores[mi].status==='ideal'?'#22c55e':d.timingScores[mi].status==='good'?'#f59e0b':'#ef4444',
                      border:`1px solid ${d.timingScores[mi].status==='ideal'?'rgba(34,197,94,0.2)':d.timingScores[mi].status==='good'?'rgba(245,158,11,0.2)':'rgba(239,68,68,0.12)'}`}}
                      title={d.timingScores[mi].note}
                    >★{d.timingScores[mi].score}/10</span>
                  )}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:4}}>
                  <span style={{fontSize:10,fontWeight:800,color:'rgba(255,255,255,0.85)'}}>{mealKcal} ккал</span>
                  <span onClick={()=>timeEdit.open(mi)} style={{fontSize:10,padding:'2px 5px',borderRadius:4,background:'rgba(59,130,246,0.06)',border:'1px solid rgba(59,130,246,0.12)',color:'#60a5fa',cursor:'pointer',fontWeight:600}} title="Изменить время приёма">🕒</span>
                  <span onClick={()=>setRecipePickerMeal({dayIdx,mealIdx:mi,label:m.label})} style={{fontSize:10,padding:'2px 5px',borderRadius:4,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.15)',color:'#a78bfa',cursor:'pointer',fontWeight:600}}>🍳</span>
                  <span onClick={()=>{setQuickAddMealIdx(mi);setQuickAddSearch('');}} style={{fontSize:10,padding:'2px 5px',borderRadius:4,background:'rgba(0,230,138,0.08)',border:'1px solid rgba(0,230,138,0.15)',color:'#00e68a',cursor:'pointer',fontWeight:600}}>+</span>
                  <span onClick={()=>{ try { const date=new Date().toISOString().slice(0,10); const data=readDiaryV2(); if(!data[date]) data[date]={meals:{}}; const label=m.label||'Приём пищи'; if(!data[date].meals[label]) data[date].meals[label]=[]; (m.items||[]).forEach((it:any)=>{(data[date].meals[label] as any).push({ name:it.name, qty:`${it.amount||100} г` as any, kcal:Math.round(it.kcal||0), p:Math.round((it.p||0)*10)/10, f:Math.round((it.f||0)*10)/10, c:Math.round((it.c||0)*10)/10, category:it.category, foodId:it.id, micros:it.micros });}); writeDiaryV2(data); if(typeof (window as any).showToast==='function') (window as any).showToast(`📒 ${label} → дневник`); } catch {} }} style={{fontSize:10,padding:'2px 5px',borderRadius:4,background:'rgba(0,230,138,0.06)',border:'1px solid rgba(0,230,138,0.2)',color:'#00e68a',cursor:'pointer',fontWeight:600}} title="Добавить приём в дневник">📒</span>
                  <span onClick={()=>{saveUndo();const copy=JSON.parse(JSON.stringify(dayPlan?.meals?.[mi]));if(!copy)return;setDayPlan((prev:any)=>{if(!prev)return prev;const meals=[...prev.meals];const insertAt=Math.min(mi+1,meals.length);const dup={...copy,label:copy.label+' (копия)',time:(()=>{const[h,m]=(copy.time||'12:00').split(':').map(Number);const t=h*60+m+30;return`${String(Math.floor(t/60)%24).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`})()};meals.splice(insertAt,0,dup);const totals={kcal:meals.reduce((s:number,m2:any)=>s+(m2.totals?.kcal||0),0),p:meals.reduce((s:number,m2:any)=>s+(m2.totals?.p||0),0),f:meals.reduce((s:number,m2:any)=>s+(m2.totals?.f||0),0),c:meals.reduce((s:number,m2:any)=>s+(m2.totals?.c||0),0)};return{...prev,meals,totals}});}} style={{fontSize:10,padding:'2px 5px',borderRadius:4,background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.12)',color:'#818cf8',cursor:'pointer',fontWeight:600}}>📋</span>
                  <span onClick={()=>{saveUndo();setDayPlan((prev:any)=>{if(!prev)return prev;const meals=prev.meals.filter((_:any,i:number)=>i!==mi);const totals={kcal:meals.reduce((s:number,m2:any)=>s+(m2.totals?.kcal||0),0),p:meals.reduce((s:number,m2:any)=>s+(m2.totals?.p||0),0),f:meals.reduce((s:number,m2:any)=>s+(m2.totals?.f||0),0),c:meals.reduce((s:number,m2:any)=>s+(m2.totals?.c||0),0)};return{...prev,meals,totals}});}} style={{fontSize:10,padding:'2px 5px',borderRadius:4,background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.12)',color:'#ef4444',cursor:'pointer',fontWeight:600}}>✕</span>
                </div>
              </div>
              <div style={{padding:'6px 10px 8px',background:'#18181b'}}>
                <div style={{display:'flex',flexWrap:'wrap',gap:3}}>{m.items.map((it:any,ii:number)=>{const isEditing=editItem?.mealIdx===mi&&editItem?.itemIdx===ii;const isReplacing=replacingItem?.mealIdx===mi&&replacingItem?.itemIdx===ii;return<span key={ii} draggable={!isEditing&&!isReplacing} onDragStart={e=>{e.dataTransfer.setData('text/plain',`${mi}:${ii}`);setDraggedItem({mealIdx:mi,itemIdx:ii});}} style={{padding:'3px 6px',borderRadius:6,fontSize:8,background:isEditing?'rgba(59,130,246,0.08)':isReplacing?'rgba(245,158,11,0.08)':'#202023',border:`1px solid ${isEditing?'rgba(59,130,246,0.2)':isReplacing?'rgba(245,158,11,0.2)':'rgba(255,255,255,0.15)'}`,cursor:'grab',color:'#fff',display:'inline-flex',alignItems:'center',gap:3,flexWrap:'wrap'}}>
                    {isEditing?<><input type="number" defaultValue={it.amount} onChange={e=>setEditAmount(+e.target.value||0)} style={{width:40,padding:'1px 4px',borderRadius:3,border:'1px solid rgba(255,255,255,0.06)',background:'#18181b',color:'#fff',fontSize:8}}/><span style={{fontSize:10,color:'rgba(255,255,255,0.85)'}}>г</span><button onClick={()=>setEditAmount((prev: any) =>Math.round((prev||it.amount)+25))} style={{padding:'1px 3px',borderRadius:3,border:'1px solid rgba(59,130,246,0.2)',background:'rgba(59,130,246,0.08)',color:'#60a5fa',cursor:'pointer',fontSize:6}}>+25</button><button onClick={()=>setEditAmount((prev: any) =>Math.round((prev||it.amount)*2))} style={{padding:'1px 3px',borderRadius:3,border:'1px solid rgba(139,92,246,0.2)',background:'rgba(139,92,246,0.08)',color:'#a78bfa',cursor:'pointer',fontSize:6}}>×2</button><button onClick={()=>setEditAmount((prev: any) =>Math.round((prev||it.amount)/2))} style={{padding:'1px 3px',borderRadius:3,border:'1px solid rgba(245,158,11,0.2)',background:'rgba(245,158,11,0.08)',color:'#f59e0b',cursor:'pointer',fontSize:6}}>÷2</button><button onClick={()=>updateItemAmount(dayIdx,mi,ii,editAmount||it.amount)} style={{padding:'1px 4px',borderRadius:3,border:'none',background:'rgba(0,230,138,0.15)',color:'#00e68a',cursor:'pointer',fontSize:10}}>✓</button><button onClick={()=>setEditItem(null)} style={{padding:'1px 4px',borderRadius:3,border:'none',background:'rgba(239,68,68,0.1)',color:'#ef4444',cursor:'pointer',fontSize:10}}>✕</button></>
                    :isReplacing?<><span style={{fontWeight:600}}>{it.name}</span><select onChange={e=>{if(e.target.value){const f=FOOD_DB.find(x=>x.id===e.target.value);if(f)replaceFoodItem(dayIdx,mi,ii,f);}}} value="" style={{fontSize:10,padding:'1px 2px',borderRadius:3,border:'1px solid rgba(255,255,255,0.06)',background:'#18181b',color:'#fff',maxWidth:120}}><option value="">🔀 Заменить...</option>{(() => { let _sim = _similarFoodsCache.get(it); if (!_sim) { _sim = findSimilarFoods(it); _similarFoodsCache.set(it, _sim); } return _sim.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>); })()}</select></>
                    :<><span style={{fontWeight:600}}>{it.name}</span>{preferredFoods.includes(it.id)&&<span style={{fontSize:10,color:'#00e68a',padding:'0 1px'}} title="Любимый продукт">⭐</span>}<span style={{color:'rgba(255,255,255,0.9)',fontSize:8}}>{(() => { const food = FOOD_DB.find((f:any)=>f.id===it.id); const isPowder = food?.foodState==='powder' || (food?.category==='supplement' && it.amount<=80); if (isPowder) { const perScoop = (()=>{ try{ const m=(food?.servingSize||'').match(/(\d+(\.\d+)?)/); const v=m?parseFloat(m[1]):30; return v>0&&v<100?v:30;}catch{return 30}})(); const scoops=it.amount/perScoop; const sTxt = scoops===1?'1 скуп': scoops<1? scoops.toFixed(1)+' скупы' : Number.isInteger(scoops)? `${scoops} скупов` : `${scoops.toFixed(1)} скупов`; return `${it.amount}г (${sTxt})`; } return `${it.amount}г`; })()}</span>{(() => { const food = FOOD_DB.find((f: any) => f.id === it.id); return food ? <OrganLoadBadgeGroup food={food} healthIssues={healthIssues || []} /> : null; })()}{lockedFoodIds.has(it.id)&&<span style={{fontSize:10,color:'#f59e0b',padding:'0 2px'}} title="Закреплено — не изменится при регенерации">🔒</span>}<span onClick={()=>addToCart({name:it.name,kcal:it.kcal*(it.amount/100),amount:it.amount,category:it.category})} style={{cursor:'pointer',fontSize:10,color:'#00e68a',opacity:0.35,padding:'0 2px'}}>🛒</span><span onClick={()=>toggleLockFood(it.id)} style={{cursor:'pointer',fontSize:10,color:lockedFoodIds.has(it.id)?'#f59e0b':'rgba(255,255,255,0.4)',padding:'0 2px'}} title={lockedFoodIds.has(it.id)?'Открепить':'Закрепить (не изменится при регенерации)'}>{lockedFoodIds.has(it.id)?'🔓':'🔒'}</span><span onClick={()=>{setEditItem({dayIdx,mealIdx:mi,itemIdx:ii});setEditAmount(it.amount);}} style={{cursor:'pointer',fontSize:10,color:'rgba(255,255,255,0.8)',padding:'0 2px'}}>✏️</span><span onClick={()=>setReplacingItem({dayIdx,mealIdx:mi,itemIdx:ii})} style={{cursor:'pointer',fontSize:10,color:'rgba(245,158,11,0.4)',padding:'0 2px'}}>🔄</span><span onClick={()=>{ const upd = [...new Set([...excludedFoods, it.id])]; setExcludedFoods(upd); try { localStorage.setItem('he_excluded_foods', JSON.stringify(upd)); } catch {} removeFoodItem(dayIdx,mi,ii); }} style={{cursor:'pointer',fontSize:10,color:'rgba(239,68,68,0.45)',padding:'0 2px'}} title='Исключить навсегда — не появится в регенерациях'>🚫</span><span onClick={()=>removeFoodItem(dayIdx,mi,ii)} style={{cursor:'pointer',fontSize:10,color:'rgba(239,68,68,0.3)',padding:'0 2px'}} title='Убрать из этого плана'>✕</span></>}
                  </span>;})}</div>
                {m.totals&&<div style={{display:'flex',gap:6,marginTop:4,fontSize:8,alignItems:'center',flexWrap:'wrap'}}>{(() => { const tg = m.target; const fmt = (v: number, t: number|undefined, color: string) => { if (!t || t <= 0) return <span style={{color,fontWeight:600}}>{v}г</span>; const dev = v - t; const ok = Math.abs(dev) <= 3; return <span style={{color,fontWeight:600}}>{v}/{t}г{ok?null:<span style={{fontSize:6,color:dev>0?'#ef4444':'#f59e0b',fontWeight:700}}>{dev>0?('+'+Math.round(dev)):(''+Math.round(dev))}</span>}</span>; }; return <span style={{display:'contents'}}>{fmt(mealP,tg?.p,'#3b82f6')}<span style={{color:'rgba(255,255,255,0.2)',margin:'0 3px'}}>·</span>{fmt(mealF,tg?.f,'#f59e0b')}<span style={{color:'rgba(255,255,255,0.2)',margin:'0 3px'}}>·</span>{fmt(mealC,tg?.c,'#f97316')}</span>; })()}{plannerMode === 'pro' && mealDiaas.diaas > 0 && <span style={{fontSize:10,fontWeight:600,color:mealDiaas.diaas >= 1 ? '#22c55e' : mealDiaas.diaas >= 0.75 ? '#f59e0b' : '#ef4444',background:(mealDiaas.diaas >= 1 ? 'rgba(34,197,94,0.08)' : mealDiaas.diaas >= 0.75 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)') + ' none repeat scroll 0% 0%',padding:'1px 5px',borderRadius:4}}>DIAAS {mealDiaas.diaas.toFixed(2)}</span>}{plannerMode === 'pro' && mealGL > 0 && <span style={{fontSize:10,fontWeight:600,color:mealGL<10?'#22c55e':mealGL<=20?'#f59e0b':'#ef4444',background:(mealGL<10?'rgba(34,197,94,0.08)':mealGL<=20?'rgba(245,158,11,0.08)':'rgba(239,68,68,0.08)'),padding:'1px 5px',borderRadius:4}} title={'Glycemic Load: ' + mealGL + (isPostWorkout ? ' (high GL ok post-workout)' : '')}>GL {mealGL}</span>}{plannerMode === 'pro' && mealII > 0 && <span style={{fontSize:10,fontWeight:600,color:mealII<40?'#22c55e':mealII<=70?'#f59e0b':'#ef4444',background:(mealII<40?'rgba(34,197,94,0.08)':mealII<=70?'rgba(245,158,11,0.08)':'rgba(239,68,68,0.08)'),padding:'1px 5px',borderRadius:4}} title={'Insulin Index (kcal-weighted): ' + mealII}>II {mealII}</span>}{plannerMode === 'pro' && m.mpsCheck && m.mpsCheck.triggers_mTOR && <span style={{fontSize:10,fontWeight:600,color:'#00e68a',background:'rgba(0,230,138,0.08)',padding:'1px 5px',borderRadius:4}} title={'+' + m.mpsCheck.leucineG + 'g leucine, MPS triggered'}>{'\uD83E\uDDEC mTOR'}</span>}{plannerMode === 'pro' && m.mpsCheck && !m.mpsCheck.triggers_mTOR && m.mpsCheck.proteinG > 0 && <span style={{fontSize:10,fontWeight:600,color:'#f59e0b',background:'rgba(245,158,11,0.08)',padding:'1px 5px',borderRadius:4}} title={'Leucine ' + m.mpsCheck.leucineG + 'g < 2.5g threshold'}>{'\u26A0\uFE0F ' + m.mpsCheck.leucineG + 'g'}</span>}{m.synergyNotes&&m.synergyNotes.length>0&&<span style={{fontSize:10,color:'#22c55e',fontWeight:600}} title={m.synergyNotes.join('; ')}>✅ {(m.synergyNotes as string[]).length} синерги{((m.synergyNotes as string[]).length>1?'й':'я')}</span>}{m.conflictWarnings&&m.conflictWarnings.length>0&&<span style={{fontSize:10,color:'#ef4444',fontWeight:600}} title={m.conflictWarnings.join('; ')}>⚠️ {(m.conflictWarnings as string[]).length} конфликт{((m.conflictWarnings as string[]).length>1?'ов':'')}</span>}</div>}
                {Array.isArray(m.recipeOptions) && m.recipeOptions.length > 0 && (
                  <div style={{marginTop:4,display:'flex',flexDirection:'column',gap:3}}>
                    <div style={{fontSize:8,fontWeight:700,color:'#f97316',padding:'2px 0'}}>🍳 Варианты рецептов — выберите один, рацион перестроится:{m.recipeApplied ? <span style={{color:'#22c55e',fontWeight:600}}> выбрано «{m.recipeApplied}»</span> : null}</div>
                    {/* Пресеты подбора (масса = большое У, сушка, белок…) */}
                    {renderPresetRow(m.recipeOptions as any[])}
                    {(m.recipeOptions as any[]).filter((r:any)=>recipeMatchesPreset(r, recipePreset)).map((r: any, ri: number) => {
                      const selected = m.recipeApplied === r.name;
                      return (
                        <details key={ri} style={{borderRadius:8,background:selected?'rgba(34,197,94,0.08)':'rgba(249,115,22,0.06)',border:`1px solid ${selected?'rgba(34,197,94,0.35)':'rgba(249,115,22,0.12)'}`,overflow:'hidden'}}>
                          <summary style={{cursor:'pointer',padding:'3px 6px',fontSize:8,listStyle:'none',display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                            <span role="button" aria-label={`Выбрать рецепт ${r.name}`} onClick={(e)=>{e.preventDefault();e.stopPropagation();pickRecipeOption(dayIdx,mi,r.name);}} style={{padding:'2px 7px',borderRadius:6,border:`1px solid ${selected?'rgba(34,197,94,0.5)':'rgba(249,115,22,0.35)'}`,background:selected?'rgba(34,197,94,0.18)':'rgba(249,115,22,0.12)',color:selected?'#22c55e':'#f97316',fontWeight:800,cursor:'pointer'}}>{selected?'✅ Выбрано':'Выбрать'}</span>
                            <span role="button" aria-label={isFavoriteRecipe(r.name)?`Убрать ${r.name} из избранного`:`Добавить ${r.name} в избранное`} title="В избранное (⭐ — приоритет в подборе)" onClick={(e)=>{e.preventDefault();e.stopPropagation();toggleFavoriteRecipe(r.name);}} style={{cursor:'pointer',fontSize:10,color:isFavoriteRecipe(r.name)?'#f59e0b':'rgba(255,255,255,0.35)'}}>{isFavoriteRecipe(r.name)?'⭐':'☆'}</span>
                            <span style={{fontWeight:600,color:'#fff'}}>{r.name}</span>
                            <span style={{color:'rgba(255,255,255,0.65)'}}>{r.kcal}ккал · Б{r.protein}г Ж{r.fat}г У{r.carbs}г · ⏱{r.prepTimeMin}мин</span>
                          </summary>
                          <div style={{padding:'4px 6px',fontSize:7,color:'rgba(255,255,255,0.85)',lineHeight:1.5}}>
                            {r.description && <div style={{marginBottom:3,color:'rgba(255,255,255,0.65)'}}>{r.description}</div>}
                            {Array.isArray(r.ingredients) && r.ingredients.length > 0 && (
                              <div style={{marginBottom:3}}>
                                <span style={{color:'#f97316',fontWeight:600}}>Ингредиенты:</span>
                                <ul style={{margin:'2px 0 0 12px',padding:0}}>
                                  {r.ingredients.map((ing: string, ii: number) => <li key={ii} style={{fontSize:7}}>{ing}</li>)}
                                </ul>
                              </div>
                            )}
                            {Array.isArray(r.instructions) && r.instructions.length > 0 && (
                              <div>
                                <span style={{color:'#f97316',fontWeight:600}}>Как готовить:</span>
                                <ol style={{margin:'2px 0 0 12px',padding:0}}>
                                  {r.instructions.map((st: string, si: number) => <li key={si} style={{fontSize:7,marginBottom:2}}>{st}</li>)}
                                </ol>
                              </div>
                            )}
                          </div>
                        </details>
                      );
                    })}
                    <button onClick={()=>moreRecipeOptions(dayIdx,mi)} title="Подобрать другие варианты рецептов" style={{alignSelf:'flex-start',marginTop:1,padding:'2px 7px',borderRadius:6,border:'1px solid rgba(249,115,22,0.25)',background:'transparent',color:'#f97316',cursor:'pointer',fontSize:8,fontWeight:700}}>🔄 Другие варианты</button>
                  </div>
                )}
                {m.recipeSuggestions && Array.isArray(m.recipeSuggestions) && m.recipeSuggestions.length > 0 && (
                  <div style={{marginTop:4,display:'flex',flexDirection:'column',gap:3}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'2px 0'}}>
                      <div style={{fontSize:8,fontWeight:700,color:'#f97316'}}>🍲 Рецепты для этого приёма:</div>
                      <span onClick={()=>refreshRecipeSuggestions(dayIdx)} title="Подобрать другие рецепты" style={{cursor:'pointer',fontSize:9,padding:'1px 6px',borderRadius:5,border:'1px solid rgba(249,115,22,0.25)',color:'#f97316',fontWeight:700}}>🔄</span>
                    </div>
                    {/* Пресеты подбора — фиксированный набор */}
                    {renderPresetRow(m.recipeSuggestions as any[])}
                    {(m.recipeSuggestions as any[]).filter((r:any)=>recipeMatchesPreset(r, recipePreset)).slice(0, 3).map((r: any, ri: number) => (
                      <details key={ri} style={{borderRadius:8,background:'rgba(249,115,22,0.06)',border:'1px solid rgba(249,115,22,0.12)',overflow:'hidden'}}>
                        <summary style={{cursor:'pointer',padding:'3px 6px',fontSize:8,color:'#f97316',fontWeight:600,listStyle:'none'}}>
                          <span onClick={(e)=>{e.preventDefault();e.stopPropagation();toggleFavoriteRecipe(r.name);}} title="В избранное (⭐ — приоритет в подборе)" style={{cursor:'pointer',fontSize:10,color:isFavoriteRecipe(r.name)?'#f59e0b':'rgba(255,255,255,0.3)',marginRight:4}}>{isFavoriteRecipe(r.name)?'⭐':'☆'}</span>
                          {r.name} · {r.kcal}ккал · Б{r.protein}г Ж{r.fat}г У{r.carbs}г · ⏱{r.prepTimeMin}мин{r.usefulness?` · ⭐${r.usefulness}`:''}
                        </summary>
                        <div style={{padding:'4px 6px',fontSize:7,color:'rgba(255,255,255,0.8)',lineHeight:1.5}}>
                          {r.description && <div style={{marginBottom:3,color:'rgba(255,255,255,0.65)'}}>{r.description}</div>}
                          {Array.isArray(r.ingredients) && r.ingredients.length > 0 && (
                            <div style={{marginBottom:3}}>
                              <span style={{color:'#f97316',fontWeight:600}}>Ингредиенты:</span>
                              <ul style={{margin:'2px 0 0 12px',padding:0}}>
                                {r.ingredients.map((ing: string, ii: number) => <li key={ii} style={{fontSize:7}}>{ing}</li>)}
                              </ul>
                            </div>
                          )}
                          {Array.isArray(r.instructions) && r.instructions.length > 0 && (
                            <div>
                              <span style={{color:'#f97316',fontWeight:600}}>Как готовить:</span>
                              <ol style={{margin:'2px 0 0 12px',padding:0}}>
                                {r.instructions.map((step: string, si: number) => <li key={si} style={{fontSize:7,marginBottom:2}}>{step}</li>)}
                              </ol>
                            </div>
                          )}
                          <button onClick={()=>setRecipePickerMeal({dayIdx,mealIdx:mi,label:m.label})} style={{marginTop:3,padding:'2px 6px',borderRadius:4,border:'1px solid rgba(249,115,22,0.3)',background:'rgba(249,115,22,0.1)',color:'#f97316',cursor:'pointer',fontSize:7,fontWeight:600}}>🍳 Заменить приём этим рецептом</button>
                        </div>
                      </details>
                    ))}
                  </div>
                )}
                {quickAddMealIdx === mi && (
                  <div style={{padding:'4px 10px 8px',background:'#18181b',borderTop:'1px solid rgba(255,255,255,0.04)'}}>
                    <input value={quickAddSearch} onChange={e=>setQuickAddSearch(e.target.value)} placeholder="Поиск продукта..." autoFocus style={{width:'100%',padding:'4px 8px',borderRadius:6,border:'1px solid rgba(0,230,138,0.2)',background:'#202023',color:'#fff',fontSize:9,marginBottom:4}} />
                    <div style={{maxHeight:120,overflowY:'auto',display:'flex',flexWrap:'wrap',gap:3}}>
                      {(() => {
                        const raw = FOOD_DB.filter(f => !quickAddSearch || f.name.toLowerCase().includes(quickAddSearch.toLowerCase())).slice(0, 20);
                        const mealTarget = getMealKBJUTarget(d, mi);
                        const mealCur = getMealCurrentKBJU(d, mi);
                        const defaultTarget = mealTarget || { kcal: 600, protein: 40, fat: 20, carbs: 60 };
                        const scored = scoreFoodsForKBJU(raw, defaultTarget, mealCur || undefined, undefined, 10);
                        const sorted = scored.length > 0 ? scored : raw.slice(0, 10).map(f => ({ foodId: f.id, foodName: f.name, matchScore: 0, color: '#00e68a', kcal: f.kcal, protein: f.protein, fat: f.fat, carbs: f.carbs, fiber: f.fiber || 0 }));
                        return sorted.map((r: any) => {
                          const food = FOOD_DB.find((f: any) => f.id === r.foodId);
                          return (
                            <span key={r.foodId} onClick={() => { if (!food) return; addFoodToMeal(dayIdx, mi, food); setQuickAddMealIdx(null); setQuickAddSearch(''); }}
                              style={{padding:'3px 6px',borderRadius:4,fontSize:8,background:'#202023',border:'1px solid rgba(0,230,138,0.1)',color:'#fff',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:3}}>
                              {r.foodName}{r.matchScore > 0 && <span style={{fontSize:6,color:r.color,fontWeight:600}}>{r.matchScore}%</span>}
                            </span>
                          );
                        });
                      })()}
                    </div>
                    <button onClick={() => { setQuickAddMealIdx(null); setQuickAddSearch(''); }} style={{marginTop:4,padding:'3px 8px',borderRadius:4,border:'1px solid rgba(239,68,68,0.2)',background:'rgba(239,68,68,0.04)',color:'#ef4444',cursor:'pointer',fontSize:8,width:'100%'}}>✕ Закрыть</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {d.intraWorkout && (
          <div style={{marginBottom:6,borderRadius:10,overflow:'hidden',border:'1px solid rgba(34,197,94,0.2)'}}>
            <div style={{padding:'7px 10px 5px',background:'rgba(34,197,94,0.05)',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <span style={{fontSize:8,fontWeight:600,color:'rgba(255,255,255,0.85)'}}>{d.intraWorkout.time}</span>
                <span style={{width:3,height:12,borderRadius:2,background:'#22c55e'}}/>
                <span style={{fontSize:10,fontWeight:700,color:'#22c55e'}}>{d.intraWorkout.label}</span>
                <span style={{fontSize:10,padding:'1px 5px',borderRadius:4,background:'rgba(34,197,94,0.12)',color:'#22c55e',fontWeight:600}}>ВО ВРЕМЯ</span>
              </div>
              <span style={{fontSize:10,fontWeight:800,color:'rgba(255,255,255,0.85)'}}>{Math.round(d.intraWorkout.totals?.kcal||0)} ккал</span>
            </div>
            <div style={{padding:'6px 10px 8px',background:'#18181b'}}>
              <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                {d.intraWorkout.items.map((it: any, ii: number) => (
                  <span key={ii} style={{padding:'3px 6px',borderRadius:6,fontSize:8,background:'#202023',border:'1px solid rgba(34,197,94,0.15)',color:'#fff',display:'inline-flex',alignItems:'center',gap:3}}>
                    <span style={{fontWeight:600}}>{it.name}</span><span style={{color:'rgba(255,255,255,0.9)',fontSize:10}}>{it.amount}г</span>
                  </span>
                ))}
              </div>
              {d.intraWorkout.note && <div style={{fontSize:10,color:'rgba(255,255,255,0.5)',marginTop:3}}>{d.intraWorkout.note}</div>}
            </div>
          </div>
        )}
        {d.nutritionLogic && d.nutritionLogic.length > 0 && (
          <details style={{marginBottom:6,borderRadius:10,overflow:'hidden',border:'1px solid rgba(168,85,247,0.15)'}}>
            <summary style={{padding:'7px 10px',background:'rgba(168,85,247,0.04)',cursor:'pointer',fontSize:9,fontWeight:700,color:'#a78bfa',listStyle:'none'}}>🧠 Логика плана: почему выбраны эти продукты</summary>
            <div style={{padding:'8px 10px',background:'rgba(24,24,27,0.6)'}}>
              {d.nutritionLogic.map((nl: any, nli: number) => (
                <div key={nli} style={{marginBottom:4,padding:'4px 8px',borderRadius:6,background:'rgba(168,85,247,0.03)',border:'1px solid rgba(168,85,247,0.06)'}}>
                  <span style={{fontSize:8,fontWeight:700,color:'#c4b5fd'}}>{nl.label}:</span>
                  <div style={{display:'flex',flexWrap:'wrap',gap:3,marginTop:2}}>
                    {nl.rules.map((r: string, ri: number) => (
                      <span key={ri} style={{fontSize:10,color:'rgba(255,255,255,0.6)',background:'rgba(168,85,247,0.06)',padding:'1px 5px',borderRadius:3}}>{r}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
        {d.dietDiversity && (
          <div style={{marginBottom:6,borderRadius:10,overflow:'hidden',border:'1px solid rgba(245,158,11,0.15)'}}>
            <div style={{padding:'6px 10px',background:'rgba(245,158,11,0.04)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:9,fontWeight:700,color:'#f59e0b'}}>🌈 Разнообразие: {d.dietDiversity.uniqueFoods} продуктов</span>
              <span style={{fontSize:10,fontWeight:600,color:d.dietDiversity.score >= 7 ? '#22c55e' : d.dietDiversity.score >= 4 ? '#f59e0b' : '#ef4444'}}>{d.dietDiversity.note}</span>
            </div>
          </div>
        )}
        <div style={{marginTop:8,borderRadius:10,overflow:'hidden',border:'1px solid rgba(0,230,138,0.15)'}}>
          <div style={{padding:'10px 12px',background:'linear-gradient(135deg, rgba(0,230,138,0.06), transparent)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><span style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.85)',letterSpacing:'1px'}}>ИТОГО ЗА ДЕНЬ</span><span style={{color:'#00e68a',fontWeight:900,fontSize:16}}>{totalKcal} ккал</span></div>
            <div style={{display:'flex',gap:8}}>
              {[{label:'Белки',val:totalP,unit:'г',color:'#3b82f6',target:effectiveP},{label:'Жиры',val:totalF,unit:'г',color:'#f59e0b',target:effectiveF},{label:'Углеводы',val:totalC,unit:'г',color:'#f97316',target:effectiveC}].map(m=>{const pct=Math.min(100,Math.round(m.val/Math.max(1,m.target)*100));const isOver=pct>100;return(<div key={m.label} style={{flex:1}}><div style={{display:'flex',justifyContent:'space-between',fontSize:8,marginBottom:2}}><span style={{color:m.color,fontWeight:600}}>{m.label}</span><span style={{color:isOver?'#ef4444':'rgba(255,255,255,0.85)',fontWeight:700}}>{m.val}/{m.target}{m.unit}</span></div><div style={{height:5,borderRadius:3,background:'#202023',overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,pct)}%`,borderRadius:3,background:isOver?'#ef4444':`linear-gradient(90deg, ${m.color}, ${m.color}88)`,transition:'width 0.3s'}}/></div><div style={{fontSize:10,color:isOver?'#ef4444':'rgba(255,255,255,0.85)',textAlign:'right',marginTop:1}}>{isOver?`+${pct-100}%`:`${pct}%`}</div></div>);})}
            </div>
          </div>
        </div>
        {d.meals && (() => { // FIX week-perf: микро-сводка дня кэшируется по объекту дня (WeakMap)
          let _mc = _dayMicrosCache.get(d);
          if (_mc === undefined) {
            const allItems = d.meals.flatMap((m: any) => (m.items || []).map((it: any) => ({...it, food: FOOD_DB.find((f: any) => f.id === it.id)})));
            const calcMicro = (field: string, factor: number) => Math.round(allItems.reduce((s: number, it: any) => s + ((it.food?.micros?.[field] || it.food?.['trace_elements_100g']?.[field] || it.food?.electrolytes_100g?.[field] || 0) * (it.amount||100) / 100), 0));
            const micros = [ {label:'Ca',val:calcMicro('Ca',1),rda:1000,unit:'мг'}, {label:'Fe',val:calcMicro('Fe',1),rda:18,unit:'мг'}, {label:'Mg',val:calcMicro('Mg',1),rda:400,unit:'мг'}, {label:'Zn',val:calcMicro('Zn',1),rda:15,unit:'мг'}, {label:'K',val:calcMicro('K',1),rda:3500,unit:'мг'}, {label:'Omega3',val:Math.round(allItems.reduce((s:number,it:any)=>s+((it.food?.macro_100g?.omega_3_mg||it.food?.micros?.Omega3||0)*(it.amount||100)/100),0)),rda:1600,unit:'мг'} ];
            const visibleMicros = micros.filter(m => m.val > 0).slice(0, 5);
            _mc = visibleMicros.length > 0 ? { visibleMicros } : null;
            _dayMicrosCache.set(d, _mc);
          }
          const visibleMicros = _mc ? _mc.visibleMicros : [];
          return visibleMicros.length > 0 ? (<div style={{marginTop:6,borderRadius:10,overflow:'hidden',border:'1px solid rgba(34,197,94,0.15)'}}><div style={{padding:'6px 10px',background:'rgba(34,197,94,0.03)'}}><div style={{fontSize:9,fontWeight:700,color:'#22c55e',marginBottom:4}}>🧪 Микронутриенты (покрытие RDA)</div><div style={{display:'flex',flexWrap:'wrap',gap:4}}>{visibleMicros.map((m,i)=>{const pct=Math.min(100,Math.round(m.val/Math.max(1,m.rda)*100));return(<div key={i} style={{display:'flex',alignItems:'center',gap:3,fontSize:8,padding:'2px 6px',borderRadius:4,background:'rgba(34,197,94,0.06)',border:'1px solid rgba(34,197,94,0.1)'}}><span style={{fontWeight:700,color:pct>=80?'#22c55e':pct>=50?'#f59e0b':'#ef4444'}}>{m.label}</span><span style={{color:'rgba(255,255,255,0.7)'}}>{m.val}{m.unit}</span><span style={{fontSize:10,color:pct>=80?'#22c55e':pct>=50?'#f59e0b':'#ef4444',fontWeight:600}}>{pct}%</span></div>)})}</div></div></div>) : null; })()}
        {d.supplementTimeline && d.supplementTimeline.length > 0 && (
          <div style={{marginTop:6,borderRadius:10,overflow:'hidden',border:'1px solid rgba(139,92,246,0.2)'}}>
            <div style={{padding:'8px 10px',background:'rgba(139,92,246,0.04)'}}>
              <div style={{fontSize:9,fontWeight:700,color:'#a78bfa',marginBottom:6}}>💊 Добавки по времени</div>
              {d.supplementTimeline.map((st: any, si: number) => (
                <div key={si} style={{display:'flex',alignItems:'flex-start',gap:6,marginBottom:4,padding:'4px 6px',borderRadius:6,background:'rgba(139,92,246,0.04)'}}>
                  <span style={{fontSize:10,color:'#a78bfa',fontWeight:600,minWidth:32}}>{st.time}</span>
                  <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                    {st.items.map((s: any, ii: number) => (
                      <span key={ii} style={{fontSize:10,padding:'2px 5px',borderRadius:4,background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.15)',color:'#c4b5fd',fontWeight:600}} title={s.note}>{s.name} {s.dose}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {d.waterTimeline && d.waterTimeline.length > 0 && (
          <div style={{marginTop:6,borderRadius:10,overflow:'hidden',border:'1px solid rgba(59,130,246,0.2)'}}>
            <div style={{padding:'8px 10px',background:'rgba(59,130,246,0.04)'}}>
              <div style={{fontSize:9,fontWeight:700,color:'#60a5fa',marginBottom:6}}>💧 Гидратация (~{d.waterTimeline.reduce((s:number,w:any)=>s+w.ml,0)} мл/день)</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {d.waterTimeline.map((w: any, wi: number) => (
                  <span key={wi} style={{fontSize:10,padding:'2px 6px',borderRadius:4,background:'rgba(59,130,246,0.08)',border:'1px solid rgba(59,130,246,0.12)',color:'#93c5fd',fontWeight:600}} title={w.note}>{w.time} — {w.ml}мл</span>
                ))}
              </div>
              {waterCalc?.electrolytes && (
                <div style={{marginTop:6,padding:'5px 8px',borderRadius:6,background:'rgba(59,130,246,0.06)',fontSize:10}}>
                  <span style={{color:'#93c5fd',fontWeight:600}}>⚡ Na {waterCalc.electrolytes.sodiumMg}мг</span>
                  <span style={{margin:'0 6px',color:'rgba(255,255,255,0.15)'}}>|</span>
                  <span style={{color:'#f59e0b',fontWeight:600}}>K {waterCalc.electrolytes.potassiumMg}мг</span>
                  <span style={{margin:'0 6px',color:'rgba(255,255,255,0.15)'}}>|</span>
                  <span style={{color:'#a78bfa',fontWeight:600}}>Mg {waterCalc.electrolytes.magnesiumMg}мг</span>
                  <div style={{color:'rgba(255,255,255,0.5)',marginTop:2}}>{waterCalc.electrolytes.note}</div>
                </div>
              )}
            </div>
          </div>
        )}
        {d.meals && d.meals.length > 0 && (() => {
          const toMin = (t: string) => { const [h, m] = (t || '00:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
          const mealMins = d.meals.map((m: any) => toMin(m.time));
          const startMin = Math.min(...mealMins, 360);
          const lastMeal = Math.max(...mealMins);
          const endMin = Math.max(lastMeal + 90, 1380);
          const span = Math.max(60, endMin - startMin);
          const pos = (min: number) => Math.max(0, Math.min(100, ((min - startMin) / span) * 100));
          const mealPts = d.meals.map((m: any) => ({ ...m, min: toMin(m.time) })).sort((a: any, b: any) => a.min - b.min);
          const trainMin = (linkToTraining && d.isTrainingDay && trainStart && trainStart.includes(':')) ? toMin(trainStart) : null;
          const trainEndMin = (trainMin != null && trainEnd && trainEnd.includes(':')) ? toMin(trainEnd) : (trainMin != null ? trainMin + 90 : null);
          const hourTicks: number[] = []; for (let t = Math.floor(startMin / 60) * 60; t <= endMin; t += 60) hourTicks.push(t);
          return (
            <div style={{ marginTop: 6, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(0,230,138,0.18)' }}>
              <div style={{ padding: '8px 10px', background: 'rgba(0,230,138,0.04)' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#00e68a', marginBottom: 6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span>Таймлайн дня</span>
                  {trainMin != null && <span style={{fontSize:7, padding:'2px 6px', borderRadius:20, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444'}}>T {String(Math.floor(trainMin/60)).padStart(2,'0')}:{String(trainMin%60).padStart(2,'0')}–{String(Math.floor((trainEndMin||trainMin+90)/60)%24).padStart(2,'0')}:{String((trainEndMin||trainMin+90)%60).padStart(2,'0')}</span>}
                </div>
                {/* Горизонтальная шкала — скролл если много приёмов, перенос на след строку через flex-wrap */}
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, padding:'8px 6px', background:'#202023', borderRadius:6, border:'1px solid rgba(255,255,255,0.06)' }}>
                  {mealPts.map((m: any, i: number) => {
                    const isW = m.label && (m.label.toLowerCase().includes('предтрен') || m.label.toLowerCase().includes('пост') || m.label.toLowerCase().includes('intra'));
                    const col = isW ? '#8b5cf6' : '#00e68a';
                    const bg = isW ? 'rgba(139,92,246,0.12)' : 'rgba(0,230,138,0.10)';
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', borderRadius:8, background:bg, border:`1px solid ${col}30`, minWidth:110, flex:'1 0 120px' }} title={m.time + ' — ' + m.label + ' · ' + Math.round(m.totals?.kcal || 0) + ' ккал'}>
                        <span style={{fontSize:10, fontWeight:800, color:col}}>{m.time}</span>
                        <span style={{width:6,height:6,borderRadius:'50%', background:col, flexShrink:0}}/>
                        <span style={{fontSize:8, fontWeight:700, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{m.label}</span>
                        <span style={{marginLeft:'auto', fontSize:7, color:'rgba(255,255,255,0.6)'}}>{Math.round(m.totals?.kcal||0)}ккал</span>
                      </div>
                    );
                  })}
                  {(injections || []).filter((i:any)=>i.time&&i.time.includes(':')).map((inj:any,idx:number)=>{
                    const iGlyph = (inj.type||'').includes('инсулин')?'💉':(inj.type||'')==='ГР'?'🌙':'⚡';
                    return <div key={'inj'+idx} style={{display:'flex', alignItems:'center', gap:4, padding:'4px 8px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', fontSize:8}} title={(inj.time||'')+' — укол '+(inj.name||inj.type)}><span>{iGlyph}</span><span style={{fontWeight:700}}>{inj.time}</span><span style={{color:'rgba(255,255,255,0.7)'}}>{inj.name||inj.type}</span></div>;
                  })}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 6, color: 'rgba(255,255,255,0.6)', flexWrap:'wrap' }}>
                  <span><span style={{ color: '#00e68a' }}>●</span> Приёмы</span>
                  <span><span style={{ color: '#8b5cf6' }}>●</span> Peri-workout</span>
                  {trainMin != null && <span><span style={{ color: '#ef4444' }}>●</span> Тренировка</span>}
                  <span style={{marginLeft:'auto', fontSize:6, color:'rgba(255,255,255,0.4)'}}>перенос на след. строку разрешён — не сжато</span>
                </div>
              </div>
            </div>
          );
        })()}
        {timeEdit.modal}
      </div>
    );
  };
}

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
import { PROTEIN_PRESETS } from "./types";
import { OrganLoadBadgeGroup } from "./OrganLoadBadges";
import { readDiaryV2, writeDiaryV2 } from "../diary-storage-v2";
import { kbjuFormulaDeviationPct, RECIPE_PRESETS, recipeMatchesPreset } from "./planner-recipe-mode";
import { displayAmount } from "./planner-weight-mode";

// FIX week-perf: кэш тяжёлых метрик приёма (DIAAS/GL/II) по объекту приёма.
// Объекты приёмов иммутабельны (заменяются при правках), поэтому WeakMap-кэш всегда валиден
// и избавляет от пересчёта DIAAS/GL/II на КАЖДЫЙ рендер (drag/печать/ввод веса).
// Оформление не меняется — только вычисления.
const _mealMetricsCache = new WeakMap<object, { diaas: number; gl: number; ii: number }>();
const _dayMicrosCache = new WeakMap<object, { visibleMicros: any[] } | null>();
// FIX week-perf: findSimilarFoods сканирует FOOD_DB+сортирует — кэш по объекту продукта
const _similarFoodsCache = new WeakMap<object, any[]>();

// Этап 3 (Пробел-1): редактирование времени — через модал (без window.prompt).
// Эпик E: запись через ctx.updateMealTime — синк в weekPlan при weekEditDay
// (раньше писали только dayPlan, правки недели терялись).
function useMealTimeEdit(saveUndo: () => void, applyTime: (mealIdx: number, time: string) => void) {
  const planRef = React.useRef<any>(null);
  const [edit, setEdit] = React.useState<{ idx:number; value:string } | null>(null);
  const open = (idx:number, plan?: any) => {
    planRef.current = plan;
    const cur = (plan || planRef.current)?.meals?.[idx]?.time || '12:00';
    setEdit({ idx, value: cur });
  };
  const confirm = () => {
    if (!edit) return;
    const res = edit.value.trim();
    const mt = res.split(':');
    if (mt.length !== 2) return;
    const h = parseInt(mt[0],10), mm = parseInt(mt[1],10);
    if (isNaN(h)||isNaN(mm)||h<0||h>23||mm<0||mm>59) return;
    applyTime(edit.idx, `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`);
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
  const { calcTargets, dayPlan, draggedItem, dropTarget, drugCompatReport, editAmount, editItem, effectiveC, effectiveF, effectiveKcal, effectiveP, excludedFoods, findSimilarFoods, healthIssues, injections, linkToTraining, lockedFoodIds, moveFoodItem, nutritionReport, proteinPreset, phase, plannerMode, preferredFoods, quickAddMealIdx, quickAddSearch, removeFoodItem, replaceFoodItem, replacingItem, saveUndo, setDayPlan: _setDayPlan, setDraggedItem, setDropTarget, setEditAmount: _setEditAmount, setEditItem, setExcludedFoods, setQuickAddMealIdx, setQuickAddSearch, setRecipePickerMeal, setReplacingItem, toggleLockFood, trainEnd, trainStart, updateItemAmount, waterCalc, weight, weightLogEntries, addFoodToMeal, addSnackComboToMeal, generationMode, weightMode, pickRecipeOption, moreRecipeOptions, refreshRecipeSuggestions, favoriteRecipes, toggleFavoriteRecipe, isFavoriteRecipe, removeMealRebalanced } = ctx as any;
  const _weightMode = (weightMode === 'raw' ? 'raw' : 'cooked') as 'cooked' | 'raw';
  const _proteinPreset = PROTEIN_PRESETS.find(p => p.id === (proteinPreset || 'base'))?.gPerKg || 2.0;
  const setDayPlan = _setDayPlan as any;
  const setEditAmount = _setEditAmount as any;
  const timeEdit = useMealTimeEdit(saveUndo, (typeof (ctx as any).updateMealTime === 'function' ? (ctx as any).updateMealTime : (_i: number, _t: string) => {}));
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
  // Эпик 6: ручные цели на приём (🎯) — персистентные Б/Ж/У слота
  const [mealTargetEditor, setMealTargetEditor] = React.useState<{ mi: number; label: string; p: string; f: string; c: string } | null>(null);
  const saveMealTarget = (label: string) => {
    try {
      const cur: any[] = JSON.parse(localStorage.getItem('he_meal_target_overrides') || '[]');
      const next = cur.filter((o: any) => !o || o.label !== label);
      const p = parseFloat(mealTargetEditor!.p) || 0;
      const f = parseFloat(mealTargetEditor!.f) || 0;
      const c = parseFloat(mealTargetEditor!.c) || 0;
      if (p > 0 || f > 0 || c > 0) next.push({ label, p: p > 0 ? p : undefined, f: f > 0 ? f : undefined, c: c > 0 ? c : undefined });
      localStorage.setItem('he_meal_target_overrides', JSON.stringify(next));
    } catch {}
    setMealTargetEditor(null);
  };
  const readMealTarget = (label: string): { p?: number; f?: number; c?: number } | undefined => {
    try {
      const cur: any[] = JSON.parse(localStorage.getItem('he_meal_target_overrides') || '[]');
      return cur.find((o: any) => o && o.label === label);
    } catch { return undefined; }
  };
  return (dayData: any, editable = false, dayIdx = 0) => {
    if (!dayData) return null;
    const d = dayData; const totalKcal = Math.round(d.totals?.kcal || 0); const totalP = Math.round(d.totals?.p || 0); const totalF = Math.round(d.totals?.f || 0); const totalC = Math.round(d.totals?.c || 0); const totalFiber = Math.round(d.totals?.fiber || 0);
    const pKcalPct = totalKcal > 0 ? (totalP * 4 / totalKcal) * 100 : 0; const fKcalPct = totalKcal > 0 ? (totalF * 9 / totalKcal) * 100 : 0; const cKcalPct = totalKcal > 0 ? (totalC * 4 / totalKcal) * 100 : 0;
    return (
      <div>
        {/* per100 — компактный инфо-бейдж */}
        <div style={{
          marginBottom:10, padding:'9px 12px', borderRadius:12,
          background:'linear-gradient(135deg, rgba(0,230,138,0.07), rgba(0,200,160,0.03))',
          border:'1px solid rgba(0,230,138,0.14)', fontSize:10, color:'rgba(255,255,255,0.82)', lineHeight:1.5,
          boxShadow:'0 2px 12px rgba(0,230,138,0.06)', backdropFilter:'blur(8px)',
        }}>
          <span style={{display:'inline-flex',alignItems:'center',gap:6, fontWeight:800,color:'#00e68a', marginRight:6, padding:'1px 7px', borderRadius:999, background:'rgba(0,230,138,0.12)', border:'1px solid rgba(0,230,138,0.18)', fontSize:9}}>ⓘ per100</span>
          КБЖУ на <b>100 г</b> съедобной части: <span style={{color:'#00e68a',fontWeight:700}}>готовый</span> · <span style={{color:'#f59e0b',fontWeight:700}}>сухой</span> · <span style={{color:'#a78bfa',fontWeight:700}}>порошок</span> · <span style={{color:'#60a5fa',fontWeight:700}}>как есть</span>
          <span style={{color:'rgba(255,255,255,0.45)', marginLeft:6}}>КБЖУ<sub>порции</sub> = per100 × г/100 — честный вес в указанном виде.</span>
        </div>
        <div style={{
          marginBottom:12, borderRadius:16, overflow:'hidden',
          border: d.isTrainingDay ? '1px solid rgba(0,230,138,0.22)' : '1px solid rgba(255,255,255,0.07)',
          background: d.isTrainingDay ? 'linear-gradient(180deg, rgba(0,230,138,0.10) 0%, rgba(0,230,138,0.04) 52%, rgba(24,24,27,0.9) 100%)' : 'linear-gradient(180deg, rgba(30,30,35,0.9), rgba(20,20,23,0.96))',
          boxShadow: d.isTrainingDay ? '0 8px 28px rgba(0,230,138,0.14), inset 0 1px 0 rgba(255,255,255,0.06)' : '0 8px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.04)',
          position:'relative',
        }}>
          <div style={{position:'absolute', top:0, left:0, right:0, height:1, background: d.isTrainingDay ? 'linear-gradient(90deg, #00e68a 0%, #00e68a22 60%, transparent 100%)' : 'linear-gradient(90deg, rgba(255,255,255,0.08), transparent)'}} />
          <div style={{padding:'14px 16px 12px'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <span style={{
                width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0,
                background: d.isTrainingDay ? 'linear-gradient(135deg, rgba(0,230,138,0.18), rgba(0,200,160,0.10))' : 'rgba(255,255,255,0.06)',
                border: d.isTrainingDay ? '1px solid rgba(0,230,138,0.22)' : '1px solid rgba(255,255,255,0.08)',
                boxShadow: d.isTrainingDay ? '0 2px 12px rgba(0,230,138,0.18)' : 'none',
              }}>{d.isTrainingDay?'🏋️':'😴'}</span>
              <div style={{flex:1, minWidth:0}}><div style={{fontSize:12.5,fontWeight:900,letterSpacing:'-0.3px', color: d.isTrainingDay ? '#00e68a' : '#fff', lineHeight:1.1}}>{d.isTrainingDay?'ТРЕНИРОВОЧНЫЙ ДЕНЬ':'ДЕНЬ ОТДЫХА'}</div>
                <div style={{display:'flex', alignItems:'center', gap:6, marginTop:2}}>
                  {plannerMode === 'pro' && <span style={{fontSize:9,fontWeight:800,color:'#c4b5fd',background:'rgba(139,92,246,0.14)',padding:'2px 7px',borderRadius:999,border:'1px solid rgba(139,92,246,0.22)', letterSpacing:'0.2px'}}>◆ Pro</span>}
                  {weightLogEntries.length >= 3 && (() => { const vals = weightLogEntries.map((e: any) => e.weight); const min = Math.min(...vals); const max = Math.max(...vals); const range = max - min || 1; const h = 20; const w = 68; const pts = vals.map((v: number,i: number) => `${Math.round(i/(vals.length-1)*w)},${Math.round(h-(v-min)/range*h)}`).join(' '); const trend = vals.length >= 2 && vals[vals.length-1] < vals[0]; return (<span style={{display:'inline-flex',alignItems:'center',gap:4, padding:'1px 6px', borderRadius:999, background: trend ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)', border: `1px solid ${trend ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)'}`}}><svg width={w} height={h} style={{verticalAlign:'middle'}}><polyline points={pts} fill="none" stroke={trend?'#22c55e':'#ef4444'} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"/></svg><span style={{fontSize:9,color:trend?'#22c55e':'#ef4444',fontWeight:700}}>{trend?'↓':'↑'} {Math.abs(vals[vals.length-1]-vals[0]).toFixed(1)} кг</span></span>); })()}
                </div>
              </div>
              <div style={{
                textAlign:'right', padding:'8px 12px', borderRadius:12, minWidth:92,
                background: d.isTrainingDay ? 'rgba(0,230,138,0.10)' : 'rgba(255,255,255,0.05)',
                border: d.isTrainingDay ? '1px solid rgba(0,230,138,0.18)' : '1px solid rgba(255,255,255,0.07)',
                boxShadow:'0 2px 10px rgba(0,0,0,0.15)',
              }}>
                <div style={{fontSize:20,fontWeight:900,letterSpacing:'-0.6px', color:Math.abs(totalKcal-(effectiveKcal||0))<=Math.max(50,(effectiveKcal||0)*0.08)?'#00e68a':'#fbbf24',lineHeight:1}}>{totalKcal.toLocaleString('ru-RU')}<span style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.45)', marginLeft:3}}>/ {effectiveKcal||'—'}</span></div>
                {effectiveKcal>0 && (() => { const dk=Math.round(totalKcal-effectiveKcal); const dkp=Math.round((totalKcal-effectiveKcal)/effectiveKcal*100); const ok=Math.abs(dk)<=Math.max(50,Math.round(effectiveKcal*0.05)); return <div style={{fontSize:10,fontWeight:800,marginTop:1, color:ok?'#22c55e':(dk>0?'#f59e0b':'#60a5fa')}}>{dk>=0?'+':''}{dk} ккал · {dk>=0?'+':''}{dkp}% {ok ? '✓' : '•'}</div>; })()}
                <div style={{fontSize:9,color:'rgba(255,255,255,0.5)', fontWeight:600, letterSpacing:'0.4px', marginTop:1}}>ККАЛ ЗА ДЕНЬ</div>
              </div>
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center', marginBottom:6}}>
              {(() => {
                const fmt = (val:number, tgt:number, unit:string, icon:string, col:string) => {
                  if (!tgt) return <span style={{display:'inline-flex',alignItems:'center',gap:4, padding:'4px 8px', borderRadius:999, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', fontSize:11}}><span style={{color:col}}>{icon}</span><b style={{color:'#fff'}}>{val}{unit}</b></span>;
                  const d = Math.round(val - tgt);
                  const ok = Math.abs(d) <= Math.max(5, Math.round(tgt * 0.05));
                  const devCol = ok ? '#22c55e' : (d > 0 ? '#f59e0b' : '#60a5fa');
                  return <span style={{display:'inline-flex',alignItems:'center',gap:5, padding:'4px 8px', borderRadius:999, background: ok ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)', border:`1px solid ${ok ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.06)'}`, fontSize:11}}><span style={{color:col}}>{icon}</span><span><b style={{color:'#fff'}}>{val}</b><span style={{color:'rgba(255,255,255,0.42)'}}>/{tgt}</span><span style={{color:devCol, fontWeight:800, marginLeft:4}}>Δ{d>=0?'+':''}{d}</span></span></span>;
                };
                return <>
                  {fmt(totalP, effectiveP||0, 'г','●','#3b82f6')}
                  {fmt(totalF, effectiveF||0, 'г','●','#f59e0b')}
                  {fmt(totalC, effectiveC||0, 'г','●','#f97316')}
                  {totalFiber > 0 && <span style={{display:'inline-flex',alignItems:'center',gap:4, padding:'4px 8px', borderRadius:999, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.16)', fontSize:10, fontWeight:700, color:'#22c55e'}}>🌱 {totalFiber} г клетч.</span>}
                  {totalKcal > 0 && (() => { const dev = Math.round(kbjuFormulaDeviationPct(totalKcal, totalP, totalF, totalC) * 10) / 10; const ok = dev <= 3; return (
                    <span title={`Расхождение ккал с формулой 4×Б + 9×Ж + 4×У (норма ≤3%): формула ≈ ${Math.round((totalP*4+totalF*9+totalC*4))} ккал`} style={{fontSize:10,fontWeight:800,padding:'3px 8px',borderRadius:999,border:`1px solid ${ok?'rgba(34,197,94,0.28)':'rgba(245,158,11,0.32)'}`,background:ok?'rgba(34,197,94,0.10)':'rgba(245,158,11,0.12)',color:ok?'#86efac':'#fbbf24', display:'inline-flex', alignItems:'center', gap:4}}><span style={{width:6,height:6,borderRadius:'50%', background: ok ? '#22c55e' : '#f59e0b'}}/>⚖️ ±{dev}%</span>
                  ); })()}
                </>;
              })()}
              <span style={{marginLeft:'auto',fontSize:10,fontWeight:700, color:'rgba(255,255,255,0.45)', padding:'3px 8px', borderRadius:999, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)'}}>{weight>0?`${(totalP/weight).toFixed(1)} г/кг белка`:''}</span>
            </div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.38)',lineHeight:1.4, padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.04)'}}>
              Цель: <b style={{color:'#60a5fa'}}>{calcTargets.protein} г базы</b> <span style={{color:'rgba(255,255,255,0.25)'}}>→</span> <b style={{color:'#00e68a'}}>{_proteinPreset} г/кг</b> <span style={{color:'rgba(255,255,255,0.25)'}}>·</span> фаза <b style={{color:'#c4b5fd'}}>«{phase}»</b>{(injections as any[]).some((i: any)=>i.type==='ААС')?(<><span style={{color:'rgba(255,255,255,0.25)'}}> · </span><span style={{color:'#f472b6'}}>+AAS +{Math.round(weight*0.3)} г</span></>):''} <span style={{color:'rgba(255,255,255,0.25)'}}>→</span> <b style={{color:'#fff'}}>{effectiveP} г</b> / <b style={{color:'#fff'}}>{effectiveKcal} ккал</b>{weight>0?<><span style={{color:'rgba(255,255,255,0.25)'}}> · </span><b style={{color:'#22c55e'}}>{(totalP/weight).toFixed(1)} г/кг</b></>:''}</div>
          </div>
          {nutritionReport && (() => { const r = nutritionReport; const chip = (ok: boolean, label: string, val: string) => (<div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 8px',borderRadius:999,fontSize:10,fontWeight:700, background: ok ? 'rgba(34,197,94,0.10)' : 'rgba(245,158,11,0.10)', border:`1px solid ${ok?'rgba(34,197,94,0.20)':'rgba(245,158,11,0.22)'}`,color: ok ? '#86efac' : '#fbbf24'}}><span style={{width:6,height:6,borderRadius:'50%',background:ok?'#22c55e':'#f59e0b'}} />{label} <span style={{color:'#fff'}}>{val}</span></div>); const mpsOk = (r.proteinTiming?.evennessScore||0) >= 70; const fibOk = (r.fiberAnalysis?.pct||0) >= 80; const glOk = r.glycemicLoad?.status !== 'high'; const satOk = (r.fatQuality?.satPct||0) <= 15; const nakOk = r.sodiumPotassium?.status === 'ok'; const pralOk = r.pral?.status === 'ok' || r.pral?.status === 'mild'; const o3 = r.fatQuality?.omega3G||0; const o3Ok = o3 >= 1.6; return (<div style={{margin:'0 12px 10px',padding:'8px 10px',borderRadius:12,background:'rgba(139,92,246,0.06)',border:'1px solid rgba(139,92,246,0.14)'}}><div style={{fontSize:10,fontWeight:800,color:'#c4b5fd',marginBottom:6, letterSpacing:'0.2px', display:'flex', alignItems:'center', gap:6}}><span style={{width:18,height:18,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(139,92,246,0.16)',border:'1px solid rgba(139,92,246,0.2)',fontSize:10}}>🩺</span> Диетология</div><div style={{display:'flex',flexWrap:'wrap',gap:5}}>{chip(mpsOk,'MPS',(r.proteinTiming?.evennessScore||0).toFixed(0)+'%')}{chip(fibOk,'Клетч.',(r.fiberAnalysis?.totalG||0).toFixed(0)+'г')}{chip(glOk,'ГН',r.glycemicLoad?.status==='high'?'выс.':r.glycemicLoad?.status==='low'?'низк.':'норма')}{chip(satOk,'Нас.жир',(r.fatQuality?.satPct||0).toFixed(0)+'%')}{chip(nakOk,'Na:K',(r.sodiumPotassium?.ratio||0).toFixed(1)+':1')}{chip(pralOk,'PRAL',(r.pral?.mEq||0)+'мэкв')}{chip(o3Ok,'Ω3',o3.toFixed(1)+'г')}</div></div>); })()}
          {drugCompatReport?.warnings && drugCompatReport.warnings.length > 0 && drugCompatReport.warnings[0] && !drugCompatReport.warnings[0].includes('совместимы') && (<div style={{margin:'0 12px 10px',padding:'8px 10px',borderRadius:12,background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.14)'}}><div style={{fontSize:10,fontWeight:800,color:'#fca5a5',marginBottom:6, display:'flex', alignItems:'center', gap:6}}><span style={{width:18,height:18,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(239,68,68,0.14)',fontSize:10}}>⚠</span> Лекарства × питание</div>{drugCompatReport.warnings.slice(0,4).map((w: string, i: number) => <div key={i} style={{fontSize:10,color:'rgba(255,255,255,0.78)',marginBottom:2, lineHeight:1.4}}>• {w}</div>)}</div>)}

          <div style={{height:5,display:'flex', gap:1, padding:'0 1px 1px'}}>
            <div style={{height:'100%',width:`${Math.max(2,pKcalPct)}%`,background:'linear-gradient(90deg,#3b82f6,#60a5fa)',borderRadius:'0 0 0 2px',minWidth:2}}/>
            <div style={{height:'100%',width:`${Math.max(2,fKcalPct)}%`,background:'linear-gradient(90deg,#f59e0b,#fbbf24)',minWidth:2}}/>
            <div style={{height:'100%',width:`${Math.max(2,cKcalPct)}%`,background:'linear-gradient(90deg,#f97316,#fb923c)',minWidth:2,flex:1, borderRadius:'0 0 2px 0'}}/>
          </div>
        </div>
        {d.allergenWarnings?.length > 0 && <div style={{padding:'8px 12px',borderRadius:12,background:'linear-gradient(135deg, rgba(239,68,68,0.10), rgba(239,68,68,0.04))',border:'1px solid rgba(239,68,68,0.18)',fontSize:10,color:'#fca5a5',marginBottom:10,display:'flex',alignItems:'center',gap:8, boxShadow:'0 4px 14px rgba(239,68,68,0.08)'}}><span style={{width:26,height:26,borderRadius:8,background:'rgba(239,68,68,0.14)',border:'1px solid rgba(239,68,68,0.18)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12, flexShrink:0}}>⚠️</span><span style={{lineHeight:1.4}}>{d.allergenWarnings.map((w: any) => typeof w === 'string' ? w : `${w.food}: ${w.allergens.join(', ')}`).join(' · ')}</span></div>}
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
            <div key={mi} style={{
              marginBottom:8, borderRadius:16, overflow:'hidden',
              border: dropTarget===mi ? '1px solid rgba(0,230,138,0.32)' : isPreWorkout ? '1px solid rgba(139,92,246,0.18)' : isPostWorkout ? '1px solid rgba(245,158,11,0.18)' : isIntraWorkout ? '1px solid rgba(34,197,94,0.18)' : '1px solid rgba(255,255,255,0.07)',
              background: dropTarget===mi ? 'rgba(0,230,138,0.06)' : 'linear-gradient(180deg, rgba(28,28,32,0.96), rgba(20,20,23,0.98))',
              boxShadow: dropTarget===mi ? '0 0 0 3px rgba(0,230,138,0.12), 0 8px 24px rgba(0,0,0,0.24)' : '0 4px 16px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.04)',
              transition:'all 0.2s cubic-bezier(0.16,1,0.3,1)', position:'relative',
            }}
              onDragOver={e=>{e.preventDefault();setDropTarget(mi);}} onDragLeave={()=>setDropTarget(null)} onDrop={e=>{e.preventDefault();if(draggedItem&&draggedItem.mealIdx!==mi)moveFoodItem(draggedItem.mealIdx,mi,draggedItem.itemIdx, dayIdx);setDropTarget(null);}}>
              <div style={{
                padding:'10px 12px 9px',
                background: isPreWorkout ? 'linear-gradient(135deg, rgba(139,92,246,0.10), rgba(139,92,246,0.03))' : isPostWorkout ? 'linear-gradient(135deg, rgba(245,158,11,0.09), rgba(245,158,11,0.02))' : isIntraWorkout ? 'linear-gradient(135deg, rgba(34,197,94,0.09), rgba(34,197,94,0.02))' : 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.05)',flexWrap:'wrap',gap:6,
                borderLeft:`3px solid ${accentColor}`, wordBreak:'break-word',
              }}>
                <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
                  <span style={{fontSize:11,fontWeight:700,color:'#fff', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', padding:'2px 7px', borderRadius:999}}>{m.time}</span>
                  <span style={{fontSize:12.5,fontWeight:800,color:accentColor, letterSpacing:'-0.2px'}}>{m.label}</span>
                  {isPreWorkout&&<span style={{fontSize:10,padding:'1px 5px',borderRadius:4,background:'rgba(139,92,246,0.15)',color:'#a855f7',fontWeight:600}}>ДО</span>}
                  {isPostWorkout&&<span style={{fontSize:10,padding:'1px 5px',borderRadius:4,background:'rgba(245,158,11,0.15)',color:'#f59e0b',fontWeight:600}}>ПОСЛЕ</span>}
                  {isIntraWorkout&&<span style={{fontSize:10,padding:'1px 5px',borderRadius:4,background:'rgba(34,197,94,0.15)',color:'#22c55e',fontWeight:600}}>ВО ВРЕМЯ</span>}
                  {totalKcal>0 && mealKcal>0 && (() => { const pct=Math.round(mealKcal/totalKcal*100); const big=pct>=20; return <span title={`Приём ${pct}% дневной калорийности`} style={{fontSize:10,padding:'1px 5px',borderRadius:4,fontWeight:700, background: big?'rgba(0,230,138,0.10)':'rgba(255,255,255,0.05)', border:`1px solid ${big?'rgba(0,230,138,0.2)':'rgba(255,255,255,0.08)'}`, color: big?'#00e68a':'rgba(255,255,255,0.6)'}}>{pct}% дня</span>; })()}
                  {m.recipeApplied && !!m.recipeAppliedData?.appliedScale && Math.abs((m.recipeAppliedData.appliedScale||1)-1)>0.05 && <span title={`Рецепт масштабирован в ${(m.recipeAppliedData.portionScale||m.recipeAppliedData.appliedScale||1)} ${((m.recipeAppliedData.portionScale||m.recipeAppliedData.appliedScale||1)===1?'порцию':((m.recipeAppliedData.portionScale||m.recipeAppliedData.appliedScale||1)<2?'порции':'порций'))} к цели приёма (исходный рецепт = 1 порция, пропорции авторские)`} style={{fontSize:10,padding:'1px 5px',borderRadius:4,background:'rgba(139,92,246,0.12)',border:'1px solid rgba(139,92,246,0.22)',color:'#c4b5fd',fontWeight:700}}>🍳 ×{(m.recipeAppliedData.portionScale||m.recipeAppliedData.appliedScale||1)} {((m.recipeAppliedData.portionScale||m.recipeAppliedData.appliedScale||1)===1?'порция':((m.recipeAppliedData.portionScale||m.recipeAppliedData.appliedScale||1)<2?'порции':'порций'))}</span>}
                  {m.recipeApplied2 && <span title={`Второй рецепт приёма: «${m.recipeApplied2}»`} style={{fontSize:10,padding:'1px 5px',borderRadius:4,background:'rgba(245,158,11,0.12)',border:'1px solid rgba(245,158,11,0.24)',color:'#fbbf24',fontWeight:700}}>🍳 +{m.recipeApplied2}</span>}
                  {(m.type==='snack'||m.type==='snack2'||m.type==='snack3'||m.type==='snack4'||m.type==='snack5'||m.type==='snack6')&&<span onClick={()=>addSnackComboToMeal(dayIdx, mi)} title="Добавить протеин-порошок + овсяные хлопья" style={{fontSize:10,padding:'1px 5px',borderRadius:4,background:'rgba(167,139,250,0.12)',border:'1px solid rgba(167,139,250,0.25)',color:'#a78bfa',cursor:'pointer',fontWeight:600}}>🥣 Порошок+хлопья</span>}
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
                  <span onClick={()=>{ const ov = readMealTarget(m.label); setMealTargetEditor({ mi, label: m.label, p: ov?.p ? String(ov.p) : '', f: ov?.f ? String(ov.f) : '', c: ov?.c ? String(ov.c) : '' }); }} style={{fontSize:10,padding:'2px 5px',borderRadius:4,background:'rgba(249,115,22,0.08)',border:'1px solid rgba(249,115,22,0.15)',color:'#fb923c',cursor:'pointer',fontWeight:600}} title="Цель приёма (Б/Ж/У слота)">🎯</span>
                  <span onClick={()=>timeEdit.open(mi, dayPlan)} style={{fontSize:10,padding:'2px 5px',borderRadius:4,background:'rgba(59,130,246,0.06)',border:'1px solid rgba(59,130,246,0.12)',color:'#60a5fa',cursor:'pointer',fontWeight:600}} title="Изменить время приёма">🕒</span>
                  <span onClick={()=>setRecipePickerMeal({dayIdx,mealIdx:mi,label:m.label})} style={{fontSize:10,padding:'2px 5px',borderRadius:4,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.15)',color:'#a78bfa',cursor:'pointer',fontWeight:600}}>🍳</span>
                  <span onClick={()=>{setQuickAddMealIdx(mi);setQuickAddSearch('');}} style={{fontSize:10,padding:'2px 5px',borderRadius:4,background:'rgba(0,230,138,0.08)',border:'1px solid rgba(0,230,138,0.15)',color:'#00e68a',cursor:'pointer',fontWeight:600}}>+</span>
                  <span onClick={()=>{ try { // E7: локальная дата (toISOString уезжал на завтра вечером в UTC+3..+12)
                    const _d = new Date(); const _iso = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
                    const data=readDiaryV2(); if(!data[_iso]) data[_iso]={meals:{}}; const label=m.label||'Приём пищи'; if(!data[_iso].meals[label]) data[_iso].meals[label]=[]; (m.items||[]).forEach((it:any)=>{(data[_iso].meals[label] as any).push({ name:it.name, qty:`${it.amount||100} г` as any, kcal:Math.round(it.kcal||0), p:Math.round((it.p||0)*10)/10, f:Math.round((it.f||0)*10)/10, c:Math.round((it.c||0)*10)/10, category:it.category, foodId:it.id, micros:it.micros });}); writeDiaryV2(data); if(typeof (window as any).showToast==='function') (window as any).showToast(`📒 ${label} → дневник`, 'success'); } catch {} }} style={{fontSize:10,padding:'2px 5px',borderRadius:4,background:'rgba(0,230,138,0.06)',border:'1px solid rgba(0,230,138,0.2)',color:'#00e68a',cursor:'pointer',fontWeight:600}} title="Добавить приём в дневник">📒</span>
                  <span onClick={()=>{ /* E2: единый ctx-хелпер — синк в weekPlan при weekEditDay */ (ctx as any).duplicateMeal?.(mi); }} style={{fontSize:10,padding:'2px 5px',borderRadius:4,background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.12)',color:'#818cf8',cursor:'pointer',fontWeight:600}}>📋</span>
                  <span onClick={()=>removeMealRebalanced(dayIdx, mi)} title="Пропустить приём — день пересоберётся без него" style={{fontSize:10,padding:'2px 5px',borderRadius:4,background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.12)',color:'#ef4444',cursor:'pointer',fontWeight:600}}>✕</span>
                </div>
              </div>
              <div style={{padding:'6px 10px 8px',background:'#18181b'}}>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>{m.items.map((it:any,ii:number)=>{const isEditing=editItem?.mealIdx===mi&&editItem?.itemIdx===ii;const isReplacing=replacingItem?.mealIdx===mi&&replacingItem?.itemIdx===ii;return<span key={ii} draggable={!isEditing&&!isReplacing} onDragStart={e=>{e.dataTransfer.setData('text/plain',`${mi}:${ii}`);setDraggedItem({mealIdx:mi,itemIdx:ii});}} style={{padding:'6px 10px',borderRadius:10,fontSize:10.5,background:isEditing?'rgba(59,130,246,0.10)':isReplacing?'rgba(245,158,11,0.10)':'linear-gradient(180deg, rgba(40,40,46,0.92), rgba(30,30,34,0.96))',border:`1px solid ${isEditing?'rgba(59,130,246,0.28)':isReplacing?'rgba(245,158,11,0.28)':'rgba(255,255,255,0.08)'}`,cursor:'grab',color:'#fff',display:'inline-flex',alignItems:'center',gap:5,flexWrap:'wrap', boxShadow: isEditing||isReplacing ? '0 0 0 2px rgba(255,255,255,0.06)' : '0 2px 8px rgba(0,0,0,0.18)', transition:'all 0.15s'}}>
                    {isEditing?<><input type="number" defaultValue={it.amount} onChange={e=>setEditAmount(+e.target.value||0)} style={{width:40,padding:'1px 4px',borderRadius:3,border:'1px solid rgba(255,255,255,0.06)',background:'#18181b',color:'#fff',fontSize:8}}/><span style={{fontSize:10,color:'rgba(255,255,255,0.85)'}}>г</span><button onClick={()=>setEditAmount((prev: any) =>Math.round((prev||it.amount)+25))} style={{padding:'1px 3px',borderRadius:3,border:'1px solid rgba(59,130,246,0.2)',background:'rgba(59,130,246,0.08)',color:'#60a5fa',cursor:'pointer',fontSize:6}}>+25</button><button onClick={()=>setEditAmount((prev: any) =>Math.round((prev||it.amount)*2))} style={{padding:'1px 3px',borderRadius:3,border:'1px solid rgba(139,92,246,0.2)',background:'rgba(139,92,246,0.08)',color:'#a78bfa',cursor:'pointer',fontSize:6}}>×2</button><button onClick={()=>setEditAmount((prev: any) =>Math.round((prev||it.amount)/2))} style={{padding:'1px 3px',borderRadius:3,border:'1px solid rgba(245,158,11,0.2)',background:'rgba(245,158,11,0.08)',color:'#f59e0b',cursor:'pointer',fontSize:6}}>÷2</button><button onClick={()=>updateItemAmount(dayIdx,mi,ii,editAmount||it.amount)} style={{padding:'1px 4px',borderRadius:3,border:'none',background:'rgba(0,230,138,0.15)',color:'#00e68a',cursor:'pointer',fontSize:10}}>✓</button><button onClick={()=>setEditItem(null)} style={{padding:'1px 4px',borderRadius:3,border:'none',background:'rgba(239,68,68,0.1)',color:'#ef4444',cursor:'pointer',fontSize:10}}>✕</button></>
                    :isReplacing?<><span style={{fontWeight:600}}>{it.name}</span><select onChange={(e: any)=>{if(e.target.value){const f=FOOD_DB.find(x=>x.id===e.target.value);if(f)replaceFoodItem(dayIdx,mi,ii,f);}}} value="" style={{fontSize:10,padding:'1px 2px',borderRadius:3,border:'1px solid rgba(255,255,255,0.06)',background:'#18181b',color:'#fff',maxWidth:120}}><option value="">🔀 Заменить...</option>{(() => { let _sim: any[] | undefined = _similarFoodsCache.get(it); if (!_sim) { _sim = findSimilarFoods(it) as any[]; _similarFoodsCache.set(it, _sim as any); } return (_sim as any[]).map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>); })()}</select></>
                    :<><span style={{fontWeight:700, fontSize:11, letterSpacing:'-0.1px'}}>{it.name}</span>{preferredFoods.includes(it.id)&&<span style={{fontSize:11,color:'#fbbf24',padding:'0 1px', filter:'drop-shadow(0 1px 2px rgba(0,0,0,0.4))'}} title="Любимый продукт">⭐</span>}<span style={{color:'#fff',fontSize:10, fontWeight:700, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.08)', padding:'1px 6px', borderRadius:999}}>{(() => { const food = FOOD_DB.find((f:any)=>f.id===it.id); const isPowder = food?.foodState==='powder' || (food?.category==='supplement' && it.amount<=80); if (isPowder) { const perScoop = (()=>{ try{ const m=(food?.servingSize||'').match(/(\d+(\.\d+)?)/); const v=m?parseFloat(m[1]):30; return v>0&&v<100?v:30;}catch{return 30}})(); const scoops=it.amount/perScoop; const sTxt = scoops===1?'1 скуп': scoops<1? scoops.toFixed(1)+' скупы' : Number.isInteger(scoops)? `${scoops} скупов` : `${scoops.toFixed(1)} скупов`; return `${it.amount}г (${sTxt})`; } const _wm = displayAmount(it.id, it.amount, _weightMode); return _wm.suffix ? `${_wm.grams}г ${_wm.suffix}` : `${it.amount}г`; })()}</span>{(() => { const food = FOOD_DB.find((f: any) => f.id === it.id); return food ? <OrganLoadBadgeGroup food={food} healthIssues={healthIssues || []} /> : null; })()}{lockedFoodIds.has(it.id)&&<span style={{fontSize:10,color:'#f59e0b',padding:'0 2px'}} title="Закреплено — не изменится при регенерации">🔒</span>}<span onClick={()=>addToCart({name:it.name,kcal:it.kcal*(it.amount/100),amount:it.amount,category:it.category})} style={{cursor:'pointer',fontSize:10,display:'inline-flex',alignItems:'center',justifyContent:'center',width:22,height:22,borderRadius:7,background:'rgba(0,230,138,0.10)',border:'1px solid rgba(0,230,138,0.14)', color:'#6ee7b7'}} title="В корзину">🛒</span><span onClick={()=>toggleLockFood(it.id)} style={{cursor:'pointer',fontSize:10,display:'inline-flex',alignItems:'center',justifyContent:'center',width:22,height:22,borderRadius:7,background: lockedFoodIds.has(it.id) ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.06)', border: `1px solid ${lockedFoodIds.has(it.id)?'rgba(245,158,11,0.22)':'rgba(255,255,255,0.08)'}`, color:lockedFoodIds.has(it.id)?'#fbbf24':'rgba(255,255,255,0.6)'}} title={lockedFoodIds.has(it.id)?'Открепить':'Закрепить (не изменится при регенерации)'}>{lockedFoodIds.has(it.id)?'🔓':'🔒'}</span><span onClick={()=>{setEditItem({dayIdx,mealIdx:mi,itemIdx:ii});setEditAmount(it.amount);}} style={{cursor:'pointer',fontSize:10,display:'inline-flex',alignItems:'center',justifyContent:'center',width:22,height:22,borderRadius:7,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',color:'#e5e7eb'}} title="Изменить граммовку">✏️</span><span onClick={()=>setReplacingItem({dayIdx,mealIdx:mi,itemIdx:ii})} style={{cursor:'pointer',fontSize:10,display:'inline-flex',alignItems:'center',justifyContent:'center',width:22,height:22,borderRadius:7,background:'rgba(245,158,11,0.10)',border:'1px solid rgba(245,158,11,0.16)',color:'#fbbf24'}} title="Заменить продукт">🔄</span><span onClick={()=>{ const upd = [...new Set([...excludedFoods, it.id])]; setExcludedFoods(upd); try { localStorage.setItem('he_excluded_foods', JSON.stringify(upd)); } catch {} removeFoodItem(dayIdx,mi,ii); }} style={{cursor:'pointer',fontSize:10,color:'rgba(239,68,68,0.45)',padding:'0 2px'}} title='Исключить навсегда — не появится в регенерациях'>🚫</span><span onClick={()=>removeFoodItem(dayIdx,mi,ii)} style={{cursor:'pointer',fontSize:10,color:'rgba(239,68,68,0.3)',padding:'0 2px'}} title='Убрать из этого плана'>✕</span></>}
                  </span>;})}</div>
                {m.totals&&<div style={{display:'flex',gap:6,marginTop:8,padding:'6px 8px',borderRadius:10,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.05)',fontSize:10,alignItems:'center',flexWrap:'wrap'}}>{(() => { const tg = m.target; const fmt = (v: number, t: number|undefined, color: string) => { if (!t || t <= 0) return <span style={{color,fontWeight:700, fontSize:11}}>{v}г</span>; const dev = v - t; const ok = Math.abs(dev) <= 3; return <span style={{color,fontWeight:700, fontSize:11, display:'inline-flex', alignItems:'center', gap:3}}>{v}<span style={{color:'rgba(255,255,255,0.35)'}}>/ {t}г</span>{ok?null:<span style={{fontSize:9,color:dev>0?'#f87171':'#fbbf24',fontWeight:800, background: dev>0?'rgba(239,68,68,0.10)':'rgba(245,158,11,0.10)', padding:'1px 5px', borderRadius:999, border:`1px solid ${dev>0?'rgba(239,68,68,0.18)':'rgba(245,158,11,0.18)'}`}}>{dev>0?('+'+Math.round(dev)):(''+Math.round(dev))}</span>}</span>; }; return <span style={{display:'contents'}}>{fmt(mealP,tg?.p,'#60a5fa')}<span style={{color:'rgba(255,255,255,0.14)',margin:'0 4px'}}>·</span>{fmt(mealF,tg?.f,'#fbbf24')}<span style={{color:'rgba(255,255,255,0.14)',margin:'0 4px'}}>·</span>{fmt(mealC,tg?.c,'#fb923c')}</span>; })()}{plannerMode === 'pro' && mealDiaas.diaas > 0 && <span style={{fontSize:10,fontWeight:800,color:mealDiaas.diaas >= 1 ? '#86efac' : mealDiaas.diaas >= 0.75 ? '#fbbf24' : '#fca5a5',background:(mealDiaas.diaas >= 1 ? 'rgba(34,197,94,0.12)' : mealDiaas.diaas >= 0.75 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)'),padding:'2px 7px',borderRadius:999, border:`1px solid ${mealDiaas.diaas >= 1 ? 'rgba(34,197,94,0.18)' : mealDiaas.diaas >= 0.75 ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.18)'}`}}>DIAAS {mealDiaas.diaas.toFixed(2)}</span>}{plannerMode === 'pro' && mealGL > 0 && <span style={{fontSize:10,fontWeight:800,color:mealGL<10?'#86efac':mealGL<=20?'#fbbf24':'#fca5a5',background:(mealGL<10?'rgba(34,197,94,0.12)':mealGL<=20?'rgba(245,158,11,0.12)':'rgba(239,68,68,0.12)'),padding:'2px 7px',borderRadius:999, border:`1px solid ${mealGL<10?'rgba(34,197,94,0.18)':mealGL<=20?'rgba(245,158,11,0.18)':'rgba(239,68,68,0.18)'}`}} title={'Glycemic Load: ' + mealGL + (isPostWorkout ? ' (high GL ok post-workout)' : '')}>GL {mealGL}</span>}{plannerMode === 'pro' && mealII > 0 && <span style={{fontSize:10,fontWeight:800,color:mealII<40?'#86efac':mealII<=70?'#fbbf24':'#fca5a5',background:(mealII<40?'rgba(34,197,94,0.12)':mealII<=70?'rgba(245,158,11,0.12)':'rgba(239,68,68,0.12)'),padding:'2px 7px',borderRadius:999, border:`1px solid ${mealII<40?'rgba(34,197,94,0.18)':mealII<=70?'rgba(245,158,11,0.18)':'rgba(239,68,68,0.18)'}`}} title={'Insulin Index (kcal-weighted): ' + mealII}>II {mealII}</span>}{plannerMode === 'pro' && m.mpsCheck && m.mpsCheck.triggers_mTOR && <span style={{fontSize:10,fontWeight:600,color:'#00e68a',background:'rgba(0,230,138,0.08)',padding:'1px 5px',borderRadius:4}} title={'+' + m.mpsCheck.leucineG + 'g leucine, MPS triggered'}>{'\uD83E\uDDEC mTOR'}</span>}{plannerMode === 'pro' && m.mpsCheck && !m.mpsCheck.triggers_mTOR && m.mpsCheck.proteinG > 0 && <span style={{fontSize:10,fontWeight:600,color:'#f59e0b',background:'rgba(245,158,11,0.08)',padding:'1px 5px',borderRadius:4}} title={'Leucine ' + m.mpsCheck.leucineG + 'g < 2.5g threshold'}>{'\u26A0\uFE0F ' + m.mpsCheck.leucineG + 'g'}</span>}{m.synergyNotes&&m.synergyNotes.length>0&&<span style={{fontSize:10,color:'#22c55e',fontWeight:600}} title={m.synergyNotes.join('; ')}>✅ {(m.synergyNotes as string[]).length} синерги{((m.synergyNotes as string[]).length>1?'й':'я')}</span>}{m.conflictWarnings&&m.conflictWarnings.length>0&&<span style={{fontSize:10,color:'#ef4444',fontWeight:600}} title={m.conflictWarnings.join('; ')}>⚠️ {(m.conflictWarnings as string[]).length} конфликт{((m.conflictWarnings as string[]).length>1?'ов':'')}</span>}</div>}
                {Array.isArray(m.recipeOptions) && m.recipeOptions.length > 0 && (
                  <div style={{marginTop:4,display:'flex',flexDirection:'column',gap:3}}>
                    <div style={{fontSize:8,fontWeight:700,color:'#f97316',padding:'2px 0'}}>🍳 Варианты рецептов — выберите один, рацион перестроится:{m.recipeApplied ? <span style={{color:'#22c55e',fontWeight:600}}> выбрано «{m.recipeApplied}»{m.recipeApplied2 ? ` + «${m.recipeApplied2}»` : ''}</span> : null}</div>
                    {/* Пресеты подбора (масса = большое У, сушка, белок…) */}
                    {renderPresetRow(m.recipeOptions as any[])}
                    {(m.recipeOptions as any[]).filter((r:any)=>recipeMatchesPreset(r, recipePreset)).map((r: any, ri: number) => {
                      const selected = m.recipeApplied === r.name || m.recipeApplied2 === r.name;
                      return (
                        <details key={ri} style={{borderRadius:8,background:selected?'rgba(34,197,94,0.08)':'rgba(249,115,22,0.06)',border:`1px solid ${selected?'rgba(34,197,94,0.35)':'rgba(249,115,22,0.12)'}`,overflow:'hidden'}}>
                          <summary style={{cursor:'pointer',padding:'3px 6px',fontSize:8,listStyle:'none',display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                            <span role="button" aria-label={`Выбрать рецепт ${r.name}`} onClick={(e)=>{e.preventDefault();e.stopPropagation();pickRecipeOption(dayIdx,mi,r.name);}} style={{padding:'2px 7px',borderRadius:6,border:`1px solid ${selected?'rgba(34,197,94,0.5)':'rgba(249,115,22,0.35)'}`,background:selected?'rgba(34,197,94,0.18)':'rgba(249,115,22,0.12)',color:selected?'#22c55e':'#f97316',fontWeight:800,cursor:'pointer'}}>{selected?'✅ Выбрано':'Выбрать'}</span>
                            <span role="button" aria-label={isFavoriteRecipe(r.name)?`Убрать ${r.name} из избранного`:`Добавить ${r.name} в избранное`} title="В избранное (⭐ — приоритет в подборе)" onClick={(e)=>{e.preventDefault();e.stopPropagation();toggleFavoriteRecipe(r.name);}} style={{cursor:'pointer',fontSize:10,color:isFavoriteRecipe(r.name)?'#f59e0b':'rgba(255,255,255,0.35)'}}>{isFavoriteRecipe(r.name)?'⭐':'☆'}</span>
                            <span style={{fontWeight:600,color:'#fff'}}>{r.name}</span>
                            <span style={{color:'rgba(255,255,255,0.65)'}}>{r.kcal}ккал · Б{r.protein}г Ж{r.fat}г У{r.carbs}г · ⏱{r.prepTimeMin}мин</span>
                            {typeof r.fitPct==='number' && (() => { const ok=r.fitPct>=90&&r.fitPct<=110; const warn=!ok&&(r.fitPct>=75&&r.fitPct<=130); return <span title={`После масштабирования закроет приём на ~${r.fitPct}% целевой калорийности`} style={{fontSize:7,padding:'1px 5px',borderRadius:999,fontWeight:800, background:ok?'rgba(34,197,94,0.12)':warn?'rgba(245,158,11,0.10)':'rgba(239,68,68,0.10)', border:`1px solid ${ok?'rgba(34,197,94,0.3)':warn?'rgba(245,158,11,0.28)':'rgba(239,68,68,0.24)'}`, color:ok?'#22c55e':warn?'#fbbf24':'#f87171'}}>~{r.fitPct}% приёма</span>; })()}
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
                {m.recipeApplied && (
                  <button onClick={() => setRecipePickerMeal({ dayIdx, mealIdx: mi, label: m.label })}
                    title={m.recipeApplied2 ? `Заменить второй рецепт (сейчас «${m.recipeApplied2}»)` : 'Добавить второе блюдо к этому приёму (не дубль — совместимое)'}
                    style={{
                      display:'flex', alignItems:'center', gap:6, width:'100%', marginTop:6,
                      padding:'7px 10px', borderRadius:10, cursor:'pointer', fontSize:9, fontWeight:700, minHeight:44,
                      background: m.recipeApplied2 ? 'rgba(245,158,11,0.08)' : 'rgba(139,92,246,0.08)',
                      border: m.recipeApplied2 ? '1px dashed rgba(245,158,11,0.4)' : '1px dashed rgba(139,92,246,0.45)',
                      color: m.recipeApplied2 ? '#fbbf24' : '#c4b5fd',
                    }}>
                    {m.recipeApplied2 ? '🍳 Заменить второй рецепт' : '➕ Добавить второй рецепт в приём'}
                  </button>
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
        <div style={{marginTop:10,borderRadius:16,overflow:'hidden',border:'1px solid rgba(0,230,138,0.16)', background:'linear-gradient(180deg, rgba(22,22,26,0.98), rgba(18,18,20,0.96))', boxShadow:'0 8px 24px rgba(0,0,0,0.22)'}}>
          <div style={{padding:'12px 14px',background:'linear-gradient(135deg, rgba(0,230,138,0.07) 0%, rgba(0,230,138,0.02) 54%, transparent 100%)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><span style={{fontSize:10,fontWeight:800,color:'rgba(255,255,255,0.55)',letterSpacing:'0.8px'}}>ИТОГО ЗА ДЕНЬ</span><span style={{color:'#00e68a',fontWeight:900,fontSize:18, letterSpacing:'-0.4px'}}>{totalKcal.toLocaleString('ru-RU')} <span style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.45)'}}>ккал</span></span></div>
            <div style={{display:'flex',gap:10}}>
              {[{label:'Белки',val:totalP,unit:'г',color:'#60a5fa',bg:'#60a5fa',target:effectiveP},{label:'Жиры',val:totalF,unit:'г',color:'#fbbf24',bg:'#f59e0b',target:effectiveF},{label:'Углеводы',val:totalC,unit:'г',color:'#fb923c',bg:'#f97316',target:effectiveC}].map(m=>{const pct=Math.min(100,Math.round(m.val/Math.max(1,m.target)*100));const isOver=pct>100;return(<div key={m.label} style={{flex:1, padding:'8px 8px 6px', borderRadius:12, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)'}}><div style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:4, alignItems:'center'}}><span style={{color:m.color,fontWeight:700, fontSize:10, display:'inline-flex', alignItems:'center', gap:4}}><span style={{width:6,height:6,borderRadius:'50%', background:m.bg}} />{m.label}</span><span style={{color: isOver ? '#f87171' : '#fff',fontWeight:800, fontSize:10}}>{m.val}<span style={{color:'rgba(255,255,255,0.42)', fontWeight:600}}>/{m.target}</span></span></div><div style={{height:6,borderRadius:999,background:'rgba(255,255,255,0.06)',overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,pct)}%`,borderRadius:999,background: isOver ? '#ef4444' : `linear-gradient(90deg, ${m.bg}, ${m.color})`,transition:'width 0.4s ease', boxShadow: isOver ? '0 0 8px rgba(239,68,68,0.4)' : `0 0 8px ${m.bg}44`}}/></div><div style={{fontSize:10,color: isOver ? '#f87171' : 'rgba(255,255,255,0.55)',textAlign:'right',marginTop:3, fontWeight:700}}>{isOver?`+${pct-100}%`:`${pct}%`}{isOver ? ' • перебор' : pct >= 92 && pct <= 108 ? ' • норма' : ''}</div></div>);})}
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
        {mealTargetEditor && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }} onClick={() => setMealTargetEditor(null)}>
            <div onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 340, padding: 16, borderRadius: 16, background: '#18181b', border: '1px solid rgba(249,115,22,0.2)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fb923c', marginBottom: 8, textAlign: 'center' }}>🎯 Цель приёма «{mealTargetEditor.label}»</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', marginBottom: 8, textAlign: 'center', lineHeight: 1.5 }}>Граммы Б/Ж/У слота (0 = не менять). Применяется при следующей генерации плана — порции приёма масштабируются к цели (0.7–1.4×, белок не режется ниже 0.8×).</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
                {(['p', 'f', 'c'] as const).map(k => (
                  <div key={k}>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', marginBottom: 3, textAlign: 'center' }}>{k === 'p' ? '🥩 Белок' : k === 'f' ? '🧈 Жиры' : '🍚 Углеводы'} (г)</div>
                    <input type="number" min={0} value={mealTargetEditor[k]} onChange={e => setMealTargetEditor({ ...mealTargetEditor, [k]: e.target.value })} placeholder="0" style={{ width: '100%', padding: '7px 4px', borderRadius: 8, textAlign: 'center', background: '#202023', border: '1px solid rgba(249,115,22,0.25)', color: '#fb923c', fontSize: 13, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setMealTargetEditor(null)} style={{ flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.12)', background: '#202023', color: 'rgba(255,255,255,0.85)', fontSize: 10 }}>Отмена</button>
                <button onClick={() => saveMealTarget(mealTargetEditor.label)} style={{ flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg,#f97316,#fb923c)', color: '#fff', fontSize: 10, fontWeight: 700 }}>✓ Сохранить</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
}

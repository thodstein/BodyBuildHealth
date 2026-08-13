/**
 * MealListRender.tsx вЂ” P1-7: renderMealList РІС‹РЅРµСЃРµРЅ РёР· IndividualPlanContext.tsx (267 СЃС‚СЂРѕРє).
 *
 * РҐСѓРє useRenderMealList() РІРѕР·РІСЂР°С‰Р°РµС‚ С„СѓРЅРєС†РёСЋ СЂРµРЅРґРµСЂР°, РєРѕС‚РѕСЂР°СЏ РёСЃРїРѕР»СЊР·СѓРµС‚ РєРѕРЅС‚РµРєСЃС‚ РїР»Р°РЅРёСЂРѕРІС‰РёРєР°.
 * Р’ IndividualPlanContext: const renderMealList = useRenderMealList();
 */
import React, { useState } from "react";
import { addToCart } from "../../../../core/nutrition-utils";
import { FOOD_DB } from "../../../../core/nutrition-database";
import { calcMealDIAAS } from "../../../../engines/product-usefulness-v2.engine";
import { scoreFoodsForKBJU, getMealKBJUTarget, getMealCurrentKBJU } from "../../../../engines/kbju-food-match.engine";
import type { PlanCtx } from "./IndividualPlanContext";
import { NUTRITION_LEVELS } from "./types";
import { OrganLoadBadgeGroup } from "./OrganLoadBadges";

export function useRenderMealList(ctx: Omit<PlanCtx, 'renderMealList'>) {
  const { calcTargets, dayPlan, draggedItem, dropTarget, drugCompatReport, editAmount, editItem, effectiveC, effectiveF, effectiveKcal, effectiveP, excludedFoods, findSimilarFoods, healthIssues, injections, linkToTraining, lockedFoodIds, moveFoodItem, nutritionReport, nutrLevel, phase, preferredFoods, quickAddMealIdx, quickAddSearch, removeFoodItem, replaceFoodItem, replacingItem, saveUndo, setDayPlan: _setDayPlan, setDraggedItem, setDropTarget, setEditAmount: _setEditAmount, setEditItem, setExcludedFoods, setQuickAddMealIdx, setQuickAddSearch, setRecipePickerMeal, setReplacingItem, toggleLockFood, trainEnd, trainStart, updateItemAmount, waterCalc, weight, weightLogEntries, addFoodToMeal } = ctx;
  const _nutrMult = NUTRITION_LEVELS.find(l => l.id === nutrLevel)?.mult || 1.0;
  const setDayPlan = _setDayPlan as any;
  const setEditAmount = _setEditAmount as any;
  return (dayData: any, editable = false, dayIdx = 0) => {
    if (!dayData) return null;
    const d = dayData; const totalKcal = Math.round(d.totals?.kcal || 0); const totalP = Math.round(d.totals?.p || 0); const totalF = Math.round(d.totals?.f || 0); const totalC = Math.round(d.totals?.c || 0); const totalFiber = Math.round(d.totals?.fiber || 0);
    const pKcalPct = totalKcal > 0 ? (totalP * 4 / totalKcal) * 100 : 0; const fKcalPct = totalKcal > 0 ? (totalF * 9 / totalKcal) * 100 : 0; const cKcalPct = totalKcal > 0 ? (totalC * 4 / totalKcal) * 100 : 0;
    return (
      <div>
        <div style={{marginBottom:10,borderRadius:12,overflow:'hidden',border:d.isTrainingDay?'1px solid rgba(0,230,138,0.2)':'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{padding:'10px 12px',background:d.isTrainingDay?'linear-gradient(135deg, rgba(0,230,138,0.1), rgba(0,200,160,0.03))':'#202023'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <span style={{fontSize:20,filter:d.isTrainingDay?'none':'grayscale(0.5)'}}>{d.isTrainingDay?'рџЏ‹пёЏ':'рџґ'}</span>
              <div style={{flex:1}}><div style={{fontSize:12,fontWeight:800,color:d.isTrainingDay?'#00e68a':'rgba(255,255,255,0.85)'}}>{d.isTrainingDay?'рџЏ† РўР Р•РќРР РћР’РћР§РќР«Р™ Р”Р•РќР¬':'рџґ Р”Р•РќР¬ РћРўР”Р«РҐРђ'}</div> <span style={{fontSize:10,fontWeight:700,color:'#a78bfa',background:'rgba(167,139,250,0.12)',padding:'1px 5px',borderRadius:6,border:'1px solid rgba(167,139,250,0.25)',marginLeft:4,verticalAlign:'middle'}}>Pro РґРІРёР¶РѕРє</span>
              {weightLogEntries.length >= 3 && (() => { const vals = weightLogEntries.map(e => e.weight); const min = Math.min(...vals); const max = Math.max(...vals); const range = max - min || 1; const h = 24; const w = 80; const pts = vals.map((v,i) => `${Math.round(i/(vals.length-1)*w)},${Math.round(h-(v-min)/range*h)}`).join(' '); const trend = vals.length >= 2 && vals[vals.length-1] < vals[0]; return (<div style={{display:'inline-flex',alignItems:'center',gap:3,marginLeft:6}}><svg width={w} height={h} style={{verticalAlign:'middle'}}><polyline points={pts} fill="none" stroke={trend?'#22c55e':'#ef4444'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/></svg><span style={{fontSize:10,color:trend?'#22c55e':'#ef4444',fontWeight:600}}>{trend?'в†“':'в†‘'} {Math.abs(vals[vals.length-1]-vals[0]).toFixed(1)} РєРі</span></div>); })()}</div>
              <div style={{padding:'4px 10px',borderRadius:8,background:d.isTrainingDay?'rgba(0,230,138,0.1)':'rgba(255,255,255,0.03)',border:d.isTrainingDay?'1px solid rgba(0,230,138,0.2)':'1px solid rgba(255,255,255,0.06)'}}>
                <div style={{fontSize:16,fontWeight:900,color:Math.abs(totalKcal-(effectiveKcal||0))<=Math.max(50,(effectiveKcal||0)*0.08)?'#00e68a':'#f59e0b',lineHeight:1}}>{totalKcal}<span style={{fontSize:8,fontWeight:400,color:'rgba(255,255,255,0.5)'}}>/{effectiveKcal||'---'}</span></div>
                {effectiveKcal>0 && (() => { const dk=Math.round(totalKcal-effectiveKcal); const dkp=Math.round((totalKcal-effectiveKcal)/effectiveKcal*100); const ok=Math.abs(dk)<=Math.max(50,Math.round(effectiveKcal*0.05)); return <div style={{fontSize:10,fontWeight:700,color:ok?'#22c55e':(dk>0?'#f59e0b':'#60a5fa')}}>О”{dk>=0?'+':''}{dk} ({dk>=0?'+':''}{dkp}%)</div>; })()}
                <div style={{fontSize:10,color:'rgba(255,255,255,0.85)',textAlign:'center'}}>РєРєР°Р»</div>
              </div>
            </div>
                        <div style={{display:'flex',gap:8,fontSize:9,flexWrap:'wrap',alignItems:'center'}}>
              {(() => {
                // РљР‘Р–РЈ: Р¦РµР»СЊ/Р¤Р°РєС‚/О” СЏРІРЅРѕ вЂ” СЂР°СЃС…РѕР¶РґРµРЅРёРµ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ РїРѕРЅСЏС‚РЅС‹Рј, Р° РЅРµ В«РЅРµРїРѕРЅСЏС‚РЅС‹Р№ РїРµСЂРµР±РѕСЂВ»
                const fmt = (val:number, tgt:number, unit:string) => {
                  if (!tgt) return `${val}${unit}`;
                  const d = Math.round(val - tgt);
                  const dp = Math.round((val - tgt) / tgt * 100);
                  const ok = Math.abs(d) <= Math.max(5, Math.round(tgt * 0.05));
                  const col = ok ? '#22c55e' : (d > 0 ? '#f59e0b' : '#60a5fa');
                  return <><b style={{fontWeight:800}}>{val}{unit}</b><span style={{fontSize:10,color:'rgba(255,255,255,0.45)'}}>/{tgt}{unit}</span> <span style={{fontSize:10,color:col,fontWeight:700}}>О”{d>=0?'+':''}{d}{unit} ({d>=0?'+':''}{dp}%)</span></>;
                };
                return <>
                  <span style={{color:'#3b82f6',fontWeight:600}}>рџ’Є Р‘ {fmt(totalP, effectiveP||0, 'Рі')}</span>
                  <span style={{color:'#f59e0b',fontWeight:600}}>рџ§€ Р– {fmt(totalF, effectiveF||0, 'Рі')}</span>
                  <span style={{color:'#f97316',fontWeight:600}}>рџЊѕ РЈ {fmt(totalC, effectiveC||0, 'Рі')}</span>
                  {totalFiber > 0 && <span style={{color:'#22c55e',fontSize:8,fontWeight:600}}>рџЊ± {totalFiber}Рі</span>}
                  <span style={{marginLeft:'auto',color:'rgba(255,255,255,0.85)'}}>{weight>0?`${Math.round(totalP/weight)}Рі/РєРі`:''}</span>
                </>;
              })()}
            </div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.42)',marginTop:3,lineHeight:1.3}}>
              Р¦РµР»СЊ СЃРѕР±СЂР°РЅР° РёР·: Р±Р°Р·Р° <b style={{color:'#3b82f6'}}>{calcTargets.protein}Рі</b> В· РјРЅРѕР¶. СѓСЂРѕРІРЅСЏ <b style={{color:'#00e68a'}}>{(_nutrMult||1).toFixed(2)}Г—</b> В· С„Р°Р·Р° В«<b style={{color:'#a78bfa'}}>{phase}</b>В»{injections.some(i=>i.type==='РђРђРЎ')?(' В· +AAS ' + Math.round(weight*0.3) + 'Рі'):''} в†’ РёС‚РѕРіРѕ <b style={{color:'#fff'}}>{effectiveP}Рі</b> Р±РµР»РєР° / <b style={{color:'#fff'}}>{effectiveKcal}</b> РєРєР°Р»
            </div>
          </div>
          {nutritionReport && (() => { const r = nutritionReport; const chip = (ok: boolean, label: string, val: string) => (<div style={{display:'inline-flex',alignItems:'center',gap:3,padding:'2px 6px',borderRadius:6,fontSize:10,fontWeight:600,background:ok?'rgba(0,230,138,0.08)':'rgba(245,158,11,0.08)',border:`1px solid ${ok?'rgba(0,230,138,0.2)':'rgba(245,158,11,0.25)'}`,color:ok?'#22c55e':'#f59e0b'}}><span style={{width:5,height:5,borderRadius:'50%',background:ok?'#22c55e':'#f59e0b'}} />{label} {val}</div>); const mpsOk = (r.proteinTiming?.evennessScore||0) >= 70; const fibOk = (r.fiberAnalysis?.pct||0) >= 80; const glOk = r.glycemicLoad?.status !== 'high'; const satOk = (r.fatQuality?.satPct||0) <= 15; const nakOk = r.sodiumPotassium?.status === 'ok'; const pralOk = r.pral?.status === 'ok' || r.pral?.status === 'mild'; const o3 = r.fatQuality?.omega3G||0; const o3Ok = o3 >= 1.6; return (<div style={{marginTop:6,padding:'6px 8px',borderRadius:8,background:'rgba(139,92,246,0.04)',border:'1px solid rgba(139,92,246,0.12)'}}><div style={{fontSize:8,fontWeight:700,color:'#a78bfa',marginBottom:4}}>рџ©є Р”РёРµС‚РѕР»РѕРіРёСЏ</div><div style={{display:'flex',flexWrap:'wrap',gap:4}}>{chip(mpsOk,'MPS',(r.proteinTiming?.evennessScore||0).toFixed(0)+'%')}{chip(fibOk,'РљР»РµС‚С‡.',(r.fiberAnalysis?.totalG||0).toFixed(0)+'Рі')}{chip(glOk,'Р“Рќ',r.glycemicLoad?.status==='high'?'РІС‹СЃ.':r.glycemicLoad?.status==='low'?'РЅРёР·Рє.':'РЅРѕСЂРјР°')}{chip(satOk,'РќР°СЃ.Р¶РёСЂ',(r.fatQuality?.satPct||0).toFixed(0)+'%')}{chip(nakOk,'Na:K',(r.sodiumPotassium?.ratio||0).toFixed(1)+':1')}{chip(pralOk,'PRAL',(r.pral?.mEq||0)+'РјСЌРєРІ')}{chip(o3Ok,'О©3',o3.toFixed(1)+'Рі')}</div></div>); })()}
          {drugCompatReport?.warnings && drugCompatReport.warnings.length > 0 && drugCompatReport.warnings[0] && !drugCompatReport.warnings[0].includes('СЃРѕРІРјРµСЃС‚РёРјС‹') && (<div style={{marginTop:6,padding:'6px 8px',borderRadius:8,background:'rgba(239,68,68,0.04)',border:'1px solid rgba(239,68,68,0.12)'}}><div style={{fontSize:8,fontWeight:700,color:'#ef4444',marginBottom:4}}>вљ  Р›РµРєР°СЂСЃС‚РІР° Г— РїРёС‚Р°РЅРёРµ</div>{drugCompatReport.warnings.slice(0,4).map((w: string, i: number) => <div key={i} style={{fontSize:10,color:'rgba(255,255,255,0.75)',marginBottom:2}}>{w}</div>)}</div>)}

          <div style={{height:4,display:'flex'}}>
            <div style={{height:'100%',width:`${Math.max(2,pKcalPct)}%`,background:'#3b82f6',minWidth:2}}/>
            <div style={{height:'100%',width:`${Math.max(2,fKcalPct)}%`,background:'#f59e0b',minWidth:2}}/>
            <div style={{height:'100%',width:`${Math.max(2,cKcalPct)}%`,background:'#f97316',minWidth:2,flex:1}}/>
          </div>
        </div>
        {d.allergenWarnings?.length > 0 && <div style={{padding:'6px 10px',borderRadius:8,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',fontSize:8,color:'#ef4444',marginBottom:8,display:'flex',alignItems:'center',gap:4}}><span style={{fontSize:10}}>вљ пёЏ</span><span>{d.allergenWarnings.map((w: any) => typeof w === 'string' ? w : `${w.food}: ${w.allergens.join(', ')}`).join('; ')}</span></div>}
        {d.meals.map((m: any, mi: number) => {
          const mealKcal = Math.round(m.totals?.kcal || 0); const mealP = Math.round(m.totals?.p || 0); const mealF = Math.round(m.totals?.f || 0); const mealC = Math.round(m.totals?.c || 0);
          const mealDiaas = calcMealDIAAS((m.items || []).map((it: any) => ({ foodId: it.id || it.name, weightGrams: it.amount || 100 })));
          const mealGL = Math.round((m.items || []).reduce((s: number, it: any) => { const fd = FOOD_DB.find((f: any) => f.id === it.id); const gi = fd?.gi || 0; return s + (gi * (it.c || 0) / 100); }, 0));
          const mealII = (() => { let wII = 0, wK = 0; (m.items || []).forEach((it: any) => { const fd = FOOD_DB.find((f: any) => f.id === it.id); const ii = fd?.macro_100g?.insulin_index; const k = it.kcal || 0; if (ii != null && k > 0) { wII += ii * k; wK += k; } }); return wK > 0 ? Math.round(wII / wK) : 0; })();
          const isPreWorkout = m.label?.toLowerCase().includes('РїСЂРµРґС‚СЂРµРЅ'); const isPostWorkout = m.label?.toLowerCase().includes('РїРѕСЃС‚-С‚СЂРµРЅ'); const accentColor = isPreWorkout ? '#8b5cf6' : isPostWorkout ? '#f59e0b' : '#00e68a';
          return (
            <div key={mi} style={{marginBottom:6,borderRadius:10,overflow:'hidden',border:`1px solid ${dropTarget===mi?'rgba(0,230,138,0.4)':isPreWorkout?'rgba(139,92,246,0.2)':isPostWorkout?'rgba(245,158,11,0.2)':'rgba(255,255,255,0.15)'}`,transition:'all 0.2s',background:dropTarget===mi?'rgba(0,230,138,0.04)':undefined}}
              onDragOver={e=>{e.preventDefault();setDropTarget(mi);}} onDragLeave={()=>setDropTarget(null)} onDrop={e=>{e.preventDefault();if(draggedItem&&draggedItem.mealIdx!==mi)moveFoodItem(draggedItem.mealIdx,mi,draggedItem.itemIdx);setDropTarget(null);}}>
              <div style={{padding:'7px 10px 5px',background:isPreWorkout?'rgba(139,92,246,0.06)':isPostWorkout?'rgba(245,158,11,0.06)':'#202023',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{fontSize:8,fontWeight:600,color:'rgba(255,255,255,0.85)'}}>{m.time}</span>
                  <span style={{width:3,height:12,borderRadius:2,background:accentColor}}/>
                  <span style={{fontSize:10,fontWeight:700,color:accentColor}}>{m.label}</span>
                  {isPreWorkout&&<span style={{fontSize:10,padding:'1px 5px',borderRadius:4,background:'rgba(139,92,246,0.15)',color:'#a855f7',fontWeight:600}}>Р”Рћ</span>}
                  {isPostWorkout&&<span style={{fontSize:10,padding:'1px 5px',borderRadius:4,background:'rgba(245,158,11,0.15)',color:'#f59e0b',fontWeight:600}}>РџРћРЎР›Р•</span>}
                  {d.timingScores?.[mi] && (
                    <span style={{fontSize:10,padding:'1px 5px',borderRadius:4,fontWeight:600,
                      background:d.timingScores[mi].status==='ideal'?'rgba(34,197,94,0.1)':d.timingScores[mi].status==='good'?'rgba(245,158,11,0.1)':'rgba(239,68,68,0.08)',
                      color:d.timingScores[mi].status==='ideal'?'#22c55e':d.timingScores[mi].status==='good'?'#f59e0b':'#ef4444',
                      border:`1px solid ${d.timingScores[mi].status==='ideal'?'rgba(34,197,94,0.2)':d.timingScores[mi].status==='good'?'rgba(245,158,11,0.2)':'rgba(239,68,68,0.12)'}`}}
                      title={d.timingScores[mi].note}
                    >в…{d.timingScores[mi].score}/10</span>
                  )}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:4}}>
                  <span style={{fontSize:10,fontWeight:800,color:'rgba(255,255,255,0.85)'}}>{mealKcal} РєРєР°Р»</span>
                  <span onClick={()=>setRecipePickerMeal({dayIdx,mealIdx:mi,label:m.label})} style={{fontSize:10,padding:'2px 5px',borderRadius:4,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.15)',color:'#a78bfa',cursor:'pointer',fontWeight:600}}>рџЌі</span>
                  <span onClick={()=>{setQuickAddMealIdx(mi);setQuickAddSearch('');}} style={{fontSize:10,padding:'2px 5px',borderRadius:4,background:'rgba(0,230,138,0.08)',border:'1px solid rgba(0,230,138,0.15)',color:'#00e68a',cursor:'pointer',fontWeight:600}}>+</span>
                  <span onClick={()=>{saveUndo();const copy=JSON.parse(JSON.stringify(dayPlan?.meals?.[mi]));if(!copy)return;setDayPlan((prev:any)=>{if(!prev)return prev;const meals=[...prev.meals];const insertAt=Math.min(mi+1,meals.length);const dup={...copy,label:copy.label+' (РєРѕРїРёСЏ)',time:(()=>{const[h,m]=(copy.time||'12:00').split(':').map(Number);const t=h*60+m+30;return`${String(Math.floor(t/60)%24).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`})()};meals.splice(insertAt,0,dup);const totals={kcal:meals.reduce((s:number,m2:any)=>s+(m2.totals?.kcal||0),0),p:meals.reduce((s:number,m2:any)=>s+(m2.totals?.p||0),0),f:meals.reduce((s:number,m2:any)=>s+(m2.totals?.f||0),0),c:meals.reduce((s:number,m2:any)=>s+(m2.totals?.c||0),0)};return{...prev,meals,totals}});}} style={{fontSize:10,padding:'2px 5px',borderRadius:4,background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.12)',color:'#818cf8',cursor:'pointer',fontWeight:600}}>рџ“‹</span>
                  <span onClick={()=>{saveUndo();setDayPlan((prev:any)=>{if(!prev)return prev;const meals=prev.meals.filter((_:any,i:number)=>i!==mi);const totals={kcal:meals.reduce((s:number,m2:any)=>s+(m2.totals?.kcal||0),0),p:meals.reduce((s:number,m2:any)=>s+(m2.totals?.p||0),0),f:meals.reduce((s:number,m2:any)=>s+(m2.totals?.f||0),0),c:meals.reduce((s:number,m2:any)=>s+(m2.totals?.c||0),0)};return{...prev,meals,totals}});}} style={{fontSize:10,padding:'2px 5px',borderRadius:4,background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.12)',color:'#ef4444',cursor:'pointer',fontWeight:600}}>вњ•</span>
                </div>
              </div>
              <div style={{padding:'6px 10px 8px',background:'#18181b'}}>
                <div style={{display:'flex',flexWrap:'wrap',gap:3}}>{m.items.map((it:any,ii:number)=>{const isEditing=editItem?.mealIdx===mi&&editItem?.itemIdx===ii;const isReplacing=replacingItem?.mealIdx===mi&&replacingItem?.itemIdx===ii;return<span key={ii} draggable={!isEditing&&!isReplacing} onDragStart={e=>{e.dataTransfer.setData('text/plain',`${mi}:${ii}`);setDraggedItem({mealIdx:mi,itemIdx:ii});}} style={{padding:'3px 6px',borderRadius:6,fontSize:8,background:isEditing?'rgba(59,130,246,0.08)':isReplacing?'rgba(245,158,11,0.08)':'#202023',border:`1px solid ${isEditing?'rgba(59,130,246,0.2)':isReplacing?'rgba(245,158,11,0.2)':'rgba(255,255,255,0.15)'}`,cursor:'grab',color:'#fff',display:'inline-flex',alignItems:'center',gap:3,flexWrap:'wrap'}}>
                    {isEditing?<><input type="number" defaultValue={it.amount} onChange={e=>setEditAmount(+e.target.value||0)} style={{width:40,padding:'1px 4px',borderRadius:3,border:'1px solid rgba(255,255,255,0.06)',background:'#18181b',color:'#fff',fontSize:8}}/><span style={{fontSize:10,color:'rgba(255,255,255,0.85)'}}>Рі</span><button onClick={()=>setEditAmount((prev: any) =>Math.round((prev||it.amount)+25))} style={{padding:'1px 3px',borderRadius:3,border:'1px solid rgba(59,130,246,0.2)',background:'rgba(59,130,246,0.08)',color:'#60a5fa',cursor:'pointer',fontSize:6}}>+25</button><button onClick={()=>setEditAmount((prev: any) =>Math.round((prev||it.amount)*2))} style={{padding:'1px 3px',borderRadius:3,border:'1px solid rgba(139,92,246,0.2)',background:'rgba(139,92,246,0.08)',color:'#a78bfa',cursor:'pointer',fontSize:6}}>Г—2</button><button onClick={()=>setEditAmount((prev: any) =>Math.round((prev||it.amount)/2))} style={{padding:'1px 3px',borderRadius:3,border:'1px solid rgba(245,158,11,0.2)',background:'rgba(245,158,11,0.08)',color:'#f59e0b',cursor:'pointer',fontSize:6}}>Г·2</button><button onClick={()=>updateItemAmount(dayIdx,mi,ii,editAmount||it.amount)} style={{padding:'1px 4px',borderRadius:3,border:'none',background:'rgba(0,230,138,0.15)',color:'#00e68a',cursor:'pointer',fontSize:10}}>вњ“</button><button onClick={()=>setEditItem(null)} style={{padding:'1px 4px',borderRadius:3,border:'none',background:'rgba(239,68,68,0.1)',color:'#ef4444',cursor:'pointer',fontSize:10}}>вњ•</button></>
                    :isReplacing?<><span style={{fontWeight:600}}>{it.name}</span><select onChange={e=>{if(e.target.value){const f=FOOD_DB.find(x=>x.id===e.target.value);if(f)replaceFoodItem(dayIdx,mi,ii,f);}}} value="" style={{fontSize:10,padding:'1px 2px',borderRadius:3,border:'1px solid rgba(255,255,255,0.06)',background:'#18181b',color:'#fff',maxWidth:120}}><option value="">рџ”Ђ Р—Р°РјРµРЅРёС‚СЊ...</option>{findSimilarFoods(it).map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></>
                    :<><span style={{fontWeight:600}}>{it.name}</span>{preferredFoods.includes(it.id)&&<span style={{fontSize:10,color:'#00e68a',padding:'0 1px'}} title="Р›СЋР±РёРјС‹Р№ РїСЂРѕРґСѓРєС‚">в­ђ</span>}<span style={{color:'rgba(255,255,255,0.9)',fontSize:8}}>{it.amount}Рі</span>{(() => { const food = FOOD_DB.find((f: any) => f.id === it.id); return food ? <OrganLoadBadgeGroup food={food} healthIssues={healthIssues || []} /> : null; })()}{lockedFoodIds.has(it.id)&&<span style={{fontSize:10,color:'#f59e0b',padding:'0 2px'}} title="Р—Р°РєСЂРµРїР»РµРЅРѕ вЂ” РЅРµ РёР·РјРµРЅРёС‚СЃСЏ РїСЂРё СЂРµРіРµРЅРµСЂР°С†РёРё">рџ”’</span>}<span onClick={()=>addToCart({name:it.name,kcal:it.kcal*(it.amount/100),amount:it.amount,category:it.category})} style={{cursor:'pointer',fontSize:10,color:'#00e68a',opacity:0.35,padding:'0 2px'}}>рџ›’</span><span onClick={()=>toggleLockFood(it.id)} style={{cursor:'pointer',fontSize:10,color:lockedFoodIds.has(it.id)?'#f59e0b':'rgba(255,255,255,0.4)',padding:'0 2px'}} title={lockedFoodIds.has(it.id)?'РћС‚РєСЂРµРїРёС‚СЊ':'Р—Р°РєСЂРµРїРёС‚СЊ (РЅРµ РёР·РјРµРЅРёС‚СЃСЏ РїСЂРё СЂРµРіРµРЅРµСЂР°С†РёРё)'}>{lockedFoodIds.has(it.id)?'рџ”“':'рџ”’'}</span><span onClick={()=>{setEditItem({dayIdx,mealIdx:mi,itemIdx:ii});setEditAmount(it.amount);}} style={{cursor:'pointer',fontSize:10,color:'rgba(255,255,255,0.8)',padding:'0 2px'}}>вњЏпёЏ</span><span onClick={()=>setReplacingItem({dayIdx,mealIdx:mi,itemIdx:ii})} style={{cursor:'pointer',fontSize:10,color:'rgba(245,158,11,0.4)',padding:'0 2px'}}>рџ”„</span><span onClick={()=>{ const upd = [...new Set([...excludedFoods, it.id])]; setExcludedFoods(upd); try { localStorage.setItem('he_excluded_foods', JSON.stringify(upd)); } catch {} removeFoodItem(dayIdx,mi,ii); }} style={{cursor:'pointer',fontSize:10,color:'rgba(239,68,68,0.45)',padding:'0 2px'}} title='РСЃРєР»СЋС‡РёС‚СЊ РЅР°РІСЃРµРіРґР° вЂ” РЅРµ РїРѕСЏРІРёС‚СЃСЏ РІ СЂРµРіРµРЅРµСЂР°С†РёСЏС…'>рџљ«</span><span onClick={()=>removeFoodItem(dayIdx,mi,ii)} style={{cursor:'pointer',fontSize:10,color:'rgba(239,68,68,0.3)',padding:'0 2px'}} title='РЈР±СЂР°С‚СЊ РёР· СЌС‚РѕРіРѕ РїР»Р°РЅР°'>вњ•</span></>}
                  </span>;})}</div>
                {m.totals&&<div style={{display:'flex',gap:6,marginTop:4,fontSize:8,alignItems:'center',flexWrap:'wrap'}}>{(() => { const tg = m.target; const fmt = (v: number, t: number|undefined, color: string) => { if (!t || t <= 0) return <span style={{color,fontWeight:600}}>{v}Рі</span>; const dev = v - t; const ok = Math.abs(dev) <= 3; return <span style={{color,fontWeight:600}}>{v}/{t}Рі{ok?null:<span style={{fontSize:6,color:dev>0?'#ef4444':'#f59e0b',fontWeight:700}}>{dev>0?('+'+Math.round(dev)):(''+Math.round(dev))}</span>}</span>; }; return <span style={{display:'contents'}}>{fmt(mealP,tg?.p,'#3b82f6')}<span style={{color:'rgba(255,255,255,0.2)',margin:'0 3px'}}>В·</span>{fmt(mealF,tg?.f,'#f59e0b')}<span style={{color:'rgba(255,255,255,0.2)',margin:'0 3px'}}>В·</span>{fmt(mealC,tg?.c,'#f97316')}</span>; })()}{mealDiaas.diaas > 0 && <span style={{fontSize:10,fontWeight:600,color:mealDiaas.diaas >= 1 ? '#22c55e' : mealDiaas.diaas >= 0.75 ? '#f59e0b' : '#ef4444',background:(mealDiaas.diaas >= 1 ? 'rgba(34,197,94,0.08)' : mealDiaas.diaas >= 0.75 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)') + ' none repeat scroll 0% 0%',padding:'1px 5px',borderRadius:4}}>DIAAS {mealDiaas.diaas.toFixed(2)}</span>}{mealGL > 0 && <span style={{fontSize:10,fontWeight:600,color:mealGL<10?'#22c55e':mealGL<=20?'#f59e0b':'#ef4444',background:(mealGL<10?'rgba(34,197,94,0.08)':mealGL<=20?'rgba(245,158,11,0.08)':'rgba(239,68,68,0.08)'),padding:'1px 5px',borderRadius:4}} title={'Glycemic Load: ' + mealGL + (isPostWorkout ? ' (high GL ok post-workout)' : '')}>GL {mealGL}</span>}{mealII > 0 && <span style={{fontSize:10,fontWeight:600,color:mealII<40?'#22c55e':mealII<=70?'#f59e0b':'#ef4444',background:(mealII<40?'rgba(34,197,94,0.08)':mealII<=70?'rgba(245,158,11,0.08)':'rgba(239,68,68,0.08)'),padding:'1px 5px',borderRadius:4}} title={'Insulin Index (kcal-weighted): ' + mealII}>II {mealII}</span>}{m.mpsCheck && m.mpsCheck.triggers_mTOR && <span style={{fontSize:10,fontWeight:600,color:'#00e68a',background:'rgba(0,230,138,0.08)',padding:'1px 5px',borderRadius:4}} title={'+' + m.mpsCheck.leucineG + 'g leucine, MPS triggered'}>{'\uD83E\uDDEC mTOR'}</span>}{m.mpsCheck && !m.mpsCheck.triggers_mTOR && m.mpsCheck.proteinG > 0 && <span style={{fontSize:10,fontWeight:600,color:'#f59e0b',background:'rgba(245,158,11,0.08)',padding:'1px 5px',borderRadius:4}} title={'Leucine ' + m.mpsCheck.leucineG + 'g < 2.5g threshold'}>{'\u26A0\uFE0F ' + m.mpsCheck.leucineG + 'g'}</span>}{m.synergyNotes&&m.synergyNotes.length>0&&<span style={{fontSize:10,color:'#22c55e',fontWeight:600}} title={m.synergyNotes.join('; ')}>вњ… {(m.synergyNotes as string[]).length} СЃРёРЅРµСЂРіРё{((m.synergyNotes as string[]).length>1?'Р№':'СЏ')}</span>}{m.conflictWarnings&&m.conflictWarnings.length>0&&<span style={{fontSize:10,color:'#ef4444',fontWeight:600}} title={m.conflictWarnings.join('; ')}>вљ пёЏ {(m.conflictWarnings as string[]).length} РєРѕРЅС„Р»РёРєС‚{((m.conflictWarnings as string[]).length>1?'РѕРІ':'')}</span>}</div>}
                {quickAddMealIdx === mi && (
                  <div style={{padding:'4px 10px 8px',background:'#18181b',borderTop:'1px solid rgba(255,255,255,0.04)'}}>
                    <input value={quickAddSearch} onChange={e=>setQuickAddSearch(e.target.value)} placeholder="РџРѕРёСЃРє РїСЂРѕРґСѓРєС‚Р°..." autoFocus style={{width:'100%',padding:'4px 8px',borderRadius:6,border:'1px solid rgba(0,230,138,0.2)',background:'#202023',color:'#fff',fontSize:9,marginBottom:4}} />
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
                    <button onClick={() => { setQuickAddMealIdx(null); setQuickAddSearch(''); }} style={{marginTop:4,padding:'3px 8px',borderRadius:4,border:'1px solid rgba(239,68,68,0.2)',background:'rgba(239,68,68,0.04)',color:'#ef4444',cursor:'pointer',fontSize:8,width:'100%'}}>вњ• Р—Р°РєСЂС‹С‚СЊ</button>
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
                <span style={{fontSize:10,padding:'1px 5px',borderRadius:4,background:'rgba(34,197,94,0.12)',color:'#22c55e',fontWeight:600}}>Р’Рћ Р’Р Р•РњРЇ</span>
              </div>
              <span style={{fontSize:10,fontWeight:800,color:'rgba(255,255,255,0.85)'}}>{Math.round(d.intraWorkout.totals?.kcal||0)} РєРєР°Р»</span>
            </div>
            <div style={{padding:'6px 10px 8px',background:'#18181b'}}>
              <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                {d.intraWorkout.items.map((it: any, ii: number) => (
                  <span key={ii} style={{padding:'3px 6px',borderRadius:6,fontSize:8,background:'#202023',border:'1px solid rgba(34,197,94,0.15)',color:'#fff',display:'inline-flex',alignItems:'center',gap:3}}>
                    <span style={{fontWeight:600}}>{it.name}</span><span style={{color:'rgba(255,255,255,0.9)',fontSize:10}}>{it.amount}Рі</span>
                  </span>
                ))}
              </div>
              {d.intraWorkout.note && <div style={{fontSize:10,color:'rgba(255,255,255,0.5)',marginTop:3}}>{d.intraWorkout.note}</div>}
            </div>
          </div>
        )}
        {d.nutritionLogic && d.nutritionLogic.length > 0 && (
          <details style={{marginBottom:6,borderRadius:10,overflow:'hidden',border:'1px solid rgba(168,85,247,0.15)'}}>
            <summary style={{padding:'7px 10px',background:'rgba(168,85,247,0.04)',cursor:'pointer',fontSize:9,fontWeight:700,color:'#a78bfa',listStyle:'none'}}>рџ§  Р›РѕРіРёРєР° РїР»Р°РЅР°: РїРѕС‡РµРјСѓ РІС‹Р±СЂР°РЅС‹ СЌС‚Рё РїСЂРѕРґСѓРєС‚С‹</summary>
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
              <span style={{fontSize:9,fontWeight:700,color:'#f59e0b'}}>рџЊ€ Р Р°Р·РЅРѕРѕР±СЂР°Р·РёРµ: {d.dietDiversity.uniqueFoods} РїСЂРѕРґСѓРєС‚РѕРІ</span>
              <span style={{fontSize:10,fontWeight:600,color:d.dietDiversity.score >= 7 ? '#22c55e' : d.dietDiversity.score >= 4 ? '#f59e0b' : '#ef4444'}}>{d.dietDiversity.note}</span>
            </div>
          </div>
        )}
        <div style={{marginTop:8,borderRadius:10,overflow:'hidden',border:'1px solid rgba(0,230,138,0.15)'}}>
          <div style={{padding:'10px 12px',background:'linear-gradient(135deg, rgba(0,230,138,0.06), transparent)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><span style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.85)',letterSpacing:'1px'}}>РРўРћР“Рћ Р—Рђ Р”Р•РќР¬</span><span style={{color:'#00e68a',fontWeight:900,fontSize:16}}>{totalKcal} РєРєР°Р»</span></div>
            <div style={{display:'flex',gap:8}}>
              {[{label:'Р‘РµР»РєРё',val:totalP,unit:'Рі',color:'#3b82f6',target:effectiveP},{label:'Р–РёСЂС‹',val:totalF,unit:'Рі',color:'#f59e0b',target:effectiveF},{label:'РЈРіР»РµРІРѕРґС‹',val:totalC,unit:'Рі',color:'#f97316',target:effectiveC}].map(m=>{const pct=Math.min(100,Math.round(m.val/Math.max(1,m.target)*100));const isOver=pct>100;return(<div key={m.label} style={{flex:1}}><div style={{display:'flex',justifyContent:'space-between',fontSize:8,marginBottom:2}}><span style={{color:m.color,fontWeight:600}}>{m.label}</span><span style={{color:isOver?'#ef4444':'rgba(255,255,255,0.85)',fontWeight:700}}>{m.val}/{m.target}{m.unit}</span></div><div style={{height:5,borderRadius:3,background:'#202023',overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,pct)}%`,borderRadius:3,background:isOver?'#ef4444':`linear-gradient(90deg, ${m.color}, ${m.color}88)`,transition:'width 0.3s'}}/></div><div style={{fontSize:10,color:isOver?'#ef4444':'rgba(255,255,255,0.85)',textAlign:'right',marginTop:1}}>{isOver?`+${pct-100}%`:`${pct}%`}</div></div>);})}
            </div>
          </div>
        </div>
        {d.meals && (() => { const allItems = d.meals.flatMap((m: any) => (m.items || []).map((it: any) => ({...it, food: FOOD_DB.find((f: any) => f.id === it.id)}))); const calcMicro = (field: string, factor: number) => Math.round(allItems.reduce((s: number, it: any) => s + ((it.food?.micros?.[field] || it.food?.['trace_elements_100g']?.[field] || it.food?.electrolytes_100g?.[field] || 0) * (it.amount||100) / 100), 0)); const micros = [ {label:'Ca',val:calcMicro('Ca',1),rda:1000,unit:'РјРі'}, {label:'Fe',val:calcMicro('Fe',1),rda:18,unit:'РјРі'}, {label:'Mg',val:calcMicro('Mg',1),rda:400,unit:'РјРі'}, {label:'Zn',val:calcMicro('Zn',1),rda:15,unit:'РјРі'}, {label:'K',val:calcMicro('K',1),rda:3500,unit:'РјРі'}, {label:'Omega3',val:Math.round(allItems.reduce((s:number,it:any)=>s+((it.food?.macro_100g?.omega_3_mg||it.food?.micros?.Omega3||0)*(it.amount||100)/100),0)),rda:1600,unit:'РјРі'} ]; const visibleMicros = micros.filter(m => m.val > 0).slice(0, 5); return visibleMicros.length > 0 ? (<div style={{marginTop:6,borderRadius:10,overflow:'hidden',border:'1px solid rgba(34,197,94,0.15)'}}><div style={{padding:'6px 10px',background:'rgba(34,197,94,0.03)'}}><div style={{fontSize:9,fontWeight:700,color:'#22c55e',marginBottom:4}}>рџ§Є РњРёРєСЂРѕРЅСѓС‚СЂРёРµРЅС‚С‹ (РїРѕРєСЂС‹С‚РёРµ RDA)</div><div style={{display:'flex',flexWrap:'wrap',gap:4}}>{visibleMicros.map((m,i)=>{const pct=Math.min(100,Math.round(m.val/Math.max(1,m.rda)*100));return(<div key={i} style={{display:'flex',alignItems:'center',gap:3,fontSize:8,padding:'2px 6px',borderRadius:4,background:'rgba(34,197,94,0.06)',border:'1px solid rgba(34,197,94,0.1)'}}><span style={{fontWeight:700,color:pct>=80?'#22c55e':pct>=50?'#f59e0b':'#ef4444'}}>{m.label}</span><span style={{color:'rgba(255,255,255,0.7)'}}>{m.val}{m.unit}</span><span style={{fontSize:10,color:pct>=80?'#22c55e':pct>=50?'#f59e0b':'#ef4444',fontWeight:600}}>{pct}%</span></div>)})}</div></div></div>) : null; })()}
        {d.supplementTimeline && d.supplementTimeline.length > 0 && (
          <div style={{marginTop:6,borderRadius:10,overflow:'hidden',border:'1px solid rgba(139,92,246,0.2)'}}>
            <div style={{padding:'8px 10px',background:'rgba(139,92,246,0.04)'}}>
              <div style={{fontSize:9,fontWeight:700,color:'#a78bfa',marginBottom:6}}>рџ’Љ Р”РѕР±Р°РІРєРё РїРѕ РІСЂРµРјРµРЅРё</div>
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
              <div style={{fontSize:9,fontWeight:700,color:'#60a5fa',marginBottom:6}}>рџ’§ Р“РёРґСЂР°С‚Р°С†РёСЏ (~{d.waterTimeline.reduce((s:number,w:any)=>s+w.ml,0)} РјР»/РґРµРЅСЊ)</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {d.waterTimeline.map((w: any, wi: number) => (
                  <span key={wi} style={{fontSize:10,padding:'2px 6px',borderRadius:4,background:'rgba(59,130,246,0.08)',border:'1px solid rgba(59,130,246,0.12)',color:'#93c5fd',fontWeight:600}} title={w.note}>{w.time} вЂ” {w.ml}РјР»</span>
                ))}
              </div>
              {waterCalc?.electrolytes && (
                <div style={{marginTop:6,padding:'5px 8px',borderRadius:6,background:'rgba(59,130,246,0.06)',fontSize:10}}>
                  <span style={{color:'#93c5fd',fontWeight:600}}>вљЎ Na {waterCalc.electrolytes.sodiumMg}РјРі</span>
                  <span style={{margin:'0 6px',color:'rgba(255,255,255,0.15)'}}>|</span>
                  <span style={{color:'#f59e0b',fontWeight:600}}>K {waterCalc.electrolytes.potassiumMg}РјРі</span>
                  <span style={{margin:'0 6px',color:'rgba(255,255,255,0.15)'}}>|</span>
                  <span style={{color:'#a78bfa',fontWeight:600}}>Mg {waterCalc.electrolytes.magnesiumMg}РјРі</span>
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
                <div style={{ fontSize: 9, fontWeight: 700, color: '#00e68a', marginBottom: 6 }}>РўР°Р№РјР»Р°Р№РЅ РґРЅСЏ</div>
                <div style={{ position: 'relative', height: 44, background: '#202023', borderRadius: 6, overflow: 'hidden' }}>
                  {hourTicks.map((t, i) => (
                    <div key={i} style={{ position: 'absolute', left: pos(t) + '%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.06)' }}>
                      <span style={{ position: 'absolute', top: 1, left: 2, fontSize: 6, color: 'rgba(255,255,255,0.35)' }}>{String(Math.floor(t / 60) % 24).padStart(2, '0')}</span>
                    </div>
                  ))}
                  {trainMin != null && trainEndMin != null && (
                    <div style={{ position: 'absolute', left: pos(trainMin) + '%', width: Math.max(2, pos(trainEndMin) - pos(trainMin)) + '%', top: 0, bottom: 0, background: 'linear-gradient(180deg, rgba(239,68,68,0.28), rgba(239,68,68,0.1))', borderLeft: '2px solid #ef4444', borderRight: '2px solid #ef4444' }} title='РўСЂРµРЅРёСЂРѕРІРєР°'>
                      <span style={{ position: 'absolute', top: 1, left: '50%', transform: 'translateX(-50%)', fontSize: 7, fontWeight: 700, color: '#ef4444' }}>T</span>
                    </div>
                  )}
                  {mealPts.map((m: any, i: number) => {
                    const isW = m.label && (m.label.toLowerCase().includes('РїСЂРµРґС‚СЂРµРЅ') || m.label.toLowerCase().includes('РїРѕСЃС‚') || m.label.toLowerCase().includes('intra'));
                    const col = isW ? '#8b5cf6' : '#00e68a';
                    return (
                      <div key={i} style={{ position: 'absolute', left: pos(m.min) + '%', top: 14, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }} title={m.time + ' вЂ” ' + m.label + ' В· ' + Math.round(m.totals?.kcal || 0) + ' РєРєР°Р»'}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: col, boxShadow: '0 0 4px ' + col }} />
                        <div style={{ fontSize: 5, color: col, marginTop: 1, whiteSpace: 'nowrap', fontWeight: 600 }}>{(m.label || '').slice(0, 8)}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 6, color: 'rgba(255,255,255,0.6)' }}>
                  <span><span style={{ color: '#00e68a' }}>в—Џ</span> РџСЂРёС‘РјС‹</span>
                  <span><span style={{ color: '#8b5cf6' }}>в—Џ</span> Peri-workout</span>
                  {trainMin != null && <span><span style={{ color: '#ef4444' }}>T</span> РўСЂРµРЅРёСЂРѕРІРєР°</span>}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };
}

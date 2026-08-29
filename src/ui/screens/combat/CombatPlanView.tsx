/**
 * CombatPlanView.tsx — выделенный рендер плана единоборств (декомпозиция CombatConstructor).
 * Принимает plan + колбэки update/move/swap/undo, рендерит недели/сессии/упражнения + кондицию + карту качества.
 * CombatConstructor остаётся оркестратором визарда.
 */
import React from 'react';
import type { CombatPlan } from '../../../engines/combat/combat.types';
import { getCombat } from '../../../engines/combat/combat-volume';
import { buildCombatReport } from '../../../engines/combat/combat-finalize.engine';
import { ruLabel, PHASE_RU } from './CombatUI';
import { CB_STRICT_GROUPS, cbStrictGroupFor } from '../../../engines/combat/combat-selection';

type Props = {
  plan: CombatPlan;
  historyLen: number;
  onUndo: () => void;
  onUpdateEx: (wkIdx:number, day:number, exId:string, patch: Partial<{weight:number; reps:string; rir:number}>)=>void;
  onMoveEx: (wkIdx:number, day:number, exId:string, dir:-1|1)=>void;
  onSwapEx: (wkIdx:number, day:number, exId:string, newId:string)=>void;
  outsideSessions?: number;
  outsideMult?: number;
};

export const CombatPlanView: React.FC<Props> = ({ plan, historyLen, onUndo, onUpdateEx, onMoveEx, onSwapEx }) => {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
        <button onClick={onUndo} disabled={historyLen===0} style={{ padding:'4px 10px', borderRadius:6, fontSize:11, background: historyLen? 'rgba(168,85,247,0.18)':'rgba(255,255,255,0.06)', color: historyLen? '#c4b5fd':'rgba(255,255,255,0.35)', cursor: historyLen? 'pointer':'default', border:'1px solid rgba(168,85,247,0.25)' }}>↩ Отменить {historyLen? `(${historyLen})`:''}</button>
        <span style={{ fontSize:10, color:'#fff', opacity:0.5 }}>История {historyLen}/10</span>
      </div>
      <div style={{ background:'rgba(168,85,247,0.12)', padding:10, borderRadius:10, color:'#fff', fontSize:11, whiteSpace:'pre-wrap' }}>{buildCombatReport(plan)}</div>
      {/* Карта качества — шея/хват/core */}
      <div style={{ background:'rgba(255,255,255,0.04)', padding:8, borderRadius:8 }}>
        <div style={{ color:'#fff', fontWeight:700, fontSize:11, marginBottom:4 }}>Карта качества (сеты/нед vs MEV/MRV)</div>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {plan.weeksData.map(wk=>{
            const neck = wk.sessions.reduce((s, sess)=> s+ sess.exercises.filter(e=> e.id.includes('neck')).reduce((a,e)=>a+e.sets,0),0);
            const lm=getCombat(plan.level,'neck'); const st= lm ? (neck<lm.mev?'below': neck<=lm.mav?'optimal': neck<=lm.mrv?'high':'over'):'optimal';
            const col= st==='below'?'#f59e0b': st==='optimal'?'#a855f7': st==='high'?'#eab308':'#ef4444';
            return <span key={wk.week} style={{ padding:'2px 6px', borderRadius:6, background:col+'22', border:`1px solid ${col}`, color:col, fontSize:10 }}>Н{wk.week} {ruLabel(PHASE_RU, wk.phase)}: шея {neck}{wk.deload?' · разгрузка': (wk as any).taper?' · тапер':''}</span>;
          })}
        </div>
      </div>
      {plan.weeksData.map(wk=> (
        <div key={wk.week} style={{ background:'rgba(255,255,255,0.04)', padding:8, borderRadius:8, border: wk.deload? '1px solid rgba(245,158,11,0.35)': (wk as any).taper?'1px solid rgba(59,130,246,0.35)':'1px solid transparent' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color: wk.deload? '#f59e0b' : (wk as any).taper? '#60a5fa' : '#a855f7', fontWeight:700, fontSize:12 }}>Неделя {wk.week} · {ruLabel(PHASE_RU, wk.phase)}{wk.deload?' · разгрузка':(wk as any).taper?' · тапер':''} · {wk.totalSets} сетов</span>
          </div>
          {wk.sessions.map(sess=> (
            <div key={sess.day} style={{ marginTop:6, padding:6, background:'rgba(255,255,255,0.03)', borderRadius:6 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:'#fff', fontSize:11, fontWeight:700 }}>{sess.sessionTag} · {sess.character} · день {sess.day}</span>
              </div>
              {sess.exercises.map(ex=> (
                <div key={ex.id} style={{ color:'#fff', fontSize:11, marginLeft:6, marginTop:4, padding:'4px 6px', background:'rgba(255,255,255,0.02)', borderRadius:4 }}>
                  <div style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap' }}>
                    <span>{ex.name} — {ex.sets}×{ex.reps}{ex.weight?` @ ${ex.weight}кг`:''} RIR{ex.rir}</span>
                    <input aria-label="вес" type="number" value={ex.weight} onChange={e=> onUpdateEx(wk.week-1, sess.day, ex.id, {weight:Number(e.target.value)||0})} style={{ width:58, padding:'2px 4px', borderRadius:4, fontSize:10, background:'rgba(255,255,255,0.08)', color:'#fff', border:'1px solid rgba(255,255,255,0.15)' }} />
                    <input aria-label="повторы" type="text" value={ex.reps} onChange={e=> onUpdateEx(wk.week-1, sess.day, ex.id, {reps:e.target.value})} style={{ width:54, padding:'2px 4px', borderRadius:4, fontSize:10, background:'rgba(255,255,255,0.08)', color:'#fff', border:'1px solid rgba(255,255,255,0.15)' }} />
                    <input aria-label="RIR" type="number" min={0} max={5} value={ex.rir} onChange={e=> onUpdateEx(wk.week-1, sess.day, ex.id, {rir:Number(e.target.value)||0})} style={{ width:44, padding:'2px 4px', borderRadius:4, fontSize:10, background:'rgba(255,255,255,0.08)', color:'#fff', border:'1px solid rgba(255,255,255,0.15)' }} />
                    <select aria-label="замена" value={ex.id} onChange={e=> { const v=e.target.value; if(v!==ex.id) onSwapEx(wk.week-1, sess.day, ex.id, v); }} style={{ padding:'2px 4px', borderRadius:4, fontSize:9, background:'rgba(168,85,247,0.08)', color:'#c4b5fd', border:'1px solid rgba(168,85,247,0.25)', maxWidth:110 }}>
                      <option value={ex.id}>{ex.id} ✓</option>
                      {(cbStrictGroupFor(ex.id) ? CB_STRICT_GROUPS[cbStrictGroupFor(ex.id)!] : []).filter(id=>id!==ex.id).map(id=> <option key={id} value={id}>{id}</option>)}
                    </select>
                    <button aria-label="вверх" onClick={()=> onMoveEx(wk.week-1, sess.day, ex.id, -1)} style={{ padding:'2px 6px', borderRadius:4, fontSize:10, background:'rgba(255,255,255,0.06)', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', cursor:'pointer' }}>↑</button>
                    <button aria-label="вниз" onClick={()=> onMoveEx(wk.week-1, sess.day, ex.id, 1)} style={{ padding:'2px 6px', borderRadius:4, fontSize:10, background:'rgba(255,255,255,0.06)', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', cursor:'pointer' }}>↓</button>
                  </div>
                  {ex.comment && <div style={{ fontSize:10, opacity:0.7, marginLeft:4, borderLeft:'2px solid rgba(168,85,247,0.3)', paddingLeft:6 }}>{ex.comment}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

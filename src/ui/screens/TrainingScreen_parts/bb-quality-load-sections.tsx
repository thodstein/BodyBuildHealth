/**
 * bb-quality-load-sections.tsx — под-секции блока «🏋️ Тренировочная нагрузка плана»
 * (шаг «Качество» ББ-авто), вынесенные из god-component `BbAutoConstructor.tsx`
 * (§4.3 остаток: train-load блок `renderQuality` режется 3 под-секциями — перенос
 * 1-в-1, логика/тексты/стили не менялись). В конструкторе остаются только
 * toggle-обёртка блока и низ шага (кнопки/actions).
 *
 * Общий контекст плана — `BbQualityLoadCtx` (плоский снимок plan-basis, чтобы
 * каждая под-секция не тянула 20+ отдельных props; решение §4.3 «через контекст-объект»).
 */
import React from 'react';
import type { BBPlan } from '../../../engines/bb/bb-builder.engine';
import type { BBRankedPattern } from '../../../engines/bb/bb-selector.engine';
import type { PED, PEDAdaptation } from '../../../engines/bb/bb-ped-adaptation.engine';
import type { SessionMethodology } from '../../../engines/bb/bb-session-order.engine';
import type { LoadStrategy, DeloadType } from '../../../engines/bb/bb-autocoach.engine';
import { DELOAD_PROTOCOLS, detectGarbageVolume } from '../../../engines/bb/bb-autocoach.engine';
import { aggregateBBVolume } from '../../../engines/bb/bb-volume.engine';
import { MUSCLE_LABEL_RU } from '../../../engines/volume-landmarks.engine';
import { getPhaseConfig } from '../../../engines/periodization';
import { CollapsibleCard, type BBPhase } from './bb-auto-constructor-shared';
import { CARD, SMALL } from './training-ui';
import { PHASE_COLORS, PHASE_LABELS } from './PlanOutput';
import { VolumeByWeekChart, RirDriftChart, type WeekVolume, type RirRecord } from './PlanCharts';
import { MesocycleProgressionCard } from './MesocycleProgressionCard';
import type { InjurySelectEntry } from './InjurySelectCard';
import type { calcBBPlanMetrics } from '../../../engines/bb/bb-metrics.engine';

/** Структурный срез quality-объекта конструктора (поля — как их читает train-load блок;
 *  «any» намеренно: форма внутри god-object, контекстная типизация картбека рекомендаций сохранена). */
export interface BbQualityLoadView {
  viewVolume: any;
  viewPro: any;
  viewTag: any;
  proLabel: any;
  mode: any;
  perWeek: any;
  selVolume: any;
  selPro: any;
  recommendations: string[];
}

export interface BbQualityLoadCtx {
  /** Понедельная оценка качества (quality useMemo конструктора; форма богатая — как в god-component). */
  quality: BbQualityLoadView;
  builtPlan: BBPlan;
  metrics: NonNullable<ReturnType<typeof calcBBPlanMetrics>>;
  ranked: BBRankedPattern[];
  bestSplit: BBRankedPattern | undefined;
  bbLevel: string;
  bbGoal: string;
  bbTrainingFocus: 'strength' | 'hypertrophy' | 'endurance';
  bbMethodology: SessionMethodology;
  bbVolGoal: string;
  trainingVolumeMode: 'standard' | 'high';
  loadStrategy: LoadStrategy;
  pedAdapt: PEDAdaptation;
  peds: PED[];
  weakPoints: string[];
  injuries: InjurySelectEntry[];
  mobilityRestrictions: string[];
  bbEquipment: string[];
  specTargets: string[];
  bbDays: number;
  bbTrainingYears: number;
  specializationMode: boolean;
  /** Единый ACWR недели (из селектора). */
  ratio: any;
}

export interface BbQualityLoadOverviewProps {
  ctx: BbQualityLoadCtx;
  qualityWeek: number | 'avg';
  setQualityWeek: React.Dispatch<React.SetStateAction<number | 'avg'>>;
  bbWeekSel: number;
  setBbWeekSel: React.Dispatch<React.SetStateAction<number>>;
  autoDeload: boolean;
  deloadType: DeloadType;
}

/** A — «Общая информация» + «Качество понедельно» + «Общие сведения» + «Фаза (факт)». */
export const BbQualityLoadOverview: React.FC<BbQualityLoadOverviewProps> = ({ ctx, qualityWeek, setQualityWeek, bbWeekSel, setBbWeekSel, autoDeload, deloadType }) => {
  const { quality, builtPlan, metrics, ranked, bestSplit, bbLevel, bbGoal, bbTrainingFocus, bbMethodology, bbVolGoal, trainingVolumeMode, loadStrategy, pedAdapt, peds, weakPoints, injuries, mobilityRestrictions, bbEquipment, specTargets, bbDays, ratio } = ctx;
  const W = builtPlan.weeks;
  return (
    <>
    {/* <<A>> */}
<CollapsibleCard title="📋 Общая информация о плане" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(168,85,247,0.04))', color: '#a855f7' }} badge={`${builtPlan.pattern?.name || '—'} · ${W.length} нед · ${builtPlan.weeks[0]?.sessions.length || bbDays}×/нед`}>
          <div style={{ display:'grid', gap:8, fontSize:11 }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              <span style={{ padding:'3px 7px', borderRadius:20, background:'rgba(168,85,247,0.08)', border:'1px solid rgba(168,85,247,0.14)', color:'#a855f7' }}>{builtPlan.pattern?.name || '—'} · {W.length} нед · {builtPlan.weeks[0]?.sessions.length || bbDays}×/нед</span>
              <span style={{ padding:'3px 7px', borderRadius:20, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff' }}>Уровень {bbLevel} · Цель {bbGoal} · Фокус {bbTrainingFocus}</span>
              <span style={{ padding:'3px 7px', borderRadius:20, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff' }}>Методика {bbMethodology} · Объём {bbVolGoal}{trainingVolumeMode==='high'?' · объёмный':''}</span>
              <span style={{ padding:'3px 7px', borderRadius:20, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff' }}>Прогрессия {loadStrategy} · RIR {String((getPhaseConfig('accumulation', bbTrainingFocus as any) as any).rir ?? '2-3')}→{String((getPhaseConfig('intensification', bbTrainingFocus as any) as any).rir ?? '1-2')}</span>
              {peds.length>0 && <span style={{ padding:'3px 7px', borderRadius:20, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.14)', color:'#f59e0b' }}>PED ×{pedAdapt.combinedMrvMultiplier.toFixed(2)} · {peds.join(', ')}</span>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:10, color:'#fff' }}>
              <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}><b>Слабые:</b> {weakPoints.join(', ')||'— баланc'}</div>
              <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}><b>Травмы:</b> {injuries.length? injuries.map(i=> `${i.muscle}${i.exclude?' (искл.)':''}`).join(', ') : 'нет'} · <b>Мобильность:</b> {mobilityRestrictions.join(', ')||'нет'}</div>
              <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}><b>Оборудование:</b> {bbEquipment.slice(0,3).join(', ')||'всё'} · <b>Слабые:</b> {specTargets.join(' + ')||'баланс'}</div>
              <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}><b>Сплит:</b> {builtPlan.pattern?.name || '—'} · скор {ranked.find(r=>r.pattern.id===builtPlan.pattern?.id)?.score ?? bestSplit?.score ?? 0} · {bbDays}×/нед</div>
            </div>
            <div style={{ fontSize:10, color:'#fff', opacity:0.6, display:'flex', flexWrap:'wrap', gap:6 }}>
              <span>Уровень «{bbLevel}»</span><span>Цель «{bbGoal}»</span><span>Фокус «{bbTrainingFocus}»</span><span>Методика «{bbMethodology}»</span><span>PED ×{pedAdapt.combinedMrvMultiplier.toFixed(2)}</span><span>ACWR {ratio ? ratio.ratio.toFixed(2) : '—'}</span>
            </div>
          </div>
        </CollapsibleCard>
        <CollapsibleCard title="⭐ Качество плана — объём и PRO (понедельно)" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(168,85,247,0.04))', color: '#a855f7' }} badge={`Объём ${quality.viewVolume}/100 · PRO ${quality.viewPro}/100 · ${quality.viewTag}`}>
          <div style={{ display:'grid', gap:8, fontSize:11 }}>
            <div style={{ fontSize:10, color:'#fff', opacity:0.6, lineHeight:1.35 }}>
              Две отдельные шкалы (не суммируются): «Объём» — факт недели vs собственные цели/капы/параметры плана; «PRO» — факт исполнения (паттерны/углы/растяжка/техники). Каждая неделя — по правилам своей фазы; «Среднее» — среднее понедельных.
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
              <button type="button" onClick={() => setQualityWeek('avg')} aria-pressed={quality.mode === 'avg'} style={{ padding:'4px 10px', borderRadius:8, fontSize:11, cursor:'pointer', border: quality.mode === 'avg' ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.08)', background: quality.mode === 'avg' ? 'rgba(168,85,247,0.15)' : 'transparent', color: quality.mode === 'avg' ? '#a855f7' : '#fff', fontWeight: quality.mode === 'avg' ? 800 : 400 }}>Среднее</button>
              {builtPlan.weeks.map((w:any) => {
                const phColor = (PHASE_COLORS as any)[String((w as any).phase || ((w as any).deload ? 'deload' : 'accumulation'))] || '#fff';
                const active = quality.mode === w.week;
                return (
                <button key={w.week} type="button" onClick={() => setQualityWeek(w.week)} aria-pressed={active} title={`Нед ${w.week}: ${(w as any).phase || ''}${(w as any).deload ? ' (делод)' : ''}${(w as any).taper ? ' (taper)' : ''}`} style={{ padding:'4px 8px', borderRadius:8, fontSize:11, cursor:'pointer', border: active ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.08)', background: active ? 'rgba(168,85,247,0.15)' : 'transparent', color: active ? '#a855f7' : '#fff', fontWeight: active ? 800 : 400, display:'inline-flex', alignItems:'center', gap:5 }}><span style={{ width:6, height:6, borderRadius:'50%', background: phColor, flexShrink:0 }} />{w.week}</button>
                );
              })}
            </div>
            <div style={{ display:'flex', gap:3, alignItems:'flex-end', flexWrap:'wrap' }} title="Понедельные скоры: зелёный — объём, голубой — PRO">
              {quality.perWeek.map((p:any) => (
                <button key={p.week} type="button" onClick={() => setQualityWeek(p.week)} title={`Нед ${p.week}: объём ${p.volume}, PRO ${p.pro}`} style={{ background:'transparent', border: quality.mode === p.week ? '1px solid #a855f7' : '1px solid transparent', borderRadius:6, padding:2, cursor:'pointer', display:'flex', gap:2, alignItems:'flex-end' }}>
                  <span style={{ display:'block', width:8, height: Math.max(3, Math.round(p.volume / 4)), borderRadius:2, background: p.volume >= 85 ? '#22c55e' : p.volume >= 65 ? '#eab308' : p.volume >= 45 ? '#f97316' : '#ef4444' }} />
                  <span style={{ display:'block', width:8, height: Math.max(3, Math.round(p.pro / 4)), borderRadius:2, background:'#60a5fa', opacity:0.85 }} />
                </button>
              ))}
              <span style={{ fontSize:9, color:'#fff', opacity:0.5, marginLeft:6 }}>🟩 объём · 🟦 PRO · клик — неделя</span>
            </div>
            <div style={{ display:'grid', gap:4 }}>
              {quality.selVolume.muscles.map((m:any) => {
                const stColor = m.status === 'ok' ? '#22c55e' : m.status === 'by_design' ? '#60a5fa' : m.status === 'low' ? '#f59e0b' : m.status === 'high' ? '#eab308' : m.status === 'over' ? '#ef4444' : '#888';
                const stLabel = m.status === 'ok' ? 'в цели' : m.status === 'by_design' ? 'по дизайну' : m.status === 'low' ? 'ниже' : m.status === 'high' ? 'выше цели' : m.status === 'over' ? 'перебор' : '—';
                return (
                  <div key={m.muscle} style={{ display:'grid', gridTemplateColumns:'1.1fr 1fr 1.4fr', gap:6, alignItems:'center', padding:'5px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)', fontSize:10 }}>
                    <span style={{ fontWeight:700, color:'#fff' }}>{m.label || m.muscle}</span>
                    <span style={{ color:'#fff' }}>{m.effectiveSets} эфф <span style={{ opacity:0.55 }}>({m.directSets} прям{m.targetSets > 0 ? ` · цель ${m.targetSets}` : ''})</span></span>
                    <span style={{ color: stColor, fontWeight:700 }}>{stLabel} <span style={{ opacity:0.7, fontWeight:400 }}>· MEV {m.mev}/MAV {m.mav}/MRV {m.mrv}{m.note ? ` · ${m.note}` : ''}</span></span>
                  </div>
                );
              })}
            </div>
            <div style={{ display:'grid', gap:3, fontSize:10 }}>
              {quality.selVolume.issues.filter((i:any) => i.severity !== 'info').slice(0, 5).map((i:any, idx:number) => (
                <div key={'v' + idx} style={{ color:'#fff' }}>{i.severity === 'error' ? '🔴' : '🟡'} {i.message} <span style={{ opacity:0.55 }}>[{i.source}]</span></div>
              ))}
              {quality.selPro.totalIssues.slice(0, 3).map((iss:string, idx:number) => (
                <div key={'p' + idx} style={{ color:'#fff' }}>🔵 {iss}</div>
              ))}
              {quality.selVolume.issues.filter((i:any) => i.severity === 'info').slice(0, 2).map((i:any, idx:number) => (
                <div key={'n' + idx} style={{ color:'#fff', opacity:0.55 }}>ℹ️ {i.message} <span style={{ opacity:0.7 }}>[{i.source}]</span></div>
              ))}
              {quality.selVolume.issues.filter((i:any) => i.severity !== 'info').length === 0 && quality.selPro.totalIssues.length === 0 && (
                <div style={{ color:'#22c55e' }}>✅ Неделя в целях плана — отклонений нет</div>
              )}
            </div>
          </div>
        </CollapsibleCard>
        <CollapsibleCard title="📊 Общие сведения о нагрузке" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(0,230,138,0.12), rgba(0,230,138,0.04))', color: '#00e68a' }} badge={`${metrics.totalSets} сетов · тяж ${(metrics.тяжPct*100).toFixed(0)}% · памп ${(metrics.пампPct*100).toFixed(0)}%`}>
          <div style={{ display:'grid', gap:8, fontSize:11 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
              <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.04)', textAlign:'center' }}><div style={{ fontSize:9, color:'#fff', opacity:0.6 }}>Сетов пик</div><div style={{ fontSize:14, fontWeight:800, color:'#00e68a' }}>{metrics.totalSets}</div><div style={{ fontSize:9, color:'#fff', opacity:0.5 }}>средн. {Math.round(W.reduce((a,w)=>a+w.sessions.reduce((b,s)=>b+s.exercises.reduce((c,e)=>c+e.sets,0),0),0)/W.length)}/нед</div></div>
              <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.06)', textAlign:'center' }}><div style={{ fontSize:9, color:'#fff', opacity:0.6 }}>Тяж</div><div style={{ fontSize:14, fontWeight:800, color:'#ef4444' }}>{(metrics.тяжPct*100).toFixed(0)}%</div><div style={{ fontSize:9, color:'#fff', opacity:0.5 }}>RIR {metrics.avgRir.toFixed(1)}</div></div>
              <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(96,165,250,0.06)', textAlign:'center' }}><div style={{ fontSize:9, color:'#fff', opacity:0.6 }}>Памп</div><div style={{ fontSize:14, fontWeight:800, color:'#60a5fa' }}>{(metrics.пампPct*100).toFixed(0)}%</div><div style={{ fontSize:9, color:'#fff', opacity:0.5 }}>{W.length} нед · {W[0]?.sessions.length || 0} дн/нед</div></div>
            </div>
            {(() => {
              const proQ = (quality as any).proResult as any;
              if (!proQ) return null;
              return (
                <div style={{ display:'grid', gap:6 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:10 }}>
                    <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}><b>Паттерны:</b> {proQ.patterns.filter((p:any)=>p.ok).length}/{proQ.patterns.length} в норме {proQ.patterns.filter((p:any)=>!p.ok).map((p:any)=>p.issue).slice(0,1).join('; ')||'—'}</div>
                    <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}><b>Углы:</b> {proQ.angles.filter((a:any)=>a.ok).length}/{proQ.angles.length} в норме {proQ.angles.filter((a:any)=>!a.ok).map((a:any)=>a.issue).slice(0,1).join('; ')||'—'}</div>
                    <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}><b>Растяжка:</b> {proQ.stretches.filter((s:any)=>s.ok).length}/{proQ.stretches.length} в норме</div>
                    <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}><b>Техники:</b> {proQ.technique.pct}% {proQ.technique.ok ? '✅' : '⚠️ ' + (proQ.technique.issue || '')}</div>
                  </div>
                  <div style={{ fontSize:10, color:'#fff', opacity:0.6 }}>Цель «{proQ.goalAlignment?.goal || bbGoal}» — {proQ.goalAlignment?.ok ? 'согласована с фокусом ✅' : '⚠️ ' + (proQ.goalAlignment?.issue || '')} · техники {proQ.technique.pct}%{proQ.goalAlignment?.recommendation ? ' · ' + proQ.goalAlignment.recommendation : ''}</div>
                  {proQ.totalIssues.length > 0 && <div style={{ fontSize:10, color:'#fff' }}>{proQ.totalIssues.slice(0,3).map((iss:any,i:number)=><div key={i}>• {iss}</div>)}</div>}
                  {proQ.totalRecommendations.length > 0 && <div style={{ fontSize:10, color:'#22c55e' }}>{proQ.totalRecommendations.slice(0,3).map((rec:any,i:number)=><div key={i}>→ {rec}</div>)}</div>}
                  <div style={{ fontSize:10, color:'#22c55e' }}>PRO-скор {quality.viewTag}: {quality.viewPro}/100 {quality.proLabel} (отдельная шкала по факту исполнения — в скор объёма не входит)</div>
                </div>
              );
            })()}
            <div style={{ fontSize:10, color:'#fff', opacity:0.5 }}>Фаз: {Array.from(new Set(W.map((w:any)=>(w as any).phase || 'accumulation'))).length} · {W.map(w=>`${PHASE_LABELS[((w as any).phase || 'accumulation') as BBPhase] || (w as any).phase}`).join(' → ').slice(0,80)} · PED ×{pedAdapt.combinedMrvMultiplier.toFixed(2)}</div>
          </div>
        </CollapsibleCard>
        {/* Фаза — факт из плана, а не синтетика distributePhases */}
        {(() => {
          const Wq = builtPlan.weeks;
          const wkq = Wq[Math.min(bbWeekSel, Wq.length) - 1] || Wq[0];
          const curPhRaw = ((wkq as any).phase || (wkq as any).deload ? 'deload' : 'accumulation') as BBPhase;
          const curPh = (['accumulation','intensification','deload','peaking'].includes(curPhRaw) ? curPhRaw : 'accumulation') as BBPhase;
          const acwrQ = ratio;
          const needsDeloadQ = autoDeload && acwrQ && acwrQ.ratio > 1.3;
          const wkExs = wkq.sessions.flatMap(s => s.exercises);
          const avgRirFact = wkExs.length ? (wkExs.reduce((a,e) => a + (Number.isFinite(e.rir) ? e.rir * e.sets : 0), 0) / wkExs.reduce((a,e) => a + e.sets, 0) || 1) : 0;
          const repsAll = wkExs.flatMap(e => e.workSets?.map((ws:any) => ws.reps) ?? [e.repsRange?.[0] ?? 10]);
          const repMin = repsAll.length ? Math.min(...repsAll) : 0;
          const repMax = repsAll.length ? Math.max(...repsAll) : 0;
          const tempoFact = wkExs[0]?.tempoSpec || getPhaseConfig(curPh, bbTrainingFocus as any).tempo;
          const cfg = getPhaseConfig(curPh, bbTrainingFocus as any);
          const totalW = builtPlan.weeks.length;
          const phaseGroups: Record<string, number[]> = {};
          for (const w of builtPlan.weeks) {
            const p = ((w as any).phase || 'accumulation') as string;
            if (!phaseGroups[p]) phaseGroups[p] = [];
            phaseGroups[p].push(w.week);
          }
          const distText = Object.entries(phaseGroups).map(([p, weeks]) => `${PHASE_LABELS[p as BBPhase] || p}: нед ${weeks.join(',')}`).join(' · ');
          const totalSetsWeek = wkExs.reduce((a,e)=> a+ (e.sets||0),0);
          return <CollapsibleCard title={`📌 Фаза (факт) — ${PHASE_LABELS[curPh] || curPh}`} defaultOpen={true} headerStyle={{ background: `linear-gradient(135deg, ${PHASE_COLORS[curPh]}18, ${PHASE_COLORS[curPh]}08)`, color: PHASE_COLORS[curPh] }}><div style={{ marginBottom:6, padding:'10px 12px', borderRadius:12, background:PHASE_COLORS[curPh] + '18', border:'1px solid ' + PHASE_COLORS[curPh] + '30' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:6 }}>
                <span style={{ fontSize:12, fontWeight:800, color:PHASE_COLORS[curPh] }}>📌 Фаза (факт): {PHASE_LABELS[curPh]} · нед {wkq.week}/{Wq.length}</span>
                <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:220, maxWidth:360 }}>
                  <span style={{ fontSize:10, color:'#fff', opacity:0.6, whiteSpace:'nowrap' }}>1</span>
                  <input type="range" min={1} max={Wq.length} value={wkq.week} aria-label="Выбрать неделю для анализа фазы" onChange={e => setBbWeekSel(Number(e.target.value))} style={{ flex:1, accentColor: PHASE_COLORS[curPh] }} />
                  <span style={{ fontSize:10, color:'#fff', opacity:0.6, whiteSpace:'nowrap' }}>{Wq.length}</span>
                </div>
                <span style={{ fontSize:11, color:'#fff', background:'rgba(255,255,255,0.06)', padding:'2px 8px', borderRadius:20 }}>RIR факт {avgRirFact.toFixed(1)} · Повт {repMin}-{repMax} · Темп {tempoFact} · Сетов {totalSetsWeek}</span>
              </div>
              <div style={{ marginTop:8, display:'flex', gap:2, height:8, borderRadius:6, overflow:'hidden', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)' }}>
                {builtPlan.weeks.map(w=>{
                  const p = ((w as any).phase || 'accumulation') as BBPhase;
                  const isCur = w.week===wkq.week;
                  return <div key={w.week} title={`Нед ${w.week}: ${PHASE_LABELS[p] || p}`} style={{ flex:1, background: PHASE_COLORS[p] || '#fff', opacity: isCur?1:0.55, borderLeft: isCur?'1px solid #fff': 'none', borderRight: isCur?'1px solid #fff':'none' }} />
                })}
              </div>
              <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:'8px 9px', borderRadius:8, background:'rgba(0,0,0,0.18)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:10, fontWeight:800, color:PHASE_COLORS[curPh], marginBottom:4 }}>Конфиг фазы ({bbTrainingFocus || 'hypertrophy'})</div>
                  <div style={{ display:'grid', gap:2, fontSize:10, color:'#fff', lineHeight:1.35, fontFamily:'ui-monospace, monospace' }}>
                    <div>repRange: {cfg.repRange[0]}–{cfg.repRange[1]} · RIR {String((cfg as any).rir ?? '2-3')} · tempo {cfg.tempo} · отдых {cfg.restBase}с</div>
                    <div>volume ×{cfg.volumeMultiplier ?? 1} · intensity ×{cfg.intensityMultiplier ?? 1} · {curPh==='deload'?'разгрузка':curPh==='accumulation'?'накопление':curPh==='intensification'?'интенсификация':'пик'}</div>
                    <div style={{ opacity:0.55 }}>Источник: getPhaseConfig('{curPh}', '{bbTrainingFocus}') · PED ×{pedAdapt.combinedMrvMultiplier.toFixed(2)} · уровень {bbLevel}</div>
                  </div>
                </div>
                <div style={{ padding:'8px 9px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:10, fontWeight:800, color:'#fff', marginBottom:4 }}>Факт недели {wkq.week} — расчёт</div>
                  <div style={{ display:'grid', gap:2, fontSize:10, color:'#fff', lineHeight:1.35, fontFamily:'ui-monospace, monospace' }}>
                    <div>сетов: {totalSetsWeek} · упражнений: {wkExs.length} · RIR средн. {avgRirFact.toFixed(1)} = Σ(rir×sets)/Σsets</div>
                    <div>повторы факт: {repMin}-{repMax} (из workSets) vs конфиг {cfg.repRange[0]}–{cfg.repRange[1]} {Math.abs(repMin - cfg.repRange[0])>3 || Math.abs(repMax - cfg.repRange[1])>3 ? '⚠ отклонение' : '✓ соответствует'}</div>
                    <div>темп факт: {tempoFact} vs конфиг {cfg.tempo} · {avgRirFact.toFixed(1)} vs {(cfg as any).rir ?? '—'}</div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop:6, fontSize:11, color:'#fff', lineHeight:1.4 }}>
                {curPh === 'accumulation' && '🎯 Накопление: метаболический стресс, больший объём, умеренные веса. Дрифт RIR −1/2н, повторы −1/2н, объём ×1.0.'}
                {curPh === 'intensification' && '🎯 Интенсификация: механическое натяжение, снижение объёма ×0.85, рост весов, RIR ↓.'}
                {curPh === 'deload' && '🎯 Разгрузка: активное восстановление, объём ×0.6, RIR+2, темп контроль.'}
                {curPh === 'peaking' && '🎯 Пик: реализация, низкий объём ×0.7, RIR 0-1, высокая интенсивность.'}
              </div>
              <div style={{ marginTop:6, fontSize:10, color:'#fff', opacity:0.7, display:'flex', flexWrap:'wrap', gap:8 }}>
                <span>Уровень «{bbLevel}»</span><span>Цель «{bbGoal}»</span><span>Фокус «{bbTrainingFocus}»</span><span>Методика «{bbMethodology}»</span><span>Сплит «{builtPlan.pattern?.name || ''}»</span><span>PED ×{pedAdapt.combinedMrvMultiplier.toFixed(2)}</span><span>ACWR {acwrQ ? acwrQ.ratio.toFixed(2) : '—'}</span><span>Стадий {Object.keys(phaseGroups).length}</span>
                {(() => {
                  const peakW = W.reduce((best, w) => { const ts = w.sessions.reduce((s, ss) => s + ss.exercises.reduce((ss2, e) => ss2 + e.sets, 0), 0); return ts > best.ts ? { wk: w.week, ts } : best; }, { wk: 1, ts: 0 });
                  const delW = W.filter((w:any) => (w as any).phase === 'deload' || (w as any).deload).map((w:any) => w.week);
                  const accW = W.filter((w:any) => ((w as any).phase || 'accumulation') === 'accumulation');
                  const intW = W.filter((w:any) => ((w as any).phase || '') === 'intensification');
                  const avgRirFor = (ws: any[]) => { const exs = ws.flatMap((w:any) => w.sessions.flatMap((s:any) => s.exercises)); if (!exs.length) return '—'; return (exs.reduce((a:any,e:any) => a + (Number.isFinite(e.rir) ? e.rir : 2), 0) / exs.length).toFixed(1); };
                  return (<>
                    <span style={{ fontSize:10, color:'#f59e0b' }}>📈 пик нед {peakW.wk} ({peakW.ts} сетов)</span>
                    <span style={{ fontSize:10, color: delW.length ? '#22c55e' : '#ef4444' }}>🔻 делод: {delW.length ? 'нед '+delW.join(',') : '⚠ не запланирована'}</span>
                    {accW.length ? <span style={{ fontSize:10, color:'#60a5fa' }}>⬆ накопл {accW.length} нед (RIR {avgRirFor(accW)})</span> : null}
                    {intW.length ? <span style={{ fontSize:10, color:'#ef4444' }}>⬇ интенсиф {intW.length} нед (RIR {avgRirFor(intW)})</span> : null}
                  </>);
                })()}  
              </div>
            </div>
            {needsDeloadQ && curPh !== 'deload' && (
              <div style={{ marginBottom:6, padding:8, borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', color:'#ef4444', fontSize:11, fontWeight:600 }}>🚨 ACWR {acwrQ?.ratio.toFixed(2)} &gt; 1.3 — рекомендуется разгрузка (факт фаза {PHASE_LABELS[curPh]} не делод).</div>
            )}
            {curPh === 'deload' && (() => {
              const dp = DELOAD_PROTOCOLS[deloadType] || DELOAD_PROTOCOLS.pump;
              return <div style={{ marginBottom:8, padding:10, borderRadius:12, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)' }}><div style={{ fontSize:12, fontWeight:800, color:'#22c55e', marginBottom:6 }}>🔋 Разгрузка — активное восстановление (параметры из DELOAD_PROTOCOLS['{deloadType}'])</div><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6, fontSize:11 }}><div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(34,197,94,0.06)' }}><div style={{ color:'#fff', fontSize:10 }}>Объём</div><div style={{ fontWeight:700, color:'#22c55e' }}>−{Math.round((1-dp.volumeMultiplier)*100)}%</div></div><div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(34,197,94,0.06)' }}><div style={{ color:'#fff', fontSize:10 }}>Интенсивность</div><div style={{ fontWeight:700, color:'#22c55e' }}>−{Math.round((1-dp.intensityMultiplier)*100)}%</div></div><div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(34,197,94,0.06)' }}><div style={{ color:'#fff', fontSize:10 }}>RIR</div><div style={{ fontWeight:700, color:'#22c55e' }}>→{dp.rirTarget}</div></div><div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(34,197,94,0.06)' }}><div style={{ color:'#fff', fontSize:10 }}>Повторения</div><div style={{ fontWeight:700, color:'#22c55e' }}>{dp.repRange[0]}-{dp.repRange[1]}</div></div></div></div>;
            })()}
          </CollapsibleCard>;
        })()}
    {/* <</A>> */}
    </>
  );
};

export interface BbQualityLoadVolumeProps {
  ctx: BbQualityLoadCtx;
  qualityVolumeOpen: boolean;
  setQualityVolumeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  bbWeekSel: number;
  setBbWeekSel: React.Dispatch<React.SetStateAction<number>>;
}

/** B — «Тренировочный объём — PRO» (единственная карточка объёма) + «Прогрессия весов». */
export const BbQualityLoadVolume: React.FC<BbQualityLoadVolumeProps> = ({ ctx, qualityVolumeOpen, setQualityVolumeOpen, bbWeekSel, setBbWeekSel }) => {
  const { quality, builtPlan, metrics, pedAdapt } = ctx;
  const W = builtPlan.weeks;
  return (
    <>
    {/* <<B>> */}
{/* 📊 Тренировочный объём — PRO (единственная карточка объёма, без дублей) */}
        {metrics && (() => {
          // — агрегаты по мезоциклу (все недели) для общего объёма
          const totalAgg: Record<string, { direct:number; effective:number }> = {};
          let totalDirectMeso = 0;
          for (const w of W) {
            const agg = aggregateBBVolume((w as any).sessions);
            for (const [m, v] of Object.entries(agg as any)) {
              if (!totalAgg[m]) totalAgg[m] = { direct:0, effective:0 };
              totalAgg[m].direct += (v as any).directSets || 0;
              totalAgg[m].effective += (v as any).effectiveSets || 0;
            }
            // totalDirectMeso — сумма прямых по неделе (без двойного учёта косвенного)
            totalDirectMeso += Object.values(agg as any).reduce((s:number, vv:any)=> s + (vv.directSets||0), 0);
          }
          const totalWeeks = W.length || 1;
          const avgWeeklyDirect = Math.round(totalDirectMeso / totalWeeks);
          // пик-неделя уже в metrics (пиковая по effective)
          const peakWeekDirect = metrics.totalSets;
          const peakWeekEffective = Math.round(metrics.perMuscle.reduce((s,m)=> s + m.effectiveSets, 0));
          // подгруппа спины (ширина/толщина) для пика и мезо
          const backSubPeak: Record<string, number> = {};
          const backSubTotal: Record<string, number> = {};
          const peakIdx = (()=>{ let best=0, idx=0; W.forEach((w:any,i:number)=>{ const ts = (w.sessions as any[]).reduce((a:number,s:any)=> a + s.exercises.reduce((b:number,e:any)=> b + (e.sets||0),0),0); if(ts>best){best=ts; idx=i;}}); return idx; })();
          const peakSessions = (W[peakIdx] as any)?.sessions || [];
          for (const s of peakSessions) for (const e of (s as any).exercises) if (e.muscle==='back') { const sub=(e as any).backSubgroup||'back'; backSubPeak[sub]=(backSubPeak[sub]||0)+(e.sets||0); }
          for (const w of W) for (const s of (w as any).sessions) for (const e of (s as any).exercises) if (e.muscle==='back') { const sub=(e as any).backSubgroup||'back'; backSubTotal[sub]=(backSubTotal[sub]||0)+(e.sets||0); }
          const SUB_LABEL: Record<string,string> = { back_width:'ширина (латы)', back_thickness:'толщина (ромб/трап)', upper_back:'верх спины', traps:'трапеции', rear_delts:'задние дельты', erectors:'разгибатели' };
          const GROUPS: Array<{ id:string; label:string; icon:string; muscles:string[] }> = [
            { id:'chest', label:'Грудь', icon:'🧱', muscles:['chest'] },
            { id:'back', label:'Спина', icon:'🦴', muscles:['back'] },
            { id:'shoulders', label:'Плечи', icon:'🤸', muscles:['delt_front','delt_mid','delt_rear'] },
            { id:'legs', label:'Ноги', icon:'🦵', muscles:['quads','hamstrings','glutes','calves'] },
            { id:'arms', label:'Руки', icon:'💪', muscles:['biceps','triceps','forearms'] },
            { id:'core', label:'Кор', icon:'🧘', muscles:['abs'] },
          ];
          const ru = (m:string)=> (MUSCLE_LABEL_RU as any)[m] || m;
          const statusMeta: Record<string,{label:string;color:string}> = { below_mev:{label:'недотрен',color:'#60a5fa'}, optimal:{label:'оптимум',color:'#22c55e'}, approaching_mrv:{label:'около MRV',color:'#f59e0b'}, exceeding_mrv:{label:'перегруз',color:'#ef4444'} };
          const order: Record<string,number> = { exceeding_mrv:0, approaching_mrv:1, below_mev:2, optimal:3 };
          // сортировка внутри группы по статусу и объёму
          return (
            <div style={{ ...CARD, padding:0, overflow:'hidden', border:'1px solid rgba(0,230,138,0.22)', background:'rgba(6,22,18,0.42)', marginBottom:8 }}>
              <button type="button" onClick={() => setQualityVolumeOpen(v=>!v)} aria-expanded={qualityVolumeOpen} style={{ width:'100%', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', padding:'10px 12px', cursor:'pointer', background:'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(16,185,129,0.06))', border:'none', borderBottom: qualityVolumeOpen ? '1px solid rgba(255,255,255,0.06)' : 'none', textAlign:'left' }}>
                <span style={{ fontSize:12, fontWeight:900, color:'#fff' }}>📊 Тренировочный объём — PRO</span>
                <span style={{ marginLeft:'auto', fontSize:10, fontWeight:700, color:'#fff', background:'rgba(255,255,255,0.06)', padding:'3px 8px', borderRadius:20, border:'1px solid rgba(255,255,255,0.08)' }}>пик {peakWeekDirect} прям · {peakWeekEffective} эфф · среднее {avgWeeklyDirect}/нед · мезоцикл {totalDirectMeso} прям</span>
                <span style={{ width:24, height:24, borderRadius:7, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:11, transform: qualityVolumeOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.2s', marginLeft:8 }}>▼</span>
              </button>
              <div style={{ display: qualityVolumeOpen ? 'block' : 'none' }}>
                <div style={{ padding:'10px 12px', background:'rgba(255,255,255,0.02)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize:10, color:'#fff', opacity:0.72, lineHeight:1.35 }}>
                    Пиковая неделя — максимум нагрузки · мезоцикл {totalWeeks} нед · прямой / косвенный / эффективный (с учётом вторичной работы) · подмышцы · частота · статус MEV/MAV/MRV · паттерны/углы/растяжка
                    {pedAdapt.combinedMrvMultiplier>1 && <span style={{ marginLeft:6, color:'#f59e0b', background:'rgba(245,158,11,0.10)', padding:'2px 6px', borderRadius:6, border:'1px solid rgba(245,158,11,0.18)' }}>MRV ×{pedAdapt.combinedMrvMultiplier.toFixed(2)}</span>}
                  </div>
                  <div style={{ marginTop:6, display:'flex', gap:6, flexWrap:'wrap', fontSize:10, color:'#fff' }}>
                    <span><span style={{ color:'#22c55e' }}>●</span> MEV минимум</span>
                    <span><span style={{ color:'#f59e0b' }}>●</span> MAV оптимум</span>
                    <span><span style={{ color:'#ef4444' }}>●</span> MRV максимум</span>
                    <span style={{ opacity:0.6 }}>· пороги уже с учётом уровня, PED и восстановления</span>
                  </div>
                </div>
                <div style={{ padding:'10px 12px', display:'grid', gap:10 }}>
                {GROUPS.map(g=>{
                  const rows = g.muscles.map(mid=> metrics.perMuscle.find(mm=> mm.muscle===mid)).filter(Boolean) as any[];
                  if (rows.length===0) return null;
                  // сортировка внутри группы
                  const sorted = [...rows].sort((a,b)=> (order[a.status]??9)-(order[b.status]??9) || b.effectiveSets - a.effectiveSets);
                  return (
                     <CollapsibleCard key={g.id} title={`${g.icon} ${g.label}`} defaultOpen={true} badge={`${sorted.length} мышц`} headerStyle={{ background:'linear-gradient(135deg, rgba(0,230,138,0.09), rgba(0,230,138,0.03))', color:'#00e68a' }}>
                       <div style={{ display:'grid', gap:8 }}>
                        {sorted.map((m:any)=>{
                          const st = statusMeta[m.status] || statusMeta.optimal;
                          const tot = totalAgg[m.muscle] || { direct:0, effective:0 };
                          const indirectW = Math.max(0, Math.round((m.effectiveSets - m.directSets)*10)/10);
                          const indirectT = Math.max(0, Math.round((tot.effective - tot.direct)*10)/10);
                          const barMax = Math.max(m.mrv, m.effectiveSets, 1);
                          const pct = (v:number)=> Math.max(0, Math.min(100, v/barMax*100));
                          const тяжPct = m.totalSets>0 ? Math.round(m.тяжSets/m.totalSets*100) : 0;
                          const isBack = m.muscle==='back';
                          return (
                             <CollapsibleCard key={m.muscle} title={`${g.icon} ${ru(m.muscle)}`} defaultOpen={false} badge={`${Math.round(m.effectiveSets)} эфф`} headerStyle={{ background:'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))', color:'#fff' }}>
                               <div style={{ padding:0, borderRadius:9, background:'rgba(0,0,0,0.14)' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                                <span style={{ fontSize:11, fontWeight:800, color:'#fff' }}>{ru(m.muscle)}</span>
                                <span style={{ fontSize:10, fontWeight:800, padding:'2px 7px', borderRadius:20, background: st.color+'18', color: st.color, border:`1px solid ${st.color}22` }}>{st.label}</span>
                               </div>
                               <div style={{ marginTop:5, display:'flex', gap:6, flexWrap:'wrap', fontSize:10, color:'#fff', lineHeight:1.35 }}>
                                <span style={{ background:'rgba(255,255,255,0.04)', padding:'2px 6px', borderRadius:6, border:'1px solid rgba(255,255,255,0.05)' }} title="Прямая / косвенная = эффективная">неделя: <b>{m.directSets}</b> / {indirectW} <span style={{ opacity:0.6 }}>(прям/косв)</span> · <b>{m.effectiveSets}</b> эфф {m.directSets===0 && indirectW>0 ? <span style={{ fontSize:9, color:'#60a5fa', background:'rgba(96,165,250,0.12)', padding:'1px 4px', borderRadius:4, marginLeft:4, border:'1px solid rgba(96,165,250,0.18)' }}>косвенная</span> : null}</span>
                                <span style={{ background:'rgba(255,255,255,0.04)', padding:'2px 6px', borderRadius:6, border:'1px solid rgba(255,255,255,0.05)' }} title="Прямая / косвенная = эффективная">мезоцикл: {tot.direct} / {indirectT} <span style={{ opacity:0.6 }}>(прям/косв)</span> · <b>{Math.round(tot.effective)}</b> эфф · средн. {Math.round(tot.effective/totalWeeks*10)/10}/нед</span>
                               </div>
                               <div style={{ position:'relative', height:10, borderRadius:5, background:'rgba(255,255,255,0.06)', overflow:'hidden', marginTop:6 }}>
                                 <div style={{ position:'absolute', left:0, top:0, bottom:0, width: pct(m.effectiveSets)+'%', background: st.color, borderRadius:5, opacity:0.88 }} />
                                 <div title={`MEV ${m.mev}`} style={{ position:'absolute', left: pct(m.mev)+'%', top:-2, bottom:-2, width:2, background:'#22c55e' }} />
                                 <div title={`MAV ${m.mav}`} style={{ position:'absolute', left: pct(m.mav)+'%', top:-2, bottom:-2, width:2, background:'#f59e0b' }} />
                                 <div title={`MRV ${m.mrv}`} style={{ position:'absolute', left: pct(m.mrv)+'%', top:-2, bottom:-2, width:2, background:'#ef4444' }} />
                               </div>
                               <div style={{ display:'flex', justifyContent:'space-between', gap:8, fontSize:10, color:'#fff', marginTop:4, flexWrap:'wrap' }}>
                                 <span>MEV {m.mev} · MAV {m.mav} · MRV {m.mrv}</span>
                                 <span style={{ opacity:0.85 }}>{m.frequencyPerRotation}×/нед · тяж {тяжPct}% · RIR {m.avgRir.toFixed(1)}</span>
                               </div>
                               <div style={{ fontSize:10, color: st.color, fontWeight:600, marginTop:4 }}>{(()=>{ const eff=m.effectiveSets; if(eff < m.mev) return `Недотрен: +${(m.mev - eff).toFixed(1)} эфф до MEV`; if(eff >= m.mrv) return `Перегруз: −${(eff - m.mrv).toFixed(1)} эфф (выше MRV)`; if(eff > m.mav) return `Выше оптимума: ${m.mav}–${m.mrv}, можно держать или −${(eff - m.mav).toFixed(1)} до MAV`; if(eff < m.mav) return `Ниже оптимума: +${(m.mav - eff).toFixed(1)} эфф до MAV`; return 'Оптимум — в точке MAV'; })()}</div>
                               {(() => {
                                 const proQ = (quality as any).proResult as any;
                                 if (!proQ) return null;
                                 const findPat = proQ.patterns.find((p:any)=> p.muscle===m.muscle || (m.muscle==='chest' && p.muscle==='chest') || (m.muscle==='back' && p.muscle==='back') || (['quads','hamstrings','glutes','calves'].includes(m.muscle) && p.muscle==='legs') || (['delt_front','delt_mid','delt_rear'].includes(m.muscle) && p.muscle==='shoulders') || (['biceps','triceps','forearms'].includes(m.muscle) && p.muscle==='arms') || (m.muscle==='abs' && p.muscle==='core'));
                                 const findAng = proQ.angles.find((a:any)=> a.muscle===m.muscle || (['quads','hamstrings','glutes'].includes(m.muscle) && a.muscle==='legs') || (['delt_front','delt_mid','delt_rear'].includes(m.muscle) && a.muscle==='shoulders') || (m.muscle==='chest' && a.muscle==='chest') || (m.muscle==='back' && a.muscle==='back'));
                                 const findStr = proQ.stretches.find((s:any)=> s.muscle===m.muscle || (['delt_front','delt_mid','delt_rear'].includes(m.muscle) && s.muscle==='shoulders') || (['quads','hamstrings','glutes','calves'].includes(m.muscle) && s.muscle==='legs') || (['biceps','triceps','forearms'].includes(m.muscle) && s.muscle==='arms') || (m.muscle==='abs' && s.muscle==='core'));
                                 if (!findPat && !findAng && !findStr) return null;
                                 return (
                                   <div style={{ marginTop:6, padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)', fontSize:10, color:'#fff', lineHeight:1.35 }}>
                                     {findPat && <div><b>Паттерны:</b> {findPat.patterns.join(', ')||'—'} {findPat.ok ? '✅' : `⚠️ ${findPat.issue || ''}`} {findPat.expected?.length ? <span style={{ opacity:0.6 }}>(ожид: {findPat.expected.join(', ')})</span> : null}</div>}
                                     {findAng && <div><b>Углы:</b> {findAng.angles.join(', ')||'—'} {findAng.ok ? '✅' : `⚠️ ${findAng.issue || ''}`} {findAng.expected?.length ? <span style={{ opacity:0.6 }}>(ожид: {findAng.expected.join(', ')})</span> : null} · покрытие {Math.round((findAng.coverage||0)*100)}%</div>}
                                     {findStr && <div><b>Растяжка:</b> {findStr.hasStretch ? `✅ ${findStr.stretchExercises.slice(0,2).join(', ')}` : '❌ нет stretch-фазы'} {findStr.ok ? '' : '— добавьте'}</div>}
                                   </div>
                                 );
                               })()}
                               {isBack && Object.keys(backSubPeak).length>0 && (
                                 <div style={{ marginTop:6, display:'grid', gap:4 }}>
                                   <div style={{ fontSize:9, fontWeight:700, color:'#fff', opacity:0.6 }}>Подмышцы спины (пик / мезо) + паттерны/углы/растяжка:</div>
                                   {Object.entries(backSubPeak).sort((a,b)=> (b[1] as number)-(a[1] as number)).slice(0,4).map(([sub, v])=> {
                                     const subPro = (quality as any).proResult as any;
                                     const subFindPat = subPro?.patterns.find((pp:any)=> pp.muscle==='back' && (pp as any).subgroup===sub);
                                     const subFindAng = subPro?.angles.find((aa:any)=> aa.muscle==='back' && (aa as any).subgroup===sub);
                                     const subFindStr = subPro?.stretches.find((ss:any)=> ss.muscle==='back' && (ss as any).subgroup===sub);
                                     return (
                                     <div key={sub} style={{ display:'grid', gap:3, padding:'5px 6px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                                       <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#fff' }}>
                                         <span style={{ fontWeight:700 }}>{SUB_LABEL[sub]||sub}</span>
                                         <span>пик {v as number} · всего {backSubTotal[sub]||0} · средн. {Math.round((backSubTotal[sub]||0)/totalWeeks*10)/10}/нед</span>
                                       </div>
                                       {(subFindPat || subFindAng || subFindStr) && (
                                         <div style={{ fontSize:9, color:'#fff', lineHeight:1.3, opacity:0.85 }}>
                                           {subFindPat && <div><b>Паттерн:</b> {subFindPat.patterns?.join(', ')||'—'} {subFindPat.ok?'✅':'⚠️ '+(subFindPat.issue||'')}</div>}
                                           {subFindAng && <div><b>Угол:</b> {subFindAng.angles?.join(', ')||'—'} {subFindAng.ok?'✅':'⚠️ '+(subFindAng.issue||'')} · {Math.round((subFindAng.coverage||0)*100)}%</div>}
                                           {subFindStr && <div><b>Растяжка:</b> {subFindStr.hasStretch?`✅ ${subFindStr.stretchExercises?.slice(0,1).join(', ')}`:'❌ нет'}</div>}
                                         </div>
                                       )}
                                       {!subFindPat && !subFindAng && !subFindStr && (
                                         <div style={{ fontSize:9, color:'#fff', opacity:0.6 }}>Паттерны спины общие: тяги вертикаль/горизонталь · углы в норме · растяжка: тяга с паузой</div>
                                       )}
                                     </div>
                                   )})}
                                 </div>
                               )}
                             </div>
                             </CollapsibleCard>
                           );
                         })}
                        </div>
                      </CollapsibleCard>
                   );
                 })}
                 <div style={{ fontSize:9, color:'#fff', opacity:0.5, lineHeight:1.35, padding:'6px 8px', background:'rgba(255,255,255,0.02)', borderRadius:8, border:'1px solid rgba(255,255,255,0.04)' }}>
                   Прямой — сеты упражнений целевыми на мышцу · косвенный — от базы (жимы → трицепс/плечи, тяги → бицепс, приседы → ягодицы/бицепс бедра) · эффективный = прямой + косвенный · недельный — пиковая неделя, общий — сумма по всем неделям мезоцикла · статус по эффективному.
                 </div>
               </div>
               </div>
             </div>
           );
         })()}
         {/* Прогрессия весов по неделям (основные упражнения) — факт из плана */}
         {(() => {
           const totalW = W.length;
           const selW = Math.min(Math.max(1, bbWeekSel), totalW);
           const primaryExs = new Map<string, { name: string; muscle: string; weights: number[] }>();
           for (const w of W) {
             for (const s of w.sessions) {
               for (const e of s.exercises) {
                 if (e.role !== 'primary') continue;
                 const key = e.name;
                 if (!primaryExs.has(key)) primaryExs.set(key, { name: e.name, muscle: e.muscle, weights: new Array(totalW).fill(0) });
                 const rec = primaryExs.get(key)!;
                 rec.weights[w.week - 1] = e.workSets[0]?.weight || 0;
               }
             }
           }
           if (primaryExs.size === 0) return null;
           const top = [...primaryExs.values()].filter(e => e.weights.some(w => w > 0)).slice(0, 6);
           if (top.length === 0) return null;
           const startW = 0;
           return <CollapsibleCard title="📈 Прогрессия весов (кг) — факт плана" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))', color: '#f59e0b' }} badge={`нед ${selW}/${totalW}`}>
             <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
               <span style={{ fontSize:10, color:'#fff', opacity:0.6, whiteSpace:'nowrap' }}>1</span>
               <input type="range" min={1} max={totalW} value={selW} aria-label="Выбрать неделю для анализа прогрессии весов" onChange={e => setBbWeekSel(Number(e.target.value))} style={{ flex:1, accentColor:'#f59e0b' }} />
               <span style={{ fontSize:10, color:'#fff', opacity:0.6, whiteSpace:'nowrap' }}>{totalW}</span>
             </div>
             <div style={{ display:'grid', gap:6 }}>
               {top.map(ex => {
                 const wSel = ex.weights[selW - 1] || 0;
                 const wStart = ex.weights[startW] || 0;
                 const prev = selW > 1 ? (ex.weights[selW - 2] || 0) : 0;
                 const up = prev > 0 && wSel > prev;
                 const down = prev > 0 && wSel < prev;
                 const delta = wStart > 0 ? wSel - wStart : 0;
                 const deltaStr = delta > 0 ? '+' + delta : delta < 0 ? String(delta) : '0';
                 const pct = (() => {
                   const nonZero = ex.weights.filter(v => v > 0);
                   if (nonZero.length < 2) return null;
                   const mn = Math.min(...nonZero), mx = Math.max(...nonZero);
                   if (mx === mn) return 100;
                   return Math.round(((wSel - mn) / (mx - mn)) * 100);
                 })();
                 return (
                   <div key={ex.name} style={{ display:'grid', gridTemplateColumns:'1.4fr 0.7fr 0.7fr 1fr', gap:6, alignItems:'center', padding:'7px 9px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                     <span style={{ fontWeight:600, color:'#fff', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={ex.name}>{ex.name.substring(0, 22)}</span>
                     <span style={{ fontSize:10, color:'#fff', opacity:0.55 }}>нед 1: <b style={{ color:'#fff' }}>{wStart || '—'}</b> кг</span>
                     <span style={{ fontSize:11, fontWeight:800, color: up ? '#22c55e' : down ? '#ef4444' : '#f59e0b' }}>{wSel ? wSel + ' кг' : '—'}{wSel > 0 && delta !== 0 ? <span style={{ fontSize:9, opacity:0.8, marginLeft:4 }}>({deltaStr})</span> : null}</span>
                     <span style={{ height:6, borderRadius:6, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
                       <span style={{ display:'block', height:'100%', width: (pct ?? 0) + '%', background: up ? '#22c55e' : down ? '#ef4444' : '#f59e0b', transition:'width 0.2s' }} />
                     </span>
                   </div>
                 );
               })}
             </div>
             <div style={{ marginTop:6, fontSize:10, color:'#fff', display:'flex', gap:12 }}>
               <span>🟢 +вес</span><span>🟡 стабильно</span><span>🔴 −вес (разгрузка)</span><span style={{ opacity:0.6, marginLeft:'auto' }}>ползунок — выбор недели</span>
             </div>
           </CollapsibleCard>;
         })()}
    {/* <</B>> */}
    </>
  );
};

export interface BbQualityLoadChecksProps {
  ctx: BbQualityLoadCtx;
}

/** C — «Мусорный объём» + «Рекомендации» + графики объёма/RIR + ACWR + прогноз мезоцикла. */
export const BbQualityLoadChecks: React.FC<BbQualityLoadChecksProps> = ({ ctx }) => {
  const { quality, builtPlan, weakPoints, bbLevel, bbTrainingYears, specializationMode, specTargets, bbGoal, bbTrainingFocus, bbMethodology, bbVolGoal, trainingVolumeMode, bbEquipment, injuries, ratio } = ctx;
  const W = builtPlan.weeks;
  return (
    <>
    {/* <<C>> */}
<CollapsibleCard title="🗑 Мусорный объём" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))', color: '#ef4444' }}>
        {(() => {
          const garbage = detectGarbageVolume(builtPlan.weeks, weakPoints, { level: bbLevel, trainingYears: bbTrainingYears, focusGroup: '', specialization: specializationMode, specializationTargets: specTargets });
          const ruMuscleG = (m: string) => (MUSCLE_LABEL_RU as any)[m] || m;
          const ruReason = (r: string) => r
            .replace(/Дублирование паттерна (\S+) для (\S+)/, 'Дубль изоляции «$1» для «$2» — в одной сессии достаточно одной')
            .replace(/Мышца (\S+) не входит в тег сессии (\S+)/, 'Мышца «$1» не входит в день «$2» — проверьте совместимость сплита с выбранными группами');
          const paramChips: string[] = [];
          paramChips.push(`уровень ${bbLevel}`);
          if (bbTrainingYears!==undefined) paramChips.push(`стаж ${bbTrainingYears}л`);
          paramChips.push(`цель ${bbGoal}`);
          paramChips.push(`фокус ${bbTrainingFocus}`);
          paramChips.push(`методика ${bbMethodology}`);
          paramChips.push(`сплит ${builtPlan.pattern?.name || builtPlan.pattern?.id || '—'}`);
          paramChips.push(`объём ${bbVolGoal}${trainingVolumeMode==='high'?' (объёмный)':''}`);
          if (weakPoints.length) paramChips.push(`слабые: ${weakPoints.join(', ')}`);
          if (specializationMode) paramChips.push(`специализация ${specTargets.join('+')}`);
          if (bbEquipment.length) paramChips.push(`оборудование ${bbEquipment.slice(0,3).join(', ')}${bbEquipment.length>3?'…':''}`);
          if (injuries.length) paramChips.push(`травмы ${injuries.length}`);
          if (garbage.length === 0) {
            return (
              <div style={{ ...CARD, background:'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(16,185,129,0.04))', border:'1px solid rgba(34,197,94,0.18)', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:-12, right:-12, width:80, height:80, borderRadius:80, background:'radial-gradient(circle, rgba(34,197,94,0.12), transparent 70%)' }} />
                <div style={{ fontSize:12, fontWeight:800, color:'#22c55e', display:'flex', alignItems:'center', gap:6 }}>🗑 Мусорный объём: чисто ✅ <span style={{ fontSize:10, fontWeight:600, color:'#22c55e', background:'rgba(34,197,94,0.12)', padding:'2px 7px', borderRadius:20, border:'1px solid rgba(34,197,94,0.22)' }}>соответствует параметрам</span></div>
                <div style={{ fontSize:11, color:'#fff', marginTop:6, lineHeight:1.5 }}>Дублей изоляций не найдено. Для слабых/фокусных групп повтор паттерна допустим — учтена каноника <span style={{ fontFamily:'ui-monospace, monospace', background:'rgba(255,255,255,0.06)', padding:'1px 4px', borderRadius:4 }}>chest_upper→chest, delt_mid→shoulders</span>. Икры «стоя+сидя» — по дизайну 2 разных упражнения, не дубль. Проверка: compound-паттерны (жим/тяга/присед) — не считаются мусором (разные углы — норма).</div>
                <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:4 }}>
                  {paramChips.map((p,i)=> <span key={i} style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'2px 7px', borderRadius:20 }}>{p}</span>)}
                </div>
              </div>
            );
          }
          return (
            <div style={{ ...CARD, background:'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(245,158,11,0.04))', border:'1px solid rgba(239,68,68,0.18)', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-10, right:-10, width:90, height:90, borderRadius:90, background:'radial-gradient(circle, rgba(239,68,68,0.12), transparent 70%)' }} />
              <div style={{ fontSize:12, fontWeight:800, color:'#ef4444', display:'flex', alignItems:'center', gap:8 }}>🗑 Мусорный объём: найдено {garbage.length} <span style={{ fontSize:10, fontWeight:600, color:'#ef4444', background:'rgba(239,68,68,0.12)', padding:'2px 7px', borderRadius:20, border:'1px solid rgba(239,68,68,0.22)' }}>несоответствие параметрам</span></div>
              <div style={{ fontSize:11, color:'#fff', marginTop:6, lineHeight:1.5 }}>
                Дублирование изоляций: план содержит повторы одного паттерна для одной мышцы в одной сессии — при выбранных параметрах это избыточно. Для слабых/фокусных групп дубль <b>допустим</b> (учтена каноника), для остальных — мусор. Проверено по: {paramChips.slice(0,6).join(' · ')}{paramChips.length>6?' …':''}.
              </div>
              <div style={{ marginTop:8, display:'grid', gap:6 }}>
                {garbage.slice(0, 6).map((g, i) => (
                  <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'7px 9px', borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.12)' }}>
                    <span style={{ flexShrink:0, width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.14)', color:'#ef4444', fontWeight:800, fontSize:11 }}>{i+1}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{g.exerciseName} <span style={{ fontWeight:400, opacity:0.7 }}>· {ruMuscleG(g.muscle)} · {g.sessionTag || 'день'}</span></div>
                      <div style={{ fontSize:10, color:'#fbbf24', marginTop:2 }}>{ruReason(g.reason)}</div>
                      <div style={{ fontSize:10, color:'#fff', opacity:0.6, marginTop:2 }}>Исправление: заменить на другой угол/хват или убрать (для слабых — оставить, если цель — специализация).</div>
                    </div>
                  </div>
                ))}
              </div>
              {garbage.length > 6 && <div style={{ marginTop:6, fontSize:11, color:'#fff', textAlign:'center', opacity:0.7 }}>…и ещё {garbage.length - 6} — откройте план, проверьте сессии</div>}
              <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:4 }}>
                {paramChips.map((p,i)=> <span key={i} style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'2px 7px', borderRadius:20 }}>{p}</span>)}
              </div>
            </div>
          );
        })()}</CollapsibleCard>
        {/* Рекомендации — единственные, детали уже в них (quality.details убраны как дубль) */}
        <CollapsibleCard title="💡 Рекомендации по качеству плана" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))', color: '#f59e0b' }}>{quality.recommendations && quality.recommendations.length > 0 && (
          <div style={{ ...CARD, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6, display:'none' }}>💡 Рекомендации по качеству плана</div>
            {quality.recommendations.map((r, i) => (
              <div key={i} style={{ fontSize:11, color:'#fff', marginBottom:3, paddingLeft:4, borderLeft:'2px solid #f59e0b' }}>{r}</div>
            ))}
          </div>
        )}</CollapsibleCard>
        <CollapsibleCard title="📊 Объём по неделям (сетов)" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.08), rgba(96,165,250,0.03))', color: '#60a5fa' }}>{(() => {
          const vdata: WeekVolume[] = W.map(w => {
            const muscles: Record<string, number> = {};
            w.sessions.forEach(s => s.exercises.forEach(e => { const m = e.muscle || 'other'; muscles[m] = (muscles[m] || 0) + e.sets; }));
            return { week: w.week, totalSets: Object.values(muscles).reduce((a, b) => a + b, 0), muscles };
          });
          if (vdata.length < 2) return null;
          return (
            <div style={{ ...CARD }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>📊 Объём по неделям (сетов)</div>
              <VolumeByWeekChart data={vdata} />
            </div>
          );
        })()}</CollapsibleCard>
        <CollapsibleCard title="📉 Динамика RIR по неделям" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(168,85,247,0.03))', color: '#a855f7' }}>{(() => {
          const rdata: RirRecord[] = [];
          W.forEach(w => w.sessions.forEach(s => s.exercises.forEach(e => rdata.push({ week: w.week, exercise: e.name || e.muscle || '', rir: e.rir || 0 }))));
          if (rdata.length < 2) return null;
          return (
            <div style={{ ...CARD, marginTop:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>📉 Динамика RIR по неделям</div>
              <RirDriftChart data={rdata} />
            </div>
          );
        })()}</CollapsibleCard>
        <CollapsibleCard title="📈 Оценка тренировочной нагрузки" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.08), rgba(96,165,250,0.03))', color: '#60a5fa' }}><div style={{ ...CARD, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6, display:'none' }}>📈 Оценка тренировочной нагрузки</div>
          {!ratio ? <div style={SMALL}>Недостаточно данных sRPE для расчёта ACWR. Ведите дневник тренировок.</div> : (
            <div>
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <span style={SMALL}>ACWR: <b style={{ color:ratio.ratio>1.5?'#ef4444':ratio.ratio>1.3?'#eab308':'#22c55e', fontSize:14 }}>{ratio.ratio.toFixed(2)}</b></span>
                <span style={{ padding:'3px 8px', borderRadius:8, fontSize:11, fontWeight:700, background:ratio.zone==='dangerous'?'rgba(239,68,68,0.15)':ratio.zone==='caution'?'rgba(234,179,8,0.15)':'rgba(34,197,94,0.15)', color:ratio.zone==='dangerous'?'#ef4444':ratio.zone==='caution'?'#eab308':'#22c55e' }}>{ratio.zone === 'dangerous' ? '⛔ Опасно' : ratio.zone === 'caution' ? '⚠ Осторожно' : ratio.zone === 'optimal' ? '✅ Оптимум' : '⬇ Недотрен'}</span>
              </div>
              <div style={{ marginTop:6, ...SMALL }}>Хроническая нагрузка (28д) vs острая (7д). Цель: 0.8-1.3. Разгрузка при {`>`}1.5.</div>
            </div>
          )}
        </div></CollapsibleCard>
        {/* Дополнительно: прогноз прогрессии — карточка в стиле всех карточек шага */}
        <CollapsibleCard title="🔧 Дополнительно: прогноз прогрессии" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.10), rgba(59,130,246,0.03))', color: '#60a5fa' }} badge={`${W.length} нед`}>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <MesocycleProgressionCard weeks={W.length} startVolumeSets={Math.round(W.reduce((s,w)=>s+w.sessions.reduce((ss,sess)=>ss+sess.exercises.reduce((sss,e)=>sss+e.sets,0),0),0)/W.length)} startIntensityPct={0.7} startRIR={2} goal="hypertrophy" title="Прогрессия мезоцикла (ББ)" hideApply />
          </div>
        </CollapsibleCard>
    {/* <</C>> */}
    </>
  );
};

import React, { useState, useMemo } from 'react';
import { epley1RM, brzycki1RM } from '../../engines/ultimate-calculators.engine';
import { calculatePK, calculateDose } from '../../engines/pk-dose.engine';
import { generateStack } from '../../engines/stack-generator.engine';
import { SynergyEngine } from '../../engines/synergy-score.engine';
import { assessRisk } from '../../engines/risk-assessor.engine';
import { calculateRiskScore } from '../../engines/risk-calculator.engine';
import { evaluateBrain } from '../../engines/ultra-brain.engine';
import { generateTrainingPlan } from '../../engines/training-pipeline.engine';
import { applyProgression, recommendProgression } from '../../engines/progression-rules.engine';
import { getTrainingBlocks } from '../../engines/block-designer.engine';
import { orderExercises } from '../../engines/exercise-ordering.engine';
import { selectVariation } from '../../engines/exercise-variation.engine';
import { identifyPhase, getMotivationPhases } from '../../engines/coaching-psychology.engine';
import { getRecoveryMethods, getRecoveryByCategory } from '../../engines/recovery-techniques-encyclopedia.engine';
import { generateDayMealPlan } from '../../engines/nutrition-meal-plan.engine';
import { getProgramTemplates, getProgramsByGoal as getPgByGoal } from '../../engines/program-templates.engine';
import { generateCheckpoints } from '../../engines/labs-scheduler.engine';
import { getActiveDrugTriggers } from '../../engines/labs-schedule.engine';
import { normalizeLab } from '../../engines/labs.engine';
import { generateSetScheme } from '../../engines/set-scheme-engine';
import { generateRepTempo } from '../../engines/rep-tempo-engine';
import { generateWarmup } from '../../engines/warmup-engine';
import { generateCooldown } from '../../engines/cooldown-engine';
import { estimateSessionDifficulty } from '../../engines/session-metrics-engine';
import { calculatePRI } from '../../engines/autoregulation.engine';
import { getRequiredPatterns } from '../../engines/exercise-generator.engine';
import { createArticle, updateArticle } from '../../engines/articles.engine';
import { filterLabsByRole, generateRoleInsights } from '../../engines/role-view.engine';
import { useDataLink } from '../../core/data-link';

export const FullIntegrationScreen: React.FC = () => {
  const linked = useDataLink();
  const [tab, setTab] = useState('calc');

  const tabs = ['calc','pk','stack','synergy','risk','brain','recovery','meal','programs','ordering','variation','coaching','labs','tempo','warmup','pipeline'];
  const labels: Record<string,string> = {calc:'',pk:'',stack:'',synergy:'вљЎ РЎРёРЅРµСЂРіРёСЏ',risk:'вљ  Р РёСЃРєРё',brain:'',recovery:'',meal:'',programs:'',ordering:'',variation:'',coaching:'',labs:'',tempo:'вЏ± РўРµРјРї',warmup:'',pipeline:''};

  return (<div className="screen"><h2>рџ”§ РџРѕР»РЅР°СЏ РёРЅС‚РµРіСЂР°С†РёСЏ</h2>
    <div style={{ display:'flex',gap:3,marginBottom:10,overflowX:'auto',scrollbarWidth:'none' }}>
      {tabs.map(t => <button key={t} onClick={()=>setTab(t)} style={{ padding:'6px 10px',borderRadius:8,fontSize:11,cursor:'pointer',whiteSpace:'nowrap',background:tab===t?'var(--accent-green)':'var(--bg-secondary)',color:tab===t?'#000':'var(--text-dim)',border:'none',fontWeight:tab===t?700:400 }}>{labels[t]}</button>)}
    </div>

    {tab==='calc' && <CalcTab />}
    {tab==='pk' && <PKTab />}
    {tab==='stack' && <StackTab />}
    {tab==='synergy' && <SynergyTab />}
    {tab==='risk' && <RiskAssessTab />}
    {tab==='brain' && <BrainTab />}
    {tab==='recovery' && <RecoveryEncTab />}
    {tab==='meal' && <MealPlanTab />}
    {tab==='programs' && <ProgramTemplatesTab />}
    {tab==='ordering' && <OrderingTab />}
    {tab==='variation' && <VariationTab />}
    {tab==='coaching' && <CoachingTab />}
    {tab==='labs' && <LabsUtilTab course={linked.course} />}
    {tab==='tempo' && <TempoTab />}
    {tab==='warmup' && <WarmupPipelineTab />}
    {tab==='pipeline' && <PipelineTab />}
    <ArticlesSection />
  </div>);
};

const CalcTab = () => { const [w,sw]=useState(100);const[r,sr]=useState(5);return (<div className="card" style={{padding:10}}><h4 style={{margin:'0 0 6px',fontSize:12}}>рџ§® Ultimate Calculators</h4><div style={{display:'flex',gap:4,marginBottom:6}}><input type="number" value={w} onChange={e=>sw(+e.target.value)} style={{width:80,padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:12}} placeholder="Weight"/><input type="number" value={r} onChange={e=>sr(+e.target.value)} style={{width:60,padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:12}} placeholder="Reps"/></div><div style={{fontSize:10}}>Epley: <b>{epley1RM(w,r).toFixed(0)}</b> | Brzycki: <b>{brzycki1RM(w,r).toFixed(0)}</b></div></div>);};

const PKTab = () => { const pk = calculatePK({substanceId:'testosterone',doseMg:200,bioPercent:80,intervalHours:84,hours:168}); const d = calculateDose({mgPerKg:3,weightKg:80,liverIndex:20,gfr:100}); return (<div className="card" style={{padding:10}}><h4 style={{margin:'0 0 6px',fontSize:12}}>рџ’Љ PK/Dose</h4><div style={{fontSize:10}}>РџРёРє: <b>{pk.toFixed(1)} РјРі</b> | Р”РѕР·Р°: Р±Р°Р·Р° <b>{d.base}РјРі</b>, РїРµС‡РµРЅСЊ <b>{d.liverAdj}РјРі</b>, РїРѕС‡РєРё <b>{d.kidneyAdj}РјРі</b></div></div>);};

const StackTab = () => { const s = (generateStack as any)('energy', []); return (<div className="card" style={{padding:10}}><h4 style={{margin:'0 0 6px',fontSize:12}}>рџ“¦ Stack Generator</h4><div style={{fontSize:10}}>Score: <b>{s.score}</b> | {s.substances?.length || 0} РІРµС‰РµСЃС‚РІ</div>{s.warnings?.map((w:any,i:number)=><div key={i} style={{fontSize:9,color:'#f59e0b'}}>вљ  {w}</div>)}</div>);};

const SynergyTab = () => { const s = SynergyEngine as any; return (<div className="card" style={{padding:10}}><h4 style={{margin:'0 0 6px',fontSize:12}}>вљЎ Synergy Engine</h4><div style={{fontSize:10}}>Methods: calculatePair, countOpposites, getInteractionPenalty, getLevel</div></div>);};

const RiskAssessTab = () => { const r = assessRisk({exercise:'squat',weight:100,reps:5,experience:'intermediate',injuryHistory:[]} as any); const s = calculateRiskScore(['testosterone','trenbolone']); return (<div className="card" style={{padding:10}}><h4 style={{margin:'0 0 6px',fontSize:12}}>вљ  Risk Assessment</h4><div style={{fontSize:10}}>РџСЂРёСЃРµРґ 100Г—5: <b>{(r as any).risk || (r as any).score || 0}%</b></div><div style={{fontSize:10,marginTop:4}}>РЎС‚РµРє СЂРёСЃРє: <b>{(s as any).score || (s as any).total || 0}%</b></div></div>);};

const BrainTab = () => { const b = evaluateBrain({trainingAge:24,weeklyVolume:15000,recoveryScore:70,focusScore:80,moodScore:75,stressScore:25} as any); return (<div className="card" style={{padding:10}}><h4 style={{margin:'0 0 6px',fontSize:12}}>рџ§  Ultra Brain</h4><div style={{fontSize:10}}>Score: <b>{(b as any).score || 0}</b> | {(b as any).summary || ''}</div></div>);};

const RecoveryEncTab = () => { const methods = getRecoveryMethods(); const cats = [...new Set(methods.map((m:any)=>m.category))]; return (<div className="card" style={{padding:10,maxHeight:400,overflowY:'auto'}}><h4 style={{margin:'0 0 6px',fontSize:12}}>рџ”„ Recovery Encyclopedia ({methods.length})</h4>{cats.map(c=><div key={c}><div style={{fontWeight:600,fontSize:11,color:'var(--accent)',marginTop:4}}>{c}</div>{getRecoveryByCategory(c).slice(0,3).map((m:any,i:number)=><div key={i} style={{fontSize:9,padding:'2px 0'}}>вЂў {m.name}: {m.durationMin}РјРёРЅ, {m.frequency}</div>)}</div>)}</div>);};

const MealPlanTab = () => { const plan = (generateDayMealPlan as any)({kcal:2800,protein:160,fats:80,carbs:300}, []); return (<div className="card" style={{padding:10}}><h4 style={{margin:'0 0 6px',fontSize:12}}>рџЌЅ Meal Plan</h4>{plan.meals?.map((m:any,i:number)=><div key={i} style={{fontSize:9,marginBottom:2}}><b>{m.name}</b>: {m.items?.map((it:any)=>`${it.name} ${it.amount}g`).join(', ')}</div>)}</div>);};

const ProgramTemplatesTab = () => { const pts = getProgramTemplates(); return (<div className="card" style={{padding:10}}><h4 style={{margin:'0 0 6px',fontSize:12}}>рџ“‹ Program Templates ({pts.length})</h4>{pts.slice(0,6).map((p:any,i:number)=><div key={i} style={{fontSize:10,padding:'2px 0'}}>вЂў {p.name}: {p.weeks} РЅРµРґ ({p.goal})</div>)}</div>);};

const OrderingTab = () => { const o = (orderExercises as any)('strength','intermediate',4,['squat','bench','deadlift','ohp','row'],[]); return (<div className="card" style={{padding:10}}><h4 style={{margin:'0 0 6px',fontSize:12}}>рџ“ђ Exercise Ordering</h4><div style={{fontSize:10}}>{(o as any).ordered?.map((e:any,i:number)=><span key={i}>{i+1}. {e} </span>)}</div></div>);};

const VariationTab = () => { const v = (selectVariation as any)('squat','beginner','strength',[]); return (<div className="card" style={{padding:10}}><h4 style={{margin:'0 0 6px',fontSize:12}}>рџ”„ Exercise Variation</h4><div style={{fontSize:10}}>{(v as any).name || (v as any).exercise || 'Squat variation'}</div></div>);};

const CoachingTab = () => { const phase = (identifyPhase as any)(8,14,80,30); const phases = getMotivationPhases(); return (<div className="card" style={{padding:10}}><h4 style={{margin:'0 0 6px',fontSize:12}}>рџЋЇ Coaching Psychology</h4><div style={{fontSize:10}}>РўРµРєСѓС‰Р°СЏ С„Р°Р·Р°: <b>{(phase as any).name || phase.phase || 'вЂ”'}</b></div><div style={{fontSize:9,color:'var(--text-dim)',marginTop:4}}>Р¤Р°Р·: {phases.length}</div></div>);};

const LabsUtilTab: React.FC<{course:any}> = ({course}) => { const triggers = React.useMemo(()=>getActiveDrugTriggers(course||[]),[course]); const checkpoints = React.useMemo(()=>(generateCheckpoints as any)(course||[], 'baseline', 12, []),[course]); return (<div className="card" style={{padding:10}}><h4 style={{margin:'0 0 6px',fontSize:12}}>рџ§Є Labs Utils</h4><div style={{fontSize:10}}>РўСЂРёРіРіРµСЂРѕРІ: <b>{triggers.length}</b> | Р§РµРєРїРѕРёРЅС‚РѕРІ: <b>{checkpoints.length}</b></div></div>);};

const TempoTab = () => { const t = generateRepTempo({goal:'strength',experience:'intermediate',exerciseType:'compound'} as any); const s = generateSetScheme({goal:'strength',level:'intermediate',exercise:'squat',week:1,totalWeeks:12} as any); return (<div className="card" style={{padding:10}}><h4 style={{margin:'0 0 6px',fontSize:12}}>вЏ± Tempo & Set Scheme</h4><div style={{fontSize:10}}>РўРµРјРї: <b>{(t as any).tempo || (t as any).pattern || '3-1-3-0'}</b></div><div style={{fontSize:10,marginTop:2}}>РЎС…РµРјР°: <b>{(s as any).scheme || (s as any).pattern || '5x5'}</b></div></div>);};

const WarmupPipelineTab = () => { const wu = generateWarmup({exerciseId:'squat',workingWeight:100,goal:'strength'} as any); const cd = generateCooldown({durationMin:10,focus:'legs',equipment:['band']} as any); const diff = estimateSessionDifficulty({exercises:[{id:'squat',sets:5,reps:5,weight:100,rpe:7},{id:'bench',sets:5,reps:5,weight:80,rpe:7}],durationMin:60,restBetweenSets:120} as any);   const pri = calculatePRI({sleep:70,hrv:65,fatigue:30,recovery:75,nutrition:70} as any, 3, 7, 4);
  return (<div className="card" style={{padding:10}}><h4 style={{margin:'0 0 6px',fontSize:12}}>рџ”Ґ Warmup/Pipeline</h4><div style={{fontSize:10}}>Р Р°Р·РјРёРЅРєР°: <b>{(wu as any).sets?.length || 0} РїРѕРґС…РѕРґРѕРІ</b> | Р—Р°РјРёРЅРєР°: <b>{(cd as any).exercises?.length || 0} СѓРїСЂ.</b></div><div style={{fontSize:10,marginTop:2}}>РЎР»РѕР¶РЅРѕСЃС‚СЊ: <b>{(diff as any).difficulty || '-'}</b> | PRI: <b>{pri?.toFixed(0) || '-'}</b></div></div>);};

const PipelineTab = () => { const p = generateTrainingPlan({goal:'strength',level:'intermediate',daysPerWeek:4,weeks:12,split:'PPL'} as any); return (<div className="card" style={{padding:10}}><h4 style={{margin:'0 0 6px',fontSize:12}}>рџ”§ Training Pipeline</h4><div style={{fontSize:10}}>Р¤Р°Р·: <b>{(p as any).phases?.length || 0}</b> | РќРµРґРµР»СЊ: <b>{(p as any).weeks || 12}</b></div></div>);};

const ArticlesSection: React.FC = () => { const article = createArticle({title:'Test',content:'Article content',category:'training',tags:['strength'],authorId:'user1'} as any); return (<div className="card" style={{padding:10,marginTop:8}}><h4 style={{margin:'0 0 4px',fontSize:12}}>рџ“ќ Articles Engine</h4><div style={{fontSize:10}}>Created: <b>{article.title}</b> (v{article.version})</div></div>);};

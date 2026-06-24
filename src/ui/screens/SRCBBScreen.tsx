import React, { useMemo, useState } from 'react';
import { LMS_CYCLES, getCycleById } from '../../data/lms-cycles/lms-cycle-index';
import { rankCycles, selectBestCycle, explainSelection, type LMSSelectorInput } from '../../engines/lms/lms-selector.engine';
import { buildLMSPlan, type LMSBuildOutput } from '../../engines/lms/lms-builder.engine';
import { mesocyclePhaseForWeek } from '../../engines/rir-matrix.engine';
import { SPLIT_PATTERNS } from '../../engines/bb/bb-split-patterns';
import { rankBBSplits, selectBestBBSplit, explainBBSelection, type BBSelectorInput } from '../../engines/bb/bb-selector.engine';
import { buildBBPlan, type BBPlan } from '../../engines/bb/bb-builder.engine';
import { calcBBPlanMetrics, explainBBMetrics } from '../../engines/bb/bb-metrics.engine';
import { adaptForPEDs, explainPEDAdaptation, type PED } from '../../engines/bb/bb-ped-adaptation.engine';
import { getAllVolumeLandmarks } from '../../engines/volume-landmarks.engine';
import { PlateCalculator } from './SRCBBScreen_parts/PlateCalculator';
import { SessionPlayer, type PlayerDay } from './SRCBBScreen_parts/SessionPlayer';

import { AutoregPanel } from './SRCBBScreen_parts/AutoregPanel';
import { PeakingPanel } from './SRCBBScreen_parts/PeakingPanel';
import { RecoveryPanel } from './SRCBBScreen_parts/RecoveryPanel';
import { ExerciseSafetyPanel } from './SRCBBScreen_parts/ExerciseSafetyPanel';
import { TrainingMetricsChart, type LMSWeekMetric, type BBMuscleMetric } from './SRCBBScreen_parts/TrainingMetricsChart';
import { ExerciseDemoPanel } from './SRCBBScreen_parts/ExerciseDemoPanel';
type Mode = 'src' | 'bb';

const CARD: React.CSSProperties = { background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px', margin: '6px 0' };
const ACCENT = '#00e68a';
const BTN: React.CSSProperties = { background: ACCENT, color: '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 14, minHeight: 44 };
const BTN_GHOST: React.CSSProperties = { ...BTN, background: 'transparent', color: ACCENT, border: `1px solid ${ACCENT}` };
const SEL: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 40, width: '100%' };
const IN: React.CSSProperties = { ...SEL, padding: '10px' };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: '6px 0 3px' };
const H: React.CSSProperties = { color: '#fff', fontSize: 15, fontWeight: 600, margin: '4px 0' };
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.4 };

export const SRCBBScreen: React.FC = () => {
  const [mode, setMode] = useState<Mode>('src');

  // ── СРЦ ──
  const [level, setLevel] = useState<string>('II-KMS');
  const [goal, setGoal] = useState<string>('strength');
  const [dir, setDir] = useState<string>('powerlifting');
  const [bw, setBw] = useState<number>(85);
  const [days, setDays] = useState<number>(3);
  const [pmSquat, setPmSquat] = useState<number>(120);
  const [pmBench, setPmBench] = useState<number>(100);
  const [pmDead, setPmDead] = useState<number>(140);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('cycle-01');
  const [builtSrc, setBuiltSrc] = useState<LMSBuildOutput | null>(null);
  const [srcWeek, setSrcWeek] = useState<number>(1);

  const ranked = useMemo(() => rankCycles({ goal: goal as any, level: level as any, bodyWeight: bw, daysPerWeek: days, direction: dir as any, mode: 'natural' }), [goal, level, bw, days, dir]);
  const best = ranked[0];

  const buildSrc = () => {
    const tpl = getCycleById(selectedCycleId);
    if (!tpl) return;
    const plan = buildLMSPlan({ template: tpl, pmMap: { 'Присед': pmSquat, 'Жим лежа': pmBench, 'Становая тяга': pmDead }, fallbackPm: 80, mode: 'natural' });
    setBuiltSrc(plan); setSrcWeek(1);
  };

  // ── BB ──
  const [bbLevel, setBbLevel] = useState<string>('intermediate');
  const [bbGoal, setBbGoal] = useState<string>('mass');
  const [bbDays, setBbDays] = useState<number>(4);
  const [bbWeeks, setBbWeeks] = useState<number>(4);
  const [peds, setPeds] = useState<PED[]>([]);
  const [builtBb, setBuiltBb] = useState<BBPlan | null>(null);

  const bbRanked = useMemo(() => rankBBSplits({ level: bbLevel, goal: bbGoal as any, daysPerWeek: bbDays }), [bbLevel, bbGoal, bbDays]);
  const bbBest = bbRanked[0];

  const buildBb = () => {
    if (!bbBest) return;
    const plan = buildBBPlan({ patternId: bbBest.pattern.id, level: bbLevel, goal: bbGoal as any, weeks: bbWeeks, workMax: { chest: 100, back: 110, quads: 140, hamstrings: 90, shoulders: 60, biceps: 50, triceps: 60, glutes: 160, calves: 120, abs: 60 } });
    setBuiltBb(plan);
  };
  const baseMrv = useMemo(() => Object.fromEntries(Object.entries(getAllVolumeLandmarks(bbLevel)).map(([k, v]) => [k, v.mrv])), [bbLevel]);
  const pedAdapt = useMemo(() => adaptForPEDs(peds, baseMrv), [peds, baseMrv]);

  const togglePed = (p: PED) => setPeds(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  // ── INT: sub-tabs План/Блины/Выполнение + нормализаторы плана для execution-слоя ──
  const [view, setView] = useState<'plan' | 'plates' | 'run' | 'autoreg' | 'peak' | 'recovery' | 'safety' | 'demo' | 'charts'>('plan');

  const srcDays: PlayerDay[] = useMemo(() => {
    if (!builtSrc) return [];
    const wk = builtSrc.weeks[0];
    return wk.days.map((d, i) => ({
      label: `Д${i + 1}`,
      exercises: d.exercises.map(e => ({
        name: e.name, muscleGroup: e.group,
        targetSets: e.workSets.flatMap(ws => Array.from({ length: ws.sets }, () => ({ weight: ws.weight, reps: ws.reps, rir: 0 }))),
        pm: e.pm, coef: e.coef, mnosz: e.mnosz, group: e.group,
      })),
    }));
  }, [builtSrc]);

  const bbDaysArr: PlayerDay[] = useMemo(() => {
    if (!builtBb) return [];
    const wk = builtBb.weeks[0];
    return wk.sessions.map((sess, i) => ({
      label: `Д${i + 1} ${sess.character}`,
      exercises: sess.exercises.map(e => ({
        name: e.muscle, muscleGroup: e.muscle,
        targetSets: e.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, rir: ws.rir })),
      })),
    }));
  }, [builtBb]);

  const playerDays: PlayerDay[] = mode === 'src' ? srcDays : bbDaysArr;
  const workingWeight = useMemo(() => {
    if (mode === 'src' && builtSrc) return builtSrc.weeks[0]?.days[0]?.exercises[0]?.workSets[0]?.weight || 100;
    if (mode === 'bb' && builtBb) return builtBb.weeks[0]?.sessions[0]?.exercises[0]?.workSets[0]?.weight || 100;
    return 100;
  }, [mode, builtSrc, builtBb]);
  const runFocus = mode === 'src' ? (getCycleById(selectedCycleId)?.meta.title || 'СРЦ') : 'BB';
  const lmsChart: LMSWeekMetric[] = useMemo(() => {
    if (!builtSrc) return [];
    return builtSrc.weeks.map(wk => {
      const t = wk.days.reduce((s, d) => s + d.metrics.tonnage, 0);
      const k = wk.days.reduce((s, d) => s + d.metrics.kpsh, 0);
      const uoi = k > 0 ? wk.days.reduce((s, d) => s + d.metrics.uoi * d.metrics.kpsh, 0) / k : 0;
      const relInt = k > 0 ? wk.days.reduce((s, d) => s + d.metrics.relIntensity * d.metrics.kpsh, 0) / k : 0;
      const intFB = k > 0 ? wk.days.reduce((s, d) => s + d.metrics.intFB * d.metrics.kpsh, 0) / k : 0;
      return { week: wk.week, tonnage: Math.round(t), kpsh: k, relInt: Math.round(relInt * 1000) / 1000, uoi: Math.round(uoi * 100) / 100, intFB: Math.round(intFB) };
    });
  }, [builtSrc]);
  const bbChart: BBMuscleMetric[] = useMemo(() => {
    if (!builtBb) return [];
    return calcBBPlanMetrics(builtBb).perMuscle.map(p => ({ muscle: p.muscle, sets: p.totalSets, тяж: p.тяжSets, памп: p.пампSets, mrv: p.mrv }));
  }, [builtBb]);

  return (
    <div style={{ padding: 12, color: '#fff', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button style={mode === 'src' ? BTN : BTN_GHOST} onClick={() => setMode('src')} disabled={mode === 'src'}>🏆 СРЦ (сила)</button>
        <button style={mode === 'bb' ? BTN : BTN_GHOST} onClick={() => setMode('bb')} disabled={mode === 'bb'}>💪 Бодибилдинг</button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {([['plan', '📋 План'], ['plates', '🧮 Блины'], ['run', '▶ Выполнение'], ['autoreg', '🧠 Авторег'], ['peak', '🏁 Пик'], ['recovery', '🔋 Восст'], ['safety', '🛡 Безоп'], ['demo', '🎬 Демо'], ['charts', '📊 График']] as const).map(([v, l]) => (
          <button key={v} style={view === v ? BTN : BTN_GHOST} onClick={() => setView(v)}>{l}</button>
        ))}
      </div>

      {mode === 'src' && view === 'plan' && (
        <div>
          <div style={H}>Авто-подбор силового цикла</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><div style={LABEL}>Уровень</div><select style={SEL} value={level} onChange={e => setLevel(e.target.value)}>
              {['novice','II-KMS','KMS-MS','MS-MSMK','II-MS','intermediate'].map(l => <option key={l} value={l}>{l}</option>)}
            </select></div>
            <div><div style={LABEL}>Цель</div><select style={SEL} value={goal} onChange={e => setGoal(e.target.value)}>
              {['strength','mass','endurance','peak','mixed'].map(g => <option key={g} value={g}>{g}</option>)}
            </select></div>
            <div><div style={LABEL}>Направление</div><select style={SEL} value={dir} onChange={e => setDir(e.target.value)}>
              {['powerlifting','bench','deadlift_bench','armwrestling','bodybuilding'].map(d => <option key={d} value={d}>{d}</option>)}
            </select></div>
            <div><div style={LABEL}>Дней/нед</div><input style={IN} type="number" min={2} max={7} value={days} onChange={e => setDays(+e.target.value)} /></div>
            <div><div style={LABEL}>Вес тела, кг</div><input style={IN} type="number" value={bw} onChange={e => setBw(+e.target.value)} /></div>
          </div>
          {best && <div style={CARD}><div style={H}>🏆 Рекомендован: {best.cycle.meta.title}</div><div style={SMALL}>{explainSelection(best)}</div></div>}
          <div style={H}>Каталог ({LMS_CYCLES.length})</div>
          <select style={SEL} value={selectedCycleId} onChange={e => setSelectedCycleId(e.target.value)}>
            {LMS_CYCLES.map(c => <option key={c.meta.id} value={c.meta.id}>{c.meta.title} — {c.meta.direction}/{c.meta.period}/{c.meta.level}</option>)}
          </select>
          {(() => { const c = getCycleById(selectedCycleId); return c ? <div style={CARD}><div style={SMALL}><b>Как работает:</b> {c.meta.howItWorks.slice(0, 280)}…</div>{c.meta.conditions.length > 0 && <div style={{ ...SMALL, marginTop: 6 }}><b>Условия:</b> {c.meta.conditions.slice(0, 2).join(' ')}</div>}</div> : null; })()}
          <div style={H}>Предельные максимумы (PM), кг</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div><div style={LABEL}>Присед</div><input style={IN} type="number" value={pmSquat} onChange={e => setPmSquat(+e.target.value)} /></div>
            <div><div style={LABEL}>Жим лёжа</div><input style={IN} type="number" value={pmBench} onChange={e => setPmBench(+e.target.value)} /></div>
            <div><div style={LABEL}>Тяга</div><input style={IN} type="number" value={pmDead} onChange={e => setPmDead(+e.target.value)} /></div>
          </div>
          <button style={{ ...BTN, width: '100%', marginTop: 10 }} onClick={buildSrc}>Сгенерировать план (12 нед)</button>
          {builtSrc && (() => {
            const W = builtSrc.weeks;
            const wk = W[Math.min(srcWeek, W.length) - 1] || W[0];
            const totalW = W.length;
            const phase = mesocyclePhaseForWeek(wk.week, totalW);
            const PH_RU: Record<string,string> = { base: 'База (накопление)', build: 'Накопление (рост объёма)', peak: 'Пик (интенсификация)', deload: 'Разгрузка' };
            const PH_COLOR: Record<string,string> = { base: '#22c55e', build: '#eab308', peak: '#ef4444', deload: '#60a5fa' };
            const PH_DESC: Record<string,string> = {
              base: 'Фаза базы: акклиматизация, наращивание объёма при контроле техники. RIR 2-3, вес = PM_нед × %ПМ.',
              build: 'Фаза накопления: пик объёма (MAV), прогрессия весов, RIR 1-2. КПШ и тоннаж максимальны.',
              peak: 'Пиковая фаза: интенсификация — %ПМ растёт, объём снижается, RIR 0-1. Готовность к тесту/соревнованию.',
              deload: 'Разгрузка: 50-60% объёма, RIR 4, восстановление перед следующим мезоциклом.',
            };
            const setStr = (s: { sets: number; reps: number; weight: number; pct: number }) => s.sets + 'x' + s.reps + 'x' + s.weight + 'кг (' + Math.round(s.pct*100) + '%)';
            return <div style={CARD}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                <div style={{ ...H, margin:0 }}>План: {builtSrc.template.meta.title}</div>
                <span style={{ fontSize:10, fontWeight:700, color: PH_COLOR[phase], background: PH_COLOR[phase]+'22', padding:'3px 8px', borderRadius:10 }}>{PH_RU[phase]}</span>
              </div>
              <div style={{ ...SMALL, marginTop:4 }}>{builtSrc.progressionRationale}</div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, marginTop:10, padding:'6px 8px', borderRadius:10, background:'rgba(255,255,255,0.03)' }}>
                <button onClick={() => setSrcWeek(w => Math.max(1, w-1))} disabled={srcWeek<=1} style={{ ...BTN_GHOST, padding:'6px 12px', minHeight:36, opacity: srcWeek<=1?0.4:1 }}>◀</button>
                <div style={{ textAlign:'center' }}><div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>Неделя {wk.week} / {totalW}</div><div style={{ fontSize:9, color:PH_COLOR[phase] }}>{PH_RU[phase]}</div></div>
                <button onClick={() => setSrcWeek(w => Math.min(totalW, w+1))} disabled={srcWeek>=totalW} style={{ ...BTN_GHOST, padding:'6px 12px', minHeight:36, opacity: srcWeek>=totalW?0.4:1 }}>▶</button>
              </div>
              <div style={{ display:'flex', gap:1, marginTop:6, height:8 }}>
                {W.map(w => { const ph = mesocyclePhaseForWeek(w.week, totalW); return <button key={w.week} onClick={() => setSrcWeek(w.week)} title={'Неделя '+w.week+': '+PH_RU[ph]} style={{ flex:1, border:'none', cursor:'pointer', borderRadius:2, background: w.week===wk.week ? PH_COLOR[ph] : PH_COLOR[ph]+'66', opacity: w.week===wk.week?1:0.6 }} />; })}
              </div>
              <div style={{ ...SMALL, marginTop:6, color:'rgba(255,255,255,0.7)' }}>{PH_DESC[phase]}</div>
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.15)' }}>
                <div style={{ ...LABEL, color: ACCENT, margin:0 }}>ПМ на неделю {wk.week} (прогрессия)</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:4 }}>{Object.entries(wk.pmRow).map(([n, pm]) => <span key={n} style={{ ...SMALL, color:'#fff' }}><b>{n}:</b> {pm.toFixed(1)}кг</span>)}</div>
              </div>
              {wk.days.map((d, di) => (
                <div key={di} style={{ marginTop:10, padding:10, borderRadius:10, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, gap:6 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>День {di+1}{d.exercises[0]?.load ? ' · '+d.exercises[0].load : ''}</span>
                    <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)', textAlign:'right' }}>тоннаж {d.metrics.tonnage.toFixed(0)} · КПШ {d.metrics.kpsh} · Инт.отн {d.metrics.relIntensity.toFixed(3)} · УОИ {d.metrics.uoi.toFixed(2)}</span>
                  </div>
                  {d.exercises.map((e, ei) => (
                    <div key={ei} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:4, padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize:11, color:'#fff', fontWeight:600 }}>{e.name}</div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', textAlign:'right' }}>{e.workSets.map(setStr).join('  ·  ')}</div>
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ marginTop:10, padding:10, borderRadius:10, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.15)' }}>
                <div style={{ ...LABEL, color: ACCENT, margin:'0 0 6px' }}>📊 Итоги мезоцикла ({totalW} нед)</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                  <div style={SMALL}>Тоннаж: <b style={{color:'#fff'}}>{builtSrc.cycleMetrics.tonnage.toFixed(0)}</b> кг·пов</div>
                  <div style={SMALL}>КПШ: <b style={{color:'#fff'}}>{builtSrc.cycleMetrics.kpsh}</b></div>
                  <div style={SMALL}>Инт.отн: <b style={{color:'#fff'}}>{builtSrc.cycleMetrics.relIntensity.toFixed(3)}</b></div>
                  <div style={SMALL}>УОИ: <b style={{color:'#fff'}}>{builtSrc.cycleMetrics.uoi.toFixed(3)}</b></div>
                </div>
              </div>
              <div style={{ marginTop:8, padding:10, borderRadius:10, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
                <div style={{ ...LABEL, color:'#60a5fa', margin:'0 0 4px' }}>➡️ Что дальше</div>
                <div style={SMALL}>{phase === 'peak'
                  ? 'Цикл завершается пиковой фазой. После теста ПМ — неделя разгрузки (deload: 60% объёма, RIR 4), затем новый мезоцикл с пересчитанным PM0 (новый PM = результат теста). Система пересчитает прогрессию автоматически при вводе нового PM.'
                  : phase === 'deload'
                  ? 'Разгрузка — восстановление перед следующим мезо. После неё начните новый цикл: PM0 = текущий расчётный PM (он вырос за мезо по формуле PM0×(1+k)^нед).'
                  : 'Система считает дальнейшие недели сама: вес = PM_нед × %ПМ, где PM_нед = PM0×(1+k)^нед (k=0.5% натурал / 1.5-2.5% на курсе). Переходите по неделям ◀▶ — фазы Base→Build→Peak чередуются автоматически.'}</div>
              </div>
            </div>;
          })()}
        </div>
      )}

      {mode === 'bb' && view === 'plan' && (
        <div>
          <div style={H}>Авто-подбор бодибилдинг-сплита</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div><div style={LABEL}>Уровень</div><select style={SEL} value={bbLevel} onChange={e => setBbLevel(e.target.value)}>
              {['beginner','intermediate','advanced','enhanced'].map(l => <option key={l} value={l}>{l}</option>)}
            </select></div>
            <div><div style={LABEL}>Цель</div><select style={SEL} value={bbGoal} onChange={e => setBbGoal(e.target.value)}>
              {['mass','cut','recomp','maintenance','strength_mass'].map(g => <option key={g} value={g}>{g}</option>)}
            </select></div>
            <div><div style={LABEL}>Дней/нед</div><input style={IN} type="number" min={3} max={6} value={bbDays} onChange={e => setBbDays(+e.target.value)} /></div>
            <div><div style={LABEL}>Недель мезо</div><input style={IN} type="number" min={4} max={12} value={bbWeeks} onChange={e => setBbWeeks(+e.target.value)} /></div>
          </div>
          {bbBest && <div style={CARD}><div style={H}>Рекомендован: {bbBest.pattern.name}</div><div style={SMALL}>{explainBBSelection(bbBest)}</div></div>}
          <div style={H}>Фармакология (PED-адаптация)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(['AAS','insulin','MGF','IGF1','GH'] as PED[]).map(p => <button key={p} style={peds.includes(p) ? BTN : BTN_GHOST} onClick={() => togglePed(p)}>{p}{peds.includes(p) ? ' ✓' : ''}</button>)}
          </div>
          {peds.length > 0 && <div style={CARD}><div style={SMALL}>{explainPEDAdaptation(pedAdapt)}</div></div>}
          <button style={{ ...BTN, width: '100%', marginTop: 10 }} onClick={buildBb}>Сгенерировать BB-план ({bbWeeks} нед)</button>
          {builtBb && <div style={CARD}>
            <div style={H}>План: {builtBb.pattern.name}</div>
            {builtBb.rationale.map((r, i) => <div key={i} style={SMALL}>{r}</div>)}
            {builtBb.weeks[0].sessions.map((s, si) => <div key={si} style={{ ...SMALL, marginTop: 6 }}><b>Д{si + 1} {s.character} {s.sessionTag}:</b> {s.exercises.map(e => `${e.muscle}(${e.character},${e.sets}×${e.workSets[0].reps}@RIR${e.rir},${e.workSets[0].weight}кг)`).join(', ')}</div>)}
            <div style={{ ...SMALL, marginTop: 8 }}>{explainBBMetrics(calcBBPlanMetrics(builtBb))}</div>
          </div>}
        </div>
      )}

      {view === 'plates' && <PlateCalculator initialWeight={workingWeight} />}
      {view === 'run' && playerDays.length > 0 && <SessionPlayer days={playerDays} weekNumber={1} focus={runFocus} />}
      {view === 'run' && playerDays.length === 0 && <div style={SMALL}>Сначала сгенерируйте план во вкладке «План».</div>}
      {view === 'autoreg' && <AutoregPanel />}
      {view === 'peak' && <PeakingPanel />}
      {view === 'recovery' && <RecoveryPanel />}
      {view === 'safety' && <ExerciseSafetyPanel />}
      {view === 'demo' && <ExerciseDemoPanel />}
      {view === 'charts' && <TrainingMetricsChart lms={lmsChart} bb={bbChart} />}
    </div>
  );
};

export default SRCBBScreen;

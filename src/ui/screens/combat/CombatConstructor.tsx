/**
 * CombatConstructor.tsx — изолированный конструктор для единоборств.
 * Полностью отделён от ББ/ПЛ. Только силовая часть зала.
 */
import React, { useState, useMemo } from 'react';
import { buildCombatPlan } from '../../../engines/combat/combat-builder.engine';
import { finalizeCombatPlan, buildCombatReport } from '../../../engines/combat/combat-finalize.engine';
import { COMBAT_PATTERNS, recommendCombatPattern } from '../../../engines/combat/combat-split-patterns';
import { computeOutsideMetrics, defaultOutsideLoadFor, type OutsideLoad } from '../../../engines/outside-load.engine';
import { saveCombatPlan, loadCombatPlans } from '../../../engines/combat/combat-storage';
import { applyCombatMesocycle } from '../../../engines/combat/combat-mesocycle';
import { buildAnnualFromCB, saveAnnualCB, loadAnnualCB } from '../../../engines/combat/combat-annual';
import type { CombatInput, CombatPlan } from '../../../engines/combat/combat.types';
import { getCombat } from '../../../engines/combat/combat-volume';

type Step = 'params' | 'outside' | 'split' | 'plan';

export const CombatConstructor: React.FC = () => {
  const [step, setStep] = useState<Step>('params');
  const [discipline, setDiscipline] = useState<CombatInput['discipline']>('mma');
  const [goal, setGoal] = useState<CombatInput['goal']>('power');
  const [level, setLevel] = useState<CombatInput['level']>('intermediate');
  const [weeks, setWeeks] = useState(6);
  const [days, setDays] = useState(3);
  const [weightCut, setWeightCut] = useState(0);
  const [methodology, setMethodology] = useState<CombatInput['methodology']>('compound_first');
  const [dupMode, setDupMode] = useState<CombatInput['dupMode']>('off');
  const [intensityTech, setIntensityTech] = useState<CombatInput['intensityTech']>('none');
  const [outside, setOutside] = useState<OutsideLoad | null>(defaultOutsideLoadFor('mma'));
  const [outsideEnabled, setOutsideEnabled] = useState(true);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [mobility, setMobility] = useState<string[]>([]);
  const [injuries, setInjuries] = useState<any[]>([]);
  const [injInput, setInjInput] = useState('');
  const [plan, setPlan] = useState<CombatPlan | null>(null);
  const [annual, setAnnual] = useState(() => loadAnnualCB());
  const [diaryLoad, setDiaryLoad] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('he_srpe_sessions') || localStorage.getItem('he_training_log') || '[]';
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) {
        const week = arr.slice(-7).reduce((a:any, s:any)=> a + (s.load || s.sRPE || s.rpe || 0), 0);
        setDiaryLoad(week);
      }
    } catch {}
  }, [plan]);

  const outsideMetrics = useMemo(() => computeOutsideMetrics(outsideEnabled ? outside : null), [outside, outsideEnabled]);

  const pullFromProfile = () => {
    try {
      const raw = localStorage.getItem('he_profile_v2');
      if (!raw) return;
      const p = JSON.parse(raw);
      const training = p.training || p;
      if (training.level) setLevel(training.level);
      if (Array.isArray(p.health?.injuries)) setInjuries(p.health.injuries);
      else if (Array.isArray(training.injuries)) setInjuries(training.injuries);
      if (Array.isArray(training.equipment)) setEquipment(training.equipment);
      if (Array.isArray(training.mobilityRestrictions)) setMobility(training.mobilityRestrictions);
      else if (Array.isArray(p.health?.mobilityRestrictions)) setMobility(p.health.mobilityRestrictions);
    } catch {}
  };
  const build = () => {
    let input: CombatInput = {
      discipline, goal, level, weeks, daysPerWeek: days,
      weightCutKg: weightCut, methodology, dupMode, intensityTech,
      outsideLoad: outsideEnabled ? outside : null,
      equipment, injuries, mobilityRestrictions: mobility as any,
    };
    try { const prev = loadCombatPlans()[0]; if (prev) input = applyCombatMesocycle(prev, input) as any; } catch {}
    let p = buildCombatPlan(input);
    p = finalizeCombatPlan(p);
    setPlan(p);
    saveCombatPlan(p);
    try { const hist = loadCombatPlans().slice(0,6); const ann = buildAnnualFromCB(hist); saveAnnualCB(ann); setAnnual(ann); } catch {}
    setMsg('План сохранён');
    setStep('plan');
  };

  const updateEx = (wkIdx: number, day: number, exId: string, patch: Partial<{ weight: number; reps: string; rir: number }>) => {
    setPlan(prev => {
      if (!prev) return prev;
      const copy: CombatPlan = JSON.parse(JSON.stringify(prev));
      const wk = copy.weeksData[wkIdx];
      if (!wk) return prev;
      const sess = wk.sessions.find(s => s.day === day);
      if (!sess) return prev;
      const ex = sess.exercises.find(e => e.id === exId);
      if (!ex) return prev;
      if (patch.weight != null) { if (patch.weight<0||patch.weight>500) { setMsg('Вес 0-500'); return prev; } ex.weight = patch.weight; ex.workSets = ex.workSets.map(s=> ({...s, weight: patch.weight! })); }
      if (patch.reps != null) { ex.reps = patch.reps; const [a,b]= patch.reps.split('-').map(n=> parseInt(n,10)); const avg = Math.round(((a||5)+(b||a||5))/2); ex.workSets = ex.workSets.map(s=> ({...s, reps: avg })); }
      if (patch.rir != null) { if (patch.rir<0||patch.rir>5) { setMsg('RIR 0-5'); return prev; } ex.rir = patch.rir; ex.workSets = ex.workSets.map(s=> ({...s, rir: patch.rir! })); }
      saveCombatPlan(copy);
      return copy;
    });
  };
  const moveEx = (wkIdx: number, day: number, exId: string, dir: -1|1) => {
    setPlan(prev => {
      if (!prev) return prev;
      const copy: CombatPlan = JSON.parse(JSON.stringify(prev));
      const sess = copy.weeksData[wkIdx]?.sessions.find(s=> s.day===day);
      if (!sess) return prev;
      const idx = sess.exercises.findIndex(e=> e.id===exId);
      if (idx<0) return prev;
      const nIdx = idx + dir;
      if (nIdx<0||nIdx>=sess.exercises.length) return prev;
      const tmp = sess.exercises[idx];
      sess.exercises[idx]=sess.exercises[nIdx];
      sess.exercises[nIdx]=tmp;
      saveCombatPlan(copy);
      return copy;
    });
  };
  const exportToUserProgram = () => {
    if (!plan) return;
    const prog = { id: plan.id, name: `Единоборства ${plan.discipline} ${plan.weeks}нед`, weeks: plan.weeksData.map(w=> ({ week: w.week, phase: w.phase, sessions: w.sessions.map(s=> ({ day: s.day, tag: s.sessionTag, exercises: s.exercises.map(e=> ({ name: e.name, sets: e.sets, reps: e.reps, weight: e.weight, rir: e.rir })) })) })), meta: { source: 'combat', discipline: plan.discipline } };
    try { localStorage.setItem('he_last_combat_program', JSON.stringify(prog)); setMsg('Экспортировано в he_last_combat_program'); } catch {}
    try { navigator.clipboard?.writeText(JSON.stringify(prog,null,2)); } catch {}
  };

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0, color: '#fff' }}>Единоборства — силовая часть</h2>
      <div style={{ fontSize: 11, color: '#fff', opacity: 0.7 }}>Бокс / ММА / Борьба / Кик. Внешняя нагрузка (ринг/татами) учитывается как фон — зала 2-3×/нед.</div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['params','outside','split','plan'] as Step[]).map(s => (
          <button key={s} onClick={() => setStep(s)} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: step===s ? '#a855f7' : 'rgba(255,255,255,0.06)', color: step===s ? '#fff' : '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>{s}</button>
        ))}
      </div>

      {step === 'params' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 10 }}>
          <label style={{ color: '#fff', fontSize: 12 }}>Дисциплина</label>
          <select value={discipline} onChange={e => setDiscipline(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="boxing">Бокс</option>
            <option value="mma">ММА</option>
            <option value="wrestling">Борьба</option>
            <option value="kickboxing">Кикбоксинг</option>
            <option value="general">Общая</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Цель зала</label>
          <select value={goal} onChange={e => setGoal(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="power">Взрывная сила</option>
            <option value="endurance">Силовая выносливость</option>
            <option value="maintenance">Поддержание</option>
            <option value="camp">Кэмп к бою</option>
            <option value="weight_cut">Весогонка</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Уровень</label>
          <select value={level} onChange={e => setLevel(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="beginner">Новичок</option>
            <option value="intermediate">Средний</option>
            <option value="advanced">Продвинутый</option>
            <option value="enhanced">Enhanced</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Недель: {weeks}</label>
          <input type="range" min={2} max={12} value={weeks} onChange={e => setWeeks(Number(e.target.value))} />
          <label style={{ color: '#fff', fontSize: 12 }}>Дней/нед в зале: {days}</label>
          <input type="range" min={2} max={4} value={days} onChange={e => setDays(Number(e.target.value))} />
          <label style={{ color: '#fff', fontSize: 12 }}>Методика порядка</label>
          <select value={methodology} onChange={e => setMethodology(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="compound_first">База первой</option>
            <option value="pre_exhaust">Предутомление</option>
            <option value="post_exhaust">Постутомление</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>DUP волны</label>
          <select value={dupMode} onChange={e => setDupMode(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="off">Выкл</option>
            <option value="power_endurance">Сила/выносливость</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Интенс-техника</label>
          <select value={intensityTech} onChange={e => setIntensityTech(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="none">Нет</option>
            <option value="rest_pause">Rest-pause</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Весогонка кг (0 = нет): {weightCut}</label>
          <input type="range" min={0} max={8} step={0.5} value={weightCut} onChange={e => setWeightCut(Number(e.target.value))} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 6, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
            <label style={{ color: '#fff', fontSize: 11 }}>Оборудование</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['barbell','dumbbell','machine','cable','other'].map(eq => (
                <label key={eq} style={{ color: '#fff', fontSize: 11, display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input type="checkbox" checked={equipment.includes(eq)} onChange={e => setEquipment(s => e.target.checked ? [...s, eq] : s.filter(x=>x!==eq))} /> {eq}
                </label>
              ))}
            </div>
            <label style={{ color: '#fff', fontSize: 11 }}>Щадящие травмы (neck/knee/shoulder/wrist)</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <input value={injInput} onChange={e=> setInjInput(e.target.value)} placeholder="neck, wrist" style={{ flex: 1, padding: 4, borderRadius: 6, fontSize: 11 }} />
              <button onClick={() => { const parts = injInput.split(',').map(s=> s.trim()).filter(Boolean); setInjuries(parts.map(p=> ({ location: p, type: 'joint' }))); }} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, background: '#a855f7', color: '#fff', cursor: 'pointer' }}>Применить</button>
            </div>
            {injuries.length>0 && <div style={{ fontSize: 10, color: '#f59e0b' }}>Щадящий: {injuries.map((j:any)=> j.location).join(', ')}</div>}
            <label style={{ color: '#fff', fontSize: 11 }}>Мобильность (ограничения)</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['shoulder','hip','knee','ankle','wrist','neck','lower_back'].map(m => (
                <label key={m} style={{ color: '#fff', fontSize: 10, display: 'flex', gap: 3, alignItems: 'center' }}>
                  <input type="checkbox" checked={mobility.includes(m)} onChange={e => setMobility(s => e.target.checked ? [...s, m] : s.filter(x=> x!==m))} /> {m}
                </label>
              ))}
            </div>
          </div>
          <button onClick={pullFromProfile} style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, cursor: 'pointer' }}>Подтянуть из профиля</button>
          <button onClick={() => setStep('outside')} style={{ padding: '8px 12px', borderRadius: 8, background: '#a855f7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Далее → Вне зала</button>
        </div>
      )}

      {step === 'outside' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 10 }}>
          <label style={{ color: '#fff', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={outsideEnabled} onChange={e => setOutsideEnabled(e.target.checked)} /> Учитывать вне зала (ринг/татами)
          </label>
          {outsideEnabled && outside && (
            <>
              <label style={{ color: '#fff', fontSize: 11 }}>Сессий/нед вне зала: {outside.sessionsPerWeek}</label>
              <input type="range" min={0} max={6} value={outside.sessionsPerWeek} onChange={e => setOutside(o => o ? { ...o, sessionsPerWeek: Number(e.target.value) } : o)} />
              <label style={{ color: '#fff', fontSize: 11 }}>Длительность мин: {outside.avgDurationMin}</label>
              <input type="range" min={30} max={180} step={10} value={outside.avgDurationMin} onChange={e => setOutside(o => o ? { ...o, avgDurationMin: Number(e.target.value) } : o)} />
              <label style={{ color: '#fff', fontSize: 11 }}>RPE: {outside.avgSRPE}</label>
              <input type="range" min={1} max={10} value={outside.avgSRPE} onChange={e => setOutside(o => o ? { ...o, avgSRPE: Number(e.target.value) } : o)} />
              <div style={{ fontSize: 11, color: '#a855f7' }}>{outsideMetrics ? `${outsideMetrics.weeklyLoad} load → объём ×${outsideMetrics.volumeMultiplier} (${outsideMetrics.interference})` : ''}</div>
              <div style={{ fontSize: 10, color: '#fff', opacity: 0.6 }}>Тяж ноги не ставим за день до высокой внезальной автоматически.</div>
            </>
          )}
          <button onClick={() => setStep('split')} style={{ padding: '8px 12px', borderRadius: 8, background: '#a855f7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Далее → Сплит</button>
        </div>
      )}

      {step === 'split' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 10 }}>
          <div style={{ color: '#fff', fontSize: 12 }}>Рекомендуемый: {recommendCombatPattern(days, outside?.sessionsPerWeek || 0, level).name}</div>
          {COMBAT_PATTERNS.map(p => (
            <div key={p.id} style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 11 }}>
              <b>{p.name}</b> — {p.sessionsPerRotation}×/нед · {p.description}
            </div>
          ))}
          <button onClick={build} style={{ padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg,#a855f7,#7c3aed)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Собрать план</button>
        </div>
      )}

      {step === 'plan' && plan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ background: 'rgba(168,85,247,0.12)', padding: 10, borderRadius: 10, color: '#fff', fontSize: 11, whiteSpace: 'pre-wrap' }}>{buildCombatReport(plan)}</div>
          {plan.validation?.warnings.map((w,i) => <div key={i} style={{ color: '#f59e0b', fontSize: 11 }}>⚠ {w}</div>)}
          <div style={{ background: 'rgba(255,255,255,0.04)', padding: 8, borderRadius: 8 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 11, marginBottom: 4 }}>Quality heatmap (сеты/нед vs MEV/MRV):</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {plan.weeksData.map(wk => {
                const neck = wk.sessions.reduce((s, sess)=> s + sess.exercises.filter(e=> e.id.includes('neck')).reduce((a,e)=> a+e.sets,0),0);
                const lm = getCombat(plan.level,'neck'); const st = lm ? (neck<lm.mev?'below': neck<=lm.mav?'optimal': neck<=lm.mrv?'high':'over') : 'optimal';
                const col = st==='below'?'#f59e0b': st==='optimal'?'#a855f7': st==='high'?'#eab308':'#ef4444';
                return <span key={wk.week} style={{ padding: '2px 6px', borderRadius: 6, background: col+'22', border: `1px solid ${col}`, color: col, fontSize: 10 }}>Н{wk.week}: шея {neck}</span>;
              })}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {plan.weeksData.map(wk => {
                const grip = wk.sessions.reduce((s, sess)=> s + sess.exercises.filter(e=> e.id.includes('grip')||e.id.includes('pinch')||e.id.includes('wrist')).reduce((a,e)=> a+e.sets,0),0);
                const lm = getCombat(plan.level,'grip'); const st = lm ? (grip<lm.mev?'below': grip<=lm.mav?'optimal': grip<=lm.mrv?'high':'over') : 'optimal';
                const col = st==='below'?'#f59e0b': st==='optimal'?'#a855f7': st==='high'?'#eab308':'#ef4444';
                return <span key={wk.week} style={{ padding: '2px 6px', borderRadius: 6, background: col+'22', border: `1px solid ${col}`, color: col, fontSize: 10 }}>Н{wk.week}: хват {grip}</span>;
              })}
            </div>
          </div>
          {diaryLoad != null && (
            <div style={{ background: diaryLoad > 30 ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)', padding: 6, borderRadius: 6, border: `1px solid ${diaryLoad > 30 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`, color: diaryLoad > 30 ? '#f59e0b' : '#fff', fontSize: 10 }}>
              Дневник (изолированно): нагрузка 7д ≈ {diaryLoad}{diaryLoad > 30 ? ' — высоко, рассмотрите лёгкую неделю' : ' — норма'}
            </div>
          )}
          {plan.weeksData.map(wk => (
            <div key={wk.week} style={{ background: 'rgba(255,255,255,0.04)', padding: 8, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#a855f7', fontWeight: 700, fontSize: 12 }}>Неделя {wk.week} · {wk.phase}{wk.deload ? ' · делод' : ''} · {wk.totalSets} сетов</span>
                <button onClick={() => {
                  const txt = wk.sessions.map(s=> `${s.sessionTag} (${s.character}) д${s.day}:\n` + s.exercises.map(e=> `  ${e.name} ${e.sets}x${e.reps} ${e.weight?e.weight+'кг':''} RIR${e.rir} ${e.tempo} отдых${e.restSeconds}с${e.comment? ' // '+e.comment:''}`).join('\n')).join('\n\n');
                  navigator.clipboard?.writeText(`Неделя ${wk.week} ${wk.phase}\n`+txt); setMsg(`Неделя ${wk.week} скопирована`);
                }} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>Копировать неделю</button>
              </div>
              {wk.sessions.map(sess => (
                <div key={sess.day} style={{ marginTop: 6, padding: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{sess.sessionTag} · {sess.character} · день {sess.day} · {sess.durationMin} мин</span>
                    <span style={{ color: '#fff', fontSize: 10, opacity: 0.5 }}>⏱ {sess.exercises.reduce((a,e)=>a+ e.workSets.length* (e.restSeconds||75),0)/60 |0} мин отдыха</span>
                  </div>
                  {sess.exercises.map(ex => (
                    <div key={ex.id} style={{ color: '#fff', fontSize: 11, marginLeft: 6, marginTop: 4, padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: 4 }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span>{ex.name} — {ex.sets}×{ex.reps}{ex.weight ? ` @ ${ex.weight}кг` : ''} RIR{ex.rir} · {ex.tempo} · отдых {ex.restSeconds}с</span>
                        <input aria-label="вес" type="number" value={ex.weight} onChange={e=> updateEx(wk.week-1, sess.day, ex.id, { weight: Number(e.target.value)||0 })} style={{ width: 58, padding: '2px 4px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }} />
                        <input aria-label="повторы" type="text" value={ex.reps} onChange={e=> updateEx(wk.week-1, sess.day, ex.id, { reps: e.target.value })} style={{ width: 54, padding: '2px 4px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }} />
                        <input aria-label="RIR" type="number" min={0} max={5} value={ex.rir} onChange={e=> updateEx(wk.week-1, sess.day, ex.id, { rir: Number(e.target.value)||0 })} style={{ width: 44, padding: '2px 4px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }} />
                        <button aria-label="вверх" onClick={()=> moveEx(wk.week-1, sess.day, ex.id, -1)} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>↑</button>
                        <button aria-label="вниз" onClick={()=> moveEx(wk.week-1, sess.day, ex.id, 1)} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>↓</button>
                      </div>
                      {ex.comment && <div style={{ fontSize: 10, opacity: 0.7, marginLeft: 4, borderLeft: '2px solid rgba(168,85,247,0.3)', paddingLeft: 6 }}>{ex.comment}</div>}
                      {ex.warmupSets && ex.warmupSets.length>0 && <div style={{ fontSize: 10, opacity: 0.5 }}>Разминка: {ex.warmupSets.map(s=> `${s.reps}×${s.weight}кг`).join(' → ')} → рабочие</div>}
                      <div style={{ fontSize: 10, opacity: 0.45 }}>Сеты: {ex.workSets.map(s=> `${s.reps}×${s.weight? s.weight+'кг' : '—'} RIR${s.rir}`).join(' | ')}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
          {annual && (
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 11 }}>Годовой план (изолирован): {annual.totalWeeks} нед · {annual.blocks.length} блоков</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {annual.blocks.map(b => <span key={b.id} style={{ padding: '2px 6px', borderRadius: 6, background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7', fontSize: 10 }}>Нед {b.startWeek}-{b.startWeek+b.weeks-1}: {b.discipline} ×{b.weeks}</span>)}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => { const txt = buildCombatReport(plan); navigator.clipboard?.writeText(txt); setMsg('Скопировано'); }} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer' }}>Копировать отчёт</button>
            <button onClick={() => { const txt = buildCombatReport(plan); const w = window.open('', '_blank'); if (w) { w.document.write(`<pre style="font-family:monospace;white-space:pre-wrap">${txt.replace(/</g,'&lt;')}</pre>`); w.document.close(); w.print(); } }} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer' }}>Печать</button>
            <button onClick={exportToUserProgram} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)', cursor: 'pointer' }}>Экспорт в программу</button>
          </div>
          {msg && <div style={{ color: '#a855f7', fontSize: 11 }}>{msg}</div>}
        </div>
      )}
    </div>
  );
};

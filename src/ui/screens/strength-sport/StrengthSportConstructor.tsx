/**
 * StrengthSportConstructor.tsx — изолированный конструктор Силовой экстрим / ТА.
 * Полностью отделён от ББ/ПЛ: не импортирует их движки, каталоги, типы.
 * Только силовая часть зала. Внешняя нагрузка (поле) — декларация.
 */
import React, { useState, useMemo } from 'react';
import { buildStrengthSportPlan } from '../../../engines/strength-sport/strength-sport-builder.engine';
import { finalizeStrengthSportPlan, buildStrengthSportReport } from '../../../engines/strength-sport/strength-sport-finalize.engine';
import { STRENGTH_SPORT_PATTERNS, recommendStrengthSportPattern } from '../../../engines/strength-sport/strength-sport-split-patterns';
import { computeOutsideMetrics, defaultOutsideLoadFor, type OutsideLoad } from '../../../engines/outside-load.engine';
import { saveStrengthSportPlan, loadStrengthSportPlans } from '../../../engines/strength-sport/strength-sport-storage';
import { applyMesocycleProgression } from '../../../engines/strength-sport/strength-sport-mesocycle';
import { buildAnnualFromSS, saveAnnualSS, loadAnnualSS } from '../../../engines/strength-sport/strength-sport-annual';
import { saveUserProgram } from '../../../engines/user-program/program-store';
import type { StrengthSportInput, StrengthSportPlan } from '../../../engines/strength-sport/strength-sport.types';
import { getWL, getStrong } from '../../../engines/strength-sport/strength-sport-volume';

type Step = 'params' | 'outside' | 'split' | 'plan';

export const StrengthSportConstructor: React.FC = () => {
  const [step, setStep] = useState<Step>('params');
  const [mode, setMode] = useState<StrengthSportInput['mode']>('weightlifting');
  const [goal, setGoal] = useState<StrengthSportInput['goal']>('strength');
  const [level, setLevel] = useState<StrengthSportInput['level']>('intermediate');
  const [weeks, setWeeks] = useState(8);
  const [days, setDays] = useState(3);
  const [focus, setFocus] = useState<StrengthSportInput['focus']>(null);
  const [methodology, setMethodology] = useState<StrengthSportInput['methodology']>('compound_first');
  const [dupMode, setDupMode] = useState<StrengthSportInput['dupMode']>('off');
  const [intensityTech, setIntensityTech] = useState<StrengthSportInput['intensityTech']>('none');
  const [workMax, setWorkMax] = useState<StrengthSportInput['workMax']>({ backSquat: 120, deadlift: 160, snatch: 70, cleanJerk: 90, overheadPress: 60 });
  const [equipment, setEquipment] = useState<string[]>([]);
  const [mobility, setMobility] = useState<string[]>([]);
  const [injuries, setInjuries] = useState<any[]>([]);
  const [injInput, setInjInput] = useState('');
  const [outside, setOutside] = useState<OutsideLoad | null>(defaultOutsideLoadFor('weightlifting'));
  const [outsideEnabled, setOutsideEnabled] = useState(false);
  const [plan, setPlan] = useState<StrengthSportPlan | null>(null);
  const [annual, setAnnual] = useState(() => loadAnnualSS());
  const [diaryLoad, setDiaryLoad] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const outsideMetrics = useMemo(() => computeOutsideMetrics(outsideEnabled ? outside : null), [outside, outsideEnabled]);

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

  const pullFromProfile = () => {
    try {
      const raw = localStorage.getItem('he_profile_v2');
      if (!raw) return;
      const p = JSON.parse(raw);
      const training = p.training || p;
      if (training.workMax) setWorkMax(s => ({ ...s, ...training.workMax }));
      if (training.level) setLevel(training.level);
      if (Array.isArray(p.health?.injuries)) setInjuries(p.health.injuries);
      else if (Array.isArray(training.injuries)) setInjuries(training.injuries);
      if (Array.isArray(training.equipment)) setEquipment(training.equipment);
      if (Array.isArray(training.mobilityRestrictions)) setMobility(training.mobilityRestrictions);
      else if (Array.isArray(p.health?.mobilityRestrictions)) setMobility(p.health.mobilityRestrictions);
      if (p.personal?.sex) { /* could set sex but input not exposed */ }
      // outside из профиля: спорт → дефолт внезальной
      const sport = (p.training?.sportType || p.goals?.primaryGoal || '').toLowerCase();
      if (sport.includes('weightlifting') || sport.includes('та')) setOutside(defaultOutsideLoadFor('weightlifting'));
      else if (sport.includes('strongman') || sport.includes('стронг')) setOutside(defaultOutsideLoadFor('strongman'));
    } catch {}
  };

  const build = () => {
    let input: StrengthSportInput = {
      mode, goal, level, weeks, daysPerWeek: days, workMax, focus, methodology, dupMode, intensityTech,
      outsideLoad: outsideEnabled ? outside : null,
      equipment, injuries, mobilityRestrictions: mobility as any,
    };
    try {
      const prev = loadStrengthSportPlans()[0];
      if (prev) input = applyMesocycleProgression(prev, input) as any;
    } catch {}
    let p = buildStrengthSportPlan(input);
    p = finalizeStrengthSportPlan(p, { outsideLoad: outsideEnabled ? outside : null });
    setPlan(p);
    saveStrengthSportPlan(p);
    try {
      const hist = loadStrengthSportPlans().slice(0, 6);
      const ann = buildAnnualFromSS(hist);
      saveAnnualSS(ann);
      setAnnual(ann);
    } catch {}
    setMsg('План сохранён');
    setStep('plan');
  };

  const updateEx = (wkIdx: number, day: number, exId: string, patch: Partial<{ weight: number; reps: string; rir: number }>) => {
    setPlan(prev => {
      if (!prev) return prev;
      const copy: StrengthSportPlan = JSON.parse(JSON.stringify(prev));
      const wk = copy.weeksData[wkIdx];
      if (!wk) return prev;
      const sess = wk.sessions.find(s => s.day === day);
      if (!sess) return prev;
      const ex = sess.exercises.find(e => e.id === exId);
      if (!ex) return prev;
      if (patch.weight != null) {
        if (patch.weight < 0 || patch.weight > 500) { setMsg('Вес вне диапазона 0-500'); return prev; }
        ex.weight = patch.weight;
        ex.workSets = ex.workSets.map(s => ({ ...s, weight: patch.weight! }));
      }
      if (patch.reps != null) {
        ex.reps = patch.reps;
        const [a,b] = patch.reps.split('-').map(n=> parseInt(n,10));
        const avg = Math.round(((a||5)+(b||a||5))/2);
        ex.workSets = ex.workSets.map(s => ({ ...s, reps: avg }));
      }
      if (patch.rir != null) {
        if (patch.rir < 0 || patch.rir > 5) { setMsg('RIR 0-5'); return prev; }
        ex.rir = patch.rir;
        ex.workSets = ex.workSets.map(s => ({ ...s, rir: patch.rir! }));
      }
      saveStrengthSportPlan(copy);
      return copy;
    });
  };

  const moveEx = (wkIdx: number, day: number, exId: string, dir: -1|1) => {
    setPlan(prev => {
      if (!prev) return prev;
      const copy: StrengthSportPlan = JSON.parse(JSON.stringify(prev));
      const sess = copy.weeksData[wkIdx]?.sessions.find(s=> s.day===day);
      if (!sess) return prev;
      const idx = sess.exercises.findIndex(e=> e.id===exId);
      if (idx<0) return prev;
      const nIdx = idx + dir;
      if (nIdx<0 || nIdx>=sess.exercises.length) return prev;
      const tmp = sess.exercises[idx];
      sess.exercises[idx]=sess.exercises[nIdx];
      sess.exercises[nIdx]=tmp;
      saveStrengthSportPlan(copy);
      return copy;
    });
  };
  const exportToUserProgram = () => {
    if (!plan) return;
    const prog: any = {
      id: plan.id,
      meta: { id: plan.id, title: `Стронг+ТА ${plan.mode} ${plan.weeks}нед`, direction: 'strength', createdAt: new Date().toISOString(), source: 'strength-sport', mode: plan.mode, level: plan.level, focus: plan.inputSnapshot?.focus, methodology: plan.inputSnapshot?.methodology, dupMode: (plan.inputSnapshot as any)?.dupMode, intensityTech: (plan.inputSnapshot as any)?.intensityTech },
      weeks: plan.weeksData.map(w=> ({ week: w.week, phase: w.phase, deload: w.deload, sessions: w.sessions.map(s=> ({ day: s.day, tag: s.sessionTag, character: s.character, exercises: s.exercises.map(e=> ({ id: e.id, name: e.name, sets: e.sets, reps: e.reps, weight: e.weight, rir: e.rir, tempo: e.tempo, restSeconds: e.restSeconds, technique: (e as any).technique, warmupSets: e.warmupSets, workSets: e.workSets })) })) })),
      outside: plan.outsideMetrics,
      validation: plan.validation,
    };
    try { saveUserProgram(prog); setMsg('Экспортировано в Библиотеку (he_user_programs) + he_last_strength_program'); } catch {}
    try { localStorage.setItem('he_last_strength_program', JSON.stringify(prog)); } catch {}
    try { navigator.clipboard?.writeText(JSON.stringify(prog, null, 2)); } catch {}
  };

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0, color: '#fff' }}>Силовой экстрим / Тяжёлая атлетика</h2>
      <div style={{ fontSize: 11, color: '#fff', opacity: 0.7 }}>Только силовая часть зала. Внешняя нагрузка учитывается как фон.</div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['params','outside','split','plan'] as Step[]).map(s => (
          <button key={s} onClick={() => setStep(s)} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: step===s ? '#00e68a' : 'rgba(255,255,255,0.06)', color: step===s ? '#000' : '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>{s}</button>
        ))}
      </div>

      {step === 'params' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 10 }}>
          <label style={{ color: '#fff', fontSize: 12 }}>Режим</label>
          <select value={mode} onChange={e => setMode(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="weightlifting">Тяжёлая атлетика</option>
            <option value="strongman">Силовой экстрим</option>
            <option value="hybrid">Гибрид</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Цель</label>
          <select value={goal} onChange={e => setGoal(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="strength">Сила</option>
            <option value="hypertrophy">Масса</option>
            <option value="technique">Техника</option>
            <option value="peaking">Пик</option>
            <option value="maintenance">Поддержание</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Уровень</label>
          <select value={level} onChange={e => setLevel(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="beginner">Новичок</option>
            <option value="intermediate">Средний</option>
            <option value="advanced">Продвинутый</option>
            <option value="enhanced">Enhanced</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Недель: {weeks}</label>
          <input type="range" min={2} max={16} value={weeks} onChange={e => setWeeks(Number(e.target.value))} />
          <label style={{ color: '#fff', fontSize: 12 }}>Дней/нед в зале: {days}</label>
          <input type="range" min={2} max={6} value={days} onChange={e => setDays(Number(e.target.value))} />
          <label style={{ color: '#fff', fontSize: 12 }}>Фокус зала (специализация)</label>
          <select value={focus || ''} onChange={e => setFocus((e.target.value || null) as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="">Без фокуса (баланс)</option>
            <option value="snatch">Рывок</option>
            <option value="clean">Толчок/взятие</option>
            <option value="squat">Присед</option>
            <option value="overhead">Жим/лог</option>
            <option value="carry">Переноски (фермер/йок)</option>
            <option value="stone">Камни</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Методика порядка</label>
          <select value={methodology} onChange={e => setMethodology(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="compound_first">База первой</option>
            <option value="pre_exhaust">Предутомление</option>
            <option value="post_exhaust">Постутомление</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>DUP волны</label>
          <select value={dupMode} onChange={e => setDupMode(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="off">Выкл</option>
            <option value="heavy_light">Тяж/лёг</option>
            <option value="wave">Волна</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Интенс-техника</label>
          <select value={intensityTech} onChange={e => setIntensityTech(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="none">Нет</option>
            <option value="cluster">Кластер (3×1)</option>
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {(['backSquat','frontSquat','deadlift','snatch','cleanJerk','overheadPress'] as const).map(k => (
              <label key={k} style={{ color: '#fff', fontSize: 11 }}>{k}: <input type="number" value={(workMax as any)[k] || 0} onChange={e => setWorkMax(s => ({ ...s, [k]: Number(e.target.value) }))} style={{ width: 70, padding: 4, borderRadius: 6 }} /></label>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 6, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
            <label style={{ color: '#fff', fontSize: 11 }}>Оборудование (пусто — всё доступно)</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['barbell','dumbbell','machine','cable','other'].map(eq => (
                <label key={eq} style={{ color: '#fff', fontSize: 11, display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input type="checkbox" checked={equipment.includes(eq)} onChange={e => setEquipment(s => e.target.checked ? [...s, eq] : s.filter(x=>x!==eq))} /> {eq}
                </label>
              ))}
            </div>
            <label style={{ color: '#fff', fontSize: 11 }}>Щадящие травмы (knee/back/shoulder/wrist, через запятую)</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <input value={injInput} onChange={e=> setInjInput(e.target.value)} placeholder="knee, shoulder" style={{ flex: 1, padding: 4, borderRadius: 6, fontSize: 11 }} />
              <button onClick={() => { const parts = injInput.split(',').map(s=> s.trim()).filter(Boolean); setInjuries(parts.map(p=> ({ location: p, type: 'joint' }))); }} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, background: '#00e68a', color: '#000', cursor: 'pointer' }}>Применить</button>
            </div>
            {injuries.length>0 && <div style={{ fontSize: 10, color: '#f59e0b' }}>Щадящий режим: {injuries.map((j:any)=> j.location).join(', ')} — вес ×0.6, +RIR</div>}
            <label style={{ color: '#fff', fontSize: 11 }}>Мобильность (ограничения)</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['shoulder','hip','knee','ankle','wrist','lower_back'].map(m => (
                <label key={m} style={{ color: '#fff', fontSize: 10, display: 'flex', gap: 3, alignItems: 'center' }}>
                  <input type="checkbox" checked={mobility.includes(m)} onChange={e => setMobility(s => e.target.checked ? [...s, m] : s.filter(x=> x!==m))} /> {m}
                </label>
              ))}
            </div>
          </div>
          <button onClick={pullFromProfile} style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, cursor: 'pointer' }}>Подтянуть из профиля</button>
          <button onClick={() => setStep('outside')} style={{ padding: '8px 12px', borderRadius: 8, background: '#00e68a', color: '#000', fontWeight: 700, cursor: 'pointer' }}>Далее → Вне зала</button>
        </div>
      )}

      {step === 'outside' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 10 }}>
          <label style={{ color: '#fff', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={outsideEnabled} onChange={e => setOutsideEnabled(e.target.checked)} /> Учитывать внезальную нагрузку
          </label>
          {outsideEnabled && outside && (
            <>
              <label style={{ color: '#fff', fontSize: 11 }}>Сессий/нед вне зала: {outside.sessionsPerWeek}</label>
              <input type="range" min={0} max={6} value={outside.sessionsPerWeek} onChange={e => setOutside(o => o ? { ...o, sessionsPerWeek: Number(e.target.value) } : o)} />
              <label style={{ color: '#fff', fontSize: 11 }}>Длительность мин: {outside.avgDurationMin}</label>
              <input type="range" min={30} max={180} step={10} value={outside.avgDurationMin} onChange={e => setOutside(o => o ? { ...o, avgDurationMin: Number(e.target.value) } : o)} />
              <label style={{ color: '#fff', fontSize: 11 }}>RPE: {outside.avgSRPE}</label>
              <input type="range" min={1} max={10} value={outside.avgSRPE} onChange={e => setOutside(o => o ? { ...o, avgSRPE: Number(e.target.value) } : o)} />
              <div style={{ fontSize: 11, color: '#00e68a' }}>{outsideMetrics ? `${outsideMetrics.weeklyLoad} load → объём ×${outsideMetrics.volumeMultiplier}` : ''}</div>
            </>
          )}
          <button onClick={() => setStep('split')} style={{ padding: '8px 12px', borderRadius: 8, background: '#00e68a', color: '#000', fontWeight: 700, cursor: 'pointer' }}>Далее → Сплит</button>
        </div>
      )}

      {step === 'split' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 10 }}>
          <div style={{ color: '#fff', fontSize: 12 }}>Рекомендуемый сплит: {recommendStrengthSportPattern(mode, days, level).name}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {STRENGTH_SPORT_PATTERNS.filter(p => p.mode===mode || p.mode==='any').map(p => (
              <div key={p.id} style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 11 }}>
                <b>{p.name}</b> — {p.sessionsPerRotation}×/нед · {p.description}
              </div>
            ))}
          </div>
          <button onClick={build} style={{ padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, cursor: 'pointer' }}>Собрать план</button>
        </div>
      )}

      {step === 'plan' && plan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ background: 'rgba(0,230,138,0.1)', padding: 10, borderRadius: 10, color: '#fff', fontSize: 11, whiteSpace: 'pre-wrap' }}>{buildStrengthSportReport(plan)}</div>
          {plan.validation?.warnings.map((w,i) => <div key={i} style={{ color: '#f59e0b', fontSize: 11 }}>⚠ {w}</div>)}
          <div style={{ background: 'rgba(255,255,255,0.04)', padding: 8, borderRadius: 8 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 11, marginBottom: 4 }}>Quality heatmap (подъёмы/нед vs MEV/MAV/MRV):</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {plan.weeksData.map(wk => {
                const sn = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['snatch','hang_snatch','power_snatch','muscle_snatch'].includes(e.id))).reduce((a,e)=> a + e.workSets.reduce((x,s)=> x+s.reps,0),0);
                const lm = getWL(plan.level,'snatch'); const st = lm ? (sn<lm.mev?'below': sn<=lm.mav?'optimal': sn<=lm.mrv?'high':'over') : 'optimal';
                const col = st==='below'?'#f59e0b': st==='optimal'?'#00e68a': st==='high'?'#eab308':'#ef4444';
                return <span key={wk.week} style={{ padding: '2px 6px', borderRadius: 6, background: col+'22', border: `1px solid ${col}`, color: col, fontSize: 10 }}>Н{wk.week}: {sn} рывков</span>;
              })}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {plan.weeksData.map(wk => {
                const sq = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['back_squat','front_squat','squat','hack_squat'].includes(e.id))).reduce((a,e)=> a+e.sets,0);
                const lm = getStrong(plan.level,'squat'); const st = lm ? (sq<lm.mev?'below': sq<=lm.mav?'optimal': sq<=lm.mrv?'high':'over') : 'optimal';
                const col = st==='below'?'#f59e0b': st==='optimal'?'#00e68a': st==='high'?'#eab308':'#ef4444';
                return <span key={wk.week} style={{ padding: '2px 6px', borderRadius: 6, background: col+'22', border: `1px solid ${col}`, color: col, fontSize: 10 }}>Н{wk.week}: {sq} присед сетов</span>;
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
                <span style={{ color: '#00e68a', fontWeight: 700, fontSize: 12 }}>Неделя {wk.week} · {wk.phase}{wk.deload ? ' · делод' : ''} · {wk.totalSets} сетов · {wk.sessions.reduce((a,s)=>a+s.exercises.reduce((x,e)=>x+e.workSets.reduce((q,w)=>q+w.weight*w.reps,0),0),0)/1000 |0}т тоннаж</span>
                <button onClick={() => {
                  const txt = wk.sessions.map(s=> `${s.sessionTag} (${s.character}) д${s.day}:\n` + s.exercises.map(e=> `  ${e.name} ${e.sets}x${e.reps} ${e.weight}кг RIR${e.rir} ${e.tempo} отдых${e.restSeconds}с${e.comment? ' // '+e.comment:''}`).join('\n')).join('\n\n');
                  navigator.clipboard?.writeText(`Неделя ${wk.week} ${wk.phase}\n`+txt); setMsg(`Неделя ${wk.week} скопирована`);
                }} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>Копировать неделю</button>
              </div>
              {wk.sessions.map(sess => (
                <div key={sess.day} style={{ marginTop: 6, padding: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{sess.sessionTag} · {sess.character} · день {sess.day} · {sess.durationMin} мин</span>
                    <span style={{ color: '#fff', fontSize: 10, opacity: 0.5 }}>⏱ {sess.exercises.reduce((a,e)=>a+ e.workSets.length* (e.restSeconds||90) ,0)/60 |0} мин отдыха</span>
                  </div>
                  {sess.exercises.map(ex => (
                    <div key={ex.id} style={{ color: '#fff', fontSize: 11, marginLeft: 6, marginTop: 4, padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: 4 }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span>{ex.name} — {ex.sets}×{ex.reps} @ {ex.weight}кг RIR{ex.rir} · {ex.tempo} · отдых {ex.restSeconds}с{ex.isCompetitionLift ? ' ★ соревн.' : ''}</span>
                        <input aria-label="вес" type="number" value={ex.weight} onChange={e=> updateEx(wk.week-1, sess.day, ex.id, { weight: Number(e.target.value)||0 })} style={{ width: 58, padding: '2px 4px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }} />
                        <input aria-label="повторы" type="text" value={ex.reps} onChange={e=> updateEx(wk.week-1, sess.day, ex.id, { reps: e.target.value })} style={{ width: 54, padding: '2px 4px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }} />
                        <input aria-label="RIR" type="number" min={0} max={5} value={ex.rir} onChange={e=> updateEx(wk.week-1, sess.day, ex.id, { rir: Number(e.target.value)||0 })} style={{ width: 44, padding: '2px 4px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }} />
                        <button aria-label="вверх" onClick={()=> moveEx(wk.week-1, sess.day, ex.id, -1)} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>↑</button>
                        <button aria-label="вниз" onClick={()=> moveEx(wk.week-1, sess.day, ex.id, 1)} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>↓</button>
                      </div>
                      {ex.comment && <div style={{ fontSize: 10, opacity: 0.7, marginLeft: 4, borderLeft: '2px solid rgba(0,230,138,0.3)', paddingLeft: 6 }}>{ex.comment}</div>}
                      {ex.warmupSets && ex.warmupSets.length>0 && <div style={{ fontSize: 10, opacity: 0.5 }}>Разминка: {ex.warmupSets.map(s=> `${s.reps}×${s.weight}кг`).join(' → ')} → рабочие</div>}
                      <div style={{ fontSize: 10, opacity: 0.45 }}>Сеты: {ex.workSets.map(s=> `${s.reps}×${s.weight}кг RIR${s.rir}`).join(' | ')}</div>
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
                {annual.blocks.map(b => <span key={b.id} style={{ padding: '2px 6px', borderRadius: 6, background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.3)', color: '#00e68a', fontSize: 10 }}>Нед {b.startWeek}-{b.startWeek+b.weeks-1}: {b.mode} ×{b.weeks}</span>)}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => { const txt = buildStrengthSportReport(plan); navigator.clipboard?.writeText(txt); setMsg('Скопировано'); }} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer' }}>Копировать отчёт</button>
            <button onClick={() => { const txt = buildStrengthSportReport(plan); const w = window.open('', '_blank'); if (w) { w.document.write(`<pre style="font-family:monospace;white-space:pre-wrap">${txt.replace(/</g,'&lt;')}</pre>`); w.document.close(); w.print(); } }} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer' }}>Печать</button>
            <button onClick={exportToUserProgram} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.15)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.3)', cursor: 'pointer' }}>Экспорт в программу</button>
          </div>
          {msg && <div style={{ color: '#00e68a', fontSize: 11 }}>{msg}</div>}
        </div>
      )}
    </div>
  );
};

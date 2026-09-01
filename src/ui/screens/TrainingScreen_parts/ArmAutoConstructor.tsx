/**
 * ArmAutoConstructor.tsx — PRO-конструктор армрестлинг/армлифтинг.
 * Изолирован, как BbAutoConstructor, но для arm-движка.
 * 6 шагов: params → grip → split → plan → quality → export.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { buildArmPlan } from '../../../engines/arm/arm-builder.engine';
import { finalizeArmPlan } from '../../../engines/arm/arm-finalize.engine';
import { rankArmSplits, selectBestArmSplit } from '../../../engines/arm/arm-selector.engine';
import { buildArmSchedule } from '../../../engines/arm/arm-specialization.engine';
import { validateArmPlan } from '../../../engines/arm/arm-validator.engine';
import { calcArmMetrics } from '../../../engines/arm/arm-metrics.engine';
import { buildArmReport } from '../../../engines/arm/arm-report.engine';
import { buildArmPrintHtml, buildArmIcs } from '../../../engines/arm/arm-export.engine';
import { ARM_SPLIT_PATTERNS } from '../../../engines/arm/arm-split-patterns';
import { ARM_MUSCLE_RU } from '../../../engines/arm/arm-types';
import { ArmTechniqueCard } from './ArmTechniqueCard';
import { ArmGripCard } from './ArmGripCard';
import { ArmHeatmap } from './ArmHeatmap';
import { CARD, H, SMALL, BTN, BTN_GHOST, ACCENT, STEP_PILL } from './training-ui';
import { useDataLink } from '../../../core/data-link';
import { subscribePlannerApply, getPlannerApply } from './planner-bridge';

type Step = 'params'|'grip'|'split'|'plan'|'quality';

const LEVELS = ['beginner','intermediate','advanced','enhanced'] as const;
const GOALS = [
  { id: 'strength', label: 'Сила' },
  { id: 'hypertrophy', label: 'Масса предплечья' },
  { id: 'peaking', label: 'Пик к старту' },
  { id: 'endurance', label: 'Выносливость' },
  { id: 'maintenance', label: 'Поддержание' },
] as const;
const TECHNIQUES = [
  { id: 'balanced', label: 'Сбалансировано' },
  { id: 'hook', label: 'Хук' },
  { id: 'toproll', label: 'Топролл' },
  { id: 'press', label: 'Пресс' },
] as const;
const DISCIPLINES = [
  { id: 'armwrestling', label: 'Армрестлинг' },
  { id: 'armlifting', label: 'Армлифтинг' },
  { id: 'hybrid', label: 'Гибрид' },
] as const;
const GRIP_FOCI = [
  { id: 'support', label: 'Поддержка (RT/Axle)' },
  { id: 'pinch', label: 'Щипок (Saxon/Hub)' },
  { id: 'crush', label: 'Дробление (CoC)' },
  { id: 'hub', label: 'Hub' },
] as const;

export function ArmAutoConstructor() {
  const [step, setStep] = useState<Step>('params');
  const [discipline, setDiscipline] = useState<string>('armwrestling');
  const [technique, setTechnique] = useState<string>('balanced');
  const [gripFocus, setGripFocus] = useState<string>('support');
  const [level, setLevel] = useState<string>('intermediate');
  const [goal, setGoal] = useState<string>('strength');
  const [weeks, setWeeks] = useState<number>(8);
  const [daysPerWeek, setDaysPerWeek] = useState<number>(4);
  const [weakPoints, setWeakPoints] = useState<string[]>([]);
  const [focusGroup, setFocusGroup] = useState<string>('');
  const [specialization, setSpecialization] = useState<boolean>(false);
  const [patternId, setPatternId] = useState<string>('');
  const [builtPlan, setBuiltPlan] = useState<any>(null);
  const [weekSel, setWeekSel] = useState<number>(1);
  const [msg, setMsg] = useState<string>('');
  const linked: any = (() => { try { return (useDataLink as any)(); } catch { return {}; } })();
  const [pedDoses, setPedDoses] = useState<Record<string, number>>({});
  const [courseIntensity, setCourseIntensity] = useState<'mild'|'moderate'|'heavy'>('moderate');
  const [showPed, setShowPed] = useState(false);

  const workMax = useMemo(() => {
    try {
      const pm: any = linked?.profile?.personal ?? {};
      const wm: Record<string, number> = {};
      if (pm.weight) wm['default'] = Number(pm.weight) || 50;
      return wm;
    } catch { return {}; }
  }, [linked]);

  // Приём из хаба диагностики (Интеллект → Арм-диагностика → Применить в Арм-конструктор)
  useEffect(() => {
    const apply = (payload: any) => {
      if (!payload || payload.kind !== 'weakpoints') return;
      const groups: string[] | undefined = payload.data?.groups;
      if (Array.isArray(groups) && groups.length > 0) {
        setWeakPoints(groups.slice(0, 2).map((s: string) => String(s).toLowerCase()));
        setSpecialization(true);
        setStep('params');
        flash(`↩ Из диагностики: ${groups.join(', ')}`);
      }
      const tech = payload.data?.armTechnique;
      if (tech) setTechnique(String(tech));
    };
    // начальный снимок (если хаб уже отправил до монтирования)
    try {
      const cur = getPlannerApply();
      if (cur) apply(cur);
    } catch {}
    const unsub = subscribePlannerApply((p) => { try { apply(p); } catch {} });
    return () => { try { unsub(); } catch {} };
  }, []);

  const ranked = useMemo(() => {
    return rankArmSplits({ level, goal: goal as any, technique, discipline, daysPerWeek, gripFocus, weakPoints, specialization });
  }, [level, goal, technique, discipline, daysPerWeek, gripFocus, weakPoints, specialization]);

  const best = useMemo(() => ranked[0]?.pattern, [ranked]);

  const specPreview = useMemo(() => {
    return buildArmSchedule({ focusGroup: focusGroup || undefined, weakPoints, specialization, totalWeeks: weeks });
  }, [focusGroup, weakPoints, specialization, weeks]);

  const flash = (t: string) => { setMsg(t); setTimeout(()=>setMsg(''), 2600); };

  const handleBuild = () => {
    const pid = patternId || best?.id || ARM_SPLIT_PATTERNS[0].id;
    try {
      const recovery: any = (() => {
        try {
          const p: any = linked?.profile ?? {};
          const lifestyle: any = p.lifestyle ?? p.personal ?? {};
          return {
            bodyFat: p.personal?.bodyFat ?? p.personal?.bodyFatPct,
            leanMass: p.personal?.leanMass,
            hrvMs: lifestyle?.morningHRV ?? lifestyle?.hrvMs,
            sleepHours: lifestyle?.sleepHours,
            stressLevel: lifestyle?.stressLevel,
          };
        } catch { return {}; }
      })();
      let plan: any = buildArmPlan({
        discipline: discipline as any,
        patternId: pid,
        level,
        goal: goal as any,
        technique: technique as any,
        weeks,
        gripFocus: gripFocus as any,
        weakPoints,
        focusGroup: focusGroup || undefined,
        specialization,
        workMax,
        pedDoses: Object.keys(pedDoses).length ? pedDoses : undefined,
        courseIntensity,
        bodyFat: recovery.bodyFat,
        leanMass: recovery.leanMass,
        hrvMs: recovery.hrvMs,
        sleepHours: recovery.sleepHours,
        stressLevel: recovery.stressLevel,
      });
      plan = finalizeArmPlan(plan, { level });
      const v = validateArmPlan(plan, level);
      plan.validation = v;
      plan.report = buildArmReport(plan);
      plan.metrics = calcArmMetrics(plan);
      setBuiltPlan(plan);
      setWeekSel(1);
      setStep('plan');
      flash(`✅ План собран: ${plan.pattern.name}, ${plan.weeks.length} нед`);
    } catch (e: any) {
      flash(`❌ Ошибка: ${e?.message || e}`);
    }
  };

  const toggleWeak = (m: string) => {
    setWeakPoints(prev => prev.includes(m) ? prev.filter(x=>x!==m) : [...prev, m].slice(0,2));
  };

  const curWeek = builtPlan?.weeks?.find((w:any)=>w.week===weekSel) || builtPlan?.weeks?.[0];

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 12 }}>
      <h2 style={H}>🤝 Арм-конструктор PRO</h2>
      <p style={SMALL}>Армрестлинг (стол: hook/toproll/press, РУ/РА, table ≥50%) + армлифтинг (хват: support/pinch/crush). Периодизация 3/2/1 (Кузнецов), tendon-cap, humerus-guard.</p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {(['params','grip','split','plan','quality'] as Step[]).map(s => (
          <button key={s} onClick={()=>setStep(s)} style={{ ...STEP_PILL(step===s), background: step===s ? ACCENT : 'rgba(255,255,255,0.06)', color: step===s ? '#001' : '#fff' }}>
            {s === 'params' ? '🎛 Параметры' : s === 'grip' ? '✊ Хват' : s === 'split' ? '🗓 Сплит' : s === 'plan' ? '📋 План' : '📊 Качество'}
          </button>
        ))}
      </div>

      {msg && <div style={{ ...CARD, background: 'rgba(0,230,138,0.12)', borderColor: ACCENT, color: '#fff' }}>{msg}</div>}

      {step === 'params' && (
        <div style={CARD}>
          <h3 style={H}>🎛 Параметры</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={SMALL}>Дисциплина<br/>
              <select value={discipline} onChange={e=>setDiscipline(e.target.value)} style={{ width:'100%', background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:8 }}>
                {DISCIPLINES.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>
            <label style={SMALL}>Техника (стол)<br/>
              <select value={technique} onChange={e=>setTechnique(e.target.value)} style={{ width:'100%', background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:8 }}>
                {TECHNIQUES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label style={SMALL}>Уровень<br/>
              <select value={level} onChange={e=>setLevel(e.target.value)} style={{ width:'100%', background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:8 }}>
                <option value="beginner">Новичок</option><option value="intermediate">Средний</option><option value="advanced">Продвинутый</option><option value="enhanced">Enhanced</option>
              </select>
            </label>
            <label style={SMALL}>Цель<br/>
              <select value={goal} onChange={e=>setGoal(e.target.value)} style={{ width:'100%', background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:8 }}>
                {GOALS.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </label>
            <label style={SMALL}>Недель<br/>
              <input type="number" min={2} max={52} value={weeks} onChange={e=>setWeeks(Math.max(2,Math.min(52, parseInt(e.target.value)||8)))} style={{ width:'100%', background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:8 }} />
            </label>
            <label style={SMALL}>Дней/нед<br/>
              <input type="number" min={2} max={6} value={daysPerWeek} onChange={e=>setDaysPerWeek(Math.max(2,Math.min(6, parseInt(e.target.value)||4)))} style={{ width:'100%', background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:8 }} />
            </label>
          </div>

          {discipline !== 'armwrestling' && (
            <div style={{ marginTop: 10 }}>
              <div style={SMALL}>Хват-фокус</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {GRIP_FOCI.map(g=> (
                  <button key={g.id} onClick={()=>setGripFocus(g.id)} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid', borderColor: gripFocus===g.id ? ACCENT : '#1f3a5f', background: gripFocus===g.id ? 'rgba(0,230,138,0.15)' : '#0a1629', color: gripFocus===g.id ? ACCENT : '#9ab', cursor:'pointer' }}>{g.label}</button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <div style={SMALL}>Слабые зоны (1–2, специализация ×1.3)</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {['wrist_flexors','pronators','supinators','brachialis','risers','grip_support','grip_pinch','side_pressure','back_pressure'].map(m=> (
                <button key={m} onClick={()=>toggleWeak(m)} aria-pressed={weakPoints.includes(m)} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid', borderColor: weakPoints.includes(m) ? ACCENT : '#1f3a5f', background: weakPoints.includes(m) ? 'rgba(0,230,138,0.15)' : '#0a1629', color: weakPoints.includes(m) ? ACCENT : '#9ab', cursor:'pointer', fontSize:12 }}>{ARM_MUSCLE_RU[m] || m}</button>
              ))}
            </div>
            <div style={{ marginTop: 6, display:'flex', gap:6, alignItems:'center' }}>
              <label style={{ ...SMALL, display:'flex', alignItems:'center', gap:6 }}><input type="checkbox" checked={specialization} onChange={e=>setSpecialization(e.target.checked)} /> Специализация (блок 6 нед + баланс)</label>
              {specialization && <span style={{ color: ACCENT, fontSize:12 }}>{specPreview.rationale}</span>}
            </div>
          </div>

          <div style={{ marginTop: 12, border: '1px solid #1f3a5f', borderRadius: 10, padding: 10, background: '#0a1629' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <label style={{ ...SMALL, display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                <input type="checkbox" checked={showPed} onChange={e=>setShowPed(e.target.checked)} /> 💉 На курсе (PED)
              </label>
              {showPed && (
                <select value={courseIntensity} onChange={e=>setCourseIntensity(e.target.value as any)} style={{ marginLeft:'auto', background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'4px 8px', fontSize:12 }}>
                  <option value="mild">Мягкий</option><option value="moderate">Средний</option><option value="heavy">Тяжёлый</option>
                </select>
              )}
            </div>
            {showPed && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  ['test_e','Тест энантат мг/нед'],
                  ['tren_a','Тренболон мг/нед'],
                  ['bold_u','Болденон мг/нед'],
                ].map(([k,label])=> (
                  <label key={k} style={{ ...SMALL }}>
                    {label}<br/>
                    <input
                      type="number"
                      value={pedDoses[k] ?? ''}
                      onChange={e=>{
                        const v = parseFloat(e.target.value);
                        setPedDoses(prev=> {
                          const n={...prev};
                          if (Number.isFinite(v) && v>0) n[k]=v; else delete n[k];
                          return n;
                        });
                      }}
                      placeholder="0"
                      style={{ width:'100%', background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', marginTop:4 }}
                    />
                  </label>
                ))}
              </div>
            )}
            <div style={{ ...SMALL, marginTop:6, color:'#6a8a9a' }}>TendonCap 1.5× (сухожилия медленнее), recovery × lab × nutrition уже в бюджете.</div>
          </div>

          <div style={{ marginTop: 12 }}>
            <ArmTechniqueCard onApplyWeak={(ws)=>setWeakPoints(ws.slice(0,2))} />
          </div>

          <button onClick={handleBuild} style={{ ...BTN, width:'100%', marginTop: 14 }}>⚡ Собрать план</button>
          <div style={{ ...SMALL, marginTop: 6 }}>Лучший сплит: <b style={{ color:ACCENT }}>{best?.name || '—'}</b> ({ranked[0]?.score ?? 0} баллов) · {ranked[0]?.rationale.slice(0,2).join(' · ')}</div>
        </div>
      )}

      {step === 'grip' && (
        <div style={CARD}>
          <ArmGripCard onApplyWeak={(ws)=>setWeakPoints(ws.slice(0,2))} />
          <div style={{ marginTop: 12, ...SMALL }}>
            <b style={{ color:'#fff' }}>Хват-типы (StrongShop / IronMind):</b> support (Rolling Thunder 60мм вращающаяся, Axle 58мм DOH) · pinch (Saxon 3" / Hub) · crush (CoC). Рекомендация — {best?.name}.
          </div>
        </div>
      )}

      {step === 'split' && (
        <div style={CARD}>
          <h3 style={H}>🗓 Выбор сплита</h3>
          <p style={SMALL}>Ранжирование по уровню/цели/технике/хватe/дням ({daysPerWeek}/нед). Зелёный — лучший.</p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {ranked.slice(0,6).map((r,i)=> (
              <div key={r.pattern.id} onClick={()=>setPatternId(r.pattern.id)} style={{ padding:10, borderRadius:12, border: `1px solid ${patternId===r.pattern.id ? ACCENT : i===0 ? 'rgba(0,230,138,0.4)' : '#1f3a5f'}`, background: patternId===r.pattern.id ? 'rgba(0,230,138,0.12)' : i===0 ? 'rgba(0,230,138,0.06)' : '#0a1629', cursor:'pointer' }}>
                <div style={{ color:'#fff', fontWeight:700 }}>{i===0 ? '★ ' : ''}{r.pattern.name} <span style={{ color:'#9ab', fontWeight:400 }}>— {r.pattern.sessionsPerRotation}x/{r.pattern.rotationDays}дн</span> <span style={{ float:'right', color: ACCENT }}>{r.score}</span></div>
                <div style={{ color:'#9ab', fontSize:12 }}>{r.pattern.description}</div>
                {r.rationale.length>0 && <div style={{ color:'#5ee', fontSize:11 }}>{r.rationale.join(' · ')}</div>}
                {r.warnings.length>0 && <div style={{ color:'#e6a23c', fontSize:11 }}>⚠ {r.warnings.join(' · ')}</div>}
              </div>
            ))}
          </div>
          <button onClick={handleBuild} style={{ ...BTN, width:'100%', marginTop:12 }}>⚡ Собрать с выбранным сплитом</button>
        </div>
      )}

      {step === 'plan' && (
        <div style={CARD}>
          {!builtPlan ? <div style={SMALL}>План не собран — вернись в «Параметры».</div> : (
            <>
              <h3 style={H}>📋 План — {builtPlan.pattern.name}</h3>
              <div style={SMALL}>{builtPlan.rationale.map((r:string, i:number)=><div key={i}>• {r}</div>)}</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                {builtPlan.weeks.map((w:any)=> (
                  <button key={w.week} onClick={()=>setWeekSel(w.week)} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid', borderColor: weekSel===w.week ? ACCENT : '#1f3a5f', background: weekSel===w.week ? ACCENT : '#0a1629', color: weekSel===w.week ? '#001' : '#9ab', fontWeight: weekSel===w.week ? 700 : 400, cursor:'pointer' }}>
                    Н{w.week} {w.phase==='deload' ? '· deload' : w.phase==='peaking' ? '· пик' : ''}
                  </button>
                ))}
              </div>
              {curWeek && (
                <div style={{ marginTop: 10 }}>
                  <h4 style={{ color:'#fff', margin:'6px 0' }}>Неделя {curWeek.week} — {curWeek.phase} {curWeek.deload ? '(deload)' : ''}</h4>
                  {curWeek.sessions.map((sess:any, si:number)=> (
                    <div key={si} style={{ border:'1px solid #1f3a5f', borderRadius:10, padding:8, marginBottom:8, background:'#0a1629' }}>
                      <div style={{ color:ACCENT, fontWeight:700, fontSize:13, marginBottom:4 }}>{sess.sessionTag} · {sess.character} {sess.tableTime ? '🖐️ стол' : ''}</div>
                      {sess.exercises.map((ex:any, ei:number)=> (
                        <div key={ei} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom: ei < sess.exercises.length-1 ? '1px solid rgba(255,255,255,0.06)' : 'none', fontSize:12 }}>
                          <span style={{ color:'#fff' }}>{ex.name} <span style={{ color:'#9ab' }}>· {ARM_MUSCLE_RU[ex.muscle] || ex.muscle}</span> {ex.isTable ? '🖐️' : ''} {ex.workingAngle ? `· РУ ${ex.workingAngle.elbowDeg}° ${ex.workingAngle.direction}` : ''}</span>
                          <span style={{ color:'#9ab' }}>{ex.sets}×{ex.repsRange[0]}-{ex.repsRange[1]} RIR{ex.rir}{ex.holdSeconds ? ` hold ${ex.holdSeconds}с`:''}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                <button onClick={()=>{
                  const html = buildArmPrintHtml(builtPlan);
                  const w = window.open('', '_blank');
                  if (w) { w.document.write(html); w.document.close(); } else flash('⚠ Всплывающие окна заблокированы');
                }} style={BTN_GHOST as any}>🖨 Печать</button>
                <button onClick={()=>{
                  const ics = buildArmIcs(builtPlan);
                  const blob = new Blob([ics], { type:'text/calendar' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href=url; a.download='arm-plan.ics'; a.click(); URL.revokeObjectURL(url);
                }} style={BTN_GHOST as any}>📅 .ics</button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'quality' && (
        <div style={CARD}>
          {!builtPlan ? <div style={SMALL}>Сначала собери план.</div> : (
            <>
              <h3 style={H}>📊 Качество</h3>
              <div style={SMALL}><b style={{ color:'#fff' }}>{builtPlan.report?.summary}</b></div>
              <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ background:'#0a1629', border:'1px solid #1f3a5f', borderRadius:10, padding:8 }}>
                  <div style={{ color:ACCENT, fontWeight:700, fontSize:12 }}>Фазы</div>
                  <div style={{ color:'#9ab', fontSize:12 }}>{builtPlan.report?.phaseRationale.join(' · ')}</div>
                </div>
                <div style={{ background:'#0a1629', border:'1px solid #1f3a5f', borderRadius:10, padding:8 }}>
                  <div style={{ color:ACCENT, fontWeight:700, fontSize:12 }}>Объём</div>
                  <div style={{ color:'#9ab', fontSize:12 }}>{builtPlan.report?.volumeSummary.join(' · ')}</div>
                </div>
              </div>
              {builtPlan.validation && (
                <div style={{ marginTop:8 }}>
                  {builtPlan.validation.errors.length>0 && <div style={{ color:'#ff6b6b', fontSize:12 }}>❌ Ошибки: {builtPlan.validation.errors.join(' · ')}</div>}
                  {builtPlan.validation.warnings.length>0 && <div style={{ color:'#e6a23c', fontSize:12, marginTop:4 }}>⚠ {builtPlan.validation.warnings.slice(0,6).join(' · ')}</div>}
                  {builtPlan.validation.valid && <div style={{ color:ACCENT, fontSize:12 }}>✓ Валидация пройдена (MRV, humerus, баланс, tendon).</div>}
                </div>
              )}
              <div style={{ marginTop:8, color:'#9ab', fontSize:12 }}>
                {builtPlan.report?.techniqueRationale.map((r:string,i:number)=><div key={i}>• {r}</div>)}
                {builtPlan.report?.gripRationale.map((r:string,i:number)=><div key={i}>• {r}</div>)}
              </div>
              <div style={{ marginTop: 10 }}>
                <ArmHeatmap plan={builtPlan} onToast={flash} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

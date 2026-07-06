// @ts-nocheck
import React from 'react';
import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS } from '../../../data/support-database';
import { PHARMA_DB } from '../../../core/pharma-database';
import { hydrateState, runSupportForLevel } from '../../../engines/support-plan';
import type { CalculatorState, PlanSubstance, PowerLevel } from '../../../engines/support-plan';
import { evaluateRecommendations, computeCoverageRisk, buildPreApplyCard } from '../../../engines/recommendation-engine';
import { calcStackSynergyScore, buildCautions } from '../../../engines/support-plan/display';
import { DosageCalculator, DosageCalculatorView } from '../../components/DosageCalculator';
import { WeeklyPlanView } from './WeeklyPlanView';

/**
 * Карточка расчёта поддержки (представление).
 * Источник JSX: SupportScreen.tsx строки 5268–6414 (return-блок IIFE генератора).
 * Вся логика расчёта и помощники (savePlan/copyPlan/exportForDoctor/buildShareText,
 * helper-константы SYSTEM_LABELS_RU/SYSTEM_ORDER/uniqCourse и т.д.) приезжают через `s`.
 * Этот компонент — чистая render-функция, без собственной бизнес-логики.
 */
export const SupportCalcResult: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const {
    setAutoCalcResult, setManualLevelSelected, setSupportLevel, setEnhancedSubs,
    showToast, calcSupport, setShowModal, setModalAddMode,
    setBoostEnabled, setJointMode, setReproMode, setNeuroMode, setSupportPhase,
    setPlanSaved, setExpandedCategories, setSubSearch, setMyPlansRefresh,
    linked, supportLevel, autoLevel, manualLevelSelected,
    boostEnabled, jointMode, reproMode, neuroMode, supportPhase, courseWeekState,
    weekChangeMsg, calcDone, calcResult, planResult, effectiveLevel,
    planSaved, enhancedSubs, expandedCategories, subSearch, allSupport,
    SUPPORT_LEVELS,
    savePlan, copyPlan, exportForDoctor, buildShareText,
  } = s;
  const planSavedLocal = planSaved;

  return (
        <div style={{ padding:'0 0 80px', height:'100vh', display:'flex', flexDirection:'column' }}>
            <div style={{ flex:1, overflowY:'auto', paddingRight:4, display:'flex', flexDirection:'column', gap:8 }}>

            {/* ===== ЕДИНАЯ КАРТОЧКА РАСЧЁТА ПОДДЕРЖКИ ===== */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:16, border:'2px solid rgba(0,230,138,0.25)', position:'relative' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'linear-gradient(135deg, rgba(0,230,138,0.02), rgba(0,198,83,0.02))', pointerEvents:'none' }} />
              
              {/* Header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <h4 style={{ margin:0, fontSize:13, color:'#00e68a', display:'flex', alignItems:'center', gap:6 }}>
                  🧮 Расчёт поддержки
                </h4>
                <span style={{ fontSize:9, fontWeight:400, color:'var(--text-dim)', background:'rgba(0,230,138,0.08)', padding:'2px 8px', borderRadius:10 }}>v3.0</span>
              </div>

              {/* Week selector — кнопка-карточка с попапом */}
              <div style={{ background:'rgba(0,0,0,0.12)', borderRadius:8, padding:'8px 12px', marginBottom:8 }}>
                <div style={{ fontSize:9, fontWeight:600, color:'var(--text-dim)', marginBottom:4 }}>📅 Неделя курса</div>
                <button onClick={() => setShowModal('weekSelect')} style={{
                  width:'100%', padding:'10px 14px', borderRadius:8, cursor:'pointer',
                  background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.15)',
                  color:'var(--accent)', fontWeight:700, fontSize:13, textAlign:'center',
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                }}>
                  <span>Неделя</span>
                  <span style={{ fontSize:16, fontWeight:800, color:'#fff', background:'rgba(0,230,138,0.15)', borderRadius:6, padding:'2px 12px' }}>{courseWeekState}</span>
                  <span style={{ fontSize:9, color:'var(--text-dim)' }}>▾</span>
                </button>
                <div style={{ fontSize:7, color:'var(--text-dim)', display:'flex', justifyContent:'space-between', marginTop:3 }}>
                  <span>Начало</span><span>Пик нагрузки</span><span>Конец курса</span>
                </div>
              </div>

              {/* Week change notification */}
              {weekChangeMsg && (
                <div style={{ marginBottom:8, padding:'6px 10px', borderRadius:8, background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.15)', fontSize:8, color:'#60a5fa' }}>
                  📌 {weekChangeMsg}
                </div>
              )}

              {/* Note about missing data */}
              {(!linked.labs || linked.labs.length === 0) && (
                <div style={{ fontSize:8, color:'#f59e0b', marginBottom:8, padding:'4px 8px', borderRadius:6, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.1)' }}>
                  ⚠️ Нет данных анализов — риск рассчитан консервативно. Добавьте анализы для точного расчёта.
                </div>
              )}

              {/* Level selector (always visible) */}
              <div style={{ marginBottom:8 }}>
                <div style={{ fontSize:9, fontWeight:600, color:'var(--text-dim)', marginBottom:4, display:'flex', justifyContent:'space-between' }}><span>📊 Уровень поддержки:</span>
                  {manualLevelSelected && <span onClick={() => { setManualLevelSelected(false); setSupportLevel(autoLevel); calcSupport(autoLevel); }} style={{ cursor:'pointer', color:'#60a5fa', fontSize:7 }}>🔄 Авто</span>}
                </div>
                <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                  <button onClick={() => setShowModal('intel')} style={{
                    flex:1, padding:'12px 10px', borderRadius:12, cursor:'pointer', textAlign:'left',
                    background:'linear-gradient(135deg, rgba(0,230,138,0.1), rgba(0,198,83,0.05))',
                    border:'2px solid rgba(0,230,138,0.3)', color:'var(--text-light)',
                  }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--accent)', marginBottom:2 }}>🧠 Интеллектуальная</div>
                    <div style={{ fontSize:8, color:'var(--text-dim)' }}>{SUPPORT_LEVELS[supportLevel]?.label || supportLevel} · {SUPPORT_LEVELS[supportLevel]?.desc || ''}</div>
                  </button>
                  <button onClick={() => { setShowModal('manual'); setModalAddMode(false); }} style={{
                    flex:1, padding:'12px 10px', borderRadius:12, cursor:'pointer', textAlign:'left',
                    background:'linear-gradient(135deg, rgba(96,165,250,0.1), rgba(59,130,246,0.05))',
                    border:'2px solid rgba(96,165,250,0.3)', color:'var(--text-light)',
                  }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:2 }}>📋 Ручной выбор</div>
                    <div style={{ fontSize:8, color:'var(--text-dim)' }}>{enhancedSubs.length > 0 ? `${enhancedSubs.length} веществ вручную` : 'Выбрать из каталога'}</div>
                  </button>
                </div>
              </div>

              {/* Phase selector */}
              <div style={{marginBottom:8}}>
                <div style={{fontSize:9,fontWeight:600,color:'var(--text-dim)',marginBottom:4}}>🔄 Фаза цикла:</div>
                <div style={{display:'flex',gap:4}}>
                  {(['course','bridge','pct','fertility'] as const).map((ph: any) => { const a = supportPhase === ph; const lab:Record<string,string> = {course:'💉 Курс',bridge:'🌉 Мост',pct:'🔄 ПКТ',fertility:'⚧ Ферт.'}; return <button key={ph} onClick={() => setSupportPhase(ph)} style={{flex:1,padding:'6px 2px',borderRadius:8,fontSize:9,fontWeight:600,cursor:'pointer',background:a?'rgba(139,92,246,0.15)':'rgba(255,255,255,0.03)',border:a?'1px solid rgba(139,92,246,0.4)':'1px solid rgba(255,255,255,0.06)',color:a?'#8b5cf6':'var(--text-dim)'}}>{lab[ph]}</button>; })}
                </div>
              </div>
              {/* Calculate button */}
              <button onClick={() => calcSupport(supportLevel)} style={{
                width:'100%', padding:'14px', borderRadius:12, border:'2px solid var(--accent)', cursor:'pointer',
                background:'linear-gradient(135deg, rgba(0,230,138,0.12), rgba(0,198,83,0.05))', color:'#00e68a', fontWeight:800, fontSize:13, marginBottom:8, letterSpacing:0.5,
              }}>
                🧮 Рассчитать поддержку
              </button>

              {/* Toggle buttons: available in BOTH intelligent and manual modes */}
              <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                <button onClick={() => { setBoostEnabled(!boostEnabled); setTimeout(() => calcSupport(), 50); }} style={{
                  flex:1, padding:'8px 6px', borderRadius:10, fontSize:9, fontWeight:700, cursor:'pointer',
                  background: boostEnabled ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
                  border: boostEnabled ? '2px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  color: boostEnabled ? '#ef4444' : 'var(--text-dim)',
                }}>🔥 Усиление</button>
                <button onClick={() => { setJointMode(!jointMode); setTimeout(() => calcSupport(), 50); }} style={{
                  flex:1, padding:'8px 6px', borderRadius:10, fontSize:9, fontWeight:700, cursor:'pointer',
                  background: jointMode ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                  border: jointMode ? '2px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  color: jointMode ? '#8b5cf6' : 'var(--text-dim)',
                }}>🦴 Суставы</button>
                <button onClick={() => { setReproMode(!reproMode); setTimeout(() => calcSupport(), 50); }} style={{
                  flex:1, padding:'8px 6px', borderRadius:10, fontSize:9, fontWeight:700, cursor:'pointer',
                  background: reproMode ? 'rgba(236,72,153,0.12)' : 'rgba(255,255,255,0.03)',
                  border: reproMode ? '2px solid rgba(236,72,153,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  color: reproMode ? '#ec4899' : 'var(--text-dim)',
                }}>⚧ Репродукт.</button>
                <button onClick={() => { setNeuroMode(!neuroMode); setTimeout(() => calcSupport(), 50); }} style={{
                  flex:1, padding:'8px 6px', borderRadius:10, fontSize:9, fontWeight:700, cursor:'pointer',
                  background: neuroMode ? 'rgba(20,184,166,0.12)' : 'rgba(255,255,255,0.03)',
                  border: neuroMode ? '2px solid rgba(20,184,166,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  color: neuroMode ? '#14b8a6' : 'var(--text-dim)',
                }}>🧠 Нейропрот.</button>
              </div>

              {/* Active mode banners */}
              {boostEnabled && (
                <div style={{ marginBottom:6, padding:'8px 12px', borderRadius:8, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', fontSize:9, color:'#ef4444', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span>🔥 Усиление активно — целевой риск снижен на 5%</span>
                  <button onClick={() => { setBoostEnabled(false); calcSupport(); }} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:10, fontWeight:700 }}>✕</button>
                </div>
              )}
              {jointMode && (
                <div style={{ marginBottom:6, padding:'8px 12px', borderRadius:8, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', fontSize:9, color:'#8b5cf6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span>🦴 Режим суставов — отдельные препараты (не в основном стеке)</span>
                  <button onClick={() => { setJointMode(false); calcSupport(); }} style={{ background:'none', border:'none', color:'#8b5cf6', cursor:'pointer', fontSize:10, fontWeight:700 }}>✕</button>
                </div>
              )}
              {reproMode && (
                <div style={{ marginBottom:6, padding:'8px 12px', borderRadius:8, background:'rgba(236,72,153,0.08)', border:'1px solid rgba(236,72,153,0.2)', fontSize:9, color:'#ec4899', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span>⚧ Репродуктивная система — добавлены препараты для HPTA/сперматогенеза</span>
                  <button onClick={() => { setReproMode(false); calcSupport(); }} style={{ background:'none', border:'none', color:'#ec4899', cursor:'pointer', fontSize:10, fontWeight:700 }}>✕</button>
                </div>
              )}
              {neuroMode && (
                <div style={{ marginBottom:6, padding:'8px 12px', borderRadius:8, background:'rgba(20,184,166,0.08)', border:'1px solid rgba(20,184,166,0.2)', fontSize:9, color:'#14b8a6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span>🧠 Нейропротекция — добавлены ноотропы и нейропротекторы</span>
                  <button onClick={() => { setNeuroMode(false); calcSupport(); }} style={{ background:'none', border:'none', color:'#14b8a6', cursor:'pointer', fontSize:10, fontWeight:700 }}>✕</button>
                </div>
              )}
              
               {/* Save calc result + Save Plan to Мои планы */}
              {calcDone && calcResult && (
                <div style={{ marginBottom:6, display:'flex', flexDirection:'column', gap:4 }}>
                  <button onClick={() => {
                    const saveData = {
                      id: Date.now(),
                      calcResult, supportLevel, enhancedSubs, boostEnabled, jointMode, courseWeekState,
                      linked: { course: linked.course, labs: linked.labs },
                      timestamp: new Date().toISOString(),
                    };
                    try {
                      const arr: any[] = JSON.parse(localStorage.getItem('he_saved_calc_results') || '[]');
                      arr.push(saveData);
                      localStorage.setItem('he_saved_calc_results', JSON.stringify(arr));
                      setPlanSaved('✅ Сохранено в Избранное → Расчёты');
                      setTimeout(() => setPlanSaved(''), 3000);
                    } catch {}
                  }} style={{ width:'100%', padding:'8px', borderRadius:8, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.12)', color:'var(--accent)' }}>
                    💾 Сохранить расчёт в избранное
                  </button>
                  <button onClick={() => {
                    const myPlans: any[] = JSON.parse(localStorage.getItem('he_my_plans') || '[]');
                    const planData = {
                      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                      name: `План от ${new Date().toLocaleDateString('ru-RU')} (ур. ${supportLevel})`,
                      date: new Date().toISOString(),
                      level: supportLevel,
                      week: courseWeekState,
                      subs: effectiveLevel?.subs || [],
                      dosages: effectiveLevel?.dosages || {},
                      riskBefore: calcResult?.riskBeforeSupport ?? 0,
                      riskAfter: calcResult?.riskAfterSupport ?? 0,
                      supportScore: calcResult?.supportScore ?? 0,
                      enhancedSubs: enhancedSubs,
                      boostEnabled: boostEnabled,
                      jointMode: jointMode,
                      jointSubs: calcResult?.jointSubs || [],
                    };
                    myPlans.push(planData);
                    localStorage.setItem('he_my_plans', JSON.stringify(myPlans));
                    if (typeof setMyPlansRefresh !== 'undefined') setMyPlansRefresh((p: number) => p + 1);
                    setPlanSaved('✅ План сохранён в Мои планы');
                    setTimeout(() => setPlanSaved(''), 3000);
                  }} style={{ width:'100%', padding:'8px', borderRadius:8, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.15)', color:'#8b5cf6' }}>
                    📋 Сохранить план в Мои планы
                  </button>
                </div>
              )}
              {calcDone && (calcResult || planResult) && (
                <div style={{ marginTop:10, padding:'12px', borderRadius:10, background:'rgba(0,230,138,0.03)', border:'1px solid rgba(0,230,138,0.1)' }}>
                  {(() => {
                    const r = planResult || calcResult || {} as any;
                    const riskBefore = r.overallRiskBefore ?? r.riskBeforeSupport ?? 0;
                    const riskAfter = r.overallRiskAfter ?? r.riskAfterSupport ?? 0;
                    const score = r.coveragePercent ?? r.supportScore ?? 0;
                    const isOptimal = score > 50;
                    const isMid = score > 25;
                    return (<>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-light)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                    📊 Результат расчёта
                    {isOptimal ? <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'rgba(34,197,94,0.12)', color:'#22c55e' }}>Оптимально</span> : isMid ? <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'rgba(245,158,11,0.12)', color:'#f59e0b' }}>Средне</span> : <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'rgba(239,68,68,0.12)', color:'#ef4444' }}>Недостаточно</span>}
                  </div>
                  {(() => {
                    // Show week scale info
                    if (!planResult) return null;
                    const ws = planResult.weekScale || 1;
                    return <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center',marginBottom:6}}>
                      <span style={{fontSize:7,color:'var(--text-dim)'}}>Нед.{courseWeekState}</span>
                      {ws < 1 && <span style={{fontSize:7,padding:'1px 5px',borderRadius:3,background:'rgba(245,158,11,0.08)',color:'#f59e0b'}}>Дозы ×{ws.toFixed(1)} (адаптация)</span>}
                      {planResult.coverageGaps?.length > 0 && <span style={{fontSize:7,padding:'1px 5px',borderRadius:3,background:'rgba(239,68,68,0.08)',color:'#ef4444'}}>{planResult.coverageGaps.length} пробелов</span>}
                    </div>;
                  })()}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,padding:'8px 10px',borderRadius:8,background:'rgba(0,0,0,0.08)',border:'1px solid var(--border)'}}>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ fontSize:9, color:'var(--text-dim)' }}>Без</span>
                      <span style={{ fontSize:13, fontWeight:800, color:'#ef4444' }}>{Math.round(riskBefore)}%</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ fontSize:10, color:'var(--accent)', fontWeight:700 }}>/</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ fontSize:9, color:'var(--text-dim)' }}>С</span>
                      <span style={{ fontSize:13, fontWeight:800, color:'#22c55e' }}>{Math.round(riskAfter)}%</span>
                    </div>
                    <div style={{ padding:'2px 8px', borderRadius:6, background:'rgba(34,197,94,0.1)' }}>
                      <span style={{ fontSize:10, fontWeight:700, color:'#22c55e' }}>{Math.round(riskBefore)}/{Math.round(riskAfter)}</span>
                    </div>
                  </div>
                  {/* Peak week vs selected week info */}
                  {calcResult?.peakWeek && calcResult?.selectedWeekRaw !== undefined && (
                    <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6, display:'flex', justifyContent:'space-between', padding:'4px 8px', borderRadius:6, background:'rgba(0,0,0,0.04)' }}>
                      <span>📅 Нед. {courseWeekState}: <b style={{color:'#f59e0b'}}>{calcResult.selectedWeekRaw}%</b> → <b style={{color:'#22c55e'}}>{calcResult.selectedWeekAfter ?? 0}%</b></span>
                      <span>📈 Пик нед. {calcResult.peakWeek}: <b style={{color:'#ef4444'}}>{Math.round(riskBefore)}%</b> → <b style={{color:'#22c55e'}}>{Math.round(riskAfter)}%</b></span>
                    </div>
                  )}
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
                    <span>🔍 Детальный разбор по системам и механизмам (TZ-модель) — в калькуляторе выше, вкладка «Риск»</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, padding:'6px 10px', borderRadius:6, background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.1)' }}>
                    <span style={{ fontSize:9, color:'var(--text-dim)', minWidth:90 }}>Оценка поддержки</span>
                    <div style={{ flex:1, height:6, borderRadius:3, background:'var(--bg-secondary)', overflow:'hidden', border:'1px solid var(--border)' }}>
                      <div style={{ height:'100%', width:`${Math.min(100, score)}%`, borderRadius:3, background: isOptimal ? 'linear-gradient(90deg,#22c55e,#4ade80)' : isMid ? 'linear-gradient(90deg,#eab308,#f59e0b)' : 'linear-gradient(90deg,#ef4444,#f97316)', transition:'width 0.6s' }} />
                    </div>
                    <span style={{ fontSize:12, fontWeight:800, color:'#8b5cf6', minWidth:40, textAlign:'right' }}>{Math.round(score)}/100</span>
                  </div></>);})()}
                  {/* Recommendations based on low coverage */}
                  {calcResult && (calcResult.systemSupport || {}).cardio !== undefined && (
                    <div style={{ marginTop:6, padding:'8px 10px', borderRadius:8, background:'rgba(0,0,0,0.12)', border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>💡 Рекомендации по покрытию:</div>
                      {((calcResult.systemSupport || {}).cardio || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>💊 <b>Давление/ЧСС:</b> небилетол 5 мг или тельмисартан 40 мг</div>
                      )}
                      {((calcResult.systemSupport || {}).hepatic || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>🫁 <b>Печень:</b> NAC 1200 мг + TUDCA 500 мг (до еды)</div>
                      )}
                      {((calcResult.systemSupport || {}).renal || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>🫘 <b>Почки:</b> астрагал 1000 мг + таурин 2000 мг</div>
                      )}
                      {((calcResult.systemSupport || {}).neuro || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>🧠 <b>Нервная:</b> магний 400 мг + ашваганда 600 мг</div>
                      )}
                      {((calcResult.systemSupport || {}).endocrine || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>⚗️ <b>Эндокринная:</b> витамин D3 5000 МЕ + цинк 30 мг</div>
                      )}
                      {((calcResult.systemSupport || {}).reproductive || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>⚧ <b>Репродуктивная:</b> ХГЧ 500 МЕ 2x/нед (схема 3/1) + сабаль 640 мг</div>
                      )}
                      {((calcResult.systemSupport || {}).hematologic || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>🩸 <b>Кроветворение:</b> фолат 800 мкг + B12 1000 мкг + железо (по анализам)</div>
                      )}
                      {((calcResult.systemSupport || {}).musculoskeletal || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>🦴 <b>Опорно-двигательная:</b> коллаген 10 г + витамин C 1000 мг + глюкозамин 1500 мг</div>
                      )}
                    </div>
                  )}
                  <div style={{ padding:'6px 10px', borderRadius:6, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.12)', fontSize:10 }}>
                    <span style={{ color:'#8b5cf6', fontWeight:600 }}>⚡ Рекомендованный уровень:</span>{' '}
                    <b style={{ color:'#8b5cf6' }}>{SUPPORT_LEVELS[autoLevel as string]?.label || autoLevel}</b>
                    <span style={{ color:'var(--text-dim)', fontSize:9 }}> — {SUPPORT_LEVELS[autoLevel as string]?.desc || 'Автоматически определённый уровень поддержки'}</span>
                  </div>
                  {/* Explanation of risk calculation */}
                  <details style={{ marginTop:6 }}>
                    <summary style={{ fontSize:8, fontWeight:600, color:'var(--text-dim)', cursor:'pointer' }}>📖 Как считаются риски и оценка поддержки</summary>
                    <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.5, marginTop:4, padding:'6px 8px', borderRadius:6, background:'rgba(0,0,0,0.06)' }}>
                      <b>Риск без поддержки:</b> {Math.round(calcResult.riskBeforeSupport)}% = максимальный риск по всем системам.<br/>
                      <b>Снижение риска:</b> каждый препарат покрывает системы с {calcResult.supportScore.toFixed(0)}% эффективностью. Защита = покрытие / 100 от базового риска.<br/>
                      <b>Риск с поддержкой:</b> {Math.round(calcResult.riskAfterSupport)}% = базовый риск × (1 - защита).<br/>
                      <b>Оценка поддержки:</b> {Math.round(calcResult.supportScore)}/100 — взвешенное среднее покрытия всех систем (вес систем: сердечно-сосуд. 15, печень 15, почки 10, нейро 10, эндокринная 12, кровь 8, репродуктивная 10, опорно-двиг. 10).<br/>
                      <b>Факторы:</b> питание ×{((linked.profile?.settings?.nutritionFactor ?? 0.8) * 100).toFixed(0)}%, тренировки ×{((linked.profile?.settings?.trainingFactor ?? 0.7) * 100).toFixed(0)}% дополнительно снижают риск.
                    </div>
                  </details>
                </div>
              )}
            </div>

            {/* ===== PLAN REVIEW CARD ===== */}
            {calcDone && effectiveLevel?.subs && effectiveLevel.subs.length > 0 && (
              <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                <div onClick={() => setExpandedCategories(p => ({ ...p, calc_plan: !(p.calc_plan ?? true) }))} style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer', marginBottom: (expandedCategories.calc_plan ?? true) ? 8 : 0 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--text-light)', flex:1 }}>📋 План поддержки ({effectiveLevel.subs.length} препаратов)</span>
                  <button onClick={e => { e.stopPropagation(); setShowModal('weekSelect'); }} style={{ padding:'2px 10px', borderRadius:12, border:'1px solid rgba(0,230,138,0.2)', background:'rgba(0,230,138,0.06)', color:'var(--accent)', cursor:'pointer', fontSize:9, fontWeight:700 }}>📅 Нед. {courseWeekState}</button>
                  <span style={{ fontSize:9, color:'var(--text-dim)', transform: (expandedCategories.calc_plan ?? true) ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                </div>
                {(expandedCategories.calc_plan ?? true) && (<>

                  {/* ===== ПЕРЕЧЕНЬ ПРЕПАРАТОВ ===== */}
                  <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                      💊 Препараты плана ({effectiveLevel.subs.length})
                      {boostEnabled && <span style={{ fontSize:8, padding:'1px 6px', borderRadius:4, background:'rgba(239,68,68,0.12)', color:'#ef4444' }}>🔥 Усиление</span>}
                      {jointMode && <span style={{ fontSize:8, padding:'1px 6px', borderRadius:4, background:'rgba(139,92,246,0.12)', color:'#8b5cf6' }}>🦴 Суставы</span>}
                      {neuroMode && <span style={{ fontSize:8, padding:'1px 6px', borderRadius:4, background:'rgba(20,184,166,0.12)', color:'#14b8a6' }}>🧠 Нейропрот.</span>}
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {effectiveLevel.subs.map((id: string) => {
                        const entry = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
                        const name = entry?.nameRu || entry?.name || id;
                        const dose = effectiveLevel?.dosages?.[id];
                        const doseStr = dose ? (dose.mg >= 1000 ? `${(dose.mg/1000).toFixed(1)} г` : `${dose.mg} мг`) : (entry?.dosage?.mg ? (entry.dosage.mg >= 1000 ? `${(entry.dosage.mg/1000).toFixed(1)} г` : `${entry.dosage.mg} мг`) : '');
                        const cat = entry?.category?.[0] || '';
                        const tierColors: Record<string,string> = { core:'#22c55e', standard:'#f59e0b', advanced:'#f97316', specialty:'#ef4444' };
                        const tier = entry?.tier || 'standard';
                        return (
                          <span key={id} style={{ fontSize:8, padding:'3px 8px', borderRadius:6, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.1)', color:'var(--text-light)', display:'flex', alignItems:'center', gap:3 }}>
                            <span style={{ width:5, height:5, borderRadius:'50%', background: tierColors[tier] || '#888', flexShrink:0 }} />
                            {name}
                            {doseStr && <span style={{ color:'var(--text-dim)' }}>{doseStr}</span>}
                          </span>
                        );
                      })}
                    </div>
                    <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:4, display:'flex', gap:8 }}>
                      <span>🟢 core</span><span>🟡 standard</span><span>🟠 advanced</span><span>🔴 specialty</span>
                    </div>
                  </div>

                  {(!linked.course || linked.course.length === 0) && (
                    <div style={{marginBottom:10,padding:'10px 12px',borderRadius:10,background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.2)'}}>
                      <div style={{fontSize:10,fontWeight:700,color:'#f59e0b',marginBottom:4}}>⚠️ Нет данных о курсе</div>
                      <div style={{fontSize:8,color:'var(--text-dim)',lineHeight:1.4}}>Заполните <b>💉 Фарма стек</b> в AutoCalculator и <b>🧪 Лабораторию</b> для точного подбора с учётом реальных рисков.</div>
                    </div>
                  )}
                  {supportPhase !== 'course' && (
                    <div style={{marginBottom:10,padding:'10px 12px',borderRadius:10,background:'rgba(139,92,246,0.05)',border:'1px solid rgba(139,92,246,0.15)'}}>
                      <div style={{fontSize:10,fontWeight:700,color:'#8b5cf6',marginBottom:4}}>{supportPhase==='bridge'?'🌉 Фаза: МОСТ':supportPhase==='pct'?'🔄 Фаза: ПКТ':'⚧ Фаза: Фертильность'}</div>
                      <div style={{fontSize:8,color:'var(--text-dim)',lineHeight:1.4}}>{supportPhase==='bridge'?'Приоритет: восстановление ГГЯ, поддержка печени. Дозы NAC/TUDCA снижены, ашваганда/B12 усилены.':supportPhase==='pct'?'Приоритет: HPTA, сперматогенез. Телмисартан/небиволол исключены. Цинк×2, D3×1.5.':'Приоритет: качество спермы. Исключены ХГЧ/телмисартан/берберин. Цинк×2, Q10×1.5.'}</div>
                    </div>
                  )}
                  {/* ⚠️ Карточка предупреждения о недостаточности */}
                  {calcResult && (() => {
                    try {
                      const h = hydrateState();
                      const st = { ...h, powerLevel: supportLevel as PowerLevel, courseWeek: courseWeekState } as CalculatorState;
                      const recs = evaluateRecommendations(st, calcResult as any, courseWeekState);
                      const coverageWarn = computeCoverageRisk(recs, supportLevel, st, calcResult as any);
                      if (!coverageWarn.warning) return null;
                      return (
                        <div style={{ marginBottom:8, padding:'10px 12px', borderRadius:10, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                            <span style={{ fontSize:14 }}>⚠️</span>
                            <span style={{ fontSize:10, fontWeight:700, color:'#ef4444' }}>Недостаточный уровень поддержки</span>
                          </div>
                          <div style={{ fontSize:8, color:'#ef4444', marginBottom:4, lineHeight:1.4 }}>{coverageWarn.warning}</div>
                          <div style={{ display:'flex', gap:4, fontSize:7, color:'var(--text-dim)' }}>
                            <span>Риск: <b>{coverageWarn.riskBefore}%</b> → <b style={{color:'#ef4444'}}>{coverageWarn.riskAfter}%</b></span>
                            <span>· Покрытие: <b>{coverageWarn.avgCoverage}%</b></span>
                            <span>· Синергия: <b>{coverageWarn.synergyScore}%</b></span>
                          </div>
                          {supportLevel !== 'boost' && (
                            <button onClick={() => { setManualLevelSelected(true); setSupportLevel('boost'); setPlanSaved(false); calcSupport('boost'); }} style={{
                              marginTop:6, padding:'6px 14px', borderRadius:6, fontSize:9, fontWeight:700, cursor:'pointer',
                              background:'rgba(239,68,68,0.12)', border:'1px solid #ef4444', color:'#ef4444',
                            }}>
                              💎 Повысить до Буст
                            </button>
                          )}
                        </div>
                      );
                    } catch { return null; }
                  })()}

                  {/* 🧠 Карточка логики назначения — перед планом */}
                  {calcResult && (() => {
                    try {
                      const h = hydrateState();
                      const st = { ...h, powerLevel: supportLevel as PowerLevel, courseWeek: courseWeekState } as CalculatorState;
                      const recs = evaluateRecommendations(st, calcResult as any, courseWeekState);
                      const preApply = buildPreApplyCard(recs, st as any);
                      if (preApply.lines.length === 0) return null;
                      return (
                        <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10, background:'rgba(0,230,138,0.03)', border:'1px solid rgba(0,230,138,0.12)' }}>
                          <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)', marginBottom:6 }}>🧠 Почему назначены эти препараты</div>
                          <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:'40vh', overflowY:'auto' }}>
                            {preApply.lines.map((line: any, i: any) => (
                              <div key={i} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(0,0,0,0.08)', border:'1px solid var(--border)', fontSize:8 }}>
                                <div style={{ fontWeight:700, color:'var(--text-light)', marginBottom:2 }}>{line.problem}</div>
                                <div style={{ color:'var(--accent)', fontWeight:600, marginBottom:1 }}>{line.primarySubs}</div>
                                {line.riskCoverage && <div style={{ color:'var(--text-dim)', fontSize:7, marginBottom:1 }}>{line.riskCoverage}</div>}
                                {line.escalation && <div style={{ color:'#f59e0b', fontSize:7, marginTop:1 }}>⚠ {line.escalation}</div>}
                                {line.monitoring && <div style={{ color:'#60a5fa', fontSize:7, marginTop:1 }}>📊 {line.monitoring}</div>}
                              </div>
                            ))}
                          </div>
                          <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:4, padding:'3px 6px', borderRadius:4, background:'rgba(0,0,0,0.04)' }}>{preApply.summary}</div>
                        </div>
                      );
                    } catch { return null; }
                  })()}

                  {/* ===== COVERAGE GAUGE ===== */}
                  {planResult && (
                    <div style={{ marginBottom:10, padding:'8px 12px', borderRadius:10, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)', textAlign:'center' }}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}><span style={{fontSize:9,fontWeight:700,color:'var(--accent)'}}>Покрытие рисков</span><span style={{fontSize:7,color:'var(--text-dim)'}}>Нед.{courseWeekState} · ×{planResult.weekScale.toFixed(1)}</span></div>
                      <div style={{ position:'relative', height:10, borderRadius:5, background:'rgba(255,255,255,0.06)', overflow:'hidden', marginBottom:4 }}>
                        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${planResult.coveragePercent}%`, borderRadius:5, background:`linear-gradient(90deg, #ef4444, #f59e0b ${40}%, #22c55e)`, transition:'width 0.5s' }} />
                      </div>
                      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, fontSize:7, color:'var(--text-dim)' }}>
                        <span style={{fontSize:10,fontWeight:800,color:'var(--accent)'}}>{planResult.coveragePercent}%</span>
                        <span>покрытие систем</span>
                      </div>
                      {courseWeekState <= 6 && (<div style={{fontSize:7,color:'#f59e0b',marginTop:3,padding:'3px 6px',borderRadius:4,background:'rgba(245,158,11,0.06)'}}>⚠ Дозы снижены на {Math.round((1-planResult.weekScale)*100)}% — фаза адаптации (нед.{courseWeekState}). К неделе 7 — полные дозы.</div>)}
                    </div>
                  )}
                  {/* ===== WEEKLY PLAN VIEW (S4) ===== */}
                  {planResult && planResult.schedule && planResult.schedule.length > 0 && (
                    <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)' }}>
                      <WeeklyPlanView planResult={planResult} courseWeek={courseWeekState} />
                    </div>
                  )}

                  {/* ===== ОПИСАНИЕ МЕТОДОЛОГИИ ===== */}
                  <details style={{ marginBottom:10 }}>
                    <summary style={{ fontSize:10, fontWeight:700, color:'var(--accent)', cursor:'pointer', padding:'6px 10px', borderRadius:8, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.1)' }}>
                      📖 Как работает подбор поддержки
                    </summary>
                    <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.6, marginTop:6, padding:'10px 12px', borderRadius:8, background:'rgba(0,0,0,0.06)' }}>
                      <div style={{ marginBottom:6 }}>
                        <b style={{ color:'#00e68a' }}>1. Обязательные препараты:</b> ХГЧ (при ААС — поддержка HPTA), анастрозол (при ароматизирующихся — контроль E2), каберголин (при трен/нандролон — контроль пролактина). На всех уровнях.
                      </div>
                      <div style={{ marginBottom:6 }}>
                        <b style={{ color:'#00e68a' }}>2. Рекомендации по анализам:</b> отклонения маркеров (АЛТ, ЛПНП, HCT, E2 и др.) → авто-добавление корректирующих веществ.
                      </div>
                      <div style={{ marginBottom:6 }}>
                        <b style={{ color:'#00e68a' }}>3. Broad-spectrum (широкий спектр):</b> отбор веществ с максимальным покрытием механизмов (NAC, магний, D3, омега-3, CoQ10) — закрывают несколько систем одновременно.
                      </div>
                      <div style={{ marginBottom:6 }}>
                        <b style={{ color:'#00e68a' }}>4. Targeted (точечное усиление):</b> для каждой системы с риском {'>'} целевого — 1-5 веществ (по уровню) с максимальным k (коэффициентом защиты).
                      </div>
                      <div style={{ marginBottom:6 }}>
                        <b style={{ color:'#00e68a' }}>5. Gap-filling:</b> после отбора пересчитываем риск; если система всё ещё {'>'} целевого — добавляем ещё вещества (до maxPerSystem).
                      </div>
                      <div style={{ marginBottom:6, padding:'6px 8px', borderRadius:6, background:'rgba(0,0,0,0.1)' }}>
                        <b>Уровни и целевой риск:</b><br/>
                        🟢 База 55-65% · 2/систему<br/>
                        🟡 Средний 45-55% · 3/систему<br/>
                        🟠 Максимум 30-45% · 4/систему<br/>
                        🔴 Буст 15-30% · 5/систему<br/>
                        🔥 Усиление: target -5%, max +1/систему<br/>
                        🦴 Суставы: отдельный стек, не влияет на расчёт риска<br/>
                        🧠 Нейропротекция: добавляет ноотропы/нейропротекторы
                      </div>
                      <div>
                        <b style={{ color:'#f59e0b' }}>Логика препаратов:</b> пероральные 17α-алкилированные → усиленная гепатопротекция (TUDCA + NAC + силимарин); тренболон → контроль пролактина + нейропротекция; тестостерон → контроль E2 + HCT; нандролон → контроль пролактина.
                      </div>
                    </div>
                  </details>

                  {/* ===== ADD SUBSTANCE SEARCH ===== */}
                  <div style={{marginBottom:10}}>
                    <input type="text" placeholder="+ Добавить вещество (поиск по каталогу)..." value={subSearch} onChange={e => setSubSearch(e.target.value)}
                      style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)',fontSize:9,outline:'none'}} />
                    {subSearch.length >= 2 && (
                      <div style={{maxHeight:'20vh',overflowY:'auto',display:'flex',flexWrap:'wrap',gap:3,marginTop:4}}>
                        {(() => {
                          const q=subSearch.toLowerCase();const seen=new Set();const results=[];
                          for(const k of Object.keys(SUPPORT_CATALOG_DATA)){if(k.length>30||seen.has(k.toLowerCase()))continue;seen.add(k.toLowerCase());const e=SUPPORT_CATALOG_DATA[k];if(!e)continue;if((e.nameRu||e.name||k).toLowerCase().includes(q))results.push({id:k,name:e.nameRu||e.name||k,tier:e.tier||'—'});}
                          return results.slice(0,14).map(({id, name, tier}: any) =>{const inPlan=effectiveLevel?.subs?.includes(id)||enhancedSubs?.includes(id);const tc={core:'#22c55e',standard:'#f59e0b',advanced:'#f97316',specialty:'#ef4444'};
                            return <div key={id} onClick={()=>{if(!inPlan){setEnhancedSubs(p=>[...p,id]);setSubSearch('');showToast('+ '+name,'success');}}} style={{padding:'5px 10px',borderRadius:8,fontSize:8,cursor:inPlan?'default':'pointer',opacity:inPlan?0.5:1,background:inPlan?'rgba(0,230,138,0.08)':'rgba(255,255,255,0.03)',border:'1px solid '+(inPlan?'rgba(0,230,138,0.2)':'var(--border)'),color:inPlan?'var(--accent)':'var(--text-light)',display:'flex',gap:4,alignItems:'center'}}><span style={{flex:1}}>{name}</span><span style={{padding:'1px 5px',borderRadius:3,fontSize:6,fontWeight:600,background:(tc[tier]||'#fff')+'18',color:tc[tier]||'var(--text-dim)'}}>{inPlan?'✓':tier}</span></div>;});})()}
                      </div>
                    )}
                  </div>

                  {/* ===== SUBSTANCE DETAIL LIST (D3: click to expand) ===== */}
                  {(() => {
                    // Sort subs by time of day (morning → afternoon → evening → other)
                    const sortOrder: Record<string, number> = { утро: 0, 'утро,': 0, натощак: 0, день: 1, обед: 1, вечер: 2, 'на ночь': 2, ночь: 2 };
                    const timedSubs = [...(effectiveLevel?.subs || [])].sort((a: any, b: any) => {
                      const ta = effectiveLevel?.dosages?.[a]?.timing?.toLowerCase() || '';
                      const tb = effectiveLevel?.dosages?.[b]?.timing?.toLowerCase() || '';
                      const sa = Object.entries(sortOrder).find(([k]: [string, any]) => ta.includes(k))?.[1] ?? 3;
                      const sb = Object.entries(sortOrder).find(([k]: [string, any]) => tb.includes(k))?.[1] ?? 3;
                      return sa - sb;
                    });
                    return (
                    <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:'40vh', overflowY:'auto', marginBottom:8 }}>
                      {timedSubs.map((id: string) => {
                      const sub = allSupport.find((s: any) => s.id === id);
                      const d = effectiveLevel?.dosages?.[id];
                      const planInfo = planResult?.substances?.find((s: PlanSubstance) => s.id === id);
                      const catalogEntry = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
                      const isExpanded = expandedCategories[id];
                      return sub ? (
                        <div key={id} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)', fontSize:9, cursor:'pointer' }}
                          onClick={() => setExpandedCategories(p => ({ ...p, [id]: !p[id] }))}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                              <span style={{ fontSize:10, transform: isExpanded ? 'rotate(90deg)':'none', transition:'0.2s' }}>▶</span>
                              <span style={{ fontWeight:600, color:'var(--text-light)' }}>{sub.name}</span>
                            </div>
                            <div style={{ display:'flex', gap:2, alignItems:'center' }}>
                              {d && <span style={{ color:'#00e68a', fontSize:8, fontWeight:600 }}>{d.mg >= 5000 ? `${(d.mg/1000).toFixed(1)} г` : `${d.mg} мг`} — {d.timing}</span>}
                              <span onClick={(e) => {
                                e.stopPropagation();
                                // Find analogs and offer replacement via search pre-fill
                                const analogs = catalogEntry?.analog || [];
                                if (analogs.length > 0) {
                                  // Replace with first analog directly
                                  const analog = analogs[0];
                                  const analogEntry = SUPPORT_CATALOG_DATA[analog] || SUPPORT_CATALOG_DATA[analog.toUpperCase()];
                                  if (analogEntry) {
                                    setEnhancedSubs(prev => {
                                      const next = prev.filter((s: any) => s !== id);
                                      if (!next.includes(analog)) next.push(analog);
                                      return next;
                                    });
                                    showToast(`🔁 ${sub.name} → ${analogEntry.nameRu || analogEntry.name}`, 'success');
                                  }
                                } else {
                                  // No known analog — open search for this substance
                                  const subName = (sub.name || id).toLowerCase();
                                  setSubSearch(subName);
                                  showToast('🔍 Введите аналог в поиске', 'warning');
                                }
                              }} style={{ cursor:'pointer', fontSize:10, color:'#818cf8', padding:'0 4px', lineHeight:1 }} title="Заменить аналогом">🔁</span>
                              <span onClick={(e) => { e.stopPropagation(); setEnhancedSubs(prev => prev.filter((s: any) => s !== id)); }} style={{ cursor:'pointer', fontSize:10, color:'#ef4444', padding:'0 4px', lineHeight:1 }} title="Удалить из плана">✕</span>
                            </div>
                          </div>
                          {planInfo?.comment && !isExpanded && (
                            <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.3, paddingLeft:4, borderLeft:'2px solid rgba(0,230,138,0.3)' }}>
                              {planInfo.comment.split(';')[0]}
                              {planResult?.mechanisms && (
                                (() => {
                                  const coveredMechs = planResult.mechanisms.filter((m: any) => (m.substances || []).includes(id));
                                  if (coveredMechs.length > 0) {
                                    return <span style={{ color:'#60a5fa', marginLeft:4 }}>({coveredMechs.length} мех.)</span>;
                                  }
                                  return null;
                                })()
                              )}
                            </div>
                          )}
                          {/* D3: Expanded detail card */}
                          {isExpanded && (
                            <div style={{ marginTop:6, padding:'8px', borderRadius:6, background:'rgba(0,0,0,0.08)', fontSize:8, lineHeight:1.4 }}>
                              {planInfo?.comment && (
                                <div style={{ marginBottom:4 }}>
                                  <span style={{ fontWeight:600, color:'var(--accent)' }}>Назначение: </span>
                                  <span style={{ color:'var(--text-dim)' }}>{planInfo.comment}</span>
                                </div>
                              )}
                              {/* Why this substance — tie breaker info */}
                              <div style={{ marginBottom:4, display:'flex', flexWrap:'wrap', gap:3 }}>
                                {(() => {
                                  const mechCount = planResult?.mechanisms?.filter((m: any) => (m.substances || []).includes(id)).length || 0;
                                  if (!mechCount) return null;
                                  return <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(96,165,250,0.08)', color:'#60a5fa' }}>
                                    {mechCount} механизмов
                                  </span>;
                                })()}
                                {planInfo?.fromJoint && <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(139,92,246,0.08)', color:'#8b5cf6' }}>Суставы 🦴</span>}
                                {planInfo?.fromBoost && <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(239,68,68,0.08)', color:'#ef4444' }}>Усиление 🔥</span>}
                                {planInfo?.fromNeuro && <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(59,130,246,0.08)', color:'#3b82f6' }}>Нейро 🧠</span>}
                                {/* Count synergy partners in current plan */}
                                {(() => {
                                  if (!catalogEntry?.synergies) return null;
                                  const planIds = new Set(effectiveLevel?.subs || []);
                                  const partners = catalogEntry.synergies.filter((s: any) => planIds.has(s.with));
                                  if (!partners.length) return null;
                                  return <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(34,197,94,0.08)', color:'#22c55e' }}>
                                    ⊕ {partners.length} синергий в плане
                                  </span>;
                                })()}
                                {catalogEntry?.analog?.length ? (
                                  <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(129,140,248,0.08)', color:'#818cf8' }}>
                                    {catalogEntry.analog.length} аналогов
                                  </span>
                                ) : null}
                              </div>
                              {catalogEntry?.mechanismOfAction && (
                                <div style={{ marginBottom:4 }}>
                                  <span style={{ fontWeight:600, color:'#8b5cf6' }}>Механизм: </span>
                                  <span style={{ color:'var(--text-dim)' }}>{catalogEntry.mechanismOfAction}</span>
                                </div>
                              )}
                              {planResult?.mechanisms && (() => {
                                const mechsForSub = planResult.mechanisms.filter((m: any) => (m.substances || []).includes(id));
                                if (mechsForSub.length === 0) return null;
                                return (
                                  <div style={{ marginBottom:4 }}>
                                    <span style={{ fontWeight:600, color:'#60a5fa' }}>Покрывает механизмы: </span>
                                    <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                                      {mechsForSub.map((m: any, i: number) => (
                                        <span key={i} style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(96,165,250,0.08)', color:'#60a5fa' }}>
                                          {m.systemLabel ? `${m.systemLabel}: ` : ''}{m.mechLabel || m.mechKey}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                              {catalogEntry?.clinicalEffect && (
                                <div style={{ marginBottom:4 }}>
                                  <span style={{ fontWeight:600, color:'#22c55e' }}>Эффект: </span>
                                  <span style={{ color:'var(--text-dim)' }}>{catalogEntry.clinicalEffect}</span>
                                </div>
                              )}
                              {catalogEntry?.description && (<div style={{marginBottom:4}}><span style={{fontWeight:600,color:'#f59e0b',fontSize:7}}>Описание: </span><span style={{color:'var(--text-dim)',fontSize:7,lineHeight:1.3}}>{catalogEntry.description}</span></div>)}
                              {catalogEntry?.forms && catalogEntry.forms.length>0 && (<div style={{marginBottom:4}}><span style={{fontWeight:600,color:'#f59e0b',fontSize:7}}>Формы выпуска: </span>{catalogEntry.forms.map((f: any, i: any) =><span key={i} style={{fontSize:6,color:f.best?'#22c55e':'var(--text-dim)',marginLeft:4}}>{f.best?'★ ':''}{f.nameRu||f.name} ({f.dose})</span>)}</div>)}
                              {catalogEntry?.organs && catalogEntry.organs.length>0 && (<div style={{marginBottom:4}}><span style={{fontWeight:600,color:'#60a5fa',fontSize:7}}>Органы: </span><span style={{fontSize:6,color:'var(--text-dim)'}}>{catalogEntry.organs.join(', ')}</span></div>)}
                              {catalogEntry?.systems && catalogEntry.systems.length>0 && (<div style={{marginBottom:4}}><span style={{fontWeight:600,color:'#8b5cf6',fontSize:7}}>Системы: </span><span style={{fontSize:6,color:'var(--text-dim)'}}>{catalogEntry.systems.join(', ')}</span></div>)}
                              {catalogEntry?.sideEffects && catalogEntry.sideEffects.length>0 && (<div style={{marginBottom:4}}><span style={{fontWeight:600,color:'#ef4444',fontSize:7}}>Побочные: </span><span style={{color:'#ef4444',fontSize:6}}>{catalogEntry.sideEffects.slice(0,4).join('; ')}</span></div>)}
                              {catalogEntry?.monitoring && catalogEntry.monitoring.length>0 && (<div style={{marginBottom:4}}><span style={{fontWeight:600,color:'#60a5fa',fontSize:7}}>Мониторинг: </span><div style={{display:'flex',flexDirection:'column',gap:1,marginTop:2}}>{catalogEntry.monitoring.map((m:any,i:number)=><div key={i} style={{fontSize:7,padding:'2px 6px',borderRadius:4,background:'rgba(96,165,250,0.04)',display:'flex',gap:4}}><span style={{color:'#60a5fa',fontWeight:600}}>{m.what}</span><span style={{color:'var(--text-dim)'}}>— {m.when}</span>{m.targetRange&&<span style={{color:'#f59e0b'}}>→ {m.targetRange}</span>}</div>)}</div></div>)}
                              {catalogEntry?.dosage && (<div style={{marginBottom:4}}><span style={{fontWeight:600,color:'var(--accent)',fontSize:7}}>Дозировка: </span><span style={{fontSize:6,color:'var(--text-dim)'}}>{catalogEntry.dosage.mg}мг — {catalogEntry.dosage.timing}{catalogEntry.dosage.form?' ('+catalogEntry.dosage.form+')':''}</span></div>)}
                              {/* Evidence-based dosage calculator for this substance */}
                              {(() => {
                                const evDosageKey = `ev_${id}`;
                                const isDosageOpen = expandedCategories[evDosageKey];
                                return (
                                  <div style={{marginBottom:4}}>
                                    <button onClick={(e) => { e.stopPropagation(); setExpandedCategories(p => ({...p, [evDosageKey]: !p[evDosageKey]})); }} style={{
                                      width:'100', padding:'4px 8px', borderRadius:6, cursor:'pointer',
                                      background: isDosageOpen ? 'rgba(0,230,138,0.08)' : 'rgba(96,165,250,0.04)',
                                      border: '1px solid ' + (isDosageOpen ? 'rgba(0,230,138,0.2)' : 'rgba(96,165,250,0.1)'),
                                      color: isDosageOpen ? 'var(--accent)' : '#60a5fa',
                                      fontWeight:600, fontSize:7, display:'flex', alignItems:'center', gap:4, justifyContent:'center',
                                    }}>
                                      <span>{isDosageOpen ? '📋' : '📋'}</span>
                                      {isDosageOpen ? 'Дозировка (источники) ▲' : 'Клинически обоснованная дозировка 📋'}
                                    </button>
                                    {isDosageOpen && (
                                      <div onClick={(e) => e.stopPropagation()}>
                                        <DosageCalculator substanceId={id} substanceName={sub.name} phase={supportPhase} bodyWeight={linked.profile?.settings?.weight || undefined} />
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                              {catalogEntry?.specialInstructions && catalogEntry.specialInstructions.length > 0 && (<div style={{marginBottom:4}}><span style={{fontWeight:600,color:'#f59e0b',fontSize:7}}>Особые указания: </span><div style={{display:'flex',flexDirection:'column',gap:1,marginTop:2}}>{catalogEntry.specialInstructions.map((si: string, i: number) => <div key={i} style={{fontSize:7,padding:'2px 6px',borderRadius:4,background:'rgba(245,158,11,0.04)',color:'var(--text-dim)'}}>• {si}</div>)}</div></div>)}
                              {catalogEntry?.targetOrgan && (<div style={{marginBottom:4}}><span style={{fontWeight:600,color:'#8b5cf6',fontSize:7}}>Орган-мишень: </span><span style={{fontSize:6,color:'var(--text-dim)'}}>{catalogEntry.targetOrgan}</span></div>)}
                              {catalogEntry?.bestForm && (
                                <div style={{ marginBottom:4 }}>
                                  <span style={{ fontWeight:600, color:'#f59e0b' }}>Лучшая форма: </span>
                                  <span style={{ color:'var(--text-dim)' }}>{catalogEntry.bestForm}</span>
                                </div>
                              )}
                              {catalogEntry?.synergies && catalogEntry.synergies.length > 0 && (
                                <div style={{ marginBottom:4 }}>
                                  <span style={{ fontWeight:600, color:'#22c55e' }}>Синергии: </span>
                                  <div style={{ display:'flex', flexDirection:'column', gap:1, marginTop:2 }}>
                                    {catalogEntry.synergies.map((syn: any, i: number) => {
                                      const synName = syn.with;
                                      const synEntry = SUPPORT_CATALOG_DATA[synName] || SUPPORT_CATALOG_DATA[synName.toUpperCase()];
                                      const displayName = synEntry?.nameRu || synEntry?.name || synName;
                                      const sevColor = syn.severity === 'HIGH' ? '#22c55e' : syn.severity === 'MEDIUM' ? '#eab308' : '#6b7280';
                                      return (
                                        <div key={i} style={{ fontSize:7, padding:'3px 6px', borderRadius:4, background:'rgba(34,197,94,0.04)', display:'flex', gap:4 }}>
                                          <span style={{ color:'#22c55e', fontWeight:600, minWidth:50 }}>⊕ {displayName}</span>
                                          <span style={{ color:'var(--text-dim)', flex:1 }}>{syn.effect}</span>
                                          <span style={{ color:sevColor, fontWeight:600, fontSize:6 }}>{syn.severity}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {catalogEntry?.contraindications && catalogEntry.contraindications.length > 0 && (
                                <div style={{marginBottom:4}}>
                                  <span style={{ fontWeight:600, color:'#ef4444', fontSize:7 }}>Противопоказания: </span>
                                  <div style={{display:'flex',flexWrap:'wrap',gap:2,marginTop:1}}>
                                    {catalogEntry.contraindications.map((c: string, i: number) => (
                                      <span key={i} style={{fontSize:6,padding:'1px 5px',borderRadius:3,background:'rgba(239,68,68,0.08)',color:'#ef4444'}}>{c}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {catalogEntry?.conflicts && catalogEntry.conflicts.length > 0 && (
                                <div style={{marginBottom:4}}>
                                  <span style={{ fontWeight:600, color:'#ef4444', fontSize:7 }}>Конфликты: </span>
                                  <div style={{display:'flex',flexDirection:'column',gap:1,marginTop:2}}>
                                    {catalogEntry.conflicts.map((c: any, i: number) => (
                                      <div key={i} style={{fontSize:7,padding:'2px 6px',borderRadius:4,background:'rgba(239,68,68,0.04)',display:'flex',gap:4}}>
                                        <span style={{color:'#ef4444',fontWeight:600,minWidth:50}}>⊖ {c.with}</span>
                                        <span style={{color:'var(--text-dim)',flex:1}}>{c.effect}</span>
                                        <span style={{color:c.severity==='HIGH'?'#ef4444':c.severity==='MEDIUM'?'#eab308':'#6b7280',fontWeight:600,fontSize:6}}>{c.severity}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {catalogEntry?.cautions && catalogEntry.cautions.length > 0 && (
                                <div style={{marginBottom:4}}>
                                  <span style={{ fontWeight:600, color:'#f59e0b', fontSize:7 }}>Осторожности: </span>
                                  <div style={{display:'flex',flexDirection:'column',gap:1,marginTop:2}}>
                                    {catalogEntry.cautions.map((c: any, i: number) => (
                                      <div key={i} style={{fontSize:7,padding:'2px 6px',borderRadius:4,background:'rgba(245,158,11,0.04)',display:'flex',gap:4}}>
                                        <span style={{color:'#f59e0b',fontWeight:600,minWidth:50}}>⚠ {c.with}</span>
                                        <span style={{color:'var(--text-dim)',flex:1}}>{c.effect}</span>
                                        <span style={{color:c.severity==='HIGH'?'#f59e0b':c.severity==='MEDIUM'?'#eab308':'#6b7280',fontWeight:600,fontSize:6}}>{c.severity}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : null;
                    })}
                  </div>
                    );
                  })()}

                  {/* ===== STACK SYNERGY SCORE + STRUCTURED INTERACTIONS ===== */}
                  {(() => {
                    const planIds = (calcResult?.selectedSubstances || effectiveLevel?.subs || []) as string[];
                    if (!planIds || planIds.length < 2) return null;
                    const stackScore = calcStackSynergyScore(planIds);
                    const planCautions = buildCautions(planIds);
                    const planConflicts = (planResult?.conflicts || []);
                    const levelColors: Record<string, string> = { excellent:'#22c55e', good:'#4ade80', moderate:'#f59e0b', poor:'#ef4444', risky:'#dc2626' };
                    const levelLabels: Record<string, string> = { excellent:'Отлично', good:'Хорошо', moderate:'Умеренно', poor:'Плохо', risky:'Рискованно' };
                    const syns = stackScore.matrix.filter((m: any) => m.type === 'synergy');
                    const confs = stackScore.matrix.filter((m: any) => m.type === 'conflict');
                    const cauts = stackScore.matrix.filter((m: any) => m.type === 'caution');
                    const synList = syns.length > 0 ? syns : [];
                    const confList = confs.length > 0 ? confs : (planConflicts || []);
                    const cautList = cauts.length > 0 ? cauts : (planCautions || []);
                    return (
                      <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10, background:'rgba(0,230,138,0.03)', border:`2px solid ${levelColors[stackScore.level]}33` }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                          <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)' }}>⚡ Совместимость стека</div>
                          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <span style={{ fontSize:16, fontWeight:800, color:levelColors[stackScore.level] }}>{stackScore.score}</span>
                            <span style={{ fontSize:7, color:'var(--text-dim)' }}>/ 100</span>
                            <span style={{ fontSize:7, padding:'1px 6px', borderRadius:4, background:levelColors[stackScore.level]+'22', color:levelColors[stackScore.level], fontWeight:700 }}>{levelLabels[stackScore.level]}</span>
                          </div>
                        </div>
                        <div style={{ height:4, borderRadius:2, background:'rgba(255,255,255,0.06)', overflow:'hidden', marginBottom:6 }}>
                          <div style={{ width:stackScore.score+'%', height:'100%', background:levelColors[stackScore.level], borderRadius:2, transition:'width 0.3s' }} />
                        </div>
                        <div style={{ display:'flex', gap:6, fontSize:7, marginBottom:6, flexWrap:'wrap' }}>
                          <span style={{ color:'#22c55e', fontWeight:600 }}>⊕ {stackScore.synergies} синергий</span>
                          <span style={{ color:'#ef4444', fontWeight:600 }}>⊖ {stackScore.conflicts} конфликтов</span>
                          <span style={{ color:'#f59e0b', fontWeight:600 }}>⚠ {stackScore.cautions} осторожностей</span>
                          <span style={{ color:'var(--text-dim)' }}>??? {stackScore.unknownPairs} неизвестно</span>
                        </div>
                        {planResult?.synergyComment && (
                          <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.5, whiteSpace:'pre-line', marginBottom:6, padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.02)' }}>
                            {planResult.synergyComment}
                          </div>
                        )}
                        {synList.length > 0 && (() => {
                          const sections = [
                            { list: synList, label: 'Синергии', color: '#22c55e', emoji: '⊕' },
                            { list: confList, label: 'Конфликты', color: '#ef4444', emoji: '⊖' },
                            { list: cautList, label: 'Осторожности', color: '#f59e0b', emoji: '⚠' },
                          ];
                          return sections.filter(sec => sec.list.length > 0).map((sec, si) => (
                            <div key={si} style={{ marginBottom:4 }}>
                              <div style={{ fontSize:8, fontWeight:700, color:sec.color, marginBottom:2 }}>{sec.emoji} {sec.label} ({sec.list.length})</div>
                              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                                {(sec.list as any[]).slice(0, 8).map((item: any, ii: number) => (
                                  <div key={ii} style={{ display:'flex', gap:4, fontSize:7, padding:'3px 6px', borderRadius:4, background:sec.color+'06', alignItems:'center' }}>
                                    <span style={{ color:sec.color, fontWeight:600, minWidth:60 }}>{item.aName || item.a || '?'} + {item.bName || item.b || '?'}</span>
                                    <span style={{ color:'var(--text-dim)', flex:1 }}>{item.effect || ''}</span>
                                    {item.severity && <span style={{ fontSize:6, padding:'0 3px', borderRadius:2, background:sec.color+'15', color:sec.color, fontWeight:600 }}>{item.severity}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    );
                  })()}

                  {/* ===== DOSAGE CALCULATOR BUTTON ===== */}
                  {calcDone && effectiveLevel?.subs && effectiveLevel.subs.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <button onClick={() => setExpandedCategories(p => ({ ...p, dosage_calc: !(p.dosage_calc ?? false) }))} style={{
                        width: '100%', padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                        background: expandedCategories.dosage_calc ? 'rgba(0,230,138,0.1)' : 'rgba(96,165,250,0.06)',
                        border: expandedCategories.dosage_calc ? '2px solid rgba(0,230,138,0.3)' : '1px solid rgba(96,165,250,0.2)',
                        color: expandedCategories.dosage_calc ? 'var(--accent)' : '#60a5fa',
                        fontWeight: 700, fontSize: 10, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
                      }}>
                        <span>{expandedCategories.dosage_calc ? '📋' : '📋'}</span>
                        {expandedCategories.dosage_calc ? 'Калькулятор дозировок ▲' : 'Калькулятор дозировок (NIH ODS, FDA, EMA, ESC/ESH)'}
                      </button>
                      {expandedCategories.dosage_calc && (
                        <div style={{ maxHeight: '60vh', overflowY: 'auto', marginTop: 6 }}>
                          <DosageCalculatorView
                            subs={(effectiveLevel.subs || []).map((id: string) => {
                              const entry = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
                              return { id, name: entry?.nameRu || entry?.name || id };
                            })}
                            phase={supportPhase}
                            bodyWeight={linked.profile?.settings?.weight || undefined}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* ===== SYNERGY RECOMMENDATIONS (what-if) ===== */}
                  {calcResult?.synergyRecommendations && calcResult.synergyRecommendations.length > 0 && (() => {
                    const recs = calcResult.synergyRecommendations;
                    const planIds = new Set((calcResult.selectedSubstances || []).map((id: string) => id));
                    const sevColor: Record<string, string> = { HIGH: '#22c55e', MEDIUM: '#f59e0b', LOW: '#6b7280' };
                    return (
                      <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(168,85,247,0.03)', border: '1px solid rgba(168,85,247,0.15)' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>
                          🔮 Рекомендации для усиления синергии
                        </div>
                        <div style={{ fontSize: 7, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.4 }}>
                          Что-if анализ: добавление этих веществ в план увеличит синергию и/или покрытие систем.
                          Нажмите «+ Добавить» для включения в план.
                        </div>
                        {recs.map((rec: any, i: number) => {
                          const synNames = rec.synergiesWith
                            .map((id: string) => {
                              const cat = SUPPORT_CATALOG_DATA[id];
                              return cat?.name || id;
                            })
                            .filter(Boolean);
                          return (
                            <div key={i} style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)' }}>
                                  + {rec.candidateName}
                                </span>
                                <button
                                  onClick={() => {
                                    const cur = Array.isArray(s.enhancedSubs) ? s.enhancedSubs : [];
                                    if (!cur.includes(rec.candidateId)) {
                                      s.setEnhancedSubs([...cur, rec.candidateId]);
                                      s.showToast(`${rec.candidateName} добавлен в план`);
                                      s.calcSupport();
                                    }
                                  }}
                                  style={{ fontSize: 8, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)', cursor: 'pointer' }}
                                >
                                  + Добавить
                                </button>
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                                <span style={{ fontSize: 7, padding: '1px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: 600 }}>
                                  ⊕ {rec.synergyScore} синергия
                                </span>
                                {rec.newSystemCoverage > 0 && (
                                  <span style={{ fontSize: 7, padding: '1px 6px', borderRadius: 4, background: 'rgba(96,165,250,0.1)', color: '#60a5fa', fontWeight: 600 }}>
                                    +{rec.newSystemCoverage} систем
                                  </span>
                                )}
                                <span style={{ fontSize: 7, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: sevColor[rec.severity] || '#6b7280', fontWeight: 600 }}>
                                  {rec.severity}
                                </span>
                                <span style={{ fontSize: 7, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.03)', color: 'var(--text-dim)' }}>
                                  Покрытие: {rec.totalSystemCoverage} систем
                                </span>
                              </div>
                              {synNames.length > 0 && (
                                <div style={{ fontSize: 7, color: 'var(--text-dim)', marginBottom: 2 }}>
                                  Синергия с: <b style={{ color: 'var(--text-light)' }}>{synNames.join(', ')}</b>
                                </div>
                              )}
                              <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>
                                {rec.effect} — {rec.reason}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* ===== BOOST INDICATOR — removed (tags shown as badges in main list) ===== */}

                  {/* ===== INTERACTION MATRIX ===== */}
                  {planResult?.substances && planResult.substances.length > 4 && (
                    <details style={{marginBottom:10}}>
                      <summary style={{fontSize:10,fontWeight:700,color:'#22c55e',cursor:'pointer',marginBottom:4}}>🔗 Матрица взаимодействий в стеке</summary>
                      <div style={{padding:'6px',borderRadius:8,background:'rgba(34,197,94,0.03)',border:'1px solid rgba(34,197,94,0.1)',overflowX:'auto'}}>
                        {(()=>{const subs=planResult.substances.slice(0,12);const ints=[];for(let i=0;i<subs.length;i++){for(let j=i+1;j<subs.length;j++){const ea=SUPPORT_CATALOG_DATA[subs[i].id];if(!ea)continue;if(ea.synergies)for(const s of ea.synergies){if(s.with===subs[j].id||s.with.toUpperCase()===subs[j].id.toUpperCase())ints.push({a:subs[i].name,b:subs[j].name,t:'⊕',e:s.effect?.slice(0,60)});}if(ea.conflicts)for(const c of ea.conflicts){if(c.with===subs[j].id||c.with.toUpperCase()===subs[j].id.toUpperCase())ints.push({a:subs[i].name,b:subs[j].name,t:'⊖',e:c.effect?.slice(0,60)});}}}if(!ints.length)return <span style={{fontSize:8,color:'var(--text-dim)'}}>Нет известных взаимодействий.</span>;return <div><div style={{fontWeight:600,color:'var(--text-light)',marginBottom:4,fontSize:8}}>Найдено {ints.length} взаимодействий:</div>{ints.map((x: any, i: any) =><div key={i} style={{marginBottom:2,padding:'3px 8px',borderRadius:4,background:x.t==='⊖'?'rgba(239,68,68,0.05)':'rgba(34,197,94,0.03)',fontSize:7}}><span style={{color:'var(--text-light)',fontWeight:600}}>{x.a}</span><span style={{color:x.t==='⊖'?'#ef4444':'#22c55e',fontWeight:700,margin:'0 4px'}}>{x.t}</span><span style={{color:'var(--text-light)',fontWeight:600}}>{x.b}</span><span style={{color:'var(--text-dim)'}}> — {x.e}</span></div>)}</div>;})()}
                        <div style={{display:'flex',gap:12,marginTop:6,fontSize:7}}><span style={{color:'#22c55e'}}>⊕ Синергия</span><span style={{color:'#ef4444'}}>⊖ Конфликт</span></div>
                      </div>
                    </details>
                  )}

                  {/* ===== LAB FINDINGS CARD ===== */}
                  {planResult?.labFindings && planResult.labFindings.length > 0 && (
                    <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10, background:'rgba(96,165,250,0.03)', border:'1px solid rgba(96,165,250,0.12)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>🔬 Находки по анализам</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                        {planResult.labFindings.map((lf: any, i: number) => (
                          <div key={i} style={{ marginBottom:4, padding:'4px 6px', borderRadius:4, background:'rgba(255,255,255,0.03)' }}>
                            <span style={{ fontWeight:600, color:'#f59e0b' }}>{lf.name}</span>
                            <span style={{ color:'var(--text-dim)' }}>: {lf.value} (норма: {lf.threshold})</span>
                            {lf.suggestedSubs.length > 0 && (
                              <div style={{ fontSize:7, color:'#22c55e', marginTop:2 }}>
                                💊 Рекомендовано: {lf.suggestedSubs.join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ===== COVERAGE GAPS CARD ===== */}
                  {planResult?.coverageGaps && planResult.coverageGaps.length > 0 && (
                    <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10, background:'rgba(239,68,68,0.03)', border:'1px solid rgba(239,68,68,0.12)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#ef4444', marginBottom:6 }}>⚠️ Системы с недостаточным покрытием</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                        {planResult.coverageGaps.map((gap: any, i: number) => (
                          <div key={i} style={{ marginBottom:3 }}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:1}}><span style={{fontWeight:600,color:'var(--text-light)'}}>{gap.label}</span><span style={{color:'#ef4444',fontSize:7}}>{gap.raw}% → {gap.net}%</span></div><div style={{height:5,borderRadius:3,background:'rgba(239,68,68,0.1)',overflow:'hidden',marginBottom:1}}><div style={{width:`${100-gap.gapPercent}%`,height:'100%',borderRadius:3,background:'#ef4444'}}/></div><div style={{fontSize:7,color:'var(--text-dim)',marginBottom:3}}>Покрыто {100-gap.gapPercent}% · Рекомендуется повысить уровень</div><span style={{fontWeight:600,color:'var(--text-light)'}}>{gap.label}</span>: риск {gap.raw}% → {gap.net}% (покрыто {100-gap.gapPercent}%)
                            <div style={{ height:4, borderRadius:2, background:'rgba(239,68,68,0.15)', marginTop:2, overflow:'hidden' }}>
                              <div style={{ width:`${100 - gap.gapPercent}%`, height:'100%', borderRadius:2, background:'#ef4444' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ===== UNCOVERED MECHANISMS CARD ===== */}
                  {planResult?.uncoveredMechanisms && planResult.uncoveredMechanisms.length > 0 && (
                    <details style={{ marginBottom:10 }}>
                      <summary style={{ fontSize:10, fontWeight:700, color:'#8b5cf6', cursor:'pointer', marginBottom:4 }}>🔍 Непокрытые механизмы ({planResult.uncoveredMechanisms.length})</summary>
                      <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(139,92,246,0.03)', border:'1px solid rgba(139,92,246,0.1)', fontSize:7, color:'var(--text-dim)', lineHeight:1.4, maxHeight:'25vh', overflowY:'auto' }}>
                        {planResult.uncoveredMechanisms.map((um: any, i: any) =>{const sev=um.risk>30?'⚠️':um.risk>15?'⚡':'·';return <div key={i} style={{marginBottom:2}}>{sev} <b>{um.systemLabel}</b> → {um.mechLabel} (риск:{um.risk}%)</div>;})}
                        <div style={{marginTop:4,fontSize:6,color:'var(--text-dim)'}}>⚠️ Критический &gt;30% · ⚡ Повышенный &gt;15% · · Низкий</div>
                      </div>
                    </details>
                  )}

                  {/* ===== STACK RECOMMENDATIONS CARD (Expandable) ===== */}
                  {planResult?.stackRecommendations && planResult.stackRecommendations.length > 0 && (
                    <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.15)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)', marginBottom:6 }}>🧩 Рекомендованные стеки ({planResult.stackRecommendations.length})</div>
                        {planResult.stackRecommendations.map((sr: any, i: number) => {
                          const expandedKey = `stack_${i}`;
                          const isExpanded = expandedCategories[expandedKey];
                          const subsInPlan = (sr.stack.substances || []).filter((sub: any) => effectiveLevel?.subs?.includes(sub.id) || enhancedSubs?.includes(sub.id));
                          const subsMissing = (sr.stack.substances || []).filter((sub: any) => !effectiveLevel?.subs?.includes(sub.id) && !enhancedSubs?.includes(sub.id));
                          const missingIds = subsMissing.map((s: any) => s.id);
                          return (
                            <div key={i} style={{ marginBottom:6, borderRadius:8, background:'rgba(0,0,0,0.06)', border:'1px solid var(--border)', overflow:'hidden' }}>
                              {/* Header row — click to expand/collapse */}
                              <div
                                onClick={() => setExpandedCategories((p: any) => ({ ...p, [expandedKey]: !p[expandedKey] }))}
                                style={{ padding:'8px 10px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', gap:6 }}
                              >
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontWeight:700, color:'var(--text-light)', fontSize:9, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                    {isExpanded ? '▾' : '▸'} {sr.stack.name}
                                  </div>
                                  <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>
                                    {subsInPlan.length}/{sr.stack.substances.length} в плане · синергия {sr.synergyBonus}
                                  </div>
                                </div>
                                <div style={{ display:'flex', gap:4, alignItems:'center', flexShrink:0 }}>
                                  <span style={{ fontSize:8, fontWeight:700, color: sr.score >= 70 ? '#22c55e' : sr.score >= 40 ? '#f59e0b' : 'var(--text-dim)' }}>
                                    {sr.score}</span>
                                  {missingIds.length > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEnhancedSubs((p: string[]) => [...new Set([...p, ...missingIds])]);
                                        showToast('+ ' + missingIds.length + ' вещ. из стека', 'success');
                                      }}
                                      style={{ padding:'2px 8px', borderRadius:6, fontSize:7, fontWeight:700, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'var(--accent)', whiteSpace:'nowrap' }}
                                    >+ {missingIds.length} в план</button>
                                  )}
                                  {missingIds.length === 0 && (
                                    <span style={{ fontSize:7, color:'#22c55e', fontWeight:700 }}>✓ всё в плане</span>
                                  )}
                                </div>
                              </div>

                              {/* Expanded content */}
                              {isExpanded && (
                                <div style={{ padding:'8px 10px', borderTop:'1px solid var(--border)' }}>
                                  {/* Description */}
                                  {sr.stack.description && (
                                    <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5, marginBottom:6 }}>
                                      {sr.stack.description}
                                    </div>
                                  )}
                                  {/* Synergy principle */}
                                  {sr.stack.synergyPrinciple && (
                                    <div style={{ fontSize:8, color:'#60a5fa', lineHeight:1.4, marginBottom:6, padding:'4px 8px', borderRadius:6, background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.1)' }}>
                                      ⚡ {sr.stack.synergyPrinciple}
                                    </div>
                                  )}
                                  {/* All substances with in-plan/missing markers */}
                                  <div style={{ display:'flex', flexDirection:'column', gap:3, marginBottom:6 }}>
                                    {(sr.stack.substances || []).map((sub: any, j: number) => {
                                      const inPlan = effectiveLevel?.subs?.includes(sub.id) || enhancedSubs?.includes(sub.id);
                                      const catEntry = SUPPORT_CATALOG_DATA[sub.id] || SUPPORT_CATALOG_DATA[sub.id?.toUpperCase()] || SUPPORT_CATALOG_DATA[sub.id?.toLowerCase()];
                                      const displayName = catEntry?.nameRu || catEntry?.name || sub.id;
                                      return (
                                        <div key={j} style={{
                                          padding:'4px 8px', borderRadius:6,
                                          background: inPlan ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.04)',
                                          border: '1px solid ' + (inPlan ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.08)'),
                                          display:'flex', alignItems:'flex-start', gap:6,
                                        }}>
                                          <span style={{ fontSize:9, flexShrink:0 }}>{inPlan ? '✅' : '⬜'}</span>
                                          <div style={{ flex:1, minWidth:0 }}>
                                            <div style={{ fontSize:8, fontWeight:700, color: inPlan ? '#22c55e' : 'var(--text-light)' }}>
                                              {displayName} <span style={{ fontWeight:400, color:'var(--text-dim)' }}>— {sub.dose}</span>
                                            </div>
                                            {sub.mechanism && (
                                              <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.3, marginTop:1 }}>{sub.mechanism}</div>
                                            )}
                                          </div>
                                          {!inPlan && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEnhancedSubs((p: string[]) => [...new Set([...p, sub.id])]);
                                                showToast('+ ' + (catEntry?.nameRu || sub.id), 'success');
                                              }}
                                              style={{ padding:'2px 6px', borderRadius:4, fontSize:7, fontWeight:700, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.2)', color:'var(--accent)', flexShrink:0, whiteSpace:'nowrap' }}
                                            >+ доб.</button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {/* Monitoring */}
                                  {sr.stack.monitoring && (
                                    <div style={{ fontSize:7, color:'#f59e0b', lineHeight:1.4, marginBottom:4 }}>
                                      📊 {sr.stack.monitoring}
                                    </div>
                                  )}
                                  {/* Special instructions */}
                                  {sr.stack.specialInstructions && (
                                    <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.4, marginBottom:4 }}>
                                      💊 {sr.stack.specialInstructions}
                                    </div>
                                  )}
                                  {/* Contraindications */}
                                  {sr.stack.contraindications && (
                                    <div style={{ fontSize:7, color:'#ef4444', lineHeight:1.4 }}>
                                      ⚠ {sr.stack.contraindications}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:4 }}>
                        💡 Нажмите на стек, чтобы развернуть. Зелёные ✅ — уже в плане, пустые ⬜ — добавить.
                      </div>
                    </div>
                  )}

                  {/* ===== C2: WHAT-IF ANALYZER ===== */}
                  {calcDone && effectiveLevel?.subs && (
                    <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.12)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:'#f59e0b' }}>🔬 What-If анализ</span>
                        <span style={{ fontSize:7, color:'var(--text-dim)' }}>Оцените влияние каждого вещества на риски</span>
                      </div>
                      {(effectiveLevel?.subs || []).slice(0, 8).map((id: string) => {
                        const sub = allSupport.find((s: any) => s.id === id);
                        const planInfo = planResult?.substances?.find((s: PlanSubstance) => s.id === id);
                        const isWhatIf = expandedCategories[`whatif_${id}`];
                        const coveredMechs = planResult?.mechanisms?.filter((m: any) => (m.substances || []).includes(id)) || [];
                        return sub ? (
                          <div key={id} style={{ marginBottom:3, padding:'4px 8px', borderRadius:6, background:'rgba(0,0,0,0.04)', fontSize:8, display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}
                            onClick={() => setExpandedCategories(p => ({ ...p, [`whatif_${id}`]: !p[`whatif_${id}`] }))}>
                            <span style={{ fontWeight:600, color:'var(--text-light)', flex:1 }}>{sub.name}</span>
                            {isWhatIf ? (
                              <span style={{ color:'#ef4444', fontSize:7 }}>
                                Без: +{Math.round(planInfo?.doseMg ? planInfo.doseMg / 50 : 5)}% риска · Покрывает {coveredMechs.length} мех.
                              </span>
                            ) : (
                              <span style={{ color:'var(--text-dim)', fontSize:7 }}>Покрывает {coveredMechs.length} мех. — нажмите для анализа</span>
                            )}
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}

                  {/* ===== RISK BREAKDOWN ===== */}
                  {planResult?.riskBreakdown && Object.keys(planResult.riskBreakdown).length > 0 && (
                    <details style={{marginBottom:10}}>
                      <summary style={{fontSize:10,fontWeight:700,color:'#ef4444',cursor:'pointer',marginBottom:4}}>🔍 Источники риска по системам</summary>
                      <div style={{padding:'8px 10px',borderRadius:8,background:'rgba(239,68,68,0.03)',border:'1px solid rgba(239,68,68,0.12)'}}>
                        <div style={{fontSize:8,color:'var(--text-dim)',lineHeight:1.5}}>
                          {Object.entries(planResult.riskBreakdown).map(([sys, reasons]: [string, any]) => {
                            const m:Record<string,string>={cardio:'ССС',hepatic:'Печень',renal:'Почки',neuro:'НС',endocrine:'Энд.',hematologic:'Кровь',reproductive:'Реп.',musculoskeletal:'ОДА'};
                            const raw=planResult.systems?.[sys]?.raw||0;
                            if(!raw&&!(reasons as string[]).length)return null;
                            return <div key={sys} style={{marginBottom:6,padding:'4px 8px',borderRadius:6,background:'rgba(0,0,0,0.04)',border:'1px solid var(--border)'}}><div style={{fontWeight:700,color:'var(--text-light)',marginBottom:3}}>{m[sys]||sys} — риск <span style={{color:'#ef4444'}}>{raw}%</span></div>{(reasons as string[]).map((r: any, i: any) =><div key={i} style={{fontSize:7,paddingLeft:6,borderLeft:'2px solid rgba(239,68,68,0.2)',marginBottom:1}}>{r}</div>)}</div>;
                          })}
                        </div>
                        <div style={{fontSize:7,color:'var(--text-dim)',marginTop:4}}>💡 Риски рассчитаны на основе профиля, препаратов курса (PHARMA_DB: linkedRisks, cvProfile, pd), анализов (80+ маркеров), истории циклов и противопоказаний.</div>
                      </div>
                    </details>
                  )}

                  {/* ===== MONITORING CARD ===== */}
                  {planResult?.monitoring && planResult.monitoring.length > 0 && (
                    <details style={{ marginBottom:10 }}>
                      <summary style={{ fontSize:10, fontWeight:700, color:'#f59e0b', cursor:'pointer', marginBottom:4 }}>📊 Мониторинг: что и когда контролировать</summary>
                      <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.03)', border:'1px solid rgba(245,158,11,0.12)' }}>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5, whiteSpace:'pre-line' }}>
                          {planResult.monitoring.slice(0, 12).join('\n')}
                        </div>
                      </div>
                    </details>
                  )}

                  {/* ===== SPECIAL INSTRUCTIONS CARD ===== */}
                  {planResult?.specialInstructions && planResult.specialInstructions.length > 0 && (
                    <details style={{ marginBottom:10 }}>
                      <summary style={{ fontSize:10, fontWeight:700, color:'#ef4444', cursor:'pointer', marginBottom:4 }}>⚠️ Особые указания по совмещению</summary>
                      <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.03)', border:'1px solid rgba(239,68,68,0.12)' }}>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5, whiteSpace:'pre-line' }}>
                          {planResult.specialInstructions.join('\n')}
                        </div>
                      </div>
                    </details>
                  )}

                  {/* ===== C5: DOCTOR'S CONCLUSION ===== */}
                  {planResult && (
                    <details style={{ marginBottom:10 }}>
                      <summary style={{ fontSize:10, fontWeight:700, color:'#60a5fa', cursor:'pointer', marginBottom:4 }}>📄 Отчёт</summary>
                      <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.15)' }}>
                        <div style={{ fontSize:9, color:'var(--text-light)', lineHeight:1.5, whiteSpace:'pre-line' }}>
                          <div style={{ fontWeight:700, marginBottom:4 }}>📋 ОБОСНОВАНИЕ НАЗНАЧЕНИЙ</div>
                          <div style={{ fontSize:8 }}>
                            {`Пациент: ${linked.profile?.settings?.sex === 'female' ? 'женщина' : 'мужчина'}, ${linked.profile?.settings?.age || '?'} лет, ${linked.profile?.settings?.weight || '?'} кг.
Курс: ${(linked.course || []).map((c: any) => c.substanceId).join(', ') || 'не указан'}.
Уровень поддержки: ${SUPPORT_LEVELS[supportLevel]?.label || supportLevel}.
Общий риск: ${planResult.overallRiskBefore}% → ${planResult.overallRiskAfter}% (снижение ${planResult.overallRiskBefore - planResult.overallRiskAfter}%).
Покрытие систем: ${planResult.coveragePercent}%.

НАЗНАЧЕНО (${planResult.substances.length} препаратов):
${planResult.substances.map((s: any) => `• ${s.name} — ${s.doseDisplay} [${s.tier}] — ${s.comment}`).join('\n')}

СИНЕРГИИ В НАЗНАЧЕНИИ:
${planResult.synergyComment.split('\n').filter((l: any) => l.startsWith('•')).join('\n')}

МОНИТОРИНГ:
${planResult.monitoring.join('\n')}
${planResult.labFindings.length > 0 ? '\nОТКЛОНЕНИЯ АНАЛИЗОВ:\n' + planResult.labFindings.map((lf: any) => `• ${lf.name}: ${lf.value} (норма: ${lf.threshold}); рекомендовано: ${lf.suggestedSubs.join(', ')}`).join('\n') : ''}

ПРОГНОЗ: При соблюдении плана поддержки ожидается снижение общего риска до ${planResult.overallRiskAfter}%. Необходим контроль маркеров согласно графику мониторинга.${planResult.coverageGaps.length > 0 ? `\n⚠ Внимание: ${planResult.coverageGaps.map((g: any) => g.label).join(', ')} — имеют недостаточное покрытие. Рекомендуется повысить уровень поддержки или добавить целевые препараты.` : ''}`}
                          </div>
                        </div>
                      </div>
                    </details>
                  )}

                  <div style={{ display:'flex', gap:6 }}>
                    <button style={{ flex:1, padding:'8px', borderRadius:8, border:'none', cursor:'pointer', background:'var(--accent)', color:'#000', fontWeight:700, fontSize:10 }} onClick={() => setPlanSaved(true)}>✅ Утвердить план</button>
                    <button onClick={() => { setShowModal('manual'); setModalAddMode(true); setPlanSaved(false); }} style={{ flex:1, padding:'8px', borderRadius:8, border:'1px solid var(--border)', cursor:'pointer', background:'transparent', color:'var(--text-dim)', fontWeight:600, fontSize:10 }}>✏️ Внести изменения</button>
                  </div>
                  {/* Timing table when approved */}
                  {planSaved && (
                    <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#00e68a', marginBottom:6 }}>✅ План утверждён</div>
                      <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                        <thead><tr style={{ background:'rgba(0,0,0,0.1)' }}>
                          <th style={{ padding:'3px 5px', textAlign:'left' }}>Время</th>
                          <th style={{ padding:'3px 5px', textAlign:'left' }}>Препарат</th>
                          <th style={{ padding:'3px 5px', textAlign:'left' }}>Доза</th>
                          <th style={{ padding:'3px 5px', textAlign:'left' }}>Зачем назначен</th>
                        </tr></thead>
                        <tbody>
                          {(effectiveLevel?.subs || []).map((id: string) => {
                            const sub = allSupport.find((s: any) => s.id === id);
                            const d = effectiveLevel?.dosages?.[id];
                            const planInfo = planResult?.substances?.find((s: PlanSubstance) => s.id === id);
                            if (!sub || !d) return null;
                            return (
                              <tr key={id} style={{ borderBottom:'1px solid var(--border)' }}>
                                <td style={{ padding:'3px 5px', color:'var(--text-dim)', fontSize:7 }}>{d.timing}</td>
                                <td style={{ padding:'3px 5px', fontWeight:600, color:'var(--text-light)' }}>{sub.name}</td>
                                <td style={{ padding:'3px 5px', color:'#00e68a' }}>{d.mg >= 5000 ? `${(d.mg/1000).toFixed(1)} г` : `${d.mg} мг`}</td>
                                <td style={{ padding:'3px 5px', color:'var(--text-dim)', maxWidth:250, fontSize:7, lineHeight:1.3 }}>{planInfo?.comment || sub.description || ''}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {/* Synergies in stack */}
                      <div style={{ marginTop:8, fontSize:8, color:'var(--text-dim)' }}>
                        <div style={{ fontWeight:600, color:'var(--text-light)', marginBottom:3 }}>⚡ Синергии в стеке:</div>
                        {effectiveLevel.subs.slice(0, 8).map((id: string, i: number) => {
                          const sub = allSupport.find((s: any) => s.id === id);
                          if (!sub) return null;
                          const syn = ALL_INTERACTIONS.filter((int: any) =>
                            (int.substanceA === id || int.substanceB === id) && int.type === 'synergy'
                          ).slice(0, 2);
                          return syn.length > 0 ? syn.map((s: any, j: number) => (
                            <div key={`${i}-${j}`} style={{ padding:'2px 0' }}>
                              ⊕ {sub.name} + {allSupport.find((x: any) => x.id === (s.substanceA === id ? s.substanceB : s.substanceA))?.name || ''}: {s.effect?.slice(0, 60)}
                            </div>
                          )) : null;
                        })}
                      </div>
                    </div>
                  )}

                  {/* ===== JOINT SUBS — removed (tags shown as badges in main list) ===== */}
            </>)}
          </div>
      )}
      
            {/* ==================== ADD 5: INTEGRATION NOTICE ==================== */}
            <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.12)', display:'flex', alignItems:'flex-start', gap:8 }}>
              <span style={{ fontSize:14, flexShrink:0 }}>🔄</span>
              <div>
                <div style={{ fontSize:9, fontWeight:600, color:'#60a5fa', marginBottom:2 }}>Автоматическая синхронизация</div>
                <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>
                  Данные обновляются автоматически из вашего профиля, курса и анализов. Измените параметры в Профиле или Анализах для пересчёта.
                </div>
              </div>
            </div>




            {/* ==================== PHASE 4: SAVE & SHARE ==================== */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
              <h4 style={{ margin:'0 0 8px', fontSize:12, color:'var(--text)' }}>💾 Сохранить и поделиться</h4>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                <button onClick={savePlan} style={{
                  padding:'10px', borderRadius:8, border:'1px solid var(--accent)', background:'rgba(0,230,138,0.08)',
                  cursor:'pointer', fontSize:10, fontWeight:700, color:'var(--accent)',
                }}>💾 Сохранить план</button>
                <button onClick={copyPlan} style={{
                  padding:'10px', borderRadius:8, border:'1px solid #60a5fa', background:'rgba(96,165,250,0.08)',
                  cursor:'pointer', fontSize:10, fontWeight:700, color:'#60a5fa',
                }}>📋 Копировать</button>
                <button onClick={async () => {
                  const text = buildShareText();
                  try {
                    await navigator.clipboard.writeText(text);
                    alert('✅ Текст плана скопирован в буфер обмена');
                  } catch {
                    try {
                      if (navigator.share) {
                        await navigator.share({ title: 'План поддержки', text });
                      } else {
                        prompt('📋 Скопируйте текст вручную:', text);
                      }
                    } catch { prompt('📋 Скопируйте текст вручную:', text); }
                  }
                }} style={{
                  padding:'10px', borderRadius:8, border:'1px solid #34d399', background:'rgba(52,211,153,0.08)',
                  cursor:'pointer', fontSize:10, fontWeight:700, color:'#34d399',
                }}>📤 Поделиться</button>
                <button onClick={() => alert('Напоминания через Telegram Mini App будут доступны в следующем обновлении.')} style={{
                  padding:'10px', borderRadius:8, border:'1px solid #a78bfa', background:'rgba(167,139,250,0.08)',
                  cursor:'pointer', fontSize:10, fontWeight:700, color:'#a78bfa',
                }}>📅 Напомнить</button>
                <button onClick={exportForDoctor} style={{
                  padding:'10px', borderRadius:8, border:'1px solid #f59e0b', background:'rgba(245,158,11,0.08)',
                  cursor:'pointer', fontSize:10, fontWeight:700, color:'#f59e0b',
                }}>👨‍⚕️ Экспорт врачу</button>
              </div>
              {planSavedLocal && (
                <div style={{ textAlign:'center', fontSize:10, color:'#22c55e', marginTop:6, padding:'4px', borderRadius:6, background:'rgba(34,197,94,0.06)' }}>✅ План сохранён в localStorage</div>
              )}
            </div>



          </div>
        </div>
  );
};
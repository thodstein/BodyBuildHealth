import React, { useState } from "react";
import type { UserProfile } from "../../../../core/types";
import { IndividualPlanProvider } from "./IndividualPlanContext";
import { IndividualPlanSettings } from "./IndividualPlanSettings";
import { IndividualPlanResults } from "./IndividualPlanResults";
import { MealComposer } from "./MealComposer";
import { usePlanCtx } from "./IndividualPlanContext";

type PlanTab = 'settings' | 'plan' | 'composer' | 'report';

const TAB_META: { key: PlanTab; label: string; icon: string }[] = [
  { key: 'settings', label: 'Настройки', icon: '⚙️' },
  { key: 'plan', label: 'План', icon: '🥗' },
  { key: 'composer', label: 'Компоновщик', icon: '🍳' },
  { key: 'report', label: 'Отчёт', icon: '📊' },
];

export const IndividualPlan: React.FC<{ profile: UserProfile | null; course?: any[] }> = ({ profile, course }) => {
  const [tab, setTab] = useState<PlanTab>('settings');

  return (
    <IndividualPlanProvider profile={profile} course={course}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 80, maxWidth: 540, margin: '0 auto' }}>
        <div style={{ display:'flex', gap:3, padding:'4px 0', overflowX:'auto', scrollbarWidth:'none' }}>
          {TAB_META.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flexShrink:0, padding:'6px 12px', borderRadius:16, cursor:'pointer',
              fontSize:9, fontWeight: tab === t.key ? 700 : 500,
              border: tab === t.key ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
              background: tab === t.key ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : '#202023',
              color: tab === t.key ? '#000' : '#fff',
              transition:'all 0.15s',
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {tab === 'settings' && <IndividualPlanSettings />}
        {tab === 'plan' && <IndividualPlanResults />}
        {tab === 'composer' && <MealComposer />}
        {tab === 'report' && <ReportTab />}
      </div>
    </IndividualPlanProvider>
  );
};

const ReportTab: React.FC = () => {
  const { generateFullNutritionReport, nutritionReport } = usePlanCtx();
  const [generated, setGenerated] = useState(false);
  const [microSearch, setMicroSearch] = useState('');
  const r = nutritionReport;
  const card: React.CSSProperties = { padding:'8px 10px', borderRadius:8, background:'rgba(24,24,27,0.6)', border:'1px solid rgba(255,255,255,0.04)', marginBottom:6 };
  const gradeColor: Record<string,string> = { A:'#00e68a', B:'#8b5cf6', C:'#f59e0b', D:'#ef4444' };
  const pctColor = (pct: number): string => pct >= 85 && pct <= 115 ? '#22c55e' : pct >= 70 && pct <= 130 ? '#f59e0b' : '#ef4444';
  const barStyle = (pct: number): React.CSSProperties => ({
    height:4, borderRadius:2, background:'rgba(255,255,255,0.06)', overflow:'hidden', marginTop:1,
  });
  const fillStyle = (pct: number): React.CSSProperties => ({
    width:`${Math.min(100, Math.max(0, pct))}%`, height:'100%', borderRadius:2, background: pctColor(pct),
    transition:'width 0.3s',
  });
  const statusStyle = (ok: boolean): React.CSSProperties => ({
    fontSize:7, padding:'2px 6px', borderRadius:4, display:'inline-block',
    background: ok ? 'rgba(0,230,138,0.06)' : 'rgba(239,68,68,0.06)',
    color: ok ? '#22c55e' : '#ef4444',
  });
  return (
    <div style={{ paddingBottom: 80 }}>
      <button onClick={() => { generateFullNutritionReport?.(); setGenerated(true); }} style={{
        padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:10, fontWeight:700,
        background:'linear-gradient(135deg,#00e68a,#00c8a0)', border:'none', color:'#000', marginBottom:8,
      }}>📊 Сгенерировать отчёт</button>
      {!r && generated && <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)' }}>⚠️ Сначала создайте план на день.</div>}
      {r && <>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <div style={{ width:40, height:40, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
            background:`${(gradeColor[r.overallGrade] || '#fff')}18`, border:`2px solid ${gradeColor[r.overallGrade] || '#fff'}` }}>
            <span style={{ fontSize:18, fontWeight:800, color: gradeColor[r.overallGrade] || '#fff' }}>{r.overallGrade}</span>
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color: gradeColor[r.overallGrade] || '#fff' }}>{r.overallGradeLabel}</div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.6)' }}>Общая оценка рациона</div>
          </div>
        </div>

        {/* KBJU per meal */}
        {r.kbjuPerMeal && r.kbjuPerMeal.length > 0 && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#60a5fa', marginBottom:4 }}>🥗 КБЖУ по приёмам</div>
          {r.kbjuPerMeal.map((m: any, i: number) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:7, padding:'2px 0', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ fontWeight:600, color:'#fff' }}>{m.label}</span>
              <span>{Math.round(m.kcal)} ккал · Б{m.p.toFixed(0)} Ж{m.f.toFixed(0)} У{m.c.toFixed(0)}</span>
            </div>
          ))}
          <div style={{ fontSize:8, marginTop:4 }}>
            <div style={{ marginBottom:4 }}>
              {[
                { label:'Ккал', key:'kcal', pct: r.kbjuPct.kcal },
                { label:'Белки', key:'p', pct: r.kbjuPct.p },
                { label:'Жиры', key:'f', pct: r.kbjuPct.f },
                { label:'Углеводы', key:'c', pct: r.kbjuPct.c },
              ].map(item => (
                <div key={item.key} style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                  <span style={{ fontSize:7, color:'rgba(255,255,255,0.8)', minWidth:48 }}>{item.label}</span>
                  <div style={{ flex:1, height:5, borderRadius:3, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                    <div style={{ width:`${Math.min(100, Math.max(0, item.pct))}%`, height:'100%', borderRadius:3,
                      background: pctColor(item.pct) }} />
                  </div>
                  <span style={{ fontSize:7, fontWeight:600, color: pctColor(item.pct), minWidth:32, textAlign:'right' }}>{Math.round(item.pct)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>}

        {/* Micros grid */}
        {r.micros && Object.keys(r.micros).length > 0 && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#a78bfa', marginBottom:4 }}>
            💊 Микронутриенты
            {Object.values(r.micros).filter((v: any) => v.status === 'low' || v.status === 'critical').length > 0 && (
              <span style={{ marginLeft:6, fontSize:7, padding:'1px 5px', borderRadius:3,
                background:'rgba(239,68,68,0.1)', color:'#ef4444', fontWeight:600 }}>
                {Object.values(r.micros).filter((v: any) => v.status === 'low' || v.status === 'critical').length} дефицитов
              </span>
            )}
          </div>
          <input value={microSearch} onChange={e => setMicroSearch(e.target.value)}
            placeholder="🔍 Поиск микронутриента..." style={{
              width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid rgba(255,255,255,0.06)',
              background:'rgba(255,255,255,0.03)', color:'#fff', fontSize:8, marginBottom:4, outline:'none',
            }} />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2, fontSize:7, maxHeight:200, overflowY:'auto' }}>
            {Object.entries(r.micros)
              .filter(([k]) => !microSearch || k.toLowerCase().includes(microSearch.toLowerCase()))
              .map(([k, v]: [string, any]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'2px 4px', borderRadius:3,
                background: v.status === 'ok' ? 'rgba(0,230,138,0.04)' : v.status === 'low' ? 'rgba(245,158,11,0.04)' : 'rgba(239,68,68,0.04)' }}>
                <span style={{ color: v.status === 'ok' ? '#22c55e' : v.status === 'low' ? '#f59e0b' : '#ef4444' }}>{k}</span>
                <span style={{ color:'rgba(255,255,255,0.7)' }}>{v.actual}/{v.target} ({v.pct}%)</span>
              </div>
            ))}
          </div>
          {microSearch && Object.entries(r.micros).filter(([k]) => k.toLowerCase().includes(microSearch.toLowerCase())).length === 0 && (
            <div style={{ fontSize:6, color:'rgba(255,255,255,0.3)', marginTop:2 }}>Ничего не найдено</div>
          )}
        </div>}

        {/* Water + Electrolytes grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:6 }}>
          {r.waterBalance && <div style={card}>
            <div style={{ fontSize:9, fontWeight:600, color:'#60a5fa', marginBottom:4 }}>💧 Вода</div>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)' }}>
              {r.waterBalance.intakeMl} / {r.waterBalance.targetMl} мл ({r.waterBalance.intakePerKg} мл/кг)
            </div>
            <div style={{ fontSize:7, marginTop:2 }}>
              {r.waterBalance.deficitMl > 0 ? (
                <span style={{ color:'#ef4444' }}>⚠️ Дефицит {r.waterBalance.deficitMl} мл ({Math.round(r.waterBalance.deficitMl / r.waterBalance.targetMl * 100)}%)</span>
              ) : (
                <span style={{ color:'#22c55e' }}>✅ Норма воды</span>
              )}
            </div>
            {r.waterBalance.recommendation && (
              <div style={{ fontSize:6, color:'rgba(255,255,255,0.6)', marginTop:2 }}>💡 {r.waterBalance.recommendation}</div>
            )}
          </div>}
          {r.sodiumPotassium && <div style={card}>
            <div style={{ fontSize:9, fontWeight:600, color:'#f59e0b', marginBottom:4 }}>🧂 Na/K</div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>
              Na {r.sodiumPotassium.naMg}мг / K {r.sodiumPotassium.kMg}мг
            </div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>
              Соотношение {r.sodiumPotassium.ratio.toFixed(1)}:1 (норма {r.sodiumPotassium.targetRatio})
            </div>
            <div style={{ marginTop:2 }}>
              <span style={statusStyle(r.sodiumPotassium.status === 'ok')}>
                {r.sodiumPotassium.status === 'ok' ? '✅ Норма' : r.sodiumPotassium.status === 'high' ? '🔴 Избыток Na' : '🟡 Недостаток K'}
              </span>
            </div>
            {r.sodiumPotassium.recommendation && (
              <div style={{ fontSize:6, color:'rgba(255,255,255,0.6)', marginTop:2 }}>💡 {r.sodiumPotassium.recommendation}</div>
            )}
          </div>}
        </div>

        {/* Protein timing + GL + Fat quality grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:6 }}>
          {r.proteinTiming && <div style={card}>
            <div style={{ fontSize:9, fontWeight:600, color:'#8b5cf6', marginBottom:4 }}>⏱ Белок</div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>
              Равн.: {r.proteinTiming.evennessScore.toFixed(0)}% · Перерыв: {r.proteinTiming.maxGapHours}ч
            </div>
            <div style={{ ...barStyle(0), marginTop:2, height:4 }}>
              <div style={{ width:`${Math.min(100, r.proteinTiming.evennessScore)}%`, height:'100%', borderRadius:2,
                background: r.proteinTiming.evennessScore >= 70 ? '#8b5cf6' : '#f59e0b' }} />
            </div>
            {r.proteinTiming.recommendation && (
              <div style={{ fontSize:6, color:'rgba(255,255,255,0.6)', marginTop:2 }}>💡 {r.proteinTiming.recommendation}</div>
            )}
          </div>}
          {r.glycemicLoad && <div style={card}>
            <div style={{ fontSize:9, fontWeight:600, color:'#f97316', marginBottom:4 }}>🍬 ГН</div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>
              ГН {r.glycemicLoad.totalGL.toFixed(0)} · ср.ГИ {r.glycemicLoad.avgGI.toFixed(0)}
              · Приёмов с выс.ГИ: {r.glycemicLoad.mealsHighGI || 0}
            </div>
            <div style={{ marginTop:2 }}>
              <span style={statusStyle(r.glycemicLoad.status !== 'high')}>
                {r.glycemicLoad.status === 'high' ? '🔴 Высокая гликемическая нагрузка' : r.glycemicLoad.status === 'low' ? '🟡 Низкая ГН' : '✅ Норма'}
              </span>
            </div>
            {r.glycemicLoad.recommendation && (
              <div style={{ fontSize:6, color:'rgba(255,255,255,0.6)', marginTop:2 }}>💡 {r.glycemicLoad.recommendation}</div>
            )}
          </div>}
        </div>

        {/* Fat quality + Fiber + Ca/Mg grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:6 }}>
          {r.fatQuality && <div style={card}>
            <div style={{ fontSize:9, fontWeight:600, color:'#f59e0b', marginBottom:4 }}>🧈 Жиры</div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>
              Ω3 {r.fatQuality.omega3G.toFixed(2)}г · Ω6/Ω3 {r.fatQuality.omega6to3ratio.toFixed(1)}:1
            </div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>
              Нас.{r.fatQuality.satG.toFixed(0)}г ({r.fatQuality.satPct.toFixed(0)}%) · Ненас.{r.fatQuality.unsatG.toFixed(0)}г
            </div>
            <div style={{ marginTop:2, display:'flex', gap:2, height:4, borderRadius:2, overflow:'hidden' }}>
              <div style={{ flex: r.fatQuality.satPct, background:'#f97316' }} />
              <div style={{ flex: 100 - r.fatQuality.satPct, background:'#22c55e' }} />
            </div>
            <div style={{ fontSize:5, display:'flex', justifyContent:'space-between', marginTop:1, color:'rgba(255,255,255,0.4)' }}>
              <span>🧈 Нас.{r.fatQuality.satPct.toFixed(0)}%</span>
              <span>🥑 Ненас.{(100 - r.fatQuality.satPct).toFixed(0)}%</span>
            </div>
            {r.fatQuality.recommendation && (
              <div style={{ fontSize:6, color:'rgba(255,255,255,0.6)', marginTop:2 }}>💡 {r.fatQuality.recommendation}</div>
            )}
          </div>}
          {r.fiberAnalysis && <div style={card}>
            <div style={{ fontSize:9, fontWeight:600, color:'#22c55e', marginBottom:4 }}>🌿 Клетч.</div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>
              {r.fiberAnalysis.totalG.toFixed(0)}/{r.fiberAnalysis.targetG}г ({Math.round(r.fiberAnalysis.pct)}%)
            </div>
            <div style={{ ...barStyle(0), marginTop:2 }}>
              <div style={fillStyle(r.fiberAnalysis.pct)} />
            </div>
            <div style={{ marginTop:2 }}>
              <span style={statusStyle(r.fiberAnalysis.status !== 'critical')}>
                {r.fiberAnalysis.status === 'critical' ? '🔴 Критический дефицит' : r.fiberAnalysis.status === 'low' ? '🟡 Недостаточно' : '✅ Норма'}
              </span>
            </div>
            {r.fiberAnalysis.recommendation && (
              <div style={{ fontSize:6, color:'rgba(255,255,255,0.6)', marginTop:2 }}>💡 {r.fiberAnalysis.recommendation}</div>
            )}
          </div>}
          {r.calciumMagnesium && <div style={card}>
            <div style={{ fontSize:9, fontWeight:600, color:'#a78bfa', marginBottom:4 }}>🦴 Ca/Mg</div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>
              Ca {r.calciumMagnesium.caMg}мг / Mg {r.calciumMagnesium.mgMg}мг
            </div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>
              Соотношение {r.calciumMagnesium.ratio.toFixed(1)}:1 (норма {r.calciumMagnesium.targetRatio})
            </div>
            <div style={{ marginTop:2 }}>
              <span style={statusStyle(r.calciumMagnesium.status === 'ok')}>
                {r.calciumMagnesium.status === 'ok' ? '✅ Норма' : r.calciumMagnesium.status === 'high' ? '🔴 Избыток Ca' : '🟡 Нарушение'}
              </span>
            </div>
            {r.calciumMagnesium.recommendation && (
              <div style={{ fontSize:6, color:'rgba(255,255,255,0.6)', marginTop:2 }}>💡 {r.calciumMagnesium.recommendation}</div>
            )}
          </div>}
        </div>

        {/* Weight dynamics */}
        <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#06b6d4', marginBottom:4 }}>
            ⚖️ Динамика веса
            <span style={{ marginLeft:6, fontSize:10 }}>
              {r.weightDynamicsBasic.direction === 'loss' ? '📉' : r.weightDynamicsBasic.direction === 'gain' ? '📈' : '➡️'}
            </span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:7, color:'rgba(255,255,255,0.7)' }}>
            <div>Базовая: {r.weightDynamicsBasic.weeklyKg} кг/нед ({r.weightDynamicsBasic.direction === 'loss' ? '🔥 дефицит' : r.weightDynamicsBasic.direction === 'gain' ? '💪 профицит' : '⚖️ баланс'})</div>
            <div>Уточнённая: {r.weightDynamicsEnhanced.weeklyKg} кг/нед (достоверность: {r.weightDynamicsEnhanced.confidence})</div>
            <div style={{ gridColumn:'1/-1', color:'rgba(255,255,255,0.85)' }}>{r.weightDynamicsEnhanced.explanation}</div>
            {r.weightDynamicsEnhanced.factors.length > 0 && (
              <div style={{ gridColumn:'1/-1' }}>
                {r.weightDynamicsEnhanced.factors.map((f: string, i: number) => (
                  <div key={i} style={{ fontSize:6, color:'#f59e0b', marginBottom:1 }}>• {f}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Meal timing */}
        {r.mealTiming && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#60a5fa', marginBottom:4 }}>⏰ Тайминг приёмов</div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>
            {r.mealTiming.mealCount} приёмов, макс.перерыв {r.mealTiming.longestGapHours}ч
            {r.mealTiming.hasPreWorkout && ' · 🔥 Pre'}
            {r.mealTiming.hasPostWorkout && ' · 💪 Post'}
            {!r.mealTiming.eveningCarbOk && ' · 🌙 Углеводы вечером ⚠️'}
          </div>
          {r.kbjuPerMeal && r.kbjuPerMeal.length > 0 && (
            <div style={{ marginTop:2, display:'flex', flexDirection:'column', gap:1 }}>
              {r.kbjuPerMeal.map((m: any, i: number) => (
                <div key={i} style={{ fontSize:6, display:'flex', alignItems:'center', gap:3, padding:'1px 0' }}>
                  <span style={{ color:'rgba(255,255,255,0.8)' }}>🍽</span>
                  <span style={{ color:'#fff', fontWeight:600 }}>{m.label}</span>
                  <span style={{ color:'rgba(255,255,255,0.5)', marginLeft:'auto' }}>
                    ~{m.kcal} ккал
                  </span>
                </div>
              ))}
            </div>
          )}
          {r.mealTiming.longestGapHours > 5 && (
            <div style={{ fontSize:6, padding:'2px 5px', borderRadius:4, background:'rgba(245,158,11,0.06)', color:'#f59e0b', marginTop:2, display:'inline-block' }}>
              ⚠️ Перерыв {r.mealTiming.longestGapHours}ч {`>`} 5ч — риск катаболизма
            </div>
          )}
          {r.mealTiming.gaps.length > 0 && (
            <div style={{ fontSize:6, color:'#f59e0b', marginTop:2 }}>Пропуски: {r.mealTiming.gaps.join(', ')}</div>
          )}
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.85)', marginTop:2 }}>{r.mealTiming.recommendation}</div>
        </div>}

        {/* Risk analysis */}
        {r.riskAnalysis.length > 0 && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#f97316', marginBottom:4 }}>
            ⚠️ Анализ рисков
            {(() => {
              const total = r.riskAnalysis.reduce((s: number, risk: any) => s + (risk.score / risk.maxScore), 0);
              const avg = r.riskAnalysis.length > 0 ? total / r.riskAnalysis.length : 0;
              const riskColor = avg > 0.6 ? '#ef4444' : avg > 0.3 ? '#f59e0b' : '#22c55e';
              return <span style={{ marginLeft:6, fontSize:7, fontWeight:600, color: riskColor }}>· ср.риск {(avg * 100).toFixed(0)}%</span>;
            })()}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            {r.riskAnalysis.map((risk: { system: string; score: number; maxScore: number; impact: string; recommendation: string }, i: number) => {
              const pct = risk.maxScore > 0 ? risk.score / risk.maxScore : 0;
              const badge = pct > 0.6 ? '🔴' : pct > 0.3 ? '🟡' : '🟢';
              return (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:7, padding:'2px 5px', borderRadius:4,
                  background: pct > 0.6 ? 'rgba(239,68,68,0.04)' : pct > 0.3 ? 'rgba(245,158,11,0.04)' : 'rgba(0,230,138,0.04)' }}>
                  <span style={{ color: pct > 0.6 ? '#ef4444' : pct > 0.3 ? '#f59e0b' : '#22c55e' }}>
                    {badge} {risk.system}: {risk.score}/{risk.maxScore}
                  </span>
                  <span style={{ color:'rgba(255,255,255,0.6)' }}>{risk.recommendation}</span>
                </div>
              );
            })}
          </div>
        </div>}

        {/* Food quality */}
        <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#00e68a', marginBottom:4 }}>⭐ Качество продуктов: {r.foodQualityScore.toFixed(1)}/10</div>
          {r.foodQualityDetails && <>
            {r.foodQualityDetails.bestItems.length > 0 && <div style={{ fontSize:7, color:'#00e68a' }}>✅ Лучшие: {r.foodQualityDetails.bestItems.join(', ')}</div>}
            {r.foodQualityDetails.weakItems.length > 0 && <div style={{ fontSize:7, color:'#f59e0b', marginTop:2 }}>⚠️ Слабые: {r.foodQualityDetails.weakItems.join(', ')}</div>}
            <div style={{ fontSize:6, marginTop:2 }}>
              <span style={{ color:'rgba(255,255,255,0.4)' }}>Средний тир: {r.foodQualityDetails.avgTier}</span>
              {r.foodQualityDetails.bestItems.length > 0 && r.foodQualityDetails.weakItems.length > 0 && (
                <span style={{ color:'rgba(255,255,255,0.3)', marginLeft:6 }}>
                  · Разрыв: {((r.foodQualityDetails.bestItems.length / (r.foodQualityDetails.bestItems.length + r.foodQualityDetails.weakItems.length)) * 100).toFixed(0)}% качественных
                </span>
              )}
            </div>
          </>}
        </div>

        {/* Allergen warnings */}
        {r.allergenWarnings && r.allergenWarnings.length > 0 && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#ef4444', marginBottom:4 }}>⚠️ Аллергены</div>
          {r.allergenWarnings.map((w: { food: string; allergens: string[] }, i: number) => (
            <div key={i} style={{ fontSize:7, color:'rgba(255,255,255,0.7)', marginBottom:2 }}>
              {w.food}: {w.allergens.join(', ')}
            </div>
          ))}
        </div>}

        {/* Plan decisions */}
        {r.planDecisions && r.planDecisions.length > 0 && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#8b5cf6', marginBottom:4 }}>📝 Параметры плана</div>
          {r.planDecisions.map((d: { param: string; value: string; impact: string }, i: number) => (
            <div key={i} style={{ fontSize:7, padding:'2px 0', borderBottom:'1px solid rgba(255,255,255,0.03)', color:'rgba(255,255,255,0.7)' }}>
              <span style={{ fontWeight:600, color:'#fff' }}>{d.param}</span>: {d.value} — {d.impact}
            </div>
          ))}
        </div>}

        {/* Micro deficiencies */}
        {r.microDeficiencies.length > 0 && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#ef4444', marginBottom:4 }}>💊 Дефициты микронутриентов ({r.microDeficiencies.length})</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
            {r.microDeficiencies.map((m: string) => {
              const criticalDefs = ['Железо','B12','Витамин D','Кальций','B9','C','Фолат','B6'];
              const isCrit = criticalDefs.some(c => m.toLowerCase().includes(c.toLowerCase()));
              return (
                <span key={m} style={{ fontSize:7, padding:'1px 5px', borderRadius:3,
                  background: isCrit ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)',
                  color: isCrit ? '#ef4444' : '#f59e0b' }}>
                  {isCrit ? '🔴' : '🟡'} {m}
                </span>
              );
            })}
          </div>
        </div>}

        {/* Recommendations */}
        {r.recommendations.length > 0 && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#8b5cf6', marginBottom:4 }}>📋 Рекомендации</div>
          {(() => {
            const macroRecs: string[] = [];
            const microRecs: string[] = [];
            const timingRecs: string[] = [];
            const qualityRecs: string[] = [];
            r.recommendations.forEach((rec: string) => {
              if (/белк|жир|углевод|калори|ккал|БЖУ|макро/i.test(rec)) macroRecs.push(rec);
              else if (/витамин|микро|дефицит|цинк|магний|кальций|железо|B12|D3|омега/i.test(rec)) microRecs.push(rec);
              else if (/врем|приём|тайминг|перерыв|график|утро|вечер|ночь/i.test(rec)) timingRecs.push(rec);
              else qualityRecs.push(rec);
            });
            const sections = [
              { title:'🥩 Макронутриенты', items: macroRecs },
              { title:'💊 Микронутриенты', items: microRecs },
              { title:'⏰ Тайминг', items: timingRecs },
              { title:'✨ Прочее', items: qualityRecs },
            ].filter(s => s.items.length > 0);
            return sections.map((sec, si) => (
              <div key={si}>
                <div style={{ fontSize:7, fontWeight:600, color:'rgba(255,255,255,0.85)', marginBottom:2, marginTop: si > 0 ? 4 : 0 }}>{sec.title}</div>
                {sec.items.map((rec: string, ri: number) => (
                  <div key={ri} style={{ fontSize:7, color:'rgba(255,255,255,0.7)', marginBottom:1, lineHeight:1.3, marginLeft:6 }}>• {rec}</div>
                ))}
              </div>
            ));
          })()}
        </div>}
      </>}
    </div>
  );
};

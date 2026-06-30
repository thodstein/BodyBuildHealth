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
  const r = nutritionReport;
  const card: React.CSSProperties = { padding:'8px 10px', borderRadius:8, background:'rgba(24,24,27,0.6)', border:'1px solid rgba(255,255,255,0.04)', marginBottom:6 };
  const gradeColor: Record<string,string> = { A:'#00e68a', B:'#8b5cf6', C:'#f59e0b', D:'#ef4444' };
  const stat = (label: string, val: string, color: string) => (
    <div style={{ padding:'3px 5px', borderRadius:5, background:'rgba(255,255,255,0.02)' }}>
      <div style={{ fontSize:6, color:'rgba(255,255,255,0.7)' }}>{label}</div>
      <div style={{ fontSize:9, fontWeight:700, color }}>{val}</div>
    </div>
  );
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
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2, fontSize:8, marginTop:4 }}>
            <span>Ккал: {Math.round(r.kbjuPct.kcal)}%</span>
            <span>Белки: {Math.round(r.kbjuPct.p)}%</span>
            <span>Жиры: {Math.round(r.kbjuPct.f)}%</span>
            <span>Углеводы: {Math.round(r.kbjuPct.c)}%</span>
          </div>
        </div>}

        {/* Micros grid */}
        {r.micros && Object.keys(r.micros).length > 0 && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#a78bfa', marginBottom:4 }}>💊 Микронутриенты</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2, fontSize:7 }}>
            {Object.entries(r.micros).slice(0,14).map(([k, v]: [string, any]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'1px 3px', borderRadius:3,
                background: v.status === 'ok' ? 'rgba(0,230,138,0.04)' : v.status === 'low' ? 'rgba(245,158,11,0.04)' : 'rgba(239,68,68,0.04)' }}>
                <span style={{ color: v.status === 'ok' ? '#22c55e' : v.status === 'low' ? '#f59e0b' : '#ef4444' }}>{k}</span>
                <span style={{ color:'rgba(255,255,255,0.7)' }}>{v.actual}/{v.target} ({v.pct}%)</span>
              </div>
            ))}
          </div>
          {Object.keys(r.micros).length > 14 && <div style={{ fontSize:6, color:'rgba(255,255,255,0.2)', marginTop:2 }}>+ ещё {Object.keys(r.micros).length - 14}</div>}
        </div>}

        {/* Water + Electrolytes grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:6 }}>
          {r.waterBalance && <div style={card}>
            <div style={{ fontSize:9, fontWeight:600, color:'#60a5fa', marginBottom:4 }}>💧 Вода</div>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)' }}>
              {r.waterBalance.intakeMl} / {r.waterBalance.targetMl} мл ({r.waterBalance.intakePerKg} мл/кг)
              {r.waterBalance.status === 'low' && ' ⚠️'}
            </div>
          </div>}
          {r.sodiumPotassium && <div style={card}>
            <div style={{ fontSize:9, fontWeight:600, color:'#f59e0b', marginBottom:4 }}>🧂 Na/K</div>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)' }}>
              {r.sodiumPotassium.ratio.toFixed(1)}:1 (норма {r.sodiumPotassium.targetRatio})
            </div>
          </div>}
        </div>

        {/* Protein timing + GL + Fat quality grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:6 }}>
          {r.proteinTiming && <div style={card}>
            <div style={{ fontSize:9, fontWeight:600, color:'#8b5cf6', marginBottom:4 }}>⏱ Белок</div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>
              Равн.: {r.proteinTiming.evennessScore.toFixed(0)}% · Перерыв: {r.proteinTiming.maxGapHours}ч
            </div>
          </div>}
          {r.glycemicLoad && <div style={card}>
            <div style={{ fontSize:9, fontWeight:600, color:'#f97316', marginBottom:4 }}>🍬 ГН</div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>
              ГН {r.glycemicLoad.totalGL.toFixed(0)} · ср.ГИ {r.glycemicLoad.avgGI.toFixed(0)}
              {r.glycemicLoad.status === 'high' && <span style={{ color:'#ef4444' }}> ⚠️</span>}
            </div>
          </div>}
        </div>

        {/* Fat quality + Fiber + Ca/Mg grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:6 }}>
          {r.fatQuality && <div style={card}>
            <div style={{ fontSize:9, fontWeight:600, color:'#f59e0b', marginBottom:4 }}>🧈 Жиры</div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>
              Ω3 {r.fatQuality.omega3G.toFixed(2)}г · Нас.{r.fatQuality.satG.toFixed(0)}г
            </div>
          </div>}
          {r.fiberAnalysis && <div style={card}>
            <div style={{ fontSize:9, fontWeight:600, color:'#22c55e', marginBottom:4 }}>🌿 Клетч.</div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>
              {r.fiberAnalysis.totalG.toFixed(0)}/{r.fiberAnalysis.targetG}г ({Math.round(r.fiberAnalysis.pct)}%)
            </div>
          </div>}
          {r.calciumMagnesium && <div style={card}>
            <div style={{ fontSize:9, fontWeight:600, color:'#a78bfa', marginBottom:4 }}>🦴 Ca/Mg</div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>
              {r.calciumMagnesium.ratio.toFixed(1)}:1 (норма {r.calciumMagnesium.targetRatio})
            </div>
          </div>}
        </div>

        {/* Weight dynamics */}
        <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#06b6d4', marginBottom:4 }}>⚖️ Динамика веса</div>
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
          {r.mealTiming.gaps.length > 0 && (
            <div style={{ fontSize:6, color:'#f59e0b', marginTop:2 }}>Пропуски: {r.mealTiming.gaps.join(', ')}</div>
          )}
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.85)', marginTop:2 }}>{r.mealTiming.recommendation}</div>
        </div>}

        {/* Risk analysis */}
        {r.riskAnalysis.length > 0 && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#f97316', marginBottom:4 }}>⚠️ Анализ рисков</div>
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            {r.riskAnalysis.map((risk: { system: string; score: number; maxScore: number; impact: string; recommendation: string }, i: number) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:7, padding:'2px 5px', borderRadius:4,
                background: risk.score > risk.maxScore * 0.6 ? 'rgba(239,68,68,0.04)' : risk.score > risk.maxScore * 0.3 ? 'rgba(245,158,11,0.04)' : 'rgba(0,230,138,0.04)' }}>
                <span style={{ color: risk.score > risk.maxScore * 0.6 ? '#ef4444' : risk.score > risk.maxScore * 0.3 ? '#f59e0b' : '#22c55e' }}>
                  {risk.system}: {risk.score}/{risk.maxScore}
                </span>
                <span style={{ color:'rgba(255,255,255,0.6)' }}>{risk.recommendation}</span>
              </div>
            ))}
          </div>
        </div>}

        {/* Food quality */}
        <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#00e68a', marginBottom:4 }}>⭐ Качество продуктов: {r.foodQualityScore.toFixed(1)}/10</div>
          {r.foodQualityDetails && <>
            {r.foodQualityDetails.bestItems.length > 0 && <div style={{ fontSize:7, color:'#00e68a' }}>✅ Лучшие: {r.foodQualityDetails.bestItems.join(', ')}</div>}
            {r.foodQualityDetails.weakItems.length > 0 && <div style={{ fontSize:7, color:'#f59e0b', marginTop:2 }}>⚠️ Слабые: {r.foodQualityDetails.weakItems.join(', ')}</div>}
            <div style={{ fontSize:6, color:'rgba(255,255,255,0.4)', marginTop:2 }}>Средний тир продуктов: {r.foodQualityDetails.avgTier}</div>
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
          <div style={{ fontSize:9, fontWeight:600, color:'#ef4444', marginBottom:4 }}>💊 Дефициты микронутриентов</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
            {r.microDeficiencies.map((m: string) => <span key={m} style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(239,68,68,0.1)', color:'#ef4444' }}>{m}</span>)}
          </div>
        </div>}

        {/* Recommendations */}
        {r.recommendations.length > 0 && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#8b5cf6', marginBottom:4 }}>📋 Рекомендации</div>
          {r.recommendations.map((rec: string, i: number) => (
            <div key={i} style={{ fontSize:7, color:'rgba(255,255,255,0.7)', marginBottom:2, lineHeight:1.3 }}>• {rec}</div>
          ))}
        </div>}
      </>}
    </div>
  );
};

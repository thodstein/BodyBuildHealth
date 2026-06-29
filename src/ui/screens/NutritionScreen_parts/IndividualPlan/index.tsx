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
  return (
    <div style={{ paddingBottom: 80 }}>
      <button onClick={() => { generateFullNutritionReport?.(); setGenerated(true); }} style={{
        padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:10, fontWeight:700,
        background:'linear-gradient(135deg,#00e68a,#00c8a0)', border:'none', color:'#000', marginBottom:8,
      }}>📊 Сгенерировать отчёт</button>
      {!r && generated && <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)' }}>⚠️ Сначала создайте план на день.</div>}
      {r && <>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <span style={{ fontSize:24, fontWeight:800, color: gradeColor[r.overallGrade] || '#fff' }}>{r.overallGrade}</span>
          <span style={{ fontSize:10, color:'rgba(255,255,255,0.9)' }}>{r.overallGradeLabel}</span>
        </div>
        <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#60a5fa', marginBottom:4 }}>🥗 КБЖУ</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2, fontSize:8 }}>
            <span>Ккал: {Math.round(r.kbjuPct.kcal)}%</span>
            <span>Белки: {Math.round(r.kbjuPct.p)}%</span>
            <span>Жиры: {Math.round(r.kbjuPct.f)}%</span>
            <span>Углеводы: {Math.round(r.kbjuPct.c)}%</span>
          </div>
        </div>
        {r.waterBalance && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#60a5fa', marginBottom:4 }}>💧 Вода</div>
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)' }}>
            {r.waterBalance.intakeMl} / {r.waterBalance.targetMl} мл ({r.waterBalance.intakePerKg} мл/кг)
            {r.waterBalance.status === 'low' && ' ⚠️ Недостаточно'}
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.85)', marginTop:2 }}>{r.waterBalance.recommendation}</div>
          </div>
        </div>}
        {r.sodiumPotassium && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#f59e0b', marginBottom:4 }}>🧂 Натрий/Калий</div>
          <div style={{ fontSize:8 }}>Na {r.sodiumPotassium.naMg}мг / K {r.sodiumPotassium.kMg}мг = {r.sodiumPotassium.ratio.toFixed(1)} (норма {r.sodiumPotassium.targetRatio})</div>
          {r.sodiumPotassium.recommendation && <div style={{ fontSize:7, color:'rgba(255,255,255,0.85)', marginTop:2 }}>{r.sodiumPotassium.recommendation}</div>}
        </div>}
        {r.proteinTiming && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#8b5cf6', marginBottom:4 }}>⏱ Тайминг белка</div>
          <div style={{ fontSize:8 }}>Равномерность: {r.proteinTiming.evennessScore.toFixed(0)}%, макс.перерыв: {r.proteinTiming.maxGapHours}ч</div>
          {r.proteinTiming.gaps.length > 0 && <div style={{ fontSize:7, color:'#f59e0b' }}>Пропуски: {r.proteinTiming.gaps.join(', ')}</div>}
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.85)', marginTop:2 }}>{r.proteinTiming.recommendation}</div>
        </div>}
        {r.glycemicLoad && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#f97316', marginBottom:4 }}>🍬 Гликемическая нагрузка</div>
          <div style={{ fontSize:8 }}>ГН {r.glycemicLoad.totalGL.toFixed(0)}, ср.ГИ {r.glycemicLoad.avgGI.toFixed(0)}, макс/приём {r.glycemicLoad.maxPerMeal.toFixed(0)}</div>
          {r.glycemicLoad.status === 'high' && <div style={{ fontSize:7, color:'#ef4444' }}>⚠️ Высокая — замените быстрые углеводы</div>}
        </div>}
        {r.fatQuality && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#f59e0b', marginBottom:4 }}>🧈 Качество жиров</div>
          <div style={{ fontSize:8 }}>Насыщ. {r.fatQuality.satG.toFixed(0)}г, ненасыщ. {r.fatQuality.unsatG.toFixed(0)}г, Омега-3 {r.fatQuality.omega3G.toFixed(2)}г</div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.85)', marginTop:2 }}>{r.fatQuality.recommendation}</div>
        </div>}
        {r.fiberAnalysis && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#22c55e', marginBottom:4 }}>🌿 Клетчатка</div>
          <div style={{ fontSize:8 }}>{r.fiberAnalysis.totalG.toFixed(0)} / {r.fiberAnalysis.targetG}г ({Math.round(r.fiberAnalysis.pct)}%)</div>
          {r.fiberAnalysis.recommendation && <div style={{ fontSize:7, color:'rgba(255,255,255,0.85)', marginTop:2 }}>{r.fiberAnalysis.recommendation}</div>}
        </div>}
        {r.calciumMagnesium && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#a78bfa', marginBottom:4 }}>🦴 Кальций/Магний</div>
          <div style={{ fontSize:8 }}>Ca {r.calciumMagnesium.caMg}мг / Mg {r.calciumMagnesium.mgMg}мг = {r.calciumMagnesium.ratio.toFixed(1)} (норма {r.calciumMagnesium.targetRatio})</div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.85)', marginTop:2 }}>{r.calciumMagnesium.recommendation}</div>
        </div>}
        {r.microDeficiencies.length > 0 && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#ef4444', marginBottom:4 }}>💊 Дефициты микронутриентов</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
            {r.microDeficiencies.map((m: string) => <span key={m} style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(239,68,68,0.1)', color:'#ef4444' }}>{m}</span>)}
          </div>
        </div>}
        {r.riskAnalysis.length > 0 && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#f97316', marginBottom:4 }}>⚠️ Анализ рисков</div>
          {r.riskAnalysis.map((risk: { system: string; score: number; maxScore: number; impact: string }, i: number) => (
            <div key={i} style={{ fontSize:7, marginBottom:2, color:'rgba(255,255,255,0.7)' }}>
              {risk.system}: {risk.score}/{risk.maxScore} — {risk.impact}
            </div>
          ))}
        </div>}
        {r.foodQualityScore && <div style={card}>
          <div style={{ fontSize:9, fontWeight:600, color:'#00e68a', marginBottom:4 }}>⭐ Качество продуктов: {r.foodQualityScore.toFixed(1)}</div>
          {r.foodQualityDetails && <>
            {r.foodQualityDetails.bestItems.length > 0 && <div style={{ fontSize:7, color:'#00e68a' }}>✅ Лучшие: {r.foodQualityDetails.bestItems.join(', ')}</div>}
            {r.foodQualityDetails.weakItems.length > 0 && <div style={{ fontSize:7, color:'#f59e0b', marginTop:2 }}>⚠️ Слабые: {r.foodQualityDetails.weakItems.join(', ')}</div>}
          </>}
        </div>}
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

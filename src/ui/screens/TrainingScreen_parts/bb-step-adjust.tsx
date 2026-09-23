/**
 * bb-step-adjust.tsx — шаг 6 ББ-авто («🛠 Ручная коррекция»), вынесен из
 * god-component `BbAutoConstructor.tsx` (§4.3, этап 3). Перенос 1-в-1:
 * логика/тексты/стили не менялись, все state-ссылки/хендлеры переданы явными props.
 * Внутри — 4 секции: фидбэк план→выполнение, наглядность (heatmap/taper/таблица/FF),
 * план vs факт по дневнику, инструменты коррекции + инлайн-редактор упражнений.
 */
import React from 'react';
import { getExercisesByGroup } from '../../../core/exercise-catalog';
import type { BBPlan } from '../../../engines/bb/bb-builder.engine';
import type { BBPlanMetrics } from '../../../engines/bb/bb-metrics.engine';
import { isCompoundEx } from '../../../engines/bb/bb-session-order.engine';
import type { DUPMode } from '../../../engines/bb/bb-dup.engine';
import type { LoadStrategy } from '../../../engines/bb/bb-autocoach.engine';
import { getPlanFeedback } from '../../../engines/plan-execution-feedback.engine';
import { loadSessions } from '../../../engines/workout-logger.engine';
import { buildBBMuscleHeatmap, BB_PHASE_COLOR, BB_PHASE_LABEL_RU, buildBBMesocycleTable, buildBBTaperCurve, buildBBFitnessFatigue, compareBBVariants, type WeekDateRange } from '../../../engines/bb/bb-visual.engine';
import { buildBBPlanFact, bbPlanFactSummary, bbAdherenceBadge } from '../../../engines/bb/bb-plan-fact.engine';
import { MUSCLE_LABEL_RU } from '../../../engines/volume-landmarks.engine';
import type { BBContestCategory, ContestSpecialization } from '../../../engines/bb/bb-contest-prep.engine';
import { PlanFeedbackCard } from './PlanFeedbackCard';
import { FFChart } from '../SRCBBScreen_parts/ProMetricsPanel';
import { PopupSelect, ExpandableCard } from '../SRCBBScreen_parts/TrainingPopups';
import { BTN, BTN_GHOST, IN, SMALL, H } from './training-ui';
import { PHASE_COLORS } from './PlanOutput';
import { CollapsibleCard, phaseForWeek, exerciseComment, backSubgroupLabel, armHeadLabel, type BBPhase, type Step } from './bb-auto-constructor-shared';
import { exerciseFeatureBadges, planSetsBreakdown, canonTechniqueId } from './bb-technique-display';
import { muscleLabel } from './bb-labels';
import type { SavedBBPlan } from './bb-plans-store';

export interface BbAdjustStepProps {
  builtPlan: BBPlan | null;
  metrics: BBPlanMetrics | null;
  setBuiltPlan: React.Dispatch<React.SetStateAction<BBPlan | null>>;
  bbWorkMax: Record<string, number>;
  loadStrategy: LoadStrategy;
  /** Инлайн-правки упражнений (ключ `${si}-${ei}`). */
  exerciseEdits: Record<string, { sets: number; reps: number; weight: number; rir?: number; tempo?: string; technique?: string; supersetWith?: string }>;
  setExerciseEdits: React.Dispatch<React.SetStateAction<Record<string, { sets: number; reps: number; weight: number; rir?: number; tempo?: string; technique?: string; supersetWith?: string }>>>;
  editsRef: React.MutableRefObject<Record<string, any>>;
  commitEdits: (next: Record<string, any>) => void;
  editsHistory: Array<Record<string, any>>;
  redosHistory: Array<Record<string, any>>;
  undoEdits: () => void;
  redoEdits: () => void;
  bulkModal: boolean;
  setBulkModal: React.Dispatch<React.SetStateAction<boolean>>;
  bulkField: 'sets' | 'reps' | 'weight';
  setBulkField: React.Dispatch<React.SetStateAction<'sets' | 'reps' | 'weight'>>;
  bulkMode: 'set' | 'mult';
  setBulkMode: React.Dispatch<React.SetStateAction<'set' | 'mult'>>;
  bulkValue: number;
  setBulkValue: React.Dispatch<React.SetStateAction<number>>;
  bbWeekSel: number;
  setBbWeekSel: React.Dispatch<React.SetStateAction<number>>;
  bbWeeks: number;
  startDateInput: string;
  setStartDateInput: React.Dispatch<React.SetStateAction<string>>;
  currentWeek: WeekDateRange | undefined;
  savedPlans: SavedBBPlan[];
  showCompare: boolean;
  setShowCompare: React.Dispatch<React.SetStateAction<boolean>>;
  diffVariantId: string | null;
  setDiffVariantId: React.Dispatch<React.SetStateAction<string | null>>;
  diffPlan: any;
  peakWeekCategory: BBContestCategory;
  peakSpec: ContestSpecialization;
  weakPoints: string[];
  dupMode: DUPMode;
  flash: (m: string) => void;
  setStep: React.Dispatch<React.SetStateAction<Step>>;
  setExSwapModal: React.Dispatch<React.SetStateAction<{ si: number; ei: number; muscle: string; currentName: string } | null>>;
  adjustVolume: (mult: number) => void;
  adjustWeight: (mult: number) => void;
  handleSavePlan: () => void;
  handleSaveToMyPlans: () => void;
  handleSaveAsUserProgram: () => void;
  handleSaveVariant: () => void;
  handleSendToNutrition: () => void;
  handleSendToExecution: () => void;
  handlePrintPlan: () => void;
  handleExportIcs: () => void;
  handlePrintMesocycleTable: () => void;
  handleExportQualityReport: () => void;
  handleExportCSV: () => void;
  handleLoadVariant: (v: SavedBBPlan) => void;
  handleDeleteVariant: (id: string) => void;
  handleMoveExercise: (si: number, ei: number, dir: -1 | 1) => void;
  applyPeakWeekToCurrentPlan: (category: BBContestCategory, spec?: ContestSpecialization) => void;
  applyEditsToPlan: (plan: BBPlan) => BBPlan;
}

export const BbAdjustStep: React.FC<BbAdjustStepProps> = ({
  builtPlan, metrics, setBuiltPlan, bbWorkMax, loadStrategy,
  exerciseEdits, setExerciseEdits, editsRef, commitEdits, editsHistory, redosHistory, undoEdits, redoEdits,
  bulkModal, setBulkModal, bulkField, setBulkField, bulkMode, setBulkMode, bulkValue, setBulkValue,
  bbWeekSel, setBbWeekSel, bbWeeks, startDateInput, setStartDateInput, currentWeek,
  savedPlans, showCompare, setShowCompare, diffVariantId, setDiffVariantId, diffPlan,
  peakWeekCategory, peakSpec,
  weakPoints, dupMode, flash, setStep, setExSwapModal,
  adjustVolume, adjustWeight,
  handleSavePlan, handleSaveToMyPlans, handleSaveAsUserProgram, handleSaveVariant,
  handleSendToNutrition, handleSendToExecution, handlePrintPlan, handleExportIcs,
  handlePrintMesocycleTable, handleExportQualityReport, handleExportCSV,
  handleLoadVariant, handleDeleteVariant, handleMoveExercise, applyPeakWeekToCurrentPlan, applyEditsToPlan,
}) => {
  if (!builtPlan || !metrics) return null;
  const W = builtPlan.weeks;
  const wk = W[Math.min(bbWeekSel, W.length) - 1] || W[0];
  const currentPhase = ((wk as any).phase || ((wk as any).deload ? 'deload' : 'accumulation')) as BBPhase;
  return (
    <div>
      <div style={H}>🛠 Шаг 7: Ручная коррекция</div>
      {(() => {
        const fb = getPlanFeedback();
        return fb.reasons.length > 0 && fb.avgRpe > 0 ? (
          <CollapsibleCard title="📊 Фидбэк план → выполнение" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.14), rgba(139,92,246,0.05))', color: '#a78bfa' }} badge={fb.deloadRecommended ? 'разгрузка' : undefined}>
            {fb.deloadRecommended && <div style={{ padding:'4px 8px', borderRadius:8, background:'rgba(239,68,68,0.12)', color:'#ef4444', fontSize:11, fontWeight:700, marginBottom:6 }}>⛔ РЕКОМЕНДОВАНА РАЗГРУЗКА</div>}
            {fb.reasons.map((r,i) => <div key={i} style={{ fontSize:11, color:'#fff', marginBottom:3, padding:'3px 0' }}>{r}</div>)}
            <div style={{ display:'flex', gap:8, marginTop:6 }}>
              {fb.weightMultiplier !== 1 && <span style={{ padding:'2px 6px', borderRadius:4, fontSize:11, background:'rgba(96,165,250,0.1)', color:'#60a5fa' }}>Вес ×{fb.weightMultiplier}</span>}
              {fb.rirShift !== 0 && <span style={{ padding:'2px 6px', borderRadius:4, fontSize:11, background:'rgba(245,158,11,0.1)', color:'#f59e0b' }}>RIR {fb.rirShift > 0 ? '+':''}{fb.rirShift}</span>}
              {fb.volumeMultiplier !== 1 && <span style={{ padding:'2px 6px', borderRadius:4, fontSize:11, background:'rgba(34,197,94,0.1)', color:'#22c55e' }}>Объём ×{fb.volumeMultiplier}</span>}
            </div>
          </CollapsibleCard>
        ) : null;
      })()}
      <PlanFeedbackCard plan={builtPlan} workMax={bbWorkMax} strategy={loadStrategy} onApply={setBuiltPlan} />
      <CollapsibleCard title="📊 Наглядность (heatmap · taper-кривая · объём)" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.04))', color: '#a78bfa' }} badge="мышца×неделя · тапер">
        {(() => {
          const plan = applyEditsToPlan(builtPlan);
          const hm = buildBBMuscleHeatmap(plan);
          const hmWeeks = [...new Set(hm.map(h => h.week))].sort((a, b) => a - b);
          const hmMuscles = [...new Set(hm.map(h => h.muscle))];
          const hmColor: Record<string, string> = { below_mev: '#f87171', mev_mav: '#22c55e', above_mav: '#f59e0b', over_mrv: '#ef4444', none: '#e5e7eb' };
          const taper = buildBBTaperCurve(plan);
          return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, color: '#fff' }}>🧬 Heatmap «мышца × неделя» (объём по MEV/MAV/MRV):</div>
            <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 10, minWidth: 300 }}>
                <thead><tr><th style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '3px 6px', textAlign: 'left' }}>Мышца</th>{hmWeeks.map(w => <th key={w} style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '3px 6px' }}>Нед {w}</th>)}</tr></thead>
                <tbody>{hmMuscles.map(m => <tr key={m}><td style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '3px 6px' }}>{m}</td>{hmWeeks.map(w => { const c = hm.find(h => h.muscle === m && h.week === w); return <td key={w} style={{ border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', background: c ? (hmColor[c.status] + '22') : 'transparent', color: c ? hmColor[c.status] : 'rgba(255,255,255,0.4)' }}>{c ? c.sets : '·'}</td>; })}</tr>)}</tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'rgba(255,255,255,0.7)', flexWrap: 'wrap' }}>
              <span><span style={{ color: '#f87171' }}>■</span> {'<'} MEV</span>
              <span><span style={{ color: '#22c55e' }}>■</span> MEV–MAV</span>
              <span><span style={{ color: '#f59e0b' }}>■</span> {'>'} MAV</span>
              <span><span style={{ color: '#ef4444' }}>■</span> {'>'} MRV</span>
            </div>
            {taper.length > 0 && <div style={{ fontSize: 11, color: '#fff' }}>
              📉 Кривая тапера (финальные недели): <span style={{ color: '#e11d48' }}>объём ↓</span>, интенсивность сохраняется, RIR 2-4.
              <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'flex-end' }}>
                {taper.map(t => (
                  <div key={t.week} style={{ flex: 1, textAlign: 'center' }}>
                    <div title={`${t.label}: ${Math.round(t.volumePct * 100)}% · RIR ${t.rir[0]}-${t.rir[1]}`} style={{ height: Math.max(6, Math.round(t.volumePct * 56)), borderRadius: 6, background: 'linear-gradient(180deg,#e11d48,#7f1d1d)', border: '1px solid rgba(225,29,72,0.4)', boxShadow: '0 0 8px rgba(225,29,72,0.25)' }} />
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>нед {t.week}</div>
                    <div style={{ fontSize: 9, color: '#fca5a5', fontWeight: 700 }}>{Math.round(t.volumePct * 100)}%</div>
                  </div>
                ))}
              </div>
            </div>}
            <div style={{ fontSize: 11, color: '#fff' }}>📋 Вся таблица мезоцикла (неделя × день × упражнение):</div>
            <div style={{ overflowX: 'auto', scrollbarWidth: 'none', maxHeight: 320, overflowY: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 10, minWidth: 520 }}>
                <thead><tr style={{ position: 'sticky', top: 0, background: '#18181b' }}>
                  <th style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '3px 6px' }}>Нед</th><th style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '3px 6px' }}>Фаза</th><th style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '3px 6px' }}>День</th><th style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '3px 6px' }}>Упражнение</th><th style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '3px 6px' }}>Мышца</th><th style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '3px 6px' }}>Сеты</th><th style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '3px 6px' }}>Повт</th><th style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '3px 6px' }}>Вес</th><th style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '3px 6px' }}>RIR</th></tr></thead>
                <tbody>{buildBBMesocycleTable(plan).map((r, ri) => r.exercises.map((ex, xi) => (
                  <tr key={`${ri}-${xi}`}><td style={{ border: '1px solid rgba(255,255,255,0.05)', padding: '2px 6px', color: BB_PHASE_COLOR[r.phase] || '#fff' }}>{r.week}</td><td style={{ border: '1px solid rgba(255,255,255,0.05)', padding: '2px 6px' }}>{BB_PHASE_LABEL_RU[r.phase] || r.phase}</td><td style={{ border: '1px solid rgba(255,255,255,0.05)', padding: '2px 6px' }}>{r.day}</td><td style={{ border: '1px solid rgba(255,255,255,0.05)', padding: '2px 6px' }}>{ex.name}</td><td style={{ border: '1px solid rgba(255,255,255,0.05)', padding: '2px 6px' }}>{ex.muscle}</td><td style={{ border: '1px solid rgba(255,255,255,0.05)', padding: '2px 6px', textAlign: 'center' }}>{ex.sets}</td><td style={{ border: '1px solid rgba(255,255,255,0.05)', padding: '2px 6px', textAlign: 'center' }}>{ex.reps}</td><td style={{ border: '1px solid rgba(255,255,255,0.05)', padding: '2px 6px', textAlign: 'center' }}>{ex.weight}</td><td style={{ border: '1px solid rgba(255,255,255,0.05)', padding: '2px 6px', textAlign: 'center' }}>{ex.rir}</td></tr>
                )))}</tbody>
              </table>
            </div>
            <div style={{ fontSize: 11, color: '#fff' }}>⚡ Прогноз утомления fitness–fatigue (Banister):</div>
            <FFChart series={buildBBFitnessFatigue(plan, { startDate: startDateInput || undefined })} />
          </div>;
        })()}
      </CollapsibleCard>
      <CollapsibleCard title="📊 План vs факт (по дневнику)" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(0,230,138,0.10), rgba(0,230,138,0.03))', color: '#00e68a' }} badge="сеты · тоннаж · RIR">
        {(() => {
          const diary = (() => { try { return loadSessions(); } catch { return []; } })();
          const fact = buildBBPlanFact(applyEditsToPlan(builtPlan) as any, diary as any, startDateInput || undefined);
          if (!fact.weeks.length) return <div style={{ fontSize: 11, opacity: 0.7 }}>Нет плана для сравнения.</div>;
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#fff' }}>{bbPlanFactSummary(fact)}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 16, background: 'rgba(0,230,138,0.12)', color: fact.overallAdherence >= 0.9 ? '#00e68a' : fact.overallAdherence >= 0.6 ? '#fbbf24' : '#f87171', border: '1px solid rgba(0,230,138,0.3)' }}>
                  общая adherence {Math.round(fact.overallAdherence * 100)}%
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {fact.weeks.map(w => {
                  const b = bbAdherenceBadge(w.actual.adherence);
                  return (
                    <div key={w.weekNumber} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#00e68a', width: 62 }}>нед {w.weekNumber}</span>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', width: 108 }}>{w.startDate?.slice(5)}–{w.endDate?.slice(5)}</span>
                      <span style={{ flex: 1, fontSize: 10, color: '#fff' }}>
                        план {w.planned.sets} с. · {Math.round(w.planned.tonnage)} кг
                        {w.actual.sessions > 0 ? ` → факт ${w.actual.sets} с. · ${Math.round(w.actual.tonnage)} кг · RIR ${w.actual.avgRir.toFixed(1)}` : ''}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: b.color, whiteSpace: 'nowrap' }}>{b.label}</span>
                    </div>
                  );
                })}
              </div>
              {Object.keys(fact.byMuscle).length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>По мышцам:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {Object.entries(fact.byMuscle).map(([m, v]) => (
                      <span key={m} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: v.adherence >= 0.9 ? 'rgba(0,230,138,0.12)' : v.adherence >= 0.6 ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.12)', color: v.adherence >= 0.9 ? '#00e68a' : v.adherence >= 0.6 ? '#fbbf24' : '#f87171', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {MUSCLE_LABEL_RU[m] || m}: {v.actualSets}/{v.plannedSets}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {fact.unmatchedSessions.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
                  {fact.unmatchedSessions.length} сессий вне диапазона плана (даты не совпадают с неделями мезо).
                </div>
              )}
            </div>
          );
        })()}
      </CollapsibleCard>
      <CollapsibleCard title="🔧 Инструменты коррекции" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.12), rgba(96,165,250,0.04))', color: '#60a5fa' }} badge="объём · вес · пик · сравнение">
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            {/* Фаза 4.23: дата старта мезоцикла + «📍 текущая неделя» */}
            <label style={{ fontSize:11, color:'rgba(255,255,255,0.7)', display:'inline-flex', alignItems:'center', gap:4 }}>
              📅 Старт:
              <input type="date" value={startDateInput || ''} onChange={e => setStartDateInput(e.target.value)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, color:'#fff', fontSize:11, padding:'3px 6px' }} />
            </label>
            {currentWeek ? <span style={{ fontSize:11, color:'#38bdf8', fontWeight:700, background:'rgba(56,189,248,0.12)', padding:'3px 8px', borderRadius:16, border:'1px solid rgba(56,189,248,0.25)' }}>📍 Текущая неделя: {currentWeek.week} ({currentWeek.start})</span> : null}
            {builtPlan.validation && !builtPlan.validation.valid && <div style={{ width:'100%', fontSize:11, color:'#f59e0b' }}>⚠ Есть предупреждения валидации — сохранение доступно, но проверьте замечания.</div>}
           <button style={BTN_GHOST} onClick={() => adjustVolume(0.8)}>📦 Объём -20%</button>
           <button style={BTN_GHOST} onClick={() => adjustVolume(1.1)}>📦 Объём +10%</button>
           <button style={BTN_GHOST} onClick={() => adjustWeight(1.05)}>⚖ Вес +5%</button>
           <button style={BTN_GHOST} onClick={() => adjustWeight(0.95)}>⚖ Вес -5%</button>
           <button style={BTN_GHOST} onClick={() => { setExerciseEdits({}); setStep('split'); }}>🔄 Перестроить план</button>
            <button style={BTN_GHOST} onClick={handleSavePlan}>💾 Сохранить план</button>
            <button style={{ ...BTN_GHOST, borderColor:'#60a5fa', color:'#60a5fa' }} onClick={handleSaveToMyPlans}>💾 В Мои тренировки</button>
            <button style={{ ...BTN_GHOST, borderColor:'#a78bfa', color:'#a78bfa' }} onClick={handleSaveAsUserProgram}>📂 В Мои программы</button>
            <button style={{ ...BTN_GHOST, borderColor:'#22c55e', color:'#22c55e' }} onClick={handleSaveVariant}>💾 Вариант ({savedPlans.length})</button>
            <button style={{ ...BTN_GHOST, borderColor:'#f59e0b', color:'#f59e0b' }} onClick={() => setShowCompare(s => !s)}>⚖ Сравнить</button>
            <button style={{ ...BTN_GHOST, borderColor:'#22c55e', color:'#22c55e' }} onClick={handleSendToNutrition}>🍽 В планировщик питания</button>
             <button style={{ ...BTN_GHOST, borderColor:'#a855f7', color:'#a855f7' }} onClick={handleSendToExecution}>▶ К выполнению</button>
            <button style={{ ...BTN_GHOST, borderColor:'#ec4899', color:'#ec4899' }} onClick={() => applyPeakWeekToCurrentPlan(peakWeekCategory)}>🎭 Peak week</button>
            <button style={{ ...BTN_GHOST, borderColor:'#f472b6', color:'#f472b6' }} onClick={() => setStep('contest')}>🏁 Contest prep</button>
            <button style={{ ...BTN_GHOST, borderColor:'#38bdf8', color:'#38bdf8' }} aria-label="Открыть ББ-диагностику" onClick={() => { try { window.dispatchEvent(new CustomEvent('training-open-tab', { detail: 'bb_diagnostics_hub' })); } catch {} }}>🎯 ББ-диагностика</button>
           <button style={BTN_GHOST} onClick={handlePrintPlan}>🖨 PDF</button>
            <button style={BTN_GHOST} onClick={handleExportIcs}>📅 .ics</button>
            <button style={BTN_GHOST} onClick={handlePrintMesocycleTable}>📋 Вся таблица</button>
           <button style={BTN_GHOST} onClick={handleExportQualityReport}>📄 Отчёт (txt)</button>
           <button style={BTN_GHOST} onClick={handleExportCSV}>📥 CSV</button>
          </div>

        {/* PRO-3 Э11: мёртвая ветка showPeakWeek/peakPrep удалена — пик-неделя живёт в шаге contest + дедуп ContestPeakWeekCard */}

        {/* Мульти-планы: сравнение вариантов */}
        {showCompare && savedPlans.length > 0 && (
          <div style={{ marginTop:10, padding:12, borderRadius:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
            <div style={{ fontSize:12, fontWeight:800, color:'#f59e0b', marginBottom:8 }}>⚖ Сравнение вариантов ({savedPlans.length})</div>
            <div style={{ overflowX:'auto', scrollbarWidth:'none' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10, minWidth:500 }}>
                <thead>
                  <tr style={{ color:'#fff', textAlign:'left' }}>
                    <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>Вариант</th>
                    <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>Сеты</th>
                    <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>RIR</th>
                    <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>Дней</th>
                    <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>Групп</th>
                     <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>PED MRV</th>
                     <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>Пик direct/effective</th>
                     <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>Время/axial</th>
                    <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>Кач-во</th>
                    <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {savedPlans.map(v => (
                    <tr key={v.id} style={{ color:'#fff' }}>
                      <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', fontWeight:600 }}>{v.name}</td>
                      <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>{v.metrics.totalSets}</td>
                      <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>{v.metrics.avgRir.toFixed(1)}</td>
                      <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>{v.metrics.sessionsPerWeek}</td>
                      <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>{v.metrics.muscleCount}</td>
                      <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>×{v.metrics.mrvMult.toFixed(2)}</td>
                       <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>{v.metrics.peakDirectSets ?? '—'} / {v.metrics.peakEffectiveSets != null ? Math.round(v.metrics.peakEffectiveSets * 10) / 10 : '—'}</td>
                       <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>{v.metrics.maxSessionMinutes ?? '—'} / {v.metrics.maxAxialCost != null ? v.metrics.maxAxialCost.toFixed(1) : '—'}</td>
                      <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>
                        <span style={{ color: v.metrics.qualityScore >= 75 ? '#22c55e' : v.metrics.qualityScore >= 50 ? '#f59e0b' : '#ef4444', fontWeight:700 }}>{v.metrics.qualityScore}</span>
                      </td>
                      <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', gap:4 }}>
                        <button onClick={() => setDiffVariantId(prev => prev === v.id ? null : v.id)} style={{ padding:'3px 8px', borderRadius:6, border:'1px solid rgba(56,189,248,0.35)', background: diffVariantId === v.id ? 'rgba(56,189,248,0.18)' : 'rgba(56,189,248,0.08)', color:'#38bdf8', cursor:'pointer', fontSize:11, fontWeight:700 }} title="По-недельный дифф vs текущий">Дифф</button>
                        <button onClick={() => handleLoadVariant(v)} style={{ padding:'3px 8px', borderRadius:6, border:'1px solid rgba(0,230,138,0.3)', background:'rgba(0,230,138,0.08)', color:'#00e68a', cursor:'pointer', fontSize:11, fontWeight:700 }}>↩</button>
                        <button onClick={() => handleDeleteVariant(v.id)} style={{ padding:'3px 8px', borderRadius:6, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', color:'#ef4444', cursor:'pointer', fontSize:11, fontWeight:700 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {diffPlan && builtPlan && (() => {
              const weekDiff = compareBBVariants(applyEditsToPlan(builtPlan), diffPlan);
              const meaningful = weekDiff.filter(d => d.changes > 0);
              if (meaningful.length === 0) return null;
              return (
                <div style={{ marginTop:8, padding:8, borderRadius:8, background:'rgba(56,189,248,0.05)', border:'1px solid rgba(56,189,248,0.15)' }}>
                <div style={{ fontSize:11, fontWeight:800, color:'#38bdf8', marginBottom:4 }}>🔬 По-недельный дифф (текущий → «{diffPlan?.pattern?.name || 'вариант'}»)</div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10 }}>
                  <thead><tr style={{ color:'#fff', textAlign:'left' }}><th style={{ padding:'3px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>Неделя</th><th style={{ padding:'3px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>Изменения</th></tr></thead>
                  <tbody>{meaningful.map(d => (
                    <tr key={d.week}><td style={{ padding:'3px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>Нед {d.week}</td><td style={{ padding:'3px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', color:'#f59e0b' }}>{d.detail.join(' · ')}</td></tr>
                  ))}</tbody>
                </table>
              </div>);
            })()}
            <div style={{ marginTop:6, fontSize:10, color:'#fff' }}>↩ — загрузить вариант · ✕ — удалить · 🔬 Дифф — по неделям vs текущий · максимум 8 вариантов</div>
          </div>
        )}
      </CollapsibleCard>
      {/* Per-exercise editing zone */}
      <CollapsibleCard title={`✏️ Редактор упражнений — неделя ${bbWeekSel}`} defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(0,230,138,0.12), rgba(0,230,138,0.04))', color: '#00e68a' }} badge={`${wk.sessions.length} дн · ${W.length} нед`}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <span style={{ fontSize:11, color:'#fff', opacity:0.7 }}>Выберите неделю для правки упражнений</span>
          <div style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap' }}>
            {editsHistory.length > 0 && <button onClick={undoEdits} style={{ padding:'3px 8px', borderRadius:8, fontSize:11, cursor:'pointer', border:'1px solid rgba(96,165,250,0.3)', background:'rgba(96,165,250,0.1)', color:'#60a5fa' }} title="Отменить последнюю правку">↩ Отменить</button>}
            {redosHistory.length > 0 && <button onClick={redoEdits} style={{ padding:'3px 8px', borderRadius:8, fontSize:11, cursor:'pointer', border:'1px solid rgba(139,92,246,0.3)', background:'rgba(139,92,246,0.1)', color:'#a78bfa' }} title="Повторить правку">↪ Повторить</button>}
            <button onClick={() => setBulkModal(true)} style={{ padding:'3px 8px', borderRadius:8, fontSize:11, cursor:'pointer', border:'1px solid rgba(245,158,11,0.3)', background:'rgba(245,158,11,0.1)', color:'#f59e0b' }} title="Применить ко всем упражнениям недели">⚡ Пакетно</button>
            {W.map(w => {
              const ph = phaseForWeek(w.week, bbWeeks);
              return <button key={w.week} onClick={() => setBbWeekSel(w.week)} style={{ padding:'3px 8px', borderRadius:8, fontSize:11, cursor:'pointer', border:w.week===bbWeekSel?'1px solid ' + PHASE_COLORS[ph]:'1px solid rgba(255,255,255,0.08)', background:w.week===bbWeekSel?PHASE_COLORS[ph]+'20':'transparent', color:w.week===bbWeekSel?PHASE_COLORS[ph]:'#fff' }}>{w.week}</button>;
            })}
          </div>
        </div>
        {bulkModal && (
          <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:10, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#f59e0b', marginBottom:6 }}>⚡ Пакетное редактирование — неделя {bbWeekSel}</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
              <PopupSelect
                label="Поле"
                value={bulkField}
                onChange={v => setBulkField(v as any)}
                options={[{ id: 'sets', label: 'Сеты' }, { id: 'reps', label: 'Повторы' }, { id: 'weight', label: 'Вес, кг' }]}
              />
              <PopupSelect
                label="Режим"
                value={bulkMode}
                onChange={v => setBulkMode(v as any)}
                options={[{ id: 'set', label: '= задать' }, { id: 'mult', label: '× умножить' }]}
              />
              <input type="number" value={bulkValue} onChange={e2 => setBulkValue(parseFloat(e2.target.value) || 0)} style={{ width:60, ...IN }} />
              <button onClick={() => {
                const next: any = { ...editsRef.current };
                for (const s of wk.sessions) for (let ei = 0; ei < s.exercises.length; ei++) {
                  const key = `${wk.sessions.indexOf(s)}-${ei}`;
                  const cur = next[key] || { sets: s.exercises[ei].sets, reps: s.exercises[ei].workSets?.[0]?.reps || 10, weight: s.exercises[ei].workSets?.[0]?.weight || 80 };
                  if (bulkMode === 'mult') next[key] = { ...cur, [bulkField]: Math.round((cur[bulkField] || 0) * bulkValue) };
                  else next[key] = { ...cur, [bulkField]: bulkValue };
                }
                commitEdits(next); setBulkModal(false); flash('⚡ Пакетно применено к неделе ' + bbWeekSel);
              }} style={{ padding:'4px 10px', borderRadius:8, fontSize:11, cursor:'pointer', border:'1px solid rgba(245,158,11,0.35)', background:'rgba(245,158,11,0.15)', color:'#f59e0b', fontWeight:700 }}>Применить ко всем</button>
              <button onClick={() => setBulkModal(false)} style={{ padding:'4px 10px', borderRadius:8, fontSize:11, cursor:'pointer', border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'#fff' }}>✕</button>
            </div>
          </div>
        )}
        {wk.sessions.map((s, si) => (
          <ExpandableCard key={si} title={'День ' + (si+1) + ' · ' + s.character + ' (' + s.exercises.length + ' упр.)'} icon="🏋️" short={s.exercises.map(e => e.name).join(', ')} full={
            <div>
              {s.exercises.map((e, ei) => {
                const editKey = `${si}-${ei}`;
                const edit = exerciseEdits[editKey] || { sets: e.sets, reps: e.workSets[0]?.reps || 10, weight: e.workSets[0]?.weight || 80 };
                const isComp = isCompoundEx(e);
                const altExercises = getExercisesByGroup(e.muscle).filter(x => x.name !== e.name).slice(0, 5);
                const editBadges = exerciseFeatureBadges(e, dupMode);
                const { lines: editSetLines, chain: editSetChain } = planSetsBreakdown(e, edit);
                return <div key={ei} style={{ marginBottom:8, padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontWeight:700, fontSize:11, color:'#fff', marginBottom:4 }}>{ei+1}. {e.name} <span style={{ fontWeight:400, fontSize:11, color:'#fff' }}>({muscleLabel(e.muscle)})</span> <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:5, background:(isComp?'#00e68a':'#f59e0b')+'20', color:isComp?'#00e68a':'#f59e0b', marginLeft:6 }}>{isComp?'База':'Изо'}</span>
                    {(e as any).warmupActivator && <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:5, background:'rgba(148,163,184,0.15)', color:'#94a3b8', marginLeft:6 }}>🔥 Разминка</span>}
                    {e.muscle === 'back' && backSubgroupLabel((e as any).backSubgroup) && <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:5, background:'rgba(45,212,191,0.15)', color:'#2dd4bf', marginLeft:6 }}>{backSubgroupLabel((e as any).backSubgroup)}</span>}
                    {['biceps', 'triceps', 'forearms'].includes(e.muscle) && armHeadLabel((e as any).movementPattern) && <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:5, background:'rgba(232,121,249,0.15)', color:'#e879f9', marginLeft:6 }}>{armHeadLabel((e as any).movementPattern)}</span>}
                    {editBadges.map((fb, fbi) => <span key={fbi} style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:5, background:fb.color+'20', color:fb.color, marginLeft:6 }}>{fb.icon} {fb.label}</span>)}
                  </div>
                  <div style={{ display:'flex', gap:8, marginBottom:6, flexWrap:'wrap', alignItems:'center' }}>
                    <div><span style={{ ...SMALL, fontSize:11 }}>Сеты</span><input type="number" value={edit.sets} min={0} max={20} onChange={e2 => commitEdits({ ...editsRef.current, [editKey]: { ...edit, sets: parseInt(e2.target.value) || 0 } })} style={{ width:45, background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'4px 8px', fontSize:11 }} /></div>
                    <div><span style={{ ...SMALL, fontSize:11 }}>Повт</span><input type="number" value={edit.reps} min={1} max={30} onChange={e2 => commitEdits({ ...editsRef.current, [editKey]: { ...edit, reps: parseInt(e2.target.value) || 1 } })} style={{ width:45, ...IN }} /></div>
                    <div><span style={{ ...SMALL, fontSize:11 }}>Вес, кг</span><input type="number" value={edit.weight} min={0} max={500} onChange={e2 => commitEdits({ ...editsRef.current, [editKey]: { ...edit, weight: parseInt(e2.target.value) || 0 } })} style={{ width:55, ...IN }} /></div>
                    <div><span style={{ ...SMALL, fontSize:11 }}>RIR</span><input type="number" value={edit.rir ?? (e as any).rir ?? 2} min={0} max={10} onChange={e2 => commitEdits({ ...editsRef.current, [editKey]: { ...edit, rir: parseInt(e2.target.value) || 0 } })} style={{ width:45, ...IN }} /></div>
                    <button onClick={() => setExSwapModal({ si, ei, muscle: e.muscle, currentName: e.name })} style={{ padding:'3px 8px', borderRadius:8, fontSize:11, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.03)', color:'#fff' }}>🔄 Заменить</button>
                    <button onClick={() => handleMoveExercise(si, ei, -1)} disabled={ei === 0} style={{ padding:'3px 8px', borderRadius:8, fontSize:11, cursor:ei===0?'default':'pointer', border:'1px solid rgba(96,165,250,0.2)', background:ei===0?'transparent':'rgba(96,165,250,0.06)', color:ei===0?'rgba(255,255,255,0.2)':'#60a5fa' }}>↑</button>
                    <button onClick={() => handleMoveExercise(si, ei, 1)} disabled={ei === s.exercises.length - 1} style={{ padding:'3px 8px', borderRadius:8, fontSize:11, cursor:ei===s.exercises.length-1?'default':'pointer', border:'1px solid rgba(96,165,250,0.2)', background:ei===s.exercises.length-1?'transparent':'rgba(96,165,250,0.06)', color:ei===s.exercises.length-1?'rgba(255,255,255,0.2)':'#60a5fa' }}>↓</button>
                  </div>
                  <div style={{ display:'flex', gap:8, marginBottom:6, flexWrap:'wrap', alignItems:'center' }}>
                    <span style={{ ...SMALL, fontSize:11, fontWeight:800, color:'#c084fc' }}>⚙️ Фичи и методики</span>
                    <PopupSelect
                      label="Интенсив-техника"
                      value={edit.technique ?? (canonTechniqueId(((e as any).workSets || [])[(e as any).workSets?.length - 1]?.technique) || canonTechniqueId((e as any).technique) || 'none')}
                      onChange={v => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, technique: v } }))}
                      options={[
                        { id: 'none', label: '— интенсив-техника —' },
                        { id: 'drop_set', label: '💥 Дроп-сет' },
                        { id: 'rest_pause', label: '⏱ Рест-пауза' },
                        { id: 'myo_reps', label: '🧬 Мио-репс' },
                        { id: 'negative', label: '⬇️ Негативы' },
                        { id: 'twenty_ones', label: '2️⃣1️⃣ 21s' },
                      ]}
                    />
                    <PopupSelect
                      label="Суперсет"
                      value={edit.supersetWith ?? ((e as any).supersetWith || 'none')}
                      onChange={v => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, supersetWith: v } }))}
                      options={[
                        { id: 'none', label: '— суперсет —' },
                        { id: 'антагонист', label: '🔗 Антагонист' },
                        { id: 'та же группа', label: '🔗 Та же группа' },
                      ]}
                    />
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ ...SMALL, fontSize:11 }}>Темп</span><input type="text" defaultValue={(e as any).tempoSpec || edit.tempo || ''} onBlur={e2 => { const v=e2.target.value.trim(); setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, tempo: v || undefined } })); }} placeholder="3-1-1-0" style={{ width:62, ...IN }} /></div>
                    {(edit.technique && edit.technique !== 'none') || (edit.supersetWith && edit.supersetWith !== 'none') ? <span style={{ fontSize:9, color:'#f59e0b' }}>⚠ применяется при «💾 Сохранить план» / экспорте</span> : null}
                  </div>
                  {(editSetLines.length > 0 || editSetChain) && (
                    <div style={{ marginTop:6, padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(255,255,255,0.07)', display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
                      {editSetLines.map((ln, li) => <span key={li} style={{ fontSize:11, fontFamily:'monospace', padding:'2px 7px', borderRadius:5, background:'rgba(34,197,94,0.1)', color:'#86efac', border:'0.5px solid rgba(34,197,94,0.25)' }}>{ln}</span>)}
                      {editSetChain && <span style={{ fontSize:11, fontFamily:'monospace', fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(248,113,113,0.12)', color:'#fca5a5', border:'0.5px solid rgba(248,113,113,0.35)' }}>💥 {editSetChain.label}: {editSetChain.parts.join(' → ')}</span>}
                    </div>
                  )}
                  {altExercises.length > 0 && <div style={{ fontSize:11, color:'#fff' }}>Альтернативы: {altExercises.map(x => x.name).join(', ')}</div>}
                  <div style={{ marginTop:4, padding:'3px 6px', borderRadius:4, background:'rgba(0,230,138,0.04)', fontSize:11, color:'#fff' }}>💡 {exerciseComment(e, weakPoints, '', currentPhase)}</div>
                </div>;
              })}
            </div>
          } />
        ))}
      </CollapsibleCard>
      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        <button style={{ ...BTN, flex:1 }} onClick={() => setStep('contest')}>Далее: Contest prep →</button>
        <button style={BTN_GHOST} onClick={() => setStep('quality')}>← Назад</button>
      </div>
    </div>
  );
};

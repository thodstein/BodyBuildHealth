/**
 * bb-step-plan.tsx — шаг 4 ББ-авто («📋 План» с полными инструкциями), вынесен из
 * god-component `BbAutoConstructor.tsx` (§4.3, этап 3). Перенос 1-в-1:
 * логика/тексты/стили не менялись; state-ссылки/хендлеры названы теми же именами,
 * поэтому тело шага побайтово совпадает с оригиналом (кроме одной замены:
 * `{renderActionRow(false)}` → prop `actionRow`).
 */
import React from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import type { BBPlan } from '../../../engines/bb/bb-builder.engine';
import { buildWarmup } from '../../../engines/bb/bb-builder.engine';
import type { BBPlanMetrics } from '../../../engines/bb/bb-metrics.engine';
import { isCompoundEx } from '../../../engines/bb/bb-session-order.engine';
import type { DUPMode } from '../../../engines/bb/bb-dup.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../../../engines/pro/training-load.engine';
import { sessionLimitsFor } from '../../../engines/bb/bb-volume.engine';
import { buildPlanValidationView, planValidationBadge, planSessionStats } from './bb-plan-validation-view';
import { PATTERN_RU as SUMMARY_PATTERN_RU } from '../../../engines/bb/bb-summary.engine';
import { tempoExplain, buildExerciseInstructions } from '../../../engines/bb/bb-exercise-instructions.engine';
import { exerciseFeatureBadges, planSetsBreakdown, techniqueLabel, lastSetTechnique } from './bb-technique-display';
import type { PrepPhaseKey } from '../../../engines/bb/bb-contest-prep.engine';
import { PREP_PHASE_COLORS } from '../../../engines/bb/bb-contest-prep.engine';
import type { PlanWeightEntry } from '../../../engines/bb/bb-weight-calibration.engine';
import { collectPlanExercises } from '../../../engines/bb/bb-weight-calibration.engine';
import { CollapsibleCard, phaseForWeek, isWeakMuscle, exerciseComment, backSubgroupLabel, armHeadLabel, type Step } from './bb-auto-constructor-shared';
import { PHASE_COLORS, PHASE_LABELS } from './PlanOutput';
import { Chip, BTN, BTN_GHOST, H, SMALL, IN } from './training-ui';
import { sessionTagLabel, muscleLabel, exerciseTargetNote } from './bb-labels';
import { ExpandableCard } from '../SRCBBScreen_parts/TrainingPopups';

export interface BbPlanStepProps {
  builtPlan: BBPlan | null;
  metrics: BBPlanMetrics | null;
  bbWeekSel: number;
  setBbWeekSel: React.Dispatch<React.SetStateAction<number>>;
  bbWeeks: number;
  autoDeload: boolean;
  weakPoints: string[];
  dupMode: DUPMode;
  autoRegOn: boolean;
  autoRegResult: { topSetPctMultiplier: number; volumeMultiplier: number } | null;
  exerciseEdits: Record<string, { sets: number; reps: number; weight: number; rir?: number; tempo?: string; technique?: string; supersetWith?: string }>;
  setExerciseEdits: React.Dispatch<React.SetStateAction<Record<string, { sets: number; reps: number; weight: number; rir?: number; tempo?: string; technique?: string; supersetWith?: string }>>>;
  editMode: { dayIdx: number; exIdx: number } | null;
  setEditMode: React.Dispatch<React.SetStateAction<{ dayIdx: number; exIdx: number } | null>>;
  collapsedDays: Set<number>;
  setCollapsedDays: React.Dispatch<React.SetStateAction<Set<number>>>;
  collapsedExercises: Set<string>;
  setCollapsedExercises: React.Dispatch<React.SetStateAction<Set<string>>>;
  bbTrainingFocus: 'strength' | 'hypertrophy' | 'endurance';
  bbLevel: string;
  /** Стаж/курс/объёмный режим — для честных лимитов сессии в «Проверке плана» (канон движка). */
  bbTrainingYears?: number;
  onCourse?: boolean;
  trainingVolumeMode?: 'standard' | 'high';
  setSubTarget: React.Dispatch<React.SetStateAction<{ dayIdx: number; exIdx: number; sessionIdx: number } | null>>;
  handleSendToExecution: () => void;
  setWeightEntries: React.Dispatch<React.SetStateAction<PlanWeightEntry[]>>;
  setWeightsApplied: React.Dispatch<React.SetStateAction<number>>;
  setStep: React.Dispatch<React.SetStateAction<Step>>;
  /** `renderActionRow(false)` — низ шага (кнопки действий). */
  actionRow: React.ReactNode;
}

export const BbPlanStep: React.FC<BbPlanStepProps> = ({
  builtPlan, metrics, bbWeekSel, setBbWeekSel, bbWeeks, autoDeload, weakPoints, dupMode,
  autoRegOn, autoRegResult, exerciseEdits, setExerciseEdits, editMode, setEditMode,
  collapsedDays, setCollapsedDays, collapsedExercises, setCollapsedExercises,
  bbTrainingFocus, bbLevel, bbTrainingYears, onCourse, trainingVolumeMode, setSubTarget, handleSendToExecution,
  setWeightEntries, setWeightsApplied, setStep, actionRow,
}) => {
  if (!builtPlan || !metrics) return null;
  const W = builtPlan.weeks;
  const wk = W[Math.min(bbWeekSel, W.length) - 1] || W[0];
  const currentPhase = phaseForWeek(wk.week, bbWeeks);
  const srpe = loadSRPESessions();
  const acwr = srpe.length >= 2 ? acuteChronicRatio(toDailyLoads(srpe)) : null;
  const needsDeload = autoDeload && acwr && acwr.ratio > 1.3;

  return (
    <div>
        <div style={{ ...H, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span>📋 Шаг 4: План — {builtPlan.pattern.name}</span>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <button
          style={{ ...BTN_GHOST, borderColor:'#22c55e', color:'#22c55e', fontSize:11, padding:'4px 10px' }}
          onClick={handleSendToExecution}
          aria-label="Начать тренировку с этим планом"
        >
          ▶ Начать работу по циклу/программе
        </button>
        </div>
      </div>

      {/* 🧪 Валидация плана — адаптирована под выбор пользователя (аудит 2026-09):
          технические коды скрыты, повторы сгруппированы, мышцы по-русски, у
          каждой проблемы — действие; акцент специализации объяснён. */}
      {(() => {
        try {
          const view = buildPlanValidationView(builtPlan);
          const badge = planValidationBadge(view);
          const stats = planSessionStats(builtPlan);
          return (
            <CollapsibleCard
              title="🧪 Проверка плана под ваши настройки"
              defaultOpen={!view.ok || view.warnings.length > 0}
              headerStyle={{ background: badge.ok ? 'linear-gradient(135deg, rgba(34,197,94,0.14), rgba(34,197,94,0.04))' : 'linear-gradient(135deg, rgba(239,68,68,0.14), rgba(239,68,68,0.04))', color: badge.ok ? '#22c55e' : '#ef4444' }}
              badge={badge.label}
            >
              <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginBottom: 6, lineHeight: 1.45 }}>
                Учтены: уровень «{bbLevel}», {bbWeeks} нед, {bbTrainingFocus === 'strength' ? 'силовой' : bbTrainingFocus === 'endurance' ? 'выносливостный' : 'гипертрофийный'} фокус, лимиты сессии {(() => { try { const l = sessionLimitsFor({ level: bbLevel, trainingYears: bbTrainingYears, onCourse, trainingVolumeMode } as any, { id: builtPlan.pattern?.id } as any); return `${l.maxExercises} упр / ${l.maxWorkingSets} сетов`; } catch { return '—'; } })()}.
                Максимум в плане: {stats.maxExercises} упр / {stats.maxSets} сетов за сессию.
              </div>
              {view.accentNote && (
                <div style={{ fontSize: 10, color: '#facc15', padding: '5px 8px', borderRadius: 8, background: 'rgba(250,204,21,0.07)', border: '1px solid rgba(250,204,21,0.2)', marginBottom: 6, lineHeight: 1.45 }}>
                  🎯 {view.accentNote}
                </div>
              )}
              {view.errors.length === 0 && view.warnings.length === 0 && (
                <div style={{ fontSize: 11, color: '#22c55e' }}>Проблем по вашим параметрам нет: объём в коридорах, делоды снижены, фазы размечены.</div>
              )}
              {view.errors.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  {view.errors.map((e, k) => (
                    <div key={k} style={{ fontSize: 11, color: '#fca5a5', padding: '5px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', marginBottom: 3 }}>
                      ⛔ {e.text}{e.count > 1 ? ` (×${e.count})` : ''}
                      {e.hint && <div style={{ fontSize: 10, color: '#fff', marginTop: 2 }}>→ {e.hint}</div>}
                    </div>
                  ))}
                </div>
              )}
              {view.warnings.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  {view.warnings.slice(0, 8).map((w, k) => (
                    <div key={k} style={{ fontSize: 11, color: '#fcd34d', padding: '5px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.07)', marginBottom: 3 }}>
                      ⚠ {w.text}{w.count > 1 ? ` (×${w.count})` : ''}
                      {w.hint && <div style={{ fontSize: 10, color: '#fff', marginTop: 2 }}>→ {w.hint}</div>}
                    </div>
                  ))}
                  {view.warnings.length > 8 && <div style={{ fontSize: 10, color: '#fff' }}>… и ещё {view.warnings.length - 8} предупреждений</div>}
                </div>
              )}
              {view.infos.length > 0 && (
                <details style={{ marginTop: 2 }}>
                  <summary style={{ fontSize: 10, color: '#fff', cursor: 'pointer' }}>
                    ℹ️ Информационные заметки ({view.infos.length}) — не требуют правок
                  </summary>
                  <div style={{ marginTop: 3 }}>
                    {view.infos.map((i, k) => (
                      <div key={k} style={{ fontSize: 10, color: '#fff', opacity: 0.9, padding: '3px 6px' }}>
                        · {i.text}{i.count > 1 ? ` (×${i.count})` : ''}
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {view.hiddenCount > 0 && (
                <div style={{ fontSize: 9, color: '#fff', opacity: 0.6, marginTop: 4 }}>
                  Скрыто {view.hiddenCount} технических строк (классификация каталога, добивки малых мышц, движковые пороги) — они не влияют на выполнение.
                </div>
              )}
            </CollapsibleCard>
          );
        } catch { return null; }
      })()}

      {/* Верхняя инфо перенесена в шаг Качество — здесь только план упражнений */}
      {(() => {
        const vol = builtPlan.rotationMuscleVolume || {};
        const lm = builtPlan.volumeLandmarks || [];
        const MUSCLE_RU_H: Record<string, string> = { chest: 'Грудь', back: 'Спина', shoulders: 'Плечи', delt_front: 'Передняя дельта', delt_mid: 'Средняя дельта', delt_rear: 'Задняя дельта', quads: 'Квадр', hamstrings: 'Бицепс б', glutes: 'Ягодицы', calves: 'Икры', biceps: 'Бицепс', triceps: 'Трицепс', forearms: 'Предпл', abs: 'Пресс', traps: 'Трапец' };
        const muscles = Object.keys(vol).filter(m => MUSCLE_RU_H[m]);
        if (muscles.length === 0) return null;
        // Color: green (MEV) → yellow (MAV) → red (MRV)
        const colorFor = (sets: number, landmark?: any) => {
          if (!landmark) return '#374151';
          if (sets > landmark.mrv + 1) return '#ef4444'; // red — over MRV
          if (sets > landmark.mav) return '#f59e0b';     // yellow — above MAV
          if (sets >= landmark.mev) return '#22c55e';    // green — MEV-MAV range
          return '#3b82f6';                               // blue — below MEV
        };
        const findLandmark = (m: string) => lm.find((l: any) => l.group === m || l.label === m);
        return (
          <CollapsibleCard title="🔥 Тепловая карта объёма" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.12), rgba(96,165,250,0.04))', color: '#60a5fa' }} badge={`${muscles.length} мышц · прям/косв`}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(118px, 1fr))', gap:6 }}>
              {muscles.sort((a,b) => (vol[b]||0) - (vol[a]||0)).map(m => {
                const mm = metrics.perMuscle.find((x:any)=> x.muscle===m);
                const direct = mm ? Math.round(((mm as any).directSets ?? (vol[m]||0))*10)/10 : (vol[m]||0);
                const effective = mm ? Math.round(((mm as any).effectiveSets ?? (vol[m]||0))*10)/10 : (vol[m]||0);
                const indirect = Math.max(0, Math.round((effective - direct)*10)/10);
                const sets = effective > 0 ? effective : (vol[m]||0);
                const landmark = findLandmark(m);
                const color = colorFor(sets, landmark);
                const pct = landmark ? Math.min(100, Math.round((sets / (landmark.mrv || sets || 1)) * 100)) : 50;
                return (
                  <div key={m} style={{ padding:'6px 8px', borderRadius:8, background:'rgba(0,0,0,0.2)', border:`2px solid ${color}` }}>
                    <div style={{ fontSize:10, color:'#fff', fontWeight:600 }}>{MUSCLE_RU_H[m]}</div>
                    <div style={{ fontSize:16, fontWeight:800, color }}>{direct}</div>
                    <div style={{ fontSize:9, color:'#60a5fa' }}>косв +{indirect} · эфф {effective}</div>
                    <div style={{ height:4, borderRadius:2, background:'rgba(255,255,255,0.1)', marginTop:4 }}>
                      <div style={{ height:'100%', borderRadius:2, background:color, width:`${pct}%` }} />
                    </div>
                    {landmark && (
                      <div style={{ fontSize:8, color:'#fff', marginTop:2 }}>
                        Мин {landmark.mev} · Опт {landmark.mav} · Макс {landmark.mrv}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop:6, fontSize:9, color:'#fff', display:'flex', gap:12, flexWrap:'wrap' }}>
              <span>🟢 MEV–MAV (оптимум)</span><span>🟡 Выше оптимума</span><span>🔴 Перегруз (выше максимума)</span><span>🔵 Ниже минимума</span>
              <span style={{ opacity:0.65 }}>· большое число — прямой объём · косв — вклад базы (жимы→трицепс/плечи, тяги→бицепс, присед→ягодицы/б.б.) · цвет — по эффективному</span>
            </div>
          </CollapsibleCard>
        );
      })()}

      {builtPlan.validation && !builtPlan.validation.valid && (
        <div style={{ marginTop:8, padding:'10px 12px', borderRadius:12, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)' }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#ef4444', marginBottom:5 }}>🚫 План требует исправления</div>
          {builtPlan.validation.issues.filter((i: { level?: string }) => i.level === 'error').slice(0, 5).map((issue: { message: string }, i: number) => (
            <div key={i} style={{ fontSize:11, color:'#fff', lineHeight:1.4 }}>{issue.message}</div>
          ))}
          <div style={{ marginTop:5, fontSize:10, color:'#fff' }}>Подробности и действия — в карточке «🧪 Проверка плана под ваши настройки» выше.</div>
        </div>
      )}

      {/* Week selector with phase colors */}
      <div style={{ marginTop:10 }}>
        <div style={{ fontSize:11, color:'#fff', marginBottom:6, fontWeight:700 }}>
          Неделя {wk.week} из {W.length} · <span style={{ color:PHASE_COLORS[currentPhase] }}>{PHASE_LABELS[currentPhase]}</span>
          {(() => {
            const cp = (wk as any).contestPhase as PrepPhaseKey | undefined;
            if (!cp) return null;
            const c = PREP_PHASE_COLORS[cp] ?? '#f472b6';
            return (
              <span style={{ marginLeft: 8, padding: '1px 8px', borderRadius: 999, fontSize: 9, fontWeight: 800, color: c, background: c + '22', border: `1px solid ${c}55` }}>
                {cp === 'preparation' ? '🏁 Подготовка' : cp === 'final_preparation' ? '🏁 Финальная подготовка' : cp === 'taper' ? '📉 Тапер' : '🎭 Пик-неделя'}
              </span>
            );
          })()}
          {(wk as any).peakWeek === true && !(wk as any).contestPhase && (
            <span style={{ marginLeft: 8, padding: '1px 8px', borderRadius: 999, fontSize: 9, fontWeight: 800, color: '#ec4899', background: 'rgba(236,72,153,0.15)', border: '1px solid rgba(236,72,153,0.4)' }}>
              🎭 Пик-неделя
            </span>
          )}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(36px, 1fr))', gap:4 }}>
          {W.map(w => {
            const ph = phaseForWeek(w.week, bbWeeks);
            const active = w.week === wk.week;
            return <button key={w.week} onClick={() => setBbWeekSel(w.week)}
              style={{ padding:'7px 0', borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer',
                border: active ? '2px solid ' + PHASE_COLORS[ph] : '1px solid rgba(255,255,255,0.08)',
                background: active ? PHASE_COLORS[ph] + '30' : 'rgba(255,255,255,0.02)',
                color: active ? PHASE_COLORS[ph] : '#fff' }}>
              {w.week}
            </button>;
          })}
        </div>
      </div>

      {/* Calendar with phase colors */}
      <CollapsibleCard title="📅 Календарь мезоцикла (цвет = фаза)" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(168,85,247,0.04))', color: '#a78bfa' }} badge={`${W.length} нед`}>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          {W.map(w => {
            const ph = phaseForWeek(w.week, bbWeeks);
            const active = w.week === wk.week;
            const daySets = w.sessions.map(s => s.exercises.reduce((ss, e) => ss + e.sets, 0));
            const maxD = Math.max(1, ...W.flatMap(ww => ww.sessions.map(s => s.exercises.reduce((ss, e) => ss + e.sets, 0))));
            return (
              <div key={w.week} onClick={() => setBbWeekSel(w.week)} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 6px', borderRadius:8, cursor:'pointer', background:active ? PHASE_COLORS[ph] + '15' : 'transparent', borderLeft: '3px solid ' + PHASE_COLORS[ph] + '60' }}>
                <span style={{ fontSize:11, fontWeight:700, color:active ? PHASE_COLORS[ph] : '#fff', minWidth:26 }}>Н{w.week}</span>
                <div style={{ flex:1, display:'flex', gap:2 }}>{daySets.map((ds, di) => <div key={di} style={{ flex:1, height:14, borderRadius:3, background: `linear-gradient(180deg,${PHASE_COLORS[ph]},${PHASE_COLORS[ph]}88)`, opacity: 0.15 + 0.85 * (ds / maxD) }} />)}</div>
                <span style={{ fontSize:11, color:'#fff', minWidth:30, textAlign:'right' }}>{daySets.reduce((a,b)=>a+b,0)}</span>
              </div>
            );
          })}
        </div>
      </CollapsibleCard>

      {/* Фактическая нагрузка из дневника (sRPE/ACWR) */}
      {(() => {
        const srpeSessions = loadSRPESessions();
        if (srpeSessions.length === 0) return null;
        const acwrData = acuteChronicRatio(toDailyLoads(srpeSessions));
        const last7 = srpeSessions.filter(s => {
          const d = new Date(s.date || '');
          const diff = (Date.now() - d.getTime()) / 86400000;
          return diff <= 7;
        });
        const avgRPE = last7.length > 0 ? last7.reduce((s, x) => s + (x.sRPE || 7), 0) / last7.length : 0;
        const zoneColor = acwrData.zone === 'dangerous' ? '#ef4444' : acwrData.zone === 'caution' ? '#f59e0b' : '#22c55e';
        const zoneLabel = acwrData.zone === 'dangerous' ? '⛔ опасная' : acwrData.zone === 'caution' ? '⚠ осторожно' : '✅ оптимально';
        return (
          <CollapsibleCard title="📊 Твоя фактическая нагрузка (из дневника)" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.12), rgba(96,165,250,0.04))', color: '#60a5fa' }} badge={`${zoneLabel}`}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, fontSize:11 }}>
              <div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(96,165,250,0.06)' }}>
                <div style={{ color:'#fff', fontSize:10 }}>Сессий (7д)</div>
                <div style={{ fontWeight:700, color:'#60a5fa' }}>{last7.length}</div>
              </div>
              <div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(96,165,250,0.06)' }}>
                <div style={{ color:'#fff', fontSize:10 }}>Средний RPE</div>
                <div style={{ fontWeight:700, color:'#60a5fa' }}>{avgRPE.toFixed(1)}</div>
              </div>
              <div style={{ textAlign:'center', padding:6, borderRadius:8, background: zoneColor + '10' }}>
                <div style={{ color:'#fff', fontSize:10 }}>ACWR</div>
                <div style={{ fontWeight:700, color: zoneColor }}>{acwrData.ratio.toFixed(2)} <span style={{ fontSize:11 }}>{zoneLabel}</span></div>
              </div>
            </div>
            {acwrData.ratio > 1.3 && <div style={{ marginTop:6, fontSize:10, color:'#f59e0b' }}>⚠ Восстановление недостаточно — план учитывает авторегуляцию.</div>}
          </CollapsibleCard>
        );
      })()}

      {/* Сравнение недель — week 1 vs current week */}
      {(() => {
        const w1 = W[0];
        const wCur = wk;
        if (w1.week === wCur.week) return null;
        const w1Sets = w1.sessions.reduce((s, sess) => s + sess.exercises.reduce((ss, e) => ss + e.sets, 0), 0);
        const wCurSets = wCur.sessions.reduce((s, sess) => s + sess.exercises.reduce((ss, e) => ss + e.sets, 0), 0);
        const w1Rir = w1.sessions.flatMap(s => s.exercises).reduce((s, e) => s + e.rir * e.sets, 0) / Math.max(1, w1Sets);
        const wCurRir = wCur.sessions.flatMap(s => s.exercises).reduce((s, e) => s + e.rir * e.sets, 0) / Math.max(1, wCurSets);
        const w1Wt = w1.sessions.flatMap(s => s.exercises).reduce((s, e) => s + (e.workSets[0]?.weight || 80) * e.sets, 0);
        const wCurWt = wCur.sessions.flatMap(s => s.exercises).reduce((s, e) => s + (e.workSets[0]?.weight || 80) * e.sets, 0);
        const setsDiff = wCurSets - w1Sets;
        const rirDiff = wCurRir - w1Rir;
        const wtDiff = wCurWt - w1Wt;
        return (
          <ExpandableCard title={`📋 Сравнение: неделя 1 vs неделя ${wCur.week}`} icon="📋"
            short={`Сеты: ${w1Sets}→${wCurSets} (${setsDiff >= 0 ? '+' : ''}${setsDiff}) · RIR: ${w1Rir.toFixed(1)}→${wCurRir.toFixed(1)} · Тоннаж: ${wtDiff >= 0 ? '+' : ''}${Math.round(wtDiff)}кг`}
            full={
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, fontSize:11 }}>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)' }}>
                  <div style={{ color:'#fff', fontSize:10 }}>Объём (сеты)</div>
                  <div style={{ fontWeight:700 }}>{w1Sets} → {wCurSets} <span style={{ color: setsDiff >= 0 ? '#22c55e' : '#ef4444' }}>({setsDiff >= 0 ? '+' : ''}{setsDiff})</span></div>
                </div>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)' }}>
                  <div style={{ color:'#fff', fontSize:10 }}>Средний RIR</div>
                  <div style={{ fontWeight:700 }}>{w1Rir.toFixed(1)} → {wCurRir.toFixed(1)} <span style={{ color: rirDiff <= 0 ? '#22c55e' : '#f59e0b' }}>({rirDiff >= 0 ? '+' : ''}{rirDiff.toFixed(1)})</span></div>
                </div>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)' }}>
                  <div style={{ color:'#fff', fontSize:10 }}>Тоннаж (кг)</div>
                  <div style={{ fontWeight:700 }}>{Math.round(w1Wt)} → {Math.round(wCurWt)} <span style={{ color: wtDiff >= 0 ? '#22c55e' : '#ef4444' }}>({wtDiff >= 0 ? '+' : ''}{Math.round(wtDiff)})</span></div>
                </div>
              </div>
            }
          />
        );
      })()}

      {/* Progression chart across all weeks */}
      {(() => {
        const wkStats = W.map(w => {
          const ph = phaseForWeek(w.week, bbWeeks);
          const exs = w.sessions.flatMap(s => s.exercises);
          const sets = exs.reduce((s, e) => s + e.sets, 0);
          const rir = sets > 0 ? exs.reduce((s, e) => s + e.rir * e.sets, 0) / sets : 0;
          // P2-5: тоннаж = weight × reps × sets (реальный тоннаж, не weight × sets).
          // Раньше: weight × sets → 6 sessions×100kg=600 vs 1×200kg=200 — несравнимо.
          // Теперь: weight × reps × sets → нормализованный тоннаж для сравнения недель.
          const totalWt = exs.reduce((s, e) => s + (e.workSets[0]?.weight || 80) * (e.workSets[0]?.reps || 10) * e.sets, 0);
          return { week: w.week, phase: ph, sets, rir, tonnage: totalWt };
        });
        const maxSets = Math.max(1, ...wkStats.map(x => x.sets));
        const maxTon = Math.max(1, ...wkStats.map(x => x.tonnage));
        return (
          <CollapsibleCard title="📈 Прогрессия по неделям: RIR / объём / тоннаж" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))', color: '#22c55e' }} badge={`${W.length} нед`}>
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              {wkStats.map(x => {
                const barW = 220;
                return (
                  <div key={x.week} style={{ display:'flex', alignItems:'center', gap:4, padding:'2px 0' }}>
                    <button onClick={() => setBbWeekSel(x.week)} style={{
                      minWidth:32, padding:'2px 4px', borderRadius:4, cursor:'pointer', fontSize:11, fontWeight:700,
                      border: x.week === bbWeekSel ? '1px solid ' + PHASE_COLORS[x.phase] : '1px solid transparent',
                      background: x.week === bbWeekSel ? PHASE_COLORS[x.phase] + '20' : 'transparent',
                      color: x.week === bbWeekSel ? PHASE_COLORS[x.phase] : '#fff',
                    }}>{x.week}</button>
                    <div style={{ fontSize:11, fontWeight:600, minWidth:56, color: PHASE_COLORS[x.phase] }}>{PHASE_LABELS[x.phase]}</div>
                    <div style={{ fontSize:11, fontWeight:700, minWidth:20, textAlign:'center', color:x.rir <= 1 ? '#ef4444' : x.rir <= 2 ? '#f59e0b' : '#22c55e' }}>RIR{x.rir.toFixed(0)}</div>
                    <div style={{ flex: 1, display:'flex', gap:2, alignItems:'center' }}>
                      <div style={{ height:8, width: Math.round((x.sets / maxSets) * barW), borderRadius:3, background: PHASE_COLORS[x.phase], opacity:0.6, transition:'width 0.5s', minWidth: x.sets > 0 ? 4 : 0 }} />
                      <span style={{ fontSize:11, fontWeight:600, color:'#fff', minWidth:16 }}>{x.sets}</span>
                    </div>
                    <div style={{ flex: 1, display:'flex', gap:2, alignItems:'center' }}>
                      <div style={{ height:6, width: Math.round((x.tonnage / maxTon) * barW), borderRadius:2, background:'#60a5fa', opacity:0.5, transition:'width 0.5s', minWidth: x.tonnage > 0 ? 4 : 0 }} />
                      <span style={{ fontSize:11, fontWeight:600, color:'#fff', minWidth:24 }}>{(x.tonnage / 1000).toFixed(1)}k</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display:'flex', gap:12, marginTop:4, fontSize:11, color:'#fff', borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:3 }}>
              <span><span style={{ width:8, height:8, borderRadius:2, background:'#22c55e', display:'inline-block', marginRight:2 }} /> сеты/нед</span>
              <span><span style={{ width:8, height:8, borderRadius:2, background:'#60a5fa', display:'inline-block', marginRight:2 }} /> тоннаж</span>
              <span>RIR: 🟢3+ 🟡1-2 🔴0</span>
            </div>
          </CollapsibleCard>
        );
      })()}

      {/* Daily session cards — красивые раскрывающиеся карточки дней */}
      <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:12 }}>
        {wk.sessions.map((s, si) => {
          const dayColor = PHASE_COLORS[currentPhase];
          const daySets = s.exercises.reduce((ss, e) => ss + e.sets, 0);
          const isDayCollapsed = collapsedDays.has(si);
          const dayExCount = s.exercises.length;
          return (
            <div key={si} style={{
              background: 'rgba(20,22,28,0.55)',
              backdropFilter: 'blur(18px) saturate(160%)',
              WebkitBackdropFilter: 'blur(18px) saturate(160%)',
              borderRadius: 14,
              border: `1px solid ${dayColor}30`,
              borderLeft: `4px solid ${dayColor}`,
              overflow: 'hidden',
            }}>
              {/* Красивая кнопка-заголовок дня */}
              <button
                onClick={() => setCollapsedDays(prev => {
                  const next = new Set(prev);
                  if (next.has(si)) next.delete(si);
                  else next.add(si);
                  return next;
                })}
                aria-expanded={!isDayCollapsed}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  background: `linear-gradient(135deg, ${dayColor}18, rgba(255,255,255,0.02))`,
                  border: 'none',
                  textAlign: 'left',
                  gap: 12,
                }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
                  <span style={{
                    width:36, height:36, borderRadius:10, display:'inline-flex', alignItems:'center', justifyContent:'center',
                    background: dayColor, color:'#000', fontWeight:900, fontSize:14, flexShrink:0
                  }}>{si+1}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:800, color:'#fff', lineHeight:1.2 }}>День {si+1} · {sessionTagLabel(s.sessionTag)}</div>
                    <div style={{ fontSize:11, color:'#fff', opacity:0.85, marginTop:2, display:'flex', gap:8, flexWrap:'wrap' }}>
                      <span style={{ padding:'2px 7px', borderRadius:6, background: dayColor+'22', color:dayColor, border:`1px solid ${dayColor}35`, fontWeight:700 }}>{PHASE_LABELS[currentPhase]}</span>
                      <span>{s.character} · {dayExCount} упр · {daySets} сетов</span>
                    </div>
                  </div>
                </div>
                <span style={{
                  width:32, height:32, borderRadius:8, display:'inline-flex', alignItems:'center', justifyContent:'center',
                  background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:14, flexShrink:0,
                  transform: isDayCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition:'transform 0.2s'
                }}>▼</span>
              </button>
              {!isDayCollapsed && (
                <div style={{ padding:'8px 10px', borderTop:`1px solid ${dayColor}15` }}>

              {/* Упражнения */}
              <div style={{ padding:'4px 0' }}>
                {s.exercises.map((e, ei) => {
                  const rawW = e.workSets[0]?.weight || 80;
                  const adjW = autoRegOn && autoRegResult ? Math.round(rawW * autoRegResult.topSetPctMultiplier * 10) / 10 : rawW;
                  const adjSets0 = autoRegOn && autoRegResult ? Math.max(1, Math.round(e.sets * autoRegResult.volumeMultiplier)) : e.sets;
                  const editKey = `${si}-${ei}`;
                  const edit = exerciseEdits[editKey] || { sets: adjSets0, reps: e.workSets[0]?.reps || 10, weight: adjW };
                  const isEditing = editMode?.dayIdx === si && editMode?.exIdx === ei;
                  const comment = e.comment || exerciseComment(e, weakPoints, '', currentPhase);
                  const roleColor = e.role === 'primary' ? '#00e68a' : '#a855f7';
                  const isCompound = isCompoundEx(e);
                  const _cat = EXERCISE_CATALOG.find(c => c.name === (e.exerciseName || e.name));
                  const techniqueBase = _cat?.technique || ((_cat as any)?.targetMuscle ? 'Акцент: ' + (_cat as any).targetMuscle : '');
                  const appliedTech = techniqueLabel(lastSetTechnique(e));
                  const technique = appliedTech ? `💥 ${appliedTech} — финальный подход по технике. ` + (techniqueBase ? '· ' + techniqueBase : '') : techniqueBase;
                  const featureBadges = exerciseFeatureBadges(e, dupMode);
                  const { lines: setLines, chain: setChain } = planSetsBreakdown(e, edit);
                  const charColor = e.character === 'тяж' ? '#ef4444' : '#60a5fa';
                  const exCollapsed = collapsedExercises.has(`${si}-${ei}`);
                  return (
                    <div key={ei} style={{
                      padding:'10px 12px', marginBottom:8,
                      background: 'rgba(255,255,255,0.025)',
                      borderRadius:10, border: '0.5px solid rgba(255,255,255,0.04)',
                    }}>
                      {/* Красивая кнопка-заголовок упражнения — скрыть/раскрыть */}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: exCollapsed ? 0 : 6 }}>
                        <button
                          onClick={() => setCollapsedExercises(prev => {
                            const next = new Set(prev);
                            const key = `${si}-${ei}`;
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            return next;
                          })}
                          aria-expanded={!exCollapsed}
                          style={{
                            flex:1, display:'flex', flexDirection:'column', gap:6, background:'transparent', border:'none', cursor:'pointer', textAlign:'left', padding:0,
                          }}
                        >
                          <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                            <span style={{ minWidth:22, height:22, borderRadius:'50%', background:'rgba(0,230,138,0.15)', color:'#00e68a', fontSize:12, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{ei+1}</span>
                            <span style={{ fontSize:14, fontWeight:800, color:'#fff', lineHeight:1.25, letterSpacing:'-0.2px', flex:1 }}>{e.name}</span>
                            <span style={{
                              width:24, height:24, borderRadius:6, display:'inline-flex', alignItems:'center', justifyContent:'center',
                              background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:11, flexShrink:0,
                              transform: exCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition:'transform 0.2s'
                            }}>▼</span>
                          </div>
                          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                            <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background: (isCompound?'#00e68a':'#f59e0b')+'20', color: isCompound?'#00e68a':'#f59e0b', border: '0.5px solid '+(isCompound?'#00e68a':'#f59e0b')+'30' }}>{isCompound?'База':'Изо'}</span>
                            <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background: roleColor + '20', color: roleColor, border: '0.5px solid ' + roleColor + '30' }}>
                              {e.role === 'primary' ? '🎯 Основное' : '📌 Добивка'}
                            </span>
                            <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background: charColor + '20', color: charColor, border: '0.5px solid ' + charColor + '30' }}>
                              {e.character === 'тяж' ? '💪 Тяж' : e.character === 'памп' ? '🩸 Памп' : '🌿 Лёг'}
                            </span>
                            {(e as any).warmupActivator && (
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(148,163,184,0.15)', color:'#94a3b8', border:'0.5px solid rgba(148,163,184,0.3)' }}>
                                🔥 Разминка
                              </span>
                            )}
                            {e.muscle === 'back' && backSubgroupLabel((e as any).backSubgroup) && (
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(45,212,191,0.15)', color:'#2dd4bf', border:'0.5px solid rgba(45,212,191,0.3)' }}>
                                {backSubgroupLabel((e as any).backSubgroup)}
                              </span>
                            )}
                            {['biceps', 'triceps', 'forearms'].includes(e.muscle) && armHeadLabel((e as any).movementPattern) && (
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(232,121,249,0.15)', color:'#e879f9', border:'0.5px solid rgba(232,121,249,0.3)' }}>
                                {armHeadLabel((e as any).movementPattern)}
                              </span>
                            )}
                            {isWeakMuscle(e.muscle, weakPoints) && (
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(250,204,21,0.15)', color:'#facc15', border:'0.5px solid rgba(250,204,21,0.3)' }}>
                                🔥 Отстающая
                              </span>
                            )}
                            {featureBadges.map((fb, fbi) => (
                              <span key={fbi} style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background:fb.color+'20', color:fb.color, border:'0.5px solid '+fb.color+'35' }}>
                                {fb.icon} {fb.label}
                              </span>
                            ))}
                          </div>
                        </button>
                        <div style={{ display:'flex', gap:6, marginLeft:8, flexShrink:0 }}>
                          <button onClick={() => setSubTarget({ dayIdx: si, exIdx: ei, sessionIdx: si })} title="Заменить"
                            style={{ padding:'3px 8px', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid rgba(0,230,138,0.2)', background:'rgba(0,230,138,0.06)', color:'#00e68a' }}>
                            🔄
                          </button>
                          <button onClick={() => setEditMode(isEditing ? null : { dayIdx: si, exIdx: ei })} title="Править"
                            style={{ padding:'3px 8px', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.03)', color:'#fff' }}>
                            {isEditing ? '✓' : '✎'}
                          </button>
                        </div>
                      </div>
                      {!exCollapsed && (
                        <>
                      {/* Редактирование (inline) */}
                      {isEditing && (
                        <div style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center', padding:'6px 10px', borderRadius:10, background:'rgba(255,255,255,0.04)' }}>
                          <div><span style={SMALL}>Сеты</span><input type="number" value={edit.sets} min={0} max={20} onChange={e2 => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, sets: parseInt(e2.target.value) || 0 } }))} style={{ width:48, ...IN }} /></div>
                          <div><span style={SMALL}>Повт</span><input type="number" value={edit.reps} min={1} max={30} onChange={e2 => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, reps: parseInt(e2.target.value) || 1 } }))} style={{ width:48, ...IN }} /></div>
                          <div><span style={SMALL}>Вес</span><input type="number" value={edit.weight} min={0} max={500} onChange={e2 => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, weight: parseInt(e2.target.value) || 0 } }))} style={{ width:55, ...IN }} /></div>
                        </div>
                      )}

                      {/* Параметры: грид чипсов */}
                      <div style={{
                        display:'grid',
                        gridTemplateColumns:'repeat(auto-fill, minmax(80px, 1fr))',
                        gap:6,
                      }}>
                        <Chip label="Подходы" value={edit.sets + '×' + edit.reps} color="#22c55e" />
                        <Chip label="RIR" value={String(e.rir)} color="#f59e0b" />
                        <Chip label="Вес" value={edit.weight + ' кг'} color="#60a5fa" />
                        {e.workSets[0]?.restSeconds && <Chip label="Отдых" value={e.workSets[0].restSeconds + 'с'} color="#fff" />}
                        <Chip label="Группа" value={muscleLabel(e.muscle)} color="#fff" />
                      </div>

                      {/* Разбивка по подходам (включая дроп-цепочки финального сета) */}
                      {(setLines.length > 0 || setChain) && (
                        <div style={{ marginTop:6, padding:'7px 9px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(255,255,255,0.07)' }}>
                          <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>📋 Подходы</div>
                          <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
                            {setLines.map((ln, li) => (
                              <span key={li} style={{ fontSize:11, fontFamily:'monospace', padding:'2px 7px', borderRadius:5, background:'rgba(34,197,94,0.1)', color:'#86efac', border:'0.5px solid rgba(34,197,94,0.25)' }}>{ln}</span>
                            ))}
                            {setChain && (
                              <span style={{ fontSize:11, fontFamily:'monospace', fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(248,113,113,0.12)', color:'#fca5a5', border:'0.5px solid rgba(248,113,113,0.35)' }}>
                                💥 {setChain.label}: {setChain.parts.join(' → ')}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Комментарий и полная тренерская инструкция — разбивка по пунктам */}
                      <details style={{ marginTop:6 }} open={false}>
                        <summary style={{ fontSize:11, fontWeight:700, color:'rgba(0,230,138,0.8)', cursor:'pointer', padding:'5px 8px', borderRadius:8, background:'rgba(0,230,138,0.04)' }}>
                          📖 Полная инструкция — развернуто
                        </summary>
                        <div style={{ marginTop:4, fontSize:10, color:'#fff', lineHeight:1.55, padding:'7px 9px', borderRadius:8, background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.05)' }}>
                          {String(comment).split(' · ').map((part: string, idx: number) => (
                            <div key={idx} style={{ display:'flex', gap:6, marginBottom:3, alignItems:'flex-start' }}>
                              <span style={{ color:'#00e68a', fontWeight:800, flexShrink:0 }}>{idx+1}.</span>
                              <span style={{ flex:1 }}>{part}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                      {(() => {
                        const prof = e.executionProfile || buildExerciseInstructions({ exerciseName: e.name, muscle: e.muscle, role: e.role, trainingFocus: bbTrainingFocus, level: bbLevel, tempo: e.workSets[0]?.tempo, restSeconds: e.workSets[0]?.restSeconds });
                        return (
                        <details style={{ marginTop:4 }}>
                          <summary style={{ fontSize:11, fontWeight:600, color:'#60a5fa', cursor:'pointer' }}>🧬 Биомеханика и мышечный акцент — {prof.pattern}</summary>
                          <div style={{ marginTop:4, padding:'6px 8px', borderRadius:8, background:'rgba(96,165,250,0.05)', color:'#fff', fontSize:10, lineHeight:1.5 }}>
                            <div><b>Паттерн:</b> {prof.pattern}</div>
                            {prof.mmc && <div><b>Связь мышца-мозг:</b> {prof.mmc}</div>}
                            {prof.stretch && <div><b>Растяжение:</b> {prof.stretch}</div>}
                            {prof.peak && <div><b>Пиковое сокращение:</b> {prof.peak}</div>}
                            {prof.cues.length > 0 && <div><b>Ключи:</b> {prof.cues.join('; ')}</div>}
                            {prof.mistakes.length > 0 && <div><b>Ошибки:</b> {prof.mistakes.join('; ')}</div>}
                            <div style={{ marginTop:4, fontSize:9, color:'#fff' }}>Источник: {prof.source === 'exercise-lab' ? 'лаборатория' : prof.source === 'catalog' ? 'каталог' : 'базовый шаблон'} · Темп {prof.tempo} · {prof.order}</div>
                          </div>
                        </details>
                        );
                      })()}
                      {(() => {
                        const profTech = e.executionProfile || buildExerciseInstructions({ exerciseName: e.name, muscle: e.muscle, role: e.role, trainingFocus: bbTrainingFocus, level: bbLevel, tempo: e.workSets[0]?.tempo, restSeconds: e.workSets[0]?.restSeconds });
                        const tech = technique || (e as any).technique || (e.executionProfile as any)?.technique;
                        const cues = profTech?.cues?.length ? profTech.cues : (tech ? [tech] : []);
                        return (
                        <details style={{ marginTop:4 }} open={false}>
                          <summary style={{ fontSize:11, fontWeight:600, color:'rgba(0,230,138,0.75)', cursor:'pointer' }}>💡 Техника выполнения — пошагово</summary>
                          <div style={{ fontSize:10, color:'#fff', padding:'6px 8px', lineHeight:1.5, marginTop:2, borderRadius:8, background:'rgba(0,230,138,0.05)', border:'1px solid rgba(0,230,138,0.1)' }}>
                            {cues.length > 0 ? (
                              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                                {cues.map((c: string, idx: number) => (
                                  <div key={idx} style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
                                    <span style={{ minWidth:18, height:18, borderRadius:'50%', background:'rgba(0,230,138,0.15)', color:'#00e68a', fontSize:9, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{idx+1}</span>
                                    <span style={{ flex:1 }}>{c}</span>
                                  </div>
                                ))}
                                {profTech?.tempo && <div style={{ marginTop:4, padding:'4px 6px', background:'rgba(255,255,255,0.03)', borderRadius:6 }}><b>Темп:</b> {profTech.tempo} — {tempoExplain(profTech.tempo) || 'контролируйте каждую фазу'}</div>}
                              </div>
                            ) : (
                              <div>{tech || 'Контролируйте эксцентрик 2-3с, без рывков, полная амплитуда, дыхание — выдох на усилии.'}</div>
                            )}
                            <div style={{ marginTop:6, fontSize:9, color:'#fff', opacity:0.85, lineHeight:1.35 }}>Дыхание: выдох на усилии, вдох на опускании. Кор держите напряжённым весь подход.</div>
                          </div>
                        </details>
                        );
                      })()}

                      {/* Разминка */}
                      {(e.warmupSets && e.warmupSets.length > 0 ? e.warmupSets : (e.role === 'primary' && e.character === 'тяж' ? buildWarmup(edit.weight, true) : [])).length > 0 && (
                        <details style={{ marginTop:4 }}>
                          <summary style={{ fontSize:11, fontWeight:600, color:'rgba(96,165,250,0.7)', cursor:'pointer' }}>🔥 Разминка ({(e.warmupSets && e.warmupSets.length > 0 ? e.warmupSets : buildWarmup(edit.weight, true)).length} подхода)</summary>
                          <div style={{ display:'flex', gap:8, marginTop:4, flexWrap:'wrap' }}>
                            {(e.warmupSets && e.warmupSets.length > 0 ? e.warmupSets : buildWarmup(edit.weight, true)).map((w, wi) => (
                              <span key={wi} style={{ fontSize:10, color:'#fff', padding:'2px 6px', borderRadius:4, background:'rgba(96,165,250,0.08)' }}>
                                {w.reps}×{w.load} кг
                              </span>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* Rationale — подробно, без мусора */}
                      {e.rationale && (() => {
                        const targetNote = exerciseTargetNote(e as any);
                        const cleanRationale = String(e.rationale || '').replace(/Опытный уровень:\s*/g, '').replace(/Малые группы:\s*/g, '').trim();
                        return (
                        <details style={{ marginTop:4 }} open={false}>
                          <summary style={{ fontSize:11, fontWeight:600, color:'rgba(96,165,250,0.6)', cursor:'pointer' }}>🧠 Почему именно это упражнение?</summary>
                          <div style={{ fontSize:10, color:'#fff', padding:'6px 8px', lineHeight:1.55, marginTop:2, background:'rgba(96,165,250,0.05)', borderRadius:8, border:'1px solid rgba(96,165,250,0.1)' }}>
                            <div style={{ marginBottom:4 }}><b>Логика подбора:</b> {cleanRationale || e.rationale}</div>
                            {targetNote && <div style={{ marginTop:6, padding:'6px 8px', background:'rgba(59,130,246,0.06)', borderRadius:6, border:'1px solid rgba(59,130,246,0.12)' }}>{targetNote}</div>}
                            <div style={{ marginTop:6, fontSize:9, color:'#fff', opacity:0.9, lineHeight:1.4 }}>
                              Роль: {e.role === 'primary' ? 'основное движение дня — даёт 60-70% стимула' : 'добивка/изоляция — добивает объём и формирует детали'} · 
                              Характер: {e.character === 'тяж' ? 'тяж (6-10 повт, RIR 1-2)' : e.character === 'памп' ? 'памп (12-20, RIR 3)' : 'лёгкий'} · 
                              Паттерн: {(SUMMARY_PATTERN_RU[(e as any).movementPattern || ''] || (e as any).movementPattern || 'силовой') }
                            </div>
                          </div>
                        </details>
                        );
                      })()}
                      {/* Темп — внизу карты */}
                      {e.workSets[0]?.tempo && (
                        <details style={{ marginTop:4 }}>
                          <summary style={{ fontSize:11, fontWeight:600, color:'#a855f7', cursor:'pointer' }}>⏱ Темп: {e.workSets[0].tempo}</summary>
                          <div style={{ fontSize:10, color:'#fff', padding:'4px 8px', lineHeight:1.4, marginTop:2 }}>{tempoExplain(e.workSets[0].tempo) ? `${e.workSets[0].tempo} — ${tempoExplain(e.workSets[0].tempo)}` : e.workSets[0].tempo}</div>
                        </details>
                      )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Feeder sets — перенесено наверх, см. блок в начале плана */}

      {/* Summary */}
      <div style={{ display:'flex', gap:12, marginTop:10 }}>
        <button style={{ ...BTN, flex:1 }} onClick={() => { setWeightEntries(collectPlanExercises(builtPlan)); setWeightsApplied(0); setStep('weights'); }}>Далее: реальные веса →</button>
        <button style={BTN_GHOST} onClick={() => setBbWeekSel(1)}>На первую нед</button>
      </div>
      {actionRow}
    </div>
  );
};

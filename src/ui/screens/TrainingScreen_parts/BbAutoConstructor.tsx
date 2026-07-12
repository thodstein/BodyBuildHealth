/**
 * BbAutoConstructor.tsx — PRO-ББ АВТО-КОНСТРУКТОР (профессиональный тренерский подход).
 *
 * Ключевые улучшения против базового:
 *  - Фазовая периодизация (Accumulation → Intensification → Deload/Peak)
 *  - RIR-прогрессия по фазам
 *  - Модуляция объёма и реп-диапазонов по фазам
 *  - Ротация изолирующих упражнений на границах фаз
 *  - Стратегия прогрессии нагрузки (DoubleProgression / Linear / Wave / RPE)
 *  - Авто-делод при ACWR > 1.3 + структурированная разгрузочная неделя
 *  - Интенсив-техники (дропсеты, рест-пауза, мио-репс) — рекомендации по фазе
 *  - Разминочные подходы к compounds
 *  - 3D эволюция объёма/интенсивности/частоты по неделям
 *  - Цветная индикация фазы в календаре и плане
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useDataLink } from '../../../core/data-link';
import { EXERCISE_CATALOG, getExercisesByGroup } from '../../../core/exercise-catalog';
import { SPLIT_PATTERNS } from '../../../engines/bb/bb-split-patterns';
import { rankBBSplits, explainBBSelection, getMuscleFrequencies, type BBRankedPattern } from '../../../engines/bb/bb-selector.engine';
import { buildBBPlan, type BBPlan, type BBExercise, type BBSession, type BBSet } from '../../../engines/bb/bb-builder.engine';
import { calcBBPlanMetrics, explainBBMetrics, type BBPlanMetrics, type BBMuscleVolume } from '../../../engines/bb/bb-metrics.engine';
import { adaptForPEDs, explainPEDAdaptation, type PED, type PEDAdaptation } from '../../../engines/bb/bb-ped-adaptation.engine';
import { getAllVolumeLandmarks } from '../../../engines/volume-landmarks.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../../../engines/pro/training-load.engine';
import { autoRegulate, shouldTrainToday } from '../../../engines/pro/autoregulation-pro.engine';
import { loadTrainingProfile, saveTrainingProfile } from './training-profile';
import { applyToPlanner } from './planner-bridge';
import { MesocycleProgressionCard } from './MesocycleProgressionCard';
import { PopupNumber, PopupSelect, ExpandableCard, MetricCard, SaveButton } from '../SRCBBScreen_parts/TrainingPopups';
import { prescribeLoad, DELOAD_PROTOCOLS, applyDeloadToWeek, rirDrift, suggestFeeders, detectGarbageVolume, computeOverloadTargets, phaseExerciseMix, type LoadStrategy, type DeloadType } from '../../../engines/bb/bb-autocoach.engine';
import { PCT_FOR_RIR } from '../../../engines/rir-table';
import { getCyclesByDirection, getCycleById } from '../../../data/lms-cycles/lms-cycle-index';
import { convertCycleToBBPlan } from '../../../engines/bb/cycle-to-plan';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';

type Step = 'params' | 'ped' | 'split' | 'plan' | 'quality' | 'adjust';
type BBPhase = 'accumulation' | 'intensification' | 'deload' | 'peaking';
type PlanMode = 'generic_split' | 'bb_cycle';

const WEAK_GROUPS = [['chest','Грудь'],['back','Спина'],['legs','Ноги'],['shoulders','Плечи'],['arms','Руки'],['core','Кор']] as const;
const BB_WM_KEYS = ['chest','back','quads','hamstrings','shoulders','biceps','triceps','glutes','calves','abs'] as const;
const BB_WM_RU: Record<string,string> = { chest:'Грудь', back:'Спина', quads:'Квадрицепсы', hamstrings:'Бицепс бедра', shoulders:'Плечи', biceps:'Бицепс', triceps:'Трицепс', glutes:'Ягодичные', calves:'Икры', abs:'Пресс' };
const ACCENT = '#00e68a';
const TAG_LABELS_RU: Record<string, string> = {
  Push: 'Толкающие', Pull: 'Тянущие', Legs: 'Ноги', Upper: 'Верх', Lower: 'Низ',
  FullBody: 'Всё тело', Chest: 'Грудь', Back: 'Спина', Shoulders: 'Плечи', Arms: 'Руки',
  ChestBack: 'Грудь+Спина', ShouldersArms: 'Плечи+Руки', Torso: 'Торс', Limbs: 'Конечности',
  UpperPower: 'Верх(сила)', LowerPower: 'Низ(сила)', UpperHyp: 'Верх(гиперт)', LowerHyp: 'Низ(гиперт)',
};
const PHASE_COLORS: Record<BBPhase, string> = { accumulation: '#60a5fa', intensification: '#ef4444', deload: '#22c55e', peaking: '#a855f7' };
const PHASE_LABELS: Record<BBPhase, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', deload: 'Разгрузка', peaking: 'Пик' };
const PHASE_RIR: Record<BBPhase, [number, number]> = { accumulation: [3, 2], intensification: [2, 0], deload: [4, 3], peaking: [1, 0] };
const PHASE_VOL_MULT: Record<BBPhase, number> = { accumulation: 1.0, intensification: 0.85, deload: 0.5, peaking: 0.7 };
const PHASE_REP: Record<BBPhase, [number, number]> = { accumulation: [10, 15], intensification: [6, 10], deload: [12, 15], peaking: [3, 6] };
const PHASE_TEMPO: Record<BBPhase, string> = { accumulation: '3-1-1-0', intensification: '2-0-1-0', deload: '4-2-2-1', peaking: '1-0-1-0' };
const PHASE_TECHNIQUES: Record<BBPhase, string[]> = {
  accumulation: ['Темповые повторы (TUT)', 'Пауза в растянутой позиции', 'Суперсеты антагонистов'],
  intensification: ['Дроп-сеты (последний подход)', 'Рест-пауза (compounds)', 'Форсированные повторы (с партнёром)'],
  deload: ['Медленные негативы', 'Стрейч-пауза'],
  peaking: ['Околопредельные веса (RIR 0)', 'Кластеры 5×2'],
};

const CARD: React.CSSProperties = { background:'rgba(24,24,27,0.6)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'12px', margin:'6px 0' };
const SMALL: React.CSSProperties = { color:'rgba(255,255,255,0.55)', fontSize:10, lineHeight:1.4 };
const BTN: React.CSSProperties = { background:ACCENT, color:'#0a0a0a', border:'none', borderRadius:8, padding:'10px 14px', fontWeight:600, fontSize:12, minHeight:40, cursor:'pointer' };
const BTN_GHOST: React.CSSProperties = { ...BTN, background:'transparent', color:ACCENT, border:`1px solid ${ACCENT}20` };
const H: React.CSSProperties = { fontSize:13, fontWeight:700, color:ACCENT, marginBottom:8 };
const STEP_PILL = (active:boolean) => ({ padding:'5px 12px', borderRadius:16, fontSize:10, fontWeight:active?700:500, cursor:'pointer', border:active?'1px solid #00e68a':'1px solid rgba(255,255,255,0.06)', background:active?'linear-gradient(135deg,#00e68a,#00c8a0)':'#18181b', color:active?'#000':'#fff', flexShrink:0 } as React.CSSProperties);
const IN: React.CSSProperties = { background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, padding:'4px 8px', fontSize:11, outline:'none', boxSizing:'border-box', minHeight:30 };

function phaseForWeek(week: number, totalWeeks: number): BBPhase {
  if (totalWeeks <= 4) return week <= Math.ceil(totalWeeks * 0.75) ? 'accumulation' : 'intensification';
  const peakingWeeks = totalWeeks >= 8 ? 2 : (totalWeeks >= 6 ? 1 : 0);
  if (peakingWeeks > 0 && week > totalWeeks - peakingWeeks) return 'peaking';
  const prePeak = totalWeeks - peakingWeeks;
  const midDeload = totalWeeks >= 10 ? Math.round(totalWeeks * 0.45) : -1;
  if (week === prePeak && totalWeeks >= 6) return 'deload';
  if (week === midDeload) return 'deload';
  if (midDeload > 0 && week < midDeload) return 'accumulation';
  if (midDeload > 0 && week > midDeload && week < prePeak) return 'intensification';
  const totalBeforePrePeak = prePeak - 1;
  const accumWeeks = Math.round(totalBeforePrePeak * 0.6);
  return week <= accumWeeks ? 'accumulation' : 'intensification';
}

function computePhases(totalWeeks: number): { week: number; phase: BBPhase }[] {
  const phases: { week: number; phase: BBPhase }[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    const p = phaseForWeek(w, totalWeeks);
    phases.push({ week: w, phase: p });
  }
  return phases;
}

function exerciseComment(ex: BBExercise, weakPoints: string[], focusGroup: string, phase: BBPhase): string {
  const parts: string[] = [];
  if (ex.role === 'primary') {
    parts.push('🎯 Основное движение');
    if (weakPoints.includes(ex.muscle)) parts.push('🔥 Акцент на отстающую');
    if (focusGroup === ex.muscle) parts.push('⭐ Группа специализации');
  } else {
    parts.push('📌 Добивочное');
  }
  const phaseTech = PHASE_TECHNIQUES[phase];
  if (phaseTech.length > 0) {
    const techHint = phaseTech[Math.floor(Math.random() * phaseTech.length)];
    parts.push('💡 ' + techHint);
  }
  if (ex.character === 'тяж') parts.push('💪 Силовая нагрузка');
  else if (ex.character === 'памп') parts.push('🩸 Нагнетание крови');
  const catalogEx = EXERCISE_CATALOG.find(e => e.name === ex.name || e.name === ex.muscle);
  if (catalogEx?.movementPattern) parts.push('🧬 ' + catalogEx.movementPattern);
  if (catalogEx?.targetMuscle) {
    const targets = catalogEx.targetMuscle.split(',').map(t => t.trim()).filter(t => t !== ex.muscle);
    if (targets.length > 0) parts.push('🎯 Доп. нагрузка: ' + targets.join(', '));
  }
  return parts.join(' · ');
}

function calcQualityScore(metrics: BBPlanMetrics, weakPoints: string[], phases: { week: number; phase: BBPhase }[]): { score: number; label: string; details: string[] } {
  const details: string[] = [];
  let score = 100;
  let mrvPenalty = 0;
  let weakCoverageBonus = 0;
  for (const m of metrics.perMuscle) {
    if (m.status === 'exceeding_mrv') { mrvPenalty += 15; details.push('⚠ ' + m.muscle + ': превышение MRV (' + m.totalSets + ' > ' + m.mrv + ')'); }
    else if (m.status === 'approaching_mrv') { mrvPenalty += 5; details.push('📈 ' + m.muscle + ': близко к MRV (' + m.totalSets + '/' + m.mrv + ')'); }
    else if (m.status === 'below_mev') { mrvPenalty += 10; details.push('⚠ ' + m.muscle + ': недогруз (' + m.totalSets + ' < MEV ' + m.mev + ')'); }
    if (weakPoints.includes(m.muscle) && m.totalSets >= m.mev) weakCoverageBonus += 10;
    if (weakPoints.includes(m.muscle) && m.status === 'below_mev') details.push('❌ Слабая группа «' + m.muscle + '» недогружена (' + m.totalSets + '/' + m.mev + ')');
  }
  score -= mrvPenalty;
  score += Math.min(weakCoverageBonus, 30);
  const hasDeload = phases.some(p => p.phase === 'deload');
  if (!hasDeload && phases.length >= 6) { score -= 10; details.push('❌ Нет фазы разгрузки при мезо ' + phases.length + ' нед — риск перетрена'); }
  const hpRatio = metrics.тяжPct > 0 && metrics.пампPct > 0 ? metrics.тяжPct / metrics.пампPct : 0;
  if (hpRatio > 3) { score -= 10; details.push('⚖ Дисбаланс: тяж ' + (metrics.тяжPct*100).toFixed(0) + '% vs памп ' + (metrics.пампPct*100).toFixed(0) + '%'); }
  if (hpRatio < 0.3) { score -= 5; details.push('⚖ Мало тяжёлой нагрузки (необходима для прогрессии)'); }
  for (const m of metrics.perMuscle) {
    if (m.frequencyPerRotation < 1) { score -= 10; details.push('❌ ' + m.muscle + ' тренируется <1×/ротация'); }
  }
  score = Math.max(0, Math.min(100, score));
  const label = score >= 85 ? '🟢 Профессионально' : score >= 65 ? '🟡 Хорошо' : score >= 45 ? '🟠 Удовлетворительно' : '🔴 Требует доработки';
  return { score, label, details };
}

function generateWarmupSets(workSetWeight: number, targetSets: number, isCompound: boolean): { load: number; reps: number }[] {
  if (!isCompound || targetSets <= 0) return [];
  const warmups: { load: number; reps: number }[] = [];
  const steps = workSetWeight <= 60 ? 2 : workSetWeight <= 100 ? 3 : 4;
  for (let i = 1; i <= steps; i++) {
    const pct = 0.3 + (0.55 / steps) * i;
    warmups.push({ load: Math.round(workSetWeight * pct), reps: Math.min(8, 5 + i) });
  }
  return warmups;
}

function rotationSubstitutions(week: number, totalWeeks: number, muscle: string, currentName: string): string[] {
  const catalog = EXERCISE_CATALOG.filter(e => (e.group || '') === muscle && e.name !== currentName);
  if (catalog.length === 0) return [];
  const phase = phaseForWeek(week, totalWeeks);
  if (phase === 'accumulation' || phase === 'deload') return [];
  return catalog.slice(0, 3).map(e => e.name);
}

export const BbAutoConstructor: React.FC = () => {
  const linked = useDataLink();
  const prof = useMemo(() => loadTrainingProfile(), []);

  const [step, setStep] = useState<Step>('params');
  const [bbLevel, setBbLevel] = useState<string>(prof.level || 'intermediate');
  const [bbGoal, setBbGoal] = useState<string>(prof.goal === 'bulk' ? 'mass' : prof.goal || 'mass');
  const [bbDays, setBbDays] = useState<number>(prof.daysPerWeek || 4);
  const [bbWeeks, setBbWeeks] = useState<number>(8);
  const [bbVolGoal, setBbVolGoal] = useState<string>('mav');
  const [bbFocus, setBbFocus] = useState<string>('');
  const [planMode, setPlanMode] = useState<PlanMode>(prof.planMode === 'bb_cycle' ? 'bb_cycle' : 'generic_split');
  const [selectedCycleId, setSelectedCycleId] = useState<string>(prof.bbCycleId || '');
  const [loadStrategy, setLoadStrategy] = useState<LoadStrategy>((prof.loadStrategy as LoadStrategy) || 'double_progression');
  const [autoDeload, setAutoDeload] = useState<boolean>(true);
  const [deloadType, setDeloadType] = useState<DeloadType>('pump');

  const [peds, setPeds] = useState<PED[]>(prof.onCourse ? ['AAS'] : []);
  const [bbWorkMax, setBbWorkMax] = useState<Record<string, number>>(() => ({
    chest: 100, back: 110, quads: 140, hamstrings: 90, shoulders: 60, biceps: 50, triceps: 60, glutes: 160, calves: 120, abs: 60,
    ...(prof.workMax || {}),
  }));
  const [weakPoints, setWeakPoints] = useState<string[]>(prof.weakPoints || []);

  const [selectedSplitId, setSelectedSplitId] = useState<string>('');
  const [builtPlan, setBuiltPlan] = useState<BBPlan | null>(null);
  const [bbWeekSel, setBbWeekSel] = useState<number>(1);
  const [autoRegOn, setAutoRegOn] = useState(false);
  const [specializationMode, setSpecializationMode] = useState(false);
  const [editMode, setEditMode] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const [exerciseEdits, setExerciseEdits] = useState<Record<string, { sets: number; reps: number; weight: number }>>({});
  const [exSwapModal, setExSwapModal] = useState<{ si: number; ei: number; muscle: string; currentName: string } | null>(null);
  const [exSwapSearch, setExSwapSearch] = useState('');

  const phases = useMemo(() => computePhases(bbWeeks), [bbWeeks]);

  const autoRegResult = useMemo(() => {
    const rec = linked.readiness?.recovery ?? 80;
    const fat = linked.readiness?.fatigue ?? 30;
    const sleep = linked.readiness?.sleep ?? 70;
    const hrv = linked.profile?.settings?.baselineHrvRatio ?? 1.0;
    const srpe = loadSRPESessions();
    const acwr = srpe.length >= 2 ? acuteChronicRatio(toDailyLoads(srpe)) : { ratio: 1.0, zone: 'optimal' as const };
    return autoRegulate({ readiness: rec, acwr: { ratio: acwr.ratio, zone: acwr.zone }, fatigue: fat, hrvRatio: hrv, sleepScore: sleep, plannedTopSetPct: 0.8, plannedRIR: 2 });
  }, [linked.readiness, linked.profile?.settings]);

  const ranked = useMemo(() => rankBBSplits({ level: bbLevel, goal: bbGoal as any, daysPerWeek: bbDays, weakPoints: weakPoints.length > 0 ? weakPoints : undefined }), [bbLevel, bbGoal, bbDays, weakPoints]);
  const bestSplit = ranked[0];
  useEffect(() => { if (bestSplit && !selectedSplitId) setSelectedSplitId(bestSplit.pattern.id); }, [bestSplit]);

  const allLandmarks = useMemo(() => getAllVolumeLandmarks(bbLevel), [bbLevel]);
  const pedAdapt = useMemo(() => adaptForPEDs(peds, Object.fromEntries(Object.entries(allLandmarks).map(([m, v]) => [m, v.mrv]))), [peds, allLandmarks]);

  const metrics = useMemo(() => builtPlan ? calcBBPlanMetrics(builtPlan) : null, [builtPlan]);
  const quality = useMemo(() => metrics ? calcQualityScore(metrics, weakPoints, phases) : null, [metrics, weakPoints, phases]);

  useEffect(() => {
    try { saveTrainingProfile({ ...loadTrainingProfile(), workMax: bbWorkMax, weakPoints, onCourse: peds.length > 0, loadStrategy, planMode, bbCycleId: selectedCycleId }); } catch {}
  }, [bbWorkMax, weakPoints, peds, loadStrategy, planMode, selectedCycleId]);

  const adjustVolume = (mult: number) => {
    if (!builtPlan) return;
    const w2 = structuredClone(builtPlan.weeks);
    for (const w of w2) for (const s of w.sessions) for (const e of s.exercises) {
      e.sets = Math.max(1, Math.round(e.sets * mult));
    }
    setBuiltPlan({ ...builtPlan, weeks: w2 });
  };
  const adjustWeight = (mult: number) => {
    if (!builtPlan) return;
    const w2 = structuredClone(builtPlan.weeks);
    for (const w of w2) for (const s of w.sessions) for (const e of s.exercises) for (const ws of e.workSets) {
      ws.weight = Math.round(ws.weight * mult * 10) / 10;
    }
    setBuiltPlan({ ...builtPlan, weeks: w2 });
  };

  const bbCyclesList = useMemo(() => getCyclesByDirection('bodybuilding'), []);

  const buildBb = () => {
    let plan: BBPlan;

    if (planMode === 'bb_cycle' && selectedCycleId) {
      const cycle = getCycleById(selectedCycleId) as SRCycleTemplate | undefined;
      if (!cycle) { alert('Цикл не найден'); return; }
      plan = convertCycleToBBPlan({
        cycle,
        workMax: bbWorkMax,
        weakPoints,
        peds,
        loadStrategy: loadStrategy as string,
      });
      const cycleWeeks = cycle.meta.sessionsPerWeek;
      if (bbDays !== cycleWeeks) setBbDays(cycleWeeks);
      if (bbWeeks !== cycle.meta.weeks) setBbWeeks(cycle.meta.weeks);
    } else {
      const pattern = SPLIT_PATTERNS.find(p => p.id === selectedSplitId);
      if (!pattern) return;
      plan = buildBBPlan({
        patternId: selectedSplitId, level: bbLevel, goal: bbGoal as any, weeks: bbWeeks,
        workMax: bbWorkMax, weakPoints, focusGroup: bbFocus, volumeGoal: bbVolGoal as any,
        specialization: specializationMode,
      }, pedAdapt);
    }

    const srpe = loadSRPESessions();
    const acwr = srpe.length >= 2 ? acuteChronicRatio(toDailyLoads(srpe)) : null;
    const needsDeload = autoDeload && acwr && acwr.ratio > 1.3;
    const deloadProtocol = needsDeload ? DELOAD_PROTOCOLS[deloadType] : null;

    // Track week-in-phase for RIR drift
    let weeksInCurrentPhase = 0;
    let lastPhase = '';

    const w2 = structuredClone(plan.weeks);
    for (const w of w2) {
      const ph = phaseForWeek(w.week, bbWeeks);
      const volMult = PHASE_VOL_MULT[ph];
      const [rirStart, rirEnd] = PHASE_RIR[ph];
      const [repLo, repHi] = PHASE_REP[ph];
      const tempoStr = PHASE_TEMPO[ph];

      // Track week-in-phase for RIR drift
      if (ph !== lastPhase) { weeksInCurrentPhase = 1; lastPhase = ph; }
      else { weeksInCurrentPhase++; }

      const phaseWeeksTotal = phases.filter(p => p.phase === ph).length;

      // Count phases for phase-based rest times
      const restByPhase = ph === 'accumulation' ? 60 : ph === 'intensification' ? 90 : ph === 'peaking' ? 150 : 60;

      if (needsDeload && ph === 'deload' && deloadProtocol) {
        // Apply structured deload protocol
        for (const s of w.sessions) {
          for (const e of s.exercises) {
            e.rir = deloadProtocol.rirTarget;
            e.repsRange = [deloadProtocol.repRange[0], deloadProtocol.repRange[1]];
            for (const ws of e.workSets) {
              const maxW = bbWorkMax[e.muscle] || 80;
              const basePct = PCT_FOR_RIR[deloadProtocol.rirTarget] ?? 0.85;
              const baseWeight = Math.round(maxW * basePct * 10) / 10;
              ws.reps = Math.round((deloadProtocol.repRange[0] + deloadProtocol.repRange[1]) / 2);
              ws.rir = deloadProtocol.rirTarget;
              ws.tempo = tempoStr;
              ws.weight = Math.round(baseWeight * deloadProtocol.intensityMultiplier * 10) / 10;
              ws.restSeconds = deloadProtocol.restSeconds;
              e.sets = Math.max(1, Math.round(e.sets * deloadProtocol.volumeMultiplier));
            }
          }
        }
      } else {
        for (const s of w.sessions) {
          for (const e of s.exercises) {
            e.sets = Math.max(1, Math.round(e.sets * volMult));
            // RIR drift within phase
            const driftedRir = rirDrift([rirStart, rirEnd], weeksInCurrentPhase, phaseWeeksTotal);
            // RIR by exercise type: primary closer to failure, accessory further
            const isPrimary = e.role === 'primary';
            const isCalvesAbs = ['calves', 'abs'].includes(e.muscle);
            e.rir = isPrimary ? driftedRir : Math.min(5, driftedRir + 1);
            // Rep ranges by exercise type: compounds 8-12, isolation 12-20, calves/abs 15-25
            if (isCalvesAbs) {
              e.repsRange = [15, 25];
            } else if (isPrimary) {
              e.repsRange = e.character === 'тяж' ? [8, 12] : [10, 15];
            } else {
              e.repsRange = e.character === 'тяж' ? [10, 15] : [12, 20];
            }
            for (const ws of e.workSets) {
              const rirForWeight = e.rir; // phase-appropriate RIR (already drifted)
              const basePct = PCT_FOR_RIR[rirForWeight] ?? 0.9;
              const maxW = bbWorkMax[e.muscle] || 80;
              const baseWeight = Math.round(maxW * basePct * 10) / 10;

              ws.reps = Math.round((e.repsRange[0] + e.repsRange[1]) / 2);
              ws.rir = e.rir;
              ws.tempo = tempoStr;
              // Apply load strategy to weight from phase-appropriate baseline
              const prescr = prescribeLoad(loadStrategy as LoadStrategy, baseWeight, ws.reps, e.rir, maxW, w.week, bbWeeks, ph);
              ws.weight = Math.round(prescr.nextWeight * 10) / 10;
              ws.restSeconds = restByPhase;
            }
          }
        }
      }
    }

    // Apply auto-regulation multipliers when autoRegOn is active
    if (autoRegOn && autoRegResult) {
      for (const w of w2) {
        for (const s of w.sessions) {
          for (const e of s.exercises) {
            e.sets = Math.max(1, Math.round(e.sets * autoRegResult.volumeMultiplier));
            for (const ws of e.workSets) {
              ws.weight = Math.round(ws.weight * autoRegResult.topSetPctMultiplier * 10) / 10;
            }
            e.rir = Math.min(5, e.rir + autoRegResult.rirShift);
            e.repsRange = [Math.max(1, e.repsRange[0] - autoRegResult.rirShift), Math.max(2, e.repsRange[1] - autoRegResult.rirShift)];
          }
        }
      }
    }

    const modeLabel = planMode === 'bb_cycle' ? `BB-цикл: ${getCycleById(selectedCycleId)?.meta.title || selectedCycleId}` : 'Generic-сплит';
    setBuiltPlan({ ...plan, weeks: w2, rationale: [...plan.rationale, `📌 Источник: ${modeLabel}`, `📈 Стратегия: ${loadStrategy}`, `🔄 Делод-протокол: ${needsDeload ? DELOAD_PROTOCOLS[deloadType].description : 'нет'}`, `💪 Слабые группы: ${weakPoints.length > 0 ? weakPoints.join(', ') : 'нет'}`] });
    setBbWeekSel(1);
    setStep('plan');
    try {
      const sessions = w2.flatMap(w => w.sessions.map((s, si) => ({
        label: 'Нед' + w.week + ' Д' + (si+1),
        exercises: s.exercises.map(e => ({ name: e.name, muscleGroup: e.muscle, sets: e.sets, reps: e.workSets[0]?.reps || 10, weight: e.workSets[0]?.weight || 60, rir: e.rir })),
      })));
      localStorage.setItem('he_pl_runtime', JSON.stringify(sessions));
    } catch {}
  };

  const handleSavePlan = () => {
    try { localStorage.setItem('he_bb_plan_saved', JSON.stringify({ plan: builtPlan, date: new Date().toISOString() })); alert('План сохранён'); } catch { alert('Ошибка сохранения'); }
  };
  const handleReplaceExercise = (si: number, ei: number, newName: string) => {
    if (!newName || !builtPlan) return;
    const found = EXERCISE_CATALOG.find(x => x.name.toLowerCase() === newName.toLowerCase());
    if (!found) return;
    const w3 = structuredClone(builtPlan.weeks);
    const wLen = w3.length;
    const weekIdx = Math.min(bbWeekSel, wLen) - 1;
    if (w3[weekIdx]?.sessions[si]?.exercises[ei]) {
      w3[weekIdx].sessions[si].exercises[ei].name = found.name;
      w3[weekIdx].sessions[si].exercises[ei].muscle = found.group || w3[weekIdx].sessions[si].exercises[ei].muscle;
    }
    setBuiltPlan({ ...builtPlan, weeks: w3 });
  };

  const handleSendToExecution = () => {
    if (!builtPlan) return;
    try {
      const sessions = builtPlan.weeks.flatMap(w => w.sessions.map((s, si) => ({
        label: 'Нед' + w.week + ' Д' + (si+1),
        exercises: s.exercises.map(e => ({ name: e.name, muscleGroup: e.muscle, sets: e.sets, reps: e.workSets[0]?.reps || 10, weight: e.workSets[0]?.weight || 60, rir: e.rir })),
      })));
      localStorage.setItem('he_pl_runtime', JSON.stringify(sessions));
      alert('План отправлен на выполнение. Перейдите в Тренировка.');
    } catch { alert('Ошибка'); }
  };

  const stepList: Step[] = planMode === 'bb_cycle' ? ['params','ped','plan','quality','adjust'] : ['params','ped','split','plan','quality','adjust'];
  const stepLabels: Record<Step,string> = { params:'1 Параметры', ped:'2 PED+Вес', split:'3 Сплит', plan: planMode === 'bb_cycle' ? '3 План' : '4 План', quality: planMode === 'bb_cycle' ? '4 Качество' : '5 Качество', adjust: planMode === 'bb_cycle' ? '5 Коррекция' : '6 Коррекция' };
  const renderStepNav = () => (
    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
      {stepList.map(s => {
        return <button key={s} onClick={() => { if ((s === 'plan' || s === 'quality' || s === 'adjust') && !builtPlan) return; setStep(s); }} style={STEP_PILL(step === s)}>{stepLabels[s]}</button>;
      })}
    </div>
  );

  const renderParams = () => (
    <div>
      <div style={H}>📋 Шаг 1: Базовые параметры</div>

      {/* Plan mode: cycle vs generic split */}
      <div style={{ marginBottom:10, padding:'8px 10px', borderRadius:10, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.15)' }}>
        <div style={{ fontSize:10, fontWeight:700, color:'#a855f7', marginBottom:6 }}>📌 Источник программы</div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={() => setPlanMode('generic_split')} style={{
            flex:1, padding:'8px 10px', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:11,
            border: planMode === 'generic_split' ? '2px solid #a855f7' : '1px solid rgba(255,255,255,0.08)',
            background: planMode === 'generic_split' ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.02)',
            color: planMode === 'generic_split' ? '#a855f7' : 'rgba(255,255,255,0.6)',
          }}>🧩 Generic-сплит (авто-генерация)</button>
          <button onClick={() => setPlanMode('bb_cycle')} style={{
            flex:1, padding:'8px 10px', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:11,
            border: planMode === 'bb_cycle' ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.08)',
            background: planMode === 'bb_cycle' ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)',
            color: planMode === 'bb_cycle' ? '#00e68a' : 'rgba(255,255,255,0.6)',
          }}>📋 ПРОФ-цикл (12 готовых программ)</button>
        </div>
      </div>

      {planMode === 'bb_cycle' && (
        <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#00e68a', marginBottom:6 }}>📚 Выберите BB-цикл</div>
          <PopupSelect label="BB-цикл" value={selectedCycleId} onChange={v => { setSelectedCycleId(v); const c = getCycleById(v); if (c) { setBbDays(c.meta.sessionsPerWeek); setBbWeeks(c.meta.weeks); } }} options={[
            ...bbCyclesList.map(c => ({
              id: c.meta.id,
              label: `${c.meta.title} (${c.meta.weeks} нед, ${c.meta.sessionsPerWeek}×/нед)`,
              description: c.meta.description?.slice(0, 120),
            })),
          ]} />
          {selectedCycleId && (() => {
            const c = getCycleById(selectedCycleId);
            if (!c) return null;
            return (
              <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Уровень:</span> {c.meta.level}</div>
                <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Фокус:</span> {c.meta.targetFocus || '—'}</div>
                {c.meta.deloadWeeks && c.meta.deloadWeeks.length > 0 && <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Разгрузка:</span> нед {c.meta.deloadWeeks.join(', ')}</div>}
                {c.meta.rirProgression && <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>RIR:</span> {c.meta.rirProgression.start}→{c.meta.rirProgression.end}</div>}
                {c.meta.phases && c.meta.phases.length > 0 && <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Фазы:</span> {c.meta.phases.map(ph => ph.title || `нед ${ph.weekStart}-${ph.weekEnd}`).join(', ')}</div>}
                <div style={{ marginTop:4, padding:'4px 8px', borderRadius:6, background:'rgba(0,230,138,0.06)', fontSize:9, color:'rgba(255,255,255,0.7)' }}>{c.meta.description?.slice(0, 200)}</div>
              </div>
            );
          })()}
        </div>
      )}

      {planMode === 'generic_split' && (
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <PopupSelect label="Уровень" value={bbLevel} onChange={setBbLevel} options={[['beginner','Новичок'],['intermediate','Средний'],['advanced','Опытный'],['enhanced','Enhanced (PED)']].map(([id,label]) => ({ id, label }))} />
        <PopupSelect label="Цель" value={bbGoal} onChange={setBbGoal} options={[['mass','Мышечная масса'],['cut','Сушка'],['recomp','Рекомпозиция'],['maintenance','Поддержание'],['strength_mass','Сила + Масса']].map(([id,label]) => ({ id, label }))} />
        <PopupNumber label="Дней/нед" value={bbDays} min={3} max={6} onChange={v => setBbDays(v)} />
        <PopupNumber label="Недель мезо" value={bbWeeks} min={4} max={24} suffix=" нед" onChange={v => setBbWeeks(v)} />
        <PopupSelect label="Цель объёма" value={bbVolGoal} onChange={setBbVolGoal} options={[['mev','Минимум (MEV)'],['mav','Оптимум (MAV)'],['mrv','Максимум (MRV)']].map(([id,label]) => ({ id, label }))} />
        <PopupSelect label="Фокус-группа" value={bbFocus} onChange={setBbFocus} options={[{ id:'', label:'Нет' }, ...WEAK_GROUPS.map(([id,l]) => ({ id, label: l }))]} />
      </div>
      )}
      <div style={{ marginTop:12, padding:10, borderRadius:10, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.15)' }}>
        <div style={{ fontSize:10, fontWeight:700, color:'#a855f7', marginBottom:6 }}>📈 Стратегия прогрессии</div>
        <PopupSelect label="" value={loadStrategy} onChange={v => setLoadStrategy(v as LoadStrategy)} options={[
          { id:'double_progression', label:'🔄 Двойная прогрессия: сначала повторы → потом вес (рекоменд.)' },
          { id:'linear', label:'📈 Линейная: +2.5 кг/нед для compounds, +1 кг для изоляции' },
          { id:'wave', label:'🌊 Волновая: 3-нед микроциклы (тяж/ср/лёг)' },
          { id:'rpe_based', label:'🎯 RPE-базированная: авто-подбор веса по ощущению (продвинутый)' },
        ]} />
        <div style={{ marginTop:4, fontSize:9, color:'rgba(255,255,255,0.5)' }}>
          {loadStrategy === 'double_progression' && 'Стратегия PRO-бодибилдеров: добейте повторы до верхней границы, затем повысьте вес на 5%.'}
          {loadStrategy === 'linear' && 'Классическая силовая прогрессия: еженедельное прибавление веса. Эффективно для новичков и intermediates.'}
          {loadStrategy === 'wave' && 'Продвинутая периодизация: 3-нед циклы тяжёлая/средняя/лёгкая неделя. Управление утомлением.'}
          {loadStrategy === 'rpe_based' && 'Для опытных: вес подбирается по ощущению (RPE). Авто-регуляция под текущее состояние.'}
        </div>
      </div>
      <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
        <label style={{ fontSize:10, color:'rgba(255,255,255,0.6)', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          <input type="checkbox" checked={autoDeload} onChange={e => setAutoDeload(e.target.checked)} style={{ accentColor: ACCENT }} />
          Авто-разгрузка при ACWR {`>`} 1.3
        </label>
      </div>
      {autoDeload && (
        <div style={{ marginTop:6 }}>
          <PopupSelect label="Тип разгрузки" value={deloadType} onChange={v => setDeloadType(v as DeloadType)} options={[
            { id:'pump', label:'🩸 Pump-разгрузка: лёгкие веса, высокие повторы (рекоменд.)' },
            { id:'neural', label:'🧠 Нейральная: низкий объём, умеренный вес, долгий отдых' },
            { id:'full_rest', label:'😴 Полный отдых: минимальная активность, только при перетрене' },
          ]} />
          <div style={{ marginTop:4, padding:'4px 8px', borderRadius:6, background:'rgba(34,197,94,0.06)', fontSize:9, color:'rgba(255,255,255,0.6)' }}>
            {DELOAD_PROTOCOLS[deloadType].description}
          </div>
        </div>
      )}
      <button style={{ ...BTN, width:'100%', marginTop:12 }} onClick={() => setStep('ped')}>Далее: PED и рабочие веса →</button>
    </div>
  );

  const renderPedWorkMax = () => (
    <div>
      <div style={H}>💉 Шаг 2: Фармакология и рабочие веса</div>
      <div style={{ padding:'8px 10px', borderRadius:10, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)', marginBottom:10 }}>
        <div style={{ fontSize:10, fontWeight:700, color:ACCENT, marginBottom:6 }}>PED-адаптация объёмов</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {(['AAS','insulin','MGF','IGF1','GH'] as PED[]).map(p => (
            <button key={p} onClick={() => setPeds(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
              style={{ padding:'6px 12px', borderRadius:8, fontSize:10, fontWeight:700, cursor:'pointer', border:peds.includes(p)?'1px solid #00e68a':'1px solid rgba(255,255,255,0.08)', background:peds.includes(p)?'rgba(0,230,138,0.15)':'rgba(255,255,255,0.02)', color:peds.includes(p)?'#00e68a':'rgba(255,255,255,0.6)' }}>
              {['AAS: ААС','insulin: Инсулин','MGF: MGF','IGF1: IGF-1','GH: ГР'][['AAS','insulin','MGF','IGF1','GH'].indexOf(p)]}{peds.includes(p)?' ✓':''}
            </button>
          ))}
        </div>
        {peds.length > 0 && <div style={{ ...SMALL, marginTop:6 }}>{explainPEDAdaptation(pedAdapt)}</div>}
      </div>
      <div style={H}>💪 Рабочие максимумы (кг)</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:10 }}>
        {BB_WM_KEYS.map(k => <PopupNumber key={k} label={BB_WM_RU[k]} value={bbWorkMax[k] || 80} min={10} max={500} suffix=' кг' onChange={v => setBbWorkMax(p => ({ ...p, [k]: v }))} />)}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
        <div style={{ fontSize:11, fontWeight:700, color:ACCENT }}>🎯 Слабые группы</div>
        <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:9, color:'rgba(255,255,255,0.5)', cursor:'pointer', marginLeft:'auto', padding:'3px 8px', borderRadius:6, background:specializationMode?'rgba(236,72,153,0.12)':'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
          <input type="checkbox" checked={specializationMode} onChange={e => setSpecializationMode(e.target.checked)} style={{ accentColor:'#ec4899' }} />
          Режим специализации
        </label>
      </div>
      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
        {WEAK_GROUPS.map(([id,l]) => {
          const on = weakPoints.includes(id);
          return <button key={id} onClick={() => setWeakPoints(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
            style={{ padding:'5px 10px', borderRadius:14, fontSize:10, fontWeight:700, cursor:'pointer', border:on?'1px solid #00e68a':'1px solid rgba(255,255,255,0.08)', background:on?'rgba(0,230,138,0.15)':'rgba(255,255,255,0.02)', color:on?'#00e68a':'rgba(255,255,255,0.6)' }}>{l}{on?' ✓':''}</button>;
        })}
      </div>
      <div style={{ marginBottom:6, padding:'6px 10px', borderRadius:8, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)', fontSize:10, color:'rgba(255,255,255,0.7)' }}>
        💡 Слабые группы получают: +20% объёма, приоритетное размещение (первые упражнения), снижение RIR на 0.5 (тяжелее).
      </div>
      {specializationMode && <div style={{ marginBottom:10, padding:'6px 10px', borderRadius:8, background:'rgba(236,72,153,0.06)', border:'1px solid rgba(236,72,153,0.15)', fontSize:10, color:'rgba(255,255,255,0.7)' }}>
        🔴 Режим специализации: топ-2 слабые группы на MAV+10%, остальные на MEV (поддерживающий объём).
      </div>}
      <button style={{ ...BTN, width:'100%' }} onClick={() => planMode === 'bb_cycle' ? buildBb() : setStep('split')}>
        {planMode === 'bb_cycle' ? '⚡ Собрать план по циклу →' : 'Далее: выбрать сплит →'}
      </button>
    </div>
  );

  const renderSplit = () => (
    <div>
      <div style={H}>🏆 Шаг 3: Выбор сплита</div>
      <div style={{ marginBottom:8, padding:'6px 10px', borderRadius:8, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.12)', fontSize:10, color:'rgba(255,255,255,0.7)' }}>
        📅 Фазы: {phases.filter((p,i,a) => p.phase !== a[i-1]?.phase).map((p,i) => <span key={i} style={{ color:PHASE_COLORS[p.phase], fontWeight:700 }}>{PHASE_LABELS[p.phase]}{i < phases.length - 1 ? ' → ' : ''}</span>)}
      </div>
      <div style={{ marginBottom:10, padding:'6px 10px', borderRadius:8, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.1)', fontSize:9, color:'rgba(255,255,255,0.55)' }}>
        💡 Частота каждой группы — ключевой фактор роста. 2×/нед = оптимум для синтеза белка (Schoenfeld 2016, JSF 2019).
        Чипсы <span style={{ color:'#00e68a' }}>зелёные</span> = 2+×/нед (рекомендуемая частота), <span style={{ color:'rgba(255,255,255,0.4)' }}>серые</span> = 1×/нед.
      </div>
      {bestSplit && (
        <div style={{ marginBottom:10, padding:12, borderRadius:12, background:'linear-gradient(135deg,rgba(250,204,21,0.08),rgba(250,204,21,0.02))', border:'1px solid rgba(250,204,21,0.25)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <span style={{ fontWeight:800, fontSize:13, color:'#facc15' }}>🏆 Рекомендованный сплит: {bestSplit.pattern.name}</span>
            <span style={{ fontSize:12, color:'#facc15', fontWeight:700, background:'rgba(250,204,21,0.15)', padding:'2px 10px', borderRadius:6 }}>скор {bestSplit.score}</span>
          </div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', marginBottom:6 }}>{bestSplit.pattern.description}</div>
          {bestSplit.rationale.slice(0, 3).map((x,i) => <div key={i} style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>✓ {x}</div>)}
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button onClick={() => { setSelectedSplitId(bestSplit.pattern.id); }} style={{ padding:'6px 16px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', background:'rgba(250,204,21,0.15)', border:'1px solid rgba(250,204,21,0.3)', color:'#facc15' }}>✅ Применить</button>
            <button onClick={buildBb} style={{ padding:'6px 16px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', background:'rgba(0,230,138,0.15)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a' }}>⚡ Собрать план</button>
          </div>
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
        {ranked.map(r => {
          const sel = selectedSplitId === r.pattern.id;
          const mf = getMuscleFrequencies(r.pattern);
          return <div key={r.pattern.id} onClick={() => setSelectedSplitId(r.pattern.id)}
            style={{ padding:'10px 12px', borderRadius:10, cursor:'pointer', border:sel?'1px solid #00e68a':'1px solid rgba(255,255,255,0.06)', background:sel?'rgba(0,230,138,0.08)':'rgba(255,255,255,0.02)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight:700, fontSize:12, color:sel?'#00e68a':'#fff' }}>{r.pattern.name}</span>
              <span style={{ fontSize:10, color:ACCENT, fontWeight:700, background:'rgba(0,230,138,0.12)', padding:'2px 8px', borderRadius:6 }}>скор {r.score}</span>
            </div>
            <div style={{ ...SMALL, marginTop:4 }}>{r.pattern.description}</div>
            {sel && <div style={{ marginTop:6, fontSize:10, color:'rgba(255,255,255,0.7)' }}>{r.rationale.map((x,i) => <div key={i}>✓ {x}</div>)}</div>}
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:4 }}>
              {mf.map(f => (
                <span key={f.tag} style={{ fontSize:8, padding:'1px 6px', borderRadius:4, background:f.freq >= 2 ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.03)', color:f.freq >= 2 ? '#00e68a' : 'rgba(255,255,255,0.4)' }}>{TAG_LABELS_RU[f.tag] || f.tag} ~ {f.freq}×/нед</span>
              ))}
            </div>
          </div>;
        })}
      </div>
      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        <button style={{ ...BTN, flex:1 }} onClick={buildBb}>✅ Собрать план ({bbWeeks} нед, фазовая периодизация)</button>
        <button style={BTN_GHOST} onClick={() => setStep('ped')}>← Назад</button>
      </div>
    </div>
  );

  const renderPlanWithComments = () => {
    if (!builtPlan || !metrics) return null;
    const W = builtPlan.weeks;
    const wk = W[Math.min(bbWeekSel, W.length) - 1] || W[0];
    const currentPhase = phaseForWeek(wk.week, bbWeeks);
    const srpe = loadSRPESessions();
    const acwr = srpe.length >= 2 ? acuteChronicRatio(toDailyLoads(srpe)) : null;
    const needsDeload = autoDeload && acwr && acwr.ratio > 1.3;

    return (
      <div>
        <div style={H}>📋 Шаг 4: План — {builtPlan.pattern.name}</div>

        {/* Phase banner */}
        <div style={{ marginBottom:6, padding:'8px 10px', borderRadius:10, background:PHASE_COLORS[currentPhase] + '18', border:'1px solid ' + PHASE_COLORS[currentPhase] + '30' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:12, fontWeight:700, color:PHASE_COLORS[currentPhase] }}>📌 Фаза: {PHASE_LABELS[currentPhase]}</span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.7)' }}>
              RIR {PHASE_RIR[currentPhase][0]}→{PHASE_RIR[currentPhase][1]} · Повт {PHASE_REP[currentPhase][0]}-{PHASE_REP[currentPhase][1]} · Темп {PHASE_TEMPO[currentPhase]}
            </span>
          </div>
          <div style={{ marginTop:4, fontSize:9, color:'rgba(255,255,255,0.55)' }}>
            {currentPhase === 'accumulation' && '🎯 Цель: накопление метаболического стресса. Больше объёма, умеренные веса, контроль времени под нагрузкой.'}
            {currentPhase === 'intensification' && '🎯 Цель: механическое натяжение. Снижение объёма, рост рабочих весов, подходы ближе к отказу.'}
            {currentPhase === 'deload' && '🎯 Цель: активное восстановление. Минимум объёма, лёгкие веса, сохранение движения.'}
            {currentPhase === 'peaking' && '🎯 Цель: максимальная сила и плотность. Низкий объём, высокие веса, околопредельные подходы.'}
          </div>
        </div>

        {needsDeload && currentPhase !== 'deload' && (
          <div style={{ marginBottom:6, padding:8, borderRadius:8, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', color:'#ef4444', fontSize:10, fontWeight:600 }}>
            {'🚨'} ACWR {acwr?.ratio.toFixed(2)} {`>`} 1.3 — рекомендуется разгрузка. Включена авто-разгрузка на неделе {phases.find(p => p.phase === 'deload')?.week || 'последней'}.
          </div>
        )}

        {/* Auto-reg + ACWR */}
        <div style={{ marginTop:6, padding:'8px 10px', borderRadius:10, background:autoRegResult.deload?'rgba(239,68,68,0.08)':'rgba(96,165,250,0.06)', border:'1px solid '+(autoRegResult.deload?'rgba(239,68,68,0.25)':'rgba(96,165,250,0.2)') }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:11, fontWeight:700, color:autoRegResult.deload?'#ef4444':'#60a5fa' }}>{shouldTrainToday({ readiness: linked.readiness?.recovery ?? 80, acwr: autoRegResult.deload ? { ratio: 1.8, zone: 'dangerous' } : { ratio: 1.0, zone: 'optimal' }, fatigue: linked.readiness?.fatigue ?? 30, hrvRatio: linked.profile?.settings?.baselineHrvRatio ?? 1.0 }).reason}</span>
            <button onClick={() => setAutoRegOn(a => !a)} style={{ padding:'5px 10px', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background:autoRegOn?'#60a5fa':'rgba(255,255,255,0.1)', color:autoRegOn?'#000':'var(--text-dim)' }}>{autoRegOn?'Авторег ON':'Вкл. авторег'}</button>
          </div>
          {acwr && <div style={{ marginTop:4, fontSize:9, color:'rgba(255,255,255,0.5)' }}>ACWR {acwr.ratio.toFixed(2)} — {acwr.zone === 'dangerous' ? '⛔ опасная зона, разгрузка' : acwr.zone === 'caution' ? '⚠ осторожно' : '✅ оптимально'}</div>}
          {autoRegOn && <div style={{ marginTop:6, fontSize:10, color:'rgba(255,255,255,0.7)' }}><div>Топ-сет ×{autoRegResult.topSetPctMultiplier} · объём ×{autoRegResult.volumeMultiplier} · RIR +{autoRegResult.rirShift}{autoRegResult.deload?' · 🔴 DELOAD':''}</div>{autoRegResult.decisions.slice(0,2).map((d,i) => <div key={i}>• {d}</div>)}</div>}
        </div>

        {/* Overload targets for this week */}
        {(() => {
          const targets = computeOverloadTargets(wk, loadStrategy, bbWorkMax, bbWeeks, currentPhase).slice(0, 6);
          if (targets.length === 0) return null;
          return (
            <ExpandableCard title={'🎯 Цели прогрессии на эту неделю (' + loadStrategy.replace('_', ' ') + ')'} icon="🎯" short={targets[0].nextTarget + (targets.length > 1 ? (' + ещё ' + (targets.length - 1)) : '')} full={
              <div>{targets.map((t, i) => <div key={i} style={{ padding:'4px 8px', marginBottom:4, borderRadius:6, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.12)', fontSize:10, color:'rgba(255,255,255,0.8)' }}>
                <b>{t.exerciseName}</b>: {t.nextTarget}
              </div>)}</div>
            } />
          );
        })()}

        {/* Week selector with phase colors */}
        <div style={{ marginTop:10 }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', marginBottom:6, fontWeight:700 }}>
            Неделя {wk.week} из {W.length} · <span style={{ color:PHASE_COLORS[currentPhase] }}>{PHASE_LABELS[currentPhase]}</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(36px, 1fr))', gap:4 }}>
            {W.map(w => {
              const ph = phaseForWeek(w.week, bbWeeks);
              const active = w.week === wk.week;
              return <button key={w.week} onClick={() => setBbWeekSel(w.week)}
                style={{ padding:'7px 0', borderRadius:7, fontSize:10, fontWeight:700, cursor:'pointer',
                  border: active ? '2px solid ' + PHASE_COLORS[ph] : '1px solid rgba(255,255,255,0.08)',
                  background: active ? PHASE_COLORS[ph] + '30' : 'rgba(255,255,255,0.02)',
                  color: active ? PHASE_COLORS[ph] : '#fff' }}>
                {w.week}
              </button>;
            })}
          </div>
        </div>

        {/* Calendar with phase colors */}
        <div style={{ marginTop:8, padding:8, borderRadius:10, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.6)', marginBottom:6 }}>📅 Календарь мезоцикла (цвет = фаза)</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {W.map(w => {
              const ph = phaseForWeek(w.week, bbWeeks);
              const active = w.week === wk.week;
              const daySets = w.sessions.map(s => s.exercises.reduce((ss, e) => ss + e.sets, 0));
              const maxD = Math.max(1, ...W.flatMap(ww => ww.sessions.map(s => s.exercises.reduce((ss, e) => ss + e.sets, 0))));
              return (
                <div key={w.week} onClick={() => setBbWeekSel(w.week)} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 6px', borderRadius:6, cursor:'pointer', background:active ? PHASE_COLORS[ph] + '15' : 'transparent', borderLeft: '3px solid ' + PHASE_COLORS[ph] + '60' }}>
                  <span style={{ fontSize:9, fontWeight:700, color:active ? PHASE_COLORS[ph] : 'rgba(255,255,255,0.7)', minWidth:26 }}>Н{w.week}</span>
                  <div style={{ flex:1, display:'flex', gap:2 }}>{daySets.map((ds, di) => <div key={di} style={{ flex:1, height:14, borderRadius:3, background: `linear-gradient(180deg,${PHASE_COLORS[ph]},${PHASE_COLORS[ph]}88)`, opacity: 0.15 + 0.85 * (ds / maxD) }} />)}</div>
                  <span style={{ fontSize:8, color:'rgba(255,255,255,0.5)', minWidth:30, textAlign:'right' }}>{daySets.reduce((a,b)=>a+b,0)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progression chart across all weeks */}
        {(() => {
          const wkStats = W.map(w => {
            const ph = phaseForWeek(w.week, bbWeeks);
            const exs = w.sessions.flatMap(s => s.exercises);
            const sets = exs.reduce((s, e) => s + e.sets, 0);
            const rir = sets > 0 ? exs.reduce((s, e) => s + e.rir * e.sets, 0) / sets : 0;
            const totalWt = exs.reduce((s, e) => s + (e.workSets[0]?.weight || 80) * e.sets, 0);
            return { week: w.week, phase: ph, sets, rir, tonnage: totalWt };
          });
          const maxSets = Math.max(1, ...wkStats.map(x => x.sets));
          const maxTon = Math.max(1, ...wkStats.map(x => x.tonnage));
          return (
            <div style={{ marginTop:10, padding:'8px 10px', borderRadius:10, background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.15)' }}>
              <div style={{ fontSize:10, fontWeight:800, color:'#22c55e', marginBottom:6 }}>📈 ПРОГРЕССИЯ ПО НЕДЕЛЯМ: RIR / ОБЪЁМ / ТОННАЖ</div>
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                {wkStats.map(x => {
                  const barW = 220;
                  return (
                    <div key={x.week} style={{ display:'flex', alignItems:'center', gap:4, padding:'2px 0' }}>
                      <button onClick={() => setBbWeekSel(x.week)} style={{
                        minWidth:32, padding:'2px 4px', borderRadius:4, cursor:'pointer', fontSize:8, fontWeight:700,
                        border: x.week === bbWeekSel ? '1px solid ' + PHASE_COLORS[x.phase] : '1px solid transparent',
                        background: x.week === bbWeekSel ? PHASE_COLORS[x.phase] + '20' : 'transparent',
                        color: x.week === bbWeekSel ? PHASE_COLORS[x.phase] : 'rgba(255,255,255,0.5)',
                      }}>{x.week}</button>
                      <div style={{ fontSize:7, fontWeight:600, minWidth:56, color: PHASE_COLORS[x.phase] }}>{PHASE_LABELS[x.phase]}</div>
                      <div style={{ fontSize:8, fontWeight:700, minWidth:20, textAlign:'center', color:x.rir <= 1 ? '#ef4444' : x.rir <= 2 ? '#f59e0b' : '#22c55e' }}>RIR{x.rir.toFixed(0)}</div>
                      <div style={{ flex: 1, display:'flex', gap:2, alignItems:'center' }}>
                        <div style={{ height:8, width: Math.round((x.sets / maxSets) * barW), borderRadius:3, background: PHASE_COLORS[x.phase], opacity:0.6, transition:'width 0.5s', minWidth: x.sets > 0 ? 4 : 0 }} />
                        <span style={{ fontSize:7, fontWeight:600, color:'rgba(255,255,255,0.4)', minWidth:16 }}>{x.sets}</span>
                      </div>
                      <div style={{ flex: 1, display:'flex', gap:2, alignItems:'center' }}>
                        <div style={{ height:6, width: Math.round((x.tonnage / maxTon) * barW), borderRadius:2, background:'#60a5fa', opacity:0.5, transition:'width 0.5s', minWidth: x.tonnage > 0 ? 4 : 0 }} />
                        <span style={{ fontSize:7, fontWeight:600, color:'rgba(255,255,255,0.4)', minWidth:24 }}>{(x.tonnage / 1000).toFixed(1)}k</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display:'flex', gap:12, marginTop:4, fontSize:7, color:'rgba(255,255,255,0.3)', borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:3 }}>
                <span><span style={{ width:8, height:8, borderRadius:2, background:'#22c55e', display:'inline-block', marginRight:2 }} /> сеты/нед</span>
                <span><span style={{ width:8, height:8, borderRadius:2, background:'#60a5fa', display:'inline-block', marginRight:2 }} /> тоннаж</span>
                <span>RIR: 🟢3+ 🟡1-2 🔴0</span>
              </div>
            </div>
          );
        })()}

        {/* Daily session tables with phase-aware comments */}
        <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:8 }}>
          {wk.sessions.map((s, si) => (
            <div key={si} style={{ background:'rgba(255,255,255,0.02)', borderRadius:10, border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:PHASE_COLORS[currentPhase] + '12', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>🏋️ День {si+1} · {s.character} · {s.sessionTag}</span>
                <span style={{ fontSize:9, color:PHASE_COLORS[currentPhase], fontWeight:700 }}>{PHASE_LABELS[currentPhase]}</span>
              </div>
              <div style={{ padding:'4px 0' }}>
                {s.exercises.map((e, ei) => {
                  const rawW = e.workSets[0]?.weight || 80;
                  const adjW = autoRegOn && autoRegResult ? Math.round(rawW * autoRegResult.topSetPctMultiplier * 10) / 10 : rawW;
                  const adjSets0 = autoRegOn && autoRegResult ? Math.max(1, Math.round(e.sets * autoRegResult.volumeMultiplier)) : e.sets;
                  const editKey = `${si}-${ei}`;
                  const edit = exerciseEdits[editKey] || { sets: adjSets0, reps: e.workSets[0]?.reps || 10, weight: adjW };
                  const comment = exerciseComment(e, weakPoints, bbFocus, currentPhase);
                  const isEditing = editMode?.dayIdx === si && editMode?.exIdx === ei;
                  const warmups = e.role === 'primary' && e.character === 'тяж' ? generateWarmupSets(edit.weight, edit.sets, true) : [];
                  const rotEx = rotationSubstitutions(wk.week, bbWeeks, e.muscle, e.name);
                  return (
                    <div key={ei} style={{ padding:'6px 10px', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div style={{ fontWeight:700, fontSize:11, color:'#fff' }}>{e.name}</div>
                        <button onClick={() => setEditMode(isEditing ? null : { dayIdx: si, exIdx: ei })}
                          style={{ padding:'3px 8px', borderRadius:6, fontSize:9, fontWeight:600, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.03)', color:'rgba(255,255,255,0.7)' }}>
                          {isEditing ? '✕ Готово' : '✎ Править'}
                        </button>
                      </div>
                      {isEditing ? (
                        <div style={{ display:'flex', gap:8, marginTop:6, alignItems:'center' }}>
                          <div><span style={SMALL}>Сеты</span><input type="number" value={edit.sets} min={0} max={20} onChange={e2 => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, sets: parseInt(e2.target.value) || 0 } }))} style={{ width:45, ...IN }} /></div>
                          <div><span style={SMALL}>Повт</span><input type="number" value={edit.reps} min={1} max={30} onChange={e2 => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, reps: parseInt(e2.target.value) || 1 } }))} style={{ width:45, ...IN }} /></div>
                          <div><span style={SMALL}>Вес</span><input type="number" value={edit.weight} min={0} max={500} onChange={e2 => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, weight: parseInt(e2.target.value) || 0 } }))} style={{ width:55, ...IN }} /></div>
                        </div>
                      ) : null}
                      <div style={{ display:'flex', gap:8, marginTop:4, fontSize:10, color:'rgba(255,255,255,0.85)' }}>
                        <span style={{ padding:'2px 6px', borderRadius:4, background:e.role==='primary'?'rgba(0,230,138,0.12)':'rgba(168,85,247,0.12)', color:e.role==='primary'?'#00e68a':'#a855f7', fontWeight:700, fontSize:9 }}>{e.role === 'primary' ? '🎯 Primary' : '📌 Accessory'}</span>
                        <span style={{ padding:'2px 6px', borderRadius:4, background:e.character==='тяж'?'rgba(239,68,68,0.12)':'rgba(96,165,250,0.12)', color:e.character==='тяж'?'#ef4444':'#60a5fa', fontWeight:700, fontSize:9 }}>{e.character}</span>
                        <span style={{ fontWeight:600 }}>{edit.sets}×{edit.reps}</span>
                        <span style={{ color:'#f59e0b' }}>RIR {e.rir}</span>
                        <span style={{ color:ACCENT, fontWeight:700 }}>{edit.weight} кг</span>
                        {e.workSets[0]?.tempo && <span style={{ color:'rgba(255,255,255,0.5)' }}>темп {e.workSets[0].tempo}</span>}
                        {e.workSets[0]?.restSeconds && <span style={{ color:'rgba(255,255,255,0.5)' }}>отдых {e.workSets[0].restSeconds}с</span>}
                      </div>
                      {/* Warm-up ramp for primary heavy exercises */}
                      {warmups.length > 0 && (
                        <div style={{ marginTop:3, display:'flex', gap:4, flexWrap:'wrap' }}>
                          {warmups.map((wu, wi) => (
                            <span key={wi} style={{ padding:'1px 5px', borderRadius:4, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.15)', fontSize:8, color:'rgba(255,255,255,0.5)' }}>
                              🔥 Разминка: {wu.load} кг × {wu.reps}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Phase-specific technique suggestion */}
                      <div style={{ marginTop:2, fontSize:8, color:PHASE_COLORS[currentPhase] + 'cc', fontStyle:'italic' }}>
                        {PHASE_TECHNIQUES[currentPhase][ei % PHASE_TECHNIQUES[currentPhase].length]}
                      </div>
                      {/* Exercise comment */}
                      <div style={{ marginTop:4, padding:'4px 8px', borderRadius:6, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.08)', fontSize:9, color:'rgba(255,255,255,0.7)', lineHeight:1.5 }}>
                        💡 {comment}
                      </div>
                      {/* Rotation suggestion */}
                      {rotEx.length > 0 && currentPhase === 'intensification' && (
                        <div style={{ marginTop:3, fontSize:8, color:'rgba(168,85,247,0.6)' }}>
                          🔄 Варианты замены: {rotEx.join(', ')} (ротация изоляции на границе фаз)
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Feeder sets for weak points */}
        {weakPoints.length > 0 && (() => {
          const feeders = suggestFeeders(weakPoints, []);
          if (feeders.length === 0) return null;
          return (
            <ExpandableCard title={'🔥 Feeder-сеты для слабых групп (ежедневно)'} icon="🔥" short={feeders.map(f => f.muscle).join(', ')} full={
              <div>{feeders.map((f, i) => <div key={i} style={{ padding:'6px 8px', marginBottom:4, borderRadius:6, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.12)', fontSize:10, color:'rgba(255,255,255,0.8)' }}>
                <b>{f.exercise}</b> — {f.sets}×{f.reps}, {f.notes}
              </div>)}</div>
            } />
          );
        })()}

        {/* Summary */}
        <div style={{ display:'flex', gap:12, marginTop:10 }}>
          <button style={{ ...BTN, flex:1 }} onClick={() => setStep('quality')}>Далее: отчёт качества →</button>
          <button style={BTN_GHOST} onClick={() => setBbWeekSel(1)}>На первую нед</button>
        </div>
      </div>
    );
  };

  const renderQuality = () => {
    if (!metrics || !quality || !builtPlan) return null;
    const W = builtPlan.weeks;
    const srpe = loadSRPESessions();
    const loads = srpe.length >= 2 ? toDailyLoads(srpe) : null;
    const ratio = loads ? acuteChronicRatio(loads) : null;
    return (
      <div>
        <div style={H}>📊 Шаг 5: Качество и нагрузка плана</div>
        {/* Cycle info if in cycle mode */}
        {planMode === 'bb_cycle' && selectedCycleId && (() => {
          const c = getCycleById(selectedCycleId);
          if (!c) return null;
          return (
            <div style={{ ...CARD, marginBottom:8, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#00e68a', marginBottom:4 }}>📋 ПРОФ-цикл: {c.meta.title}</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.6)' }}>
                <div>Упражнения: заданы циклом ({c.week1.reduce((s, d) => s + d.exercises.length, 0)} упр/день)</div>
                <div>Фазы: {c.meta.phases && c.meta.phases.length > 0 ? c.meta.phases.map(ph => ph.title || `нед ${ph.weekStart}-${ph.weekEnd}`).join(', ') : 'RIR-прогрессия'}</div>
                <div>{c.meta.conditions.slice(0, 2).map((cond, i) => <div key={i}>• {cond}</div>)}</div>
              </div>
            </div>
          );
        })()}
        {/* Score gauge */}
        <div style={{ ...CARD, textAlign:'center', borderLeft:'3px solid ' + (quality.score >= 85 ? '#22c55e' : quality.score >= 65 ? '#eab308' : '#ef4444') }}>
          <div style={{ fontSize:36, fontWeight:800, color:quality.score >=85?'#22c55e':quality.score >=65?'#eab308':'#ef4444' }}>{quality.score}/100</div>
          <div style={{ fontSize:13, fontWeight:700, color:quality.score >=85?'#22c55e':quality.score >=65?'#eab308':'#ef4444' }}>{quality.label}</div>
          <div style={{ marginTop:8, display:'flex', justifyContent:'center', gap:12, flexWrap:'wrap' }}>
            <div style={SMALL}>Всего сетов: <b style={{ color:'#fff' }}>{metrics.totalSets}</b></div>
            <div style={SMALL}>Тяж: <b style={{ color:'#ef4444' }}>{(metrics.тяжPct*100).toFixed(0)}%</b></div>
            <div style={SMALL}>Памп: <b style={{ color:'#60a5fa' }}>{(metrics.пампPct*100).toFixed(0)}%</b></div>
            <div style={SMALL}>RIR: <b style={{ color:'#f59e0b' }}>{metrics.avgRir.toFixed(1)}</b></div>
            <div style={SMALL}>Фаз: <b style={{ color:'#a855f7' }}>{phases.filter((p,i,a) => p.phase !== a[i-1]?.phase).length}</b></div>
          </div>
        </div>
        {/* MRV table */}
        <MetricCard title="Объём по мышцам (сетов/нед vs MEV/MAV/MRV)" icon="🏋️" accent="#a855f7">
          <div style={{ overflowX:'auto' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1.4fr 0.5fr 0.5fr 0.5fr 0.5fr', gap:2, fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', padding:'2px 0', minWidth:340 }}>
              <span>Мышца</span><span>Сетов</span><span>Тяж</span><span>Памп</span><span>MRV</span>
            </div>
            {metrics.perMuscle.map(mm => {
              const over = mm.totalSets > mm.mrv;
              return <div key={mm.muscle} style={{ display:'grid', gridTemplateColumns:'1.4fr 0.5fr 0.5fr 0.5fr 0.5fr', gap:2, fontSize:10, color:'rgba(255,255,255,0.85)', padding:'3px 0', borderTop:'1px solid rgba(255,255,255,0.04)', minWidth:340 }}>
                <span style={{ fontWeight:600 }}>{mm.muscle}{over?' ⚠':''}</span>
                <span style={{ color:over?'#ef4444':ACCENT, fontWeight:700 }}>{mm.totalSets}</span>
                <span style={{ color:'#ef4444' }}>{mm.тяжSets}</span>
                <span style={{ color:'#60a5fa' }}>{mm.пампSets}</span>
                <span style={{ color:'rgba(255,255,255,0.5)' }}>{mm.mrv}</span>
              </div>;
            })}
          </div>
        </MetricCard>
        {/* Phase distribution */}
        <div style={{ ...CARD, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.15)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>📅 Распределение фаз</div>
          {(['accumulation','intensification','deload','peaking'] as BBPhase[]).map(ph => {
            const count = phases.filter(p => p.phase === ph).length;
            if (count === 0) return null;
            const pct = (count / bbWeeks * 100).toFixed(0);
            return <div key={ph} style={{ marginBottom:4 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}>
                <span style={{ color:PHASE_COLORS[ph], fontWeight:600 }}>{PHASE_LABELS[ph]}</span>
                <span style={{ color:'rgba(255,255,255,0.5)' }}>{count} нед ({pct}%)</span>
              </div>
              <div style={{ height:4, borderRadius:2, background:'rgba(255,255,255,0.06)' }}>
                <div style={{ height:'100%', width: pct + '%', borderRadius:2, background: PHASE_COLORS[ph], opacity:0.7 }} />
              </div>
            </div>;
          })}
        </div>
        {/* 3D evolution chart */}
        <div style={{ ...CARD, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>📈 3D эволюция объёма/интенсивности/частоты</div>
          {(() => {
            const wkStats = W.map(w => {
              const ph = phaseForWeek(w.week, bbWeeks);
              const exs = w.sessions.flatMap(s => s.exercises);
              const sets = exs.reduce((s, e) => s + e.sets, 0);
              const rir = sets > 0 ? exs.reduce((s, e) => s + e.rir * e.sets, 0) / sets : 0;
              const totalWeight = exs.reduce((s, e) => s + (e.workSets[0]?.weight || 0) * e.sets, 0);
              const avgWeight = sets > 0 ? totalWeight / sets : 0;
              return { week: w.week, phase: ph, sets, rir, avgWeight };
            });
            // Aggregate into 4-week blocks for >16 weeks
            const useAgg = W.length > 16;
            const chartData = useAgg ? (() => {
              const blocks: typeof wkStats = [];
              for (let i = 0; i < wkStats.length; i += 4) {
                const chunk = wkStats.slice(i, i + 4);
                blocks.push({
                  week: chunk[0].week + '-' + chunk[chunk.length - 1].week,
                  phase: chunk[Math.floor(chunk.length / 2)].phase,
                  sets: Math.round(chunk.reduce((s, x) => s + x.sets, 0) / chunk.length),
                  rir: chunk.reduce((s, x) => s + x.rir, 0) / chunk.length,
                  avgWeight: chunk.reduce((s, x) => s + x.avgWeight, 0) / chunk.length,
                } as any);
              }
              return blocks;
            })() : wkStats;
            const maxSets = Math.max(1, ...chartData.map((x: any) => x.sets));
            const maxWt = Math.max(1, ...chartData.map((x: any) => x.avgWeight));
            const labelField = useAgg ? 'week' : 'week';
            return (
              <div>
                {useAgg && <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>Агрегировано по 4-нед блокам (средние)</div>}
                <svg width="100%" viewBox="0 0 320 90" style={{ maxWidth:360, margin:'0 auto', display:'block' }}>
                  {(chartData as any[]).map((x: any, i: number) => {
                    const px2 = 16 + (i / Math.max(1, chartData.length - 1)) * 290;
                    const barH = (x.sets / maxSets) * 36;
                    return <rect key={'b' + String(x.week)} x={px2 - 6} y={82 - barH} width={12} height={barH} rx={2} fill={PHASE_COLORS[x.phase as BBPhase]} opacity={0.5} />;
                  })}
                  {(chartData as any[]).map((x: any, i: number) => {
                    const px2 = 16 + (i / Math.max(1, chartData.length - 1)) * 290;
                    const wtPct = x.avgWeight / maxWt;
                    return <rect key={'w' + String(x.week)} x={px2 - 4} y={82 - wtPct * 36} width={8} height={wtPct * 36} rx={2} fill={PHASE_COLORS[x.phase as BBPhase]} opacity={0.9} />;
                  })}
                  <line x1={10} y1={82} x2={310} y2={82} stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
                  {(chartData as any[]).filter((x: any, i: number) => i % 2 === 0 || i === chartData.length - 1).map((x: any) => {
                    const idx = (chartData as any[]).indexOf(x);
                    const px2 = 16 + (idx / Math.max(1, chartData.length - 1)) * 290;
                    return <text key={'l' + String(x.week)} x={px2} y={95} fontSize={7} fill="rgba(255,255,255,0.3)" textAnchor="middle">{x.week}</text>;
                  })}
                </svg>
                <div style={{ display:'flex', gap:12, justifyContent:'center', marginTop:4, flexWrap:'wrap' }}>
                  <span style={{ fontSize:8, color:'rgba(255,255,255,0.5)' }}>▮ Сеты/нед</span>
                  <span style={{ fontSize:8, color:'rgba(255,255,255,0.7)' }}>▮ Средний вес</span>
                  {(['accumulation','intensification','deload','peaking'] as BBPhase[]).map(ph => {
                    const c = wkStats.filter(x => x.phase === ph).length;
                    if (c === 0) return null;
                    return <span key={ph} style={{ fontSize:7, color:PHASE_COLORS[ph] }}>● {PHASE_LABELS[ph]}</span>;
                  })}
                </div>
              </div>
            );
          })()}
        </div>
        {/* Garbage volume detection */}
        {(() => {
          const garbage = detectGarbageVolume(builtPlan.weeks, weakPoints);
          if (garbage.length === 0) return null;
          return (
            <div style={{ ...CARD, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🗑 Мусорный объём ({garbage.length})</div>
              {garbage.slice(0, 5).map((g, i) => <div key={i} style={{ fontSize:9, color:'rgba(255,255,255,0.7)', marginBottom:3, padding:'3px 6px', borderRadius:4, background:'rgba(239,68,68,0.04)' }}>
                • {g.exerciseName} ({g.muscle}): {g.reason}
              </div>)}
              {garbage.length > 5 && <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)' }}>...и ещё {garbage.length - 5}</div>}
            </div>
          );
        })()}
        {/* Exercise mix by phase */}
        {(() => {
          const mixPhase = phaseForWeek(W[0]?.week || 1, bbWeeks);
          const mix = phaseExerciseMix(mixPhase);
          return (
            <div style={{ ...CARD, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.15)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>🎯 Распределение упражнений ({PHASE_LABELS[mixPhase]})</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:10 }}>
                <div>Compounds: <b style={{ color:'#fff' }}>{(mix.compoundPct * 100).toFixed(0)}%</b></div>
                <div>Изоляция: <b style={{ color:'#fff' }}>{(mix.isolationPct * 100).toFixed(0)}%</b></div>
                <div>Машины: <b style={{ color:'#fff' }}>{(mix.machinePct * 100).toFixed(0)}%</b></div>
                <div>Кабели: <b style={{ color:'#fff' }}>{(mix.cablePct * 100).toFixed(0)}%</b></div>
              </div>
            </div>
          );
        })()}
        {/* Details */}
        <div style={{ ...CARD }}>
          <div style={{ fontSize:11, fontWeight:700, color:ACCENT, marginBottom:6 }}>🔍 Детали оценки</div>
          {quality.details.map((d,i) => <div key={i} style={{ ...SMALL, marginBottom:3, padding:'4px 8px', borderRadius:6, background:'rgba(255,255,255,0.03)' }}>{d}</div>)}
        </div>
        {/* Load assessment */}
        <div style={{ ...CARD, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>📈 Оценка тренировочной нагрузки</div>
          {!ratio ? <div style={SMALL}>Недостаточно данных sRPE для расчёта ACWR. Ведите дневник тренировок.</div> : (
            <div>
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <span style={SMALL}>ACWR: <b style={{ color:ratio.ratio>1.5?'#ef4444':ratio.ratio>1.3?'#eab308':'#22c55e', fontSize:14 }}>{ratio.ratio.toFixed(2)}</b></span>
                <span style={{ padding:'3px 8px', borderRadius:6, fontSize:9, fontWeight:700, background:ratio.zone==='dangerous'?'rgba(239,68,68,0.15)':ratio.zone==='caution'?'rgba(234,179,8,0.15)':'rgba(34,197,94,0.15)', color:ratio.zone==='dangerous'?'#ef4444':ratio.zone==='caution'?'#eab308':'#22c55e' }}>{ratio.zone === 'dangerous' ? '⛔ Опасно' : ratio.zone === 'caution' ? '⚠ Осторожно' : ratio.zone === 'optimal' ? '✅ Оптимум' : '⬇ Недотрен'}</span>
              </div>
              <div style={{ marginTop:6, ...SMALL }}>Хроническая нагрузка (28д) vs острая (7д). Цель: 0.8-1.3. Разгрузка при {`>`}1.5.</div>
            </div>
          )}
        </div>
        <MesocycleProgressionCard weeks={W.length} startVolumeSets={Math.round(W.reduce((s,w)=>s+w.sessions.reduce((ss,sess)=>ss+sess.exercises.reduce((sss,e)=>sss+e.sets,0),0),0)/W.length)} startIntensityPct={0.7} startRIR={2} goal="hypertrophy" title="Прогрессия мезоцикла (ББ)" />
        <div style={{ ...CARD, marginTop:8, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
          <div style={{ ...SMALL, whiteSpace:'pre-wrap' }}>{explainBBMetrics(metrics)}</div>
        </div>
        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          <button style={{ ...BTN, flex:1 }} onClick={() => setStep('adjust')}>Далее: ручная коррекция →</button>
          <button style={BTN_GHOST} onClick={() => setStep('plan')}>← Назад</button>
        </div>
      </div>
    );
  };

  const renderAdjust = () => {
    if (!builtPlan || !metrics) return null;
    const W = builtPlan.weeks;
    const wk = W[Math.min(bbWeekSel, W.length) - 1] || W[0];
    const currentPhase = phaseForWeek(wk.week, bbWeeks);
    return (
      <div>
        <div style={H}>🛠 Шаг 6: Ручная коррекция</div>
        <div style={{ ...CARD, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)', marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>🔧 Инструменты коррекции</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <button style={BTN_GHOST} onClick={() => adjustVolume(0.8)}>📦 Объём -20%</button>
            <button style={BTN_GHOST} onClick={() => adjustVolume(1.1)}>📦 Объём +10%</button>
            <button style={BTN_GHOST} onClick={() => adjustWeight(1.05)}>⚖ Вес +5%</button>
            <button style={BTN_GHOST} onClick={() => adjustWeight(0.95)}>⚖ Вес -5%</button>
            <button style={BTN_GHOST} onClick={() => { setExerciseEdits({}); setStep('split'); }}>🔄 Перестроить план</button>
            <button style={BTN_GHOST} onClick={handleSavePlan}>💾 Сохранить план</button>
            <button style={{ ...BTN_GHOST, borderColor:'#a855f7', color:'#a855f7' }} onClick={handleSendToExecution}>▶ К выполнению</button>
          </div>
        </div>
        {/* Per-exercise editing zone */}
        <div style={{ marginTop:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Редактор упражнений (неделя {bbWeekSel})</span>
            <div style={{ display:'flex', gap:4 }}>
              {W.map(w => {
                const ph = phaseForWeek(w.week, bbWeeks);
                return <button key={w.week} onClick={() => setBbWeekSel(w.week)} style={{ padding:'3px 8px', borderRadius:6, fontSize:9, cursor:'pointer', border:w.week===bbWeekSel?'1px solid ' + PHASE_COLORS[ph]:'1px solid rgba(255,255,255,0.08)', background:w.week===bbWeekSel?PHASE_COLORS[ph]+'20':'transparent', color:w.week===bbWeekSel?PHASE_COLORS[ph]:'rgba(255,255,255,0.6)' }}>{w.week}</button>;
              })}
            </div>
          </div>
          {wk.sessions.map((s, si) => (
            <ExpandableCard key={si} title={'День ' + (si+1) + ' · ' + s.character + ' (' + s.exercises.length + ' упр.)'} icon="🏋️" short={s.exercises.map(e => e.name).join(', ')} full={
              <div>
                {s.exercises.map((e, ei) => {
                  const editKey = `${si}-${ei}`;
                  const edit = exerciseEdits[editKey] || { sets: e.sets, reps: e.workSets[0]?.reps || 10, weight: e.workSets[0]?.weight || 80 };
                  const catEx = EXERCISE_CATALOG.find(x => x.name === e.name);
                  const altExercises = getExercisesByGroup(e.muscle).filter(x => x.name !== e.name).slice(0, 5);
                  return <div key={ei} style={{ marginBottom:8, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontWeight:700, fontSize:11, color:'#fff', marginBottom:4 }}>{ei+1}. {e.name} <span style={{ fontWeight:400, fontSize:9, color:'rgba(255,255,255,0.4)' }}>({e.muscle})</span></div>
                    <div style={{ display:'flex', gap:8, marginBottom:6, flexWrap:'wrap', alignItems:'center' }}>
                      <div><span style={{ ...SMALL, fontSize:9 }}>Сеты</span><input type="number" value={edit.sets} min={0} max={20} onChange={e2 => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, sets: parseInt(e2.target.value) || 0 } }))} style={{ width:45, background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, padding:'4px 8px', fontSize:11 }} /></div>
                      <div><span style={{ ...SMALL, fontSize:9 }}>Повт</span><input type="number" value={edit.reps} min={1} max={30} onChange={e2 => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, reps: parseInt(e2.target.value) || 1 } }))} style={{ width:45, ...IN }} /></div>
                      <div><span style={{ ...SMALL, fontSize:9 }}>Вес, кг</span><input type="number" value={edit.weight} min={0} max={500} onChange={e2 => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, weight: parseInt(e2.target.value) || 0 } }))} style={{ width:55, ...IN }} /></div>
                      <div><span style={{ ...SMALL, fontSize:9 }}>RIR</span><span style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginLeft:4 }}>{e.rir}</span></div>
                      <button onClick={() => setExSwapModal({ si, ei, muscle: e.muscle, currentName: e.name })} style={{ padding:'3px 8px', borderRadius:6, fontSize:9, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.03)', color:'rgba(255,255,255,0.7)' }}>🔄 Заменить</button>
                    </div>
                    {altExercises.length > 0 && <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)' }}>Альтернативы: {altExercises.map(x => x.name).join(', ')}</div>}
                    <div style={{ marginTop:4, padding:'3px 6px', borderRadius:4, background:'rgba(0,230,138,0.04)', fontSize:9, color:'rgba(255,255,255,0.6)' }}>💡 {exerciseComment(e, weakPoints, bbFocus, currentPhase)}</div>
                  </div>;
                })}
              </div>
            } />
          ))}
        </div>
      </div>
    );
  };

  // ── Exercise swap modal ──
  const renderExSwapModal = () => {
    if (!exSwapModal || !builtPlan) return null;
    const filtered = EXERCISE_CATALOG
      .filter(e => (e.group || '') === exSwapModal.muscle)
      .filter(e => e.name.toLowerCase().includes(exSwapSearch.toLowerCase()));
    return (
      <div style={{ position:'fixed', inset:0, zIndex:250, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.85)' }}
        onClick={() => { setExSwapModal(null); setExSwapSearch(''); }}>
        <div onClick={e => e.stopPropagation()} style={{ width:'88%', maxWidth:400, maxHeight:'78vh', borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden' }}>
          <div style={{ height:3, background:'linear-gradient(90deg,#00e68a,#00c853)' }} />
          <div style={{ padding:'14px 16px', maxHeight:'calc(78vh - 3px)', overflowY:'auto' }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#00e68a', marginBottom:10 }}>🔄 Замена: {exSwapModal.currentName}</div>
            <input type="text" placeholder="Поиск упражнений..." value={exSwapSearch} autoFocus
              onChange={e => setExSwapSearch(e.target.value)}
              style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(0,0,0,0.3)', color:'#fff', fontSize:13, boxSizing:'border-box', marginBottom:10 }} />
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {filtered.slice(0, 30).map(ex => {
                const isCurrent = ex.name === exSwapModal.currentName;
                return <button key={ex.id} disabled={isCurrent} onClick={() => { handleReplaceExercise(exSwapModal.si, exSwapModal.ei, ex.name); setExSwapModal(null); setExSwapSearch(''); }}
                  style={{ display:'block', width:'100%', padding:'8px 10px', borderRadius:8, cursor:isCurrent?'default':'pointer', textAlign:'left', fontSize:11, fontWeight:isCurrent?400:500, background:isCurrent?'rgba(255,255,255,0.02)':'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:isCurrent?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.85)', opacity:isCurrent?0.5:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span>{ex.name}</span>
                    <span style={{ fontSize:9, color:'rgba(255,255,255,0.35)' }}>{ex.type} · {ex.equipment}</span>
                  </div>
                  {isCurrent && <div style={{ fontSize:9, color:'#00e68a', marginTop:2 }}>✓ текущее</div>}
                </button>;
              })}
              {filtered.length === 0 && <div style={{ padding:12, textAlign:'center', fontSize:10, color:'rgba(255,255,255,0.4)' }}>Ничего не найдено</div>}
            </div>
            <button onClick={() => { setExSwapModal(null); setExSwapSearch(''); }} style={{ width:'100%', marginTop:10, padding:'10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(255,255,255,0.6)', fontWeight:700, fontSize:12, cursor:'pointer' }}>Закрыть</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {renderStepNav()}
      {step === 'params' && renderParams()}
      {step === 'ped' && renderPedWorkMax()}
      {step === 'split' && renderSplit()}
      {step === 'plan' && renderPlanWithComments()}
      {step === 'quality' && renderQuality()}
      {step === 'adjust' && renderAdjust()}
      {renderExSwapModal()}
    </div>
  );
};
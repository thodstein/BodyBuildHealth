import React, { useRef, useState, useCallback, Fragment, useMemo } from 'react';
import { EXERCISE_CATALOG, getSubstitutes, canReplace, getExerciseById } from '../../../../core/exercise-catalog';
import { calcExercisePrescription } from '../../../../engines/training.engine';
import { SubstitutionPopup } from '../SubstitutionPopup';
import { getVolumeLandmarks, computeVolumeLandmarks, type VolumeLandmarkRow } from '../../../../engines/volume-landmarks.engine';
import { labTrainingAdjust } from '../lab-training-adjust';
import { tempoFor } from '../../../../engines/bb/bb-tempo-rest';
import { PCT_FOR_RIR, GROUP_RU, ACCENT, DIM, SET_TEMPLATES, type ManualResult, type ManualWeek } from './types';
import type { TrainingProfile } from '../training-profile';
import { PHASE_LABELS, type BBPhase } from './phase-periodization';
import { getPlanFeedback } from '../../../../engines/plan-execution-feedback.engine';
import { validatePlan, weeklySetsFromManualResult } from '../../../../engines/plan-validator';
import { VolumeByWeekChart, RirDriftChart, type WeekVolume, type RirRecord } from '../PlanCharts';
import { calcBBPlanMetrics, explainBBMetrics } from '../../../../engines/bb/bb-metrics.engine';
import type { BBPlan } from '../../../../engines/bb/bb-builder.engine';
import { acuteChronicRatio, toDailyLoads } from '../../../../engines/pro/training-load.engine';
import { loadSRPESessions } from '../../../../engines/pro/srpe-store';
import { validatePlanQuality, manualToQualityInput } from '../../../../engines/plan-quality.engine';
import { PlanExportCard } from '../PlanExportCard';

interface Props {
  result: ManualResult | null;
  manualWorkMax: Record<string, number>;
  tprofile: TrainingProfile;
  goal: string;
  level: string;
  mesoLength: number;
  daysPerWeek: number;
  setResult: (r: ManualResult | null) => void;
  onToRuntime: () => void;
  globalTempoStr?: string;
  mrvOverride?: number | null;
  labAnalysis?: any;
}

const PHASE_COLORS: Record<string, string> = {
  accumulation: '#22c55e',
  intensification: '#f59e0b',
  deload: '#60a5fa',
  peaking: '#ef4444',
};

// Синхронизация правок дней с текущей неделей мезоцикла (иначе изменения
// теряются при переключении недель — goToWeek перезаписывает result.days из weeks[]).
function syncCurrentWeek(r: ManualResult, days: ManualResult['days']): ManualWeek[] | undefined {
  if (!r.weeks?.length) return r.weeks;
  const cw = r.currentWeek || 1;
  return r.weeks.map(w => w.weekNumber === cw ? { ...w, days } : w);
}

function fmtWt(e: { weight: number; weightNote?: string }): string {
  if ((e as any).weightNote) return (e as any).weightNote as string;
  if (e.weight > 0) return `${e.weight} кг`;
  return '—';
}

function getExerciseNote(ex: { name: string; role?: string; rir: number; sets: number; reps: string; tempo?: string; group: string; weight: number }, idx: number, dayExs: any[], weeklySetsMap: Record<string, number>, corrections: string[]): string {
  const notes: string[] = [];
  if (idx === 0) notes.push('Первое упражнение дня — задаёт тон всей тренировке.');
  if (ex.role === 'main') {
    notes.push('Базовое движение. Прогрессируй вес/повторения каждую неделю (2.5-5 кг для верха, 5-10 кг для низа).');
    if (ex.rir <= 1) notes.push('Работа вблизи отказа. Страховка обязательна на последних 1-2 повторениях.');
  }
  if (ex.role === 'accessory') {
    notes.push('Изоляция. Mind-muscle connection и полная амплитуда важнее веса.');
  }
  if (ex.tempo) {
    const pts = ex.tempo.split('-').map(Number);
    if (pts.length === 4) {
      if (pts[0] >= 3) notes.push('Медленная эксцентрика ' + pts[0] + 'с — ключ к микротравмам.');
      if (pts[1] >= 2) notes.push('Пауза ' + pts[1] + 'с в растянутой позиции стимулирует саркомерогенез.');
    }
  }
  const ws = weeklySetsMap[ex.group] || 0;
  if (ws > 18) notes.push('⚠ Высокий недельный объём (' + ws + ' сетов).');
  if (ws < 8) notes.push('Низкий недельный объём (' + ws + ' сетов).');
  const catEntry = EXERCISE_CATALOG.find(c => c.name === ex.name);
  const caveats = (catEntry as any)?.caveats as string[] | undefined;
  if (caveats?.length) notes.push('Техника: ' + caveats[0]);
  if (ex.weight > 0 && ex.reps && parseInt(ex.reps) > 0) {
    const est1RM = Math.round(ex.weight / (0.95 - ex.rir * 0.03));
    if (est1RM > 0) notes.push('Расчётный 1ПМ: ~' + est1RM + ' кг');
  }
  return notes.join(' | ');
}

function ExStat({ label, value, onClick, color }: { label: string; value: React.ReactNode; onClick?: () => void; color?: string }) {
  return (
    <div style={{ padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{label}</span>
      <span onClick={onClick} style={{ fontSize: 11, fontWeight: 700, color: color || 'rgba(255,255,255,0.85)', cursor: onClick ? 'text' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

export function calcQualityScore(
  days: any[],
  weeklySets: Record<string, number>,
  level: string,
  goal: string,
  opts?: { mrvOverride?: number | null; onCourse?: boolean; courseIntensity?: 'none' | 'mild' | 'moderate' | 'heavy'; labMult?: number }
): {
  score: number; color: string;
  breakdown: { label: string; ok: boolean; detail: string }[];
  recommendations: string[];
  perMuscle: { muscle: string; sets: number; mev: number; mav: number; mrv: number; status: string; pct: number }[];
} {
  const levelBaseMrv = { beginner: 15, intermediate: 20, advanced: 24, enhanced: 28 }[level] ?? 20;
  const mrvScale = opts?.mrvOverride != null && levelBaseMrv > 0 ? opts.mrvOverride / levelBaseMrv : 1;
  const breakdown: { label: string; ok: boolean; detail: string }[] = [];
  const recommendations: string[] = [];
  const perMuscle: { muscle: string; sets: number; mev: number; mav: number; mrv: number; status: 'недотрен' | 'оптимум' | 'перегруз'; pct: number }[] = [];
  let score = 100;

  // Per-muscle analysis using composed volume landmarks (consistency with generation + mrvOverride)
  for (const [g, sets] of Object.entries(weeklySets)) {
    const lm = getVolumeLandmarks(level, g);
    if (!lm) continue;
    let mrv = Math.round(lm.mrv * mrvScale);
    let mev = Math.round(lm.mev * mrvScale);
    let mav = Math.round(lm.mav * mrvScale);
    if (opts?.onCourse) {
      const courseMult = opts.courseIntensity === 'heavy' ? 1.3 : opts.courseIntensity === 'moderate' ? 1.2 : 1.15;
      mrv = Math.round(mrv * courseMult); mev = Math.round(mev * courseMult); mav = Math.round(mav * courseMult);
    }
    if (opts?.labMult) { mrv = Math.round(mrv * opts.labMult); mev = Math.round(mev * opts.labMult); mav = Math.round(mav * opts.labMult); }
    let status: 'недотрен' | 'оптимум' | 'перегруз' = 'оптимум';
    const pct = mrv > 0 ? (sets / mrv) * 100 : 0;
    if (sets < mev) { status = 'недотрен'; score -= 8; }
    else if (sets > mrv) { status = 'перегруз'; score -= 6; }
    perMuscle.push({ muscle: g, sets, mev, mav, mrv, status, pct: Math.round(pct) });
  }

  // Build detailed breakdown from perMuscle
  for (const pm of perMuscle) {
    if (pm.status === 'недотрен') {
      breakdown.push({ label: 'Недотрен ' + pm.muscle, ok: false, detail: pm.muscle + ': ' + pm.sets + ' сетов < MEV=' + pm.mev + '. Добавьте ' + (pm.mev - pm.sets) + ' сетов. ' });
      recommendations.push('➕ ' + pm.muscle + ': +' + (pm.mev - pm.sets) + ' сетов/нед (MEV=' + pm.mev + ')');
    } else if (pm.status === 'перегруз') {
      breakdown.push({ label: 'Перегруз ' + pm.muscle, ok: false, detail: pm.muscle + ': ' + pm.sets + ' сетов > MRV=' + pm.mrv + '. Убавьте ' + (pm.sets - pm.mrv) + ' сетов.' });
      recommendations.push('➖ ' + pm.muscle + ': −' + (pm.sets - pm.mrv) + ' сетов/нед (MRV=' + pm.mrv + ')');
    } else {
      breakdown.push({ label: pm.muscle, ok: true, detail: pm.muscle + ': ' + pm.sets + ' сетов (MEV=' + pm.mev + '–MRV=' + pm.mrv + ') — в зоне' });
    }
  }

  const groupsPresent = perMuscle.length;
  if (groupsPresent < 4) { score -= 10; breakdown.push({ label: 'Охват групп', ok: false, detail: groupsPresent + ' групп (мин. 4)' }); }
  else { breakdown.push({ label: 'Охват групп', ok: true, detail: groupsPresent + ' групп' }); }

  const totalEx = days.reduce((s: number, d: any) => s + d.exercises.length, 0);
  const avgEx = Math.round(totalEx / Math.max(1, days.length));
  if (avgEx < 3) { score -= 15; breakdown.push({ label: 'Плотность', ok: false, detail: avgEx + ' упр/день — слишком мало' }); }
  else if (avgEx > 14) { score -= 5; breakdown.push({ label: 'Плотность', ok: false, detail: avgEx + ' упр/день — слишком много' }); }
  else { breakdown.push({ label: 'Плотность', ok: true, detail: avgEx + ' упр/день — оптимально' }); }

  const hasMain = days.some((d: any) => d.exercises.some((e: any) => e.role === 'main'));
  if (!hasMain) { score -= 20; breakdown.push({ label: 'Базовые', ok: false, detail: 'Нет базовых упражнений' }); }
  else { breakdown.push({ label: 'Базовые', ok: true, detail: 'Есть compound-упражнения' }); }

  // Balance: detect если какая-то группа сильно отстаёт по % от MRV
  if (perMuscle.length >= 2) {
    const pcts = perMuscle.filter(p => p.mrv > 0).map(p => p.pct);
    const maxPct = Math.max(...pcts);
    const minPct = Math.min(...pcts);
    if (maxPct - minPct > 40) {
      score -= 5;
      const minGroup = perMuscle.find(p => p.pct === minPct);
      const maxGroup = perMuscle.find(p => p.pct === maxPct);
      if (minGroup && maxGroup) {
        breakdown.push({ label: 'Дисбаланс', ok: false, detail: minGroup.muscle + ' (' + minGroup.pct + '%) vs ' + maxGroup.muscle + ' (' + maxGroup.pct + '%) — разрыв >40%' });
        recommendations.push('⚖ ' + minGroup.muscle + ' отстаёт от ' + maxGroup.muscle + '. Увеличьте объём для ' + minGroup.muscle + '.');
      }
    } else {
      breakdown.push({ label: 'Баланс', ok: true, detail: 'Разрыв между группами ≤40% — сбалансировано' });
    }
  }

  score = Math.max(0, Math.min(100, score));
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  return { score, color, breakdown, recommendations, perMuscle };
}

function calcLoadAnalysis(days: any[]): { monotony: number; avgDaily: number; totalWeekly: number; dailyLoads: number[]; strain: number } {
  const dailyLoads = days.map((d: any) => d.exercises.reduce((s: number, e: any) => s + e.sets * e.weight, 0));
  const totalWeekly = dailyLoads.reduce((s: number, v: number) => s + v, 0);
  const avg = dailyLoads.length ? totalWeekly / dailyLoads.length : 0;
  const variance = dailyLoads.length ? dailyLoads.reduce((s: number, v: number) => s + (v - avg) ** 2, 0) / dailyLoads.length : 0;
  const std = Math.sqrt(variance);
  const monotony = avg > 0 ? std / avg : 0;
  const strain = monotony * totalWeekly;
  return { monotony, avgDaily: avg, totalWeekly, dailyLoads, strain };
}

function getWarmup(exercises: any[], goal: string): { general: string[]; specific: { ex: string; sets: string }[] } {
  const general: string[] = [];
  if (goal === 'strength' || goal === 'powerlifting') {
    general.push('5-10 мин кардио (вело/гребля) — повышение ЧСС');
    general.push('Динамическая растяжка: круговые тазом, махи ногами, вращения плечами');
    general.push('Активация: ягодичный мостик 2×15, планка 2×30с');
  } else {
    general.push('5-7 мин лёгкое кардио — разогрев');
    general.push('Динамическая растяжка: вращения рук/ног, наклоны, выпады без веса');
    general.push('Активация целевых мышц: лёгкие подходы [50%]');
  }
  const firstCompound = exercises.find((e: any) => e.role === 'main' || e.rest >= 150);
  const specific: { ex: string; sets: string }[] = [];
  if (firstCompound) {
    specific.push({ ex: firstCompound.name, sets: '1×5 @40%' });
    specific.push({ ex: firstCompound.name, sets: '1×3 @60%' });
    if (goal === 'strength' || goal === 'powerlifting') { specific.push({ ex: firstCompound.name, sets: '1×1 @75%' }); }
  }
  const isolationCount = exercises.filter((e: any) => e.role !== 'main' && e.rest < 150).length;
  if (isolationCount > 0) { specific.push({ ex: 'Изоляционные движения', sets: '1×10 @50% (разминочный подход)' }); }
  return { general, specific };
}

export const PlanDisplay: React.FC<Props> = ({
  result, manualWorkMax, tprofile, goal, level, mesoLength, daysPerWeek,
  setResult, onToRuntime, globalTempoStr, mrvOverride, labAnalysis,
}) => {
  const [subTarget, setSubTarget] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{ dayIdx: number; exIdx: number; field: string; value: string } | null>(null);
  const [dragFrom, setDragFrom] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const [showMacroPreview, setShowMacroPreview] = useState(false);
  const [exerciseTempos, setExerciseTempos] = useState<Record<string, string>>({});
  const [tempoPicker, setTempoPicker] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const [expandedEx, setExpandedEx] = useState<Set<string>>(new Set());
  const inlineRef = useRef<HTMLInputElement | null>(null);

  const startInline = useCallback((di: number, ei: number, field: string, val: string | number) => {
    setInlineEdit({ dayIdx: di, exIdx: ei, field, value: String(val) });
    setTimeout(() => inlineRef.current?.focus(), 10);
  }, []);

  const commitInline = useCallback(() => {
    if (!inlineEdit || !result) { setInlineEdit(null); return; }
    const { dayIdx, exIdx, field, value } = inlineEdit;
    const old = result.days[dayIdx]?.exercises[exIdx];
    if (!old) { setInlineEdit(null); return; }
    const days = result.days.map((d, di) => di === dayIdx ? { ...d, exercises: d.exercises.map((ex, ei) => {
      if (ei !== exIdx) return ex;
      const ne = { ...ex };
      if (field === 'sets') ne.sets = parseInt(value) || ex.sets;
      else if (field === 'reps') ne.reps = value;
      else if (field === 'rir') { const v = parseInt(value); if (!isNaN(v)) ne.rir = v; }
      else if (field === 'weight') { const v = parseInt(value); if (!isNaN(v)) ne.weight = v; }
      else if (field === 'rest') { const v = parseInt(value); if (!isNaN(v)) ne.rest = v; }
      else if (field === 'loadMode') ne.loadMode = value as 'weight' | 'velocity';
      else if (field === 'targetVelocity') { const v = parseFloat(value); if (!isNaN(v)) ne.targetVelocity = v; }
      return ne;
    }) } : d);
    setResult({ ...result, days, weeks: syncCurrentWeek(result, days), corrections: [...result.corrections, '✏️ ' + old.name + ': ' + field + '=' + value] });
    setInlineEdit(null);
  }, [inlineEdit, result, setResult]);

  const openSubstitute = useCallback((di: number, ei: number) => {
    if (!result) return;
    const e = result.days[di]?.exercises[ei]; if (!e) return;
    setSubTarget({ dayIdx: di, exIdx: ei });
  }, [result]);

  const applySubstitute = useCallback((newId: string) => {
    if (!subTarget || !result) return;
    const rep = getExerciseById(newId); if (!rep) { setSubTarget(null); return; }
    const { dayIdx, exIdx } = subTarget;
    const old = result.days[dayIdx].exercises[exIdx];
    const wm = (tprofile.workMax[rep.group] || manualWorkMax[rep.group] || 80);
    const pct = PCT_FOR_RIR[Math.max(0, Math.min(5, old.rir))] ?? 0.9;
    const weight = Math.round(wm * pct);
    const days = result.days.map((d, di) => di === dayIdx ? { ...d, exercises: d.exercises.map((ex, ei) => ei === exIdx ? { ...ex, name: rep.name, group: rep.group, weight } : ex) } : d);
    setResult({ ...result, days, weeks: syncCurrentWeek(result, days), corrections: [...result.corrections, '🔄 Замена: "' + old.name + '" → "' + rep.name + '". Вес ' + weight + ' кг.'] });
    setSubTarget(null);
  }, [subTarget, result, tprofile, manualWorkMax, setResult]);

  const handleDragStart = useCallback((e: React.DragEvent, di: number, ei: number) => {
    setDragFrom({ dayIdx: di, exIdx: ei }); e.dataTransfer.effectAllowed = 'move';
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);
  const handleDrop = useCallback((e: React.DragEvent, tDay: number, tEx: number) => {
    e.preventDefault(); if (!dragFrom || !result) return;
    const { dayIdx: fDay, exIdx: fEx } = dragFrom;
    if (fDay === tDay && fEx === tEx) { setDragFrom(null); return; }
    const days = result.days.map(d => ({ ...d, exercises: [...d.exercises.map(ee => ({ ...ee }))] }));
    const moved = days[fDay].exercises.splice(fEx, 1)[0]; if (!moved) { setDragFrom(null); return; }
    const insertAt = fDay === tDay && tEx > fEx ? tEx - 1 : tEx;
    days[tDay].exercises.splice(insertAt, 0, moved);
    setResult({ ...result, days, weeks: syncCurrentWeek(result, days), corrections: [...result.corrections, '↕️ "' + moved.name + '" — День ' + days[fDay].day + ' → День ' + days[tDay].day + '.'] });
    setDragFrom(null);
  }, [dragFrom, result, setResult]);

  const copyDay = useCallback((di: number) => {
    if (!result) return;
    const src = result.days[di]; const newNum = Math.max(...result.days.map(d => d.day)) + 1;
    const days = [...result.days, { ...src, day: newNum, exercises: src.exercises.map(e => ({ ...e })) }];
    setResult({ ...result, days, weeks: syncCurrentWeek(result, days), corrections: [...result.corrections, '📋 День ' + src.day + ' скопирован → День ' + newNum + '.'] });
  }, [result, setResult]);

  const massEditWeight = useCallback((pct: number) => {
    if (!result) return;
    const sgn = pct > 0 ? '+' : '';
    const days = result.days.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e, weight: Math.round(e.weight * (1 + pct / 100)) })) }));
    setResult({ ...result, days, weeks: syncCurrentWeek(result, days), corrections: [...result.corrections, '⚡ Масс-правка: веса ' + sgn + pct + '%.'] });
  }, [result, setResult]);

  const massEditVolume = useCallback((pct: number) => {
    if (!result) return;
    const sgn = pct > 0 ? '+' : '';
    const days = result.days.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e, sets: Math.max(1, Math.round(e.sets * (1 + pct / 100))) })) }));
    setResult({ ...result, days, weeks: syncCurrentWeek(result, days), corrections: [...result.corrections, '⚡ Масс-правка: объём ' + sgn + pct + '%.'] });
  }, [result, setResult]);

  const applySetTemplate = useCallback((di: number, ei: number, key: string) => {
    if (!result) return;
    const t = SET_TEMPLATES[key]; if (!t) return;
    const e = result.days[di].exercises[ei];
    const pct = PCT_FOR_RIR[Math.max(0, Math.min(5, t.rir))] ?? 0.9;
    const wm = tprofile.workMax[e.group] || manualWorkMax[e.group] || 80;
    const days = result.days.map((d, di2) => di2 === di ? { ...d, exercises: d.exercises.map((ex, ei2) => ei2 === ei ? { ...ex, sets: t.sets, reps: t.reps, rir: t.rir, rest: t.rest, weight: Math.round(wm * pct) } : ex) } : d);
    setResult({ ...result, days, weeks: syncCurrentWeek(result, days), corrections: [...result.corrections, '⚡ Шаблон "' + key + '" → "' + e.name + '": ' + t.sets + '×' + t.reps + ', RIR ' + t.rir + '.'] });
  }, [result, tprofile, manualWorkMax, setResult]);

  /* ─── Переключение недель (фазовая периодизация) ─── */
  const goToWeek = useCallback((weekNum: number) => {
    if (!result || !result.weeks) return;
    const week = result.weeks.find(w => w.weekNumber === weekNum);
    if (!week) return;
    const switchNote = '📅 Неделя ' + weekNum + ' (' + week.phaseLabel + ', RIR ' + week.rir + (week.totalTonnage ? ', ~' + (week.totalTonnage / 1000).toFixed(1) + ' т' : '') + ')';
    setResult({
      ...result,
      currentWeek: weekNum,
      days: week.days,
      corrections: [...result.corrections, switchNote, ...(week.corrections?.length ? [''] : []), ...(week.corrections || [])],
    });
  }, [result, setResult]);

  if (!result) return null;

  const weeklySetsMap: Record<string, number> = {};
  result.days.forEach(d => d.exercises.forEach(e => { weeklySetsMap[e.group] = (weeklySetsMap[e.group] || 0) + e.sets; }));
  const labMult = labAnalysis ? labTrainingAdjust(labAnalysis).mrvMultiplier : 1;
  const volumeRows: VolumeLandmarkRow[] = weeklySetsMap && Object.keys(weeklySetsMap).length
    ? computeVolumeLandmarks(weeklySetsMap, level, { labMult })
    : [];
  const quality = calcQualityScore(result.days, weeklySetsMap, level, goal, {
    mrvOverride,
    onCourse: tprofile.onCourse,
    courseIntensity: tprofile.courseIntensity,
    labMult: labAnalysis ? labTrainingAdjust(labAnalysis).mrvMultiplier : 1,
  });
  const load = calcLoadAnalysis(result.days);

  const hasWeeks = !!result.weeks?.length;
  const currentWeekNum = result.currentWeek || 1;
  const currentWeekMeta = result.weeks?.find(w => w.weekNumber === currentWeekNum);

  return (
    <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>📋 {result.splitName}</div>
        <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: 'rgba(0,230,138,0.12)', padding: '3px 8px', borderRadius: 8 }}>
          {result.days.length} дн/нед · {result.mesoLength || mesoLength} нед
        </span>
      </div>

      {/* ═══ ОБЪЁМ vs MRV (volume-landmarks, единый источник) ═══ */}
      {volumeRows.length > 0 && (
        <div style={{ marginTop: 8, padding: 8, borderRadius: 10, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.18)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>
            📊 Объём vs MRV {labMult !== 1 && <span style={{ opacity: 0.7, fontWeight: 600 }}>(MRV×{labMult.toFixed(2)})</span>}
          </div>
          {volumeRows.map(r => {
            const lColor = r.status === 'exceeding_mrv' ? '#ef4444' : r.status === 'approaching_mrv' ? '#f59e0b' : r.status === 'optimal' ? '#22c55e' : '#60a5fa';
            const barMax = Math.max(r.mrv, r.sets, 1);
            return (
              <div key={r.group} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                  <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>{r.label}</span>
                  <span style={{ color: lColor, fontWeight: 800 }}>{r.sets} подх <span style={{ opacity: 0.6, fontWeight: 600 }}>/ MRV {r.mrv}</span></span>
                </div>
                <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: (r.sets / barMax * 100) + '%', background: lColor, borderRadius: 4 }} />
                  <div style={{ position: 'absolute', left: (r.mav / barMax * 100) + '%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.5)' }} />
                  <div style={{ position: 'absolute', left: (r.mrv / barMax * 100) + '%', top: 0, bottom: 0, width: 2, background: '#ef4444' }} />
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>Белая линия — MAV · красная — MRV. Превышение MRV → риск перетренированности.</div>
        </div>
      )}

      {/* ═══ ФАЗОВАЯ ШКАЛА (все недели) ═══ */}
      {hasWeeks && (() => {
        const wks = result.weeks!;
        return (
        <div style={{ marginTop: 8, padding: 8, borderRadius: 10, background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>📅 Фазы мезоцикла</span>
            {currentWeekMeta && (
              <span style={{ fontSize: 9, opacity: 0.7 }}>
                Нед {currentWeekNum}: {currentWeekMeta.phaseLabel} · RIR {currentWeekMeta.rir}
              </span>
            )}
          </div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
            <div style={{ display: 'flex', gap: 3, minWidth: 'max-content' }}>
              {wks.map(w => {
                const isActive = w.weekNumber === currentWeekNum;
                const phaseColor = PHASE_COLORS[w.phase] || '#a855f7';
                const isDeload = w.phase === 'deload';
                return (
                  <button key={w.weekNumber} onClick={() => goToWeek(w.weekNumber)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      padding: '5px 8px', borderRadius: 8, cursor: 'pointer', minWidth: 44,
                      border: isActive ? '2px solid ' + phaseColor : '1px solid ' + phaseColor + '40',
                      background: isActive ? phaseColor + '18' : phaseColor + '08',
                      transition: 'all 0.15s',
                    }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: isActive ? '#fff' : phaseColor }}>
                      {isDeload ? '🔄' : w.weekNumber}
                    </span>
                    <span style={{ fontSize: 6, fontWeight: 600, color: isActive ? phaseColor : phaseColor + 'aa', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                      {w.phaseLabel}
                    </span>
                    <div style={{
                      width: 16, height: 3, borderRadius: 2,
                      background: phaseColor,
                      opacity: isActive ? 1 : 0.5,
                    }} />
                  </button>
                );
              })}
            </div>
          </div>
          {/* Навигация ◀ ▶ */}
          <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'center' }}>
            <button onClick={() => { const p = wks.findIndex(w => w.weekNumber === currentWeekNum); if (p > 0) goToWeek(wks[p - 1].weekNumber); }}
              disabled={wks[0]?.weekNumber === currentWeekNum}
              style={{ padding: '3px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>◀</button>
            <span style={{ fontSize: 9, color: DIM, padding: '3px 8px', alignSelf: 'center' }}>
              Нед {currentWeekNum} / {result.mesoLength || mesoLength}
            </span>
            <button onClick={() => { const p = wks.findIndex(w => w.weekNumber === currentWeekNum); if (p < wks.length - 1) goToWeek(wks[p + 1].weekNumber); }}
              disabled={wks[wks.length - 1]?.weekNumber === currentWeekNum}
              style={{ padding: '3px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>▶</button>
          </div>
        </div>
        );
      })()}

      {result.corrections?.length > 0 && (
        <div style={{ marginTop: 6, padding: 10, borderRadius: 10, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', marginBottom: 6 }}>📝 Комментарии к плану</div>
          {result.corrections.map((c, i) => (
            <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 3, paddingLeft: 4, borderLeft: '2px solid rgba(59,130,246,0.4)' }}>{c}</div>
          ))}
        </div>
      )}

      {(() => {
        const fb = getPlanFeedback();
        return fb.avgRpe > 0 ? (
          <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', marginBottom: 6 }}>📊 Фидбэк план→выполнение</div>
            {fb.deloadRecommended && <div style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 9, fontWeight: 700, marginBottom: 6 }}>⛔ РЕКОМЕНДОВАНА РАЗГРУЗКА</div>}
            {fb.reasons.map((r, i) => <div key={i} style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginBottom: 2, paddingLeft: 4 }}>{r}</div>)}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {fb.weightMultiplier !== 1 && <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }}>Вес x{fb.weightMultiplier}</span>}
              {fb.rirShift !== 0 && <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>RIR {fb.rirShift > 0 ? '+' : ''}{fb.rirShift}</span>}
              {fb.volumeMultiplier !== 1 && <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>Объём x{fb.volumeMultiplier}</span>}
            </div>
          </div>
        ) : null;
      })()}

      {result && (() => {
        const ws = weeklySetsFromManualResult(result);
        const banners = validatePlan({ weeklySets: ws, level, goal, daysPerWeek, weakPoints: tprofile.weakPoints || [], readiness: tprofile.recovery });
        if (banners.length === 0) return null;
        return (
          <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#f87171', marginBottom: 6 }}>🛡 Валидация плана</div>
            {banners.map((b, i) => (
              <div key={i} style={{ fontSize: 9, color: b.level === 'error' ? '#f87171' : b.level === 'warning' ? '#fbbf24' : 'rgba(255,255,255,0.6)', marginBottom: 4, padding: '4px 6px', borderRadius: 4, background: b.level === 'error' ? 'rgba(248,113,113,0.08)' : b.level === 'warning' ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)', borderLeft: '2px solid ' + (b.level === 'error' ? '#f87171' : b.level === 'warning' ? '#fbbf24' : 'rgba(255,255,255,0.2)'), lineHeight: 1.4 }}>
                <div style={{ fontWeight: 700 }}>{b.level === 'error' ? '⛔' : b.level === 'warning' ? '⚠' : 'ℹ'} {b.title}</div>
                <div style={{ opacity: 0.7, marginTop: 1 }}>{b.detail}</div>
              </div>
            ))}
          </div>
        );
      })()}

      <div style={{ marginTop: 8, padding: 10, borderRadius: 10, border: '1px solid ' + quality.color + '40', background: quality.color + '08' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: quality.color }}>🎯 Качество плана</span>
          <span style={{ fontSize: 20, fontWeight: 900, color: quality.color }}>{quality.score}<span style={{ fontSize: 11, fontWeight: 600, opacity: 0.6 }}>/100</span></span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', marginBottom: 8 }}>
          <div style={{ height: '100%', width: quality.score + '%', borderRadius: 2, background: quality.color, transition: 'width 1s' }} />
        </div>
        {quality.breakdown.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, fontSize: 10, color: b.ok ? 'rgba(255,255,255,0.7)' : quality.color }}>
            <span style={{ fontSize: 9 }}>{b.ok ? '✅' : '❌'}</span>
            <span style={{ fontWeight: 700, minWidth: 80 }}>{b.label}</span>
            <span style={{ opacity: 0.8 }}>{b.detail}</span>
          </div>
        ))}
        {/* Per-muscle table */}
        {quality.perMuscle && quality.perMuscle.length > 0 && (
          <div style={{ marginTop: 8, overflowX: 'auto' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 4 }}>Мышца · Сеты · MEV · MAV · MRV · %</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {quality.perMuscle.map(pm => {
                const st = pm.status === 'недотрен' ? '#ef4444' : pm.status === 'перегруз' ? '#f59e0b' : '#22c55e';
                return (
                  <div key={pm.muscle} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: st + '10', border: '1px solid ' + st + '30', fontSize: 9 }}>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{pm.muscle}</span>
                    <span style={{ color: st, fontWeight: 700 }}>{pm.sets}</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>· MEV {pm.mev} · MAV {pm.mav} · MRV {pm.mrv} · {pm.pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Recommendations */}
        {(quality as any).recommendations && (quality as any).recommendations.length > 0 && (
          <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>💡 Рекомендации</div>
            {(quality as any).recommendations.map((r: string, i: number) => (
              <div key={i} style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', marginBottom: 2, paddingLeft: 4, borderLeft: '2px solid #f59e0b' }}>{r}</div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ Экспорт плана ═══ */}
      {result && (
        <div style={{ marginTop: 8 }}>
          <PlanExportCard
            manualResult={result}
            profile={{
              level,
              goal,
              daysPerWeek,
              bodyWeight: tprofile.bodyWeight,
              pmSquat: tprofile.pmSquat,
              pmBench: tprofile.pmBench,
              pmDead: tprofile.pmDead,
              weakPoints: tprofile.weakPoints,
            }}
            level={level}
            weakPoints={tprofile.weakPoints || []}
            hasDeload={false}
            meta={{ splitName: result.splitName, corrections: result.corrections, weeks: mesoLength }}
          />
        </div>
      )}

      <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', marginBottom: 6 }}>📊 Анализ нагрузки</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <div style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Тоннаж/нед</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa' }}>{load.totalWeekly.toLocaleString()} кг</div>
          </div>
          <div style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Ср/день</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa' }}>{Math.round(load.avgDaily).toLocaleString()} кг</div>
          </div>
          <div style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Монотонность</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: load.monotony > 1.5 ? '#ef4444' : load.monotony > 0.9 ? '#f59e0b' : '#22c55e' }}>{load.monotony.toFixed(2)}</div>
          </div>
        </div>
        {load.monotony > 1.5 && <div style={{ fontSize: 9, color: '#ef4444', marginTop: 6 }}>⚠ Монотонность высокая — добавьте вариативность</div>}
        {load.monotony > 0.9 && load.monotony <= 1.5 && <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 6 }}>Монотонность в норме</div>}
        {load.monotony <= 0.9 && <div style={{ fontSize: 9, color: '#22c55e', marginTop: 6 }}>✅ Монотонность низкая — разнообразие отличное</div>}
      </div>

      {/* ═══ BB-метрики (если план сгенерирован BB-движком) ═══ */}
      {result.bbMeta?.generator === 'bb_cycle' && result.weeks && (() => {
        const allSessions: any[] = [];
        result.weeks.forEach(w => w.days.forEach(d => {
          (d as any).bbSession = true;
          allSessions.push({ exercises: d.exercises.map(e => ({ muscle: e.group, sets: e.sets, rir: e.rir, workSets: [{ weight: e.weight, reps: parseInt(e.reps) || 10 }] })) });
        }));
        const mockPlan = { weeks: result.weeks.map(w => ({ week: w.weekNumber, sessions: w.days.map(d => ({ exercises: d.exercises.map(e => ({ muscle: e.group, sets: e.sets, rir: e.rir, role: e.role === 'main' ? 'primary' : 'secondary', workSets: [{ weight: e.weight, reps: parseInt(e.reps) || 10 }] })) })), phase: w.phase })), pattern: { id: result.bbMeta?.bbPatternId || '', name: result.splitName } } as unknown as BBPlan;
        const metrics = calcBBPlanMetrics(mockPlan);
        const explanation = explainBBMetrics(metrics);
        return (
          <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(236,72,153,0.04)', border: '1px solid rgba(236,72,153,0.15)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#ec4899', marginBottom: 6 }}>🏋️ BB-метрики плана</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
              <div style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Сетов/нед</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#ec4899' }}>{metrics.totalSets}</div>
              </div>
              <div style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Тяж %</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#ef4444' }}>{(metrics.тяжPct * 100).toFixed(0)}%</div>
              </div>
              <div style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Памп %</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b' }}>{(metrics.пампPct * 100).toFixed(0)}%</div>
              </div>
              <div style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Ср RIR</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>{metrics.avgRir.toFixed(1)}</div>
              </div>
            </div>
            {explanation && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 4 }}>Объём на мышцу</div>
                {metrics.perMuscle.map((pm) => {
                  const stColor = pm.status === 'exceeding_mrv' ? '#ef4444' : pm.status === 'approaching_mrv' ? '#f59e0b' : pm.status === 'below_mev' ? '#3b82f6' : '#22c55e';
                  const stLabel = pm.status === 'exceeding_mrv' ? '⚠ перегруз' : pm.status === 'approaching_mrv' ? '⚠ у MRV' : pm.status === 'below_mev' ? 'недотрен' : '✅ оптимо';
                  return (
                    <div key={pm.muscle} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>
                      <span style={{ fontWeight: 700, color: '#fff', minWidth: 60 }}>{GROUP_RU[pm.muscle] || pm.muscle}</span>
                      <span style={{ color: '#ec4899', fontWeight: 700 }}>{pm.totalSets}</span>
                      <span style={{ color: '#ef4444' }}>т{pm.тяжSets}</span>
                      <span style={{ color: '#f59e0b' }}>п{pm.пампSets}</span>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>RIR{pm.avgRir.toFixed(1)}</span>
                      <span style={{ color: stColor, fontWeight: 700, marginLeft: 'auto' }}>{stLabel}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══ Auto-deload по ACWR (из sRPE-дневника) ═══ */}
      {(() => {
        const srpeSessions = loadSRPESessions();
        if (srpeSessions.length < 4) return null;
        const acwr = acuteChronicRatio(toDailyLoads(srpeSessions));
        if (!acwr || acwr.ratio < 1.3) return null;
        const isDanger = acwr.ratio > 1.5;
        return (
          <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: isDanger ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)', border: '1px solid ' + (isDanger ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.2)') }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: isDanger ? '#ef4444' : '#f59e0b', marginBottom: 4 }}>
              {isDanger ? '🚨 ACWR ' + acwr.ratio.toFixed(2) + ' — опасная зона!' : '⚠ ACWR ' + acwr.ratio.toFixed(2) + ' — осторожно'}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
              Острая нагрузка {Math.round(acwr.acute)} vs хроническая {Math.round(acwr.chronic)}. Рекомендуется разгрузочная неделя: объём −40%, RIR 4→5, убрать подходы до отказа.
            </div>
          </div>
        );
      })()}

      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.03em', textTransform: 'uppercase', minWidth: 40 }}>⚖️ Вес</span>
        <button onClick={() => massEditWeight(5)} style={massBtnStyle(ACCENT)}>+5%</button>
        <button onClick={() => massEditWeight(-5)} style={massBtnStyle(ACCENT)}>−5%</button>
        <span style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.03em', textTransform: 'uppercase', marginLeft: 6, minWidth: 40 }}>📦 Объём</span>
        <button onClick={() => massEditVolume(-20)} style={massBtnStyle('#ef4444')}>−20%</button>
        <button onClick={() => massEditVolume(10)} style={massBtnStyle(ACCENT)}>+10%</button>
        <span style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.03em', textTransform: 'uppercase', marginLeft: 6, minWidth: 40 }}>🗓️ План</span>
        <button onClick={() => setShowMacroPreview(v => !v)} style={massBtnStyle('#a855f7')}>
          {showMacroPreview ? '▲ Скрыть макроцикл' : '📅 Макроцикл'}
        </button>
      </div>

      {showMacroPreview && <MacroPreview result={result} mesoLength={mesoLength} level={level} />}

      {/* SVG Charts (when multi-week data available) */}
      {hasWeeks && (() => {
        const wks = result.weeks || [];
        const vdata: WeekVolume[] = wks.map(w => {
          const muscles: Record<string, number> = {};
          w.days.forEach(d => d.exercises.forEach(e => { const g = e.group || 'other'; muscles[g] = (muscles[g] || 0) + e.sets; }));
          return { week: w.weekNumber, totalSets: w.days.reduce((s, d) => s + d.exercises.reduce((ss, e) => ss + e.sets, 0), 0), muscles };
        });
        const rdata: RirRecord[] = [];
        wks.forEach(w => w.days.forEach(d => d.exercises.forEach(e => rdata.push({ week: w.weekNumber, exercise: e.name, rir: e.rir || 0 }))));
        return (
          <>
            {vdata.length >= 2 && (
              <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', marginBottom: 6 }}>📊 Объём по неделям (сетов)</div>
                <VolumeByWeekChart data={vdata} />
              </div>
            )}
            {rdata.length >= 2 && (
              <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.15)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#a855f7', marginBottom: 6 }}>📉 RIR-drift по неделям</div>
                <RirDriftChart data={rdata} />
              </div>
            )}
          </>
        );
      })()}

  {hasWeeks && (
    <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.15)' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', marginBottom: 8 }}>📈 ПРОГРЕССИЯ ПО НЕДЕЛЯМ: RIR / ОБЪЁМ / ТОННАЖ</div>
      {(() => {
        const wks = result.weeks || [];
        if (wks.length === 0) return null;
        const maxSets = Math.max(...wks.map(w => w.days.reduce((s: number, d: any) => s + d.exercises.reduce((ss: number, e: any) => ss + e.sets, 0), 0)));
        const maxTonnage = Math.max(...wks.map(w => w.days.reduce((s: number, d: any) => s + d.exercises.reduce((ss: number, e: any) => ss + e.sets * e.weight, 0), 0)));
        const barMaxW = 240;
        const isMulti = wks.length > 1 && new Set(wks.map(w => w.rir)).size > 1;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {wks.map(w => {
              const totalSets = w.days.reduce((s: number, d: any) => s + d.exercises.reduce((ss: number, e: any) => ss + e.sets, 0), 0);
              const totalTonnage = w.days.reduce((s: number, d: any) => s + d.exercises.reduce((ss: number, e: any) => ss + e.sets * e.weight, 0), 0);
              const pc = PHASE_COLORS[w.phase] || '#a855f7';
              return (
                <div key={w.weekNumber} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
                  <button onClick={() => goToWeek(w.weekNumber)} style={{
                    minWidth: 36, padding: '2px 4px', borderRadius: 4, cursor: 'pointer',
                    border: w.weekNumber === currentWeekNum ? '1px solid ' + pc : '1px solid transparent',
                    background: w.weekNumber === currentWeekNum ? pc + '20' : 'transparent',
                    color: w.weekNumber === currentWeekNum ? '#fff' : 'rgba(255,255,255,0.6)',
                    fontSize: 9, fontWeight: 700, textAlign: 'center',
                  }}>{w.weekNumber}</button>
                  <div style={{ fontSize: 8, fontWeight: 600, minWidth: 72, color: pc }}>{w.phaseLabel}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, minWidth: 22, textAlign: 'center', color: w.rir <= 1 ? '#ef4444' : w.rir <= 2 ? '#f59e0b' : '#22c55e' }}>RIR{w.rir}</div>
                  <div style={{ flex: 1, display: 'flex', gap: 2, alignItems: 'center' }}>
                    <div style={{
                      height: 10, width: Math.round((totalSets / Math.max(1, maxSets)) * barMaxW), borderRadius: 4,
                      background: totalSets > 0 ? pc : 'transparent', opacity: 0.7, minWidth: totalSets > 0 ? 4 : 0,
                      transition: 'width 0.5s',
                    }} />
                    <span style={{ fontSize: 7, fontWeight: 600, color: 'rgba(255,255,255,0.5)', minWidth: 20 }}>{totalSets}</span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', gap: 2, alignItems: 'center' }}>
                    <div style={{
                      height: 8, width: Math.round((totalTonnage / Math.max(1, maxTonnage)) * barMaxW), borderRadius: 4,
                      background: totalTonnage > 0 ? '#60a5fa' : 'transparent', opacity: 0.6, minWidth: totalTonnage > 0 ? 4 : 0,
                      transition: 'width 0.5s',
                    }} />
                    <span style={{ fontSize: 7, fontWeight: 600, color: 'rgba(255,255,255,0.5)', minWidth: 30 }}>{(totalTonnage / 1000).toFixed(1)}k</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
      <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 8, color: 'rgba(255,255,255,0.35)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#22c55e' }} /> сеты/нед</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#60a5fa' }} /> тоннаж (кг)</span>
        <span>RIR: 🟢3+ · 🟡1-2 · 🔴0</span>
        {(result.weeks?.length ?? 0) > 1 && new Set(result.weeks?.map(w => w.rir) ?? []).size > 1 && <span style={{ color: '#f59e0b' }}>⏳ волна RIR активна</span>}
      </div>
    </div>
  )}

      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {result.days.map((d, di) => (
          <div key={d.day} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(0,230,138,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>🏋️ День {d.day}</span>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: ACCENT, fontWeight: 700 }}>{d.groups.map(g => GROUP_RU[g] || g).join(' · ')}</span>
                <button onClick={() => copyDay(di)} title="Копировать день" style={{ padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>📋</button>
              </span>
            </div>
            <details style={{ margin: '4px 10px' }}>
              <summary style={{ fontSize: 9, fontWeight: 700, color: '#a855f7', cursor: 'pointer', padding: '4px 0', opacity: 0.7 }}>
                🔥 Разминка ({goal === 'strength' || goal === 'powerlifting' ? 'силовой протокол' : 'гипертрофия'})
              </summary>
              <div style={{ padding: '6px 8px', marginBottom: 6, borderRadius: 6, background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.1)' }}>
                {(getWarmup(d.exercises, goal).general.map((g, gi) => (
                  <div key={gi} style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, paddingLeft: 8, borderLeft: '2px solid rgba(168,85,247,0.2)', marginBottom: 2 }}>⚡ {g}</div>
                )))}
                {getWarmup(d.exercises, goal).specific.length > 0 && (
                  <div style={{ marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 4 }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: '#a855f7', marginBottom: 2, textTransform: 'uppercase' }}>Спец. подводка:</div>
                    {getWarmup(d.exercises, goal).specific.map((s, si) => (
                      <div key={si} style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, paddingLeft: 8 }}>🎯 {s.ex}: {s.sets}</div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>💡 Тренер: разминка обязательна перед первым рабочим подходом.</div>
              </div>
            </details>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 2px' }}>
             {d.exercises.map((e, ei) => {
              const tempoKey = di + '-' + ei;
              const overrideTempo = exerciseTempos[tempoKey];
              const tmpo = globalTempoStr ? { tempo: { toString: () => globalTempoStr } } : (overrideTempo ? { tempo: { toString: () => overrideTempo } } : { tempo: { toString: () => tempoFor(ei === 0 ? 'тяж' : 'памп').notation } });
              const note = getExerciseNote(e, ei, d.exercises, weeklySetsMap, result.corrections);
              const chipWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 1, minHeight: 28, background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '3px 8px', justifyContent: 'center', minWidth: 0 };
              const chipLbl: React.CSSProperties = { fontSize: 8, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', fontWeight: 700, lineHeight: 1 };
              const chipVal: React.CSSProperties = { fontSize: 12, fontWeight: 700, lineHeight: 1.15 };
              return (
                <Fragment key={ei}>
                   <div draggable onDragStart={ev => handleDragStart(ev, di, ei)} onDragOver={handleDragOver} onDrop={ev => handleDrop(ev, di, ei)} onDragEnd={() => setDragFrom(null)} style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px', color: 'rgba(255,255,255,0.85)', borderTop: '1px solid rgba(255,255,255,0.04)', background: dragFrom?.dayIdx === di && dragFrom?.exIdx === ei ? 'rgba(0,230,138,0.1)' : 'transparent', cursor: 'grab' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', cursor: 'grab', userSelect: 'none' }}>⠿</span>
                      <span style={{ fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                        <span style={{ fontSize: 8, padding: '2px 5px', borderRadius: 4, fontWeight: 800, textTransform: 'uppercase', flex: '0 0 auto',
                          background: e.role === 'main' ? 'rgba(0,230,138,0.2)' : e.role === 'secondary' ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.1)',
                          color: e.role === 'main' ? ACCENT : e.role === 'secondary' ? '#60a5fa' : DIM,
                          border: '0.5px solid ' + (e.role === 'main' ? ACCENT : e.role === 'secondary' ? '#60a5fa' : 'rgba(255,255,255,0.2)')
                        }}>{e.role === 'main' ? 'База' : e.role === 'secondary' ? 'Доп' : 'Изо'}</span>
                        {e.name}
                        {e.weight && !(e as any).weightNote && (
                          <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, fontWeight: 700, background: 'rgba(96,165,250,0.18)', color: '#60a5fa', border: '0.5px solid rgba(96,165,250,0.4)', flex: '0 0 auto' }}>от 1ПМ</span>
                        )}
                      </span>
                       <span style={{ display: 'flex', gap: 4, flex: '0 0 auto' }}>
                        <button onClick={(ev: React.MouseEvent) => { ev.stopPropagation(); openSubstitute(di, ei); }} title="Замена" style={actionBtnStyle(ACCENT)}>🔄</button>
                        <button onClick={(ev: React.MouseEvent) => { ev.stopPropagation(); const k = window.prompt('Шаблон (5×5, 3×8, 4×10, 3×12, AMRAP, Myo-rep, 10×10 GVT, 5/3/1):', '5×5'); if (k && SET_TEMPLATES[k]) applySetTemplate(di, ei, k); }} title="Шаблон" style={actionBtnStyle('#a855f7')}>⚡</button>
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 5, paddingLeft: 18 }}>
                      <div style={chipWrap} onClick={() => startInline(di, ei, 'sets', e.sets)}>
                        <span style={chipLbl}>С×П</span>
                        <span style={{ ...chipVal, color: ACCENT }}>{e.sets}×{e.reps}</span>
                      </div>
                      <div style={chipWrap} onClick={() => startInline(di, ei, 'rir', e.rir)}>
                        <span style={chipLbl}>RIR</span>
                        <span style={{ ...chipVal, color: '#f59e0b' }}>{e.rir}</span>
                      </div>
                      <div style={chipWrap}>
                        <span style={chipLbl}>Хар.</span>
                        <span style={{ ...chipVal, color: (e as any).character === 'тяж' ? '#ef4444' : (e as any).character === 'памп' ? '#f59e0b' : 'rgba(255,255,255,0.5)' }}>
                          {(e as any).character ? ((e as any).character === 'тяж' ? '💪' : (e as any).character === 'памп' ? '🔥' : '🌿') : '—'}
                        </span>
                      </div>
                      <div style={chipWrap} onClick={() => e.loadMode !== 'velocity' && startInline(di, ei, 'weight', e.weight)}>
                        <span style={chipLbl}>Вес</span>
                        <span style={{ ...chipVal, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          {e.loadMode === 'velocity' ? (
                            <><span onClick={ev => { ev.stopPropagation(); setInlineEdit({ dayIdx: di, exIdx: ei, field: 'targetVelocity', value: String(e.targetVelocity || 0.5) }); }} style={{ color: '#a855f7' }}>{e.targetVelocity || 0.5} m/s</span>
                            <span onClick={ev => { ev.stopPropagation(); setInlineEdit({ dayIdx: di, exIdx: ei, field: 'loadMode', value: 'weight' }); }} style={{ fontSize: 8, opacity: 0.6, cursor: 'pointer' }}>→ кг</span></>
                          ) : (
                             <>{fmtWt(e)}
                             <span onClick={ev => { ev.stopPropagation(); setInlineEdit({ dayIdx: di, exIdx: ei, field: 'loadMode', value: 'velocity' }); }} style={{ fontSize: 8, opacity: 0.6, cursor: 'pointer' }}>→ m/s</span></>
                          )}
                        </span>
                      </div>
                      <div style={chipWrap}>
                        <span style={chipLbl}>Группа</span>
                        <span style={{ ...chipVal, color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>{GROUP_RU[e.group] || e.group}</span>
                      </div>
                      <div style={chipWrap} onClick={(ev: React.MouseEvent) => { ev.stopPropagation(); setTempoPicker({ dayIdx: di, exIdx: ei }); }} title="Сменить темп">
                        <span style={chipLbl}>Темп</span>
                        <span style={{ ...chipVal, color: '#a855f7' }}>{(e as any).tempo ? (e as any).tempo : (overrideTempo || (tmpo as any).tempo?.toString?.() || '—')}{overrideTempo ? ' *' : ''}</span>
                      </div>
                      <div style={chipWrap} onClick={() => startInline(di, ei, 'rest', e.rest)}>
                        <span style={chipLbl}>Отдых</span>
                        <span style={{ ...chipVal, color: 'rgba(255,255,255,0.7)' }}>{e.rest}с</span>
                      </div>
                    </div>
                  </div>
                  {note && (
                    <div style={{ padding: '2px 10px 4px 10px', fontSize: 9, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      💡 {note}
                    </div>
                  )}
                  {/* Раскрываемые детали */}
                  <div style={{ padding: '1px 10px' }}>
                    {(() => {
                      const key = `${di}-${ei}`;
                      const isExp = expandedEx.has(key);
                      const exData = e as any;
                      const hasDetails = exData.technique || exData.rationale || (exData.substitutions?.length > 0) || (exData.warmupScheme?.length > 0) || exData.backoffWeight || exData.comments || exData.fatigueCost;
                      if (!hasDetails) return null;
                      return (
                        <>
                          <span onClick={() => {
                            const next = new Set(expandedEx);
                            isExp ? next.delete(key) : next.add(key);
                            setExpandedEx(next);
                          }} style={{ fontSize: 9, color: ACCENT, cursor: 'pointer', userSelect: 'none' }}>
                            {isExp ? '▲ Скрыть детали' : '▼ Подробнее'}
                          </span>
                          {isExp && (
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, padding: '4px 0 6px 4px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                              {exData.rationale && <div>🎯 <b>Выбрано:</b> {exData.rationale}</div>}
                              {exData.technique && <div>📐 <b>Техника:</b> {exData.technique}</div>}
                              {exData.comments && <div>💬 {exData.comments}</div>}
                              {exData.substitutions?.length > 0 && <div>🔄 <b>Замены:</b> {exData.substitutions.join(', ')}</div>}
                              {exData.warmupScheme?.length > 0 && (
                                <div>🔥 <b>Разминка:</b> {exData.warmupScheme.map((w: any) => `${w.weight}кг×${w.reps} (${Math.round(w.pct*100)}%)`).join(' → ')}</div>
                              )}
                              {exData.backoffWeight && <div>⬇ <b>Добивка:</b> {exData.backoffWeight} кг (−20%)</div>}
                              {exData.fatigueCost && <div>⚡ <b>Утомление:</b> {exData.fatigueCost}/10</div>}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </Fragment>
              );
            })}
            </div>
          </div>
        ))}
      </div>

      <button onClick={onToRuntime} style={{ width: '100%', marginTop: 10, padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13 }}>
        ▶ К выполнению (SessionPlayer)
      </button>

      {subTarget && (() => {
        const e = result?.days[subTarget.dayIdx]?.exercises[subTarget.exIdx];
        return e ? (
          <SubstitutionPopup
            exerciseName={e.name}
            group={e.group}
            onSelect={applySubstitute}
            onClose={() => setSubTarget(null)}
          />
        ) : null;
      })()}

      {inlineEdit && (
        <div onClick={() => setInlineEdit(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#18181b', borderRadius: 14, padding: 16, maxWidth: 300, width: '100%' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: ACCENT }}>Изменить: {inlineEdit.field}</div>
            <input ref={inlineRef} type="text" value={inlineEdit.value}
              onChange={e => setInlineEdit({ ...inlineEdit, value: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') commitInline(); if (e.key === 'Escape') setInlineEdit(null); }}
              autoFocus style={{ width: '100%', padding: 10, borderRadius: 8, background: '#000', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={commitInline} style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', background: ACCENT, color: '#000', fontWeight: 700, cursor: 'pointer' }}>OK</button>
              <button onClick={() => setInlineEdit(null)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, cursor: 'pointer' }}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {tempoPicker && (
        <div onClick={() => setTempoPicker(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#18181b', borderRadius: 14, padding: 16, maxWidth: 320, width: '100%' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#a855f7' }}>Темп (ECC-ISO-CON-PAUSE)</div>
            {['3-1-1-0', '4-1-1-0', '2-0-2-0', '3-0-1-0', '5-0-1-0', '2-1-2-0', '3-1-X-0', '4-2-2-0'].map(t => (
              <button key={t} onClick={() => { const k = tempoPicker.dayIdx + '-' + tempoPicker.exIdx; setExerciseTempos(p => ({ ...p, [k]: t })); setTempoPicker(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 8, borderRadius: 8, border: '1px solid rgba(168,85,247,0.2)', background: 'rgba(168,85,247,0.06)', color: '#a855f7', cursor: 'pointer', marginBottom: 4, fontSize: 11, fontWeight: 600 }}>{t}</button>
            ))}
            <button onClick={() => { const k = tempoPicker.dayIdx + '-' + tempoPicker.exIdx; setExerciseTempos(p => { const n = { ...p }; delete n[k]; return n; }); setTempoPicker(null); }} style={{ width: '100%', marginTop: 4, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, cursor: 'pointer', fontSize: 10 }}>Сбросить</button>
          </div>
        </div>
      )}
    </div>
  );
};

function massBtnStyle(color: string): React.CSSProperties {
  return { padding: '3px 8px', borderRadius: 6, border: '1px solid ' + color + '40', background: color + '10', color, cursor: 'pointer', fontSize: 9, fontWeight: 600 };
}
function actionBtnStyle(color: string): React.CSSProperties {
  return { padding: '2px 5px', borderRadius: 4, border: '1px solid ' + color + '50', background: color + '14', color, cursor: 'pointer', fontSize: 10, fontWeight: 700 };
}

const MacroPreview: React.FC<{ result: ManualResult; mesoLength: number; level: string }> = ({ result, mesoLength, level }) => {
  const deloadFreq = level === 'beginner' ? 6 : level === 'advanced' ? 4 : 5;
  const deloadWeeks = new Set<number>();
  for (let w = deloadFreq; w <= mesoLength; w += deloadFreq) deloadWeeks.add(w);

  return (
    <div style={{ marginTop: 8, padding: 8, borderRadius: 10, background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.15)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>
        📅 Макроцикл: {mesoLength} нед × {result.days.length} дн/нед
      </div>
      <div style={{ fontSize: 8, color: DIM, marginBottom: 4 }}>
        🟦 Делод каждые {deloadFreq} нед (нед: {[...deloadWeeks].join(', ')})
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 4, minWidth: 'max-content' }}>
          {[...Array(Math.ceil(mesoLength))].map((_, wi) => {
            const wk = wi + 1;
            const isDeload = wk % deloadFreq === 0 && wk > 0;
            const heat = isDeload ? 0.25 : Math.min(1, (wi < mesoLength / 2 ? 65 + wi : 85 - (wi - mesoLength / 2)) / 100);
            const acColor = isDeload ? '#60a5fa' : '#a855f7';
            return (
              <div key={wi} style={{ padding: '4px 6px', borderRadius: 8, background: isDeload ? 'rgba(96,165,250,0.1)' : 'rgba(168,85,247,' + (0.04 + heat * 0.1) + ')', border: '1px solid ' + (isDeload ? 'rgba(96,165,250,0.3)' : 'rgba(168,85,247,' + (0.1 + heat * 0.2) + ')'), minWidth: 72 }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: acColor, textAlign: 'center', marginBottom: 3 }}>{isDeload ? '🔄 Делод' : 'Нед ' + wk}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + result.days.length + ', 1fr)', gap: 2 }}>
                  {result.days.map((_, di2) => (
                    <div key={di2} style={{ height: 18, borderRadius: 3, background: isDeload ? 'rgba(96,165,250,0.3)' : 'rgba(0,230,138,' + (0.15 + heat * 0.35) + ')', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 9, color: isDeload ? '#fff' : 'rgba(255,255,255,0.6)' }}>{isDeload ? '—' : 'Д' + (di2 + 1)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginTop: 2 }}>
                  <div style={{ height: '100%', width: isDeload ? '40%' : Math.round(heat * 100) + '%', borderRadius: 2, background: isDeload ? '#60a5fa' : heat > 0.75 ? '#f59e0b' : ACCENT }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

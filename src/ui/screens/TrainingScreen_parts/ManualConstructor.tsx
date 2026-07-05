import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EXERCISE_CATALOG, getExerciseById, getSubstitutes, canReplace } from '../../../core/exercise-catalog';
import type { Exercise } from '../../../core/types';
import { calcExercisePrescription, TRAINING_SPLITS } from '../../../engines/training.engine';
import { selectSplit } from '../../../engines/split-selector.engine';
import { generateRepTempo } from '../../../engines/rep-tempo-engine';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { FULL_PROGRAM_LIBRARY } from '../../../engines/complete-program-library.engine';
import { WOMENS_PROGRAMS, CUSTOM_PROGRAMS } from './programs-data';
import type { FullProgram, ProgramDay } from '../../../engines/complete-program-library.engine';
import { getMethodsByCategory } from '../../../engines/training-methodology.engine';
import { getVolumeByMuscle } from '../../../engines/training-methodology.engine';
import { labTrainingAdjust } from './lab-training-adjust';
import { loadReadinessHistory } from './readiness-history';
import { PopupSelect, PopupNumber, ExpandableCard } from '../SRCBBScreen_parts/TrainingPopups';
import { TrainingProfileCard } from './TrainingProfileCard';
import { usePlanGeneration } from '../../hooks/usePlanGeneration';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { toDailyLoads, weeklyMonotony } from '../../../engines/pro/training-load.engine';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const CARD_STYLE: React.CSSProperties = { background: 'rgba(24,24,27,0.5)', borderRadius: 10, padding: 12, border: '1px solid rgba(255,255,255,0.05)' };
const IN_STYLE: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 8px', fontSize: 11, boxSizing: 'border-box' as const };
const BTN_STYLE: React.CSSProperties = { padding: '8px 12px', background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.3)', color: ACCENT, borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: 11 };
const GOALS = [{ value: 'bulk', label: '💪 Масса' }, { value: 'cut', label: '🔥 Сушка' }, { value: 'strength', label: '🏋️ Сила' }, { value: 'maintenance', label: '⚖ Поддержание' }, { value: 'recomp', label: '🔁 Рекомпозиция' }, { value: 'rehab', label: '🩹 Реабилитация' }];
const LEVELS = [{ value: 'beginner', label: '🌱 Новичок' }, { value: 'intermediate', label: '📈 Средний' }, { value: 'advanced', label: '🏆 Опытный' }, { value: 'enhanced', label: '⚡ Enhanced' }];
const PCT_FOR_RIR: Record<number, number> = { 0: 1.0, 1: 0.96, 2: 0.92, 3: 0.88, 4: 0.84, 5: 0.80 };
const GROUP_RU: Record<string, string> = { chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор', full: 'Общее' };
const LEVEL_VOLUMES: Record<string, { mrv: number }> = { beginner: { mrv: 15 }, intermediate: { mrv: 20 }, advanced: { mrv: 24 }, enhanced: { mrv: 28 } };
const SET_TEMPLATES: Record<string, { sets: number; reps: string; rir: number; rest: number }> = {
  '5×5': { sets: 5, reps: '5', rir: 1, rest: 180 }, '3×8': { sets: 3, reps: '8', rir: 2, rest: 90 },
  '4×10': { sets: 4, reps: '10', rir: 2, rest: 90 }, '3×12': { sets: 3, reps: '12', rir: 2, rest: 75 },
  'AMRAP': { sets: 1, reps: 'AMRAP', rir: 0, rest: 180 }, 'Myo-rep': { sets: 1, reps: '15 + 5×3', rir: 0, rest: 120 },
  '10×10 GVT': { sets: 10, reps: '10', rir: 3, rest: 60 }, '5/3/1': { sets: 3, reps: '5/3/1+', rir: 1, rest: 180 },
};

interface ManualDay { day: number; groups: string[]; exercises: ManualExercise[] }
interface ManualExercise { name: string; sets: number; reps: string; rir: number; rest: number; group: string; weight: number }
export interface ManualResult { splitName: string; corrections: string[]; days: ManualDay[] }

interface Props {
  goal: string; setGoal: (v: string) => void;
  level: string; setLevel: (v: string) => void;
  daysPerWeek: number; setDaysPerWeek: (v: number) => void;
  mesoLength: number; setMesoLength: (v: number) => void;
  tprofile: any; updateTProfile: (p: any) => void;
  labAnalysis: any;
  setTab: (t: any) => void;
  weakPoints: string[];
  recovery: number;
  fatigue: number;
}

function detectGroup(name: string): string {
  const n = name.toLowerCase();
  if (/squat|присед|leg|quad|ножн|выпад|lunge/i.test(n)) return 'legs';
  if (/bench|жим|chest|груд|press/.test(n)) return /shoulder|плеч|delt/i.test(n) ? 'shoulders' : 'chest';
  if (/deadlift|станов|тяга|row|pull|спин|back|chin|lat/i.test(n)) return 'back';
  if (/curl|бицеп|bicep/i.test(n)) return 'arms';
  if (/tricep|трицеп|extension/i.test(n)) return /пресс|ab|core/i.test(n) ? 'core' : 'arms';
  return 'full';
}

const ManualConstructor: React.FC<Props> = ({ goal, setGoal, level, setLevel, daysPerWeek, setDaysPerWeek, mesoLength, setMesoLength, tprofile, updateTProfile, labAnalysis, setTab, weakPoints, recovery, fatigue }) => {
  // ── State ──
  const [manualCfg, setManualCfg] = useState<Record<string, string>>({});
  const setManual = useCallback((k: string, v: string) => setManualCfg(p => ({ ...p, [k]: v })), []);
  const [exerciseTempos, setExerciseTempos] = useState<Record<string, string>>({});
  const [tempoPicker, setTempoPicker] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const [manualWorkMax, setManualWorkMax] = useState<Record<string, number>>({ chest: 100, back: 110, legs: 140, shoulders: 60, arms: 50, core: 60 });
  const [manualResult, setManualResult] = useState<ManualResult | null>(() => { try { return JSON.parse(localStorage.getItem('he_manual_session') || 'null'); } catch { return null; } });
  useEffect(() => { try { localStorage.setItem('he_manual_session', JSON.stringify(manualResult)); } catch {} }, [manualResult]);
  const [manualSavedPlans, setManualSavedPlans] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('myTrainingPlans') || '[]'); } catch { return []; } });
  const refreshManualSaved = useCallback(() => { try { setManualSavedPlans(JSON.parse(localStorage.getItem('myTrainingPlans') || '[]')); } catch { setManualSavedPlans([]); } }, []);
  const [subModal, setSubModal] = useState<{ dayIdx: number; exIdx: number; options: { id: string; name: string; reason: string }[] } | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{ dayIdx: number; exIdx: number; field: string; value: string } | null>(null);
  const [dragFrom, setDragFrom] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const [showMacroPreview, setShowMacroPreview] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [comparePlan, setComparePlan] = useState<any | null>(null);
  const [planCopied, setPlanCopied] = useState(false);
  const [improveModal, setImproveModal] = useState<{ notes: string[]; apply: () => void } | null>(null);
  const [manualTemplates, setManualTemplates] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('myTrainingTemplates') || '[]'); } catch { return []; } });
  const refreshManualTemplates = useCallback(() => { try { setManualTemplates(JSON.parse(localStorage.getItem('myTrainingTemplates') || '[]')); } catch { setManualTemplates([]); } }, []);
  const inlineRef = useRef<HTMLInputElement | null>(null);

  // ── Derived ──
  const buildPlan = usePlanGeneration({ goal, level, mesoLength, weakPoints, equipment: tprofile.equipment, workMax: tprofile.workMax, manualWorkMax, injuries: tprofile.injuries || [], pctForRir: PCT_FOR_RIR });

  // ── Plan generation ──
  const generateManualPlan = useCallback(() => {
    const corrections: string[] = [];
    const inp = { goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as any;
    const auto = selectSplit(inp);
    const manualSp = manualCfg.split ? TRAINING_SPLITS[manualCfg.split] : null;
    const sp = manualSp ? { id: manualCfg.split!, name: manualSp.name, desc: manualSp.desc, groupsPerDay: manualSp.groupsPerDay, score: 100, rationale: ['Ручной выбор'] } as any : auto[0];
    if (!sp) { setManualResult(null); return; }
    if (manualSp) corrections.push(`Сплит выбран вручную: «${sp.name}» (вместо авто-подбора).`); else corrections.push(`Сплит подобран автоматически: «${sp.name}».`);
    const cycle: string[][] = []; let gi = 0; while (cycle.length < daysPerWeek) { cycle.push(sp.groupsPerDay[gi % sp.groupsPerDay.length]); gi++; }
    const _labAdj = labTrainingAdjust(labAnalysis);
    const courseMult = tprofile.onCourse ? (tprofile.courseIntensity === 'heavy' ? 1.3 : tprofile.courseIntensity === 'mild' ? 1.15 : 1.2) : 1;
    const baseMrv = (LEVEL_VOLUMES[level]?.mrv ?? 20);
    let mrv = baseMrv * courseMult * _labAdj.mrvMultiplier;
    try { const _rh = loadReadinessHistory(); if (_rh.length) { const _last = _rh[_rh.length - 1]; if ((_last?.recovery ?? 100) < 60) { mrv *= 0.85; corrections.push(`🩺 Готовность прошлой недели ${Math.round(_last.recovery)}% (<60) — объём снижен на 15%.`); } } } catch {}
    if (tprofile.onCourse) corrections.push(`MRV повышен на курсе: база ${baseMrv} × ${courseMult} = ${Math.round(baseMrv * courseMult)}.`);
    if (_labAdj.mrvMultiplier < 1) corrections.push(`MRV снижен по лаборатории ×${_labAdj.mrvMultiplier.toFixed(2)}: ${_labAdj.warnings.join(' ')}`);
    corrections.push(`Допустимый объём (MRV): ${Math.round(mrv)} сетов/нед на группу.`);
    if (weakPoints.length > 0) corrections.push(`Слабые группы (${weakPoints.join(', ')}): приоритет в отборе + RIR ↓.`);
    if (tprofile.equipment.length > 0) corrections.push(`Фильтр оборудования: только ${tprofile.equipment.join(', ')}.`);
    const built = buildPlan(cycle, mrv);
    corrections.push(...built.groupCorrections);
    const weeklySets = built.weeklySets;
    Object.entries(weeklySets).forEach(([g, s]: [string, any]) => { if (s < Math.max(4, mrv * 0.4) && s > 0) corrections.push(`Группа «${g}»: низкий объём (${s} сетов) — ниже зоны адаптации.`); });
    setManualResult({ splitName: sp.name, corrections, days: built.days });
  }, [goal, level, daysPerWeek, mesoLength, recovery, fatigue, weakPoints, manualCfg, tprofile, labAnalysis, buildPlan]);

  // ── Program loading ──
  const loadProgramToConstructor = useCallback((programId: string) => {
    const lib: FullProgram[] = [...FULL_PROGRAM_LIBRARY, ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS];
    const prog = lib.find(p => p.id === programId);
    if (!prog || !prog.weeks?.length) return;
    const wk = prog.weeks[0];
    const days: ManualDay[] = wk.days.map((d: ProgramDay, di: number) => ({
      day: di + 1,
      groups: Array.from(new Set((d.exercises || []).map((e: ProgramDay['exercises'][number]) => detectGroup(e.name)))),
      exercises: (d.exercises || []).map((e: ProgramDay['exercises'][number]) => {
        const g = detectGroup(e.name);
        const rir = e.rir ?? (e.rpe ? Math.max(0, 10 - e.rpe) : 2);
        const pct = PCT_FOR_RIR[Math.max(0, Math.min(5, rir))] ?? 0.9;
        const weight = Math.round((tprofile.workMax[g] || 80) * pct);
        return { name: e.name, sets: e.sets, reps: String(e.reps), rir, rest: e.restSec || 120, group: g, weight };
      })
    }));
    const corrections: string[] = [];
    corrections.push(`Загружена программа «${prog.name}» (${prog.author || ''}, ${prog.goal}, ${prog.level}) — неделя 1, ${days.length} дн.`);
    corrections.push('Программа доступна для редактирования, применения методик и выполнения.');
    if (prog.warnings?.length) corrections.push('Предупреждения: ' + prog.warnings.join('; '));
    setManualResult({ splitName: prog.name + ' (неделя 1)', corrections, days });
  }, [tprofile]);

  // ── Actions ──
  const openSubstitute = useCallback((di: number, ei: number) => {
    if (!manualResult) return;
    const e = manualResult.days[di]?.exercises[ei]; if (!e) return;
    const cat = EXERCISE_CATALOG.find(c => c.name === e.name) || getExerciseById(e.name);
    if (!cat) { setSubModal({ dayIdx: di, exIdx: ei, options: [] }); return; }
    const sub = getSubstitutes(cat.id);
    const opts: { id: string; name: string; reason: string }[] = [];
    if (sub) { for (const s of sub.substitutes) { if (!canReplace(cat.id, s.id)) continue; const rep = getExerciseById(s.id); opts.push({ id: s.id, name: rep?.name || s.id, reason: s.reason }); } }
    if (opts.length === 0) { EXERCISE_CATALOG.filter(c => c.group === cat.group && c.id !== cat.id && canReplace(cat.id, c.id)).slice(0, 6).forEach(c => opts.push({ id: c.id, name: c.name, reason: 'Альтернатива той же группы' })); }
    setSubModal({ dayIdx: di, exIdx: ei, options: opts });
  }, [manualResult]);

  const applySubstitute = useCallback((newId: string) => {
    if (!subModal || !manualResult) return;
    const rep = getExerciseById(newId); if (!rep) { setSubModal(null); return; }
    const { dayIdx, exIdx } = subModal;
    const old = manualResult.days[dayIdx].exercises[exIdx];
    const reason = subModal.options.find(o => o.id === newId)?.reason || '';
    const wm = (tprofile.workMax[rep.group] || manualWorkMax[rep.group] || 80);
    const pct = PCT_FOR_RIR[Math.max(0, Math.min(5, old.rir))] ?? 0.9;
    const weight = Math.round(wm * pct);
    const days = manualResult.days.map((d, di) => di === dayIdx ? { ...d, exercises: d.exercises.map((ex, ei) => ei === exIdx ? { ...ex, name: rep.name, group: rep.group, weight } : ex) } : d);
    setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, `🔄 Замена: «${old.name}» → «${rep.name}» (${reason}). Группа: ${rep.group}, вес ${weight} кг.`] });
    setSubModal(null);
  }, [subModal, manualResult, tprofile, manualWorkMax]);

  const startInline = useCallback((di: number, ei: number, field: string, val: string | number) => { setInlineEdit({ dayIdx: di, exIdx: ei, field, value: String(val) }); setTimeout(() => inlineRef.current?.focus(), 10); }, []);
  const commitInline = useCallback(() => {
    if (!inlineEdit || !manualResult) { setInlineEdit(null); return; }
    const { dayIdx, exIdx, field, value } = inlineEdit;
    const old = manualResult.days[dayIdx]?.exercises[exIdx]; if (!old) { setInlineEdit(null); return; }
    const days = manualResult.days.map((d, di) => di === dayIdx ? { ...d, exercises: d.exercises.map((ex, ei) => {
      if (ei !== exIdx) return ex; const ne = { ...ex };
      if (field === 'sets') ne.sets = parseInt(value) || ex.sets;
      else if (field === 'reps') ne.reps = value;
      else if (field === 'rir') { const v = parseInt(value); if (!isNaN(v)) ne.rir = v; }
      else if (field === 'weight') { const v = parseInt(value); if (!isNaN(v)) ne.weight = v; }
      else if (field === 'rest') { const v = parseInt(value); if (!isNaN(v)) ne.rest = v; }
      return ne;
    }) } : d);
    setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, `✏️ ${old.name}: ${field}=${value}`] });
    setInlineEdit(null);
  }, [inlineEdit, manualResult]);

  const handleDragStart = useCallback((e: React.DragEvent, di: number, ei: number) => { setDragFrom({ dayIdx: di, exIdx: ei }); e.dataTransfer.effectAllowed = 'move'; }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);
  const handleDrop = useCallback((e: React.DragEvent, tDay: number, tEx: number) => {
    e.preventDefault(); if (!dragFrom || !manualResult) return;
    const { dayIdx: fDay, exIdx: fEx } = dragFrom;
    if (fDay === tDay && fEx === tEx) { setDragFrom(null); return; }
    const days = manualResult.days.map(d => ({ ...d, exercises: [...d.exercises.map(ee => ({ ...ee }))] }));
    const moved = days[fDay].exercises.splice(fEx, 1)[0]; if (!moved) { setDragFrom(null); return; }
    const insertAt = fDay === tDay && tEx > fEx ? tEx - 1 : tEx;
    days[tDay].exercises.splice(insertAt, 0, moved);
    setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, `↕️ «${moved.name}» — День ${days[fDay].day} → День ${days[tDay].day}.`] });
    setDragFrom(null);
  }, [dragFrom, manualResult]);

  const copyDay = useCallback((di: number) => {
    if (!manualResult) return;
    const src = manualResult.days[di]; const newNum = Math.max(...manualResult.days.map(d => d.day)) + 1;
    setManualResult({ ...manualResult, days: [...manualResult.days, { ...src, day: newNum, exercises: src.exercises.map(e => ({ ...e })) }], corrections: [...manualResult.corrections, `📋 День ${src.day} скопирован → День ${newNum}.`] });
  }, [manualResult]);

  const massEditWeight = useCallback((pct: number) => {
    if (!manualResult) return;
    const sgn = pct > 0 ? '+' : '';
    const days = manualResult.days.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e, weight: Math.round(e.weight * (1 + pct / 100)) })) }));
    setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, `⚡ Масс-правка: веса ${sgn}${pct}%.`] });
  }, [manualResult]);

  const massEditVolume = useCallback((pct: number) => {
    if (!manualResult) return;
    const sgn = pct > 0 ? '+' : '';
    const days = manualResult.days.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e, sets: Math.max(1, Math.round(e.sets * (1 + pct / 100))) })) }));
    setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, `⚡ Масс-правка: объём ${sgn}${pct}%.`] });
  }, [manualResult]);

  const applySetTemplate = useCallback((di: number, ei: number, key: string) => {
    if (!manualResult) return;
    const t = SET_TEMPLATES[key]; if (!t) return;
    const e = manualResult.days[di].exercises[ei];
    const pct = PCT_FOR_RIR[Math.max(0, Math.min(5, t.rir))] ?? 0.9;
    const wm = tprofile.workMax[e.group] || manualWorkMax[e.group] || 80;
    const days = manualResult.days.map((d, di2) => di2 === di ? { ...d, exercises: d.exercises.map((ex, ei2) => ei2 === ei ? { ...ex, sets: t.sets, reps: t.reps, rir: t.rir, rest: t.rest, weight: Math.round(wm * pct) } : ex) } : d);
    setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, `⚡ Шаблон «${key}» → «${e.name}»: ${t.sets}×${t.reps}, RIR ${t.rir}.`] });
  }, [manualResult, tprofile, manualWorkMax]);

  const loadManualPlan = useCallback((plan: any) => {
    if (plan?.cfg) setManualCfg(plan.cfg);
    if (plan?.days) setManualResult({ splitName: plan.name || 'Загруженный план', corrections: plan.corrections || [], days: plan.days });
  }, []);

  const recalcWeightsByLevel = useCallback(() => {
    if (!manualResult) return;
    const days = manualResult.days.map(d => ({ ...d, exercises: d.exercises.map(e => {
      const cat = EXERCISE_CATALOG.find(cc => cc.name === e.name);
      const g = cat?.group || e.group; const wm = tprofile.workMax[g] || manualWorkMax[g] || 80;
      const pct = PCT_FOR_RIR[Math.max(0, Math.min(5, e.rir))] ?? 0.9;
      return { ...e, weight: Math.round(wm * pct) };
    }) }));
    setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, `🔄 Веса пересчитаны по workMax × %1RM(RIR).`] });
  }, [manualResult, tprofile, manualWorkMax]);

  const applyMethodicToPlan = useCallback(() => {
    if (!manualResult) return;
    const corr: string[] = []; const name = manualCfg.intensity || manualCfg.technique || manualCfg.volume || '';
    if (!name) { corr.push('Выберите методику (Интенсивность/Техника/Объём).'); setManualResult({ ...manualResult, corrections: [...manualResult.corrections, ...corr] }); return; }
    const days = manualResult.days.map(d => ({ ...d, exercises: d.exercises.map(e => {
      const wm = tprofile.workMax[e.group] || 80; let ne = { ...e };
      if (/10×10|GVT|German Volume/i.test(name)) { ne = { ...e, sets: 10, reps: '10', weight: Math.round(wm * 0.6), rir: 3, rest: 90 }; corr.push(e.name + ': → 10×10 GVT'); }
      else if (/Cluster 5×5|Кластер/i.test(name)) { ne = { ...e, sets: 5, reps: '5', weight: Math.round(wm * 0.85), rir: 1, rest: 180 }; corr.push(e.name + ': → 5×5 кластерами'); }
      else if (/Rest-Pause/i.test(name)) { ne = { ...e, sets: 1, reps: 'до отказа +3-5', weight: Math.round(wm * 0.8), rir: 0, rest: 180 }; corr.push(e.name + ': → rest-pause'); }
      else if (/Tempo|Темп/i.test(name)) { ne = { ...e, weight: Math.round(wm * 0.7), rir: 2, rest: 60 }; corr.push(e.name + ': → темп 3-1-1-0'); }
      else if (/Drop|Дроп/i.test(name)) { ne = { ...e, rir: 0, rest: 90 }; corr.push(e.name + ': → drop-set'); }
      else { corr.push(e.name + ': методика «' + name + '» применена концептуально'); }
      return ne;
    }) }));
    corr.unshift('Применена методика: «' + name + '» к ' + days.reduce((s, d) => s + d.exercises.length, 0) + ' упражнениям.');
    setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, ...corr] });
  }, [manualResult, manualCfg, tprofile]);

  const manualToRuntime = useCallback(() => {
    if (!manualResult) return;
    const days = manualResult.days.map(d => ({
      label: 'Д' + d.day,
      exercises: d.exercises.map(e => ({
        name: e.name, muscleGroup: e.group,
        targetSets: Array.from({ length: e.sets }, () => ({ weight: e.weight, reps: parseInt(e.reps) || 10, rir: e.rir })),
      })),
    }));
    try { localStorage.setItem('he_pl_runtime', JSON.stringify({ days, focus: manualResult.splitName, week: 1, track: 'manual' })); } catch {}
    setTab('runtime');
  }, [manualResult, setTab]);

  const improveProgram = useCallback(() => {
    if (!manualResult) return;
    const ru = (g: string) => GROUP_RU[g] || g;
    const wk: Record<string, number> = {};
    manualResult.days.forEach(d => d.exercises.forEach(e => { wk[e.group] = (wk[e.group] || 0) + e.sets; }));
    const la = labTrainingAdjust(labAnalysis);
    const cmp = tprofile.onCourse ? (tprofile.courseIntensity === 'heavy' ? 1.3 : tprofile.courseIntensity === 'mild' ? 1.15 : 1.2) : 1;
    const mrv = ((LEVEL_VOLUMES[level]?.mrv ?? 20)) * cmp * la.mrvMultiplier;
    const notes: string[] = [];
    let days = manualResult.days.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e })) }));
    Object.entries(wk).forEach(([g, s]) => {
      if (s > mrv) { const excess = s - Math.round(mrv); let reduced = 0; for (const d of days) { for (const e of d.exercises) { if (e.group === g && reduced < excess) { const take = Math.min(Math.max(0, e.sets - 1), excess - reduced); if (take > 0) { e.sets -= take; reduced += take; } } } } if (reduced > 0) notes.push(`Снижен объём «${ru(g)}»: −${reduced} сетов (было >MRV ${Math.round(mrv)}).`); }
    });
    tprofile.weakPoints.forEach((w: string) => {
      if ((wk[w] || 0) === 0) {
        const cat = EXERCISE_CATALOG.find(e => e.group === w && e.type === 'compound' && (tprofile.equipment.length === 0 || tprofile.equipment.includes(e.equipment)));
        if (cat) {
          const dayIdx = days.findIndex(d => d.groups.includes(w)); const target = dayIdx >= 0 ? dayIdx : 0;
          const pr = calcExercisePrescription(cat, goal, level, true, false, 1, 1, mesoLength);
          const wm = tprofile.workMax[w] || manualWorkMax[w] || 80;
          const pct = PCT_FOR_RIR[Math.max(0, Math.min(5, pr.rir))] ?? 0.9;
          days[target].exercises.push({ name: cat.name, sets: pr.sets, reps: pr.reps, rir: pr.rir, rest: pr.rest, group: w, weight: Math.round(wm * pct) });
          notes.push(`Добавлено для слабой группы «${ru(w)}»: ${cat.name} (${pr.sets}×${pr.reps}).`);
        } else { notes.push(`Слабая группа «${ru(w)}» не покрыта — нет подходящего упражнения.`); }
      }
    });
    Object.entries(wk).forEach(([g, s]) => { if (s > 0 && s < Math.max(4, mrv * 0.4)) { for (const d of days) { const e = d.exercises.find(ex => ex.group === g); if (e) { e.sets += 1; notes.push(`Группа «${ru(g)}»: низкий объём (${s} сетов) — +1 подход к «${e.name}».`); break; } } } });
    if (notes.length === 0) { setImproveModal({ notes: ['План уже сбалансирован.'], apply: () => setImproveModal(null) }); return; }
    setImproveModal({ notes, apply: () => { setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, '🎯 Улучшение программы:', ...notes] }); setImproveModal(null); } });
  }, [manualResult, labAnalysis, tprofile, level, goal, mesoLength, manualWorkMax]);

  const exportFullReport = useCallback(() => {
    const la = labTrainingAdjust(labAnalysis);
    const wk: Record<string, number> = {}; if (manualResult) manualResult.days.forEach(d => d.exercises.forEach(e => { wk[e.group] = (wk[e.group] || 0) + e.sets; }));
    const mrv = ((LEVEL_VOLUMES[level]?.mrv ?? 20)) * (tprofile.onCourse ? 1.2 : 1) * la.mrvMultiplier;
    const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const planHtml = manualResult ? manualResult.days.map(d => '<h3>День ' + d.day + ' (' + esc(d.groups.join(', ')) + ')</h3><table border=1 cellpadding=4 style=border-collapse:collapse;width:100%><tr><th>Упражнение</th><th>С×П</th><th>RIR</th><th>Вес</th><th>Отд</th></tr>' + d.exercises.map(e => '<tr><td>' + esc(e.name) + '</td><td>' + e.sets + '×' + esc(e.reps) + '</td><td>' + e.rir + '</td><td>' + e.weight + 'кг</td><td>' + e.rest + 'с</td></tr>').join('') + '</table>').join('') : '<p>План не построен.</p>';
    const corrHtml = manualResult?.corrections?.length ? '<h2>Журнал правок</h2><ul>' + manualResult.corrections.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>' : '';
    const labHtml = la.warnings.length ? '<h2>Лаб. коррекция (MRV ×' + la.mrvMultiplier.toFixed(2) + ')</h2><ul>' + la.warnings.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul>' : '';
    const html = '<html><head><meta charset=utf-8><title>Отчёт: ' + (manualResult?.splitName || '') + '</title><style>body{font-family:Arial;padding:20px}h1{color:#008}h2{color:#060}table{font-size:11px;border-collapse:collapse}td,th{padding:4px;border:1px solid #ccc}</style></head><body><h1>' + (manualResult?.splitName || 'Отчёт') + '</h1>' + labHtml + corrHtml + '<h2>План</h2>' + planHtml + '</body></html>';
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); }
  }, [manualResult, labAnalysis, level, tprofile]);

  const printManualPlan = useCallback(() => {
    if (!manualResult) return;
    const rows = manualResult.days.map(d => '<h3>День ' + d.day + ' (' + d.groups.join(', ') + ')</h3><table border=1 cellpadding=4 style=border-collapse:collapse;width:100%><tr><th>Упражнение</th><th>С×П</th><th>RIR</th><th>Вес</th><th>Отдых</th></tr>' + d.exercises.map(e => '<tr><td>' + e.name + '</td><td>' + e.sets + '×' + e.reps + '</td><td>' + e.rir + '</td><td>' + e.weight + ' кг</td><td>' + e.rest + 'с</td></tr>').join('') + '</table>').join('');
    const html = '<html><head><meta charset=utf-8><title>' + manualResult.splitName + '</title><style>body{font-family:Arial;padding:20px;color:#111}h1{color:#008}h3{color:#060}table{font-size:12px;border-collapse:collapse}td,th{padding:4px;border:1px solid #ccc}</style></head><body><h1>' + manualResult.splitName + '</h1><p>' + level + ' · ' + goal + ' · ' + daysPerWeek + ' дн/нед · ' + mesoLength + ' нед</p>' + rows + '</body></html>';
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); }
  }, [manualResult, level, goal, daysPerWeek, mesoLength]);

  const exportManualPlanText = useCallback(() => {
    if (!manualResult) return;
    const lines: string[] = ['Тренировочный план: ' + manualResult.splitName];
    lines.push('Параметры: ' + Object.entries(manualCfg).filter(([, v]) => v).map(([k, v]) => k + '=' + v).join(', '));
    lines.push('Уровень: ' + level + ' · Цель: ' + goal + ' · Дней/нед: ' + daysPerWeek + ' · Длина: ' + mesoLength + ' нед');
    if (manualResult.corrections?.length) { lines.push(''); lines.push('Комментарии:'); manualResult.corrections.forEach(c => lines.push('  • ' + c)); }
    manualResult.days.forEach(d => { lines.push(''); lines.push('День ' + d.day + ' (' + d.groups.join(', ') + ')'); d.exercises.forEach(e => lines.push('  ' + e.name + ' — ' + e.sets + 'x' + e.reps + ' @ RIR' + e.rir + ' · ' + e.weight + ' кг · ' + e.rest + 'с (' + e.group + ')')); });
    try { navigator.clipboard?.writeText(lines.join('\n')); } catch {}
    setPlanCopied(true); setTimeout(() => setPlanCopied(false), 1800);
  }, [manualResult, manualCfg, level, goal, daysPerWeek, mesoLength]);

  const saveAsTemplate = useCallback(() => {
    if (!manualResult) return;
    const name = window.prompt('Название шаблона:', manualResult.splitName); if (!name) return;
    try { const t = { name, date: new Date().toISOString().slice(0, 10), cfg: manualCfg, days: manualResult.days }; const ex = JSON.parse(localStorage.getItem('myTrainingTemplates') || '[]'); ex.unshift(t); localStorage.setItem('myTrainingTemplates', JSON.stringify(ex.slice(0, 30))); refreshManualTemplates(); } catch {}
  }, [manualResult, manualCfg, refreshManualTemplates]);

  const savePlan = useCallback(() => {
    if (!manualResult) return;
    try { const data = { name: `Ручная: ${manualResult.splitName}`, date: new Date().toISOString().slice(0, 10), cfg: manualCfg, days: manualResult.days, generatedAt: Date.now() }; const ex = JSON.parse(localStorage.getItem('myTrainingPlans') || '[]'); ex.unshift(data); localStorage.setItem('myTrainingPlans', JSON.stringify(ex.slice(0, 30))); refreshManualSaved(); } catch {}
  }, [manualResult, manualCfg, refreshManualSaved]);

  const deleteTemplate = useCallback((idx: number) => {
    try { const ex = JSON.parse(localStorage.getItem('myTrainingTemplates') || '[]'); ex.splice(idx, 1); localStorage.setItem('myTrainingTemplates', JSON.stringify(ex)); refreshManualTemplates(); } catch {}
  }, [refreshManualTemplates]);

  // ── Quality score ──
  const quality = useMemo(() => {
    if (!manualResult) return null;
    const _labAdj = labTrainingAdjust(labAnalysis);
    const mrvBase = ((LEVEL_VOLUMES[level]?.mrv ?? 20)) * (tprofile.onCourse ? (tprofile.courseIntensity === 'heavy' ? 1.3 : tprofile.courseIntensity === 'mild' ? 1.15 : 1.2) : 1) * _labAdj.mrvMultiplier;
    const wk: Record<string, number> = {};
    manualResult.days.forEach(d => d.exercises.forEach(e => { wk[e.group] = (wk[e.group] || 0) + e.sets; }));
    const groups = Object.keys(wk);
    const over = groups.filter(g => wk[g] > mrvBase);
    const weakCovered = tprofile.weakPoints.filter((w: string) => (wk[w] || 0) > 0);
    const weakMissed = tprofile.weakPoints.filter((w: string) => (wk[w] || 0) === 0);
    let score = 100; score -= over.length * 12; score -= weakMissed.length * 10; score -= groups.filter(g => wk[g] > 0 && wk[g] < Math.max(4, mrvBase * 0.4)).length * 4;
    score = Math.max(0, Math.min(100, score));
    return { score, over, weakCovered, weakMissed, wk, mrvBase, groups };
  }, [manualResult, level, tprofile, labAnalysis]);

  // ── Plan comparison ──
  const compareStats = useMemo(() => {
    if (!manualResult || !comparePlan) return null;
    const cur: Record<string, number> = {}; manualResult.days.forEach(d => d.exercises.forEach(e => { cur[e.group] = (cur[e.group] || 0) + e.sets; }));
    const cmp: Record<string, number> = {}; (comparePlan.days || []).forEach((d: any) => (d.exercises || []).forEach((e: any) => { cmp[e.group] = (cmp[e.group] || 0) + e.sets; }));
    const allG = Array.from(new Set([...Object.keys(cur), ...Object.keys(cmp)]));
    return { cur, cmp, allG, curTotal: Object.values(cur).reduce((a: number, b: number) => a + b, 0), cmpTotal: Object.values(cmp).reduce((a: number, b: number) => a + b, 0) };
  }, [manualResult, comparePlan]);

  // ── Render ──
  const cConfigLabel: Record<string, string> = { split: 'сплит', cycle: 'цикл', program: 'программа', periodization: 'периодизация', progression: 'прогрессия', intensity: 'интенсивность', technique: 'техника', volume: 'объём', frequency: 'частота' };

  return (
    <div className="card" style={{ padding: '10px 12px' }}>
      <TrainingProfileCard profile={tprofile} update={updateTProfile} />
      {(() => { const la = labTrainingAdjust(labAnalysis); if (la.warnings.length === 0 && la.mrvMultiplier >= 1) return null; return <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: la.deloadRecommended ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)', border: '1px solid ' + (la.deloadRecommended ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)') }}><div style={{ fontSize: 11, fontWeight: 800, color: la.deloadRecommended ? '#ef4444' : '#f59e0b', marginBottom: 4 }}>🧪 Лабораторная коррекция (MRV ×{la.mrvMultiplier.toFixed(2)})</div>{la.warnings.map((w: string, i: number) => <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4, marginBottom: 2 }}>• {w}</div>)}{la.intensityNote && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{la.intensityNote}</div>}</div>; })()}

      <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: ACCENT }}>🛠 Ручной конструктор программы</h3>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 10 }}>Выберите параметры сверху вниз и нажмите «Собрать программу» — получите готовый план по дням.</div>

      {/* Базовые параметры */}
      <div style={{ background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 8 }}>⚙️ Базовые параметры</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <PopupSelect label="Цель" value={goal} onChange={setGoal} options={GOALS.map(g => ({ id: g.value, label: g.label }))} />
          <PopupSelect label="Уровень" value={level} onChange={setLevel} options={LEVELS.map(l => ({ id: l.value, label: l.label }))} />
          <PopupNumber label="Дней в неделю" value={daysPerWeek} min={2} max={6} onChange={v => setDaysPerWeek(v)} />
          <PopupSelect label="Длина мезоцикла" value={String(mesoLength)} onChange={v => setMesoLength(+v)} options={[[12, '12 недель'], [16, '16 недель'], [20, '20 недель'], [24, '24 недели']].map(([id, label]) => ({ id: String(id), label: String(label) }))} />
        </div>
      </div>

      {/* Конфигурация программы */}
      <div style={{ background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.15)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>⚙️ Ручная конфигурация программы</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <PopupSelect label="Тип сплита" value={manualCfg.split || ''} onChange={v => setManual('split', v)} options={Object.entries(TRAINING_SPLITS).map(([id, s]: [string, any]) => ({ id, label: s.name, desc: s.desc }))} hint="Все сплиты из библиотеки." />
          <PopupSelect label="Тип цикла" value={manualCfg.cycle || ''} onChange={v => setManual('cycle', v)} options={LMS_CYCLES.map((c: any) => ({ id: c.meta.id, label: c.meta.title, desc: (c.meta.id.startsWith('block') ? 'Блок' : c.meta.id.startsWith('embed') ? 'Встроенная' : 'СРЦ') + ' · ' + c.meta.level }))} hint="Все циклы по категориям." />
          <PopupSelect label="Программа тренировок" value={manualCfg.program || ''} onChange={v => setManual('program', v)} options={[...FULL_PROGRAM_LIBRARY, ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS].map((p: any) => ({ id: p.id, label: p.name, desc: p.type + ' · ' + p.goal + ' · ' + p.level }))} hint="Готовые программы из библиотеки." />
          <PopupSelect label="Периодизация" value={manualCfg.periodization || ''} onChange={v => setManual('periodization', v)} options={getMethodsByCategory('periodization').map(m => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
          <PopupSelect label="Прогрессия" value={manualCfg.progression || ''} onChange={v => setManual('progression', v)} options={getMethodsByCategory('progression').map(m => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
          <PopupSelect label="Интенсивность" value={manualCfg.intensity || ''} onChange={v => setManual('intensity', v)} options={getMethodsByCategory('intensity').map(m => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
          <PopupSelect label="Техника" value={manualCfg.technique || ''} onChange={v => setManual('technique', v)} options={getMethodsByCategory('technique').map(m => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
          <PopupSelect label="Объём" value={manualCfg.volume || ''} onChange={v => setManual('volume', v)} options={getMethodsByCategory('volume').map(m => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
          <PopupSelect label="Частота" value={manualCfg.frequency || ''} onChange={v => setManual('frequency', v)} options={getMethodsByCategory('frequency').map(m => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
        </div>
        {Object.values(manualCfg).some(Boolean) && <div style={{ marginTop: 8, fontSize: 10, color: ACCENT }}>✓ Выбрано: {Object.entries(manualCfg).filter(([, v]) => v).map(([k]) => cConfigLabel[k] || k).join(' · ')}</div>}
        {manualCfg.program && <button onClick={() => loadProgramToConstructor(manualCfg.program)} style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>📥 Загрузить программу в конструктор</button>}
      </div>

      {/* Кнопка генерации */}
      <div style={{ marginTop: 8 }}>
        <button onClick={generateManualPlan} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13 }}>🔧 Собрать программу по конфигурации</button>
        <div style={{ fontSize: 9, color: DIM, marginTop: 4, textAlign: 'center' }}>Соберёт план из выбранного сплита (или авто) + цель/уровень/дни/недели.</div>
      </div>

      {/* Результат */}
      {manualResult && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>📋 Результат: {manualResult.splitName}</div>
            <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: 'rgba(0,230,138,0.12)', padding: '3px 8px', borderRadius: 8 }}>{manualResult.days.length} дн/нед · {mesoLength} нед</span>
          </div>

          {Object.values(manualCfg).some(Boolean) && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}><b style={{ color: ACCENT }}>Параметры:</b> {Object.entries(manualCfg).filter(([, v]) => v).map(([k, v]) => (cConfigLabel[k] || k) + ': ' + v).join(' · ')}</div>}

          {manualResult.corrections?.length > 0 && (
            <div style={{ marginTop: 6, padding: 10, borderRadius: 10, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', marginBottom: 6 }}>📝 Комментарии к плану (что изменено и почему)</div>
              {manualResult.corrections.map((c, i) => <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 3, paddingLeft: 4, borderLeft: '2px solid rgba(59,130,246,0.4)' }}>{c}</div>)}
            </div>
          )}

          {/* Mass editing */}
          <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: DIM, alignSelf: 'center' }}>⚡ Масс-правка:</span>
            <button onClick={() => massEditWeight(5)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontSize: 9, fontWeight: 600 }}>+5% вес</button>
            <button onClick={() => massEditWeight(-5)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontSize: 9, fontWeight: 600 }}>−5% вес</button>
            <button onClick={() => massEditVolume(-20)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#ef4444', cursor: 'pointer', fontSize: 9, fontWeight: 600 }}>−20% объём</button>
            <button onClick={() => massEditVolume(10)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontSize: 9, fontWeight: 600 }}>+10% объём</button>
            <button onClick={() => setShowMacroPreview(v => !v)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 9, fontWeight: 600 }}>{showMacroPreview ? '▲ Скрыть' : '📅 Макроцикл'}</button>
          </div>

          {showMacroPreview && <div style={{ marginTop: 8, padding: 8, borderRadius: 10, background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.15)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>📅 Предпросмотр макроцикла: {mesoLength} нед × {manualResult.days.length} дн</div>
            {(() => { const deloadFreq = level === 'beginner' ? 6 : level === 'advanced' ? 4 : 5; const deloadWeeks = new Set<number>(); for (let w = deloadFreq; w <= mesoLength; w += deloadFreq) deloadWeeks.add(w); return <div style={{ fontSize: 8, color: DIM, marginBottom: 4 }}>🟦 Делод каждые {deloadFreq} нед (нед: {[...deloadWeeks].join(', ')})</div>; })()}
            <div style={{ overflowX: 'auto' }}><div style={{ display: 'flex', gap: 4, minWidth: 'max-content' }}>
              {[...Array(Math.ceil(mesoLength))].map((_, wi) => { const wk = wi + 1; const deloadFreq = level === 'beginner' ? 6 : level === 'advanced' ? 4 : 5; const isDeload = wk % deloadFreq === 0 && wk > 0; const heat = isDeload ? 0.25 : Math.min(1, (wi < mesoLength / 2 ? 65 + wi : 85 - (wi - mesoLength / 2)) / 100); const acColor = isDeload ? '#60a5fa' : '#a855f7'; return <div key={wi} style={{ padding: '4px 6px', borderRadius: 8, background: isDeload ? 'rgba(96,165,250,0.1)' : `rgba(168,85,247,${0.04 + heat * 0.1})`, border: `1px solid ${isDeload ? 'rgba(96,165,250,0.3)' : `rgba(168,85,247,${0.1 + heat * 0.2})`}`, minWidth: 72 }}><div style={{ fontSize: 8, fontWeight: 700, color: acColor, textAlign: 'center', marginBottom: 3 }}>{isDeload ? '🔄 Делод' : `Нед ${wk}`}</div><div style={{ display: 'grid', gridTemplateColumns: `repeat(${manualResult.days.length}, 1fr)`, gap: 2 }}>{manualResult.days.map((_, di2) => <div key={di2} style={{ height: 18, borderRadius: 3, background: isDeload ? 'rgba(96,165,250,0.3)' : `rgba(0,230,138,${0.15 + heat * 0.35})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 7, color: isDeload ? '#fff' : 'rgba(255,255,255,0.6)' }}>{isDeload ? '—' : `Д${di2 + 1}`}</span></div>)}</div><div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginTop: 2 }}><div style={{ height: '100%', width: isDeload ? '40%' : Math.round(heat * 100) + '%', borderRadius: 2, background: isDeload ? '#60a5fa' : heat > 0.75 ? '#f59e0b' : ACCENT }} /></div></div>; })}
            </div></div>
          </div>}

          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {manualResult.days.map((d, di) => (
              <div key={d.day} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(0,230,138,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>🏋️ День {d.day}</span>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: ACCENT, fontWeight: 700 }}>{d.groups.join(' · ')}</span>
                    <button onClick={() => copyDay(di)} title="Копировать день" style={{ padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>📋</button>
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '14px 1.8fr 0.7fr 0.7fr 0.5fr 0.5fr 0.5fr 0.7fr', gap: 2, padding: '4px 10px', fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                  <span></span><span>Упражнение</span><span>С×П</span><span>RIR</span><span>Вес</span><span>Группа</span><span>Отдых</span><span>Действия</span>
                </div>
                {d.exercises.map((e, ei) => {
                  const tempoKey = `${di}-${ei}`;
                  const overrideTempo = exerciseTempos[tempoKey];
                  const tmpo = overrideTempo ? { tempo: { toString: overrideTempo } } : generateRepTempo({ goal: goal === 'strength' ? 'strength' : 'hypertrophy', riskLevel: 'low', difficultyLevel: 'medium', techniqueIssues: [], isMainLift: ei === 0 });
                  return (
                    <div key={ei} draggable onDragStart={ev => handleDragStart(ev, di, ei)} onDragOver={handleDragOver} onDrop={ev => handleDrop(ev, di, ei)} onDragEnd={() => setDragFrom(null)} style={{ display: 'grid', gridTemplateColumns: '14px 1.8fr 0.7fr 0.7fr 0.5fr 0.5fr 0.5fr 0.7fr', gap: 2, padding: '5px 10px', fontSize: 10, color: 'rgba(255,255,255,0.85)', borderTop: '1px solid rgba(255,255,255,0.04)', background: dragFrom?.dayIdx === di && dragFrom?.exIdx === ei ? 'rgba(0,230,138,0.1)' : 'transparent', cursor: 'grab', alignItems: 'center' }}>
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', cursor: 'grab', userSelect: 'none' }}>⠿</span>
                      <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        {e.name}
                        <span onClick={(ev: React.MouseEvent) => { ev.stopPropagation(); setTempoPicker({ dayIdx: di, exIdx: ei }); }} title="Сменить темп" style={{ fontSize: 7, color: '#a855f7', fontWeight: 700, background: 'rgba(168,85,247,0.1)', padding: '1px 5px', borderRadius: 4, whiteSpace: 'nowrap', cursor: 'pointer', border: overrideTempo ? '1px solid #a855f7' : '1px solid transparent' }}>{overrideTempo || tmpo.tempo.toString}{overrideTempo ? ' *' : ''}</span>
                      </span>
                      <span onClick={() => startInline(di, ei, 'sets', e.sets)} style={{ cursor: 'text', color: ACCENT, fontWeight: 700 }}>{e.sets}×{e.reps}</span>
                      <span onClick={() => startInline(di, ei, 'rir', e.rir)} style={{ cursor: 'text', color: '#f59e0b' }}>{e.rir}</span>
                      <span onClick={() => startInline(di, ei, 'weight', e.weight)} style={{ cursor: 'text', color: '#60a5fa', fontWeight: 700 }}>{e.weight} кг</span>
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>{GROUP_RU[e.group] || e.group}</span>
                      <span onClick={() => startInline(di, ei, 'rest', e.rest)} style={{ cursor: 'text', color: 'rgba(255,255,255,0.6)' }}>{e.rest}с</span>
                      <span style={{ display: 'flex', gap: 2 }}>
                        <button onClick={(ev: React.MouseEvent) => { ev.stopPropagation(); openSubstitute(di, ei); }} title="Замена" style={{ padding: '2px 5px', borderRadius: 4, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: ACCENT, cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>🔄</button>
                        <button onClick={(ev: React.MouseEvent) => { ev.stopPropagation(); const k = window.prompt('Шаблон (5×5, 3×8, 4×10, 3×12, AMRAP, Myo-rep, 10×10 GVT, 5/3/1):', '5×5'); if (k && SET_TEMPLATES[k]) applySetTemplate(di, ei, k); }} title="Шаблон" style={{ padding: '2px 5px', borderRadius: 4, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>⚡</button>
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Modals */}
          {subModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setSubModal(null)}>
              <div onClick={ev => ev.stopPropagation()} style={{ background: '#18181b', border: '1px solid rgba(0,230,138,0.3)', borderRadius: 14, padding: 16, maxWidth: 460, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT, marginBottom: 8 }}>🔄 Подобрать замену</div>
                {subModal.options.length === 0 ? <div style={{ fontSize: 11, color: DIM }}>Нет доступных замен для этого упражнения.</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{subModal.options.map(o => <button key={o.id} onClick={() => applySubstitute(o.id)} style={{ textAlign: 'left', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{o.name}</div><div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{o.reason}</div></button>)}</div>}
                <button onClick={() => setSubModal(null)} style={{ marginTop: 10, width: '100%', padding: 9, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>Закрыть</button>
              </div>
            </div>
          )}

          {improveModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setImproveModal(null)}>
              <div onClick={ev => ev.stopPropagation()} style={{ background: '#18181b', border: '1px solid rgba(0,230,138,0.3)', borderRadius: 14, padding: 16, maxWidth: 480, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT, marginBottom: 8 }}>🎯 Улучшить программу</div>
                <div style={{ fontSize: 10, color: DIM, marginBottom: 10 }}>Рекомендации по балансу объёма, слабым группам и перетренированности:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>{improveModal.notes.map((n, i) => <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', borderLeft: '2px solid ' + ACCENT }}>{n}</div>)}</div>
                <div style={{ display: 'flex', gap: 8 }}><button onClick={() => setImproveModal(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>Отмена</button><button onClick={improveModal.apply} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', cursor: 'pointer', fontWeight: 800, fontSize: 11 }}>Применить</button></div>
              </div>
            </div>
          )}

          {inlineEdit && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} onClick={() => setInlineEdit(null)}>
              <div onClick={ev => ev.stopPropagation()} style={{ background: '#18181b', border: '1px solid rgba(0,230,138,0.3)', borderRadius: 14, padding: 16, minWidth: 220 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>✏️ Изменить {inlineEdit.field}</div>
                <input ref={inlineRef} type={inlineEdit.field === 'reps' ? 'text' : 'number'} value={inlineEdit.value} onChange={e2 => setInlineEdit({ ...inlineEdit, value: e2.target.value })} onKeyDown={e2 => { if (e2.key === 'Enter') commitInline(); if (e2.key === 'Escape') setInlineEdit(null); }} style={{ width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: '#222', color: '#fff', fontSize: 13, outline: 'none' }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}><button onClick={() => setInlineEdit(null)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 11 }}>Отмена</button><button onClick={commitInline} style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>✓ Сохранить</button></div>
              </div>
            </div>
          )}

          {tempoPicker && (() => {
            const presets = [{ label: 'Стандартный (2-0-1-0)', tempo: '2-0-1-0' }, { label: 'Гипертрофия (3-1-1-0)', tempo: '3-1-1-0' }, { label: 'Силовой (2-1-1-0)', tempo: '2-1-1-0' }, { label: 'Взрывной (1-0-0-0)', tempo: '1-0-0-0' }, { label: 'Медленный TUL (4-2-2-1)', tempo: '4-2-2-1' }, { label: 'Адаптивный (3-0-1-0)', tempo: '3-0-1-0' }, { label: 'Растяжение (2-3-1-0)', tempo: '2-3-1-0' }, { label: 'Авто (убрать)', tempo: '' }];
            return (
              <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} onClick={() => setTempoPicker(null)}>
                <div onClick={ev => ev.stopPropagation()} style={{ background: '#18181b', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 14, padding: 16, minWidth: 280, maxWidth: '90vw' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#a855f7', marginBottom: 10 }}>⏱️ Темп упражнения</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {presets.map(p => {
                      const k = `${tempoPicker.dayIdx}-${tempoPicker.exIdx}`;
                      return <button key={p.tempo} onClick={() => { if (p.tempo) { setExerciseTempos(prev => ({ ...prev, [k]: p.tempo })); } else { setExerciseTempos(prev => { const nv = { ...prev }; delete nv[k]; return nv; }); } setTempoPicker(null); }} style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: '1px solid ' + (exerciseTempos[k] === p.tempo ? '#a855f7' : 'rgba(255,255,255,0.08)'), background: exerciseTempos[k] === p.tempo ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>{p.label}</button>;
                    })}
                  </div>
                  <button onClick={() => setTempoPicker(null)} style={{ width: '100%', marginTop: 8, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 10 }}>Отмена</button>
                </div>
              </div>
            );
          })()}

          {/* Качество плана */}
          {quality && (
            <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(0,230,138,0.04)', border: '1px solid ' + (quality.score >= 85 ? '#22c55e' : quality.score >= 65 ? '#eab308' : '#ef4444') + '33' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: quality.score >= 85 ? '#22c55e' : quality.score >= 65 ? '#eab308' : '#ef4444' }}>🎯 Качество плана</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: quality.score >= 85 ? '#22c55e' : quality.score >= 65 ? '#eab308' : '#ef4444' }}>{quality.score}/100</span>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                {quality.over.length === 0 ? '✅ Объём в пределах MRV. ' : '⚠ Превышение MRV: ' + quality.over.map((g: string) => (GROUP_RU[g] || g) + ' ' + quality.wk[g]).join(', ') + '. '}
                {tprofile.weakPoints.length === 0 ? '' : (quality.weakMissed.length === 0 ? '✅ Слабые группы покрыты. ' : '⚠ Слабые группы без объёма: ' + quality.weakMissed.map((g: string) => GROUP_RU[g] || g).join(', ') + '. ')}
                Всего сетов/нед: {Object.values(quality.wk).reduce((a: number, b: number) => a + b, 0)}.
              </div>
              {quality.groups.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Объём по группам (MEV / MAV / MRV)</div>
                  {quality.groups.map((g: string) => {
                    const v = getVolumeByMuscle(g);
                    const lvlKey = (level === 'enhanced' ? 'advanced' : level) as 'beginner' | 'intermediate' | 'advanced';
                    const ld = v ? v[lvlKey] : undefined;
                    const sets = quality.wk[g];
                    const mev = ld?.mev ?? 0; const mav = ld?.mav ?? 0; const gmrv = ld?.mrv ?? Math.round(quality.mrvBase);
                    const color = sets === 0 ? '#ef4444' : sets < mev ? '#f59e0b' : sets <= mav ? '#22c55e' : sets <= gmrv ? '#eab308' : '#ef4444';
                    const label = sets === 0 ? 'нет' : sets < mev ? 'ниже MEV' : sets <= mav ? 'зона MAV' : sets <= gmrv ? 'выше MAV' : '>MRV!';
                    return (
                      <div key={g} style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.4fr 0.7fr 0.6fr 0.8fr', gap: 4, fontSize: 9, color: 'rgba(255,255,255,0.8)', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700 }}>{GROUP_RU[g] || g}</span>
                        <span style={{ color: DIM, textAlign: 'center' }}>{sets}</span>
                        <span style={{ color: DIM, fontSize: 8 }}>{mev}/{mav}/{gmrv}</span>
                        <span style={{ color, fontWeight: 700 }}>{label}</span>
                        <span style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: Math.min(100, Math.round((sets / Math.max(gmrv, 1)) * 100)) + '%', borderRadius: 3, background: color }} /></span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <button onClick={savePlan} style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid rgba(0,230,138,0.2)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>💾 Сохранить в «Мои тренировки»</button>
          <button onClick={improveProgram} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>🎯 Улучшить программу</button>
          <button onClick={recalcWeightsByLevel} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.08)', color: '#60a5fa', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>🔄 Пересчитать веса</button>
          <button onClick={saveAsTemplate} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>📂 Сохранить как шаблон</button>
          <button onClick={exportManualPlanText} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)', color: '#60a5fa', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>{planCopied ? '✓ Скопировано в буфер' : '📋 Копировать план (текст)'}</button>
          <button onClick={printManualPlan} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>🖨 Печать / PDF</button>
          <button onClick={exportFullReport} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'linear-gradient(135deg,rgba(0,230,138,0.12),rgba(0,200,80,0.06))', color: ACCENT, cursor: 'pointer', fontSize: 11, fontWeight: 800 }}>📄 Отчёт по блоку (PDF)</button>
          <button onClick={() => { setManualResult(null); setComparePlan(null); }} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>✕ Сбросить результат</button>
          <button onClick={manualToRuntime} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid ' + ACCENT, background: 'rgba(0,230,138,0.08)', color: ACCENT, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>▶ К выполнению (SessionPlayer)</button>
          {(manualCfg.intensity || manualCfg.technique || manualCfg.volume) && <button onClick={applyMethodicToPlan} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>🔧 Применить методику к плану</button>}
        </div>
      )}

      {/* Сохранённые программы */}
      {(() => { const plans = manualSavedPlans.filter((p: any) => p && p.days); if (plans.length === 0) return null; return <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}><div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>📁 Сохранённые программы ({plans.length})</div>{plans.map((p: any, i: number) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, padding: '5px 8px', marginBottom: 4, borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}><span style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>{p.name} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>· {p.date} · {p.days?.length} дн</span></span><span style={{ display: 'flex', gap: 4 }}><button onClick={() => loadManualPlan(p)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: ACCENT, cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>↩ Загрузить</button><button onClick={() => setComparePlan(p)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>⚖ Сравнить</button><button onClick={() => { try { const ex = JSON.parse(localStorage.getItem('myTrainingPlans') || '[]'); const upd = ex.filter((x: any, j: number) => j !== i); localStorage.setItem('myTrainingPlans', JSON.stringify(upd)); refreshManualSaved(); } catch {} }} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 9 }}>✕</button></span></div>)}</div>; })()}

      {/* Шаблоны */}
      {(() => { const tpls = manualTemplates.filter((p: any) => p && p.days); if (tpls.length === 0) return null; return <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)' }}><div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>📂 Шаблоны ({tpls.length})</div>{tpls.map((p: any, i: number) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, padding: '5px 8px', marginBottom: 4, borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}><span style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>{p.name} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>· {p.date} · {p.days?.length} дн</span></span><span style={{ display: 'flex', gap: 4 }}><button onClick={() => loadManualPlan(p)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>↩ Загрузить</button><button onClick={() => deleteTemplate(i)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 9 }}>✕</button></span></div>)}</div>; })()}

      {/* Сравнение */}
      {comparePlan && manualResult && compareStats && (
        <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}><span style={{ fontSize: 11, fontWeight: 800, color: '#a855f7' }}>⚖ Сравнение: текущий vs «{comparePlan.name}»</span><button onClick={() => setComparePlan(null)} style={{ fontSize: 9, border: 'none', background: 'transparent', color: DIM, cursor: 'pointer' }}>✕</button></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr 0.6fr', gap: 2, fontSize: 8, fontWeight: 700, color: DIM }}><span>Группа</span><span>Текущий</span><span>Сохранённый</span></div>
          {compareStats.allG.map((g: string) => { const a = compareStats.cur[g] || 0, b = compareStats.cmp[g] || 0; const diff = a - b; return <div key={g} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr 0.6fr', gap: 2, fontSize: 10, color: 'rgba(255,255,255,0.85)', padding: '3px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}><span style={{ fontWeight: 600 }}>{GROUP_RU[g] || g}</span><span style={{ color: ACCENT }}>{a} {diff !== 0 && <span style={{ fontSize: 7, color: diff > 0 ? '#ef4444' : '#3b82f6' }}>({diff > 0 ? '+' : ''}{diff})</span>}</span><span style={{ color: DIM }}>{b}</span></div>; })}
          <div style={{ fontSize: 9, color: DIM, marginTop: 4 }}>Всего: текущий {compareStats.curTotal} / сохранённый {compareStats.cmpTotal}</div>
        </div>
      )}

      {/* Пошаговый мастер (свёрнут) */}
      <button onClick={() => setShowWizard(w => !w)} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px dashed rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.04)', color: ACCENT, cursor: 'pointer', fontSize: 11, fontWeight: 700, marginBottom: 10, marginTop: 10 }}>
        {showWizard ? '▲ Скрыть пошаговый мастер' : '▼ Расширенный пошаговый мастер'}
      </button>
      {showWizard && <div style={{ fontSize: 10, color: DIM, padding: 8, textAlign: 'center' }}>Пошаговый мастер переехал в отдельную вкладку. Используйте основной конструктор выше для быстрой сборки.</div>}
    </div>
  );
};

export default ManualConstructor;

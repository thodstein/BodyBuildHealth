import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { EXERCISE_CATALOG, getExercisesByGroup } from '../../core/exercise-catalog';
import { calcTraining, calcExercisePrescription, EXERCISE_DB, TRAINING_SPLITS, TRAINING_LEVEL_CONFIGS, LEVEL_VOLUMES } from '../../engines/training.engine';
import { generateMacrocycle, generateBlockPlan, getCurrentWeekPlan, BLOCK_SEQUENCES, type MacrocyclePlan, type Microcycle, type MacrocycleInput } from '../../engines/training-periodization.engine';
import { selectSplit, getSplitOptions, type SplitCandidate } from '../../engines/split-selector.engine';
import { selectProgressionRule } from '../../engines/progression.engine';
import { RIR_MATRIX, generateWeeklyPlan } from '../../engines/rir-matrix.engine';
import { StrengthDiary, type StrengthStats, type WeeklyProgress, type ProgressionAlert } from '../../engines/strength-diary.engine';
import type { WorkoutLog } from '../../core/types';
import { generateWarmup } from '../../engines/warmup.engine';
import { generateCooldown } from '../../engines/cooldown.engine';
import { selectSetScheme } from '../../engines/set-scheme.engine';
import { selectTempo, formatTempo } from '../../engines/tempo.engine';
import { useDataLink } from '../../core/data-link';
import type { TrainingInput, TrainingOutput, Exercise, MovementPattern } from '../../core/types';
import { computeAnalytics, type AnalyticsSnapshot, type WeeklyBreakdown } from '../../engines/analytics-engine';
import { computeConstraints } from '../../engines/training-constraints.engine';
import { generatePeriodization, getPhaseParams } from '../../engines/cycle-periodization.engine';
import { getTrainingMethods, getMethodsByCategory, getVolumeReferences, getVolumeByMuscle, getSplitVisuals, type TrainingMethod } from '../../engines/training-methodology.engine';
import { buildVisualDashboard, computeWeeklyChart, computeMuscleVolume, computeProgression, type VizSessionData } from '../../engines/training-visualization.engine';
import { getProgramById, getProgramsByGoal, FULL_PROGRAM_LIBRARY } from '../../engines/complete-program-library.engine';
import { generateWeeklyReport, analyzeMeasurements, loadMeasurements, saveMeasurement, type BodyMeasurement } from '../../engines/log-analytics-progression.engine';
import { getExerciseBio } from '../../data/exercise-biomechanics-db';
import { getStrengthLevel, getNextLevelTarget } from '../../engines/performance-analytics.engine';
import { computeStructuredAnalytics } from '../../engines/structured-analytics.engine';
import { SRCBBScreen } from './SRCBBScreen';

import {
  WARMUP_LABELS, GOALS, LEVELS, MUSCLE_GROUPS, GROUP_LABELS, EQUIP_LABELS, JOINT_LABELS,
  PHASE_LABELS, PHASE_HINTS, TAB_GROUPS, TAB_LABELS,
  type TrainingTab, type TrainingPage, type TrainingGroup,
  type PlanningTrack, getPlanningTrack, setPlanningTrack, planningTabsFor,
} from './TrainingScreen_parts/shared';
import { hapticImpact } from '../../core/telegram';
import { InfoErrorBoundary } from './SupportScreen_parts/SupportScreenData';

export const TrainingScreen: React.FC = () => {
  const linked = useDataLink();
  const readiness = linked.readiness;
  const labAnalysis = linked.labAnalysis;
  const diary = useMemo(() => new StrengthDiary(), []);
  // Р­С‚Р°Рї R: СЂРµР¶РёРј РїР»Р°РЅРёСЂРѕРІР°РЅРёСЏ (СѓСЃС‚СЂР°РЅСЏРµС‚ РґСѓР±Р»Рё РїСЂРѕРіСЂР°РјРј РЎР Р¦/BB в†” РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ, AGENTS.md Р±Р°Рі #1)
  const [planningTrack, setPlanningTrackState] = useState<PlanningTrack>(getPlanningTrack());
  const [tab, setTab] = useState<TrainingTab>(getPlanningTrack() === 'manual' ? 'plan' : 'srcbb');
  const [page, setPage] = useState<TrainingPage>('hero');
  const [mainGroup, setMainGroup] = useState<TrainingGroup>(null);
  // Р­С„С„РµРєС‚РёРІРЅС‹Рµ РіСЂСѓРїРїС‹ РІРєР»Р°РґРѕРє: В«РџР»Р°РЅРёСЂРѕРІР°РЅРёРµВ» Р·Р°РІРёСЃРёС‚ РѕС‚ СЂРµР¶РёРјР° (РІР·Р°РёРјРѕРёСЃРєР»СЋС‡Р°СЋС‰РёРµ РЅР°Р±РѕСЂС‹ вЂ” РЅРµС‚ РґСѓР±Р»РµР№)
  const TAB_GROUPS_EFF: typeof TAB_GROUPS = {
    ...TAB_GROUPS,
    planning: { ...TAB_GROUPS.planning, tabs: planningTabsFor(planningTrack) },
  };
  const switchPlanningTrack = (t: PlanningTrack) => {
    setPlanningTrack(t);
    setPlanningTrackState(t);
    const visible = planningTabsFor(t);
    if (mainGroup === 'planning' && !visible.includes(tab)) setTab(visible[0]);
  };

  // Plan state вЂ” pre-fill from readiness and labAnalysis
  const [goal, setGoal] = useState('bulk');
  const [level, setLevel] = useState('intermediate');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [splitType, setSplitType] = useState('auto');
  const [splitCandidates, setSplitCandidates] = useState<SplitCandidate[]>([]);
  const [showSplitPicker, setShowSplitPicker] = useState(false);
  const [cycleType, setCycleType] = useState('auto');
  const [periodizationType, setPeriodizationType] = useState<'auto' | 'linear' | 'undulating' | 'block' | 'conjugate'>('auto');
  const [mesoLength, setMesoLength] = useState(12);
  const [recovery, setRecovery] = useState(Math.round((readiness?.recovery ?? 70) / 10));
  const [fatigue, setFatigue] = useState(Math.round((readiness?.fatigue ?? 30) / 10));
  const [weakPoints, setWeakPoints] = useState<string[]>([]);
  const [myCycleMsg, setMyCycleMsg] = useState('');
  const [cyclesError, setCyclesError] = useState<string | null>(null);
  const [bodyWeight, setBodyWeight] = useState(80);
  const [sleepHours, setSleepHours] = useState(linked.profile?.settings?.baselineSleepHours ?? 7);
  const [stressLevel, setStressLevel] = useState(linked.profile?.settings?.baselineStressLevel ?? 5);
  const [tprofile, updateTProfile] = useTrainingProfile();
  // РЎРёРЅС…СЂРѕРЅРёР·РёСЂСѓРµРј Р»РѕРєР°Р»СЊРЅС‹Рµ СЃРѕСЃС‚РѕСЏРЅРёСЏ РёР· РµРґРёРЅРѕРіРѕ РїСЂРѕС„РёР»СЏ (РїСЂРѕС„РёР»СЊ вЂ” РјР°СЃС‚РµСЂ РґР»СЏ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂР°)
  useEffect(() => { setGoal(tprofile.goal); setLevel(tprofile.level); setDaysPerWeek(tprofile.daysPerWeek); setRecovery(tprofile.recovery); setFatigue(tprofile.fatigue); setWeakPoints(tprofile.weakPoints); setBodyWeight(tprofile.bodyWeight); setSleepHours(tprofile.sleepHours); setStressLevel(tprofile.stressLevel); }, [tprofile]);
  const [customExercises, setCustomExercises] = useState<{ name: string; sets: number; reps: number; rir: number }[]>(() => { try { return JSON.parse(localStorage.getItem('myTrainingExercises') || '[]'); } catch { return []; } });
  const [lastAddedEx, setLastAddedEx] = useState<string | null>(null);
  const [trainingOutput, setTrainingOutput] = useState<TrainingOutput | null>(null);
  const [macrocycle, setMacrocycle] = useState<MacrocyclePlan | null>(() => { try { return JSON.parse(localStorage.getItem('he_macro_session') || 'null'); } catch { return null; } });
  useEffect(() => { try { localStorage.setItem('he_macro_session', JSON.stringify(macrocycle)); } catch {} }, [macrocycle]);
  const [trainingReportGenerated, setTrainingReportGenerated] = useState(false);
  useEffect(() => { try { if (localStorage.getItem('he_training_report_current')) setTrainingReportGenerated(true); } catch {} }, []);
  const [trainingArchive, setTrainingArchive] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_training_reports') || '[]'); } catch { return []; }
  });
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [currentMicrocycle, setCurrentMicrocycle] = useState<Microcycle | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [expandedMeso, setExpandedMeso] = useState<number | null>(null);
  // Р­С‚Р°Рї U: РјРµС‚РѕРґРёРєРё вЂ” РїРѕ РѕРґРЅРѕР№ РёР· РєР°Р¶РґРѕР№ РєР°С‚РµРіРѕСЂРёРё (Р±С‹Р»Рѕ: РѕРґРЅР° СЃС‚СЂРѕРєР° total)
  const [appliedMethods, setAppliedMethods] = useState<Record<string, string>>({});
  const appliedMethod = Object.values(appliedMethods)[0] || null; // Р±СЌРєРІРѕСЂРґ-СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ

  // Exercise DB state
  const [exSearch, setExSearch] = useState('');
  const [exGroup, setExGroup] = useState('all');
  const [exType, setExType] = useState('all');
  const [exEquipment, setExEquipment] = useState('all');
  const [selectedEx, setSelectedEx] = useState<Exercise | null>(null);

  // Calculator state
  const [calcWeight, setCalcWeight] = useState(100);
  const [calcReps, setCalcReps] = useState(5);
  const [calcRPE, setCalcRPE] = useState(8);
  const [calc1RM, setCalc1RM] = useState(100);
  const [calcPercent, setCalcPercent] = useState(75);
  const [plSquat, setPlSquat] = useState(140);
  const [plBench, setPlBench] = useState(100);
  const [plDeadlift, setPlDeadlift] = useState(180);
  const [plWeight, setPlWeight] = useState(80);
  const [plSex, setPlSex] = useState<'male' | 'female'>('male');
  const [bmiWeight, setBmiWeight] = useState(70);
  const [bmiHeight, setBmiHeight] = useState(175);
  const [bmiResult, setBmiResult] = useState<number | null>(null);
  const [bmrWeight, setBmrWeight] = useState(70);
  const [bmrHeight, setBmrHeight] = useState(175);
  const [bmrAge, setBmrAge] = useState(25);
  const [bmrSex, setBmrSex] = useState<'male' | 'female'>('male');
  const [bmrResult, setBmrResult] = useState<number | null>(null);
  const [bmrKmWeight, setBmrKmWeight] = useState(70);
  const [bmrKmBodyFat, setBmrKmBodyFat] = useState(15);
  const [bmrKmResult, setBmrKmResult] = useState<number | null>(null);
  const [tdeeBmr, setTdeeBmr] = useState(1700);
  const [tdeePal, setTdeePal] = useState(1.55);
  const [tdeeResult, setTdeeResult] = useState<number | null>(null);
  const [gripKg, setGripKg] = useState(45);
  const [gripSex, setGripSex] = useState<'male' | 'female'>('male');
  const [gripAge, setGripAge] = useState(30);
  const [gripResult, setGripResult] = useState<{ percentile: number; level: string } | null>(null);
  const [hrvValue, setHrvValue] = useState(50);
  const [stressResult, setStressResult] = useState<{ stress: number; level: string } | null>(null);

  // Exercise Calculator state
  const [exCalcGroup, setExCalcGroup] = useState('');
  const [exCalcType, setExCalcType] = useState('');
  const [exCalcEquip, setExCalcEquip] = useState('');

  // Unified program builder state
  const [builderStep, setBuilderStep] = useState(1);
  const [manualCfg, setManualCfg] = useState<Record<string, string>>({});
  const setManual = (k: string, v: string) => setManualCfg(p => ({ ...p, [k]: v }));
  const [showWizard, setShowWizard] = useState(false);
  const [manualWorkMax, setManualWorkMax] = useState<Record<string, number>>({ chest: 100, back: 110, legs: 140, shoulders: 60, arms: 50, core: 60 });
  const setManualWm = (k: string, v: number) => setManualWorkMax(p => ({ ...p, [k]: v }));
  const PCT_FOR_RIR_MAN: Record<number, number> = { 0: 1.0, 1: 0.96, 2: 0.92, 3: 0.88, 4: 0.84, 5: 0.80 };
  const [manualResult, setManualResult] = useState<{ splitName: string; corrections: string[]; days: { day: number; groups: string[]; exercises: { name: string; sets: number; reps: string; rir: number; rest: number; group: string; weight: number }[] }[] } | null>(null);
  const [manualSavedPlans, setManualSavedPlans] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('myTrainingPlans') || '[]'); } catch { return []; } });
  const loadManualPlan = (plan: any) => { if (plan?.cfg) setManualCfg(plan.cfg); if (plan?.days) setManualResult({ splitName: plan.name || 'Р—Р°РіСЂСѓР¶РµРЅРЅС‹Р№ РїР»Р°РЅ', corrections: plan.corrections || [], days: plan.days }); };
  const refreshManualSaved = () => { try { setManualSavedPlans(JSON.parse(localStorage.getItem('myTrainingPlans') || '[]')); } catch { setManualSavedPlans([]); } };
  const [comparePlan, setComparePlan] = useState<any | null>(null);
  const [planCopied, setPlanCopied] = useState(false);
  const applyMethodicToPlan = () => { if (!manualResult) return; const corr: string[] = []; const name = manualCfg.intensity || manualCfg.technique || manualCfg.volume || ''; if (!name) { corr.push('Р’С‹Р±РµСЂРёС‚Рµ РјРµС‚РѕРґРёРєСѓ (РРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ/РўРµС…РЅРёРєР°/РћР±СЉС‘Рј), С‡С‚РѕР±С‹ РїСЂРёРјРµРЅРёС‚СЊ Рє РїР»Р°РЅСѓ.'); setManualResult({ ...manualResult, corrections: [...manualResult.corrections, ...corr] }); return; } const days = manualResult.days.map(d => ({ ...d, exercises: d.exercises.map(e => { const wm = tprofile.workMax[e.group] || 80; let ne = { ...e }; if (/10Г—10|GVT|German Volume/i.test(name)) { ne = { ...e, sets: 10, reps: '10', weight: Math.round(wm * 0.6), rir: 3, rest: 90 }; corr.push(e.name + ': в†’ 10Г—10 @60% (GVT)'); } else if (/Cluster 5Г—5|РљР»Р°СЃС‚РµСЂ/i.test(name)) { ne = { ...e, sets: 5, reps: '5', weight: Math.round(wm * 0.85), rir: 1, rest: 180 }; corr.push(e.name + ': в†’ 5Г—5 РєР»Р°СЃС‚РµСЂР°РјРё @85% (RIR 1)'); } else if (/Rest-Pause/i.test(name)) { ne = { ...e, sets: 1, reps: 'РґРѕ РѕС‚РєР°Р·Р° +3-5', weight: Math.round(wm * 0.8), rir: 0, rest: 180 }; corr.push(e.name + ': в†’ 1 РїРѕРґС…РѕРґ rest-pause @80% РґРѕ РѕС‚РєР°Р·Р° + РјРёРЅРё-СЃРµС‚С‹'); } else if (/Tempo|РўРµРјРї/i.test(name)) { ne = { ...e, weight: Math.round(wm * 0.7), rir: 2, rest: 60 }; corr.push(e.name + ': в†’ С‚РµРјРї 3-1-1-0, РІРµСЃ СЃРЅРёР¶РµРЅ РґРѕ 70%, РѕС‚РґС‹С… 60СЃ'); } else if (/Drop|Р”СЂРѕРї/i.test(name)) { ne = { ...e, rir: 0, rest: 90 }; corr.push(e.name + ': в†’ РїРѕСЃР»РµРґРЅРёР№ РїРѕРґС…РѕРґ РґРѕ РѕС‚РєР°Р·Р° + 2 РґСЂРѕРїР° в€’20%'); } else { corr.push(e.name + ': РјРµС‚РѕРґРёРєР° В«' + name + 'В» РїСЂРёРјРµРЅРµРЅР° РєРѕРЅС†РµРїС‚СѓР°Р»СЊРЅРѕ (РІРµСЃ/РѕР±СЉС‘Рј Р±РµР· Р°РІС‚Рѕ-РёР·РјРµРЅРµРЅРёСЏ вЂ” РѕС‚СЂРµРґР°РєС‚РёСЂСѓР№С‚Рµ РІСЂСѓС‡РЅСѓСЋ)'); } return ne; }) })); corr.unshift('РџСЂРёРјРµРЅРµРЅР° РјРµС‚РѕРґРёРєР°: В«' + name + 'В» Рє ' + days.reduce((s, d) => s + d.exercises.length, 0) + ' СѓРїСЂР°Р¶РЅРµРЅРёСЏРј.'); setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, ...corr] }); };
  const manualToRuntime = () => { if (!manualResult) return; const days: PlayerDay[] = manualResult.days.map(d => ({ label: 'Р”' + d.day, exercises: d.exercises.map(e => ({ name: e.name, muscleGroup: e.group, targetSets: Array.from({ length: e.sets }, () => ({ weight: e.weight, reps: parseInt(e.reps) || 10, rir: e.rir })) })) })); try { localStorage.setItem('he_pl_runtime', JSON.stringify({ days, focus: manualResult.splitName, week: 1, track: 'manual' })); } catch {} setTab('runtime'); };
  const exportFullReport = () => { const la = labTrainingAdjust(linked.labAnalysis); const wk: Record<string, number> = {}; const GRP_RU: Record<string,string> = { chest:'Р“СЂСѓРґСЊ', back:'РЎРїРёРЅР°', legs:'РќРѕРіРё', shoulders:'РџР»РµС‡Рё', arms:'Р СѓРєРё', core:'РљРѕСЂ', full:'РћР±С‰РµРµ' }; if (manualResult) manualResult.days.forEach(d => d.exercises.forEach(e => { wk[e.group] = (wk[e.group] || 0) + e.sets; })); const mrv = ((LEVEL_VOLUMES as Record<string, { mrv: number }>)[level]?.mrv ?? 20) * (tprofile.onCourse ? 1.2 : 1) * la.mrvMultiplier; const total = Object.values(wk).reduce((a,b)=>a+b,0); const rh = loadReadinessHistory().slice(-7); const ms = loadMeasurements().slice(-3); const esc = (s: string) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); const planHtml = manualResult ? manualResult.days.map(d => '<h3>Р”РµРЅСЊ '+d.day+' ('+esc(d.groups.join(', '))+')</h3><table border=1 cellpadding=4 style=border-collapse:collapse;width:100%><tr><th>РЈРїСЂР°Р¶РЅРµРЅРёРµ</th><th>РЎРµС‚С‹Г—РїРѕРІС‚</th><th>RIR</th><th>Р’РµСЃ</th><th>РћС‚РґС‹С…</th></tr>'+d.exercises.map(e => '<tr><td>'+esc(e.name)+'</td><td>'+e.sets+'Г—'+esc(e.reps)+'</td><td>'+e.rir+'</td><td>'+e.weight+' РєРі</td><td>'+e.rest+'СЃ</td></tr>').join('')+'</table>').join('') : '<p>РџР»Р°РЅ РЅРµ РїРѕСЃС‚СЂРѕРµРЅ.</p>'; const corrHtml = manualResult?.corrections?.length ? '<h2>Р–СѓСЂРЅР°Р» РїСЂР°РІРѕРє</h2><ul>'+manualResult.corrections.map(c => '<li>'+esc(c)+'</li>').join('')+'</ul>' : ''; const volRows = Object.keys(wk).length ? Object.entries(wk).map(([g,s]) => '<tr><td>'+esc(GRP_RU[g]||g)+'</td><td>'+s+'</td><td>'+(s>mrv?'вљ  >MRV':'РѕРє')+'</td></tr>').join('') : '<tr><td colspan=3>РЅРµС‚ РґР°РЅРЅС‹С…</td></tr>'; const labHtml = la.warnings.length ? '<h2>Р›Р°Р±РѕСЂР°С‚РѕСЂРЅР°СЏ РєРѕСЂСЂРµРєС†РёСЏ (MRV Г—'+la.mrvMultiplier.toFixed(2)+')</h2><ul>'+la.warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul>' : '<h2>Р›Р°Р±РѕСЂР°С‚РѕСЂРЅР°СЏ РєРѕСЂСЂРµРєС†РёСЏ</h2><p>РЅРµС‚ РґР°РЅРЅС‹С… / РІ РЅРѕСЂРјРµ.</p>'; const rhHtml = rh.length ? '<h2>Р“РѕС‚РѕРІРЅРѕСЃС‚СЊ (РїРѕСЃР»РµРґРЅРёРµ '+rh.length+' РґРЅ)</h2><table border=1 cellpadding=4 style=border-collapse:collapse><tr><th>Р”Р°С‚Р°</th><th>Р“РѕС‚РѕРІРЅРѕСЃС‚СЊ</th><th>РЈСЃС‚Р°Р»РѕСЃС‚СЊ</th></tr>'+rh.map(p=>'<tr><td>'+p.date+'</td><td>'+p.recovery+'%</td><td>'+p.fatigue+'%</td></tr>').join('')+'</table>' : ''; const msHtml = ms.length ? '<h2>Р—Р°РјРµСЂС‹ (РїРѕСЃР»РµРґРЅРёРµ '+ms.length+')</h2><table border=1 cellpadding=4 style=border-collapse:collapse><tr><th>Р”Р°С‚Р°</th><th>Р’РµСЃ</th><th>РўР°Р»РёСЏ</th><th>Р“СЂСѓРґСЊ</th></tr>'+ms.map((m:any)=>'<tr><td>'+m.date+'</td><td>'+m.weightKg+'РєРі</td><td>'+m.waistCm+'СЃРј</td><td>'+m.chestCm+'СЃРј</td></tr>').join('')+'</table>' : ''; const html = '<html><head><meta charset=utf-8><title>РћС‚С‡С‘С‚ С‚СЂРµРЅРёСЂРѕРІРѕС‡РЅРѕРіРѕ Р±Р»РѕРєР°</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#111}h1{color:#008}h2{color:#060;margin-top:16px;border-bottom:1px solid #ccc;padding-bottom:2px}h3{margin-top:12px;color:#333}table{font-size:11px}</style></head><body><h1>РћС‚С‡С‘С‚ С‚СЂРµРЅРёСЂРѕРІРѕС‡РЅРѕРіРѕ Р±Р»РѕРєР°</h1><h2>РџСЂРѕС„РёР»СЊ С‚СЂРµРЅРёСЂРѕРІР°РЅРЅРѕСЃС‚Рё</h2><p>Р¦РµР»СЊ: '+esc(tprofile.goal)+' В· РЈСЂРѕРІРµРЅСЊ: '+esc(tprofile.level)+' В· Р”РЅРµР№/РЅРµРґ: '+tprofile.daysPerWeek+' В· Р’РµСЃ: '+tprofile.bodyWeight+'РєРі<br>РџРњ: РїСЂРёСЃРµРґ '+tprofile.pmSquat+', Р¶РёРј '+tprofile.pmBench+', С‚СЏРіР° '+tprofile.pmDead+' РєРі<br>РљСѓСЂСЃ: '+(tprofile.onCourse?'РґР° ('+tprofile.courseIntensity+')':'РЅР°С‚СѓСЂР°Р»')+' В· РЎР»Р°Р±С‹Рµ РіСЂСѓРїРїС‹: '+esc(tprofile.weakPoints.join(', ')||'вЂ”')+' В· РћР±РѕСЂСѓРґРѕРІР°РЅРёРµ: '+esc(tprofile.equipment.join(', ')||'вЂ”')+'</p>'+(manualResult?'<h2>РџР»Р°РЅ: '+esc(manualResult.splitName)+'</h2>':'') + planHtml + '<h2>РћР±СЉС‘Рј РїРѕ РіСЂСѓРїРїР°Рј (РІСЃРµРіРѕ '+total+' СЃРµС‚РѕРІ, MRV '+Math.round(mrv)+')</h2><table border=1 cellpadding=4 style=border-collapse:collapse><tr><th>Р“СЂСѓРїРїР°</th><th>РЎРµС‚РѕРІ</th><th>РЎС‚Р°С‚СѓСЃ</th></tr>'+volRows+'</table>' + corrHtml + labHtml + rhHtml + msHtml + '<p style=margin-top:20px;color:#888;font-size:10px>РЎРіРµРЅРµСЂРёСЂРѕРІР°РЅРѕ: '+new Date().toLocaleString()+'</p></body></html>'; const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 350); } };
  const printManualPlan = () => { if (!manualResult) return; const rows = manualResult.days.map(d => '<h3>Р”РµРЅСЊ ' + d.day + ' (' + d.groups.join(', ') + ')</h3><table border=1 cellpadding=4 style=border-collapse:collapse;width:100%><tr><th>РЈРїСЂР°Р¶РЅРµРЅРёРµ</th><th>РЎРµС‚С‹Г—РїРѕРІС‚</th><th>RIR</th><th>Р’РµСЃ</th><th>РћС‚РґС‹С…</th></tr>' + d.exercises.map(e => '<tr><td>' + e.name + '</td><td>' + e.sets + 'Г—' + e.reps + '</td><td>' + e.rir + '</td><td>' + e.weight + ' РєРі</td><td>' + e.rest + 'СЃ</td></tr>').join('') + '</table>').join(''); const html = '<html><head><meta charset=utf-8><title>' + manualResult.splitName + '</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#111}h1{color:#008}h3{margin-top:14px;color:#060}table{font-size:12px}</style></head><body><h1>' + manualResult.splitName + '</h1><p>РЈСЂРѕРІРµРЅСЊ: ' + level + ' В· Р¦РµР»СЊ: ' + goal + ' В· ' + daysPerWeek + ' РґРЅ/РЅРµРґ В· ' + mesoLength + ' РЅРµРґ</p>' + rows + '</body></html>'; const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); } };
  const exportManualPlanText = () => { if (!manualResult) return; const lines: string[] = []; lines.push('РўСЂРµРЅРёСЂРѕРІРѕС‡РЅС‹Р№ РїР»Р°РЅ: ' + manualResult.splitName); lines.push('РџР°СЂР°РјРµС‚СЂС‹: ' + Object.entries(manualCfg).filter(([,v]) => v).map(([k,v]) => k + '=' + v).join(', ')); lines.push('РЈСЂРѕРІРµРЅСЊ: ' + level + ' В· Р¦РµР»СЊ: ' + goal + ' В· Р”РЅРµР№/РЅРµРґ: ' + daysPerWeek + ' В· Р”Р»РёРЅР°: ' + mesoLength + ' РЅРµРґ'); lines.push(''); if (manualResult.corrections && manualResult.corrections.length) { lines.push('РљРѕРјРјРµРЅС‚Р°СЂРёРё Рє РїР»Р°РЅСѓ:'); manualResult.corrections.forEach(corr => lines.push('  вЂў ' + corr)); lines.push(''); } manualResult.days.forEach(d => { lines.push('Р”РµРЅСЊ ' + d.day + ' (' + d.groups.join(', ') + ')'); d.exercises.forEach(e => lines.push('  ' + e.name + ' вЂ” ' + e.sets + 'x' + e.reps + ' @ RIR' + e.rir + ' В· ' + e.weight + ' РєРі В· РѕС‚РґС‹С… ' + e.rest + 'СЃ (' + e.group + ')')); lines.push(''); }); const txt = lines.join(String.fromCharCode(10)); try { navigator.clipboard?.writeText(txt); } catch {} setPlanCopied(true); setTimeout(() => setPlanCopied(false), 1800); };
  const detectGroup = (name: string): string => { const n = name.toLowerCase(); if (/squat|РїСЂРёСЃРµРґ|leg|quad|РЅРѕР¶РЅ|РІС‹РїР°Рґ|lunge/.test(n)) return 'legs'; if (/bench|Р¶РёРј|chest|РіСЂСѓРґ|press|РїР»РµС‡|shoulder|delt/.test(n)) return n.includes('shoulder')||/delt|РїР»РµС‡/.test(n) ? 'shoulders' : 'chest'; if (/deadlift|СЃС‚Р°РЅРѕРІ|С‚СЏРіР°|row|pull|СЃРїРёРЅ|back|chin|lat/.test(n)) return 'back'; if (/curl|Р±РёС†РµРї|bicep/.test(n)) return 'arms'; if (/tricep|С‚СЂРёС†РµРї|extension|РїСЂРµСЃСЃ|ab|core/.test(n)) return /РїСЂРµСЃСЃ|ab|core/.test(n) ? 'core' : 'arms'; return 'full'; };
  const loadProgramToConstructor = (programId: string) => { const lib = [...FULL_PROGRAM_LIBRARY, ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS] as any[]; const prog = lib.find(p => p.id === programId); if (!prog || !prog.weeks?.length) return; const wk = prog.weeks[0]; const days = wk.days.map((d: any, di: number) => ({ day: di + 1, groups: Array.from(new Set((d.exercises || []).map((e: any) => detectGroup(e.name)))), exercises: (d.exercises || []).map((e: any) => { const g = detectGroup(e.name); const rir = e.rir ?? (e.rpe ? Math.max(0, 10 - e.rpe) : 2); const pct = PCT_FOR_RIR_MAN[Math.max(0, Math.min(5, rir))] ?? 0.9; const reps = parseInt(e.reps) || (parseInt(String(e.reps).replace(/[^0-9]/g,'')) || 8); const weight = Math.round((tprofile.workMax[g] || 80) * pct); return { name: e.name, sets: e.sets, reps: String(e.reps), rir, rest: e.restSec || 120, group: g, weight }; }) })); const corrections: string[] = []; corrections.push('Р—Р°РіСЂСѓР¶РµРЅР° РіРѕС‚РѕРІР°СЏ РїСЂРѕРіСЂР°РјРјР° В«' + prog.name + 'В» (' + (prog.author || '') + ', ' + prog.goal + ', ' + prog.level + ') вЂ” РЅРµРґРµР»СЏ 1, ' + days.length + ' РґРЅ.'); corrections.push('РџСЂРѕРіСЂР°РјРјР° РґРѕСЃС‚СѓРїРЅР° РґР»СЏ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ, РїСЂРёРјРµРЅРµРЅРёСЏ РјРµС‚РѕРґРёРє Рё РІС‹РїРѕР»РЅРµРЅРёСЏ. Р’РµСЃР° СЂР°СЃСЃС‡РёС‚Р°РЅС‹ РёР· workMaxГ—%1RM(RIR); РѕС‚СЂРµРґР°РєС‚РёСЂСѓР№С‚Рµ РїСЂРё РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚Рё.'); if (prog.warnings?.length) corrections.push('РџСЂРµРґСѓРїСЂРµР¶РґРµРЅРёСЏ РїСЂРѕРіСЂР°РјРјС‹: ' + prog.warnings.join('; ')); setManualResult({ splitName: prog.name + ' (РЅРµРґРµР»СЏ 1)', corrections, days }); };
  const generateManualPlan = () => {
    const corrections: string[] = [];
    const inp = { goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as TrainingInput;
    const auto = selectSplit(inp);
    const manualSp = manualCfg.split ? TRAINING_SPLITS[manualCfg.split] : null;
    const sp = manualSp ? { id: manualCfg.split!, name: manualSp.name, desc: manualSp.desc, groupsPerDay: manualSp.groupsPerDay, score: 100, rationale: ['Р СѓС‡РЅРѕР№ РІС‹Р±РѕСЂ'] } as SplitCandidate : auto[0];
    if (!sp) { setManualResult(null); return; }
    if (manualSp) corrections.push(`РЎРїР»РёС‚ РІС‹Р±СЂР°РЅ РІСЂСѓС‡РЅСѓСЋ: В«${sp.name}В» (РІРјРµСЃС‚Рѕ Р°РІС‚Рѕ-РїРѕРґР±РѕСЂР°).`); else corrections.push(`РЎРїР»РёС‚ РїРѕРґРѕР±СЂР°РЅ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё: В«${sp.name}В».`);
    const cycle: string[][] = []; let gi = 0; while (cycle.length < daysPerWeek) { cycle.push(sp.groupsPerDay[gi % sp.groupsPerDay.length]); gi++; }
    const _labAdj = labTrainingAdjust(linked.labAnalysis);
    const courseMult = tprofile.onCourse ? (tprofile.courseIntensity === 'heavy' ? 1.3 : tprofile.courseIntensity === 'mild' ? 1.15 : 1.2) : 1;
    const baseMrv = (LEVEL_VOLUMES as Record<string, { mrv: number }>)[level]?.mrv ?? 20;
    const mrv = baseMrv * courseMult * _labAdj.mrvMultiplier;
    if (tprofile.onCourse) corrections.push(`MRV РїРѕРІС‹С€РµРЅ РЅР° РєСѓСЂСЃРµ: Р±Р°Р·Р° ${baseMrv} Г— ${courseMult} (РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ РєСѓСЂСЃР°) = ${Math.round(baseMrv * courseMult)}.`);
    if (_labAdj.mrvMultiplier < 1) corrections.push(`MRV СЃРЅРёР¶РµРЅ РїРѕ Р»Р°Р±РѕСЂР°С‚РѕСЂРёРё Г—${_labAdj.mrvMultiplier.toFixed(2)}: ${_labAdj.warnings.join(' ')}`);
    corrections.push(`Р”РѕРїСѓСЃС‚РёРјС‹Р№ РѕР±СЉС‘Рј (MRV): ${Math.round(mrv)} СЃРµС‚РѕРІ/РЅРµРґ РЅР° РіСЂСѓРїРїСѓ.`);
    const weeklySets: Record<string, number> = {};
    const isWeak = (g: string) => weakPoints.includes(g);
    if (weakPoints.length > 0) corrections.push(`РЎР»Р°Р±С‹Рµ РіСЂСѓРїРїС‹ (${weakPoints.join(', ')}): РїСЂРёРѕСЂРёС‚РµС‚ РІ РѕС‚Р±РѕСЂРµ + RIR в†“ (Р±Р»РёР¶Рµ Рє РѕС‚РєР°Р·Сѓ) РґР»СЏ Р°РєС†РµРЅС‚Р°.`);
    if (tprofile.equipment.length > 0) corrections.push(`Р¤РёР»СЊС‚СЂ РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ: С‚РѕР»СЊРєРѕ ${tprofile.equipment.join(', ')}.`);
    const days = cycle.map((groups, di) => {
      const exs: { name: string; sets: number; reps: string; rir: number; rest: number; group: string; weight: number }[] = [];
      groups.forEach(g => {
        const allPool = getExercisesByGroup(g);
        const eqFilter = (e: typeof allPool[number]) => tprofile.equipment.length === 0 || tprofile.equipment.includes(e.equipment);
        const pool = allPool.filter(eqFilter);
        let poolFinal = pool;
        if (tprofile.equipment.length > 0) {
          if (pool.length === 0) { poolFinal = allPool; corrections.push(`Р“СЂСѓРїРїР° В«${g}В»: РЅРµС‚ СѓРїСЂР°Р¶РЅРµРЅРёР№ РїРѕ РІС‹Р±СЂР°РЅРЅРѕРјСѓ РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЋ вЂ” РІР·СЏС‚ РїРѕР»РЅС‹Р№ РєР°С‚Р°Р»РѕРі (Р±РµР· С„РёР»СЊС‚СЂР°).`); }
          else if (pool.length < allPool.length) corrections.push(`Р“СЂСѓРїРїР° В«${g}В»: РёСЃРєР»СЋС‡РµРЅРѕ ${allPool.length - pool.length} СѓРїСЂР°Р¶РЅРµРЅРёР№ Р±РµР· РґРѕСЃС‚СѓРїРЅРѕРіРѕ РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ.`);
        }
        const rank = (e: typeof allPool[number]) => (e.type === 'compound' ? 100 : 0) + (e.equipment === 'barbell' ? 10 : e.equipment === 'dumbbell' ? 5 : 0) + (isWeak(g) ? 5 : 0);
        const compounds = [...poolFinal].filter(e => e.type === 'compound').sort((a, b) => rank(b) - rank(a)).slice(0, 2);
        const isolations = [...poolFinal].filter(e => e.type === 'isolation').sort((a, b) => rank(b) - rank(a)).slice(0, 2);
        const chosen = [...compounds, ...isolations];
        let capped = false;
        for (const ex of chosen) {
          const already = weeklySets[g] || 0;
          if (already >= mrv) { capped = true; break; }
          const pr = calcExercisePrescription(ex, goal, level, isWeak(g), false, 1, 1, mesoLength);
          const wm = (tprofile.workMax[g] || manualWorkMax[g] || 80);
          const pct = PCT_FOR_RIR_MAN[Math.max(0, Math.min(5, pr.rir))] ?? 0.9;
          const weight = Math.round(wm * pct);
          exs.push({ name: ex.name, sets: pr.sets, reps: pr.reps, rir: pr.rir, rest: pr.rest, group: g, weight });
          weeklySets[g] = already + pr.sets;
        }
        if (capped) corrections.push(`Р“СЂСѓРїРїР° В«${g}В»: РѕР±СЉС‘Рј РґРѕСЃС‚РёРі MRV (${Math.round(mrv)}) вЂ” Р»РёС€РЅРёРµ СѓРїСЂР°Р¶РЅРµРЅРёСЏ СѓР±СЂР°РЅС‹ (Р°РЅС‚Рё-РїРµСЂРµС‚СЂРµРЅ).`);
      });
      return { day: di + 1, groups, exercises: exs };
    });
    Object.entries(weeklySets).forEach(([g, s]) => { if (s < Math.max(4, mrv * 0.4) && s > 0) corrections.push(`Р“СЂСѓРїРїР° В«${g}В»: РЅРёР·РєРёР№ РѕР±СЉС‘Рј (${s} СЃРµС‚РѕРІ) вЂ” РЅРёР¶Рµ Р·РѕРЅС‹ Р°РґР°РїС‚Р°С†РёРё, СЂР°СЃСЃРјРѕС‚СЂРёС‚Рµ РґРѕР±РѕСЂ.`); });
    setManualResult({ splitName: sp.name, corrections, days });
  };
  const [builderSplit, setBuilderSplit] = useState<SplitCandidate | null>(null);
  const [builderDayExercises, setBuilderDayExercises] = useState<Record<number, { name: string; sets: number; reps: string; rir: number; rest: number; group: string; type?: string; rpeHint?: string; dropSet?: boolean; backoffSet?: boolean; substitutes?: string[] }[]>>({});
  const [builderMacroResult, setBuilderMacroResult] = useState<any[] | null>(null);
  const [builderShowSubs, setBuilderShowSubs] = useState<string | null>(null);
  const [builderAddExDay, setBuilderAddExDay] = useState<number | null>(null);
  const [generatorSeed, setGeneratorSeed] = useState(Date.now());
  const [builderMesoLength, setBuilderMesoLength] = useState(8);
  const [builderSavedMsg, setBuilderSavedMsg] = useState('');

  // Diary state
  const [diaryStats, setDiaryStats] = useState<StrengthStats[]>([]);
  const [diaryProgress, setDiaryProgress] = useState<WeeklyProgress[]>([]);
  const [logExercise, setLogExercise] = useState('');
  const [logWeight, setLogWeight] = useState(80);
  const [logReps, setLogReps] = useState(8);
  const [logRIR, setLogRIR] = useState(2);
  const [historyWorkouts, setHistoryWorkouts] = useState<WorkoutLog[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState<string | null>(null);

  // Runtime (live workout) state
  const [runtimeDay, setRuntimeDay] = useState<number>(1);
  const [runtimeExIdx, setRuntimeExIdx] = useState(0);
  const [runtimeLogs, setRuntimeLogs] = useState<Record<string, { sets: { weight: number; reps: number; rpe: number; rir: number }[]; completed: boolean }>>({});
  const [runtimeStarted, setRuntimeStarted] = useState(false);
  const [plRuntime, setPlRuntime] = useState<{ days: PlayerDay[]; focus: string; week: number; track: string } | null>(() => { try { const v = localStorage.getItem('he_pl_runtime'); return v ? JSON.parse(v) : null; } catch { return null; } });
  const [plRunOpen, setPlRunOpen] = useState(false);
  useEffect(() => { if (tab === 'runtime') { try { const v = localStorage.getItem('he_pl_runtime'); setPlRuntime(v ? JSON.parse(v) : null); } catch { /* ignore */ } } }, [tab]);
  useEffect(() => { if (linked.readiness) appendReadinessToday(linked.readiness.recovery ?? 70, linked.readiness.fatigue ?? 30); }, [linked.readiness]);
  const [showWarmup, setShowWarmup] = useState(false);
  const [showCooldown, setShowCooldown] = useState(false);
  const [runtimeSetW, setRuntimeSetW] = useState(80);
  const [runtimeSetR, setRuntimeSetR] = useState(8);
  const [runtimeSetRP, setRuntimeSetRP] = useState(7);
  const [runtimeSetRI, setRuntimeSetRI] = useState(2);

  const generatePlan = useCallback((overrideSplitType?: string) => {
    try {
    // U6: РґРµС‚РµСЂРјРёРЅРёСЂРѕРІР°РЅРЅР°СЏ РіРµРЅРµСЂР°С†РёСЏ вЂ” Р±РµР· Math.random-jitter (С†РёРєР»С‹ РІРѕСЃРїСЂРѕРёР·РІРѕРґРёРјС‹ РїСЂРё С‚РµС… Р¶Рµ РїР°СЂР°РјРµС‚СЂР°С…).
    // recovery/fatigue Р±РµСЂС‘Рј РєР°Рє РµСЃС‚СЊ; nutrition вЂ” СЃС‚Р°Р±РёР»СЊРЅРѕРµ Р·РЅР°С‡РµРЅРёРµ (8/10, РїРёС‚Р°РЅРёРµ СѓС‡РёС‚С‹РІР°РµС‚СЃСЏ РѕС‚РґРµР»СЊРЅРѕ).
    const input: TrainingInput = {
      goal, level, daysPerWeek, recovery: Math.max(0, Math.min(100, recovery)), fatigue: Math.max(0, Math.min(100, fatigue)), nutrition: 8,
      weakPoints, sessionDuration: 60, exercises: [],
      splitType: overrideSplitType || splitType,
      periodizationType,
      cycleType,
    };
    const output = calcTraining(input);
    setTrainingOutput(output);

    const macroInput: MacrocycleInput = {
      goal: goal as MacrocycleInput['goal'],
      level: level as MacrocycleInput['level'],
      daysPerWeek,
      readinessScore: recovery / 10,
      isOnCourse: level === 'enhanced',
      weakPoints,
      injuries: [],
      experience: level as MacrocycleInput['experience'],
      currentWeek: 1,
      periodizationType,
      cycleType,
    };
    const macro = periodizationType === 'block' ? generateBlockPlan(macroInput) : generateMacrocycle(macroInput);
    setMacrocycle(macro);
    setSelectedWeek(1);
    setCurrentMicrocycle(getCurrentWeekPlan(macro, 1));
    setCyclesError(null);
    } catch (e) { setCyclesError('РћС€РёР±РєР° РіРµРЅРµСЂР°С†РёРё: ' + String(e)); }
  }, [goal, level, daysPerWeek, recovery, fatigue, weakPoints, splitType, periodizationType, cycleType]);
  // РњРѕСЃС‚ РјР°РєСЂРѕС†РёРєР» -> РІС‹РїРѕР»РЅРµРЅРёРµ (РµРґРёРЅС‹Р№ РїРѕС‚РѕРє С‡РµСЂРµР· SessionPlayer)
  const applyMacroToRuntime = () => {
    if (!currentMicrocycle) return;
    const days: PlayerDay[] = currentMicrocycle.days.filter((d: any) => d.isTraining).map((d: any, i: number) => ({
      label: 'Р”' + (i + 1),
      exercises: (d.exercises || []).map((e: any) => ({
        name: e.name,
        muscleGroup: e.group,
        targetSets: Array.from({ length: e.sets || 3 }, () => ({ weight: Math.round((e.weight || tprofile.workMax[e.group] || 80) * 0.8), reps: parseInt(e.reps) || 10, rir: e.rir ?? 2 })),
      })),
    }));
    try { localStorage.setItem('he_pl_runtime', JSON.stringify({ days, focus: 'РњР°РєСЂРѕС†РёРєР» ' + (currentMicrocycle.mesocycleType || ''), week: selectedWeek, track: 'macro' })); } catch {}
    setTab('runtime');
  };

  // Auto-regenerate when days/sparse
  const loadDiaryStats = async () => {
    try {
      const progress = await diary.getWeeklyProgress();
      setDiaryProgress(progress);
      const compoundIds = EXERCISE_CATALOG.filter(e => e.type === 'compound').slice(0, 10).map(e => e.id);
      const stats: StrengthStats[] = [];
      for (const id of compoundIds) { const s = await diary.getExerciseStats(id); if (s) stats.push(s); }
      setDiaryStats(stats);
      const wLogs = await diary.getWorkoutLogs();
      setHistoryWorkouts(wLogs.reverse());
    } catch {}
  };

  // РџСЂРёРјРµРЅРµРЅРёРµ РєРѕРјРїРѕР·РёС†РёРё РјРµС‚РѕРґРёРє Рє РїР»Р°РЅСѓ (РѕРґРЅР° РёР· РєР°Р¶РґРѕР№ РєР°С‚РµРіРѕСЂРёРё)
  const applyMethodComposition = () => {
    const pm = appliedMethods['periodization'];
    if (pm) {
      const n = pm.toLowerCase();
      const pt = n.includes('linear') ? 'linear' : n.includes('undulating')||n.includes('dup') ? 'undulating' : n.includes('block') ? 'block' : n.includes('conjugate')||n.includes('westside') ? 'conjugate' : null;
      if (pt) setPeriodizationType(pt);
    }
    setTimeout(() => generatePlan(), 120);
  };
  useEffect(() => {
    if (Object.keys(appliedMethods).length > 0) { const tm = setTimeout(() => generatePlan(), 150); return () => clearTimeout(tm); }
  }, [appliedMethods]);

  const prevDays = useRef(daysPerWeek);
  useEffect(() => { loadDiaryStats(); }, []);
  useEffect(() => { if (prevDays.current !== daysPerWeek) { prevDays.current = daysPerWeek; generatePlan(); } }, [daysPerWeek]);
  useEffect(() => { localStorage.setItem('myTrainingExercises', JSON.stringify(customExercises)); }, [customExercises]);

  useEffect(() => {
    if (macrocycle && selectedWeek > 0) {
      setCurrentMicrocycle(getCurrentWeekPlan(macrocycle, selectedWeek));
    }
  }, [macrocycle, selectedWeek]);

  const filteredExercises = useMemo(() => {
    let list = EXERCISE_CATALOG;
    if (exSearch) {
      const q = exSearch.toLowerCase();
      list = list.filter(e => (e.name||'').toLowerCase().includes(q) || (e.id||'').toLowerCase().includes(q) || (e.targetMuscle || '').toLowerCase().includes(q));
    }
    if (exGroup !== 'all') list = list.filter(e => e.group === exGroup);
    if (exType !== 'all') list = list.filter(e => e.type === exType);
    if (exEquipment !== 'all') list = list.filter(e => e.equipment === exEquipment);
    return list;
  }, [exSearch, exGroup, exType, exEquipment]);

  const calcResults = useMemo(() => {
    const epley1RM = calcWeight * (1 + calcReps / 30);
    const brzycki1RM = calcWeight * (36 / (37 - calcReps));
    const rpePercent = Math.max(0.3, 1 - (calcRPE - 1) * 0.03 - (calcReps - 1) * 0.025);
    const rpe1RM = calcWeight / rpePercent;
    const percentWeight = calc1RM * (calcPercent / 100);
    return { epley1RM, brzycki1RM, rpe1RM, percentWeight, rpePercent };
  }, [calcWeight, calcReps, calcRPE, calc1RM, calcPercent]);

  const handleLogWorkout = async () => {
    if (!logExercise) return;
    const ex = EXERCISE_CATALOG.find(e => e.id === logExercise);
    await diary.saveStrengthLog({
      id: `log_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      exerciseId: logExercise,
      exerciseName: ex?.name || logExercise,
      sets: [{ weight: logWeight, reps: logReps, rir: logRIR }],
      totalVolume: logWeight * logReps,
      estimated1RM: logWeight * (1 + logReps / 30),
      isCompound: ex?.type === 'compound',
      weekNumber: selectedWeek,
    });
    // Reload stats
    const compoundIds = EXERCISE_CATALOG.filter(e => e.type === 'compound').slice(0, 10).map(e => e.id);
    const stats: StrengthStats[] = [];
    for (const id of compoundIds) {
      const s = await diary.getExerciseStats(id);
      if (s) stats.push(s);
    }
    setDiaryStats(stats);
    // Also save workout log and reload history
    await diary.saveWorkoutLog({
      id: `workout_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      duration: 60,
      exercises: [{
        id: `log_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        exerciseId: logExercise,
        exerciseName: ex?.name || logExercise,
        sets: [{ weight: logWeight, reps: logReps, rir: logRIR }],
        totalVolume: logWeight * logReps,
        estimated1RM: Math.round(logWeight * (1 + logReps / 30)),
        isCompound: ex?.type === 'compound',
        weekNumber: selectedWeek,
      }],
      overallRPE: 7,
      recoveryBefore: recovery,
      split: trainingOutput?.splitName || 'custom',
      weekNumber: selectedWeek,
    });
    const wLogs = await diary.getWorkoutLogs();
    setHistoryWorkouts(wLogs.reverse());
    setLogExercise('');
    setLogWeight(80);
    setLogReps(8);
    setLogRIR(2);
  };

  const getRIRstr = (g: string, l: string, deload: boolean): string => {
    if (deload) return '3-5';
    try {
      const rir = RIR_MATRIX[g]?.[l]?.base ?? 2;
      return `${rir}-${rir + 2}`;
    } catch { return '2-3'; }
  };

  const formatSplitGroups = (output: TrainingOutput) => {
    if (!output.volumePerGroup) return '';
    return Object.entries(output.volumePerGroup)
      .filter(([_, v]) => v > 0)
      .map(([g, v]) => `${GROUP_LABELS[g] || g}: ${v} РїРѕРґС…`)
      .join(' вЂў ');
  };

  const calcBMI = () => {
    const hm = bmiHeight / 100;
    setBmiResult(bmiWeight / (hm * hm));
  };

  const calcBMR = () => {
    if (bmrSex === 'male')
      setBmrResult(10 * bmrWeight + 6.25 * bmrHeight - 5 * bmrAge + 5);
    else setBmrResult(10 * bmrWeight + 6.25 * bmrHeight - 5 * bmrAge - 161);
  };

  const calcBMR_KM = () => {
    const lbm = bmrKmWeight * (100 - bmrKmBodyFat) / 100;
    setBmrKmResult(370 + 21.6 * lbm);
  };

  const calcTDEE = () => setTdeeResult(tdeeBmr * tdeePal);

  const calcGrip = () => {
    let ref: number;
    if (gripSex === 'male') ref = 50 - (gripAge - 30) * 0.3;
    else ref = 30 - (gripAge - 30) * 0.2;
    const pct = Math.min(100, Math.max(0, (gripKg / ref) * 100));
    setGripResult({ percentile: Math.round(pct), level: pct >= 80 ? 'РћС‚Р»РёС‡РЅРѕ' : pct >= 60 ? 'РҐРѕСЂРѕС€Рѕ' : pct >= 40 ? 'РЎСЂРµРґРЅРµ' : 'РќРёР·РєРёР№' });
  };

  const calcStress = () => {
    const stress = Math.max(0, Math.min(100, 100 - (hrvValue - 20) * 2));
    setStressResult({ stress: Math.round(stress), level: stress >= 70 ? 'Р’С‹СЃРѕРєРёР№' : stress >= 30 ? 'РЎСЂРµРґРЅРёР№' : 'РќРёР·РєРёР№' });
  };

  const PAL_OPTIONS = [
    { value: 1.2, label: 'РЎРёРґСЏС‡РёР№ (1.2)' },
    { value: 1.375, label: 'Р›РµРіРєРёР№ (1.375)' },
    { value: 1.55, label: 'РЈРјРµСЂРµРЅРЅС‹Р№ (1.55)' },
    { value: 1.725, label: 'Р’С‹СЃРѕРєРёР№ (1.725)' },
    { value: 1.9, label: 'Р­РєСЃС‚СЂРµРјР°Р»СЊРЅС‹Р№ (1.9)' },
  ];

  const bmiCategory = (v: number) => v < 18.5 ? 'РќРµРґРѕСЃС‚Р°С‚РѕРє РІРµСЃР°' : v < 25 ? 'РќРѕСЂРјР°' : v < 30 ? 'РР·Р±С‹С‚РѕРє' : 'РћР¶РёСЂРµРЅРёРµ';

  const showNonBuilder = tab !== 'programcalc';

  return (
    <div className="screen training-screen" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: 0 }}>

      {/* в”Ђв”Ђв”Ђ HERO PAGE в”Ђв”Ђв”Ђ */}
      {page === 'hero' && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
          <img src="/training-hero.jpg" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
          <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 2px', textShadow: '0 2px 14px rgba(0,0,0,0.9)' }}>РўСЂРµРЅРёСЂРѕРІРєРё</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', margin: '0 0 16px', lineHeight: 1.3, textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}>
              РџР»Р°РЅ, РґРЅРµРІРЅРёРє, СѓРїСЂР°Р¶РЅРµРЅРёСЏ, РєР°Р»СЊРєСѓР»СЏС‚РѕСЂС‹ Рё Р°РЅР°Р»РёС‚РёРєР°
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {(Object.entries(TAB_GROUPS_EFF) as [TrainingGroup & string, typeof TAB_GROUPS_EFF[string]][]).map(([key, group]) => (
                <button key={key} onClick={() => { setPage('tabs'); setMainGroup(key as TrainingGroup); setTab(group.tabs[0]); }} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: 'rgba(20,22,30,0.35)', border: '1px solid var(--glass-border)', color: 'var(--text)',
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    background: group.color + '18', fontSize: 20,
                  }}>
                    {group.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: group.color }}>{group.title}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>
                      {key === 'training' ? 'РџСЂРѕРІРµРґРµРЅРёРµ С‚СЂРµРЅРёСЂРѕРІРєРё, С‚Р°Р№РјРµСЂС‹ РѕС‚РґС‹С…Р°, СѓС‡С‘С‚ РїРѕРґС…РѕРґРѕРІ' : key === 'planning' ? (planningTrack === 'manual' ? 'Р СѓС‡РЅРѕР№ СЃР±РѕСЂ: РїР»Р°РЅ, С†РёРєР»С‹, РїСЂРѕРіСЂР°РјРјС‹, РјРµС‚РѕРґРёРєРё, РєР°Р»СЊРєСѓР»СЏС‚РѕСЂ' : planningTrack === 'bb' ? 'Р‘РѕРґРёР±РёР»РґРёРЅРі: Р°РІС‚Рѕ-РїРѕРґР±РѕСЂ СЃРїР»РёС‚Р°, РѕР±СЉС‘Рј/С‚СЏР¶-РїР°РјРї, PED, РјРµС‚СЂРёРєРё' : 'РџР› (СЃРёР»Р°): Р°РІС‚Рѕ-РїРѕРґР±РѕСЂ С†РёРєР»РѕРІ РЎР Р¦, PM-РїСЂРѕРіСЂРµСЃСЃРёСЏ, Р±Р»РёРЅС‹, РїРёРє, РјРµС‚СЂРёРєРё') : 'РђРЅР°Р»РёС‚РёРєР°, РіСЂР°С„РёРєРё, РїСЂРѕРіСЂРµСЃСЃ, РґРЅРµРІРЅРёРє, РєР°Р»СЊРєСѓР»СЏС‚РѕСЂС‹, РёСЃС‚РѕСЂРёСЏ'}
                    </div>
                  </div>
                  <span style={{ color: group.color, fontSize: 16, opacity: 0.6 }}>в†’</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* в”Ђв”Ђв”Ђ TAB VIEW (when not on hero) в”Ђв”Ђв”Ђ */}
      {page !== 'hero' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => { setPage('hero'); setMainGroup(null); }} style={{
            padding: '6px 8px', cursor: 'pointer', fontSize: 14,
            color: 'var(--text-dim)', border: 'none', background: 'transparent',
            display: 'flex', alignItems: 'center', gap: 4,
            fontWeight: 600, transition: 'all 0.2s',
          }}>в†ђ РќР° РіР»Р°РІРЅСѓСЋ</button>
          {mainGroup && (
            <button onClick={() => { setPage('hero'); setMainGroup(null); }} style={{
              padding: '6px 8px', cursor: 'pointer', fontSize: 12,
              color: 'var(--accent)', border: 'none', background: 'transparent',
              display: 'flex', alignItems: 'center', gap: 4,
              fontWeight: 600, transition: 'all 0.2s',
            }}>в†ђ РќР°Р·Р°Рґ</button>
          )}
        </div>
      )}

      {page !== 'hero' && (
      <div style={{ padding: '0 4px' }}>
      {mainGroup && (
        <h2 style={{ margin: '0 0 8px', fontSize: 16, color: TAB_GROUPS_EFF[mainGroup].color }}>{TAB_GROUPS_EFF[mainGroup].title}</h2>
      )}

      <div style={{ display: 'flex', gap: 3, marginBottom: 10, flexWrap: 'wrap' }}>
        {(mainGroup ? TAB_GROUPS_EFF[mainGroup].tabs : Object.keys(TAB_LABELS) as TrainingTab[]).map(k => (
          <button key={k} onClick={() => { hapticImpact('light'); setTab(k); }} style={{
            padding: '7px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
            background: tab === k ? 'var(--accent)' : 'var(--bg-secondary)',
            color: tab === k ? '#000' : 'var(--text-dim)', border: 'none', cursor: 'pointer',
            transition: 'all 0.2s',
          }}>{TAB_LABELS[k]}</button>
        ))}
      </div>

      {/* Р­С‚Р°Рї R: РїРµСЂРµРєР»СЋС‡Р°С‚РµР»СЊ СЂРµР¶РёРјР° РїР»Р°РЅРёСЂРѕРІР°РЅРёСЏ вЂ” С‚РѕР»СЊРєРѕ РІ РіСЂСѓРїРїРµ В«РџР»Р°РЅРёСЂРѕРІР°РЅРёРµВ».
           Р Р°Р·РґРµР»СЏРµС‚ Р°РІС‚Рѕ-РїРѕРґР±РѕСЂ (РЎР Р¦/BB, РµРґРёРЅСЃС‚РІРµРЅРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє РїСЂРѕРіСЂР°РјРј) Рё СЂСѓС‡РЅРѕР№ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ,
           СѓСЃС‚СЂР°РЅСЏСЏ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ РёРЅС„РѕСЂРјР°С†РёРё (AGENTS.md РєСЂРёС‚РёС‡.Р±Р°Рі #1). */}
      {mainGroup === 'planning' && (
        <div style={{ display:'flex', gap:4, marginBottom:10, padding:'6px', borderRadius:12, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
          <button onClick={() => { hapticImpact('medium'); switchPlanningTrack('pl'); }} style={{ flex:1, padding:'9px 6px', borderRadius:9, fontSize:11, fontWeight:700, cursor:'pointer', border: planningTrack === 'pl' ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)', background: planningTrack === 'pl' ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)', color: planningTrack === 'pl' ? 'var(--accent)' : 'var(--text-dim)' }}>рџЏ† РџР› (СЃРёР»Р°)</button>
          <button onClick={() => { hapticImpact('medium'); switchPlanningTrack('bb'); }} style={{ flex:1, padding:'9px 6px', borderRadius:9, fontSize:11, fontWeight:700, cursor:'pointer', border: planningTrack === 'bb' ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)', background: planningTrack === 'bb' ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)', color: planningTrack === 'bb' ? '#00e68a' : 'var(--text-dim)' }}>рџ’Є Р‘Р‘</button>
          <button onClick={() => { hapticImpact('medium'); switchPlanningTrack('manual'); }} style={{ flex:1, padding:'9px 6px', borderRadius:9, fontSize:11, fontWeight:700, cursor:'pointer', border: planningTrack === 'manual' ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)', background: planningTrack === 'manual' ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)', color: planningTrack === 'manual' ? '#00e68a' : 'var(--text-dim)' }}>рџ›  Р СѓС‡РЅРѕР№ СЃР±РѕСЂ</button>
        </div>
      )}

      {/* Readiness card вЂ” only on training tabs */}
      {readiness && mainGroup === 'training' && (
        <div className="card" style={{ marginBottom: 8, padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h4 style={{ margin: 0, fontSize: 12 }}>рџ“Љ Р“РѕС‚РѕРІРЅРѕСЃС‚СЊ Рє С‚СЂРµРЅРёСЂРѕРІРєРµ</h4>
            <span style={{ fontSize: 11, color: readiness.recovery >= 70 ? '#22c55e' : readiness.recovery >= 40 ? '#eab308' : '#ef4444', fontWeight: 700 }}>
              {Math.round(readiness.recovery)}%
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              { label: 'Р’РѕСЃСЃС‚.', value: readiness.recovery, color: readiness.recovery >= 70 ? '#22c55e' : '#eab308' },
              { label: 'РџРёС‚Р°РЅРёРµ', value: readiness.nutrition ?? 50, color: (readiness.nutrition ?? 50) >= 70 ? '#22c55e' : '#eab308' },
              { label: 'РЎРѕРЅ', value: (readiness.sleep ?? 0) * 10, color: (readiness.sleep ?? 5) >= 7 ? '#22c55e' : '#eab308' },
              { label: 'РЎС‚СЂРµСЃСЃ', value: 100 - (readiness.stress ?? 50), color: (readiness.stress ?? 3) < 4 ? '#22c55e' : '#ef4444' },
              { label: 'РЈСЃС‚Р°Р»РѕСЃС‚СЊ', value: 100 - (readiness.recovery ?? 70), color: (readiness.recovery ?? 70) >= 60 ? '#22c55e' : '#eab308' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', minWidth: 44 }}>{item.label}</span>
                <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, item.value))}%`, height: '100%', background: item.color, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: item.color, minWidth: 24, textAlign: 'right' }}>{Math.round(item.value)}%</span>
              </div>
            ))}
          </div>
          {(() => { const srpe = loadSRPESessions(); if (srpe.length < 2) return null; const acwr = acuteChronicRatio(toDailyLoads(srpe)); const zoneColor = acwr.ratio > 1.5 ? '#ef4444' : acwr.ratio > 1.3 ? '#eab308' : acwr.ratio < 0.8 ? '#3b82f6' : '#22c55e'; const zoneLabel = acwr.ratio > 1.5 ? 'РѕРїР°СЃРЅРѕ' : acwr.ratio > 1.3 ? 'РѕСЃС‚РѕСЂРѕР¶РЅРѕ' : acwr.ratio < 0.8 ? 'РЅРµРґРѕС‚СЂРµРЅ' : 'РѕРїС‚РёРјСѓРј'; return <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}><span style={{ color: 'var(--text-dim)', minWidth: 44 }}>РќР°РіСЂСѓР·РєР°</span><div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 4, height: 5, overflow: 'hidden' }}><div style={{ width: Math.min(100, acwr.ratio * 50) + '%', height: '100%', background: zoneColor, borderRadius: 4 }} /></div><span style={{ fontWeight: 700, color: zoneColor, minWidth: 60, textAlign: 'right' }}>ACWR {acwr.ratio.toFixed(2)} В· {zoneLabel}</span></div>; })()}
        </div>
      )}

      {/* Training Score Card РїРµСЂРµРЅРµСЃС‘РЅ РІ РїРѕРґРІРєР»Р°РґРєСѓ Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ С‚СЂРµРЅРёСЂРѕРІРѕС‡РЅРѕРіРѕ Р±Р»РѕРєР° */}

      {/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ PLAN TAB в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */}
      
{tab === 'powerlifting' && <InfoErrorBoundary label="РџР°СѓСЌСЂР»РёС„С‚РёРЅРі"><SRCBBScreen track="pl" /></InfoErrorBoundary>}
{tab === 'bodybuilding' && <InfoErrorBoundary label="Р‘РѕРґРёР±РёР»РґРёРЅРі"><SRCBBScreen track="bb" /></InfoErrorBoundary>}
          {tab === 'plan' && (
        <InfoErrorBoundary label="РџР»Р°РЅ С‚СЂРµРЅРёСЂРѕРІРѕРє">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>вљ™пёЏ РџР°СЂР°РјРµС‚СЂС‹ РїР»Р°РЅР°</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {GOALS.map(g => (
                <button key={g.value} onClick={() => setGoal(g.value)} style={{
                  padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: goal === g.value ? 700 : 400,
                  cursor: 'pointer', border: goal === g.value ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: goal === g.value ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)',
                }}>{g.icon} {g.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {LEVELS.map(l => (
                <button key={l.value} onClick={() => setLevel(l.value)} style={{
                  padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: level === l.value ? 700 : 400,
                  cursor: 'pointer', border: level === l.value ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: level === l.value ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)',
                }}>{l.icon} {l.label}</button>
              ))}
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 3, display: 'block' }}>РўРёРї СЃРїР»РёС‚Р°</label>
              <button onClick={() => { setShowSplitPicker(!showSplitPicker); if (!splitCandidates.length) { const opts = getSplitOptions({ goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as any); setSplitCandidates(opts.slice(0, 12)); } }} style={{
                width: '100%', padding: '6px 10px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>{splitType === 'auto' ? 'РђРІС‚Рѕ-РІС‹Р±РѕСЂ СЃРїР»РёС‚Р°' : splitCandidates.find(c => c.id === splitType)?.name || splitType}</span>
                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{showSplitPicker ? 'в–ґ' : 'в–ѕ'}</span>
              </button>
              {showSplitPicker && (
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflowY: 'auto', background: 'var(--bg-secondary)', borderRadius: 8, padding: '4px 6px', border: '1px solid var(--border)' }}>
                  <div key="auto" onClick={() => { setSplitType('auto'); setShowSplitPicker(false); setTimeout(() => generatePlan(), 50); }} style={{
                    padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
                    background: splitType === 'auto' ? 'rgba(0,230,138,0.1)' : 'transparent',
                    border: splitType === 'auto' ? '1px solid var(--accent)' : '1px solid transparent',
                  }}>
                    <div style={{ fontWeight: 600 }}>рџ¤– РђРІС‚Рѕ-РІС‹Р±РѕСЂ</div>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Р”РІРёР¶РѕРє СЃР°Рј РїРѕРґР±РµСЂС‘С‚ РѕРїС‚РёРјР°Р»СЊРЅС‹Р№ СЃРїР»РёС‚</div>
                  </div>
                   {splitCandidates.map(c => (
                     <div key={c.id || c.name} onClick={() => { const newType = c.id || c.name; setSplitType(newType); setShowSplitPicker(false); setTimeout(() => generatePlan(newType), 50); }} style={{
                      padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
                      background: splitType === (c.id || c.name) ? 'rgba(0,230,138,0.1)' : 'transparent',
                      border: splitType === (c.id || c.name) ? '1px solid var(--accent)' : '1px solid transparent',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{c.name}</span>
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(0,230,138,0.1)', color: 'var(--accent)', fontWeight: 600 }}>{(c.score * 100).toFixed(0)}%</span>
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>{c.desc?.slice(0, 80)}{c.desc && c.desc.length > 80 ? '...' : ''}</div>
                      {c.rationale && <div style={{ fontSize: 8, color: 'var(--accent)', marginTop: 1 }}>{c.rationale.slice(0, 60)}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2, display: 'block' }}>РўРёРї РїРµСЂРёРѕРґРёР·Р°С†РёРё</label>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {[
                  { v: 'auto', l: 'РђРІС‚Рѕ', desc: 'РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРёР№ РІС‹Р±РѕСЂ РїРѕ СѓСЂРѕРІРЅСЋ' },
                  { v: 'linear', l: 'Р›РёРЅРµР№РЅР°СЏ', desc: 'РћР±СЉС‘Рј в†“, РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ в†‘. РљР»Р°СЃСЃРёС‡РµСЃРєР°СЏ.' },
                  { v: 'undulating', l: 'Р’РѕР»РЅРѕРІР°СЏ DUP', desc: 'РЎРјРµРЅР° РЅР°РіСЂСѓР·РєРё РІРЅСѓС‚СЂРё РЅРµРґРµР»Рё. Р“РёР±РєР°СЏ.' },
                  { v: 'block', l: 'Р‘Р»РѕС‡РЅР°СЏ', desc: 'Р‘Р»РѕРєРё РїРѕ 3-6 РЅРµРґ СЃ РѕРґРЅРѕР№ С†РµР»СЊСЋ. РџСЂРѕРґРІРёРЅСѓС‚Р°СЏ.' },
                ].map(p => (
                  <button key={p.v} onClick={() => { setPeriodizationType(p.v as any); setTimeout(generatePlan, 50); }} style={{
                    padding: '3px 7px', borderRadius: 6, fontSize: 9, fontWeight: periodizationType === p.v ? 700 : 400, cursor: 'pointer',
                    border: periodizationType === p.v ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: periodizationType === p.v ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)',
                    position:'relative',
                  }} title={p.desc}>{p.l}</button>
                ))}
              </div>
              <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 2 }}>
                {periodizationType === 'auto' && 'РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРёР№ РїРѕРґР±РѕСЂ РїРѕ С†РµР»Рё Рё СѓСЂРѕРІРЅСЋ'}
                {periodizationType === 'linear' && 'РћР±СЉС‘Рј СЃРЅРёР¶Р°РµС‚СЃСЏ, РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ СЂР°СЃС‚С‘С‚ РѕС‚ Р±Р»РѕРєР° Рє Р±Р»РѕРєСѓ. RIR РїРѕРІС‹С€РµРЅ.'}
                {periodizationType === 'undulating' && 'РћР±СЉС‘Рј/РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ РјРµРЅСЏСЋС‚СЃСЏ РєР°Р¶РґС‹Р№ РґРµРЅСЊ/РЅРµРґРµР»СЋ. RIR СЃСЂРµРґРЅРёР№.'}
                {periodizationType === 'block' && 'Р‘Р»РѕРєРё РїРѕ 3-6 РЅРµРґ СЃ РѕРґРЅРѕР№ С†РµР»СЊСЋ. RIR СЃРЅРёР¶РµРЅ, РѕР±СЉС‘Рј РїРѕРІС‹С€РµРЅ.'}
              </div>
              {periodizationType === 'block' && (() => {
                const seq = BLOCK_SEQUENCES[level] || BLOCK_SEQUENCES.intermediate;
                const colors: Record<string,string> = { accumulation:'#22c55e', transmutation:'#3b82f6', realization:'#f97316', active_rest:'#eab308' };
                const labels: Record<string,string> = { accumulation:'РђРєРє', transmutation:'РўСЂР°РЅСЃ', realization:'Р РµР°Р»', active_rest:'РћС‚РґС‹С…' };
                return <div style={{ marginTop:4, display:'flex', gap:4, flexWrap:'wrap' }}>
                  {seq.map((b, i) => <span key={b.id} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:(colors[b.id]||'#888')+'22', color:colors[b.id]||'#888', fontWeight:600, whiteSpace:'nowrap' }}>{labels[b.id]||b.id} {b.weeks}РЅ{i < seq.length-1 ? ' в†’' : ''}</span>)}
                </div>;
              })()}
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2, display: 'block' }}>РўРёРї С†РёРєР»Р°</label>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {[
                  { v: 'auto', l: 'РђРІС‚Рѕ', desc: 'РђРІС‚Рѕ' }, { v: 'pl_strength', l: 'PL РЎРёР»Р°', desc: 'РџР°СѓСЌСЂР»РёС„С‚РёРЅРі СЃРёР»Р°' }, { v: 'pl_peaking', l: 'PL РџРёРє', desc: 'РџР°СѓСЌСЂР»РёС„С‚РёРЅРі РїРёРє' },
                  { v: 'bb_mass', l: 'BB РњР°СЃСЃР°', desc: 'Р‘РѕРґРёР±РёР»РґРёРЅРі РјР°СЃСЃР°' }, { v: 'bb_specialization', l: 'BB РЎРїРµС†', desc: 'Р‘РѕРґРёР±РёР»РґРёРЅРі СЃРїРµС†' },
                  { v: 'rehab', l: 'Р РµР°Р±РёР»РёС‚Р°С†РёСЏ', desc: 'Р РµР°Р±РёР»РёС‚Р°С†РёСЏ' }, { v: 'wl_tech', l: 'WL РўРµС…РЅРёРєР°', desc: 'РўСЏР¶РµР»Р°СЏ Р°С‚Р»РµС‚РёРєР° С‚РµС…РЅРёРєР°' },
                ].map(c => (
                  <button key={c.v} onClick={() => { setCycleType(c.v); setTimeout(generatePlan, 50); }} style={{
                    padding: '3px 7px', borderRadius: 6, fontSize: 9, fontWeight: cycleType === c.v ? 700 : 400, cursor: 'pointer',
                    border: cycleType === c.v ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: cycleType === c.v ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)',
                  }} title={c.desc}>{c.l}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2, display: 'block' }}>Р”Р»РёРЅР° С†РёРєР»Р°</label>
              <div style={{ display: 'flex', gap: 3 }}>
                {[4, 8, 12].map(w => (
                  <button key={w} onClick={() => setMesoLength(w)} style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: mesoLength === w ? 700 : 400, cursor: 'pointer',
                    border: mesoLength === w ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: mesoLength === w ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)',
                  }}>{w} РЅРµРґ</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р”РЅРµР№/РЅРµРґ</label>
                <input type="range" min={2} max={7} value={daysPerWeek} onChange={e => { setDaysPerWeek(parseFloat(e.target.value) || 0); setTimeout(generatePlan, 50); }}
                  style={{ width: '100%', accentColor: 'var(--accent)' }} />
                <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-dim)' }}>{daysPerWeek}</div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ</label>
                <input type="range" min={1} max={10} value={recovery} onChange={e => setRecovery(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', accentColor: 'var(--accent)' }} />
                <div style={{ textAlign: 'center', fontSize: 10, color: recovery < 4 ? '#ef4444' : recovery < 6 ? '#ff9100' : '#22c55e' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: recovery < 4 ? '#ef4444' : recovery < 6 ? '#ff9100' : '#22c55e', marginRight: 4 }} />
                  {recovery}/10 вЂ” {recovery < 4 ? 'РЅРёР·РєРѕРµ' : recovery < 6 ? 'СѓРјРµСЂРµРЅРЅРѕРµ' : recovery < 8 ? 'С…РѕСЂРѕС€РµРµ' : 'РѕС‚Р»РёС‡РЅРѕРµ'}
                </div>
                <div style={{ fontSize:8, color:'var(--text-dim)', textAlign:'center', marginTop:1 }}>РќРёР·РєРёР№ в†’ С‚СЂРµР±СѓРµС‚СЃСЏ Р±РѕР»СЊС€Рµ РѕС‚РґС‹С…Р°</div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>РЈСЃС‚Р°Р»РѕСЃС‚СЊ</label>
                <input type="range" min={1} max={10} value={fatigue} onChange={e => setFatigue(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', accentColor: 'var(--accent)' }} />
                <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-dim)' }}>{fatigue}/10</div>
                <div style={{ fontSize:8, color:'var(--text-dim)', textAlign:'center', marginTop:1 }}>
                  {fatigue <= 3 ? 'РЎРІРµР¶РёР№' : fatigue <= 6 ? 'РЈРјРµСЂРµРЅРЅР°СЏ СѓСЃС‚Р°Р»РѕСЃС‚СЊ' : fatigue <= 8 ? 'Р’С‹СЃРѕРєР°СЏ РЅР°РіСЂСѓР·РєР°' : 'РџРµСЂРµС‚СЂРµРЅРёСЂРѕРІР°РЅРЅРѕСЃС‚СЊ'}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р’РµСЃ (РєРі)</label>
                <input type="number" value={bodyWeight} onChange={e => setBodyWeight(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>РЎРѕРЅ (С‡)</label>
                <input type="number" min={0} max={12} value={sleepHours || ''} onChange={e => setSleepHours(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
                <div style={{ fontSize:8, color: sleepHours < 6 ? '#ef4444' : sleepHours <= 7 ? '#ff9100' : sleepHours <= 9 ? '#22c55e' : '#ff9100', marginTop:1, textAlign:'center' }}>
                  {sleepHours < 6 ? '<6: РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ' : sleepHours <= 7 ? '6-7: РњРёРЅРёРјСѓРј' : sleepHours <= 9 ? '7-9: РћРїС‚РёРјСѓРј' : '>9: РР·Р±С‹С‚РѕРє'}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>РЎС‚СЂРµСЃСЃ (1-10)</label>
                <input type="number" min={1} max={10} value={stressLevel || ''} onChange={e => setStressLevel(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
                <div style={{ fontSize:8, color: stressLevel <= 3 ? '#22c55e' : stressLevel <= 6 ? '#ff9100' : '#ef4444', marginTop:1, textAlign:'center' }}>
                  {stressLevel <= 3 ? '1-3: РќРёР·РєРёР№' : stressLevel <= 6 ? '4-6: РЎСЂРµРґРЅРёР№' : '7-10: Р’С‹СЃРѕРєРёР№'}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2, display: 'block' }}>РЎР»Р°Р±С‹Рµ Р·РѕРЅС‹</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {MUSCLE_GROUPS.map(g => {
                  const active = weakPoints.includes(g);
                  return (
                    <button key={g} onClick={() => setWeakPoints(active ? weakPoints.filter(w => w !== g) : [...weakPoints, g])} style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                      border: active ? '1px solid #ff9100' : '1px solid var(--border)',
                      background: active ? 'rgba(255,145,0,0.15)' : 'var(--bg-secondary)',
                      color: active ? '#ff9100' : 'var(--text-dim)', fontWeight: active ? 600 : 400,
                    }}>{GROUP_LABELS[g]}</button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => generatePlan()} style={{
                flex: 1, padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--accent), #00c853)', color: '#000', fontWeight: 700, fontSize: 13,
              }}>в–¶ РЎРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ РїР»Р°РЅ</button>
              {currentMicrocycle ? <button onClick={applyMacroToRuntime} title="РџРµСЂРµРЅРµСЃС‚Рё С‚РµРєСѓС‰СѓСЋ РЅРµРґРµР»СЋ РјР°РєСЂРѕС†РёРєР»Р° РІРѕ РІРєР»Р°РґРєСѓ РўСЂРµРЅРёСЂРѕРІРєРё РґР»СЏ РІС‹РїРѕР»РЅРµРЅРёСЏ С‡РµСЂРµР· SessionPlayer" style={{ padding: 10, borderRadius: 8, border: '1px solid var(--accent)', cursor: 'pointer', background: 'rgba(0,230,138,0.08)', color: 'var(--accent)', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>в–¶ Рљ РІС‹РїРѕР»РЅРµРЅРёСЋ</button> : null}
              {trainingOutput && (
                <button onClick={() => { generatePlan(); }} style={{
                  padding: 10, borderRadius: 8, border: '1px solid var(--accent)', cursor: 'pointer',
                  background: 'rgba(0,230,138,0.08)', color: 'var(--accent)', fontWeight: 600, fontSize: 12,
                  whiteSpace: 'nowrap',
                }}>рџ”„ Р—Р°РЅРѕРІРѕ</button>
              )}
            </div>
          </div>

          {trainingOutput && (
            <>
              {/* Training constraints check */}
              {(() => {
                const constraints = computeConstraints({
                  riskSnapshot: {},
                  fatigueLevel: fatigue / 10,
                  recoveryLevel: recovery / 10,
                  priScore: recovery / 10,
                  jointFatigue: {},
                  cumulativeLoad: { weekly: 0, patternLoad: {}, jointLoad: {}, overload: false },
                  equipmentAvailable: ['barbell', 'dumbbell', 'bench'],
                  goal,
                });
                if (constraints.recommendations.length === 0) return null;
                return (
                  <div key="constraints" className="card" style={{
                    marginBottom: 8, padding: '6px 10px',
                    background: 'rgba(249,115,22,0.06)', borderLeft: '3px solid #f97316',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#f97316' }}>вљ  РћРіСЂР°РЅРёС‡РµРЅРёСЏ С‚СЂРµРЅРёСЂРѕРІРєРё</div>
                    {constraints.recommendations.map((r, i) => (
                      <div key={i} style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>вЂў {r}</div>
                    ))}
                  </div>
                );
              })()}
              {/* Smart Recommendations */}
              {(() => {
                const tips: { icon: string; text: string; color: string }[] = [];
                if (recovery < 5) tips.push({ icon: 'вљ пёЏ', text: 'РќРёР·РєРѕРµ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ: СЃРѕРєСЂР°С‚РёС‚Рµ РѕР±СЉС‘Рј РЅР° 10-20% РёР»Рё РґРµСЂР¶РёС‚Рµ RIR РІС‹С€Рµ.', color: '#ef4444' });
                if (sleepHours < 7) tips.push({ icon: 'рџґ', text: `РЎРѕРЅ ${sleepHours} С‡: РґРѕР±Р°РІСЊС‚Рµ 30-60 РјРёРЅСѓС‚ СЃРЅР° РїРµСЂРµРґ С‚СЏР¶С‘Р»С‹РјРё РґРЅСЏРјРё.`, color: '#ff9100' });
                if (stressLevel > 7) tips.push({ icon: 'рџ§ ', text: 'Р’С‹СЃРѕРєРёР№ СЃС‚СЂРµСЃСЃ: РёР·Р±РµРіР°Р№С‚Рµ РѕС‚РєР°Р·РЅС‹С… РїРѕРґС…РѕРґРѕРІ Рё РєРѕРЅС‚СЂРѕР»РёСЂСѓР№С‚Рµ RPE.', color: '#ff9100' });
                if (currentMicrocycle?.mesocycleType === 'deload') tips.push({ icon: 'рџ§Љ', text: 'РќРµРґРµР»СЏ СЂР°Р·РіСЂСѓР·РєРё: С†РµР»СЊ вЂ” РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ, Р° РЅРµ СЂРµРєРѕСЂРґС‹.', color: '#3b82f6' });
                else if (currentMicrocycle?.mesocycleType === 'peaking') tips.push({ icon: 'рџЋЇ', text: 'РџРёРєРѕРІР°СЏ С„Р°Р·Р°: РґРµСЂР¶РёС‚Рµ С‚РµС…РЅРёРєСѓ СЃС‚Р°Р±РёР»СЊРЅРѕР№ Рё РЅРµ РґРѕР±Р°РІР»СЏР№С‚Рµ Р»РёС€РЅРёР№ РѕР±СЉС‘Рј.', color: '#ef4444' });
                else if (currentMicrocycle?.mesocycleType === 'accumulation') tips.push({ icon: 'рџ“€', text: 'Р¤Р°Р·Р° РЅР°РєРѕРїР»РµРЅРёСЏ: РїРѕСЃС‚РµРїРµРЅРЅРѕ СѓРІРµР»РёС‡РёРІР°Р№С‚Рµ РѕР±СЉС‘Рј РїСЂРё СЃРѕС…СЂР°РЅРµРЅРёРё РєР°С‡РµСЃС‚РІР° РїРѕРІС‚РѕСЂРµРЅРёР№.', color: '#22c55e' });
                if (weakPoints.length > 0) tips.push({ icon: 'рџ”Ћ', text: `Р¤РѕРєСѓСЃ РЅР° СЃР»Р°Р±С‹С… Р·РѕРЅР°С…: ${weakPoints.map(w => GROUP_LABELS[w] || w).join(', ')}.`, color: '#8b5cf6' });
                if (recovery > 8 && fatigue < 3) tips.push({ icon: 'вњ…', text: 'Р“РѕС‚РѕРІРЅРѕСЃС‚СЊ РІС‹СЃРѕРєР°СЏ: РјРѕР¶РЅРѕ РґРѕР±Р°РІРёС‚СЊ РѕРґРёРЅ РєР°С‡РµСЃС‚РІРµРЅРЅС‹Р№ РїРѕРґС…РѕРґ РІ РїСЂРёРѕСЂРёС‚РµС‚РЅСѓСЋ РіСЂСѓРїРїСѓ.', color: '#22c55e' });
                if (tips.length === 0) tips.push({ icon: 'вњ…', text: 'РџР°СЂР°РјРµС‚СЂС‹ РІС‹РіР»СЏРґСЏС‚ СЃР±Р°Р»Р°РЅСЃРёСЂРѕРІР°РЅРЅРѕ: РІС‹РїРѕР»РЅСЏР№С‚Рµ РїР»Р°РЅ Р±РµР· Р»РёС€РЅРёС… РёР·РјРµРЅРµРЅРёР№.', color: 'var(--accent)' });
                return (
                  <div key="recommendations" className="card" style={{ padding: '10px 12px', border: '1px solid rgba(0,230,138,0.2)' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--accent)' }}>рџ’Ў Р РµРєРѕРјРµРЅРґР°С†РёРё</h4>
                    {tips.map((t, i) => (
                      <div key={i} style={{ fontSize: 10, color: 'var(--text-dim)', padding: '2px 0', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <span>{t.icon}</span>
                        <span style={{ color: t.color }}>{t.text}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div className="card" style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>{trainingOutput.splitName}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6 }}>RIR {getRIRstr(goal, level, trainingOutput.isDeload)}</span>
                  </div>
                  {trainingOutput.isDeload && (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,145,0,0.15)', color: '#ff9100', fontWeight: 600 }}>Р РђР—Р“Р РЈР—РљРђ</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{trainingOutput.splitDesc}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{formatSplitGroups(trainingOutput)}</div>
              </div>

              <div className="card" style={{ padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>РќРµРґ {selectedWeek}</span>
                  <input type="range" min={1} max={macrocycle?.totalWeeks || 12} value={selectedWeek}
                    onChange={e => setSelectedWeek(parseFloat(e.target.value) || 0)}
                    style={{ flex: 1, accentColor: 'var(--accent)' }} />
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button onClick={() => setShowWarmup(!showWarmup)} style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 9, cursor: 'pointer',
                    background: showWarmup ? 'rgba(255,145,0,0.15)' : 'var(--bg-secondary)',
                    border: showWarmup ? '1px solid #ff9100' : '1px solid var(--border)',
                    color: showWarmup ? '#ff9100' : 'var(--text-dim)',
                  }}>рџ”Ґ Р Р°Р·РјРёРЅРєР°</button>
                  <button onClick={() => setShowCooldown(!showCooldown)} style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 9, cursor: 'pointer',
                    background: showCooldown ? 'rgba(59,130,246,0.15)' : 'var(--bg-secondary)',
                    border: showCooldown ? '1px solid #3b82f6' : '1px solid var(--border)',
                    color: showCooldown ? '#3b82f6' : 'var(--text-dim)',
                  }}>рџ§Љ Р—Р°РјРёРЅРєР°</button>
                </div>
              </div>

              {/* Warmup */}
              {showWarmup && currentMicrocycle && currentMicrocycle.days.length > 0 && (() => {
                const wuInput = {
                  sessionFocus: currentMicrocycle.days[0]?.split || 'fullbody',
                  primaryExercises: currentMicrocycle.days[0]?.exercises?.slice(0, 2).map((e: any) => e.name) || [],
                  riskFlags: {} as Record<string, string>,
                  techniqueIssues: [] as string[],
                  fatigueLevel: fatigue / 10,
                  equipmentAvailable: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
                };
                const warmup = generateWarmup(wuInput);
                return (
                  <div key="warmup" className="card" style={{ padding: '8px 10px', border: '1px solid rgba(255,145,0,0.2)' }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#ff9100', marginBottom: 4 }}>рџ”Ґ Р Р°Р·РјРёРЅРєР°</div>
                    {warmup.map((b, bi) => (
                      <div key={bi} style={{ fontSize: 10, marginBottom: 2, color: 'var(--text-dim)' }}>
                        <span style={{ fontWeight: 600, color: '#ff9100' }}>
                          {b.type === 'general' ? 'РћР±С‰Р°СЏ' : b.type === 'mobility' ? 'РњРѕР±РёР»РёР·Р°С†РёСЏ' : b.type === 'activation' ? 'РђРєС‚РёРІР°С†РёСЏ' : 'Р Р°Р·РјРёРЅРєР°'} ({b.durationSec}СЃ)
                        </span>
                        {b.exercises?.map((ex, exi) => (
                          <span key={exi} style={{ marginLeft: 6, color: 'var(--text-dim)' }}>
                            {WARMUP_LABELS[ex.exerciseId] || ex.exerciseId.replace(/_/g, ' ')} {ex.sets ? `Г—${ex.sets}` : ''}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {currentMicrocycle && (
                <div className="card" style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>
                      {PHASE_LABELS[currentMicrocycle.mesocycleType] || 'Р Р°Р±РѕС‡Р°СЏ С„Р°Р·Р°'} вЂ” РќРµРґРµР»СЏ {selectedWeek}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                      РћР±СЉС‘Рј Г—{currentMicrocycle.volumeMultiplier} | RIR {currentMicrocycle.rirRange[0]}-{currentMicrocycle.rirRange[1]}
                      {currentMicrocycle.mesocycleType !== 'deload' && currentMicrocycle.mesocycleType !== 'peaking' && (
                        <span style={{ color: '#22c55e', fontWeight: 600, marginLeft: 6 }}>
                          в†‘+{(currentMicrocycle.mesocycleType === 'accumulation' ? 2.5 : 3.75)}%/РЅРµРґ
                        </span>
                      )}
                      {currentMicrocycle.mesocycleType === 'deload' && (
                        <span style={{ color: '#3b82f6', fontWeight: 600, marginLeft: 6 }}>в†“-50%</span>
                      )}
                    </span>
                      </div>
                      {/* Phase training tip */}
                      {currentMicrocycle && (
                        <div style={{ padding: '6px 8px', background: 'rgba(0,230,138,0.04)', borderRadius: 6, fontSize: 10, color: 'var(--accent)', marginBottom: 6, lineHeight: 1.4 }}>
                          {PHASE_HINTS[currentMicrocycle.mesocycleType] || 'Р Р°Р±РѕС‡Р°СЏ РЅРµРґРµР»СЏ: СЃРѕС…СЂР°РЅСЏР№С‚Рµ Р·Р°РґР°РЅРЅС‹Р№ РѕР±СЉС‘Рј, РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ Рё RIR.'}
                        </div>
                      )}
                      {/* MRV guardrail вЂ” Р°РЅС‚Рё-РїРµСЂРµС‚СЂРµРЅ РїРѕ РѕР±СЉС‘РјСѓ РЅРµРґРµР»Рё */}
                      {currentMicrocycle && (() => {
                        const _labAdj = labTrainingAdjust(linked.labAnalysis);
    const mrv = ((LEVEL_VOLUMES as Record<string, { mrv: number }>)[level]?.mrv ?? 20) * (tprofile.onCourse ? (tprofile.courseIntensity === 'heavy' ? 1.3 : tprofile.courseIntensity === 'mild' ? 1.15 : 1.2) : 1) * _labAdj.mrvMultiplier;
                        const wk: Record<string, number> = {};
                        currentMicrocycle.days.filter((d: any) => d.isTraining).forEach((d: any) => (d.exercises || []).forEach((e: any) => { wk[e.group] = (wk[e.group] || 0) + (e.sets || 0); }));
                        const over = Object.entries(wk).filter(([, s]) => s > mrv);
                        if (over.length === 0) return null;
                        const GRP_RU: Record<string,string> = { chest:'Р“СЂСѓРґСЊ', back:'РЎРїРёРЅР°', legs:'РќРѕРіРё', shoulders:'РџР»РµС‡Рё', arms:'Р СѓРєРё', core:'РљРѕСЂ' };
                        return <div style={{ padding: '6px 8px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, fontSize: 10, color: '#ef4444', marginBottom: 6, lineHeight: 1.4, border: '1px solid rgba(239,68,68,0.2)' }}>
                          вљ  РћР±СЉС‘Рј РїСЂРµРІС‹С€Р°РµС‚ MRV ({mrv} СЃРµС‚РѕРІ/РЅРµРґ): {over.map(([g, s]) => `${GRP_RU[g] || g} ${s}`).join(' В· ')}. РЎРЅРёР·СЊС‚Рµ С‡РёСЃР»Рѕ РїРѕРґС…РѕРґРѕРІ РёР»Рё РґРѕР±Р°РІСЊС‚Рµ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ.
                        </div>;
                      })()}
                      {currentMicrocycle.days.filter((d: any) => d.isTraining).map((day: any, di: number) => {
                    const dayExCount = day.exercises?.length || 0;
                    const dayCompounds = day.exercises?.filter((e: any) => e.isCompound).length || 0;
                    const difficultyScore = Math.min(10, Math.round((dayCompounds * 2 + dayExCount) * (day.intensity === 'very_high' ? 1.4 : day.intensity === 'high' ? 1.2 : 1)));
                    const diffLabel = difficultyScore <= 3 ? 'Р»С‘РіРєРѕ' : difficultyScore <= 5 ? 'СѓРјРµСЂРµРЅРЅРѕ' : difficultyScore <= 7 ? 'С‚СЏР¶РµР»Рѕ' : 'РѕС‡РµРЅСЊ С‚СЏР¶РµР»Рѕ';
                    const diffColor = difficultyScore <= 3 ? '#22c55e' : difficultyScore <= 5 ? '#84cc16' : difficultyScore <= 7 ? '#ff9100' : '#ef4444';
                    const adjRecovery = recovery / 10;
                    const autoRegNote = adjRecovery < 0.4 ? 'вљ  РЎРЅРёР·РёС‚СЊ РѕР±СЉС‘Рј РЅР° 20% вЂ” РЅРёР·РєРѕРµ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ' :
                                       adjRecovery < 0.6 ? 'вљЎ РЈРјРµСЂРµРЅРЅР°СЏ РЅР°РіСЂСѓР·РєР° вЂ” СЃР»РµРґРё Р·Р° RPE' :
                                       adjRecovery > 0.8 ? 'вњ… Р’С‹СЃРѕРєР°СЏ РіРѕС‚РѕРІРЅРѕСЃС‚СЊ вЂ” РјРѕР¶РЅРѕ РґРѕР±Р°РІРёС‚СЊ РїРѕРґС…РѕРґ' : '';
                    const labWarnings: string[] = [];
                    if (labAnalysis) {
                      if (labAnalysis.liverStress > 60) labWarnings.push(`вљ  РџРµС‡РµРЅСЊ ${labAnalysis.liverStress}% вЂ” РёСЃРєР»СЋС‡РёС‚СЊ РіРµРїР°С‚РѕС‚РѕРєСЃРёС‡РЅС‹Рµ РЅР°РіСЂСѓР·РєРё`);
                      if (labAnalysis.inflammation > 5) labWarnings.push(`вљ  Р’РѕСЃРїР°Р»РµРЅРёРµ ${labAnalysis.inflammation.toFixed(1)} вЂ” СЂРµРєРѕРјРµРЅРґРѕРІР°РЅ deload`);
                      if (labAnalysis.kidneyStress > 50) labWarnings.push(`вљ  РџРѕС‡РєРё ${labAnalysis.kidneyStress}% вЂ” РєРѕРЅС‚СЂРѕР»СЊ РіРёРґСЂР°С‚Р°С†РёРё`);
                    }
                    return (
                    <div key={di} style={{ marginBottom: 6, background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 11 }}>{day.day}</span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {(() => {
                            const hasSquat = day.exercises?.some((e: any) => e.exerciseId?.includes('squat') || e.name?.toLowerCase().includes('РїСЂРёСЃРµРґ'));
                            const hasBench = day.exercises?.some((e: any) => e.exerciseId?.includes('bench') || e.name?.toLowerCase().includes('Р¶РёРј'));
                            const hasDead = day.exercises?.some((e: any) => e.exerciseId?.includes('deadlift') || e.name?.toLowerCase().includes('С‚СЏРіР°'));
                            const focusTag = hasSquat ? 'РџСЂРёСЃРµРґ' : hasBench ? 'Р–РёРј' : hasDead ? 'РўСЏРіР°' : '';
                            return focusTag ? <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600 }}>{focusTag}</span> : null;
              })()}

              {/* Periodization phase info */}
              {(() => {
                const pp = getPhaseParams({
                  goal: goal === 'bulk' ? 'hypertrophy' : goal as any,
                  phase: cycleType === 'peaking' ? 'peaking' : cycleType === 'intensification' ? 'intensification' : cycleType === 'deload' ? 'deload' : 'accumulation',
                  analytics: { fatigue: fatigue / 10, recovery: recovery / 10, risk: 0 },
                });
                return (
                  <div className="card" style={{ marginBottom: 8, padding: '6px 10px', background: 'rgba(139,92,246,0.06)', borderLeft: '3px solid #8b5cf6' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#8b5cf6', marginBottom: 2 }}>
                      рџ”„ Р¤Р°Р·Р°: {cycleType === 'peaking' ? 'РџРёРє' : cycleType === 'intensification' ? 'РРЅС‚РµРЅСЃРёС„РёРєР°С†РёСЏ' : cycleType === 'deload' ? 'Р Р°Р·РіСЂСѓР·РєР°' : 'РќР°РєРѕРїР»РµРЅРёРµ'}
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: 9, color: 'var(--text-dim)' }}>
                      <span>РћР±СЉС‘Рј: <b>{pp.volumeLevel}</b></span>
                      <span>РРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ: <b>{pp.intensityLevel}</b></span>
                      <span>Р§Р°СЃС‚РѕС‚Р°: <b>{pp.frequencyLevel}</b></span>
                      <span>РџСЂРёРѕСЂРёС‚РµС‚: <b>{pp.priority}</b></span>
                    </div>
                  </div>
                );
              })()}
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: `${diffColor}22`, color: diffColor, fontWeight: 600 }}>{diffLabel} {difficultyScore}/10</span>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{day.duration} РјРёРЅ</span>
                        </div>
                      </div>
                      {autoRegNote && (
                        <div style={{ fontSize: 9, color: adjRecovery < 0.4 ? '#ef4444' : adjRecovery < 0.6 ? '#ff9100' : '#22c55e', marginBottom: 3, background: `${adjRecovery < 0.4 ? '#ef4444' : adjRecovery < 0.6 ? '#ff9100' : '#22c55e'}11`, padding: '2px 6px', borderRadius: 3 }}>
                          {autoRegNote}
                        </div>
                      )}
                      {labWarnings.length > 0 && labWarnings.map((w, wi) => (
                        <div key={wi} style={{ fontSize: 9, color: '#ef4444', marginBottom: 3, background: 'rgba(239,68,68,0.08)', padding: '2px 6px', borderRadius: 3 }}>
                          {w}
                        </div>
                      ))}
                      <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 3, padding: '1px 4px', background: 'rgba(255,165,2,0.05)', borderRadius: 3 }}>
                        рџЌЋ {goal === 'bulk' ? 'РџСЂРѕС„РёС†РёС‚ 5-10%, Р±РµР»РѕРє 1.8-2.2 Рі/РєРі, СѓРіР»РµРІРѕРґС‹ РІРѕРєСЂСѓРі С‚СЂРµРЅРёСЂРѕРІРєРё.' : goal === 'cut' ? 'Р”РµС„РёС†РёС‚ 10-20%, Р±РµР»РѕРє 2.0-2.4 Рі/РєРі, СѓРіР»РµРІРѕРґС‹ РґРѕ/РїРѕСЃР»Рµ С‚СЂРµРЅРёСЂРѕРІРєРё.' : goal === 'strength' ? 'РџРѕРґРґРµСЂР¶РёРІР°Р№С‚Рµ РєР°Р»РѕСЂРёРё РѕРєРѕР»Рѕ TDEE Рё РґРµСЂР¶РёС‚Рµ СѓРіР»РµРІРѕРґС‹ РїРµСЂРµРґ С‚СЏР¶С‘Р»С‹РјРё РїРѕРґС…РѕРґР°РјРё.' : 'РљР°Р»РѕСЂРёРё РѕРєРѕР»Рѕ TDEE, Р±РµР»РѕРє 1.8-2.2 Рі/РєРі, СЃС‚Р°Р±РёР»СЊРЅС‹Р№ СЂРµР¶РёРј РїРёС‚Р°РЅРёСЏ.'}
                      </div>
                      {day.exercises.map((ex: any, ei: number) => {
                        const scheme = selectSetScheme({
                          goal, movementPattern: 'squat' as MovementPattern, difficultyLevel: level === 'beginner' ? 'low' : level === 'intermediate' ? 'medium' : 'high',
                          techniqueIssues: [], riskFlags: {}, fatigueScore: fatigue / 10, repPattern: 'normal', isPrimaryLift: ei === 0,
                        });
                        const tempo = selectTempo(goal, [], {}, ex.isCompound);
                        const exCat = EXERCISE_CATALOG.find(ec => ec.id === ex.exerciseId || ec.name === ex.name);
                        const estMax = ex.weight ? Math.round(ex.weight * (1 + Number(ex.reps) / 30)) : 0;
                        const substitute = exCat?.canReplace?.[0] ? EXERCISE_CATALOG.find(e => e.id === exCat.canReplace![0]) : null;
                        const role = ei === 0 ? 'main' : ei <= 2 ? 'secondary' : 'accessory';
                        const roleColor = role === 'main' ? '#ef4444' : role === 'secondary' ? '#f97316' : '#6b7280';
                        const roleLabel = role === 'main' ? 'РћРЎРќ' : role === 'secondary' ? 'Р”РћРџ' : 'РђРљРЎ';
                        const restSec = ei === 0 ? (goal === 'strength' ? 180 : 120) : ei <= 2 ? 90 : 60;
                        return (
                        <div key={ei} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', fontSize: 10, borderBottom: ei < day.exercises.length - 1 ? '1px solid var(--border)' : 'none', gap: 2 }}>
                          <span style={{ fontSize: 7, padding: '1px 3px', borderRadius: 2, background: `${roleColor}22`, color: roleColor, fontWeight: 700, minWidth: 22, textAlign: 'center', flexShrink: 0 }}>{roleLabel}</span>
                          <span style={{ flex: 1 }} title={ex.technique || ''}>{ex.name}</span>
                          <span style={{ color: 'var(--accent)', fontWeight: 600, minWidth: 55, textAlign: 'right' }}>{ex.sets}Г—{ex.reps}</span>
                          {estMax > 0 && <span style={{ fontSize: 8, color: '#00e68a', minWidth: 40, textAlign: 'right' }}>~{estMax}РєРі</span>}
                          <span style={{ fontSize: 8, color: 'var(--text-dim)', minWidth: 25, textAlign: 'right' }}>RIR{ex.rir}</span>
                          <span style={{ fontSize: 6, padding: '1px 2px', borderRadius: 2, background: 'rgba(0,230,138,0.1)', color: '#00e68a', whiteSpace: 'nowrap' }}>{scheme?.schemeType?.slice(0, 6) || 'вЂ”'}</span>
                          <span style={{ fontSize: 6, padding: '1px 2px', borderRadius: 2, background: 'rgba(249,115,22,0.1)', color: '#f97316', whiteSpace: 'nowrap' }}>вЏ±{restSec}СЃ</span>
                          {substitute && <span style={{ fontSize: 6, color: 'var(--text-dim)', maxWidth: 50, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={``}>в†”{substitute.name.slice(0, 8)}</span>}
                        </div>
                        );
                      })}
                      {/* Rotation suggestion for main lifts */}
                      {day.exercises?.filter((e: any) => e.isCompound).slice(0, 2).map((ex: any, ei: number) => {
                        const cat = EXERCISE_CATALOG.find(ec => ec.id === ex.exerciseId || ec.name === ex.name);
                        const alts = cat?.canReplace?.filter(r => !day.exercises.some((de: any) => de.exerciseId === r || de.name === r)).slice(0, 2) || [];
                        if (alts.length === 0) return null;
                        return (
                          <div key={`rot-${ei}`} style={{ fontSize: 8, color: 'var(--text-dim)', padding: '1px 0', marginLeft: 26, marginBottom: 1 }}>
                            <span style={{ color: '#8b5cf6' }}>рџ”„ {ex.name.slice(0, 12)} в†’ </span>
                            {alts.map((a: string, ai: number) => {
                              const altEx = EXERCISE_CATALOG.find(e => e.id === a);
                              return <span key={ai}>{altEx?.name || a}{ai < alts.length - 1 ? ', ' : ''}</span>;
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                  <div style={{ marginTop: 4, padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, fontSize: 9, color: 'var(--text-dim)' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                         {PHASE_HINTS[currentMicrocycle.mesocycleType] || 'РЎР»РµРґСѓР№С‚Рµ Р·Р°РґР°РЅРЅС‹Рј РїРѕРґС…РѕРґР°Рј, РїРѕРІС‚РѕСЂР°Рј Рё RIR.'}
                      </span>
                    </div>
                </div>
              )}

              {/* Quick week summary */}
              {currentMicrocycle && (
                <div className="card" style={{ padding: '8px 10px' }}>
                  <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>рџ“‹ РЎРІРѕРґРєР° РЅРµРґРµР»Рё {selectedWeek}</div>
                  {(() => {
                    const days = currentMicrocycle.days.filter((d: any) => d.isTraining);
                    const totalSets = days.reduce((s: number, d: any) => s + (d.exercises?.reduce((ss: number, e: any) => ss + (e.sets || 0), 0) || 0), 0);
                    const totalReps = days.reduce((s: number, d: any) => s + (d.exercises?.reduce((ss: number, e: any) => ss + (parseInt(String(e.reps)) || 0) * (e.sets || 0), 0) || 0), 0);
                    const totalTonnage = days.reduce((s: number, d: any) => s + (d.exercises?.reduce((ss: number, e: any) => ss + (e.sets || 0) * (parseInt(String(e.reps)) || 0) * (e.weight || 0), 0) || 0), 0);
                    const totalMin = days.reduce((s: number, d: any) => s + (d.duration || 0), 0);
                    const density = totalMin > 0 ? Math.round(totalTonnage / totalMin) : 0;
                    return (
                      <div key="week-summary" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 4, fontSize: 10 }}>
                        <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}>
                          <div style={{ color: 'var(--text-dim)' }}>Р”РЅРµР№</div>
                          <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{days.length}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}>
                          <div style={{ color: 'var(--text-dim)' }}>РџРѕРґС…РѕРґРѕРІ</div>
                          <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{totalSets}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}>
                          <div style={{ color: 'var(--text-dim)' }}>РџРѕРІС‚РѕСЂРѕРІ</div>
                          <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{totalReps}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}>
                          <div style={{ color: 'var(--text-dim)' }}>РўРѕРЅРЅР°Р¶</div>
                          <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{totalTonnage > 0 ? `${(totalTonnage / 1000).toFixed(1)}С‚` : 'вЂ”'}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}>
                          <div style={{ color: 'var(--text-dim)' }}>РџР»РѕС‚РЅРѕСЃС‚СЊ</div>
                          <div style={{ fontWeight: 700, color: density > 50 ? '#22c55e' : density > 25 ? '#ff9100' : '#ef4444' }}>{density} РєРі/РјРёРЅ</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Weekly training calendar (TZ) */}
              {currentMicrocycle && (
                <div className="card" style={{ padding: '10px 12px', marginTop: 8 }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>рџ“… РљР°Р»РµРЅРґР°СЂСЊ РЅРµРґРµР»Рё</h4>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {['РџРЅ', 'Р’С‚', 'РЎСЂ', 'Р§С‚', 'РџС‚', 'РЎР±', 'Р’СЃ'].map((dayName, di) => {
                      const day = currentMicrocycle.days.find((d: any) => d.isTraining && d.day?.includes(dayName));
                      const isTraining = !!day;
                      return (
                        <div key={di} style={{
                          flex: 1, textAlign: 'center', padding: '4px 2px', borderRadius: 6, fontSize: 9,
                          background: isTraining ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.02)',
                          border: isTraining ? '1px solid rgba(0,230,138,0.2)' : '1px solid var(--border)',
                          color: isTraining ? 'var(--accent)' : 'var(--text-dim)',
                          fontWeight: isTraining ? 600 : 400,
                        }}>
                          <div>{dayName}</div>
                          {isTraining && <div style={{ fontSize: 7, marginTop: 1 }}>{day?.exercises?.length || 0} СѓРїСЂ</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cooldown */}
              {showCooldown && currentMicrocycle && currentMicrocycle.days.length > 0 && (() => {
                const cdInput = {
                  muscleGroupsUsed: currentMicrocycle.days[0]?.exercises?.map((e: any) => e.group).filter(Boolean) || [],
                  fatigueScore: fatigue / 10,
                  riskFlags: {} as Record<string, string>,
                  sessionDuration: currentMicrocycle.days[0]?.duration || 60,
                };
                const cooldown = generateCooldown(cdInput);
                return (
                  <div key="cooldown" className="card" style={{ padding: '8px 10px', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#3b82f6', marginBottom: 4 }}>рџ§Љ Р—Р°РјРёРЅРєР°</div>
                    {cooldown.map((b, bi) => (
                      <div key={bi} style={{ fontSize: 10, marginBottom: 2, color: 'var(--text-dim)' }}>
                        <span style={{ fontWeight: 600, color: '#3b82f6' }}>
                          {b.type === 'breathing' ? 'Р”С‹С…Р°РЅРёРµ' : b.type === 'stretch' ? 'Р Р°СЃС‚СЏР¶РєР°' : 'Р—Р°РјРёРЅРєР°'} ({b.durationSec}СЃ)
                        </span>
                        {b.exercises?.map((ex, exi) => (
                          <span key={exi} style={{ marginLeft: 6, color: 'var(--text-dim)' }}>
                            {WARMUP_LABELS[ex.exerciseId] || ex.exerciseId.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })(              )}

              {/* Custom added exercises */}
              {customExercises.length > 0 && (
                <div className="card" style={{ padding: '8px 10px', border: '1px dashed rgba(139,92,246,0.3)' }}>
                  <div style={{ fontWeight: 600, fontSize: 11, color: '#8b5cf6', marginBottom: 4 }}>рџ“ќ Р”РѕР±Р°РІР»РµРЅРЅС‹Рµ ({customExercises.length})</div>
                  {customExercises.map((ce, ci) => (
                    <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, padding: '2px 0', borderBottom: ci < customExercises.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span>{ce.name}</span>
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{ce.sets}Г—{ce.reps}</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: 9 }}>RIR {ce.rir}</span>
                      <button onClick={() => setCustomExercises(customExercises.filter((_, i) => i !== ci))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, padding: 0 }}>Г—</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Intensity zone distribution (TZ) */}
              {currentMicrocycle?.days && (
                <div className="card" style={{ padding: '8px 10px', marginTop: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>рџ“Љ Р—РѕРЅС‹ РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚Рё</div>
                  {(() => {
                    const reps = currentMicrocycle.days.filter((d: any) => d.isTraining)
                      .flatMap((d: any) => d.exercises?.map((e: any) => parseInt(String(e.reps)) || 8) || []) || [];
                    const str = reps.filter(r => r >= 1 && r <= 6).length;
                    const hyp = reps.filter(r => r >= 7 && r <= 12).length;
                    const end = reps.filter(r => r >= 13).length;
                    const total = reps.length || 1;
                    return (
                      <div key="intensity-zones">
                        <div style={{ display: 'flex', gap: 2, height: 18, borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>
                          <div style={{ flex: str || 0.1, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 600, minWidth: str > 0 ? 20 : 0 }}>
                            {str > 0 ? `${Math.round((str/total)*100)}%` : ''}
                          </div>
                          <div style={{ flex: hyp || 0.1, background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 600, minWidth: hyp > 0 ? 20 : 0 }}>
                            {hyp > 0 ? `${Math.round((hyp/total)*100)}%` : ''}
                          </div>
                          <div style={{ flex: end || 0.1, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 600, minWidth: end > 0 ? 20 : 0 }}>
                            {end > 0 ? `${Math.round((end/total)*100)}%` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 9, color: 'var(--text-dim)' }}>
                          <span>рџ”ґ РЎРёР»Р° ({str})</span><span>рџџў Р“РёРїРµСЂС‚СЂРѕС„РёСЏ ({hyp})</span><span>рџ”µ Р’С‹РЅРѕСЃР»РёРІРѕСЃС‚СЊ ({end})</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Workout nutrition tips */}
              <div className="card" style={{ padding: '8px 10px', border: '1px solid rgba(255,165,2,0.2)', marginTop: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 11, color: '#ffa502', marginBottom: 4 }}>рџЌЋ РџРёС‚Р°РЅРёРµ РІРѕРєСЂСѓРі С‚СЂРµРЅРёСЂРѕРІРєРё</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                  {goal === 'bulk' ? 'Р—Р° 60-120 РјРёРЅСѓС‚ РґРѕ С‚СЂРµРЅРёСЂРѕРІРєРё: СѓРіР»РµРІРѕРґС‹ + Р±РµР»РѕРє. РџРѕСЃР»Рµ: Р±РµР»РѕРє 30-40 Рі Рё СѓРіР»РµРІРѕРґС‹ РїРѕ Р°РїРїРµС‚РёС‚Сѓ.' :
                   goal === 'cut' ? 'РџРµСЂРµРґ С‚СЂРµРЅРёСЂРѕРІРєРѕР№ РѕСЃС‚Р°РІСЊС‚Рµ С‡Р°СЃС‚СЊ РґРЅРµРІРЅС‹С… СѓРіР»РµРІРѕРґРѕРІ. РџРѕСЃР»Рµ С‚СЂРµРЅРёСЂРѕРІРєРё РґРµСЂР¶РёС‚Рµ Р±РµР»РѕРє Рё РЅРµ РїСЂРµРІС‹С€Р°Р№С‚Рµ РґРµС„РёС†РёС‚.' :
                   goal === 'strength' ? 'РџРµСЂРµРґ С‚СЏР¶С‘Р»РѕР№ СЃРµСЃСЃРёРµР№ РґРѕР±Р°РІСЊС‚Рµ Р±С‹СЃС‚СЂС‹Рµ СѓРіР»РµРІРѕРґС‹ Рё СЃРѕР»СЊ; РїРѕСЃР»Рµ РІРѕСЃСЃС‚Р°РЅРѕРІРёС‚Рµ Р¶РёРґРєРѕСЃС‚СЊ Рё Р±РµР»РѕРє.' :
                   'Р”РµСЂР¶РёС‚Рµ СЃС‚Р°Р±РёР»СЊРЅС‹Р№ Р±РµР»РѕРє Рё СЂР°СЃРїСЂРµРґРµР»СЏР№С‚Рµ СѓРіР»РµРІРѕРґС‹ РІРѕРєСЂСѓРі СЃР°РјС‹С… С‚СЏР¶С‘Р»С‹С… С‚СЂРµРЅРёСЂРѕРІРѕРє.'}
                </div>
              </div>

              {/* Strength balance (TZ 38) */}
              {trainingOutput.volumePerGroup && (() => {
                const groups = trainingOutput.volumePerGroup as Record<string, number>;
                const pushVol = (groups.chest || 0) + (groups.shoulders || 0);
                const pullVol = (groups.back || 0);
                const quadVol = groups.legs || 0;
                const ratio = pullVol > 0 ? (pushVol / pullVol).toFixed(1) : 'вЂ”';
                const balanced = parseFloat(ratio as string) >= 0.8 && parseFloat(ratio as string) <= 1.2;
                return (
                  <div key="strength-balance" className="card" style={{ padding: '8px 10px', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <div style={{ fontWeight: 600, fontSize: 11, color: '#8b5cf6', marginBottom: 4 }}>вљ–пёЏ Р‘Р°Р»Р°РЅСЃ РЅР°РіСЂСѓР·РєРё</div>
                    <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text-dim)' }}>
                      <span>Push/Pull: <b style={{ color: balanced ? '#22c55e' : '#ff9100' }}>{ratio}</b> {balanced ? 'вњ“' : 'вљ '}</span>
                      <span>РќРѕРіРё/Р’РµСЂС…: <b>{(quadVol / Math.max(1, pushVol + pullVol)).toFixed(1)}</b></span>
                    </div>
                  </div>
                );
              })(                  )}

              {/* Overtraining risk assessment */}
              {currentMicrocycle && (() => {
                const acRatio = currentMicrocycle.volumeMultiplier * 100 / 85;
                const riskScore = (acRatio > 120 ? 3 : acRatio > 100 ? 1 : 0) + (sleepHours < 6 ? 2 : sleepHours < 7 ? 1 : 0) + (stressLevel > 7 ? 2 : stressLevel > 5 ? 1 : 0);
                const riskLabel = riskScore >= 5 ? 'рџљЁ Р’С‹СЃРѕРєРёР№ СЂРёСЃРє РїРµСЂРµРіСЂСѓР·РєРё' : riskScore >= 3 ? 'вљ пёЏ РЈРјРµСЂРµРЅРЅС‹Р№ СЂРёСЃРє' : riskScore >= 1 ? 'вљЎ РџРѕРІС‹С€РµРЅРЅР°СЏ РЅР°РіСЂСѓР·РєР°' : '';
                if (!riskLabel) return null;
                return (
                  <div key="overtraining-risk" className="card" style={{ padding: '6px 10px', border: `1px solid ${riskScore >= 5 ? 'rgba(239,68,68,0.3)' : 'rgba(255,145,0,0.3)'}`, background: riskScore >= 5 ? 'rgba(239,68,68,0.05)' : 'rgba(255,145,0,0.05)' }}>
                    <div style={{ fontSize: 10, color: riskScore >= 5 ? '#ef4444' : '#ff9100', fontWeight: 600 }}>
                      {riskLabel} вЂ” {riskScore >= 5 ? 'СЃРЅРёР·СЊС‚Рµ РѕР±СЉС‘Рј Рё РґРѕР±Р°РІСЊС‚Рµ РѕС‚РґС‹С…' : riskScore >= 3 ? 'РєРѕРЅС‚СЂРѕР»РёСЂСѓР№С‚Рµ СЃРѕРЅ, СЃС‚СЂРµСЃСЃ Рё RPE' : 'СЃР»РµРґРёС‚Рµ Р·Р° РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµРј'}
                    </div>
                  </div>
                );
              })()}

              {trainingOutput.volumePerGroup && (
                <div className="card" style={{ padding: '10px 12px' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>рџ“Љ РћР±СЉС‘Рј РїРѕ РіСЂСѓРїРїР°Рј</h4>
                  {Object.entries(trainingOutput.volumePerGroup).map(([g, v]) => (
                    <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, minWidth: 50 }}>{GROUP_LABELS[g] || g}</span>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, v / 2)}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)', minWidth: 40, textAlign: 'right' }}>{v} РїРѕРґС…</span>
                    </div>
                  ))}
                  {trainingOutput.estimatedProgress !== undefined && (
                    <div style={{ marginTop: 6, padding: '6px 8px', background: 'rgba(0,230,138,0.05)', borderRadius: 6, fontSize: 10 }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>рџ“€ РџСЂРѕРіСЂРµСЃСЃ: +{trainingOutput.estimatedProgress}%/РЅРµРґ</span>
                      <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>
                        {trainingOutput.progressionModel || 'вЂ”'} В· {cycleType === 'auto' ? 'РђРІС‚РѕС†РёРєР»' : cycleType}
                      </span>
                      <span style={{ color: 'var(--text-dim)', marginLeft: 6, fontSize: 9 }}>
                        {goal} В· {periodizationType !== 'auto' ? periodizationType : ''}
                      </span>
                    </div>
                  )}
                  {/* Workload ratio + Monotony/Strain (TZ 71-72) */}
                  {currentMicrocycle && (
                    <div style={{ marginTop: 4, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, fontSize: 9 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-dim)' }}>рџ”¬ РќР°РіСЂСѓР·РєР°: </span>
                      <span style={{ color: 'var(--accent)' }}>РћСЃС‚СЂР°СЏ: {Math.round(currentMicrocycle.volumeMultiplier * bodyWeight * daysPerWeek)} РєРі/РЅРµРґ</span>
                      <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>
                        РҐСЂРѕРЅ.: {Math.round(currentMicrocycle.volumeMultiplier * bodyWeight * daysPerWeek * 0.85)} РєРі/РЅРµРґ
                      </span>
                      <span style={{ marginLeft: 4, color: currentMicrocycle.volumeMultiplier > 1.2 ? '#ef4444' : currentMicrocycle.mesocycleType === 'deload' ? '#22c55e' : '#ff9100' }}>
                        A/C: {(currentMicrocycle.volumeMultiplier * 100 / 85).toFixed(0)}%
                      </span>
                      {currentMicrocycle.volumeMultiplier > 1.3 && (
                        <span style={{ marginLeft: 4, color: '#ef4444', fontWeight: 600 }}>вљ  Р’С‹СЃРѕРєРёР№ СЂРёСЃРє РїРµСЂРµРіСЂСѓР·РєРё</span>
                      )}
                      <span style={{ marginLeft: 4, color: sleepHours < 6 ? '#ef4444' : sleepHours < 7 ? '#ff9100' : '#22c55e' }}>
                        РЎРѕРЅ: {sleepHours}С‡ | РЎС‚СЂРµСЃСЃ: {stressLevel}/10
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        </InfoErrorBoundary>
      )}

      {/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ RUNTIME (Live Workout) в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */}
      {tab === 'runtime' && (
        <InfoErrorBoundary label="РўСЂРµРЅРёСЂРѕРІРєР°">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Р—Р°РїСѓСЃРє РїРѕСЃС‚СЂРѕРµРЅРЅРѕРіРѕ РїР»Р°РЅР° РЎР Р¦/Р‘Р‘ (РїРµСЂРµРЅРµСЃРµРЅРѕ РёР· РїРѕРґРІРєР»Р°РґРєРё В«Р’С‹РїРѕР»РЅРµРЅРёРµВ») */}
          {plRuntime && plRuntime.days.length > 0 && !plRunOpen && !runtimeStarted && (
            <div className="card" style={{ padding: '12px', border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--accent)' }}>в–¶ Р—Р°РїСѓСЃС‚РёС‚СЊ РїРѕСЃС‚СЂРѕРµРЅРЅС‹Р№ РїР»Р°РЅ ({plRuntime.track === 'bb' ? 'Р‘Р‘' : 'РџР›'})</h3>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 8px' }}>РќРµРґРµР»СЏ {plRuntime.week} В· {plRuntime.days.length} РґРЅ. В· С„РѕРєСѓСЃ: {plRuntime.focus}. Р’С‹РїРѕР»РЅРµРЅРёРµ Р·Р°РїРёСЃС‹РІР°РµС‚СЃСЏ РІ РґРЅРµРІРЅРёРє С‚СЂРµРЅРёСЂРѕРІРѕРє.</p>
              <button onClick={() => setPlRunOpen(true)} style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, var(--accent), #00c853)', color: '#000', fontWeight: 700, fontSize: 14 }}>в–¶ РќР°С‡Р°С‚СЊ РІС‹РїРѕР»РЅРµРЅРёРµ</button>
            </div>
          )}
          {plRunOpen && plRuntime && plRuntime.days.length > 0 && (
            <div className="card" style={{ padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 13, color: 'var(--accent)' }}>в–¶ Р’С‹РїРѕР»РЅРµРЅРёРµ РїР»Р°РЅР° В· {plRuntime.focus}</h3>
                <button onClick={() => setPlRunOpen(false)} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11 }}>вњ• Р—Р°РєСЂС‹С‚СЊ</button>
              </div>
              <SessionPlayer days={plRuntime.days} weekNumber={plRuntime.week} focus={plRuntime.focus} />
            </div>
          )}
          {!runtimeStarted ? (
            <div className="card" style={{ padding: '12px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>рџЏѓ РќР°С‡Р°С‚СЊ С‚СЂРµРЅРёСЂРѕРІРєСѓ</h3>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 10px' }}>
                Р’С‹Р±РµСЂРёС‚Рµ РґРµРЅСЊ РёР· РїР»Р°РЅР° РґР»СЏ РѕС‚СЃР»РµР¶РёРІР°РЅРёСЏ РїРѕРґС…РѕРґРѕРІ РІ СЂРµР°Р»СЊРЅРѕРј РІСЂРµРјРµРЅРё.
              </p>
              {macrocycle && currentMicrocycle ? (
                <>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                    {currentMicrocycle.days.filter((d: any) => d.isTraining).map((day: any, di: number) => (
                      <button key={di} onClick={() => setRuntimeDay(di)} style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: runtimeDay === di ? 700 : 400, cursor: 'pointer',
                        background: runtimeDay === di ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: runtimeDay === di ? '#000' : 'var(--text)', border: '1px solid ' + (runtimeDay === di ? 'var(--accent)' : 'var(--border)'),
                      }}>{day.day}</button>
                    ))}
                  </div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay]?.exercises?.length || 0} СѓРїСЂР°Р¶РЅРµРЅРёР№ вЂў {currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay]?.duration || 60} РјРёРЅ
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                РРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ: {currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay]?.intensity || 'СЃСЂРµРґРЅСЏСЏ'} | РЎС…РµРјР°: {(currentMicrocycle as any).mesocycleType || ''}
              </div>
              <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2, fontWeight: 600 }}>
                Р Р°СЃС‡С‘С‚РЅС‹Р№ С‚РѕРЅРЅР°Р¶: {currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay]?.exercises?.reduce((sum: number, ex: any) => sum + (ex.sets || 0) * (Number(ex.reps) || 0) * (ex.weight || 0), 0) || 0} РєРі
              </div>
            </div>
                  {/* Session difficulty estimate */}
                  {(() => {
                    const dayExercises = currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay]?.exercises || [];
                    const totalSets = dayExercises.reduce((s: number, e: any) => s + (e.sets || 0), 0);
                    const avgIntensity = dayExercises.length > 0
                      ? dayExercises.reduce((s: number, e: any) => s + (e.intensity || 70), 0) / dayExercises.length
                      : 70;
                    const difficulty = totalSets > 25 ? 'РѕС‡РµРЅСЊ С‚СЏР¶С‘Р»Р°СЏ' : totalSets > 15 ? 'СЃСЂРµРґРЅСЏСЏ' : 'Р»С‘РіРєР°СЏ';
                    const color = totalSets > 25 ? '#ef4444' : totalSets > 15 ? '#f59e0b' : '#22c55e';
                    return (
                      <div style={{ fontSize: 10, margin: '6px 0', padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
                        <span style={{ color: 'var(--text-dim)' }}>РЎР»РѕР¶РЅРѕСЃС‚СЊ: </span>
                        <span style={{ fontWeight: 600, color }}>{difficulty}</span>
                        <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>В· {totalSets} РїРѕРґС…РѕРґРѕРІ В· ~{avgIntensity.toFixed(0)}% СЃСЂ.</span>
                        {totalSets > 25 && (
                          <div style={{ color: '#f97316', marginTop: 2 }}>вљ  Р’С‹СЃРѕРєРёР№ РѕР±СЉС‘Рј вЂ” РѕС‚РґС‹С… в‰Ґ 3 РјРёРЅ РјРµР¶РґСѓ РїРѕРґС…РѕРґР°РјРё</div>
                        )}
                      </div>
                    );
                  })()}
                  <button onClick={() => { setRuntimeStarted(true); setRuntimeLogs({}); setRuntimeExIdx(0); }} style={{
                    width: '100%', padding: 12, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, var(--accent), #00c853)', color: '#000', fontWeight: 700, fontSize: 14,
                  }}>в–¶ РЎС‚Р°СЂС‚</button>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 11 }}>
                  РЎРЅР°С‡Р°Р»Р° СЃРіРµРЅРµСЂРёСЂСѓР№С‚Рµ РїР»Р°РЅ РІРѕ РІРєР»Р°РґРєРµ рџ“‹ РџР»Р°РЅ
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Active workout */}
              {currentMicrocycle && (() => {
                const day = currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay];
                if (!day) return null;
                const exercises = day.exercises || [];
                const ex = exercises[runtimeExIdx];
                if (!ex) return (
                  <div className="card" style={{ textAlign: 'center', padding: 20 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>рџЏ†</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>РўСЂРµРЅРёСЂРѕРІРєР° Р·Р°РІРµСЂС€РµРЅР°!</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
                      {Object.values(runtimeLogs).filter(l => l.completed).length} РёР· {exercises.length} СѓРїСЂР°Р¶РЅРµРЅРёР№ РІС‹РїРѕР»РЅРµРЅРѕ
                    </div>
                    {/* Summary stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12, fontSize: 10 }}>
                      {(() => {
                        const totalSets = Object.values(runtimeLogs).reduce((s, l) => s + l.sets.length, 0);
                        const totalVolume = Object.values(runtimeLogs).reduce((s, l) => s + l.sets.reduce((ss, st) => ss + st.weight * st.reps, 0), 0);
                        const max1RM = Object.values(runtimeLogs).reduce((max, l) => {
                          const local = l.sets.reduce((m, st) => Math.max(m, Math.round(st.weight * (1 + st.reps / 30))), 0);
                          return Math.max(max, local);
                        }, 0);
                        return (
                          <>
                            <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 6, padding: 6 }}>
                              <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>РџРѕРґС…РѕРґРѕРІ</div>
                              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{totalSets}</div>
                            </div>
                            <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 6, padding: 6 }}>
                              <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>РўРѕРЅРЅР°Р¶</div>
                              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{totalVolume.toLocaleString()} РєРі</div>
                            </div>
                            <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 6, padding: 6 }}>
                              <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>РњР°РєСЃ 1RM</div>
                              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{max1RM} РєРі</div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button onClick={async () => {
                        // Save completed workout to IndexedDB
                        const completedExercises = Object.entries(runtimeLogs)
                          .filter(([_, log]) => log.sets.length > 0)
                          .map(([exId, log]) => ({
                            exerciseId: exId,
                            exerciseName: EXERCISE_CATALOG.find(e => e.id === exId)?.name || exId,
                            sets: log.sets,
                            totalVolume: log.sets.reduce((sum, s) => sum + s.weight * s.reps, 0),
                            maxWeight: Math.max(...log.sets.map(s => s.weight), 0),
                            estimated1RM: log.sets.length > 0
                              ? Math.round(log.sets[log.sets.length - 1].weight * (1 + log.sets[log.sets.length - 1].reps / 30))
                              : 0,
                          }));
                        const totalVolume = completedExercises.reduce((s, e) => s + e.totalVolume, 0);
                        if (completedExercises.length > 0) {
                          const dateStr = new Date().toISOString().split('T')[0];
                          const ts = Date.now();
                          const strengthEntries = completedExercises.map((ex, i) => ({
                            id: `log_${ts}_${i}`,
                            date: dateStr,
                            exerciseId: ex.exerciseId,
                            exerciseName: ex.exerciseName,
                            sets: ex.sets,
                            totalVolume: ex.totalVolume,
                            estimated1RM: ex.estimated1RM,
                            isCompound: EXERCISE_CATALOG.find(e => e.id === ex.exerciseId)?.type === 'compound',
                            weekNumber: selectedWeek,
                          }));
                          await diary.saveWorkoutLog({
                            id: `workout_${ts}`,
                            date: dateStr,
                            duration: Math.round(runtimeExIdx * 5 + completedExercises.reduce((s, e) => s + e.sets.length, 0) * 3),
                            exercises: strengthEntries,
                            overallRPE: 7,
                            recoveryBefore: recovery,
                            split: trainingOutput?.splitName || 'custom',
                            weekNumber: selectedWeek,
                          });
                          for (const se of strengthEntries) {
                            await diary.saveStrengthLog(se);
                          }
                          // Reload stats and history
                          await loadDiaryStats();
                        }
                        setRuntimeStarted(false);
                        setRuntimeLogs({});
                      }} style={{
                        padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 13,
                      }}>вњ“ Р—Р°РІРµСЂС€РёС‚СЊ</button>
                    </div>
                  </div>
                );

                const log = runtimeLogs[ex.exerciseId || ex.name] || { sets: [], completed: false };
                const totalSets = ex.sets || 3;
                const currentSet = log.sets.length + 1;

                const last1RM = log.sets.length > 0
                  ? Math.round(log.sets[log.sets.length - 1].weight * (1 + log.sets[log.sets.length - 1].reps / 30))
                  : 0;

                const estimatedVolume = log.sets.reduce((s, st) => s + st.weight * st.reps, 0);
                const avgRPE = log.sets.length > 0 ? Math.round(log.sets.reduce((s, st) => s + st.rpe, 0) / log.sets.length * 10) / 10 : 0;

                const scheme = selectSetScheme({
                  goal, movementPattern: 'squat' as MovementPattern, difficultyLevel: level === 'beginner' ? 'low' : level === 'intermediate' ? 'medium' : 'high',
                  techniqueIssues: [], riskFlags: {}, fatigueScore: 0.3, repPattern: 'normal', isPrimaryLift: runtimeExIdx === 0,
                });
                const tempo = selectTempo(goal, [], {}, ex.isCompound);

                return (
                  <div className="card" style={{ padding: '10px 12px' }}>
                    {/* Exercise header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>РЈРїСЂР°Р¶РЅРµРЅРёРµ {runtimeExIdx + 1}/{exercises.length}</span>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{ex.name}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>  
                        <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(0,230,138,0.1)', color: '#00e68a' }}>{scheme?.schemeType || 'straight'}</span>
                        <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>{formatTempo(tempo)}</span>
                      </div>
                    </div>

                    {/* Target */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 4, fontSize: 10, color: 'var(--text-dim)' }}>
                      <span>Р¦РµР»СЊ: {ex.sets}Г—{ex.reps}</span>
                      <span>RIR: {ex.rir}</span>
                      {ex.weight && <span>Р’РµСЃ: {ex.weight}РєРі | ~{Math.round(ex.weight * (1 + Number(ex.reps) / 30))}РєРі 1RM</span>}
                    </div>

                    {/* Technique note */}
                    {ex.technique && (
                      <div style={{ marginBottom: 6, padding: '5px 8px', background: 'rgba(0,230,138,0.05)', borderRadius: 6, fontSize: 9, color: 'var(--text)', lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 600, color: 'var(--accent)' }}>рџЋЇ </span>{ex.technique}
                      </div>
                    )}

                    {/* Warmup ramp-up (first set only) */}
                    {log.sets.length === 0 && ex.weight && (
                      <div style={{ marginBottom: 6, padding: '5px 8px', background: 'rgba(255,145,0,0.05)', borderRadius: 6, fontSize: 9 }}>
                        <div style={{ fontWeight: 600, color: '#ff9100', marginBottom: 3 }}>рџ”Ґ Р Р°Р·РјРёРЅРѕС‡РЅС‹Рµ РїРѕРґС…РѕРґС‹</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 2, color: 'var(--text-dim)' }}>
                          {[{ pct: 20, reps: 10 }, { pct: 40, reps: 5 }, { pct: 60, reps: 3 }, { pct: 75, reps: 1 }].map(wu => (
                            <div key={wu.pct} style={{ textAlign: 'center', padding: '2px 4px', background: 'rgba(255,145,0,0.08)', borderRadius: 3 }}>
                              <div style={{ color: '#ff9100', fontWeight: 600 }}>~{Math.round((ex.weight || 80) * wu.pct / 100)}РєРі</div>
                              <div style={{ fontSize: 7 }}>{wu.reps} РїРѕРІС‚</div>
                              <div style={{ fontSize: 7 }}>{wu.pct}%</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Progress bar */}
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 6, marginBottom: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${(currentSet / totalSets) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>

                    {/* Previous sets log */}
                    {log.sets.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 2 }}>Р’С‹РїРѕР»РЅРµРЅРѕ:</div>
                        {log.sets.map((s, si) => (
                          <div key={si} style={{ display: 'flex', gap: 8, fontSize: 10, padding: '2px 0' }}>
                            <span style={{ fontWeight: 600, minWidth: 16 }}>#{si + 1}</span>
                            <span>{s.weight}РєРі Г— {s.reps}</span>
                            <span style={{ color: 'var(--text-dim)' }}>RPE {s.rpe}</span>
                            <span style={{ color: 'var(--text-dim)' }}>RIR {s.rir}</span>
                            <span style={{ color: 'var(--accent)' }}>1RM ~{Math.round(s.weight * (1 + s.reps / 30))}РєРі</span>
                          </div>
                        ))}
                        {last1RM > 0 && (
                          <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 2 }}>1RM РїРѕСЃР»РµРґРЅРёР№: {last1RM}РєРі | РћР±СЉС‘Рј: {estimatedVolume}РєРі | RPE СЃСЂ: {avgRPE}</div>
                        )}
                        {/* Autoregulation hint */}
                        {log.sets.length >= 1 && (() => {
                          const lastSet = log.sets[log.sets.length - 1];
                          let hint = '';
                          let hintColor = 'var(--text-dim)';
                          if (lastSet.rpe <= 5 && lastSet.rir >= 3) {
                            hint = 'РџРѕРґС…РѕРґ Р»С‘РіРєРёР№: РјРѕР¶РЅРѕ РґРѕР±Р°РІРёС‚СЊ 2.5-5 РєРі РёР»Рё 1-2 РїРѕРІС‚РѕСЂР° РІ СЃР»РµРґСѓСЋС‰РµРј РїРѕРґС…РѕРґРµ.';
                            hintColor = '#22c55e';
                          } else if (lastSet.rpe >= 9.5 && lastSet.rir <= 0) {
                            hint = 'РџРѕРґС…РѕРґ РЅР° РїСЂРµРґРµР»Рµ: СЃРЅРёР·СЊС‚Рµ РІРµСЃ РЅР° 5-10% РёР»Рё Р·Р°РІРµСЂС€РёС‚Рµ СѓРїСЂР°Р¶РЅРµРЅРёРµ.';
                            hintColor = '#ef4444';
                          } else if (lastSet.rpe >= 8.5 && lastSet.rir <= 1) {
                            hint = 'Р’С‹СЃРѕРєР°СЏ С‚СЏР¶РµСЃС‚СЊ: СЃРѕС…СЂР°РЅСЏР№С‚Рµ РІРµСЃ, РЅРѕ РЅРµ РёРґРёС‚Рµ РІ РѕС‚РєР°Р·.';
                            hintColor = '#f59e0b';
                          }
                          if (!hint) return null;
                          return <div style={{ fontSize: 9, color: hintColor, marginTop: 2, fontWeight: 600 }}>{hint}</div>;
                        })()}
                      </div>
                    )}

                    {/* Set input form (if not completed) */}
                    {!log.completed && (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Р’РµСЃ (РєРі)</label>
                            <input type="number" value={runtimeSetW} onChange={e => setRuntimeSetW(parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>РџРѕРІС‚РѕСЂРµРЅРёСЏ</label>
                            <input type="number" value={runtimeSetR} onChange={e => setRuntimeSetR(parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>RPE (1-10)</label>
                            <input type="number" min={1} max={10} value={runtimeSetRP} onChange={e => setRuntimeSetRP(parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>RIR</label>
                            <input type="number" min={0} max={5} value={runtimeSetRI} onChange={e => setRuntimeSetRI(parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                          </div>
                        </div>
                        <button onClick={() => {
                          const newLog = { ...log, sets: [...log.sets, { weight: runtimeSetW, reps: runtimeSetR, rpe: runtimeSetRP, rir: runtimeSetRI }] };
                          setRuntimeLogs({ ...runtimeLogs, [ex.exerciseId || ex.name]: newLog });
                        }} style={{
                          width: '100%', padding: 8, borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12,
                          marginBottom: 4,
                        }}>вњ“ Р—Р°РїРёСЃР°С‚СЊ РїРѕРґС…РѕРґ {currentSet}/{totalSets}</button>
                        <button onClick={() => {
                          const newLog = { ...log, completed: true };
                          setRuntimeLogs({ ...runtimeLogs, [ex.exerciseId || ex.name]: newLog });
                          if (runtimeExIdx < exercises.length - 1) setRuntimeExIdx(runtimeExIdx + 1);
                        }} style={{
                          width: '100%', padding: 6, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
                          background: 'transparent', color: 'var(--text-dim)', fontSize: 11,
                        }}>РџСЂРѕРїСѓСЃС‚РёС‚СЊ в†’</button>
                      </div>
                    )}
                    {log.completed && (
                      <div style={{ textAlign: 'center', padding: 8, background: 'rgba(0,230,138,0.1)', borderRadius: 6 }}>
                        <span style={{ color: '#22c55e', fontWeight: 600 }}>вњ“ Р’С‹РїРѕР»РЅРµРЅРѕ вЂ” {log.sets.length} РїРѕРґС…РѕРґР°(РѕРІ)</span>
                        <div style={{ marginTop: 6 }}>
                          <button onClick={() => {
                            if (runtimeExIdx < exercises.length - 1) setRuntimeExIdx(runtimeExIdx + 1);
                          }} style={{
                            padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 13,
                          }}>РЎР»РµРґСѓСЋС‰РµРµ СѓРїСЂР°Р¶РЅРµРЅРёРµ в†’</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
        </InfoErrorBoundary>
      )}

      {/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ EXERCISES TAB (Apple-style) в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */}
      {tab === 'exercises' && (
        <InfoErrorBoundary label="РЈРїСЂР°Р¶РЅРµРЅРёСЏ">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Search + filters */}
          <div style={{ background:'var(--bg-secondary)', borderRadius:14, padding:'8px 10px', border:'1px solid var(--border)' }}>
            <input type="text" value={exSearch} onChange={e => setExSearch(e.target.value)}
              placeholder="рџ”Ќ РџРѕРёСЃРє СѓРїСЂР°Р¶РЅРµРЅРёР№..." 
              style={{ width:'100%', padding:'10px 12px', borderRadius:10, background:'rgba(0,0,0,0.2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:13, boxSizing:'border-box', marginBottom:6 }} />
            <div style={{ display:'flex', gap:4 }}>
              {[{ key:'exGroup', val:exGroup, set:(v:string)=>setExGroup(v), opts:[['all','Р“СЂСѓРїРїР°'],...MUSCLE_GROUPS.map(g=>[g,GROUP_LABELS[g]] as [string,string])] },
                { key:'exType', val:exType, set:(v:string)=>setExType(v), opts:[['all','РўРёРї'],['compound','Р‘Р°Р·РѕРІС‹Рµ'],['isolation','РР·Рѕ']] },
                { key:'exEquipment', val:exEquipment, set:(v:string)=>setExEquipment(v), opts:[['all','РРЅРІРµРЅС‚Р°СЂСЊ'],['barbell','РЁС‚Р°РЅРіР°'],['dumbbell','Р“Р°РЅС‚РµР»Рё'],['machine','РўСЂРµРЅР°Р¶С‘СЂ'],['cable','Р‘Р»РѕРє'],['bodyweight','Р’РµСЃ']] }
              ].map(f => (
                <select key={f.key} value={f.val} onChange={e => f.set(e.target.value)} style={{ flex:1, padding:'7px 4px', borderRadius:8, background:'rgba(0,0,0,0.2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:10, fontWeight:600, textAlign:'center', minWidth:0 }}>
                  {f.opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ))}
            </div>
          </div>

          {/* Exercise list */}
          <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:'50vh', overflowY:'auto', paddingRight:2 }}>
            {filteredExercises.slice(0, 80).map(ex => {
              const isSelected = selectedEx?.id === ex.id;
              const typeIcon = ex.type === 'compound' ? 'рџ”©' : 'рџЋЇ';
              const equipIcon = { barbell:'рџЏ‹пёЏ', dumbbell:'рџ’Є', machine:'вљ™пёЏ', cable:'рџ”—', bodyweight:'рџ§' }[ex.equipment] || 'рџ“¦';
              return (
                <div key={ex.id} onClick={() => setSelectedEx(isSelected ? null : ex)} style={{
                  padding:'8px 10px', borderRadius:12, cursor:'pointer',
                  background: isSelected ? 'linear-gradient(135deg, rgba(0,230,138,0.08), rgba(59,130,246,0.04))' : 'var(--bg-secondary)',
                  border: isSelected ? '1px solid rgba(0,230,138,0.3)' : '1px solid var(--border)',
                  transition:'all 0.15s',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:32, height:32, borderRadius:10, background:isSelected?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                      {typeIcon}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:isSelected?'var(--accent)':'var(--text-light)', lineHeight:1.2 }}>{ex.name}</div>
                      <div style={{ display:'flex', gap:3, marginTop:2, flexWrap:'wrap' }}>
                        <span style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.04)', color:'var(--text-dim)' }}>{equipIcon} {EQUIP_LABELS[ex.equipment]||ex.equipment}</span>
                        <span style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.04)', color:'var(--text-dim)' }}>{GROUP_LABELS[ex.group]}</span>
                        <span style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:ex.jointStress==='high'?'rgba(239,68,68,0.08)':'rgba(34,197,94,0.08)', color:ex.jointStress==='high'?'#ef4444':'#22c55e' }}>{JOINT_LABELS[ex.jointStress]||ex.jointStress}</span>
                      </div>
                    </div>
                    <span style={{ fontSize:10, color:isSelected?'var(--accent)':'var(--text-dim)', transition:'transform 0.15s', transform:isSelected?'rotate(180deg)':'none' }}>в–ј</span>
                  </div>

                  {/* Detail panel inline (Apple bottom-sheet style) */}
                  {isSelected && (
                    <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid var(--border)' }}>
                      {/* Tags row */}
                      <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:6 }}>
                        <span style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.08)', color:'var(--accent)' }}>{ex.type==='compound'?'Р‘Р°Р·РѕРІРѕРµ':'РР·РѕР»РёСЂСѓСЋС‰РµРµ'}</span>
                        {ex.difficulty && <span style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:ex.difficulty==='advanced'?'rgba(239,68,68,0.08)':'rgba(249,115,22,0.08)', color:ex.difficulty==='advanced'?'#ef4444':ex.difficulty==='intermediate'?'#f97316':'#22c55e' }}>{ex.difficulty==='advanced'?'РџСЂРѕРґРІРёРЅСѓС‚РѕРµ':ex.difficulty==='intermediate'?'РЎСЂРµРґРЅРµРµ':'РќР°С‡Р°Р»СЊРЅРѕРµ'}</span>}
                        <span style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(139,92,246,0.08)', color:'#8b5cf6' }}>РЈСЃС‚Р°Р»РѕСЃС‚СЊ: {ex.fatigueCost}/10</span>
                        {ex.targetMuscle && <span style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(236,72,153,0.08)', color:'#ec4899' }}>рџЋЇ {ex.targetMuscle}</span>}
                      </div>
                      {/* Technique */}
                      {ex.technique && <div style={{ marginBottom:4, background:'rgba(0,230,138,0.04)', borderRadius:8, padding:'6px 8px', fontSize:10, color:'var(--text)', lineHeight:1.4 }}>рџЋЇ {ex.technique}</div>}
                      {/* Comments */}
                      {ex.comments && <div style={{ marginBottom:4, background:'rgba(255,145,0,0.04)', borderRadius:8, padding:'6px 8px', fontSize:10, color:'var(--text-dim)', lineHeight:1.4 }}>рџ’Ў {ex.comments}</div>}
                      {/* Biomechanics */}
                      {(() => { const bio = getExerciseBio(ex.id); if (!bio) return null; const js = bio.jointStress; const strs = Object.entries(js||{}).map(([k,v])=>`${k} ${v}/10`); return <div style={{ marginBottom:4, background:'rgba(59,130,246,0.04)', borderRadius:8, padding:'5px 8px', fontSize:8, color:'var(--text-dim)' }}>
                        рџ”¬ Р‘РёРѕРјРµС…Р°РЅРёРєР°: {strs.join(', ')} | РЎР»РѕР¶РЅРѕСЃС‚СЊ: {bio.difficulty}/10 | Р¦РќРЎ: {bio.cnsDemand||5}/10
                      </div>; })()}
                      {/* Replacements */}
                      {ex.canReplace && ex.canReplace.length > 0 && <div style={{ display:'flex', flexWrap:'wrap', gap:3, alignItems:'center', marginBottom:4 }}>
                        <span style={{ fontSize:8, color:'var(--text-dim)' }}>Р—Р°РјРµРЅР°:</span>
                        {ex.canReplace.map(r => { const rep = EXERCISE_CATALOG.find(e => e.id === r); return rep ? <span key={r} style={{ fontSize:8, padding:'1px 5px', borderRadius:3, background:'rgba(0,230,138,0.06)', color:'var(--accent)' }}>{rep.name}</span> : null; })}
                      </div>}
                      {/* Add to plan button */}
                      <button onClick={() => {
                        setCustomExercises([...customExercises, { name: ex.name, sets:3, reps:10, rir:2 }]);
                        setLastAddedEx(ex.id);
                        setTimeout(() => setLastAddedEx(null), 1500);
                        setSelectedEx(null);
                      }} style={{
                        width:'100%', marginTop:4, padding:'8px', borderRadius:8,
                        border: lastAddedEx === ex.id ? '1px solid rgba(0,230,138,0.5)' : '1px solid rgba(0,230,138,0.3)',
                        background: lastAddedEx === ex.id ? 'rgba(0,230,138,0.15)' : 'rgba(0,230,138,0.06)',
                        color: lastAddedEx === ex.id ? 'var(--accent)' : 'var(--accent)', fontWeight:700, fontSize:11, cursor:'pointer',
                        transition:'all 0.3s',
                      }}>{lastAddedEx === ex.id ? 'вњ“ Р”РѕР±Р°РІР»РµРЅРѕ!' : '+ Р”РѕР±Р°РІРёС‚СЊ РІ РїР»Р°РЅ'}</button>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredExercises.length === 0 && <div style={{ textAlign:'center', padding:20, color:'var(--text-dim)', fontSize:11 }}>РЈРїСЂР°Р¶РЅРµРЅРёСЏ РЅРµ РЅР°Р№РґРµРЅС‹</div>}
          </div>
        </div>
        </InfoErrorBoundary>
      )}

      {/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ CALCULATORS TAB (also serves programcalc) в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */}
      {(tab === 'calculators' || tab === 'programcalc') && (
        <InfoErrorBoundary label="РљР°Р»СЊРєСѓР»СЏС‚РѕСЂС‹">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tab === 'calculators' && <TrainingLoadCalculator />}
          {tab === 'calculators' && <TonnageCalcTab />}
          {tab === 'calculators' && <WhatIfCard baseRisk={linked.risk?.overallNet ?? 5} baseReadiness={linked.readiness?.recovery ?? 70} />}
          {showNonBuilder && (<>
          <div className="card" style={{ padding: '12px 14px', background:'rgba(20,22,30,0.35)', border:'1px solid var(--glass-border)', borderRadius:14 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 13, color:'var(--accent)' }}>рџ“ђ РљР°Р»СЊРєСѓР»СЏС‚РѕСЂ 1RM</h3>
            <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:10 }}>Р’РµСЃ Г— РџРѕРІС‚РѕСЂРµРЅРёСЏ в†’ 1РџРњ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom:3, display:'block' }}>Р’РµСЃ (РєРі)</label>
                <input type="number" value={calcWeight || ''} onChange={e => setCalcWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom:3, display:'block' }}>РџРѕРІС‚РѕСЂРµРЅРёСЏ</label>
                <input type="number" value={calcReps || ''} onChange={e => setCalcReps(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <div style={{ background: 'rgba(0,230,138,0.1)', borderRadius: 12, padding: 10, textAlign: 'center', border:'1px solid rgba(0,230,138,0.15)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Epley</div>
                <div style={{ fontSize: 20, fontWeight: 800, background:'linear-gradient(135deg, var(--accent), #00c853)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{calcResults.epley1RM.toFixed(1)}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>РєРі</div>
              </div>
              <div style={{ background: 'rgba(59,130,246,0.1)', borderRadius: 12, padding: 10, textAlign: 'center', border:'1px solid rgba(59,130,246,0.15)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Brzycki</div>
                <div style={{ fontSize: 20, fontWeight: 800, background:'linear-gradient(135deg, #3b82f6, #60a5fa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{calcResults.brzycki1RM.toFixed(1)}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>РєРі</div>
              </div>
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 12, padding: 10, textAlign: 'center', border:'1px solid rgba(0,230,138,0.15)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>РЎСЂРµРґРЅРµРµ</div>
                <div style={{ fontSize: 20, fontWeight: 800, background:'linear-gradient(135deg, #00e68a, #00cc7a)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{((calcResults.epley1RM + calcResults.brzycki1RM) / 2).toFixed(1)}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>РєРі</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>рџ“Љ RPE в†” %1RM</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р’РµСЃ (РєРі)</label>
                <input type="number" value={calcWeight} onChange={e => setCalcWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>РџРѕРІС‚РѕСЂРµРЅРёСЏ</label>
                <input type="number" value={calcReps} onChange={e => setCalcReps(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>RPE (1-10)</label>
                <input type="number" min={1} max={10} value={calcRPE} onChange={e => setCalcRPE(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>1RM (С‡РµСЂРµР· RPE)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{calcResults.rpe1RM.toFixed(1)}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>РєРі</div>
              </div>
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>%1RM РїСЂРё RPE{calcRPE}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{(calcResults.rpePercent * 100).toFixed(1)}%</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>рџЋЇ %1RM в†’ Р Р°Р±РѕС‡РёР№ РІРµСЃ</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>1RM (РєРі)</label>
                <input type="number" value={calc1RM} onChange={e => setCalc1RM(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>% РѕС‚ 1RM</label>
                <input type="number" min={30} max={100} value={calcPercent} onChange={e => setCalcPercent(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Р Р°Р±РѕС‡РёР№ РІРµСЃ ({calcPercent}% РѕС‚ {calc1RM}РєРі)</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{calcResults.percentWeight.toFixed(1)} РєРі</div>
            </div>
          </div>

          {/* Powerlifting Indexes (TZ 7.12) */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>рџЏ† РЎРёР»РѕРІС‹Рµ РёРЅРґРµРєСЃС‹ (Wilks/Dots)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              {[
                { k: plSquat, s: setPlSquat, l: 'РџСЂРёСЃРµРґ' },
                { k: plBench, s: setPlBench, l: 'Р–РёРј' },
                { k: plDeadlift, s: setPlDeadlift, l: 'РўСЏРіР°' },
                { k: plWeight, s: setPlWeight, l: 'Р’РµСЃ С‚РµР»Р°' },
              ].map(f => (
                <div key={f.l}>
                  <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>{f.l}</label>
                  <input type="number" value={f.k} onChange={e => f.s(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>РџРѕР»</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['male', 'female'] as const).map(s => (
                    <button key={s} onClick={() => setPlSex(s)} style={{
                      flex: 1, padding: '6px 4px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                      background: plSex === s ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                      border: plSex === s ? '1px solid var(--accent)' : '1px solid var(--border)',
                      color: plSex === s ? 'var(--accent)' : 'var(--text-dim)', fontWeight: plSex === s ? 700 : 400,
                    }}>{s === 'male' ? 'РњСѓР¶СЃРєРѕР№' : 'Р–РµРЅСЃРєРёР№'}</button>
                  ))}
                </div>
              </div>
            </div>
            {(() => {
              const total = plSquat + plBench + plDeadlift;
              const w = Math.max(plWeight, 30);
              const coef = plSex === 'male'
                ? { a: -216.0475144, b: 16.2606339, c: -0.002388645, d: -0.00113732, e: 7.01863e-6, f: -1.291e-8 }
                : { a: 594.31747775582, b: -27.23842536447, c: 0.82112226871, d: -0.00930733913, e: 4.731582e-5, f: -9.054e-8 };
              const denom = coef.a + coef.b * w + coef.c * w * w + coef.d * w * w * w + coef.e * w * w * w * w + coef.f * w * w * w * w * w;
              const dots = denom > 0 ? total * 500 / denom : 0;
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>РЎСѓРјРјР°</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{total} РєРі</div>
                  </div>
                  <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Dots</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#00e68a' }}>{dots.toFixed(2)}</div>
                  </div>
                  <div style={{ background: 'rgba(249,115,22,0.08)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>РћС‚РЅ. РІРµСЃ</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#f97316' }}>{(total / w).toFixed(1)}Г—</div>
                  </div>
                </div>
              );
            })()}
          </div>
          <StrengthLevelCard />

          {/* в•ђв•ђв•ђ BMI в•ђв•ђв•ђ */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>вљ–пёЏ РРЅРґРµРєСЃ РјР°СЃСЃС‹ С‚РµР»Р° (BMI)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р’РµСЃ (РєРі)</label>
                <input type="number" value={bmiWeight} onChange={e => setBmiWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р РѕСЃС‚ (СЃРј)</label>
                <input type="number" value={bmiHeight} onChange={e => setBmiHeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <button onClick={calcBMI} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Р Р°СЃСЃС‡РёС‚Р°С‚СЊ</button>
            {bmiResult !== null && (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{bmiResult.toFixed(1)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{bmiCategory(bmiResult)}</div>
              </div>
            )}
          </div>

          {/* в•ђв•ђв•ђ BMR Mifflin-St Jeor в•ђв•ђв•ђ */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>рџ”Ґ BMR (РњРёС„С„Р»РёРЅ-РЎР°РЅ Р–РµРѕСЂ)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р’РµСЃ (РєРі)</label>
                <input type="number" value={bmrWeight} onChange={e => setBmrWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р РѕСЃС‚ (СЃРј)</label>
                <input type="number" value={bmrHeight} onChange={e => setBmrHeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р’РѕР·СЂР°СЃС‚</label>
                <input type="number" value={bmrAge} onChange={e => setBmrAge(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>РџРѕР»</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['male', 'female'] as const).map(s => (
                    <button key={s} onClick={() => setBmrSex(s)} style={{
                      flex: 1, padding: '6px 4px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                      background: bmrSex === s ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                      border: bmrSex === s ? '1px solid var(--accent)' : '1px solid var(--border)',
                      color: bmrSex === s ? 'var(--accent)' : 'var(--text-dim)', fontWeight: bmrSex === s ? 700 : 400,
                    }}>{s === 'male' ? 'РњСѓР¶СЃРєРѕР№' : 'Р–РµРЅСЃРєРёР№'}</button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={calcBMR} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Р Р°СЃСЃС‡РёС‚Р°С‚СЊ</button>
            {bmrResult !== null && (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{bmrResult.toFixed(0)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>РєРєР°Р»/РґРµРЅСЊ</div>
              </div>
            )}
          </div>

          {/* в•ђв•ђв•ђ BMR Katch-McArdle в•ђв•ђв•ђ */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>рџ”Ґ BMR (РљСЌС‚С‡-РњРєР°СЂРґР»)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р’РµСЃ (РєРі)</label>
                <input type="number" value={bmrKmWeight} onChange={e => setBmrKmWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>% Р¶РёСЂР°</label>
                <input type="number" step="0.1" value={bmrKmBodyFat} onChange={e => setBmrKmBodyFat(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <button onClick={calcBMR_KM} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Р Р°СЃСЃС‡РёС‚Р°С‚СЊ</button>
            {bmrKmResult !== null && (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{bmrKmResult.toFixed(0)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>РєРєР°Р»/РґРµРЅСЊ (LBM: {(bmrKmWeight * (100 - bmrKmBodyFat) / 100).toFixed(1)} РєРі)</div>
              </div>
            )}
          </div>

          {/* в•ђв•ђв•ђ TDEE в•ђв•ђв•ђ */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>вљЎ TDEE</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>BMR (РєРєР°Р»)</label>
                <input type="number" value={tdeeBmr} onChange={e => setTdeeBmr(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>PAL</label>
                <select value={tdeePal} onChange={e => setTdeePal(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }}>
                  {PAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <button onClick={calcTDEE} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Р Р°СЃСЃС‡РёС‚Р°С‚СЊ</button>
            {tdeeResult !== null && (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{tdeeResult.toFixed(0)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>РєРєР°Р»/РґРµРЅСЊ</div>
              </div>
            )}
          </div>

          {/* в•ђв•ђв•ђ Grip Strength в•ђв•ђв•ђ */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>рџ¤љ РЎРёР»Р° С…РІР°С‚Р°</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>РЎРёР»Р° (РєРі)</label>
                <input type="number" value={gripKg} onChange={e => setGripKg(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>РџРѕР»</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['male', 'female'] as const).map(s => (
                    <button key={s} onClick={() => setGripSex(s)} style={{
                      flex: 1, padding: '6px 4px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                      background: gripSex === s ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                      border: gripSex === s ? '1px solid var(--accent)' : '1px solid var(--border)',
                      color: gripSex === s ? 'var(--accent)' : 'var(--text-dim)', fontWeight: gripSex === s ? 700 : 400,
                    }}>{s === 'male' ? 'РњСѓР¶СЃРєРѕР№' : 'Р–РµРЅСЃРєРёР№'}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р’РѕР·СЂР°СЃС‚</label>
                <input type="number" value={gripAge} onChange={e => setGripAge(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <button onClick={calcGrip} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>РћС†РµРЅРёС‚СЊ</button>
            {gripResult !== null && (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{gripResult.percentile}%</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{gripResult.level}</div>
              </div>
            )}
          </div>

          {/* в•ђв•ђв•ђ Stress (HRV) в•ђв•ђв•ђ */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>рџ§  РЎС‚СЂРµСЃСЃ (HRV)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>RMSSD / HRV (РјСЃ)</label>
                <input type="number" value={hrvValue} onChange={e => setHrvValue(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <button onClick={calcStress} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>РћС†РµРЅРёС‚СЊ</button>
            {stressResult !== null && (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{stressResult.stress}%</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{stressResult.level}</div>
              </div>
            )}
          </div>
          </>)}

          {/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђ EXERCISE GENERATOR + РџРµСЂРёРѕРґРёР·Р°С†РёСЏ (РѕР±СЉРµРґРёРЅРµРЅРѕ) в•ђв•ђв•ђв•ђв•ђв•ђв•ђ */}
          {showNonBuilder && (
            <div className="card" style={{ padding: '10px 12px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>рџЏ‹пёЏ Р“РµРЅРµСЂР°С‚РѕСЂ СѓРїСЂР°Р¶РЅРµРЅРёР№</h3>
              <ExerciseGeneratorContent />
              <div style={{ borderTop:'1px solid var(--border)', marginTop:6, paddingTop:6 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 11 }}>рџ“ђ РўРёРї РїРµСЂРёРѕРґРёР·Р°С†РёРё</h4>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap', fontSize:10, color:'var(--text-dim)' }}>
                  {[
                    { v:'auto', l:'РђРІС‚Рѕ' }, { v:'linear', l:'Р›РёРЅРµР№РЅР°СЏ' },
                    { v:'undulating', l:'DUP' }, { v:'block', l:'Р‘Р»РѕС‡РЅР°СЏ' },
                  ].map(p => (
                    <button key={p.v} onClick={() => setPeriodizationType(p.v as any)}
                      style={{
                        padding:'4px 10px', borderRadius:6, fontSize:10, fontWeight: periodizationType === p.v ? 700 : 400, cursor:'pointer',
                        border: periodizationType === p.v ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: periodizationType === p.v ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)',
                      }}>{p.l}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђ UNIFIED PROGRAM BUILDER (С‚РѕР»СЊРєРѕ РІ Р СѓС‡РЅРѕРј РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂРµ) в•ђв•ђв•ђв•ђв•ђв•ђв•ђ */}
          {tab === 'programcalc' && (<>
          <div className="card" style={{ padding: '10px 12px' }}>
            <TrainingProfileCard profile={tprofile} update={updateTProfile} />
            {(() => { const la = labTrainingAdjust(linked.labAnalysis); if (la.warnings.length === 0 && la.mrvMultiplier >= 1) return null; return <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: la.deloadRecommended ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)', border: '1px solid ' + (la.deloadRecommended ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)') }}><div style={{ fontSize: 11, fontWeight: 800, color: la.deloadRecommended ? '#ef4444' : '#f59e0b', marginBottom: 4 }}>рџ§Є Р›Р°Р±РѕСЂР°С‚РѕСЂРЅР°СЏ РєРѕСЂСЂРµРєС†РёСЏ РїР»Р°РЅР° (MRV Г—{la.mrvMultiplier.toFixed(2)})</div>{la.warnings.map((w, i) => <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4, marginBottom: 2 }}>вЂў {w}</div>)}{la.intensityNote && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{la.intensityNote}</div>}</div>; })()}
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: 'var(--accent)' }}>рџ›  Р СѓС‡РЅРѕР№ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ РїСЂРѕРіСЂР°РјРјС‹</h3>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 10 }}>Р’С‹Р±РµСЂРёС‚Рµ РїР°СЂР°РјРµС‚СЂС‹ СЃРІРµСЂС…Сѓ РІРЅРёР· Рё РЅР°Р¶РјРёС‚Рµ В«РЎРѕР±СЂР°С‚СЊ РїСЂРѕРіСЂР°РјРјСѓВ» вЂ” РїРѕР»СѓС‡РёС‚Рµ РіРѕС‚РѕРІС‹Р№ РїР»Р°РЅ РїРѕ РґРЅСЏРј.</div>
            <div style={{ background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 8 }}>вљ™пёЏ Р‘Р°Р·РѕРІС‹Рµ РїР°СЂР°РјРµС‚СЂС‹</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <PopupSelect label='Р¦РµР»СЊ' value={goal} onChange={setGoal} options={GOALS.map(g => ({ id: g.value, label: g.icon + ' ' + g.label }))} />
                <PopupSelect label='РЈСЂРѕРІРµРЅСЊ' value={level} onChange={setLevel} options={LEVELS.map(l => ({ id: l.value, label: l.icon + ' ' + l.label }))} />
                <PopupNumber label='Р”РЅРµР№ РІ РЅРµРґРµР»СЋ' value={daysPerWeek} min={2} max={6} onChange={v => setDaysPerWeek(v)} />
                <PopupSelect label='Р”Р»РёРЅР° РјРµР·РѕС†РёРєР»Р°' value={String(mesoLength)} onChange={v => setMesoLength(+v)} options={[['12','12 РЅРµРґРµР»СЊ'],['16','16 РЅРµРґРµР»СЊ'],['20','20 РЅРµРґРµР»СЊ'],['24','24 РЅРµРґРµР»Рё']].map(([id,label]) => ({ id, label }))} />
              </div>
            </div>

            {/* Р СѓС‡РЅР°СЏ РєРѕРЅС„РёРіСѓСЂР°С†РёСЏ вЂ” РІС‹Р±РѕСЂ РІСЃРµС… РїР°СЂР°РјРµС‚СЂРѕРІ РїСЂРѕРіСЂР°РјРјС‹ */}
            <div style={{ background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.15)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>вљ™пёЏ Р СѓС‡РЅР°СЏ РєРѕРЅС„РёРіСѓСЂР°С†РёСЏ РїСЂРѕРіСЂР°РјРјС‹</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <PopupSelect label="РўРёРї СЃРїР»РёС‚Р°" value={manualCfg.split || ''} onChange={v => setManual('split', v)} options={Object.entries(TRAINING_SPLITS).map(([id, s]) => ({ id, label: s.name, desc: s.desc }))} hint="Р’СЃРµ СЃРїР»РёС‚С‹ РёР· Р±РёР±Р»РёРѕС‚РµРєРё. Р’С‹Р±РѕСЂ РїРµСЂРµРѕРїСЂРµРґРµР»СЏРµС‚ Р°РІС‚Рѕ-РїРѕРґР±РѕСЂ РЅР° С€Р°РіРµ 1." />
                <PopupSelect label="РўРёРї С†РёРєР»Р°" value={manualCfg.cycle || ''} onChange={v => setManual('cycle', v)} options={LMS_CYCLES.map(c => ({ id: c.meta.id, label: c.meta.title, desc: (c.meta.id.startsWith('block') ? 'Р‘Р»РѕРє' : c.meta.id.startsWith('embed') ? 'Р’СЃС‚СЂРѕРµРЅРЅР°СЏ' : 'РЎР Р¦') + ' В· ' + c.meta.level }))} hint="Р’СЃРµ С†РёРєР»С‹ (РЎР Р¦, Р±Р»РѕРєРё, РІСЃС‚СЂРѕРµРЅРЅС‹Рµ) РїРѕ РєР°С‚РµРіРѕСЂРёСЏРј." />
                <PopupSelect label="РџСЂРѕРіСЂР°РјРјР° С‚СЂРµРЅРёСЂРѕРІРѕРє" value={manualCfg.program || ''} onChange={v => setManual('program', v)} options={[...FULL_PROGRAM_LIBRARY, ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS].map((p: any) => ({ id: p.id, label: p.name, desc: p.type + ' В· ' + p.goal + ' В· ' + p.level }))} hint="Р“РѕС‚РѕРІС‹Рµ РїСЂРѕРіСЂР°РјРјС‹ РёР· Р±РёР±Р»РёРѕС‚РµРєРё." />
                <PopupSelect label="РџРµСЂРёРѕРґРёР·Р°С†РёСЏ" value={manualCfg.periodization || ''} onChange={v => setManual('periodization', v)} options={getMethodsByCategory('periodization').map(m => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
                <PopupSelect label="РџСЂРѕРіСЂРµСЃСЃРёСЏ" value={manualCfg.progression || ''} onChange={v => setManual('progression', v)} options={getMethodsByCategory('progression').map(m => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
                <PopupSelect label="РРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ" value={manualCfg.intensity || ''} onChange={v => setManual('intensity', v)} options={getMethodsByCategory('intensity').map(m => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
                <PopupSelect label="РўРµС…РЅРёРєР°" value={manualCfg.technique || ''} onChange={v => setManual('technique', v)} options={getMethodsByCategory('technique').map(m => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
                <PopupSelect label="РћР±СЉС‘Рј" value={manualCfg.volume || ''} onChange={v => setManual('volume', v)} options={getMethodsByCategory('volume').map(m => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
                <PopupSelect label="Р§Р°СЃС‚РѕС‚Р°" value={manualCfg.frequency || ''} onChange={v => setManual('frequency', v)} options={getMethodsByCategory('frequency').map(m => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
              </div>
              {Object.values(manualCfg).some(Boolean) && <div style={{ marginTop: 8, fontSize: 10, color: 'var(--accent)' }}>вњ“ Р’С‹Р±СЂР°РЅРѕ: {Object.entries(manualCfg).filter(([, v]) => v).map(([k, v]) => k).join(' В· ')}</div>}
              {manualCfg.program && <button onClick={() => loadProgramToConstructor(manualCfg.program)} style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>рџ“Ґ Р—Р°РіСЂСѓР·РёС‚СЊ РїСЂРѕРіСЂР°РјРјСѓ РІ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ</button>}
            </div>

            {/* РљРЅРѕРїРєР° РіРµРЅРµСЂР°С†РёРё РїРѕ СЂСѓС‡РЅРѕР№ РєРѕРЅС„РёРіСѓСЂР°С†РёРё + СЂРµР·СѓР»СЊС‚Р°С‚ */}
            <div style={{ marginTop: 8 }}>

              <button onClick={generateManualPlan} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13 }}>рџ”§ РЎРѕР±СЂР°С‚СЊ РїСЂРѕРіСЂР°РјРјСѓ РїРѕ РєРѕРЅС„РёРіСѓСЂР°С†РёРё</button>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4, textAlign: 'center' }}>РЎРѕР±РµСЂС‘С‚ РїР»Р°РЅ РёР· РІС‹Р±СЂР°РЅРЅРѕРіРѕ СЃРїР»РёС‚Р° (РёР»Рё Р°РІС‚Рѕ) + С†РµР»СЊ/СѓСЂРѕРІРµРЅСЊ/РґРЅРё/РЅРµРґРµР»Рё СЃ РЅР°Р·РЅР°С‡РµРЅРёРµРј С‡РµСЂРµР· calcExercisePrescription.</div>
            </div>
            {manualResult && (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>рџ“‹ Р РµР·СѓР»СЊС‚Р°С‚: {manualResult.splitName}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'rgba(0,230,138,0.12)', padding: '3px 8px', borderRadius: 8 }}>{manualResult.days.length} РґРЅ/РЅРµРґ В· {mesoLength} РЅРµРґ</span>
                </div>
                {Object.values(manualCfg).some(Boolean) && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 6, lineHeight: 1.6 }}>
                  <b style={{ color: 'var(--accent)' }}>РџР°СЂР°РјРµС‚СЂС‹:</b> {Object.entries(manualCfg).filter(([, v]) => v).map(([k, v]) => { const L: Record<string,string> = { split: 'СЃРїР»РёС‚', cycle: 'С†РёРєР»', program: 'РїСЂРѕРіСЂР°РјРјР°', periodization: 'РїРµСЂРёРѕРґРёР·Р°С†РёСЏ', progression: 'РїСЂРѕРіСЂРµСЃСЃРёСЏ', intensity: 'РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ', technique: 'С‚РµС…РЅРёРєР°', volume: 'РѕР±СЉС‘Рј', frequency: 'С‡Р°СЃС‚РѕС‚Р°' }; return `${L[k] || k}: ${v}`; }).join(' В· ')}
                </div>}
                {manualResult.corrections && manualResult.corrections.length > 0 && (
                  <div style={{ marginTop: 6, padding: 10, borderRadius: 10, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', marginBottom: 6 }}>рџ“ќ РљРѕРјРјРµРЅС‚Р°СЂРёРё Рє РїР»Р°РЅСѓ (С‡С‚Рѕ РёР·РјРµРЅРµРЅРѕ Рё РїРѕС‡РµРјСѓ)</div>
                    {manualResult.corrections.map((corr, i) => <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 3, paddingLeft: 4, borderLeft: '2px solid rgba(59,130,246,0.4)' }}>{corr}</div>)}
                  </div>
                )}
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {manualResult.days.map(d => (
                    <div key={d.day} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(0,230,138,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>рџЏ‹пёЏ Р”РµРЅСЊ {d.day}</span>
                        <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 700 }}>{d.groups.join(' В· ')}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.7fr 0.7fr 0.5fr 0.5fr 0.5fr', gap: 2, padding: '4px 10px', fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                        <span>РЈРїСЂР°Р¶РЅРµРЅРёРµ</span><span>РЎРµС‚С‹Г—РїРѕРІС‚</span><span>RIR</span><span>Р’РµСЃ</span><span>Р“СЂСѓРїРїР°</span><span>РћС‚РґС‹С…</span>
                      </div>
                      {d.exercises.map((e, ei) => (
                        <div key={ei} style={{ display: 'grid', gridTemplateColumns: '2fr 0.7fr 0.7fr 0.5fr 0.5fr 0.5fr', gap: 2, padding: '5px 10px', fontSize: 10, color: 'rgba(255,255,255,0.85)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <span style={{ fontWeight: 600 }}>{e.name}</span>
                          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{e.sets}Г—{e.reps}</span>
                          <span style={{ color: '#f59e0b' }}>{e.rir}</span>
                          <span style={{ color: '#60a5fa', fontWeight: 700 }}>{e.weight} РєРі</span>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{e.group}</span>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{e.rest}СЃ</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                {/* РЎРІРѕРґРєР° РєР°С‡РµСЃС‚РІР° РїР»Р°РЅР° */}
                {(() => {
                  const _labAdj = labTrainingAdjust(linked.labAnalysis);
    const mrv = ((LEVEL_VOLUMES as Record<string, { mrv: number }>)[level]?.mrv ?? 20) * (tprofile.onCourse ? (tprofile.courseIntensity === 'heavy' ? 1.3 : tprofile.courseIntensity === 'mild' ? 1.15 : 1.2) : 1) * _labAdj.mrvMultiplier;
                  const wk: Record<string, number> = {};
                  manualResult.days.forEach(d => d.exercises.forEach(e => { wk[e.group] = (wk[e.group] || 0) + e.sets; }));
                  const groups = Object.keys(wk);
                  const over = groups.filter(g => wk[g] > mrv);
                  const weakCovered = tprofile.weakPoints.filter(w => (wk[w] || 0) > 0);
                  const weakMissed = tprofile.weakPoints.filter(w => (wk[w] || 0) === 0);
                  let score = 100; score -= over.length * 12; score -= weakMissed.length * 10; score -= groups.filter(g => wk[g] > 0 && wk[g] < Math.max(4, mrv * 0.4)).length * 4;
                  score = Math.max(0, Math.min(100, score));
                  const sc = score >= 85 ? '#22c55e' : score >= 65 ? '#eab308' : '#ef4444';
                  const GRP_RU: Record<string,string> = { chest:'Р“СЂСѓРґСЊ', back:'РЎРїРёРЅР°', legs:'РќРѕРіРё', shoulders:'РџР»РµС‡Рё', arms:'Р СѓРєРё', core:'РљРѕСЂ' };
                  return <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(0,230,138,0.04)', border: '1px solid ' + sc + '33' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: sc }}>рџЋЇ РљР°С‡РµСЃС‚РІРѕ РїР»Р°РЅР°</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: sc }}>{score}/100</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                      {over.length === 0 ? 'вњ… РћР±СЉС‘Рј РІ РїСЂРµРґРµР»Р°С… MRV. ' : 'вљ  РџСЂРµРІС‹С€РµРЅРёРµ MRV: ' + over.map(g => (GRP_RU[g] || g) + ' ' + wk[g]).join(', ') + '. '}
                      {tprofile.weakPoints.length === 0 ? '' : (weakMissed.length === 0 ? 'вњ… РЎР»Р°Р±С‹Рµ РіСЂСѓРїРїС‹ РїРѕРєСЂС‹С‚С‹. ' : 'вљ  РЎР»Р°Р±С‹Рµ РіСЂСѓРїРїС‹ Р±РµР· РѕР±СЉС‘РјР°: ' + weakMissed.map(g => GRP_RU[g] || g).join(', ') + '. ')}
                      Р’СЃРµРіРѕ СЃРµС‚РѕРІ/РЅРµРґ: {Object.values(wk).reduce((a, b) => a + b, 0)}.
                      {(() => { const _srpe = loadSRPESessions(); if (_srpe.length < 7) return ''; const mon = weeklyMonotony(toDailyLoads(_srpe)); const warn = mon.monotony > 2 || mon.strain > 1000; if (!warn) return ' вњ… РњРѕРЅРѕС‚РѕРЅРЅРѕСЃС‚СЊ/strain РІ РЅРѕСЂРјРµ.'; return ' вљ  РџРµСЂРµС‚СЂРµРЅРёСЂРѕРІР°РЅРЅРѕСЃС‚СЊ: РјРѕРЅРѕС‚РѕРЅРЅРѕСЃС‚СЊ ' + mon.monotony.toFixed(1) + (mon.monotony > 2 ? ' (>2 вЂ” РѕРґРЅРѕРѕР±СЂР°Р·РёРµ)' : '') + ', strain ' + Math.round(mon.strain) + '. Р”РѕР±Р°РІСЊС‚Рµ РІР°СЂРёР°С‚РёРІРЅРѕСЃС‚СЊ/РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ.'; })()}
                    </div>
                  </div>;
                })()}
                <button onClick={() => { try { const data = { name: `Р СѓС‡РЅР°СЏ: ${manualResult.splitName}'`, date: new Date().toISOString().slice(0,10), cfg: manualCfg, days: manualResult.days, generatedAt: Date.now() }; const ex = JSON.parse(localStorage.getItem('myTrainingPlans') || '[]'); ex.unshift(data); localStorage.setItem('myTrainingPlans', JSON.stringify(ex.slice(0,30))); refreshManualSaved(); } catch {} }} style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid rgba(0,230,138,0.2)', background: 'rgba(0,230,138,0.06)', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>рџ’ѕ РЎРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕРіСЂР°РјРјСѓ РІ В«РњРѕРё С‚СЂРµРЅРёСЂРѕРІРєРёВ»</button>
                <button onClick={exportManualPlanText} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)', color: '#60a5fa', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>{planCopied ? 'вњ“ РЎРєРѕРїРёСЂРѕРІР°РЅРѕ РІ Р±СѓС„РµСЂ' : 'рџ“‹ РљРѕРїРёСЂРѕРІР°С‚СЊ РїР»Р°РЅ (С‚РµРєСЃС‚)'}</button>
                <button onClick={printManualPlan} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>рџ–Ё РџРµС‡Р°С‚СЊ / СЃРѕС…СЂР°РЅРёС‚СЊ РІ PDF</button>
                <button onClick={exportFullReport} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'linear-gradient(135deg,rgba(0,230,138,0.12),rgba(0,200,80,0.06))', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontWeight: 800 }}>рџ“„ РћС‚С‡С‘С‚ РїРѕ Р±Р»РѕРєСѓ (PDF: РїСЂРѕС„РёР»СЊ+РїР»Р°РЅ+РєР°С‡РµСЃС‚РІРѕ+Р»Р°Р±.+РїСЂРѕРіСЂРµСЃСЃ)</button>
                <button onClick={() => { setManualResult(null); setComparePlan(null); }} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>вњ• РЎР±СЂРѕСЃРёС‚СЊ СЂРµР·СѓР»СЊС‚Р°С‚</button>
                <button onClick={manualToRuntime} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid var(--accent)', background: 'rgba(0,230,138,0.08)', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>в–¶ Рљ РІС‹РїРѕР»РЅРµРЅРёСЋ (SessionPlayer)</button>
                {(manualCfg.intensity || manualCfg.technique || manualCfg.volume) && <button onClick={applyMethodicToPlan} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>рџ”§ РџСЂРёРјРµРЅРёС‚СЊ РјРµС‚РѕРґРёРєСѓ Рє РїР»Р°РЅСѓ</button>}
              </div>
            )}

            {/* Р—Р°РіСЂСѓР·РёС‚СЊ СЃРѕС…СЂР°РЅС‘РЅРЅС‹Р№ РїР»Р°РЅ РѕР±СЂР°С‚РЅРѕ РІ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ */}
            {(() => { const plans = manualSavedPlans.filter((p: any) => p && p.days); if (plans.length === 0) return null; return <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>рџ“Ѓ РЎРѕС…СЂР°РЅС‘РЅРЅС‹Рµ РїСЂРѕРіСЂР°РјРјС‹ ({plans.length}) вЂ” Р·Р°РіСЂСѓР·РёС‚СЊ РІ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ</div>
              {plans.map((p: any, i: number) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, padding: '5px 8px', marginBottom: 4, borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>{p.name} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>В· {p.date} В· {p.days?.length} РґРЅ</span></span>
                <span style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => loadManualPlan(p)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: '#00e68a', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>в†© Р—Р°РіСЂСѓР·РёС‚СЊ</button>
                  <button onClick={() => setComparePlan(p)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>вљ– РЎСЂР°РІРЅРёС‚СЊ</button>
                  <button onClick={() => { try { const ex = JSON.parse(localStorage.getItem('myTrainingPlans') || '[]'); const upd = ex.filter((x: any, j: number) => x !== p); localStorage.setItem('myTrainingPlans', JSON.stringify(upd)); refreshManualSaved(); } catch {} }} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 9 }}>вњ•</button>
                </span>
              </div>)}
            </div>; })()}
            {comparePlan && manualResult && (() => { const wk = (plan: any): Record<string, number> => { const m: Record<string, number> = {}; (plan.days || []).forEach((d: any) => (d.exercises || []).forEach((e: any) => { m[e.group] = (m[e.group] || 0) + e.sets; })); return m; }; const cur = wk(manualResult); const cmp = wk(comparePlan); const allG = Array.from(new Set([...Object.keys(cur), ...Object.keys(cmp)])); const GRP_RU: Record<string,string> = { chest:'Р“СЂСѓРґСЊ', back:'РЎРїРёРЅР°', legs:'РќРѕРіРё', shoulders:'РџР»РµС‡Рё', arms:'Р СѓРєРё', core:'РљРѕСЂ', full:'РћР±С‰РµРµ' }; const curTotal = Object.values(cur).reduce((a,b)=>a+b,0); const cmpTotal = Object.values(cmp).reduce((a,b)=>a+b,0); return <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.2)' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}><span style={{ fontSize: 11, fontWeight: 800, color: '#a855f7' }}>вљ– РЎСЂР°РІРЅРµРЅРёРµ: С‚РµРєСѓС‰РёР№ vs В«{comparePlan.name}В»</span><button onClick={() => setComparePlan(null)} style={{ fontSize: 9, border: 'none', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}>вњ•</button></div><div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr 0.6fr', gap: 2, fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', padding: '2px 0' }}><span>Р“СЂСѓРїРїР°</span><span>РўРµРєСѓС‰РёР№</span><span>РЎРѕС…СЂР°РЅС‘РЅРЅС‹Р№</span></div>{allG.map((g: string) => { const a = cur[g]||0, b = cmp[g]||0; const diff = a-b; return <div key={g} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr 0.6fr', gap: 2, fontSize: 10, color: 'rgba(255,255,255,0.85)', padding: '3px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}><span style={{ fontWeight: 600 }}>{GRP_RU[g]||g}</span><span style={{ color: '#00e68a' }}>{a} {diff!==0 && <span style={{ fontSize: 7, color: diff>0?'#ef4444':'#3b82f6' }}>({diff>0?'+':''}{diff})</span>}</span><span style={{ color: '#60a5fa' }}>{b}</span></div>; })}<div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Р’СЃРµРіРѕ СЃРµС‚РѕРІ: С‚РµРєСѓС‰РёР№ <b style={{ color: '#00e68a' }}>{curTotal}</b> В· СЃРѕС…СЂР°РЅС‘РЅРЅС‹Р№ <b style={{ color: '#60a5fa' }}>{cmpTotal}</b> ({curTotal-cmpTotal>=0?'+':''}{curTotal-cmpTotal}). Р”РЅРµР№: {manualResult.days.length} vs {comparePlan.days?.length ?? '?'}.</div></div>; })()}

            <button onClick={() => setShowWizard(w => !w)} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px dashed rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.04)', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontWeight: 700, marginBottom: 10 }}>{showWizard ? 'в–І РЎРєСЂС‹С‚СЊ РїРѕС€Р°РіРѕРІС‹Р№ РјР°СЃС‚РµСЂ' : 'в–ј Р Р°СЃС€РёСЂРµРЅРЅС‹Р№ РїРѕС€Р°РіРѕРІС‹Р№ РјР°СЃС‚РµСЂ'}</button>
            {/* Step indicators */}
            {showWizard && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
              {[1,2,3,4].map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div onClick={() => setBuilderStep(s)} style={{
                    width: 18, height: 18, borderRadius: '50%', cursor: 'pointer',
                    background: builderStep === s ? 'var(--accent)' : 'var(--bg-secondary)',
                    border: builderStep === s ? '2px solid var(--accent)' : '2px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700, color: builderStep === s ? '#000' : 'var(--text-dim)',
                  }}>{s}</div>
                  <span style={{ fontSize: 9, color: builderStep === s ? 'var(--text-light)' : 'var(--text-dim)', fontWeight: builderStep === s ? 600 : 400 }}>
                    {s === 1 ? 'РџР°СЂР°РјРµС‚СЂС‹' : s === 2 ? 'РЎРїР»РёС‚' : s === 3 ? 'РЈРїСЂР°Р¶РЅРµРЅРёСЏ' : 'Р¦РёРєР»'}
                  </span>
                  {s < 4 && <span style={{ color: 'var(--text-dim)', fontSize: 8, marginLeft: 2 }}>в†’</span>}
                </div>
              ))}
            </div>
            )}

            {/* STEP 1: РџР°СЂР°РјРµС‚СЂС‹ */}
            {showWizard && builderStep === 1 && (<>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р¦РµР»СЊ</label>
                  <select value={goal} onChange={e => setGoal(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }}>
                    {GOALS.map(g => <option key={g.value} value={g.value}>{g.icon} {g.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>РЈСЂРѕРІРµРЅСЊ</label>
                  <select value={level} onChange={e => setLevel(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }}>
                    {LEVELS.map(l => <option key={l.value} value={l.value}>{l.icon} {l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р”РЅРµР№/РЅРµРґ</label>
                  <select value={daysPerWeek} onChange={e => setDaysPerWeek(parseInt(e.target.value))} style={{ width: '100%', padding: '6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }}>
                    {[2,3,4,5,6].map(d => <option key={d} value={d}>{d} РґРЅ/РЅРµРґ</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р”Р»РёС‚. (РЅРµРґРµР»СЊ)</label>
                  <input type="number" min={4} max={20} value={mesoLength} onChange={e => setMesoLength(parseInt(e.target.value) || 12)} style={{ width: '100%', padding: '6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} />
                </div>
              </div>
              <button onClick={() => {
                const newSeed = Date.now();
                setGeneratorSeed(newSeed);
                const shuffleSeed = (newSeed % 1000) / 1000;
                const inp = { goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as TrainingInput;
                const best = selectSplit(inp);
                const manualSp = manualCfg.split ? TRAINING_SPLITS[manualCfg.split] : null;
                const s = manualSp ? { id: manualCfg.split, name: manualSp.name, desc: manualSp.desc, groupsPerDay: manualSp.groupsPerDay, score: 100, rationale: ['Р СѓС‡РЅРѕР№ РІС‹Р±РѕСЂ СЃРїР»РёС‚Р°'] } as SplitCandidate : best[0];
                setBuilderSplit(s || null);
                if (s) {
                  const dayKeys = Object.keys(TRAINING_SPLITS);
                  const matchKey = dayKeys.find(k => TRAINING_SPLITS[k].name === s.name);
                  const sp = matchKey ? TRAINING_SPLITS[matchKey] : null;
                  const exByDay: Record<number, any[]> = {};
                   if (sp) {
                    const totalDays = Math.min(sp.groupsPerDay.length, daysPerWeek);
                    const cycle: string[][] = [];
                    while (cycle.length < daysPerWeek) {
                      for (const g of sp.groupsPerDay) { cycle.push(g); if (cycle.length >= daysPerWeek) break; }
                    }
                    const isWeak = (group: string) => weakPoints.includes(group);
                    const getReps = (ex: any, g: string, roleIdx: number): string => {
                      const rng = Math.random() + shuffleSeed;
                      if (goal === 'strength') {
                        if (ex.type === 'compound') return (rng % 3) < 1 ? '3-5' : '4-6';
                        return (rng % 3) < 1 ? '5-7' : '6-8';
                      }
                      if (goal === 'bulk') {
                        if (ex.type === 'compound') return (rng % 3) < 1 ? '6-10' : '8-12';
                        if (ex.type === 'isolation') return (rng % 3) < 1 ? '8-12' : '10-15';
                        return '8-12';
                      }
                      if (goal === 'cut') return '10-15';
                      if (ex.type === 'compound') return (rng % 3) < 1 ? '6-10' : '8-12';
                      return (rng % 3) < 1 ? '8-12' : '10-15';
                    };
                    const getRIR = (g: string, isFirst: boolean, exIdx: number): number => {
                      const jitter = Math.round((shuffleSeed * (exIdx + 1)) % 1);
                      let base = isFirst ? 1 : 2;
                      if (isWeak(g)) base = 1;
                      if (goal === 'strength') base = isFirst ? 2 : 3;
                      if (goal === 'cut') base = 2;
                      return Math.max(0, base + jitter);
                    };
                    const getSets = (ex: any, g: string, roleIdx: number): number => {
                      const jitter = Math.round((shuffleSeed * (roleIdx + 2)) % 2);
                      if (ex.type === 'compound') {
                        const baseC = level === 'beginner' ? 3 : level === 'enhanced' ? 5 : 4;
                        return Math.max(3, Math.min(5, baseC + jitter * (isWeak(g) ? 1 : 0)));
                      }
                      const baseI = level === 'beginner' ? 2 : 3;
                      return Math.max(2, Math.min(4, baseI + jitter * (isWeak(g) ? 1 : 0)));
                    };
                    cycle.forEach((groups, di) => {
                      const dayExs: any[] = [];
                      groups.forEach(g => {
                        const _allEx = getExercisesByGroup(g);
                        const _eqF = (e: typeof _allEx[number]) => tprofile.equipment.length === 0 || tprofile.equipment.includes(e.equipment);
                        const catalogExs = [...(_allEx.filter(_eqF).length > 0 ? _allEx.filter(_eqF) : _allEx)];
                        const shuffled = catalogExs.sort(() => (Math.random() + shuffleSeed) % 1 - 0.5);
                        const compounds = shuffled.filter(e => e.type === 'compound');
                        const isolations = shuffled.filter(e => e.type === 'isolation');
                        const chosen: typeof shuffled = [];
                        chosen.push(...compounds.slice(0, 2));
                        chosen.push(...isolations.slice(0, Math.max(0, 3 - chosen.length)));
                        if (chosen.length === 0) chosen.push(...shuffled.slice(0, 2));
                        chosen.forEach((ex, i) => {
                          const roleIdx = i;
                          const sets = getSets(ex, g, roleIdx);
                          dayExs.push({
                            name: ex.name, sets, reps: getReps(ex, g, roleIdx),
                            rir: getRIR(g, i === 0, roleIdx),
                            rest: ex.type === 'compound' ? (goal === 'strength' ? 180 : 120) : 60,
                            group: g
                          });
                        });
                      });
                      exByDay[di] = dayExs;
                    });
                  }
                  setBuilderDayExercises(exByDay);
                }
                setBuilderStep(2);
              }} style={{ width: '100%', padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>Р”Р°Р»РµРµ: РџРѕРґРѕР±СЂР°С‚СЊ СЃРїР»РёС‚</button>
            </>)}

            {/* STEP 2: РЎРїР»РёС‚ */}
            {showWizard && builderStep === 2 && (<>
              {builderSplit ? (
                <div style={{ background: 'rgba(0,230,138,0.06)', borderRadius: 8, padding: 10, marginBottom: 8, border: '1px solid rgba(0,230,138,0.12)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>рџЏ† {builderSplit.name}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-light)', marginTop: 3 }}>{builderSplit.desc}</div>
                  <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 3 }}>Score: {((builderSplit.score || 0) * 100).toFixed(0)}%</div>
                  {builderSplit.rationale && <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 3 }}>{builderSplit.rationale.join(' В· ')}</div>}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>Р’РµСЂРЅРёС‚РµСЃСЊ РЅР° С€Р°Рі 1 РґР»СЏ РїРѕРґР±РѕСЂР° СЃРїР»РёС‚Р°</div>
              )}
              {(() => {
                const inp = { goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as TrainingInput;
                const topSplits = getSplitOptions(inp);
                const top10 = topSplits.slice(0, 10);
                const rest = topSplits.slice(10);
                return (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-light)', marginBottom: 4 }}>РўРѕРї-10 СЃРїР»РёС‚РѕРІ</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 200, overflowY: 'auto', marginBottom: 4 }}>
                      {top10.map((s, i) => (
                        <div key={i} onClick={() => { setBuilderSplit(s); setSplitType(s.id || 'auto'); }} style={{ padding: '4px 8px', borderRadius: 6, cursor: 'pointer', background: builderSplit?.name === s.name ? 'rgba(0,230,138,0.08)' : 'var(--bg-secondary)', border: builderSplit?.name === s.name ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-light)' }}>{s.name}</span>
                            <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--accent)' }}>{(s.score * 100).toFixed(0)}%</span>
                          </div>
                          <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>{s.desc}{s.rationale ? ' В· ' + s.rationale.slice(0, 3).join(' | ') : ''}</div>
                        </div>
                      ))}
                    </div>
                    {rest.length > 0 && (
                      <details>
                        <summary style={{ fontSize: 9, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }}>РџРѕРєР°Р·Р°С‚СЊ РІСЃРµ СЃРїР»РёС‚С‹ ({topSplits.length})</summary>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4, maxHeight: 160, overflowY: 'auto' }}>
                          {rest.map((s, i) => (
                            <div key={i} onClick={() => { setBuilderSplit(s); setSplitType(s.id || 'auto'); }} style={{ padding: '4px 8px', borderRadius: 6, cursor: 'pointer', background: builderSplit?.name === s.name ? 'rgba(0,230,138,0.08)' : 'var(--bg-secondary)', border: builderSplit?.name === s.name ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-light)' }}>{s.name}</span>
                                <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--accent)' }}>{(s.score * 100).toFixed(0)}%</span>
                              </div>
                              <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>{s.desc}</div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })()}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setBuilderStep(1)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 12 }}>в†ђ РќР°Р·Р°Рґ</button>
                <button onClick={() => setBuilderStep(3)} style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>Р”Р°Р»РµРµ: РЈРїСЂР°Р¶РЅРµРЅРёСЏ</button>
              </div>
            </>)}

            {/* STEP 3: РЈРїСЂР°Р¶РЅРµРЅРёСЏ */}
            {showWizard && builderStep === 3 && (<>
              <button onClick={() => {
                const s = builderSplit;
                if (s) {
                  const dayKeys = Object.keys(TRAINING_SPLITS);
                  const matchKey = dayKeys.find(k => TRAINING_SPLITS[k].name === s.name);
                  const sp = matchKey ? TRAINING_SPLITS[matchKey] : null;
                  const exByDay: Record<number, any[]> = {};
                  if (sp) {
                    const cycle: string[][] = [];
                    while (cycle.length < daysPerWeek) {
                      for (const g of sp.groupsPerDay) { cycle.push(g); if (cycle.length >= daysPerWeek) break; }
                    }
                    const isWeak = (group: string) => weakPoints.includes(group);
                    cycle.forEach((groups, di) => {
                      const dayExs: any[] = [];
                      groups.forEach(g => {
                        const isWk = isWeak(g);
                        const _allEx = getExercisesByGroup(g);
                        const _eqF = (e: typeof _allEx[number]) => tprofile.equipment.length === 0 || tprofile.equipment.includes(e.equipment);
                        const catalogExs = [...(_allEx.filter(_eqF).length > 0 ? _allEx.filter(_eqF) : _allEx)];
                        // Score exercises by relevance using calcExercisePrescription
                        const scored = catalogExs.map(ex => {
                          const presc = calcExercisePrescription(ex, goal, level, isWk, false, 1.0, 1, mesoLength || 12);
                          let score = 0;
                          if (ex.type === 'compound') score += 10;
                          if (ex.type === 'isolation') score += 3;
                          if (isWk) score += 2;
                          // Prefer exercises bestFor match with goal
                          if ((ex as any).bestFor && (ex as any).bestFor.includes(goal)) score += 3;
                          return { ex, presc, score };
                        });
                        scored.sort((a, b) => b.score - a.score);
                        const compounds = scored.filter(s => s.ex.type === 'compound');
                        const isolations = scored.filter(s => s.ex.type !== 'compound');
                        const chosen: typeof scored = [];
                        chosen.push(...compounds.slice(0, 2));
                        chosen.push(...isolations.slice(0, Math.max(0, 3 - chosen.length)));
                        if (chosen.length === 0 && scored.length > 0) chosen.push(...scored.slice(0, 2));
                        chosen.forEach(({ ex, presc }, i) => {
                          dayExs.push({
                            name: ex.name,
                            sets: presc.sets,
                            reps: presc.reps,
                            rir: presc.rir,
                            rest: presc.rest,
                            group: g,
                            type: ex.type,
                            rpeHint: (() => {
                              if (ex.type === 'compound') return goal === 'strength' ? '8-9.5' : '7-9';
                              if (ex.type === 'isolation') return goal === 'strength' ? '8-9' : '8-10';
                              return '7-9';
                            })(),
                            dropSet: presc.dropSet,
                            backoffSet: presc.backoffSet,
                            substitutes: getExercisesByGroup(g).filter(e => e.name !== ex.name).slice(0, 3).map(e => e.name),
                          });
                        });
                      });
                      exByDay[di] = dayExs;
                    });
                  }
                  setBuilderDayExercises(exByDay);
                }
              }} style={{
                width: '100%', padding: 8, borderRadius: 8, border: '1px solid var(--accent)', cursor: 'pointer',
                background: 'rgba(0,230,138,0.08)', color: 'var(--accent)', fontWeight: 600, fontSize: 12, marginBottom: 8,
              }}>рџ”„ РЎРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ Р·Р°РЅРѕРІРѕ</button>
              {/* Add/Remove day controls */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {Object.keys(builderDayExercises).length < 7 && (
                  <button onClick={() => {
                    const keys = Object.keys(builderDayExercises).map(Number);
                    const nextKey = keys.length > 0 ? Math.max(...keys) + 1 : 0;
                    const s = builderSplit;
                    if (s) {
                      const dayKeys = Object.keys(TRAINING_SPLITS);
                      const matchKey = dayKeys.find(k => TRAINING_SPLITS[k].name === s.name);
                      const sp = matchKey ? TRAINING_SPLITS[matchKey] : null;
                      let newGroup: string[] = ['chest', 'back'];
                      if (sp && sp.groupsPerDay.length > 0) {
                        newGroup = sp.groupsPerDay[nextKey % sp.groupsPerDay.length];
                      }
                      const dayExs: any[] = [];
                      newGroup.forEach(g => {
                        const _allEx = getExercisesByGroup(g);
                        const _eqF = (e: typeof _allEx[number]) => tprofile.equipment.length === 0 || tprofile.equipment.includes(e.equipment);
                        const catalogExs = [...(_allEx.filter(_eqF).length > 0 ? _allEx.filter(_eqF) : _allEx)];
                        const shuffled = catalogExs.sort(() => Math.random() - 0.5);
                        shuffled.slice(0, 2).forEach((ex, i) => {
                          dayExs.push({
                            name: ex.name, sets: 3, reps: '8-12', rir: 2,
                            rest: ex.type === 'compound' ? 120 : 60, group: g
                          });
                        });
                      });
                      setBuilderDayExercises({ ...builderDayExercises, [nextKey]: dayExs });
                    }
                  }} style={{
                    padding: '5px 10px', borderRadius: 6, border: '1px dashed rgba(0,230,138,0.3)', cursor: 'pointer',
                    background: 'trasparent', color: 'var(--accent)', fontSize: 10, fontWeight: 600,
                  }}>+ Р”РѕР±Р°РІРёС‚СЊ РґРµРЅСЊ</button>
                )}
                {Object.keys(builderDayExercises).length > 3 && (
                  <button onClick={() => {
                    const newExs = { ...builderDayExercises };
                    const keys = Object.keys(newExs).map(Number).sort((a, b) => b - a);
                    if (keys.length > 0) delete newExs[keys[0]];
                    setBuilderDayExercises(newExs);
                  }} style={{
                    padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
                    background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontSize: 10, fontWeight: 600,
                  }}>вЂ” РЈР±СЂР°С‚СЊ РґРµРЅСЊ</button>
                )}
              </div>
              <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {Object.entries(builderDayExercises).sort(([a],[b]) => parseInt(a) - parseInt(b)).map(([dayKey, exs]) => (
                  <div key={dayKey} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)', marginBottom: 6 }}>Р”РµРЅСЊ {parseInt(dayKey) + 1} ({exs.length} СѓРїСЂ)</div>
                    {exs.map((ex, ei) => {
                      const repOptions = ['3-5', '4-6', '6-10', '8-12', '10-15', '12-20'];
                      const rirOptions = [0, 1, 2, 3, 4];
                      const setOptions = [2, 3, 4, 5, 6];
                      return (<div key={ei}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 4px', borderRadius: 4, marginBottom: 3, background: 'rgba(255,255,255,0.02)', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, flex: 1, minWidth: 80 }}>{ex.name}</span>
                        {/* Sets в–Ів–ј */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <button onClick={() => {
                            const newExs = { ...builderDayExercises };
                            newExs[parseInt(dayKey)] = newExs[parseInt(dayKey)].map((e, j) => j === ei ? { ...e, sets: Math.max(1, e.sets - 1) } : e);
                            setBuilderDayExercises(newExs);
                          }} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--text-dim)', lineHeight: 1 }}>в–ј</button>
                          <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--accent)', minWidth: 12, textAlign: 'center' }}>{ex.sets}</span>
                          <button onClick={() => {
                            const newExs = { ...builderDayExercises };
                            newExs[parseInt(dayKey)] = newExs[parseInt(dayKey)].map((e, j) => j === ei ? { ...e, sets: Math.min(8, e.sets + 1) } : e);
                            setBuilderDayExercises(newExs);
                          }} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--text-dim)', lineHeight: 1 }}>в–І</button>
                          <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>СЃРµС‚</span>
                        </div>
                        {/* Reps dropdown */}
                        <select value={ex.reps} onChange={e => {
                          const newExs = { ...builderDayExercises };
                          newExs[parseInt(dayKey)] = newExs[parseInt(dayKey)].map((e2, j) => j === ei ? { ...e2, reps: e.target.value } : e2);
                          setBuilderDayExercises(newExs);
                        }} style={{ fontSize: 9, padding: '2px 2px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', maxWidth: 56 }}>
                          {repOptions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {/* RIR dropdown */}
                        <select value={ex.rir} onChange={e => {
                          const newExs = { ...builderDayExercises };
                          newExs[parseInt(dayKey)] = newExs[parseInt(dayKey)].map((e2, j) => j === ei ? { ...e2, rir: parseInt(e.target.value) } : e2);
                          setBuilderDayExercises(newExs);
                        }} style={{ fontSize: 9, padding: '2px 2px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', maxWidth: 42 }}>
                          {rirOptions.map(r => <option key={r} value={r}>RIR{r}</option>)}
                        </select>
                        {/* RPE hint */}
                        <span style={{ fontSize: 8, color: 'var(--text-dim)', minWidth: 40, textAlign: 'center', padding: '1px 4px', borderRadius: 3, background: 'rgba(168,85,247,0.08)' }} title="Р РµРєРѕРјРµРЅРґСѓРµРјР°СЏ РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ">
                          RPE {ex.rpeHint || '7-9'}
                        </span>
                        {ex.dropSet && <span style={{ fontSize: 7, padding: '1px 3px', borderRadius: 3, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }} title="Р”СЂРѕРї-СЃРµС‚">в–ѕ</span>}
                        {ex.backoffSet && <span style={{ fontSize: 7, padding: '1px 3px', borderRadius: 3, background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }} title="РћР±СЂР°С‚РЅС‹Р№ СЃРµС‚">в—‚</span>}
                        {/* Substitute */}
                        <button onClick={() => {
                          setBuilderShowSubs(builderShowSubs === `${dayKey}_${ei}` ? null : `${dayKey}_${ei}`);
                        }} style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--text-dim)' }}>в†”</button>
                        {/* Quick swap */}
                        <button onClick={() => {
                          const subs = getExercisesByGroup(ex.group || '');
                          if (subs.length > 0) {
                            const alt = subs[0];
                            const newExs = { ...builderDayExercises };
                            const name = alt.name || alt.id;
                            newExs[parseInt(dayKey)] = newExs[parseInt(dayKey)].map((e, j) => j === ei ? { ...e, name } : e);
                            setBuilderDayExercises(newExs);
                          }
                        }} style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--accent)' }}>в†»</button>
                        {/* Delete */}
                        <button onClick={() => {
                          const newExs = { ...builderDayExercises };
                          newExs[parseInt(dayKey)] = newExs[parseInt(dayKey)].filter((_, j) => j !== ei);
                          setBuilderDayExercises(newExs);
                        }} style={{ fontSize: 9, padding: '2px 4px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', background: 'transparent', color: '#ef4444' }}>вњ•</button>
                      </div>
                      {builderShowSubs === `${dayKey}_${ei}` && (<>
                        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginLeft: 8, marginBottom: 2 }}>РђР»СЊС‚РµСЂРЅР°С‚РёРІС‹:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginLeft: 8, marginBottom: 4 }}>
                          {(ex.substitutes && ex.substitutes.length > 0 ? ex.substitutes : getExercisesByGroup(ex.group || '').filter(e => e.name !== ex.name).slice(0, 5).map(e => e.name || e.id)).map((altName: string, ai: number) => (
                              <button key={ai} onClick={() => {
                                const newExs = { ...builderDayExercises };
                                newExs[parseInt(dayKey)] = newExs[parseInt(dayKey)].map((e, j) => j === ei ? { ...e, name: altName } : e);
                                setBuilderDayExercises(newExs);
                                setBuilderShowSubs(null);
                              }} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', background: 'rgba(0,230,138,0.06)', color: 'var(--text-dim)' }}>
                                {altName}
                              </button>
                            ))}
                        </div>
                      </>)}
                    </div>);
                    })}
                    <button onClick={() => { setBuilderAddExDay(builderAddExDay === parseInt(dayKey) ? null : parseInt(dayKey)); }} style={{ marginTop: 4, fontSize: 9, padding: '3px 8px', borderRadius: 4, border: '1px dashed rgba(0,230,138,0.3)', cursor: 'pointer', background: 'transparent', color: 'var(--accent)' }}>+ Р”РѕР±Р°РІРёС‚СЊ СѓРїСЂР°Р¶РЅРµРЅРёРµ</button>
                    {builderAddExDay === parseInt(dayKey) && (
                      <div style={{ marginTop: 4, maxHeight: 150, overflowY: 'auto' }}>
                        {[...EXERCISE_CATALOG].sort(() => Math.random() - 0.5).slice(0, 30).map((catEx, ci) => (
                          <div key={ci} onClick={() => {
                            const newExs = { ...builderDayExercises };
                            const presc = calcExercisePrescription(catEx, goal, level, false, false, 1);
                            newExs[parseInt(dayKey)] = [...(newExs[parseInt(dayKey)] || []), { name: catEx.name, sets: presc.sets, reps: presc.reps, rir: presc.rir, rest: presc.rest, group: catEx.group }];
                            setBuilderDayExercises(newExs);
                            setBuilderAddExDay(null);
                          }} style={{ fontSize: 9, padding: '3px 6px', cursor: 'pointer', borderRadius: 4, marginBottom: 1, background: 'rgba(255,255,255,0.02)' }}>
                            {catEx.name} <span style={{ color: 'var(--accent)', fontSize: 7 }}>{catEx.group}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* в”Ђв”Ђв”Ђ Volume tracking per muscle group в”Ђв”Ђв”Ђ */}
              {(() => {
                const lv = LEVEL_VOLUMES[level] || LEVEL_VOLUMES.intermediate;
                const volMap: Record<string, number> = {};
                Object.values(builderDayExercises).forEach((exs: any[]) => {
                  exs.forEach((ex: any) => {
                    const g = ex.group || '';
                    volMap[g] = (volMap[g] || 0) + (ex.sets || 0);
                  });
                });
                if (Object.keys(volMap).length === 0) return null;
                return (
                  <div style={{ background: 'rgba(0,230,138,0.03)', borderRadius: 8, padding: '8px 10px', marginBottom: 8, border: '1px solid rgba(0,230,138,0.08)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>рџ“Љ РћР±СЉС‘Рј Р·Р° РЅРµРґРµР»СЋ:</div>
                    {MUSCLE_GROUPS.filter(g => volMap[g]).map(g => {
                      const sets = volMap[g];
                      let status = 'вњ…'; let statusColor = '#22c55e'; let note = '';
                      if (sets < lv.mev) { status = 'рџ”ґ'; statusColor = '#ef4444'; note = `РЅРёР¶Рµ MEV (${lv.mev})`; }
                      else if (sets >= lv.mrv) { status = 'вљ пёЏ'; statusColor = '#f59e0b'; note = `Р±Р»РёР·РєРѕ Рє MRV (${lv.mrv})`; }
                      else if (sets >= lv.mrv * 0.85) { status = 'вљ пёЏ'; statusColor = '#f59e0b'; note = `Р±Р»РёР·РєРѕ Рє MRV`; }
                      else { note = ''; }
                      return (
                        <div key={g} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', fontSize: 10 }}>
                          <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>{GROUP_LABELS[g] || g}:</span>
                          <span style={{ color: statusColor }}>
                            {sets} РїРѕРґС…РѕРґРѕРІ (MEV: {lv.mev}, MAV: {lv.mav}, MRV: {lv.mrv}) {status} {note}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setBuilderStep(2)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 12 }}>в†ђ РќР°Р·Р°Рґ</button>
                <button onClick={() => {
                  setBuilderMesoLength(mesoLength);
                  const plan = generateWeeklyPlan({ goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as TrainingInput, mesoLength || 8);
                  setBuilderMacroResult(plan);
                  setBuilderStep(4);
                }} style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>Р”Р°Р»РµРµ: Р¦РёРєР»</button>
              </div>
            </>)}

            {/* STEP 4: Р¦РёРєР» */}
            {showWizard && builderStep === 4 && (<>
              {/* Mesocycle length control */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р”Р»РёРЅР° РјРµР·РѕС†РёРєР»Р°:</span>
                <button onClick={() => { const n = Math.max(4, builderMesoLength - 1); setBuilderMesoLength(n); }} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 10 }}>в€’</button>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', minWidth: 20, textAlign: 'center' }}>{builderMesoLength}</span>
                <button onClick={() => { const n = Math.min(20, builderMesoLength + 1); setBuilderMesoLength(n); }} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 10 }}>+</button>
                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>РЅРµРґ</span>
                <button onClick={() => {
                  const plan = generateWeeklyPlan({ goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as TrainingInput, builderMesoLength);
                  setBuilderMacroResult(plan);
                }} style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 6, border: '1px solid var(--accent)', cursor: 'pointer', background: 'rgba(0,230,138,0.08)', color: 'var(--accent)', fontWeight: 600, fontSize: 10 }}>
                  рџ”„ РћР±РЅРѕРІРёС‚СЊ С†РёРєР»
                </button>
              </div>

              {builderMacroResult ? (
                <>
                  {/* Total cycle stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
                    {(() => {
                      const wks = builderMacroResult;
                      const deloadWeeks = wks.filter((w: any) => w.phase === 'deload' || w.deloadWeek).length;
                      const baseWeeks = wks.filter((w: any) => w.phase === 'base').length;
                      const peakWeeks = wks.filter((w: any) => w.phase === 'peak').length;
                      const allVol = wks.map((w: any) => typeof w.volumePerGroup === 'number' ? w.volumePerGroup : 0);
                      const totalVol = allVol.reduce((s: number, v: number) => s + v, 0);
                      const avgVol = allVol.length > 0 ? Math.round(totalVol / allVol.length) : 0;
                      const maxVol = Math.max(...allVol, 0);
                      const avgRIR = wks.reduce((s: number, w: any) => s + (w.rir || 2), 0) / Math.max(1, wks.length);
                      const estProg = selectProgressionRule(level).weeklyWeightIncrement * wks.length;
                      return (<>
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: 6, textAlign: 'center' }}>
                          <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>РќРµРґРµР»СЊ</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{wks.length}</div>
                          <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>deload: {deloadWeeks}</div>
                        </div>
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: 6, textAlign: 'center' }}>
                          <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>РЎСЂ. РѕР±СЉС‘Рј</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>{avgVol}</div>
                          <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>РјР°РєСЃ {maxVol}</div>
                        </div>
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: 6, textAlign: 'center' }}>
                          <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>РЎСЂ. RIR</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{avgRIR.toFixed(1)}</div>
                          <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ</div>
                        </div>
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: 6, textAlign: 'center' }}>
                          <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>~1RM РїСЂРѕРіРЅРѕР·</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>+{estProg.toFixed(1)} РєРі</div>
                          <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{selectProgressionRule(level).name}</div>
                        </div>
                      </>);
                    })()}
                  </div>

                  {/* Volume progression bar chart */}
                  <div style={{ marginBottom: 8, background: 'var(--bg-secondary)', borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>рџ“Љ РџСЂРѕРіСЂРµСЃСЃРёСЏ РѕР±СЉС‘РјР° РїРѕ РЅРµРґРµР»СЏРј</div>
                    <div style={{ display: 'flex', gap: 1, height: 50, alignItems: 'flex-end' }}>
                      {builderMacroResult.map((w: any, i: number) => {
                        const allVol = builderMacroResult.map((ww: any) => typeof ww.volumePerGroup === 'number' ? ww.volumePerGroup : 0);
                        const vMax = Math.max(...allVol, 1);
                        const v = typeof w.volumePerGroup === 'number' ? w.volumePerGroup : 0;
                        const h = Math.max(6, (v / vMax) * 100);
                        const phaseColors: Record<string, string> = { base: '#3b82f6', build: '#f59e0b', peak: '#ef4444', deload: '#22c55e' };
                        const col = w.deloadWeek ? '#22c55e' : (phaseColors[w.phase] || '#888');
                        return (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <div style={{ width: '80%', height: `${h}%`, background: col, borderRadius: '2px 2px 0 0', opacity: w.deloadWeek ? 0.7 : 0.9 }} />
                            <span style={{ fontSize: 6, color: w.deloadWeek ? '#22c55e' : 'var(--text-dim)', fontWeight: 600 }}>{w.weekNumber}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, fontSize: 7, color: 'var(--text-dim)', marginTop: 4 }}>
                      <span><span style={{ color: '#3b82f6' }}>в– </span> Р‘Р°Р·Р°</span>
                      <span><span style={{ color: '#f59e0b' }}>в– </span> РЎР±РѕСЂРєР°</span>
                      <span><span style={{ color: '#ef4444' }}>в– </span> РџРёРє</span>
                      <span><span style={{ color: '#22c55e' }}>в– </span> Р Р°Р·РіСЂСѓР·РєР°</span>
                    </div>
                  </div>

                  {/* Week cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto', marginBottom: 8 }}>
                    {builderMacroResult.map((w: any, i: number) => {
                      const phaseColors: Record<string, string> = { base: '#3b82f6', build: '#f59e0b', peak: '#ef4444', deload: '#22c55e' };
                      const col = w.deloadWeek ? '#22c55e' : (phaseColors[w.phase] || '#3b82f6');
                      const phaseName = w.phaseName || w.phase || 'base';
                      const techniqueName = w.deloadWeek ? 'Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ' :
                        w.phase === 'peak' ? 'РљР»Р°СЃС‚РµСЂС‹ / СЃРёРЅРіР»С‹' :
                        w.phase === 'build' ? 'Rest-pause / Myo-reps' : 'РЎС‚Р°РЅРґР°СЂС‚';
                      const rpeLo = Math.max(5, Math.round((w.rir || 2) + (w.deloadWeek ? 4 : 5)));
                      const rpeHi = Math.min(10, rpeLo + (w.deloadWeek ? 2 : w.phase === 'peak' ? 2 : 3));
                      return (
                        <div key={i} style={{
                          padding: '6px 8px', borderRadius: 8, border: w.deloadWeek ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border)',
                          background: w.deloadWeek ? 'rgba(34,197,94,0.06)' : 'var(--bg-secondary)',
                          borderLeft: `3px solid ${col}`,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)' }}>Рќ{w.weekNumber}</span>
                              <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: col + '22', color: col, fontWeight: 600, textTransform: 'uppercase' }}>
                                {w.deloadWeek ? 'DELOAD' : phaseName}
                              </span>
                              {w.deloadWeek && <span style={{ fontSize: 8, color: '#22c55e', fontWeight: 600 }}>рџ§Љ</span>}
                            </div>
                            <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>
                              RPE {rpeLo}-{rpeHi}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 10, fontSize: 9, color: 'var(--text-dim)', flexWrap: 'wrap' }}>
                            <span>RIR: <b style={{ color: 'var(--accent)' }}>{w.rir}</b></span>
                            <span>Vol: <b style={{ color: 'var(--accent)' }}>{typeof w.volumePerGroup === 'number' ? w.volumePerGroup : 'вЂ”'}</b></span>
                            <span>РўРµС…РЅРёРєР°: <b>{techniqueName}</b></span>
                            {w.note && <span style={{ color: '#ff9100', fontWeight: 600 }}>{w.note}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add/Remove week controls */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                    <button onClick={() => {
                      const n = Math.min(20, builderMesoLength + 1);
                      setBuilderMesoLength(n);
                      const plan = generateWeeklyPlan({ goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as TrainingInput, n);
                      setBuilderMacroResult(plan);
                    }} style={{
                      flex: 1, padding: 6, borderRadius: 6, border: '1px dashed rgba(0,230,138,0.3)', cursor: 'pointer',
                      background: 'transparent', color: 'var(--accent)', fontSize: 10, fontWeight: 600,
                    }}>+ Р”РѕР±Р°РІРёС‚СЊ РЅРµРґРµР»СЋ</button>
                    <button onClick={() => {
                      const n = Math.max(4, builderMesoLength - 1);
                      setBuilderMesoLength(n);
                      const plan = generateWeeklyPlan({ goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as TrainingInput, n);
                      setBuilderMacroResult(plan);
                    }} style={{
                      flex: 1, padding: 6, borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
                      background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontSize: 10, fontWeight: 600,
                    }}>вЂ” РЈР±СЂР°С‚СЊ РЅРµРґРµР»СЋ</button>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>Р¦РёРєР» РЅРµ СЃРіРµРЅРµСЂРёСЂРѕРІР°РЅ. Р’РµСЂРЅРёС‚РµСЃСЊ РЅР° С€Р°Рі 3.</div>
              )}

              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <button onClick={() => setBuilderStep(3)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 12 }}>в†ђ РќР°Р·Р°Рґ</button>
              </div>
              {builderSavedMsg && (
                <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, textAlign: 'center', marginBottom: 6, padding: '4px 8px', background: 'rgba(34,197,94,0.08)', borderRadius: 6 }}>
                  {builderSavedMsg}
                </div>
              )}
              {/* Save / Export buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={() => {
                  try {
                    const prog = {
                      name: builderSplit?.name || 'РњРѕСЏ РїСЂРѕРіСЂР°РјРјР°',
                      goal, level, daysPerWeek,
                      split: builderSplit,
                      exercises: builderDayExercises,
                      macrocycle: builderMacroResult,
                      mesoLength: builderMesoLength,
                      createdAt: new Date().toISOString(),
                    };
                    const existing = JSON.parse(localStorage.getItem('customPrograms') || '[]');
                    existing.push(prog);
                    localStorage.setItem('customPrograms', JSON.stringify(existing));
                    localStorage.setItem('activeProgram', JSON.stringify(prog));
                    setBuilderSavedMsg('РџСЂРѕРіСЂР°РјРјР° СЃРѕС…СЂР°РЅРµРЅР° РІ "РњРѕРё РїСЂРѕРіСЂР°РјРјС‹"');
                    setTimeout(() => setBuilderSavedMsg(''), 3000);
                  } catch { setBuilderSavedMsg('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ'); }
                }} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>
                  рџ’ѕ РЎРѕС…СЂР°РЅРёС‚СЊ РІ РјРѕРё РїСЂРѕРіСЂР°РјРјС‹
                </button>
                <button onClick={() => {
                  try {
                    const prog = {
                      name: builderSplit?.name || 'РњРѕСЏ РїСЂРѕРіСЂР°РјРјР°',
                      goal, level, daysPerWeek,
                      split: builderSplit,
                      exercises: builderDayExercises,
                      macrocycle: builderMacroResult,
                      mesoLength: builderMesoLength,
                      createdAt: new Date().toISOString(),
                    };
                    const existing = JSON.parse(localStorage.getItem('myProgramTemplates') || '[]');
                    existing.push({ ...prog, isTemplate: true });
                    localStorage.setItem('myProgramTemplates', JSON.stringify(existing));
                    setBuilderSavedMsg('РЁР°Р±Р»РѕРЅ СЃРѕС…СЂР°РЅС‘РЅ');
                    setTimeout(() => setBuilderSavedMsg(''), 3000);
                  } catch { setBuilderSavedMsg('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ С€Р°Р±Р»РѕРЅР°'); }
                }} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--accent)', cursor: 'pointer', background: 'rgba(0,230,138,0.08)', color: 'var(--accent)', fontWeight: 600, fontSize: 12 }}>
                  рџ“‹ РЎРѕС…СЂР°РЅРёС‚СЊ РєР°Рє С€Р°Р±Р»РѕРЅ
                </button>
                <button onClick={() => {
                  try {
                    const dayNames = ['РџРЅ', 'Р’С‚', 'РЎСЂ', 'Р§С‚', 'РџС‚', 'РЎР±', 'Р’СЃ'];
                    let text = `рџЏ‹пёЏ ${builderSplit?.name || 'РњРѕСЏ РїСЂРѕРіСЂР°РјРјР°'}\n`;
                    text += `рџЋЇ Р¦РµР»СЊ: ${GOALS.find(g => g.value === goal)?.icon || ''} ${goal} | РЈСЂРѕРІРµРЅСЊ: ${level} | ${daysPerWeek} РґРЅ/РЅРµРґ | ${builderMesoLength} РЅРµРґ\n\n`;
                    text += `=== РЈРџР РђР–РќР•РќРРЇ ===\n`;
                    Object.entries(builderDayExercises).sort(([a], [b]) => parseInt(a) - parseInt(b)).forEach(([dayKey, exs]) => {
                      text += `\nР”РµРЅСЊ ${parseInt(dayKey) + 1}:\n`;
                      exs.forEach((ex: any) => {
                        text += `  ${ex.name} вЂ” ${ex.sets}Г—${ex.reps} RIR${ex.rir} (РѕС‚РґС‹С… ${ex.rest}СЃ)\n`;
                      });
                    });
                    if (builderMacroResult) {
                      text += `\n=== РњРђРљР РћР¦РРљР› ===\n`;
                      builderMacroResult.forEach((w: any) => {
                        const phaseLabel = w.deloadWeek ? 'DELOAD' : (w.phaseName || w.phase || '');
                        text += `Рќ${w.weekNumber}: ${phaseLabel} | RIR ${w.rir} | Vol ${typeof w.volumePerGroup === 'number' ? w.volumePerGroup : 'вЂ”'}\n`;
                      });
                    }
                    navigator.clipboard.writeText(text).then(() => {
                      setBuilderSavedMsg('РџСЂРѕРіСЂР°РјРјР° СЃРєРѕРїРёСЂРѕРІР°РЅР° РІ Р±СѓС„РµСЂ РѕР±РјРµРЅР°');
                      setTimeout(() => setBuilderSavedMsg(''), 3000);
                    }).catch(() => {
                      setBuilderSavedMsg('РќРµ СѓРґР°Р»РѕСЃСЊ СЃРєРѕРїРёСЂРѕРІР°С‚СЊ (РЅРµ HTTPS?)');
                    });
                  } catch { setBuilderSavedMsg('РћС€РёР±РєР° РєРѕРїРёСЂРѕРІР°РЅРёСЏ'); }
                }} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontWeight: 600, fontSize: 12 }}>
                  рџ“‹ РљРѕРїРёСЂРѕРІР°С‚СЊ РєР°Рє С‚РµРєСЃС‚
                </button>
              </div>
            </>)}
          </div>
        </>)}
        </div>
        </InfoErrorBoundary>
      )}

      {/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ DIARY TAB в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */}
      {tab === 'diary' && (
        <InfoErrorBoundary label="Р”РЅРµРІРЅРёРє">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>рџ“ќ Р—Р°РїРёСЃР°С‚СЊ РїРѕРґС…РѕРґ</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>РЈРїСЂР°Р¶РЅРµРЅРёРµ</label>
                <select value={logExercise} onChange={e => setLogExercise(e.target.value)} style={{ width: '100%', padding: '6px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }}>
                  <option value="">вЂ” Р’С‹Р±СЂР°С‚СЊ вЂ”</option>
                  {EXERCISE_CATALOG.filter(e => e.type === 'compound').slice(0, 20).map(e => (
                    <option key={e.id} value={e.id}>{e.name.slice(0, 20)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р’РµСЃ (РєРі)</label>
                <input type="number" value={logWeight} onChange={e => setLogWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>РџРѕРІС‚РѕСЂРµРЅРёСЏ</label>
                <input type="number" value={logReps} onChange={e => setLogReps(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>RIR</label>
                <input type="number" min={0} max={5} value={logRIR} onChange={e => setLogRIR(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <button onClick={handleLogWorkout} style={{
              width: '100%', padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12,
            }}>вњ“ Р—Р°РїРёСЃР°С‚СЊ</button>
          </div>

          {diaryProgress.length > 0 && (
            <>
              <div className="card" style={{ padding: '10px 12px', marginBottom: 8 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>рџ”Ґ РђРєС‚РёРІРЅРѕСЃС‚СЊ</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, fontSize: 10 }}>
                  <div style={{ textAlign: 'center', background: 'rgba(0,230,138,0.05)', borderRadius: 6, padding: 6 }}>
                    <div style={{ color: 'var(--text-dim)' }}>РќРµРґРµР»СЊ</div>
                    <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 16 }}>{diaryProgress.length}</div>
                  </div>
                  <div style={{ textAlign: 'center', background: 'rgba(0,230,138,0.05)', borderRadius: 6, padding: 6 }}>
                    <div style={{ color: 'var(--text-dim)' }}>РўСЂРµРЅРёСЂРѕРІРѕРє</div>
                    <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 16 }}>{diaryProgress.reduce((s, w) => s + w.workoutCount, 0)}</div>
                  </div>
                  <div style={{ textAlign: 'center', background: 'rgba(0,230,138,0.05)', borderRadius: 6, padding: 6 }}>
                    <div style={{ color: 'var(--text-dim)' }}>РћР±СЉС‘Рј</div>
                    <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 16 }}>{diaryProgress.length > 0 ? `${(diaryProgress[diaryProgress.length - 1]?.totalVolume / 1000).toFixed(1)}С‚` : 'вЂ”'}</div>
                  </div>
                  <div style={{ textAlign: 'center', background: 'rgba(0,230,138,0.05)', borderRadius: 6, padding: 6 }}>
                    <div style={{ color: 'var(--text-dim)' }}>РџР»Р°РЅ</div>
                    {(() => {
                      const planned = currentMicrocycle?.days?.filter((d: any) => d.isTraining).length || 0;
                      const actual = diaryProgress.length > 0 ? (diaryProgress[diaryProgress.length - 1]?.workoutCount || 0) : 0;
                      const compliance = planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : 0;
                      return (
                        <>
                          <div style={{ fontWeight: 700, color: compliance >= 80 ? '#22c55e' : compliance >= 50 ? '#ff9100' : '#ef4444', fontSize: 16 }}>{compliance}%</div>
                          <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{actual}/{planned} РґРЅ</div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <div className="card" style={{ padding: '10px 12px', marginBottom: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 12 }}>рџ“€ РўРѕРЅРЅР°Р¶ РїРѕ РЅРµРґРµР»СЏРј</h4>
              <div style={{ display: 'flex', gap: 2, height: 60, alignItems: 'flex-end' }}>
                {diaryProgress.slice(-12).map((w, i) => {
                  const maxVol = Math.max(...diaryProgress.map(w => w.totalVolume), 1);
                  const h = Math.max(4, (w.totalVolume / maxVol) * 100);
                  const isMax = w.totalVolume === maxVol;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}
                      title={``}>
                      <div style={{ width: '70%', height: `${h}%`, background: isMax ? 'var(--accent)' : 'rgba(0,230,138,0.3)', borderRadius: '2px 2px 0 0' }} />
                      <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{w.week}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>
                <span>РќРµРґРµР»СЏ</span>
                <span>РџРёРє: {Math.round(Math.max(...diaryProgress.map(w => w.totalVolume)))} РєРі</span>
              </div>
            </div>
            </>
          )}

          {/* в•ђв•ђв•ђ Training Insights: Deload Alerts & Progression в•ђв•ђв•ђ */}
          {(() => {
            const insights: { icon: string; text: string; color: string }[] = [];
            const totalWeeks = diaryProgress.length;
            if (totalWeeks >= 4) {
              const avgVol = diaryProgress.reduce((a: number, b: any) => a + b.totalVolume, 0) / Math.max(1, totalWeeks);
              const lastVol = diaryProgress[diaryProgress.length - 1].totalVolume;
              const isDeload = lastVol < avgVol * 0.6;
              if (!isDeload) {
                insights.push({ icon: 'рџ§Љ', text: totalWeeks + ' РЅРµРґ. Р±РµР· СЂР°Р·РіСЂСѓР·РєРё вЂ” СЂРµРєРѕРјРµРЅРґР°С†РёСЏ: deload-РЅРµРґРµР»СЏ', color: '#ff9100' });
              }
            }
            if (diaryProgress.length >= 2) {
              const lastWeek = diaryProgress[diaryProgress.length - 1];
              const prevWeek = diaryProgress[diaryProgress.length - 2];
              if (prevWeek.totalVolume > 0 && lastWeek.totalVolume > prevWeek.totalVolume * 1.2) {
                insights.push({ icon: 'вљ пёЏ', text: 'РЎРєР°С‡РѕРє РѕР±СЉС‘РјР° +20% вЂ” СЂРёСЃРє РїРµСЂРµС‚СЂРµРЅРёСЂРѕРІР°РЅРЅРѕСЃС‚Рё', color: '#ef4444' });
              }
            }
            if (diaryStats.length >= 3) {
              const stagnant = diaryStats.filter((s: any) => {
                const p = s.weeklyProgress || [];
                return p.length >= 3 && Math.abs((p[p.length-1]?.estimated1RM||0) - (p[p.length-3]?.estimated1RM||0)) < 2.5;
              });
              if (stagnant.length > 0) {
                insights.push({ icon: 'рџ“Љ', text: 'РџР»Р°С‚Рѕ РІ ' + stagnant.length + ' СѓРїСЂ. РЎРјРµРЅРёС‚Рµ СЃС…РµРјСѓ РїСЂРѕРіСЂРµСЃСЃРёРё.', color: '#eab308' });
              }
            }
            const rpe = (linked.readiness?.recovery ?? 7);
            if ((10 - rpe) > 5) {
              insights.push({ icon: 'рџґ', text: 'Р’С‹СЃРѕРєР°СЏ СѓСЃС‚Р°Р»РѕСЃС‚СЊ: РїСЂРёРѕСЂРёС‚РµС‚ вЂ” РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ. РћР±СЉС‘Рј -15-25%.', color: '#8b5cf6' });
            }
            const freq = linked.profile?.settings?.workoutsPerWeek ?? 3;
            const recFreq = level === 'beginner' ? '3-4' : level === 'intermediate' ? '4-5' : '4-6';
            if (freq < parseInt(recFreq.split('-')[0]) || freq > parseInt(recFreq.split('-')[1])) {
              insights.push({ icon: 'рџ“…', text: 'РћРїС‚РёРјР°Р»СЊРЅР°СЏ С‡Р°СЃС‚РѕС‚Р°: ' + recFreq + ' РґРЅ/РЅРµРґ (СЃРµР№С‡Р°СЃ: ' + freq + ')', color: '#3b82f6' });
            }
            const lastVol = diaryProgress.length > 0 ? diaryProgress[diaryProgress.length - 1].totalVolume : 0;
            const bw = linked.profile?.settings?.weight || 80;
            const volPerKg = lastVol / bw;
            if (volPerKg > 0 && volPerKg < 30) {
              insights.push({ icon: 'рџ“‰', text: 'РћР±СЉС‘Рј ' + Math.round(volPerKg) + ' РєРі/РєРі вЂ” РЅРёР¶Рµ MEV', color: '#ef4444' });
            } else if (volPerKg > 80) {
              insights.push({ icon: 'рџ“€', text: 'РћР±СЉС‘Рј ' + Math.round(volPerKg) + ' РєРі/РєРі вЂ” РІС‹С€Рµ MRV', color: '#ef4444' });
            } else if (volPerKg >= 30) {
              insights.push({ icon: 'вњ…', text: 'РћР±СЉС‘Рј ' + Math.round(volPerKg) + ' РєРі/РєРі вЂ” РІ РѕРїС‚РёРјР°Р»СЊРЅРѕРј РґРёР°РїР°Р·РѕРЅРµ', color: '#22c55e' });
            }
            if (insights.length === 0) return null;
            return (
              <div className="card" style={{ padding: '10px 12px', marginBottom: 8, background: 'rgba(0,230,138,0.03)', border: '1px solid rgba(0,230,138,0.15)' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--accent)' }}>рџ§  РђРЅР°Р»РёР· С‚СЂРµРЅРёСЂРѕРІРѕРє</h4>
                {insights.map((t: any, i: number) => (
                  <div key={i} style={{ fontSize: 10, color: t.color, padding: '3px 0', display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                    <span>{t.icon}</span>
                    <span>{t.text}</span>
                  </div>
                ))}
              </div>
            );
          })()}
          {diaryStats.length > 0 && (
            <div className="card" style={{ padding: '10px 12px', marginBottom: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 12 }}>рџЏ† 1RM РїРѕ Р±Р°Р·РѕРІС‹Рј</h4>
              {diaryStats.map((s, i) => {
                const pctMax = diaryStats.length > 0 ? Math.round((s.max1RM / Math.max(...diaryStats.map(d => d.max1RM))) * 100) : 0;
                const prev = i < diaryStats.length - 1 ? diaryStats[i + 1] : null;
                const trend = prev ? (s.max1RM > prev.max1RM * 1.02 ? 'в†‘' : s.max1RM < prev.max1RM * 0.98 ? 'в†“' : 'в†’') : 'в†’';
                const trendColor = trend === 'в†‘' ? '#22c55e' : trend === 'в†“' ? '#ef4444' : '#6b7280';
                return (
                  <div key={s.exerciseId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 10 }}>
                    <span style={{ fontSize: 11, color: trendColor, minWidth: 12 }}>{trend}</span>
                    <span style={{ flex: 1, fontWeight: 500 }}>{s.exerciseName}</span>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(5, pctMax)}%`, height: '100%', background: pctMax > 80 ? 'var(--accent)' : pctMax > 50 ? '#8b5cf6' : '#6b7280', borderRadius: 3 }} />
                    </div>
                    <span style={{ color: 'var(--accent)', fontWeight: 600, minWidth: 55, textAlign: 'right' }}>{Math.round(s.max1RM)} РєРі</span>
                    <span style={{ color: 'var(--text-dim)', minWidth: 45, textAlign: 'right' }}>{s.maxWeight}Г—{s.maxReps}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </InfoErrorBoundary>
      )}

      {/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ CYCLES TAB в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */}
      {tab === 'cycles' && (
        <InfoErrorBoundary label="Р¦РёРєР»С‹">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Controls - glass card */}
          <div style={{ padding:12, borderRadius:14, background:'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:500, letterSpacing:'0.3px', textTransform:'uppercase', marginBottom:8 }}>рџ”„ РџР°СЂР°РјРµС‚СЂС‹ С†РёРєР»Р°</div>
            {/* Goal */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:8 }}>
              {GOALS.map(g => (
                <button key={g.value} onClick={() => { setGoal(g.value); setTimeout(generatePlan, 50); }} style={{
                  padding:'5px 8px', borderRadius:8, fontSize:10, fontWeight: goal === g.value ? 700 : 400,
                  cursor:'pointer', border: goal === g.value ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                  background: goal === g.value ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', color: 'var(--text)', textAlign:'left',
                }}>{g.icon} {g.label}</button>
              ))}
            </div>
            {/* Periodization pills */}
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:8, alignItems:'center' }}>
              <span style={{ fontSize:9, color:'rgba(255,255,255,0.35)' }}>РџРµСЂРёРѕРґРёР·Р°С†РёСЏ:</span>
              {[
                { v:'auto', l:'РђРІС‚Рѕ' }, { v:'linear', l:'Р›РёРЅРµР№РЅР°СЏ' },
                { v:'undulating', l:'DUP' }, { v:'block', l:'Р‘Р»РѕС‡РЅР°СЏ' },
              ].map(p => (
                <button key={p.v} onClick={() => { setPeriodizationType(p.v as any); setTimeout(generatePlan, 50); }} style={{
                  padding:'3px 8px', borderRadius:6, fontSize:9, fontWeight: periodizationType === p.v ? 700 : 400, cursor:'pointer',
                  border: periodizationType === p.v ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                  background: periodizationType === p.v ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', color: 'var(--text)',
                }}>{p.l}</button>
              ))}
            </div>
            {/* Cycle type - expanded with descriptions */}
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', marginBottom:4 }}>РўРёРї С†РёРєР»Р°:</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:3, marginBottom:8 }}>
              {[
                { v:'auto', l:'РђРІС‚Рѕ', d:'РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРёР№ РїРѕРґР±РѕСЂ РїРѕ С†РµР»Рё Рё СѓСЂРѕРІРЅСЋ' },
                { v:'bb_mass', l:'РњР°СЃСЃР°', d:'Р’С‹СЃРѕРєРёР№ РѕР±СЉС‘Рј, РёР·РѕР»СЏС†РёСЏ, wave-РєСЂРёРІР°СЏ' },
                { v:'bb_specialization', l:'РЎРїРµС†РёР°Р»РёР·Р°С†РёСЏ', d:'РђРєС†РµРЅС‚ РЅР° РѕС‚СЃС‚Р°СЋС‰РёРµ РіСЂСѓРїРїС‹' },
                { v:'pl_peaking', l:'РџР°СѓСЌСЂР»РёС„С‚РёРЅРі', d:'РЎРёР»РѕРІРѕР№ РїРёРє, 1РџРњ, Р»РёРЅРµР№РЅР°СЏ РєСЂРёРІР°СЏ' },
                { v:'wl_tech', l:'РўСЏР¶РµР»РѕР°С‚Р»РµС‚', d:'РўРµС…РЅРёС‡РµСЃРєРёРµ РґРІРёР¶РµРЅРёСЏ, СЂС‹РІРѕРє/С‚РѕР»С‡РѕРє' },
                { v:'cf_cond', l:'РљСЂРѕСЃСЃС„РёС‚', d:'РљРѕРЅРґРёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ, РјРµС‚РєРѕРЅС‹, РєСЂСѓРіРѕРІС‹Рµ' },
                { v:'rehab', l:'Р РµР°Р±РёР»РёС‚Р°С†РёСЏ', d:'Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ, РЅРёР·РєРёР№ РѕР±СЉС‘Рј' },
              ].map(c => (
                <button key={c.v} onClick={() => { setCycleType(c.v); setTimeout(generatePlan, 50); }} title={c.d} style={{
                  padding:'4px 6px', borderRadius:6, fontSize:8, fontWeight: cycleType === c.v ? 700 : 400, cursor:'pointer',
                  border: cycleType === c.v ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
                  background: cycleType === c.v ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)', color: 'var(--text)',
                  textAlign:'center', lineHeight:1.2,
                }}><div style={{fontWeight: cycleType === c.v ? 700 : 500}}>{c.l}</div><div style={{fontSize:6, color:'rgba(255,255,255,0.3)', marginTop:1}}>{c.d}</div></button>
              ))}
            </div>
            {/* Level pills + generate */}
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:9, color:'rgba(255,255,255,0.35)' }}>РЈСЂРѕРІРµРЅСЊ:</span>
              {LEVELS.map(l => (
                <button key={l.value} onClick={() => setLevel(l.value)} style={{
                  padding:'3px 8px', borderRadius:6, fontSize:9, fontWeight: level === l.value ? 700 : 400, cursor:'pointer',
                  border: level === l.value ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                  background: level === l.value ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', color: 'var(--text)',
                }}>{l.icon} {l.label}</button>
              ))}
            </div>
            <button onClick={() => generatePlan()} style={{
              width:'100%', padding:'9px', borderRadius:10, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,var(--accent),#00cc7a)', color:'#000', fontWeight:700, fontSize:12,
            }}>в–¶ РЎРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ РјР°РєСЂРѕС†РёРєР»</button>
            {cyclesError && <div style={{ padding:'6px 10px', borderRadius:6, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontSize:10, marginTop:6, textAlign:'center' }}>{cyclesError}</div>}
          </div>

          {/* Empty state */}
          {!macrocycle && !cyclesError && (
            <div style={{ padding:24, borderRadius:14, background:'rgba(24,24,27,0.08)', border:'1px solid rgba(255,255,255,0.04)', textAlign:'center' }}>
              <div style={{ fontSize:28, marginBottom:6 }}>рџ”„</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>РњР°РєСЂРѕС†РёРєР» РµС‰С‘ РЅРµ СЃРіРµРЅРµСЂРёСЂРѕРІР°РЅ</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>Р’С‹Р±РµСЂРёС‚Рµ РїР°СЂР°РјРµС‚СЂС‹ РІС‹С€Рµ Рё РЅР°Р¶РјРёС‚Рµ В«РЎРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ РјР°РєСЂРѕС†РёРєР»В»</div>
            </div>
          )}

          {macrocycle && (() => {
            const gCard: React.CSSProperties = { padding:12, borderRadius:14, background:'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.04)', marginBottom:8 };
            const gLabel: React.CSSProperties = { fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:500, letterSpacing:'0.3px', textTransform:'uppercase', marginBottom:8 };
            // Determine cycle type name
            const ctName = cycleType === 'auto' ? 'РђРІС‚Рѕ' : ({ bb_mass:'РњР°СЃСЃР°', bb_specialization:'РЎРїРµС†РёР°Р»РёР·Р°С†РёСЏ', pl_peaking:'РџР°СѓСЌСЂР»РёС„С‚РёРЅРі', wl_tech:'РўСЏР¶РµР»РѕР°С‚Р»РµС‚', cf_cond:'РљСЂРѕСЃСЃС„РёС‚', rehab:'Р РµР°Р±РёР»РёС‚Р°С†РёСЏ' } as Record<string,string>)[cycleType] || 'РђРІС‚Рѕ';
            const goalName = GOALS.find(g => g.value === macrocycle.goal)?.label || macrocycle.goal;
            const levelName = LEVELS.find(l => l.value === macrocycle.level)?.label || macrocycle.level;
            return (<>
              {/* Volume/intensity chart */}
              <div style={gCard}>
                <div style={gLabel}>рџ“Љ РћР±СЉС‘Рј Рё РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ РїРѕ РЅРµРґРµР»СЏРј</div>
                <div style={{ display:'flex', gap:1, height:80, alignItems:'flex-end' }}>
                  {(macrocycle.mesocycles || []).flatMap(mc => mc.microcycles || []).map((mc, wi) => {
                    const isCurrent = wi + 1 === selectedWeek;
                    const volH = Math.max(4, (mc?.volumeMultiplier || 1) * 35);
                    const intH = Math.max(4, (mc?.rpeTarget || 7) * 5);
                    const color = mc?.mesocycleType === 'accumulation' ? '#22c55e' :
                                 mc?.mesocycleType === 'intensification' ? '#eab308' :
                                 mc?.mesocycleType === 'peaking' ? '#ef4444' : '#6b7280';
                    return (
                      <div key={wi} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:1, cursor:'pointer' }}
                        onClick={() => { setSelectedWeek(wi + 1); setTab('plan'); }}>
                        <div style={{ width:'70%', height:volH, background:color, borderRadius:'2px 2px 0 0', opacity: isCurrent ? 1 : 0.4, transition:'height 0.2s' }} />
                        <div style={{ width:'40%', height:intH, background:color, borderRadius:'2px 2px 0 0', opacity: isCurrent ? 0.8 : 0.3 }} />
                        <span style={{ fontSize:7, color: isCurrent ? 'var(--accent)' : 'rgba(255,255,255,0.3)', fontWeight: isCurrent ? 700 : 400 }}>{wi + 1}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display:'flex', justifyContent:'center', gap:12, fontSize:8, color:'rgba(255,255,255,0.3)', marginTop:4 }}>
                  <span><span style={{ color:'#22c55e' }}>в– </span> РќР°РєРѕРїР»РµРЅРёРµ</span>
                  <span><span style={{ color:'#eab308' }}>в– </span> РРЅС‚РµРЅСЃРёС„РёРєР°С†РёСЏ</span>
                  <span><span style={{ color:'#ef4444' }}>в– </span> РџРёРє</span>
                  <span><span style={{ color:'#6b7280' }}>в– </span> Р Р°Р·РіСЂСѓР·РєР°</span>
                </div>
              </div>

              {/* Macrocycle header + mesocycles */}
              <div style={gCard}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <span style={gLabel}>рџ“… {macrocycle.totalWeeks}-РЅРµРґРµР»СЊРЅС‹Р№ РјР°РєСЂРѕС†РёРєР»</span>
                  <span style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.1)', color:'#00e68a' }}>{ctName}</span>
                </div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginBottom:6 }}>
                  {goalName} вЂў {levelName} вЂў Phase curve: {cycleType === 'bb_mass' || goal === 'bulk' ? 'рџЊЉ Wave' : goal === 'strength' || cycleType === 'pl_peaking' ? 'рџ“€ Linear' : goal === 'rehab' ? 'рџ“‰ Inverted' : 'вљ–пёЏ Balanced'}
                  {cycleType !== 'auto' && <span style={{ marginLeft:6, color:'rgba(255,255,255,0.2)' }}>| {({ bb_mass:'Р’С‹СЃРѕРєРёР№ РѕР±СЉС‘Рј, РёР·РѕР»СЏС†РёСЏ', bb_specialization:'РђРєС†РµРЅС‚ РЅР° СЃР»Р°Р±С‹Рµ РіСЂСѓРїРїС‹', pl_peaking:'РЎРёР»РѕРІРѕР№ РїРёРє, РЅРёР·РєРёР№ РѕР±СЉС‘Рј', wl_tech:'РўРµС…РЅРёС‡РµСЃРєРёРµ РґРІРёР¶РµРЅРёСЏ', cf_cond:'РњРµС‚РєРѕРЅС‹, РєСЂСѓРіРѕРІС‹Рµ', rehab:'Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ' } as Record<string,string>)[cycleType]}</span>}
                </div>
                {macrocycle.mesocycles.map((mc, mi) => (
                  <div key={mi} style={{ marginBottom:6, borderRadius:10, overflow:'hidden', background:'rgba(255,255,255,0.02)', border: expandedMeso === mi ? '1px solid rgba(0,230,138,0.15)' : '1px solid rgba(255,255,255,0.03)' }}
                    onClick={() => setExpandedMeso(expandedMeso === mi ? null : mi)}>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 8px', cursor:'pointer' }}>
                      <span style={{ fontWeight:600, fontSize:11, color:'rgba(255,255,255,0.7)' }}>
                        {PHASE_LABELS[mc.type] || 'Р Р°Р±РѕС‡Р°СЏ С„Р°Р·Р°'} <span style={{ fontSize:8, color:'rgba(255,255,255,0.2)' }}>РњРµР·Рѕ {mi + 1}</span>
                      </span>
                      <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)' }}>{mc.weeks} РЅРµРґ ({mc.weekStart + 1}вЂ“{mc.weekStart + mc.weeks}) {expandedMeso === mi ? 'в–ґ' : 'в–ѕ'}</span>
                    </div>
                    <div style={{ fontSize:8, color:'rgba(255,255,255,0.25)', padding:'0 8px 4px' }}>
                      {PHASE_HINTS[mc.type] || 'РЎС‚Р°Р±РёР»СЊРЅР°СЏ СЂР°Р±РѕС‡Р°СЏ С„Р°Р·Р° СЃ РєРѕРЅС‚СЂРѕР»РµРј РѕР±СЉС‘РјР°, РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚Рё Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ.'}
                    </div>
                    {/* Week squares */}
                    <div style={{ display:'flex', gap:3, flexWrap:'wrap', padding:'0 8px 6px' }}>
                      {Array.from({ length: mc.weeks }, (_, wi) => {
                        const weekNum = mc.weekStart + wi + 1;
                        const micro = mc.microcycles?.[wi];
                        const isDeload = micro?.isDeload;
                        return <div key={wi} style={{
                          width:22, height:22, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center',
                          background: selectedWeek === weekNum ? 'rgba(0,230,138,0.3)' : isDeload ? 'rgba(107,114,128,0.2)' : 'rgba(255,255,255,0.04)',
                          border: selectedWeek === weekNum ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
                          fontSize:8, color: selectedWeek === weekNum ? 'var(--accent)' : 'rgba(255,255,255,0.4)',
                          cursor:'pointer', transition:'all 0.15s',
                        }} onClick={(e) => { e.stopPropagation(); setSelectedWeek(weekNum); setTab('plan'); }}>
                          {weekNum}
                        </div>;
                      })}
                    </div>
                    {/* Expanded detail */}
                    {expandedMeso === mi && (
                      <div style={{ borderTop:'1px solid rgba(255,255,255,0.04)', padding:'6px 8px' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, marginBottom:4 }}>
                          {[
                            { label:'РўРёРї', value: mc.type || 'Р Р°Р±РѕС‡РёР№', color:'var(--accent)' },
                            { label:'РћР±СЉС‘Рј', value: `${(mc.microcycles?.[0]?.volumeMultiplier ?? 1).toFixed(1)}Г—`, color:'#60a5fa' },
                            { label:'RIR', value: `${mc.microcycles?.[0]?.rirRange?.[0] ?? 1}-${mc.microcycles?.[0]?.rirRange?.[1] ?? 3}`, color:'#f59e0b' },
                          ].map((s,i) => <div key={i} style={{ background:'rgba(255,255,255,0.02)', borderRadius:6, padding:'3px 6px', textAlign:'center' }}>
                            <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)' }}>{s.label}</div>
                            <div style={{ fontSize:10, fontWeight:700, color:s.color }}>{s.value}</div>
                          </div>)}
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, fontSize:8 }}>
                          {[
                            { label:'RPE', value: `${mc.microcycles?.[0]?.rpeTarget ?? 7}`, color:'var(--accent)' },
                            { label:'РЎРїР»РёС‚', value: goal === 'bulk' ? 'Р“РёРїРµСЂС‚СЂРѕС„РёСЏ' : goal === 'strength' ? 'РЎРёР»Р°' : goal === 'cut' ? 'РЎСѓС€РєР°' : 'Р‘Р°Р»Р°РЅСЃ', color:'#a78bfa' },
                            { label:'Р”РЅРµР№', value: `${daysPerWeek}`, color:'#f59e0b' },
                          ].map((s,i) => <div key={i} style={{ background:'rgba(255,255,255,0.02)', borderRadius:6, padding:'3px', textAlign:'center' }}>
                            <span style={{ color:'rgba(255,255,255,0.3)' }}>{s.label}: <b style={{ color:s.color }}>{s.value}</b></span>
                          </div>)}
                        </div>
                        {mc.microcycles && mc.microcycles.length > 0 && (
                          <div style={{ fontSize:8, color:'rgba(255,255,255,0.25)', marginTop:4 }}>
                            РњРёРєСЂРѕС†РёРєР»РѕРІ: {mc.microcycles.length} | РџСЂРѕРіСЂРµСЃСЃРёСЏ: <b style={{ color:'var(--accent)' }}>{mc.type === 'accumulation' ? '+РѕР±СЉС‘Рј' : mc.type === 'intensification' ? '+РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ' : mc.type === 'peaking' ? 'РїРёРє' : 'СЂР°Р·РіСЂСѓР·РєР°'}</b>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Projected max-out */}
              {diaryStats.length > 0 && (
                <div style={{ ...gCard, border:'1px solid rgba(0,230,138,0.15)' }}>
                  <div style={gLabel}>рџЋЇ РџСЂРѕРіРЅРѕР· Рє РєРѕРЅС†Сѓ РјР°РєСЂРѕС†РёРєР»Р°</div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', marginBottom:4 }}>
                    {macrocycle?.totalWeeks || 12} РЅРµРґ Г— {(trainingOutput?.estimatedProgress || 2)}%/РЅРµРґ РїСЂРѕРіСЂРµСЃСЃ
                  </div>
                  {diaryStats.slice(0,3).map(s => {
                    const projected = Math.round(s.max1RM * (1 + (trainingOutput?.estimatedProgress || 2) / 100 * (macrocycle?.totalWeeks || 12)));
                    const gain = projected - Math.round(s.max1RM);
                    return <div key={s.exerciseId} style={{ display:'flex', justifyContent:'space-between', fontSize:9, padding:'2px 0' }}>
                      <span style={{ color:'rgba(255,255,255,0.5)' }}>{s.exerciseName}</span>
                      <span style={{ color:'rgba(255,255,255,0.3)' }}>{Math.round(s.max1RM)} в†’ <b style={{ color:'#34d399' }}>{projected}</b> РєРі <span style={{ color:'#34d399' }}>(+{gain})</span></span>
                    </div>;
                  })}
                </div>
              )}

              {/* Phase params */}
              <div style={gCard}>
                <div style={gLabel}>рџ“Љ РџР°СЂР°РјРµС‚СЂС‹ С„Р°Р·</div>
                {macrocycle?.mesocycles?.map((mc, mi) => {
                  const firstMicro = mc.microcycles?.[0];
                  const vol = firstMicro?.volumeMultiplier || 1;
                  const rirLo = firstMicro?.rirRange?.[0] ?? 1;
                  const rirHi = firstMicro?.rirRange?.[1] ?? 3;
                  const rpe = firstMicro?.rpeTarget || 7;
                  return <div key={mi} style={{ marginBottom:3, padding:'4px 6px', borderRadius:6, background:'rgba(255,255,255,0.02)', fontSize:9 }}>
                    <span style={{ fontWeight:600, color:'rgba(255,255,255,0.6)' }}>{PHASE_LABELS[mc.type] || mc.type || 'Р¤Р°Р·Р°'}</span>
                    <span style={{ color:'rgba(255,255,255,0.25)', marginLeft:4 }}>РћР±СЉС‘Рј: {vol}Г— | RIR: {rirLo}-{rirHi} | RPE: {rpe} | {mc.weeks} РЅРµРґ</span>
                  </div>;
                })}
              </div>

              {/* Save to my cycles */}
              <button onClick={() => { try {
                const existing = JSON.parse(localStorage.getItem('myTrainingCycles') || '[]');
                existing.push({ id:'cycle_' + Date.now(), name: (macrocycle?.totalWeeks || 12) + '-РЅРµРґ ' + goalName, date: new Date().toISOString(), weeks: macrocycle?.totalWeeks || 12, goal, level, days: daysPerWeek });
                localStorage.setItem('myTrainingCycles', JSON.stringify(existing));
                setMyCycleMsg('вњ… Р¦РёРєР» РґРѕР±Р°РІР»РµРЅ РІ В«РњРѕРё С†РёРєР»С‹В»!');
                setTimeout(() => setMyCycleMsg(''), 3000);
              } catch {} }} style={{
                width:'100%', padding:9, borderRadius:10, border:'1px solid rgba(0,230,138,0.3)', cursor:'pointer',
                background:'rgba(0,230,138,0.06)', color:'var(--accent)', fontWeight:600, fontSize:11,
              }}>рџ“‹ Р’ РјРѕРё С†РёРєР»С‹</button>
              {myCycleMsg && <div style={{ padding:'6px 10px', borderRadius:6, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', color:'#8b5cf6', fontSize:10, marginTop:4, textAlign:'center' }}>{myCycleMsg}</div>}
            </>);
          })()}
          </div>
          </InfoErrorBoundary>
        )}
      {/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ HISTORY TAB в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */}
      {tab === 'history' && <InfoErrorBoundary label="РСЃС‚РѕСЂРёСЏ">{(() => {
        try {
        const gCard: React.CSSProperties = { padding:12, borderRadius:14, background:'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.04)', marginBottom:8 };
        if (diaryProgress.length === 0) return (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={gCard}>
              <div style={{ textAlign:'center', padding:20 }}>
                <div style={{ fontSize:28, marginBottom:6 }}>рџ“њ</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>РќРµС‚ Р·Р°РїРёСЃРµР№. РќР°С‡РЅРёС‚Рµ РІРµСЃС‚Рё РґРЅРµРІРЅРёРє РЅР° РІРєР»Р°РґРєРµ В«Р”РЅРµРІРЅРёРєВ».</div>
              </div>
            </div>
          </div>
        );
          useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'he_training_planning_track') {
        const val = localStorage.getItem('he_training_planning_track');
        const parsed = val === 'manual' || val === 'bb' ? val : 'pl';
        setPlanningTrack(parsed);
        setPlanningTrackState(parsed);
      }
      if (e.key === 'he_training_tab') {
        const val = localStorage.getItem('he_training_tab');
        // Validate tab
        const validTabs = ['plan', 'cycles', 'programs', 'mytraining', 'programcalc', 'volume', 'library', 'analytics', 'visual', 'progress', 'excalc', 'volume', 'methods', 'timers', 'history', 'reports', 'srcbb'];
        if (validTabs.includes(val)) {
          setTab(val);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
return (<div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <div style={gCard}>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:500, letterSpacing:'0.3px', textTransform:'uppercase', marginBottom:8 }}>рџ“њ РСЃС‚РѕСЂРёСЏ С‚СЂРµРЅРёСЂРѕРІРѕРє</div>
            <div style={{ display:'flex', gap:6, marginBottom:8 }}>
              {[
                { label:'РќРµРґРµР»СЊ', value:diaryProgress.length, color:'#34d399' },
                { label:'РўСЂРµРЅРёСЂРѕРІРѕРє', value:diaryProgress.reduce((s,w)=>s+w.workoutCount,0), color:'#60a5fa' },
                { label:'РћР±СЉС‘Рј', value:diaryProgress.length > 0 ? `${(diaryProgress[diaryProgress.length-1]?.totalVolume/1000).toFixed(1)}С‚` : 'вЂ”', color:'#f59e0b' },
              ].map((s,i) => <div key={i} style={{ flex:1, background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'6px 4px', textAlign:'center' }}>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.35)' }}>{s.label}</div>
                <div style={{ fontSize:16, fontWeight:800, color:s.color }}>{s.value}</div>
              </div>)}
            </div>
            {[...diaryProgress].sort((a,b)=>b.week-a.week).map((w,wi) => (
              <div key={wi} style={{ borderRadius:10, marginBottom:4, overflow:'hidden', background:'rgba(255,255,255,0.02)', border: historyExpanded===`w${wi}` ? '1px solid rgba(0,230,138,0.2)' : '1px solid rgba(255,255,255,0.03)', transition:'border 0.2s' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', cursor:'pointer' }} onClick={()=>setHistoryExpanded(historyExpanded===`w${wi}`?null:`w${wi}`)}>
                  <div>
                    <span style={{ fontWeight:700, fontSize:12, color:'rgba(255,255,255,0.8)' }}>РќРµРґРµР»СЏ {w.week}</span>
                    <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)', marginLeft:6 }}>{w.workoutCount} С‚СЂ.</span>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    {(() => { try { const sorted = [...diaryProgress].sort((a,b)=>b.week-a.week); const prev = sorted[wi+1]; if (!prev) return null; const d = Math.round((w.totalVolume-prev.totalVolume)/Math.max(1,prev.totalVolume)*100); return <span style={{ fontSize:11, fontWeight:700, color:d>5?'#34d399':d<-5?'#f87171':'#6b7280' }}>{d>5?'в†‘':d<-5?'в†“':'в†’'}</span>; } catch{ return null; } })()}
                    <span style={{ fontSize:11, fontWeight:700, color:'#34d399' }}>{Math.round(w.totalVolume).toLocaleString()} РєРі</span>
                    <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)' }}>{historyExpanded===`w${wi}`?'в–ґ':'в–ѕ'}</span>
                  </div>
                </div>
                {historyExpanded===`w${wi}` && <div style={{ padding:'0 10px 8px', borderTop:'1px solid rgba(255,255,255,0.04)', paddingTop:6 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, marginBottom:6 }}>
                    {[
                      { label:'РћР±СЉС‘Рј', value:`${Math.round(w.totalVolume)} РєРі`, color:'#34d399' },
                      { label:'РўСЂРµРЅРёСЂРѕРІРѕРє', value:w.workoutCount, color:'#60a5fa' },
                      { label:'1RM СЃСЂ.', value:`${Math.round(w.total1RM)} РєРі`, color:'#f59e0b' },
                    ].map((s,i) => <div key={i} style={{ background:'rgba(255,255,255,0.02)', borderRadius:6, padding:'4px 6px', textAlign:'center' }}>
                      <div style={{ fontSize:8, color:'rgba(255,255,255,0.3)' }}>{s.label}</div>
                      <div style={{ fontSize:12, fontWeight:700, color:s.color }}>{s.value}</div>
                    </div>)}
                  </div>
                  {(diaryStats.filter(s=>s.workoutCount>0).slice(0,5).length > 0) && <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)' }}>
                    {diaryStats.filter(s=>s.workoutCount>0).slice(0,5).map(s => (
                      <div key={s.exerciseId} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                        <span style={{ color:'rgba(255,255,255,0.6)' }}>{s.exerciseName}</span>
                        <span style={{ color:'#34d399', fontWeight:600 }}>{s.maxWeight}Г—{s.maxReps}</span>
                        <span style={{ color:'rgba(255,255,255,0.3)' }}>1RM {Math.round(s.max1RM)} РєРі</span>
                      </div>
                    ))}
                  </div>}
                </div>}
              </div>
            ))}
          </div>
        </div>);
        } catch { return <div style={{ padding:20, textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:11 }}>РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РёСЃС‚РѕСЂРёРё</div>; }
      })()}</InfoErrorBoundary>}
      {/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ ANALYTICS TAB в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */}
      {tab === 'analytics' && <InfoErrorBoundary label="РђРЅР°Р»РёС‚РёРєР°"><><AnalyticsTab sessions={historyWorkouts} onRefresh={loadDiaryStats} /><StructuredAnalyticsCard sessions={historyWorkouts} /></></InfoErrorBoundary>}
      {tab === 'library' && (
  <InfoErrorBoundary label="Р‘РёР±Р»РёРѕС‚РµРєР°">
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', marginBottom: 2 }}>рџ“љ Р‘РёР±Р»РёРѕС‚РµРєР° С‚СЂРµРЅРёСЂРѕРІРѕС‡РЅРѕРіРѕ Р±Р»РѕРєР°</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>РЎРїСЂР°РІРѕС‡РЅРёРє: РјРµС‚РѕРґРёРєРё СЃ РїРѕРґСЂРѕР±РЅС‹Рј РѕРїРёСЃР°РЅРёРµРј, РѕР±СЉС‘РјРЅС‹Рµ РѕСЂРёРµРЅС‚РёСЂС‹, РІРёР·СѓР°Р»РёР·Р°С†РёСЏ СЃРїР»РёС‚РѕРІ, РєР°С‚Р°Р»РѕРі С†РёРєР»РѕРІ Рё РїСЂРѕРіСЂР°РјРјС‹.</div>
      <ExpandableCard title="рџ”„ РљР°С‚Р°Р»РѕРі С†РёРєР»РѕРІ (РЎР Р¦ / Р±Р»РѕРєРё / РІСЃС‚СЂРѕРµРЅРЅС‹Рµ)" icon="рџ“–" short="Р’СЃРµ РґРѕСЃС‚СѓРїРЅС‹Рµ С†РёРєР»С‹ СЃ РїРѕР»РЅС‹Рј РѕРїРёСЃР°РЅРёРµРј. РќР°Р¶РјРёС‚Рµ, С‡С‚РѕР±С‹ СЂР°Р·РІРµСЂРЅСѓС‚СЊ." full={
        <div>
          {LMS_CYCLES.map(c => (
            <ExpandableCard key={c.meta.id} title={c.meta.title} icon="" accent="#00e68a" short={c.meta.description} full={<><div style={{ marginBottom: 6 }}>{c.meta.howItWorks}</div>{c.meta.conditions.length > 0 && <div><b>РЈСЃР»РѕРІРёСЏ:</b><ul style={{ margin: '4px 0 0 16px', padding: 0 }}>{c.meta.conditions.map((cond, i) => <li key={i} style={{ marginBottom: 2 }}>{cond}</li>)}</ul></div>}</>} />
          ))}
        </div>
      } />
      <MethodologyEncyclopedia />
      <ProgramsTab selectedProgram={selectedProgram} setSelectedProgram={setSelectedProgram} onAddToMyTraining={(exs) => setCustomExercises(prev => [...prev, ...exs])} />
      <MethodsTab linked={linked} trainingOutput={trainingOutput} diaryStats={diaryStats} historyWorkouts={historyWorkouts} goal={goal} level={level} daysPerWeek={daysPerWeek} recovery={recovery} fatigue={fatigue} appliedMethods={appliedMethods} onToggleMethod={(name, category) => setAppliedMethods(prev => { const next = { ...prev }; if (next[category] === name) delete next[category]; else next[category] = name; return next; })} onApplyComposition={() => { applyMethodComposition(); setTab('plan'); }} />
    </div>
  </InfoErrorBoundary>
)}
{tab === 'methods' && <InfoErrorBoundary label="РњРµС‚РѕРґС‹"><MethodsTab linked={linked} trainingOutput={trainingOutput} diaryStats={diaryStats} historyWorkouts={historyWorkouts} goal={goal} level={level} daysPerWeek={daysPerWeek} recovery={recovery} fatigue={fatigue} appliedMethods={appliedMethods} onToggleMethod={(name, category) => setAppliedMethods(prev => { const next = { ...prev }; if (next[category] === name) delete next[category]; else next[category] = name; return next; })} onApplyComposition={() => { applyMethodComposition(); setTab('plan'); }} /></InfoErrorBoundary>}
      {tab === 'visual' && <InfoErrorBoundary label="Р’РёР·СѓР°Р»РёР·Р°С†РёСЏ"><VisualTab sessions={historyWorkouts} /></InfoErrorBoundary>}
      {tab === 'programs' && <InfoErrorBoundary label="РџСЂРѕРіСЂР°РјРјС‹"><ProgramsTab selectedProgram={selectedProgram} setSelectedProgram={setSelectedProgram} onAddToMyTraining={(exs) => setCustomExercises(prev => [...prev, ...exs])} /></InfoErrorBoundary>}
      {tab === 'timers' && <InfoErrorBoundary label="РўР°Р№РјРµСЂС‹"><TimersTab /></InfoErrorBoundary>}
      {tab === 'progress' && <InfoErrorBoundary label="РџСЂРѕРіСЂРµСЃСЃ"><ProgressTab historyWorkouts={historyWorkouts} /></InfoErrorBoundary>}
      {tab === 'excalc' && <InfoErrorBoundary label="РљР°Р»СЊРєСѓР»СЏС‚РѕСЂ СѓРїСЂР°Р¶РЅРµРЅРёР№"><ExerciseCalcTab /></InfoErrorBoundary>}
      {tab === 'volume' && <InfoErrorBoundary label="Р Р°СЃС‡С‘С‚ РѕР±СЉС‘РјР°"><VolumeOptimizerTab /></InfoErrorBoundary>}

      {/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ MY TRAINING TAB в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */}
      {tab === 'mytraining' && (
        <InfoErrorBoundary label="РњРѕРё С‚СЂРµРЅРёСЂРѕРІРєРё">
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <MyTrainingTab customExercises={customExercises} setCustomExercises={setCustomExercises} goal={goal} level={level} daysPerWeek={daysPerWeek} mesoLength={mesoLength} />
        </div>
        </InfoErrorBoundary>
      )}

      {/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ REPORTS TAB в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */}
      {tab === 'reports' && (
        <InfoErrorBoundary label="РћС‚С‡С‘С‚С‹">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 13 }}>рџ“„ РћС‚С‡С‘С‚С‹ РїРѕ С‚СЂРµРЅРёСЂРѕРІРєР°Рј</h3>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--text-dim)' }}>
              РЎРіРµРЅРµСЂРёСЂСѓР№С‚Рµ РєРѕРјРїР»РµРєСЃРЅС‹Р№ РѕС‚С‡С‘С‚ РїРѕ РІР°С€РёРј С‚СЂРµРЅРёСЂРѕРІРєР°Рј: РёРЅС„РѕСЂРјР°С†РёСЏ РёР· РєР°С‚Р°Р»РѕРіР° СѓРїСЂР°Р¶РЅРµРЅРёР№, СЃС‚Р°С‚РёСЃС‚РёРєР° РїР»Р°РЅР° (РЅРµРґРµР»Рё, СѓРїСЂР°Р¶РЅРµРЅРёСЏ РІ РЅРµРґРµР»СЋ), РјРµС‚СЂРёРєРё С‚СЂРµРЅРёСЂРѕРІРѕРє (РѕР±СЉС‘Рј, РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ).
            </p>

            <button onClick={() => {
              const planWeeks = macrocycle?.totalWeeks ?? (trainingOutput?.plan?.length && daysPerWeek > 0 ? Math.ceil(trainingOutput.plan.length / daysPerWeek) : 0);
              const totalVolume = trainingOutput?.weeklyVolume ?? 0;
              const avgIntensity = trainingOutput?.estimatedProgress ? Math.round(50 + trainingOutput.estimatedProgress * 5) : 0;
              const report = {
                id: 'report_' + Date.now(),
                date: new Date().toISOString(),
                exerciseCatalogCount: Object.keys(EXERCISE_CATALOG).length,
                planWeeks,
                exercisesPerWeek: daysPerWeek,
                totalVolume,
                avgIntensity,
                goal, level, daysPerWeek, splitType, periodizationType, mesoLength,
              };
              const updated = [report, ...trainingArchive].slice(0, 20);
              setTrainingArchive(updated);
              try { localStorage.setItem('he_training_reports', JSON.stringify(updated)); } catch {}
              try { localStorage.setItem('he_training_report_current', JSON.stringify(report)); } catch {}
              setTrainingReportGenerated(true);
            }} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer',
            }}>РЎРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ РѕС‚С‡С‘С‚</button>

            {trainingReportGenerated && (
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#22c55e' }}>вњ“ РћС‚С‡С‘С‚ СЃРіРµРЅРµСЂРёСЂРѕРІР°РЅ Рё СЃРѕС…СЂР°РЅС‘РЅ РІ Р°СЂС…РёРІРµ</p>
            )}
          </div>

          {/* Archive */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h4 style={{ margin: 0, fontSize: 12 }}>рџ“¦ РђСЂС…РёРІ РѕС‚С‡РµС‚РѕРІ ({trainingArchive.length})</h4>
              {trainingArchive.length > 0 && (
                <button onClick={() => {
                  setTrainingArchive([]);
                  localStorage.removeItem('he_training_reports');
                  localStorage.removeItem('he_training_report_current');
                  setTrainingReportGenerated(false);
                }} style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                  background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: 'none', cursor: 'pointer',
                }}>РћС‡РёСЃС‚РёС‚СЊ Р°СЂС…РёРІ</button>
              )}
            </div>
            {trainingArchive.length === 0 ? (
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)' }}>РђСЂС…РёРІ РїСѓСЃС‚. РЎРіРµРЅРµСЂРёСЂСѓР№С‚Рµ РїРµСЂРІС‹Р№ РѕС‚С‡С‘С‚.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[...trainingArchive].reverse().map((r: any) => (
                  <div key={r.id} style={{
                    padding: '8px 10px', borderRadius: 6,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>РћС‚С‡С‘С‚ {new Date(r.date).toLocaleDateString('ru')}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{new Date(r.date).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: 10, color: 'var(--text-dim)' }}>
                      <span>РЈРїСЂР°Р¶РЅРµРЅРёР№ РІ РєР°С‚Р°Р»РѕРіРµ: {r.exerciseCatalogCount}</span>
                      <span>РќРµРґРµР»СЊ РІ РїР»Р°РЅРµ: {r.planWeeks}</span>
                      <span>РўСЂРµРЅРёСЂРѕРІРѕРє/РЅРµРґ: {r.exercisesPerWeek}</span>
                      <span>РћР±С‰РёР№ РѕР±СЉС‘Рј: {r.totalVolume}</span>
                      <span>РЎСЂ. РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ: {r.avgIntensity}%</span>
                      <span>Р¦РµР»СЊ: {r.goal}, РЈСЂРѕРІРµРЅСЊ: {r.level}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </InfoErrorBoundary>
      )}
    </div>
      )}
    </div>
  );
};

import { MyTrainingTab } from './TrainingScreen_parts/MyTrainingTab';
import { PowerliftingTab } from './TrainingScreen_parts/PowerliftingTab';
import { BodybuildingTab } from './TrainingScreen_parts/BodybuildingTab';
import { MethodsTab } from './TrainingScreen_parts/MethodsTab';
import { VisualTab } from './TrainingScreen_parts/VisualTab';
import { AnalyticsTab } from './TrainingScreen_parts/AnalyticsTab';
import { ProgramsTab } from './TrainingScreen_parts/ProgramsTab';
import { VolumeOptimizerTab } from './TrainingScreen_parts/VolumeOptimizerTab';
import { ExerciseCalcTab } from './TrainingScreen_parts/ExerciseCalcTab';
import { TrainingLoadCalculator } from './TrainingScreen_parts/TrainingLoadCalculator';
import { TonnageCalcTab } from './TrainingScreen_parts/TonnageCalcTab';
import { WhatIfCard } from './TrainingScreen_parts/WhatIfCard';
import { ReadinessForecastCard } from './TrainingScreen_parts/ReadinessForecastCard';
import { MethodologyEncyclopedia } from './TrainingScreen_parts/MethodologyEncyclopedia';
import { labTrainingAdjust } from './TrainingScreen_parts/lab-training-adjust';
import { appendReadinessToday, loadReadinessHistory } from './TrainingScreen_parts/readiness-history';
import { useTrainingProfile } from './TrainingScreen_parts/training-profile';
import { TrainingProfileCard } from './TrainingScreen_parts/TrainingProfileCard';
import { loadSRPESessions } from '../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads, weeklyMonotony } from '../../engines/pro/training-load.engine';
import { PopupSelect, PopupNumber, ExpandableCard } from './SRCBBScreen_parts/TrainingPopups';
import { LMS_CYCLES } from '../../data/lms-cycles/lms-cycle-index';
import { WOMENS_PROGRAMS, CUSTOM_PROGRAMS } from './TrainingScreen_parts/programs-data';
import { SessionPlayer, type PlayerDay } from './SRCBBScreen_parts/SessionPlayer';
import { TimersTab } from './TrainingScreen_parts/TimersTab';
import { ProgressTab } from './TrainingScreen_parts/ProgressTab';
import { StrengthLevelCard } from './TrainingScreen_parts/StrengthLevelCard';
import { StructuredAnalyticsCard } from './TrainingScreen_parts/StructuredAnalyticsCard';
import { ExerciseGeneratorContent } from './TrainingScreen_parts/ExerciseGenerator';




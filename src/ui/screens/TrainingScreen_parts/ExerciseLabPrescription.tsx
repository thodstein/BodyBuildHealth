import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { calcExercisePrescription } from '../../../engines/training.engine';
import { mesocyclePhaseForWeek } from '../../../engines/rir-matrix.engine';
import { calculateRepDuration, parseTempo } from '../../../engines/rep-tempo.engine';
import { forceVector, lengthenedPartials } from '../../../engines/pro/exercise-prescription.engine';
import { assessSafety } from '../../../engines/movement-engines';
import { PopupSelect, PopupNumber, PopupText, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';
import { useDataLink } from '../../../core/data-link';
import {
  ACCENT, DIM, CARD, SMALL,
  GROUPS, GROUP_RU, TYPE_RU, EQUIP_RU, RIR_TO_RPE, RPE_LABEL,
  REGION_MAP, getExerciseRegion, getResistanceProfile, getDifficultyScaler,
  SUBREGION_DEFS, calcTechniqueScore, getRiskColor,
} from './ExerciseLabShared';
import { calculatePlates } from '../../../engines/gym-competition.engine';
import { estimate1RMConsensus } from '../../../engines/pro/estimate1rm.engine';
import { velocityForPct, pctForVelocity, estimate1RMFromVelocity } from '../../../engines/pro/vbt.engine';
import { tempoFor, tutForSet } from '../../../engines/bb/bb-tempo-rest';
import { techniquesFor } from '../../../engines/bb/bb-intensity-techniques';

const PrescriptionTab: React.FC<{ selectedId?: string | null; onSelectExercise?: (ex: any) => void }> = ({ selectedId, onSelectExercise }) => {
  const { profile } = useDataLink();
  const [group, setGroup] = useState('chest');
  const [exId, setExId] = useState(selectedId || '');
  const [oneRM, setOneRM] = useState(0);
  const [goal, setGoal] = useState('strength');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [week, setWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(12);
  const [manualTempo, setManualTempo] = useState('');
  const [weakToggle, setWeakToggle] = useState(false);
  const [region, setRegion] = useState('all');
  const [showGenerator, setShowGenerator] = useState(true);

  const [genGroup, setGenGroup] = useState('chest');
  const [genGoal, setGenGoal] = useState('bulk');
  const [genLevel, setGenLevel] = useState('intermediate');
  const [genCount, setGenCount] = useState(5);
  const [genResult, setGenResult] = useState<Array<{ name: string; group: string; type: string; equipment: string; sets: number; reps: string; rir: number; rest: number; weight: number; pct: number }> | null>(null);

  useEffect(() => { if (selectedId) setExId(selectedId); }, [selectedId]);

  useEffect(() => {
    if (!profile) return;
    const lvl = profile?.settings.trainingLevel ?? 'intermediate';
    setLevel((lvl === 'enhanced' ? 'advanced' : lvl) as 'beginner' | 'intermediate' | 'advanced');
    setGoal((profile?.settings as any)?.training?.primaryGoal ?? 'strength');
  }, [profile]);

  useEffect(() => {
    if (!exId || !profile) { setOneRM(0); return; }
    const baseline = profile?.settings.strengthBaselines?.[exId];
    setOneRM(baseline && baseline > 0 ? baseline : 100);
  }, [exId, profile]);

  const exList = useMemo(() => {
    let list = group === 'all' ? EXERCISE_CATALOG : EXERCISE_CATALOG.filter(e => e.group === group);
    if (region !== 'all') list = list.filter(e => getExerciseRegion(e.id, e.group) === region);
    return list;
  }, [group, region]);

  const ex = useMemo(() => EXERCISE_CATALOG.find(e => e.id === exId), [exId]);
  const presc = useMemo(() => {
    if (!ex) return null;
    try { return calcExercisePrescription(ex, goal, level, weakToggle, false, 1, week, totalWeeks); } catch { return null; }
  }, [ex, goal, level, weakToggle, week, totalWeeks]);

  const reps0 = ex && presc ? (parseInt(presc.reps) || 5) : 5;
  const pct = Math.round(100 / (1 + reps0 / 30));
  const workWeight = ex && presc ? +(oneRM * pct / 100).toFixed(1) : 0;
  const phase = useMemo(() => mesocyclePhaseForWeek(week, totalWeeks), [week, totalWeeks]);
  const isDeload = phase === 'deload';

  useEffect(() => { setRegion('all'); }, [group]);

  useEffect(() => {
    const exs = EXERCISE_CATALOG.filter(e => e.group === genGroup).slice(0, genCount * 2);
    const scored = exs.map((e: any) => {
      const p = calcExercisePrescription(e, genGoal, genLevel, false, false, 1);
      let score = 0;
      if (e.type === 'compound') score += 10;
      if (e.type === 'isolation') score += 3;
      return { ex: e, p, score };
    });
    scored.sort((a: any, b: any) => b.score - a.score);
    const genLevelNumber = genLevel === 'beginner' ? 1 : genLevel === 'intermediate' ? 2 : genLevel === 'advanced' ? 3 : 4;
    const fakeRM = 80 + genLevelNumber * 20;
    setGenResult(scored.slice(0, genCount).map((s: any) => {
      const repsN = parseInt(s.p.reps) || 5;
      const pcN = Math.round(100 / (1 + repsN / 30));
      return {
        name: s.ex.name, group: s.ex.group, type: s.ex.type,
        equipment: s.ex.equipment || '—', sets: s.p.sets, reps: s.p.reps,
        rir: s.p.rir, rest: s.p.rest, weight: +((fakeRM) * pcN / 100).toFixed(1), pct: pcN,
      };
    }));
  }, [genGroup, genGoal, genLevel, genCount]);

  const volumeLoad = useMemo(() => {
    if (!ex || !presc || !workWeight) return 0;
    const avgReps = parseInt(presc.reps.split('-')[0]) + parseInt(presc.reps.split('-')[1] || presc.reps.split('-')[0]);
    return Math.round(presc.sets * (avgReps / 2) * workWeight);
  }, [ex, presc, workWeight]);

  const tutInfo = useMemo(() => {
    if (!ex || !presc || !workWeight) return null;
    const tempo = parseTempo(manualTempo || presc.tempo);
    if (!tempo) return null;
    const repDuration = calculateRepDuration(tempo);
    const avgReps = (parseInt(presc.reps.split('-')[0]) + parseInt(presc.reps.split('-')[1] || presc.reps.split('-')[0])) / 2;
    const perSet = +(avgReps * repDuration).toFixed(0);
    const perSession = +(perSet * presc.sets).toFixed(0);
    return { repDuration, perSet, perSession, eccentric: tempo.eccentric, bottomPause: tempo.bottomPause, concentric: tempo.concentric, topPause: tempo.topPause };
  }, [ex, presc, manualTempo, workWeight]);

  const rpeInfo = useMemo(() => {
    if (!presc) return null;
    const rpe = RIR_TO_RPE[presc.rir] ?? Math.max(1, 10 - presc.rir);
    return { rpe, label: RPE_LABEL[rpe] || `${rpe}/10` };
  }, [presc]);

  const amrapEstimate = useMemo(() => {
    if (!oneRM || !workWeight || workWeight <= 0) return 0;
    return Math.max(0, Math.round(30 * (oneRM / workWeight - 1)));
  }, [oneRM, workWeight]);

  const fatigueScore = useMemo(() => {
    if (!ex || !presc) return 0;
    const baseCost = ex.fatigueCost || 5;
    const setFactor = Math.min(presc.sets / 3, 2);
    const compoundPenalty = ex.type === 'compound' ? 1.2 : 1;
    const deloadDiscount = isDeload ? 0.5 : 1;
    return +(baseCost * setFactor * compoundPenalty * deloadDiscount).toFixed(1);
  }, [ex, presc, isDeload]);

  const oneRMProjection = useMemo(() => {
    if (!oneRM || oneRM <= 0) return null;
    const weeklyRate = level === 'beginner' ? 2.5 : level === 'intermediate' ? 1.5 : 1;
    const progressionWeeks = Math.max(0, totalWeeks - week);
    const projected = +(oneRM + weeklyRate * progressionWeeks).toFixed(1);
    const pctGain = +((projected / oneRM - 1) * 100).toFixed(1);
    return { current: oneRM, projected, weeklyRate, pctGain, progressionWeeks };
  }, [oneRM, level, totalWeeks, week]);

  const resistanceProfile = useMemo(() => { if (!ex) return null; return getResistanceProfile(ex); }, [ex]);
  const difficultyScaler = useMemo(() => { if (!ex) return null; return getDifficultyScaler(ex); }, [ex]);

  const freqRecommendation = useMemo(() => {
    if (!ex) return null;
    const g = ex.group;
    const levelFreq: Record<string, Record<string, [number, number]>> = {
      chest: { beginner: [2, 3], intermediate: [1.5, 2.5], advanced: [1, 2] },
      back: { beginner: [2, 3], intermediate: [1.5, 2.5], advanced: [1, 2] },
      legs: { beginner: [2, 2], intermediate: [1.5, 2], advanced: [1, 2] },
      shoulders: { beginner: [2, 3], intermediate: [2, 3], advanced: [2, 3] },
      arms: { beginner: [2, 3], intermediate: [2, 3], advanced: [2, 3] },
      core: { beginner: [3, 4], intermediate: [2, 3], advanced: [2, 3] },
    };
    const range = levelFreq[g]?.[level] ?? [2, 3];
    const min = Math.max(1, range[0]); const max = Math.max(min + 0.5, range[1]);
    const label = min >= 2 ? `${min.toFixed(0)}-${max.toFixed(0)}×/нед` : `${min.toFixed(0)}-${max.toFixed(0)}×/нед`;
    return { min, max, label, group: g, globalFreq: min >= 2.5 ? 'PPL / upper-lower' : 'upper-lower / fullbody' };
  }, [ex, level]);

  const autoProgression = useMemo(() => {
    if (!ex || !presc || !workWeight) return null;
    const weeks: Array<{ w: number; sets: number; reps: string; rir: number; rest: number; weight: number; pct: number }> = [];
    for (let i = 0; i < 4; i++) {
      const w = Math.min(week + i, totalWeeks);
      try {
        const p = calcExercisePrescription(ex, goal, level, weakToggle, false, 1, w, totalWeeks);
        const r = parseInt(p.reps) || 5;
        const pc = 100 / (1 + r / 30);
        weeks.push({ w, sets: p.sets, reps: p.reps, rir: p.rir, rest: p.rest, weight: +(oneRM * pc / 100).toFixed(1), pct: Math.round(pc) });
      } catch { weeks.push({ w, sets: presc.sets, reps: presc.reps, rir: presc.rir + 1, rest: presc.rest, weight: workWeight, pct }); }
    }
    return weeks;
  }, [ex, presc, workWeight, goal, level, week, totalWeeks, oneRM]);

  const fatigueAnalysis = useMemo(() => {
    if (!ex || !presc) return null;
    const isCompound = ex.type === 'compound';
    const js = ex.jointStress || 'medium';
    const baseFatigue = ex.fatigueCost || 5;
    const cnsBase = isCompound ? (js === 'high' ? 7 : 5) : 2;
    const cnsSetFactor = Math.min(presc.sets / 3, 1.5);
    const cnsRirPenalty = presc.rir <= 1 ? 1.2 : presc.rir >= 4 ? 0.6 : 1;
    const cnsDeload = isDeload ? 0.3 : 1;
    const cnsLoad = Math.min(10, +(cnsBase * cnsSetFactor * cnsRirPenalty * cnsDeload).toFixed(1));
    const muscBase = isCompound ? 4 : 7;
    const muscSetFactor = Math.min(presc.sets / 4, 1.6);
    const muscFatigueMult = baseFatigue / 5;
    const muscDeload = isDeload ? 0.35 : 1;
    const muscularLoad = Math.min(10, +(muscBase * muscSetFactor * muscFatigueMult * muscDeload).toFixed(1));
    const totalLoad = cnsLoad + muscularLoad;
    const recHours = Math.round((isCompound ? 48 : 24) * (totalLoad / 12) * (isDeload ? 0.5 : 1));
    let advice = '';
    if (cnsLoad >= 7) advice = 'Лимит — ЦНС. Восст. 48-72ч. Сон ≥8ч, минимизировать доп. работу на синергисты.';
    else if (muscularLoad >= 7) advice = 'Метаболический стресс. Восст. 24-48ч. Лёгкая ходьба, белок 2г/кг.';
    else if (totalLoad <= 4) advice = 'Низкое утомление. Можно ежедневно. Подходит для разминки/восстановления.';
    else advice = 'Умеренная нагрузка. Восст. 24-48ч. Не прибавляйте >10%/нед.';
    return { cnsLoad, muscularLoad, recoveryHours: recHours, cnsLabel: cnsLoad >= 7 ? 'Высокая (ЦНС)' : 'Умеренная', muscularLabel: muscularLoad >= 7 ? 'Высокая (мышцы)' : 'Умеренная', advice };
  }, [ex, presc, isDeload]);

  const warmupRamp = useMemo(() => {
    if (!ex || !presc || !workWeight || workWeight <= 0) return null;
    const w = workWeight;
    const pcts = w >= 150 ? [0.3, 0.4, 0.5, 0.6, 0.7] : w >= 80 ? [0.35, 0.45, 0.55, 0.65] : [0.4, 0.55, 0.7];
    const steps = pcts.map((pct, i) => ({ pct: Math.round(pct * 100), weight: +(w * pct).toFixed(1), reps: isDeload ? 5 : Math.max(2, pcts.length - i + 2), label: i === 0 ? 'Пустой гриф / лёгкий' : i === pcts.length - 1 ? 'Подход-разминка' : 'Разминочный' }));
    return { steps, w };
  }, [ex, presc, workWeight, isDeload]);

  const metabolicCost = useMemo(() => {
    if (!ex || !presc || !tutInfo || !workWeight) return null;
    const bodyWeight = profile?.settings?.weight ?? 80;
    const isCompound = ex.type === 'compound';
    const met = isCompound ? 6.0 : 3.5;
    const avgReps = (parseInt(presc.reps.split('-')[0]) + parseInt(presc.reps.split('-')[1] || presc.reps.split('-')[0])) / 2;
    const timePerSetH = (avgReps * tutInfo.repDuration + 0.5) / 3600;
    const totalTimeH = timePerSetH * presc.sets;
    const totalCal = Math.round(met * bodyWeight * totalTimeH * 1.05);
    const glycogen = Math.round((isCompound ? 1.5 : 0.8) * presc.sets);
    const epoc = Math.round(totalCal * 0.12);
    return { totalCal, glycogen, epoc, met, totalTimeMin: Math.round(totalTimeH * 60) };
  }, [ex, presc, tutInfo, workWeight, profile]);

  const exerciseRanking = useMemo(() => {
    if (!ex) return null;
    const groupExs = EXERCISE_CATALOG.filter(e => e.group === ex.group && e.id !== ex.id).slice(0, 15);
    const scored = groupExs.map(e => {
      try {
        const p = calcExercisePrescription(e, goal, level, false, false, 1, week, totalWeeks);
        const rp = getResistanceProfile(e);
        const goalBonus = goal === 'hypertrophy' && rp.curve === 'stretch_mediated' ? 3 : goal === 'strength' && rp.curve === 'mid_range' ? 3 : 0;
        return { id: e.id, name: e.name, score: Math.min(100, Math.round(rp.score * 7 + goalBonus * 3 + (e.type === 'compound' ? 5 : 0))), type: e.type };
      } catch { return null; }
    }).filter((s): s is NonNullable<typeof s> => s !== null).sort((a, b) => b.score - a.score).slice(0, 8);
    const currentRp = resistanceProfile;
    const currentScore = currentRp ? Math.min(100, Math.round(currentRp.score * 7 + (ex.type === 'compound' ? 5 : 0))) : 50;
    const rank = scored.findIndex(s => s.score < currentScore);
    return { list: scored, currentScore, currentRank: rank === -1 ? scored.length + 1 : rank + 1, total: scored.length + 1 };
  }, [ex, goal, level, week, totalWeeks, resistanceProfile]);

  // PRO-анализ группы вынесён в Шаг 3 (ProSubstituteTab) — без дублей.

  const [savedCalcs, setSavedCalcs] = useState<Array<{ id: number; name: string; goal: string; level: string; week: number; oneRM: number; reps: string; sets: number; rir: number; rest: number; weight: number; date: string }>>(() => { try { return JSON.parse(localStorage.getItem('he_excalc_saved') || '[]'); } catch { return []; } });
  const [historyOpen, setHistoryOpen] = useState(false);
  const saveCalc = () => {
    if (!ex || !presc) return;
    const item = { id: Date.now(), name: ex.name, goal, level, week, oneRM, reps: presc.reps, sets: presc.sets, rir: presc.rir, rest: presc.rest, weight: workWeight, date: new Date().toISOString().slice(0, 10) };
    const arr: any[] = [item, ...(JSON.parse(localStorage.getItem('he_excalc_saved') || '[]'))];
    localStorage.setItem('he_excalc_saved', JSON.stringify(arr.slice(0, 30)));
    setSavedCalcs(arr.slice(0, 30));
  };

  const exportText = () => {
    if (!ex || !presc) return;
    const lines = [
      `=== Калькулятор: ${ex.name} ===`, `${GROUP_RU[ex.group]} · ${TYPE_RU[ex.type]} · ${level} · ${goal}`,
      `1ПМ: ${oneRM} кг · Вес: ${workWeight} кг (${pct}%) · ${presc.sets}×${presc.reps} · RIR ${presc.rir} · RPE ${rpeInfo?.rpe}/10 · Отдых ${presc.rest}с`,
      `Объём: ${(volumeLoad / 1000).toFixed(1)}k кг · Утомление: ${fatigueScore}/20 · AMRAP: ~${amrapEstimate}`,
    ];
    if (resistanceProfile) lines.push(`Профиль: ${resistanceProfile.label} (${resistanceProfile.score}/10) · ${resistanceProfile.bestGoal}`);
    if (fatigueAnalysis) lines.push(`ЦНС: ${fatigueAnalysis.cnsLoad}/10 · Мышцы: ${fatigueAnalysis.muscularLoad}/10 · Восст.: ${fatigueAnalysis.recoveryHours}ч`);
    if (metabolicCost) lines.push(`Метаболизм: ${metabolicCost.totalCal} ккал · Гликоген: ${metabolicCost.glycogen}г · EPOC: +${metabolicCost.epoc} ккал`);
    if (oneRMProjection) lines.push(`Прогноз 1ПМ: ${oneRMProjection.projected} кг (+${oneRMProjection.pctGain}%) через ${oneRMProjection.progressionWeeks} нед`);
    lines.push('--- Единый инструмент: ПРО+Замена в Шаге 3 ---');
    navigator.clipboard?.writeText(lines.join('\n')).catch(() => {});
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', color: '#fff' }}>
      {/* QUICK GENERATOR */}
      <div onClick={() => setShowGenerator(v => !v)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, fontWeight: 700, color: ACCENT }}>
        <span>{showGenerator ? '▲' : '▼'}</span> ⚡ Быстрый генератор упражнений
      </div>
      {showGenerator && (
        <div style={{ ...CARD, marginBottom: 12, border: '1px solid rgba(0,230,138,0.15)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
            <PopupSelect label="Группа мышц" value={genGroup} options={['chest', 'back', 'legs', 'shoulders', 'arms', 'core'].map(g => ({ id: g, label: GROUP_RU[g], desc: '' }))} hint="Группа" onChange={v => setGenGroup(v)} />
            <PopupSelect label="Цель" value={genGoal} options={[
              { id: 'bulk', label: 'Масса' }, { id: 'strength', label: 'Сила' }, { id: 'cut', label: 'Сушка' },
              { id: 'maintenance', label: 'Поддержание' }, { id: 'recomp', label: 'Рекомп' },
              { id: 'hypertrophy', label: 'Гипертрофия' }, { id: 'power', label: 'Взрывная' },
            ]} onChange={v => setGenGoal(v)} />
            <PopupSelect label="Уровень" value={genLevel} options={[
              { id: 'beginner', label: 'Новичок' }, { id: 'intermediate', label: 'Средний' }, { id: 'advanced', label: 'Опытный' }, { id: 'enhanced', label: 'На курсе' },
            ]} onChange={v => setGenLevel(v)} />
            <PopupSelect label="Кол-во" value={String(genCount)} options={[3, 5, 8, 10].map(n => ({ id: String(n), label: `${n}`, desc: '' }))} hint="Кол-во" onChange={v => setGenCount(parseInt(v))} />
          </div>
          {genResult && genResult.length > 0 ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderRadius: 4, marginBottom: 4, fontSize: 10, color: DIM, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ flex: 1 }}>Упражнение</span><span style={{ width: 30, textAlign: 'center' }}>Тип</span><span style={{ width: 45, textAlign: 'center' }}>Сеты</span><span style={{ width: 50, textAlign: 'center' }}>Повторы</span><span style={{ width: 28, textAlign: 'center' }}>RIR</span><span style={{ width: 45, textAlign: 'center' }}>Вес</span>
              </div>
              {genResult.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderRadius: 4, marginBottom: 2, background: 'rgba(255,255,255,0.02)', fontSize: 10, cursor: 'pointer' }}
                  onClick={() => { setGroup(r.group); setExId(EXERCISE_CATALOG.find(e => e.name === r.name)?.id || ''); setGoal(r.rir <= 2 ? 'strength' : r.rir <= 4 ? 'hypertrophy' : 'endurance'); }}>
                  <span style={{ flex: 1, fontWeight: 600 }}>{r.name}</span>
                  <span style={{ width: 30, textAlign: 'center', fontSize: 10, color: DIM }}>{r.type === 'compound' ? 'Базовое' : 'Изол.'}</span>
                  <span style={{ width: 45, textAlign: 'center', color: ACCENT, fontWeight: 700 }}>{r.sets}</span>
                  <span style={{ width: 50, textAlign: 'center', color: ACCENT, fontWeight: 600 }}>{r.reps}</span>
                  <span style={{ width: 28, textAlign: 'center', color: DIM }}>{r.rir}</span>
                  <span style={{ width: 45, textAlign: 'center', color: '#60a5fa' }}>{r.weight} кг</span>
                </div>
              ))}
            </div>
          ) : <div style={{ textAlign: 'center', padding: 10, color: DIM, fontSize: 10 }}>Нет упражнений для выбранной группы</div>}
        </div>
      )}

      {/* DETAILED CALCULATOR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 10 }}>
        <PopupSelect label="Группа мышц" value={group} options={GROUPS.map(g => ({ id: g, label: GROUP_RU[g], desc: '' }))} hint="Группа" onChange={v => { setGroup(v); setExId(''); }} />
        {group !== 'all' && REGION_MAP[group] && (
          <PopupSelect label="Регион" value={region} options={REGION_MAP[group].map(r => ({ id: r.id, label: r.label, desc: r.desc }))} hint="Регион" onChange={v => setRegion(v)} />
        )}
        <PopupSelect label="Упражнение" value={exId} options={exList.map(e => ({ id: e.id, label: e.name, desc: `${e.group} · ${TYPE_RU[e.type] || e.type}` }))} hint="Поиск" onChange={v => setExId(v)} />
        <PopupSelect label="Цель" value={goal} options={[
          { id: 'strength', label: 'Сила', desc: '3-5 повт' }, { id: 'hypertrophy', label: 'Гипертрофия', desc: '8-12 повт' },
          { id: 'endurance', label: 'Выносливость', desc: '15-20+ повт' }, { id: 'power', label: 'Взрывная', desc: '2-3 повт' },
        ]} onChange={v => setGoal(v)} />
        <PopupNumber label="Неделя" value={week} min={1} max={52} step={1} onChange={v => setWeek(v)} />
        <PopupNumber label="Всего недель" value={totalWeeks} min={1} max={52} step={1} onChange={v => setTotalWeeks(v)} />
        <PopupNumber label="1RM (кг)" value={oneRM} min={0} max={500} step={0.5} onChange={v => setOneRM(v)} />
        <PopupText label="Темп (опц.)" value={manualTempo} placeholder="3-1-1-0" hint="ECC-BOT-CON-TOP" onChange={(v: string) => setManualTempo(v)} />
        <PopupSelect label="Уровень" value={level} options={[
          { id: 'beginner', label: 'Новичок' }, { id: 'intermediate', label: 'Средний' }, { id: 'advanced', label: 'Продвинутый' },
        ]} onChange={v => setLevel(v as any)} />
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setWeakToggle(v => !v)} style={{ padding: '6px 12px', borderRadius: 6, border: weakToggle ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.15)', background: weakToggle ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.04)', color: weakToggle ? ACCENT : DIM, cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>
          🎯 Слабая группа {weakToggle ? '(вкл)' : '(выкл)'}
        </button>
        {isDeload && <span style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 11, fontWeight: 700 }}>⚠ ДЕЛОАД (фаза {phase})</span>}
      </div>

      {!ex ? (
        <div style={{ ...SMALL, textAlign: 'center', padding: 20 }}>Выберите упражнение выше или используйте быстрый генератор.</div>
      ) : (<>
        {/* Metric grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 6 }}>
          <MetricCard title="Вес" icon="🔸" accent={ACCENT}><div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{workWeight}</div><div style={{ ...SMALL }}>кг ({pct}% 1ПМ)</div></MetricCard>
          <MetricCard title="Повторения" icon="🔸" accent={ACCENT}><div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{presc?.reps ?? '-'}</div><div style={{ ...SMALL }}>диапазон</div></MetricCard>
          <MetricCard title="Подходы" icon="🔚" accent={ACCENT}><div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{presc?.sets ?? '-'}</div><div style={{ ...SMALL }}>рабочих</div></MetricCard>
          <MetricCard title="RIR" icon="🔸" accent={ACCENT}><div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{presc?.rir ?? '-'}</div><div style={{ ...SMALL }}>повт в запасе</div></MetricCard>
          <MetricCard title="RPE" icon="🔸" accent={ACCENT}><div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{rpeInfo?.rpe ?? '-'}/10</div><div style={{ ...SMALL }}>{rpeInfo?.label ?? '—'}</div></MetricCard>
          <MetricCard title="Отдых" icon="⏱" accent={ACCENT}><div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{presc?.rest ?? '-'}</div><div style={{ ...SMALL }}>сек</div></MetricCard>
          <MetricCard title="Объём" icon="📊" accent="#60a5fa"><div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>{(volumeLoad / 1000).toFixed(1)}k</div><div style={{ ...SMALL }}>кг (с×п×в)</div></MetricCard>
          <MetricCard title="Утомление" icon="⚡" accent="#f59e0b"><div style={{ fontSize: 18, fontWeight: 800, color: fatigueScore > 12 ? '#ef4444' : fatigueScore > 8 ? '#f59e0b' : '#22c55e' }}>{fatigueScore}</div><div style={{ ...SMALL }}>из 20</div></MetricCard>
        </div>

        {tutInfo && (
          <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(96,165,250,0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>⏱ TUT (Время под нагрузкой)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 6 }}>
              <div><span style={{ ...SMALL }}>Темп</span><div style={{ fontSize: 13, fontWeight: 700 }}>{manualTempo || presc?.tempo || '—'}</div></div>
              <div><span style={{ ...SMALL }}>Повторение</span><div style={{ fontSize: 13, fontWeight: 700 }}>{tutInfo.repDuration}с</div></div>
              <div><span style={{ ...SMALL }}>Подход</span><div style={{ fontSize: 13, fontWeight: 700 }}>{tutInfo.perSet}с</div></div>
              <div><span style={{ ...SMALL }}>Сессия</span><div style={{ fontSize: 13, fontWeight: 700 }}>{tutInfo.perSession}с</div></div>
            </div>
          </div>
        )}

        {amrapEstimate > 0 && (
          <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(168,85,247,0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 4 }}>🔄 AMRAP (макс. повторений)</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#a855f7' }}>~{amrapEstimate}</div>
            <div style={{ ...SMALL }}>повторений при {workWeight} кг · Рабочие: {presc?.reps ?? '—'}</div>
          </div>
        )}

        {oneRMProjection && oneRMProjection.progressionWeeks > 0 && (
          <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(34,197,94,0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>📈 Прогноз 1ПМ</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <div><div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{oneRMProjection.projected} кг</div><div style={{ ...SMALL }}>через {oneRMProjection.progressionWeeks} нед</div></div>
              <div style={{ ...SMALL }}>Текущий: {oneRMProjection.current} кг · +{oneRMProjection.weeklyRate} кг/нед · +{oneRMProjection.pctGain}%</div>
            </div>
          </div>
        )}

        {resistanceProfile && (
          <div style={{ ...CARD, marginTop: 10, border: `1px solid ${resistanceProfile.curve === 'stretch_mediated' ? 'rgba(34,197,94,0.3)' : 'rgba(96,165,250,0.3)'}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: resistanceProfile.curve === 'stretch_mediated' ? '#22c55e' : '#60a5fa', marginBottom: 4 }}>📐 Профиль сопротивления</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: resistanceProfile.curve === 'stretch_mediated' ? '#22c55e' : '#60a5fa' }}>{resistanceProfile.score}/10</div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 12 }}>{resistanceProfile.label}</div><div style={{ ...SMALL, fontSize: 10 }}>{resistanceProfile.desc}</div></div>
            </div>
          </div>
        )}

        {difficultyScaler && difficultyScaler.length > 0 && (
          <div style={{ marginTop: 12, padding: 12, background: 'rgba(168,85,247,0.04)', borderRadius: 8, border: '1px solid rgba(168,85,247,0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>📊 Шкала сложности</div>
            {difficultyScaler.map((d: any, i: number) => (
              <div key={i} style={{ padding: '8px 10px', borderRadius: 6, marginBottom: 4, background: d.diff === 'easier' ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${d.diff === 'easier' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`, borderLeft: `3px solid ${d.diff === 'easier' ? '#22c55e' : '#f59e0b'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 12 }}>{d.name}</span>
                  <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600, background: d.diff === 'easier' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', color: d.diff === 'easier' ? '#22c55e' : '#f59e0b' }}>{d.diff === 'easier' ? '⬇ Упрощение' : '⬆ Усложнение'}</span>
                </div>
                <div style={{ ...SMALL, fontSize: 10, marginTop: 2 }}>{d.how}</div>
              </div>
            ))}
          </div>
        )}

        {freqRecommendation && (
          <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(59,130,246,0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>📅 Рекомендация частоты</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>{freqRecommendation.label}</div>
            <div style={{ ...SMALL }}>Сплит: {freqRecommendation.globalFreq}</div>
          </div>
        )}

        {autoProgression && (
          <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(34,197,94,0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', marginBottom: 6 }}>📈 Прогрессия на 4 недели</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
              {autoProgression.map((w, i) => (
                <div key={i} style={{ textAlign: 'center', padding: 8, background: 'rgba(0,0,0,0.12)', borderRadius: 6, border: i === 0 ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 10, color: DIM }}>Нед {w.w}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, margin: '2px 0' }}>{w.sets}×{w.reps}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>{w.weight} кг</div>
                  <div style={{ fontSize: 10, color: DIM }}>RIR {w.rir} · {(w.pct)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {fatigueAnalysis && (
          <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(245,158,11,0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>⚡ Анализ утомления</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 6 }}>
              <div><span style={{ ...SMALL }}>ЦНС</span><div style={{ fontSize: 16, fontWeight: 700, color: fatigueAnalysis.cnsLoad >= 7 ? '#ef4444' : fatigueAnalysis.cnsLoad >= 4 ? '#f59e0b' : '#22c55e' }}>{fatigueAnalysis.cnsLoad}/10</div><div style={{ ...SMALL, fontSize: 10 }}>{fatigueAnalysis.cnsLabel}</div></div>
              <div><span style={{ ...SMALL }}>Мышцы</span><div style={{ fontSize: 16, fontWeight: 700, color: fatigueAnalysis.muscularLoad >= 7 ? '#ef4444' : fatigueAnalysis.muscularLoad >= 4 ? '#f59e0b' : '#22c55e' }}>{fatigueAnalysis.muscularLoad}/10</div><div style={{ ...SMALL, fontSize: 10 }}>{fatigueAnalysis.muscularLabel}</div></div>
              <div><span style={{ ...SMALL }}>Восст.</span><div style={{ fontSize: 16, fontWeight: 700, color: '#60a5fa' }}>{fatigueAnalysis.recoveryHours}ч</div><div style={{ ...SMALL, fontSize: 10 }}>до след. тяжёлой</div></div>
            </div>
            <div style={{ ...SMALL, fontSize: 10, marginTop: 4, lineHeight: 1.3 }}>{fatigueAnalysis.advice}</div>
          </div>
        )}

        {warmupRamp && (
          <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(251,146,60,0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fb923c', marginBottom: 4 }}>🔥 Разминочная рампа</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {warmupRamp.steps.map((s, i) => (
                <div key={i} style={{ flex: '1 0 60px', textAlign: 'center', padding: 6, background: 'rgba(0,0,0,0.15)', borderRadius: 6, border: `1px solid ${i === warmupRamp.steps.length - 1 ? 'rgba(251,146,60,0.3)' : 'rgba(255,255,255,0.04)'}` }}>
                  <div style={{ fontSize: 10, color: DIM }}>{s.label}</div><div style={{ fontSize: 13, fontWeight: 700 }}>{s.weight} кг</div><div style={{ fontSize: 10, color: DIM }}>{s.pct}% · {s.reps} повт</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {metabolicCost && (
          <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(251,146,60,0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fb923c', marginBottom: 4 }}>⚡ Метаболическая стоимость</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 6 }}>
              <div><span style={{ ...SMALL }}>Калорий</span><div style={{ fontSize: 14, fontWeight: 700, color: '#fb923c' }}>~{metabolicCost.totalCal}</div></div>
              <div><span style={{ ...SMALL }}>Гликоген</span><div style={{ fontSize: 14, fontWeight: 700 }}>~{metabolicCost.glycogen}г</div></div>
              <div><span style={{ ...SMALL }}>EPOC</span><div style={{ fontSize: 14, fontWeight: 700 }}>+{metabolicCost.epoc} ккал</div></div>
              <div><span style={{ ...SMALL }}>MET</span><div style={{ fontSize: 14, fontWeight: 700, color: DIM }}>{metabolicCost.met}</div></div>
              <div><span style={{ ...SMALL }}>Время</span><div style={{ fontSize: 14, fontWeight: 700, color: DIM }}>~{metabolicCost.totalTimeMin}м</div></div>
            </div>
          </div>
        )}

        {exerciseRanking && exerciseRanking.list.length > 0 && (
          <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(59,130,246,0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>🏅 Рейтинг в группе «{GROUP_RU[ex!.group]}» (цель: {goal === 'hypertrophy' ? 'гипертрофия' : goal})</div>
            <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>Позиция: <b style={{ color: ACCENT }}>#{exerciseRanking.currentRank}</b> из {exerciseRanking.total} · score: {exerciseRanking.currentScore}</div>
            {exerciseRanking.list.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', borderRadius: 4, marginBottom: 2, background: item.id === ex!.id ? 'rgba(0,230,138,0.08)' : 'transparent', fontSize: 10 }}>
                <span style={{ color: item.id === ex!.id ? ACCENT : DIM }}>#{i + 1} {item.name}</span>
                <span style={{ color: DIM }}>{item.type === 'compound' ? 'База' : 'Изол.'} · {item.score} pts</span>
              </div>
            ))}
          </div>
        )}

        {/* ВСТРОЕННЫЕ МИНИ-ИНСТРУМЕНТЫ (втянуты без дублей, раньше — отдельные вкладки/карточки) */}
        {ex && presc && workWeight > 0 && (
          <>
            {/* 1RM консенсус + плиты */}
            <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(0,230,138,0.12)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>🧮 1RM + Блины (втянуто)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10, color: DIM }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '6px 8px' }}>
                  <div style={{ fontWeight: 700, color: '#fff' }}>Консенсус 1RM</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>{(() => { try { const c = estimate1RMConsensus(oneRM, parseInt(presc.reps) || 5); return Math.round((c.mean || oneRM) * 10) / 10; } catch { return oneRM; } })()} кг</div>
                  <div style={{ fontSize: 10, color: DIM }}>среднее по 7 формулам (Epley/Brzycki…)</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '6px 8px' }}>
                  <div style={{ fontWeight: 700, color: '#fff' }}>Блины на сторону</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>{(() => { const pl = calculatePlates(workWeight, 20, 'kg'); return pl.platesPerSide.length ? pl.platesPerSide.map(p => `${p.plate}×${p.count}`).join(' + ') : 'гриф'; })()}</div>
                  <div style={{ fontSize: 10, color: DIM }}>гриф 20 кг · {workWeight} кг рабочий</div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>В полной версии — `PlateCalcTab` модалка с SVG и разминкой.</div>
            </div>

            {/* VBT */}
            <div style={{ ...CARD, marginTop: 8, border: '1px solid rgba(96,165,250,0.14)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>⚡ VBT (скорость штанги)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
                <div style={{ background: 'rgba(59,130,246,0.06)', borderRadius: 6, padding: '6px 8px' }}>
                  <div style={{ color: DIM }}>Скорость для {pct}% 1RM</div><div style={{ fontWeight: 800, color: '#60a5fa', fontSize: 13 }}>{(() => { try { return velocityForPct(ex.id as any, pct / 100) ?? '—'; } catch { return '—'; } })()} м/с</div>
                </div>
                <div style={{ background: 'rgba(59,130,246,0.06)', borderRadius: 6, padding: '6px 8px' }}>
                  <div style={{ color: DIM }}>e1RM по скорости</div><div style={{ fontWeight: 800, color: '#60a5fa', fontSize: 12 }}>{(() => { try { const v = velocityForPct(ex.id as any, pct / 100) as any; const e = typeof v === 'number' ? estimate1RMFromVelocity(ex.id as any, v, workWeight) : null; return e ? `${Math.round(e as any)} кг` : '—'; } catch { return '—'; } })()}</div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>Оценивает %1RM по скорости и наоборот. Полная VBT — в `VBTCalcTab`.</div>
            </div>

            {/* Тоннаж */}
            <div style={{ ...CARD, marginTop: 8, border: '1px solid rgba(245,158,11,0.14)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>📦 Тоннаж/КПШ мини</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 10, textAlign: 'center' as const }}>
                <div style={{ background: 'rgba(245,158,11,0.06)', borderRadius: 6, padding: '6px 4px' }}><div style={{ color: DIM }}>Тоннаж</div><div style={{ fontWeight: 800, fontSize: 13, color: '#f59e0b' }}>{volumeLoad.toLocaleString()} кг</div></div>
                <div style={{ background: 'rgba(245,158,11,0.06)', borderRadius: 6, padding: '6px 4px' }}><div style={{ color: DIM }}>КПШ</div><div style={{ fontWeight: 800, fontSize: 13 }}>{presc.sets * (parseInt(presc.reps) || 5)}</div></div>
                <div style={{ background: 'rgba(245,158,11,0.06)', borderRadius: 6, padding: '6px 4px' }}><div style={{ color: DIM }}>УОИ</div><div style={{ fontWeight: 800, fontSize: 13 }}>{pct}%</div></div>
              </div>
            </div>

            {/* ББ темп/техники */}
            <div style={{ ...CARD, marginTop: 8, border: '1px solid rgba(168,85,247,0.14)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 4 }}>💪 ББ темп/техники (втянуто)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
                <div style={{ background: 'rgba(168,85,247,0.06)', borderRadius: 6, padding: '6px 8px' }}>
                  <div style={{ color: DIM }}>Темп/отдых</div><div style={{ fontWeight: 700 }}>{(() => { const t = tempoFor(ex.type === 'compound' ? 'тяж' as any : 'памп' as any); return `${t.notation} · ${tutForSet(parseInt(presc.reps) || 8, ex.type === 'compound' ? 'тяж' as any : 'памп' as any)}с TUT`; })()}</div>
                </div>
                <div style={{ background: 'rgba(168,85,247,0.06)', borderRadius: 6, padding: '6px 8px' }}>
                  <div style={{ color: DIM }}>Техники</div><div style={{ fontWeight: 700, fontSize: 10 }}>{techniquesFor(ex.type === 'compound' ? 'тяж' as any : 'памп' as any, level).slice(0, 2).map(t => t.name).join(', ') || '—'}</div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>Детально — Шаг 1 остаётся без дублей; полный разбор — в `BbToolsCard`.</div>
            </div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 6, textAlign: 'center' }}>ℹ️ PRO-анализ группы теперь в Шаге 3 «ПРО+Замена» — без дублирования.</div>
          </>
        )}

        {ex && presc && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button onClick={saveCalc} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>💾 Сохранить расчёт</button>
            <button onClick={exportText} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.06)', color: '#60a5fa', cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>📋 Копировать отчёт</button>
            <button onClick={() => setHistoryOpen(v => !v)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.06)', color: '#a855f7', cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>📂 История ({savedCalcs.length})</button>
          </div>
        )}

        {historyOpen && savedCalcs.length > 0 && (
          <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(168,85,247,0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>📂 Сохранённые расчёты (последние {savedCalcs.length})</div>
            {savedCalcs.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px', borderRadius: 4, marginBottom: 2, background: 'rgba(255,255,255,0.02)', fontSize: 10, cursor: 'pointer' }}
                onClick={() => { const found = EXERCISE_CATALOG.find(e => e.name === s.name); if (found) { setGroup(found.group); setExId(found.id); setGoal(s.goal); setWeek(s.week); setOneRM(s.oneRM); } }}>
                <span style={{ fontWeight: 600 }}>{s.name}</span>
                <span style={{ color: DIM }}>{s.date} · {s.sets}×{s.reps} · RIR {s.rir} · {s.weight} кг</span>
                <button onClick={e => { e.stopPropagation(); try { const arr = (JSON.parse(localStorage.getItem('he_excalc_saved') || '[]') as any[]).filter((x: any) => x.id !== s.id); localStorage.setItem('he_excalc_saved', JSON.stringify(arr)); setSavedCalcs(arr); } catch {} }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </>)}
    </div>
  );
};

export default PrescriptionTab;

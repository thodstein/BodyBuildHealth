/**
 * useCombatWizard.ts — хук состояния визарда единоборств (вынесен из CombatConstructor для декомпозиции).
 * Инкапсулирует: дисциплина/цель/уровень/недели/дни, весогонка, методика, DUP, периодизация, вне зала/спарринг, стиль, оборудование, травмы, мобильность, workMax, VBT, ACWR/HRV, pattern, history.
 * CombatConstructor остаётся тонким оркестратором шагов.
 */
import { useState, useMemo, useEffect } from 'react';
import type { CombatInput, CombatPlan } from '../../../engines/combat/combat.types';
import type { OutsideLoad } from '../../../engines/outside-load.engine';
import { defaultOutsideLoadFor, computeOutsideMetrics } from '../../../engines/outside-load.engine';
import { combatACWR, combatHrvReport } from '../../../engines/combat/combat-monitoring.engine';
import { loadAnnualCB } from '../../../engines/combat/combat-annual';
import type { AnnualCB } from '../../../engines/combat/combat-annual';

export type WizardStep = 'params' | 'outside' | 'split' | 'plan';

export function useCombatWizard() {
  const [step, setStep] = useState<WizardStep>('params');
  const [discipline, setDiscipline] = useState<CombatInput['discipline']>('mma');
  const [goal, setGoal] = useState<CombatInput['goal']>('power');
  const [level, setLevel] = useState<CombatInput['level']>('intermediate');
  const [weeks, setWeeks] = useState(6);
  const [days, setDays] = useState(3);
  const [weightCut, setWeightCut] = useState(0);
  const [waterMode, setWaterMode] = useState<'stable'|'load_cut'>('stable');
  const [sodiumMode, setSodiumMode] = useState<'stable'|'moderate_cut'>('stable');
  const [carbMode, setCarbMode] = useState<'stable'|'deplete_reload'>('stable');
  const [heatSessions, setHeatSessions] = useState(false);
  const [methodology, setMethodology] = useState<CombatInput['methodology']>('compound_first');
  const [dupMode, setDupMode] = useState<CombatInput['dupMode']>('off');
  const [intensityTech, setIntensityTech] = useState<CombatInput['intensityTech']>('none');
  const [periodizationModel, setPeriodizationModel] = useState<CombatInput['periodizationModel']>('atr_10');
  const [conditioningMode, setConditioningMode] = useState<CombatInput['conditioningMode']>('auto');
  const [outside, setOutside] = useState<OutsideLoad | null>(defaultOutsideLoadFor('mma'));
  const [outsideEnabled, setOutsideEnabled] = useState(true);
  const [sparringHard, setSparringHard] = useState(1);
  const [sparringTech, setSparringTech] = useState(2);
  const [sparringWrest, setSparringWrest] = useState(1);
  const [sparringEnabled, setSparringEnabled] = useState(false);
  const [fightStyle, setFightStyle] = useState<'striker'|'grappler'|'hybrid'>('hybrid');
  const [avoidAxialLoad, setAvoidAxialLoad] = useState(false);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [mobility, setMobility] = useState<string[]>([]);
  const [injuries, setInjuries] = useState<any[]>([]);
  const [injInput, setInjInput] = useState('');
  const [injExclude, setInjExclude] = useState(false);
  const [bodyweight, setBodyweight] = useState(80);
  const [sex, setSex] = useState<'male'|'female'>('male');
  const [age, setAge] = useState(28);
  const [fightDate, setFightDate] = useState('');
  const [taperWeeks, setTaperWeeks] = useState(2);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0,10));
  const [acwr, setAcwr] = useState<{ ratio:number; zone:string }|null>(null);
  const [velocityLoss, setVelocityLoss] = useState(0);
  const [vbtBest, setVbtBest] = useState(0);
  const [vbtLast, setVbtLast] = useState(0);
  const [hrvLine, setHrvLine] = useState<string|null>(null);
  const [patternId, setPatternId] = useState('');
  const [workMax, setWorkMax] = useState<Record<string,number>>({ bench:80, squat:90, deadlift:100, chest:80, back:70, quads:90, hamstrings:80, shoulders:50 });
  const [workMaxByExercise, setWorkMaxByExercise] = useState<Record<string,number>>({});
  const [showExactWM, setShowExactWM] = useState(false);
  const [plan, setPlan] = useState<CombatPlan|null>(null);
  const [history, setHistory] = useState<CombatPlan[]>([]);
  const [annual, setAnnual] = useState<AnnualCB | null>(() => loadAnnualCB());
  const [diaryLoad, setDiaryLoad] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [annualWeeks, setAnnualWeeks] = useState(52);
  const [competitionName, setCompetitionName] = useState('');
  const [competitionDate, setCompetitionDate] = useState('');
  const [competitionWeight, setCompetitionWeight] = useState('');

  const outsideMetrics = useMemo(() => computeOutsideMetrics(outsideEnabled ? outside : null), [outside, outsideEnabled]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('he_srpe_sessions') || localStorage.getItem('he_training_log') || '[]';
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) {
        const week = arr.slice(-7).reduce((a:any, s:any)=> a + (s.load || s.sRPE || s.rpe || 0), 0);
        setDiaryLoad(week);
        try{
          const daily: Record<string, number> = {};
          for(const s of arr){ const d=(s.date||'').slice(0,10); if(d) daily[d]=(daily[d]||0)+(s.load||s.sRPE||s.rpe||0); }
          const vals = Object.values(daily).slice(-28);
          if(vals.length>=14){
            const acute = vals.slice(-7).reduce((a,c)=>a+c,0)/7;
            const chronic = vals.reduce((a,c)=>a+c,0)/vals.length;
            const r = combatACWR(acute*7, chronic*7);
            setAcwr({ ratio: r.ratio, zone: r.zone });
          }
        }catch{}
      }
      try{
        const h = combatHrvReport();
        if(h) setHrvLine(`HRV ${h.last}мс (ср ${h.mean}±${h.sd}) — ${h.grade}: ${h.note}`);
        else setHrvLine(null);
      }catch{ setHrvLine(null); }
    } catch {}
  }, [plan]);

  return {
    // step
    step, setStep,
    discipline, setDiscipline, goal, setGoal, level, setLevel, weeks, setWeeks, days, setDays,
    weightCut, setWeightCut, waterMode, setWaterMode, sodiumMode, setSodiumMode, carbMode, setCarbMode, heatSessions, setHeatSessions,
    methodology, setMethodology, dupMode, setDupMode, intensityTech, setIntensityTech,
    periodizationModel, setPeriodizationModel, conditioningMode, setConditioningMode,
    outside, setOutside, outsideEnabled, setOutsideEnabled, sparringHard, setSparringHard, sparringTech, setSparringTech, sparringWrest, setSparringWrest, sparringEnabled, setSparringEnabled,
    fightStyle, setFightStyle, avoidAxialLoad, setAvoidAxialLoad,
    equipment, setEquipment, mobility, setMobility, injuries, setInjuries, injInput, setInjInput, injExclude, setInjExclude,
    bodyweight, setBodyweight, sex, setSex, age, setAge,
    fightDate, setFightDate, taperWeeks, setTaperWeeks, startDate, setStartDate,
    acwr, setAcwr, velocityLoss, setVelocityLoss, vbtBest, setVbtBest, vbtLast, setVbtLast, hrvLine, setHrvLine,
    patternId, setPatternId,
    workMax, setWorkMax, workMaxByExercise, setWorkMaxByExercise, showExactWM, setShowExactWM,
    plan, setPlan, history, setHistory, annual, setAnnual, diaryLoad, setDiaryLoad, msg, setMsg,
    annualWeeks, setAnnualWeeks, competitionName, setCompetitionName, competitionDate, setCompetitionDate, competitionWeight, setCompetitionWeight,
    outsideMetrics,
  };
}

/**
 * StrengthSportConstructor.tsx — премиальный конструктор Стронгмен / ТА.
 * Стекло + градиенты, современный мобильный стиль. Полностью изолирован.
 */
import React from 'react';
import { useStrengthSportWizard } from './useStrengthSportWizard';
import { StrengthSportPlanView } from './StrengthSportPlanView';
import { buildStrengthSportPlan } from '../../../engines/strength-sport/strength-sport-builder.engine';
import { finalizeStrengthSportPlan, buildStrengthSportReport } from '../../../engines/strength-sport/strength-sport-finalize.engine';
import { STRENGTH_SPORT_PATTERNS, recommendStrengthSportPattern } from '../../../engines/strength-sport/strength-sport-split-patterns';
import { buildStrengthCsv, downloadStrengthCsv, downloadStrengthXlsx, buildStrengthPrintHtml, shareStrengthDigest, buildStrengthTelegramUrl, buildStrengthShareHash, downloadStrengthIcs } from '../../../engines/strength-sport/strength-sport-export';
import { defaultOutsideLoadFor } from '../../../engines/outside-load.engine';
import { WL_WEAKPOINT_LABELS } from '../../../engines/strength-sport/strength-sport-weakpoint';
import { CONTEST_PRESETS, type StrongmanContest } from '../../../engines/strength-sport/strength-sport-contest.types';
import { EVENT_META } from '../../../engines/strength-sport/strength-sport-event-types';
import { syncStrengthAnnualToGeneral } from '../../../engines/strength-sport/strength-sport-annual-bridge';
import { estimate1RMFromVelocitySS, velocityTypeForLift } from '../../../engines/strength-sport/strength-sport-vbt.engine';
import { calibrateLVP, saveLVPProfile, loadLVPProfiles, velocityForLVP } from '../../../engines/strength-sport/strength-sport-lvp-calibration.engine';
import { intensityZoneFor } from '../../../engines/strength-sport/strength-sport-progression';
import { injectTAWeakPoints } from '../../../engines/strength-sport/strength-sport-ta-injection.engine';
import { injectSMWeakPoints } from '../../../engines/strength-sport/strength-sport-sm-injection.engine';
import { saveStrengthSportPlan, loadStrengthSportPlans } from '../../../engines/strength-sport/strength-sport-storage';
import { applyMesocycleProgression } from '../../../engines/strength-sport/strength-sport-mesocycle';
import { buildAnnualFromSS, buildAnnualWithTaper, buildAnnualMultiPeak, saveAnnualSS } from '../../../engines/strength-sport/strength-sport-annual';
import { saveUserProgram } from '../../../engines/user-program/program-store';
import { SS_CYCLES, getSSCycleById } from '../../../data/ss-cycles/ss-cycle-index';
import { recommendSSCycle } from '../../../engines/strength-sport/strength-sport-ss-selector.engine';
import { buildSSCyclePlan } from '../../../engines/strength-sport/strength-sport-ss-cycle-to-plan.engine';
import { buildAnnualFromSSCycles } from '../../../engines/strength-sport/strength-sport-ss-annual.engine';
import type { StrengthSportInput, StrengthSportPlan } from '../../../engines/strength-sport/strength-sport.types';
import { getWL, getStrong } from '../../../engines/strength-sport/strength-sport-volume';
import { isNativeApp } from '../../../core/app-platform';
import { collectSsVelocityHistory } from './sm-bridge-intake';
import { CARD_STRONG, CARD_HERO, ROW, BTN, BTN_PRIMARY, BTN_SMALL, BTN_STRONG, INPUT, SELECT, TEXT_2, ACCENT, ACCENT_STRONG, ACCENT_GRAD, STRONG_GRAD, SectionCard, Badge, InfoBanner, GroupHeading, ProgressBar, ChipToggle, Field, Divider, Highlight, StrengthPopupSelect, StrengthPopupNumber, EventCard, LEVEL_RU, ZONE_RU, EQUIP_RU, MOBILITY_RU, MODE_RU, GOAL_RU, ruLabel } from './StrengthUI';
import { BTN as T_BTN, BTN_GHOST as T_BTN_GHOST, STEP_PILL } from '../TrainingScreen_parts/training-ui';

type Step = 'params' | 'athlete' | 'outside' | 'split' | 'plan' | 'quality' | 'export';
const STEP_LABEL_RU: Record<Step,string> = { params:'1 ⚙️ Параметры', athlete:'2 👤 Атлет', outside:'3 🏃 Вне зала', split:'4 🧩 Сплит', plan:'5 📋 План', quality:'6 ✅ Качество', export:'7 📤 Экспорт' };
const STEP_GROUPS: Record<string, Step[]> = {
  'ПАРАМЕТРЫ': ['params', 'athlete', 'outside', 'split'],
  'ПЛАН': ['plan', 'quality'],
  'ВЫДАЧА': ['export'],
};

/* Лёгкий haptic на навигации (guard — тишина вне устройства) */
function buzzStep(): void {
  try { (navigator as any)?.vibrate?.(8); } catch { /* no-op */ }
}
const WM_LABEL_RU: Record<string,string> = { backSquat:'Присед', frontSquat:'Фронт. присед', deadlift:'Тяга', snatch:'Рывок', cleanJerk:'Толчок', overheadPress:'Жим стоя', yokeWalk:'Йок', farmersWalk:'Фермер', frameCarry:'Рама', husafellCarry:'Хусафелл', sandbagLoad:'Мешок загр.', kegToss:'Бочка', carDeadlift:'Автотяга', axlePress:'Аксель-жим', atlasStone:'Камень', axleDeadlift:'Аксель', logPress:'Лог' };

export const StrengthSportConstructor: React.FC = () => {
  const {
    step, setStep, mode, setMode, goal, setGoal, level, setLevel, weeks, setWeeks, days, setDays,
    focus, setFocus, methodology, setMethodology, dupMode, setDupMode, intensityTech, setIntensityTech,
    workMax, setWorkMax, equipment, setEquipment, mobility, setMobility,
    injuries, setInjuries, injInput, setInjInput,
    outside, setOutside, outsideEnabled, setOutsideEnabled,
    sex, setSex, bodyweight, setBodyweight, age, setAge,
    competitionDate, setCompetitionDate, patternId, setPatternId,
    cycleId, setCycleId, cycleMode, setCycleMode, cycleConsent, setCycleConsent,
    annualCycleSel, setAnnualCycleSel,
    acwr, setAcwr, hrv, setHrv, velocityLoss, setVelocityLoss,
    vbtPerLift, setVbtPerLift, lvpLift, setLvpLift, lvpPoints, setLvpPoints, lvpResult, setLvpResult,
    taperWeeks, setTaperWeeks, contest, setContest, contestStrategy, setContestStrategy,
    medleyPreview, setMedleyPreview, weakPoints, setWeakPoints, diagnosticLevel, setDiagnosticLevel,
    hubVelocity, setHubVelocity, swayCmBridge, setSwayCmBridge,
    vbtMap, setVbtMap, plan, setPlan, annual, setAnnual,
    diaryLoad, setDiaryLoad, expandedWeek, setExpandedWeek, msg, setMsg,
    building, setBuilding, buildStage, setBuildStage, tick,
    outsideMetrics, contestSim, rankedCycles,
  } = useStrengthSportWizard();
  // Весь стейт/эффекты/мемоизация — в useStrengthSportWizard; здесь только хендлеры и рендер шагов.
  const pullFromProfile = () => {
    try {
      const raw = localStorage.getItem('he_profile_v2');
      if (!raw) return;
      const p = JSON.parse(raw);
      const personal = p.personal || {};
      const training = p.training || p;
      const health = p.health || {};
      if (training.workMax) setWorkMax(s => ({ ...s, ...training.workMax }));
      if (personal.workMax) setWorkMax(s => ({ ...s, ...personal.workMax }));
      if (training.level) setLevel(training.level);
      else if (personal.level) setLevel(personal.level);
      if (personal.sex) setSex(personal.sex === 'female' ? 'female' : 'male');
      if (typeof personal.weight === 'number') setBodyweight(personal.weight);
      else if (typeof personal.bodyweight === 'number') setBodyweight(personal.bodyweight);
      if (typeof personal.age === 'number') setAge(personal.age);
      if (Array.isArray(health.injuries)) setInjuries(health.injuries);
      else if (Array.isArray(training.injuries)) setInjuries(training.injuries);
      if (Array.isArray(training.equipment)) setEquipment(training.equipment);
      else if (Array.isArray(personal.equipment)) setEquipment(personal.equipment);
      if (Array.isArray(health.mobilityRestrictions)) setMobility(health.mobilityRestrictions);
      else if (Array.isArray(training.mobilityRestrictions)) setMobility(training.mobilityRestrictions);
      const sport = (training.sportType || p.goals?.primaryGoal || '').toLowerCase();
      if (sport.includes('weightlifting') || sport.includes('та')) setOutside(defaultOutsideLoadFor('weightlifting'));
      else if (sport.includes('strongman') || sport.includes('стронг')) setOutside(defaultOutsideLoadFor('strongman'));
      setMsg('✦ Профиль подтянут'); setTimeout(()=>setMsg(''), 2200);
    } catch {}
  };

  const build = async () => {
    if (building) return;
    setBuilding(true);
    setMsg('⏳ Собираем план…');
    try {
      // Даём UI отрисовать busy-строку до тяжёлого синхронного расчёта.
      await new Promise<void>(r => setTimeout(r, 30));
    let extra: any = {};
    try{
      const raw = localStorage.getItem('he_profile_v2');
      if(raw){
        const p = JSON.parse(raw);
        const personal = p.personal || {};
        const lifestyle = p.lifestyle || {};
        extra.bodyFat = typeof personal.bodyFat === 'number' ? personal.bodyFat : undefined;
        extra.leanMass = typeof personal.bodyFat === 'number' && typeof personal.weight === 'number' ? Math.round(personal.weight * (1 - personal.bodyFat/100)) : undefined;
        extra.hrvMs = typeof lifestyle.morningHRV === 'number' ? lifestyle.morningHRV : typeof lifestyle.hrvMs === 'number' ? lifestyle.hrvMs : undefined;
        extra.sleepHours = typeof lifestyle.sleepHours === 'number' ? lifestyle.sleepHours : undefined;
        extra.stressLevel = typeof lifestyle.stressLevel === 'number' ? lifestyle.stressLevel : undefined;
        extra.calorieSurplus = typeof p.nutrition?.calorieSurplus === 'number' ? p.nutrition.calorieSurplus : undefined;
        extra.proteinPerKg = typeof p.nutrition?.proteinPerKg === 'number' ? p.nutrition.proteinPerKg : undefined;
        const ph = p.pharma || {};
        if(Array.isArray(ph.currentSubstances) && ph.currentSubstances.length) extra.peds = ph.currentSubstances;
      }
    }catch{}
    let diaryTrend: any[] | null = null;
    try{
      const rawLog = localStorage.getItem('he_workout_log') || localStorage.getItem('he_training_log') || localStorage.getItem('he_workout_history') || '[]';
      const logs = JSON.parse(rawLog);
      if(Array.isArray(logs) && logs.length){
        const epley = (w:number,r:number)=> w*(1+r/30);
        const now = Date.now(); const dayMs=24*3600*1000;
        const lifts = [
          { key:'snatch', names:['snatch','рывок'] },
          { key:'clean', names:['clean','толчок','clean_and_jerk'] },
          { key:'squat', names:['squat','присед','back_squat','front_squat'] },
          { key:'deadlift', names:['deadlift','тяга'] },
        ];
        diaryTrend=[];
        for(const lf of lifts){
          const recent = logs.filter((e:any)=>{
            const n=(e.exerciseName||e.name||'').toLowerCase();
            return lf.names.some(k=> n.includes(k)) && Array.isArray(e.sets) && (()=>{ const d=e.date||''; const t=new Date(d).getTime(); return now-t<=28*dayMs && now-t>=0; })();
          }).map((e:any)=> Math.max(...(e.sets as any[]).map((s:any)=> epley(s.weight||0,s.reps||0)))).filter((v:number)=> v>0);
          const prev = logs.filter((e:any)=>{
            const n=(e.exerciseName||e.name||'').toLowerCase();
            const d=e.date||''; const t=new Date(d).getTime();
            return lf.names.some(k=> n.includes(k)) && Array.isArray(e.sets) && now-t>28*dayMs && now-t<=56*dayMs;
          }).map((e:any)=> Math.max(...(e.sets as any[]).map((s:any)=> epley(s.weight||0,s.reps||0)))).filter((v:number)=> v>0);
          if(recent.length && prev.length){
            const maxR=Math.max(...recent), maxP=Math.max(...prev);
            diaryTrend.push({ lift: lf.key, changePct: Math.round(((maxR-maxP)/maxP*100)*10)/10 });
          }
        }
        if(diaryTrend.length===0) diaryTrend=null;
      }
    }catch{}
    // VBT-история одним проходом (vbtMap → per-lift → хаб), см. collectSsVelocityHistory.
    // vbtMap НЕ очищаем: ключи week-day-ex-set стабильны между пересборками,
    // замеры — это история последних сессий, она должна переживать rebuild.
    const velocityHistory = collectSsVelocityHistory(vbtMap, vbtPerLift as any, hubVelocity);
    setBuildStage('Строим недели и сеты…'); await tick();
    let input: StrengthSportInput = {
      mode, goal, level, weeks, daysPerWeek: days, workMax, focus, methodology, dupMode, intensityTech,
      outsideLoad: outsideEnabled ? outside : null,
      equipment, injuries, mobilityRestrictions: mobility as any,
      sex, bodyweight, age,
      competitionDate: competitionDate || undefined,
      startDate: new Date().toISOString().slice(0,10),
      acwr: acwr as any,
      velocityLossPct: velocityLoss > 0 ? velocityLoss : undefined,
      velocityHistory: velocityHistory || undefined,
      patternId: patternId || undefined,
      diaryTrend: diaryTrend || undefined,
      taperWeeks: goal==='peaking' ? taperWeeks : undefined,
      weakPoints: weakPoints.length ? weakPoints : undefined,
      contest: mode==='strongman' ? contest : undefined,
      // Стратегия попыток действует и на ТА-раскладку (раньше WL всегда считал 'balanced')
      contestStrategy: contestStrategy || undefined,
      diagnosticLevel: (diagnosticLevel as any) || undefined,
      cycleId: cycleId || undefined,
      cycleMode: cycleId ? cycleMode : undefined,
      cycleConsent: cycleId ? cycleConsent : undefined,
      ...extra,
    } as any;
    try {
      const prev = loadStrengthSportPlans()[0];
      // Идемпотентность пересборки: повторный клик с теми же параметрами
      // НЕ должен снова накручивать ПМ (+2% за клик, кумулятивно). Хэш входа
      // до прогрессии стабилен между одинаковыми сборками; смена любого
      // параметра — новый мезоцикл, прогрессия применяется один раз.
      const progHash = JSON.stringify({ mode, goal, level, weeks, days, workMax, focus, methodology, dupMode, intensityTech, equipment, injuries, mobility, sex, bodyweight, age, competitionDate, patternId, cycleId, cycleMode, weakPoints, contestStrategy });
      const lastHash = (() => { try { return localStorage.getItem('he_ss_prog_hash_v1'); } catch { return null; } })();
      if (prev && lastHash !== progHash) {
        input = applyMesocycleProgression(prev, input) as any;
      } else if (prev) {
        (input as any).previousPlanId = prev.id;
      }
      // Хэш пишем при КАЖДОЙ сборке (а не только с прогрессией): иначе первая
      // сборка без prev ничего не запоминала и вторая идентичная снова прогрессировала.
      try { localStorage.setItem('he_ss_prog_hash_v1', progHash); } catch {}
    } catch {}
    // Интернет-цикл (ss-cycles): дословный faithful по умолчанию, иначе параметрический билдер
    let p: StrengthSportPlan;
    {
      const tpl = cycleId ? getSSCycleById(cycleId) : undefined;
      if (tpl) {
        // Цикл задаёт свои недели/дни — синхронизируем слайдеры под шаблон
        if (weeks !== tpl.meta.weeks) setWeeks(tpl.meta.weeks);
        const needDays = Math.min(tpl.meta.sessionsPerWeekMax ?? tpl.meta.sessionsPerWeek, 6);
        if (days !== tpl.meta.sessionsPerWeek && days !== needDays) setDays(tpl.meta.sessionsPerWeek);
        p = buildSSCyclePlan(tpl, { ...input, weeks: tpl.meta.weeks, daysPerWeek: tpl.meta.sessionsPerWeek } as any, { cycleMode, bodyweight, sex });
      } else {
        p = buildStrengthSportPlan(input);
      }
    }
    setBuildStage('Финализируем объёмы…'); await tick();
    p = finalizeStrengthSportPlan(p, { outsideLoad: outsideEnabled ? outside : null });
    // Диагностика: инъекция коррекций с MRV-бюджетом (TA vs SM)
    setBuildStage('Внедряем диагностику…'); await tick();
    if (weakPoints.length) {
      const isSM = weakPoints.some((wp: string) => /^(log_|yoke_|farmers_|stone_|grip_|core_|conditioning)/.test(String(wp)));
      if (isSM || mode === 'strongman') {
        const inj = injectSMWeakPoints(p, weakPoints as any, { workMax: p.workMax } as any);
        if (inj.injected > 0) p.rationale = inj.plan.rationale;
        p = inj.plan;
        if (inj.notes.length) { try { console.info('[SM injection]', inj.notes.join(' | ')); } catch {} }
        // fallback TA if SM injected 0 and weakPoints look like WL
        if (inj.injected === 0 && weakPoints.some((w: string) => /snatch|clean|jerk|squat|pull|press/.test(String(w).toLowerCase()))) {
          const inj2 = injectTAWeakPoints(p, weakPoints as any, { workMax: p.workMax } as any);
          if (inj2.injected > 0) p.rationale = inj2.plan.rationale;
          p = inj2.plan;
        }
      } else {
        const inj = injectTAWeakPoints(p, weakPoints as any, { workMax: p.workMax } as any);
        if (inj.injected > 0) p.rationale = inj.plan.rationale;
        p = inj.plan;
        if (inj.notes.length) { try { console.info('[TA injection]', inj.notes.join(' | ')); } catch {} }
      }
    }
    if (diagnosticLevel === 'critical') {
      p.weeksData.forEach(w => { if (!w.deload) w.sessions.forEach(s => s.exercises.forEach(e => { const orig = e.workSets.length; const keep = Math.max(2, Math.round(orig * 0.85)); if (keep < orig) { e.workSets = e.workSets.slice(0, keep); e.sets = keep; e.workSets.forEach(ws => ws.rir = Math.min(4, (ws.rir ?? 2) + 1)); } })); });
      p.rationale.push('CRITICAL gate: объём ×0.85 RIR+1 (score≤49)');
    }
    // Sway carry из хаба: у билдера нет sway-входа — честно фиксируем в rationale,
    // чтобы замер не терялся молча (Kinovea SRD 3/5см).
    if (swayCmBridge != null && swayCmBridge > 0) {
      p.rationale.push(`Sway ${swayCmBridge}см из диагностики (Kinovea): коридор ±3см, при >5см — стоп carries и проверка техники`);
    }
    setPlan(p);
    saveStrengthSportPlan(p);
    try {
      const bw = (input as any).bodyweight || 80;
      const nut = { proteinG: Math.round(bw * ((input as any).weightCutKg ? 2.3 : 2.0)), carbsG: Math.round(bw * ((input as any).weightCutKg ? 3 : 5)), note: `TA/стронг ${input.mode} ${input.weeks}нед`, bodyweight: bw, mode: input.mode };
      localStorage.setItem('he_strength_nutrition_payload', JSON.stringify({ planId: p.id, ...nut }));
      window.dispatchEvent(new CustomEvent('he-strength-updated', { detail: { planId: p.id, nutrition: nut } }));
      const wc = (p as any).weightCutProtocol;
      if (wc) localStorage.setItem('he_strength_weightcut_payload', JSON.stringify(wc));
    } catch {}
    try {
      setBuildStage('Собираем год…'); await tick();
      const hist = loadStrengthSportPlans().slice(0, 6);
      const ann = competitionDate ? buildAnnualWithTaper(hist, { competitionDate, taperWeeks: 1 }) : buildAnnualFromSS(hist);
      saveAnnualSS(ann);
      setAnnual(ann);
      try { syncStrengthAnnualToGeneral(ann); } catch {}
      try {
        localStorage.setItem('he_strength_annual_sync_v1', JSON.stringify({ updatedAt: new Date().toISOString(), totalWeeks: ann.totalWeeks, blocks: ann.blocks.map(b=> ({ startWeek: b.startWeek, weeks: b.weeks, mode: b.mode })) }));
        window.dispatchEvent(new CustomEvent('he-strength-annual-updated', { detail: ann }));
      } catch {}
    } catch {}
    setMsg('✦ План собран'); setTimeout(()=>setMsg(''), 2200);
    setStep('plan');
    } finally {
      setBuilding(false);
    }
  };

  const updateEx = (wkIdx: number, day: number, exId: string, patch: Partial<{ weight: number; reps: string; rir: number }>) => {
    setPlan(prev => {
      if (!prev) return prev;
      const copy: StrengthSportPlan = JSON.parse(JSON.stringify(prev));
      const wk = copy.weeksData[wkIdx];
      if (!wk) return prev;
      const sess = wk.sessions.find(s => s.day === day);
      if (!sess) return prev;
      const ex = sess.exercises.find(e => e.id === exId);
      if (!ex) return prev;
      if (patch.weight != null) {
        if (patch.weight < 0 || patch.weight > 500) { setMsg('Вес 0–500'); setTimeout(()=>setMsg(''),1800); return prev; }
        ex.weight = patch.weight;
        const wmAny: any = (prev as any)?.inputSnapshot?.workMax || workMax || {};
        let base = 100;
        const lid = ex.id;
        if (['snatch','hang_snatch','power_snatch','muscle_snatch','deficit_snatch','block_snatch','pause_snatch','snatch_pull','pause_pull','deficit_pull','snatch_balance','overhead_squat_v2'].includes(lid) || lid.includes('snatch')) base = wmAny.snatch || 60;
        else if (['clean_and_jerk','hang_clean','power_clean','muscle_clean','deficit_clean','block_clean','pause_clean','push_jerk','split_jerk','clean_pull','front_squat_clean_grip','jerk_dip','jerk_recovery','behind_neck_jerk'].includes(lid) || lid.includes('clean') || lid.includes('jerk')) base = wmAny.cleanJerk || wmAny.clean || wmAny.frontSquat || 80;
        else if (['squat','back_squat','front_squat','hack_squat','front_squat_clean_grip','pause_squat','overhead_squat_v2'].includes(lid) || lid.includes('squat')) base = wmAny.backSquat || wmAny.frontSquat || 100;
        else if (['deadlift','sumo_dl','axle_deadlift','car_deadlift_18','rdl','deficit_pull','pause_pull'].includes(lid)) base = wmAny.deadlift || 120;
        else if (['yoke_walk','frame_carry','husafell_carry','farmers_walk_heavy','sandbag_carry','zercher_carry'].includes(lid)) base = wmAny.farmersWalk || wmAny.yokeWalk || 140;
        else if (['atlas_stone_load','stone_lift','sandbag_load','sandbag_shoulder','keg_toss'].includes(lid)) base = wmAny.atlasStone || 100;
        else if (['ohp','push_press','log_press','axle_press','circus_db_press','bench_bar','jerk_recovery','behind_neck_jerk'].includes(lid)) base = wmAny.overheadPress || wmAny.bench || wmAny.logPress || 60;
        const newPct = base ? Math.round(patch.weight / base * 100) : 0;
        ex.workSets = ex.workSets.map(s => ({ ...s, weight: patch.weight!, pct: newPct || s.pct }));
      }
      if (patch.reps != null) {
        ex.reps = patch.reps;
        const [a,b] = patch.reps.split('-').map(n=> parseInt(n,10));
        const avg = Math.round(((a||5)+(b||a||5))/2);
        ex.workSets = ex.workSets.map(s => ({ ...s, reps: avg }));
      }
      if (patch.rir != null) {
        if (patch.rir < 0 || patch.rir > 5) { setMsg('RIR 0–5'); setTimeout(()=>setMsg(''),1800); return prev; }
        ex.rir = patch.rir;
        ex.workSets = ex.workSets.map(s => ({ ...s, rir: patch.rir! }));
      }
      saveStrengthSportPlan(copy);
      return copy;
    });
  };

  const updateSet = (wkIdx: number, day: number, exId: string, setIdx: number, patch: Partial<{ weight:number; reps:number; rir:number; distanceM:number; timeCapS:number }>) => {
    setPlan(prev=>{
      if(!prev) return prev;
      const copy: StrengthSportPlan = JSON.parse(JSON.stringify(prev));
      const ex = copy.weeksData[wkIdx]?.sessions.find(s=> s.day===day)?.exercises.find(e=> e.id===exId);
      if(!ex || !ex.workSets[setIdx]) return prev;
      if(patch.weight!=null){
        if(patch.weight<0 || patch.weight>600) return prev;
        (ex.workSets[setIdx] as any).weight = patch.weight;
        ex.weight = Math.round(ex.workSets.reduce((a,s)=>a+s.weight,0)/ex.workSets.length);
      }
      if(patch.reps!=null) (ex.workSets[setIdx] as any).reps = Math.max(1, Math.min(20, patch.reps));
      if(patch.rir!=null) (ex.workSets[setIdx] as any).rir = Math.max(0, Math.min(5, patch.rir));
      if((patch as any).distanceM!=null) (ex.workSets[setIdx] as any).distanceM = Math.max(5, Math.min(100, (patch as any).distanceM));
      if((patch as any).timeCapS!=null) (ex.workSets[setIdx] as any).timeCapS = Math.max(10, Math.min(300, (patch as any).timeCapS));
      saveStrengthSportPlan(copy);
      return copy;
    });
  };
  const moveEx = (wkIdx: number, day: number, exId: string, dir: -1|1) => {
    setPlan(prev => {
      if (!prev) return prev;
      const copy: StrengthSportPlan = JSON.parse(JSON.stringify(prev));
      const sess = copy.weeksData[wkIdx]?.sessions.find(s=> s.day===day);
      if (!sess) return prev;
      const idx = sess.exercises.findIndex(e=> e.id===exId);
      if (idx<0) return prev;
      const nIdx = idx + dir;
      if (nIdx<0 || nIdx>=sess.exercises.length) return prev;
      const tmp = sess.exercises[idx];
      sess.exercises[idx]=sess.exercises[nIdx];
      sess.exercises[nIdx]=tmp;
      saveStrengthSportPlan(copy);
      return copy;
    });
  };
  const exportToUserProgram = () => {
    if (!plan) return;
    const prog: any = {
      id: plan.id,
      meta: { id: plan.id, title: `Стронг+ТА ${plan.mode} ${plan.weeks}нед`, direction: 'strength', createdAt: new Date().toISOString(), source: 'strength-sport', mode: plan.mode, level: plan.level, focus: plan.inputSnapshot?.focus, methodology: plan.inputSnapshot?.methodology, dupMode: (plan.inputSnapshot as any)?.dupMode, intensityTech: (plan.inputSnapshot as any)?.intensityTech },
      weeks: plan.weeksData.map(w=> ({ week: w.week, phase: w.phase, deload: w.deload, sessions: w.sessions.map(s=> ({ day: s.day, tag: s.sessionTag, character: s.character, exercises: s.exercises.map(e=> ({ id: e.id, name: e.name, sets: e.sets, reps: e.reps, weight: e.weight, rir: e.rir, tempo: e.tempo, restSeconds: e.restSeconds, technique: (e as any).technique, warmupSets: e.warmupSets, workSets: e.workSets })) })) })),
      outside: plan.outsideMetrics,
      validation: plan.validation,
    };
    try { saveUserProgram(prog); setMsg('✦ Экспортировано в библиотеку'); setTimeout(()=>setMsg(''),2200); } catch {}
    try { localStorage.setItem('he_last_strength_program', JSON.stringify(prog)); } catch {}
    try { navigator.clipboard?.writeText(JSON.stringify(prog, null, 2)); } catch {}
  };

  const handleMedleyChange = (id: string, patch: { distanceM?: number; timeCapS?: number }) => {
    // глобально правим все недели для этого ивента
    setPlan(prev=>{
      if(!prev) return prev;
      const copy: any = JSON.parse(JSON.stringify(prev));
      for(const wk of copy.weeksData) for(const sess of wk.sessions.filter((s:any)=> s.sessionTag==='event_day')) for(const ex of sess.exercises.filter((e:any)=> e.id===id)) {
        for(const ws of ex.workSets){ if(patch.distanceM!=null) (ws as any).distanceM = patch.distanceM; if(patch.timeCapS!=null) (ws as any).timeCapS = patch.timeCapS; }
      }
      try{ localStorage.setItem('he_strength_sport_plan_v1', JSON.stringify(copy)); }catch{}
      return copy;
    });
  };

  const handleBuildSeason = () => {
    try{
      const p2 = buildStrengthSportPlan({ mode:'strongman', goal:'peaking', level, weeks:6, daysPerWeek: days, workMax, competitionDate, startDate: new Date().toISOString().slice(0,10), contest, contestStrategy } as any);
      const ann2 = buildAnnualMultiPeak([plan!, p2], { competitions: [{date: competitionDate || new Date(Date.now()+ 60*86400000).toISOString().slice(0,10)}, {date: new Date(Date.now()+ 150*86400000).toISOString().slice(0,10)}], gppWeeks:4, transitionWeeks:2 });
      saveAnnualSS(ann2); setAnnual(ann2); setMsg('✦ Сезон 2 пика собран'); setTimeout(()=>setMsg(''),2200);
    }catch{}
  };

  const handleBuildAnnualFromCycles = () => {
    try{
      const avail = rankedCycles.filter(r=> !r.blocked);
      const picked = (annualCycleSel && annualCycleSel.length ? annualCycleSel.filter(id=> avail.some(r=> r.cycle.meta.id===id)) : avail.slice(0, 3).map(r=> r.cycle.meta.id));
      if (!picked.length) { setMsg('Нет доступных циклов'); setTimeout(()=>setMsg(''),1800); return; }
      const base: any = { mode, goal, level, workMax, equipment, injuries, mobilityRestrictions: mobility, sex, bodyweight, age, methodology, dupMode, intensityTech, outsideLoad: outsideEnabled ? outside : null, acwr: acwr as any, weakPoints: weakPoints.length ? weakPoints : undefined, contest: mode==='strongman' ? contest : undefined, contestStrategy: mode==='strongman' ? contestStrategy : undefined, startDate: new Date().toISOString().slice(0,10) };
      const ann3 = buildAnnualFromSSCycles(picked, base, { cycleMode, competitionDate: competitionDate || undefined, taperWeeks: 1 });
      saveAnnualSS(ann3); setAnnual(ann3);
      try { syncStrengthAnnualToGeneral(ann3); } catch {}
      setMsg(`✦ Год из циклов: ${picked.length} блока (${ann3.totalWeeks}нед)`); setTimeout(()=>setMsg(''),2200);
    }catch{ setMsg('Не собралось'); setTimeout(()=>setMsg(''),1800); }
  };

  const stepList: Step[] = ['params', 'athlete', 'outside', 'split', 'plan', 'quality', 'export'];
  const stepIndex = stepList.indexOf(step) + 1;
  const modeColor = mode === 'weightlifting' ? '#00e68a' : mode === 'strongman' ? '#f59e0b' : '#0ea5e9';
  const modeGrad = mode === 'weightlifting' ? ACCENT_GRAD : mode === 'strongman' ? STRONG_GRAD : 'linear-gradient(135deg, #0ea5e9, #6366f1)';
  const groupEndKeys = new Set(Object.values(STEP_GROUPS).map(arr => arr[arr.length - 1]).filter(Boolean));
  // План без плана показывает CTA-пустышку со сборкой — лочим только качество.
  const needsPlan = (s: Step) => s === 'quality' && !plan;
  const exportLocked = !plan && !annual;

  const go = (s: Step) => { buzzStep(); setStep(s); };
  const renderStepNav = () => (
    <div style={{ background: 'rgba(24,24,27,0.55)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '5px 6px', marginBottom: 2, display: 'flex', gap: 4, overflowX: 'auto' as const, alignItems: 'center' }}>
      {stepList.map(s => {
        const active = step === s;
        const disabled = s === 'export' ? exportLocked : needsPlan(s);
        return (
          <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 as const }}>
            <button disabled={disabled} onClick={() => { if (disabled) return; go(s); }} style={{ ...STEP_PILL(active), flexShrink: 0 as const, opacity: disabled ? 0.45 : 1 }}>{STEP_LABEL_RU[s]}</button>
            {groupEndKeys.has(s) && s !== stepList[stepList.length - 1] && <span style={{ width: 1, height: 18, background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.08), transparent)', flexShrink: 0 as const, margin: '0 2px', alignSelf: 'center' }} />}
          </span>
        );
      })}
    </div>
  );
  const renderNavRow = (prev: Step | null, next: Step | null, nextLabel?: string) => (
    <div data-ss="wizard-nav" style={{ display: 'flex', gap: 8 }}>
      {prev && <button onClick={() => go(prev)} style={{ ...T_BTN_GHOST, flex: 1 }}>← Назад</button>}
      {next && <button onClick={() => go(next)} style={{ ...T_BTN, flex: 1.4 }}>{nextLabel || `Далее → ${STEP_LABEL_RU[next]}`}</button>}
    </div>
  );

  const athleteSummary = `${sex === 'male' ? 'М' : 'Ж'} · ${bodyweight}кг · ${age} лет${acwr ? ` · ACWR ${acwr.ratio}` : ''}`;
  const methodologySummary = `${methodology === 'compound_first' ? 'База первой' : methodology === 'pre_exhaust' ? 'Предутомление' : 'Постутомление'} · ${dupMode === 'off' ? 'DUP выкл' : dupMode === 'heavy_light' ? 'Тяж/лёг' : 'Волна'} · ${intensityTech === 'none' ? 'чисто' : 'кластер'}`;
  const qualitySummary = weakPoints.length ? `Слабые: ${weakPoints.length}` : injuries.length ? `Травмы: ${injuries.length}` : equipment.length ? `Инвентарь: ${equipment.length}` : 'проверки по плану';

  return (
    <div className={isNativeApp() ? 'train-strong ss-apk' : 'train-strong'} data-ss="root" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 880, margin: '0 auto' }}>
      <style>{`input[type="range"]{ -webkit-appearance:none; appearance:none; height:8px; border-radius:999px; background:rgba(255,255,255,0.10); border:0.5px solid rgba(255,255,255,0.06); }
        input[type="range"]::-webkit-slider-thumb{ -webkit-appearance:none; width:26px; height:26px; border-radius:50%; background:${mode === 'strongman' ? '#f59e0b' : mode === 'hybrid' ? '#0ea5e9' : '#00e68a'}; border:3px solid #fff; box-shadow:0 2px 12px rgba(0,0,0,0.30), 0 0 0 5px ${mode === 'strongman' ? 'rgba(245,158,11,0.15)' : mode === 'hybrid' ? 'rgba(14,165,233,0.15)' : 'rgba(0,230,138,0.15)'}; cursor:pointer; }
        input[type="range"]::-moz-range-thumb{ width:22px; height:22px; border-radius:50%; background:${mode === 'strongman' ? '#f59e0b' : mode === 'hybrid' ? '#0ea5e9' : '#00e68a'}; border:3px solid #fff; box-shadow:0 2px 12px rgba(0,0,0,0.30); cursor:pointer; }
        input[type="date"]{ color-scheme: dark; }`}</style>

      {/* HERO — компакт в стиле комбата: без glow-пятен и пустот */}
      <div data-ss="hero" style={mode === 'strongman' ? CARD_STRONG : CARD_HERO}>
        <div style={ROW}>
          <span style={{ width: 44, height: 44, borderRadius: 13, background: modeGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: mode === 'weightlifting' ? '#06281c' : '#fff', boxShadow: `0 6px 18px ${modeColor}44, inset 0 1px 0 rgba(255,255,255,0.28)`, flexShrink: 0 }}>{mode === 'weightlifting' ? '🏋️' : mode === 'strongman' ? '🪨' : '🔀'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1.05, letterSpacing: -0.3 }}>{mode === 'weightlifting' ? 'Тяжёлая атлетика — PRO' : mode === 'strongman' ? 'Силовой экстрим — PRO' : 'Гибрид — PRO'}</div>
            <div style={{ fontSize: 11.5, color: '#fff', lineHeight: 1.35, marginTop: 2 }}>Torokhtiy 3/3/3/1 · Prilepin · SINCLAIR 2025 · 92/97/102%</div>
          </div>
          <Badge color={modeColor} bg={`${modeColor}14`} border={`${modeColor}30`}>{stepIndex}/7 · {STEP_LABEL_RU[step]}</Badge>
        </div>
        <ProgressBar value={stepIndex} max={7} color={modeColor} height={8} />
        <div data-ss="steps">{renderStepNav()}</div>
        <div style={{ ...ROW, justifyContent:'space-between', gap: 8 }}>
          <div style={{ ...ROW, gap: 6 }}>
            {plan && <Badge color={modeColor} bg={`${modeColor}12`} border={`${modeColor}22`} icon="📋">План {plan.weeks}нед · {plan.patternId}</Badge>}
            {Object.keys(hubVelocity).length > 0 && <Badge color="#f5b04c" bg="rgba(245,158,11,0.10)" border="rgba(245,158,11,0.18)">📥 Из хаба: {Object.entries(hubVelocity).map(([k, v]) => `${k} ${v.length}т`).join(' · ')}</Badge>}
            {outsideMetrics && <Badge color="#c4b5fd" bg="rgba(168,85,247,0.10)" border="rgba(168,85,247,0.18)">Вне зала ×{outsideMetrics.volumeMultiplier}</Badge>}
            {acwr && <Badge color={acwr.zone==='dangerous'?'#fecaca': acwr.zone==='caution'?'#fde68a': acwr.zone==='caution'?'#fde68a':'#86efac'} bg={acwr.zone==='dangerous'?'rgba(239,68,68,0.12)': acwr.zone==='caution'?'rgba(245,158,11,0.12)':'rgba(0,230,138,0.08)'} border={acwr.zone==='dangerous'?'rgba(239,68,68,0.22)': acwr.zone==='caution'?'rgba(245,158,11,0.22)':'rgba(0,230,138,0.16)'}>ACWR {acwr.ratio} · {ruLabel(ZONE_RU, acwr.zone)}</Badge>}
            {hrv && <Badge color={hrv.zone==='dangerous'?'#fecaca': hrv.zone==='caution'?'#fde68a':'#86efac'} bg={hrv.zone==='dangerous'?'rgba(239,68,68,0.12)': hrv.zone==='caution'?'rgba(245,158,11,0.12)':'rgba(0,230,138,0.08)'} border={hrv.zone==='dangerous'?'rgba(239,68,68,0.22)': hrv.zone==='caution'?'rgba(245,158,11,0.22)':'rgba(0,230,138,0.16)'}>HRV {hrv.ewma ?? hrv.last} мс · {hrv.zone}</Badge>}
          </div>
          {msg && <span data-ss="msg" style={{ fontSize:11.5, fontWeight:700, color:'#fff', background: mode==='strongman'?'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(239,68,68,0.12))':'linear-gradient(135deg, rgba(48,209,88,0.18), rgba(14,165,233,0.12))', border:'1px solid rgba(255,255,255,0.10)', padding:'6px 12px', borderRadius:20, backdropFilter:'blur(8px)', boxShadow:'0 4px 16px rgba(0,0,0,0.18)' }}>{msg}</span>}
        </div>
      </div>

      {/* Mobile lazy: только активный шаг монтируется (step==='params' &&) — 1/4 DOM, 60% меньше памяти на мобильном, как CardioUI */}
      {step === 'params' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionCard icon="🎯" title="Режим и цель" subtitle="Подбирает сплит, тоннаж и % зоны" summary={`${ruLabel(MODE_RU, mode)} · ${ruLabel(GOAL_RU, goal)} · ${ruLabel(LEVEL_RU, level)} · ${weeks}н × ${days}дн`}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <StrengthPopupSelect label="Режим" value={mode} onChange={v=> setMode(v as any)} strong={mode==='strongman'} options={[
                { id:'weightlifting', label:'🏋️ ТА', desc:'рывок/толчок/присед' },
                { id:'strongman', label:'🪨 Стронг', desc:'йок/фермер/камни' },
                { id:'hybrid', label:'🔀 Гибрид', desc:'микс' },
              ]} />
              <StrengthPopupSelect label="Цель блока" value={goal} onChange={v=> setGoal(v as any)} strong={mode==='strongman'} options={[
                { id:'strength', label:'🏆 Сила', desc:'RIR 2-3, % 75-90' },
                { id:'hypertrophy', label:'💪 Масса', desc:'RIR 3-4, объём' },
                { id:'technique', label:'🎯 Техника', desc:'RIR 4, лёгкие' },
                { id:'peaking', label:'🏁 Пик', desc:'taper, 92-97-102%' },
                { id:'maintenance', label:'🛡️ Поддержание', desc:'минимум' },
              ]} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <StrengthPopupSelect label="Уровень" value={level} onChange={v=> setLevel(v as any)} options={[
                { id:'beginner', label:'Новичок', desc:'RIR 3-4' },
                { id:'intermediate', label:'Средний', desc:'RIR 2-3' },
                { id:'advanced', label:'Продвинутый', desc:'RIR 1-2' },
                { id:'enhanced', label:'💊 На курсе', desc:'+объём' },
              ]} />
              <StrengthPopupSelect label="Фокус зала" value={focus || ''} onChange={v=> setFocus((v || null) as any)} options={[
                { id:'', label:'Без фокуса — баланс' },
                { id:'snatch', label:'⚡️ Рывок' },
                { id:'clean', label:'🏋️ Толчок / взятие' },
                { id:'squat', label:'🦵 Присед' },
                { id:'overhead', label:'🪵 Жим / лог' },
                { id:'carry', label:'🚜 Переноски' },
                { id:'stone', label:'🪨 Камни' },
              ]} />
            </div>
            <Divider />
            <GroupHeading icon="📅" text="Объём цикла" desc="Недели и частота — тоннаж и восстановление" />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Field label={`Недель`} hint={`${weeks} нед — мезоцикл`}><div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={2} max={16} value={weeks} onChange={e => setWeeks(Number(e.target.value))} style={{ flex:1 }} /><Highlight color={mode==='strongman'?ACCENT_STRONG:ACCENT}>{weeks}</Highlight></div><div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#fff', fontFamily:'-apple-system, system-ui, sans-serif' }}><span>2</span><span>16</span></div></Field>
              <Field label={`Дней / нед`} hint={`${days}× — сплит и тоннаж`}><div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={2} max={6} value={days} onChange={e => setDays(Number(e.target.value))} style={{ flex:1 }} /><Highlight color={mode==='strongman'?ACCENT_STRONG:ACCENT}>{days}×</Highlight></div><div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#fff' }}><span>2</span><span>6</span></div></Field>
            </div>
          </SectionCard>

          <SectionCard icon="🧠" title="Методика и волны" subtitle="Подсветка зон RIR/веса" collapsible defaultOpen={false} summary={methodologySummary} status={(dupMode !== 'off' || intensityTech !== 'none') ? 'ok' : undefined}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
              <StrengthPopupSelect label="Порядок" value={methodology} onChange={v=> setMethodology(v as any)} options={[{id:'compound_first',label:'База первой',desc:'классика'},{id:'pre_exhaust',label:'Предутомление',desc:'изоляция → база'},{id:'post_exhaust',label:'Постутомление',desc:'база → изоляция'}]} />
              <StrengthPopupSelect label="DUP" value={dupMode} onChange={v=> setDupMode(v as any)} options={[{id:'off',label:'Выкл',desc:'одна зона'},{id:'heavy_light',label:'Тяж/лёг',desc:'волна'},{id:'wave',label:'Волна',desc:'3-волны'}]} />
              <StrengthPopupSelect label="Техника" value={intensityTech} onChange={v=> setIntensityTech(v as any)} options={[{id:'none',label:'Нет',desc:'чистые сеты'},{id:'cluster',label:'Кластер 3×1',desc:'база'}]} />
            </div>
          </SectionCard>

          {renderNavRow(null, 'athlete')}
        </div>
      )}

      {step === 'athlete' && (
        <div className="ss-pane" data-pane="athlete" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionCard icon="👤" title="Атлет" subtitle="Вес и возраст — % от ПМ и SINCLAIR" summary={athleteSummary}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <StrengthPopupSelect label="Пол" value={sex} onChange={v=> setSex(v as any)} options={[{id:'male',label:'Мужской'},{id:'female',label:'Женский'}]} />
              <StrengthPopupNumber label="Вес" value={bodyweight} min={40} max={160} suffix="кг" onChange={v=> setBodyweight(v)} strong={mode==='strongman'} />
              <StrengthPopupNumber label="Возраст" value={age} min={14} max={65} onChange={v=> setAge(v)} strong={mode==='strongman'} />
              <Field label="Дата пика"><input type="date" value={competitionDate} onChange={e=> setCompetitionDate(e.target.value)} style={INPUT} /></Field>
            </div>
            {goal==='peaking' && competitionDate && (
              <StrengthPopupSelect label="Тапер" value={String(taperWeeks)} onChange={v=> setTaperWeeks(Number(v))} options={[{id:'1',label:'1 неделя',desc:'объём −45%'},{id:'2',label:'2 недели',desc:'−35% → −55%'}]} />
            )}
            {acwr && <InfoBanner tone={acwr.zone==='dangerous'?'warn': acwr.zone==='caution'?'warn':'info'}><Highlight color={acwr.zone==='dangerous'?'#ff3b30':acwr.zone==='caution'?'#ff9f0a':'#30d158'}>ACWR {acwr.ratio}</Highlight> · {ruLabel(ZONE_RU, acwr.zone)} {acwr.zone==='dangerous'?'— объём ×0.60, RIR+2': acwr.zone==='caution'?'— объём ×0.85, RIR+1':'— оптимум'}</InfoBanner>}
            {hrv && <InfoBanner tone={hrv.zone==='dangerous'?'warn': hrv.zone==='caution'?'warn':'info'}><Highlight color={hrv.zone==='dangerous'?'#ff3b30':hrv.zone==='caution'?'#ff9f0a':'#30d158'}>HRV {hrv.ewma ?? hrv.last} мс</Highlight> · {hrv.zone} · mean {hrv.mean}±{hrv.sd}</InfoBanner>}
            {(() => {
              const sn = workMax.snatch||0, cj = workMax.cleanJerk||workMax.clean||0, sq = workMax.backSquat||0, dl = workMax.deadlift||0;
              const warns: string[] = [];
              if(sn && cj && sn > cj) warns.push('Рывок > толчка — проверьте ПМ');
              if(cj && sq && cj > sq) warns.push('Толчок > приседа — редко');
              if(sq && dl && sq > dl) warns.push('Присед > тяги — проверьте');
              return warns.length ? <InfoBanner tone="warn">{warns.join(' · ')}</InfoBanner> : null;
            })()}
            <button onClick={pullFromProfile} style={{ ...BTN, flex:1 }}>⟡ Из профиля</button>
          </SectionCard>

          <SectionCard icon="🏋️" title="Рабочие максимумы" subtitle="Олимпийка + сила · стронг — ниже" collapsible defaultOpen={false} summary={`${(['backSquat','frontSquat','deadlift','snatch','cleanJerk','overheadPress'] as const).filter(k => ((workMax as any)[k] || 0) > 0).length}/6 ПМ`} status={(['backSquat','frontSquat','deadlift','snatch','cleanJerk','overheadPress'] as const).some(k => ((workMax as any)[k] || 0) > 0) ? 'ok' : undefined}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px,1fr))', gap:8 }}>
              {(['backSquat','frontSquat','deadlift','snatch','cleanJerk','overheadPress'] as const).map(k => (
                <Field key={k} label={WM_LABEL_RU[k]||k}><input type="number" value={(workMax as any)[k] || ''} onChange={e => setWorkMax(s => ({ ...s, [k]: Number(e.target.value)||0 }))} style={{ ...INPUT, fontVariantNumeric:'tabular-nums' }} placeholder="кг" /></Field>
              ))}
            </div>
            {mode !== 'weightlifting' && (
              <>
                <Divider />
                <GroupHeading icon="🪨" text="Стронг-ивенты" desc="Йок / фермер / рама / хус / камень / лог · отдельные ПМ" strong />
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px,1fr))', gap:8 }}>
                  {(['yokeWalk','farmersWalk','frameCarry','husafellCarry','atlasStone','sandbagLoad','kegToss','carDeadlift','axlePress','logPress'] as const).map(k => (
                    <Field key={k} label={WM_LABEL_RU[k]||k}><input type="number" value={(workMax as any)[k] || ''} onChange={e => setWorkMax(s => ({ ...s, [k]: Number(e.target.value)||0 }))} style={{ ...INPUT, fontVariantNumeric:'tabular-nums', borderColor:'rgba(255,159,10,0.22)' }} placeholder="кг" /></Field>
                  ))}
                </div>
              </>
            )}
          </SectionCard>

          <SectionCard icon="⚡" title="VBT per-lift" subtitle="snatch/clean/squat — пороги 10% TA / 15% тяга (PLOS 2026)" accent collapsible defaultOpen={false} summary={`потеря ${velocityLoss}% · ${(['snatch','clean','squat'] as const).filter(l => ((vbtPerLift as any)[l]?.best || 0) > 0).length}/3 лифта`} status={(velocityLoss > 0 || (['snatch','clean','squat'] as const).some(l => ((vbtPerLift as any)[l]?.best || 0) > 0)) ? 'ok' : undefined}>
            <Field label="VBT потеря" hint="потеря скорости vs бюджет · >20% → объём ×0.90, RIR+1"><div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={0} max={40} value={velocityLoss} onChange={e=> setVelocityLoss(Number(e.target.value))} style={{ flex:1 }} /><Highlight color={velocityLoss>25?'#ff3b30': velocityLoss>20?'#ff9f0a':'#30d158'}>{velocityLoss}%</Highlight></div></Field>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8 }}>
              {(['snatch','clean','squat'] as const).map(lift => {
                const vals = (vbtPerLift as any)[lift] || {best:0,last:0};
                const loss = vals.best>0 && vals.last>0 ? Math.round((vals.best - vals.last)/vals.best*100) : 0;
                const col = loss>20 ? '#ef4444' : loss>10 ? '#f59e0b' : '#22c55e';
                return (
                  <div key={lift} style={{ background:'rgba(0,0,0,0.16)', padding:'10px', borderRadius:12, border:'0.5px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ fontSize:10, fontWeight:800, color:'#86efac', textTransform:'uppercase', letterSpacing:0.5 }}>{lift==='snatch'?'🏋️ Рывок':lift==='clean'?'🏋️ Толчок':'🦵 Присед'} · {lift}</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                      <Field label="Best м/с"><input type="number" step={0.05} value={vals.best||''} onChange={e=> { const v=Number(e.target.value)||0; setVbtPerLift(s=> ({...s, [lift]:{...((s as any)[lift]||{best:0,last:0}), best:v}})); }} style={INPUT} placeholder="1.60" /></Field>
                      <Field label="Last м/с"><input type="number" step={0.05} value={vals.last||''} onChange={e=> { const v=Number(e.target.value)||0; setVbtPerLift(s=> ({...s, [lift]:{...((s as any)[lift]||{best:0,last:0}), last:v}})); }} style={INPUT} placeholder="1.40" /></Field>
                    </div>
                    {loss>0 && <div style={{ fontSize:10, fontWeight:700, color:col }}>{loss}% · {loss>20?'⚠️ стоп':loss>10?'контроль':'✅'} · порог {lift==='snatch'||lift==='clean'?10:15}%</div>}
                  </div>
                );
              })}
            </div>
            {Object.keys(hubVelocity).length > 0 && (
              <div style={{ fontSize:11, color:'#f5b04c', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.20)', padding:'8px 10px', borderRadius:10, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <span>📥 Из хаба: {Object.entries(hubVelocity).map(([k, v]) => `${k} ${v.length}т`).join(' · ')}</span>
                <button onClick={() => setHubVelocity({})} style={{ padding:'6px 12px', borderRadius:10, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer' }}>✕ Сбросить</button>
              </div>
            )}
          </SectionCard>

          <SectionCard icon="📈" title="LVP калибровка" subtitle="Скорость — нагрузка (Wood 2026 peak) 50/65/75/90%" accent collapsible defaultOpen={false} summary={lvpResult ? `${lvpLift} · r² ${lvpResult.r2}` : 'не калиброван'} status={lvpResult ? 'ok' : undefined}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <StrengthPopupSelect label="Лифт" value={lvpLift} onChange={v=> setLvpLift(v)} options={[{id:'snatch',label:'🏋️ Рывок'},{id:'clean',label:'🏋️ Толчок'},{id:'squat',label:'🦵 Присед'},{id:'deadlift',label:'🏋️ Тяга'},{id:'yoke_walk',label:'🚜 Йок'},{id:'farmers_walk',label:'🚜 Фермер'}]} />
              <div style={{ display:'flex', alignItems:'flex-end', gap:6 }}>
                <button onClick={()=> {
                  const res = calibrateLVP(lvpLift, lvpPoints as any);
                  if (res) { saveLVPProfile(res); setLvpResult(res); setMsg(`✦ LVP ${lvpLift} r² ${res.r2} ${res.valid?'✅':'⚠️'}`); setTimeout(()=>setMsg(''),2000); }
                  else { setMsg('⚠ Need ≥3 точки с покрытием 20%'); setTimeout(()=>setMsg(''),2000); }
                }} style={{ ...BTN_PRIMARY, flex:1 }}>Калибровать</button>
                <button onClick={()=> { const all=loadLVPProfiles(); setMsg(`LVP профилей: ${Object.keys(all).join(', ')||'—'}`); setTimeout(()=>setMsg(''),2000); }} style={BTN}>Показать</button>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6 }}>
              {lvpPoints.map((pt,idx)=> (
                <div key={idx} style={{ background:'rgba(0,0,0,0.16)', padding:'10px', borderRadius:12, border:'0.5px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontSize:10, color:'#fff', marginBottom:4 }}>{Math.round(pt.pct*100)}% → м/с</div>
                  <input type="number" step={0.05} value={pt.velocity||''} onChange={e=> { const v=Number(e.target.value)||0; setLvpPoints(s=> s.map((p,i)=> i===idx?{...p, velocity:v}:p)); }} style={{ ...INPUT, fontSize:14, fontWeight:700, padding:'10px 8px', minHeight:48 }} placeholder="1.80" />
                  <div style={{ fontSize:10, color: velocityTypeForLift(lvpLift)==='peak' ? '#22c55e':'#f59e0b' }}>{velocityTypeForLift(lvpLift)==='peak'?'peak':'mpv'}</div>
                </div>
              ))}
            </div>
            {lvpResult && <div style={{ fontSize:10, color: lvpResult.valid ? '#22c55e':'#f59e0b', background: lvpResult.valid?'rgba(34,197,94,0.08)':'rgba(245,158,11,0.08)', padding:'6px 8px', borderRadius:8, border:`0.5px solid ${lvpResult.valid?'rgba(34,197,94,0.18)':'rgba(245,158,11,0.18)'}` }}>r² {lvpResult.r2} slope {lvpResult.slope} intercept {lvpResult.intercept} {lvpResult.valid?'✅ валиден ≥0.85':'⚠ проверьте'} · e1RM пример {estimate1RMFromVelocitySS(80, lvpResult.valid? velocityForLVP(lvpResult,0.8)??0 : 0, lvpLift)||'—'}кг</div>}
          </SectionCard>

          {renderNavRow('params', 'outside')}
        </div>
      )}

      {step === 'outside' && (
        <div style={{ display:'flex', flexDirection:'column', gap: 10 }}>
          <SectionCard icon="🏃" title="Вне зала — поле / кроссфит" subtitle="ACWR и объём зала ×" accent={outsideEnabled}>
            <GroupHeading icon="📊" text="Нагрузка вне зала" desc="Поле, кроссфит, GPP — декремент объёма зала" />
            <label style={{ display:'flex', gap:8, alignItems:'center', fontSize:13, color:'#fff', fontWeight:700, background: outsideEnabled ? 'rgba(48,209,88,0.12)' : 'rgba(255,255,255,0.03)', padding:'11px 12px', borderRadius:12, border:`1px solid ${outsideEnabled?'rgba(48,209,88,0.22)':'rgba(255,255,255,0.06)'}`, cursor:'pointer', fontFamily: '-apple-system, system-ui, sans-serif' }}>
              <input type="checkbox" checked={outsideEnabled} onChange={e => setOutsideEnabled(e.target.checked)} style={{ width:18, height:18, accentColor:'#30d158' }} /> Учитывать внезальную нагрузку — <Highlight>{outsideEnabled?'включено':'выкл'}</Highlight>
            </label>
            {outsideEnabled && outside && (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                  <Field label="Сессий / нед" hint={`${outside.sessionsPerWeek}×`}><div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={0} max={6} value={outside.sessionsPerWeek} onChange={e => setOutside(o => o ? { ...o, sessionsPerWeek: Number(e.target.value) } : o)} style={{ flex:1 }} /><Highlight>{outside.sessionsPerWeek}×</Highlight></div></Field>
                  <Field label="Длительность" hint={`${outside.avgDurationMin} мин`}><div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={30} max={180} step={10} value={outside.avgDurationMin} onChange={e => setOutside(o => o ? { ...o, avgDurationMin: Number(e.target.value) } : o)} style={{ flex:1 }} /><Highlight>{outside.avgDurationMin}′</Highlight></div></Field>
                  <Field label="RPE" hint={`RPE ${outside.avgSRPE}`}><div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={1} max={10} value={outside.avgSRPE} onChange={e => setOutside(o => o ? { ...o, avgSRPE: Number(e.target.value) } : o)} style={{ flex:1 }} /><Highlight color={outside.avgSRPE>=8?'#ff3b30': outside.avgSRPE>=6?'#ff9f0a':'#30d158'}>RPE {outside.avgSRPE}</Highlight></div></Field>
                </div>
                <InfoBanner tone={outsideMetrics?.interference === 'high' ? 'warn' : outsideMetrics?.interference === 'medium' ? 'info' : 'ok'}>{outsideMetrics ? <span><Highlight color={outsideMetrics.interference==='high'?'#ff9f0a':'#30d158'}>{outsideMetrics.weeklyLoad} load</Highlight> → объём <Highlight>×{outsideMetrics.volumeMultiplier}</Highlight> ({outsideMetrics.interference})</span> : 'Вне зала: нет данных — объём 100%'}</InfoBanner>
              </>
            )}
          </SectionCard>
          {renderNavRow('athlete', 'split')}
          {diaryLoad != null && (
            <InfoBanner tone={diaryLoad>30?'warn':'info'}>Дневник: нагрузка 7д ≈ <Highlight color={diaryLoad>30?'#ff9f0a':'#30d158'}>{diaryLoad}</Highlight> {diaryLoad>30?'— высоко, лёгкую неделю?':'— норма'} {acwr && <span>· ACWR <Highlight>{acwr.ratio}</Highlight> · {ruLabel(ZONE_RU, acwr.zone)}</span>}</InfoBanner>
          )}
        </div>
      )}

      {step === 'split' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <SectionCard icon="✨" title="Рекомендация" subtitle="Подбор сплита по режиму · дням · уровню" accent collapsible defaultOpen={false} summary={patternId ? `Выбран: ${STRENGTH_SPORT_PATTERNS.find(p=>p.id===patternId)?.name}` : recommendStrengthSportPattern(mode, days, level).name} status="ok">
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ fontSize:12, color: '#fff' }}>Рекомендуем:</span><Highlight color={modeColor}>{recommendStrengthSportPattern(mode, days, level).name}</Highlight>
              <Badge color={modeColor} bg={`${modeColor}12`} border={`${modeColor}22`}>{recommendStrengthSportPattern(mode, days, level).sessionsPerRotation}×/нед</Badge>
            </div>
            <div style={{ fontSize:11, color: '#fff' }}>Дней {days}× · Режим {mode==='weightlifting'?'ТА':mode==='strongman'?'Стронг':'Гибрид'} · Уровень {ruLabel(LEVEL_RU, level)} · {patternId ? 'выбран вручную' : 'авто — тапните карточку ниже'}</div>
          </SectionCard>
          <SectionCard icon="📚" title="Интернет-цикл" subtitle="Дословные программы ТА/стронга · перекрывает сплит ниже" accent={!!cycleId}>
            {!cycleId && rankedCycles.filter(r=> !r.blocked).length > 0 && (
              <div style={{ fontSize:11, color:'#fff' }}>💡 Рекомендуем цикл: <Highlight color={modeColor}>{rankedCycles.filter(r=> !r.blocked)[0].cycle.meta.title}</Highlight></div>
            )}
            <StrengthPopupSelect label="Цикл" value={cycleId} onChange={v=> setCycleId(v)} strong={mode==='strongman'} options={[
              { id:'', label:'Без цикла — параметрический план', desc:'сплит ниже' },
              ...rankedCycles.filter(r=> !r.blocked).map(r=> ({
                id: r.cycle.meta.id,
                label: `${r.fit==='exact'?'✅ ':r.fit==='close'?'🔹 ':'▫️ '}${r.cycle.meta.title}`,
                desc: `${r.cycle.meta.weeks}нед · ${r.cycle.meta.sessionsPerWeek}${r.cycle.meta.sessionsPerWeekMax?`→${r.cycle.meta.sessionsPerWeekMax}`:''}× · ${r.reasons.slice(0,2).join(' · ')}`,
              })),
            ]} />
            {rankedCycles.some(r=> r.blocked) && (
              <InfoBanner tone="warn">{rankedCycles.filter(r=> r.blocked).map(r=> `${r.cycle.meta.title}: ${r.blocked}`).join(' · ')}</InfoBanner>
            )}
            {cycleId && (
              <>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <ChipToggle active={cycleMode==='faithful'} onClick={()=> setCycleMode('faithful')}>📜 Дословно (дефолт)</ChipToggle>
                  <ChipToggle active={cycleMode==='adapt'} onClick={()=> setCycleMode('adapt')}>🛡️ Адаптировать (ACWR/VBT)</ChipToggle>
                </div>
                <div style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.03)', padding:'6px 8px', borderRadius:8, border:'0.5px solid rgba(255,255,255,0.06)' }}>
                  {cycleMode==='faithful'
                    ? 'Дословно: сеты/повторы/% 1-в-1 из источника, без авто-срезок объёма. Травмы и фолбэк снарядов действуют всегда.'
                    : 'Адаптировать: поверх дословного — срезки ACWR/outside/VBT и дрейф ПМ по лифту.'}
                </div>
                {(() => {
                  const tpl = getSSCycleById(cycleId);
                  if (!tpl) return null;
                  const phaseShort: Record<string,string> = { base:'Б', build:'Н', peak:'П', deload:'Р', taper:'Т', test:'Тст' };
                  const phaseOf = (wn: number) => tpl.meta.phases?.find(p=> wn >= p.weekStart && wn <= p.weekEnd)?.phase;
                  return (
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        {tpl.weeks.map((wkDays, wi)=> {
                          const wn = wi + 1;
                          const ph = phaseOf(wn);
                          const marks = `${(tpl.meta.mockWeeks||[]).includes(wn)?' 🏁':''}${(tpl.meta.taperWeeks||[]).includes(wn)?' 📉':''}${(tpl.meta.deloadWeeks||[]).includes(wn)?' 💤':''}`;
                          return <span key={wn} style={{ fontSize:10, padding:'3px 7px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'0.5px solid rgba(255,255,255,0.08)', color:'#fff', fontVariantNumeric:'tabular-nums' }}>Н{wn}·{wkDays.length}д·{phaseShort[ph||'']||'·'}{marks}</span>;
                        })}
                      </div>
                      <div style={{ fontSize:11, color:'#fff', lineHeight:1.45 }}>{tpl.meta.description}</div>
                      <div style={{ fontSize:10, color:'#fff' }}>{tpl.meta.howItWorks}</div>
                      {tpl.meta.needsSpecialty && !(['other','specialty'].some(e=> equipment.map(x=>String(x).toLowerCase()).includes(e)) || equipment.length===0) && (
                        <InfoBanner tone="warn">Нет спец-снарядов — ивенты заменятся (йок→фермер ×0.73, камень→мешок ×0.66) с бейджем в плане</InfoBanner>
                      )}
                      {competitionDate && (tpl.meta.mockWeeks?.length || tpl.meta.taperWeeks?.length) && (
                        <InfoBanner tone="info">⚓ Якорь к старту {competitionDate}: mock нед {tpl.meta.mockWeeks?.join(',')||'—'} · тейпер нед {tpl.meta.taperWeeks?.join(',')||'—'} (порядок недель не меняем)</InfoBanner>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
            {(() => {
              const bg = rankedCycles.find(r=> r.cycle.meta.bulgarian);
              if (!bg || !bg.blocked || !/согласие/.test(bg.blocked)) return null;
              return (
                <label style={{ display:'flex', gap:8, alignItems:'flex-start', fontSize:11.5, color:'#fff', background:'rgba(239,68,68,0.08)', padding:'10px 12px', borderRadius:12, border:'1px solid rgba(239,68,68,0.20)', cursor:'pointer', lineHeight:1.4 }}>
                  <input type="checkbox" checked={cycleConsent} onChange={e=> setCycleConsent(e.target.checked)} style={{ width:18, height:18, marginTop:1, accentColor:'#ef4444' }} />
                  <span>Понимаю риск daily-max (максимумы каждый день, только advanced+, сон 8ч). Разблокировать болгарский цикл.</span>
                </label>
              );
            })()}
          </SectionCard>
          {mode==='strongman' && (
            <SectionCard icon="🏆" title="Контест — пакет ивентов" subtitle="Йок/лог/камни → план строит под них" collapsible defaultOpen={false} summary={contest ? `${contest.name || 'Кастом'} · ${contest.events.length} ивентов` : 'без пакета — generic 5-фаз'} status={contest ? 'ok' : undefined}>
              <Field label="Пресет контеста">
              <div data-ss="presets" style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {Object.entries(CONTEST_PRESETS).map(([pid, pc])=> (
                  <button key={pid} onClick={()=> setContest(pc as StrongmanContest)} style={{ padding:'10px 14px', borderRadius:12, border: contest?.name===pc.name ? '1.5px solid #f59e0b' : '1px solid rgba(255,255,255,0.10)', background: contest?.name===pc.name ? 'linear-gradient(135deg, rgba(245,158,11,0.22), rgba(239,68,68,0.12))':'rgba(255,255,255,0.04)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', minHeight:44 }}>{pc.name}</button>
                ))}
                <button onClick={()=> setContest(null)} style={{ padding:'10px 14px', borderRadius:12, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:12, fontWeight:600, minHeight:44 }}>✕</button>
              </div>
              </Field>
              {contest && (
                <div data-ss="contest" style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', borderRadius:10, padding:8, display:'flex', flexDirection:'column', gap:6 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#f59e0b' }}>{contest.name || 'Кастом'} · {contest.events.length}</span>
                    <StrengthPopupSelect label="Стратегия" value={contestStrategy} onChange={v=> setContestStrategy(v as any)} strong options={[{id:'conservative',label:'🛡️ Консерва'},{id:'balanced',label:'⚖️ Баланс'},{id:'aggressive',label:'🔥 Агрессив'}]} />
                  </div>
                  {contest.events.map((ev, idx)=> (
                    <div key={idx} style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', background:'rgba(0,0,0,0.22)', padding:'8px 10px', borderRadius:12, border:'0.5px solid rgba(255,255,255,0.08)' }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'#fff', flex:'1 1 100px' }}>{(EVENT_META as any)[ev.id]?.label || ev.id}</span>
                      <span style={{ fontSize:10, fontWeight:700, color:'#f5b04c', background:'rgba(245,158,11,0.12)', padding:'3px 8px', borderRadius:22, border:'0.5px solid rgba(245,158,11,0.22)', whiteSpace:'nowrap' }}>{ev.format}</span>
                      <input type="number" value={ev.weight||''} placeholder="кг" onChange={e=> setContest(c=> c ? { ...c, events: c.events.map((x,i)=> i===idx ? { ...x, weight: Number(e.target.value)||0 } : x)} : c)} style={{ width:72, minHeight:44, padding:'8px 6px', fontSize:14, fontWeight:700, background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.12)', borderRadius:10, color:'#fff', textAlign:'center', fontVariantNumeric:'tabular-nums' }} />
                      {(ev.id.includes('yoke')||ev.id.includes('farmers')||ev.id.includes('conan')||ev.id.includes('truck')||ev.id.includes('carry')||ev.id.includes('shield')||ev.id.includes('duck')) && <input type="number" value={ev.distanceM||''} placeholder="м" onChange={e=> setContest(c=> c ? { ...c, events: c.events.map((x,i)=> i===idx ? { ...x, distanceM: Number(e.target.value)||0 } : x)} : c)} style={{ width:60, minHeight:44, padding:'8px 6px', fontSize:14, fontWeight:700, background:'rgba(255,159,10,0.08)', border:'0.5px solid rgba(255,159,10,0.20)', borderRadius:10, color:'#fff', textAlign:'center', fontVariantNumeric:'tabular-nums' }} />}
                      <input type="number" value={ev.timeCapS||''} placeholder="capс" onChange={e=> setContest(c=> c ? { ...c, events: c.events.map((x,i)=> i===idx ? { ...x, timeCapS: Number(e.target.value)||0 } : x)} : c)} style={{ width:64, minHeight:44, padding:'8px 6px', fontSize:14, fontWeight:700, background:'rgba(59,130,246,0.08)', border:'0.5px solid rgba(59,130,246,0.20)', borderRadius:10, color:'#fff', textAlign:'center', fontVariantNumeric:'tabular-nums' }} />
                      <label style={{ display:'flex', gap:6, alignItems:'center', fontSize:12, fontWeight:600, color:'#fff', minHeight:44, cursor:'pointer' }}><input type="checkbox" checked={!!ev.turn} onChange={e=> setContest(c=> c ? { ...c, events: c.events.map((x,i)=> i===idx ? { ...x, turn: e.target.checked } : x)} : c)} style={{ width:20, height:20, accentColor:'#f59e0b' }} /> разв.</label>
                      <input type="number" value={ev.heightCm||''} placeholder="высота" onChange={e=> setContest(c=> c ? { ...c, events: c.events.map((x,i)=> i===idx ? { ...x, heightCm: Number(e.target.value)||0 } : x)} : c)} style={{ width:76, minHeight:44, padding:'8px 6px', fontSize:12, background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.12)', borderRadius:10, color:'#fff' }} />
                      {(ev.format==='ladder' || ev.id.includes('stone') || ev.id.includes('sandbag')) && <input type="text" value={(ev.ladderWeights||[]).join(',')} placeholder="100,110,120" onChange={e=> setContest(c=> c ? { ...c, events: c.events.map((x,i)=> i===idx ? { ...x, ladderWeights: e.target.value.split(',').map(v=> Number(v.trim())).filter(v=> v>0) } : x)} : c)} style={{ flex:1, minWidth:120, minHeight:44, padding:'8px', fontSize:12, background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.12)', borderRadius:10, color:'#fff' }} />}
                      <button onClick={()=> setContest(c=> c ? { ...c, events: c.events.filter((_,i)=> i!==idx)} : c)} style={{ width:44, height:44, borderRadius:12, background:'rgba(239,68,68,0.14)', border:'0.5px solid rgba(239,68,68,0.24)', color:'#fecaca', cursor:'pointer', fontSize:15, fontWeight:700 }}>✕</button>
                    </div>
                  ))}
                  <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                    <select onChange={e=> { const id=e.target.value; if(!id) return; setContest(c=> c ? { ...c, events: [...c.events, { id, format: (EVENT_META as any)[id]?.class === 'loading_race' ? 'loading_race' : (EVENT_META as any)[id]?.class === 'reps_60s' ? 'reps_60s' : 'max', weight: 100 } as any] } : { name:'Кастом', events:[{ id, format:'max', weight:100 } as any] }); e.target.value=''; }} style={{ ...SELECT, flex:1, minWidth:160 }}>
                      <option value="">＋ Добавить ивент…</option>
                      {Object.keys(EVENT_META).map(id=> <option key={id} value={id}>{(EVENT_META as any)[id]?.label || id}</option>)}
                    </select>
                  </div>
                  {contestSim && (
                    <div style={{ background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.22)', borderRadius:10, padding:'8px 10px', display:'flex', flexDirection:'column', gap:4 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b' }}>🏆 Симулятор: {contestSim.totalPoints} pts → {contestSim.predictedPlace} место из 10</div>
                      {contestSim.weakEvents.length>0 && <div style={{ fontSize:10, color:'#f59e0b' }}>Слабые: {contestSim.weakEvents.join(', ')} — объём ×1.15 на них</div>}
                    </div>
                  )}
                </div>
              )}
              {!contest && <InfoBanner tone="info">Без пакета — план generic. Выбери пресет для PRO-контеста.</InfoBanner>}
            </SectionCard>
          )}
          <div data-ss="split-list" style={{ display:'flex', flexDirection:'column', gap:8, opacity: cycleId ? 0.45 : 1 }}>
            <div style={{ fontSize:10, color:'#fff' }}>{cycleId ? 'Сплит перекрыт интернет-циклом (дни/недели из шаблона)' : 'Сплит для параметрического плана'}</div>
            {STRENGTH_SPORT_PATTERNS.filter(p => p.mode===mode || p.mode==='any').map(p => {
              const active = patternId ? patternId===p.id : p.id===recommendStrengthSportPattern(mode, days, level).id;
              const preview = p.schedule.map(s=> s.kind==='тренировка' ? (s.sessionTag||'тренировка').slice(0,4) : 'отд').join(' · ');
              return (
                <button key={p.id} onClick={()=> setPatternId(p.id)} style={{
                  textAlign:'left', padding:12, borderRadius:16, cursor:'pointer', transition:'all 0.18s ease', minHeight:72,
                  background: active ? (mode==='strongman' ? 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(239,68,68,0.10))' : 'linear-gradient(135deg, rgba(0,230,138,0.16), rgba(14,165,233,0.10))') : 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))',
                  border: active ? `1.5px solid ${modeColor}55` : '1px solid rgba(255,255,255,0.07)', color:'#fff', fontSize:12,
                  boxShadow: active ? `0 8px 24px ${modeColor}1F, inset 0 1px 0 rgba(255,255,255,0.09)` : '0 4px 12px rgba(0,0,0,0.14)', backdropFilter:'blur(12px)'
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}><b style={{ fontSize:15, color: active? '#fff':'#fff' }}>{p.name}</b><span style={{ fontSize:12, fontWeight:800, color: active? modeColor : '#fff', background: active?`${modeColor}1F`:'rgba(255,255,255,0.06)', padding:'5px 12px', borderRadius:22, border:`1px solid ${active?`${modeColor}33`:'rgba(255,255,255,0.07)'}`}}>{p.sessionsPerRotation}×/нед</span></div>
                  <div style={{ fontSize:13, color:'#fff', marginTop:6, lineHeight:1.5 }}>{p.description}</div>
                  <div style={{ fontSize:12, color:'#fff', marginTop:8, fontFamily:'ui-monospace, monospace', background:'rgba(0,0,0,0.18)', padding:'8px 10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.05)' }}>{preview}</div>
                  {active && <div style={{ fontSize:12, color:modeColor, fontWeight:800, marginTop:10, display:'flex', alignItems:'center', gap:8 }}><span style={{ width:8, height:8, borderRadius:'50%', background:modeColor, boxShadow:`0 0 10px ${modeColor}`}} /> Выбран — {p.schedule.filter(s=>s.kind==='тренировка').map(s=> s.sessionTag).join(', ')}</div>}
                </button>
              );
            })}
          </div>
          {mode==='strongman' && (
            <EventCard
              title="Medley превью — до сборки"
              subtitle="Настрой дистанции/cap до генерации — 90с переход, cap 180с в плане"
              events={medleyPreview.map(e=> ({ id:e.id, label:e.label, distanceM:e.distanceM, timeCapS:e.timeCapS }))}
              onChange={(id,patch)=> setMedleyPreview(prev=> prev.map(p=> p.id===id ? { ...p, ...patch } : p))}
              preview
            />
          )}
          <button data-ss="build" onClick={build} disabled={building} style={{ ...(mode==='strongman'?BTN_STRONG:BTN_PRIMARY), width:'100%', padding:'18px 22px', fontSize:17, borderRadius:18, opacity: building?0.6:1 }}>✦ Собрать план {cycleId ? `· 📚 ${cycleId} (${cycleMode==='faithful'?'дословно':'adapt'})` : patternId ? `· ${patternId}` : ''}</button>
          {building && <div role="status" style={{ fontSize:13, fontWeight:700, color:TEXT_2, textAlign:'center', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', padding:'10px 12px', borderRadius:12 }}>⏳ {buildStage}</div>}
          <div data-ss="wizard-nav" style={{ display:'flex', gap:8 }}>
            <button onClick={() => setStep('outside')} style={{ ...BTN, flex:1 }}>← Назад</button>
          </div>
        </div>
      )}

      {step === 'quality' && (
        <div className="ss-pane" data-pane="quality" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionCard icon="🎯" title="Слабые точки" subtitle="Объём ×1.15 на выбранные зоны" summary={weakPoints.length ? `Выбрано: ${weakPoints.length}/2` : 'не выбраны — план сбалансирован'} status={weakPoints.length ? 'ok' : undefined}>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {Object.entries(WL_WEAKPOINT_LABELS).slice(0,8).map(([k,label])=> (
                <ChipToggle key={k} active={weakPoints.includes(k)} onClick={()=> setWeakPoints(s=> s.includes(k)? s.filter(x=>x!==k): s.length>=2?s:[...s,k])}>{label}</ChipToggle>
              ))}
            </div>
            {diagnosticLevel ? <InfoBanner tone={diagnosticLevel==='critical'?'warn':'info'}>Уровень диагностики из хаба: <Highlight>{diagnosticLevel}</Highlight>{diagnosticLevel==='critical' ? ' — объём ×0.85, RIR+1 на сборке' : ''}</InfoBanner> : <InfoBanner tone="info">Диагностика не подключена — инъекции коррекций выключены, план параметрический.</InfoBanner>}
            {acwr && <InfoBanner tone={acwr.zone==='dangerous'?'warn': acwr.zone==='caution'?'warn':'info'}><Highlight color={acwr.zone==='dangerous'?'#ff3b30':acwr.zone==='caution'?'#ff9f0a':'#30d158'}>ACWR {acwr.ratio}</Highlight> · {ruLabel(ZONE_RU, acwr.zone)}</InfoBanner>}
            {contestSim && mode==='strongman' && (
              <div style={{ background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.22)', borderRadius:10, padding:'8px 10px', display:'flex', flexDirection:'column', gap:4 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b' }}>🏆 Симулятор: {contestSim.totalPoints} pts → прогноз {contestSim.predictedPlace} место из 10</div>
                {contestSim.weakEvents.length>0 && <div style={{ fontSize:10, color:'#f59e0b' }}>Слабые: {contestSim.weakEvents.join(', ')} — объём ×1.15 на них</div>}
              </div>
            )}
          </SectionCard>

          <SectionCard icon="🛡️" title="Оборудование и здоровье" subtitle="Ограничения фильтруют пул и темп" collapsible defaultOpen={false} summary={injuries.length ? `Травмы: ${injuries.length}` : equipment.length ? `Инвентарь: ${equipment.length}` : 'всё доступно'} status={injuries.length ? 'warn' : (equipment.length || mobility.length) ? 'ok' : undefined}>
            <GroupHeading icon="🏋️" text="Доступное оборудование" desc="Пусто — доступно всё; выбор фильтрует пул" />
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {(['barbell','dumbbell','machine','cable','other'] as const).map(eq => (
                <ChipToggle key={eq} active={equipment.includes(eq)} onClick={()=> setEquipment(s=> s.includes(eq)? s.filter(x=>x!==eq): [...s,eq])}>{(EQUIP_RU as any)[eq] || eq}</ChipToggle>
              ))}
            </div>
            <Divider />
            <GroupHeading icon="🩹" text="Травмы — щадящий режим" desc="Снижает вес ×0.6 и RIR+1, прячет осевые" />
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <input value={injInput} onChange={e=> setInjInput(e.target.value)} placeholder="напр.: колено, плечо" style={{ ...INPUT, flex:1, minWidth:160 }} />
              <button onClick={() => { const parts = injInput.split(',').map(s=> s.trim()).filter(Boolean); setInjuries(parts.map(p=> ({ location: p, type: 'joint' }))); setMsg(parts.length? '✦ Травмы применены':'Список очищен'); setTimeout(()=>setMsg(''),1800); }} style={BTN_SMALL}>Применить</button>
            </div>
            {injuries.length>0 && <InfoBanner tone="warn"><Highlight color="#ff9f0a">Щадящий</Highlight>: {injuries.map((j:any)=> j.location).join(', ')} — вес ×0.6–0.7, RIR+1</InfoBanner>}
            <Divider />
            <GroupHeading icon="🤸" text="Мобильность" desc="Фильтрует глубокие амплитуды" />
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {(['shoulder','hip','knee','ankle','wrist','lower_back'] as const).map(m => (
                <ChipToggle key={m} active={mobility.includes(m)} onClick={()=> setMobility(s=> s.includes(m)? s.filter(x=> x!==m): [...s,m])}>{(MOBILITY_RU as any)[m]}</ChipToggle>
              ))}
            </div>
          </SectionCard>

          {renderNavRow('plan', 'export')}
        </div>
      )}

      {step === 'export' && (
        <div className="ss-pane" data-pane="export" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!plan && !annual && (
            <SectionCard icon="📤" title="Пока пусто" subtitle="Соберите план — откроются файлы, печать и год">
              <div style={{ fontSize:14, color:'#fff', textAlign:'center', lineHeight:1.55 }}>Выдача строится после сборки плана на шаге «5 План».</div>
              {renderNavRow('quality', null)}
            </SectionCard>
          )}
          {(plan || annual) && (
            <SectionCard icon="📤" title="Экспорт и шаринг" subtitle={plan ? `${plan.weeks}нед · ${plan.patternId}` : `${(annual as any)?.totalWeeks ?? 0}нед год`} summary={qualitySummary}>
              {plan && (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px,1fr))', gap:8 }}>
                    <button onClick={() => { const txt = buildStrengthSportReport(plan); navigator.clipboard?.writeText(txt); setMsg('Скопировано'); setTimeout(()=>setMsg(''),1800); }} style={BTN}>⎙ Копировать</button>
                    <button onClick={() => { const html = buildStrengthPrintHtml(plan); const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); } setMsg('Печать'); }} style={BTN}>🖨 Печать</button>
                    <button onClick={()=> { const d=shareStrengthDigest(plan); navigator.clipboard?.writeText(d); setMsg('Дайджест'); }} style={BTN}>📋 Дайджест</button>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px,1fr))', gap:8 }}>
                    <button onClick={() => { downloadStrengthCsv(plan); setMsg('CSV'); }} style={BTN}>📊 CSV</button>
                    <button onClick={() => { downloadStrengthXlsx(plan); setMsg('XLS'); }} style={{ ...BTN, background:'rgba(48,209,88,0.12)', color:'#30d158', border:'0.5px solid rgba(48,209,88,0.20)' }}>📗 XLSX</button>
                    <button onClick={() => { downloadStrengthIcs(plan, (plan as any).inputSnapshot?.startDate); setMsg('ICS'); }} style={BTN}>📅 План .ics</button>
                    <button onClick={exportToUserProgram} style={BTN_PRIMARY}>✦ В программу</button>
                  </div>
                  <Divider />
                </>
              )}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button onClick={handleBuildAnnualFromCycles} style={{ ...BTN_SMALL, background:'linear-gradient(135deg, #0A84FF, #30D158)', color:'#fff', border:'none' }}>📚 Год из циклов ({annualCycleSel?.length || 3})</button>
                <button onClick={handleBuildSeason} style={{ ...BTN_SMALL, background:'linear-gradient(135deg, #f59e0b, #ef4444)', color:'#fff', border:'none' }}>✦ Сезон 2 пика</button>
              </div>
              {annual && <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}><span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>Год: {annual.totalWeeks}нед · {annual.blocks.length} блоков</span></div>}
              {renderNavRow('quality', 'plan', 'К плану →')}
            </SectionCard>
          )}
        </div>
      )}

      {step === 'plan' && plan && (
        <StrengthSportPlanView
          plan={plan}
          mode={mode}
          modeColor={modeColor}
          days={days}
          bodyweight={bodyweight}
          sex={sex}
          outside={outside}
          outsideMetrics={outsideMetrics}
          vbtMap={vbtMap}
          onVbtMap={(k, v) => setVbtMap(m => ({ ...m, [k]: v }))}
          expandedWeek={expandedWeek}
          onToggleWeek={(w) => setExpandedWeek(w)}
          onUpdateEx={updateEx}
          onUpdateSet={updateSet}
          onMoveEx={moveEx}
          onMedleyChange={handleMedleyChange}
          annual={annual}
          onAnnualChange={(ann) => { try { saveAnnualSS(ann); } catch {} setAnnual(ann); }}
          annualCycleSel={annualCycleSel}
          onAnnualCycleSel={setAnnualCycleSel}
          rankedCycles={rankedCycles}
          msg={msg}
          setMsg={setMsg}
          onExportProgram={exportToUserProgram}
          onBuildSeason={handleBuildSeason}
          onBuildAnnualFromCycles={handleBuildAnnualFromCycles}
        />
      )}
      {step === 'plan' && plan && renderNavRow('split', 'quality')}
      {step === 'plan' && !plan && (
        <SectionCard icon="📋" title="Плана пока нет" subtitle="Здесь появятся сводка, гант, попытки и недели">
          <div style={{ textAlign:'center', fontSize:44, lineHeight:1, padding:'8px 0 4px' }} aria-hidden="true">📋</div>
          <div style={{ fontSize:14, color:TEXT_2, textAlign:'center', lineHeight:1.55 }}>Выбери сплит и нажми «Собрать план» — выдача строится под режим, цель и слабые зоны.</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={() => setStep('split')} style={{ ...BTN, flex:1 }}>← К сплиту</button>
            <button data-ss="build" onClick={build} disabled={building} style={{ ...(mode==='strongman'?BTN_STRONG:BTN_PRIMARY), flex:1.4, opacity: building?0.6:1 }}>✦ Собрать план</button>
          </div>
          {building && <div role="status" style={{ fontSize:13, fontWeight:700, color:TEXT_2, textAlign:'center', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', padding:'10px 12px', borderRadius:12 }}>⏳ {buildStage}</div>}
        </SectionCard>
      )}
    </div>
  );
};

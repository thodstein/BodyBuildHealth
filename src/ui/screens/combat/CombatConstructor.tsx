/**
 * CombatConstructor.tsx — изолированный PRO-конструктор для единоборств.
 * Премиальное оформление: стекло, градиенты, мягкие тени, современный мобильный стиль.
 */
import React from 'react';
import { buildCombatPlan } from '../../../engines/combat/combat-builder.engine';
import { finalizeCombatPlan, buildCombatReport } from '../../../engines/combat/combat-finalize.engine';
import { COMBAT_PATTERNS, recommendCombatPattern } from '../../../engines/combat/combat-split-patterns';
import type { OutsideLoad } from '../../../engines/outside-load.engine';
import { saveCombatPlan, loadCombatPlans } from '../../../engines/combat/combat-storage';
import { applyCombatMesocycle } from '../../../engines/combat/combat-mesocycle';
import { buildAnnualFromCB, buildAnnualATR, saveAnnualCB, loadAnnualCB, buildAnnualPrintHtml, buildAnnualIcs, addCompetitionToAnnual } from '../../../engines/combat/combat-annual';
import { buildCombatPrintHtml, downloadCombatCsv, buildCombatPlanIcs } from '../../../engines/combat/combat-print.engine';
import { saveUserProgram } from '../../../engines/user-program/program-store';
import type { CombatInput, CombatPlan } from '../../../engines/combat/combat.types';
import { getCombat } from '../../../engines/combat/combat-volume';
import { buildWeightCutProtocol } from '../../../engines/combat/combat-weight-cut.engine';
import { combatToNutritionPayload, combatToCardioPayload } from '../../../engines/combat/combat-integration.engine';
import { CB_STRICT_GROUPS, cbStrictGroupFor } from '../../../engines/combat/combat-selection';
import { diagnoseVelocityLossCombat } from '../../../engines/combat/combat-vbt.engine';
import { getDiaryTrendCB } from '../../../engines/combat/combat-diary.engine';
import { useCombatWizard } from './useCombatWizard';
import {
  CARD, CARD_ACCENT, CARD_HERO, ROW, COL, LABEL, HINT, HINT_SM, BTN, BTN_PRIMARY, BTN_SMALL, BTN_GHOST,
  INPUT, SELECT, CHIP, CHIP_ACTIVE, PHASE_COLOR, DISCIPLINE_COLOR, ACCENT, ACCENT_GRAD,
  SectionCard, StatTile, Badge, InfoBanner, GroupHeading, SectionNav, ProgressBar, Stepper, ChipToggle, Field, Divider, CardHeader,
  EQUIP_RU, MOBILITY_RU, LEVEL_RU, PHASE_RU, ZONE_RU, PERIODIZATION_RU, SESSION_TAG_RU, ruLabel,
} from './CombatUI';
import { CombatPlanView } from './CombatPlanView';

type Step = 'params' | 'outside' | 'split' | 'plan';
const STEP_LABEL_RU: Record<Step, string> = { params: 'Параметры', outside: 'Вне зала', split: 'Сплит', plan: 'План' };
const WM_LABEL_RU: Record<string, string> = { bench: 'Жим лёжа', squat: 'Присед', deadlift: 'Тяга', chest: 'Грудь', back: 'Спина', quads: 'Квадрицепс', hamstrings: 'Бицепс бедра', shoulders: 'Плечи' };

const rangeStyle: React.CSSProperties = {
  width: '100%', height: 6, borderRadius: 999, appearance: 'none' as any, WebkitAppearance: 'none' as any,
  background: 'rgba(255,255,255,0.08)', outline: 'none', cursor: 'pointer',
};

export const CombatConstructor: React.FC = () => {
  const {
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
  } = useCombatWizard();

  const pullFromProfile = () => {
    try {
      const raw = localStorage.getItem('he_profile_v2');
      if (!raw) return;
      const p = JSON.parse(raw);
      const personal = p.personal || {};
      const training = p.training || p;
      const lifestyle = p.lifestyle || {};
      const health = p.health || {};
      if (training.level) setLevel(training.level);
      else if (personal.level) setLevel(personal.level);
      if (personal.sex) setSex(personal.sex === 'female' ? 'female' : 'male');
      if (typeof personal.weight === 'number') setBodyweight(personal.weight);
      else if (typeof personal.bodyweight === 'number') setBodyweight(personal.bodyweight);
      if (typeof personal.age === 'number') setAge(personal.age);
      const wm: Record<string, number> = {};
      if (training.workMax) Object.assign(wm, training.workMax);
      if (personal.workMax) Object.assign(wm, personal.workMax);
      if (Object.keys(wm).length) setWorkMax(s => ({ ...s, ...wm }));
      if (training.workMaxByExercise || personal.workMaxByExercise) {
        const exBy = training.workMaxByExercise || personal.workMaxByExercise;
        if (exBy && typeof exBy === 'object') {
          const direct: Record<string, number> = {};
          for (const [k, v] of Object.entries(exBy as Record<string, number>)) if (typeof v === 'number' && v > 0) direct[k] = v;
          if (Object.keys(direct).length) setWorkMaxByExercise(direct);
        }
        const map: Record<string, string> = { bench_bar: 'bench', squat: 'squat', front_squat: 'squat', row_bar: 'back', ohp: 'shoulders' };
        for (const [k, v] of Object.entries((training.workMaxByExercise || personal.workMaxByExercise) as Record<string, number>)) {
          const g = map[k];
          if (g && typeof v === 'number' && v > 0) wm[g] = v;
        }
        if (Object.keys(wm).length) setWorkMax(s => ({ ...s, ...wm }));
      }
      if (Array.isArray(health.injuries)) setInjuries(health.injuries);
      else if (Array.isArray(training.injuries)) setInjuries(training.injuries);
      if (Array.isArray(training.equipment)) setEquipment(training.equipment);
      else if (Array.isArray(personal.equipment)) setEquipment(personal.equipment);
      if (Array.isArray(health.mobilityRestrictions)) setMobility(health.mobilityRestrictions);
      else if (Array.isArray(training.mobilityRestrictions)) setMobility(training.mobilityRestrictions);
      else if (Array.isArray(p.health?.mobilityRestrictions)) setMobility(p.health.mobilityRestrictions);
      setMsg('✦ Профиль подтянут');
      setTimeout(() => setMsg(''), 2600);
    } catch {}
  };

  const build = () => {
    let extra: any = {};
    try {
      const raw = localStorage.getItem('he_profile_v2');
      if (raw) {
        const p = JSON.parse(raw);
        const personal = p.personal || {};
        const lifestyle = p.lifestyle || {};
        const ph = p.pharma || {};
        extra.bodyFat = typeof personal.bodyFat === 'number' ? personal.bodyFat : undefined;
        extra.leanMass = typeof personal.bodyFat === 'number' && typeof personal.weight === 'number' ? Math.round(personal.weight * (1 - personal.bodyFat / 100)) : undefined;
        extra.hrvMs = typeof lifestyle.morningHRV === 'number' ? lifestyle.morningHRV : typeof lifestyle.hrvMs === 'number' ? lifestyle.hrvMs : undefined;
        extra.sleepHours = typeof lifestyle.sleepHours === 'number' ? lifestyle.sleepHours : undefined;
        extra.stressLevel = typeof lifestyle.stressLevel === 'number' ? lifestyle.stressLevel : undefined;
        extra.calorieSurplus = typeof p.nutrition?.calorieSurplus === 'number' ? p.nutrition.calorieSurplus : undefined;
        extra.proteinPerKg = typeof p.nutrition?.proteinPerKg === 'number' ? p.nutrition.proteinPerKg : undefined;
        if (Array.isArray(ph.currentSubstances) && ph.currentSubstances.length) extra.peds = ph.currentSubstances;
        extra.labMrvMultiplier = typeof p.labs?.mrvMultiplier === 'number' ? p.labs.mrvMultiplier : undefined;
      }
    } catch {}
    const wcProtocol = weightCut > 0 ? buildWeightCutProtocol(weightCut, { startWeightKg: bodyweight, waterMode, sodiumMode, carbMode, heatSessions } as any) : null;
    const sparringLoad = sparringEnabled ? { hardSparSessions: sparringHard, techSparSessions: sparringTech, wrestlingSessions: sparringWrest } as any : null;
    let effectiveLoss: number | null = velocityLoss > 0 ? velocityLoss : null;
    if (vbtBest > 0 && vbtLast > 0) {
      try { const d = diagnoseVelocityLossCombat(vbtBest, vbtLast, 20); effectiveLoss = d.lossPct; } catch {}
    }
    let input: CombatInput = {
      discipline, goal, level, weeks, daysPerWeek: days,
      weightCutKg: weightCut, weightCutProtocol: wcProtocol as any, methodology, dupMode, intensityTech,
      periodizationModel: periodizationModel as any, conditioningMode: conditioningMode as any,
      fightDate: fightDate || null, taperWeeks: fightDate ? taperWeeks : undefined, startDate,
      bodyweight, sex, age,
      workMax: workMax as any,
      workMaxByExercise: Object.keys(workMaxByExercise).length ? workMaxByExercise as any : undefined,
      acwr: acwr as any, velocityLossPct: effectiveLoss,
      outsideLoad: outsideEnabled && !sparringEnabled ? outside : null,
      sparringLoad,
      fightStyle: fightStyle as any,
      avoidAxialLoad: avoidAxialLoad as any,
      equipment, injuries, mobilityRestrictions: mobility as any,
      patternId: patternId || undefined,
      ...extra,
    } as any;
    try { const prev = loadCombatPlans()[0]; if (prev) input = applyCombatMesocycle(prev, input) as any; } catch {}
    let p = buildCombatPlan(input);
    p = finalizeCombatPlan(p);
    setPlan(p);
    saveCombatPlan(p);
    try {
      const nut = combatToNutritionPayload(p);
      localStorage.setItem('he_combat_nutrition_payload', JSON.stringify({ planId: p.id, ...nut, bodyweight, discipline, goal }));
      const cardio = combatToCardioPayload(p);
      if (cardio) localStorage.setItem('he_combat_cardio_payload', JSON.stringify({ planId: p.id, ...cardio }));
      window.dispatchEvent(new CustomEvent('he-combat-updated', { detail: { planId: p.id, nutrition: nut, cardio } }));
    } catch {}
    try { const hist = loadCombatPlans().slice(0, 6); const ann = buildAnnualFromCB(hist); saveAnnualCB(ann); setAnnual(ann); } catch {}
    setMsg('✦ План собран · ' + (periodizationModel || 'atr_10') + (fightDate ? ' · тапер к бою' : '') + (wcProtocol ? ' · весогонка ' + wcProtocol.targetLossKg + 'кг' : ''));
    setTimeout(() => setMsg(''), 3000);
    setStep('plan');
  };

  const pushHistory = (p: CombatPlan) => setHistory(h => [...h.slice(-9), JSON.parse(JSON.stringify(p))]);
  const undo = () => {
    setHistory(h => {
      if (h.length === 0) { setMsg('История пуста'); setTimeout(() => setMsg(''), 1800); return h; }
      const prev = h[h.length - 1];
      const rest = h.slice(0, -1);
      setPlan(prev);
      try { saveCombatPlan(prev); } catch {}
      setMsg('↩ Отменено'); setTimeout(() => setMsg(''), 1800);
      return rest;
    });
  };
  const updateEx = (wkIdx: number, day: number, exId: string, patch: Partial<{ weight: number; reps: string; rir: number }>) => {
    setPlan(prev => {
      if (!prev) return prev;
      pushHistory(prev);
      const copy: CombatPlan = JSON.parse(JSON.stringify(prev));
      const wk = copy.weeksData[wkIdx];
      if (!wk) return prev;
      const sess = wk.sessions.find(s => s.day === day);
      if (!sess) return prev;
      const ex = sess.exercises.find(e => e.id === exId);
      if (!ex) return prev;
      if (patch.weight != null) { if (patch.weight < 0 || patch.weight > 500) { setMsg('Вес 0–500'); setTimeout(() => setMsg(''), 1800); return prev; } ex.weight = patch.weight; ex.workSets = ex.workSets.map(s => ({ ...s, weight: patch.weight! })); }
      if (patch.reps != null) {
        const raw = patch.reps.trim();
        ex.reps = raw;
        if (/с|c/i.test(raw)) {
        } else {
          const parts = raw.split('-').map(n => parseInt(n, 10));
          const a = parts[0]; const b = parts[1];
          const avg = Number.isFinite(a) && Number.isFinite(b) ? Math.round((a + b) / 2) : (Number.isFinite(a) ? a : 5);
          ex.workSets = ex.workSets.map(s => ({ ...s, reps: avg }));
        }
      }
      if (patch.rir != null) { if (patch.rir < 0 || patch.rir > 5) { setMsg('RIR 0–5'); setTimeout(() => setMsg(''), 1800); return prev; } ex.rir = patch.rir; ex.workSets = ex.workSets.map(s => ({ ...s, rir: patch.rir! })); }
      saveCombatPlan(copy);
      return copy;
    });
  };
  const moveEx = (wkIdx: number, day: number, exId: string, dir: -1 | 1) => {
    setPlan(prev => {
      if (!prev) return prev;
      pushHistory(prev);
      const copy: CombatPlan = JSON.parse(JSON.stringify(prev));
      const sess = copy.weeksData[wkIdx]?.sessions.find(s => s.day === day);
      if (!sess) return prev;
      const idx = sess.exercises.findIndex(e => e.id === exId);
      if (idx < 0) return prev;
      const nIdx = idx + dir;
      if (nIdx < 0 || nIdx >= sess.exercises.length) return prev;
      const tmp = sess.exercises[idx];
      sess.exercises[idx] = sess.exercises[nIdx];
      sess.exercises[nIdx] = tmp;
      saveCombatPlan(copy);
      return copy;
    });
  };
  const swapEx = (wkIdx: number, day: number, exId: string, newId: string) => {
    setPlan(prev => {
      if (!prev) return prev;
      const metaMap: Record<string, { name: string; group: string; pattern: string }> = {
        bench_bar: { name: 'Жим лёжа', group: 'chest', pattern: 'horizontal_push' }, row_bar: { name: 'Тяга штанги', group: 'back', pattern: 'horizontal_pull' }, ohp: { name: 'Жим стоя', group: 'shoulders', pattern: 'vertical_push' }, pullup: { name: 'Подтягивания', group: 'back', pattern: 'vertical_pull' }, neck_harness_ext: { name: 'Шея с упряжью', group: 'neck', pattern: 'isolation' }, neck_lateral_flex: { name: 'Шея боковая', group: 'neck', pattern: 'isolation' }, neck_bridge_wrestler: { name: 'Борцовский мост', group: 'neck', pattern: 'isolation' }, neck_flexion: { name: 'Шея сгибание', group: 'neck', pattern: 'isolation' }, neck_rotation: { name: 'Шея ротация', group: 'neck', pattern: 'isolation' }, gi_grip_pullup: { name: 'Подтягивания на кимоно', group: 'back', pattern: 'vertical_pull' }, face_pull: { name: 'Тяга к лицу', group: 'shoulders', pattern: 'isolation' }, squat: { name: 'Присед', group: 'legs', pattern: 'squat' }, front_squat: { name: 'Фронт-присед', group: 'legs', pattern: 'squat' }, rdl: { name: 'Румынская тяга', group: 'legs', pattern: 'hinge' }, bulgarian_split_heavy: { name: 'Болгарский тяжёлый', group: 'legs', pattern: 'lunge' }, single_leg_rdl_combat: { name: 'Румынка на одной', group: 'legs', pattern: 'hinge' }, cossack_squat: { name: 'Казачий присед', group: 'legs', pattern: 'squat' }, calf_raise: { name: 'Подъёмы на носки', group: 'legs', pattern: 'isolation' }, plate_pinch: { name: 'Щипок блинов', group: 'grip', pattern: 'isolation' }, landmine_rotation: { name: 'Лэндмайн ротация', group: 'core', pattern: 'rotation' }, landmine_180: { name: 'Лэндмайн 180', group: 'core', pattern: 'rotation' }, pallof_rotation_press: { name: 'Паллоф+ротация', group: 'core', pattern: 'anti_rotation' }, suitcase_carry: { name: 'Чемодан', group: 'core', pattern: 'carry' }, med_ball_throw: { name: 'Медбол бросок', group: 'core', pattern: 'plyo' }, wrist_roller: { name: 'Валик', group: 'grip', pattern: 'isolation' }, hang_clean: { name: 'Взятие с виса', group: 'legs', pattern: 'oly' }, high_pull: { name: 'Высокая тяга', group: 'back', pattern: 'oly' }, push_press: { name: 'Жимовой швунг', group: 'shoulders', pattern: 'vertical_push' }, trap_bar_dead: { name: 'Трэп-тяга', group: 'legs', pattern: 'hinge' },
      };
      const meta = metaMap[newId] || { name: newId, group: 'core', pattern: 'unknown' };
      pushHistory(prev);
      const copy: CombatPlan = JSON.parse(JSON.stringify(prev));
      const sess = copy.weeksData[wkIdx]?.sessions.find(s => s.day === day);
      if (!sess) return prev;
      const ex = sess.exercises.find(e => e.id === exId);
      if (!ex) return prev;
      ex.id = newId;
      ex.name = meta.name;
      ex.group = meta.group;
      ex.pattern = meta.pattern;
      saveCombatPlan(copy);
      setMsg(`↻ Заменено: ${newId}`); setTimeout(() => setMsg(''), 1800);
      return copy;
    });
  };

  const exportToUserProgram = () => {
    if (!plan) return;
    const prog: any = {
      id: plan.id,
      meta: { id: plan.id, title: `Единоборства ${plan.discipline} ${plan.weeks}нед`, direction: 'combat', createdAt: new Date().toISOString(), source: 'combat', discipline: plan.discipline, level: plan.level, methodology: plan.inputSnapshot?.methodology, dupMode: (plan.inputSnapshot as any)?.dupMode, intensityTech: (plan.inputSnapshot as any)?.intensityTech, periodizationModel: (plan.inputSnapshot as any)?.periodizationModel, fightDate: (plan.inputSnapshot as any)?.fightDate },
      weeks: plan.weeksData.map(w => ({ week: w.week, phase: w.phase, deload: w.deload, taper: (w as any).taper, sessions: w.sessions.map(s => ({ day: s.day, tag: s.sessionTag, character: s.character, exercises: s.exercises.map(e => ({ id: e.id, name: e.name, sets: e.sets, reps: e.reps, weight: e.weight, rir: e.rir, tempo: e.tempo, restSeconds: e.restSeconds, technique: (e as any).technique, warmupSets: e.warmupSets, workSets: e.workSets })) })) })),
      outside: plan.outsideMetrics,
      conditioning: (plan as any).conditioning,
      validation: plan.validation,
    };
    try { saveUserProgram(prog); setMsg('✦ Экспортировано в библиотеку'); setTimeout(() => setMsg(''), 2200); } catch {}
    try { localStorage.setItem('he_last_combat_program', JSON.stringify(prog)); } catch {}
    try { navigator.clipboard?.writeText(JSON.stringify(prog, null, 2)); } catch {}
  };

  const handleBuildATR = () => {
    const ann = buildAnnualATR(discipline as any, annualWeeks, startDate || null);
    saveAnnualCB(ann); setAnnual(ann); setMsg(`✦ Годовой ATR ${annualWeeks} нед построен`); setTimeout(() => setMsg(''), 2200);
  };
  const handleAddCompetition = () => {
    if (!annual || !competitionName || !competitionDate) { setMsg('Укажите название и дату боя'); setTimeout(() => setMsg(''), 1800); return; }
    const ann = loadAnnualCB();
    if (!ann) return;
    const next = addCompetitionToAnnual(ann, { id: `comp_${Date.now()}`, name: competitionName, date: competitionDate, weightClass: competitionWeight || undefined } as any, startDate || null);
    saveAnnualCB(next); setAnnual(next); setMsg('✦ Бой добавлен'); setTimeout(() => setMsg(''), 1800);
    setCompetitionName(''); setCompetitionDate(''); setCompetitionWeight('');
  };
  const handlePrintAnnual = () => {
    if (!annual) return;
    const html = buildAnnualPrintHtml(annual);
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); } else { navigator.clipboard?.writeText(html); setMsg('HTML скопирован'); }
  };
  const handleDownloadIcs = () => {
    if (!annual) return;
    const ics = buildAnnualIcs(annual, startDate || null);
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `combat-annual-${annual.totalWeeks}w.ics`; a.click(); URL.revokeObjectURL(url);
  };

  const stepIndex = (['params', 'outside', 'split', 'plan'] as Step[]).indexOf(step) + 1;

  // modern select wrapper with chevron
  const SelectWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{ position: 'relative' }}>
      {children}
      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(255,255,255,0.42)', fontSize: 12 }}>▾</span>
    </div>
  );

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 860, margin: '0 auto' }}>
      <style>{`input[type="range"]{ -webkit-appearance:none; appearance:none; height:6px; border-radius:999px; background:rgba(255,255,255,0.08); }
        input[type="range"]::-webkit-slider-thumb{ -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:linear-gradient(135deg,#a855f7,#ec4899); border:2px solid #fff; box-shadow:0 2px 10px rgba(168,85,247,0.42); cursor:pointer; }
        input[type="range"]::-moz-range-thumb{ width:18px; height:18px; border-radius:50%; background:linear-gradient(135deg,#a855f7,#ec4899); border:2px solid #fff; box-shadow:0 2px 10px rgba(168,85,247,0.42); cursor:pointer; }
        input[type="date"]{ color-scheme: dark; }
      `}</style>

      {/* HERO */}
      <div style={CARD_HERO}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.18), transparent 70%)', filter: 'blur(2px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, left: 50, width: 220, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.10), transparent 70%)', filter: 'blur(2px)', pointerEvents: 'none' }} />
        <div style={ROW}>
          <span style={{
            width: 44, height: 44, borderRadius: 13, background: ACCENT_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, boxShadow: '0 6px 18px rgba(168,85,247,0.32), inset 0 1px 0 rgba(255,255,255,0.22)', flexShrink: 0,
          }}>🥊</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1.05, letterSpacing: -0.3 }}>Единоборства — PRO силовая</div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.58)', lineHeight: 1.35, marginTop: 2 }}>ATR 5/3/2 · кондиция 3 системы · тапер к дате · весогонка ISSN · спарринг · годовой</div>
          </div>
          <Badge color="#fff" bg="linear-gradient(135deg, rgba(168,85,247,0.28), rgba(236,72,153,0.22))" border="rgba(255,255,255,0.14)">{stepIndex}/4 · {STEP_LABEL_RU[step]}</Badge>
        </div>

        <ProgressBar value={stepIndex} max={4} color={ACCENT} height={8} />

        <SectionNav
          activeId={step}
          onSelect={(id) => setStep(id as Step)}
          items={[
            { id: 'params', label: '⚙️ Параметры' },
            { id: 'outside', label: '🥋 Вне зала' },
            { id: 'split', label: '🧩 Сплит' },
            { id: 'plan', label: '📋 План' },
          ]}
        />

        <div style={{ ...ROW, justifyContent: 'space-between', gap: 8 }}>
          <div style={ROW}>
            {plan && <Badge color="#fff" bg="rgba(168,85,247,0.16)" border="rgba(168,85,247,0.30)" icon="📋">План {plan.weeks}нед · {plan.patternId}</Badge>}
            {outsideMetrics && <Badge color="#c4b5fd" bg="rgba(168,85,247,0.10)" border="rgba(168,85,247,0.18)" icon="🥋">Вне зала ×{outsideMetrics.volumeMultiplier}</Badge>}
            {acwr && (
              <Badge
                color={acwr.zone === 'dangerous' ? '#fecaca' : acwr.zone === 'caution' ? '#fde68a' : '#d8b4fe'}
                bg={acwr.zone === 'dangerous' ? 'rgba(239,68,68,0.14)' : acwr.zone === 'caution' ? 'rgba(245,158,11,0.12)' : 'rgba(168,85,247,0.12)'}
                border={acwr.zone === 'dangerous' ? 'rgba(239,68,68,0.28)' : acwr.zone === 'caution' ? 'rgba(245,158,11,0.24)' : 'rgba(168,85,247,0.22)'}
              >
                ACWR {acwr.ratio} · {ruLabel(ZONE_RU, acwr.zone)}
              </Badge>
            )}
          </div>
          {msg && (
            <span style={{
              fontSize: 11.5, fontWeight: 750, color: '#fff', background: 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(236,72,153,0.14))',
              border: '1px solid rgba(255,255,255,0.10)', padding: '6px 12px', borderRadius: 20, backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)', animation: 'fadeInUp 0.22s ease',
            }}>{msg}</span>
          )}
        </div>
      </div>

      {step === 'params' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Дисциплина + Цель */}
          <SectionCard icon="🎯" title="Дисциплина и цель" subtitle="Подбирает акценты: шея/хват/ротация">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Дисциплина">
                <SelectWrap><select value={discipline} onChange={e => setDiscipline(e.target.value as any)} style={SELECT}>
                  <option value="boxing">🥊 Бокс — шея / кор / ротация</option>
                  <option value="mma">🥋 ММА — шея / хват / тяга</option>
                  <option value="wrestling">🤼 Борьба — шея / хват ×1.3</option>
                  <option value="kickboxing">🦵 Кикбоксинг — ноги / ротация</option>
                  <option value="general">🏋️ Общая</option>
                </select></SelectWrap>
              </Field>
              <Field label="Цель зала">
                <SelectWrap><select value={goal} onChange={e => setGoal(e.target.value as any)} style={SELECT}>
                  <option value="power">⚡ Взрывная сила</option>
                  <option value="endurance">🔥 Силовая выносливость</option>
                  <option value="maintenance">🛡️ Поддержание</option>
                  <option value="camp">🏕️ Кэмп к бою</option>
                  <option value="weight_cut">⚖️ Весогонка</option>
                </select></SelectWrap>
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Уровень">
                <SelectWrap><select value={level} onChange={e => setLevel(e.target.value as any)} style={SELECT}>
                  <option value="beginner">Новичок</option>
                  <option value="intermediate">Средний</option>
                  <option value="advanced">Продвинутый</option>
                  <option value="enhanced">💊 На курсе</option>
                </select></SelectWrap>
              </Field>
              <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
                <Field label={`Недель · ${weeks}`}>
                  <input type="range" min={2} max={12} value={weeks} onChange={e => setWeeks(Number(e.target.value))} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.32)', marginTop: 2 }}><span>2</span><span>12</span></div>
                </Field>
                <Field label={`Дней/нед · ${days}`}>
                  <input type="range" min={2} max={4} value={days} onChange={e => setDays(Number(e.target.value))} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.32)', marginTop: 2 }}><span>2</span><span>4</span></div>
                </Field>
              </div>
            </div>
          </SectionCard>

          {/* Периодизация */}
          <SectionCard icon="📊" title="Периодизация и кондиция" accent>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Модель периодизации">
                <SelectWrap><select value={periodizationModel} onChange={e => setPeriodizationModel(e.target.value as any)} style={SELECT}>
                  <option value="atr_10">ATR 5/3/2 (Issurin) — 10 нед</option>
                  <option value="linear_12">Linear 12</option>
                  <option value="conjugate">Conjugate — short-notice</option>
                </select></SelectWrap>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.44)', lineHeight: 1.4 }}>ATR: 50% Accum 6-10/RIR2-3 → 30% Trans 3-6/RIR1-2 → 20% Real RIR4</div>
              </Field>
              <Field label="Кондиция зала">
                <SelectWrap><select value={conditioningMode} onChange={e => setConditioningMode(e.target.value as any)} style={SELECT}>
                  <option value="auto">Авто — alactic+lactic+aerobic</option>
                  <option value="off">Выкл — только зал</option>
                  <option value="aerobic">Только aerobic Zone2</option>
                </select></SelectWrap>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.44)', lineHeight: 1.4 }}>Alactic 8×10с/50с · Lactic 5×3мин · Aerobic 40′ Zone2</div>
              </Field>
            </div>
          </SectionCard>

          {/* Бой / Тапер */}
          <SectionCard icon="🏁" title="Дата боя и тапер" subtitle="Дата боя включает авто-тапер + сауну">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <Field label="Дата боя">
                <input type="date" value={fightDate} onChange={e => setFightDate(e.target.value)} style={INPUT} />
              </Field>
              <Field label="Длительность тапера">
                <SelectWrap><select value={taperWeeks} onChange={e => setTaperWeeks(Number(e.target.value))} style={SELECT}>
                  <option value={1}>1 нед — объём −45%</option>
                  <option value={2}>2 нед — −35% → −55%</option>
                </select></SelectWrap>
              </Field>
              <Field label="Старт плана">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={INPUT} />
              </Field>
            </div>
            <InfoBanner tone="info">Тапер по Bosquet: объём 0.65 → 0.45, интенсивность 90-95%, спарринг ↓, сауна 15-20′×3/нед</InfoBanner>
          </SectionCard>

          {/* Антропометрия */}
          <SectionCard icon="👤" title="Антропометрия">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <Field label="Пол">
                <SelectWrap><select value={sex} onChange={e => setSex(e.target.value as any)} style={SELECT}><option value="male">Мужской</option><option value="female">Женский</option></select></SelectWrap>
              </Field>
              <Field label="Вес тела, кг">
                <input type="number" value={bodyweight} onChange={e => setBodyweight(Number(e.target.value) || 80)} style={INPUT} />
              </Field>
              <Field label="Возраст">
                <input type="number" value={age} onChange={e => setAge(Number(e.target.value) || 28)} style={INPUT} />
              </Field>
            </div>
            {acwr && (
              <InfoBanner tone={acwr.zone === 'dangerous' ? 'warn' : acwr.zone === 'caution' ? 'warn' : 'ok'}>
                ACWR {acwr.ratio} · {ruLabel(ZONE_RU, acwr.zone)} {acwr.zone === 'dangerous' ? '— объём ×0.60, RIR+2' : acwr.zone === 'caution' ? '— ×0.85, RIR+1' : acwr.zone === 'undertrained' ? '— добавить объём' : '— оптимум'} · дневник sRPE 28д
              </InfoBanner>
            )}
            {hrvLine && <InfoBanner tone={hrvLine.includes('dangerous') ? 'warn' : hrvLine.includes('caution') ? 'warn' : 'ok'}>{hrvLine}</InfoBanner>}
          </SectionCard>

          {/* VBT */}
          <SectionCard icon="⚡" title="VBT — потеря скорости" subtitle="Vitruve: >20% → RIR+1, >25% → вес −5%">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label={`Потеря скорости · ${velocityLoss}%`}>
                <input type="range" min={0} max={40} value={velocityLoss} onChange={e => setVelocityLoss(Number(e.target.value))} />
              </Field>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.52)', alignSelf: 'center', background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                Бюджет ×{velocityLoss > 20 ? '0.90' : '1.00'} {velocityLoss > 20 ? '— снижение объёма' : '— норма'}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Best скорость, м/с">
                <input type="number" step={0.05} value={vbtBest || ''} onChange={e => { const v = Number(e.target.value) || 0; setVbtBest(v); if (v > 0 && vbtLast > 0) { const d = diagnoseVelocityLossCombat(v, vbtLast, 20); setVelocityLoss(d.lossPct); } }} style={INPUT} placeholder="0.80" />
              </Field>
              <Field label="Last скорость, м/с">
                <input type="number" step={0.05} value={vbtLast || ''} onChange={e => { const v = Number(e.target.value) || 0; setVbtLast(v); if (vbtBest > 0 && v > 0) { const d = diagnoseVelocityLossCombat(vbtBest, v, 20); setVelocityLoss(d.lossPct); } }} style={INPUT} placeholder="0.60" />
              </Field>
            </div>
            {vbtBest > 0 && vbtLast > 0 && (() => { const d = diagnoseVelocityLossCombat(vbtBest, vbtLast, 20); return (
              <div style={{ fontSize: 11, fontWeight: 800, color: d.lossPct > 25 ? '#f87171' : d.lossPct > 20 ? '#fbbf24' : '#4ade80', background: d.lossPct > 25 ? 'rgba(239,68,68,0.08)' : d.lossPct > 20 ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${d.lossPct > 25 ? 'rgba(239,68,68,0.18)' : d.lossPct > 20 ? 'rgba(245,158,11,0.18)' : 'rgba(34,197,94,0.18)'}`, padding: '8px 10px', borderRadius: 10 }}>
                {d.lossPct}% · {d.zone} · {d.recommendation} {d.exceeded ? '⚠️' : '✅'}
              </div>
            ); })()}
          </SectionCard>

          {/* WorkMax */}
          <SectionCard icon="🏋️" title="Рабочие максимумы" subtitle="Группы → BW×коэфф. если пусто. Точные — ниже">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              {(['bench', 'squat', 'deadlift', 'chest', 'back', 'shoulders', 'quads'] as const).map(k => (
                <Field key={k} label={WM_LABEL_RU[k] || k}>
                  <input type="number" value={(workMax as any)[k] || ''} onChange={e => setWorkMax(s => ({ ...s, [k]: Number(e.target.value) || 0 }))} style={INPUT} placeholder="кг" />
                </Field>
              ))}
            </div>
            <button onClick={() => setShowExactWM(v => !v)} style={{ ...BTN, background: showExactWM ? 'rgba(168,85,247,0.14)' : 'rgba(255,255,255,0.04)', border: `1px solid ${showExactWM ? 'rgba(168,85,247,0.28)' : 'rgba(255,255,255,0.07)'}`, color: showExactWM ? '#d8b4fe' : 'rgba(255,255,255,0.72)', fontSize: 11 }}>
              {showExactWM ? '▲ Скрыть точные веса' : '▼ Точные веса по упражнениям (64)'}
            </button>
            {showExactWM && (() => {
              const WM_GROUPS: Record<string, { label: string; ids: string[] }> = {
                push: { label: 'Жим / плечи', ids: ['bench_bar', 'ohp', 'push_press', 'landmine_press'] },
                pull: { label: 'Тяги', ids: ['row_bar', 'pullup', 'fat_bar_row', 'single_arm_row', 'high_pull', 'towel_pullup', 'rope_climb'] },
                legs: { label: 'Ноги', ids: ['squat', 'front_squat', 'rdl', 'trap_bar_dead', 'zercher_squat', 'bulgarian_split_heavy', 'single_leg_rdl_combat', 'cossack_squat', 'step_up', 'hip_thrust'] },
                neck: { label: 'Шея', ids: ['neck_harness_ext', 'neck_flexion', 'neck_lateral_flex', 'neck_rotation'] },
                grip: { label: 'Хват', ids: ['plate_pinch', 'farmer_carry', 'wrist_roller', 'wrist_flexion'] },
                core: { label: 'Кор / ротация', ids: ['deadbug', 'ab_wheel', 'copenhagen_plank', 'landmine_rotation', 'pallof_rotation_press', 'sled_push', 'sled_pull', 'band_external_rotation'] },
              };
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(0,0,0,0.18)', padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', maxHeight: 340, overflowY: 'auto' }}>
                  {Object.entries(WM_GROUPS).map(([key, grp]) => (
                    <div key={key}>
                      <div style={{ fontSize: 10, color: '#c4b5fd', fontWeight: 800, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>{grp.label} · {grp.ids.length}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
                        {grp.ids.map(id => (
                          <label key={id} style={{ color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: 700, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {id}
                            <input type="number" value={workMaxByExercise[id] || ''} onChange={e => { const v = Number(e.target.value) || 0; setWorkMaxByExercise(s => { const n = { ...s }; if (v > 0) n[id] = v; else delete n[id]; return n; }); }} style={{ ...INPUT, padding: '7px 8px', fontSize: 12 }} placeholder="кг" />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </SectionCard>

          {/* Методика */}
          <SectionCard icon="🧠" title="Методика и интенсивность">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Методика порядка">
                <SelectWrap><select value={methodology} onChange={e => setMethodology(e.target.value as any)} style={SELECT}>
                  <option value="compound_first">База первой — классика</option>
                  <option value="pre_exhaust">Предутомление — изоляция → база</option>
                  <option value="post_exhaust">Постутомление — база → изоляция</option>
                </select></SelectWrap>
              </Field>
              <Field label="DUP-волны">
                <SelectWrap><select value={dupMode} onChange={e => setDupMode(e.target.value as any)} style={SELECT}>
                  <option value="off">Выкл — одна зона</option>
                  <option value="power_endurance">Сила / выносливость</option>
                  <option value="heavy_light">Тяж / лёг волна</option>
                  <option value="conjugate">Сопряжённая система</option>
                </select></SelectWrap>
              </Field>
            </div>
            <Field label="Интенсивная техника">
              <SelectWrap><select value={intensityTech} onChange={e => setIntensityTech(e.target.value as any)} style={SELECT}>
                <option value="none">Нет — чистые сеты</option>
                <option value="rest_pause">Rest-pause — аксессуары</option>
                <option value="myo_reps">Myo-reps — хват</option>
                <option value="cluster">Cluster 3×3 / 20с — база</option>
                <option value="contrast">Contrast тяж+плио — power</option>
              </select></SelectWrap>
            </Field>
          </SectionCard>

          {/* Весогонка */}
          <div style={{ ...CARD, background: weightCut > 0 ? 'linear-gradient(180deg, rgba(239,68,68,0.08), rgba(18,16,28,0.62))' : CARD.background, borderColor: weightCut > 0 ? 'rgba(239,68,68,0.22)' : GLASS_BORDER }}>
            <CardHeader icon="⚖️" title="Весогонка ISSN 2025" subtitle={weightCut > 0 ? `Сгонка ${weightCut} кг — плавная, без экстремальных протоколов` : 'Выключена — стабильный режим'} />
            <Field label={`Сгонка · ${weightCut} кг`}>
              <input type="range" min={0} max={8} step={0.5} value={weightCut} onChange={e => { const v = Number(e.target.value); setWeightCut(v); if (v >= 3) setHeatSessions(true); if (v >= 4) setWaterMode('load_cut'); if (v >= 3) setSodiumMode('moderate_cut'); if (v >= 5) setCarbMode('deplete_reload'); }} />
            </Field>
            {weightCut > 0 && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <Field label="Вода"><SelectWrap><select value={waterMode} onChange={e => setWaterMode(e.target.value as any)} style={SELECT}><option value="stable">Стабильно 35мл/кг</option><option value="load_cut">Load 8л → 2л</option></select></SelectWrap></Field>
                  <Field label="Натрий"><SelectWrap><select value={sodiumMode} onChange={e => setSodiumMode(e.target.value as any)} style={SELECT}><option value="stable">Стабильно 5г</option><option value="moderate_cut">5 → 3 → 1.5г</option></select></SelectWrap></Field>
                  <Field label="Углеводы"><SelectWrap><select value={carbMode} onChange={e => setCarbMode(e.target.value as any)} style={SELECT}><option value="stable">Стабильно 4-5г/кг</option><option value="deplete_reload">1г → 8г рефид</option></select></SelectWrap></Field>
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#fff', fontWeight: 700, background: 'rgba(255,255,255,0.04)', padding: '9px 11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={heatSessions} onChange={e => setHeatSessions(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#a855f7' }} /> Сауна 15-20′ ×3/нед — heat acclimation
                </label>
                <InfoBanner tone="warn">Регидратация после взвешивания: 125-150% от сгонки ({(weightCut * 1.25).toFixed(1)}–{(weightCut * 1.5).toFixed(1)} л) + Na 1г/л + угли 8г/кг за 12-24ч</InfoBanner>
              </>
            )}
          </div>

          {/* Оборудование и ограничения */}
          <SectionCard icon="🛡️" title="Оборудование и ограничения">
            <Field label="Доступное оборудование">
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {(['barbell', 'dumbbell', 'machine', 'cable', 'sled', 'other'] as const).map(eq => (
                  <ChipToggle key={eq} active={equipment.includes(eq)} onClick={() => setEquipment(s => s.includes(eq) ? s.filter(x => x !== eq) : [...s, eq])}>
                    {(EQUIP_RU as any)[eq] || eq}
                  </ChipToggle>
                ))}
              </div>
              <div style={HINT_SM}>Пусто — доступно всё. Выбор фильтрует пул упражнений.</div>
            </Field>
            <Divider />
            <Field label="Травмы — щадящий режим" hint="Снижает вес ×0.6 и повышает RIR, фильтрует опасные движения">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input value={injInput} onChange={e => setInjInput(e.target.value)} placeholder="напр.: шея, колено, плечо, кисть" style={{ ...INPUT, flex: 1, minWidth: 180 }} />
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: '#fff', fontWeight: 700, background: injExclude ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: 10, border: `1px solid ${injExclude ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer' }}>
                  <input type="checkbox" checked={injExclude} onChange={e => setInjExclude(e.target.checked)} style={{ accentColor: '#ef4444' }} /> ⛔ Исключить
                </label>
                <button onClick={() => {
                  const parts = injInput.split(',').map(s => s.trim()).filter(Boolean);
                  setInjuries(parts.map(p => ({ location: p, type: injExclude ? 'exclude' : 'joint', exclude: injExclude, mode: injExclude ? 'exclude' : 'graded', severity: injExclude ? 'high' : 'medium' } as any)));
                  setMsg(parts.length ? (injExclude ? '⛔ Исключены: ' : '⚡ Щадящий: ') + parts.join(', ') : 'Список очищен'); setTimeout(() => setMsg(''), 2000);
                }} style={BTN_SMALL}>Применить</button>
              </div>
              {injuries.length > 0 && (
                <InfoBanner tone={injExclude ? 'warn' : 'info'}>{injExclude ? '⛔ Исключены: ' : '⚡ Щадящий: '}{injuries.map((j: any) => j.location).join(', ')} — {injExclude ? 'убраны из пула' : 'вес ×0.6–0.7, RIR+1'}</InfoBanner>
              )}
            </Field>
            <Field label="Ограничения мобильности">
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {(['shoulder', 'hip', 'knee', 'ankle', 'wrist', 'neck', 'lower_back'] as const).map(m => (
                  <ChipToggle key={m} active={mobility.includes(m)} onClick={() => setMobility(s => s.includes(m) ? s.filter(x => x !== m) : [...s, m])}>{MOBILITY_RU[m]}</ChipToggle>
                ))}
              </div>
            </Field>
          </SectionCard>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={pullFromProfile} style={{ ...BTN, flex: 1, background: 'rgba(255,255,255,0.05)' }}>⟡ Подтянуть из профиля</button>
            <button onClick={() => setStep('outside')} style={{ ...BTN_PRIMARY, flex: 1.2 }}>Далее → Вне зала</button>
          </div>
        </div>
      )}

      {step === 'outside' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionCard icon="🥋" title="Вне зала — спарринг декомпозиция" subtitle="Hard spar RPE 8.5 · tech 5.5 · борьба 7.5. При ≥5× кондиция зала = 0" accent>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#fff', fontWeight: 800, background: outsideEnabled ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 12, border: `1px solid ${outsideEnabled ? 'rgba(168,85,247,0.22)' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer' }}>
              <input type="checkbox" checked={outsideEnabled} onChange={e => setOutsideEnabled(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#a855f7' }} />
              Учитывать нагрузку вне зала (ринг / татами)
            </label>

            {outsideEnabled && (
              <>
                <Field label="Режим учёта">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setSparringEnabled(false)} style={sparringEnabled ? BTN : { ...BTN, background: ACCENT_GRAD, color: '#fff', border: 'none' } as any}>Общий — OutsideLoad</button>
                    <button onClick={() => setSparringEnabled(true)} style={!sparringEnabled ? BTN : { ...BTN, background: ACCENT_GRAD, color: '#fff', border: 'none' } as any}>Декомпозиция — P0-6</button>
                  </div>
                </Field>

                {!sparringEnabled && outside && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'rgba(0,0,0,0.14)', padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Field label={`Сессий вне зала · ${outside.sessionsPerWeek} ×/нед`}>
                      <input type="range" min={0} max={6} value={outside.sessionsPerWeek} onChange={e => setOutside(o => o ? { ...o, sessionsPerWeek: Number(e.target.value) } : o)} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: TEXT_3 }}><span>0</span><span>6</span></div>
                    </Field>
                    <Field label={`Длительность · ${outside.avgDurationMin} мин`}>
                      <input type="range" min={30} max={180} step={10} value={outside.avgDurationMin} onChange={e => setOutside(o => o ? { ...o, avgDurationMin: Number(e.target.value) } : o)} />
                    </Field>
                    <Field label={`RPE · ${outside.avgSRPE}`}>
                      <input type="range" min={1} max={10} value={outside.avgSRPE} onChange={e => setOutside(o => o ? { ...o, avgSRPE: Number(e.target.value) } : o)} />
                    </Field>
                    <Field label="Высокие дни" hint="Тяжёлые ноги не ставим за день до высокого дня">
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {[0, 1, 2, 3, 4, 5, 6].map(d => {
                          const active = (outside.highIntensityDays || []).includes(d);
                          const label = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][d];
                          return <ChipToggle key={d} active={active} onClick={() => setOutside(o => o ? { ...o, highIntensityDays: active ? (o.highIntensityDays || []).filter(x => x !== d) : [...(o.highIntensityDays || []), d].sort((a, b) => a - b) } : o)}>{label}</ChipToggle>;
                        })}
                      </div>
                    </Field>
                  </div>
                )}

                {sparringEnabled && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 10, background: 'rgba(0,0,0,0.14)', padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Field label={`Hard spar · ${sparringHard}×`} hint="RPE 8.5 · 90мин">
                      <input type="range" min={0} max={4} value={sparringHard} onChange={e => setSparringHard(Number(e.target.value))} />
                    </Field>
                    <Field label={`Tech spar · ${sparringTech}×`} hint="RPE 5.5 · 60мин">
                      <input type="range" min={0} max={4} value={sparringTech} onChange={e => setSparringTech(Number(e.target.value))} />
                    </Field>
                    <Field label={`Борьба · ${sparringWrest}×`} hint="RPE 7.5 · 75мин">
                      <input type="range" min={0} max={4} value={sparringWrest} onChange={e => setSparringWrest(Number(e.target.value))} />
                    </Field>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <InfoBanner tone="accent">Спарринг load = {sparringHard * 90 * 8.5 + sparringTech * 60 * 5.5 + sparringWrest * 75 * 7.5} load → {sparringHard + sparringTech + sparringWrest}×/нед</InfoBanner>
                    </div>
                  </div>
                )}

                <InfoBanner tone={outsideMetrics?.interference === 'high' ? 'warn' : 'accent'}>
                  {outsideMetrics ? `${outsideMetrics.weeklyLoad} load → объём зала ×${outsideMetrics.volumeMultiplier} (${outsideMetrics.interference === 'high' ? 'высокая' : outsideMetrics.interference === 'medium' ? 'средняя' : outsideMetrics.interference === 'low' ? 'низкая' : outsideMetrics.interference} интерференция)` : 'Вне зала: нет данных — объём 100%'}
                </InfoBanner>
              </>
            )}
          </SectionCard>

          <SectionCard icon="🥊" title="Стиль боя и осевая нагрузка" subtitle="Стиль меняет объём: striker +ротация, grappler +шея/хват">
            <Field label="Стиль боя">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <ChipToggle active={fightStyle === 'striker'} onClick={() => setFightStyle('striker')} icon="👊">Ударник</ChipToggle>
                <ChipToggle active={fightStyle === 'grappler'} onClick={() => setFightStyle('grappler')} icon="🤼">Борец</ChipToggle>
                <ChipToggle active={fightStyle === 'hybrid'} onClick={() => setFightStyle('hybrid')} icon="🥋">Гибрид</ChipToggle>
              </div>
            </Field>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#fff', fontWeight: 700, background: avoidAxialLoad ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 12, border: `1px solid ${avoidAxialLoad ? 'rgba(239,68,68,0.20)' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer' }}>
              <input type="checkbox" checked={avoidAxialLoad} onChange={e => setAvoidAxialLoad(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#ef4444' }} />
              Избегать осевой нагрузки — грыжа / перегруз позвоночника
            </label>
          </SectionCard>

          <button onClick={() => setStep('split')} style={{ ...BTN_PRIMARY, width: '100%' }}>Далее → Сплит</button>
        </div>
      )}

      {step === 'split' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...CARD, padding: 14, gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: ACCENT_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✨</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>Рекомендуем: <span style={{ color: '#d8b4fe' }}>{recommendCombatPattern(days, outside?.sessionsPerWeek || 0, level).name}</span></div>
                <div style={{ fontSize: 11, color: TEXT_3 }}>{patternId ? `Выбран: ${COMBAT_PATTERNS.find(p => p.id === patternId)?.name}` : 'Авто-подбор по дням и нагрузке'} · модель <b style={{ color: '#fff' }}>{ruLabel(PERIODIZATION_RU, periodizationModel ?? 'atr_10')}</b></div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {COMBAT_PATTERNS.map(p => {
              const active = patternId ? patternId === p.id : p.id === recommendCombatPattern(days, outside?.sessionsPerWeek || 0, level).id;
              const preview = p.schedule.map(s => s.kind === 'тренировка' ? (s.sessionTag || 'тренировка').slice(0, 4) : 'отд').join(' · ');
              return (
                <button
                  key={p.id}
                  onClick={() => setPatternId(p.id)}
                  style={{
                    textAlign: 'left', padding: 14, borderRadius: 14, cursor: 'pointer', transition: 'all 0.18s ease',
                    background: active ? 'linear-gradient(135deg, rgba(168,85,247,0.16), rgba(236,72,153,0.10))' : 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
                    border: active ? '1px solid rgba(168,85,247,0.36)' : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: active ? '0 6px 20px rgba(168,85,247,0.16), inset 0 1px 0 rgba(255,255,255,0.08)' : '0 4px 12px rgba(0,0,0,0.14)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: active ? '#fff' : 'rgba(255,255,255,0.92)' }}>{p.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: active ? '#d8b4fe' : 'rgba(255,255,255,0.42)', background: active ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 20, border: `1px solid ${active ? 'rgba(168,85,247,0.22)' : 'rgba(255,255,255,0.06)'}` }}>{p.sessionsPerRotation}×/нед</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.62)', marginTop: 4, lineHeight: 1.4 }}>{p.description}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)', marginTop: 6, fontFamily: 'ui-monospace, monospace', background: 'rgba(0,0,0,0.18)', padding: '5px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>{preview}</div>
                  {active && <div style={{ fontSize: 11, color: '#d8b4fe', fontWeight: 800, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7', boxShadow: '0 0 8px #a855f7' }} /> Выбран — предпросмотр: {p.schedule.filter(s => s.kind === 'тренировка').map(s => s.sessionTag).join(', ')}</div>}
                </button>
              );
            })}
          </div>

          <InfoBanner>ATR 5/3/2: 10 нед → 5 накопление 6-10/RIR2-3 → 3 трансформация 3-6/RIR1-2 → 2 реализация тапер. Conjugate — ротация макс/динам/повтор. Linear — ОФП/сила/тапер.</InfoBanner>

          <button onClick={build} style={{ ...BTN_PRIMARY, width: '100%', padding: '14px 16px', fontSize: 13, borderRadius: 14 }}>
            ✦ Собрать PRO-план {patternId ? `· ${patternId}` : ''} · {ruLabel(PERIODIZATION_RU, periodizationModel ?? 'atr_10')}
          </button>
        </div>
      )}

      {step === 'plan' && plan && (
        <CombatPlanView
          plan={plan}
          historyLen={history.length}
          onUndo={undo}
          onUpdateEx={updateEx}
          onMoveEx={moveEx}
          onSwapEx={swapEx}
          onBuildATR={handleBuildATR}
          onAddCompetition={handleAddCompetition}
          onPrintAnnual={handlePrintAnnual}
          onDownloadIcs={handleDownloadIcs}
          onExportProgram={exportToUserProgram}
          annual={annual}
          annualWeeks={annualWeeks}
          setAnnualWeeks={setAnnualWeeks}
          competitionName={competitionName}
          setCompetitionName={setCompetitionName}
          competitionDate={competitionDate}
          setCompetitionDate={setCompetitionDate}
          competitionWeight={competitionWeight}
          setCompetitionWeight={setCompetitionWeight}
          startDate={startDate}
          outside={outside}
          outsideMetrics={outsideMetrics}
          diaryLoad={diaryLoad}
          acwr={acwr}
          msg={msg}
          setMsg={setMsg}
        />
      )}
      {step === 'plan' && !plan && (
        <div style={{ ...CARD, alignItems: 'center', padding: 28, textAlign: 'center' }}>
          <span style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📋</span>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>План ещё не собран</div>
          <div style={{ fontSize: 12, color: TEXT_3, maxWidth: 320 }}>Вернитесь к параметрам, выберите сплит и нажмите «Собрать PRO-план». Годовой ATR можно построить и без плана.</div>
          <button onClick={() => setStep('params')} style={BTN_GHOST}>← К параметрам</button>
        </div>
      )}
    </div>
  );
};

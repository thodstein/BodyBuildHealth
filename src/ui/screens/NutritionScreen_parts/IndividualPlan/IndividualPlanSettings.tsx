import React, { useState, useEffect } from "react";
import { FOOD_DB } from "../../../../core/nutrition-database";
import { PHARMA_DB } from "../../../../core/pharma-database";
import { ALL_SUBSTANCES } from "../../../../data/support-substances";
import { SUPPORT_CATALOG_DATA } from "../../../../data/support-catalog-data";
import {
  GOALS, PHASES, BUDGET_LEVELS, NUTRITION_LEVELS, PLAN_TYPES,
  ALLERGEN_LIST, HEALTH_ISSUES,
  type CycleType,
} from "./types";
import { GlassCard, PillBtn, inputStyle, selectStyle, greenBtn } from "./ui";
import { usePlanCtx } from "./IndividualPlanContext";
import { getProfile } from "../../../../core/profile-manager";
import { categoriesForSex } from "./planner-categories";
import { PopupNumber, PopupSelect, PopupText } from '../../../components/PopupXxx';
import { plannerWeightAdjustAdvice } from './planner-targets';
import { getRecipes, type Recipe } from '../../../../engines/nutrition-periodization.engine';


// P3.2: Collapsible section for compact settings
const SETTINGS_SECTIONS_KEY = 'he_plan_settings_collapsed';
const useCollapsedSections = () => {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => {
    try { const v = JSON.parse(localStorage.getItem(SETTINGS_SECTIONS_KEY) || '[]'); return new Set(Array.isArray(v) ? v.filter((x: any) => typeof x === 'string') : []); } catch { return new Set(); }
  });
  const toggle = (id: string) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    try { localStorage.setItem(SETTINGS_SECTIONS_KEY, JSON.stringify([...next])); } catch {}
    return next;
  });
  return { collapsed, toggle };
};
const CollapsibleSection: React.FC<{ id: string; title: string; icon: string; color: string; children: React.ReactNode }> = ({ id, title, icon, color, children }) => {
  const { collapsed, toggle } = useCollapsedSections();
  const isCollapsed = collapsed.has(id);
  return (
    <div style={{ marginBottom: 6 }}>
      <div onClick={() => toggle(id)} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer',
        fontSize: 11, fontWeight: 800, color, letterSpacing: '-0.15px',
        background: `linear-gradient(135deg, ${color}14, ${color}06)`, borderRadius: 12, marginBottom: isCollapsed ? 0 : 6,
        border: `1px solid ${color}18`, boxShadow: `0 2px 10px ${color}0d`,
        userSelect: 'none', transition:'all 0.18s ease',
      }}>
        <span style={{
          width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center',
          background: `${color}16`, border:`1px solid ${color}22`, fontSize: 9, transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', flexShrink:0,
        }}>▼</span>
        <span style={{ fontSize: 14, filter:'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}>{icon}</span>
        <span style={{flex:1}}>{title}</span>
        <span style={{fontSize:9, color:'rgba(255,255,255,0.32)', fontWeight:600}}>{isCollapsed ? 'развернуть' : 'свернуть'}</span>
      </div>
      {!isCollapsed && <div style={{ animation: 'fadeSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}>{children}</div>}
    </div>
  );
};

export const IndividualPlanSettings: React.FC = () => {
  const {
    weight, setWeight, height, setHeight, age, setAge, sex, setSex,
    dailySteps, setDailySteps, cookTimeMin, setCookTimeMin,
    cookingSkill, setCookingSkill, cookingFrequency, setCookingFrequency, batchCooking, setBatchCooking, useRecipesInPlan, setUseRecipesInPlan,
    trainType, setTrainType, trainIntensity, setTrainIntensity,
    intraWorkoutEnabled, setIntraWorkoutEnabled,
    householdActivity, setHouseholdActivity, bodyFatPct, setBodyFatPct,
    sleepHours, setSleepHours, sleepQuality, setSleepQuality,
    stressLevel, setStressLevel, cyclePhase, setCyclePhase, bbCategory, setBBCategory, peakWeekEnabled, setPeakWeekEnabled, peakWeekShowDay, setPeakWeekShowDay, bbPrepConfig, applyBBPeakToPlan, planTab, setPlanTab, lifeStage, setLifeStage,
    hungerLevel, setHungerLevel,
    weightAdaptMode, setWeightAdaptMode, weightLogWeek, setWeightLogWeek,
    expectedLossKgWeek, setExpectedLossKgWeek,
    showWeightAdaptModal, setShowWeightAdaptModal,
    weightLogEntries, setWeightLogEntries,
    weightLogPeriod, setWeightLogPeriod,
    metabolicAdaptEnabled, setMetabolicAdaptEnabled, metabolicAdaptPct, setMetabolicAdaptPct,
    dietPauseMode, setDietPauseMode, manualGPerKg, setManualGPerKg,
    goal, setGoal, autoGoal, goalUserSet, setGoalUserSet,
    phase, setPhase,
    injections, setInjections,
    injName, setInjName, injTime, setInjTime, injDose, setInjDose,
    injUnit, setInjUnit, injType, setInjType, injEster, setInjEster,
    injectDrugTypes,
    calcTargets, profileTargets, effectiveKcal, effectiveP, effectiveF, effectiveC,
    carbCapClipped, carbCapGPerKg,
    kbjuMode, setKbjuMode, switchKbjuMode,
    manualKcal, setManualKcal, manualP, setManualP, manualF, setManualF, manualC, setManualC,
    budget, setBudget, nutrLevel, setNutrLevel,
    variety, setVariety, diaryAdaptation, setDiaryAdaptation, varietyStrictness, setVarietyStrictness,
    wakeTime, setWakeTime, bedTime, setBedTime,
    lunchTime, setLunchTime, dinnerTime, setDinnerTime,
    workFood, setWorkFood, mealsCount, setMealsCount,
    morningTrainLoad, setMorningTrainLoad,
    allergens, toggleAllergen,
    healthIssues, setHealthIssues, toggleHealthIssue,
    eveningLowCarb, setEveningLowCarb,
    addMilkToBreakfast, setAddMilkToBreakfast, breakfastStyle, setBreakfastStyle, breakfastTemplate, setBreakfastTemplate,
    planType, setPlanType,
    preferredFoods, setPreferredFoods, preferredByMeal, setPreferredByMeal, excludedFoods, setExcludedFoods,
    specificity, setSpecificity, intolerances, setIntolerances, tasteProfile, setTasteProfile, excludedCategories, setExcludedCategories,
    customNotes, setCustomNotes,
    cyclingMode, setCyclingMode, trainingDays, setTrainingDays, DAY_LABELS,
    heavyTrainDay, setHeavyTrainDay,
    workScheduleEnabled, setWorkScheduleEnabled,
    workStartTime, setWorkStartTime, workEndTime, setWorkEndTime,
    workDays, setWorkDays, workScheduleType, setWorkScheduleType,
    cravingMode, setCravingMode, cravingDays, setCravingDays,
    lazyDayMode, setLazyDayMode, lazyDayDays, setLazyDayDays,
    periodizationEnabled, setPeriodizationEnabled,
    surplusPct, setSurplusPct,
    specialMealMode, setSpecialMealMode,
    specialMealGoal, setSpecialMealGoal,
    specialMealProteinG, setSpecialMealProteinG,
    specialMealFatG, setSpecialMealFatG,
    specialMealCarbsG, setSpecialMealCarbsG,
    specialMealTiming, setSpecialMealTiming,
    specialMealReplaceMode, setSpecialMealReplaceMode,
    specialMealReplaceTarget, setSpecialMealReplaceTarget,
    s, courseEntries, profile,
    showAddDrug, setShowAddDrug,
    showDrugTypePicker, setShowDrugTypePicker,
    takenSupplements, setTakenSupplements,
    showSuppPicker, setShowSuppPicker, suppSearch, setSuppSearch,
    linkToTraining, setLinkToTraining,
    trainStart, setTrainStart, trainEnd, setTrainEnd,
    trainScheduleType, setTrainScheduleType, trainPattern, setTrainPattern,
    v2Phase, setV2Phase, v2Labs, setV2Labs, v2Pharma, setV2Pharma,
    histamineSensitive, setHistamineSensitive,
    plannerMode, setPlannerMode,
    generationMode, setGenerationMode,
    dietPrefs, setDietPrefs,
    userRecipes, labAnalysis, labs,
    errorMsg, setErrorMsg,
    generatePlan,
    autofillFromProfile, saveToProfile,
  } = usePlanCtx();

  // P1-11: валидация ввода перед генерацией (TMA-роль: не позволить абсурдные комбинации).
  const _validatePlannerInput = (): string | null => {
    if (weight < 30) return 'Вес слишком низок (<30 кг). Проверьте значение.';
    if (weight > 250) return 'Вес слишком высок (>250 кг). Проверьте значение.';
    if (height < 100) return 'Рост слишком низок (<100 см) — нереалистично для взрослого.';
    if (age < 14) return 'Возраст <14 лет. Планировщик не предназначен для детей и подростков.';
    if (age > 100) return 'Возраст >100 лет. Проверьте значение.';
    const _bmi = weight / Math.pow(height / 100, 2);
    if (_bmi < 14) return `BMI=${_bmi.toFixed(1)} — критично низкий (<14). Возможна анорексия. Обсудите с лечащим врачом.`;
    if (_bmi > 60) return `BMI=${_bmi.toFixed(1)} — критично высокий (>60). Подходит только при медицинской поддержке.`;
    if (bodyFatPct > 0) {
      if (sex === 'male' && bodyFatPct < 3) return `% жира ${bodyFatPct}% — опасно низкий (<3% для мужчин). Риск потери ЛБМ и эндокринных нарушений.`;
      if (sex === 'female' && bodyFatPct < 8) return `% жира ${bodyFatPct}% — опасно низкий (<8% для женщин). Риск аменореи/RED-S.`;
    }
    if (sex === 'female' && lifeStage === 'pregnancy' && (goal === 'cutting' || goal === 'fat_loss')) {
      return 'Агрессивная сушка во время беременности недопустима. Установите цель «Поддержка» и проконсультируйтесь с гинекологом.';
    }
    if (sleepHours < 4) return 'Сон <4 ч критично низкий — расчёт КБЖУ с применением такого ввода опасен.';
    return null;
  };


  const [showSpecialMealModal, setShowSpecialMealModal] = useState(false);
  const [showPrefFoodModal, setShowPrefFoodModal] = useState(false);
  const [showExclFoodModal, setShowExclFoodModal] = useState(false);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [prefSearch, setPrefSearch] = useState('');
  const [exclSearch, setExclSearch] = useState('');
  const [showSpecialMealPopup, setShowSpecialMealPopup] = useState(false);
  const [showReplaceMealPopup, setShowReplaceMealPopup] = useState(false);
  const [specialMealType, setSpecialMealType] = useState<'cheat_meal' | 'refeed' | 'fast'>('cheat_meal');
  // D-28 П3 fix: ЛОКАЛЬНАЯ дата (не UTC toISOString) — иначе календарь спец-приёмов не совпадал
  // с isoToday() движка (в UTC+3..+12 вечером toISOString уходил на предыдущий день).
  const _toLocalIso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const [specialMealDate, setSpecialMealDate] = useState(() => _toLocalIso(new Date()));
  const [specialMealNotes, setSpecialMealNotes] = useState('');
  const [selectedMealToReplace, setSelectedMealToReplace] = useState('');
  const [specialMeals, setSpecialMeals] = useState<{ type: string; typeLabel: string; date: string; notes: string; replaceMeal?: string }[]>(() => {
    try { const v = JSON.parse(localStorage.getItem('he_special_meals') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
  });
  const [showSexPicker, setShowSexPicker] = useState(false);
  const [showTrainTypePicker, setShowTrainTypePicker] = useState(false);
  const [showIntensityPicker, setShowIntensityPicker] = useState(false);
  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const [showCyclePicker, setShowCyclePicker] = useState(false);
  const [showWorkFoodPicker, setShowWorkFoodPicker] = useState(false);
  const pickerBtn = (label: string, opts: {value:string,label:string}[], cur: string, setShow: (v:boolean)=>void) => (
    <div onClick={() => setShow(true)} style={{...selectStyle, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px', minHeight:32, boxSizing:'border-box'}}>
      <span>{opts.find(o => o.value === cur)?.label || cur}</span>
      <span style={{fontSize:10, opacity:0.4, marginLeft:4}}>▼</span>
    </div>
  );
  const pickerModal = (label: string, opts: {value:string,label:string}[], cur: string, onChange: (...args:any[])=>void, show: boolean, setShow: (v:boolean)=>void) => show ? (
    <div key={label} style={{position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)'}} onClick={() => setShow(false)}>
      <div onClick={e => e.stopPropagation()} style={{width:'92%', maxWidth:380, padding:16, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.15)'}}>
        <div style={{fontSize:14, fontWeight:700, color:'#fff', marginBottom:8, textAlign:'center'}}>{label}</div>
        {opts.map(o => (
          <div key={o.value} onClick={() => { onChange(o.value as any); setShow(false); }} style={{padding:'8px 10px', borderRadius:8, cursor:'pointer', fontSize:10, background: cur === o.value ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.02)', border: cur === o.value ? '1px solid rgba(0,230,138,0.3)' : '1px solid transparent', color: cur === o.value ? '#00e68a' : 'rgba(255,255,255,0.7)', display:'flex', alignItems:'center', gap:6, marginBottom:3}}>
            <span>{cur === o.value ? '✓' : '○'}</span><span>{o.label}</span>
          </div>
        ))}
        <button onClick={() => setShow(false)} style={{width:'100%', marginTop:8, padding:'8px', borderRadius:8, border:'1px solid rgba(255,255,255,0.15)', background:'#202023', color:'#fff', cursor:'pointer', fontSize:10}}>Готово</button>
      </div>
    </div>
  ) : null;

  const goalLabels: Record<string,string> = { pre_workout:'🏋️ Предтреник', post_workout:'💪 Пост-треник', before_bed:'🌙 На ночь (каз.)', high_protein:'🥩 Высокобелк.', keto:'🥑 Кето', low_cal_day:'📉 Мало-кал.', custom:'⚙️ Своё' };
  const timingLabels: Record<string,string> = { breakfast:'🌅 Завтрак', lunch:'☀️ Обед', dinner:'🌆 Ужин', snack:'🍪 Перекус', before_bed:'🌙 Перед сном' };
  const specialMealGoalLabel = goalLabels[specialMealGoal] || specialMealGoal;
  const specialMealTimingLabel = timingLabels[specialMealTiming] || specialMealTiming;
  useEffect(() => {
    const templates: Record<string, { p: number; f: number; c: number }> = {
      pre_workout: { p: 25, f: 5, c: 40 }, post_workout: { p: 35, f: 3, c: 55 },
      before_bed: { p: 35, f: 15, c: 5 }, high_protein: { p: 50, f: 10, c: 20 },
      keto: { p: 30, f: 35, c: 5 }, low_cal_day: { p: 20, f: 5, c: 15 },
    };
    const tpl = templates[specialMealGoal];
    if (tpl && (specialMealProteinG !== tpl.p || specialMealFatG !== tpl.f || specialMealCarbsG !== tpl.c)) {
      setSpecialMealProteinG(tpl.p);
      setSpecialMealFatG(tpl.f);
      setSpecialMealCarbsG(tpl.c);
    }
  }, [specialMealGoal]);
  const TIME_OPTIONS = Array.from({length:48},(_,i)=>{const h=Math.floor(i/2);const m=i%2===0?'00':'30';return{id:`${String(h).padStart(2,'0')}:${m}`,label:`${String(h).padStart(2,'0')}:${m}`};});

  const [recentPreset, setRecentPreset] = useState<string | null>(null);
  // FIX button-audit: локальный toast вместо alert() (window.showToast нигде не определён)
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [hematAdv, setHematAdv] = React.useState<any>(null);
  React.useEffect(()=>{
    try{ const raw=localStorage.getItem('he_hematology_advice'); if(raw) setHematAdv(JSON.parse(raw)); }catch{}
    const h=(e:any)=>{ try{ const r=localStorage.getItem('he_hematology_advice'); if(r) setHematAdv(JSON.parse(r)); else setHematAdv(null); }catch{} };
    window.addEventListener('storage', h); window.addEventListener('he-hematology-advice', h as any);
    return ()=>{ window.removeEventListener('storage', h); window.removeEventListener('he-hematology-advice', h as any); };
  }, []);
  const settingsSection = 'all';
  const persistPlannerValue = (key: string, value: unknown) => {
    try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch {}
  };

  if (plannerMode === 'minimal') {
    // Быстрый режим: только 3 ключевые цели (масса / сушка / поддержание) + Здоровье
    const MINIMAL_GOALS = GOALS.filter(g => g.id === 'mass' || g.id === 'cutting' || g.id === 'maintenance' || g.id === 'health');
    return (
      <>
        <GlassCard title="⚡ Быстрый КБЖУ" icon="⚡" color="#f59e0b">
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.72)', lineHeight:1.5, marginBottom:8 }}>
            Минимальный режим: только базовые данные и расчёт сухого КБЖУ. Расширенные настройки сохранены и доступны после возврата в Pro.
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:5, marginBottom:6 }}>
            <PopupNumber label="Вес" value={weight} min={30} max={250} suffix="кг" onChange={setWeight} />
            <PopupNumber label="Рост" value={height} min={100} max={250} suffix="см" onChange={setHeight} />
            <PopupNumber label="Возраст" value={age} min={14} max={100} suffix="лет" onChange={setAge} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:6 }}>
            <PopupSelect label="Пол" value={sex} options={[{id:'male',label:'Мужской'},{id:'female',label:'Женский'}]} onChange={v => setSex(v as 'male'|'female')} />
            <PopupNumber label="Приёмов пищи" value={mealsCount} min={3} max={10} onChange={setMealsCount} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:5, marginBottom:6 }}>
            <PopupSelect label="Еда на работе" value={workFood} options={[{id:'any',label:'Любая (можно разогреть)'},{id:'portable',label:'Только порошок/хлопья/протеин'}]} onChange={v=>setWorkFood(v as any)} />
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:8 }}>
            {MINIMAL_GOALS.map(g => <PillBtn key={g.id} active={goal === g.id} onClick={() => { setGoal(g.id); setGoalUserSet(true); }} color="#f59e0b">{g.icon} {g.label}</PillBtn>)}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:7 }}>
            <div style={{ padding:7, borderRadius:8, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.15)', textAlign:'center' }}><div style={{ fontSize:17, fontWeight:800, color:'#00e68a' }}>{effectiveKcal}</div><div style={{ fontSize:8, color:'rgba(255,255,255,0.65)' }}>ккал</div></div>
            <div style={{ padding:7, borderRadius:8, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.15)', textAlign:'center' }}><div style={{ fontSize:17, fontWeight:800, color:'#3b82f6' }}>Б {effectiveP} / Ж {effectiveF} / У {effectiveC}</div><div style={{ fontSize:8, color:'rgba(255,255,255,0.65)' }}>граммы в день</div></div>
          </div>
          {carbCapClipped && (
            <div style={{ fontSize:9, color:'#fbbf24', padding:'6px 8px', marginBottom:7, background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:8, lineHeight:1.5 }}>
              ⚠ Углеводы ограничены диетологическим потолком {carbCapGPerKg} г/кг — цель ккал ниже «TDEE + профицит». На массе потолок растёт с объёмом тренировок (7-8 г/кг). Снять ограничение можно в ручном режиме КБЖУ.
            </div>
          )}
          {(() => {
            // П2 (Роунд-2): совет автокоррекции калорий по темпу веса (план → факт → коррекция)
            const weights = (weightLogEntries || []).map((e: any) => e.weight).filter((w: any) => Number.isFinite(w) && w > 0);
            if (weights.length < 4 || kbjuMode === 'manual') return null;
            const advice = plannerWeightAdjustAdvice({ weightLog: weights, goal, sex, kcalTarget: effectiveKcal });
            if (!advice || advice.status === 'no_data') return null;
            const applyable = advice.kcalDelta !== 0;
            const col = advice.status === 'ok' ? '#22c55e' : advice.kcalDelta > 0 ? '#60a5fa' : '#fbbf24';
            return (
              <div style={{ fontSize:9, color:col, padding:'6px 8px', marginBottom:7, background: advice.status === 'ok' ? 'rgba(34,197,94,0.06)' : 'rgba(96,165,250,0.06)', border:`1px solid ${advice.status === 'ok' ? 'rgba(34,197,94,0.2)' : 'rgba(96,165,250,0.25)'}`, borderRadius:8, lineHeight:1.5 }}>
                ⚖️ {advice.reason}
                {applyable && <button onClick={() => { switchKbjuMode('manual'); setManualKcal(Math.max(1200, effectiveKcal + advice.kcalDelta)); }} style={{ display:'block', marginTop:4, padding:'3px 8px', borderRadius:6, cursor:'pointer', fontSize:9, fontWeight:800, background:'rgba(96,165,250,0.14)', border:'1px solid rgba(96,165,250,0.35)', color:'#60a5fa' }}>⚖️ Применить {advice.kcalDelta > 0 ? '+' : ''}{advice.kcalDelta} ккал</button>}
              </div>
            );
          })()}
          <div style={{ marginBottom:7 }}>
            <button onClick={() => switchKbjuMode(kbjuMode === 'manual' ? 'auto' : 'manual')} style={{ padding:'7px 10px', borderRadius:8, cursor:'pointer', fontSize:10, fontWeight:700, background: kbjuMode === 'manual' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)', border: kbjuMode === 'manual' ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.1)', color: kbjuMode === 'manual' ? '#f59e0b' : 'rgba(255,255,255,0.75)' }}>✏️ Ручное КБЖУ: {kbjuMode === 'manual' ? 'ВКЛ' : 'ВЫКЛ'}</button>
          </div>
          {kbjuMode === 'manual' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:7 }}>
              <PopupNumber label="Ккал" value={manualKcal ?? effectiveKcal} min={500} max={8000} step={50} suffix="ккал" onChange={v => setManualKcal(v)} />
              <PopupNumber label="Белки" value={manualP ?? effectiveP} min={0} max={500} step={5} suffix="г" onChange={v => setManualP(v)} />
              <PopupNumber label="Жиры" value={manualF ?? effectiveF} min={0} max={300} step={5} suffix="г" onChange={v => setManualF(v)} />
              <PopupNumber label="Углеводы" value={manualC ?? effectiveC} min={0} max={1200} step={5} suffix="г" onChange={v => setManualC(v)} />
            </div>
          )}
          {errorMsg && <div style={{ fontSize:9, color:'#ef4444', padding:'5px 8px', marginBottom:6, background:'rgba(239,68,68,0.06)', borderRadius:6 }}>⚠️ {errorMsg}</div>}
          <button onClick={() => { try { const err = _validatePlannerInput(); if (err) { setErrorMsg(err); return; } setErrorMsg(null); generatePlan(1); } catch (e: any) { setErrorMsg('Ошибка: ' + (e?.message || String(e))); } }} style={{ ...greenBtn, width:'100%' }}>⚡ Рассчитать и создать рацион</button>
        </GlassCard>
        <GlassCard title="Режим планировщика" icon="🧬" color="#60a5fa">
          <button onClick={() => setPlannerMode('simple')} style={{ width:'100%', padding:9, borderRadius:8, cursor:'pointer', background:'#202023', border:'1px solid rgba(96,165,250,0.3)', color:'#60a5fa', fontSize:10, fontWeight:700 }}>🍽 Перейти в простой режим</button>
          <button onClick={() => setPlannerMode('pro')} style={{ width:'100%', padding:9, marginTop:5, borderRadius:8, cursor:'pointer', background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.25)', color:'#00e68a', fontSize:10, fontWeight:700 }}>🧬 Вернуться в Pro</button>
        </GlassCard>
      </>
    );
  }

  return (
    <>

      {/* Кнопки синхронизации с Профилем (Aug 5 2026) */}
      <GlassCard title="🔄 Синхронизация с Профилем" icon="🔄" color="#3b82f6">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginBottom: 8, lineHeight: 1.5 }}>
          Поля ниже ЛОКАЛЬНЫЕ — не пишут в Профиль автоматически.
          <br/>📋 <b>Автозаполнение</b> — загрузить значения из Профиля.
          <br/>💾 <b>Сохранить в Профиль</b> — записать текущие значения обратно.
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => { autofillFromProfile(); }}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)',
              color: '#3b82f6', cursor: 'pointer', minHeight: 40,
            }}
          >📋 Автозаполнение из профиля</button>
          <button
            onClick={() => { saveToProfile(); if (typeof (window as any).showToast === 'function') (window as any).showToast('✓ Сохранено в профиль', 'success'); else alert('✓ Сохранено в профиль'); }}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.3)',
              color: '#00e68a', cursor: 'pointer', minHeight: 40,
            }}
          >💾 Сохранить в профиль</button>
        </div>
      </GlassCard>

      {hematAdv && hematAdv.hct!=null && (
        <GlassCard title={`🩸 Гематокрит ${hematAdv.hct}% — ${hematAdv.zone ?? hematAdv.ironRec}`} icon="🩸" color={hematAdv.hct>54 ? '#ef4444' : hematAdv.hct>51 ? '#f59e0b' : '#eab308'}>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.45, marginBottom:6 }}>
            <b>Метаболик-хаб → Кровь:</b> HCT {hematAdv.hct}% · вода {hematAdv.waterTargetMl}мл · {hematAdv.ironRec==='zero' ? '⛔ ZERO железо' : hematAdv.ironRec==='cap_15' ? '⚠ кап 15мг' : 'железо норма'} · {hematAdv.donation?.needed ? `🩸 ${hematAdv.donation.text}` : 'донация не требуется'}
          </div>
          {hematAdv.ironRec==='zero' && <div style={{ fontSize:8, color:'#ef4444', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:6, padding:'5px 7px', marginBottom:6 }}>⛔ При HCT&gt;51 гемовое железо (говядина/печень) штрафуется в скоринге. План автоматически деприоритизирует красное мясо — выбирай курицу/индейку/рыбу.</div>}
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>{
              try{ localStorage.removeItem('he_hematology_advice'); setHematAdv(null); }catch{}
            }} style={{ flex:1, padding:'6px 8px', borderRadius:7, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.03)', color:'rgba(255,255,255,0.6)', fontSize:8, fontWeight:600, cursor:'pointer' }}>✕ Скрыть</button>
            <button onClick={()=>{
              if(hematAdv.ironRec==='zero'){
                const highIronIds=['beef_lean','beef_minced','liver','pork_liver','beef_liver'];
                const cur=new Set(excludedFoods||[]); highIronIds.forEach(id=> cur.add(id)); setExcludedFoods([...cur]);
              }
            }} style={{ flex:1, padding:'6px 8px', borderRadius:7, border:'1px solid rgba(249,115,22,0.18)', background:'rgba(249,115,22,0.08)', color:'#f97316', fontSize:8, fontWeight:600, cursor:'pointer' }}>🍽 Применить к плану</button>
          </div>
        </GlassCard>
      )}

      {/* Кнопка генерации (Pro Engine — единый движок) */}
      {true && (
       <GlassCard title="🧬 Генерация плана" icon="🧬" color="#00e68a">
         <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:4, marginBottom:8 }}>
           {[
             { id:'pro' as const, label:'🧬 Pro', color:'#00e68a', hint:'Полный V2-анализ' },
             { id:'simple' as const, label:'🍽 Простой', color:'#60a5fa', hint:'КБЖУ без V2-оценок' },
             { id:'minimal' as const, label:'⚡ Быстрый', color:'#f59e0b', hint:'Минимум данных' },
           ].map(mode => <button key={mode.id} onClick={() => setPlannerMode(mode.id)} title={mode.hint} style={{ padding:'7px 3px', borderRadius:8, cursor:'pointer', fontSize:9, fontWeight:700, background: plannerMode === mode.id ? `${mode.color}22` : '#202023', border: plannerMode === mode.id ? `1px solid ${mode.color}` : '1px solid rgba(255,255,255,0.06)', color: plannerMode === mode.id ? mode.color : 'rgba(255,255,255,0.7)' }}>{mode.label}</button>)}
         </div>
         <div style={{ fontSize:8, color:'rgba(255,255,255,0.65)', marginBottom:8 }}>{plannerMode === 'pro' ? 'Полный подбор с V2-скорингом, микроанализом и расширенными рекомендациями.' : plannerMode === 'simple' ? 'Рацион подбирается по КБЖУ и ограничениям без V2-оценок.' : 'Остаются базовые параметры и сухое КБЖУ; необязательные настройки не используются.'}</div>
        {errorMsg && <div style={{ fontSize: 9, color: '#ef4444', padding: '4px 8px', background: 'rgba(239,68,68,0.06)', borderRadius: 6, marginBottom: 6 }}>⚠️ {errorMsg}</div>}
        {/* Два режима генерации: «по продуктам» (классика) и «по рецептам» */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, margin: '8px 0' }}>
          <button
            onClick={() => setGenerationMode('products')}
            aria-pressed={generationMode === 'products'}
            title="Классический рацион из продуктов с точными КБЖУ"
            style={{
              textAlign: 'left', padding: '12px 10px', borderRadius: 12, cursor: 'pointer',
              background: generationMode === 'products' ? 'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(0,200,160,0.10))' : '#202023',
              border: generationMode === 'products' ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.08)',
              boxShadow: generationMode === 'products' ? '0 4px 16px rgba(0,230,138,0.15)' : 'none',
              minHeight: 64,
            }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: generationMode === 'products' ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>🥩 По продуктам</div>
            <div style={{ fontSize: 9, color: generationMode === 'products' ? 'rgba(0,230,138,0.85)' : 'rgba(255,255,255,0.55)', marginTop: 3, lineHeight: 1.45 }}>
              Классический план из продуктов с точными КБЖУ и круглыми порциями (молоко 250/500/750 г)
            </div>
          </button>
          <button
            onClick={() => setGenerationMode('recipes')}
            aria-pressed={generationMode === 'recipes'}
            title="Основные приёмы собираются из готовых рецептов"
            style={{
              textAlign: 'left', padding: '12px 10px', borderRadius: 12, cursor: 'pointer',
              background: generationMode === 'recipes' ? 'linear-gradient(135deg, rgba(249,115,22,0.16), rgba(245,158,11,0.10))' : '#202023',
              border: generationMode === 'recipes' ? '2px solid #f97316' : '1px solid rgba(255,255,255,0.08)',
              boxShadow: generationMode === 'recipes' ? '0 4px 16px rgba(249,115,22,0.18)' : 'none',
              minHeight: 64,
            }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: generationMode === 'recipes' ? '#f97316' : 'rgba(255,255,255,0.85)' }}>🍳 По рецептам</div>
            <div style={{ fontSize: 9, color: generationMode === 'recipes' ? 'rgba(253,186,116,0.95)' : 'rgba(255,255,255,0.55)', marginTop: 3, lineHeight: 1.45 }}>
              Завтрак/обед/ужин — готовые рецепты: на каждый приём 2–3 варианта на выбор, день сходится в КБЖУ ±3%. Перекусы — продуктами
            </div>
          </button>
        </div>
        <div style={{ fontSize: 9, color: generationMode === 'recipes' ? 'rgba(253,186,116,0.9)' : 'rgba(255,255,255,0.7)', marginBottom: 8, lineHeight: 1.5 }}>
          {generationMode === 'recipes'
            ? '🍲 Генерация будет ТОЛЬКО по рецептам: каждый основной приём — цельное блюдо с ингредиентами и пошаговой готовкой. После выбора варианта рацион автоматически перестраивается (без недобора и перебора), закупки и процесс готовки обновятся под рецепты.'
            : '✅ Pro Engine: MPS · mTOR · лейцин 2.5г · LBM-белок · carb periodization · pre/intra/post-W · pre-sleep казеин'}
        </div>
        <button onClick={() => { try { const _err = _validatePlannerInput(); if (_err) { setErrorMsg(_err); return; } setErrorMsg(null); generatePlan(1); setPlanTab('plan'); } catch (e: any) { try { setErrorMsg('Ошибка: ' + (e?.message || String(e))); } catch {} } }} style={{
          width: '100%', padding: '12px', borderRadius: 10, cursor: 'pointer',
          fontSize: 12, fontWeight: 700,
          background: generationMode === 'recipes' ? 'linear-gradient(135deg,#f97316,#ea580c)' : 'linear-gradient(135deg,#00e68a,#00c8a0)', border: 'none', color: '#fff',
          boxShadow: generationMode === 'recipes' ? '0 4px 16px rgba(249,115,22,0.25)' : '0 4px 16px rgba(0,230,138,0.2)',
        }}>{generationMode === 'recipes' ? '🍳 Сгенерировать план по рецептам →' : '✨ Сгенерировать план питания →'}</button>
      </GlassCard>
      )}

      {true && (
      <GlassCard title="Пользователь" icon="👤" color="#a78bfa">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
          <PopupNumber label="⚖️ Вес (кг)" value={weight} min={30} max={250} suffix="кг" onChange={setWeight} />
          <PopupNumber label="📏 Рост (см)" value={height} min={100} max={250} suffix="см" onChange={setHeight} />
          <PopupNumber label="🎂 Возраст" value={age} min={10} max={120} suffix="лет" onChange={setAge} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <PopupSelect label="🧑 Пол" value={sex} options={[{id:'male',label:'Мужской'},{id:'female',label:'Женский'}]} onChange={v => setSex(v as 'male'|'female')} />
          <PopupNumber label="🚶 Шагов/день" value={dailySteps} min={0} max={50000} step={500} suffix="шаг" onChange={setDailySteps} />
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          <button onClick={() => {
            setWeight(s?.weight || weight);
            setHeight(s?.height || height);
            setAge(s?.age || age);
            setSex(s?.sex || sex);
            setDailySteps(s?.dailySteps || dailySteps);
            setBodyFatPct(s?.bodyFat || bodyFatPct);
            setSleepHours(s?.baselineSleepHours || sleepHours);
            setSleepQuality(s?.baselineSleepQuality || sleepQuality);
            setStressLevel(s?.baselineStressLevel || stressLevel);
            if (s?.primaryGoal) {
              const goalMap: Record<string, any> = { bulk: 'mass', cut: 'fat_loss', maintenance: 'maintenance', strength: 'strength', recomposition: 'recomposition', rehab: 'rehab' };
              setGoal(goalMap[s.primaryGoal] || 'maintenance');
            }
            if (s?.workoutsPerWeek) setMealsCount(Math.max(3, Math.min(10, s.workoutsPerWeek + 1)));
            if (s?.bedtime) setBedTime(s.bedtime);
            if (s?.wakeTime) setWakeTime(s.wakeTime);
          }} style={{
            flex: 1, padding:'6px 8px', borderRadius:8, cursor:'pointer', fontSize:9, fontWeight:600,
            background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.2)', color:'#60a5fa',
          }}>👤 Заполнить из профиля</button>
          <button onClick={() => {
            const labPoints = labs || [];
            if (labPoints.length === 0) { setErrorMsg('Нет анализов в «Лаборатория». Откройте вкладку анализов и загрузите результаты.'); return; }
            const newLabs: Record<string, string> = { ...v2Labs };
            const codeMap: Record<string, string> = {
              ALT: 'alt', AST: 'ast', GGT: 'ggt', LDL: 'ldl', HDL: 'hdl',
              TRIGLYCERIDES: 'triglycerides', CRP: 'crp', CREATININE: 'creatinine',
              HEMOGLOBIN: 'hemoglobin', HEMATOCRIT: 'hematocrit',
              ESTRADIOL: 'estradiol', TESTOSTERONE_TOTAL: 'testosterone',
              TESTOSTERONE_FREE: 'testosterone_free', GLUCOSE: 'glucose',
              TSH: 'tsh', T3: 't3', T4: 't4', PROLACTIN: 'prolactin',
              LH: 'lh', FSH: 'fsh', BILIRUBIN_TOTAL: 'bilirubin', BILIRUBIN: 'bilirubin',
              CHOLESTEROL: 'cholesterol', UREA: 'urea', URIC_ACID: 'uric_acid',
              INSULIN: 'insulin', FERRITIN: 'ferritin', IRON: 'iron',
              VITAMIN_D: 'vitamin_d', HOMOCYSTEINE: 'homocysteine', APOB: 'apob',
              // ВАЖНО (units-fix): POTASSIUM/SODIUM/MAGNESIUM НЕ импортируем — эти ключи
              // в v2Labs означают ДНЕВНЫЕ пищевые цели электролитов (мг), а не сывороточные
              // концентрации (ммоль/л). Импорт сыворотки сюда искажал карточку «Электролиты»
              // и давал ложные гиперкалиемию/гипернатриемию в диетической коррекции.
            };
            labPoints.forEach(lp => {
              const field = codeMap[String(lp.code || '').toUpperCase()];
              if (field && lp.value !== undefined && lp.value !== null) {
                newLabs[field] = String(Math.round(lp.value * 100) / 100);
              }
            });
            setV2Labs(newLabs);
          }} style={{
            flex: 1, padding:'6px 8px', borderRadius:8, cursor:'pointer', fontSize:9, fontWeight:600,
            background: (labs || []).length > 0 ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.03)',
            border: (labs || []).length > 0 ? '1px solid rgba(0,230,138,0.2)' : '1px solid rgba(255,255,255,0.06)',
            color: (labs || []).length > 0 ? '#00e68a' : 'rgba(255,255,255,0.5)',
            opacity: (labs || []).length > 0 ? 1 : 0.5,
          }}>🩸 Заполнить анализы ({(labs || []).length})</button>
        </div>
        <div style={{ marginBottom: 6 }}>
          <PopupNumber label="🍳 Время на готовку" value={cookTimeMin} min={0} max={300} step={5} suffix="мин" onChange={setCookTimeMin} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <PopupSelect label="👨‍🍳 Навык готовки" value={cookingSkill} options={[{id:'basic',label:'Базовый (простые блюда)'},{id:'medium',label:'Средний (готовлю регулярно)'},{id:'advanced',label:'Продвинутый (сложные рецепты)'}]} onChange={v => setCookingSkill(v as any)} />
          <PopupSelect label="📅 Частота готовки" value={cookingFrequency} options={[{id:'daily',label:'Каждый день'},{id:'every_3_days',label:'Раз в 3 дня'},{id:'weekly',label:'Раз в неделю (meal prep)'}]} onChange={v => setCookingFrequency(v as any)} />
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <button onClick={() => setBatchCooking(!batchCooking)} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 9, fontWeight: 600, textAlign: 'left', background: batchCooking ? 'rgba(34,197,94,0.08)' : '#202023', border: `1px solid ${batchCooking ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, color: batchCooking ? '#22c55e' : 'rgba(255,255,255,0.5)' }}>
            🍳 Готовка впрок: {batchCooking ? 'ВКЛ' : 'ВЫКЛ'}
          </button>
          <button onClick={() => setUseRecipesInPlan(!useRecipesInPlan)} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 9, fontWeight: 600, textAlign: 'left', background: useRecipesInPlan ? 'rgba(249,115,22,0.08)' : '#202023', border: `1px solid ${useRecipesInPlan ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.1)'}`, color: useRecipesInPlan ? '#f97316' : 'rgba(255,255,255,0.5)' }}>
            🍲 Рецепты в рационе: {useRecipesInPlan ? 'ВКЛ' : 'ВЫКЛ'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <PopupSelect label="🏋️ Тип тренировок" value={trainType} options={[{id:'strength',label:'Силовые'},{id:'cardio',label:'Кардио'},{id:'mixed',label:'Смешанные'},{id:'hiit',label:'HIIT'}]} onChange={v => setTrainType(v as string)} />
          <PopupSelect label="📊 Интенсивность" value={trainIntensity} options={[{id:'low',label:'Низкая'},{id:'medium',label:'Средняя'},{id:'high',label:'Высокая'}]} onChange={v => setTrainIntensity(v as string)} />
        </div>
        <div style={{ marginBottom: 6 }}>
          <button onClick={() => setIntraWorkoutEnabled(!intraWorkoutEnabled)} style={{ width:'100%', padding:'6px 8px', borderRadius:8, cursor:'pointer', fontSize:9, fontWeight:600, textAlign:'left', background: intraWorkoutEnabled ? 'rgba(34,197,94,0.08)' : '#202023', border:`1px solid ${intraWorkoutEnabled ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, color: intraWorkoutEnabled ? '#22c55e' : 'rgba(255,255,255,0.5)' }}>
            🏋️ Intra-workout (углеводы+изотоник во время тренировки): {intraWorkoutEnabled ? 'ВКЛ' : 'ВЫКЛ'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <PopupNumber label="🧈 % жира" value={bodyFatPct} min={3} max={60} step={0.5} suffix="%" onChange={setBodyFatPct} />
          <PopupSelect label="🏠 Быт. активность" value={householdActivity} options={[{id:'sedentary',label:'Сидячий'},{id:'light',label:'Лёгкая'},{id:'moderate',label:'Умеренная'},{id:'active',label:'Активная'}]} onChange={v => setHouseholdActivity(v as string)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
          <PopupNumber label="😴 Сон (часы)" value={sleepHours} min={3} max={14} step={0.5} suffix="ч" onChange={setSleepHours} />
          <PopupNumber label="🌟 Качество сна" value={sleepQuality} min={1} max={10} suffix="/10" onChange={setSleepQuality} />
          <PopupNumber label="😰 Стресс" value={stressLevel} min={1} max={10} suffix="/10" onChange={setStressLevel} />
        </div>
        {sex === 'female' && (
          <div style={{ marginBottom: 6 }}>
            <PopupSelect label="🌸 Фаза цикла" value={cyclePhase} options={[{id:'none',label:'Не указана'},{id:'follicular',label:'Фолликулярная'},{id:'ovulation',label:'Овуляция'},{id:'luteal',label:'Лютеиновая'},{id:'menstrual',label:'Менструация'}]} onChange={v => setCyclePhase(v as CycleType)} />
            <PopupSelect label="🏋 Категория" value={bbCategory} options={[{id:'none',label:'Не указана'}, ...categoriesForSex(sex).map(c => ({id:c.id,label:c.label}))]} onChange={v => setBBCategory(v as any)} />
            {sex === 'female' && <PopupSelect label="🌿 Жизненный этап" value={lifeStage} options={[{id:'none',label:'Нет'},{id:'pregnancy',label:'Беременность'},{id:'lactation',label:'Лактация'},{id:'menopause',label:'Менопауза'},{id:'contraception',label:'Контрацепция'}]} onChange={v => setLifeStage(v as any)} />}
          </div>
        )}
        {sex !== 'female' && (
          <div style={{ marginBottom: 6 }}>
            <PopupSelect label="🏋 Категория" value={bbCategory} options={[{id:'none',label:'Не указана'}, ...categoriesForSex(sex).map(c => ({id:c.id,label:c.label}))]} onChange={v => setBBCategory(v as any)} />
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom: 6 }}>
          <button onClick={() => setPeakWeekEnabled(!peakWeekEnabled)} style={{ padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:700, border:'none', background: peakWeekEnabled ? '#f59e0b' : 'rgba(255,255,255,0.08)', color: peakWeekEnabled ? '#000' : 'rgba(255,255,255,0.7)' }}>🏋 Peak-week {peakWeekEnabled ? 'ON' : 'OFF'}</button>
          {peakWeekEnabled && <select value={peakWeekShowDay} onChange={e => setPeakWeekShowDay(parseInt(e.target.value))} style={{ fontSize:10, padding:'2px', background:'#202023', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4 }}>
            {[0,1,2,3,4,5,6].map(d => <option key={d} value={d}>Show: день {d}</option>)}
          </select>}
        </div>
        <PopupNumber label="🍽 Голод/сытость (1–сыт, 10–голоден)" value={hungerLevel} min={1} max={10} suffix="/10" onChange={setHungerLevel} />
      </GlassCard>
      )}

      {/* 🏁 Тапер ББ — статус (единый план, настройка во вкладке «🏁 Тапер ББ») */}
       {(plannerMode === 'pro' || !!bbPrepConfig) && (
        <GlassCard title="Тапер ББ" icon="🏁" color="#f59e0b">
           <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', marginBottom: 8, lineHeight: 1.45 }}>
             {bbPrepConfig
               ? `● Активен: шоу ${bbPrepConfig.showDate} · ${bbPrepConfig.category} · тапер ${bbPrepConfig.weeksOut} нед. Настройка — во вкладке «🏁 Тапер ББ».`
               : 'Пикинг к шоу настраивается во вкладке «🏁 Тапер ББ» (полный редактор).'}
           </div>
           <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
             <button
               onClick={() => setPlanTab('peak')}
               style={{
                 flex: 1, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 700, minHeight: 44,
                 background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b',
               }}
             >
               ⚙ Настроить во вкладке «Тапер ББ»
             </button>
            {bbPrepConfig && (
              <button
                onClick={() => applyBBPeakToPlan(null)}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 700, minHeight: 44,
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444',
                }}
              >
                ✕ Отключить тапер
              </button>
            )}
          </div>
        </GlassCard>
      )}

        {/* 💧 Electrolytes — quick settings (фарма перенесена в «🧬 v2 Скоринг», здесь только электролиты во избежание дубля) */}
       {plannerMode === 'pro' && (
         <GlassCard title="💧 Электролиты" icon="💧" color="#06b6d4">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:6 }}>
            <PopupNumber label="Натрий" value={Number(v2Labs.sodium)||3500} min={0} max={10000} step={100} suffix="мг" onChange={v=>setV2Labs((p:any)=>({...p,sodium:v}))} />
            <PopupNumber label="Калий" value={Number(v2Labs.potassium)||4500} min={0} max={10000} step={100} suffix="мг" onChange={v=>setV2Labs((p:any)=>({...p,potassium:v}))} />
            <PopupNumber label="Магний" value={Number(v2Labs.magnesium)||400} min={0} max={2000} step={50} suffix="мг" onChange={v=>setV2Labs((p:any)=>({...p,magnesium:v}))} />
          </div>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.7)' }}>💡 Фармакология (ААС/ГР/инсулин/диуретики/стимуляторы/гепатопротекторы/ЖКТ) — в карточке «🧬 v2 Скоринг».</div>
        </GlassCard>
      )}

        {/* v2 Scoring Profile — moved to top */}
       {plannerMode === 'pro' && (
         <GlassCard title="🧬 v2 Скоринг" icon="🧬" color="#00e68a">
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 6, lineHeight: 1.3 }}>
            <div style={{ marginBottom: 4 }}>Качество рациона оценивается по шкале 0–10 на основе: состава макронутриентов, содержания клетчатки, профиля аминокислот и микронутриентной плотности. Результат влияет на подбор продуктов и расчёт итогового скоринга каждого приёма пищи.</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <span style={{ padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.08)', color:'#22c55e', fontSize:10 }}>7–10 — 🟢 Отлично</span>
              <span style={{ padding:'2px 6px', borderRadius:4, background:'rgba(245,158,11,0.08)', color:'#f59e0b', fontSize:10 }}>4–6 — 🟡 Средне</span>
              <span style={{ padding:'2px 6px', borderRadius:4, background:'rgba(239,68,68,0.08)', color:'#ef4444', fontSize:10 }}>1–3 — 🔴 Низко</span>
            </div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>Фаза</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {['LEAN_MASS', 'EXTREME_CUT', 'PEAK_WEEK', 'POST_CYCLE', 'MOST'].map(ph => (
                <button key={ph} onClick={() => setV2Phase(ph)} style={{
                  padding: '4px 10px', borderRadius: 10, fontSize: 8, fontWeight: 700, cursor: 'pointer',
                  background: v2Phase === ph ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : '#202023',
                  border: v2Phase === ph ? 'none' : '1px solid rgba(255,255,255,0.06)',
                  color: v2Phase === ph ? '#000' : 'rgba(255,255,255,0.7)',
                }}>{ph === 'LEAN_MASS' ? '💪 Набор' : ph === 'EXTREME_CUT' ? '🔥 Сушка' : ph === 'PEAK_WEEK' ? '⚡ Пик' : ph === 'POST_CYCLE' ? '🔄 ПКТ' : '🌉 Мост'}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>Фармакология</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {[
                { id: 'AAS_ORAL', label: '💊 Оральные ААС', color: '#ef4444' },
                { id: 'AAS_INJECTABLE', label: '💉 Инъекционные ААС', color: '#ef4444' },
                { id: 'HGH', label: '🧬 HGH/Пептиды', color: '#8b5cf6' },
                { id: 'DIURETICS', label: '💧 Диуретики', color: '#f59e0b' },
                { id: 'STIMULATORS', label: '⚡ Стимуляторы', color: '#f97316' },
                { id: 'INSULIN_USE', label: '💉 Инсулин', color: '#8b5cf6' },
                { id: 'LIVER_SUPPORT', label: '🫁 Гепатопротекторы', color: '#22c55e' },
                { id: 'GUT_SUPPORT', label: '🫃 Поддержка ЖКТ', color: '#22c55e' },
              ].map(p => (
                <button key={p.id} onClick={() => setV2Pharma((prev: Record<string, boolean>) => ({ ...prev, [p.id]: !prev[p.id] }))} style={{
                  padding: '3px 8px', borderRadius: 8, fontSize: 7, fontWeight: 600, cursor: 'pointer',
                  background: v2Pharma[p.id] ? p.color + '20' : '#202023',
                  border: v2Pharma[p.id] ? `1px solid ${p.color}40` : '1px solid rgba(255,255,255,0.04)',
                  color: v2Pharma[p.id] ? p.color : 'rgba(255,255,255,0.5)',
                }}>{p.label}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>Лабораторные (v2)</div>
            <button onClick={() => {
              const labPoints = labs || [];
if (labPoints.length === 0) { setErrorMsg('Нет анализов в «Лаборатория». Откройте вкладку анализов и загрузите результаты.'); return; }
              const newLabs: Record<string, string> = { ...v2Labs };
              const codeMap: Record<string, string> = {
                ALT: 'alt', AST: 'ast', GGT: 'ggt', LDL: 'ldl', HDL: 'hdl',
                TRIGLYCERIDES: 'triglycerides', CRP: 'crp', CREATININE: 'creatinine',
                HEMOGLOBIN: 'hemoglobin', HEMATOCRIT: 'hematocrit',
                ESTRADIOL: 'estradiol', TESTOSTERONE_TOTAL: 'testosterone',
                TESTOSTERONE_FREE: 'testosterone_free', GLUCOSE: 'glucose',
                TSH: 'tsh', T3: 't3', T4: 't4', PROLACTIN: 'prolactin',
                LH: 'lh', FSH: 'fsh', BILIRUBIN_TOTAL: 'bilirubin', BILIRUBIN: 'bilirubin',
                CHOLESTEROL: 'cholesterol', UREA: 'urea', URIC_ACID: 'uric_acid',
                INSULIN: 'insulin', FERRITIN: 'ferritin', IRON: 'iron',
                VITAMIN_D: 'vitamin_d', HOMOCYSTEINE: 'homocysteine', APOB: 'apob',
                // POTASSIUM/SODIUM/MAGNESIUM — НЕ импортируем (пищевые цели в мг, не сыворотка).
              };
              labPoints.forEach(lp => {
                const field = codeMap[String(lp.code || '').toUpperCase()];
                if (field && lp.value !== undefined && lp.value !== null) {
                  newLabs[field] = String(Math.round(lp.value * 100) / 100);
                }
              });
              setV2Labs(newLabs);
              setErrorMsg(null);
            }} style={{
              width: '100%', padding:'6px 8px', borderRadius:8, cursor:'pointer', fontSize:9, fontWeight:600,
              background: (labs || []).length > 0 ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.03)',
              border: (labs || []).length > 0 ? '1px solid rgba(0,230,138,0.2)' : '1px solid rgba(255,255,255,0.06)',
              color: (labs || []).length > 0 ? '#00e68a' : 'rgba(255,255,255,0.5)',
              marginBottom: 6,
            }}>🩸 Заполнить из анализов ({(labs || []).length})</button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
              <PopupNumber label="Гематокрит" value={parseFloat(v2Labs.hematocrit)||0} min={0} max={70} step={0.1} suffix="%" onChange={v=>setV2Labs((p:any)=>({...p,hematocrit:String(v)}))} />
              <PopupNumber label="Гемоглобин" value={parseFloat(v2Labs.hemoglobin)||0} min={0} max={250} step={1} suffix="г/л" onChange={v=>setV2Labs((p:any)=>({...p,hemoglobin:String(v)}))} />
              <PopupNumber label="ЛПВП" value={parseFloat(v2Labs.hdl)||0} min={0} max={3} step={0.1} suffix="ммоль/л" onChange={v=>setV2Labs((p:any)=>({...p,hdl:String(v)}))} />
              <PopupNumber label="ЛПНП" value={parseFloat(v2Labs.ldl)||0} min={0} max={10} step={0.1} suffix="ммоль/л" onChange={v=>setV2Labs((p:any)=>({...p,ldl:String(v)}))} />
              <PopupNumber label="АЛТ" value={parseFloat(v2Labs.alt)||0} min={0} max={500} step={1} suffix="Ед/л" onChange={v=>setV2Labs((p:any)=>({...p,alt:String(v)}))} />
              <PopupNumber label="АСТ" value={parseFloat(v2Labs.ast)||0} min={0} max={500} step={1} suffix="Ед/л" onChange={v=>setV2Labs((p:any)=>({...p,ast:String(v)}))} />
              <PopupNumber label="СРБ" value={parseFloat(v2Labs.crp)||0} min={0} max={200} step={0.5} suffix="мг/л" onChange={v=>setV2Labs((p:any)=>({...p,crp:String(v)}))} />
              <PopupNumber label="Тестостерон" value={parseFloat(v2Labs.testosterone)||0} min={0} max={60} step={0.5} suffix="нмоль/л" onChange={v=>setV2Labs((p:any)=>({...p,testosterone:String(v)}))} />
            </div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>Чувствительность к гистамину</div>
            <button onClick={() => setHistamineSensitive(!histamineSensitive)} style={{
              padding: '4px 10px', borderRadius: 10, fontSize: 8, fontWeight: 700, cursor: 'pointer',
              background: histamineSensitive ? 'rgba(239,68,68,0.15)' : '#202023',
              border: histamineSensitive ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.06)',
              color: histamineSensitive ? '#ef4444' : 'rgba(255,255,255,0.5)',
            }}>{histamineSensitive ? '⚠️ Чувствителен к гистамину' : '✅ Не чувствителен'}</button>
          </div>
        </GlassCard>
      )}

      {plannerMode === 'pro' && (
      <GlassCard title="Диетические паузы" icon="🔄" color="#a78bfa">
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {[['none','⏹️ Нет','Без пауз'],['refeed','🍝 Рефид','1 день повыш. угл.'],['flex_80_20','📊 80/20','20% гибкость'],['periodization_2_1','⏳ 2+1','2 нед деф. + 1 нед'],['diet_5_2','📅 5/2','5 дней норм + 2 облегч.']].map(([id,label,desc]) => (
            <button key={id} onClick={() => setDietPauseMode(id as any)} style={{
              flex:1, minWidth:70, padding:'8px 6px', borderRadius:10, cursor:'pointer', textAlign:'center',
              background: dietPauseMode === id ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.02)',
              border: dietPauseMode === id ? '1.5px solid #a78bfa' : '1px solid rgba(255,255,255,0.05)',
              color: dietPauseMode === id ? '#a78bfa' : 'rgba(255,255,255,0.7)',
              transition:'all 0.12s', fontWeight: dietPauseMode === id ? 700 : 400, fontSize:9,
            }}>
              <div style={{ fontSize:12, marginBottom:2 }}>{label.slice(0,2)}</div>
              <div style={{ fontWeight:600 }}>{label.slice(2)}</div>
              <div style={{ fontSize:6, color:'rgba(255,255,255,0.8)', marginTop:2 }}>{desc}</div>
            </button>
          ))}
        </div>
        {dietPauseMode !== 'none' && (
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', padding:'6px 8px', borderRadius:6, background:'rgba(167,139,250,0.04)', border:'1px solid rgba(167,139,250,0.08)', lineHeight:1.5 }}>
            {dietPauseMode === 'refeed' && '🍝 Рефид: 1 день в неделю повысить углеводы до 4-5 г/кг. Снижает лептин, восстанавливает гликоген, ускоряет метаболизм. Рекомендуется после 2+ недель дефицита.'}
            {dietPauseMode === 'flex_80_20' && '📊 80/20: 80% рациона — цельные продукты из плана, 20% — любые продукты по выбору. Снижает психологическое давление диеты, повышает приверженность.'}
            {dietPauseMode === 'periodization_2_1' && '⏳ 2+1: 2 недели строгого дефицита → 1 неделя поддержания. Предотвращает метаболическую адаптацию и плато жиросжигания.'}
            {dietPauseMode === 'diet_5_2' && '📅 5/2: 5 дней нормального питания по плану → 2 дня облегчённых (50% ккал, акцент на белок + овощи). Популярно для длительного жиросжигания.'}
          </div>
        )}
      </GlassCard>
      )}

      {true && (
      <GlassCard title="Цель" icon="🎯" color="#00e68a">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {GOALS.map(g => (
            <PillBtn key={g.id} active={goal === g.id} onClick={() => { setGoal(g.id); setGoalUserSet(true); }} color={goal === g.id ? '#00e68a' : undefined}>
              {g.icon} {g.label}
              {autoGoal === g.id && !goalUserSet && <span style={{ marginLeft: 3, fontSize: 7, color: '#00e68a', fontWeight: 800 }}>⚡</span>}
            </PillBtn>
          ))}
        </div>
        {autoGoal !== goal && goalUserSet && (
          <div style={{ marginTop: 4, fontSize: 8, color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>
            Фаза «{PHASES.find(p => p.id === phase)?.label}» → рекомендована цель «{GOALS.find(g => g.id === autoGoal)?.label}».
            <span onClick={() => { setGoal(autoGoal); setGoalUserSet(false); }} style={{ color: '#00e68a', cursor: 'pointer', fontWeight: 600, marginLeft: 2 }}>Применить</span>
          </div>
        )}
        {goal === 'mass' && (
          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.08)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#00e68a' }}>📈 Профицит: +{surplusPct}%</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#00e68a', background: 'rgba(0,230,138,0.1)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(0,230,138,0.15)' }}>
                +{Math.round((kbjuMode !== 'manual' ? effectiveKcal : (manualKcal ?? effectiveKcal)) * surplusPct / 100)} ккал
              </span>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)' }}>{surplusPct < 10 ? 'Мягкий' : surplusPct < 18 ? 'Умеренный' : 'Агрессивный'}</span>
            </div>
            <input type="range" min="5" max="25" value={surplusPct} onChange={e => { const v = +e.target.value; setSurplusPct(v); try { localStorage.setItem('he_surplus_pct', v.toString()); } catch {} }} style={{ width:'100%', margin:'2px 0' }} />
            <div style={{ display:'flex', justifyContent:'space-between', fontSize: 7, color: 'rgba(255,255,255,0.75)' }}>
              <span>+5% (мин.)</span>
              <span>+15%</span>
              <span>+25% (макс.)</span>
            </div>
          </div>
        )}
      </GlassCard>
      )}
      {goal === 'mass' && periodizationEnabled && (
        <div style={{ marginTop: 4, padding: '8px 10px', borderRadius: 10, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.08)' }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#8b5cf6', marginBottom: 6 }}>🕐 Таймлайн фаз</div>
          <div style={{ display:'flex', gap: 1, height: 20, borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ flex: 1, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,230,138,0.2)', color:'#00e68a', fontSize: 7, fontWeight: 700 }}>ПРОФ.</div>
            <div style={{ flex: 1, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(59,130,246,0.2)', color:'#60a5fa', fontSize: 7, fontWeight: 700 }}>ПОДД.</div>
            <div style={{ flex: 1, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.2)', color:'#ef4444', fontSize: 7, fontWeight: 700 }}>ДЕФ.</div>
            <div style={{ flex: 1, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(59,130,246,0.2)', color:'#60a5fa', fontSize: 7, fontWeight: 700 }}>ПОДД.</div>
            <div style={{ flex: 1, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,230,138,0.2)', color:'#00e68a', fontSize: 7, fontWeight: 700 }}>ПРОФ.</div>
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
            Чередование 2 нед профицит (+{surplusPct}%) → 2 нед поддержание → 2 нед дефицит (−20%) → 2 нед поддержание → повтор. 
            <span style={{ color: '#8b5cf6' }}> Метаболическая адаптация: {(surplusPct > 15 ? 'высокая' : 'низкая')}</span>
          </div>
        </div>
      )}

      {plannerMode === 'pro' && (
      <GlassCard title="Фаза и препараты" icon="💉" color="#06b6d4">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
          {PHASES.map(p => (
            <PillBtn key={p.id} active={phase === p.id} onClick={() => setPhase(p.id)}>{p.icon} {p.label}</PillBtn>
          ))}
        </div>
        {courseEntries.length > 0 && (
          <div style={{ fontSize: 9, color: '#a78bfa', marginBottom: 6, padding: '4px 8px', borderRadius: 6, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
            📋 Загружено {courseEntries.length} препаратов из курса
          </div>
        )}
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, marginBottom: 6 }}>Добавленные инъекции:</div>
        <div style={{ marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {injections.map((inj, i) => {
            const canLink = inj.type === 'инсулин' || inj.type === 'ИФР-1';
            return (
            <div key={inj.id} style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#fff' }}>
                <span>💉</span>
                <strong style={{ color: '#06b6d4' }}>{inj.time}</strong>
                <span style={{ fontWeight: 600 }}>{inj.name}</span>
                <span style={{ color: 'rgba(255,255,255,0.9)' }}>{inj.dose}{inj.unit}</span>
                {inj.esterType !== 'none' && <span style={{color:'rgba(255,255,255,0.8)',fontSize:9}}>({inj.esterType})</span>}
                {canLink && (
                  <button onClick={() => {
                    if (!linkToTraining) setLinkToTraining(true);
                    setInjections(injections.map((j2, j) => j === i ? { ...j2, trainLinked: !j2.trainLinked, trainTiming: !j2.trainLinked ? 'before' : 'none' } : j2));
                  }} style={{
                    fontSize: 7, padding: '2px 5px', borderRadius: 4, cursor: 'pointer', fontWeight: 600,
                    background: inj.trainLinked ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.05)',
                    border: inj.trainLinked ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    color: inj.trainLinked ? '#00e68a' : '#fff',
                  }}>🏋️</button>
                )}
                {canLink && inj.trainLinked && (['before', 'after', 'both'] as const).map(t => (
                  <button key={t} onClick={() => setInjections(injections.map((j2, j) => j === i ? { ...j2, trainTiming: t } : j2))} style={{
                    fontSize: 6, padding: '1px 4px', borderRadius: 3, cursor: 'pointer', fontWeight: 600,
                    background: inj.trainTiming === t ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                    border: inj.trainTiming === t ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    color: inj.trainTiming === t ? '#60a5fa' : '#fff',
                  }}>{t === 'before' ? 'До' : t === 'after' ? 'После' : 'До+После'}</button>
                ))}
                <button onClick={() => setInjections(injections.filter((_, j) => j !== i))} style={{ marginLeft: 'auto', background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', fontSize: 10, cursor: 'pointer', borderRadius: 4, padding: '2px 6px' }}>✕</button>
              </div>
            </div>);
          })}
        </div>
        <button onClick={() => setShowAddDrug(true)} style={{ width:'100%', padding:'8px', borderRadius:10, cursor:'pointer', border:'1px solid rgba(6,182,212,0.2)', background:'rgba(6,182,212,0.06)', color:'#06b6d4', fontSize:9, fontWeight:600 }}>
          + Добавить инъекцию
        </button>
        {showAddDrug && (
          <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.7)' }}
            onClick={() => setShowAddDrug(false)}>
            <div onClick={e => e.stopPropagation()} style={{ width:340, padding:20, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.15)', boxShadow:'0 8px 40px rgba(0,0,0,0.4)' }}>
              <div style={{ fontSize:15, fontWeight:700, color:'#fff', marginBottom:14, textAlign:'center', letterSpacing:-0.3 }}>💉 Добавить инъекцию</div>
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:4 }}>Тип препарата:</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
                  {[
                    { id:'инсулин', icon:'💉' }, { id:'ГР', icon:'📈' }, { id:'ИФР-1', icon:'🧬' },
                    { id:'пептид', icon:'🔬' }, { id:'ААС', icon:'⚡' }, { id:'другое', icon:'📦' },
                  ].map(dt => (
                    <button key={dt.id} onClick={() => { setInjType(dt.id); setInjName(dt.id); }} style={{
                      padding:'8px 4px', borderRadius:10, cursor:'pointer', textAlign:'center',
                      background: injType === dt.id ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.03)',
                      border: injType === dt.id ? '1px solid #06b6d4' : '1px solid rgba(255,255,255,0.06)',
                      color: injType === dt.id ? '#06b6d4' : 'rgba(255,255,255,0.7)',
                      fontWeight: injType === dt.id ? 700 : 400, fontSize:10, transition:'all 0.15s',
                    }}>
                      <div style={{ fontSize:14 }}>{dt.icon}</div>
                      <div>{dt.id}</div>
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setShowDrugTypePicker(true)} style={{
                width:'100%', padding:'6px', borderRadius:8, cursor:'pointer', fontSize:9, marginBottom:10,
                background:'rgba(139,92,246,0.08)', border:'1px dashed rgba(139,92,246,0.25)', color:'#a78bfa', fontWeight:600,
              }}>📋 Все типы препаратов ({injectDrugTypes.length})</button>
              <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:2 }}>Доза</div>
                  <input type="number" min={0} step="any" value={injDose} onChange={e => setInjDose(Math.max(0, +e.target.value || 0))} style={{ ...inputStyle, width:'100%', fontSize:12, padding:'8px 10px', boxSizing:'border-box' }} />
                </div>
                <div style={{ width:60 }}>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:2 }}>Ед.</div>
                  <select value={injUnit} onChange={e => setInjUnit(e.target.value)} style={{ ...selectStyle, width:'100%', fontSize:10, padding:'8px 6px' }}>
                    <option value="mg">mg</option><option value="mcg">mcg</option><option value="IU">IU</option><option value="ml">ml</option>
                  </select>
                </div>
                <div style={{ width:70 }}>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:2 }}>Время</div>
                  <input type="time" value={injTime} onChange={e => setInjTime(e.target.value)} style={{ ...inputStyle, width:'100%', fontSize:10, padding:'8px 6px', boxSizing:'border-box' }} />
                </div>
              </div>
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:3 }}>Эфир:</div>
                <div style={{ display:'flex', gap:3 }}>
                  {[
                    { id:'none', label:'Авто' },
                    { id:'rapid', label:'Быстрый' },
                    { id:'short', label:'Короткий' },
                    { id:'long', label:'Длинный' },
                  ].map(e => (
                    <button key={e.id} onClick={() => setInjEster(e.id as any)} style={{
                      flex:1, padding:'5px', borderRadius:6, cursor:'pointer', fontSize:9, fontWeight:600,
                      background: injEster === e.id ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.03)',
                      border: injEster === e.id ? '1px solid #06b6d4' : '1px solid rgba(255,255,255,0.06)',
                      color: injEster === e.id ? '#06b6d4' : 'rgba(255,255,255,0.7)',
                    }}>{e.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => setShowAddDrug(false)} style={{ flex:1, padding:'10px', borderRadius:10, cursor:'pointer', border:'1px solid rgba(255,255,255,0.15)', background:'#202023', color:'#fff', fontSize:10, fontWeight:600 }}>Отмена</button>
                <button onClick={() => {
                  const name = injName.trim() || injType;
                  if (!name) return;
                  // FIX input-audit: доза должна быть > 0 (0/отрицательная давала «На 0г углеводов»)
                  if (!Number.isFinite(injDose) || injDose <= 0) { setErrorMsg('Укажите дозу больше 0'); return; }
                  const sub = PHARMA_DB[name]; const hl = sub?.pk?.halfLifeHours || 24;
                  let dt = injType, de = injEster;
                  if (sub?.class === 'insulin') { dt = 'инсулин'; de = hl < 2 ? 'rapid' : hl <= 8 ? 'short' : 'long'; }
                  let autoTime = +injTime.split(':')[0] * 60 + +injTime.split(':')[1] > 0 ? injTime : '08:00';
                  if (dt === 'инсулин' && de === 'long') autoTime = '22:00';
                  if (injEster !== 'none') de = injEster;
                  const newInj = { id: Date.now().toString(), name, time: autoTime, dose: injDose, unit: injUnit, type: dt, esterType: de, halfLifeHours: hl, trainLinked: false, trainTiming: 'none' as const };
                  setInjections([...injections, newInj]);
                  setInjName(''); setShowAddDrug(false);
                }} style={{ flex:1, padding:'10px', borderRadius:10, cursor:'pointer', border:'none', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontSize:10, fontWeight:700 }}>✓ Добавить</button>
              </div>
            </div>
          </div>
        )}
        {showDrugTypePicker && (
          <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }}
            onClick={() => setShowDrugTypePicker(false)}>
            <div onClick={e => e.stopPropagation()} style={{ width:'90%', maxWidth:380, maxHeight:'80vh', padding:16, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.15)', overflowY:'auto' }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#fff', marginBottom:10, textAlign:'center' }}>📋 Выберите тип препарата</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
                {injectDrugTypes.map(d => {
                  const icons: Record<string,string> = { инсулин:'💉', ГР:'📈', 'ИФР-1':'🧬', MGF:'🔬', 'IGF-1 DES':'🧬', 'IGF-1 LR3':'🧬', HMG:'💊', HCG:'💊', GHRP:'🧪', CJC:'🧪', 'BPC-157':'🩹', 'TB-500':'🩹', меланотан:'🎨', семаглутид:'⚖️', тирзепатид:'⚖️', другое:'📦', пептид:'🔬', ААС:'⚡' };
                  return (
                    <button key={d} onClick={() => { setInjType(d); setInjName(d); setShowDrugTypePicker(false); }} style={{
                      display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                      padding:'10px 4px', borderRadius:10, cursor:'pointer', textAlign:'center',
                      background: injType === d ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.03)',
                      border: injType === d ? '2px solid #06b6d4' : '1px solid rgba(255,255,255,0.06)',
                      color: injType === d ? '#06b6d4' : 'rgba(255,255,255,0.8)',
                      fontWeight: injType === d ? 700 : 400, fontSize:9, transition:'all 0.1s',
                    }}>
                      <span style={{ fontSize:18 }}>{icons[d] || '📦'}</span>
                      <span>{d}</span>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setShowDrugTypePicker(false)} style={{ width:'100%', marginTop:8, padding:'8px', borderRadius:8, border:'1px solid rgba(255,255,255,0.15)', background:'#202023', color:'#fff', cursor:'pointer', fontSize:10 }}>Закрыть</button>
            </div>
          </div>
        )}
        <div style={{ marginTop:10, padding:'10px 12px', borderRadius:10, background:'rgba(139,92,246,0.04)', border:'1px solid rgba(139,92,246,0.1)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ fontSize:10, fontWeight:600, color:'#c4b5fd' }}>🌿 Принимаю БАД: {takenSupplements.length}</span>
            <button onClick={() => { setSuppSearch(''); setShowSuppPicker(true); }} style={{
              padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:9, fontWeight:600,
              background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.2)', color:'#a78bfa',
            }}>+ Выбрать</button>
          </div>
          {takenSupplements.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
              {takenSupplements.slice(0,12).map(sid => {
                const sub = SUPPORT_CATALOG_DATA[sid] || ALL_SUBSTANCES.find(s => s.id === sid);
                return (
                  <span key={sid} style={{ fontSize:9, padding:'2px 6px', borderRadius:4, background:'rgba(139,92,246,0.08)', color:'#a78bfa', display:'flex', alignItems:'center', gap:4 }}>
                    {sub?.name || sid}
                    <span onClick={() => setTakenSupplements(takenSupplements.filter(x => x !== sid))} style={{ cursor:'pointer', color:'#ef4444', fontWeight:700 }}>×</span>
                  </span>
                );
              })}
              {takenSupplements.length > 12 && <span style={{ fontSize:9, color:'rgba(255,255,255,0.85)', padding:'2px 4px' }}>+{takenSupplements.length-12}</span>}
            </div>
          )}
        </div>
        {showSuppPicker && (
          <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }}
            onClick={() => setShowSuppPicker(false)}>
            <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:400, maxHeight:'85vh', padding:16, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.15)', overflowY:'auto' }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#c4b5fd', marginBottom:8, textAlign:'center' }}>🌿 Выберите принимаемые БАД</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input value={suppSearch} onChange={e => setSuppSearch(e.target.value)} placeholder="Поиск БАД..." style={{ ...inputStyle, flex: 1, fontSize:11, padding:'8px 10px', boxSizing:'border-box' }} />
                <button onClick={() => {
                  try {
                    // Общий план (he_general_plan) = калькулятор ∪ внешние вещества (миксы/питание)
                    const generalData = JSON.parse(localStorage.getItem('he_general_plan') || 'null');
                    let merged: string[] = (generalData && Array.isArray(generalData)) ? generalData : [];
                    // Фолбэк: если общий план ещё не сформирован — берём план калькулятора + внешние
                    if (merged.length === 0) {
                      const planData = JSON.parse(localStorage.getItem('he_support_plan_result') || 'null');
                      const planIds: string[] = (planData && Array.isArray(planData)) ? planData : [];
                      let extIds: string[] = [];
                      try { const _raw = localStorage.getItem('he_support_external_subs'); const _entries = _raw ? JSON.parse(_raw) : []; if (Array.isArray(_entries)) { extIds = _entries.flatMap((e: any) => (e && Array.isArray(e.ids)) ? e.ids : []); } } catch {}
                      merged = [...new Set([...planIds, ...extIds])];
                    }
                    const newIds = merged.filter((id: string) => !takenSupplements.includes(id));
                    if (newIds.length > 0) setTakenSupplements([...takenSupplements, ...newIds]);
                  } catch {}
                }} style={{
                  padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:9, fontWeight:600, whiteSpace:'nowrap',
                  background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.2)', color:'#a78bfa',
                }}>📋 Из плана</button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:'50vh', overflowY:'auto' }}>
                {ALL_SUBSTANCES.filter(s => !suppSearch || (s.name||'').toLowerCase().includes(suppSearch.toLowerCase()) || (s.id||'').toLowerCase().includes(suppSearch.toLowerCase())).slice(0,80).map(s => {
                  const sel = takenSupplements.includes(s.id);
                  return (
                    <div key={s.id} onClick={() => sel ? setTakenSupplements(takenSupplements.filter(x => x !== s.id)) : setTakenSupplements([...takenSupplements, s.id])} style={{
                      padding:'6px 8px', borderRadius:8, cursor:'pointer', fontSize:9,
                      background: sel ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)',
                      border: sel ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
                      color: sel ? '#c4b5fd' : 'rgba(255,255,255,0.7)',
                      display:'flex', alignItems:'center', gap:6,
                    }}>
                      <span style={{ fontSize:9, minWidth:12 }}>{sel ? '✓' : '○'}</span>
                      <span>{s.name}</span>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setShowSuppPicker(false)} style={{ width:'100%', marginTop:8, padding:'8px', borderRadius:8, border:'1px solid rgba(255,255,255,0.15)', background:'#202023', color:'#fff', cursor:'pointer', fontSize:10 }}>Готово ({takenSupplements.length})</button>
            </div>
          </div>
        )}
      </GlassCard>
      )}

      {true && (
      <GlassCard title="Привязка к тренировке" icon="🏋️" color="#22c55e">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <button onClick={() => setLinkToTraining(!linkToTraining)} style={{
            width: 36, height: 20, borderRadius: 10, cursor: 'pointer', border: 'none',
            background: linkToTraining ? '#00e68a' : 'rgba(255,255,255,0.7)',
            position: 'relative' as const, transition: 'background 0.2s',
          }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: linkToTraining ? 18 : 2, transition: 'left 0.2s' }} />
          </button>
          <span style={{ fontSize: 10, color: linkToTraining ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>Привязать рацион к тренировке</span>
        </div>
        {linkToTraining && (
          <>
            <div style={{ display: 'flex', gap: 4, fontSize: 9, marginBottom: 6 }}>
              <div><label style={{ color: 'rgba(255,255,255,0.85)' }}>Начало</label><input type="time" value={trainStart} onChange={e => setTrainStart(e.target.value)} style={inputStyle} /></div>
              <div><label style={{ color: 'rgba(255,255,255,0.85)' }}>Конец</label><input type="time" value={trainEnd} onChange={e => setTrainEnd(e.target.value)} style={inputStyle} /></div>
            </div>
            {/* FIX train-bind: плавающий график — недельный / через день / цикл N+M */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              {([
                { id: 'weekly' as const, label: '📅 Неделя' },
                { id: 'eod' as const, label: '🔁 Через день' },
                { id: 'pattern' as const, label: '🔢 Цикл N+M' },
              ]).map(opt => (
                <button key={opt.id} onClick={() => setTrainScheduleType(opt.id)} style={{
                  flex: 1, padding: '5px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 8, fontWeight: 600,
                  background: trainScheduleType === opt.id ? 'rgba(34,197,94,0.2)' : '#202023',
                  border: trainScheduleType === opt.id ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.06)',
                  color: trainScheduleType === opt.id ? '#22c55e' : 'rgba(255,255,255,0.7)',
                }}>{opt.label}</button>
              ))}
            </div>
            {trainScheduleType === 'pattern' && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6, fontSize: 9 }}>
                <span style={{ color: 'rgba(255,255,255,0.85)' }}>Цикл:</span>
                <input type="number" min={1} max={7} value={trainPattern.work} onChange={e => { const v = Math.max(1, Math.min(7, parseInt(e.target.value) || 1)); setTrainPattern({ ...trainPattern, work: v }); }} style={{ ...inputStyle, width: 48 }} aria-label="Тренировочных дней в цикле" />
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>тр +</span>
                <input type="number" min={1} max={7} value={trainPattern.off} onChange={e => { const v = Math.max(1, Math.min(7, parseInt(e.target.value) || 1)); setTrainPattern({ ...trainPattern, off: v }); }} style={{ ...inputStyle, width: 48 }} aria-label="Дней отдыха в цикле" />
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>отдых</span>
              </div>
            )}
            {trainScheduleType === 'weekly' && (
              <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)', marginBottom: 6 }}>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>Выберите тренировочные дни:</div>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                  {DAY_LABELS.map((label, idx) => {
                    const isTrain = trainingDays[idx];
                    return (
                      <button key={idx} onClick={() => {
                        setTrainingDays(trainingDays.map((d, i) => i === idx ? !d : d));
                      }} style={{
                        width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                        border: isTrain ? '2px solid #22c55e' : '2px solid #3f3f46',
                        background: isTrain ? 'rgba(34,197,94,0.2)' : '#202023',
                        color: isTrain ? '#22c55e' : 'rgba(255,255,255,0.85)',
                        fontSize: 9, fontWeight: isTrain ? 800 : 500,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}>{label}</button>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ fontSize: 9, color: '#22c55e', marginBottom: 6, padding: '5px 8px', borderRadius: 8, background: 'rgba(34,197,94,0.08)' }}>
              {trainScheduleType === 'eod' && '🔁 Через день (EOD): 3-4 тренировки в неделе'}
              {trainScheduleType === 'pattern' && `🔢 Цикл ${trainPattern.work}+${trainPattern.off}: ${trainPattern.work} тр / ${trainPattern.off} отдых`}
              {trainScheduleType === 'weekly' && `📅 ${trainingDays.filter(Boolean).length} тренировочных дней: ${DAY_LABELS.filter((_, i) => trainingDays[i]).join(', ') || '—'}`}
            </div>
            {/* Синхронизация с профилем — только по кнопке */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={autofillFromProfile} style={{ flex: 1, padding: '6px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 8, fontWeight: 600, background: '#202023', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa' }} title="Загрузить график тренировок из Профиля">📋 Из профиля</button>
              <button onClick={saveToProfile} style={{ flex: 1, padding: '6px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 8, fontWeight: 600, background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.3)', color: '#00e68a' }} title="Сохранить график тренировок в Профиль">💾 Сохранить в профиль</button>
            </div>
          </>
        )}
      </GlassCard>
      )}

      {true && (
      <GlassCard title="КБЖУ" icon="📊" color="#00e68a">
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {(['auto', 'manual', 'profile'] as const).map(mode => {
            const labels: Record<string, string> = { auto: '🤖 Авторасчёт', manual: '✏️ Ручной ввод', profile: '👤 Из профиля' };
            const colors: Record<string, string> = { auto: '#00e68a', manual: '#f59e0b', profile: '#60a5fa' };
            return (
              <button key={mode} onClick={() => switchKbjuMode(mode)} style={{
                flex: 1, padding: '5px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 8, fontWeight: 600,
                background: kbjuMode === mode ? `${colors[mode]}20` : '#202023',
                border: kbjuMode === mode ? `1px solid ${colors[mode]}` : '1px solid rgba(255,255,255,0.06)',
                color: kbjuMode === mode ? '#000' : 'rgba(255,255,255,0.7)',
              }}>{labels[mode]}</button>
            );
          })}
        </div>
        {(() => {
          // FIX 1.5: предупреждение, если метрики тела = дефолтам (профиль не заполнен).
          // Профиль читаем напрямую, чтобы не зависеть от локальных правок в планировщике.
          let _incomplete = false;
          try {
            const _p = getProfile()?.settings as any;
            const _pers = _p?.personal || {};
            if (!_pers.weight || !_pers.height || !_pers.age || !_pers.sex) _incomplete = true;
          } catch {}
          if (!_incomplete) return null;
          return (
            <div style={{ fontSize: 8, color: '#f59e0b', marginBottom: 8, padding: '5px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
              ⚠️ В профиле не заполнены метрики тела (вес/рост/возраст/пол) — КБЖУ считается по дефолтам (80кг / 180см / 30л). Откройте «Профиль → Пользователь» или нажмите «👤 Из профиля».
            </div>
          );
        })()}
        {kbjuMode !== 'manual' ? (
          <div>
            {(() => {
              // D-22: nutrMult already folded into effective* in IndividualPlanContext — do NOT multiply again.
              const dispKcal = effectiveKcal;
              const dispP = effectiveP;
              const dispF = effectiveF;
              const dispC = effectiveC;
              return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5, marginBottom: 8 }}>
                {[
                   { l:'Калории', v: dispKcal, c:'#00e68a', unit:'ккал', perKg: Math.round(dispKcal / Math.max(1, weight)) },
                   { l:'Белки', v: dispP, c:'#3b82f6', unit:'г', perKg: Math.round(dispP / Math.max(1, weight)) },
                   { l:'Жиры', v: dispF, c:'#f59e0b', unit:'г', perKg: Math.round(dispF / Math.max(1, weight)) },
                   { l:'Углеводы', v: dispC, c:'#f97316', unit:'г', perKg: Math.round(dispC / Math.max(1, weight)) },
                ].map(m => {
                  const pct = dispKcal > 0 && m.l !== 'Калории'
                    ? Math.round(({ 'Калории': dispKcal, 'Белки': dispP * 4, 'Жиры': dispF * 9, 'Углеводы': dispC * 4 }[m.l] || 0) / dispKcal * 100)
                    : null;
                  return (
                  <div key={m.l} style={{
                    textAlign:'center', borderRadius:10, padding:'8px 4px',
                    background: `linear-gradient(135deg, ${m.c}12, transparent)`,
                    border: `1px solid ${m.c}25`,
                    position:'relative', overflow:'hidden',
                  }}>
                    <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background: m.c }} />
                    <div style={{ fontSize:18, fontWeight:800, color:m.c, lineHeight:1.2 }}>{m.v}</div>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginTop:1 }}>{m.unit}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.9)', marginTop:1 }}>
                      {m.perKg} / кг
                      {pct !== null && ` · ${pct}%`}
                    </div>
                  </div>
                );
              })}
            </div>;
            })()}
            {(() => {
              // FIX 1.3: подпись BMR/TDEE/Коррекция должна отражать ТОТ ЖЕ источник, что и цифры.
              // Раньше всегда показывался auto-calc даже в режиме 'profile' — визуальное противоречие.
              const _src = kbjuMode === 'profile' ? profileTargets : calcTargets;
              const _bmr = _src?.bmr || 0;
              const _tdee = _src?.tdee || 0;
              const _adj = _src?.adjustment || 0;
              if (_bmr <= 0) return null;
              return (
                <div style={{ display:'flex', gap:6, marginBottom:6, fontSize:9, color:'rgba(255,255,255,0.9)' }}>
                  <span>BMR: <b style={{color:'#00e68a'}}>{_bmr}</b> ккал</span>
                  <span>TDEE: <b style={{color:'#60a5fa'}}>{_tdee}</b> ккал</span>
                  {_adj !== 0 && <span>Коррекция: <b style={{color: _adj > 0 ? '#f59e0b' : '#22c55e'}}>{_adj > 0 ? '+' : ''}{_adj}</b> ккал</span>}
                </div>
              );
            })()}
            {(() => {
              // D-22: nutrMult already folded into effective* — do NOT multiply again.
              const pKcal = effectiveP * 4;
              const fKcal = effectiveF * 9;
              const cKcal = effectiveC * 4;
              const total = pKcal + fKcal + cKcal || 1;
              const pPct = pKcal / total * 100;
              const fPct = fKcal / total * 100;
              const cPct = cKcal / total * 100;
              return (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 3 }}>Распределение макронутриентов</div>
                  <div style={{ height: 8, borderRadius: 4, background: '#202023', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ height: '100%', width: `${pPct}%`, background: '#3b82f6', transition: 'width 0.3s', minWidth: 2 }} title={`Белки ${Math.round(pPct)}%`} />
                    <div style={{ height: '100%', width: `${fPct}%`, background: '#f59e0b', transition: 'width 0.3s', minWidth: 2 }} title={`Жиры ${Math.round(fPct)}%`} />
                    <div style={{ height: '100%', width: `${cPct}%`, background: '#f97316', transition: 'width 0.3s', minWidth: 2 }} title={`Углеводы ${Math.round(cPct)}%`} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 7, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                    <span style={{ color: '#3b82f6' }}>● Б {Math.round(pPct)}%</span>
                    <span style={{ color: '#f59e0b' }}>● Ж {Math.round(fPct)}%</span>
                    <span style={{ color: '#f97316' }}>● У {Math.round(cPct)}%</span>
                  </div>
                </div>
              );
            })()}
            {nutrLevel !== 'base' && (() => {
              const nm = NUTRITION_LEVELS.find(n => n.id === nutrLevel);
              return <div style={{ fontSize: 8, color: 'rgba(0,230,138,0.5)', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.08)' }}>📈 Уровень «{nm?.label}» (×{nm?.mult}) — план будет на {Math.round(((nm?.mult||1)-1)*100)}% больше: ~{Math.round(effectiveKcal * (nm?.mult||1))} ккал, Б {Math.round(effectiveP * (nm?.mult||1))} / Ж {Math.round(effectiveF * (nm?.mult||1))} / У {Math.round(effectiveC * (nm?.mult||1))}</div>;
            })()}
            {cyclingMode !== 'none' && (() => {
              const trainDayC = Math.round(effectiveC * (cyclingMode === 'butch' ? 1.3 : cyclingMode === 'carbload' ? 1.5 : 1.0));
              const restDayC = Math.round(effectiveC * (cyclingMode === 'macro' ? 0.7 : cyclingMode === 'butch' ? 0.5 : 1.0));
              const trainDayK = Math.round(effectiveKcal * (cyclingMode === 'macro' ? 1.0 : cyclingMode === 'butch' ? 1.0 : cyclingMode === 'cheatmeal' ? 0.85 : 1.0));
              const restDayK = Math.round(effectiveKcal * (cyclingMode === 'macro' ? 0.85 : 1.0));
              const cycleLabel = ({ macro: '🔄 Макросы', butch: '⤴️⤵️ БУЧ', cheatmeal: '🍔 Читмил', carbload: '🍚 Угл.загр.' })[cyclingMode] || '';
              return <div style={{ fontSize: 8, color: 'rgba(59,130,246,0.5)', marginTop: 2, padding: '4px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.08)' }}>{cycleLabel}: в тренировочный день ~{trainDayK} ккал / {trainDayC}г угл. · в день отдыха ~{restDayK} ккал / {restDayC}г угл.</div>;
            })()}
          </div>
        ) : (
          <div>
            {(() => {
              const mvKcal = manualKcal ?? effectiveKcal;
              const mvP = manualP ?? effectiveP;
              const mvF = manualF ?? effectiveF;
              const mvC = manualC ?? effectiveC;
              const pKcal = mvP * 4; const fKcal = mvF * 9; const cKcal = mvC * 4;
              const total = pKcal + fKcal + cKcal || 1;
              const pPct = pKcal / total * 100; const fPct = fKcal / total * 100; const cPct = cKcal / total * 100;
              const perKgKcal = Math.round(mvKcal / weight);
              const perKgP = Math.round(mvP / weight);
              const perKgF = Math.round(mvF / weight);
              const perKgC = Math.round(mvC / weight);
              const hasGPerKg = manualGPerKg.protein > 0 || manualGPerKg.fat > 0 || manualGPerKg.carbs > 0;
              return <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5, marginBottom: 8 }}>
                  {[
                    { l:'Калории', v: mvKcal, c:'#00e68a', unit:'ккал', perKg: perKgKcal, setter: setManualKcal },
                    { l:'Белки', v: mvP, c:'#3b82f6', unit:'г', perKg: perKgP, setter: setManualP },
                    { l:'Жиры', v: mvF, c:'#f59e0b', unit:'г', perKg: perKgF, setter: setManualF },
                    { l:'Углеводы', v: mvC, c:'#f97316', unit:'г', perKg: perKgC, setter: setManualC },
                  ].map(m => {
                    const pct = mvKcal > 0 && m.l !== 'Калории'
                      ? Math.round(({ 'Калории': mvKcal, 'Белки': mvP * 4, 'Жиры': mvF * 9, 'Углеводы': mvC * 4 }[m.l] || 0) / mvKcal * 100)
                      : null;
                    return (
                    <div key={m.l} style={{
                      textAlign:'center', borderRadius:10, padding:'8px 4px',
                      background: `linear-gradient(135deg, ${m.c}12, transparent)`,
                      border: `1px solid ${m.c}25`,
                      position:'relative', overflow:'hidden',
                    }}>
                      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background: m.c }} />
                      <input type="number" min={0} step="any" value={m.v === 0 ? 0 : m.v || ''} onChange={e => m.setter(e.target.value === '' ? null : Math.max(0, +e.target.value))} style={{
                        width:'100%', fontSize:18, fontWeight:800, color:m.c,
                        textAlign:'center', background:'transparent', border:'none',
                        outline:'none', padding:0, lineHeight:1.2, MozAppearance:'textfield',
                      }} />
                      <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginTop:1 }}>{m.unit}</div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,0.9)', marginTop:1 }}>
                        {m.perKg} / кг
                        {pct !== null && ` · ${pct}%`}
                      </div>
                    </div>
                  );
                })}
              </div>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 3 }}>Распределение макронутриентов</div>
                  <div style={{ height: 8, borderRadius: 4, background: '#202023', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ height:'100%', width:`${pPct}%`, background:'#3b82f6', transition:'width 0.3s', minWidth:2 }} />
                    <div style={{ height:'100%', width:`${fPct}%`, background:'#f59e0b', transition:'width 0.3s', minWidth:2 }} />
                    <div style={{ height:'100%', width:`${cPct}%`, background:'#f97316', transition:'width 0.3s', minWidth:2 }} />
                  </div>
                  <div style={{ display:'flex', gap:8, fontSize:10, color:'rgba(255,255,255,0.85)', marginTop:2 }}>
                    <span style={{ color:'#3b82f6' }}>● Б {Math.round(pPct)}%</span>
                    <span style={{ color:'#f59e0b' }}>● Ж {Math.round(fPct)}%</span>
                    <span style={{ color:'#f97316' }}>● У {Math.round(cPct)}%</span>
                  </div>
                </div>
                <div style={{ marginTop:10, marginBottom:6, fontSize:9, color:'rgba(255,255,255,0.8)', letterSpacing:0.5, textTransform:'uppercase' }}>Ввод в г/кг веса{hasGPerKg ? ` (${Math.round(mvKcal)} ккал)` : ''}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:5, marginBottom:8 }}>
                  {[
                    { l:'Белки', v: manualGPerKg.protein, c:'#3b82f6', unit:'г/кг', setter: (val: number) => setManualGPerKg({...manualGPerKg, protein: val}) },
                    { l:'Жиры', v: manualGPerKg.fat, c:'#f59e0b', unit:'г/кг', setter: (val: number) => setManualGPerKg({...manualGPerKg, fat: val}) },
                    { l:'Углеводы', v: manualGPerKg.carbs, c:'#f97316', unit:'г/кг', setter: (val: number) => setManualGPerKg({...manualGPerKg, carbs: val}) },
                  ].map(m => (
                    <div key={m.l} style={{
                      textAlign:'center', borderRadius:10, padding:'8px 4px',
                      background: `linear-gradient(135deg, ${m.c}12, transparent)`,
                      border: `1px solid ${m.c}25`,
                      position:'relative', overflow:'hidden',
                    }}>
                      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background: m.c }} />
                      <input type="number" min={0} step="0.1" value={m.v > 0 ? m.v : ''} onChange={e => m.setter(e.target.value === '' ? 0 : Math.max(0, +e.target.value))} placeholder="0.0" style={{
                        width:'100%', fontSize:18, fontWeight:800, color:m.c,
                        textAlign:'center', background:'transparent', border:'none',
                        outline:'none', padding:0, lineHeight:1.2, MozAppearance:'textfield',
                      }} />
                      <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginTop:1 }}>{m.unit}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.85)',marginBottom:4}}>Введите любые значения — недостающие рассчитаются автоматически</div>
                {/* Keep manual mode active: switching to auto here discarded the user's values on generation. */}
                <button onClick={() => setKbjuMode('manual')} style={greenBtn}>✓ Применить</button>
              </>;
            })()}
          </div>
        )}
      </GlassCard>
      )}

      {plannerMode === 'pro' && (
      <GlassCard title="Скользящие графики" icon="📊" color="#00e68a">
        {(() => {
          // D-22: nutrMult already folded into effective* — do NOT multiply again.
          const tKcal = kbjuMode !== 'manual' ? effectiveKcal : (manualKcal ?? effectiveKcal);
          const tP = kbjuMode !== 'manual' ? effectiveP : (manualP ?? effectiveP);
          const tF = kbjuMode !== 'manual' ? effectiveF : (manualF ?? effectiveF);
          const tC = kbjuMode !== 'manual' ? effectiveC : (manualC ?? effectiveC);
          const mockActual = { kcal: Math.round(tKcal * 0.87), p: Math.round(tP * 0.92), f: Math.round(tF * 0.78), c: Math.round(tC * 0.83) };
          const items = [
            { label:'Калории', target:tKcal, actual:mockActual.kcal, unit:'ккал', color:'#00e68a' },
            { label:'Белки', target:tP, actual:mockActual.p, unit:'г', color:'#3b82f6' },
            { label:'Жиры', target:tF, actual:mockActual.f, unit:'г', color:'#f59e0b' },
            { label:'Углеводы', target:tC, actual:mockActual.c, unit:'г', color:'#f97316' },
          ];
          return <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.8)', marginBottom:4, lineHeight:1.6, padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <div>🎯 Цель — рассчитанная норма КБЖУ</div>
              <div>📊 Факт — среднее потребление за последние дни</div>
            </div>
            {items.map(m => {
              const pct = m.target > 0 ? Math.min(100, Math.round(m.actual / m.target * 100)) : 0;
              return (
                <div key={m.label} style={{ marginBottom:4 }}>
                  <div style={{ fontSize:9, fontWeight:600, color:m.color, marginBottom:3 }}>{m.label}</div>
                   <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                    <span style={{ fontSize:6, color:'rgba(255,255,255,0.75)', minWidth:38, whiteSpace:'nowrap' }}>🎯 Цель</span>
                    <div style={{ flex:1, height:6, borderRadius:3, background:'rgba(32,32,35,0.8)', position:'relative' }}>
                      <div style={{ height:'100%', width:'100%', borderRadius:3, background:m.color, opacity:0.15 }} />
                    </div>
                    <span style={{ fontSize:10, fontWeight:600, color:m.color, minWidth:52, textAlign:'right', whiteSpace:'nowrap' }}>{m.target} <span style={{ fontSize:10, color:'rgba(255,255,255,0.2)' }}>{m.unit}</span></span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ fontSize:6, color:'rgba(255,255,255,0.75)', minWidth:38, whiteSpace:'nowrap' }}>📊 Факт</span>
                    <div style={{ flex:1, height:8, borderRadius:3, background:'rgba(32,32,35,0.8)', position:'relative', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, borderRadius:3, background:m.color, opacity:0.6, transition:'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, color:m.color, minWidth:52, textAlign:'right', whiteSpace:'nowrap' }}>{m.actual} · {pct}%</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'rgba(255,255,255,0.25)', marginTop:1, paddingLeft:44 }}>
                    <span>норма</span>
                    <span>факт ({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>;
        })()}
      </GlassCard>
      )}

      {plannerMode === 'pro' && (
      <GlassCard title="Уровень бюджета" icon="💰" color="#f59e0b">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 8, lineHeight: 1.5 }}>
          Определяет качество продуктов: низкий = базовые продукты, средний = сбалансированный, максимум = топ по рейтингу <span style={{ color:'#f59e0b', fontWeight:700 }}>bb_quality_score</span>, усиленный = только элитные.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {BUDGET_LEVELS.map(b => {
            const isActive = budget === b.id;
            const scoreRange = b.id === 'low' ? '1–5' : b.id === 'medium' ? '5–8' : b.id === 'max' ? '8–10' : '9–10';
            return (
              <button key={b.id} onClick={() => setBudget(b.id)} style={{
                padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                background: isActive ? `${b.color}18` : '#202023',
                border: isActive ? `2px solid ${b.color}` : '1px solid rgba(255,255,255,0.06)',
                color: isActive ? b.color : 'rgba(255,255,255,0.85)',
                fontWeight: isActive ? 700 : 500,
                transition: 'all 0.2s',
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12 }}>{b.icon} {b.label}</span>
                  <span style={{ fontSize:10, padding:'1px 5px', borderRadius:4, background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.8)' }}>★{scoreRange}</span>
                </div>
                <div style={{ fontSize:9, color: isActive ? `${b.color}aa` : 'rgba(255,255,255,0.85)', marginTop:3 }}>{b.desc}</div>
              </button>
            );
          })}
        </div>
      </GlassCard>
      )}

      {plannerMode === 'pro' && (
      <GlassCard title="Разнообразие рациона" icon="🎲" color="#8b5cf6">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 8, lineHeight: 1.5 }}>
          Минимум — одни и те же продукты каждый день (проще готовить и закупать). Максимум — полная ротация для разнообразия нутриентов.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
          {[
            { id: 'minimal' as const, label: '🎯 База', desc: '2-3 продукта на категорию, минимум разнообразия', color: '#22c55e' },
            { id: 'medium' as const, label: '⚖️ Средний', desc: '4-5 продуктов, баланс удобства и разнообразия', color: '#f59e0b' },
            { id: 'max' as const, label: '🎪 Максимум', desc: 'Полный пул продуктов, макс. разнообразие', color: '#8b5cf6' },
          ].map(v => (
            <button key={v.id} onClick={() => setVariety(v.id)} style={{
              padding: '10px 8px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
              background: variety === v.id ? `${v.color}18` : '#202023',
              border: variety === v.id ? `2px solid ${v.color}` : '1px solid rgba(255,255,255,0.06)',
              color: variety === v.id ? '#fff' : 'rgba(255,255,255,0.7)',
              fontWeight: variety === v.id ? 700 : 500, fontSize: 10,
            }}>
              <div style={{ fontSize: 14, marginBottom: 2 }}>{v.label.split(' ')[0]}</div>
              <div style={{ fontWeight: 700, fontSize: 10 }}>{v.label.split(' ').slice(1).join(' ')}</div>
              <div style={{ fontSize: 7, color: variety === v.id ? `${v.color}aa` : 'rgba(255,255,255,0.85)', marginTop: 2 }}>{v.desc}</div>
            </button>
          ))}
        </div>
      </GlassCard>
      )}

      {plannerMode === 'pro' && (
      <GlassCard title="Уровень питания" icon="📈" color="#22c55e">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 8, lineHeight: 1.5 }}>
          База ×1.0, Средний ×1.15, Усиление ×1.3, Максимум ×1.5. Используется для коррекции калоража без смены цели.
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Множитель калорийности: {NUTRITION_LEVELS.find(n => n.id === nutrLevel)?.mult || 1.0}× — итоговый план будет на {Math.round(( (NUTRITION_LEVELS.find(n => n.id === nutrLevel)?.mult || 1) - 1) * 100)}% больше базы</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5 }}>
          {NUTRITION_LEVELS.map(n => (
            <button key={n.id} onClick={() => setNutrLevel(n.id)} style={{
              padding: '10px 6px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
              background: nutrLevel === n.id ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : '#202023',
              border: nutrLevel === n.id ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
              color: nutrLevel === n.id ? '#000' : 'rgba(255,255,255,0.7)',
              fontWeight: nutrLevel === n.id ? 800 : 500, fontSize: 10,
              transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: 14, marginBottom: 2 }}>{n.icon}</div>
              <div style={{ fontWeight: 700 }}>{n.label}</div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginTop: 1 }}>{n.desc}</div>
              <div style={{ fontSize: 8, color: nutrLevel === n.id ? '#00e68a' : 'rgba(255,255,255,0.8)', marginTop: 1 }}>×{n.mult}</div>
            </button>
          ))}
        </div>
      </GlassCard>
      )}

      {true && (
      <GlassCard title="Расписание" icon="⏰" color="#06b6d4">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <PopupSelect label="Пробуждение" value={wakeTime} options={TIME_OPTIONS} onChange={setWakeTime} />
          <PopupSelect label="Обед" value={lunchTime} options={TIME_OPTIONS} onChange={setLunchTime} />
          <PopupSelect label="Ужин" value={dinnerTime} options={TIME_OPTIONS} onChange={setDinnerTime} />
          <PopupSelect label="Отход ко сну" value={bedTime} options={TIME_OPTIONS} onChange={setBedTime} />
          <div style={{ gridColumn: 'span 2' }}>
            <button
              onClick={() => setMorningTrainLoad(!morningTrainLoad)}
              style={{ width:'100%', padding:'6px 8px', borderRadius:8, cursor:'pointer', fontSize:9, fontWeight:600, textAlign:'left', background: morningTrainLoad ? 'rgba(59,130,246,0.12)' : '#202023', border:`1px solid ${morningTrainLoad ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.1)'}`, color: morningTrainLoad ? '#60a5fa' : 'rgba(255,255,255,0.5)' }}
            >
              🌅 Загрузка под утреннюю тренировку: {morningTrainLoad ? 'ВКЛ' : 'ВЫКЛ'}
            </button>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', marginTop: 3, lineHeight: 1.35 }}>
              При утренней тренировке (старт до 14:00) вечером — много углеводов, минимум жиров, умеренный белок (гликоген к утренней сессии).
            </div>
          </div>
        </div>
        <div>
          <label style={{fontSize:9,color:'rgba(255,255,255,0.85)',marginBottom:4,display:'block'}}>Количество приёмов пищи</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {[3,4,5,6,7,8,9,10].map(n => (
              <PillBtn key={n} active={mealsCount === n} onClick={() => setMealsCount(n)} color={mealsCount === n ? '#06b6d4' : undefined}>{n}</PillBtn>
            ))}
          </div>
          {(() => {
            const toMin = (t: string) => t?.includes(':') ? parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]) : 0;
            const wMin = toMin(wakeTime);
            const bMin = toMin(bedTime);
            const awakeH = Math.round((bMin - wMin) / 60);
            const recCount = awakeH >= 16 ? 5 : awakeH >= 14 ? 4 : 3;
            return <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginTop: 2, lineHeight: 1.5 }}>⏰ Бодрствование {awakeH} ч → рекомендуется {recCount} приёмов (каждые {Math.round(awakeH / recCount)} ч).<br />🍳 Завтрак около {wakeTime} · 🥗 Обед в {lunchTime} · 🍽 Ужин в {dinnerTime}</div>;
          })()}
        </div>
      </GlassCard>
      )}

        {/* Work Schedule — доступно во всех режимах (еда на работе нужна всем) */}
        {true && (
        <GlassCard title="💼 Работа" icon="💼" color="#60a5fa">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color: workScheduleEnabled ? '#60a5fa' : 'rgba(255,255,255,0.5)' }}>График работы</div>
                {!workScheduleEnabled && <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)' }}>Рабочие дни, время, смены</div>}
              </div>
            </div>
            <button onClick={() => setWorkScheduleEnabled(!workScheduleEnabled)} style={{
              padding:'5px 10px', borderRadius:8, fontSize:9, fontWeight:600, cursor:'pointer',
              background: workScheduleEnabled ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.04)',
              border: workScheduleEnabled ? '1px solid rgba(96,165,250,0.2)' : '1px solid rgba(255,255,255,0.06)',
              color: workScheduleEnabled ? '#60a5fa' : 'rgba(255,255,255,0.5)',
            }}>{workScheduleEnabled ? '✓ Вкл' : 'Выкл'}</button>
          </div>
          {workScheduleEnabled && (
            <div style={{ marginTop:8 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:4 }}>Тип графика</div>
              <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:6 }}>
                {[
                  { id:'standard', label:'📅 Стандарт' },
                  { id:'sliding', label:'🔄 Скользящий' },
                  { id:'shift_1_3', label:'1/3' },
                  { id:'shift_2_2', label:'2/2' },
                  { id:'shift_day_night', label:'🌙 День/Ночь' },
                  { id:'shift_2_1', label:'2/1' },
                  { id:'shift_3_1', label:'3/1' },
                  { id:'custom', label:'⚙️ Свой' },
                ].map(t => (
                  <button key={t.id} onClick={() => setWorkScheduleType(t.id)} style={{
                    padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', fontWeight: workScheduleType === t.id ? 700 : 400,
                    background: workScheduleType === t.id ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.03)',
                    border: workScheduleType === t.id ? '1px solid rgba(96,165,250,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    color: workScheduleType === t.id ? '#60a5fa' : 'rgba(255,255,255,0.6)',
                  }}>{t.label}</button>
                ))}
              </div>
              <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                <div style={{ flex:1 }}>
                  <PopupSelect label="Начало работы" value={workStartTime} options={TIME_OPTIONS} onChange={setWorkStartTime} />
                </div>
                <div style={{ flex:1 }}>
                  <PopupSelect label="Конец работы" value={workEndTime} options={TIME_OPTIONS} onChange={setWorkEndTime} />
                </div>
              </div>
              {(() => {
                const descs: Record<string, string> = {
                  standard: '5/2, работа в будние дни',
                  sliding: 'Плавающие выходные, дни работы задаются вручную',
                  shift_1_3: '1 день работа → 3 дня отдых',
                  shift_2_2: '2 дня работа → 2 дня отдых',
                  shift_day_night: 'День/ночь/отсыпной/выходной',
                  shift_2_1: '2 дня работа → 1 день отдых',
                  shift_3_1: '3 дня работа → 1 день отдых',
                  custom: 'Ручной выбор рабочих дней',
                };
                return (
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginBottom:6 }}>
                    {descs[workScheduleType] || ''}
                  </div>
                );
              })()}
              {(workScheduleType === 'standard' || workScheduleType === 'sliding' || workScheduleType === 'custom') && (
                <div style={{ marginTop:6 }}>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.8)', marginBottom:4 }}>Рабочие дни</div>
                  <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                    {DAY_LABELS.map((label, idx) => {
                      const sel = workDays[idx];
                      return (
                        <button key={idx} onClick={() => {
                          const updated = [...workDays];
                          updated[idx] = !updated[idx];
                          setWorkDays(updated);
                        }} style={{
                          width:32, height:32, borderRadius:'50%', cursor:'pointer', fontSize:9, fontWeight: sel ? 800 : 500,
                          background: sel ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.03)',
                          border: sel ? '2px solid #60a5fa' : '1px solid rgba(255,255,255,0.08)',
                          color: sel ? '#60a5fa' : 'rgba(255,255,255,0.7)',
                          transition:'all 0.15s',
                        }}>{label}</button>
                      );
                    })}
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, fontSize:9, color:'rgba(255,255,255,0.85)' }}>
                    <span>💼 {workDays.filter(Boolean).length} рабочих</span>
                    <span>🌴 {workDays.filter(d => !d).length} выходных</span>
                  </div>
                </div>
              )}
              {workScheduleType.startsWith('shift_') && (
                <div style={{ marginTop:6, padding:'6px 8px', borderRadius:6, background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.08)', fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.5 }}>
                  🔄 Питание будет адаптировано под сменный график: время приёмов сдвинется относительно начала/конца смены, перекусы на работе включены в план.
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop:8 }}>
            <label style={{fontSize:9,color:'rgba(255,255,255,0.85)',marginBottom:3,display:'block'}}>Еда на работе</label>
            {pickerBtn('Еда на работе', [{value:'any',label:'Любая (можно разогреть)'},{value:'portable',label:'Только порошок/хлопья/протеин'}], workFood, setShowWorkFoodPicker)}
            {pickerModal('Еда на работе', [{value:'any',label:'Любая (можно разогреть)'},{value:'portable',label:'Только порошок/хлопья/протеин'}], workFood, setWorkFood, showWorkFoodPicker, setShowWorkFoodPicker)}
            <div style={{fontSize:8,color:'rgba(255,255,255,0.6)',marginTop:3,lineHeight:1.35}}>
              «Только порошок/хлопья/протеин» — в рабочие часы только портативная еда (протеин, хлопья, орехи, фрукты, хлеб, йогурт). Супы, каши, жареное — исключаются.
            </div>
          </div>
        </GlassCard>
      )}

      {true && (
      <GlassCard title="Аллергены и ограничения" icon="⚠️" color="#ef4444">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {ALLERGEN_LIST.map(a => (
            <PillBtn key={a.id} active={allergens.includes(a.id)} onClick={() => toggleAllergen(a.id)} color={allergens.includes(a.id) ? '#ef4444' : undefined}>
              {allergens.includes(a.id) ? '✕ ' : '○ '}{a.icon} {a.label}
            </PillBtn>
          ))}
        </div>
      </GlassCard>
      )}

      {true && (
      <GlassCard title="Проблемы со здоровьем" icon="🩺" color="#06b6d4">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 8, lineHeight: 1.5 }}>
          Отметьте проблемы — план автоматически исключит продукты, которые их усугубляют. Например, отёки → снижение натрия, диабет → низкий GI, подагра → низкие пурины.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {HEALTH_ISSUES.map(h => {
            const active = healthIssues.includes(h.id);
            return (
              <button key={h.id} onClick={() => toggleHealthIssue(h.id)} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%',
                background: active ? 'rgba(6,182,212,0.25)' : '#202023', boxShadow: active ? '0 2px 12px rgba(6,182,212,0.3)' : 'none',
                border: active ? '1.5px solid #06b6d4' : '1px solid rgba(255,255,255,0.06)',
                transition: 'all 0.2s',
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: active ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.04)', fontSize: 16 }}>{h.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 11, color: active ? '#06b6d4' : '#fff', marginBottom: 1 }}>{h.label}</div>
                  <div style={{ fontSize: 8, color: active ? 'rgba(6,182,212,0.8)' : 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>{h.desc}</div>
                </div>
                <div style={{ width: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: active ? '#06b6d4' : 'rgba(255,255,255,0.06)', color: active ? '#000' : 'rgba(255,255,255,0.5)', fontWeight: 800, fontSize: 10, transition: 'all 0.2s' }}>
                  {active ? '✓' : ''}
                </div>
              </button>
            );
          })}
        </div>
      </GlassCard>
      )}

      {plannerMode === 'pro' && (
      <GlassCard title="🌙 Вечерний режим" icon="🌙" color="#6366f1">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 8, lineHeight: 1.5 }}>
          Автоматически включается при выборе «Отёки» или «Диабет». Снижает количество углеводов в вечернем приёме пищи, перенося их на обед.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 10, background: eveningLowCarb ? 'rgba(99,102,241,0.12)' : '#202023', border: `1px solid ${eveningLowCarb ? '#6366f1' : 'rgba(255,255,255,0.06)'}` }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: eveningLowCarb ? '#6366f1' : '#fff' }}>Вечер — минимум углеводов</div>
            <div style={{ fontSize: 8, color: eveningLowCarb ? 'rgba(99,102,241,0.8)' : 'rgba(255,255,255,0.6)' }}>Углеводы ужина → обед</div>
          </div>
          <button onClick={() => { const nv = !eveningLowCarb; setEveningLowCarb(nv); try { localStorage.setItem('he_evening_low_carb', nv ? 'true' : 'false'); } catch {} }} style={{
            width: 48, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', transition: 'all 0.2s',
            background: eveningLowCarb ? '#6366f1' : 'rgba(255,255,255,0.15)',
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, transition: 'all 0.2s',
              left: eveningLowCarb ? 27 : 3, boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }} />
          </button>
        </div>
      </GlassCard>
      )}

      {true && (
      <GlassCard title="Тип плана питания" icon="📋" color="#a855f7">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {PLAN_TYPES.map(pt => (
            <PillBtn key={pt.id} active={planType === pt.id} onClick={() => setPlanType(pt.id)}>
              {pt.icon} {pt.label}
            </PillBtn>
          ))}
        </div>
      </GlassCard>
      )}

      {plannerMode === 'pro' && (
            <GlassCard title="🏭 Подбор продуктов" icon="🏭" color="#06b6d4">
        {/* Адаптация по дневнику + строгая вариативность */}
        <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:10, background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.18)' }}>
          <div style={{ fontSize:9, fontWeight:700, color:'#10b981', marginBottom:6 }}>📊 Адаптация и 7-дневная вариативность</div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
            <div>
              <div style={{ fontSize:10, fontWeight:600, color: diaryAdaptation ? '#10b981' : '#fff' }}>Компенсация по дневнику</div>
              <div style={{ fontSize:9, color: diaryAdaptation ? 'rgba(16,185,129,0.8)' : 'rgba(255,255,255,0.6)' }}>Недобор/перебор вчера → сегодня</div>
            </div>
            <button onClick={() => setDiaryAdaptation(!diaryAdaptation)} style={{ width:36, height:20, borderRadius:10, border:'none', cursor:'pointer', position:'relative', background: diaryAdaptation ? '#10b981' : 'rgba(255,255,255,0.15)' }}>
              <span style={{ position:'absolute', top:2, left: diaryAdaptation ? 19 : 3, width:16, height:16, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,0.3)', transition:'left 0.15s' }} />
            </button>
          </div>
          <div style={{ display:'flex', gap:4, marginBottom:6 }}>
            {([['soft','Мягкая'],['strict','Строгая']] as [string,string][]).map(([id,label]) => (
              <button key={id} onClick={() => setVarietyStrictness(id as any)} style={{ flex:1, padding:'5px 4px', borderRadius:8, cursor:'pointer', fontSize:9, fontWeight: varietyStrictness===id?800:600, background: varietyStrictness===id?'rgba(16,185,129,0.15)':'rgba(255,255,255,0.03)', border: varietyStrictness===id?'1px solid #10b981':'1px solid rgba(255,255,255,0.06)', color: varietyStrictness===id?'#10b981':'rgba(255,255,255,0.7)' }}>{label} вариативность</button>
            ))}
          </div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)' }}>{varietyStrictness==='strict' ? 'Строго: продукты последних 1-2 дней исключаются из следующих дней.' : 'Мягко: только деприоритизация повторов.'}</div>
        </div>
                {/* D: Specificity */}
        <div style={{ fontSize:9, fontWeight:700, color:'#06b6d4', marginBottom:4 }}>📊 Специфичность продуктов</div>
        <div style={{ display:'flex', gap:4, marginBottom:8 }}>
          {([['everyday','🍱 Повседневные'],['varied','💡 Разнообразные'],['gourmet','🍩 Гурман']] as [string,string][]).map(([id,label]) => (
            <button key={id} onClick={() => setSpecificity(id as any)} style={{ flex:1, padding:'5px 4px', borderRadius:8, cursor:'pointer', fontSize:10, fontWeight: specificity===id?800:600, background: specificity===id?'rgba(6,182,212,0.15)':'rgba(255,255,255,0.03)', border: specificity===id?'1px solid #06b6d4':'1px solid rgba(255,255,255,0.06)', color: specificity===id?'#06b6d4':'rgba(255,255,255,0.7)' }}>{label}</button>
          ))}
        </div>
        {/* E: Intolerances */}
        <div style={{ fontSize:9, fontWeight:700, color:'#ef4444', marginBottom:4 }}>🧪 Непереносимость</div>
        <div style={{ display:'flex', gap:4, marginBottom:8, flexWrap:'wrap' }}>
          {([['lowFODMAP','Фодмап'],['lowHistamine','Гистамин'],['lowOxalate','Оксалаты']] as [string,string][]).map(([key,label]) => (
            <button key={key} onClick={() => setIntolerances((prev:any) => ({ ...prev, [key]: !prev[key] }))} style={{ padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, background: (intolerances as any)[key]?'rgba(239,68,68,0.12)':'rgba(255,255,255,0.03)', border: (intolerances as any)[key]?'1px solid rgba(239,68,68,0.25)':'1px solid rgba(255,255,255,0.06)', color: (intolerances as any)[key]?'#ef4444':'rgba(255,255,255,0.7)' }}>{(intolerances as any)[key]?'✅ ':''}{label}</button>
          ))}
        </div>
        {/* A: Taste profile */}
        <div style={{ fontSize:9, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>👫 Вкусовые предпочтения</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:8 }}>
          {([['spicy','🌶️ Острое'],['sweet','🍬 Сладкое'],['salty','🥢 Солёное'],['sour','🍋 Кислое'],['umami','🍄 Умами']] as [string,string][]).map(([key,label]) => (
            <div key={key} style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.7)', minWidth:50 }}>{label}</span>
              <input type='range' min={0} max={3} value={(tasteProfile as any)[key]||0} onChange={e => setTasteProfile((prev:any) => ({ ...prev, [key]: +e.target.value }))} style={{ flex:1, height:4 }} />
              <span style={{ fontSize:10, color:'#f59e0b', minWidth:8 }}>{(tasteProfile as any)[key]||0}</span>
            </div>
          ))}
        </div>
        {/* C: Excluded categories */}
        <div style={{ fontSize:9, fontWeight:700, color:'#a78bfa', marginBottom:4 }}>🚫 Не люблю категорию</div>
        <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
          {([['fish','🐟 Рыба'],['dairy','🥛 Молочное'],['legumes','🫘 Бобовые'],['cabbage','🥬 Капуста'],['nuts','🥜 Орехи'],['pork','🥓 Свинина'],['shellfish','🦐 Морепродукты'],['mushroom','🍄 Грибы']] as [string,string][]).map(([cat,ruLabel]) => {
            const sel = excludedCategories.includes(cat);
            return (<button key={cat} onClick={() => { const upd = sel ? excludedCategories.filter(c => c !== cat) : [...excludedCategories, cat]; setExcludedCategories(upd); }} style={{ padding:'3px 6px', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, background: sel?'rgba(167,139,250,0.15)':'rgba(255,255,255,0.03)', border: sel?'1px solid rgba(167,139,250,0.3)':'1px solid rgba(255,255,255,0.06)', color: sel?'#a78bfa':'rgba(255,255,255,0.7)' }}>{sel?'✅ ':''}{ruLabel}</button>);
          })}
        </div>
      </GlassCard>
      )}
      {plannerMode === 'pro' && (
      <GlassCard title="⚡ Быстрые пресеты" icon="⚡" color="#f97316">
        {/* P2.1: 3 categories, 12 presets */}
        {([
          { cat: '🎯 По цели', color: '#00e68a', presets: [
            { id: 'cut', label: '🔥 Сушка', desc: 'Дефицит, 2.5г белка/кг, низкий GI', fn: () => { const foods = ['chicken_breast','turkey_breast','cod','egg_white','cottage_cheese_5','broccoli','spinach','cucumber']; setGoal('cutting'); setBudget('medium'); setVariety('max'); setPreferredFoods(foods); persistPlannerValue('he_preferred_foods', foods); } },
            { id: 'mass', label: '💪 Масса', desc: 'Профицит, 2г/кг, высоко-углеводные', fn: () => { const foods = ['beef_lean','chicken_breast','salmon','egg_whole','rice_white','buckwheat','pasta_durum','banana','nuts_almonds']; setGoal('mass'); setBudget('medium'); setVariety('max'); setPreferredFoods(foods); persistPlannerValue('he_preferred_foods', foods); } },
            { id: 'recomp', label: '🔄 Рекомпозиция', desc: 'Maintenance, 2.5г/кг, carb cycling', fn: () => { const foods = ['chicken_breast','salmon','egg_whole','cottage_cheese_5','rice_brown','quinoa','broccoli','avocado','olive_oil']; setGoal('recomposition'); setBudget('medium'); setVariety('max'); setCyclingMode('macro'); setPreferredFoods(foods); persistPlannerValue('he_preferred_foods', foods); } },
            { id: 'maint', label: '⚖️ Поддержание', desc: 'Баланс 30/25/45', fn: () => { const foods = ['chicken_breast','beef_lean','salmon','egg_whole','rice_brown','buckwheat','broccoli','tomato','olive_oil','yogurt_greek']; setGoal('maintenance'); setBudget('medium'); setVariety('medium'); setPreferredFoods(foods); persistPlannerValue('he_preferred_foods', foods); } },
          ]},
          { cat: '🥗 По типу питания', color: '#3b82f6', presets: [
             { id: 'meat', label: '🥩 Мясной', desc: 'Курица, говядина, индейка', fn: () => { const foods = ['chicken_breast','beef_lean','turkey_breast','rice_white','broccoli']; setPlanType('classic'); setPreferredFoods(foods); persistPlannerValue('he_preferred_foods', foods); } },
             { id: 'fish', label: '🐟 Рыбный', desc: 'Лосось, тунец, треска', fn: () => { const foods = ['salmon','tuna_canned','cod','rice_brown','broccoli','olive_oil']; setPlanType('mediterranean'); setPreferredFoods(foods); persistPlannerValue('he_preferred_foods', foods); } },
             { id: 'vegan', label: '🌱 Веган', desc: 'Бобовые, тофу, киноа', fn: () => { const foods = ['tofu','tempeh','lentils','quinoa','broccoli','avocado']; setPlanType('vegetarian'); setPreferredFoods(foods); persistPlannerValue('he_preferred_foods', foods); } },
             { id: 'budget', label: '💰 Бюджет', desc: 'Яйца, курица, гречка', fn: () => { const foods = ['egg_whole','chicken_thigh','buckwheat','cabbage','apple']; setBudget('low'); setPreferredFoods(foods); persistPlannerValue('he_preferred_foods', foods); } },
            { id: 'max', label: '🚀 Максимум', desc: 'Топ-рейтинг + макс. разнообразие', fn: () => { setBudget('max'); setNutrLevel('max'); setVariety('max'); } },
          ]},
          { cat: '💉 По фазе', color: '#a78bfa', presets: [
             { id: 'course', label: '💉 Курс', desc: 'Высокий белок, печень-суппорт', fn: () => { const foods = ['chicken_breast','beef_lean','salmon','egg_whole','rice_white','buckwheat','broccoli','spinach','cottage_cheese_5','olive_oil']; setPhase('course'); setGoal('mass'); setPreferredFoods(foods); persistPlannerValue('he_preferred_foods', foods); } },
             { id: 'pct', label: '🔄 ПКТ', desc: 'Цинк, витамин D, антиоксиданты', fn: () => { const foods = ['beef_lean','egg_whole','oysters','pumpkin_seeds','nuts_almonds','broccoli','spinach','salmon','yogurt_greek','kiwi']; setPhase('pct'); setGoal('maintenance'); setPreferredFoods(foods); persistPlannerValue('he_preferred_foods', foods); } },
             { id: 'train', label: '🏋️ Тренировочный', desc: 'Peri-workout акцент, carb cycling', fn: () => { const foods = ['chicken_breast','whey_protein','rice_white','banana','salmon','sweet_potato','broccoli']; setLinkToTraining(true); setCyclingMode('macro'); setPreferredFoods(foods); persistPlannerValue('he_preferred_foods', foods); } },
          ]},
        ] as { cat: string; color: string; presets: { id: string; label: string; desc: string; fn: () => void }[] }[]).map(group => (
          <div key={group.cat} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: group.color, marginBottom: 4, letterSpacing: 0.3 }}>{group.cat}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {group.presets.map(p => (
                <button key={p.id} onClick={() => { p.fn(); setRecentPreset(p.id); }} style={{ flex: 1, minWidth: 75, padding: '7px 5px', borderRadius: 10, cursor: 'pointer', textAlign: 'center', background: recentPreset === p.id ? group.color : '#202023', border: recentPreset === p.id ? '2px solid '+group.color : '1px solid rgba(255,255,255,0.06)', color: recentPreset === p.id ? '#000' : 'rgba(255,255,255,0.85)', fontSize: 7, fontWeight: recentPreset === p.id ? 800 : 600, transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = group.color + '30'; (e.currentTarget as HTMLElement).style.borderColor = group.color; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#202023'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}>
                  <div style={{ fontSize: 14, marginBottom: 2 }}>{p.label.slice(0,2)}</div>
                  <div>{p.label.slice(2)}</div>
                  <div style={{ fontSize: 5, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{p.desc}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </GlassCard>
      )}

      {true && (
      <GlassCard title="Предпочтения и исключения" icon="🍎" color="#f59e0b">
        <div style={{ marginBottom: 8 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
            <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>🌟 Любимые продукты ({preferredFoods.length})</label>
            <button onClick={() => { setPrefSearch(''); setShowPrefFoodModal(true); }} style={{
              padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:9, fontWeight:600,
              background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.2)', color:'#00e68a',
            }}>+ Редактировать</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {(() => {
              const allRecipes = [...getRecipes(), ...(userRecipes||[])] as Recipe[];
              const findName = (id: string): string | null => {
                const food = FOOD_DB.find(f => f.id === id);
                if (food) return food.name;
                if (id.startsWith('__recipe__')) { const r = allRecipes.find(r => '__recipe__' + r.name === id); if (r) return '🍳 ' + r.name; }
                if (id.startsWith('__user_recipe__')) { const r = allRecipes.find(r => '__user_recipe__' + r.name === id); if (r) return '👨‍🍳 ' + r.name; }
                return null;
              };
              return preferredFoods.slice(0, 10).map(pf => {
                const name = findName(pf);
                return name ? (
                  <span key={pf} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.15)', color: '#00e68a', display: 'flex', alignItems: 'center', gap: 3 }}>
                    {name}
                    <span onClick={() => { const upd = preferredFoods.filter(p => p !== pf); setPreferredFoods(upd); persistPlannerValue('he_preferred_foods', upd); }} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.85)', fontSize: 7 }}>✕</span>
                  </span>
                ) : null;
              });
            })()}
            {preferredFoods.length === 0 && <span style={{ fontSize:10, color:'rgba(255,255,255,0.75)' }}>Не выбраны</span>}
          </div>
        </div>
        <div style={{ marginBottom: 6 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
            <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>🚫 Исключённые продукты ({excludedFoods.length})</label>
            <button onClick={() => { setExclSearch(''); setShowExclFoodModal(true); }} style={{
              padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:9, fontWeight:600,
              background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444',
            }}>+ Редактировать</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {(() => {
              const allRecipes = [...getRecipes(), ...(userRecipes||[])] as Recipe[];
              const findName = (id: string): string | null => {
                const food = FOOD_DB.find(f => f.id === id);
                if (food) return food.name;
                if (id.startsWith('__recipe__')) { const r = allRecipes.find(r => '__recipe__' + r.name === id); if (r) return '🍳 ' + r.name; }
                if (id.startsWith('__user_recipe__')) { const r = allRecipes.find(r => '__user_recipe__' + r.name === id); if (r) return '👨‍🍳 ' + r.name; }
                return null;
              };
              return excludedFoods.map(ef => {
                const name = findName(ef);
                return name ? (
                  <span key={ef} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 3 }}>
                    {name}
                    <span onClick={() => { const upd = excludedFoods.filter(p => p !== ef); setExcludedFoods(upd); persistPlannerValue('he_excluded_foods', upd); }} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.85)', fontSize: 7 }}>✕</span>
                  </span>
                ) : null;
              });
            })()}
            {excludedFoods.length === 0 && <span style={{ fontSize:10, color:'rgba(255,255,255,0.75)' }}>Не выбраны</span>}
          </div>
          {excludedFoods.length > 12 && (
            <div style={{ fontSize:10, color:'#f59e0b', padding:'3px 6px', borderRadius:4, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)', marginTop:4 }}>
              ⚠️ Исключено {excludedFoods.length} продуктов — разнообразие рациона ограничено. Рекомендуется не более 10-15 исключений.
            </div>
          )}
          {preferredFoods.length > 0 && (
            <div style={{ fontSize:10, color:'#00e68a', padding:'3px 6px', borderRadius:4, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.15)', marginTop:4 }}>
              ⭐ Любимых продуктов: {preferredFoods.length} — они будут приоритетны при генерации плана (белок, углеводы, жиры, овощи, фрукты).
            </div>
          )}
          {dietPrefs.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:4 }}>
              {dietPrefs.map(p => (
                <span key={p} style={{ fontSize:10, padding:'1px 5px', borderRadius:4, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.15)', color:'#22c55e' }}>
                  {({ no_dairy:'🚫 Без молочных', no_gluten:'🚫 Без глютена', vegetarian:'🌱 Вегетарианское', min_processed:'🔬 Минимум обработки', min_sugar:'🍬 Минимум сахара' } as Record<string,string>)[p] || p}
                </span>
              ))}
              <span onClick={() => setShowExclFoodModal(true)} style={{ fontSize:10, padding:'1px 5px', borderRadius:4, cursor:'pointer', background:'rgba(34,197,94,0.04)', border:'1px dashed rgba(34,197,94,0.2)', color:'#22c55e' }}>+</span>
            </div>
          )}
          <div style={{ marginTop:4 }}>
            {[
              { id:'no_dairy', label:'🚫 Без молочных' },
              { id:'no_gluten', label:'🚫 Без глютена' },
              { id:'vegetarian', label:'🌱 Вегетарианское' },
              { id:'min_processed', label:'🔬 Минимум обраб.' },
              { id:'min_sugar', label:'🍬 Минимум сахара' },
            ].map(opt => {
              const sel = dietPrefs.includes(opt.id);
              return (
                <span key={opt.id} onClick={() => {
                  const upd = sel ? dietPrefs.filter(p => p !== opt.id) : [...dietPrefs, opt.id];
                  setDietPrefs(upd);
                  persistPlannerValue('he_diet_preferences', upd);
                }} style={{
                  display:'inline-flex', alignItems:'center', gap:3, marginRight:3, marginBottom:3,
                  padding:'2px 6px', borderRadius:6, cursor:'pointer', fontSize:10,
                  background: sel ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
                  border: sel ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  color: sel ? '#22c55e' : 'rgba(255,255,255,0.5)',
                }}>
                  {opt.label}
                </span>
              );
            })}
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:6 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px', borderRadius:10, background: addMilkToBreakfast ? 'rgba(99,102,241,0.12)' : '#202023', border:`1px solid ${addMilkToBreakfast ? '#6366f1' : 'rgba(255,255,255,0.06)'}` }}>
            <div>
              <div style={{ fontSize:10, fontWeight:600, color: addMilkToBreakfast ? '#818cf8' : '#fff' }}>🥛 Молоко к завтраку</div>
              <div style={{ fontSize:8, color: addMilkToBreakfast ? 'rgba(129,140,248,0.8)' : 'rgba(255,255,255,0.6)' }}>Добавлять молоко в завтрак (если не «без молочных»)</div>
            </div>
            <button onClick={() => { const nv = !addMilkToBreakfast; setAddMilkToBreakfast(nv); try { localStorage.setItem('he_add_milk_breakfast', nv ? 'true' : 'false'); } catch {} }} style={{ width:34, height:18, borderRadius:9, border:'none', position:'relative', cursor:'pointer', transition:'background 0.2s', background: addMilkToBreakfast ? '#6366f1' : 'rgba(255,255,255,0.15)', flexShrink:0 }}>
              <span style={{ position:'absolute', top:2, width:14, height:14, borderRadius:'50%', background:'#fff', transition:'left 0.2s', left: addMilkToBreakfast ? 17 : 2 }} />
            </button>
          </div>
          {/* Роунд-2: coconutOilBoost удалён — дублирующий тумблер (масла входят пулом жиров) */}
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:4 }}>🍚 Основа завтрака</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
              {[
                { id: 'auto', label: 'Авто' },
                { id: 'porridge', label: 'Каша' },
                { id: 'flakes', label: 'Хлопья' },
                { id: 'eggs', label: 'Яйца' },
                { id: 'cottage', label: 'Творог' },
              ].map(o => (
                <span key={o.id} onClick={() => { setBreakfastStyle(o.id as any); try { localStorage.setItem('he_breakfast_style', o.id); } catch {} }} style={{
                  display:'inline-flex', alignItems:'center', padding:'3px 8px', borderRadius:7, cursor:'pointer', fontSize:9,
                  background: breakfastStyle === o.id ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)',
                  border: breakfastStyle === o.id ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  color: breakfastStyle === o.id ? '#c4b5fd' : 'rgba(255,255,255,0.6)',
                  fontWeight: breakfastStyle === o.id ? 700 : 400,
                }}>{o.label}</span>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:4 }}>📋 Шаблон завтрака</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
              {[
                { id: 'auto', label: 'Авто' },
                { id: 'classic_oat', label: '🥣 Овсянка+банан+ягоды' },
                { id: 'protein_flakes', label: '🌾 Хлопья+протеин' },
                { id: 'eggs_toast', label: '🍳 Яйца+тост' },
                { id: 'cottage_berries', label: '🥛 Творог+черника' },
              ].map(o => (
                <span key={o.id} onClick={() => { setBreakfastTemplate(o.id as any); try { localStorage.setItem('he_breakfast_template', o.id); } catch {} }} style={{
                  display:'inline-flex', alignItems:'center', padding:'3px 8px', borderRadius:7, cursor:'pointer', fontSize:9,
                  background: breakfastTemplate === o.id ? 'rgba(244,114,182,0.15)' : 'rgba(255,255,255,0.03)',
                  border: breakfastTemplate === o.id ? '1px solid rgba(244,114,182,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  color: breakfastTemplate === o.id ? '#f9a8d4' : 'rgba(255,255,255,0.6)',
                  fontWeight: breakfastTemplate === o.id ? 700 : 400,
                }}>{o.label}</span>
              ))}
            </div>
          </div>
        </div>
        <PopupText label="📝 Заметки по питанию" value={customNotes} onChange={v => { setCustomNotes(v); persistPlannerValue('he_nutrition_notes', v); }} placeholder="Например: не ем после 20:00, аллергия на пенициллин, проблемы с ЖКТ..." />
      </GlassCard>
      )}

      {(() => {
        const allRecipes = [...getRecipes(), ...(userRecipes||[])] as Recipe[];
        const prefRecipeRows = (setFn: (v: string[]) => void, current: string[], lsKey: string, search: string) =>
          allRecipes.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase())).map(r => {
            const rid = '__recipe__' + r.name;
            const urid = '__user_recipe__' + r.name;
            const sel = current.includes(rid) || current.includes(urid);
            return (
              <div key={rid} onClick={() => {
                const id = r.name.startsWith('user_') ? urid : rid;
                const upd = sel ? current.filter(x => x !== id) : [...current, id];
                    setFn(upd); persistPlannerValue(lsKey, upd);
              }} style={{
                padding:'6px 8px', borderRadius:8, cursor:'pointer', fontSize:9,
                background: sel ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)',
                border: sel ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
                color: sel ? '#a78bfa' : 'rgba(255,255,255,0.7)',
                display:'flex', alignItems:'center', gap:6,
              }}>
                <span style={{ fontSize:9, minWidth:12 }}>{sel ? '✓' : '○'}</span>
                <span>🍳 {r.name}</span>
                <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginLeft:'auto' }}>{r.kcal} ккал</span>
              </div>
            );
          });
        return <>
      {/* Preferred foods modal */}
      {showPrefFoodModal && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }}
          onClick={() => setShowPrefFoodModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:400, maxHeight:'85vh', padding:16, borderRadius:16, background:'#18181b', border:'1px solid rgba(0,230,138,0.12)', overflowY:'auto' }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#00e68a', marginBottom:8, textAlign:'center' }}>🌟 Любимые продукты и рецепты</div>
            <input value={prefSearch} onChange={e => setPrefSearch(e.target.value)} placeholder="Поиск продуктов и рецептов..." style={{ ...inputStyle, marginBottom:8, fontSize:11, padding:'8px 10px', boxSizing:'border-box', width:'100%' }} />
            <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:'50vh', overflowY:'auto' }}>
              {FOOD_DB.filter(f => !prefSearch || (f.name||'').toLowerCase().includes(prefSearch.toLowerCase()) || (f.id||'').toLowerCase().includes(prefSearch.toLowerCase())).slice(0,60).map(f => {
                const sel = preferredFoods.includes(f.id);
                const mealBound = (['Завтрак','Обед','Ужин','Полдник']).find(m => (preferredByMeal[m]||[]).includes(f.id));
                return (
                  <div key={f.id} style={{ padding:'6px 8px', borderRadius:8, fontSize:9, background: sel ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.02)', border: sel ? '1px solid rgba(0,230,138,0.3)' : '1px solid transparent', color: sel ? '#00e68a' : 'rgba(255,255,255,0.7)', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <span onClick={() => { const upd = sel ? preferredFoods.filter(x => x !== f.id) : [...preferredFoods, f.id]; setPreferredFoods(upd); persistPlannerValue('he_preferred_foods', upd); if (sel) { const bm = {...preferredByMeal}; Object.keys(bm).forEach(k => bm[k] = (bm[k]||[]).filter(x => x !== f.id)); setPreferredByMeal(bm); } }} style={{ cursor:'pointer', fontSize:9, minWidth:12 }}>{sel ? '✅' : '○'}</span>
                    <span style={{ cursor:'pointer' }} onClick={() => { const upd = sel ? preferredFoods.filter(x => x !== f.id) : [...preferredFoods, f.id]; setPreferredFoods(upd); persistPlannerValue('he_preferred_foods', upd); }}>{f.name}</span>
                    {sel && (<div style={{ display:'flex', gap:2, marginLeft:'auto' }}>{[['Завтрак','🌅'],['Обед','☀️'],['Ужин','🌙'],['Полдник','🍏']].map(([m,icon]) => { const isB = (preferredByMeal[m]||[]).includes(f.id); return (<span key={m} onClick={() => { const bm = {...preferredByMeal}; Object.keys(bm).forEach(k => bm[k] = (bm[k]||[]).filter(x => x !== f.id)); bm[m] = [...(bm[m]||[]), f.id]; setPreferredByMeal(bm); }} style={{ cursor:'pointer', fontSize:9, padding:'1px 4px', borderRadius:4, background: isB ? 'rgba(0,230,138,0.25)' : 'rgba(255,255,255,0.03)', border: isB ? '1px solid rgba(0,230,138,0.4)' : '1px solid transparent' }}>{icon}</span>); })}{mealBound && <span onClick={() => { const bm = {...preferredByMeal}; Object.keys(bm).forEach(k => bm[k] = (bm[k]||[]).filter(x => x !== f.id)); setPreferredByMeal(bm); }} style={{ cursor:'pointer', fontSize:10, color:'rgba(255,255,255,0.4)' }} title='Любой приём'>★</span>}</div>)}
                  </div>
                );
              })}
              {allRecipes.length > 0 && !prefSearch && <div style={{ fontSize:10, fontWeight:700, color:'#a78bfa', padding:'6px 0 2px', borderTop:'1px solid rgba(139,92,246,0.15)', marginTop:4 }}>🍳 Рецепты</div>}
              {prefRecipeRows(setPreferredFoods, preferredFoods, 'he_preferred_foods', prefSearch)}
            </div>
            <button onClick={() => setShowPrefFoodModal(false)} style={{ width:'100%', marginTop:8, padding:'8px', borderRadius:8, border:'1px solid rgba(0,230,138,0.2)', background:'rgba(0,230,138,0.08)', color:'#00e68a', cursor:'pointer', fontSize:10, fontWeight:600 }}>✓ Готово ({preferredFoods.length})</button>
          </div>
        </div>
      )}

      {/* Excluded foods modal */}
      {showExclFoodModal && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }}
          onClick={() => setShowExclFoodModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:400, maxHeight:'85vh', padding:16, borderRadius:16, background:'#18181b', border:'1px solid rgba(239,68,68,0.12)', overflowY:'auto' }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#ef4444', marginBottom:8, textAlign:'center' }}>🚫 Исключённые продукты и рецепты</div>
            <input value={exclSearch} onChange={e => setExclSearch(e.target.value)} placeholder="Поиск продуктов и рецептов..." style={{ ...inputStyle, marginBottom:8, fontSize:11, padding:'8px 10px', boxSizing:'border-box', width:'100%' }} />
            <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:'50vh', overflowY:'auto' }}>
              {FOOD_DB.filter(f => !exclSearch || (f.name||'').toLowerCase().includes(exclSearch.toLowerCase()) || (f.id||'').toLowerCase().includes(exclSearch.toLowerCase())).slice(0,60).map(f => {
                const sel = excludedFoods.includes(f.id);
                return (
                  <div key={f.id} onClick={() => {
                    const upd = sel ? excludedFoods.filter(x => x !== f.id) : [...excludedFoods, f.id];
                    setExcludedFoods(upd); persistPlannerValue('he_excluded_foods', upd);
                  }} style={{
                    padding:'6px 8px', borderRadius:8, cursor:'pointer', fontSize:9,
                    background: sel ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.02)',
                    border: sel ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent',
                    color: sel ? '#ef4444' : 'rgba(255,255,255,0.7)',
                    display:'flex', alignItems:'center', gap:6,
                  }}>
                    <span style={{ fontSize:9, minWidth:12 }}>{sel ? '✓' : '○'}</span>
                    <span>{f.name}</span>
                  </div>
                );
              })}
              {allRecipes.length > 0 && !exclSearch && <div style={{ fontSize:10, fontWeight:700, color:'#a78bfa', padding:'6px 0 2px', borderTop:'1px solid rgba(139,92,246,0.15)', marginTop:4 }}>🍳 Рецепты</div>}
              {prefRecipeRows(setExcludedFoods, excludedFoods, 'he_excluded_foods', exclSearch)}
            </div>
            <button onClick={() => setShowExclFoodModal(false)} style={{ width:'100%', marginTop:8, padding:'8px', borderRadius:8, border:'1px solid rgba(239,68,68,0.2)', background:'rgba(239,68,68,0.08)', color:'#ef4444', cursor:'pointer', fontSize:10, fontWeight:600 }}>✓ Готово ({excludedFoods.length})</button>
          </div>
        </div>
      )}
      </>;
      })()}

      {plannerMode === 'pro' && (
      <GlassCard title="Циклирование" icon="🔄" color="#3b82f6">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
          {[
            { id: 'none' as CycleType, label: 'Выкл', icon: '⏹️' },
            { id: 'macro' as CycleType, label: 'Макросы', icon: '🔄' },
            { id: 'butch' as CycleType, label: 'БУЧ', icon: '⤴️⤵️' },
            { id: 'cheatmeal' as CycleType, label: 'Читмил', icon: '🍔' },
            { id: 'carbload' as CycleType, label: 'Углев. загр.', icon: '🍚' },
          ].map(c => (
            <PillBtn key={c.id} active={cyclingMode === c.id} onClick={() => setCyclingMode(c.id)} color={cyclingMode === c.id ? '#3b82f6' : undefined}>
              {c.icon} {c.label}
            </PillBtn>
          ))}
        </div>
        {cyclingMode !== 'none' && (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>
            {cyclingMode === 'macro' && 'Тренировочные: +15% ккал/+30% угл. Отдых: −15% ккал/−30% угл. Белок постоянный.'}
            {cyclingMode === 'butch' && '3 дня ВУ (тренировочные) + 1 день НУ (отдых). Белок 2.2г/кг всегда.'}
            {cyclingMode === 'cheatmeal' && 'Один приём пищи ПОСЛЕ тяжёлой тренировки. До 1500 ккал.'}
            {cyclingMode === 'carbload' && '6-8г/кг углеводов за 24-48ч до тяжёлой тренировки. +1-1.5л воды.'}
          </div>
        )}
        {(cyclingMode === 'macro' || cyclingMode === 'butch') && (
          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#60a5fa', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              📅 Выберите тренировочные дни:
            </div>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
              {DAY_LABELS.map((label, idx) => {
                const isTrain = trainingDays[idx];
                return (
                  <button key={idx} onClick={() => {
                    setTrainingDays(trainingDays.map((d, i) => i === idx ? !d : d));
                  }} style={{
                    width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
                    border: isTrain ? '2px solid #22c55e' : '2px solid #3f3f46',
                    background: isTrain ? 'rgba(34,197,94,0.2)' : '#202023',
                    color: isTrain ? '#22c55e' : 'rgba(255,255,255,0.85)',
                    fontSize: 10, fontWeight: isTrain ? 800 : 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>
              <span>🏋️ {trainingDays.filter(Boolean).length} тренировочных</span>
              <span>😴 {trainingDays.filter(d => !d).length} выходных</span>
            </div>
          </div>
        )}
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: weightAdaptMode ? 'rgba(167,139,250,0.05)' : 'rgba(255,255,255,0.02)', border: weightAdaptMode ? '1px solid rgba(167,139,250,0.15)' : '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: weightAdaptMode ? 8 : 0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:14 }}>⚖️</span>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color: weightAdaptMode ? '#a78bfa' : 'rgba(255,255,255,0.5)' }}>Адаптация веса</div>
                {!weightAdaptMode && <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)' }}>Автокоррекция КБЖУ по динамике веса</div>}
              </div>
            </div>
            <label style={{ position:'relative', display:'inline-block', width:40, height:22, cursor:'pointer' }}>
              <input type="checkbox" checked={weightAdaptMode} onChange={e => { setWeightAdaptMode(e.target.checked); if (e.target.checked) setShowWeightAdaptModal(true); }} style={{ opacity:0, width:0, height:0 }} />
              <span style={{
                position:'absolute', inset:0, borderRadius:11, transition:'0.2s',
                background: weightAdaptMode ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.15)',
              }}>
                <span style={{
                  position:'absolute', top:2, left: weightAdaptMode ? 20 : 2, width:18, height:18, borderRadius:'50%',
                  background:'#fff', transition:'0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </span>
            </label>
          </div>
          {weightAdaptMode && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, marginBottom:8 }}>
                {[
                  { label:'Записей', value:`${weightLogEntries.length}`, color:'#a78bfa' },
                  { label:'Период', value: weightLogPeriod === 'daily' ? 'день' : weightLogPeriod === 'every2' ? '2 дня' : weightLogPeriod === 'every3' ? '3 дня' : 'нед', color:'#60a5fa' },
                  { label:'Цель', value:`${expectedLossKgWeek} кг/нед`, color:'#f59e0b' },
                ].map(s => (
                  <div key={s.label} style={{ padding:'6px 4px', borderRadius:8, textAlign:'center', background:'rgba(255,255,255,0.03)' }}>
                    <div style={{ fontSize:9, fontWeight:700, color:s.color }}>{s.value}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.8)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {weightLogEntries.length >= 2 && (() => {
                const diff = weightLogEntries[weightLogEntries.length-1].weight - weightLogEntries[0].weight;
                return (
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:6, textAlign:'center' }}>
                    Динамика: <strong style={{color: diff < 0 ? '#22c55e' : diff > 0 ? '#ef4444' : '#fff'}}>{diff > 0 ? '+' : ''}{diff.toFixed(1)} кг</strong>
                  </div>
                );
              })()}
              <button onClick={() => setShowWeightAdaptModal(true)} style={{
                width:'100%', padding:'6px', borderRadius:8, cursor:'pointer', fontSize:9, fontWeight:600,
                background:'rgba(167,139,250,0.08)', border:'1px solid rgba(167,139,250,0.15)', color:'#a78bfa',
              }}>✏️ Настроить замеры</button>
            </>
          )}
        </div>

        {/* Metabolic adaptation */}
        {(() => {
          return <>
            <div style={{ marginTop:12, padding:12, borderRadius:12, background: metabolicAdaptEnabled ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.02)', border: metabolicAdaptEnabled ? '1px solid rgba(245,158,11,0.15)' : '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:14 }}>🔄</span>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color: metabolicAdaptEnabled ? '#f59e0b' : 'rgba(255,255,255,0.5)' }}>Метаболическая адаптация</div>
                    {!metabolicAdaptEnabled && <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)' }}>Снижение TDEE при длительном дефиците</div>}
                  </div>
                </div>
                <button onClick={() => setShowMetaModal(true)} style={{
                  padding:'5px 10px', borderRadius:8, fontSize:9, fontWeight:600, cursor:'pointer',
                  background: metabolicAdaptEnabled ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
                  border: metabolicAdaptEnabled ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.06)',
                  color: metabolicAdaptEnabled ? '#f59e0b' : 'rgba(255,255,255,0.5)',
                }}>{metabolicAdaptEnabled ? '✏️ Настроить' : '⚙️ Настроить'}</button>
              </div>
              {metabolicAdaptEnabled && (
                <div style={{ marginTop:8, padding:'6px 10px', borderRadius:8, background:'rgba(245,158,11,0.04)', textAlign:'center' }}>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.85)' }}>TDEE снижен на <strong style={{ color:'#f59e0b' }}>{metabolicAdaptPct}%</strong></span>
                </div>
              )}
            </div>

            {/* Metabolic adaptation modal */}
            {showMetaModal && (
              <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }}
                onClick={() => setShowMetaModal(false)}>
                <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:380, borderRadius:20, background:'#18181b', border:'1px solid rgba(245,158,11,0.12)', overflow:'hidden', boxShadow:'0 16px 60px rgba(0,0,0,0.5)' }}>
                  <div style={{ height:3, background:'linear-gradient(90deg,#f59e0b,#f97316)' }} />
                  <div style={{ padding:'16px 20px 20px' }}>
                    <div style={{ fontSize:17, fontWeight:700, color:'#f59e0b', marginBottom:2, letterSpacing:-0.3 }}>🔄 Метаболическая адаптация</div>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:14, lineHeight:1.4 }}>
                      При длительном дефиците калорий метаболизм замедляется. Система скорректирует TDEE на указанный процент, чтобы план оставался реалистичным.
                    </div>

                    <div style={{ padding:'12px 14px', borderRadius:10, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.08)', marginBottom:14 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:9, color:'rgba(255,255,255,0.85)' }}>Снижение TDEE</span>
                        <span style={{ fontSize:16, fontWeight:800, color:'#f59e0b' }}>{metabolicAdaptPct}%</span>
                      </div>
                      <input type="range" min="0" max="30" step="1" value={metabolicAdaptPct} onChange={e => setMetabolicAdaptPct(+e.target.value)} style={{ width:'100%' }} />
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'rgba(255,255,255,0.2)' }}>
                        <span>0% — выкл</span>
                        <span>15% — умеренно</span>
                        <span>30% — макс</span>
                      </div>
                    </div>

                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', lineHeight:1.5, marginBottom:14, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.02)' }}>
                      Рекомендуется 5–15% при дефиците дольше 4–6 недель. Более 20% только под наблюдением.
                    </div>

                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => { setMetabolicAdaptEnabled(false); setMetabolicAdaptPct(0); setShowMetaModal(false); }} style={{
                        flex:1, padding:'10px', borderRadius:10, cursor:'pointer', fontSize:10, fontWeight:600,
                        border:'1px solid rgba(255,255,255,0.1)', background:'#202023', color:'rgba(255,255,255,0.85)',
                      }}>Отключить</button>
                      <button onClick={() => { setMetabolicAdaptEnabled(metabolicAdaptPct > 0); setShowMetaModal(false); }} style={{
                        flex:1, padding:'10px', borderRadius:10, cursor:'pointer', fontSize:10, fontWeight:700,
                        border:'none', background:'linear-gradient(135deg,#f59e0b,#f97316)', color:'#fff',
                        boxShadow:'0 4px 12px rgba(245,158,11,0.2)',
                      }}>✓ Применить</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>;
        })()}

        {/* Хочу сладкое */}
        <div style={{ marginTop:12, padding:12, borderRadius:12, background: cravingMode ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)', border: cravingMode ? '1px solid rgba(239,68,68,0.15)' : '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:14 }}>🍬</span>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color: cravingMode ? '#ef4444' : 'rgba(255,255,255,0.5)' }}>Хочу сладкое</div>
                {!cravingMode && <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)' }}>Разовый десерт в выбранные дни</div>}
              </div>
            </div>
            <button onClick={() => setCravingMode(!cravingMode)} style={{
              padding:'5px 10px', borderRadius:8, fontSize:9, fontWeight:600, cursor:'pointer',
              background: cravingMode ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
              border: cravingMode ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.06)',
              color: cravingMode ? '#ef4444' : 'rgba(255,255,255,0.5)',
            }}>{cravingMode ? '✓ Вкл' : 'Выкл'}</button>
          </div>
          {cravingMode && (
            <>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginTop:6, marginBottom:6, lineHeight:1.4 }}>
                Разрешает один приём пищи с десертом/сладким в выбранные дни. Помогает соблюдать диету без срывов.
              </div>
              <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                {(() => DAY_LABELS.map((label, idx) => {
                  const sel = idx < cravingDays;
                  return (
                    <button key={idx} onClick={() => {
                      if (sel) setCravingDays(Math.max(1, cravingDays - 1));
                      else setCravingDays(Math.min(7, cravingDays + 1));
                    }} style={{
                      width:36, height:36, borderRadius:'50%', cursor:'pointer',
                      border: sel ? '2px solid #ef4444' : '2px solid #3f3f46',
                      background: sel ? 'rgba(239,68,68,0.2)' : '#202023',
                      color: sel ? '#ef4444' : 'rgba(255,255,255,0.85)',
                      fontSize:10, fontWeight: sel ? 800 : 500,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'all 0.15s',
                    }}>{label}</button>
                  );
                }))()}
              </div>
              <div style={{ textAlign:'center', marginTop:4, fontSize:9, color:'rgba(255,255,255,0.8)' }}>
                {cravingDays} {cravingDays === 1 ? 'день' : 'дней'} с десертом
              </div>
            </>
          )}
        </div>

        {/* Ленивый день */}
        <div style={{ marginTop:8, padding:12, borderRadius:12, background: lazyDayMode ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.02)', border: lazyDayMode ? '1px solid rgba(245,158,11,0.15)' : '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:14 }}>🛋</span>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color: lazyDayMode ? '#f59e0b' : 'rgba(255,255,255,0.5)' }}>Ленивый день</div>
                {!lazyDayMode && <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)' }}>Минимум готовки в выбранные дни</div>}
              </div>
            </div>
            <button onClick={() => setLazyDayMode(!lazyDayMode)} style={{
              padding:'5px 10px', borderRadius:8, fontSize:9, fontWeight:600, cursor:'pointer',
              background: lazyDayMode ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
              border: lazyDayMode ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.06)',
              color: lazyDayMode ? '#f59e0b' : 'rgba(255,255,255,0.5)',
            }}>{lazyDayMode ? '✓ Вкл' : 'Выкл'}</button>
          </div>
          {lazyDayMode && (
            <>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginTop:6, marginBottom:6, lineHeight:1.4 }}>
                День с минимальной готовкой — протеиновый коктейль, творог, хлопья. Снижает нагрузку, когда нет сил или времени.
              </div>
              <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                {(() => DAY_LABELS.map((label, idx) => {
                  const sel = idx < lazyDayDays;
                  return (
                    <button key={idx} onClick={() => {
                      if (sel) setLazyDayDays(Math.max(1, lazyDayDays - 1));
                      else setLazyDayDays(Math.min(7, lazyDayDays + 1));
                    }} style={{
                      width:36, height:36, borderRadius:'50%', cursor:'pointer',
                      border: sel ? '2px solid #f59e0b' : '2px solid #3f3f46',
                      background: sel ? 'rgba(245,158,11,0.2)' : '#202023',
                      color: sel ? '#f59e0b' : 'rgba(255,255,255,0.85)',
                      fontSize:10, fontWeight: sel ? 800 : 500,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'all 0.15s',
                    }}>{label}</button>
                  );
                }))()}
              </div>
              <div style={{ textAlign:'center', marginTop:4, fontSize:9, color:'rgba(255,255,255,0.8)' }}>
                {lazyDayDays} {lazyDayDays === 1 ? 'день' : 'дней'} без готовки
              </div>
            </>
          )}
        </div>

        {/* Периодизация диеты */}
        <div style={{ marginTop:8, padding:12, borderRadius:12, background: periodizationEnabled ? 'rgba(139,92,246,0.05)' : 'rgba(255,255,255,0.02)', border: periodizationEnabled ? '1px solid rgba(139,92,246,0.15)' : '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:14 }}>🔄</span>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color: periodizationEnabled ? '#8b5cf6' : 'rgba(255,255,255,0.5)' }}>Периодизация диеты</div>
                {!periodizationEnabled && <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)' }}>Чередование фаз дефицита/поддержания</div>}
              </div>
            </div>
            <button onClick={() => setPeriodizationEnabled(!periodizationEnabled)} style={{
              padding:'5px 10px', borderRadius:8, fontSize:9, fontWeight:600, cursor:'pointer',
              background: periodizationEnabled ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.04)',
              border: periodizationEnabled ? '1px solid rgba(139,92,246,0.2)' : '1px solid rgba(255,255,255,0.06)',
              color: periodizationEnabled ? '#8b5cf6' : 'rgba(255,255,255,0.5)',
            }}>{periodizationEnabled ? '✓ Вкл' : 'Выкл'}</button>
          </div>
          {periodizationEnabled && (
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginTop:6, lineHeight:1.4 }}>
              Чередование 2 недели дефицита + 2 недели поддержания. Помогает избежать метаболической адаптации и плато. Рекомендуется при длительном жиросжигании (8+ недель).
            </div>
          )}
        </div>

        {/* Special Meal — collapsed card + popup */}
        <div style={{ marginTop:8, padding:12, borderRadius:12, background: specialMealMode ? 'rgba(249,115,22,0.05)' : 'rgba(255,255,255,0.02)', border: specialMealMode ? '1px solid rgba(249,115,22,0.15)' : '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:14 }}>🍽️</span>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color: specialMealMode ? '#f97316' : 'rgba(255,255,255,0.5)' }}>Спецприём</div>
                {specialMealMode ? (
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.8)' }}>
                    {specialMealGoalLabel} · {specialMealTimingLabel} · {specialMealProteinG + specialMealFatG + specialMealCarbsG}г · ∑ {specialMealProteinG * 4 + specialMealFatG * 9 + specialMealCarbsG * 4} ккал
                  </div>
                ) : (
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)' }}>Отдельный приём с заданными макросами</div>
                )}
              </div>
            </div>
            <div style={{ display:'flex', gap:4 }}>
              {specialMealMode && (
                <button onClick={() => setShowSpecialMealModal(true)} style={{
                  padding:'5px 10px', borderRadius:8, fontSize:9, fontWeight:600, cursor:'pointer',
                  background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.2)', color:'#f97316',
                }}>⚙️ Настроить</button>
              )}
              <button onClick={() => setSpecialMealMode(!specialMealMode)} style={{
                padding:'5px 10px', borderRadius:8, fontSize:9, fontWeight:600, cursor:'pointer',
                background: specialMealMode ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.04)',
                border: specialMealMode ? '1px solid rgba(249,115,22,0.2)' : '1px solid rgba(255,255,255,0.06)',
                color: specialMealMode ? '#f97316' : 'rgba(255,255,255,0.5)',
              }}>{specialMealMode ? '✓ Вкл' : 'Выкл'}</button>
            </div>
          </div>
        </div>

        {/* Special Meal — popup */}
        {showSpecialMealModal && (
          <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }}
            onClick={() => setShowSpecialMealModal(false)}>
            <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:380, maxHeight:'85vh', borderRadius:16, background:'#18181b', border:'1px solid rgba(249,115,22,0.12)', overflow:'hidden', boxShadow:'0 16px 60px rgba(0,0,0,0.5)' }}>
              <div style={{ height:3, background:'linear-gradient(90deg,#f97316,#fb923c)' }} />
              <div style={{ padding:'16px 20px 20px', overflowY:'auto', maxHeight:'calc(85vh - 23px)' }}>
                <div style={{ fontSize:17, fontWeight:700, color:'#f97316', marginBottom:14, letterSpacing:-0.3 }}>🍽️ Настройка спецприёма</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:4 }}>Цель приёма</div>
                    {Object.entries(goalLabels).map(([k,v]) => (
                      <button key={k} onClick={() => setSpecialMealGoal(k)} style={{
                        display:'block', width:'100%', padding:'8px 10px', marginBottom:3, borderRadius:8, cursor:'pointer', textAlign:'left', fontSize:9, fontWeight:600,
                        background: specialMealGoal === k ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.02)',
                        border: specialMealGoal === k ? '1.5px solid #f97316' : '1px solid rgba(255,255,255,0.05)',
                        color: specialMealGoal === k ? '#f97316' : 'rgba(255,255,255,0.7)',
                      }}>{v}</button>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:4 }}>Время приёма</div>
                    {Object.entries(timingLabels).map(([k,v]) => (
                      <button key={k} onClick={() => setSpecialMealTiming(k)} style={{
                        display:'block', width:'100%', padding:'8px 10px', marginBottom:3, borderRadius:8, cursor:'pointer', textAlign:'left', fontSize:9, fontWeight:600,
                        background: specialMealTiming === k ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.02)',
                        border: specialMealTiming === k ? '1.5px solid #f97316' : '1px solid rgba(255,255,255,0.05)',
                        color: specialMealTiming === k ? '#f97316' : 'rgba(255,255,255,0.7)',
                      }}>{v}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:6 }}>Макросы (г)</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                    {[
                      { key:'p', label:'🥩 Белок', val:specialMealProteinG, set:setSpecialMealProteinG, color:'#22c55e' },
                      { key:'f', label:'🧈 Жиры', val:specialMealFatG, set:setSpecialMealFatG, color:'#f59e0b' },
                      { key:'c', label:'🍚 Углеводы', val:specialMealCarbsG, set:setSpecialMealCarbsG, color:'#3b82f6' },
                    ].map(m => (
                      <div key={m.key}>
                        <input type="number" min={0} step="any" value={m.val} onChange={e => m.set(Math.max(0, Math.round(parseFloat(e.target.value) || 0)))} style={{
                          width:'100%', padding:'8px 6px', borderRadius:8, fontSize:11, fontWeight:700, textAlign:'center',
                          background:'#202023', border:`1px solid ${m.color}30`, color:m.color, outline:'none', boxSizing:'border-box',
                        }} />
                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', textAlign:'center', marginTop:2 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', textAlign:'center', marginBottom:12 }}>
                  ∑ {specialMealProteinG * 4 + specialMealFatG * 9 + specialMealCarbsG * 4} ккал · {specialMealProteinG + specialMealFatG + specialMealCarbsG}г общ.
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                  <button onClick={() => setShowReplaceMealPopup(true)} style={{
                    flex:1, padding:'10px 12px', borderRadius:10, cursor:'pointer', fontSize:9, fontWeight:600, display:'flex', alignItems:'center', gap:6, justifyContent:'center',
                    background: specialMealReplaceMode ? 'rgba(0,230,138,0.1)' : 'rgba(0,230,138,0.04)',
                    border: specialMealReplaceMode ? '1.5px solid #00e68a' : '1px solid rgba(0,230,138,0.15)',
                    color: specialMealReplaceMode ? '#00e68a' : 'rgba(0,230,138,0.7)',
                    transition:'all 0.12s',
                  }}>
                    🔄 Заменить приём{specialMealReplaceMode ? ` (${specialMealReplaceTarget})` : ''}
                  </button>
                </div>
                <button onClick={() => setShowSpecialMealModal(false)} style={{
                  width:'100%', padding:'11px', borderRadius:10, cursor:'pointer', border:'none',
                  background:'linear-gradient(135deg,#f97316,#fb923c)', color:'#fff', fontSize:11, fontWeight:700,
                  boxShadow:'0 4px 12px rgba(249,115,22,0.2)',
                }}>✓ Готово</button>
                {showReplaceMealPopup && (
                  <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }}
                    onClick={() => setShowReplaceMealPopup(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:380, padding:16, borderRadius:16, background:'#18181b', border:'1px solid rgba(0,230,138,0.12)', boxShadow:'0 8px 40px rgba(0,0,0,0.4)' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                        <div style={{ fontSize:15, fontWeight:700, color:'#00e68a', letterSpacing:-0.3 }}>🔄 Заменить приём</div>
                        <button onClick={() => setShowReplaceMealPopup(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.85)', fontSize:18, cursor:'pointer', padding:'0 4px', lineHeight:1 }}>×</button>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:3, marginBottom:12 }}>
                        {[
                          { id:'Завтрак', icon:'🌅' },
                          { id:'Обед', icon:'☀️' },
                          { id:'Ужин', icon:'🌆' },
                          { id:'Перекус', icon:'🍪' },
                          { id:'Полдник', icon:'🧁' },
                          { id:'Второй завтрак', icon:'🥐' },
                        ].map(m => {
                          const sel = specialMealReplaceTarget === m.id && specialMealReplaceMode;
                          return (
                            <div key={m.id} onClick={() => { setSpecialMealReplaceTarget(m.id); setSpecialMealReplaceMode(true); setShowReplaceMealPopup(false); }} style={{
                              padding:'10px 12px', borderRadius:10, cursor:'pointer', fontSize:10, fontWeight:500,
                              background: sel ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.02)',
                              border: sel ? '1.5px solid rgba(0,230,138,0.3)' : '1px solid transparent',
                              color: sel ? '#00e68a' : 'rgba(255,255,255,0.7)',
                              display:'flex', alignItems:'center', gap:8,
                            }}>
                              <span style={{ fontSize:14 }}>{m.icon}</span>
                              <span>{m.id}</span>
                              {sel && <span style={{ marginLeft:'auto', color:'#00e68a', fontSize:10, fontWeight:700 }}>✓</span>}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => { setSpecialMealReplaceMode(false); setShowReplaceMealPopup(false); }} style={{
                          flex:1, padding:'10px', borderRadius:10, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', background:'#202023', color:'rgba(255,255,255,0.85)', fontSize:10, fontWeight:600,
                        }}>Отмена</button>
                        <button onClick={() => setShowReplaceMealPopup(false)} style={{
                          flex:1, padding:'10px', borderRadius:10, cursor:'pointer', border:'none', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontSize:10, fontWeight:700,
                        }}>✓ Готово</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </GlassCard>
      )}

      {/* Weight adaptation modal */}
      {showWeightAdaptModal && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }}
          onClick={() => setShowWeightAdaptModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:380, maxHeight:'80vh', borderRadius:20, background:'#18181b', border:'1px solid rgba(167,139,250,0.12)', overflow:'hidden', boxShadow:'0 16px 60px rgba(0,0,0,0.5)' }}>
            {/* Header accent */}
            <div style={{ height:3, background:'linear-gradient(90deg,#a78bfa,#7c3aed)' }} />
            <div style={{ padding:'16px 20px 20px', overflowY:'auto', maxHeight:'calc(80vh - 23px)' }}>
              <div style={{ fontSize:17, fontWeight:700, color:'#a78bfa', marginBottom:2, letterSpacing:-0.3 }}>⚖️ Адаптация веса</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:14, lineHeight:1.4 }}>
                Система скорректирует калорийность, если фактическая динамика веса отличается от ожидаемой.
              </div>

              {/* Period selector — styled pills */}
              <div style={{ fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.85)', marginBottom:6 }}>📅 Периодичность замеров</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:14 }}>
                {[
                  { id:'daily', label:'Ежедневно', slots:7, icon:'📆' },
                  { id:'every2', label:'Каждые 2 дня', slots:4, icon:'📅' },
                  { id:'every3', label:'Каждые 3 дня', slots:3, icon:'📅' },
                  { id:'weekly', label:'Еженедельно', slots:2, icon:'📋' },
                ].map(p => (
                  <button key={p.id} onClick={() => {
                    setWeightLogPeriod(p.id);
                    // FIX button-audit: при смене периода сохраняем введённые пользователем веса по датам
                    // (раньше все замеры перезаписывались заглушками с одинаковым весом)
                    const existing = [...weightLogEntries];
                    const lastWeight = existing.length > 0 ? existing[existing.length - 1].weight : 80;
                    const byDate = new Map(existing.map(e => [e.date, e.weight]));
                    const entries: { date: string; weight: number }[] = [];
                    const step = p.id === 'daily' ? 1 : p.id === 'every2' ? 2 : p.id === 'every3' ? 3 : 4;
                    for (let i = 0; i < p.slots; i++) {
                      const d = new Date(); d.setDate(d.getDate() - (p.slots - 1 - i) * step);
                      const ds = d.toISOString().split('T')[0];
                      entries.push({ date: ds, weight: byDate.has(ds) ? byDate.get(ds) as number : lastWeight });
                    }
                    setWeightLogEntries(entries);
                  }} style={{
                    padding:'12px 8px', borderRadius:12, cursor:'pointer', textAlign:'center',
                    background: weightLogPeriod === p.id ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.02)',
                    border: weightLogPeriod === p.id ? '1.5px solid rgba(167,139,250,0.35)' : '1px solid rgba(255,255,255,0.05)',
                    color: weightLogPeriod === p.id ? '#a78bfa' : 'rgba(255,255,255,0.6)',
                    fontWeight: weightLogPeriod === p.id ? 700 : 400, fontSize:9,
                    transition:'all 0.12s',
                  }}>
                    <div style={{ fontSize:16, marginBottom:2 }}>{p.icon}</div>
                    <div style={{ fontSize:11, fontWeight:600 }}>{p.label}</div>
                    <div style={{ fontSize:9, color: weightLogPeriod === p.id ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.3)', marginTop:1 }}>{p.slots} замер{p.slots > 1 ? 'ов' : ''}</div>
                  </button>
                ))}
              </div>

              {/* Expected loss */}
              <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.08)', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.85)', whiteSpace:'nowrap' }}>🎯 Ожидаемое снижение:</span>
                  <input type="number" min={0} step="0.1" value={expectedLossKgWeek} onChange={e => setExpectedLossKgWeek(Math.max(0, +e.target.value || 0))} style={{ ...inputStyle, width:65, textAlign:'center', fontWeight:700 }} />
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.8)' }}>кг/нед</span>
                </div>
              </div>

              {/* Weight entries */}
              <div style={{ fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.85)', marginBottom:4 }}>📊 Замеры веса</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', marginBottom:8, lineHeight:1.3 }}>
                Вводите вес в разные дни. Не обязательно заполнять всё сразу — записи сохраняются автоматически.
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:10 }}>
                {weightLogEntries.map((entry, idx) => (
                  <div key={idx} style={{ display:'flex', gap:6, alignItems:'center', padding:'7px 10px', borderRadius:10, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize:9, color:'rgba(255,255,255,0.75)', minWidth:16, fontWeight:600 }}>#{idx+1}</span>
                    <input type="date" value={entry.date} onChange={e => {
                      const nw = [...weightLogEntries]; nw[idx] = { ...nw[idx], date: e.target.value }; setWeightLogEntries(nw);
                    }} style={{ ...inputStyle, flex:1, fontSize:10, padding:'6px 8px' }} />
                    <input type="number" min={30} max={300} step="0.1" value={entry.weight} onChange={e => {
                      // FIX input-audit: clamp 30-300 — вес 0/отрицательный давал ложный «сброс веса»
                      // и молча поднимал калораж до +20%
                      const nw = [...weightLogEntries]; nw[idx] = { ...nw[idx], weight: Math.max(30, Math.min(300, +e.target.value || 30)) }; setWeightLogEntries(nw);
                    }} placeholder="Вес" style={{ ...inputStyle, width:80, fontSize:12, fontWeight:700, textAlign:'center', padding:'6px 8px' }} />
                    <span style={{ fontSize:9, color:'rgba(255,255,255,0.25)' }}>кг</span>
                    {weightLogEntries.length > 1 && (
                      <button onClick={() => setWeightLogEntries(weightLogEntries.filter((_, i) => i !== idx))} style={{
                        background:'rgba(239,68,68,0.08)', border:'none', color:'#ef4444', fontSize:10, cursor:'pointer', borderRadius:6, padding:'3px 7px',
                      }}>✕</button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add entry button */}
              <button onClick={() => {
                // FIX button-audit: guard на Invalid Date (пустая дата последней записи → RangeError)
                const _rawLast = weightLogEntries.length > 0 ? new Date(weightLogEntries[weightLogEntries.length - 1].date) : null;
                const lastDate = (_rawLast && Number.isFinite(_rawLast.getTime())) ? _rawLast : new Date();
                const nextDate = new Date(lastDate); nextDate.setDate(nextDate.getDate() + 1);
                setWeightLogEntries([...weightLogEntries, { date: nextDate.toISOString().split('T')[0], weight: weightLogEntries.length > 0 ? weightLogEntries[weightLogEntries.length - 1].weight : 80 }]);
              }} style={{
                width:'100%', padding:'8px', borderRadius:9, cursor:'pointer', fontSize:9, fontWeight:600, marginBottom:12,
                background:'rgba(167,139,250,0.05)', border:'1.5px dashed rgba(167,139,250,0.2)', color:'#a78bfa',
              }}>+ Добавить замер на следующий день</button>

              {/* Summary */}
              {weightLogEntries.length >= 2 && (() => {
                const firstW = weightLogEntries[0].weight;
                const lastW = weightLogEntries[weightLogEntries.length - 1].weight;
                const diff = lastW - firstW;
                // FIX button-audit: guard на Invalid Date — пустые даты не дают NaN-темп
                const _t1 = new Date(weightLogEntries[0].date).getTime();
                const _t2 = new Date(weightLogEntries[weightLogEntries.length-1].date).getTime();
                const daysBetween = (Number.isFinite(_t1) && Number.isFinite(_t2)) ? Math.round((_t2 - _t1) / 86400000) : 0;
                const weeklyRate = daysBetween > 0 ? diff / daysBetween * 7 : 0;
                const onTrack = weeklyRate < 0 && expectedLossKgWeek > 0 && Math.abs(weeklyRate) >= expectedLossKgWeek * 0.7 && Math.abs(weeklyRate) <= expectedLossKgWeek * 1.3;
                return (
                  <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(167,139,250,0.03)', border:'1px solid rgba(167,139,250,0.08)', marginBottom:14 }}>
                    <div style={{ fontSize:9, fontWeight:600, color:'#a78bfa', marginBottom:4, display:'flex', alignItems:'center', gap:4 }}>
                      <span>📈 Динамика</span>
                      {onTrack && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'rgba(34,197,94,0.12)', color:'#22c55e', fontWeight:700 }}>В ЦЕЛИ</span>}
                    </div>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.55)', lineHeight:1.6 }}>
                      <span style={{ color:'rgba(255,255,255,0.35)' }}>{weightLogEntries[0].date}</span>
                      <span style={{ color:'rgba(255,255,255,0.25)', margin:'0 3px' }}>→</span>
                      <span style={{ color:'rgba(255,255,255,0.35)' }}>{weightLogEntries[weightLogEntries.length-1].date}</span>
                      : <strong style={{color: diff < 0 ? '#22c55e' : diff > 0 ? '#ef4444' : '#fff', fontSize:10}}>{diff > 0 ? '+' : ''}{diff.toFixed(1)} кг</strong>
                      <br />
                      Темп: <strong style={{color: weeklyRate < 0 ? '#22c55e' : '#ef4444', fontSize:10}}>{weeklyRate > 0 ? '+' : ''}{weeklyRate.toFixed(2)} кг/нед</strong>
                      {expectedLossKgWeek > 0 && <span style={{ color:'rgba(255,255,255,0.75)' }}> · цель {expectedLossKgWeek} кг/нед</span>}
                      {weeklyRate < 0 && expectedLossKgWeek > 0 && Math.abs(weeklyRate) < expectedLossKgWeek * 0.7 && (
                        <div style={{ color:'#f59e0b', marginTop:3, padding:'3px 6px', borderRadius:4, background:'rgba(245,158,11,0.06)', fontSize:10 }}>⚠️ Темп ниже цели — калорийность будет снижена</div>
                      )}
                      {weeklyRate < 0 && expectedLossKgWeek > 0 && Math.abs(weeklyRate) > expectedLossKgWeek * 1.3 && (
                        <div style={{ color:'#f59e0b', marginTop:3, padding:'3px 6px', borderRadius:4, background:'rgba(245,158,11,0.06)', fontSize:10 }}>⚠️ Темп выше цели — калорийность будет повышена</div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Active toggle */}
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => { setWeightAdaptMode(false); setShowWeightAdaptModal(false); }} style={{
                  flex:1, padding:'10px', borderRadius:10, cursor:'pointer', fontSize:10, fontWeight:600,
                  border:'1px solid rgba(255,255,255,0.1)', background:'#202023', color:'rgba(255,255,255,0.85)',
                }}>Отключить</button>
                <button onClick={() => {
                  setWeightAdaptMode(true);
                  setShowWeightAdaptModal(false);
                }} style={{
                  flex:1, padding:'10px', borderRadius:10, cursor:'pointer', fontSize:10, fontWeight:700,
                  border:'none', background:'linear-gradient(135deg,#a78bfa,#7c3aed)', color:'#fff',
                  boxShadow:'0 4px 12px rgba(167,139,250,0.2)',
                }}>✓ Применить</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(cyclingMode === 'cheatmeal' || cyclingMode === 'carbload') && true && (
        <GlassCard title={cyclingMode === 'cheatmeal' ? 'Читмил' : 'Углеводная загрузка'} icon="📅">
          <div style={{ marginTop: 4, padding: '8px 10px', borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#60a5fa', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              📅 Выберите тренировочные дни (влияют на циклирование и привязку рациона):
            </div>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
              {DAY_LABELS.map((label, idx) => {
                const isHeavy = trainingDays[idx];
                return (
                  <button key={idx} onClick={() => {
                    setTrainingDays(trainingDays.map((d, i) => i === idx ? !d : d));
                  }} style={{
                    width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
                    border: isHeavy ? '2px solid #22c55e' : '2px solid #3f3f46',
                    background: isHeavy ? 'rgba(34,197,94,0.2)' : '#202023',
                    color: isHeavy ? '#22c55e' : 'rgba(255,255,255,0.85)',
                    fontSize: 10, fontWeight: isHeavy ? 800 : 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 4, fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>
              🏋️ Тренировочные дни: {trainingDays.map((d,i) => d ? DAY_LABELS[i] : null).filter(Boolean).join(', ') || '—'}
            </div>
          </div>
        </GlassCard>
      )}



      {/* B1 — SpecialMealPopup */}
      {plannerMode === 'pro' && (
      <GlassCard title="➕ Спецприём" icon="🍽️" color="#f97316">
        <button onClick={() => {
          setSpecialMealType('cheat_meal');
          setSpecialMealDate(new Date().toISOString().split('T')[0]);
          setSpecialMealNotes('');
          setShowSpecialMealPopup(true);
        }} style={{
          width:'100%', padding:'8px', borderRadius:10, cursor:'pointer', fontSize:9, fontWeight:600,
          background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.2)', color:'#f97316',
        }}>➕ Добавить спецприём</button>
        {specialMeals.length > 0 && (
          <div style={{ marginTop:8 }}>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:4 }}>Сохранённые:</div>
            {specialMeals.map((m, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 8px', borderRadius:6, background:'rgba(249,115,22,0.04)', border:'1px solid rgba(249,115,22,0.08)', marginBottom:4, fontSize:9 }}>
                <div>
                  <span style={{ fontWeight:700, color:'#f97316' }}>{m.typeLabel}</span>
                  <span style={{ color:'rgba(255,255,255,0.8)', marginLeft:4 }}>{m.date}</span>
                  {m.replaceMeal && <span style={{ color:'#00e68a', marginLeft:4, fontSize:10, background:'rgba(0,230,138,0.08)', padding:'1px 5px', borderRadius:4 }}>↻ {m.replaceMeal}</span>}
                  {m.notes && <div style={{ color:'rgba(255,255,255,0.85)', marginTop:2, fontSize:10 }}>{m.notes}</div>}
                </div>
                <button onClick={() => { const upd = specialMeals.filter((_, j) => j !== i); setSpecialMeals(upd); persistPlannerValue('he_special_meals', upd); }} style={{ background:'rgba(239,68,68,0.1)', border:'none', color:'#ef4444', cursor:'pointer', borderRadius:4, padding:'2px 6px', fontSize:9 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
      )}

        {/* v2 Scoring Profile moved to top */}

      {showSpecialMealPopup && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }}
          onClick={() => setShowSpecialMealPopup(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:380, padding:16, borderRadius:16, background:'#18181b', border:'1px solid rgba(249,115,22,0.12)', boxShadow:'0 8px 40px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize:15, fontWeight:700, color:'#f97316', marginBottom:14, textAlign:'center' }}>➕ Спецприём</div>
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:4 }}>Тип</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
                {[
                  { id:'cheat_meal' as const, label:'🍔 Читмил' },
                  { id:'refeed' as const, label:'🍝 Рефид' },
                  { id:'fast' as const, label:'⏳ Фастинг' },
                ].map(t => (
                  <button key={t.id} onClick={() => setSpecialMealType(t.id)} style={{
                    padding:'8px 4px', borderRadius:10, cursor:'pointer', textAlign:'center', fontSize:9, fontWeight:600,
                    background: specialMealType === t.id ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.03)',
                    border: specialMealType === t.id ? '1px solid #f97316' : '1px solid rgba(255,255,255,0.06)',
                    color: specialMealType === t.id ? '#f97316' : 'rgba(255,255,255,0.7)',
                  }}>{t.label}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:4 }}>Дата</div>
              <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                {DAY_LABELS.map((label, idx) => {
                  const now = new Date(); const curr = now.getDay() - 1; const dayOff = (idx - curr + 7) % 7;
                  const target = new Date(now); target.setDate(now.getDate() + dayOff);
                  const dateStr = _toLocalIso(target);
                  const sel = specialMealDate === dateStr;
                  return (
                    <button key={idx} onClick={() => setSpecialMealDate(dateStr)} style={{
                      width:36, height:36, borderRadius:'50%', cursor:'pointer', fontSize:9, fontWeight:sel?800:500,
                      background: sel ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.03)',
                      border: sel ? '2px solid #f97316' : '1px solid rgba(255,255,255,0.08)',
                      color: sel ? '#f97316' : 'rgba(255,255,255,0.7)',
                      transition:'all 0.15s',
                    }}>{label}</button>
                  );
                })}
              </div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.75)', textAlign:'center', marginTop:4 }}>{specialMealDate}</div>
            </div>
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:4 }}>Заметки</div>
              <textarea value={specialMealNotes} onChange={e => setSpecialMealNotes(e.target.value)} placeholder="Описание..." style={{ ...inputStyle, width:'100%', minHeight:50, resize:'vertical', boxSizing:'border-box', fontSize:9 }} rows={2} />
            </div>
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:4 }}>Заменить приём</div>
              <select value={selectedMealToReplace} onChange={e => setSelectedMealToReplace(e.target.value)}
                style={{ width:'100%', padding:'8px 10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'#202023', color:'#fff', fontSize:10 }}>
                <option value="">— Без замены (добавить) —</option>
                {['Завтрак','Обед','Ужин','Перекус'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={() => setShowSpecialMealPopup(false)} style={{ flex:1, padding:'10px', borderRadius:10, cursor:'pointer', border:'1px solid rgba(255,255,255,0.15)', background:'#202023', color:'#fff', fontSize:10, fontWeight:600 }}>Отмена</button>
              <button onClick={() => {
                const typeLabels: Record<string, string> = { cheat_meal:'🍔 Читмил', refeed:'🍝 Рефид', fast:'⏳ Фастинг' };
                const newItem = { type: specialMealType, typeLabel: typeLabels[specialMealType], date: specialMealDate, notes: specialMealNotes, replaceMeal: selectedMealToReplace || undefined };
                const upd = [...specialMeals, newItem];
                // FIX button-audit: state-закрытие ПОСЛЕ persist (иначе при QuotaExceeded модалка
                // не закрывалась и повторный клик плодил дубликаты)
                setSelectedMealToReplace('');
                setShowSpecialMealPopup(false);
                setSpecialMeals(upd);
                persistPlannerValue('he_special_meals', upd);
              }} style={{ flex:1, padding:'10px', borderRadius:10, cursor:'pointer', border:'none', background:'linear-gradient(135deg,#f97316,#fb923c)', color:'#fff', fontSize:10, fontWeight:700 }}>✓ Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* Кнопка генерации внизу настроек */}
      <button onClick={() => { try { const _err = _validatePlannerInput(); if (_err) { setErrorMsg(_err); return; } setErrorMsg(null); generatePlan(1); setPlanTab('plan'); } catch (e: any) { try { setErrorMsg('Ошибка: ' + (e?.message || String(e))); } catch {} } }} style={{
        width: '100%', padding: '14px', borderRadius: 12, cursor: 'pointer',
        fontSize: 13, fontWeight: 700,
        background: 'linear-gradient(135deg,#00e68a,#00c8a0)', border: 'none', color: '#000',
        boxShadow: '0 4px 20px rgba(0,230,138,0.25)',
        position: 'sticky', bottom: 8, zIndex: 10,
      }}>✨ Сгенерировать план питания →</button>

    </>
  );
};

/** MetabolicHub.tsx — единый хаб Метаболики (14 в 1) Pro.
 *  Вода · Шаги · КБЖУ · Жир · StressLoad · Кровь · EA · Алко · Белок · Поиск · NEAT · AT · Thyroid · HOMA — один снапшот, натурал/ААС.
 *  Pro: Cunningham/Owen/TenHaaf + Harris/Henry/Livingston, EMA 14д R2, TEF Westerterp (инфо), MET PAL, Navy+JP/Durnin/BIA, FFMI 26.2 Helms 2023,
 *  Hall density p*9400, IOC EA Mountjoy 2018, Suter, Morton+Schoenfeld pre-sleep, Trexler AT, MATADOR reverse, Levine NEAT, Kim thyroid, Baker sweat.
 *  AAS — experimental (Bhasin/Heber) с дисклеймером, не peer-reviewed.
 *  Evidence A/B/C/E бейджи + DLW band ±12% Westerterp.
 *  Канон — Питание, алиас — Тренировки/Интеллект.
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { calcWater, calcSteps, calcKBJU, calcBodyFat, calcCortisol, calcStressLoad, calcHematology, calcEnergyAvailability, calcAlcohol, calcProteinTiming, calcMaintenanceFinder, calcGoalTimeline, calcAdaptiveThermogenesis, calcReverseDiet, calcNEAT, calcThyroidImpact, calcHomaIRWrap, calcLipid, calcFLIWrap, checkPSMFWrap, calcMenstrualWater, calcFiberSplit, calcLBMPreservation, calcAdaptiveTDEE, calcSweatTest, calcRedsScreening, calcTyG, calcMetSWrapper, calcFIB4, calcAPRI, calcQUICKI, calcWHtR, calcABSI, calcBAI, calcCaffeineCurve, buildDietBreakPlan, calcRefeedNeed, calcWHtRWrapper, calcABSIWrapper, buildMetHours, AAS_EXPERIMENTAL_NOTE, type MetabolicInput } from '../../../engines/metabolic-hub.engine';
import { MET_CATALOG } from '../../../core/metabolic-constants';
import { getProfile } from '../../../core/profile-manager';
import { getNutritionV2Data } from '../../../core/nutrition-v2-data';
import { readDiaryV2, onDiaryChangeV2 } from '../NutritionScreen_parts/diary-storage-v2';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio } from '../../../engines/pro/training-load.engine';
import { PopupNumber, PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import { ModernHero } from '../NutritionScreen_parts/nutrition-modern-kit';

const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.42)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', transition:'all 0.18s ease' } as any;
const CARD: React.CSSProperties = { ...GLASS, borderRadius: 14, padding: 12, marginBottom: 10, transition:'all 0.18s ease' } as any;

type Mode = 'water'|'steps'|'kbju'|'fat'|'cortisol'|'hematology'|'ea'|'alcohol'|'protein'|'maintenance'|'neat'|'at'|'thyroid'|'sweat'|'mets'|'break';
const MODE_DEFS: Array<{m:Mode; label:string; icon:string; desc:string; accent:string; hint:string; evidence:string}> = [
  {m:'water', label:'Вода', icon:'💧', desc:'Суточная норма', accent:'#38bdf8', hint:'IOM 35/33/30 + Baker Na/Cl/K/Mg', evidence:'A (EFSA/IOM) + B (Baker)'},
  {m:'steps', label:'Шаги', icon:'👟', desc:'Бытовая активность', accent:'#22c55e', hint:'FAO PAL 1.40-1.95 + MET → TDEE DLW ±12%', evidence:'B (FAO/Levine) + C (DLW)'},
  {m:'kbju', label:'КБЖУ', icon:'🍽', desc:'Калории и макро', accent:'#f59e0b', hint:'Helms/ISSN + TEF инфо + лютеин + thyroid', evidence:'A (Helms/ISSN) B (Westerterp)'},
  {m:'fat', label:'Жир', icon:'🧬', desc:'% жира, FFMI', accent:'#a78bfa', hint:'Navy/JP/Durnin/BIA + FFMI 26.2 Helms', evidence:'B (Hodgdon/JP)'},
  {m:'cortisol', label:'Stress', icon:'🧠', desc:'Stress Load', accent:'#f43f5e', hint:'Screening SLI 0-100 (не кортизол)', evidence:'E (эвристика) ⚠️'},
  {m:'hematology', label:'Кровь', icon:'🩸', desc:'Гематокрит', accent:'#ef4444', hint:'ESC 48/51/54 + донация', evidence:'B (ESC/ASA)'},
  {m:'ea', label:'EA', icon:'🔋', desc:'Energy Avail.', accent:'#06b6d4', hint:'IOC RED-S: (EI-EEE)/FFM net', evidence:'A (Loucks/Mountjoy)'},
  {m:'alcohol', label:'Алко', icon:'🍺', desc:'Этанол', accent:'#f97316', hint:'Suter 15% TEF + блок illustration', evidence:'C (Suter)'},
  {m:'protein', label:'Белок', icon:'🥚', desc:'Leucine timing', accent:'#84cc16', hint:'Morton 0.40г/кг + pre-sleep 35г', evidence:'A (Morton/Res)'},
  {m:'maintenance', label:'Поиск', icon:'🎯', desc:'TDEE finder', accent:'#eab308', hint:'Hall density + AT Trexler → TDEE', evidence:'A (Hall) B (Trexler)'},
  {m:'neat', label:'NEAT', icon:'🪑', desc:'NEAT Levine', accent:'#14b8a6', hint:'Levine 2002: стоя/fidget/ходьба', evidence:'B (Levine)'},
  {m:'at', label:'AT', icon:'🔥', desc:'Адаптация', accent:'#f97316', hint:'Trexler AT + MATADOR reverse', evidence:'B (Trexler/Byrne)'},
  {m:'thyroid', label:'Щит', icon:'🦋', desc:'Thyroid/HOMA', accent:'#8b5cf6', hint:'Kim FT4 + HOMA-IR Wallace', evidence:'B (Kim/Wallace)'},
  {m:'sweat', label:'Пот', icon:'💦', desc:'Пот-тест', accent:'#06b6d4', hint:'Baker sweat rate + электролиты + бутылки', evidence:'B (Baker/ACSM)'},
  {m:'mets', label:'MetS', icon:'🧪', desc:'Метабол. синдром', accent:'#f43f5e', hint:'TyG + MetS ATP3 + FIB-4 + QUICKI', evidence:'B (Bedogni)'},
  {m:'break', label:'Break', icon:'🔄', desc:'Diet break', accent:'#8b5cf6', hint:'MATADOR + refeed', evidence:'B (Byrne/Trexler)'},
];

const SNAP_KEY = 'he_metabolic_snapshot_v5';
const SNAP_KEY_LEGACY = 'he_metabolic_snapshot_v4';
const SNAP_KEY_V2 = 'he_metabolic_snapshot_v3';
const SCENARIOS_KEY = 'he_metabolic_scenarios_v1';

function Bar({v, max, color, label}:{v:number; max:number; color:string; label?:string}){
  const pct = Math.max(4, Math.min(100, Math.round(v/max*100)));
  return (<div style={{ flex:1 }}>
    {label && <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', marginBottom:3, textTransform:'uppercase', letterSpacing:0.3 }}>{label}</div>}
    <div style={{ height:10, borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden' }}>
      <div style={{ width:`${pct}%`, height:'100%', background: color, borderRadius:20, transition:'width 0.35s ease' }} />
    </div>
  </div>);
}

export const MetabolicHub: React.FC = () => {
  const [mode, setMode] = useState<Mode>('water');
  const [onAAS, setOnAAS] = useState(false);
  const [aasDose, setAasDose] = useState(500);
  const [sex, setSex] = useState<'male'|'female'>('male');
  const [weight, setWeight] = useState(83);
  const [height, setHeight] = useState(180);
  const [age, setAge] = useState(30);
  const [bodyFat, setBodyFat] = useState(15);
  const [neck, setNeck] = useState(39);
  const [waist, setWaist] = useState(84);
  const [hip, setHip] = useState(96);
  const [steps, setSteps] = useState(7000);
  const [cardioMin, setCardioMin] = useState(90);
  const [trainingDays, setTrainingDays] = useState(4);
  const [activityLevel, setActivityLevel] = useState<'low'|'medium'|'high'>('medium');
  const [goal, setGoal] = useState<'cut'|'maintain'|'bulk'|'health'>('maintain');
  const [stress, setStress] = useState(5);
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [climate, setClimate] = useState<'temperate'|'hot'|'cold'>('temperate');
  const [humidity, setHumidity] = useState(55);
  const [standingHours, setStandingHours] = useState(2);
  const [fidgetLevel, setFidgetLevel] = useState<1|2|3>(2);
  const [sweatRate, setSweatRate] = useState(600);
  const [sweatSodium, setSweatSodium] = useState(900);
  const [alcoholG, setAlcoholG] = useState(0);
  const [caffeineMg, setCaffeineMg] = useState(150);
  const [fiberG, setFiberG] = useState<number|undefined>(undefined);
  const [omega3G, setOmega3G] = useState<number|undefined>(undefined);
  const [sfaG, setSfaG] = useState<number|undefined>(undefined);
  const [tgMgDl2, setTgMgDl2] = useState<number|undefined>(undefined);
  const [ggt, setGgt] = useState<number|undefined>(undefined);
  const [targetWeight, setTargetWeight] = useState<number|undefined>(undefined);
  const [weeksToGoal, setWeeksToGoal] = useState<number|undefined>(undefined);
  const [menstrualPhase, setMenstrualPhase] = useState<'follicular'|'luteal'|'none'>('none');
  const [tsh, setTsh] = useState<number|undefined>(undefined);
  const [ft4, setFt4] = useState<number|undefined>(undefined);
  const [glucoseMgDl, setGlucoseMgDl] = useState<number|undefined>(undefined);
  const [insulinMuMl, setInsulinMuMl] = useState<number|undefined>(undefined);
  const [skinfoldSum3, setSkinfoldSum3] = useState<number|undefined>(undefined);
  const [skinfoldSum4, setSkinfoldSum4] = useState<number|undefined>(undefined);
  const [biaResistance, setBiaResistance] = useState<number|undefined>(undefined);
  const [isPlantHeavy, setIsPlantHeavy] = useState(false);
  const [deficitKcal, setDeficitKcal] = useState<number|undefined>(undefined);
  const [weeksInDeficit, setWeeksInDeficit] = useState<number|undefined>(undefined);
  const [weightLostKg, setWeightLostKg] = useState<number|undefined>(undefined);
  const [creatineUse, setCreatineUse] = useState(false);
  const [weeklyVolumeTons, setWeeklyVolumeTons] = useState<number|undefined>(undefined);
  const [hct, setHct] = useState<number|undefined>(undefined);
  const [hgb, setHgb] = useState<number|undefined>(undefined);
  const [ferritin, setFerritin] = useState<number|undefined>(undefined);
  const [gfr, setGfr] = useState<number|undefined>(undefined);
  const [waterL, setWaterL] = useState(2.5);
  const [sodiumG, setSodiumG] = useState(3.5);
  const [potassiumG, setPotassiumG] = useState(3.0);
  // P0-2 MET
  const [metHoursPerWeek, setMetHoursPerWeek] = useState<number|undefined>(undefined);
  // P0-3 RED-S
  const [leafScore, setLeafScore] = useState<number|undefined>(undefined);
  const [measuredRMR, setMeasuredRMR] = useState<number|undefined>(undefined);
  const [boneFlag, setBoneFlag] = useState(false);
  const [menstrualFlag, setMenstrualFlag] = useState(false);
  // P1-1 sweat lab
  const [preKg, setPreKg] = useState(83);
  const [postKg, setPostKg] = useState(82.2);
  const [fluidL, setFluidL] = useState(0.5);
  const [sweatHours, setSweatHours] = useState(1);
  // P1-3 metabolic health extra
  const [hdlMgDl, setHdlMgDl] = useState<number|undefined>(undefined);
  const [systolic, setSystolic] = useState<number|undefined>(undefined);
  const [diastolic, setDiastolic] = useState<number|undefined>(undefined);
  const [ast, setAst] = useState<number|undefined>(undefined);
  const [alt, setAlt] = useState<number|undefined>(undefined);
  const [plt, setPlt] = useState<number|undefined>(undefined);
  const [caffeineHoursSince, setCaffeineHoursSince] = useState(2);
  const [hctHistory, setHctHistory] = useState<Array<{date:string;hct:number}>>([]);
  const [donationLog, setDonationLog] = useState<Array<{date:string;hct:number}>>([]);
  const [weightHistory, setWeightHistory] = useState<{date:string;kg:number}[]>([]);
  const [diaryAvgKcal, setDiaryAvgKcal] = useState<number|undefined>(undefined);
  const [diaryDays, setDiaryDays] = useState(0);
  const [toast, setToast] = useState<string|null>(null);
  const showToast = useCallback((m:string)=>{ setToast(m); setTimeout(()=> setToast(null), 2400); }, []);

  // ACWR live — слушаем srpe-store + polling
  const [acwr, setAcwr] = useState(1);
  const refreshAcwr = useCallback(()=>{
    try{ const s=loadSRPESessions(); const r = s.length>=2 ? acuteChronicRatio(toDailyLoads(s as any)).ratio : 1; setAcwr(r); }catch{ setAcwr(1); }
  }, []);
  useEffect(()=>{
    refreshAcwr();
    const id = setInterval(refreshAcwr, 8000);
    const onStorage = (e: StorageEvent)=>{ if(e.key && e.key.includes('srpe')) refreshAcwr(); };
    const onFocus = ()=> refreshAcwr();
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return ()=>{ clearInterval(id); window.removeEventListener('storage', onStorage); window.removeEventListener('focus', onFocus); };
  }, [refreshAcwr]);

  // weightHistory для адаптивного TDEE — live из nutrition-v2-data
  const refreshWeightHistory = useCallback(()=>{
    try{ const wh = getNutritionV2Data().weightHistory || []; setWeightHistory(wh.slice(-30)); }catch{ setWeightHistory([]); }
  }, []);
  useEffect(()=>{
    refreshWeightHistory();
    const id = setInterval(refreshWeightHistory, 8000);
    const onStorage = (e: StorageEvent)=>{ if(e.key && e.key.includes('he_nutrition_v2')) refreshWeightHistory(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refreshWeightHistory);
    return ()=>{ clearInterval(id); window.removeEventListener('storage', onStorage); window.removeEventListener('focus', refreshWeightHistory); };
  }, [refreshWeightHistory]);

  // diary avg kcal 7д — live из diary-storage-v2
  const refreshDiaryAvg = useCallback(()=>{
    try{
      const data = readDiaryV2();
      const dates = Object.keys(data).sort().slice(-7);
      if(dates.length===0){ setDiaryAvgKcal(undefined); setDiaryDays(0); return; }
      let sum=0, cnt=0;
      for(const d of dates){
        const day=data[d];
        if(!day?.meals) continue;
        let dayKcal=0;
        for(const items of Object.values(day.meals) as any[]) for(const it of items as any[]) dayKcal+= Number(it.kcal)||0;
        if(dayKcal>300){ sum+=dayKcal; cnt++; }
      }
      if(cnt>0){ setDiaryAvgKcal(Math.round(sum/cnt)); setDiaryDays(cnt); } else { setDiaryAvgKcal(undefined); setDiaryDays(0); }
    }catch{ setDiaryAvgKcal(undefined); setDiaryDays(0); }
  }, []);
  useEffect(()=>{
    refreshDiaryAvg();
    const off = onDiaryChangeV2(()=> refreshDiaryAvg());
    const id=setInterval(refreshDiaryAvg, 10000);
    const onStorage=(e:StorageEvent)=>{ if(e.key && e.key.includes('nutrition_diary')) refreshDiaryAvg(); };
    const onFocus=()=> refreshDiaryAvg();
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return ()=>{ off(); clearInterval(id); window.removeEventListener('storage', onStorage); window.removeEventListener('focus', onFocus); };
  }, [refreshDiaryAvg]);

  // HCT history + donation log
  const HCT_HIST_KEY = 'he_hct_history_v1';
  const DONATION_LOG_KEY = 'he_donation_log_v1';
  const loadHctHistory = useCallback(()=>{
    try{
      const raw = localStorage.getItem(HCT_HIST_KEY);
      if(raw){ const arr=JSON.parse(raw); if(Array.isArray(arr)) setHctHistory(arr.slice(-30)); }
      const rawD = localStorage.getItem(DONATION_LOG_KEY);
      if(rawD){ const arr=JSON.parse(rawD); if(Array.isArray(arr)) setDonationLog(arr.slice(-20)); }
    }catch{}
  }, []);
  useEffect(()=>{ loadHctHistory(); const onStorage=(e:StorageEvent)=>{ if(e.key && (e.key.includes('he_hct')||e.key.includes('he_donation'))) loadHctHistory(); }; window.addEventListener('storage', onStorage); window.addEventListener('focus', loadHctHistory); return ()=>{ window.removeEventListener('storage', onStorage); window.removeEventListener('focus', loadHctHistory); }; }, [loadHctHistory]);
  const recordHct = useCallback(()=>{
    if(hct==null || hct<30 || hct>70) { showToast('HCT не задан'); return; }
    const entry={ date: new Date().toISOString().slice(0,10), hct };
    try{
      const raw=localStorage.getItem(HCT_HIST_KEY);
      const arr: any[] = raw ? JSON.parse(raw) : [];
      arr.push(entry);
      const trimmed=arr.slice(-30);
      localStorage.setItem(HCT_HIST_KEY, JSON.stringify(trimmed));
      setHctHistory(trimmed);
      showToast(`HCT ${hct}% записан на ${entry.date}`);
    }catch{ showToast('HCT записан'); }
  }, [hct, showToast]);
  const recordDonation = useCallback(()=>{
    if(hct==null) { showToast('Сначала укажи HCT'); return; }
    const entry={ date: new Date().toISOString().slice(0,10), hct };
    try{
      const raw=localStorage.getItem(DONATION_LOG_KEY);
      const arr: any[] = raw ? JSON.parse(raw) : [];
      arr.push(entry);
      const trimmed=arr.slice(-20);
      localStorage.setItem(DONATION_LOG_KEY, JSON.stringify(trimmed));
      setDonationLog(trimmed);
      // также в HCT историю добавляем точку после донации (прогноз −4%)
      const histRaw=localStorage.getItem(HCT_HIST_KEY);
      const hist: any[] = histRaw ? JSON.parse(histRaw) : [];
      // прогноз через 7 дней: −4% (флеботомия)
      showToast(`Донация ${entry.date} записана (HCT ${hct}% → ожид. ~${Math.max(36, Math.round((hct-4)*10)/10)}% через 7д)`);
    }catch{ showToast('Донация записана'); }
  }, [hct, showToast]);

  // labs + pharma live refresh (HCT/ферритин/GFR + ААС)
  const refreshLabs = useCallback(()=>{
    try{
      const p:any = getProfile()?.settings || {};
      const labs = p.labs?.summary || {};
      const hctLab = labs['HCT'] || labs['Hct'] || labs['hematocrit'];
      if(hctLab?.value && typeof hctLab.value==='number'){ /* не перезатираем ручной ввод если он уже есть, только если undefined */ }
      // live только если пользователь не ввёл руками: обновляем только когда снапшот пустой
      // но для простоты — если в профиле есть значение и локально undefined, заполняем
      const trySet = (setter:(v:any)=>void, cur:any, labVal:any)=>{
        if((cur===undefined || cur===null) && labVal?.value!=null) setter(Number(labVal.value));
      };
      trySet(setHct, hct, hctLab);
      const hgbLab = labs['HGB'] || labs['Hgb'] || labs['hemoglobin'];
      trySet(setHgb, hgb, hgbLab);
      const ferrLab = labs['FERRITIN'] || labs['Ferritin'];
      trySet(setFerritin, ferritin, ferrLab);
      const gfrLab = labs['eGFR'] || labs['GFR'];
      trySet(setGfr, gfr, gfrLab);
      const ph = p.pharma;
      if(Array.isArray(ph?.currentSubstances) && ph.currentSubstances.length>0){
        // если в профиле есть курс, а тумблер выключен — включаем (не наоборот)
        // setOnAAS true only, false оставляем ручному контролю
      }
    }catch{}
  }, [hct,hgb,ferritin,gfr]);
  useEffect(()=>{
    const id=setInterval(refreshLabs, 8000);
    const onStorage=(e:StorageEvent)=>{ if(e.key && (e.key.includes('he_profile')||e.key.includes('he_labs')||e.key.includes('profile'))) refreshLabs(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refreshLabs);
    return ()=>{ clearInterval(id); window.removeEventListener('storage', onStorage); window.removeEventListener('focus', refreshLabs); };
  }, [refreshLabs]);

  // init from snapshot v4 → v3 → v2 → v1 → profile v2 (миграция v4: ft4/HOMA/JP/BIA/AT)
  useEffect(()=>{
    let loaded=false;
    try{
      const raw = localStorage.getItem(SNAP_KEY) || localStorage.getItem(SNAP_KEY_LEGACY) || localStorage.getItem(SNAP_KEY_V2) || localStorage.getItem('he_metabolic_snapshot_v1');
      if(raw){
        const s=JSON.parse(raw);
        if(typeof s.weight==='number') setWeight(s.weight);
        if(typeof s.height==='number') setHeight(s.height);
        if(typeof s.age==='number') setAge(s.age);
        if(s.sex) setSex(s.sex);
        if(typeof s.bodyFat==='number') setBodyFat(s.bodyFat);
        if(typeof s.neck==='number') setNeck(s.neck);
        if(typeof s.waist==='number') setWaist(s.waist);
        if(typeof s.hip==='number') setHip(s.hip);
        if(typeof s.steps==='number') setSteps(s.steps);
        if(typeof s.cardioMin==='number') setCardioMin(s.cardioMin);
        if(typeof s.trainingDays==='number') setTrainingDays(s.trainingDays);
        if(s.activityLevel) setActivityLevel(s.activityLevel);
        if(s.goal) setGoal(s.goal);
        if(typeof s.stress==='number') setStress(s.stress);
        if(typeof s.sleepHours==='number') setSleepHours(s.sleepHours);
        if(typeof s.sleepQuality==='number') setSleepQuality(s.sleepQuality);
        if(typeof s.onAAS==='boolean') setOnAAS(s.onAAS);
        if(typeof s.aasDose==='number') setAasDose(s.aasDose);
        if(s.climate) setClimate(s.climate);
        if(typeof s.humidity==='number') setHumidity(s.humidity);
        if(typeof s.standingHours==='number') setStandingHours(s.standingHours);
        if(typeof s.fidgetLevel==='number') setFidgetLevel(s.fidgetLevel as any);
        if(typeof s.sweatRate==='number') setSweatRate(s.sweatRate);
        if(typeof s.sweatSodium==='number') setSweatSodium(s.sweatSodium);
        if(typeof s.alcoholG==='number') setAlcoholG(s.alcoholG);
        if(typeof s.caffeineMg==='number') setCaffeineMg(s.caffeineMg);
        if(typeof s.tsh==='number') setTsh(s.tsh);
        if(typeof s.ft4==='number') setFt4(s.ft4);
        if(typeof s.glucoseMgDl==='number') setGlucoseMgDl(s.glucoseMgDl);
        if(typeof s.insulinMuMl==='number') setInsulinMuMl(s.insulinMuMl);
        if(typeof s.skinfoldSum3==='number') setSkinfoldSum3(s.skinfoldSum3);
        if(typeof s.skinfoldSum4==='number') setSkinfoldSum4(s.skinfoldSum4);
        if(typeof s.biaResistance==='number') setBiaResistance(s.biaResistance);
        if(typeof s.isPlantHeavy==='boolean') setIsPlantHeavy(s.isPlantHeavy);
        if(typeof s.deficitKcal==='number') setDeficitKcal(s.deficitKcal);
        if(typeof s.weeksInDeficit==='number') setWeeksInDeficit(s.weeksInDeficit);
        if(typeof s.weightLostKg==='number') setWeightLostKg(s.weightLostKg);
        if(typeof s.creatineUse==='boolean') setCreatineUse(s.creatineUse);
        if(typeof s.weeklyVolumeTons==='number') setWeeklyVolumeTons(s.weeklyVolumeTons);
        if(typeof s.targetWeight==='number') setTargetWeight(s.targetWeight);
        if(typeof s.weeksToGoal==='number') setWeeksToGoal(s.weeksToGoal);
        if(s.menstrualPhase) setMenstrualPhase(s.menstrualPhase);
        if(typeof s.sfaG==='number') setSfaG(s.sfaG);
        if(typeof s.tgMgDl2==='number') setTgMgDl2(s.tgMgDl2);
        if(typeof s.ggt==='number') setGgt(s.ggt);
        if(typeof s.hct==='number') setHct(s.hct);
        if(typeof s.hgb==='number') setHgb(s.hgb);
        if(typeof s.ferritin==='number') setFerritin(s.ferritin);
        if(typeof s.gfr==='number') setGfr(s.gfr);
        if(typeof s.waterL==='number') setWaterL(s.waterL);
        if(typeof s.sodiumG==='number') setSodiumG(s.sodiumG);
        if(typeof s.potassiumG==='number') setPotassiumG(s.potassiumG);
        if(typeof s.metHoursPerWeek==='number') setMetHoursPerWeek(s.metHoursPerWeek);
        if(typeof s.leafScore==='number') setLeafScore(s.leafScore);
        if(typeof s.measuredRMR==='number') setMeasuredRMR(s.measuredRMR);
        if(typeof s.boneFlag==='boolean') setBoneFlag(s.boneFlag);
        if(typeof s.menstrualFlag==='boolean') setMenstrualFlag(s.menstrualFlag);
        if(typeof s.preKg==='number') setPreKg(s.preKg);
        if(typeof s.postKg==='number') setPostKg(s.postKg);
        if(typeof s.fluidL==='number') setFluidL(s.fluidL);
        if(typeof s.sweatHours==='number') setSweatHours(s.sweatHours);
        if(typeof s.hdlMgDl==='number') setHdlMgDl(s.hdlMgDl);
        if(typeof s.systolic==='number') setSystolic(s.systolic);
        if(typeof s.diastolic==='number') setDiastolic(s.diastolic);
        if(typeof s.ast==='number') setAst(s.ast);
        if(typeof s.alt==='number') setAlt(s.alt);
        if(typeof s.plt==='number') setPlt(s.plt);
        if(typeof s.caffeineHoursSince==='number') setCaffeineHoursSince(s.caffeineHoursSince);
        loaded=true;
      }
    }catch{}
    if(loaded) return;
    try{
      const p:any = getProfile()?.settings || {};
      const pers = p.personal || {};
      const life = p.lifestyle || {};
      const train = p.training || {};
      const labs = p.labs?.summary || {};
      const pharma = p.pharma || {};
      if(pers.weight) setWeight(Number(pers.weight));
      if(pers.height) setHeight(Number(pers.height));
      if(pers.age) setAge(Number(pers.age));
      if(pers.sex) setSex(pers.sex==='female'?'female':'male');
      if(pers.bodyFat) setBodyFat(Number(pers.bodyFat));
      if(pers.neckCm) setNeck(Number(pers.neckCm));
      if(pers.waistCm) setWaist(Number(pers.waistCm));
      if(pers.hipCm) setHip(Number(pers.hipCm));
      if(life.dailySteps) setSteps(Number(life.dailySteps));
      if(life.activityLevel) {
        const al = Number(life.activityLevel);
        setActivityLevel(al>=7?'high': al>=4?'medium':'low');
      }
      if(train.daysPerWeek) setTrainingDays(Number(train.daysPerWeek));
      if(typeof life.sleepHours==='number') setSleepHours(Number(life.sleepHours));
      if(typeof life.stressLevel==='number') setStress(Math.round(Number(life.stressLevel)));
      const sleepQMap:Record<string,number>={good:4, fair:3, poor:2};
      if(life.sleepQuality && sleepQMap[life.sleepQuality]) setSleepQuality(sleepQMap[life.sleepQuality]);
      if(typeof life.caffeineMg==='number') setCaffeineMg(Number(life.caffeineMg));
      if(typeof life.alcoholG==='number') setAlcoholG(Number(life.alcoholG));
      if(pers.menstrualPhase) setMenstrualPhase(pers.menstrualPhase);
      const hctLab = labs['HCT'] || labs['Hct'] || labs['hematocrit'] || labs['Гематокрит'];
      if(hctLab?.value) setHct(Number(hctLab.value));
      const hgbLab = labs['HGB'] || labs['Hgb'] || labs['hemoglobin'];
      if(hgbLab?.value) setHgb(Number(hgbLab.value));
      const ferrLab = labs['FERRITIN'] || labs['Ferritin'] || labs['ферритин'];
      if(ferrLab?.value) setFerritin(Number(ferrLab.value));
      const gfrLab = labs['eGFR'] || labs['GFR'] || labs['gfr'];
      if(gfrLab?.value) setGfr(Number(gfrLab.value));
      const tshLab = labs['TSH'] || labs['tsh'];
      if(tshLab?.value) setTsh(Number(tshLab.value));
      if(typeof life.dailyWaterLiters==='number') setWaterL(Number(life.dailyWaterLiters));
      if(typeof p.nutrition?.sodiumG==='number') setSodiumG(Number(p.nutrition.sodiumG));
      if(typeof p.nutrition?.potassiumG==='number') setPotassiumG(Number(p.nutrition.potassiumG));
      if(typeof p.goals?.targetWeight==='number') setTargetWeight(Number(p.goals.targetWeight));
      if(Array.isArray(pharma.currentSubstances) && pharma.currentSubstances.length>0){
        setOnAAS(true);
        const sumDose = pharma.currentSubstances.reduce((s:any,sub:any)=> s + (Number(sub.doseMg)||Number(sub.doseValue)||0),0);
        if(sumDose>0) setAasDose(Math.min(3000, Math.round(sumDose)));
      }
    }catch{}
  },[]);
  useEffect(()=>{
    try{ localStorage.setItem(SNAP_KEY, JSON.stringify({weight,height,age,sex,bodyFat,neck,waist,hip,steps,cardioMin,trainingDays,activityLevel,goal,stress,sleepHours,sleepQuality,onAAS,aasDose,climate,humidity,standingHours,fidgetLevel,sweatRate,sweatSodium,alcoholG,caffeineMg,tsh,ft4,glucoseMgDl,insulinMuMl,skinfoldSum3,skinfoldSum4,biaResistance,isPlantHeavy,deficitKcal,weeksInDeficit,weightLostKg,creatineUse,weeklyVolumeTons,targetWeight,weeksToGoal,menstrualPhase,sfaG,tgMgDl2,ggt,hct,hgb,ferritin,gfr,waterL,sodiumG,potassiumG,metHoursPerWeek,leafScore,measuredRMR,boneFlag,menstrualFlag,preKg,postKg,fluidL,sweatHours,hdlMgDl,systolic,diastolic,ast,alt,plt,caffeineHoursSince})); }catch{}
  }, [weight,height,age,sex,bodyFat,neck,waist,hip,steps,cardioMin,trainingDays,activityLevel,goal,stress,sleepHours,sleepQuality,onAAS,aasDose,climate,humidity,standingHours,fidgetLevel,sweatRate,sweatSodium,alcoholG,caffeineMg,tsh,ft4,glucoseMgDl,insulinMuMl,skinfoldSum3,skinfoldSum4,biaResistance,isPlantHeavy,deficitKcal,weeksInDeficit,weightLostKg,creatineUse,weeklyVolumeTons,targetWeight,weeksToGoal,menstrualPhase,sfaG,tgMgDl2,ggt,hct,hgb,ferritin,gfr,waterL,sodiumG,potassiumG,metHoursPerWeek,leafScore,measuredRMR,boneFlag,menstrualFlag,preKg,postKg,fluidL,sweatHours,hdlMgDl,systolic,diastolic,ast,alt,plt,caffeineHoursSince]);

  const input: MetabolicInput = useMemo(()=> ({ weight,height,age,sex,bodyFat,neck,waist,hip,steps,cardioMin,trainingDays,trainingHours: trainingDays*1.15, activityLevel: activityLevel as any, goal, onAAS, aasDose, stress, sleepHours, sleepQuality, acwr, climate, humidity, standingHours, fidgetLevel, sweatRate, sweatSodiumMgPerL: sweatSodium, weightHistory: weightHistory.length>=3 ? weightHistory : undefined, hct, hgb, ferritin, gfr, waterL, ironIntakeMg: undefined, alcoholG, caffeineMg, tsh, ft4, creatineUse, weeklyVolumeTons, menstrualPhase, targetWeight, fiberG, omega3G, skinfoldSum3, skinfoldSum4, biaResistanceOhm: biaResistance, glucoseMgDl, insulinMuMl, deficitKcal, weeksInDeficit, metHoursPerWeek, measuredRMR, leafScore, boneFlag, menstrualFlag, hdlMgDl, systolic, diastolic, ast, alt, plt, caffeineHoursSince }), [weight,height,age,sex,bodyFat,neck,waist,hip,steps,cardioMin,trainingDays,activityLevel,goal,onAAS,aasDose,stress,sleepHours,sleepQuality,acwr,climate,humidity,standingHours,fidgetLevel,sweatRate,sweatSodium,weightHistory,hct,hgb,ferritin,gfr,waterL,alcoholG,caffeineMg,tsh,ft4,glucoseMgDl,insulinMuMl,skinfoldSum3,skinfoldSum4,biaResistance,deficitKcal,weeksInDeficit,creatineUse,weeklyVolumeTons,menstrualPhase,targetWeight,fiberG,omega3G,metHoursPerWeek,measuredRMR,leafScore,boneFlag,menstrualFlag,hdlMgDl,systolic,diastolic,ast,alt,plt,caffeineHoursSince]);

  const water = useMemo(()=> calcWater(input), [input]);
  const stepsCalc = useMemo(()=> calcSteps(input), [input]);
  const kbju = useMemo(()=> calcKBJU(input), [input]);
  const fat = useMemo(()=> calcBodyFat(input), [input]);
  const cortisol = useMemo(()=> calcStressLoad(input), [input]);
  const neat = useMemo(()=> calcNEAT({ weight, standingHours, fidgetLevel, steps, height }), [weight, standingHours, fidgetLevel, steps, height]);
  const at = useMemo(()=> calcAdaptiveThermogenesis({ weight, height, age, sex, bodyFat, deficitKcal, weeksInDeficit, weightLostKg }), [weight,height,age,sex,bodyFat,deficitKcal,weeksInDeficit,weightLostKg]);
  const reverseDiet = useMemo(()=> {
    const curKcal = diaryAvgKcal ?? kbju.nat.kcal;
    const targetKcal = kbju.nat.tdee || curKcal + 400;
    return calcReverseDiet(curKcal, targetKcal);
  }, [diaryAvgKcal, kbju]);
  const thyroid = useMemo(()=> calcThyroidImpact(ft4, tsh), [ft4,tsh]);
  const homa = useMemo(()=> calcHomaIRWrap(glucoseMgDl, insulinMuMl), [glucoseMgDl, insulinMuMl]);
  const lipid = useMemo(()=> calcLipid(sfaG, fiberG, undefined), [sfaG, fiberG]);
  const fli = useMemo(()=> {
    const bmi = weight / (((height||180)/100)**2);
    return calcFLIWrap({ bmi, waistCm: waist||84, tgMgDl: tgMgDl2, ggt });
  }, [weight, height, waist, tgMgDl2, ggt]);
  const fiberSplit = useMemo(()=> calcFiberSplit(kbju.fiber.nat), [kbju]);
  const hematology = useMemo(()=>{
    let proteinPerKg: number|undefined; let fiberGV: number|undefined; let omega3GV: number|undefined;
    try{
      const p:any=getProfile()?.settings||{};
      proteinPerKg = p.nutrition?.proteinPerKg;
      fiberGV = fiberG ?? p.nutrition?.fiberG;
      omega3GV = omega3G ?? p.nutrition?.omega3G;
    }catch{}
    if(proteinPerKg==null) proteinPerKg = kbju?.nat?.protPerKg;
    if(fiberGV==null) fiberGV = kbju?.fiber?.nat;
    return calcHematology({ weight, hct, hgb, ferritin, gfr, waterL, sodiumG, potassiumG, proteinPerKg, fiberG: fiberGV, omega3G: omega3GV, ironIntakeMg: undefined, onAAS, aasDose, sex });
  }, [weight,hct,hgb,ferritin,gfr,waterL,sodiumG,potassiumG,onAAS,aasDose,sex, kbju, fiberG, omega3G]);
  const ea = useMemo(()=>{
    const intake = diaryAvgKcal ?? kbju.nat.kcal;
    // tons*420 gross → calcEnergyAvailability сделает ×0.85 net (Loucks), синхронизировано с hall
    const eee = weeklyVolumeTons ? Math.round(weeklyVolumeTons* 380) : (trainingDays* 320 + cardioMin*7);
    return calcEnergyAvailability({ weight, bodyFat, height: height||180, heightCm: height, lean: kbju.nat.lean, intakeKcal: intake, eeeKcal: eee, trainingDays, sex } as any);
  }, [weight,bodyFat,height,kbju,trainingDays,weeklyVolumeTons,cardioMin, diaryAvgKcal, sex]);
  const lbmPres = useMemo(()=> calcLBMPreservation({ proteinGPerKg: kbju.nat.protPerKg, deficitKcal: kbju.nat.tdee - kbju.nat.kcal >0 ? kbju.nat.tdee - kbju.nat.kcal : 0, trainingDays, ea: ea?.ea }), [kbju, trainingDays, ea]);
  const psmf = useMemo(()=> checkPSMFWrap(ea.ea), [ea.ea]);
  const menstrual = useMemo(()=> calcMenstrualWater(menstrualPhase), [menstrualPhase]);
  const alcohol = useMemo(()=> calcAlcohol(alcoholG, weight), [alcoholG, weight]);
  const proteinTiming = useMemo(()=> calcProteinTiming(onAAS? kbju.aas.p: kbju.nat.p, weight, 4, isPlantHeavy), [kbju, weight, onAAS, isPlantHeavy]);
  const maintenance = useMemo(()=>{
    const avgKcal = diaryAvgKcal ?? kbju.nat.kcal;
    return calcMaintenanceFinder(weightHistory, avgKcal, bodyFat);
  }, [weightHistory, kbju, diaryAvgKcal, bodyFat]);
  const goalTimeline = useMemo(()=> targetWeight ? calcGoalTimeline({ weight, targetWeight, tdee: kbju.nat.tdee, bodyFat }) : null, [weight,targetWeight,kbju,bodyFat]);
  const adaptiveTDEE = useMemo(()=>{
    if(!weightHistory || weightHistory.length<7 || !diaryAvgKcal) return null;
    return calcAdaptiveTDEE({ weightHistory, avgIntakeKcal: diaryAvgKcal, bodyFatPct: bodyFat, goal });
  }, [weightHistory, diaryAvgKcal, bodyFat, goal]);
  const sweatTest = useMemo(()=> calcSweatTest({ preKg, postKg, fluidL, hours: sweatHours, sodiumMgPerL: sweatSodium, weightKg: weight }), [preKg, postKg, fluidL, sweatHours, sweatSodium, weight]);
  const redsScreening = useMemo(()=>{
    const rmrRatio = measuredRMR && kbju.nat.bmr ? measuredRMR/kbju.nat.bmr : undefined;
    return calcRedsScreening({ ea: ea?.ea ?? null, sex, leafScore, rmrRatio, boneFlag, menstrualFlag });
  }, [ea, sex, leafScore, measuredRMR, kbju, boneFlag, menstrualFlag]);
  const whtr = useMemo(()=> calcWHtR(waist, height), [waist, height]);
  const absi = useMemo(()=> calcABSI(waist, height, weight), [waist, height, weight]);
  const bai = useMemo(()=> hip ? calcBAI(hip, height) : null, [hip, height]);
  const tyg = useMemo(()=> calcTyG(tgMgDl2, glucoseMgDl), [tgMgDl2, glucoseMgDl]);
  const mets = useMemo(()=> calcMetSWrapper({ waistCm: waist, tgMgDl: tgMgDl2, hdlMgDl, systolic, diastolic, glucoseMgDl, sex }), [waist, tgMgDl2, hdlMgDl, systolic, diastolic, glucoseMgDl, sex]);
  const fib4 = useMemo(()=> calcFIB4(age, ast, alt, plt), [age, ast, alt, plt]);
  const apri = useMemo(()=> calcAPRI(ast, plt), [ast, plt]);
  const quicki = useMemo(()=> calcQUICKI(glucoseMgDl, insulinMuMl), [glucoseMgDl, insulinMuMl]);
  const caffeineCurve = useMemo(()=> calcCaffeineCurve(caffeineMg, caffeineHoursSince, weight), [caffeineMg, caffeineHoursSince, weight]);
  const dietBreakPlan = useMemo(()=> {
    if(!targetWeight || !goalTimeline) return null;
    const weeksTotal = Math.max(4, goalTimeline.days/7);
    return buildDietBreakPlan(Math.ceil(weeksTotal), Math.ceil(weeksTotal*0.75));
  }, [targetWeight, goalTimeline]);
  const refeedNeed = useMemo(()=> calcRefeedNeed(weeksInDeficit ?? 0, bodyFat, ea?.ea ?? null), [weeksInDeficit, bodyFat, ea]);
  const oneAnswer = useMemo(()=>{
    const tdee = adaptiveTDEE?.tdee ?? stepsCalc.tdeeNat;
    const low = Math.round(tdee*0.88), high=Math.round(tdee*1.12);
    return { tdee, low, high, water: onAAS? water.aas:water.nat, ea: ea?.ea, eaZone: ea?.zone, metsScore: mets.score };
  }, [adaptiveTDEE, stepsCalc, water, onAAS, ea, mets]);

  // сценарии
  const [scenarios, setScenarios] = useState<Array<{id:string; name:string; snapshot:any}>>(()=>{
    try{ const raw=localStorage.getItem(SCENARIOS_KEY); return raw? JSON.parse(raw):[] }catch{ return [] }
  });
  const saveScenario = useCallback(()=>{
    const name = `Сценарий ${scenarios.length+1} · ${new Date().toLocaleDateString('ru-RU')} · ${weight}кг ${goal}`;
    const snap = { weight,height,age,sex,bodyFat,activityLevel,trainingDays,cardioMin,goal,onAAS,aasDose };
    const next=[...scenarios, {id: Date.now().toString(), name, snapshot: snap}].slice(-6);
    setScenarios(next); try{ localStorage.setItem(SCENARIOS_KEY, JSON.stringify(next)); }catch{}; showToast(`Сценарий "${name}" сохранён`);
  }, [scenarios, weight,height,age,sex,bodyFat,activityLevel,trainingDays,cardioMin,goal,onAAS,aasDose, showToast]);
  const loadScenario = useCallback((id:string)=>{
    const sc=scenarios.find(s=>s.id===id); if(!sc) return;
    const s=sc.snapshot;
    if(typeof s.weight==='number') setWeight(s.weight);
    if(typeof s.height==='number') setHeight(s.height);
    if(s.sex) setSex(s.sex);
    if(typeof s.bodyFat==='number') setBodyFat(s.bodyFat);
    if(s.activityLevel) setActivityLevel(s.activityLevel);
    if(typeof s.trainingDays==='number') setTrainingDays(s.trainingDays);
    if(typeof s.cardioMin==='number') setCardioMin(s.cardioMin);
    if(s.goal) setGoal(s.goal);
    if(typeof s.onAAS==='boolean') setOnAAS(s.onAAS);
    if(typeof s.aasDose==='number') setAasDose(s.aasDose);
    showToast(`Сценарий "${sc.name}" загружен`);
  }, [scenarios, showToast]);
  const deleteScenario = useCallback((id:string)=>{
    const next=scenarios.filter(s=>s.id!==id); setScenarios(next); try{ localStorage.setItem(SCENARIOS_KEY, JSON.stringify(next)); }catch{}
  }, [scenarios]);

  const active = MODE_DEFS.find(d=> d.m===mode)!;
  const waistErr = waist && neck && waist <= neck ? 'Талия ≤ шеи — Navy невалиден' : null;
  const hipWarn = sex==='female' && (!hip || hip<80) ? 'Для женщин нужен обхват бёдер' : null;

  const applyKBJU = ()=>{
    try{
      const tgt = onAAS ? kbju.aas : kbju.nat;
      const payload = { kcal: tgt.kcal, p: tgt.p, f: tgt.f, c: tgt.c, protPerKg: tgt.protPerKg, pal: tgt.pal, bmr: tgt.bmr, ts: Date.now(), source: 'metabolic-hub' };
      localStorage.setItem('he_planner_kbju_suggestion', JSON.stringify(payload));
      // также в профиль nutrition.manualTargets для автоподхвата (если ручной режим)
      try{
        const p = getProfile();
        const curNut:any = p.settings?.nutrition || {};
        // не перезаписываем без спроса, только подсказка
        localStorage.setItem('he_metabolic_last_kbju', JSON.stringify(payload));
        void curNut;
      }catch{}
      window.dispatchEvent(new CustomEvent('he-kbju-suggestion', { detail: payload }));
      const txt = `КБЖУ ${tgt.kcal}ккал Б${tgt.p} Ж${tgt.f} У${tgt.c} → скопировано. Вставь в Планировщике (КБЖУ → Ручной).`;
      if(navigator.clipboard) navigator.clipboard.writeText(`${tgt.kcal} ${tgt.p} ${tgt.f} ${tgt.c}`).catch(()=>{});
      showToast(txt);
    }catch{ showToast('Сохранено в he_planner_kbju_suggestion'); }
  };

  return (
    <div style={{ padding:'10px 8px 18px', color:'#fff', maxWidth:780, margin:'0 auto' }}>
      {toast && <div style={{ position:'fixed', left:'50%', bottom:18, transform:'translateX(-50%)', zIndex:60, maxWidth:520, padding:'10px 14px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.10)', boxShadow:'0 8px 24px rgba(0,0,0,0.35)', fontSize:11, fontWeight:600, color:'#fff', textAlign:'center' }}>{toast}</div>}
      <ModernHero icon="⚖️" title="Метаболика Pro" subtitle="17 в 1 · TDEE Adaptive v2 · MET-часы · KBJU · Navy/JP/BIA · StressLoad · HCT · EA RED-S CAT2 · Пот-тест · MetS/TyG/FIB-4 · NEAT · AT MATADOR · Evidence A/B/C/E · DLW ±12%" />
      <div style={{ ...CARD, padding:'14px 14px 12px', background:'linear-gradient(135deg,rgba(96,165,250,0.10),rgba(0,230,138,0.07))', border:'1px solid rgba(96,165,250,0.18)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-18, right:-18, width:110, height:110, borderRadius:110, background:'radial-gradient(circle,rgba(96,165,250,0.14),transparent 70%)', pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <div style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#60a5fa,#00e68a)', color:'#000', fontWeight:900, fontSize:16 }}>⚖️</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:900, color:'#fff', lineHeight:1 }}>Метаболика Pro — 17 калькуляторов</div>
            <div style={{ fontSize:10, color:'#fff', lineHeight:1.3 }}>IOM + Baker · FAO PAL MET-часы · 7 BMR · Navy/JP/BIA · FFMI 26.2 · SLI · Hall adaptive v2 · Levine · Trexler MATADOR · RED-S CAT2 · Пот-тест · TyG/FIB-4 · ACWR {acwr.toFixed(2)} · HCT {hematology.hct ?? '—'}% · WHtR {whtr? whtr.toFixed(2):'—'}</div>
          </div>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:20, background: onAAS ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', border: `1px solid ${onAAS ? 'rgba(239,68,68,0.22)' : 'rgba(34,197,94,0.22)'}`, color: onAAS ? '#f87171' : '#22c55e', fontWeight:800, whiteSpace:'nowrap' }}>{onAAS ? `💉 ${aasDose}мг/нед EXP` : '🌿 Натурал'}</span>
        </div>
        <div style={{ fontSize:9, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', lineHeight:1.5 }}>
          <b style={{ color:'#fff' }}>Evidence:</b> <span style={{ color:'#22c55e' }}>A</span> Helms/ISSN/Morton/Loucks/Hall · <span style={{ color:'#38bdf8' }}>B</span> Westerterp/FAO/Hodgdon/JP/Baker/Levine/Trexler · <span style={{ color:'#f59e0b' }}>C</span> Suter · <span style={{ color:'#f43f5e' }}>E</span> SLI/AAS (эвристика) ⚠️ · DLW ±12% (Westerterp) · <span style={{ color:'#f87171' }}>{AAS_EXPERIMENTAL_NOTE}</span>
        </div>
        {onAAS && <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.18)', fontSize:9, color:'#f87171', lineHeight:1.4 }}>⚠️ AAS-модель экспериментальна (Bhasin 600мг → +2кг воды ~3%, не +12%). TDEE точнее через FFM: введи BF% → Cunningham/Katch, не ×%. Белок +0.2-0.5 EXP (Helms — AAS антикатаболик).</div>}
      </div>
      {/* One-answer banner — сводка 1 экраном (P0-4) */}
      <div style={{ ...CARD, padding:'12px 12px 10px', background:'linear-gradient(135deg,rgba(34,197,94,0.10),rgba(56,165,250,0.10))', border:'1px solid rgba(34,197,94,0.18)' }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'rgba(255,255,255,0.65)', marginBottom:6 }}>⚡ Сводка за сегодня — один ответ</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
          <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.55)', textTransform:'uppercase' }}>TDEE (DLW ±12%)</div>
            <div style={{ fontSize:18, fontWeight:900, color:'#22c55e' }}>{oneAnswer.tdee} <span style={{fontSize:10}}>ккал</span></div>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)' }}>{oneAnswer.low}–{oneAnswer.high} · {adaptiveTDEE? `адаптив R²${adaptiveTDEE.r2} ${adaptiveTDEE.confidence}`:'формульный'} · cut {oneAnswer.tdee-500} bulk {oneAnswer.tdee+300}</div>
          </div>
          <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.55)', textTransform:'uppercase' }}>Вода + EA + Кровь</div>
            <div style={{ fontSize:13, fontWeight:800, color:'#38bdf8' }}>{oneAnswer.water}мл · EA {oneAnswer.ea ?? '—'} <span style={{fontSize:9, color: ea?.color || 'rgba(255,255,255,0.35)'}}>{ea?.zoneLabel ?? ''}</span></div>
            <div style={{ fontSize:8, color: hematology.zone==='unknown'?'rgba(255,255,255,0.45)':hematology.color }}>HCT {hematology.hct ?? '—'}% {hematology.zoneLabel} · WHtR {whtr? whtr.toFixed(2):'—'} {whtr && whtr>=0.5?'⚠':''}</div>
          </div>
        </div>
        {adaptiveTDEE && adaptiveTDEE.plateau && <div style={{ marginTop:8, padding:'7px 10px', borderRadius:8, background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.18)', fontSize:9, color:'#fbbf24' }}>⏸ Плато сушки: тренд {adaptiveTDEE.trend}кг/нед — проверь дефицит/шаги · AT {adaptiveTDEE.atKcal}ккал</div>}
        {adaptiveTDEE && <div style={{ marginTop:6, fontSize:8, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'6px 8px' }}>Adaptive TDEE v2: 7/14/21д окна → R² {adaptiveTDEE.r2} дни {adaptiveTDEE.days} плотность {adaptiveTDEE.density} · TDEE без AT {adaptiveTDEE.tdeeNoAT} · {adaptiveTDEE.note}</div>}
      </div>

       {/* Переключатель ААС */}
      <div style={{ ...CARD, border:'1px solid rgba(255,255,255,0.07)', padding:10 }}>
        <div style={{ display:'flex', gap:6, marginBottom: onAAS?8:0 }}>
          <button onClick={()=> setOnAAS(false)} style={{ flex:1, minHeight:36, borderRadius:10, cursor:'pointer', fontSize:11, fontWeight:800, border: !onAAS ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.08)', background: !onAAS ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.02)', color: !onAAS ? '#22c55e' : '#fff' }}>🌿 Без ААС</button>
          <button onClick={()=> setOnAAS(true)} style={{ flex:1, minHeight:36, borderRadius:10, cursor:'pointer', fontSize:11, fontWeight:800, border: onAAS ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)', background: onAAS ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.02)', color: onAAS ? '#f87171' : '#fff' }}>💉 С ААС</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:8, paddingTop:8, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <PopupNumber label="Доза ААС, мг/нед" value={aasDose} min={0} max={3000} onChange={setAasDose} />
          <PopupSelect label="Климат" value={climate} options={[{id:'temperate',label:'Умеренный'},{id:'hot',label:'Жара'},{id:'cold',label:'Холод'}]} onChange={v=> setClimate(v as any)} />
          {climate==='hot' && <PopupNumber label="Влажность, %" value={humidity} min={20} max={95} onChange={setHumidity} />}
          <PopupNumber label="Пот, мл/ч" value={sweatRate} min={300} max={1200} step={50} onChange={setSweatRate} />
          <PopupNumber label="Na в поте, мг/л" value={sweatSodium} min={400} max={1500} step={50} onChange={setSweatSodium} />
          <div style={{ gridColumn:'1 / -1', fontSize:8, color:'rgba(56,165,250,0.75)', background:'rgba(56,165,250,0.06)', border:'1px solid rgba(56,165,250,0.12)', borderRadius:8, padding:'6px 8px' }}>Baker 2017: Na {water.sweatNaG}г · Cl {water.sweatClG}г · K {water.sweatKG}г · Mg {water.sweatMgMg}мг /тренировку · +1-1.5г Na/л пота. IOM {water.iomPerKg}мл/кг → база {water.baseIOM}мл (lean-модель {water.baseLeanModel}мл эксп.)</div>
        </div>
      </div>

      {/* Пресеты + сценарии */}
      <div style={{ ...CARD, padding:10, display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:9, fontWeight:800, color:'rgba(255,255,255,0.55)', textTransform:'uppercase' }}>⚡ Пресеты</span>
          {[
            { label:'Офис 70кг', act:()=>{ setWeight(70); setHeight(175); setAge(30); setActivityLevel('low' as any); setTrainingDays(3); setCardioMin(60); } },
            { label:'Атлет 90кг', act:()=>{ setWeight(90); setHeight(185); setAge(28); setActivityLevel('medium' as any); setTrainingDays(5); setCardioMin(120); setBodyFat(12); } },
            { label:'Тяж 110кг', act:()=>{ setWeight(110); setHeight(190); setAge(32); setActivityLevel('high' as any); setTrainingDays(6); setCardioMin(150); setBodyFat(18); } },
            { label:'Бикини 55кг', act:()=>{ setWeight(55); setHeight(165); setAge(26); setSex('female' as any); setActivityLevel('medium' as any); setTrainingDays(4); setBodyFat(18); } },
          ].map(p=> <button key={p.label} onClick={p.act} style={{ padding:'6px 10px', borderRadius:20, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:9, fontWeight:700, cursor:'pointer' }}>{p.label}</button>)}
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
          <button onClick={saveScenario} style={{ padding:'6px 12px', borderRadius:8, border:'1px solid rgba(96,165,250,0.18)', background:'rgba(96,165,250,0.10)', color:'#60a5fa', fontSize:9, fontWeight:700, cursor:'pointer' }}>💾 Сохранить сценарий</button>
          {scenarios.length>0 && <span style={{ fontSize:8, color:'rgba(255,255,255,0.45)' }}>{scenarios.length}/6</span>}
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {scenarios.map(sc=>(
              <span key={sc.id} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 6px 4px 8px', borderRadius:20, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', fontSize:8, color:'#fff' }}>
                {sc.name}
                <button onClick={()=> loadScenario(sc.id)} style={{ padding:'2px 6px', borderRadius:10, border:'none', background:'#60a5fa', color:'#000', fontSize:8, fontWeight:700, cursor:'pointer' }}>▶</button>
                <button onClick={()=> deleteScenario(sc.id)} style={{ width:18, height:18, borderRadius:10, border:'none', background:'rgba(239,68,68,0.12)', color:'#ef4444', fontSize:8, cursor:'pointer' }}>✕</button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Ввод — группы */}
      <div style={{ ...CARD, border:'1px solid rgba(255,255,255,0.07)', padding:10 }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'rgba(255,255,255,0.55)', marginBottom:8 }}>Антропометрия и цель</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <PopupNumber label="Вес, кг" value={weight} min={30} max={200} onChange={setWeight} />
          <PopupNumber label="Рост, см" value={height} min={140} max={220} onChange={setHeight} />
          <PopupNumber label="Возраст" value={age} min={14} max={80} onChange={setAge} />
          <PopupSelect label="Пол" value={sex} options={[{id:'male',label:'♂ Мужчина'},{id:'female',label:'♀ Женщина'}]} onChange={v=> setSex(v as any)} />
          <PopupNumber label="Жир, % (если знаешь)" value={bodyFat} min={3} max={55} onChange={setBodyFat} />
          <PopupSelect label="Цель" value={goal} options={[{id:'cut',label:'Сушка −18% TDEE'},{id:'maintain',label:'Поддержание'},{id:'bulk',label:'Масса +10%'},{id:'health',label:'🩸 Здоровье (EA)'}]} onChange={v=> setGoal(v as any)} />
          <PopupNumber label="Цель вес, кг" value={targetWeight ?? weight} min={35} max={200} onChange={v=> setTargetWeight(v)} />
          <PopupNumber label="Креатин?" value={creatineUse?1:0} min={0} max={1} onChange={v=> setCreatineUse(v===1)} />
        </div>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginTop:6, lineHeight:1.35 }}>
          BMR: {kbju.nat.method==='cunningham'?'Cunningham': kbju.nat.method==='ten_haaf'?'TenHaaf': kbju.nat.method==='owen'?'Owen': kbju.nat.method==='katch_mcardle'?'Katch-McArdle':'Mifflin'} · {kbju.nat.bmr}ккал · PAL {kbju.nat.pal.toFixed(2)} · TDEE {stepsCalc.tdeeNat} · TEF {kbju.tefNat}ккал
          {goalTimeline && <span> · Цель: {goalTimeline.note} ({goalTimeline.days}д)</span>}
        </div>
        {sex==='female' && (
          <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            <PopupSelect label="Фаза цикла" value={menstrualPhase} options={[{id:'none',label:'—'},{id:'follicular',label:'Фолликулярная'},{id:'luteal',label:'Лютеиновая +250ккал +1кг воды'}]} onChange={v=> setMenstrualPhase(v as any)} />
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', display:'flex', alignItems:'center', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px' }}>{kbju.lutealAdd? `+${kbju.lutealAdd}ккал +1.2кг воды Benton 2021`:'— фолликул'}</div>
          </div>
        )}
      </div>

      <div style={{ ...CARD, border:'1px solid rgba(255,255,255,0.07)', padding:10 }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'rgba(255,255,255,0.55)', marginBottom:8 }}>Активность (NEAT + EAT) — PRO</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <PopupSelect label="Бытовая" value={activityLevel} options={[{id:'low',label:'Низкая (офис)'},{id:'medium',label:'Средняя'},{id:'high',label:'Высокая (на ногах)'}]} onChange={v=> setActivityLevel(v as any)} />
          <PopupNumber label="Тренировок/нед" value={trainingDays} min={0} max={7} onChange={setTrainingDays} />
          <PopupNumber label="Кардио мин/нед" value={cardioMin} min={0} max={600} onChange={setCardioMin} />
          <PopupNumber label="Шаги/сут факт" value={steps} min={0} max={32000} onChange={setSteps} />
          <PopupNumber label="Стоя, ч/сут" value={standingHours} min={0} max={12} step={0.5} onChange={setStandingHours} />
          <PopupSelect label="Fidget" value={String(fidgetLevel)} options={[{id:'1',label:'Низкий'},{id:'2',label:'Средний'},{id:'3',label:'Высокий (+90ккал)'}]} onChange={v=> setFidgetLevel(Number(v) as any)} />
          <PopupNumber label="Тоннаж, т/нед" value={weeklyVolumeTons ?? 0} min={0} max={80} step={1} onChange={v=> setWeeklyVolumeTons(v||undefined)} />
          <PopupNumber label="MET-часы/нед (честно)" value={metHoursPerWeek ?? 0} min={0} max={120} step={1} onChange={v=> setMetHoursPerWeek(v||undefined)} />
        </div>
        <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'6px 8px' }}>
          {metHoursPerWeek ? `MET ${metHoursPerWeek}ч/нед → честный PAL ${stepsCalc.pal.toFixed(2)} (Ainsworth)` : 'Подсказка: 3× силовая 6 MET ×1ч =18 MET-ч/нед → +0.12 PAL. Заполни MET-часы для честного PAL (лучше чем «средняя»). Каталог: strength 6, running 10, cycling 7.5, walking 3.8…'}
        </div>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginTop:6 }}>TDEE {stepsCalc.tdeeNat} → цель {stepsCalc.targetNat}ккал · {stepsCalc.kcalPerStep}ккал/шаг · NEAT {stepsCalc.neat} · EAT {stepsCalc.eat} · ACWR {acwr.toFixed(2)}</div>
        {stepsCalc.adaptive && <div style={{ fontSize:8, color: stepsCalc.adaptive.r2>0.6?'#22c55e': stepsCalc.adaptive.r2>0.35?'#f59e0b':'#f87171' }}>Адаптивный: тренд {stepsCalc.adaptive.trend}кг/нед R2 {stepsCalc.adaptive.r2} · {stepsCalc.adaptive.suggest} → {stepsCalc.adaptive.tdee}ккал</div>}
        {adaptiveTDEE && <div style={{ fontSize:8, color: adaptiveTDEE.confidence==='high'?'#22c55e': adaptiveTDEE.confidence==='medium'?'#f59e0b':'#f87171', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'6px 8px', marginTop:4 }}>Adaptive v2 (7/14/21д): TDEE {adaptiveTDEE.tdee} (без AT {adaptiveTDEE.tdeeNoAT}) · R²{adaptiveTDEE.r2} дни {adaptiveTDEE.days} · {adaptiveTDEE.note}</div>}
      </div>

      <div style={{ ...CARD, border:'1px solid rgba(255,255,255,0.07)', padding:10 }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'rgba(255,255,255,0.55)', marginBottom:8 }}>Замеры для Navy (опционально)</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <PopupNumber label="Шея, см" value={neck} min={28} max={60} onChange={setNeck} />
          <PopupNumber label="Талия, см" value={waist} min={55} max={150} onChange={setWaist} />
          {sex==='female' && <PopupNumber label="Бёдра, см (Ж)" value={hip} min={75} max={145} onChange={setHip} />}
          {sex==='male' && <div style={{ display:'flex', alignItems:'center', padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'rgba(255,255,255,0.55)' }}>Бёдра — только для ♀ формулы</div>}
        </div>
        {(waistErr || hipWarn) && <div style={{ marginTop:8, padding:'7px 10px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', fontSize:10, color:'#fbbf24' }}>{waistErr || hipWarn}</div>}
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginTop:6 }}>{fat.accuracy} · {fat.note}</div>
        {fat.deurenbergWarn && <div style={{ marginTop:6, fontSize:8, color:'#f59e0b', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.12)', borderRadius:8, padding:'6px 8px' }}>{fat.deurenbergWarn}</div>}
        {fat.jp!=null && <div style={{ fontSize:8, color:'#a78bfa', background:'rgba(167,139,250,0.08)', border:'1px solid rgba(167,139,250,0.12)', borderRadius:8, padding:'6px 8px', marginTop:4 }}>JP3 {fat.jp}% · Durnin {fat.durnin ?? '—'}% · BIA {fat.bia ?? '—'}% → {fat.measured}% приоритет калипера</div>}
      </div>

      <div style={{ ...CARD, border:'1px solid rgba(255,255,255,0.07)', padding:10 }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'rgba(255,255,255,0.55)', marginBottom:8 }}>💦 Пот-тест (Baker) — измерь свой пот</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <PopupNumber label="Вес до, кг" value={preKg} min={40} max={150} step={0.1} onChange={setPreKg} />
          <PopupNumber label="Вес после, кг" value={postKg} min={40} max={150} step={0.1} onChange={setPostKg} />
          <PopupNumber label="Выпито, л" value={fluidL} min={0} max={5} step={0.1} onChange={setFluidL} />
          <PopupNumber label="Длительность, ч" value={sweatHours} min={0.3} max={6} step={0.25} onChange={setSweatHours} />
        </div>
        {sweatTest ? (
          <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(6,182,214,0.08)', border:'1px solid rgba(6,182,214,0.18)', fontSize:9, color:'#fff', lineHeight:1.4 }}>
            <b style={{color:'#06b6d4'}}>Пот {sweatTest.rateLPerH.toFixed(2)}л/ч · потеря {sweatTest.totalLossMl}мл за {sweatHours}ч · Na {Math.round(sweatTest.elect.sodiumMg)}мг Cl {sweatTest.elect.chlorideMg} · {sweatTest.plan.note}</b>
            {sweatTest.plan.hyponatremiaRisk && <span style={{ display:'block', color:'#ef4444', marginTop:4 }}>⚠ Гипонатриемия риск (Hew-Butler) — не пей &gt;1л/ч plain water на 4ч+ без Na</span>}
            <span style={{ display:'block', fontSize:8, color:'rgba(255,255,255,0.55)', marginTop:4 }}>Pre {sweatTest.plan.preMl}мл + During {sweatTest.plan.duringMlPerH}мл/ч + Post {sweatTest.plan.postMl}мл · бутылок 0.5л: {sweatTest.plan.bottles05} · Baker 2017 avg Na 900мг/л (200-1800 индивид.)</span>
          </div>
        ) : <div style={{ marginTop:8, fontSize:9, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'7px 10px' }}>Формула: (до − после + выпито)/часы. 1кг =1л пота. Тестируй в условиях гонки.</div>}
        <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:6 }}>Акклиматизация 10-14д: объём +10-20%, Na −40% (Periard).</div>
      </div>

      <div style={{ ...CARD, border:'1px solid rgba(255,255,255,0.07)', padding:10 }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'rgba(255,255,255,0.55)', marginBottom:8 }}>🧪 Метаболический синдром + WHtR/ABSI/BAI (опц.)</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <PopupNumber label="HDL, мг/дл" value={hdlMgDl ?? 50} min={20} max={120} onChange={v=> setHdlMgDl(v||undefined)} />
          <PopupNumber label="Сис. АД" value={systolic ?? 120} min={80} max={200} onChange={v=> setSystolic(v||undefined)} />
          <PopupNumber label="Диас. АД" value={diastolic ?? 80} min={50} max={130} onChange={v=> setDiastolic(v||undefined)} />
          <PopupNumber label="AST, Ед/л" value={ast ?? 25} min={10} max={200} onChange={v=> setAst(v||undefined)} />
          <PopupNumber label="ALT, Ед/л" value={alt ?? 25} min={10} max={300} onChange={v=> setAlt(v||undefined)} />
          <PopupNumber label="Тромбоциты, 10⁹/л" value={plt ?? 250} min={100} max={500} onChange={v=> setPlt(v||undefined)} />
        </div>
        <div style={{ marginTop:6, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <div style={{ padding:8, borderRadius:8, background: mets.hasMetS ? 'rgba(239,68,68,0.10)' : 'rgba(34,197,94,0.08)', border:`1px solid ${mets.hasMetS ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.18)'}`, fontSize:9, color: mets.hasMetS ? '#f87171':'#22c55e', textAlign:'center' }}>{mets.note} · {mets.criteria.join(', ') || 'критериев 0'}</div>
          <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:9, color:'#fff', textAlign:'center' }}>WHtR {whtr? whtr.toFixed(3):'—'} {whtr && whtr>=0.5?'⚠ &gt;0.5':''} · ABSI {absi? absi.toFixed(3):'—'} · BAI {bai ?? '—'} · TyG {tyg ?? '—'} {tyg && tyg>=8.8?'⚠':''} · FIB-4 {fib4 ?? '—'} {fib4 && fib4>1.3?'⚠':''} · QUICKI {quicki ?? '—'}</div>
        </div>
        <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:6 }}>WHtR ≥0.5 риск, ABSI &gt;0.083 риск, TyG ≥8.8 IR, FIB-4 &lt;1.30 низкий &gt;2.67 высокий, QUICKI &lt;0.33 IR. ATP III ≥3/5 = MetS.</div>
      </div>

      <div style={{ ...CARD, border:'1px solid rgba(255,255,255,0.07)', padding:10 }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'rgba(255,255,255,0.55)', marginBottom:8 }}>Pro-измерения — калипер / BIA / Липиды / FLI (опц.)</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <PopupNumber label="JP3 сумма, мм" value={skinfoldSum3 ?? 30} min={8} max={150} onChange={v=> setSkinfoldSum3(v||undefined)} />
          <PopupNumber label="Durnin 4 сумма, мм" value={skinfoldSum4 ?? 40} min={10} max={200} onChange={v=> setSkinfoldSum4(v||undefined)} />
          <PopupNumber label="BIA R, Ом" value={biaResistance ?? 500} min={350} max={900} onChange={v=> setBiaResistance(v||undefined)} />
          <PopupSelect label="Белок plant-heavy?" value={isPlantHeavy?'yes':'no'} options={[{id:'no',label:'Животный/whey'},{id:'yes',label:'Растительный'}]} onChange={v=> setIsPlantHeavy(v==='yes')} />
          <PopupNumber label="SFA, г/сут" value={sfaG ?? 25} min={5} max={80} onChange={v=> setSfaG(v||undefined)} />
          <PopupNumber label="ТГ, мг/дл" value={tgMgDl2 ?? 120} min={40} max={400} onChange={v=> setTgMgDl2(v||undefined)} />
          <PopupNumber label="GGT, Ед/л" value={ggt ?? 25} min={8} max={150} onChange={v=> setGgt(v||undefined)} />
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', display:'flex', alignItems:'center' }}>SFA/fiber → LDL Mensink · FLI Bedogni (BMI+waist+TG+GGT) · {lipid? lipid.note.split('→')[1]??'—' : '—'} · FLI {fli ?? '—'}</div>
        </div>
        <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:6 }}>JP3 ±3% Siri · Durnin ±4% · BIA Kyle 400-900 Ом · Plant leuc 0.07 · Mensink 10г SFA +12 LDL / 10г fiber −5 · FLI Bedogni &lt;30 исключает стеатоз &gt;60 подтверждает.</div>
      </div>

      <div style={{ ...CARD, border:'1px solid rgba(255,255,255,0.07)', padding:10 }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'rgba(255,255,255,0.55)', marginBottom:8 }}>Stress Load + щитовидка + HOMA (опц.)</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <PopupNumber label="FT4, пмоль/л" value={ft4 ?? 17} min={5} max={30} step={0.5} onChange={v=> setFt4(v||undefined)} />
          <PopupNumber label="Глюкоза натощак, мг/дл" value={glucoseMgDl ?? 90} min={60} max={180} onChange={v=> setGlucoseMgDl(v||undefined)} />
          <PopupNumber label="Инсулин, мкЕд/мл" value={insulinMuMl ?? 8} min={2} max={40} step={0.5} onChange={v=> setInsulinMuMl(v||undefined)} />
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <PopupNumber label="Дефицит, ккал/д" value={deficitKcal ?? 500} min={0} max={1200} step={50} onChange={v=> setDeficitKcal(v||undefined)} />
            <div style={{ fontSize:8, color: at.tier==='severe'?'#ef4444': at.tier==='moderate'?'#f59e0b':'rgba(255,255,255,0.45)', background: at.tier!=='none'?'rgba(245,158,11,0.08)':'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'4px 6px' }}>{at.note} · RMR pred {at.rmrPred}</div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:6 }}>
          <PopupNumber label="Нед в дефиците" value={weeksInDeficit ?? 4} min={0} max={24} onChange={v=> setWeeksInDeficit(v||undefined)} />
          <PopupNumber label="Потеряно, кг" value={weightLostKg ?? 2} min={0} max={30} step={0.5} onChange={v=> setWeightLostKg(v||undefined)} />
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', display:'flex', alignItems:'center' }}>Thyroid: {thyroid.note} · HOMA {homa.homa ?? '—'} {homa.zone!=='unknown' && `— ${homa.note}`}</div>
        </div>
      </div>

      <div style={{ ...CARD, border:'1px solid rgba(255,255,255,0.07)', padding:10 }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'rgba(255,255,255,0.55)', marginBottom:8 }}>Восстановление (Stress Load) + кофеин/алкоголь</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <PopupNumber label="Стресс 1-10" value={stress} min={1} max={10} onChange={setStress} />
          <PopupNumber label="Сон, ч" value={sleepHours} min={3} max={11} step={0.5} onChange={setSleepHours} />
          <PopupNumber label="Качество сна 1-5" value={sleepQuality} min={1} max={5} onChange={setSleepQuality} />
          <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', letterSpacing:0.3 }}>ACWR live</div>
            <div style={{ fontSize:14, fontWeight:900, color: cortisol.acwrZone==='dangerous'?'#ef4444':cortisol.acwrZone==='caution'?'#f59e0b':'#22c55e' }}>{acwr.toFixed(2)} · {cortisol.acwrZone}</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)' }}>из sRPE · {cortisol.caffeineAdj? `коф +${cortisol.caffeineAdj}`:''} {cortisol.alcoholAdj? `алк +${cortisol.alcoholAdj}`:''}</div>
          </div>
          <PopupNumber label="Кофеин, мг/сут" value={caffeineMg} min={0} max={800} onChange={setCaffeineMg} />
          <PopupNumber label="Алкоголь, г/сут" value={alcoholG} min={0} max={120} onChange={setAlcoholG} />
          <PopupNumber label="TSH (опц.)" value={tsh ?? 1.5} min={0.1} max={10} step={0.1} onChange={v=> setTsh(v)} />
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', display:'flex', alignItems:'center' }}>{alcohol.kcal>0? `${alcohol.kcal}ккал алко · блок жира ${alcohol.fatOxidationBlockedPct}%`:'Без алкоголя'}</div>
          <PopupNumber label="Ч/после кофе, ч" value={caffeineHoursSince} min={0} max={24} step={0.5} onChange={setCaffeineHoursSince} />
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', display:'flex', alignItems:'center' }}>{caffeineCurve.note} · сон cut-off {caffeineCurve.sleepCutoffH}ч</div>
        </div>
      </div>
      <div style={{ ...CARD, border:'1px solid rgba(6,182,214,0.12)', padding:10, background:'rgba(6,182,214,0.04)' }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'#06b6d4', marginBottom:8 }}>🔋 RED-S скрининг (IOC CAT2-lite) — EA + LEAF/RMR/кости</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <PopupNumber label="LEAF-Q-lite 0-16" value={leafScore ?? 0} min={0} max={16} onChange={v=> setLeafScore(v||undefined)} />
          <PopupNumber label="RMR измер., ккал" value={measuredRMR ?? 0} min={800} max={3500} onChange={v=> setMeasuredRMR(v||undefined)} />
          <label style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:9, color:'#fff' }}><input type="checkbox" checked={boneFlag} onChange={e=> setBoneFlag(e.target.checked)} /> Стресс-перелом</label>
          <label style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:9, color:'#fff' }}><input type="checkbox" checked={menstrualFlag} onChange={e=> setMenstrualFlag(e.target.checked)} /> Аменорея</label>
        </div>
        <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background: `${redsScreening.color}14`, border:`1px solid ${redsScreening.color}33`, fontSize:9, color: redsScreening.color, lineHeight:1.4 }}>
          <b>{redsScreening.risk==='high'?'🔴 Высокий': redsScreening.risk==='moderate'?'🟠 Умеренный':'🟢 Низкий'} RED-S — score {redsScreening.score} · {redsScreening.flags.join(', ')||'флагов нет'}</b> · {redsScreening.note}
          <span style={{ display:'block', fontSize:8, color:'rgba(255,255,255,0.55)', marginTop:4 }}>EA {ea?.ea ?? '—'} · RMR ratio {measuredRMR && kbju.nat.bmr ? (measuredRMR/kbju.nat.bmr).toFixed(2):'—'} (&lt;0.90 = LEA флаг) · LEAF ≥8 = риск. IOC CAT2 — к врачу.</span>
        </div>
        {refeedNeed.needed && <div style={{ marginTop:6, padding:'7px 10px', borderRadius:8, background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.18)', fontSize:9, color:'#fbbf24' }}>Refeed нужен: +{refeedNeed.carbBoostPct}% углей 1×/нед — лептин/T3 (Trexler). {refeedNeed.note}</div>}
        {dietBreakPlan && <div style={{ marginTop:6, fontSize:8, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'6px 8px' }}>MATADOR: {dietBreakPlan.slice(0,8).map(p=> p.phase==='deficit'?'−':'○').join('')} {dietBreakPlan.length}нед · break каждые 6нед ×2нед maintenance</div>}
      </div>

      <div style={{ ...CARD, border:'1px solid rgba(239,68,68,0.12)', padding:10, background:'rgba(239,68,68,0.04)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
          <span style={{ fontSize:14 }}>🩸</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'#f87171' }}>Гематокрит / вязкость — лабы (опционально)</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.55)', lineHeight:1.35 }}>HCT — главный маркер на ААС. &gt;52% → донация. Подтянется из Профиля → Лабы.</div>
          </div>
          <span style={{ fontSize:8, padding:'3px 7px', borderRadius:20, background: hematology.zone==='unknown' ? 'rgba(255,255,255,0.06)' : `${hematology.color}18`, border:`1px solid ${hematology.color}33`, color: hematology.zone==='unknown' ? 'rgba(255,255,255,0.55)' : hematology.color, fontWeight:800 }}>{hematology.zone==='unknown' ? 'нет HCT' : hematology.zoneLabel}</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <PopupNumber label="HCT, % (гематокрит)" value={hct ?? 45} min={36} max={62} onChange={v=> setHct(v)} />
          <PopupNumber label="HGB, г/л (опц.)" value={hgb ?? (hct? Math.round(hct*3.4): 150)} min={110} max={200} onChange={v=> setHgb(v)} />
          <PopupNumber label="Ферритин, нг/мл" value={ferritin ?? 120} min={5} max={800} onChange={v=> setFerritin(v)} />
          <PopupNumber label="GFR, мл/мин" value={gfr ?? 95} min={15} max={130} onChange={v=> setGfr(v)} />
          <PopupNumber label="Вода факт, л/сут" value={waterL} min={1} max={6} step={0.1} onChange={setWaterL} />
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <PopupNumber label="Na, г/сут" value={sodiumG} min={1} max={8} step={0.1} onChange={setSodiumG} />
            <div style={{ display:'flex', gap:4 }}>
              <span style={{ flex:1, fontSize:8, color: hematology.viscosityFlag ? '#ef4444' : 'rgba(255,255,255,0.45)', background: hematology.viscosityFlag ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.03)', border:`1px solid ${hematology.viscosityFlag?'rgba(239,68,68,0.18)':'rgba(255,255,255,0.06)'}`, borderRadius:8, padding:'5px 6px', textAlign:'center' }}>{hematology.viscosityFlag ? '⚠ вязкость' : 'вязкость OK'}</span>
              <span style={{ flex:1, fontSize:8, color:'rgba(255,255,255,0.55)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'5px 6px', textAlign:'center' }}>K {potassiumG}г</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop:6, display:'flex', gap:6, flexWrap:'wrap' }}>
          <button onClick={()=> { setHct(undefined); setHgb(undefined); setFerritin(undefined); setGfr(undefined); showToast('Лабы сброшены — подтянутся из профиля'); }} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.03)', color:'rgba(255,255,255,0.65)', fontSize:9, fontWeight:600, cursor:'pointer' }}>⟲ Сброс лаб</button>
          <button onClick={recordHct} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid rgba(56,165,250,0.18)', background:'rgba(56,165,250,0.10)', color:'#38bdf8', fontSize:9, fontWeight:700, cursor:'pointer' }}>📌 Записать HCT</button>
          <button onClick={recordDonation} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid rgba(239,68,68,0.18)', background:'rgba(239,68,68,0.10)', color:'#ef4444', fontSize:9, fontWeight:700, cursor:'pointer' }}>🩸 Донация сегодня</button>
          <span style={{ fontSize:8, color:'rgba(255,255,255,0.45)', alignSelf:'center' }}>ESC &gt;52% (м)/48% (ж), флеботомия &gt;54%.</span>
        </div>
        {hctHistory.length>0 && (
          <div style={{ marginTop:6, display:'flex', gap:4, alignItems:'end', flexWrap:'wrap' }}>
            {hctHistory.slice(-12).map((p,i)=>(
              <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                <div style={{ width:22, height: Math.max(6, Math.min(42, (p.hct-36)*1.6)), borderRadius:4, background: p.hct>54 ? '#ef4444' : p.hct>51 ? '#f59e0b' : p.hct>=48 ? '#eab308' : '#22c55e', border:'1px solid rgba(255,255,255,0.08)' }} title={`${p.date} ${p.hct}%`} />
                <span style={{ fontSize:7, color:'rgba(255,255,255,0.35)' }}>{p.date.slice(5)}</span>
              </div>
            ))}
            <span style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginLeft:4 }}>{hctHistory.length} записей · тренд {hctHistory.length>=2 ? `${(hctHistory[hctHistory.length-1].hct - hctHistory[0].hct).toFixed(1)}%` : ''}</span>
            {donationLog.length>0 && <span style={{ fontSize:8, color:'#ef4444', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.12)', borderRadius:6, padding:'2px 6px' }}>🩸 донаций {donationLog.length} · посл. {donationLog[donationLog.length-1].date}</span>}
          </div>
        )}
        {hct==null && <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.55)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'7px 10px' }}>💡 Введи HCT из ОАК — инструмент покажет воду, железо, донацию и вязкость. Без HCT шкала слепая.</div>}
      </div>

      {/* KPI — расширенные */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:6 }}>
        {[
          {k:'water', v: onAAS ? water.aas : water.nat, u:'мл', l:'Вода', c:'#38bdf8', d: `Δ ${water.delta>0?'+':''}${water.delta} · ${water.perHour}мл/ч · IOM ${water.iomPerKg}`},
          {k:'steps', v: onAAS ? stepsCalc.stepsAAS : stepsCalc.stepsNat, u:'', l:'Шаги', c:'#22c55e', d: `PAL ${stepsCalc.pal} · ${stepsCalc.tdeeNat}ккал · DLW ${stepsCalc.dlwBand.low}-${stepsCalc.dlwBand.high}`},
          {k:'kbju', v: onAAS ? kbju.aas.kcal : kbju.nat.kcal, u:'ккал', l:'КБЖУ', c:'#f59e0b', d:`Б${onAAS? kbju.aas.p:kbju.nat.p} Ж${onAAS? kbju.aas.f:kbju.nat.f} У${onAAS? kbju.aas.c:kbju.nat.c}${kbju.thyroidMult!==1? ` · щит ×${kbju.thyroidMult.toFixed(2)}`:''}`},
        ].map(x=> (
          <div key={x.k} style={{ ...CARD, marginBottom:0, padding:10, borderLeft:`3px solid ${x.c}`, minHeight:72 }}>
            <div style={{ fontSize:9, fontWeight:800, color:x.c, letterSpacing:0.4, textTransform:'uppercase' }}>{x.l}</div>
            <div style={{ fontSize:16, fontWeight:900, color:'#fff' }}>{x.v.toLocaleString()}<span style={{ fontSize:10, color:'#fff' }}> {x.u}</span></div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.3 }}>{x.d}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:6 }}>
        <div style={{ ...CARD, marginBottom:0, padding:10, borderLeft:'3px solid #a78bfa', minHeight:72 }}>
          <div style={{ fontSize:9, fontWeight:800, color:'#a78bfa', letterSpacing:0.4, textTransform:'uppercase' }}>Жир · FFMI</div>
          <div style={{ fontSize:16, fontWeight:900, color:'#fff' }}>{fat.current}%<span style={{ fontSize:10 }}> · FFMI {onAAS? fat.ffmiNormAdj:fat.ffmiNorm}</span></div>
          <div style={{ fontSize:9, color: (onAAS? fat.isOverNatLimitAAS:fat.isOverNatLimit)?'#f87171':'#fff' }}>{fat.jp!=null?`JP ${fat.jp}% · `:''}Navy {fat.navy ?? '—'} · Deur {fat.deurenberg}{fat.deurenbergWarn?'*':''} · 26.2 {(onAAS? fat.isOverNatLimitAAS:fat.isOverNatLimit)?'⚠': '✓'}</div>
        </div>
        <div style={{ ...CARD, marginBottom:0, padding:10, borderLeft:'3px solid #f43f5e', minHeight:72 }}>
          <div style={{ fontSize:9, fontWeight:800, color:'#f43f5e', letterSpacing:0.4, textTransform:'uppercase' }}>Stress Load (не кортизол) ⚠️ E</div>
          <div style={{ fontSize:16, fontWeight:900, color: (onAAS? cortisol.zoneAAS:cortisol.zoneNat)==='high' || (onAAS? cortisol.zoneAAS:cortisol.zoneNat)==='very_high' ? '#ef4444' : '#fff' }}>{onAAS? cortisol.aas: cortisol.nat}<span style={{ fontSize:10 }}> /100 · {onAAS? cortisol.zoneLabelAAS: cortisol.zoneLabelNat}</span></div>
          <div style={{ fontSize:8, color:'#fff' }}>{cortisol.note.slice(0,48)}</div>
        </div>
        <div style={{ ...CARD, marginBottom:0, padding:10, borderLeft:`3px solid ${hematology.color}`, minHeight:72 }}>
          <div style={{ fontSize:9, fontWeight:800, color: hematology.color, letterSpacing:0.4, textTransform:'uppercase' }}>Кровь · HCT</div>
          <div style={{ fontSize:16, fontWeight:900, color: hematology.zone==='unknown' ? '#fff' : hematology.color }}>{hematology.hct != null ? `${hematology.hct}%` : '—'}<span style={{ fontSize:10 }}> · {hematology.zoneLabel}</span></div>
          <div style={{ fontSize:9, color: hematology.zone==='unknown' ? 'rgba(255,255,255,0.55)' : hematology.color }}>{hematology.hct==null ? 'введи HCT' : `${hematology.waterTargetMl}мл · ${hematology.ironRecLabel.split(' —')[0]}`}</div>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6, marginBottom:10 }}>
        <div style={{ ...CARD, marginBottom:0, padding:10, borderLeft:`3px solid ${ea.color}`, minHeight:68 }}>
          <div style={{ fontSize:9, fontWeight:800, color: ea.color, letterSpacing:0.4, textTransform:'uppercase' }}>EA · RED-S</div>
          <div style={{ fontSize:15, fontWeight:900, color: ea.zone==='low' ? '#ef4444' : ea.zone==='reduced' ? '#f59e0b' : '#fff' }}>{ea.ea != null ? `${ea.ea}` : '—'}<span style={{ fontSize:9 }}> ккал/кгFFM</span></div>
          <div style={{ fontSize:8, color: ea.zone==='unknown' ? 'rgba(255,255,255,0.55)' : ea.color }}>{ea.zoneLabel}</div>
        </div>
        <div style={{ ...CARD, marginBottom:0, padding:10, borderLeft:'3px solid #f97316', minHeight:68 }}>
          <div style={{ fontSize:9, fontWeight:800, color:'#f97316', letterSpacing:0.4, textTransform:'uppercase' }}>Алко · TEF</div>
          <div style={{ fontSize:15, fontWeight:900, color: alcohol.kcal>0 ? '#f97316' : '#fff' }}>{alcohol.kcal}<span style={{ fontSize:9 }}>ккал</span></div>
          <div style={{ fontSize:8, color:'#fff' }}>{alcohol.kcal>0? `блок ${alcohol.fatOxidationBlockedPct}% · ${alcohol.stepsEq} шагов`:'—'}</div>
        </div>
        <div style={{ ...CARD, marginBottom:0, padding:10, borderLeft:'3px solid #84cc16', minHeight:68 }}>
          <div style={{ fontSize:9, fontWeight:800, color:'#84cc16', letterSpacing:0.4, textTransform:'uppercase' }}>Protein timing</div>
          <div style={{ fontSize:15, fontWeight:900, color:'#fff' }}>{proteinTiming.perMeal}г<span style={{ fontSize:9 }}> /приём · {proteinTiming.leucinePerMeal}г leuc</span></div>
          <div style={{ fontSize:8, color: proteinTiming.leucinePerMeal>=2.2 ? '#22c55e' : '#f59e0b' }}>{proteinTiming.note.slice(0,32)}</div>
        </div>
        <div style={{ ...CARD, marginBottom:0, padding:10, borderLeft:'3px solid #eab308', minHeight:68 }}>
          <div style={{ fontSize:9, fontWeight:800, color:'#eab308', letterSpacing:0.4, textTransform:'uppercase' }}>Цель · Hall</div>
          <div style={{ fontSize:13, fontWeight:900, color:'#fff' }}>{goalTimeline ? `${goalTimeline.days}д` : '—'}<span style={{ fontSize:9 }}> {targetWeight? `→ ${targetWeight}кг`:''}</span></div>
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{maintenance ? `TDEE ~${maintenance.tdee} R2 ${maintenance.r2}` : goalTimeline?.note.slice(0,28) || 'введи цель вес'}</div>
        </div>
      </div>

      {diaryAvgKcal != null && (
        <div style={{ ...CARD, padding:'10px 12px', background: Math.abs(diaryAvgKcal - stepsCalc.tdeeNat) < 150 ? 'rgba(34,197,94,0.08)' : diaryAvgKcal < stepsCalc.tdeeNat ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.06)', border:`1px solid ${Math.abs(diaryAvgKcal - stepsCalc.tdeeNat) < 150 ? 'rgba(34,197,94,0.18)' : diaryAvgKcal < stepsCalc.tdeeNat ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.12)'}`, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18 }}>📓</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#fff' }}>Дневник 7д: {diaryAvgKcal}ккал/сут · {diaryDays}д · факт vs TDEE {stepsCalc.tdeeNat} → {diaryAvgKcal - stepsCalc.tdeeNat > 0 ? '+' : ''}{diaryAvgKcal - stepsCalc.tdeeNat}ккал/сут</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.55)' }}>{diaryAvgKcal < stepsCalc.tdeeNat -150 ? 'Дефицит — тренд должен −0.3…−0.6кг/нед' : diaryAvgKcal > stepsCalc.tdeeNat +150 ? 'Профицит — набор +0.2кг/нед, проверь EA' : 'Баланс — вес стабилен'} · EA {ea.ea ?? '—'} · TDEE finder R2 {maintenance?.r2 ?? '—'}</div>
          </div>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontWeight:700 }}>{ea.zoneLabel}</span>
        </div>
      )}
      {diaryAvgKcal == null && (
        <div style={{ ...CARD, padding:'8px 12px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'rgba(255,255,255,0.55)', textAlign:'center' }}>📓 Нет данных дневника 7д — веди дневник питания, появится факт vs TDEE + EA live</div>
      )}

      <div style={{ position:'sticky', top:0, zIndex:5, margin:'-2px -8px 10px', padding:'8px 8px', background:'rgba(10,10,12,0.72)', backdropFilter:'blur(10px)', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none' }}>
        {MODE_DEFS.map(({m,label,icon,desc,accent,evidence})=> (
          <button key={m} onClick={()=> setMode(m)} title={`${desc} · ${evidence}`} style={{
            flex:'0 0 auto', display:'flex', alignItems:'center', gap:4, padding:'7px 10px', borderRadius:20, cursor:'pointer', fontSize:10, fontWeight:800, whiteSpace:'nowrap',
            border: mode===m ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.08)',
            background: mode===m ? `${accent}18` : 'rgba(255,255,255,0.04)',
            color: mode===m ? accent : '#fff', transition:'all 0.16s',
          }}><span>{icon}</span> {label}<span style={{ fontSize:7, opacity:0.7 }}>{evidence.split(' ')[0]}</span></button>
        ))}
      </div>

      <div style={{ ...CARD, padding:0, overflow:'hidden', background:'rgba(24,24,27,0.30)' }}>
        <div style={{ padding:'8px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:`${active.accent}18`, border:`1px solid ${active.accent}33`, fontSize:14 }}>{active.icon}</span>
          <div>
            <div style={{ fontSize:12, fontWeight:900, color:active.accent }}>{active.label} · {active.desc}</div>
            <div style={{ fontSize:10, color:'#fff' }}>{active.hint}</div>
          </div>
        </div>
        <div style={{ padding:12 }}>
          {mode==='water' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background:'rgba(56,165,250,0.08)', border:'1px solid rgba(56,165,250,0.18)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff' }}>Без ААС</div>
                  <div style={{ fontSize:20, fontWeight:900, color:'#38bdf8' }}>{water.nat} <span style={{fontSize:10, color:'#fff'}}>мл</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>{water.perHour}мл/ч · база {water.breakdown.base}+пот {water.breakdown.training}{water.breakdown.climate? ` ${water.breakdown.climate>0?'+':''}${water.breakdown.climate}`:''}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background: onAAS ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: onAAS ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: onAAS ? '#f87171' : '#fff' }}>С ААС</div>
                  <div style={{ fontSize:20, fontWeight:900, color: onAAS ? '#f87171' : '#fff' }}>{water.aas} <span style={{fontSize:10, color:'#fff'}}>мл</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>{water.perHourAAS}мл/ч · Δ +{water.delta} ({Math.round((water.aas/water.nat-1)*100)}%)</div>
                </div>
              </div>
              <div style={{ marginTop:10, display:'flex', gap:8, alignItems:'center' }}>
                <Bar v={water.breakdown.base} max={water.nat} color="#38bdf8" label={`база ${water.breakdown.base}`} />
                <Bar v={water.breakdown.training} max={water.nat} color="#f59e0b" label={`пот ${water.breakdown.training}`} />
                {water.breakdown.climate!==0 && <Bar v={Math.abs(water.breakdown.climate)} max={water.nat} color="#22c55e" label={`${water.breakdown.climate>0?'+':''}${water.breakdown.climate} климат`} />}
              </div>
              <div style={{ marginTop:8, fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'8px 10px', lineHeight:1.45 }}>{water.note} · LBM {water.breakdown.lean}кг / жир {water.breakdown.fatMass}кг</div>
              {hematology.hct!=null && hematology.waterAdjMl>0 && <div style={{ marginTop:6, fontSize:9, color:'#38bdf8', background:'rgba(56,165,250,0.08)', border:'1px solid rgba(56,165,250,0.18)', borderRadius:8, padding:'7px 10px' }}>🩸 HCT {hematology.hct}% → вода с гематокритом {hematology.waterTargetMl}мл ({hematology.mlPerKg}мл/кг) +{hematology.waterAdjMl} к базе — см. вкладку Кровь</div>}
            </div>
          )}
          {mode==='steps' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.18)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff' }}>Без ААС</div>
                  <div style={{ fontSize:18, fontWeight:900, color:'#22c55e' }}>{stepsCalc.stepsNat.toLocaleString()} <span style={{fontSize:10}}>шагов</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>TDEE {stepsCalc.tdeeNat} → цель {stepsCalc.targetNat}ккал</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background: onAAS ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: onAAS ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: onAAS ? '#f87171' : '#fff' }}>С ААС</div>
                  <div style={{ fontSize:18, fontWeight:900, color: onAAS ? '#f87171' : '#fff' }}>{stepsCalc.stepsAAS.toLocaleString()} <span style={{fontSize:10}}>шагов</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>TDEE {stepsCalc.tdeeAAS} → {stepsCalc.targetAAS}ккал · Δ {stepsCalc.delta}</div>
                </div>
              </div>
              <div style={{ marginTop:8, display:'flex', gap:6 }}>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>PAL <b style={{color:'#22c55e'}}>{stepsCalc.pal}</b></div>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>сидяч <b>{stepsCalc.sedentKcal}ккал</b></div>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>{stepsCalc.kcalPerStep}ккал/шаг</div>
              </div>
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:9, fontWeight:800, color:'rgba(255,255,255,0.6)', textTransform:'uppercase', letterSpacing:0.3, marginBottom:6 }}>Waterfall TDEE · BMR + NEAT + EAT + TEF 10%</div>
                <div style={{ display:'flex', gap:6, alignItems:'end' }}>
                  <Bar v={stepsCalc.bmr} max={stepsCalc.tdeeNat} color="#60a5fa" label={`BMR ${stepsCalc.bmr}`} />
                  <Bar v={stepsCalc.neat} max={stepsCalc.tdeeNat} color="#22c55e" label={`NEAT ${stepsCalc.neat}`} />
                  <Bar v={stepsCalc.eat} max={stepsCalc.tdeeNat} color="#f59e0b" label={`EAT ${stepsCalc.eat}`} />
                  <Bar v={stepsCalc.tefNat} max={stepsCalc.tdeeNat} color="#a78bfa" label={`TEF ${stepsCalc.tefNat}`} />
                </div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:4, lineHeight:1.3 }}>TDEE {stepsCalc.tdeeNat}= BMR{stepsCalc.bmr}+NEAT{stepsCalc.neat}+EAT{stepsCalc.eat}+TEF{stepsCalc.tefNat} (TEF ~10% уже внутри PAL, показан для наглядности · EAT = train+cardio)</div>
              </div>
              {stepsCalc.adaptive ? (
                <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background: Math.abs(stepsCalc.adaptive.adjustment)>120 ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${Math.abs(stepsCalc.adaptive.adjustment)>120 ? 'rgba(245,158,11,0.18)' : 'rgba(34,197,94,0.18)'}`, fontSize:10, color:'#fff', lineHeight:1.4 }}>
                  <b style={{ color: Math.abs(stepsCalc.adaptive.adjustment)>120 ? '#fbbf24' : '#22c55e' }}>Адаптивный TDEE по весу:</b> тренд {stepsCalc.adaptive.trend>0?'+':''}{stepsCalc.adaptive.trend}кг/нед · коррекция {stepsCalc.adaptive.adjustment>0?'+':''}{stepsCalc.adaptive.adjustment}ккал → {stepsCalc.adaptive.tdee}ккал · {stepsCalc.adaptive.suggest}
                  <span style={{ display:'block', fontSize:8, color:'rgba(255,255,255,0.55)', marginTop:2 }}>История: {weightHistory.length} точек (he_nutrition_v2 · calcTrend). {weightHistory.length<3 ? 'Добавь ≥3 взвешивания — появится тренд.' : ''}</span>
                </div>
              ) : weightHistory.length>=1 && weightHistory.length<3 ? (
                <div style={{ marginTop:8, padding:'7px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:9, color:'rgba(255,255,255,0.55)' }}>Адаптивный TDEE: нужно ≥3 взвешивания в дневнике веса (сейчас {weightHistory.length}) — данные из he_nutrition_v2.</div>
              ) : null}
              <div style={{ marginTop:8, fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'8px 10px' }}>{stepsCalc.note}</div>
            </div>
          )}
          {mode==='kbju' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff' }}>Без ААС — {kbju.nat.protPerKg}г/кг · PAL {kbju.nat.pal}</div>
                  <div style={{ fontSize:16, fontWeight:900, color:'#f59e0b' }}>{kbju.nat.kcal} ккал</div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Б{kbju.nat.p} Ж{kbju.nat.f} У{kbju.nat.c}</div>
                  <div style={{ marginTop:6, height:6, borderRadius:20, background:'rgba(255,255,255,0.06)', display:'flex', overflow:'hidden' }}>
                    <div style={{ width:`${Math.round(kbju.nat.p*4/kbju.nat.kcal*100)}%`, background:'#60a5fa' }} />
                    <div style={{ width:`${Math.round(kbju.nat.f*9/kbju.nat.kcal*100)}%`, background:'#fbbf24' }} />
                    <div style={{ flex:1, background:'#fb923c' }} />
                  </div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', marginTop:3 }}>Б {Math.round(kbju.nat.p*4/kbju.nat.kcal*100)}% · Ж {Math.round(kbju.nat.f*9/kbju.nat.kcal*100)}% · У {Math.round(kbju.nat.c*4/kbju.nat.kcal*100)}%</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background: onAAS ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: onAAS ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: onAAS ? '#f87171' : '#fff' }}>С ААС — {kbju.aas.protPerKg}г/кг · PAL {kbju.aas.pal}</div>
                  <div style={{ fontSize:16, fontWeight:900, color: onAAS ? '#f87171' : '#fff' }}>{kbju.aas.kcal} ккал</div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Б{kbju.aas.p} Ж{kbju.aas.f} У{kbju.aas.c}</div>
                  <div style={{ marginTop:6, height:6, borderRadius:20, background:'rgba(255,255,255,0.06)', display:'flex', overflow:'hidden' }}>
                    <div style={{ width:`${Math.round(kbju.aas.p*4/kbju.aas.kcal*100)}%`, background:'#60a5fa' }} />
                    <div style={{ width:`${Math.round(kbju.aas.f*9/kbju.aas.kcal*100)}%`, background:'#fbbf24' }} />
                    <div style={{ flex:1, background:'#fb923c' }} />
                  </div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', marginTop:3 }}>Б {Math.round(kbju.aas.p*4/kbju.aas.kcal*100)}% · Ж {Math.round(kbju.aas.f*9/kbju.aas.kcal*100)}% · У {Math.round(kbju.aas.c*4/kbju.aas.kcal*100)}%</div>
                </div>
              </div>
              <div style={{ marginTop:6, display:'flex', gap:6 }}>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>Δ ккал <b style={{color: kbju.delta.kcal>0?'#f87171':'#22c55e'}}>{kbju.delta.kcal>0?'+':''}{kbju.delta.kcal}</b></div>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>Δ белок <b style={{color:'#f87171'}}>+{kbju.delta.p}г</b></div>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>клетчатка {onAAS? kbju.fiber.aas:kbju.fiber.nat}г</div>
              </div>
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:9, fontWeight:800, color:'rgba(255,255,255,0.6)', textTransform:'uppercase', letterSpacing:0.3, marginBottom:6 }}>Waterfall TDEE · BMR + NEAT + EAT + TEF 10%</div>
                <div style={{ display:'flex', gap:6, alignItems:'end' }}>
                  <Bar v={kbju.bmr} max={kbju.nat.tdee} color="#60a5fa" label={`BMR ${kbju.bmr}`} />
                  <Bar v={kbju.neat} max={kbju.nat.tdee} color="#22c55e" label={`NEAT ${kbju.neat}`} />
                  <Bar v={kbju.eat} max={kbju.nat.tdee} color="#f59e0b" label={`EAT ${kbju.eat}`} />
                  <Bar v={kbju.tefNat} max={kbju.nat.tdee} color="#a78bfa" label={`TEF ${kbju.tefNat}`} />
                </div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:4 }}>TDEE {kbju.nat.tdee}= BMR{kbju.bmr}+NEAT{kbju.neat}+EAT{kbju.eat}+TEF{kbju.tefNat} (TEF ~10% внутри PAL, показан для наглядности)</div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.35)', marginTop:3 }}>FAO 2004: BEE=BMR×1.10 (TEF), TEE=BEE×PAL. У нас TDEE=BMR×PAL — PAL FAO уже включает TEF; TEF отдельно информативен, BEE≈{kbju.bmr + kbju.tefNat}ккал</div>
              </div>
              {kbju.adaptive ? (
                <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background: Math.abs(kbju.adaptive.adjustment)>120 ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${Math.abs(kbju.adaptive.adjustment)>120 ? 'rgba(245,158,11,0.18)' : 'rgba(34,197,94,0.18)'}`, fontSize:10, color:'#fff', lineHeight:1.4 }}>
                  <b style={{ color: Math.abs(kbju.adaptive.adjustment)>120 ? '#fbbf24' : '#22c55e' }}>Адаптивный TDEE по весу:</b> тренд {kbju.adaptive.trend>0?'+':''}{kbju.adaptive.trend}кг/нед · коррекция {kbju.adaptive.adjustment>0?'+':''}{kbju.adaptive.adjustment}ккал → {kbju.adaptive.tdee}ккал · {kbju.adaptive.suggest}
                  <span style={{ display:'block', fontSize:8, color:'rgba(255,255,255,0.55)', marginTop:2 }}>История {weightHistory.length} точек · calcTrendFromHistory (he_nutrition_v2). Формула: diff*770ккал.</span>
                </div>
              ) : weightHistory.length>=1 && weightHistory.length<3 ? (
                <div style={{ marginTop:8, padding:'7px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:9, color:'rgba(255,255,255,0.55)' }}>Адаптивный TDEE: нужно ≥3 взвешивания (сейчас {weightHistory.length}) — данные из he_nutrition_v2.</div>
              ) : null}
              <div style={{ marginTop:6, fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'8px 10px' }}>{kbju.note} · {kbju.carbTiming}</div>
              {goal==='health' && (
                <div style={{ marginTop:6, padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.12)', fontSize:10, color:'#fff', lineHeight:1.4 }}>
                  <b style={{ color:'#f87171' }}>🎯 Здоровье-профиль:</b> белок 1.8г/кг · клетчатка ≥30г (муж 34г) · PRAL −5..+5 · omega-3 ≥2г · вода {hematology.waterTargetMl}мл ({hematology.mlPerKg}мл/кг) · Na 2.3-3.5г · железо {hematology.ironRecLabel.split(' —')[0]} · {hematology.pralNote}
                  <span style={{ display:'block', fontSize:8, color:'rgba(255,255,255,0.55)', marginTop:3 }}>Цель «Здоровье» — maintenance с акцентом на сосуды/вязкость/почки. При HCT&gt;51 — ZERO железо, 42мл/кг воды.</span>
                </div>
              )}
              <div style={{ marginTop:6, display:'flex', gap:6 }}>
                <button onClick={applyKBJU} style={{ flex:1, padding:10, borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#000', fontWeight:800, fontSize:11 }}>🍽 Применить к плану питания → буфер</button>
                <button onClick={()=> { const s = onAAS? kbju.aas:kbju.nat; const t=`КБЖУ ${s.kcal} Б${s.p} Ж${s.f} У${s.c} (P${s.protPerKg})`; navigator.clipboard?.writeText(t).then(()=> showToast('Скопировано: '+t)).catch(()=> showToast(t)); }} style={{ padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.04)', color:'#fff', fontWeight:700, fontSize:11, cursor:'pointer' }}>⎘ Копировать</button>
              </div>
              <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.45)', lineHeight:1.35 }}>Буфер: <code style={{ background:'rgba(255,255,255,0.06)', padding:'1px 5px', borderRadius:5, color:'#fff' }}>he_planner_kbju_suggestion</code> — планировщик подхватит как подсказку. Потолок У — 5г/кг (6 на ААС, ≤8 с инсулином) — из `planner-targets`.</div>
            </div>
          )}
          {mode==='fat' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background:'rgba(167,139,250,0.08)', border:'1px solid rgba(167,139,250,0.18)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff' }}>Текущий</div>
                  <div style={{ fontSize:18, fontWeight:900, color:'#a78bfa' }}>{fat.current}%</div>
                  <div style={{ fontSize:9, color:'#fff' }}>Navy {fat.navy ?? '—'}{fat.navyAdj? ` → ${fat.navyAdj}`:''} · FFM {fat.ffm}кг</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background: fat.isOverNatLimit ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: fat.isOverNatLimit ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: fat.isOverNatLimit ? '#f87171' : '#fff' }}>FFMI_norm {onAAS? fat.ffmiNormAdj:fat.ffmiNorm} { (onAAS? fat.isOverNatLimitAAS:fat.isOverNatLimit) ? '⚠' : '✓'}</div>
                  <div style={{ fontSize:18, fontWeight:900, color: (onAAS? fat.isOverNatLimitAAS:fat.isOverNatLimit)? '#f87171':'#fff' }}>{onAAS? fat.ffmiNormAdj:fat.ffmiNorm}</div>
                  <div style={{ fontSize:9, color:'#fff' }}>{fat.aasNote}</div>
                </div>
              </div>
              <div style={{ marginTop:8, height:8, borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden', position:'relative' }}>
                <div style={{ position:'absolute', left:`${Math.min(100, Math.max(0, ( (onAAS? fat.ffmiNormAdj:fat.ffmiNorm)/28*100)))}%`, top:0, bottom:0, width:2, background:'#fff', opacity:0.9 }} />
                <div style={{ width:`${Math.min(100, 25/28*100)}%`, height:'100%', background:'linear-gradient(90deg,#22c55e,#a78bfa)', opacity:0.55 }} />
                <div style={{ position:'absolute', left:`${25/28*100}%`, top:0, bottom:0, width:1, background:'rgba(255,255,255,0.35)' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:2 }}><span>18</span><span>25 лимит нат</span><span>28</span></div>
              {fat.waistAdj && <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', fontSize:10, color:'#fff' }}>Талия с осевой: {fat.waistAdj}см (коррекция +{fat.axialAdd}см) · {fat.note}</div>}
              <div style={{ marginTop:6, display:'flex', gap:6, fontSize:9 }}>
                <span style={{ flex:1, padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', textAlign:'center' }}>FFMI {fat.ffmi} → norm {fat.ffmiNorm}</span>
                <span style={{ flex:1, padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', textAlign:'center' }}>FFM {fat.ffm}кг</span>
              </div>
              <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'7px 10px' }}>{fat.accuracy}</div>
            </div>
          )}
          {mode==='cortisol' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background:'rgba(244,63,94,0.06)', border:'1px solid rgba(244,63,94,0.15)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff' }}>Без ААС — {cortisol.zoneLabelNat}</div>
                  <div style={{ fontSize:18, fontWeight:900, color: cortisol.zoneNat==='high'||cortisol.zoneNat==='very_high'?'#ef4444': cortisol.zoneNat==='low'?'#60a5fa':'#22c55e' }}>{cortisol.nat} <span style={{fontSize:10}}>/100</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>{cortisol.note}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background: onAAS?'rgba(239,68,68,0.08)':'rgba(255,255,255,0.03)', border: onAAS?'1px solid rgba(239,68,68,0.18)':'1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: onAAS?'#f87171':'#fff' }}>С ААС — {cortisol.zoneLabelAAS}</div>
                  <div style={{ fontSize:18, fontWeight:900, color: cortisol.zoneAAS==='high'||cortisol.zoneAAS==='very_high'?'#ef4444': cortisol.zoneAAS==='low'?'#60a5fa':'#22c55e' }}>{cortisol.aas} <span style={{fontSize:10}}>/100</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>Δ {cortisol.delta>0?'+':''}{cortisol.delta} · {cortisol.acwrZone}</div>
                </div>
              </div>
              <div style={{ marginTop:8, height:10, borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden', display:'flex' }}>
                <div style={{ width:'38%', background:'rgba(96,165,250,0.45)' }} />
                <div style={{ width:'24%', background:'rgba(34,197,94,0.55)' }} />
                <div style={{ width:'16%', background:'rgba(245,158,11,0.55)' }} />
                <div style={{ flex:1, background:'rgba(239,68,68,0.55)' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'rgba(255,255,255,0.45)', marginTop:2 }}><span>0 low</span><span>38</span><span>62 norm</span><span>78 high</span><span>100</span></div>
              <div style={{ marginTop:6, position:'relative', height:6, borderRadius:20, background:'rgba(255,255,255,0.06)' }}>
                <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${onAAS? cortisol.aas: cortisol.nat}%`, background:'linear-gradient(90deg,#60a5fa,#22c55e 45%,#f59e0b 78%,#ef4444)', borderRadius:20, transition:'width 0.35s' }} />
              </div>
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff', lineHeight:1.4 }}>{cortisol.diurnal}</div>
              <div style={{ marginTop:6, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff' }}>
                Что-если: попробуй +1ч сна → {cortisol.whatIf(1,0,0)}, −2 стресса → {cortisol.whatIf(0,-2,0)}, ACWR 1.5→1.0 → {cortisol.whatIf(0,0,-0.5)}. Двигай слайдеры вверху — индекс live.
              </div>
            </div>
          )}
          {mode==='hematology' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background: hematology.zone==='unknown' ? 'rgba(255,255,255,0.03)' : `${hematology.color}14`, border:`1px solid ${hematology.zone==='unknown' ? 'rgba(255,255,255,0.06)' : hematology.color+'33'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color: hematology.zone==='unknown' ? 'rgba(255,255,255,0.55)' : hematology.color }}>HCT {hematology.hct ?? '—'}% — {hematology.zoneLabel}</div>
                  <div style={{ fontSize:22, fontWeight:900, color: hematology.zone==='unknown' ? '#fff' : hematology.color }}>{hematology.hct ?? '—'}<span style={{ fontSize:11, color:'#fff' }}>%</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>{hematology.hgbEstimated ? `HGB ~${hematology.hgbEstimated} г/л` : 'введи HCT/HGB'} · {hematology.viscosityFlag ? '⚠ гипервязкость' : 'вязкость OK'} · GFR {gfr ?? '—'}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.12)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#f87171' }}>Вода с HCT</div>
                  <div style={{ fontSize:18, fontWeight:900, color:'#38bdf8' }}>{hematology.waterTargetMl}<span style={{ fontSize:10, color:'#fff' }}>мл</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>{hematology.mlPerKg}мл/кг · {hematology.waterAdjMl>0 ? `+${hematology.waterAdjMl} к базе` : 'база 35мл/кг'} · факт {waterL}л</div>
                </div>
              </div>
              <div style={{ marginTop:8, height:10, borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden', position:'relative', display:'flex' }}>
                <div style={{ width:'40%', background:'rgba(34,197,94,0.45)' }} />
                <div style={{ width:'15%', background:'rgba(234,179,8,0.55)' }} />
                <div style={{ width:'15%', background:'rgba(245,158,11,0.55)' }} />
                <div style={{ flex:1, background:'rgba(239,68,68,0.55)' }} />
                {hematology.hct!=null && <div style={{ position:'absolute', left:`${Math.min(100, Math.max(0, (hematology.hct-36)/(62-36)*100))}%`, top:0, bottom:0, width:2, background:'#fff', boxShadow:'0 0 6px rgba(255,255,255,0.8)' }} />}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'rgba(255,255,255,0.45)', marginTop:2 }}><span>36</span><span>48 норма</span><span>51</span><span>54 стоп</span><span>62</span></div>
              {hctHistory.length>=2 && (
                <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', letterSpacing:0.3, marginBottom:6 }}>История HCT · {hctHistory.length} точек · Δ {((hctHistory[hctHistory.length-1].hct - hctHistory[0].hct)).toFixed(1)}% {hctHistory.length>=3 ? `· тренд ${((hctHistory[hctHistory.length-1].hct - hctHistory[hctHistory.length-2].hct)).toFixed(1)}%/посл.` : ''}</div>
                  <div style={{ display:'flex', gap:3, alignItems:'end', height:36 }}>
                    {hctHistory.slice(-14).map((p,i)=>(
                      <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                        <div style={{ width:'100%', height: Math.max(4, Math.min(32, (p.hct-36)*1.25)), borderRadius:3, background: p.hct>54 ? '#ef4444' : p.hct>51 ? '#f59e0b' : p.hct>=48 ? '#eab308' : '#22c55e' }} title={`${p.date} ${p.hct}%`} />
                        <span style={{ fontSize:6, color:'rgba(255,255,255,0.35)' }}>{p.date.slice(5).replace('-','/')}</span>
                      </div>
                    ))}
                  </div>
                  {donationLog.length>0 && <div style={{ marginTop:6, fontSize:8, color:'#ef4444' }}>🩸 Донации: {donationLog.map(d=> `${d.date} (${d.hct}%)`).join(' · ')}</div>}
                </div>
              )}
              <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>{hematology.ironRecLabel}</div>
                <div style={{ padding:8, borderRadius:8, background: hematology.donation.needed ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border:`1px solid ${hematology.donation.needed ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.18)'}`, textAlign:'center', fontSize:10, color: hematology.donation.needed ? '#f87171' : '#22c55e' }}>{hematology.donation.text}{hematology.donation.needed ? ` k=${hematology.donation.k}` : ''}</div>
              </div>
              <div style={{ marginTop:6, display:'flex', gap:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:9, padding:'5px 8px', borderRadius:8, background: hematology.ferritinFlag ? 'rgba(245,158,11,0.10)' : 'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color: hematology.ferritinFlag ? '#fbbf24' : '#fff' }}>ферритин {ferritin ?? '—'} {hematology.ferritinFlag ? '⚠ &lt;30' : 'OK'}</span>
                <span style={{ fontSize:9, padding:'5px 8px', borderRadius:8, background: hematology.gfrFlag ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color: hematology.gfrFlag ? '#f87171' : '#fff' }}>GFR {gfr ?? '—'} {hematology.gfrFlag ? '⚠ &lt;60' : ''}</span>
                <span style={{ fontSize:9, padding:'5px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff' }}>PRAL {hematology.pralNote}</span>
                <span style={{ fontSize:9, padding:'5px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff' }}>питание × гематология ×{hematology.nutritionMult}</span>
              </div>
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)', fontSize:10, color:'#fff', lineHeight:1.4 }}>
                <b style={{ color: hematology.color }}>Рекомендации:</b><br/>
                {hematology.recommendations.map((r,i)=>(<span key={i}>• {r}<br/></span>))}
              </div>
              <div style={{ marginTop:6, display:'flex', gap:6 }}>
                <button onClick={()=> { const txt=`HCT ${hematology.hct}% — ${hematology.zoneLabel}. Вода ${hematology.waterTargetMl}мл (${hematology.mlPerKg}мл/кг), ${hematology.ironRecLabel}, ${hematology.donation.text}`; navigator.clipboard?.writeText(txt).then(()=> showToast('Скопировано: '+txt)).catch(()=> showToast(txt)); }} style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'#fff', fontWeight:700, fontSize:10, cursor:'pointer' }}>⎘ Копировать сводку</button>
                <button onClick={()=> {
                  const payload={ hct: hematology.hct, waterTargetMl: hematology.waterTargetMl, ironRec: hematology.ironRec, donation: hematology.donation, ts: Date.now(), source:'metabolic-hub-hematology' };
                  try{ localStorage.setItem('he_hematology_advice', JSON.stringify(payload)); window.dispatchEvent(new CustomEvent('he-hematology-advice', {detail: payload})); showToast(`Сохранено he_hematology_advice: HCT ${hematology.hct}% → ${hematology.zoneLabel}`); }catch{ showToast('Сохранено'); }
                }} style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff', fontWeight:800, fontSize:10, cursor:'pointer' }}>💾 В планировщик (he_hematology_advice)</button>
              </div>
              <div style={{ marginTop:6, display:'flex', gap:6 }}>
                <button onClick={()=>{
                  try{
                    const html=`<!doctype html><html><head><meta charset="utf-8"><title>Гематология — ${hematology.hct ?? '—'}%</title><style>body{font-family:system-ui;padding:24px;color:#111}h1{font-size:18px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px 8px;font-size:12px}th{background:#f5f5f5;text-align:left}.badge{padding:2px 6px;border-radius:6px;color:#fff;font-weight:700;font-size:11px}</style></head><body><h1>🩸 Гематокрит — сводка PRO</h1><p>Дата: ${new Date().toLocaleString('ru-RU')} · Вес ${weight}кг · Пол ${sex} · ААС ${onAAS? aasDose+'мг': 'нет'}</p><table><tr><th>Показатель</th><th>Значение</th></tr><tr><td>HCT</td><td><span class="badge" style="background:${hematology.color}">${hematology.hct ?? '—'}% — ${hematology.zoneLabel}</span></td></tr><tr><td>HGB (оценка)</td><td>${hematology.hgbEstimated ?? '—'} г/л</td></tr><tr><td>Вода цель</td><td>${hematology.waterTargetMl} мл (${hematology.mlPerKg} мл/кг) ${hematology.waterAdjMl? `+${hematology.waterAdjMl} к базе`:''} · факт ${waterL}л</td></tr><tr><td>Железо</td><td>${hematology.ironRecLabel}</td></tr><tr><td>Донация</td><td>${hematology.donation.text} k=${hematology.donation.k}</td></tr><tr><td>Вязкость</td><td>${hematology.viscosityFlag? '⚠ гипервязкость':'OK'} · GFR ${gfr ?? '—'} ${hematology.gfrFlag? '⚠ &lt;60':''} · ферритин ${ferritin ?? '—'} ${hematology.ferritinFlag? '⚠ &lt;30':''}</td></tr><tr><td>Питание×гематология</td><td>×${hematology.nutritionMult} · PRAL ${hematology.pralNote}</td></tr></table><h3>Рекомендации</h3><ul>${hematology.recommendations.map(r=>`<li>${r}</li>`).join('')}</ul><p style="font-size:10px;color:#666">Источники: ESC 2023 эритроцитоз &gt;52% (м)/48% (ж), ASA флеботомия &gt;54%, lab-tier-recommendations, PROCEDURE_DB k0.30/0.45. Дисклеймер: не назначение — к гематологу + JAK2 при HCT&gt;52%.</p><script>window.print()</`+`script></body></html>`;
                    const w=window.open('','_blank'); if(w){ w.document.write(html); w.document.close(); } else showToast('Всплывающие окна заблокированы');
                  }catch{ showToast('Печать: открой HCT вкладку'); }
                }} style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.03)', color:'#fff', fontWeight:700, fontSize:10, cursor:'pointer' }}>🖨 Печать / PDF</button>
                <button onClick={()=>{
                  try{
                    const data={ date: new Date().toISOString().slice(0,10), weight, sex, onAAS, aasDose, hct: hematology.hct, hgb: hematology.hgbEstimated, gfr, ferritin, waterTargetMl: hematology.waterTargetMl, ironRec: hematology.ironRec, donation: hematology.donation, zone: hematology.zone, recommendations: hematology.recommendations, nutritionMult: hematology.nutritionMult };
                    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`hematology-${data.date}.json`; a.click(); URL.revokeObjectURL(url); showToast('JSON экспортирован');
                  }catch{ showToast('Экспорт'); }
                }} style={{ padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.03)', color:'#fff', fontWeight:700, fontSize:10, cursor:'pointer' }}>⬇ JSON</button>
              </div>
              <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.45)', lineHeight:1.35 }}>Зоны: &lt;48 норма · 48-51 внимание · 51-54 донация · &gt;54 стоп ААС · &gt;60 критично. Источник: ESC 2023, ASA флеботомия, lab-tier-recommendations. Дисклеймер: не назначение — к гематологу + JAK2 при HCT&gt;52%.</div>
            </div>
          )}
          {mode==='ea' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background:`${ea.color}14`, border:`1px solid ${ea.color}33`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color: ea.zone==='unknown'?'rgba(255,255,255,0.55)':ea.color }}>EA {ea.ea ?? '—'} ккал/кг FFM · {ea.zoneLabel}</div>
                  <div style={{ fontSize:26, fontWeight:900, color: ea.ea!=null ? ea.color : '#fff' }}>{ea.ea ?? '—'}<span style={{ fontSize:10, color:'#fff' }}> ккал/кгFFM</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>FFM {ea.ffm}кг · EEE {ea.eee}ккал · пороги 30/45 (IOC RED-S)</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff', lineHeight:1.5 }}>
                  <b style={{ color: ea.color }}>{ea.zone==='low'?'🔴 LEA — риск RED-S': ea.zone==='reduced'?'🟡 Граница': ea.zone==='optimal'?'🟢 Оптимально':'—'}</b><br/>{ea.note}<br/>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.55)' }}>Формула: (EI − EEE)/FFM. EI из дневника/КБЖУ {Math.round(kbju.nat.kcal)}ккал, EEE=train+cardio. Женщинам &lt;30 — аменорея/кость, &lt;45 — внимание.</span>
                </div>
              </div>
              <div style={{ marginTop:8, height:10, borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden', display:'flex' }}>
                <div style={{ width:'40%', background:'rgba(239,68,68,0.55)' }} />
                <div style={{ width:'20%', background:'rgba(245,158,11,0.55)' }} />
                <div style={{ flex:1, background:'rgba(34,197,94,0.55)' }} />
                {ea.ea!=null && <div style={{ position:'absolute', left:0, right:0, height:10, pointerEvents:'none' }}><div style={{ position:'absolute', left:`${Math.min(100, Math.max(0, (ea.ea/60)*100))}%`, top:0, bottom:0, width:2, background:'#fff' }} /></div>}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'rgba(255,255,255,0.45)', marginTop:2 }}><span>0 LEA</span><span>30</span><span>45 opt</span><span>60</span></div>
              {goal==='health' && ea.zone==='low' && <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.18)', fontSize:10, color:'#f87171' }}>⚠ Цель Здоровье + LEA &lt;30 — підвись ккал +300 или снизь EEE (убери 1 трен/кардио). Проверь ферритин/витамин D.</div>}
              {ea.ea!=null && ea.ea < 20 && <div style={{ marginTop:6, padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.18)', fontSize:9, color:'#f87171' }}>🚨 PSMF: EA &lt;20 (Blackburn) → FFM loss неизбежен даже с 2.8г/кг белка. EA {ea.ea} — срочно +300ккал. {ea.ea <15 && 'EA <15 — критично!'}</div>}
            </div>
          )}
          {mode==='alcohol' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background: alcohol.kcal>0?'rgba(249,115,22,0.08)':'rgba(255,255,255,0.03)', border:`1px solid ${alcohol.kcal>0?'rgba(249,115,22,0.18)':'rgba(255,255,255,0.06)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color: alcohol.kcal>0?'#f97316':'rgba(255,255,255,0.55)' }}>{alcoholG}г этанола</div>
                  <div style={{ fontSize:26, fontWeight:900, color: alcohol.kcal>0?'#f97316':'#fff' }}>{alcohol.kcal}<span style={{ fontSize:10 }}> ккал</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>7.1ккал/г · TEF {alcohol.tef}ккал · блок жира {alcohol.fatOxidationBlockedPct}%</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff', lineHeight:1.5 }}>
                  {alcohol.note}<br/>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.55)' }}>~{alcohol.stepsEq} шагов компенсируют. Алкоголь подавляет MPS и сон. Введи дозу в HPA-блоке.</span>
                  <div style={{ marginTop:8, display:'flex', gap:6 }}>
                    <PopupNumber label="Алкоголь, г" value={alcoholG} min={0} max={200} onChange={setAlcoholG} />
                  </div>
                </div>
              </div>
              {alcohol.kcal>0 && <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.18)', fontSize:10, color:'#fff' }}>Учет в КБЖУ: {alcohol.kcal}ккал уже включены в TDEE TEF, но жир блок {alcohol.fatOxidationBlockedPct}% ~3ч — не планируй тренировку сразу после.</div>}
            </div>
          )}
          {mode==='protein' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background:'rgba(132,204,22,0.08)', border:'1px solid rgba(132,204,22,0.18)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#84cc16' }}>{proteinTiming.meals} приема · {proteinTiming.perMeal}г/приём</div>
                  <div style={{ fontSize:26, fontWeight:900, color:'#84cc16' }}>{proteinTiming.leucinePerMeal}<span style={{ fontSize:10 }}>г leuc</span></div>
                  <div style={{ fontSize:9, color: proteinTiming.leucinePerMeal>=2.2?'#22c55e':'#f59e0b' }}>{proteinTiming.leucinePerMeal>=2.2?'✓ MPS порог 2.5г достигнут':'⚠ <2.5г — добавь прием'}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff', lineHeight:1.5 }}>
                  <b style={{ color:'#84cc16' }}>Morton 2018 · Schoenfeld/Aragon · Res 2012:</b> {proteinTiming.note}<br/>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.55)' }}>Всего {onAAS? kbju.aas.p:kbju.nat.p}г → {proteinTiming.meals}×{proteinTiming.perMeal}г ({proteinTiming.perMealGPerKg}г/кг {proteinTiming.perMealGPerKg>0.55?'⚠️>'+proteinTiming.ceiling: ''} · {proteinTiming.plantNote} · pre-sleep {proteinTiming.preSleepG}г казеин +0.22кг LBM · Креатин {creatineUse?'да (1я нед +300мл)':'нет'}.</span>
                  <div style={{ marginTop:6, display:'flex', gap:6, flexWrap:'wrap' }}>
                    {[3,4,5,6].map(n=>(
                      <button key={n} onClick={()=>{ /* просто инфо */ }} style={{ padding:'6px 10px', borderRadius:8, border: proteinTiming.meals===n?'1px solid #84cc16':'1px solid rgba(255,255,255,0.08)', background: proteinTiming.meals===n?'rgba(132,204,22,0.12)':'rgba(255,255,255,0.03)', color:proteinTiming.meals===n?'#84cc16':'#fff', fontSize:9, fontWeight:700 }}>{n}×{Math.round((onAAS? kbju.aas.p:kbju.nat.p)/n)}г</button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>Train day: {kbju.periodization.trainDay.kcal}ккал Б{kbju.periodization.trainDay.p} Ж{kbju.periodization.trainDay.f} У{kbju.periodization.trainDay.c}</div>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>Rest day: {kbju.periodization.restDay.kcal}ккал Б{kbju.periodization.restDay.p} Ж{kbju.periodization.restDay.f} У{kbju.periodization.restDay.c}</div>
              </div>
              <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.55)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'7px 10px' }}>💡 {kbju.carbTiming} · Клетчатка {kbju.fiber.nat}г (soluble {fiberSplit.soluble} + insoluble {fiberSplit.insoluble} IoM) · TEF {kbju.tefNat}ккал перс. (P25% C7% F3%) · LBM save {lbmPres.pct}% {lbmPres.note}</div>
            </div>
          )}
          {mode==='maintenance' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background: maintenance?.confidence==='high'?'rgba(34,197,94,0.08)': maintenance?.confidence==='medium'?'rgba(234,179,8,0.08)':'rgba(255,255,255,0.03)', border:`1px solid ${maintenance?.confidence==='high'?'rgba(34,197,94,0.18)': maintenance?.confidence==='medium'?'rgba(234,179,8,0.18)':'rgba(255,255,255,0.06)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)' }}>TDEE finder 14д · R2 {maintenance?.r2 ?? '—'} · {maintenance?.confidence ?? 'нет данных'}</div>
                  <div style={{ fontSize:22, fontWeight:900, color: maintenance?.tdee ? '#eab308' : '#fff' }}>{maintenance?.tdee || '—'}<span style={{ fontSize:10 }}>ккал</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>{maintenance?.note ?? 'Нужно ≥7 взвешиваний + факт ккал'}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff', lineHeight:1.5 }}>
                  <b style={{ color:'#eab308' }}>Цель Hall 2011 density + AT:</b> {goalTimeline?.note ?? 'Введи цель вес в антропометрии'}<br/>
                  {goalTimeline && <span>Дней ~{goalTimeline.days} при {goalTimeline.kcalDiff>0?'+':''}{goalTimeline.kcalDiff}ккал/сут · {goalTimeline.model} · AT −{maintenance?.atKcal ?? 0}ккал.</span>}<br/>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.55)' }}>История {weightHistory.length} точек · {weightHistory.length>=7? 'достаточно':'нужно ≥7'} · плотность {maintenance?.density ?? '—'}ккал/кг · DLW ±12% {stepsCalc.dlwBand.low}-{stepsCalc.dlwBand.high}</span>
                  <div style={{ marginTop:6, display:'flex', gap:6 }}>
                    <PopupNumber label="Цель вес" value={targetWeight ?? weight} min={35} max={200} onChange={setTargetWeight} />
                  </div>
                </div>
              </div>
              {weightHistory.length>=3 && (
                <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', marginBottom:6 }}>Вес 14д · {weightHistory.length} точек</div>
                  <div style={{ display:'flex', gap:3, alignItems:'end', height:38 }}>
                    {weightHistory.slice(-14).map((p,i)=>{
                      const min=Math.min(...weightHistory.slice(-14).map(x=>x.kg)), max=Math.max(...weightHistory.slice(-14).map(x=>x.kg)), range=Math.max(1, max-min);
                      const h = 6 + ((p.kg - min)/range)*30;
                      return <div key={i} style={{ flex:1, height: h, borderRadius:3, background: i===weightHistory.slice(-14).length-1?'#eab308':'rgba(234,179,8,0.45)', border:'1px solid rgba(255,255,255,0.06)' }} title={`${p.date} ${p.kg}кг`} />
                    })}
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'rgba(255,255,255,0.35)', marginTop:4 }}><span>{weightHistory[0]?.date.slice(5)}</span><span>{weightHistory[weightHistory.length-1]?.date.slice(5)}</span></div>
                </div>
              )}
              <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'7px 10px' }}>
                💡 Hall density p*9400+(1-p)*1800 (Forbes p via BF) — 7700 фикс ошибка 45% у сухих. AT Trexler −10-15% при {'>'}3нед дефиците. DLW Westerterp ±12%.
              </div>
            </div>
          )}
          {mode==='neat' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background:'rgba(20,184,166,0.08)', border:'1px solid rgba(20,184,166,0.18)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#14b8a6' }}>NEAT сегодня · Levine 2002</div>
                  <div style={{ fontSize:22, fontWeight:900, color:'#14b8a6' }}>{neat.total}<span style={{ fontSize:10 }}>ккал</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>+{neat.standing} стоя +{neat.fidget>=0?'+':''}{neat.fidget} fidget +{neat.walking} ходьба</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff', lineHeight:1.5 }}>
                  {neat.note}<br/>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.55)' }}>NEAT объясняет плато сушки: +2ч стоя = +80ккал, +2000 шагов +80ккал. PAL 1.40-1.95 включает.</span>
                  <div style={{ marginTop:8, display:'flex', gap:6 }}>
                    <div style={{ flex:1, padding:6, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>стоя<br/><b style={{ color:'#14b8a6' }}>{neat.standing}</b></div>
                    <div style={{ flex:1, padding:6, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>fidget<br/><b style={{ color:'#14b8a6' }}>{neat.fidget}</b></div>
                    <div style={{ flex:1, padding:6, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>ходьба<br/><b style={{ color:'#14b8a6' }}>{neat.walking}</b></div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(20,184,166,0.06)', border:'1px solid rgba(20,184,166,0.12)', fontSize:9, color:'#fff' }}>Levine NEAT 350-700ккал диапазон — главный скрытый фактор TDEE. Добавь 1ч стоя + 3000 шагов = +160ккал без кардио.</div>
            </div>
          )}
          {mode==='at' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background: at.tier==='severe'?'rgba(239,68,68,0.08)': at.tier==='moderate'?'rgba(245,158,11,0.08)': at.tier==='mild'?'rgba(234,179,8,0.08)':'rgba(255,255,255,0.03)', border:`1px solid ${at.tier==='severe'?'rgba(239,68,68,0.18)': at.tier==='moderate'?'rgba(245,158,11,0.18)':'rgba(255,255,255,0.06)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color: at.tier==='none'?'rgba(255,255,255,0.55)': at.tier==='severe'?'#ef4444':'#f59e0b' }}>AT {at.tier} · Trexler 2014</div>
                  <div style={{ fontSize:22, fontWeight:900, color: at.tier==='severe'?'#ef4444': at.tier==='moderate'?'#f59e0b': at.tier==='mild'?'#eab308':'#fff' }}>−{at.atKcal}<span style={{ fontSize:10 }}>ккал</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>RMR pred {at.rmrPred} → meas ~{at.rmrMeasEst} · {at.note}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff', lineHeight:1.5 }}>
                  <b style={{ color:'#f97316' }}>Reverse Diet — MATADOR Byrne 2017</b><br/>+100ккал/7-14д до {reverseDiet[reverseDiet.length-1]?.kcal ?? kbju.nat.tdee}ккал<br/>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.55)' }}>После дефицита TDEE подавлен 10-15% 4-8нед. Резкий +500 = откат жира.</span>
                  <div style={{ marginTop:6, display:'flex', gap:4, flexWrap:'wrap' }}>
                    {reverseDiet.slice(0,6).map(s=>(
                      <span key={s.week} style={{ padding:'4px 8px', borderRadius:8, background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.18)', fontSize:9, color:'#f97316' }}>нед {s.week}: {s.kcal}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:9, color:'rgba(255,255,255,0.55)' }}>AT = RMR_измер − RMR_предск. Дефицит 500ккал {'>'}3нед → −80-120ккал (Trexler). Byrne MATADOR: интервальность сохраняет RMR лучше continuous.</div>
            </div>
          )}
          {mode==='thyroid' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background: thyroid.mult!==1?'rgba(139,92,246,0.08)':'rgba(255,255,255,0.03)', border:`1px solid ${thyroid.mult!==1?'rgba(139,92,246,0.18)':'rgba(255,255,255,0.06)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#8b5cf6' }}>Thyroid · Kim 2014 · FT4 12-22</div>
                  <div style={{ fontSize:22, fontWeight:900, color: thyroid.mult===1?'#fff': thyroid.mult<1?'#f59e0b':'#22c55e' }}>×{thyroid.mult.toFixed(2)}</div>
                  <div style={{ fontSize:9, color:'#fff' }}>{thyroid.note} · BMR {kbju.bmr} ({kbju.nat.method})</div>
                </div>
                <div style={{ padding:14, borderRadius:12, background: homa.zone==='ir'?'rgba(239,68,68,0.08)': homa.zone==='attention'?'rgba(245,158,11,0.08)': homa.zone==='optimal'?'rgba(34,197,94,0.08)':'rgba(255,255,255,0.03)', border:`1px solid ${homa.zone==='ir'?'rgba(239,68,68,0.18)': homa.zone==='attention'?'rgba(245,158,11,0.18)':'rgba(255,255,255,0.06)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color: homa.zone==='ir'?'#ef4444': homa.zone==='attention'?'#f59e0b':'#22c55e' }}>HOMA-IR · Wallace 2004</div>
                  <div style={{ fontSize:22, fontWeight:900, color: homa.zone==='ir'?'#ef4444': homa.zone==='attention'?'#f59e0b': homa.zone==='optimal'?'#22c55e':'#fff' }}>{homa.homa ?? '—'}</div>
                  <div style={{ fontSize:9, color:'#fff' }}>{homa.note}</div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
                <div style={{ padding:12, borderRadius:12, background: lipid && lipid.ldlDelta>10?'rgba(239,68,68,0.08)': lipid?'rgba(34,197,94,0.06)':'rgba(255,255,255,0.03)', border:`1px solid ${lipid && lipid.ldlDelta>10?'rgba(239,68,68,0.18)':'rgba(255,255,255,0.06)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color: lipid && lipid.ldlDelta>10?'#ef4444':'#22c55e' }}>Lipid · Mensink 2003</div>
                  <div style={{ fontSize:14, fontWeight:900, color: lipid && lipid.ldlDelta>10?'#ef4444':'#fff' }}>{lipid? `${lipid.ldlDelta>0?'+':''}${lipid.ldlDelta} LDL` : '—'}</div>
                  <div style={{ fontSize:8, color:'#fff' }}>{lipid?.note ?? 'Введи SFA и fiber в Pro-измерениях'}</div>
                </div>
                <div style={{ padding:12, borderRadius:12, background: (fli!=null && fli>=60)?'rgba(239,68,68,0.08)': (fli!=null && fli>=30)?'rgba(245,158,11,0.08)': fli!=null?'rgba(34,197,94,0.06)':'rgba(255,255,255,0.03)', border:`1px solid ${(fli!=null && fli>=60)?'rgba(239,68,68,0.18)': (fli!=null && fli>=30)?'rgba(245,158,11,0.18)':'rgba(255,255,255,0.06)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color: (fli!=null && fli>=60)?'#ef4444': (fli!=null && fli>=30)?'#f59e0b':'#22c55e' }}>FLI · Bedogni 2006 · {fli!=null ? `${fli}%` : '—'}</div>
                  <div style={{ fontSize:14, fontWeight:900, color: fli==null?'#fff': fli>=60?'#ef4444': fli>=30?'#f59e0b':'#22c55e' }}>{fli==null?'—': fli<30?'Нет стеатоза': fli>=60?'Стеатоз': 'Серая зона'}</div>
                  <div style={{ fontSize:8, color:'#fff' }}>{fli==null?'Введи waist/TG/GGT': fli<30?'Исключает NAFLD (&lt;30)': fli>=60?'Подтверждает ≥60':'30-60 серая зона'}</div>
                </div>
              </div>
              <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:8, padding:'4px 8px', borderRadius:8, background: psmf.risk?'rgba(239,68,68,0.10)':'rgba(34,197,94,0.08)', border:'1px solid rgba(255,255,255,0.06)', color: psmf.risk?'#ef4444':'#22c55e' }}>{psmf.note}</span>
                <span style={{ fontSize:8, padding:'4px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff' }}>Menstrual: {menstrual.note} {menstrualPhase==='luteal' && `+${menstrual.kg}кг воды`}</span>
              </div>
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.12)', fontSize:9, color:'#fff', lineHeight:1.4 }}>
                Thyroid Kim 1 pmol FT4 ≈ +2.2% BMR. HOMA-IR &lt;1.4 оптимально · Mensink 10г SFA +12 LDL / 10г fiber −5 · FLI Bedogni &lt;30 нет стеатоза &gt;60 стеатоз · PSMF Blackburn EA&lt;15 · Mens+ FLI требуют лабы.
              </div>
            </div>
          )}
          {mode==='sweat' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background: sweatTest ? 'rgba(6,182,214,0.08)':'rgba(255,255,255,0.03)', border:`1px solid ${sweatTest?'rgba(6,182,214,0.18)':'rgba(255,255,255,0.06)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#06b6d4' }}>Пот-тест — rate</div>
                  <div style={{ fontSize:22, fontWeight:900, color: sweatTest?'#06b6d4':'#fff' }}>{sweatTest? `${sweatTest.rateLPerH.toFixed(2)} л/ч`:'—'}</div>
                  <div style={{ fontSize:9, color:'#fff' }}>{sweatTest? `${sweatTest.totalLossMl}мл за ${sweatHours}ч · Na ${sweatTest.elect.sodiumMg}мг`:'(до-после+выпито)/часы'}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff', lineHeight:1.5 }}>
                  {sweatTest ? sweatTest.plan.note : 'Введи вес до/после + выпито. 1кг =1л пота. Тестируй в условиях гонки.'}<br/>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.55)' }}>Baker avg Na 900мг/л (200-1800 индивид.) · Акклиматизация 10-14д: объём +10-20% Na −40% (Periard).</span>
                  {sweatTest?.plan.hyponatremiaRisk && <span style={{ display:'block', color:'#ef4444', marginTop:4 }}>⚠ Гипонатриемия — добавь Na 500-700мг/л</span>}
                </div>
              </div>
              <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>Pre<br/><b style={{color:'#06b6d4'}}>{sweatTest?.plan.preMl ?? '—'}мл</b></div>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>During<br/><b style={{color:'#06b6d4'}}>{sweatTest?.plan.duringMlPerH ?? '—'}мл/ч</b></div>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>Post<br/><b style={{color:'#06b6d4'}}>{sweatTest?.plan.postMl ?? '—'}мл</b> · {sweatTest?.plan.bottles05 ?? '—'}×0.5л</div>
              </div>
              <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.55)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'7px 10px' }}>💡 Baker 2017 — главный источник потерь Na. Введи свой Na 900мг/л (измерь полоской). Влажность и жара уже учтены в воде выше.</div>
            </div>
          )}
          {mode==='mets' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background: mets.hasMetS?'rgba(239,68,68,0.08)':'rgba(34,197,94,0.08)', border:`1px solid ${mets.hasMetS?'rgba(239,68,68,0.18)':'rgba(34,197,94,0.18)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color: mets.hasMetS?'#ef4444':'#22c55e' }}>MetS ATP III · {mets.score}/5</div>
                  <div style={{ fontSize:18, fontWeight:900, color: mets.hasMetS?'#ef4444':'#22c55e' }}>{mets.hasMetS?'MetS':'Нет MetS'}</div>
                  <div style={{ fontSize:8, color:'#fff' }}>{mets.criteria.join(', ')||'критериев 0'} · {mets.note}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:9, color:'#fff', lineHeight:1.35 }}>
                  WHtR {whtr? whtr.toFixed(3):'—'} {whtr && whtr>=0.5? '⚠ ≥0.5':''} · ABSI {absi? absi.toFixed(3):'—'} · BAI {bai ?? '—'}<br/>TyG {tyg ?? '—'} {tyg && tyg>=8.8? '⚠ IR':''} · FIB-4 {fib4 ?? '—'} {fib4 && fib4>=1.3? (fib4>2.67?'⚠ высок':'⚠'):''} · QUICKI {quicki ?? '—'} {quicki && quicki<0.33?'⚠':''}<br/><span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>ATP III ≥3/5 = MetS. TyG =ln(TG×Gluc/2) ≥8.8 IR. FIB-4 &lt;1.30 низкий &gt;2.67 высокий.</span>
                </div>
              </div>
              <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>TyG<br/><b style={{color: tyg && tyg>=8.8?'#ef4444':'#22c55e'}}>{tyg ?? '—'}</b></div>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>FIB-4<br/><b style={{color: fib4 && fib4>2?'#ef4444': fib4 && fib4>1.3?'#f59e0b':'#22c55e'}}>{fib4 ?? '—'}</b> · APRI {apri ?? '—'}</div>
              </div>
              <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'7px 10px' }}>Введи waist/TG/HDL/АД/глюкозу — автоматический MetS. Для FIB-4 нужны AST/ALT/тромбоциты (из лаб). Связан с FLI выше.</div>
            </div>
          )}
          {mode==='break' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background: refeedNeed.needed?'rgba(245,158,11,0.08)':'rgba(255,255,255,0.03)', border:`1px solid ${refeedNeed.needed?'rgba(245,158,11,0.18)':'rgba(255,255,255,0.06)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color: refeedNeed.needed?'#f59e0b':'rgba(255,255,255,0.55)' }}>Refeed — лептин/T3</div>
                  <div style={{ fontSize:16, fontWeight:900, color: refeedNeed.needed?'#f59e0b':'#fff' }}>{refeedNeed.needed? `+${refeedNeed.carbBoostPct}% углей`:'Не нужен'}</div>
                  <div style={{ fontSize:8, color:'#fff' }}>{refeedNeed.note}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:9, color:'#fff', lineHeight:1.4 }}>
                  MATADOR (Byrne 2017): 2нед дефицит / 2нед maintenance чередование сохраняет RMR лучше continuous.<br/><span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>Diet break каждые 6нед ×2нед maintenance. Твоя цель {targetWeight? `${targetWeight}кг`:'—'} → {dietBreakPlan? `${dietBreakPlan.length}нед`:'—'}.</span>
                  {dietBreakPlan && <div style={{ marginTop:6, display:'flex', gap:4, flexWrap:'wrap' }}>{dietBreakPlan.slice(0,12).map((p,i)=><span key={i} style={{ padding:'3px 6px', borderRadius:6, background: p.phase==='deficit'?'rgba(239,68,68,0.10)':'rgba(34,197,94,0.10)', border:`1px solid ${p.phase==='deficit'?'rgba(239,68,68,0.18)':'rgba(34,197,94,0.18)'}`, fontSize:8, color: p.phase==='deficit'?'#f87171':'#22c55e' }}>{p.week}:{p.phase==='deficit'?'−':'○'}</span>)}</div>}
                </div>
              </div>
              <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>Недель в дефиците<br/><b style={{color:'#8b5cf6'}}>{weeksInDeficit ?? '—'}</b></div>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>Caffeine curve<br/><b style={{color:'#8b5cf6'}}>{caffeineCurve.remainingMg}мг</b> · HL 5ч · cut-off {caffeineCurve.sleepCutoffH}ч</div>
              </div>
              <div style={{ marginTop:6, fontSize:8, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'6px 8px' }}>{caffeineCurve.note} · Dulloo +3% TEF. Резкий +500 после дефицита = откат жира — reverse +100/7д.</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', textAlign:'center', marginTop:10, lineHeight:1.5 }}>
        Источники: Mifflin-St Jeor 1990 · Cunningham 1991 · Katch-McArdle · Owen 1986 · Ten Haaf 2014 · Harris-Benedict R 1984 · Henry Oxford 2005 · Livingston 2005 Frankfield · EFSA 2010 · IOM 2004 · Baker 2017 sweat · ISSN Helms 2014 · Morton 2018 · Schoenfeld/Aragon 2018 · Res 2012 pre-sleep · Navy Hodgdon 1984 · Jackson-Pollock 1978 · Durnin-Womersley 1974 · Kyle BIA 2004 · Kouri FFMI 1995 Helms 2023 26.2 · Gabbett ACWR 2016 · Hall 2011 density · Trexler 2014 AT · Byrne MATADOR 2017 · Levine NEAT 2002 · Kim thyroid 2014 · Loucks/Mountjoy EA 2014/2018 · Suter 1992 alcohol · ESC 2023 · ASA флеботомия · Westerterp TEF/DLW 2004/1999 · Pontzer 2021.<br/>Stress Load — эвристика E (не кортизол). AAS — experimental ⚠️ (Bhasin/Heber). EA &lt;30/25 — к врачу + DEXA. Не назначение.
      </div>
    </div>
  );
};

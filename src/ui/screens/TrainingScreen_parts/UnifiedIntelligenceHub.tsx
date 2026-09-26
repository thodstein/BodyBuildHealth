/**
 * UnifiedIntelligenceHub.tsx — единый инструмент «Интеллект тренировки».
 * Объединяет 4 ранее разрозненных блока без дублей:
 *  Нагрузка (sRPE/ACWR/Banister/monotony) → Восстановление (сон/HRV/Readiness/shouldTrain/deload) →
 *  Авторегуляция (PRI + pro-autoReg + RPE→вес + RIR-калибрация) → Прогноз (Хольт + what-if).
 *
 * Принципы:
 *  - один входной снапшот (readiness/fatigue/HRV/сон/стресс/DOMS/lastRPE/VLoss) → все движки читают его,
 *    ACWR считается один раз из единого sRPE-хранилища;
 *  - без дублей: ACWR/monotony/strain/Banister — только в «Нагрузке», readiness/recovery — только в
 *    «Восстановлении», PRI/вес/RIR — только в «Авторегуляции», Хольт/what-if — только в «Прогнозе»,
 *    сводные бейджи в шапке — линки, а не повторы формул;
 *  - один итоговый «Применить к планировщику» внизу (volume× + RIR+ + deload) вместо 7 разбросанных кнопок.
 *  - визуальная шлифовка: стеклянные карты, градиенты, sticky-навигация, мягкие переходы, 44px тачи.
 */
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { loadSRPESessions, saveSRPESession, clearSRPESessions, updateSRPESession, deleteSRPESession, importSRPEFromDiary, type SRPESession } from '../../../engines/pro/srpe-store';
import { buildIntelCsv, buildIntelHtml, buildIntelDeloadIcs } from '../../../engines/pro/intelligence-export.engine';
import { toDailyLoads, acuteChronicRatio, weeklyMonotony, fitnessFatigue, trainingLoadReport, sessionLoad, banisterForm, monotonyStreak, trafficLight, ACWR_DISCLAIMER, ACWR_ZONE_META, ACWR_WINDOW_NOTE, type DayLoad, type ACWRZone } from '../../../engines/pro/training-load.engine';
import { localIsoDate } from './diary-shared';
import { analyzeRecovery, shouldTrain } from '../../../engines/recovery-optimization.engine';
import { calculatePRI, getPRIThreshold } from '../../../engines/autoregulation.engine';
import { autoRegulate, loadForRPE, rpeFromLoad, shouldTrainToday } from '../../../engines/pro/autoregulation-pro.engine';
import { generateReadinessForecast, runWhatIf } from '../../../engines/predictive.engine';
import { loadForecast, performanceTrajectory, TRAJECTORY_NOTE } from '../../../engines/pro/intelligence-load-forecast.engine';
import { cmjScreen, loadCmj, saveCmj, clearCmj, CMJ_SCREENING_NOTE, CMJ_NON_BLOCKING_NOTE, type CmjEntry } from '../../../engines/pro/intelligence-cmj.engine';
import { wellnessReport, loadWellness, saveWellness, clearWellness, WELLNESS_PROTOCOL_NOTE, type WellnessEntry } from '../../../engines/pro/intelligence-wellness.engine';
import {
  weeklyRollup, loadIntelHistory, saveIntelDecision, clearIntelHistory,
  buildCoachReportHtml, buildCoachReportCsv, buildCoachDigestText,
  type IntelDecision, type CoachSection, type CoachReportInput,
} from '../../../engines/pro/intelligence-coach-report.engine';
import { isCapacitorNative } from '../../../core/app-platform';
import { saveTextFile, shareText } from '../../../core/native-bridge';
import { loadReadinessHistory, appendReadinessToday } from './readiness-history';
import { getCalibrationStats } from '../../../engines/rir-calibration.engine';
import { addDaysIso } from '../../../engines/lms/cardio-date-utils.engine';
import { buildHrvBaseline, appendHrvReading, hrvReadiness, hrvRatioToBaseline, HRV_PROTOCOL_NOTE } from '../../../engines/pro/hrv-baseline.engine';
import { getProfile } from '../../../core/profile-manager';
import { getExerciseById } from '../../../core/exercise-catalog';
import { loadAltFromSessions, SACWR_METHOD_NOTE } from '../../../engines/pro/intelligence-load-alt.engine';
import { muscleLoadReport, planVsActualPerMuscle, PER_MUSCLE_NOTE, type MuscleSetEntry } from '../../../engines/pro/intelligence-permuscle.engine';
import { muscleLabel } from './bb-labels';
import { applyToPlanner } from './planner-bridge';
import { generateBBRecommendations, bbRecSummary } from '../../../engines/bb/bb-training-recommendations.engine';
import { weeklySetsByGroup } from '../../../engines/training-recommendations.engine';
import { MetricCard, ExpandableCard, PopupNumber, PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';

const ACCENT = '#00e68a';
const DIM = '#fff';
const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.42)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', transition:'all 0.18s ease' };
const CARD: React.CSSProperties = { ...GLASS, borderRadius: 14, padding: 12, marginBottom: 10, transition:'all 0.18s ease' };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: ACCENT, margin: '0 0 6px', letterSpacing: 0.2 };
const SMALL: React.CSSProperties = { fontSize: 11, color: '#fff', lineHeight: 1.45 };
const HINT: React.CSSProperties = { ...SMALL, color: '#fff' };

/** Зоны ACWR — производные от канона движка (`ACWR_ZONE_META`), а не дубль порогов в UI.
 *  `short` — только короткая подпись для плашек. */
const ZONE_META: Record<ACWRZone, { label: string; color: string; short: string; hint: string }> = {
  undertrained: { ...ACWR_ZONE_META.undertrained, short: 'недо' },
  optimal: { ...ACWR_ZONE_META.optimal, short: 'ок' },
  caution: { ...ACWR_ZONE_META.caution, short: 'осторожно' },
  dangerous: { ...ACWR_ZONE_META.dangerous, short: 'риск' },
};

const READINESS_COLOR = (v: number) => v >= 75 ? '#22c55e' : v >= 55 ? '#84cc16' : v >= 35 ? '#eab308' : '#ef4444';
const RECOVERY_LABEL_COLOR = (l: string) => l === 'Отлично' ? '#22c55e' : l === 'Хорошо' ? '#84cc16' : l === 'Средне' ? '#eab308' : l === 'Низко' ? '#f97316' : '#ef4444';

/** Единая точка чтения сохранённого ББ-плана: те же ключи, что и в «Рекомендациях» и в E5.
 *  Формы: `he_bb_plan_saved` = {plan,date} (или legacy {weeks}), `he_bb_plans[i].plan`, `he_bb_session`. */
function loadSavedBBPlan(): any | null {
  try {
    const a = JSON.parse(localStorage.getItem('he_bb_plan_saved') || 'null');
    if (a?.plan?.weeks) return a.plan;
    if (a?.weeks) return a; // legacy
    const b = JSON.parse(localStorage.getItem('he_bb_plans') || '[]');
    if (Array.isArray(b)) {
      const withPlan = b.find(x => x?.plan?.weeks) || b.find(x => x?.weeks);
      if (withPlan) return withPlan.plan || withPlan;
    }
    const c = JSON.parse(localStorage.getItem('he_bb_session') || 'null');
    if (c?.builtBb?.weeks) return c.builtBb;
    if (c?.plan?.weeks) return c.plan;
  } catch { /* ignore */ }
  return null;
}

type SectionId = 'load' | 'recovery' | 'autoreg' | 'forecast' | 'recommendations';
const SECTIONS: { id: SectionId; label: string; icon: string; accent: string; desc: string }[] = [
  { id: 'load', label: 'Нагрузка', icon: '📊', accent: '#3b82f6', desc: 'ACWR/Banister/монотонность — факты нагрузки из sRPE' },
  { id: 'recovery', label: 'Восстановление', icon: '🔋', accent: '#22c55e', desc: 'Сон/HRV/готовность → вердикт train/deload/supercompensation' },
  { id: 'autoreg', label: 'Авторегуляция', icon: '⚙️', accent: '#a855f7', desc: 'PRI + pro-регуляция веса/объёма/RIR + RPE↔вес + калибрация' },
  { id: 'forecast', label: 'Прогноз', icon: '🔮', accent: '#f59e0b', desc: 'Хольт-прогноз готовности + сценарий «что-если»' },
  { id: 'recommendations', label: 'Рекомендации', icon: '💡', accent: '#8b5cf6', desc: 'ББ-аудит: план/PED/питание/сапплементы/выполнение' },
];

function useStickySection(active: SectionId, setActive: (s: SectionId) => void) {
  const refs = useRef<Record<string, HTMLElement | null>>({} as any);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting).sort((a,b)=> b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) {
        const id = visible.target.id.replace('sec-','') as SectionId;
        if ((SECTIONS as any).some((s: any)=> s.id===id)) setActive(id);
      }
    }, { rootMargin: '-18% 0px -68% 0px', threshold: [0,0.2,0.6,1] });
    SECTIONS.forEach(s => { const el = refs.current[s.id]; if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [setActive]);
  return refs;
}

const SNAP_KEY = 'he_unified_intel_snapshot_v1'; // legacy, только чтение для миграции
const SNAP_KEY_V2 = 'he_unified_intel_snapshot_v2'; // P5: + goal/e1RM/RPE/топ-сет/what-if
export const UnifiedIntelligenceHub: React.FC = () => {
  // ——— единый снапшот ———
  const [readiness, setReadiness] = useState(72);
  const [fatigue, setFatigue] = useState(28);
  const [sleepHours, setSleepHours] = useState(7.5);
  const [sleepQuality, setSleepQuality] = useState(4);
  const [rmssd, setRmssd] = useState(55);
  const [restingHR, setRestingHR] = useState(58);
  const [stress, setStress] = useState(4);
  const [doms, setDoms] =useState(2);
  const [trainDays, setTrainDays] = useState(4);
  const [phase, setPhase] = useState<'accumulation'|'intensification'|'peaking'|'deload'>('accumulation');
  const [lastRPE, setLastRPE] = useState(7);
  const [vLoss, setVLoss] = useState(12);
  const [e1rm, setE1rm] = useState(120);
  const [rpe, setRpe] = useState(8);
  const [repCnt, setRepCnt] = useState(5);
  const [topPct, setTopPct] = useState(0.85);
  const [planRIR, setPlanRIR] = useState(2);
  const [goal, setGoal] = useState<'strength' | 'hypertrophy'>('hypertrophy');
  const [calDelta, setCalDelta] = useState(0);
  const [sleepDelta, setSleepDelta] = useState(0);
  const [aasMult, setAasMult] = useState(1);
  const [snapSavedAt, setSnapSavedAt] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SRPESession[]>(() => loadSRPESessions());
  const [sDate, setSDate] = useState(localIsoDate());
  const [sRPE, setSRPE] = useState(7);
  const [sDur, setSDur] = useState(60);
  // E7: CMJ-скрининг (журнал замеров) + wellness-опросник (5 пунктов, 1–5)
  const [cmjList, setCmjList] = useState<CmjEntry[]>(() => loadCmj());
  const [cmjHeight, setCmjHeight] = useState(35);
  const [cmjFlight, setCmjFlight] = useState(320);
  const [cmjBw, setCmjBw] = useState(80);
  const [wellList, setWellList] = useState<WellnessEntry[]>(() => loadWellness());
  const [wSleep, setWSleep] = useState(4);
  const [wSore, setWSore] = useState(2);
  const [wMood, setWMood] = useState(4);
  const [wEnergy, setWEnergy] = useState(4);
  const [wStress, setWStress] = useState(2);
  const [wIllness, setWIllness] = useState(false);
  // P5: точечная правка строки журнала
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editRpe, setEditRpe] = useState(7);
  const [editDur, setEditDur] = useState(60);
  const [active, setActive] = useState<SectionId>('load');
  const refs = useStickySection(active, setActive);
  // E10: гард на scrollIntoView — в окружениях без этого API (jsdom/старые WebView)
  // клик по навигационной плитке не должен ронять обработчик.
  const scrollTo = (id: SectionId) => {
    const el = document.getElementById('sec-' + id);
    if (!el) return;
    try {
      if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch { /* нет smooth/не поддерживается — просто остаёмся на месте */ }
  };

  // ── Единый авто-вход из живых данных приложения (профиль + дневник) ──
  // Раньше автозаполнялись только 7 полей, а stress/doms/e1RM/lastRPE/vLoss/phase/topPct/planRIR/aasMult
  // вводились руками при наличии данных в профиле и дневнике. Ничего не выдумываем: берём только факт.
  const autofillFromProfile = useCallback((opts?: { keepManual?: boolean }) => {
    const applied: string[] = [];
    try {
      const p: any = getProfile()?.settings || {};
      const n = (v: any)=> (typeof v === 'number' && Number.isFinite(v)) ? v : null;
      if (n(p.lifestyle?.sleepHours) != null) { setSleepHours(p.lifestyle.sleepHours); applied.push('сон'); }
      if (p.lifestyle?.sleepQuality) { const m: any = { good: 5, fair: 3, poor: 1 }; setSleepQuality(m[p.lifestyle.sleepQuality] ?? 3); applied.push('качество сна'); }
      if (n(p.lifestyle?.morningHRV)) { setRmssd(p.lifestyle.morningHRV); applied.push('HRV'); }
      if (n(p.lifestyle?.restingHR)) { setRestingHR(p.lifestyle.restingHR); applied.push('пульс покоя'); }
      if (n(p.lifestyle?.fatigueLevel) != null) { setFatigue(Math.min(100, Math.max(0, p.lifestyle.fatigueLevel * 10))); applied.push('усталость'); }
      if (n(p.lifestyle?.stressLevel) != null) { setStress(Math.min(10, Math.max(0, p.lifestyle.stressLevel))); applied.push('стресс'); }
      if (n(p.training?.recovery) != null) { setReadiness(Math.min(100, Math.max(0, p.training.recovery * 10))); applied.push('готовность'); }
      if (n(p.training?.doms) != null) { setDoms(Math.min(10, Math.max(0, p.training.doms))); applied.push('DOMS'); }
      if (n(p.training?.daysPerWeek)) { setTrainDays(p.training.daysPerWeek); applied.push('дней/нед'); }
      // фарма → множитель нагрузки (адаптация, без выдуманной дозы)
      const ph: any = p.pharma || {};
      const onCourse = ph.phase && ph.phase !== 'baseline' && ph.phase !== 'off';
      if (onCourse) { setAasMult(1.15); applied.push('курс (адаптация 1.15×)'); }
      // личные рекорды → e1RM, если не задано вручную
      const pms = [p.training?.pmBench, p.training?.pmSquat, p.training?.pmDeadlift].filter((v: any)=> n(v) && v > 0) as number[];
      if (pms.length) { setE1rm(Math.round(pms.reduce((a, b)=> a + b, 0) / pms.length)); applied.push('e1RM (среднее ПМ)'); }
    } catch { /* ignore */ }
    try {
      // дневник: последняя сессия → lastRPE, потеря скорости (velocityMs) → vLoss
      const raw = JSON.parse(localStorage.getItem('he_workout_log_v2') || '[]');
      if (Array.isArray(raw) && raw.length) {
        const last = [...raw].sort((a: any, b: any)=> String(b?.date || '').localeCompare(String(a?.date || '')))[0];
        const sets = Array.isArray(last?.exercises) ? last.exercises.flatMap((e: any)=> Array.isArray(e?.sets) ? e.sets : []) : [];
        const rpes = sets.map((s: any)=> Number(s?.rpe)).filter((v: number)=> Number.isFinite(v) && v > 0);
        if (rpes.length) { setLastRPE(Math.round(rpes.reduce((a: number, b: number)=> a + b, 0) / rpes.length)); applied.push('RPE последней'); }
        const withV = sets.filter((s: any)=> Number.isFinite(Number(s?.velocityMs)) && Number(s.velocityMs) > 0 && Number.isFinite(Number(s?.rpeStart)) && Number(s.rpeStart) > 0);
        if (withV.length) {
          const loss = withV.map((s: any)=> (1 - Number(s.velocityMs) / Number(s.rpeStart)) * 100).filter((v: number)=> Number.isFinite(v));
          if (loss.length) { setVLoss(Math.round(Math.max(0, loss.reduce((a: number, b: number)=> a + b, 0) / loss.length))); applied.push('потеря скорости'); }
        }
      }
    } catch { /* ignore */ }
    const t = (window as any).showToast;
    if (typeof t === 'function') t(applied.length ? `📋 Подтянуто из профиля/дневника: ${applied.join(', ')}` : '📋 В профиле и дневнике нет данных для автозаполнения', applied.length ? 'success' : 'info');
  }, []);

  // autofill once: снапшот v2 → v1-миграция → профиль/дневник → дефолт (снапшот приоритетнее, чтобы не терять ручные правки)
  useEffect(() => {
    const applySnap = (s: any) => {
      if (typeof s.readiness === 'number') setReadiness(s.readiness);
      if (typeof s.fatigue === 'number') setFatigue(s.fatigue);
      if (typeof s.sleepHours === 'number') setSleepHours(s.sleepHours);
      if (typeof s.sleepQuality === 'number') setSleepQuality(s.sleepQuality);
      if (typeof s.rmssd === 'number') setRmssd(s.rmssd);
      if (typeof s.restingHR === 'number') setRestingHR(s.restingHR);
      if (typeof s.stress === 'number') setStress(s.stress);
      if (typeof s.doms === 'number') setDoms(s.doms);
      if (typeof s.trainDays === 'number') setTrainDays(s.trainDays);
      if (s.phase) setPhase(s.phase);
      if (typeof s.lastRPE === 'number') setLastRPE(s.lastRPE);
      if (typeof s.vLoss === 'number') setVLoss(s.vLoss);
      if (s.goal === 'strength' || s.goal === 'hypertrophy') setGoal(s.goal);
      if (typeof s.e1rm === 'number') setE1rm(s.e1rm);
      if (typeof s.rpe === 'number') setRpe(s.rpe);
      if (typeof s.repCnt === 'number') setRepCnt(s.repCnt);
      if (typeof s.topPct === 'number') setTopPct(s.topPct);
      if (typeof s.planRIR === 'number') setPlanRIR(s.planRIR);
      if (typeof s.calDelta === 'number') setCalDelta(s.calDelta);
      if (typeof s.sleepDelta === 'number') setSleepDelta(s.sleepDelta);
      if (typeof s.aasMult === 'number') setAasMult(s.aasMult);
      if (typeof s.savedAt === 'string') setSnapSavedAt(s.savedAt);
    };
    try {
      const raw2 = localStorage.getItem(SNAP_KEY_V2);
      if (raw2) { applySnap(JSON.parse(raw2)); return; }
      const raw = localStorage.getItem(SNAP_KEY);
      if (raw) {
        applySnap(JSON.parse(raw));
        try { localStorage.removeItem(SNAP_KEY); } catch { /* ignore */ }
        return;
      }
    } catch { /* ignore */ }
    autofillFromProfile();
  }, [autofillFromProfile]);
  // persist снапшота v2 (с меткой времени — иначе «данные устарели» невозможно определить)
  useEffect(() => {
    try {
      const snap = { readiness, fatigue, sleepHours, sleepQuality, rmssd, restingHR, stress, doms, trainDays, phase, lastRPE, vLoss, goal, e1rm, rpe, repCnt, topPct, planRIR, calDelta, sleepDelta, aasMult, savedAt: new Date().toISOString(), v: 2 };
      localStorage.setItem(SNAP_KEY_V2, JSON.stringify(snap));
    } catch { /* ignore */ }
  }, [readiness, fatigue, sleepHours, sleepQuality, rmssd, restingHR, stress, doms, trainDays, phase, lastRPE, vLoss, goal, e1rm, rpe, repCnt, topPct, planRIR, calDelta, sleepDelta, aasMult]);
  /** Снапшот старше суток — показываем честный бейдж «данные за вчера», а не молчим. */
  const snapStaleDays = useMemo(()=> {
    if (!snapSavedAt) return 0;
    const t = Date.parse(snapSavedAt);
    if (!Number.isFinite(t)) return 0;
    return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
  }, [snapSavedAt]);

  const reload = useCallback(()=> setSessions(loadSRPESessions()), []);
  /** Сброс входов к дефолту + очистка снимка (в т.ч. метки времени — иначе stale-бейдж пережил бы сброс). */
  const resetSnapshot = useCallback(()=> {
    try { localStorage.removeItem(SNAP_KEY_V2); localStorage.removeItem(SNAP_KEY); } catch { /* ignore */ }
    setReadiness(72); setFatigue(28); setSleepHours(7.5); setSleepQuality(4); setRmssd(55); setRestingHR(58);
    setStress(4); setDoms(2); setTrainDays(4); setPhase('accumulation'); setLastRPE(7); setVLoss(12);
    setSnapSavedAt(new Date().toISOString());
    const t=(window as any).showToast; if(typeof t==='function') t('↩ Входы сброшены к дефолту','info');
  }, []);
  // P5: импорт из дневника тренировок (без двойного ввода; дедуп внутри стора).
  // Фактическая форма `he_workout_log_v2` (workout-logger.engine.ts): `durationMin` (НЕ `duration`),
  // RPE лежит в `exercises[].sets[].rpe` (поля `overallRPE` в типе нет) — прежний маппинг был мёртвым,
  // кнопка всегда отвечала «новых тренировок нет».
  const importFromDiary = ()=> {
    try {
      const raw = JSON.parse(localStorage.getItem('he_workout_log_v2') || '[]');
      const list: any[] = Array.isArray(raw) ? raw : [];
      const items = list.map((w: any)=> {
        const sets = Array.isArray(w?.exercises) ? w.exercises.flatMap((e: any)=> Array.isArray(e?.sets) ? e.sets : []) : [];
        const rpes = sets.map((s: any)=> Number(s?.rpe)).filter((v: number)=> Number.isFinite(v) && v > 0);
        const sessionRpe = Number(w?.overallRPE) > 0 ? Number(w.overallRPE)
          : (rpes.length ? rpes.reduce((a: number, b: number)=> a + b, 0) / rpes.length : 0);
        const duration = Number.isFinite(Number(w?.durationMin)) ? Number(w.durationMin) : Number(w?.duration);
        return { date: w?.date, overallRPE: sessionRpe, durationMin: duration };
      });
      const { added } = importSRPEFromDiary(items);
      reload();
      const t = (window as any).showToast;
      if (typeof t === 'function') t(added > 0 ? `📥 Импортировано тренировок: ${added}` : '📥 Новых тренировок с RPE в дневнике нет', added > 0 ? 'success' : 'info');
    } catch { /* ignore */ }
  };
  const addSession = ()=> { saveSRPESession({ date: sDate, sRPE, durationMin: sDur }); reload(); };
  const clearAll = ()=> { clearSRPESessions(); reload(); };

  // ——— вычисляем всё один раз ———
  // Тик суток: окна нагрузки (7/28д, монотонность) считаются от СЕГОДНЯ, а не от последней записи —
  // иначе после простоя «текущая неделя» была бы неделей месячной давности. Плюс реакция на смену даты в открытом приложении.
  const [dayTick, setDayTick] = useState(0);
  const today = useMemo(()=> localIsoDate(), [dayTick]);
  const todayRef = useRef(today);
  todayRef.current = today;
  useEffect(()=> {
    const id = setInterval(()=> {
      if (localIsoDate() !== todayRef.current) setDayTick(t => t + 1);
    }, 60_000);
    return ()=> clearInterval(id);
  }, [today]);

  const dailyLoads: DayLoad[] = useMemo(()=> toDailyLoads(sessions), [sessions]);
  const acwr = useMemo(()=> acuteChronicRatio(dailyLoads, today, 7, 28, { method: 'ewma_uncoupled' }), [dailyLoads, today]);
  const monotony = useMemo(()=> weeklyMonotony(dailyLoads, today), [dailyLoads, today]);
  // D2: честные «2 недели подряд» вместо одной текущей
  const monoStreak = useMemo(()=> monotonyStreak(dailyLoads, 2, today), [dailyLoads, today]);
  // Отдельный счётчик ровных недель: monotony у SD=0 «проваливается» в 2, поэтому monotonyStreak
  // уже помечает uniform-недели как монотонные — здесь считаем именно длину серии ровных недель.
  const uniformStreak = useMemo(()=> monotonyStreak(dailyLoads, 3, today).uniformWeeks, [dailyLoads, today]);
  const banister = useMemo(()=> fitnessFatigue(dailyLoads), [dailyLoads]);
  // P6: форма z-трендом (сырые AU — только в тултипах)
  const form = useMemo(()=> banisterForm(dailyLoads), [dailyLoads]);
  const report = useMemo(()=> trainingLoadReport(sessions, today, { method: 'ewma_uncoupled' }), [sessions, today]);

  // ——— E5: альтернативные метрики нагрузки (диффы 1/7/28д + sACWR EWMA + описание объёма) ———
  // НЕ заменяют канон ACWR: это отдельный инструмент со своей оговоркой (единого «правильного»
  // ACWR в литературе нет). Пусто без sRPE-сессий — блок не рисуется вовсе.
  const loadAlt = useMemo(()=> {
    if (sessions.length === 0) return null;
    try { return loadAltFromSessions(sessions as any, today, acwr.ratio || undefined); } catch { return null; }
  }, [sessions, today, acwr.ratio]);

  // ——— E5: нагрузка по мышцам из РЕАЛЬНОГО дневника (`he_workout_log_v2`) ———
  // Атрибуция мышцы — каталог `getExerciseById` (тот же источник, что у weeklySetsByGroup),
  // иначе «перекос» считался бы по подмножеству упражнений и выглядел правдоподобнее, чем есть.
  // Покрытие атрибуции показывается честно; план сравнивается по средней неделе плана
  // (у плана нет дат — «текущую неделю» выдумывать нельзя).
  // ——— E8: журнал решений + отчёт тренеру (АПК: печать уходит файлом в Documents + Share) ———
  const [history, setHistory] = useState<IntelDecision[]>(() => loadIntelHistory());
  const toastIntel = (msg: string, kind: 'success' | 'warning' | 'info' = 'info') => {
    const t = (window as any).showToast;
    if (typeof t === 'function') t(msg, kind);
  };
  const printIntelHtml = (html: string) => {
    if (isCapacitorNative()) {
      saveTextFile('intellect-coach-report.html', html)
        .then(ok => toastIntel(ok ? '📄 Отчёт сохранён в файлы и открыт Share' : '⚠ Не удалось сохранить отчёт', ok ? 'success' : 'warning'))
        .catch(() => toastIntel('⚠ Не удалось сохранить отчёт', 'warning'));
      return;
    }
    try {
      const w = window.open('', '_blank', 'width=820,height=900');
      if (!w) { toastIntel('⚠ Всплывающие окна заблокированы', 'warning'); return; }
      w.document.write(html); w.document.close(); w.focus();
      window.setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 250);
    } catch { toastIntel('⚠ Печать недоступна', 'warning'); }
  };
  const downloadIntelFile = (text: string, filename: string) => {
    if (isCapacitorNative()) {
      saveTextFile(filename, text)
        .then(ok => toastIntel(ok ? `📤 ${filename} — через Share` : '⚠ Не удалось сохранить файл', ok ? 'success' : 'warning'))
        .catch(() => toastIntel('⚠ Не удалось сохранить файл', 'warning'));
      return;
    }
    try {
      const mime = filename.endsWith('.csv') ? 'text/csv;charset=utf-8' : 'text/html;charset=utf-8';
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { toastIntel('⚠ Скачивание недоступно', 'warning'); }
  };
  const shareIntelText = (title: string, text: string) => {
    if (isCapacitorNative()) {
      shareText({ title, text })
        .then(ok => { if (!ok) toastIntel('⚠ Share недоступен', 'warning'); })
        .catch(() => toastIntel('⚠ Share недоступен', 'warning'));
      return;
    }
    // clipboard может отсутствовать (старый WebView/небезопасный контекст) —Optional chaining
    // без проверки результата дал бы «undefined.then» → TypeError. Поэтому проверяем промис.
    const copying = navigator.clipboard?.writeText(text);
    if (copying && typeof copying.then === 'function') {
      copying.then(() => toastIntel('📋 Дайджест скопирован', 'success'))
        .catch(() => toastIntel('⚠ Не удалось скопировать', 'warning'));
    } else toastIntel('⚠ Копирование недоступно (clipboard)', 'warning');
  };

  /** 5 секций хаба единым списком — экспорт и отчёт читают один и тот же источник.
   *  Объявлена функцией (не const-memo) специально: тело читает мемо, которые объявлены
   *  НИЖЕ по коду, а вызывается уже после них — иначе TDZ на первом рендере. */
  function buildCoachReport(): CoachReportInput {
    const sec = (id: CoachSection['id'], title: string, lines: { label: string; value: string }[]): CoachSection => ({ id, title, lines });
    const sections: CoachSection[] = [
      sec('load', '📊 Нагрузка', [
        { label: 'ACWR', value: `${acwr.ratio.toFixed(2)} · ${ZONE_META[acwr.zone].label}` },
        { label: 'Острая / хроническая', value: `${Math.round(acwr.acute)} / ${Math.round(acwr.chronic)} AU/день` },
        { label: 'Монотонность', value: `${report.monotony.monotony}${monoStreak.uniform ? ' · ровная неделя' : ''}` },
        { label: 'Серия монотонных недель', value: monoStreak.sustainedHigh ? '2+ недели подряд выше 2 (риск-сигнал)' : `не повторяется (текущая ${monoStreak.current})` },
        { label: 'Ровных недель подряд', value: uniformStreak > 0 ? `${uniformStreak} (SD=0 — однообразие)` : 'нет' },
        { label: 'Будильник (fitness−fatigue)', value: banister.current ? `${Math.round(banister.current.fitness)} / ${Math.round(banister.current.fatigue)} AU` : 'нет данных' },
        ...(loadAlt ? [
          { label: 'sACWR (альтернатива)', value: loadAlt.sacwr ? `${loadAlt.sacwr.ratio} (метод EWMA)` : '—' },
          { label: 'Классификация нагрузки', value: loadAlt.classification?.label || '—' },
        ] : [{ label: 'Альтернативная нагрузка', value: 'не считается (нужно ≥2 замера)' }]),
        { label: 'Мышечная нагрузка', value: muscleData?.empty || !muscleData?.report
            ? 'нет данных дневника'
            : `${Math.round((muscleData.coverage || 0) * 100)}% сетов отнесено · перекос: ${muscleData.report.imbalance.label} (${muscleData.report.imbalance.score})` },
        { label: 'CMJ-скрининг', value: cmj ? `${cmj.zone === 'no_data' ? 'мало замеров' : cmj.zone}${cmj.current?.dropFromBestPct != null ? ` · просадка ${cmj.current.dropFromBestPct}%` : ''}` : 'замеров нет' },
      ]),
      sec('recovery', '💤 Восстановление', [
        { label: 'Готовность / усталость', value: `${readiness} / ${fatigue}` },
        { label: 'Сон', value: `${sleepHours}ч · качество ${sleepQuality}/5` },
        { label: 'HRV ratio', value: `${hrvRatio.toFixed(2)}${hrvBase ? ' (к своей базе)' : ' (базы нет — ориентир)'}` },
        { label: 'Восстановление', value: recoveryOut ? `${recoveryOut.readinessLabel} · окно ${recoveryOut.supercompensationHours}ч` : 'не считается' },
        { label: 'Тренироваться сегодня', value: verdict == null ? 'вердикта нет (нужны данные восстановления)' : verdict.train ? 'да' : 'нет' },
        { label: 'Wellness-светофор', value: wellness ? `${wellness.zone} · сигналов ${wellness.alarmSignals} из ${wellness.itemsFilled}` : 'нет отметок' },
      ]),
      sec('autoreg', '🎛 Авторегуляция', [
        { label: 'Объём', value: `×${autoReg.volumeMultiplier}` },
        { label: 'RIR', value: `+${autoReg.rirShift}` },
        { label: 'Deload', value: autoReg.deload ? 'да' : 'нет' },
        { label: 'Traffic-light', value: trafficLight(hrvRatio, acwr.ratio, autoReg.rirShift >= 1 ? 1 : 0) },
        { label: 'Сигналы', value: report.recommendations.length ? report.recommendations.join(' · ') : 'нет' },
      ]),
      sec('forecast', '🔮 Прогноз', [
        { label: 'Сглаженный уровень (EWMA 7д)', value: loadFc ? `${Math.round(loadFc.level)} AU/день · ${loadFc.guidance}` : 'нет данных sRPE' },
        { label: 'Разброс недели', value: loadFc ? `${Math.round(loadFc.weeklyBand[0])}…${Math.round(loadFc.weeklyBand[1])} AU` : '—' },
        { label: 'Дней подряд с нагрузкой', value: loadFc ? `${loadFc.consecutiveDays}${loadFc.suggestedCap != null ? ` · мягкий потолок ${Math.round(loadFc.suggestedCap)} AU` : ''}` : '—' },
        { label: 'Траектория', value: trajectory.length ? trajectory.map(s => `${s.label}: ${s.current == null ? '—' : s.current} ${s.unit}${s.changePct == null ? '' : ` (${s.changePct > 0 ? '+' : ''}${s.changePct}%/нед)`}`).join(' · ') : 'нет измеримых величин' },
        { label: 'What-if', value: whatIf ? `готовность ${whatIf.readinessDelta > 0 ? '+' : ''}${whatIf.readinessDelta} · риск ${whatIf.riskDelta > 0 ? '+' : ''}${whatIf.riskDelta} · ${whatIf.note || 'сценарий'}` : 'нет сценария (нужны данные восстановления)' },
      ]),
      sec('recommendations', '🧭 Рекомендации', [
        { label: 'Хаб', value: report.recommendations.length ? report.recommendations.join(' · ') : 'нет' },
        { label: 'Дельта-решение', value: (autoReg.deload || !!recoveryOut?.deloadRecommended) ? 'deload-неделя' : 'коррекция объёма/RIR' },
      ]),
    ];
    let bbRecs: string[] = [];
    try {
      const plan = loadSavedBBPlan();
      if (plan) {
        const recs = generateBBRecommendations({ plan, readiness: { lastRecovery: readiness } });
        bbRecs = recs.flatMap(sec => (sec.items || []).map(it => `${sec.title}: ${it.text}`));
      }
    } catch { /* ББ-аудит не собрался — раздел останется пустым и скажет об этом */ }
    const rollup = weeklyRollup({
      dailyLoads: report.dailyLoads,
      sessions,
      readinessHistory: loadReadinessHistory(),
      cmj: cmjList,
      wellness: wellList,
      autoRegSignals: report.recommendations,
      decisions: history,
      referenceDate: today,
    });
    return {
      generatedAt: `${today} ${new Date().toTimeString().slice(0, 5)}`,
      sections,
      rollup,
      bbRecommendations: bbRecs,
    };
  }

  const recordDecision = (applied: boolean) => {
    const isDeload = autoReg.deload || !!recoveryOut?.deloadRecommended;
    setHistory(saveIntelDecision({
      date: today,
      kind: isDeload ? 'deload' : 'pri',
      applied,
      label: applied ? (isDeload ? 'Deload-неделя применена' : 'Коррекция объёма/RIR применена') : 'Рекомендация отклонена',
      detail: `ACWR ${acwr.ratio.toFixed(2)} · объём ×${autoReg.volumeMultiplier} · RIR +${autoReg.rirShift}`,
    }));
    toastIntel(applied ? '✅ Решение записано в журнал недели' : '⛔ Отказ записан в журнал недели (в планировщик ничего не ушло)', applied ? 'success' : 'info');
  };

  // ——— E7: CMJ-скрининг усталости + wellness-светофор (оба НЕ блокируют тренировку) ———
  const cmj = useMemo(()=> { try { return cmjScreen(cmjList, today); } catch { return null; } }, [cmjList, today]);
  const wellness = useMemo(()=> { try { return wellnessReport(wellList, today); } catch { return null; } }, [wellList, today]);
  const addCmj = ()=> { setCmjList(saveCmj({ date: sDate, heightCm: cmjHeight, flightTimeMs: cmjFlight, bodyweightKg: cmjBw })); reload(); };
  const addWellness = ()=> {
    setWellList(saveWellness({ date: sDate, sleepQuality: wSleep, soreness: wSore, mood: wMood, energy: wEnergy, stressLevel: wStress, illness: wIllness }));
    reload();
  };

  const muscleData = useMemo(()=> {    try {
      const raw = JSON.parse(localStorage.getItem('he_workout_log_v2') || '[]');
      const list: any[] = Array.isArray(raw) ? raw : [];
      const entries: MuscleSetEntry[] = [];
      let diarySets = 0, attributedSets = 0;
      for (const w of list) {
        const date = String(w?.date || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        for (const ex of (Array.isArray(w?.exercises) ? w.exercises : [])) {
          const sets = Array.isArray(ex?.sets) ? ex.sets : [];
          if (!sets.length) continue;
          diarySets += sets.length;
          let catGroup = '';
          try { catGroup = String((getExerciseById(ex?.exerciseId) as any)?.group || ''); } catch { catGroup = ''; }
          const muscle = (catGroup || String(ex?.muscleGroup || '')).trim();
          if (!muscle) continue; // нет атрибуции — подходы не приписываем молча другой мышце
          attributedSets += sets.length;
          const rirs = sets.map((s: any)=> Number(s?.rir)).filter((v: number)=> Number.isFinite(v));
          const avgRir = rirs.length === sets.length ? rirs.reduce((a: number, b: number)=> a + b, 0) / rirs.length : undefined;
          entries.push({ date, muscle, sets: sets.length, avgRir, rirKnown: avgRir !== undefined });
        }
      }
      if (!entries.length) return { empty: true as const, diarySets, coverage: 0, report: null, planRows: [] as any[], hasPlan: false };
      const reportPm = muscleLoadReport(entries, today);
      let planAvg: Record<string, number> | null = null;
      try {
        const plan: any = loadSavedBBPlan();
        const weeks: any[] = Array.isArray(plan?.weeks) ? plan.weeks : [];
        if (weeks.length) {
          const sum: Record<string, number> = {};
          for (const wk of weeks) for (const se of (Array.isArray(wk?.sessions) ? wk.sessions : [])) {
            for (const e of (Array.isArray(se?.exercises) ? se.exercises : [])) {
              const m = String(e?.muscle || '').trim();
              const n = Number(e?.sets);
              if (!m || !Number.isFinite(n) || n <= 0) continue;
              sum[m] = (sum[m] ?? 0) + n;
            }
          }
          for (const m of Object.keys(sum)) sum[m] = Math.round((sum[m] / weeks.length) * 10) / 10;
          planAvg = sum;
        }
      } catch { planAvg = null; }
      return {
        empty: false as const,
        diarySets, attributedSets,
        coverage: diarySets > 0 ? Math.round((attributedSets / diarySets) * 100) / 100 : 0,
        report: reportPm,
        hasPlan: !!planAvg,
        planRows: planAvg ? planVsActualPerMuscle(reportPm, planAvg).filter(r => r.planSets > 0 || r.actualSets > 0) : [],
      };
    } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, today]);
  /** Есть ли фактические данные для решения — без них «Применить» блокируется (честный пустой контур). */
  const hasLoadData = sessions.filter(s => Number.isFinite(s.sRPE) && Number.isFinite(s.durationMin) && s.durationMin > 0).length > 0;
  // P2: персональная HRV-база (lnRMSSD+SWC) вместо фиксированной нормы 60 мс
  const [hrvBump, setHrvBump] = useState(0);
  const hrvBase = useMemo(()=> { try { return buildHrvBaseline(); } catch { return null; } }, [hrvBump]);
  const hrvState = useMemo(()=> hrvReadiness(rmssd, hrvBase), [rmssd, hrvBase]);
  const hrvRatio = useMemo(()=> hrvRatioToBaseline(rmssd, hrvBase).ratio, [rmssd, hrvBase]);

  // Профиль (для автозаполнения и живых входов): сон-времена/пробуждения, PR за 7 дней.
  const profileLifestyle = useMemo(()=> {
    try { const p: any = getProfile()?.settings || {}; return {
      bedtime: typeof p.lifestyle?.bedtime === 'string' ? p.lifestyle.bedtime : undefined,
      wakeTime: typeof p.lifestyle?.wakeTime === 'string' ? p.lifestyle.wakeTime : undefined,
      nightAwakenings: Number.isFinite(Number(p.lifestyle?.nightAwakenings)) ? Number(p.lifestyle.nightAwakenings) : undefined,
    }; } catch { return { bedtime: undefined, wakeTime: undefined, nightAwakenings: undefined }; }
  }, [dayTick]);
  const recentPrFlag = useMemo(()=> {
    try {
      const raw = JSON.parse(localStorage.getItem('he_workout_log_v2') || '[]');
      if (!Array.isArray(raw)) return false;
      const weekAgo = addDaysIso(today, -7);
      return raw.some((w: any)=> String(w?.date || '') >= weekAgo && Number(w?.prCount) > 0);
    } catch { return false; }
  }, [today]);

  const recoveryOut = useMemo(()=> {
    try {
      return analyzeRecovery({
        // Сон: длительность и качество — живые входы; bedtime/wakeTime/пробуждения берём из профиля,
        // если они есть (раньше тут были зашиты 23:00/07:00/10мин/1 — «качество сна» считалось по выдумке).
        sleep: { hours: sleepHours, quality: sleepQuality, bedtime: profileLifestyle.bedtime, wakeTime: profileLifestyle.wakeTime, latencyMin: undefined, awakenings: profileLifestyle.nightAwakenings },
        hrv: { rmssd, sdnn: undefined, restingHR, readinessScore: readiness },
        // D1: персональная база перебивает популяционные пороги внутри движка
        hrvBaseline: hrvBase ? { status: hrvState.status, n: hrvBase.n } : null,
        fatigueScore: fatigue/100,
        trainingDaysThisWeek: trainDays,
        currentWeek: 0, // неделя цикла неизвестна → недельное правило делода не выдумывается
        periodizationPhase: phase,
        recentPR: recentPrFlag,
      });
    } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleepHours, sleepQuality, rmssd, restingHR, readiness, fatigue, trainDays, phase, hrvBase, hrvState, recentPrFlag, profileLifestyle.bedtime, profileLifestyle.wakeTime, profileLifestyle.nightAwakenings]);

  const verdict = useMemo(()=> recoveryOut ? shouldTrain(recoveryOut.overallRecoveryIndex, fatigue/100) : null, [recoveryOut, fatigue]);

  // P3: живая история готовности — актуализация снапшота пишет точку дня (дедуп по дате внутри стора),
  // прогноз появляется через 3 дня и молодеет вместе с данными
  const [histTick, setHistTick] = useState(0);
  useEffect(() => {
    try {
      if (recoveryOut) {
        appendReadinessToday(recoveryOut.overallRecoveryIndex, fatigue);
        setHistTick(t => t + 1);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveryOut]);

  const readinessScores = useMemo(()=> ({ recovery: readiness, fatigue, nutrition:80, support:80, sleep: Math.round(sleepQuality*2), stress }), [readiness, fatigue, sleepQuality, stress]);
  const pri = useMemo(()=> calculatePRI(readinessScores as any, doms, sleepQuality*2, stress), [readinessScores, doms, sleepQuality, stress]);
  const priThr = useMemo(()=> getPRIThreshold(pri), [pri]);

  const autoReg = useMemo(()=> autoRegulate({
    readiness, acwr: { ratio: acwr.ratio, zone: acwr.zone }, fatigue, hrvRatio, sleepScore: recoveryOut?.sleepScore ?? 70,
    lastSessionRPE: lastRPE, lastVelocityLossPct: vLoss, plannedTopSetPct: topPct, plannedRIR: planRIR, goal,
  }), [readiness, acwr, fatigue, hrvRatio, recoveryOut, lastRPE, vLoss, topPct, planRIR, goal]);

  const trainToday = useMemo(()=> shouldTrainToday({ readiness, acwr, hrvRatio }), [readiness, acwr, hrvRatio]);

  const rirCalib = useMemo(()=> { try { return getCalibrationStats(); } catch { return null; } }, [sessions]);

  const hist = useMemo(()=> loadReadinessHistory().map(p=> p.recovery), [histTick]);
  const forecast = useMemo(()=> hist.length >=3 ? generateReadinessForecast(hist) : null, [hist]);
  // F3: база сценария — ФАКТ (overtrainingRisk из recoveryOut). Константа «22» была выдумкой:
  // без данных о восстановлении сценарий не считается вовсе (число в UI не рисуется).
  const whatIfBase = recoveryOut?.overtrainingRisk ?? null;
  const whatIf = useMemo(()=> whatIfBase == null ? null : runWhatIf(whatIfBase, readiness, {
    calorieChange: calDelta, sleepChange: sleepDelta, drugChange: aasMult!==1? { AAS: aasMult }: undefined,
  }), [whatIfBase, readiness, calDelta, sleepDelta, aasMult]);

  // ——— E6: прогноз нагрузки (EWMA) + «сколько дней подряд» ———
  const loadFc = useMemo(()=> hasLoadData ? loadForecast(report.dailyLoads, today, 7) : null, [report.dailyLoads, today, hasLoadData]);

  // ——— E6: траектория измеримых показателей (e1RM / вес / объём) ———
  // Только реальные замеры дневника/весового журнала; серии с <2 точками остаются «недостаточно данных».
  const trajectory = useMemo(()=> {
    try {
      const raw = JSON.parse(localStorage.getItem('he_workout_log_v2') || '[]');
      const list: any[] = Array.isArray(raw) ? raw : [];
      const e1rm: { date: string; value: number }[] = [];
      const volume: { date: string; value: number }[] = [];
      for (const w of list) {
        const date = String(w?.date || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        const exs = Array.isArray(w?.exercises) ? w.exercises : [];
        const bests = exs.map((e: any)=> Number(e?.best1RM)).filter((v: number)=> Number.isFinite(v) && v > 0);
        if (bests.length) e1rm.push({ date, value: Math.max(...bests) });
        const vol = exs.reduce((s: number, e: any)=> s + (Number.isFinite(Number(e?.totalVolume)) ? Number(e.totalVolume) : 0), 0);
        if (vol > 0) volume.push({ date, value: vol });
      }
      const wLogRaw = (()=> { try { return JSON.parse(localStorage.getItem('he_weight_log') || '[]'); } catch { return []; } })();
      const bodyweight = (Array.isArray(wLogRaw) ? wLogRaw : [])
        .map((r: any)=> ({ date: String(r?.date || ''), value: Number(r?.weight ?? r?.weightKg) }))
        .filter((p: any)=> /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(p.value) && p.value > 0);
      return performanceTrajectory({ e1rm, bodyweight, volume }, today, 7);
    } catch { return [] as ReturnType<typeof performanceTrajectory>; }
  }, [sessions, today]);

  const workWeight = useMemo(()=> loadForRPE(e1rm, rpe, repCnt), [e1rm, rpe, repCnt]);
  const rpeBack = useMemo(()=> rpeFromLoad(e1rm, workWeight, repCnt), [e1rm, workWeight, repCnt]);

  // BB-аудит (перенесён из дневника — без дубля, канон тут).
  // Стор-ключи: план ББ лежит во вложенных объектах (`he_bb_plan_saved` = {plan, date}, `he_bb_plans[i].plan`),
  // дневник питания v2 = `{[dateISO]: {meals: {[mealType]: [{kcal,p,f,c}]}}}` — прежние формы (`{weeks}`,
  // `nutDiary.days[].meals[].items`) не существуют, поэтому блок был вечно пустым.
  const bbRecs = useMemo(() => {
    try {
      const plan = loadSavedBBPlan();
      if (!plan) return null;
      const profile: any = (()=> { try { return JSON.parse(localStorage.getItem('he_profile_v2')||'{}').settings || {}; } catch { return {}; }})();
      const historyWorkouts: any[] = (()=> { try { const r = JSON.parse(localStorage.getItem('he_workout_log_v2')||'[]'); return Array.isArray(r)?r:[]; } catch { return []; }})();
      // nutrition avg 7d — реальная форма дневника v2
      const nutDiary: any = (()=> { try { return JSON.parse(localStorage.getItem('nutrition_diary_v2')||'null'); } catch { return null; }})();
      let nutrition: any = null;
      if (nutDiary && typeof nutDiary === 'object' && !Array.isArray(nutDiary)) {
        const dates = Object.keys(nutDiary).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().slice(-7);
        let sumK=0,sumP=0,sumC=0,cnt=0;
        for (const d of dates) {
          const meals = nutDiary[d]?.meals;
          if (!meals || typeof meals !== 'object') continue;
          const items = Object.values(meals).flat() as any[];
          if (!items.length) continue;
          let k=0,p=0,c=0;
          for (const it of items) { k += Number(it?.kcal)||0; p += Number(it?.p)||0; c += Number(it?.c)||0; }
          if (k>0) { sumK+=k; sumP+=p; sumC+=c; cnt++; }
        }
        if (cnt>0) nutrition = { avgKcal: Math.round(sumK/cnt), avgProtein: Math.round(sumP/cnt), avgCarbs: Math.round(sumC/cnt), days: cnt };
      }
      const supportSubs: string[] = (()=> { try {
        const r = JSON.parse(localStorage.getItem('he_support_plan_result')||'null');
        if (r?.substances) return r.substances.map((s:any)=> s.name||s.id).filter(Boolean);
        const rr = JSON.parse(localStorage.getItem('he_support_risk')||'null');
        if (rr?.subs) return rr.subs;
      } catch {} return [];})();
      const sleepDiary: any[] = (()=> { try { const r = JSON.parse(localStorage.getItem('he_sleep_diary')||'[]'); return Array.isArray(r)?r:[]; } catch { return []; }})();
      const lastSleep = sleepDiary.length? [...sleepDiary].sort((a,b)=> String(b.date).localeCompare(String(a.date)))[0]?.hours ?? null : null;
      const sections = generateBBRecommendations({
        plan: plan as any,
        params: { goal: profile?.goals?.bbGoal || 'hypertrophy', level: profile?.training?.level || 'intermediate' } as any,
        historyWorkouts,
        profile: { weight: profile?.personal?.weight || 80, proteinPerKg: profile?.nutrition?.proteinPerKg } as any,
        nutrition, supportSubs,
        readiness: { lastRecovery: readiness, lowDays: 0 },
        acwr: { ratio: acwr.ratio, zone: acwr.zone } as any,
        lastSleepHours: lastSleep,
      } as any);
      return { sections, summary: bbRecSummary(sections), hasNutrition: !!nutrition };
    } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readiness, acwr.ratio, acwr.zone, today, sessions.length]);

  // unified apply: РОВНО ОДИН пейлоад (два синхронных dispatchEvent батчатся React в один setState —
  // приёмник увидел бы только последний, pri потерялся бы). При флаге deload едет kind='deload' (несёт те же
  // объём/RIR + явный флаг; pri-контракт флага не имеет), иначе kind='pri'.
  // Гейт по данным: без фактических sRPE-сессий решения не отправляются (раньше 0 записей давали
  // «Недотрен ×1.10» и уверенно отправляли +10% объёма в планировщик).
  const applyUnified = ()=> {
    if (!hasLoadData) {
      const t0 = (window as any).showToast;
      const msg = '⚠ Нет данных о нагрузке: добавьте сессию sRPE (или импортируйте из дневника) — коррекция не отправляется.';
      if (typeof t0 === 'function') t0(msg, 'warning'); else alert(msg);
      return;
    }
    const vol = autoReg.volumeMultiplier;
    const rir = autoReg.rirShift;
    const deload = autoReg.deload || !!recoveryOut?.deloadRecommended;
    const label = deload ? `Интеллект: deload (ACWR ${acwr.ratio.toFixed(2)}/${ZONE_META[acwr.zone].label}, RI ${recoveryOut?.overallRecoveryIndex ?? '—'})` : `Интеллект: объём ×${vol} · RIR +${rir} (ACWR ${acwr.ratio.toFixed(2)}, PRI ${pri})`;
    if (deload) applyToPlanner({ kind:'deload', label: `${label} · deload-неделя`, data:{ volumeMult: vol, rirShift: rir, weeks: [] } });
    else applyToPlanner({ kind:'pri', label, data:{ volumeMult: vol, rirShift: rir } });
    // E8: решение попадает в журнал недели — тренер видит «применено», а не «пришло в планировщик».
    setHistory(saveIntelDecision({
      date: today,
      kind: deload ? 'deload' : 'pri',
      applied: true,
      label: deload ? 'Deload-неделя применена' : 'Коррекция объёма/RIR применена',
      detail: `ACWR ${acwr.ratio.toFixed(2)} · объём ×${vol} · RIR +${rir}`,
    }));
    const t = (window as any).showToast; if (typeof t==='function') t(deload ? '🔄 Deload отправлен в планировщик (kind=deload)' : `✓ Коррекция ×${vol} · RIR+${rir} отправлена`, 'success'); else alert(label);
  };
  /** Кнопка применения: без данных — неактивна с честным пояснением (не «молчаливый» ×1.1). */
  const applyDisabled = !hasLoadData;
  // E8: отчёт собирается здесь — после всех мемо верхнего блока.
  const coachReport = buildCoachReport();

  const last7 = report.dailyLoads.slice(-7);
  const maxLoad = Math.max(1, ...last7.map(d=> d.load));
  const weeks: { label:string; load:number }[] = (()=> {
    const dl = report.dailyLoads;
    const out: typeof weeks = [];
    for(let w=0; w<4; w++){ const load = (w===0? dl.slice(-7) : dl.slice(-7 - w*7, -7 - (w-1)*7)).reduce((s,d)=> s+d.load,0); out.unshift({ label: w===0? 'тек.': `−${w}н`, load: Math.round(load)}); }
    return out;
  })();
  const maxW = Math.max(1, ...weeks.map(x=> x.load));

  return (
    <div className="hub-intel" style={{ padding: '10px 8px 18px', color:'#fff', maxWidth:760, margin:'0 auto' }}>
      {/* header */}
      <div style={{ ...CARD, padding:'14px 14px 12px', background:'linear-gradient(135deg,rgba(0,230,138,0.10),rgba(59,130,246,0.07))', border:'1px solid rgba(0,230,138,0.18)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-18, right:-18, width:110, height:110, borderRadius:110, background:'radial-gradient(circle,rgba(0,230,138,0.16),transparent 70%)', pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <div style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:900, fontSize:16 }}>⚡</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:900, color:'#fff', lineHeight:1 }}>Интеллект тренировки</div>
            <div style={{ fontSize:11, color:'#fff', lineHeight:1.3 }}>Единый пульт: нагрузка → восстановление → авторегуляция → прогноз. Один расчёт, без дублей.</div>
          </div>
          <span style={{ fontSize:11, padding:'4px 8px', borderRadius:20, background:'rgba(0,230,138,0.12)', border:'1px solid rgba(0,230,138,0.22)', color:ACCENT, fontWeight:800, whiteSpace:'nowrap' }}>без дублей</span>
        </div>
        <div style={{ ...SMALL, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', lineHeight:1.45 }}>
          <b style={{ color:'#fff' }}>Как работает:</b> вверху — единый снимок состояния (сон/HRV/готовность/усталость/sRPE). Он один раз питает все 4 блока ниже.
          <span style={{ color:ACCENT }}> ACWR — только в «Нагрузке»</span>, <span style={{ color:'#22c55e' }}>recovery/shouldTrain — только в «Восстановлении»</span>,
          <span style={{ color:'#a855f7' }}> PRI/RPE-вес — только в «Авторегуляции»</span>, <span style={{ color:'#f59e0b' }}> Хольт/what-if — только в «Прогнозе»</span>. Итоговая коррекция — одна кнопка внизу.
        </div>
      </div>

      {/* sticky nav */}
      <div style={{ position:'sticky', top:0, zIndex:5, margin:'-2px -8px 10px', padding:'8px 8px 8px', background:'rgba(10,10,12,0.72)', backdropFilter:'blur(10px)', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none' }}>
        {SECTIONS.map(s=> (
          <button key={s.id} onClick={()=> scrollTo(s.id)} aria-pressed={active===s.id} aria-label={`Раздел: ${s.label}. ${s.desc}`} style={{
            flex:'0 0 auto', display:'flex', alignItems:'center', gap:6, padding:'7px 11px', minHeight:44, borderRadius:20, cursor:'pointer', fontSize:11, fontWeight:800, whiteSpace:'nowrap',
            border: active===s.id ? `1px solid ${s.accent}` : '1px solid rgba(255,255,255,0.08)',
            background: active===s.id ? `${s.accent}18` : 'rgba(255,255,255,0.04)',
            color: active===s.id ? s.accent : '#fff', transition:'all 0.16s',
          }}>
            <span>{s.icon}</span> {s.label}
          </button>
        ))}
        <button onClick={applyUnified} disabled={applyDisabled} aria-disabled={applyDisabled} title={applyDisabled? 'Нет данных о нагрузке (sRPE) — коррекция не отправляется':'Отправить коррекцию в планировщик'} style={{ marginLeft:'auto', flex:'0 0 auto', padding:'7px 12px', minHeight:44, borderRadius:20, border:'none', cursor: applyDisabled? 'not-allowed':'pointer', background: applyDisabled? 'rgba(255,255,255,0.06)':'linear-gradient(135deg,#00e68a,#00c853)', color: applyDisabled? 'rgba(255,255,255,0.55)':'#000', fontWeight:900, fontSize:11, whiteSpace:'nowrap' }}>🛠 Применить</button>
      </div>

      {/* summary strip — 4 плитки, живые, без дублей формул */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10 }}>
        <div role="button" tabIndex={0} aria-label="Раздел: нагрузка" onClick={()=> scrollTo('load')}
            onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); scrollTo('load'); } }} style={{ ...CARD, marginBottom:0, padding:10, cursor:'pointer', borderLeft:`3px solid ${ZONE_META[acwr.zone].color}`, minHeight:72 }}>
          <div style={{ fontSize:11, fontWeight:800, color:ZONE_META[acwr.zone].color, letterSpacing:0.4, textTransform:'uppercase' }}>📊 Нагрузка · ACWR</div>
          <div style={{ fontSize:20, fontWeight:900, color:ZONE_META[acwr.zone].color, lineHeight:1, marginTop:2 }}>{acwr.ratio.toFixed(2)} <span style={{ fontSize:11, fontWeight:700, color:ZONE_META[acwr.zone].color, opacity:0.85 }}>· {ZONE_META[acwr.zone].label}</span></div>
          <div style={{ ...SMALL, marginTop:4 }}>{Math.round(acwr.acute)}/{Math.round(acwr.chronic)} AU · monotony {monotony.monotony} · strain {monotony.strain}</div>
        </div>
        <div role="button" tabIndex={0} aria-label="Раздел: восстановление" onClick={()=> scrollTo('recovery')}
            onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); scrollTo('recovery'); } }} style={{ ...CARD, marginBottom:0, padding:10, cursor:'pointer', borderLeft:`3px solid ${recoveryOut ? RECOVERY_LABEL_COLOR(recoveryOut.readinessLabel) : DIM}`, minHeight:72 }}>
          <div style={{ fontSize:11, fontWeight:800, color: recoveryOut ? RECOVERY_LABEL_COLOR(recoveryOut.readinessLabel) : DIM, letterSpacing:0.4, textTransform:'uppercase' }}>🔋 Восстановление</div>
          <div style={{ fontSize:20, fontWeight:900, color: recoveryOut ? RECOVERY_LABEL_COLOR(recoveryOut.readinessLabel) : '#fff', lineHeight:1, marginTop:2 }}>{recoveryOut ? `${recoveryOut.overallRecoveryIndex} · ${recoveryOut.readinessLabel}` : '—'}</div>
          <div style={{ ...SMALL, marginTop:4 }}>{verdict ? (verdict.train ? '✅ '+verdict.message : '🛑 '+verdict.message) : '—'} {recoveryOut?.deloadRecommended ? ' · deload' : ''}</div>
        </div>
        <div role="button" tabIndex={0} aria-label="Раздел: авторегуляция" onClick={()=> scrollTo('autoreg')}
            onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); scrollTo('autoreg'); } }} style={{ ...CARD, marginBottom:0, padding:10, cursor:'pointer', borderLeft:`3px solid #a855f7`, minHeight:72 }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#a855f7', letterSpacing:0.4, textTransform:'uppercase' }}>⚙️ Авторегуляция · PRI {pri}</div>
          <div style={{ fontSize:16, fontWeight:900, color:'#fff', lineHeight:1, marginTop:2 }}>×{autoReg.volumeMultiplier} · RIR+{autoReg.rirShift} <span style={{ fontSize:11, color: autoReg.deload ? '#ef4444' : DIM, fontWeight:800 }}>{autoReg.deload ? 'deload' : autoReg.intensityNote || ''}</span></div>
          <div style={{ ...SMALL, marginTop:4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{priThr.label} · {priThr.desc}</div>
        </div>
        <div role="button" tabIndex={0} aria-label="Раздел: прогноз нагрузки" onClick={()=> scrollTo('forecast')}
            onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); scrollTo('forecast'); } }} style={{ ...CARD, marginBottom:0, padding:10, cursor:'pointer', borderLeft:`3px solid #f59e0b`, minHeight:72 }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#f59e0b', letterSpacing:0.4, textTransform:'uppercase' }}>🔮 Прогноз · {forecast ? `${Math.round(forecast.values[0])}→${Math.round(forecast.values[forecast.values.length-1])}` : '—'}</div>
          <div style={{ fontSize:14, fontWeight:900, color: forecast ? READINESS_COLOR(forecast.values[0]) : '#fff', lineHeight:1, marginTop:2 }}>{forecast ? `+${forecast.values.length}д · ДИ ${Math.round(forecast.ci95[0][0])}–${Math.round(forecast.ci95[0][1])}` : (hist.length<3 ? `${hist.length}/3 дн. истории` : '—')}</div>
          <div style={{ ...SMALL, marginTop:4 }}>{whatIf ? `what-if ΔR ${whatIf.riskDelta>=0?'+':''}${whatIf.riskDelta} · ΔГ ${whatIf.readinessDelta>=0?'+':''}${whatIf.readinessDelta}` : '—'}</div>
        </div>
      </div>

      {/* ——— единый пульт входа ——— */}
      <div style={{ ...CARD, border:'1px solid rgba(0,230,138,0.16)', background:'linear-gradient(135deg,rgba(0,230,138,0.07),rgba(255,255,255,0.02))' }}>
        <div style={H}>🎛 Единый пульт — состояние сегодня</div>
        <div style={HINT}>Один снимок питает все блоки. Заполните или нажмите «Авто» — данные подтянутся из профиля и дневника sRPE.</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:8 }}>
          <PopupNumber label="Готовность 0–100" value={readiness} min={0} max={100} onChange={setReadiness} />
          <PopupNumber label="Усталость 0–100" value={fatigue} min={0} max={100} onChange={setFatigue} />
          <PopupNumber label="Сон, часы" value={sleepHours} min={0} max={12} step={0.5} onChange={setSleepHours} />
          <PopupNumber label="Качество сна 1–5" value={sleepQuality} min={1} max={5} onChange={setSleepQuality} />
          <PopupNumber label="HRV rmssd, мс" value={rmssd} min={10} max={150} onChange={setRmssd} />
          <PopupNumber label="Пульс покоя" value={restingHR} min={35} max={95} onChange={setRestingHR} />
          <PopupNumber label="Стресс 0–10" value={stress} min={0} max={10} onChange={setStress} />
          <PopupNumber label="DOMS 0–10" value={doms} min={0} max={10} onChange={setDoms} />
          <PopupNumber label="Тренировок/нед" value={trainDays} min={0} max={7} onChange={setTrainDays} />
          <PopupSelect label="Фаза" value={phase} options={[{id:'accumulation',label:'Накопление'},{id:'intensification',label:'Интенсификация'},{id:'peaking',label:'Пик'},{id:'deload',label:'Разгрузка'}]} onChange={v=> setPhase(v as any)} />
          <PopupNumber label="RPE прошлой сессии" value={lastRPE} min={1} max={10} step={0.5} onChange={setLastRPE} />
          <PopupNumber label="Потеря скорости %" value={vLoss} min={0} max={50} onChange={setVLoss} />
        </div>
        <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
          <button onClick={()=> autofillFromProfile()} style={{ flex:1, minHeight:44, padding:'10px 12px', borderRadius:10, border:'1px solid rgba(99,102,241,0.28)', background:'rgba(99,102,241,0.12)', color:'#818cf8', fontWeight:800, fontSize:12, cursor:'pointer', transition:'all 0.15s' }}>📋 Авто из профиля</button>
          <button onClick={reload} style={{ flex:1, minHeight:44, padding:'10px 12px', borderRadius:10, border:'1px solid rgba(0,230,138,0.22)', background:'rgba(0,230,138,0.10)', color:ACCENT, fontWeight:800, fontSize:12, cursor:'pointer', transition:'all 0.15s' }}>🔁 sRPE ({sessions.length})</button>
          <button onClick={resetSnapshot} style={{ minWidth:84, minHeight:44, padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.04)', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', transition:'all 0.15s' }}>↩ Сброс</button>
        </div>
        {snapStaleDays>0 && (
          <div style={{ ...SMALL, marginTop:6, padding:'7px 10px', borderRadius:9, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.20)', color:'#f59e0b' }}>
            🕒 Снимок входов сохранён {snapStaleDays===1?'вчера':`${snapStaleDays} дн. назад`} — нажмите «Авто из профиля», чтобы освежить данные.
          </div>
        )}
        {!hasLoadData && (
          <div style={{ ...SMALL, marginTop:6, padding:'7px 10px', borderRadius:9, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.20)', color:'#ef4444' }}>
            ⚠ Нет ни одной сессии sRPE — ACWR/авторегуляция/коррекция не считаются, «Применить» заблокировано. Добавьте сессию кнопкой «🔁 sRPE» или импортируйте из дневника.
          </div>
        )}
        <div style={{ ...SMALL, marginTop:8, padding:'7px 10px', borderRadius:9, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
          HRV-ratio {hrvRatio.toFixed(2)}{hrvBase ? ' (к своей базе)' : ' (базы нет — ориентир)'} · PRI {pri} ({priThr.label}) · trainToday: <b style={{ color: trainToday.train ? '#22c55e' : '#ef4444'}}>{trainToday.train ? 'да' : 'нет'}</b> — {trainToday.reason}
        </div>
        <div style={{ ...SMALL, marginTop:6, padding:'7px 10px', borderRadius:9, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
          Hooper-5: сон {sleepHours}ч · качество {sleepQuality}/5 · стресс {stress}/10 · усталость {fatigue}/100 · DOMS {doms}/10 — один ряд вместо разрозненных оценок.
        </div>
      </div>

      {/* ——— НАГРУЗКА ——— */}
      <section id="sec-load" data-intel="load" ref={el=> refs.current['load']=el} style={{ scrollMarginTop: 56 }}>
        <div style={{ ...CARD, borderLeft:`3px solid #3b82f6` }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(59,130,246,0.14)', border:'1px solid rgba(59,130,246,0.22)', fontSize:14 }}>📊</span>
            <div>
              <div style={{ fontSize:13, fontWeight:900, color:'#3b82f6' }}>Нагрузка</div>
              <div style={{ fontSize:11, color:DIM }}>Одна формула ACWR/monotony/Banister — факты из sRPE, без повторов в других секциях · метод EWMA uncoupled (Вильямс 2017)</div>
            </div>
            <span style={{ marginLeft:'auto', fontSize:11, padding:'3px 8px', borderRadius:20, background:`${ZONE_META[acwr.zone].color}14`, border:`1px solid ${ZONE_META[acwr.zone].color}33`, color:ZONE_META[acwr.zone].color, fontWeight:800 }}>{ZONE_META[acwr.zone].label}</span>
          </div>

          {/* ввод sRPE */}
          <div data-intel-grid="3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:8, alignItems:'end' }}>
            <div>
              <div style={{ fontSize:11, color:DIM, marginBottom:3 }}>Дата</div>
              <input type="date" value={sDate} onChange={e=> setSDate(e.target.value)} aria-label="Дата тренировки" style={{ width:'100%', background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.08)', borderRadius:9, padding:'9px 8px', fontSize:16, minHeight:44, boxSizing:'border-box' }} />
            </div>
            <PopupNumber label="sRPE 1–10" value={sRPE} min={1} max={10} onChange={setSRPE} />
            <PopupNumber label="Длит. мин" value={sDur} min={5} max={300} suffix=" мин" onChange={setSDur} />
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
            <button onClick={addSession} style={{ flex:1, minHeight:44, borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:900, fontSize:12 }}>💾 Добавить ({sessionLoad(sRPE,sDur)} AU)</button>
            <button onClick={importFromDiary} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid rgba(96,165,250,0.28)', background:'rgba(96,165,250,0.08)', color:'#60a5fa', fontWeight:800, fontSize:12, cursor:'pointer', minHeight:44 }}>📥 Из дневника</button>
            {sessions.length>0 && <button onClick={clearAll} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid rgba(239,68,68,0.28)', background:'rgba(239,68,68,0.08)', color:'#ef4444', fontWeight:800, fontSize:12, cursor:'pointer' }}>Очистить</button>}
          </div>
          {sessions.length===0 ? (
            <div style={{ ...CARD, marginBottom:8, background:'rgba(255,255,255,0.03)', textAlign:'center', ...HINT }}>Нет sRPE-данных. Добавьте тренировки — ACWR/monotony/Banister появятся.</div>
          ) : (
            <>
              <div data-intel-grid="3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                <div style={{ background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.18)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:11, color:DIM, letterSpacing:0.3, textTransform:'uppercase' }}>Острая 7д</div>
                  <div style={{ fontSize:16, fontWeight:900, color:'#3b82f6' }}>{Math.round(acwr.acute)}</div>
                  <div style={SMALL}>AU/дн</div>
                </div>
                <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:11, color:DIM, letterSpacing:0.3, textTransform:'uppercase' }}>Хроническая 28д</div>
                  <div style={{ fontSize:16, fontWeight:900, color:'#fff' }}>{Math.round(acwr.chronic)}</div>
                  <div style={SMALL}>AU/дн</div>
                </div>
                <div style={{ background:`${ZONE_META[acwr.zone].color}12`, border:`1px solid ${ZONE_META[acwr.zone].color}33`, borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:11, color:DIM, letterSpacing:0.3, textTransform:'uppercase' }}>ACWR</div>
                  <div style={{ fontSize:16, fontWeight:900, color:ZONE_META[acwr.zone].color }}>{acwr.ratio.toFixed(2)}</div>
                  <div style={{ fontSize:11, color:ZONE_META[acwr.zone].color, fontWeight:800 }}>{ZONE_META[acwr.zone].label}</div>
                </div>
              </div>
              <div style={{ marginTop:8, height:8, borderRadius:99, background:'linear-gradient(90deg,#3b82f6 0 20%,#22c55e 20% 62%,#eab308 62% 78%,#ef4444 78% 100%)', position:'relative' }}>
                <div style={{ position:'absolute', top:-4, width:3, height:16, background:'#fff', borderRadius:2, left:`${Math.min(100, Math.max(0, (acwr.ratio/2)*100))}%`, boxShadow:'0 1px 6px rgba(0,0,0,0.4)' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#fff', marginTop:2 }}><span>0.0</span><span>0.8</span><span>1.3</span><span>1.5</span><span>2.0</span></div>
              {acwr.lowBase && <div style={{ marginTop:6, padding:'7px 10px', borderRadius:9, background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.18)', fontSize:11, color:'#fff', lineHeight:1.4 }}>📉 Тонкая база: хроническая нагрузка ниже пола — ratio завышен, красная зона отключена. Набирайте 3–4 недели базы.</div>}
              <div style={{ marginTop:6, fontSize:11, color:'#fff', lineHeight:1.4, opacity:0.75 }}>ⓘ {ACWR_DISCLAIMER}</div>
              <div style={{ marginTop:4, fontSize:11, color:'#fff', lineHeight:1.4, opacity:0.75 }}>⚠ {ACWR_WINDOW_NOTE}</div>
              <div style={{ marginTop:6, padding:'7px 10px', borderRadius:9, background:`${ZONE_META[acwr.zone].color}10`, border:`1px solid ${ZONE_META[acwr.zone].color}30`, fontSize:11, color:'#fff', lineHeight:1.4 }}>
                <b style={{ color: ZONE_META[acwr.zone].color }}>{ZONE_META[acwr.zone].label}:</b> {ZONE_META[acwr.zone].hint}
              </div>

              <div data-intel-grid="4" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6, marginTop:10 }}>
                <MetricCard title="Нагрузка 7д" accent="#3b82f6"><div style={{ fontSize:16, fontWeight:900, color:'#3b82f6' }}>{monotony.weeklyLoad}</div><div style={SMALL}>AU</div></MetricCard>
                <MetricCard title="Монотонность" accent={monotony.uniform? '#f59e0b': monotony.monotony>2? '#ef4444':'#3b82f6'}><div style={{ fontSize:16, fontWeight:900, color: monotony.uniform? '#f59e0b': monotony.monotony>2?'#ef4444':'#3b82f6' }}>{monotony.monotony}</div><div style={SMALL}>{monotony.uniform? 'разброс=0 (не «норма»)' : monotony.monotony>2?'однообразие': 'разброс есть'}</div></MetricCard>
                <MetricCard title="Strain" accent={monotony.strain>1000?'#ef4444':'#3b82f6'}><div style={{ fontSize:16, fontWeight:900, color: monotony.strain>1000?'#ef4444':'#3b82f6' }}>{monotony.strain}</div><div style={SMALL}>{monotony.strain>1000?'стресс':'норма'}</div></MetricCard>
                <MetricCard title="SD" accent={monotony.uniform? '#f59e0b':'#3b82f6'}><div style={{ fontSize:16, fontWeight:900, color: monotony.uniform? '#f59e0b':'#3b82f6' }}>{monotony.stdev}</div><div style={SMALL}>{monotony.uniform? 'недели идентичны': 'разброс'}</div></MetricCard>
              </div>
              {monotony.uniform && (
                <div style={{ marginTop:6, padding:'7px 10px', borderRadius:9, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.20)', fontSize:11, color:'#f59e0b', lineHeight:1.4 }}>
                  ⚠ Неделя без единого дня отдыха: SD=0, monotony математически 2 и «выглядит нормой», но это самое рискованное однообразие. {uniformStreak>=2 ? `Так уже ${uniformStreak} недели подряд.` : ''} Нужна вариация нагрузки/дни отдыха.
                </div>
              )}

              {banister.current && (
                <MetricCard title="Fitness-Fatigue (Banister)" accent="#60a5fa">
                  <div data-intel-grid="3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                    <div style={{ background:'rgba(96,165,250,0.07)', borderRadius:10, padding:'10px 6px', textAlign:'center' }}><div style={{ fontSize:11, color:DIM }}>Форма</div><div style={{ fontSize:15, fontWeight:900, color:'#22c55e' }}>{Math.round(banister.current.fitness)}</div></div>
                    <div style={{ background:'rgba(239,68,68,0.06)', borderRadius:10, padding:'10px 6px', textAlign:'center' }}><div style={{ fontSize:11, color:DIM }}>Усталость</div><div style={{ fontSize:15, fontWeight:900, color:'#ef4444' }}>{Math.round(banister.current.fatigue)}</div></div>
                    <div style={{ background:'rgba(0,230,138,0.06)', borderRadius:10, padding:'10px 6px', textAlign:'center' }}><div style={{ fontSize:11, color:DIM }}>Работосп.</div><div style={{ fontSize:15, fontWeight:900, color: banister.current.performance>=0? ACCENT : '#ef4444' }}>{Math.round(banister.current.performance)}</div></div>
                  </div>
                  {banister.series[banister.peakPerformanceIdx] && <div style={{ ...SMALL, marginTop:6 }}>Пик: {Math.round(banister.series[banister.peakPerformanceIdx].performance)} ({banister.series[banister.peakPerformanceIdx].date})</div>}
                  {form && <div title={`fitness ${banister.current?.fitness} − fatigue ${banister.current?.fatigue} (сырые AU, несопоставимы с readiness)`} style={{ ...SMALL, marginTop:6, padding:'7px 10px', borderRadius:9, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.14)' }}>📈 {form.label}</div>}
                </MetricCard>
              )}

              <MetricCard title="Дневная нагрузка · 7д" icon="📈">
                <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:64 }}>
                  {last7.map((d,i)=> (
                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                      <div style={{ width:'100%', maxWidth:28, height: Math.max(2, (d.load/maxLoad)*52), borderRadius:6, background: d.load>0? 'linear-gradient(180deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.06)', transition:'height 0.2s' }} />
                      <span style={{ fontSize:11, color:'#fff' }}>{d.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </MetricCard>

              <MetricCard title="Недельная динамика · 4н" icon="📅" accent="#60a5fa">
                <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:64 }}>
                  {weeks.map((w,i)=> (
                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                      <div style={{ width:'100%', maxWidth:36, height: Math.max(2, (w.load/maxW)*52), borderRadius:6, background: i===weeks.length-1? 'linear-gradient(180deg,#3b82f6,#1d4ed8)': 'linear-gradient(180deg,#475569,#334155)' }} />
                      <span style={{ fontSize:11, color:'#fff' }}>{w.label}</span>
                      <span style={{ fontSize:11, color:'#fff', fontWeight:800 }}>{w.load}</span>
                    </div>
                  ))}
                </div>
              </MetricCard>

              {/* E5 — альтернативные метрики нагрузки. Не канон ACWR: свой метод + честная оговорка. */}
              {loadAlt && (
                <MetricCard title="🔀 Диффы нагрузки · sACWR" icon="➗" accent="#818cf8">
                  <div data-intel-grid="3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                    {loadAlt.diff.windows.map(w => {
                      const col = w.deltaPct == null ? '#fff' : w.deltaPct > 10 ? '#ef4444' : w.deltaPct < -10 ? '#60a5fa' : '#84cc16';
                      return (
                        <div key={w.days} style={{ background:'rgba(129,140,248,0.07)', border:'1px solid rgba(129,140,248,0.18)', borderRadius:10, padding:'8px 4px', textAlign:'center' }}>
                          <div style={{ fontSize:11, color:DIM, letterSpacing:0.3, textTransform:'uppercase' }}>{w.days}д</div>
                          <div style={{ fontSize:14, fontWeight:900, color:col }}>
                            {w.deltaPct == null ? '—' : `${w.deltaPct>0?'+':''}${w.deltaPct}%`}
                          </div>
                          <div style={SMALL}>{w.current} AU</div>
                        </div>
                      );
                    })}
                  </div>
                  {loadAlt.sacwr && (
                    <>
                      <div data-intel-grid="3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginTop:6 }}>
                        <div style={{ background:'rgba(129,140,248,0.07)', borderRadius:10, padding:'8px 4px', textAlign:'center' }}>
                          <div style={{ fontSize:11, color:DIM, textTransform:'uppercase' }}>sACWR</div>
                          <div style={{ fontSize:15, fontWeight:900, color:'#818cf8' }}>{loadAlt.sacwr.ratio.toFixed(2)}</div>
                          <div style={SMALL}>EWMA 7/28</div>
                        </div>
                        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'8px 4px', textAlign:'center' }}>
                          <div style={{ fontSize:11, color:DIM, textTransform:'uppercase' }}>vs ACWR</div>
                          <div style={{ fontSize:15, fontWeight:900, color:'#fff' }}>
                            {loadAlt.sacwr.vsCoupledRa == null ? '—' : `${loadAlt.sacwr.vsCoupledRa>0?'+':''}${loadAlt.sacwr.vsCoupledRa}`}
                          </div>
                          <div style={SMALL}>разница методов</div>
                        </div>
                        <div style={{ background:'rgba(129,140,248,0.05)', borderRadius:10, padding:'8px 4px', textAlign:'center' }}>
                          <div style={{ fontSize:11, color:DIM, textTransform:'uppercase' }}>Объём</div>
                          <div style={{ fontSize:12, fontWeight:900, color:'#fff', lineHeight:1.25 }}>{loadAlt.classification?.label ?? '—'}</div>
                          <div style={SMALL}>по sACWR+Δ7д</div>
                        </div>
                      </div>
                      {loadAlt.classification && <div style={{ ...SMALL, marginTop:6 }}>💡 {loadAlt.classification.hint}</div>}
                    </>
                  )}
                  <div style={{ ...SMALL, marginTop:6, opacity:0.75 }}>ⓘ {SACWR_METHOD_NOTE}</div>
                  <div style={{ ...SMALL, marginTop:2, opacity:0.75 }}>ⓘ {loadAlt.diff.note}</div>
                </MetricCard>
              )}

              {/* E5 — нагрузка по мышцам + перекос (факт из дневника; план — средняя неделя плана). */}
              {muscleData && (
                <MetricCard title="🦴 Нагрузка по мышцам · перекос" icon="⚖️" accent="#f472b6">
                  {muscleData.empty || !muscleData.report ? (
                    <div style={HINT}>В дневнике нет тренировок с упражнениями — нагрузка по мышцам не считается. Добавьте сессию в «Дневник тренировок».</div>
                  ) : (
                    <>
                      <div style={{ ...SMALL, marginBottom:6 }}>
                        Атрибуция по каталогу: <b style={{ color: muscleData.coverage >= 0.6 ? '#fff' : '#eab308' }}>{Math.round(muscleData.coverage*100)}%</b> подходов ({muscleData.attributedSets} из {muscleData.diarySets}).
                        {muscleData.coverage < 0.6 && ' Малая доля — распределение ниже может быть неполным.'}
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:6 }}>
                        <div style={{ background:'rgba(244,114,182,0.07)', borderRadius:10, padding:'8px 6px', textAlign:'center' }}>
                          <div style={{ fontSize:11, color:DIM, textTransform:'uppercase' }}>Индекс перекоса</div>
                          <div style={{ fontSize:16, fontWeight:900, color:'#f472b6' }}>{muscleData.report.imbalance.score}</div>
                          <div style={SMALL}>{muscleData.report.imbalance.label}</div>
                        </div>
                        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'8px 6px', textAlign:'center' }}>
                          <div style={{ fontSize:11, color:DIM, textTransform:'uppercase' }}>Неделя</div>
                          <div style={{ fontSize:16, fontWeight:900, color:'#fff' }}>{muscleData.report.totalSets}</div>
                          <div style={SMALL}>сетов · нагрузка {muscleData.report.totalLoad}</div>
                        </div>
                      </div>
                      {muscleData.report.muscles.slice(0, 8).map(m => (
                        <div key={m.muscle} style={{ display:'grid', gridTemplateColumns:'1fr 0.7fr 0.6fr 0.6fr', gap:4, fontSize:11, padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', alignItems:'center' }}>
                          <span style={{ color:'#fff', fontWeight:700 }}>{muscleLabel(m.muscle) || m.muscle}</span>
                          <span style={{ color:DIM, textAlign:'right' }}>{m.sets} сет</span>
                          <span style={{ color: m.delta7dPct == null ? DIM : m.delta7dPct > 10 ? '#ef4444' : m.delta7dPct < -10 ? '#60a5fa' : '#84cc16', textAlign:'right', fontWeight:800 }}>
                            {m.delta7dPct == null ? '—' : `${m.delta7dPct>0?'+':''}${m.delta7dPct}%`}
                          </span>
                          <span style={{ color:DIM, textAlign:'right' }} title={`RIR известен у ${Math.round(m.rirKnownShare*100)}% сетов`}>RIR {Math.round(m.rirKnownShare*100)}%</span>
                        </div>
                      ))}
                      {muscleData.hasPlan && muscleData.planRows.length > 0 && (
                        <>
                          <div style={{ ...SMALL, marginTop:8, fontWeight:800, color:'#fff' }}>План (средняя неделя плана) vs факт 7д:</div>
                          {muscleData.planRows.slice(0, 6).map(r => (
                            <div key={r.muscle} style={{ display:'grid', gridTemplateColumns:'1fr 0.8fr 0.6fr', gap:4, fontSize:11, padding:'3px 0', alignItems:'center' }}>
                              <span style={{ color:DIM }}>{muscleLabel(r.muscle) || r.muscle}</span>
                              <span style={{ color:DIM, textAlign:'right' }}>{r.planSets} → {r.actualSets}</span>
                              <span style={{ color: r.deltaSets === 0 ? DIM : r.deltaSets > 0 ? '#84cc16' : '#eab308', textAlign:'right', fontWeight:800 }}>
                                {r.deltaSets>0?'+':''}{r.deltaSets}
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                      <div style={{ ...SMALL, marginTop:6, opacity:0.75 }}>ⓘ {PER_MUSCLE_NOTE}</div>
                    </>
                  )}
                </MetricCard>
              )}


              <ExpandableCard title={`Журнал sRPE · ${sessions.length}`} short={`${sessions.length} записей · ACWR ${acwr.ratio.toFixed(2)} · ${ZONE_META[acwr.zone].label}`} full={
                <div>
                  {sessions.slice().reverse().slice(0,30).map((s,i)=> {
                    const realIdx = sessions.length - 1 - i;
                    const editing = editIdx === realIdx;
                    return (
                    <div key={i} style={{ display:'grid', gridTemplateColumns: editing ? '1fr' : '1fr 0.6fr 0.7fr 0.6fr auto', gap:4, fontSize:11, padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.06)', color:'#fff', alignItems:'center' }}>
                      {editing ? (
                        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                          <span>{s.date}</span>
                          <label style={{ fontSize:11 }}>RPE <input type="number" min={1} max={10} value={editRpe} onChange={e=> setEditRpe(Number(e.target.value))} style={{ width:56, fontSize:16, background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, padding:'6px' }} /></label>
                          <label style={{ fontSize:11 }}>Мин <input type="number" min={1} max={600} value={editDur} onChange={e=> setEditDur(Number(e.target.value))} style={{ width:64, fontSize:16, background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, padding:'6px' }} /></label>
                          <button onClick={()=> { setSessions(updateSRPESession(realIdx, { sRPE: editRpe, durationMin: editDur })); setEditIdx(null); }} style={{ minHeight:44, padding:'6px 12px', borderRadius:8, border:'none', background:'#00e68a', color:'#000', fontWeight:800, fontSize:11, cursor:'pointer' }}>✓</button>
                          <button onClick={()=> setEditIdx(null)} aria-label="Отменить правку" style={{ minHeight:44, padding:'6px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'#fff', fontSize:11, cursor:'pointer' }}>✕</button>
                        </div>
                      ) : (
                        <>
                          <span>{s.date}</span><span>RPE {s.sRPE}</span><span>{s.durationMin} мин</span><span style={{ color:ACCENT, fontWeight:800 }}>{sessionLoad(s.sRPE,s.durationMin)} AU</span>
                          <span style={{ display:'flex', gap:4 }}>
                            <button onClick={()=> { setEditIdx(realIdx); setEditRpe(s.sRPE); setEditDur(s.durationMin); }} aria-label={`Править запись ${s.date}`} style={{ minWidth:44, minHeight:44, borderRadius:8, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'#fff', fontSize:12, cursor:'pointer' }}>✏️</button>
                            <button onClick={()=> setSessions(deleteSRPESession(realIdx))} aria-label={`Удалить запись ${s.date}`} style={{ minWidth:44, minHeight:44, borderRadius:8, border:'1px solid rgba(239,68,68,0.25)', background:'transparent', color:'#ef4444', fontSize:12, cursor:'pointer' }}>🗑</button>
                          </span>
                        </>
                      )}
                    </div>
                    );
                  })}
                </div>
              } />

              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.14)', fontSize:11, color:'#fff', lineHeight:1.45 }}>
                {report.recommendations.map((r,i)=> <div key={i} style={{ marginTop: i?4:0 }}>• {r}</div>)}
              </div>
            </>
          )}

          {/* E7 — CMJ-скрининг нейромышечной усталости. Живёт ВНЕ гейта «нет sRPE-сессий»:
              у CMJ собственный источник данных, иначе без единого прыжка ввести его нельзя. */}
          <div data-intel-card="cmj">
          <MetricCard title="🦘 CMJ-скрининг усталости" icon="📐" accent="#fb923c">
            <div data-intel-grid="3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:6 }}>
              <PopupNumber label="Высота, см" value={cmjHeight} min={5} max={120} step={0.5} onChange={setCmjHeight} />
              <PopupNumber label="Время полёта, мс" value={cmjFlight} min={100} max={900} step={5} onChange={setCmjFlight} />
              <PopupNumber label="Вес, кг" value={cmjBw} min={30} max={200} step={0.5} onChange={setCmjBw} />
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:6, flexWrap:'wrap' }}>
              <button onClick={addCmj} style={{ flex:1, minHeight:44, borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#fb923c,#ea580c)', color:'#000', fontWeight:800, fontSize:11 }}>🦘 Записать замер</button>
              {cmjList.length > 0 && <button onClick={()=> { clearCmj(); setCmjList([]); }} aria-label="Очистить журнал CMJ" style={{ minHeight:44, padding:'10px 14px', borderRadius:10, border:'1px solid rgba(239,68,68,0.28)', background:'rgba(239,68,68,0.08)', color:'#fff', fontSize:11 }}>Очистить</button>}
            </div>
            {!cmjList.length ? (
              <div style={HINT}>Замеров CMJ нет — скрининг не считается. Добавьте прыжок: скрининг показывает усталость, а не готовность к тренировке.</div>
            ) : cmj ? (
              <>
                <div data-intel-grid="3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                  <div style={{ background:`${cmj.zone === 'red' ? 'rgba(239,68,68,0.10)' : cmj.zone === 'yellow' ? 'rgba(245,158,11,0.10)' : 'rgba(34,197,94,0.08)'}`, borderRadius:10, padding:'8px 4px', textAlign:'center' }}>
                    <div style={{ fontSize:11, color:DIM, textTransform:'uppercase' }}>Просадка</div>
                    <div style={{ fontSize:15, fontWeight:900, color: cmj.zone === 'red' ? '#ef4444' : cmj.zone === 'yellow' ? '#f59e0b' : cmj.zone === 'no_data' ? '#fff' : '#22c55e' }}>
                      {cmj.current?.dropFromBestPct == null ? '—' : `${cmj.current.dropFromBestPct}%`}
                    </div>
                    <div style={SMALL}>от лучшего в серии</div>
                  </div>
                  <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'8px 4px', textAlign:'center' }}>
                    <div style={{ fontSize:11, color:DIM, textTransform:'uppercase' }}>vs база 7д</div>
                    <div style={{ fontSize:15, fontWeight:900, color:'#fff' }}>
                      {cmj.current?.deltaVsBaselinePct == null ? '—' : `${cmj.current.deltaVsBaselinePct>0?'+':''}${cmj.current.deltaVsBaselinePct}%`}
                    </div>
                    <div style={SMALL}>{cmj.points.length} замеров</div>
                  </div>
                  <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'8px 4px', textAlign:'center' }}>
                    <div style={{ fontSize:11, color:DIM, textTransform:'uppercase' }}>Метод</div>
                    <div style={{ fontSize:12, fontWeight:900, color:'#fff', lineHeight:1.3 }}>{cmj.current?.measured === 'height' ? 'высота' : cmj.current?.measured === 'flight_time' ? 'время полёта' : '—'}</div>
                    <div style={SMALL}>{cmj.current?.powerPerKg != null ? `${cmj.current.powerPerKg} Вт/кг` : 'мощность нет'}</div>
                  </div>
                </div>
                {cmj.signals.map((sg,i)=> <div key={i} style={{ ...SMALL, marginTop:4 }}>• {sg}</div>)}
                <div style={{ ...SMALL, marginTop:4, opacity:0.75 }}>ⓘ {CMJ_SCREENING_NOTE}</div>
                <div style={{ ...SMALL, marginTop:2, opacity:0.75 }}>ⓘ {CMJ_NON_BLOCKING_NOTE}</div>
              </>
            ) : null}
          </MetricCard>
          </div>
        </div>
      </section>

      {/* ——— ВОССТАНОВЛЕНИЕ ——— */}
      <section id="sec-recovery" data-intel="recovery" ref={el=> refs.current['recovery']=el} style={{ scrollMarginTop:56 }}>
        <div style={{ ...CARD, borderLeft:`3px solid #22c55e` }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(34,197,94,0.14)', border:'1px solid rgba(34,197,94,0.22)', fontSize:14 }}>🔋</span>
            <div>
              <div style={{ fontSize:13, fontWeight:900, color:'#22c55e' }}>Восстановление</div>
              <div style={{ fontSize:11, color:DIM }}>Единственный источник recovery-вердикта (сон/HRV/готовность/перетрен), без повторов из «Нагрузки»</div>
            </div>
          </div>

          {!recoveryOut || !verdict ? (
            <div style={SMALL}>Недостаточно данных.</div>
          ) : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <div style={{ background:`${RECOVERY_LABEL_COLOR(recoveryOut.readinessLabel)}14`, border:`1px solid ${RECOVERY_LABEL_COLOR(recoveryOut.readinessLabel)}33`, borderRadius:10, padding:'10px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:11, color:DIM, letterSpacing:0.3, textTransform:'uppercase' }}>Recovery index</div>
                  <div style={{ fontSize:20, fontWeight:900, color: RECOVERY_LABEL_COLOR(recoveryOut.readinessLabel) }}>{recoveryOut.overallRecoveryIndex}<span style={{ fontSize:11 }}> /100</span></div>
                  <div style={{ fontSize:11, color: RECOVERY_LABEL_COLOR(recoveryOut.readinessLabel), fontWeight:800 }}>{recoveryOut.readinessLabel}</div>
                </div>
                <div style={{ background: verdict.train? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border:`1px solid ${verdict.train? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)'}`, borderRadius:10, padding:'10px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:16 }}>{verdict.train? '✅' : '🛑'}</div>
                  <div style={{ fontSize:11, fontWeight:800, color: verdict.train? '#22c55e' : '#ef4444' }}>{verdict.train? 'Тренироваться' : 'Отдых'}</div>
                  <div style={{ fontSize:11, color: verdict.train? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)', marginTop:2, lineHeight:1.3 }}>{verdict.message}</div>
                </div>
              </div>

              <div data-intel-grid="4" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6, marginTop:8 }}>
                <MetricCard title="Сон" accent={recoveryOut.sleepScore>=65? '#22c55e':'#eab308'}><div style={{ fontSize:15, fontWeight:900, color: recoveryOut.sleepScore>=65?'#22c55e':'#eab308' }}>{recoveryOut.sleepScore}</div><div style={SMALL}>/100</div></MetricCard>
                <MetricCard title="HRV" accent={recoveryOut.hrvScore>=65?'#22c55e':'#eab308'}><div style={{ fontSize:15, fontWeight:900, color: recoveryOut.hrvScore>=65?'#22c55e':'#eab308' }}>{recoveryOut.hrvScore}</div><div style={SMALL}>/100</div></MetricCard>
                <MetricCard title="Перетрен" accent={recoveryOut.overtrainingRisk>=60?'#ef4444':'#22c55e'}><div style={{ fontSize:15, fontWeight:900, color: recoveryOut.overtrainingRisk>=60?'#ef4444':'#22c55e' }}>{recoveryOut.overtrainingRisk}</div><div style={SMALL}>/100</div></MetricCard>
                <MetricCard title={recoveryOut.supercompensationReady? 'Окно нагрузки' : 'Окно восст.'} accent={recoveryOut.supercompensationReady? "#22c55e":"#eab308"}><div style={{ fontSize:15, fontWeight:900, color: recoveryOut.supercompensationReady? '#22c55e':'#eab308' }}>{recoveryOut.supercompensationHours}ч</div><div style={SMALL}>{recoveryOut.supercompensationReady? 'суперкомпенсация есть' : 'суперкомпенсации нет'}</div></MetricCard>
              </div>

              <div style={{ marginTop:8, padding:'10px 12px', borderRadius:10, background:'rgba(34,197,94,0.05)', border:'1px solid rgba(34,197,94,0.14)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <div style={{ fontSize:11, fontWeight:800, color:'#22c55e' }}>💓 HRV-база (lnRMSSD + SWC) · {hrvBase ? `${hrvBase.n} зам. · сред. ${hrvBase.meanRmssd} мс · CV ${hrvBase.cvPct}%` : 'базы нет'}</div>
                  <button onClick={()=> { appendHrvReading(rmssd); setHrvBump(b=> b+1); const t=(window as any).showToast; if(typeof t==='function') t('💓 Утренний замер записан','success'); }} style={{ padding:'8px 12px', borderRadius:9, border:'1px solid rgba(34,197,94,0.28)', background:'rgba(34,197,94,0.10)', color:'#22c55e', fontWeight:800, fontSize:11, cursor:'pointer', minHeight:44 }}>📥 Записать замер ({rmssd} мс)</button>
                </div>
                <div style={{ fontSize:11, color:'#fff', marginTop:4, lineHeight:1.4 }}>
                  {hrvBase ? <>Сегодня: <b style={{ color: hrvState.status==='low' ? '#ef4444' : hrvState.status==='reduced' ? '#eab308' : '#22c55e' }}>{hrvState.status === 'need_base' ? '—' : `${hrvState.deltaSwc >= 0 ? '+' : ''}${hrvState.deltaSwc} SWC · ${hrvState.status}`}</b> — {hrvState.note}</> : 'Нужно ≥3 утренних замеров — сравнение с популяционной нормой запрещено (Plews/Buchheit: 20–100 мс всё норма).'}
                </div>
                <div style={{ fontSize:11, color:'#fff', marginTop:4, opacity:0.75 }}>ⓘ {HRV_PROTOCOL_NOTE}</div>
              </div>

              <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:11 }}>
                <div style={{ padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff' }}>HRV-score <b style={{ color:'#fff' }}>{recoveryOut.hrvScore}</b> · сон <b style={{ color:'#fff' }}>{recoveryOut.sleepScore}</b> · <span title="Это ваш вход готовности (самооценка/профиль), а не результат расчёта движка">готовность (вход)</span> <b style={{ color:'#fff' }}>{recoveryOut.readinessScore}</b>{recoveryOut.inputsSanitized? ' · входы нормализованы':''}</div>
                <div style={{ padding:'8px 10px', borderRadius:10, background: recoveryOut.deloadRecommended? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.06)', border:`1px solid ${recoveryOut.deloadRecommended? 'rgba(245,158,11,0.18)' : 'rgba(34,197,94,0.14)'}`, color: recoveryOut.deloadRecommended? '#f59e0b' : '#22c55e', fontWeight:700 }}>
                  {recoveryOut.deloadRecommended ? `⚠ ${recoveryOut.deloadReason}` : `✓ ${recoveryOut.deloadReason}`}
                </div>
              </div>
              {!recoveryOut.deloadRecommended && (recoveryOut.overtrainingRisk >= 60 || monoStreak.sustainedHigh || uniformStreak >= 2) && (
                <div style={{ marginTop:6, padding:'7px 10px', borderRadius:9, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.16)', fontSize:11, color:'#f59e0b', lineHeight:1.4 }}>
                  🟡 Ранний сигнал: {recoveryOut.overtrainingRisk >= 60 ? `риск перетрена ${recoveryOut.overtrainingRisk}≥60` : ''}
                  {(recoveryOut.overtrainingRisk >= 60) && (monoStreak.sustainedHigh || uniformStreak >= 2) ? ' + ' : ''}
                  {uniformStreak >= 2 ? `${uniformStreak} недели подряд ровная нагрузка (SD=0) — монотонность при этом не растёт, а риск накопления есть` : ''}
                  {uniformStreak >= 2 && monoStreak.sustainedHigh && !monoStreak.uniform ? ' + ' : ''}
                  {monoStreak.sustainedHigh && !uniformStreak ? `монотонность >2 две недели подряд (${monoStreak.current}, ${monoStreak.prev.join('/')})` : ''}
                  {' '}— запланируйте deload на следующую неделю, не дожидаясь провала восстановления.
                </div>
              )}

              {recoveryOut.recommendations.length>0 && (
                <div style={{ marginTop:8, padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:11, fontWeight:800, color:ACCENT, marginBottom:4 }}>📋 Рекомендации восстановления</div>
                  {recoveryOut.recommendations.map((r,i)=> <div key={i} style={{ fontSize:11, color:'#fff', marginTop:2, lineHeight:1.4 }}>• {r}</div>)}
                </div>
              )}

              {verdict.train && <div style={{ ...SMALL, marginTop:6, padding:'6px 10px', borderRadius:9, background: verdict.intensityMod!==0? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>Модификатор интенсивности: <b style={{ color: verdict.intensityMod>0? '#22c55e':'#eab308' }}>{verdict.intensityMod>0? '+':''}{Math.round(verdict.intensityMod*100)}%</b> · {verdict.message}</div>}

              {/* Окно восстановления ≠ повод нагружаться: вердикт всегда виден (раньше жил в свёрнутой карточке) */}
              <div style={{ marginTop:6, padding:'8px 10px', borderRadius:10, background: recoveryOut.supercompensationReady? 'rgba(34,197,94,0.07)':'rgba(245,158,11,0.07)', border:`1px solid ${recoveryOut.supercompensationReady? 'rgba(34,197,94,0.18)':'rgba(245,158,11,0.20)'}`, fontSize:11, color: recoveryOut.supercompensationReady? '#22c55e':'#f59e0b', lineHeight:1.4 }}>
                {recoveryOut.supercompensationReady
                  ? `✅ Суперкомпенсация вероятна · окно нагрузки ~${recoveryOut.supercompensationHours}ч — ${recoveryOut.supercompensationReason}.`
                  : `⚠ Суперкомпенсации нет · окно ${recoveryOut.supercompensationHours}ч — это время ВОССТАНОВЛЕНИЯ, тяжёлую сессию в него не планируем (${recoveryOut.supercompensationReason}).`}
              </div>

              {/* E7 — wellness-опросник: 5 пунктов 1–5 + флаг болезни; светофор = операционное соглашение. */}
              <div data-intel-card="wellness">
              <MetricCard title="🧭 Wellness-опросник" icon="✅" accent="#2dd4bf">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:6 }}>
                  <PopupNumber label="Сон (1 плохо…5 отлично)" value={wSleep} min={1} max={5} step={1} onChange={setWSleep} />
                  <PopupNumber label="Болезненность (1 нет…5 очень)" value={wSore} min={1} max={5} step={1} onChange={setWSore} />
                  <PopupNumber label="Настроение (1…5)" value={wMood} min={1} max={5} step={1} onChange={setWMood} />
                  <PopupNumber label="Энергия (1…5)" value={wEnergy} min={1} max={5} step={1} onChange={setWEnergy} />
                  <PopupNumber label="Стресс (1 нет…5 запредельный)" value={wStress} min={1} max={5} step={1} onChange={setWStress} />
                  <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', borderRadius:10, background: wIllness? 'rgba(239,68,68,0.10)':'rgba(255,255,255,0.04)', border:`1px solid ${wIllness? 'rgba(239,68,68,0.28)':'rgba(255,255,255,0.08)'}` }}>
                    <input type="checkbox" checked={wIllness} onChange={e=> setWIllness(e.target.checked)} aria-label="Болезнь или повышенная температура" style={{ width:20, height:20 }} />
                    <span style={{ fontSize:11, color:'#fff' }}>Болезнь / t°</span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                  <button onClick={addWellness} style={{ flex:1, minHeight:44, borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#2dd4bf,#14b8a6)', color:'#000', fontWeight:800, fontSize:11 }}>🧭 Отметить день</button>
                  {wellList.length > 0 && <button onClick={()=> { clearWellness(); setWellList([]); }} aria-label="Очистить журнал wellness" style={{ minHeight:44, padding:'10px 14px', borderRadius:10, border:'1px solid rgba(239,68,68,0.28)', background:'rgba(239,68,68,0.08)', color:'#fff', fontSize:11 }}>Очистить</button>}
                </div>
                {wellness ? (
                  <>
                    <div data-intel-grid="3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                      <div style={{ background:`${wellness.zone === 'red' ? 'rgba(239,68,68,0.10)' : wellness.zone === 'yellow' ? 'rgba(245,158,11,0.10)' : wellness.zone === 'illness' ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)'}`, borderRadius:10, padding:'8px 4px', textAlign:'center' }}>
                        <div style={{ fontSize:11, color:DIM, textTransform:'uppercase' }}>Сигналы</div>
                        <div style={{ fontSize:15, fontWeight:900, color: wellness.zone === 'green' ? '#22c55e' : wellness.zone === 'illness' ? '#ef4444' : '#f59e0b' }}>
                          {wellness.alarmSignals}
                        </div>
                        <div style={SMALL}>из {wellness.itemsFilled} пунктов</div>
                      </div>
                      <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'8px 4px', textAlign:'center' }}>
                        <div style={{ fontSize:11, color:DIM, textTransform:'uppercase' }}>Оценка</div>
                        <div style={{ fontSize:15, fontWeight:900, color:'#fff' }}>{wellness.score == null ? '—' : wellness.score}</div>
                        <div style={SMALL}>0–100 · {wellness.daysLogged}/7 дней</div>
                      </div>
                      <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'8px 4px', textAlign:'center' }}>
                        <div style={{ fontSize:11, color:DIM, textTransform:'uppercase' }}>Светофор</div>
                        <div style={{ fontSize:12, fontWeight:900, color:'#fff', lineHeight:1.3 }}>
                          {wellness.zone === 'green' ? 'зелёный' : wellness.zone === 'yellow' ? 'жёлтый' : wellness.zone === 'red' ? 'красный' : wellness.zone === 'illness' ? 'болезнь' : '—'}
                        </div>
                        <div style={SMALL}>{wellness.blocking ? 'блокирует' : 'не блокирует'}</div>
                      </div>
                    </div>
                    {wellness.signals.map((sg,i)=> <div key={i} style={{ ...SMALL, marginTop:4 }}>• {sg}</div>)}
                    <div style={{ ...SMALL, marginTop:4, opacity:0.75 }}>ⓘ {WELLNESS_PROTOCOL_NOTE}</div>
                  </>
                ) : null}
              </MetricCard>
              </div>

              <ExpandableCard title="🤸 Мобилити-флоу · прехаб" short="Лёгкая разминка и коррекционные упражнения — по готовности." full={
                <div style={SMALL}>
                  <div>До 4 флоу по 6–12 мин (разминка/прехаб) и набор корректирующих упражнений — доступны после применения, детализация в Дневнике/Мобильности.</div>
                  <div style={{ marginTop:6, color:'#fff' }}>Окно суперкомпенсации/восстановления — {recoveryOut.supercompensationHours}ч · вердикт и причина — выше (всегда видна, без раскрытия).</div>
                </div>
              } />
            </>
          )}
        </div>
      </section>

      {/* ——— АВТОРЕГУЛЯЦИЯ ——— */}
      <section id="sec-autoreg" data-intel="autoreg" ref={el=> refs.current['autoreg']=el} style={{ scrollMarginTop:56 }}>
        <div style={{ ...CARD, borderLeft:`3px solid #a855f7` }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(168,85,247,0.14)', border:'1px solid rgba(168,85,247,0.22)', fontSize:14 }}>⚙️</span>
            <div>
              <div style={{ fontSize:13, fontWeight:900, color:'#a855f7' }}>Авторегуляция</div>
              <div style={{ fontSize:11, color:DIM }}>Одна PRO-формула (готовность+ACWR+HRV+сон+усталость+RPE+VLoss) + PRI как контекст</div>
            </div>
            <span style={{ marginLeft:'auto', fontSize:11, padding:'3px 8px', borderRadius:20, background:'rgba(168,85,247,0.12)', border:'1px solid rgba(168,85,247,0.22)', color:'#a855f7', fontWeight:800 }}>PRI {pri} · {priThr.label}</span>
          </div>

          {/* PRI — контекст/объяснение; в план идёт autoReg ниже */}
          <MetricCard title={`PRI · ${priThr.label} (контекст)`} accent={pri>=70?'#22c55e': pri>=50?'#eab308':'#ef4444'}>
            <div style={{ height:8, borderRadius:99, background:'rgba(255,255,255,0.06)', overflow:'hidden', marginBottom:6 }}>
              <div style={{ width:`${pri}%`, height:'100%', background: pri>=70? 'linear-gradient(90deg,#22c55e,#16a34a)' : pri>=50? 'linear-gradient(90deg,#eab308,#f59e0b)' : 'linear-gradient(90deg,#ef4444,#dc2626)', transition:'width 0.3s' }} />
            </div>
            <div data-intel-grid="3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, fontSize:11 }}>
              <div>Объём <b style={{ color:ACCENT }}>×{priThr.volumeMod}</b></div>
              <div>RIR <b style={{ color:ACCENT }}>+{priThr.rirAdd}</b></div>
              <div>{priThr.skipTraining? 'пропуск' : priThr.desc}</div>
            </div>
          </MetricCard>

          {/* pro decisions */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
            <PopupSelect label="Цель блока (VL-пороги)" value={goal} options={[{id:'hypertrophy',label:'Гипертрофия'},{id:'strength',label:'Сила (VL строже)'}]} onChange={v=> setGoal(v as any)} />
            <div style={{ fontSize:11, color:DIM, alignSelf:'end', paddingBottom:8, lineHeight:1.4 }}>Применится именно этот блок. PRI выше — объяснение, не второй пересчёт.</div>
          </div>
          <div style={{ marginTop:8, padding:'10px 12px', borderRadius:12, background: autoReg.deload? 'rgba(239,68,68,0.07)' : 'rgba(168,85,247,0.06)', border:`1px solid ${autoReg.deload? 'rgba(239,68,68,0.16)' : 'rgba(168,85,247,0.14)'}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <div style={{ fontSize:12, fontWeight:900, color: autoReg.deload? '#ef4444' : '#a855f7' }}>{autoReg.deload? '⭐ Deload' : autoReg.intensityNote? autoReg.intensityNote : 'Авторегуляция'}</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:11, padding:'4px 8px', borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontWeight:800 }}>топ ×{autoReg.topSetPctMultiplier}</span>
                <span style={{ fontSize:11, padding:'4px 8px', borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontWeight:800 }}>объём ×{autoReg.volumeMultiplier}</span>
                <span style={{ fontSize:11, padding:'4px 8px', borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontWeight:800 }}>RIR +{autoReg.rirShift}</span>
              </div>
            </div>
            <div style={{ marginTop:6, display:'grid', gap:3 }}>
              {autoReg.decisions.map((d,i)=> <div key={i} style={{ fontSize:11, color:'#fff', lineHeight:1.4 }}>• {d}</div>)}
            </div>
            {autoReg.adjustedTopSetPct!=null && <div style={{ marginTop:6, fontSize:11, color:DIM }}>Топ-сет: {(topPct*100).toFixed(0)}% → <b style={{ color:'#fff' }}>{(autoReg.adjustedTopSetPct*100).toFixed(1)}%</b> · RIR: {planRIR} → <b style={{ color:'#fff' }}>{autoReg.adjustedRIR}</b></div>}
          </div>

          {/* RPE ↔ вес — единственный калькулятор в хабе (Epley-канон Helms/Zourdos; консенсус 7 формул — в Лаборатории) */}
          <MetricCard title="RPE ↔ вес (Epley, единственное место)" accent="#a855f7">
            <div data-intel-grid="3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:8 }}>
              <PopupNumber label="e1RM, кг" value={e1rm} min={20} max={400} onChange={setE1rm} />
              <PopupNumber label="RPE 6–10" value={rpe} min={6} max={10} step={0.5} onChange={setRpe} />
              <PopupNumber label="Повторы" value={repCnt} min={1} max={15} onChange={setRepCnt} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              <div style={{ background:'rgba(168,85,247,0.08)', borderRadius:10, padding:'10px 10px', textAlign:'center' }}>
                <div style={{ fontSize:11, color:DIM }}>Рабочий вес @ RPE</div>
                <div style={{ fontSize:16, fontWeight:900, color:'#fff' }}>{workWeight.toFixed(1)} кг</div>
                <div style={SMALL}>RIR {Math.max(0,10 - rpe)}</div>
              </div>
              <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 10px', textAlign:'center' }}>
                <div style={{ fontSize:11, color:DIM }}>Обратный RPE</div>
                <div style={{ fontSize:16, fontWeight:900, color:'#fff' }}>{rpeBack.toFixed(1)}</div>
                <div style={SMALL}>от факта веса</div>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:8 }}>
              <PopupNumber label="Топ-сет план %" value={Math.round(topPct*100)} min={50} max={100} suffix="%" onChange={v=> setTopPct(v/100)} hint="Плановый топ-сет перед авторегуляцией" />
              <PopupNumber label="План RIR" value={planRIR} min={0} max={4} onChange={setPlanRIR} />
            </div>
            <div style={{ ...SMALL, marginTop:6 }}>ⓘ Новички систематически ошибаются в RIR (Zourdos: 8.96 vs 9.80 на 1RM) — сверяйтесь с RIR-калибровкой ниже.</div>
          </MetricCard>

          {/* RIR калибрация — только если есть данные, без дубля */}
          {rirCalib && rirCalib.totalSets>0 ? (
            <ExpandableCard title={`🎯 RIR-калибрация · ${rirCalib.totalSets} подходов`} short={`bias ${rirCalib.overallAvgBias>0?'+':''}${rirCalib.overallAvgBias.toFixed(2)} · консист. ${Math.round(rirCalib.overallConsistency)}%`} full={
              <div style={SMALL}>
                <div>Системное смещение: <b style={{ color: Math.abs(rirCalib.overallAvgBias)>1? '#ef4444' : '#22c55e' }}>{rirCalib.overallAvgBias>0?'+':''}{rirCalib.overallAvgBias.toFixed(2)}</b> {rirCalib.overallAvgBias>0.5? '— тяжелее чем думаете' : rirCalib.overallAvgBias<-0.5? '— легче чем думаете' : '— в цели'}</div>
                {rirCalib.exercises.slice(0,5).map(ex=> (
                  <div key={ex.exerciseId} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ color:'#fff' }}>{ex.exerciseName}</span>
                    <span style={{ fontWeight:800, color: Math.abs(ex.avgBias)>1?'#ef4444':'#eab308' }}>{ex.avgBias>0?'+':''}{ex.avgBias.toFixed(1)} (n={ex.totalPoints})</span>
                  </div>
                ))}
                <div style={{ marginTop:6, color:DIM }}>Авторегуляция выше bias дневника не видит — это чтение для ручной правки «План RIR». В план bias уезжает тумблером «Применить калибровку» в карточке RIR-калибрации (дневник / RIR-хаб).</div>
              </div>
            } />
          ) : (
            <div style={{ ...SMALL, padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', marginTop:8 }}>
              🎯 RIR-калибрация появится после записи RPE в дневнике (≥2 подхода).
            </div>
          )}
        </div>
      </section>

      {/* ——— ПРОГНОЗ ——— */}
      <section id="sec-forecast" data-intel="forecast" ref={el=> refs.current['forecast']=el} style={{ scrollMarginTop:56 }}>
        <div style={{ ...CARD, borderLeft:`3px solid #f59e0b` }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(245,158,11,0.14)', border:'1px solid rgba(245,158,11,0.22)', fontSize:14 }}>🔮</span>
            <div>
              <div style={{ fontSize:13, fontWeight:900, color:'#f59e0b' }}>Прогноз {forecast && <span style={{ fontSize:11, padding:'2px 7px', borderRadius:10, background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.25)', color:'#f59e0b', fontWeight:800, verticalAlign:'middle' }}>{forecast.confidence === 'stable' ? 'уверенный · 7+ точек' : 'ранний · <7 точек'}</span>}</div>
              <div style={{ fontSize:11, color:DIM }}>Хольт-прогноз по истории готовности + сценарий «что-если» — единственный прогноз в хабе</div>
            </div>
          </div>

          {hist.length<3 ? (
            <div style={{ padding:'12px 10px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', ...SMALL, textAlign:'center' }}>
              Недостаточно истории ({hist.length}/3). Открывайте приложение ежедневно — готовность пишется в историю, прогноз появится.
            </div>
          ) : forecast ? (
            <>
              <div style={{ height:72, position:'relative', margin:'6px 0' }}>
                {(() => {
                  const recs = hist;
                  const all = [...recs, ...forecast.values];
                  const minV = Math.min(...all), maxV = Math.max(...all);
                  const W = 320, H = 72, pad = 8;
                  const px = (i:number)=> pad + (i / Math.max(1, all.length-1))*(W-2*pad);
                  const py = (v:number)=> H - pad - ((v-minV)/Math.max(1, maxV-minV))*(H-2*pad);
                  const histPts = recs.map((v,i)=> `${px(i)},${py(v)}`).join(' ');
                  const fcPts = forecast.values.map((v,i)=> `${px(recs.length-1+i)},${py(v)}`).join(' ');
                  return (
                    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Прогноз готовности: история ${recs.length} точек, прогноз ${forecast.values.length} дней`} style={{ display:'block', maxWidth:380, margin:'0 auto' }}>
                      <polyline points={histPts} fill="none" stroke="#60a5fa" strokeWidth={1.6} />
                      <polyline points={fcPts} fill="none" stroke={ACCENT} strokeWidth={1.7} strokeDasharray="5 4" />
                      {forecast.values.map((v,i)=> <circle key={i} cx={px(recs.length-1+i)} cy={py(v)} r={2.6} fill={ACCENT} />)}
                    </svg>
                  );
                })()}
                <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:2 }}>
                  <span style={{ fontSize:11, color:'#60a5fa' }}>● история</span>
                  <span style={{ fontSize:11, color:ACCENT }}>● прогноз Хольт</span>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {forecast.values.map((v,i)=> (
                  <div key={i} style={{ background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.12)', borderRadius:10, padding:'8px 8px', textAlign:'center' }}>
                    <div style={{ fontSize:11, color:DIM }}>+{i+1} дн</div>
                    <div style={{ fontSize:14, fontWeight:900, color: v>=70?'#22c55e': v>=50?'#eab308':'#ef4444' }}>{Math.round(v)}</div>
                    {forecast.ci95[i] && <div style={{ fontSize:11, color:'#fff' }}>ДИ {Math.round(forecast.ci95[i][0])}–{Math.round(forecast.ci95[i][1])}</div>}
                  </div>
                ))}
              </div>
              {forecast.warnings.length>0 && <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.16)', fontSize:11, color:'#ef4444' }}>{forecast.warnings.join(' ')}</div>}
            </>
          ) : null}

          <MetricCard title="Сценарий «что-если»" accent="#f59e0b">
            {!whatIf ? (
              <div style={{ ...SMALL, padding:'8px 10px', borderRadius:9, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
                Нет данных о восстановлении — сценарий не считается. В прошлой версии здесь печаталось «База: риск 22»: это была константа движка, а не ваш факт.
              </div>
            ) : (
              <>
                <div style={{ fontSize:11, color:DIM, marginBottom:6 }}>База: риск {Math.round(whatIfBase ?? 0)} · готовность {Math.round(readiness)}. Меняйте входы — получите направление сценария.</div>
                <div data-intel-grid="3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:8 }}>
                  <PopupNumber label="Δ калории" value={calDelta} min={-1000} max={1000} step={50} onChange={setCalDelta} />
                  <PopupNumber label="Δ сон, ч" value={sleepDelta} min={-2} max={2} step={1} onChange={setSleepDelta} />
                  <PopupNumber label="ААС ×" value={aasMult} min={0} max={2} step={0.5} suffix="×" onChange={setAasMult} />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
                    <div style={{ fontSize:11, color:DIM }}>Δ Риск</div>
                    <div style={{ fontSize:18, fontWeight:900, color: whatIf.riskDelta>0?'#ef4444': whatIf.riskDelta<0?'#22c55e':'#fff' }}>{whatIf.riskDelta>0?'+':''}{whatIf.riskDelta}</div>
                    <div style={{ fontSize:11, color:'#fff' }}>{Math.round((whatIfBase ?? 0)+whatIf.riskDelta)} итог</div>
                  </div>
                  <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
                    <div style={{ fontSize:11, color:DIM }}>Δ Готовность</div>
                    <div style={{ fontSize:18, fontWeight:900, color: whatIf.readinessDelta>0?'#22c55e': whatIf.readinessDelta<0?'#ef4444':'#fff' }}>{whatIf.readinessDelta>0?'+':''}{whatIf.readinessDelta}</div>
                    <div style={{ fontSize:11, color:'#fff' }}>{Math.round(readiness+whatIf.readinessDelta)} итог</div>
                  </div>
                </div>
                <div style={{ ...SMALL, marginTop:8, padding:'7px 10px', borderRadius:9, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.14)' }}>{whatIf.note}</div>
                {aasMult !== 1 && <div style={{ ...SMALL, marginTop:6, padding:'7px 10px', borderRadius:9, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.16)' }}>
                  Медикаменты меняют риск по фарма-профилю, а не по этой формуле: реальный расчёт — в «Рисках» (ТЗ-спец).
                </div>}
              </>
            )}
          </MetricCard>

          {/* E6 — прогноз нагрузки: экстраполяция EWMA + счётчик дней подряд (ориентир, не гейт). */}
          {loadFc && (
            <MetricCard title="🔮 Прогноз нагрузки · 7 дней" icon="📉" accent="#38bdf8">
              <div data-intel-grid="3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                <div style={{ background:'rgba(56,189,248,0.07)', borderRadius:10, padding:'8px 4px', textAlign:'center' }}>
                  <div style={{ fontSize:11, color:DIM, textTransform:'uppercase' }}>Уровень</div>
                  <div style={{ fontSize:15, fontWeight:900, color:'#38bdf8' }}>{loadFc.level}</div>
                  <div style={SMALL}>AU/день (EWMA)</div>
                </div>
                <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'8px 4px', textAlign:'center' }}>
                  <div style={{ fontSize:11, color:DIM, textTransform:'uppercase' }}>Неделя</div>
                  <div style={{ fontSize:15, fontWeight:900, color:'#fff' }}>{loadFc.weeklyTotal}</div>
                  <div style={SMALL}>AU · разброс {loadFc.weeklyBand[0]}–{loadFc.weeklyBand[1]}</div>
                </div>
                <div style={{ background:'rgba(245,158,11,0.06)', borderRadius:10, padding:'8px 4px', textAlign:'center' }}>
                  <div style={{ fontSize:11, color:DIM, textTransform:'uppercase' }}>Дней подряд</div>
                  <div style={{ fontSize:15, fontWeight:900, color: loadFc.consecutiveDays >= 3 ? '#f59e0b' : '#fff' }}>{loadFc.consecutiveDays}</div>
                  <div style={SMALL}>{loadFc.suggestedCap != null ? `ориентир ${loadFc.suggestedCap} AU` : 'порог не применяется'}</div>
                </div>
              </div>
              <div style={{ ...SMALL, marginTop:6 }}>💡 {loadFc.guidance}</div>
              <div style={{ ...SMALL, marginTop:2, opacity:0.75 }}>ⓘ {loadFc.note}</div>
            </MetricCard>
          )}

          {/* E6 — траектория измеримых показателей рядом с readiness (факт против оценки). */}
          <MetricCard title="📈 Траектория показателей" icon="📊" accent="#a3e635">
            <div data-intel-grid="3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:6 }}>
              {trajectory.map(s => (
                <div key={s.key} style={{ background:'rgba(163,230,53,0.06)', border:'1px solid rgba(163,230,53,0.14)', borderRadius:10, padding:'8px 4px', textAlign:'center' }}>
                  <div style={{ fontSize:11, color:DIM, textTransform:'uppercase' }}>{s.key === 'e1rm' ? 'e1RM' : s.key === 'bodyweight' ? 'Вес' : 'Объём'}</div>
                  <div style={{ fontSize:14, fontWeight:900, color: s.current == null ? DIM : '#fff' }}>{s.current == null ? '—' : Math.round(s.current)}</div>
                  <div style={{ fontSize:11, fontWeight:800, color: s.direction === 'up' ? '#22c55e' : s.direction === 'down' ? '#ef4444' : s.direction === 'flat' ? '#eab308' : DIM }}>
                    {s.changePct == null ? 'тренд нет' : `${s.changePct>0?'+':''}${s.changePct}%/нед`}
                  </div>
                </div>
              ))}
            </div>
            {trajectory.filter(s => s.points.length < 2).map(s => (
              <div key={s.key} style={{ ...SMALL, marginTop:2 }}>• {s.label}: {s.note}</div>
            ))}
            <div style={{ ...SMALL, marginTop:4, opacity:0.75 }}>ⓘ {TRAJECTORY_NOTE}</div>
          </MetricCard>

        </div>
      </section>

      {/* ——— РЕКОМЕНДАЦИИ ББ (перенесено из дневника) ——— */}
      <section id="sec-recommendations" data-intel="recommendations" ref={el=> refs.current['recommendations']=el} style={{ scrollMarginTop:56 }}>
        <div style={{ ...CARD, borderLeft:`3px solid #8b5cf6` }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.14)', border:'1px solid rgba(139,92,246,0.22)', fontSize:14 }}>💡</span>
            <div>
              <div style={{ fontSize:13, fontWeight:900, color:'#8b5cf6' }}>Рекомендации · ББ-аудит</div>
              <div style={{ fontSize:11, color:DIM }}>План / PED / питание / добавки / выполнение — единственный ББ-аудит (перенесён из дневника)</div>
            </div>
            {bbRecs && <span style={{ marginLeft:'auto', fontSize:11, padding:'3px 8px', borderRadius:20, background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.22)', color:'#8b5cf6', fontWeight:800 }}>{bbRecs.summary.total} · ⚠{bbRecs.summary.warns} · 🔴{bbRecs.summary.criticals}</span>}
          </div>
          {!bbRecs ? (
            <div style={{ ...SMALL, padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
              Нет активного ББ-плана для аудита. Соберите план в <b>ББ-авто</b> или <b>Ручном конструкторе</b> — рекомендации появятся (PED, питание, добавки, выполнение vs факт, сон, ACWR).
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {bbRecs.sections.map((sec:any, idx:number)=> (
                <div key={idx} style={{ padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:12, fontWeight:800, color:'#fff', marginBottom:4 }}>{sec.title}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {sec.items.map((it:any,i:number)=> {
                      const col = it.severity==='critical' ? '#ef4444' : it.severity==='warn' ? '#eab308' : '#60a5fa';
                      return <div key={i} style={{ display:'flex', gap:8, fontSize:11, lineHeight:1.4, color:'#fff', background:`${col}0d`, border:`1px solid ${col}22`, borderRadius:8, padding:'6px 8px' }}>
                        <span style={{ minWidth:6, height:6, borderRadius:6, background:col, marginTop:6, flexShrink:0 }} />
                        <span>{it.text}</span>
                        {it.severity!=='info' && <span style={{ marginLeft:'auto', fontSize:11, padding:'2px 6px', borderRadius:10, background:`${col}18`, color:col, fontWeight:800, whiteSpace:'nowrap' }}>{it.severity==='critical'?'🔴 крит':'⚠ варн'}</span>}
                      </div>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ——— E8: ОТЧЁТ ТРЕНЕРУ (неделя vs прошлая + все 5 секций + чек-лист решений) ——— */}
      <section id="sec-coach" data-intel="coach" data-intel-card="coach-report" ref={el=> refs.current['coach']=el} style={{ scrollMarginTop:56 }}>
        <div style={{ ...CARD, borderLeft:'3px solid #0ea5e9' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:900, color:'#0ea5e9' }}>📤 Отчёт тренеру</div>
              <div style={{ fontSize:11, color:DIM }}>Неделя {coachReport.rollup.from} … {coachReport.rollup.to} против предыдущей · все 5 секций хаба · чек-лист решений</div>
            </div>
            {history.length > 0 && <span style={{ marginLeft:'auto', fontSize:11, padding:'3px 8px', borderRadius:20, background:'rgba(14,165,233,0.14)', color:'#7dd3fc' }}>решений в журнале: {history.length}</span>}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
            {coachReport.rollup.rows.slice(0, 4).map(r => (
              <div key={r.key} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 6px' }}>
                <div style={{ fontSize:11, color:DIM, textTransform:'uppercase' }}>{r.label}</div>
                <div style={{ fontSize:14, fontWeight:900, color:'#fff' }}>{r.current == null ? '—' : `${r.current} ${r.unit}`}</div>
                <div style={{ fontSize:11, color:DIM }}>
                  {r.previous == null ? 'было: нет данных' : `было: ${r.previous} ${r.unit}`}
                  {r.deltaPct != null ? ` · ${r.deltaPct > 0 ? '+' : ''}${r.deltaPct}%` : ''}
                </div>
              </div>
            ))}
          </div>
          <details>
            <summary style={{ ...SMALL, cursor:'pointer', color:'#7dd3fc' }}>Все строки недели ({coachReport.rollup.rows.length}) с оговорками</summary>
            <div style={{ marginTop:6, display:'flex', flexDirection:'column', gap:4 }}>
              {coachReport.rollup.rows.map(r => (
                <div key={r.key} style={{ ...SMALL, color:'#fff' }}>
                  <b>{r.label}</b>: {r.current == null ? '—' : `${r.current} ${r.unit}`}
                  {r.previous == null ? '' : ` (было ${r.previous} ${r.unit}${r.deltaPct != null ? `, ${r.deltaPct > 0 ? '+' : ''}${r.deltaPct}%` : ''})`}
                  {r.note ? <span style={{ color:DIM }}> — {r.note}</span> : null}
                </div>
              ))}
            </div>
          </details>

          <div style={{ ...SMALL, marginTop:8, marginBottom:6, color:'#fff' }}>
            <b>🧾 Чек-лист решений недели:</b>{' '}
            {coachReport.rollup.decisions.length === 0
              ? 'решений не записано — поставьте «Применить» или «Отклонить» в блоке коррекции.'
              : coachReport.rollup.decisions.map(d => `${d.applied ? '✅ Применено' : '⛔ Отклонено'} ${d.label}`).join(' · ')}
          </div>

          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <button onClick={()=> printIntelHtml(buildCoachReportHtml(coachReport))} style={{ flex:1, minHeight:44, borderRadius:10, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:11 }}>🖨 Печать/PDF</button>
            <button onClick={()=> downloadIntelFile(buildCoachReportHtml(coachReport), 'intellect-coach-report.html')} style={{ flex:1, minHeight:44, borderRadius:10, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:11 }}>📄 Файл тренеру</button>
            <button onClick={()=> downloadIntelFile(buildCoachReportCsv(coachReport), 'intellect-coach-report.csv')} style={{ flex:1, minHeight:44, borderRadius:10, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:11 }}>📊 CSV</button>
            <button onClick={()=> shareIntelText('Интеллект тренировки — неделя', buildCoachDigestText(coachReport))} style={{ flex:1, minHeight:44, borderRadius:10, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:11 }}>📋 Дайджест</button>
          </div>
          <div style={{ ...SMALL, marginTop:6, color:DIM }}>
            Экспорт включает: неделю vs прошлую, все 5 секций, чек-лист решений, рекомендации ББ (если есть план) и границы применимости (ACWR ≠ прогноз травмы, wellness/CMJ ≠ диагноз).
          </div>
        </div>
      </section>

      {/* ——— единый итог и применение ——— */}
      <div style={{ ...CARD, background:'linear-gradient(135deg,rgba(0,230,138,0.09),rgba(59,130,246,0.06))', border:'1px solid rgba(0,230,138,0.20)', padding:14 }}>
        <div style={{ fontSize:12, fontWeight:900, color:ACCENT, marginBottom:4 }}>🧩 Итоговая коррекция — одна кнопка вместо семи</div>
        <div data-intel-grid="3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:8 }}>
          <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
            <div style={{ fontSize:11, color:DIM }}>ACWR</div>
            <div style={{ fontSize:13, fontWeight:900, color:ZONE_META[acwr.zone].color }}>{acwr.ratio.toFixed(2)} · {ZONE_META[acwr.zone].label}</div>
            <div style={{ fontSize:11, color:DIM }}>{acwr.zone==='dangerous'? 'deload' : acwr.zone==='caution'? 'RIR+1' : 'ок'}</div>
          </div>
          <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
            <div style={{ fontSize:11, color:DIM }}>Recovery</div>
            <div style={{ fontSize:13, fontWeight:900, color: recoveryOut? RECOVERY_LABEL_COLOR(recoveryOut.readinessLabel) : '#fff' }}>{recoveryOut? `${recoveryOut.overallRecoveryIndex} · ${recoveryOut.readinessLabel}` : '—'}</div>
            <div style={{ fontSize:11, color:DIM }}>{recoveryOut?.deloadRecommended? 'deload' : 'ок'}</div>
          </div>
          <div style={{ background:'rgba(168,85,247,0.08)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
            <div style={{ fontSize:11, color:DIM }}>PRI/autoReg</div>
            <div style={{ fontSize:13, fontWeight:900, color:'#a855f7' }}>×{autoReg.volumeMultiplier} · +{autoReg.rirShift}</div>
            <div style={{ fontSize:11, color: autoReg.deload? '#ef4444':'#fff' }}>{autoReg.deload? 'deload' : 'применить'}</div>
          </div>
        </div>
        <div style={{ ...SMALL, padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', marginBottom:10, lineHeight:1.45 }}>
          <b style={{ color:'#fff' }}>Что применится:</b> объём <b style={{ color:ACCENT }}>×{autoReg.volumeMultiplier}</b> · RIR <b style={{ color:ACCENT }}>+{autoReg.rirShift}</b> ·
          топ-сет <b style={{ color:ACCENT }}>{(autoReg.adjustedTopSetPct ?? topPct)!=null ? `${((autoReg.adjustedTopSetPct ?? topPct)*100).toFixed(1)}%` : '—'}</b> <span style={{ color:DIM }}>(ориентир — в планировщик едут объём/RIR, вес правится вручную)</span>
          { (autoReg.deload || !!recoveryOut?.deloadRecommended) && <span style={{ color:'#ef4444', fontWeight:800 }}> · deload (одним пейлоадом kind=deload)</span> }.
          Forecast {forecast && forecast.values.length ? `→ ${Math.round(forecast.values[0])}` : '—'} + what-if ΔГ {whatIf ? `${whatIf.readinessDelta>=0?'+':''}${whatIf.readinessDelta}` : '— (нет базы восстановления)'} — информативно, в план не пишется.
          <span style={{ color:DIM }}> Канал: pri (планировщик покажет баннер и пересчитает).</span>
        </div>
                <button onClick={applyUnified} disabled={applyDisabled} aria-disabled={applyDisabled} style={{ width:'100%', minHeight:46, borderRadius:12, border:'none', cursor: applyDisabled? 'not-allowed':'pointer', background: applyDisabled? 'rgba(255,255,255,0.06)':'linear-gradient(135deg,#00e68a,#00c853)', color: applyDisabled? 'rgba(255,255,255,0.55)':'#000', fontWeight:900, fontSize:13, boxShadow: applyDisabled? 'none':'0 6px 18px rgba(0,230,138,0.22)' }}>
          {applyDisabled ? '⚠ Нет данных о нагрузке — добавьте сессию sRPE' : `🛠 Применить к планировщику — объём ×${autoReg.volumeMultiplier} · RIR +${autoReg.rirShift} ${(autoReg.deload || !!recoveryOut?.deloadRecommended) ? '· deload' : ''}`}
        </button>
        <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
          <button onClick={()=> recordDecision(false)} style={{ flex:1, minHeight:44, borderRadius:12, border:'1px solid rgba(239,68,68,0.28)', background:'rgba(239,68,68,0.08)', color:'#fff', fontSize:11, cursor:'pointer' }}>
            ⛔ Не применять (в журнал недели)
          </button>
          <button onClick={()=>{ setHistory([]); clearIntelHistory(); toastIntel('🧹 Журнал решений очищен', 'info'); }} style={{ flex:1, minHeight:44, borderRadius:12, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:11, cursor:'pointer' }}>
            🧹 Очистить журнал решений
          </button>
        </div>
        <div style={{ ...SMALL, marginTop:4, color:DIM }}>
          Отказ ничего не отправляет в планировщик — он честно попадает в чек-лист недели, чтобы тренер видел решение, а не молчание.
        </div>
        <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
          <button onClick={()=>{
            try {
              const html = buildIntelHtml(sessions, { acwr: acwr.ratio.toFixed(2), acwrZone: ZONE_META[acwr.zone].label, recovery: recoveryOut ? `${recoveryOut.overallRecoveryIndex} · ${recoveryOut.readinessLabel}` : '—', pri: `${pri} · ${priThr.label}`, volumeMult: autoReg.volumeMultiplier, rirShift: autoReg.rirShift, deload: autoReg.deload || !!recoveryOut?.deloadRecommended, forecast: forecast ? `${Math.round(forecast.values[0])}` : '—', generatedAt: new Date().toISOString().slice(0,10) });
              const w = window.open('', '_blank');
              if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
              else { const t=(window as any).showToast; if(typeof t==='function') t('⚠ Всплывающие окна заблокированы','warning'); }
            } catch { /* ignore */ }
          }} style={{ flex:1, minHeight:44, borderRadius:10, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.04)', color:'#fff', fontWeight:800, fontSize:12, cursor:'pointer' }}>🖨 HTML</button>
          <button onClick={()=>{
            try {
              const blob = new Blob([buildIntelCsv(sessions)], { type: 'text/csv;charset=utf-8' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob); a.download = 'intellect-srpe.csv'; a.click();
              setTimeout(()=> URL.revokeObjectURL(a.href), 2000);
            } catch { /* ignore */ }
          }} style={{ flex:1, minHeight:44, borderRadius:10, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.04)', color:'#fff', fontWeight:800, fontSize:12, cursor:'pointer' }}>📥 CSV</button>
          <button onClick={()=>{
            try {
              const ics = buildIntelDeloadIcs(autoReg.deload || !!recoveryOut?.deloadRecommended);
              const t = (window as any).showToast;
              if (!ics) { if(typeof t==='function') t('Deload не требуется — событие не создано','info'); return; }
              const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob); a.download = 'intellect-deload.ics'; a.click();
              setTimeout(()=> URL.revokeObjectURL(a.href), 2000);
              if(typeof t==='function') t('📅 Deload-неделя сохранена в календарь','success');
            } catch { /* ignore */ }
          }} style={{ flex:1, minHeight:44, borderRadius:10, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.04)', color:'#fff', fontWeight:800, fontSize:12, cursor:'pointer' }}>📅 Deload .ics</button>
        </div>
        <div style={{ ...SMALL, textAlign:'center', marginTop:6 }}>Источники: Foster/Impellizzeri sRPE, Gabbett/Rollinson ACWR, Banister FF, Helms RIR/RPE, Zatsiorsky, Holt (1957). Без выдумок.</div>
      </div>

      <div style={{ ...SMALL, textAlign:'center', marginTop:10 }}>
        Единый хаб без дублей — ACWR только в «Нагрузке», recovery/shouldTrain только в «Восстановлении», PRI/вес только в «Авторегуляции», Хольт/what-if только в «Прогнозе». Связный конвейер, а не 4 разрозненных вкладки.
      </div>
    </div>
  );
};

export default UnifiedIntelligenceHub;

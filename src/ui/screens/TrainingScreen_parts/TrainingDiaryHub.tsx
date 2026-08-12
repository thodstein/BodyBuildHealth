import React, { useState, useMemo, useEffect } from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { Sparkline } from './Sparkline';
import { OneRmCalcTab } from './OneRmCalcTab';
import { PlateCalcTab } from './PlateCalcTab';
import { StrengthDiary, type StrengthStats, type WeeklyProgress } from '../../../engines/strength-diary.engine';
import { epley1RM } from '../../../engines/e1rm';
import type { WorkoutLog, TrainingOutput } from '../../../core/types';
import { computeAnalytics } from '../../../engines/analytics-engine';
import { weeklySetsByGroup } from '../../../engines/training-recommendations.engine';
import { LEVEL_VOLUMES } from '../../../engines/training.engine';
import type { MacrocyclePlan } from '../../../engines/training-periodization.engine';
import { generateWeeklyReport, analyzeMeasurements, loadMeasurements, saveMeasurement, type BodyMeasurement } from '../../../engines/log-analytics-progression.engine';
import { buildVisualDashboard, computeWeeklyChart, computeMuscleVolume, computeProgression, type VizSessionData } from '../../../engines/training-visualization.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads, weeklyMonotony } from '../../../engines/pro/training-load.engine';
import { loadReadinessHistory } from './readiness-history';
import { RIRCalibrationCard } from './RIRCalibrationCard';
import MesoCorrectionCard from './MesoCorrectionCard';
import { MuscleProgressCard } from './MuscleProgressCard';
import { VolumeTrendCard } from './VolumeTrendCard';
import { LoadRadarCard } from './LoadRadarCard';
import { WeekCompareCard } from './WeekCompareCard';
import { LiftHistoryCard } from './LiftHistoryCard';
import { AnalyticsTab } from './AnalyticsTab';
import { StructuredAnalyticsCard } from './StructuredAnalyticsCard';
import AllExercisesTrendCard from './AllExercisesTrendCard';
import StandardForecastCard from './StandardForecastCard';
import VolumeRecoveryCorrelationCard from './VolumeRecoveryCorrelationCard';
import StickingPointAnalysisCard from './StickingPointAnalysisCard';
import { TrainingRecommendationsCard } from './TrainingRecommendationsCard';
import { loadRirCalibrationStats } from '../../../engines/meso-correction.engine';
import { useDataLink } from '../../../core/data-link';
import { QuickEntry } from './QuickEntry';
import { DiaryRecordingForm } from './DiaryRecordingForm';
import { TrainingCalendarTab } from './TrainingCalendarTab';
import MMCTrackingCard from './MMCTrackingCard';
import { CheckinMetricsCard } from './CheckinMetricsCard';
import { CsvImportTab } from './CsvImportTab';
import { useIsMobile } from './useIsMobile';
import { getStorageTrimWarning, clearStorageTrimWarning, getISOWeekNumber, getISOWeekYear, findDuplicateWorkouts } from '../../../engines/workout-logger.engine';
import { migrateWeightLogLegacy, getWeightLog, saveWeightLog } from '../../../engines/profile-store';
import { PL_NORM_TABLES, classifyTotal, RANK_LABELS, type Discipline } from '../../../engines/pl-norms.engine';
import type { ProgressionAlert } from '../../../engines/strength-diary.engine';
import { ACCENT, DIM, GRP_RU, GROUP_COLORS, diaryCard, diaryLabel, diaryInput, diaryBtn, diaryStyles } from './diary-tokens';
import { MiniLineChart, MiniBarChart } from './DiaryChart';
import { SessionEditorModal } from './SessionEditorModal';
import { WorkoutWeekCard, ProgressChartsCard, WorkoutComparisonCard, ExerciseSubstitutionCard, WarmupRampCard, SectionHeader, DiaryEmptyState } from './diary-cards';
import { DiaryAnalyticsView } from './DiaryAnalyticsView';
import { DiaryProgressView } from './DiaryProgressView';
import { DiaryHubContext, type DiaryHubCtx } from './diary-hub-context';

/* ─── RecordModeSelector — sub-mode toggle for record (quick vs full) ─── */
const RecordModeSelector: React.FC<{
  diary: StrengthDiary;
  historyWorkouts: WorkoutLog[];
  selectedWeek: number;
  onSave: () => void;
  sub: 'quick' | 'full';
  onSubChange: (s: 'quick' | 'full') => void;
  pendingTemplate?: any;
  templateKey?: number;
  onTemplateApplied?: () => void;
}> = ({ diary, historyWorkouts, selectedWeek, onSave, sub, onSubChange, pendingTemplate, templateKey, onTemplateApplied }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {([['quick', '⚡ Быстро'], ['full', '📝 Подробно']] as const).map(([k, l]) => (
          <button key={k} onClick={() => onSubChange(k)} style={{
            flex: 1, padding: '8px 12px', borderRadius: 8,
            border: sub === k ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
            background: sub === k ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)',
            color: sub === k ? 'var(--accent)' : 'var(--text-dim)',
            fontWeight: sub === k ? 700 : 400, fontSize: 11, cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>
      {sub === 'quick' ? (
        <QuickEntry diary={diary} historyWorkouts={historyWorkouts} selectedWeek={selectedWeek} onSave={onSave} />
      ) : (
        <DiaryRecordingForm diary={diary} selectedWeek={selectedWeek} onSave={onSave} historyWorkouts={historyWorkouts}
          pendingTemplate={pendingTemplate} templateKey={templateKey} onTemplateApplied={onTemplateApplied} />
      )}
    </div>
  );
};

/* Токены дневника (ACCENT/DIM/GRP_RU/GROUP_COLORS) — общие, из diary-tokens.ts */

const style = diaryStyles;

interface TrainingDiaryHubProps {
  initialMode?: 'record' | 'tools' | 'diary' | 'reports' | 'history' | 'analytics' | 'progress' | 'calendar' | 'checkin' | 'mmc';
  diary: StrengthDiary;
  diaryStats: StrengthStats[];
  diaryProgress: WeeklyProgress[];
  historyWorkouts: WorkoutLog[];
  macrocycle: MacrocyclePlan | null;
  selectedWeek: number;
  level: string;
  onRefresh: () => void;
  onGoRecord?: () => void;
  trainingOutput: TrainingOutput | null;
  goal: string;
  daysPerWeek: number;
  splitType: string;
  periodizationType: string;
  mesoLength: number;
  tprofile: any;
  linked: any;
}

type HubMode = 'record' | 'history' | 'analytics' | 'progress' | 'tools' | 'calendar' | 'checkin' | 'mmc';

export const TrainingDiaryHub: React.FC<TrainingDiaryHubProps> = ({
  initialMode, diary, diaryStats, diaryProgress, historyWorkouts, macrocycle, selectedWeek, level, onRefresh, onGoRecord,
  trainingOutput, goal, daysPerWeek, splitType, periodizationType, mesoLength, tprofile, linked,
}) => {
  const resolvedMode: HubMode = initialMode === 'diary' ? 'record' : initialMode === 'reports' ? 'tools' : (initialMode as HubMode) || 'record';
  const [mode, setMode] = useState<HubMode>(resolvedMode);
  // The hub is reused while the parent tab changes. Keep the visible content
  // in sync instead of relying on a remount/key as an accidental reset.
  useEffect(() => { setMode(resolvedMode); }, [resolvedMode]);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [exPickerOpen, setExPickerOpen] = useState(false);
  const [exSearch, setExSearch] = useState('');
  const [notesPickerOpen, setNotesPickerOpen] = useState(false);
  const [notesFilter, setNotesFilter] = useState('');
  const isMobile = useIsMobile();
  const [historyExpanded, setHistoryExpanded] = useState<string | null>(null);
  const [hubAnalyticsExpanded, setHubAnalyticsExpanded] = useState(false);
  const [barTooltip, setBarTooltip] = useState<{ group: string; sets: number; week: number; x: number; y: number } | null>(null);
  // Режим записи (быстро/подробно) + предзаполнение из плана дня
  const [recordSub, setRecordSub] = useState<'quick' | 'full'>('quick');
  const [planToRecord, setPlanToRecord] = useState<{ day: any; nonce: number } | null>(null);

  // Progress state

  // Progress state
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [repData, setRepData] = useState<any>(null);
  const [mWeight, setMWeight] = useState(80);
  const [mWaist, setMWaist] = useState(85);
  const [mChest, setMChest] = useState(100);
  const [mArm, setMArm] = useState(38);
  const [mThigh, setMThigh] = useState(60);
  const [mDate, setMDate] = useState(new Date().toISOString().split('T')[0]);

  // Reports state
  const [trainingReportGenerated, setTrainingReportGenerated] = useState(false);
  const [trainingArchive, setTrainingArchive] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_training_reports') || '[]'); } catch { return []; }
  });

  // Дубли хранилища (диагностика + очистка)
  const [dupes, setDupes] = useState<ReturnType<typeof findDuplicateWorkouts> | null>(null);
  const [dupesBusy, setDupesBusy] = useState(false);

  // Session editing / deletion / progression alerts / storage trim warning
  const [editingWorkout, setEditingWorkout] = useState<WorkoutLog | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [progressionAlerts, setProgressionAlerts] = useState<ProgressionAlert[]>([]);
  const [trimWarning, setTrimWarning] = useState(() => getStorageTrimWarning());

  // Напоминание «тренировка по плану» (Notification API + localStorage pref)
  const [reminderTime, setReminderTime] = useState<string | null>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('he_diary_reminder') || 'null');
      if (raw && raw.date === new Date().toISOString().slice(0, 10)) return raw.time || null;
      return null;
    } catch { return null; }
  });
  const scheduleReminder = (time: string, plannedName: string, plannedExercises: string[]) => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      void Notification.requestPermission().then(p => { if (p === 'granted') scheduleReminder(time, plannedName, plannedExercises); });
      return;
    }
    if (Notification.permission !== 'granted') return;
    const [h, m] = time.split(':').map(Number);
    const now = new Date();
    const target = new Date(); target.setHours(h || 18, m || 0, 0, 0);
    const delay = target.getTime() - now.getTime();
    if (delay <= 0) return;
    setTimeout(() => {
      try { new Notification('🏋️ Тренировка по плану', { body: `${plannedName} — ${plannedExercises.length} упр.` }); } catch {}
    }, delay);
    try { localStorage.setItem('he_diary_reminder', JSON.stringify({ date: new Date().toISOString().slice(0, 10), time })); } catch {}
    setReminderTime(time);
  };
  useEffect(() => {
    let cancelled = false;
    diary.checkProgressionAlerts().then(alerts => { if (!cancelled) setProgressionAlerts(alerts); }).catch(() => {});
    return () => { cancelled = true; };
  }, [diary, historyWorkouts]);

  const handleEditWorkout = (w: WorkoutLog) => { setEditingWorkout(w); };
  const handleDeleteWorkout = async (id: string) => {
    setConfirmDeleteId(null);
    await diary.deleteWorkoutLog(id);
    onRefresh();
  };

  // History exercise filter
  const [historyExerciseFilter, setHistoryExerciseFilter] = useState('');
  const [mesoFilter, setMesoFilter] = useState<string>('all');
  const mesoIds = useMemo(() => Array.from(new Set(historyWorkouts.map(w => (w as any).mesocycleId).filter((x): x is string => !!x))), [historyWorkouts]);
  const allExerciseNames = useMemo(() => {
    const names = new Set<string>();
    historyWorkouts.forEach(w => w.exercises?.forEach((e: any) => names.add(e.exerciseName || e.exerciseId)));
    return Array.from(names).sort();
  }, [historyWorkouts]);
  const filteredHistoryWorkouts = useMemo(() => {
    if (!historyExerciseFilter) return historyWorkouts;
    return historyWorkouts.map(w => ({
      ...w,
      exercises: w.exercises.filter((e: any) => (e.exerciseName || e.exerciseId).toLowerCase().includes(historyExerciseFilter.toLowerCase())),
    })).filter(w => w.exercises.length > 0);
  }, [historyWorkouts, historyExerciseFilter]);

  useEffect(() => {
    const m = loadMeasurements();
    setMeasurements(m);
    if (m.length > 0) {
      const last = m[m.length - 1];
      setMWeight(last.weightKg || 80);
      setMWaist(last.waistCm || 85);
      setMChest(last.chestCm || 100);
      setMArm(last.armLeftCm || last.armRightCm || 38);
      setMThigh(last.thighLeftCm || last.thighRightCm || 60);
    }
    try { if (localStorage.getItem('he_training_report_current')) setTrainingReportGenerated(true); } catch {}
  }, []);
  const measureAnalytics = useMemo(() => analyzeMeasurements(linked?.profile?.settings?.personal?.height || 175), [measurements.length]);

  useEffect(() => {
    if (historyWorkouts.length > 0) {
      const logs: any[] = [];
      historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
        (e.sets || []).forEach((s: any) => logs.push({ date: w.date, exercise: e.exerciseName || e.exerciseId, weight: s.weight, reps: s.reps, rpe: 7 }));
      }));
      if (logs.length > 0) setRepData(generateWeeklyReport(logs, logs.map((l: any) => ({ date: l.date, durationMin: 60 }))));
    }
  }, [historyWorkouts]);

  const saveMeasurementHandler = () => {
    const last = measurements.length > 0 ? measurements[measurements.length - 1] : null;
    const updated = saveMeasurement({
      date: mDate,
      weightKg: mWeight,
      waistCm: mWaist,
      chestCm: mChest,
      armLeftCm: mArm || last?.armLeftCm || 0,
      armRightCm: mArm || last?.armRightCm || 0,
      thighLeftCm: mThigh || last?.thighLeftCm || 0,
      thighRightCm: mThigh || last?.thighRightCm || 0,
      calfLeftCm: last?.calfLeftCm || 0,
      calfRightCm: last?.calfRightCm || 0,
      neckCm: last?.neckCm || 0,
      hipCm: last?.hipCm || 0,
      shoulderCm: last?.shoulderCm || 0,
      forearmLeftCm: last?.forearmLeftCm || 0,
      forearmRightCm: last?.forearmRightCm || 0,
      bodyFatPercent: last?.bodyFatPercent || 0,
      notes: '',
    });
    setMeasurements(updated);
  };

  // Analytics
  const analytics = useMemo(() => {
    if (historyWorkouts.length === 0) return null;
    try {
      const mapped = historyWorkouts.map(w => ({
        sessionId: w.id, date: w.date, focus: w.split || 'fullbody', durationMin: w.duration || 60,
        sets: (w.exercises || []).flatMap((ex: any) => (ex.sets || []).map((s: any, i: number) => ({
          exerciseId: ex.exerciseId || ex.name || 'unknown', exerciseName: ex.name || 'Exercise',
          reps: s.reps || 0, weight: s.weight || 0, rpe: s.rpe || 5, rir: s.rir || 3, date: w.date, setIndex: i,
        }))),
      }));
      if (!mapped.some(m => m.sets.length > 0)) return null;
      return computeAnalytics({ sessions: mapped, weeks: 4 });
    } catch { return null; }
  }, [historyWorkouts]);

  const wsg = useMemo(() => weeklySetsByGroup(historyWorkouts, 8), [historyWorkouts]);
  const groups = useMemo(() => Object.keys(wsg).sort((a, b) => (wsg[b]?.reduce((s: number, x: number) => s + x, 0) || 0) - (wsg[a]?.reduce((s: number, x: number) => s + x, 0) || 0)), [wsg]);
  const totals = useMemo(() => Array.from({ length: 8 }, (_, i) => groups.reduce((s, g) => s + (wsg[g]?.[i] || 0), 0)), [wsg, groups]);

  const groupedHistory = useMemo(() => {
    const map = new Map<string, WorkoutLog[]>();
    for (const w of historyWorkouts) {
      const week = w.weekNumber ? `Неделя ${w.weekNumber}` : w.date.slice(0, 7);
      if (!map.has(week)) map.set(week, []);
      map.get(week)!.push(w);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [historyWorkouts]);
  const filteredHistory = useMemo(() => {
    let result = search ? groupedHistory.filter(([week]) => week.toLowerCase().includes(search.toLowerCase())) : groupedHistory;
    if (filterGroup !== 'all') {
      result = result.map(([week, workouts]) => [
        week,
        workouts.filter(w => (w.exercises || []).some((e: any) => {
          const cat = EXERCISE_CATALOG.find((c: any) => c.id === e.exerciseId);
          return cat?.group === filterGroup;
        })),
      ] as [string, WorkoutLog[]]).filter(([, ws]) => ws.length > 0);
    }
    if (historyExerciseFilter) {
      const q = historyExerciseFilter.toLowerCase();
      result = result.map(([week, workouts]) => [
        week,
        workouts.filter(w => (w.exercises || []).some((e: any) => (e.exerciseName || e.exerciseId || '').toLowerCase().includes(q))),
      ] as [string, WorkoutLog[]]).filter(([, ws]) => ws.length > 0);
    }
    if (notesFilter) {
      const q = notesFilter.toLowerCase();
      result = result.map(([week, workouts]) => [
        week,
        workouts.filter(w => (w.notes || '').toLowerCase().includes(q) || (w.split || '').toLowerCase().includes(q)),
      ] as [string, WorkoutLog[]]).filter(([, ws]) => ws.length > 0);
    }
    if (mesoFilter !== 'all') {
      result = result.map(([week, workouts]) => [
        week,
        workouts.filter(w => (w as any).mesocycleId === mesoFilter),
      ] as [string, WorkoutLog[]]).filter(([, ws]) => ws.length > 0);
    }
    return result;
  }, [groupedHistory, search, filterGroup, historyExerciseFilter, notesFilter, mesoFilter]);

  const curPhase = useMemo(() => {
    if (!macrocycle) return null;
    for (const m of macrocycle.mesocycles) {
      if (selectedWeek >= m.weekStart + 1 && selectedWeek <= m.weekStart + m.weeks) return m;
    }
    return null;
  }, [macrocycle, selectedWeek]);
  const PHASE_RU: Record<string, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', peaking: 'Пик', deload: 'Разгрузка', recovery: 'Восстановление' };

  // Visual analytics
  const vizSessions: VizSessionData[] = useMemo(() => historyWorkouts.map((s: any) => ({
    week: s.weekNumber || 1, date: s.date || '',
    exercises: (s.exercises || []).map((e: any) => ({
      name: e.exerciseName || e.name || '', sets: e.sets?.length || 0,
      reps: Math.max(...(e.sets || [{ reps: 0 }]).map((st: any) => st.reps || 0), 0),
      weight: Math.max(...(e.sets || [{ weight: 0 }]).map((st: any) => st.weight || 0), 0),
      rpe: 7, volume: e.totalVolume || 0,
    })),
  })), [historyWorkouts]);
  const visDashboard = useMemo(() => { try { return historyWorkouts.length > 2 ? buildVisualDashboard(vizSessions) : null; } catch { return null; } }, [vizSessions]);
  const visWeekly = useMemo(() => { try { return computeWeeklyChart(vizSessions); } catch { return []; } }, [vizSessions]);
  const visMuscleVol = useMemo(() => { try { return computeMuscleVolume(vizSessions); } catch { return []; } }, [vizSessions]);
  const visProg = useMemo(() => { try { return computeProgression(vizSessions); } catch { return []; } }, [vizSessions]);

  // Expert analytics data
  const expertSrpe = useMemo(() => { try { return loadSRPESessions(); } catch { return []; } }, []);
  const expertAcwr = useMemo(() => expertSrpe.length >= 2 ? acuteChronicRatio(toDailyLoads(expertSrpe)).ratio : 1.0, [expertSrpe]);
  const expertMono = useMemo(() => { try { return expertSrpe.length >= 7 ? weeklyMonotony(toDailyLoads(expertSrpe)).monotony : 0; } catch { return 0; } }, [expertSrpe]);
  const expertExercises = useMemo(() => {
    const exMap = new Map<string, { first: number; last: number }>();
    for (const w of historyWorkouts) {
      const exs: any[] = (w as any).exercises || [];
      for (const ex of exs) {
        const nm = ex.name || ex.exerciseId || '?';
        if (!exMap.has(nm)) exMap.set(nm, { first: 0, last: 0 });
        const v = epley1RM(ex.weight || 0, ex.reps || 0);
        const cur = exMap.get(nm)!;
        if (!cur.first || (v > 0 && v < cur.first)) cur.first = v;
        if (v > cur.last) cur.last = v;
      }
    }
    return Array.from(exMap.entries()).filter(([, v]) => v.first > 0 && v.last > 0).slice(0, 10)
      .map(([name, v]) => ({ name, e1rmBefore: Math.round(v.first), e1rmAfter: Math.round(v.last) }));
  }, [historyWorkouts]);
  const expertRecentVol = useMemo(() => historyWorkouts.slice(-14).reduce((s: number, w: any) => s + ((w.exercises || []).length), 0), [historyWorkouts]);
  const expertRirStats = useMemo(() => { try { return loadRirCalibrationStats(); } catch { return { bias: 0, stdDev: 1, sessions: 0 }; } }, []);
  const clearTrimWarning = () => { clearStorageTrimWarning(); setTrimWarning(null); };

  const hub: DiaryHubCtx = {
    mode, setMode, onGoRecord, onRefresh,
    historyWorkouts, diaryProgress, diaryStats, level, tprofile, linked,
    trainingOutput, macrocycle, selectedWeek, mesoLength, curPhase,
    analytics, wsg, groups, totals,
    visDashboard, visWeekly, visMuscleVol, visProg,
    expertSrpe, expertAcwr, expertMono, expertExercises, expertRecentVol, expertRirStats,
    measurements, setMeasurements,
    mWeight, setMWeight, mWaist, setMWaist, mChest, setMChest, mArm, setMArm, mThigh, setMThigh, mDate, setMDate,
    saveMeasurementHandler, measureAnalytics, repData,
    hubAnalyticsExpanded, setHubAnalyticsExpanded, barTooltip, setBarTooltip,
    progressionAlerts, trimWarning, setTrimWarning, clearTrimWarning,
    mesoIds, mesoFilter, setMesoFilter, search, setSearch, filterGroup, setFilterGroup,
    historyExerciseFilter, setHistoryExerciseFilter, notesFilter, setNotesFilter,
    allExerciseNames, groupedHistory, filteredHistory,
    handleEditWorkout, handleDeleteWorkout, confirmDeleteId, setConfirmDeleteId,
    editingWorkout, setEditingWorkout,
    recordSub, setRecordSub, planToRecord, setPlanToRecord,
    reminderTime, scheduleReminder,
    dupes, setDupes, dupesBusy, setDupesBusy,
  };

  return (
    <DiaryHubContext.Provider value={hub}>
    <div key={mode} className="diary-mode-pop" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Program context header */}
      {macrocycle && curPhase && (
        <div style={{ ...style.card, border: '1px solid rgba(0,230,138,0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Текущая программа</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{macrocycle.totalWeeks}-нед макроцикл</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Фаза: <b>{PHASE_RU[curPhase.type] || curPhase.type}</b> · Нед {selectedWeek}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Сплит</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#60a5fa' }}>{historyWorkouts[0]?.split || '—'}</div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODE: RECORD ═══ — quick entry + full form */}
      {mode === 'record' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Сегодня: план + последняя тренировка + сон */}
          {(() => {
            const todayIdx = (new Date().getDay() + 6) % 7;
            const planned = (trainingOutput?.plan?.[todayIdx] && trainingOutput.plan[todayIdx].exercises.length > 0) ? trainingOutput.plan[todayIdx] : null;
            const last = historyWorkouts[0];
            const weekVol = diaryProgress.length > 0 ? diaryProgress[diaryProgress.length - 1].totalVolume : 0;
            // Последний сон из дневника сна (синхронизация: дневник сна → готовность)
            const sleepEntries = (() => { try { return JSON.parse(localStorage.getItem('he_sleep_diary') || '[]') as Array<{ date: string; hours?: number }>; } catch { return []; } })();
            const lastSleep = sleepEntries.length > 0 ? [...sleepEntries].sort((a, b) => b.date.localeCompare(a.date))[0] : null;
            const sleepHours = typeof lastSleep?.hours === 'number' ? lastSleep.hours : null;
            return (
              <div style={{ ...diaryCard, border: '1px solid rgba(0,230,138,0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ ...diaryLabel, color: ACCENT, marginBottom: 0 }}>📅 Сегодня</div>
                  {sleepHours != null && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, padding: '2px 8px', borderRadius: 10, background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}>
                      💤 Синхронизировано со сном: {sleepHours} ч
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Неделя объём</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>{(weekVol / 1000).toFixed(1)}т</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Всего сессий</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa' }}>{historyWorkouts.length}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Последняя</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{last ? last.date.slice(5).replace('-', '.') : '—'}</div>
                  </div>
                </div>
                {planned && (
                  <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>🎯 По плану сегодня: {planned.name}</div>
                      {reminderTime ? (
                        <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 10, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', whiteSpace: 'nowrap' }}>
                          🔔 Напоминание: {reminderTime}
                        </span>
                      ) : (
                        <button onClick={() => scheduleReminder('18:00', planned.name, planned.exercises.map((e: any) => e.name))}
                          style={{ fontSize: 9, padding: '3px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          🔔 Напомнить в 18:00
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                      {planned.exercises.slice(0, 6).map(e => e.name).join(' · ')}{planned.exercises.length > 6 ? ` +${planned.exercises.length - 6}` : ''}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>~{planned.duration} мин</div>
                      <button onClick={() => setPlanToRecord({ day: planned, nonce: Date.now() })}
                        style={{ padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer' }}>
                        ✍️ Записать по плану
                      </button>
                    </div>
                  </div>
                )}
                {last && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                    Последняя: <span style={{ color: '#fff' }}>{last.split || 'Тренировка'}</span> · {last.exercises.length} упр. · {(last.exercises.reduce((s, e) => s + e.totalVolume, 0) / 1000).toFixed(1)}т
                  </div>
                )}
                {sleepHours != null && sleepHours < 6 && (
                  <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 8, fontSize: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
                    ⚠️ Менее 6 часов сна ({sleepHours} ч) — учтите в интенсивности сегодняшней тренировки
                  </div>
                )}
              </div>
            );
          })()}
          <RecordModeSelector diary={diary} historyWorkouts={historyWorkouts} selectedWeek={selectedWeek} onSave={onRefresh}
            sub={recordSub} onSubChange={setRecordSub}
            pendingTemplate={planToRecord?.day} templateKey={planToRecord?.nonce} onTemplateApplied={() => setPlanToRecord(null)} />
        </div>
      )}

      {/* ═══ MODE: HISTORY ═══ */}
      {mode === 'history' && (
        <div>
          {diaryProgress.length > 0 && <TrainingRecommendationsCard
            historyWorkouts={historyWorkouts} level={level} weakPoints={tprofile.weakPoints}
            readinessHistory={(() => { try { return loadReadinessHistory(); } catch { return []; } })()}
            acwr={(() => { try { const _s = loadSRPESessions(); if (_s.length < 2) return undefined; return acuteChronicRatio(toDailyLoads(_s)).ratio; } catch { return undefined; } })()}
            nutrition={{ kcal: linked.avgWeeklyKcal, protein: linked.avgWeeklyProtein, fat: linked.avgWeeklyFat, carbs: linked.avgWeeklyCarbs }}
            bodyWeight={tprofile.bodyWeight}
            labAnalysis={linked.labAnalysis ? { liverStress: linked.labAnalysis.liverStress, cardioRisk: linked.labAnalysis.cardioRisk, inflammation: linked.labAnalysis.inflammation, kidneyStress: linked.labAnalysis.kidneyStress, hormoneScore: linked.labAnalysis.hormoneScore, homaIR: linked.labAnalysis.homaIR } : undefined}
            onCourse={tprofile.onCourse} courseIntensity={tprofile.courseIntensity} supportCoverage={linked.supportCoverage}
          />}

          {/* Предупреждение о срезе истории из-за переполнения хранилища */}
          {trimWarning && (
            <div style={{ ...style.card, border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>⚠️ История частично обрезана из-за переполнения хранилища</div>
                <button onClick={() => { clearStorageTrimWarning(); setTrimWarning(null); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12 }}>✕</button>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                Осталось {trimWarning.kept} последних сессий ({new Date(trimWarning.at).toLocaleString('ru-RU')}). Сделайте экспорт CSV/JSON в «Инструментах» и удалите старые записи.
              </div>
            </div>
          )}

          {/* Алгоритмические алерты: плато, перегрузка объёма, делод */}
          {progressionAlerts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
              {progressionAlerts.map((a, i) => (
                <div key={i} style={{ ...style.card, border: `1px solid ${a.type === 'plateau' ? 'rgba(245,158,11,0.4)' : a.type === 'volume_peak' ? 'rgba(239,68,68,0.4)' : 'rgba(96,165,250,0.4)'}`, background: `${a.type === 'plateau' ? 'rgba(245,158,11,0.06)' : a.type === 'volume_peak' ? 'rgba(239,68,68,0.06)' : 'rgba(96,165,250,0.06)'}`, padding: 10, marginBottom: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: a.type === 'plateau' ? '#f59e0b' : a.type === 'volume_peak' ? '#ef4444' : '#60a5fa' }}>
                    {a.type === 'plateau' ? '⏸' : a.type === 'volume_peak' ? '📈' : '📉'} {a.message}
                  </div>
                  {a.type === 'volume_peak' && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Рекомендуется разгрузочная неделя или снижение объёма.</div>}
                </div>
              ))}
            </div>
          )}

          {/* План vs факт: синхронизация с планом недели */}
          {trainingOutput?.plan && trainingOutput.plan.some((d: any) => (d.exercises || []).length > 0) && (() => {
            const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
            const factWeek = historyWorkouts.filter(w => new Date(w.date) >= weekAgo);
            const plannedDays = trainingOutput.plan.filter((d: any) => (d.exercises || []).length > 0);
            const plannedSets = plannedDays.reduce((s: number, d: any) => s + (d.exercises || []).reduce((ss: number, e: any) => ss + (Number(e.sets) || 0), 0), 0);
            const factSets = factWeek.reduce((s, w) => s + w.exercises.reduce((ss, e) => ss + (e.sets?.length || 0), 0), 0);
            const adherence = plannedSets > 0 ? Math.min(100, Math.round((factSets / plannedSets) * 100)) : 0;
            // Поупражненное выполнение: план-имена из текущего дня плана vs факт-имена
            const plannedNames = new Set(plannedDays.flatMap((d: any) => (d.exercises || []).map((e: any) => (e.name || '').toLowerCase()).filter(Boolean)));
            const factNames = new Map<string, number>();
            factWeek.forEach(w => w.exercises.forEach(e => {
              const n = (e.exerciseName || '').toLowerCase();
              if (n) factNames.set(n, (factNames.get(n) || 0) + (e.sets?.length || 0));
            }));
            const matched = [...plannedNames].filter(n => [...factNames.keys()].some(f => f.includes(n) || n.includes(f))).length;
            const matchPct = plannedNames.size > 0 ? Math.round((matched / plannedNames.size) * 100) : 0;
            const color = adherence >= 80 ? '#22c55e' : adherence >= 50 ? '#f59e0b' : '#ef4444';
            return (
              <div style={style.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={style.label} >📋 План vs факт</div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, padding: '2px 8px', borderRadius: 10, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }}>
                    🔄 Синхронизировано с планом
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Сессий (план/факт)</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{plannedDays.length}<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}> / {factWeek.length}</span></div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Подходов (план/факт)</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{plannedSets}<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}> / {factSets}</span></div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Выполнение</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color }}>{adherence}%</div>
                  </div>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${adherence}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                  Упражнений плана выполнено: {matched} из {plannedNames.size} ({matchPct}%)
                </div>
                {(() => {
                  // Пропущенные плановые дни: день плана (0=Пн) vs дни недели с факт-тренировками
                  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
                  const factDays = new Set(factWeek.map(w => (new Date(w.date).getDay() + 6) % 7));
                  const missed = plannedDays
                    .filter((d: any) => typeof d.day === 'number' && !factDays.has(d.day % 7))
                    .map((d: any) => `${dayNames[d.day % 7]} (${d.name})`);
                  if (missed.length === 0) return null;
                  return (
                    <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 8, fontSize: 10, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}>
                      ⏭ Пропущено: {missed.join(', ')}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* Сводка недели для копирования */}
          {historyWorkouts.length > 0 && (() => {
            const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
            const lastWeek = historyWorkouts.filter(w => new Date(w.date) >= weekAgo);
            if (lastWeek.length === 0) return null;
            const prevWeek = historyWorkouts.filter(w => { const d = new Date(w.date); return d < weekAgo && d >= new Date(weekAgo.getTime() - 7 * 86400000); });
            const vol = lastWeek.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
            const sets = lastWeek.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + (e.sets?.length || 0), 0), 0);
            const prevVol = prevWeek.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
            const volDelta = prevVol > 0 ? Math.round(((vol - prevVol) / prevVol) * 100) : 0;
            const best = lastWeek.flatMap(w => w.exercises.map(e => ({ name: e.exerciseName, e1rm: e.estimated1RM || 0 }))).sort((a, b) => b.e1rm - a.e1rm)[0];
            const summary = [
              `📅 Неделя: ${lastWeek[0].date.slice(8, 10)}.${lastWeek[0].date.slice(5, 7)} — ${lastWeek[lastWeek.length - 1].date.slice(8, 10)}.${lastWeek[lastWeek.length - 1].date.slice(5, 7)}`,
              `🏋️ Тренировок: ${lastWeek.length} (${prevWeek.length ? `прошлая: ${prevWeek.length}` : 'прошлая: —'})`,
              `⚖️ Объём: ${(vol / 1000).toFixed(1)} т (${volDelta >= 0 ? '+' : ''}${volDelta}%) · подходов: ${sets}`,
              best && best.e1rm > 0 ? `🏆 Лучший e1RM: ${best.name} — ${Math.round(best.e1rm)} кг` : '',
              lastWeek[0].notes ? `📝 ${lastWeek[0].notes}` : '',
            ].filter(Boolean).join('\n');
            return (
              <div style={style.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ ...style.label, marginBottom: 0 }}>📄 Сводка недели</div>
                  <button onClick={() => navigator.clipboard?.writeText(summary)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, background: 'rgba(0,230,138,0.12)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.3)', cursor: 'pointer' }}>📋 Копировать</button>
                </div>
                <pre style={{ margin: '6px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{summary}</pre>
              </div>
            );
          })()}
          <div style={style.card}>
            <div style={style.label}>📜 История тренировок</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {[
                { label: 'Недель', value: diaryProgress.length, color: '#34d399' },
                { label: 'Тренировок', value: diaryProgress.reduce((s, w) => s + w.workoutCount, 0), color: '#60a5fa' },
                { label: 'Объём', value: diaryProgress.length > 0 ? `${(diaryProgress[diaryProgress.length - 1]?.totalVolume / 1000).toFixed(1)}т` : '—', color: '#f59e0b' },
                { label: 'ACWR', value: (() => { try { const s = loadSRPESessions(); if (s.length < 2) return '—'; return acuteChronicRatio(toDailyLoads(s)).ratio.toFixed(2); } catch { return '—'; } })(), color: '#22c55e' },
              ].map((s, i) => <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>)}
            </div>
            {/* Heatmap — redesigned with month labels + tooltips */}
            {historyWorkouts.length > 0 && (() => {
              const byDay: Record<string, number> = {};
              historyWorkouts.forEach((w: any) => { byDay[w.date] = (byDay[w.date] || 0) + (w.exercises || []).reduce((s: number, e: any) => s + (e.totalVolume || 0), 0); });
              const cells: { date: string; vol: number; dayOfWeek: number }[] = [];
              const today = new Date();
              for (let i = 83; i >= 0; i--) {
                const d = new Date(today); d.setDate(d.getDate() - i);
                cells.push({ date: d.toISOString().slice(0, 10), vol: byDay[d.toISOString().slice(0, 10)] || 0, dayOfWeek: (d.getDay() + 6) % 7 });
              }
              const maxVol = Math.max(1, ...cells.map(c => c.vol));
              const heatColor = (v: number) => {
                if (v === 0) return 'rgba(255,255,255,0.04)';
                const t = v / maxVol;
                if (t < 0.25) return 'rgba(0,230,138,0.2)';
                if (t < 0.5) return 'rgba(0,230,138,0.4)';
                if (t < 0.75) return 'rgba(0,230,138,0.65)';
                return 'rgba(0,230,138,0.9)';
              };
              // Group by weeks (columns)
              const weeks: { date: string; vol: number; dayOfWeek: number }[][] = [];
              for (let w = 0; w < 12; w++) weeks.push(cells.slice(w * 7, w * 7 + 7));
              // Month labels: find first day of each week column
              const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
              const monthLabels: { week: number; label: string }[] = [];
              let lastMonth = -1;
              weeks.forEach((wk, wi) => {
                if (wk.length > 0) {
                  const m = new Date(wk[0].date).getMonth();
                  if (m !== lastMonth) { monthLabels.push({ week: wi, label: monthNames[m] }); lastMonth = m; }
                }
              });
              return (
                <div style={{ marginBottom: 8, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 6 }}>🔥 Тепловая карта (12 нед)</div>
                  {/* Month labels row */}
                  <div style={{ display: 'flex', gap: 3, marginBottom: 2 }}>
                    {weeks.map((_, wi) => {
                      const ml = monthLabels.find(m => m.week === wi);
                      return <div key={wi} style={{ flex: 1, fontSize: 9, color: ml ? 'rgba(255,255,255,0.45)' : 'transparent', fontWeight: ml ? 600 : 400, textAlign: 'center' }}>{ml?.label || ''}</div>;
                    })}
                  </div>
                  {/* Day labels + grid */}
                  <div style={{ display: 'flex', gap: 3 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 2 }}>
                      {['Пн', '', 'Ср', '', 'Пт', '', 'Вс'].map((d, i) => (
                        <div key={i} style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', height: 12, display: 'flex', alignItems: 'center' }}>{d}</div>
                      ))}
                    </div>
                    {weeks.map((wk, wi) => (
                      <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                        {wk.map((c, di) => (
                          <div key={di} title={`${c.date}${c.vol > 0 ? ': ' + Math.round(c.vol) + ' кг' : ''}`}
                            style={{ height: 12, borderRadius: 2, background: heatColor(c.vol), transition: 'background 0.2s' }} />
                        ))}
                      </div>
                    ))}
                  </div>
                  {/* Legend */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 6, fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>
                    <span>меньше</span>
                    {[0.1, 0.3, 0.5, 0.8].map((t, i) => (
                      <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: heatColor(maxVol * t) }} />
                    ))}
                    <span>больше</span>
                  </div>
                </div>
              );
            })()}
            {/* MRV alerts */}
            {historyWorkouts.length > 0 && (() => {
              const lvlKey = (level === 'enhanced' ? 'advanced' : level) as 'beginner' | 'intermediate' | 'advanced';
              const mrvBase = (((LEVEL_VOLUMES as Record<string, { mrv: number }>)[level]?.mrv) ?? 20) * (tprofile.onCourse ? 1.2 : 1);
              const ws = (d0: Date) => { const x = new Date(d0); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; };
              const now = new Date();
              const wkSets = (weeksAgo: number) => { const s = ws(now); s.setDate(s.getDate() - weeksAgo * 7); const e = new Date(s); e.setDate(e.getDate() + 6); const ss = s.toISOString().slice(0, 10), ee = e.toISOString().slice(0, 10); const m: Record<string, number> = {}; historyWorkouts.forEach((w: any) => { if (w.date >= ss && w.date <= ee) (w.exercises || []).forEach((ex: any) => { const cat = EXERCISE_CATALOG.find((c: any) => c.id === ex.exerciseId); if (cat) m[cat.group] = (m[cat.group] || 0) + (ex.sets?.length || 0); }); }); return m; };
              const w1 = wkSets(1), w2 = wkSets(0);
              const groups2 = Array.from(new Set([...Object.keys(w1), ...Object.keys(w2)]));
              const over2 = groups2.filter(g => (w1[g] || 0) > mrvBase && (w2[g] || 0) > mrvBase);
              const over1 = groups2.filter(g => ((w1[g] || 0) > mrvBase || (w2[g] || 0) > mrvBase) && !over2.includes(g));
              if (over2.length === 0 && over1.length === 0) return null;
              const ru = (g: string) => GRP_RU[g] || g;
              const color = over2.length > 0 ? '#ef4444' : '#f59e0b';
              return (
                <div style={{ marginBottom: 8, padding: 10, borderRadius: 10, background: color + '12', border: '1px solid ' + color + '40' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color, marginBottom: 4 }}>{over2.length > 0 ? '🔴 Риск перетренированности' : '🟡 Превышение объёма'}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                    {over2.length > 0 ? `Группы выше MRV (${Math.round(mrvBase)} сетов) 2 недели подряд: ${over2.map(ru).join(', ')}. Снизьте объём на 10–15% в следующем микроцикле.` : `Группы выше MRV на прошлой/текущей неделе: ${over1.map(ru).join(', ')}. Следите за восстановлением.`}
                  </div>
                </div>
              );
            })()}
            {/* Volume chart */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>📈 Тоннаж по неделям</div>
              <MiniBarChart
                data={diaryProgress.slice(-12).map(w => ({
                  value: w.totalVolume,
                  label: `${w.year % 100}.${String(w.week).padStart(2, '0')}`,
                  color: w.totalVolume === Math.max(...diaryProgress.map(w2 => w2.totalVolume), 1) ? '#00e68a' : 'rgba(0,230,138,0.35)',
                }))}
                width={300}
                height={55}
                valueSuffix=" кг"
              />
            </div>
            {/* Exercise progress mini-charts */}
            {historyWorkouts.length >= 2 && (() => {
              const byEx: Record<string, { date: string; e1rm: number }[]> = {};
              historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
                const best = (e.sets || []).reduce((m: number, s: any) => Math.max(m, epley1RM(s.weight || 0, s.reps || 0)), 0);
                if (best <= 0) return;
                const name = e.exerciseName || e.exerciseId || '—';
                (byEx[name] = byEx[name] || []).push({ date: w.date, e1rm: Math.round(best) });
              }));
              const topEx = Object.entries(byEx)
                .filter(([, arr]) => arr.length >= 2)
                .sort((a, b) => b[1].length - a[1].length)
                .slice(0, 4);
              if (topEx.length === 0) return null;
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>📈 Прогресс e1RM по упражнениям</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {topEx.map(([name, arr]) => {
                      const sorted = arr.sort((a, b) => a.date.localeCompare(b.date));
                      const latest = sorted[sorted.length - 1].e1rm;
                      const prev = sorted.length >= 2 ? sorted[sorted.length - 2].e1rm : latest;
                      const delta = prev > 0 ? Math.round((latest - prev) / prev * 100) : 0;
                      return (
                        <div key={name} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px' }}>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Sparkline data={sorted.map(p => p.e1rm)} width={40} height={14} color={delta >= 0 ? '#22c55e' : '#ef4444'} showDots={false} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: delta >= 0 ? '#22c55e' : '#ef4444' }}>
                              {latest}кг {delta !== 0 && <span style={{ fontSize: 8 }}>{delta > 0 ? '+' : ''}{delta}%</span>}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            {/* Muscle recovery estimate */}
            {historyWorkouts.length >= 2 && (() => {
              const lastTrained: Record<string, string> = {};
              const sorted = [...historyWorkouts].sort((a, b) => b.date.localeCompare(a.date));
              sorted.forEach(w => (w.exercises || []).forEach((e: any) => {
                const cat = EXERCISE_CATALOG.find((c: any) => c.id === e.exerciseId);
                const group = cat?.group;
                if (group && !lastTrained[group]) lastTrained[group] = w.date;
              }));
              const today = new Date().toISOString().slice(0, 10);
              const groups = Object.entries(lastTrained)
                .map(([g, date]) => {
                  const days = Math.floor((new Date(today).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
                  return { group: g, days, date };
                })
                .sort((a, b) => b.days - a.days)
                .slice(0, 6);
              if (groups.length === 0) return null;
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>💚 Восстановление мышц</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {groups.map(({ group, days }) => {
                      const ready = days >= 4;
                      const color = days >= 7 ? '#22c55e' : days >= 4 ? '#f59e0b' : '#ef4444';
                      return (
                        <div key={group} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{GRP_RU[group] || group}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color }}>{days}д {ready ? '✓' : '⏳'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            {/* Muscle volume trend over 8 weeks */}
            {historyWorkouts.length >= 6 && (() => {
              const weeks = 8;
              const today = new Date();
              const GROUP_COLORS: Record<string, string> = { chest: '#ef4444', back: '#3b82f6', shoulders: '#f59e0b', quads: '#22c55e', hamstrings: '#10b981', biceps: '#a855f7', triceps: '#60a5fa', core: '#f97316' };
              const weekGroupVol: { week: string; groups: Record<string, number> }[] = [];
              for (let w = weeks - 1; w >= 0; w--) {
                const ws = new Date(today); ws.setDate(ws.getDate() - (w + 1) * 7);
                const we = new Date(today); we.setDate(we.getDate() - w * 7);
                const wos = historyWorkouts.filter(wo => { const d = new Date(wo.date); return d > ws && d <= we; });
                const groups: Record<string, number> = {};
                wos.forEach(wo => (wo.exercises || []).forEach((e: any) => {
                  const cat = EXERCISE_CATALOG.find((c: any) => c.id === e.exerciseId);
                  const g = cat?.group || 'core';
                  groups[g] = (groups[g] || 0) + (e.sets?.length || 0);
                }));
                weekGroupVol.push({ week: `Н${weeks - w}`, groups });
              }
              const topGroups = Object.entries(weekGroupVol.reduce((acc, wg) => {
                Object.entries(wg.groups).forEach(([g, v]) => { acc[g] = (acc[g] || 0) + v; });
                return acc;
              }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g]) => g);
              if (topGroups.length === 0) return null;
              const maxTotal = Math.max(1, ...weekGroupVol.map(wg => topGroups.reduce((s, g) => s + (wg.groups[g] || 0), 0)));
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>📊 Объём по группам (нед)</div>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 50 }}>
                    {weekGroupVol.map((wg, wi) => {
                      const total = topGroups.reduce((s, g) => s + (wg.groups[g] || 0), 0);
                      const h = Math.max(2, (total / maxTotal) * 46);
                      let accH = 0;
                      return (
                        <div key={wi} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, position: 'relative' }}>
                          <div style={{ width: '100%', height: h, borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse' }}>
                            {topGroups.map(g => {
                              const v = wg.groups[g] || 0;
                              const segH = total > 0 ? (v / total) * h : 0;
                              return <div key={g} style={{ height: segH, background: GROUP_COLORS[g] || '#888', opacity: 0.8 }} />;
                            })}
                          </div>
                          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>{wg.week}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {topGroups.map(g => <span key={g} style={{ fontSize: 8, color: GROUP_COLORS[g] || '#888' }}>● {GRP_RU[g] || g}</span>)}
                  </div>
                </div>
              );
            })()}
            {/* Duration trend */}
            {historyWorkouts.length >= 4 && (() => {
              const durations = historyWorkouts.slice(-12).map(w => w.duration || 0).filter(d => d > 0);
              if (durations.length < 3) return null;
              const avgDuration = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);
              const lastDur = durations[durations.length - 1];
              const firstDur = durations[0];
              const durDelta = firstDur > 0 ? Math.round(((lastDur - firstDur) / firstDur) * 100) : 0;
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>⏱ Длительность сессий</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>avg {avgDuration} мин</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkline data={durations} width={80} height={18} color="#60a5fa" />
                    <span style={{ fontSize: 10, fontWeight: 600, color: durDelta > 10 ? '#f59e0b' : durDelta < -10 ? '#22c55e' : 'rgba(255,255,255,0.4)' }}>
                      {durDelta > 0 ? '+' : ''}{durDelta}%
                    </span>
                  </div>
                </div>
              );
            })()}
            {/* Session quality score trend */}
            {historyWorkouts.length >= 4 && (() => {
              const recent = historyWorkouts.slice(-10);
              const scores = recent.map(w => {
                const exCount = w.exercises.length;
                const totalSets = w.exercises.reduce((s: number, e: any) => s + (e.sets?.length || 0), 0);
                const completedSets = w.exercises.reduce((s: number, e: any) => s + (e.sets || []).filter((st: any) => st.completed || (st.weight > 0 && st.reps > 0)).length, 0);
                const completionRate = totalSets > 0 ? completedSets / totalSets : 0;
                const rpe = w.overallRPE || 7;
                const rpeScore = rpe >= 7 && rpe <= 8.5 ? 1.0 : rpe < 7 ? 0.7 : rpe > 9 ? 0.6 : 0.85;
                const volumeScore = Math.min(totalSets / 20, 1);
                return Math.round((completionRate * 40 + rpeScore * 30 + volumeScore * 30));
              });
              const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
              const trend = scores[scores.length - 1] > scores[0];
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>⭐ Качество сессий</span>
                    <span style={{ fontSize: 10, color: avg >= 70 ? '#22c55e' : avg >= 50 ? '#f59e0b' : '#ef4444' }}>{Math.round(avg)}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkline data={scores} width={80} height={18} color={avg >= 70 ? '#22c55e' : '#f59e0b'} />
                    <span style={{ fontSize: 10, color: trend ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                      {trend ? '↑ растёт' : '↓ падает'}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>выполнение + RPE + объём</div>
                </div>
              );
            })()}
          </div>
          {/* Week-to-week comparison card */}
          {groupedHistory.length >= 2 && (() => {
            const [curWeek, curWorkouts] = groupedHistory[0];
            const [prevWeek, prevWorkouts] = groupedHistory[1];
            const curVol = curWorkouts.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
            const prevVol = prevWorkouts.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
            const curSets = curWorkouts.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + (e.sets?.length || 0), 0), 0);
            const prevSets = prevWorkouts.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + (e.sets?.length || 0), 0), 0);
            const volPct = prevVol > 0 ? Math.round((curVol - prevVol) / prevVol * 100) : 0;
            const setsPct = prevSets > 0 ? Math.round((curSets - prevSets) / prevSets * 100) : 0;
            const exNames = new Set<string>();
            curWorkouts.forEach(w => w.exercises.forEach((e: any) => exNames.add(e.exerciseName || e.exerciseId)));
            const prevExNames = new Set<string>();
            prevWorkouts.forEach(w => w.exercises.forEach((e: any) => prevExNames.add(e.exerciseName || e.exerciseId)));
            const newExercises = [...exNames].filter(n => !prevExNames.has(n));
            return (
              <div style={{ ...style.card, marginBottom: 6 }}>
                <div style={style.label}>📊 {curWeek} vs {prevWeek}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10 }}>
                  <div>
                    <div style={{ color: 'var(--text-dim)' }}>Объём</div>
                    <div style={{ fontWeight: 700, color: volPct >= 0 ? '#22c55e' : '#ef4444' }}>
                      {volPct >= 0 ? '+' : ''}{volPct}% <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>({(curVol / 1000).toFixed(1)}т vs {(prevVol / 1000).toFixed(1)}т)</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-dim)' }}>Сеты</div>
                    <div style={{ fontWeight: 700, color: setsPct >= 0 ? '#22c55e' : '#ef4444' }}>
                      {setsPct >= 0 ? '+' : ''}{setsPct}% <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>({curSets} vs {prevSets})</span>
                    </div>
                  </div>
                </div>
                {newExercises.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: 10, color: '#f59e0b' }}>🆕 Новые: {newExercises.slice(0, 3).join(', ')}{newExercises.length > 3 ? ` +${newExercises.length - 3}` : ''}</div>
                )}
              </div>
            );
          })()}
          {/* Фильтр по мезоциклу (если записи тегированы mesocycleId) */}
          {mesoIds.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              <button onClick={() => setMesoFilter('all')} style={{
                padding: '5px 10px', borderRadius: 14, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                border: mesoFilter === 'all' ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                background: mesoFilter === 'all' ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                color: mesoFilter === 'all' ? 'var(--accent)' : 'var(--text-dim)',
              }}>Все мезоциклы</button>
              {mesoIds.map(id => (
                <button key={id} onClick={() => setMesoFilter(mesoFilter === id ? 'all' : id)} style={{
                  padding: '5px 10px', borderRadius: 14, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  border: mesoFilter === id ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                  background: mesoFilter === id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                  color: mesoFilter === id ? 'var(--accent)' : 'var(--text-dim)',
                }}>📈 {id}</button>
              ))}
            </div>
          )}
          {/* Search + group filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'stretch' }}>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск по неделе..." style={{ ...style.input, flex: 2 }} />
            <button onClick={() => setGroupPickerOpen(true)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
              padding: '10px 12px', borderRadius: 10, cursor: 'pointer', minWidth: 0,
              background: filterGroup !== 'all' ? `${GROUP_COLORS[filterGroup]}1a` : 'rgba(255,255,255,0.06)',
              border: filterGroup !== 'all' ? `1px solid ${GROUP_COLORS[filterGroup]}66` : '1px solid rgba(255,255,255,0.12)',
              color: '#fff', fontSize: 12, fontWeight: 600,
            }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>💪 {filterGroup === 'all' ? 'Все группы' : GRP_RU[filterGroup]}</span>
              <span style={{ fontSize: 10, opacity: 0.85, flexShrink: 0 }}>▾</span>
            </button>
          </div>
          {groupPickerOpen && (
            <div onClick={() => setGroupPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', padding: 16 }}>
              <div onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto', borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 48px rgba(0,0,0,0.5)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>💪 Выбор по группам</div>
                  <button onClick={() => setGroupPickerOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button onClick={() => { setFilterGroup('all'); setGroupPickerOpen(false); }} style={{
                    padding: '10px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: filterGroup === 'all' ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.12)',
                    background: filterGroup === 'all' ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)',
                    color: '#fff',
                  }}>Все группы</button>
                  {Object.entries(GRP_RU).map(([k, v]) => (
                    <button key={k} onClick={() => { setFilterGroup(k); setGroupPickerOpen(false); }} style={{
                      padding: '10px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      border: filterGroup === k ? `2px solid ${GROUP_COLORS[k]}` : '1px solid rgba(255,255,255,0.12)',
                      background: filterGroup === k ? `${GROUP_COLORS[k]}1f` : 'rgba(255,255,255,0.04)',
                      color: '#fff',
                    }}>{v}{filterGroup === k ? ' ✓' : ''}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Exercise filter (card-button + popup) */}
          {allExerciseNames.length > 0 && (
            <>
              <div style={{ marginBottom: 6 }}>
                <button onClick={() => { setExSearch(''); setExPickerOpen(true); }} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  background: historyExerciseFilter ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.06)',
                  border: historyExerciseFilter ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.12)',
                  color: '#fff', fontSize: 12, fontWeight: 600, minHeight: 40,
                }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏋️ {historyExerciseFilter || 'Все упражнения'}</span>
                  {historyExerciseFilter ? (
                    <span onClick={e => { e.stopPropagation(); setHistoryExerciseFilter(''); }} style={{ flexShrink: 0, fontSize: 13, opacity: 0.85 }}>✕</span>
                  ) : (
                    <span style={{ fontSize: 10, opacity: 0.85, flexShrink: 0 }}>▾</span>
                  )}
                </button>
              </div>
              {exPickerOpen && (
                <div onClick={() => setExPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', padding: 16 }}>
                  <div onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto', borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 48px rgba(0,0,0,0.5)', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>🏋️ Фильтр по упражнению</div>
                      <button onClick={() => setExPickerOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
                    </div>
                    <input type="text" value={exSearch} onChange={e => setExSearch(e.target.value)} placeholder="🔍 Найти упражнение..." autoFocus style={{ ...style.input, width: '100%', marginBottom: 10 }} />
                    <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {allExerciseNames.filter(n => !exSearch || n.toLowerCase().includes(exSearch.toLowerCase())).map(n => (
                        <button key={n} onClick={() => { setHistoryExerciseFilter(n); setExPickerOpen(false); }} style={{
                          width: '100%', padding: '9px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                          border: historyExerciseFilter === n ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                          background: historyExerciseFilter === n ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                          color: '#fff', fontSize: 12,
                        }}>{n}{historyExerciseFilter === n ? ' ✓' : ''}</button>
                      ))}
                      <button onClick={() => { setHistoryExerciseFilter(''); setExPickerOpen(false); }} style={{
                        width: '100%', padding: '9px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                        border: !historyExerciseFilter ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                        background: !historyExerciseFilter ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                        color: '#fff', fontSize: 12, fontWeight: 700,
                      }}>Все упражнения</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          {/* Notes filter (card-button + popup) */}
          {groupedHistory.some(([, ws]) => ws.some(w => w.notes)) && (
            <>
              <div style={{ marginBottom: 6 }}>
                <button onClick={() => setNotesPickerOpen(true)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  background: notesFilter ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.06)',
                  border: notesFilter ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.12)',
                  color: '#fff', fontSize: 12, fontWeight: 600, minHeight: 40,
                }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📝 {notesFilter || 'Фильтр по заметкам'}</span>
                  {notesFilter ? (
                    <span onClick={e => { e.stopPropagation(); setNotesFilter(''); }} style={{ flexShrink: 0, fontSize: 13, opacity: 0.85 }}>✕</span>
                  ) : (
                    <span style={{ fontSize: 10, opacity: 0.85, flexShrink: 0 }}>▾</span>
                  )}
                </button>
              </div>
              {notesPickerOpen && (
                <div onClick={() => setNotesPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', padding: 16 }}>
                  <div onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 420, borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 48px rgba(0,0,0,0.5)', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>📝 Фильтр по заметкам</div>
                      <button onClick={() => setNotesPickerOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
                    </div>
                    <input type="text" value={notesFilter} onChange={e => setNotesFilter(e.target.value)} placeholder="Текст заметки / сплита..." autoFocus style={{ ...style.input, width: '100%', marginBottom: 12 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setNotesFilter(''); setNotesPickerOpen(false); }} style={{ flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontWeight: 600, fontSize: 12 }}>Сбросить</button>
                      <button onClick={() => setNotesPickerOpen(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg,var(--accent),#00cc7a)', color: '#000', fontWeight: 700, fontSize: 12 }}>Готово</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          {filteredHistory.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6, gap: 6 }}>
              <button onClick={() => setHistoryExpanded('__all__')} style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>▾ Развернуть все</button>
              <button onClick={() => setHistoryExpanded(null)} style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>▸ Свернуть все</button>
            </div>
          )}
          {/* Exercise-specific stats when filtered */}
          {historyExerciseFilter && filteredHistoryWorkouts.length > 0 && (() => {
            const q = historyExerciseFilter.toLowerCase();
            const exSessions = filteredHistoryWorkouts.flatMap(w => w.exercises.filter((e: any) => (e.exerciseName || '').toLowerCase().includes(q)));
            const totalVol = exSessions.reduce((s, e) => s + (e.totalVolume || 0), 0);
            const bestE1RM = Math.max(0, ...exSessions.map((e: any) => e.estimated1RM || 0));
            const totalSets = exSessions.reduce((s, e) => s + (e.sets?.length || 0), 0);
            const latestE1RM = exSessions[exSessions.length - 1]?.estimated1RM || 0;
            const prevE1RM = exSessions.length >= 2 ? exSessions[exSessions.length - 2]?.estimated1RM || 0 : latestE1RM;
            const delta = prevE1RM > 0 ? Math.round(((latestE1RM - prevE1RM) / prevE1RM) * 100) : 0;
            return (
              <div style={style.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={style.label}>🏋️ {historyExerciseFilter}</div>
                  <button onClick={() => setHistoryExerciseFilter('')} style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ сброс</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 10 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#fff' }}>Объём</div>
                    <div style={{ fontWeight: 700, color: ACCENT }}>{(totalVol / 1000).toFixed(1)}т кг</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#fff' }}>Лучший e1RM</div>
                    <div style={{ fontWeight: 700, color: '#f59e0b' }}>{Math.round(bestE1RM)} кг</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#fff' }}>Сетов</div>
                    <div style={{ fontWeight: 700, color: '#60a5fa' }}>{totalSets}</div>
                  </div>
                </div>
                {delta !== 0 && (
                  <div style={{ fontSize: 10, textAlign: 'center', marginTop: 4, color: delta > 0 ? '#22c55e' : '#ef4444' }}>
                    {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}% к предыдущему e1RM
                  </div>
                )}
              </div>
            );
          })()}
          {filteredHistory.map(([week, workouts], wi) => (
            <WorkoutWeekCard
              key={week}
              weekLabel={week}
              workouts={workouts}
              prevWorkouts={wi < filteredHistory.length - 1 ? filteredHistory[wi + 1][1] : undefined}
              expanded={historyExpanded === '__all__' || historyExpanded === week}
              onToggle={() => setHistoryExpanded(prev => prev === week ? null : week)}
              onEdit={handleEditWorkout}
              onDelete={w => setConfirmDeleteId(w.id)}
              confirmDeleteId={confirmDeleteId}
              onConfirmDelete={handleDeleteWorkout}
              onCancelDelete={() => setConfirmDeleteId(null)}
            />
          ))}
          {filteredHistory.length === 0 && (
            <DiaryEmptyState
              icon="📜"
              title={search || historyExerciseFilter ? 'Ничего не найдено' : 'Нет тренировок'}
              description={search || historyExerciseFilter
                ? 'Попробуйте изменить поиск или сбросить фильтры.'
                : 'Запишите первую тренировку — она появится здесь.'}
              onRecord={!search && !historyExerciseFilter ? () => { setMode('record'); onGoRecord?.(); } : undefined}
            />
          )}
        </div>
      )}

      {/* ═══ MODE: ANALYTICS ═══ */}
      {mode === 'analytics' && <DiaryAnalyticsView hub={hub} />}

      {/* ═══ MODE: PROGRESS ═══ */}
      {mode === 'progress' && <DiaryProgressView hub={hub} />}

      {/* Dedicated diary sub-tabs. These used to fall through to record/body,
          which made the navigation appear clickable without changing content. */}
      {mode === 'calendar' && <TrainingCalendarTab />}
      {mode === 'checkin' && <CheckinMetricsCard />}
      {mode === 'mmc' && <MMCTrackingCard />}

      {/* ═══ MODE: TOOLS ═══ — import + export + reports */}
      {mode === 'tools' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CsvImportTab onDone={onRefresh} />
          {/* CSV Export */}
          <div style={style.card}>
            <div style={style.label}>📥 Экспорт CSV</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Экспорт всех тренировок в CSV (совместим с импортом)</div>
            {historyWorkouts.length === 0 ? (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: 8 }}>Нет данных для экспорта</div>
            ) : (
              <button onClick={() => {
                const rows: string[] = ['date,exercise,set,weight,reps,rpe,rir,notes'];
                historyWorkouts.forEach((w: any) => {
                  (w.exercises || []).forEach((ex: any) => {
                    (ex.sets || []).forEach((s: any, i: number) => {
                      const weight = s.weight ?? '';
                      const reps = s.reps ?? '';
                      const rpe = s.rpe ?? '';
                      const rir = s.rir ?? '';
                      const notes = s.notes ?? '';
                      const safeWeight = typeof weight === 'string' ? `"${weight}"` : weight;
                      rows.push(`${(w.date || '').slice(0, 10)},"${(ex.exerciseName || '').replace(/"/g, '""')}",${i + 1},${safeWeight},${reps},${rpe},${rir},"${String(notes).replace(/"/g, '""')}"`);
                    });
                  });
                });
                const csv = rows.join('\n');
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `diary_export_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }} style={{ width: '100%', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer' }}>
                📥 Скачать CSV ({historyWorkouts.length} тренировок)
              </button>
            )}
          </div>
          {/* Workout templates from history */}
          {historyWorkouts.length > 0 && (() => {
            const recent = historyWorkouts.slice(-5).reverse();
            const templateMap = new Map<string, { exercises: string[]; sets: number; date: string }>();
            recent.forEach((w: any) => {
              const exNames = (w.exercises || []).map((e: any) => e.exerciseName || e.exerciseId).join(' + ');
              const totalSets = (w.exercises || []).reduce((s: number, e: any) => s + (e.sets?.length || 0), 0);
              if (exNames && !templateMap.has(exNames)) {
                templateMap.set(exNames, { exercises: exNames.split(' + '), sets: totalSets, date: (w.date || '').slice(0, 10) });
              }
            });
            const templates = [...templateMap.entries()].slice(0, 4);
            if (templates.length === 0) return null;
            return (
              <div style={style.card}>
                <div style={style.label}>📋 Шаблоны из дневника</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Повторить тренировку из прошлого</div>
                {templates.map(([key, t], i) => (
                  <div key={i} style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{t.exercises.slice(0, 3).join(', ')}{t.exercises.length > 3 ? ` +${t.exercises.length - 3}` : ''}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{t.sets} сетов · {t.date}</div>
                    </div>
                    <button onClick={() => {
                      const wo = recent.find((w: any) => {
                        const names = (w.exercises || []).map((e: any) => e.exerciseName || e.exerciseId).join(' + ');
                        return names === key;
                      });
                      if (wo) try { localStorage.setItem('he_diary_template', JSON.stringify(wo)); window.dispatchEvent(new Event('diary-template-loaded')); } catch {}
                    }} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 9, background: 'rgba(0,230,138,0.15)', color: '#00e68a', border: 'none', cursor: 'pointer' }}>📋 Использовать</button>
                  </div>
                ))}
              </div>
            );
          })()}
          <div style={style.card}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>📄 Отчёты</div>
            <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => {
              const planWeeks = macrocycle?.totalWeeks ?? (trainingOutput?.plan?.length && daysPerWeek > 0 ? Math.ceil(trainingOutput.plan.length / daysPerWeek) : 0);
              const report = {
                id: 'report_' + Date.now(), date: new Date().toISOString(),
                exerciseCatalogCount: EXERCISE_CATALOG.length, planWeeks, exercisesPerWeek: daysPerWeek,
                totalVolume: trainingOutput?.weeklyVolume ?? 0,
                avgIntensity: trainingOutput?.estimatedProgress ? Math.round(50 + trainingOutput.estimatedProgress * 5) : 0,
                goal, level, daysPerWeek, splitType, periodizationType, mesoLength,
              };
              const updated = [report, ...trainingArchive].slice(0, 20);
              setTrainingArchive(updated);
              try { localStorage.setItem('he_training_reports', JSON.stringify(updated)); } catch {}
              try { localStorage.setItem('he_training_report_current', JSON.stringify(report)); } catch {}
              setTrainingReportGenerated(true);
            }} style={{ flex: 1, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer' }}>
              Сгенерировать отчёт
            </button>
            <button onClick={() => {
              // Печатный отчёт за последние 30 дней
              const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
              const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
              const month = historyWorkouts.filter(w => new Date(w.date) >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
              const vol = month.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
              const sets = month.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + (e.sets?.length || 0), 0), 0);
              const prs = month.flatMap(w => (w.exercises || []).flatMap(e => (e.sets || []).filter((x: any) => x.isPR).map(() => ({ ex: e.exerciseName, w: w.date }))));
              const rows = month.map(w => `
                <tr>
                  <td>${esc(w.date)}</td><td>${esc(w.split || 'Тренировка')}</td>
                  <td>${w.exercises.length}</td><td>${w.exercises.reduce((s, e) => s + (e.sets?.length || 0), 0)}</td>
                  <td>${Math.round(w.exercises.reduce((s, e) => s + e.totalVolume, 0)).toLocaleString()}</td>
                  <td>${esc(w.notes || '')}</td>
                </tr>`).join('');
              const html = `<!doctype html><html><head><meta charset="utf-8"><title>Дневник — отчёт за 30 дней</title>
                <style>body{font-family:system-ui;padding:24px;color:#111}table{width:100%;border-collapse:collapse;font-size:12px}
                th,td{border:1px solid #ddd;padding:4px 6px;text-align:left}th{background:#f5f5f5}h1{font-size:18px}h2{font-size:14px;margin-top:20px}
                .stats{display:flex;gap:24px;font-size:13px;margin:8px 0}</style></head><body>
                <h1>📊 Тренировочный дневник — 30 дней</h1>
                <div class="stats"><span>Тренировок: <b>${month.length}</b></span><span>Подходов: <b>${sets}</b></span><span>Тоннаж: <b>${(vol / 1000).toFixed(1)} т</b></span></div>
                ${prs.length > 0 ? `<h2>🏆 PR за период</h2><ul>${prs.slice(0, 10).map(p => `<li>${esc(p.ex)} — ${esc(p.w)}</li>`).join('')}</ul>` : ''}
                <h2>📋 Сессии</h2>
                <table><thead><tr><th>Дата</th><th>Сплит</th><th>Упр.</th><th>Сеты</th><th>Объём</th><th>Заметки</th></tr></thead><tbody>${rows}</tbody></table>
                <script>window.print();</script></body></html>`;
              const win = window.open('', '_blank', 'width=900,height=700');
              if (win) { win.document.write(html); win.document.close(); }
            }} style={{ flex: 1, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', cursor: 'pointer' }}>
              🖨 Отчёт месяца
            </button>
            </div>
            {trainingReportGenerated && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#22c55e' }}>✓ Отчёт сохранён</p>}
            {trainingArchive.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Архив ({trainingArchive.length})</span>
                  <button onClick={() => { setTrainingArchive([]); localStorage.removeItem('he_training_reports'); setTrainingReportGenerated(false); }}
                    style={{ padding: '3px 8px', borderRadius: 5, fontSize: 9, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', cursor: 'pointer' }}>Очистить</button>
                </div>
                {[...trainingArchive].slice(0, 3).map((r: any) => (
                  <div key={r.id} style={{ fontSize: 10, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'var(--text-dim)' }}>
                    {new Date(r.date).toLocaleDateString('ru')} · {r.planWeeks} нед · {r.goal}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Workout Comparison */}
          {historyWorkouts.length >= 2 && <WorkoutComparisonCard historyWorkouts={historyWorkouts} />}
          {/* Exercise Substitution */}
          <div style={style.card}>
            <div style={style.label}>🔄 Подбор замены</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Альтернативы по мышечной группе</div>
            <ExerciseSubstitutionCard />
          </div>
          {/* 1RM Calculator — existing component */}
          <div style={style.card}>
            <OneRmCalcTab />
          </div>
          {/* Warm-up Ramp Calculator */}
          <WarmupRampCard />
          {/* Plate Calculator — existing component */}
          <div style={style.card}>
            <PlateCalcTab />
          </div>
          {/* Хранилище: диагностика дублей + импорт/экспорт веса (Google Fit мост) */}
          <div style={style.card}>
            <div style={style.label}>🧹 Хранилище: дубли и вес</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>
              Поиск одинаковых тренировок (дата + контент) и синхронизация веса с внешними приложениями.
            </div>
            {dupes && dupes.length > 0 && (
              <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8, fontSize: 10, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}>
                Найдено дублей: {dupes.reduce((s, d) => s + d.dupes.length, 0)} (групп: {dupes.length}) — например, {dupes[0].dupes[0].date} · {dupes[0].keep.exercises[0]?.exerciseName || '—'}
              </div>
            )}
            {dupes && dupes.length === 0 && (
              <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8, fontSize: 10, background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e' }}>
                Дублей не найдено — хранилище чисто.
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setDupes(findDuplicateWorkouts(historyWorkouts))}
                style={{ flex: 1, minWidth: 120, padding: '8px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', cursor: 'pointer' }}>
                🔍 Найти дубли
              </button>
              {dupes && dupes.length > 0 && (
                <button onClick={async () => {
                  setDupesBusy(true);
                  const toDelete = dupes.flatMap(d => d.dupes);
                  for (const d of toDelete) await diary.deleteWorkoutLog(d.id);
                  setDupes(findDuplicateWorkouts(await diary.getWorkoutLogs()));
                  setDupesBusy(false);
                  onRefresh();
                }} disabled={dupesBusy}
                  style={{ flex: 1, minWidth: 120, padding: '8px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)', cursor: 'pointer' }}>
                  {dupesBusy ? 'Удаляю...' : `🗑 Удалить ${dupes.reduce((s, d) => s + d.dupes.length, 0)} дублей`}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <button onClick={() => {
                // Экспорт веса для Google Fit / сторонних приложений
                const rows = getWeightLog().map(e => `${e.date},${e.weight}${e.bodyFat ? `,${e.bodyFat}` : ''}`);
                const csv = ['date,weight_kg,body_fat_pct', ...rows].join('\n');
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `weight_export_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }} style={{ flex: 1, minWidth: 120, padding: '8px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(0,230,138,0.1)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.3)', cursor: 'pointer' }}>
                📤 Экспорт веса CSV (Google Fit)
              </button>
              <label style={{ flex: 1, minWidth: 120, padding: '8px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(0,230,138,0.1)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.3)', cursor: 'pointer', textAlign: 'center' }}>
                📥 Импорт веса CSV
                <input type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    try {
                      const text = String(reader.result || '');
                      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                      const entries: Array<{ date: string; weight: number; bodyFat?: number }> = [];
                      for (const l of lines) {
                        if (/^date/i.test(l)) continue;
                        const parts = l.split(/[;,]/).map(p => p.trim());
                        const date = parts[0];
                        const weight = parseFloat(parts[1]);
                        const bodyFat = parts[2] !== undefined ? parseFloat(parts[2]) : undefined;
                        if (!/^\d{4}-\d{2}-\d{2}/.test(date) || !Number.isFinite(weight) || weight <= 0) continue;
                        entries.push({ date, weight, bodyFat: Number.isFinite(bodyFat) && (bodyFat as number) > 0 ? bodyFat as number : undefined });
                      }
                      if (entries.length === 0) { alert('Нет валидных строк (формат: дата,вес[,жир%])'); return; }
                      const existing = getWeightLog();
                      const byDate = new Map(existing.map(e => [e.date, e]));
                      entries.forEach(entry => {
                        const prev = byDate.get(entry.date);
                        byDate.set(entry.date, { date: entry.date, weight: entry.weight, ...(entry.bodyFat != null ? { bodyFat: entry.bodyFat } : {}), ...(prev?.bodyFat != null && entry.bodyFat == null ? { bodyFat: prev.bodyFat } : {}) });
                      });
                      saveWeightLog([...byDate.values()]);
                      setMeasurements(loadMeasurements());
                      alert(`Импортировано: ${entries.length} записей веса`);
                      onRefresh();
                    } catch { alert('Ошибка чтения файла'); }
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }} />
              </label>
            </div>
          </div>
          {/* JSON Full Backup */}
          <div style={style.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={style.label} >💾 Полный бэкап</div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, padding: '2px 8px', borderRadius: 10, background: 'rgba(0,230,138,0.1)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.3)' }}>
                🔄 Синхронизировано: IDB ↔ localStorage ({historyWorkouts.length})
              </span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Экспорт/импорт всех данных дневника (JSON)</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { void (async () => { await diary.getWorkoutLogs(); onRefresh(); })(); }} style={{ flex: 1, padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(0,230,138,0.08)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.3)', cursor: 'pointer' }}>
                🔄 Синхронизировать
              </button>
              <button onClick={() => {
                const backup = {
                  version: 1,
                  date: new Date().toISOString(),
                  workouts: historyWorkouts,
                  measurements,
                  reports: trainingArchive,
                  rirCalibration: (() => { try { return JSON.parse(localStorage.getItem('he_rir_calibration') || 'null'); } catch { return null; } })(),
                  mmc: (() => { try { return JSON.parse(localStorage.getItem('he_mmc_data') || '[]'); } catch { return []; } })(),
                };
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `diary_backup_${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }} style={{ flex: 1, padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer' }}>
                📥 Экспорт
              </button>
              <label style={{ flex: 1, padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: 'none', cursor: 'pointer', textAlign: 'center' }}>
                📤 Импорт
                <input type="file" accept=".json" onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    (async () => {
                      try {
                        const data = JSON.parse(reader.result as string);
                        if (data.version !== 1 || !data.workouts) { alert('Неверный формат бэкапа'); return; }
                        const existing = historyWorkouts;
                        const existingIds = new Set(existing.map((w: any) => w.id || w.date));
                        const newWorkouts = data.workouts.filter((w: any) => !existingIds.has(w.id || w.date));
                        if (newWorkouts.length === 0) { alert('Все тренировки уже есть в дневнике'); return; }
                        // Запись через единый слой: IDB + зеркало в localStorage (he_workout_log_v2)
                        for (const w of newWorkouts) {
                          await diary.saveWorkoutLog(w);
                        }
                        if (data.measurements?.length) {
                          const existM = loadMeasurements();
                          const existDates = new Set(existM.map((m: any) => m.date));
                          const newM = data.measurements.filter((m: any) => !existDates.has(m.date));
                          if (newM.length) { try { newM.forEach((m: any) => saveMeasurement(m)); } catch {} }
                        }
                        alert(`Импортировано: ${newWorkouts.length} тренировок${data.measurements?.length ? `, ${data.measurements.length} замеров` : ''}`);
                        onRefresh();
                      } catch { alert('Ошибка чтения файла'); }
                    })();
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Редактор сохранённой тренировки */}
      {editingWorkout && (
        <SessionEditorModal
          workout={editingWorkout}
          onClose={() => setEditingWorkout(null)}
          onSave={async (log) => {
            await diary.updateWorkoutLog(log);
            setEditingWorkout(null);
            onRefresh();
          }}
        />
      )}
    </div>
    </DiaryHubContext.Provider>
  );
};

export default TrainingDiaryHub;

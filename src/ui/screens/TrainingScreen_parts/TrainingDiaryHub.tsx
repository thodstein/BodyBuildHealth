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
import { DiaryHistoryView } from './DiaryHistoryView';
import { DiaryToolsView } from './DiaryToolsView';
import { MixDiarySection } from './MixDiarySection';
import { MixEffectivenessCard } from './MixEffectivenessCard';
import { DiaryHubContext, type DiaryHubCtx } from './diary-hub-context';
import { CompetitionPlansView } from './CompetitionPlansView';
import { BBRecommendationsTab } from './BBRecommendationsTab';
import { MyTrainingTab } from './MyTrainingTab';
import { MindsetTab } from './MindsetTab';
import { MobilityTab } from './MobilityTab';
import { loadActiveProtocol, itemsForDay, loadDayProgress, loadCheckins } from '../../../engines/mindset-protocol.engine';
import { loadActiveMobility, itemsForSlot, loadMobilityDayProgress, hasDailyRoutine } from '../../../engines/mobility-protocol.engine';
import { InfoErrorBoundary } from '../SupportScreen_parts/SupportScreenData';

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
  initialMode?: 'record' | 'tools' | 'diary' | 'reports' | 'history' | 'analytics' | 'progress' | 'calendar' | 'checkin' | 'mmc' | 'mindset' | 'mobility' | 'mytraining';
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

type HubMode = 'record' | 'history' | 'analytics' | 'progress' | 'tools' | 'calendar' | 'checkin' | 'mmc' | 'mindset' | 'mobility' | 'competition' | 'recommendations' | 'mytraining';

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
  // «Мои тренировки» (перенесено из Библиотеки): рабочий список упражнений
  const [myTrainingExs, setMyTrainingExs] = useState<{ name: string; sets: number; reps: number; rir: number }[]>([]);
  // Принудительная перерисовка блока «Сегодня» (быстрые отметки рутин/протоколов)
  const [, forceHub] = useState(0);

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
  // Санитизация на входе: legacy-записи без exercises или с exercises={} (не-массив)
  // приводим к [] — защищает ВСЕ подкомпоненты дневника (формы, историю, аналитику).
  const safeHistoryWorkouts = useMemo(
    () => (Array.isArray(historyWorkouts) ? historyWorkouts : []).map(w => ({ ...w, exercises: Array.isArray(w.exercises) ? w.exercises : [] })),
    [historyWorkouts],
  );
  const mesoIds = useMemo(() => Array.from(new Set(safeHistoryWorkouts.map(w => (w as any).mesocycleId).filter((x): x is string => !!x))), [safeHistoryWorkouts]);
  const allExerciseNames = useMemo(() => {
    const names = new Set<string>();
    safeHistoryWorkouts.forEach(w => (w.exercises ?? []).forEach((e: any) => names.add(e.exerciseName || e.exerciseId)));
    return Array.from(names).sort();
  }, [safeHistoryWorkouts]);
  const filteredHistoryWorkouts = useMemo(() => {
    if (!historyExerciseFilter) return safeHistoryWorkouts;
    const safeExercises = (w: any): any[] => (Array.isArray(w.exercises) ? w.exercises : []);
    return safeHistoryWorkouts.map(w => ({
      ...w,
      // legacy-записи без exercises или с exercises={} не должны ронять фильтр истории
      exercises: safeExercises(w).filter((e: any) => (e.exerciseName || e.exerciseId).toLowerCase().includes(historyExerciseFilter.toLowerCase())),
    })).filter(w => safeExercises(w).length > 0);
  }, [safeHistoryWorkouts, historyExerciseFilter]);

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
    if (safeHistoryWorkouts.length > 0) {
      const logs: any[] = [];
      safeHistoryWorkouts.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
        (e.sets || []).forEach((s: any) => logs.push({ date: w.date, exercise: e.exerciseName || e.exerciseId, weight: s.weight, reps: s.reps, rpe: 7 }));
      }));
      if (logs.length > 0) setRepData(generateWeeklyReport(logs, logs.map((l: any) => ({ date: l.date, durationMin: 60 }))));
    }
  }, [safeHistoryWorkouts]);

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
    if (safeHistoryWorkouts.length === 0) return null;
    try {
      const mapped = safeHistoryWorkouts.map(w => ({
        sessionId: w.id, date: w.date, focus: w.split || 'fullbody', durationMin: w.duration || 60,
        sets: (w.exercises || []).flatMap((ex: any) => (ex.sets || []).map((s: any, i: number) => ({
          exerciseId: ex.exerciseId || ex.name || 'unknown', exerciseName: ex.name || 'Exercise',
          reps: s.reps || 0, weight: s.weight || 0, rpe: s.rpe || 5, rir: s.rir || 3, date: w.date, setIndex: i,
        }))),
      }));
      if (!mapped.some(m => m.sets.length > 0)) return null;
      return computeAnalytics({ sessions: mapped, weeks: 4 });
    } catch { return null; }
  }, [safeHistoryWorkouts]);

  const wsg = useMemo(() => weeklySetsByGroup(safeHistoryWorkouts, 8), [safeHistoryWorkouts]);
  const groups = useMemo(() => Object.keys(wsg).sort((a, b) => (wsg[b]?.reduce((s: number, x: number) => s + x, 0) || 0) - (wsg[a]?.reduce((s: number, x: number) => s + x, 0) || 0)), [wsg]);
  const totals = useMemo(() => Array.from({ length: 8 }, (_, i) => groups.reduce((s, g) => s + (wsg[g]?.[i] || 0), 0)), [wsg, groups]);

  const groupedHistory = useMemo(() => {
    const map = new Map<string, WorkoutLog[]>();
    for (const w of safeHistoryWorkouts) {
      const week = w.weekNumber ? `Неделя ${w.weekNumber}` : w.date.slice(0, 7);
      if (!map.has(week)) map.set(week, []);
      map.get(week)!.push(w);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [safeHistoryWorkouts]);
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
  const vizSessions: VizSessionData[] = useMemo(() => safeHistoryWorkouts.map((s: any) => ({
    week: s.weekNumber || 1, date: s.date || '',
    exercises: (s.exercises || []).map((e: any) => ({
      name: e.exerciseName || e.name || '', sets: e.sets?.length || 0,
      reps: Math.max(...(e.sets || [{ reps: 0 }]).map((st: any) => st.reps || 0), 0),
      weight: Math.max(...(e.sets || [{ weight: 0 }]).map((st: any) => st.weight || 0), 0),
      rpe: 7, volume: e.totalVolume || 0,
    })),
  })), [safeHistoryWorkouts]);
  const visDashboard = useMemo(() => { try { return safeHistoryWorkouts.length > 2 ? buildVisualDashboard(vizSessions) : null; } catch { return null; } }, [vizSessions, safeHistoryWorkouts]);
  const visWeekly = useMemo(() => { try { return computeWeeklyChart(vizSessions); } catch { return []; } }, [vizSessions]);
  const visMuscleVol = useMemo(() => { try { return computeMuscleVolume(vizSessions); } catch { return []; } }, [vizSessions]);
  const visProg = useMemo(() => { try { return computeProgression(vizSessions); } catch { return []; } }, [vizSessions]);

  // Expert analytics data
  const expertSrpe = useMemo(() => { try { return loadSRPESessions(); } catch { return []; } }, []);
  const expertAcwr = useMemo(() => expertSrpe.length >= 2 ? acuteChronicRatio(toDailyLoads(expertSrpe)).ratio : 1.0, [expertSrpe]);
  const expertMono = useMemo(() => { try { return expertSrpe.length >= 7 ? weeklyMonotony(toDailyLoads(expertSrpe)).monotony : 0; } catch { return 0; } }, [expertSrpe]);
  const expertExercises = useMemo(() => {
    const exMap = new Map<string, { first: number; last: number }>();
    for (const w of safeHistoryWorkouts) {
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
  }, [safeHistoryWorkouts]);
  const expertRecentVol = useMemo(() => safeHistoryWorkouts.slice(-14).reduce((s: number, w: any) => s + ((w.exercises || []).length), 0), [safeHistoryWorkouts]);
  const expertRirStats = useMemo(() => { try { return loadRirCalibrationStats(); } catch { return { bias: 0, stdDev: 1, sessions: 0 }; } }, []);
  const clearTrimWarning = () => { clearStorageTrimWarning(); setTrimWarning(null); };

  const hub: DiaryHubCtx = {
    mode, setMode, onGoRecord, onRefresh, diary,
    historyWorkouts: safeHistoryWorkouts, diaryProgress, diaryStats, level, tprofile, linked,
    trainingOutput, macrocycle, selectedWeek, mesoLength, curPhase,
    goal, daysPerWeek, splitType, periodizationType,
    trainingArchive, setTrainingArchive, trainingReportGenerated, setTrainingReportGenerated,
    analytics, wsg, groups, totals,
    visDashboard, visWeekly, visMuscleVol, visProg,
    expertSrpe, expertAcwr, expertMono, expertExercises, expertRecentVol, expertRirStats,
    measurements, setMeasurements,
    mWeight, setMWeight, mWaist, setMWaist, mChest, setMChest, mArm, setMArm, mThigh, setMThigh, mDate, setMDate,
    saveMeasurementHandler, measureAnalytics, repData,
    hubAnalyticsExpanded, setHubAnalyticsExpanded, barTooltip, setBarTooltip,
    progressionAlerts, trimWarning, setTrimWarning, clearTrimWarning,
    mesoIds, mesoFilter, setMesoFilter, search, setSearch, filterGroup, setFilterGroup,
    groupPickerOpen, setGroupPickerOpen, exPickerOpen, setExPickerOpen, exSearch, setExSearch,
    notesPickerOpen, setNotesPickerOpen,
    historyExerciseFilter, setHistoryExerciseFilter, notesFilter, setNotesFilter,
    allExerciseNames, groupedHistory, filteredHistory, filteredHistoryWorkouts, historyExpanded, setHistoryExpanded,
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
          {/* Подвкладки дневника: запись / соревнования (mode внутри record-блока сужен до 'record') */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button onClick={() => setMode('record')} style={{ flex: 1, minWidth: 100, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--accent)', background: 'rgba(0,230,138,0.12)', color: 'var(--accent)', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>📓 Запись</button>
            <button onClick={() => setMode('history')} style={{ flex: 1, minWidth: 90, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', color: 'var(--text-dim)', fontWeight: 400, fontSize: 11, cursor: 'pointer' }}>📜 История</button>
            <button onClick={() => setMode('mytraining')} style={{ flex: 1, minWidth: 110, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', color: 'var(--text-dim)', fontWeight: 400, fontSize: 11, cursor: 'pointer' }}>⭐ Мои тренировки</button>
            <button onClick={() => setMode('competition')} style={{ flex: 1, minWidth: 110, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', color: 'var(--text-dim)', fontWeight: 400, fontSize: 11, cursor: 'pointer' }}>🏁 Соревнования</button>
            <button onClick={() => setMode('recommendations')} style={{ flex: 1, minWidth: 110, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', color: 'var(--text-dim)', fontWeight: 400, fontSize: 11, cursor: 'pointer' }}>💡 Рекомендации</button>
          </div>
          <InfoErrorBoundary label="Сегодня"><>{(() => {
            const todayIdx = (new Date().getDay() + 6) % 7;
            const planned = (trainingOutput?.plan?.[todayIdx] && trainingOutput.plan[todayIdx].exercises.length > 0) ? trainingOutput.plan[todayIdx] : null;
            const last = safeHistoryWorkouts[0];
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
                    {/* legacy-запись без exercises или с exercises={} не должна ронять «Сегодня» */}
                    Последняя: <span style={{ color: '#fff' }}>{last.split || 'Тренировка'}</span> · {(Array.isArray(last.exercises) ? last.exercises : []).length} упр. · {((Array.isArray(last.exercises) ? last.exercises : []).reduce((s, e) => s + e.totalVolume, 0) / 1000).toFixed(1)}т
                  </div>
                )}
                {sleepHours != null && sleepHours < 6 && (
                  <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 8, fontSize: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
                    ⚠️ Менее 6 часов сна ({sleepHours} ч) — учтите в интенсивности сегодняшней тренировки
                  </div>
                )}
                {(() => {
                  // Психо-чек-ин: сегодня была тренировка, но чек-ин не заполнен
                  const today = new Date().toISOString().slice(0, 10);
                  const trainedToday = safeHistoryWorkouts.some(w => (w.date || '').slice(0, 10) === today);
                  if (!trainedToday) return null;
                  const checkinToday = loadCheckins().some(c => (c.date || '').slice(0, 10) === today);
                  if (checkinToday) return null;
                  return (
                    <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 8, fontSize: 10, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span>🧠 Сегодня тренировка без психо-чек-ина</span>
                      <button onClick={() => setMode('mindset')} style={{ padding: '3px 10px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: 'rgba(167,139,250,0.2)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.4)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Заполнить →
                      </button>
                    </div>
                  );
                })()}
                {(() => {
                  // Мобильность: ежедневная рутина не выполнена
                  const today = new Date().toISOString().slice(0, 10);
                  const mobProtocol = loadActiveMobility();
                  if (!mobProtocol || !hasDailyRoutine(mobProtocol)) return null;
                  const dailyIds = itemsForSlot(mobProtocol, 'daily').map(it => it.id);
                  const progress = loadMobilityDayProgress(today);
                  const doneToday = dailyIds.length > 0 && dailyIds.every(id => progress.doneItems.includes(id));
                  if (doneToday) return null;
                  const markDailyDone = () => {
                    try {
                      localStorage.setItem('he_mobility_day_progress', JSON.stringify({ date: today, doneItems: dailyIds }));
                    } catch { /* ignore */ }
                    forceHub(h => h + 1);
                  };
                  return (
                    <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 8, fontSize: 10, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span>🧘 Ежедневная рутина мобильности не выполнена</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={markDailyDone} style={{ padding: '3px 10px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: 'rgba(96,165,250,0.2)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.4)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          ✓ Рутина выполнена
                        </button>
                        <button onClick={() => setMode('mobility')} style={{ padding: '3px 10px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: 'rgba(96,165,250,0.2)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.4)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          К рутине →
                        </button>
                      </div>
                    </div>
                  );
                })()}
                {(() => {
                  // Прогресс протоколов сегодня (чипы-ссылки на вкладки)
                  const today = new Date().toISOString().slice(0, 10);
                  const mindProto = loadActiveProtocol();
                  const mobProto = loadActiveMobility();
                  if (!mindProto && !mobProto) return null;
                  const mindItems = mindProto ? itemsForDay(mindProto, 'all') : [];
                  const mobDaily = mobProto ? itemsForSlot(mobProto, 'daily') : [];
                  const mindDone = mindProto ? loadDayProgress(today).doneItems : [];
                  const mobDone = mobProto ? loadMobilityDayProgress(today).doneItems : [];
                  const mindPct = mindItems.length > 0 ? Math.round(mindItems.filter(i => mindDone.includes(i.id)).length / mindItems.length * 100) : null;
                  const mobPct = mobDaily.length > 0 ? Math.round(mobDaily.filter(i => mobDone.includes(i.id)).length / mobDaily.length * 100) : null;
                  return (
                    <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {mindPct !== null && (
                        <button onClick={() => setMode('mindset')} style={{ padding: '3px 10px', borderRadius: 12, fontSize: 9, fontWeight: 700, cursor: 'pointer', background: mindPct === 100 ? 'rgba(34,197,94,0.12)' : 'rgba(167,139,250,0.12)', color: mindPct === 100 ? '#22c55e' : '#a78bfa', border: `1px solid ${mindPct === 100 ? 'rgba(34,197,94,0.35)' : 'rgba(167,139,250,0.35)'}`, whiteSpace: 'nowrap' }}>
                          🧠 Психо-протокол: {mindPct}%
                        </button>
                      )}
                      {mobPct !== null && (
                        <button onClick={() => setMode('mobility')} style={{ padding: '3px 10px', borderRadius: 12, fontSize: 9, fontWeight: 700, cursor: 'pointer', background: mobPct === 100 ? 'rgba(34,197,94,0.12)' : 'rgba(96,165,250,0.12)', color: mobPct === 100 ? '#22c55e' : '#60a5fa', border: `1px solid ${mobPct === 100 ? 'rgba(34,197,94,0.35)' : 'rgba(96,165,250,0.35)'}`, whiteSpace: 'nowrap' }}>
                          🧘 Рутина: {mobPct}%
                        </button>
                      )}
                    </div>
                  );
                })()}
                {(() => {
                  // День отдыха: сессия мобильности (rest_day-блоки)
                  const today = new Date().toISOString().slice(0, 10);
                  const trainedToday = safeHistoryWorkouts.some(w => (w.date || '').slice(0, 10) === today);
                  if (trainedToday) return null;
                  const mobProtocol = loadActiveMobility();
                  if (!mobProtocol || itemsForSlot(mobProtocol, 'rest_day').length === 0) return null;
                  return (
                    <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 8, fontSize: 10, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span>🧘 Сегодня нет тренировки — день отдыха: выполните сессию мобильности</span>
                      <button onClick={() => setMode('mobility')} style={{ padding: '3px 10px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: 'rgba(167,139,250,0.2)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.4)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Сессия мобильности →
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
          })()}</>
          </InfoErrorBoundary>
          <InfoErrorBoundary label="Тренировочные миксы"><MixDiarySection hasTrainingToday={safeHistoryWorkouts.some(w => w.date === new Date().toISOString().slice(0, 10))} /></InfoErrorBoundary>
          <InfoErrorBoundary label="Форма записи"><RecordModeSelector diary={diary} historyWorkouts={safeHistoryWorkouts} selectedWeek={selectedWeek} onSave={onRefresh}
            sub={recordSub} onSubChange={setRecordSub}
            pendingTemplate={planToRecord?.day} templateKey={planToRecord?.nonce} onTemplateApplied={() => setPlanToRecord(null)} /></InfoErrorBoundary>
        </div>
      )}

      {/* ═══ MODE: HISTORY ═══ */}
      {mode === 'history' && <DiaryHistoryView hub={hub} />}

      {/* ═══ MODE: COMPETITION ═══ — сохранённые соревновательные циклы */}
      {mode === 'competition' && <CompetitionPlansView onBack={() => setMode('record')} />}

      {/* ═══ MODE: RECOMMENDATIONS ═══ — профессиональные рекомендации (ББ) */}
      {mode === 'recommendations' && <BBRecommendationsTab hub={hub} />}

      {/* ═══ MODE: MY TRAINING ═══ — пользовательские упражнения/планы/циклы (перенесено из Библиотеки) */}
      {mode === 'mytraining' && (
        <InfoErrorBoundary label="Мои тренировки">
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <MyTrainingTab customExercises={myTrainingExs} setCustomExercises={setMyTrainingExs} goal={goal} level={level} daysPerWeek={daysPerWeek} mesoLength={mesoLength} />
          </div>
        </InfoErrorBoundary>
      )}

      {/* ═══ MODE: ANALYTICS ═══ */}
      {mode === 'analytics' && (
        <>
          <DiaryAnalyticsView hub={hub} />
          <MixEffectivenessCard workouts={historyWorkouts} />
        </>
      )}

      {/* ═══ MODE: PROGRESS ═══ */}
      {mode === 'progress' && <DiaryProgressView hub={hub} />}

      {/* Dedicated diary sub-tabs. These used to fall through to record/body,
          which made the navigation appear clickable without changing content. */}
      {mode === 'calendar' && <TrainingCalendarTab />}
      {mode === 'checkin' && <CheckinMetricsCard />}
      {mode === 'mmc' && <MMCTrackingCard />}
      {mode === 'mindset' && <InfoErrorBoundary label="Психология"><MindsetTab hub={hub} /></InfoErrorBoundary>}
      {mode === 'mobility' && <InfoErrorBoundary label="Мобильность"><MobilityTab hub={hub} /></InfoErrorBoundary>}

      {/* ═══ MODE: TOOLS ═══ — import + export + reports */}
      {mode === 'tools' && <DiaryToolsView hub={hub} />}

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

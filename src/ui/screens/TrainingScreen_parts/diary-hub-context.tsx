/** diary-hub-context.tsx — контекст состояния TrainingDiaryHub.
 *  Позволяет выносить режимы (Аналитика/Прогресс/…) в отдельные файлы без прокидывания пропсов. */
import React, { createContext, useContext } from 'react';
import type { WorkoutLog, TrainingOutput } from '../../../core/types';
import type { StrengthStats, WeeklyProgress, ProgressionAlert } from '../../../engines/strength-diary.engine';
import type { MacrocyclePlan } from '../../../engines/training-periodization.engine';

export interface DiaryHubCtx {
  mode: string;
  setMode: (m: any) => void;
  onGoRecord?: () => void;
  onRefresh: () => void;
  diary: any;
  historyWorkouts: WorkoutLog[];
  diaryProgress: WeeklyProgress[];
  diaryStats: StrengthStats[];
  level: string;
  tprofile: any;
  linked: any;
  trainingOutput: TrainingOutput | null;
  macrocycle: MacrocyclePlan | null;
  selectedНеделя: number;
  mesoLength: number;
  curPhase: any;
  goal: string;
  daysPerНеделя: number;
  splitType: string;
  periodizationType: string;
  trainingArchive: any[];
  setTrainingArchive: (a: any[]) => void;
  trainingReportGenerated: boolean;
  setTrainingReportGenerated: (b: boolean) => void;

  analytics: any;
  wsg: Record<string, number[]>;
  groups: string[];
  totals: number[];
  visDashboard: any;
  visWeekly: any[];
  visMuscleVol: any[];
  visProg: any[];
  expertSrpe: any[];
  expertAcwr: number;
  expertMono: number;
  expertExercises: any[];
  expertRecentVol: number;
  expertRirStats: any;

  measurements: any[];
  setMeasurements: (m: any[]) => void;
  mWeight: number; setMWeight: (n: number) => void;
  mWaist: number; setMWaist: (n: number) => void;
  mChest: number; setMChest: (n: number) => void;
  mArm: number; setMArm: (n: number) => void;
  mThigh: number; setMThigh: (n: number) => void;
  mDate: string; setMDate: (s: string) => void;
  saveMeasurementHandler: () => void;
  measureAnalytics: any;
  repData: any;

  hubAnalyticsExpanded: boolean;
  setHubAnalyticsExpanded: (b: boolean) => void;
  barTooltip: any;
  setBarTooltip: (t: any) => void;

  progressionAlerts: ProgressionAlert[];
  trimWarning: any;
  setTrimWarning: (w: any) => void;
  clearTrimWarning: () => void;

  mesoIds: string[];
  mesoFilter: string;
  setMesoFilter: (s: string) => void;
  search: string;
  setSearch: (s: string) => void;
  filterGroup: string;
  setFilterGroup: (s: string) => void;
  groupPickerOpen: boolean;
  setGroupPickerOpen: (b: boolean) => void;
  exPickerOpen: boolean;
  setExPickerOpen: (b: boolean) => void;
  exSearch: string;
  setExSearch: (s: string) => void;
  notesPickerOpen: boolean;
  setNotesPickerOpen: (b: boolean) => void;
  historyExerciseFilter: string;
  setHistoryExerciseFilter: (s: string) => void;
  notesFilter: string;
  setNotesFilter: (s: string) => void;
  allExerciseNames: string[];
  groupedHistory: [string, WorkoutLog[]][];
  filteredHistory: [string, WorkoutLog[]][];
  historyExpanded: string | null;
  setHistoryExpanded: (s: any) => void;

  handleEditWorkout: (w: WorkoutLog) => void;
  handleDeleteWorkout: (id: string) => Promise<void>;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (s: string | null) => void;
  editingWorkout: WorkoutLog | null;
  setEditingWorkout: (w: WorkoutLog | null) => void;

  recordSub: 'quick' | 'full';
  setRecordSub: (s: 'quick' | 'full') => void;
  planToRecord: any;
  setPlanToRecord: (p: any) => void;
  reminderTime: string | null;
  scheduleReminder: (t: string, name: string, exercises: string[]) => void;
  dupes: Array<{ keep: any; dupes: any[] }> | null;
  setDupes: (d: Array<{ keep: any; dupes: any[] }> | null) => void;
  dupesBusy: boolean;
  setDupesBusy: (b: boolean) => void;
  filteredHistoryWorkouts: WorkoutLog[];
}

export const DiaryHubContext = createContext<DiaryHubCtx | null>(null);

export function useDiaryHub(): DiaryHubCtx {
  const ctx = useContext(DiaryHubContext);
  if (!ctx) throw new Error('useDiaryHub must be used within DiaryHubContext.Provider');
  return ctx;
}

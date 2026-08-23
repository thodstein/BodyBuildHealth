/** DiaryAnalyticsZone.tsx — зона «Дневник и аналитика» тренировочного блока.
 * Все вкладки рендерятся через TrainingDiaryHub с разными модами.
 * Calendar, MMC, Checkin, Import — интегрированы в hub (body/tools modes).
 * Важно: каждая верхняя вкладка должна передавать свой режим, иначе все
 * кнопки дневника визуально переключаются, но показывают форму записи. */
import React from 'react';
import { StrengthDiary, type StrengthStats, type WeeklyProgress } from '../../../engines/strength-diary.engine';
import type { WorkoutLog, TrainingOutput } from '../../../core/types';
import type { MacrocyclePlan } from '../../../engines/training-periodization.engine';
import { InfoErrorBoundary } from '../SupportScreen_parts/SupportScreenData';
import { TrainingDiaryHub } from './TrainingDiaryHub';
import type { TrainingTab } from './shared';

interface Props {
  tab: TrainingTab;
  initialDiaryMode?: 'record' | 'tools' | 'diary' | 'reports' | 'history' | 'analytics' | 'progress' | 'calendar' | 'checkin' | 'mmc' | 'mindset' | 'mobility' | 'warmup' | 'cooldown' | 'mytraining';
  diary: StrengthDiary;
  diaryStats: StrengthStats[];
  diaryProgress: WeeklyProgress[];
  historyWorkouts: WorkoutLog[];
  macrocycle: MacrocyclePlan | null;
  selectedНеделя: number;
  level: string;
  onRefresh: () => void;
  onTabChange?: (tab: TrainingTab) => void;
  trainingOutput: TrainingOutput | null;
  goal: string;
  daysPerНеделя: number;
  splitType: string;
  periodizationType: string;
  mesoLength: number;
  tprofile: any;
  linked: any;
}

/** Map old external tabs and legacy mode names to hub modes */
export function tabToHubMode(tab: TrainingTab, initialDiaryMode?: string): 'record' | 'tools' | 'history' | 'analytics' | 'progress' | 'calendar' | 'checkin' | 'mmc' | 'mindset' | 'mobility' | 'warmup' | 'cooldown' | 'mytraining' {
  // Legacy initialDiaryMode values
  if (initialDiaryMode === 'reports') return 'tools';
  if (initialDiaryMode === 'diary') return 'record';
  switch (tab) {
    case 'analytics': return 'analytics';
    case 'history': return 'history';
    case 'progress': return 'progress';
    case 'calendar': return 'calendar';
    case 'checkin': return 'checkin';
    case 'mmc_tracking': return 'mmc';
    case 'mindset': return 'mindset';
    case 'mobility': return 'mobility';
    case 'warmup': return 'warmup';
    case 'cooldown': return 'cooldown';
    case 'mytraining': return 'mytraining';
    case 'reports':
    case 'import_data': return 'tools';
    case 'diary': return 'record';
    default: return 'record';
  }
}

export const DiaryAnalyticsZone: React.FC<Props> = (p) => {
  return (
    <InfoErrorBoundary label="Дневник">
      <TrainingDiaryHub
        initialMode={p.initialDiaryMode || tabToHubMode(p.tab)}
        diary={p.diary}
        diaryStats={p.diaryStats}
        diaryProgress={p.diaryProgress}
        historyWorkouts={p.historyWorkouts}
        macrocycle={p.macrocycle}
        selectedWeek={p.selectedWeek}
        level={p.level}
        onRefresh={p.onRefresh}
        onGoRecord={p.onTabChange ? () => p.onTabChange!('diary') : undefined}
        trainingOutput={p.trainingOutput}
        goal={p.goal}
        daysPerWeek={p.daysPerWeek}
        splitType={p.splitType}
        periodizationType={p.periodizationType}
        mesoLength={p.mesoLength}
        tprofile={p.tprofile}
        linked={p.linked}
      />
    </InfoErrorBoundary>
  );
};

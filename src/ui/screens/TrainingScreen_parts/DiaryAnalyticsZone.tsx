/** DiaryAnalyticsZone.tsx — зона «Дневник и аналитика» тренировочного блока.
 * Объединяет: дневник (TrainingDiaryHub), календарь, MMC-трекинг, импорт CSV.
 * Содержимое зоны — ровно эти 4 вкладки; нигде больше они не рендерятся. */
import React from 'react';
import { StrengthDiary, type StrengthStats, type WeeklyProgress } from '../../../engines/strength-diary.engine';
import type { WorkoutLog, TrainingOutput } from '../../../core/types';
import type { MacrocyclePlan } from '../../../engines/training-periodization.engine';
import { InfoErrorBoundary } from '../SupportScreen_parts/SupportScreenData';
import { TrainingDiaryHub } from './TrainingDiaryHub';
import { TrainingCalendarTab } from './TrainingCalendarTab';
import { CsvImportTab } from './CsvImportTab';
import MMCTrackingCard from './MMCTrackingCard';
import { CheckinMetricsCard } from './CheckinMetricsCard';
import { StrengthAnalyticsCard } from './StrengthAnalyticsCard';
import { GoalsHabitsCard } from './GoalsHabitsCard';
import { InsightsCard } from './InsightsCard';
import type { TrainingTab } from './shared';

interface Props {
  tab: TrainingTab;
  diary: StrengthDiary;
  diaryStats: StrengthStats[];
  diaryProgress: WeeklyProgress[];
  historyWorkouts: WorkoutLog[];
  macrocycle: MacrocyclePlan | null;
  selectedWeek: number;
  level: string;
  onRefresh: () => void;
  trainingOutput: TrainingOutput | null;
  goal: string;
  daysPerWeek: number;
  splitType: string;
  periodizationType: string;
  mesoLength: number;
  tprofile: any;
  linked: any;
}

export const DiaryAnalyticsZone: React.FC<Props> = (p) => {
  return (
    <>
      {p.tab === 'diary' && (
        <InfoErrorBoundary label="Дневник">
          <TrainingDiaryHub
            diary={p.diary}
            diaryStats={p.diaryStats}
            diaryProgress={p.diaryProgress}
            historyWorkouts={p.historyWorkouts}
            macrocycle={p.macrocycle}
            selectedWeek={p.selectedWeek}
            level={p.level}
            onRefresh={p.onRefresh}
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
      )}
      {p.tab === 'calendar' && (
        <InfoErrorBoundary label="Календарь тренировок">
          <TrainingCalendarTab />
        </InfoErrorBoundary>
      )}
      {p.tab === 'mmc_tracking' && (
        <InfoErrorBoundary label="MMC-трекинг">
          <MMCTrackingCard />
        </InfoErrorBoundary>
      )}
      {p.tab === 'checkin' && (
        <InfoErrorBoundary label="Чек-ин метрик">
          <CheckinMetricsCard />
        </InfoErrorBoundary>
      )}
      {p.tab === 'insights' && (
        <InfoErrorBoundary label="Авто-инсайты">
          <InsightsCard />
        </InfoErrorBoundary>
      )}
      {p.tab === 'strength' && (
        <InfoErrorBoundary label="Аналитика силы">
          <StrengthAnalyticsCard />
        </InfoErrorBoundary>
      )}
      {p.tab === 'goals' && (
        <InfoErrorBoundary label="Цели и привычки">
          <GoalsHabitsCard />
        </InfoErrorBoundary>
      )}
      {p.tab === 'import_data' && (
        <InfoErrorBoundary label="Импорт CSV">
          <CsvImportTab onDone={p.onRefresh} />
        </InfoErrorBoundary>
      )}
    </>
  );
};

/** LibraryZone.tsx — зона «Библиотека» тренировочного блока.
 * Единый каталог тренировочных процессов: циклы (LMS), программы, методики, упражнения, «мои тренировки».
 * Содержимое зоны — ровно эти 5 вкладок; нигде больше они не рендерятся. */
import React from 'react';
import { InfoErrorBoundary } from '../SupportScreen_parts/SupportScreenData';
import { useDataLink } from '../../../core/data-link';
import { CycleCatalog } from './CycleCatalog';
import type { TrainingOutput, WorkoutLog } from '../../../core/types';
import type { StrengthStats } from '../../../engines/strength-diary.engine';
import { MethodsTab } from './MethodsTab';
import { ProgramsTab } from './ProgramsTab';
import ExerciseLabCatalog from './ExerciseLabCatalog';
import { PeakingProtocolsTab } from './PeakingProtocolsTab';
import { TaperPlannerTab } from './TaperPlannerTab';
import type { TrainingTab } from './shared';

type CustomEx = { name: string; sets: number; reps: number; rir: number };

interface Props {
  tab: TrainingTab;
  linked: ReturnType<typeof useDataLink>;
  trainingOutput: TrainingOutput | null;
  diaryStats: StrengthStats[];
  historyWorkouts: WorkoutLog[];
  goal: string;
  level: string;
  daysPerWeek: number;
  recovery: number;
  fatigue: number;
  appliedMethods: Record<string, string>;
  setAppliedMethods: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  applyMethodComposition: () => void;
  goPlannerManual: () => void;
  selectedProgram: string | null;
  setSelectedProgram: (id: string | null) => void;
  customExercises: CustomEx[];
  setCustomExercises: React.Dispatch<React.SetStateAction<CustomEx[]>>;
  mesoLength: number;
  onLoadToConstructor?: () => void;
}

export const LibraryZone: React.FC<Props> = (p) => {
  return (
    <>
      {p.tab === 'library' && (
        <InfoErrorBoundary label="Каталог циклов">
          <CycleCatalog
            goal={p.goal}
            level={p.level}
            daysPerWeek={p.daysPerWeek}
            linked={p.linked}
          />
        </InfoErrorBoundary>
      )}
      {p.tab === 'methods' && (
        <InfoErrorBoundary label="Методы">
          <MethodsTab
            linked={p.linked}
            trainingOutput={p.trainingOutput}
            diaryStats={p.diaryStats}
            historyWorkouts={p.historyWorkouts}
            goal={p.goal} level={p.level} daysPerWeek={p.daysPerWeek}
            recovery={p.recovery} fatigue={p.fatigue}
            appliedMethods={p.appliedMethods}
            onToggleMethod={(name, category) => p.setAppliedMethods(prev => { const next = { ...prev }; if (next[category] === name) delete next[category]; else next[category] = name; return next; })}
            onApplyComposition={() => { p.applyMethodComposition(); p.goPlannerManual(); }}
          />
        </InfoErrorBoundary>
      )}
      {p.tab === 'programs' && (
        <InfoErrorBoundary label="Программы">
          <ProgramsTab
            selectedProgram={p.selectedProgram}
            setSelectedProgram={p.setSelectedProgram}
            onAddToMyTraining={(exs) => p.setCustomExercises(prev => [...prev, ...exs])}
            onLoadToConstructor={(prog) => { p.setCustomExercises(prev => [...prev, ...(prog.exercises || [])]); }}
            goPlannerManual={p.goPlannerManual}
          />
        </InfoErrorBoundary>
      )}
      {p.tab === 'peaking' && (
        <InfoErrorBoundary label="Пик-протоколы">
          <PeakingProtocolsTab />
        </InfoErrorBoundary>
      )}
      {p.tab === 'calc_taper' && (
        <InfoErrorBoundary label="Тапинг-методики">
          <TaperPlannerTab />
        </InfoErrorBoundary>
      )}
      {p.tab === 'exercises' && (
        <InfoErrorBoundary label="Упражнения">
          <ExerciseLabCatalog />
        </InfoErrorBoundary>
      )}
    </>
  );
};

/** LibraryZone.tsx — зона «Библиотека» тренировочного блока.
 * Единый каталог тренировочных процессов: циклы (LMS), программы, методики, упражнения, «мои тренировки».
 * Содержимое зоны — ровно эти 5 вкладок; нигде больше они не рендерятся. */
import React from 'react';
import { InfoErrorBoundary } from '../SupportScreen_parts/SupportScreenData';
import { useDataLink } from '../../../core/data-link';
import { ExpandableCard } from '../SRCBBScreen_parts/TrainingPopups';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import type { TrainingOutput, WorkoutLog } from '../../../core/types';
import type { StrengthStats } from '../../../engines/strength-diary.engine';
import { MethodsTab } from './MethodsTab';
import { ProgramsTab } from './ProgramsTab';
import { MyTrainingTab } from './MyTrainingTab';
import ExerciseLabCatalog from './ExerciseLabCatalog';
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
}

export const LibraryZone: React.FC<Props> = (p) => {
  return (
    <>
      {p.tab === 'library' && (
        <InfoErrorBoundary label="Каталог циклов">
          <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', marginBottom: 2 }}>📖 Каталог тренировочных циклов</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Справочник готовых циклов (силовые / блочные / встроенные) с описанием, механизмом работы и условиями. Методики и программы — в соответствующих вкладках группы «Библиотека».</div>
            <ExpandableCard title="🔄 Каталог циклов (силовые / блоки / встроенные)" icon="📖" short="Все доступные циклы с полным описанием. Нажмите, чтобы развернуть." full={
              <div>
                {LMS_CYCLES.map(c => (
                  <ExpandableCard key={c.meta.id} title={c.meta.title} icon="" accent="#00e68a" short={c.meta.description} full={<><div style={{ marginBottom: 6 }}>{c.meta.howItWorks}</div>{c.meta.conditions.length > 0 && <div><b>Условия:</b><ul style={{ margin: '4px 0 0 16px', padding: 0 }}>{c.meta.conditions.map((cond, i) => <li key={i} style={{ marginBottom: 2 }}>{cond}</li>)}</ul></div>}</>} />
                ))}
              </div>
            } />
          </div>
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
          />
        </InfoErrorBoundary>
      )}
      {p.tab === 'exercises' && (
        <InfoErrorBoundary label="Упражнения">
          <ExerciseLabCatalog />
        </InfoErrorBoundary>
      )}
      {p.tab === 'mytraining' && (
        <InfoErrorBoundary label="Мои тренировки">
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <MyTrainingTab customExercises={p.customExercises} setCustomExercises={p.setCustomExercises} goal={p.goal} level={p.level} daysPerWeek={p.daysPerWeek} mesoLength={p.mesoLength} />
          </div>
        </InfoErrorBoundary>
      )}
    </>
  );
};

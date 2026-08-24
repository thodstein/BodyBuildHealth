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
  daysPerНеделя: number;
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
  const TITLE_MAP: Record<string, { icon:string; title:string; accent:string; desc:string }> = {
    library: { icon:'📖', title:'Каталог циклов', accent:'#f59e0b', desc:'Готовые циклы ПЛ и ББ с фильтрами и раскладкой' },
    programs: { icon:'📚', title:'Программы', accent:'#8b5cf6', desc:'Полные программы по неделям и дням' },
    methods: { icon:'🧠', title:'Методики', accent:'#a855f7', desc:'Техники интенсификации и периодизации' },
    exercises: { icon:'🏋️', title:'Упражнения', accent:'#00e68a', desc:'Каталог 500+ упражнений с биомеханикой' },
  };
  const cur = TITLE_MAP[p.tab] || TITLE_MAP.library;
  return (
    <>
      <div style={{ background:`linear-gradient(135deg, ${cur.accent}18, rgba(0,230,138,0.06))`, border:`1px solid ${cur.accent}30`, borderRadius:14, padding:'12px 14px', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ width:32, height:32, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:`${cur.accent}22`, border:`1px solid ${cur.accent}35`, fontSize:16 }}>{cur.icon}</span>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>{cur.title}</div>
            <div style={{ fontSize:10, color:'#fff', opacity:0.9 }}>{cur.desc}</div>
          </div>
        </div>
        <span style={{ fontSize:10, padding:'4px 8px', borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', whiteSpace:'nowrap' }}>{p.tab}</span>
      </div>
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

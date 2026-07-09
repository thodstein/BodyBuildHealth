import React from 'react';
import type { UserProfile, UnifiedSettings } from '../../../core/types';
import { theme, HealthBool, NumberPc, SliderPc, PopupCard, TextPc } from './ProfileComponents';

interface Props {
  settings: UserProfile['settings'];
  save: (partial: any) => void;
  calcData: any;
  upCalc: (k: string, v: any) => void;
  toggleWeakPoint: (id: string) => void;
}

const SPORT_TYPES: { id: string; label: string }[] = [
  { id: 'bodybuilding', label: 'Бодибилдинг' }, { id: 'powerlifting', label: 'Пауэрлифтинг' },
  { id: 'crossfit', label: 'Кроссфит' }, { id: 'fitness', label: 'Фитнес' }, { id: 'other', label: 'Другое' },
];
const TRAINING_LEVELS: { id: string; label: string }[] = [
  { id: 'beginner', label: 'Новичок' }, { id: 'intermediate', label: 'Средний' },
  { id: 'advanced', label: 'Продвинутый' }, { id: 'enhanced', label: 'Enhanced' }
];
const PHARMA_EXPERIENCE: { id: string; label: string }[] = [
  { id: 'none', label: 'Нет' }, { id: 'beginner', label: 'Начинающий' },
  { id: 'intermediate', label: 'Средний' }, { id: 'advanced', label: 'Продвинутый' }
];
const GOALS: { id: string; label: string }[] = [
  { id: 'bulk', label: 'Масса' }, { id: 'cut', label: 'Сушка' }, { id: 'maintenance', label: 'Поддержка' },
  { id: 'strength', label: 'Сила' }, { id: 'hypertrophy', label: 'Гипертрофия' }, { id: 'rehab', label: 'Реабилитация' },
  { id: 'recomposition', label: 'Рекомп' }, { id: 'health', label: 'Здоровье' }
];
const MUSCLE_GROUPS_FULL: { id: string; label: string }[] = [
  { id: 'chest', label: 'Грудь' }, { id: 'back', label: 'Спина' }, { id: 'shoulders', label: 'Плечи' },
  { id: 'biceps', label: 'Бицепс' }, { id: 'triceps', label: 'Трицепс' }, { id: 'quads', label: 'Квадрицепс' },
  { id: 'hamstrings', label: 'Бицепс бедра' }, { id: 'glutes', label: 'Ягодицы' }, { id: 'calves', label: 'Икры' },
  { id: 'abs', label: 'Пресс' }, { id: 'traps', label: 'Трапеция' }, { id: 'forearms', label: 'Предплечья' },
];
const TRAINING_CYCLE_TYPES = [
  { id: 'mass', label: 'Масса' }, { id: 'cut', label: 'Сушка' },
  { id: 'maintenance', label: 'Поддержка' }, { id: 'endurance', label: 'Выносливость' },
];
const COURSE_PHASES: { id: string; label: string }[] = [
  { id: 'baseline', label: 'База' }, { id: 'course', label: 'Курс' },
  { id: 'bridge', label: 'Бридж' }, { id: 'pct', label: 'ПКТ' },
  { id: 'post_pct', label: 'После ПКТ' }, { id: 'fertility', label: 'Фертильность' },
];

export const ProfileTrainingSection: React.FC<Props> = ({ settings, save, calcData, upCalc, toggleWeakPoint }) => {
  const s = settings as any as UnifiedSettings;
  const tr = s.training || {} as any;
  const ls = s.lifestyle || {} as any;
  const ph = s.pharma || {} as any;
  const cGoals = (calcData || {}).goals || {};
  const wp = tr.weakPoints ?? [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      <NumberPc icon="📅" label="Тренировок/нед" value={tr.daysPerWeek || ''} onChange={v => save({ workoutsPerWeek: parseFloat(v) || 0 })} suffix="дн" />
      <NumberPc icon="⏱" label="Мин/тренировку" value={tr.minutesPerSession || ''} onChange={v => save({ avgWorkoutMinutes: parseFloat(v) || 0 })} suffix="мин" />
      <PopupCard icon="🏋️" label="Вид спорта" value={SPORT_TYPES.find(st => st.id === tr.sportType)?.label || '—'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {SPORT_TYPES.map(st => (
            <HealthBool key={st.id} label={st.label} active={(tr.sportType || 'bodybuilding') === st.id}
              onClick={() => save({ sportType: st.id })} />
          ))}
        </div>
      </PopupCard>
      <NumberPc icon="⏳" label="Стаж" value={tr.experience || ''} onChange={v => save({ trainingExperience: parseInt(v) || 0 })} suffix="лет" />
      <PopupCard icon="📊" label="Уровень" value={TRAINING_LEVELS.find(l => l.id === (tr.level || 'intermediate'))?.label || '—'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {TRAINING_LEVELS.map(l => (
            <HealthBool key={l.id} label={l.label} active={(tr.level || 'intermediate') === l.id}
              onClick={() => save({ trainingLevel: l.id })} />
          ))}
        </div>
      </PopupCard>
      <PopupCard icon="💉" label="Фарма-опыт" value={PHARMA_EXPERIENCE.find(e => e.id === (ph.experience || 'none'))?.label || '—'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {PHARMA_EXPERIENCE.map(e => (
            <HealthBool key={e.id} label={e.label} active={(ph.experience || 'none') === e.id}
              onClick={() => save({ pharmaExperience: e.id })} />
          ))}
        </div>
      </PopupCard>
      <PopupCard icon="🎯" label="Цель" value={GOALS.find(g => g.id === (tr.primaryGoal || ''))?.label || 'Не выбрана'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {GOALS.map(g => (
            <HealthBool key={g.id} label={g.label} active={(tr.primaryGoal || '') === g.id}
              onClick={() => save({ primaryGoal: g.id, goal: g.id })} />
          ))}
        </div>
      </PopupCard>
      <SliderPc icon="😰" label="Стресс" value={ls.stressLevel ?? 3} min={1} max={10} onChange={v => save({ baselineStressLevel: v })} color="#f87171" />
      <PopupCard icon="💪" label="Отстающие группы" value={wp.length ? wp.map((id: string) => MUSCLE_GROUPS_FULL.find(m => m.id === id)?.label || id).join(', ') : 'Не указаны'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {MUSCLE_GROUPS_FULL.map(m => (
            <HealthBool key={m.id} label={m.label} active={wp.includes(m.id)}
              onClick={() => toggleWeakPoint(m.id)} />
          ))}
        </div>
      </PopupCard>
      <PopupCard icon="💉" label="Фаза курса" value={COURSE_PHASES.find(p => p.id === (ph.phase || 'baseline'))?.label || '—'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {COURSE_PHASES.map(p => (
            <HealthBool key={p.id} label={p.label} active={(ph.phase || 'baseline') === p.id}
              onClick={() => save({ phase: p.id })} />
          ))}
        </div>
      </PopupCard>
      <TextPc icon="📅" label="Старт курса" value={ph.courseStartDate || ''} onChange={v => save({ courseStartDate: v })} placeholder="ГГГГ-ММ-ДД" />
      <PopupCard icon="🔄" label="Тип цикла" value={TRAINING_CYCLE_TYPES.find(t => t.id === (cGoals?.trainingCycle || 'mass'))?.label || '—'}>
        <div style={{ display: 'flex', gap: 4 }}>
          {TRAINING_CYCLE_TYPES.map(t => (
            <button key={t.id} onClick={() => upCalc('goals', { ...cGoals, trainingCycle: t.id })}
              style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:11, fontWeight:600,
                background: (cGoals?.trainingCycle || 'mass') === t.id ? '#fb923c' : 'rgba(255,255,255,0.06)',
                color: (cGoals?.trainingCycle || 'mass') === t.id ? '#000' : 'rgba(255,255,255,0.5)',
              }}>{t.label}</button>
          ))}
        </div>
      </PopupCard>
      <NumberPc icon="📅" label="Длина цикла" value={cGoals?.cycleWeeks || 12} onChange={v => upCalc('goals', { ...cGoals, cycleWeeks: parseInt(v) || 12 })} suffix="нед" />
      <NumberPc icon="🔄" label="Прошлых курсов" value={cGoals?.previousCycles || 0} onChange={v => upCalc('goals', { ...cGoals, previousCycles: parseInt(v) || 0 })} />
      <SliderPc icon="😴" label="Усталость" value={ls.fatigueLevel ?? 3} min={1} max={10} onChange={v => save({ fatigueLevel: v })} color="#f87171" />
    </div>
  );
};

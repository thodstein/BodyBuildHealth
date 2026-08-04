import React from 'react';
import { BTN, BTN_GHOST, CARD, DIM, IN, SMALL } from './training-ui';
import { TrainingModal } from './TrainingModal';

export type WizardDirection = 'bb' | 'pl' | 'hybrid';
export type WizardStep = 1 | 2 | 3 | 4;

const DIRECTIONS: Array<[WizardDirection, string, string]> = [
  ['bb', '💪 Бодибилдинг', 'hypertrophy'],
  ['pl', '🏋 Пауэрлифтинг', 'powerlifting'],
  ['hybrid', '⚡ Powerbuilder', 'powerbuilding'],
];

const LEVELS = [
  ['beginner', 'Новичок'],
  ['intermediate', 'Средний'],
  ['advanced', 'Опытный'],
  ['enhanced', 'Enhanced'],
] as const;

interface Props {
  open: boolean;
  embedded?: boolean;
  step: WizardStep;
  direction: WizardDirection;
  goal: string;
  level: string;
  days: number;
  weeks: number;
  pro: boolean;
  onClose: () => void;
  onStep: (step: WizardStep) => void;
  onDirection: (direction: WizardDirection, defaultGoal: string) => void;
  onGoal: (goal: string) => void;
  onLevel: (level: string) => void;
  onDays: (days: number) => void;
  onWeeks: (weeks: number) => void;
  onCreate: (autoFill: boolean) => void;
}

export const ManualProgramWizard: React.FC<Props> = ({
  open, embedded = false, step, direction, goal, level, days, weeks, pro,
  onClose, onStep, onDirection, onGoal, onLevel, onDays, onWeeks, onCreate,
}) => {
  if (!open) return null;
  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {step === 1 && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, color: DIM, fontWeight: 700 }}>1. Направление</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {DIRECTIONS.map(([id, label, defaultGoal]) => <button key={id} onClick={() => onDirection(id, defaultGoal)} style={{ ...BTN, flex: 1, minHeight: 44, background: direction === id ? 'linear-gradient(135deg,#a78bfa,#7c3aed)' : '#7c3aed20', color: direction === id ? '#fff' : '#a78bfa' }}>{label}</button>)}
        </div>
      </div>}
      {step === 2 && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, color: DIM, fontWeight: 700 }}>2. Цель</div>
        <select style={IN} value={goal} onChange={e => onGoal(e.target.value)} disabled={direction === 'pl'}>
          <option value="hypertrophy">💪 Мышечная масса</option><option value="cut">✂️ Сушка</option><option value="recomp">🔁 Рекомпозиция</option><option value="maintenance">⚖ Поддержание</option><option value="strength_mass">🎯 Сила + Масса</option><option value="athletic">🏅 Атлетизм</option>
        </select>
      </div>}
      {step === 3 && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, color: DIM, fontWeight: 700 }}>3. Уровень и частота</div>
        <select style={IN} value={level} onChange={e => onLevel(e.target.value)}>{LEVELS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <div style={{ display: 'flex', gap: 6 }}>
          <label style={{ ...SMALL, flex: 1, display: 'flex', flexDirection: 'column' }}>Дней/нед<input type="number" style={IN} min={2} max={6} value={days} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) onDays(Math.max(2, Math.min(6, Math.round(v)))); }} aria-label="Дней в неделю" inputMode="numeric" /></label>
          <label style={{ ...SMALL, flex: 1, display: 'flex', flexDirection: 'column' }}>Недель<input type="number" style={IN} min={4} max={24} value={weeks} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) onWeeks(Math.max(4, Math.min(24, Math.round(v)))); }} aria-label="Недель в программе" inputMode="numeric" /></label>
        </div>
      </div>}
      {step === 4 && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, color: DIM, fontWeight: 700 }}>4. Превью</div>
        <div className="constructor-surface constructor-surface--tinted" style={{ ...CARD, padding: 10, background: 'rgba(167,139,250,0.06)' }}><div style={{ fontSize: 12, color: '#fff' }}>📋 <b>{direction === 'bb' ? 'Бодибилдинг' : direction === 'pl' ? 'Пауэрлифтинг' : 'Powerbuilder'}</b></div><div style={{ fontSize: 11, color: DIM }}>Цель: {goal} | Уровень: {level}</div><div style={{ fontSize: 11, color: DIM }}>{days} дн/нед × {weeks} нед</div><div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>Программа будет пустой — добавьте упражнения после создания.</div></div>
      </div>}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {step > 1 && <button style={{ ...BTN_GHOST, flex: 1, minHeight: 44 }} onClick={() => onStep(Math.max(1, step - 1) as WizardStep)}>← Назад</button>}
        {step < 4 && <button style={{ ...BTN, flex: 1, minHeight: 44 }} onClick={() => onStep(Math.min(4, step + 1) as WizardStep)}>Далее →</button>}
        {step === 4 && <button style={{ ...BTN, flex: 1, minHeight: 44 }} onClick={() => onCreate(false)}>✨ Создать программу</button>}
        {step === 4 && pro && <button style={{ ...BTN, flex: 1, minHeight: 44, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000' }} onClick={() => onCreate(true)}>⚡ Создать и заполнить</button>}
      </div>
    </div>
  );
  return embedded ? <div className="constructor-surface constructor-surface--info" style={{ ...CARD, padding: 10, borderLeft: '3px solid #a78bfa' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa' }}>🪄 Визард создания программы — шаг {step} из 4</span><button style={{ ...BTN_GHOST, minHeight: 44 }} onClick={onClose}>Отмена</button></div>{content}</div> : <TrainingModal title={`🪄 Визард — шаг ${step} из 4`} onClose={onClose}>{content}</TrainingModal>;
};

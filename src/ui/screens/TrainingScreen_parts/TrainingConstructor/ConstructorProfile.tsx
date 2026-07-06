import React from 'react';
import { PopupSelect, PopupNumber } from '../../SRCBBScreen_parts/TrainingPopups';
import { TrainingProfileCard } from '../TrainingProfileCard';
import type { TrainingProfile } from '../training-profile';
import { GOALS, LEVELS, ACCENT, DIM } from './types';

interface Props {
  tprofile: TrainingProfile;
  updateTProfile: (p: Partial<TrainingProfile>) => void;
  goal: string; setGoal: (v: string) => void;
  level: string; setLevel: (v: string) => void;
  daysPerWeek: number; setDaysPerWeek: (v: number) => void;
  mesoLength: number; setMesoLength: (v: number) => void;
  recovery: number; setRecovery: (v: number) => void;
  fatigue: number; setFatigue: (v: number) => void;
  weakPoints: string[];
  setWeakPoints: (v: string[]) => void;
  bodyWeight: number; setBodyWeight: (v: number) => void;
  sleepHours: number; setSleepHours: (v: number) => void;
  stressLevel: number; setStressLevel: (v: number) => void;
}

const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
const GROUP_LABELS: Record<string, string> = {
  chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор',
};

export const ConstructorProfile: React.FC<Props> = ({
  tprofile, updateTProfile,
  goal, setGoal, level, setLevel,
  daysPerWeek, setDaysPerWeek,
  mesoLength, setMesoLength,
  recovery, setRecovery,
  fatigue, setFatigue,
  weakPoints, setWeakPoints,
  bodyWeight, setBodyWeight,
  sleepHours, setSleepHours,
  stressLevel, setStressLevel,
}) => {
  return (
    <>
      <TrainingProfileCard profile={tprofile} update={updateTProfile} />

      <div style={{
        background: 'rgba(24,24,27,0.6)',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.04)',
        padding: 12,
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 8 }}>⚙️ Базовые параметры</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <PopupSelect label="Цель" value={goal} onChange={setGoal}
            options={GOALS.map(g => ({ id: g.value, label: g.label }))} />
          <PopupSelect label="Уровень" value={level} onChange={setLevel}
            options={LEVELS.map(l => ({ id: l.value, label: l.label }))} />
          <PopupNumber label="Дней в неделю" value={daysPerWeek} min={2} max={6}
            onChange={v => setDaysPerWeek(v)} />
          <PopupSelect label="Длина мезоцикла" value={String(mesoLength)}
            onChange={v => setMesoLength(+v)}
            options={[
              { id: '4', label: '4 недели' },
              { id: '8', label: '8 недель' },
              { id: '12', label: '12 недель' },
              { id: '16', label: '16 недель' },
              { id: '20', label: '20 недель' },
              { id: '24', label: '24 недели' },
            ]} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 10 }}>
          <div>
            <label style={{ fontSize: 10, color: DIM }}>Восстановление</label>
            <input type="range" min={1} max={10} value={recovery}
              onChange={e => setRecovery(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', accentColor: ACCENT }} />
            <div style={{ textAlign: 'center', fontSize: 10,
              color: recovery < 4 ? '#ef4444' : recovery < 6 ? '#ff9100' : '#22c55e' }}>
              {recovery}/10
            </div>
          </div>
          <div>
            <label style={{ fontSize: 10, color: DIM }}>Усталость</label>
            <input type="range" min={1} max={10} value={fatigue}
              onChange={e => setFatigue(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', accentColor: ACCENT }} />
            <div style={{ textAlign: 'center', fontSize: 10, color: DIM }}>{fatigue}/10</div>
          </div>
          <div>
            <label style={{ fontSize: 10, color: DIM }}>Сон (ч)</label>
            <input type="number" min={0} max={12} value={sleepHours || ''}
              onChange={e => setSleepHours(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: '5px 6px', borderRadius: 6,
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
            <div style={{ fontSize: 8, textAlign: 'center', marginTop: 1,
              color: sleepHours < 6 ? '#ef4444' : sleepHours <= 7 ? '#ff9100' : '#22c55e' }}>
              {sleepHours < 6 ? '<6: мало' : sleepHours <= 9 ? '7-9: оптимум' : '>9: избыток'}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 10, color: DIM, marginBottom: 2, display: 'block' }}>Слабые зоны (акцент)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {MUSCLE_GROUPS.map(g => {
              const active = weakPoints.includes(g);
              return (
                <button key={g} onClick={() =>
                  setWeakPoints(active ? weakPoints.filter(w => w !== g) : [...weakPoints, g])
                } style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                  border: active ? '1px solid #ff9100' : '1px solid var(--border)',
                  background: active ? 'rgba(255,145,0,0.15)' : 'var(--bg-secondary)',
                  color: active ? '#ff9100' : 'var(--text-dim)',
                  fontWeight: active ? 600 : 400,
                }}>{GROUP_LABELS[g]}</button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

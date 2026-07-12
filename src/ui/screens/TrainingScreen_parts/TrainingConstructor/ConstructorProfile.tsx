import React from 'react';
import { PopupSelect } from '../../SRCBBScreen_parts/TrainingPopups';
import { TrainingProfileCard } from '../TrainingProfileCard';
import { InjurySelectCard } from '../InjurySelectCard';
import type { TrainingProfile } from '../training-profile';
import { ACCENT, DIM } from './types';

interface Props {
  tprofile: TrainingProfile;
  updateTProfile: (p: Partial<TrainingProfile>) => void;
  mesoLength: number; setMesoLength: (v: number) => void;
  // Остальные поля приходят из родителя для бэкворд-совместимости, но не рендерятся —
  // цель/уровень/дни/восстановление/усталость/сон/стресс/слабые группы уже в TrainingProfileCard
  // (единый источник), чтобы не дублировать отстающие группы и базовые параметры.
  goal?: string; setGoal?: (v: string) => void;
  level?: string; setLevel?: (v: string) => void;
  daysPerWeek?: number; setDaysPerWeek?: (v: number) => void;
  recovery?: number; setRecovery?: (v: number) => void;
  fatigue?: number; setFatigue?: (v: number) => void;
  weakPoints?: string[]; setWeakPoints?: (v: string[]) => void;
  bodyWeight?: number; setBodyWeight?: (v: number) => void;
  sleepHours?: number; setSleepHours?: (v: number) => void;
  stressLevel?: number; setStressLevel?: (v: number) => void;
}

export const ConstructorProfile: React.FC<Props> = ({
  tprofile, updateTProfile, mesoLength, setMesoLength,
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
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 8 }}>⚙️ Параметры мезоцикла</div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>
          Длина мезоцикла — единственный параметр, которого нет в профиле. Цель, уровень, дни, восстановление, усталость, слабые группы и оборудование задаются в карточке профиля выше (единый источник).
        </div>

        {/* Карточка травм — добавляем перед длиной мезоцикла */}
        <div style={{ marginBottom: 8 }}>
          <InjurySelectCard
            injuries={tprofile.injuries || []}
            onChange={inj => updateTProfile({ injuries: inj })}
          />
        </div>

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

      {/* ─── PED-выбор для BB-движка ─── */}
      <div style={{
        background: 'rgba(24,24,27,0.6)',
        borderRadius: 12,
        border: '1px solid rgba(168,85,247,0.08)',
        padding: 12,
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>💉 PED для BB-движка</div>
        <div style={{ fontSize: 9, color: DIM, marginBottom: 8 }}>
          Определяет, какие PED влияют на адаптацию MRV в BB-плане. Базовый курс (ААС) задаётся в профиле выше.
        </div>
        <PedToggle tprofile={tprofile} updateTProfile={updateTProfile} />
      </div>
    </>
  );
};

const PED_OPTIONS: { id: string; label: string; color: string }[] = [
  { id: 'AAS', label: '💪 ААС', color: '#ef4444' },
  { id: 'GH', label: '🌱 ГР', color: '#22c55e' },
  { id: 'INSULIN', label: '💉 Инсулин', color: '#3b82f6' },
  { id: 'IGF', label: '🔬 IGF-1', color: '#a855f7' },
  { id: 'CLEN', label: '🔥 Клен', color: '#f59e0b' },
  { id: 'T3', label: '🦋 Т3', color: '#06b6d4' },
];

const PedToggle: React.FC<{ tprofile: TrainingProfile; updateTProfile: (p: Partial<TrainingProfile>) => void }> = ({ tprofile, updateTProfile }) => {
  const currentPeds = (tprofile as any).bbPeds as string[] | undefined;
  const toggle = (ped: string) => {
    const current = currentPeds || (tprofile.onCourse ? ['AAS'] : []);
    const next = current.includes(ped) ? current.filter(p => p !== ped) : [...current, ped];
    updateTProfile({ bbPeds: next } as any);
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {PED_OPTIONS.map(p => {
        const active = (currentPeds || (tprofile.onCourse ? ['AAS'] : [])).includes(p.id);
        return (
          <button key={p.id} onClick={() => toggle(p.id)} style={{
            padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 700,
            border: '1px solid ' + (active ? p.color : 'rgba(255,255,255,0.08)'),
            background: active ? p.color + '20' : 'rgba(255,255,255,0.03)',
            color: active ? p.color : 'rgba(255,255,255,0.5)',
            transition: 'all 0.15s',
          }}>
            {p.label}
          </button>
        );
      })}
    </div>
  );
};

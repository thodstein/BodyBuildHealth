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
    </>
  );
};

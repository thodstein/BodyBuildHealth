/**
 * CardioUserCard.tsx — «графа пользователя» в шапке мастера: возраст, пол,
 * вес, ЧСС покоя + кнопки «📋 Из профиля» / «💾 В профиль» (как в ПЛ/ББ-авто).
 */
import React from 'react';
import type { CardioLevel } from '../../../engines/lms/cardio.engine';
import { CARDIO_LEVEL_LABELS } from '../../../engines/lms/cardio.engine';

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
};
const BTN: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
  color: '#fff', minHeight: 32, whiteSpace: 'nowrap',
};
const BTN_ACCENT: React.CSSProperties = { ...BTN, background: 'rgba(0,230,138,0.14)', border: '1px solid rgba(0,230,138,0.4)', color: '#00e68a' };

export const CardioUserCard: React.FC<{
  age: string;
  sex: 'male' | 'female';
  weight: number;
  restingHr: string;
  level: CardioLevel;
  onFromProfile: () => void;
  onSaveProfile: () => void;
  onFromDiaryHr: () => void;
}> = ({ age, sex, weight, restingHr, level, onFromProfile, onSaveProfile, onFromDiaryHr }) => {
  const items: { label: string; value: string }[] = [
    { label: 'Возраст', value: age || '—' },
    { label: 'Пол', value: sex === 'female' ? '♀' : '♂' },
    { label: 'Вес', value: `${weight} кг` },
    { label: 'ЧСС покоя', value: restingHr || '—' },
    { label: 'Уровень', value: CARDIO_LEVEL_LABELS[level] },
  ];
  return (
    <div style={CARD}>
      <span style={{ fontSize: 13, fontWeight: 800 }}>👤</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 }}>
        {items.map(it => (
          <div key={it.label} style={{ display: 'flex', flexDirection: 'column', minWidth: 56 }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{it.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{it.value}</span>
          </div>
        ))}
      </div>
      <button style={BTN} onClick={onFromProfile} title="Загрузить возраст/вес/пол/ЧСС покоя из профиля">📋 Из профиля</button>
      <button style={BTN} onClick={onFromDiaryHr} title="ЧСС покоя из последней записи дневника АД">❤️ Из дневника АД</button>
      <button style={BTN_ACCENT} onClick={onSaveProfile} title="Сохранить возраст/вес/пол/ЧСС покоя в профиль">💾 В профиль</button>
    </div>
  );
};

/**
 * TrainingProfileCard.tsx — единая карточка «Профиль тренированности».
 * Реальные входные данные, общие для ПЛ/ББ/ручного конструктора/калькуляторов.
 */
import React from 'react';
import { PopupNumber, PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import { EQUIPMENT_OPTIONS, WEAK_GROUP_OPTIONS, type TrainingProfile } from './training-profile';

const ACCENT = '#00e68a';
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 10, margin: '6px 0 4px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.3 };

export const TrainingProfileCard: React.FC<{ profile: TrainingProfile; update: (patch: Partial<TrainingProfile>) => void; compact?: boolean }> = ({ profile, update, compact }) => {
  const toggleArr = (key: 'weakPoints' | 'equipment', id: string) => {
    const arr = profile[key];
    update({ [key]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] } as Partial<TrainingProfile>);
  };
  const wm = profile.workMax;
  const setWm = (k: string, v: number) => update({ workMax: { [k]: v } });
  return (
    <div style={{ background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(0,230,138,0.2)', padding: 12, margin: '0 0 10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>🧬 Профиль тренированности</div>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>единый источник данных</span>
      </div>

      <div style={LABEL}>Цель и уровень</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <PopupSelect label="Цель" value={profile.goal} onChange={v => update({ goal: v })} options={[['bulk','Масса'],['cut','Сушка'],['strength','Сила'],['maintenance','Поддержание'],['recomp','Рекомпозиция'],['rehab','Реабилитация']].map(([id,l]) => ({ id, label: l }))} />
        <PopupSelect label="Уровень" value={profile.level} onChange={v => update({ level: v })} options={[['beginner','Новичок'],['intermediate','Средний'],['advanced','Продвинутый'],['enhanced','Enhanced']].map(([id,l]) => ({ id, label: l }))} />
      </div>

      <div style={LABEL}>Антропометрия и восстановление</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
        <PopupNumber label="Вес тела" value={profile.bodyWeight} min={40} max={200} suffix=" кг" onChange={v => update({ bodyWeight: v })} />
        <PopupNumber label="Дней/нед" value={profile.daysPerWeek} min={2} max={7} onChange={v => update({ daysPerWeek: v })} />
        <PopupNumber label="Сон" value={profile.sleepHours} min={3} max={12} suffix=" ч" onChange={v => update({ sleepHours: v })} />
        <PopupNumber label="Стресс" value={profile.stressLevel} min={1} max={10} onChange={v => update({ stressLevel: v })} />
        <PopupNumber label="Восст." value={profile.recovery} min={1} max={10} onChange={v => update({ recovery: v })} />
        <PopupNumber label="Усталость" value={profile.fatigue} min={1} max={10} onChange={v => update({ fatigue: v })} />
      </div>

      <div style={LABEL}>Предельные максимумы (ПМ), кг</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <PopupNumber label="Присед" value={profile.pmSquat} min={20} max={500} suffix=" кг" onChange={v => update({ pmSquat: v })} />
        <PopupNumber label="Жим лёжа" value={profile.pmBench} min={20} max={400} suffix=" кг" onChange={v => update({ pmBench: v })} />
        <PopupNumber label="Становая" value={profile.pmDead} min={20} max={500} suffix=" кг" onChange={v => update({ pmDead: v })} />
      </div>

      <div style={LABEL}>Рабочие максимумы по группам (кг)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {Object.keys(wm).filter(k => ['chest','back','legs','shoulders','arms','core'].includes(k)).map(k => {
          const RU: Record<string,string> = { chest:'Грудь', back:'Спина', legs:'Ноги', shoulders:'Плечи', arms:'Руки', core:'Кор' };
          return <PopupNumber key={k} label={RU[k] || k} value={wm[k] || 80} min={10} max={400} suffix=" кг" onChange={v => setWm(k, v)} />;
        })}
      </div>

      <div style={LABEL}>Слабые группы (акцент)</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {WEAK_GROUP_OPTIONS.map(o => {
          const on = profile.weakPoints.includes(o.id);
          return <button key={o.id} onClick={() => toggleArr('weakPoints', o.id)} style={{ padding: '5px 10px', borderRadius: 14, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: on ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.08)', background: on ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)', color: on ? '#00e68a' : 'rgba(255,255,255,0.6)' }}>{o.label}{on ? ' ✓' : ''}</button>;
        })}
      </div>

      <div style={LABEL}>Доступное оборудование</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {EQUIPMENT_OPTIONS.map(o => {
          const on = profile.equipment.includes(o.id);
          return <button key={o.id} onClick={() => toggleArr('equipment', o.id)} style={{ padding: '5px 10px', borderRadius: 14, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: on ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.08)', background: on ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)', color: on ? '#00e68a' : 'rgba(255,255,255,0.6)' }}>{o.label}{on ? ' ✓' : ''}</button>;
        })}
      </div>
      {compact !== true && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Эти данные используются ПЛ, ББ, ручным конструктором и калькуляторами для расчётов.</div>}
    </div>
  );
};

export default TrainingProfileCard;
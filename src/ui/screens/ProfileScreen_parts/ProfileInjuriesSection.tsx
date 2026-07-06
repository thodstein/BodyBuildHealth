import React from 'react';
import type { UserProfile, InjuryRecord } from '../../../core/types';
import { INJURY_LOCATIONS } from '../../../core/constants';
import { theme, glassCardStyle, sectionLabelStyle, HealthBool } from './ProfileComponents';

interface Props {
  settings: UserProfile['settings'];
  save: (partial: Partial<UserProfile['settings']>) => void;
}

const INJURY_TYPES: { id: InjuryRecord['type']; label: string }[] = [
  { id: 'joint', label: 'Сустав' }, { id: 'muscle', label: 'Мышца' }, { id: 'bone', label: 'Кость' },
  { id: 'ligament', label: 'Связка' }, { id: 'tendon', label: 'Сухожилие' }, { id: 'nerve', label: 'Нерв' }
];
const MOVEMENT_LIMITS: { id: InjuryRecord['movementLimit']; label: string }[] = [
  { id: 'none', label: 'Нет' }, { id: 'mild', label: 'Лёгкое' },
  { id: 'moderate', label: 'Умеренное' }, { id: 'severe', label: 'Сильное' },
  { id: 'full_restriction', label: 'Полное' }
];

const pillBtn = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px', borderRadius: 16, fontSize: 10, fontWeight: 600, cursor: 'pointer',
  border: active ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
  background: active ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.04)',
  color: active ? '#00e68a' : 'rgba(255,255,255,0.6)',
  transition: 'all 0.15s',
});

export const ProfileInjuriesSection: React.FC<Props> = ({ settings, save }) => {
  const [editInjury, setEditInjury] = React.useState<InjuryRecord | null>(null);

  const addInjury = () => {
    setEditInjury({ id: crypto.randomUUID(), type: 'muscle', location: '', painLevel: 3, movementLimit: 'none', side: 'left', chronic: false, date: new Date().toISOString().slice(0, 10) });
  };

  const saveInjury = (inj: InjuryRecord) => {
    const existing = settings.injuries ?? [];
    const idx = existing.findIndex(i => i.id === inj.id);
    const updated = idx >= 0 ? existing.map(i => i.id === inj.id ? inj : i) : [...existing, inj];
    save({ injuries: updated });
    setEditInjury(null);
  };

  const deleteInjury = (id: string) => {
    save({ injuries: (settings.injuries ?? []).filter(i => i.id !== id) });
  };

  return (
    <div>
      <div style={glassCardStyle}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ ...sectionLabelStyle, color: '#ef4444' }}>Травмы</div>
          <button style={pillBtn(true)} onClick={addInjury}>+ Добавить</button>
        </div>
      </div>
      {(settings.injuries ?? []).length === 0 && (
        <div style={{ ...glassCardStyle, textAlign:'center', padding: 30, color: theme.textDim, fontSize: 11 }}>
          Нет записей. Нажмите «+ Добавить» чтобы добавить травму.
        </div>
      )}
      {(settings.injuries ?? []).map(inj => (
        <div key={inj.id} style={glassCardStyle}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <strong style={{ fontSize:12, color: theme.textPrimary }}>{inj.location || 'Не указана'} — {INJURY_TYPES.find(t => t.id === inj.type)?.label ?? inj.type}</strong>
            <div style={{ display:'flex', gap:4 }}>
              <button style={pillBtn(false)} onClick={() => setEditInjury(inj)}>Ред.</button>
              <button style={{ padding:'4px 8px', borderRadius:6, border:'1px solid rgba(239,68,68,0.3)', background:'transparent', color:'#ef4444', fontSize:10, cursor:'pointer' }} onClick={() => deleteInjury(inj.id)}>Удалить</button>
            </div>
          </div>
          <div style={{ fontSize:11, color: theme.textSecondary }}>
            Боль: {inj.painLevel}/10 | Ограничение: {MOVEMENT_LIMITS.find(m => m.id === inj.movementLimit)?.label} | Сторона: {inj.side === 'left' ? 'Левая' : inj.side === 'right' ? 'Правая' : 'Обе'} | {inj.chronic ? 'Хроническая' : 'Острая'}
          </div>
          {inj.notes && <div style={{ fontSize:10, color: theme.textDim, marginTop:4 }}>{inj.notes}</div>}
        </div>
      ))}
      {editInjury && (
        <div style={{ ...glassCardStyle, border: theme.accentBorder }}>
          <div style={sectionLabelStyle}>{editInjury.id && (settings.injuries ?? []).find(i => i.id === editInjury.id) ? 'Редактирование' : 'Новая травма'}</div>
          <div style={{ marginTop:8 }}>
            <span style={sectionLabelStyle}>Тип</span>
            <div style={{ display:'flex', gap:4, marginTop:2 }}>{INJURY_TYPES.map(t => <button key={t.id} style={pillBtn(editInjury.type === t.id)} onClick={() => setEditInjury({ ...editInjury, type: t.id })}>{t.label}</button>)}</div>
          </div>
          <div style={{ marginTop:8 }}>
            <span style={sectionLabelStyle}>Локализация</span>
            <select style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:14, outline:'none' }} value={editInjury.location} onChange={e => setEditInjury({ ...editInjury, location: e.target.value })}>
              <option value="">Выберите...</option>
              {INJURY_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div style={{ marginTop:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}><span style={sectionLabelStyle}>Боль</span><span style={{ fontSize:13, fontWeight:700, color:'#ef4444' }}>{editInjury.painLevel}/10</span></div>
            <input style={{ width:'100%', accentColor:'#00e68a', height:6, borderRadius:3, outline:'none' }} type="range" min="1" max="10" value={editInjury.painLevel} onChange={e => setEditInjury({ ...editInjury, painLevel: parseFloat(e.target.value) || 0 })} />
          </div>
          <div style={{ marginTop:8 }}>
            <span style={sectionLabelStyle}>Ограничение движений</span>
            <div style={{ display:'flex', gap:4, marginTop:2 }}>{MOVEMENT_LIMITS.map(m => <button key={m.id} style={pillBtn(editInjury.movementLimit === m.id)} onClick={() => setEditInjury({ ...editInjury, movementLimit: m.id })}>{m.label}</button>)}</div>
          </div>
          <div style={{ marginTop:8 }}>
            <span style={sectionLabelStyle}>Сторона</span>
            <div style={{ display:'flex', gap:4, marginTop:2 }}>
              {[{ id:'left', label:'Левая' }, { id:'right', label:'Правая' }, { id:'both', label:'Обе' }].map(x => <button key={x.id} style={pillBtn(editInjury.side === x.id)} onClick={() => setEditInjury({ ...editInjury, side: x.id as any })}>{x.label}</button>)}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:8 }}>
            <div><span style={sectionLabelStyle}>Дата</span><input type="date" style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:14, outline:'none' }} value={editInjury.date ?? ''} onChange={e => setEditInjury({ ...editInjury, date: e.target.value })} /></div>
            <div>
              <span style={sectionLabelStyle}>Хроническая</span>
              <div style={{ display:'flex', gap:4, marginTop:2 }}>
                <button style={pillBtn(editInjury.chronic)} onClick={() => setEditInjury({ ...editInjury, chronic: true })}>Да</button>
                <button style={pillBtn(!editInjury.chronic)} onClick={() => setEditInjury({ ...editInjury, chronic: false })}>Нет</button>
              </div>
            </div>
          </div>
          <div style={{ marginTop:8 }}>
            <span style={sectionLabelStyle}>Заметки</span>
            <textarea style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:12, minHeight:50, outline:'none', resize:'vertical' }} value={editInjury.notes ?? ''} onChange={e => setEditInjury({ ...editInjury, notes: e.target.value })} />
          </div>
          <button onClick={() => saveInjury(editInjury)} style={{ width:'100%', padding:'10px', borderRadius:12, marginTop:10, cursor:'pointer', background: theme.gradientGreen, border:'none', color:'#000', fontWeight:700, fontSize:13 }}>
            {editInjury.id && (settings.injuries ?? []).find(i => i.id === editInjury.id) ? 'Сохранить' : 'Добавить'}
          </button>
          <button onClick={() => setEditInjury(null)} style={{ ...pillBtn(false), width:'100%', marginTop:6, textAlign:'center' as const }}>Отмена</button>
        </div>
      )}
    </div>
  );
};

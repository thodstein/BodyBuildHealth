// ════════════════════════════════════════════════════════════════════
//  CalcProfileCard — профиль с попапами для ввода данных
// ════════════════════════════════════════════════════════════════════
import React, { useState, useCallback } from 'react';
import { GLASS } from './Calc.types';
import { getProfile, updateSection } from '../../../core/profile-manager';

interface Props {
  state: any;
  onStateChange: (next: any) => void;
}

const FIELD_DEFS: Array<{ key: string; label: string; icon: string; popupType: 'number' | 'select'; options?: string[]; sublabel?: string }> = [
  { key: 'age', label: 'Возраст', icon: '👤', popupType: 'number', sublabel: 'лет' },
  { key: 'weight', label: 'Вес', icon: '⚖️', popupType: 'number', sublabel: 'кг' },
  { key: 'height', label: 'Рост', icon: '📏', popupType: 'number', sublabel: 'см' },
  { key: 'sex', label: 'Пол', icon: '🐥', popupType: 'select', options: ['М', 'Ж'] },
  { key: 'sleepHours', label: 'Сон', icon: '😴', popupType: 'number', sublabel: 'ч/ночь' },
  { key: 'stressLevel', label: 'Стресс', icon: '🧘', popupType: 'select', options: ['1','2','3','4','5','6','7','8','9','10'] },
];

export const CalcProfileCard: React.FC<Props> = ({ state, onStateChange }) => {
  const [open, setOpen] = useState(false);
  const [popup, setPopup] = useState<string | null>(null);
  const [tempVal, setTempVal] = useState('');
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  const profile = state.profile || {};

  const setField = (key: string, val: any) => {
    onStateChange({ ...state, profile: { ...profile, [key]: val } });
  };

  // Загрузка из Профиля (UnifiedSettings) в локальный state калькулятора.
  const autofillFromProfile = useCallback(() => {
    try {
      const stored = getProfile();
      const settings = (stored.settings || {}) as any;
      const next = { ...profile };
      // Читаем из вложенной структуры UnifiedSettings
      if (settings.personal?.age) next.age = Number(settings.personal.age);
      if (settings.personal?.weight) next.weight = Number(settings.personal.weight);
      if (settings.personal?.height) next.height = Number(settings.personal.height);
      if (settings.personal?.sex) next.sex = settings.personal.sex === 'female' ? 'Ж' : 'М';
      if (settings.lifestyle?.sleepHours) next.sleepHours = Number(settings.lifestyle.sleepHours);
      if (settings.lifestyle?.stressLevel) next.stressLevel = Number(settings.lifestyle.stressLevel);
      onStateChange({ ...state, profile: next });
    } catch (e) {
      console.error('[autofillFromProfile]', e);
    }
  }, [state, profile, onStateChange]);

  // Сохранение локальных значений калькулятора обратно в Профиль (UnifiedSettings).
  const saveToProfile = useCallback(() => {
    try {
      const p = profile;
      // personal
      if (p.age || p.weight || p.height || p.sex) {
        updateSection('personal', {
          ...(p.age ? { age: Number(p.age) } : {}),
          ...(p.weight ? { weight: Number(p.weight) } : {}),
          ...(p.height ? { height: Number(p.height) } : {}),
          ...(p.sex ? { sex: p.sex === 'Ж' ? 'female' : 'male' } : {}),
        });
      }
      // lifestyle
      if (p.sleepHours || p.stressLevel) {
        updateSection('lifestyle', {
          ...(p.sleepHours ? { sleepHours: Number(p.sleepHours) } : {}),
          ...(p.stressLevel ? { stressLevel: Number(p.stressLevel) } : {}),
        });
      }
      setLastSaved(Date.now());
      if (typeof (window as any).showToast === 'function') {
        (window as any).showToast('✓ Сохранено в профиль', 'success');
      } else {
        alert('✓ Сохранено в профиль');
      }
    } catch (e) {
      console.error('[saveToProfile]', e);
      alert('Ошибка сохранения: ' + (e as Error).message);
    }
  }, [profile]);

  const renderPopup = (def: typeof FIELD_DEFS[0]) => {
    const val = profile[def.key] ?? '';
    return (
      <div key={def.key} style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)' }} onClick={() => setPopup(null)}>
        <div onClick={e => e.stopPropagation()} style={{ width: '80%', maxWidth: 280, borderRadius: 14, background: '#1a1a1d', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <div style={{ height: 2, background: 'linear-gradient(90deg,#00e68a,#00c853)' }} />
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#00e68a', marginBottom: 8 }}>{def.icon} {def.label}</div>
            {def.popupType === 'number' && (
              <input type="number" autoFocus value={tempVal !== '' ? tempVal : val} onChange={e => setTempVal(e.target.value)} placeholder={`в ${def.sublabel || ''}`}
                style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 11, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', boxSizing: 'border-box', outline: 'none' }} />
            )}
            {def.popupType === 'select' && def.options && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                {def.options.map(opt => (
                  <button key={opt} onClick={() => { setField(def.key, opt); setPopup(null); }} style={{
                    padding: '8px 4px', borderRadius: 8, fontSize: 9, fontWeight: 600, cursor: 'pointer',
                    border: String(val) === opt ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    background: String(val) === opt ? 'rgba(0,230,138,0.1)' : 'transparent',
                    color: String(val) === opt ? '#00e68a' : 'var(--text-dim)'
                  }}>{opt}</button>
                ))}
              </div>
            )}
            {def.popupType === 'number' && (
              <button onClick={() => { setField(def.key, Number(tempVal) || Number(val)); setPopup(null); setTempVal(''); }} style={{ width: '100%', marginTop: 8, padding: '8px', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer', background: '#00e68a', border: 'none', color: '#000' }}>OK</button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ ...GLASS, padding: 10, marginBottom: 8 }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>👤 Профиль</span>
        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
          {profile.age || '?'}л · {profile.weight || '?'}кг · {profile.sex || '?'} {open ? '▲' : '▼'}
        </span>
      </div>

      {open && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 6 }}>
            {FIELD_DEFS.map(def => {
              const val = profile[def.key] ?? '';
              return (
                <button key={def.key} onClick={() => { setPopup(def.key); setTempVal(''); }}
                  style={{ padding: '6px 4px', borderRadius: 8, fontSize: 8, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <span style={{ fontSize: 11 }}>{def.icon}</span>
                  <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{def.label}</span>
                  <span style={{ fontSize: 9, color: 'var(--text)', fontWeight: 700 }}>{val === '' ? '—' : val}{def.sublabel ? ` ${def.sublabel}` : ''}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={autofillFromProfile} aria-label="Загрузить значения из Профиля" style={{ flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 36 }}>
              <span aria-hidden="true" style={{fontSize: 14}}>🔄</span>
              <span>Автозаполнение</span>
            </button>
            <button onClick={saveToProfile} aria-label="Сохранить в Профиль" title="Сохранить в Профиль" style={{ flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 36 }}>
              <span aria-hidden="true" style={{fontSize: 14}}>💾</span>
              <span>Сохранить в профиль</span>
            </button>
          </div>
          {lastSaved && (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, textAlign: 'center' }}>
              ✓ Сохранено: {new Date(lastSaved).toLocaleTimeString('ru')}
            </div>
          )}
          {popup && renderPopup(FIELD_DEFS.find(f => f.key === popup)!)}
        </div>
      )}
    </div>
  );
};
import React, { useMemo } from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import { useExerciseSubstitution } from '../../hooks/useExerciseSubstitution';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };
const GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
const GROUP_RU: Record<string, string> = { chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор' };

const CalcSubstituteTabBase: React.FC = () => {
  const { exId, setExId, group, setGroup, ex, subs, forbidden } = useExerciseSubstitution();
  const exList = useMemo(() => EXERCISE_CATALOG.filter(e => e.group === group), [group]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>🔄 Калькулятор замены упражнения</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>Выберите упражнение — покажу допустимые замены (с причиной) и запретные замены из базы биомеханики.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <PopupSelect label="Группа мышц" value={group} options={GROUPS.map(g => ({ id: g, label: GROUP_RU[g] }))} onChange={v => { setGroup(v); setExId(''); }} />
        <PopupSelect label="Упражнение" value={exId} options={exList.map(e => ({ id: e.id, label: e.name, desc: `${e.type === 'compound' ? 'Базовое' : 'Изолированное'} · ${e.equipment}` }))} hint="Выберите упражнение" onChange={v => setExId(v)} />
      </div>

      {!ex ? (
        <div style={{ ...SMALL, textAlign: 'center', padding: 20 }}>Выберите упражнение выше, чтобы увидеть варианты замены.</div>
      ) : (
        <>
          <div style={{ padding: 10, borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{ex.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>Группа: {GROUP_RU[ex.group] || ex.group} · {ex.type === 'compound' ? 'Базовое' : 'Изолированное'} · {ex.equipment} · цель: {ex.targetMuscle || '—'}</div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>✅ Допустимые замены ({subs.length})</div>
          {subs.length === 0 ? (
            <div style={{ ...SMALL, marginBottom: 10 }}>Нет допустимых замен в базе. Используйте упражнения той же группы с похожей биомеханикой.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {subs.map(o => (
                <div key={o.id} style={{ padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{o.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{o.reason}</div>
                </div>
              ))}
            </div>
          )}

          {forbidden.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>🚫 Запретные замены ({forbidden.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {forbidden.map(f => {
                  const fex = EXERCISE_CATALOG.find(e => e.id === f.id);
                  return (
                    <div key={f.id} style={{ padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5' }}>{fex?.name || f.id}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{f.reason}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export const CalcSubstituteTab = React.memo(CalcSubstituteTabBase);
export default CalcSubstituteTab;
import React from 'react';
import type { UserProfile, UnifiedSettings } from '../../../core/types';
import { theme, glassCardStyle, sectionLabelStyle, HealthBool, NumberPc, SliderPc, PopupCard, TextPc } from './ProfileComponents';

interface Props {
  settings: UserProfile['settings'];
  save: (partial: any) => void;
  calcData: any;
  upCalc: (k: string, v: any) => void;
  toggleWeakPoint: (id: string) => void;
}

const MUSCLE_GROUPS_FULL: { id: string; label: string }[] = [
  { id: 'chest', label: 'Грудь' }, { id: 'back', label: 'Спина' }, { id: 'shoulders', label: 'Плечи' },
  { id: 'biceps', label: 'Бицепс' }, { id: 'triceps', label: 'Трицепс' }, { id: 'quads', label: 'Квадрицепс' },
  { id: 'hamstrings', label: 'Бицепс бедра' }, { id: 'glutes', label: 'Ягодицы' }, { id: 'calves', label: 'Икры' },
  { id: 'abs', label: 'Пресс' }, { id: 'traps', label: 'Трапеция' }, { id: 'forearms', label: 'Предплечья' },
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

export const ProfileLifestyleSection: React.FC<Props> = ({ settings, save, calcData, upCalc, toggleWeakPoint }) => {
  const s = settings as any as UnifiedSettings;
  const tr = s.training || {} as any;
  const nu = s.nutrition || {} as any;
  const ls = s.lifestyle || {} as any;
  const ph = s.pharma || {} as any;
  const cd = calcData || {};
  const wp = tr.weakPoints ?? [];

  const renderSuppList = (items: any[], field: string, placeholder: string, addEmpty: () => any, accent: string, btnColor: string) => (
    <div>
      {(items ?? []).map((item: any, i: number) => (
        <div key={item.id || i} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ flex:1, fontSize:10, color:'rgba(255,255,255,0.7)' }}>{item.name || '?'} — {item.doseMg} {item.doseUnit}{item.frequency ? ` (${item.frequency})` : ''}</span>
          <button onClick={() => save({ [field]: ((nu as any)[field] ?? []).filter((_: any, j: number) => j !== i) })}
            style={{ padding:'2px 8px', borderRadius:6, border:`1px solid rgba(239,68,68,0.3)`, background:'transparent', color:'#ef4444', fontSize:9, cursor:'pointer' }}>✕</button>
        </div>
      ))}
      <button onClick={() => save({ [field]: [...((nu as any)[field] ?? []), addEmpty()] })}
        style={{ marginTop:4, padding:'6px 12px', borderRadius:8, border:`1px solid ${accent}`, background:`${accent}1a`, color:btnColor, cursor:'pointer', fontSize:10, fontWeight:600 }}>
        + Добавить
      </button>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      <SliderPc icon="😰" label="Стресс" value={ls.stressLevel ?? 3} min={1} max={10} onChange={v => save({ stressLevel: v })} color="#f87171" />
      <SliderPc icon="😴" label="Усталость" value={ls.fatigueLevel ?? 3} min={1} max={10} onChange={v => save({ fatigueLevel: v })} color="#f87171" />
      <SliderPc icon="🚶" label="Шаги/день" value={ls.dailySteps ?? 6000} min={0} max={30000} step={500} onChange={v => save({ dailySteps: v })} color="#34d399" />
      <SliderPc icon="💧" label="Вода/день (л)" value={ls.dailyWaterLiters ?? 2} min={0} max={6} step={0.1} onChange={v => save({ dailyWaterLiters: v })} color="#34d399" />
      <NumberPc icon="📅" label="Тренировок/нед" value={tr.daysPerWeek || ''} onChange={v => save({ workoutsPerWeek: parseFloat(v) || 0 })} suffix="дн" />
      <NumberPc icon="⏱" label="Мин/тренировку" value={tr.minutesPerSession || ''} onChange={v => save({ avgWorkoutMinutes: parseFloat(v) || 0 })} suffix="мин" />
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
      <PopupCard icon="💪" label="Отстающие группы" value={wp.length ? wp.map((id: string) => MUSCLE_GROUPS_FULL.find(m => m.id === id)?.label || id).join(', ') : 'Не указаны'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {MUSCLE_GROUPS_FULL.map(m => (
            <HealthBool key={m.id} label={m.label} active={wp.includes(m.id)}
              onClick={() => toggleWeakPoint(m.id)} />
          ))}
        </div>
      </PopupCard>
      <PopupCard icon="💊" label={`БАДы (${(nu.currentSupplements??[]).length})`} value={(nu.currentSupplements??[]).slice(0,2).map((s:any)=>s.name).join(', ') || 'Нет'}>
        {renderSuppList(nu.currentSupplements, 'currentSupplements', 'БАД', () => ({ id: crypto.randomUUID(), name: '', doseMg: 0, doseUnit: 'mg' }), 'rgba(56,189,248,0.3)', '#7dd3fc')}
      </PopupCard>
      <PopupCard icon="💊" label={`Аптека (${(nu.currentMedications??[]).length})`} value={(nu.currentMedications??[]).slice(0,2).map((s:any)=>s.name).join(', ') || 'Нет'}>
        {renderSuppList(nu.currentMedications, 'currentMedications', 'Препарат', () => ({ id: crypto.randomUUID(), name: '', doseMg: 0, doseUnit: 'mg', frequency: 'daily' }), 'rgba(167,139,250,0.3)', '#c4b5fd')}
      </PopupCard>
      {[
        { g: 'neuro', f: 'dopamineScore', l: 'Дофамин', ic: '🧠' },
        { g: 'neuro', f: 'serotoninScore', l: 'Серотонин', ic: '😊' },
        { g: 'neuro', f: 'aggressionScore', l: 'Агрессия', ic: '😡' },
        { g: 'psych', f: 'fearOfLoss', l: 'Страх потери', ic: '😨' },
        { g: 'psych', f: 'mirrorObsession', l: 'Зеркало', ic: '🪞' },
        { g: 'psych', f: 'apathyOffCycle', l: 'Апатия вне курса', ic: '😑' },
      ].map(f => {
        const val = cd[f.g]?.[f.f] || 1;
        return (
          <PopupCard key={f.g+'.'+f.f} icon={f.ic} label={f.l} value={`${val}/5`}>
            <div style={{ textAlign:'center', marginBottom:12 }}>
              <span style={{ fontSize:36, fontWeight:800, color:val<=2?'#00e68a':val<=3?'#f59e0b':'#ef4444' }}>{val}</span>
              <span style={{ fontSize:16, color:'rgba(255,255,255,0.3)', marginLeft:4 }}>/ 5</span>
            </div>
            <div style={{ display:'flex', gap:4 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => upCalc(f.g, { ...cd[f.g], [f.f]: n })}
                  style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:700,
                    background: val === n ? theme.accent : 'rgba(255,255,255,0.06)',
                    color: val === n ? '#000' : 'rgba(255,255,255,0.4)',
                  }}>{n}</button>
              ))}
            </div>
          </PopupCard>
        );
      })}
    </div>
  );
};

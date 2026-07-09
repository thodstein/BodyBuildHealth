import React from 'react';
import type { UserProfile, UnifiedSettings } from '../../../core/types';
import { getWeightLog, saveWeightLog } from '../../../engines/profile-store';
import { theme, HealthBool, NumberPc, TextPc, PopupCard } from './ProfileComponents';

interface Props {
  settings: UserProfile['settings'];
  save: (partial: any) => void;
  calcData?: any;
  upCalc?: (k: string, v: any) => void;
  onNavigate?: (screen: string) => void;
}

const GOALS = [
  { id: 'bulk', label: 'Масса' }, { id: 'cut', label: 'Сушка' },
  { id: 'maintenance', label: 'Поддержка' }, { id: 'strength', label: 'Сила' },
  { id: 'hypertrophy', label: 'Гипертрофия' }, { id: 'rehab', label: 'Реабилитация' },
  { id: 'recomposition', label: 'Рекомп' }, { id: 'health', label: 'Здоровье' }
];
const SPORT_TYPES: { id: string; label: string }[] = [
  { id: 'bodybuilding', label: 'Бодибилдинг' }, { id: 'powerlifting', label: 'Пауэрлифтинг' },
  { id: 'crossfit', label: 'Кроссфит' }, { id: 'fitness', label: 'Фитнес' }, { id: 'other', label: 'Другое' },
];
const BLOOD_TYPES: { id: string; label: string }[] = [
  { id: 'I+', label: 'I (Rh+)' }, { id: 'I-', label: 'I (Rh−)' },
  { id: 'II+', label: 'II (Rh+)' }, { id: 'II-', label: 'II (Rh−)' },
  { id: 'III+', label: 'III (Rh+)' }, { id: 'III-', label: 'III (Rh−)' },
  { id: 'IV+', label: 'IV (Rh+)' }, { id: 'IV-', label: 'IV (Rh−)' },
];
const TRAINING_LEVELS: { id: string; label: string }[] = [
  { id: 'beginner', label: 'Новичок' }, { id: 'intermediate', label: 'Средний' },
  { id: 'advanced', label: 'Продвинутый' }, { id: 'enhanced', label: 'Enhanced' }
];
const COURSE_PHASES: { id: string; label: string }[] = [
  { id: 'baseline', label: 'База' }, { id: 'course', label: 'Курс' },
  { id: 'bridge', label: 'Бридж' }, { id: 'pct', label: 'ПКТ' },
  { id: 'post_pct', label: 'После ПКТ' }, { id: 'fertility', label: 'Фертильность' },
];
const TRAINING_CYCLE_TYPES = [
  { id: 'mass', label: 'Масса' }, { id: 'cut', label: 'Сушка' },
  { id: 'maintenance', label: 'Поддержка' }, { id: 'endurance', label: 'Выносливость' },
];
const TIME_SINCE_LAST_CYCLE = [
  { id: 'none', label: 'Нет' }, { id: '1-3mo', label: '1-3 мес' },
  { id: '3-6mo', label: '3-6 мес' }, { id: '6-12mo', label: '6-12 мес' },
  { id: '1y+', label: '>1 года' },
];

export const ProfileBioSection: React.FC<Props> = ({ settings, save, calcData, upCalc, onNavigate }) => {
  const s = settings as any as UnifiedSettings;
  const p = s.personal || {} as any;
  const tr = s.training || {} as any;
  const ph = s.pharma || {} as any;
  const hl = s.health || {} as any;
  const cGoals = (calcData || {}).goals || {};
  const [weightLog, setWeightLog] = React.useState(getWeightLog);

  const bmi = p.height && p.weight ? (p.weight / Math.pow(p.height / 100, 2)).toFixed(1) : null;
  const bmiCategory = bmi ? (parseFloat(bmi) < 18.5 ? 'Дефицит' : parseFloat(bmi) < 25 ? 'Норма' : parseFloat(bmi) < 30 ? 'Избыток' : 'Ожирение') : '';
  const lbm = p.weight && p.bodyFat ? (p.weight * (1 - p.bodyFat / 100)).toFixed(1) : null;
  const ffmi = lbm && p.height ? (parseFloat(lbm) / Math.pow(p.height / 100, 2) + 6.1 * (1.8 - p.height / 100)).toFixed(1) : null;
  const ffmiCategory = ffmi ? (parseFloat(ffmi) < 18 ? 'Ниже среднего' : parseFloat(ffmi) < 20 ? 'Средний' : parseFloat(ffmi) < 22 ? 'Хорошо' : parseFloat(ffmi) < 25 ? 'Отлично' : parseFloat(ffmi) < 28 ? 'Исключительно' : 'Подозрение') : '';

  const handleWeightRecord = (w: number) => {
    if (!w) return;
    const newEntry = { date: new Date().toISOString().split('T')[0], weight: w };
    const updated = [...weightLog.filter(e => e.date !== newEntry.date), newEntry].sort((a, b) => a.date.localeCompare(b.date));
    setWeightLog(updated); saveWeightLog(updated); save({ weight: w });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      <NumberPc icon="🎂" label="Возраст" value={p.age || ''} onChange={v => save({ age: parseInt(v) || 0 })} suffix="лет" placeholder="30" />
      <PopupCard icon="⚤" label="Пол" value={p.sex === 'male' ? 'Мужской' : p.sex === 'female' ? 'Женский' : '—'}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['male','female'].map(sx => (
            <button key={sx} onClick={() => { save({ sex: sx }); }}
              style={{ flex:1, padding:'10px 0', borderRadius:10, border:`1px solid ${(p.sex || 'male')===sx ? theme.accent : 'rgba(255,255,255,0.1)'}`, cursor:'pointer', background:(p.sex||'male')===sx ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.03)', color:(p.sex||'male')===sx ? theme.accent : 'rgba(255,255,255,0.6)', fontSize:13, fontWeight:600 }}>
              {sx === 'male' ? '♂ Мужской' : '♀ Женский'}
            </button>
          ))}
        </div>
      </PopupCard>
      <NumberPc icon="📏" label="Рост" value={p.height || ''} onChange={v => save({ height: parseInt(v) || 0 })} suffix="см" placeholder="175" />
      <NumberPc icon="⚖️" label="Вес" value={p.weight || ''} onChange={v => save({ weight: parseFloat(v) || 0 })} suffix="кг" placeholder="80" />
      <NumberPc icon="🔬" label="% жира" value={p.bodyFat || ''} onChange={v => save({ bodyFat: v ? parseFloat(v) || 0 : undefined })} suffix="%" placeholder="15" />
      <PopupCard icon="📊" label="Композиция тела" value={bmi ? `BMI ${bmi} · ${bmiCategory}` : 'Нет данных'}>
        <div style={{ textAlign:'center', marginBottom:12 }}>
          {bmi && <div><span style={{ fontSize:28, fontWeight:800, color:parseFloat(bmi)<18.5?'#f97316':parseFloat(bmi)<25?'#00e68a':parseFloat(bmi)<30?'#f59e0b':'#ef4444' }}>{bmi}</span><span style={{ fontSize:14, color:'rgba(255,255,255,0.3)' }}> BMI</span></div>}
          {bmiCategory && <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>{bmiCategory}</div>}
          {lbm && <div style={{ marginTop:8 }}><span style={{ fontSize:20, fontWeight:700, color:'#3b82f6' }}>{lbm}</span><span style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}> кг LBM</span></div>}
          {ffmi && <div style={{ marginTop:4 }}><span style={{ fontSize:16, fontWeight:600, color:parseFloat(ffmi)<18?'#f97316':parseFloat(ffmi)<22?'#f59e0b':'#00e68a' }}>{ffmi}</span><span style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}> FFMI</span></div>}
          {ffmiCategory && <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:2 }}>{ffmiCategory}</div>}
        </div>
      </PopupCard>
      <PopupCard icon="🎯" label="Цель тренировок" value={GOALS.find(g => g.id === (tr.primaryGoal))?.label || '—'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {GOALS.map(g => (
            <HealthBool key={g.id} label={g.label} active={(tr.primaryGoal || '') === g.id}
              onClick={() => save({ primaryGoal: g.id, goal: g.id })} />
          ))}
        </div>
      </PopupCard>
      <PopupCard icon="🏋️" label="Вид спорта" value={SPORT_TYPES.find(s => s.id === tr.sportType)?.label || '—'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {SPORT_TYPES.map(st => (
            <HealthBool key={st.id} label={st.label} active={(tr.sportType || 'bodybuilding') === st.id}
              onClick={() => save({ sportType: st.id })} />
          ))}
        </div>
      </PopupCard>
      <NumberPc icon="⏳" label="Стаж" value={tr.experience || ''} onChange={v => save({ trainingExperience: parseInt(v) || 0 })} suffix="лет" placeholder="0" />
      <PopupCard icon="📊" label="Уровень" value={TRAINING_LEVELS.find(t => t.id === tr.level)?.label || '—'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {TRAINING_LEVELS.map(l => (
            <HealthBool key={l.id} label={l.label} active={(tr.level || 'intermediate') === l.id}
              onClick={() => save({ trainingLevel: l.id })} />
          ))}
        </div>
      </PopupCard>
      <PopupCard icon="🩸" label="Группа крови" value={BLOOD_TYPES.find(b => b.id === p.bloodType)?.label || '—'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {BLOOD_TYPES.map(bt => (
            <HealthBool key={bt.id} label={bt.label} active={p.bloodType === bt.id}
              onClick={() => save({ bloodType: bt.id })} />
          ))}
        </div>
      </PopupCard>
      <PopupCard icon="💉" label="Фаза курса" value={COURSE_PHASES.find(p => p.id === (ph.phase || 'baseline'))?.label || '—'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {COURSE_PHASES.map(p => (
            <HealthBool key={p.id} label={p.label} active={(ph.phase || 'baseline') === p.id}
              onClick={() => save({ phase: p.id })} />
          ))}
        </div>
      </PopupCard>
      <TextPc icon="📅" label="Дата старта курса" value={ph.courseStartDate || (ph.phase && ph.phase !== 'baseline' ? new Date().toISOString().split('T')[0] : '') || ''}
        onChange={v => save({ courseStartDate: v })} placeholder="ГГГГ-ММ-ДД" />
      <PopupCard icon="🔄" label="Тип цикла" value={TRAINING_CYCLE_TYPES.find(t => t.id === (cGoals?.trainingCycle || 'mass'))?.label || '—'}>
        <div style={{ display: 'flex', gap: 4 }}>
          {TRAINING_CYCLE_TYPES.map(t => (
            <button key={t.id} onClick={() => upCalc?.('goals', { ...cGoals, trainingCycle: t.id })}
              style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:11, fontWeight:600,
                background: (cGoals?.trainingCycle || 'mass') === t.id ? '#fb923c' : 'rgba(255,255,255,0.06)',
                color: (cGoals?.trainingCycle || 'mass') === t.id ? '#000' : 'rgba(255,255,255,0.5)',
              }}>{t.label}</button>
          ))}
        </div>
      </PopupCard>
      <NumberPc icon="📅" label="Длина цикла" value={cGoals?.cycleWeeks || 12} onChange={v => upCalc?.('goals', { ...cGoals, cycleWeeks: parseInt(v) || 12 })} suffix="нед" />
      <NumberPc icon="🔄" label="Прошлых курсов" value={cGoals?.previousCycles || 0} onChange={v => upCalc?.('goals', { ...cGoals, previousCycles: parseInt(v) || 0 })} />
      <PopupCard icon="⏰" label="С последнего цикла" value={TIME_SINCE_LAST_CYCLE.find(t => t.id === (cGoals?.timeSinceLastCycle || 'none'))?.label || '—'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {TIME_SINCE_LAST_CYCLE.map(t => (
            <HealthBool key={t.id} label={t.label} active={(cGoals?.timeSinceLastCycle || 'none') === t.id}
              onClick={() => upCalc?.('goals', { ...cGoals, timeSinceLastCycle: t.id })} />
          ))}
        </div>
      </PopupCard>
      <TextPc icon="💊" label="Аллергии / заметки" value={hl.drugAllergies || ''} onChange={v => save({ allergyNotes: v })} placeholder="Нет аллергий" multiline />
      <PopupCard icon="⚖️" label="Запись веса" value={`${p.weight || '—'} кг · ${weightLog.length} зап.`}>
        <div>
          <NumberPc icon="⚖️" label="Новый вес" value={p.weight || ''} onChange={v => handleWeightRecord(parseFloat(v) || 0)} suffix="кг" placeholder="0" />
          {weightLog.length > 0 && (
            <div style={{ marginTop:8, padding:'8px', borderRadius:8, background:'rgba(255,255,255,0.03)', textAlign:'center' }}>
              <div style={{ fontSize:11, color:theme.textDim }}>{weightLog.length} записей · тренд: {(weightLog[weightLog.length-1].weight - weightLog[0].weight).toFixed(1)} кг</div>
              <div style={{ display:'flex', gap:1, height:50, alignItems:'flex-end', marginTop:6 }}>
                {weightLog.slice(-14).map((e,i,a) => {
                  const minW=Math.min(...weightLog.map(w=>w.weight)); const maxW=Math.max(...weightLog.map(w=>w.weight));
                  const h=Math.max(3,((e.weight-minW)/(maxW-minW||1))*100);
                  return <div key={i} style={{ flex:1, height:`${h}%`, background:i===a.length-1?theme.gradientGreen:'rgba(0,230,138,0.3)', borderRadius:'2px 2px 0 0', minHeight:2 }} title={`${e.date}: ${e.weight} кг`} />;
                })}
              </div>
            </div>
          )}
        </div>
      </PopupCard>
      <PopupCard icon="⚠️" label="Риски (ТЗ)" value="Перейти к расчёту рисков по 28 механизмам">
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:10 }}>Расчёт рисков по 28 механизмам ТЗ — сердечно-сосудистые, печень, почки, ЦНС, репродуктивная, гематология</div>
          <button onClick={() => onNavigate?.('risks')}
            style={{ padding:'10px 24px', borderRadius:10, border:'none', cursor:'pointer', fontSize:13, fontWeight:700,
              background:'linear-gradient(135deg,rgba(248,113,113,0.2),rgba(239,68,68,0.1))', color:'#fca5a5' }}>
            Перейти к рискам
          </button>
        </div>
      </PopupCard>
    </div>
  );
};

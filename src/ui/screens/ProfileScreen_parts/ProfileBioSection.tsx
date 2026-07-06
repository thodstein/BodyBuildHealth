import React from 'react';
import type { UserProfile } from '../../../core/types';
import { getWeightLog, saveWeightLog } from '../../../engines/profile-store';
import { theme, glassCardStyle, sectionLabelStyle, ExpandableCard, HealthNumber, HealthBool } from './ProfileComponents';

interface Props {
  settings: UserProfile['settings'];
  save: (partial: Partial<UserProfile['settings']>) => void;
  calcData?: any;
  upCalc?: (k: string, v: any) => void;
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

export const ProfileBioSection: React.FC<Props> = ({ settings, save, calcData, upCalc }) => {
  const cGoals = (calcData || {}).goals || {};
  const [openBasic, setOpenBasic] = React.useState(false);
  const [openExtended, setOpenExtended] = React.useState(false);
  const [openCourse, setOpenCourse] = React.useState(false);
  const [weightLog, setWeightLog] = React.useState(getWeightLog);

  const bmi = settings.height && settings.weight
    ? (settings.weight / Math.pow(settings.height / 100, 2)).toFixed(1) : null;
  const bmiCategory = bmi
    ? (parseFloat(bmi) < 18.5 ? 'Дефицит' : parseFloat(bmi) < 25 ? 'Норма' : parseFloat(bmi) < 30 ? 'Избыток' : 'Ожирение') : '';
  const lbm = settings.weight && settings.bodyFat
    ? (settings.weight * (1 - settings.bodyFat / 100)).toFixed(1) : null;
  const ffmi = lbm && settings.height
    ? (parseFloat(lbm) / Math.pow(settings.height / 100, 2) + 6.1 * (1.8 - settings.height / 100)).toFixed(1) : null;
  const ffmiCategory = ffmi
    ? (parseFloat(ffmi) < 18 ? 'Ниже среднего' : parseFloat(ffmi) < 20 ? 'Средний' : parseFloat(ffmi) < 22 ? 'Хорошо' : parseFloat(ffmi) < 25 ? 'Отлично' : parseFloat(ffmi) < 28 ? 'Исключительно' : 'Подозрение') : '';

  const goalLabel = GOALS.find(g => g.id === (settings.primaryGoal || settings.goal))?.label || '—';
  const sportLabel = SPORT_TYPES.find(s => s.id === settings.sportType)?.label || '—';
  const trainLevelLabel = TRAINING_LEVELS.find(t => t.id === settings.trainingLevel)?.label || '—';

  const handleWeightRecord = () => {
    const inp = document.getElementById('bio-weight-input') as HTMLInputElement;
    if (!inp?.value) return;
    const w = parseFloat(inp.value);
    if (!w) return;
    const newEntry = { date: new Date().toISOString().split('T')[0], weight: w };
    const updated = [...weightLog.filter(e => e.date !== newEntry.date), newEntry]
      .sort((a, b) => a.date.localeCompare(b.date));
    setWeightLog(updated);
    saveWeightLog(updated);
    save({ weight: w });
    inp.value = '';
  };

  return (
    <div>
      <div style={{
        ...glassCardStyle,
        background: 'linear-gradient(135deg, rgba(0,230,138,0.08), rgba(0,180,100,0.04))',
        border: theme.accentBorder,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'Вес', val: settings.weight ? `${settings.weight} кг` : '—' },
            { label: 'Рост', val: settings.height ? `${settings.height} см` : '—' },
            { label: 'BMI', val: bmi || '—', sub: bmiCategory, color: bmi ? (parseFloat(bmi) < 18.5 ? '#f97316' : parseFloat(bmi) < 25 ? '#00e68a' : parseFloat(bmi) < 30 ? '#f59e0b' : '#ef4444') : undefined },
            { label: 'FFMI', val: ffmi || '—', sub: ffmiCategory, color: ffmi ? (parseFloat(ffmi) < 18 ? '#f97316' : parseFloat(ffmi) < 22 ? '#f59e0b' : '#00e68a') : undefined },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 4px' }}>
              <div style={{ fontSize: 10, color: theme.textDim, marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: s.color || theme.textPrimary }}>{s.val}</div>
              {s.sub && <div style={{ fontSize: 9, color: s.color || theme.textSecondary, marginTop: 1 }}>{s.sub}</div>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: theme.textSecondary }}>
          <span>{goalLabel} · {sportLabel}</span>
          <span>Ур: {trainLevelLabel}</span>
        </div>
      </div>

      <div style={glassCardStyle}>
        <div style={sectionLabelStyle}>Вес и тренд</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input type="number" step="0.1" placeholder="Новый вес, кг" id="bio-weight-input"
            style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 12 }} />
          <button onClick={handleWeightRecord}
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: theme.accent, color: '#000', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
            Записать
          </button>
        </div>
        {weightLog.length > 0 && (
          <div style={{ fontSize: 9, color: theme.textDim, textAlign: 'center' }}>
            {weightLog.length} записей
            {weightLog.length >= 2 && ` · тренд: ${(weightLog[weightLog.length - 1].weight - weightLog[0].weight).toFixed(1)} кг`}
          </div>
        )}
      </div>

      <ExpandableCard icon="👤" title="Основная информация" color="#60a5fa" open={openBasic} onToggle={() => setOpenBasic(!openBasic)}
        summary={`${settings.age || '—'} лет · ${settings.sex === 'male' ? 'Муж' : settings.sex === 'female' ? 'Жен' : '—'}`}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <HealthNumber label="Возраст" value={settings.age || ''} onChange={v => save({ age: parseInt(v) || 0 })} placeholder="30" />
          <div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Пол</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <HealthBool label="Муж" active={settings.sex === 'male'} onClick={() => save({ sex: 'male' })} />
              <HealthBool label="Жен" active={settings.sex === 'female'} onClick={() => save({ sex: 'female' })} />
            </div>
          </div>
        </div>
      </ExpandableCard>

      <ExpandableCard icon="📋" title="Расширенная информация" color="#34d399" open={openExtended} onToggle={() => setOpenExtended(!openExtended)}
        summary={`${sportLabel} · Стаж ${settings.trainingExperience || '—'} лет${settings.bloodType ? ' · ' + (BLOOD_TYPES.find(b => b.id === settings.bloodType)?.label || '') : ''}`}>
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Вид спорта</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {SPORT_TYPES.map(st => (
              <HealthBool key={st.id} label={st.label} active={(settings.sportType || 'bodybuilding') === st.id} onClick={() => save({ sportType: st.id })} />
            ))}
          </div>
        </div>
        <HealthNumber label="Стаж (лет)" value={settings.trainingExperience || ''} onChange={v => save({ trainingExperience: parseInt(v) || 0 })} />
        <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Группа крови</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {BLOOD_TYPES.map(bt => (
                <HealthBool key={bt.id} label={bt.label} active={settings.bloodType === bt.id} onClick={() => save({ bloodType: bt.id })} />
              ))}
            </div>
          </div>
          <HealthNumber label="Аллергии (заметки)" value={settings.allergyNotes || ''} onChange={v => save({ allergyNotes: v })} />
        </div>
      </ExpandableCard>

      <ExpandableCard icon="💉" title="Фаза курса" color="#f87171" open={openCourse} onToggle={() => setOpenCourse(!openCourse)}
        summary={`${COURSE_PHASES.find(p => p.id === (settings.phase || 'baseline'))?.label || '—'}${settings.courseStartDate ? ' · с ' + settings.courseStartDate : ''}`}>
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Фаза</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {COURSE_PHASES.map(p => (
              <HealthBool key={p.id} label={p.label} active={(settings.phase || 'baseline') === p.id} onClick={() => save({ phase: p.id })} />
            ))}
          </div>
        </div>
        {settings.courseStartDate ? (
          <HealthNumber label="Дата начала курса" value={settings.courseStartDate} onChange={v => save({ courseStartDate: v })} />
        ) : settings.phase && settings.phase !== 'baseline' ? (
          <button onClick={() => save({ courseStartDate: new Date().toISOString().split('T')[0] })}
            style={{ marginTop: 4, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)', color: '#fca5a5', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
            📅 Указать дату начала
          </button>
        ) : null}
      </ExpandableCard>

      <ExpandableCard icon="🎯" title="Цели / Цикл" color="#fb923c" open={false}
        summary={`${TRAINING_CYCLE_TYPES.find(t => t.id === (cGoals?.trainingCycle || 'mass'))?.label || '—'} · ${cGoals?.cycleWeeks || '—'} нед · Прошлых: ${cGoals?.previousCycles || 0}`}>
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Тип цикла</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {TRAINING_CYCLE_TYPES.map(t => (
              <button key={t.id} onClick={() => upCalc?.('goals', { ...cGoals, trainingCycle: t.id })}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600,
                  background: (cGoals?.trainingCycle || 'mass') === t.id ? '#fb923c' : 'rgba(255,255,255,0.06)',
                  color: (cGoals?.trainingCycle || 'mass') === t.id ? '#000' : 'rgba(255,255,255,0.5)',
                }}>{t.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <HealthNumber label="Длительность цикла (нед)" value={cGoals?.cycleWeeks || 12} onChange={v => upCalc?.('goals', { ...cGoals, cycleWeeks: parseInt(v) || 12 })} />
          <HealthNumber label="Прошлых курсов" value={cGoals?.previousCycles || 0} onChange={v => upCalc?.('goals', { ...cGoals, previousCycles: parseInt(v) || 0 })} />
        </div>
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Время с последнего цикла</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {TIME_SINCE_LAST_CYCLE.map(t => (
              <HealthBool key={t.id} label={t.label} active={(cGoals?.timeSinceLastCycle || 'none') === t.id}
                onClick={() => upCalc?.('goals', { ...cGoals, timeSinceLastCycle: t.id })} />
            ))}
          </div>
        </div>
      </ExpandableCard>
    </div>
  );
};

/** ExerciseSafetyPanel.tsx — оценка безопасности упражнения (быстрая, для одного движения).
 * Полный ортопедический анализ сустава — в отдельной вкладке «Суставы и ортопедия» (JointMasterCard + JSI).
 * Дизайн: попап-карточки как в Tonnage/Load, полностью на русском, без English ID.
 */
import React, { useMemo, useState } from 'react';
import { classifyMovement, getMuscleSynergy, getJointStress, assessSafety } from '../../../engines/movement-engines';
import { quickSafetyCheck } from '../../../engines/biomechanics-risk-engine';
import { PopupSelect, PopupNumber, MetricCard } from './TrainingPopups';

const ACCENT = '#00e68a';
const DIM = '#fff';

const EXERCISE_OPTIONS: { id: string; label: string; desc: string }[] = [
  { id: 'back_squat', label: 'Присед со штангой', desc: 'squat · axial · высокая сложность' },
  { id: 'front_squat', label: 'Фронтальный присед', desc: 'squat · axial · высокая' },
  { id: 'goblet_squat', label: 'Гоблет-присед', desc: 'squat · передняя нагрузка · низкая' },
  { id: 'leg_press', label: 'Жим ногами', desc: 'squat · axial · низкая' },
  { id: 'deadlift', label: 'Становая тяга', desc: 'hinge · axial · высокая' },
  { id: 'romanian_deadlift', label: 'Румынская тяга', desc: 'hinge · задняя цепь · средняя' },
  { id: 'hip_thrust', label: 'Ягодичный мост', desc: 'hinge · ягодицы · низкая' },
  { id: 'bench_press', label: 'Жим лёжа', desc: 'гориз. жим · средняя' },
  { id: 'dumbbell_bench', label: 'Жим гантелей лёжа', desc: 'гориз. жим · средняя' },
  { id: 'push_up', label: 'Отжимания', desc: 'гориз. жим · низкая' },
  { id: 'barbell_row', label: 'Тяга штанги в наклоне', desc: 'гориз. тяга · средняя' },
  { id: 'seated_row', label: 'Тяга блока сидя', desc: 'гориз. тяга · низкая' },
  { id: 'overhead_press', label: 'Жим стоя', desc: 'верт. жим · средняя' },
  { id: 'lateral_raise', label: 'Махи в стороны', desc: 'верт. жим · низкая' },
  { id: 'pull_up', label: 'Подтягивания', desc: 'верт. тяга · средняя' },
  { id: 'lat_pulldown', label: 'Тяга верхнего блока', desc: 'верт. тяга · низкая' },
  { id: 'walking_lunge', label: 'Выпады шагами', desc: 'выпад · средняя' },
  { id: 'bicep_curl', label: 'Сгибания на бицепс', desc: 'изоляция · низкая' },
  { id: 'tricep_extension', label: 'Разгибания на трицепс', desc: 'изоляция · низкая' },
  { id: 'face_pull', label: 'Тяга к лицу', desc: 'изоляция · низкая' },
];

const RU_JOINT: Record<string, string> = { knee: 'Колено', hip: 'Таз', spine: 'Позвоночник', shoulder: 'Плечо', elbow: 'Локоть', ankle: 'Голеностоп' };
const PATTERN_RU: Record<string, string> = {
  squat: 'Присед', hinge: 'Тяга/наклон', horizontal_push: 'Горизонтальный жим', horizontal_pull: 'Горизонтальная тяга',
  vertical_push: 'Вертикальный жим', vertical_pull: 'Вертикальная тяга', lunge: 'Выпад', accessory: 'Изоляция',
};
const PLANE_RU: Record<string, string> = { sagittal: 'Сагиттальная', frontal: 'Фронтальная', transverse: 'Поперечная', multi: 'Смешанная' };
const LOAD_RU: Record<string, string> = { axial: 'Осевая', horizontal: 'Горизонтальная', vertical: 'Вертикальная', rotational: 'Ротационная', anterior: 'Передняя', posterior: 'Задняя' };
const GROUND_RU: Record<string, string> = { bilateral: 'Двусторонняя', unilateral: 'Односторонняя', seated: 'Сидя', prone: 'Лёжа на животе', supine: 'Лёжа на спине', standing: 'Стоя' };
const LEVEL_RU: Record<string, string> = { low: 'низкая', medium: 'средняя', high: 'высокая', moderate: 'средняя', safe: 'безопасно', risky: 'опасно' };
const SAFETY_RU: Record<string, string> = { safe: 'Безопасно', moderate: 'Умеренный риск', risky: 'Высокий риск' };
const MUSCLE_RU: Record<string, string> = {
  quadriceps: 'квадрицепс', gluteus_maximus: 'ягодичная', hamstrings: 'бицепс бедра', adductors: 'приводящие',
  erector_spinae: 'разгибатели спины', rectus_abdominis: 'прямая живота', obliques: 'косые', soleus: 'камбаловидная',
  gastrocnemius: 'икроножная', trapezius: 'трапеция', latissimus: 'широчайшая', rhomboids: 'ромбовидные',
  pectoralis_major: 'большая грудная', pectoralis_minor: 'малая грудная', triceps_brachii: 'трицепс', anterior_deltoid: 'передняя дельта',
  deltoids: 'дельты', biceps_brachii: 'бицепс', brachialis: 'брахиалис', posterior_deltoid: 'задняя дельта',
  rotator_cuff: 'вращательная манжета', serratus_anterior: 'передняя зубчатая', latissimus_dorsi: 'широчайшая',
  mid_trapezius: 'средняя трапеция', rear_deltoids: 'задние дельты', forearm_flexors: 'сгибатели предплечья',
};
const levelColor = (level: string) => level === 'low' || level === 'safe' ? ACCENT : level === 'moderate' || level === 'medium' ? '#f59e0b' : '#ef4444';

function ruMuscle(name: string): string {
  return MUSCLE_RU[name] || name.replace(/_/g, ' ');
}

export const ExerciseSafetyPanel: React.FC = () => {
  const [exercise, setExercise] = useState('back_squat');
  const [technique, setTechnique] = useState(0.8);
  const [injuries, setInjuries] = useState('');

  const injuryList = useMemo(() => injuries.split(',').map(v => v.trim()).filter(Boolean), [injuries]);
  const classification = useMemo(() => classifyMovement(exercise), [exercise]);
  const synergy = useMemo(() => getMuscleSynergy(exercise), [exercise]);
  const stress = useMemo(() => getJointStress(exercise), [exercise]);
  const safety = useMemo(() => assessSafety(exercise, injuryList, technique), [exercise, injuryList, technique]);
  const quick = useMemo(() => {
    const snap = Object.fromEntries(Object.entries(stress).map(([joint, value]) => [joint, value.level]));
    const res = quickSafetyCheck(exercise, snap as any);
    // Переводим joint в русском reason если там англ
    let reason = res.reason;
    for (const [en, ru] of Object.entries(RU_JOINT)) {
      reason = reason.replace(new RegExp(`\\b${en}\\b`, 'gi'), ru.toLowerCase());
    }
    return { ...res, reason };
  }, [exercise, stress]);

  const exerciseLabel = EXERCISE_OPTIONS.find(o => o.id === exercise)?.label || exercise;

  return (
    <div className="pl-safety" style={{ maxWidth: 720, margin: '0 auto', color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT, margin: '4px 0 2px' }}>🛡 Быстрая оценка упражнения</div>
      <div style={{ fontSize: 10, color: DIM, lineHeight: 1.4, marginBottom: 10 }}>
        Проверка техники и противопоказаний для одного движения. Для глубокого анализа сустава (JSI, тепловая карта, 8 блоков, FMS) → вкладка <b style={{ color: '#f43f5e' }}>«Суставы и ортопедия»</b> (единый инструмент, без дублей).
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <PopupSelect label="Упражнение" value={exercise} options={EXERCISE_OPTIONS} hint="Выберите движение для оценки" onChange={setExercise} />
        </div>
        <PopupNumber label="Техника (0–1)" value={technique} min={0} max={1} step={0.05} hint="0.5 — новичок, 0.8 — уверенно, 1.0 — идеально" onChange={setTechnique} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>Травмы в анамнезе (через запятую)</div>
          <input
            value={injuries}
            onChange={e => setInjuries(e.target.value)}
            placeholder="напр. колено, поясница, плечо"
            aria-label="Травмы"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', borderRadius: 10, padding: '10px 12px', fontSize: 12, minHeight: 38, boxSizing: 'border-box', width: '100%' }}
          />
        </div>
      </div>

      <MetricCard title={`Движение — ${exerciseLabel}`} icon="📐" accent="#60a5fa">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
          <div>Паттерн: <b style={{ color: '#fff' }}>{PATTERN_RU[classification.pattern] || classification.pattern}</b></div>
          <div>Плоскость: <b style={{ color: '#fff' }}>{PLANE_RU[classification.plane] || classification.plane}</b></div>
          <div>Нагрузка: <b style={{ color: '#fff' }}>{LOAD_RU[classification.loadType] || classification.loadType}</b></div>
          <div>Опора: <b style={{ color: '#fff' }}>{GROUND_RU[classification.groundingPattern] || classification.groundingPattern}</b></div>
          <div style={{ gridColumn: '1 / -1' }}>Суставы: <b style={{ color: '#fff' }}>{classification.primaryJoints.map(j => RU_JOINT[j] || j).join(', ') || '—'}</b></div>
          <div style={{ gridColumn: '1 / -1', fontSize: 10, color: DIM }}>Сложность: <b style={{ color: classification.complexity === 'high' ? '#ef4444' : classification.complexity === 'medium' ? '#f59e0b' : ACCENT }}>{LEVEL_RU[classification.complexity] || classification.complexity}</b></div>
        </div>
      </MetricCard>

      <MetricCard title="Синергия мышц" icon="🧠" accent="#a78bfa">
        <div style={{ fontSize: 11, lineHeight: 1.5 }}>
          <div>Основные: <b style={{ color: '#fff' }}>{synergy.primary.map(ruMuscle).join(', ') || '—'}</b></div>
          <div>Вспомогательные: <span style={{ color: '#fff' }}>{synergy.secondary.map(ruMuscle).join(', ') || '—'}</span></div>
          <div>Стабилизаторы: <span style={{ color: '#fff' }}>{synergy.stabilizers.map(ruMuscle).join(', ') || '—'}</span></div>
          {synergy.antagonists.length > 0 && <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>Антагонисты: {synergy.antagonists.map(ruMuscle).join(', ')}</div>}
        </div>
      </MetricCard>

      <MetricCard title="Суставной стресс" icon="🦴" accent="#f59e0b">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {(['knee','hip','spine','shoulder','elbow','ankle'] as const).map(joint => (
            <div key={joint} style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: DIM }}>{RU_JOINT[joint]}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: levelColor(stress[joint].level) }}>{LEVEL_RU[stress[joint].level] || stress[joint].level}</div>
            </div>
          ))}
        </div>
      </MetricCard>

      <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: `${levelColor(safety.level)}0f`, border: `1px solid ${levelColor(safety.level)}33`, boxShadow: `0 0 0 1px ${levelColor(safety.level)}11` }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: levelColor(safety.level), textTransform: 'uppercase', letterSpacing: 0.3 }}>🛡 Безопасность: {safety.score}/100 · {SAFETY_RU[safety.level] || safety.level}</div>
        {safety.contraindications.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>Противопоказания:</div>
            {safety.contraindications.map(item => <div key={item} style={{ fontSize: 11, color: '#f87171', marginTop: 2 }}>• {item}</div>)}
          </div>
        )}
        {safety.precautions.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>Меры предосторожности:</div>
            {safety.precautions.map(item => <div key={item} style={{ fontSize: 11, color: '#fff', marginTop: 2 }}>• {item}</div>)}
          </div>
        )}
        {safety.requiresSpotter && <div style={{ marginTop: 6, fontSize: 10, color: '#f59e0b' }}>⚠ Требуется страховка</div>}
        <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 8, background: quick.safe ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${quick.safe ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)'}`, fontSize: 11, fontWeight: 700, color: quick.safe ? ACCENT : '#f87171' }}>
          {quick.safe ? (quick.reason ? `✅ ${quick.reason}` : '✅ Допустимо') : `🛑 ${quick.reason}`}
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: DIM, lineHeight: 1.4 }}>
          Это быстрая оценка одного упражнения. Полный анализ сустава (JSI теплокарта + 8 блоков: анатомия риска → нагрузка → геометрия → недельный план → прехаб → FMS → замены) — во вкладке <b style={{ color: '#f43f5e' }}>«Суставы и ортопедия»</b>.
        </div>
      </div>
    </div>
  );
};

export default ExerciseSafetyPanel;

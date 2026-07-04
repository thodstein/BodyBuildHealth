import React, { useMemo, useState } from 'react';
import { predictPercentage, predictTargetWeight, getRecommendedVelocity, VBTIntent } from '../../../engines/vbt-engine';
import { PopupNumber, PopupSelect } from './TrainingPopups';

const CARD: React.CSSProperties = { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: 12, margin: '6px 0' };
const ACCENT = '#00e68a';
const H: React.CSSProperties = { color: '#fff', fontSize: 14, fontWeight: 600, margin: '4px 0 6px' };
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.45 };
const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: 'rgba(255,255,255,0.8)' };

export const VBTCalculator: React.FC = () => {
  const [oneRM, setOneRM] = useState<number>(100);
  const [currentVelocity, setCurrentVelocity] = useState<number>(0.5);
  const [lift, setLift] = useState<string>('squat');
  const [intent, setIntent] = useState<VBTIntent>('hypertrophy');

  const predictedPct = useMemo(() => predictPercentage(currentVelocity, lift), [currentVelocity, lift]);
  const targetVelocity = useMemo(() => getRecommendedVelocity(intent).typical, [intent]);
  const targetWeight = useMemo(() => predictTargetWeight(oneRM, targetVelocity, lift), [oneRM, targetVelocity, lift]);
  const recRange = useMemo(() => getRecommendedVelocity(intent), [intent]);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <PopupNumber label="1ПМ (кг)" value={oneRM} min={0} max={1000} suffix=" кг" hint="Ваш текущий максимальный вес на 1 повторение." onChange={setOneRM} />
        <PopupNumber label="Текущая скорость" value={currentVelocity} min={0.05} max={2.0} step={0.01} suffix=" м/с" hint="Средняя концентрическая скорость последнего повторения." onChange={setCurrentVelocity} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <PopupSelect 
          label="Упражнение" 
          value={lift} 
          options={[
            { id: 'squat', label: 'Присед' },
            { id: 'bench', label: 'Жим' },
            { id: 'deadlift', label: 'Тяга' },
            { id: 'default', label: 'Другое' },
          ]} 
          onChange={setLift} 
        />
        <PopupSelect 
          label="Цель (Intent)" 
          value={intent} 
          options={[
            { id: 'strength', label: 'Сила' },
            { id: 'hypertrophy', label: 'Гипертрофия' },
            { id: 'power', label: 'Мощность' },
            { id: 'endurance', label: 'Выносливость' },
          ]} 
          onChange={v => setIntent(v as VBTIntent)} 
        />
      </div>

      <div style={CARD}>
        <div style={H}>🎯 Анализ текущей скорости</div>
        <div style={ROW}><span>Прогноз %1RM:</span><span style={{ color: ACCENT, fontWeight: 700 }}>{(predictedPct * 100).toFixed(1)}%</span></div>
        <div style={ROW}><span>Прогноз веса:</span><span style={{ color: ACCENT, fontWeight: 700 }}>{Math.round(oneRM * predictedPct)} кг</span></div>
        <div style={{ ...SMALL, marginTop: 6 }}>
          На данной скорости {predictedPct < 0.5 ? 'вы работаете в режиме гипертрофии/мощности' : 'вы работаете близко к отказу/максимуму'}.
        </div>
      </div>

      <div style={CARD}>
        <div style={H}>🚀 Целевой расчет (по цели)</div>
        <div style={ROW}><span>Целевая скорость:</span><span style={{ color: ACCENT, fontWeight: 700 }}>{targetVelocity} м/с</span></div>
        <div style={ROW}><span>Рекомендуемый вес:</span><span style={{ color: ACCENT, fontWeight: 700 }}>{targetWeight} кг</span></div>
        <div style={ROW}><span>Диапазон скорости:</span><span>{recRange.min} — {recRange.max} м/с</span></div>
        <div style={{ ...SMALL, marginTop: 6 }}>
          Для {intent === 'strength' ? 'развития силы' : intent === 'hypertrophy' ? 'максимального роста' : 'пиковой мощности'} стремитесь к указанному весу, чтобы поддерживать целевую скорость.
        </div>
      </div>
    </div>
  );
};

export default VBTCalculator;

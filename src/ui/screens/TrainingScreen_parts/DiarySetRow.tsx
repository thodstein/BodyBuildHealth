/**
 * DiarySetRow.tsx — shared set row component for diary entry forms.
 * Used by both QuickEntry (gym mode) and DiaryRecordingForm (detailed mode).
 */
import React, { useState, useEffect } from 'react';
import { epley1RM } from '../../../engines/e1rm';
import { MMCSetPanel } from './MMCSetPanel';

const ACCENT = '#00e68a';

export interface DiarySetData {
  weight: number;
  reps: number;
  rir: number;
  rpe: number;
  completed: boolean;
}

interface DiarySetRowProps {
  set: DiarySetData;
  setNumber: number;
  isCurrent: boolean;
  isBodyweight: boolean;
  prevData: { weight: number; reps: number; rir: number } | null;
  onComplete: (weight: number, reps: number, rpe: number, rir: number) => void;
  onSkip: () => void;
  /** When true, show compact inline grid (for DiaryRecordingForm). Default: false (full row for QuickEntry). */
  compact?: boolean;
  /** When provided, show MMC/Pump/Joints/Energy panel for the set (записывает в he_mmc_log напрямую). */
  exerciseId?: string;
  exerciseName?: string;
  /** Date of the workout (YYYY-MM-DD). Default: today. */
  date?: string;
}

export const DiarySetRow: React.FC<DiarySetRowProps> = ({
  set, setNumber, isCurrent, isBodyweight, prevData, onComplete, onSkip, compact,
  exerciseId, exerciseName, date,
}) => {
  const [weight, setWeight] = useState(set.weight || prevData?.weight || 0);
  const [reps, setReps] = useState(set.reps || prevData?.reps || 10);
  const [rpe, setRpe] = useState(set.rpe || 7);
  const [rir, setRir] = useState(set.rir ?? prevData?.rir ?? 2);
  const [mmcOpen, setMmcOpen] = useState(false);

  useEffect(() => {
    if (prevData && set.weight === 0) {
      setWeight(prevData.weight);
      setReps(prevData.reps);
    }
  }, [prevData]);

  if (set.completed) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: compact ? '3px 0' : '6px 0',
        borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: compact ? 10 : 11,
      }}>
        <span style={{ fontWeight: 700, color: ACCENT, minWidth: 20 }}>#{setNumber}</span>
        <span style={{ color: '#fff', fontWeight: 600 }}>{set.weight}кг × {set.reps}</span>
        <span style={{ color: 'rgba(255,255,255,0.85)' }}>RPE {set.rpe}</span>
        <span style={{ color: 'rgba(255,255,255,0.85)' }}>RIR {set.rir}</span>
        <span style={{ color: ACCENT, marginLeft: 'auto', fontSize: compact ? 9 : 10 }}>
          {Math.round(epley1RM(set.weight, set.reps))}кг 1RM
        </span>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    padding: compact ? '5px 4px' : '8px 6px',
    borderRadius: 6,
    background: isBodyweight ? 'rgba(255,255,255,0.03)' : '#18181b',
    border: '1px solid rgba(255,255,255,0.08)',
    color: isBodyweight ? 'rgba(255,255,255,0.85)' : '#fff',
    fontSize: compact ? 11 : 12,
    textAlign: 'center' as const,
    minHeight: compact ? 30 : 36,
    opacity: isBodyweight ? 0.6 : 1,
    boxSizing: 'border-box' as const,
  };

  return (
    <div style={{
      padding: compact ? '4px 0' : '8px 0',
      borderBottom: '1px solid rgba(255,255,255,0.03)',
      background: isCurrent ? 'rgba(0,230,138,0.03)' : 'transparent',
      borderRadius: isCurrent ? 8 : 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: compact ? 3 : 6 }}>
        <span style={{ fontWeight: 700, color: ACCENT, minWidth: 20, fontSize: compact ? 10 : 11 }}>#{setNumber}</span>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: compact ? 3 : 4 }}>
          <input type="number" value={weight} disabled={isBodyweight}
            onChange={e => setWeight(parseFloat(e.target.value) || 0)}
            placeholder={isBodyweight ? 'вес' : 'кг'} style={inputStyle} />
          <input type="number" value={reps}
            onChange={e => setReps(parseInt(e.target.value) || 0)}
            placeholder="повт" style={{ ...inputStyle, color: '#fff' }} />
          <input type="number" min={1} max={10} value={rpe}
            onChange={e => setRpe(parseInt(e.target.value) || 5)}
            placeholder="RPE" style={{ ...inputStyle, color: '#fff' }} />
          <input type="number" min={0} max={5} value={rir}
            onChange={e => setRir(parseInt(e.target.value) || 0)}
            placeholder="RIR" style={{ ...inputStyle, color: '#fff' }} />
        </div>
      </div>
      {!compact && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onComplete(weight, reps, rpe, rir)} disabled={weight <= 0 || reps <= 0}
            style={{
              flex: 2, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: weight > 0 && reps > 0 ? 'linear-gradient(135deg, #00e68a, #00c853)' : 'rgba(255,255,255,0.05)',
              color: weight > 0 && reps > 0 ? '#000' : 'rgba(255,255,255,0.85)',
              fontWeight: 700, fontSize: 12, minHeight: 40,
            }}>✓ Записать</button>
          <button onClick={onSkip}
            style={{
              flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
              background: 'transparent', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: 11, minHeight: 40,
            }}>Пропустить</button>
          {exerciseId && exerciseName && (
            <button onClick={() => setMmcOpen(o => !o)}
              style={{
                flex: 1, padding: '10px', borderRadius: 8,
                border: mmcOpen ? '1px solid rgba(0,230,138,0.4)' : '1px solid rgba(255,255,255,0.08)',
                background: mmcOpen ? 'rgba(0,230,138,0.08)' : 'transparent',
                color: mmcOpen ? ACCENT : 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: 11, minHeight: 40,
              }}>🧠 MMC</button>
          )}
        </div>
      )}
      {mmcOpen && exerciseId && exerciseName && (
        <div style={{ marginTop: 6 }}>
          <MMCSetPanel exerciseId={exerciseId} exerciseName={exerciseName} setNumber={setNumber} date={date} />
        </div>
      )}
    </div>
  );
};

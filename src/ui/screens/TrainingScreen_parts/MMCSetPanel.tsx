/**
 * MMCSetPanel.tsx — самостоятельная панель ввода MMC/Пампинг/Суставы/Энергия для одного подхода.
 *
 * Не зависит от формы сохранения тренировки: записывает в he_mmc_log сразу по кнопке «✓ Записать»
 * через recordMMCFromPartial (upsert по дате+упражнению+подходу — повторное сохранение обновляет,
 * а не дублирует). Встраивается в любой список подходов: передать exerciseId/exerciseName/setNumber/date.
 */
import React, { useState } from 'react';
import { recordMMCFromPartial, hasMMCValues, type MMCPartial } from '../../../engines/mmc-tracking.engine';

const ACCENT = '#00e68a';

interface MMCFieldDef {
  key: keyof MMCPartial;
  label: string;
  emoji: string;
  placeholder: string;
}

const FIELDS: MMCFieldDef[] = [
  { key: 'mmc', label: 'MMC', emoji: '🧠', placeholder: 'связь' },
  { key: 'pump', label: 'Пампинг', emoji: '💪', placeholder: 'памп' },
  { key: 'jointDiscomfort', label: 'Суставы', emoji: '🦵', placeholder: 'дискомфорт' },
  { key: 'energy', label: 'Энергия', emoji: '⚡', placeholder: 'силы' },
];

export interface MMCSetPanelProps {
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  /** Дата тренировки (YYYY-MM-DD). По умолчанию — сегодня. */
  date?: string;
  /** Компактный режим для мобильных/плотных списков. */
  compact?: boolean;
}

export const MMCSetPanel: React.FC<MMCSetPanelProps> = ({ exerciseId, exerciseName, setNumber, date, compact }) => {
  const [values, setValues] = useState<MMCPartial>({});
  const [saved, setSaved] = useState(false);

  const setField = (key: keyof MMCPartial, raw: string) => {
    setValues(prev => ({
      ...prev,
      [key]: raw === '' ? undefined : Math.min(10, Math.max(0, parseInt(raw, 10) || 0)),
    }));
    setSaved(false);
  };

  const save = () => {
    const ok = recordMMCFromPartial(
      date || new Date().toISOString().split('T')[0],
      exerciseId,
      exerciseName,
      setNumber,
      values,
    );
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const filled = hasMMCValues(values);

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
      padding: compact ? '4px 6px' : '6px 8px', borderRadius: 8,
      background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.15)',
    }}>
      {FIELDS.map(f => (
        <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: compact ? 9 : 10, color: 'rgba(255,255,255,0.55)' }}>
          <span style={{ whiteSpace: 'nowrap', minWidth: compact ? 0 : 44 }}>{f.emoji} {!compact && f.label}</span>
          <input
            type="number" min={0} max={10}
            value={values[f.key] ?? ''}
            onChange={e => setField(f.key, e.target.value)}
            placeholder={f.placeholder}
            style={{
              width: 34, padding: compact ? '2px 2px' : '4px 4px', borderRadius: 5,
              border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
              color: '#fff', fontSize: compact ? 10 : 11, textAlign: 'center',
              minHeight: compact ? 24 : 30,
            }}
          />
        </label>
      ))}
      <button
        onClick={save}
        disabled={!filled}
        title="Записать MMC в дневник"
        style={{
          padding: compact ? '3px 8px' : '5px 10px', borderRadius: 6, border: 'none', cursor: filled ? 'pointer' : 'not-allowed',
          background: filled ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.06)',
          color: filled ? '#000' : 'rgba(255,255,255,0.3)',
          fontWeight: 700, fontSize: compact ? 9 : 10, minHeight: compact ? 24 : 30,
        }}
      >
        {saved ? '✓ Записано' : '✓ Записать'}
      </button>
      {saved && (
        <span style={{ fontSize: compact ? 8 : 9, color: ACCENT, fontWeight: 700 }}>обновлено</span>
      )}
    </div>
  );
};

export default MMCSetPanel;

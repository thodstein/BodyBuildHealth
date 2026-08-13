/**
 * MMCSetPanel.tsx — панель ввода MMC/Пампинг/Суставы/Энергия для одного подхода.
 *
 * Каждая метрика — сегментированная шкала-выбор 0–10 (кнопки, как в модалках дневников Профиля).
 * Записывает в he_mmc_log по кнопке «Записать» через recordMMCFromPartial
 * (upsert по дате+упражнению+подходу — повторное сохранение обновляет, а не дублирует).
 * Встраивается в любой список подходов: передать exerciseId/exerciseName/setNumber/date.
 */
import React, { useState } from 'react';
import { recordMMCFromPartial, hasMMCValues, type MMCPartial } from '../../../engines/mmc-tracking.engine';
import { ScalePicker } from '../ProfileScreen_v2/diary-modals';

const ACCENT = '#00e68a';

interface MMCFieldDef {
  key: keyof MMCPartial;
  label: string;
  emoji: string;
  hint: string;
  /** true = выше значение лучше (MMC/пампинг/энергия) — инверсия цвета шкалы. */
  higherIsBetter: boolean;
}

const FIELDS: MMCFieldDef[] = [
  { key: 'mmc', label: 'MMC', emoji: '🧠', hint: 'связь мозг-мышцы', higherIsBetter: true },
  { key: 'pump', label: 'Пампинг', emoji: '💪', hint: 'наполнение мышцы кровью', higherIsBetter: true },
  { key: 'jointDiscomfort', label: 'Суставы', emoji: '🦵', hint: 'дискомфорт (0 — нет)', higherIsBetter: false },
  { key: 'energy', label: 'Энергия', emoji: '⚡', hint: 'общий запас сил', higherIsBetter: true },
];

const toneFor = (f: MMCFieldDef, v: number | undefined): string => {
  if (v === undefined) return 'rgba(255,255,255,0.35)';
  const pct = f.higherIsBetter ? (10 - v) / 10 : v / 10;
  return pct <= 0.25 ? '#22c55e' : pct <= 0.5 ? '#84cc16' : pct <= 0.75 ? '#f59e0b' : '#ef4444';
};

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

  const setField = (key: keyof MMCPartial, v: number) => {
    setValues(prev => ({ ...prev, [key]: Math.min(10, Math.max(0, v)) }));
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
      padding: compact ? '8px' : '10px 12px', borderRadius: 10,
      background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.15)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : '1fr 1fr', gap: compact ? 6 : 8 }}>
        {FIELDS.map(f => {
          const v = values[f.key];
          return (
            <div key={f.key} style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: compact ? 10 : 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                  {f.emoji} {f.label}
                </span>
                <span style={{ fontSize: compact ? 9 : 10, color: toneFor(f, v), fontWeight: 800, minWidth: 30, textAlign: 'right' }}>
                  {v !== undefined ? `${v}/10` : '—'}
                </span>
              </div>
              <ScalePicker
                value={v ?? 0}
                min={0}
                max={10}
                dense
                height={compact ? 30 : 36}
                onChange={val => setField(f.key, val)}
                toneFn={val => toneFor(f, val)}
              />
              {!compact && (
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{f.hint}</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: compact ? 6 : 8 }}>
        <button
          onClick={save}
          disabled={!filled}
          title="Записать MMC в дневник"
          style={{
            flex: 1, padding: compact ? '6px 10px' : '9px 12px', borderRadius: 8, border: 'none',
            cursor: filled ? 'pointer' : 'not-allowed',
            background: filled ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.06)',
            color: filled ? '#000' : 'rgba(255,255,255,0.3)',
            fontWeight: 800, fontSize: compact ? 10 : 11, minHeight: compact ? 30 : 38,
          }}
        >
          {saved ? '✓ Записано' : '💾 Записать MMC'}
        </button>
        {saved && (
          <span style={{ fontSize: compact ? 9 : 10, color: ACCENT, fontWeight: 700, whiteSpace: 'nowrap' }}>
            ✓ обновлено
          </span>
        )}
      </div>
    </div>
  );
};

export default MMCSetPanel;

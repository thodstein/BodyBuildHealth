/**
 * WarmupSessionPanel.tsx — панели разминки.
 *
 * WarmupCheckinInline — компактный чек-ин разминки для форм записи
 * (DiaryRecordingForm / QuickEntry / SessionEditorModal): выполнена ли,
 * качество 1-5, причина пропуска. Пишется в he_warmup_diary (одна запись
 * на дату) — даёт приверженность, тренд качества и бейджи 🔥 в истории.
 */
import React, { useState } from 'react';
import { ACCENT, DIM } from '../TrainingScreen_parts/diary-tokens';
import { upsertWarmupLog, latestWarmupLog, WARMUP_SKIP_REASONS } from '../../../engines/warmup.engine';

const WARMUP_COLOR = '#f97316';

const todayKey = () => new Date().toISOString().slice(0, 10);

export const WarmupCheckinInline: React.FC<{ date: string; sessionId?: string; onSaved?: () => void }> = ({ date, sessionId, onSaved }) => {
  const last = latestWarmupLog();
  const [done, setDone] = useState<boolean | null>(last?.done ?? null);
  const [quality, setQuality] = useState<number>(last?.quality || 3);
  const [skipped, setSkipped] = useState<string>(last?.skippedReason || WARMUP_SKIP_REASONS[0]);
  const [saved, setSaved] = useState(false);

  const save = () => {
    upsertWarmupLog({
      date: (date || todayKey()).slice(0, 10),
      sessionId,
      done: done === true,
      quality: done === true ? quality : null,
      skippedReason: done === false ? skipped : undefined,
      note: done === false ? `Пропущено: ${skipped}` : undefined,
    });
    setSaved(true);
    try { onSaved?.(); } catch { /* ignore */ }
  };

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--input-bg)',
    border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, minHeight: 32, boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { fontSize: 9, color: '#fff', marginBottom: 3 };

  return (
    <div className="pl-warmupcheckin" style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: WARMUP_COLOR }}>🔥 Разминка</span>
        {saved && <span style={{ fontSize: 9, color: ACCENT }}>✓ сохранено</span>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 110 }}>
          <div style={labelStyle}>Выполнена?</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {([true, false, null] as const).map(v => (
              <button key={String(v)} type="button" onClick={() => { setDone(v); setSaved(false); }}
                style={{
                  flex: 1, padding: '5px 6px', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 600, minHeight: 32,
                  border: done === v ? (v === false ? '1px solid #ef4444' : '1px solid #f97316') : '1px solid rgba(255,255,255,0.08)',
                  background: done === v ? (v === false ? 'rgba(239,68,68,0.12)' : 'rgba(249,115,22,0.15)') : 'rgba(255,255,255,0.04)',
                  color: done === v ? (v === false ? '#ef4444' : '#f97316') : '#fff',
                }}>
                {v === true ? '✓ да' : v === false ? '✕ нет' : '—'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 80 }}>
          <div style={labelStyle}>Качество (1-5)</div>
          <select aria-label="Качество разминки" value={quality} disabled={done !== true} onChange={e => { setQuality(+e.target.value); setSaved(false); }} style={{ ...selectStyle, opacity: done === true ? 1 : 0.4 }}>
            {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        {done === false && (
          <div style={{ flex: 1.2, minWidth: 130 }}>
            <div style={labelStyle}>Причина</div>
            <select aria-label="Причина пропуска" value={skipped} onChange={e => { setSkipped(e.target.value); setSaved(false); }} style={selectStyle}>
              {WARMUP_SKIP_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        )}
        <button type="button" onClick={save} disabled={saved || done === null} aria-label="Сохранить чек-ин разминки"
          style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', minHeight: 32, fontSize: 10, fontWeight: 700,
            background: saved || done === null ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#f97316,#ea580c)', color: saved || done === null ? DIM : '#000' }}>
          {saved ? '✓' : '💾'}
        </button>
      </div>
    </div>
  );
};

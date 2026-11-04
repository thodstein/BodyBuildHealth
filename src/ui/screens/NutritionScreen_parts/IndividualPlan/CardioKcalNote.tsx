/**
 * CardioKcalNote.tsx — что планировщик питания «видит» из кардио.
 *
 * Аудит 2026-11: TrainingScreen писал `he_cardio_kcal_note`, но читателя не было.
 * Теперь кардио-контракт читается и здесь — СПРАВОЧНО: цели КБЖУ не меняются,
 * потому что PAL уже учитывает дни/минуты/тип тренировок (иначе двойной счёт).
 *
 * Чтение ленивое (dynamic import): экран питания не тянет кардио-движок в
 * основной чанк и не грузит его на APK, пока блок реально не отрисован.
 */
import React, { useCallback, useEffect, useState } from 'react';
import type { CardioKcalContract, CardioPlannerNote } from '../../../../engines/lms/cardio-nutrition-contract.engine';

type ContractModule = typeof import('../../../../engines/lms/cardio-nutrition-contract.engine');

interface NoteState {
  note: CardioPlannerNote | null;
  contract: CardioKcalContract | null;
  failed: boolean;
}

export const CardioKcalNote: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const [state, setState] = useState<NoteState>({ note: null, contract: null, failed: false });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const m: ContractModule = await import('../../../../engines/lms/cardio-nutrition-contract.engine');
      const contract = m.loadCardioKcalContract();
      setState({ note: m.cardioKcalPlannerNote(contract), contract, failed: false });
    } catch {
      setState({ note: null, contract: null, failed: true });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  if (state.failed) return null;
  if (!state.note) return null;

  const ok = state.note.tone === 'ok';
  const accent = ok ? '#22c55e' : 'rgba(255,255,255,0.45)';
  return (
    <div
      data-cardio-nutrition-note="1"
      style={{
        display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 6, padding: '8px 10px',
        borderRadius: 10,
        background: ok ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${ok ? 'rgba(34,197,94,0.22)' : 'rgba(255,255,255,0.08)'}`,
        borderLeft: `3px solid ${accent}`,
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: accent, lineHeight: 1.35, flex: 1 }}>
          {state.note.headline}
        </span>
        <button
          type="button"
          onClick={() => { void refresh(); }}
          disabled={busy}
          aria-label="Обновить данные кардио"
          style={{
            minWidth: 44, minHeight: 44, padding: '4px 8px', borderRadius: 8, cursor: busy ? 'wait' : 'pointer',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff', fontSize: 12, opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? '…' : '↻'}
        </button>
      </div>
      {!compact && state.note.lines.map((l, i) => (
        <div key={i} style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>{l}</div>
      ))}
      {compact && (
        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>
          Кардио показано справочно — цели КБЖУ его не добавляют второй раз.
        </div>
      )}
      {state.contract && state.contract.cycleId && (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>
          Цикл: {state.contract.cycleId}
        </div>
      )}
    </div>
  );
};

/**
 * arm-hub-pick.tsx — инлайн-блок «методы с выбором упражнения» для табов движения
 * (паритет с ТА top3Block): выбираешь упражнение → оно идёт первым в инъекцию и мост.
 * Чистая презентация; логика предпочтения (persist/plumbing) — в ArmDiagnosticsHub.
 */
import React from 'react';
import type { ArmWeakPoint } from '../../../engines/arm/arm-biomechanics.engine';

export function ArmPickBlock({
  wp,
  top,
  pref,
  onPick,
}: {
  wp: ArmWeakPoint;
  top: Array<{ id: string; score: number; reason?: string }>;
  pref?: string;
  onPick: (wp: ArmWeakPoint, id: string) => void;
}) {
  if (!top || !top.length) return null;
  return (
    <div data-arm="wp-top3" style={{ marginTop: 6, padding: '6px 8px', borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.16)' }}>
      <div className="ad-muted" style={{ fontWeight: 700 }}>🏋️ Методы с выбором упражнения {pref ? '· ⭐ выбрано' : '· нажми — пойдёт первым в план'}</div>
      {top.map((t) => {
        const sel = pref === t.id;
        return (
          <button
            key={t.id}
            type="button"
            data-arm="wp-pick"
            data-selected={sel ? 'true' : 'false'}
            aria-pressed={sel}
            aria-label={`${sel ? 'Выбрано' : 'Выбрать'}: ${t.id}`}
            onClick={() => onPick(wp, t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 44, marginTop: 4, padding: '6px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', color: '#fff', background: sel ? 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(245,158,11,0.06))' : 'rgba(255,255,255,0.03)', border: sel ? '2px solid rgba(245,158,11,0.65)' : '1px solid rgba(255,255,255,0.08)' }}
          >
            <span aria-hidden style={{ minWidth: 32, minHeight: 32, borderRadius: 8, border: '1px solid rgba(245,158,11,0.4)', background: sel ? 'rgba(245,158,11,0.25)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{sel ? '⭐' : '☆'}</span>
            <b style={{ flex: 1, minWidth: 0, fontSize: 12 }}>{t.id}</b>
            <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 800, whiteSpace: 'nowrap' }}>score {t.score}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: sel ? '#f5b04c' : '#fff', whiteSpace: 'nowrap' }}>{sel ? '✓' : 'Выбрать'}</span>
          </button>
        );
      })}
    </div>
  );
}

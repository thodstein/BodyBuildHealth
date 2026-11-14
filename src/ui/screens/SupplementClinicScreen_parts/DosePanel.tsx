// SupplementClinicScreen_parts/DosePanel.tsx — эффективная дозировка стека.
import React, { useMemo } from 'react';
import { getDoseInfo, card, sectionTitle } from './shared';
import { formatDefaultDose } from '../../../data/dose-units';

export const DosePanel: React.FC<{ stackIds: string[] }> = ({ stackIds }) => {
  const rows = useMemo(() => stackIds.map((id) => getDoseInfo(id)), [stackIds]);

  if (stackIds.length === 0) {
    return (
      <div style={card}>
        <div style={sectionTitle}>Дозировка</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>
          Добавьте вещества в стек, чтобы увидеть целевую дозу, биодоступность и верхний допустимый уровень.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={sectionTitle}>Эффективная дозировка · {rows.length} веществ</div>
      {rows.map((r) => {
        const w = r.window;
        const ul = w && w.ul != null && w.ul > 0 ? w.ul : null;
        const dose = r.defaultDose ? r.defaultDose.mg : null;
        // Красным — только настоящее превышение UL. Safe Level / клинический
        // ориентир / потолок протокола дают жёлтую строку, а не «риск токсичности».
        const overUl = !!(w && ul != null && w.ulWarning && dose != null && dose > ul);
        const overOther = !!(w && ul != null && !w.ulWarning && dose != null && dose > ul);
        const scale = ul != null && ul > 0 ? ul : (w && w.max > 0 ? w.max : null);
        const pct = w && dose != null && w.opt > 0 ? Math.round((dose / w.opt) * 100) : 0;
        return (
          <div key={r.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{r.name}</div>
              {r.bestForm && (
                <span style={{
                  fontSize: 11, padding: '3px 7px', borderRadius: 8,
                  background: 'rgba(0,230,138,0.12)', color: 'var(--accent)', border: '1px solid rgba(0,230,138,0.3)',
                }}>
                  {r.bestForm.name} · био {(r.bestForm.bio * 100).toFixed(0)}%
                </span>
              )}
            </div>

            {r.defaultDose ? (
              <div style={{ marginTop: 8, fontSize: 14 }}>
                {/* Единица — натуральная для вещества: D3 в МЕ, Se/фолат в мкг.
                    БЫЛО: `${mg} мг` для всех → «5000 мг» витамина D вместо 5000 МЕ. */}
                <b style={{ color: 'var(--accent)' }}>{formatDefaultDose(r.id, r.defaultDose.mg)}</b> · {r.defaultDose.timing}
              </div>
            ) : (
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-dim)' }}>Базовая доза не задана в справочнике</div>
            )}

            {w && w.hasData && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>
                  <span>цель {w.min}–{w.max} {w.unit}</span>
                  <span>{w.limitText || 'предел не установлен'}</span>
                </div>
                {scale != null && scale > 0 && (
                  <div style={{
                    position: 'relative', height: 10, borderRadius: 6, overflow: 'hidden',
                    background: 'rgba(255,255,255,0.08)',
                  }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: Math.min(100, Math.round((w.opt / scale) * 100)) + '%',
                      background: 'rgba(0,230,138,0.25)', borderRight: '2px solid var(--accent)',
                    }} />
                    {dose != null && (
                      <div style={{
                        position: 'absolute', top: -2, bottom: -2,
                        left: Math.min(100, Math.round((dose / scale) * 100)) + '%',
                        width: 3, background: overUl ? '#ef4444' : '#fff',
                      }} />
                    )}
                  </div>
                )}
                <div style={{ marginTop: 4, fontSize: 12, color: overUl ? '#ff8a9b' : 'var(--text-dim)' }}>
                  {overUl
                    ? `⚠ Превышен UL (${w.ul} ${w.unit}) — риск токсичности`
                    : overOther
                      ? `Выше предела «${w.limitText}» — дозу оценивает врач`
                      : `Доза составляет ${pct}% от оптимальной (${w.opt} ${w.unit})`}
                  {w.note ? ` · ${w.note}` : ''}
                </div>
              </div>
            )}
            {w && !w.hasData && w.limitText && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
                {w.limitText}
                {w.limitNote ? ` · ${w.limitNote}` : ''}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

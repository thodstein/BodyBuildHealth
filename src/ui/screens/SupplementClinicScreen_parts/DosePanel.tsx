// SupplementClinicScreen_parts/DosePanel.tsx — эффективная дозировка стека.
import React, { useMemo } from 'react';
import { getDoseInfo, card, sectionTitle } from './shared';

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
        const pct = w && r.defaultDose ? Math.round((r.defaultDose.mg / w.optMg) * 100) : 0;
        const overUl = w && r.defaultDose && r.defaultDose.mg > w.ul;
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
                <b style={{ color: 'var(--accent)' }}>{r.defaultDose.mg} мг</b> · {r.defaultDose.timing}
              </div>
            ) : (
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-dim)' }}>Базовая доза не задана в справочнике</div>
            )}

            {w && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>
                  <span>цель {w.minMg}–{w.maxMg} мг</span>
                  <span>UL {w.ul} мг</span>
                </div>
                <div style={{
                  position: 'relative', height: 10, borderRadius: 6, overflow: 'hidden',
                  background: 'rgba(255,255,255,0.08)',
                }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: Math.min(100, Math.round((w.optMg / w.ul) * 100)) + '%',
                    background: 'rgba(0,230,138,0.25)', borderRight: '2px solid var(--accent)',
                  }} />
                  {r.defaultDose && (
                    <div style={{
                      position: 'absolute', top: -2, bottom: -2,
                      left: Math.min(100, Math.round((r.defaultDose.mg / w.ul) * 100)) + '%',
                      width: 3, background: overUl ? '#ef4444' : '#fff',
                    }} />
                  )}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: overUl ? '#ff8a9b' : 'var(--text-dim)' }}>
                  {overUl
                    ? `⚠ Превышен UL (${w.ul} мг) — риск токсичности`
                    : `Доза составляет ${pct}% от оптимальной (${w.optMg} мг)`}
                  {w.note ? ` · ${w.note}` : ''}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/**
 * CardioLinkCard.tsx — интеграционная карточка «Кардио» для силовых
 * конструкторов (ПЛ-авто/ББ-авто/ручной). Читает cardio-bridge (ссылка),
 * показывает подключённый цикл, позволяет открыть кардио-конструктор,
 * пересчитать цикл под текущий ACWR (adaptCardioToStrength) и отключить.
 * Сам кардио-цикл хранится отдельно — копия не создаётся.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { getCardioLink, clearCardioLink, subscribeCardioLink, SPORT_LABELS } from '../../../engines/lms/cardio-bridge';
import { loadCardioCycles, saveCardioCycle, setActiveCardioCycle, adaptCardioToStrength } from '../../../engines/lms/cardio.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../../../engines/pro/training-load.engine';

const BTN: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
  color: '#fff', minHeight: 36, whiteSpace: 'nowrap',
};
const BTN_DANGER: React.CSSProperties = { ...BTN, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' };
const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
};
const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };

function openCardioConstructor(): void {
  try { localStorage.setItem('he_training_planning_track', 'cardio'); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'cardio' }));
}

export const CardioLinkCard: React.FC = () => {
  const [link, setLink] = useState(getCardioLink());
  const [cycleName, setCycleName] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const un = subscribeCardioLink(l => setLink(l));
    return un;
  }, []);
  useEffect(() => {
    if (!link) { setCycleName(null); return; }
    const c = loadCardioCycles().find(x => x.id === link.cycleId);
    setCycleName(c?.name ?? link.cycleId);
  }, [link]);

  const flashMsg = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };

  const recalc = useCallback(() => {
    if (!link) return;
    const c = loadCardioCycles().find(x => x.id === link.cycleId);
    if (!c) { flashMsg('⚠ Кардио-цикл не найден в библиотеке'); return; }
    let acwr: number | null = null;
    try {
      const srpe = loadSRPESessions();
      if (srpe.length >= 2) acwr = acuteChronicRatio(toDailyLoads(srpe)).ratio;
    } catch { /* ignore */ }
    const adapted = adaptCardioToStrength(c, { acwr });
    saveCardioCycle(adapted);
    setActiveCardioCycle(adapted);
    flashMsg(acwr != null ? `✅ Кардио адаптировано под ACWR ${acwr.toFixed(2)}` : '✅ Кардио пересчитано (ACWR нет — объём сохранён)');
  }, [link]);

  return (
    <div style={CARD}>
      <div style={ROW}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>❤️ Кардио</span>
        {link ? (
          <>
            <span style={{ fontSize: 11, color: '#4ade80' }}>Подключено: {cycleName ?? link.cycleId}</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>(к {SPORT_LABELS[link.sport]})</span>
          </>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Не подключено</span>
        )}
      </div>
      {flash && <div style={{ color: '#4ade80', fontSize: 11, fontWeight: 600 }} role="status">{flash}</div>}
      <div style={ROW}>
        <button style={BTN} onClick={openCardioConstructor}>🛠 Открыть кардио-конструктор</button>
        {link && (
          <>
            <button style={BTN} onClick={recalc} title="Адаптировать кардио-цикл под текущий ACWR (без изменения силового плана)">🔄 Пересчитать под ACWR</button>
            <button style={BTN_DANGER} onClick={() => { clearCardioLink(); flashMsg('🔓 Кардио отключено'); }}>Отключить</button>
          </>
        )}
      </div>
    </div>
  );
};

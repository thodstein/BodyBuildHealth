/**
 * CardioAutoTunePanel.tsx — проф-инструменты кардио:
 * 🔄 Авто-режим (подстройка по дневнику с diff-подтверждением),
 * 🎯 Пульс-зоны (Karvonen) и 🔔 «Сегодня».
 */
import React, { useMemo, useState } from 'react';
import {
  autoTuneCardioCycle, cardioHeartZones, cardioSessionsForDate, cardioCycleSummary,
  loadCardioCycles, saveCardioCycle, setActiveCardioCycle,
  saveCardioCycleVersion, latestCardioCycleVersion, restoreCardioCycleVersion,
  type CardioCycle, type CardioTuneChange,
} from '../../../engines/lms/cardio.engine';
import { loadCardioLog } from '../../../engines/lms/cardio-diary.engine';

const BTN: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
  color: '#fff', minHeight: 40, whiteSpace: 'nowrap',
};
const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: 'rgba(0,230,138,0.16)', border: '1px solid rgba(0,230,138,0.4)', color: '#00e68a' };
const BTN_DANGER: React.CSSProperties = { ...BTN, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' };
const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
};
const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const LABEL: React.CSSProperties = { fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 };
const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12, width: 80,
};

export const CARDIO_AUTO_TUNE_KEY = 'he_cardio_auto_tune';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const CardioAutoTunePanel: React.FC<{
  cycle: CardioCycle | null;
  acwr?: number | null;
  onChanged?: () => void;
}> = ({ cycle, acwr, onChanged }) => {
  const [autoMode, setAutoMode] = useState<boolean>(() => {
    try { return localStorage.getItem(CARDIO_AUTO_TUNE_KEY) === '1'; } catch { return false; }
  });
  const [pending, setPending] = useState<{ changes: CardioTuneChange[]; reason: string } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [age, setAge] = useState('30');
  const [restHr, setRestHr] = useState('');

  const flashMsg = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };

  const zones = useMemo(() => {
    const a = Math.max(12, Math.min(90, Number(age) || 30));
    const r = Number(restHr) > 0 ? Number(restHr) : undefined;
    return cardioHeartZones(a, r);
  }, [age, restHr]);

  const today = useMemo(() => {
    if (!cycle) return null;
    return cardioSessionsForDate(cycle, todayIso());
  }, [cycle]);

  const toggleAuto = (v: boolean) => {
    setAutoMode(v);
    try { localStorage.setItem(CARDIO_AUTO_TUNE_KEY, v ? '1' : '0'); } catch { /* ignore */ }
    flashMsg(v ? '🔄 Авто-режим включён: подстройка по дневнику и ACWR' : 'Авто-режим выключен');
  };

  const previewTune = () => {
    if (!cycle) { flashMsg('⚠ Сначала соберите кардио-цикл'); return; }
    const r = autoTuneCardioCycle(cycle, loadCardioLog(), { acwr });
    if (r.changes.length === 0) { flashMsg('✅ Дневник соответствует плану — изменений нет'); return; }
    setPending({ changes: r.changes, reason: r.advice.reason });
  };

  const applyTune = () => {
    if (!cycle || !pending) return;
    const r = autoTuneCardioCycle(cycle, loadCardioLog(), { acwr });
    saveCardioCycleVersion(cycle, 'авто-подстройка');
    saveCardioCycle(r.cycle);
    setActiveCardioCycle(r.cycle);
    setPending(null);
    onChanged?.();
    flashMsg(`✅ Подстройка применена: ${r.changes.length} изменений (${r.advice.action})`);
  };

  const undoVersion = () => {
    if (!cycle) return;
    const restored = restoreCardioCycleVersion(cycle.id);
    if (!restored) { flashMsg('⚠ Нет сохранённых версий для отмены'); return; }
    saveCardioCycle(restored);
    setActiveCardioCycle(restored);
    onChanged?.();
    flashMsg('↩ Версия восстановлена');
  };

  const hasVersion = cycle ? latestCardioCycleVersion(cycle.id) != null : false;

  return (
    <div style={CARD}>
      <div style={ROW}>
        <span style={LABEL}>🔄 Авто-режим</span>
        <button
          style={autoMode ? { ...BTN_PRIMARY, minHeight: 32, padding: '6px 10px' } : { ...BTN, minHeight: 32, padding: '6px 10px' }}
          onClick={() => toggleAuto(!autoMode)}
          title="Подстраивать кардио по дневнику (adherence/RPE/ACWR) с подтверждением diff"
        >
          {autoMode ? '🟢 Включён' : '⚪ Выключен'}
        </button>
        <button style={BTN} onClick={previewTune} title="Показать, что изменится по текущему дневнику">🔄 Подстроить сейчас</button>
        {hasVersion && <button style={BTN} onClick={undoVersion} title="Отменить последнюю авто-подстройку/правку">↩ Вернуть версию</button>}
      </div>
      {flash && <div style={{ color: '#4ade80', fontSize: 11, fontWeight: 600 }} role="status">{flash}</div>}

      {pending && (
        <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: '#93c5fd', fontWeight: 700 }}>Предпросмотр изменений ({pending.changes.length})</div>
          {pending.changes.map((c, i) => (
            <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
              Нед {c.week}: <b>{c.label}</b> — {c.from} → {c.to}
            </div>
          ))}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{pending.reason}</div>
          <div style={ROW}>
            <button style={BTN_PRIMARY} onClick={applyTune}>✓ Применить</button>
            <button style={BTN_DANGER} onClick={() => setPending(null)}>✕ Отменить</button>
          </div>
        </div>
      )}

      {today && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          🔔 Сегодня (нед {today.week.week}, {today.week.phase}):{' '}
          {today.sessions.length === 0 ? 'кардио по плану нет' : today.sessions.map(s => `${s.type.toUpperCase()} ${s.durationMin} мин`).join(' · ')}
        </div>
      )}

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={ROW}>
          <span style={LABEL}>🎯 Пульс-зоны (Karvonen)</span>
          <input value={age} onChange={e => setAge(e.target.value)} placeholder="Возраст" inputMode="numeric" style={INPUT} aria-label="Возраст" />
          <input value={restHr} onChange={e => setRestHr(e.target.value)} placeholder="ЧСС покоя" inputMode="numeric" style={INPUT} aria-label="ЧСС покоя" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {zones.map(z => (
            <div key={z.zone} title={z.purpose} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 8, background: z.zone === 2 ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)', border: z.zone === 2 ? '1px solid rgba(0,230,138,0.4)' : '1px solid rgba(255,255,255,0.07)', color: z.zone === 2 ? '#4ade80' : 'rgba(255,255,255,0.6)' }}>
              {z.label}: {z.bpmMin}–{z.bpmMax} уд
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

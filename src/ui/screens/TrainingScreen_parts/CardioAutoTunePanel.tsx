/**
 * CardioAutoTunePanel.tsx — проф-инструменты кардио:
 * 🔄 Авто-режим (подстройка по дневнику с diff-подтверждением),
 * 🎯 Пульс-зоны (Karvonen) и 🔔 «Сегодня».
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  autoTuneCardioCycle, cardioHeartZones, cardioSessionsForDate, cardioCycleSummary,
  loadCardioCycles, saveCardioCycle, setActiveCardioCycle,
  saveCardioCycleVersion, latestCardioCycleVersion, restoreCardioCycleVersion,
  lthrZones, runningVdot,
  type CardioCycle, type CardioTuneChange,
} from '../../../engines/lms/cardio.engine';
import { loadCardioLog, cardioHrCompliance } from '../../../engines/lms/cardio-diary.engine';
import { CARD, ROW, LABEL, BTN, BTN_PRIMARY, BTN_DANGER, NumberInput } from './CardioUI';

export const CARDIO_AUTO_TUNE_KEY = 'he_cardio_auto_tune';
export const CARDIO_AUTO_APPLY_KEY = 'he_cardio_auto_apply';

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
  const [autoApply, setAutoApply] = useState<boolean>(() => {
    try { return localStorage.getItem(CARDIO_AUTO_APPLY_KEY) === '1'; } catch { return false; }
  });
  const [pending, setPending] = useState<{ changes: CardioTuneChange[]; reason: string } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  // Возраст/ЧСС покоя предзаполняются из параметров цикла (config) — зоны
  // считаются для реального пользователя, а не для дефолтных 30 лет.
  const [age, setAge] = useState(() => String(cycle?.config?.age ?? 30));
  const [restHr, setRestHr] = useState(() => (cycle?.config?.restingHr != null && cycle.config.restingHr > 0 ? String(cycle.config.restingHr) : ''));
  const [lthr, setLthr] = useState('');
  const [vdotKm, setVdotKm] = useState('');
  const [vdotMin, setVdotMin] = useState('');

  const flashMsg = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };

  const zones = useMemo(() => {
    const l = Number(lthr);
    if (l > 0) return lthrZones(l);
    const a = Math.max(12, Math.min(90, Number(age) || 30));
    const r = Number(restHr) > 0 ? Number(restHr) : undefined;
    return cardioHeartZones(a, r);
  }, [age, restHr, lthr]);

  const vdot = useMemo(() => {
    const km = Number(vdotKm);
    const min = Number(vdotMin);
    if (!(km > 0) || !(min > 0)) return null;
    return runningVdot(km, min);
  }, [vdotKm, vdotMin]);

  // Факт-ЧСС против целевых зон плана (28 дней).
  const hrCheck = useMemo(() => {
    if (!cycle) return null;
    try { return cardioHrCompliance(cycle, loadCardioLog(), { days: 28 }); } catch { return null; }
  }, [cycle]);

  const today = useMemo(() => {
    if (!cycle) return null;
    return cardioSessionsForDate(cycle, todayIso(), cycle.startDate);
  }, [cycle]);

  const toggleAuto = (v: boolean) => {
    setAutoMode(v);
    try { localStorage.setItem(CARDIO_AUTO_TUNE_KEY, v ? '1' : '0'); } catch { /* ignore */ }
    flashMsg(v ? '🔄 Авто-режим включён: подстройка по дневнику и ACWR' : 'Авто-режим выключен');
    if (v && cycle) previewTune();
  };

  const toggleAutoApply = (v: boolean) => {
    setAutoApply(v);
    try { localStorage.setItem(CARDIO_AUTO_APPLY_KEY, v ? '1' : '0'); } catch { /* ignore */ }
    flashMsg(v ? '⚡ Авто-применение включено: подстройки применяются сразу (с undo)' : 'Авто-применение выключено: только предпросмотр');
  };

  const applyTune = () => {
    if (!cycle) return;
    const r = autoTuneCardioCycle(cycle, loadCardioLog(), { acwr });
    if (r.changes.length === 0) return;
    saveCardioCycleVersion(cycle, 'авто-подстройка');
    saveCardioCycle(r.cycle);
    setActiveCardioCycle(r.cycle);
    setPending(null);
    onChanged?.();
    flashMsg(`✅ Подстройка применена: ${r.changes.length} изменений (${r.advice.action})`);
  };

  const previewTune = () => {
    if (!cycle) { flashMsg('⚠ Сначала соберите кардио-цикл'); return; }
    const r = autoTuneCardioCycle(cycle, loadCardioLog(), { acwr });
    if (r.changes.length === 0) { flashMsg('✅ Дневник соответствует плану — изменений нет'); return; }
    setPending({ changes: r.changes, reason: r.advice.reason });
  };

  // Авто-режим: при изменении цикла/дневника — предпросмотр, а при
  // включённом авто-применении — сразу применение (с undo-версией).
  const previewTuneRef = useRef(previewTune);
  previewTuneRef.current = previewTune;
  const applyTuneRef = useRef(applyTune);
  applyTuneRef.current = applyTune;
  const autoApplyRef = useRef(autoApply);
  autoApplyRef.current = autoApply;
  useEffect(() => {
    if (autoMode && cycle) {
      if (autoApplyRef.current) applyTuneRef.current();
      else previewTuneRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, autoApply, cycle]);

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
        <button
          style={autoApply ? { ...BTN_PRIMARY, minHeight: 32, padding: '6px 10px' } : { ...BTN, minHeight: 32, padding: '6px 10px' }}
          onClick={() => toggleAutoApply(!autoApply)}
          title="Применять подстройки автоматически (с сохранением версии для отмены)"
        >
          {autoApply ? '⚡ Авто-применение: вкл' : '⚡ Авто-применение: выкл'}
        </button>
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

      {hrCheck && hrCheck.advice && (
        <div style={{ fontSize: 11, color: hrCheck.inZonePct != null && hrCheck.inZonePct >= 70 ? '#4ade80' : '#fbbf24', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '6px 8px' }}>
          🎯 Пульс по факту (28д): попадание в зону {hrCheck.inZonePct}% · отклонение {hrCheck.avgDelta != null && hrCheck.avgDelta > 0 ? '+' : ''}{hrCheck.avgDelta} уд — {hrCheck.advice}
        </div>
      )}

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={ROW}>
          <span style={LABEL}>🎯 Пульс-зоны {lthr ? '(LTHR)' : '(Karvonen)'}</span>
          <NumberInput
            value={age}
            onChange={setAge}
            min={12}
            max={90}
            step={1}
            placeholder="30"
            ariaLabel="Возраст"
            width={80}
            suffix="лет"
          />
          <NumberInput
            value={restHr}
            onChange={setRestHr}
            min={30}
            max={120}
            step={1}
            placeholder="60"
            ariaLabel="ЧСС покоя"
            width={90}
            suffix="уд/мин"
          />
          <NumberInput
            value={lthr}
            onChange={setLthr}
            min={80}
            max={220}
            step={1}
            placeholder="160"
            ariaLabel="LTHR (пороговый пульс)"
            width={100}
            suffix="уд/мин"
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {zones.map(z => (
            <div key={z.zone} title={z.purpose} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 8, background: z.zone === 2 ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)', border: z.zone === 2 ? '1px solid rgba(0,230,138,0.4)' : '1px solid rgba(255,255,255,0.07)', color: z.zone === 2 ? '#4ade80' : 'rgba(255,255,255,0.6)' }}>
              {z.label}: {z.bpmMin}–{z.bpmMax} уд
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={ROW}>
          <span style={LABEL}>🏃 VDOT (тест: км за минуты)</span>
          <NumberInput
            value={vdotKm}
            onChange={setVdotKm}
            min={0.1}
            max={100}
            step={0.1}
            placeholder="5"
            ariaLabel="Дистанция теста км"
            width={70}
            suffix="км"
          />
          <NumberInput
            value={vdotMin}
            onChange={setVdotMin}
            min={1}
            max={120}
            step={1}
            placeholder="20"
            ariaLabel="Время теста мин"
            width={70}
            suffix="мин"
          />
        </div>
        {vdot && (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
            VDOT {vdot.vdot} · темпы: {vdot.pacesKm.map(p => `${p.label} ${p.minPerKm} мин/км`).join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
};

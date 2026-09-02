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
  lthrZones, runningVdot, estimateLTHRFrom30Min, cyclingPowerZones, menstrualPhaseForDate, cardioCyclePeriodAware,
  type CardioCycle, type CardioTuneChange,
} from '../../../engines/lms/cardio.engine';
import { loadCardioLog, cardioHrCompliance } from '../../../engines/lms/cardio-diary.engine';
import { CARD, ROW, LABEL, HINT_SM, BTN, BTN_SMALL, BTN_PRIMARY, BTN_DANGER, NumberInput, Badge, Accordion } from './CardioUI';
import { getProfile, updateSection } from '../../../core/profile-manager';
import { connectBleHr, type BleHrState } from '../../../engines/lms/cardio-ble.engine';

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
  const [lthrLast20, setLthrLast20] = useState('');
  const [vdotKm, setVdotKm] = useState('');
  const [vdotMin, setVdotMin] = useState('');
  const [cooperKm, setCooperKm] = useState('');
  const [ftpWatts, setFtpWatts] = useState('');
  const [periodStart, setPeriodStart] = useState(() => {
    try { return getProfile()?.settings?.lifestyle?.lastPeriodStart ?? ''; } catch { return ''; }
  });
  const [periodLen, setPeriodLen] = useState(() => {
    try { return String(getProfile()?.settings?.lifestyle?.cycleLengthDays ?? 28); } catch { return '28'; }
  });
  const [ble, setBle] = useState<BleHrState>({ connected: false });
  const [bleHr, setBleHr] = useState<number | null>(null);
  const bleDisconnectRef = useRef<{ disconnect: () => void } | null>(null);

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

  const cooperVdot = useMemo(() => {
    const km = Number(cooperKm);
    if (!(km > 0)) return null;
    return runningVdot(km, 12);
  }, [cooperKm]);

  const periodInfo = useMemo(() => {
    if (!periodStart) return null;
    const len = Math.max(21, Math.min(35, Number(periodLen) || 28));
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return menstrualPhaseForDate({ lastPeriodStartIso: periodStart, cycleLengthDays: len }, today);
  }, [periodStart, periodLen]);

  const applyPeriodAware = () => {
    if (!cycle || !periodStart) { flashMsg('⚠ Укажите дату начала цикла'); return; }
    const len = Math.max(21, Math.min(35, Number(periodLen) || 28));
    const r = cardioCyclePeriodAware(cycle, { lastPeriodStartIso: periodStart, cycleLengthDays: len });
    if (r.changes.length === 0) { flashMsg('✅ Коррекций по циклу не требуется (не лютеиновая фаза или нет HIIT)'); return; }
    saveCardioCycleVersion(cycle, '🌸 период-коррекция');
    saveCardioCycle(r.cycle);
    setActiveCardioCycle(r.cycle);
    onChanged?.();
    flashMsg(`🌸 Применено ${r.changes.length} коррекций: ${r.changes.map(c => `нед ${c.week} ${c.label}`).join(', ')}`);
  };

  const handleBleConnect = async () => {
    if (ble.connected && bleDisconnectRef.current) {
      bleDisconnectRef.current.disconnect();
      bleDisconnectRef.current = null;
      setBle({ connected: false });
      setBleHr(null);
      flashMsg('📡 BLE отключён');
      return;
    }
    flashMsg('📡 Поиск HR-датчика…');
    const res = await connectBleHr(hr => setBleHr(hr), s => setBle(s));
    if (res) bleDisconnectRef.current = res;
  };

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
  // Guard против зацикливания: применяем только если cycle.id / acwr изменились.
  const lastAutoCycleRef = useRef<string | null>(null);
  const previewTuneRef = useRef(previewTune);
  previewTuneRef.current = previewTune;
  const applyTuneRef = useRef(applyTune);
  applyTuneRef.current = applyTune;
  const autoApplyRef = useRef(autoApply);
  autoApplyRef.current = autoApply;
  useEffect(() => {
    if (autoMode && cycle) {
      const key = `${cycle.id}:${String(acwr ?? 'null')}`;
      if (lastAutoCycleRef.current === key) return;
      lastAutoCycleRef.current = key;
      if (autoApplyRef.current) applyTuneRef.current();
      else previewTuneRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, autoApply, cycle, acwr]);

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
            <div key={i} style={{ fontSize: 11, color: '#fff' }}>
              Нед {c.week}: <b>{c.label}</b> — {c.from} → {c.to}
            </div>
          ))}
          <div style={{ fontSize: 11, color: '#fff' }}>{pending.reason}</div>
          <div style={ROW}>
            <button style={BTN_PRIMARY} onClick={applyTune}>✓ Применить</button>
            <button style={BTN_DANGER} onClick={() => setPending(null)}>✕ Отменить</button>
          </div>
        </div>
      )}

      {today && (
        <div style={{ fontSize: 11, color: '#fff' }}>
          🔔 Сегодня (нед {today.week.week}, {today.week.phase}):{' '}
          {today.sessions.length === 0 ? 'кардио по плану нет' : today.sessions.map(s => `${s.type.toUpperCase()} ${s.durationMin} мин`).join(' · ')}
        </div>
      )}

      {hrCheck && hrCheck.advice && (
        <div style={{ fontSize: 11, color: hrCheck.inZonePct != null && hrCheck.inZonePct >= 70 ? '#4ade80' : '#fbbf24', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '6px 8px' }}>
          🎯 Пульс по факту (28д): попадание в зону {hrCheck.inZonePct}% · отклонение {hrCheck.avgDelta != null && hrCheck.avgDelta > 0 ? '+' : ''}{hrCheck.avgDelta} уд — {hrCheck.advice}
        </div>
      )}

      <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 8, background: ble.connected ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${ble.connected ? 'rgba(0,230,138,0.28)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, padding: 10 }}>
        <div style={ROW}>
          <span style={LABEL}>📡 BLE HR</span>
          <button style={ble.connected ? BTN_PRIMARY : BTN} onClick={handleBleConnect} title="Подключить Polar H10 / Garmin HRM через Web Bluetooth">{ble.connected ? `🟢 ${ble.deviceName ?? 'HR'} ${bleHr ? bleHr + ' уд/мин' : ''} — Отключить` : '📡 Подключить HR-датчик'}</button>
          {ble.error && <span style={{ fontSize: 11, color: '#f87171' }}>{ble.error}</span>}
          {bleHr && !ble.connected && <Badge bg="rgba(0,230,138,0.12)" border="rgba(0,230,138,0.24)" color="#4ade80">{bleHr} уд/мин live</Badge>}
        </div>
        <div style={HINT_SM}>Polar H10 / Garmin HRM — live HR в таймере + подсветка зоны (Web Bluetooth, Chrome/Edge).</div>
      </div>

      <Accordion title={`Пульс-зоны ${lthr ? '(LTHR)' : '(Karvonen)'}`} icon="🎯" defaultOpen>
        <div style={ROW}>
          <NumberInput value={age} onChange={setAge} min={12} max={90} step={1} placeholder="30" ariaLabel="Возраст" width={80} suffix="лет" />
          <NumberInput value={restHr} onChange={setRestHr} min={30} max={120} step={1} placeholder="60" ariaLabel="ЧСС покоя" width={90} suffix="уд/мин" />
          <NumberInput value={lthr} onChange={setLthr} min={80} max={220} step={1} placeholder="160" ariaLabel="LTHR (пороговый пульс)" width={100} suffix="уд/мин" />
        </div>
        <div style={ROW}>
          <NumberInput value={lthrLast20} onChange={setLthrLast20} min={80} max={220} step={1} placeholder="168" ariaLabel="Средн ЧСС последн 20′ (30-мин тест)" width={110} suffix="последн 20′" />
          <button style={BTN_SMALL} onClick={() => { const v = estimateLTHRFrom30Min(Number(lthrLast20)); if (v) { setLthr(String(v)); flashMsg(`LTHR ${v} уд/мин из последн 20′ — применён`); } else flashMsg('⚠ Укажите ЧСС 80-220'); }} title="30-мин all-out: средняя ЧСС последних 20 мин → LTHR (Friel)">→ LTHR</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {zones.map(z => (
            <div key={z.zone} title={z.purpose} style={{ fontSize: 10, padding: '5px 9px', borderRadius: 8, background: z.zone === 2 ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.04)', border: z.zone === 2 ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.07)', color: z.zone === 2 ? '#4ade80' : '#fff', fontWeight: z.zone === 2 ? 800 : 500 }}>
              {z.label}: {z.bpmMin}–{z.bpmMax}
            </div>
          ))}
        </div>
        <div style={HINT_SM}>Zone 2 — базовая выносливость. LTHR приоритетнее Karvonen. 30-мин тест Friel: бегите all-out 30 мин, средняя ЧСС последних 20 мин = LTHR.</div>
      </Accordion>

      <Accordion title="VDOT — темпы по тесту" icon="🏃" defaultOpen={false}>
        <div style={ROW}>
          <NumberInput value={vdotKm} onChange={setVdotKm} min={0.1} max={100} step={0.1} placeholder="5" ariaLabel="Дистанция теста км" width={70} suffix="км" />
          <NumberInput value={vdotMin} onChange={setVdotMin} min={1} max={120} step={1} placeholder="20" ariaLabel="Время теста мин" width={70} suffix="мин" />
          {vdot && <Badge bg="rgba(96,165,250,0.13)" border="rgba(96,165,250,0.26)" color="#60a5fa">VDOT {vdot.vdot}</Badge>}
        </div>
        <div style={ROW}>
          {[
            { l: '5K 20′', km: '5', min: '20' },
            { l: '5K 25′', km: '5', min: '25' },
            { l: '10K 45′', km: '10', min: '45' },
            { l: 'HM 1:40', km: '21.1', min: '100' },
          ].map(p => (
            <button key={p.l} style={BTN_SMALL} onClick={() => { setVdotKm(p.km); setVdotMin(p.min); }} title={`Пресет ${p.l}`}>{p.l}</button>
          ))}
        </div>
        {vdot && <div style={{ fontSize: 11, color: '#fff', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '6px 8px' }}>Темпы: {vdot.pacesKm.map(p => `${p.label} ${p.minPerKm}`).join(' · ')}</div>}
        <div style={HINT_SM}>Любая дистанция/время → VDOT → темпы Daniels (70/81/88/97.5/105% VDOT).</div>
      </Accordion>

      <Accordion title="Cooper 12′" icon="🏃" defaultOpen={false}>
        <div style={ROW}>
          <NumberInput value={cooperKm} onChange={setCooperKm} min={0.5} max={5} step={0.05} placeholder="2.4" ariaLabel="Дистанция Cooper км" width={80} suffix="км за 12мин" />
          {cooperVdot && <Badge bg="rgba(96,165,250,0.13)" border="rgba(96,165,250,0.26)" color="#60a5fa">VDOT {cooperVdot.vdot}</Badge>}
        </div>
        {cooperVdot && <div style={{ fontSize: 11, color: '#fff', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '6px 8px' }}>Темпы Cooper: {cooperVdot.pacesKm.map(p => `${p.label} ${p.minPerKm}`).join(' · ')}</div>}
        <div style={HINT_SM}>Cooper: 12 мин максимально → VDOT.</div>
      </Accordion>

      <Accordion title="Ватт-зоны (FTP)" icon="⚡" defaultOpen={false}>
        <div style={ROW}>
          <NumberInput value={ftpWatts} onChange={setFtpWatts} min={80} max={600} step={5} placeholder="250" ariaLabel="FTP ватт" width={90} suffix="Вт FTP" />
          {ftpWatts && Number(ftpWatts) > 0 && <Badge bg="rgba(250,204,21,0.13)" border="rgba(250,204,21,0.28)" color="#facc15">FTP {ftpWatts} Вт</Badge>}
        </div>
        {ftpWatts && Number(ftpWatts) > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {cyclingPowerZones(Number(ftpWatts)).slice(0, 5).map(z => (
              <div key={z.zone} style={{ fontSize: 10, padding: '5px 9px', borderRadius: 8, background: z.zone === 2 ? 'rgba(250,204,21,0.14)' : 'rgba(255,255,255,0.04)', border: z.zone === 2 ? '1px solid rgba(250,204,21,0.35)' : '1px solid rgba(255,255,255,0.07)', color: z.zone === 2 ? '#facc15' : '#fff' }}>
                Z{z.zone} {z.wattsMin}-{z.wattsMax}Вт · {z.purpose}
              </div>
            ))}
          </div>
        )}
        <div style={HINT_SM}>Coggan: Z2 56-75% FTP — база, Z4 91-105% — порог. Вело-интервалы держите в зонах.</div>
      </Accordion>

      <Accordion title="Менструальный цикл" icon="🌸" defaultOpen={false}>
        <div style={ROW}>
          <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '7px 10px', color: '#fff', fontSize: 12 }} aria-label="Дата начала цикла" />
          <NumberInput value={periodLen} onChange={setPeriodLen} min={21} max={35} step={1} placeholder="28" ariaLabel="Длина цикла" width={70} suffix="дн" />
        </div>
        {periodInfo && (
          <div style={{ fontSize: 11, padding: '7px 10px', borderRadius: 8, background: periodInfo.phase === 'luteal' ? 'rgba(239,68,68,0.08)' : 'rgba(0,230,138,0.07)', border: `1px solid ${periodInfo.phase === 'luteal' ? 'rgba(239,68,68,0.24)' : 'rgba(0,230,138,0.18)'}`, color: periodInfo.phase === 'luteal' ? '#f87171' : '#4ade80' }}>
            День {periodInfo.cycleDay} · {periodInfo.phase === 'follicular' ? 'Фолликулярная' : periodInfo.phase === 'ovulatory' ? 'Овуляция' : 'Лютеиновая'} — {periodInfo.note}
            {periodInfo.phase === 'luteal' && <div style={{ marginTop: 4, fontSize: 10, color: '#fff' }}>HIIT/MISS → zone2.</div>}
          </div>
        )}
        <div style={ROW}>
          <button style={BTN_SMALL} onClick={applyPeriodAware} disabled={!periodStart || !cycle} title="Заменить HIIT/MISS на zone2">🌸 Коррекция по циклу</button>
          <span style={HINT_SM}>Одноразово, с undo, только будущие недели.</span>
        </div>
      </Accordion>
    </div>
  );
};

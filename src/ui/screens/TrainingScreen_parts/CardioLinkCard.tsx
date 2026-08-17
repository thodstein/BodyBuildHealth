/**
 * CardioLinkCard.tsx — интеграционная карточка «Кардио» для силовых
 * конструкторов (ПЛ-авто/ББ-авто/ручной). Читает cardio-bridge (ссылка),
 * показывает подключённый цикл, «Сегодня» по startDate, следующую сессию,
 * факт дня и нагрузку (сила+кардио), позволяет открыть кардио-конструктор,
 * пересчитать цикл под текущий ACWR (adaptCardioToStrength) и отключить.
 * Сам кардио-цикл хранится отдельно — копия не создаётся.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { getCardioLink, clearCardioLink, subscribeCardioLink, SPORT_LABELS } from '../../../engines/lms/cardio-bridge';
import {
  loadCardioCycles, saveCardioCycle, setActiveCardioCycle, adaptCardioToStrength,
  cardioSessionsForDate, cardioNextSession, cardioEquipmentLabel, legDaysFromBBPlan,
  type CardioCycle, type CardioType,
} from '../../../engines/lms/cardio.engine';
import { cardioDayLoad, loadCardioLog } from '../../../engines/lms/cardio-diary.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../../../engines/pro/training-load.engine';
import { loadSavedBBPlans } from './bb-plans-store';
import { CARD, ROW, BTN, BTN_PRIMARY, BTN_DANGER } from './CardioUI';

const TYPE_LABEL: Record<CardioType, string> = { zone2: 'Zone 2', hiit: 'HIIT', miss: 'MISS', recovery: 'Recovery' };

function openCardioConstructor(): void {
  try { localStorage.setItem('he_training_planning_track', 'cardio'); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'cardio' }));
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const CardioLinkCard: React.FC = () => {
  const [link, setLink] = useState(getCardioLink());
  const [cycleName, setCycleName] = useState<string | null>(null);
  const [todayText, setTodayText] = useState<string | null>(null);
  const [nextText, setNextText] = useState<string | null>(null);
  const [dayLoad, setDayLoad] = useState<ReturnType<typeof cardioDayLoad> | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const un = subscribeCardioLink(l => setLink(l));
    return un;
  }, []);
  useEffect(() => {
    if (!link) { setCycleName(null); setTodayText(null); setNextText(null); setDayLoad(null); return; }
    const c = loadCardioCycles().find(x => x.id === link.cycleId);
    setCycleName(c?.name ?? link.cycleId);
    if (!c) { setTodayText(null); setNextText(null); setDayLoad(null); return; }
    try {
      const iso = todayIso();
      const t = cardioSessionsForDate(c, iso, c.startDate);
      setTodayText(t && t.sessions.length > 0
        ? t.sessions.map(s => `${s.type.toUpperCase()} ${s.durationMin} мин${s.equipment ? ' · ' + cardioEquipmentLabel(s.equipment) : ''}${s.targetHr?.max ? ' · ЧСС ' + s.targetHr.min + '-' + s.targetHr.max : ''}`).join(' · ')
        : null);
      const n = cardioNextSession(c, iso, c.startDate);
      setNextText(n ? `нед ${n.week} · ${TYPE_LABEL[n.session.type]} ${n.session.durationMin} мин` : null);
      const log = loadCardioLog();
      const srpe = loadSRPESessions();
      setDayLoad(cardioDayLoad(c, log, srpe, iso, c.startDate));
    } catch { setTodayText(null); setNextText(null); setDayLoad(null); }
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
    // Авто-учёт дней ног из последнего сохранённого ББ-плана (5B).
    let legDays = 0;
    let legDaysNote = '';
    try {
      const saved = loadSavedBBPlans();
      if (saved.length > 0) {
        legDays = legDaysFromBBPlan(saved[0].plan);
        legDaysNote = legDays > 0 ? ` · дней ног: ${legDays}` : '';
      }
    } catch { /* ignore */ }
    const adapted = adaptCardioToStrength(c, { acwr, legDaysPerWeek: legDays });
    saveCardioCycle(adapted);
    setActiveCardioCycle(adapted);
    flashMsg(acwr != null
      ? `✅ Кардио адаптировано под ACWR ${acwr.toFixed(2)}${legDaysNote}`
      : `✅ Кардио пересчитано (ACWR нет — объём сохранён)${legDaysNote}`);
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
      {todayText && (
        <div style={{ fontSize: 10, color: '#4ade80', background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)', borderRadius: 8, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span>🔔 Сегодня: {todayText}</span>
          <button style={{ ...BTN_PRIMARY, minHeight: 26, padding: '3px 8px', fontSize: 10 }} onClick={openCardioConstructor} aria-label="Начать сессию в дневнике">▶ Старт</button>
        </div>
      )}
      {nextText && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
          ⏭ Следующая сессия: {nextText}
        </div>
      )}
      {dayLoad && (dayLoad.cardioMinutes > 0 || dayLoad.strengthSessions > 0) && (
        <div style={{ fontSize: 10, color: '#fbbf24' }}>
          🔥 Нагрузка дня: кардио {dayLoad.cardioMinutes} мин · сила {dayLoad.strengthSessions} сесс. · итого {dayLoad.totalLoad}
        </div>
      )}
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

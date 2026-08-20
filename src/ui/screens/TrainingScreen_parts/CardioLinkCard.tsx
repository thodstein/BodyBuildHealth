/**
 * CardioLinkCard.tsx — интеграционная карточка «Кардио» для силовых
 * конструкторов (ПЛ-авто/ББ-авто/ручной). Читает cardio-bridge (ссылка),
 * показывает подключённый цикл, «Сегодня» по startDate, следующую сессию,
 * факт дня и нагрузку (сила+кардио), позволяет открыть кардио-конструктор,
 * пересчитать цикл под текущий ACWR (adaptCardioToStrength) и отключить.
 * Сам кардио-цикл хранится отдельно — копия не создаётся.
 *
 * Проп `onOpenCardio?: () => void`: если передан, кнопки «▶ Старт» и
 * «🛠 Открыть кардио-конструктор» вызывают его вместо переключения внешнего
 * трека (используется ручным конструктором, где кардио-конструктор открыт
 * в модале внутри редактора). Без пропа — прежнее поведение (внешний трек).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { getCardioLink, clearCardioLink, subscribeCardioLink, SPORT_LABELS } from '../../../engines/lms/cardio-bridge';
import {
  loadCardioCycles, saveCardioCycle, setActiveCardioCycle, adaptCardioToStrength,
  cardioSessionsForDate, cardioNextSession, cardioEquipmentLabel, legDaysFromBBPlan,
  compareCardioCycles, formatCardioComparison, saveCardioCycleVersion,
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

export const CardioLinkCard: React.FC<{ onOpenCardio?: () => void }> = ({ onOpenCardio }) => {
  const openCardio = onOpenCardio ?? openCardioConstructor;
  const [link, setLink] = useState(getCardioLink());
  const [cycleName, setCycleName] = useState<string | null>(null);
  const [todayText, setTodayText] = useState<string | null>(null);
  const [nextText, setNextText] = useState<string | null>(null);
  const [dayLoad, setDayLoad] = useState<ReturnType<typeof cardioDayLoad> | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  // E4: дифф-подтверждение перед пересчётом — расчёт показывается, применяется по кнопке.
  const [pendingDiff, setPendingDiff] = useState<{
    before: CardioCycle; after: CardioCycle; acwr: number | null; legDaysNote: string; diffText: string; unchanged: boolean;
  } | null>(null);

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
    const cmp = compareCardioCycles(c, adapted);
    const unchanged = cmp.diffs.length === 0;
    setPendingDiff({
      before: c, after: adapted, acwr, legDaysNote,
      diffText: formatCardioComparison(cmp),
      unchanged,
    });
    // Идентичные сценарии сохранять не нужно — сразу сообщаем.
    if (unchanged) flashMsg(acwr != null
      ? `✅ Кардио уже соответствует ACWR ${acwr.toFixed(2)} — изменений нет${legDaysNote}`
      : '✅ Кардио уже оптимально (ACWR нет — объём сохранён)');
  }, [link]);

  const applyRecalc = useCallback(() => {
    if (!pendingDiff) return;
    // Снапшот ДО пересчёта — для undo в конструкторе («↩ Вернуть версию»).
    saveCardioCycleVersion(pendingDiff.before, 'До пересчёта под ACWR');
    saveCardioCycle(pendingDiff.after);
    setActiveCardioCycle(pendingDiff.after);
    flashMsg(pendingDiff.acwr != null
      ? `✅ Кардио адаптировано под ACWR ${pendingDiff.acwr.toFixed(2)}${pendingDiff.legDaysNote}`
      : `✅ Кардио пересчитано (ACWR нет — объём сохранён)${pendingDiff.legDaysNote}`);
    setPendingDiff(null);
  }, [pendingDiff]);

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
      {pendingDiff && !pendingDiff.unchanged && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.35)', borderRadius: 8, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontWeight: 700, color: '#93c5fd' }}>🔄 Пересчёт под ACWR{pendingDiff.acwr != null ? ` (${pendingDiff.acwr.toFixed(2)})` : ''}{pendingDiff.legDaysNote} — что изменится:</div>
          <div style={{ color: 'rgba(255,255,255,0.75)' }} role="status">{pendingDiff.diffText}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button style={BTN_PRIMARY} onClick={applyRecalc} aria-label="Применить пересчёт кардио">✅ Применить</button>
            <button style={BTN} onClick={() => setPendingDiff(null)} aria-label="Отменить пересчёт кардио">✕ Отмена</button>
          </div>
        </div>
      )}
      {todayText && (
        <div style={{ fontSize: 10, color: '#4ade80', background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)', borderRadius: 8, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span>🔔 Сегодня: {todayText}</span>
          <button style={{ ...BTN_PRIMARY, minHeight: 26, padding: '3px 8px', fontSize: 10 }} onClick={openCardio} aria-label="Начать сессию в дневнике">▶ Старт</button>
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
        <button style={BTN} onClick={openCardio}>🛠 Открыть кардио-конструктор</button>
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

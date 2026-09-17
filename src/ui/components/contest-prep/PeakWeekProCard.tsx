/**
 * PeakWeekProCard.tsx — PRO-4: UI про-слоя тапера (монитор пик-недели,
 * экстренная карточка шоу-дня, лабы-чекпоинт, серия шоу, коуч-проверка).
 *
 * Чистая подача поверх bb-peak-pro.engine / bb-show-coach.engine; хранение —
 * собственные ключи движка (he_prep_peak_days_v1 / he_prep_emergency_v1 /
 * he_prep_labs_v1). Существующие контуры не меняются: компоненты самодостаточны
 * и монтируются в «🏁 Тапер» и шаг contest ББ-авто.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  isoToday, isoDiffDays,
  type BBContestPrepPlan, type BBContestPrepConfig, type PeakWeekDayPlan,
} from '../../../engines/bb/bb-contest-prep.engine';
import { planTwoShowSequence } from '../../../engines/bb/bb-contest-prep.engine';
import type { BBPlan } from '../../../engines/bb/bb-types';
import {
  loadPeakWeekLog, savePeakWeekEntry, removePeakWeekEntry,
  peakWeekAdherence, peakWeekWeightTrace, peakWeekTrendAdvice, buildPeakDayTimeline,
  PEAK_MONITOR_DISCLAIMER,
  SHOW_DAY_EMERGENCY, loadEmergencyContact, saveEmergencyContact,
  prepLabCheckpoint, loadPrepLabsDate, savePrepLabsDate,
  showSequencePlan, femalePeakGuidance,
  type PeakDayVisual,
} from '../../../engines/bb/bb-peak-pro.engine';
import { scoreBBShowPrep, recommendBBShowConfig } from '../../../engines/bb/bb-show-coach.engine';

const CARD: React.CSSProperties = {
  padding: 12, borderRadius: 14,
  background: 'linear-gradient(180deg, rgba(28,28,32,0.96), rgba(20,20,23,0.92))',
  border: '1px solid rgba(255,255,255,0.07)', marginBottom: 10,
};
const TITLE: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 };
const HINT: React.CSSProperties = { fontSize: 9, color: '#fff', lineHeight: 1.5 };
const IN: React.CSSProperties = {
  minHeight: 44, padding: '8px 10px', borderRadius: 10, fontSize: 12,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
};
const BTN: React.CSSProperties = {
  minHeight: 44, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 11,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff',
};
const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999,
  fontSize: 9, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
};
const fmtShort = (iso: string): string => (iso && iso.length === 10 ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}` : iso);

const VISUAL_META: Array<{ id: PeakDayVisual; label: string; color: string }> = [
  { id: 'flat', label: 'Плоско', color: '#f59e0b' },
  { id: 'ontrack', label: 'Норма', color: '#4ade80' },
  { id: 'full', label: 'Полно', color: '#60a5fa' },
  { id: 'spill', label: 'Расплыло', color: '#f87171' },
];

/** Локальное чтение журнала цикла (he_cycle_log, формат планировщика — массив ISO-дат). */
function readCycleLog(): string[] {
  try {
    const raw = localStorage.getItem('he_cycle_log');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)).sort() : [];
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════════════════
// 📓 Монитор пик-недели
// ═══════════════════════════════════════════════════════════════════════════

export const PeakWeekMonitorCard: React.FC<{
  planId: string;
  peakDays: PeakWeekDayPlan[];
  plan?: BBContestPrepPlan | null;
}> = ({ planId, peakDays, plan }) => {
  const [tick, setTick] = useState(0);
  const today = isoToday();
  const todayDay = (peakDays || []).find(d => d.date === today) ?? null;
  const log = useMemo(() => (planId ? loadPeakWeekLog(planId) : []), [planId, tick]);
  const adherence = useMemo(() => peakWeekAdherence(plan ?? (peakDays || []), log), [plan, peakDays, log]);
  const trace = useMemo(() => peakWeekWeightTrace(log), [log]);
  const trend = useMemo(() => peakWeekTrendAdvice(log), [log]);
  const timeline = useMemo(() => (todayDay ? buildPeakDayTimeline(todayDay) : null), [todayDay?.date]);

  const existing = useMemo(() => log.find(e => e.date === today) ?? null, [log, today]);
  const [weight, setWeight] = useState('');
  const [water, setWater] = useState('');
  const [sodium, setSodium] = useState('');
  const [carbs, setCarbs] = useState('');
  const [note, setNote] = useState('');
  const [visual, setVisual] = useState<PeakDayVisual | null>(null);
  const [wellbeing, setWellbeing] = useState<number | null>(null);
  useEffect(() => {
    setWeight(existing?.weightKg != null ? String(existing.weightKg) : '');
    setWater(existing?.waterLiters != null ? String(existing.waterLiters) : '');
    setSodium(existing?.sodiumMg != null ? String(existing.sodiumMg) : '');
    setCarbs(existing?.carbsG != null ? String(existing.carbsG) : '');
    setNote(existing?.note ?? '');
    setVisual(existing?.visual ?? null);
    setWellbeing(existing?.wellbeing ?? null);
  }, [existing?.date, tick, planId]);

  if (!planId || !(peakDays || []).length) {
    return (
      <div style={CARD} data-bb="peak-monitor">
        <div style={TITLE}>📓 Монитор пик-недели</div>
        <div style={HINT}>Соберите и примените план подготовки — здесь появится ежедневный чек-ин (вес, вода/натрий/углеводы, визуал) с тренд-советами.</div>
      </div>
    );
  }

  const female = plan?.sex === 'female' && plan;
  const cycleLog = female ? readCycleLog() : [];
  const avgLen = cycleLog.length >= 2
    ? (() => { const d = isoDiffDays(cycleLog[cycleLog.length - 2], cycleLog[cycleLog.length - 1]); return d >= 21 && d <= 35 ? d : null; })()
    : null;
  const femaleGuide = female ? femalePeakGuidance(plan as BBContestPrepPlan, { lastPeriodStartIso: cycleLog[cycleLog.length - 1] ?? null, averageCycleDays: avgLen }) : null;

  const saveToday = () => {
    const num = (v: string): number | null => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
    const ok = savePeakWeekEntry(planId, {
      date: today,
      weightKg: num(weight), waterLiters: num(water), sodiumMg: num(sodium), carbsG: num(carbs),
      visual, wellbeing, note: note.trim() || undefined,
      at: new Date().toISOString(),
    });
    if (ok) setTick(t => t + 1);
  };

  const trendColor = trend.status === 'flat' ? '#f59e0b' : trend.status === 'spill' ? '#f87171' : trend.status === 'weight_drop' ? '#fbbf24' : trend.status === 'on_track' ? '#4ade80' : '#60a5fa';

  return (
    <div style={CARD} data-bb="peak-monitor">
      <div style={TITLE}>
        📓 Монитор пик-недели
        <span style={{ ...chip, marginLeft: 'auto', background: todayDay ? 'rgba(245,158,11,0.16)' : 'rgba(255,255,255,0.05)', borderColor: todayDay ? 'rgba(245,158,11,0.4)' : undefined }}>
          {todayDay ? `${todayDay.phase === 'show' ? 'шоу-день' : `D-${7 - todayDay.day}`} · ${todayDay.phaseLabel}` : 'вне пик-недели'}
        </span>
      </div>

      {todayDay ? (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <input data-bb="pm-weight" style={{ ...IN, width: 92 }} type="number" inputMode="decimal" step={0.1} placeholder="Вес кг" aria-label="Вес" value={weight} onChange={e => setWeight(e.target.value)} />
            <input data-bb="pm-water" style={{ ...IN, width: 104 }} type="number" inputMode="decimal" step={0.1} placeholder={`Вода л (план ${todayDay.waterLiters})`} aria-label="Вода литры" value={water} onChange={e => setWater(e.target.value)} />
            <input data-bb="pm-sodium" style={{ ...IN, width: 112 }} type="number" inputMode="numeric" step={50} placeholder={`Na мг (план ${todayDay.sodiumMg})`} aria-label="Натрий мг" value={sodium} onChange={e => setSodium(e.target.value)} />
            <input data-bb="pm-carbs" style={{ ...IN, width: 112 }} type="number" inputMode="numeric" step={10} placeholder={`Углеводы г (план ${todayDay.carbsG})`} aria-label="Углеводы граммы" value={carbs} onChange={e => setCarbs(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {VISUAL_META.map(v => (
              <button
                key={v.id}
                type="button"
                data-bb={`pm-visual-${v.id}`}
                aria-pressed={visual === v.id}
                onClick={() => setVisual(visual === v.id ? null : v.id)}
                style={{
                  ...BTN, padding: '8px 12px',
                  background: visual === v.id ? `${v.color}26` : 'rgba(255,255,255,0.04)',
                  borderColor: visual === v.id ? v.color : 'rgba(255,255,255,0.12)',
                  color: visual === v.id ? v.color : '#fff',
                }}
              >{v.label}</button>
            ))}
            <span style={{ ...chip, alignSelf: 'center' }}>Самочувствие:</span>
            {[1, 2, 3, 4, 5].map(v => (
              <button
                key={v}
                type="button"
                data-bb={`pm-well-${v}`}
                aria-pressed={wellbeing === v}
                onClick={() => setWellbeing(wellbeing === v ? null : v)}
                style={{ ...BTN, minWidth: 44, padding: '8px 0', background: wellbeing === v ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.04)', borderColor: wellbeing === v ? '#60a5fa' : 'rgba(255,255,255,0.12)' }}
              >{v}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input data-bb="pm-note" style={{ ...IN, flex: 1 }} placeholder="Заметка (сон, ЖКТ, самочувствие)" aria-label="Заметка дня" value={note} onChange={e => setNote(e.target.value)} />
            <button data-bb="pm-save" style={{ ...BTN, background: 'linear-gradient(135deg,#fbbf24,#d97706)', color: '#000', border: 'none' }} onClick={saveToday}>
              {existing ? '💾 Обновить' : '💾 Сохранить'}
            </button>
            {existing && (
              <button data-bb="pm-remove" style={{ ...BTN, borderColor: 'rgba(248,113,113,0.4)', color: '#f87171' }} onClick={() => { removePeakWeekEntry(planId, today); setTick(t => t + 1); }}>✕</button>
            )}
          </div>
        </>
      ) : (
        <div style={{ ...HINT, marginBottom: 8 }}>
          Сегодня ({fmtShort(today)}) вне окна пик-недели. Первый день: {fmtShort(peakDays[0]?.date ?? '')} · шоу: {fmtShort(peakDays[peakDays.length - 1]?.date ?? '')}.
        </div>
      )}

      {/* Тренд-совет */}
      <div data-bb="pm-trend" style={{ padding: 8, borderRadius: 10, background: `${trendColor}14`, border: `1px solid ${trendColor}44`, marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: trendColor, marginBottom: 2 }}>
          {trend.status === 'flat' ? '🫧 Тренд: плоский' : trend.status === 'spill' ? '💧 Тренд: расплывает' : trend.status === 'weight_drop' ? '📉 Тренд: просадка веса' : trend.status === 'on_track' ? '✅ Тренд: в коридоре' : '📓 Нет данных'}
        </div>
        {trend.advice.map((a, i) => <div key={i} style={HINT}>• {a}</div>)}
      </div>

      {/* Адгеренс */}
      {adherence.loggedDays > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={chip}>Дней записано: {adherence.loggedDays}/7</span>
            {adherence.waterPct != null && <span style={chip}>💧 {Math.round(adherence.waterPct * 100)}% плана</span>}
            {adherence.sodiumPct != null && <span style={chip}>🧂 {Math.round(adherence.sodiumPct * 100)}%</span>}
            {adherence.carbsPct != null && <span style={chip}>🍚 {Math.round(adherence.carbsPct * 100)}%</span>}
            {adherence.flags.includes('under_water') && <span style={{ ...chip, color: '#fbbf24', borderColor: 'rgba(251,191,36,0.4)' }}>⚠ недолив воды</span>}
            {adherence.flags.includes('over_sodium') && <span style={{ ...chip, color: '#f87171', borderColor: 'rgba(248,113,113,0.4)' }}>⚠ перебор натрия</span>}
            {adherence.flags.includes('under_carbs') && <span style={{ ...chip, color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)' }}>⚠ недобор углеводов</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {adherence.rows.map(r => {
              const e = log.find(x => x.date === r.date);
              const vis = VISUAL_META.find(v => v.id === e?.visual);
              return (
                <div key={r.date} data-bb="pm-history-row" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#fff', padding: '3px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ width: 34, color: '#fbbf24', fontWeight: 800 }}>{r.label === 'шоу-день' ? 'Шоу' : r.label}</span>
                  <span style={{ width: 38 }}>{fmtShort(r.date)}</span>
                  <span style={{ width: 56 }}>{e?.weightKg != null ? `${e.weightKg} кг` : '—'}</span>
                  <span style={{ width: 64 }}>{e?.waterLiters != null ? `💧${e.waterLiters}л` : '💧—'}</span>
                  <span style={{ width: 70 }}>{e?.carbsG != null ? `🍚${e.carbsG}г` : '🍚—'}</span>
                  {vis && <span style={{ ...chip, color: vis.color, borderColor: `${vis.color}66` }}>{vis.label}</span>}
                  {r.flags.includes('under_water') && <span style={{ color: '#fbbf24' }}>⚠вода</span>}
                  {r.flags.includes('over_sodium') && <span style={{ color: '#f87171' }}>⚠Na</span>}
                  {r.flags.includes('under_carbs') && <span style={{ color: '#f59e0b' }}>⚠угл</span>}
                </div>
              );
            })}
          </div>
          <div style={{ ...HINT, marginTop: 4 }}>{trace.expected}</div>
        </div>
      )}

      {/* Таймлайн дня */}
      {todayDay && timeline && timeline.items.length > 0 && (
        <details data-bb="pm-timeline" style={{ marginBottom: 6 }}>
          <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>
            ⏱ День по часам ({todayDay.phase === 'show' ? 'шоу-день' : `D-${7 - todayDay.day}`})
          </summary>
          <div style={{ marginTop: 6 }}>
            {timeline.items.map((it, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '46px 1fr', gap: 6, fontSize: 10, padding: '3px 0', borderTop: i ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <span style={{ color: '#fbbf24', fontWeight: 800 }}>{it.time}</span>
                <span style={{ color: '#fff' }}><b>{it.action}</b><span style={{ display: 'block', ...HINT }}>{it.detail}</span></span>
              </div>
            ))}
            <div style={{ ...HINT, marginTop: 4 }}>{timeline.note}</div>
          </div>
        </details>
      )}

      {/* Женский контур */}
      {femaleGuide && (
        <div data-bb="female-peak" style={{ marginTop: 6, padding: 8, borderRadius: 10, background: 'rgba(244,114,182,0.06)', border: '1px solid rgba(244,114,182,0.25)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#f472b6', marginBottom: 2 }}>
            👩 Цикл и вода
            {femaleGuide.showCycleDay != null && <span style={{ ...chip, marginLeft: 6, borderColor: 'rgba(244,114,182,0.4)', color: '#f472b6' }}>шоу ≈ день {femaleGuide.showCycleDay} ({femaleGuide.showPhase})</span>}
          </div>
          {femaleGuide.notes.map((n, i) => (
            <div key={i} style={{ ...HINT, color: n.severity === 'warn' ? '#fbbf24' : n.severity === 'ok' ? '#4ade80' : '#fff' }}>{n.severity === 'warn' ? '⚠ ' : n.severity === 'ok' ? '✓ ' : '• '}{n.text}</div>
          ))}
        </div>
      )}

      <div style={{ ...HINT, marginTop: 6, opacity: 0.9 }}>{PEAK_MONITOR_DISCLAIMER}</div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🚑 Экстренная карточка шоу-дня
// ═══════════════════════════════════════════════════════════════════════════

export const ShowDayEmergencyCard: React.FC = () => {
  const [contact, setContact] = useState(() => loadEmergencyContact() ?? { name: '', phone: '' });
  const [savedTick, setSavedTick] = useState(0);
  const save = () => {
    saveEmergencyContact(contact.name.trim() || contact.phone.trim() ? { name: contact.name.trim(), phone: contact.phone.trim() } : null);
    setSavedTick(t => t + 1);
  };
  return (
    <div style={{ ...CARD, borderTop: '2px solid rgba(248,113,113,0.5)' }} data-bb="show-emergency">
      <div style={{ ...TITLE, color: '#f87171' }}>🚑 Экстренная карточка шоу-дня</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input data-bb="em-name" style={{ ...IN, flex: 1 }} placeholder="Контакт (кто рядом)" aria-label="Экстренный контакт" value={contact.name} onChange={e => setContact(c => ({ ...c, name: e.target.value }))} />
        <input data-bb="em-phone" style={{ ...IN, width: 140 }} placeholder="Телефон" aria-label="Телефон экстренного контакта" value={contact.phone} onChange={e => setContact(c => ({ ...c, phone: e.target.value }))} />
        <button data-bb="em-save" style={BTN} onClick={save}>{savedTick > 0 ? '✅' : '💾'}</button>
      </div>
      {SHOW_DAY_EMERGENCY.map(s => (
        <details key={s.id} data-bb="em-scenario" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>⛑ {s.title}</summary>
          <div style={{ padding: '0 0 8px 4px' }}>
            <div style={HINT}>Признаки: {s.signs.join(' · ')}</div>
            <div style={{ ...HINT, color: '#4ade80' }}>{s.do.map(d => `✓ ${d}`).join(' · ')}</div>
            <div style={{ ...HINT, color: '#f87171' }}>{s.dont.map(d => `✕ ${d}`).join(' · ')}</div>
            <div style={{ ...HINT, color: '#fbbf24' }}>🚨 {s.call}</div>
          </div>
        </details>
      ))}
      <div style={{ ...HINT, marginTop: 6 }}>Печатайте эту карточку вместе с prep-сводкой: при спутанности/судорогах — это неотложная помощь, не «плохая форма».</div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🧪 Лабы-чекпоинт
// ═══════════════════════════════════════════════════════════════════════════

const LAB_STATUS_COLOR: Record<string, string> = {
  done: '#4ade80', soon: '#fbbf24', overdue: '#f87171', planned: '#60a5fa', no_data: '#fff',
};
const LAB_STATUS_RU: Record<string, string> = {
  done: 'сдано', soon: 'скоро', overdue: 'просрочено', planned: 'план', no_data: 'нет данных',
};

export const PrepLabsCard: React.FC<{ planId: string; showDate: string }> = ({ planId, showDate }) => {
  const [date, setDate] = useState(() => (planId ? loadPrepLabsDate(planId) ?? '' : ''));
  useEffect(() => { setDate(planId ? loadPrepLabsDate(planId) ?? '' : ''); }, [planId]);
  const res = useMemo(() => prepLabCheckpoint(showDate, date || null), [showDate, date]);
  if (!planId || !showDate) return null;
  return (
    <div style={CARD} data-bb="prep-labs">
      <div style={TITLE}>🧪 Чекпоинты анализов</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ ...HINT, whiteSpace: 'nowrap' }}>Последние анализы:</span>
        <input
          data-bb="labs-date"
          type="date"
          style={{ ...IN, flex: 1 }}
          aria-label="Дата последних анализов"
          value={date}
          onChange={e => { setDate(e.target.value); savePrepLabsDate(planId, e.target.value || null); }}
        />
      </div>
      {res.rows.map(r => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, padding: '4px 0', borderTop: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}>
          <span style={{ ...chip, color: LAB_STATUS_COLOR[r.status], borderColor: `${LAB_STATUS_COLOR[r.status]}55`, minWidth: 74, justifyContent: 'center' }}>{LAB_STATUS_RU[r.status]}</span>
          <span style={{ flex: 1 }}>{r.label}<span style={{ display: 'block', ...HINT }}>{r.when} · срок {fmtShort(r.deadlineIso)}</span></span>
        </div>
      ))}
      <div style={{ ...HINT, marginTop: 4, color: res.rows.some(r => r.status === 'overdue') ? '#fbbf24' : '#fff' }}>{res.summary}</div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🏁 Серия шоу
// ═══════════════════════════════════════════════════════════════════════════

export const ShowSeriesCard: React.FC<{
  shows: Array<{ id: string; name: string; date?: string; priority?: 'A' | 'B' | 'C' }>;
  builtPlan?: BBPlan | null;
  onPlanChange?: (plan: BBPlan) => void;
  flash?: (msg: string) => void;
}> = ({ shows, builtPlan, onPlanChange, flash }) => {
  const seq = useMemo(() => showSequencePlan(shows || []), [shows]);
  if (!(shows || []).length) return null;
  const applyOverreach = () => {
    if (!builtPlan || !onPlanChange) return;
    const peakWk = (builtPlan.weeks as any[]).find(w => w.peakWeek)?.week ?? builtPlan.weeks.length;
    try {
      const { plan, applied, notes } = planTwoShowSequence(builtPlan as any, [{ weekNumber: peakWk }]);
      if (applied > 0) {
        onPlanChange(plan as BBPlan);
        flash?.(notes.join(' · ') || '⚡ Overreach-неделя применена');
      } else {
        flash?.('Overreach не применён: неделя уже разгружена или не найдена');
      }
    } catch { flash?.('Overreach не применён'); }
  };
  return (
    <div style={CARD} data-bb="show-series">
      <div style={TITLE}>🏁 Серия шоу <span style={{ ...chip, marginLeft: 'auto' }}>{seq.windows.length} с датой</span></div>
      {seq.windows.map(w => (
        <div key={w.showId} style={{ padding: '5px 0', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 10, color: '#fff' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <b>{w.priority === 'A' ? '★' : w.priority}</b>
            <span>{w.name}</span>
            <span style={chip}>📅 {fmtShort(w.date)}</span>
            <span style={chip}>taper {w.taperWeeks} нед (с {fmtShort(w.taperStartDate)})</span>
            <span style={{ ...chip, color: '#f472b6', borderColor: 'rgba(244,114,182,0.4)' }}>🎭 пик с {fmtShort(w.peakWeekStartDate)}</span>
          </div>
          <div style={HINT}>{w.note}</div>
        </div>
      ))}
      {seq.overreachNote && <div style={{ ...HINT, marginTop: 4, color: '#fbbf24' }}>{seq.overreachNote}</div>}
      {seq.warnings.map((w, i) => <div key={i} style={{ ...HINT, marginTop: 2, color: '#fbbf24' }}>⚠ {w}</div>)}
      {builtPlan && onPlanChange && seq.overreachDate && (
        <button data-bb="series-overreach" style={{ ...BTN, marginTop: 6 }} onClick={applyOverreach}>⚡ Overreach-неделя к основному шоу</button>
      )}
      <div style={{ ...HINT, marginTop: 4 }}>Два полных пика подряд запрещены: второе шоу в коротком окне — только по проверенным (trial) модам.</div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🧭 Коуч-проверка
// ═══════════════════════════════════════════════════════════════════════════

export const ShowCoachCard: React.FC<{
  plan: BBContestPrepPlan | null;
  onApply?: (patch: Partial<BBContestPrepConfig>) => void;
}> = ({ plan, onApply }) => {
  const verdict = useMemo(() => (plan ? scoreBBShowPrep({ plan }) : null), [plan]);
  const patch = useMemo(() => (plan ? recommendBBShowConfig(plan) : null), [plan]);
  if (!plan || !verdict) return null;
  const color = verdict.score >= 85 ? '#4ade80' : verdict.score >= 65 ? '#fbbf24' : verdict.score >= 40 ? '#f59e0b' : '#f87171';
  const patchEntries = patch ? Object.entries(patch).filter(([, v]) => v != null) : [];
  const patchRu: Record<string, (v: unknown) => string> = {
    waterStrategy: v => `вода → ${v}`,
    sodiumStrategy: v => `натрий → ${v}`,
    carbLoadStrategy: v => `карбс → ${v}`,
    trainingProtocol: v => `протокол → ${v}`,
  };
  return (
    <div style={CARD} data-bb="show-coach">
      <div style={TITLE}>🧭 Коуч-проверка плана</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 24, fontWeight: 800, color, minWidth: 52, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{verdict.score}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{verdict.label}</span>
      </div>
      {verdict.notes.slice(0, 3).map((n, i) => (
        <div key={i} style={{ ...HINT, color: n.severity === 'danger' ? '#f87171' : n.severity === 'warn' ? '#fbbf24' : n.severity === 'ok' ? '#4ade80' : '#fff' }}>
          {n.icon} {n.text}
        </div>
      ))}
      {verdict.actions.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {verdict.actions.slice(0, 3).map((a, i) => <div key={i} style={HINT}>→ {a}</div>)}
        </div>
      )}
      {patchEntries.length > 0 && (
        <div style={{ marginTop: 6, padding: 8, borderRadius: 10, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
          <div style={{ ...HINT, fontWeight: 800, marginBottom: 3 }}>Безопасный патч конфига (авто):</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {patchEntries.map(([k, v]) => (
              <span key={k} style={chip}>{patchRu[k] ? patchRu[k](v) : k}</span>
            ))}
          </div>
          {onApply && (
            <button data-bb="coach-apply" style={{ ...BTN, marginTop: 6 }} onClick={() => onApply(patch as Partial<BBContestPrepConfig>)}>Применить патч</button>
          )}
          {!onApply && <div style={{ ...HINT, marginTop: 3 }}>Патч применяется в блоке настроек протокола (вода/натрий/карбс).</div>}
        </div>
      )}
    </div>
  );
};

export default PeakWeekMonitorCard;

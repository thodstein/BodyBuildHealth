/**
 * CardioAnalyticsDashboard.tsx — мини-дашборд аналитики PRO (H3 + эпики B/D/E/F/G).
 * 7д vs 28д, TRIMP тренд, HR compliance, TID PI, durability, PMC daily, taper-pro, safety.
 */
import React, { useMemo } from 'react';
import { CARD, ROW, LABEL, HINT_SM, Badge, StatTile } from './CardioUI';
import { cardioLogStats, cardioHrCompliance, CARDIO_SPORT_RU, type CardioSport } from '../../../engines/lms/cardio-diary.engine';
import {
  cardioMonotonyStrain, cardioFactCtlSeries, cardioHrDrift, interferenceForCycle,
  timeInZones, polarizationIndex, classifyTid, tidPlanVsFact,
  dailyPmcSeries, tssRampRate, interpretTsb,
  aerobicDecoupling, heatAltitudeHrAdd, cardioInterferenceV2,
  dailyTrimpMap, dailyTrimpFromLogEntry, maxHrByFormula, cardioEntryLoad,
  cardioAnemiaSignals, cardioRestingHrSignal, durabilityTrend,
} from '../../../engines/lms/cardio.engine';
import { dateDaysAgo } from '../../../engines/lms/cardio-diary.engine';
import { getProfile } from '../../../core/profile-manager';
import type { CardioCycle } from '../../../engines/lms/cardio.engine';
import type { CardioLogEntry } from '../../../engines/lms/cardio-diary.engine';

export const CardioAnalyticsDashboard: React.FC<{ cycle: CardioCycle | null; log: CardioLogEntry[] }> = ({ cycle, log }) => {
  const s7 = useMemo(() => cardioLogStats(log, 7), [log]);
  const s28 = useMemo(() => cardioLogStats(log, 28), [log]);
  const hr = useMemo(() => {
    if (!cycle) return null;
    try { return cardioHrCompliance(cycle, log, { days: 28 }); } catch { return null; }
  }, [cycle, log]);

  // Единая модель ЧССмакс по конфигу цикла: раньше дашборд инлайнил
  // 220/226−age и игнорировал выбор пользователя (Tanaka/Gulati) — TRIMP/CTL
  // расходились с зонами плана.
  const cfgHr = useMemo(() => {
    const age = cycle?.config?.age;
    if (!age) return { maxHr: undefined as number | undefined, restHr: cycle?.config?.restingHr, sex: cycle?.config?.sex ?? 'male' as 'male' | 'female' };
    return {
      maxHr: maxHrByFormula(age, cycle?.config?.sex, (cycle?.config as { maxHrFormula?: 'classic' | 'tanaka' | 'gulati' }).maxHrFormula),
      restHr: cycle?.config?.restingHr,
      sex: cycle?.config?.sex ?? 'male' as 'male' | 'female',
    };
  }, [cycle]);

  // TRIMP 7д — канон dailyTrimpMap (Banister при HR+ЧСС покоя, иначе фактор).
  const trimp7 = useMemo(() => {
    const week = log.filter(e => e.completed && e.date >= dateDaysAgo(6));
    const map = dailyTrimpMap(week, cfgHr.restHr, cfgHr.maxHr, cfgHr.sex);
    let sum = 0;
    for (const v of map.values()) sum += Math.round(v);
    return sum;
  }, [log, cfgHr]);

  const delta = s28.minutes > 0 ? Math.round(((s7.minutes * 4 - s28.minutes) / s28.minutes) * 100) : 0;

  const polarized = useMemo(() => {
    if (!cycle) return null;
    const totalMin = cycle.weeks.reduce((s, w) => s + w.totalMinutes, 0);
    const intenseMin = cycle.weeks.reduce((s, w) => s + w.sessions.filter(x => x.type === 'hiit' || x.type === 'miss').reduce((a, x) => a + x.durationMin * x.weeklyFrequency, 0), 0);
    if (totalMin === 0) return null;
    const pct = Math.round((intenseMin / totalMin) * 100);
    const ok = pct <= 20;
    return { pct, ok, label: `${100 - pct}/${pct} · ${ok ? '✓ 80/20' : '⚠ >20% интенсива'}` };
  }, [cycle]);

  const monotony = useMemo(() => {
    if (log.length < 7) return null;
    const daily: number[] = [];
    const map = new Map<string, number>();
    // Единая шкала ACWR (канон cardioEntryLoad): было `мин × RPE/5` — вдвое
    // другая амплитуда, и «Monotony/Strain» были несравнимы с ACWR.
    for (const e of log.filter(x => x.completed)) map.set(e.date, (map.get(e.date) ?? 0) + cardioEntryLoad(e.durationMin, e.rpe));
    const dates = Array.from(map.keys()).sort();
    const last7 = dates.slice(-7);
    for (const d of last7) daily.push(map.get(d) ?? 0);
    if (daily.length < 3) return null;
    const m = cardioMonotonyStrain(daily);
    return { ...m, warn: m.monotony > 2 || m.strain > 6000 };
  }, [log]);

  const factCtl = useMemo(() => {
    if (log.length < 7) return null;
    try {
      const now = new Date();
      const ref = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const series = cardioFactCtlSeries(log, {
        restHr: cycle?.config?.restingHr,
        maxHr: cfgHr.maxHr,
        sex: cycle?.config?.sex,
        referenceIso: ref,
        days: 42,
      });
      if (series.length === 0) return null;
      return series[series.length - 1];
    } catch { return null; }
  }, [log, cycle]);

  const hrDriftNote = useMemo(() => {
    if (log.length < 2) return null;
    // Журнал отсортирован DESC (свежие первыми). Сравниваем РАННЮЮ из двух
    // последних HR-сессий с ПОСЛЕДНЕЙ: было first/second по индексу, то есть
    // (новая − предпредыдущая)/предпредыдущая — при росте пульса знак уходил
    // в минус и предупреждение о дрейфе не срабатывало никогда.
    const withHr = log.filter(e => e.completed && e.avgHr && e.avgHr > 0).slice(0, 2);
    if (withHr.length < 2) return null;
    const earlier = withHr[1].avgHr!; // вторая по свежести = более ранняя
    const latest = withHr[0].avgHr!;  // самая свежая
    const drift = cardioHrDrift(earlier, latest);
    return drift.warn ? `HR drift ${drift.driftPct}% >5% между последними HR-сессиями — признак утомления/обезвоживания` : null;
  }, [log]);

  const interference = useMemo(() => {
    if (!cycle) return null;
    try {
      const legPerWeek = cycle.config?.legDays ? cycle.config.legDays.filter(d => d >= 0 && d <= 6).length || 2 : 2;
      return interferenceForCycle(cycle, legPerWeek, cycle.config?.sex);
    } catch { return null; }
  }, [cycle]);

  // PRO: TID Polarization Index (Treff 2019) по плану цикла
  const tid = useMemo(() => {
    if (!cycle) return null;
    try {
      const tiz = timeInZones(cycle);
      const pi = polarizationIndex(tiz.pct.z1, tiz.pct.z2, tiz.pct.z3);
      const cls = classifyTid(tiz);
      return { ...tiz, pi, model: cls.model, label: cls.label };
    } catch { return null; }
  }, [cycle]);

  // P1-аудит: план по типам сессий ≠ факт по HR дневника. Сверяем честно.
  // Спринт 5.2: config.lthrBySport — эталон по дисциплинам (у бега и вела он разный).
  const tidFact = useMemo(() => {
    if (!cycle || !log.length) return null;
    try {
      const cfg = cycle.config as { lthr?: number; age?: number; sex?: 'male' | 'female'; lthrBySport?: Partial<Record<string, number>> } | undefined;
      const refsBySport: Record<string, { lthr: number }> = {};
      for (const [k, v] of Object.entries(cfg?.lthrBySport ?? {})) {
        if (Number.isFinite(v) && (v as number) > 0) refsBySport[k] = { lthr: Math.round(v as number) };
      }
      return tidPlanVsFact(cycle, log, { lthr: cfg?.lthr, age: cfg?.age, sex: cfg?.sex }, refsBySport);
    } catch { return null; }
  }, [cycle, log]);

  // PRO: PMC daily по факту (CTL/ATL/TSB) + рампа TSS.
  // Нагрузка дня — канон dailyTrimpFromLogEntry (Banister при HR, иначе фактор):
  // была inline-копия формулы с жёстким 220/226−age.
  const pmc = useMemo(() => {
    if (log.length < 7) return null;
    try {
      const daily = log.filter(e => e.completed).map(e => ({
        date: e.date,
        load: dailyTrimpFromLogEntry(e, cfgHr.restHr, cfgHr.maxHr, cfgHr.sex),
      }));
      const now = new Date();
      const ref = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const series = dailyPmcSeries(daily, { referenceIso: ref, days: 42 });
      if (series.length === 0) return null;
      const last = series[series.length - 1];
      const ramp = tssRampRate(daily, ref);
      return { ...last, rampPct: ramp.rampPct, rampWarn: ramp.warn, interp: interpretTsb(last.tsb) };
    } catch { return null; }
  }, [log, cfgHr]);

  // PRO: durability — decoupling по двум ПОСЛЕДНИМ HR-сессиям (Pa:Hr lite).
  // Журнал DESC (свежие первыми): берём первые две подходящие, а не
  // slice(-4) — тот забирал четыре САМЫХ СТАРЫХ записи журнала.
  const durability = useMemo(() => {
    const withHr = log.filter(e => e.completed && e.avgHr && e.avgHr > 0 && e.distanceKm && e.distanceKm > 0).slice(0, 2);
    if (withHr.length < 2) return null;
    try {
      const eff = (e: typeof withHr[number]) => (e.distanceKm as number) / (e.durationMin / 60) / (e.avgHr as number);
      const e1 = eff(withHr[1]); // более ранняя
      const e2 = eff(withHr[0]); // свежая
      if (!(e1 > 0) || !(e2 > 0)) return null;
      return aerobicDecoupling(e1, e2);
    } catch { return null; }
  }, [log]);

  // PRO: тренд durability по накопленным decoupling-точкам журнала (FIT-импорт).
  // P2-аудит: `durabilityTrend` был без потребителя, а decoupling из FIT
  // никуда не записывался — теперь журнал несёт точки, тренд считается.
  const durabilityTr = useMemo(() => {
    if (log.length < 2) return null;
    try {
      const points = log
        .filter(e => e.completed && Number.isFinite(e.decouplingPct) && e.durationMin >= 60)
        .map(e => ({ date: e.date, durationMin: e.durationMin, decouplingPct: e.decouplingPct as number }));
      if (points.length < 2) return null;
      return durabilityTrend(points);
    } catch { return null; }
  }, [log]);

  // PRO: safety жара/высота из конфига цикла
  const safety = useMemo(() => {
    if (!cycle) return null;
    try {
      const r = heatAltitudeHrAdd({ durationMin: 60, tempC: cycle.config?.tempC, humidityPct: cycle.config?.humidityPct, altitudeM: cycle.config?.altitudeM });
      return r.addBpm > 0 ? r : null;
    } catch { return null; }
  }, [cycle]);

  const interfV2 = useMemo(() => {
    if (!cycle) return null;
    try {
      const legPerWeek = cycle.config?.legDays ? cycle.config.legDays.filter(d => d >= 0 && d <= 6).length || 2 : 2;
      const mods = cycle.weeks.slice(0, 4).flatMap(w => w.sessions.map(s => (s.equipment ?? s.type) as string));
      return cardioInterferenceV2({ modality: mods.length ? mods : ['cycling'], frequencyPerWeek: 3, avgDurationMin: 30, legDaysPerWeek: legPerWeek, gap: 'separate_day', sex: cycle.config?.sex });
    } catch { return null; }
  }, [cycle]);

  // PRO: анемия/железодефицит из анализов профиля (P2-аудит: раньше здесь был
  // захардкожен текст про ферритин — движок cardioAnemiaSignals существовал,
  // но не получал анализы). Честное «нет данных» вместо общего совета.
  const anemia = useMemo(() => {
    try {
      const p = getProfile();
      const s = (p?.settings?.labs?.summary ?? {}) as Record<string, { value?: number }>;
      const pick = (names: string[]): number | undefined => {
        for (const k of Object.keys(s)) {
          if (names.includes(k.toUpperCase()) && Number.isFinite(s[k]?.value)) return Number(s[k].value);
        }
        return undefined;
      };
      const labs = {
        ferritin: pick(['FERRITIN']),
        hemoglobin: pick(['HGB', 'HB', 'HEMOGLOBIN']),
        hct: pick(['HCT', 'HEMATOCRIT']),
      };
      if (labs.ferritin == null && labs.hemoglobin == null && labs.hct == null) return null;
      return cardioAnemiaSignals(labs, cycle?.config?.sex);
    } catch { return null; }
  }, [cycle]);

  // PRO: ЧСС покоя по дневнику АД (утренние замеры) — тренд 7д vs 21д.
  const restHr = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('he_bp_diary') ?? '[]');
      const arr = Array.isArray(raw) ? raw : [];
      const entries: { date: string; hr: number }[] = [];
      for (const e of arr) {
        if (!e || typeof e.date !== 'string') continue;
        const hr = Number(e.pulse ?? e.hr);
        if (!(hr > 30 && hr < 140)) continue;
        if (e.timeOfDay != null && e.timeOfDay !== 'morning') continue;
        entries.push({ date: e.date, hr });
      }
      if (entries.length === 0) return null;
      return cardioRestingHrSignal(entries);
    } catch { return null; }
  }, []);

  return (
    <div className="train-cardiostats" style={CARD}>
      <div style={ROW}>
        <span style={LABEL}>Аналитика 7д / 28д</span>
        <Badge bg={delta >= 10 ? 'rgba(239,68,68,0.12)' : delta <= -10 ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)'} border={delta >= 10 ? 'rgba(239,68,68,0.24)' : delta <= -10 ? 'rgba(34,197,94,0.24)' : 'rgba(255,255,255,0.08)'} color={delta >= 10 ? '#f87171' : delta <= -10 ? '#4ade80' : '#fff'}>{delta > 0 ? '+' + delta + '%' : delta + '%'} к 28д</Badge>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <StatTile label="7Д МИН" value={String(s7.minutes)} color="#22c55e" sub={s7.sessions + ' сесс' + (s7.avgPace ? ' · ' + s7.avgPace : '')} />
        <StatTile label="28Д МИН" value={String(s28.minutes)} color="#3b82f6" sub={s28.sessions + ' сесс'} />
        <StatTile label="TRIMP 7Д" value={String(trimp7)} color="#a78bfa" sub="Banister/HR" />
        <StatTile label="HR в зоне" value={hr?.inZonePct != null ? hr.inZonePct + '%' : '—'} color={hr?.inZonePct != null && hr.inZonePct >= 70 ? '#4ade80' : '#fbbf24'} sub={hr?.avgDelta != null ? (hr.avgDelta > 0 ? '+' : '') + hr.avgDelta + ' уд' : ''} />
        {polarized && <StatTile label="80/20" value={polarized.pct + '%'} color={polarized.ok ? '#4ade80' : '#fbbf24'} sub={polarized.label} />}
        {tid && tid.pi != null && <StatTile label="POL-IDX" value={String(tid.pi)} color={tid.model === 'polarized' ? '#4ade80' : tid.model === 'pyramidal' ? '#60a5fa' : '#fbbf24'} sub={tid.model} />}
        {pmc && <StatTile label="TSB" value={(pmc.tsb > 0 ? '+' : '') + pmc.tsb} color={pmc.tsb > 15 || pmc.tsb < -10 ? '#f87171' : pmc.tsb > 5 ? '#4ade80' : '#fff'} sub={`CTL ${pmc.ctl}`} />}
        {durability && <StatTile label="DECOUPL" value={durability.decouplingPct + '%'} color={durability.level === 'strong' ? '#4ade80' : durability.level === 'moderate' ? '#fbbf24' : '#f87171'} sub={durability.level} />}
        {interference && <StatTile label="INTERF." value={String(interference.score)} color={interference.level === 'low' ? '#4ade80' : interference.level === 'mid' ? '#fbbf24' : '#f87171'} sub={interference.level} />}
      </div>
      {hr?.advice && <div style={{ fontSize: 11.5, color: '#fff', background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: '3px solid rgba(255,255,255,0.25)', borderRadius: 10, padding: '8px 11px', lineHeight: 1.5 }}>{hr.advice}</div>}
      {polarized && !polarized.ok && <div style={{ fontSize: 11.5, color: '#fbbf24', background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.26)', borderLeft: '3px solid #f59e0b', borderRadius: 10, padding: '8px 11px', lineHeight: 1.5 }}>⚠ Поляризация {polarized.pct}% интенсива — по Seiler держите ≤20% HIIT/MISS, остальное Zone2.</div>}
      {monotony && (
        <div style={{ fontSize: 11.5, color: monotony.warn ? '#f87171' : '#4ade80', background: monotony.warn ? 'rgba(239,68,68,0.09)' : 'rgba(0,230,138,0.09)', border: `1px solid ${monotony.warn ? 'rgba(239,68,68,0.28)' : 'rgba(0,230,138,0.28)'}`, borderLeft: `3px solid ${monotony.warn ? '#ef4444' : '#00e68a'}`, borderRadius: 10, padding: '8px 11px', fontVariantNumeric: 'tabular-nums', lineHeight: 1.5 }}>
          {monotony.warn ? '⚠' : '✓'} Monotony {monotony.monotony} · Strain {monotony.strain} {monotony.warn ? '— варьируйте нагрузку (Foster)' : '— вариативность в норме'}
        </div>
      )}
      {factCtl && (
        <div style={{ fontSize: 11.5, color: Math.abs(factCtl.tsb) > 10 ? '#f87171' : factCtl.tsb > 5 ? '#4ade80' : '#fff', background: 'rgba(96,165,250,0.09)', border: '1px solid rgba(96,165,250,0.28)', borderLeft: '3px solid #60a5fa', borderRadius: 10, padding: '8px 11px', fontVariantNumeric: 'tabular-nums', lineHeight: 1.5 }}>
          📈 Факт CTL {factCtl.ctl} · ATL {factCtl.atl} · TSB {factCtl.tsb > 0 ? '+' : ''}{factCtl.tsb} {factCtl.tsb > 15 ? '— пик формы, снизьте объём' : factCtl.tsb < -10 ? '— перегруз, восстановитесь' : '— баланс'}
        </div>
      )}
      {hrDriftNote && <div style={{ fontSize: 11, color: '#fbbf24', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 8, padding: '6px 8px' }}>⚠ {hrDriftNote}</div>}
      {tid && <div style={{ fontSize: 11, color: '#fff', background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.22)', borderRadius: 8, padding: '6px 8px' }}>🧬 TID {tid.pct.z1}/{tid.pct.z2}/{tid.pct.z3} · PI {tid.pi ?? '—'} — {tid.label}. Новичкам — pyramidal, продвинутым к старту — polarized (PYR→POL).</div>}
      {tidFact && <div style={{ fontSize: 11, color: '#fff', background: tidFact.comparable ? (tidFact.drift > 12 ? 'rgba(239,68,68,0.08)' : 'rgba(74,222,128,0.07)') : 'rgba(255,255,255,0.02)', border: `1px solid ${tidFact.comparable ? (tidFact.drift > 12 ? 'rgba(239,68,68,0.24)' : 'rgba(74,222,128,0.22)') : 'rgba(255,255,255,0.06)'}`, borderRadius: 8, padding: '6px 8px' }}>📊 TID по факту (HR дневника) {tidFact.fact.pct.z1}/{tidFact.fact.pct.z2}/{tidFact.fact.pct.z3} против плана {tidFact.planned.pct.z1}/{tidFact.planned.pct.z2}/{tidFact.planned.pct.z3} — расхождение {tidFact.drift} п.п. {tidFact.verdict}</div>}
      {tidFact && tidFact.bySport.length > 1 && (
        <div style={{ fontSize: 11, color: '#fff', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 8px' }}>
          🚴 Разбивка факта по дисциплинам:{' '}
          {tidFact.bySport.map(b => `${CARDIO_SPORT_RU[b.sport as CardioSport] ?? b.sport} ${b.fact.pct.z1}/${b.fact.pct.z2}/${b.fact.pct.z3} (${b.fact.totalMin} мин${b.ownRef ? ', свой пульс' : ''})`).join(' · ')}
          {tidFact.mixed && !tidFact.hasPerSportRef ? ' — эталон пульса общий, зоны между дисциплинами несопоставимы' : ''}
        </div>
      )}
      {pmc && <div style={{ fontSize: 11, color: '#fff', background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.22)', borderRadius: 8, padding: '6px 8px' }}>📊 PMC daily: CTL {pmc.ctl} · ATL {pmc.atl} · TSB {pmc.tsb > 0 ? '+' : ''}{pmc.tsb} — {pmc.interp}{pmc.rampPct != null ? ` · Рампа ${pmc.rampPct}%/нед` : ''}{pmc.rampWarn ? ` · ⚠ ${pmc.rampWarn}` : ''}</div>}
      {durability && <div style={{ fontSize: 11, color: durability.level === 'strong' ? '#4ade80' : durability.level === 'moderate' ? '#fbbf24' : '#f87171', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 8px' }}>🏃 Durability decoupling {durability.decouplingPct}% ({durability.level}) — {durability.advice}</div>}
      {durabilityTr && (
        <div style={{ fontSize: 11, color: durabilityTr.trend === 'improving' ? '#4ade80' : durabilityTr.trend === 'worsening' ? '#f87171' : '#fff', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 8px' }} data-autotune="durability-trend">
          📊 Тренд durability (FIT-замеры): {durabilityTr.delta != null ? `${durabilityTr.delta > 0 ? '+' : ''}${durabilityTr.delta} п.п.` : '—'} — {durabilityTr.note}
        </div>
      )}
      {safety && <div style={{ fontSize: 11, color: '#fbbf24', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 8, padding: '6px 8px' }}>🌡 Жара/высота: +{safety.addBpm} уд/мин к зонам — {safety.notes.join(' ')}</div>}
      {interfV2 && interfV2.level !== 'low' && <div style={{ fontSize: 11, color: '#93c5fd', background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.22)', borderRadius: 8, padding: '6px 8px' }}>🔬 Interference v2 {interfV2.score}/10 ({interfV2.level}) — {interfV2.advice}</div>}
      {interference && interference.level !== 'low' && <div style={{ fontSize: 11, color: interference.level === 'high' ? '#f87171' : '#fbbf24', background: interference.level === 'high' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${interference.level === 'high' ? 'rgba(239,68,68,0.24)' : 'rgba(245,158,11,0.24)'}`, borderRadius: 8, padding: '6px 8px' }}>⚡ Interference {interference.score}/10 ({interference.level}) — {interference.advice}</div>}
      {anemia && anemia.warnings.length > 0 && (
        <div style={{ fontSize: 11, color: anemia.hbLow ? '#f87171' : '#fbbf24', background: anemia.hbLow ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${anemia.hbLow ? 'rgba(239,68,68,0.22)' : 'rgba(245,158,11,0.22)'}`, borderRadius: 8, padding: '6px 8px' }} data-autotune="anemia">
          🩸 {anemia.warnings.join(' ')}{anemia.hbLow ? ' Объём кардио −10%.' : ''}
        </div>
      )}
      {!anemia && (
        <div style={{ fontSize: 11, color: '#fff', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '6px 8px' }}>
          🩸 Анализов (ферритин/Hb/HCT) в профиле нет — железодефицит оценить нечем. При ферритине &lt;30 мкг/л — железо 18 мг + витамин C, контроль Hb.
        </div>
      )}
      {restHr && (restHr.warning || restHr.deltaPct != null) && (
        <div style={{ fontSize: 11, color: restHr.warning ? '#f87171' : '#fff', background: restHr.warning ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${restHr.warning ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 8, padding: '6px 8px' }}>
          💓 ЧСС покоя (АД, утро): 7д {restHr.avg7 != null ? restHr.avg7.toFixed(0) : '—'} · 21д {restHr.avg21 != null ? restHr.avg21.toFixed(0) : '—'} уд/мин{restHr.deltaPct != null ? ` (${restHr.deltaPct > 0 ? '+' : ''}${restHr.deltaPct.toFixed(1)}%)` : ''}{restHr.warning ? ` — ${restHr.warning}` : ''}
        </div>
      )}
      <div style={HINT_SM}>TRIMP Banister (HRr×k·e^b·HRr) где есть HR, иначе фактор. Рост &gt;15% за неделю — риск перегруза. 80/20 — Seiler polarized.</div>
    </div>
  );
};

/**
 * cb-camp-measurements.tsx — журналы и скрининги E8.
 *
 * Поверхность для `combat-measurements.engine.ts`. Принцип тот же, что у E4:
 * движок что-то посчитал — значит это видно на экране, с источником.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { SectionCard, Highlight, Badge, CombatPopupSelect } from './CombatUI';
import type { CombatPlan } from '../../../engines/combat/combat.types';
import {
  loadWeighIns, addWeighIn, removeWeighIn, weighTrajectory, cutDeviation,
  loadSparring, addSparring, removeSparring, sparringSummary, sparringJournalToLoad,
  leaScreen, sleepVerdict, heatProtocol,
  type SparType,
} from '../../../engines/combat/combat-measurements.engine';

const IN = 16;
const BTN: React.CSSProperties = { minHeight: 44, fontSize: IN, padding: '8px 12px' };
const BTN_GHOST: React.CSSProperties = { ...BTN, background: 'transparent' };
const inp = (v: string | number, ph: string) => ({
  fontSize: IN, minHeight: 44, padding: '8px 10px', width: '100%',
  background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12,
  placeholder: ph,
});

const TONE: Record<string, string> = { ok: '#22c55e', warn: '#f59e0b', danger: '#ef4444' };

function Line({ tone = 'ok', children }: { tone?: string; children: React.ReactNode }) {
  return <div style={{ color: TONE[tone] || TONE.ok, fontSize: 13, lineHeight: 1.45 }}>{children}</div>;
}

export const CbCampMeasurementsCard: React.FC<{
  plan: CombatPlan;
  /** Тренировочный расход, ккал/сут — для скрининга LEA. */
  trainingKcal?: number | null;
  /** Сон за ночь, ч. */
  sleepHours?: number | null;
  /** CAT2-опросник: число отмеченных симптомов. */
  cat2Flags?: number | null;
  /** Потребление, ккал/сут (из КБЖУ). */
  kcal?: number | null;
  /** Безжировая масса, кг. */
  ffmKg?: number | null;
  /** Сессий теплового протокола выполнено. */
  heatSessions?: number | null;
}> = ({ plan, trainingKcal, sleepHours, cat2Flags, kcal, ffmKg, heatSessions }) => {
  const snap: any = plan?.inputSnapshot || {};

  // ── журнал веса ──
  const [weighins, setWeighins] = useState<ReturnType<typeof loadWeighIns>>(() => loadWeighIns());
  const [wDate, setWDate] = useState('');
  const [wKg, setWKg] = useState('');
  const [wMsg, setWMsg] = useState<string | null>(null);
  const traj = useMemo(() => weighTrajectory(weighins), [weighins]);
  const dev = useMemo(() => cutDeviation(weighins, {
    startKg: snap?.bodyweightKg ?? snap?.bodyweight ?? null,
    targetKg: snap?.weightClassLimitKg ?? null,
    weeks: snap?.weeks ?? null,
    today: new Date().toISOString().slice(0, 10),
  }), [weighins, snap]);

  const onAddWeigh = useCallback(() => {
    const ok = addWeighIn(wDate, Number(wKg.replace(',', '.')));
    if (!ok) { setWMsg('⚠️ Нужны корректные дата и вес (20-400 кг).'); return; }
    setWDate(''); setWKg(''); setWMsg('✅ Запись добавлена');
    setWeighins(loadWeighIns());
  }, [wDate, wKg]);

  // ── журнал спарринга ──
  const [spar, setSpar] = useState<ReturnType<typeof loadSparring>>(() => loadSparring());
  const [sType, setSType] = useState<SparType>('hard');
  const [sRounds, setSRounds] = useState('5');
  const [sRpe, setSRpe] = useState('');
  const [sMsg, setSMsg] = useState<string | null>(null);
  const sparSummary = useMemo(() => sparringSummary(spar), [spar]);
  const sparLoad = useMemo(
    () => sparringJournalToLoad(spar, new Date().toISOString().slice(0, 10)),
    [spar],
  );

  const onAddSpar = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const ok = addSparring(today, sType, Number(sRounds), 5, sRpe ? Number(sRpe) : undefined);
    if (!ok) { setSMsg('⚠️ Проверьте раунды (1-15) и тип.'); return; }
    setSRpe(''); setSMsg('✅ Сессия записана');
    setSpar(loadSparring());
  }, [sType, sRounds, sRpe]);

  // ── скрининги ──
  const lea = useMemo(() => leaScreen({
    kcal, trainingKcal, ffmKg, cat2Flags, sex: snap?.sex,
  }), [kcal, trainingKcal, ffmKg, cat2Flags, snap?.sex]);
  const sleep = useMemo(() => sleepVerdict(sleepHours), [sleepHours]);
  const heat = useMemo(() => heatProtocol({
    sessionsDone: heatSessions,
    inWeightCut: !!(snap?.weightCutKg || snap?.weightCutProtocol),
    fightWeek: false,
  }), [heatSessions, snap]);

  return (
    <SectionCard title="Замеры, журналы и скрининги" accent>
      {/* 8.1 — журнал веса */}
      <div data-cb="measure-weigh" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        <Highlight>⚖️ Журнал веса ({weighins.length} записей)</Highlight>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input aria-label="Дата взвешивания" data-cb="weigh-date" style={{ ...inp(wDate, 'ГГГГ-ММ-ДД'), flex: '1 1 130px' }}
            value={wDate} onChange={e => setWDate(e.target.value)} />
          <input aria-label="Вес кг" data-cb="weigh-kg" inputMode="decimal" style={{ ...inp(wKg, 'кг'), flex: '1 1 90px' }}
            value={wKg} onChange={e => setWKg(e.target.value)} />
          <button data-cb="weigh-add" style={{ ...BTN, background: '#a855f7', color: '#fff', border: 0, borderRadius: 12 }}
            onClick={onAddWeigh}>＋ Взвесить</button>
        </div>
        {wMsg ? <div data-cb="weigh-msg" style={{ fontSize: 12 }}>{wMsg}</div> : null}
        {traj ? (
          <div data-cb="weigh-traj" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Line tone={traj.level === 'cutting' ? 'ok' : traj.level === 'gaining' ? 'warn' : 'warn'}>
              {traj.first.toFixed(1)} → {traj.last.toFixed(1)} кг · {traj.perWeek >= 0 ? '−' : '+'}
              {Math.abs(traj.perWeek).toFixed(2)} кг/нед
            </Line>
            <span style={{ fontSize: 11, color: '#fff' }}>
              {traj.level === 'cutting' ? 'идёт на сгон' : traj.level === 'gaining' ? 'набор массы' : 'вес держится'}
            </span>
          </div>
        ) : <Line tone="warn">Нет двух замеров — траектория не считается.</Line>}
        {dev.level !== 'unknown' ? (
          <div data-cb="weigh-dev" style={{ fontSize: 12, color: '#fff' }}>
            План на сегодня {dev.plannedKg!.toFixed(1)} кг · факт {dev.actualKg!.toFixed(1)} кг · {dev.note}
          </div>
        ) : dev.actualKg !== null ? <Line tone="warn">{dev.note}</Line> : null}
      </div>

      {/* 8.2 — журнал спарринга */}
      <div data-cb="measure-sparring" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        <Highlight>🥊 Спарринг (неделя: {sparLoad ? 'учтён' : 'нет сессий'})</Highlight>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <CombatPopupSelect
            label="Тип спарринга"
            value={sType}
            onChange={v => setSType(v as SparType)}
            options={[
              { id: 'hard', label: 'Интенсивный' },
              { id: 'tech', label: 'Технический' },
              { id: 'wrestling', label: 'Борьба' },
              { id: 'conditioning', label: 'Общеподготовительный' },
            ]}
          />
          <input aria-label="Раундов" data-cb="spar-rounds" inputMode="numeric" style={{ ...inp(sRounds, 'раундов'), flex: '1 1 80px' }}
            value={sRounds} onChange={e => setSRounds(e.target.value)} />
          <input aria-label="RPE" data-cb="spar-rpe" inputMode="numeric" style={{ ...inp(sRpe, 'RPE 1-10'), flex: '1 1 80px' }}
            value={sRpe} onChange={e => setSRpe(e.target.value)} />
          <button data-cb="spar-add" style={{ ...BTN, background: '#ec4899', color: '#fff', border: 0, borderRadius: 12 }}
            onClick={onAddSpar}>＋ Записать</button>
        </div>
        {sMsg ? <div data-cb="spar-msg" style={{ fontSize: 12 }}>{sMsg}</div> : null}
        <div data-cb="spar-summary" style={{ fontSize: 12, color: '#fff' }}>
          Сессий {sparSummary.sessions} · нагрузка {sparSummary.load}
          {sparSummary.missingRpe ? ` · без RPE ${sparSummary.missingRpe}` : ''}
        </div>
        {sparSummary.notes.map((n, i) => <Line key={i} tone="warn">{n}</Line>)}
        {spar.length ? (
          <button data-cb="spar-clear" style={{ ...BTN_GHOST, color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
            onClick={() => {
              const last = spar[spar.length - 1];
              removeSparring(last.date, last.type);
              setSpar(loadSparring());
            }}>↩ Убрать последнюю</button>
        ) : null}
      </div>

      {/* 8.4 — LEA / RED-S */}
      <div data-cb="measure-lea" style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
        <Highlight>🔋 Энергетическая доступность</Highlight>
        <Line tone={lea.level === 'no_data' || lea.level === 'ok' || lea.level === 'optimal' ? 'ok' : 'danger'}>
          {lea.reason}
        </Line>
        {lea.level !== 'optimal' ? <span style={{ fontSize: 12, color: '#fff' }}>{lea.advice}</span> : null}
        <Badge>{lea.source}</Badge>
      </div>

      {/* 8.7 — сон */}
      <div data-cb="measure-sleep" style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
        <Highlight>😴 Сон</Highlight>
        <Line tone={sleep.level === 'ok' ? 'ok' : sleep.level === 'unknown' ? 'warn' : 'danger'}>{sleep.reason}</Line>
        {sleep.blockHardSession ? <span style={{ fontSize: 12, color: '#fff' }}>⛔ {sleep.advice}</span> : null}
      </div>

      {/* 8.8 — тепло */}
      <div data-cb="measure-heat" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Highlight>🌡️ Тепловой протокол</Highlight>
        <Line tone={heat.gate.blocked ? 'warn' : 'ok'}>
          Ступень: {heat.label} · {heat.sessionMin} мин при {heat.tempC} °C / {heat.humidityPct}% ВВ
        </Line>
        {heat.gate.reasons.map((r, i) => <Line key={i} tone="warn">{r}</Line>)}
        <span style={{ fontSize: 12, color: '#fff' }}>{heat.hydration}</span>
      </div>
    </SectionCard>
  );
};

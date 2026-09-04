/**
 * CardioTaperStep.tsx — PRO taper-применение (раунд 3).
 * Индивидуальный taper-план (Bosquet/Thomas/F-OR) → предпросмотр изменений →
 * применение с подтверждением. Персист делает родитель через onApply
 * (snapshot версии + сохранение + flash), шаг — чистая UI-логика.
 */
import React, { useMemo, useState } from 'react';
import {
  individualizedTaperPlan, applyIndividualizedTaperToCycle,
  type FatigueClass,
  type CardioCycle,
} from '../../../engines/lms/cardio.engine';
import { SectionCard, ROW, LABEL, BTN, BTN_PRIMARY, HINT_SM, Badge, EmptyState, NumberInput } from './CardioUI';

export const CardioTaperStep: React.FC<{
  cycle: CardioCycle | null;
  onApply: (next: CardioCycle, reason: string) => void;
}> = ({ cycle, onApply }) => {
  const defaultShowWeek = useMemo(() => {
    if (!cycle) return 1;
    const comp = cycle.config?.competitions?.filter(c => c.week >= 1 && c.week <= cycle.totalWeeks).sort((a, b) => a.week - b.week)[0];
    if (comp) return comp.week;
    const peak = cycle.weeks.find(w => w.phase === 'peak');
    if (peak) return peak.week;
    return cycle.totalWeeks;
  }, [cycle]);
  const [overloadPct, setOverloadPct] = useState(0);
  const [fatigue, setFatigue] = useState<FatigueClass>('AF');
  const [sleepHours, setSleepHours] = useState(() => (cycle?.config?.sleepHours != null ? String(cycle.config.sleepHours) : ''));
  const [showWeek, setShowWeek] = useState(defaultShowWeek);
  const [applied, setApplied] = useState(false);

  const plan = useMemo(() => individualizedTaperPlan({
    overloadPct,
    fatigue,
    sleepHours: sleepHours !== '' && Number.isFinite(Number(sleepHours)) ? Number(sleepHours) : null,
  }), [overloadPct, fatigue, sleepHours]);

  const preview = useMemo(() => {
    if (!cycle) return null;
    try {
      const w = Math.max(1, Math.min(cycle.totalWeeks, showWeek || defaultShowWeek));
      return applyIndividualizedTaperToCycle(cycle, plan, { showWeek: w });
    } catch { return null; }
  }, [cycle, plan, showWeek, defaultShowWeek]);

  if (!cycle) return <EmptyState icon="📉" title="Нет активного цикла" desc="Соберите цикл на шаге Предпросмотр, чтобы применить taper." />;

  const effShowWeek = Math.max(1, Math.min(cycle.totalWeeks, showWeek || defaultShowWeek));
  const changes = preview?.changes ?? [];

  return (
    <div className="train-cardiotaper" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionCard title="📉 Индивидуальный taper-план">
        <div style={ROW}>
          <span style={LABEL}>Пред-нагрузка 28д</span>
          {[0, 10, 20].map(v => (
            <button
              key={v}
              onClick={() => { setOverloadPct(v); setApplied(false); }}
              aria-label={`Пред-нагрузка ${v}%`}
              style={overloadPct === v
                ? { ...BTN, borderColor: 'rgba(0,230,138,0.5)', color: '#00e68a', background: 'rgba(0,230,138,0.12)' }
                : BTN}
            >
              {v === 0 ? 'Норма' : `+${v}%`}
            </button>
          ))}
        </div>
        <div style={ROW}>
          <span style={LABEL}>Усталость</span>
          {(['AF', 'F-OR'] as FatigueClass[]).map(f => (
            <button
              key={f}
              onClick={() => { setFatigue(f); setApplied(false); }}
              aria-label={`Усталость ${f}`}
              title={f === 'AF' ? 'Острая усталость (обычная)' : 'Функциональное перенапряжение: нужен длиннее и глубже (Front 2024)'}
              style={fatigue === f
                ? { ...BTN, borderColor: 'rgba(0,230,138,0.5)', color: '#00e68a', background: 'rgba(0,230,138,0.12)' }
                : BTN}
            >
              {f === 'AF' ? 'AF (острая)' : 'F-OR (перегруз)'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <NumberInput label="Сон (ч)" value={sleepHours} onChange={v => { setSleepHours(v); setApplied(false); }} min={0} max={12} step={0.5} placeholder="7" ariaLabel="Сон" width={80} suffix="ч" />
          <NumberInput label="Неделя шоу" value={String(effShowWeek)} onChange={v => { const n = Math.max(1, Math.min(cycle.totalWeeks, Math.round(Number(v) || defaultShowWeek))); setShowWeek(n); setApplied(false); }} min={1} max={cycle.totalWeeks} step={1} placeholder={String(defaultShowWeek)} ariaLabel="Неделя шоу" width={80} suffix={`из ${cycle.totalWeeks}`} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <Badge bg="rgba(234,179,8,0.12)" border="rgba(234,179,8,0.28)" color="#eab308">{plan.durationDays}д · −{plan.reductionPct}% · exp τ={plan.tauDays}д</Badge>
          <Badge bg="rgba(0,230,138,0.10)" border="rgba(0,230,138,0.24)" color="#4ade80">прогноз +{plan.expectedGainPct}%</Badge>
          {plan.sleepHygiene && <Badge bg="rgba(96,165,250,0.12)" border="rgba(96,165,250,0.28)" color="#93c5fd">😴 + гигиена сна</Badge>}
        </div>
        {plan.reasons.map((r, i) => (
          <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)', lineHeight: 1.45 }}>• {r}</div>
        ))}
      </SectionCard>

      <SectionCard title={`🔎 Изменения окна (нед ${effShowWeek}, прошлые недели не трогаются)`}>
        {changes.length === 0 ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)' }}>
            {applied ? '✅ Taper применён — окно уже размечено (повтор ничего не меняет).' : 'Изменений нет: окно уже taper/peak/deload либо цикл короче окна.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {changes.map(c => (
              <div key={c.week} style={{ fontSize: 12, color: '#fff' }}>
                Нед {c.week}: <b>{c.label}</b> — {c.from} → {c.to}
              </div>
            ))}
            <button
              style={{ ...BTN_PRIMARY, alignSelf: 'flex-start', marginTop: 4 }}
              onClick={() => { if (preview) { onApply(preview.cycle, `📉 индивид. taper −${plan.reductionPct}%/${plan.durationDays}д к нед ${effShowWeek}`); setApplied(true); } }}
            >
              ✓ Применить taper ({changes.length} изм.)
            </button>
          </div>
        )}
        <div style={HINT_SM}>Bosquet/Wang: срез 41-60% за 8-21д, интенсивность сохранить. F-OR/сон&lt;6ч — дольше и глубже + сон.</div>
      </SectionCard>
    </div>
  );
};

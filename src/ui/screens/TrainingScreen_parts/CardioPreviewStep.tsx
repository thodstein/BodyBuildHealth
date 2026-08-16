/**
 * CardioPreviewStep.tsx — шаг 3 мастера кардио: варианты нагрузки + объяснение
 * выбора, сборка, метрики, качество, «✨ Улучшить», план по фазам, taper-план,
 * неделя по дням, график объёма, таблица недель, обоснование.
 */
import React, { useMemo, useState } from 'react';
import {
  cardioCycleSummary, cardioQualityReport, cardioEquipmentLabel,
  cardioPlanVariants, improveCardioCycle, cardioSessionProtocol,
  spreadSessionsAcrossDays, DAY_LABELS_RU,
  CARDIO_GOAL_LABELS, CARDIO_PHASE_LABELS, CARDIO_VARIANT_LABELS,
  type CardioCycle, type CardioType, type CardioVariant, type CardioTuneChange,
} from '../../../engines/lms/cardio.engine';
import { CardioVolumeChart } from './CardioVolumeChart';
import { CardioProgressCard } from './CardioProgressCard';

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
};
const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const LABEL: React.CSSProperties = { fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 };
const BTN: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
  color: '#fff', minHeight: 44,
};
const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: 'rgba(0,230,138,0.18)', border: '1px solid rgba(0,230,138,0.5)', color: '#00e68a' };
const BTN_DANGER: React.CSSProperties = { ...BTN, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' };
const VARIANT_BTN: React.CSSProperties = {
  flex: '1 1 100px', padding: '8px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-dim)', fontSize: 11,
};
const VARIANT_BTN_ACTIVE: React.CSSProperties = {
  ...VARIANT_BTN, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.12)', color: '#fff',
};
const DAY_CELL: React.CSSProperties = {
  flex: '1 1 42px', minWidth: 42, borderRadius: 8, padding: '6px 4px', textAlign: 'center',
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 10,
};

const TYPE_LABEL: Record<CardioType, string> = { zone2: 'Zone 2', hiit: 'HIIT', miss: 'MISS', recovery: 'Rec' };
const PHASE_COLOR: Record<string, string> = {
  base: '#22c55e', build: '#3b82f6', maintenance: '#8b5cf6', contest_prep: '#f59e0b', taper: '#eab308', peak: '#ef4444', transition: '#71717a',
};

export const CardioPreviewStep: React.FC<{
  cycle: CardioCycle | null;
  onBuild: () => void;
  onRename: (name: string) => void;
  daysAvailable: number;
  recoveryLow: boolean;
  variant: CardioVariant;
  onVariant: (v: CardioVariant) => void;
  variants: ReturnType<typeof cardioPlanVariants>;
  explanation: string[];
  onImproved: (cycle: CardioCycle) => void;
}> = ({ cycle, onBuild, onRename, daysAvailable, recoveryLow, variant, onVariant, variants, explanation, onImproved }) => {
  const [showWeeks, setShowWeeks] = useState(true);
  const [nameDraft, setNameDraft] = useState('');
  const [weekNo, setWeekNo] = useState(1);
  const [improve, setImprove] = useState<{ changes: CardioTuneChange[]; cycle: CardioCycle } | null>(null);

  const summary = useMemo(() => (cycle ? cardioCycleSummary(cycle) : null), [cycle]);
  const quality = useMemo(() => (cycle ? cardioQualityReport(cycle, daysAvailable) : null), [cycle, daysAvailable]);

  const phasesPlan = useMemo(() => {
    if (!cycle) return [];
    const order: { phase: string; label: string }[] = [
      { phase: 'base', label: '🌱 База' },
      { phase: 'build', label: '📈 Наращивание' },
      { phase: 'maintenance', label: '🧘 Поддержание' },
      { phase: 'contest_prep', label: '🏋️ Prep' },
      { phase: 'taper', label: '📉 Taper' },
      { phase: 'peak', label: '🎭 Пик' },
      { phase: 'transition', label: '🌤 Переход' },
    ];
    return order
      .map(o => {
        const weeks = cycle.weeks.filter(w => w.phase === o.phase);
        if (weeks.length === 0) return null;
        const minutes = weeks.reduce((s, w) => s + w.totalMinutes, 0);
        return { ...o, weeks: weeks.length, first: weeks[0].week, last: weeks[weeks.length - 1].week, avgMin: Math.round(minutes / weeks.length) };
      })
      .filter(Boolean) as { phase: string; label: string; weeks: number; first: number; last: number; avgMin: number }[];
  }, [cycle]);

  const taperPlan = useMemo(() => {
    if (!cycle) return [];
    return cycle.weeks.filter(w => w.phase === 'taper' || w.phase === 'peak').map(w => ({
      week: w.week, phase: w.phase, minutes: w.totalMinutes, hiit: w.sessions.some(s => s.type === 'hiit'), sessions: w.sessions.length,
    }));
  }, [cycle]);

  const weekDays = useMemo(() => {
    if (!cycle) return [];
    const clamped = Math.max(1, Math.min(cycle.totalWeeks, weekNo));
    const w = cycle.weeks.find(x => x.week === clamped);
    return w ? spreadSessionsAcrossDays(w) : [];
  }, [cycle, weekNo]);

  const previewImprove = () => {
    if (!cycle) return;
    const r = improveCardioCycle(cycle, { daysAvailable, recoveryLow });
    if (r.changes.length === 0) { setImprove({ changes: [], cycle }); return; }
    setImprove({ changes: r.changes, cycle: r.cycle });
  };

  const applyImprove = () => {
    if (!improve || improve.changes.length === 0) return;
    onImproved(improve.cycle);
    setImprove(null);
  };

  if (!cycle || !summary) {
    return (
      <div style={CARD}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
          Соберите кардио-цикл из параметров и стартов — появится предпросмотр по неделям.
        </div>
        <button style={BTN_PRIMARY} onClick={onBuild}>🛠 Собрать и сохранить цикл</button>
      </div>
    );
  }

  const metrics = [
    { label: 'Недель', value: String(cycle.totalWeeks), color: '#22c55e' },
    { label: 'Мин/нед', value: String(summary.avgMinutesPerWeek), color: '#3b82f6' },
    { label: 'Ккал/нед', value: String(summary.avgKcalPerWeek), color: '#f59e0b' },
    { label: 'HIIT-нед', value: String(summary.hiitWeeks), color: '#a78bfa' },
    { label: 'Цель', value: CARDIO_GOAL_LABELS[cycle.goal], color: '#94a3b8' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={CARD}>
        <div style={ROW}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>{cycle.name}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>создан {new Date(cycle.createdAt).toLocaleDateString('ru-RU')}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {metrics.map(m => (
            <div key={m.label} style={{ flex: '1 1 90px', padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{m.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
        <button style={BTN_PRIMARY} onClick={onBuild}>🔄 Пересобрать цикл</button>
      </div>

      {/* Варианты нагрузки */}
      <div style={CARD}>
        <div style={LABEL}>⇄ Варианты нагрузки</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {variants.map(v => (
            <div key={v.id} style={variant === v.id ? VARIANT_BTN_ACTIVE : VARIANT_BTN} onClick={() => onVariant(v.id)} role="button" aria-label={`Вариант: ${v.label}`}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{v.label}</div>
              <div style={{ marginTop: 2, opacity: 0.7 }}>{v.summary.avgMinutesPerWeek} мин/нед · {v.summary.hiitWeeks} HIIT</div>
              <div style={{ fontSize: 9, marginTop: 2, opacity: 0.6 }}>{v.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Почему этот план */}
      <div style={CARD}>
        <div style={LABEL}>💡 Почему этот план</div>
        {explanation.map((e, i) => (
          <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>• {e}</div>
        ))}
      </div>

      {/* Качество + улучшить */}
      {quality && (
        <div style={CARD}>
          <div style={ROW}>
            <span style={LABEL}>📊 Качество цикла</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: quality.score >= 85 ? '#22c55e' : quality.score >= 60 ? '#f59e0b' : '#ef4444' }}>{quality.score}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>/100</span>
            <span style={{ flex: 1 }} />
            <button style={{ ...BTN, minHeight: 34, padding: '6px 14px' }} onClick={previewImprove}>✨ Улучшить</button>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ width: quality.score + '%', height: '100%', borderRadius: 3, background: quality.score >= 85 ? '#22c55e' : quality.score >= 60 ? '#f59e0b' : '#ef4444' }} />
          </div>
          {quality.findings.map((f, i) => (
            <div key={i} style={{ fontSize: 10, lineHeight: 1.4, color: f.level === 'warn' ? '#fbbf24' : f.level === 'ok' ? 'rgba(74,222,128,0.85)' : 'rgba(255,255,255,0.5)' }}>
              {f.level === 'warn' ? '⚠ ' : f.level === 'ok' ? '✅ ' : '💡 '}{f.text}
            </div>
          ))}
          {improve && (
            <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {improve.changes.length === 0 ? (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>План уже соответствует рекомендациям — улучшать нечего.</div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: '#93c5fd', fontWeight: 700 }}>Авто-улучшения ({improve.changes.length}):</div>
                  {improve.changes.map((c, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>Нед {c.week}: <b>{c.label}</b> — {c.from} → {c.to}</div>
                  ))}
                  <div style={ROW}>
                    <button style={BTN_PRIMARY} onClick={applyImprove}>✓ Применить</button>
                    <button style={BTN_DANGER} onClick={() => setImprove(null)}>✕ Отмена</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Переименование */}
      <div style={CARD}>
        <div style={LABEL}>✏️ Название цикла</div>
        <div style={ROW}>
          <input value={nameDraft || cycle.name} onChange={e => setNameDraft(e.target.value)} style={{ flex: 1, minWidth: 140, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12 }} aria-label="Название цикла" />
          <button style={BTN_PRIMARY} onClick={() => { if (nameDraft.trim()) { onRename(nameDraft.trim()); setNameDraft(''); } }}>💾 Переименовать</button>
        </div>
      </div>

      {/* План по фазам */}
      <div style={CARD}>
        <div style={LABEL}>🗂 План по фазам</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {phasesPlan.map(p => (
            <div key={p.phase} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ width: 130, fontWeight: 700, color: PHASE_COLOR[p.phase] ?? '#888' }}>{p.label}</span>
              <span style={{ width: 110, color: 'rgba(255,255,255,0.55)' }}>нед {p.first}–{p.last}</span>
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>{p.weeks} нед</span>
              <span style={{ flex: 1 }} />
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>~{p.avgMin} мин/нед</span>
            </div>
          ))}
        </div>
      </div>

      {/* Taper-план */}
      {taperPlan.length > 0 && (
        <div style={{ ...CARD, borderColor: 'rgba(234,179,8,0.3)' }}>
          <div style={LABEL}>📉 Taper-план перед стартом</div>
          {taperPlan.map(w => (
            <div key={w.week} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ width: 44, fontWeight: 800, color: PHASE_COLOR[w.phase] }}>нед {w.week}</span>
              <span style={{ width: 90, color: 'rgba(255,255,255,0.6)' }}>{CARDIO_PHASE_LABELS[w.phase]}</span>
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>{w.minutes} мин · {w.sessions} сессий</span>
              <span style={{ flex: 1 }} />
              <span style={{ color: w.hiit ? '#f87171' : '#4ade80', fontWeight: 700 }}>{w.hiit ? 'есть HIIT' : 'без HIIT'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Неделя по дням */}
      <div style={CARD}>
        <div style={ROW}>
          <span style={LABEL}>🗓 Неделя по дням</span>
          <button style={BTN} onClick={() => setWeekNo(Math.max(1, weekNo - 1))} aria-label="Предыдущая неделя">−</button>
          <span style={{ fontSize: 13, fontWeight: 800, minWidth: 26, textAlign: 'center' }}>{Math.min(cycle.totalWeeks, Math.max(1, weekNo))}</span>
          <button style={BTN} onClick={() => setWeekNo(Math.min(cycle.totalWeeks, weekNo + 1))} aria-label="Следующая неделя">+</button>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>из {cycle.totalWeeks}</span>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {DAY_LABELS_RU.map((d, i) => {
            const sess = weekDays.filter(s => s.dayOfWeek === i);
            return (
              <div key={d} style={DAY_CELL}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 3 }}>{d}</div>
                {sess.length === 0 ? <div style={{ color: 'rgba(255,255,255,0.2)' }}>—</div> : sess.map((s, j) => (
                  <div key={j} style={{ color: '#4ade80', fontWeight: 600, lineHeight: 1.5, whiteSpace: 'nowrap' }}>
                    {TYPE_LABEL[s.type]} {s.durationMin}м{s.equipment ? ` ${cardioEquipmentLabel(s.equipment)}` : ''}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <CardioProgressCard cycle={cycle} />
      <CardioVolumeChart cycle={cycle} />

      <div style={CARD}>
        <div style={ROW}>
          <span style={LABEL}>🗓 Недели</span>
          <button style={{ ...BTN, minHeight: 32, padding: '6px 12px' }} onClick={() => setShowWeeks(v => !v)}>{showWeeks ? '▾ Скрыть' : '▸ Показать'}</button>
        </div>
        {showWeeks && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {cycle.weeks.map(w => (
              <div key={w.week} style={ROW}>
                <span style={{ width: 26, fontSize: 11, fontWeight: 800, color: PHASE_COLOR[w.phase] ?? '#888' }}>{w.week}</span>
                <span style={{ width: 92, fontSize: 11, color: 'var(--text-dim)' }}>
                  {CARDIO_PHASE_LABELS[w.phase]}{w.deload ? ' · делод' : ''}{w.taper ? ' · taper' : ''}
                </span>
                <span style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {w.sessions.map(s => `${TYPE_LABEL[s.type]} ${s.durationMin}×${s.weeklyFrequency}${s.equipment ? ' · ' + cardioEquipmentLabel(s.equipment) : ''}${s.targetHr?.max ? ' · ЧСС ' + s.targetHr.min + '-' + s.targetHr.max : ''}`).join('  |  ')}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', minWidth: 74, textAlign: 'right' }}>{w.totalMinutes} мин · {w.totalKcal} ккал</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {cycle.rationale.length > 0 && (
        <div style={CARD}>
          <div style={LABEL}>💡 Обоснование</div>
          {cycle.rationale.map((r, i) => (
            <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.45 }}>• {r}</div>
          ))}
        </div>
      )}
    </div>
  );
};

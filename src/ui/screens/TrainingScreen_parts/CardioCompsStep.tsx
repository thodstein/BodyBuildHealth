/**
 * CardioCompsStep.tsx — шаг 2 мастера кардио: соревнования/старты.
 * Для каждого старта строится taper (2 нед) и пик-неделя.
 */
import React from 'react';
import type { CardioCompetitionRef } from '../../../engines/lms/cardio.engine';

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
};
const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const LABEL: React.CSSProperties = { fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 };
const BTN: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
  color: '#fff', minHeight: 40, whiteSpace: 'nowrap',
};
const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: 'rgba(0,230,138,0.16)', border: '1px solid rgba(0,230,138,0.4)', color: '#00e68a' };
const BTN_DANGER: React.CSSProperties = { ...BTN, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' };
const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12, minWidth: 90,
};

export interface CompDraft { name: string; week: string }

export const CardioCompsStep: React.FC<{
  comps: CardioCompetitionRef[];
  setComps: (c: CardioCompetitionRef[]) => void;
  draft: CompDraft;
  setDraft: (d: CompDraft) => void;
  totalWeeks: number;
  taperWeeks: number;
  setTaperWeeks: (n: number) => void;
  peakWeek: boolean;
  setPeakWeek: (v: boolean) => void;
}> = ({ comps, setComps, draft, setDraft, totalWeeks, taperWeeks, setTaperWeeks, peakWeek, setPeakWeek }) => {
  const add = () => {
    const week = Math.min(Math.max(1, Math.round(Number(draft.week) || 0)), totalWeeks);
    if (!draft.name.trim() || week < 1) return;
    setComps([...comps, { id: `comp-${Date.now()}`, name: draft.name.trim(), week }]);
    setDraft({ name: '', week: '' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={CARD}>
        <div style={LABEL}>🏁 Соревнования и старты</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
          Для каждого старта цикл строит taper (объём снижается, HIIT убирается) и пик-неделю
          (только лёгкое восстановительное кардио). Можно не указывать — тогда последняя неделя будет переходной.
        </div>
        {comps.length === 0 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Старты не добавлены.</div>}
        {comps.map(c => (
          <div key={c.id} style={ROW}>
            <span style={{ fontSize: 12, flex: 1 }}>{c.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>нед {c.week} · taper с нед {Math.max(1, c.week - taperWeeks)}</span>
            <button style={BTN_DANGER} onClick={() => setComps(comps.filter(x => x.id !== c.id))} aria-label={`Удалить ${c.name}`}>✕</button>
          </div>
        ))}
        <div style={ROW}>
          <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Название (например, Шоу)" style={{ ...INPUT, flex: 1, minWidth: 130 }} />
          <input value={draft.week} onChange={e => setDraft({ ...draft, week: e.target.value })} placeholder="Неделя" inputMode="numeric" style={{ ...INPUT, width: 90 }} aria-label="Неделя старта" />
          <button style={BTN_PRIMARY} onClick={add}>+ Добавить старт</button>
        </div>
      </div>

      {/* Конструирование taper */}
      <div style={CARD}>
        <div style={LABEL}>📉 Taper перед стартом</div>
        <div style={ROW}>
          <span style={LABEL}>Недель taper</span>
          <button style={BTN} onClick={() => setTaperWeeks(Math.max(1, taperWeeks - 1))} aria-label="Меньше taper">−</button>
          <span style={{ fontSize: 14, fontWeight: 800, minWidth: 24, textAlign: 'center' }}>{taperWeeks}</span>
          <button style={BTN} onClick={() => setTaperWeeks(Math.min(4, taperWeeks + 1))} aria-label="Больше taper">+</button>
          <button
            style={peakWeek ? { ...BTN, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.12)', color: '#fff' } : BTN}
            onClick={() => setPeakWeek(!peakWeek)}
          >
            {peakWeek ? '🏔 Пик-неделя: вкл' : 'Пик-неделя: выкл'}
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          Taper: объём снижается (×0.6-0.7), HIIT убирается (Bosquet 2005). Пик-неделя — только лёгкое recovery
          кардио в день старта.
        </div>
      </div>
    </div>
  );
};

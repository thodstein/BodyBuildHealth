/**
 * CardioCompsStep.tsx — шаг 2 мастера кардио: соревнования/старты.
 * Для каждого старта строится taper (объём ↓, HIIT убран) и пик-неделя.
 */
import React from 'react';
import type { CardioCompetitionRef } from '../../../engines/lms/cardio.engine';
import { SectionCard, GroupHeading, ROW, LABEL, HINT, BTN, BTN_PRIMARY, BTN_DANGER, BTN_SMALL, INPUT, ChipToggle, InfoBanner } from './CardioUI';

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
      <GroupHeading icon="🏁" text="Соревнования и старты" desc="Для каждого старта строится taper и пик-неделя." />
      <SectionCard title="Старты">
        <div style={HINT}>
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
        {comps.length > 0 && <InfoBanner tone="ok">Добавлено стартов: {comps.length} — taper будет построен автоматически.</InfoBanner>}
      </SectionCard>

      <GroupHeading icon="📉" text="Taper перед стартом" desc="Объём снижается (×0.6-0.7), HIIT убирается (Bosquet 2005)." />
      <SectionCard title="📉 Taper перед стартом">
        <div style={ROW}>
          <span style={LABEL}>Недель taper</span>
          <button style={BTN_SMALL} onClick={() => setTaperWeeks(Math.max(1, taperWeeks - 1))} aria-label="Меньше taper">−</button>
          <span style={{ fontSize: 14, fontWeight: 800, minWidth: 24, textAlign: 'center' }}>{taperWeeks}</span>
          <button style={BTN_SMALL} onClick={() => setTaperWeeks(Math.min(4, taperWeeks + 1))} aria-label="Больше taper">+</button>
          <ChipToggle active={peakWeek} onClick={() => setPeakWeek(!peakWeek)}>
            {peakWeek ? '🏔 Пик-неделя: вкл' : 'Пик-неделя: выкл'}
          </ChipToggle>
        </div>
        <div style={HINT}>Taper: объём снижается (×0.6-0.7), HIIT убирается (Bosquet 2005). Пик-неделя — только лёгкое recovery кардио в день старта.</div>
      </SectionCard>
    </div>
  );
};

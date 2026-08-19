/**
 * CardioCompsStep.tsx — шаг 2 мастера кардио: соревнования/старты.
 * Taper/пик-неделя настраиваются на шаге 1 (Структура фаз) — здесь только
 * список стартов и статус выбранного режима.
 */
import React from 'react';
import type { CardioCompetitionRef } from '../../../engines/lms/cardio.engine';
import { SectionCard, GroupHeading, ROW, LABEL, HINT, BTN_PRIMARY, BTN_DANGER, NumberInput, InfoBanner } from './CardioUI';

export interface CompDraft { name: string; week: string }

export const CardioCompsStep: React.FC<{
  comps: CardioCompetitionRef[];
  setComps: (c: CardioCompetitionRef[]) => void;
  draft: CompDraft;
  setDraft: (d: CompDraft) => void;
  totalWeeks: number;
  taperWeeks: number;
  taperEnabled: boolean;
  peakWeek: boolean;
}> = ({ comps, setComps, draft, setDraft, totalWeeks, taperWeeks, taperEnabled, peakWeek }) => {
  const add = () => {
    const wNum = Number(draft.week);
    if (!draft.name.trim() || !Number.isFinite(wNum) || wNum < 1) return;
    const week = Math.min(Math.max(1, Math.round(wNum)), totalWeeks);
    setComps([...comps, { id: `comp-${Date.now()}`, name: draft.name.trim(), week }]);
    setDraft({ name: '', week: '' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <GroupHeading icon="🏁" text="Соревнования и старты" desc="Даты, к которым цикл строит taper и пик-неделю." />
      <SectionCard title="Старты">
        <div style={HINT}>
          Для каждого старта цикл строит taper (объём снижается, HIIT убирается) и пик-неделю
          (только лёгкое восстановительное кардио). Можно не указывать — тогда последняя неделя будет переходной.
        </div>
        <div style={HINT}>
          Режим: {taperEnabled
            ? `📉 taper ${taperWeeks} нед${peakWeek ? ' + пик-неделя' : ' (без пик-недели)'}`
            : 'без taper — перед стартом наращивание (contest_prep)'}
          {' '}— настраивается на шаге «Параметры» (Структура фаз).
        </div>
        {comps.length === 0 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Старты не добавлены.</div>}
        {comps.map(c => (
          <div key={c.id} style={ROW}>
            <span style={{ fontSize: 12, flex: 1 }}>{c.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {taperEnabled
                ? `нед ${c.week} · taper с нед ${Math.max(1, c.week - taperWeeks)}`
                : `нед ${c.week}${peakWeek ? ' · пик-неделя' : ''}`}
            </span>
            <button style={BTN_DANGER} onClick={() => setComps(comps.filter(x => x.id !== c.id))} aria-label={`Удалить ${c.name}`}>✕</button>
          </div>
        ))}
        <div style={ROW}>
          <input
            value={draft.name}
            onChange={e => setDraft({ ...draft, name: e.target.value })}
            placeholder="Название (например, Шоу)"
            style={{ flex: 1, minWidth: 130, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12 }}
          />
          <NumberInput
            value={draft.week}
            onChange={v => setDraft({ ...draft, week: v })}
            min={1}
            max={totalWeeks}
            step={1}
            placeholder="1"
            ariaLabel="Неделя старта"
            width={90}
            suffix="нед"
          />
          <button style={BTN_PRIMARY} onClick={add}>+ Добавить старт</button>
        </div>
        {comps.length > 0 && <InfoBanner tone="ok">Добавлено стартов: {comps.length} — taper/пик будут построены по режиму шага «Параметры».</InfoBanner>}
      </SectionCard>
    </div>
  );
};

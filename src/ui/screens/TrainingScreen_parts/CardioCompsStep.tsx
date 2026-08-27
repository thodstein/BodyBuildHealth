/**
 * CardioCompsStep.tsx — шаг 2 мастера кардио: соревнования/старты.
 * Taper/пик-неделя настраиваются на шаге 1 (Структура фаз) — здесь только
 * список стартов и статус выбранного режима.
 */
import React from 'react';
import type { CardioCompetitionRef } from '../../../engines/lms/cardio.engine';
import { SectionCard, GroupHeading, HINT, HINT_SM, BTN_PRIMARY, BTN_DANGER, NumberInput, InfoBanner, Badge } from './CardioUI';

export interface CompDraft { name: string; week: string; date?: string }

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
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);
  const add = () => {
    let wNum = Number(draft.week);
    if (draft.date) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const d = new Date(draft.date); d.setHours(0, 0, 0, 0);
      const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
      wNum = Math.floor(diff / 7) + 1;
    }
    if (!draft.name.trim() || !Number.isFinite(wNum) || wNum < 1) return;
    const week = Math.min(Math.max(1, Math.round(wNum)), totalWeeks);
    setComps([...comps, { id: `comp-${Date.now()}`, name: draft.name.trim(), week }]);
    setDraft({ name: '', week: '', date: '' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <GroupHeading icon="🏁" text="Соревнования и старты" desc="Даты, к которым цикл строит taper и пик-неделю." />
      <SectionCard title="Старты">
        <div style={{ ...HINT, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '7px 10px' }}>
          Для каждого старта цикл строит taper (объём снижается, HIIT убирается) и пик-неделю
          (только лёгкое восстановительное кардио). Можно не указывать — тогда последняя неделя будет переходной.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: taperEnabled ? 'rgba(234,179,8,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${taperEnabled ? 'rgba(234,179,8,0.22)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 8, padding: '7px 10px' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: taperEnabled ? '#eab308' : '#fff' }}>Режим:</span>
          <Badge bg={taperEnabled ? 'rgba(234,179,8,0.14)' : 'rgba(255,255,255,0.06)'} border={taperEnabled ? 'rgba(234,179,8,0.28)' : 'rgba(255,255,255,0.10)'} color={taperEnabled ? '#eab308' : '#fff'}>
            {taperEnabled ? `📉 taper ${taperWeeks} нед${peakWeek ? ' + пик-неделя' : ' (без пик-недели)'}` : 'без taper — перед стартом наращивание (contest_prep)'}
          </Badge>
          <span style={HINT_SM}>— настраивается на шаге «Параметры» (Структура фаз).</span>
        </div>
        {comps.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '18px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 28 }}>🏁</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Стартов пока нет</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', maxWidth: 360 }}>Добавьте хотя бы один старт — цикл построит taper и пик-неделю. Без стартов последняя неделя будет переходной.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {comps.map((c, idx) => (
                <div key={c.id} draggable onDragStart={() => setDragIdx(idx)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (dragIdx === null || dragIdx === idx) return; const next = [...comps]; const [moved] = next.splice(dragIdx, 1); next.splice(idx, 0, moved); setComps(next); setDragIdx(null); }} onDragEnd={() => setDragIdx(null)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: dragIdx === idx ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.03)', border: dragIdx === idx ? '1px dashed rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '8px 10px', opacity: dragIdx === idx ? 0.6 : 1, minHeight: 44 }}>
                  <span style={{ cursor: 'grab', color: '#fff', fontSize: 14, userSelect: 'none', padding: '4px 6px', minWidth: 24, textAlign: 'center' }} aria-hidden>⋮⋮</span>
                  <span style={{ fontSize: 13, fontWeight: 800, flex: 1, color: '#fff' }}>{c.name}</span>
                  <Badge bg="rgba(59,130,246,0.12)" border="rgba(59,130,246,0.22)" color="#60a5fa">нед {c.week}</Badge>
                  <span style={{ fontSize: 11, color: '#fff' }}>
                    {taperEnabled ? `taper с нед ${Math.max(1, c.week - taperWeeks)}` : peakWeek ? 'пик-неделя' : 'без пика'}
                  </span>
                  <button style={{ ...BTN_DANGER, minHeight: 28, padding: '4px 8px' }} onClick={() => setComps(comps.filter(x => x.id !== c.id))} aria-label={`Удалить ${c.name}`}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', overflow: 'hidden', position: 'relative' }}>
              {Array.from({ length: totalWeeks }).map((_, i) => {
                const week = i + 1;
                const comp = comps.find(c => c.week === week);
                const isTaper = taperEnabled && comps.some(c => week >= Math.max(1, c.week - taperWeeks) && week < c.week);
                const isPeak = !!comp && peakWeek;
                const bg = comp ? '#ef4444' : isPeak ? '#eab308' : isTaper ? 'rgba(234,179,8,0.32)' : 'transparent';
                return <div key={week} style={{ flex: 1, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: comp ? '#fff' : 'transparent', borderLeft: week > 1 ? '1px solid rgba(255,255,255,0.08)' : 'none', position: 'relative' }} title={comp ? `${comp.name} нед ${week}` : isTaper ? `taper нед ${week}` : `нед ${week}`}>{comp ? '●' : isTaper ? '▓' : ''}</div>;
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.55)' }}><span>нед 1</span><span>нед {totalWeeks}</span></div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#ef4444', marginRight: 4, verticalAlign: 'middle' }} />старт</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'rgba(234,179,8,0.32)', marginRight: 4 }} />taper</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', marginRight: 4 }} />база</span>
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={draft.name}
            onChange={e => setDraft({ ...draft, name: e.target.value })}
            placeholder="Название (например, Шоу)"
            style={{ flex: 1, minWidth: 140, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '9px 12px', color: '#fff', fontSize: 13 }}
          />
          <input
            type="date"
            value={draft.date ?? ''}
            onChange={e => {
              const v = e.target.value;
              if (v) {
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const d = new Date(v); d.setHours(0, 0, 0, 0);
                const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
                const w = Math.floor(diff / 7) + 1;
                setDraft({ ...draft, date: v, week: String(Math.min(Math.max(1, w), totalWeeks)) });
              } else setDraft({ ...draft, date: '' });
            }}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '9px 10px', color: '#fff', fontSize: 13 }}
            aria-label="Дата старта"
          />
          <NumberInput
            value={draft.week}
            onChange={v => setDraft({ ...draft, week: v })}
            min={1}
            max={totalWeeks}
            step={1}
            placeholder="1"
            ariaLabel="Неделя старта"
            width={70}
            suffix="нед"
          />
          <button style={BTN_PRIMARY} onClick={add}>+ Добавить старт</button>
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>Укажи дату — неделя посчитается от сегодня (неделя 1 = сегодня), или введи неделю вручную.</div>
        {comps.length > 0 && <InfoBanner tone="ok">Добавлено стартов: {comps.length} — taper/пик будут построены по режиму шага «Параметры».</InfoBanner>}
      </SectionCard>
    </div>
  );
};

/** PeriodizationTaperSection.tsx — taper-режим дизайнера (вынесено из PeriodizationDesignerTab, логика 1-в-1).
 * Пропсы: current (дизайн), discipline (pl/bb), accent. */
import React from 'react';
import {
  type MacrocycleDesign,
  PHASE_ICONS,
  PHASE_LABELS_RU,
} from '../../../engines/periodization-designer.engine';
import { TAPER_VS_DELOAD_NOTE } from '../../../engines/bb/bb-contest-prep.engine';
import { applyToPlanner } from './planner-bridge';

const DIM = '#fff';
const btn: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#fff', minHeight: 38 };

export const PeriodizationTaperSection: React.FC<{ current: MacrocycleDesign | null; discipline: 'pl' | 'bb'; accent: string }> = ({ current, discipline, accent }) => {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 4 }}>🔻 Тейпер / Пик — из дизайна (ПЛ 2-3 нед / ББ 1 нед)</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 6, lineHeight: 1.4 }}>
        Тейпер строится из <b style={{ color: '#fff' }}>пиковых/разгрузочных</b> блоков дизайна. {discipline === 'pl' ? 'ПЛ: объём 40-50%, RIR +2, прикиды.' : 'ББ: вода/соль/углеводы стабильны, шоу-пик 7 дней.'}
      </div>
      <div style={{ fontSize: 10, color: '#fff', marginBottom: 6, lineHeight: 1.5, padding: '6px 8px', borderRadius: 8, background: 'rgba(0,230,138,0.05)', border: '1px solid rgba(0,230,138,0.16)' }}>{TAPER_VS_DELOAD_NOTE}</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {[
          { t: 'Сила ~30д', h: 'Пик держится дольше — тапер короче, прекращение до 7 дн (Issurin)' },
          { t: 'Гипертрофия ~15д', h: 'Памп-форма уходит за 2 нед — пик-памп backstage обязателен' },
          { t: 'Юноши ≤1–2 нед', h: 'Юношеские нагрузки: taper короче (pl-norms)' },
          { t: 'Мастера +1 нед', h: 'Дольше восстановление (pl-norms)' },
        ].map(c => (
          <span key={c.t} title={c.h} style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM, fontSize: 10, fontWeight: 700 }}>{c.t}</span>
        ))}
      </div>
      {(() => {
        const peaking = current ? current.blocks.filter(b => b.phaseKey === 'peaking') : [];
        const deload = current ? current.blocks.filter(b => b.phaseKey === 'deload') : [];
        if (!current || (peaking.length === 0 && deload.length === 0)) {
          return <div style={{ padding: 10, textAlign: 'center', color: DIM, fontSize: 11, border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8 }}>Добавьте «Пик» или «Разгрузка» в дизайн — тейпер появится здесь</div>;
        }
        const taperWeeks = [...peaking, ...deload].sort((a,b)=>a.startWeek-b.startWeek);
        return (
          <div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {taperWeeks.map(b => (
                <span key={b.id} style={{ padding: '4px 8px', borderRadius: 6, background: b.phaseKey==='peaking' ? 'rgba(239,68,68,0.12)' : 'rgba(96,165,250,0.12)', border: `1px solid ${b.phaseKey==='peaking' ? 'rgba(239,68,68,0.25)' : 'rgba(96,165,250,0.25)'}`, color: b.phaseKey==='peaking' ? '#ef4444' : '#60a5fa', fontSize: 10, fontWeight: 700 }}>
                  {PHASE_ICONS[b.phaseKey]} {PHASE_LABELS_RU[b.phaseKey]} нед {b.startWeek}-{b.endWeek}
                </span>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8, fontSize: 10 }}>
              <div style={{ padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', textAlign: 'center' }}>
                <div style={{ color: '#ef4444', fontWeight: 700 }}>Объём в пик</div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 12 }}>{discipline==='pl' ? '40-50%' : '—'}</div>
                <div style={{ color: DIM }}>тейпер по Bosquet</div>
              </div>
              <div style={{ padding: 8, borderRadius: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)', textAlign: 'center' }}>
                <div style={{ color: '#22c55e', fontWeight: 700 }}>Интенсивность</div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 12 }}>{discipline==='pl' ? 'сохр.' : 'RIR 2-4'}</div>
                <div style={{ color: DIM }}>{discipline==='pl' ? 'вес сохранён' : 'без отказа'}</div>
              </div>
            </div>
            <button onClick={() => {
              const first = taperWeeks[0];
              const vol = first.phaseKey==='peaking' ? 0.45 : 0.5;
              const rir = first.phaseKey==='peaking' ? 0 : 3;
              applyToPlanner({ kind: first.phaseKey==='peaking' ? 'peak' : 'deload', label: `Тейпер из дизайна: нед ${first.startWeek}-${first.endWeek}`, data: first.phaseKey==='peaking' ? { volumeMult: vol, rirTarget: rir } : { volumeMult: vol, rirShift: rir, weeks: Array.from({length: first.endWeek-first.startWeek+1}, (_,i)=>first.startWeek+i) } } as any);
            }} style={{ ...btn, width: '100%', minHeight: 38, background: accent+'18', borderColor: accent+'33', color: accent }}>🛠 Применить тейпер из дизайна</button>
          </div>
        );
      })()}
    </div>
  );
};

export default PeriodizationTaperSection;

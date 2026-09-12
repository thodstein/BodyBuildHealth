// CalcPhaseLabCards — карточки анализов по фазам K0–K10 + аддоны классов.
// Единый движок: src/engines/support-phase-labs.engine.ts (канон docs/SUPPORT-PHASE-LABS-PLAN.md).
// Чистый рендер по пропсам: phase/flags/peds/subs/esterHalfLifeHours. Без стора, без эффектов.
import React from 'react';
import type { PhaseKey } from '../../../engines/tz-bridge-phase';
import {
  phaseCardsFor, addonsFor, pctVariantFor, isLongEsterHalfLife, isInjectableCourse,
  type PhaseLabFlags,
} from '../../../engines/support-phase-labs.engine';

export interface PhaseLabPed {
  id?: string | null;
  pClass?: string | null;
  form?: string | null;
}

interface Props {
  phase: PhaseKey;
  flags?: PhaseLabFlags | null;
  peds?: Array<PhaseLabPed | null | undefined> | null;
  subs?: Array<string | null | undefined> | null;
  esterHalfLifeHours?: number | null;
}

export const CalcPhaseLabCards: React.FC<Props> = ({ phase, flags, peds, subs, esterHalfLifeHours }) => {
  const pedList = (peds || []).filter(Boolean) as PhaseLabPed[];
  const cards = phaseCardsFor(flags, phase, {
    esterLong: undefined,
    injectable: isInjectableCourse(pedList, flags),
  });
  const activeClasses: string[] = [];
  for (const p of pedList) {
    if (p.id) activeClasses.push(String(p.id));
    if (p.pClass) activeClasses.push(String(p.pClass));
  }
  for (const s of subs || []) {
    if (s) activeClasses.push(String(s));
  }
  const addons = addonsFor(activeClasses);
  const pctV = pctVariantFor(
    typeof esterHalfLifeHours === 'number' ? isLongEsterHalfLife(esterHalfLifeHours) : undefined,
  );
  if (cards.length === 0 && addons.length === 0) return null;
  return (
    <div style={{ padding: '6px 7px', borderRadius: 6, background: 'rgba(96,165,250,0.10)', border: '1px solid rgba(96,165,250,0.18)', marginBottom: 4 }}>
      <div style={{ fontSize: 7, fontWeight: 700, color: '#93c5fd', marginBottom: 3 }}>
        📋 Карточки анализов по фазам ({cards.length}) — единый перечень K0–K10
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {cards.map(card => (
          <div key={card.id} data-phase-lab-card={card.id} style={{ padding: '4px 6px', borderRadius: 5, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 7, fontWeight: 700, color: '#bfdbfe', marginBottom: 1 }}>
              {card.id} · {card.title} <span style={{ color: '#60a5fa', fontWeight: 600 }}>· {card.when}</span>
            </div>
            {card.id === 'K6' && pctV !== 'unknown' && (
              <div style={{ fontSize: 6, color: '#fbbf24', marginBottom: 2 }}>
                Ваш вариант: {pctV === 'hcg-bridge' ? 'hCG-bridge (длинные эфиры)' : 'SERM сразу (короткие эфиры)'}
              </div>
            )}
            {card.groups.map((gr, gi) => (
              <div key={gi} style={{ marginTop: 2 }}>
                <div style={{ fontSize: 6, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>{gr.label}</div>
                {gr.items.map((m, mi) => (
                  <div key={mi} style={{ fontSize: 6, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, paddingLeft: 6, borderLeft: '2px solid rgba(96,165,250,0.25)', marginBottom: 2 }}>
                    <b style={{ color: '#e2e8f0' }}>{m.marker}</b>
                    {m.target && <span style={{ color: '#4ade80' }}> · 🎯 {m.target}</span>}
                    {m.why && <span style={{ color: 'rgba(255,255,255,0.5)' }}> — {m.why}</span>}
                    {m.red && <div style={{ color: '#fca5a5' }}>⚠ {m.red}</div>}
                  </div>
                ))}
              </div>
            ))}
            {card.rxNote && <div style={{ fontSize: 6, color: '#fbbf24', marginTop: 2 }}>{card.rxNote}</div>}
            {(card.preanalytics?.length || 0) > 0 && (
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                {(card.preanalytics || []).map((p, pi) => <div key={pi}>• {p}</div>)}
              </div>
            )}
          </div>
        ))}
      </div>
      {addons.length > 0 && (
        <div style={{ marginTop: 3 }}>
          <div style={{ fontSize: 7, fontWeight: 700, color: '#93c5fd', marginBottom: 3 }}>
            💊 Добавки по вашим препаратам ({addons.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {addons.map(a => (
              <div key={a.key} data-phase-lab-addon={a.key} style={{ padding: '4px 6px', borderRadius: 5, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 7, fontWeight: 700, color: '#bfdbfe', marginBottom: 1 }}>
                  {a.label} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>→ {a.attachTo.join(', ')}</span>
                </div>
                {a.items.map((m, mi) => (
                  <div key={mi} style={{ fontSize: 6, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, paddingLeft: 6, borderLeft: '2px solid rgba(96,165,250,0.25)', marginBottom: 2 }}>
                    <b style={{ color: '#e2e8f0' }}>{m.marker}</b>
                    {m.target && <span style={{ color: '#4ade80' }}> · 🎯 {m.target}</span>}
                    {m.red && <div style={{ color: '#fca5a5' }}>⚠ {m.red}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * bb-hub-next-actions-card.tsx — карточка «Что делать дальше» (BB-G-08).
 *
 * Чистая презентация: шаги приходят из `bb-diag-next-actions.engine`, здесь
 * только разметка и переход по месту шага. Разметка (`data-bb="next-action"`,
 * `data-action`, `data-target-type`) — контракт для jsdom-локов хаба, поэтому
 * переезд в отдельный файл её не меняет.
 */
import React from 'react';
import { CARD } from './training-ui';
import { vrZoneBg, vrZoneColor } from './bb-hub-zones';
import type { NextAction } from '../../../engines/bb/bb-diag-next-actions.engine';

export interface BbNextActionsCardProps {
  actions: NextAction[];
  /** Честное «почему шагов нет» — показываем только если действий ровно ноль. */
  note?: string | null;
  onGoScreen: (id: string) => void;
  onGoTab: (id: string) => void;
}

export const BbNextActionsCard: React.FC<BbNextActionsCardProps> = ({ actions, note, onGoScreen, onGoTab }) => {
  if (actions.length === 0 && !note) return null;

  return (
    <div data-bb="next-actions" style={{ ...CARD, padding: '10px 10px 8px', margin: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>Что делать дальше</div>
        <div style={{ fontSize: 9, color: '#94a3b8' }}>из данных, не из шаблона</div>
      </div>
      {actions.map((a, i) => {
        const rowStyle: React.CSSProperties = {
          display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 8px', borderRadius: 8,
          background: vrZoneBg(a.zone), border: `1px solid ${vrZoneColor(a.zone)}33`, marginBottom: 6,
          width: '100%', textAlign: 'left', minHeight: 44, font: 'inherit', color: '#fff',
        };
        const inner = (
          <>
            <span style={{ width: 18, height: 18, borderRadius: 9, flex: '0 0 auto', background: vrZoneColor(a.zone), color: '#06281c', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{a.title}</span>
              <span style={{ display: 'block', fontSize: 10, color: '#cbd5e1', lineHeight: 1.45 }}>{a.why}</span>
            </span>
            {/* Место шага — визуальный чип; имя кнопки = сам шаг (а не название раздела). */}
            {a.target && <span aria-hidden="true" style={{ flex: '0 0 auto', padding: '3px 8px', borderRadius: 999, background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.25)', color: '#00e68a', fontSize: 10, fontWeight: 700, lineHeight: 1.6 }}>{a.target.label} →</span>}
          </>
        );
        return a.target ? (
          <button
            key={a.id}
            type="button"
            data-bb="next-action"
            data-action={a.id}
            data-zone={a.zone}
            data-target={a.target.id}
            data-target-type={a.target.type}
            title={`Перейти: ${a.target.label}`}
            aria-label={a.title}
            onClick={() => { if (a.target!.type === 'screen') onGoScreen(a.target!.id); else onGoTab(a.target!.id); }}
            style={{ ...rowStyle, cursor: 'pointer' }}
          >{inner}</button>
        ) : (
          <div key={a.id} data-bb="next-action" data-action={a.id} data-zone={a.zone} style={rowStyle}>{inner}</div>
        );
      })}
      {actions.length === 0 && note && (
        <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.5 }}>{note}</div>
      )}
    </div>
  );
};

export default BbNextActionsCard;

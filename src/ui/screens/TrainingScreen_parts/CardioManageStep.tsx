/**
 * CardioManageStep.tsx — шаг 4 мастера кардио: интеграции (ПЛ/ББ/ручной,
 * годовой план), экспорт (.ics/печать), библиотека с карточками, редактор недели.
 */
import React from 'react';
import {
  cardioCycleSummary, CARDIO_GOAL_LABELS,
  type CardioCycle,
} from '../../../engines/lms/cardio.engine';
import { SPORT_LABELS, type CardioLink, type CardioLinkSport } from '../../../engines/lms/cardio-bridge';
import { CardioWeekEditor } from './CardioWeekEditor';

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
};
const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const LABEL: React.CSSProperties = { fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 };
const BTN: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
  color: '#fff', minHeight: 40, whiteSpace: 'nowrap',
};
const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: 'rgba(0,230,138,0.16)', border: '1px solid rgba(0,230,138,0.4)', color: '#00e68a' };
const BTN_DANGER: React.CSSProperties = { ...BTN, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' };

export const CardioManageStep: React.FC<{
  cycle: CardioCycle | null;
  library: CardioCycle[];
  link: CardioLink | null;
  macroLink: { kind: 'pl' | 'bb'; cycleId?: string } | null;
  comparison: string | null;
  onLinkTo: (sport: CardioLinkSport) => void;
  onUnlink: () => void;
  onAttachMacro: (kind: 'pl' | 'bb') => void;
  onDetachMacro: () => void;
  onExport: (c: CardioCycle) => void;
  onPrint: (c: CardioCycle) => void;
  onDuplicate: (c: CardioCycle) => void;
  onActivate: (c: CardioCycle) => void;
  onCompare: (c: CardioCycle) => void;
  onRemove: (c: CardioCycle) => void;
  onChanged: () => void;
}> = ({ cycle, library, link, macroLink, comparison, onLinkTo, onUnlink, onAttachMacro, onDetachMacro, onExport, onPrint, onDuplicate, onActivate, onCompare, onRemove, onChanged }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Интеграция с силовым планом */}
      <div style={CARD}>
        <div style={LABEL}>🔗 Силовой план (ссылка, не копия)</div>
        {cycle && (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
            Активный цикл: <b style={{ color: '#4ade80' }}>{cycle.name}</b> — будет подключаться к конструкторам.
          </div>
        )}
        {link ? (
          <div style={ROW}>
            <span style={{ fontSize: 12, color: '#4ade80' }}>Подключено к {SPORT_LABELS[link.sport]}</span>
            <button style={BTN_DANGER} onClick={onUnlink}>Отключить</button>
          </div>
        ) : (
          <div style={ROW}>
            <button style={BTN} onClick={() => onLinkTo('pl')}>🏆 К ПЛ-авто</button>
            <button style={BTN} onClick={() => onLinkTo('bb')}>💪 К ББ-авто</button>
            <button style={BTN} onClick={() => onLinkTo('manual')}>✋ К ручному</button>
          </div>
        )}
      </div>

      {/* Годовой план */}
      <div style={CARD}>
        <div style={LABEL}>🗓 Годовой план (macrocycle.cardioCycleId)</div>
        {macroLink?.cycleId ? (
          <div style={ROW}>
            <span style={{ fontSize: 12, color: '#4ade80' }}>Привязано к годовому плану {macroLink.kind === 'pl' ? 'ПЛ' : 'ББ'}</span>
            <button style={BTN_DANGER} onClick={onDetachMacro}>Отвязать</button>
          </div>
        ) : (
          <div style={ROW}>
            <button style={BTN} onClick={() => onAttachMacro('pl')}>🏆 К плану ПЛ</button>
            <button style={BTN} onClick={() => onAttachMacro('bb')}>💪 К плану ББ</button>
          </div>
        )}
      </div>

      {/* Экспорт */}
      {cycle && (
        <div style={CARD}>
          <div style={LABEL}>📤 Экспорт</div>
          <div style={ROW}>
            <button style={BTN} onClick={() => onExport(cycle)}>📅 Календарь .ics</button>
            <button style={BTN} onClick={() => onPrint(cycle)}>🖨 Печать / PDF</button>
          </div>
        </div>
      )}

      {/* Ручная настройка недели */}
      <CardioWeekEditor cycle={cycle} onChanged={onChanged} />

      {/* Библиотека */}
      <div style={CARD}>
        <div style={LABEL}>📚 Библиотека ({library.length})</div>
        {library.length === 0 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Пока пусто — соберите первый цикл на шаге «Предпросмотр».</div>}
        {library.map(c => {
          const s = cardioCycleSummary(c);
          return (
            <div key={c.id} style={{ padding: 8, borderRadius: 10, background: cycle?.id === c.id ? 'rgba(0,230,138,0.07)' : 'rgba(255,255,255,0.02)', border: cycle?.id === c.id ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={ROW}>
                <span style={{ fontSize: 12, fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cycle?.id === c.id ? '⭐ ' : ''}{c.name}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{c.totalWeeks} нед · {s.avgMinutesPerWeek} мин/нед · {CARDIO_GOAL_LABELS[c.goal]}</span>
              </div>
              <div style={ROW}>
                {cycle?.id !== c.id && <button style={{ ...BTN_PRIMARY, minHeight: 32, padding: '5px 10px' }} onClick={() => onActivate(c)}>Активировать</button>}
                <button style={{ ...BTN, minHeight: 32, padding: '5px 10px' }} onClick={() => onDuplicate(c)}>⧉ Копия</button>
                <button style={{ ...BTN, minHeight: 32, padding: '5px 10px' }} onClick={() => onCompare(c)}>⇄ Сравнить</button>
                <button style={{ ...BTN, minHeight: 32, padding: '5px 10px' }} onClick={() => onExport(c)}>📅</button>
                <button style={{ ...BTN, minHeight: 32, padding: '5px 10px' }} onClick={() => onPrint(c)}>🖨</button>
                <button style={{ ...BTN_DANGER, minHeight: 32, padding: '5px 10px' }} onClick={() => onRemove(c)}>🗑</button>
              </div>
            </div>
          );
        })}
        {comparison && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: 8 }} role="status">
            {comparison}
          </div>
        )}
      </div>
    </div>
  );
};

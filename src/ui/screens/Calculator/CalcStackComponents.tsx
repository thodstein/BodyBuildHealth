// CalcStackComponents.tsx — общие компоненты стеков калькулятора (Д8/Д9 аудита):
// раскрытая карточка стека (ручной попап ↔ попап «Усиление») и чипы выбранных стеков.
// Логика/стили вынесены 1-в-1 из Calc.mapper; поведение в обоих местах идентично.
import React from 'react';
import { SUPPORT_CATALOG_DATA } from '../../../data/support-catalog-data';
import { MECH_TRANSLATIONS_RU, MECH_LABELS } from '../SupportScreen_parts/SupportScreenData';

export interface StackLike {
  id: string;
  name?: string;
  system?: string;
  problem?: string;
  substances?: Array<{ id: string; dose?: string; timing?: string; mechanism?: string }>;
  synergyScore?: number;
  synergyPrinciple?: string;
  contraindications?: string;
  warnings?: string;
  anatomicalMapping?: {
    organMechanisms?: string;
    finalEffect?: string;
    mechanismCodes?: string[];
  };
}

/** Детали раскрытого стека (механизм / принцип / перечень / противопоказания) — 1-в-1 из mapper. */
const StackRowDetails: React.FC<{ st: StackLike; compact?: boolean }> = ({ st, compact }) => {
  const subCount = (st.substances || []).length;
  return (
    <div style={{ padding: compact ? '0 8px 8px' : '0 10px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      {st.anatomicalMapping?.organMechanisms && (
        <div style={{ fontSize: 11, color: 'rgba(240,240,245,0.9)', lineHeight: 1.45, marginTop: 6 }}>
          <b style={{ color: '#a78bfa' }}>🧬 Механизм действия:</b> {st.anatomicalMapping.organMechanisms}
        </div>
      )}
      {st.synergyPrinciple && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.45, marginTop: 3 }}>
          <b>Принцип синергии:</b> {st.synergyPrinciple}
        </div>
      )}
      {st.anatomicalMapping?.finalEffect && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.45, marginTop: 3 }}>
          <b>Итоговый эффект:</b> {st.anatomicalMapping.finalEffect}
        </div>
      )}
      {st.anatomicalMapping?.mechanismCodes && st.anatomicalMapping.mechanismCodes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
          {st.anatomicalMapping.mechanismCodes.map((m: string) => (
            <span key={m} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(168,85,247,0.1)', color: '#c084fc' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')}</span>
          ))}
        </div>
      )}
      <div style={{ fontSize: 12, fontWeight: 700, color: '#00e68a', marginTop: 8, marginBottom: 3 }}>💊 Перечень препаратов ({subCount}):</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {(st.substances || []).map((sd) => {
          const cat = SUPPORT_CATALOG_DATA[sd.id];
          return (
            <div key={sd.id} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'rgba(0,230,138,0.05)', border: '1px solid rgba(0,230,138,0.12)' }}>
              <span style={{ fontWeight: 600, color: 'rgba(240,240,245,0.9)' }}>{cat?.nameRu || cat?.name || sd.id}</span>
              {sd.dose && <span style={{ color: '#00e68a', marginLeft: 4 }}>{sd.dose}</span>}
              {sd.timing && <span style={{ color: 'rgba(255,255,255,0.55)', marginLeft: 4 }}>{sd.timing}</span>}
              {sd.mechanism && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.35, marginTop: 2 }}>— {sd.mechanism}</div>}
            </div>
          );
        })}
      </div>
      {(st.contraindications || st.warnings) && (
        <div style={{ marginTop: 8 }}>
          {st.contraindications && (
            <div style={{ fontSize: 11, color: '#f87171', lineHeight: 1.45 }}>
              <b>⛔ Противопоказания:</b> {st.contraindications}
            </div>
          )}
          {st.warnings && (
            <div style={{ fontSize: 11, color: '#fbbf24', lineHeight: 1.45, marginTop: 3 }}>
              <b>⚠ Осторожности / предосторожности:</b> {st.warnings}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export interface StackExpandableRowProps {
  st: StackLike;
  active: boolean;
  expanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  /** Компактный вариант (ручной попап): плотнее отступы/рамка, без мета-строки. */
  compact?: boolean;
  /** Попап «Усиление»: бейдж «авто-триггер» + строка problem. */
  autoTrigger?: boolean;
}

/** Д8: единая раскрытая карточка стека (ручной попап ↔ попап «Усиление»). */
export const StackExpandableRow: React.FC<StackExpandableRowProps> = ({ st, active, expanded, onToggleSelect, onToggleExpand, compact, autoTrigger }) => {
  const subCount = (st.substances || []).length;
  const title = st.name || st.id.replace(/_stack|_support|_35/g, '').replace(/_/g, ' ');
  return (
    <div
      data-stack-row={st.id}
      style={{
        borderRadius: compact ? 7 : 8,
        marginBottom: compact ? 0 : 4,
        overflow: compact ? undefined : 'hidden',
        background: active ? (compact ? 'rgba(168,85,247,0.1)' : 'rgba(168,85,247,0.12)') : 'rgba(255,255,255,0.02)',
        border: active
          ? (compact ? '1px solid rgba(168,85,247,0.25)' : '1px solid rgba(168,85,247,0.3)')
          : (compact ? '1px solid rgba(255,255,255,0.04)' : '1px solid transparent'),
      }}
    >
      <div onClick={onToggleSelect} style={{ padding: compact ? '8px 10px' : '9px 11px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ fontSize: 13, minWidth: 14, color: active ? '#c084fc' : 'rgba(255,255,255,0.4)', marginTop: 1 }}>{active ? '✓' : '○'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#c084fc' : 'rgba(255,255,255,0.9)', lineHeight: 1.25 }}>{title}</div>
          {compact ? (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2, lineHeight: 1.35 }}>
              {st.system || ''} · {subCount} веществ{st.synergyScore ? ` · син: ${st.synergyScore}` : ''}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.35, marginTop: 2 }}>{st.problem || st.system || ''}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 3, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <span>{subCount} веществ</span>
                {st.synergyScore ? <span>· синергия: {st.synergyScore}</span> : null}
                {st.system ? <span>· {st.system}</span> : null}
                {autoTrigger ? <span style={{ color: '#f87171', fontWeight: 700 }}>· авто-триггер</span> : null}
              </div>
            </>
          )}
        </div>
        <span onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', cursor: 'pointer', marginTop: 1, padding: '0 2px', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && <StackRowDetails st={st} compact={compact} />}
    </div>
  );
};

/** Д9: единый список чипов выбранных стеков (ручной попап ↔ блок «Усиление»). */
export const SelectedStackChips: React.FC<{
  items: Array<{ id: string; label: string }>;
  onRemove: (id: string) => void;
  testId?: string;
  /** manual — попап ручного выбора (11px/margin), enhance — блок «Усиление» (10px). */
  variant?: 'manual' | 'enhance';
}> = ({ items, onRemove, testId, variant = 'enhance' }) => {
  if (items.length === 0) return null;
  const manual = variant === 'manual';
  return (
    <div data-stack-chips={testId || 'stacks'} style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
      {items.map((item) => (
        <span key={item.id} style={{ fontSize: manual ? 11 : 10, padding: manual ? '3px 8px' : '3px 7px', borderRadius: 6, fontWeight: 600, background: 'rgba(168,85,247,0.12)', color: '#c084fc', display: 'inline-flex', alignItems: 'center', gap: 4, margin: manual ? 1 : undefined }}>
          {item.label}
          <span onClick={() => onRemove(item.id)} style={{ cursor: 'pointer', color: manual ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.6)', fontSize: manual ? 13 : 12 }}>✕</span>
        </span>
      ))}
    </div>
  );
};

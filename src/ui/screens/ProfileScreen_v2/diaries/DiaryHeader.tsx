/**
 * DiaryHeader.tsx — общая шапка ПОЛНЫХ страниц дневников (открываются по «Открыть»).
 * Дословно повторяет шапку дневника сна: ← Дневники | Заголовок + счётчик | flex-разделитель |
 * [+ Записать] [⚡ Сегодня] [↩ Отменить] [••• Ещё → экспорт/очистка].
 * Каждый дневник передаёт свой акцентный цвет и набор действий экспорта.
 */
import React, { useState } from 'react';
import { colors } from '../ui';
import { btnBase, btnPrimary, btnGhost, menuItem } from './diary-page-styles';

export interface DiaryHeaderAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export const DiaryHeader: React.FC<{
  accent: string;
  title: string;
  count: number | string;
  countLabel?: string;
  onClose: () => void;
  onAdd: () => void;
  addLabel?: string;
  onToday?: () => void;
  todayLabel?: string;
  undoActive?: boolean;
  onUndo?: () => void;
  undoLabel?: string;
  exportLabel?: string;
  exportTitle?: string;
  exportActions: DiaryHeaderAction[];
  badge?: React.ReactNode;
  extra?: React.ReactNode;
}> = ({
  accent,
  title,
  count,
  countLabel = 'записей',
  onClose,
  onAdd,
  addLabel = '+ Записать',
  onToday,
  todayLabel = '⚡ Сегодня',
  undoActive,
  onUndo,
  undoLabel = '↩ Отменить',
  exportLabel = '••• Ещё',
  exportTitle = 'Экспорт',
  exportActions,
  badge,
  extra,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        padding: '10px 14px',
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        alignItems: 'center',
        background: 'rgba(24,24,27,0.92)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <button style={btnGhost(accent)} onClick={onClose} aria-label="Назад к дневникам">
        ← Дневники
      </button>
      <b style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
        {title}
        <span style={{ fontSize: 12, fontWeight: 500, color: colors.textMuted }}>
          {count} {countLabel}
        </span>
      </b>
      {badge}
      <div style={{ flex: 1 }} />
      {extra}
      <button style={btnPrimary(accent)} onClick={onAdd}>
        {addLabel}
      </button>
      {onToday && (
        <button style={btnBase(accent)} onClick={onToday}>
          {todayLabel}
        </button>
      )}
      {undoActive && onUndo && (
        <button style={{ ...btnBase(accent), borderColor: `${accent}55`, color: accent }} onClick={onUndo}>
          {undoLabel}
        </button>
      )}
      <div style={{ position: 'relative' }}>
        <button style={btnBase(accent)} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
          {exportLabel}
        </button>
        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 4 }} onClick={() => setOpen(false)} />
            <div
              role="menu"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 8px)',
                zIndex: 5,
                minWidth: 200,
                padding: 6,
                borderRadius: 12,
                background: 'rgba(28,28,34,0.98)',
                border: `1px solid ${accent}55`,
                boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                display: 'grid',
                gap: 2,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: colors.textSubtle, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '6px 10px 2px' }}>
                {exportTitle}
              </div>
              {exportActions.map((a) => (
                <button
                  key={a.label}
                  style={a.danger ? { ...menuItem(accent), color: '#f87171' } : menuItem(accent)}
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    a.onClick();
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </header>
  );
};

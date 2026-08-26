/**
 * DiaryHeader.tsx — премиальная шапка ПОЛНЫХ страниц дневников.
 * Стекло + акцентная полоска, единая типографика, меню экспорта — стекло.
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
  title: React.ReactNode;
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
      className="diary-header"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        padding: '11px 14px 10px',
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        alignItems: 'center',
        background: 'rgba(16,16,20,0.78)',
        backdropFilter: 'blur(22px) saturate(160%)',
        WebkitBackdropFilter: 'blur(22px) saturate(160%)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.32)',
      }}
    >
      {/* акцентная тонкая линия сверху */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${accent}, ${accent}66 45%, transparent 92%)`,
          opacity: 0.95,
        }}
      />
      <button
        className="diary-header-btn"
        style={{ ...btnGhost(accent), minHeight: 40, padding: '8px 12px', fontWeight: 600, background: 'rgba(255,255,255,0.04)' }}
        onClick={onClose}
        aria-label="Назад к дневникам"
      >
        ← Дневники
      </button>

      <b style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 8, color: '#fff', lineHeight: 1, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{title}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: accent,
            background: `${accent}14`,
            border: `1px solid ${accent}30`,
            borderRadius: 999,
            padding: '2px 9px',
            letterSpacing: '0.2px',
          }}
        >
          {count} {countLabel}
        </span>
      </b>

      {badge && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{badge}</span>}

      <div style={{ flex: 1, minWidth: 12 }} />
      {extra}

      <button className="diary-header-btn" style={{ ...btnPrimary(accent), minHeight: 40, boxShadow: `0 4px 18px ${accent}32, inset 0 1px 0 rgba(255,255,255,0.15)` }} onClick={onAdd}>
        {addLabel}
      </button>

      {onToday && (
        <button className="diary-header-btn" style={{ ...btnBase(accent), minHeight: 40 }} onClick={onToday}>
          {todayLabel}
        </button>
      )}

      {undoActive && onUndo && (
        <button
          className="diary-header-btn"
          style={{ ...btnBase(accent), minHeight: 40, borderColor: `${accent}55`, color: accent, background: `${accent}10`, fontWeight: 700 }}
          onClick={onUndo}
        >
          {undoLabel}
        </button>
      )}

      <div style={{ position: 'relative', marginLeft: 2 }}>
        <button
          className="diary-header-btn"
          style={{ ...btnBase(accent), minHeight: 40, padding: '8px 12px' }}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={exportLabel}
        >
          {exportLabel}
        </button>
        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 4 }} onClick={() => setOpen(false)} aria-hidden="true" />
            <div
              role="menu"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 10px)',
                zIndex: 5,
                minWidth: 220,
                maxWidth: 'calc(100vw - 20px)',
                maxHeight: 'min(64vh, 440px)',
                overflowY: 'auto',
                padding: 6,
                borderRadius: 16,
                background: 'rgba(22,22,26,0.92)',
                backdropFilter: 'blur(20px) saturate(160%)',
                WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                border: `1px solid ${accent}33`,
                boxShadow: '0 18px 46px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.06)',
                display: 'grid',
                gap: 2,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: 'rgba(255,255,255,0.38)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.7px',
                  padding: '7px 10px 4px',
                }}
              >
                {exportTitle}
              </div>
              {exportActions.map((a) => (
                <button
                  key={a.label}
                  style={
                    a.danger
                      ? { ...menuItem(accent), color: '#fca5a5', background: 'rgba(239,68,68,0.06)' }
                      : { ...menuItem(accent), color: 'rgba(255,255,255,0.88)' }
                  }
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

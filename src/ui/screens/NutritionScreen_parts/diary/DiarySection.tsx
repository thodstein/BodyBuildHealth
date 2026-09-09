import React from 'react';

/**
 * DiarySection — единая обёртка секций таба «День» дневника питания.
 * Убирает «кашу»: каждый смысловой блок (действия/приёмы/микро/качество/
 * аналитика/данные) получает заголовок с иконкой и счётчиком.
 * Только подача: логика/движки/строки не тронуты, все старые nd-хуки на месте.
 */
interface DiarySectionProps {
  icon: string;
  title: string;
  sub?: string;
  count?: string | number | null;
  color?: string;
  /** суффикс хука: секция получает классы `nd-section nd-sec-<id>` */
  id: string;
  children: React.ReactNode;
}

export const DiarySection: React.FC<DiarySectionProps> = ({
  icon, title, sub, count, color = '#00e68a', id, children,
}) => (
  <section
    className={`nd-section nd-sec-${id}`}
    aria-label={title}
    style={{
      padding: 12, borderRadius: 18,
      background: 'linear-gradient(135deg, #18181b 0%, #1e1e22 100%)',
      border: '1px solid rgba(255,255,255,0.06)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
      backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}
  >
    <header
      className="nd-sec-head"
      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
    >
      <span
        aria-hidden
        style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: `linear-gradient(135deg, ${color}, ${color}99)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, boxShadow: `0 2px 8px ${color}30`,
        }}
      >
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: -0.2, lineHeight: 1.1 }}>
          {title}
        </div>
        {sub ? (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
            {sub}
          </div>
        ) : null}
      </div>
      {count !== undefined && count !== null && count !== '' ? (
        <span
          className="nd-sec-count"
          style={{
            marginLeft: 'auto', flexShrink: 0,
            fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
            background: `${color}14`, color,
            border: `1px solid ${color}2e`,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {count}
        </span>
      ) : null}
    </header>
    <div className="nd-sec-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {children}
    </div>
  </section>
);

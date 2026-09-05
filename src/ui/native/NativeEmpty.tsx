/**
 * NativeEmpty.tsx — PRO-пустые состояния. ТОЛЬКО APK (используется только
 * в native-гейтованных ветках). Telegram/web этот модуль не импортируют.
 *
 * Инлайн-SVG без внешних ассетов: работает офлайн, ноль веса для бандла
 * Telegram (в его чанки не попадает — импортов оттуда нет).
 */

import React from 'react';

export type EmptyArtKind = 'plate' | 'dumbbell' | 'chart' | 'clipboard' | 'trophy';

const DIM = 'rgba(140, 190, 255, 0.45)';
// Цвета акцента — через CSS-переменные (следуют за выбором в Оформлении).
// SVG-атрибуты var() не понимают, поэтому цвет кладём в style (CSS stroke/fill
// работают на SVG-геометрии везде). DIM статичен — остаётся атрибутом.
const STROKE_STYLE = { stroke: 'var(--accent)' } as React.CSSProperties;
const FILL_STYLE = {
  stroke: 'var(--accent)',
  fill: 'rgba(var(--accent-rgb), 0.08)',
} as React.CSSProperties;
const DOT_STYLE = { fill: 'var(--accent)' } as React.CSSProperties;

function Art({ kind }: { kind: EmptyArtKind }): React.ReactElement {
  const common = {
    fill: 'none' as const,
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: STROKE_STYLE,
  };
  const dim = {
    fill: 'none' as const,
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    stroke: DIM,
  };
  switch (kind) {
    case 'plate':
      return (
        <g>
          <ellipse cx="48" cy="52" rx="34" ry="26" {...common} style={FILL_STYLE} />
          <ellipse cx="48" cy="52" rx="20" ry="15" {...dim} />
          <path d="M48 22 v-10 M38 24 l-5 -9 M58 24 l5 -9" {...dim} />
          <circle cx="48" cy="52" r="4" style={DOT_STYLE} />
        </g>
      );
    case 'dumbbell':
      return (
        <g>
          <rect x="34" y="44" width="28" height="8" rx="4" {...common} style={FILL_STYLE} />
          <rect x="24" y="36" width="8" height="24" rx="3" {...common} />
          <rect x="64" y="36" width="8" height="24" rx="3" {...common} />
          <rect x="14" y="40" width="8" height="16" rx="3" {...dim} />
          <rect x="74" y="40" width="8" height="16" rx="3" {...dim} />
        </g>
      );
    case 'chart':
      return (
        <g>
          <path d="M18 78 h60" {...dim} />
          <path d="M18 78 V60 l14 -10 12 8 14 -18 12 10 v28" {...common} style={FILL_STYLE} />
          <circle cx="70" cy="40" r="4" style={DOT_STYLE} />
        </g>
      );
    case 'trophy':
      return (
        <g>
          <path d="M36 22 h24 v14 c0 12 -6 18 -12 18 s-12 -6 -12 -18 z" {...common} style={FILL_STYLE} />
          <path d="M36 28 h-10 c0 10 5 14 10 14 M60 28 h10 c0 10 -5 14 -10 14" {...dim} />
          <path d="M48 54 v8 M38 78 h20 M42 62 h12" {...common} />
        </g>
      );
    case 'clipboard':
    default:
      return (
        <g>
          <rect x="30" y="20" width="36" height="56" rx="8" {...common} style={FILL_STYLE} />
          <rect x="40" y="12" width="16" height="10" rx="4" {...dim} />
          <path d="M38 40 h20 M38 50 h20 M38 60 h13" {...dim} />
          <path d="M60 64 l4 4 8 -8" {...common} />
        </g>
      );
  }
}

/** Декоративная SVG-иллюстрация пустого состояния. */
export const NativeEmptyArt: React.FC<{ kind?: EmptyArtKind; size?: number }> = ({
  kind = 'clipboard',
  size = 96,
}) => (
  <div className="native-empty-art" aria-hidden="true" style={{ width: size, height: size, margin: '0 auto' }}>
    <svg width={size} height={size} viewBox="0 0 96 96" role="img">
      <Art kind={kind} />
    </svg>
  </div>
);

export interface NativeEmptyProps {
  art?: EmptyArtKind;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Готовое пустое состояние: арт + заголовок + подсказка + CTA. */
export const NativeEmpty: React.FC<NativeEmptyProps> = ({
  art = 'clipboard',
  title,
  hint,
  actionLabel,
  onAction,
}) => (
  <div className="native-empty">
    <NativeEmptyArt kind={art} />
    <div className="native-empty-title">{title}</div>
    {hint && <div className="native-empty-hint">{hint}</div>}
    {actionLabel && onAction && (
      <button className="native-empty-cta" onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </div>
);

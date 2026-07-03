// @ts-nocheck
/**
 * SupportShared.tsx — общие типы, стили и хелперы для всех частей SupportScreen.
 * Импортируется каждым view-компонентом.
 */
import React from 'react';
import { InfoErrorBoundary } from './SupportScreenData';
import type { PlanResult } from '../../../engines/support-plan';

// ─── Типы навигации ───
export type SupportTab = 'main' | 'catalog' | 'synergies' | 'calculator' | 'interactions' | 'stacks' | 'peptides' | 'fertility-pct';
export type SupportView = 'main' | 'calc' | 'fertility';
export type CalcView = 'main' | 'calculator' | 'peptides' | 'info' | 'stackcalc' | 'mystacks' | 'plan' | 'reports' | 'mixcalc';
export type InfoView = 'main' | 'catalog' | 'interactions' | 'stacks' | 'research' | 'favorites' | 'protocols' | 'biostack';

// ─── Общие стили ───
export const S = {
  card: { background: 'var(--bg-secondary)', borderRadius: 12, padding: 14, border: '1px solid var(--border)' } as React.CSSProperties,
  cardPink: { background: 'rgba(244,63,94,0.05)', borderRadius: 12, padding: 14, border: '1px solid rgba(244,63,94,0.15)' } as React.CSSProperties,
  cardAccent: { background: 'rgba(0,230,138,0.05)', borderRadius: 12, padding: 14, border: '1px solid rgba(0,230,138,0.15)' } as React.CSSProperties,
  cardBlue: { background: 'rgba(59,130,246,0.05)', borderRadius: 12, padding: 14, border: '1px solid rgba(59,130,246,0.15)' } as React.CSSProperties,
  h2: { margin: '0 0 2px', fontSize: 16, fontWeight: 800, color: 'var(--accent)' } as React.CSSProperties,
  h2Purple: { margin: '0 0 2px', fontSize: 16, fontWeight: 800, color: '#a78bfa' } as React.CSSProperties,
  sub: { fontSize: 10, color: 'var(--text-dim)', margin: '0 0 12px' } as React.CSSProperties,
  label: { fontSize: 8, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 } as React.CSSProperties,
  chip: (active: boolean, color = 'var(--accent)'): React.CSSProperties => ({
    padding: '3px 7px', borderRadius: 8, cursor: 'pointer', fontSize: 7, fontWeight: 600,
    background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
    border: active ? `1px solid ${color}44` : '1px solid rgba(255,255,255,0.08)',
    color: active ? color : 'rgba(255,255,255,0.7)', transition: 'all 0.15s',
  }),
  btn: (active: boolean): React.CSSProperties => ({
    padding: '6px 10px', borderRadius: 16, fontSize: 9, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
    background: active ? 'var(--accent)' : 'var(--bg-secondary)',
    color: active ? '#000' : 'var(--text-dim)', border: '1px solid var(--border)',
    transition: 'all 0.15s',
  }),
};

// ─── Re-export InfoErrorBoundary ───
export { InfoErrorBoundary };

// ─── Тип state-bag (передаётся во все view) ───
// Используем Record для максимальной гибкости при извлечении
export type SupportStateBag = Record<string, any> & {
  linked: any;
  planResult: PlanResult | null;
  goBack: () => void;
};
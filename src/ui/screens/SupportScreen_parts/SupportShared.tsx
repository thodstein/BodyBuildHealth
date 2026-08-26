// @ts-nocheck
/**
 * SupportShared.tsx — единая дизайн-система для блока БАД.
 * Обогащённые токены: типографика, карты, чипы, кнопки, инпуты.
 * Цель: читаемость 13-14px, контраст, глубина через тень/блюр, консистентные радиусы.
 */
import React from 'react';
import { InfoErrorBoundary } from './SupportScreenData';
import type { PlanResult } from '../../../engines/support-plan';

// ─── Типы навигации ───
export type SupportTab = 'main' | 'catalog' | 'synergies' | 'calculator' | 'interactions' | 'stacks' | 'peptides' | 'fertility-pct';
export type SupportView = 'main' | 'calc' | 'fertility';
export type CalcView = 'main' | 'calculator' | 'peptides' | 'info' | 'stackcalc' | 'mystacks' | 'plan' | 'reports' | 'mixcalc';
export type InfoView = 'main' | 'catalog' | 'interactions' | 'stacks' | 'research' | 'favorites' | 'protocols' | 'bioavailability';

const cardBase: React.CSSProperties = {
  borderRadius: 16,
  padding: 16,
  border: '1px solid rgba(255,255,255,0.07)',
  background: 'rgba(24,24,27,0.55)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
};

export const S = {
  card: { ...cardBase } as React.CSSProperties,
  cardElevated: { ...cardBase, background: 'rgba(28,28,32,0.7)', boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)' } as React.CSSProperties,
  cardPink: { ...cardBase, background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.18)' } as React.CSSProperties,
  cardAccent: { ...cardBase, background: 'linear-gradient(135deg, rgba(0,230,138,0.08), rgba(0,200,120,0.04))', border: '1px solid rgba(0,230,138,0.18)' } as React.CSSProperties,
  cardBlue: { ...cardBase, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)' } as React.CSSProperties,
  cardPurple: { ...cardBase, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.18)' } as React.CSSProperties,
  cardWarm: { ...cardBase, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)' } as React.CSSProperties,
  h1: { margin: '0 0 4px', fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.1 } as React.CSSProperties,
  h2: { margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.3px', lineHeight: 1.2 } as React.CSSProperties,
  h2Purple: { margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#a78bfa', letterSpacing: '-0.3px', lineHeight: 1.2 } as React.CSSProperties,
  h3: { margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px', lineHeight: 1.3 } as React.CSSProperties,
  sub: { fontSize: 12.5, color: 'rgba(255,255,255,0.62)', margin: '0 0 14px', lineHeight: 1.5 } as React.CSSProperties,
  subSmall: { fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 } as React.CSSProperties,
  label: { fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginBottom: 6, letterSpacing: '0.4px', textTransform: 'uppercase' } as React.CSSProperties,
  labelAccent: { fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 6, letterSpacing: '0.4px', textTransform: 'uppercase' } as React.CSSProperties,
  sectionTitle: { fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 10, letterSpacing: '-0.2px' } as React.CSSProperties,
  divider: { height: 1, background: 'rgba(255,255,255,0.06)', margin: '14px 0', border: 'none' } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(0,0,0,0.25)',
    color: '#fff',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  inputFocused: { border: '1px solid rgba(0,230,138,0.35)', boxShadow: '0 0 0 3px rgba(0,230,138,0.12)' } as React.CSSProperties,
  chip: (active: boolean, color = 'var(--accent)'): React.CSSProperties => ({
    padding: '7px 12px',
    borderRadius: 20,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 700,
    minHeight: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    background: active ? `${color}` : 'rgba(255,255,255,0.06)',
    border: active ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.08)',
    color: active ? '#000' : 'rgba(255,255,255,0.72)',
    transition: 'all 0.2s cubic-bezier(0.25,0.46,0.45,0.94)',
    boxShadow: active ? `0 2px 12px ${color}30` : 'none',
  }),
  chipSm: (active: boolean, color = 'var(--accent)'): React.CSSProperties => ({
    padding: '5px 10px',
    borderRadius: 16,
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 600,
    minHeight: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    background: active ? `${color}18` : 'rgba(255,255,255,0.04)',
    border: active ? `1px solid ${color}40` : '1px solid rgba(255,255,255,0.06)',
    color: active ? color : 'rgba(255,255,255,0.6)',
    transition: 'all 0.15s',
  }),
  btn: (active: boolean): React.CSSProperties => ({
    padding: '9px 16px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    minHeight: 36,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    background: active ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
    color: active ? '#000' : 'rgba(255,255,255,0.75)',
    border: active ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
    transition: 'all 0.2s',
    boxShadow: active ? '0 2px 12px rgba(0,230,138,0.25)' : 'none',
  }),
  btnPrimary: {
    padding: '12px 18px',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 44,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: 'linear-gradient(135deg, #00e68a, #00c853)',
    color: '#000',
    border: 'none',
    boxShadow: '0 4px 16px rgba(0,230,138,0.3)',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  btnGhost: {
    padding: '10px 16px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 40,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.75)',
    border: '1px solid rgba(255,255,255,0.08)',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  badge: (color: string): React.CSSProperties => ({
    fontSize: 10,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 6,
    background: `${color}18`,
    color,
    border: `1px solid ${color}30`,
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
  }),
  statCard: {
    padding: 14,
    borderRadius: 12,
    textAlign: 'center',
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.03)',
    minWidth: 0,
  } as React.CSSProperties,
  pillRow: {
    display: 'flex',
    gap: 6,
    overflowX: 'auto',
    scrollbarWidth: 'none',
    paddingBottom: 2,
    WebkitOverflowScrolling: 'touch',
  } as React.CSSProperties,
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 } as React.CSSProperties,
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 } as React.CSSProperties,
  empty: {
    textAlign: 'center',
    padding: 32,
    borderRadius: 16,
    background: 'rgba(255,255,255,0.02)',
    border: '1px dashed rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.45)',
  } as React.CSSProperties,
  kicker: { fontSize: 10.5, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', opacity: 0.9 } as React.CSSProperties,
};

// ─── Re-export InfoErrorBoundary ───
export { InfoErrorBoundary };

// ─── Тип state-bag (передаётся во все view) ───
export type SupportStateBag = Record<string, any> & {
  linked: any;
  planResult: PlanResult | null;
  goBack: () => void;
};

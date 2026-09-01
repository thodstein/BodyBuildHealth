/**
 * apple-ui.ts — shared Apple HIG tokens (CombatUI + StrengthUI + CardioUI).
 * Вынесено из дублирования 80% CARD/ROW/BTN/CHIP — теперь единый источник.
 * HIG: SF Pro, hairline 0.5, vibrancy 20px saturate 180%, spring motion.
 */
import React from 'react';

export const GLASS_BG = 'rgba(44,44,46,0.78)';
export const GLASS_BORDER = 'rgba(84,84,88,0.36)';
export const GLASS_SHADOW = '0 1px 3px rgba(0,0,0,0.30), 0 4px 16px rgba(0,0,0,0.24)';
export const VIBRANCY = 'blur(20px) saturate(180%)';
export const SEPARATOR = 'rgba(84,84,88,0.36)';
export const TEXT_1 = '#FFFFFF';
export const TEXT_2 = 'rgba(235,235,245,0.60)';
export const TEXT_3 = 'rgba(235,235,245,0.30)';
export const RADIUS_LG = 14;
export const RADIUS_MD = 10;

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif';

export const CARD: React.CSSProperties = {
  background: GLASS_BG,
  border: `0.5px solid ${GLASS_BORDER}`,
  borderRadius: RADIUS_LG,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  boxShadow: GLASS_SHADOW,
  backdropFilter: VIBRANCY,
  WebkitBackdropFilter: VIBRANCY,
  position: 'relative',
  overflow: 'hidden',
  fontFamily: SF,
};
export const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontFamily: SF };
export const BTN: React.CSSProperties = {
  padding: '11px 18px',
  borderRadius: RADIUS_MD,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  border: '0.5px solid rgba(84,84,88,0.36)',
  background: 'rgba(58,58,60,0.72)',
  color: TEXT_1,
  minHeight: 44,
  whiteSpace: 'nowrap',
  fontFamily: SF,
  letterSpacing: -0.01 * 15,
  transition: 'all 0.20s cubic-bezier(0.2,0,0,1)',
  backdropFilter: 'blur(20px)',
};
export const CHIP: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 20,
  fontSize: 13,
  fontWeight: 590,
  cursor: 'pointer',
  border: '0.5px solid rgba(84,84,88,0.36)',
  background: 'rgba(58,58,60,0.72)',
  color: TEXT_1,
  whiteSpace: 'nowrap',
  minHeight: 34,
  fontFamily: SF,
  transition: 'all 0.18s cubic-bezier(0.2,0,0,1)',
};

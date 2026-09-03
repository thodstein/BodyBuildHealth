import React from "react";
import { getProfile } from "../../../../core/profile-manager";
import type { UserProfile } from "../../../../core/types";

// ─── Helpers ───
export const getProfileSafe = () => { try { return getProfile(); } catch { return null; } };

export const getDefaultKcal = (profile: UserProfile | null) => {
  if (!profile) return 2200;
  const s = profile.settings;
  return s.weight ? Math.round(s.weight * 30) : 2200;
};

export const GlassCard: React.FC<{ title?: string; icon?: string; color?: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ title, icon, color, style, children }) => (
  <div className="plan-glass" data-color={color || 'none'} style={{
    borderRadius: 20, overflow: 'hidden',
    background: 'linear-gradient(180deg, rgba(26,26,30,0.96) 0%, rgba(18,18,20,0.98) 100%)',
    border: '1px solid rgba(255,255,255,0.07)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.38), 0 1px 0 rgba(255,255,255,0.06) inset, 0 0 0 1px rgba(255,255,255,0.02) inset',
    position: 'relative',
    backdropFilter: 'blur(16px) saturate(1.15)',
    WebkitBackdropFilter: 'blur(16px) saturate(1.15)',
    ...style,
  }}>
    {color && <div style={{ height: 3, background: `linear-gradient(90deg, ${color} 0%, ${color}cc 42%, ${color}22 74%, transparent 100%)`, opacity: 0.95 }} />}
    {color && <div style={{ position:'absolute', top: 0, left: 0, right: 0, height: 28, background: `radial-gradient(520px 28px at 18% 0%, ${color}18, transparent 68%)`, pointerEvents:'none' }} />}
    {title && <div style={{ padding: '16px 18px 0', fontSize: 13.5, color: color || '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-0.35px', lineHeight: 1.1 }}>
      {icon && <span style={{
        width: 30, height: 30, borderRadius: 10, display:'flex', alignItems:'center', justifyContent:'center',
        background: color ? `${color}18` : 'rgba(255,255,255,0.07)', border: `1px solid ${color ? `${color}28` : 'rgba(255,255,255,0.08)'}`,
        fontSize: 15, flexShrink: 0, boxShadow: color ? `0 2px 12px ${color}22` : 'none',
      }}>{icon}</span>}{title}
    </div>}
    <div style={{ padding: title ? '14px 18px 18px' : 18 }}>
      {children}
    </div>
  </div>
);

export const PillBtn: React.FC<{ active?: boolean; onClick: () => void; color?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ active, onClick, color, children, style }) => (
  <button onClick={onClick} className="plan-pill" data-active={active || false} style={{
    padding: '8px 16px', borderRadius: 999, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '-0.15px', transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
    transform: active ? 'scale(1.02)' : 'scale(1)',
    fontWeight: active ? 800 : 600,
    background: active ? (color ? `linear-gradient(135deg, ${color}, ${color}dd)` : 'linear-gradient(135deg,#00e68a 0%, #00c8a0 45%, #00b894 100%)') : 'rgba(255,255,255,0.06)',
    border: active ? `1px solid ${color ? `${color}66` : 'rgba(0,230,138,0.5)'}` : '1px solid rgba(255,255,255,0.08)',
    color: active ? (color && color !== '#00e68a' && color !== '#00c8a0' ? '#fff' : '#0A0A0A') : 'rgba(255,255,255,0.72)',
    boxShadow: active ? `0 4px 18px ${color ? `${color}33` : 'rgba(0,230,138,0.28)'}, 0 1px 0 rgba(255,255,255,0.12) inset` : '0 1px 6px rgba(0,0,0,0.18)',
    ...style,
  }}>{children}</button>
);

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 12,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
  color: '#fff', fontSize: 13, boxSizing: 'border-box' as const, outline: 'none',
  boxShadow: '0 1px 8px rgba(0,0,0,0.18) inset',
};

export const selectStyle: React.CSSProperties = {
  ...inputStyle, appearance: 'none' as const,
};

export const greenBtn: React.CSSProperties = {
  width: '100%', padding: 13, borderRadius: 14, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg,#00e68a 0%, #00c8a0 44%, #00b894 100%)', color: '#0A0A0A',
  fontWeight: 800, fontSize: 13, letterSpacing: '-0.25px',
  boxShadow: '0 6px 24px rgba(0,230,138,0.28), 0 1px 0 rgba(255,255,255,0.22) inset',
  transition: 'all 0.22s cubic-bezier(0.16,1,0.3,1)',
};

export const reportPillStyle = (color: string, active: boolean): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: 8, fontSize: 8, cursor: 'pointer', fontWeight: 600,
  background: active ? `${color}18` : '#202023',
  border: active ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.06)',
  color: active ? color : '#fff',
  transition: 'all 0.15s',
});

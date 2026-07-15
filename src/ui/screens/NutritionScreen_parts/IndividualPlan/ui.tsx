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
  <div style={{
    borderRadius: 18, overflow: 'hidden',
    background: '#18181b',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 2px 20px rgba(0,0,0,0.3)',
    position: 'relative',
    ...style,
  }}>
    {color && <div style={{ height: 4, background: `linear-gradient(90deg, ${color}, ${color}66, transparent)` }} />}
    {title && <div style={{ padding: '14px 18px 0', fontSize: 14, color: color || 'rgba(255,255,255,0.75)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.3px' }}>
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>}{title}
    </div>}
    <div style={{ padding: title ? '12px 18px 18px' : 18 }}>
      {children}
    </div>
  </div>
);

export const PillBtn: React.FC<{ active?: boolean; onClick: () => void; color?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ active, onClick, color, children, style }) => (
  <button onClick={onClick} style={{
    padding: '7px 16px', borderRadius: 20, fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '-0.1px', transition: 'all 0.15s ease',
    transform: active ? 'scale(1.05)' : 'scale(1)',
    fontWeight: active ? 800 : 600,
    background: active ? (color ? color : 'linear-gradient(135deg,#00e68a,#00c8a0)') : '#202023',
    border: active ? '2px solid '+(color || '#00e68a') : '1px solid rgba(255,255,255,0.06)',
    color: active ? (color ? '#fff' : '#000') : 'rgba(255,255,255,0.7)',
    boxShadow: active ? '0 2px 16px '+(color || '#00e68a')+'44, 0 0 0 2px '+(color || '#00e68a')+'33' : 'none',
    ...style,
  }}>{children}</button>
);

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 12,
  background: '#202023', border: '1px solid rgba(255,255,255,0.06)',
  color: '#fff', fontSize: 13, boxSizing: 'border-box' as const, outline: 'none',
};

export const selectStyle: React.CSSProperties = {
  ...inputStyle, appearance: 'none' as const,
};

export const greenBtn: React.CSSProperties = {
  width: '100%', padding: 12, borderRadius: 14, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000',
  fontWeight: 700, fontSize: 13, letterSpacing: '-0.2px',
  boxShadow: '0 4px 20px rgba(0,230,138,0.2)',
  transition: 'all 0.2s',
};

export const reportPillStyle = (color: string, active: boolean): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: 8, fontSize: 8, cursor: 'pointer', fontWeight: 600,
  background: active ? `${color}18` : '#202023',
  border: active ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.06)',
  color: active ? color : '#fff',
  transition: 'all 0.15s',
});

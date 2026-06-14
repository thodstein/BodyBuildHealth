import React, { useState } from 'react';

type ScreenId =
  | 'dashboard' | 'pharma' | 'course' | 'peptides'
  | 'nutrition' | 'plan' | 'substances' | 'labs'
  | 'risks' | 'profile' | 'predictive' | 'marketplace'
  | 'articles' | 'assistant' | 'gamification'
  | 'fertility-pct' | 'reports' | 'integrations'
  | 'role-management' | 'support' | 'training';

interface Props {
  onNavigate?: (screen: ScreenId) => void;
}

const NAV_PILLS: { id: ScreenId; icon: string; label: string }[] = [
  { id: 'profile', icon: '👤', label: 'Профиль' },
  { id: 'training', icon: '🏋️', label: 'Тренировки' },
  { id: 'nutrition', icon: '🥗', label: 'Питание' },
  { id: 'articles', icon: '📚', label: 'Статьи' },
];

export const DashboardScreen: React.FC<Props> = ({ onNavigate }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
      <img src="/main-hero.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center center' }} />
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
      <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
        <div style={{ marginBottom:16 }}>
          <h1 style={{ fontSize:24, fontWeight:800, color:'#fff', margin:0, textShadow:'0 2px 14px rgba(0,0,0,0.9)' }}>Главная</h1>
          <p style={{ fontSize:12, color:'rgba(255,255,255,0.85)', margin:'4px 0 0', textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>
            Управляйте здоровьем, тренировками, питанием и фармакологией
          </p>
        </div>
        <div style={{ display:'flex', gap:8, overflowX:'auto', scrollbarWidth:'none', paddingBottom:4 }}>
          {NAV_PILLS.map(p => {
            const hovered = hoveredId === p.id;
            return (
              <button key={p.id} onClick={() => onNavigate?.(p.id)}
                onMouseEnter={() => setHoveredId(p.id)} onMouseLeave={() => setHoveredId(null)}
                style={{
                  display:'flex', alignItems:'center', gap:8, flexShrink:0, cursor:'pointer',
                  padding:'10px 16px', borderRadius:20, border:'1px solid',
                  background: hovered ? 'rgba(200,245,96,0.12)' : 'rgba(20,22,30,0.35)',
                  borderColor: hovered ? 'rgba(200,245,96,0.3)' : 'rgba(255,255,255,0.08)',
                  transition:'all 0.2s',
                  color: hovered ? '#C8F560' : 'rgba(255,255,255,0.9)',
                  fontSize:13, fontWeight:600, whiteSpace:'nowrap',
                }}
              >
                <span style={{ fontSize:16 }}>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

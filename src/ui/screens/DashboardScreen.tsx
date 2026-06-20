import React from 'react';

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

export const DashboardScreen: React.FC<Props> = ({ onNavigate }) => {
  const CARDS = [
    { id: 'profile', icon: '👤', label: 'Профиль', color: '#00e68a' },
    { id: 'marketplace', icon: '🛍️', label: 'Магазин', color: '#06b6d4' },
    { id: 'articles', icon: '📚', label: 'Статьи', color: '#84cc16' },
  ];

  return (
    <div style={{ position:'fixed', inset:0, display:'flex', flexDirection:'column' }}>
      <img src="/bg-profile.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center' }} />
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
      <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {CARDS.map(card => (
            <button key={card.id} onClick={() => onNavigate?.(card.id as ScreenId)} style={{
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4,
              aspectRatio:'1', borderRadius:14, cursor:'pointer',
              background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)',
            }}>
              <span style={{ fontSize:26 }}>{card.icon}</span>
              <span style={{ fontSize:9, fontWeight:700, color: card.color }}>{card.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

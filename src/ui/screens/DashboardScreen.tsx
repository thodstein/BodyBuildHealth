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
    { id: 'profile', icon: '👤' },
    { id: 'marketplace', icon: '🛍️' },
    { id: 'articles', icon: '📚' },
  ];

  return (
    <div style={{ position:'fixed', inset:0, display:'flex', flexDirection:'column' }}>
      <img src="/bg-profile.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center' }} />
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
      <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {CARDS.map(card => (
            <button key={card.id} onClick={() => onNavigate?.(card.id as ScreenId)} style={{
              display:'flex', alignItems:'center', justifyContent:'center', aspectRatio:'1', borderRadius:16, cursor:'pointer',
              background:'rgba(24,24,27,0.2)', border:'1px solid rgba(255,255,255,0.06)',
            }}>
              <span style={{ fontSize:28 }}>{card.icon}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

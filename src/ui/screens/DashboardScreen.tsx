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

const NAV_CARDS: { id: ScreenId; icon: string; label: string }[] = [
  { id: 'profile',  icon: '👤', label: 'Профиль' },
  { id: 'articles', icon: '📚', label: 'Статьи' },
  { id: 'marketplace', icon: '🛍️', label: 'Магазин' },
];

export const DashboardScreen: React.FC<Props> = ({ onNavigate }) => {
  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ flex:1, position:'relative', overflow:'hidden', background:'#0a0a0f' }}>
        <img src="/hero-main.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'fill', opacity:0.3 }} />
      </div>
      <div style={{ padding:'8px 12px 12px', background:'#18181b', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
          {NAV_CARDS.map(card => (
            <button key={card.id} onClick={() => onNavigate?.(card.id)} style={{
              padding:'12px 8px', borderRadius:12, cursor:'pointer', textAlign:'center',
              background:'#202023', border:'1px solid rgba(255,255,255,0.06)',
              transition:'all 0.15s',
            }}>
              <div style={{ fontSize:24, marginBottom:4 }}>{card.icon}</div>
              <div style={{ fontSize:9, fontWeight:600, color:'#fff' }}>{card.label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

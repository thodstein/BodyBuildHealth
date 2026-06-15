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
  { id: 'training', icon: '🏋️', label: 'Тренировки' },
  { id: 'nutrition',icon: '🥗', label: 'Питание' },
  { id: 'articles', icon: '📚', label: 'Статьи' },
];

export const DashboardScreen: React.FC<Props> = ({ onNavigate }) => {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, background:'#000' }}>
      <img src="/hero-main.png" alt="" style={{ width:'100%', height:'100%', objectFit:'contain', objectPosition:'center' }} />
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.7) 80%, rgba(0,0,0,0.95))' }} />
      <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:2, padding:'0 12px 30px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10 }}>
          {NAV_CARDS.map(card => (
            <button key={card.id} onClick={() => onNavigate?.(card.id)} style={{
              aspectRatio:'1',
              borderRadius:16,
              background:'rgba(0,0,0,0.55)',
              border:'1px solid rgba(255,255,255,0.18)',
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              gap:8, padding:10, cursor:'pointer',
              boxShadow:'0 4px 20px rgba(0,0,0,0.5)',
            }}>
              <div style={{ fontSize:28 }}>{card.icon}</div>
              <div style={{ fontSize:10, fontWeight:700, color:'#fff', textAlign:'center' }}>{card.label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

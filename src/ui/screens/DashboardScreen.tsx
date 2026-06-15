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

const NAV_CARDS: { id: ScreenId; icon: string; label: string; color: string }[] = [
  { id: 'profile',  icon: '👤', label: 'Профиль',     color: '#14b8a6' },
  { id: 'training', icon: '🏋️', label: 'Тренировки', color: '#22c55e' },
  { id: 'nutrition',icon: '🥗', label: 'Питание',     color: '#f59e0b' },
  { id: 'articles', icon: '📚', label: 'Статьи',      color: '#a855f7' },
];

export const DashboardScreen: React.FC<Props> = ({ onNavigate }) => {
  return (
    <div style={{ position:'fixed', inset:0, overflow:'hidden' }}>
      {/* Background photo - fills entire screen */}
      <img 
        src="/hero-main.png" 
        alt="" 
        style={{ 
          position:'absolute', 
          inset:0, 
          width:'100%', 
          height:'100%', 
          objectFit:'cover',
          objectPosition:'center'
        }} 
      />
      
      {/* Cards at bottom */}
      <div style={{ 
        position:'absolute', 
        bottom:0, 
        left:0, 
        right:0, 
        zIndex:10,
        padding:'12px 12px 28px',
        background:'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)'
      }}>
        <div style={{ 
          display:'grid', 
          gridTemplateColumns:'repeat(4, 1fr)', 
          gap:10 
        }}>
          {NAV_CARDS.map(card => (
            <button 
              key={card.id} 
              onClick={() => onNavigate?.(card.id)} 
              style={{
                aspectRatio:'1',
                borderRadius:16,
                background:'rgba(0,0,0,0.5)',
                border:'1px solid rgba(255,255,255,0.2)',
                display:'flex',
                flexDirection:'column',
                alignItems:'center',
                justifyContent:'center',
                gap:6,
                padding:8,
                cursor:'pointer',
                boxShadow:'0 4px 16px rgba(0,0,0,0.4)',
              }}
            >
              <div style={{ 
                width:44, 
                height:44, 
                borderRadius:12, 
                display:'flex', 
                alignItems:'center', 
                justifyContent:'center',
                background:'rgba(255,255,255,0.1)',
                fontSize:22
              }}>
                {card.icon}
              </div>
              <div style={{ 
                fontSize:10, 
                fontWeight:700, 
                color:'#fff',
                textAlign:'center',
                lineHeight:1.1
              }}>
                {card.label}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

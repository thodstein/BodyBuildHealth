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
        padding:'20px 16px 32px',
        background:'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)'
      }}>
        <div style={{ 
          display:'grid', 
          gridTemplateColumns:'repeat(4, 1fr)', 
          gap:12 
        }}>
          {NAV_CARDS.map(card => (
            <button 
              key={card.id} 
              onClick={() => onNavigate?.(card.id)} 
              style={{
                aspectRatio:'1',
                borderRadius:20,
                background:'rgba(255,255,255,0.1)',
                backdropFilter:'blur(20px)',
                border:'1px solid rgba(255,255,255,0.15)',
                display:'flex',
                flexDirection:'column',
                alignItems:'center',
                justifyContent:'center',
                gap:8,
                padding:12,
                cursor:'pointer',
                boxShadow:'0 8px 32px rgba(0,0,0,0.3)',
                transition:'all 0.2s',
              }}
            >
              <div style={{ 
                width:48, 
                height:48, 
                borderRadius:14, 
                display:'flex', 
                alignItems:'center', 
                justifyContent:'center',
                background:`${card.color}20`,
                fontSize:24
              }}>
                {card.icon}
              </div>
              <div style={{ 
                fontSize:11, 
                fontWeight:600, 
                color:'#fff',
                textAlign:'center',
                lineHeight:1.2
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

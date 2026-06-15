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
    <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
      <img src="/hero-main.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain', objectPosition:'center', background:'#0a0a0a' }} />
      <div style={{ position:'absolute', left:0, right:0, bottom:'15%', top:'70%', background:'linear-gradient(to top, #0a0a0a 0%, transparent 100%)', zIndex:1 }} />
      <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:2, padding:'8px 16px 24px', background:'linear-gradient(to top, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.7) 60%, transparent 100%)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10 }}>
          {NAV_CARDS.map(card => (
            <button key={card.id} onClick={() => onNavigate?.(card.id)} style={{
            aspectRatio:'1', borderRadius:18, cursor:'pointer',
            background:`rgba(255,255,255,0.07)`, backdropFilter:'blur(16px)',
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              gap:6, padding:8,
              boxShadow:`0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)`,
              border:`1px solid rgba(255,255,255,0.08)`,
              transition:'all 0.2s',
            }}>
              <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', background:`${card.color}15`, fontSize:20 }}>{card.icon}</div>
              <div style={{ fontSize:10, fontWeight:600, color:'#fff', textAlign:'center', lineHeight:1.1 }}>{card.label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

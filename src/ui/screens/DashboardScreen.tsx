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
  { id: 'pharma',   icon: '💉', label: 'Фарма',     color: '#ef4444' },
  { id: 'support',  icon: '🧬', label: 'Поддержка', color: '#8b5cf6' },
  { id: 'training', icon: '🏋️', label: 'Тренировки',color: '#22c55e' },
  { id: 'nutrition',icon: '🥗', label: 'Питание',   color: '#f59e0b' },
  { id: 'labs',     icon: '🧪', label: 'Анализы',   color: '#3b82f6' },
  { id: 'risks',    icon: '📊', label: 'Риски',      color: '#ec4899' },
  { id: 'profile',  icon: '👤', label: 'Профиль',    color: '#14b8a6' },
  { id: 'articles', icon: '📚', label: 'Статьи',     color: '#a855f7' },
];

export const DashboardScreen: React.FC<Props> = ({ onNavigate }) => {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
      <img src="/hero-main.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 35%, rgba(0,0,0,0.65) 70%, rgba(0,0,0,0.92))' }} />
      <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'60px 16px 32px' }}>
        <h1 style={{ fontSize:28, fontWeight:800, color:'#fff', margin:'0 0 2px', textShadow:'0 2px 20px rgba(0,0,0,0.95)', letterSpacing:'-0.5px', lineHeight:1.1 }}>Body Build{'\n'}Health</h1>
        <p style={{ fontSize:12, color:'rgba(255,255,255,0.65)', margin:'4px 0 20px', lineHeight:1.4, textShadow:'0 1px 8px rgba(0,0,0,0.8)', maxWidth:260 }}>
          Фармакология, тренировки, анализы и персональные рекомендации
        </p>
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

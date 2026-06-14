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

const NAV_CARDS: { id: ScreenId; icon: string; label: string; desc: string }[] = [
  { id: 'profile', icon: '👤', label: 'Профиль', desc: 'Управляйте своими данными, целями и настройками' },
  { id: 'training', icon: '🏋️', label: 'Тренировки', desc: 'Планируйте занятия, отслеживайте прогресс' },
  { id: 'nutrition', icon: '🥗', label: 'Питание', desc: 'Ведите дневник питания, контролируйте КБЖУ' },
  { id: 'articles', icon: '📚', label: 'Статьи', desc: 'База знаний по фармакологии и здоровью' },
];

export const DashboardScreen: React.FC<Props> = ({ onNavigate }) => {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
      <img src="/main-hero.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'fill' }} />
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
      <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'0 16px 80px' }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#fff', margin:'0 0 14px', textShadow:'0 2px 14px rgba(0,0,0,0.9)' }}>Главная</h1>
        <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', paddingBottom:2 }}>
          {NAV_CARDS.map(card => (
            <button key={card.id} onClick={() => onNavigate?.(card.id)} style={{
              display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:16, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap',
              background:'rgba(20,22,30,0.35)', border:'1px solid rgba(255,255,255,0.08)',
              fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.9)',
            }}>
              <span>{card.icon}</span>
              <span>{card.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

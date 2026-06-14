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
    <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column', background:'#000' }}>
      <img src="/main-hero.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'fill' }} />
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
      <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
        <div style={{ marginBottom:16 }}>
          <h1 style={{ fontSize:24, fontWeight:800, color:'#fff', margin:0, textShadow:'0 2px 14px rgba(0,0,0,0.9)' }}>Главная</h1>
          <p style={{ fontSize:12, color:'rgba(255,255,255,0.85)', margin:'4px 0 0', textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>
            Управляйте здоровьем, тренировками, питанием и фармакологией
          </p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {NAV_CARDS.map(card => (
            <button key={card.id} onClick={() => onNavigate?.(card.id)} style={{
              display:'flex', flexDirection:'column', gap:8, padding:'14px', borderRadius:14, cursor:'pointer',
              background:'rgba(20,22,30,0.35)', border:'1px solid rgba(255,255,255,0.08)', textAlign:'left',
              transition:'all 0.2s',
            }}>
              <span style={{ fontSize:22 }}>{card.icon}</span>
              <span style={{ fontWeight:700, fontSize:14, color:'rgba(255,255,255,0.95)' }}>{card.label}</span>
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>{card.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

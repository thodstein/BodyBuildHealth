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
      <img src="/main-hero.png?v=2" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'fill' }} />
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
      <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'0 16px 100px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {NAV_CARDS.map(card => (
            <button key={card.id} onClick={() => onNavigate?.(card.id)} style={{
              display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer', textAlign:'left',
              background:'rgba(20,22,30,0.4)', border:'1px solid rgba(255,255,255,0.1)',
              transition:'all 0.2s',
            }}>
              <div style={{ width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'rgba(0,230,138,0.1)', fontSize:18 }}>{card.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14, color:'rgba(255,255,255,0.95)' }}>{card.label}</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', lineHeight:1.3, marginTop:2 }}>{card.desc}</div>
              </div>
              <span style={{ color:'rgba(255,255,255,0.3)', fontSize:14 }}>→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { useProfileRefresh } from '../../core/profile-manager';

type ScreenId = 'dashboard'|'pharma'|'course'|'peptides'|'nutrition'|'plan'|'substances'|'labs'|'risks'|'profile'|'predictive'|'marketplace'|'articles'|'assistant'|'gamification'|'fertility-pct'|'reports'|'integrations'|'role-management'|'support'|'training';

interface Props { onNavigate?: (screen: ScreenId) => void; }

export const DashboardScreen: React.FC<Props> = ({ onNavigate }) => {
  return (
    <div style={{ position:'fixed', inset:0, width:'100%', height:'100dvh', display:'flex', flexDirection:'column', overflow:'hidden', background:'#000' }}>
      <img src="/hero-main.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain', objectPosition:'center center' }} />
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.9) 100%)' }} />
      <div style={{ position:'absolute', bottom:70, left:16, right:16, zIndex:2 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {[
            { id:'profile' as ScreenId, icon:'👤', label:'Профиль', color:'#a78bfa' },
            { id:'marketplace' as ScreenId, icon:'🛍️', label:'Магазин', color:'#f59e0b' },
            { id:'articles' as ScreenId, icon:'📚', label:'Статьи', color:'#3b82f6' },
          ].map(c => (
            <button key={c.id} onClick={() => onNavigate?.(c.id)} style={{
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6,
              aspectRatio:'1', borderRadius:14, cursor:'pointer', border:'1px solid rgba(255,255,255,0.04)',
              background:'rgba(24,24,27,0.15)',
              color:'#fff', transition:'all 0.2s',
            }}>
              <span style={{ fontSize:32 }}>{c.icon}</span>
              <span style={{ fontSize:12, fontWeight:700, color:c.color }}>{c.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

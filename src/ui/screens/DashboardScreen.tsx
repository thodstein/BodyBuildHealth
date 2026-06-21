import React from 'react';
import { useProfileRefresh } from '../../core/profile-manager';

type ScreenId = 'dashboard'|'pharma'|'course'|'peptides'|'nutrition'|'plan'|'substances'|'labs'|'risks'|'profile'|'predictive'|'marketplace'|'articles'|'assistant'|'gamification'|'fertility-pct'|'reports'|'integrations'|'role-management'|'support'|'training';

interface Props { onNavigate?: (screen: ScreenId) => void; }

export const DashboardScreen: React.FC<Props> = ({ onNavigate }) => {
  const p = useProfileRefresh();
  const s = p?.settings || {};

  const goalLabels: Record<string, string> = { mass:'Массонабор', strength:'Сила', fat_loss:'Похудение', cutting:'Сушка', maintenance:'Поддержка', recomposition:'Рекомпозиция', rehab:'Реабилитация' };
  const goalKey = s.primaryGoal || s.goal || 'maintenance';

  return (
    <div style={{ position:'absolute', inset:0, width:'100%', height:'100%', display:'flex', flexDirection:'column', overflow:'hidden', background:'#000' }}>
      {/* Full-screen hero image */}
      <img src="/hero-main.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.75) 100%)' }} />

      {/* Top content overlay */}
      <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'0 20px 0' }}>
        {/* User info */}
        <div style={{ marginBottom:12, padding:'0 4px' }}>
          <div style={{ fontSize:28, fontWeight:700, color:'#fff', letterSpacing:'-0.5px', textShadow:'0 2px 20px rgba(0,0,0,0.5)', marginBottom:2 }}>
            {p?.name || 'BodyBuildHealth'}
          </div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.8)', fontWeight:400, textShadow:'0 1px 10px rgba(0,0,0,0.4)' }}>
            {goalLabels[goalKey]} · {s.weight || '—'} кг · {s.age || '—'} лет
          </div>
        </div>

        {/* 3 square cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
          {[
            { id:'profile' as ScreenId, icon:'👤', label:'Профиль', color:'#a78bfa', sub:'Личные данные' },
            { id:'marketplace' as ScreenId, icon:'🛍️', label:'Магазин', color:'#f59e0b', sub:'БАДы и препараты' },
            { id:'articles' as ScreenId, icon:'📚', label:'Статьи', color:'#3b82f6', sub:'База знаний' },
          ].map(c => (
            <button key={c.id} onClick={() => onNavigate?.(c.id)} style={{
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6,
              aspectRatio:'1', borderRadius:16, cursor:'pointer', border:'none',
              background:'rgba(255,255,255,0.08)',
              color:'#fff', transition:'all 0.2s',
            }}>
              <span style={{ fontSize:36 }}>{c.icon}</span>
              <span style={{ fontSize:13, fontWeight:700, color:c.color }}>{c.label}</span>
              <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>{c.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

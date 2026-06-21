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
    <div style={{ position:'fixed', inset:0, display:'flex', flexDirection:'column' }}>
      <img src="/bg-profile.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 45%, rgba(0,0,0,0.88))' }} />
      <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 90px' }}>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:26, fontWeight:800, color:'#fff', textShadow:'0 2px 12px rgba(0,0,0,0.8)', marginBottom:4 }}>
            {p?.name || 'BodyBuildHealth'}
          </div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.8)', marginBottom:6 }}>
            {goalLabels[goalKey]} · {s.weight || '—'} кг · {s.age || '—'} лет
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <span style={{ fontSize:10, padding:'3px 10px', borderRadius:8, background:'rgba(0,230,138,0.15)', color:'#00e68a', fontWeight:700 }}>
              PAL {Math.min(1.9, Math.max(1.2, 1.2 + (s.workoutsPerWeek || 3) * 0.075)).toFixed(2)}
            </span>
            <span style={{ fontSize:10, padding:'3px 10px', borderRadius:8, background:'rgba(59,130,246,0.15)', color:'#60a5fa', fontWeight:700 }}>
              TDEE {(s.weight || 80) * 30} ккал
            </span>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          {[
            { id:'profile' as ScreenId, icon:'👤', label:'Профиль', color:'#a78bfa' },
            { id:'training' as ScreenId, icon:'🏋️', label:'Тренинг', color:'#3b82f6' },
            { id:'nutrition' as ScreenId, icon:'🥗', label:'Питание', color:'#22c55e' },
          ].map(c => (
            <button key={c.id} onClick={() => onNavigate?.(c.id)} style={{
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8,
              aspectRatio:'1', borderRadius:18, cursor:'pointer',
              background:'rgba(0,0,0,0.25)', border:'1px solid rgba(255,255,255,0.08)',
              backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
            }}>
              <span style={{ fontSize:32 }}>{c.icon}</span>
              <span style={{ fontSize:11, fontWeight:700, color:c.color }}>{c.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

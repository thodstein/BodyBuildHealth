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
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative', minHeight:0 }}>
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 30%, #16213e 60%, #0f3460 100%)', zIndex:0 }} />
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 70% 30%, rgba(0,230,138,0.08) 0%, transparent 60%)', zIndex:1 }} />
      <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', padding:'20px 16px 20px', overflowY:'auto' }}>
        {/* User header */}
        <div style={{ marginBottom:20, paddingTop:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
            <div style={{ width:48, height:48, borderRadius:24, background:'linear-gradient(135deg,#00e68a,#00b864)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:800, color:'#000', flexShrink:0 }}>
              {(p?.name || 'Б')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize:20, fontWeight:800, color:'#fff', textShadow:'0 1px 6px rgba(0,0,0,0.5)' }}>{p?.name || 'BodyBuildHealth'}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.75)', marginTop:1 }}>{goalLabels[goalKey]} · {s.weight || '—'} кг · {s.age || '—'} лет</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1, textAlign:'center', padding:'6px 4px', borderRadius:10, background:'rgba(0,230,138,0.12)', border:'1px solid rgba(0,230,138,0.2)' }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.6)' }}>PAL</div>
              <div style={{ fontSize:16, fontWeight:800, color:'#00e68a' }}>{Math.min(1.9, Math.max(1.2, 1.2 + (s.workoutsPerWeek || 3) * 0.075)).toFixed(2)}</div>
            </div>
            <div style={{ flex:1, textAlign:'center', padding:'6px 4px', borderRadius:10, background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.2)' }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.6)' }}>TDEE</div>
              <div style={{ fontSize:16, fontWeight:800, color:'#60a5fa' }}>{(s.weight || 80) * 30} ккал</div>
            </div>
            <div style={{ flex:1, textAlign:'center', padding:'6px 4px', borderRadius:10, background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.2)' }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.6)' }}>Тренировок</div>
              <div style={{ fontSize:16, fontWeight:800, color:'#a78bfa' }}>{s.workoutsPerWeek || 3}/нед</div>
            </div>
          </div>
        </div>

        {/* Navigation buttons */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginTop:4 }}>
          {[
            { id:'profile' as ScreenId, icon:'👤', label:'Профиль', color:'#a78bfa' },
            { id:'training' as ScreenId, icon:'🏋️', label:'Тренинг', color:'#3b82f6' },
            { id:'nutrition' as ScreenId, icon:'🥗', label:'Питание', color:'#22c55e' },
            { id:'labs' as ScreenId, icon:'🩸', label:'Анализы', color:'#ef4444' },
            { id:'pharma' as ScreenId, icon:'💊', label:'Фарма', color:'#ec4899' },
            { id:'risks' as ScreenId, icon:'⚠️', label:'Риски', color:'#f97316' },
            { id:'support' as ScreenId, icon:'🧪', label:'БАДы', color:'#06b6d4' },
            { id:'course' as ScreenId, icon:'📋', label:'Курс', color:'#f59e0b' },
            { id:'marketplace' as ScreenId, icon:'🛍️', label:'Магазин', color:'#8b5cf6' },
          ].map(c => (
            <button key={c.id} onClick={() => onNavigate?.(c.id)} style={{
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4,
              aspectRatio:'1', borderRadius:14, cursor:'pointer',
              background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)',
              color:'#fff', fontSize:9, fontWeight:600,
            }}>
              <span style={{ fontSize:24 }}>{c.icon}</span>
              <span style={{ color:c.color, fontSize:9, fontWeight:700 }}>{c.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

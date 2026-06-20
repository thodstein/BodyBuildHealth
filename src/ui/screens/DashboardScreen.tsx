import React from 'react';
import { useDataLink } from '../../core/data-link';
import { calcNutrition } from '../../engines/nutrition.engine';

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

export const DashboardScreen: React.FC<Props> = ({ onNavigate }) => {
  const linked = useDataLink();
  const profile = linked.profile;
  const pal = profile?.settings?.workoutsPerWeek
    ? Math.min(1.9, Math.max(1.2, 1.2 + (profile.settings.workoutsPerWeek * 0.075) + ((profile.settings.avgWorkoutMinutes || 45) > 60 ? 0.1 : 0)))
    : 1.55;
  const weight = profile?.settings?.weight || 80;
  const height = profile?.settings?.height || 175;
  const age = profile?.settings?.age || 30;
  const bmr = Math.round(10 * weight + 6.25 * height - 5 * age + (profile?.settings?.sex === 'male' ? 5 : -161));
  const tdee = pal * bmr;
  const goal = profile?.settings?.primaryGoal || 'maintenance';
  const nutrition = calcNutrition({ weightKg: weight, heightCm: height, age, sex: profile?.settings?.sex || 'male', pal, goal });

  const CARDS = [
    { id: 'profile', icon: '👤', label: 'Профиль', desc: 'Настройки, замеры, дневники, отчёты', color: '#00e68a' },
    { id: 'nutrition', icon: '🥗', label: 'Питание', desc: 'Дневник, графики, планы, рецепты', color: '#22c55e' },
    { id: 'training', icon: '🏋️', label: 'Тренинг', desc: 'Планы, упражнения, дневник, циклы', color: '#3b82f6' },
    { id: 'labs', icon: '🔬', label: 'Анализы', desc: 'Результаты, каталог, график сдачи', color: '#a855f7' },
    { id: 'risks', icon: '⚠️', label: 'Риски', desc: 'Расчёты, клиника, Монте-Карло', color: '#ef4444' },
    { id: 'pharma', icon: '💊', label: 'Фарма', desc: 'Курс, калькуляторы, взаимодействия', color: '#f59e0b' },
    { id: 'support', icon: '🧪', label: 'БАДы', desc: 'Каталог, синергии, стеки, план', color: '#ec4899' },
    { id: 'marketplace', icon: '🛍️', label: 'Магазин', desc: 'Покупка препаратов и добавок', color: '#06b6d4' },
    { id: 'articles', icon: '📚', label: 'Статьи', desc: 'База знаний и исследований', color: '#84cc16' },
  ];

  return (
    <div style={{ position:'fixed', inset:0, display:'flex', flexDirection:'column' }}>
      <img src="/bg-profile.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 45%, rgba(0,0,0,0.85))' }} />

      <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 70px' }}>
        <h1 style={{ fontSize:24, fontWeight:800, color:'#fff', margin:'0 0 2px', textShadow:'0 2px 14px rgba(0,0,0,0.9)' }}>
          {profile?.name ? `${profile.name}` : 'BodyBuild Health'}
        </h1>
        <p style={{ fontSize:11, color:'rgba(255,255,255,0.9)', margin:'0 0 4px', textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>
          PAL {pal.toFixed(2)} · TDEE {Math.round(tdee)} ккал
        </p>
        <p style={{ fontSize:10, color:'rgba(255,255,255,0.7)', margin:'0 0 14px', textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>
          {nutrition ? `Б:${Math.round(nutrition.protein)}г Ж:${Math.round(nutrition.fats)}г У:${Math.round(nutrition.carbs)}г` : ''}
        </p>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
          {CARDS.map(card => (
            <button key={card.id} onClick={() => onNavigate?.(card.id as ScreenId)} style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'14px 6px', borderRadius:14, cursor:'pointer', textAlign:'center',
              background:'rgba(24,24,27,0.2)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff',
            }}>
              <div style={{ width:40, height:40, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background: card.color + '22', fontSize:18 }}>{card.icon}</div>
              <div style={{ fontSize:9, fontWeight:700, lineHeight:1.2, color: card.color }}>{card.label}</div>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.6)', lineHeight:1.2 }}>{card.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

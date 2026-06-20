import React, { useState, useEffect } from 'react';
import { useDataLink } from '../../core/data-link';
import { db } from '../../core/db';
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

const NAV_BUTTONS: { id: ScreenId; icon: string; label: string }[] = [
  { id: 'profile', icon: '👤', label: 'Профиль' },
  { id: 'pharma', icon: '💊', label: 'Фарма' },
  { id: 'training', icon: '🏋️', label: 'Тренировки' },
  { id: 'nutrition', icon: '🥗', label: 'Питание' },
  { id: 'labs', icon: '🔬', label: 'Анализы' },
  { id: 'risks', icon: '⚠️', label: 'Риски' },
  { id: 'support', icon: '🧪', label: 'Поддержка' },
  { id: 'fertility-pct', icon: '🧬', label: 'ПКТ' },
  { id: 'assistant', icon: '🤖', label: 'Ассистент' },
  { id: 'articles', icon: '📚', label: 'Статьи' },
  { id: 'marketplace', icon: '🛍️', label: 'Магазин' },
  { id: 'reports', icon: '📊', label: 'Отчёты' },
];

const s: Record<string, React.CSSProperties> = {
  card: { borderRadius:12, padding:14, marginBottom:10, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' },
  label: { fontSize:9, color:'rgba(255,255,255,0.6)', marginBottom:2, textTransform:'uppercase', letterSpacing:0.5 },
  value: { fontSize:18, fontWeight:700, color:'#fff' },
  row: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 },
  tag: { fontSize:10, padding:'3px 8px', borderRadius:6, fontWeight:600 },
};

export const DashboardScreen: React.FC<Props> = ({ onNavigate }) => {
  const linked = useDataLink();
  const [dailyKcal, setDailyKcal] = useState(0);
  const [dailyProtein, setDailyProtein] = useState(0);
  const [dailyFat, setDailyFat] = useState(0);
  const [dailyCarbs, setDailyCarbs] = useState(0);

  useEffect(() => {
    db.getAll('food_diary').then(entries => {
      const today = new Date().toISOString().slice(0, 10);
      const todayMeals = entries.filter((e: any) => e.date === today);
      let k = 0, p = 0, f = 0, c = 0;
      todayMeals.forEach((m: any) => { k += m.kcal || 0; p += m.protein || 0; f += m.fat || 0; c += m.carbs || 0; });
      setDailyKcal(k); setDailyProtein(p); setDailyFat(f); setDailyCarbs(c);
    }).catch(() => {});
  }, []);

  const profile = linked.profile;
  const risk = linked.risk;
  const course = linked.course;
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

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'16px 14px 8px' }}>
        <h2 style={{ margin:0, fontSize:20, color:'#fff' }}>🏠 Главная</h2>
        <p style={{ margin:'2px 0 0', fontSize:11, color:'rgba(255,255,255,0.7)' }}>Сводка по всем системам</p>
      </div>

      <div style={{ flex:1, overflow:'auto', padding:'0 14px 14px' }}>
        <div style={s.card}>
          <div style={s.label}>Профиль</div>
          <div style={s.value}>{profile?.name || 'Не заполнен'}</div>
          <div style={{ ...s.row, marginTop:6, gap:4 }}>
            {profile?.settings?.primaryGoal && <span style={{ ...s.tag, background:'rgba(0,230,138,0.1)', color:'#00e68a' }}>{goal === 'bulk' ? 'Масса' : goal === 'cut' ? 'Сушка' : goal === 'maintenance' ? 'Поддержание' : goal === 'recomposition' ? 'Реcompl' : goal === 'strength' ? 'Сила' : goal === 'hypertrophy' ? 'Гипертрофия' : goal === 'fitness' ? 'Фитнес' : goal === 'endurance' ? 'Выносливость' : goal === 'health' ? 'Здоровье' : goal === 'rehab' ? 'Реабилитация' : 'Не указано'}</span>}
            <span style={{ ...s.tag, background:'rgba(59,130,246,0.1)', color:'#3b82f6' }}>PAL {pal.toFixed(2)}</span>
            <span style={{ ...s.tag, background:'rgba(234,179,8,0.1)', color:'#eab308' }}>TDEE {Math.round(tdee)} ккал</span>
          </div>
        </div>

        {risk && (
          <div style={s.card}>
            <div style={s.label}>Общий риск</div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:32, fontWeight:800, color: risk.overallRaw > 60 ? '#ef4444' : risk.overallRaw > 30 ? '#eab308' : '#22c55e' }}>{Math.round(risk.overallRaw)}%</span>
              <div style={{ flex:1 }}>
                <div style={{ height:6, borderRadius:3, background:'rgba(255,255,255,0.1)', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${risk.overallRaw}%`, borderRadius:3, background: risk.overallRaw > 60 ? '#ef4444' : risk.overallRaw > 30 ? '#eab308' : '#22c55e', transition:'width 0.4s' }} />
                </div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.6)', marginTop:3 }}>{risk.systemBreakdown ? Object.entries(risk.systemBreakdown).filter(([_,v]) => v.raw > 20).length : 0} систем с повышенным риском</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div style={s.card}>
            <div style={s.label}>Тренировки</div>
            <div style={{ fontSize:13, fontWeight:600, color:'#fff' }}>{profile?.settings?.workoutsPerWeek || 0}×/нед</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)' }}>{profile?.settings?.avgWorkoutMinutes || 45} мин/тренировка</div>
          </div>
          <div style={s.card}>
            <div style={s.label}>Курс</div>
            <div style={{ fontSize:13, fontWeight:600, color:'#fff' }}>{course?.length || 0} препаратов</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)' }}>{course?.length ? `Нед ${Math.min(...course.map(c=>c.startWeek))}-${Math.max(...course.map(c=>c.endWeek))}` : 'Нет активного курса'}</div>
          </div>
        </div>

        {nutrition && (
          <div style={s.card}>
            <div style={s.label}>Питание сегодня</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginTop:6 }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:16, fontWeight:700, color:'#00e68a' }}>{Math.round(dailyKcal)}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.6)' }}>ккал / {Math.round(nutrition.kcal)}</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:16, fontWeight:700, color:'#3b82f6' }}>{Math.round(dailyProtein)}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.6)' }}>белки / {Math.round(nutrition.protein)}г</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:16, fontWeight:700, color:'#eab308' }}>{Math.round(dailyFat)}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.6)' }}>жиры / {Math.round(nutrition.fats)}г</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:16, fontWeight:700, color:'#ef4444' }}>{Math.round(dailyCarbs)}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.6)' }}>угли / {Math.round(nutrition.carbs)}г</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop:0 }}>
          <div style={s.label}>Навигация</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginTop:6 }}>
            {NAV_BUTTONS.map(btn => (
              <button key={btn.id} onClick={() => onNavigate?.(btn.id)} style={{
                padding:'10px 4px', borderRadius:10, cursor:'pointer', textAlign:'center',
                background:'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ fontSize:18, marginBottom:2 }}>{btn.icon}</div>
                <div style={{ fontSize:8, fontWeight:600, color:'#fff', lineHeight:1.2 }}>{btn.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

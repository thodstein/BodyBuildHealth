import React, { useState, useMemo } from 'react';
import { ModernHero, modernCardBg } from './nutrition-modern-kit';

const ACHIEVEMENTS = [
  { id: 'iron_will', name: 'Железная воля', icon: '💪', desc: 'Заполнять дневник питания 7 дней подряд', target: 7, unit: 'дней' },
  { id: 'biochemist', name: 'Биохимик', icon: '🧬', desc: 'Внести анализы крови 3 раза в месяц', target: 3, unit: 'раз/мес' },
  { id: 'mtor_master', name: 'mTOR-мастер', icon: '🧬', desc: 'Активировать mTOR во всех приёмах 5 дней подряд', target: 5, unit: 'дней' },
  { id: 'peak_form', name: 'Пик формы', icon: '⚡', desc: 'Пройти пиковую неделю с соблюдением рекомендаций', target: 7, unit: 'дней' },
  { id: 'gourmet', name: 'Гурман', icon: '🍽️', desc: 'Использовать более 50 различных продуктов', target: 50, unit: 'продуктов' },
  { id: 'detox_master', name: 'Мастер Детокса', icon: '🌿', desc: 'detox_support_level HIGH 14 дней подряд', target: 14, unit: 'дней' },
  { id: 'omega_balance', name: 'Омега-Баланс', icon: '🐟', desc: 'Омега-6/3 < 4:1 в течение месяца', target: 30, unit: 'дней' },
  { id: 'clean_kidneys', name: 'Чистые Почки', icon: '🫘', desc: 'Низкие urea/Cr + PRAL 30 дней', target: 30, unit: 'дней' },
  { id: 'anti_ammonia', name: 'Анти-Аммиак', icon: '💨', desc: '7 дней без высоких аммиачных рисков', target: 7, unit: 'дней' },
  { id: 'insulin_control', name: 'Инсулиновый Контроль', icon: '💉', desc: 'Инсулин-Сенс в зелёной зоне 30 дней', target: 30, unit: 'дней' },
  { id: 'vitamin_balance', name: 'Витаминный Баланс', icon: '💊', desc: '30 дней без критических дефицитов микронутриентов', target: 30, unit: 'дней' },
  { id: 'omega_check', name: 'Квест-мастер', icon: '🎯', desc: 'Выполнить 30 ежедневных квестов', target: 30, unit: 'квестов' },
];

type AchievementState = { progress: number; unlocked: boolean };

export const Achievements: React.FC = () => {
  const [state, setState] = useState<Record<string, AchievementState>>(() => {
    try { return JSON.parse(localStorage.getItem('he_achievements') || '{}'); } catch { return {}; }
  });
  const [showAll, setShowAll] = useState(false);
  const display = showAll ? ACHIEVEMENTS : ACHIEVEMENTS.filter(a => state[a.id]?.progress > 0 || state[a.id]?.unlocked);

  const resetProgress = () => {
    const fresh: Record<string, AchievementState> = {};
    // Simulate some progress for demo — in real app this tracks actual user data
    ACHIEVEMENTS.forEach((a, i) => {
      fresh[a.id] = { progress: i === 0 ? 7 : i < 4 ? Math.min(a.target, i * 3) : 0, unlocked: i === 0 };
    });
    setState(fresh);
    localStorage.setItem('he_achievements', JSON.stringify(fresh));
  };

  const unlockedCount = Object.values(state).filter(s => s.unlocked).length;

  return (
    <div style={{ paddingBottom: 80 }}>
      <ModernHero icon="🏆" title="Достижения" subtitle="Награды за регулярность, цели и рекорды." />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6' }}>🏆 Достижения</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>{unlockedCount}/{ACHIEVEMENTS.length}</div>
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 12, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg,#8b5cf6,#c084fc)', transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 8, color: '#8b5cf6', fontWeight: 700 }}>{Math.round(unlockedCount / ACHIEVEMENTS.length * 100)}%</span>
        </div>
        <button onClick={resetProgress} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 7, cursor: 'pointer', background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.1)', color: '#00e68a' }}>🔄 Сбросить прогресс</button>
        <button onClick={() => setShowAll(!showAll)} style={{ marginLeft: 4, padding: '2px 8px', borderRadius: 6, fontSize: 7, cursor: 'pointer', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.1)', color: '#8b5cf6' }}>{showAll ? '✅ Все' : '🔍 В процессе'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {display.map(a => {
          const s = state[a.id] || { progress: 0, unlocked: false };
          const pct = Math.min(100, Math.round(s.progress / a.target * 100));
          return (
            <div key={a.id} style={{
              padding: '8px', borderRadius: 10,
              background: s.unlocked ? 'rgba(139,92,246,0.06)' : 'rgba(24,24,27,0.6)',
              border: s.unlocked ? '1px solid rgba(139,92,246,0.2)' : '1px solid rgba(255,255,255,0.04)',
              opacity: s.progress === 0 && !s.unlocked ? 0.5 : 1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 14 }}>{a.icon}</span>
                {s.unlocked && <span style={{ fontSize: 8, color: '#c084fc' }}>✅</span>}
              </div>
              <div style={{ fontSize: 8, fontWeight: 600, color: s.unlocked ? '#c084fc' : '#fff', marginBottom: 2 }}>{a.name}</div>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.8)', lineHeight: 1.3, marginBottom: 4 }}>{a.desc}</div>
              <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: s.unlocked ? '#c084fc' : pct > 0 ? '#8b5cf6' : 'rgba(255,255,255,0.1)' }} />
              </div>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>{s.unlocked ? '✅ Выполнено!' : `${s.progress}/${a.target} ${a.unit}`}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

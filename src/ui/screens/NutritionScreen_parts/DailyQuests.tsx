import React, { useState } from 'react';

const QUESTS = [
  { id: 'protein_target', text: '🥩 Достигните 2.5 г белка на кг LBM', icon: '🥩' },
  { id: 'fiber_target', text: '🌾 Употребите не менее 30 г клетчатки', icon: '🌾' },
  { id: 'omega_ratio', text: '🐟 Омега-6/3 соотношение менее 4:1', icon: '🐟' },
  { id: 'detox_high', text: '🌿 Включите 3 продукта с detox HIGH', icon: '🌿' },
  { id: 'enzyme_low', text: '🔬 Снизьте ферментную нагрузку до 40', icon: '🔬' },
  { id: 'avoid_athero', text: '🚫 Избегайте продуктов с atherogenic HIGH', icon: '🚫' },
  { id: 'chromium_berberine', text: '💊 Добавьте продукт с хромом/берберином', icon: '💊' },
  { id: 'iodine_100', text: '🧂 Потребление йода > 100 мкг', icon: '🧂' },
];

export const DailyQuests: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const todayQuestIdx = dayOfYear % QUESTS.length;
  const todayQuest = QUESTS[todayQuestIdx];

  const [completed, setCompleted] = useState<string[]>(() => {
    try { const raw = JSON.parse(localStorage.getItem('he_quests_completed') || '{}'); return raw[today] || []; } catch { return []; }
  });
  const [score, setScore] = useState<number>(() => {
    try { return JSON.parse(localStorage.getItem('he_quest_score') || '0'); } catch { return 0; }
  });

  const toggleQuest = (id: string) => {
    const upd = completed.includes(id) ? completed.filter(c => c !== id) : [...completed, id];
    setCompleted(upd);
    try {
      const raw = JSON.parse(localStorage.getItem('he_quests_completed') || '{}');
      raw[today] = upd;
      localStorage.setItem('he_quests_completed', JSON.stringify(raw));
    } catch {}
    if (!completed.includes(id)) {
      const ns = score + 10;
      setScore(ns);
      localStorage.setItem('he_quest_score', JSON.stringify(ns));
    } else {
      const ns = Math.max(0, score - 10);
      setScore(ns);
      localStorage.setItem('he_quest_score', JSON.stringify(ns));
    }
  };

  const questOfDay = QUESTS[todayQuestIdx];

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>🎯 Ежедневные квесты</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>🏆 {score} баллов</div>
      </div>

      <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.12)', marginBottom: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#f97316', marginBottom: 2 }}>Квест дня</div>
        <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>{questOfDay.text}</div>
        <button onClick={() => toggleQuest(questOfDay.id)} style={{
          padding: '4px 12px', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
          background: completed.includes(questOfDay.id) ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.03)',
          border: completed.includes(questOfDay.id) ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
          color: completed.includes(questOfDay.id) ? '#00e68a' : 'rgba(255,255,255,0.6)',
        }}>{completed.includes(questOfDay.id) ? '✅ Выполнено +10' : '○ Отметить'}</button>
      </div>

      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>Все квесты</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {QUESTS.map(q => (
          <div key={q.id} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8,
            background: completed.includes(q.id) ? 'rgba(0,230,138,0.04)' : 'rgba(24,24,27,0.6)',
            border: `1px solid ${completed.includes(q.id) ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.04)'}`,
            cursor: 'pointer', opacity: q.id !== questOfDay.id ? 0.5 : 1,
          }} onClick={() => q.id === questOfDay.id && toggleQuest(q.id)}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: completed.includes(q.id) ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${completed.includes(q.id) ? 'rgba(0,230,138,0.3)' : 'rgba(255,255,255,0.06)'}`,
              color: completed.includes(q.id) ? '#00e68a' : 'transparent', fontSize: 8, fontWeight: 700,
            }}>{completed.includes(q.id) ? '✓' : ''}</div>
            <div style={{ flex: 1, fontSize: 8, color: q.id === questOfDay.id ? '#fff' : 'rgba(255,255,255,0.4)' }}>{q.text}</div>
            <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)' }}>{q.id === questOfDay.id ? '🎯' : '🔒'}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

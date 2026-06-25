import React, { useState } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { autoFillFromMainProfile, saveBioStackProfile } from '../../engines/biostack-ai.engine';
import { buildStack } from '../../engines/supplement-finder.engine';
import { GlassCard, PillBtn, Slider, toFinderProfile, inputS, selectS, GOALS, HEALTH_CONDS } from './BioStackAIConstants';
import { type GutSensitivity, type AlcoholLevel, type AASStatus, type CognitiveTask, type StimSensitivity, type CaffeineLevel, type ADClass, type DietType, type Chronotype, type BudgetLevel, type StackComplexity } from '../../engines/biostack-ai.engine';

export function ProfileTab({ profile, setProfile, setStackIds }: { profile: BioStackProfile; setProfile: (p: BioStackProfile) => void; setStackIds?: (ids: string[]) => void }) {
  const u = (patch: Partial<BioStackProfile>) => { const n = { ...profile, ...patch }; setProfile(n); saveBioStackProfile(n); };
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickDone, setQuickDone] = useState(false);

  const handleQuickStack = () => {
    setQuickLoading(true);
    setQuickDone(false);
    setTimeout(() => {
      const fp = toFinderProfile(profile);
      const result = buildStack({
        baseIds: [], targetSize: 10,
        goal: profile.goals[0] || undefined,
        autoFill: true, profile: fp,
      });
      if (setStackIds) setStackIds(result.stack);
      setQuickLoading(false);
      setQuickDone(true);
      setTimeout(() => setQuickDone(false), 2500);
    }, 400);
  };

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard title="Личные данные" icon="👤" color="#60a5fa">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Возраст</label>
            <input type="number" value={profile.age} onChange={e => u({ age: +e.target.value || 0 })} style={inputS} /></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Вес (кг)</label>
            <input type="number" value={profile.weight} onChange={e => u({ weight: +e.target.value || 0 })} style={inputS} /></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Рост (см)</label>
            <input type="number" value={profile.height} onChange={e => u({ height: +e.target.value || 0 })} style={inputS} /></div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <PillBtn active={profile.sex === 'male'} onClick={() => u({ sex: 'male' })} color="#60a5fa">♂ Мужской</PillBtn>
          <PillBtn active={profile.sex === 'female'} onClick={() => u({ sex: 'female' })} color="#f472b6">♀ Женский</PillBtn>
          {(['beginner','intermediate','advanced'] as const).map(l => (
            <PillBtn key={l} active={profile.experience === l} onClick={() => u({ experience: l })}>
              {l === 'beginner' ? '🌱 Новичок' : l === 'intermediate' ? '💪 Средний' : '🔥 Продвинутый'}
            </PillBtn>
          ))}
        </div>
      </GlassCard>

      <GlassCard title="Здоровье" icon="🫀" color="#ef4444">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Систолическое</label>
            <input type="number" value={profile.bpSystolic} onChange={e => u({ bpSystolic: +e.target.value || 120 })} style={inputS} /></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Диастолическое</label>
            <input type="number" value={profile.bpDiastolic} onChange={e => u({ bpDiastolic: +e.target.value || 80 })} style={inputS} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>ЖКТ</label>
            <select value={profile.gutSensitivity} onChange={e => u({ gutSensitivity: e.target.value as GutSensitivity })} style={selectS}>
              <option value="normal">🟢 Норма</option><option value="sensitive">🟡 Чувствительный</option><option value="problematic">🔴 Проблемный</option>
            </select></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Курение</label>
            <select value={profile.smoke ? 'yes' : 'no'} onChange={e => u({ smoke: e.target.value === 'yes' })} style={selectS}>
              <option value="no">🚭 Нет</option><option value="yes">🚬 Да</option>
            </select></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Алкоголь</label>
            <select value={profile.alcoholLevel} onChange={e => u({ alcoholLevel: e.target.value as AlcoholLevel })} style={selectS}>
              <option value="none">✖ Не пью</option><option value="rare">🍷 Редко</option><option value="moderate">🍺 1-3/нед</option><option value="daily">🔴 Ежедневно</option>
            </select></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>ААС-статус</label>
            <select value={profile.aasStatus} onChange={e => u({ aasStatus: e.target.value as AASStatus })} style={selectS}>
              <option value="none">✖ Без ААС</option><option value="trt">💉 TRT</option><option value="course">💊 Курс</option><option value="pct">🔄 ПКТ</option>
              <option value="bridge">🌉 Бридж</option><option value="fertility">🧬 Фертильность</option>
            </select></div>
        </div>
        <div style={{ marginBottom: 4 }}>
          <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Состояния здоровья:</label>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {HEALTH_CONDS.map(h => (
              <PillBtn key={h.key} active={profile.healthConditions.includes(h.key)}
                onClick={() => u({ healthConditions: profile.healthConditions.includes(h.key) ? profile.healthConditions.filter(x => x !== h.key) : [...profile.healthConditions, h.key] })}>
                {h.label}
              </PillBtn>
            ))}
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Нейро-статус" icon="🧠" color="#a78bfa">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Тип задачи</label>
            <select value={profile.cognitiveTask} onChange={e => u({ cognitiveTask: e.target.value as CognitiveTask })} style={selectS}>
              <option value="memory">🧠 Память</option><option value="focus">🎯 Фокус</option><option value="creativity">💡 Креативность</option>
              <option value="reaction_speed">⚡ Скорость реакции</option><option value="learning">📚 Учёба</option>
            </select></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Чувствит. к стимуляторам</label>
            <select value={profile.stimSensitivity} onChange={e => u({ stimSensitivity: e.target.value as StimSensitivity })} style={selectS}>
              <option value="low">🟢 Низкая</option><option value="medium">🟡 Средняя</option><option value="high">🔴 Высокая</option>
            </select></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Кофеин</label>
            <select value={profile.caffeineLevel} onChange={e => u({ caffeineLevel: e.target.value as CaffeineLevel })} style={selectS}>
              <option value="none">✖ Не пью</option><option value="low">☕ 1-2 чашки</option><option value="moderate">☕☕ 3-5 чашек</option><option value="high">☕☕☕ 5+ чашек</option>
            </select></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Антидепрессанты</label>
            <select value={profile.adClass} onChange={e => u({ adClass: e.target.value as ADClass })} style={selectS}>
              <option value="none">✖ Нет</option><option value="ssri">💊 СИОЗС</option><option value="snri">💊 СИОЗСиН</option>
              <option value="maoi">💊 ИМАО</option><option value="tca">💊 ТЦА</option><option value="other">💊 Другие</option>
            </select></div>
        </div>
        <Slider value={profile.anxietyLevel} onChange={v => u({ anxietyLevel: v })} label="Тревожность" emoji="😰" />
        <Slider value={profile.sleepQuality} onChange={v => u({ sleepQuality: v })} label="Качество сна" emoji="😴" />
        <Slider value={profile.stressLevel} onChange={v => u({ stressLevel: v })} label="Уровень стресса" emoji="⚡" />
      </GlassCard>

      <GlassCard title="Образ жизни" icon="🌍" color="#22c55e">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Питание</label>
            <select value={profile.dietType} onChange={e => u({ dietType: e.target.value as DietType })} style={selectS}>
              <option value="mixed">🍖 Смешанное</option><option value="vegetarian">🥦 Вегетарианское</option>
              <option value="vegan">🌱 Веганское</option><option value="keto">🥑 Кето</option>
              <option value="paleo">🥩 Палео</option><option value="mediterranean">🫒 Средиземноморское</option>
            </select></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Хронотип</label>
            <select value={profile.chronotype} onChange={e => u({ chronotype: e.target.value as Chronotype })} style={selectS}>
              <option value="lark">🌅 Жаворонок</option><option value="owl">🦉 Сова</option><option value="mixed">🐦 Смешанный</option>
            </select></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Бюджет</label>
            <select value={profile.budget} onChange={e => u({ budget: e.target.value as BudgetLevel })} style={selectS}>
              <option value="economy">💰 Эконом</option><option value="medium">💵 Средний</option><option value="premium">💎 Премиум</option>
            </select></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Сложность стека</label>
            <select value={profile.stackComplexity} onChange={e => u({ stackComplexity: e.target.value as StackComplexity })} style={selectS}>
              <option value="minimal">🔵 Минимальный (3-5)</option><option value="balanced">🟢 Сбалансированный (5-10)</option><option value="maximum">🔴 Максимальный (10-20)</option>
            </select></div>
        </div>
      </GlassCard>

      <GlassCard title="Цели" icon="🎯" color="#f59e0b">
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {GOALS.map(g => (
            <PillBtn key={g.key} active={profile.goals.includes(g.key)}
              onClick={() => u({ goals: profile.goals.includes(g.key) ? profile.goals.filter(x => x !== g.key) : [...profile.goals, g.key] })}>
              {g.label}
            </PillBtn>
          ))}
        </div>
      </GlassCard>

      <GlassCard title="Текущие БАДы" icon="💊" color="#8b5cf6">
        <input value={profile.currentSupplements.join(', ')} onChange={e => u({ currentSupplements: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} style={inputS} placeholder="nap: nac, omega3, tudca" />
      </GlassCard>

      <button onClick={() => { const filled = autoFillFromMainProfile(); if (Object.keys(filled).length > 0) setProfile({ ...profile, ...filled }); }}
        style={{ width: '100%', padding: 12, borderRadius: 14, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontWeight: 700, fontSize: 13,
          boxShadow: '0 4px 20px rgba(0,230,138,0.2)', marginBottom: 6 }}>
        📥 Заполнить из профиля
      </button>

      <button onClick={handleQuickStack} disabled={quickLoading} style={{
        width: '100%', padding: 12, borderRadius: 14, cursor: quickLoading ? 'wait' : 'pointer', marginBottom: 6,
        background: quickDone ? 'rgba(0,230,138,0.1)' : 'rgba(139,92,246,0.1)',
        border: `1px solid ${quickDone ? 'rgba(0,230,138,0.2)' : 'rgba(139,92,246,0.2)'}`,
        color: quickDone ? '#00e68a' : '#8b5cf6', fontWeight: 700, fontSize: 12,
      }}>
        {quickLoading ? '⏳ Собираем стек...' : quickDone ? '✅ Стек собран! Откройте 📋 Мой стек' : '⚡ Быстрый стек по профилю'}
      </button>
      <div style={{ textAlign: 'center', fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
        ⚡ Профиль сохраняется автоматически
      </div>
    </div>
  );
}

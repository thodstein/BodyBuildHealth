import React, { useMemo } from 'react';
import { calcTrust, checkAchievements, ACHIEVEMENTS, GamificationState } from '../../engines/gamification.full';

const CHALLENGES = [
  { id: 'no_skip_week', name: '', xp: 200, daysTotal: 7 },
  { id: 'calorie_deficit_5', name: '5 РґРЅРµР№ РїРѕРґСЂСЏРґ РІ РґРµС„РёС†РёС‚Рµ РєР°Р»РѕСЂРёР№', xp: 150, daysTotal: 5 },
  { id: 'cardio_articles_3', name: '', xp: 100, articlesTotal: 3 },
];

export const GamificationScreen: React.FC = () => {
  const [diaryFillRate, setDiaryFillRate] = React.useState(0.5);
  const [nutritionAdherence, setNutritionAdherence] = React.useState(0.5);
  const [labMatchRate, setLabMatchRate] = React.useState(0.5);
  const [trainerFeedback, setTrainerFeedback] = React.useState(0.5);
  const [challengeProgress, setChallengeProgress] = React.useState<Record<string, number>>({
    no_skip_week: 3,
    calorie_deficit_5: 2,
    cardio_articles_3: 1,
  });

  const state: GamificationState = useMemo(() => {
    const unlockedIds = checkAchievements({
      diaryFillRate, nutritionAdherence, labMatchRate, trainerFeedback,
      achievements: [], xp: 0, challenges: {},
    }).map(a => a.id);
    const baseXP = ACHIEVEMENTS.filter(a => unlockedIds.includes(a.id)).reduce((s, a) => s + a.xp, 0);
    return {
      diaryFillRate, nutritionAdherence, labMatchRate, trainerFeedback,
      achievements: unlockedIds, xp: baseXP, challenges: {},
    };
  }, [diaryFillRate, nutritionAdherence, labMatchRate, trainerFeedback]);

  const unlocked = useMemo(() => checkAchievements(state), [state]);
  const unlockedIds = useMemo(() => new Set(unlocked.map(a => a.id)), [unlocked]);
  const trust = useMemo(() => calcTrust(state), [state]);

  const totalXP = state.xp;

  const levelLabel = trust.level === 'conservative' ? '' : trust.level === 'aggressive' ? '' : '';

  return (
    <div className="screen gamification">
      <h2>Р“РµР№РјРёС„РёРєР°С†РёСЏ</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 4px' }}>РћС†РµРЅРєР° РґРѕРІРµСЂРёСЏ</h3>
          <div style={{ fontSize: 36, fontWeight: 800, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{trust.score}</div>
          <p style={{ margin: '4px 0', color: 'var(--text-dim)', fontSize: 13 }}>{levelLabel}</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--accent)' }}>Г—{trust.volumeMultiplier} РѕР±СЉС‘Рј</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 4px' }}>РћРїС‹С‚ (XP)</h3>
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--info)' }}>{totalXP}</div>
          <p style={{ margin: '4px 0', color: 'var(--text-dim)', fontSize: 13 }}>РћС‡РєРё РѕРїС‹С‚Р°</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 12px' }}>Р”РѕСЃС‚РёР¶РµРЅРёСЏ</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {ACHIEVEMENTS.map(a => {
            const isUnlocked = unlockedIds.has(a.id);
            return (
              <div key={a.id} style={{
                background: isUnlocked ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                border: `1px solid ${isUnlocked ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 10, padding: 10, opacity: isUnlocked ? 1 : 0.5
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{a.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 12 }}>{a.name}</div>
                <div style={{ fontSize: 11, color: isUnlocked ? 'var(--accent)' : 'var(--text-dim)' }}>+{a.xp} XP</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 12px' }}>Р§РµР»Р»РµРЅРґР¶Рё</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CHALLENGES.map(c => {
            const progress = challengeProgress[c.id] || 0;
            const total = c.daysTotal ?? c.articlesTotal ?? 1;
            const pct = Math.min(100, Math.round((progress / total) * 100));
            return (
              <div key={c.id} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--accent)' }}>+{c.xp} XP</span>
                </div>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 4, height: 6 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{progress}/{total}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 12px' }}>Р¤РѕСЂРјСѓР»Р° РґРѕРІРµСЂРёСЏ</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text-dim)' }}>Р—Р°РїРѕР»РЅРµРЅРёРµ РґРЅРµРІРЅРёРєР° Г— 20</span>
            <span style={{ fontWeight: 600 }}>{(state.diaryFillRate * 20).toFixed(1)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text-dim)' }}>РЎРѕР±Р»СЋРґРµРЅРёРµ РїРёС‚Р°РЅРёСЏ Г— 30</span>
            <span style={{ fontWeight: 600 }}>{(state.nutritionAdherence * 30).toFixed(1)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text-dim)' }}>РЎРѕРѕС‚РІРµС‚СЃС‚РІРёРµ Р°РЅР°Р»РёР·РѕРІ Г— 30</span>
            <span style={{ fontWeight: 600 }}>{(state.labMatchRate * 30).toFixed(1)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text-dim)' }}>РћР±СЂР°С‚РЅР°СЏ СЃРІСЏР·СЊ С‚СЂРµРЅРµСЂР° Г— 20</span>
            <span style={{ fontWeight: 600 }}>{(state.trainerFeedback * 20).toFixed(1)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <span>РС‚РѕРіРѕ</span>
            <span style={{ color: 'var(--accent)' }}>{trust.score} вЂ” {levelLabel}</span>
          </div>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
          РљРѕРЅСЃРµСЂРІР°С‚РёРІРЅС‹Р№ &lt;40, РЎС‚Р°РЅРґР°СЂС‚РЅС‹Р№ 40вЂ“79, РђРіСЂРµСЃСЃРёРІРЅС‹Р№ в‰Ґ80. РњРЅРѕР¶РёС‚РµР»СЊ РѕР±СЉС‘РјР° {trust.volumeMultiplier} РІР»РёСЏРµС‚ РЅР° РїРµСЂСЃРѕРЅР°Р»РёР·Р°С†РёСЋ РґРѕР·РёСЂРѕРІРѕРє.
        </p>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 12px' }}>РќР°СЃС‚СЂРѕР№РєР° РїР°СЂР°РјРµС‚СЂРѕРІ</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13 }}>Р—Р°РїРѕР»РЅРµРЅРёРµ РґРЅРµРІРЅРёРєР°: {(state.diaryFillRate * 100).toFixed(0)}%</span>
            <input type="range" min="0" max="1" step="0.01" value={state.diaryFillRate} onChange={e => setDiaryFillRate(parseFloat(e.target.value))} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13 }}>РЎРѕР±Р»СЋРґРµРЅРёРµ РїРёС‚Р°РЅРёСЏ: {(state.nutritionAdherence * 100).toFixed(0)}%</span>
            <input type="range" min="0" max="1" step="0.01" value={state.nutritionAdherence} onChange={e => setNutritionAdherence(parseFloat(e.target.value))} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13 }}>РЎРѕРѕС‚РІРµС‚СЃС‚РІРёРµ Р°РЅР°Р»РёР·РѕРІ: {(state.labMatchRate * 100).toFixed(0)}%</span>
            <input type="range" min="0" max="1" step="0.01" value={state.labMatchRate} onChange={e => setLabMatchRate(parseFloat(e.target.value))} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13 }}>РћР±СЂР°С‚РЅР°СЏ СЃРІСЏР·СЊ С‚СЂРµРЅРµСЂР°: {(state.trainerFeedback * 100).toFixed(0)}%</span>
            <input type="range" min="0" max="1" step="0.01" value={state.trainerFeedback} onChange={e => setTrainerFeedback(parseFloat(e.target.value))} />
          </label>
        </div>
      </div>
    </div>
  );
};
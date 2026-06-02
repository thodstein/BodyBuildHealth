import React, { useMemo } from 'react';
import { calcTrust, checkAchievements, ACHIEVEMENTS, GamificationState } from '../../engines/gamification.full';

const CHALLENGES = [
  { id: 'no_skip_week', name: 'Неделя без пропусков тренировок', xp: 200, daysTotal: 7 },
  { id: 'calorie_deficit_5', name: '5 дней подряд в дефиците калорий', xp: 150, daysTotal: 5 },
  { id: 'cardio_articles_3', name: 'Прочитать 3 статьи по кардиопротекции за 7 дней', xp: 100, articlesTotal: 3 },
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

  const levelLabel = trust.level === 'conservative' ? 'Консервативный' : trust.level === 'aggressive' ? 'Агрессивный' : 'Стандартный';

  return (
    <div className="screen gamification">
      <h2>Геймификация</h2>

      <div className="gamification-stats">
        <div className="stat-card">
          <h3>Trust Score</h3>
          <div className="trust-score">{trust.score}</div>
          <p>{levelLabel}</p>
          <p className="vol-multiplier">×{trust.volumeMultiplier} объём</p>
        </div>
        <div className="stat-card">
          <h3>XP</h3>
          <div className="xp-score">{totalXP}</div>
          <p>Очки опыта</p>
        </div>
      </div>

      <h3>Ачивки</h3>
      <div className="achievements-grid">
        {ACHIEVEMENTS.map(a => (
          <div key={a.id} className={`achievement-card ${unlockedIds.has(a.id) ? 'unlocked' : 'locked'}`}>
            <div className="achievement-icon">{a.icon}</div>
            <div className="achievement-info">
              <h4>{a.name}</h4>
              <span className="xp-tag">+{a.xp} XP</span>
            </div>
          </div>
        ))}
      </div>

      <h3>Челленджи</h3>
      <div className="challenges-list">
        {CHALLENGES.map(c => {
          const progress = challengeProgress[c.id] || 0;
          const total = c.daysTotal ?? c.articlesTotal ?? 1;
          const pct = Math.min(100, Math.round((progress / total) * 100));
          return (
            <div key={c.id} className="challenge-card">
              <h4>{c.name}</h4>
              <div className="challenge-progress-bar">
                <div className="challenge-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <p>{progress}/{total} — +{c.xp} XP</p>
            </div>
          );
        })}
      </div>

      <h3>Trust Score — формула</h3>
      <div className="trust-breakdown">
        <div className="trust-formula-row">
          <span>diaryFillRate × 20</span>
          <span>{(state.diaryFillRate * 20).toFixed(1)}</span>
        </div>
        <div className="trust-formula-row">
          <span>nutritionAdherence × 30</span>
          <span>{(state.nutritionAdherence * 30).toFixed(1)}</span>
        </div>
        <div className="trust-formula-row">
          <span>labMatchRate × 30</span>
          <span>{(state.labMatchRate * 30).toFixed(1)}</span>
        </div>
        <div className="trust-formula-row">
          <span>trainerFeedback × 20</span>
          <span>{(state.trainerFeedback * 20).toFixed(1)}</span>
        </div>
        <div className="trust-formula-row total">
          <span>Итого</span>
          <span>{trust.score} — {levelLabel}</span>
        </div>
        <p className="trust-note">
          Уровень: консервативный &lt;40, стандартный 40–79, агрессивный ≥80. Множитель объёма {trust.volumeMultiplier} влияет на персонализацию дозировок.
        </p>
      </div>

      <h3>Настройка параметров</h3>
      <div className="sliders">
        <label>
          diaryFillRate: {state.diaryFillRate.toFixed(2)}
          <input type="range" min="0" max="1" step="0.01" value={state.diaryFillRate}
            onChange={e => setDiaryFillRate(parseFloat(e.target.value))} />
        </label>
        <label>
          nutritionAdherence: {state.nutritionAdherence.toFixed(2)}
          <input type="range" min="0" max="1" step="0.01" value={state.nutritionAdherence}
            onChange={e => setNutritionAdherence(parseFloat(e.target.value))} />
        </label>
        <label>
          labMatchRate: {state.labMatchRate.toFixed(2)}
          <input type="range" min="0" max="1" step="0.01" value={state.labMatchRate}
            onChange={e => setLabMatchRate(parseFloat(e.target.value))} />
        </label>
        <label>
          trainerFeedback: {state.trainerFeedback.toFixed(2)}
          <input type="range" min="0" max="1" step="0.01" value={state.trainerFeedback}
            onChange={e => setTrainerFeedback(parseFloat(e.target.value))} />
        </label>
      </div>
    </div>
  );
};
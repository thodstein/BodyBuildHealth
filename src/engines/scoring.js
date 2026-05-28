const DB = require('../data/database');

function calculateScore(userInput, mappedSubstances) {
  // 1. Инициализация счётчиков
  const scores = {
    effects: {}, mechanisms: {}, organs: {}, systems: {}, axes: {},
    global: {}, total_risk: 0, support_score: 0, risk_after_support: 0,
    recommendations: []
  };

  // 2. Агрегация эффектов → механизмы → органы → системы
  mappedSubstances.forEach(sub => {
    sub.effects.forEach(ef => {
      scores.effects[ef.id] = (scores.effects[ef.id] || 0) + (sub.dose ? 1 : 1); // Упрощённо: вес эффекта = 1
    });
  });

  // Маппинг эффектов на механизмы и органы
  Object.entries(scores.effects).forEach(([effectId, weight]) => {
    const mech = DB.mechanisms.find(m => m.MECHANISM_ID === effectId || m.MECHANISM_ID === effectId.replace('_UP', '').replace('_DOWN', ''));
    if (mech) {
      scores.mechanisms[mech.MECHANISM_ID] = (scores.mechanisms[mech.MECHANISM_ID] || 0) + weight;
      if (mech.ORGANS_UP) mech.ORGANS_UP.split(';').forEach(o => scores.organs[o] = (scores.organs[o] || 0) + weight);
      if (mech.ORGANS_DOWN) mech.ORGANS_DOWN.split(';').forEach(o => scores.organs[o] = (scores.organs[o] || 0) - weight);
    }
  });

  // 3. Агрегация систем и осей
  Object.keys(scores.organs).forEach(organ => {
    const axis = DB.axes.find(a => a.ORGANS?.includes(organ));
    if (axis) scores.axes[axis.AXIS_ID] = (scores.axes[axis.AXIS_ID] || 0) + scores.organs[organ];
    // Простой маппинг орган → система (берём из categories.csv как пример)
    const cat = DB.categories.find(c => c.ID?.includes(organ));
    if (cat?.TYPE === 'ORGAN') scores.systems[cat.TYPE] = (scores.systems[cat.TYPE] || 0) + scores.organs[organ];
  });

  // 4. Расчёт общего риска
  scores.total_risk = Object.values(scores.mechanisms).reduce((a, b) => a + Math.abs(b), 0) +
                      Object.values(scores.organs).reduce((a, b) => a + Math.abs(b), 0) +
                      Object.values(scores.axes).reduce((a, b) => a + Math.abs(b), 0);

  // 5. Поддержка (суплементы снижают риск)
  const supportItems = userInput.substances?.filter(s => s.category?.includes('supplement')) || [];
  scores.support_score = supportItems.length * 10; // Упрощённая модель
  scores.risk_after_support = Math.max(0, scores.total_risk - scores.support_score);

  // 6. Генерация рекомендаций
  DB.recommendations.forEach(rec => {
    if (scores.risk_after_support > 50 && rec.LEVELS?.includes('HIGH')) {
      scores.recommendations.push(rec);
    }
  });

  return scores;
}

module.exports = { calculateScore };
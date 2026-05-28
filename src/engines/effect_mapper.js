const DB = require('../data/database');

function mapAll(substances) {
  return substances.map(s => {
    const effectIds = s.effects || [];
    const effectList = effectIds.map(id => DB.effects.find(e => e.EFFECT_ID === id)).filter(Boolean);
    const mechanismIds = [...new Set(effectList.map(e => e.MECHANISM || e.EFFECT_ID))];
    const mechanismList = mechanismIds.map(id => DB.mechanisms.find(m => m.MECHANISM_ID === id)).filter(Boolean);
    
    return {
      ...s,
      effects: effectList,
      mechanisms: mechanismList.map(m => ({
        id: m.MECHANISM_ID,
        organs_up: m.ORGANS_UP ? m.ORGANS_UP.split(';') : [],
        risks_up: m.RISKS_UP ? m.RISKS_UP.split(';') : []
      }))
    };
  });
}

module.exports = { mapAll };
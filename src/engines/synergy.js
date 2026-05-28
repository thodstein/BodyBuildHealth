const DB = require('../data/database');

function getInteractionPenalty(aId, bId) {
  const link = DB.interactions.find(i => 
    (i.SUBSTANCE_A === aId && i.SUBSTANCE_B === bId) || 
    (i.SUBSTANCE_A === bId && i.SUBSTANCE_B === aId)
  );
  if (!link) return 0;
  if (link.SEVERITY === 'HIGH') return -10;
  if (link.SEVERITY === 'MEDIUM') return -5;
  if (link.TYPE === 'synergy') return 2;
  return 0;
}

function calculatePair(a, b) {
  const sharedMech = a.mechanisms.filter(m => b.mechanisms.includes(m)).length;
  const oppositeMech = a.mechanisms.filter(m => b.mechanisms.includes(m.replace('_UP', '_DOWN').replace('_DOWN', '_UP'))).length;
  const sharedTargets = (a.targets || []).filter(t => (b.targets || []).includes(t)).length;
  const penalty = getInteractionPenalty(a.id, b.id);
  const categoryBonus = a.category === b.category ? 2 : 0;

  const score = sharedMech * 2 + oppositeMech * -3 + sharedTargets * 1 + penalty + categoryBonus;
  return { a: a.id, b: b.id, score, level: score > 8 ? 'STRONG_SYNERGY' : score > 3 ? 'GOOD_SYNERGY' : score >= 0 ? 'NEUTRAL' : score > -5 ? 'WEAK_CONFLICT' : 'DANGEROUS_CONFLICT' };
}

module.exports = { calculatePair };
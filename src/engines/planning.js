const Synergy = require('./synergy');

function generate(input) {
  const { systems, organs, mechanisms, substances } = input;
  const goals = defineGoals(systems, organs, mechanisms);
  const pool = selectSubstances(goals, substances);
  const filtered = filterInteractions(pool);
  const ranked = rankBySynergy(filtered);
  return buildPlan(ranked);
}

function defineGoals(systems, organs, mechanisms) {
  return { systems: systems.slice(0, 3), organs: organs.slice(0, 3), mechanisms: mechanisms.slice(0, 5) };
}

function selectSubstances(goals, substances) {
  const mechList = goals.mechanisms.map(m => m.MECHANISM_ID);
  return substances.filter(s => s.mechanisms?.some(m => mechList.includes(m)));
}

function filterInteractions(pool) {
  return pool.filter(a => pool.every(b => a.id === b.id || getInteractionLevel(a.id, b.id) !== 'HIGH'));
}

function getInteractionLevel(a, b) {
  const res = Synergy.calculatePair({id:a, mechanisms:[]}, {id:b, mechanisms:[]});
  return res.level.includes('DANGEROUS') ? 'HIGH' : null;
}

function rankBySynergy(pool) {
  return pool.map(s => ({ ...s, synergy_score: Synergy.calculatePair(s, pool.find(x => x !== s) || s).score }))
             .sort((a, b) => b.synergy_score - a.synergy_score);
}

function buildPlan(list) {
  return {
    morning: list.filter(s => s.tags?.includes('ENERGY') || s.tags?.includes('FOCUS')).slice(0, 4),
    day: list.filter(s => s.tags?.includes('METABOLISM') || s.tags?.includes('GUT')).slice(0, 4),
    evening: list.filter(s => s.tags?.includes('SLEEP') || s.tags?.includes('STRESS')).slice(0, 4)
  };
}

module.exports = { generate };
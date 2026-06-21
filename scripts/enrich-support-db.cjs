const fs = require('fs');
const path = require('path');

const ORGAN_TO_SYSTEM = {
  'HEART': 'cardio', 'VESSELS': 'vessels', 'CARDIO': 'cardio',
  'LIVER': 'hepatic', 'KIDNEY': 'renal', 'ADRENALS': 'endocrine',
  'BRAIN': 'neuro', 'NERVES': 'neuro', 'CNS': 'neuro_toxicity',
  'BLOOD': 'blood', 'IMMUNE_SYSTEM': 'immunity', 'THYROID': 'thyroid',
  'PROSTATE': 'prostate', 'SKIN': 'skin', 'BONES': 'musculoskeletal',
  'MUSCLES': 'musculoskeletal', 'JOINTS': 'musculoskeletal',
  'EYES': 'neuro', 'LUNGS': 'immunity', 'PANCREAS': 'metabolic',
  'INTESTINE': 'immunity', 'STOMACH': 'immunity', 'REPRODUCTIVE': 'reproductive',
  'TESTES': 'reproductive', 'OVARIES': 'endocrine', 'HYPOTHALAMUS': 'neuro',
  'PITUITARY': 'endocrine', 'MITOCHONDRIA': 'metabolic',
};

const CATEGORY_RISKS = {
  'antioxidant': [{system:'cardio',direction:'down',strength:0.2},{system:'hepatic',direction:'down',strength:0.2}],
  'anti-inflammatory': [{system:'cardio',direction:'down',strength:0.3},{system:'neuro',direction:'down',strength:0.2}],
  'hepatoprotective': [{system:'hepatic',direction:'down',strength:0.4}],
  'nephroprotective': [{system:'renal',direction:'down',strength:0.3}],
  'cardioprotective': [{system:'cardio',direction:'down',strength:0.3}],
  'neuroprotective': [{system:'neuro',direction:'down',strength:0.3},{system:'neuro_toxicity',direction:'down',strength:0.2}],
  'nootropic': [{system:'neuro',direction:'up',strength:0.1},{system:'neuro_toxicity',direction:'down',strength:0.1}],
  'adaptogen': [{system:'endocrine',direction:'down',strength:0.2},{system:'neuro',direction:'down',strength:0.2}],
  'hypotensive': [{system:'cardio',direction:'down',strength:0.3}],
  'lipid_lowering': [{system:'cardio',direction:'down',strength:0.3}],
  'hypoglycemic': [{system:'metabolic',direction:'down',strength:0.3}],
  'testosterone_booster': [{system:'endocrine',direction:'up',strength:0.3},{system:'reproductive',direction:'up',strength:0.2}],
};

const TYPE_CV = {
  'vitamin': { bloodPressure:'neutral', heartRate:'neutral', vascularTone:'neutral', thrombosisRisk:'low', cnsLoad:'low' },
  'mineral': { bloodPressure:'neutral', heartRate:'neutral', vascularTone:'neutral', thrombosisRisk:'low', cnsLoad:'low' },
  'amino_acid': { bloodPressure:'neutral', heartRate:'neutral', vascularTone:'neutral', thrombosisRisk:'low', cnsLoad:'low' },
  'adaptogen': { bloodPressure:'neutral', heartRate:'neutral', vascularTone:'neutral', thrombosisRisk:'low', cnsLoad:'low' },
  'nootropic': { bloodPressure:'neutral', heartRate:'neutral', vascularTone:'neutral', thrombosisRisk:'low', cnsLoad:'medium' },
  'herb': { bloodPressure:'neutral', heartRate:'neutral', vascularTone:'neutral', thrombosisRisk:'low', cnsLoad:'low' },
  'enzyme': { bloodPressure:'neutral', heartRate:'neutral', vascularTone:'neutral', thrombosisRisk:'low', cnsLoad:'low' },
  'probiotic': { bloodPressure:'neutral', heartRate:'neutral', vascularTone:'neutral', thrombosisRisk:'low', cnsLoad:'low' },
  'fatty_acid': { bloodPressure:'down', heartRate:'neutral', vascularTone:'dilate', thrombosisRisk:'low', cnsLoad:'low' },
  'hormone': { bloodPressure:'up', heartRate:'neutral', vascularTone:'neutral', thrombosisRisk:'medium', cnsLoad:'low' },
};

function deriveFields(sub) {
  const systems = new Set();
  const linkedRisks = [];
  let cv = { bloodPressure:'neutral', heartRate:'neutral', vascularTone:'neutral', thrombosisRisk:'low', cnsLoad:'low' };

  if (sub.organs) sub.organs.forEach(o => { const s = ORGAN_TO_SYSTEM[o.toUpperCase()]; if (s) systems.add(s); });
  if (sub.type && TYPE_CV[sub.type]) cv = { ...TYPE_CV[sub.type] };
  if (sub.categories) sub.categories.forEach(cat => {
    if (CATEGORY_RISKS[cat]) CATEGORY_RISKS[cat].forEach(r => {
      const ex = linkedRisks.find(lr => lr.system === r.system);
      if (ex) ex.strength = Math.max(ex.strength, r.strength);
      else linkedRisks.push({ ...r });
    });
  });
  if (systems.size === 0) { systems.add('cardio'); systems.add('hepatic'); }
  return { targetSystems: [...systems].sort(), targetMechanisms: sub.mechanisms ? sub.mechanisms.slice(0,6) : [],
    linkedRisks: linkedRisks.length > 0 ? linkedRisks : undefined, cvProfile: cv };
}

const filePath = path.join(__dirname, '..', 'src', 'data', 'support-database.ts');
let content = fs.readFileSync(filePath, 'utf8');

const startMarker = 'export const ALL_SUBSTANCES: SupportSubstance[] = [';
const startIdx = content.indexOf(startMarker);
const searchFrom = startIdx + startMarker.length;
const endIdx = content.indexOf('];\n', searchFrom);
if (startIdx < 0 || endIdx < 0) { console.error('ALL_SUBSTANCES array not found'); process.exit(1); }

const before = content.substring(0, startIdx + startMarker.length);
const arrayContent = content.substring(startIdx + startMarker.length, endIdx);
const after = content.substring(endIdx);

// Simple entry parser - each entry starts with `{` and ends with `},` at the same brace level
let result = '';
let i = 0;
let count = 0;

// Split into individual entries by tracking brace depth
const entries = [];
let depth = 0;
let currentEntry = '';
let inEntry = false;

for (let pos = 0; pos < arrayContent.length; pos++) {
  const ch = arrayContent[pos];
  if (!inEntry && ch === '{' && arrayContent.substring(pos-3, pos) !== '//{') {
    inEntry = true;
    currentEntry = ch;
    depth = 1;
  } else if (inEntry) {
    currentEntry += ch;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        // End of entry - check if followed by comma
        const rest = arrayContent.substring(pos + 1);
        const commaMatch = rest.match(/^,\s*/);
        if (commaMatch) {
          entries.push({ text: currentEntry, after: commaMatch[0] });
          pos += commaMatch[0].length;
        } else {
          entries.push({ text: currentEntry, after: '' });
        }
        inEntry = false;
        currentEntry = '';
      }
    }
  }
}

console.log(`Found ${entries.length} substance entries`);

// Process each entry
const processedEntries = entries.map(entry => {
  const text = entry.text;
  
  // Parse fields
  const idMatch = text.match(/id:\s*['"]([^'"]+)['"]/);
  const typeMatch = text.match(/type:\s*['"]([^'"]+)['"]/);
  const catMatch = text.match(/categories:\s*\[([^\]]*)\]/);
  const orgMatch = text.match(/organs:\s*\[([^\]]*)\]/);
  const mechMatch = text.match(/mechanisms:\s*\[([^\]]*)\]/);
  const descMatch = text.match(/description:\s*['"]([^'"]*)['"]/);
  
  const sub = {
    id: idMatch ? idMatch[1] : '',
    type: typeMatch ? typeMatch[1] : '',
    categories: catMatch ? catMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')) : [],
    organs: orgMatch ? orgMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')) : [],
    mechanisms: mechMatch ? mechMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')) : [],
  };
  
  if (!sub.id) return { text, after: entry.after, modified: false };
  
  // Check if already has new fields
  if (text.includes('targetSystems')) return { text, after: entry.after, modified: false };
  
  const fields = deriveFields(sub);
  const ts = fields.targetSystems.map(s => `'${s}'`).join(', ');
  const tm = fields.targetMechanisms.map(m => `'${m}'`).join(', ');
  let insertion;
  if (fields.linkedRisks) {
    const lr = fields.linkedRisks.map(r => `{system:'${r.system}',direction:'${r.direction}',strength:${r.strength}}`).join(', ');
    insertion = `targetSystems: [${ts}], targetMechanisms: [${tm}], linkedRisks: [${lr}], cvProfile: {bloodPressure:'${fields.cvProfile.bloodPressure}',heartRate:'${fields.cvProfile.heartRate}',vascularTone:'${fields.cvProfile.vascularTone}',thrombosisRisk:'${fields.cvProfile.thrombosisRisk}',cnsLoad:'${fields.cvProfile.cnsLoad}'}`;
  } else {
    insertion = `targetSystems: [${ts}], targetMechanisms: [${tm}], cvProfile: {bloodPressure:'${fields.cvProfile.bloodPressure}',heartRate:'${fields.cvProfile.heartRate}',vascularTone:'${fields.cvProfile.vascularTone}',thrombosisRisk:'${fields.cvProfile.thrombosisRisk}',cnsLoad:'${fields.cvProfile.cnsLoad}'}`;
  }
  
  // Insert before closing `}`
  const closeIdx = text.lastIndexOf('}');
  const newText = text.substring(0, closeIdx) + ', ' + insertion + text.substring(closeIdx);
  count++;
  return { text: newText, after: entry.after, modified: true };
});

const newArrayContent = processedEntries.map(e => e.text + e.after).join('\n');
const newContent = before + newArrayContent + after;
fs.writeFileSync(filePath, newContent, 'utf8');
console.log(`Done. Modified ${count} out of ${entries.length} substances.`);

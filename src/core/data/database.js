const fs = require('fs');
const path = require('path');

const parseCSV = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  const lines = raw.split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] || '');
    return obj;
  });
};

const loadJSON = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  // Рекурсивная очистка пробелов в ключах
  const clean = (obj) => {
    if (Array.isArray(obj)) return obj.map(clean);
    if (typeof obj === 'object' && obj !== null) {
      const res = {};
      for (const [k, v] of Object.entries(obj)) {
        res[k.trim().replace(/^"|"$/g, '')] = clean(v);
      }
      return res;
    }
    return obj;
  };
  return clean(data);
};

const DB_PATH = path.join(__dirname, '../../');
module.exports = {
  substances: parseCSV(path.join(DB_PATH, 'substances.csv')),
  effects: parseCSV(path.join(DB_PATH, 'effects.csv')),
  mechanisms: parseCSV(path.join(DB_PATH, 'mechanisms_map.csv')),
  risks: parseCSV(path.join(DB_PATH, 'risks.csv')),
  recommendations: parseCSV(path.join(DB_PATH, 'recommendations.csv')),
  interactions: parseCSV(path.join(DB_PATH, 'interpretations.csv')),
  axes: parseCSV(path.join(DB_PATH, 'axes.csv')),
  categories: parseCSV(path.join(DB_PATH, 'categories.csv')),
  tags: parseCSV(path.join(DB_PATH, 'tags.csv')),
  brands: parseCSV(path.join(DB_PATH, 'brands.csv')),
  links: parseCSV(path.join(DB_PATH, 'interaction_links.csv')),
  dashboard: loadJSON(path.join(DB_PATH, 'dashboard.json')),
  reportConfig: loadJSON(path.join(DB_PATH, 'report.json')),
  recommendationsConfig: loadJSON(path.join(DB_PATH, 'recommendations.json')),
  organsConfig: loadJSON(path.join(DB_PATH, 'organs.json')),
  interactionsConfig: loadJSON(path.join(DB_PATH, 'interactions.json'))
};
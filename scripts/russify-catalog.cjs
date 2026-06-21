const fs = require('fs');
const path = require('path');

// Common English→Russian name mappings for forms
const FORM_RU = {
  'NAC 600mg': 'NAC 600 мг',
  'NAC Premium': 'NAC Премиум',
  'NAC Premium+': 'NAC Премиум+',
  'TUDCA 250mg': 'TUDCA 250 мг',
  'Magnesium Bisglycinate': 'Магний бисглицинат',
  'Magnesium Citrate': 'Магний цитрат',
  'Magnesium Oxide': 'Магний оксид',
  'Magnesium L-Threonate': 'Магний L-треонат',
  'Magnesium Taurate': 'Магний таурат',
  'Ubiquinol 200mg': 'Убихинол 200 мг',
  'Vitamin D3 5000 IU': 'Витамин D3 5000 МЕ',
  'Zinc Picolinate 30mg': 'Цинк пиколинат 30 мг',
  'Selenium Methionine 200mcg': 'Селен метионин 200 мкг',
  'Silymarin 600mg': 'Силимарин 600 мг',
  'Curcumin + Piperine 1000mg': 'Куркумин + Пиперин 1000 мг',
  'Ashwagandha KSM-66 600mg': 'Ашваганда KSM-66 600 мг',
  'Vitamin C 1000mg': 'Витамин C 1000 мг',
  'Vitamin C 1000 mg': 'Витамин C 1000 мг',
  'Taurine 2000mg': 'Таурин 2000 мг',
  'R-ALA 300mg': 'АЛЬК R-форма 300 мг',
  'Berberine HCl 500mg': 'Берберин HCl 500 мг',
  'Vitamin K2 MK-7 200mcg': 'Витамин K2 МК-7 200 мкг',
  'Multi-Strain Probiotic 20B CFU': 'Мультиштаммовый пробиотик 20 млрд КОЕ',
  'Collagen Hydrolysate 10g': 'Коллаген гидролизат 10 г',
  'Glucosamine Sulfate 1500mg': 'Глюкозамин сульфат 1500 мг',
  'Telmisartan 40mg': 'Тельмисартан 40 мг',
  'Nebivolol 5mg': 'Небиволол 5 мг',
  'Iron Bisglycinate': 'Железо бисглицинат',
  'Copper Bisglycinate': 'Медь бисглицинат',
  'Methylcobalamin': 'Метилкобаламин',
  'Omega-3 2000mg': 'Омега-3 2000 мг',
};

const filePath = path.join(__dirname, '..', 'src', 'data', 'support-catalog.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Replace `name:'...'` with `nameRu` equivalent where nameRu exists
// Find patterns: name:'...',nameRu:'Русское...' and replace name with nameRu
let lines = content.split('\n');
let newLines = [];
let count = 0;

for (const line of lines) {
  let newLine = line;
  
  // For main entry names: find name:'...' that differs from nameRu
  const nameRuMatch = line.match(/nameRu:'([^']+)'/);
  if (nameRuMatch && line.includes("name:'") && !line.includes("name:'"+nameRuMatch[1]+"'")) {
    // Replace name:'EnglishName' with name:'RussianName'
    newLine = line.replace(/name:'([^']+)'/, `name:'${nameRuMatch[1]}'`);
    count++;
  }
  
  // For form names: translate English form names to Russian
  for (const [en, ru] of Object.entries(FORM_RU)) {
    if (newLine.includes(`name:'${en}'`)) {
      newLine = newLine.replace(`name:'${en}'`, `name:'${ru}'`);
      count++;
    }
  }
  
  newLines.push(newLine);
}

const newContent = newLines.join('\n');
fs.writeFileSync(filePath, newContent, 'utf8');
console.log(`Done. Changed ${count} names to Russian.`);

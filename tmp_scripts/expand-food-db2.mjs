import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const foods = [
  { id:'beef_ground_lean', name:'Govjazhij farsh (postnyj)', category:'protein', kcal:171, protein:21, fat:10, carbs:0, fiber:0, gi:0, servingSize:'150 g', micros:{ Fe:2.7, Zn:4.8, P:200, VitB3:4.0, VitB12:2.0, Se:15 } },
  { id:'pork_ribs', name:'Svinye rebryshki', category:'protein', kcal:340, protein:16, fat:30, carbs:0, fiber:0, gi:0, servingSize:'150 g', micros:{ Fe:1.0, Zn:3.0, VitB1:0.5, VitB12:0.5, P:150 } },
  { id:'chicken_leg', name:'Kurinaja golen', category:'protein', kcal:185, protein:19, fat:11, carbs:0, fiber:0, gi:0, servingSize:'150 g', micros:{ Fe:1.0, Zn:2.0, P:170, VitB3:4.5, VitB6:0.3 } },
  { id:'flounder', name:'Kambala', category:'protein', kcal:91, protein:18, fat:1.3, carbs:0, fiber:0, gi:0, servingSize:'150 g', micros:{ P:180, K:300, Se:30, VitB12:1.0, Mg:25 } },
  { id:'lobster', name:'Omar/Lobster', category:'protein', kcal:90, protein:19, fat:0.9, carbs:0, fiber:0, gi:0, servingSize:'150 g', micros:{ Zn:3.0, Se:42, VitB12:1.4, Cu:1.5, P:200 } },
  { id:'clams', name:'Molljuski', category:'protein', kcal:74, protein:13, fat:1, carbs:3.6, fiber:0, gi:0, servingSize:'100 g', micros:{ Fe:14, Zn:2.7, VitB12:11, Se:30, Cu:0.7, Mn:0.5 } },
  { id:'pike', name:'Shjuka', category:'protein', kcal:84, protein:18.4, fat:1.1, carbs:0, fiber:0, gi:0, servingSize:'150 g', micros:{ P:200, K:260, Mg:25, VitB12:1.2, Se:15 } },
  { id:'sprat', name:'Kilka', category:'protein', kcal:137, protein:17, fat:7, carbs:0, fiber:0, gi:0, servingSize:'100 g', micros:{ Omega3:1600, Ca:300, VitD:6, VitB12:11, Se:30 } },
];
const filePath = path.join(__dirname, '..', 'src', 'core', 'nutrition-database.ts');
let content = fs.readFileSync(filePath, 'utf8');
if (content.includes('beef_ground_lean')) { console.log('Already present.'); process.exit(0); }
const marker = '];\n\nexport const';
const idx = content.indexOf(marker);
if (idx === -1) { console.error('Marker not found.'); process.exit(1); }
const newContent = '\n' + foods.map(f => '  ' + JSON.stringify(f)).join(',\n') + ',\n';
content = content.slice(0, idx) + newContent + content.slice(idx);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Added ' + foods.length + ' foods. File: ' + (content.length/1024).toFixed(0) + 'KB');

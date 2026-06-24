// lms-gen-exercises.cjs — извлечение каталога СРЦ-упражнений из _lms_all.json (Этап B1).
const fs=require('fs');
const _raw=JSON.parse(fs.readFileSync('D:/BodyBuildHealth/scripts/_lms_all.json','utf8'));
const PREFIX='D:/ТЗ/СРЦ/'; const all={};
for(const k of Object.keys(_raw)){ all[k.startsWith(PREFIX)?k.slice(PREFIX.length):k]=_raw[k]; }

const exMap=new Map(); // name -> {group, coef, mnosz, count}
for(const rel of Object.keys(all)){
  const data=all[rel]; if(!data||!data.week1) continue;
  for(const day of data.week1) for(const e of day.exercises){
    const key=e.name.trim();
    if(!key) continue;
    const ex=exMap.get(key)||{name:key, groups:new Set(), coefs:new Set(), mnosz:new Set(), count:0};
    if(e.group) ex.groups.add(e.group);
    if(e.coef) ex.coefs.add(e.coef);
    if(e.mnosz) ex.mnosz.add(e.mnosz);
    ex.count++; exMap.set(key,ex);
  }
}
const list=[...exMap.values()].sort((a,b)=>a.name.localeCompare(b.name,'ru'));
let out=`/**\n * lms-exercises.ts — каталог упражнений СРЦ, извлечённый из 30 xlsm (Этап B1).\n * Обезличено. Подлежит merge с core/exercise-catalog.ts (Этап R, единый реестр).\n */\n\nexport interface LMSExercise {\n  name: string;\n  groups: string[];   // классификация источника (ЖМ/ПР/ТГ/Ср...)\n  coef: number;       // Коэф. тяжести (типичное)\n  mnosz: number;      // Множ (типичное)\n  uses: number;       // в скольких циклах/днях встречается\n}\n\nexport const LMS_EXERCISES: LMSExercise[] = [\n`;
for(const e of list){
  const coef=[...e.coefs][0]||1; const mnosz=[...e.mnosz][0]||1;
  out+=`  { name: ${JSON.stringify(e.name)}, groups: ${JSON.stringify([...e.groups])}, coef: ${coef}, mnosz: ${mnosz}, uses: ${e.count} },\n`;
}
out+=`];\n\nexport function getLMSExercise(name: string): LMSExercise | undefined {\n  return LMS_EXERCISES.find(e => e.name.toLowerCase() === name.toLowerCase());\n}\n\nexport const LMS_EXERCISE_NAMES: string[] = LMS_EXERCISES.map(e => e.name);\n`;
fs.writeFileSync('D:/BodyBuildHealth/src/data/lms-cycles/lms-exercises.ts',out,'utf8');
console.log('exercises:', list.length);
console.log('sample:', list.slice(0,8).map(e=>e.name).join(', '));

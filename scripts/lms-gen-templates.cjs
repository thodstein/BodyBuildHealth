// lms-gen-templates.cjs — генерация TS-шаблонов с описанием howItWorks + conditions (Этап B3).
const fs=require('fs');
const _raw=JSON.parse(fs.readFileSync('D:/BodyBuildHealth/scripts/_lms_all.json','utf8'));
const PREFIX='D:/ТЗ/СРЦ/';
const all={};
for(const k of Object.keys(_raw)){ const nk=k.startsWith(PREFIX)?k.slice(PREFIX.length):k; all[nk]=_raw[k]; }
const OUTDIR='D:/BodyBuildHealth/src/data/lms-cycles';
const DESCROOT='D:/ТЗ/СРЦ';

function clean(s){ return String(s||'').replace(/==/g,'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[[^\]]*\]\([^)]*\)/g,'').replace(/\s+/g,' ').trim(); }

function extractDesc(file){
  let txt='';
  try{ txt=fs.readFileSync(file,'utf8'); }catch(e){ return {howItWorks:'',conditions:[]}; }
  // strip yaml front matter
  txt=txt.replace(/^---[\s\S]*?---/,'');
  const uIdx=txt.indexOf('Условия соответствия');
  let how='', cond=[];
  if(uIdx>=0){
    how=clean(txt.slice(0,uIdx));
    // conditions: from uIdx to next major section
    let rest=txt.slice(uIdx);
    const stops=['Текст инструкции','Как уже говорилось','Инструкция по использованию','В графе','## ','### '];
    let stopIdx=rest.length;
    for(const st of stops){ const i=rest.indexOf(st, 20); if(i>0 && i<stopIdx) stopIdx=i; }
    const condTxt=clean(rest.slice(0,stopIdx));
    // split into sentences
    cond=condTxt.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(s=>s.length>15 && s.length<240).slice(0,7);
  } else {
    how=clean(txt);
  }
  how=how.slice(0,700);
  return {howItWorks:how, conditions:cond};
}

const MAP={
 '1/cycle1.xlsm':['cycle-01','Силовой цикл 1 (троеборье)','powerlifting','II-KMS','strength',80,12,'1/Описание.txt'],
 '2/cycle2.xlsm':['cycle-02','Силовой цикл 2 (троеборье)','powerlifting','KMS-MS','strength',80,12,'2/Описание.txt'],
 '3/cycle3.xlsm':['cycle-03','Цикл на выносливость (жим, новичок)','bench','novice','endurance',80,12,'3/Описание.txt'],
 '4/cycle4.xlsm':['cycle-04','Силовой цикл (армрестлинг, верх)','armwrestling','II-KMS','strength',80,12,'4/Описание.txt'],
 '5/cycle5.xlsm':['cycle-05','Силовой цикл (жим, II-КМС)','bench','II-KMS','strength',80,12,'5/Описание.txt'],
 '6/cycle6.xlsm':['cycle-06','Силовой цикл (жим, КМС-МС)','bench','KMS-MS','strength',80,12,'6/Описание.txt'],
 '7/cycle7.xlsm':['cycle-07','Выход на пик (троеборье, МС-МСМК)','powerlifting','MS-MSMK','peak',70,12,'7/Описание.txt'],
 '8/cycle8.xlsm':['cycle-08','Массонабор (бодибилдинг, средний)','bodybuilding','intermediate','mass',80,12,'8/Описание.txt'],
 '9/cycle9k.xlsm':['cycle-09k','Смешанный (тяга+жим, классика)','deadlift_bench','MS-MSMK','mixed',80,12,'9/Описание.txt'],
 '9/cycle9s.xlsm':['cycle-09s','Смешанный (тяга+жим, сумо)','deadlift_bench','MS-MSMK','mixed',80,12,'9/Описание.txt'],
 '10/cycle10.xlsm':['cycle-10','Выносливость (жим, КМС-МС)','bench','KMS-MS','endurance',80,12,'10/Описание.txt'],
 '11/cycle11.xlsm':['cycle-11','Выносливость (жим, МС-МСМК)','bench','MS-MSMK','endurance',80,12,'11/Описание.txt'],
 '12/cycle12k.xlsm':['cycle-12k','Выносливость (тяга+жим, классика)','deadlift_bench','MS-MSMK','endurance',80,12,'12/Описание.txt'],
 '12/cycle12s.xlsm':['cycle-12s','Выносливость (тяга+жим, сумо)','deadlift_bench','MS-MSMK','endurance',80,12,'12/Описание.txt'],
 '13/cycle13.xlsm':['cycle-13','Смешанный интенсифицированный (жим)','bench','KMS-MSMK','mixed',null,12,'13/описание.txt'],
 '14/cycle14.xlsm':['cycle-14','Смешанный (троеборье, II-МС, 3 дн)','powerlifting','II-MS','mixed',60,12,'14/описание.txt'],
 '15/cycle15.xlsm':['cycle-15','Выход на пик (жим, II-КМС, 2 дн)','bench','II-KMS','peak',60,12,'15/описание.txt'],
 '16/cycle16.xlsm':['cycle-16','Выносливость (жим, II-КМС, 2 дн)','bench','II-KMS','endurance',60,12,'16/описание.txt'],
 'Блочные саморасчитывающиеся циклы для жимовиков/IntenseBeginner.xlsm':['block-bench-beg','Блочный: жим, новичок','bench','novice','peak',60,4,'Блочные саморасчитывающиеся циклы для жимовиков/Блочные саморасчитывающиеся циклы для жимовиков.md'],
 'Блочные саморасчитывающиеся циклы для жимовиков/IntenseIntermediate.xlsm':['block-bench-int','Блочный: жим, средний','bench','II-MS','peak',60,4,'Блочные саморасчитывающиеся циклы для жимовиков/Блочные саморасчитывающиеся циклы для жимовиков.md'],
 'Блочные саморасчитывающиеся циклы для жимовиков/IntenseExperienced.xlsm':['block-bench-exp','Блочный: жим, продвинутый','bench','MS-MSMK','peak',60,4,'Блочные саморасчитывающиеся циклы для жимовиков/Блочные саморасчитывающиеся циклы для жимовиков.md'],
 'Блочные саморасчитывающиеся циклы для пауэрлифтеров/LiftBeginner.xlsm':['block-lift-beg','Блочный: троеборье, новичок','powerlifting','novice','peak',60,4,'Блочные саморасчитывающиеся циклы для пауэрлифтеров/Блочные саморасчитывающиеся циклы для пауэрлифтеров.md'],
 'Блочные саморасчитывающиеся циклы для пауэрлифтеров/LiftIntermediate.xlsm':['block-lift-int','Блочный: троеборье, средний','powerlifting','II-MS','peak',60,4,'Блочные саморасчитывающиеся циклы для пауэрлифтеров/Блочные саморасчитывающиеся циклы для пауэрлифтеров.md'],
 'Блочные саморасчитывающиеся циклы для пауэрлифтеров/LiftExperienced.xlsm':['block-lift-exp','Блочный: троеборье, продвинутый','powerlifting','MS-MSMK','peak',60,4,'Блочные саморасчитывающиеся циклы для пауэрлифтеров/Блочные саморасчитывающиеся циклы для пауэрлифтеров.md'],
 'Встраиваемые циклы для тренировки жима стоя/MPBeginner.xlsm':['embed-mp-beg','Встраиваемый: жим стоя, новичок','bench','novice','strength',null,0,'Встраиваемые циклы для тренировки жима стоя/Встраиваемые циклы для тренировки жима стоя.md'],
 'Встраиваемые циклы для тренировки жима стоя/MPIntermediate.xlsm':['embed-mp-int','Встраиваемый: жим стоя, средний','bench','II-MS','strength',null,0,'Встраиваемые циклы для тренировки жима стоя/Встраиваемые циклы для тренировки жима стоя.md'],
 'Встраиваемые циклы для тренировки жима стоя/MPExperienced.xlsm':['embed-mp-exp','Встраиваемый: жим стоя, продвинутый','bench','MS-MSMK','strength',null,0,'Встраиваемые циклы для тренировки жима стоя/Встраиваемые циклы для тренировки жима стоя.md'],
 'Встраиваемые циклы для тренировки строгого подъема на бицепс/BicBeginner.xlsm':['embed-bic-beg','Встраиваемый: бицепс, новичок','bodybuilding','novice','strength',null,0,'Встраиваемые циклы для тренировки строгого подъема на бицепс/Встраиваемые циклы для тренировки строгого подъема на бицепс.md'],
 'Встраиваемые циклы для тренировки строгого подъема на бицепс/BicIntermediate.xlsm':['embed-bic-int','Встраиваемый: бицепс, средний','bodybuilding','II-MS','strength',null,0,'Встраиваемые циклы для тренировки строгого подъема на бицепс/Встраиваемые циклы для тренировки строгого подъема на бицепс.md'],
 'Встраиваемые циклы для тренировки строгого подъема на бицепс/BicExperienced.xlsm':['embed-bic-exp','Встраиваемый: бицепс, продвинутый','bodybuilding','MS-MSMK','strength',null,0,'Встраиваемые циклы для тренировки строгого подъема на бицепс/Встраиваемые циклы для тренировки строгого подъема на бицепс.md'],
};

function esc(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
function emit(id,title,dir,lvl,period,minW,wk,data,desc){
  const sessions=data.week1?data.week1.length:0;
  const corr=data.corrPct||0.005;
  const weeks=wk||data.weeks||12;
  const w1=data.week1||[];
  const how=desc.howItWorks||(`${title}. ${dir}, уровень ${lvl}, период ${period}. Саморасчитывающийся цикл: раскладка недели 1, недели 2..N генерируются прогрессией PM (коэффициент корректировки ${corr}).`);
  const cond=desc.conditions&&desc.conditions.length?desc.conditions:[];
  let body=`import type { SRCycleTemplate } from './lms-types';\n\n/**\n * ${id}.ts — ${title}. Импортировано из xlsm (Этап A1/B3). Обезличено.\n * Раскладка недели 1; недели 2..${weeks} генерируются прогрессией PM (correctionPct=${corr}).\n */\nexport const ${id.toUpperCase().replace(/-/g,'_')}: SRCycleTemplate = {\n  meta: {\n    id: '${id}',\n    title: '${esc(title)}',\n    direction: '${dir}',\n    level: '${lvl}',\n    period: '${period}',\n    ${minW!=null?`minBodyWeight: ${minW},\n    `:''}sessionsPerWeek: ${sessions},\n    weeks: ${weeks},\n    correctionPct: ${corr},\n    description: '${esc(title)}.',\n    howItWorks: '${esc(how)}',\n    conditions: [${cond.map(c=>`'${esc(c)}'`).join(', ')}],\n  },\n  week1: [\n`;
  for(const day of w1){
    body+=`    { exercises: [\n`;
    for(const e of day.exercises){
      const sets=e.sets.map(s=>`{pct:${s.pct},reps:${s.reps},sets:${s.sets}}`).join(',');
      body+=`      { name: '${esc(e.name)}', group: '${esc(e.group)}', coef: ${e.coef}, mnosz: ${e.mnosz}, ${e.load?`load: '${esc(e.load)}', `:''}sets: [${sets}] },\n`;
    }
    body+=`    ] },\n`;
  }
  body+=`  ],\n};\n`;
  return body;
}

const ids=[];
for(const rel of Object.keys(MAP)){
  const [id,title,dir,lvl,period,minW,wk,descRel]=MAP[rel];
  const data=all[rel]||{week1:[]};
  const desc=extractDesc(`${DESCROOT}/${descRel}`);
  const ts=emit(id,title,dir,lvl,period,minW,wk,data,desc);
  fs.writeFileSync(`${OUTDIR}/${id}.ts`,ts,'utf8');
  ids.push(id);
}
let idx=`/**\n * lms-cycle-index.ts — реестр всех СРЦ-циклов (Этап B2). Обезличено.\n * Единый реестр шаблонов (унификация с cycle.engine.CYCLE_TEMPLATES — Этап R).\n */\nimport type { SRCycleTemplate } from './lms-types';\n\n`;
for(const id of ids){ idx+=`import { ${id.toUpperCase().replace(/-/g,'_')} } from './${id}';\n`; }
idx+=`\nexport const LMS_CYCLES: SRCycleTemplate[] = [\n`;
for(const id of ids){ idx+=`  ${id.toUpperCase().replace(/-/g,'_')},\n`; }
idx+=`];\n\nexport function getCycleById(id: string): SRCycleTemplate | undefined {\n  return LMS_CYCLES.find(c => c.meta.id === id);\n}\nexport function getCyclesByDirection(dir: string): SRCycleTemplate[] {\n  return LMS_CYCLES.filter(c => c.meta.direction === dir);\n}\nexport function getCyclesByLevel(level: string): SRCycleTemplate[] {\n  return LMS_CYCLES.filter(c => c.meta.level === level);\n}\n`;
fs.writeFileSync(`${OUTDIR}/lms-cycle-index.ts`,idx,'utf8');
console.log('generated '+ids.length+' templates with howItWorks');

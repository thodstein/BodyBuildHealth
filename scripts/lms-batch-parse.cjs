// lms-batch-parse.cjs — извлечение week-1 раскладки из всех 30 xlsm (layout-aware: "1 в день" + "Цикл").
const fs=require('fs');
const path=require('path');
const os=require('os');
const { execSync }=require('child_process');
const SRC='D:/ТЗ/СРЦ';
const OUT='D:/BodyBuildHealth/scripts/_lms_all.json';

function extractZip(zipPath, dest){
  if(fs.existsSync(dest)) fs.rmSync(dest,{recursive:true,force:true});
  fs.mkdirSync(dest,{recursive:true});
  execSync(`powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${zipPath.replace(/'/g,"''")}','${dest.replace(/'/g,"''")}')"`,{stdio:'pipe'});
}
function readCells(dir, sheetFile){
  const ssxml=fs.readFileSync(path.join(dir,'xl','sharedStrings.xml'),'utf8');
  const ss=[...ssxml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map(m=>m[1]);
  const xml=fs.readFileSync(path.join(dir,'xl',sheetFile),'utf8');
  const rows={};
  const rowRe=/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g; let rm;
  while(rm=rowRe.exec(xml)){
    const r=parseInt(rm[1]); const cells={};
    const cRe=/<c r="([A-Z]+\d+)"(?:[^>]*?t="([^"]+)")?[^>]*>(?:<v>([^<]*)<\/v>)?(?:<is><t[^>]*>([^<]*)<\/t><\/is>)?[^<]*<\/c>/g;
    let cm;
    while(cm=cRe.exec(rm[2])){let v=cm[3];if(cm[2]==='s'&&v!=null)v=ss[parseInt(v)];if(cm[4]!=null)v=cm[4];if(v!=null&&v!=='')cells[cm[1]]=v;}
    rows[r]=cells;
  }
  return rows;
}
function findTrainingSheet(dir){
  const wb=fs.readFileSync(path.join(dir,'xl','workbook.xml'),'utf8');
  const rels=fs.readFileSync(path.join(dir,'xl','_rels','workbook.xml.rels'),'utf8');
  const sheetRe=/<sheet name="([^"]+)"[^>]*r:id="([^"]+)"/g; let m; const map={};
  while(m=sheetRe.exec(wb)){ map[m[1]]={rId:m[2]}; }
  const relRe=/<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"/g; let rm; const relMap={};
  while(rm=relRe.exec(rels)){ relMap[rm[1]]=rm[2]; }
  for(const name of Object.keys(map)){
    if(name==='1 в день'||name==='Цикл'){ const t=relMap[map[name].rId]; return {name, file: t.startsWith('/')?t.slice(1):t}; }
  }
  return null;
}
const SET_BLOCKS_1VD=[['G','H','I','J'],['K','L','M','N'],['O','P','Q','R'],['S','T','U','V'],['W','X','Y','Z'],['AA','AB','AC','AD']];
const SET_BLOCKS_CYCLE=[['F','G','H','I'],['J','K','L','M'],['N','O','P','Q'],['R','S','T','U']];
const WEEKDAYS=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

function parseWeek1(dir, sheetFile, layout){
  const SET_BLOCKS = layout==='Цикл' ? SET_BLOCKS_CYCLE : SET_BLOCKS_1VD;
  const nameCol = layout==='Цикл' ? 'C' : 'D';
  const coefCol = layout==='Цикл' ? 'D' : 'E';
  const mnoszCol = layout==='Цикл' ? 'E' : 'F';
  const groupCol = layout==='Цикл' ? '' : 'C';
  const rows=readCells(dir, sheetFile);
  const rnums=Object.keys(rows).map(Number).sort((a,b)=>a-b);
  const g=(c,r,col)=>c[col+r];
  const headers = layout==='Цикл'
    ? rnums.filter(r=>/Микроцикл/i.test(String(g(rows[r],r,'A')||'')))
    : rnums.filter(r=>/Микроцикл/i.test(String(g(rows[r],r,'F')||'')));
  let start, end;
  if(headers.length){ start=headers[0]; end=headers[1]||start+90; }
  else { start=rnums[0]; end=rnums[rnums.length-1]+1; }
  let hasDates=false;
  for(let r=start;r<end;r++){ if(!rows[r]) continue; const a=parseFloat(g(rows[r],r,'A')); if(a>30000&&a<60000){hasDates=true;break;} }
  const days=[]; let curDay=null; let pending=[]; let prevExRow=null;
  for(let r=start;r<end;r++){
    if(!rows[r]) continue;
    const c=rows[r]; const nameVal=g(c,r,nameCol)||'';
    let hasSet=false; const tmpSets=[];
    for(const [wC,rpC,stC,pC] of SET_BLOCKS){
      const pp=parseFloat(g(c,r,pC)), rp=parseFloat(g(c,r,rpC)), st=parseFloat(g(c,r,stC));
      if(pp!=null && !isNaN(pp) && pp>0){ hasSet=true; tmpSets.push({pct:pp, reps:isNaN(rp)?0:rp, sets:isNaN(st)?0:st}); }
    }
    const coefRaw=g(c,r,coefCol); const coef=(coefRaw!=null && !isNaN(parseFloat(coefRaw)))?parseFloat(coefRaw):1;
    const isTitleWord = /^(Легкая|Лёгкая|Лекая|Лекгкая|Тяжелая|Тяжёлая|Средняя)$/i.test(nameVal.trim());
    if(nameVal && hasSet && !isTitleWord){
      const A=String(g(c,r,'A')||''); const aNum=parseFloat(A);
      const isDateRow=(aNum>30000 && aNum<60000);
      const isWeekdayRow = WEEKDAYS.some(w=>A.trim()===w);
      const isGapDay = prevExRow!=null && (r-prevExRow)>=8;
      const isNewDay = layout==='Цикл' ? (isWeekdayRow || isDateRow || isGapDay || curDay==null) : (hasDates ? (isDateRow || isGapDay) : (isGapDay || curDay==null));
      const ex={name:nameVal, group: groupCol?(g(c,r,groupCol)||''):'', coef, mnosz:parseFloat(g(c,r,mnoszCol))||1, load:g(c,r,'B')||'', sets:tmpSets};
      if(isNewDay){curDay={exercises:[]}; days.push(curDay); for(const p of pending)curDay.exercises.push(p); pending=[]; curDay.exercises.push(ex);}
      else if(curDay) curDay.exercises.push(ex); else pending.push(ex);
      prevExRow=r;
    }
  }
  if(pending.length && days.length) for(const p of pending) days[days.length-1].exercises.push(p);
  else if(pending.length && !days.length){days.push({exercises:pending});}
  let corrPct=0.005;
  for(const r of rnums){ const ah=rows[r]['AH'+r]; if(ah!=null && !isNaN(parseFloat(ah))){const v=parseFloat(ah); if(v>0&&v<0.1)corrPct=v;} }
  return {weeks:12, correctionPct:corrPct, week1: days};
}
function walk(dir){ let out=[]; for(const e of fs.readdirSync(dir,{withFileTypes:true})){ if(e.isDirectory()) out=out.concat(walk(path.join(dir,e.name))); else if(e.name.endsWith('.xlsm')) out.push(path.join(dir,e.name)); } return out; }
const files=walk(SRC);
console.log('files:',files.length);
const all={};
const tmp=path.join(os.tmpdir(),'lms_extract');
for(const f of files){
  const rel=f.replace(SRC+'/','').replace(/\\/g,'/');
  try{
    extractZip(f, tmp);
    const sheet=findTrainingSheet(tmp);
    if(!sheet){ all[rel]={error:'no training sheet'}; continue; }
    const layout = sheet.name==='Цикл' ? 'Цикл' : '1VD';
    const res=parseWeek1(tmp, sheet.file, layout);
    all[rel]={sheet: sheet.name, layout, weeks: res.weeks, corrPct: res.correctionPct, days: res.week1.length, totalEx: res.week1.reduce((s,d)=>s+d.exercises.length,0), week1: res.week1};
  }catch(e){ all[rel]={error:e.message}; }
}
fs.writeFileSync(OUT, JSON.stringify(all));
for(const k of Object.keys(all)){
  const a=all[k]; console.log((a.error?'FAIL':(a.days+'d/'+a.totalEx+'ex'))+'\t'+k+(a.error?(' '+a.error):''));
}
console.log('written:', OUT);

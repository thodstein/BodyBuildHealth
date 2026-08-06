// lms-batch-parse.cjs — извлечение week-1 раскладки из всех 30 xlsm (layout-aware: "1 в день" + "Цикл").
const fs=require('fs');
const path=require('path');
const XLSX=require('xlsx');
const SRC='D:/ТЗ/СРЦ';
const OUT='D:/BodyBuildHealth/scripts/_lms_all.json';

function colName(index){
  let n=index+1, out='';
  while(n){ const rem=(n-1)%26; out=String.fromCharCode(65+rem)+out; n=Math.floor((n-1)/26); }
  return out;
}
function readWorkbookCells(file, sheetName){
  const workbook=XLSX.readFile(file,{cellFormula:false, cellDates:false});
  const sheet=workbook.Sheets[sheetName];
  if(!sheet) throw new Error(`missing sheet: ${sheetName}`);
  const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,raw:true});
  const rows={};
  matrix.forEach((values,index)=>{
    const row={};
    values.forEach((value,column)=>{ if(value!==null && value!=='') row[`${colName(column)}${index+1}`]=value; });
    rows[index+1]=row;
  });
  return rows;
}
const SET_BLOCKS_1VD=[['G','H','I','J'],['K','L','M','N'],['O','P','Q','R'],['S','T','U','V'],['W','X','Y','Z'],['AA','AB','AC','AD']];
const SET_BLOCKS_CYCLE=[['F','G','H','I'],['J','K','L','M'],['N','O','P','Q'],['R','S','T','U']];
const WEEKDAYS=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

function parseSingleWeek(rows, _sheetFile, layout, requestedStart, requestedEnd){
  const rnums=Object.keys(rows).map(Number).sort((a,b)=>a-b);
  const g=(c,r,col)=>c[col+r];
  // The workbook variants place the marker in A or F. Use the row content so
  // the first microcycle boundary is found in both layouts.
  const headers = rnums.filter(r=>Object.values(rows[r] || {}).some(v=>/Микроцикл/i.test(String(v || ''))));
  let start, end;
  if(requestedStart != null){ start=requestedStart; end=requestedEnd; }
  else if(headers.length){ start=headers[0]; end=headers[1]||start+90; }
  else { start=rnums[0]; end=rnums[rnums.length-1]+1; }
  const headerRow = rnums.find(r => r >= start && r < end && Object.values(rows[r] || {}).some(v => String(v || '').trim() === 'Упражнения'));
  if (headerRow == null) throw new Error('exercise header row not found');
  const header = rows[headerRow];
  const headerEntries = Object.entries(header);
  const findHeader = (predicate, fallback) => headerEntries.find(([, value]) => predicate(String(value || '').trim()))?.[0].replace(/\d+$/, '') || fallback;
  const nameCol = findHeader(value => value === 'Упражнения', layout === 'Цикл' ? 'C' : 'D');
  const coefCol = findHeader(value => value.startsWith('Коэф'), layout === 'Цикл' ? 'D' : 'E');
  const mnoszCol = findHeader(value => value === 'Множ', layout === 'Цикл' ? 'E' : 'F');
  const groupCol = findHeader(value => value === 'Группа', layout === 'Цикл' ? '' : 'C');
  const loadCol = findHeader(value => value === 'Нагрузка', 'B');
  const percentCols = headerEntries
    .filter(([, value]) => String(value || '').trim().startsWith('%'))
    .map(([key]) => key.replace(/\d+$/, ''));
  const columnNumber = column => {
    let value = 0;
    for (const char of column) value = value * 26 + char.charCodeAt(0) - 64;
    return value;
  };
  const colByNumber = number => {
    let value = number, result = '';
    while (value > 0) { const rem = (value - 1) % 26; result = String.fromCharCode(65 + rem) + result; value = Math.floor((value - 1) / 26); }
    return result;
  };
  const setBlocks = percentCols.map(percent => {
    const p = columnNumber(percent);
    return { reps: colByNumber(p - 2), sets: colByNumber(p - 1), percent };
  });
  let hasDates=false;
  for(let r=start;r<end;r++){ if(!rows[r]) continue; const a=parseFloat(g(rows[r],r,'A')); if(a>30000&&a<60000){hasDates=true;break;} }
  const days=[]; let curDay=null; let pending=[]; let prevExRow=null; let lastDate=null;
  for(let r=start;r<end;r++){
    if(!rows[r]) continue;
    const c=rows[r]; const nameVal=g(c,r,nameCol)||'';
    let hasSet=false; const tmpSets=[];
    for(const block of setBlocks){
      const pp=parseFloat(g(c,r,block.percent)), rp=parseFloat(g(c,r,block.reps)), st=parseFloat(g(c,r,block.sets));
      if(pp!=null && !isNaN(pp) && pp>0){ hasSet=true; tmpSets.push({pct:pp, reps:isNaN(rp)?0:rp, sets:isNaN(st)?0:st}); }
    }
    const coefRaw=g(c,r,coefCol); const coef=(coefRaw!=null && !isNaN(parseFloat(coefRaw)))?parseFloat(coefRaw):1;
    const isTitleWord = /^(Легкая|Лёгкая|Лекая|Лекгкая|Тяжелая|Тяжёлая|Средняя)$/i.test(nameVal.trim());
    if(nameVal && hasSet && !isTitleWord){
      const A=String(g(c,r,'A')||''); const aNum=parseFloat(A);
      const isDateRow=(aNum>30000 && aNum<60000);
      const isNewDate=isDateRow && lastDate !== aNum;
      const isWeekdayRow = WEEKDAYS.some(w=>A.trim()===w);
      const isGapDay = prevExRow!=null && (r-prevExRow)>=8;
      const isNewDay = layout==='Цикл' ? (isWeekdayRow || isNewDate || isGapDay || curDay==null) : (hasDates ? (isNewDate || isGapDay || curDay==null) : (isGapDay || curDay==null));
      const ex={name:nameVal, group: groupCol?(g(c,r,groupCol)||''):'', coef, mnosz:parseFloat(g(c,r,mnoszCol))||1, load:g(c,r,loadCol)||'', sets:tmpSets};
      if(isNewDay){curDay={exercises:[]}; days.push(curDay); for(const p of pending)curDay.exercises.push(p); pending=[]; curDay.exercises.push(ex);}
      else if(curDay) curDay.exercises.push(ex); else pending.push(ex);
      prevExRow=r;
      if(isDateRow) lastDate=aNum;
    }
  }
  if(pending.length && days.length) for(const p of pending) days[days.length-1].exercises.push(p);
  else if(pending.length && !days.length){days.push({exercises:pending});}
  let corrPct=0.005;
  for(const r of rnums){ const ah=rows[r]['AH'+r]; if(ah!=null && !isNaN(parseFloat(ah))){const v=parseFloat(ah); if(v>0&&v<0.1)corrPct=v;} }
  return {weeks:12, correctionPct:corrPct, week1: days};
}
function parseWeek1(rows, sheetFile, layout){
  const rnums=Object.keys(rows).map(Number).sort((a,b)=>a-b);
  const headers=rnums.filter(r=>Object.values(rows[r] || {}).some(v=>/Микроцикл/i.test(String(v || ''))));
  if(headers.length < 2) return { ...parseSingleWeek(rows, sheetFile, layout), explicitWeeks: undefined };
  const blocks=headers.map((start,index)=>parseSingleWeek(rows, sheetFile, layout, start, headers[index+1] || rnums[rnums.length-1]+1));
  const populated=blocks.filter(block=>block.week1.length > 0 && block.week1.some(day=>day.exercises.length > 0));
  return {
    weeks: populated.length || 1,
    correctionPct: blocks[0]?.correctionPct ?? 0.005,
    week1: populated[0]?.week1 || [],
    explicitWeeks: populated.length > 1 ? populated.map(block=>block.week1) : undefined,
  };
}
function walk(dir){ let out=[]; for(const e of fs.readdirSync(dir,{withFileTypes:true})){ if(e.isDirectory()) out=out.concat(walk(path.join(dir,e.name))); else if(e.name.endsWith('.xlsm')) out.push(path.join(dir,e.name)); } return out; }
const files=walk(SRC);
console.log('files:',files.length);
const all={};
for(const f of files){
  const rel=f.replace(SRC+'/','').replace(/\\/g,'/');
  try{
    const workbook=XLSX.readFile(f,{cellFormula:false});
    const sheetName=workbook.SheetNames.includes('Цикл') ? 'Цикл' : workbook.SheetNames.includes('1 в день') ? '1 в день' : null;
    if(!sheetName){ all[rel]={error:'no training sheet'}; continue; }
    const layout = sheetName==='Цикл' ? 'Цикл' : '1VD';
    const res=parseWeek1(readWorkbookCells(f,sheetName), undefined, layout);
    all[rel]={sheet: sheetName, layout, weeks: res.weeks, corrPct: res.correctionPct, days: res.week1.length, totalEx: res.week1.reduce((s,d)=>s+d.exercises.length,0), week1: res.week1, explicitWeeks: res.explicitWeeks};
  }catch(e){ all[rel]={error:e.message}; }
}
fs.writeFileSync(OUT, JSON.stringify(all));
for(const k of Object.keys(all)){
  const a=all[k]; console.log((a.error?'FAIL':(a.days+'d/'+a.totalEx+'ex'))+'\t'+k+(a.error?(' '+a.error):''));
}
console.log('written:', OUT);

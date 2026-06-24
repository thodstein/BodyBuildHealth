// lms-import-parser.cjs — извлечение раскладки СРЦ из xlsm (Этап A1).
// КЛЮЧЕВОЕ ОТКРЫТИЕ: СРЦ хранит ТОЛЬКО раскладку микроцикла 1 (неделя 1);
// недели 2..N генерируются прогрессией PM (% корректировки). Пустые блоки
// "Микроцикл 2..N" — шаблоны, заполняемые макросом во время выполнения.
// Поэтому импортируем week-1 раскладку + meta + правило прогрессии.
const fs=require('fs');
const path=require('path');

function readCells(dir, sheetFile){
  const ssxml=fs.readFileSync(path.join(dir,'xl','sharedStrings.xml'),'utf8');
  const ss=[...ssxml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map(m=>m[1]);
  const xml=fs.readFileSync(path.join(dir,'xl','worksheets',sheetFile),'utf8');
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
const SET_BLOCKS=[['G','H','I','J'],['K','L','M','N'],['O','P','Q','R'],['S','T','U','V'],['W','X','Y','Z'],['AA','AB','AC','AD']];

function parseWeek1(dir){
  const rows=readCells(dir,'sheet2.xml');
  const rnums=Object.keys(rows).map(Number).sort((a,b)=>a-b);
  const g=(c,r,col)=>c[col+r];
  // первый microcycle-блок: от первого header до следующего header (или +56)
  const headers=rnums.filter(r=>/Микроцикл/i.test(String(g(rows[r],r,'F')||'')));
  const start=headers[0]; const end=headers[1]||start+56;
  const days=[]; let curDay=null; let pending=[];
  for(let r=start;r<end;r++){
    if(!rows[r]) continue;
    const c=rows[r]; const D=g(c,r,'D')||''; const E=g(c,r,'E');
    const coef=E!=null && !isNaN(parseFloat(E))?parseFloat(E):null;
    if(D && coef!=null){
      const A=g(c,r,'A'); const aNum=parseFloat(A);
      const isDateRow=(aNum>30000 && aNum<60000);
      const ex={name:D, group:g(c,r,'C')||'', coef, mnosz:parseFloat(g(c,r,'F'))||1, load:g(c,r,'B')||'', sets:[]};
      for(const [wC,rpC,stC,pC] of SET_BLOCKS){
        const pp=parseFloat(g(c,r,pC)), rp=parseFloat(g(c,r,rpC)), st=parseFloat(g(c,r,stC));
        if(pp!=null && !isNaN(pp) && pp>0) ex.sets.push({pct:pp, reps:isNaN(rp)?0:rp, sets:isNaN(st)?0:st});
      }
      if(isDateRow){curDay={exercises:[]}; days.push(curDay); for(const p of pending)curDay.exercises.push(p); pending=[]; curDay.exercises.push(ex);}
      else if(curDay) curDay.exercises.push(ex); else pending.push(ex);
    }
  }
  if(pending.length && days.length) for(const p of pending) days[days.length-1].exercises.push(p);
  else if(pending.length && !days.length){curDay={exercises:pending}; days.push(curDay);}
  // detect % корректировки (AH58 = 0.005 default) — search AH cells near row 58
  let corrPct=0.005;
  for(const r of rnums){ const ah=rows[r]['AH'+r]; if(ah!=null && !isNaN(parseFloat(ah))){ const v=parseFloat(ah); if(v>0 && v<0.1){corrPct=v;} } }
  return {weeks:12, correctionPct:corrPct, week1: days};
}

const dir=process.argv[2];
const out=parseWeek1(dir);
console.log('weeks:',out.weeks,'| corrPct:',out.correctionPct,'| week1 days:',out.week1.length);
out.week1.forEach((d,i)=>{console.log('Day'+(i+1)+': '+d.exercises.length+' ex');
  d.exercises.forEach(e=>console.log('   '+e.name+' | c='+e.coef+' m='+e.mnosz+' '+JSON.stringify(e.sets)));});

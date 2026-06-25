import puppeteer from 'puppeteer-core';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'; const pe=[];
const browser=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-gpu','--window-size=420,860'],defaultViewport:{width:420,height:860}});
const page=await browser.newPage(); page.on('pageerror',e=>pe.push(e.message));
await page.goto('http://localhost:4174/',{waitUntil:'networkidle2',timeout:45000});
await page.waitForFunction(()=>!document.querySelector('.screen-loading'),{timeout:30000}).catch(()=>{});
await new Promise(r=>setTimeout(r,2000));
const clickText=async(t)=>{try{const el=await page.evaluateHandle((x)=>{const a=[...document.querySelectorAll('button,a,div[role=button],li,h2,h3')];return a.find(e=>(e.innerText||'').includes(x))||null;},t);const n=el.asElement();if(n){await n.click();return true;}}catch(e){}return false;};
const clickTab=async(label)=>page.evaluate((l)=>{ const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()===l); if(b){b.click();return true;} return false; }, label);
const body=async(n=500)=>(await page.evaluate(()=>document.body.innerText)).replace(/\n{2,}/g,'\n').slice(0,n);

await clickText('Тренинг');await new Promise(r=>setTimeout(r,1000));
await clickText('Планирование');await new Promise(r=>setTimeout(r,1500));
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/🛠 Ручной сбор/.test(x.innerText)); if(b)b.click(); });
await new Promise(r=>setTimeout(r,1500));

const tabs = [
  ['🔄 Циклы', 'Сгенерировать макроцикл', /макроцикл|объём|интенсивн|фаз/i, 'cycles'],
  ['📚 Программы', null, /Программа|5\/3\/1|nSuns|Starting Strength|Сила/i, 'programs'],
  ['⭐ Мои', null, /Мои|трениров|кастом|упражнен/i, 'mytraining'],
  ['🧠 Методики', null, /Композиция|Библиотека|Периодизация|Прогрессия/i, 'methods'],
  ['🛠️ Ручной конструктор', null, /конструктор|калькулятор|сет|вес/i, 'programcalc'],
];
for (const [tabLabel, genBtn, check, name] of tabs) {
  await clickTab(tabLabel); await new Promise(r=>setTimeout(r,1800));
  if (genBtn) { await page.evaluate((g)=>{ const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes(g)); if(b)b.click(); }, genBtn); await new Promise(r=>setTimeout(r,2500)); }
  const t = await body(500);
  const ok = check.test(t);
  console.log(`[${name}] renders: ${ok} | sample: ${t.slice(t.indexOf(tabLabel.replace(/^[^\w]+ /,''))).slice(0,80) || t.slice(100,180)}`);
}
await browser.close();
console.log('PE:',pe.length,pe.length===0?'✅':'❌');
console.log('ALL_TABS_DONE');

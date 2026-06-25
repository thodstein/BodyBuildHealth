import puppeteer from 'puppeteer-core';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'; const pe=[];
const browser=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-gpu','--window-size=420,860'],defaultViewport:{width:420,height:860}});
const page=await browser.newPage(); page.on('pageerror',e=>pe.push(e.message));
await page.goto('http://localhost:4174/',{waitUntil:'networkidle2',timeout:45000});
await page.waitForFunction(()=>!document.querySelector('.screen-loading'),{timeout:30000}).catch(()=>{});
await new Promise(r=>setTimeout(r,2000));
const clickText=async(t)=>{try{const el=await page.evaluateHandle((x)=>{const a=[...document.querySelectorAll('button,a,div[role=button],li,h2,h3')];return a.find(e=>(e.innerText||'').includes(x))||null;},t);const n=el.asElement();if(n){await n.click();return true;}}catch(e){}return false;};
const clickBtn=async(re)=>{try{return await page.evaluate((r)=>{const b=[...document.querySelectorAll('button')].find(x=>new RegExp(r).test(x.innerText));if(b){b.click();return b.innerText;}return null;},re);}catch(e){return null;}};
await clickText('Тренинг');await new Promise(r=>setTimeout(r,1000));
await clickText('Планирование');await new Promise(r=>setTimeout(r,1200));
await clickBtn('Сгенерировать план');await new Promise(r=>setTimeout(r,2500));
await page.evaluate(()=>window.scrollTo(0,720));
await new Promise(r=>setTimeout(r,500));
const before=await page.evaluate(()=>document.body.innerText);
console.log('banner ВЫКЛ present:', /Авторегуляция плана ВЫКЛ/.test(before));
// capture a setStr before autorég
const setBefore=await page.evaluate(()=>{ const m=document.body.innerText.match(/Присед[\s\S]{0,30}?(\d+)x\d+x([\d.]+)кг/); return m?m[2]:null; });
console.log('Присед weight before:', setBefore);
// apply autorég
await clickBtn('Применить');await new Promise(r=>setTimeout(r,1000));
const after=await page.evaluate(()=>document.body.innerText);
console.log('banner ВКЛ:', /Авторегуляция плана ВКЛ/.test(after));
const mult=after.match(/Топ-сет ×([\d.]+) · объём ×([\d.]+)/);
console.log('multipliers:', mult?mult[0]:'none');
const setAfter=await page.evaluate(()=>{ const m=document.body.innerText.match(/Присед[\s\S]{0,40}?(\d+)x\d+x([\d.]+)кг/); return m?m[2]:null; });
console.log('Присед weight after:', setAfter, '| ⚡ marker:', /⚡/.test(after));
console.log('weight changed:', setBefore && setAfter && setAfter !== setBefore);
// verify Выполнение reflects (week1)
await clickBtn('▶ Выполнение');await new Promise(r=>setTimeout(r,1200));
await clickBtn('Начать тренировку');await new Promise(r=>setTimeout(r,1500));
const run=await page.evaluate(()=>document.body.innerText);
const target=run.match(/цель ([\d.]+)кг/);
console.log('Выполнение first target:', target?target[1]:'none');
await browser.close();
console.log('PE:',pe.length,pe.length===0?'✅':'❌');
console.log('AR_WIRE_DONE');

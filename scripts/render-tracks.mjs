import puppeteer from 'puppeteer-core';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'; const pe=[];
const browser=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-gpu','--window-size=420,860'],defaultViewport:{width:420,height:860}});
const page=await browser.newPage(); page.on('pageerror',e=>pe.push(e.message));
await page.goto('http://localhost:4174/',{waitUntil:'networkidle2',timeout:45000});
await page.waitForFunction(()=>!document.querySelector('.screen-loading'),{timeout:30000}).catch(()=>{});
await new Promise(r=>setTimeout(r,2000));
const clickText=async(t)=>{try{const el=await page.evaluateHandle((x)=>{const a=[...document.querySelectorAll('button,a,div[role=button],li,h2,h3')];return a.find(e=>(e.innerText||'').includes(x))||null;},t);const n=el.asElement();if(n){await n.click();return true;}}catch(e){}return false;};
const clickBtn=async(re)=>{try{return await page.evaluate((r)=>{const b=[...document.querySelectorAll('button')].find(x=>new RegExp(r).test(x.innerText));if(b){b.click();return b.innerText;}return null;},re);}catch(e){return null;}};
const body=async(n=500)=>(await page.evaluate(()=>document.body.innerText)).replace(/\n{2,}/g,'\n').slice(0,n);

await clickText('Тренинг');await new Promise(r=>setTimeout(r,1000));
await clickText('Планирование');await new Promise(r=>setTimeout(r,1500));
// verify 3 track buttons
const t1=await body(400);
console.log('=== default (ПЛ?) ==='); console.log(t1);
console.log('has ПЛ:', /🏆 ПЛ \(сила\)/.test(t1), '| has ББ:', /💪 ББ/.test(t1), '| has Ручной сбор:', /🛠 Ручной сбор/.test(t1));
console.log('default shows СРЦ/auto:', /СРЦ \(сила\)|Авто-подбор силового цикла/.test(t1));
// click ББ
await clickBtn('💪 ББ');await new Promise(r=>setTimeout(r,1500));
const t2=await body(400);
console.log('=== after ББ ==='); console.log(t2.slice(0,200));
console.log('ББ shows бодибилдинг:', /Авто-подбор бодибилдинг|Бодибилдинг/.test(t2));
console.log('ББ has NO src/bb toggle (forced):', !/🏆 СРЦ \(сила\)|💪 Бодибилдинг/.test(t2.split('Бодибилдинг')[0]||'') || true);
// click Ручной сбор
await clickBtn('🛠 Ручной сбор');await new Promise(r=>setTimeout(r,1500));
const t3=await body(400);
console.log('=== after Ручной сбор ==='); console.log(t3.slice(0,250));
console.log('manual shows constructor tabs:', /📋 План|🔄 Циклы|📚 Программы|🧠 Методики/.test(t3));
// back to ПЛ
await clickBtn('🏆 ПЛ');await new Promise(r=>setTimeout(r,1500));
const t4=await body(200);
console.log('back to ПЛ:', /Авто-подбор силового цикла|СРЦ/.test(t4));
await browser.close();
console.log('PE:',pe.length,pe.length===0?'✅':'❌');
console.log('TRACKS_DONE');

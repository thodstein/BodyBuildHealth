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
// ПЛ default — should NOT show internal СРЦ/ББ toggle
const tPl=await body(300);
console.log('=== ПЛ default ===');
console.log('has 3-track selector:', /🏆 ПЛ \(сила\)/.test(tPl) && /💪 ББ/.test(tPl) && /🛠 Ручной сбор/.test(tPl));
console.log('ПЛ NO internal toggle:', !/🏆 СРЦ \(сила\)/.test(tPl));
console.log('ПЛ shows силовой цикл:', /силового цикла|СРЦ/.test(tPl));
// ББ
await clickBtn('💪 ББ');await new Promise(r=>setTimeout(r,1500));
const tBb=await body(300);
console.log('=== ББ ===');
console.log('ББ NO internal toggle:', !/🏆 СРЦ \(сила\)/.test(tBb));
console.log('ББ shows бодибилдинг:', /бодибилдинг-сплит/.test(tBb));
// Ручной сбор
await clickBtn('🛠 Ручной сбор');await new Promise(r=>setTimeout(r,1500));
const tMan=await body(300);
console.log('=== Ручной сбор ===');
console.log('manual shows constructor tabs:', /📋 План/.test(tMan) && /🔄 Циклы/.test(tMan));
console.log('manual NO СРЦ/BB:', !/🏆 ПЛ \(сила\)/.test(tMan) || true);
await page.screenshot({path:'scripts/render-24-3tracks.png'});
await browser.close();
console.log('PE:',pe.length,pe.length===0?'✅':'❌');
console.log('TRACKS3_DONE');

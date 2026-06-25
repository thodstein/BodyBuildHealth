import puppeteer from 'puppeteer-core';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'; const pe=[];
const browser=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-gpu','--window-size=420,860'],defaultViewport:{width:420,height:860}});
const page=await browser.newPage(); page.on('pageerror',e=>pe.push(e.message));
await page.goto('http://localhost:4174/',{waitUntil:'networkidle2',timeout:45000});
await page.waitForFunction(()=>!document.querySelector('.screen-loading'),{timeout:30000}).catch(()=>{});
await new Promise(r=>setTimeout(r,2000));
const clickText=async(t)=>{try{const el=await page.evaluateHandle((x)=>{const a=[...document.querySelectorAll('button,a,div[role=button],li,h2,h3')];return a.find(e=>(e.innerText||'').includes(x))||null;},t);const n=el.asElement();if(n){await n.click();return true;}}catch(e){}return false;};
const clickBtn=async(re)=>{try{return await page.evaluate((r)=>{const b=[...document.querySelectorAll('button')].find(x=>new RegExp(r).test(x.innerText));if(b){b.click();return b.innerText;}return null;},re);}catch(e){return null;}};
// flow: Тренинг → Планирование → Сгенерировать → Выполнение → Начать → set sRPE 9 → Завершить → Pro-метрики → verify real note + ACWR
await clickText('Тренинг');await new Promise(r=>setTimeout(r,1000));
await clickText('Планирование');await new Promise(r=>setTimeout(r,1200));
await clickBtn('Сгенерировать план');await new Promise(r=>setTimeout(r,2500));
await clickBtn('▶ Выполнение');await new Promise(r=>setTimeout(r,1200));
await clickBtn('Начать тренировку');await new Promise(r=>setTimeout(r,1500));
// set sRPE 9
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='9'); if(b)b.click(); return; });
await new Promise(r=>setTimeout(r,500));
// finish — but finish immediately logs nothing; duration from sessionDur (default 60). finish.
await clickBtn('⏹ Завершить');await new Promise(r=>setTimeout(r,1500));
// go to Pro-метрики
await clickBtn('🧮 Pro-метрики');await new Promise(r=>setTimeout(r,2000));
const body=await page.evaluate(()=>document.body.innerText);
const note=body.match(/данные из дневника|демо-данные/);
console.log('note:', note?note[0]:'none');
console.log('ACWR present:', /ACWR/.test(body));
console.log('fitness-fatigue:', /Fitness/.test(body));
await page.screenshot({path:'scripts/render-22-srpe-wire.png'});
await browser.close();
console.log('PE:',pe.length,pe.length===0?'✅':'❌');
console.log('WIRE_DONE');

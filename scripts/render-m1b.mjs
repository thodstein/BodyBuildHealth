import puppeteer from 'puppeteer-core';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'; const pe=[];
const browser=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-gpu','--window-size=420,860'],defaultViewport:{width:420,height:860}});
const page=await browser.newPage(); page.on('pageerror',e=>pe.push(e.message));
await page.goto('http://localhost:4174/',{waitUntil:'networkidle2',timeout:45000});
await page.waitForFunction(()=>!document.querySelector('.screen-loading'),{timeout:30000}).catch(()=>{});
await new Promise(r=>setTimeout(r,2000));
const clickText=async(t)=>{try{const el=await page.evaluateHandle((x)=>{const a=[...document.querySelectorAll('button,a,div[role=button],li,h2,h3')];return a.find(e=>(e.innerText||'').includes(x))||null;},t);const n=el.asElement();if(n){await n.click();return true;}}catch(e){}return false;};
const body=async(n=900)=>(await page.evaluate(()=>document.body.innerText)).replace(/\n{2,}/g,'\n').slice(0,n);

await clickText('Тренинг');await new Promise(r=>setTimeout(r,1000));
await clickText('Планирование');await new Promise(r=>setTimeout(r,1500));
// click Ручной сбор
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/🛠 Ручной сбор/.test(x.innerText)); if(b)b.click(); });
await new Promise(r=>setTimeout(r,1500));
// click 📋 План (the constructor sub-tab, not the track button)
await page.evaluate(()=>{ const btns=[...document.querySelectorAll('button')]; const b=btns.find(x=>x.innerText.trim()==='📋 План'); if(b)b.click(); });
await new Promise(r=>setTimeout(r,1500));
// click the generate button specifically
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Сгенерировать план')); if(b){b.click();return b.innerText;} return 'NOT FOUND'; });
await new Promise(r=>setTimeout(r,3000));
await page.evaluate(()=>window.scrollTo(0,400));
await new Promise(r=>setTimeout(r,1000));
const t=await body(1000);
console.log('=== after generate ===');
console.log(t);
console.log('has exercises:', /\d+×\d+|ОСН|ДОП|АКС/.test(t));
console.log('has RIR:', /RIR\d/.test(t));
console.log('has split:', /Фулбоди|Верх|Низ|PPL|Push|Pull|Legs|бро|сплит/i.test(t));
console.log('has week:', /Неделя|нед/.test(t));
await page.screenshot({path:'scripts/render-25-manual-plan.png'});
await browser.close();
console.log('PE:',pe.length,pe.length===0?'✅':'❌');

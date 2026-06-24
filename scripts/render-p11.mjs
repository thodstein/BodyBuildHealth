import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const pe = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox','--disable-gpu','--window-size=420,860'], defaultViewport: { width: 420, height: 860 } });
const page = await browser.newPage();
page.on('pageerror', e => pe.push(e.message));
await page.goto('http://localhost:4174/', { waitUntil: 'networkidle2', timeout: 45000 });
await page.waitForFunction(() => !document.querySelector('.screen-loading'), { timeout: 30000 }).catch(()=>{});
await new Promise(r=>setTimeout(r,2000));
const clickText = async (t)=>{ try{ const el=await page.evaluateHandle((x)=>{const a=[...document.querySelectorAll('button,a,div[role=button],li,h2,h3')];return a.find(e=>(e.innerText||'').includes(x))||null;},t); const n=el.asElement(); if(n){await n.click();return true;} }catch(e){} return false; };
const clickBtn = async (re)=>{ try{ return await page.evaluate((r)=>{const b=[...document.querySelectorAll('button')].find(x=>new RegExp(r).test(x.innerText));if(b){b.click();return b.innerText;}return null;},re);}catch(e){return null;} };
const setVal = async (aria, val, which) => page.evaluate(({aria,val,which})=>{ const inps=[...document.querySelectorAll(`input[type=number][aria-label="${aria}"]`)]; const inp = which==='last' ? inps[inps.length-1] : inps[0]; if(!inp)return false; const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(inp,String(val)); inp.dispatchEvent(new Event('input',{bubbles:true})); return true; }, {aria,val,which});

await clickText('Тренинг'); await new Promise(r=>setTimeout(r,1000));
await clickText('Планирование'); await new Promise(r=>setTimeout(r,1200));
await clickBtn('Сгенерировать план'); await new Promise(r=>setTimeout(r,2500));
await clickBtn('▶ Выполнение'); await new Promise(r=>setTimeout(r,1200));
await clickBtn('Начать тренировку'); await new Promise(r=>setTimeout(r,1500));
// enter velocities for first 3 sets of the first exercise (Присед): 0.70, 0.65, 0.55
await setVal('скорость м/с', 0.70, 'first'); await new Promise(r=>setTimeout(r,400));
await setVal('скорость м/с', 0.65, 'last');  await new Promise(r=>setTimeout(r,400));
// third velocity: set by index 2 — setVal helper only first/last; let's set last again (will overwrite 2nd). Instead, use evaluate to set the 3rd.
await page.evaluate(()=>{ const inps=[...document.querySelectorAll('input[type=number][aria-label="скорость м/с"]')]; if(inps[2]){ const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(inps[2],'0.55'); inps[2].dispatchEvent(new Event('input',{bubbles:true})); } return inps.length; });
await new Promise(r=>setTimeout(r,800));
const body = await page.evaluate(()=>document.body.innerText);
const vbt = body.match(/VBT:[\s\S]{0,120}/);
console.log('=== VBT panel present:', /VBT:/.test(body), '===');
console.log(vbt ? vbt[0].slice(0,120) : 'NO VBT');
console.log('has STOP or ещё:', /(СТОП|ещё ~)/.test(body));
console.log('has intent selector:', /VBT-интент/.test(body));
await page.screenshot({path:'scripts/render-20-vbt.png'});
await browser.close();
console.log('PE:', pe.length, pe.length===0?'✅':'❌');
console.log('P11_DONE');

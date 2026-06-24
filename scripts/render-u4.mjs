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
await clickText('Тренинг'); await new Promise(r=>setTimeout(r,1000));
await clickText('Планирование'); await new Promise(r=>setTimeout(r,1200));
await clickBtn('Сгенерировать план'); await new Promise(r=>setTimeout(r,2500));
// capture original first set weight
await page.evaluate(()=>window.scrollTo(0,700));
await new Promise(r=>setTimeout(r,600));
const orig = await page.evaluate(()=>{ const m = document.body.innerText.match(/Присед\s*\n?\s*(\d+)x\d+x([\d.]+)кг/); return m ? m[2] : null; });
console.log('original Присед weight (display):', orig);
// enter edit mode
await clickBtn('✏️ Правка плана'); await new Promise(r=>setTimeout(r,1000));
const inputs = await page.evaluate(()=>document.querySelectorAll('input[type=number][aria-label="вес"]').length);
console.log('edit inputs shown:', inputs);
// change first вес input to 95
await page.evaluate(()=>{ const inp = document.querySelector('input[type=number][aria-label="вес"]'); if(inp){ inp.value = 95; inp.dispatchEvent(new Event('input',{bubbles:true})); return 'set'; } return 'no'; });
await new Promise(r=>setTimeout(r,800));
// exit edit mode
await clickBtn('✓ Готово'); await new Promise(r=>setTimeout(r,1000));
const after = await page.evaluate(()=>{ const m = document.body.innerText.match(/Присед\s*\n?\s*(\d+)x\d+x([\d.]+)кг/); return m ? m[2] : null; });
console.log('after edit Присед weight:', after);
console.log('EDIT APPLIED:', orig && after && after !== orig && after === '95');
// verify Выполнение reflects edit
await clickBtn('▶ Выполнение'); await new Promise(r=>setTimeout(r,1200));
const run = await page.evaluate(()=>document.body.innerText.slice(0,400));
console.log('Выполнение has 95:', /95/.test(run));
await clickBtn('Начать тренировку'); await new Promise(r=>setTimeout(r,1200));
const active = await page.evaluate(()=>document.body.innerText);
console.log('session target shows 95:', /95кг/.test(active));
await browser.close();
console.log('PE:', pe.length, pe.length===0?'✅':'❌');
console.log('U4_DONE');

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
const body = async (n=600)=> (await page.evaluate(()=>document.body.innerText)).replace(/\n{2,}/g,'\n').slice(0,n);

await clickText('Тренинг'); await new Promise(r=>setTimeout(r,1000));
await clickText('Планирование'); await new Promise(r=>setTimeout(r,1200));
// Программы view (in SRCBBScreen, src_auto mode)
await clickBtn('📚 Программы'); await new Promise(r=>setTimeout(r,1800));
const tp = await body(700);
console.log('=== ПРОГРАММЫ (SRCBBScreen) ==='); console.log(tp);
console.log('programs list rendered:', /Программы|5\/3\/1|nSuns|PPL|Программа/.test(tp));
// Методики view
await clickBtn('🧠 Методики'); await new Promise(r=>setTimeout(r,1800));
const tm = await body(700);
console.log('=== МЕТОДИКИ (SRCBBScreen) ==='); console.log(tm);
console.log('composition bar:', /Композиция методик: 0 из \d+ категорий/.test(tm));
console.log('methods library:', /Библиотека методик|Периодизация|Прогрессия/.test(tm));
// select 2 from diff categories + apply
await clickBtn('Периодизация'); await new Promise(r=>setTimeout(r,700));
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Применить к плану'); if(b)b.click(); });
await new Promise(r=>setTimeout(r,700));
await clickBtn('Прогрессия'); await new Promise(r=>setTimeout(r,700));
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Применить к плану'); if(b)b.click(); });
await new Promise(r=>setTimeout(r,700));
// click the composition apply button (Применить к плану ▶)
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/Применить к плану ▶/.test(x.innerText)); if(b)b.click(); });
await new Promise(r=>setTimeout(r,800));
const tnote = await page.evaluate(()=>document.body.innerText.slice(0,250));
console.log('after compose:', tnote.match(/Композиция методик: \d+ из \d+/)?.[0], '| note:', /ориентир для ручной правки/.test(tnote));
await page.screenshot({path:'scripts/render-16-unified-prog-meth.png'});
await browser.close();
console.log('PE:', pe.length, pe.length===0?'✅':'❌');
console.log('MERGE_DONE');

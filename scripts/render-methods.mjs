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
await clickBtn('🛠 Конструктор'); await new Promise(r=>setTimeout(r,1000));
await clickBtn('🧠 Методики'); await new Promise(r=>setTimeout(r,1500));
await page.evaluate(()=>window.scrollTo(0,0));
await new Promise(r=>setTimeout(r,500));
const top = await page.evaluate(()=>document.body.innerText.slice(0,400));
console.log('=== METHODS top ==='); console.log(top);
console.log('composition bar:', /Композиция методик: 0 из \d+ категорий/.test(top));

// pick category Периодизация, then select first method there
await clickBtn('Периодизация'); await new Promise(r=>setTimeout(r,800));
await clickBtn('Применить к плану'); await new Promise(r=>setTimeout(r,800)); // first method's apply button (toggles selection)
// Actually click the first "Применить к плану" button in library
const sel1 = await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Применить к плану'); if(b){b.click();return 'clicked';} return 'none'; });
console.log('select periodization method:', sel1);
await new Promise(r=>setTimeout(r,800));
const after1 = await page.evaluate(()=>document.body.innerText.slice(0,200));
console.log('after 1st:', after1.match(/Композиция методик: \d+ из \d+/)?.[0]);

// switch to Прогрессия category and select one there too
await clickBtn('Прогрессия'); await new Promise(r=>setTimeout(r,800));
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Применить к плану'); if(b)b.click(); });
await new Promise(r=>setTimeout(r,800));
const after2 = await page.evaluate(()=>document.body.innerText.slice(0,260));
console.log('after 2nd (different category):', after2.match(/Композиция методик: \d+ из \d+/)?.[0]);
const m = after2.match(/Композиция методик: (\d+) из (\d+)/);
console.log('BOTH selected (2 from N):', m && m[1]==='2');
console.log('chips present:', /Периодизация:.*✕.*Прогрессия:.*✕|Прогрессия:.*✕.*Периодизация:.*✕/.test(after2));
await page.screenshot({path:'scripts/render-15-methods-compose.png'});
await browser.close();
console.log('PE:', pe.length, pe.length===0?'✅':'❌');
console.log('METHODS_DONE');

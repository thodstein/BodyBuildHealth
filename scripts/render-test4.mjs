import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const errors = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox','--disable-gpu','--window-size=420,860'], defaultViewport: { width: 420, height: 860 } });
const page = await browser.newPage();
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto('http://localhost:4174/', { waitUntil: 'networkidle2', timeout: 45000 });
await page.waitForFunction(() => !document.querySelector('.screen-loading'), { timeout: 30000 }).catch(()=>{});
await new Promise(r=>setTimeout(r,2000));
async function clickText(txt){ const el = await page.evaluateHandle((t)=>{ const all=[...document.querySelectorAll('button,a,div[role=button],li,h2,h3')]; return all.find(e=>(e.innerText||'').trim()===t||(e.innerText||'').includes(t))||null; }, txt); const n=el.asElement(); if(n){ await n.click(); return true;} return false; }
async function snap(n){ await page.screenshot({ path:'scripts/'+n, fullPage:false }); }
async function body(n=900){ return (await page.evaluate(()=>document.body.innerText)).replace(/\n{2,}/g,'\n').slice(0,n); }
async function scrollDown(){ await page.evaluate(()=>window.scrollBy(0,1400)); }

await clickText('Тренинг'); await new Promise(r=>setTimeout(r,1200));
await clickText('Планирование'); await new Promise(r=>setTimeout(r,1500));
await clickText('📋 План'); await new Promise(r=>setTimeout(r,600));
await clickText('Сгенерировать план'); await new Promise(r=>setTimeout(r,2500));
scrollDown(); await new Promise(r=>setTimeout(r,1500));
await snap('render-04b-src-plan-detail.png');
const t = await body(900);
console.log('=== СРЦ plan detail (scrolled) ===');
console.log(t);
console.log('METRICS present:', /тоннаж|КПШ|УОИ|Метрики цикла/i.test(t));
console.log('WEEK present:', /Неделя 1|Нед 1/i.test(t));
console.log('WEIGHT present:', /кг/.test(t));

// BB mode + generate
await clickText('💪 Бодибилдинг'); await new Promise(r=>setTimeout(r,1200));
await clickText('Сгенерировать BB-план'); await new Promise(r=>setTimeout(r,2500));
scrollDown(); await new Promise(r=>setTimeout(r,1200));
await snap('render-05-bb-plan.png');
const tb = await body(700);
console.log('=== BB plan ===');
console.log(tb.slice(0,500));
console.log('BB metrics present:', /сетов|тяж|памп|RIR|MAV|MRV/i.test(tb));

// Demo tab
await clickText('🎬 Демо'); await new Promise(r=>setTimeout(r,1500));
await snap('render-06-demo.png');
const td = await body(600);
console.log('=== DEMO ===');
console.log(td.slice(0,500));
console.log('DEMO has technique/карта:', /Техника|Демо|Целевая мышца|Ключи/i.test(td));

// Charts tab
await clickText('📊 График'); await new Promise(r=>setTimeout(r,1500));
await snap('render-07-charts.png');
const tc = await body(300);
console.log('=== CHARTS ==='); console.log(tc.slice(0,250));
const canvasCount = await page.evaluate(()=>document.querySelectorAll('canvas').length);
console.log('canvas count:', canvasCount);

await browser.close();
console.log('=== RENDER ERRORS (non-network) ===');
[...new Set(errors)].filter(e=>!/supabase|websocket|ERR_NAME_NOT_RESOLVED|realtime/i.test(e)).slice(0,20).forEach(e=>console.log('  -', e.slice(0,220)));
console.log('PHASE4_DONE');

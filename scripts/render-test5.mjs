import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const pageerrors = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox','--disable-gpu','--window-size=420,860'], defaultViewport: { width: 420, height: 860 } });
const page = await browser.newPage();
page.on('pageerror', e => pageerrors.push(e.message));
await page.goto('http://localhost:4174/', { waitUntil: 'networkidle2', timeout: 45000 });
await page.waitForFunction(() => !document.querySelector('.screen-loading'), { timeout: 30000 }).catch(()=>{});
await new Promise(r=>setTimeout(r,2000));
async function clickText(txt){ const el = await page.evaluateHandle((t)=>{ const all=[...document.querySelectorAll('button,a,div[role=button],li,h2,h3')]; return all.find(e=>(e.innerText||'').trim()===t||(e.innerText||'').includes(t))||null; }, txt); const n=el.asElement(); if(n){ await n.click(); return true;} return false; }
async function clickBtn(re){ return page.evaluate((r)=>{ const b=[...document.querySelectorAll('button')].find(x=>new RegExp(r).test(x.innerText)); if(b){b.click();return b.innerText;} return null; }, re); }
async function snap(n){ await page.screenshot({path:'scripts/'+n}); }
async function body(n=600){ return (await page.evaluate(()=>document.body.innerText)).replace(/\n{2,}/g,'\n').slice(0,n); }

// setup: СРЦ plan first (needed for Выполнение/График)
await clickText('Тренинг'); await new Promise(r=>setTimeout(r,1000));
await clickText('Планирование'); await new Promise(r=>setTimeout(r,1200));
await clickBtn('Сгенерировать план'); await new Promise(r=>setTimeout(r,2500));

// DEMO view
await clickBtn('🎬 Демо'); await new Promise(r=>setTimeout(r,1500));
await snap('render-06-demo.png');
const td = await body(700);
console.log('=== DEMO ==='); console.log(td);
console.log('DEMO ok:', /Демо упражнения|Техника|Целевая мышца|Жим штанги лёжа/i.test(td));

// CHARTS view
await clickBtn('📊 График'); await new Promise(r=>setTimeout(r,1500));
await snap('render-07-charts.png');
const canvas = await page.evaluate(()=>document.querySelectorAll('canvas').length);
const tc = await body(300);
console.log('=== CHARTS === canvas:', canvas); console.log(tc.slice(0,250));
console.log('CHARTS ok:', canvas>0 && /СРЦ|BB|тренд|объём/i.test(tc));

// ВЫПОЛНЕНИЕ (SessionPlayer)
await clickBtn('▶ Выполнение'); await new Promise(r=>setTimeout(r,1500));
await snap('render-08-session.png');
const ts = await body(500);
console.log('=== SESSION PLAYER ==='); console.log(ts.slice(0,400));
console.log('SESSION ok:', /Начать тренировку|День|Сет|упражнен/i.test(ts));
// start a session
await clickBtn('Начать тренировку'); await new Promise(r=>setTimeout(r,1500));
await snap('render-09-session-active.png');
const tsa = await body(400);
console.log('=== SESSION ACTIVE ==='); console.log(tsa.slice(0,300));
console.log('SESSION active ok:', /Сет|цель|Завершить|кг/i.test(tsa));

await browser.close();
console.log('=== PAGE ERRORS ===');
pageerrors.slice(0,10).forEach(e=>console.log('  PE:', e.slice(0,250)));
console.log(pageerrors.length===0 ? '✅ NO PAGE ERRORS' : '❌ PAGE ERRORS PRESENT');
console.log('PHASE5_DONE');

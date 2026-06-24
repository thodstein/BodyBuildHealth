import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const pageerrors = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox','--disable-gpu','--window-size=420,860'], defaultViewport: { width: 420, height: 860 } });
const page = await browser.newPage();
page.on('pageerror', e => pageerrors.push(e.message));
await page.goto('http://localhost:4174/', { waitUntil: 'networkidle2', timeout: 45000 });
await page.waitForFunction(() => !document.querySelector('.screen-loading'), { timeout: 30000 }).catch(()=>{});
await new Promise(r=>setTimeout(r,2000));
async function clickText(txt){ try{ const el=await page.evaluateHandle((t)=>{const a=[...document.querySelectorAll('button,a,div[role=button],li,h2,h3')];return a.find(e=>(e.innerText||'').includes(t))||null;},txt); const n=el.asElement(); if(n){await n.click();return true;} }catch(e){} return false; }
async function clickBtn(re){ try{ return page.evaluate((r)=>{const b=[...document.querySelectorAll('button')].find(x=>new RegExp(r).test(x.innerText));if(b){b.click();return b.innerText;}return null;},re);}catch(e){return null;} }
async function body(n=800){ try{ return (await page.evaluate(()=>document.body.innerText)).replace(/\n{2,}/g,'\n').slice(0,n);}catch(e){return 'ERR '+(e.message);} }

await clickText('Тренинг'); await new Promise(r=>setTimeout(r,1000));
await clickText('Планирование'); await new Promise(r=>setTimeout(r,1200));
await clickBtn('Сгенерировать план'); await new Promise(r=>setTimeout(r,2500));
await clickBtn('▶ Выполнение'); await new Promise(r=>setTimeout(r,1200));
await clickBtn('Начать тренировку'); await new Promise(r=>setTimeout(r,1500));
await page.screenshot({path:'scripts/render-09-session-active.png'});
console.log('=== SESSION ACTIVE ==='); console.log((await body(450)).slice(0,350));
// log the first set (OK button) then finish
await clickBtn('OK'); await new Promise(r=>setTimeout(r,500));
await clickBtn('⏹ Завершить'); await new Promise(r=>setTimeout(r,2000));
await page.screenshot({path:'scripts/render-10-session-done.png'});
const done = await body(800);
console.log('=== SESSION DONE (D1 metrics?) ==='); console.log(done.slice(0,500));
console.log('D1 LMS metrics shown:', /LMS-метрики сессии|Тоннаж|КПШ|Инт\.отн|УОИ/.test(done));
// constructor mode toggle test
await clickText('📐 Планирование'); await new Promise(r=>setTimeout(r,500));
await clickBtn('🛠 Конструктор'); await new Promise(r=>setTimeout(r,1200));
await page.screenshot({path:'scripts/render-11-constructor.png'});
const con = await body(400);
console.log('=== CONSTRUCTOR MODE ==='); console.log(con.slice(0,300));
console.log('constructor tabs (no srcbb):', /📋 План|🔄 Циклы|📚 Программы/.test(con) && !/🏆 СРЦ\/BB/.test(con.split('Конструктор')[1]||''));

await browser.close();
console.log('=== PAGE ERRORS:', pageerrors.length, '===');
pageerrors.slice(0,8).forEach(e=>console.log('  PE:', e.slice(0,250)));
console.log(pageerrors.length===0 ? '✅ ZERO PAGE ERRORS — full runtime render OK' : '❌ page errors');
console.log('FINAL_DONE');

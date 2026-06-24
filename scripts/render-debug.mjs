import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const errors = []; const pageerrors = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox','--disable-gpu','--window-size=420,860'], defaultViewport: { width: 420, height: 860 } });
const page = await browser.newPage();
page.on('console', m => errors.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => pageerrors.push(e.message + '\n' + (e.stack||'').slice(0,400)));
await page.goto('http://localhost:4174/', { waitUntil: 'networkidle2', timeout: 45000 });
await page.waitForFunction(() => !document.querySelector('.screen-loading'), { timeout: 30000 }).catch(()=>{});
await new Promise(r=>setTimeout(r,2000));
async function clickText(txt){ const el = await page.evaluateHandle((t)=>{ const all=[...document.querySelectorAll('button,a,div[role=button],li,h2,h3')]; return all.find(e=>(e.innerText||'').trim()===t||(e.innerText||'').includes(t))||null; }, txt); const n=el.asElement(); if(n){ await n.click(); return true;} return false; }

await clickText('Тренинг'); await new Promise(r=>setTimeout(r,1200));
await clickText('Планирование'); await new Promise(r=>setTimeout(r,1500));
await clickText('📋 План'); await new Promise(r=>setTimeout(r,600));

// Click the generate button by matching exact text on a BUTTON element
const clicked = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const b = btns.find(x => /Сгенерировать план/.test(x.innerText));
  if (b) { b.click(); return b.innerText; }
  return null;
});
console.log('generate button clicked:', clicked);
await new Promise(r=>setTimeout(r,3000));
// full scroll + dump
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await new Promise(r=>setTimeout(r,800));
const full = await page.evaluate(() => document.body.innerText);
console.log('=== has Неделя:', /Неделя 1/.test(full), '| has Метрики цикла:', /Метрики цикла/.test(full), '| has тоннаж:', /тоннаж/i.test(full), '| has Присед:', /Присед/.test(full));
// find the plan card text
const idx = full.indexOf('План:');
console.log('=== plan card snippet ===');
console.log(full.slice(idx, idx+500));
console.log('=== PAGE ERRORS ===');
pageerrors.slice(0,5).forEach(e=>console.log('  PE:', e.slice(0,300)));
console.log('=== CONSOLE ERRORS (non-supabase) ===');
errors.filter(e=>!/supabase|websocket|ERR_NAME_NOT_RESOLVED|realtime/i.test(e)).slice(0,10).forEach(e=>console.log('  ', e.slice(0,250)));
await browser.close();
console.log('DEBUG_DONE');

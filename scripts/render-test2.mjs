import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:4174/';
const errors = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox','--disable-gpu','--window-size=420,860'], defaultViewport: { width: 420, height: 860 } });
const page = await browser.newPage();
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 });
await page.waitForFunction(() => !document.querySelector('.screen-loading'), { timeout: 30000 }).catch(()=>{});
await new Promise(r=>setTimeout(r,2500));

// helper: click element whose visible text contains substring
async function clickText(txt) {
  const el = await page.evaluateHandle((t) => {
    const all = [...document.querySelectorAll('button, a, div[role=button], li')];
    return all.find(e => (e.innerText||'').trim() === t || (e.innerText||'').includes(t)) || null;
  }, txt);
  const node = el.asElement();
  if (node) { await node.click(); return true; }
  return false;
}

// 1) go to Тренинг (bottom nav)
let ok = await clickText('Тренинг');
console.log('click Тренинг:', ok);
await new Promise(r=>setTimeout(r,2500));
await page.screenshot({ path: 'scripts/render-02-training.png' });
const t02 = await page.evaluate(() => document.body.innerText.slice(0,600));
console.log('=== TRAINING BODY ==='); console.log(t02.replace(/\n{2,}/g,'\n').slice(0,600));

// 2) check we see planning group / hero
const hasHero = await page.evaluate(() => document.body.innerText.includes('Планирование') || document.body.innerText.includes('Тренировки') || document.body.innerText.includes('СРЦ'));
console.log('has training/планирование:', hasHero);

await browser.close();
console.log('=== ERRORS this phase ===');
[...new Set(errors)].slice(0,15).forEach(e=>console.log('  -', e.slice(0,200)));
console.log('PHASE2_DONE');

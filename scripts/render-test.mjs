import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:4174/';
const errors = [];
const logs = [];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--window-size=420,860'],
  defaultViewport: { width: 420, height: 860 },
});
const page = await browser.newPage();
page.on('console', m => { logs.push(`[${m.type()}] ${m.text()}`); if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('requestfailed', r => errors.push('REQFAIL: ' + r.url() + ' ' + (r.failure()?.errorText||'')));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 });
// wait for app init (registry.init) — loader disappears, real content shows
await page.waitForFunction(() => !document.querySelector('.screen-loading') || document.querySelector('.app nav, .app button'), { timeout: 30000 }).catch(()=>{});
await new Promise(r => setTimeout(r, 3000));

const h1 = await page.evaluate(() => document.body.innerText.slice(0,500));
console.log('=== INITIAL BODY ===');
console.log(h1.replace(/\n{2,}/g,'\n').slice(0,500));
console.log('=== ERROR COUNT:', errors.length, '===');
[...new Set(errors)].slice(0,20).forEach(e=>console.log('  -', e.slice(0,220)));
await page.screenshot({ path: 'scripts/render-01-initial.png' });
console.log('screenshot 01 saved');
globalThis.__b = browser; globalThis.__p = page; globalThis.__e = errors;
console.log('PHASE1_DONE');


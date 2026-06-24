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

async function clickText(txt) {
  const el = await page.evaluateHandle((t) => {
    const all = [...document.querySelectorAll('button, a, div[role=button], li, h2, h3')];
    return all.find(e => (e.innerText||'').trim() === t || (e.innerText||'').includes(t)) || null;
  }, txt);
  const node = el.asElement(); if (node) { await node.click(); return true; } return false;
}
async function snap(name){ await page.screenshot({ path: 'scripts/'+name }); }
async function body(n=600){ return (await page.evaluate(() => document.body.innerText)).replace(/\n{2,}/g,'\n').slice(0,n); }

await clickText('Тренинг'); await new Promise(r=>setTimeout(r,1500));
await clickText('Планирование'); await new Promise(r=>setTimeout(r,2000));
await snap('render-03-planning.png');
console.log('=== PLANNING (src_auto → SRCBBScreen) ===');
console.log(await body(700));

// click СРЦ (сила) mode + План view, then generate
await clickText('СРЦ (сила)'); await new Promise(r=>setTimeout(r,800));
await clickText('📋 План'); await new Promise(r=>setTimeout(r,800));
const gen = await clickText('Сгенерировать план');
console.log('click generate:', gen);
await new Promise(r=>setTimeout(r,2500));
await snap('render-04-src-plan.png');
console.log('=== after СРЦ generate ===');
const t4 = await body(700);
console.log(t4);
console.log('has тоннаж/КПШ/УОИ:', /тоннаж|КПШ|УОИ/i.test(t4));
console.log('has Неделя 1:', /Неделя 1|Нед 1|Нед\.? ?1/i.test(t4));

await browser.close();
console.log('=== ERRORS ===');
[...new Set(errors)].filter(e=>!e.includes('supabase') && !e.includes('websocket')).slice(0,15).forEach(e=>console.log('  -', e.slice(0,200)));
console.log('PHASE3_DONE');

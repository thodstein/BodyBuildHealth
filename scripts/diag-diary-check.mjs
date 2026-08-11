import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--window-size=390,844'], defaultViewport: { width: 390, height: 844 } });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:4174/', { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction(() => !document.querySelector('.screen-loading'), { timeout: 30000 }).catch(() => {});
await new Promise(r => setTimeout(r, 2500));
const clickText = async (t) => { try { const el = await page.evaluateHandle((x) => { const a = [...document.querySelectorAll('button,a,div[role=button],li,h2,h3')]; return a.find(e => (e.innerText || '').includes(x)) || null; }, t); const n = el.asElement(); if (n) { await n.click(); return true; } } catch (e) {} return false; };
const clickNav = async (t) => { const ok = await page.evaluate((x) => { const b = [...document.querySelectorAll('button')].find(e => (e.innerText || '').trim() === x || (e.innerText || '').includes(x)); if (b) { b.click(); return true; } return false; }, t); return ok; };

await clickNav('Тренинг'); await new Promise(r => setTimeout(r, 2500));
for (let i = 0; i < 3; i++) {
  const onTraining = await page.evaluate(() => /Тренировки|Планировщик|Тренировка/.test(document.body.innerText));
  if (onTraining) break;
  await clickNav('Тренинг'); await new Promise(r => setTimeout(r, 1500));
}
await clickText('Дневник и аналитика'); await new Promise(r => setTimeout(r, 2000));
const body1 = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, '\n').slice(0, 300));
console.log('=== after zone click ==='); console.log(body1);
await clickText('История'); await new Promise(r => setTimeout(r, 1500));
const body2 = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, '\n').slice(0, 300));
console.log('=== after История click ==='); console.log(body2);

const res = await page.evaluate(() => {
  const input = [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes('Поиск по неделе'));
  const groupBtn = [...document.querySelectorAll('button')].find(b => (b.innerText || '').includes('Все группы'));
  return {
    hasSearch: !!input,
    searchStyle: input ? { padding: getComputedStyle(input).padding, radius: getComputedStyle(input).borderRadius, bg: getComputedStyle(input).background } : null,
    hasGroupBtn: !!groupBtn,
    groupBtnText: groupBtn ? (groupBtn.innerText || '').replace(/\s+/g, ' ').slice(0, 40) : null,
    hasOldSelect: !!([...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'chest'))),
  };
});
console.log(JSON.stringify(res, null, 1));

if (res.hasGroupBtn) {
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').includes('Все группы')); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 800));
  const popup = await page.evaluate(() => {
    const overlay = [...document.querySelectorAll('div')].find(d => (d.innerText || '').includes('Выбор по группам'));
    const chestBtn = overlay ? [...overlay.querySelectorAll('button')].find(b => (b.innerText || '').includes('Грудь')) : null;
    return { hasPopup: !!overlay, hasChest: !!chestBtn, popupText: overlay ? (overlay.innerText || '').replace(/\s+/g, ' ').slice(0, 80) : null };
  });
  console.log('POPUP', JSON.stringify(popup));
}

await browser.close();
console.log('DONE');

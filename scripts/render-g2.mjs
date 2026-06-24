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
// week nav arrow: button with text exactly '▶'
const navWeek = async (dir) => page.evaluate((d)=>{ const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()===d); if(b){b.click();return true;} return false; }, dir);

await clickText('Тренинг'); await new Promise(r=>setTimeout(r,1000));
await clickText('Планирование'); await new Promise(r=>setTimeout(r,1200));
await clickBtn('Сгенерировать план'); await new Promise(r=>setTimeout(r,2500));
await page.evaluate(() => window.scrollTo(0, 600));
await new Promise(r=>setTimeout(r,800));
const full = await page.evaluate(() => document.body.innerText);
console.log('has Неделя 1/12:', /Неделя 1 \/ 12/.test(full));
console.log('has ПМ на неделю:', /ПМ на неделю/.test(full));
console.log('has День 1:', /День 1/.test(full));
console.log('has setStr:', /\d+x\d+x[\d.]+кг \(\d+%\)/.test(full));
console.log('has Итоги мезоцикла:', /Итоги мезоцикла/.test(full));
console.log('has Что дальше:', /Что дальше/.test(full));
console.log('has phase strip buttons:', /База \(накопление\)|Накопление \(рост|Пик \(интенсификация\)/.test(full));
const idx = full.indexOf('План:');
console.log('=== plan card ==='); console.log(full.slice(idx, idx+700));
// navigate forward 5 times via exact ▶
for (let i=0;i<5;i++){ await navWeek('▶'); await new Promise(r=>setTimeout(r,300)); }
await new Promise(r=>setTimeout(r,500));
const w6 = await page.evaluate(() => document.body.innerText);
console.log('=== after 5x ▶: has Неделя 6/12:', /Неделя 6 \/ 12/.test(w6));
const i6 = w6.indexOf('Неделя');
console.log(w6.slice(i6, i6+150));
await page.screenshot({path:'scripts/render-12-plan-w6.png'});

// charts
await clickBtn('📊 График'); await new Promise(r=>setTimeout(r,1500));
const cc = await page.evaluate(()=>document.querySelectorAll('canvas').length);
const ct = await page.evaluate(()=>document.body.innerText);
console.log('=== CHARTS canvases:', cc, '| 4 titles:', /Тоннаж по неделям/.test(ct) && /КПШ по неделям/.test(ct) && /Инт\.отн \+ УОИ/.test(ct) && /Инт\.Ф\+Б/.test(ct));
await page.screenshot({path:'scripts/render-13-charts4.png'});
await browser.close();
console.log('PE:', pe.length, pe.length===0?'✅':'❌');
console.log('G2_DONE');

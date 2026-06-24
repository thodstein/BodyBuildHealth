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
const body = async (n=700)=> (await page.evaluate(()=>document.body.innerText)).replace(/\n{2,}/g,'\n').slice(0,n);

await clickText('Тренинг'); await new Promise(r=>setTimeout(r,1000));
await clickText('Планирование'); await new Promise(r=>setTimeout(r,1200));
// BB generate
await clickBtn('💪 Бодибилдинг'); await new Promise(r=>setTimeout(r,1000));
await clickBtn('Сгенерировать BB-план'); await new Promise(r=>setTimeout(r,2500));
// Методики → Объём → select first → apply composition
await clickBtn('🧠 Методики'); await new Promise(r=>setTimeout(r,1500));
await clickBtn('Объём'); await new Promise(r=>setTimeout(r,700));
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Применить к плану'); if(b)b.click(); });
await new Promise(r=>setTimeout(r,800));
// apply composition
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/Применить к плану ▶/.test(x.innerText)); if(b)b.click(); });
await new Promise(r=>setTimeout(r,1200));
const note = await page.evaluate(()=>{ const m=document.body.innerText.match(/✓ Применена методология[^\n]*/); return m?m[0]:null; });
console.log('methodology note:', note);
// back to plan, check active methodology badge
await clickBtn('📋 План'); await new Promise(r=>setTimeout(r,1200));
const planBody = await body(400);
console.log('plan has applied methodology:', /Применена методология|объём×|техн:/.test(planBody));
await browser.close();
console.log('PE:', pe.length, pe.length===0?'✅':'❌');
console.log('U7_DONE');

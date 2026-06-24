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
const setNum = async (aria,val)=>page.evaluate(({aria,val})=>{ const inp=[...document.querySelectorAll(`input[type=number][aria-label="${aria}"]`)].pop(); if(!inp)return false; const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(inp,String(val)); inp.dispatchEvent(new Event('input',{bubbles:true})); return true; }, {aria,val});

await clickText('Тренинг'); await new Promise(r=>setTimeout(r,1000));
await clickText('Планирование'); await new Promise(r=>setTimeout(r,1200));
await clickBtn('Сгенерировать план'); await new Promise(r=>setTimeout(r,2500));
await clickBtn('✏️ Правка плана'); await new Promise(r=>setTimeout(r,1000));
// click first "＋ Добавить упражнение из каталога"
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/Добавить упражнение из каталога/.test(x.innerText)); if(b){b.click();return true;} return false; });
await new Promise(r=>setTimeout(r,1000));
const picker = await page.evaluate(()=>document.body.innerText.includes('Упражнение в день'));
console.log('picker open:', picker);
// select group Грудь
await clickBtn('Грудь'); await new Promise(r=>setTimeout(r,700));
// select first exercise option
await page.evaluate(()=>{ const sel=[...document.querySelectorAll('select')].pop(); if(sel && sel.options.length>1){ sel.value=sel.options[1].value; sel.dispatchEvent(new Event('change',{bubbles:true})); return sel.value; } return null; });
await new Promise(r=>setTimeout(r,700));
// set scheme weight 50 (last вес input in picker)
await setNum('вес', 50); await new Promise(r=>setTimeout(r,500));
// click Добавить в день
await clickBtn('Добавить в день'); await new Promise(r=>setTimeout(r,1200));
const after = await page.evaluate(()=>document.body.innerText);
const added = /＋ добавлено/.test(after);
console.log('exercise added (＋ добавлено):', added);
// exit edit
await clickBtn('✓ Готово'); await new Promise(r=>setTimeout(r,1000));
// verify propagation to Выполнение
await clickBtn('▶ Выполнение'); await new Promise(r=>setTimeout(r,1200));
await clickBtn('Начать тренировку'); await new Promise(r=>setTimeout(r,1500));
const run = await page.evaluate(()=>document.body.innerText);
const exNames = await page.evaluate(()=>[...document.querySelectorAll('div')].map(d=>d.innerText).filter(t=>/Жим штанги лёжа|Жим гантелей|added/i.test(t)).slice(0,3));
console.log('Выполнение has 50кг target:', /50кг/.test(run));
await page.screenshot({path:'scripts/render-18-u5-addex.png'});
await browser.close();
console.log('PE:', pe.length, pe.length===0?'✅':'❌');
console.log('U5_DONE');

import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const pageerrors = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox','--disable-gpu','--window-size=420,860'], defaultViewport: { width: 420, height: 860 } });
try {
  const page = await browser.newPage();
  page.on('pageerror', e => pageerrors.push(e.message));
  page.on('console', m => { if (m.type()==='error') pageerrors.push('CONSOLE_ERR: ' + m.text()); });
  await page.goto('http://localhost:4174/', { waitUntil: 'networkidle2', timeout: 45000 });
  await page.waitForFunction(() => !document.querySelector('.screen-loading'), { timeout: 30000 }).catch(()=>{});
  await new Promise(r=>setTimeout(r,2000));
  const clickText = async (t)=>{ try{ const el=await page.evaluateHandle((x)=>{const a=[...document.querySelectorAll('button,a,div[role=button],li,h2,h3')];return a.find(e=>(e.innerText||'').includes(x))||null;},t); const n=el.asElement(); if(n){await n.click();return true;} }catch(e){} return false; };
  const clickBtn = async (re)=>{ try{ return await page.evaluate((r)=>{const b=[...document.querySelectorAll('button')].find(x=>new RegExp(r).test(x.innerText));if(b){b.click();return b.innerText;}return null;},re);}catch(e){return null;} };
  // full flow: training → planning → SRC plan → all views → session → finish → constructor
  await clickText('Тренинг'); await new Promise(r=>setTimeout(r,1000));
  await clickText('Планирование'); await new Promise(r=>setTimeout(r,1200));
  await clickBtn('Сгенерировать план'); await new Promise(r=>setTimeout(r,2500));
  for (const v of ['🎬 Демо','📊 График','🧮 Блины','🧠 Авторег','🏁 Пик','🔋 Восст','🛡 Безоп','▶ Выполнение','📋 План']) { await clickBtn(v); await new Promise(r=>setTimeout(r,900)); }
  await clickBtn('Начать тренировку'); await new Promise(r=>setTimeout(r,1200));
  await clickBtn('OK'); await new Promise(r=>setTimeout(r,400));
  await clickBtn('⏹ Завершить'); await new Promise(r=>setTimeout(r,1500));
  await clickText('🛠 Конструктор'); await new Promise(r=>setTimeout(r,1000));
  await clickText('Тренинг'); await new Promise(r=>setTimeout(r,800));
  // visit a few other top-level screens
  for (const s of ['Питание','Анализы','Риски','Фарма','БАДы','Профиль']) { await clickText(s); await new Promise(r=>setTimeout(r,1200)); }
} finally {
  await browser.close();
}
console.log('=== PAGE/CONSOLE ERRORS (non-supabase):', pageerrors.filter(e=>!/supabase|websocket|ERR_NAME_NOT_RESOLVED|realtime|GoTrueClient/i.test(e)).length, '===');
pageerrors.filter(e=>!/supabase|websocket|ERR_NAME_NOT_RESOLVED|realtime|GoTrueClient/i.test(e)).slice(0,15).forEach(e=>console.log('  -', e.slice(0,220)));
console.log('=== supabase/network-only errors (expected, headless no DNS):', pageerrors.filter(e=>/supabase|websocket|ERR_NAME_NOT_RESOLVED|realtime|GoTrueClient/i.test(e)).length, '===');
console.log('RENDER_FINAL_DONE');

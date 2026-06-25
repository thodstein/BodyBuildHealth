import puppeteer from 'puppeteer-core';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'; const pe=[];
const browser=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-gpu','--window-size=420,860'],defaultViewport:{width:420,height:860}});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',e=>{errors.push('PE: '+e.message.slice(0,150));});
page.on('console',m=>{if(m.type()==='error'&&!/supabase|websocket|GoTrue|ERR_NAME/i.test(m.text())) errors.push('CE: '+m.text().slice(0,150));});

await page.goto('http://localhost:4174/',{waitUntil:'networkidle2',timeout:45000});
await page.waitForFunction(()=>!document.querySelector('.screen-loading'),{timeout:30000}).catch(()=>{});
await new Promise(r=>setTimeout(r,2000));
const clickText=async(t)=>{try{const el=await page.evaluateHandle((x)=>{const a=[...document.querySelectorAll('button,a,div[role=button],li,h2,h3')];return a.find(e=>(e.innerText||'').includes(x))||null;},t);const n=el.asElement();if(n){await n.click();return true;}}catch(e){}return false;};
const clickTab=async(l)=>page.evaluate((l)=>{const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()===l);if(b){b.click();return true;}return false;},l);
const bodyFull=async()=>(await page.evaluate(()=>document.body.innerText)).replace(/\n{2,}/g,'\n');

// ==========================================
// 1. ПЛ track — all views
// ==========================================
console.log('=== ПЛ TRACK ===');
await clickText('Тренинг');await new Promise(r=>setTimeout(r,1000));
await clickText('Планирование');await new Promise(r=>setTimeout(r,1500));
// ПЛ is default
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/🏆 ПЛ \(сила\)/.test(x.innerText));if(b)b.click();});
await new Promise(r=>setTimeout(r,1500));

const plViews=['📋 План','🧮 Блины','▶ Выполнение','🧠 Авторег','🏁 Пик','🔋 Восст','🛡 Безоп','🎬 Демо','📚 Программы','🧠 Методики','📈 Аналитика','🧮 Pro-метрики','📊 График'];
for(const v of plViews){
  await clickTab(v);await new Promise(r=>setTimeout(r,1200));
  const t=await bodyFull();
  const short=v.replace(/^[^ ]+ /,'');
  const hasContent=t.length>300;
  const hasError=/undefined|NaN|null|Error|TypeError|Cannot read/.test(t);
  // check for silly content like "+5 кг в жиме лежа" in BB context
  const sillyPl=/\+\d+ кг в жиме|ожидаемый прирост.*жим/i.test(t);
  console.log(`  ПЛ ${short}: ${hasContent?'OK':'EMPTY'}${hasError?' ⚠ERR':''}${sillyPl?' ⚠SILLY':''}`);
}

// Generate ПЛ plan + verify
await clickTab('📋 План');await new Promise(r=>setTimeout(r,800));
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Сгенерировать план/.test(x.innerText));if(b)b.click();});
await new Promise(r=>setTimeout(r,2500));
const plPlan=await bodyFull();
console.log('  ПЛ plan has Неделя:', /Неделя/.test(plPlan),'| has упражнения:', /\d+x\d+|\d+×\d+/.test(plPlan));
console.log('  ПЛ plan silly content:', /\+\d+ кг в жиме|ожидаемый прирост.*жим|прирост.*жим/i.test(plPlan));

// ==========================================
// 2. ББ track
// ==========================================
console.log('=== ББ TRACK ===');
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/💪 ББ/.test(x.innerText));if(b)b.click();});
await new Promise(r=>setTimeout(r,1500));
// Generate BB plan
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Сгенерировать BB-план/.test(x.innerText));if(b)b.click();});
await new Promise(r=>setTimeout(r,2500));
const bbPlan=await bodyFull();
console.log('  ББ plan has сплит:', /сплит|Верх|Низ|PPL|Push|Pull/i.test(bbPlan));
console.log('  ББ plan has exercises:', /\d+x\d+|\d+×\d+/.test(bbPlan));
console.log('  ББ plan silly:', /\+\d+ кг в жиме|ожидаемый прирост.*жим|прирост.*жим/i.test(bbPlan));
// check estimated progress
const bbProgMatch=bbPlan.match(/прогресс|прирост|estimatedProgress|estimated.*/i);
console.log('  ББ estimatedProgress:', bbProgMatch?bbProgMatch[0].slice(0,80):'none found');

// Check all BB views
for(const v of plViews){
  await clickTab(v);await new Promise(r=>setTimeout(r,1000));
  const t=await bodyFull();
  const short=v.replace(/^[^ ]+ /,'');
  const silly=/\+\d+ кг в жиме|ожидаемый прирост.*жим|прирост.*жим/i.test(t);
  console.log(`  ББ ${short}: ${t.length>300?'OK':'EMPTY'}${silly?' ⚠SILLY':''}`);
}

// ==========================================
// 3. Ручной сбор — all tabs
// ==========================================
console.log('=== РУЧНОЙ СБОР ===');
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/🛠 Ручной сбор/.test(x.innerText));if(b)b.click();});
await new Promise(r=>setTimeout(r,1500));

const manualTabs=['📋 План','🔄 Циклы','📚 Программы','⭐ Мои','🧠 Методики','🛠️ Ручной конструктор'];
for(const v of manualTabs){
  await clickTab(v);await new Promise(r=>setTimeout(r,1500));
  const t=await bodyFull();
  const short=v.replace(/^[^ ]+ /,'');
  const hasContent=t.length>300;
  const silly=/\+\d+ кг в жиме|ожидаемый прирост.*жим|прирост.*жим/i.test(t);
  console.log(`  Manual ${short}: ${hasContent?'OK':'EMPTY'}${silly?' ⚠SILLY':''}`);
}

// ==========================================
// 4. Other screens (nutrition, labs, risks, pharma, support, profile)
// ==========================================
console.log('=== OTHER SCREENS ===');
for(const s of ['Питание','Анализы','Риски','Фарма','БАДы','Профиль']){
  await clickText(s);await new Promise(r=>setTimeout(r,2000));
  const t=await bodyFull();
  console.log(`  ${s}: ${t.length>400?'OK':'EMPTY'} | pe so far: ${errors.length}`);
}

console.log('\n=== ALL ERRORS ===');
[...new Set(errors)].slice(0,15).forEach(e=>console.log('  ',e));
console.log('TOTAL ERRORS:', errors.length);
console.log('FULL_CHECK_DONE');
await browser.close();

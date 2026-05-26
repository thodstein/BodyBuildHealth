import { calcReadiness } from '../engines/readiness.engine';
import { calculateRisks } from '../engines/risk.engine';
import { calculateDose } from '../engines/dosage.engine';
import { calcTraining } from '../engines/training.engine';
import { calcNutrition, generateNutritionAdvice } from '../engines/nutrition.engine';
import { calcFertility } from '../engines/fertility.engine';
import { generateSupportStack } from '../engines/support.full';
import { generateReadinessForecast, predictLabTrend, runWhatIf } from '../engines/predictive.full';
import { calcTrust, checkAchievements } from '../engines/gamification.full';
import { getBestPrice, MOCK_MARKETPLACE_DB } from '../engines/marketplace.engine';
import { getArticles, shareToTelegram } from '../engines/articles.engine';
import { queryAssistant } from '../engines/smart-assistant';
import { getTooltip } from '../core/glossary';
import { exportToJSON, exportToCSV, generateReportText, downloadFile } from '../core/export.full';
import { renderLabsDiagnostics } from './labs-diagnostics';
import { renderForm } from './forms';
import { drawLineChart } from './charts';
import { registerSW, isOnline, monitorConnection } from '../core/service-worker';
import { db } from '../core/db';

export function renderDashboard(demo: any) {
  const app = document.getElementById('app')!;

  // 1. Расчеты всех движков (ТЗ §3, §4, §5, §7, §8, §9, §10, §12, §13, §15, §17, §18)
  const r = calcReadiness(demo.readiness);
  const k = calculateRisks(demo.risks);
  const d = calculateDose(demo.dose);
  const t = calcTraining(demo.training);
  const n = calcNutrition(demo.nutrition);
  const nAdvice = generateNutritionAdvice(n, demo.actualNutrition, demo.drugs);
  const f = calcFertility(demo.fertility);
  const stack = generateSupportStack(k.systemBreakdown, demo.genetics, demo.activeDrugs);
  const pred = generateReadinessForecast(demo.history?.readiness || [58,56,53,50,48]);
  const labPred = predictLabTrend(demo.history?.hct || [48,49,50,51,52]);
  const trust = calcTrust(demo.gamification);
  const whats = runWhatIf(k.overallNet, r.recovery, { drugChange:{ trenbolone_acetate:0.5 }, sleepChange:1 });
  const achievements = checkAchievements(demo.gamification);
  const articles = getArticles({ status:'published' });
  const offlineBanner = !isOnline() ? `<div style="background:#ff9f0a;color:#000;text-align:center;padding:8px;font-size:13px;">📡 Офлайн-режим. Некоторые функции ограничены.</div>` : '';

  // 2. Генерация интерфейса (10 вкладок по ТЗ §23.1)
  app.innerHTML = `
    ${offlineBanner}
    <div class="header"><h1>📊 Health Engine TZ v1.7</h1></div>
    <div class="tabs" style="overflow-x:auto;">
      <div class="tab active" data-tab="dash">📈 Готовность</div>
      <div class="tab" data-tab="train">🏋️ Тренинг</div>
      <div class="tab" data-tab="food">🥗 Питание</div>
      <div class="tab" data-tab="labs">🧪 Лабы</div>
      <div class="tab" data-tab="support">🛡️ Поддержка</div>
      <div class="tab" data-tab="fert">🧬 Фертильность</div>
      <div class="tab" data-tab="predict">📉 Прогноз</div>
      <div class="tab" data-tab="articles">📚 Статьи</div>
      <div class="tab" data-tab="assist">🤖 Ассистент</div>
      <div class="tab" data-tab="export">💾 Экспорт</div>
    </div>

    <div id="page-dash" class="page active">
      <div class="card"><h3>✅ Readiness <span class="badge s" title="${getTooltip('RIR')||''}">RIR: ${t.rir}</span></h3>
        <div class="row"><span class="label">Recovery</span><span class="value" style="color:${r.recovery<40?'var(--danger)':'var(--success)'}">${r.recovery}%</span></div>
        <div class="row"><span class="label">Nutrition</span><span class="value" style="color:${r.nutrition<50?'var(--warning)':'var(--success)'}">${r.nutrition}%</span></div>
        <div class="row"><span class="label">Fatigue</span><span class="value" style="color:${r.fatigue>70?'var(--danger)':'var(--success)'}">${r.fatigue}%</span></div>
        ${r.isConservative?`<div class="cons">⚠️ Консервативный: ${r.conservativeReason}</div>`:''}
      </div>
      <div class="card"><h3>⚖️ Risks (raw → net)</h3>
        ${Object.entries(k.systemBreakdown).map(([s,v])=>`<div class="row"><span class="label">${s.toUpperCase()}</span><span class="value">${v.raw.toFixed(1)}% → <b style="color:var(--${v.net<30?'success':v.net<60?'warning':'danger'})">${v.net.toFixed(1)}%</b></span></div>`).join('')}
        <div class="row" style="border-top:1px solid var(--border);padding-top:8px;"><span class="label"><b>Overall</b></span><span class="value"><b>${k.overallRaw.toFixed(1)}% → ${k.overallNet.toFixed(1)}%</b></span></div>
      </div>
      <div class="card"><h3>💉 Dosage</h3>
        <div class="row"><span class="label">Volume</span><span class="value">${d.volumeMl} ml (${d.divisions} дел.)</span></div>
        <div class="row"><span class="label">Doses/Vial</span><span class="value">${d.dosesPerVial}</span></div>
        ${d.flags.length?`<div class="flags">⚠️ ${d.flags.join(', ')}</div>`:''}
      </div>
    </div>

    <div id="page-train" class="page">
      <div class="card"><h3>🏋️ Программа & Объём</h3>
        <div class="row"><span class="label">Сплит</span><span class="value"><b>${t.splitName}</b></span></div>
        <div style="font-size:12px;color:#8e8e93;margin:4px 0">${t.splitDesc}</div>
        <div class="row"><span class="label">RIR</span><span class="value">${t.rir}</span></div>
        ${t.isDeload?`<div class="cons">🔴 Делоуд: ${t.deloadReason}</div>`:''}
        <div style="margin:8px 0;padding:8px;background:#252527;border-radius:8px;">${Object.entries(t.volumePerGroup).map(([g,v])=>`<div class="row"><span class="label">${g.toUpperCase()}</span><span class="value">${v} сетов</span></div>`).join('')}</div>
        <div style="font-size:13px;margin-top:6px;">📌 ${t.weekPlan}</div>
      </div>
    </div>

    <div id="page-food" class="page">
      <div class="card"><h3>🥗 Цели & Факт</h3>
        <div class="row"><span class="label">Ккал</span><span class="value">${n.kcal}</span></div>
        <div class="row"><span class="label">Б/Ж/У</span><span class="value">${n.protein}/${n.fats}/${n.carbs} г</span></div>
        <div class="row"><span class="label">Вода/Клетчатка</span><span class="value">${n.water} л / ${n.fiber} г</span></div>
        <pre style="white-space:pre-wrap;font-size:13px;background:#252527;padding:10px;border-radius:8px;margin-top:8px;">${nAdvice}</pre>
      </div>
    </div>

    <div id="page-labs" class="page"><div id="labs-container"></div></div>

    <div id="page-support" class="page">
      <div class="card"><h3>🛡️ Стек поддержки (ТЗ §10)</h3>
        ${stack.items.map(i=>`<div style="margin:6px 0;padding:8px;background:#252527;border-radius:8px;"><div class="row"><span class="label"><b>${i.name}</b></span><span class="value">${i.dose}</span></div><div style="font-size:12px;color:#8e8e93">${i.synergy}</div></div>`).join('')}
        <div class="row" style="margin-top:8px;"><span class="label">Снижение риска</span><span class="value" style="color:var(--success)">${k.overallRaw.toFixed(1)}% → ${k.overallNet.toFixed(1)}%</span></div>
      </div>
      <div class="card"><h3>🛒 Магазин</h3>
        ${MOCK_MARKETPLACE_DB.slice(0,3).map(item=>{
          const best = getBestPrice(item.purchaseOptions);
          return `<div style="border-bottom:1px solid #3a3a3c;padding:8px 0;"><div class="row"><span class="label"><b>${item.name}</b></span><span class="value">${best?best.price+' ₽':''}</span></div><div style="font-size:12px;color:#8e8e93">${best?best.platform+' • доставка '+best.deliveryDays+'д':'Нет в наличии'}</div></div>`;
        }).join('')}
        <button class="btn" style="margin-top:8px;">Перейти к оплате</button>
      </div>
    </div>

    <div id="page-fert" class="page">
      <div class="card"><h3>🧬 Индекс фертильности (IF)</h3>
        <div class="row"><span class="label">Текущий</span><span class="value">${f.ifScore}% (${f.interpretation})</span></div>
        <div class="row"><span class="label">Прогноз 6 нед</span><span class="value">${f.forecast6w}%</span></div>
        <div class="row"><span class="label">Прогноз 12 нед</span><span class="value">${f.forecast12w}%</span></div>
        <div style="font-size:12px;color:#8e8e93;margin-top:6px;">τ=12 нед (сперматогенный цикл). При HCG на курсе τ↓ до 8–10 нед.</div>
      </div>
    </div>

    <div id="page-predict" class="page">
      <div class="card"><h3>📈 Readiness (7 дн.)</h3>
        ${pred.values.map((v,i)=>`<div class="row"><span class="label">День ${i+1}</span><span class="value">${v}% ±${(pred.ci95[i][1]-pred.ci95[i][0]).toFixed(0)}</span></div>`).join('')}
        ${pred.warnings.map(w=>`<div class="cons">${w}</div>`).join('')}
      </div>
      <div class="card"><h3>🩸 Hct Прогноз</h3>
        <div class="row"><span class="label">Текущий</span><span class="value">${labPred.current}%</span></div>
        <div class="row"><span class="label">Через 4 нед</span><span class="value">${labPred.w4}%</span></div>
        <div class="row"><span class="label">Через 12 нед</span><span class="value">${labPred.w12}%</span></div>
        ${labPred.alert?`<div class="cons">${labPred.alert}</div>`:''}
      </div>
      <div class="card"><h3>🔄 What-If</h3><div class="row"><span class="label">Risk Δ</span><span class="value">${whats.riskDelta}%</span></div><div class="row"><span class="label">Readiness Δ</span><span class="value">${whats.readinessDelta}%</span></div><div style="font-size:12px;color:#8e8e93;margin-top:4px;">${whats.note}</div></div>
      <div class="card"><h3>🏆 Trust & Ачивки</h3><div class="row"><span class="label">Trust</span><span class="value">${trust.score}% (${trust.level})</span></div><div class="row"><span class="label">Объём</span><span class="value">×${trust.volumeMultiplier}</span></div>
        ${achievements.map(a=>`<div class="row" style="margin-top:6px;"><span class="label">${a.icon} ${a.name}</span><span class="value">+${a.xp} XP</span></div>`).join('')}
      </div>
    </div>

    <div id="page-articles" class="page">
      <div class="card"><h3>📚 Knowledge Base</h3>
        ${articles.map(a=>`<div style="margin:10px 0;padding:10px;background:#252527;border-radius:10px;">
          <div class="row"><span class="label"><b>${a.title}</b></span><span class="value">❤️ ${a.likes}</span></div>
          <div style="font-size:12px;color:#8e8e93;margin:4px 0">${a.teaser}</div>
          <div style="display:flex;gap:8px;margin-top:6px;">
            <button class="btn" style="flex:1;margin:0;padding:8px;font-size:12px;">Читать</button>
            <button class="btn" style="flex:1;margin:0;padding:8px;font-size:12px;background:#8e8e93;" onclick="window.open('${shareToTelegram(a.slug,a.title)}','_blank')">📤 Share</button>
          </div>
        </div>`).join('')}
      </div>
    </div>

    <div id="page-assist" class="page">
      <div class="card"><h3>🤖 Smart Assistant</h3>
        <input id="qa-input" type="text" placeholder="Спросите про гематокрит, пролактин, ПКТ..." style="width:100%;padding:10px;margin:8px 0;border-radius:8px;border:1px solid #3a3a3c;background:#252527;color:#fff;">
        <div id="qa-output" style="font-size:13px;color:#ccc;min-height:60px;"></div>
        <div id="form-container" style="margin-top:12px;"></div>
      </div>
    </div>

    <div id="page-export" class="page">
      <div class="card"><h3>💾 Экспорт и отчёты</h3>
        <button class="btn" id="exp-json">Скачать JSON (бэкап)</button>
        <button class="btn" style="margin-top:8px;background:#8e8e93" id="exp-csv">Скачать CSV (лабы)</button>
        <button class="btn" style="margin-top:8px;background:#30d158;color:#000" id="exp-txt">TXT-отчёт для врача</button>
        <button class="btn" style="margin-top:8px;background:#007aff" id="exp-pdf">🖨️ Печать/PDF</button>
      </div>
    </div>
    <div class="disclaimer">⚠️ Справочная информация. Не является медицинской рекомендацией.</div>
  `;

  // 3. Навигация по табам
  app.querySelectorAll('.tab').forEach(tab=>{
    tab.onclick=()=>{
      app.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      app.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
      tab.classList.add('active');
      const page = document.getElementById(`page-${tab.dataset.tab}`);
      page?.classList.add('active');
      
      if(tab.dataset.tab==='labs') renderLabsDiagnostics();
      if(tab.dataset.tab==='assist') {
        document.getElementById('form-container')?.append(renderForm({ title:'📝 Дневник (демо)', fields:[{key:'sleep',label:'Сон (часы)',type:'number',min:4,max:12,step:0.5},{key:'stress',label:'Стресс (1-10)',type:'number',min:1,max:10}], store:'daily_log' }, {}, ()=>alert('✅ Сохранено')));
      }
    };
  });

  // 4. Ассистент & Графики (при первом рендере)
  const qaInput = document.getElementById('qa-input');
  const qaOut = document.getElementById('qa-output');
  if(qaInput && qaOut) {
    qaInput.oninput = () => {
      qaOut.innerHTML = queryAssistant(qaInput.value).map(a=>`<div style="margin:6px 0;padding:6px;background:#252527;border-radius:6px;white-space:pre-wrap;">${a}</div>`).join('');
    };
  }

  // 5. Экспорт хендлеры
  document.getElementById('exp-json')?.addEventListener('click', () => downloadFile(exportToJSON(demo), 'backup.json', 'application/json'));
  document.getElementById('exp-csv')?.addEventListener('click', () => downloadFile(exportToCSV(demo.labs||[]), 'labs.csv'));
  document.getElementById('exp-txt')?.addEventListener('click', () => downloadFile(generateReportText(demo), 'report.txt'));
  document.getElementById('exp-pdf')?.addEventListener('click', () => window.print());

  // 6. Telegram SDK & Service Worker
  registerSW();
  monitorConnection(online => { if(!online) renderDashboard(demo); });
  
  if(window.Telegram?.WebApp?.MainButton) {
    window.Telegram.WebApp.MainButton.setText('🔄 Пересчитать').show().onClick(()=>renderDashboard(demo));
  }

  console.log('✅ Dashboard v1.7 rendered | 10 tabs | 16 engines integrated');
}
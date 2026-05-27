import { calcReadiness } from '../engines/readiness.engine';
import { calculateRisks } from '../engines/risk.engine';
import { calculateDose } from '../engines/dosage.engine';
import { calcTraining, getAvailableSplits } from '../engines/training.engine';
import { calcFertility } from '../engines/fertility.engine';
import { generateSupportStack } from '../engines/support.engine';
import { generateReadinessForecast, predictLabTrend, runWhatIf } from '../engines/predictive.engine';
import { calcTrust, checkAchievements } from '../engines/gamification.engine';
import { queryAssistant } from '../engines/assistant.engine';
import { exportToJSON, exportToCSV, downloadFile } from '../core/export';
import { generateWeeklyReportHTML, triggerPrintReport } from '../engines/weekly-report.engine';
import { setRole } from '../core/profile-manager';
import { logoutUser } from '../core/auth-manager';
import { db } from '../core/db';
import type { UserProfile } from '../core/types';

let labsRendered = false, pharmaRendered = false, articlesRendered = false, nutritionRendered = false;

export function renderDashboard(profile: UserProfile) {
  const ctx = {
    role: profile.role, age: profile.settings.age, sex: profile.settings.sex,
    weight: profile.settings.weight, goal: profile.settings.goal,
    phase: 'course', courseStartDate: new Date().toISOString()
  };

  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <div class="header">
      <h1>📊 Health Engine TZ v3.1</h1>
      <div style="display:flex;gap:8px;align-items:center;">
        <select id="header-role" style="width:auto;padding:4px 8px;background:transparent;color:#fff;border:1px solid #3a3a3c;border-radius:6px;font-size:12px;">
          <option value="user" ${ctx.role==='user'?'selected':''}>👤 User</option>
          <option value="coach" ${ctx.role==='coach'?'selected':''}>🏋️ Coach</option>
          <option value="doctor" ${ctx.role==='doctor'?'selected':''}>👨‍⚕️ Doctor</option>
        </select>
        <button id="btn-logout" style="background:transparent;border:1px solid #3a3a3c;color:#ff453a;padding:4px 8px;border-radius:6px;font-size:12px;cursor:pointer;">🚪</button>
      </div>
    </div>
    <div class="tabs" id="main-tabs">
      <div class="tab active" data-tab="dash">📈 Готовность</div>
      <div class="tab" data-tab="train">🏋️ Тренинг</div>
      <div class="tab" data-tab="food">🥗 Питание</div>
      <div class="tab" data-tab="labs">🧪 Лабы</div>
      <div class="tab" data-tab="support">🛡️ Поддержка</div>
      <div class="tab" data-tab="fert">🧬 Фертильность</div>
      <div class="tab" data-tab="predict">📉 Прогноз</div>
      <div class="tab" data-tab="pharma">💊 Фарма</div>
      <div class="tab" data-tab="articles">📚 Статьи</div>
      <div class="tab" data-tab="assist">🤖 Ассистент</div>
      <div class="tab" data-tab="export">💾 Отчёты</div>
    </div>

    <div id="page-dash" class="page active">
      <div class="card"><h3>✅ Добро пожаловать, ${profile.name}</h3>
        <div class="label">Роль: ${ctx.role} | Цель: ${ctx.goal} | Вес: ${ctx.weight}кг</div>
      </div>
    </div>
    <div id="page-train" class="page"><div class="card"><h3>🏋️ Тренинг</h3><div class="label">Модуль готов к рендеру</div></div></div>
    <div id="page-food" class="page"><div id="nutrition-container"></div></div>
    <div id="page-labs" class="page"><div id="labs-container"></div></div>
    <div id="page-support" class="page"><div class="card"><h3>🛡️ Поддержка</h3><div class="label">Модуль готов к рендеру</div></div></div>
    <div id="page-fert" class="page"><div class="card"><h3>🧬 Фертильность</h3><div class="label">Модуль готов к рендеру</div></div></div>
    <div id="page-predict" class="page"><div class="card"><h3>📉 Прогноз</h3><div class="label">Модуль готов к рендеру</div></div></div>
    <div id="page-pharma" class="page"><div id="pharma-container"></div></div>
    <div id="page-articles" class="page"><div id="articles-container"></div></div>
    <div id="page-assist" class="page">
      <div class="card"><h3>🤖 Ассистент</h3>
        <input id="qa-input" type="text" placeholder="Спросите про гематокрит, пролактин, ПКТ..." style="width:100%;padding:10px;margin:8px 0;border-radius:8px;border:1px solid #3a3a3c;background:#252527;color:#fff;">
        <div id="qa-output" style="font-size:13px;color:#ccc;min-height:60px;"></div>
      </div>
    </div>
    <div id="page-export" class="page">
      <div class="card"><h3>💾 Экспорт & Отчёты</h3>
        <button class="btn" id="exp-weekly">📅 Недельный отчёт (PDF)</button>
        <button class="btn" style="margin-top:8px;background:#8e8e93" id="exp-json">JSON (Бэкап)</button>
        <button class="btn" style="margin-top:8px;background:#30d158;color:#000" id="exp-csv">CSV (Лабы)</button>
      </div>
    </div>
    <div class="disclaimer">⚠️ Справочная информация. Не является медицинской рекомендацией.</div>
  `;

  document.getElementById('btn-logout')!.onclick = logoutUser;
  document.getElementById('header-role')!.onchange = (e) => {
    setRole((e.target as HTMLSelectElement).value as any);
    renderDashboard(profile);
  };

  app.querySelectorAll('#main-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      app.querySelectorAll('#main-tabs .tab').forEach(t => t.classList.remove('active'));
      app.querySelectorAll('.page').forEach(p => (p as HTMLElement).style.display = 'none');
      tab.classList.add('active');
      const page = app.getElementById(`page-${tab.dataset.tab}`);
      if (page) (page as HTMLElement).style.display = 'block';

      const tabId = tab.dataset.tab;
      if (tabId === 'food' && !nutritionRendered) {
        import('./nutrition-module').then(m => { m.renderNutritionModule(app.getElementById('nutrition-container')!, profile, []); nutritionRendered = true; });
      }
      if (tabId === 'labs' && !labsRendered) {
        import('./labs-diagnostics').then(m => { m.renderLabsDiagnostics(app.getElementById('labs-container')!); labsRendered = true; });
      }
      if (tabId === 'pharma' && !pharmaRendered) {
        import('./pharma-course').then(m => { m.renderPharmaModule(app.getElementById('pharma-container')!, []); pharmaRendered = true; });
      }
      if (tabId === 'articles' && !articlesRendered) {
        import('./articles-workflow').then(m => { m.renderArticlesWorkflow(app.getElementById('articles-container')!, ctx.role, profile.id); articlesRendered = true; });
      }
    });
  });

  const qaIn = app.getElementById('qa-input') as HTMLInputElement;
  const qaOut = app.getElementById('qa-output');
  if (qaIn && qaOut) {
    qaIn.addEventListener('input', () => {
      import('../engines/assistant.engine').then(m => {
        qaOut.innerHTML = m.queryAssistant(qaIn.value).map(a => `<div style="margin:6px 0;padding:6px;background:#252527;border-radius:6px;white-space:pre-wrap;">${a}</div>`).join('');
      });
    });
  }

  app.getElementById('exp-weekly')!.addEventListener('click', () => {
    import('../engines/weekly-report.engine').then(m => {
      m.triggerPrintReport(m.generateWeeklyReportHTML({
        ctx, labs: [], course: [], weightCurrent: ctx.weight, weightPrev: ctx.weight - 0.5, measurements: {}, goal: ctx.goal, macros: { p: 165, f: 75, c: 280 }, stepsAvg: 0, bpAvg: { sys: 120, dia: 80 }, bpNotes: '', trainingFeel: '', generalFeel: '', meds: '', supplements: '', lastLabDate: '', nextLabDate: '', notes: ''
      }), 'weekly-report.pdf');
    });
  });

  app.getElementById('exp-json')!.addEventListener('click', () => {
    downloadFile(JSON.stringify({ profile, date: new Date().toISOString() }, null, 2), 'backup.json');
  });

  app.getElementById('exp-csv')!.addEventListener('click', async () => {
    const labs = await db.getAll('labs_log') || [];
    downloadFile('date,code,value,unit\n' + labs.map((l: any) => `${l.date},${l.code},${l.value},${l.unit}`).join('\n'), 'labs.csv');
  });

  console.log('✅ Dashboard v3.1 loaded | Role:', ctx.role);
}

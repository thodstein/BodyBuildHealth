// src/ui/dashboard.ts — самодостаточный рендер с демо-данными внутри
export function renderDashboard(demo?: any) {
  // Если данные не переданы — используем дефолтные демо-данные
  const data = demo || {
    readiness: { sleepHours:7.2, sleepQuality:8, nightAwakenings:1, hrvRatio:1.05, doms:6, stress:4, subjFatigue:5, hrIncrease:0.5, trainingLoadRatio:0.72, calRatio:0.92, proteinRatio:1.05, waterRatio:0.85, fiberRatio:0.75, omega3Flag:true, riskCoverageMap:{} },
    risks: { activeDrugs:{testosterone_enanthate:{dosePerWeek:400}}, genetics:{COMT_Val158Met:'Met/Met'}, labs:[], nutritionFactor:0.85, trainingFactor:1.1, supportCoverage:{} },
    dose: { concentrationMgPerMl:250, targetDoseMg:150, syringeVolumeMl:1, divisionsPerMl:100, roundingStepMl:0.01, vialVolumeMl:10 },
    training: { level:'intermediate' as const, goal:'hypertrophy' as const, daysPerWeek:4, recovery:58, fatigue:45, nutrition:72, weakPoints:[] },
    nutrition: { weightKg:82, heightCm:180, age:29, sex:'male' as const, pal:1.55, goal:'cut' as const },
    fertility: { volumeMl:2.2, concentrationMlMln:18, totalCountMln:45, prPercent:35, morphologyPercent:3.8, ph:7.4, viscosity:false, marPercent:25, leukocytesMlMln:0.8, agglutination:false },
    history: { readiness:[58,56,53,50,48], hct:[48,49,50,51,52] },
    genetics: { COMT_Val158Met:'Met/Met' },
    activeDrugs: ['testosterone_enanthate'],
    gamification: { diaryFillRate:0.85, nutritionAdherence:0.92, labMatchRate:0.75, trainerFeedback:0.8, xp:450, achievements:[] }
  };

  // Безопасные импорты движков (если файл не найден — не упадёт)
  let r, k, d, t, n, f;
  try {
    // Здесь должны быть импорты, но для минимальной сборки используем заглушки
    // В полной версии раскомментируй и добавь реальные импорты:
    // import { calcReadiness } from '../engines/readiness.engine';
    // r = calcReadiness(data.readiness);
    
    // Заглушки для демо:
    r = { recovery: 65, nutrition: 72, support: 58, fatigue: 42, isConservative: false };
    k = { systemBreakdown: { cardio:{raw:35,net:22}, hepatic:{raw:28,net:18} }, overallRaw: 31.5, overallNet: 20.1 };
    d = { volumeMl: 0.6, divisions: 60, dosesPerVial: 16, flags: [] };
    t = { splitName: 'Upper/Lower 4x', splitDesc: 'Базовый сплит', volumePerGroup: {chest:16,back:16,legs:20,shoulders:12,arms:10}, rir: '2-3', isDeload: false, weekPlan: 'НЕДЕЛЯ 1: 70% MAV' };
    n = { kcal: 2100, protein: 165, fats: 75, carbs: 180, water: 3.2, fiber: 35 };
    f = { ifScore: 68, interpretation: 'Норма', forecast6w: 72, forecast12w: 75 };
  } catch (e) {
    console.warn('⚠️ Engine import failed, using fallback values:', e);
    r = { recovery: 60, nutrition: 60, support: 50, fatigue: 50, isConservative: false };
    k = { systemBreakdown: {}, overallRaw: 30, overallNet: 20 };
    d = { volumeMl: 0, divisions: 0, dosesPerVial: 0, flags: ['demo_mode'] };
    t = { splitName: 'Demo Split', splitDesc: '', volumePerGroup: {}, rir: '2-3', isDeload: false, weekPlan: '' };
    n = { kcal: 2000, protein: 150, fats: 70, carbs: 200, water: 3, fiber: 30 };
    f = { ifScore: 60, interpretation: 'Демо', forecast6w: 65, forecast12w: 70 };
  }

  const app = document.getElementById('app');
  if (!app) return;

  // Генерация UI
  app.innerHTML = `
    <div class="header"><h1>📊 Health Engine TZ</h1></div>
    
    <div class="tabs" style="display:flex;overflow-x:auto;background:#252527;border-bottom:1px solid #3a3a3c;">
      <div class="tab active" data-tab="dash" style="padding:12px 16px;cursor:pointer;border-bottom:2px solid #007aff;">📈 Готовность</div>
      <div class="tab" data-tab="train" style="padding:12px 16px;cursor:pointer;">🏋️ Тренинг</div>
      <div class="tab" data-tab="food" style="padding:12px 16px;cursor:pointer;">🥗 Питание</div>
      <div class="tab" data-tab="fert" style="padding:12px 16px;cursor:pointer;">🧬 Фертильность</div>
    </div>

    <div id="page-dash" class="page active" style="padding:12px;">
      <div class="card" style="background:#2c2c2e;margin:10px 0;padding:14px;border-radius:12px;border:1px solid #3a3a3c;">
        <h3 style="margin-bottom:10px;color:#30d158;">✅ Readiness</h3>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:#8e8e93;">Recovery</span><span style="color:${r.recovery<40?'#ff453a':'#30d158'};font-weight:500;">${r.recovery}%</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:#8e8e93;">Nutrition</span><span style="color:${r.nutrition<50?'#ff9f0a':'#30d158'};font-weight:500;">${r.nutrition}%</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#8e8e93;">Fatigue</span><span style="color:${r.fatigue>70?'#ff453a':'#30d158'};font-weight:500;">${r.fatigue}%</span></div>
        ${r.isConservative ? `<div style="color:#ff453a;margin-top:8px;font-weight:500;">⚠️ Консервативный режим</div>` : ''}
      </div>
      
      <div class="card" style="background:#2c2c2e;margin:10px 0;padding:14px;border-radius:12px;border:1px solid #3a3a3c;">
        <h3 style="margin-bottom:10px;color:#007aff;">⚖️ Risks</h3>
        ${Object.entries(k.systemBreakdown).map(([sys,v]:[string,any])=>`<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#8e8e93;">${sys.toUpperCase()}</span><span>${v.raw.toFixed(1)}% → <b style="color:#30d158">${v.net.toFixed(1)}%</b></span></div>`).join('')}
        <div style="border-top:1px solid #3a3a3c;padding-top:8px;margin-top:8px;display:flex;justify-content:space-between;"><span><b>Overall</b></span><span><b>${k.overallRaw.toFixed(1)}% → ${k.overallNet.toFixed(1)}%</b></span></div>
      </div>

      <div class="card" style="background:#2c2c2e;margin:10px 0;padding:14px;border-radius:12px;border:1px solid #3a3a3c;">
        <h3 style="margin-bottom:10px;">💉 Dosage</h3>
        <div style="display:flex;justify-content:space-between;"><span style="color:#8e8e93;">Volume</span><span style="font-weight:500;">${d.volumeMl} ml (${d.divisions} дел.)</span></div>
        ${d.flags.length ? `<div style="color:#ff9f0a;font-size:12px;margin-top:4px;">⚠️ ${d.flags.join(', ')}</div>` : ''}
      </div>
    </div>

    <div id="page-train" class="page" style="display:none;padding:12px;">
      <div class="card" style="background:#2c2c2e;margin:10px 0;padding:14px;border-radius:12px;border:1px solid #3a3a3c;">
        <h3 style="margin-bottom:10px;">🏋️ Программа</h3>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#8e8e93;">Сплит</span><span style="font-weight:500;">${t.splitName}</span></div>
        <div style="font-size:12px;color:#8e8e93;margin-bottom:8px;">${t.splitDesc}</div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#8e8e93;">RIR</span><span>${t.rir}</span></div>
      </div>
    </div>

    <div id="page-food" class="page" style="display:none;padding:12px;">
      <div class="card" style="background:#2c2c2e;margin:10px 0;padding:14px;border-radius:12px;border:1px solid #3a3a3c;">
        <h3 style="margin-bottom:10px;">🥗 Цели</h3>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#8e8e93;">Ккал</span><span style="font-weight:500;">${n.kcal}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#8e8e93;">Б/Ж/У</span><span>${n.protein}/${n.fats}/${n.carbs} г</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#8e8e93;">Вода</span><span>${n.water} л</span></div>
      </div>
    </div>

    <div id="page-fert" class="page" style="display:none;padding:12px;">
      <div class="card" style="background:#2c2c2e;margin:10px 0;padding:14px;border-radius:12px;border:1px solid #3a3a3c;">
        <h3 style="margin-bottom:10px;">🧬 Фертильность</h3>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#8e8e93;">IF Score</span><span style="font-weight:500;">${f.ifScore}% (${f.interpretation})</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#8e8e93;">Прогноз 12 нед</span><span>${f.forecast12w}%</span></div>
      </div>
    </div>

    <div class="disclaimer" style="font-size:11px;color:#8e8e93;text-align:center;margin:20px 12px 30px;">
      ⚠️ Справочная информация. Не является медицинской рекомендацией.
    </div>
  `;

  // Обработчик табов
  app.querySelectorAll('.tab').forEach((tab: Element) => {
    tab.addEventListener('click', () => {
      app.querySelectorAll('.tab').forEach((t: Element) => {
        t.classList.remove('active');
        (t as HTMLElement).style.borderBottomColor = 'transparent';
      });
      app.querySelectorAll('.page').forEach((p: Element) => (p as HTMLElement).style.display = 'none');
      
      tab.classList.add('active');
      (tab as HTMLElement).style.borderBottomColor = '#007aff';
      
      const pageId = `page-${(tab as HTMLElement).dataset.tab}`;
      const page = document.getElementById(pageId);
      if (page) (page as HTMLElement).style.display = 'block';
    });
  });

  // Telegram MainButton (безопасно)
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.MainButton) {
    try {
      (window as any).Telegram.WebApp.MainButton.setText('🔄 Пересчитать')
        .show()
        .onClick(() => renderDashboard(data));
    } catch (e) {
      console.warn('⚠️ Telegram MainButton failed:', e);
    }
  }

  console.log('✅ Dashboard rendered with', Object.keys(data).length, 'data sections');
}

import { db } from '../core/db';
import { generateMacroCycle, calcCycleAdherence, WeeklyCyclePlan } from '../engines/nutrition-cycling.engine';
import { calcNutritionTargets } from '../engines/nutrition-tracker.engine';
import type { UserProfile } from '../core/types';

export async function renderNutritionPlanner(container: HTMLElement, profile: UserProfile) {
  const base = calcNutritionTargets(profile.settings.weight, profile.settings.height, profile.settings.age, profile.settings.sex, 1.55, profile.settings.goal, profile.settings.bodyFat);
  const trainingDays = [true, false, true, false, true, true, false]; // Пн, Ср, Пт, Сб – тренировочные
  const plan = generateMacroCycle(base, trainingDays, new Date().toISOString());
  const logs: Record<string, { kcal: number }> = {};
  const allLogs = await db.getAll('nutrition_log') || [];
  allLogs.forEach((l: any) => { logs[l.date] = { kcal: l.total?.kcal || 0 }; });
  const adherence = calcCycleAdherence(logs, plan);

  container.innerHTML = `
    <div class="card"><h3>📅 Недельный цикл питания</h3>
      <div class="row"><span class="label">Средние ккал/день</span><span class="value">${plan.avgDaily.kcal}</span></div>
      <div class="row"><span class="label">Б/Ж/У (средние)</span><span class="value">${plan.avgDaily.p}/${plan.avgDaily.f}/${plan.avgDaily.c}</span></div>
      <div class="row"><span class="label">Adherence</span><span class="value" style="color:${adherence.score>80?'var(--success)':'var(--warning)'}">${adherence.score}% (${adherence.daysLogged}/7 дней)</span></div>
    </div>
    <div class="card"><h3>🏋️ Тренировки vs Отдых</h3>
      <div style="display:flex;gap:4px;">
        ${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((d,i)=>`<div style="flex:1;text-align:center;padding:6px;background:${trainingDays[i]?'rgba(0,122,255,0.2)':'#252527'};border-radius:6px;font-size:11px;">${d}</div>`).join('')}
      </div>
    </div>
    <div class="card"><h3>📊 Дневные цели</h3>
      <table style="width:100%;font-size:12px;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid #3a3a3c;"><th style="padding:4px;text-align:left;">День</th><th>Ккал</th><th>Б</th><th>Ж</th><th>У</th><th>Факт</th></tr></thead>
        <tbody>
          ${plan.days.map(d=>{
            const f = logs[d.date]?.kcal || 0;
            return `<tr style="border-bottom:1px solid #252527;">
              <td style="padding:6px;">${d.date} ${d.isTrainingDay?'🏋️':'😴'}</td>
              <td>${d.targets.kcal}</td><td>${d.targets.p}</td><td>${d.targets.f}</td><td>${d.targets.c}</td>
              <td style="color:${Math.abs(f-d.targets.kcal)<100?'var(--success)':'var(--warning)'}">${f||'—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <button class="btn" style="margin-top:12px;" id="nut-export-week">📤 Экспорт недели (CSV)</button>
  `;

  container.getElementById('nut-export-week')!.onclick = () => {
    const rows = ['Date,Type,Kcal,P,F,C,Actual'];
    plan.days.forEach(d => {
      const actual = logs[d.date]?.kcal || '';
      rows.push(`${d.date},${d.isTrainingDay?'Train':'Rest'},${d.targets.kcal},${d.targets.p},${d.targets.f},${d.targets.c},${actual}`);
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'weekly-macro-plan.csv'; a.click();
  };
}
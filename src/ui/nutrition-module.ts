import { db } from '../core/db';
import { searchFood, getFoodById, FoodItem } from '../core/nutrition-database';
import { calcNutritionTargets, calcAdherence, getWeeklyAnalytics, getPharmaInteractions, MealLog } from '../engines/nutrition-tracker.engine';
import type { UserProfile } from '../core/types';

export async function renderNutritionModule(container: HTMLElement, profile: UserProfile, activeDrugs: string[]) {
  const target = calcNutritionTargets(profile.settings.weight, profile.settings.height, profile.settings.age, profile.settings.sex, 1.55, profile.settings.goal, profile.settings.bodyFat);
  const today = new Date().toISOString().slice(0, 10);
  const logs: MealLog[] = await db.getAll('nutrition_log') || [];
  const todayLog = logs.find(l => l.date === today) || { id: crypto.randomUUID(), date: today, time: new Date().toTimeString().slice(0,5), items: [], total: { kcal:0, p:0, f:0, c:0, fiber:0, water:0, steps:0 } };
  const weekly = getWeeklyAnalytics(logs, today);
  const adh = calcAdherence(todayLog.total, target);
  const pharmTxt = getPharmaInteractions(activeDrugs);

  container.innerHTML = `
    <div class="card"><h3>🥗 Цели на сегодня</h3>
      <div class="row"><span class="label">Ккал</span><span class="value">${target.kcal}</span></div>
      <div class="row"><span class="label">Б/Ж/У</span><span class="value">${target.protein}/${target.fats}/${target.carbs}</span></div>
      <div class="row"><span class="label">Вода</span><span class="value">${target.water} л</span></div>
      <div class="row"><span class="label">Adherence</span><span class="value" style="color:${adh.score>80?'var(--success)':adh.score>50?'var(--warning)':'var(--danger)'}">${adh.score}%</span></div>
    </div>

    <div class="card"><h3>📊 Прогресс</h3>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        ${[
          { l: 'Ккал', v: todayLog.total.kcal, m: target.kcal, c: '#007aff' },
          { l: 'Белок', v: todayLog.total.p, m: target.protein, c: '#30d158' },
          { l: 'Жиры', v: todayLog.total.f, m: target.fats, c: '#ff9f0a' },
          { l: 'Углеводы', v: todayLog.total.c, m: target.carbs, c: '#5856d6' }
        ].map(m => {
          const p = Math.min(100, Math.round((m.v/m.m)*100));
          return `<div style="flex:1;min-width:70px;text-align:center;">
            <svg width="60" height="60" viewBox="0 0 36 36" style="transform:rotate(-90deg);">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#3a3a3c" stroke-width="3"/>
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="${m.c}" stroke-width="3" stroke-dasharray="${p}, 100"/>
            </svg>
            <div style="margin-top:-40px;margin-bottom:20px;font-size:11px;color:#8e8e93;">${m.l}</div>
            <div style="font-weight:600;font-size:13px;">${Math.round(m.v)}/${Math.round(m.m)}</div>
          </div>`;
        }).join('')}
      </div>
      <div style="margin-top:8px;font-size:12px;color:#8e8e93;">Неделя: ${weekly.daysLogged}д/7 | Среднее: ${weekly.avgKcal} ккал | Тренд: ${weekly.trend}</div>
    </div>

    <div class="card"><h3>💧 Вода</h3>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${[0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 2.5, 3.0].map(v => `
          <button class="btn-water" data-val="${v}" style="flex:1;min-width:40px;padding:8px;border-radius:8px;border:1px solid ${todayLog.total.water>=v?'#007aff':'#3a3a3c'};background:transparent;color:${todayLog.total.water>=v?'#007aff':'#fff'};cursor:pointer;">${v}л</button>
        `).join('')}
      </div>
    </div>

    <div class="card"><h3>📝 Приёмы пищи</h3>
      ${todayLog.items.length ? todayLog.items.map(i => `<div class="row" style="border-bottom:1px solid #3a3a3c;padding:6px 0;"><span class="label">${i.name} ×${i.qty}</span><span class="value">${Math.round(i.kcal*i.qty)} ккал | Б:${Math.round(i.p*i.qty)}</span></div>`).join('') : '<div class="label">Нет записей</div>'}
      <div style="margin-top:10px;position:relative;">
        <input id="nut-search" type="text" placeholder="🔍 Поиск продукта..." style="width:100%;padding:8px;margin-bottom:6px;">
        <div id="nut-results" style="display:none;position:absolute;top:100%;left:0;right:0;max-height:150px;overflow-y:auto;background:#252527;border-radius:8px;border:1px solid #3a3a3c;z-index:10;"></div>
        <button class="btn" id="add-custom">➕ Добавить вручную</button>
      </div>
    </div>

    <div class="card"><h3>💊 Фарма-рекомендации</h3><pre style="margin:0;font-size:12px;">${pharmTxt}</pre></div>
  `;

  // Поиск
  const searchIn = container.querySelector('#nut-search') as HTMLInputElement;
  const resBox = container.querySelector('#nut-results') as HTMLDivElement;
  searchIn.addEventListener('input', () => {
    const q = searchIn.value.trim();
    if (q.length < 2) { resBox.style.display = 'none'; return; }
    const res = searchFood(q);
    if (!res.length) { resBox.style.display = 'none'; return; }
    resBox.style.display = 'block';
    resBox.innerHTML = res.map(f => `
      <div class="row" style="padding:8px;cursor:pointer;border-bottom:1px solid #3a3a3c;" data-id="${f.id}">
        <span class="label"><b>${f.name}</b> <span style="font-size:10px;color:#8e8e93;">${f.servingSize}</span></span>
        <span class="value">${f.kcal} ккал</span>
      </div>
    `).join('');
  });

  // Выбор продукта
  resBox.addEventListener('click', async (e) => {
    const target = (e.target as HTMLElement).closest('[data-id]');
    if (!target) return;
    const foodId = (target as HTMLElement).dataset.id!;
    const food = getFoodById(foodId)!;
    const entry: MealLog = { ...todayLog, items: [...todayLog.items, { id: food.id, name: food.name, qty: 1, kcal: food.kcal, p: food.protein, f: food.fat, c: food.carbs, fiber: food.fiber }], total: { ...todayLog.total, kcal: todayLog.total.kcal + food.kcal, p: todayLog.total.p + food.protein, f: todayLog.total.f + food.fat, c: todayLog.total.c + food.carbs, fiber: todayLog.total.fiber + food.fiber } };
    await db.put('nutrition_log', entry);
    resBox.style.display = 'none';
    searchIn.value = '';
    renderNutritionModule(container, profile, activeDrugs);
  });

  // Вода
  container.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest('.btn-water');
    if (btn) {
      const val = parseFloat((btn as HTMLElement).dataset.val!);
      const entry: MealLog = { ...todayLog, total: { ...todayLog.total, water: val } };
      await db.put('nutrition_log', entry);
      renderNutritionModule(container, profile, activeDrugs);
    }
  });

  // Ручной ввод
  container.querySelector('#add-custom')!.addEventListener('click', async () => {
    const name = prompt('Название продукта:') || 'Своё блюдо';
    const kcal = parseInt(prompt('Ккал:', '0') || '0');
    const p = parseInt(prompt('Белок (г):', '0') || '0');
    const f = parseInt(prompt('Жиры (г):', '0') || '0');
    const c = parseInt(prompt('Углеводы (г):', '0') || '0');
    if (kcal <= 0) return;
    const entry: MealLog = { ...todayLog, items: [...todayLog.items, { id: 'custom', name, qty: 1, kcal, p, f, c, fiber: 0 }], total: { ...todayLog.total, kcal: todayLog.total.kcal + kcal, p: todayLog.total.p + p, f: todayLog.total.f + f, c: todayLog.total.c + c } };
    await db.put('nutrition_log', entry);
    renderNutritionModule(container, profile, activeDrugs);
  });
}
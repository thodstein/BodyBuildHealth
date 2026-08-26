/**
 * planner-day-print.ts — печать дневного отчёта питания (P2-8).
 *
 * Чистый HTML-билдер поверх DailyDietReport: сводка КБЖУ дня + флаги + предупреждения
 * + дефициты микронутриентов. XSS-экранирование всех пользовательских строк.
 */
import type { DailyDietReport } from '../../../../engines/product-usefulness-v2.engine';

const esc = (v: unknown): string => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const chip = (label: string, ok: boolean, detail = ''): string => {
  const color = ok ? '#22c55e' : '#ef4444';
  return `<div style="padding:4px 8px;border-radius:6px;border:1px solid ${color}33;background:${color}0d;color:${color};font-size:12px">${esc(label)} ${ok ? '✓' : '⚠'} <span style="color:inherit;opacity:.8">${esc(detail)}</span></div>`;
};

export function buildDayReportPrintHtml(r: DailyDietReport): string {
  const flags: string[] = [];
  const add = (label: string, ok: boolean, detail = '') => flags.push(chip(label, ok, detail));
  add('mTOR', r.mtorTriggered, r.mtorTriggered ? '' : `дефицит ${Math.round(r.mtorDeficitMg)} мг лейцина`);
  add('Гликемическая нагрузка', !r.giLoadWarning, `${Math.round(r.giLoad)}`);
  add('Аммиак (белок/FFM)', !r.ammoniaRisk, r.ammoniaScore.toFixed(1));
  add('PRAL', r.pralWarning !== 'Закисление', r.pralTotal.toFixed(0));
  if (r.pralWarning) flags.push(`<div style="font-size:12px;color:#f59e0b">${esc(r.pralWarning)}</div>`);
  add('Омега-6/3', !r.omegaWarning, `${r.omegaRatio.toFixed(1)}:1`);
  add('Калий/Магний', !r.electrolyteRisk, `${Math.round(r.potassiumMg)}/${Math.round(r.magnesiumMg)} мг`);
  add('Кортизол (быстрые угл. post-WO)', !r.cortisolRisk, r.cortisolRisk ? 'мало быстрых углеводов' : 'достаточно');
  add('Инсулин', !r.insulinRicohet, r.insulinRicohet ? 'рикшет' : '');
  add('HOMA-IR', r.homaIr === null || r.homaIr <= 2.5, r.homaIr === null ? 'нет анализов' : r.homaIr.toFixed(1));
  add('DIAAS', r.diaas >= 0.9, r.diaas.toFixed(2));
  if (r.diaasWarning) flags.push(`<div style="font-size:12px;color:#8b5cf6">${esc(r.diaasWarning)}</div>`);
  if (r.antinutrientWarning) flags.push(`<div style="font-size:12px;color:#f59e0b;font-weight:600">${esc(r.antinutrientWarning)}</div>`);
  if (r.glutathioneWarning) flags.push(`<div style="font-size:12px;color:#f59e0b;font-weight:600">${esc(r.glutathioneWarning)}</div>`);
  if (r.histamineWarning) flags.push(`<div style="font-size:12px;color:#ef4444;font-weight:600">${esc(r.histamineWarning)}</div>`);

  const mood = r.microDeficits.length > 0
    ? `<div style="font-size:12px;color:#f59e0b;font-weight:600">Микро-дефициты: ${esc(r.microDeficits.join(', '))}</div>`
    : '<div style="font-size:12px;color:#22c55e">Микро-дефицитов не выявлено</div>';

  const brief = `
    <p style="font-size:13px;color:#333"><b>Суммарный анализ дня</b> — ${r.mtorTriggered ? 'рацион близок к энергетически полному' : 'есть зоны для улучшения'} (${Math.round(r.totalKcal)} ккал, DIAAS ${r.diaas.toFixed(2)})</p>
  `;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Дневной отчёт питания</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;color:#1a1a1a}h1{font-size:18px;border-bottom:2px solid #8b5cf6;padding-bottom:8px}</style></head>
<body>
<h1>📊 Дневной отчёт питания — ${esc(r.date)}</h1>
<div style="font-size:14px;margin:12px 0">Калорийность: <b>${Math.round(r.totalKcal)}</b> ккал · Гликемическая нагрузка: <b>${Math.round(r.giLoad)}</b></div>
${brief}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px">${flags.join('')}</div>
${mood}
</body></html>`;
}

export function printDayReport(html: string): void {
  try {
    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    window.setTimeout(() => { try { w.print(); } catch {} }, 250);
  } catch {
    // печать недоступна — игнорируем
  }
}

/**
 * 📤 Экспорт «Файл тренеру»: план дня + выбранные рецепты (ингредиенты/шаги) +
 * закупки + заметки — одним самодостаточным HTML-файлом. Скачивается через Blob.
 */
export function buildCoachExportHtml(args: {
  dateIso: string;
  totals: { kcal: number; p: number; f: number; c: number };
  goals?: { kcal: number; p: number; f: number; c: number };
  isTrainingDay?: boolean;
  meals: any[];
  shopping: Array<{ name: string; amount: number; category?: string; dayCount?: number }>;
  notes?: string[];
}): string {
  const { dateIso, totals, goals, isTrainingDay, meals, shopping, notes } = args;
  const t = totals || { kcal: 0, p: 0, f: 0, c: 0 };
  const g = goals;

  // Приёмы с продуктами
  const mealRows = (Array.isArray(meals) ? meals : []).map((m: any) => {
    const items = Array.isArray(m.items) ? m.items : [];
    const recipeBadge = m.recipeApplied ? `<span style="font-size:11px;color:#c2620a">🍳 ${esc(m.recipeApplied)}</span>` : '';
    return `<tr>
      <td style="padding:6px;border:1px solid #ddd;font-size:12px;white-space:nowrap">${esc(m.time || '')}</td>
      <td style="padding:6px;border:1px solid #ddd;font-size:12px"><b>${esc(m.label || '')}</b> ${recipeBadge}
        <div style="color:#555">${items.map((it: any) => esc(`${it.name} ${it.amount}г`)).join(', ') || '—'}</div>
      </td>
      <td style="padding:6px;border:1px solid #ddd;font-size:12px;text-align:right">${Math.round(m.totals?.kcal || 0)}</td>
      <td style="padding:6px;border:1px solid #ddd;font-size:12px;text-align:right">${Math.round(m.totals?.p || 0)}</td>
      <td style="padding:6px;border:1px solid #ddd;font-size:12px;text-align:right">${Math.round(m.totals?.f || 0)}</td>
      <td style="padding:6px;border:1px solid #ddd;font-size:12px;text-align:right">${Math.round(m.totals?.c || 0)}</td>
    </tr>`;
  }).join('');

  // Рецепты: ингредиенты + шаги
  const applied = (Array.isArray(meals) ? meals : []).filter((m: any) => m?.recipeApplied && m?.recipeAppliedData);
  const recipeBlocks = applied.map((m: any) => {
    const r = m.recipeAppliedData;
    const ing = Array.isArray(r.ingredients) && r.ingredients.length > 0
      ? `<ul style="margin:4px 0 0 18px;padding:0">${r.ingredients.map((i: string) => `<li style="font-size:12px;margin-bottom:2px">${esc(i)}</li>`).join('')}</ul>`
      : '';
    const steps = Array.isArray(r.instructions) && r.instructions.length > 0
      ? `<ol style="margin:6px 0 0 18px;padding:0">${r.instructions.map((s: string) => `<li style="font-size:12px;margin-bottom:3px">${esc(s)}</li>`).join('')}</ol>`
      : '';
    return `<div style="page-break-inside:avoid;border:1px solid #f9731633;background:#fff8f2;border-radius:10px;padding:10px;margin-bottom:10px">
      <b style="font-size:13px">${esc(m.label)}: ${esc(r.name)}</b>
      <span style="float:right;font-size:11px;color:#888">⏱ ${esc(String(r.prepTimeMin ?? ''))} мин · ${Math.round(r.kcal)} ккал · Б${r.protein}/Ж${r.fat}/У${r.carbs}</span>
      <div style="font-size:11px;font-weight:700;margin-top:6px;color:#c2620a">Ингредиенты:</div>${ing}
      <div style="font-size:11px;font-weight:700;margin-top:6px;color:#c2620a">Приготовление:</div>${steps}
    </div>`;
  }).join('');

  // Закупки на план
  const shopRows = (Array.isArray(shopping) ? shopping : []).map((s: any) =>
    `<tr><td style="padding:4px 6px;border:1px solid #eee;font-size:12px">${esc(s.name)}</td><td style="padding:4px 6px;border:1px solid #eee;font-size:12px;text-align:right">${Math.round(s.amount)} г</td></tr>`
  ).join('');

  const notesHtml = (notes && notes.length > 0)
    ? `<h2 style="font-size:15px">📝 Заметки</h2>${notes.map(n => `<div style="font-size:12px;color:#444;margin-bottom:3px">• ${esc(n)}</div>`).join('')}`
    : '';

  const goalRow = g ? `<div style="font-size:13px;color:#666;margin-top:2px">Цель дня: <b>${Math.round(g.kcal)}</b> ккал · Б${Math.round(g.p)}/Ж${Math.round(g.f)}/У${Math.round(g.c)} · ${isTrainingDay ? '🏋️ тренировочный' : '😴 отдых'} день</div>` : '';

  return `<!doctype html><html><head><meta charset="utf-8"><title>План питания — ${esc(dateIso)}</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;color:#1a1a1a}h1{font-size:19px;border-bottom:2px solid #00c8a0;padding-bottom:8px}table{border-collapse:collapse;width:100%}@media print{body{margin:12mm}}</style></head>
<body>
<h1>🍽 План питания спортсмена — ${esc(dateIso)}</h1>
<div style="font-size:14px">Итог: <b>${Math.round(t.kcal || 0)}</b> ккал · Б <b>${Math.round(t.p || 0)}</b> · Ж <b>${Math.round(t.f || 0)}</b> · У <b>${Math.round(t.c || 0)}</b></div>
${goalRow}
<h2 style="font-size:15px;margin-top:16px">Приёмы пищи</h2>
<table><thead><tr><th style="padding:6px;border:1px solid #ddd;background:#f5f5f5;font-size:11px">Время</th><th style="padding:6px;border:1px solid #ddd;background:#f5f5f5;font-size:11px;text-align:left">Приём / продукты</th><th style="padding:6px;border:1px solid #ddd;background:#f5f5f5;font-size:11px">Ккал</th><th style="padding:6px;border:1px solid #ddd;background:#f5f5f5;font-size:11px">Б</th><th style="padding:6px;border:1px solid #ddd;background:#f5f5f5;font-size:11px">Ж</th><th style="padding:6px;border:1px solid #ddd;background:#f5f5f5;font-size:11px">У</th></tr></thead>
<tbody>${mealRows}</tbody></table>
${recipeBlocks ? `<h2 style="font-size:15px;margin-top:18px">🍳 Выбранные рецепты</h2>${recipeBlocks}` : ''}
${shopRows ? `<h2 style="font-size:15px;margin-top:18px">🛒 Закупки на план</h2><table><tbody>${shopRows}</tbody></table>` : ''}
${notesHtml}
<div style="margin-top:20px;font-size:11px;color:#999">Сформировано в BioStack AI · план носит рекомендательный характер</div>
</body></html>`;
}

/** Скачивание HTML-файла через Blob (jsdom-safe). */
export function downloadCoachExport(html: string, filename: string): boolean {
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch { return false; }
}

/**
 * B6: печатная версия «Меню с рецептами» для режима «по рецептам».
 * day — план дня (формат IndividualPlanContext): приёмы с recipeApplied/recipeAppliedData
 * разворачиваются в ингредиенты и пошаговые инструкции. XSS-экранирование всех строк.
 */
export function buildRecipePlanPrintHtml(day: any): string {
  const meals = Array.isArray(day?.meals) ? day.meals : [];
  const applied = meals.filter((m: any) => m?.recipeApplied && m?.recipeAppliedData);
  const t = day?.totals || { kcal: 0, p: 0, f: 0, c: 0 };
  const recipeBlocks = applied.map((m: any) => {
    const r = m.recipeAppliedData;
    const ing = Array.isArray(r.ingredients) && r.ingredients.length > 0
      ? `<ul style="margin:4px 0 0 18px;padding:0">${r.ingredients.map((i: string) => `<li style="font-size:13px;margin-bottom:2px">${esc(i)}</li>`).join('')}</ul>`
      : '';
    const steps = Array.isArray(r.instructions) && r.instructions.length > 0
      ? `<ol style="margin:6px 0 0 18px;padding:0">${r.instructions.map((s: string) => `<li style="font-size:13px;margin-bottom:3px">${esc(s)}</li>`).join('')}</ol>`
      : '';
    return `<div style="page-break-inside:avoid;border:1px solid #ddd;border-radius:10px;padding:12px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <h2 style="font-size:16px;margin:0">${esc(m.label || 'Приём')}: ${esc(r.name)}</h2>
        <span style="font-size:12px;color:#666;white-space:nowrap">⏱ ${esc(String(r.prepTimeMin ?? ''))} мин</span>
      </div>
      <div style="font-size:13px;color:#333;margin-top:4px"><b>${Math.round(r.kcal)}</b> ккал · Б <b>${r.protein}</b> · Ж <b>${r.fat}</b> · У <b>${r.carbs}</b></div>
      ${r.description ? `<div style="font-size:12px;color:#777;margin-top:3px;font-style:italic">${esc(r.description)}</div>` : ''}
      <div style="font-size:12px;font-weight:700;margin-top:8px;color:#c2620a">Ингредиенты:</div>${ing}
      <div style="font-size:12px;font-weight:700;margin-top:8px;color:#c2620a">Как готовить:</div>${steps}
    </div>`;
  }).join('');

  const otherMeals = meals.filter((m: any) => !(m?.recipeApplied && m?.recipeAppliedData))
    .map((m: any) => {
      const items = Array.isArray(m.items) ? m.items : [];
      if (items.length === 0) return '';
      return `<div style="margin-bottom:8px;page-break-inside:avoid">
        <b style="font-size:13px">${esc(m.label || 'Приём')}</b> <span style="font-size:12px;color:#888">(продукты)</span>
        <div style="font-size:12px;color:#444">${items.map((it: any) => esc(`${it.name} ${it.amount}г`)).join(' · ')}</div>
      </div>`;
    }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Меню с рецептами</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;color:#1a1a1a}h1{font-size:19px;border-bottom:2px solid #f97316;padding-bottom:8px}@media print{body{margin:12mm}}</style></head>
<body>
<h1>🍳 Меню дня по рецептам</h1>
<div style="font-size:14px;margin:10px 0">Итог дня: <b>${Math.round(t.kcal || 0)}</b> ккал · Б <b>${Math.round(t.p || 0)}</b> · Ж <b>${Math.round(t.f || 0)}</b> · У <b>${Math.round(t.c || 0)}</b></div>
${recipeBlocks || '<p style="color:#999">Выбранных рецептов нет</p>'}
${otherMeals ? `<h2 style="font-size:15px;border-top:1px solid #eee;padding-top:12px">Остальные приёмы</h2>${otherMeals}` : ''}
</body></html>`;
}

export interface WeekDayReportRow {
  date: string;
  report: DailyDietReport;
}

/** Недельная печатная сводка: строка на день + средние за неделю + общее число флагов. */
export function buildWeekReportPrintHtml(days: WeekDayReportRow[]): string {
  const rows = days.filter(d => d && d.report);
  const flagCount = (r: DailyDietReport) => {
    let n = 0;
    if (r.giLoadWarning) n++;
    if (r.ammoniaRisk) n++;
    if (r.electrolyteRisk) n++;
    if (r.insulinRicohet) n++;
    if (r.cortisolRisk) n++;
    if (r.homaIr !== null && r.homaIr > 2.5) n++;
    if (!r.mtorTriggered) n++;
    return n;
  };

  const kcalAvg = rows.length ? Math.round(rows.reduce((s, d) => s + d.report.totalKcal, 0) / rows.length) : 0;
  const diaasAvg = rows.length ? (rows.reduce((s, d) => s + d.report.diaas, 0) / rows.length).toFixed(2) : '—';
  const giAvg = rows.length ? Math.round(rows.reduce((s, d) => s + d.report.giLoad, 0) / rows.length) : 0;
  const totalFlags = rows.reduce((s, d) => s + flagCount(d.report), 0);
  const defTotal = rows.reduce((s, d) => s + d.report.microDeficits.length, 0);

  const dayRows = rows.map(d => {
    const r = d.report;
    const flags = flagCount(r);
    const color = flags === 0 ? '#22c55e' : flags <= 2 ? '#f59e0b' : '#ef4444';
    return `<tr>
      <td style="padding:6px;border:1px solid #ddd;font-size:12px">${esc(d.date)}</td>
      <td style="padding:6px;border:1px solid #ddd;font-size:12px">${Math.round(r.totalKcal)}</td>
      <td style="padding:6px;border:1px solid #ddd;font-size:12px">${r.diaas.toFixed(2)}</td>
      <td style="padding:6px;border:1px solid #ddd;font-size:12px">${Math.round(r.giLoad)}</td>
      <td style="padding:6px;border:1px solid #ddd;font-size:12px">${r.microDeficits.length}</td>
      <td style="padding:6px;border:1px solid #ddd;font-size:12px;color:${color};font-weight:700">${flags}</td>
    </tr>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Недельный отчёт питания</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;color:#1a1a1a}h1{font-size:18px;border-bottom:2px solid #8b5cf6;padding-bottom:8px}table{border-collapse:collapse;width:100%;margin-top:12px}th{font-size:11px;text-align:left}</style></head>
<body>
<h1>📅 Недельный отчёт питания</h1>
<div style="font-size:13px;margin:10px 0">Дней: <b>${rows.length}</b> · Средние: <b>${kcalAvg}</b> ккал/день, DIAAS <b>${diaasAvg}</b>, GL <b>${giAvg}</b> · Всего флагов: <b>${totalFlags}</b> · Микро-дефицитов (сумма): <b>${defTotal}</b></div>
  ${rows.length === 0 ? '<p style="font-size:12px;color:#888">Нет данных за неделю.</p>' : `<table><tr><th>Дата</th><th>Ккал</th><th>DIAAS</th><th>GL</th><th>Дефициты</th><th>Флаги</th></tr>${dayRows}</table>`}
</body></html>`;
}

/** N10: печать таймлайна дня — приёмы по часам с пери-зоной тренировки и продуктами. */
export interface MealTimelinePrintItem {
  time: string;
  label: string;
  type: string;
  items: { name: string; amount: number }[];
  totals: { kcal: number; p: number; f: number; c: number };
}
export function buildMealTimelinePrintHtml(meals: MealTimelinePrintItem[], meta: { title?: string; trainStart?: string; trainEnd?: string; kcal?: number } = {}): string {
  const toMin = (t: string) => { const [h, m] = (t || '').split(':').map(Number); return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m); };
  const sorted = [...meals].sort((a, b) => toMin(a.time) - toMin(b.time));
  const badgeFor = (type: string): string => {
    if (type === 'preworkout') return ' <span style="color:#8b5cf6;font-weight:700">ДО</span>';
    if (type === 'intra') return ' <span style="color:#22c55e;font-weight:700">ВО ВРЕМЯ</span>';
    if (type === 'postworkout') return ' <span style="color:#f59e0b;font-weight:700">ПОСЛЕ</span>';
    return '';
  };
  const rows = sorted.map(m => `<tr>
    <td style="padding:6px;border:1px solid #ddd;font-size:12px;font-weight:700;white-space:nowrap">${esc(m.time)}</td>
    <td style="padding:6px;border:1px solid #ddd;font-size:12px">${esc(m.label)}${badgeFor(m.type)}</td>
    <td style="padding:6px;border:1px solid #ddd;font-size:11px">${esc((m.items || []).map(it => `${it.name} ${Math.round(it.amount)}г`).join(', '))}</td>
    <td style="padding:6px;border:1px solid #ddd;font-size:12px;text-align:right">${Math.round(m.totals?.kcal || 0)}</td>
    <td style="padding:6px;border:1px solid #ddd;font-size:11px;text-align:center;white-space:nowrap">Б ${Math.round(m.totals?.p || 0)} · Ж ${Math.round(m.totals?.f || 0)} · У ${Math.round(m.totals?.c || 0)}</td>
  </tr>`).join('');
  const trainRow = meta.trainStart
    ? `<div style="font-size:12px;color:#8b5cf6;margin:8px 0">🏋️ Тренировка: ${esc(meta.trainStart)}${meta.trainEnd ? ' – ' + esc(meta.trainEnd) : ''}</div>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(meta.title || 'Таймлайн дня')}</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;color:#1a1a1a}h1{font-size:18px;border-bottom:2px solid #06b6d4;padding-bottom:8px}table{border-collapse:collapse;width:100%;margin-top:10px}th{font-size:11px;text-align:left}</style></head>
<body>
<h1>⏳ Таймлайн дня — ${esc(meta.title || '')}</h1>
${meta.kcal ? `<div style="font-size:13px;margin:8px 0">Калорийность дня: <b>${Math.round(meta.kcal)}</b> ккал</div>` : ''}
${trainRow}
${sorted.length === 0 ? '<p style="font-size:12px;color:#888">Нет приёмов.</p>' : `<table><tr><th>Время</th><th>Приём</th><th>Продукты</th><th>Ккал</th><th>БЖУ</th></tr>${rows}</table>`}
</body></html>`;
}
export function printMealTimeline(html: string): void {
  try {
    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    window.setTimeout(() => { try { w.print(); } catch {} }, 250);
  } catch {
    // печать недоступна — игнорируем
  }
}


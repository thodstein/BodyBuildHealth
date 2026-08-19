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

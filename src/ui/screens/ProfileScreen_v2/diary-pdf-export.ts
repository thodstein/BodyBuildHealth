/**
 * diary-pdf-export.ts — генерация HTML для PDF экспорта всех дневников
 * Вынесено в отдельный файл для избежания проблем с парсингом больших template literals в TS
 */

export interface DiaryPdfData {
  sleepEntries: any[];
  bpEntries: any[];
  weights: any[];
  injectionEntries: any[];
  healthEntries: any[];
  cardioLog: any[];
}

function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": "\'" })[c] || c);
}

function table(title: string, headers: string[], rowsArr: string[][]): string {
  if (!rowsArr.length) return '';
  return '<h2>' + esc(title) + '</h2><table><tr>' + headers.map((h) => '<th>' + esc(h) + '</th>').join('') + '</tr>' + rowsArr
    .map((r) => '<tr>' + r.map((c) => '<td>' + esc(c) + '</td>').join('') + '</tr>')
    .join('') + '</table>';
}

function sortedDesc(arr: any[]): any[] {
  return [...arr].sort((a, b) => b.date.localeCompare(a.date));
}

function trend(arr: any[]): string {
  if (arr.length < 2) return '—';
  const sorted = [...arr].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0].value;
  const last = sorted[sorted.length - 1].value;
  const diff = last - first;
  const pct = first !== 0 ? Math.round((diff / Math.abs(first)) * 100) : 0;
  return diff > 0 ? '▲ +' + pct + '%' : diff < 0 ? '▼ ' + pct + '%' : '—';
}

/** Генерация HTML для PDF экспорта всех дневников */
export function buildDiariesExportHtml(data: any): string {
  const { sleepEntries, bpEntries, weights, injectionEntries, healthEntries, cardioLog } = data;

  const totalEntries = sleepEntries.length + bpEntries.length + weights.length + injectionEntries.length + healthEntries.length + cardioLog.length;
  const allEntries = [...sleepEntries, ...bpEntries, ...weights, ...injectionEntries, ...healthEntries, ...cardioLog];
  
  const dateRange = totalEntries > 0
    ? new Date(Math.min(...allEntries.map((e: any) => new Date(e.date).getTime()))).toLocaleDateString('ru-RU') + ' — ' + new Date().toLocaleDateString('ru-RU')
    : 'нет данных';

  const sleepTrend = trend(sleepEntries.map((e: any) => ({ date: e.date, value: e.hours })));
  const weightTrend = trend(weights.map((e: any) => ({ date: e.date, value: e.weight })));
  const bpSysTrend = trend(bpEntries.map((e: any) => ({ date: e.date, value: e.systolic})));

  const qrData = 'diary-export:' + Date.now() + ':' + totalEntries + 'entries';
  const qrSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="white"/><rect x="8" y="8" width="64" height="64" fill="#0f766e"/><text x="40" y="44" text-anchor="middle" fill="white" font-size="8" font-family="monospace">QR</text><text x="40" y="56" text-anchor="middle" fill="white" font-size="6">' + qrData.slice(0, 20) + '</text></svg>';
  const qrDataUri = 'data:image/svg+xml;base64,' + btoa(qrSvg);

  const html = '<!doctype html><html><head><meta charset="utf-8"><title>Все дневники — PDF экспорт</title>'
  + '<style>'
  + 'body{font:12px \'Segoe UI\',Arial,sans-serif;padding:20px;color:#111}'
  + 'h1{color:#0f766e;border-bottom:2px solid #0f766e;padding-bottom:6px}'
  + 'h2{color:#0f766e;margin-top:18px}'
  + 'table{border-collapse:collapse;width:100%;margin:8px 0}'
  + 'td,th{border:1px solid #ccc;padding:4px;text-align:left;font-size:11px}'
  + 'th{background:#e6f4f1}'
  + '.meta{color:#666;font-size:11px}'
  + '.cover{page-break-after:always;text-align:center;padding:40px 20px}'
  + '.cover h1{font-size:28px;margin-bottom:8px}'
  + '.cover .subtitle{color:#666;font-size:14px;margin-bottom:24px}'
  + '.cover .stats{display:flex;justify-content:center;gap:24px;margin:24px 0;flex-wrap:wrap}'
  + '.cover .stat{background:#f0fdfa;border:1px solid #14b8a6;border-radius:8px;padding:12px 20px;min-width:120px}'
  + '.cover .stat .label{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5}'
  + '.cover .stat .value{font-size:20px;font-weight:700;color:#0f766e}'
  + '.trend-up{color:#22c55e}.trend-down{color:#ef4444}.trend-neutral{color:#666}'
  + '@media print{body{padding:8px}.no-print{display:none}.cover{page-break-after:always}}'
  + '</style></head><body>'
  + '<!-- COVER PAGE -->'
  + '<div class="cover">'
  + '<h1>📓 Все дневники — Экспорт</h1>'
  + '<div class="subtitle">Полный отчёт по встроенным дневникам Профиля</div>'
  + '<div class="stats">'
  + '<div class="stat"><div class="label">Всего записей</div><div class="value">' + (sleepEntries.length + bpEntries.length + weights.length + injectionEntries.length + healthEntries.length + cardioLog.length) + '</div></div>'
  + '<div class="stat"><div class="label">Период</div><div class="value">' + dateRange + '</div></div>'
  + '<div class="stat"><div class="label">Сон</div><div class="value">' + trend(sleepEntries.map(function(e: any) { return { date: e.date, value: e.hours }; })) + ' <span class="trend-up">' + trend(sleepEntries.map(function(e: any) { return { date: e.date, value: e.hours }; })) + '</span></div></div>'
  + '<div class="stat"><div class="label">Вес</div><div class="value">' + trend(weights.map(function(e: any) { return { date: e.date, value: e.weight }; })) + ' <span class="' + (trend(weights.map(function(e: any) { return { date: e.date, value: e.weight }; })).startsWith('▲') ? 'trend-up' : trend(weights.map(function(e: any) { return { date: e.date, value: e.weight }; })).startsWith('▼') ? 'trend-down' : 'trend-neutral') + '">' + trend(weights.map(function(e: any) { return { date: e.date, value: e.weight }; })) + '</span></div></div>'
  + '<div class="stat"><div class="label">АД (сист.)</div><div class="value">' + trend(bpEntries.map(function(e: any) { return { date: e.date, value: e.systolic }; })) + ' <span class="' + (trend(bpEntries.map(function(e: any) { return { date: e.date, value: e.systolic }; })).startsWith('▲') ? 'trend-up' : trend(bpEntries.map(function(e: any) { return { date: e.date, value: e.systolic }; })).startsWith('▼') ? 'trend-down' : 'trend-neutral') + '">' + trend(bpEntries.map(function(e: any) { return { date: e.date, value: e.systolic }; })) + '</span></div></div>'
  + '</div>'
  + '<div style="margin-top:32px"><img src="data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="white"/><rect x="8" y="8" width="64" height="64" fill="#0f766e"/><text x="40" y="44" text-anchor="middle" fill="white" font-size="8" font-family="monospace">QR</text><text x="40" y="56" text-anchor="middle" fill="white" font-size="6">' + ('diary-export:' + Date.now() + ':' + (sleepEntries.length + bpEntries.length + weights.length + injectionEntries.length + healthEntries.length + cardioLog.length) + 'entries').slice(0, 20) + '</text></svg>') + '" alt="QR код экспорта" width="120" height="120"/></div>'
  + '<div style="margin-top:12px;color:#999;font-size:11px">Сканируйте для быстрого доступа к данным</div>'
  + '<div class="meta" style="margin-top:24px">Сгенерировано: ' + new Date().toLocaleString('ru-RU') + ' · BodyBuildHealth</div>'
  + '</div>'

  // DATA TABLES
  + '<h1>📓 Все дневники — Детали</h1>'
  + '<p class="meta">Экспорт: ' + new Date().toLocaleDateString('ru-RU') + ' · Записей: ' + (sleepEntries.length + bpEntries.length + weights.length + injectionEntries.length + healthEntries.length + cardioLog.length) + '</p>'
  + table('💤 Сон', ['Дата', 'Часы', 'Качество', 'Пробуждений', 'Легли', 'Подъём', 'Заметки'],
    sortedDesc(sleepEntries).map(function(e: any) { return [e.date, String(e.hours), String(e.quality), String(e.awakenings), e.bedtime, e.wakeTime, e.notes || '']; }))
  + table('❤️ Давление (с ЧСС)', ['Дата', 'Систола', 'Диастола', 'Пульс', 'Время', 'Лекарство', 'Заметки'],
    sortedDesc(bpEntries).map(function(e: any) { return [e.date, String(e.systolic), String(e.diastolic), String(e.hr ?? e.pulse ?? ''), e.timeOfDay || '', e.medicationTaken ? 'да' : '', e.notes || '']; }))
  + table('⚖️ Вес', ['Дата', 'Вес', 'Жир %', 'Мышцы', 'Талия', 'Заметки'],
    sortedDesc(weights).map(function(e: any) { return [e.date, String(e.weight), e.bodyFat !== undefined ? String(e.bodyFat) : '', e.muscleMass !== undefined ? String(e.muscleMass) : '', e.waistCm !== undefined ? String(e.waistCm) : '', e.notes || '']; }))
  + table('💉 Инъекции', ['Дата', 'Препарат', 'Доза', 'Зона', 'Сторона', 'Боль', 'PIP', 'Заметки'],
    sortedDesc(injectionEntries).map(function(e: any) { return [e.date, e.substance, e.dose, e.zone || '', e.side || '', String(e.painLevel ?? ''), String(e.pipLevel ?? ''), e.notes || '']; }))
  + table('🩺 Здоровье', ['Дата', 'Боль', 'Симптомы', 'Нейро', 'Акне', 'Гемат', 'Заметки'],
    sortedDesc(healthEntries).map(function(e: any) { return [
      e.date,
      e.pain && e.pain.totalScore > 0 ? String(e.pain.totalScore) + '/70' : '',
      Array.isArray(e.symptoms) ? String(e.symptoms.length) : '0',
      e.neuro && e.neuro.totalScore > 0 ? String(e.neuro.totalScore) + '/10' : '',
      e.acne && e.acne.totalScore > 0 ? String(e.acne.totalScore) + '/12' : '',
      e.hemato && e.hemato.totalScore > 0 ? String(e.hemato.totalScore) + '/8' : '',
      e.notes || '',
    ]; }))
  + table('❤️ Кардио', ['Дата', 'Тип', 'Минуты', 'ЧСС', 'RPE', 'Статус', 'Заметки'],
    sortedDesc(cardioLog).map(function(e: any) { return [
      e.date,
      String(e.type).toUpperCase(),
      String(e.durationMin),
      e.avgHr != null ? String(e.avgHr) : '',
      e.rpe != null ? String(e.rpe) : '',
      e.completed ? 'выполнена' : 'пропущена',
      e.notes || '',
    ]; }))
  + '</body></html>';

  return html;
}
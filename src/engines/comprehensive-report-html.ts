import type { ComprehensiveReport, ReportMetric, SupportScheduleSection } from './comprehensive-report.engine';

export function generateComprehensiveReportHTML(report: ComprehensiveReport): string {
  const { meta, sections, support, userNotes, recommendations, photos } = report;

  const statusBadge = (status?: string) => {
    if (!status || status === 'info') return '<span style="color:#94a3b8;font-size:10px;">—</span>';
    const map: Record<string, string> = { normal: 'НОРМА', warning: 'ВНИМАНИЕ', critical: 'КРИТИЧНО', info: 'ИНФО' };
    const colorMap: Record<string, string> = { normal: '#22c55e', warning: '#f59e0b', critical: '#ef4444', info: '#94a3b8' };
    return `<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:${colorMap[status]}22;color:${colorMap[status]};border:1px solid ${colorMap[status]}44;">${map[status]}</span>`;
  };

  const formatVal = (v: number | string | null | undefined): string => {
    if (v === undefined || v === null) return '—';
    if (typeof v === 'number') return v % 1 === 0 ? String(v) : v.toFixed(1);
    return String(v);
  };

  const deltaStr = (m: ReportMetric) => {
    if (m.delta === undefined || m.delta === null) return '';
    const sign = m.delta > 0 ? '+' : '';
    const pct = m.deltaPct !== undefined && m.deltaPct !== null ? ` (${m.deltaPct > 0 ? '+' : ''}${m.deltaPct.toFixed(1)}%)` : '';
    return `${sign}${formatVal(m.delta)}${m.unit ? ` ${m.unit}` : ''}${pct}`;
  };

  const sectionsHTML = sections.map(section => {
    const metricsHTML = section.metrics.map(m => `
      <tr>
        <td style="padding:4px 8px;border:1px solid #333;font-size:10pt;">${m.label}</td>
        <td style="padding:4px 8px;border:1px solid #333;font-size:10pt;text-align:center;">${formatVal(m.prev)}</td>
        <td style="padding:4px 8px;border:1px solid #333;font-size:10pt;text-align:center;font-weight:600;">${formatVal(m.current)}</td>
        <td style="padding:4px 8px;border:1px solid #333;font-size:10pt;text-align:center;">${deltaStr(m)}</td>
        <td style="padding:4px 8px;border:1px solid #333;text-align:center;">${statusBadge(m.status)}</td>
      </tr>
    `).join('');

    return `
      <div style="margin-bottom:16pt;page-break-inside:avoid;">
        <h2 style="font-size:13pt;border-left:3px solid #00e68a;padding-left:8px;margin:12pt 0 6pt;">${section.icon} ${section.title}</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="border:1px solid #333;padding:4px 8px;font-size:9pt;text-align:left;">Метрика</th>
              <th style="border:1px solid #333;padding:4px 8px;font-size:9pt;text-align:center;">Начало периода</th>
              <th style="border:1px solid #333;padding:4px 8px;font-size:9pt;text-align:center;">Текущее</th>
              <th style="border:1px solid #333;padding:4px 8px;font-size:9pt;text-align:center;">Δ</th>
              <th style="border:1px solid #333;padding:4px 8px;font-size:9pt;text-align:center;">Статус</th>
            </tr>
          </thead>
          <tbody>${metricsHTML}</tbody>
        </table>
      </div>
    `;
  }).join('');

  const courseTable = support.course.substances.map(s => `
    <tr>
      <td style="padding:4px 8px;border:1px solid #333;font-size:10pt;">${s.name}</td>
      <td style="padding:4px 8px;border:1px solid #333;font-size:10pt;text-align:center;">${s.className || '—'}</td>
      <td style="padding:4px 8px;border:1px solid #333;font-size:10pt;text-align:center;">${s.doseDisplay}</td>
      <td style="padding:4px 8px;border:1px solid #333;font-size:10pt;text-align:center;">${s.route === 'inject' ? 'Инъекция' : 'Орально'}</td>
      <td style="padding:4px 8px;border:1px solid #333;font-size:10pt;text-align:center;">${s.frequency}</td>
      <td style="padding:4px 8px;border:1px solid #333;font-size:10pt;text-align:center;">${s.startWeek}-${s.endWeek}</td>
    </tr>
  `).join('');

  const scheduleHTML = (title: string, items: any[]) => {
    if (items.length === 0) return '';
    const rows = items.map(item => `
      <tr>
        <td style="padding:4px 8px;border:1px solid #333;font-size:10pt;">${item.name}</td>
        <td style="padding:4px 8px;border:1px solid #333;font-size:10pt;text-align:center;">${item.dose}</td>
        <td style="padding:4px 8px;border:1px solid #333;font-size:10pt;">${item.timing}</td>
        <td style="padding:4px 8px;border:1px solid #333;font-size:10pt;">${item.mechanism || ''}</td>
      </tr>
    `).join('');
    return `
      <div style="margin-bottom:8pt;">
        <h3 style="font-size:11pt;color:#666;margin:6pt 0 4pt;">${title}</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#fafafa;"><th style="border:1px solid #ddd;padding:3px 6px;font-size:9pt;">Препарат</th><th style="border:1px solid #ddd;padding:3px 6px;font-size:9pt;">Доза</th><th style="border:1px solid #ddd;padding:3px 6px;font-size:9pt;">Время</th><th style="border:1px solid #ddd;padding:3px 6px;font-size:9pt;">Механизм</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  };

  const monitoringHTML = support.monitoring.map(m => `
    <tr>
      <td style="padding:4px 8px;border:1px solid #333;font-size:10pt;">${m.marker}</td>
      <td style="padding:4px 8px;border:1px solid #333;font-size:10pt;">${m.when}</td>
      <td style="padding:4px 8px;border:1px solid #333;font-size:10pt;">${m.targetRange || '—'}</td>
    </tr>
  `).join('');

  const recommendationsHTML = recommendations.map(r => {
    const color = r.priority === 'critical' ? '#ef4444' : r.priority === 'warning' ? '#f59e0b' : '#3b82f6';
    return `<div style="margin:4pt 0;padding:4pt 8pt;border-left:3px solid ${color};background:${color}11;font-size:10pt;">[${r.priority.toUpperCase()}] <b>${r.section}:</b> ${r.text}</div>`;
  }).join('');

  const photosHTML = photos && photos.length > 0 ? `
    <div style="margin-bottom:16pt;page-break-inside:avoid;">
      <h2 style="font-size:13pt;border-left:3px solid #ec4899;padding-left:8px;margin:12pt 0 6pt;">📸 Фото прогресса</h2>
      <div style="display:flex;flex-wrap:wrap;gap:8pt;">
        ${photos.map(p => `
          <div style="width:45%;">
            <img src="${p.dataUrl}" style="width:100%;border-radius:6px;border:1px solid #ccc;" />
            <div style="font-size:9pt;color:#666;margin-top:2px;">${p.date} ${p.label || ''}</div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Health Report — ${meta.userName}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: 1.4; color: #111; max-width: 850px; margin: 0 auto; padding: 20px; }
    h1 { font-size: 18pt; border-bottom: 2px solid #007aff; padding-bottom: 8px; margin-bottom: 12px; }
    h2 { font-size: 13pt; margin-top: 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th, td { border: 1px solid #333; padding: 4px 8px; font-size: 10pt; }
    th { background: #f0f0f0; font-weight: 600; }
    .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #ccc; font-size: 9pt; color: #666; text-align: center; }
    .notes-box { border: 1px dashed #999; padding: 10px; min-height: 60px; margin-top: 8px; font-size: 10pt; }
    .no-print { display: none; }
    @media print { body { margin: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <h1>📊 Комплексный отчёт | ${meta.type === 'weekly' ? 'Неделя' : 'Месяц'} | ${meta.dateFrom} — ${meta.dateTo}</h1>
  <div style="margin-bottom:12px;font-size:10pt;color:#666;">
    <b>Пациент:</b> ${meta.userName} | <b>Возраст:</b> ${meta.age || '—'} | <b>Пол:</b> ${meta.sex === 'male' ? '♂' : meta.sex === 'female' ? '♀' : '—'} |
    <b>Период:</b> ${meta.period === 'mass' ? 'Набор' : meta.period === 'cut' ? 'Сушка' : 'Поддержание'} |
    ${meta.courseWeek ? `<b>Курс:</b> Неделя ${meta.courseWeek}${meta.coursePhase ? ` (${meta.coursePhase})` : ''}` : ''}
  </div>

  ${sectionsHTML}

  <div style="margin-bottom:16pt;page-break-inside:avoid;">
    <h2 style="font-size:13pt;border-left:3px solid #f59e0b;padding-left:8px;margin:12pt 0 6pt;">💉 Курс ААС</h2>
    ${support.course.isActive ? `
      <div style="font-size:10pt;margin-bottom:6pt;"><b>Старт:</b> ${support.course.startDate} | <b>Неделя:</b> ${support.course.weekCurrent} из ${support.course.weekTotal} | <b>Фаза:</b> ${support.course.phase}</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#f0f0f0;"><th style="border:1px solid #333;padding:4px 8px;">Вещество</th><th style="border:1px solid #333;padding:4px 8px;">Класс</th><th style="border:1px solid #333;padding:4px 8px;">Доза</th><th style="border:1px solid #333;padding:4px 8px;">Путь</th><th style="border:1px solid #333;padding:4px 8px;">Кратность</th><th style="border:1px solid #333;padding:4px 8px;">Недели</th></tr></thead>
        <tbody>${courseTable}</tbody>
      </table>
    ` : '<div style="font-size:10pt;color:#666;">Курс не активен</div>'}
  </div>

  <div style="margin-bottom:16pt;page-break-inside:avoid;">
    <h2 style="font-size:13pt;border-left:3px solid #00e68a;padding-left:8px;margin:12pt 0 6pt;">💊 Поддержка (расписание)</h2>
    ${scheduleHTML('🌅 УТРО', support.schedule.morning)}
    ${scheduleHTML('☀️ ОБЕД', support.schedule.afternoon)}
    ${scheduleHTML('🌙 ВЕЧЕР', support.schedule.evening)}

    <div style="margin-top:8pt;font-size:10pt;">
      <b>Лекарства:</b> ${support.medications.map(m => `${m.name} ${m.doseMg}${m.unit} ${m.frequency}`).join('; ') || 'Нет'}
    </div>
    <div style="font-size:10pt;margin-top:4pt;">
      <b>БАДы:</b> ${support.supplements.map(s => `${s.name} ${s.doseMg}${s.unit}`).join('; ') || 'Нет'}
    </div>

    <div style="margin-top:8pt;font-size:10pt;">
      <b>Нагрузка:</b> ${support.pillBurden.totalSubstances} веществ, ~${support.pillBurden.pillsPerDay} таб/день (${support.pillBurden.morning}+${support.pillBurden.afternoon}+${support.pillBurden.evening}) | ${support.pillBurden.feasibility}
    </div>

    <div style="margin-top:8pt;font-size:10pt;">
      <b>Дефициты:</b> ${support.depletionWarnings.map(d => `${d.depleter} → ${d.depleted}`).join('; ') || 'Нет'}
    </div>
  </div>

  <div style="margin-bottom:16pt;page-break-inside:avoid;">
    <h2 style="font-size:13pt;border-left:3px solid #3b82f6;padding-left:8px;margin:12pt 0 6pt;">🔬 Мониторинг анализов</h2>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#f0f0f0;"><th style="border:1px solid #333;padding:4px 8px;">Маркер</th><th style="border:1px solid #333;padding:4px 8px;">Когда</th><th style="border:1px solid #333;padding:4px 8px;">Цель</th></tr></thead>
      <tbody>${monitoringHTML}</tbody>
    </table>
  </div>

  ${photosHTML}

  <div style="margin-bottom:16pt;page-break-inside:avoid;">
    <h2 style="font-size:13pt;border-left:3px solid #8b5cf6;padding-left:8px;margin:12pt 0 6pt;">📝 Дополнительные сведения</h2>
    <div class="notes-box" contenteditable="true">${userNotes || 'Запишите всё, что считаете важным для врача: стресс, изменения сна, диеты, побочные эффекты, вопросы...'}</div>
  </div>

  <div style="margin-bottom:16pt;page-break-inside:avoid;">
    <h2 style="font-size:13pt;border-left:3px solid #ef4444;padding-left:8px;margin:12pt 0 6pt;">📋 Рекомендации для врача</h2>
    ${recommendationsHTML || '<div style="font-size:10pt;color:#666;">Нет рекомендаций</div>'}
  </div>

  <div class="footer">
    Сформировано автоматически | ${new Date().toLocaleString('ru-RU')} | Health Engine TZ v2 | Для передачи курирующему врачу
  </div>

  <div class="no-print" style="margin-top:12pt;padding:8pt;background:#f5f5f5;border-radius:8px;font-size:9pt;color:#666;">
    <b>Печать:</b> Ctrl+P (или ⌘+P) → Сохранить как PDF. Поля с рамкой можно редактировать перед печатью.
  </div>
</body>
</html>`;
}

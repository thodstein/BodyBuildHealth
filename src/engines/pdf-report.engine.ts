import type { LabPoint, RiskResult, PCTSchedule, UserContext } from '../core/types';

export function generateMedicalReportHTML(
  ctx: UserContext,
  labs: LabPoint[],
  risks: RiskResult,
  pctPlan: PCTSchedule | null,
  notes: string
): string {
  const date = new Date().toISOString().slice(0, 10);
  const latestLabs = labs.slice(-15).reverse();

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:0 auto;padding:24px;color:#111;">
      <div style="border-bottom:2px solid #007aff;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:end;">
        <div>
          <h1 style="margin:0;font-size:22px;">📊 HEALTH ENGINE | МЕДИЦИНСКИЙ ОТЧЁТ</h1>
          <p style="margin:4px 0 0;color:#666;font-size:13px;">Дата формирования: ${date} | Роль: ${ctx.role} | Фаза: ${ctx.phase || '—'}</p>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px;color:#666;">ID Пользователя</div>
          <div style="font-weight:600;">${ctx.role === 'user' ? 'self' : 'patient_001'}</div>
        </div>
      </div>

      <h2 style="font-size:16px;border-left:3px solid #30d158;padding-left:8px;">⚖️ Профиль рисков</h2>
      <table style="width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:13px;">
        <thead><tr style="background:#f5f5f7;"><th style="padding:6px;text-align:left;border:1px solid #ddd;">Система</th><th style="padding:6px;text-align:center;border:1px solid #ddd;">Raw</th><th style="padding:6px;text-align:center;border:1px solid #ddd;">Net (после поддержки)</th></tr></thead>
        <tbody>
          ${Object.entries(risks.systemBreakdown || {}).map(([k,v]: [string, { raw: number; net: number }])=>`
            <tr><td style="padding:6px;border:1px solid #ddd;text-transform:uppercase;">${k}</td><td style="padding:6px;text-align:center;border:1px solid #ddd;">${v.raw.toFixed(1)}%</td><td style="padding:6px;text-align:center;border:1px solid #ddd;color:${v.net<30?'#10b981':v.net<60?'#f59e0b':'#ef4444'};font-weight:600;">${v.net.toFixed(1)}%</td></tr>
          `).join('')}
          <tr style="background:#f5f5f7;font-weight:600;"><td style="padding:6px;border:1px solid #ddd;">OVERALL</td><td style="padding:6px;text-align:center;border:1px solid #ddd;">${(risks.overallRaw ?? 0).toFixed(1)}%</td><td style="padding:6px;text-align:center;border:1px solid #ddd;">${(risks.overallNet ?? 0).toFixed(1)}%</td></tr>
        </tbody>
      </table>

      <h2 style="font-size:16px;border-left:3px solid #007aff;padding-left:8px;">🧪 Последние анализы</h2>
      <table style="width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:13px;">
        <thead><tr style="background:#f5f5f7;"><th style="padding:6px;text-align:left;border:1px solid #ddd;">Маркер</th><th style="padding:6px;text-align:center;border:1px solid #ddd;">Значение</th><th style="padding:6px;text-align:left;border:1px solid #ddd;">Дата</th></tr></thead>
        <tbody>
          ${latestLabs.map(l=>`<tr><td style="padding:6px;border:1px solid #ddd;text-transform:uppercase;">${l.code}</td><td style="padding:6px;text-align:center;border:1px solid #ddd;">${l.value} ${l.unit}</td><td style="padding:6px;text-align:left;border:1px solid #ddd;">${l.date}</td></tr>`).join('')}
        </tbody>
      </table>

      ${pctPlan ? `
        <h2 style="font-size:16px;border-left:3px solid #ff9f0a;padding-left:8px;">📅 ПКТ & Сход курса</h2>
        <p style="margin:4px 0 8px;font-size:13px;"><b>Старт ПКТ:</b> Неделя ${pctPlan.pctStartWeek} | <b>Дата:</b> ${pctPlan.startDate}</p>
        <ul style="margin:0 0 16px 16px;font-size:13px;">
          ${pctPlan.pctProtocol.map((p: { drug: string; dose: string; durationWeeks: number })=>`<li>${p.drug}: ${p.dose} (${p.durationWeeks} нед)</li>`).join('')}
        </ul>
      ` : ''}

      <h2 style="font-size:16px;border-left:3px solid #8e8e93;padding-left:8px;">📝 Заметки врача / Тренера</h2>
      <div style="border:1px dashed #ccc;padding:12px;min-height:60px;font-size:13px;margin:8px 0 24px;">
        ${notes || 'Поле пустое. Введите рекомендации при печати.'}
      </div>

      <div style="display:flex;justify-content:space-between;margin-top:40px;font-size:13px;">
        <div><div style="border-top:1px solid #000;width:180px;padding-top:4px;">Подпись специалиста</div></div>
        <div><div style="border-top:1px solid #000;width:180px;padding-top:4px;">Подпись пациента</div></div>
      </div>

      <style>
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          h2 { page-break-before: always; }
          h2:first-child { page-break-before: auto; }
        }
      </style>
    </div>
  `;
}

export function triggerPrintReport(html: string, filename: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>${filename}</title></head><body>${html}</body></html>`);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 250);
  }
}
// ════════════════════════════════════════════════════════════════════════════
//  PROTOCOL PDF EXPORT — Врачебная выписка назначений поддержки
//  Использование: import { printProtocol } from './ProtocolExport';
//  ════════════════════════════════════════════════════════════════════════════

import React from 'react';
import ReactDOM from 'react-dom';

export interface ExportSubstance {
  id: string;
  mnn: string;
  dose: string;
  frequency: string;
  duration: string;
  mechanism: string;
  category: string;
  warnings: string[];
  monitoring: { marker: string; when: string; target: string }[];
}

export interface ExportLabSchedule {
  marker: string;
  frequency: string;
  target: string;
  criticalThreshold?: string;
}

export interface ProtocolExportData {
  /** Patient info */
  patient: { name: string; age: number; weight: number; height: number; sex: string };
  /** Course info */
  course: { drugs: string[]; peds: string[]; weeks: number; phase: string };
  /** Protocol info */
  protocol: {
    name: string;
    version: string;
    evidenceBase: string;
    substances: ExportSubstance[];
    timingSchedule: { time: string; substances: string[] }[];
    stopCriteria: string[];
    clinicalNotes: string[];
  };
  /** Lab monitoring schedule */
  labSchedule: ExportLabSchedule[];
  /** Generated metadata */
  generatedAt: string;
  generatedBy: string;
}

function buildPrintDocument(data: ProtocolExportData): string {
  const { patient, course, protocol, labSchedule } = data;

  const rows = protocol.substances.map(s => `
    <tr>
      <td>${s.mnn}</td>
      <td>${s.dose}</td>
      <td>${s.frequency}</td>
      <td>${s.duration}</td>
      <td style="font-size:7pt">${s.mechanism}</td>
      <td>${s.warnings.join('; ')}</td>
    </tr>
  `).join('');

  const labRows = labSchedule.map(l => `
    <tr>
      <td>${l.marker}</td>
      <td>${l.frequency}</td>
      <td>${l.target}</td>
      <td>${l.criticalThreshold || '—'}</td>
    </tr>
  `).join('');

  const stopRows = protocol.stopCriteria.map((s, i) =>
    `<li>${s}</li>`).join('');

  const timingRows = protocol.timingSchedule.map(t => `
    <tr>
      <td>${t.time}</td>
      <td>${t.substances.join(', ')}</td>
    </tr>
  `).join('');

  const notes = protocol.clinicalNotes.map(n =>
    `<li>${n}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><title>Назначения поддержки — ${patient.name}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;color:#1a1a2e;padding:0;background:#fff}
  .page{width:190mm;margin:0 auto;padding:20px}
  .header{border-bottom:3px solid #1a1a2e;padding-bottom:12px;margin-bottom:16px}
  .header h1{font-size:14pt;margin-bottom:4px;color:#1a1a2e}
  .header .sub{font-size:8pt;color:#555}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
  .info-box{padding:8px 10px;border:1px solid #ddd;border-radius:6px;background:#fafafa}
  .info-box h3{font-size:9pt;font-weight:700;margin-bottom:4px;color:#333}
  .info-box p{font-size:8pt;line-height:1.4;color:#555}
  h2{font-size:11pt;font-weight:700;margin:16px 0 8px;color:#1a1a2e;border-bottom:1.5px solid #e0e0e0;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;font-size:8pt;margin-bottom:12px}
  th{background:#1a1a2e;color:#fff;padding:6px 8px;text-align:left;font-weight:600}
  td{padding:5px 8px;border-bottom:1px solid #eee}
  tr:nth-child(even){background:#fafafa}
  .warnings{color:#c0392b;font-size:7pt}
  .monitor td{color:#2c3e50}
  ul{padding-left:18px;font-size:8pt;line-height:1.5;margin-bottom:12px}
  .footer{margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:7pt;color:#888}
  .section-note{font-size:7pt;color:#888;margin:-6px 0 8px}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head>
<body>
<div class="page">
  <div class="header">
    <h1>💰 НАЗНАЧЕНИЯ ПОДДЕРЖКИ НА КУРСЕ ААС</h1>
    <div class="sub">Версия протокола: ${protocol.version} | Evidence: ${protocol.evidenceBase} | Сформировано: ${data.generatedAt}</div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>📋 ПАЦИЕНТ</h3>
      <p>${patient.name}, ${patient.age} л, ${patient.weight} кг, ${patient.height} см, ${patient.sex}</p>
    </div>
    <div class="info-box">
      <h3>💉 КУРС</h3>
      <p>${course.drugs.join(', ')} | ${course.weeks} нед | Фаза: ${course.phase}</p>
      ${course.peds.length ? `<p style="margin-top:2px">PED: ${course.peds.join(', ')}</p>` : ''}
    </div>
  </div>

  <h2>📦 ПРЕПАРАТЫ ПОДДЕРЖКИ (${protocol.substances.length})</h2>
  <div class="section-note">Дозировки титруются по лабораторным показателям. Не превышать указанные дозы без контроля врача.</div>
  <table>
    <thead><tr><th>МНН</th><th>Доза</th><th>Частота</th><th>Длительность</th><th>Механизм</th><th>Предупреждения</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  ${protocol.timingSchedule.length ? `
  <h2>⏰ ГРАФИК ПРИЁМА</h2>
  <table>
    <thead><tr><th>Время</th><th>Препараты</th></tr></thead>
    <tbody>${timingRows}</tbody>
  </table>
  ` : ''}

  <h2>🔬 ЛАБОРАТОРНЫЙ МОНИТОРИНГ</h2>
  <div class="section-note">График сдачи анализов на протяжении курса. При критических значениях — остановка курса и консультация врача.</div>
  <table>
    <thead><tr><th>Маркер</th><th>Частота</th><th>Целевой диапазон</th><th>Критический порог</th></tr></thead>
    <tbody class="monitor">${labRows}</tbody>
  </table>

  <h2>⛔ СТОП-КРИТЕРИИ (немедленная отмена/коррекция)</h2>
  <ul>${stopRows}</ul>

  ${protocol.clinicalNotes.length ? `
  <h2>📋 КЛИНИЧЕСКИЕ ЗАМЕТКИ</h2>
  <ul>${notes}</ul>
  ` : ''}

  <div class="footer">
    <div style="display:flex;justify-content:space-between">
      <span>Сформировано: ${data.generatedAt} | ${data.generatedBy}</span>
      <span>${protocol.version}</span>
    </div>
    <div style="margin-top:4px">💰 Данный документ не является медицинским рецептом. Требуется консультация врача перед началом приёма препаратов.</div>
  </div>
</div>
</body></html>`;
}

export function printProtocol(data: ProtocolExportData): void {
  const html = buildPrintDocument(data);
  const w = window.open('', '_blank', 'width=900,height=800');
  if (!w) { alert('Разрешите всплывающие окна для печати'); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

export function buildExportDataFromRec(
  rec: any,
  patient: { name: string; age: number; weight: number; height: number; sex: string },
  course: { drugs: string[]; peds: string[]; weeks: number; phase: string }
): ProtocolExportData {
  const substances: ExportSubstance[] = (rec.subs || []).map((s: any) => ({
    id: s.substanceId,
    mnn: s.reason?.split(' — ')[0] || s.substanceId,
    dose: s.reason?.match(/([\d.]+[\s]*(?:мг|г|МЕ|мкг|табл|капс)[^\s]*)/)?.[0] || '',
    frequency: s.reason?.match(/([\d]+[x×р]\/[дн])/)?.[0] || '',
    duration: rec.phase === 'pct' ? '8-12 нед' : `${course.weeks} нед`,
    mechanism: s.reason?.split(' — ')[1] || '',
    category: s.category || 'other',
    warnings: [],
    monitoring: [],
  }));

  const labSchedule: ExportLabSchedule[] = [
    { marker: 'АЛТ', frequency: 'Каждые 4 нед', target: '<40 Ед/л', criticalThreshold: '>200 (стоп курс)' },
    { marker: 'АСТ', frequency: 'Каждые 4 нед', target: '<40 Ед/л', criticalThreshold: '>200 (стоп курс)' },
    { marker: 'ГГТ', frequency: 'Каждые 4 нед', target: '<55 Ед/л' },
    { marker: 'Билирубин', frequency: 'Каждые 4 нед', target: '<21 мкмоль/л' },
    { marker: 'ЛПНП', frequency: 'Каждые 6 нед', target: '<3.0 ммоль/л' },
    { marker: 'ЛПВП', frequency: 'Каждые 6 нед', target: '>1.0 ммоль/л' },
    { marker: 'ТГ', frequency: 'Каждые 6 нед', target: '<1.7 ммоль/л' },
    { marker: 'Гематокрит', frequency: 'Каждые 4 нед', target: '<50%', criticalThreshold: '>54% (флеботомия)' },
    { marker: 'Эстрадиол (E2)', frequency: 'Каждые 4 нед', target: '20-40 пг/мл', criticalThreshold: '<15 или >80' },
    { marker: 'Пролактин', frequency: 'Каждые 6 нед', target: '<15 нг/мл' },
    { marker: 'Креатинин', frequency: 'Каждые 4 нед', target: '<106 мкмоль/л' },
    { marker: 'eGFR', frequency: 'Каждые 4 нед', target: '>90 мл/мин' },
    { marker: 'Глюкоза', frequency: 'Каждые 6 нед', target: '3.9-5.5 ммоль/л' },
    { marker: 'ПСА', frequency: 'Каждые 12 нед (40+ лет)', target: '<4.0 нг/мл' },
  ];

  const stopCriteria = [
    'АЛТ/АСТ >200 Ед/л — немедленная отмена ААС, повторить анализ через 7 дней',
    'Гематокрит >54% — флеботомия 300-450 мл, контроль HCT через 3 дня',
    'АД >160/100 мм рт.ст. — коррекция дозы телмисартана/небиволола',
    'E2 <15 пг/мл — снизить/отменить анастрозол, контроль через 1 нед',
    'D-димер >500 нг/мл — консультация гематолога, исключить тромбоз',
    'Пролактин >50 нг/мл — увеличить каберголин, МРТ гипофиза',
    'Креатинин >200 мкмоль/л или eGFR <30 — стоп ААС, нефролог',
  ];

  const timingSchedule = [
    { time: 'Утро (07:00-09:00)', substances: substances.filter(s =>
      ['vitamin', 'cardioprotector', 'hepatoprotector', 'antioxidant', 'amino', 'pharma']
        .some(c => s.category === c)).slice(0, 8).map(s => s.mnn)
    },
    { time: 'День (12:00-14:00)', substances: substances.filter(s =>
      ['mineral', 'herb', 'adaptogen'].some(c => s.category === c)).slice(0, 5).map(s => s.mnn)
    },
    { time: 'Вечер (18:00-20:00)', substances: substances.filter(s =>
      ['amino', 'mineral', 'sleep', 'neuroprotector'].some(c => s.category === c)).slice(0, 5).map(s => s.mnn)
    },
    { time: 'На ночь (22:00-23:00)', substances: substances.filter(s =>
      ['sleep', 'adaptogen', 'vitamin'].some(c => s.category === c)).slice(0, 3).map(s => s.mnn)
    },
  ].filter(t => t.substances.length > 0);

  const clinicalNotes = [
    'Все дозировки указаны для стартового протокола. Корректировать по лабораторным показателям каждые 4 нед.',
    'Препараты с пометкой 💊 — рецептурные. Требуют назначения врача.',
    rec.monitoringPlan ? `График мониторинга: ${rec.monitoringPlan.split('\n')[0]}` : '',
    rec.protocolWarnings?.length ? `Предупреждения: ${rec.protocolWarnings.join('; ')}` : '',
  ].filter(Boolean);

  return {
    patient,
    course,
    protocol: {
      name: 'Протокол поддержки на курсе ААС',
      version: '2024.07.19 | ESC2023/KDIGO2024/AASLD2023',
      evidenceBase: 'ESC2023 Hypertension/CVD; KDIGO2024 CKD; AASLD2023 NAFLD; Endocrine Society 2023 Testosterone Therapy',
      substances,
      timingSchedule,
      stopCriteria,
      clinicalNotes,
    },
    labSchedule,
    generatedAt: new Date().toLocaleString('ru-RU'),
    generatedBy: 'BodyBuildHealth Clinical Engine v2.0',
  };
}

export function ExportButton({ data }: { data: ProtocolExportData }): React.ReactElement {
  return React.createElement('button', {
    onClick: () => printProtocol(data),
    style: {
      padding: '8px 16px',
      borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.1)',
      background: 'rgba(96,165,250,0.12)',
      color: '#60a5fa',
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
  }, '🖨 Печать / PDF', React.createElement('span', {
    style: { fontSize: 9, fontWeight: 400, color: 'rgba(255,255,255,0.4)' },
  }, 'для врача'));
}

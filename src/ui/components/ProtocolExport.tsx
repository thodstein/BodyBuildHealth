// ════════════════════════════════════════════════════════════════════════════
//  PROTOCOL PDF EXPORT — Врачебная выписка назначений поддержки
//  Использование: import { printProtocol } from './ProtocolExport';
//  ════════════════════════════════════════════════════════════════════════════

import React from 'react';
import ReactDOM from 'react-dom';
import { SUPPORT_CATALOG_DATA } from '../../data/support-catalog-data';
import {
  HCT_THRESHOLDS, FEMALE_ALT_2_5_ULN, FEMALE_LABS_NOTE, LFT_STAGE_ULN, FEMALE_HORMONE_BANDS,
} from '../../engines/lab-norms.engine';
import { phaseCardsFor, addonsFor, isInjectableCourse } from '../../engines/support-phase-labs.engine';

/**
 * Назначение из карточки плана. Доза уже посчитана движком (`resolvePlanDose`),
 * поэтому PDF не пытается угадать её из текста обоснования.
 */
export interface ExportPlanDose {
  id: string;
  name?: string;
  doseDisplay?: string;
  timing?: string;
}

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
    <thead><tr><th>МНН</th><th>Доза</th><th>Приём</th><th>Длительность</th><th>Механизм</th><th>Предупреждения</th></tr></thead>
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
  course: { drugs: string[]; peds: string[]; weeks: number; phase: string },
  planDoses?: ExportPlanDose[]
): ProtocolExportData {
  const isFemale = patient.sex === 'female';

  // МНН и доза — из плана. Раньше и то и другое выдёргивалось регэкспом из
  // `reason` (текста-обоснования): в колонку «МНН» попадало обоснование, а в
  // «Дозу» — первое число с единицей из прозы (или пусто).
  const byId = new Map((planDoses || []).map(s => [s.id, s]));
  const substances: ExportSubstance[] = (rec.subs || []).map((s: any) => {
    const plan = byId.get(s.substanceId);
    const catalog = SUPPORT_CATALOG_DATA[s.substanceId];
    return {
      id: s.substanceId,
      mnn: plan?.name || catalog?.nameRu || s.substanceId,
      dose: plan?.doseDisplay || '—',
      frequency: plan?.timing || '—',
      duration: rec.phase === 'pct' ? '8-12 нед' : `${course.weeks} нед`,
      mechanism: s.reason || '',
      category: s.category || 'other',
      warnings: [],
      monitoring: [],
    };
  });

  // Стоп-пороги: HCT — из единой шкалы (`HCT_THRESHOLDS`: ♂ 54, ♀ 52),
  // АЛТ — ступени действий `LFT_STAGE_ULN` (сигнал 2.5×♀ / 2×♂, отмена оралов
  // 3×ВГН, отмена всего 5×ВГН). Раньше женщина получала «отмену ААС» на 2.5×ВГН,
  // а мужчина — на 5×ВГН: один и тот же раздел печати жил по двум шкалам.
  const hctStop = isFemale ? HCT_THRESHOLDS.female.block : HCT_THRESHOLDS.male.block;
  const altSignal = isFemale ? FEMALE_ALT_2_5_ULN : LFT_STAGE_ULN.reduce.male;
  const altStopOral = isFemale ? LFT_STAGE_ULN.stopOral.female : LFT_STAGE_ULN.stopOral.male;
  const altStopAll = isFemale ? LFT_STAGE_ULN.stopAll.female : LFT_STAGE_ULN.stopAll.male;

  // Печать — для конкретного пациента: в женском протоколе из двуполых целей
  // («HCT ♂ <51% / ♀ <48%», «АЛТ ♂ <40 / ♀ <31») оставляем её половину, иначе
  // врач вычитает из строки мужской порог. Общие списки (карточки в UI, таблица
  // «Анализы») продолжают показывать оба пола — это справочник, а не назначение.
  const patientSexText = (s?: string): string | undefined =>
    isFemale && s ? s.replace(/♂[^,;]*?\/\s*♀\s*/g, '') : s;

  // Единый перечень анализов — карточки фаз K0–K10 (как в UI и в текстовых
  // экспортах). График фазы (`monitoringSchedule`) больше не печатается: он
  // перечислял те же маркеры второй раз, с бедными целями.
  const cards = phaseCardsFor(
    (rec as any).pedFlags || null,
    ((rec as any).phase || 'course') as any,
    {
      injectable: isInjectableCourse(
        (course.peds || []).map(id => ({ id })),
        (rec as any).pedFlags || null,
      ),
    },
  );
  const cardRows: ExportLabSchedule[] = cards.flatMap(c => c.groups.flatMap(g =>
    g.items.map(m => ({
      marker: `${c.id} · ${m.marker}`,
      frequency: `${c.title} — ${c.when}`,
      target: patientSexText(m.target) || '—',
      criticalThreshold: patientSexText(m.red) || undefined,
    })),
  ));
  // ♀ E2 нельзя мерить мужской целью 20–40 пг/мл: без фазовой модели цикла
  // подставляем «по фазе» из `FEMALE_HORMONE_BANDS` (раньше здесь жила четвёртая
  // копия — «20–200 без ИА / >400», не совпадавшая с женским протоколом).
  const sexAdjustedRows: ExportLabSchedule[] = isFemale
    ? cardRows.map(r => (/E2|Эстрадиол/i.test(r.marker)
      ? {
        ...r,
        target: `по фазе цикла: ${FEMALE_HORMONE_BANDS.E2.normal} пг/мл`,
        criticalThreshold: `${FEMALE_HORMONE_BANDS.E2.red} пг/мл`,
      }
      : r))
    : cardRows;
  const addonRows: ExportLabSchedule[] = addonsFor([
    ...(course.peds || []),
    ...(rec.subs || []).map((s: any) => s?.substanceId),
  ]).map(a => ({
    marker: `💊 ${a.label}: ${a.items.map(i => i.marker).join('; ')}`,
    frequency: `аддон к ${a.attachTo.join(', ')}`,
    target: patientSexText(a.items.map(i => i.target).filter(Boolean).join('; ')) || '—',
    criticalThreshold: patientSexText(a.items.map(i => i.red).filter(Boolean).join('; ')) || undefined,
  }));
  const labSchedule: ExportLabSchedule[] = [...sexAdjustedRows, ...addonRows];

  const stopCriteria = [
    `АЛТ/АСТ >${altSignal} Ед/л (${isFemale ? '2.5' : '2'}×ВГН) — сигнал гепатотоксичности: повтор через 2 нед; >${altStopOral} (3×ВГН) — отмена оралов; >${altStopAll} (5×ВГН) — немедленная отмена ААС + гепатолог`,
    `Гематокрит >${hctStop}% — флеботомия 300-450 мл, контроль HCT через 3 дня`,
    'АД >160/100 мм рт.ст. — коррекция дозы телмисартана/небиволола',
    isFemale
      ? 'E2 <20 пг/мл на ИА — снизить/отменить анастрозол, контроль через 1 нед'
      : 'E2 <15 пг/мл — снизить/отменить анастрозол, контроль через 1 нед',
    'D-димер >500 нг/мл — консультация гематолога, исключить тромбоз',
    isFemale
      ? `Пролактин ${FEMALE_HORMONE_BANDS.PRL.green} мМЕ/л — каберголин только под контролем врача; ${FEMALE_HORMONE_BANDS.PRL.red} — МРТ гипофиза`
      : 'Пролактин >50 нг/мл — увеличить каберголин, МРТ гипофиза',
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
    isFemale ? FEMALE_LABS_NOTE : '',
    // ♀ пометки карточек фаз — те же, что в UI (иначе женские пороги теряются в печати).
    isFemale
      ? Array.from(new Set(cards.map(c => c.femaleNote).filter(Boolean) as string[])).join(' ')
      : '',
    rec.monitoringPlan ? `График мониторинга: ${rec.monitoringPlan.split('\n')[0]}` : '',
    rec.protocolWarnings?.length ? `Предупреждения: ${rec.protocolWarnings.join('; ')}` : '',
    ['course', 'bridge', 'trt'].includes(rec.phase) ? 'Дельта-правила (нужен baseline K0): HCT Δ+5 п.п. → флеботомия; АЛТ >2× своего baseline; HDL −40%; E2 −30% от steady-state → AI избыточен.' : '',
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

/**
 * strength-export.engine.ts — экспорт отчёта «Анализ силы» тренеру.
 * Чистые функции: текст для буфера и HTML для печати (XSS-safe).
 */

export interface StrengthSnapshotForExport {
  sex: 'male' | 'female';
  bw: number;
  squat: number;
  bench: number;
  dead: number;
  ohp: number;
  total: number;
  dots: number;
  wilks: number;
  ipfgl: number;
  relative: number;
  levelLabel: string;
  lifts?: { squat: { rs: number; label: string }; bench: { rs: number; label: string }; deadlift: { rs: number; label: string } };
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Защита от формульных инъекций Excel (прецедент дневников): = + - @ → префикс '. */
export function csvCell(v: string | number): string {
  const s = String(v);
  const guarded = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export interface OnermHistoryEntry { date: string; lift: string; e1RM: number; weight: number; reps: number }

/** CSV динамики e1RM (история he_onerm_history_v1): BOM + заголовок + guard. */
export function buildStrengthHistoryCsv(hist: OnermHistoryEntry[]): string {
  const lines = ['date,lift,e1RM_kg,weight_kg,reps'];
  for (const h of hist) {
    lines.push([csvCell(h.date), csvCell(h.lift), csvCell(h.e1RM), csvCell(h.weight), csvCell(h.reps)].join(','));
  }
  return `﻿${lines.join('\n')}`;
}

/** JSON тренеру: снапшот + очки + метод (XSS не применим — JSON, строки как есть). */
export function buildStrengthCoachJson(s: StrengthSnapshotForExport, extra?: { method?: string; sinclair?: number }): string {
  return JSON.stringify({
    kind: 'strength_analysis',
    generatedAt: new Date().toISOString(),
    athlete: { sex: s.sex, bw: s.bw },
    lifts: { squat: s.squat, bench: s.bench, dead: s.dead, ohp: s.ohp, total: s.total },
    scores: { dots: s.dots, wilks: s.wilks, ipfgl: s.ipfgl, relative: s.relative, level: s.levelLabel },
    perLift: s.lifts ?? null,
    method: extra?.method ?? 'consensus-median-7',
    sinclair: extra?.sinclair ?? null,
  }, null, 2);
}

/** ICS контрольной прикидки: ближайшая суббота от даты (детерминировано, подпись в названии). */
export function nextSaturday(from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const add = (6 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + add);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function icsEsc(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function buildStrengthTestDayIcs(s: StrengthSnapshotForExport, from: Date = new Date()): string {
  const day = nextSaturday(from);
  const summary = icsEsc(`Прикидка ПМ (тотал ${s.total} кг, DOTS ${s.dots})`);
  const desc = icsEsc(`Контрольный тест: присед ${s.squat} / жим ${s.bench} / тяга ${s.dead} кг. Тотал ${s.total} при ${s.bw} кг.`);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BodyBuildHealth//Strength//RU', 'BEGIN:VEVENT', `UID:str-test-${day}@bbhealth`, `DTSTAMP:${day}T000000`, `DTSTART;VALUE=DATE:${day}`, `SUMMARY:${summary}`, `DESCRIPTION:${desc}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

export function buildStrengthReportText(s: StrengthSnapshotForExport): string {
  const lines: string[] = [];
  lines.push(`Анализ силы — сводка`);
  lines.push(`Пол: ${s.sex === 'female' ? 'Женщина' : 'Мужчина'} · Вес: ${s.bw} кг`);
  lines.push(`Присед ${s.squat} · Жим ${s.bench} · Тяга ${s.dead} · Жим стоя ${s.ohp} · Тотал ${s.total} кг`);
  lines.push(`Отн. сила ${s.relative}×BW · Уровень ${s.levelLabel}`);
  lines.push(`DOTS ${s.dots} · Wilks ${s.wilks} · IPF GL ${s.ipfgl}`);
  if (s.lifts) {
    lines.push(`Присед ${s.lifts.squat.rs}× (${s.lifts.squat.label}) · Жим ${s.lifts.bench.rs}× (${s.lifts.bench.label}) · Тяга ${s.lifts.deadlift.rs}× (${s.lifts.deadlift.label})`);
  }
  lines.push(`Сгенерировано: ${new Date().toLocaleString('ru-RU')}`);
  return lines.join('\n');
}

export function buildStrengthPrintHtml(s: StrengthSnapshotForExport): string {
  const liftsRow = s.lifts
    ? `<tr><td>Присед</td><td>${esc(String(s.squat))} кг</td><td>${esc(String(s.lifts.squat.rs))}×</td><td>${esc(s.lifts.squat.label)}</td></tr>
       <tr><td>Жим</td><td>${esc(String(s.bench))} кг</td><td>${esc(String(s.lifts.bench.rs))}×</td><td>${esc(s.lifts.bench.label)}</td></tr>
       <tr><td>Тяга</td><td>${esc(String(s.dead))} кг</td><td>${esc(String(s.lifts.deadlift.rs))}×</td><td>${esc(s.lifts.deadlift.label)}</td></tr>`
    : '';

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Анализ силы — сводка</title>
<style>
body{font-family:Inter,Arial,sans-serif;padding:18px;color:#111;max-width:760px;margin:0 auto}
h1{font-size:18px;margin:0 0 8px}
.card{border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin:10px 0}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;background:#f3f4f6;border:1px solid #e5e7eb;font-size:11px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left}
th{background:#f9fafb}
.small{font-size:11px;color:#6b7280}
</style></head><body>
<h1>🏋️ Анализ силы — сводка</h1>
<div class="small">Сгенерировано: ${esc(new Date().toLocaleString('ru-RU'))} · Вес ${esc(String(s.bw))} кг · ${esc(s.sex === 'female' ? 'Женщина' : 'Мужчина')}</div>
<div class="card">
  <div><b>Тотал:</b> ${esc(String(s.total))} кг — Присед ${esc(String(s.squat))} · Жим ${esc(String(s.bench))} · Тяга ${esc(String(s.dead))} · Жим стоя ${esc(String(s.ohp))}</div>
  <div><b>Отн. сила:</b> ${esc(String(s.relative))}×BW · <b>${esc(s.levelLabel)}</b></div>
  <div><b>DOTS:</b> ${esc(String(s.dots))} · <b>Wilks:</b> ${esc(String(s.wilks))} · <b>IPF GL:</b> ${esc(String(s.ipfgl))}</div>
  ${s.lifts ? `<div style="margin-top:6px"><span class="badge">IPF GL — официален с 2020</span> <span class="badge">DOTS — USAPL/USPA</span> <span class="badge">Wilks — устарел</span></div>` : ''}
</div>
${s.lifts ? `<div class="card"><h3 style="margin:0 0 6px;font-size:13px">Относительная сила по движениям</h3><table><thead><tr><th>Движение</th><th>кг</th><th>×BW</th><th>Уровень</th></tr></thead><tbody>${liftsRow}</tbody></table></div>` : ''}
<div class="card small">
  Источники: DOTS/Wilks/IPF GL — канонические формулы (relative-strength.engine); процентили — Rippetoe/Kilgore + StrengthLevel.com (sex: DOTS-ratio по весу); MEV/MAV/MRV — Israetel.
  Сводка для тренера — скопируйте текст или распечатайте эту страницу (Ctrl+P).
</div>
<script>window.onload=()=>window.print()</script>
</body></html>`;
}

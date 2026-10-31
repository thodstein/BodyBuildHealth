/**
 * movement-diagnostics-export.engine.ts — выдача диагностики движений (P8 АПК).
 *
 * Чистые функции рендера, без доступа к сторам/мостам:
 * - buildMovementDiagnosticsHtml — HTML-отчёт (печать/PDF через printHtmlApk);
 * - buildMovementDiagnosticsCsv — CSV-таблица (сохранение через saveCsvApk);
 * - movementDiagnosticsFilename — имя файла.
 * Все пользовательские строки XSS-экранируются.
 */
import type { Lift, WeakPoint } from '../lms/weakpoint-pl';
import type { BarPathIssue } from './lift-diagnostics.engine';
import { barLoopFlag } from './bar-path-core.engine';
import { barSpeedHeat, BAR_HEAT_COLORS } from '../strength-sport/strength-sport-video.engine';

export interface MovementDiagnosticsExportInput {
  lift: Lift;
  liftRu: string;
  phase: WeakPoint | '' | string;
  phaseRu: string;
  issues: BarPathIssue[];
  issuesRu: string[];
  vbtBest: number | null;
  vbtLast: number | null;
  vbtWeightKg: number | null;
  vbtLossPct: number | null;
  vbtZone: string;
  videoNote: string;
  kinoveaXLoop: number | null;
  kinoveaXBias?: number | null;
  kinoveaTurnoverMs?: number | null;
  /** Сколько повторов нарезано из Kinovea-серии (overlay первый vs последний). */
  kinoveaReps?: number | null;
  /** Overlay: изменение vmax первого→последнего повтора, % (отрицательное = потеря). */
  overlayVelocityLossPct?: number | null;
  /** Оценка качества съёмки (высота камеры / дистанция / ракурс): ok|rough|unknown + причина. */
  captureQuality?: string;
  asymmetryPct?: number | null;
  asymmetryVerdict?: string;
  vbtMetric?: string;
  vbtThreshold?: number | null;
  vbtPauseMs?: number | null;
  lvpR2?: number | null;
  createdAt?: string;
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(n: number | null, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return String(Math.round(n * 10 ** digits) / 10 ** digits);
}

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  // защита от формульной инъекции Excel: префикс ' для = + - @
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Человекочитаемые подписи VBT-метрики: в отчёте не должно быть id вида «mcv». */
const VBT_METRIC_RU: Record<string, string> = {
  mcv: 'средняя концентрическая (MCV)',
  mpv: 'средняя по подъёму (MPV)',
  peak: 'пиковая (Peak)',
};
export function vbtMetricRu(metric?: string | null): string {
  if (!metric) return '—';
  return VBT_METRIC_RU[metric] ?? metric;
}

export function movementDiagnosticsFilename(lift: Lift, ext: 'html' | 'csv' | 'svg' | 'png' | 'webm'): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `movement-${lift}-${stamp}.${ext}`;
}

export function buildMovementDiagnosticsCsv(inp: MovementDiagnosticsExportInput): string {
  const rows: string[][] = [
    ['Поле', 'Значение'],
    ['Движение', inp.liftRu],
    ['Фаза срыва', inp.phaseRu || '—'],
    ['Отклонения', inp.issuesRu.length ? inp.issuesRu.join('; ') : '—'],
    ['VBT лучший, м/с', inp.vbtBest != null ? String(inp.vbtBest) : '—'],
    ['VBT последний, м/с', inp.vbtLast != null ? String(inp.vbtLast) : '—'],
    ['VBT вес, кг', inp.vbtWeightKg != null ? String(inp.vbtWeightKg) : '—'],
    ['Потеря скорости, %', inp.vbtLossPct != null ? String(inp.vbtLossPct) : '—'],
    ['VBT зона', inp.vbtZone || '—'],
    ['Kinovea xLoop, см', inp.kinoveaXLoop != null ? String(inp.kinoveaXLoop) : '—'],
    ['Kinovea смещение, см', inp.kinoveaXBias != null ? String(inp.kinoveaXBias) : '—'],
    ['Kinovea turnover, мс', inp.kinoveaTurnoverMs != null ? String(inp.kinoveaTurnoverMs) : '—'],
    ['Kinovea повторов, шт', inp.kinoveaReps != null ? String(inp.kinoveaReps) : '—'],
    ['Overlay потеря vmax, %', inp.overlayVelocityLossPct != null ? String(inp.overlayVelocityLossPct) : '—'],
    ['Качество съёмки', inp.captureQuality || '—'],
    ['Асимметрия, %', inp.asymmetryPct != null ? String(inp.asymmetryPct) : '—'],
    ['Вердикт асимметрии', inp.asymmetryVerdict || '—'],
    ['VBT метрика', vbtMetricRu(inp.vbtMetric)],
    ['VBT VL-порог, %', inp.vbtThreshold != null ? String(inp.vbtThreshold) : '—'],
    ['VBT пауза, мс', inp.vbtPauseMs != null ? String(inp.vbtPauseMs) : '—'],
    ['LVP r²', inp.lvpR2 != null ? String(inp.lvpR2) : '—'],
    ['Видео', inp.videoNote || '—'],
    ['Дата', inp.createdAt || new Date().toISOString().slice(0, 10)],
  ];
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export function buildMovementDiagnosticsHtml(inp: MovementDiagnosticsExportInput): string {  const li = (k: string, v: string) =>
    `<tr><td style="padding:6px 8px;border:1px solid #ddd;color:#555;">${esc(k)}</td><td style="padding:6px 8px;border:1px solid #ddd;">${esc(v)}</td></tr>`;
  const vbtLine =
    inp.vbtBest != null && inp.vbtLast != null
      ? `${fmt(inp.vbtBest)} → ${fmt(inp.vbtLast)} м/с · потеря ${fmt(inp.vbtLossPct, 1)}% · ${inp.vbtZone || '—'}`
      : 'не измерена';
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Диагностика движений — ${esc(inp.liftRu)}</title></head><body style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:16px;color:#111;">`
    + `<h1 style="font-size:18px;">Диагностика движений — ${esc(inp.liftRu)}</h1>`
    + `<p style="font-size:12px;color:#555;">Фаза: ${esc(inp.phaseRu || '—')} · Дата: ${esc(inp.createdAt || new Date().toISOString().slice(0, 10))}</p>`
    + `<table style="border-collapse:collapse;width:100%;font-size:13px;">`
    + li('Отклонения траектории', inp.issuesRu.length ? inp.issuesRu.join('; ') : '—')
    + li('VBT', vbtLine)
    + (inp.vbtWeightKg != null ? li('VBT вес', `${fmt(inp.vbtWeightKg, 1)} кг`) : '')
    + (inp.kinoveaXLoop != null
      ? li('Kinovea xLoop', `${fmt(inp.kinoveaXLoop, 1)} см ${barLoopFlag(inp.kinoveaXLoop) === 'crit' ? '(крит. >6)' : barLoopFlag(inp.kinoveaXLoop) === 'warn' ? '(внимание ≥4)' : '(норма)'}`)
      : '')
    + (inp.kinoveaXBias != null ? li('Kinovea смещение', `${fmt(inp.kinoveaXBias, 1)} см`) : '')
    + (inp.kinoveaTurnoverMs != null ? li('Kinovea turnover', `${inp.kinoveaTurnoverMs} мс`) : '')
    + (inp.kinoveaReps != null ? li('Kinovea повторов', `${inp.kinoveaReps} шт`) : '')
    + (inp.overlayVelocityLossPct != null ? li('Overlay: потеря vmax', `${fmt(inp.overlayVelocityLossPct, 0)}% от первого повтора к последнему`) : '')
    + (inp.captureQuality ? li('Качество съёмки', inp.captureQuality) : '')
    + (inp.asymmetryPct != null ? li('Асимметрия', `${fmt(inp.asymmetryPct, 1)}% ${inp.asymmetryVerdict || ''}`) : '')
    + (inp.vbtMetric ? li('VBT метрика', vbtMetricRu(inp.vbtMetric)) : '')
    + (inp.vbtThreshold != null ? li('VBT VL-порог', `${inp.vbtThreshold}%`) : '')
    + (inp.vbtPauseMs != null ? li('VBT пауза', `${inp.vbtPauseMs} мс`) : '')
    + (inp.lvpR2 != null ? li('LVP r²', fmt(inp.lvpR2, 3)) : '')
    + li('Видео', inp.videoNote || '—')
    + `</table><p style="font-size:11px;color:#666;">Скорость из видео — оценка (не LPT). Снимайте строго сбоку 90°, штатив, 2–3 м.</p></body></html>`;
}

export interface TrajectoryExportInput {
  liftRu: string;
  /** Полная траектория серии: x — горизонталь (см), y — высота (см); t — время (с) для heatmap. */
  series?: ReadonlyArray<{ x: number; y: number; t?: number }> | null;
  /** Overlay: первый и последний повтор. */
  firstRep?: ReadonlyArray<{ x: number; y: number; t?: number }> | null;
  lastRep?: ReadonlyArray<{ x: number; y: number; t?: number }> | null;
  /** Прошлая сессия (первый повтор) — серая справка «было / стало». */
  prevRep?: ReadonlyArray<{ x: number; y: number }> | null;
  xLoopCm?: number | null;
  vmax?: number | null;
  /** Готовая строка overlay («Повторы: 3 · vmax 0.52→0.44 …»). */
  overlayText?: string;
  /** Готовая строка сравнения сессий («vmax ниже прошлой сессии: …»). */
  sessionText?: string;
  captureQuality?: string;
  /** Раскраска по скорости (heatmapping). По умолчанию включена, если в точках есть t. */
  heat?: boolean;
  createdAt?: string;
}

/** Точки с валидным временем → отрезки heatmap. Без времени возвращает пусто. */
function heatSegments(pts: ReadonlyArray<{ x: number; y: number; t?: number }>): ReturnType<typeof barSpeedHeat> {
  if (!pts.length || pts.some((p) => !Number.isFinite(p.t))) return [];
  return barSpeedHeat(pts.map((p) => ({ x: p.x, y: p.y, t: p.t as number })));
}

/**
 * Самостоятельный SVG-файл с траекторией штанги (overlay первого/последнего
 * повтора, heatmap по скорости, справка прошлой сессии). Это «экспорт ключевого
 * кадра» в векторном виде: видео не перекодируется, артефакт открывается в
 * любом просмотрщике и печатается.
 */
export function buildTrajectorySvg(inp: TrajectoryExportInput): string {
  const W = 480;
  const H = 320;
  const PAD_X = 44;
  const PAD_TOP = 40;
  const PAD_BOTTOM = 62;
  const overlay = !!(inp.firstRep?.length && inp.lastRep?.length);
  const all = [...(inp.series ?? []), ...(inp.firstRep ?? []), ...(inp.lastRep ?? []), ...(inp.prevRep ?? [])];
  const minX = all.length ? Math.min(...all.map((p) => p.x)) : 0;
  const maxX = all.length ? Math.max(...all.map((p) => p.x)) : 1;
  const minY = all.length ? Math.min(...all.map((p) => p.y)) : 0;
  const maxY = all.length ? Math.max(...all.map((p) => p.y)) : 1;
  const sx = (x: number) => PAD_X + ((x - minX) / Math.max(0.001, maxX - minX)) * (W - 2 * PAD_X);
  const sy = (y: number) => H - PAD_BOTTOM - ((y - minY) / Math.max(0.001, maxY - minY)) * (H - PAD_TOP - PAD_BOTTOM);
  const path = (pts: ReadonlyArray<{ x: number; y: number }>) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');

  const parts: string[] = [];
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#0b0f14"/>`);
  parts.push(`<text x="${PAD_X}" y="24" fill="#e5e7eb" font-family="sans-serif" font-size="14" font-weight="700">Траектория штанги — ${esc(inp.liftRu)}</text>`);
  // target-zone: центральная треть по горизонтали
  const zx = PAD_X + (W - 2 * PAD_X) / 3;
  const zw = (W - 2 * PAD_X) / 3;
  parts.push(`<rect x="${zx.toFixed(1)}" y="${PAD_TOP}" width="${zw.toFixed(1)}" height="${H - PAD_TOP - PAD_BOTTOM}" fill="rgba(0,230,138,0.07)" stroke="#00e68a" stroke-dasharray="6 4" stroke-width="1"/>`);
  parts.push(`<text x="${(zx + zw / 2).toFixed(1)}" y="${PAD_TOP - 6}" fill="#00e68a" font-family="sans-serif" font-size="9" text-anchor="middle">target-zone</text>`);

  let legendY = PAD_TOP + 12;
  const legend = (color: string, text: string) => {
    parts.push(`<text x="${W - PAD_X}" y="${legendY}" fill="${color}" font-family="sans-serif" font-size="9" text-anchor="end">${esc(text)}</text>`);
    legendY += 12;
  };

  if (inp.prevRep?.length) {
    parts.push(`<path d="${path(inp.prevRep)}" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="2 3"/>`);
    legend('#94a3b8', '· · прошлая сессия');
  }

  const heatOn = inp.heat !== false;
  const seriesHeat = !overlay && inp.series?.length && heatOn ? heatSegments(inp.series) : [];
  if (seriesHeat.length) {
    // Heatmapping: цвет отрезка = скорость; линия целиком больше не одним цветом.
    for (const seg of seriesHeat) {
      parts.push(`<line x1="${sx(seg.x1).toFixed(1)}" y1="${sy(seg.y1).toFixed(1)}" x2="${sx(seg.x2).toFixed(1)}" y2="${sy(seg.y2).toFixed(1)}" stroke="${BAR_HEAT_COLORS[seg.level]}" stroke-width="2.4" stroke-linecap="round"/>`);
    }
    legend(BAR_HEAT_COLORS.fast, '— быстро');
    legend(BAR_HEAT_COLORS.mid, '— средне');
    legend(BAR_HEAT_COLORS.slow, '— медленно (срыв)');
  } else if (!overlay && inp.series?.length) {
    parts.push(`<path d="${path(inp.series)}" fill="none" stroke="#38bdf8" stroke-width="2"/>`);
  }
  if (overlay) {
    parts.push(`<path d="${path(inp.firstRep!)}" fill="none" stroke="#38bdf8" stroke-width="2"/>`);
    parts.push(`<path d="${path(inp.lastRep!)}" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6 4"/>`);
    legend('#38bdf8', '— первый повтор');
    legend('#f59e0b', '- - последний повтор');
  }
  if (!all.length) {
    parts.push(`<text x="${W / 2}" y="${H / 2}" fill="#9ca3af" font-family="sans-serif" font-size="11" text-anchor="middle">нет данных траектории</text>`);
  }
  // подписи осей в сантиметрах
  parts.push(`<text x="${PAD_X - 6}" y="${PAD_TOP + 4}" fill="#9ca3af" font-family="sans-serif" font-size="9" text-anchor="end">${fmt(maxY, 1)} см</text>`);
  parts.push(`<text x="${PAD_X - 6}" y="${H - PAD_BOTTOM}" fill="#9ca3af" font-family="sans-serif" font-size="9" text-anchor="end">${fmt(minY, 1)} см</text>`);
  const footer: string[] = [];
  if (inp.xLoopCm != null) footer.push(`xLoop ${fmt(inp.xLoopCm, 1)} см`);
  if (inp.vmax != null) footer.push(`vmax ${fmt(inp.vmax, 2)} м/с`);
  if (inp.captureQuality) footer.push(`качество: ${inp.captureQuality}`);
  parts.push(`<text x="${PAD_X}" y="${H - PAD_BOTTOM + 20}" fill="#d1d5db" font-family="sans-serif" font-size="10">${esc(footer.join(' · ') || '—')}</text>`);
  let textY = H - PAD_BOTTOM + 36;
  if (inp.overlayText) {
    parts.push(`<text x="${PAD_X}" y="${textY}" fill="#e5e7eb" font-family="sans-serif" font-size="10">${esc(inp.overlayText)}</text>`);
    textY += 14;
  }
  if (inp.sessionText) {
    parts.push(`<text x="${PAD_X}" y="${textY}" fill="#cbd5e1" font-family="sans-serif" font-size="10">${esc(inp.sessionText)}</text>`);
  }
  parts.push(`<text x="${PAD_X}" y="${H - 12}" fill="#6b7280" font-family="sans-serif" font-size="9">${esc(inp.createdAt || new Date().toISOString().slice(0, 10))} · скорость из видео — оценка (не LPT)</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<title>${esc(`Траектория штанги — ${inp.liftRu}`)}</title>`
    + parts.join('')
    + `</svg>`;
}

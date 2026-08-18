/**
 * pl-export.ts — экспорт плана ПЛ: Excel (.xlsx), PDF (печать), ссылка для Telegram.
 * Чистые функции (тестируемы) + тонкие браузерные обёртки (download/print/open).
 */
import * as XLSX from 'xlsx';
import type { LMSPlanWeek } from '../../../engines/lms/lms-builder.engine';

// ── Блоки недель (для выбора «отдельный блок») ──
export type PLBlockId = 'cycle' | 'taper' | 'mock' | 'meet' | 'post';

export function plBlockOf(w: LMSPlanWeek): PLBlockId {
  if (w.meetWeek) return 'meet';
  if (w.mockMeet) return 'mock';
  if (w.postMeet) return 'post';
  if (w.taperWeek || (w.macroPhase === 'competition' && w.sourcePhase === 'peak')) return 'taper';
  return 'cycle';
}

export const PL_BLOCK_LABEL: Record<PLBlockId, string> = {
  cycle: 'Основной цикл', taper: 'Тапер', mock: 'Mock meet', meet: 'Соревнования', post: 'Пост-старт',
};
export const PL_BLOCK_ICON: Record<PLBlockId, string> = {
  cycle: '📋', taper: '📉', mock: '🎯', meet: '🏁', post: '🔄',
};

export interface PLBlockGroup { id: PLBlockId; label: string; icon: string; weeks: LMSPlanWeek[]; range: string; }

export function plBlockGroups(weeks: LMSPlanWeek[]): PLBlockGroup[] {
  const order: PLBlockId[] = ['cycle', 'taper', 'mock', 'meet', 'post'];
  return order
    .map(id => {
      const ws = weeks.filter(w => plBlockOf(w) === id);
      if (ws.length === 0) return null;
      return { id, label: PL_BLOCK_LABEL[id], icon: PL_BLOCK_ICON[id], weeks: ws, range: `${ws[0].week}–${ws[ws.length - 1].week}` };
    })
    .filter((g): g is PLBlockGroup => g != null);
}

// ── Строки для таблицы ──
export interface PLExportRow {
  Неделя: number; День: number; Нагрузка: string; Упражнение: string;
  Сеты: number; Повторы: number; 'Вес (кг)': number; '% ПМ': number; RIR: number;
}

export function plLoadLabel(load?: string): string {
  if (load === 'main' || load === 'Тяжелая') return 'ОСН';
  if (load === 'additional' || load === 'Дополнительная') return 'ДОП';
  return 'АКС';
}

export function plExportRows(weeks: LMSPlanWeek[]): PLExportRow[] {
  const rows: PLExportRow[] = [];
  for (const w of weeks) {
    (w.days ?? []).forEach((d, di) => {
      (d.exercises ?? []).forEach(e => {
        (e.workSets ?? []).forEach(ws => {
          rows.push({
            Неделя: w.week,
            День: di + 1,
            Нагрузка: plLoadLabel(e.load),
            Упражнение: e.name,
            Сеты: ws.sets,
            Повторы: ws.reps,
            'Вес (кг)': ws.weight,
            '% ПМ': Math.round(ws.pct * 100),
            RIR: ws.rir,
          });
        });
      });
    });
  }
  return rows;
}

// ── Excel ──
export function buildPLExcelWorkbook(title: string, rows: PLExportRow[], summary?: { label: string; value: string }[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Неделя: '', День: '', Нагрузка: '', Упражнение: '', Сеты: '', Повторы: '', 'Вес (кг)': '', '% ПМ': '', RIR: '' }]);
  ws['!cols'] = [{ wch: 7 }, { wch: 5 }, { wch: 9 }, { wch: 32 }, { wch: 6 }, { wch: 8 }, { wch: 9 }, { wch: 7 }, { wch: 6 }];
  XLSX.utils.book_append_sheet(wb, ws, 'План');
  if (summary && summary.length > 0) {
    const sws = XLSX.utils.aoa_to_sheet([['Метрика', 'Значение'], ...summary.map(s => [s.label, s.value])]);
    sws['!cols'] = [{ wch: 22 }, { wch: 26 }];
    XLSX.utils.book_append_sheet(wb, sws, 'Сводка');
  }
  wb.Props = { Title: title };
  return wb;
}

export type FileSaveResult = 'shared' | 'downloaded';

/** Сохранение файла на устройство.
 * Приоритет — нативная системная панель (navigator.share с файлом): работает в
 * мобильном PWA и Telegram WebView («Сохранить в Файлы», отправить в чат и т.п.),
 * где классическое <a download> и window.open заблокированы. Фолбэк — скачивание
 * ссылкой (десктоп/браузер). */
export async function saveFileToDevice(blob: Blob, filename: string): Promise<FileSaveResult> {
  const nav = navigator as unknown as {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  if (typeof nav.canShare === 'function' && typeof nav.share === 'function') {
    try {
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: filename });
        return 'shared';
      }
    } catch (e) {
      const err = e as { name?: string };
      if (err?.name === 'AbortError') return 'shared';
      // иная ошибка (TMA/iframe без share) — переходим к классическому скачиванию
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => { URL.revokeObjectURL(url); }, 500);
  return 'downloaded';
}

export async function downloadPLExcel(wb: XLSX.WorkBook, filename: string): Promise<FileSaveResult> {
  const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return saveFileToDevice(blob, filename);
}

// ── PDF (окно печати) ──
export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildPLPrintHtml(
  title: string,
  scopeLabel: string,
  weeks: LMSPlanWeek[],
  opts?: { summary?: { label: string; value: string }[] },
): string {
  const safeTitle = escHtml(title);
  const safeScope = escHtml(scopeLabel);
  const date = escHtml(new Date().toLocaleDateString('ru-RU'));
  const weekBlocks = weeks.map(w => {
    const dayBlocks = (w.days ?? []).map((d, di) => {
      const rows = (d.exercises ?? []).map(e => {
        const sets = (e.workSets ?? [])
          .map(ws => `${ws.sets}×${ws.reps} @ ${ws.weight} кг (${Math.round(ws.pct * 100)}% · RIR ${ws.rir})`)
          .join(' + ');
        return `<tr><td>${escHtml(e.name)}</td><td>${escHtml(plLoadLabel(e.load))}</td><td>${escHtml(sets)}</td></tr>`;
      }).join('');
      return `<h4>День ${di + 1}</h4><table><thead><tr><th>Упражнение</th><th>Нагрузка</th><th>Подходы</th></tr></thead><tbody>${rows || '<tr><td colspan="3">—</td></tr>'}</tbody></table>`;
    }).join('');
    const pm = Object.entries(w.pmRow ?? {}).map(([n, v]) => `${escHtml(n)}: ${v} кг`).join(' · ');
    return `<section><h3>Неделя ${w.week}${pm ? ` — ${pm}` : ''}</h3>${dayBlocks}</section>`;
  }).join('');
  const summaryHtml = opts?.summary && opts.summary.length > 0
    ? `<section><h3>Сводка цикла</h3><table><tbody>${opts.summary.map(s => `<tr><td>${escHtml(s.label)}</td><td>${escHtml(s.value)}</td></tr>`).join('')}</tbody></table></section>`
    : '';
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${safeTitle} — план</title>
<style>body{font-family:-apple-system,'Segoe UI',Arial,sans-serif;margin:24px;color:#111}h1{font-size:20px;margin:0 0 4px}h2{font-size:13px;color:#555;margin:0 0 16px;font-weight:400}h3{margin:18px 0 6px;font-size:15px;border-bottom:1px solid #ccc;padding-bottom:4px}h4{margin:10px 0 4px;font-size:13px}table{border-collapse:collapse;width:100%;margin-bottom:10px}th,td{border:1px solid #ccc;padding:5px 8px;font-size:12px;text-align:left}th{background:#f2f2f2}section{page-break-inside:avoid}@media print{body{margin:12px}}</style></head>
<body><h1>${safeTitle}</h1><h2>${safeScope} · ${date}</h2>${weekBlocks}${summaryHtml}</body></html>`;
}

/** Печать/PDF. В обычном браузере — окно печати (десктоп). В WebView/Telegram
 * window.open заблокирован (null) — открываем встроенный просмотр с кнопкой
 * «Печать» и копированием текста. Возвращает true, если окно печати открыто. */
export function printPLHtml(html: string, opts?: { title?: string; text?: string }): boolean {
  let w: Window | null = null;
  try { w = window.open('', '_blank'); } catch { w = null; }
  if (!w) {
    showPrintOverlay(html, opts?.title ?? 'План ПЛ', opts?.text);
    return false;
  }
  try {
    w.document.write(html);
    w.document.close();
    setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 250);
  } catch {
    showPrintOverlay(html, opts?.title ?? 'План ПЛ', opts?.text);
    return false;
  }
  return true;
}

const PRINT_OVERLAY_ID = 'pl-print-overlay';

const overlayBtn = (label: string, fg: string, bg: string): HTMLButtonElement => {
  const b = document.createElement('button');
  b.textContent = label;
  b.type = 'button';
  b.style.cssText = `padding:10px 14px;border-radius:10px;border:1px solid ${fg}55;background:${bg};color:${fg};font-size:12px;font-weight:700;cursor:pointer;min-height:44px;`;
  return b;
};

function htmlToText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/** Встроенный просмотр для печати/сохранения PDF, когда новое окно недоступно
 * (Telegram WebView / мобильный PWA). DOM-оверлей: iframe с планом, кнопки
 * «Печать / Сохранить PDF», «Копировать», «Закрыть». */
export function showPrintOverlay(html: string, title: string, text?: string): void {
  try { document.getElementById(PRINT_OVERLAY_ID)?.remove(); } catch { /* ignore */ }
  const root = document.createElement('div');
  root.id = PRINT_OVERLAY_ID;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Просмотр плана для печати');
  root.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.96);display:flex;flex-direction:column;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;';
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;flex:0 0 auto;flex-wrap:wrap;';
  const titleEl = document.createElement('span');
  titleEl.style.cssText = 'flex:1 1 auto;min-width:120px;color:#fff;font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  titleEl.textContent = `🖨 ${title}`;
  const printBtn = overlayBtn('🖨 Печать / Сохранить PDF', '#000', 'linear-gradient(135deg,#00e68a,#00c853)');
  const copyBtn = overlayBtn('📋 Копировать план', '#fff', 'rgba(255,255,255,0.08)');
  const closeBtn = overlayBtn('✕ Закрыть', '#ef4444', 'transparent');
  bar.append(titleEl, printBtn, copyBtn, closeBtn);
  const hint = document.createElement('div');
  hint.style.cssText = 'padding:0 12px 8px;color:rgba(255,255,255,0.5);font-size:11px;flex:0 0 auto;';
  hint.textContent = 'На телефоне: «Печать» → «Сохранить как PDF» или «Сохранить в Файлы».';
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'flex:1;width:100%;border:none;background:#fff;min-height:0;';
  iframe.sandbox = 'allow-same-origin';
  iframe.srcdoc = html;
  printBtn.addEventListener('click', () => {
    try { iframe.contentWindow?.print(); } catch { /* ignore */ }
  });
  copyBtn.addEventListener('click', () => {
    const t = text || htmlToText(html);
    const done = () => {
      copyBtn.textContent = '✓ Скопировано';
      setTimeout(() => { copyBtn.textContent = '📋 Копировать план'; }, 1600);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(t).then(done).catch(() => { copyBtn.textContent = '⚠ Не удалось'; });
    } else {
      const ta = document.createElement('textarea');
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch { /* ignore */ }
      ta.remove();
    }
  });
  closeBtn.addEventListener('click', () => root.remove());
  root.addEventListener('click', (e) => { if (e.target === root) root.remove(); });
  root.append(bar, hint, iframe);
  document.body.appendChild(root);
}

// ── Telegram share ──
export interface PLShareOpts {
  title: string; weeks: number; pmSquat: number; pmBench: number; pmDead: number;
  cycleId: string; baseUrl: string; plan?: LMSPlanWeek[];
}

const DIGEST_MAX = 1800;

/** Компактное текстовое описание плана — видно в сообщении даже без открытия
 * приложения (раньше ссылка вела просто на главный экран веб-версии). */
export function plShareDigest(o: { title: string; weeks: LMSPlanWeek[]; pmSquat: number; pmBench: number; pmDead: number; totalWeeks?: number }): string {
  const total = o.weeks.length > 0 ? o.weeks.length : o.totalWeeks ?? 0;
  const lines: string[] = [];
  lines.push(`🏋️ ПЛ-цикл «${o.title}» — ${total} нед.`);
  lines.push(`Присед ${o.pmSquat} / Жим ${o.pmBench} / Тяга ${o.pmDead} кг.`);
  const shown = o.weeks.slice(0, 5);
  for (const w of shown) {
    const dayLines: string[] = [];
    (w.days ?? []).forEach((d, di) => {
      const ex = (d.exercises ?? []).map(e => {
        const sets = (e.workSets ?? []).map(ws => `${ws.sets}×${ws.reps}@${ws.weight}кг`).join(' + ');
        return sets ? `${e.name} ${sets}` : e.name;
      }).join(' · ');
      if (ex) dayLines.push(`  День ${di + 1}: ${ex}`);
    });
    const block = [`Неделя ${w.week}:`, ...dayLines].join('\n');
    if ((lines.join('\n') + '\n' + block).length > DIGEST_MAX) {
      lines.push(`… ещё ${total - (w.week - 1)} нед. Полный план — в приложении.`);
      break;
    }
    lines.push(block);
  }
  if (shown.length > 0 && total > shown[shown.length - 1].week) {
    lines.push(`… ещё ${total - shown[shown.length - 1].week} нед. Полный план — в приложении.`);
  }
  return lines.join('\n');
}

export function plShareLink(o: PLShareOpts): string {
  const url = `${o.baseUrl}#pl-plan-${encodeURIComponent(o.cycleId)}`;
  const digest = plShareDigest({ title: o.title, weeks: o.plan ?? [], totalWeeks: o.weeks, pmSquat: o.pmSquat, pmBench: o.pmBench, pmDead: o.pmDead });
  const text = `${digest}\n\nОткрыть план в приложении: `;
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export function openPLShare(link: string): void {
  const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (l: string) => void } } }).Telegram?.WebApp;
  if (tg?.openTelegramLink) {
    try { tg.openTelegramLink(link); return; } catch { /* fallback ниже */ }
  }
  window.open(link, '_blank');
}

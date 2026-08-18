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

export type FileSaveResult = 'saved' | 'shared' | 'downloaded';

/** Сохранение файла на устройство.
 * Приоритет — нативная системная панель (navigator.share с файлом): работает в
 * мобильном PWA и Telegram WebView («Сохранить в Файлы», отправить в чат и т.п.),
 * где классическое <a download> и window.open заблокированы. Фолбэк — скачивание
 * ссылкой (десктоп/браузер). */
export async function saveFileToDevice(blob: Blob, filename: string): Promise<FileSaveResult> {
  // На поддерживаемых мобильных браузерах это единственный способ гарантировать
  // запись именно в «Файлы/Загрузки», а не просто открыть share-sheet.
  const picker = (window as unknown as {
    showSaveFilePicker?: (opts: { suggestedName: string; types?: unknown[] }) => Promise<{
      createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
    }>;
  }).showSaveFilePicker;
  if (typeof picker === 'function') {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [{ description: 'Файл экспорта', accept: { [blob.type || 'application/octet-stream']: [`.${filename.split('.').pop() || 'bin'}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved';
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return 'saved';
      // WebView может объявлять API, но запрещать picker. Используем следующий путь.
    }
  }
  // Нативный share файла: в Telegram WebView и мобильных браузерах открывает
  // системную панель с «Сохранить в Файлы» / «Отправить» (a.download там блокируется).
  const nav = navigator as unknown as {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };
  if (typeof nav.canShare === 'function' && typeof nav.share === 'function') {
    try {
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: filename });
        return 'shared';
      }
    } catch (e) {
      const err = e as { name?: string };
      if (err?.name === 'AbortError') return 'shared';
      // иная ошибка (WebView без share) — переходим к классическому скачиванию
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.setAttribute('aria-label', `Сохранить файл ${filename}`);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // В мобильном WebView атрибут download может быть проигнорирован. Оставляем
  // пользователю явную кнопку, которую можно нажать после разрешения загрузки.
  showFileSaveOverlay(url, filename, blob, () => URL.revokeObjectURL(url));
  return 'downloaded';
}

const FILE_SAVE_OVERLAY_ID = 'pl-file-save-overlay';

function showFileSaveOverlay(url: string, filename: string, blob: Blob, cleanup: () => void): void {
  document.getElementById(FILE_SAVE_OVERLAY_ID)?.remove();
  const root = document.createElement('div');
  root.id = FILE_SAVE_OVERLAY_ID;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Сохранение файла');
  root.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;';
  const card = document.createElement('div');
  card.style.cssText = 'width:min(420px,100%);background:#18181b;color:#fff;border:1px solid rgba(0,230,138,.35);border-radius:14px;padding:18px;box-sizing:border-box;';
  const title = document.createElement('div');
  title.textContent = `💾 Сохранить ${filename}`;
  title.style.cssText = 'font-weight:800;font-size:15px;margin-bottom:8px;';
  const hint = document.createElement('div');
  hint.textContent = 'Если файл не сохранился автоматически, нажмите кнопку ниже.';
  hint.style.cssText = 'color:rgba(255,255,255,.6);font-size:12px;line-height:1.4;margin-bottom:14px;';
  const save = document.createElement('a');
  save.href = url;
  save.download = filename;
  save.textContent = '💾 Сохранить файл';
  save.setAttribute('aria-label', `Сохранить файл ${filename}`);
  save.style.cssText = 'display:block;text-align:center;padding:12px;border-radius:10px;background:#00e68a;color:#000;font-weight:800;text-decoration:none;min-height:44px;box-sizing:border-box;';
  save.onclick = (e) => {
    e.preventDefault();
    try {
      const nav = navigator as unknown as { share?: (data: { files: File[]; title?: string }) => Promise<void> };
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
      if (typeof nav.share === 'function') {
        nav.share({ files: [file], title: filename }).then(() => root.remove()).catch(() => {
          try { window.open(url, '_blank'); } catch { /* no-op */ }
        });
        return;
      }
    } catch { /* no-op */ }
    try { window.open(url, '_blank'); } catch { /* no-op */ }
  };
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Закрыть';
  close.style.cssText = 'display:block;width:100%;margin-top:8px;padding:10px;border:1px solid rgba(255,255,255,.15);border-radius:10px;background:transparent;color:#fff;min-height:44px;';
  close.onclick = () => { root.remove(); cleanup(); };
  card.append(title, hint, save, close);
  root.append(card);
  document.body.append(root);
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
  cycleId: string; baseUrl: string; plan?: LMSPlanWeek[]; includeUrl?: boolean; telegramUrl?: string;
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

/** Deep-link Telegram Mini App. `startapp` is read from initDataUnsafe on launch. */
export function plTelegramAppUrl(cycleId: string, botUsername = 'BBHealthBot'): string {
  const bot = botUsername.replace(/^@/, '').trim();
  return `https://t.me/${encodeURIComponent(bot)}?startapp=${encodeURIComponent(`pl-plan-${cycleId}`)}`;
}

export function plShareLink(o: PLShareOpts): string {
  const url = o.telegramUrl || `${o.baseUrl}#pl-plan-${encodeURIComponent(o.cycleId)}`;
  const digest = plShareDigest({ title: o.title, weeks: o.plan ?? [], totalWeeks: o.weeks, pmSquat: o.pmSquat, pmBench: o.pmBench, pmDead: o.pmDead });
  const text = o.includeUrl === false
    ? digest
    : `${digest}\n\nОткрыть план в приложении: `;
  return o.includeUrl === false
    ? `https://t.me/share/url?text=${encodeURIComponent(text)}`
    : `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export async function openPLShare(link: string, opts?: { title?: string; text?: string; url?: string }): Promise<'shared' | 'opened'> {
  const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (l: string) => void } } }).Telegram?.WebApp;
  if (tg?.openTelegramLink) {
    try { tg.openTelegramLink(link); return 'opened'; } catch { /* fallback ниже */ }
  }
  const nav = navigator as Navigator & { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> };
  if (typeof nav.share === 'function' && opts) {
    try {
      await nav.share({ title: opts.title, text: opts.text, url: opts.url });
      return 'shared';
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return 'shared';
    }
  }
  window.open(link, '_blank');
  return 'opened';
}

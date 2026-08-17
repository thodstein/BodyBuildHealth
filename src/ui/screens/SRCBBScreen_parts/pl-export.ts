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

export function downloadPLExcel(wb: XLSX.WorkBook, filename: string): void {
  const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
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

export function printPLHtml(html: string): void {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 250);
}

// ── Telegram share ──
export interface PLShareOpts {
  title: string; weeks: number; pmSquat: number; pmBench: number; pmDead: number;
  cycleId: string; baseUrl: string;
}

export function plShareLink(o: PLShareOpts): string {
  const url = `${o.baseUrl}#pl-plan-${encodeURIComponent(o.cycleId)}`;
  const text = `ПЛ-цикл «${o.title}» — ${o.weeks} нед. Присед ${o.pmSquat} / Жим ${o.pmBench} / Тяга ${o.pmDead} кг. План в приложении: `;
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export function openPLShare(link: string): void {
  const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (l: string) => void } } }).Telegram?.WebApp;
  if (tg?.openTelegramLink) {
    try { tg.openTelegramLink(link); return; } catch { /* fallback ниже */ }
  }
  window.open(link, '_blank');
}

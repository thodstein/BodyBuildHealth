/**
 * manual-export-pro.engine.ts — PRO-экспорты для ручного конструктора.
 *
 * Фаза 6: CSV/XLSX-совместимый CSV, JSON тренеру (enriched), HTML print file, QR payload,
 * экспорт одного микроцикла, защита от формул (csvEscape), per-set details (kg/pct/velocity, tempo, superset).
 */

import type { UserProgram, UserWeek } from '../user-program/user-program.types';
import { analyzeManualVolume } from './manual-volume.engine';
import { getVolumeLandmarks } from '../volume-landmarks.engine';

function escCsv(v: unknown): string {
  const s = String(v ?? '');
  // Защита от формул-инъекций Excel: префикс ' для = + - @
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  if (/[",\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** CSV строки программы: Неделя, День, Упражнение, Группа, Сеты×Повт, RIR, кг, %1RM, tempo, rest, superset */
export function buildProgramCsv(program: UserProgram, opts?: { week?: number }): string {
  const headers = ['Неделя','Фаза','День','Упражнение','Группа','Сеты','Повт','RIR','кг','%1RM','Скорость м/с','Темп','Отдых с','Суперсет','Техника','Комментарий'];
  const lines: string[] = [headers.map(escCsv).join(',')];
  const weeks: UserWeek[] = (program.bb?.weeks ?? (program.hybrid?.bbWeeks as UserWeek[] | undefined) ?? []) as UserWeek[];
  const filtered = opts?.week ? weeks.filter(w => w.week === opts.week) : weeks;
  // fallback PL customWeeks
  if (filtered.length === 0 && program.pl?.customWeeks?.length) {
    for (const w of program.pl.customWeeks) {
      if (opts?.week && w.week !== opts.week) continue;
      for (const d of w.days) {
        for (const ex of d.exercises) {
          for (const st of ex.sets) {
            lines.push([
              w.week, w.phase, d.name, ex.name, ex.muscle || ex.lift, st.sets, st.reps, st.rir ?? '', '', typeof st.pct === 'number' ? Math.round(st.pct*100) : '', '', '', '', '', '', ''
            ].map(escCsv).join(','));
          }
        }
      }
    }
    return lines.join('\n');
  }
  for (const w of filtered) {
    for (const s of w.sessions) {
      for (const b of s.blocks) {
        if (!b.exerciseName) continue;
        for (const st of b.sets) {
          const pct = typeof (st as any).pctOf1RM === 'number' ? Math.round((st as any).pctOf1RM * 100) : '';
          const vel = typeof (st as any).velocityMs === 'number' ? (st as any).velocityMs : '';
          lines.push([
            w.week,
            w.phase + (w.deload ? ' (deload)' : ''),
            s.name,
            b.exerciseName,
            b.muscle,
            b.sets.length,
            st.reps,
            st.rir,
            typeof st.weight === 'number' ? st.weight : '',
            pct,
            vel,
            st.tempo || b.tempoSpec || '',
            st.restSec ?? '',
            b.supersetWith ? 'да' : '',
            st.technique || '',
            b.comment || '',
          ].map(escCsv).join(','));
        }
      }
    }
  }
  return lines.join('\n');
}

export function buildProgramCsvForWeek(program: UserProgram, weekNumber: number): string {
  return buildProgramCsv(program, { week: weekNumber });
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** JSON для тренера: enriched (meta + volume analysis + week dump + export date). */
export function buildProgramJsonForCoach(program: UserProgram, level?: string): string {
  const lvl = level || program.meta.level || 'intermediate';
  let volume: any = null;
  try { volume = analyzeManualVolume(program, lvl); } catch { /* ignore */ }
  const payload = {
    meta: program.meta,
    bb: program.bb ? { weeks: program.bb.weeks, progression: program.bb.progression, constraints: program.bb.constraints } : undefined,
    pl: program.pl,
    hybrid: program.hybrid,
    analysis: volume ? {
      peakEffective: volume.peakEffective,
      avgEffective: volume.avgEffective,
      weeklyBudget: volume.weeklyBudget,
      sessionLimits: volume.sessionLimits,
      issues: volume.issues,
    } : undefined,
    exportedAt: new Date().toISOString(),
    version: 'manual-pro-6',
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.json') ? filename : filename + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** HTML для печати/сохранения как файл (не window.open). Включает volume сводку, RIR wave hints, фазовые цвета. */
export function buildProgramPrintHtmlFile(program: UserProgram, level?: string): string {
  const title = escHtml(program.meta.title || 'Программа');
  const lvl = level || program.meta.level || 'intermediate';
  let volRows = '';
  try {
    const ana = analyzeManualVolume(program, lvl);
    const muscles = Object.keys(ana.peakEffective).sort();
    volRows = muscles.map(m => {
      const lm = getVolumeLandmarks(lvl, m);
      const peak = Math.round(ana.peakEffective[m] || 0);
      const status = lm ? (peak > lm.mrv ? '🔴' : peak >= lm.mav ? '🟡' : peak >= lm.mev ? '🟢' : '🔵') : '';
      return `<tr><td>${escHtml(m)}</td><td>${peak}</td><td>${lm ? `${lm.mev}/${lm.mav}/${lm.mrv}` : '-'}</td><td>${status}</td></tr>`;
    }).join('');
  } catch { /* ignore */ }

  const weeks: UserWeek[] = (program.bb?.weeks ?? (program.hybrid?.bbWeeks as UserWeek[] | undefined) ?? []) as UserWeek[];
  const weeksHtml = weeks.map(w => {
    const phaseColor: Record<string,string> = { accumulation:'#3b82f6', intensification:'#f59e0b', deload:'#10b981', peaking:'#ef4444' };
    const bg = phaseColor[w.phase] || '#6b7280';
    const deloadBadge = w.deload ? ' <span style="background:#10b981;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px">deload</span>' : '';
    const sessHtml = w.sessions.map(s => {
      const blocksHtml = s.blocks.map(b => {
        const setsStr = b.sets.map(st => {
          const wStr = typeof st.weight === 'number' ? `${st.weight}кг` : '';
          const pctStr = typeof (st as any).pctOf1RM === 'number' ? ` ${(Math.round((st as any).pctOf1RM*100))}%` : '';
          const velStr = typeof (st as any).velocityMs === 'number' ? ` ${(st as any).velocityMs}м/с` : '';
          return `${st.reps}×${wStr}${pctStr}${velStr} RIR${st.rir}${st.tempo ? ` ${st.tempo}`:''}${st.technique && st.technique!=='none' ? ` [${st.technique}]`:''}`;
        }).join(' | ');
        const sup = b.supersetWith ? ' ⊕' : '';
        return `<tr><td>${escHtml(b.exerciseName)}${sup}</td><td>${escHtml(b.muscle)}</td><td>${b.sets.length}</td><td>${escHtml(setsStr)}</td><td>${escHtml(b.comment||'')}</td></tr>`;
      }).join('');
      return `<h4>${escHtml(s.name)} ${s.focus ? `<span style="color:#6b7280">(${escHtml(s.focus)})</span>`:''} ${ (s as any).character ? `<span style="font-size:11px;background:#f3f4f6;padding:2px 6px;border-radius:4px">${(s as any).character}</span>`:''}</h4>
      <table border="1" cellpadding="4" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f9fafb"><th>Упражнение</th><th>Группа</th><th>Сеты</th><th>Схема</th><th>Комментарий</th></tr></thead><tbody>${blocksHtml || '<tr><td colspan="5">—</td></tr>'}</tbody></table>`;
    }).join('');
    return `<section style="margin-bottom:18px;border:1px solid #e5e7eb;border-radius:8px;padding:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="background:${bg};color:#fff;padding:4px 8px;border-radius:6px;font-size:12px">${escHtml(w.phase)}</span><strong>Неделя ${w.week}</strong>${deloadBadge} ${w.note ? `<span style="color:#6b7280;font-size:12px">${escHtml(w.note)}</span>`:''}</div>
      ${sessHtml}
    </section>`;
  }).join('');

  const fallbackPl = (!weeks.length && program.pl?.customWeeks?.length) ? program.pl.customWeeks.map(w => {
    const daysHtml = w.days.map(d => {
      const exHtml = d.exercises.map(e => {
        const setsHtml = e.sets.map(s => `${s.sets}×${s.reps} @${Math.round(s.pct*100)}% RIR${s.rir ?? ''}`).join(' | ');
        return `<tr><td>${escHtml(e.name)}</td><td>${escHtml(e.lift)}</td><td>${escHtml(setsHtml)}</td></tr>`;
      }).join('');
      return `<h4>${escHtml(d.name)}</h4><table border="1" cellpadding="4" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f9fafb"><th>Упражнение</th><th>Тип</th><th>Схема</th></tr></thead><tbody>${exHtml}</tbody></table>`;
    }).join('');
    return `<section style="margin-bottom:18px;border:1px solid #e5e7eb;border-radius:8px;padding:12px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><strong>Неделя ${w.week}</strong> <span style="background:#6b7280;color:#fff;padding:4px 8px;border-radius:6px;font-size:12px">${escHtml(w.phase)}</span></div>${daysHtml}</section>`;
  }).join('') : '';

  return `<!doctype html><html><head><meta charset="utf-8"><title>${title} — печать</title><style>
    body{font-family:Inter,system-ui,Arial,sans-serif;max-width:900px;margin:0 auto;padding:16px;color:#111}
    h1{font-size:20px;margin:0 0 8px}
    .meta{color:#6b7280;font-size:12px;margin-bottom:12px}
    table th{font-weight:600}
    @media print{body{padding:0} section{break-inside:avoid}}
    </style></head><body>
    <h1>${title}</h1>
    <div class="meta">${escHtml(program.meta.goal)} · ${escHtml(program.meta.level)} · ${program.meta.daysPerWeek}д/нед · ${program.meta.weeks}нед · ${escHtml(program.meta.direction)} ${program.meta.cycleLength ? `· cycle ${program.meta.cycleLength}д`:''} ${program.meta.specialization?.length ? `· спец ${escHtml(program.meta.specialization.join(','))}`:''}</div>
    ${volRows ? `<h3>Сводка объёма (effective, пик/нед)</h3><table border="1" cellpadding="4" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f9fafb"><th>Мышца</th><th>Пик</th><th>MEV/MAV/MRV</th><th></th></tr></thead><tbody>${volRows}</tbody></table>`:''}
    ${weeksHtml || fallbackPl || '<p>Нет недель</p>'}
    <footer style="margin-top:18px;font-size:11px;color:#9ca3af">Сгенерировано BodyBuildHealth · ${new Date().toLocaleString('ru-RU')}</footer>
    </body></html>`;
}

export function downloadHtml(filename: string, html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.html') ? filename : filename + '.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** QR payload: минимальный JSON для импорта (id + title + weeks hash). Для реального QR — передать в qrcode lib. */
export function buildProgramQrPayload(program: UserProgram): string {
  const payload = {
    v: 1,
    id: program.meta.id,
    title: program.meta.title,
    weeks: (program.bb?.weeks?.length ?? program.pl?.customWeeks?.length ?? program.hybrid?.bbWeeks?.length ?? 0),
    direction: program.meta.direction,
    hash: String(JSON.stringify(program).length % 100000) // cheap hash, для проверки целостности
  };
  return JSON.stringify(payload);
}

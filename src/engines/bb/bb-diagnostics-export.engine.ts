/**
 * bb-diagnostics-export.engine.ts — экспорт ББ-диагностики (HTML/CSV, XSS-safe).
 * Расширен таблицей «Упражнение → эффект (SFR/lengthened/паттерн/темп/техника)» для единого инструмента.
 */
import type { BBDiagnosticsReport } from './bb-diagnostics-hub.engine';
import { auditPlanExercises } from './bb-plan-exercise-audit.engine';
import { calcExerciseEffect, exerciseEffectScore } from './bb-exercise-effect.engine';

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildBBDiagnosticsHtml(report: BBDiagnosticsReport, meta?: { date?: string; level?: string; plan?: any; weakCauses?: Record<string, { cause: string; confidence: number; evidence: string[]; fix: string }>; specBlock?: { lengthWeeks: number; donors: string[]; rationale: string[]; weeks: Array<{ week: number; targetSets: Record<string, number>; frequency: Record<string, number>; note: string }> } | null }): string {
  const date = meta?.date || new Date().toISOString().slice(0, 10);
  const level = meta?.level || '';
  const rowsWeak = report.weakCandidates.map(c => `<tr><td>${esc(c.muscle)}</td><td>${esc(c.granular || '')}</td><td>${esc(c.source)}</td><td>${c.deltaPct}%</td><td>${esc(c.reason)}</td></tr>`).join('') || '<tr><td colspan="5">— баланс</td></tr>';
  const rowsSym = Object.entries(report.symmetry.ratios).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('') || '<tr><td colspan="2">—</td></tr>';
  const issuesSym = report.symmetry.issues.map(s => `<li>${esc(s)}</li>`).join('') || '<li>—</li>';
  const issuesStim = report.stimulus.issues.map(s => `<li>${esc(s)}</li>`).join('') || '<li>—</li>';
  const findings = report.findings.map(s => `<li>${esc(s)}</li>`).join('');
  const priorities = report.priorities.map(s => `<li>${esc(s)}</li>`).join('');
  const floors = report.score.floors.map(s => `<li>${esc(s)}</li>`).join('');
  // Упражнения → эффект (максимально на каждое)
  let exerciseSection = '';
  try {
    const plan = (meta as any)?.plan;
    if (plan && plan.weeks) {
      const audit = auditPlanExercises(plan as any);
      if (audit && audit.totalExercises > 0) {
        const rowsEx = Object.entries(audit.byMuscle).flatMap(([m, bm]) =>
          bm.exercises.map(eff => {
            const sc = exerciseEffectScore(eff);
            return `<tr><td>${esc(m)}</td><td>${esc(eff.name)}</td><td>${eff.sfr ?? '—'}</td><td>${esc(eff.profile ?? '—')}</td><td>${esc(eff.angleClass ?? '—')}</td><td>${esc(eff.strictGroup?.key ?? '—')}</td><td>${esc(eff.jointStress ?? '—')}</td><td>${eff.unilateral ? '↔' : ''}</td><td>${eff.directSets}</td><td>${sc}</td><td>${esc(eff.note ?? '')}</td></tr>`;
          })
        ).join('');
        const flagsEx = audit.flags.length ? `<div style="font-size:11px;color:#f59e0b">Флаги портфеля: ${esc(audit.flags.join(' · '))}</div>` : '';
        exerciseSection = `<h2>Упражнения → эффект (максимально)</h2><div style="font-size:11px;color:#666">SFR средний ${audit.avgSfr ?? '—'}/5 · lengthened ${(audit.lengthenedRatio * 100).toFixed(0)}% · unilateral ${(audit.unilateralRatio * 100).toFixed(0)}% · усталость ${audit.fatigueDensity.toFixed(2)} · ${audit.totalExercises} упр · ${audit.totalSets} сетов</div>${flagsEx}<table><tr><th>Мышца</th><th>Упражнение</th><th>SFR</th><th>Профиль</th><th>Угол</th><th>Строгая</th><th>Сустав</th><th>Uni</th><th>Сеты</th><th>Score</th><th>Прим.</th></tr>${rowsEx || '<tr><td colspan="11">— нет упражнений</td></tr>'}</table>`;
      }
    }
  } catch {}
  // fallback если план не передан — пробуем localStorage (как раньше hub делал)
  if (!exerciseSection) {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('he_bb_plan_saved') : null;
      if (raw) {
        const j = JSON.parse(raw);
        const plan = j?.plan?.weeks ? j.plan : j?.weeks ? j : null;
        if (plan) {
          const audit = auditPlanExercises(plan as any);
          if (audit && audit.totalExercises > 0) {
            const rowsEx2 = Object.entries(audit.byMuscle).flatMap(([m, bm]) => bm.exercises.map(eff => `<tr><td>${esc(m)}</td><td>${esc(eff.name)}</td><td>${eff.sfr ?? '—'}</td><td>${esc(eff.profile ?? '—')}</td><td>${esc(eff.angleClass ?? '—')}</td><td>${esc(eff.jointStress ?? '—')}</td><td>${eff.directSets}</td><td>${exerciseEffectScore(eff)}</td></tr>`)).join('');
            exerciseSection = `<h2>Упражнения → эффект</h2><table><tr><th>Мышца</th><th>Упражнение</th><th>SFR</th><th>Профиль</th><th>Угол</th><th>Сустав</th><th>Сеты</th><th>Score</th></tr>${rowsEx2}</table>`;
          }
        }
      }
    } catch {}
  }

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>ББ-диагностика ${esc(date)}</title>
<style>body{font-family:system-ui,Arial,sans-serif;padding:18px;color:#111}h1{font-size:18px}h2{font-size:14px;margin:14px 0 6px}table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #ddd;padding:6px 8px;font-size:12px;text-align:left}th{background:#f5f5f5}.badge{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;color:#fff}</style>
</head><body>
<h1>ББ-диагностика — отчёт ${esc(date)} ${level ? `· ${esc(level)}` : ''}</h1>
<div>Score <span class="badge" style="background:${report.score.level === 'critical' ? '#ef4444' : report.score.level === 'warn' ? '#f59e0b' : '#22c55e'}">${report.score.score}/100 ${esc(report.score.level)}</span> · verification ${report.score.verification} · weak ${report.weakMusclesCanonical.join(', ') || '—'}</div>
${floors ? `<div style="margin-top:8px;color:#ef4444;font-size:11px"><b>Floors:</b><ul>${floors}</ul></div>` : ''}
<h2>Слабые (топ-2 → в ББ-авто)</h2><table><tr><th>Мышца</th><th>Зона</th><th>Источник</th><th>Δ%</th><th>Причина</th></tr>${rowsWeak}</table>
${(meta as any)?.weakCauses ? `<h2>Причины отставания (MAX PRO)</h2><table><tr><th>Зона</th><th>Причина</th><th>Уверенность</th><th>Доказательства</th><th>Чинить</th></tr>${Object.entries((meta as any).weakCauses as Record<string, { cause: string; confidence: number; evidence: string[]; fix: string }>).map(([z, c]) => `<tr><td>${esc(z)}</td><td>${esc(c.cause)}</td><td>${Math.round(c.confidence * 100)}%</td><td>${esc(c.evidence.join(' · '))}</td><td>${esc(c.fix)}</td></tr>`).join('')}</table>` : ''}
${(meta as any)?.specBlock ? `<h2>Спец-блок ${(meta as any).specBlock.lengthWeeks} нед</h2><div style="font-size:11px;color:#666">${esc(((meta as any).specBlock.rationale || []).join(' · '))} · доноры: ${esc((((meta as any).specBlock as any).donors || []).join(', ') || '—')}</div><table><tr><th>Нед</th><th>Цели (сеты)</th><th>Частота</th><th>Заметка</th></tr>${((meta as any).specBlock.weeks || []).map((w: { week: number; targetSets: Record<string, number>; frequency: Record<string, number>; note: string }) => `<tr><td>${w.week}</td><td>${esc(Object.entries(w.targetSets).map(([k, v]) => `${k} ${v}`).join(', '))}</td><td>${esc(Object.entries(w.frequency).map(([k, v]) => `${k} ×${v}`).join(', '))}</td><td>${esc(w.note)}</td></tr>`).join('')}</table>` : ''}
<h2>Симметрия</h2><table><tr><th>Рацио</th><th>Значение</th></tr>${rowsSym}</table><ul>${issuesSym}</ul>
<h2>Стимул</h2><ul>${issuesStim}</ul><div style="font-size:11px;color:#666">lengthened ${report.stimulus.global.lengthened} · mid ${report.stimulus.global.midRange} · shortened ${report.stimulus.global.shortened} · compound ${report.stimulus.global.compound} / iso ${report.stimulus.global.isolation}</div>
${exerciseSection}
<h2>Находки</h2><ul>${findings || '<li>—</li>'}</ul>
<h2>Приоритеты</h2><ul>${priorities || '<li>—</li>'}</ul>
<div style="margin-top:14px;font-size:10px;color:#888">ББ-диагностика PRO · MEV/MAV/MRV Israetel · Reeves/Sandow · Schoenfeld lengthened · SFR · RSS √Σpen² · PROF выполнение</div>
</body></html>`;
}

export function buildBBDiagnosticsCsv(report: BBDiagnosticsReport, plan?: any): string {
  const escCsv = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines: string[] = [];
  lines.push(['muscle', 'granular', 'source', 'deltaPct', 'reason'].map(escCsv).join(','));
  for (const c of report.weakCandidates) lines.push([c.muscle, c.granular || '', c.source, c.deltaPct, c.reason].map(escCsv).join(','));
  lines.push('');
  lines.push(['metric', 'value'].map(escCsv).join(','));
  lines.push(['score', report.score.score].map(escCsv).join(','));
  lines.push(['level', report.score.level].map(escCsv).join(','));
  lines.push(['verification', report.score.verification].map(escCsv).join(','));
  lines.push(['weakCanonical', report.weakMusclesCanonical.join('|')].map(escCsv).join(','));
  lines.push(['weakGranular', report.weakZonesGranular.join('|')].map(escCsv).join(','));
  for (const [k, v] of Object.entries(report.symmetry.ratios)) lines.push([k, v].map(escCsv).join(','));
  // упражнения → эффект (максимально)
  try {
    const p = plan || (() => { try { const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('he_bb_plan_saved') : null; if (!raw) return null; const j = JSON.parse(raw); return j?.plan?.weeks ? j.plan : j?.weeks ? j : null; } catch { return null; } })();
    if (p && p.weeks) {
      const audit = auditPlanExercises(p as any);
      if (audit && audit.totalExercises > 0) {
        lines.push('');
        lines.push(['exercise_muscle', 'exercise', 'sfr', 'profile', 'angle', 'strict', 'joint', 'uni', 'sets', 'score'].map(escCsv).join(','));
        for (const [m, bm] of Object.entries(audit.byMuscle)) for (const eff of bm.exercises) {
          lines.push([m, eff.name, eff.sfr ?? '', eff.profile ?? '', eff.angleClass ?? '', eff.strictGroup?.key ?? '', eff.jointStress ?? '', eff.unilateral ? '1' : '0', eff.directSets, exerciseEffectScore(eff)].map(escCsv).join(','));
        }
      }
    }
  } catch {}
  return lines.join('\n');
}

export function downloadHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

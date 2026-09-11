/**
 * lab-exercise-export.engine.ts — экспорт аудита Лаборатории (Epic F).
 * HTML (печать) + CSV. XSS-escape всех пользовательских строк,
 * защита от формульных инъекций в CSV (префикс `'` для =+-@).
 */
import type { LabPlanAudit } from './lab-plan-exercise-audit.engine';
import { diagnoseLabExercise } from './lab-exercise-diagnosis.engine';
import { EXERCISE_CATALOG } from '../core/exercise-catalog';

/** Диагнозы всех упражнений плана (дедуп по id — худший скор) для экспорта. */
export function collectLabExportDiagnoses(
  plan: unknown,
  ctx: {
    goal?: string;
    level?: string;
    weakZones?: string[];
    asymPct?: number | null;
    mobilityRestrictions?: string[];
    injuries?: Array<string | { muscle?: string }>;
  },
  limit = 30,
): LabExportDiagnosis[] {
  const out = new Map<string, LabExportDiagnosis>();
  try {
    const weeks = (plan as { weeks?: Array<{ sessions?: Array<{ exercises?: unknown[] }> }> }).weeks || [];
    for (const w of weeks) {
      for (const s of w.sessions || []) {
        for (const raw of (s.exercises || []) as Array<{ exerciseName?: string; id?: string; name?: string; muscle?: string }>) {
          const id = String(raw.exerciseName || raw.id || raw.name || '');
          if (!id || out.size >= limit) continue;
          const cat = EXERCISE_CATALOG.find((c) => c.id === id || c.name === raw.name);
          const muscle = String(raw.muscle || cat?.group || '').toLowerCase();
          try {
            const d = diagnoseLabExercise(
              { id: cat?.id || id, name: String(raw.name || cat?.name || id), muscle },
              {
                goal: ctx.goal, level: ctx.level, weakZones: ctx.weakZones, asymPct: ctx.asymPct,
                muscle: muscle || undefined, mobilityRestrictions: ctx.mobilityRestrictions, injuries: ctx.injuries,
              },
            );
            const prev = out.get(id);
            const cur: LabExportDiagnosis = { name: d.effect.name || id, score: d.score, flags: [...d.flags], issues: [...d.issues] };
            if (!prev || cur.score < prev.score) out.set(id, cur);
          } catch {
            /* пропуск битой записи */
          }
        }
      }
    }
  } catch {
    /* noop */
  }
  return [...out.values()].sort((a, b) => a.score - b.score);
}

export function escLabHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Ячейка CSV: кавычки + антиформула. */
export function labCsvCell(v: string | number | null | undefined): string {
  const s = String(v ?? '');
  const guarded = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export interface LabExportDiagnosis {
  name: string;
  score: number;
  flags: string[];
  issues: string[];
}

/** HTML-сводка: портфель + диагнозы + коррекции (для печати). */
export function buildLabExportHtml(
  audit: LabPlanAudit,
  diagnoses: LabExportDiagnosis[],
): string {
  const rows = diagnoses
    .map(
      (d) =>
        `<tr><td>${escLabHtml(d.name)}</td><td>${d.score}</td>` +
        `<td>${escLabHtml(d.flags.join(', '))}</td>` +
        `<td>${escLabHtml(d.issues.slice(0, 3).join(' · '))}</td></tr>`,
    )
    .join('');
  const safety = audit.safetyFlags
    .filter((f) => f.blocked)
    .map((f) => `<li>${escLabHtml(f.name)} — ${escLabHtml(f.notes.join('; '))}</li>`)
    .join('');
  return (
    `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Лаборатория упражнений — сводка</title></head><body>` +
    `<h1>Лаборатория упражнений — сводка портфеля</h1>` +
    `<p>Lab ${audit.labScore}/100 · упражнений ${audit.totalExercises} · сетов ${audit.totalSets} · ` +
    `SFR ${audit.audit.avgSfr != null ? audit.audit.avgSfr.toFixed(1) : '—'} · ` +
    `lengthened ${Math.round(audit.audit.lengthenedRatio * 100)}%</p>` +
    (safety ? `<h2>Травмы (только замена)</h2><ul>${safety}</ul>` : '') +
    `<h2>Диагнозы</h2><table border="1" cellpadding="4"><tr><th>Упражнение</th><th>Скор</th><th>Флаги</th><th>Проблемы</th></tr>${rows}</table>` +
    `</body></html>`
  );
}

/** CSV: упражнение;скор;флаги;проблемы (BOM для Excel). */
export function buildLabExportCsv(diagnoses: LabExportDiagnosis[]): string {
  const lines = ['\uFEFFУпражнение;Скор;Флаги;Проблемы'];
  for (const d of diagnoses) {
    lines.push(
      [labCsvCell(d.name), labCsvCell(d.score), labCsvCell(d.flags.join(', ')), labCsvCell(d.issues.slice(0, 3).join(' · '))].join(';'),
    );
  }
  return lines.join('\n');
}

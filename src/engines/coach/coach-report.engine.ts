/**
 * coach-report.engine.ts — отчёт по атлету за период (текст, CSV, HTML).
 *
 * ЗАЧЕМ. Тренеру нужно показать итог человеку (или сохранить себе): объём, что
 * реально сделано, как менялся вес, выполнен ли план и что записано в заметках.
 *
 * ЧЕСТНЫЕ ГРАНИЦЫ:
 *  • считаем только арифметику по записям: тоннаж = Σ вес × повторы, число
 *    сессий, лучший подход по весу. НЕ считаем «оценку формы», «проценты от
 *    максимума» и не прогнозируем;
 *  • «личный максимум» — это максимум ПО ЗАПИСЯМ в дневнике за всё время, что
 *    есть на устройстве, а не «настоящий ПМ»: так и написано в отчёте;
 *  • даты — календарные `YYYY-MM-DD` (канон `core/local-date`);
 *  • HTML экранируется: имя атлета и заметки — пользовательский текст.
 */
import type { CoachLogEntry } from './coach-athlete-log.engine';

export interface ReportSetFact {
  exercise: string;
  weight: number;
  reps: number;
}

export interface ReportSession {
  date: string;
  /** Сумма вес × повторы, кг. */
  tonnage: number;
  sets: ReportSetFact[];
}

export interface ReportPeriod {
  from: string;
  to: string;
  /** Подпись для человека: «неделя 02.11–08.11» / «01.10–31.10». */
  label: string;
}

export interface ReportAthlete {
  name: string;
  direction: string;
  goal: string;
  group: string;
  startedAt: string;
}

export interface ReportInput {
  athlete: ReportAthlete;
  period: ReportPeriod;
  /** Все сессии атлета — из них берём период и личные максимумы по записям. */
  sessions: readonly ReportSession[];
  /** Взвешивания за всё время (фильтруем период внутри). */
  weights: readonly { date: string; kg: number }[];
  /** Записи журнала тренера (его собственные наблюдения). */
  coachLog?: readonly CoachLogEntry[];
  /** Заметки тренера (уже отфильтрованные по атлету). */
  notes?: readonly { createdAt: string; title: string; body: string }[];
  /** Выполнение недели, если посчитано. */
  adherenceLine?: string | null;
  /** Сгенерировано (для шапки); по умолчанию — не печатаем. */
  generatedAt?: string;
}

export interface ExerciseTotal {
  exercise: string;
  tonnage: number;
  sets: number;
  /** Лучший подход за период по весу (при равном весе — больше повторов). */
  best: ReportSetFact | null;
}

export interface PersonalBest {
  exercise: string;
  weight: number;
  reps: number;
  date: string;
  /** Достигнут ли этот максимум именно в отчётом периоде. */
  inPeriod: boolean;
}

export interface CoachReport {
  period: ReportPeriod;
  athlete: ReportAthlete;
  sessions: number;
  trainingDays: number;
  tonnage: number;
  exercises: ExerciseTotal[];
  personalBests: PersonalBest[];
  weight: {
    first: { date: string; kg: number } | null;
    last: { date: string; kg: number } | null;
    /** last.kg - first.kg; null — меньше двух взвешиваний в периоде. */
    changeKg: number | null;
    count: number;
  };
  coachLogCount: number;
  notes: { createdAt: string; title: string; body: string }[];
  adherenceLine: string | null;
  generatedAt: string | null;
}

const inPeriod = (date: string, p: ReportPeriod): boolean => date >= p.from && date <= p.to;

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Лучший подход: сначала вес, при равенстве — повторы. */
function better(a: ReportSetFact, b: ReportSetFact | null): boolean {
  if (!b) return true;
  if (a.weight !== b.weight) return a.weight > b.weight;
  return a.reps > b.reps;
}

export function buildCoachReport(input: ReportInput): CoachReport {
  const { period } = input;
  const periodSessions = input.sessions.filter(s => inPeriod(s.date, period));
  const trainingDays = new Set(periodSessions.map(s => s.date)).size;
  const tonnage = Math.round(periodSessions.reduce((sum, s) => sum + s.tonnage, 0));

  const byExercise = new Map<string, ExerciseTotal>();
  for (const session of periodSessions) {
    for (const set of session.sets) {
      const key = set.exercise.trim();
      if (!key || !(set.weight > 0) || !(set.reps > 0)) continue;
      const cur = byExercise.get(key) ?? { exercise: key, tonnage: 0, sets: 0, best: null };
      cur.tonnage += set.weight * set.reps;
      cur.sets += 1;
      if (better(set, cur.best)) cur.best = { ...set };
      byExercise.set(key, cur);
    }
  }
  const exercises = [...byExercise.values()]
    .map(e => ({ ...e, tonnage: Math.round(e.tonnage) }))
    .sort((a, b) => b.tonnage - a.tonnage || a.exercise.localeCompare(b.exercise, 'ru'));

  // Личные максимумы по ЗАПИСЯМ за всю историю, что есть в дневнике.
  const allTimeBest = new Map<string, PersonalBest>();
  for (const session of input.sessions) {
    for (const set of session.sets) {
      const key = set.exercise.trim();
      if (!key || !(set.weight > 0) || !(set.reps > 0)) continue;
      const cur = allTimeBest.get(key);
      if (!cur || better(set, cur)) {
        allTimeBest.set(key, {
          exercise: key,
          weight: set.weight,
          reps: set.reps,
          date: session.date,
          inPeriod: inPeriod(session.date, period),
        });
      }
    }
  }
  const personalBests = [...allTimeBest.values()]
    .filter(b => b.inPeriod)
    .sort((a, b) => b.weight - a.weight || a.exercise.localeCompare(b.exercise, 'ru'));

  const periodWeights = input.weights
    .filter(w => inPeriod(w.date, period))
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = periodWeights[0] ?? null;
  const last = periodWeights[periodWeights.length - 1] ?? null;

  const notes = (input.notes ?? [])
    .filter(n => inPeriod((n.createdAt ?? '').slice(0, 10), period))
    .slice(0, 50);

  const coachLogCount = (input.coachLog ?? []).filter(e => inPeriod(e.date, period)).length;

  return {
    period,
    athlete: input.athlete,
    sessions: periodSessions.length,
    trainingDays,
    tonnage,
    exercises,
    personalBests,
    weight: {
      first,
      last,
      changeKg: first && last && first !== last ? round1(last.kg - first.kg) : null,
      count: periodWeights.length,
    },
    coachLogCount,
    notes,
    adherenceLine: input.adherenceLine ?? null,
    generatedAt: input.generatedAt ?? null,
  };
}

/** Разбор сырых записей дневника в сессии отчёта. Терпимо к старым форматам. */
export function readReportSessions(stores: Record<string, unknown[]>): ReportSession[] {
  const finite = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const isoDay = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  };

  const out: ReportSession[] = [];
  const rows = [...(Array.isArray(stores.training_log) ? stores.training_log : [])];
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const date = isoDay(row.date);
    if (!date) continue;
    const exercise = String(row.exerciseName ?? row.exercise ?? row.exerciseId ?? '').trim();
    const sets: ReportSetFact[] = [];
    if (Array.isArray(row.sets)) {
      for (const s of row.sets) {
        const set = (s ?? {}) as Record<string, unknown>;
        const weight = finite(set.weight);
        const reps = finite(set.reps);
        if (weight != null && reps != null && weight > 0 && reps > 0) {
          sets.push({ exercise: exercise || 'упражнение', weight, reps });
        }
      }
    }
    const volume = finite(row.totalVolume);
    const tonnage = sets.length
      ? sets.reduce((sum, s) => sum + s.weight * s.reps, 0)
      : volume != null && volume > 0
        ? volume
        : 0;
    out.push({ date, tonnage: Math.max(0, Math.round(tonnage)), sets });
  }
  if (out.length) return out;

  // Старый формат: сессия с вложенными упражнениями.
  for (const raw of Array.isArray(stores.workout_log) ? stores.workout_log : []) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const date = isoDay(row.date);
    if (!date) continue;
    const sets: ReportSetFact[] = [];
    for (const e of Array.isArray(row.exercises) ? row.exercises : []) {
      const ex = (e ?? {}) as Record<string, unknown>;
      const name = String(ex.name ?? ex.exerciseName ?? ex.exerciseId ?? 'упражнение').trim();
      for (const s of Array.isArray(ex.sets) ? ex.sets : []) {
        const set = (s ?? {}) as Record<string, unknown>;
        const weight = finite(set.weight);
        const reps = finite(set.reps);
        if (weight != null && reps != null && weight > 0 && reps > 0) {
          sets.push({ exercise: name || 'упражнение', weight, reps });
        }
      }
    }
    const tonnage = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
    out.push({ date, tonnage: Math.max(0, Math.round(tonnage)), sets });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Текст и HTML                                                        */
/* ------------------------------------------------------------------ */

const num = (n: number): string => String(n).replace('.', ',');

export function buildCoachReportText(report: CoachReport): string {
  const lines: string[] = [];
  lines.push(`Отчёт: ${report.athlete.name}`);
  lines.push(`Период: ${report.period.label} (${report.period.from} — ${report.period.to})`);
  if (report.athlete.direction) lines.push(`Направление: ${report.athlete.direction}`);
  if (report.athlete.goal) lines.push(`Цель: ${report.athlete.goal}`);
  if (report.athlete.group) lines.push(`Группа: ${report.athlete.group}`);
  lines.push('');

  if (report.sessions === 0) {
    lines.push('Тренировок в дневнике за период нет.');
  } else {
    lines.push(`Тренировок: ${report.sessions} (дней: ${report.trainingDays})`);
    lines.push(`Тоннаж: ${report.tonnage} кг`);
    if (report.adherenceLine) lines.push(report.adherenceLine);
    if (report.exercises.length) {
      lines.push('');
      lines.push('Упражнения за период:');
      for (const e of report.exercises.slice(0, 12)) {
        const best = e.best ? `, лучший подход ${num(e.best.weight)} кг × ${e.best.reps}` : '';
        lines.push(`• ${e.exercise}: ${e.tonnage} кг, подходов ${e.sets}${best}`);
      }
    }
    if (report.personalBests.length) {
      lines.push('');
      lines.push('Лучшие подходы за период, совпавшие с максимумом по записям:');
      for (const b of report.personalBests.slice(0, 12)) {
        lines.push(`• ${b.exercise}: ${num(b.weight)} кг × ${b.reps} (${b.date})`);
      }
      lines.push('Это максимум по записям в дневнике, а не «настоящий ПМ».');
    }
  }

  if (report.weight.count) {
    lines.push('');
    const f = report.weight.first!;
    const l = report.weight.last!;
    lines.push(
      `Вес: ${num(f.kg)} кг (${f.date}) → ${num(l.kg)} кг (${l.date})` +
        (report.weight.changeKg == null ? '' : `, изменение ${report.weight.changeKg > 0 ? '+' : ''}${num(report.weight.changeKg)} кг`),
    );
  }

  if (report.coachLogCount > 0) {
    lines.push('');
    lines.push(`Записей тренера за период: ${report.coachLogCount}`);
  }

  if (report.notes.length) {
    lines.push('');
    lines.push('Заметки тренера:');
    for (const n of report.notes.slice(0, 20)) {
      lines.push(`• ${(n.createdAt ?? '').slice(0, 10)} ${n.title ? `${n.title}: ` : ''}${n.body}`);
    }
  }

  if (report.generatedAt) lines.push('', `Сформировано: ${report.generatedAt}`);
  return lines.join('\n');
}

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function buildCoachReportHtml(report: CoachReport): string {
  const title = `Отчёт: ${esc(report.athlete.name)}`;
  const head = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${title}</title>` +
    '<style>body{font-family:system-ui,sans-serif;margin:24px;color:#111}h1{font-size:20px}h2{font-size:15px;margin-top:20px}' +
    'table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:5px;font-size:12px;text-align:left}' +
    '.muted{color:#666;font-size:12px}</style></head><body>';

  const parts: string[] = [head, `<h1>${title}</h1>`];
  parts.push(
    `<div class="muted">Период: ${esc(report.period.label)} (${esc(report.period.from)} — ${esc(report.period.to)})` +
      (report.athlete.group ? ` · группа: ${esc(report.athlete.group)}` : '') +
      '</div>',
  );
  if (report.athlete.direction || report.athlete.goal) {
    parts.push(
      `<div class="muted">${report.athlete.direction ? `Направление: ${esc(report.athlete.direction)}` : ''}` +
        `${report.athlete.direction && report.athlete.goal ? ' · ' : ''}${report.athlete.goal ? `Цель: ${esc(report.athlete.goal)}` : ''}</div>`,
    );
  }

  if (report.sessions === 0) {
    parts.push('<p>Тренировок в дневнике за период нет.</p>');
  } else {
    parts.push(
      `<h2>Итоги</h2><table><tr><th>Тренировок</th><th>Дней</th><th>Тоннаж, кг</th></tr>` +
        `<tr><td>${report.sessions}</td><td>${report.trainingDays}</td><td>${report.tonnage}</td></tr></table>`,
    );
    if (report.adherenceLine) parts.push(`<p>${esc(report.adherenceLine)}</p>`);

    if (report.exercises.length) {
      const rows = report.exercises
        .slice(0, 20)
        .map(
          e =>
            `<tr><td>${esc(e.exercise)}</td><td>${e.tonnage}</td><td>${e.sets}</td><td>${
              e.best ? `${esc(num(e.best.weight))} × ${e.best.reps}` : '—'
            }</td></tr>`,
        )
        .join('');
      parts.push(
        `<h2>Упражнения за период</h2><table><tr><th>Упражнение</th><th>Тоннаж, кг</th><th>Подходов</th><th>Лучший подход</th></tr>${rows}</table>`,
      );
    }

    if (report.personalBests.length) {
      const rows = report.personalBests
        .slice(0, 20)
        .map(
          b =>
            `<tr><td>${esc(b.exercise)}</td><td>${esc(num(b.weight))} кг × ${b.reps}</td><td>${esc(b.date)}</td></tr>`,
        )
        .join('');
      parts.push(
        `<h2>Максимумы по записям</h2><table><tr><th>Упражнение</th><th>Подход</th><th>Дата</th></tr>${rows}</table>` +
          '<p class="muted">Это максимум по записям в дневнике на этом устройстве, а не «настоящий ПМ».</p>',
      );
    }
  }

  if (report.weight.count) {
    const f = report.weight.first!;
    const l = report.weight.last!;
    const change =
      report.weight.changeKg == null
        ? ''
        : ` · изменение ${report.weight.changeKg > 0 ? '+' : ''}${esc(num(report.weight.changeKg))} кг`;
    parts.push(
      `<h2>Вес</h2><p>${esc(num(f.kg))} кг (${esc(f.date)}) → ${esc(num(l.kg))} кг (${esc(l.date)})${change}</p>`,
    );
  }

  if (report.coachLogCount > 0) {
    parts.push(`<h2>Журнал тренера</h2><p>Записей за период: ${report.coachLogCount}</p>`);
  }

  if (report.notes.length) {
    const rows = report.notes
      .slice(0, 50)
      .map(n => `<tr><td>${esc((n.createdAt ?? '').slice(0, 10))}</td><td>${esc(n.title)}</td><td>${esc(n.body)}</td></tr>`)
      .join('');
    parts.push(
      `<h2>Заметки тренера</h2><table><tr><th>Дата</th><th>Заголовок</th><th>Текст</th></tr>${rows}</table>`,
    );
  }

  if (report.generatedAt) parts.push(`<p class="muted">Сформировано: ${esc(report.generatedAt)}</p>`);
  parts.push('</body></html>');
  return parts.join('');
}

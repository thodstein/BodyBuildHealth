/**
 * bb-visual.engine.ts — Фаза 4: наглядность/экспорт ББ-плана (чистые функции).
 *
 * Содержит data-билдеры для UI-наглядности без затрагивания генерации:
 *  - 19: buildBBMuscleHeatmap — «мышца × неделя» объём с MEV/MAV/MRV статусом
 *  - 21: buildBBTaperCurve — кривая тапера по финальным неделям (объём/intensity/RIR)
 *  - 22: buildBBMesocycleTable — неделя×день×упр×вес/повт/сеты (для «вся таблица» + PDF)
 *  - 23: bbWeekDateRanges — календарные диапазоны недель + «📍 текущая неделя»
 *  - 24: buildBBPlanPrintHtml — стилизованный HTML (цвета фаз/таблицы/heatmap) для печати
 *  - 27: compareBBVariants — по-недельный дифф двух вариантов плана
 */
import type { BBPlan, BBExercise } from './bb-builder.engine';
import { MUSCLE_LABEL_RU } from '../volume-landmarks.engine';
import { bbSessionTagLabel } from './bb-session-tags';

/** Русская подпись мышцы для печати (сырые ключи в печати — дефект: замер
 *  2507/2946 ячеек были ключами `delt_mid`/`back`). Неизвестный ключ не теряем. */
function ruMuscle(muscle: string): string {
  return MUSCLE_LABEL_RU[muscle] || muscle;
}

export const BB_PHASE_COLOR: Record<string, string> = {
  accumulation: '#3b82f6',
  intensification: '#f59e0b',
  deload: '#10b981',
  peaking: '#a855f7',
  taper: '#e11d48',
};

export const BB_PHASE_LABEL_RU: Record<string, string> = {
  accumulation: 'Накопление',
  intensification: 'Интенсификация',
  deload: 'Делод',
  peaking: 'Пик',
  taper: 'Тапер',
};

export interface HeatmapCell {
  week: number;
  phase: string;
  muscle: string;
  sets: number;
  status: 'below_mev' | 'mev_mav' | 'above_mav' | 'over_mrv' | 'none';
}

/**
 * Фаза 4.19: heatmap «мышца × неделя» — прямой объём на мышцу по неделям
 * с классификацией относительно MEV/MAV/MRV (volumeLandmarks плана).
 */
export function buildBBMuscleHeatmap(plan: BBPlan, opts?: { mevByMuscle?: Record<string, number>; mrvByMuscle?: Record<string, number> }): HeatmapCell[] {
  if (!plan?.weeks?.length) return [];
  const mev = opts?.mevByMuscle || {};
  const mrv = opts?.mrvByMuscle || {};
  const landmarks = (plan as any).volumeLandmarks as Array<{ muscle: string; mev: number; mav: number; mrv: number }> | undefined;
  const lmFor = (m: string) => landmarks?.find(l => l.muscle === m);
  // Источник цифры — снимок факта плана (`weeklyVolume`, пересчитывается
  // последним, см. bb-plan-snapshot.engine). Раньше здесь считались СЫРЫЕ сеты
  // по полю `e.muscle`, и это расходилось с планом: замер на ppl_6 — 4/28 ячеек
  // врали (`shoulders` 12 против факта 3 прямых / 9.8 эффективных, `delt_rear`
  // 6 против 12). Причина — паритет пулов: упражнение с меткой `shoulders` может
  // быть задней дельтой, и `aggregateBBVolume` раскладывает его по пучкам.
  // Теперь берём ту же величину, что валидатор/качество: ЭФФЕКТИВНЫЕ сеты
  // (прямые + дробные косвенные) — именно к ним относятся MEV/MAV/MRV.
  const snapshot = (plan as any).weeklyVolume as Record<string, Record<string, any>> | undefined;
  const out: HeatmapCell[] = [];
  for (const w of plan.weeks) {
    const byMuscle: Record<string, number> = {};
    const weekSnap = snapshot?.[w.week];
    if (weekSnap && Object.keys(weekSnap).length > 0) {
      for (const [m, v] of Object.entries(weekSnap)) {
        const sets = Math.round(Number((v as any)?.effectiveSets ?? (v as any)?.directSets ?? 0));
        if (sets > 0) byMuscle[m] = sets;
      }
    } else {
      // Планы без снимка (ручные/импортированные) — прямой счёт по мышце упражнения.
      for (const s of w.sessions) {
        for (const e of s.exercises) {
          if ((e as any).warmupActivator) continue;
          const m = e.muscle || '';
          if (!m) continue;
          byMuscle[m] = (byMuscle[m] || 0) + (e.sets || 0);
        }
      }
    }
    for (const [muscle, sets] of Object.entries(byMuscle)) {
      const lm = lmFor(muscle);
      const mevV = lm?.mev ?? mev[muscle];
      const mrvV = lm?.mrv ?? mrv[muscle];
      const mavV = lm?.mav;
      let status: HeatmapCell['status'] = 'none';
      if (mevV != null && mrvV != null) {
        if (sets < mevV) status = 'below_mev';
        else if (mavV != null && sets > mrvV) status = 'over_mrv';
        else if (mavV != null && sets > mavV) status = 'above_mav';
        else status = 'mev_mav';
      }
      out.push({ week: w.week, phase: String((w as any).phase || 'accumulation'), muscle, sets, status });
    }
  }
  return out;
}

export interface TaperCurvePoint {
  week: number;
  volumePct: number;
  intensityPct: number;
  rir: [number, number];
  label: string;
  phase: string;
}

/** Фаза 4.21: кривая тапера по финальным неделям (объём/intensity/RIR) из недель плана. */
export function buildBBTaperCurve(plan: BBPlan): TaperCurvePoint[] {
  if (!plan?.weeks?.length) return [];
  return plan.weeks
    .filter(w => (w as any).taper || (w as any).peakWeek || (w as any).contestPhase === 'taper' || (w as any).contestPhase === 'peak_week')
    .map(w => {
      const vol = (w as any).volumePct ?? 1;
      const rir: [number, number] = [(w as any).rirMin ?? 0, (w as any).rirMax ?? 0];
      return {
        week: w.week,
        volumePct: Number(vol),
        intensityPct: Number((w as any).intensityPct ?? 1),
        rir,
        label: String((w as any).prepProtocol || (w as any).phase || 'taper'),
        phase: String((w as any).phase || (w as any).contestPhase || 'taper'),
      };
    });
}

export interface BBFitnessFatiguePoint {
  date: string;
  fitness: number;
  fatigue: number;
  performance: number;
}

/**
 * Фаза 4.20: прогноз утомления fitness–fatigue (модель Банистера) по неделям плана.
 * Нагрузка = недельный объём (рабочие сеты); fitness и fatigue — экспоненциальные
 * следы (tau_fit ≈ 42 дня, tau_fat ≈ 7 дней), performance = fitness − fatigue.
 * Берётся от даты старта (или с 1 января для относительного ряда).
 */
export function buildBBFitnessFatigue(plan: BBPlan, opts?: { startDate?: string }): BBFitnessFatiguePoint[] {
  if (!plan?.weeks?.length) return [];
  const weeklyLoad = plan.weeks.map(w => (w.sessions || []).reduce((a, s) => a + (s.exercises || []).reduce((b, e) => b + (e.sets || 0), 0), 0));
  const start = opts?.startDate || '2026-01-01';
  const addDays = (iso: string, d: number): string => {
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    const dt = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(NaN);
    if (Number.isNaN(dt.getTime())) return iso;
    dt.setDate(dt.getDate() + d);
    const y = dt.getFullYear(); const mo = String(dt.getMonth() + 1).padStart(2, '0'); const da = String(dt.getDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
  };
  const TAU_FIT = 42; const TAU_FAT = 7;
  const kFit = 1 - Math.exp(-7 / TAU_FIT); const kFat = 1 - Math.exp(-7 / TAU_FAT);
  let fitness = 0, fatigue = 0;
  return weeklyLoad.map((load, i) => {
    fitness = fitness * (1 - kFit) + load * kFit;
    fatigue = fatigue * (1 - kFat) + load * kFat;
    return { date: addDays(start, i * 7), fitness: Math.round(fitness * 10) / 10, fatigue: Math.round(fatigue * 10) / 10, performance: Math.round((fitness - fatigue) * 10) / 10 };
  });
}

export interface MesocycleRow {
  week: number;
  phase: string;
  day: number;
  character: string;
  exercises: Array<{ name: string; muscle: string; sets: number; reps: number; weight: number; rir: number; rest: number; technique?: string; progression?: string; superset?: string }>;
}

/** Фаза 4.22: вся таблица мезоцикла неделя×день×упр×вес/повт/сеты. */
export function buildBBMesocycleTable(plan: BBPlan): MesocycleRow[] {
  if (!plan?.weeks?.length) return [];
  const rows: MesocycleRow[] = [];
  for (const w of plan.weeks) {
    for (const s of w.sessions || []) {
      rows.push({
        week: w.week,
        phase: String((w as any).phase || 'accumulation'),
        day: s.weekOffset ?? s.day ?? 0,
        character: s.character || '',
        exercises: (s.exercises || []).map((e: BBExercise) => {
          const ws = (e.workSets || [])[0] || ({} as any);
          // D-2 (итерация C): техника последнего подхода и правило прогрессии —
          // чтобы распечатка работала как бумажный лог, а не только как список.
          const lastSet = (e.workSets || [])[(e.workSets || []).length - 1] as any;
          const technique = String(lastSet?.technique || (e as any).technique || '').trim();
          return {
            name: e.exerciseName || e.name || '',
            muscle: e.muscle || '',
            sets: e.sets || (e.workSets?.length || 0),
            reps: ws.reps ?? e.repsRange?.[0] ?? 0,
            weight: ws.weight ?? 0,
            rir: ws.rir ?? e.rir ?? 0,
            rest: ws.restSeconds ?? e.restSeconds ?? 0,
            technique: technique || undefined,
            progression: (e as any).progressionRule || undefined,
            superset: (e as any).supersetGroup != null ? `${(e as any).supersetSlot === 1 ? 'B' : 'A'}${(e as any).supersetGroup}` : undefined,
          };
        }),
      });
    }
  }
  return rows;
}

export interface WeekDateRange {
  week: number;
  start: string;
  end: string;
  isCurrent: boolean;
}

/** Фаза 4.23: календарные диапазоны недель от даты старта + «📍 текущая неделя». */
export function bbWeekDateRanges(plan: BBPlan, opts?: { startDate?: string; referenceDate?: string }): WeekDateRange[] {
  if (!plan?.weeks?.length) return [];
  const start = opts?.startDate || (plan as any).planStartWeek;
  const ref = opts?.referenceDate;
  if (!start) {
    // Без даты — только пометка фазы (диапазоны не вычислимы).
    return plan.weeks.map(w => ({ week: w.week, start: '', end: '', isCurrent: false }));
  }
  const refStr = ref || new Date().toISOString().slice(0, 10);
  return plan.weeks.map(w => {
    const s = addDaysIso(start, (w.week - 1) * 7);
    const e = addDaysIso(start, (w.week - 1) * 7 + 6);
    return { week: w.week, start: s, end: e, isCurrent: refStr >= s && refStr <= e };
  });
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Фаза 4.24: стилизованный print HTML (цвета фаз, таблица мезоцикла, heatmap) вместо <pre>. */
export function buildBBPlanPrintHtml(plan: BBPlan, opts?: { heatmap?: boolean }): string {
  const title = esc(plan.pattern?.name || 'BB-план');
  const rows = buildBBMesocycleTable(plan);
  const heatmap = opts?.heatmap !== false ? buildBBMuscleHeatmap(plan) : [];
  // Печать — для человека и тренера: сырые ключи (`delt_mid`, `back`) и
  // английский уровень в ней недопустимы. Замер до правки: 2507 из 2946 ячеек
  // мышц печатались ключами, 16/16 планов печатали `Level: advanced`.
  const LEVEL_RU: Record<string, string> = { beginner: 'Новичок', intermediate: 'Средний', advanced: 'Опытный', enhanced: 'Enhanced (фарма)' };
  const phases = new Set(rows.map(r => r.phase));
  const phaseLegend = [...phases].map(p => `<span style="margin-right:10px"><i style="display:inline-block;width:10px;height:10px;background:${BB_PHASE_COLOR[p] || '#888'};border-radius:2px"></i> ${esc(BB_PHASE_LABEL_RU[p] || p)}</span>`).join('');
  const weeksHtml = rows.map(r => {
    const pc = BB_PHASE_COLOR[r.phase] || '#888';
    const exercises = r.exercises.map(ex => `<tr><td>${esc(ex.name)}${ex.superset ? ` <b style="color:#a855f7">🔗${esc(ex.superset)}</b>` : ''}</td><td>${esc(ruMuscle(ex.muscle))}</td><td>${ex.sets}</td><td>${ex.reps}</td><td>${ex.weight}</td><td>${ex.rir}</td><td>${ex.rest}</td><td style="font-size:9px">${esc(ex.technique || '')}</td><td style="font-size:9px">${esc(ex.progression || '')}</td><td style="border-left:1px solid #999;min-width:70px">&nbsp;</td></tr>`).join('');
    return `<h3 style="margin:14px 0 4px;color:${pc}">Неделя ${r.week} · ${esc(r.phase)} · День ${r.day} (${esc(r.character)})</h3>
      <table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:11px">
        <thead><tr style="background:#f4f4f5"><th>Упражнение</th><th>Мышца</th><th>Сеты</th><th>Повт</th><th>Вес</th><th>RIR</th><th>Отдых</th><th>Техника</th><th>Прогрессия</th><th>Факт (вес×повт)</th></tr></thead>
        <tbody>${exercises}</tbody></table>`;
  }).join('');
  const heatmapHtml = heatmap.length ? (() => {
    const weeks = [...new Set(heatmap.map(h => h.week))].sort((a, b) => a - b);
    const muscles = [...new Set(heatmap.map(h => h.muscle))];
    const color: Record<string, string> = { below_mev: '#f87171', mev_mav: '#22c55e', above_mav: '#f59e0b', over_mrv: '#ef4444', none: '#e5e7eb' };
    const header = `<th>Мышца</th>${weeks.map(w => `<th>Нед ${w}</th>`).join('')}`;
    const body = muscles.map(m => {
      const cells = weeks.map(w => {
        const cell = heatmap.find(h => h.muscle === m && h.week === w);
        const bg = cell ? color[cell.status] : '#fafafa';
        return `<td style="background:${bg};text-align:center">${cell ? cell.sets : ''}</td>`;
      }).join('');
      return `<tr><td>${esc(ruMuscle(m))}</td>${cells}</tr>`;
    }).join('');
    return `<h3 style="margin:16px 0 4px">🧬 Heatmap «мышца × неделя»</h3><table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-size:11px"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
  })() : '';
  const levelLine = plan.level ? (LEVEL_RU[String(plan.level)] || String(plan.level)) : '';
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,Arial,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#111;font-size:12px}
h1{font-size:18px}h2{font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px}@media print{body{font-size:10px}}</style>
</head><body><h1>${title} — ${plan.weeks.length} нед</h1>
<div style="margin:8px 0">${phaseLegend}</div>
<div style="margin:4px 0 0;color:#666;font-size:11px">Уровень: ${esc(levelLine)} · MRV×${esc((plan as any).mrvMultiplier ?? 1)}</div>
<h2>📋 Таблица мезоцикла</h2>${weeksHtml}${heatmapHtml}</body></html>`;
}

/** Сдвиг ISO-даты (`YYYY-MM-DD`) на N дней. Один календарный канон на модуль. */
function addDaysIso(iso: string, days: number): string {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(dt.getTime())) return '';
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const da = String(dt.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** Фаза 4.24: обычный план → .ics (события по неделям/дням).
 *
 * Каждая СЕССИЯ — отдельное событие в свой день недели. Раньше все сессии
 * недели получали один и тот же `DTSTART` (дата начала недели, 10:00Z), то есть
 * 6-дневный сплит на 2 недели давал 12 событий в 2 датах внахлёст, и обещание
 * «календарь по неделям/дням» было неправдой. День берём из `session.day`
 * (1..7 внутри недели, его же использует плеер), с фолбэком на порядковый номер.
 * `DTEND` = +1 час: событие нулевой длины календарь показывает как «весь день»/
 * пустую запись. */
/**
 * Текст значения свойства ICS (RFC 5545 §3.3.11): экранируются `\`, `;`, `,`
 * и переводы строк. Раньше заголовок прогонялся через `uid()` (замена всего
 * не-ASCII на `_`), из-за чего «тяж» превращался в `___` — замер: 12 из 12
 * событий календаря содержали искалеченный текст.
 */
function icsText(value: string): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Складывание строки в 75 октетов UTF-8 с продолжением `CRLF + пробел`
 *  (RFC 5545 §3.1). Русский заголовок длиннее лимита — без складывания
 *  некоторые клиенты обрезают событие. */
function foldIcsLine(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = enc.encode(ch).length;
    // Первая строка — 75 октетов, продолжения начинаются с пробела (74).
    const limit = parts.length ? 74 : 75;
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function buildBBPlanIcs(plan: BBPlan, opts?: { startDate?: string }): string {
  if (!plan?.weeks?.length) return '';
  const ranges = bbWeekDateRanges(plan, { startDate: opts?.startDate });
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BB-auto//RU//EN', 'CALSCALE:GREGORIAN',
  ];
  // uid() — только для UID (там ASCII обязателен), НЕ для текста события.
  const uid = (n: string) => String(n).replace(/[^A-Za-z0-9_-]/g, '_');
  plan.weeks.forEach((w, i) => {
    const r = ranges[i];
    if (!r || !r.start) return;
    (w.sessions || []).forEach((s, si) => {
      // Пустой день («😴 Полный отдых») в календарь не пишем: событие
      // «тренировка» на день отдыха — ложное напоминание.
      if (!((s as any).exercises || []).length) return;
      // 1..7 — внутри недели, чтобы событие не уехало в следующую неделю плана.
      const dayIdx = Math.min(7, Math.max(1, Number((s as any).day) || si + 1));
      const date = addDaysIso(r.start, dayIdx - 1);
      if (!date) return;
      const stamp = date.replace(/-/g, '');
      const tag = bbSessionTagLabel((s as any).sessionTag);
      const character = String((s as any).character || '').trim();
      // Человеческий заголовок: неделя · день · характер. Английский тег
      // («Push») и заменённые на `_` кириллические символы — дефект.
      const title = [
        `Неделя ${w.week}`,
        tag || character || 'Тренировка',
        character && tag ? character : '',
      ].filter(Boolean).join(' · ');
      lines.push('BEGIN:VEVENT');
      lines.push(foldIcsLine(`SUMMARY:${icsText(title)}`));
      lines.push(`DTSTART:${stamp}T100000Z`);
      lines.push(`DTEND:${stamp}T110000Z`);
      lines.push(`UID:bb-${w.week}-${(s as any).weekOffset ?? dayIdx}@bb-auto`);
      lines.push('END:VEVENT');
    });
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export interface BBVariantDiff {
  week: number;
  changes: number;
  detail: string[];
}

/** Фаза 4.27: по-недельный дифф двух вариантов плана. */
export function compareBBVariants(a: BBPlan, b: BBPlan): BBVariantDiff[] {
  if (!a?.weeks?.length || !b?.weeks?.length) return [];
  const out: BBVariantDiff[] = [];
  const weeks = Math.max(a.weeks.length, b.weeks.length);
  for (let wi = 0; wi < weeks; wi++) {
    const wa = a.weeks[wi]; const wb = b.weeks[wi];
    const detail: string[] = [];
    if (!wa || !wb) { detail.push(wa ? 'Неделя удалена' : 'Неделя добавлена'); }
    else {
      const sa = (wa.sessions || []).reduce((s, x) => s + x.exercises.reduce((a2, e) => a2 + (e.sets || 0), 0), 0);
      const sb = (wb.sessions || []).reduce((s, x) => s + x.exercises.reduce((a2, e) => a2 + (e.sets || 0), 0), 0);
      if (sa !== sb) detail.push(`Объём: ${sa} → ${sb} сетов (${sb > sa ? '+' : ''}${sb - sa})`);
      const phaseA = String((wa as any).phase || '');
      const phaseB = String((wb as any).phase || '');
      if (phaseA !== phaseB) detail.push(`Фаза: ${esc(phaseA || '—')} → ${esc(phaseB || '—')}`);
    }
    out.push({ week: wi + 1, changes: detail.length, detail });
  }
  return out;
}

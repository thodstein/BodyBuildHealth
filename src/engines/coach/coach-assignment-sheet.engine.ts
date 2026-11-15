/**
 * coach-assignment-sheet.engine.ts — лист назначения атлету (одна страница → PDF).
 *
 * ЗАЧЕМ. Тренер выдаёт тренировку, рацион и БАДы в разных местах, а человеку
 * нужно одно: «вот что делать и что сдать». Здесь всё сводится в документ,
 * который печатается из приложения (в APK — HTML-файл в Share, в web — диалог
 * печати → «Сохранить как PDF»).
 *
 * ЧЕСТНЫЕ ГРАНИЦЫ:
 *  • собираем только то, что реально лежит в пространстве атлета и в назначениях
 *    тренера; «нет данных» печатаем словами, а не пустой строкой;
 *  • не придумываем дозировки, нормы и сроки — их пишет тренер;
 *  • весь пользовательский текст экранируется: имена и комментарии — не разметка;
 *  • один документ = одна страница на печати (блок не «расползается» по листам).
 */
import { toPhysicalKey } from '../../core/data-space';
import {
  collectProgramBundle,
  describeProgramBundle,
  type ProgramStorageLike,
} from './coach-program-bundle.engine';

/* ─────────────────────────── модель ─────────────────────────── */

export interface SheetAthlete {
  name: string;
  sex: 'male' | 'female' | 'unspecified';
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  direction: string;
  goal: string;
  group: string;
  contact: string;
  startedAt: string;
}

export interface SheetNutritionPlan {
  name: string;
  date: string;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
}

export interface SheetNutrition {
  plans: SheetNutritionPlan[];
  /** Сколько рационов всего (в листе показываем первые три). */
  total: number;
  targets: { kcal: number; protein: number; fat: number; carbs: number } | null;
  /** Что ещё есть в назначении, но не печатается построчно (ограничения). */
  notes: string[];
}

export interface SheetLabOrder {
  markers: string[];
  dueDate: string;
  comment: string;
  done: boolean;
}

/**
 * Курс — строки, уже собранные вызывающим кодом: он один знает, что именно
 * записано в базе атлета (препараты живут в IndexedDB, а не в localStorage).
 */
export interface SheetCourse {
  /** `YYYY-MM-DD` или `''`. */
  startDate: string;
  /** «Тестостерон энантат 500 мг · 2/нед · недели 1–12». */
  lines: string[];
}

export interface AssignmentSheetInput {
  athlete: SheetAthlete;
  /** `YYYY-MM-DD` — дата документа. */
  date: string;
  training: { parts: string[] } | null;
  nutrition: SheetNutrition | null;
  /** Имена БАДов (id уже развёрнуты вызывающим кодом). */
  supplements: string[];
  course: SheetCourse | null;
  labs: SheetLabOrder[];
  coachNote: string;
}

/* ─────────────────────────── утилиты ─────────────────────────── */

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const ruDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

const sexLabel = (sex: SheetAthlete['sex']): string =>
  sex === 'male' ? 'муж' : sex === 'female' ? 'жен' : '';

const pluralYears = (n: number): string => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'год';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'года';
  return 'лет';
};

/** «жен · 27 лет · 82 кг · 178 см · группа: вечерняя» — только то, что указано. */
export function athleteFacts(a: SheetAthlete): string[] {
  const out: string[] = [];
  const sex = sexLabel(a.sex);
  if (sex) out.push(sex);
  if (a.age) out.push(`${a.age} ${pluralYears(a.age)}`);
  if (a.weightKg) out.push(`${a.weightKg} кг`);
  if (a.heightCm) out.push(`${a.heightCm} см`);
  if (a.group) out.push(`группа: ${a.group}`);
  return out;
}

/* ─────────────────────────── сбор источников ─────────────────────────── */

export interface AssignmentSheetSources {
  training: { parts: string[] } | null;
  nutrition: SheetNutrition | null;
  /** id протокола БАДов: имена разворачивает вызывающий (каталог тяжёлый). */
  supplementIds: string[];
  /** Дата старта курса из `he_course_start_date` (сырая строка, не JSON). */
  courseStartDate: string;
}

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

const readJson = (storage: StorageLike | null, spaceId: string, key: string): unknown => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(toPhysicalKey(spaceId, key));
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

/** Ключи, которые приложение хранит сырой строкой (`he_course_start_date`). */
const readRaw = (storage: StorageLike | null, spaceId: string, key: string): string => {
  if (!storage) return '';
  try {
    const raw = storage.getItem(toPhysicalKey(spaceId, key));
    return typeof raw === 'string' ? raw : '';
  } catch {
    return '';
  }
};

/** Рационы: имя, дата и КБЖУ первого дня — без чтения базы и тяжёлых движков. */
function summarizeNutrition(raw: unknown): { plans: SheetNutritionPlan[]; total: number } {
  if (!Array.isArray(raw)) return { plans: [], total: 0 };
  const rows: SheetNutritionPlan[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const day = (r.dayPlan && typeof r.dayPlan === 'object' ? r.dayPlan : {}) as Record<string, unknown>;
    const totals = (day.totals && typeof day.totals === 'object' ? day.totals : {}) as Record<string, unknown>;
    rows.push({
      name: typeof r.name === 'string' && r.name ? r.name : 'Рацион',
      date: typeof r.date === 'string' ? r.date : '',
      kcal: num(totals.kcal),
      protein: num(totals.p ?? totals.protein),
      fat: num(totals.f ?? totals.fat),
      carbs: num(totals.c ?? totals.carbs),
    });
  }
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return { plans: rows.slice(0, 3), total: rows.length };
}

/**
 * Собрать то, что лежит в пространстве атлета. Ничего не пересчитываем: только
 * читаем и ужимаем до того, что влезет в один лист.
 */
export function collectAssignmentSheetSources(
  storage: StorageLike | null | undefined,
  spaceId: string,
): AssignmentSheetSources {
  const store = storage ?? null;
  // `collectProgramBundle` в режиме сбора читает только `getItem`; set/remove ему
  // здесь не нужны, поэтому сужаем тип честно, а не глушим проверку целиком.
  const program = collectProgramBundle(store as ProgramStorageLike | null, spaceId);
  const programSummary = describeProgramBundle(program);
  const nutritionRaw = readJson(store, spaceId, 'he_saved_nutrition_plans');
  const summary = summarizeNutrition(nutritionRaw);

  const targetsRaw = readJson(store, spaceId, 'he_plan_kbju_targets');
  let targets: SheetNutrition['targets'] = null;
  if (targetsRaw && typeof targetsRaw === 'object') {
    const t = targetsRaw as Record<string, unknown>;
    const kcal = num(t.kcal);
    const protein = num(t.protein);
    const fat = num(t.fats ?? t.fat);
    const carbs = num(t.carbs);
    if (kcal) targets = { kcal, protein: protein ?? 0, fat: fat ?? 0, carbs: carbs ?? 0 };
  }

  const notes: string[] = [];
  const countKeys = (key: string, label: string) => {
    const raw = readJson(store, spaceId, key);
    if (Array.isArray(raw) && raw.length) notes.push(`${label}: ${raw.length}`);
  };
  countKeys('he_excluded_foods', 'Исключено продуктов');
  countKeys('he_food_allergens', 'Аллергены');
  countKeys('he_intolerances', 'Непереносимости');

  const hasNutrition = summary.total > 0 || !!targets || notes.length > 0;

  const planIdsRaw = readJson(store, spaceId, 'he_support_plan_result');
  const supplementIds: string[] = [];
  if (Array.isArray(planIdsRaw)) {
    for (const v of planIdsRaw) {
      if (typeof v === 'string' && v) supplementIds.push(v);
      else if (v && typeof v === 'object') {
        const id = (v as Record<string, unknown>).id;
        if (typeof id === 'string' && id) supplementIds.push(id);
      }
    }
  }

  return {
    training: programSummary.keys > 0 ? { parts: programSummary.parts } : null,
    nutrition: hasNutrition
      ? {
          plans: summary.plans,
          total: summary.total,
          targets,
          notes,
        }
      : null,
    supplementIds: [...new Set(supplementIds)],
    courseStartDate: readRaw(store, spaceId, 'he_course_start_date'),
  };
}

/* ─────────────────────────── текст ─────────────────────────── */

const planLine = (p: SheetNutritionPlan): string => {
  const macros: string[] = [];
  if (p.kcal) macros.push(`${p.kcal} ккал`);
  if (p.protein) macros.push(`Б ${p.protein}`);
  if (p.fat) macros.push(`Ж ${p.fat}`);
  if (p.carbs) macros.push(`У ${p.carbs}`);
  const when = p.date ? ` (${ruDate(p.date)})` : '';
  return `${p.name}${when}${macros.length ? `: ${macros.join(' · ')}` : ''}`;
};

export function buildAssignmentSheetText(input: AssignmentSheetInput): string {
  const lines: string[] = [];
  lines.push(`ЛИСТ НАЗНАЧЕНИЯ · ${ruDate(input.date)}`);
  const facts = athleteFacts(input.athlete);
  lines.push(`Атлет: ${input.athlete.name}${input.athlete.direction ? ` · ${input.athlete.direction}` : ''}`);
  if (facts.length) lines.push(facts.join(' · '));
  if (input.athlete.goal) lines.push(`Цель: ${input.athlete.goal}`);
  lines.push('');

  lines.push('ТРЕНИРОВКА');
  if (input.training && input.training.parts.length) {
    lines.push(`Блок: ${input.training.parts.join(', ')}`);
  } else {
    lines.push('Не назначена.');
  }
  lines.push('');

  lines.push('ПИТАНИЕ');
  if (input.nutrition) {
    const n = input.nutrition;
    if (n.plans.length) {
      for (const p of n.plans) lines.push(`• ${planLine(p)}`);
      if (n.total > n.plans.length) lines.push(`…и ещё ${n.total - n.plans.length} — в приложении.`);
    }
    if (n.targets) {
      lines.push(
        `Цели дня: ${n.targets.kcal} ккал · Б ${n.targets.protein} · Ж ${n.targets.fat} · У ${n.targets.carbs}`,
      );
    }
    for (const note of n.notes) lines.push(note);
    if (!n.plans.length && !n.targets && !n.notes.length) lines.push('Нет данных.');
  } else {
    lines.push('Не назначено.');
  }
  lines.push('');

  lines.push('БАДЫ');
  if (input.supplements.length) {
    for (const s of input.supplements) lines.push(`• ${s}`);
  } else {
    lines.push('Не назначены.');
  }
  lines.push('');

  lines.push('КУРС');
  if (input.course && (input.course.startDate || input.course.lines.length)) {
    const c = input.course;
    if (c.startDate) lines.push(`Старт: ${ruDate(c.startDate)}`);
    if (c.lines.length) for (const line of c.lines) lines.push(`• ${line}`);
    else lines.push('Препараты не указаны.');
  } else {
    lines.push('Не назначен.');
  }
  lines.push('');

  lines.push('АНАЛИЗЫ');
  if (input.labs.length) {
    for (const o of input.labs) {
      const due = o.dueDate ? ` — срок ${ruDate(o.dueDate)}` : '';
      const mark = o.done ? ' (сдано)' : '';
      lines.push(`• ${o.markers.join(', ')}${due}${mark}`);
      if (o.comment) lines.push(`  ${o.comment}`);
    }
  } else {
    lines.push('Не назначены.');
  }

  if (input.coachNote) {
    lines.push('');
    lines.push('КОММЕНТАРИЙ ТРЕНЕРА');
    lines.push(input.coachNote);
  }

  lines.push('');
  lines.push('Документ сформирован в приложении BodyBuildHealth. Это план работы, а не медицинское назначение.');
  return lines.join('\n');
}

/* ─────────────────────────── HTML ─────────────────────────── */

function section(title: string, bodyHtml: string): string {
  return `<section><h2>${esc(title)}</h2>${bodyHtml}</section>`;
}

function listOrEmpty(items: string[], empty: string): string {
  if (!items.length) return `<p class="empty">${esc(empty)}</p>`;
  return `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
}

export function buildAssignmentSheetHtml(input: AssignmentSheetInput): string {
  const a = input.athlete;
  const facts = athleteFacts(a);
  const head = [
    `<h1>Лист назначения <span class="date">${esc(ruDate(input.date))}</span></h1>`,
    `<div class="who"><strong>${esc(a.name)}</strong>${
      a.direction ? ` · ${esc(a.direction)}` : ''
    }${a.contact ? ` · ${esc(a.contact)}` : ''}</div>`,
    facts.length ? `<div class="facts">${esc(facts.join(' · '))}</div>` : '',
    a.goal ? `<div class="goal"><span>Цель:</span> ${esc(a.goal)}</div>` : '',
  ].join('');

  const trainingHtml = input.training && input.training.parts.length
    ? `<p>Блок: ${esc(input.training.parts.join(', '))}</p>`
    : '<p class="empty">Не назначена.</p>';

  let nutritionHtml = '<p class="empty">Не назначено.</p>';
  if (input.nutrition) {
    const n = input.nutrition;
    const parts: string[] = [];
    if (n.plans.length) {
      const rows = n.plans.map(p => {
        const macros = [
          p.kcal ? `${p.kcal} ккал` : '',
          p.protein ? `Б ${p.protein}` : '',
          p.fat ? `Ж ${p.fat}` : '',
          p.carbs ? `У ${p.carbs}` : '',
        ].filter(Boolean).join(' · ');
        return `<tr><td>${esc(p.name)}</td><td>${esc(p.date ? ruDate(p.date) : '—')}</td><td>${esc(macros || '—')}</td></tr>`;
      }).join('');
      parts.push(
        `<table class="plans"><thead><tr><th>Рацион</th><th>Дата</th><th>На день</th></tr></thead><tbody>${rows}</tbody></table>`,
      );
      if (n.total > n.plans.length) {
        parts.push(`<p class="more">…и ещё ${n.total - n.plans.length} — в приложении.</p>`);
      }
    }
    if (n.targets) {
      parts.push(
        `<p class="targets">Цели дня: <strong>${n.targets.kcal} ккал</strong> · Б ${n.targets.protein} · Ж ${n.targets.fat} · У ${n.targets.carbs}</p>`,
      );
    }
    if (n.notes.length) parts.push(listOrEmpty(n.notes.map(x => x), 'Нет данных'));
    nutritionHtml = parts.join('') || '<p class="empty">Нет данных.</p>';
  }

  const supplementsHtml = listOrEmpty(input.supplements, 'Не назначены.');

  const courseHtml =
    input.course && (input.course.startDate || input.course.lines.length)
      ? [
          input.course.startDate ? `<p>Старт: <strong>${esc(ruDate(input.course.startDate))}</strong></p>` : '',
          input.course.lines.length
            ? `<ul>${input.course.lines.map(line => `<li>${esc(line)}</li>`).join('')}</ul>`
            : '<p class="empty">Препараты не указаны.</p>',
        ].join('')
      : '<p class="empty">Не назначен.</p>';

  const labsHtml = input.labs.length
    ? `<ul class="labs">${input.labs
        .map(o => {
          const due = o.dueDate ? ` <span class="due">срок ${esc(ruDate(o.dueDate))}</span>` : '';
          const done = o.done ? ' <span class="done">сдано</span>' : '';
          const comment = o.comment ? `<div class="comment">${esc(o.comment)}</div>` : '';
          return `<li>${esc(o.markers.join(', '))}${due}${done}${comment}</li>`;
        })
        .join('')}</ul>`
    : '<p class="empty">Не назначены.</p>';

  const noteHtml = input.coachNote
    ? section('Комментарий тренера', `<p class="note">${esc(input.coachNote).replace(/\n/g, '<br/>')}</p>`)
    : '';

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"/>
<title>Лист назначения — ${esc(a.name)} — ${esc(ruDate(input.date))}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", system-ui, sans-serif; color: #111; margin: 0; padding: 0; font-size: 12px; line-height: 1.45; }
  h1 { font-size: 19px; margin: 0 0 6px; letter-spacing: -0.2px; }
  h1 .date { font-size: 12px; font-weight: 600; color: #666; float: right; }
  .who { font-size: 14px; font-weight: 700; }
  .facts { color: #555; font-size: 11.5px; }
  .goal { color: #333; font-size: 11.5px; margin-top: 2px; }
  .goal span { color: #666; }
  section { margin-top: 12px; border-top: 1px solid #e5e5e5; padding-top: 8px; page-break-inside: avoid; }
  h2 { font-size: 11px; letter-spacing: 0.8px; text-transform: uppercase; color: #666; margin: 0 0 5px; }
  p { margin: 0 0 4px; }
  ul { margin: 0; padding-left: 16px; }
  li { margin-bottom: 2px; }
  .empty { color: #888; font-style: italic; }
  .more { color: #888; font-size: 11px; }
  table.plans { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  table.plans th, table.plans td { text-align: left; border-bottom: 1px solid #eee; padding: 3px 4px; font-size: 11.5px; }
  table.plans th { color: #666; font-weight: 600; }
  .targets { font-size: 11.5px; }
  .due { color: #b45309; font-weight: 600; }
  .done { color: #047857; font-weight: 600; }
  .comment { color: #555; font-size: 11px; }
  .note { white-space: normal; }
  .foot { margin-top: 14px; border-top: 1px solid #e5e5e5; padding-top: 6px; color: #888; font-size: 10px; }
</style></head>
<body>
${head}
${section('Тренировка', trainingHtml)}
${section('Питание', nutritionHtml)}
${section('БАДы', supplementsHtml)}
${section('Курс', courseHtml)}
${section('Анализы', labsHtml)}
${noteHtml}
<div class="foot">Документ сформирован в приложении BodyBuildHealth. Это план работы, а не медицинское назначение.</div>
</body></html>`;
}

/** Имя файла для печати/шаринга: без пробелов и запрещённых символов. */
export function assignmentSheetFileName(athleteName: string, date: string): string {
  const safe = (athleteName || 'атлет').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40);
  return `assignment-${safe}-${date}.html`;
}

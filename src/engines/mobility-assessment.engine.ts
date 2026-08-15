/**
 * Mobility Assessment Engine — объективная оценка мобильности в дневнике тренировок.
 *
 * 6 FMS-подобных тестов (источник: методики Библиотеки + классика FMS, Gray Cook):
 * присед с руками над головой, Thomas-тест, сгибание плеч у стены, наклон вперёд,
 * ASLR, ротация грудного отдела. Каждый тест оценивается 0/1/2 (не проходит /
 * частично / проходит) — сумма 0-12.
 *
 * Оценки копятся по датам в he_mobility_assessments (upsert по дате, кап 200),
 * тренд «последняя vs предыдущая» даёт динамику по зонам, слабые тесты
 * превращаются в корректирующие блоки для протокола мобильности.
 *
 * Отображение-онли: движок НЕ влияет на планирование/авторегуляцию.
 *
 * @module mobility-assessment-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/** 0 = не проходит, 1 = частично, 2 = проходит. */
export type AssessmentScore = 0 | 1 | 2;

export interface CorrectiveExercise {
  name: string;
  detail: string;
}

export interface MobilityTest {
  id: string;
  title: string;
  /** Зона тела (для чипов и слабых зон). */
  area: string;
  areaIcon: string;
  instructions: string;
  passCriteria: string;
  failHint: string;
  corrective: CorrectiveExercise[];
  relatedExercises: string[];
}

export interface AssessmentEntry {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** testId → 0|1|2 (только проставленные). */
  scores: Record<string, AssessmentScore>;
  note?: string;
}

export interface AssessmentSummary {
  total: number;
  max: number;
  pct: number;
  counts: { pass: number; partial: number; fail: number; scored: number };
  weakest: { test: MobilityTest; score: AssessmentScore }[];
}

export interface AssessmentTrend {
  current: AssessmentEntry | null;
  previous: AssessmentEntry | null;
  deltaTotal: number | null;
  perTest: { testId: string; title: string; area: string; current: AssessmentScore | null; previous: AssessmentScore | null; delta: number | null }[];
  /** Сумма баллов по всем оценкам (для графика истории). */
  history: { date: string; total: number }[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

export const MOBILITY_TESTS: MobilityTest[] = [
  {
    id: 'deep_squat',
    title: 'Присед с руками над головой',
    area: 'Голеностоп / бёдра / грудной отдел',
    areaIcon: '🏋️',
    instructions: 'Ноги на ширине плеч, руки прямые над головой (палка или лёгкий гриф). Присесть максимально глубоко, пятки не отрывать, палка остаётся над стопами.',
    passCriteria: 'Бёдра ниже параллели, пятки на полу, руки не падают вперёд, спина прямая.',
    failHint: 'Пятки отрываются → голеностоп. Руки падают → плечи/грудной отдел. Спина круглится → бёдра/поясница.',
    corrective: [
      { name: 'Приседания с паузой у стены', detail: '5×5, пауза 3 сек внизу — приоритет глубине без завала корпуса' },
      { name: 'Квадрицепс-стретч «Couch stretch»', detail: '2×45 сек на сторону — раскрывает сгибатели бедра' },
      { name: 'Мобилизация голеностопа с лентой', detail: '2×10 коленом к стене, стопа на ленте' },
      { name: 'Wall slides', detail: '2×10 — грудная экстензия для удержания палки' },
    ],
    relatedExercises: ['Приседания', 'Фронтальные приседания', 'Присед над головой'],
  },
  {
    id: 'thomas',
    title: 'Thomas-тест (сгибатели бедра)',
    area: 'Сгибатели бедра / квадрицепс',
    areaIcon: '🦵',
    instructions: 'Лечь на край скамьи/стола, ягодицы на краю. Одну ногу обхватить руками и прижать к груди, вторая свободно свисает с края.',
    passCriteria: 'Свисающее бедро полностью лежит на скамье, колено сгибается на 80°+.',
    failHint: 'Бедро не касается скамьи → напряжённые сгибатели бедра. Колено не сгибается → напряжённый прямая мышца бедра.',
    corrective: [
      { name: 'Couch stretch', detail: '2×45 сек на сторону, таз в нейтрали' },
      { name: 'Полупреклонная поза со сжатием ягодицы', detail: '3×30 сек — активация разгибателей против сгибателей' },
      { name: 'Фоам-роллинг квадрицепсов', detail: '2 мин на ногу, медленные проходы' },
    ],
    relatedExercises: ['Приседания', 'Становая тяга', 'Сплит-приседания'],
  },
  {
    id: 'shoulder_flexion',
    title: 'Сгибание плеч у стены',
    area: 'Широчайшие / грудь / плечи',
    areaIcon: '💪',
    instructions: 'Стоя спиной к стене: пятки, ягодицы, плечи и голова касаются стены. Поднять прямые руки вверх и прижать к стене.',
    passCriteria: 'Запястья и локти касаются стены без прогиба в пояснице и без отрыва головы.',
    failHint: 'Руки не достают до стены → широчайшие/грудь. Прогиб в пояснице → компенсация движением таза.',
    corrective: [
      { name: 'Растяжка широчайших (вис / у стойки)', detail: '2×30 сек, таз уводить назад-вниз' },
      { name: 'Wall slides', detail: '3×10 — локти/кисти скользят по стене с поясницей прижатой' },
      { name: 'Растяжка груди в дверном проёме', detail: '2×30 сек на сторону, рука согнута 90°' },
      { name: 'Вис на перекладине', detail: '3×20-30 сек, расслабление лопаток' },
    ],
    relatedExercises: ['Жим стоя', 'Подтягивания', 'Толчок'],
  },
  {
    id: 'toe_touch',
    title: 'Наклон вперёд (toe touch)',
    area: 'Бицепс бедра / поясница',
    areaIcon: '🧎',
    instructions: 'Стоя, ноги вместе, колени прямые. Медленный наклон вперёд с прямой спиной, руки к полу. Без боли в пояснице.',
    passCriteria: 'Ладонями или пальцами касаетесь пола, поясница без округления и боли.',
    failHint: 'Не достаёте до пола → напряжённый бицепс бедра. Боль/округление поясницы → паттерн разгибания, а не гибкость.',
    corrective: [
      { name: 'Лёгкая румынская тяга', detail: '3×8 с идеальной техникой — учит разгибанию из таза' },
      { name: 'Элефант-шаги (elephant walks)', detail: '2×8 — дыхание внизу, колени мягкие' },
      { name: 'Jefferson curl (лёгкий)', detail: '2×5 — прогрессивная нагрузка на заднюю цепь' },
      { name: 'Растяжка бицепса бедра с лентой', detail: '2×30 сек на ногу лёжа' },
    ],
    relatedExercises: ['Становая тяга', 'Румынская тяга', 'Гудморнинг'],
  },
  {
    id: 'aslr',
    title: 'Подъём прямой ноги (ASLR)',
    area: 'Бицепс бедра / кор',
    areaIcon: '🦿',
    instructions: 'Лёжа на спине, обе ноги прямые. Одну ногу поднимаете максимально высоко, вторая остаётся прямой и прижатой к полу.',
    passCriteria: 'Подъём >80° без сгибания колена и без отрыва второй ноги.',
    failHint: '<80° → напряжённый бицепс бедра. Вторая нога отрывается → слабый кор/компенсация.',
    corrective: [
      { name: 'Dead bug', detail: '3×8 на сторону — контроль таза и кор' },
      { name: 'Активные подъёмы ног с паузой', detail: '3×6, пауза 2 сек в верхней точке' },
      { name: 'Растяжка бицепса бедра с лентой', detail: '2×30 сек на ногу' },
    ],
    relatedExercises: ['Становая тяга', 'Глубина приседа', 'L-сид'],
  },
  {
    id: 't_spine_rotation',
    title: 'Ротация грудного отдела',
    area: 'Грудной отдел',
    areaIcon: '🔄',
    instructions: 'Сидя на пятках (сэйдза), одна рука за голову. Поворот корпуса в сторону без движения таза. Повторить в обе стороны.',
    passCriteria: 'Локоть уходит за противоположное плечо, таз неподвижен, поясница не скручивается.',
    failHint: 'Движение в пояснице вместо грудного отдела → компенсация ротацией поясницы.',
    corrective: [
      { name: 'Thread the needle', detail: '2×8 на сторону — ротация из четверенек' },
      { name: 'Open book stretch', detail: '2×8 на сторону, таз прижат' },
      { name: 'Фоам-роллинг грудного отдела', detail: '2 мин, руки за головой' },
    ],
    relatedExercises: ['Жим лёжа', 'Жим стоя', 'Все вращательные движения'],
  },
];

export function getMobilityTestById(id: string): MobilityTest | null {
  return MOBILITY_TESTS.find(t => t.id === id) || null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════════════════════

export const ASSESSMENT_KEY = 'he_mobility_assessments';
export const ASSESSMENT_CAP = 200;

const VALID_SCORES: AssessmentScore[] = [0, 1, 2];

export function sanitizeAssessment(raw: any): AssessmentEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(raw.date)) return null;
  const scores: Record<string, AssessmentScore> = {};
  if (raw.scores && typeof raw.scores === 'object') {
    for (const [k, v] of Object.entries(raw.scores)) {
      const n = typeof v === 'number' ? Math.round(v) : NaN;
      if (VALID_SCORES.includes(n as AssessmentScore)) scores[k] = n as AssessmentScore;
    }
  }
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `ass_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date: raw.date.slice(0, 10),
    scores,
    note: typeof raw.note === 'string' ? raw.note : undefined,
  };
}

function readJSON(key: string): any[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function writeJSON(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota — игнор */ }
}

/** Лог оценок, ASC по дате, кап ASSESSMENT_CAP (новейшие остаются). */
export function loadAssessmentLog(): AssessmentEntry[] {
  const list = readJSON(ASSESSMENT_KEY)
    .map(sanitizeAssessment)
    .filter((e): e is AssessmentEntry => !!e)
    .sort((a, b) => a.date.localeCompare(b.date));
  return list.slice(-ASSESSMENT_CAP);
}

/** Upsert оценки по дате. Возвращает полный лог. */
export function saveAssessment(input: { date: string; scores: Record<string, AssessmentScore>; note?: string }): AssessmentEntry[] {
  const list = loadAssessmentLog();
  const clean: AssessmentEntry = {
    id: '',
    date: input.date.slice(0, 10),
    scores: {},
    note: input.note && input.note.trim() ? input.note.trim() : undefined,
  };
  for (const [k, v] of Object.entries(input.scores || {})) {
    const n = VALID_SCORES.includes(v) ? v : (Math.round(v) as AssessmentScore);
    if (VALID_SCORES.includes(n)) clean.scores[k] = n;
  }
  const idx = list.findIndex(e => e.date === clean.date);
  if (idx >= 0) {
    clean.id = list[idx].id;
    list[idx] = clean;
  } else {
    clean.id = `ass_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    list.push(clean);
  }
  writeJSON(ASSESSMENT_KEY, list);
  return loadAssessmentLog();
}

export function latestAssessment(): AssessmentEntry | null {
  const list = loadAssessmentLog();
  return list.length > 0 ? list[list.length - 1] : null;
}

/** Предыдущая оценка (для сравнения «последняя vs до неё»). */
export function previousAssessment(): AssessmentEntry | null {
  const list = loadAssessmentLog();
  return list.length > 1 ? list[list.length - 2] : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Analytics
// ═══════════════════════════════════════════════════════════════════════════

export function summarizeAssessment(entry: AssessmentEntry | null): AssessmentSummary {
  const empty: AssessmentSummary = { total: 0, max: MOBILITY_TESTS.length * 2, pct: 0, counts: { pass: 0, partial: 0, fail: 0, scored: 0 }, weakest: [] };
  if (!entry) return empty;
  let total = 0;
  let pass = 0, partial = 0, fail = 0, scored = 0;
  const weakest: { test: MobilityTest; score: AssessmentScore }[] = [];
  for (const test of MOBILITY_TESTS) {
    const s = entry.scores[test.id];
    if (s === undefined) continue;
    scored++;
    total += s;
    if (s === 2) pass++;
    else if (s === 1) partial++;
    else fail++;
    if (s < 2) weakest.push({ test, score: s });
  }
  weakest.sort((a, b) => a.score - b.score);
  const max = MOBILITY_TESTS.length * 2;
  return {
    total,
    max,
    pct: max > 0 ? Math.round(total / max * 100) : 0,
    counts: { pass, partial, fail, scored },
    weakest,
  };
}

export function assessmentTrend(): AssessmentTrend {
  const current = latestAssessment();
  const previous = previousAssessment();
  const perTest = MOBILITY_TESTS.map(t => {
    const c = current?.scores[t.id] ?? null;
    const p = previous?.scores[t.id] ?? null;
    return {
      testId: t.id,
      title: t.title,
      area: t.area,
      current: c,
      previous: p,
      delta: c !== null && p !== null ? c - p : null,
    };
  });
  const hist = summarizeAssessment(current);
  const prevSum = summarizeAssessment(previous);
  return {
    current,
    previous,
    deltaTotal: current && previous ? hist.total - prevSum.total : null,
    perTest,
    history: loadAssessmentLog().map(e => ({ date: e.date, total: summarizeAssessment(e).total })),
  };
}

/** Тесты с баллом < 2 в последней оценке (слабые зоны). */
export function weakestTests(entry: AssessmentEntry | null): { test: MobilityTest; score: AssessmentScore }[] {
  return summarizeAssessment(entry).weakest;
}

/** Корректирующие упражнения для непройденных тестов (с тестом для контекста). */
export function correctivesForEntry(entry: AssessmentEntry | null): { test: MobilityTest; exercises: CorrectiveExercise[] }[] {
  return weakestTests(entry).map(w => ({ test: w.test, exercises: w.test.corrective }));
}

/**
 * Корректирующие блоки для добавления в протокол мобильности:
 * по одному блоку на слабый тест (слот daily, 5 мин), без дублей с существующими.
 */
export function correctiveItemsForProtocol(entry: AssessmentEntry | null, existing: { title?: string; slot?: string }[]): { title: string; script: string; slot: 'daily'; durationMin: number; targetAreas: string[] }[] {
  const existingTitles = new Set((existing || []).map(i => (i.title || '').toLowerCase()));
  const out: { title: string; script: string; slot: 'daily'; durationMin: number; targetAreas: string[] }[] = [];
  for (const w of weakestTests(entry)) {
    const title = `Коррекция: ${w.test.title}`;
    if (existingTitles.has(title.toLowerCase())) continue;
    const script = w.test.corrective
      .map((c, i) => `${i + 1}. ${c.name} — ${c.detail}`)
      .join('; ');
    out.push({
      title,
      script: `Ежедневная коррекция слабой зоны (${w.test.area}): ${script}.`,
      slot: 'daily',
      durationMin: 5,
      targetAreas: [w.test.area],
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════════

export function assessmentCSV(): string {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const header = ['date', ...MOBILITY_TESTS.map(t => t.id), 'total', 'note'];
  const rows = [header.join(',')];
  for (const e of loadAssessmentLog()) {
    const sum = summarizeAssessment(e);
    rows.push([
      e.date,
      ...MOBILITY_TESTS.map(t => (e.scores[t.id] === undefined ? '' : e.scores[t.id])),
      sum.total,
      e.note ? esc(e.note) : '',
    ].join(','));
  }
  return rows.join('\n');
}

/**
 * bb-diag-next-actions.engine.ts — BB-G-08: «что делать дальше» (1–2 действия).
 *
 * Зачем: хаб умел показать балл, ограничитель и список приоритетов, но отчёт
 * оставался диагностическим документом — пользователь читал «ACWR ×1.9» и шёл
 * думать сам. План §5 (BB-G-08) просит 1–2 действия со ссылкой туда, где их
 * делают.
 *
 * Принципы (те же, что у панели объёма, чтобы экраны не противоречили):
 *  1. Действие выводится ТОЛЬКО из данных. Нет строки «снять N подходов», если
 *     в дневнике нет факта выше MRV; нет «добрать до MEV», если зона не слабая.
 *  2. Порядок = «с чего начинать», а не «что первое нашлось»:
 *     красный флаг → боль → превышение MRV → ACWR → сон → готовность →
 *     мобилити → пробелы в данных → причина отставания → план → эффект.
 *     Это совпадает с приоритетом ограничителя BB-G-01 (pain → sleep → ACWR →
 *     MRV → mobility → readiness): у отказа от объёма всегда приоритет над
 *     советом «добрать объём».
 *  3. Два действия — не «топ-2 красных чипа», а два РАЗНЫХ шага: одно и то же
 *     место (например, «Ортопедия») второй раз не предлагается.
 *  4. Ноль действий — тоже ответ: `note` честно пишет, почему советовать нечего
 *     (нет данных / всё в норме).
 *
 * Чистый движок: ни стора, ни `window`, ни `Date` — вход/выход детерминированы,
 * поэтому его можно звать из хаба, из экспорта и из тестов одинаково.
 *
 * Контракт держат тесты `bb-diag-next-actions.test.ts`.
 */

import type { BBVerificationChannel } from './bb-scoring.engine';

/** Белый список экранов, куда хабу разрешено уводить deep-link'ом (BB-G-02). */
export const BB_DIAG_DEEP_LINK_TARGETS = [
  'volume_hub',
  'joints_ortho',
  'calc_vbt',
  'diary',
  'progress',
  'strength_analysis',
] as const;

export type BbDiagDeepLinkTarget = (typeof BB_DIAG_DEEP_LINK_TARGETS)[number];

/** Единый источник правды для хука `training-open-tab` (TrainingScreen). */
export const BB_DIAG_DEEP_LINKS: ReadonlySet<string> = new Set<string>(BB_DIAG_DEEP_LINK_TARGETS);

export type NextActionKind = 'safety' | 'recovery' | 'training' | 'data' | 'plan' | 'maintain';
export type NextActionZone = 'red' | 'yellow' | 'green' | 'nodata';

/**
 * Куда ведёт действие: внешний экран (deep-link, только из белого списка) или
 * вкладка внутри хаба. `null` — шага в приложении нет (например, «собери план»,
 * это кнопка «→ В ББ-авто» в самом хабе).
 */
export interface NextActionTarget {
  type: 'screen' | 'tab';
  id: string;
  label: string;
}

export interface NextAction {
  /** Стабильный id правила (для тестов, дедупа и логов — не для UI). */
  id: string;
  kind: NextActionKind;
  zone: NextActionZone;
  /** Императив: что сделать. */
  title: string;
  /** Из каких данных это следует. */
  why: string;
  target: NextActionTarget | null;
}

export interface NextActionsResult {
  actions: NextAction[];
  /** Все рассмотренные правила в порядке приоритета (отладка/тесты). */
  considered: string[];
  /** Честное «почему действий нет» — null, когда действия есть. */
  note: string | null;
}

export interface NextActionsVolumeInput {
  limiter?: { id?: string; label?: string; zone?: string; detail?: string } | null;
  hasVolume?: boolean;
  hasAcwr?: boolean;
  hasMobility?: boolean;
  rows?: Array<{ group?: string; label?: string; over?: number; sets?: number; mrv?: number }> | null;
}

export interface NextActionsInput {
  score: {
    score?: number;
    level?: string;
    /** 0–1, взвешенная доля подтверждённых каналов (BB-D-05). */
    verification?: number;
    verificationMissing?: BBVerificationChannel[] | null;
  };
  redFlags?: { active?: boolean; blocked?: boolean; text?: string; items?: string[] } | null;
  /** Панель BB-G-01 (берём ограничитель и строки объёма). */
  volume?: NextActionsVolumeInput | null;
  /** Слабые зоны (гранулярные или канонические) — приоритет для «добрать». */
  weakZones?: string[] | null;
  weakCauses?: Record<string, { cause?: string; confidence?: number; fix?: string; evidence?: string[] }> | null;
  /** Есть ли сохранённый план ББ (без него аудит плана/покрытие головок не считаются). */
  planPresent?: boolean;
  diaryCount?: number;
  measuresCount?: number;
  /** Пройден ли мобилити-скрининг (без него мобилити и драйвер — «нет данных»). */
  screenTouched?: boolean;
  /** BB-G-04: результат эффекта коррекции (или null, если вставок не было). */
  effect?: { status?: string; text?: string } | null;
  /** Сколько действий максимум (по умолчанию 2, больше 3 не отдаём никогда). */
  maxActions?: number;
}

const RU_CAUSE: Record<string, string> = {
  volume: 'объём',
  recovery: 'восстановление',
  technique: 'техника',
  strength: 'сила',
  mobility: 'подвижность',
  fatigue: 'усталость',
  activation: 'включение мышцы',
  genetics: 'особенности строения',
};

const screen = (id: BbDiagDeepLinkTarget, label: string): NextActionTarget => ({ type: 'screen', id, label });
const tab = (id: string, label: string): NextActionTarget => ({ type: 'tab', id, label });

const pctRu = (v: number): string => `${Math.round(v * 100)}%`;

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Строка объёма с наибольшим превышением MRV (или null — превышений нет). */
function worstOverRow(volume: NextActionsVolumeInput | null | undefined):
  { label: string; over: number; sets: number; mrv: number } | null {
  const rows = Array.isArray(volume?.rows) ? volume!.rows! : [];
  let best: { label: string; over: number; sets: number; mrv: number } | null = null;
  for (const r of rows) {
    if (!r) continue;
    const over = Math.round(Number(r.over) || 0);
    if (over <= 0) continue;
    const sets = Math.round(Number(r.sets) || 0);
    const mrv = Math.round(Number(r.mrv) || 0);
    const label = clean(r.label) || clean(r.group) || 'мышца';
    if (!best || over > best.over) best = { label, over, sets, mrv };
  }
  return best;
}

/** Чего не хватает до «данных достаточно» — только реально отсутствующее. */
function dataGaps(input: NextActionsInput): string[] {
  const gaps: string[] = [];
  const missing = (input.score.verificationMissing || []) as BBVerificationChannel[];
  const diaryCount = Math.max(0, Math.round(Number(input.diaryCount) || 0));
  const measuresCount = Math.max(0, Math.round(Number(input.measuresCount) || 0));

  if (input.screenTouched === false) gaps.push('скрининг движений');
  if (missing.includes('diary') || diaryCount < 4) {
    gaps.push(diaryCount > 0 ? `дневник (${diaryCount} из 4 тренировок)` : 'дневник тренировок');
  }
  if (missing.includes('circumf') || measuresCount < 3) {
    gaps.push(measuresCount > 0 ? `замеры обхватов (${measuresCount} из 3)` : 'замеры обхватов');
  }
  // VBT/LVP в пробелы НЕ входит: данные есть, но с меньшей уверенностью — это
  // не «нет канала», а «часть цифр не подтверждена» (видно в проверке данных).
  return gaps;
}

export function buildNextActions(input: NextActionsInput): NextActionsResult {
  const max = Math.min(3, Math.max(1, Math.round(Number(input.maxActions) || 2)));
  const considered: string[] = [];
  const picked: NextAction[] = [];
  const usedTargets = new Set<string>();

  const emit = (a: NextAction | null): void => {
    if (!a) return;
    considered.push(a.id);
    if (picked.length >= max) return;
    // Одно и то же место дважды не предлагаем (и экран, и вкладку хаба): два шага
    // должны быть двумя разными шагами, а не двумя ссылками в один раздел.
    if (a.target) {
      const key = `${a.target.type}:${a.target.id}`;
      if (usedTargets.has(key)) return;
      usedTargets.add(key);
    }
    picked.push(a);
  };

  const vol = input.volume || null;
  const limiter = vol?.limiter || null;
  const limiterId = clean(limiter?.id);
  const limiterWhy = clean(limiter?.detail) || clean(limiter?.label);

  // 1. Красный флаг — единственное действие, которое отменяет все остальные.
  const rf = input.redFlags;
  if (rf?.active && rf?.blocked) {
    const why = clean(rf.text) || (Array.isArray(rf.items) ? rf.items.map(clean).filter(Boolean).join(' · ') : '');
    emit({
      id: 'red-flag',
      kind: 'safety',
      zone: 'red',
      title: 'Стоп: сначала флаги и возврат в план',
      why: why || 'Активен красный флаг скрининга',
      target: screen('joints_ortho', 'Ортопедия · флаги'),
    });
  }

  // 2. Боль ≥4/10 — объём не наращиваем, пока боль не уйдёт.
  if (limiterId === 'pain') {
    emit({
      id: 'pain',
      kind: 'recovery',
      zone: clean(limiter?.zone) === 'red' ? 'red' : 'yellow',
      title: `Разгрузить, пока боль не уйдёт (${clean(limiter?.label) || 'боль'})`,
      why: limiterWhy || 'Боль ≥4/10 — добивки и отказные подходы не выполняем',
      target: screen('joints_ortho', 'Ортопедия · боль'),
    });
  }

  // 3. Факт выше MRV — единственный случай, когда совет «снять подходы» честен.
  const over = worstOverRow(vol);
  if (over) {
    emit({
      id: 'mrv',
      kind: 'training',
      zone: over.mrv > 0 && over.sets / Math.max(1, over.mrv) >= 1.1 ? 'red' : 'yellow',
      title: `Снять ${over.over} подх. с ${over.label}`,
      why: `факт ${over.sets} против MRV ${over.mrv} — сначала возвращаемся в ориентир, потом добивки`,
      target: screen('volume_hub', 'Объём-хаб'),
    });
  }

  // 4. ACWR — скачок недельного объёма.
  if (limiterId === 'acwr') {
    emit({
      id: 'acwr',
      kind: 'training',
      zone: clean(limiter?.zone) === 'red' ? 'red' : 'yellow',
      title: 'Не наращивать недельный скачок объёма',
      why: limiterWhy || 'ACWR выше рабочего коридора',
      target: screen('volume_hub', 'Объём-хаб'),
    });
  }

  // 5. Сон — ограничитель, который пользователь может починить сегодня.
  if (limiterId === 'sleep') {
    emit({
      id: 'sleep',
      kind: 'recovery',
      zone: clean(limiter?.zone) === 'red' ? 'red' : 'yellow',
      title: 'Довести сон до 7+ ч три ночи подряд',
      why: limiterWhy || 'Сон <7 ч — объём приоритетов выше MAV не растим',
      target: screen('diary', 'Дневник · сон'),
    });
  }

  // 6. Готовность — красная/жёлтая без единого «починить сегодня» пункта выше.
  if (limiterId === 'readiness') {
    emit({
      id: 'readiness',
      kind: 'recovery',
      zone: clean(limiter?.zone) === 'red' ? 'red' : 'yellow',
      title: 'Неделя с RIR 2 и без отказных подходов',
      why: limiterWhy || 'Готовность ниже рабочей — объём ×0.75',
      target: tab('volume', 'Объём · Recovery'),
    });
  }

  // 7. Провалы мобилити — упражнения зоны меняем, а не терпим.
  if (limiterId === 'mobility') {
    emit({
      id: 'mobility',
      kind: 'recovery',
      zone: 'yellow',
      title: 'Закрыть провалы мобилити до работы зоны',
      why: limiterWhy || 'Провалы скрининга ограничивают выбор упражнений',
      target: screen('joints_ortho', 'Ортопедия · мобилити'),
    });
  }

  // 8. Пробелы в данных: цифры без каналов — условные, это тоже действие.
  const gaps = dataGaps(input);
  const verifRaw = Number(input.score.verification);
  const verif = Number.isFinite(verifRaw) ? Math.max(0, Math.min(1, verifRaw)) : 0;
  const dataNeeded = gaps.length > 0 && (verif < 0.7 || input.screenTouched === false
    || Math.max(0, Math.round(Number(input.diaryCount) || 0)) < 4);
  if (dataNeeded) {
    const missingDiary = gaps.some((g) => g.startsWith('дневник'));
    const target = input.screenTouched === false
      ? tab('screening', 'Скрининг')
      : missingDiary
        ? screen('diary', 'Дневник')
        : tab('symmetry', 'Симметрия · замеры');
    emit({
      id: 'data',
      kind: 'data',
      zone: verif === 0 ? 'nodata' : 'yellow',
      title: gaps.length === 1 ? `Добрать данные: ${gaps[0]}` : `Добрать данные: ${gaps.slice(0, 2).join(' · ')}`,
      why: verif === 0
        ? 'Оценка построена без измерений — цифры на экране пока условные'
        : `проверка данных ${pctRu(verif)}${gaps.length > 2 ? ` · не хватает ещё: ${gaps.slice(2).join(', ')}` : ''}`,
      target,
    });
  }

  // 9. Причина отставания — самая уверенная из посчитанных движком.
  const causeEntry = Object.entries(input.weakCauses || {})
    .filter(([, c]) => c && clean(c.cause) && clean(c.fix))
    .sort((a, b) => (Number(b[1].confidence) || 0) - (Number(a[1].confidence) || 0))[0];
  if (causeEntry) {
    const [zone, c] = causeEntry;
    const causeRu = RU_CAUSE[clean(c.cause)] || clean(c.cause);
    const conf = Number(c.confidence) || 0;
    emit({
      id: 'weak-cause',
      kind: 'training',
      zone: 'yellow',
      title: `Причина отставания ${zone}: ${causeRu}`,
      why: `${conf > 0 ? `уверенность ${pctRu(conf)} · ` : ''}${clean(c.fix)}`,
      target: tab('weak', 'Слабые зоны'),
    });
  }

  // 10. Без плана не считаются аудит упражнений, покрытие головок и стимул.
  if (input.planPresent === false) {
    emit({
      id: 'plan',
      kind: 'plan',
      zone: 'yellow',
      title: 'Собрать план в конструкторе',
      why: 'Без плана не считаются покрытие головок, аудит упражнений и стимул — кнопка «→» в шапке хаба',
      target: null,
    });
  }

  // 11. Эффект вставки ещё не наступил — это задача «вернуться», а не вывод.
  const effectStatus = clean(input.effect?.status);
  if (effectStatus === 'too_early' && clean(input.effect?.text)) {
    emit({
      id: 'effect',
      kind: 'maintain',
      zone: 'nodata',
      title: 'Вернуться к эффекту коррекции в конце окна',
      why: clean(input.effect?.text),
      target: tab('volume', 'Объём · Recovery'),
    });
  }

  // 12. Всё закрыто — честное «держать», а не выдуманная проблема.
  const hasAnyData = verif > 0 || !!vol?.hasVolume || !!vol?.hasAcwr;
  if (picked.length === 0 && hasAnyData) {
    emit({
      id: 'maintain',
      kind: 'maintain',
      zone: 'green',
      title: 'Держать MAV по приоритетным мышцам',
      why: `Проверка данных ${pctRu(verif)} · ограничителей объёма нет`,
      target: screen('volume_hub', 'Объём-хаб'),
    });
  }

  const note = picked.length > 0
    ? null
    : (hasAnyData
      ? 'Ограничителей не найдено — действий из данных нет'
      : 'Данных нет: сначала скрининг и 4 тренировки в дневнике');

  return { actions: picked, considered, note };
}

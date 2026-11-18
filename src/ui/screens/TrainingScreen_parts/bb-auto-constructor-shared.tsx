/**
 * bb-auto-constructor-shared.tsx — вынесенный non-JSX и служебный слой
 * ББ-авто конструктора (этап 1 разреза god-component, план §4.3):
 *  - `CollapsibleCard` (карточка-аккордеон шага 5);
 *  - типы шагов/фаз (`Step`, `PlanMode`, `BBPhase`);
 *  - константы групп/метки/фазовые техники и кэш фаз;
 *  - чистые хелперы фаз (`getPhaseMap`/`phaseForWeek`/`computePhases`),
 *    доноров (`normalizeDonorTargets`), комментариев (`exerciseComment`),
 *    годового контекста (`annualBlockCtxToPrepPatch`/`annualActiveBlockLine`),
 *    UI-меток (`backSubgroupLabel`/`armHeadLabel`), A/B-ротации
 *    (`isAbRotationActive`), стилей чипа (`chipBtn`), a11y inline-модалок
 *    (`useInlineDialogA11y`).
 *
 * Перенос 1-в-1 (поведение не меняется): `BbAutoConstructor` ре-экспортирует
 * публичные символы (`backSubgroupLabel/armHeadLabel/isAbRotationActive/
 * annualBlockCtxToPrepPatch/annualActiveBlockLine/PHASE_TECHNIQUES`) для
 * существующих потребителей и тестов.
 */
import React, { useEffect, useRef, useState } from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { canonicalMuscle, expandDonorMuscles } from '../../../engines/bb/bb-specialization.engine';
import { MUSCLE_LABEL_RU } from '../../../engines/volume-landmarks.engine';
import { PATTERN_RU as SUMMARY_PATTERN_RU } from '../../../engines/bb/bb-summary.engine';
import { techniqueLabel } from './bb-technique-display';
import { distributePhases as distributePhasesUnified, type PhaseDistribution } from '../../../engines/periodization';
import {
  CATEGORY_PROFILES, isoAddDays, isoToday,
  canonicalWaterStrategy, canonicalSodiumStrategy, trialCarbDoseGPerKg,
  type BBContestPrepConfig, type BBContestCategory, type ContestSpecialization,
  type ContestEventEntry,
  type WaterStrategy, type SodiumStrategy, type CarbLoadStrategy,
} from '../../../engines/bb/bb-contest-prep.engine';
import { activeBlockForWeek, weekForDate } from '../../../engines/annual-training/block-builders.engine';
import type { AnnualTrainingPlan } from '../../../engines/annual-training/annual-training.types';
import type { BBExercise } from '../../../engines/bb/bb-builder.engine';
import { ACCENT, CARD } from './training-ui';

/* ── 4.5 (мобилка): APK-кит — переключатели вместо нативных checkbox.
      Касание ≥44px, шрифты ≥10px, aria role=switch/aria-checked.
      `BbRowSwitch`/`BbToggleChip` живут в `training-ui.tsx` — тем же файлом
      пользуются арм/ТА/единоборства; здесь только ре-экспорт. ── */
export { BbRowSwitch, BbToggleChip } from './training-ui';


/* ── Единый кит карточек (иконка-тайл, заголовок 12.5/800, верхняя кромка
      акцента) теперь живёт в `training-ui.tsx` — один набор для ББ-авто,
      ПЛ-авто и общих панелей. Здесь — ре-экспорт для существующих
      потребителей (`bb-step-*`, тесты, guard'ы). ── */
export { BbCard, BbFoldCard } from './training-ui';

/* ── CollapsibleCard helper для шага 5 (заголовок-кнопка карточки) ── */
export const CollapsibleCard: React.FC<{
  title: string;
  defaultOpen?: boolean;
  headerStyle?: React.CSSProperties;
  badge?: string;
  children: React.ReactNode;
}> = ({ title, defaultOpen = false, headerStyle, badge, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ ...CARD, padding: 0, overflow: 'hidden', marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '11px 12px',
          cursor: 'pointer',
          background: headerStyle?.background || 'linear-gradient(135deg, rgba(96,165,250,0.10), rgba(96,165,250,0.03))',
          border: 'none',
          borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none',
          textAlign: 'left',
          ...headerStyle,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 800, color: headerStyle?.color || '#fff' }}>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {badge && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }}>{badge}</span>}
          <span style={{ fontSize: 11, color: '#fff', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
        </span>
      </button>
      <div style={{ display: open ? 'block' : 'none', padding: '10px 12px' }}>{children}</div>
    </div>
  );
};

export type Step = 'params' | 'ped' | 'split' | 'plan' | 'weights' | 'quality' | 'adjust' | 'contest' | 'annual' | 'tools';

/** Ручная правка упражнения в шаге «План»/«Коррекция».
 *  `exerciseKey` — identity упражнения на момент правки: защищает от применения
 *  старой правки к другому упражнению после replace/move/rebuild. */
export interface BBInlineEdit {
  sets: number;
  reps: number;
  weight: number;
  rir?: number;
  tempo?: string;
  technique?: string;
  /** Имя упражнения-партнёра для ручного суперсета (или 'none'). */
  supersetWith?: string;
  exerciseKey?: string;
}

/** Стабильная identity упражнения для ключей ручных правок.
 *  Движок использует display-name (`exerciseName`/`name`), поэтому он же —
 *  канонический ключ; id — только fallback. */
export function bbExerciseIdentity(e: any): string {
  return String(e?.exerciseName || e?.name || e?.id || '');
}

/** Число из inline-поля: `null` = «ввод пока не число» (пусто, «-», «1.»).
 *
 *  Аудит UI (P2): очистка поля «Сеты» отправляла в план 0 сетов (`parseInt('') || 0`),
 *  а вес «82.5» обрезался `parseInt` до 82. Теперь пустой/нечисловой ввод возвращает
 *  `null`, вызывающий оставляет прежнее значение, а дробное значение сохраняется. */
export function parseInlineNumber(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = String(raw ?? '').trim().replace(',', '.');
  if (s === '') return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/** Inline-правка с клампом: пустой/нечисловой ввод → `fallback` (прежнее значение). */
export function clampInlineNumber(
  raw: string | number | null | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  const v = parseInlineNumber(raw);
  if (v == null) return fallback;
  return Math.max(min, Math.min(max, v));
}

/** Пакетная правка недели: правки для всех упражнений недели.
 *
 *  Аудит UI (P2). Раньше обработчик читал значение как `parseFloat(v) || 0` (стёртое
 *  поле → 0 → «× умножить» обнулял вес и сеты всей недели) и дописывал в правку
 *  выдуманные поля (`reps: 10`, `weight: 80`): правка «Сеты» переписывала повторы всех
 *  упражнений недели и ставила 80 кг упражнениям без веса.
 *
 *  Теперь: значение разбирается честно (пусто/нечисло — ошибка), в правку попадают
 *  ФАКТИЧЕСКИЕ значения упражнения и меняется только выбранное поле.
 *
 *  @returns `{ edits }` для `commitEdits` либо `{ error }` с текстом для пользователя.
 */
export function computeBulkWeekEdits(args: {
  sessions: any[];
  weekNo: number;
  field: 'sets' | 'reps' | 'weight';
  mode: 'set' | 'mult';
  rawValue: string | number | null | undefined;
  existing?: Record<string, any>;
}): { edits: Record<string, any> } | { error: string } {
  const value = parseInlineNumber(args.rawValue);
  if (value == null) return { error: 'укажите число' };
  if (args.mode === 'mult' && !(value > 0)) return { error: 'множитель должен быть больше нуля' };
  if (args.mode === 'set' && args.field !== 'weight' && !(value >= 1)) return { error: 'значение должно быть не меньше 1' };
  const next: Record<string, any> = { ...(args.existing || {}) };
  for (let si = 0; si < args.sessions.length; si++) {
    const session = args.sessions[si];
    const exercises = Array.isArray(session?.exercises) ? session.exercises : [];
    for (let ei = 0; ei < exercises.length; ei++) {
      const ex: any = exercises[ei];
      const key = `${args.weekNo}-${si}-${ei}`;
      const first = ex?.workSets?.[0];
      // Остальные поля — фактические: нет веса — 0, а не придуманные 80 кг.
      const base = next[key] || {
        sets: Number(ex?.sets) || 0,
        reps: Number(first?.reps) || Number(ex?.repsRange?.[0]) || 10,
        weight: Number.isFinite(Number(first?.weight)) ? Number(first.weight) : 0,
        exerciseKey: bbExerciseIdentity(ex),
      };
      const cur = Number(base[args.field]) || 0;
      const val = args.mode === 'mult' ? Math.round(cur * value * 10) / 10 : value;
      next[key] = { ...base, [args.field]: val };
    }
  }
  return { edits: next };
}

/** Персональная доза trial для пик-неделы: сначала сохранённая в плане, иначе — из
 *  последнего результата пробного пика.
 *
 *  Аудит UI (P2): «перенос даты шоу» и «±неделя подготовки» пересобирали оверлей без
 *  `carbDoseGPerKg`, поэтому персональная доза углеводов пик-недели терялась — план и
 *  питание возвращались к среднему коридора. Доза едет в плане (`peakWeek.carbDoseGPerKg`),
 *  значит достаточно не забыть её при пересборке. */
export function prepTrialDose(
  plan: { peakWeek?: { carbDoseGPerKg?: number } | null; category?: string; sex?: string } | null | undefined,
  lastTest: any,
): number | undefined {
  const stored = Number(plan?.peakWeek?.carbDoseGPerKg);
  if (Number.isFinite(stored) && stored > 0) return stored;
  if (!lastTest) return undefined;
  try {
    const dose = Number(trialCarbDoseGPerKg(lastTest, (plan?.category || 'mens_physique') as any, (plan?.sex || 'male') as any));
    return Number.isFinite(dose) && dose > 0 ? dose : undefined;
  } catch {
    return undefined;
  }
}

/** Ключ курсора: какая дата шоу годового блока уже применена к prep-контуру. */
export const ANNUAL_SHOWDATE_CURSOR_KEY = 'he_contest_annual_synced';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface PrepContourSeed {
  competitions: ContestEventEntry[];
  /** Дата главного старта (ранний A, иначе самый ранний датированный). */
  showDate?: string;
}

/** Дата главного старта: ранний старт приоритета A, иначе самый ранний датированный. */
export function showDateFromCompetitions(
  comps: ReadonlyArray<ContestEventEntry> | null | undefined,
): string | undefined {
  const dated = (comps ?? []).filter(c => typeof c?.date === 'string' && ISO_DATE_RE.test(c.date));
  if (dated.length === 0) return undefined;
  const byDate = (a: ContestEventEntry, b: ContestEventEntry) => String(a.date).localeCompare(String(b.date));
  const main = dated.filter(c => c.priority === 'A').sort(byDate);
  return (main.length ? main : [...dated].sort(byDate))[0]?.date;
}

/**
 * Старты годового макроцикла → записи prep-контура.
 *
 * Аудит UI (P2): «два prep-контура пишут в одно хранилище» — макроцикл знает старты
 * (`competitions` с датами и приоритетами), а prep-панель их не видела: те же старты
 * заводились руками заново. Пустые записи (ни имени, ни даты) пропускаются, id
 * сохраняется (на него ссылаются блоки макроцикла), иначе генерируется.
 */
export function prepSeedFromMacrocycle(
  macro: { competitions?: ReadonlyArray<{ id?: string; name?: string; date?: string; priority?: string }> } | null | undefined,
): PrepContourSeed {
  const raw = Array.isArray(macro?.competitions) ? macro!.competitions! : [];
  const competitions: ContestEventEntry[] = [];
  raw.forEach((c, i) => {
    if (!c || typeof c !== 'object') return;
    const name = String(c.name ?? '').trim();
    const date = typeof c.date === 'string' && ISO_DATE_RE.test(c.date.trim()) ? c.date.trim() : undefined;
    if (!name && !date) return; // пустая запись ничего не сообщает
    const priority: ContestEventEntry['priority'] =
      c.priority === 'A' || c.priority === 'B' || c.priority === 'C' ? c.priority : undefined;
    competitions.push({
      id: String(c.id ?? '').trim() || `comp_${i + 1}`,
      name: name || `Старт ${i + 1}`,
      date,
      priority,
    });
  });
  return { competitions, showDate: showDateFromCompetitions(competitions) };
}

/**
 * Нужно ли переносить дату шоу из годового блока в prep-контур.
 *
 * Аудит UI (P2): синк шёл только в UI-state (prep-план оставался со старой датой) и
 * «на 7 дней» после ручной правки — через неделю он молча перетирал ручную дату.
 * Теперь курсор последнего применённого значения: изменение даты в годовом блоке
 * применяется ровно один раз, а ручная правка в prep не перетирается, пока годовой
 * блок не изменят. Первое наблюдение (курсора нет) ничего не меняет — кто из контуров
 * новее, неизвестно, а молча сдвигать уже настроенную подготовку нельзя.
 */
export function annualShowDateDecision(args: {
  blockShowDate?: string | null;
  lastSyncedShowDate?: string | null;
  currentShowDate?: string | null;
}): { date: string; action: 'apply' | 'adopt' } | null {
  const block = typeof args.blockShowDate === 'string' ? args.blockShowDate.trim() : '';
  if (!ISO_DATE_RE.test(block)) return null;
  if (args.lastSyncedShowDate == null || args.lastSyncedShowDate === '') {
    return { date: block, action: 'adopt' }; // первое наблюдение: только запоминаем
  }
  if (args.lastSyncedShowDate === block) return null; // это значение уже применено
  if (args.currentShowDate === block) return { date: block, action: 'adopt' };
  return { date: block, action: 'apply' };
}

/** Ручной суперсет: связать упражнение `index` с реальным партнёром в той же сессии.
 *
 *  Аудит UI (P3). Правка живёт в `exerciseEdits` и переприменяется при каждой пересборке
 *  плана. Раньше это давало два дефекта: (1) после замены/перестановки упражнения поиск
 *  партнёра шёл по «свободным» и находил другого (или никого, если прежний партнёр уже
 *  был в суперсете); (2) в случае неудачи в план навсегда дописывался комментарий
 *  «⚠ суперсет: подходящий партнёр не найден» — ложное предупреждение в данных плана.
 *  Теперь повторное применение идемпотентно, оборванная ссылка снимается и партнёр
 *  ищется заново, а неудача возвращает `false`, не трогая план.
 *
 *  @returns `true` — суперсет стоит (применён сейчас или уже был), `false` — партнёр не найден.
 */
export function applyManualSupersetTo(exercises: any[], index: number, mode: string): boolean {
  const ex = exercises[index];
  if (!ex) return false;
  const muscleOf = (x: any) => canonicalMuscle(String(x?.muscle || ''));
  const antagonists: Record<string, string[]> = {
    chest: ['back'], back: ['chest'],
    biceps: ['triceps'], triceps: ['biceps'],
    quads: ['hamstrings', 'glutes'], hamstrings: ['quads', 'glutes'], glutes: ['quads', 'hamstrings'],
    shoulders: ['back'], abs: ['back'], calves: [], forearms: [],
  };
  const nameOf = (x: any) => String(x?.name || x?.exerciseName || '');
  const currentMuscle = muscleOf(ex);
  const m = String(mode || '').toLowerCase();
  const isAntagonist = m === 'антагонист' || m === 'antagonist';
  const isSameMuscle = m === 'та же группа' || m === 'same_muscle' || m === 'same muscle';
  const isNameMode = !isAntagonist && !isSameMuscle;
  const matchesMode = (x: any) => {
    const mm = muscleOf(x);
    if (isNameMode) return nameOf(x) === mode;
    if (isAntagonist) return (antagonists[currentMuscle] || []).includes(mm);
    return mm === currentMuscle;
  };
  // Правка уже применена к этому упражнению с подходящим партнёром — не переприменяем.
  const existing = ex.supersetWith
    ? exercises.find((x: any, i: number) => i !== index && nameOf(x) === String(ex.supersetWith))
    : null;
  if (ex.supersetGroup && existing && matchesMode(existing)) return true;
  // Партнёр исчез (замена/удаление) — снимаем оборванную ссылку и ищем заново.
  if (ex.supersetGroup && !existing) {
    delete ex.supersetWith;
    delete ex.supersetGroup;
    delete ex.supersetSlot;
  }
  const isFree = (x: any) => !x?.supersetWith && !x?.supersetGroup;
  let partnerIdx = -1;
  if (isNameMode) {
    partnerIdx = exercises.findIndex((x: any, i: number) => i !== index && nameOf(x) === mode);
  } else if (isAntagonist) {
    const targets = antagonists[currentMuscle] || [];
    partnerIdx = exercises.findIndex((x: any, i: number) => i !== index && isFree(x) && targets.includes(muscleOf(x)));
  } else {
    partnerIdx = exercises.findIndex((x: any, i: number) => i !== index && isFree(x) && muscleOf(x) === currentMuscle);
  }
  if (partnerIdx < 0) return false; // ложное «партнёр не найден» в комментарий плана больше не пишем
  const partner = exercises[partnerIdx];
  const used = new Set<number>();
  for (const x of exercises) {
    const g = Number(x?.supersetGroup);
    if (Number.isFinite(g)) used.add(g);
  }
  let groupId = 1000 + index + 1;
  while (used.has(groupId)) groupId++;
  ex.supersetWith = nameOf(partner);
  partner.supersetWith = nameOf(ex);
  ex.supersetGroup = groupId;
  partner.supersetGroup = groupId;
  ex.supersetSlot = 0;
  partner.supersetSlot = 1;
  ex.restSeconds = 0;
  partner.restSeconds = 0;
  if (Array.isArray(ex.workSets)) ex.workSets = ex.workSets.map((ws: any) => ({ ...ws, restSeconds: 0 }));
  if (Array.isArray(partner.workSets)) partner.workSets = partner.workSets.map((ws: any) => ({ ...ws, restSeconds: 0 }));
  if (!String(ex.comment || '').includes('🔗 Суперсет с')) {
    ex.comment = (ex.comment || '') + ` | 🔗 Суперсет с «${nameOf(partner)}»`;
  }
  if (!String(partner.comment || '').includes('🔗 Суперсет с')) {
    partner.comment = (partner.comment || '') + ` | 🔗 Суперсет с «${nameOf(ex)}»`;
  }
  return true;
}
export type BBPhase = 'accumulation' | 'intensification' | 'deload' | 'peaking';

/** Фаза недели по факту плана.
 *
 *  Аудит UI (P2): карточка «Фаза (факт)» всегда показывала «Разгрузка» из-за приоритета
 *  операторов — `(week.phase || week.deload) ? 'deload' : 'accumulation'`: `||` связывает
 *  крепче `?:`, поэтому любая неделя с заполненным `phase` (то есть всегда) давала deload. */
export function weekPhaseOf(week: any): BBPhase {
  const raw = String((week as any)?.phase || '').toLowerCase();
  if (raw === 'deload' || (week as any)?.deload) return 'deload';
  if (raw === 'peaking' || raw === 'peak') return 'peaking';
  if (raw === 'intensification') return 'intensification';
  return 'accumulation';
}
export type PlanMode = 'generic_split' | 'bb_cycle' | 'programs';

export const WEAK_GROUPS = [
  ['chest','Грудь'],['chest_upper','Верх груди'],['chest_lower','Низ груди'],
  ['back','Спина'],['back_width','Ширина спины'],['back_thickness','Толщина спины'],
  ['shoulders','Плечи (общее)'],['delt_front','Передняя дельта'],['delt_mid','Средняя дельта'],['delt_rear','Задняя дельта'],
  ['quads','Квадрицепс'],['hamstrings','Бицепс бедра'],['glutes','Ягодицы'],['calves','Икры'],
  ['biceps','Бицепс'],['triceps','Трицепс'],['forearms','Предплечья'],
  ['abs','Пресс'],['traps','Трапеции'],
] as const;
export const BB_WM_KEYS = ['chest','back','quads','hamstrings','shoulders','biceps','triceps','glutes','calves','abs'] as const;
export const BB_WM_RU: Record<string,string> = { chest:'Грудь', back:'Спина', quads:'Квадрицепсы', hamstrings:'Бицепс бедра', shoulders:'Плечи', biceps:'Бицепс', triceps:'Трицепс', glutes:'Ягодичные', calves:'Икры', abs:'Пресс' };
export const TAG_LABELS_RU: Record<string, string> = {
  Push: 'Толкающие', Pull: 'Тянущие', Legs: 'Ноги', Upper: 'Верх', Lower: 'Низ',
  FullBody: 'Всё тело', Chest: 'Грудь', Back: 'Спина', Shoulders: 'Плечи', Arms: 'Руки',
  ChestBack: 'Грудь+Спина', ShouldersArms: 'Плечи+Руки', Torso: 'Торс', Limbs: 'Конечности',
  UpperPower: 'Верх(сила)', LowerPower: 'Низ(сила)', UpperHyp: 'Верх(гиперт)', LowerHyp: 'Низ(гиперт)',
  };
/**
 * Техники-подсказки по фазам (UI-тексты). Волна 5.5 (BB-AUTO-EXHAUSTIVE-PRO):
 * формулировки — тайм-эффективность/управление утомлением, не превосходство
 * (Sødal 2023: drop ≈ традиционные подходы, SMD 0.04; rest-pause — небольшой плюс;
 * Havers 2026 / Tsartsapakis 2026; Enes 2025 — темп минимально влияет при равном усилии).
 */
export const PHASE_TECHNIQUES: Record<BBPhase, string[]> = {
  accumulation: ['Темповые повторы (TUT)', 'Пауза в растянутой позиции', 'Суперсеты антагонистов'],
  intensification: ['Дроп-сеты (последний подход)', 'Рест-пауза (compounds)', 'Форсированные повторы (с партнёром)'],
  deload: ['Медленные негативы', 'Стрейч-пауза'],
  peaking: ['Околопредельные веса (RIR 0)', 'Кластеры 5×2'],
};

// P2-6: ограниченный кеш (max 8 записей — достаточно для типичных значений weeks 4-24).
const _phaseMapCache = new Map<string, Map<number, BBPhase>>();
export function getPhaseMap(totalWeeks: number, goal: string = 'mass'): Map<number, BBPhase> {
  const cacheKey = `${totalWeeks}:${goal}`;
  if (_phaseMapCache.has(cacheKey)) return _phaseMapCache.get(cacheKey)!;
  // P2-6: evict oldest if cache > 8 entries (anti-leak)
  if (_phaseMapCache.size >= 8) {
    const firstKey = _phaseMapCache.keys().next().value;
    if (firstKey) _phaseMapCache.delete(firstKey);
  }
  // P1: синхронизируем deloadFreq с движком buildBBPlan (deloadFreq = weeks>=6 ? 4 : 0),
  // иначе календарь/баннер показывал «без делода», а сгенерированный план содержал deload-неделю.
  const deloadFreq = totalWeeks >= 6 ? 4 : 0;
  const dist: PhaseDistribution[] = distributePhasesUnified(totalWeeks, deloadFreq, goal as any);
  const map = new Map<number, BBPhase>();
  for (const d of dist) {
    for (const w of d.weeks) {
      map.set(w, d.phase as BBPhase);
    }
  }
  for (let w = 1; w <= totalWeeks; w++) {
    if (!map.has(w)) map.set(w, 'accumulation' as BBPhase);
  }
  _phaseMapCache.set(cacheKey, map);
  return map;
}

export function phaseForWeek(week: number, totalWeeks: number, goal: string = 'mass'): BBPhase {
  return getPhaseMap(totalWeeks, goal).get(week) || 'accumulation';
}

/** Проверка: мышца в списке слабых групп (с учётом родительских групп). */
export function isWeakMuscle(muscle: string, weakPoints: string[]): boolean {
  if (weakPoints.includes(muscle)) return true;
  const PARENT: Record<string, string> = { delt_front: 'shoulders', delt_mid: 'shoulders', delt_rear: 'shoulders' };
  return weakPoints.includes(PARENT[muscle] ?? '');
}

export const DONOR_GROUPS: readonly (readonly [string, string])[] = [
  ['legs', 'Ноги (квадры+хамсы+ягодицы+икры)'],
  ['arms', 'Руки (бицепс+трицепс+предплечья)'],
  ['core', 'Кор'],
  ...WEAK_GROUPS,
];

export function normalizeDonorTargets(donors: string[], targets: string[] = []): string[] {
  const targetCanonical = targets.map(canonicalMuscle);
  const out: string[] = [];
  const expandedOut: string[] = [];
  for (const donor of donors) {
    if (!donor || out.includes(donor) || out.length >= 2) continue;
    const expanded = expandDonorMuscles([donor]);
    if (expanded.some(m => targetCanonical.includes(canonicalMuscle(m)))) continue;
    if (expanded.some(m => expandedOut.includes(canonicalMuscle(m)))) continue;
    out.push(donor);
    expandedOut.push(...expanded.map(canonicalMuscle));
  }
  return out;
}


/** Метка подгруппы спины (backSubgroup) для UI-бейджа. */
export function backSubgroupLabel(sub: string): string {
  switch (sub) {
    case 'back_width': return '📐 Ширина (латы)';
    case 'back_thickness': return '📐 Толщина';
    case 'upper_back': return '📐 Верх спины';
    case 'rear_delts': return '📐 Задние дельты';
    case 'traps': return '📐 Трапеции';
    case 'erectors': return '📐 Разгибатели';
    default: return '';
  }
}

/** Метка головки руки (movementPattern) для UI-бейджа. */
export function armHeadLabel(pattern: string): string {
  switch (pattern) {
    case 'biceps_lengthened': return '🦴 Длинная гол. (растяжка)';
    case 'biceps_shortened': return '🦴 Короткая гол.';
    case 'biceps_hammer': return '🦴 Брахиалис (молот)';
    case 'triceps_overhead': return '🦴 Длинная гол. (overhead)';
    case 'triceps_pushdown': return '🦴 Латер./мед. (pushdown)';
    case 'triceps_compound': return '🦴 Compound (жим узк.)';
    case 'forearm': return '🦴 Предплечья';
    default: return '';
  }
}

/** A/B-ротация реально применена в плане: хотя бы одна сессия несёт
 *  stash'нутый avoid (abAvoidPatterns). Тогл вкл ≠ применена: faithful
 *  дословно и недели без sibling-сессий ротацию не включают. */
export function isAbRotationActive(plan: any): boolean {
  try {
    return (plan?.weeks || []).some((w: any) => (w?.sessions || []).some((s: any) => ((s as any).abAvoidPatterns || []).length > 0));
  } catch { return false; }
}

/** Мини-чип для параметров упражнения (общий из training-ui). */

/* ─── Годовой план → ББ-авто: маппер контекста блока (he_bb_plan_saved_ctx) ─── */

/** Параметры шага «🏁 Contest prep», предзаполненные из контекста блока года. */
export interface AnnualBlockCtxToPrepPatch {
  peakWeekCategory: BBContestCategory;
  peakSpec: ContestSpecialization;
  prepShowDate: string;
  prepTaperWeeks: number;
  prepWeeks: number;
  prepWaterMode: WaterStrategy;
  prepSodiumMode: SodiumStrategy;
  prepCarbMode: CarbLoadStrategy;
  prepConfirmedManip: boolean;
}

/** Чистый маппер peakConfig блока годового плана → предзаполнение шага contest. */
export function annualBlockCtxToPrepPatch(
  ctx: { peakWeek?: boolean; weeks?: number; peakConfig?: Record<string, unknown> | null },
): AnnualBlockCtxToPrepPatch | null {
  if (!ctx.peakWeek || !ctx.peakConfig) return null;
  const cfg = ctx.peakConfig as Partial<BBContestPrepConfig>;
  const category = cfg.category && cfg.category in CATEGORY_PROFILES
    ? (cfg.category as BBContestCategory) : 'mens_physique';
  return {
    peakWeekCategory: category,
    peakSpec: cfg.specialization ?? 'none',
    prepShowDate: cfg.showDate ?? isoAddDays(isoToday(), 8 * 7),
    prepTaperWeeks: Number.isFinite(cfg.weeksOut) ? Math.min(4, Math.max(1, Math.round(cfg.weeksOut!))) : 2,
    prepWeeks: ctx.weeks && ctx.weeks > 0 ? Math.min(52, Math.max(1, Math.round(ctx.weeks))) : 12,
    prepWaterMode: canonicalWaterStrategy(cfg.waterStrategy ?? 'stable') as unknown as WaterStrategy,
    prepSodiumMode: canonicalSodiumStrategy(cfg.sodiumStrategy ?? 'stable') as unknown as SodiumStrategy,
    prepCarbMode: (cfg.carbLoadStrategy === 'front' ? 'high' : cfg.carbLoadStrategy === 'back' ? 'conservative' : 'moderate') as unknown as CarbLoadStrategy,
    prepConfirmedManip: !!cfg.confirmedManipulation,
  };
}

export function computePhases(totalWeeks: number, goal: string = 'mass'): { week: number; phase: BBPhase }[] {
  const phases: { week: number; phase: BBPhase }[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    const p = phaseForWeek(w, totalWeeks, goal);
    phases.push({ week: w, phase: p });
  }
  return phases;
}

export function exerciseComment(ex: BBExercise, weakPoints: string[], focusGroup: string, phase: BBPhase): string {
  const parts: string[] = [];
  const ruMuscle = (MUSCLE_LABEL_RU as any)[ex.muscle] || ex.muscle;
  // Роль упражнения — подробно
  if (ex.role === 'primary') {
    parts.push(`🎯 Основное движение для «${ruMuscle}» — тяжёлая база, главный стимул гипертрофии этой группы`);
    if (weakPoints.includes(ex.muscle)) parts.push(`🔥 Акцент на отстающую «${ruMuscle}» — дополнительный объём и приоритет в начале дня`);
    if (focusGroup === ex.muscle) parts.push(`⭐ Группа специализации «${ruMuscle}» — повышенный приоритет объёма`);
  } else {
    parts.push(`📌 Добивочное для «${ruMuscle}» — изоляция/добивка после базы, RIR 2-3, контроль техники`);
  }
  // Характер нагрузки — развёрнуто
  if (ex.character === 'тяж') parts.push('💪 Характер: тяж — 6-10 повторов, RIR 1-2, максимум механического натяга, отдых 2-3 мин');
  else if (ex.character === 'памп') parts.push('🩸 Характер: памп — 12-20 повторов, RIR 3, метаболический стресс и жжение, пауза 45-60 сек');
  else parts.push('🌿 Характер: лёгкий — техника/восстановление, RIR 4');
  // Фаза — адаптация
  const phaseDesc: Record<string, string> = {
    accumulation: 'Фаза «Накопление»: умеренный вес, больший объём, темп 3-1-1-0, акцент на растянутой позиции',
    intensification: 'Фаза «Интенсификация»: тяжёлый вес, RIR 1-2, темп 2-0-1-0, максимум напряжения',
    deload: 'Фаза «Разгрузка»: 50% объёма, RIR 3-4, лёгкие веса — восстановление ЦНС и суставов',
    peaking: 'Фаза «Пик»: минимальный объём, околопредельные веса RIR 0-1 — реализация силы',
  };
  if (phaseDesc[phase]) parts.push(`📅 ${phaseDesc[phase]}`);
  // Паттерн движения — по-русски, из каталога или movementPattern упражнения
  const catalogEx: any = EXERCISE_CATALOG.find((e: any) => e.name === ex.name || e.id === (ex as any).exerciseName);
  const rawPat = catalogEx?.movementPattern || (ex as any).movementPattern || '';
  const patRu = rawPat ? (SUMMARY_PATTERN_RU[rawPat] || rawPat) : '';
  if (patRu) parts.push(`🧬 Паттерн: ${patRu}`);
  // Дополнительные мышцы (синергисты) — по-русски
  if (catalogEx?.targetMuscle) {
    const targets = String(catalogEx.targetMuscle).split(',').map((t: string) => t.trim()).filter((t: string) => t && t !== ex.muscle);
    if (targets.length) parts.push(`🎯 Дополнительно нагружает: ${targets.map((t: string) => (MUSCLE_LABEL_RU as any)[t] || t).join(', ')}`);
  }
  // Суперсет / техника
  const ss = (ex as any).supersetWith;
  if (ss) parts.push(`🔗 Суперсет с «${ss}» — выполняется без отдыха между упражнениями пары`);
  const lastTech: any = (ex as any).workSets?.[ (ex as any).workSets.length - 1]?.technique;
  if (lastTech) {
    const tLabel = techniqueLabel(lastTech);
    if (tLabel) parts.push(`💥 Интенсив-техника: ${tLabel} на последнем подходе — продлевает сет за отказом`);
  }
  // Вес / RIR / отдых — факт плана
  const w = (ex as any).workSets?.[0]?.weight ?? 0;
  const r = (ex as any).workSets?.[0]?.reps ?? ex.sets;
  const rir = (ex as any).rir ?? 2;
  const rest = (ex as any).restSeconds ?? (ex as any).workSets?.[0]?.restSeconds;
  if (w) parts.push(`⚙️ Нагрузка плана: ${ex.sets}×${r} @ ${w} кг, RIR ${rir}${rest ? `, отдых ${rest} сек` : ''}`);
  return parts.join(' · ');
}

/** п.18: строка карточки «📍 Текущий блок года» для даты (null — нет плана/активного блока). */
export function annualActiveBlockLine(plan: AnnualTrainingPlan | null, iso: string): string | null {
  if (!plan) return null;
  const w = weekForDate(iso);
  const active = w != null ? activeBlockForWeek(plan, w) : null;
  if (!active) return null;
  const statusIcon = active.status === 'built' ? '✅' : active.status === 'stale' ? '⚠' : active.status === 'error' ? '❌' : '·';
  const statusLabel = active.status === 'built' ? 'собран' : active.status === 'stale' ? 'устарел' : active.status === 'error' ? 'ошибка' : 'не собран';
  const kindLabel = active.ref.kind === 'PL' ? 'ПЛ' : active.ref.kind === 'BB' ? 'ББ' : '✍ Ручной';
  const prepNote = active.ref.kind === 'BB' && active.ref.phase === 'contest_prep' && active.status === 'built'
    ? ' · 🏁 contest prep — настройте пик в «🏁 Contest prep»' : '';
  return `📍 Текущий блок года: нед ${w} · ${active.ref.phase} (${active.ref.startWeek}–${active.ref.startWeek + active.ref.weeks - 1}) · ${kindLabel} ${statusIcon} ${statusLabel}${prepNote}`;
}


/** Чип-кнопка для выбора акцентов/минимума/режима в Prep-цикле. */
export const chipBtn = (label: string, on = false, danger = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 11px', borderRadius: 12, cursor: 'pointer',
  minHeight: 36, fontSize: 11, fontWeight: on ? 800 : 600,
  background: on ? (danger ? 'rgba(239,68,68,0.18)' : 'rgba(236,72,153,0.18)') : 'rgba(255,255,255,0.04)',
  border: on ? `1px solid ${danger ? '#ef4444' : '#ec4899'}66` : '1px solid rgba(255,255,255,0.1)',
  color: on ? (danger ? '#f87171' : '#ec4899') : '#fff',
});

/**
 * 4.4: единый a11y-паттерн inline-модалок ББ-авто — role=dialog/aria-modal + Escape +
 * фокус на диалог/возврат фокуса (как TrainingModal; без визуального churn).
 */
export function useInlineDialogA11y(active: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!active) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => ref.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [active]);
  return ref;
}

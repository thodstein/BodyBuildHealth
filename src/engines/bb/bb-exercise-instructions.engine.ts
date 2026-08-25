/** Builds coach-facing execution notes from the Exercise Lab databases. */
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { getExerciseBio, hasExerciseBioEntry, type ExerciseBio } from '../../data/exercise-biomechanics-db';
import { getMappedBioId, getMappedIds } from '../../data/exercise-id-mapping';
import { getTargetMuscleForExercise, TARGET_MUSCLE_DB, type TargetMuscleEntry } from '../../data/target-muscle-db';
import { derivePattern } from '../movement-pattern';

export interface ExerciseInstructionInput {
  exerciseId?: string;
  exerciseName: string;
  muscle?: string;
  role?: 'primary' | 'accessory';
  phase?: string;
  trainingFocus?: 'strength' | 'hypertrophy' | 'endurance';
  /** Уровень спортсмена — адаптирует темп/технику (новичок: безопаснее, продвинутый: про-кью). */
  level?: string;
  tempo?: string;
  restSeconds?: number;
  orderIndex?: number;
  totalExercises?: number;
  intensityTechnique?: string;
}

export interface ExerciseInstructionProfile {
  pattern: string;
  cues: string[];
  stretch?: string;
  peak?: string;
  mmc?: string;
  tempo: string;
  restSeconds?: number;
  order: string;
  progression: string;
  mistakes: string[];
  intensityTechnique?: string;
  source: 'exercise-lab' | 'catalog' | 'generic';
}

const EXERCISE_ID_ALIASES: Record<string, string> = {
  pull_down_wide: 'pulldown_wide',
  lat_pulldown_wide: 'pulldown_wide',
  incline_bench: 'incline_bar',
};

const PATTERN_RU: Record<string, string> = {
  vertical_pull: 'вертикальная тяга',
  horizontal_pull: 'горизонтальная тяга',
  horizontal_push: 'горизонтальный жим',
  vertical_push: 'вертикальный жим',
  squat: 'приседательный паттерн',
  hinge: 'тазобедренный шарнир',
  knee_flexion: 'сгибание колена',
  hip_extension: 'разгибание бедра',
  shoulder_abduction: 'отведение плеча',
  elbow_flexion: 'сгибание локтя',
  elbow_extension: 'разгибание локтя',
};

function findBio(input: ExerciseInstructionInput): { bio?: ExerciseBio; target?: TargetMuscleEntry; id?: string; hasLabBio: boolean } {
  const catalog = input.exerciseId
    ? EXERCISE_CATALOG.find(e => e.id === input.exerciseId)
    : EXERCISE_CATALOG.find(e => e.name.toLowerCase() === input.exerciseName.toLowerCase());
  const id = input.exerciseId || catalog?.id;
  const resolvedId = id ? (EXERCISE_ID_ALIASES[id] || id) : undefined;
  const mapped = resolvedId ? getMappedBioId(resolvedId) : undefined;
  // getExerciseBio имеет generic-fallback — bio truthy даже без записи.
  // hasLabBio фиксирует РЕАЛЬНОЕ покрытие (прямая запись или маппинг).
  const hasLabBio = (mapped ? hasExerciseBioEntry(mapped) : false) || (resolvedId ? hasExerciseBioEntry(resolvedId) : false);
  const bio = (mapped ? getExerciseBio(mapped) : undefined) || (resolvedId ? getExerciseBio(resolvedId) : undefined);
  const targetId = id && getTargetMuscleForExercise(id) ? id : resolvedId;
  let target = targetId ? getTargetMuscleForExercise(targetId) : undefined;
  if (!target && targetId) {
    target = Object.values(TARGET_MUSCLE_DB).find(entry => entry.exerciseMask.includes(targetId));
  }
  return { bio, target, id: resolvedId, hasLabBio };
}

function catalogInstruction(input: ExerciseInstructionInput, id?: string) {
  const entry = EXERCISE_CATALOG.find(e => e.id === id || e.name.toLowerCase() === input.exerciseName.toLowerCase());
  if (!entry) return undefined;
  return {
    pattern: PATTERN_RU[entry.movementPattern || ''] || entry.movementPattern || entry.group,
    cues: entry.technique ? [entry.technique] : [],
    stretch: entry.stretchPhase ? 'Контролируйте растяжение в нижней точке без потери положения суставов.' : undefined,
    peak: entry.peakContraction ? 'В конечной точке удерживайте максимальное сокращение 1 сек.' : undefined,
    mistakes: entry.comments ? [entry.comments] : [],
  };
}

function defaultTempo(focus?: ExerciseInstructionInput['trainingFocus'], level?: string): string {
  const lvl = (level || '').toLowerCase();
  // Новичок: более медленный, контролируемый темп (безопаснее). Продвинутый: стандарт.
  if (lvl === 'beginner' || lvl === 'новичок') return focus === 'strength' ? '3-0-2-0' : focus === 'endurance' ? '3-0-3-0' : '3-1-2-1';
  return focus === 'strength' ? '2-0-1-0' : focus === 'endurance' ? '2-0-2-0' : '3-1-1-1';
}

function orderLabel(input: ExerciseInstructionInput): string {
  if (input.role === 'primary' && (input.orderIndex == null || input.orderIndex === 0)) return 'первое основное упражнение дня';
  if (input.role === 'primary') return 'основное упражнение после первого движения';
  if (input.intensityTechnique) return 'добивочное упражнение после базовых движений';
  return 'добивочное упражнение в конце блока мышцы';
}

/** Returns detailed instructions suitable for BBPlan.comment and exports. */
export function buildExerciseInstructions(input: ExerciseInstructionInput): ExerciseInstructionProfile {
  const { bio, target, id, hasLabBio } = findBio(input);
  const catalog = catalogInstruction(input, id);
  const derived = derivePattern({ name: input.exerciseName, group: input.muscle, type: 'compound', targetMuscle: input.muscle } as any);
  const pattern = PATTERN_RU[bio?.pattern || ''] || PATTERN_RU[catalog?.pattern || ''] || PATTERN_RU[derived || ''] || bio?.pattern || catalog?.pattern || derived || input.muscle || 'силовой паттерн';
  const labCues = [...(bio?.techniqueCues || []), ...(target?.techniqueCues || [])].filter((cue, i, all) => all.indexOf(cue) === i);
  const catalogCue = catalog?.cues?.[0];
  let cues = catalogCue
    ? [...labCues.filter(cue => cue !== catalogCue).slice(0, 4), catalogCue]
    : labCues.slice(0, 5);
  // Добивка до 3-4 ключей, чтобы техника не была скудной
  const needCues = 4 - cues.length;
  if (needCues > 0) {
    const fallbackByPattern: Record<string, string[]> = {
      'жим': [
        'Лопатки сведены и опущены, грудь «колесом», ягодицы и поясница — естественный прогиб, стопы в пол',
        'Хват чуть шире плеч, локти 70-75° к корпусу, гриф опускается к нижней груди без отбива, пауза 1с внизу',
        'Выдох на подъёме, контролируемый эксцентрик 2-3с, не сводите локти полностью вверху — держите напряжение',
      ],
      'тяга': [
        'Тяните локтями, а не кистями, сводите лопатки к позвоночнику в конце, грудь вперёд',
        'Корпус стабилен, без рывков и читинга, спина — нейтраль, гриф близко к телу',
        'Пауза 1с в сокращении, медленный негатив 2с — чувствуйте широчайшую, не бицепс',
      ],
      'присед': [
        'Стопы на ширине плеч, носки чуть наружу, колени идут по линии носков, грудь вверх',
        'Глубина — бёдра ниже параллели, таз не подкручивается («клевок» запрещён), вес на середине стопы',
        'Колени не заваливаются внутрь, подъём — толчком пяток, выдох на вставании',
      ],
      'шарнир': [
        'Таз назад, штанга скользит по ногам, спина — жёсткая нейтраль, взгляд вперёд',
        'Чувствуйте растяжение бицепса бедра внизу, без округления поясницы, таз — шарнир',
        'Сокращение — толчком ягодиц вперёд, пауза 1с вверху, медленно вниз 3с',
      ],
      'отведение': [
        'Мах до уровня плеч, локти чуть согнуты, большой палец чуть вниз, без раскачки корпусом',
        'Ведите локтями, а не кистями, пауза 1с вверху, медленно вниз 2с — жжение в средней дельте',
      ],
      'сгибание': [
        'Локти прижаты к корпусу, без раскачки, супинация вверху для пика бицепса',
        'Опускание 2-3с, растяжение внизу 1с, не бросайте вес — контролируйте негатив',
      ],
      'разгибание': [
        'Локти неподвижны, фиксированы у корпуса, разгибание до полного выпрямления с паузой 1с',
        'Не читингуйте корпусом, негатив 2с, чувствуйте трицепс, не плечи',
      ],
      'икры': [
        'Полная амплитуда: внизу — максимум растяжения 2с, вверху — подъём на носки с паузой 1-2с',
        'Прямое колено для икроножной (стоя), согнутое 90° для камбаловидной (сидя)',
      ],
      'пресс': [
        'Скручивание — поднимайте лопатки, а не поясницу, подбородок к груди, выдох на усилии',
        'Пауза 1с вверху, медленно вниз 2с, держите пресс напряжённым всю серию',
      ],
    };
    const pickFallback = (): string[] => {
      const lowerPat = pattern.toLowerCase();
      for (const [key, arr] of Object.entries(fallbackByPattern)) {
        if (lowerPat.includes(key)) return arr;
      }
      const lowerName = input.exerciseName.toLowerCase();
      for (const [key, arr] of Object.entries(fallbackByPattern)) {
        if (lowerName.includes(key)) return arr;
      }
      return ['Контролируйте траекторию, без рывков, полная амплитуда, дыхание — выдох на усилии.'];
    };
    const fb = pickFallback();
    for (let i = 0; i < needCues && i < fb.length; i++) {
      if (!cues.includes(fb[i])) cues.push(fb[i]);
    }
    while (cues.length < 3) cues.push('Держите кор, лопатки стабильны, без читинга — качество важнее веса.');
  }
  const tempo = input.tempo || target?.tempoRecommendation || defaultTempo(input.trainingFocus, input.level);
  const order = orderLabel(input);
  const lvl = (input.level || '').toLowerCase();
  const progression = input.trainingFocus === 'strength'
    ? 'Повышайте вес после выполнения всех сетов в верхней границе повторов при заданном RIR.'
    : lvl === 'beginner' || lvl === 'новичок'
      ? 'Сначала освойте технику (темп 3-1-2-1), затем добавляйте повторы до верхней границы, потом повышайте вес минимальным шагом.'
      : 'Сначала добавляйте повторы до верхней границы, затем повышайте вес минимальным шагом.';
  // Фолбеки для растяжки/пика/mmc/mistakes, чтобы вкладки не были пустыми
  const fallbackStretch = (() => {
    const p = pattern.toLowerCase();
    if (p.includes('жим')) return 'Внизу — пауза 1-2с с растяжением груди, лопатки сведены, без отбива. Растянутая — ключ к росту.';
    if (p.includes('тяга')) return 'В растянутой — полный вынос/опускание с растяжением широчайших 1с, лопатки не округлять.';
    if (p.includes('присед')) return 'Внизу — глубокая посадка с растяжением ягодиц/квадрицепсов, колени наружу, без «клевка» таза.';
    if (p.includes('шарнир')) return 'Внизу — максимум растяжения бицепса бедра/ягодиц, таз назад, спина нейтраль.';
    if (p.includes('отведение') || p.includes('мах')) return 'Внизу — рука опущена с лёгким растяжением дельты, не расслабляйте полностью.';
    return 'Контролируйте растянутую фазу — пауза 1-2с внизу, без потери натяжения.';
  })();
  const fallbackPeak = (() => {
    const p = pattern.toLowerCase();
    if (p.includes('жим')) return 'Вверху — сведение/выпрямление с пиковым сокращением 1с, не сводите локти до щелчка.';
    if (p.includes('тяга')) return 'Вверху — сведение лопаток и пиковое сокращение спины 1с, локти к корпусу.';
    if (p.includes('сгибание') || p.includes('бицепс')) return 'Вверху — супинация и пиковое сокращение бицепса 1с, без закидывания.';
    return 'В пиковой точке — задержка 1-2с с максимальным сокращением целевой мышцы.';
  })();
  const fallbackMmc = (() => {
    const m = (input.muscle || '').toLowerCase();
    if (m === 'back') return 'Представляйте, что тянете локтями к карманам, а не руками — так включится спина, а не бицепс.';
    if (m === 'chest') return 'Думайте, что обнимаете дерево/толкаете локтями вперёд — так включится грудь, а не трицепс.';
    if (m === 'quads') return 'Толкайте пятками/серединой стопы, колени наружу — чувствуйте квадрицепс, не поясницу.';
    if (m === 'hamstrings' || m === 'glutes') return 'Толкайте ягодицами вперёд, таз — шарнир, чувствуйте растяжение сзади бедра.';
    if (m === 'shoulders') return 'Ведите локтями, а не кистями — так включится дельта, а не трапеция.';
    return 'Медленно, под контролем — чувствуйте целевую мышцу, не вес.';
  })();
  const fallbackMistakes = (() => {
    const p = pattern.toLowerCase();
    if (p.includes('жим')) return ['Отбив от груди', 'Сведение локтей слишком широко', 'Отрыв ягодиц от скамьи', 'Неполная амплитуда'];
    if (p.includes('тяга')) return ['Рывки корпусом', 'Тяга руками вместо спины', 'Округление поясницы', 'Неполное сведение лопаток'];
    if (p.includes('присед')) return ['Завал коленей внутрь', 'Округление спины («клевок»)', 'Недостаточная глубина', 'Подъём пяток'];
    return ['Читинг корпусом', 'Неполная амплитуда', 'Слишком быстрый негатив', 'Задержка дыхания'];
  })();
  // Честный источник: exercise-lab ТОЛЬКО при реальной записи (bio БЕЗ generic-fallback)
  // или target-muscle покрытии. Иначе — каталог (есть техника) или generic.
  const source = hasLabBio || target ? 'exercise-lab'
    : id || EXERCISE_CATALOG.some(e => e.name === input.exerciseName) ? 'catalog' : 'generic';
  const finalMistakes = [...(target?.commonMistakes || []), ...(catalog?.mistakes || [])];
  while (finalMistakes.length < 3) {
    const fb = fallbackMistakes[finalMistakes.length % fallbackMistakes.length];
    if (!finalMistakes.includes(fb)) finalMistakes.push(fb);
  }
  return {
    pattern,
    cues,
    stretch: target?.stretchKey || catalog?.stretch || fallbackStretch,
    peak: target?.peakKey || catalog?.peak || fallbackPeak,
    mmc: target?.mmc || fallbackMmc,
    tempo,
    restSeconds: input.restSeconds,
    order,
    progression,
    mistakes: finalMistakes.slice(0, 4),
    intensityTechnique: input.intensityTechnique,
    source,
  };
}

/** Очистить текст инструкции от «мусора» пунктуации: двойные точки/точка-пробел-точка,
 *  «!./?», лишние пробелы и хвостовые разделители, остающиеся при склейке cue-строк
 *  и отдельных частей комментария. Возвращает одну чистую фразу. */
export function cleanInstructionsText(text: string): string {
  if (!text) return text;
  return text
    .replace(/\.\s+\./g, '. ')      // ". ." → ". " (двойной период с пробелом)
    .replace(/\.{2,}/g, '.')        // "..", "..." → "."
    .replace(/([!?])\./g, '$1')     // "!." → "!", "?." → "?"
    .replace(/,\s*,/g, ',')         // ", ," → ","
    .replace(/\s{2,}/g, ' ')        // схлопнуть лишние пробелы
    .replace(/\s+([.,!?])/g, '$1')  // убрать пробел перед знаком препинания
    .replace(/[.,!?\s]+$/g, '')     // убрать хвостовые разделители
    .trim();
}

export function formatExerciseInstructions(input: ExerciseInstructionInput): string {
  const p = buildExerciseInstructions(input);
  const parts = [`Паттерн: ${p.pattern}`, `Порядок: ${p.order}`];
  if (p.cues.length) parts.push(`Техника: ${p.cues.join('; ')}`);
  if (p.stretch) parts.push(`Растяжение: ${p.stretch}`);
  if (p.peak) parts.push(`Пиковое напряжение: ${p.peak}`);
  if (p.mmc) parts.push(`Связь мышца-мозг: ${p.mmc}`);
  parts.push(`Темп: ${p.tempo}${tempoExplain(p.tempo) ? ` (${tempoExplain(p.tempo)})` : ''}${p.restSeconds ? `, отдых ${p.restSeconds} сек` : ''}`);
  if (p.intensityTechnique) parts.push(`Техника интенсивности: ${p.intensityTechnique}`);
  parts.push(`Прогрессия: ${p.progression}`);
  if (p.mistakes.length) parts.push(`Ошибки: ${p.mistakes.slice(0, 3).join('; ')}`);
  return cleanInstructionsText(parts.join('. '));
}

/** Человекочитаемое пояснение темпа: «2-0-1-0» → «опуск 2с, подъём 1с». */
export function tempoExplain(tempo: string): string {
  const parts = (tempo || '').split('-').map(s => s.trim());
  if (parts.length !== 4 || parts.some(p => p === '' || isNaN(Number(p)))) return '';
  const n = parts.map(Number);
  const seg: string[] = [];
  if (n[0] > 0) seg.push(`опуск ${n[0]}с`);
  if (n[1] > 0) seg.push(`пауза внизу ${n[1]}с`);
  if (n[2] > 0) seg.push(`подъём ${n[2]}с`);
  if (n[3] > 0) seg.push(`пауза вверху ${n[3]}с`);
  return seg.join(', ');
}

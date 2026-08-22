/**
 * bb-tempo-rest.ts — темп, TUT, интервалы отдыха по характеру дня (Этап BB12, NEW).
 */
export type DayCharacter = 'тяж' | 'памп' | 'лёг';

export interface TempoSpec { eccentric: number; pause: number; concentric: number; notation: string; tutPerRep: number; }

export const TEMPO_BY_CHARACTER: Record<DayCharacter, TempoSpec> = {
  тяж:  { eccentric: 2, pause: 1, concentric: 1, notation: '2-1-1-0', tutPerRep: 4 },
  памп: { eccentric: 3, pause: 0, concentric: 1, notation: '3-0-1-0', tutPerRep: 4 },
  лёг:  { eccentric: 2, pause: 0, concentric: 1, notation: '2-0-1-0', tutPerRep: 3 },
};

export const REST_BY_CHARACTER: Record<DayCharacter, number> = {
  тяж: 180,  // 2-4 мин → 180с
  памп: 60,  // 45-90с → 60с
  лёг: 90,
};

/** TUT сета = tempo.tutPerRep × reps. */
export function tutForSet(reps: number, character: DayCharacter): number {
  return TEMPO_BY_CHARACTER[character].tutPerRep * reps;
}

/**
 * FIX-B2: Per-exercise tempo overrides — проф-тренер назначает разный темп
 * разным упражнениям (не один темп на всю фазу).
 * - Тяжёлые многосуставные (присед/становая/жим): 2-0-1-0 (взрывной концентрический)
 * - Растянутые упражнения (RDL/наклонный жим): 3-1-1-0 (пик растяжения)
 * - Изоляция на пиковое сокращение (cable fly/leg curl): 3-2-1-0 (задержка в пике)
 * - Махи/face pull: 2-1-1-1 (ритм, контроль)
 */
const EXERCISE_TEMPO_OVERRIDES: Record<string, string> = {
  // Тяжёлые compound — взрывной концентрический, пауза внизу для натяжения
  'присед': '2-0-1-0',
  'squat': '2-0-1-0',
  'становая': '2-0-1-0',
  'deadlift': '2-0-1-0',
  'жим штанги': '2-0-1-0',
  'bench press': '2-0-1-0',
  'жим лёжа': '2-0-1-0',
  'army press': '2-0-1-0',
  'жим стоя': '2-0-1-0',
  // Растянутые — длинный эксцентрик, пауза в растянутой позиции
  'румынская': '3-1-1-0',
  'rdl': '3-1-1-0',
  'наклонной': '3-1-1-0',
  'наклонный жим': '3-1-1-0',
  'incline': '3-1-1-0',
  'сисси': '4-1-1-0',
  'sissy': '4-1-1-0',
  // Пиковое сокращение — задержка в укороченной позиции
  'кроссовер': '3-2-1-0',
  'crossover': '3-2-1-0',
  'сведение': '3-2-1-0',
  'fly': '3-2-1-0',
  'leg curl': '3-2-1-0',
  'сгибание ног': '3-2-1-0',
  'leg extension': '3-0-1-1',
  'разгибание ног': '3-0-1-1',
  // Ритм/контроль — махи, face pull
  'махи': '2-1-1-1',
  'lateral raise': '2-1-1-1',
  'face pull': '2-1-1-1',
  'тяга к лицу': '2-1-1-1',
};

/** Найти per-exercise tempo override по имени упражнения. */
export function exerciseTempoOverride(name: string): string | undefined {
  const n = (name || '').toLowerCase();
  // Более специфичные ключи первыми (длиннее → приоритет), чтобы «жим штанги» не перекрывал «жим штанги на наклонной»
  const keys = Object.keys(EXERCISE_TEMPO_OVERRIDES).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (n.includes(key)) return EXERCISE_TEMPO_OVERRIDES[key];
  }
  return undefined;
}

/** Темп под характер + опционально phase (ACSM 2023: eccentric 2-4с) + интенс-технику. */
export function tempoFor(character: DayCharacter, technique?: string, phase?: string, exerciseName?: string): TempoSpec {
  const base = { ...TEMPO_BY_CHARACTER[character] };
  // Deload фаза доминирует над per-exercise override (восстановление важнее специфики)
  if (phase === 'deload' && exerciseName) {
    const override = exerciseTempoOverride(exerciseName);
    // для deload всё равно используем фазовый темп 4-2-2-0, но сохраняем логику tut
    if (override) {
      // пропускаем override, переходим к фазе
    }
  } else if (exerciseName) {
    const override = exerciseTempoOverride(exerciseName);
    if (override) {
      const parts = override.split('-').map(Number);
      if (parts.length === 4 && parts.every(p => !isNaN(p))) {
        base.eccentric = parts[0];
        base.pause = parts[1];
        base.concentric = parts[2];
        base.notation = override;
        base.tutPerRep = base.eccentric + base.pause + base.concentric + parts[3];
        // если фаза deload —Override игнорируется, перезапишется ниже
        if (phase !== 'deload') return base;
      }
    }
  }
  // Phase-based eccentric emphasis (ACSM 2023: accumulation 3с, peaking 2с, deload 4с)
  if (phase) {
    const phaseTempo: Record<string, string> = {
      accumulation: '3-1-1-0',
      intensification: '2-1-1-0',
      peaking: '2-0-1-0',
      deload: '4-2-2-0',
    };
    const pt = phaseTempo[phase];
    if (pt) {
      const parts = pt.split('-').map(Number);
      if (parts.length === 4 && parts.every(p => !isNaN(p))) {
        base.eccentric = parts[0];
        base.pause = parts[1];
        base.concentric = parts[2];
        base.notation = pt;
        base.tutPerRep = parts[0] + parts[1] + parts[2] + parts[3];
      }
    }
  }
  if (technique === 'slow_eccentric' || technique === 'negatives') {
    base.eccentric = 4; base.notation = '4-0-1-0'; base.tutPerRep = 5;
  }
  return base;
}
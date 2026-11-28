/**
 * arm-calibration.engine.ts — калибровка рабочих максимумов по тесту (аудит 2026-11, P0-1).
 *
 * Проблема: без ручного workMax весь план идёт «по RIR» (вес 0), а подставлять массу
 * тела нельзя — это давало пронацию 15×65.5 кг у атлета 80 кг. Нужен безопасный
 * способ получить максимумы из ОДНОГО подхода: 5–8 повторов до RIR 2 (или холд).
 *
 * Оценка e1RM — Эпли с поправкой на RIR (эффективные повторы = повторы + RIR):
 * это стандартная практика RIR-калибровки (Zourdos 2016, RPE/RIR-шкала), не
 * медицинский факт. Для холдов — уже существующая holdE1RM (10с ≈ 100%).
 *
 * Модуль чистый: не импортирует builder, не пишет в стор.
 */
import { armEpley1RM, holdE1RM } from './arm-load-quant.engine';
import { resolveArmLevelByTests, type BenchLevel } from './arm-benchmarks.engine';
import type { ArmCalibrationEntry, ArmCalibrationExercise } from './arm-types';

export type { ArmCalibrationEntry, ArmCalibrationExercise } from './arm-types';

export interface ArmCalibrationResult {
  /** Патч workMax по каноническим ключам мышц (builder: weightForMuscle). */
  workMaxPatch: Record<string, number>;
  /** Уровень по тестам (arm-benchmarks), если данных достаточно. */
  level: BenchLevel | null;
  /** measured — валлидный тест в окне 1–8 повт / ≤15 с; estimated — вне окна; insufficient — нет данных. */
  confidence: 'measured' | 'estimated' | 'insufficient';
  notes: string[];
}

const round05 = (v: number): number => Math.round(v * 2) / 2;

/** Один тест → оценка максимума (кг) и пометка достоверности. */
function estimateEntry(
  entry: ArmCalibrationEntry,
): { key: string; kg: number; confidence: 'measured' | 'estimated'; note: string } | null {
  const weight = Number(entry.weightKg);
  const reps = Number(entry.reps);
  const rir = Number(entry.rir ?? 0);
  const hold = Number(entry.holdSec);
  switch (entry.exercise) {
    case 'wrist_curl':
    case 'rolling_thunder':
    case 'side_press': {
      if (!Number.isFinite(weight) || weight <= 0) return null;
      const key =
        entry.exercise === 'wrist_curl'
          ? 'wrist_flexors'
          : entry.exercise === 'rolling_thunder'
            ? 'grip_support'
            : 'side_pressure';
      // Сингл (reps=1) — это максимум только при RIR 0. С RIR>0 вес не максимальный,
      // и «measured» врал бы (review 2026-11). Без повторов для сгибания кисти
      // калибровать нечем — честный null (для RT/бокового сингл — норма).
      if (!Number.isFinite(reps) || reps <= 1) {
        if (entry.exercise === 'wrist_curl') return null;
        const measured = !Number.isFinite(rir) || rir <= 0;
        return {
          key,
          kg: round05(weight),
          confidence: measured ? 'measured' : 'estimated',
          note: `${key}: ${round05(weight)} кг (сингл${measured ? '' : ` @RIR${rir} — не максимум`})`,
        };
      }
      const effReps = Math.max(1, Math.min(15, Math.round(reps + (Number.isFinite(rir) ? rir : 0))));
      const e1 = armEpley1RM(weight, Math.min(12, effReps));
      if (e1 == null) {
        // >12 эффективных повторов — Эпли вне валидного окна, берём как ориентир.
        return {
          key,
          kg: round05(weight),
          confidence: 'estimated',
          note: `${key}: ${round05(weight)} кг (${reps}+RIR${rir} — вне окна Эпли, ориентир)`,
        };
      }
      const measured = reps <= 8;
      return {
        key,
        kg: e1,
        confidence: measured ? 'measured' : 'estimated',
        note: `${key}: ${weight} кг × ${reps} @RIR${rir} → e1RM ${e1} кг${measured ? '' : ' (высокие повторы — оценка)'}`,
      };
    }
    case 'pronation_hold':
    case 'cup_hold': {
      if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(hold) || hold <= 0) return null;
      const e1 = holdE1RM(weight, hold);
      if (e1 == null) return null;
      const key = entry.exercise === 'pronation_hold' ? 'pronators' : 'wrist_flexors';
      return {
        key,
        kg: e1,
        confidence: hold <= 15 ? 'measured' : 'estimated',
        note: `${key}: холд ${weight} кг × ${hold} с → максимум ${e1} кг`,
      };
    }
    case 'coc': {
      const raw = Number(entry.cocLevel);
      // Верхний кламп: CoC 0…4 (Trainer…No.4). Без него опечатка «20» давала
      // grip_crush = 500 кг и план на 410 кг (review 2026-11).
      if (!Number.isFinite(raw) || raw < 0 || raw > 4) return null;
      const lvl = Math.round(raw * 2) / 2;
      // Та же эвристика, что в workMaxFromBenchmarks (25 кг на ступень) — помечено «оценка».
      return {
        key: 'grip_crush',
        kg: round05(lvl * 25),
        confidence: 'estimated',
        note: `grip_crush: CoC ${lvl} → ${round05(lvl * 25)} кг (оценка по ступени, не замер)`,
      };
    }
    default:
      return null;
  }
}

/**
 * Калибровка из набора тестов. Возвращает патч workMax + честную достоверность.
 * Пользовательский workMax всегда приоритетнее — мерж делает вызывающий.
 */
export function calibrateArmWorkMax(
  entries: ArmCalibrationEntry[] | undefined,
  opts?: { bodyWeightKg?: number },
): ArmCalibrationResult {
  const out: ArmCalibrationResult = { workMaxPatch: {}, level: null, confidence: 'insufficient', notes: [] };
  if (!Array.isArray(entries) || entries.length === 0) {
    out.notes.push('Калибровка: нет замеров — веса остаются «по RIR».');
    return out;
  }
  let measured = 0;
  let estimated = 0;
  const rank: Record<'measured' | 'estimated', number> = { measured: 2, estimated: 1 };
  const kept: Record<string, 'measured' | 'estimated'> = {};
  for (const entry of entries) {
    try {
      const est = estimateEntry(entry);
      if (!est) continue;
      const prevKg = out.workMaxPatch[est.key];
      const prevConf = kept[est.key];
      if (prevKg != null && prevConf) {
        // Более достоверный замер важнее; при равной достоверности — больший вес
        // (cup-холд не должен перетирать прямое сгибание кисти вниз, review 2026-11).
        if (rank[est.confidence] < rank[prevConf]) continue;
        if (rank[est.confidence] === rank[prevConf] && est.kg <= prevKg) continue;
      }
      out.workMaxPatch[est.key] = est.kg;
      kept[est.key] = est.confidence;
      if (est.confidence === 'measured') measured++;
      else estimated++;
      out.notes.push(est.note);
    } catch {
      /* один битый замер не ломает калибровку */
    }
  }
  if (Object.keys(out.workMaxPatch).length === 0) {
    out.notes.push('Калибровка: замеры не распознаны (нужны вес и повторы/холд).');
    return out;
  }
  out.confidence = measured > 0 ? 'measured' : 'estimated';
  try {
    const b = resolveArmLevelByTests({
      wristCurlLb: out.workMaxPatch['wrist_flexors'] ? out.workMaxPatch['wrist_flexors'] / 0.4536 : undefined,
      rtKg: out.workMaxPatch['grip_support'],
      sideKg: out.workMaxPatch['side_pressure'],
      // CoC Trainer = 0 — валидный уровень, не отбрасываем его тернарником.
      cocLevel: out.workMaxPatch['grip_crush'] != null ? out.workMaxPatch['grip_crush'] / 25 : undefined,
      bwKg: Number(opts?.bodyWeightKg) > 0 ? Number(opts?.bodyWeightKg) : undefined,
    });
    out.level = b.level;
    out.notes.push(`Уровень по тестам: ${b.level} (средний балл ${b.avgScore}).`);
  } catch {
    out.level = null;
  }
  if (measured === 0)
    out.notes.push('Все замеры — оценочные (высокие повторы/ступени): перепроверьте на 5–8 повторах.');
  return out;
}

/** Протокол калибровочной недели: что и как тестировать (практика, не мед. предписание). */
export function armCalibrationProtocol(): Array<{ exercise: ArmCalibrationExercise; label: string; target: string }> {
  return [
    { exercise: 'wrist_curl', label: 'Сгибание кисти (ремень/штанга)', target: '1 подход 5–8 повт @RIR 2' },
    { exercise: 'pronation_hold', label: 'Пронация — холд на блоке', target: 'холд до отказа, 10–20 с' },
    { exercise: 'cup_hold', label: 'Кисть — cup-холд', target: 'холд 10–20 с на рабочем весе' },
    { exercise: 'rolling_thunder', label: 'Rolling Thunder', target: '1 сингл (максимум)' },
    { exercise: 'side_press', label: 'Боковое давление', target: '1 сингл или 3–5 повт' },
    { exercise: 'coc', label: 'Эспандер CoC', target: 'закрытый уровень (0…4)' },
  ];
}

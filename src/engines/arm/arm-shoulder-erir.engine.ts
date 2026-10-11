/**
 * arm-shoulder-erir.engine.ts — баланс ротаторов плеча (ER:IR) для армрестлинга.
 *
 * Зачем: Pascoa et al. (PMC12904635, 2026) на 17 спортсменах международного уровня
 * замерили на Biodex пиковый torque вращателей плеча: **внешняя ротация 58.9 Нм
 * против внутренней 102.7 Нм** → ER/IR ≈ **0.57**, при этом нормативные значения
 * для силы и мощности — около **0.64–0.66**. Тот же перекос во внутреннюю ротацию —
 * часть механики перелома плеча (ротационный момент subscapularis/pectoralis/
 * latissimus против силы соперника, PMC3560640).
 *
 * Для здоровых людей норма ER:IR (IJSPT-2023, n=181) — 0.71–0.86; <0.75 считается
 * дисбалансом. Мы не лечим, а ЧЕСТНО показываем: «внешняя ротация отстаёт —
 * добавьте ER-работу» (плечо — стабилизатор side/hook, а не только целевая мышца).
 *
 * Чистый модуль: без UI/storage.
 */

export interface ErIrInput {
  /** Пиковый момент/сила внешней ротации (Нм или кг — важно одно измерение). */
  erKg?: number | null;
  /** Пиковый момент/сила внутренней ротации (тем же способом). */
  irKg?: number | null;
}

export type ErIrZone = 'ok' | 'watch' | 'risk' | 'no_data';

export interface ErIrVerdict {
  ratio: number | null;
  zone: ErIrZone;
  /** Короткая строка для UI-чипа: «ER:IR 0.62 — отстаёт внешняя ротация». */
  line: string;
  /** Что делать (одна переменная): упражнения внешней ротации 2×/нед. */
  fix: string | null;
  /** Показывать ли предупреждение в findings (>=watch). */
  warn: boolean;
}

/**
 * Нормативы (подписаны источниками, не выдуманы):
 * - 0.75 — нижняя граница нормы здоровых (IJSPT-2023);
 * - 0.64 — нижняя граница нормативных значений Pascoa-2026 (0.64 сила / 0.66 мощность);
 * - 1.15 — заведомо suspicious-замер (ER не может быть >> IR) → проверить методику.
 */
export const ERIR_RATIO_MIN = 0.75;
export const ERIR_ATHELETE_MIN = 0.64;
export const ERIR_RATIO_HIGH = 1.15;

export function erIrRatio(er?: number | null, ir?: number | null): number | null {
  const e = Number(er);
  const i = Number(ir);
  if (!Number.isFinite(e) || !Number.isFinite(i) || e <= 0 || i <= 0) return null;
  return Math.round((e / i) * 100) / 100;
}

export function erIrVerdict(input: ErIrInput): ErIrVerdict {
  const ratio = erIrRatio(input.erKg, input.irKg);
  if (ratio == null) {
    return { ratio: null, zone: 'no_data', line: 'ER:IR — нет замера (внешняя/внутренняя ротация)', fix: null, warn: false };
  }
  if (ratio > ERIR_RATIO_HIGH) {
    return {
      ratio,
      zone: 'watch',
      line: `ER:IR ${ratio} — проверьте замер: внешняя ротация не может быть намного больше внутренней`,
      fix: 'Перепроверьте методику (одинаковое положение, одинаковая амплитуда).',
      warn: true,
    };
  }
  if (ratio < ERIR_ATHELETE_MIN) {
    return {
      ratio,
      zone: 'risk',
      line: `ER:IR ${ratio} — внешняя ротация отстаёт сильно (норма здоровых ${ERIR_RATIO_MIN}, у армрестлеров ~0.57 — Pascoa 2026)`,
      fix: 'Внешняя ротация (face-pull/отведение с резиной) 2–3×5–15 в каждую сессию плеча 4 недели, затем перезамер.',
      warn: true,
    };
  }
  if (ratio < ERIR_RATIO_MIN) {
    return {
      ratio,
      zone: 'watch',
      line: `ER:IR ${ratio} — ниже нормы здоровых ${ERIR_RATIO_MIN}: добавьте работу внешней ротации`,
      fix: 'Внешняя ротация (band/кабель) 3×12–15 в разминочном блоке 2×/нед.',
      warn: true,
    };
  }
  return { ratio, zone: 'ok', line: `ER:IR ${ratio} — баланс ротаторов в норме`, fix: null, warn: false };
}

/** RU-зона для чипов/отчётов. */
export const ERIR_ZONE_RU: Record<ErIrZone, string> = {
  ok: 'норма',
  watch: 'внимание',
  risk: 'отстаёт внешняя ротация',
  no_data: 'нет замера',
};

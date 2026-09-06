/**
 * arm-regimen.engine.ts — режимы школ: Larratt / Brzenk / Акимов (крюк).
 *
 * Источники: Larratt (стол 2× макс-ядро; bloodflow ежедневно ~100 повт × ~9 кг
 * ×21 сет; 17–18 heavy singles high/low pron + cup; rising/pronation/back
 * pressure/cupping + thumb; pumpkin-рука; never fail, без PR в цикле),
 * Brzenk (стол 1× ~1ч все углы; зал 1× 1×10–12 легко; hard-стоп за 2 нед),
 * Акимов (Скотт 2×/нед предсоревн; статика с лямкой 45–50° 5–10с сила /
 * 20–30с выносливость 4–5 подх; резина за столом тяга 6–12 / статика —
 * динамика и статика в разные дни в соревновательный период).
 *
 * Возвращает только поправки (volumeMult/rirShift) + строки — объёмное ядро
 * билдера не трогает, инварианты целы. Чистый модуль без импортов.
 */

export interface ArmRegimenInput {
  bloodflow?: boolean;
  pumpkinArm?: 'left' | 'right' | null;
  neverFail?: boolean;
  heavySingles?: boolean;
  brzenkMode?: boolean;
  akimovHook?: boolean;
  compPeriod?: boolean; // true — соревновательный, false — предсоревновательный (для Акимова)
  level?: string;
}

export interface ArmRegimenResult {
  volumeMult: number;
  rirShift: number;
  lines: string[];
  warnings: string[];
}

export function planArmRegimen(input: ArmRegimenInput = {}): ArmRegimenResult {
  let volumeMult = 1;
  let rirShift = 0;
  const lines: string[] = [];
  const warnings: string[] = [];
  const lvl = String(input.level || 'intermediate').toLowerCase();
  const isNovice = lvl === 'beginner';

  if (input.bloodflow) {
    lines.push('Bloodflow (Larratt): вне стола ~100 повт × ~9 кг, до 21 сета через день — кровоток сухожилий, НЕ в отказ, в MRV-объём не входит.');
    if (isNovice) warnings.push('Bloodflow новичку: начать с 3–5 лёгких сетов ×25–50, не 100 с первой недели.');
  }
  if (input.heavySingles) {
    lines.push('Heavy singles 17–18 (high/low pron + cup): только свежими, паузы полные, техника чистая — каждый повтор крепит позицию.');
    if (isNovice) {
      warnings.push('Heavy singles новичку запрещены — заменить объёмом RPE 7 (сухожилия).');
      volumeMult = Math.min(volumeMult, 0.85);
      rirShift = Math.max(rirShift, 1);
    }
  }
  if (input.pumpkinArm === 'left' || input.pumpkinArm === 'right') {
    lines.push(`Pumpkin-рука (${input.pumpkinArm === 'left' ? 'левая' : 'правая'}): вся специфика в зачётную руку, вторая — maintenance (Larratt). Энергия конечна.`);
    warnings.push('Pumpkin — только при однополом зачёте; при both — асимметрия вырастет (следить bilateral ≥12%).');
  }
  if (input.neverFail) {
    rirShift = Math.max(rirShift, 1);
    lines.push('Never fail: RIR≥1 всегда, без PR в цикле — форма и сухожилилия важнее цифры (русская школа).');
  }
  if (input.brzenkMode) {
    volumeMult = Math.min(volumeMult, 0.9);
    lines.push('Brzenk 1+1: стол ~1ч все углы (hook/toprool/press по кругу, не выжигать одно) + зал 1×10–12 легко. Сила — на столе.');
    lines.push('Тейпер Brzenk: последний жёсткий стол за 2 нед, лёгкий зал до −1 нед.');
  }
  if (input.akimovHook) {
    if (input.compPeriod) {
      lines.push('Акимов (соревн): Скотт 1×/нед + статика с лямкой 45–50° 2×/нед (5–10с сила) + резина тяга и статика в РАЗНЫЕ дни 1+1×/нед.');
    } else {
      lines.push('Акимов (предсоревн): Скотт 2×/нед (80–90°) + статика с лямкой 45–50° 1×/нед + резина за столом 1×/нед (динамика+статика вместе, полная нагрузка).');
    }
    lines.push('Статика: плечо перпендикулярно полу, угол минимальный; партнёр стопарит при уводе плеча. Совмещение: вытянул из проигрыша → удержание в старте → дожим.');
  }
  return { volumeMult: Math.round(volumeMult * 100) / 100, rirShift, lines, warnings };
}

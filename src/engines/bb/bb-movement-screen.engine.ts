/**
 * bb-movement-screen.engine.ts — скрининг движений под бодибилдинг (чистые функции, без стора).
 * Канон: NASM OHSA + Brookbush (сегментный скоринг + re-test) + PoinT GO (подпятка дифференцирует
 * голеностоп vs верх цепи) + knee-to-wall норма ≥9–12 см.
 * Нагрузка/восстановление/объём сюда НЕ входят — это чужие хабы (Интеллект/Объём).
 */

export interface OhsScreenInput {
  heelsFlat: boolean;
  kneeValgus: boolean; // true = колени сводятся (провал)
  hipBelowParallel: boolean;
  trunkUpright: boolean;
  armsOverMidfoot: boolean;
  lumbarNeutral: boolean;
  kneeToWallCm?: number | null;
  ankleDeg?: number | null;
  /** re-test с подпяткой 2.5 см: 'better' | 'same' | null (не делали) */
  heelRetest?: 'better' | 'same' | null;
  /** руки на бёдрах чистят поясницу (тест на широчайшие): true = стало лучше */
  handsOnHipsBetter?: boolean | null;
}

export type MovementDriver = 'ankle' | 'hip' | 'thoracic' | 'shoulder' | 'core' | 'none';

export interface MovementDriverResult {
  driver: MovementDriver;
  label: string;
  fix: string;
  confidence: number; // 0-1
}

/** Приоритет distal→proximal: голеностоп первичен (PoinT GO), дальше ТБС/грудь/плечо/кор. */
export function resolveMovementDriver(input: OhsScreenInput): MovementDriverResult {
  const ktw = input.kneeToWallCm;
  const ankleBad = !input.heelsFlat || (ktw != null && Number.isFinite(ktw) && (ktw as number) < 9);
  // 1. Голеностоп: пятки рвутся ИЛИ knee-to-wall <9 ИЛИ подпятка чинит паттерн
  if (input.heelRetest === 'better' || (ankleBad && (!input.hipBelowParallel || !input.trunkUpright || input.kneeValgus))) {
    return {
      driver: 'ankle',
      label: 'Голеностоп (дорсифлексия)',
      fix: 'Мобилизация голеностопа ежедневно (колено к стене, MWM с лентой) + подъём пятки 2.5 см в приседе до нормы ≥12 см, перепроверка через 4–6 нед',
      confidence: input.heelRetest === 'better' ? 0.9 : 0.7,
    };
  }
  // 2. ТБС: вальгус без голеностопа / нет глубины при плоских пятках
  if (input.kneeValgus || !input.hipBelowParallel) {
    return {
      driver: 'hip',
      label: 'Тазобедренный (отведение/глубина)',
      fix: 'Средняя ягодичная (отведения, кламшеллы, сплит-присед с темпом) + глубокие 90/90 и казак-присед 3×/нед, cue «раздвинь пол стопами»',
      confidence: 0.7,
    };
  }
  // 3. Грудной отдел / широчайшие: руки падают; руки на бёдрах чистят поясницу → широчайшие
  if (!input.armsOverMidfoot) {
    const lats = input.handsOnHipsBetter === true || !input.lumbarNeutral;
    return {
      driver: lats ? 'shoulder' : 'thoracic',
      label: lats ? 'Плечевой пояс (широчайшие)' : 'Грудной отдел (разгибание)',
      fix: lats
        ? 'Растяжка широчайших в удлинённой позиции у рамы 3×15–20 с + тяги с паузой в растянутой, без жимов над головой до чистого скрининга'
        : 'Разгибание грудного на ролле посегментно T4–T10 + thread-the-needle 2–3×/нед 4 нед, перепроверка',
      confidence: 0.65,
    };
  }
  // 4. Кор: поясница гуляет при чистых руках/ногах
  if (!input.lumbarNeutral || !input.trunkUpright) {
    return {
      driver: 'core',
      label: 'Кор (стабильность поясницы)',
      fix: 'Мёртвый жук/планка с дыханием + гоблет-присед с паузой 3 с внизу, без осевой нагрузки в отказ до стабильности',
      confidence: 0.6,
    };
  }
  return { driver: 'none', label: 'Драйвер не найден — паттерн чистый', fix: 'Поддерживающий объём + перепроверка через 6–8 нед', confidence: 1 };
}

/** Односторонний скрининг: сплит-присед + RDL на ноге (качество, не объём). */
export interface SingleLegScreen {
  splitSquatL: 'pass' | 'fail' | null; // колено гуляет / пятка рвётся / таз уходит
  splitSquatR: 'pass' | 'fail' | null;
  rdlL: 'pass' | 'fail' | null; // потеря баланса / скругление поясницы
  rdlR: 'pass' | 'fail' | null;
}

export function singleLegVerdict(s: SingleLegScreen): { weakSide: 'left' | 'right' | null; text: string } {
  const failsL = [s.splitSquatL, s.rdlL].filter((v) => v === 'fail').length;
  const failsR = [s.splitSquatR, s.rdlR].filter((v) => v === 'fail').length;
  if (failsL === 0 && failsR === 0) return { weakSide: null, text: 'Односторонний: обе стороны чистые' };
  if (failsL === failsR) return { weakSide: null, text: `Односторонний: обе стороны с замечаниями (${failsL}/${failsR}) — чинить симметрично` };
  const weak = failsL > failsR ? 'left' : 'right';
  return {
    weakSide: weak as 'left' | 'right',
    text: `Односторонний: слабее ${weak === 'left' ? 'левая' : 'правая'} (${Math.max(failsL, failsR)} vs ${Math.min(failsL, failsR)}) — унилатеральная первой в сессии`,
  };
}

/** Снимок скрининга для дельты «было/стало» (Brookbush/NASM: re-screen 4–6 нед). */
export interface MovementSnapshot {
  date: string; // YYYY-MM-DD
  fails: string[]; // коды проваленных сегментов: heels/valgus/depth/trunk/arms/lumbar
}

export function ohsFailCodes(input: OhsScreenInput): string[] {
  const out: string[] = [];
  if (!input.heelsFlat) out.push('heels');
  if (input.kneeValgus) out.push('valgus');
  if (!input.hipBelowParallel) out.push('depth');
  if (!input.trunkUpright) out.push('trunk');
  if (!input.armsOverMidfoot) out.push('arms');
  if (!input.lumbarNeutral) out.push('lumbar');
  return out;
}

export function movementDelta(prev: MovementSnapshot | null, cur: string[]): { fixed: string[]; regressed: string[]; text: string } {
  if (!prev) return { fixed: [], regressed: [], text: 'Первый снимок — дельта появится после перепроверки через 4–6 нед' };
  const prevSet = new Set(prev.fails || []);
  const curSet = new Set(cur);
  const fixed = Array.from(prevSet).filter((k) => !curSet.has(k));
  const regressed = Array.from(curSet).filter((k) => !prevSet.has(k));
  if (!fixed.length && !regressed.length) return { fixed, regressed, text: `vs ${prev.date}: без изменений (${cur.length} замечаний)` };
  return {
    fixed,
    regressed,
    text: `vs ${prev.date}: исправлено ${fixed.length ? fixed.join(', ') : '—'} · новое ${regressed.length ? regressed.join(', ') : '—'}`,
  };
}

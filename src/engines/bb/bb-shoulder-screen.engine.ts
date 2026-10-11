/**
 * bb-shoulder-screen.engine.ts — плечевой overhead-скрининг + ротация грудного (чистые функции).
 * Канон: стена (пятки/ягодицы/лопатки+голова на стене, руки вверх) + ротация сидя у стены 50–55°
 * (Barbell Physio / CrossFit / BuiltWithScience: бицепс у ушей, рёбра не раздувать, без шрагов).
 * Пороги честные: ротация <50° — ограничение, межсторонняя ≥10° — watch (рабочий, не медицинский).
 * Боли/диагноза нет — только скрининг + маршрут (мобильность/техника/врач при боли).
 */

export interface ShoulderWallInput {
  /** Спина (лопатки+поясница) на стене — иначе тест невалиден, сначала позиция. */
  backOnWall?: boolean | null;
  /** Голова касается стены при плоской пояснице (Occiput-to-Wall — экстензия грудного). */
  headOnWall?: boolean | null;
  /** Бицепс у ушей в верхней точке (плечевое сгибание + ротация вверх). */
  bicepsAtEars?: boolean | null;
  /** Рёбра не раздуваются, поясница плоская (нет «займа» у поясницы). */
  ribsDown?: boolean | null;
  /** Без шрагов к ушам (контроль, не диапазон). */
  noShrug?: boolean | null;
}

export type ShoulderLocus = 'ok' | 'position' | 'flexion' | 'thoracic' | 'lats' | 'control';

export interface ShoulderWallVerdict {
  pass: boolean;
  fails: string[];
  locus: ShoulderLocus;
  text: string;
  /** false — ни один признак не отмечен пользователем (все входы опциональны). */
  tested: boolean;
}

/** Overhead у стены: позиция первична, дальше — локус ограничения. */
export function shoulderWallVerdict(s: ShoulderWallInput): ShoulderWallVerdict {
  const touched = s.backOnWall != null || s.headOnWall != null || s.bicepsAtEars != null
    || s.ribsDown != null || s.noShrug != null;
  // Все пять входов опциональны: если ничего не отмечено, это «не проверялся», а НЕ «чисто».
  if (!touched) {
    return { pass: true, fails: [], locus: 'ok', text: 'Плечо у стены: не проверялся', tested: false };
  }
  if (!s.backOnWall) {
    return {
      pass: false,
      fails: ['position'],
      locus: 'position',
      text: 'Плечо у стены: встань плотно (пятки/ягодицы/лопатки на стене) и перепроверь — без позиции тест невалиден',
      tested: true,
    };
  }
  const fails: string[] = [];
  if (!s.headOnWall) fails.push('head');
  if (!s.bicepsAtEars) fails.push('flexion');
  if (!s.ribsDown) fails.push('ribs');
  if (!s.noShrug) fails.push('shrug');
  if (!fails.length) {
    return { pass: true, fails, locus: 'ok', text: 'Плечо у стены: чисто — жимы над головой разрешены по технике', tested: true };
  }
  // Локус: рёбра раздуваются = грудной отдел отдаёт движение пояснице;
  // голова отрывается при плоской пояснице = экстензия T-spine;
  // бицепс не у ушей при спокойных рёбрах = сгибание плеча/широчайшие;
  // шраги изолированно = контроль конца диапазона.
  let locus: ShoulderLocus = 'flexion';
  if (!s.ribsDown) locus = 'thoracic';
  else if (!s.headOnWall) locus = 'thoracic';
  else if (!s.bicepsAtEars) locus = 'lats';
  else if (!s.noShrug) locus = 'control';
  const fix: Record<ShoulderLocus, string> = {
    ok: '',
    position: 'встань плотно и перепроверь',
    flexion: 'стена-слайды 2×10 + пуловер 3×8–10 с рёбрами вниз; штангу над головой пока замени гантелями/лэндмайном',
    thoracic: 'экстензия грудного на ролле T4–T10 + молитва у скамьи 2–3×30 с, рёбра вниз; жим над головой — после чистого теста',
    lats: 'растяжка широчайших в длине у рамы 3×15–20 с + тяги с паузой в растянутой; без жимов над головой до чистого теста',
    control: 'CARs плеча + wall slide с отрывом 2×10 — контроль конца диапазона, вес не гнать',
  };
  return {
    pass: false,
    fails,
    locus,
    text: `Плечо у стены: ${fails.join(' + ')} → ${fix[locus]}`,
    tested: true,
  };
}

export interface ThoracicRotationInput {
  rotL: number | null; // градусы, плечи к полу
  rotR: number | null;
}

export const THORACIC_ROT_NORM = 45;
const THORACIC_ROT_GAP = 10;

export function thoracicRotationVerdict(s: ThoracicRotationInput): { text: string; gap: number | null; low: boolean } {
  const { rotL, rotR } = s;
  if (rotL == null && rotR == null) return { text: 'Ротация грудного: не замерялась', gap: null, low: false };
  const gap = rotL != null && rotR != null ? Math.abs(rotL - rotR) : null;
  const low = (rotL != null && rotL < THORACIC_ROT_NORM) || (rotR != null && rotR < THORACIC_ROT_NORM);
  // Замерена одна сторона — это не «норма обеих», а неполный скрининг.
  if (gap == null) {
    const one = (rotL ?? rotR) as number;
    return { text: `Ротация грудного: замерена одна сторона (${one}°) — введи вторую, иначе разрыв не виден`, gap: null, low };
  }
  if (gap >= THORACIC_ROT_GAP) {
    const weak = (rotL as number) < (rotR as number) ? 'левая' : 'правая';
    return { text: `Ротация грудного: ${rotL}° vs ${rotR}° — слабее ${weak} (разрыв ≥${THORACIC_ROT_GAP}°): односторонние ротации + боковые наклоны, перепроверка через 4 нед`, gap, low };
  }
  if (low) {
    return { text: `Ротация грудного: ${rotL}°/${rotR}° (<${THORACIC_ROT_NORM}°) — ограничение обеих сторон: ролл + ротации на четвереньках 2–3×/нед`, gap, low };
  }
  return { text: `Ротация грудного: норма (≥${THORACIC_ROT_NORM}° обе стороны)`, gap, low: false };
}

// ── R6: ER/IR-ratio (сила наружной / внутренней ротации) ──
// Нормы здоровых взрослых ER:IR90 0.71–0.86 (IJSPT 2023, n=181, hand-held; Брэдли/МакКеон).
// 0.75 — нижний квартиль здоровых (bump: здоровья порог, не «болезнь»); >1.15 НЕ травмоопасно
// (высокая ER — это не дисбаланс риска), поэтому это проверка замера, а не warning.
export const ERIR_RATIO_MIN = 0.75;
const ERIR_RATIO_HIGH = 1.15;

export const ERIR_DISCLAIMER =
  'ER/IR <0.75 — дисбаланс в сторону внутренних ротаторов (Intelangelo 2025, n=296; нормы здоровых 0.71–0.86, IJSPT 2023); ручной динамометр надежен (ICC>0.7). Экстраполяция с overhead-атлетов: для жимовиков — эвристика, не диагноз';

export interface ErIrInput {
  erKg?: number | null;
  irKg?: number | null;
}

export function erIrVerdict(s: ErIrInput): { tested: boolean; ratio: number | null; warn: boolean; text: string } {
  const fin = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const er = fin(s.erKg);
  const ir = fin(s.irKg);
  if (er == null || ir == null) return { tested: false, ratio: null, warn: false, text: 'ER/IR: не замерялся' };
  const raw = er / ir;
  // Пороги сравниваем по НЕокруглённому значению: Math.round(1.5049)=1.5 раньше прятал «>1.5».
  if (raw < ERIR_RATIO_MIN) {
    const ratio = Math.round(raw * 100) / 100;
    return {
      tested: true,
      ratio,
      warn: true,
      text: `ER/IR ${ratio} (<0.75): добавь наружную ротацию 2–3×/нед (лёжа на боку / кабель) — жимы не убирай`,
    };
  }
  const ratio = Math.round(raw * 100) / 100;
  if (raw > ERIR_RATIO_HIGH) {
    return {
      tested: true,
      ratio,
      warn: true,
      text: `ER/IR ${ratio} (>1.15) — нетипично для здоровых (0.71–1.15): проверь технику замера/стороны (манжета не должна быть сильнее внутренних)`,
    };
  }
  return { tested: true, ratio, warn: false, text: `ER/IR ${ratio} — в норме (норма 0.75–1.15)` };
}

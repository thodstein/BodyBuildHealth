/**
 * armlift-hand.engine.ts — антропометрия кисти (PRO-6 M3).
 * Толстый гриф 60 мм vs Hub vs щипок — разная цена размера ладони
 * (Thomas Inch-проблема; SBS 2024: длина FDP/FDS решает).
 * Честно: цифры %WR НЕ меняем, только текстовая поправка к интерпретации.
 * Чистые функции, без стораджа.
 */

export interface ArmliftHandInput {
  implement?: string;
  /** Размах кисти см (большой → мизинец в растяжке). */
  spanCm?: number | null;
  /** Длина ладони см (запястье → кончик среднего). */
  palmCm?: number | null;
  /** Длина большого пальца см (по желанию). */
  thumbCm?: number | null;
}

export interface ArmliftHandResult {
  notes: string[];
  handNote: string;
  /** true → толстый гриф объективно дорог этой руке (текст, не штраф к %WR). */
  thickPenalty: boolean;
}

const pos = (v: number | null | undefined): number | null =>
  v != null && Number.isFinite(v) && (v as number) > 0 ? (v as number) : null;

export function assessArmliftHand(i: ArmliftHandInput): ArmliftHandResult {
  const span = pos(i.spanCm);
  const palm = pos(i.palmCm);
  const thumb = pos(i.thumbCm);
  const impl = String(i.implement || '');
  const notes: string[] = [];
  let thickPenalty = false;

  if (span == null && palm == null) {
    return {
      notes: [],
      handNote: 'Замерь размах кисти — цена толстого грифа зависит от руки',
      thickPenalty: false,
    };
  }
  if (span != null) {
    if (span < 20) {
      thickPenalty = true;
      notes.push('Размах <20 см — RT 60 мм / Saxon дорогие, щипок и Hub дешевле');
    } else if (span > 23) {
      notes.push('Размах >23 см — толстый гриф сидит, проверяй щипок и Hub');
    }
  }
  if (thumb != null && thumb < 11) {
    notes.push('Короткий большой — широкий щипок дороже, сужай постановку');
  }
  if (palm != null && span != null && palm > 0 && span / palm < 1.05) {
    notes.push('Короткие пальцы относительно ладони — открытый хват дороже закрытого');
  }
  if (impl === 'hub' && span != null && span < 20) {
    notes.push('Hub малой рукой: следи за 5 подушечками на базе, не уходи в «ручку»');
  }
  if (!notes.length) {
    notes.push('Рука средняя — скидок на антропометрию нет, бьём по силе');
  }
  return { notes, handNote: notes.join(' · '), thickPenalty };
}

/**
 * Холд-кривая «макс vs 70%» (PRO-6 M4).
 * Один холд — точка; пара — кривая: отличаем пик удержания от базы выносливости.
 * Без пары — null (как раньше, тихо). Пороги ratio — рабочие, не норматив.
 */
export type ArmliftHoldCurve = 'peak_gap' | 'endurance_gap' | 'both_low' | 'solid';

export interface ArmliftHoldCurveResult {
  curve: ArmliftHoldCurve;
  ratio: number;
  note: string;
}

export function holdCurveFor(
  maxSec: number | null | undefined,
  subSec: number | null | undefined,
  maxNormSec = 20,
  subNormSec = 60,
): ArmliftHoldCurveResult | null {
  const mx = pos(maxSec);
  const sb = pos(subSec);
  if (mx == null || sb == null) return null;
  const ratio = Math.round((sb / mx) * 10) / 10;
  if (mx < maxNormSec && sb < subNormSec) {
    return { curve: 'both_low', ratio, note: `Оба холда низкие (макс ${mx}с, 70% ${sb}с) — база хвата не набита, объём холдов` };
  }
  if (mx < maxNormSec) {
    return { curve: 'peak_gap', ratio, note: `Пик плывёт (макс ${mx}с), база держит (${sb}с) — бей макс-серии и синглы` };
  }
  if (sb < subNormSec) {
    return { curve: 'endurance_gap', ratio, note: `Пик есть (${mx}с), 70% сыплется (${sb}с) — длинные холды 30–60с и carries` };
  }
  return { curve: 'solid', ratio, note: `Кривая целая (макс ${mx}с, 70% ${sb}с) — держи волну, рви пик` };
}

/**
 * bb-hinge-screen.engine.ts — hip-hinge скрининг (палка: затылок/лопатки/крестец) +
 * нагруженный re-test приседа (BSA-вывод IJSPT 2024: любители плывут под нагрузкой,
 * про — стабильны; чинить весом, а не словами).
 * Чистые функции, без стора. Боли нет — при боли тест не делаем (стоп, к врачу).
 */

export type DowelContact = 'full' | 'lumbar_loss' | 'neck_loss' | 'both' | null;

export interface HingeVerdict {
  pass: boolean;
  locus: 'ok' | 'lumbar' | 'neck' | 'both' | 'not_tested';
  text: string;
}

/** Палка вдоль спины, наклон до параллели торса полу, колени мягкие. */
export function hingeVerdict(dowel: DowelContact): HingeVerdict {
  if (dowel == null) return { pass: true, locus: 'not_tested', text: 'Шарнир: не проверялся' };
  if (dowel === 'full') {
    return { pass: true, locus: 'ok', text: 'Шарнир: чисто — 3 точки касания держатся, тяги/RDL по плану' };
  }
  if (dowel === 'lumbar_loss') {
    return {
      pass: false,
      locus: 'lumbar',
      text: 'Шарнир: поясница отрывается от палки → сгибание вместо шарнира: RDL с укороченной амплитудой + «стена-ягодицы» 3×10, тягу с пола пока замени трап-грифом/румынской выше колен',
    };
  }
  if (dowel === 'neck_loss') {
    return {
      pass: false,
      locus: 'neck',
      text: 'Шарнир: затылок отрывается → взгляд/шея уводит: взгляд в пол 2–3 м впереди + «двойной подбородок», вес не гнать',
    };
  }
  return {
    pass: false,
    locus: 'both',
    text: 'Шарнир: поясница и шея теряют палку → паттерн не готов: гоблет-холд + hip-hinge дрилл у стены 2–3×/нед, осевую в отказ — нет',
  };
}

export type LoadGrade = 'pass' | 'fail' | null;

export interface LoadedSquatInput {
  bodyweight: LoadGrade; // без веса
  bar: LoadGrade; // гриф 20 кг
  working: LoadGrade; // рабочий вес
}

/** Деградация под нагрузкой: техника чистая налегке, но плывёт под весом. */
export function loadedSquatVerdict(s: LoadedSquatInput): { degraded: boolean; text: string } {
  const vals = [s.bodyweight, s.bar, s.working];
  if (vals.every((v) => v == null)) return { degraded: false, text: 'Нагруженный присед: не проверялся' };
  const bwOk = s.bodyweight !== 'fail';
  const workFail = s.working === 'fail' || s.bar === 'fail';
  if (bwOk && workFail) {
    return {
      degraded: true,
      text: 'Нагруженный присед: налегке чисто, под весом плывёт → снизь рабочий вес до чистоты (техника первична), прибавка только через чистые повторы',
    };
  }
  if (!bwOk) {
    return { degraded: false, text: 'Нагруженный присед: база нечиста даже без веса — чини паттерн (драйвер выше), нагрузку не гнать' };
  }
  return { degraded: false, text: 'Нагруженный присед: стабилен под нагрузкой' };
}

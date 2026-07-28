/**
 * planner-mealprep.ts — P1-7: generateMealPrep вынесен из IndividualPlanContext.
 *
 * Чистая функция: берёт план дня/3 дня/7 дней и возвращает структуру шагов meal-prep.
 * Возвращает null, если исходного плана нет — parent в этом случае сначала генерирует план.
 */
import type { MealPrepStep } from "./types";

export interface MealPrepInput {
  mealPrepDays: 1 | 3 | 7;
  dayPlan: any;
  threeDayPlan: any;
  weekPlan: any;
}

export interface MealPrepResult {
  steps: MealPrepStep[];
  totalTime: number;
  containers: number;
}

export function buildMealPrep(input: MealPrepInput): MealPrepResult | null {
  const src = input.mealPrepDays === 1 ? input.dayPlan : input.mealPrepDays === 3 ? input.threeDayPlan : input.weekPlan;
  if (!src) return null;
  const days = input.mealPrepDays === 1 ? [src] : src?.days || [src];
  if (!days || days.length === 0) return null;
  const steps: MealPrepStep[] = [];
  let stepNum = 1;
  const allItems = days.flatMap((d: any) => d.meals.flatMap((m: any) => m.items.map((it: any) => ({ ...it, mealLabel: m.label, mealTime: m.time }))));
  const uniqueItems = [...new Map(allItems.map((it: any) => [it.name, it])).values()];
  const n = (name: string) => name?.toLowerCase() || '';

  // ─── Фаза 1: Mise en place ───
  const allNames = uniqueItems.map((it: any) => n(it.name));
  const hasOven = allNames.some(x => x.includes('лосос') || x.includes('форел') || x.includes('запеч') || x.includes('стейк') || x.includes('голяш') || x.includes('минт') || x.includes('батат') || x.includes('картоф'));
  const hasSimmer = allNames.some(x => x.includes('суп') || x.includes('бульон') || x.includes('туш') || x.includes('карри') || x.includes('болонь'));
  const hasPan = allNames.some(x => x.includes('куриц') || x.includes('индейк') || x.includes('говядин') || x.includes('котл') || x.includes('фарш') || x.includes('печен') || x.includes('гриб') || x.includes('шампиньон'));
  const hasBoilGrain = allNames.some(x => x.includes('рис') || x.includes('гречк') || x.includes('булгур') || x.includes('киноа') || x.includes('кус-кус') || x.includes('перловк') || x.includes('пшен') || x.includes('чечевиц') || x.includes('маш') || x.includes('нут') || x.includes('паст') || x.includes('макар') || x.includes('лапш'));
  const hasFreshVeg = allNames.some(x => x.includes('огурец') || x.includes('помидор') || x.includes('салат') || x.includes('руккол') || x.includes('шпинат') || x.includes('зелен'));
  const hasRawPrep = allNames.some(x => x.includes('брокколи') || x.includes('цветная капуст') || x.includes('морков') || x.includes('кабач') || x.includes('спарж') || x.includes('перец болгар') || x.includes('капуст') || x.includes('цукин') || x.includes('баклаж'));
  const hasMarinate = allNames.some(x => x.includes('куриц') || x.includes('индейк') || x.includes('говядин') || x.includes('свинин') || x.includes('баранин'));
  const hasCottageCheese = allNames.some(x => x.includes('творог') || x.includes('рикотт'));
  const hasBoiledEgg = allNames.some(x => x.includes('яйц') || x.includes('яич') || x.includes('омлет'));

  // 1. Mise en place — подготовка
  const miseItems: string[] = [];
  if (hasFreshVeg) miseItems.push('Овощи: вымыть, обсушить, нарезать');
  if (hasRawPrep) miseItems.push('Термообрабатываемые овощи: вымыть, нарезать кубиками/соломкой');
  if (hasPan || hasOven) miseItems.push('Мясо/рыбу: обсушить бумажными полотенцами');
  if (hasBoilGrain) miseItems.push('Крупы/бобовые: отмерить, промыть до прозрачной воды');
  if (hasCottageCheese) miseItems.push('Творог: откинуть на сито, если влажный');
  if (hasBoiledEgg) miseItems.push('Яйца: достать заранее — комнатной температуры равномернее готовятся');
  if (miseItems.length > 0) steps.push({ step: stepNum++, action: '🔪 Mise en place — подготовка ингредиентов', duration: 15, items: miseItems });

  // 2. Поставить замачиваться бобовые / крупы
  const pulseItems = uniqueItems.filter((it: any) => { const x = n(it.name); return x.includes('маш') || x.includes('нут сух') || x.includes('чечевиц'); });
  if (pulseItems.length > 0) steps.push({ step: stepNum++, action: 'Замочить бобовые в холодной воде (1:3) на 2+ ч', duration: 5, items: pulseItems.map((p: any) => `${p.name} — залить водой 1:3, щепотка соды`), items_standby: true });

  // 3. Поставить разогреваться духовку
  if (hasOven) steps.push({ step: stepNum++, action: '🔥 Разогреть духовку до 190°C', duration: 3, items: ['Верх-низ без конвекции', 'Противень внутри для равномерного прогрева'], items_parallel: true });

  // ─── Фаза 2: Термообработка (параллельные треки) ───
  // Трек A — крупы/гарниры
  const grains = uniqueItems.filter((it: any) => { const x = n(it.name); return x.includes('рис') || x.includes('гречк') || x.includes('булгур') || x.includes('киноа') || x.includes('кус-кус') || x.includes('перловк') || x.includes('пшен') || x.includes('чечевиц') || x.includes('нут'); });
  if (grains.length > 0) {
    const grainSteps = grains.map((g: any) => {
      const gn = n(g.name);
      if (gn.includes('гречк')) return `${g.name}: промыть, залить водой 1:2, варить 12 мин, укутать полотенцем на 10 мин`;
      if (gn.includes('киноа')) return `${g.name}: промыть, залить водой 1:2, варить 15 мин, дать постоять 5 мин под крышкой`;
      if (gn.includes('кус-кус')) return `${g.name}: залить кипятком 1:1.5, накрыть, настоять 5 мин, разрыхлить вилкой`;
      if (gn.includes('перловк')) return `${g.name}: промыть, залить водой 1:3, варить 40 мин, слить лишнее`;
      if (gn.includes('булгур')) return `${g.name}: залить кипятком 1:1.5, накрыть, настоять 12 мин`;
      if (gn.includes('нут')) return `${g.name}: отварить 40-50 мин (если сухой) или прогреть 5 мин (консервированный)`;
      if (gn.includes('чечевиц')) return `${g.name}: промыть, залить водой 1:2.5, варить 15-20 мин до мягкости, не переваривать`;
      if (gn.includes('овсянк') || gn.includes('овсян')) return `${g.name}: залить молоком/водой 1:3, варить 5 мин помешивая, снять с огня, накрыть на 2 мин`;
      return `${g.name}: варить согласно инструкции на упаковке, промыть, заправить маслом`;
    });
    steps.push({ step: stepNum++, action: '🍚 Гарниры: крупы и бобовые', duration: 40, items: grainSteps, items_can_boil_simultaneously: true });
  }

  // Трек B — мясо/рыба (параллельно)
  const meats = uniqueItems.filter((it: any) => { const x = n(it.name); return x.includes('куриц') || x.includes('индейк') || x.includes('говядин') || x.includes('лосос') || x.includes('форел') || x.includes('треск') || x.includes('минт') || x.includes('хека') || x.includes('телят') || x.includes('язык') || x.includes('печен') || x.includes('сердц'); });
  if (meats.length > 0) {
    const meatSteps = meats.map((m: any) => {
      const mn = n(m.name);
      if (mn.includes('лосос') || mn.includes('форел')) return `${m.name}: обсушить, сбрызнуть лимоном+маслом, 4 мин на стороне на сильном огне (кожа хрустящая) или запечь 15 мин при 190°C`;
      if (mn.includes('стейк') || mn.includes('говядин') && !mn.includes('фарш') && !mn.includes('печен')) return `${m.name}: достать за 30 мин до готовки (комнатная темп.), промокнуть, соль+перец — на раскалённую сковороду, 4 мин сторона medium rare, 6 мин — medium, отдохнуть 5 мин под фольгой`;
      if (mn.includes('куриц') || mn.includes('индейк')) return `${m.name}: нарезать кубиками 2-3 см, обжарить партиями по 4 мин до золотистой корочки, не перегружать сковороду`;
      if (mn.includes('печен')) return `${m.name}: промыть, удалить протоки, обжарить с луком 5 мин на сильном огне, затем 3 мин под крышкой на среднем`;
      if (mn.includes('фарш')) return `${m.name}: обжарить на сильном огне, разбивая лопаткой, 6 мин до выпаривания жидкости, затем добавить лук/специи`;
      return `${m.name}: нарезать поперёк волокон, обжарить партиями по 3-4 мин`;
    });
    steps.push({ step: stepNum++, action: '🥩 Белковая часть: мясо/рыба', duration: 25, items: meatSteps });
  }

  // Трек C — овощи, требующие термообработки
  const hotVeg = uniqueItems.filter((it: any) => { const x = n(it.name); return x.includes('брокколи') || x.includes('цветная капуст') || x.includes('брюссель') || x.includes('спарж') || x.includes('фасол стручк'); });
  if (hotVeg.length > 0) steps.push({ step: stepNum++, action: '🥦 Овощи: бланшировать', duration: 8, items: hotVeg.map((v: any) => `${v.name}: бланшировать в подсоленном кипятке 2-3 мин, затем в ледяную воду (сохранить цвет и текстуру)`) });

  // Запечённые овощи/корнеплоды
  const rootVeg = uniqueItems.filter((it: any) => { const x = n(it.name); return (x.includes('батат') || x.includes('картоф') || x.includes('морков') || x.includes('тыкв') || x.includes('свёкл') || x.includes('кабач') || x.includes('баклаж')) && !x.includes('пюре'); });
  if (rootVeg.length > 0) steps.push({ step: stepNum++, action: '🌿 Корнеплоды: нарезать и запечь', duration: 8, items: rootVeg.map((v: any) => `${v.name}: нарезать кубиками/дольками 2см, сбрызнуть маслом, соль+розмарин, запечь 25-30 мин при 200°C`), items_parallel: true });

  // Трек D — соусы/заправки
  const hasSauce = allNames.some(x => x.includes('соус') || x.includes('песто') || x.includes('сметан') || x.includes('сливк') || x.includes('йогурт греч') || x.includes('заправк') || x.includes('томат паст'));
  if (hasSauce) steps.push({ step: stepNum++, action: '🧂 Соусы и заправки', duration: 6, items: ['Готовить с вечера — вкус раскрывается за 8-12 ч в холодильнике', 'Сметанные/йогуртовые — хранить отдельно, смешивать перед подачей', 'Томатные — тушить 10 мин минимум для раскрытия ликопина'] });

  // ─── Фаза 3: Сборка ───
  const freshVegItems = uniqueItems.filter((it: any) => { const x = n(it.name); return x.includes('огурец') || x.includes('помидор') || x.includes('салат') || x.includes('руккол') || x.includes('зелен'); });
  if (freshVegItems.length > 0) steps.push({ step: stepNum++, action: '🥗 Свежие овощи и зелень', duration: 8, items: freshVegItems.map((v: any) => `${v.name}: нарезать непосредственно перед сборкой, не хранить в нарезке дольше 24ч`) });

  // ─── Фаза 4: Охлаждение и фасовка ───
  const mealCount = days[0]?.meals?.length || 4;
  steps.push({ step: stepNum++, action: '🧊 Охладить до комнатной температуры (20 мин, не убирать горячее в холодильник!)', duration: 1, items: ['Разложить на решётке/разделочной доске', 'Накрыть чистым полотенцем'] });
  steps.push({ step: stepNum++, action: '📦 Разложить по контейнерам', duration: 15, items: [
    `${mealCount} приёмов × ${input.mealPrepDays} дн = ${mealCount * input.mealPrepDays} контейнеров`,
    'Плотно утрамбовать — меньше воздуха = дольше свежесть',
    'Соус/заправку — в отдельный мини-контейнер',
    'Зелень и авокадо — добавлять утром перед едой',
  ] });
  steps.push({ step: stepNum++, action: '🏷️ Маркировка и хранение', duration: 5, items: [
    `Каждый контейнер: день+приём (например: «ПН обед»)`,
    'Холодильник +2...+4°C — срок хранения 72ч (3 суток)',
    'Морозилка -18°C — срок хранения до 3 мес',
    'Разморозка: в холодильнике 12ч, не в микроволновке',
  ] });

  // ─── Фаза 5: Инструкции по разогреву ───
  steps.push({ step: stepNum++, action: '♨️ Разогрев перед едой', duration: 2, items: [
    '🍚 Крупы: в микроволновке 2 мин с крышкой + 1 ст.л. воды',
    '🥩 Мясо/рыба: на сковороде 3 мин с каплей воды под крышкой (не микроволновка — сушит)',
    '🥦 Овощи: на пару 2 мин или микроволновка 1.5 мин',
    '❌ Не разогревать повторно — только разовая порция',
  ] });

  return {
    steps,
    totalTime: steps.reduce((s, st) => s + st.duration, 0),
    containers: mealCount * input.mealPrepDays,
  };
}
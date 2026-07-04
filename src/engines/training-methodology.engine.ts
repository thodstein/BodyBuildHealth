/**
 * Training Domain — Final Completion Engines
 *
 * Training Methodology Encyclopedia: 20+ training methods explained
 * Federation Strength Standards: IPF/WPC/WRPF qualifying totals + records
 * Volume Landmarks Reference: MEV/MAV/MRV for all muscles by level
 * Split Structure Visualizer: visual representation of all splits
 *
 * @module training-methodology-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface TrainingMethod {
  name: string;
  category: 'periodization' | 'progression' | 'technique' | 'intensity' | 'volume' | 'frequency' | 'specialization' | 'recovery';
  description: string;
  howItWorks: string;
  bestFor: string;
  example: string;
  popularizedBy: string;
  evidenceLevel: 'A' | 'B' | 'C';
  caveats: string[];
}

export interface FedStandard {
  federation: string;
  weightClasses: number[];
  qualifyingTotals: Record<string, Record<string, number>>;
  nationalRecords: Record<string, Record<string, number>>;
  worldRecords: Record<string, Record<string, number>>;
}

export interface VolumeReference {
  muscle: string;
  beginner: { mev: number; mav: number; mrv: number; frequency: string };
  intermediate: { mev: number; mav: number; mrv: number; frequency: string };
  advanced: { mev: number; mav: number; mrv: number; frequency: string };
  notes: string;
  bestExercises: string[];
}

export interface SplitVisual {
  name: string;
  days: { day: number; name: string; focus: string; patterns: string[]; volume: 'high' | 'medium' | 'low'; intensity: 'high' | 'medium' | 'low' }[];
  totalVolume: string;
  totalFrequency: string;
  suitability: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Training Methodology Encyclopedia (20 methods)
// ═══════════════════════════════════════════════════════════════════════════

const TRAINING_METHODS: TrainingMethod[] = [
  {
    name: 'Линейная периодизация (Linear Periodization)',
    category: 'periodization', evidenceLevel: 'A',
    description: 'Классическая модель: объём снижается, интенсивность растёт от недели к неделе.',
    howItWorks: 'Неделя 1: 3×12@70% → Неделя 4: 3×3@90%. Прогрессивное снижение объёма и рост интенсивности.',
    bestFor: 'Начинающие и средний уровень. Просто, предсказуемо.',
    example: '12 недель: 4 нед гипертрофия → 4 нед сила → 3 нед пик → 1 нед разгрузка.',
    popularizedBy: 'Tudor Bompa, советская школа', caveats: ['Плато через 2-3 цикла', 'Скучно для продвинутых', 'Не хватает вариативности'],
  },
  {
    name: 'Волновая периодизация (Daily Undulating Periodization — DUP)',
    category: 'periodization', evidenceLevel: 'A',
    description: 'Интенсивность и объём меняются каждую тренировку. День силы → день гипертрофии → день мощности.',
    howItWorks: 'Пн: 3×5@85% (сила), Ср: 4×10@70% (гипертрофия), Пт: 6×3@78% (мощность). Постоянная смена стимула.',
    bestFor: 'Средний и продвинутый уровень. Нет плато.',
    example: 'DUP жим лёжа: 3 тренировки в неделю с разными параметрами.',
    popularizedBy: 'Mike Zourdos, Brad Schoenfeld', caveats: ['Сложнее планировать', 'Меньше специфичности для PL'],
  },
  {
    name: 'Блочная периодизация (Block Periodization)',
    category: 'periodization', evidenceLevel: 'A',
    description: 'Накопление → Трансформация → Реализация. Каждый блок фокусируется на ОДНОМ качестве.',
    howItWorks: 'Блок 1 (4 нед): высокий объём, низкая интенсивность. Блок 2 (4 нед): средний объём, высокая интенсивность. Блок 3 (3 нед): низкий объём, максимальная интенсивность.',
    bestFor: 'Продвинутые атлеты, элита. Научно обоснована.',
    example: '12 недель: Accumulation → Transmutation → Realization.',
    popularizedBy: 'Vladimir Issurin, Yuri Verkhoshansky', caveats: ['Сложно для новичков', 'Требует точного планирования'],
  },
  {
    name: 'Сопряжённый метод (Conjugate Method / Westside)',
    category: 'periodization', evidenceLevel: 'B',
    description: 'Max Effort + Dynamic Effort дни. Постоянная ротация упражнений. Специальные упражнения.',
    howItWorks: 'ME Lower (тяжёлый box squat/good morning) → ME Upper (тяжёлый board press/floor press) → DE Lower (скоростной box squat 50-60%+bands) → DE Upper (скоростной bench 50-60%+bands).',
    bestFor: 'Элитные пауэрлифтёры. Выявляет слабые места.',
    example: '4 дня: ME Lower, ME Upper, DE Lower, DE Upper. Ротация упражнений каждые 1-2 недели.',
    popularizedBy: 'Louie Simmons, Westside Barbell', caveats: ['Очень сложно для новичков', 'Специфичное оборудование', 'Высокий риск травм'],
  },
  {
    name: '5/3/1 (Wendler)',
    category: 'periodization', evidenceLevel: 'A',
    description: '4-недельные волновые циклы. TM (training max = 85-90% 1RM). Медленный, устойчивый прогресс.',
    howItWorks: 'Неделя 1: 3×5+, Неделя 2: 3×3+, Неделя 3: 5/3/1+, Неделя 4: Deload. Каждый цикл TM +2.5/5 кг.',
    bestFor: 'Средний уровень. Долгосрочный прогресс без плато.',
    example: 'OHP 5/3/1: 65%×5, 75%×5, 85%×5+ → 70%×3, 80%×3, 90%×3+ → 75%×5, 85%×3, 95%×1+ → Deload.',
    popularizedBy: 'Jim Wendler', caveats: ['Медленный старт', 'Расчёт от TM (не реального 1RM)'],
  },
  {
    name: 'Метод повторных усилий (Repeated Effort Method)',
    category: 'progression', evidenceLevel: 'A',
    description: 'Подходы до отказа или близко к отказу. Ключевой драйвер гипертрофии.',
    howItWorks: '3-5 подходов с весом 65-85% 1RM, RPE 8-10. Последние повторения — самые эффективные.',
    bestFor: 'Гипертрофия. Любой уровень.',
    example: '4×8-12 @RPE 8-9 = 4 подхода по 8-12 повторений с 2-3 повторениями в запасе.',
    popularizedBy: 'Brad Schoenfeld, Chris Beardsley', caveats: ['Не каждый подход до отказа', 'Риск перетрена при частом использовании'],
  },
  {
    name: 'Метод максимальных усилий (Max Effort Method)',
    category: 'progression', evidenceLevel: 'A',
    description: 'Работа с весом 90-100%+. 1-3 повторения. Развитие максимальной силы.',
    howItWorks: '1-3 подхода × 1-3 повторения с 90%+ 1RM. Длинный отдых (3-5+ мин).',
    bestFor: 'Максимальная сила. Пауэрлифтинг.',
    example: 'Присед: 3×1 @95%, 2×2 @92%, 1×3 @90%.',
    popularizedBy: 'Zatsiorsky, Westside', caveats: ['Высокий риск травм', 'Большая нагрузка на ЦНС', 'Не для новичков'],
  },
  {
    name: 'Метод динамических усилий (Dynamic Effort Method)',
    category: 'progression', evidenceLevel: 'B',
    description: 'Субмаксимальный вес (50-65% 1RM) + bands/chains. Максимальная скорость. Развитие мощности.',
    howItWorks: '8-12×2-3 с 50-65% 1RM + bands. Отдых 45-60 сек. Каждое повторение — взрывное.',
    bestFor: 'Мощность, скорость. Пауэрлифтинг, спорт.',
    example: 'Box squat 10×2 @55% + bands. 45 сек отдых.',
    popularizedBy: 'Louie Simmons', caveats: ['Нужны bands/chains', 'Не заменяет ME работу'],
  },
  {
    name: 'Кластерный метод (Cluster Sets)',
    category: 'intensity', evidenceLevel: 'B',
    description: 'Тяжёлый вес (85-95%), но с короткими паузами внутри подхода для сохранения скорости.',
    howItWorks: 'Вес 85-90%. 1 повторение → отдых 20-30 сек → 1 повторение → ... 5-8 общих повторений.',
    bestFor: 'Сила + мощность. Прорыв плато.',
    example: 'Присед 160кг (90%): 1 → 25с → 1 → 25с → 1 → 25с → 1 → 25с → 1 = 5 синглов с 90%.',
    popularizedBy: 'Carl Miller, Haff', caveats: ['Сложно для новичков', 'Требует дисциплины отдыха'],
  },
  {
    name: 'Rest-Pause Training',
    category: 'intensity', evidenceLevel: 'B',
    description: 'Один подход до отказа → короткий отдых → ещё несколько повторений → повторять.',
    howItWorks: 'Вес 80-90%. Подход до RPE 9 → отдых 15-20 сек → ещё 2-4 повторения → отдых 15 сек → ещё 1-3.',
    bestFor: 'Гипертрофия + сила. Экономия времени.',
    example: 'Жим 100кг: 8 повторений → 15 сек → 3 → 15 сек → 2 = 13 повторений с весом 8RM.',
    popularizedBy: 'Dante Trudel (DC Training)', caveats: ['Очень интенсивно', 'Не для новичков', 'Риск перетрена'],
  },
  {
    name: 'Drop Sets (Дроп-сеты)',
    category: 'intensity', evidenceLevel: 'A',
    description: 'Подход до отказа → сброс веса на 20-30% → сразу ещё до отказа → повторить.',
    howItWorks: '1 подход до RPE 10 → сброс 20-30% веса → сразу до RPE 10 → опционально ещё 1 сброс.',
    bestFor: 'Гипертрофия. Памп. Изоляция.',
    example: 'DB Press 40кг×10 → 30кг×7 → 20кг×10.',
    popularizedBy: 'Bodybuilding community', caveats: ['Не на compound', 'Высокая усталость', 'Не каждую тренировку'],
  },
  {
    name: 'Myo-Reps',
    category: 'intensity', evidenceLevel: 'B',
    description: 'Активационный сет (RPE 8) → мини-сеты по 3-5 повторений с 5 глубокими вдохами отдыха.',
    howItWorks: '1 подход 15-20 @RPE 8 → 5 вдохов → 3-5 повторений → 5 вдохов → 3-5 повторений → повторять до падения на 1-2 повторения.',
    bestFor: 'Эффективный тренинг за короткое время.',
    example: 'Leg Press: 200кг ×18 @RPE 8 → 5 вдохов → 4 → 5 вдохов → 4 → 5 вдохов → 3 → 5 вдохов → 2. Стоп.',
    popularizedBy: 'Borge Fagerli', caveats: ['Требует практики', 'Высокая метаболическая нагрузка'],
  },
  {
    name: 'Blood Flow Restriction (BFR)',
    category: 'technique', evidenceLevel: 'A',
    description: 'Ограничение венозного возврата → лёгкий вес (20-30% 1RM) даёт гипертрофию как 70% 1RM.',
    howItWorks: 'Манжеты на проксимальную часть. 30-15-15-15 повторений с 30 сек отдыха. Вес 20-30% 1RM.',
    bestFor: 'Реабилитация. Периоды низкой нагрузки. Deload.',
    example: 'BFR Leg Press: 40кг (20% 1RM) ×30 → 30с → ×15 → 30с → ×15 → 30с → ×15.',
    popularizedBy: 'Jeremy Loenneke, Japanese research', caveats: ['Требует обучения', 'Не при тромбозе', 'Опасно без знаний'],
  },
  {
    name: 'Pre-Exhaust (Предварительное утомление)',
    category: 'technique', evidenceLevel: 'C',
    description: 'Изоляция целевой мышцы → сразу compound. Мышца уже утомлена = compound добивает.',
    howItWorks: 'Cable Flye 3×15 → сразу Bench Press 3×8. ИЛИ Leg Extension 3×15 → сразу Squat 3×8.',
    bestFor: 'Улучшение mind-muscle connection. Отстающие группы.',
    example: 'Грудь: Cable Flye 3×15 → Bench Press 3×8.',
    popularizedBy: 'Arthur Jones, Mike Mentzer', caveats: ['Снижает силу в compound', 'Не для силовых блоков'],
  },
  {
    name: 'German Volume Training (GVT / 10×10)',
    category: 'volume', evidenceLevel: 'B',
    description: '10 подходов × 10 повторений с 60% 1RM. 60 сек отдых. Огромный объём.',
    howItWorks: 'Выбрать 1-2 упражнения. 10×10 с 60% 1RM. 60 сек отдых. Темп 4-0-2-0.',
    bestFor: 'Гипертрофия. Шокирование мышц новым стимулом.',
    example: 'GVT присед: 100кг 10×10 с отдыхом 60 сек.',
    popularizedBy: 'Charles Poliquin, German weightlifters', caveats: ['Экстремальный объём', 'Только 3-4 недели', 'Не для новичков'],
  },
  {
    name: 'FST-7 (Fascia Stretch Training)',
    category: 'volume', evidenceLevel: 'C',
    description: '7 подходов × 8-12 с 30-45 сек отдыха в конце тренировки. Растяжение фасции.',
    howItWorks: 'Последнее упражнение: 7 подходов × 8-12 повторений с 30-45 сек отдыха. Пить воду между подходами.',
    bestFor: 'Памп, растяжение фасции. Завершение тренировки.',
    example: 'Cable Flye FST-7: 7×10-12 с 30 сек отдыха. Последнее упражнение на грудь.',
    popularizedBy: 'Hany Rambod', caveats: ['Только для продвинутых', 'Не научно подтверждено для фасции'],
  },
  {
    name: 'Gironda 8×8',
    category: 'volume', evidenceLevel: 'C',
    description: '8 подходов × 8 повторений с минимальным отдыхом. Плотность как приоритет.',
    howItWorks: '8×8 с 50-60% 1RM. 15-30 сек отдых. Темп 2-0-2-0.',
    bestFor: 'Плотность, метаболический стресс.',
    example: '8×8 жим гантелей с 15-30 сек отдыха.',
    popularizedBy: 'Vince Gironda', caveats: ['Очень высокая плотность', 'Только для опытных'],
  },
  {
    name: 'Emom (Every Minute on the Minute)',
    category: 'frequency', evidenceLevel: 'B',
    description: 'Каждую минуту начинаете новый подход. Время на подход = ваш отдых.',
    howItWorks: 'Выбрать вес/упражнение. Каждую минуту по сигналу — подход. Оставшееся время — отдых.',
    bestFor: 'Кондиция, плотность, кроссфит.',
    example: 'EMOM 10: минута 1 — 5 pull-ups, минута 2 — 10 push-ups. Повторять 10 минут.',
    popularizedBy: 'CrossFit community', caveats: ['Не для максимальной силы', 'Качество страдает при усталости'],
  },
  {
    name: 'Progressive Overload (базовый принцип)',
    category: 'progression', evidenceLevel: 'A',
    description: 'Постепенное увеличение нагрузки: вес, повторения, подходы, плотность, частота.',
    howItWorks: 'Каждую неделю/месяц увеличивать ОДИН параметр на 2-5%. Вес ИЛИ повторения ИЛИ подходы.',
    bestFor: 'Все. Фундаментальный принцип тренинга.',
    example: 'Неделя 1: 80×8. Неделя 2: 80×9. ... Неделя 4: 80×10 → 82.5×8.',
    popularizedBy: 'Milo of Croton (легенда)', caveats: ['Не пытаться увеличивать всё сразу', 'Малые шаги'],
  },
  {
    name: 'RPE-based Autoregulation',
    category: 'progression', evidenceLevel: 'A',
    description: 'Регулировка нагрузки по субъективному ощущению (RPE), а не по фиксированному проценту.',
    howItWorks: 'Цель: @RPE 8 (2 повторения в запасе). В хороший день — вес выше. В плохой — ниже.',
    bestFor: 'Все уровни. Индивидуализация.',
    example: 'Цель: 3×8 @RPE 8. Хороший день: 100×8. Плохой день: 90×8. Результат одинаковый.',
    popularizedBy: 'Mike Tuchscherer (RTS)', caveats: ['Требует честности с собой', 'Новички плохо оценивают RPE'],
  },
  // ── Интенсивность (доп.) ──
  { name: 'Суперсеты (Antagonist Supersets)', category: 'intensity', evidenceLevel: 'A', description: 'Два упражнения подряд без отдыха на антагонисты (грудь/спина, бицепс/трицепс).', howItWorks: 'Сокращает время тренировки и повышает плотность нагрузки; лёгкое активное восстановление антагониста. bestFor: Гипертрофия, экономия времени.', bestFor: 'Гипертрофия, экономия времени.', example: 'Жим лёжа 8 + Тяга штанги 8 — без отдыха между, 4 раунда.', popularizedBy: 'Арнольд Шварценеггер', caveats: ['Снижает качество тяжёлых подходов'] },
  { name: 'Трисеты / Гигантские сеты', category: 'intensity', evidenceLevel: 'B', description: '3-6 упражнений на одну группу подряд без отдыха.', howItWorks: 'Максимальный метаболический стресс и памп. Увеличивает время под нагрузкой.', bestFor: 'Памп, гипертрофия, сушка.', example: 'Грудь: жим + разведение + отжимания — 3 раунда без отдыха.', popularizedBy: 'Винс Жиронда', caveats: ['Высокая усталость, не для силы'] },
  { name: 'Форсированные повторения (Forced Reps)', category: 'intensity', evidenceLevel: 'B', description: 'Партнёр помогает доделать 2-3 повторения после мышечного отказа.', howItWorks: 'Продлевает подход за отказ → больше механического напряжения. Повышает усталость.', bestFor: 'Продвинутые, гипертрофия.', example: 'Жим до отказа (8), партнёр помогает +3 форсированных.', popularizedBy: 'Дориан Йейтс', caveats: ['Требует партнёра', 'Высокий риск перетрена'] },
  { name: 'Негативы (Эксцентрические повторения)', category: 'intensity', evidenceLevel: 'A', description: 'Медленная эксцентрика (4-6с) или сверхмаксимальные негативы с помощником.', howItWorks: 'Эксцентрика даёт больше механического напряжения при меньшем утомлении. Увеличивает силу и гипертрофию.', bestFor: 'Сила, гипертрофия, преодоление плато.', example: 'Сверхмакс присед: негатив 5с с помощником на подъём, 3×3.', popularizedBy: 'Пауэрлифтинг/бодибилдинг', caveats: ['Высокая мышечная болезненность (DOMS)'] },
  // ── Техника (доп.) ──
  { name: 'Темповые повторения (Tempo)', category: 'technique', evidenceLevel: 'B', description: 'Контроль темпа: эксцентрика-пауза-концентрика-пауза (напр. 4-1-1-0).', howItWorks: 'Медленная эксцентрика увеличивает время под нагрузкой и механическое напряжение.', bestFor: 'Гипертрофия, техника, реабилитация.', example: 'Присед 4-1-1-0: 4с вниз, 1с пауза, 1с вверх.', popularizedBy: 'Чарльз Поликвин', caveats: ['Снижает используемый вес'] },
  { name: '1.5 повторения', category: 'technique', evidenceLevel: 'C', description: 'Полное повторение + половина + полное в одном.', howItWorks: 'Увеличивает время под нагрузкой в растянутой позиции.', bestFor: 'Гипертрофия, акцент на растяжение.', example: 'Присед: полный + полприседа + полный = 1 повтор.', popularizedBy: 'Стюарт МакРоберт', caveats: ['Требует идеальной техники'] },
  { name: 'Пауза в нижней точке (Bottom Pause)', category: 'technique', evidenceLevel: 'B', description: 'Пауза 1-2с в растянутой позиции перед концентрикой.', howItWorks: 'Убирает рефлекс растяжения → чистая концентрическая сила.', bestFor: 'Сила (присед/жим), техника.', example: 'Присед: 2с пауза внизу, затем вверх. 3×5.', popularizedBy: 'Пауэрлифтинг', caveats: ['Снижает вес на 5-10%'] },
  // ── Объём (доп.) ──
  { name: 'Volume Landmarks (MEV/MAV/MRV)', category: 'volume', evidenceLevel: 'A', description: 'Пороги объёма: MEV (минимум роста), MAV (адаптация), MRV (макс восстановления).', howItWorks: 'Держать объём между MEV и MAV, не превышать MRV. Прогресс = постепенный рост объёма к MRV с последующим делодом.', bestFor: 'Все уровни, гипертрофия.', example: 'Грудь: 12 сетов/нед (MAV) → 16 → 20 (MRV) → делод.', popularizedBy: 'Mike Israetel (Renaissance Periodization)', caveats: ['Требует учёта сетов по группам'] },
  { name: 'High-Frequency Hypertrophy (2×/нед на группу)', category: 'volume', evidenceLevel: 'A', description: 'Каждая мышца 2 раза в неделю — оптимальный баланс объёма и частоты для натуральных.', howItWorks: 'Частота 2× повышает синтез белка чаще при меньшем разовом объёме.', bestFor: 'Натуральные, гипертрофия.', example: 'Верх/Низ 4× или PPL 6× — каждая группа 2×/нед.', popularizedBy: 'Brad Schoenfeld', caveats: ['Нужно балансировать объём между сессиями'] },
  // ── Частота (доп.) ──
  { name: 'Squat Every Day (высокочастотный)', category: 'frequency', evidenceLevel: 'B', description: 'Присед тяжёлый каждый день с субмаксимальными весами.', howItWorks: 'Высокая частота + субмакс (RPE 7-8) → нейромышечная адаптация без перегруза.', bestFor: 'Продвинутые пауэрлифтеры.', example: 'Присед каждый день 1×5 @RPE 7-8, разные варианты.', popularizedBy: 'John Broz', caveats: ['Высокий риск перетрена, нужен опыт'] },
  { name: 'HIT (High-Intensity Training / Mentzer)', category: 'frequency', evidenceLevel: 'C', description: 'Низкая частота (1-2×/нед), 1 рабочий подход до отказа на упражнение.', howItWorks: 'Минимум объёма, максимум интенсивности → полное восстановление между сессиями.', bestFor: 'Занятые, продвинутые; не для натуральных новичков.', example: '1 подход до отказа на упражнение, 2 тренировки в неделю.', popularizedBy: 'Mike Mentzer, Dorian Yates', caveats: ['Низкий общий объём, риск плато'] },
  { name: '2×/нед на группу (база)', category: 'frequency', evidenceLevel: 'A', description: 'Каждая мышечная группа тренируется 2 раза в неделю — золотой стандарт для натуральных.', howItWorks: 'Синтез белка после тренировки длится ~24-48ч; 2×/нед поддерживает его чаще.', bestFor: 'Натуральные, гипертрофия/сила.', example: 'Верх/Низ 4×, ПЛ 3-4× с разделением групп.', popularizedBy: 'Brad Schoenfeld, Lyle McDonald', caveats: ['Меньше — недотрен, больше — риск перетрена'] },
  // ── Расширенные ПРОФ-методики (с вариантами 2×/нед на группу) ──
  { name: 'Двойная прогрессия (Double Progression)', category: 'progression', evidenceLevel: 'A', description: 'Прогресс сначала по повторениям в диапазоне, затем по весу — базовый ПРОФ-инструмент для 2×/нед.', howItWorks: 'Фиксируем вес, растим повторы до верхней границы диапазона (напр. 8-12), затем +вес и снова с низа диапазона.', bestFor: 'Гипертрофия, натуральные, 2×/нед на группу.', example: 'Жим 80кг: 3×8 → 3×10 → 3×12 → +2.5кг → 3×8.', popularizedBy: 'Lyle McDonald, RP', caveats: ['Требует терпения между повышениями веса'] },
  { name: 'Тройная прогрессия (Triple Progression)', category: 'progression', evidenceLevel: 'B', description: 'Прогресс по повторениям, затем по подходам, затем по весу.', howItWorks: 'Растим повторы → добавляем подход → повышаем вес. Плавное увеличение объёма и интенсивности.', bestFor: 'Гипертрофия, продвинутые.', example: '3×8 → 3×10 → 4×10 → +вес → 3×8.', popularizedBy: 'Christian Thibaudeau', caveats: ['Длинные циклы прогресса'] },
  { name: 'Wave Loading (Волны нагрузки)', category: 'intensity', evidenceLevel: 'B', description: 'Внутри сессии волны: тяжёлый-лёгкий-тяжёлый подходы (напр. 5@85%, 5@80%, 5@87%).', howItWorks: 'Post-Activation Potentiation: лёгкая волна после тяжёлой повышает силу последующих; для 2×/нед даёт плотную интенсивность без перегруза.', bestFor: 'Сила и гипертрофия, 2×/нед.', example: 'Жим: 5@85% — 5@80% — 5@87% — 5@82% — 5@90%.', popularizedBy: 'Christian Thibaudeau, Westside', caveats: ['Сложно программировать'] },
  { name: 'Cluster 5×5 (для 2×/нед)', category: 'intensity', evidenceLevel: 'B', description: '5×5 кластерами по 2-3 повтора с отдыхом 20с внутри — больше КПШ при высокой интенсивности для 2×/нед.', howItWorks: 'Разбиваем 5 повторений на (2.2.1) с микро-отдыхом → выше средняя интенсивность, меньше усталость.', bestFor: 'Сила/масса, 2×/нед.', example: 'Присед 5×5: каждый подход = 2+20с+2+20с+1, отдых 3 мин.', popularizedBy: 'Christian Thibaudeau', caveats: ['Долгие подходы'] },
  { name: 'Drop-Set 4/8/12 (метод 50)', category: 'intensity', evidenceLevel: 'B', description: 'Один рабочий подход до отказа, затем два дропа −20% до отказа (50% от максимума в дропах).', howItWorks: 'Максимальный метаболический стресс в конце упражнения; для 2×/нед — на втором дне группы как добивка.', bestFor: 'Гипертрофия, финал упражнения.', example: 'Жим 10@80кг до отказа → −20% 10@64кг → −20% 10@51кг.', popularizedBy: 'Steve Holman (X-Rep)', caveats: ['Высокая усталость, 1-2 раза в неделю на группу'] },
  { name: 'Antagonist Superset 2×/нед (Грудь/Спина)', category: 'intensity', evidenceLevel: 'A', description: 'Суперсет антагонистов в рамках 2×/нед на группу — две группы в одну сессию.', howItWorks: 'Чередование груди/спины без отдыха → обе группы получают 2×/нед за 4 сессии верхней части.', bestFor: 'Гипертрофия, экономия времени, 2×/нед.', example: 'Жим лёжа 8 + Тяга штанги 8 ×4, в день верха.', popularizedBy: 'Арнольд', caveats: ['Снижает максимальную силу в подходе'] },
  { name: 'Paused Reps (вариации для 2×/нед)', category: 'technique', evidenceLevel: 'A', description: 'Паузы 1-2с в разных точках амплитуды (низ/середина/верх) — техника для силы, 2×/нед.', howItWorks: 'Убирает рефлекс растяжения, улучшает технику и позицию силы; в 2×/нед — один день с паузами (сила), второй — темп (масса).', bestFor: 'Сила (присед/жим/тяга), техника.', example: 'Жим: 3с пауза на груди, 3×5. День 2 — темп 3-0-1.', popularizedBy: 'Пауэрлифтинг', caveats: ['Снижает вес на 5-15%'] },
  { name: 'Tempo для гипертрофии (3-1-1-0)', category: 'technique', evidenceLevel: 'B', description: 'Медленная эксцентрика 3с + пауза 1с — для массы во второй день группы 2×/нед.', howItWorks: 'Время под нагрузкой растёт → метаболический стресс; дополняет тяжёлый день группы.', bestFor: 'Гипертрофия, 2×/нед.', example: 'Жим 3-1-1-0: 3с вниз, 1с пауза, 1с вверх, 4×10.', popularizedBy: 'Poliquin', caveats: ['Меньше вес'] },
  { name: 'Volume Progression RP (мезо 2×/нед)', category: 'volume', evidenceLevel: 'A', description: 'Объём растёт от MEV к MRV по неделям мезоцикла при 2×/нед на группу, затем делод.', howItWorks: 'Нед1: MEV×1.5, нед2: MAV, нед3-4: к MRV, нед5: делод −30%. Прогрессия объёма — основа гипертрофии.', bestFor: 'Гипертрофия, натуральные, 2×/нед.', example: 'Грудь: 10/14/18/20/14 сетов/нед за 5 недель.', popularizedBy: 'Renaissance Periodization', caveats: ['Требует учёта сетов по группам'] },
  { name: 'GVT 2×/нед (10×10 на группу)', category: 'volume', evidenceLevel: 'B', description: 'Немецкий объёмный тренинг 10×10 для группы 2 раза в неделю — высокий объём.', howItWorks: '10×10 @60% 1ПМ с 90с отдыхом → максимальный объём и метаболический стресс; 2×/нед на группу.', bestFor: 'Гипертрофия, продвинутые.', example: 'Присед 10×10@60% 90с отдых, 2×/нед, 6 недель.', popularizedBy: 'Винс Жиронда', caveats: ['Тяжёлое восстановление, не для силы'] },
  { name: 'PPL 6× (2×/нед на группу)', category: 'frequency', evidenceLevel: 'A', description: 'Push/Pull/Legs 6 раз в неделю — каждая группа 2×/нед при 6 тренировках.', howItWorks: '3 разделения × 2 прохода = каждая группа тренируется 2×/нед с разным акцентом (сила/памп).', bestFor: 'Продвинутые, гипертрофия, 6 дней.', example: 'Пн Push A(сила) — Вт Pull A — Ср Legs A — Чт Push B(памп) — Пт Pull B — Сб Legs B.', popularizedBy: 'Бодибилдинг', caveats: ['Высокая нагрузка, нужен опыт и восстановление'] },
  { name: 'Верх/Низ 4× (2×/нед на группу)', category: 'frequency', evidenceLevel: 'A', description: 'Верх/Низ 4 раза в неделю — верх и низ по 2×/нед. Базовый ПРОФ-сплит для натуральных.', howItWorks: '2 дня верх + 2 дня низ; каждая группа 2×/нед; баланс объёма и частоты.', bestFor: 'Натуральные, гипертрофия/сила, 4 дня.', example: 'Пн Верх(сила) — Вт Низ(сила) — Чт Верх(памп) — Пт Низ(памп).', popularizedBy: 'Lyle McDonald', caveats: ['Средняя специализация'] },
  { name: 'Full Body 3× (группа ~3×/нед)', category: 'frequency', evidenceLevel: 'A', description: 'Фулбоди 3×/нед — каждая группа ~3×/нед, низкий объём за сессию.', howItWorks: 'Высокая частота, низкий разовый объём → частый синтез белка; для новичков/возвращения.', bestFor: 'Новички, реабилитация, возвращение.', example: 'Пн/Ср/Пт: присед + жим + тяга, 3×5-8.', popularizedBy: 'Starting Strength, Bill Starr', caveats: ['Ограниченная специализация групп'] },
  { name: 'Силовой цикл 2×/нед (ПЛ)', category: 'frequency', evidenceLevel: 'A', description: 'Присед/жим/тяга 2× в неделю каждое в рамках СРЦ — ПРОФ-частота для пауэрлифтинга.', howItWorks: 'Каждое движение 2×/нед: один тяжёлый день + один объёмный/технический. Баланс силы и объёма.', bestFor: 'Пауэрлифтинг, 4 дня.', example: 'Пн Присед(тяж) — Вт Жим(тяж) — Чт Тяга(тяж) — Сб Присед/Жим(объём).', popularizedBy: 'Шаблоны СРЦ, RTS', caveats: ['Нужна программация восстановления'] },
  // ── Методики: Tnation / RPE / Conjugate / Bulgarian / Metabolic / Bench-only ──
  { name: 'RTS Emerging Strategies (RPE-программирование по Tuchscherer)', category: 'periodization', evidenceLevel: 'A', description: 'Система авторегуляции на основе RPE: объём и интенсивность определяются текущей готовностью, а не фиксированным планом. Каждый подход оценивается по шкале 1-10.', howItWorks: 'Основное движение: работа до целевого RPE (@7-9), затем снижение веса на 5-7% и подходы до достижения @9 RPE. Объём варьируется: в «хороший» день больше подходов, в «плохой» — меньше. Используются Emerging Strategies: fatigue per set, load drop, repetition conservation. Тренировочный стресс дозируется точно.', bestFor: 'Пауэрлифтинг, силовой тренинг, продвинутые атлеты, соревнующиеся.', example: 'Присед: работа до @8 ×3, затем −7% и 3-5 подходов ×3 до @9. Жим: до @8 ×4, −5% и подходы до @9. Объём: 12-20 рабочих повторений в основном движении за сессию.', popularizedBy: 'Mike Tuchscherer (Reactive Training Systems)', caveats: ['Требует честной оценки RPE (опыт 6+ мес)', 'Не для новичков', 'Нужен тренировочный журнал'] },
  { name: 'Westside Conjugate: структура ME/DE дней', category: 'periodization', evidenceLevel: 'B', description: 'Детальная структура сопряжённого метода: день максимального усилия (ME) + день динамического усилия (DE), ротация упражнений каждые 1-2 недели.', howItWorks: 'ME Upper: работа до 1ПМ в вариации жима (меняется каждые 1-2 нед: жим с досок/пола/узким хватом/с резиной). ME Lower: 1ПМ в вариации приседа/тяги (box squat, deadlift с плинтов, good morning). DE Upper: скоростной жим 8-9×3 @50-60% 1ПМ + резина/цепи. DE Lower: скоростной box squat 10-12×2 @50-60% + резина. Аксессуары: трицепс/спина/плечи в день верха, задняя цепь/пресс в день низа.', bestFor: 'Продвинутые пауэрлифтеры, equipped лифтинг, спортсмены.', example: 'Пн ME Upper (1ПМ жим с 3-досок) + трицепс 4×8 + широчайшие 4×10. Вт ME Lower (1ПМ box squat) + ягодичный мостик 3×8 + пресс. Чт DE Upper (скоростной жим 9×3) + плечи/трицепс. Пт DE Lower (скоростной присед 12×2) + GHR/RDL + пресс.', popularizedBy: 'Louie Simmons, Westside Barbell', caveats: ['Сложное программирование ротации', 'Нужна резина/цепи', 'Высокая нагрузка на ЦНС'] },
  { name: 'Болгарский метод (Bulgarian Method / Daily Max)', category: 'frequency', evidenceLevel: 'B', description: 'Ежедневная работа до максимума дня в соревновательных движениях с авторегуляцией по текущему состоянию. Тренировка 6-7 дней/нед.', howItWorks: 'Каждый день: работа до ежедневного максимума (не абсолютный ПМ, а лучший результат на сегодня). После максимума — back-off сеты на −10-15%. Отказ от тренировки только при плохом самочувствии. Минимум вспомогательных упражнений. Высокая частота → нейромышечная адаптация, техническое совершенство движений. Атлет учится работать с максимальными весами каждый день.', bestFor: 'Элитные тяжелоатлеты и пауэрлифтеры, высокий уровень восстановления, специализация.', example: 'Присед: разминка → максимум дня (1 повтор на ~90-95% дневной готовности) → −15% 3×2. Жим лёжа: максимум дня → −10% 3×3. Тяга: максимум дня 1-2×/нед → −15% 2×2. Аксессуары: подтягивания/тяга штанги 3×8, пресс.', popularizedBy: 'Ivan Abadjiev, болгарская школа тяжёлой атлетики', caveats: ['Экстремальная нагрузка, только для элиты', 'Полный приоритет восстановления (сон ≥9ч, питание)', 'Высокий риск травм без подготовки', 'Не для натуральных атлетов на диете'] },
  { name: 'Метаболический тренинг (Giant Sets для жиросжигания)', category: 'intensity', evidenceLevel: 'B', description: 'Гигантские сеты 4-6 упражнений без отдыха между ними — максимальный EPOC и расход калорий за тренировку.', howItWorks: 'Комбинация многосуставных и изолирующих упражнений на разные группы мышц подряд без отдыха (либо минимальный отдых 10-15с между упражнениями). ЧСС держится на 130-150 уд/мин всю сессию. EPOC (послетренировочное потребление кислорода) повышено 14-48ч после тренировки → дополнительный расход 50-150 ккал/сутки. Метаболический стресс стимулирует выброс гормона роста и катехоламинов. Комбинирует силовую и кардио-нагрузку в одной сессии.', bestFor: 'Жиросжигание, выносливость, финишер после силовой, рекомпозиция тела.', example: 'Гигантский сет: Присед со штангой ×10 + Жим гантелей ×12 + Тяга штанги в наклоне ×10 + Жим над головой ×10 + Выпады ×12/нога + Планка 30с. 3-4 круга, отдых 90-120с между кругами. Вес 50-65% 1ПМ. Темп: эксцентрика 2с.', popularizedBy: 'Винс Жиронда, кроссфит-сообщество, Milos Sarcev', caveats: ['Не для максимальной силы/массы', 'Высокая нагрузка на ССС', 'Требует хорошей техники при усталости', 'Не рекомендуется при гипертонии'] },
  { name: 'Жимовое троеборье (Bench-only блочная периодизация)', category: 'specialization', evidenceLevel: 'A', description: 'Специализированная трёхблочная периодизация для жима лёжа: накопительный → силовой → пиковый блоки. Частота жима 3-4×/нед с вариациями под слабые точки.', howItWorks: 'Блок 1 (гипертрофия/объём, 4 нед): жим 3×/нед, вариации (с досок, узким хватом, наклонный), объём 12-18 подходов/нед, RPE 7-8. Блок 2 (сила, 4 нед): жим 3×/нед с паузой, работа с резиной/цепями, негативы, RPE 8-9. Блок 3 (пик, 3 нед): соревновательный жим 3×/нед, снижение объёма (−30-50%), работа на скорость, подводка к соревнованиям. Аксессуары подбираются под слабую точку: срыв с груди → жим с паузой/досок, середина → жим с резиной, дожим → жим с бруска/узким хватом.', bestFor: 'Специалисты по жиму лёжа, жимовое троеборье, соревнующиеся пауэрлифтеры.', example: 'Блок 1 (нед 1-4): жим 3×8-10 @RPE7 + жим с досок 3×8 + дожим 3×10. Блок 2 (нед 5-8): жим с паузой 3×3-5 @RPE8 + жим с резиной 3×3 + негативы 3×2. Блок 3 (нед 9-11): соревновательный жим 3×1-3 @RPE9 + скорость 6×3 @60% + подводка.', popularizedBy: 'Josh Bryant, Jennifer Thompson, жимовое троеборье IPF', caveats: ['Минимум тяги/приседа — дисбаланс', 'Риск перетрена плеч/локтей', 'Нужна ротация вариаций упражнений'] },
];

// ═══════════════════════════════════════════════════════════════════════════
// 2. Federation Strength Standards
// ═══════════════════════════════════════════════════════════════════════════

const IPF_STANDARDS: FedStandard = {
  federation: 'IPF',
  weightClasses: [59, 66, 74, 83, 93, 105, 120, 120],
  qualifyingTotals: {
    'Чемпионат России': { '59': 400, '66': 460, '74': 510, '83': 550, '93': 580, '105': 610, '120': 640 },
    'Чемпионат Европы': { '59': 490, '66': 550, '74': 600, '83': 640, '93': 670, '105': 700, '120': 730 },
    'Чемпионат Мира': { '59': 540, '66': 600, '74': 660, '83': 700, '93': 740, '105': 770, '120': 800 },
  },
  nationalRecords: {
    'Squat': { '59': 240, '66': 270, '74': 300, '83': 320, '93': 340, '105': 360, '120': 380 },
    'Bench': { '59': 170, '66': 195, '74': 215, '83': 230, '93': 245, '105': 260, '120': 275 },
    'Deadlift': { '59': 260, '66': 290, '74': 320, '83': 340, '93': 355, '105': 370, '120': 390 },
  },
  worldRecords: {
    'Squat': { '59': 300, '66': 330, '74': 365, '83': 390, '93': 410, '105': 430, '120': 450 },
    'Bench': { '59': 210, '66': 235, '74': 255, '83': 275, '93': 290, '105': 305, '120': 320 },
    'Deadlift': { '59': 310, '66': 340, '74': 370, '83': 400, '93': 420, '105': 440, '120': 460 },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. Complete Volume Landmarks Reference
// ═══════════════════════════════════════════════════════════════════════════

const VOLUME_REFERENCES: VolumeReference[] = [
  { muscle: 'Грудь', beginner: { mev: 6, mav: 10, mrv: 15, frequency: '1.5-2×/нед' }, intermediate: { mev: 8, mav: 14, mrv: 20, frequency: '2×/нед' }, advanced: { mev: 10, mav: 16, mrv: 24, frequency: '2-3×/нед' }, notes: 'Считаются прямые подходы на грудь. Flye = 0.5 подхода.', bestExercises: ['Bench Press', 'Incline DB', 'Cable Flye', 'Dips'] },
  { muscle: 'Широчайшие / Спина', beginner: { mev: 8, mav: 12, mrv: 18, frequency: '2×/нед' }, intermediate: { mev: 10, mav: 16, mrv: 24, frequency: '2×/нед' }, advanced: { mev: 12, mav: 20, mrv: 28, frequency: '2-3×/нед' }, notes: 'Тяги + подтягивания. Deadlift считается как 0.5 для спины.', bestExercises: ['Pull-up', 'Barbell Row', 'Lat Pulldown', 'Seated Row'] },
  { muscle: 'Квадрицепсы', beginner: { mev: 6, mav: 10, mrv: 15, frequency: '1.5-2×/нед' }, intermediate: { mev: 8, mav: 14, mrv: 20, frequency: '2×/нед' }, advanced: { mev: 10, mav: 16, mrv: 24, frequency: '2×/нед' }, notes: 'Присед + жим ногами + разгибания. Deadlift не считается.', bestExercises: ['Back Squat', 'Front Squat', 'Leg Press', 'Leg Extension'] },
  { muscle: 'Бицепс бедра', beginner: { mev: 4, mav: 8, mrv: 12, frequency: '1.5-2×/нед' }, intermediate: { mev: 6, mav: 10, mrv: 16, frequency: '2×/нед' }, advanced: { mev: 8, mav: 12, mrv: 18, frequency: '2×/нед' }, notes: 'RDL + сгибания. Deadlift = 0.5 подхода для hamstrings.', bestExercises: ['RDL', 'Leg Curl', 'Good Morning', 'Nordic Curl'] },
  { muscle: 'Плечи', beginner: { mev: 4, mav: 8, mrv: 12, frequency: '2×/нед' }, intermediate: { mev: 6, mav: 10, mrv: 16, frequency: '2-3×/нед' }, advanced: { mev: 8, mav: 12, mrv: 20, frequency: '2-3×/нед' }, notes: 'Жимы + махи. Жим лёжа отдаёт 0.5 подхода передним дельтам.', bestExercises: ['OHP', 'Lateral Raise', 'Face Pull', 'Rear Delt Flye'] },
  { muscle: 'Бицепс', beginner: { mev: 2, mav: 6, mrv: 10, frequency: '1.5-2×/нед' }, intermediate: { mev: 4, mav: 8, mrv: 14, frequency: '2×/нед' }, advanced: { mev: 6, mav: 12, mrv: 18, frequency: '2-3×/нед' }, notes: 'Тяги отдают 0.25 подхода бицепсу.', bestExercises: ['Barbell Curl', 'DB Curl', 'Hammer Curl', 'Preacher Curl'] },
  { muscle: 'Трицепс', beginner: { mev: 2, mav: 6, mrv: 10, frequency: '1.5-2×/нед' }, intermediate: { mev: 4, mav: 8, mrv: 14, frequency: '2×/нед' }, advanced: { mev: 6, mav: 12, mrv: 18, frequency: '2-3×/нед' }, notes: 'Жимы отдают 0.25 подхода трицепсу.', bestExercises: ['Close-Grip Bench', 'Tricep Pushdown', 'Overhead Extension', 'Dips'] },
  { muscle: 'Ягодичные', beginner: { mev: 4, mav: 8, mrv: 12, frequency: '2×/нед' }, intermediate: { mev: 6, mav: 10, mrv: 16, frequency: '2×/нед' }, advanced: { mev: 8, mav: 14, mrv: 20, frequency: '2-3×/нед' }, notes: 'Присед + тяга = 0.5 подхода. Hip thrust считается полностью.', bestExercises: ['Hip Thrust', 'Bulgarian Split Squat', 'Sumo DL', 'Glute Bridge'] },
  { muscle: 'Икры', beginner: { mev: 4, mav: 8, mrv: 12, frequency: '2×/нед' }, intermediate: { mev: 6, mav: 10, mrv: 16, frequency: '2-3×/нед' }, advanced: { mev: 8, mav: 12, mrv: 18, frequency: '3-4×/нед' }, notes: 'Очень выносливые. Нужен прямой объём.', bestExercises: ['Standing Calf Raise', 'Seated Calf Raise', 'Leg Press Calf'] },
  { muscle: 'Пресс / Кор', beginner: { mev: 4, mav: 8, mrv: 12, frequency: '2-3×/нед' }, intermediate: { mev: 6, mav: 10, mrv: 14, frequency: '3×/нед' }, advanced: { mev: 8, mav: 12, mrv: 16, frequency: '3-4×/нед' }, notes: 'Прямые + косые + поперечная. Plank считается за 1 подход.', bestExercises: ['Plank', 'Ab Wheel', 'Hanging Leg Raise', 'Pallof Press'] },
];

// ═══════════════════════════════════════════════════════════════════════════
// 4. Split Structure Visualizer (8 splits)
// ═══════════════════════════════════════════════════════════════════════════

const SPLIT_VISUALS: SplitVisual[] = [
  {
    name: 'Full Body 3x (FBW)', days: [
      { day: 1, name: 'Пн FBW A', focus: 'Squat-dominant', patterns: ['squat', 'horizontal_push', 'horizontal_pull', 'accessory'], volume: 'medium', intensity: 'medium' },
      { day: 2, name: 'Ср FBW B', focus: 'Hinge-dominant', patterns: ['hinge', 'vertical_push', 'vertical_pull', 'accessory'], volume: 'medium', intensity: 'medium' },
      { day: 3, name: 'Пт FBW C', focus: 'Press-dominant', patterns: ['squat', 'horizontal_push', 'horizontal_pull', 'hinge'], volume: 'medium', intensity: 'medium' },
    ], totalVolume: '12-18 sets/muscle/week', totalFrequency: '3×/нед на группу', suitability: ['Новички', 'Возвращение после перерыва', 'Ограниченное время'],
  },
  {
    name: 'Upper/Lower 4x', days: [
      { day: 1, name: 'Пн Upper Strength', focus: 'Сила верха', patterns: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull'], volume: 'low', intensity: 'high' },
      { day: 2, name: 'Вт Lower Strength', focus: 'Сила низа', patterns: ['squat', 'hinge', 'lunge'], volume: 'low', intensity: 'high' },
      { day: 3, name: 'Чт Upper Hyper', focus: 'Гипертрофия верха', patterns: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'accessory'], volume: 'high', intensity: 'medium' },
      { day: 4, name: 'Пт Lower Hyper', focus: 'Гипертрофия низа', patterns: ['squat', 'hinge', 'lunge', 'accessory'], volume: 'high', intensity: 'medium' },
    ], totalVolume: '14-20 sets/muscle/week', totalFrequency: '2×/нед на группу', suitability: ['Средний уровень', 'Сила+гипертрофия', '4 дня/нед'],
  },
  {
    name: 'Push/Pull/Legs 6x', days: [
      { day: 1, name: 'Пн Push A', focus: 'Грудь+Плечи+Трицепс (сила)', patterns: ['horizontal_push', 'vertical_push', 'accessory'], volume: 'medium', intensity: 'high' },
      { day: 2, name: 'Вт Pull A', focus: 'Спина+Бицепс (сила)', patterns: ['horizontal_pull', 'vertical_pull', 'hinge'], volume: 'medium', intensity: 'high' },
      { day: 3, name: 'Ср Legs A', focus: 'Квадры+Ягодицы (сила)', patterns: ['squat', 'hinge', 'lunge'], volume: 'medium', intensity: 'high' },
      { day: 4, name: 'Чт Push B', focus: 'Грудь+Плечи+Трицепс (hyper)', patterns: ['horizontal_push', 'vertical_push', 'accessory'], volume: 'high', intensity: 'medium' },
      { day: 5, name: 'Пт Pull B', focus: 'Спина+Бицепс (hyper)', patterns: ['horizontal_pull', 'vertical_pull'], volume: 'high', intensity: 'medium' },
      { day: 6, name: 'Сб Legs B', focus: 'Квадры+Ягодицы (hyper)', patterns: ['squat', 'hinge', 'lunge', 'accessory'], volume: 'high', intensity: 'medium' },
    ], totalVolume: '16-24 sets/muscle/week', totalFrequency: '2×/нед', suitability: ['Продвинутые', 'Гипертрофия', '6 дней/нед'],
  },
  {
    name: 'Powerbuilding (4-Day)', days: [
      { day: 1, name: 'Пн Squat + Lower', focus: 'Присед + низ (сила)', patterns: ['squat', 'hinge', 'lunge'], volume: 'medium', intensity: 'high' },
      { day: 2, name: 'Вт Bench + Upper', focus: 'Жим + верх (сила)', patterns: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull'], volume: 'medium', intensity: 'high' },
      { day: 3, name: 'Чт Deadlift + Posterior', focus: 'Тяга + задняя цепь', patterns: ['hinge', 'horizontal_pull', 'carry'], volume: 'low', intensity: 'high' },
      { day: 4, name: 'Пт Upper Hypertrophy', focus: 'Верх (гипертрофия)', patterns: ['horizontal_push', 'vertical_push', 'vertical_pull', 'accessory'], volume: 'high', intensity: 'medium' },
    ], totalVolume: '12-18 sets/muscle/week', totalFrequency: '1.5-2×/нед', suitability: ['Сила + масса', 'Средний-продвинутый'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════════

export function getTrainingMethods(): TrainingMethod[] { return TRAINING_METHODS; }
export function getMethodsByCategory(cat: string): TrainingMethod[] { return TRAINING_METHODS.filter(m => m.category === cat); }
export function getFederationStandards(): FedStandard[] { return [IPF_STANDARDS]; }
export function getQualifyingTotal(fed: string, meet: string, weightClass: number): number {
  const f = [IPF_STANDARDS].find(f => f.federation === fed); if (!f) return 0;
  const w = f.weightClasses.reduce((p, c) => Math.abs(c - weightClass) < Math.abs(p - weightClass) ? c : p);
  return f.qualifyingTotals[meet]?.[String(w)] || 0;
}
export function getVolumeReferences(): VolumeReference[] { return VOLUME_REFERENCES; }
// Маппинг английских групповых имён (ex.group: chest/back/...) на русские названия VOLUME_REFERENCES.
const MUSCLE_GROUP_RU: Record<string, string> = {
  chest: 'Грудь', back: 'Спина', legs: 'Квадрицепсы', shoulders: 'Плечи', arms: 'Бицепс', core: 'Пресс / Кор',
  hamstrings: 'Бицепс бедра', glutes: 'Ягодичные', calves: 'Икры', triceps: 'Трицепс', biceps: 'Бицепс', quads: 'Квадрицепсы',
};
export function getVolumeByMuscle(muscle: string): VolumeReference | undefined {
  const m = (MUSCLE_GROUP_RU[muscle.toLowerCase()] || muscle).toLowerCase();
  return VOLUME_REFERENCES.find(v => v.muscle.toLowerCase() === m)
    || VOLUME_REFERENCES.find(v => v.muscle.toLowerCase().includes(m) || m.includes(v.muscle.toLowerCase()));
}
export function getSplitVisuals(): SplitVisual[] { return SPLIT_VISUALS; }

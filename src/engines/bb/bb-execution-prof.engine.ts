/**
 * bb-execution-prof.engine.ts — PROF чек-листы выполнения «как дать именно в мышцу».
 * Канон Schoenfeld / Israetel / Contreras: угол, локти, лопатки, темп, пауза, ROM, mind-muscle.
 * Данные — из EXERCISE_CATALOG.technique + EXERCISE_BIOMECHANICS_DB.techniqueCues + TARGET_MUSCLE_DB.
 * Чистый, без мутаций плана.
 */

export interface ProfExecutionProfile {
  muscle: string; // канонический или гранулярный (chest_upper, delt_mid)
  label: string;
  angle?: string; // напр. "30° не 45°"
  elbow?: string;
  scapula?: string;
  tempo: string; // напр. "3-1-1-0"
  rom: string; // напр. "пауза 1с внизу в растянутой"
  cues: string[]; // 3-4 чек-пункта
  errors: string[]; // частые ошибки
  mindMuscle: string; // фраза mind-muscle
}

const PROF_DB: Record<string, ProfExecutionProfile> = {
  chest_upper: {
    muscle: 'chest_upper', label: 'Верх груди (ключичная)',
    angle: 'Скамья 30° (не 45°)', elbow: 'Локти 75° к корпусу', scapula: 'Лопатки сведены+опущены, грудь колесом',
    tempo: '3-1-1-0', rom: 'Пауза 1с внизу в растянутой, полная амплитуда',
    cues: ['Скамья 30° (не 45° — иначе передняя дельта)', 'Лопатки сведены вниз, грудь колесом', 'Локти 75° к корпусу, гриф к подбородку/верху груди', 'Сведение гантелей с супинацией вверху, 1с пауза внизу в растянутой'],
    errors: ['Угол 45° → передняя дельта забирает', 'Локти 90° → плечо', 'Без паузы → нет stretch-mediated', 'Отбив от груди'],
    mindMuscle: 'Думай что обнимаешь дерево локтями вперёд — включится верх груди, не трицепс',
  },
  chest_mid: {
    muscle: 'chest_mid', label: 'Середина груди',
    angle: 'Горизонтально', elbow: 'Локти 75°', scapula: 'Лопатки сведены вниз',
    tempo: '3-1-1-0', rom: 'Пауза 1с внизу, без отбива',
    cues: ['Плечи вниз-назад, лопатки сведены', 'Локти 75° к корпусу, гриф к соскам', '1с пауза внизу в растянутой, без отбива', 'Выдох на жиме, контролируемый негатив 3с'],
    errors: ['Локти в стороны 90° → плечо', 'Отбив от груди', 'Мост чрезмерный', 'Ягодицы отрываются'],
    mindMuscle: 'Веди локтями вперёд, своди гантели — почувствуй растяжение внизу',
  },
  chest_lower: {
    muscle: 'chest_lower', label: 'Низ груди',
    angle: 'Отриц. -15° или брусья наклон 30° вперёд', elbow: 'Локти в стороны (брусья)', scapula: 'Плечи вниз',
    tempo: '3-1-1-0', rom: 'Глубокое растяжение внизу',
    cues: ['Брусья: наклон 30° вперёд, локти в стороны', 'Глубокое растяжение внизу', 'Пауза 1с внизу, мощное сведение вверх'],
    errors: ['Вертикально → трицепс', 'Неглубоко'],
    mindMuscle: 'Наклон вперёд — грудь, вертикально — трицепс',
  },
  back_width: {
    muscle: 'back_width', label: 'Ширина спины (широчайшие)',
    angle: 'Вертик. тяга', elbow: 'Локти вдоль тела к карманам/тазу', scapula: 'Лопатки вниз-назад (не к ушам), грудь вперёд',
    tempo: '3-1-1-1', rom: 'Растяжение внизу 1с, пауза 1с в пике',
    cues: ['Тяни локтями к карманам, не кистями', 'Лопатки вниз-назад, грудь вперёд', '1с пауза в пике (сведение лопаток вниз)', '2с негатив, растяжение внизу 1с'],
    errors: ['Локти в стороны → ромбовидные', 'Тяга кистями → бицепс', 'Нет паузы → нет пика', 'Раскачка корпусом'],
    mindMuscle: 'Думай локтями к карманам — включится широчайшая, не бицепс',
  },
  back_thickness: {
    muscle: 'back_thickness', label: 'Толщина спины (центр/ромбы)',
    angle: 'Гориз. тяга', elbow: 'Локти в стороны 60-90°', scapula: 'Лопатки к позвоночнику',
    tempo: '3-1-1-1', rom: 'Пауза 1с в пике',
    cues: ['Локти в стороны 60-90°', 'Тяга к низу живота/груди', 'Сведи лопатки к позвоночнику на 1с', 'Корпус фиксирован, без читинга'],
    errors: ['Корпус раскачивается', 'Локти узко → широчайшие', 'Нет сведения лопаток'],
    mindMuscle: 'Своди лопатки, как зажимаешь карандаш между ними',
  },
  delt_mid: {
    muscle: 'delt_mid', label: 'Средняя дельта',
    angle: 'Отведение', elbow: 'Локти чуть согнуты, мизинец выше', scapula: 'Лопатки опущены',
    tempo: '2-1-1-1', rom: 'До уровня плеч (не выше)',
    cues: ['Чуть наклон вперёд 15°', 'Веди локтями, мизинец выше большого', 'До уровня плеч (не выше — трапеция)', 'Пауза 1с вверху, 2с вниз, без раскачки'],
    errors: ['Выше плеч → трапеция', 'Раскачка корпусом', 'Кисти ведут, не локти'],
    mindMuscle: 'Веди локтями, не кистями — включится дельта, не трапеция',
  },
  delt_rear: {
    muscle: 'delt_rear', label: 'Задняя дельта',
    angle: 'Наклон 60-70°', elbow: 'Локти вверх', scapula: 'Сведение лопаток',
    tempo: '2-1-1-1', rom: 'Пауза 1с в пике',
    cues: ['Наклон 60-70°', 'Локти вверх (не назад)', 'Мизинец ведёт', 'Своди лопатки, не кругли спину, 1с пауза'],
    errors: ['Локти назад → широчайшие', 'Кругление спины'],
    mindMuscle: 'Мизинец вверх, локти к потолку',
  },
  delt_front: {
    muscle: 'delt_front', label: 'Передняя дельта',
    angle: 'Вертик. жим', elbow: 'Локти под грифом', scapula: 'Лопатки опущены',
    tempo: '2-0-1-0', rom: 'Полная амплитуда, без прогиба поясницы',
    cues: ['Локти под грифом', 'Без прогиба поясницы, таз напряжён', 'Жим до выпрямления без щелчка локтей'],
    errors: ['Прогиб поясницы → жим лёжа', 'Неполная амплитуда'],
    mindMuscle: 'Толкай локтями вверх',
  },
  quads: {
    muscle: 'quads', label: 'Квадрицепс',
    angle: 'Присед/жим', elbow: '-', scapula: '-',
    tempo: '3-1-1-0', rom: 'Бёдра ниже параллели, пауза 1с внизу',
    cues: ['Стопы ширина плеч, носки чуть наружу', 'Колени по линии носков, не внутрь', 'Глубина ниже параллели, таз не клюёт', 'Пятки прижаты, подъём толчком пяток, выдох'],
    errors: ['Колени внутрь (вальгус)', 'Пятки отрываются', 'Неглубоко', 'Таз клюёт (butt wink)'],
    mindMuscle: 'Толкай пятками/серединой стопы — почувствуй квадрицепс, не поясницу',
  },
  hamstrings: {
    muscle: 'hamstrings', label: 'Бицепс бедра',
    angle: 'Шарнир', elbow: '-', scapula: '-',
    tempo: '3-1-1-0', rom: 'Растяжение внизу 1с',
    cues: ['Таз назад (шарнир), штанга скользит по ногам', 'Колени мягкие 15-20°, спина нейтраль', 'Почувствуй растяжение сзади 1с внизу', 'Сократи ягодицами вперёд, 1с пауза вверху'],
    errors: ['Кругление поясницы', 'Колени прямые → перегруз поясницы', 'Штанга далеко от ног'],
    mindMuscle: 'Таз — шарнир, растяни сзади, сожми ягодицами',
  },
  glutes: {
    muscle: 'glutes', label: 'Ягодицы',
    angle: 'Хип-траст/выпад широкий', elbow: '-', scapula: '-',
    tempo: '3-1-1-2', rom: 'Пауза 2с в пике',
    cues: ['Хип-траст: подбородок прижат, таз до прямой, пауза 2с вверху', 'Выпад: широкий шаг, толчок пяткой', 'Чувствуй растяжение ягодичной внизу'],
    errors: ['Переразгибание поясницы', 'Толчок носком'],
    mindMuscle: 'Сожми ягодицы вверху на 2с',
  },
  biceps: {
    muscle: 'biceps', label: 'Бицепс',
    angle: 'Сгибание', elbow: 'Локти прижаты к корпусу', scapula: '-',
    tempo: '2-1-1-1', rom: 'Растяжение внизу 1с, пик 1с',
    cues: ['Локти прижаты к корпусу, без раскачки', 'Супинация вверху (длинная головка) / молот нейтрально (брахиалис)', '2с негатив, 1с растяжение внизу, 1с пик вверху'],
    errors: ['Раскачка/читинг', 'Локти вперёд → передняя дельта', 'Бросаешь вес вниз'],
    mindMuscle: 'Локти прижаты, крути мизинец наружу вверху',
  },
  triceps: {
    muscle: 'triceps', label: 'Трицепс',
    angle: 'Разгибание', elbow: 'Локти неподвижны у корпуса', scapula: '-',
    tempo: '2-1-1-1', rom: 'Пауза 1с в выпрямлении',
    cues: ['Локти фиксированы у корпуса', 'Разогни до выпрямления с паузой 1с', '2с негатив, без читинга корпусом'],
    errors: ['Локти гуляют', 'Корпус помогает', 'Неполное выпрямление'],
    mindMuscle: 'Только предплечья движутся, плечо неподвижно',
  },
  calves: {
    muscle: 'calves', label: 'Икры',
    angle: 'Подъём на носки', elbow: '-', scapula: '-',
    tempo: '2-2-1-2', rom: 'Растяжение 2с внизу, пауза 2с вверху',
    cues: ['Полная амплитуда, ниже уровня платформы', '2с растяжение внизу', '2с пауза вверху на носках', 'Колено прямо (стоя) / 90° (сидя)'],
    errors: ['Короткая амплитуда', 'Пружинишь'],
    mindMuscle: 'Растяни внизу, сожми вверху',
  },
  traps: {
    muscle: 'traps', label: 'Трапеции',
    angle: 'Шраги вертикально', elbow: 'Руки прямые', scapula: 'Лопатки вверх-назад, пауза 2с',
    tempo: '2-2-1-1', rom: 'Пауза 2с вверху в сокращении',
    cues: ['Руки прямые, тяни плечами к ушам', 'Пауза 2с вверху', '2с негатив, без рывка', 'Шея нейтраль, взгляд вперёд'],
    errors: ['Рывок корпусом', 'Крутишь плечами', 'Нет паузы'],
    mindMuscle: 'Подними плечи к ушам и сожми на 2с',
  },
  forearms: {
    muscle: 'forearms', label: 'Предплечья',
    angle: 'Сгибание кистей/пронация', elbow: 'Предплечья на скамье', scapula: '-',
    tempo: '2-1-1-1', rom: 'Полная амплитуда кисти, пауза 1с',
    cues: ['Предплечья фиксированы на скамье', 'Полная амплитуда кисти', 'Пауза 1с в пике', 'Молот нейтрально для брахиорадиалиса'],
    errors: ['Читинг локтями', 'Короткая амплитуда'],
    mindMuscle: 'Только кисти движутся',
  },
  abs: {
    muscle: 'abs', label: 'Пресс',
    angle: 'Скручивание таза к груди', elbow: '-', scapula: 'Поясница прижата',
    tempo: '2-1-1-1', rom: 'Пиковое сокращение 1с, без рывка',
    cues: ['Поясница прижата к полу/скамье', 'Скручивай таз к груди, не тяни шею', 'Пауза 1с в пике, 2с негатив', 'Выдох на усилии'],
    errors: ['Тянешь шею', 'Рывок/инерция', 'Прогиб поясницы'],
    mindMuscle: 'Сожми пресс как гармошку',
  },
};

export function getProfExecutionProfile(muscle: string): ProfExecutionProfile | null {
  const key = String(muscle || '').toLowerCase();
  if (PROF_DB[key]) return PROF_DB[key];
  // fallback по канонической
  const aliases: Record<string, string> = {
    shoulders: 'delt_mid',
    chest: 'chest_mid',
    back: 'back_width',
    legs: 'quads',
  };
  if (aliases[key] && PROF_DB[aliases[key]]) return PROF_DB[aliases[key]];
  return null;
}

export function listProfMuscles(): string[] {
  return Object.keys(PROF_DB);
}

/** TUT подхода: сумма фаз темпа × повторы (MAX PRO). tempo "3-1-1-0" = 5с/повт. */
export function tutFor(tempo: string | null | undefined, reps: number): number | null {
  if (!tempo || !Number.isFinite(reps) || reps <= 0) return null;
  const parts = String(tempo).split('-').map((p) => Number(p.trim()));
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const per = parts.reduce((a, b) => a + b, 0);
  if (per <= 0) return null;
  return Math.round(per * reps);
}

export interface ProfGap {
  field: 'angle' | 'elbow' | 'scapula' | 'tempo' | 'rom' | 'cues';
  expected: string;
  actual?: string;
  issue: string;
}

export function diagnoseExecutionProf(
  ex: { name?: string; tempo?: string; pauseSeconds?: number; stretchPhase?: boolean },
  muscle: string,
  actual?: { tempo?: string; pauseSeconds?: number | null },
): ProfGap[] {
  const prof = getProfExecutionProfile(muscle);
  if (!prof) return [];
  const gaps: ProfGap[] = [];
  // темп
  const actualTempo = actual?.tempo || (ex as any).tempo || '';
  if (prof.tempo && actualTempo && actualTempo !== prof.tempo) {
    // мягкая проверка: если нет паузы внизу а prof требует 1с
    if (prof.tempo.includes('1') && !actualTempo.includes('1')) {
      gaps.push({ field: 'tempo', expected: prof.tempo, actual: actualTempo, issue: `Темп ${actualTempo} → ${prof.tempo} (пауза в растянутой)` });
    }
  }
  // ROM (регистронезависимо + cues: часть rom-строк без слова «пауза», но cues её требуют)
  const hasPause = Number(actual?.pauseSeconds ?? (ex as any).pauseSeconds ?? 0) > 0;
  const needPause = /пауза/i.test(prof.rom) || prof.cues.some(c => /пауза/i.test(c));
  if (needPause && !hasPause) {
    gaps.push({ field: 'rom', expected: prof.rom, issue: 'Нет паузы в растянутой — теряется stretch-mediated' });
  }
  return gaps;
}

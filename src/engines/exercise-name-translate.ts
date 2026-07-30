// Перевод английских названий упражнений из библиотеки программ на русский язык.
// Используется для нормализации имён программ (FULL_PROGRAM_LIBRARY, WOMENS_PROGRAMS, CUSTOM_PROGRAMS)
// на этапе загрузки модуля, чтобы во всех экранах (библиотека, конструктор, сохранённые планы)
// упражнения отображались на русском.

export const EXERCISE_NAME_RU: Record<string, string> = {
  'Ab Wheel': 'Колесо пресса',
  'Abductor Machine': 'Отведение ног в тренажёре',
  'Arnold Press': 'Жим Арнольда',
  'Back Extension': 'Гиперэкстензия (разгибание спины)',
  'Back Squat': 'Приседания со штангой на спине',
  'Banded Glute Bridge': 'Ягодичный мост с резиной',
  'Barbell Bench Press': 'Жим штанги лёжа',
  'Barbell Curl': 'Подъём штанги на бицепс',
  'Barbell Row': 'Тяга штанги в наклоне',
  'Barbell Row (chest-supported)': 'Тяга штанги лёжа грудью на опоре',
  'Barbell Row / Power Clean': 'Тяга штанги / рывковая тяга',
  'Barbell Squat': 'Приседания со штангой',
  'Bench': 'Жим лёжа',
  'Bench BBB': 'Жим лёжа BBB',
  'Bench Press': 'Жим штанги лёжа',
  'Bench Press (1-board)': 'Жим лёжа (1 доска)',
  'Bench Press (2nd attempt)': 'Жим лёжа (2-я попытка)',
  'Bench Press (back-off)': 'Жим лёжа (бэк-офф подход)',
  'Bench Press (comp pause)': 'Жим лёжа (соревн. пауза)',
  'Bench Press (comp)': 'Жим лёжа (соревновательный)',
  'Bench Press (feet up)': 'Жим лёжа (ноги вверх)',
  'Bench Press (opener)': 'Жим лёжа (разминочная попытка)',
  'Bench Press (tech)': 'Жим лёжа (технический)',
  'Bench Press 5/3/1': 'Жим лёжа 5/3/1',
  'Bicep Curl': 'Подъём на бицепс',
  'Bird Dog': 'Птичка (бёрд-дог)',
  'Board Press (2-board)': 'Жим с доской (2 доски)',
  'Bulgarian Split Squat': 'Болгарский сплит-присед',
  'Cable Crossover': 'Кроссовер (сведение рук)',
  'Cable Flye': 'Сведение в кроссовере',
  'Cable Kickback': 'Разгибание на трицепс в блоке',
  'Cable Pull-Through': 'Протяжка в блоке (pull-through)',
  'Cable pull-through': 'Протяжка в блоке (pull-through)',
  'Calf Raise': 'Подъём на носки',
  'Chest-Supported Row': 'Тяга грудью на опоре',
  'Close-Grip Bench': 'Жим узким хватом',
  'Close-Grip Bench Press': 'Жим штанги узким хватом',
  'Concentration Curl': 'Концентрированный подъём на бицепс',
  'Core Work (Plank/Leg Raise)': 'Пресс (планка / подъём ног)',
  'DB Bench Press': 'Жим гантелей лёжа',
  'DB Hammer Curl': 'Молотковый подъём гантели',
  'DB Pullover': 'Пулловер с гантелью',
  'DB Row': 'Тяга гантели в наклоне',
  'DB Row (heavy)': 'Тяга гантели (тяжёлая)',
  'DB Shoulder Press': 'Жим гантелей сидя',
  'DL BBB': 'Становая BBB',
  'Deadlift': 'Становая тяга',
  'Deadlift (comp)': 'Становая (соревновательная)',
  'Deadlift 5/3/1': 'Становая 5/3/1',
  'Deadlift BBB': 'Становая BBB',
  'Deficit Deadlift': 'Становая с плинта (дефицит)',
  'Dips': 'Отжимания на брусьях',
  'Dips (assisted if needed)': 'Отжимания на брусьях (с помощью)',
  'Dumbbell Bench': 'Жим гантелей лёжа',
  'Dumbbell Bench Press': 'Жим гантелей лёжа',
  'Dumbbell Curl': 'Подъём гантели на бицепс',
  'Dumbbell Press': 'Жим гантелей',
  'Face Pull': 'Протяжка к лицу (face pull)',
  'Face Pull + Band Pull-Apart': 'Протяжка к лицу + разведение резины',
  'Face pull': 'Протяжка к лицу (face pull)',
  'Floor Press': 'Жим лёжа с пола',
  'Foam Rolling': 'МФР (фоам-ролл)',
  'Foam Rolling + Stretch': 'МФР + растяжка',
  'Frog pumps / band abduction': 'Лягушка / отведение с резиной',
  'Front Squat': 'Фронтальный присед',
  'Glute Bridge': 'Ягодичный мост',
  'Glute-Ham Raise': 'Глюте-хэм подъём (GHR)',
  'Goblet Squat': 'Присед с гирей (гоблет)',
  'Hack Squat': 'Хакк-присед',
  'Hammer Curl': 'Молотковый подъём',
  'Hammer Strength Press': 'Жим в Хаммере',
  'Hanging Leg Raise': 'Подъём ног в висе',
  'Hip Thrust': 'Ягодичный толчок (hip thrust)',
  'Hip Thrust (Heavy)': 'Ягодичный толчок (тяжёлый)',
  'Incline Barbell Press': 'Жим штанги на наклонной',
  'Incline Bench': 'Жим на наклонной',
  'Incline DB': 'Жим гантелей на наклонной',
  'Incline DB Press': 'Жим гантелей на наклонной',
  'Incline Dumbbell Press': 'Жим гантелей на наклонной',
  'LISS Cardio': 'Кардио LISS',
  'Lat Pulldown': 'Тяга верхнего блока',
  'Lateral Raise': 'Махи в стороны',
  'Lateral Raise Cable': 'Махи в стороны в блоке',
  'Lateral Raise DB': 'Махи гантелями в стороны',
  'Leg Curl': 'Сгибание ног',
  'Leg Extension': 'Разгибание ног',
  'Leg Press': 'Жим ногами',
  'Leg Press (High)': 'Жим ногами (высоко)',
  'Leg Raise': 'Подъём ног',
  'Lying Leg Curl': 'Сгибание ног лёжа',
  'Machine Row': 'Тяга в тренажёре',
  'Mobility Drills': 'Мобильность',
  'Mountain Climber': 'Горный ключ',
  'OHP': 'Жим стоя (армейский)',
  'OHP (Barbell)': 'Жим штанги стоя',
  'OHP 5/3/1': 'Жим стоя 5/3/1',
  'OHP BBB': 'Жим стоя BBB',
  'Overhead Press': 'Жим стоя',
  'Overhead Press (strict)': 'Жим стоя (строгий)',
  'Overhead Tricep Ext': 'Разгибание трицепса из-за головы',
  'Overhead Tricep Extension': 'Разгибание трицепса из-за головы',
  'Pause Bench (2ct)': 'Жим лёжа с паузой (2 счёта)',
  'Pause Squat (2ct)': 'Присед с паузой (2 счёта)',
  'Pec Deck Fly': 'Сведение в пек-деке',
  'Plank': 'Планка',
  'Preacher Curl': 'Подъём на бицепс на скамье Скотта',
  'Pull-Up': 'Подтягивание',
  'Pull-up': 'Подтягивание',
  'Pull-ups': 'Подтягивания',
  'Pull-ups (weighted)': 'Подтягивания с весом',
  'Push-up': 'Отжимания от пола',
  'RDL': 'Румынская тяга',
  'Rear Delt Fly': 'Махи на заднюю дельту',
  'Rear Delt Flye': 'Махи на заднюю дельту',
  'Reverse Hyper': 'Обратная гиперэкстензия',
  'Romanian Deadlift': 'Румынская тяга',
  'Russian Twist': 'Русский твист',
  'Seated Cable Row': 'Тяга блока сидя',
  'Seated Calf Raise': 'Подъём на носки сидя',
  'Single Arm DB Row': 'Тяга гантели одной рукой',
  'Single Leg RDL': 'Румынская тяга на одной ноге',
  'Skull Crusher': 'Французский жим',
  'Speed Bench (8×3)': 'Скоростной жим лёжа (8×3)',
  'Speed Bench (9×3)': 'Скоростной жим лёжа (9×3)',
  'Speed Box Squat (12×2)': 'Скоростной бокс-присед (12×2)',
  'Speed Deadlift (8×1)': 'Скоростная становая (8×1)',
  'Squat': 'Приседания',
  'Squat (back-off)': 'Присед (бэк-офф)',
  'Squat (comp)': 'Присед (соревновательный)',
  'Squat 5/3/1': 'Присед 5/3/1',
  'Squat BBB': 'Присед BBB',
  'Standing Calf Raise': 'Подъём на носки стоя',
  'Step-Up': 'Выпады на платформу (степ-ап)',
  'Stiff-Leg Deadlift': 'Становая на прямых ногах',
  'Straight-Arm Pulldown': 'Пулловер в блоке (прямой рукой)',
  'Stretching / Mobility': 'Растяжка / мобильность',
  'Sumo Deadlift': 'Становая сумо',
  'T-Bar Row': 'Тяга T-грифа',
  'Tricep Extension (OH)': 'Разгибание трицепса из-за головы',
  'Tricep Pushdown': 'Разгибание трицепса в блоке',
  'Tricep Pushdown (straight bar)': 'Разгибание трицепса в блоке (прямой гриф)',
  'Walking Lunge': 'Ходьба выпадами',
  'Weak Point Exercise 1': 'Упражнение на слабое звено 1',
  'Weak Point Exercise 2': 'Упражнение на слабое звено 2',
  'Weak Point Exercise 3': 'Упражнение на слабое звено 3',
  'Weighted Dip': 'Отжимания на брусьях с весом',
  'Weighted Pull-Up': 'Подтягивания с весом',
};

const cache: Record<string, string> = {};

export function translateExerciseName(name: string): string {
  if (!name) return name;
  if (cache[name] !== undefined) return cache[name];
  const key = name.trim();
  let ru = EXERCISE_NAME_RU[key];
  if (!ru) {
    // поиск без учёта регистра
    const lower = key.toLowerCase();
    for (const k in EXERCISE_NAME_RU) {
      if (k.toLowerCase() === lower) { ru = EXERCISE_NAME_RU[k]; break; }
    }
  }
  const result = ru || name;
  cache[name] = result;
  return result;
}

/** Нормализует имена упражнений в программе (недели → дни → упражнения). */
export function normalizeProgramLibraryNames(programs: any[]): void {
  if (!programs) return;
  for (const p of programs) {
    const weeks = p?.weeks;
    if (!weeks) continue;
    for (const w of weeks) {
      const days = w?.days;
      if (!days) continue;
      for (const d of days) {
        const exs = d?.exercises;
        if (!exs) continue;
        for (const e of exs) {
          if (e && typeof e.name === 'string') e.name = translateExerciseName(e.name);
        }
      }
    }
  }
}

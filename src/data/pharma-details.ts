import type { PharmaSynergy, SideEffect } from '../core/types';

export interface PharmaDetail {
  id: string;
  description: string;
  mechanism: string;
  synergies: PharmaSynergy[];
  contraindications: string[];
  sideEffects: SideEffect[];
  dosageRange?: { min: number; max: number; unit: string; frequency: string };
  researchLinks?: { title: string; url: string; source: string }[];
}

export const PHARMA_DETAILS: Record<string, PharmaDetail> = {
  test_enan: {
    id: 'test_enan',
    description: 'Эфирированная форма тестостерона с периодом полувыведения ~4.5 дня. Основной андрогенный препарат для ЗТТ и массонаборных курсов. Обеспечивает стабильный уровень тестостерона при еженедельных инъекциях.',
    mechanism: 'Связывается с андрогенными рецепторами (AR) → транслокация комплекса AR-тестостерон в ядро → активация генов белкового синтеза (AR-dependent транскрипция). Конвертируется в дигидротестостерон (ДГТ) через 5α-редуктазу и в эстрадиол через ароматазу.',
    synergies: [
      { with: 'hcg', type: 'complementary', desc: 'Предотвращает атрофию яичек, сохраняет эндогенную продукцию тестостерона и дескенс-цепь ЛГ' },
      { with: 'anastro', type: 'complementary', desc: 'Контроль эстрадиола при ароматизации — предотвращает гинекомастию и задержку жидкости' },
      { with: 'nandrolone', type: 'synergistic', desc: 'Усиленный анаболический эффект через синергию AR-зависимых путей белкового синтеза' },
      { with: 'finasteride', type: 'antagonistic', desc: 'Снижает ДГТ-зависимые побочки, но может маскировать андрогенный дефицит в коже/простате' },
    ],
    contraindications: ['Рак простаты', 'Рак молочной железы (муж)', 'Тромбофилия', 'Полицитемия (Hct >54%)', 'Обструктивная гипертрофия простаты', 'Тяжёлая сердечная недостаточность'],
    sideEffects: [
      { effect: 'Эстрадиоловая ароматизация (гино, отёки, перепады настроения)', frequency: 'common' },
      { effect: 'ДГТ-зависимые эффекты (алопеция, акне, гипертрофия простаты)', frequency: 'common' },
      { effect: 'Супрессия HPTA (эндогенный тестостерон ↓)', frequency: 'common' },
      { effect: 'Эритропоэз (полицитемия)', frequency: 'common' },
      { effect: 'Дислипидемия (ЛПВП ↓)', frequency: 'common' },
      { effect: 'Кардиотоксичность при высоких дозах', frequency: 'rare' },
      { effect: 'Задержка натрия и воды', frequency: 'common' },
    ],
    dosageRange: { min: 100, max: 500, unit: 'мг/нед', frequency: '1 раз в 5-7 дней' },
    researchLinks: [
      { title: 'Androgen Receptor Signaling and Anabolic Steroids', url: 'https://pubmed.ncbi.nlm.nih.gov/25675555/', source: 'PubMed' },
      { title: 'Testosterone and Cardiovascular Risk', url: 'https://pubmed.ncbi.nlm.nih.gov/29059068/', source: 'PubMed' },
      { title: 'HPTA Suppression and Recovery', url: 'https://pubmed.ncbi.nlm.nih.gov/31537912/', source: 'PubMed' },
    ],
  },

  tren_acet: {
    id: 'tren_acet',
    description: '19-нор производное тестостерона. Мощнейший анаболик (анаболический индекс 500 vs тестостерон 100). Не ароматизируется, но значительно повышает пролактин. Ацетатный эфир — короткий период полувыведения (~3 дня).',
    mechanism: 'Мощный агонист AR (аффинность в 5× выше тестостерона). Активирует mTOR и MAPK/ERK-каскад → массивный белковый синтез. Не конвертируется в эстрадиол, но индуцирует пролактин через серотонинергические пути. Ингибирует 11β-HSD2 → кортизоловый парадокс.',
    synergies: [
      { with: 'test_enan', type: 'synergistic', desc: 'Комбинация тестостерон + тренболоне — классический массонаборный стек, синергия по AR' },
      { with: 'caberg', type: 'complementary', desc: 'Каберголин подавляет пролактин, индуцированный тренболоном — предотвращает гинекомастию и снижение либидо' },
      { with: 'anastro', type: 'antagonistic', desc: 'Тренболон не ароматизируется — ИА не нужны и могут снизить эстрадиол до опасных уровней' },
    ],
    contraindications: ['Рак простаты', 'Тяжёлая гипертензия', 'Психические расстройства (паранойя, агрессия)', 'Тромбофилия', 'Беременность партнёрши'],
    sideEffects: [
      { effect: 'Пролактин-индуцированная гинекомастия', frequency: 'common' },
      { effect: 'Агрессия, бессонница, «трен-кашель»', frequency: 'common' },
      { effect: 'Почечная токсичность (не гепатотоксичен!)', frequency: 'common' },
      { effect: 'Супрессия HPTA (полная, быстрое восстановление)', frequency: 'common' },
      { effect: 'Ночная потливость и бессонница', frequency: 'common' },
      { effect: 'Кардиотоксичность (гипертрофия левого желудочка)', frequency: 'rare' },
      { effect: 'Психозоподобные состояния', frequency: 'very_rare' },
    ],
    dosageRange: { min: 50, max: 350, unit: 'мг/нед', frequency: 'через день ( acetate)' },
    researchLinks: [
      { title: 'Trenbolone and Androgen Receptor Activation', url: 'https://pubmed.ncbi.nlm.nih.gov/15845332/', source: 'PubMed' },
      { title: 'Trenbolone and Prolactin Secretion', url: 'https://pubmed.ncbi.nlm.nih.gov/8336952/', source: 'PubMed' },
      { title: 'Cardiovascular Risks of Trenbolone', url: 'https://pubmed.ncbi.nlm.nih.gov/25465822/', source: 'PubMed' },
    ],
  },

  oxan: {
    id: 'oxan',
    description: 'Оксандролон (Анавар) — пероральный ААС с минимальной андрогенной активностью и низким гепатотоксическим потенциалом. Популярен на сушке и у женщин.',
    mechanism: 'Слабый агонист AR (анаболический индекс 322-630 vs тестостерон 100). Не ароматизируется, не конвертируется в ДГТ. Активирует AR → ↑ белковый синтез, ↑ азотистый баланс, ↑ IGF-1. Минимально подавляет HPTA при дозах <20 мг/день.',
    synergies: [
      { with: 'test_enan', type: 'synergistic', desc: 'Тестостерон как база + оксандролон для синергии белкового синтеза' },
      { with: 'stan', type: 'complementary', desc: 'Оба DHT-производные — синергия при сушке, но двойная нагрузка на суставы' },
    ],
    contraindications: ['Тяжёлая печёночная недостаточность', 'Рак простаты', 'Беременность', 'Гиперкальциемия при злокачественных опухолях'],
    sideEffects: [
      { effect: 'Лёгкая гепатотоксичность (меньше чем у других оралов)', frequency: 'rare' },
      { effect: 'Супрессия HPTA (дозозависимая)', frequency: 'common' },
      { effect: 'Дислипидемия (ЛПВП ↓)', frequency: 'common' },
      { effect: 'Снижение либидо при высоких дозах', frequency: 'rare' },
    ],
    dosageRange: { min: 20, max: 80, unit: 'мг/день', frequency: 'ежедневно' },
    researchLinks: [
      { title: 'Oxandrin Mechanism of Action', url: 'https://pubmed.ncbi.nlm.nih.gov/6144577/', source: 'PubMed' },
      { title: 'Oxandrolone and Protein Synthesis', url: 'https://pubmed.ncbi.nlm.nih.gov/6424762/', source: 'PubMed' },
      { title: 'Oxandrolone Safety Profile', url: 'https://pubmed.ncbi.nlm.nih.gov/3530858/', source: 'PubMed' },
    ],
  },

  anastro: {
    id: 'anastro',
    description: 'Анастрозол (Аримидекс) — ингибитор ароматазы III поколения. Блокирует конверсию тестостерона в эстрадиол на >80%. Ключевой препарат контроля эстрогена на курсах.',
    mechanism: 'Обратимо связывает ароматазу → блокирует конверсию андростендиона и тестостерона в эстрадиол. Уменьшает эстрадиол на 80-96% при 1 мг/день. ↑ ЛГ и ФСГ через обратную связь (устранение отрицательной обратной связи эстрогена).',
    synergies: [
      { with: 'test_enan', type: 'complementary', desc: 'Предотвращает эстрадиоловые побочки на тестостероновых курсах' },
      { with: 'clomi', type: 'complementary', desc: 'ИА + кломид на ПКТ: ИА снижает эстрадиол, кломид стимулирует ЛГ/ФСГ' },
      { with: 'tren_acet', type: 'antagonistic', desc: 'Трен не ароматизируется — ИА может снизить эстрадиол до опасных уровней (суставы, либидо, настроение)' },
    ],
    contraindications: ['Беременность', 'Тяжёлый остеопороз (эстроген.Protectiv для костей)', 'Предменопауза без ЗТТ'],
    sideEffects: [
      { effect: 'Суставные боли (снижение эстрогена до критических уровней)', frequency: 'common' },
      { effect: 'Снижение либидо при передозировке', frequency: 'common' },
      { effect: 'Ухудшение липидного профиля (ЛПВП ↓↓ )', frequency: 'common' },
      { effect: 'Остеопороз при длительном применении', frequency: 'rare' },
      { effect: 'Депрессия и раздражительность', frequency: 'common' },
    ],
    dosageRange: { min: 0.25, max: 1, unit: 'мг/день', frequency: '2-3 раза в неделю' },
    researchLinks: [
      { title: 'Anastrozole Mechanism of Action', url: 'https://pubmed.ncbi.nlm.nih.gov/10800321/', source: 'PubMed' },
      { title: 'Anastrozole and Cardiovascular Risk', url: 'https://pubmed.ncbi.nlm.nih.gov/15159357/', source: 'PubMed' },
      { title: 'Anastrozole and Bone Health', url: 'https://pubmed.ncbi.nlm.nih.gov/12826530/', source: 'PubMed' },
    ],
  },

  caberg: {
    id: 'caberg',
    description: 'Каберголин (Достинекс) — агонист дофаминовых D2-рецепторов длительного действия. Мощный супрессор пролактина. Необходим при 19-нор курсах.',
    mechanism: 'Мощный агонист D2-рецепторов → прямое ингибирование секреции пролактина лактотрофами аденогипофиза. Период полувыведения ~65 часов. Также снижает резистентность к инсулину через дофаминергические пути.',
    synergies: [
      { with: 'tren_acet', type: 'complementary', desc: 'Контроль пролактина, индуцированного тренболоном' },
      { with: 'deca', type: 'complementary', desc: 'Нандролон ↑ пролактин — каберголин подавляет' },
      { with: 'test_enan', type: 'complementary', desc: 'Контроль пролактина при стеках с 19-нор' },
    ],
    contraindications: ['Тяжёлая печёночная недостаточность', 'Фиброзные заболевания сердечных клапанов', 'Психозы', 'Неконтролируемая гипертензия'],
    sideEffects: [
      { effect: 'Тошнота и желудочно-кишечные нарушения', frequency: 'common' },
      { effect: 'Снижение АД (ортостатическая гипотензия)', frequency: 'common' },
      { effect: 'Импульсивные расстройства (гиперсексуальность, азартные игры)', frequency: 'rare' },
      { effect: 'Фиброз клапанов сердца при длительном применении', frequency: 'very_rare' },
    ],
    dosageRange: { min: 0.25, max: 1, unit: 'мг/нед', frequency: '1-2 раза в неделю' },
    researchLinks: [
      { title: 'Cabergoline and Prolactin Suppression', url: 'https://pubmed.ncbi.nlm.nih.gov/18282412/', source: 'PubMed' },
      { title: 'Cabergoline and Cardiac Valvulopathy', url: 'https://pubmed.ncbi.nlm.nih.gov/17925128/', source: 'PubMed' },
      { title: 'Cabergoline and Impulse Control Disorders', url: 'https://pubmed.ncbi.nlm.nih.gov/19617025/', source: 'PubMed' },
    ],
  },

  clomi: {
    id: 'clomi',
    description: 'Кломифена цитрат — селективный модулятор эстрогеновых рецепторов (SERM). Стандартный препарат ПКТ для восстановления HPTA.',
    mechanism: 'Конкурентно связывается с эстрогеновыми рецепторами в гипоталамусе и гипофизе → блокирует отрицательную обратную связь эстрадиола → ↑ ГнРГ → ↑ ЛГ и ФСГ. В периферических тканях действует как антиэстроген (грудь, простата) и эстроген (кость, липиды).',
    synergies: [
      { with: 'tamox', type: 'synergistic', desc: 'Комбинация Кломид + Тамоксифен — золотой стандарт ПКТ' },
      { with: 'hcg', type: 'complementary', desc: 'ХГЧ восстанавливает яички + Кломид стимулирует ЛГ/ФСГ' },
      { with: 'anastro', type: 'complementary', desc: 'ИА снижает эстрадиол, Кломид блокирует ER — синергия на ПКТ' },
    ],
    contraindications: ['Беременность', 'Тяжёлая печёночная недостаточность', 'Тромбоэмболия в анамнезе', 'Кисты яичников'],
    sideEffects: [
      { effect: 'Перепады настроения, раздражительность', frequency: 'common' },
      { effect: 'Затуманивание зрения (редко)', frequency: 'rare' },
      { effect: 'Приливы жара', frequency: 'common' },
      { effect: 'Головные боли', frequency: 'common' },
    ],
    dosageRange: { min: 25, max: 100, unit: 'мг/день', frequency: 'ежедневно на ПКТ' },
    researchLinks: [
      { title: 'Clomiphene Mechanism of Action', url: 'https://pubmed.ncbi.nlm.nih.gov/6372424/', source: 'PubMed' },
      { title: 'Clomiphene and HPTA Recovery', url: 'https://pubmed.ncbi.nlm.nih.gov/21241681/', source: 'PubMed' },
      { title: 'Clomiphene Safety Profile', url: 'https://pubmed.ncbi.nlm.nih.gov/3400345/', source: 'PubMed' },
    ],
  },

  bpc157: {
    id: 'bpc157',
    description: 'BPC-157 (Body Protective Compound-157) — пептид из 15 аминокислот, производный белка желудка. Мощнейший регенератор тканей — связывает ангиогенные и цитопротекторные эффекты.',
    mechanism: 'Активирует VEGF (сосудистый эндотелиальный фактор роста) → ангиогенез → неоваскуляризация повреждённых тканей. Активирует FGF-2 → пролиферация фибробластов и синтез коллагена. Стабилизирует NO-путь → цитопротекция endothelial NO-synthase. Модулирует простагландиновый каскад через POS-путь.',
    synergies: [
      { with: 'tb500', type: 'synergistic', desc: 'BPC-157 (ангиогенез) + TB-500 (актин-ремоделирование) = синергия регенерации сухожилий и связок' },
      { with: 'vitamin_c', type: 'complementary', desc: 'Витамин C + BPC-157 → синергия синтеза коллагена и ангиогенеза' },
    ],
    contraindications: ['Активные злокачественные новообразования (ангиогенез может стимулировать рост опухолей)', 'Беременность'],
    sideEffects: [
      { effect: 'Возможная стимуляция ангиогенеза при скрытых опухолях', frequency: 'very_rare' },
      { effect: 'Лёгкая тошнота при пероральном приёме', frequency: 'rare' },
    ],
    dosageRange: { min: 200, max: 500, unit: 'мкг/день', frequency: '1-2 раза в день, 2-4 недели' },
    researchLinks: [
      { title: 'BPC-157 and Angiogenesis', url: 'https://pubmed.ncbi.nlm.nih.gov/23975201/', source: 'PubMed' },
      { title: 'BPC-157 and Tendon Healing', url: 'https://pubmed.ncbi.nlm.nih.gov/25428112/', source: 'PubMed' },
      { title: 'BPC-157 and Organ Protection', url: 'https://pubmed.ncbi.nlm.nih.gov/26878560/', source: 'PubMed' },
    ],
  },

  semax: {
    id: 'semax',
    description: 'Семакс (Ме-Glu-His-Phe-Pro-Gly-Pro) — ноотропный пептид, синтетический аналог ACTH(4-7). Стимулирует нейрогенез, повышает BDNF, улучшает когнитивные функции.',
    mechanism: 'Активирует меланокортиновые рецепторы MC3/MC4 → ↑ BDNF и NGF в гиппокампе. Модулирует серотониновый и дофаминовый обмен. Улучшает церебральный кровоток через NO-путь. Нормализует баланс возбуждения/торможения в ЦНС.',
    synergies: [
      { with: 'selank', type: 'synergistic', desc: 'Семакс + Селанк = синергия нейропротекции и ноотропии' },
      { with: 'vitamin_b12', type: 'complementary', desc: 'Витамин B12 + Семакс = улучшение нервной проводимости' },
    ],
    contraindications: ['Беременность', 'Повышенная чувствительность к пептидам'],
    sideEffects: [
      { effect: 'Лёгкое раздражение слизистой носа', frequency: 'common' },
      { effect: 'Головная боль при высоких дозах', frequency: 'rare' },
    ],
    dosageRange: { min: 500, max: 2000, unit: 'мкг/день', frequency: '2 раза в день (назальный спрей)' },
    researchLinks: [
      { title: 'Semax and Neuroprotection', url: 'https://pubmed.ncbi.nlm.nih.gov/16217856/', source: 'PubMed' },
      { title: 'Semax and BDNF Expression', url: 'https://pubmed.ncbi.nlm.nih.gov/19174090/', source: 'PubMed' },
      { title: 'Semax and Cognitive Function', url: 'https://pubmed.ncbi.nlm.nih.gov/24022628/', source: 'PubMed' },
    ],
  },

  selank: {
    id: 'selank',
    description: 'Селанк (Ме-Glu-His-Pro-Gly-Pro) — ноотропный пептид, синтетический аналог пептида Тимуса. Анксиолитическое и нейропротекторное действие.',
    mechanism: 'Модулирует дофаминовый, серотониновый и ГАМК-ергический обмен. ↑ BDNF и NGF. Стабилизирует баланс возбуждения/торможения в ЦНС. Обладает выраженным анксиолитическим эффектом без седации.',
    synergies: [
      { with: 'semax', type: 'synergistic', desc: 'Селанк + Семакс = синергия нейропротекции и ноотропии' },
      { with: 'vitamin_b12', type: 'complementary', desc: 'Витамин B12 + Селанк = улучшение нервной проводимости' },
    ],
    contraindications: ['Беременность', 'Повышенная чувствительность к пептидам'],
    sideEffects: [
      { effect: 'Лёгкое раздражение слизистой носа', frequency: 'common' },
      { effect: 'Головная боль при высоких дозах', frequency: 'rare' },
    ],
    dosageRange: { min: 500, max: 2000, unit: 'мкг/день', frequency: '2 раза в день (назальный спрей)' },
    researchLinks: [
      { title: 'Selank and Anxiety Reduction', url: 'https://pubmed.ncbi.nlm.nih.gov/16217855/', source: 'PubMed' },
      { title: 'Selank and BDNF Expression', url: 'https://pubmed.ncbi.nlm.nih.gov/19174091/', source: 'PubMed' },
      { title: 'Selank and Cognitive Function', url: 'https://pubmed.ncbi.nlm.nih.gov/24022629/', source: 'PubMed' },
    ],
  },

  mk677: {
    id: 'mk677',
    description: 'Ибутаморен (MK-677) — пероральный секретагог гормона роста. Миметизирует грелиновый рецептор (GHSR), стимулирует пульс GH и IGF-1. Пероральная альтернатива инъекционному GH.',
    mechanism: 'Мощный агонист GHSR (грелинового рецептора) → стимуляция соматотрофов аденогипофиза → пульсирующая секреция GH → ↑ IGF-1 в печени. Также ↑ ЛГ/ФСГ (слабо) и ↑ аппетит через грелиновый путь в гипоталамусе.',
    synergies: [
      { with: 'cjc1295', type: 'synergistic', desc: 'GHRH (CJC) + GHSR-агонист (MK-677) = максимальный пульс GH, больше чем каждый по отдельности' },
      { with: 'berberine', type: 'complementary', desc: 'MK-677 может ↑ инсулинорезистентность → береберин компенсирует через AMPK' },
    ],
    contraindications: ['Активные злокачественные опухоли (GH/IGF-1 могут стимулировать рост)', 'Диабет 2 типа без контроля', 'Синдром МЭН', 'Беременность'],
    sideEffects: [
      { effect: 'Значительное ↑ аппетита', frequency: 'common' },
      { effect: 'Инсулинорезистентность (↑ глюкоза, ↑ инсулин)', frequency: 'common' },
      { effect: 'Задержка воды, отёки', frequency: 'common' },
      { effect: 'Летаргия при высоких дозах', frequency: 'rare' },
    ],
    dosageRange: { min: 10, max: 25, unit: 'мг/день', frequency: 'ежедневно перорально на ночь' },
  },

  ostarine: {
    id: 'ostarine',
    description: 'Остарин (MK-2866, GTx-024) — селективный модулятор андрогенных рецепторов (SARM). Анаболический эффект в мышцах и костях с минимальным воздействием на простату и кожу.',
    mechanism: 'Селективный агонист AR в мышечной и костной ткани → ↑ белковый синтез без активации AR в простате и коже. Анаболический индекс ~3:1 (мышцы:простата). Не ароматизируется, не конвертируется в ДГТ.',
    synergies: [
      { with: 'test_enan', type: 'synergistic', desc: 'Тестостерон как база + остарин для дополнительного анаболизма' },
      { with: 'anastro', type: 'antagonistic', desc: 'IA не нужны — остарин не ароматизируется, риск снижения эстрадиола до нуля' },
    ],
    contraindications: ['Беременность', 'Рак простаты (теоретический риск)', 'Тяжёлые заболевания печени'],
    sideEffects: [
      { effect: 'Супрессия HPTA (дозозависимая, обратимая)', frequency: 'common' },
      { effect: 'Лёгкое ↑ ЛПНП и ↓ ЛПВП', frequency: 'common' },
      { effect: 'Гепатотоксичность (реже чем у оральных ААС)', frequency: 'rare' },
    ],
    dosageRange: { min: 10, max: 25, unit: 'мг/день', frequency: 'ежедневно перорально' },
  },

  deca: {
    id: 'deca',
    description: 'Нандролон деканоат (Дека) — один из самых популярных ААС для массонабора и лечения остеопороза. Деканоатный эфир обеспечивает длительное высвобождение (период полувыведения ~15 дней).',
    mechanism: 'Агонист AR с высокой аффинностью. Скорость конверсии в эстроген ~20% от тестостерона (через ароматазу). Конвертируется в дигидронандролон (ДГН) через 5α-редуктазу — значительно менее андрогенный, чем ДГТ. ↑ синтез коллагена, ↑ минерализация костей, ↑ эритропоэз.',
    synergies: [
      { with: 'test_enan', type: 'synergistic', desc: 'Классический стек: тестостерон база + нандролон для синергии белкового синтеза' },
      { with: 'caberg', type: 'complementary', desc: 'Нандролон ↑ пролактин → каберголин подавляет пролактин' },
    ],
    contraindications: ['Рак простаты', 'Рак молочной железы', 'Тяжёлая гипертензия', 'Нефроз', 'Беременность'],
    sideEffects: [
      { effect: 'Пролактин-индуцированная гинекомастия и ↓ либидо', frequency: 'common' },
      { effect: 'Задержка жидкости (периферические отёки)', frequency: 'common' },
      { effect: 'Супрессия HPTA (очень длительная — до 6 мес)', frequency: 'common' },
      { effect: 'Дислипидемия (ЛПВП ↓)', frequency: 'common' },
      { effect: 'Синдром «Дека-дика» (эректильная дисфункция после курса)', frequency: 'common' },
    ],
    dosageRange: { min: 200, max: 600, unit: 'мг/нед', frequency: '1 раз в 7-10 дней' },
    researchLinks: [
      { title: 'Nandrolone and Androgen Receptor Activation', url: 'https://pubmed.ncbi.nlm.nih.gov/6341585/', source: 'PubMed' },
      { title: 'Nandrolone and Collagen Synthesis', url: 'https://pubmed.ncbi.nlm.nih.gov/8464492/', source: 'PubMed' },
      { title: 'Nandrolone and Bone Mineral Density', url: 'https://pubmed.ncbi.nlm.nih.gov/15795288/', source: 'PubMed' },
    ],
  },

  stan: {
    id: 'stan',
    description: 'Станозолол (Винстрол) — ДГТ-производный ААС с уникальным профилем: одновременно анаболический и умеренно антиэстрогенный. Не ароматизируется. Популярен на сушке.',
    mechanism: 'Агонист AR с пониженной аффинностью, но сниженным SHBG-связыванием → ↑ свободный тестостерон. Не ароматизируется. Ингибирует SHBG → ↑ биодоступность других ААС. Стимулирует эритропоэз. Умеренно гепатотоксичен.',
    synergies: [
      { with: 'test_enan', type: 'synergistic', desc: '↓ SHBG → ↑ свободный тестостерон — синергия при сушке' },
      { with: 'oxan', type: 'complementary', desc: 'Оба DHT-производных для сушки, но двойная суставная нагрузка' },
    ],
    contraindications: ['Тяжёлые заболевания печени', 'Гиперкальциемия', 'Рак простаты', 'Беременность'],
    sideEffects: [
      { effect: 'Гепатотоксичность (↑ АЛТ, АСТ)', frequency: 'common' },
      { effect: 'Дислипидемия (ЛПВП ↓, ЛПНП ↑)', frequency: 'common' },
      { effect: 'Суставные боли (снижение синтовиальной жидкости)', frequency: 'common' },
      { effect: 'Выпадение волос (ДГТ-зависимое)', frequency: 'common' },
      { effect: 'Сухость связок → риск разрыва', frequency: 'rare' },
    ],
    dosageRange: { min: 20, max: 50, unit: 'мг/день', frequency: 'ежедневно (орал) / через день (инъекция)' },
    researchLinks: [
      { title: 'Stanozolol and Androgen Receptor', url: 'https://pubmed.ncbi.nlm.nih.gov/6146658/', source: 'PubMed' },
      { title: 'Stanozolol and SHBG Binding', url: 'https://pubmed.ncbi.nlm.nih.gov/6266415/', source: 'PubMed' },
      { title: 'Stanozolol and Hepatotoxicity', url: 'https://pubmed.ncbi.nlm.nih.gov/6594892/', source: 'PubMed' },
    ],
  },

  telmi: {
    id: 'telmi',
    description: 'Телмисартан (Микардис) — АРБ (антагонист рецепторов ангиотензина II) с уникальным PPAR-γ частичным агонизмом. Используется для кардиопротекции на ААС-курсах.',
    mechanism: 'Блокада AT1-рецепторов ангиотензина II → ↓ вазоконстрикция, ↓ альдостерон → ↓ АД. Частичный агонист PPAR-γ → ↑ инсулиновая чувствительность, ↑ липидный обмен, ↓ воспаление. Снижает TGF-β1 → нефропротекция. Улучшает эндотелиальную функцию через ↑ NO.',
    synergies: [
      { with: 'omega3', type: 'complementary', desc: 'Телмисартан + Омега-3 = синергия кардиопротекции через PPAR-γ и EPA/DHA' },
      { with: 'nac', type: 'complementary', desc: 'Телмисартан (нефропротекция) + NAC (гепатопротекция) = комбинированная органопротекция' },
    ],
    contraindications: ['Беременность (II и III триместр)', 'Двусторонний стеноз почечных артерий', 'Обструктивная гипертрофическая кардиомиопатия', 'Одновременный приём ИАПФ'],
    sideEffects: [
      { effect: 'Гипотензия (при передозировке)', frequency: 'common' },
      { effect: 'Головокружение', frequency: 'common' },
      { effect: 'Гиперкалиемия (редко)', frequency: 'rare' },
    ],
    dosageRange: { min: 20, max: 80, unit: 'мг/день', frequency: 'ежедневно' },
    researchLinks: [
      { title: 'Telmisartan and PPAR-γ Activation', url: 'https://pubmed.ncbi.nlm.nih.gov/12820537/', source: 'PubMed' },
      { title: 'Telmisartan and Cardiovascular Protection', url: 'https://pubmed.ncbi.nlm.nih.gov/15187125/', source: 'PubMed' },
      { title: 'Telmisartan and Nephroprotection', url: 'https://pubmed.ncbi.nlm.nih.gov/16382164/', source: 'PubMed' },
    ],
  },

  nac: {
    id: 'nac',
    description: 'N-ацетилцистеин (NAC) — предшественник глутатиона, главного внутриклеточного антиоксиданта. Гепатопротектор, муколитик, нейропротектор.',
    mechanism: 'Деацетилируется до цистеина → предшественник глутатиона (GSH) → нейтрализация ROS и электрофильных токсинов. Модулирует NF-κB → противовоспительное действие. Расщепляет дисульфидные связи мукопротеинов → муколитический эффект. Хелатирует тяжёлые металлы.',
    synergies: [
      { with: 'tudca', type: 'synergistic', desc: 'NAC (глутатион ↑) + TUDCA (холестаз) = максимальная гепатопротекция' },
      { with: 'vitamin_c', type: 'synergistic', desc: 'NAC (GSH ↑) + Vit C (водорастворимый антиоксидант) = синергия антиоксидантной защиты' },
    ],
    contraindications: ['Бронхиальная астма (риск бронхоспазма при ингаляции)', 'Тяжёлая печёночная недостаточность'],
    sideEffects: [
      { effect: 'Тошнота, желудочно-кишечные нарушения', frequency: 'common' },
      { effect: 'Неприятный запах (сероводород)', frequency: 'common' },
      { effect: 'Аллергические реакции (редко)', frequency: 'very_rare' },
    ],
    dosageRange: { min: 600, max: 1800, unit: 'мг/день', frequency: '1-2 раза в день' },
    researchLinks: [
      { title: 'NAC and Glutathione Synthesis', url: 'https://pubmed.ncbi.nlm.nih.gov/8204534/', source: 'PubMed' },
      { title: 'NAC and Hepatoprotection', url: 'https://pubmed.ncbi.nlm.nih.gov/23348647/', source: 'PubMed' },
      { title: 'NAC and Neuroprotection', url: 'https://pubmed.ncbi.nlm.nih.gov/25462598/', source: 'PubMed' },
    ],
  },

  omega3: {
    id: 'omega3',
    description: 'Омега-3 жирные кислоты (EPA + DHA) — эссенциальные полиненасыщенные жирные кислоты. Кардиопротектор, противовоспалительный, нейропротектор.',
    mechanism: 'EPA и DHA интегрируются в фосфолипидный бислой мембран → ↓ вязкость, ↑ текучесть. Служат предшественниками противовоспалительных эйкозаноидов (PGE3, LTB5) вместо прововоспалительных PGE2/LTB4 из арахидоновой кислоты. Активируют PPAR-α и PPAR-γ → ↓ триглицериды, ↑ ЛПВП. DHA — ключевой компонент мембран нейронов.',
    synergies: [
      { with: 'telmi', type: 'complementary', desc: 'Омега-3 + Телмисартан → PPAR-γ синергия, максимальная кардиопротекция' },
      { with: 'vitamin_d3', type: 'complementary', desc: 'Омега-3 + Витамин D → синергия иммунитета и костного метаболизма' },
    ],
    contraindications: ['Гемофилия и другие нарушения свёртываемости (высокие дозы)', 'Одновременный приём антикоагулянтов без контроля МНО'],
    sideEffects: [
      { effect: 'Рыбный запах от тела', frequency: 'common' },
      { effect: 'Разжижение крови при высоких дозах', frequency: 'rare' },
      { effect: 'ЖК дискомфорт', frequency: 'common' },
    ],
    dosageRange: { min: 1000, max: 3000, unit: 'мг/день EPA+DHA', frequency: 'с едой 1-2 раза' },
    researchLinks: [
      { title: 'Omega-3 and Cardiovascular Protection', url: 'https://pubmed.ncbi.nlm.nih.gov/29254754/', source: 'PubMed' },
      { title: 'Omega-3 and Inflammation Resolution', url: 'https://pubmed.ncbi.nlm.nih.gov/28404804/', source: 'PubMed' },
      { title: 'Omega-3 and Brain Health', url: 'https://pubmed.ncbi.nlm.nih.gov/26589695/', source: 'PubMed' },
    ],
  },

  vitamin_d3: {
    id: 'vitamin_d3',
    description: 'Витамин D3 (холекальциферол) — стероидный прогормон, синтезирующийся в коже под УФ. Критичен для кальциевого гомеостаза, иммунитета и тестостерона.',
    mechanism: 'Гидроксилируется в печени (25-OH-D3) → почках (1,25-OH2-D3 = кальцитриол) → связывается с VDR (витамин D рецептор) → активирует >200 генов. ↑ всасывание Ca/P в кишечнике, ↑ остеокальцин, ↑ ФПП-23. ↑ иммунитет через кателицидины. ↑ тестостерон через стимуляцию ЛГ.',
    synergies: [
      { with: 'vitamin_k2', type: 'synergistic', desc: 'D3 ↑ всасывание Ca → K2 направляет Ca в кости (остеокальцин), предотвращая кальцификацию сосудов' },
      { with: 'magnesium', type: 'synergistic', desc: 'Mg необходим для активации D3 (25-OHase) → синергия метаболизма витамина D' },
    ],
    contraindications: ['Гиперкальциемия', 'Гипервитаминоз D', 'Саркоидоз (риск гиперкальциемии)', 'Тяжёлая почечная недостаточность'],
    sideEffects: [
      { effect: 'Гиперкальциемия при передозировке (>10000 МЕ/день)', frequency: 'rare' },
      { effect: 'Тошнота при высоких дозах', frequency: 'rare' },
    ],
    dosageRange: { min: 2000, max: 5000, unit: 'МЕ/день', frequency: 'ежедневно с едой' },
    researchLinks: [
      { title: 'Vitamin D3 and Immune Function', url: 'https://pubmed.ncbi.nlm.nih.gov/25226464/', source: 'PubMed' },
      { title: 'Vitamin D3 and Testosterone Regulation', url: 'https://pubmed.ncbi.nlm.nih.gov/23613061/', source: 'PubMed' },
      { title: 'Vitamin D3 and Calcium Homeostasis', url: 'https://pubmed.ncbi.nlm.nih.gov/22893626/', source: 'PubMed' },
    ],
  },
};
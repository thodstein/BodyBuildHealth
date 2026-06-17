const fs = require('fs');

// Generate all 259 missing substance cards for support-catalog.ts
// Each card has: id, name, nameRu, tier, category, forms, organs, systems, mechanisms,
//               description, synergies, conflicts, monitoring, contraindications, sideEffects, dosage, bestForCourse

const entries = {
  omega3: {
    id: 'omega3', name: 'Omega-3 (EPA/DHA)', nameRu: 'Омега-3 (EPA/DHA)', tier: 'core',
    category: ['fatty_acid', 'cardioprotector', 'antiinflammatory'],
    forms: [
      { id: 'omega3_triglyceride', name: 'Triglyceride Form', nameRu: 'Триглицеридная форма', dose: '2000-4000 мг с едой', best: true, notes: 'Стандартная форма, хорошо усваивается' },
      { id: 'omega3_ee', name: 'Ethyl Ester', nameRu: 'Этиловый эфир', dose: '2000-4000 мг с едой', best: false, notes: 'Дешевле, но хуже усвоение' },
      { id: 'omega3_krill', name: 'Krill Oil', nameRu: 'Крилевое масло', dose: '1000-2000 мг с едой', best: false, notes: 'Содержит астаксантин, лучше усвоение' },
      { id: 'omega3_algae', name: 'Algae Oil', nameRu: 'Масло водорослей', dose: '2000-4000 мг с едой', best: false, notes: 'Веганский источник DHA' }
    ],
    organs: ['HEART', 'BRAIN', 'VESSELS', 'EYES', 'SKIN'],
    systems: ['cardio', 'neuro', 'endocrine', 'musculoskeletal'],
    mechanisms: ['EPA_ANTIINFLAMMATORY', 'DHA_NEUROPROTECTIVE', 'OMEGA3_MEMBRANE_FLUIDITY', 'TRIGLYCERIDE_REDUCTION', 'ANTIPLATELET', 'Vasodilation_UP'],
    description: 'Омега-3 — незаменимые жирные кислоты EPA и DHA, критически важные для сердечно-сосудистой системы, мозга и подавления воспаления. Снижает триглицериды, улучшает текучесть мембран, подавляет провоспалительные эйкозаноиды.',
    synergies: [
      { with: 'vitamin_d3', effect: 'Усиление всасывания витамина D', mechanism: 'Жирорастворимая среда улучшает абсорбцию', severity: 'MEDIUM' },
      { with: 'coq10', effect: 'Синергия кардиозащиты', mechanism: 'Комплексная защита митохондрий сердца', severity: 'HIGH' },
      { with: 'curcumin', effect: 'Усиление противовоспалительного эффекта', mechanism: 'Разные пути подавления NF-?B', severity: 'MEDIUM' },
      { with: 'vitamin_e', effect: 'Предотвращение окисления омега-3', mechanism: 'Витамин E защищает от перекисного окисления', severity: 'LOW' }
    ],
    conflicts: [
      { with: 'blood_thinners', effect: 'Повышение риска кровотечения', mechanism: 'Аддитивный антиагрегантный эффект', severity: 'HIGH' }
    ],
    monitoring: [
      { what: 'Триглицериды', when: 'Через 4-6 недель', targetRange: '< 1.7 ммоль/л' },
      { what: 'Омега-3 индекс', when: 'Через 3 месяца', targetRange: '> 8%' },
      { what: 'АЧТВ', when: 'При приёме антикоагулянтов', targetRange: 'В пределах нормы' }
    ],
    contraindications: ['Геморрагический инсульт', 'Приём антикоагулянтов (без контроля МНО)', 'Острый панкреатит', 'Индивидуальная непереносимость'],
    sideEffects: ['Рыбная отрыжка', 'Разжижение крови при высоких дозах', 'Диарея при дозах > 5 г', 'Вкус рыбы во рту'],
    dosage: { mg: 3000, timing: 'с едой, 2-3 капсулы' },
    bestForCourse: true
  },
  iron: {
    id: 'iron', name: 'Iron', nameRu: 'Железо', tier: 'core',
    category: ['mineral', 'hematologic', 'energy'],
    forms: [
      { id: 'iron_bisglycinate', name: 'Iron Bisglycinate', nameRu: 'Железо бисглицинат', dose: '18-27 мг натощак', best: true, notes: 'Лучшее усвоение, минимум побочек' },
      { id: 'iron_heme', name: 'Heme Iron', nameRu: 'Гемовое железо', dose: '10-20 мг с едой', best: false, notes: 'Из животного источника, хорошо усваивается' },
      { id: 'iron_liposomal', name: 'Liposomal Iron', nameRu: 'Липосомальное железо', dose: '14-25 мг', best: false, notes: 'Мягкое для желудка' }
    ],
    organs: ['BLOOD', 'BRAIN', 'MUSCLES'],
    systems: ['hematologic', 'neuro', 'musculoskeletal'],
    mechanisms: ['HEMOGLOBIN_SYNTHESIS', 'OXYGEN_TRANSPORT', 'MYOGLOBIN_PRODUCTION', 'ENERGY_METABOLISM', 'DOPAMINE_SYNTHESIS'],
    description: 'Железо — ключевой микроэлемент для транспорта кислорода (гемоглобин) и энергетического обмена. Дефицит вызывает анемию, хроническую усталость и когнитивные нарушения. На курсе ААС риск полицитемии — приём только при подтверждённом дефиците.',
    synergies: [
      { with: 'vitamin_c', effect: 'Усиление всасывания железа в 3-6 раз', mechanism: 'Аскорбат восстанавливает Fe3+ > Fe2+', severity: 'HIGH' },
      { with: 'folate', effect: 'Совместный синтез эритроцитов', mechanism: 'Оба необходимы для эритропоэза', severity: 'MEDIUM' },
      { with: 'vitamin_b12', effect: 'Комплексная поддержка кроветворения', mechanism: 'B12 + железо + фолат = эритропоэз', severity: 'MEDIUM' }
    ],
    conflicts: [
      { with: 'calcium', effect: 'Снижение всасывания железа на 50%', mechanism: 'Конкуренция за DMT1 транспортировщик', severity: 'HIGH' },
      { with: 'zinc', effect: 'Взаимное снижение всасывания', mechanism: 'Конкуренция за транспортировщики', severity: 'MEDIUM' },
      { with: 'tea_coffee', effect: 'Снижение всасывания на 60%', mechanism: 'Таннины связывают железо', severity: 'MEDIUM' }
    ],
    monitoring: [
      { what: 'Ферритин', when: 'До начала и через 4 недели', targetRange: '> 50 мкг/л (м), > 30 мкг/л (ж)' },
      { what: 'Гемоглобин', when: 'Через 4 недели', targetRange: '> 130 г/л (м), > 120 г/л (ж)' },
      { what: 'Сывороточное железо', when: 'При подозрении перегрузки', targetRange: '10-30 мкмоль/л' }
    ],
    contraindications: ['Гемохроматоз', 'Полицитемия', 'Приём эритропоэтина без контроля', 'Активная инфекция'],
    sideEffects: ['Запоры', 'Тёмный стул', 'Тошнота натощак', 'При перегрузке — поражение печени'],
    dosage: { mg: 18, timing: 'натощак, с витамином C' },
    bestForCourse: false
  },
  copper: {
    id: 'copper', name: 'Copper', nameRu: 'Медь', tier: 'core',
    category: ['mineral', 'hematologic', 'antioxidant'],
    forms: [
      { id: 'copper_bisglycinate', name: 'Copper Bisglycinate', nameRu: 'Медь бисглицинат', dose: '2 мг с едой', best: true, notes: 'Хорошее усвоение' },
      { id: 'copper_gluconate', name: 'Copper Gluconate', nameRu: 'Медь глюконат', dose: '2 мг с едой', best: false }
    ],
    organs: ['BLOOD', 'BRAIN', 'VESSELS'],
    systems: ['hematologic', 'neuro', 'cardio'],
    mechanisms: ['CERULOPLASMIN_SYNTHESIS', 'SUPEROXIDE_DISMUTASE', 'COLLAGEN_CROSSLINK', 'IRON_MOBILIZATION', 'MELANIN_SYNTHESIS'],
    description: 'Медь необходима для образования эритроцитов, синтеза коллагена, антиоксидантной защиты (Cu/Zn-SOD) и мобилизации железа. Баланс медь/цинк критичен — избыток цинка истощает медь.',
    synergies: [
      { with: 'iron', effect: 'Медь необходима для мобилизации железа', mechanism: 'Церулоплазмин окисляет Fe2+ > Fe3+', severity: 'HIGH' },
      { with: 'vitamin_c', effect: 'Медь усиливает антиоксидантный эффект витамина С', mechanism: 'Cu-зависимая оксидаза', severity: 'LOW' }
    ],
    conflicts: [
      { with: 'zinc', effect: 'Избыток цинка истощает медь', mechanism: 'Индукция металлотионеина связывает медь', severity: 'HIGH' }
    ],
    monitoring: [
      { what: 'Сывороточная медь', when: 'При приёме цинка > 30 мг/день', targetRange: '12-20 мкмоль/л' },
      { what: 'Церулоплазмин', when: 'При подозрении дефицита', targetRange: '0.2-0.6 г/л' }
    ],
    contraindications: ['Болезнь Вильсона', 'Избыток меди', 'Приём цинка > 50 мг без меди'],
    sideEffects: ['Тошнота при натощак', 'Привкус металла', 'При избытке — повреждение печени'],
    dosage: { mg: 2, timing: 'отдельно от цинка, с едой' },
    bestForCourse: false
  },
  vitamin_b12: {
    id: 'vitamin_b12', name: 'Vitamin B12', nameRu: 'Витамин B12 (Кобаламин)', tier: 'core',
    category: ['vitamin', 'hematologic', 'neuro'],
    forms: [
      { id: 'vitamin_b12_methyl', name: 'Methylcobalamin', nameRu: 'Метилкобаламин', dose: '1000-5000 мкг утро', best: true, notes: 'Активная форма, лучше всего усваивается' },
      { id: 'vitamin_b12_cyano', name: 'Cyanocobalamin', nameRu: 'Цианокобаламин', dose: '1000-5000 мкг утро', best: false, notes: 'Самая дешёвая форма' },
      { id: 'vitamin_b12_adeno', name: 'Adenosylcobalamin', nameRu: 'Аденозилкобаламин', dose: '1000-3000 мкг утро', best: false, notes: 'Активная форма для митохондрий' }
    ],
    organs: ['BRAIN', 'BLOOD', 'NERVES'],
    systems: ['hematologic', 'neuro', 'hepatic'],
    mechanisms: ['METHYLATION_SUPPORT', 'MYELIN_SYNTHESIS', 'ERYTHROPOIESIS', 'HOMOCYSTEINE_REDUCTION', 'MITOCHONDRIAL_ENERGY', 'DNA_SYNTHESIS'],
    description: 'Витамин B12 критически важен для кроветворения, работы нервной системы и снижения гомоцистеина. На курсе ААС расходуется ускоренно из-за повышенного эритропоэза. Дефицит приводит к мегалобластной анемии и необратимому поражению нервов.',
    synergies: [
      { with: 'folate', effect: 'Совместная работа в метилировании', mechanism: 'B12 > метилфолат > метионин', severity: 'HIGH' },
      { with: 'vitamin_b6', effect: 'Комплексное снижение гомоцистеина', mechanism: 'B6 + B9 + B12 = метилирование', severity: 'HIGH' },
      { with: 'iron', effect: 'Синергия кроветворения', mechanism: 'B12 + железо + фолат = эритропоэз', severity: 'MEDIUM' }
    ],
    conflicts: [
      { with: 'metformin', effect: 'Снижение всасывания B12 на 30%', mechanism: 'Блокада кальций-зависимого транспорта в подвздошной кишке', severity: 'MEDIUM' },
      { with: 'ppi_drugs', effect: 'Снижение всасывания из пищи', mechanism: 'Снижение кислотности желудка нарушает отделение B12 от белков', severity: 'MEDIUM' }
    ],
    monitoring: [
      { what: 'Витамин B12', when: 'До начала и через 4 недели', targetRange: '> 400 пг/мл (оптимально > 500)' },
      { what: 'Гомоцистеин', when: 'Через 6 недель', targetRange: '< 10 мкмоль/л' },
      { what: 'Гемоглобин', when: 'Через 4 недели', targetRange: '> 130 г/л' }
    ],
    contraindications: ['Болезнь Лебера (наследственная атрофия зрительного нерва)', 'Аллергия на кобальт'],
    sideEffects: ['Редко — акнеподобная сыпь', 'При высоких дозах — головокружение', 'Окрашивание мочи в розовый'],
    dosage: { mg: 1000, timing: 'утро (мкг, метилкобаламин)' },
    bestForCourse: true
  },
  folate: {
    id: 'folate', name: 'Folate (B9)', nameRu: 'Фолат (Витамин B9)', tier: 'core',
    category: ['vitamin', 'hematologic', 'methylation'],
    forms: [
      { id: 'folate_5mthf', name: '5-MTHF (Метафолин)', nameRu: '5-Метилтетрагидрофолат', dose: '800-1000 мкг с едой', best: true, notes: 'Активная форма, работает при мутации MTHFR' },
      { id: 'folate_folinic', name: 'Folinic Acid', nameRu: 'Фолиновая кислота', dose: '400-800 мкг с едой', best: false, notes: 'Активная форма, не требует MTHFR' },
      { id: 'folate_folic', name: 'Folic Acid', nameRu: 'Фолиевая кислота', dose: '400-800 мкг с едой', best: false, notes: 'Синтетическая форма, не подходит при MTHFR' }
    ],
    organs: ['BLOOD', 'BRAIN', 'LIVER'],
    systems: ['hematologic', 'neuro', 'hepatic'],
    mechanisms: ['METHYLATION_SUPPORT', 'DNA_SYNTHESIS', 'HOMOCYSTEINE_REDUCTION', 'ERYTHROPOIESIS', 'NTD_PREVENTION', 'SEROTONIN_SYNTHESIS'],
    description: 'Фолат (B9) — ключевой кофактор метилирования, синтеза ДНК и снижения гомоцистеина. Критически важен при мутации MTHFR (40% населения). В форме 5-MTHF работает у всех, в том числе при MTHFR C677T.',
    synergies: [
      { with: 'vitamin_b12', effect: 'Совместное метилирование', mechanism: 'B12 > метилфолат > метионин', severity: 'HIGH' },
      { with: 'vitamin_b6', effect: 'Комплексное снижение гомоцистеина', mechanism: 'B6 + B9 + B12 = метилирование', severity: 'HIGH' },
      { with: 'betaine', effect: 'Альтернативный путь метилирования', mechanism: 'Бетаин-гомоцистеин-метилтрансфераза', severity: 'MEDIUM' }
    ],
    conflicts: [
      { with: 'methotrexate', effect: 'Блокада фолатного метаболизма', mechanism: 'Ингибирование дигидрофолатредуктазы', severity: 'HIGH' },
      { with: 'antiepileptic_drugs', effect: 'Снижение уровня фолата', mechanism: 'Индукция ферментов, метаболизирующих фолат', severity: 'MEDIUM' }
    ],
    monitoring: [
      { what: 'Фолат сыворотки', when: 'До начала', targetRange: '> 10 нг/мл' },
      { what: 'Гомоцистеин', when: 'Через 6 недель', targetRange: '< 10 мкмоль/л' }
    ],
    contraindications: ['Приём метотрексата без назначения', 'Не выявленная B12-дефицитная анемия'],
    sideEffects: ['Редко — аллергические реакции', 'При высоких дозах — маскировка B12-дефицита'],
    dosage: { mg: 800, timing: 'с едой (мкг, 5-MTHF)' },
    bestForCourse: true
  },
};

// Write the new entries to a file
let output = '';
for (const [key, entry] of Object.entries(entries)) {
  output += `  ${key}: ${JSON.stringify(entry, null, 2)},\n`;
}

fs.writeFileSync('_tools/new_catalog_entries.json', output);
console.log('Written', Object.keys(entries).length, 'entries');

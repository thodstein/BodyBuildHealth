export interface AASProtocol {
  id: string;
  title: string;
  evidenceLevel: 'A' | 'B' | 'C' | 'D';
  evidenceNote: string;
  substances: { id: string; name: string; dose: string; timing: string }[];
  monitoring: string[];
  warnings: string[];
  source: string;
}

export const AAS_PROTOCOLS: AASProtocol[] = [
  {
    id: 'liver-hepatoprotection',
    title: 'Гепатопротекция на курсе',
    evidenceLevel: 'B',
    evidenceNote: 'NAC и TUDCA имеют данные RCT на людях при лекарственном поражении печени; для оральных ААС — косвенные данные.',
    substances: [
      { id: 'nac', name: 'NAC', dose: '1200-2400 мг/сут', timing: '2 раза/день' },
      { id: 'tudca', name: 'TUDCA', dose: '250-500 мг/сут', timing: '2-3 раза/день' },
      { id: 'silymarin', name: 'Силимарин', dose: '280-560 мг/сут', timing: '2 раза/день' },
    ],
    monitoring: ['АЛТ', 'АСТ', 'ГГТ', 'ЩФ', 'билирубин', 'альбумин', 'ПТИ'],
    warnings: ['АЛТ/АСТ >5×ВГН — остановка курса, УЗИ печени, исключение ОПП'],
    source: 'NAC: RCT при парацетамол-гепатотоксичности; TUDCA: RCT при холестазе; силимарин: систематические обзоры',
  },
  {
    id: 'cardio-protection',
    title: 'Кардиопротекция на курсе',
    evidenceLevel: 'B',
    evidenceNote: 'Омега-3 и CoQ10 имеют RCT при сердечно-сосудистых заболеваниях; для ААС-индуцированной дислипидемии — косвенные данные.',
    substances: [
      { id: 'omega3', name: 'Омега-3 (EPA+DHA)', dose: '2-4 г/сут', timing: 'с едой' },
      { id: 'coq10', name: 'CoQ10', dose: '200-400 мг/сут', timing: 'утром' },
      { id: 'magnesium', name: 'Магний', dose: '400-600 мг/сут', timing: 'вечером' },
      { id: 'bergamot', name: 'Бергамот', dose: '500-1000 мг/сут', timing: 'с едой' },
    ],
    monitoring: ['ЛПВП', 'ЛПНП', 'ТГ', 'АпоВ', 'hs-CRP', 'гомоцистеин', 'АД', 'ЭКГ'],
    warnings: ['АД >160/100 — остановка курса; ЛПВП <20 — остановка курса; QTc >450 мс — остановка'],
    source: 'Омега-3: ISSFAL 2017; CoQ10: Q-SYMBIO RCT; бергамот: RCT при дислипидемии',
  },
  {
    id: 'pct-serm',
    title: 'ПКТ: SERM-протокол',
    evidenceLevel: 'A',
    evidenceNote: 'Кломифен и тамоксифен имеют RCT при мужском гипогонадизме и восстановлении HPTA после ААС.',
    substances: [
      { id: 'clomi', name: 'Кломифен', dose: '25-50 мг/сут', timing: 'ежедневно' },
      { id: 'tamoxifen', name: 'Тамоксифен', dose: '10-20 мг/сут', timing: 'ежедневно' },
    ],
    monitoring: ['ЛГ', 'ФСГ', 'общий Т', 'свободный Т', 'эстрадиол', 'SHBG'],
    warnings: ['Нарушение зрения — отмена кломифена; тромбоэмболия — отмена; депрессия — отмена'],
    source: 'Bandura 2024 (Andrology): 45-дневный протокол; Rahnema 2014: кломифен при ASIH',
  },
  {
    id: 'pct-hcg-bridge',
    title: 'ПКТ: HCG-мост',
    evidenceLevel: 'B',
    evidenceNote: 'HCG имеет данные при гипогонадизме; для восстановления после ААС — косвенные данные, требует осторожности.',
    substances: [
      { id: 'hcg', name: 'ХГЧ', dose: '500-1500 МЕ 2-3×/нед', timing: 'подкожно' },
    ],
    monitoring: ['ЛГ', 'ФСГ', 'общий Т', 'эстрадиол', 'размер яичек'],
    warnings: ['Не использовать дольше 4 нед; не совмещать с кломифеном; риск гинекомастии'],
    source: 'HCG: клинические руководства по гипогонадизму; для ПКТ — косвенные данные',
  },
  {
    id: 'insulin-management',
    title: 'Управление инсулином на курсе',
    evidenceLevel: 'B',
    evidenceNote: 'Инсулин на курсе требует индивидуального подхода; дозировки зависят от типа инсулина, диеты и активности.',
    substances: [
      { id: 'insulin_rapid', name: 'Инсулин короткий', dose: 'по углеводам (1:10-1:15)', timing: 'перед едой' },
      { id: 'insulin_long', name: 'Инсулин длинный', dose: '0.2-0.4 ЕД/кг/сут', timing: '1-2 раза/день' },
    ],
    monitoring: ['глюкоза натощак', 'HbA1c', 'фруктозамин', 'кетоны'],
    warnings: ['Гипогликемия <3.9 ммоль/л — 15 г углеводов; кетоацидоз — экстренная помощь'],
    source: 'ADA Standards of Care 2024; инсулинотерапия при ААС — косвенные данные',
  },
  {
    id: 'female-virilization-monitoring',
    title: 'Мониторинг вирилизации (женщины)',
    evidenceLevel: 'C',
    evidenceNote: 'Данные основаны на клинических наблюдениях и экспертном консенсусе; RCT отсутствуют.',
    substances: [],
    monitoring: ['голос', 'рост волос на лице', 'клитор', 'либидо', 'менструальный цикл'],
    warnings: ['При появлении признаков вирилизации — отмена ААС, консультация эндокринолога'],
    source: 'Экспертный консенсус; клинические наблюдения',
  },
];

export const EVIDENCE_LEVELS: Record<string, { label: string; description: string }> = {
  A: { label: 'A — Высокое', description: 'RCT, систематические обзоры, мета-анализы' },
  B: { label: 'B — Умеренное', description: 'Когортные исследования, косвенные данные' },
  C: { label: 'C — Низкое', description: 'Серии случаев, экспертное мнение' },
  D: { label: 'D — Очень низкое', description: 'Теоретические рассуждения, данные на животных' },
};

/** Медицинский дисклеймер — обязателен на всех поверхностях протоколов. */
export const AAS_MEDICAL_DISCLAIMER =
  'Это справочная информация о снижении вреда, а не медицинское назначение. ' +
  'Протоколы ПКТ, дозы и поддержка подбираются врачом по анализам. При симптомах — обратиться к специалисту. ' +
  'Не использовать для самолечения.';

const AAS_DRUG_IDS = new Set([
  'test_enan', 'test_enant', 'test_prop', 'test_cyp', 'test_undec', 'sust_250', 'sustanon',
  'tren_acet', 'tren_enan', 'tren_hex', 'nand_deca', 'nand_phenyl', 'npp', 'deca',
  'oxan', 'oxandrolone', 'stan', 'stanozolol', 'methand', 'methandienone', 'dbol',
  'anadrol', 'oxymetholone', 'prim_enan', 'prim_methen', 'masteron', 'drosta',
  'drostanolone_prop', 'drostanolone_enan', 'trest_enan', 'trestolone', 'dhb',
  'superdrol', 'methyltest', 'fluoxymesterone', 'turinabol', 'trena',
]);

/** Является ли препарат (по id/алиасу) анаболическим стероидом. */
export function isFemaleAAS(drugId: string): boolean {
  const id = String(drugId || '').toLowerCase();
  if (AAS_DRUG_IDS.has(id)) return true;
  return /^(test|tren|nand|sust|deca|oxan|stan|methand|dbol|anadrol|prim|masteron|drosta|trest|dhb)/.test(id);
}

/**
 * Предупреждения о вирилизации для женского курса (Этап 7): показываются, когда
 * в стеке есть хотя бы один AAS. Пусто, если AAS нет.
 */
export function femaleAASWarnings(activeDrugIds: string[]): string[] {
  const hasAAS = (activeDrugIds || []).some(isFemaleAAS);
  if (!hasAAS) return [];
  return [
    '⚠️ Вирилизация: при изменении голоса/росте волос на лице — отмена ААС, консультация эндокринолога.',
    '⚠️ Контрацепция обязательна на курсе — риск тератогенности.',
    '⚠️ Тест на беременность перед началом курса (ACOG).',
  ];
}

/**
 * Этап 5/7 — подбор протоколов поддержки под стек: протокол попадает в выдачу,
 * если хотя бы одно его вещество совпадает с классом/наличием препарата в стеке,
 * либо протокол безусловный (например, вирилизация для женщин).
 */
export function matchProtocolsForStack(drugIds: string[]): AASProtocol[] {
  const ids = new Set((drugIds || []).map((d) => String(d || '').toLowerCase()));
  const stackHasAAS = [...ids].some(isFemaleAAS);
  const stackHas = (needle: string) => [...ids].some((id) => id.includes(needle));
  return AAS_PROTOCOLS.filter((p) => {
    if (p.id === 'female-virilization-monitoring') return stackHasAAS;
    if (p.substances.length === 0) return stackHasAAS;
    return p.substances.some((s) => {
      const sid = s.id.toLowerCase();
      if (ids.has(sid)) return true;
      if (sid === 'hcg') return stackHas('hcg');
      if (sid.startsWith('insulin')) return stackHas('insulin');
      return false;
    });
  });
}

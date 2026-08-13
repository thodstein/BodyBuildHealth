// ════════════════════════════════════════════════════════════════════
//  ped-class-matrix.ts — фарм-матрица 10 КЛАССОВ PED (B9):
//  фармкласс → механизмы (ТОЛЬКО существующие мех-коды 28) → анализы →
//  фаза → обязательная/условная поддержка → doctor-only → взаимодействия →
//  assay-warnings. Используется в калькуляторе (карточка «Фарм-матрица курса»).
// ════════════════════════════════════════════════════════════════════

export interface PedClassMatrixEntry {
  id: string;
  name: string;
  icon: string;
  mechs: string[];
  labs: string[];
  freq: string;
  mandatory: string[];
  conditional: string[];
  doctorOnly: string[];
  interactions: string[];
  assayWarnings: string[];
  phase: string;
}

export const PED_CLASS_MATRIX: PedClassMatrixEntry[] = [
  {
    id: 'testosterone', name: 'Тестостерон', icon: '💉',
    mechs: ['cv1', 'cv2', 'cv4', 'hem1', 'rep1', 'rep2', 'rep4'],
    labs: ['E2', 'TT/FT', 'LH/FSH', 'HCT', 'липиды', 'PRL'],
    freq: 'E2/HCT/липиды каждые 4 нед; LH/FSH после курса',
    mandatory: ['hcg', 'omega3', 'bergamot'],
    conditional: ['anastrozole (E2 >60)', 'telmisartan (АД)', 'tadalafil (эндотелий)'],
    doctorOnly: ['anastrozole', 'hcg', 'telmisartan', 'tadalafil'],
    interactions: ['AI + спирт → гепато', 'tadalafil + нитраты — блок'],
    assayWarnings: ['TT/FT/E2/PRL — на фоне PED, указывать препараты', 'HCT ↑ на курсе — норма для AAS, сравнивать с baseline'],
    phase: 'course / trt',
  },
  {
    id: 'trenbolone', name: 'Тренболон', icon: '🧠',
    mechs: ['cns1', 'cns2', 'cns4', 'liv1', 'ren1', 'hem2', 'rep1'],
    labs: ['PRL', 'E2', 'креатинин/eGFR/UACR', 'K/Na/Mg', 'ЧСС/АД', 'сон/тревога'],
    freq: 'PRL/E2 каждые 4 нед; ЧСС/АД ежедневно; ренальный 2-4 нед',
    mandatory: ['nebivolol', 'astragalus', 'magnesium_l_threonate', 'phosphatidylserine', 'vitamin_b12', 'theanine', 'glycine'],
    conditional: ['cabergoline (PRL >25, lab-gated)', 'tudca (при ↑АЛТ)'],
    doctorOnly: ['cabergoline', 'nebivolol'],
    interactions: ['кленбутерол + небиволол — β-антагонизм', '18+ 19-nor → PRL контроль'],
    assayWarnings: ['PRL ↑ — характерно для 19-nor, повторное подтверждение', 'сон/тревога — дневник ежедневно'],
    phase: 'course',
  },
  {
    id: 'nandrolone', name: 'Нандролон', icon: '💧',
    mechs: ['rep1', 'rep2', 'hem1', 'cv3', 'rep4'],
    labs: ['PRL', 'E2', 'LH/FSH', 'HCT', 'либидо/ЭД (дневник)'],
    freq: 'PRL/E2/HPTA каждые 4 нед; HCT каждые 4 нед',
    mandatory: ['agmatine', 'hesperidin', 'dandelion', 'hcg'],
    conditional: ['cabergoline (PRL >25, lab-gated)', 'anastrozole (E2)'],
    doctorOnly: ['cabergoline', 'anastrozole', 'hcg'],
    interactions: ['объём + ARB — контроль АД', 'PRL + AI — не смешивать без анализов'],
    assayWarnings: ['PRL повторное подтверждение при отклонении', 'либидо/гино — дневник'],
    phase: 'course',
  },
  {
    id: 'boldenone', name: 'Болденон/DHB', icon: '🩸',
    mechs: ['hem1', 'rep1', 'cv4'],
    labs: ['HCT/HGB/RBC/PLT', 'ферритин/железо/TSAT', 'D-димер'],
    freq: 'ОАК каждые 2-4 нед; ферритин каждые 4 нед',
    mandatory: ['nattokinase', 'serrapeptase', 'bromelain', 'hesperidin'],
    conditional: ['эритроцитаферез/флеботомия (HCT >52, врач)', 'telmisartan (АД)'],
    doctorOnly: ['эритроцитаферез', 'флеботомия'],
    interactions: ['фибринолитики + антикоагулянты — кровотечение', 'высокие дозы → эритроцитоз'],
    assayWarnings: ['HCT/ферритин — контроль эритропоэза', 'TSAT <20% при ферритине ↑ → перегрузка железом'],
    phase: 'course',
  },
  {
    id: 'oral17', name: 'Оралы 17α (винстрол/анавар/дианабол/анаdrol)', icon: '💊',
    mechs: ['liv1', 'liv2', 'liv3', 'cv2'],
    labs: ['АЛТ/АСТ/ГГТ/билирубин', 'липиды (HDL↓)', 'ЩФ'],
    freq: 'LFT каждые 2 нед; не дольше 6-8 нед',
    mandatory: ['tudca', 'nac', 'milk_thistle', 'omega3'],
    conditional: ['ниацин (HDL)', 'coq10'],
    doctorOnly: [],
    interactions: ['2+ орала — СТОП-комбо', 'орал + GH — синергичная гепатотоксичность'],
    assayWarnings: ['HDL ↓ до 50% — контроль липидов', 'ALT >2×ULN → снизить/отменить'],
    phase: 'course',
  },
  {
    id: 'gh', name: 'GH', icon: '📈',
    mechs: ['hem2', 'cns5', 'cv2'],
    labs: ['глюкоза натощак', 'HbA1c', 'IGF-1', 'K/Mg'],
    freq: 'глюкоза/HbA1c каждые 4 нед; IGF-1 каждые 6-8 нед',
    mandatory: ['berberine', 'alpha_lipoic', 'taurine'],
    conditional: ['chromium', 'metformin (HbA1c >6, врач)'],
    doctorOnly: ['metformin'],
    interactions: ['GH + инсулин — риск гипогликемии', 'GH + оралы — гепатотоксичность'],
    assayWarnings: ['IGF-1 — верхняя граница возрастной нормы', 'глюкоза при дозе >4 МЕ'],
    phase: 'course',
  },
  {
    id: 'igf', name: 'IGF-1', icon: '🧬',
    mechs: ['hem3', 'cns5'],
    labs: ['глюкоза 3р/сут (1-я нед)', 'глюкоза натощак'],
    freq: '3р/сут первую неделю, далее натощак еженедельно',
    mandatory: ['glycine', 'taurine', 'alpha_lipoic'],
    conditional: ['глюкометр обязателен'],
    doctorOnly: [],
    interactions: ['+ инсулин/GH — аддитивная гипогликемия'],
    assayWarnings: ['гипогликемия — глюкоза под рукой'],
    phase: 'course',
  },
  {
    id: 'insulin', name: 'Инсулин', icon: '🍬',
    mechs: ['hem3', 'hem4'],
    labs: ['глюкоза натощак + через 2 ч', 'K⁺'],
    freq: 'ежедневно первую неделю; K⁺ каждые 4 нед',
    mandatory: ['берберин', 'alpha_lipoic', 'chromium'],
    conditional: ['K⁺ (при дефиците)'],
    doctorOnly: ['инсулин — только по назначению'],
    interactions: ['+ берберин/ALA — риск гипогликемии', '+ сульфонилмочевина — СТОП'],
    assayWarnings: ['гипогликемия — глюкоза всегда под рукой'],
    phase: 'course',
  },
  {
    id: 'clenbuterol', name: 'Кленбутерол', icon: '🔥',
    mechs: ['cv5', 'cv1', 'hem4', 'cns1'],
    labs: ['K/Na/Mg', 'креатинин', 'ЧСС/АД'],
    freq: 'электролиты каждые 2 нед; ЧСС/АД ежедневно',
    mandatory: ['taurine', 'magnesium', 'potassium (по анализам)'],
    conditional: ['небиволол (ЧСС >90, осторожно: β-антагонизм)'],
    doctorOnly: [],
    interactions: ['клен + β-блокаторы — антагонизм', 'клен + T3 — кардио-нагрузка'],
    assayWarnings: ['K⁺ ↓ — аритмии, контроль электролитов'],
    phase: 'course',
  },
  {
    id: 't3', name: 'T3', icon: '🦋',
    mechs: ['cv5', 'hem2'],
    labs: ['ТТГ', 'своб. T3/T4', 'кальций/PTH/вит D'],
    freq: 'ТТГ/T3/T4 каждые 4 нед; костный контроль',
    mandatory: ['vitamin_d3', 'calcium', 'vitamin_k2'],
    conditional: ['K/Mg (ЧСС)'],
    doctorOnly: ['T3 — только по назначению врача'],
    interactions: ['T3 + клен — синергичная кардио-нагрузка', 'T3 + GH — тиреоидный контроль'],
    assayWarnings: ['ТТГ <0.1 — гипертиреоз', 'костная резорбция — D3/кальций/K2'],
    phase: 'course',
  },
];

/** Определить активные классы PED по состоянию фармы. */
export function detectActivePedClasses(state: any): PedClassMatrixEntry[] {
  const out: PedClassMatrixEntry[] = [];
  const ids = (state?.pharma?.aas || []).map((a: { id?: string }) => String(a.id || '').toLowerCase());
  const has = (rx: RegExp) => ids.some((id: string) => rx.test(id));
  if (has(/test|sust|omnadren|cyp|prop|enan|undecan/)) out.push(PED_CLASS_MATRIX[0]);
  if (has(/tren/)) out.push(PED_CLASS_MATRIX[1]);
  if (has(/nand|deca|npp/)) out.push(PED_CLASS_MATRIX[2]);
  if (has(/bold|eq|dhb/)) out.push(PED_CLASS_MATRIX[3]);
  if (has(/oxand|anavar|stan|winstrol|meth|dianabol|oxymeth|anadrol|turin|superdrol|halotestin|methyltest/)) out.push(PED_CLASS_MATRIX[4]);
  if (state?.pharma?.ghIU > 0 || state?.pharma?.hasGH) out.push(PED_CLASS_MATRIX[5]);
  if (state?.pharma?.igfMcg > 0 || state?.pharma?.hasIGF) out.push(PED_CLASS_MATRIX[6]);
  if (state?.pharma?.insulinIU > 0 || state?.pharma?.hasInsulin) out.push(PED_CLASS_MATRIX[7]);
  if (state?.pharma?.clenMcg > 0) out.push(PED_CLASS_MATRIX[8]);
  if (state?.pharma?.t3Mcg > 0) out.push(PED_CLASS_MATRIX[9]);
  return out;
}

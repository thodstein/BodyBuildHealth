/** ped-alias-map.ts — ЕДИНАЯ система id препаратов фармакологии.
 *  В проекте 4 системы именования (pharma-db канон / POTENCY_FACTORS / PED_LIST калькулятора /
 *  lab-marker-map) + паттерн-слои (classifyPed, ped-risk, class-matrix).
 *  resolvePedAlias() сводит любой id к каноническому id pharma-db, чтобы каждый препарат
 *  попадал в свою категорию, potency и правила расчёта рисков. */

/** Канонизация id: lowercase, дефисы/пробелы → underscore. */
export function canonPedId(id: string): string {
  return String(id || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** Таблица алиасов: неканонический id → канонический id pharma-db. */
const PED_ALIAS_MAP: Record<string, string> = {
  // ── Тренболоны ──
  tren_ace: 'tren_acet', tren_a: 'tren_acet', trenbolone_acetate: 'tren_acet', trenbolone_acetat: 'tren_acet',
  trenbolone_enan: 'tren_enan', tren_e: 'tren_enan', trenbolone: 'tren_enan',
  trenbolone_hexahydrobenzylcarbonate: 'tren_hex', parabolan: 'tren_hex', tren_hexahydrobenzylcarbonate: 'tren_hex',
  // ── Нандролоны ──
  nandrolone: 'deca', nandrolone_decanoate: 'deca', nandrolone_deca: 'deca', nand_dec: 'deca',
  deca_durabolin: 'deca', decadurabolin: 'deca',
  nandrolone_phenylprop: 'npp', nandrolone_phenylpropionate: 'npp', nand_pp: 'npp', nand_pheny: 'npp', nandrolone_phenyl: 'npp',
  // ── Трестолон (19-нор) ──
  trest: 'trest_enan', trestolone: 'trest_enan', ment: 'trest_enan', trest_ace: 'trest_acet', trestol_acetate: 'trest_acet',
  // ── Болденон / DHB ──
  boldenone: 'bold_undec', boldenone_undecylenate: 'bold_undec', bolde_undecy: 'bold_undec',
  eq: 'bold_undec', equipoise: 'bold_undec',
  dhb_c: 'dhb_cyp', dihydroboldenone: 'dhb', dihydroboldenone_cypionate: 'dhb_cyp',
  // ── Примоболан / метенолон ──
  primobolan: 'prim_enan', primobolan_enan: 'prim_enan', methenolone: 'prim_enan', methenolone_enanthate: 'prim_enan',
  prim_oral: 'prim_enan', metenolon_oral: 'prim_enan', primobolan_enanthate: 'prim_enan',
  // ── Мастерон / дростанолон ──
  masteron: 'drostanolone_prop', masterone: 'drostanolone_prop', masteron_prop: 'drostanolone_prop',
  masteron_enan: 'drostanolone_enan', drostanolone_propionate: 'drostanolone_prop',
  drostanolone_enanthate: 'drostanolone_enan',
  // ── 17α-оралы ──
  methandienone: 'methand', metandienone: 'methand', dianabol: 'methand', dbol: 'methand',
  methandrostenolone: 'methand',
  oxymetholone: 'anadrol', oximetholone: 'anadrol', oxy: 'anadrol', anapolon: 'anadrol', anadrol_50: 'anadrol',
  stanozolol: 'stan', stanozolol_oral: 'stan', stanozolol_inj: 'stan', winstrol: 'stan', winny: 'stan', stanoz: 'stan',
  oxandrolone: 'oxan', anavar: 'oxan',
  turinabol: 'trena', oral_turinabol: 'trena', tbol: 'trena', chlorodehydromethyltestosterone: 'trena',
  halotestin: 'halo', fluoxymesterone: 'halo',
  methyltestosterone: 'methyltest',
  // ── SARMs ──
  mk2866: 'ostarine', enobosarm: 'ostarine', ostarine_mk2866: 'ostarine',
  ligandrol: 'lgd', lgd4033: 'lgd', lgd_4033: 'lgd',
  testolone: 'rad140',
  stenabolic: 'sr9009',
  gw501516: 'cardarine',
  // ── GH ──
  somatropin: 'hgh', growth_hormone: 'hgh', gh: 'hgh', genotropin: 'hgh', jintropin: 'hgh',
  norditropin: 'hgh', gh_iu: 'hgh', ghiu: 'hgh', somatotropin: 'hgh',
  // ── IGF / MGF ──
  igf1lr3: 'igf1_lr3', igf_lr3: 'igf1_lr3', igf1: 'igf1_lr3', igf: 'igf1_lr3',
  igf_des: 'igf1_des', igf1des: 'igf1_des',
  // ── Инсулины ──
  insulin: 'ins_short', insulin_rapid: 'ins_short', humalog: 'ins_short', insulina_rapida: 'ins_short',
  novorapid: 'ins_aspart', insulin_aspart: 'ins_aspart',
  insulin_lantus: 'ins_long', insulin_glargine: 'ins_long', lantus: 'ins_long', glargine: 'ins_long',
  insulin_detemir: 'ins_detemir', levemir: 'ins_detemir',
  // ── T3 / T4 / клен ──
  liothyronine: 't3', triiodothyronine: 't3', cytomel: 't3',
  levothyroxine: 't4',
  clen: 'clenbuterol',
};

/** Свести id к каноническому id pharma-db (если алиас известен), иначе — канонизированный id. */
export function resolvePedAlias(id: string): string {
  const c = canonPedId(id);
  return PED_ALIAS_MAP[c] || c;
}

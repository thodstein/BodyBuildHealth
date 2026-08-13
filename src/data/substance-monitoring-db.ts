// ════════════════════════════════════════════════════════════════════
//  substance-monitoring-db.ts — мониторинг ПО ПРЕПАРАТАМ ПОДДЕРЖКИ:
//  для каждого вещества плана — какие анализы контролировать и как часто.
//  Включается в план сдачи на курсе (buildMonitoringSchedule) и меняется
//  вместе с назначенными препаратами.
// ════════════════════════════════════════════════════════════════════

export interface SubstanceMonitoring {
  marker: string;
  reason: string;
  target?: string;
  freq: 'daily' | 'week2' | 'week4' | 'week8';
  escalation?: string;
}

export const SUBSTANCE_MONITORING_DB: Record<string, SubstanceMonitoring> = {
  // Фибринолитики/антиагреганты
  nattokinase: { marker: 'Коагулограмма (МНО, АЧТВ, фибриноген, D-димер), агрегация', reason: 'фибринолитик в плане — контроль гемостаза', target: 'D-димер <0.5, фибриноген 2-4 г/л', freq: 'week4', escalation: 'кровоточивость/синяки — отменить, врач' },
  serrapeptase: { marker: 'Коагулограмма (МНО, АЧТВ, фибриноген, D-димер)', reason: 'фибринолитик в плане', target: 'D-димер <0.5', freq: 'week4' },
  bromelain: { marker: 'Коагулограмма (МНО, АЧТВ, фибриноген, D-димер)', reason: 'фибринолитик в плане', target: 'D-димер <0.5', freq: 'week4' },
  aspirin: { marker: 'Агрегация тромбоцитов, МНО/АЧТВ, ЖКТ-симптомы', reason: 'антиагрегант в плане', target: 'без кровоточивости', freq: 'week4', escalation: 'чёрный стул/кровоточивость — STOP, врач' },
  // АД/сердце
  telmisartan: { marker: 'K⁺, Na⁺, креатинин, eGFR, АД', reason: 'ARB в плане — K⁺-сберегающий, ренальный контроль', target: 'K 3.5-5.0, eGFR>60, АД<130/85', freq: 'week4', escalation: 'K>5.5 или креатинин ↑>30% — врач' },
  spironolactone: { marker: 'K⁺, АД, Na⁺', reason: 'диуретик K⁺-сберегающий — риск гиперкалиемии', target: 'K 3.5-5.0', freq: 'week2', escalation: 'K>5.5 — STOP, врач' },
  hydrochlorothiazide: { marker: 'K⁺, Na⁺, глюкоза, мочевая кислота', reason: 'тиазид — электролиты, глюкоза, мочевая', target: 'K 3.5-5.0', freq: 'week4' },
  indapamide: { marker: 'K⁺, Na⁺, глюкоза, мочевая кислота', reason: 'тиазидоподобный диуретик', target: 'K 3.5-5.0', freq: 'week4' },
  nebivolol: { marker: 'ЧСС, АД, ЭКГ (при симптомах)', reason: 'β-блокатор — брадикардия, АД', target: 'ЧСС 55-85, АД<130/85', freq: 'week4', escalation: 'ЧСС<50 — снизить дозу, врач' },
  tadalafil: { marker: 'АД (ортостаз), ЧСС', reason: 'PDE5i — гипотония, особенно с ARB/β-блокаторами', target: 'сист. >100', freq: 'week4' },
  // Липиды
  atorvastatin: { marker: 'АЛТ, КФК, липиды (ЛПНП/ЛПВП/ТГ)', reason: 'статин — гепатотоксичность и миопатия', target: 'АЛТ<40, КФК<300, ЛПНП<2.6', freq: 'week4', escalation: 'КФК>2000 или миалгия — STOP' },
  rosuvastatin: { marker: 'АЛТ, КФК, липиды', reason: 'статин — гепатотоксичность и миопатия', target: 'АЛТ<40, КФК<300', freq: 'week4', escalation: 'КФК>2000 или миалгия — STOP' },
  // Метаболизм
  metformin: { marker: 'глюкоза, HbA1c, eGFR, B12', reason: 'метформин — гипогликемия, лактат (eGFR), дефицит B12', target: 'глюкоза 3.9-7.8, eGFR>30', freq: 'week4', escalation: 'гипогликемия — пересмотр дозы' },
  berberine: { marker: 'глюкоза натощак', reason: 'берберин снижает глюкозу — риск гипогликемии с инсулином/GH', target: 'глюкоза >3.9', freq: 'week4' },
  // Креатин/железо/витамины
  creatine: { marker: 'креатинин (интерпретация с eGFR/цистатином-C)', reason: 'креатин ↑ креатинин без ухудшения функции', target: 'eGFR>60', freq: 'week8' },
  iron: { marker: 'ферритин, сыв. железо, TSAT', reason: 'приём железа — перегрузка/дефицит', target: 'ферритин 50-200, TSAT 20-45%', freq: 'week8', escalation: 'TSAT>45% — гемохроматоз-скрининг' },
  vitamin_d3: { marker: '25-OH D, кальций', reason: 'D3 — уровень и кальций', target: 'D3 50-80 нг/мл', freq: 'week8' },
  calcium: { marker: 'кальций, 25-OH D, PTH', reason: 'кальций — гиперкальциемия при D3', target: 'Ca 2.15-2.55', freq: 'week8' },
  // Печень
  milk_thistle: { marker: 'АЛТ/АСТ/ГГТ (сравнение с baseline)', reason: 'силимарин снижает трансаминазы — учитывать при оценке', target: 'АЛТ<40', freq: 'week4' },
  curcumin: { marker: 'CRP', reason: 'куркумин снижает hs-СРБ — учитывать', target: 'CRP<3', freq: 'week8' },
  // Гормоны
  anastrozole: { marker: 'E2 (чувств.), липиды', reason: 'ИА — контроль E2 и липидов', target: 'E2 20-40 пг/мл', freq: 'week4', escalation: 'E2<10 — снизить ИА' },
  tamoxifen: { marker: 'E2, TT, LH/FSH, липиды, тромботические симптомы', reason: 'SERM — тромбоз, липиды', target: 'без тромбозов', freq: 'week4', escalation: 'боль в ноге/груди — STOP' },
  // ОАК с СОЭ + ИФР + ОАМ — базовые расширения
};

/** Пункты мониторинга для веществ плана (по базе). */
export function getSubstanceMonitoring(protocolIds: string[]): Array<SubstanceMonitoring & { substanceId: string }> {
  const out: Array<SubstanceMonitoring & { substanceId: string }> = [];
  for (const id of protocolIds) {
    const m = SUBSTANCE_MONITORING_DB[id.toLowerCase()];
    if (m) out.push({ ...m, substanceId: id });
  }
  return out;
}

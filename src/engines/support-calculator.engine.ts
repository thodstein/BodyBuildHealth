import {
  type CalculatorState, type CalculatorResult, type RiskSystemId,
  type SystemRisk, type MechanismDetail, type LabDelta,
  type ScheduleItem, type TimeBlock, type SynergyId,
  type PowerLevel, type LabSlice,
  SYNERGY_ID_SUBSTANCES, TITRATION_RULES, SYNERGY_ID_LABELS,
} from './support-calculator.types';

const SYS_META: Record<RiskSystemId, { label: string; icon: string }> = {
  cardio: { label: 'Сердечно-сосудистая', icon: '❤️' },
  hepatic: { label: 'Печень', icon: '🫁' },
  renal: { label: 'Почки', icon: '💧' },
  neuro: { label: 'Нервная система', icon: '🧠' },
  endocrine: { label: 'Эндокринная', icon: '⚖️' },
  hematologic: { label: 'Кроветворная', icon: '🩸' },
  reproductive: { label: 'Репродуктивная', icon: '💪' },
  musculoskeletal: { label: 'ОДА/Мышцы', icon: '🦴' },
};

const MECH_NAMES: Record<RiskSystemId, string[]> = {
  cardio: ['Дислипидемия', 'Артериальная гипертензия', 'Гипертрофия ЛЖ', 'Тромбогенный потенциал', 'Окислительный стресс', 'Фиброз', 'Аритмогенность'],
  hepatic: ['Холестаз', 'Цитолиз', 'Окислительный стресс', 'Митохондриальная дисфункция', 'Активация звёздчатых клеток', 'Нагрузка CYP450', 'Химическая токсичность'],
  renal: ['Гломерулярная гипертензия', 'Тубулоинтерстициальный фиброз', 'Протеинурия', 'Электролитный дисбаланс', 'Ишемия', 'Нефролитиаз', 'Токсичность метаболитов'],
  neuro: ['Дофаминовый дисбаланс', 'Глутаматная эксайтотоксичность', 'ГАМК-дисрегуляция', 'Нейровоспаление', 'Окислительный стресс', 'Проницаемость ГЭБ', 'Серотониновый дисбаланс'],
  endocrine: ['Подавление ГГЯ', 'Ароматизация', 'Пролактиновый всплеск', 'Инсулинорезистентность', 'Дисфункция ЩЖ', 'Дисбаланс кортизола', 'Десенситизация рецепторов'],
  hematologic: ['Эритроцитоз', 'Тромбоцитоз', 'Лейкоцитоз', 'Изменение реологии', 'Дефицит железа', 'Активация свёртывания', 'Гемолиз'],
  reproductive: ['Атрофия тестикул', 'Олигоспермия', 'Морфология', 'Подвижность', 'Гиперплазия простаты', 'Риск онкологии простаты', 'ЭД'],
  musculoskeletal: ['Мышечный катаболизм', 'Воспаление суставов', 'Тендинопатия', 'Остеопения', 'Фиброз мышц', 'Нарушение восстановления', 'Нервно-мышечная блокада'],
};

function sev(s: string): number {
  return s === 'severe' ? 30 : s === 'moderate' ? 15 : s === 'mild' ? 5 : 0;
}

function clamp(v: number, lo = 0, hi = 100): number { return Math.min(hi, Math.max(lo, v)); }

// ─── Block 1: Profile ───
function rProfile(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const p = s.profile;
  const ageF = clamp(p.age / 40, 0.5, 1.5);
  r.cardio = (r.cardio || 0) + (p.workoutsPerWeek < 2 ? 10 : p.workoutsPerWeek < 4 ? 5 : 0);
  r.cardio! += (p.sleepHours < 6 ? 10 : p.sleepHours < 7 ? 5 : 0);
  r.cardio! += (p.stressLevel > 7 ? 10 : p.stressLevel > 5 ? 5 : 0);
  r.cardio = Math.round(r.cardio! * ageF);
  if (p.smoker) { r.cardio! += 15; r.neuro = (r.neuro || 0) + 5; }
  if (p.alcohol === 'regular') { r.hepatic = (r.hepatic || 0) + 20; }
  else if (p.alcohol === 'sometimes') { r.hepatic = (r.hepatic || 0) + 8; }
  if (p.caffeineMg > 400) { r.neuro = (r.neuro || 0) + 8; r.cardio! += 5; }
  if (p.bodyfat !== undefined && p.bodyfat > 25) { r.cardio! += 8; r.hepatic = (r.hepatic || 0) + 5; }
  if (p.height !== undefined && p.weight !== undefined) {
    const bmi = p.weight / ((p.height / 100) ** 2);
    if (bmi > 30) { r.cardio! += 10; r.hepatic = (r.hepatic || 0) + 5; }
  }
  return r;
}

// ─── Block 2: Neuro ───
function rNeuro(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const n = s.neuro;
  let score = n.dopamineScore * 4 + n.serotoninScore * 3 + n.aggressionScore * 3;
  if (n.gabaBalance === 'overexcited') score += 10;
  else if (n.gabaBalance === 'inhibited') score += 5;
  if (n.memoryIssues) score += 5;
  if (n.focusIssues) score += 5;
  if (n.slowThinking) score += 5;
  if (n.coordinationIssues) score += 5;
  if (n.headaches) score += 5;
  if (n.weatherDependent) score += 3;
  r.neuro = clamp(score);
  if (n.sleepQuality === 'poor') r.neuro += 15;
  else if (n.sleepQuality === 'fair') r.neuro += 5;
  return r;
}

// ─── Block 3: Pharma Stack ───
function rPharma(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const p = s.pharma;
  if (p.aas.length > 0) {
    const totalDose = p.aas.reduce((a, b) => a + b.doseMgWeek, 0);
    const hasOral = p.aas.some(a => ['methand','oxan','stan','trena','halo','superdrol','m1t'].includes(a.id));
    const hasTren = p.aas.some(a => a.id.includes('tren'));
    const hasNand = p.aas.some(a => a.id.includes('nand') || a.id.includes('deca'));
    const has19nor = p.aas.some(a => a.id.includes('tren') || a.id.includes('nand') || a.id === 'bold' || a.id === 'eq');
    r.endocrine = clamp(totalDose * 0.02, 0, 50);
    r.reproductive = clamp(totalDose * 0.015, 0, 40);
    r.hepatic = hasOral ? 30 : 5;
    r.cardio = clamp(totalDose * 0.015, 0, 40);
    if (hasTren) { r.neuro = 35; r.cardio! += 10; }
    if (has19nor) { r.neuro = (r.neuro || 0) + 10; }
    if (hasNand) { r.reproductive = clamp((r.reproductive || 0) + 10, 0, 50); }
    r.hematologic = clamp(totalDose * 0.01, 0, 35);
    if (totalDose > 1000) { r.cardio = clamp((r.cardio || 0) + 10, 0, 50); }
  }
  if (p.hasGH) { r.endocrine = (r.endocrine || 0) + 15; r.cardio = (r.cardio || 0) + 5; }
  if (p.hasIGF) { r.endocrine = (r.endocrine || 0) + 8; }
  if (p.hasInsulin) { r.cardio = (r.cardio || 0) + 10; r.neuro = (r.neuro || 0) + 5; }
  return r;
}

// ─── Block 4: Goals ───
function rGoals(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const g = s.goals;
  if (g.trainingCycle === 'mass') { r.cardio = 5; r.hepatic = 5; }
  if (g.cycleWeeks > 16) { r.hepatic = (r.hepatic || 0) + 10; r.cardio = (r.cardio || 0) + 10; r.neuro = (r.neuro || 0) + 5; }
  else if (g.cycleWeeks > 12) { r.hepatic = (r.hepatic || 0) + 5; r.cardio = (r.cardio || 0) + 5; }
  if (g.previousCycles > 5) { r.endocrine = 10; r.reproductive = 10; }
  if (g.previousCycles > 10) { r.endocrine = (r.endocrine || 0) + 5; r.reproductive = (r.reproductive || 0) + 5; }
  if (g.timeSinceLastCycle === '<3mo' || g.timeSinceLastCycle === 'none') { r.endocrine = (r.endocrine || 0) + 10; }
  return r;
}

// ─── Block 5: Hepatobiliary ───
function rHepatic(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const h = s.hepatobiliary;
  r.hepatic = sev(h.altAstElevation) + sev(h.ggtElevation) + sev(h.bilirubinElevation);
  if (h.fattyLiver) r.hepatic += 20;
  if (h.cholecystitis) r.hepatic += 10;
  if (h.alcoholHistory === 'current') r.hepatic += 25;
  else if (h.alcoholHistory === 'past') r.hepatic += 5;
  return r;
}

// ─── Block 6: Urinary ───
function rRenal(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const u = s.urinary;
  r.renal = sev(u.creatinineElevation) + sev(u.ureaElevation);
  if (u.proteinuria) r.renal += 20;
  if (u.nephrotoxicDrugs) r.renal += 15;
  if (u.hypertension) r.renal += 15;
  if (u.diabetes) r.renal += 20;
  return r;
}

// ─── Block 7: Cardiovascular ───
function rCardio(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const c = s.cardio;
  const bpMap: Record<string, number> = { normal: 0, prehypertension: 10, hypertension1: 25, hypertension2: 40 };
  r.cardio = (r.cardio || 0) + (bpMap[c.bpStage] || 0);
  if (c.heartRate > 90) r.cardio += 15;
  else if (c.heartRate > 80) r.cardio += 5;
  r.cardio += sev(c.ldlElevation);
  if (c.hdlLow) r.cardio += 10;
  if (c.triglycerides === 'elevated') r.cardio += 10;
  else if (c.triglycerides === 'high') r.cardio += 20;
  r.cardio += sev(c.hctElevation);
  if (c.previousCVD) r.cardio += 25;
  if (c.familyCVD) r.cardio += 10;
  return r;
}

// ─── Block 8: ODA ───
function rODA(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const o = s.oda;
  r.musculoskeletal = sev(o.jointPain) + (o.injuries.length * 5);
  if (o.ligamentIssues) r.musculoskeletal += 15;
  if (o.backPain) r.musculoskeletal += 10;
  return r;
}

// ─── Block 11: Nutrition ───
function rNutrition(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const n = s.nutrition;
  if (n.calories > 4000) { r.cardio = 5; r.hepatic = 5; }
  if (n.proteinG > 3.5 * (s.profile.weight || 80)) { r.renal = 10; }
  if (n.fatG < 40) { r.endocrine = 5; }
  if (n.waterL < 1.5) { r.renal = 10; r.hematologic = 5; }
  if (n.saltIntake === 'high') { r.cardio = (r.cardio || 0) + 8; r.renal = (r.renal || 0) + 5; }
  if (n.fiberG < 20) { r.cardio = (r.cardio || 0) + 3; }
  if (n.omega3) { r.cardio = Math.max(0, (r.cardio || 0) - 5); }
  return r;
}

// ─── Block 12: Medical Contraindications ───
function rContraind(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const c = s.contraindications;
  if (c.hasCVD) r.cardio = 20;
  if (c.hasThrombophilia) r.hematologic = 25;
  if (c.hasDiabetes) { r.cardio = 10; r.renal = 10; }
  if (c.hasLiverDisease) r.hepatic = 20;
  if (c.hasKidneyDisease) r.renal = 20;
  if (c.hasEpilepsy) r.neuro = 15;
  if (c.hasMentalIllness) r.neuro = (r.neuro || 0) + 10;
  if (c.hasGI) { r.musculoskeletal = 5; r.hepatic = (r.hepatic || 0) + 5; }
  return r;
}

// ─── Epicrisis ───
function rEpicrisis(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const e = s.epicrisis;
  if (e.pastGyno) r.reproductive = 15;
  if (e.pastLibidoDrop) r.reproductive = (r.reproductive || 0) + 10;
  if (e.pastHctSpike) r.hematologic = 15;
  if (e.pastLiverIssues) r.hepatic = 15;
  if (e.pastKidneyIssues) r.renal = 15;
  return r;
}

// ─── Toxic Load ───
function rToxic(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const t = s.toxicLoad;
  if (t.hazardousWork) { r.hepatic = 5; r.renal = 5; r.hematologic = 5; }
  if (t.regularNSAIDs) { r.hepatic = 10; r.renal = 10; }
  if (t.otherHeavyDrugs) { r.hepatic = 15; r.renal = 10; }
  if (t.bowelFrequency === 'constipation') { r.hepatic = 5; }
  return r;
}

// ─── Dental / Mineral ───
function rDental(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const d = s.dental;
  if (d.bleedingGums) r.hematologic = 8;
  if (d.looseTeeth) r.musculoskeletal = 10;
  if (d.nightGrinding) r.neuro = (r.neuro || 0) + 5;
  if (d.boneFractures) r.musculoskeletal = (r.musculoskeletal || 0) + 10;
  if (d.cramps) r.neuro = (r.neuro || 0) + 5;
  return r;
}

// ─── Genetics ───
function rGenetics(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const g = s.genetics;
  if (g.cyp19a1 === 'high') { r.endocrine = 10; r.reproductive = 5; }
  if (g.srd5a2 === 'hypersensitive') { r.reproductive = 10; }
  if (g.arSensitivity === 'high') { r.endocrine = 10; r.cardio = 5; r.hematologic = 5; }
  if (g.mthfr === 'c677t') { r.neuro = 5; r.cardio = (r.cardio || 0) + 5; r.hematologic = (r.hematologic || 0) + 5; }
  return r;
}

// ─── GI ───
function rGI(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const g = s.gi;
  if (g.bloating || g.heartburn || g.diarrhea || g.constipation) {
    r.hepatic = (r.hepatic || 0) + 5;
    r.neuro = (r.neuro || 0) + 3;
  }
  if (g.diagnosedIBS) { r.hepatic = (r.hepatic || 0) + 5; r.musculoskeletal = 5; }
  return r;
}

// ─── Psych ───
function rPsych(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const p = s.psych;
  let neuroAdd = p.fearOfLoss * 3 + p.mirrorObsession * 3 + p.apathyOffCycle * 3;
  r.neuro = clamp(neuroAdd);
  return r;
}

// ─── Injection ───
function rInjection(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {};
  const inj = s.injection;
  const hasProblem = Object.values(inj).some(v => v !== '' && v !== 'ok');
  if (hasProblem) r.musculoskeletal = 10;
  return r;
}

// ─── Calculates risk from ALL blocks ───
function calcAllRisks(state: CalculatorState): Record<RiskSystemId, number> {
  const fns = [rProfile, rNeuro, rPharma, rGoals, rHepatic, rRenal, rCardio, rODA,
    rNutrition, rContraind, rEpicrisis, rToxic, rDental, rGenetics, rGI, rPsych, rInjection];
  const scores: Record<string, number> = { cardio: 0, hepatic: 0, renal: 0, neuro: 0, endocrine: 0, hematologic: 0, reproductive: 0, musculoskeletal: 0 };
  for (const fn of fns) {
    const part = fn(state);
    for (const [k, v] of Object.entries(part)) {
      if (v !== undefined) scores[k] = (scores[k] || 0) + v;
    }
  }
  for (const k of Object.keys(scores)) scores[k] = clamp(scores[k]);
  return scores as Record<RiskSystemId, number>;
}

function toSystemRisks(scores: Record<RiskSystemId, number>, result: CalculatorResult): SystemRisk[] {
  return (Object.keys(SYS_META) as RiskSystemId[]).map(id => {
    const raw = scores[id];
    const mechs: MechanismDetail[] = MECH_NAMES[id].slice(0, 7).map((name, i) => {
      const contribution = raw > 0 ? clamp(Math.round(raw / 7 * (i + 1) * (0.85 + Math.random() * 0.3))) : 0;
      return { id: i + 1, name, contribution, active: contribution > 10, triggers: [] };
    });
    const protection = 0.3 + (result.synergyIdsUsed.length * 0.02);
    const afterSupport = Math.max(0, raw - Math.round(raw * Math.min(protection, 0.7)));
    return { id, label: SYS_META[id].label, icon: SYS_META[id].icon, rawScore: raw, afterSupport, mechanisms: mechs };
  });
}

function selectSynergyGroups(state: CalculatorState): SynergyId[] {
  const sel: SynergyId[] = [];
  const scores = calcAllRisks(state);
  const s = scores;
  const cw = state.courseWeek ?? 1;
  const isLatePhase = cw > 6;
  const isMidPhase = cw > 3 && cw <= 6;
  const threshold = isLatePhase ? 15 : isMidPhase ? 18 : 20;
  const midThreshold = threshold + (isLatePhase ? 10 : 15);
  if (s.hepatic >= threshold) { sel.push('HEPATIC_GSH'); if (s.hepatic >= midThreshold) sel.push('HEPATIC_BILE'); }
  if (s.hepatic >= threshold + 10) sel.push('LIVER_DETOX');
  if (s.cardio >= threshold) { sel.push('CARDIO_LIPID'); if (s.cardio >= midThreshold) sel.push('CARDIO_ANTIAGG'); }
  if (s.cardio >= threshold + 5) sel.push('CARDIO_BP');
  if (s.renal >= threshold) sel.push('RENAL_PROTECT');
  if (s.neuro >= threshold) { sel.push('NEURO_DOPAMINE'); if (s.neuro >= midThreshold) sel.push('NEURO_GABA'); }
  if (s.endocrine >= threshold || state.pharma.phase === 'pct') sel.push('ENDOCRINE');
  if (s.reproductive >= threshold) sel.push('ENDOCRINE');
  if (s.musculoskeletal >= threshold) sel.push('BONE_JOINT');
  if (s.hematologic >= threshold) sel.push('CARDIO_ANTIAGG');
  const pl = state.powerLevel;
  if (isLatePhase) {
    if (!sel.includes('ANTIOXIDANT')) sel.push('ANTIOXIDANT');
    if (!sel.includes('IMMUNE')) sel.push('IMMUNE');
    if (!sel.includes('OMEGA3') && s.cardio >= 10) sel.push('OMEGA3');
    if (!sel.includes('MAGNESIUM')) sel.push('MAGNESIUM');
  }
  if (pl === 'max' || pl === 'boost' || isLatePhase) {
    if (!sel.includes('ANTIOXIDANT')) sel.push('ANTIOXIDANT');
    if (!sel.includes('IMMUNE')) sel.push('IMMUNE');
    if (!sel.includes('METHYLATION') && s.neuro >= 10) sel.push('METHYLATION');
    if (!sel.includes('MAGNESIUM')) sel.push('MAGNESIUM');
    if (!sel.includes('ZINC')) sel.push('ZINC');
    if (!sel.includes('OMEGA3') && s.cardio >= 10) sel.push('OMEGA3');
  }
  if (pl === 'boost' || (isLatePhase && pl !== 'basic')) {
    if (!sel.includes('NEURO_SEROTONIN') && s.neuro >= 15) sel.push('NEURO_SEROTONIN');
    if (!sel.includes('CARDIO_BP')) sel.push('CARDIO_BP');
    if (!sel.includes('VITAMIN_D')) sel.push('VITAMIN_D');
    if (!sel.includes('VITAMIN_B')) sel.push('VITAMIN_B');
  }
  const dedup: [SynergyId, SynergyId][] = [
    ['LIVER_DETOX', 'HEPATIC_GSH'], ['ANTIOXIDANT', 'HEPATIC_GSH'], ['CARDIO_ANTIAGG', 'CARDIO_LIPID'],
  ];
  for (const [sub, parent] of dedup) {
    const idx = sel.indexOf(sub);
    if (idx >= 0 && sel.includes(parent)) sel.splice(idx, 1);
  }
  return [...new Set(sel)];
}

function getSubstancesFromSynergies(synergies: SynergyId[], powerLevel: PowerLevel, blacklist: string[]): string[] {
  const all = new Set<string>();
  for (const sid of synergies) {
    for (const sub of SYNERGY_ID_SUBSTANCES[sid]) all.add(sub);
  }
  if (powerLevel === 'basic') {
    for (const e of ['telmisartan', 'nebivolol', 'l_dopa', 'gaba', 'bile_acids', 'artichoke', 'bergamot', 'red_yeast', 'probiotics']) all.delete(e);
  }
  if (powerLevel === 'mid') {
    for (const e of ['telmisartan', 'nebivolol']) all.delete(e);
  }
  for (const b of blacklist) all.delete(b);
  return [...all];
}

function applyTitration(substances: string[], state: CalculatorState): Record<string, number> {
  const d: Record<string, number> = {};
  const c = state.cardio; const p = state.pharma;
  const cw = state.courseWeek ?? 1;
  // Week scaling: early = 0.5x, mid = 0.75x, late = 1.0x
  const weekScale = cw <= 2 ? 0.5 : cw <= 4 ? 0.75 : cw <= 6 ? 0.9 : 1.0;
  if (substances.includes('telmisartan')) {
    const baseDose = c.bpStage === 'hypertension2' ? 120 : c.bpStage === 'hypertension1' ? 80 : 40;
    d.telmisartan = Math.round(baseDose * weekScale / 10) * 10;
  }
  if (substances.includes('nebivolol')) {
    const baseDose = c.heartRate > 95 ? 7.5 : c.heartRate > 85 ? 5 : 2.5;
    d.nebivolol = Math.round(baseDose * weekScale * 2) / 2;
  }
  if (p.hasAI && substances.some(s => s === 'anastro' || s === 'anastrozole')) {
    const totalTest = p.aas.filter(a => ['test_prop','test_enan','test_cyp','test_undec','test_mix'].includes(a.id)).reduce((s, a) => s + a.doseMgWeek, 0);
    const baseDose = totalTest > 700 ? 1.5 : totalTest > 500 ? 1 : 0.5;
    d.anastrozole = Math.round(baseDose * Math.max(0.75, weekScale) * 2) / 2;
  }
  if (p.hasCaber && substances.some(s => s === 'caberg' || s === 'cabergoline')) {
    d.cabergoline = cw <= 2 ? 0.125 : 0.25;
  }
  // NAC / TUDCA titration: build up to avoid GI upset
  if (substances.includes('nac')) d.nac = cw <= 2 ? 1200 : 1800;
  if (substances.includes('tudca')) d.tudca = cw <= 2 ? 500 : 1000;
  return d;
}

const SUB_NAMES: Record<string, string> = {
  nac:'NAC', alpha_lipoic:'Альфа-липоевая к-та', tudca:'TUDCA', milk_thistle:'Силимарин',
  omega3:'Омега-3', coq10:'CoQ10', bergamot:'Бергамот', red_yeast:'Красный рис',
  telmisartan:'Телмисартан', nebivolol:'Небиволол', magnesium:'Магний',
  aspirin:'Аспирин', nattokinase:'Наттокиназа', bromelain:'Бромелайн',
  astragalus:'Астрагал', celery_extract:'Сельдерей', potassium:'Калий',
  tyrosine:'L-Тирозин', l_dopa:'L-ДОФА', vitamin_b6:'B6',
  glycine:'Глицин', theanine:'L-Теанин', gaba:'GABA',
  x5htp:'5-HTP', vitamin_c:'Витамин C', zinc:'Цинк', vitamin_d3:'D3',
  probiotics:'Пробиотики', vitamin_e:'Витамин E', glutathione:'Глутатион',
  betaine:'TMG', folate:'5-МТГФ', vitamin_b12:'B12',
  calcium:'Кальций', boron:'Бор', vitamin_k2:'K2',
  ashwagandha:'Ашваганда', selenium:'Селен', artichoke:'Артишок',
  bile_acids:'Жёлчные к-ты', berberine:'Берберин', anastrozole:'Анастрозол',
  cabergoline:'Каберголин',
};

function generateSchedule(substances: string[], synergyIds: SynergyId[], doses: Record<string, number>): ScheduleItem[] {
  const schedule: ScheduleItem[] = [];
  const used = new Set<string>();
  const morningGroup = ['vitamin_c','vitamin_d3','vitamin_e','coq10','alpha_lipoic','selenium','boron','zinc','telmisartan','nebivolol','ashwagandha','calcium','vitamin_k2','probiotics','anastrozole','cabergoline'];
  const afternoonGroup = ['berberine','bromelain','nattokinase','betaine','folate','vitamin_b12','magnesium','potassium','artichoke','bile_acids','omega3'];
  const eveningGroup = ['nac','tudca','milk_thistle','glycine','theanine','gaba','tyrosine','l_dopa','x5htp','vitamin_b6','astragalus','celery_extract','glutathione','bergamot','red_yeast','aspirin'];
  const timeOf = (id: string): TimeBlock => morningGroup.includes(id) ? 'morning' : afternoonGroup.includes(id) ? 'afternoon' : 'evening';
  const doseStr = (id: string): string => {
    if (doses[id]) return doses[id] + ' мг';
    const defs: Record<string, string> = {
      nac:'1200 мг', alpha_lipoic:'300 мг', tudca:'500 мг', milk_thistle:'280 мг',
      omega3:'2000 мг', coq10:'100 мг', magnesium:'200 мг', telmisartan:'40 мг',
      nebivolol:'5 мг', aspirin:'100 мг', nattokinase:'2000 ФЕ', bromelain:'500 мг',
      astragalus:'500 мг', celery_extract:'500 мг', potassium:'200 мг',
      tyrosine:'500 мг', l_dopa:'250 мг', vitamin_b6:'25 мг',
      glycine:'2000 мг', theanine:'100 мг', gaba:'500 мг',
      x5htp:'50 мг', vitamin_c:'500 мг', zinc:'15 мг', vitamin_d3:'2000 МЕ',
      probiotics:'1 капс', vitamin_e:'100 мг', glutathione:'100 мг',
      betaine:'1000 мг', folate:'200 мкг', vitamin_b12:'500 мкг',
      calcium:'250 мг', boron:'2 мг', vitamin_k2:'100 мкг',
      ashwagandha:'300 мг', selenium:'50 мкг', artichoke:'250 мг',
      bile_acids:'250 мг', bergamot:'500 мг', red_yeast:'600 мг',
      berberine:'500 мг', anastrozole:'0.5 мг', cabergoline:'0.25 мг',
    };
    return defs[id] || 'по инструкции';
  };
  for (const sub of substances) {
    if (used.has(sub)) continue; used.add(sub);
    const block = timeOf(sub);
    schedule.push({
      substanceId: sub, name: SUB_NAMES[sub] || sub,
      dose: doseStr(sub), timeBlock: block,
      instructions: block === 'morning' ? 'С завтраком' : block === 'afternoon' ? 'С обедом' : 'За 1-2 ч до сна',
      synergyGroup: synergyIds.find(sid => SYNERGY_ID_SUBSTANCES[sid]?.includes(sub)),
    });
  }
  const order: Record<TimeBlock, number> = { morning: 0, afternoon: 1, evening: 2 };
  schedule.sort((a, b) => order[a.timeBlock] - order[b.timeBlock] || a.name.localeCompare(b.name));
  return schedule;
}

function getBlacklist(state: CalculatorState): string[] {
  return state.journal.negative.map(n => n.substanceId);
}

function calcLabDeltas(state: CalculatorState): LabDelta[] {
  const { preCourse, midCourse, postPCT } = state.labs;
  const markers = new Set<string>();
  for (const slice of [preCourse, midCourse, postPCT]) {
    if (slice) for (const k of Object.keys(slice.panelSex || {})) markers.add(k);
    if (slice) for (const k of Object.keys(slice.panelBiochem || {})) markers.add(k);
    if (slice) for (const k of Object.keys(slice.panelHematology || {})) markers.add(k);
    if (slice) for (const k of Object.keys(slice.panelThyroid || {})) markers.add(k);
  }
  const res: LabDelta[] = [];
  const getVal = (slice: LabSlice | null, marker: string): string | undefined => {
    if (!slice) return undefined;
    return slice.panelSex[marker] ?? slice.panelBiochem[marker] ?? slice.panelHematology[marker] ?? slice.panelThyroid[marker] ?? undefined;
  };
  for (const marker of markers) {
    const preV = getVal(preCourse, marker); const midV = getVal(midCourse, marker); const postV = getVal(postPCT, marker);
    const dPreMid = preV !== undefined && midV !== undefined ? Math.round((Number(midV) - Number(preV)) / Number(preV) * 100) : undefined;
    let trend: LabDelta['trend'] = 'stable';
    const vals = [preV, midV, postV].filter(v => v !== undefined).map(Number);
    if (vals.length >= 2) {
      const last = vals[vals.length - 1]; const first = vals[0];
      const delta = last - first;
      trend = Math.abs(delta) > 20 ? (delta > 0 ? 'worsening' : 'improving') : 'stable';
      if (Math.abs(delta) > 50) trend = 'critical';
    }
    res.push({ marker, sliceValues: [preV, midV, postV], trend });
  }
  return res;
}

function getContraindicationAlerts(state: CalculatorState): string[] {
  const alerts: string[] = [];
  const c = state.contraindications;
  if (c.hasCVD) alerts.push('⚠ ССЗ: избегать высоких доз стимуляторов, контролировать АД/ЧСС');
  if (c.hasThrombophilia) alerts.push('⚠ Тромбофилия: избегать высоких доз андрогенов, контролировать гематокрит');
  if (c.hasLiverDisease) alerts.push('⚠ Заболевания печени: минимизировать оральные ААС, поддержка гепатопротекторов');
  if (c.hasKidneyDisease) alerts.push('⚠ Заболевания почек: избегать НПВС, контролировать креатинин');
  if (c.allergies) alerts.push(`⚠ Аллергии: ${c.allergies}`);
  return alerts;
}

export function calculateSupportTZ(state: CalculatorState): CalculatorResult {
  const blacklist = getBlacklist(state);
  const synergyIds = selectSynergyGroups(state);
  const substances = getSubstancesFromSynergies(synergyIds, state.powerLevel, blacklist);
  const titration = applyTitration(substances, state);
  const scores = calcAllRisks(state);
  const labDeltas = calcLabDeltas(state);
  const overallRaw = Math.round(Math.max(...Object.values(scores)));
  const cw = state.courseWeek ?? 1;
  const weekProtectionBonus = Math.min(0.15, cw * 0.015); // +1.5% protection per week up to 15%
  const protection = Math.min(0.7, 0.3 + (synergyIds.length * 0.02) + weekProtectionBonus);
  const overallAfterSupport = Math.round(Math.max(...Object.values(scores))) - Math.round(Math.max(...Object.values(scores)) * Math.min(protection, 0.7));
  const schedule = generateSchedule(substances, synergyIds, titration);
  const result: CalculatorResult = {
    risk: { systems: [], overallRaw, overallAfterSupport, timestamp: new Date().toISOString() },
    schedule, selectedSubstances: substances,
    synergyIdsUsed: synergyIds,
    titrationApplied: titration,
    labDeltas, overallRiskBefore: overallRaw, overallRiskAfter: overallAfterSupport,
    contraindicationAlerts: getContraindicationAlerts(state),
    negativeBlocks: blacklist,
    comparisonBeforeAfter: (Object.keys(SYS_META) as RiskSystemId[]).map(id => ({
      system: id, before: scores[id], after: Math.max(0, scores[id] - Math.round(scores[id] * Math.min(protection, 0.7))),
    })),
    timestamp: new Date().toISOString(),
  };
  result.risk.systems = toSystemRisks(scores, result);
  return result;
}

export function hydrateState(): Partial<CalculatorState> {
  const result: Partial<CalculatorState> = {};
  try {
    const saved = localStorage.getItem('he_support_plan_current');
    if (saved) {
      const p = JSON.parse(saved);
      if (p.state && p.state.profile) {
        Object.assign(result, p.state);
      }
    }
  } catch {}
  try {
    const raw = localStorage.getItem('he_user_profile');
    if (raw) {
      const p = JSON.parse(raw);
      result.profile = {
        weight: p.weight || 80, age: p.age || 30, sex: p.sex || 'male',
        height: p.height, bodyfat: p.bodyfat,
        workoutsPerWeek: p.workoutsPerWeek || 3, avgWorkoutMinutes: p.avgWorkoutMinutes || 60,
        sleepHours: p.sleepHours || 7, stressLevel: p.stressLevel || 4,
        smoker: p.smoker || false, alcohol: p.alcohol || 'rare', caffeineMg: p.caffeineMg || 100,
      };
    }
  } catch {}
  try {
    const raw = localStorage.getItem('he_course_data');
    if (raw) {
      const c = JSON.parse(raw);
      const aas = Array.isArray(c.substances) ? c.substances.filter((s: any) => s.isAAS).map((s: any) => ({ id: s.id || s.substanceId || '', doseMgWeek: s.doseMgWeek || s.dose || 0, weeks: s.weeks || s.durationWeeks || 0 })) : [];
      result.pharma = { phase: c.phase || 'course', aas, hasGH: !!c.ghPeptides, hasIGF: !!c.igf1, hasInsulin: !!c.insulin, hasHCG: !!c.hcg, hasAI: !!c.ai, hasCaber: !!c.caber, hasSERM: !!c.serm, hasSARMs: !!c.sarm };
    }
  } catch {}
  try {
    const raw = localStorage.getItem('he_labs_history');
    if (raw) {
      const arr = JSON.parse(raw); const l = Array.isArray(arr) ? arr : [];
      const toSlice = (d: any): LabSlice => ({ date: d.date || '', panelSex: d.panelSex || d.values || {}, panelBiochem: d.panelBiochem || {}, panelHematology: d.panelHematology || {}, panelThyroid: d.panelThyroid || {}, panelLipid: d.panelLipid || {}, panelIron: d.panelIron || {}, panelVitamin: d.panelVitamin || {}, panelCardiac: d.panelCardiac || {}, panelCoagulation: d.panelCoagulation || {}, panelInflammatory: d.panelInflammatory || {}, panelAdrenal: d.panelAdrenal || {}, panelMineral: d.panelMineral || {}, panelTumor: d.panelTumor || {}, panelUrinalysis: d.panelUrinalysis || {} });
      result.labs = { preCourse: l[0] ? toSlice(l[0]) : null, midCourse: l[1] ? toSlice(l[1]) : null, postPCT: l[2] ? toSlice(l[2]) : null, fullPanel: null };
    }
  } catch {}
  // Also read extended profile data saved by the AutoCalculator itself
  try {
    const extState = localStorage.getItem('he_autocalc_state');
    if (extState) {
      const s = JSON.parse(extState);
      if (s.neuro) result.neuro = { ...(result.neuro || {}), ...s.neuro };
      if (s.psych) result.psych = { ...(result.psych || {}), ...s.psych };
      if (s.genetics) result.genetics = { ...(result.genetics || {}), ...s.genetics };
      if (s.hepatobiliary) result.hepatobiliary = { ...(result.hepatobiliary || {}), ...s.hepatobiliary };
      if (s.cardio) result.cardio = { ...(result.cardio || {}), ...s.cardio };
      if (s.urinary) result.urinary = { ...(result.urinary || {}), ...s.urinary };
      if (s.goals) result.goals = { ...(result.goals || {}), ...s.goals };
      if (s.nutrition) result.nutrition = { ...(result.nutrition || {}), ...s.nutrition };
      if (s.contraindications) result.contraindications = { ...(result.contraindications || {}), ...s.contraindications };
      if (s.oda) result.oda = { ...(result.oda || {}), ...s.oda };
      if (s.dental) result.dental = { ...(result.dental || {}), ...s.dental };
      if (s.gi) result.gi = { ...(result.gi || {}), ...s.gi };
      if (s.toxicLoad) result.toxicLoad = { ...(result.toxicLoad || {}), ...s.toxicLoad };
      if (s.epicrisis) result.epicrisis = { ...(result.epicrisis || {}), ...s.epicrisis };
      if (s.injection) result.injection = { ...(result.injection || {}), ...s.injection };
      if (s.journal) result.journal = { ...(result.journal || {}), ...s.journal };
      if (s.labs) result.labs = { ...(result.labs || {}), ...s.labs };
      if (s.profile) result.profile = { ...(result.profile || {}), ...s.profile };
    }
  } catch {}
  return result;
}

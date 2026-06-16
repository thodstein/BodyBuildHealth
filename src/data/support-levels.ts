// Support Levels with Phase Awareness, Analogs, and Enhancers

export type SupportPhase = 'course' | 'bridge' | 'pct' | 'fertility';

export interface SubstanceDosage {
  mg: number;
  timing: string;
}

export interface SupportLevel {
  label: string;
  desc: string;
  subs: string[];
  dosages: Record<string, SubstanceDosage>;
}

// Substance analogs: what can replace what
export const SUBSTANCE_ANALOGS: Record<string, { id: string; name: string; reason: string; form?: string; mg?: number; timing?: string }[]> = {
  nac: [{ id: 'nac', name: 'NAC', reason: 'Оригинал', form: 'капсулы', mg: 600, timing: 'натощак' }, { id: 'milk_thistle', name: 'Силимарин', reason: 'Гепатопротекция', form: 'капсулы', mg: 600, timing: 'с едой, 2x/д' }, { id: 'alpha_lipoic', name: 'АЛЬК', reason: 'Глутатион + антиоксидант', form: 'R-форма', mg: 300, timing: 'натощак' }],
  omega3: [{ id: 'omega3', name: 'Омега-3', reason: 'Оригинал', form: 'EPA+DHA 60%', mg: 2000, timing: 'с едой, 2x/д' }, { id: 'egcg', name: 'EGCG', reason: 'Антиоксидант + липиды', form: 'капсулы', mg: 400, timing: 'натощак' }],
  tudca: [{ id: 'tudca', name: 'TUDCA', reason: 'Оригинал', form: 'капсулы', mg: 500, timing: 'перед едой, 2x/д' }, { id: 'milk_thistle', name: 'Силимарин', reason: 'Гепатопротекция (слабее)', form: 'капсулы', mg: 600, timing: 'с едой, 2x/д' }, { id: 'phosphatidylcholine', name: 'Фосфатидилхолин', reason: 'Мембраны гепатоцитов', form: 'капсулы', mg: 1200, timing: 'с едой' }],
  magnesium: [{ id: 'magnesium', name: 'Магний бисглицинат', reason: 'Оригинал', form: 'бисглицинат', mg: 400, timing: 'на ночь' }, { id: 'taurine', name: 'Таурин', reason: 'Расслабление + антиоксидант', form: 'порошок', mg: 2000, timing: 'натощак' }],
  vitamin_d3: [{ id: 'vitamin_d3', name: 'Витамин D3', reason: 'Оригинал', form: 'капсулы', mg: 5000, timing: 'с едой (МЕ)' }, { id: 'vitamin_k2', name: 'Витамин K2', reason: 'Направление Ca в кости', form: 'МК-7', mg: 200, timing: 'с едой (мкг)' }],
  coq10: [{ id: 'coq10', name: 'CoQ10 убихинол', reason: 'Оригинал', form: 'убихинол', mg: 200, timing: 'с едой' }],
  zinc: [{ id: 'zinc', name: 'Цинк пиколинат', reason: 'Оригинал', form: 'пиколинат', mg: 30, timing: 'на ночь' }],
  berberine: [{ id: 'berberine', name: 'Берберин', reason: 'Оригинал', form: 'капсулы', mg: 500, timing: 'с едой, 2x/д' }],
  ashwagandha: [{ id: 'ashwagandha', name: 'Ашваганда KSM-66', reason: 'Оригинал', form: 'KSM-66', mg: 600, timing: 'вечер' }],
  alpha_lipoic: [{ id: 'alpha_lipoic', name: 'АЛЬК R-форма', reason: 'Оригинал', form: 'R-форма', mg: 300, timing: 'натощак' }],
  selenium: [{ id: 'selenium', name: 'Селен метионин', reason: 'Оригинал', form: 'метионин', mg: 200, timing: 'с едой (мкг)' }],
  taurine: [{ id: 'taurine', name: 'Таурин', reason: 'Оригинал', form: 'порошок', mg: 2000, timing: 'натощак' }, { id: 'magnesium', name: 'Магний', reason: 'Кардиопротекция', form: 'бисглицинат', mg: 400, timing: 'на ночь' }],
  milk_thistle: [{ id: 'milk_thistle', name: 'Силимарин', reason: 'Оригинал', form: 'капсулы', mg: 600, timing: 'с едой, 2x/д' }, { id: 'nac', name: 'NAC', reason: 'Глутатион + гепатопротекция', form: 'капсулы', mg: 600, timing: 'натощак' }],
  glucosamine: [{ id: 'glucosamine', name: 'Глюкозамин', reason: 'Оригинал', form: 'сульфат', mg: 1500, timing: 'с едой' }],
  collagen: [{ id: 'collagen', name: 'Коллаген гидролизат', reason: 'Оригинал', form: 'гидролизат', mg: 10000, timing: 'с едой' }, { id: 'vitamin_c', name: 'Витамин C', reason: 'Синтез коллагена', form: 'порошок', mg: 1000, timing: 'натощак' }],
  curcumin: [{ id: 'curcumin', name: 'Куркумин + пиперин', reason: 'Оригинал', form: '+ пиперин', mg: 1000, timing: 'с едой' }],
  probiotics: [{ id: 'probiotics', name: 'Пробиотики', reason: 'Оригинал', form: 'капсулы', mg: 20, timing: 'натощак (млрд КОЕ)' }],
  vitamin_b12: [{ id: 'vitamin_b12', name: 'B12 метилкобаламин', reason: 'Оригинал', form: 'метилкобаламин', mg: 1000, timing: 'утро (мкг)' }],
  folate: [{ id: 'folate', name: 'Фолат 5-MTHF', reason: 'Оригинал', form: '5-MTHF', mg: 800, timing: 'с едой (мкг)' }],
  telmisartan: [{ id: 'telmisartan', name: 'Тельмисартан', reason: 'Оригинал', form: 'таблетки', mg: 40, timing: 'утро' }],
  nebivolol: [{ id: 'nebivolol', name: 'Небиволол', reason: 'Оригинал', form: 'таблетки', mg: 5, timing: 'утро' }],
  saw_palmetto: [{ id: 'saw_palmetto', name: 'Сабаль пальметто', reason: 'Оригинал', form: 'капсулы', mg: 640, timing: 'с едой, 2x/д' }],
  hcg: [{ id: 'hcg', name: 'ХГЧ', reason: 'Оригинал', form: 'инъекции', mg: 2500, timing: '2x/нед (МЕ)' }],
};

// Substance enhancers: what boosts each substance
export const SUBSTANCE_ENHANCERS: Record<string, { id: string; name: string; reason: string; form?: string; mg?: number; timing?: string }[]> = {
  nac: [{ id: 'vitamin_c', name: 'Витамин C', reason: 'Регенерация глутатиона', form: 'порошок', mg: 1000, timing: 'натощак' }, { id: 'alpha_lipoic', name: 'АЛЬК', reason: 'Усиление антиоксидантной сети', form: 'R-форма', mg: 300, timing: 'натощак' }, { id: 'selenium', name: 'Селен', reason: 'Глутатионпероксидаза', form: 'метионин', mg: 200, timing: 'с едой (мкг)' }],
  omega3: [{ id: 'vitamin_e', name: 'Витамин E', reason: 'Защита от окисления EPA/DHA', form: 'd-альфа-токоферол', mg: 400, timing: 'с едой (МЕ)' }],
  tudca: [{ id: 'milk_thistle', name: 'Силимарин', reason: 'Синергия гепатопротекции', form: 'капсулы', mg: 600, timing: 'с едой, 2x/д' }, { id: 'phosphatidylcholine', name: 'Фосфатидилхолин', reason: 'Мембраны гепатоцитов', form: 'капсулы', mg: 1200, timing: 'с едой' }],
  magnesium: [{ id: 'vitamin_b6', name: 'Витамин B6', reason: 'Улучшение усвоения Mg', form: 'пиридоксин', mg: 50, timing: 'с едой' }, { id: 'taurine', name: 'Таурин', reason: 'Синергия расслабления', form: 'порошок', mg: 2000, timing: 'натощак' }],
  coq10: [{ id: 'selenium', name: 'Селен', reason: 'Защита митохондрий', form: 'метионин', mg: 200, timing: 'с едой (мкг)' }, { id: 'alpha_lipoic', name: 'АЛЬК', reason: 'Регенерация CoQ10', form: 'R-форма', mg: 300, timing: 'натощак' }],
  vitamin_d3: [{ id: 'vitamin_k2', name: 'Витамин K2', reason: 'Направление Ca в кости', form: 'МК-7', mg: 200, timing: 'с едой (мкг)' }, { id: 'magnesium', name: 'Магний', reason: 'Активация D3', form: 'бисглицинат', mg: 400, timing: 'на ночь' }],
  zinc: [{ id: 'copper', name: 'Медь', reason: 'Баланс Zn/Cu', form: 'бисглицинат', mg: 2, timing: 'отдельно от цинка' }, { id: 'vitamin_c', name: 'Витамин C', reason: 'Улучшение всасывания', form: 'порошок', mg: 1000, timing: 'натощак' }],
  collagen: [{ id: 'vitamin_c', name: 'Витамин C', reason: 'Необходим для синтеза коллагена', form: 'порошок', mg: 1000, timing: 'натощак' }, { id: 'msm', name: 'MSM', reason: 'Сера для коллагена', form: 'порошок', mg: 2000, timing: 'с едой' }],
  glucosamine: [{ id: 'chondroitin', name: 'Хондроитин', reason: 'Синергия для хрящей', form: 'сульфат', mg: 1200, timing: 'с едой' }, { id: 'msm', name: 'MSM', reason: 'Сера для суставов', form: 'порошок', mg: 2000, timing: 'с едой' }],
  curcumin: [{ id: 'piperine', name: 'Пиперин', reason: 'Увеличение биодоступности 2000%', form: 'капсулы', mg: 10, timing: 'с куркумином' }],
  ashwagandha: [{ id: 'magnesium', name: 'Магний', reason: 'Синергия кортизол/расслабление', form: 'бисглицинат', mg: 400, timing: 'на ночь' }],
  probiotics: [{ id: 'prebiotics', name: 'Пребиотики', reason: 'Пища для пробиотиков', form: 'порошок', mg: 5000, timing: 'с едой' }],
};

// Phase-specific modifications
export const PHASE_MODS: Record<SupportPhase, { label: string; emoji: string; desc: string; addSubs: string[]; removeSubs: string[]; doseMultipliers: Record<string, number> }> = {
  course: { label: 'Курс', emoji: '💉', desc: 'Поддержка во время курса ААС — гепатопротекция, кардио, эндокринная система', addSubs: ['milk_thistle', 'saw_palmetto'], removeSubs: ['hcg'], doseMultipliers: { nac: 1.5, tudca: 1.5, omega3: 1.25, coq10: 1.5 } },
  bridge: { label: 'Мост', emoji: '🌉', desc: 'Между курсами — восстановление, стабилизация гормонов, детокс', addSubs: ['ashwagandha', 'milk_thistle', 'vitamin_b12', 'folate'], removeSubs: ['hcg', 'saw_palmetto', 'telmisartan'], doseMultipliers: { nac: 1, tudca: 1, ashwagandha: 1.5, magnesium: 1.25 } },
  pct: { label: 'ПКТ', emoji: '🔄', desc: 'Послекурсовая терапия — восстановление оси ГГЯ, фертильность, антикатаболизм', addSubs: ['hcg', 'ashwagandha', 'vitamin_d3', 'zinc', 'vitamin_b12', 'folate', 'milk_thistle', 'taurine'], removeSubs: ['telmisartan', 'nebivolol', 'saw_palmetto'], doseMultipliers: { nac: 0.75, tudca: 0.75, zinc: 1.5, ashwagandha: 1.5, vitamin_d3: 1.5 } },
  fertility: { label: 'Фертильность', emoji: '⚧', desc: 'Восстановление фертильности — сперматогенез, гормональный баланс', addSubs: ['zinc', 'selenium', 'vitamin_c', 'coq10', 'vitamin_e', 'folate', 'vitamin_b12', 'ashwagandha', 'l_carnitine'], removeSubs: ['hcg', 'telmisartan', 'nebivolol', 'saw_palmetto', 'berberine'], doseMultipliers: { zinc: 2, selenium: 1.5, vitamin_c: 1.5, coq10: 1.5, l_carnitine: 2 } },
};

// Default dosages for substances that may be added by phase
export const DEFAULT_DOSAGES: Record<string, SubstanceDosage> = {
  milk_thistle: { mg: 600, timing: 'с едой, 2x/д' }, saw_palmetto: { mg: 640, timing: 'с едой, 2x/д' },
  ashwagandha: { mg: 600, timing: 'вечер' }, vitamin_b12: { mg: 1000, timing: 'утро (мкг)' },
  folate: { mg: 800, timing: 'с едой (мкг)' }, taurine: { mg: 2000, timing: 'натощак' },
  hcg: { mg: 5000, timing: '2x/нед (МЕ)' }, l_carnitine: { mg: 2000, timing: 'натощак' },
  vitamin_e: { mg: 400, timing: 'с едой (МЕ)' }, selenium: { mg: 200, timing: 'с едой (мкг)' },
  vitamin_c: { mg: 1000, timing: 'натощак' }, probiotics: { mg: 20, timing: 'натощак (млрд КОЕ)' },
  coq10: { mg: 200, timing: 'с едой' }, prebiotics: { mg: 5000, timing: 'с едой (мг)' },
  alpha_lipoic: { mg: 600, timing: 'натощак (R-форма)' },
  berberine: { mg: 500, timing: 'с едой, 2x/д' },
  collagen: { mg: 10000, timing: 'с едой (мг, гидролизат)' },
  curcumin: { mg: 1000, timing: 'с пиперином, с едой' },
  egcg: { mg: 400, timing: 'натощак' },
  glucosamine: { mg: 1500, timing: 'с едой' },
  magnesium: { mg: 400, timing: 'на ночь (бисглицинат)' },
  nac: { mg: 1200, timing: 'натощак' },
  nebivolol: { mg: 5, timing: 'утро (ЧСС контроль!)' },
  omega3: { mg: 4000, timing: 'с едой, 2x/д (EPA+DHA 60%)' },
  phosphatidylcholine: { mg: 1200, timing: 'с едой' },
  telmisartan: { mg: 40, timing: 'утро (КАД и ЧСС контроль!)' },
  tudca: { mg: 1000, timing: 'перед едой, 2x/д' },
  vitamin_b6: { mg: 50, timing: 'с едой' },
  vitamin_d3: { mg: 5000, timing: 'с едой (МЕ)' },
  zinc: { mg: 30, timing: 'на ночь (пиколинат)' },
  piperine: { mg: 10, timing: 'с куркумином' }, chondroitin: { mg: 1200, timing: 'с едой' },
  msm: { mg: 2000, timing: 'с едой' }, copper: { mg: 2, timing: 'отдельно от цинка (мг)' },
  vitamin_k2: { mg: 200, timing: 'с едой (мкг)' }, iron: { mg: 18, timing: 'натощак' },
};

// Compute phase-adjusted level
export function getPhaseLevel(
  baseLevel: 'basic' | 'mid' | 'max' | 'boost',
  phase: SupportPhase,
  baseLevels: Record<string, { label: string; desc: string; subs: string[]; dosages: Record<string, { mg: number; timing: string }> }>
): { label: string; desc: string; subs: string[]; dosages: Record<string, { mg: number; timing: string }>; phaseLabel: string; phaseEmoji: string } {
  const base = baseLevels[baseLevel];
  if (!base) return { ...baseLevels.basic, phaseLabel: 'Курс', phaseEmoji: '💉' };
  const mod = PHASE_MODS[phase];
  const subs = [...base.subs];
  if (mod) {
    for (const s of mod.addSubs) { if (!subs.includes(s)) subs.push(s); }
    for (const s of mod.removeSubs) { const idx = subs.indexOf(s); if (idx >= 0) subs.splice(idx, 1); }
  }
  const dosages: Record<string, { mg: number; timing: string }> = {};
  for (const [id, d] of Object.entries(base.dosages)) {
    const mult = mod?.doseMultipliers?.[id] || 1;
    dosages[id] = { mg: Math.round(d.mg * mult), timing: d.timing };
  }
  if (mod) {
    for (const s of mod.addSubs) {
      if (!dosages[s]) dosages[s] = DEFAULT_DOSAGES[s] || { mg: 500, timing: 'с едой' };
    }
  }
  return { ...base, subs, dosages, phaseLabel: mod?.label || 'Курс', phaseEmoji: mod?.emoji || '💉' };
}

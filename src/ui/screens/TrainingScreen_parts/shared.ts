/** shared.ts вЂ” РѕР±С‰РёРµ РєРѕРЅСЃС‚Р°РЅС‚С‹/С‚РёРїС‹ TrainingScreen (РІС‹РЅРµСЃРµРЅРѕ РёР· РјРѕРЅРѕР»РёС‚Р°). */
export const WARMUP_LABELS: Record<string, string> = {
  jumping_jack: 'РџСЂС‹Р¶РєРё Jumping Jack', arm_circles: 'РљСЂСѓРіРё СЂСѓРєР°РјРё', leg_swings: 'РњР°С…Рё РЅРѕРіР°РјРё',
  hip_circle: 'РљСЂСѓРіРё С‚Р°Р·РѕРј', ankle_mobility: 'РњРѕР±РёР»РёР·Р°С†РёСЏ РіРѕР»РµРЅРѕСЃС‚РѕРїР°', shoulder_circle: 'РљСЂСѓРіРё РїР»РµС‡Р°РјРё',
  thoracic_rotation: 'Р РѕС‚Р°С†РёСЏ РіСЂСѓРґРЅРѕРіРѕ РѕС‚РґРµР»Р°', cat_camel: 'РљРѕС€РєР°-РєРѕСЂРѕРІР°', worlds_greatest: 'Р“Р»СѓР±РѕРєРёР№ РІС‹РїР°Рґ СЃ СЂРѕС‚Р°С†РёРµР№',
  banded_clam: 'Р Р°РєСѓС€РєР° СЃ СЂРµР·РёРЅРєРѕР№', external_rotation: 'Р’РЅРµС€РЅСЏСЏ СЂРѕС‚Р°С†РёСЏ РїР»РµС‡Р°', bird_dog: 'Bird-dog',
  dead_bug: 'Dead bug', light_cardio: 'Р›С‘РіРєРѕРµ РєР°СЂРґРёРѕ', squat: 'РџСЂРёСЃРµРґ',
  deep_breathing: 'Р“Р»СѓР±РѕРєРѕРµ РґС‹С…Р°РЅРёРµ', box_breathing: 'РљРІР°РґСЂР°С‚РЅРѕРµ РґС‹С…Р°РЅРёРµ',
};

export const GOALS = [
  { value: 'bulk', label: 'РњР°СЃСЃР°', icon: 'рџ’Є' },
  { value: 'cut', label: 'РЎСѓС€РєР°', icon: 'рџ”Ґ' },
  { value: 'strength', label: 'РЎРёР»Р°', icon: 'рџЏ‹пёЏ' },
  { value: 'maintenance', label: 'РџРѕРґРґРµСЂР¶Р°РЅРёРµ', icon: 'вљ–пёЏ' },
  { value: 'recomp', label: 'Р РµРєРѕРјРїРѕР·РёС†РёСЏ', icon: 'рџ”Ѓ' },
  { value: 'rehab', label: 'Р РµР°Р±РёР»РёС‚Р°С†РёСЏ', icon: 'рџ©№' },
] as const;

export const LEVELS = [
  { value: 'beginner', label: 'РќРѕРІРёС‡РѕРє', icon: 'рџЊ±' },
  { value: 'intermediate', label: 'РЎСЂРµРґРЅРёР№', icon: 'рџ“€' },
  { value: 'advanced', label: 'РћРїС‹С‚РЅС‹Р№', icon: 'рџЏ†' },
  { value: 'enhanced', label: 'Enhanced', icon: 'вљЎ' },
] as const;

export const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
export const GROUP_LABELS: Record<string, string> = {
    chest: 'Р“СЂСѓРґСЊ', back: 'РЎРїРёРЅР°', legs: 'РќРѕРіРё', shoulders: 'РџР»РµС‡Рё', arms: 'Р СѓРєРё', core: 'РљРѕСЂ',
};
export const EQUIP_LABELS: Record<string, string> = { barbell: 'РЁС‚Р°РЅРіР°', dumbbell: 'Р“Р°РЅС‚РµР»Рё', machine: 'РўСЂРµРЅР°Р¶С‘СЂ', cable: 'Р‘Р»РѕРє', bodyweight: 'Р’РµСЃ С‚РµР»Р°', band: 'Р РµР·РёРЅРєР°', kettlebell: 'Р“РёСЂСЏ', specialty_bar: 'РЎРїРµС†РіСЂРёС„' };
export const JOINT_LABELS: Record<string, string> = { high: 'РІС‹СЃРѕРєР°СЏ', med: 'СЃСЂРµРґРЅСЏСЏ', low: 'РЅРёР·РєР°СЏ' };
export const PHASE_LABELS: Record<string, string> = { accumulation: 'РќР°РєРѕРїР»РµРЅРёРµ', intensification: 'РРЅС‚РµРЅСЃРёС„РёРєР°С†РёС†', peaking: 'РџРёРє', deload: 'Р Р°Р·РіСЂСѓР·РєР°' };
export const PHASE_HINTS: Record<string, string> = {
  accumulation: 'Р¤Р°Р·Р° РЅР°РєРѕРїР»РµРЅРёСЏ: СѓРјРµСЂРµРЅРЅР°СЏ РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ, СЂРѕСЃС‚ РѕР±СЉС‘РјР°, РєРѕРЅС‚СЂРѕР»СЊ С‚РµС…РЅРёРєРё Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ.',
  intensification: 'Р¤Р°Р·Р° РёРЅС‚РµРЅСЃРёС„РёРєР°С†РёРё: РІС‹С€Рµ SЂР°Р±РѕС‡РёРµ РІРµСЃР°, РјРµРЅСЊС€Рµ Р»РёС€РЅРµРіРѕ РѕР±СЉС‘РјР°, СЃС‚СЂРѕРіРёР№ РєРѕРЅС‚СЂРѕР»СЊ RPE.',
  peaking: 'РџРёРєРѕРІР°СЏ С„Р°Р·Р°: РїСЂРёРѕСЂРёС‚РµС‚ С‚СЏР¶С‘Р»С‹С… РїРѕРґС…РѕРґРѕРІ, РЅРёР·РєР°СЏ СѓСЃС‚Р°Р»РѕСЃС‚СЊ, Р±РѕР»СЊС€Рµ РѕС‚РґС‹С…Р° РјРµР¶РґСѓ СЃРµСЃСЃРёСЏРјРё.',
  deload: 'Р Р°Р·РіСЂСѓР·РєР°: СЃРЅРёР¶Р°РµРј РѕР±СЉС‘Рј Рё РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ, РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµРј СЃСѓСЃС‚Р°РІС‹ Рё РЅРµСЂРІРЅСѓСЋ СЃРёСЃС‚РµРјСѓ.',
};

export type TrainingTab = 'plan' | 'runtime' | 'exercises' | 'excalc' | 'calculators' | 'diary' | 'cycles' | 'history' | 'analytics' | 'methods' | 'visual' | 'programs' | 'timers' | 'progress' | 'mytraining' | 'programcalc' | 'reports' | 'srcbb' | 'volume' | 'library' | 'powerlifting' | 'bodybuilding';
export type TrainingPage = 'hero' | 'tabs';
export type TrainingGroup = 'training' | 'planning' | 'info' | null;

export const TAB_GROUPS: Record<string, { title: string; icon: string; tabs: TrainingTab[]; color: string }> = {
  training: { title: 'рџЏ‹пёЏ РўСЂРµРЅРёСЂРѕРІРєРё', icon: 'рџЏ‹пёЏ', tabs: ['runtime', 'timers'], color: 'var(--accent)' },
  planning: { title: 'рџ“ђ РџР»Р°РЅРёСЂРѕРІР°РЅРёРµ', icon: 'рџ“ђ', tabs: ['srcbb', 'plan', 'cycles', 'programs', 'mytraining', 'programcalc', 'volume', 'library'], color: '#3b82f6' },
  info: { title: 'рџ“Љ РРЅС„Рѕ', icon: 'рџ“Љ', tabs: ['analytics', 'visual', 'progress', 'exercises', 'excalc', 'calculators', 'diary', 'history', 'reports'], color: '#8b5cf6' },
};

export const TAB_LABELS: Record<TrainingTab, string> = {
  plan: 'рџ“‹ РџР»Р°РЅ С‚СЂРµРЅРёСЂРѕРІРѕРє', runtime: 'в–¶ РџСЂРѕРІРµРґРµРЅРёРµ С‚СЂРµРЅРёСЂРѕРІРєРё', exercises: 'рџЏ‹пёЏ РЈРїСЂР°Р¶РЅРµРЅРёСЏ', calculators: 'рџ“ђ РљР°Р»СЊРєСѓР»СЏС‚РѕСЂС‹',
  diary: 'рџ“ќ Р”РЅРµРІРЅРёРє С‚СЂРµРЅРёСЂРѕРІРѕРє', cycles: 'рџ”„ Р¦РёРєР»С‹', history: 'рџ“њ РСЃС‚РѕСЂРёСЏ С‚СЂРµРЅРёСЂРѕРІРѕРє', analytics: 'рџ“Љ РђРЅР°Р»РёС‚РёРєР°',
  methods: 'рџ§  РњРµС‚РѕРґРёРєРё', visual: 'рџ“€ Р’РёР·СѓР°Р»РёР·Р°С†РёСЏ', programs: 'рџ“љ РџСЂРѕРіСЂР°РјРјС‹', timers: 'вЏ± РўР°Р№РјРµСЂС‹ РѕС‚РґС‹С…Р°',
  progress: 'рџ“Џ РџСЂРѕРіСЂРµСЃСЃ', mytraining: 'в­ђ РњРѕРё С‚СЂРµРЅРёСЂРѕРІРєРё', programcalc: 'рџ› пёЏ Р СѓС‡РЅРѕР№ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ', excalc: 'рџ§® РљР°Р»СЊРєСѓР»СЏС‚РѕСЂ СѓРїСЂР°Р¶РЅРµРЅРёР№', volume: 'рџ“ђ Р Р°СЃС‡С‘С‚ РѕР±СЉС‘РјР° Рё РѕРїС‚РёРјРёР·Р°С†РёСЏ',
  reports: 'рџ“„ РћС‚С‡С‘С‚С‹',
  srcbb: 'рџЏ† РЎРёР»РѕРІРѕР№ С†РёРєР» / Р‘РѕРґРёР±РёР»РґРёРЅРі',
  library: 'рџ“љ Р‘РёР±Р»РёРѕС‚РµРєР°',
  powerlifting: 'рџ’† Пауэрлифтинг',
  bodybuilding: 'рџ’‹пёЏ Бодибилдинг',
};

// в”Ђв”Ђ Р­С‚Р°Рї R/U: 3 РїР»РѕСЃРєРёРµ С‚СЂР°СЃСЃС‹ РїР»Р°РЅРёСЂРѕРІС‰РёРєР° (РџР› / Р‘Р‘ / Р СѓС‡РЅРѕР№ СЃР±РѕСЂ), РѕРґРЅР° РІРєР»Р°РґРєР° вЂ” РѕРґРёРЅ РєР»РёРє.
//   pl    в†’ РџР› (СЃРёР»Р°, РЎР Р¦-Р°РІС‚Рѕ)        в†’ SRCBBScreen track='pl'
//   bb    в†’ Р‘Р‘ (Р±РѕРґРёР±РёР»РґРёРЅРі, Р°РІС‚Рѕ)     в†’ SRCBBScreen track='bb'
//   manualв†’ Р СѓС‡РЅРѕР№ СЃР±РѕСЂ (РїР»Р°РЅ/С†РёРєР»С‹/РїСЂРѕРіСЂР°РјРјС‹/РјРµС‚РѕРґРёРєРё/РєР°Р»СЊРєСѓР»СЏС‚РѕСЂ)
export type PlanningTrack = 'pl' | 'bb' | 'manual';
const PT_KEY = 'he_training_planning_track';
export function getPlanningTrack(): PlanningTrack {
  try { const v = localStorage.getItem(PT_KEY); return v === 'manual' || v === 'bb' ? v : 'pl'; } catch { return 'pl'; }
}
export function setPlanningTrack(t: PlanningTrack): void {
  try { localStorage.setItem(PT_KEY, t); } catch { /* ignore */ }
}
export const PL_PLANNING_TABS: TrainingTab[] = ['srcbb', 'volume', 'powerlifting'];
export const BB_PLANNING_TABS: TrainingTab[] = ['srcbb', 'volume', 'bodybuilding'];
export const MANUAL_PLANNING_TABS: TrainingTab[] = ['plan', 'cycles', 'programs', 'mytraining', 'programcalc', 'volume', 'library', 'powerlifting', 'bodybuilding'];
export function planningTabsFor(track: PlanningTrack): TrainingTab[] {
  if (track === 'manual') return MANUAL_PLANNING_TABS;
  return track === 'bb' ? BB_PLANNING_TABS : PL_PLANNING_TABS;
}
// Р‘СЌРєРІРѕСЂРґ-СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ (СЃС‚Р°СЂС‹Р№ РёРјРїРѕСЂС‚ PlanningMode)
export type PlanningMode = PlanningTrack;
export const getPlanningMode = getPlanningTrack;
export const setPlanningMode = (m: string) => setPlanningTrack(m === 'constructor' ? 'manual' : m === 'src_auto' ? 'pl' : 'pl');

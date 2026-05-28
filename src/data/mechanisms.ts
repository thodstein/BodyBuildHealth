export interface Mechanism {
  id: string;
  name: string;
  systemsUp: string[];
  systemsDown: string[];
  effectsPositive: string[];
  effectsNegative: string[];
}

export const MECHANISMS_DB: Mechanism[] = [
  { id: "GABA_UP", name: "Повышение GABA", systemsUp: ["BRAIN"], systemsDown: [], effectsPositive: ["BRAIN_ANXIETY_DOWN"], effectsNegative: ["BRAIN_ANXIETY"] },
  { id: "GABA_DOWN", name: "Снижение GABA", systemsUp: [], systemsDown: ["BRAIN"], effectsPositive: [], effectsNegative: ["BRAIN_SLEEP_ISSUES"] },
  { id: "SEROTONIN_UP", name: "Повышение серотонина", systemsUp: ["BRAIN", "GUT"], systemsDown: [], effectsPositive: ["BRAIN_DEPRESSION_DOWN"], effectsNegative: ["BRAIN_DEPRESSION"] },
  { id: "SEROTONIN_DOWN", name: "Снижение серотонина", systemsUp: [], systemsDown: ["BRAIN"], effectsPositive: [], effectsNegative: ["BRAIN_SLEEP_ISSUES"] },
  { id: "DOPAMINE_UP", name: "Повышение дофамина", systemsUp: ["BRAIN"], systemsDown: [], effectsPositive: ["BRAIN_FOG_DOWN"], effectsNegative: ["BRAIN_FOG"] },
  { id: "DOPAMINE_DOWN", name: "Снижение дофамина", systemsUp: [], systemsDown: ["BRAIN"], effectsPositive: [], effectsNegative: ["BRAIN_MOTIVATION_LOW"] },
  { id: "CORTISOL_UP", name: "Повышение кортизола", systemsUp: ["ADRENALS"], systemsDown: ["BRAIN", "GUT"], effectsPositive: [], effectsNegative: ["HORMONE_LOW_T"] },
  { id: "CORTISOL_DOWN", name: "Снижение кортизола", systemsUp: ["BRAIN", "ADRENALS"], systemsDown: [], effectsPositive: [], effectsNegative: [] },
  { id: "T3_T4_UP", name: "Повышение щитовидных гормонов", systemsUp: ["THYROID", "LIVER"], systemsDown: [], effectsPositive: [], effectsNegative: ["HORMONE_HYPER"] },
  { id: "T3_T4_DOWN", name: "Снижение щитовидных гормонов", systemsUp: [], systemsDown: ["THYROID"], effectsPositive: [], effectsNegative: [] },
  { id: "GLUCOSE_UP", name: "Повышение глюкозы", systemsUp: [], systemsDown: ["PANCREAS"], effectsPositive: [], effectsNegative: ["INSULIN_RESISTANCE"] },
  { id: "GLUCOSE_DOWN", name: "Снижение глюкозы", systemsUp: ["PANCREAS"], systemsDown: [], effectsPositive: [], effectsNegative: [] },
  { id: "LIPIDS_UP", name: "Повышение липидов", systemsUp: [], systemsDown: ["HEART"], effectsPositive: [], effectsNegative: ["HEART_ATHEROSCLEROSIS"] },
  { id: "LIPIDS_DOWN", name: "Снижение липидов", systemsUp: ["HEART"], systemsDown: [], effectsPositive: [], effectsNegative: [] },
  { id: "INFLAMMATION_UP", name: "Повышение воспаления", systemsUp: [], systemsDown: ["ALL"], effectsPositive: [], effectsNegative: ["ALL_DISEASE"] },
  { id: "INFLAMMATION_DOWN", name: "Снижение воспаления", systemsUp: ["ALL"], systemsDown: [], effectsPositive: [], effectsNegative: [] },
  { id: "OXIDATIVE_UP", name: "Повышение оксидативного стресса", systemsUp: [], systemsDown: ["ALL"], effectsPositive: [], effectsNegative: ["AGING"] },
  { id: "OXIDATIVE_DOWN", name: "Снижение оксидативного стресса", systemsUp: ["ALL"], systemsDown: [], effectsPositive: [], effectsNegative: [] },
  { id: "DETOX_UP", name: "Ускорение детокса", systemsUp: ["LIVER"], systemsDown: [], effectsPositive: [], effectsNegative: ["LIVER_TOXICITY"] },
  { id: "DETOX_DOWN", name: "Замедление детокса", systemsUp: [], systemsDown: ["LIVER"], effectsPositive: [], effectsNegative: [] },
  { id: "BILE_FLOW_UP", name: "Улучшение желчи", systemsUp: ["LIVER", "GI"], systemsDown: [], effectsPositive: [], effectsNegative: ["LIVER_CHOLESTASIS"] },
  { id: "BILE_FLOW_DOWN", name: "Снижение желчи", systemsUp: [], systemsDown: ["GI"], effectsPositive: [], effectsNegative: ["GI_DYSBIOSIS"] },
  { id: "MICROBIOME_UP", name: "Улучшение микробиоты", systemsUp: ["GI"], systemsDown: [], effectsPositive: [], effectsNegative: ["IMMUNE_AUTOIMMUNE"] },
  { id: "MICROBIOME_DOWN", name: "Ухудшение микробиоты", systemsUp: [], systemsDown: ["GI"], effectsPositive: [], effectsNegative: ["IMMUNE_AUTOIMMUNE"] },
  { id: "NO_UP", name: "Повышение NO", systemsUp: ["HEART"], systemsDown: [], effectsPositive: [], effectsNegative: ["ERECTION_UP"] },
  { id: "NO_DOWN", name: "Снижение NO", systemsUp: [], systemsDown: ["HEART"], effectsPositive: [], effectsNegative: ["ERECTION_DOWN"] },
  { id: "CARDIO_UP", name: "Повышение нагрузки на сердце", systemsUp: [], systemsDown: ["HEART"], effectsPositive: [], effectsNegative: ["HEART_FAILURE"] },
  { id: "CARDIO_DOWN", name: "Снижение нагрузки на сердце", systemsUp: ["HEART"], systemsDown: [], effectsPositive: [], effectsNegative: [] },
  { id: "COAG_UP", name: "Повышение свёртываемости", systemsUp: [], systemsDown: ["BLOOD"], effectsPositive: [], effectsNegative: ["BLOOD_THICK"] },
  { id: "COAG_DOWN", name: "Снижение свёртываемости", systemsUp: ["BLOOD"], systemsDown: [], effectsPositive: [], effectsNegative: [] },
  { id: "GUT_UP", name: "Улучшение ЖКТ", systemsUp: ["GI"], systemsDown: [], effectsPositive: [], effectsNegative: ["GI_REFLUX"] },
  { id: "GUT_DOWN", name: "Снижение функции ЖКТ", systemsUp: [], systemsDown: ["GI"], effectsPositive: [], effectsNegative: ["GI_DYSBIOSIS"] },
  { id: "IMMUNE_UP", name: "Повышение иммунитета", systemsUp: ["IMMUNE_SYSTEM"], systemsDown: [], effectsPositive: [], effectsNegative: ["AUTOIMMUNE_UP"] },
  { id: "IMMUNE_DOWN", name: "Снижение иммунитета", systemsUp: [], systemsDown: ["IMMUNE_SYSTEM"], effectsPositive: [], effectsNegative: ["INFECTION_RISK"] },
  { id: "ENERGY_UP", name: "Повышение энергии", systemsUp: ["ALL"], systemsDown: [], effectsPositive: [], effectsNegative: ["FATIGUE"] },
  { id: "ENERGY_DOWN", name: "Снижение энергии", systemsUp: [], systemsDown: ["ALL"], effectsPositive: [], effectsNegative: ["LOW_ENERGY"] }
];
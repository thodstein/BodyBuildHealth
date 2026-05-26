export const GLOSSARY: Record<string, { def: string; unit?: string; link?: string }> = {
  RIR: { def: 'Repetitions In Reserve – повторения "в запасе" до технического отказа.', link: '#training-rir' },
  Hct: { def: 'Гематокрит – объёмная доля эритроцитов в крови.', unit: '%', link: '#labs-hct' },
  MRV: { def: 'Maximum Recoverable Volume – максимальный переносимый объём за неделю.', unit: 'сеты/нед', link: '#training-mrv' },
  HRV: { def: 'Heart Rate Variability – вариабельность сердечного ритма.', unit: 'мс', link: '#readiness-hrv' },
  EC50: { def: 'Концентрация, при которой достигается 50% максимального фармакодинамического эффекта.', unit: 'нМ/мг/мл', link: '#pharma-pd' },
  TDEE: { def: 'Total Daily Energy Expenditure – общий суточный расход энергии.', unit: 'ккал', link: '#nutrition-tdee' },
  PAL: { def: 'Physical Activity Level – коэффициент физической активности (1.2–1.9).', link: '#nutrition-pal' },
  IF: { def: 'Индекс фертильности – интегральный показатель по WHO 2021.', unit: '%', link: '#fertility-if' },
  Raw: { def: 'Базовый риск без учёта поддержки.', unit: '%', link: '#risk-raw' },
  Net: { def: 'Сниженный риск после применения стека поддержки.', unit: '%', link: '#risk-net' }
};

export function getTooltip(term: string): string | null {
  const t = term.toUpperCase();
  const entry = GLOSSARY[t] || Object.entries(GLOSSARY).find(([k]) => k.toLowerCase().includes(t.toLowerCase()))?.[1];
  return entry ? `${entry.def}${entry.unit ? ` [${entry.unit}]` : ''}` : null;
}
/**
 * support-hub-aas.engine.ts — P8: честный AAS-гейт.
 * Заменяет хрупкий regex из SupportBioavailability (имена метан/данабол/...)
 * на канон: сначала класс/категория через resolvePedAlias-подобный маппинг,
 * имена — только fallback. Ничего не выдумывает: неизвестное = не AAS.
 */

const AAS_CLASSES = new Set([
  'testosterone', 'trenbolone', 'nandrolone', 'boldenone', 'primobolan',
  'oral_17aa', 'drostanolone', 'dht_inject', 'dht_derivative', 'sarm', 'sarm_s23', 'sarms',
  'anabolic', 'androgen', 'aas_derivative', 'steroidal',
]);

const AAS_NAME_FALLBACK = [
  'тестостерон', 'сустанон', 'омнадрен', 'sustanon', 'omnadren', 'нандролон',
  'тренболон', 'болденон', 'станозолол', 'оксандролон', 'метандростенолон',
  'метандиенон', 'туринабол', 'мастерон', 'примоболан', 'метенолон',
  'дростанолон', 'анаполон', 'оксиметолон', 'провирон', 'местеролон',
];

export function isAASHonest(category: string[], nameRu: string, nameEn: string): { isAAS: boolean; reason: string } {
  const cats = (category || []).map(c => String(c).toLowerCase());
  const hitClass = cats.find(c => AAS_CLASSES.has(c));
  if (hitClass) return { isAAS: true, reason: `класс ${hitClass}` };
  const t = `${nameRu || ''} ${nameEn || ''}`.toLowerCase();
  // «метан/данабол» как отдельные слова, а не подстроки (иначе ловит «метаболизм»).
  if (/\bметан\b|\bданабол\b|\bметандростенолон\b|\bметандиенон\b/.test(t)) {
    return { isAAS: true, reason: 'имя из AAS-словаря (точное слово)' };
  }
  const hitName = AAS_NAME_FALLBACK.find(k => t.includes(k));
  if (hitName) return { isAAS: true, reason: `имя содержит «${hitName}»` };
  return { isAAS: false, reason: 'класс и имя вне AAS-словаря' };
}

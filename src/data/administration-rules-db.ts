// ════════════════════════════════════════════════════════════════════
//  administration-rules-db.ts — особые указания по приёму (схема,
//  время суток, условия) для критичных препаратов + обоснование.
//  Отображается в карточке «💊 Особые указания по приёму» калькулятора.
// ════════════════════════════════════════════════════════════════════

export interface AdministrationRule {
  substanceId: string;
  timing: string;
  reason: string;
  critical?: boolean;
}

export const ADMINISTRATION_RULES_DB: AdministrationRule[] = [
  { substanceId: 'nattokinase', timing: 'только утром натощак (за 30-60 мин до еды)', reason: 'фибринолитическая активность максимальна натощак; еда ↓ всасывание и активность; вечером — риск кровоточивости ночью' },
  { substanceId: 'serrapeptase', timing: 'только утром натощак', reason: 'протеаза: натощак максимум абсорбции и активности; с едой разрушается' },
  { substanceId: 'bromelain', timing: 'натощак (за 30-60 мин до еды), утром/днём', reason: 'протеолитическая активность натощак; не сочетать с антикоагулянтами в один приём' },
  { substanceId: 'aspirin', timing: 'утром с едой (кардио-доза 100 мг)', reason: 'снижение ЖКТ-раздражения; не натощак при гастрите' },
  { substanceId: 'magnesium_l_threonate', timing: 'перед сном', reason: 'Mg-L-треонат ↑ сон и GABA-эргическую регуляцию; днём — сонливость' },
  { substanceId: 'glycine', timing: 'на ночь (за 30 мин до сна)', reason: 'ингибирующий нейромедиатор — улучшение засыпания' },
  { substanceId: 'theanine', timing: 'днём или вечером (при тревоге — перед сном)', reason: 'расслабление без седации; не утром, если нужен тонус' },
  { substanceId: 'cordyceps', timing: 'утром или днём', reason: 'тонизирующий/адаптогенный эффект; вечером нарушает сон' },
  { substanceId: 'hesperidin', timing: 'утром или в обед', reason: 'венотонус днём (при вертикальном положении); вечером — меньше смысла' },
  { substanceId: 'pycnogenol', timing: 'утром или в обед', reason: 'сосудистый тонус и эндотелий днём' },
  { substanceId: 'dandelion', timing: 'утром', reason: 'мягкий диуретик — не нарушать ночной сон; контроль K⁺' },
  { substanceId: 'spironolactone', timing: 'утром (однократно)', reason: 'диуретик: вечерний приём нарушает сон; контроль K⁺/АД' },
  { substanceId: 'hydrochlorothiazide', timing: 'утром', reason: 'диуретик — вечером нарушает сон и риск гипотензии ночью' },
  { substanceId: 'indapamide', timing: 'утром', reason: 'диуретик — вечером нарушает сон' },
  { substanceId: 'tadalafil', timing: 'утром (эффект до 36 ч)', reason: 'вазодилатация днём; вечером — возможная гипотензия и головная боль ночью' },
  { substanceId: 'telmisartan', timing: 'утром (стабильно в одно время)', reason: 'контроль АД в течение дня; пропуск → принять, но не удваивать' },
  { substanceId: 'nebivolol', timing: 'утром', reason: 'ЧСС/АД контроль днём; вечером — брадикардия и плохой сон' },
  { substanceId: 'anastrozole', timing: 'в одно и то же время (утро/вечер — стабильно)', reason: 'ровный уровень ингибирования ароматазы' },
  { substanceId: 'hcg', timing: 'утром/днём (инъекция)', reason: 'стабильная стимуляция Лейдига; вечерние инъекции не хуже, но удобнее днём' },
  { substanceId: 'tudca', timing: '2 раза в день с едой', reason: 'желчеотток после еды; разделить на утро+вечер' },
  { substanceId: 'nac', timing: '2 раза в день с едой (утро+вечер)', reason: 'глутатион-поддержка стабильно; не натощак (ЖКТ)' },
  { substanceId: 'milk_thistle', timing: 'с едой 2-3 раза в день', reason: 'силимарин — с едой для абсорбции; разнести с тадалафилом/анастрозолом ≥2 ч (CYP3A4)' },
  { substanceId: 'omega3', timing: 'с едой (содержащей жир)', reason: 'жир ↑ всасывание EPA/DHA' },
  { substanceId: 'coq10', timing: 'с едой (жир)', reason: 'липофильный — всасывание с жиром' },
  { substanceId: 'vitamin_d3', timing: 'с едой (жир), утром/днём', reason: 'жир ↑ всасывание D3; вечером может мешать сну у чувствительных' },
  { substanceId: 'iron', timing: 'натощак с витамином C; отдельно от кальция/цинка/магния ≥2 ч', reason: 'C ↑ всасывание железа; кальций/цинк/магний ↓ его' },
  { substanceId: 'calcium', timing: 'вечером (или отдельно от железа ≥4 ч)', reason: 'кальций всасывается лучше ночью; не вместе с железом' },
  { substanceId: 'zinc', timing: 'вечером, отдельно от железа/кальция ≥2 ч', reason: 'цинк конкурирует с железом и медью' },
  { substanceId: 'magnesium', timing: 'вечером/перед сном', reason: 'расслабление мышц и сон; не вместе с железом' },
  { substanceId: 'curcumin', timing: 'с едой (с пиперином)', reason: 'куркумин плохо всасывается; пиперин ↑ биодоступность; разнести с аспирином ≥2 ч' },
  { substanceId: 'berberine', timing: 'с едой 2-3 раза в день', reason: 'глюкоза после еды; не натощак (ЖКТ); контроль глюкозы с инсулином/GH' },
  { substanceId: 'metformin', timing: 'с едой (утро+вечер)', reason: 'ЖКТ-переносимость; стабильный уровень' },
  { substanceId: 'collagen', timing: 'натощак или перед сном', reason: 'пептиды коллагена лучше всасываются натощак; вечером — восстановление тканей' },
  { substanceId: 'ashwagandha', timing: 'вечером', reason: 'снижение кортизола и сон; утром — сонливость' },
  { substanceId: 'rhodiola', timing: 'утром', reason: 'адаптоген-стимулятор; вечером нарушает сон' },
  { substanceId: 'coffee', timing: 'утром, не позднее 14:00', reason: 'кофеин — сон; не с железом (↓ всасывание)' },
  { substanceId: 'creatine', timing: 'любое время, стабильно ежедневно', reason: 'насыщение мышц; приём с углеводами ↑ усвоение' },
  { substanceId: 'bpc157', timing: 'натощак или за 30 мин до еды', reason: 'пептидная абсорбция натощак; стабильное время' },
  { substanceId: 'tb500', timing: 'инъекция, стабильное время (утро/день)', reason: 'стабильный уровень тимозина' },
  { substanceId: 'ghk_cu', timing: 'вечером перед сном', reason: 'восстановление тканей ночью; медиаторный эффект' },
];

/** Правила для веществ плана (по базе). */
export function getAdministrationRules(planIds: string[]): AdministrationRule[] {
  const ids = new Set(planIds.map(id => id.toLowerCase()));
  return ADMINISTRATION_RULES_DB.filter(r => ids.has(r.substanceId));
}

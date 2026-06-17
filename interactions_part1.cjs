const fs = require('fs');

// Part 1: Define interaction data for all 284 substances
const INTERACTIONS = {
  // CORE TIER
  nac: {
    synergies: [
      {with:"vitamin_c",effect:"Регенерация глутатиона",mechanism:"Витамин C восстанавливает окисленный глутатион",severity:"HIGH"},
      {with:"alpha_lipoic",effect:"Усиление антиоксидантной сети",mechanism:"АЛЬК регенерирует глутатион и витамин C",severity:"HIGH"},
      {with:"selenium",effect:"Глутатионпероксидаза",mechanism:"Селен — кофактор GPx",severity:"MEDIUM"},
      {with:"milk_thistle",effect:"Синергия гепатопротекции",mechanism:"Разные механизмы защиты гепатоцитов",severity:"MEDIUM"},
      {with:"glutathione",effect:"Максимальный антиоксидантный каскад",mechanism:"NAC — предшественник глутатиона",severity:"HIGH"},
      {with:"coq10",effect:"Защита митохондрий",mechanism:"NAC снижает окислительный стресс, CoQ10 — переносчик электронов",severity:"MEDIUM"}
    ],
    conflicts: [
      {with:"charcoal",effect:"Снижение абсорбции",mechanism:"Активированный уголь связывает NAC",severity:"MEDIUM"},
      {with:"nitroglycerin",effect:"Усиление вазодилатации",mechanism:"NAC потенцирует эффекты нитратов",severity:"LOW"}
    ]
  },
  tudca: {
    synergies: [
      {with:"milk_thistle",effect:"Комплексная гепатопротекция",mechanism:"Силимарин + желчные кислоты — разные пути защиты",severity:"HIGH"},
      {with:"nac",effect:"Максимальная защита печени",mechanism:"TUDCA защищает желчные пути, NAC — антиоксидант",severity:"HIGH"},
      {with:"curcumin",effect:"Против холестаза",mechanism:"Куркумин снижает воспаление желчных путей",severity:"MEDIUM"},
      {with:"betaine",effect:"Метилирование и желчеотток",mechanism:"Бетаин поддерживает метилирование, TUDCA — желчеотток",severity:"MEDIUM"},
      {with:"artichoke",effect:"Усиление желчеоттока",mechanism:"Оба стимулируют продукцию и отток желчи",severity:"MEDIUM"}
    ],
    conflicts: [{with:"charcoal",effect:"Снижение абсорбции",mechanism:"Уголь связывает желчные кислоты",severity:"LOW"}]
  },
  magnesium: {
    synergies: [
      {with:"vitamin_d3",effect:"Усиление активности витамина D",mechanism:"Магний — кофактор для активации витамина D",severity:"HIGH"},
      {with:"vitamin_b6",effect:"Улучшение всасывания магния",mechanism:"B6 повышает внутриклеточное проникновение Mg",severity:"HIGH"},
      {with:"taurine",effect:"Кардиопротекция",mechanism:"Оба снижают возбудимость миокарда",severity:"MEDIUM"},
      {with:"zinc",effect:"Нейропротекция",mechanism:"Оба участвуют в работе GABA-рецепторов",severity:"MEDIUM"},
      {with:"theanine",effect:"Улучшение сна и расслабление",mechanism:"Оба усиливают GABA-активность",severity:"MEDIUM"},
      {with:"vitamin_k2",effect:"Метаболизм кальция",mechanism:"Mg+K2 направляют кальций в кости",severity:"MEDIUM"},
      {with:"omega3",effect:"Противовоспалительное действие",mechanism:"Оба снижают маркеры воспаления",severity:"LOW"}
    ],
    conflicts: [
      {with:"calcium",effect:"Снижение абсорбции магния",mechanism:"Конкуренция за транспортные каналы",severity:"MEDIUM"},
      {with:"iron",effect:"Снижение абсорбции железа",mechanism:"Магний конкурирует за всасывание с железом",severity:"LOW"}
    ]
  },
  coq10: {
    synergies: [
      {with:"omega3",effect:"Кардиопротекция",mechanism:"Оба защищают мембраны кардиомиоцитов",severity:"HIGH"},
      {with:"alpha_lipoic",effect:"Регенерация CoQ10",mechanism:"АЛЬК восстанавливает окисленный CoQ10",severity:"HIGH"},
      {with:"selenium",effect:"Антиоксидантная сеть",mechanism:"GPx + CoQ10 — каскадная защита",severity:"MEDIUM"},
      {with:"vitamin_e",effect:"Защита мембран",mechanism:"CoQ10 регенерирует витамин E",severity:"MEDIUM"},
      {with:"pqq",effect:"Митохондриальный биогенез",mechanism:"PQQ стимулирует новые митохондрии, CoQ10 — энергия",severity:"HIGH"},
      {with:"shilajit",effect:"Усиление синтеза АТФ",mechanism:"Мумиё повышает биодоступность CoQ10",severity:"MEDIUM"}
    ],
    conflicts: [{with:"statin_drugs",effect:"Дефицит CoQ10",mechanism:"Статины блокируют синтез CoQ10",severity:"HIGH"}]
  }
};

module.exports = INTERACTIONS;

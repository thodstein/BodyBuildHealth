interface QAPair { q: string; a: string; tags: string[]; }
const QA_DB: QAPair[] = [
  { q:'Как снизить пролактин на тренболоне?', a:'Контроль PRL каждые 2 нед. При >25 нг/мл – каберголин 0.25 мг 2р/нед. Ашваганда+L-теанин снижают стресс-индуцированный всплеск.', tags:['prolactin','tren','cabergoline'] },
  { q:'Что делать, если гематокрит 55%?', a:'Срочно отменить железо/тестостерон. Провести эксфузию 400 мл. Добавить пентоксифиллин 400 мг 2р/день. Контроль ОАК через 7 дней.', tags:['hct','donation','pentoxifylline'] },
  { q:'Нужно ли чистить печень после курса оралов?', a:'Оральный ААС уже создал нагрузку. Поддержка: NAC 1200 мг + TUDCA 1000 мг 8 нед. ALT/AST контролируют каждые 2 нед.', tags:['liver','oral','nac','tudca'] },
  { q:'Какая доза телмисартана для профилактики?', a:'40 мг/день утром. При АД >130/85 – 80 мг. Ограничить калий до 3 г/день. Комбинировать с омега-3 для эндотелиальной защиты.', tags:['telmisartan','bp','prevention'] },
  { q:'Как восстановить тестостерон после курса?', a:'ПКТ: кломифен 50→25 мг/день 4 нед + HCG 1000 МЕ через день первые 14 дн. Цинк 30 мг, селен 100 мкг, вит.E 400 МЕ. Контроль TT/LH/FSH через 6 нед.', tags:['pct','clomiphene','hcg','recovery'] },
  { q:'Как правильно делать ЭХО-КГ на курсе?', a:'Базовое ЭхоКГ до курса, далее каждые 12-16 нед. Следить за EF%, ЛЖМ, диастоликой. При снижении EF<50% или росте ЛЖМ>140г – снизить дозу/добавить поддержку.', tags:['echo','cardio','monitoring'] },
  { q:'Что означает RIR в тренировках?', a:'RIR (Repetitions in Reserve) – количество повторений «в запасе» до отказа. RIR 2 = вы можете сделать ещё 2 повторения. Для гипертрофии оптимален RIR 1-3, для силы – RIR 0-2.', tags:['rir','training','intensity'] },
  { q:'Как рассчитать TDEE?', a:'TDEE = BMR × коэффициент активности. Сидячий образ жизни: ×1.2, лёгкая активность: ×1.375, средняя: ×1.55, высокая: ×1.725. BMR рассчитывается по формуле Миффлина: 10×вес(кг) + 6.25×рост(см) – 5×возраст + 5 (мужчины) / –161 (женщины).', tags:['tdee','bmr','calories','metabolism'] },
  { q:'Что такое HOMA-IR и как интерпретировать?', a:'HOMA-IR = (глюкоза натощак ммоль/л × инсулин мкЕд/мл) / 22.5. Значение >2.5 указывает на инсулинорезистентность. >3.0 – выраженная ИР. Коррекция: низкоуглеводная диета, силовые тренировки, метформин при назначении врача.', tags:['homa-ir','insulin','resistance','glucose'] },
  { q:'Зачем контролировать ферритин на курсе?', a:'Ферритин – белок-депо железа. Норма 30-300 мкг/л. На ААС может расти из-за гематокрита. <30 = дефицит железа (усталость, слабость). >500 = риск перегрузки. Контроль каждые 6-8 нед. При снижении – железо + вит.С, при повышении – донация.', tags:['ferritin','iron','donation','aas'] },
  { q:'Какой холестерин опасен на курсе?', a:'На ААС растёт ЛПНП («плохой») и падает ЛПВП («хороший»). Коэффициент атерогенности = (ОХ – ЛПВП)/ЛПВП. Норма <3. >4 – высокий риск. Приём: омега-3 3г/день, цетроп 5мг/день, телмисартан 40мг, чеснок 2г. Контроль каждые 4-6 нед.', tags:['cholesterol','ldl','hdl','cardiovascular'] },
  { q:'Что такое ГСПГ и зачем его контролировать?', a:'ГСПГ (глобулин, связывающий половые гормоны) связывает тестостерон. Свободный тестостерон ≈2% от общего. На оралах ГСПГ падает → растёт свободный Т, на трене – тоже. Высокий ГСПГ = мало свободного Т. Низкий ГСПГ = риск эстрогенной конверсии.', tags:['shbg','gspg','testosterone','free','binding'] },
  { q:'Зачем нужен eGFR и когда беспокоиться?', a:'eGFR – расчётная скорость клубочковой фильтрации почек. Норма >90 мл/мин/1.73м². 60-89 – лёгкое снижение, <60 – хроническая болезнь почек. На ААС контроль каждые 8-12 нед. Поддержка: NAC, достаточное питьё (40мл/кг), контроль АД.', tags:['egfr','kidney','gfr','renal'] },
  { q:'Как проводится ПКТ после длинных эфиров?', a:'ПКТ начинается через 14-18 дней после последней инъекции длинного эфира (тестостерон энантат). Схема: кломифен 50мг/день 2 нед → 25мг/день 2 нед. HCG 1000МЕ через день 14 дней до ПКТ. Тамоксифен 10мг/день как альтернатива. Контроль гормонов через 3-4 нед.', tags:['pct','clomiphene','hcg','enanthate','recovery'] },
  { q:'Что делать при эстрогенных побочных эффектах?', a:'При гинекомастии/задержке воды: анастразол 0.25-0.5 мг 2р/нед. Не снижать эстроген ниже нормы – суставы и либидо страдают. Цель: эстрадиол в референсе. Контроль каждые 2-3 нед. При развившейся гинекомастии – тамоксифен 20мг/день.', tags:['estrogen','aromatase','arimidex','gyno'] },
  { q:'Как контролировать уровень пролактина?', a:'Пролактин контролируется каждые 2-4 нед на 19-нор ААС (тренболон, нандролон). Норма: муж. 2-15 нг/мл. При >25 – каберголин 0.25мг 2р/нед. Ашваганда 600мг/день + L-теанин 200мг снижают стресс-индуцированный PRL.', tags:['prolactin','cabergoline','tren','nandrolone'] },
  { q:'Какая поддержка сердца нужна на курсе?', a:'База: телмисартан 40мг/день, омега-3 3г/день, коэнзим Q10 200мг, цитруллин 6г/день. При АД >130/85 – увеличить телмисартан до 80мг. ЭхоКГ до и каждые 12 нед. Рибоксин 200мг 3р/день как кардиопротектор.', tags:['heart','cardio','telmisartan','bp','support'] },
  { q:'Зачем измерять гематокрит и что делать при 54%+?', a:'Гематокрит >54% – критический уровень. Риск тромбов, инсульта. Действия: прекратить железо и ААС, эксфузия/кроводача 450мл, пентоксифиллин 400мг 2р/день, аспирин 100мг/день. Обильное питьё. Повторный ОАК через 7 дней.', tags:['hct','hematocrit','donation','thrombosis'] },
  { q:'Как рассчитать EC50 препарата?', a:'EC50 – концентрация, при которой достигается 50% максимального эффекта. Определяется по кривой доза-ответ. Для ААС: эмпирически, по отзывам и исследованиям. Тестостерон EC50 ≈ 100мг/нед, тренболон EC50 ≈ 30-50мг/нед. Модель Хилла: E = Emax × C^n/(EC50^n + C^n).', tags:['ec50','dose-response','pharmacology','hill'] }
];

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(w => w.length > 2);
}

function tfidf(query: string, db: QAPair[]): { q: string; a: string; score: number }[] {
  const qTokens = tokenize(query);
  if (!qTokens.length) return [];
  
  const corpus = db.map(d => tokenize(d.q + ' ' + d.tags.join(' ') + ' ' + d.a));
  const idf: Record<string, number> = {};
  corpus.forEach(doc => new Set(doc).forEach(t => { idf[t] = (idf[t] || 0) + 1; }));
  Object.keys(idf).forEach(t => idf[t] = Math.log(db.length / (idf[t] + 1)));

  return db.map((item, i) => {
    const docTokens = corpus[i];
    const score = qTokens.reduce((s, t) => {
      const tf = docTokens.filter(x => x === t).length / docTokens.length;
      return s + (tf * (idf[t] || 0));
    }, 0);
    return { q: item.q, a: item.a, score };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
}

export interface UserContext {
  risks?: { overall: number; systems?: Record<string, number> };
  readiness?: { recovery: number; fatigue: number; nutrition: number };
  courseSubstances?: string[];
  labAlerts?: { marker: string; status: string }[];
  goal?: string;
}

export interface AssistantResponse {
  text: string;
}

function buildContextualAdvice(ctx: UserContext): string[] {
  const advice: string[] = [];
  if (ctx.risks) {
    if (ctx.risks.overall > 60) advice.push('⚠️ Общий риск высокий (' + Math.round(ctx.risks.overall) + '%). Рекомендуется пересмотреть дозировки и усилить поддержку.');
    if (ctx.risks.systems) {
      const topSystem = Object.entries(ctx.risks.systems).sort(([,a],[,b]) => b - a)[0];
      if (topSystem && topSystem[1] > 50) advice.push(`🔴 Наибольший риск: ${SYSTEM_LABELS[topSystem[0]] ?? topSystem[0]} (${Math.round(topSystem[1])}%). Уделите внимание профилактике.`);
    }
  }
  if (ctx.readiness) {
    if (ctx.readiness.recovery < 40) advice.push('🛑 Восстановление критически низкое (<40%). Рекомендуется делоад и снижение объёма тренировок.');
    if (ctx.readiness.fatigue > 70) advice.push('💤 Усталость высокая (>70%). Проверьте сон, питание и при необходимости снизьте интенсивность.');
    if (ctx.readiness.nutrition < 50) advice.push('🥗 Питание недостаточное (<50%). Проверьте калорийность и белок.');
  }
  if (ctx.courseSubstances && ctx.courseSubstances.length > 0) {
    const orals = ctx.courseSubstances.filter(s => s.includes('methand') || s.includes('oxan') || s.includes('stan') || s.includes('superdrol') || s.includes('anadrol') || s.includes('halo') || s.includes('trena'));
    if (orals.length > 0) advice.push(`💊 Оральные ААС на курсе: ${orals.join(', ')}. Обязательно: NAC 1200мг + TUDCA 1000мг/день. Контроль ALT/AST каждые 2 нед.`);
    const needsCaberg = ctx.courseSubstances.some(s => s.includes('tren') || s.includes('deca') || s.includes('npp'));
    if (needsCaberg) advice.push('🔬 19-нор препарат на курсе. Контроль пролактина каждые 2-4 нед. При PRL>25 — каберголин 0.25мг 2р/нед.');
  }
  if (ctx.labAlerts && ctx.labAlerts.length > 0) {
    const highs = ctx.labAlerts.filter(l => l.status === 'high');
    const lows = ctx.labAlerts.filter(l => l.status === 'low');
    if (highs.length > 0) advice.push(`📈 Повышены: ${highs.map(l => l.marker).join(', ')}. Проверьте причины и при необходимости скорректируйте поддержку.`);
    if (lows.length > 0) advice.push(`📉 Понижены: ${lows.map(l => l.marker).join(', ')}. Возможен дефицит — обсудите с врачом.`);
  }
  return advice;
}

const SYSTEM_LABELS: Record<string, string> = {
  cardio: 'Сердечно-сосудистая', hepatic: 'Печень', renal: 'Почки',
  neuro: 'Нервная', endocrine: 'Эндокринная', hematologic: 'Кроветворная',
  reproductive: 'Репродуктивная', musculoskeletal: 'Суставы и связки',
};

export function queryAssistant(text: string): string[] {
  const res = tfidf(text, QA_DB);
  if (!res.length) return ['🤖 Ответ не найдено. Попробуйте переформулировать или обратитесь к разделу "Статьи".'];
  return res.map(r => `❓ ${r.q}\n✅ ${r.a}`);
}

export async function getSmartAssistantResponse(input: string, context?: UserContext): Promise<AssistantResponse> {
  const results = queryAssistant(input);
  const parts: string[] = [];

  if (context) {
    const ctxAdvice = buildContextualAdvice(context);
    if (ctxAdvice.length > 0) {
      parts.push('📋 **Ваш профиль:**');
      parts.push(...ctxAdvice);
      parts.push('');
    }
  }

  parts.push(...results);
  return { text: parts.join('\n\n') };
}
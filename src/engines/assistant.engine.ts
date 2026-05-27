interface QAPair { q: string; a: string; tags: string[]; }
const QA_DB: QAPair[] = [
  { q:'Как снизить пролактин на тренболоне?', a:'Контроль PRL каждые 2 нед. При >25 нг/мл – каберголин 0.25 мг 2р/нед. Ашваганда+L-теанин снижают стресс-индуцированный всплеск.', tags:['prolactin','tren','cabergoline'] },
  { q:'Что делать, если гематокрит 55%?', a:'Срочно отменить железо/тестостерон. Провести эксфузию 400 мл. Добавить пентоксифиллин 400 мг 2р/день. Контроль ОАК через 7 дней.', tags:['hct','donation','pentoxifylline'] },
  { q:'Нужно ли чистить печень после курса оралов?', a:'Оральный ААС уже создал нагрузку. Поддержка: NAC 1200 мг + TUDCA 1000 мг 8 нед. ALT/AST контролируют каждые 2 нед.', tags:['liver','oral','nac','tudca'] },
  { q:'Какая доза телмисартана для профилактики?', a:'40 мг/день утром. При АД >130/85 – 80 мг. Ограничить калий до 3 г/день. Комбинировать с омега-3 для эндотелиальной защиты.', tags:['telmisartan','bp','prevention'] },
  { q:'Как восстановить тестостерон после курса?', a:'ПКТ: кломифен 50→25 мг/день 4 нед + HCG 1000 МЕ через день первые 14 дн. Цинк 30 мг, селен 100 мкг, вит.E 400 МЕ. Контроль TT/LH/FSH через 6 нед.', tags:['pct','clomiphene','hcg','recovery'] },
  { q:'Как правильно делать ЭХО-КГ на курсе?', a:'Базовое ЭхоКГ до курса, далее каждые 12-16 нед. Следить за EF%, ЛЖМ, диастоликой. При снижении EF<50% или росте ЛЖМ>140г – снизить дозу/добавить поддержку.', tags:['echo','cardio','monitoring'] }
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

export function queryAssistant(text: string): string[] {
  const res = tfidf(text, QA_DB);
  if (!res.length) return ['🤖 Ответ не найден. Попробуйте переформулировать или обратитесь к разделу "Статьи".'];
  return res.map(r => `❓ ${r.q}\n✅ ${r.a}`);
}
import React, { useState } from 'react';
import { ModernHero, modernCardBg } from './nutrition-modern-kit';

const FAQ: { q: string; a: string; icon: string; tag: string }[] = [
  { icon: '📉', tag: 'рейтинг', q: 'Почему у продукта низкий рейтинг?',
    a: 'Рейтинг (Overall Dietary Score 1–10) зависит от: фазы (сушка/набор/ПКТ), ваших анализов крови, фармакологии и тайминга. Продукт с ок score 5.0 на массе может упасть до 2.0 на сушке из-за высокого ГИ или сахара. Нажмите на продукт — увидите ключевые факторы.' },
  { icon: '🩸', tag: 'homa-ir', q: 'Что такое HOMA-IR?',
    a: 'HOMA-IR = (глюкоза × инсулин) / 22.5. Показывает инсулинорезистентность. > 2.5 — сигнал. Если HOMA-IR повышен, алгоритм штрафует продукты с высоким ГИ/ИИ (−4.0) и даёт бонус за хром, ALA, берберин (+2.0).' },
  { icon: '🫁', tag: 'печень', q: 'Какие продукты защищают печень?',
    a: 'Брокколи (сульфорафан), яйца (холин, гепатопротекция), оливковое масло (мононенасыщенные), куркума (NF-kB), авокадо (глутатион). В v2 скоринге они получают бонус +1.5 при фазе ПКТ/мост.' },
  { icon: '💪', tag: 'тестостерон', q: 'Как повысить тестостерон едой?',
    a: 'Холестерин (яйца, говядина, сыр) — сырьё для синтеза. Цинк (устрицы, говядина), магний (шпинат, орехи), витамин D (лосось, яйца), насыщенные жиры (кокос, сливочное масло). На фазе ПКТ продукты с холестерином 50-150мг получают +2.0.' },
  { icon: '🔥', tag: 'воспаление', q: 'Как снизить CRP едой?',
    a: 'Омега-3 EPA/DHA (лосось, скумбрия, льняное масло) — +2.0 к рейтингу при CRP > 3.0. Полифенолы (ягоды, тёмный шоколад), флавоноиды (цитрусовые, лук). Избегайте AGEs (жарка, гриль) — штраф −4.0.' },
  { icon: '⚡', tag: 'энергия', q: 'Что есть до и после тренировки?',
    a: 'До: банан + овсянка (средний ГИ) для энергии. После: сывороточный протеин + быстрые углеводы (рис, декстроза) для mTOR и восполнения гликогена. Лейциновый триггер > 3000мг +1.5 к meal score.' },
  { icon: '🧬', tag: 'mTOR', q: 'Что такое лейциновый триггер?',
    a: 'Для активации mTOR и запуска синтеза белка нужно ≥3000 мг лейцина за приём. Это ~130г куриной грудки или 1.5 скупа изолята. Если меньше — бейдж «Низкий анаболизм» и подсказка сколько добавить.' },
  { icon: '💧', tag: 'электролиты', q: 'Почему важно K/Na соотношение?',
    a: 'Оптимальное K/Na > 2.0. При диуретиках и низком K <3500мг или Mg <400мг — риск судорог и аритмии. Шпинат, курага, авокадо — лучшие источники калия. При K/Na < 2.0 + E2 > 180 → штраф −2.5 к meal score.' },
];

const tags = [...new Set(FAQ.map(f => f.tag))];

export const NutriAdvisor: React.FC = () => {
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const items = filterTag ? FAQ.filter(f => f.tag === filterTag) : FAQ;

  return (
    <div className="nut-advisor" style={{ paddingBottom: 80 }}>
      <ModernHero icon="🧑‍⚕️" title="Нутрициолог" subtitle="Персональные рекомендации на основе профиля и анализов." />
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 8 }}>🧑‍⚕️ Нутрициолог</div>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
        <button key="all" onClick={() => setFilterTag(null)} style={{
          padding: '3px 8px', borderRadius: 10, fontSize: 7, fontWeight: 600, cursor: 'pointer',
          background: !filterTag ? 'rgba(139,92,246,0.12)' : '#202023',
          border: !filterTag ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.04)',
          color: !filterTag ? '#c4b5fd' : 'rgba(255,255,255,0.5)',
        }}>🏠 Все</button>
        {tags.map(t => (
          <button key={t} onClick={() => setFilterTag(t)} style={{
            padding: '3px 8px', borderRadius: 10, fontSize: 7, fontWeight: 600, cursor: 'pointer',
            background: filterTag === t ? 'rgba(139,92,246,0.12)' : '#202023',
            border: filterTag === t ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.04)',
            color: filterTag === t ? '#c4b5fd' : 'rgba(255,255,255,0.5)',
          }}>{t}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((f, i) => {
          const isExp = expanded === f.q;
          return (
            <div key={i} style={{
              borderRadius: 12, padding: 0, overflow: 'hidden',
              background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div onClick={() => setExpanded(isExp ? null : f.q)} style={{
                padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 14 }}>{f.icon}</span>
                <div style={{ flex: 1, fontSize: 9, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{f.q}</div>
                <span style={{ fontSize: 8, color: '#8b5cf6' }}>{isExp ? '▲' : '▼'}</span>
              </div>
              {isExp && (
                <div style={{ padding: '0 10px 10px 30px', fontSize: 8, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                  {f.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

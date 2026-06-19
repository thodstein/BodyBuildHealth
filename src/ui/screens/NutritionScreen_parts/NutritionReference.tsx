import React, { useState } from 'react';
import { FOOD_DB } from '../../../core/nutrition-database';

const NUTRITION_RULES = [
  { title: 'Осторожность с молочкой', body: 'Лактоза повышает воспалительные маркеры (СРБ) и провоцирует застой желчи. Может влиять на акне.', color: '#f59e0b' },
  { title: 'Нормы клетчатки', body: '3-30 г/сутки индивидуально. Избыток → диарея. Польза для ССЗ.', color: '#22c55e' },
  { title: 'Питание до тренировки', body: 'За 1-2 часа до. Реально показывает профит.', color: '#3b82f6' },
  { title: 'Контроль фруктозы', body: 'Фруктоза → жировое депо если гликогеновое полно. Следить за сладкими фруктами.', color: '#ef4444' },
  { title: 'Качество продуктов', body: 'Основа — свежая пища. Джанк ≤ 15-20%.', color: '#22c55e' },
  { title: 'Белковая оптимизация', body: 'Не >50 г белка за приём. Распределение эффективнее.', color: '#3b82f6' },
  { title: 'Естественный аппетит', body: 'Только при чувстве голода. Не давиться через силу.', color: '#a855f7' },
  { title: 'Баланс нутриентов', body: 'Каждый приём: белки+жиры+углеводы. Исключение: до/после тренировки (без жиров).', color: '#8b5cf6' },
  { title: 'Комфортное пищеварение', body: 'Без вздутия/диареи. При симптомах → пересмотреть рацион или ЖКТ.', color: '#06b6d4' },
  { title: 'Гидратация', body: '30-40 мл воды на кг веса. +500 мл за час тренировки. Обезвоживание снижает силу на 10-15%.', color: '#06b6d4' },
  { title: 'Сон и питание', body: 'Последний приём за 2-3 часа до сна. Казеин/творог на ночь для медленного белка.', color: '#8b5cf6' },
  { title: 'Пост-тренировочное окно', body: 'Белок + углеводы в первые 60-90 минут после тренировки. Соотношение 1:3 для набора, 1:1 для сушки.', color: '#3b82f6' },
  { title: 'Циклирование калорий', body: 'Тренировочные дни +10-15% ккал, дни отдыха -5-10%.', color: '#f59e0b' },
  { title: 'Контроль натрия', body: '3-5 г соли/день. При высоком АД — снизить до 2-3 г. Задержка воды от избытка соли маскирует результат.', color: '#ef4444' },
  { title: 'Читмил и тяжёлая тренировка', body: 'Лучшее время: сразу ПОСЛЕ тяжёлой тренировки. До 1500 ккал. Не голодать после.', color: '#f59e0b' },
  { title: 'Углеводная загрузка', body: 'За 24-48 часов ДО тяжёлой тренировки: 6-8 г/кг углеводов. Увеличить воду на 1-1.5 л.', color: '#f97316' },
  { title: 'Белково-углеводное чередование', body: '3 дня ВУ (тренировочные) + 1 день НУ (отдых). Белок 2-2.5 г/кг постоянно.', color: '#3b82f6' },
  { title: 'Водный баланс и электролиты', body: '30-40 мл/кг воды. На курсе ААС до 50 мл/кг. Натрий 3-5 г, калий 4-5 г, магний 400-600 мг.', color: '#06b6d4' },
  { title: 'Нутритивное окно', body: '30 г белка каждые 3-4 часа. Лейцин 3-4 г на приём. Казеин 30-40 г перед сном.', color: '#22c55e' },
];

const RECOMMENDED_FOODS: Record<string, { items: string[]; color: string; bg: string }> = {
  'Белки': { items: ['Филе индейки', 'Филе курицы', 'Яйца', 'Говядина постная', 'Фарш говяжий', 'Лосось (2 р/нед)', 'Креветки (1 р/нед)', 'Треска', 'Палтус', 'Минтай'], color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  'Жиры': { items: ['Авокадо', 'Гуакамоле', 'Кокосовое масло', 'Кокосовый урбеч', 'Красная икра', 'Оливковое масло extra virgin'], color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  'Углеводы': { items: ['Рис (кроме бурого)', 'Макароны твёрдых сортов', 'Рисовые макароны', 'Рисовая каша', 'Картофель', 'Батат', 'Хлеб цельнозерновой'], color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  'С ограничением': { items: ['Кукурузные хлопья', 'Цитрусовые', 'Зелёные яблоки', 'Финики', 'Ягоды', 'Мармелад', 'Томатный сок', 'Амилопектин'], color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  'Клетчатка': { items: ['Морковь', 'Свёкла', 'Огурцы', 'Помидоры', 'Лук', 'Квашеная капуста'], color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  'Специи': { items: ['Томатная паста', 'Гималайская соль', 'Любые травы'], color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
  'До тренировки': { items: ['Рис/макароны + курица/индейка', 'Овсянка + протеин', 'Банан + яйца'], color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  'После тренировки': { items: ['Протеиновый коктейль + банан', 'Рис + рыба/курица', 'Картофель + яйца'], color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
};

const FOOD_SYNERGIES = [
  { pair: 'Железо + Витамин C', effect: '+200% всасывания', note: 'Мясо/печень + лимон, перец, томаты', type: 'synergy' as const },
  { pair: 'Куркумин + Чёрный перец', effect: '+2000% биодоступности', note: 'Пиперин ингибирует глюкуронидацию', type: 'synergy' as const },
  { pair: 'Кальций + Кофеин', effect: '−30% всасывания Ca', note: 'Интервал 1-2 часа', type: 'conflict' as const },
  { pair: 'Цинк + Фитиновая кислота', effect: '−50% всасывания Zn', note: 'Не есть мясо с хлебом/овсянкой', type: 'conflict' as const },
  { pair: 'Омега-3 + Витамин E', effect: 'Защита от окисления', note: 'Предотвращает перекисное окисление ПНЖК', type: 'synergy' as const },
  { pair: 'D3 + K2 (MK-7)', effect: 'Синергия Ca-обмена', note: 'D3 → всасывание Ca, K2 → в кости', type: 'synergy' as const },
  { pair: 'Белок + Клетчатка', effect: 'Замедление усвоения', note: 'Казеин + овощи на ночь', type: 'neutral' as const },
  { pair: 'Углеводы + Корица', effect: '−20-30% гликемии', note: 'Замедляет опорожнение желудка', type: 'synergy' as const },
];

const RESTRICTED = [
  { item: 'Молочные продукты', note: 'лактоза → воспаление, застой желчи, акне' },
  { item: 'Соления', note: 'грибки + натрий → отёки, нагрузка на почки' },
  { item: 'Бурый рис', note: 'фитиновая кислота, антинутриенты' },
  { item: 'Сладкие фрукты', note: 'фруктоза → жировое депо при полном гликогене' },
];

const QUALITY_PROTEINS = [
  { name: 'Куриная грудка', score: 9 }, { name: 'Индейка', score: 9 }, { name: 'Яйца', score: 10 },
  { name: 'Говядина постная', score: 8 }, { name: 'Свинина вырезка', score: 7 }, { name: 'Лосось', score: 9 },
  { name: 'Тунец', score: 8 }, { name: 'Творог', score: 8 }, { name: 'Протеин сывороточный', score: 9 },
  { name: 'Говяжья печень', score: 10 }, { name: 'Креветки', score: 8 },
];

const QUALITY_CARBS = [
  { name: 'Рис белый', score: 8 }, { name: 'Гречка', score: 9 }, { name: 'Овсянка', score: 9 },
  { name: 'Картофель', score: 7 }, { name: 'Батат', score: 9 }, { name: 'Макароны тв.сорта', score: 8 },
  { name: 'Хлеб цельнозерновой', score: 7 }, { name: 'Киноа', score: 9 }, { name: 'Булгур', score: 8 },
  { name: 'Нут', score: 9 }, { name: 'Перловка', score: 8 },
];

const QUALITY_FATS = [
  { name: 'Оливковое масло EV', score: 10 }, { name: 'Авокадо', score: 10 }, { name: 'Кокосовое масло', score: 7 },
  { name: 'Орехи грецкие', score: 8 }, { name: 'Миндаль', score: 9 }, { name: 'Рыбий жир', score: 10 },
  { name: 'Льняное масло', score: 8 }, { name: 'Яичный желток', score: 8 }, { name: 'Красная икра', score: 9 },
];

const scoreColor = (s: number) => s >= 9 ? '#22c55e' : s >= 7 ? '#f59e0b' : s >= 5 ? '#f97316' : '#ef4444';

export const NutritionReference: React.FC = () => {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setOpenSections(prev => { const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s; });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Rules */}
      <SectionCard title="📋 Правила питания" isOpen={openSections.has('rules')} onToggle={() => toggle('rules')}>
        {NUTRITION_RULES.map((r, i) => (
          <RuleItem key={i} rule={r} />
        ))}
      </SectionCard>

      {/* Recommended foods */}
      <SectionCard title="🍽 Рекомендуемые продукты" isOpen={openSections.has('foods')} onToggle={() => toggle('foods')}>
        {Object.entries(RECOMMENDED_FOODS).map(([cat, { items, color, bg }]) => (
          <div key={cat} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 4 }}>{cat}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {items.map((item, j) => (
                <span key={j} style={{ padding: '2px 7px', borderRadius: 14, fontSize: 9, background: bg, color, border: `1px solid ${color}20`, whiteSpace: 'nowrap' }}>{item}</span>
              ))}
            </div>
          </div>
        ))}
      </SectionCard>

      {/* Quality scores */}
      <SectionCard title="⭐ Качество продуктов (оценка 1-10)" isOpen={openSections.has('quality')} onToggle={() => toggle('quality')}>
        <ScoreSection label="Белки" color="#3b82f6" items={QUALITY_PROTEINS} />
        <ScoreSection label="Углеводы" color="#f97316" items={QUALITY_CARBS} />
        <ScoreSection label="Жиры" color="#f59e0b" items={QUALITY_FATS} />
      </SectionCard>

      {/* Food synergies */}
      <SectionCard title="🍽 Сочетаемость продуктов" isOpen={openSections.has('synergy')} onToggle={() => toggle('synergy')}>
        {FOOD_SYNERGIES.map((p, j) => {
          const typeColor = p.type === 'synergy' ? '#22c55e' : p.type === 'conflict' ? '#ef4444' : '#f59e0b';
          const typeIcon = p.type === 'synergy' ? '⊕' : p.type === 'conflict' ? '⊖' : '○';
          const bg = p.type === 'synergy' ? 'rgba(34,197,94,0.06)' : p.type === 'conflict' ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.05)';
          return (
            <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 8px', background: bg, borderRadius: 8, marginBottom: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ minWidth: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: typeColor + '15', color: typeColor, fontWeight: 800, fontSize: 13 }}>{typeIcon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)' }}>{p.pair}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: typeColor, background: typeColor + '12', padding: '1px 6px', borderRadius: 8, whiteSpace: 'nowrap' }}>{p.effect}</span>
                </div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)', lineHeight: 1.4 }}>{p.note}</div>
              </div>
            </div>
          );
        })}
      </SectionCard>

      {/* Restricted */}
      <SectionCard title="⚠️ Ограничить" isOpen={openSections.has('restricted')} onToggle={() => toggle('restricted')} color="#ef4444">
        {RESTRICTED.map((w, j) => (
          <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 10, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4, marginBottom: 4 }}>
            <span style={{ color: '#ef4444', flexShrink: 0 }}>✕</span>
            <div>
              <span style={{ fontWeight: 600, color: '#ef4444' }}>{w.item}</span>
              <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>— {w.note}</span>
            </div>
          </div>
        ))}
      </SectionCard>
    </div>
  );
};

// ─── Sub-components ───
const SectionCard: React.FC<{ title: string; isOpen: boolean; onToggle: () => void; color?: string; children: React.ReactNode }> = ({ title, isOpen, onToggle, color, children }) => (
  <div style={{ padding: 12, borderRadius: 14, background: 'linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)' }}>
    <button onClick={onToggle} style={{ width: '100%', padding: '4px 0', cursor: 'pointer', background: 'none', border: 'none', color: color || 'rgba(255,255,255,0.35)', fontWeight: 600, fontSize: 11, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', fontSize: 14 }}>›</span>
      {title}
    </button>
    {isOpen && <div style={{ marginTop: 8 }}>{children}</div>}
  </div>
);

const RuleItem: React.FC<{ rule: typeof NUTRITION_RULES[number] }> = ({ rule }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 4 }}>
      <button onClick={() => setExpanded(!expanded)} style={{ width: '100%', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: expanded ? `${rule.color}10` : 'rgba(255,255,255,0.02)', border: 'none', color: 'var(--text)', textAlign: 'left', fontSize: 10, fontWeight: 600 }}>
        <span style={{ width: 18, height: 18, borderRadius: 6, background: rule.color + '20', color: rule.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
        <span>{rule.title}</span>
      </button>
      {expanded && <div style={{ padding: '6px 10px 6px 36px', fontSize: 9, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.15)' }}>{rule.body}</div>}
    </div>
  );
};

const ScoreSection: React.FC<{ label: string; color: string; items: { name: string; score: number }[] }> = ({ label, color, items }) => (
  <>
    <h5 style={{ margin: '6px 0 4px', fontSize: 10, color }}>{label}</h5>
    {items.map((p, j) => (
      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
        <div style={{ minWidth: 28, height: 18, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: scoreColor(p.score) + '15', color: scoreColor(p.score), fontWeight: 800, fontSize: 9 }}>{p.score}/10</div>
        <span style={{ fontSize: 9, fontWeight: 600 }}>{p.name}</span>
      </div>
    ))}
  </>
);

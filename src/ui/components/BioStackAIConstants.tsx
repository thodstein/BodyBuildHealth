import React from 'react';
import { type GoalType, type HealthCondition, type BioStackProfile } from '../../engines/biostack-ai.engine';
import { type FinderProfile, type GoalType as FinderGoal } from '../../engines/supplement-finder.engine';
import { SUPPORT_CATALOG_DATA } from '../../data/support-database';
import { BRIDGE_MECH_TO_CATALOG } from '../../data/mechanism-code-bridge';
import { MECHANISM_LABELS } from '../../data/support-meta';

// ─── TZ / support-calculator mechanism model ───
// Категории механизмов — те же, что в калькуляторе поддержки (BRIDGE_MECH_TO_CATALOG):
// cardio / hepatic / renal / neuro / endocrine / hematologic / reproductive / musculoskeletal
export const MECH_CATEGORY_META: Record<string, { label: string; color: string }> = {
  cardio: { label: 'Сердечно-сосудистая', color: '#ef4444' },
  hepatic: { label: 'Печень', color: '#22c55e' },
  renal: { label: 'Почки', color: '#0ea5e9' },
  neuro: { label: 'Нервная система', color: '#a855f7' },
  endocrine: { label: 'Эндокринная', color: '#f59e0b' },
  hematologic: { label: 'Кровь', color: '#ec4899' },
  reproductive: { label: 'Репродуктивная', color: '#14b8a6' },
  musculoskeletal: { label: 'Опорно-двигательная', color: '#84cc16' },
};

// catalog mechanism code → category (из BRIDGE_MECH_TO_CATALOG как в калькуляторе поддержки)
const CATALOG_TO_CATEGORY: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [bridgeKey, codes] of Object.entries(BRIDGE_MECH_TO_CATALOG)) {
    const cat = bridgeKey.split('_')[0];
    for (const code of codes) map[code] = cat;
  }
  return map;
})();

// Карточка механизмов вещества — модель ориентированная на механизмы из калькулятора поддержки
// (группировка по органам/системам + механизмам, как в калькуляторе поддержки).
export function SubstanceMechanismCard({ id }: { id: string }) {
  const entry = SUPPORT_CATALOG_DATA[id];
  const mechs = entry?.mechanisms || [];
  if (mechs.length === 0) return null;
  const grouped: Record<string, string[]> = {};
  for (const code of mechs) {
    const cat = CATALOG_TO_CATEGORY[code] || 'other';
    (grouped[cat] ||= []).push(code);
  }
  return (
    <div style={{ marginTop: 4 }}>
      {Object.entries(grouped).map(([cat, codes]) => {
        const meta = MECH_CATEGORY_META[cat] || { label: cat, color: '#64748b' };
        return (
          <div key={cat} style={{ marginBottom: 3 }}>
            <div style={{ fontSize: 7, fontWeight: 700, color: meta.color, marginBottom: 1 }}>{meta.label}</div>
            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {codes.map(c => (
                <span key={c} style={{
                  fontSize: 6, padding: '1px 5px', borderRadius: 4,
                  background: `${meta.color}14`, color: meta.color, border: `1px solid ${meta.color}22`,
                }}>{MECHANISM_LABELS[c] || c}</span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Карточка описания препарата в ТЗ-стиле (как organMechanisms в Calc.mapper.tsx, purple #a78bfa)
export function SubstanceTzCard({ id }: { id: string }) {
  const entry = SUPPORT_CATALOG_DATA[id];
  const desc = entry?.description;
  if (!desc) return null;
  return (
    <div style={{
      marginTop: 4, padding: '5px 8px', borderRadius: 8,
      background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)',
    }}>
      <div style={{ fontSize: 7, fontWeight: 700, color: '#a78bfa', marginBottom: 1 }}>📋 Описание (ТЗ)</div>
      <div style={{ fontSize: 8, color: 'rgba(233,213,255,0.85)', lineHeight: 1.35 }}>{desc}</div>
    </div>
  );
}

export type BSTab = 'profile' | 'select' | 'stack' | 'reports';

export const SUB_TABS: { id: BSTab; label: string }[] = [
  { id: 'profile', label: '👤 Профиль' },
  { id: 'select', label: '🔍 Подбор' },
  { id: 'stack', label: '📋 Мой стек' },
  { id: 'reports', label: '📊 Итоги' },
];

export const SUB_TAB_GROUPS: Record<string, { id: string; label: string }[]> = {
  profile: [
    { id: 'settings', label: '⚙️ Профиль' },
  ],
  select: [
    { id: 'search', label: '🔍 Поиск' },
    { id: 'build', label: '🧩 Сборка' },
    { id: 'complexes', label: '🧪 Комплексы' },
    { id: 'clinical', label: '🔬 Клин.' },
  ],
  stack: [
    { id: 'mystack', label: '📋 Стек' },
    { id: 'interactions', label: '⚗️ Взаимод.' },
    { id: 'dose', label: '💊 Доза' },
    { id: 'timing', label: '⏰ Время' },
    { id: 'clinical', label: '🩺 Клин.' },
    { id: 'drugcheck', label: '💊 ЛС' },
  ],
  reports: [
    { id: 'reports', label: '📊 Отчёты' },
    { id: 'risks', label: '⚠ Риски' },
    { id: 'compare', label: '⚖ Сравн.' },
    { id: 'export', label: '📤 Экспорт' },
  ],
};

export const DEFAULT_SUB: Record<string, string> = {
  profile: 'settings',
  select: 'search',
  stack: 'mystack',
  reports: 'reports',
};

export const GOALS: { key: GoalType; label: string }[] = [
  { key:'sleep', label:'😴 Сон' }, { key:'energy', label:'⚡ Энергия' },
  { key:'concentration', label:'🎯 Фокус' }, { key:'muscle_gain', label:'💪 Мышцы' },
  { key:'fat_loss', label:'🔥 Жиросжигание' }, { key:'endurance', label:'🏃 Выносливость' },
  { key:'recovery', label:'🔄 Восстановление' }, { key:'immunity', label:'🛡️ Иммунитет' },
  { key:'liver_health', label:'🫁 Печень' }, { key:'cardio_health', label:'❤️ Сердце' },
  { key:'joints', label:'🦴 Суставы' }, { key:'skin', label:'🧴 Кожа' },
  { key:'hair', label:'💇 Волосы' }, { key:'hormones', label:'⚖️ Гормоны' },
  { key:'stress', label:'🧘 Стресс' }, { key:'longevity', label:'⏳ Долголетие' },
  { key:'detox', label:'🧹 Детокс' }, { key:'libido', label:'🔥 Либидо' },
  { key:'mood', label:'😊 Настроение' }, { key:'brain', label:'🧠 Мозг' },
  { key:'digestion', label:'🫃 ЖКТ' }, { key:'kidney', label:'🫘 Почки' },
];

// Цели (что ХОТИМ достичь) — только outcome-цели, без органов и систем
export const PURE_GOALS: { key: GoalType; label: string }[] = [
  // 🏋️ Физическая форма
  { key:'muscle_gain', label:'💪 Рост мышечной массы' },
  { key:'fat_loss', label:'🔥 Снижение жировой массы' },
  { key:'endurance', label:'🏃 Повышение выносливости' },
  // 🔄 Восстановление
  { key:'sleep', label:'😴 Улучшение качества сна' },
  { key:'recovery', label:'🔄 Ускорение восстановления' },
  // ⚡ Энергия и тонус
  { key:'energy', label:'⚡ Повышение энергии' },
  { key:'libido', label:'🔥 Повышение либидо' },
  // 🧠 Когнитивные функции
  { key:'concentration', label:'🎯 Улучшение фокуса' },
  { key:'brain', label:'🧠 Память и когнитивные функции' },
  // 😊 Психоэмоциональное состояние
  { key:'mood', label:'😊 Стабилизация настроения' },
  { key:'stress', label:'🧘 Снижение стресса' },
  // ❤️ Системное здоровье
  { key:'cardio_health', label:'❤️ Здоровье ССС' },
  { key:'immunity', label:'🛡️ Укрепление иммунитета' },
  { key:'hormones', label:'⚖️ Гормональный баланс' },
  { key:'joints', label:'🦴 Здоровье суставов' },
  { key:'digestion', label:'🫃 Улучшение пищеварения' },
  { key:'detox', label:'🧹 Детоксикация организма' },
  // ⏳ Долгосрочные
  { key:'longevity', label:'⏳ Продление долголетия' },
];

// Системы-мишени (на какой ОРГАН/СИСТЕМУ влияем)
export const TARGET_SYSTEMS: { key: GoalType; label: string }[] = [
  { key:'immunity', label:'🛡️ Иммунитет' },
  { key:'liver_health', label:'🫁 Печень' }, { key:'cardio_health', label:'❤️ Сердце' },
  { key:'joints', label:'🦴 Суставы' }, { key:'skin', label:'🧴 Кожа' },
  { key:'hair', label:'💇 Волосы' }, { key:'hormones', label:'⚖️ Гормоны' },
  { key:'brain', label:'🧠 Мозг' },
  { key:'digestion', label:'🫃 ЖКТ' }, { key:'kidney', label:'🫘 Почки' },
];

export const HEALTH_CONDS: { key: HealthCondition; label: string }[] = [
  { key:'liver', label:'🫁 Печень' }, { key:'kidney', label:'🫘 Почки' },
  { key:'heart', label:'❤️ Сердце' }, { key:'thyroid', label:'🦋 Щитовидная' },
  { key:'stomach', label:'🫃 Желудок' }, { key:'pressure_high', label:'⬆️ Давление ↑' },
  { key:'pressure_low', label:'⬇️ Давление ↓' }, { key:'diabetes', label:'🍬 Диабет' },
  { key:'autoimmune', label:'🛡️ Аутоиммунные' },
];

export const ORGANS: { key: string; label: string }[] = [
  { key:'BRAIN', label:'🧠 Мозг' }, { key:'LIVER', label:'🫁 Печень' },
  { key:'HEART', label:'❤️ Сердце' }, { key:'KIDNEYS', label:'🫘 Почки' },
  { key:'LUNGS', label:'🫁 Лёгкие' }, { key:'MUSCLES', label:'💪 Мышцы' },
  { key:'BONES', label:'🦴 Кости' }, { key:'JOINTS', label:'🦴 Суставы' },
  { key:'SKIN', label:'🧴 Кожа' }, { key:'IMMUNE_SYSTEM', label:'🛡️ Иммунитет' },
  { key:'NERVES', label:'⚡ Нервы' }, { key:'GUT', label:'🫃 ЖКТ' },
  { key:'VESSELS', label:'🩸 Сосуды' }, { key:'THYROID', label:'🦋 Щитовидная' },
  { key:'REPRODUCTIVE', label:'🧬 Репродуктивная' }, { key:'PROSTATE', label:'🔴 Простата' },
  { key:'BLOOD', label:'🩸 Кровь' }, { key:'PANCREAS', label:'🫁 Поджелудочная' },
  { key:'ENDOCRINE', label:'⚖️ Эндокринная' }, { key:'ADRENALS', label:'⚖️ Надпочечники' },
];

export const SYSTEMS: { key: string; label: string }[] = [
  { key:'hepatic', label:'🫁 Печень' }, { key:'cardio', label:'❤️ ССС' },
  { key:'renal', label:'🫘 Почки' }, { key:'neuro', label:'🧠 Нервная' },
  { key:'endocrine', label:'⚖️ Эндокринная' }, { key:'hematologic', label:'🩸 Кровь' },
  { key:'reproductive', label:'🧬 Репродуктивная' }, { key:'musculoskeletal', label:'💪 Опорно-двиг.' },
  { key:'immune', label:'🛡️ Иммунитет' }, { key:'metabolic', label:'⚡ Метаболизм' },
  { key:'gastrointestinal', label:'🫃 ЖКТ' },
];

export const TOP_MECHANISMS: { key: string; label: string }[] = [
  { key:'cv1', label:'❤️ Ремоделирование миокарда' },
  { key:'cv2', label:'❤️ Дислипидемия' },
  { key:'cv3', label:'❤️ Задержка Na/H₂O' },
  { key:'cv4', label:'❤️ Протромботический' },
  { key:'cv5', label:'❤️ Аритмогенный' },
  { key:'liv1', label:'🫁 Гепатоцеллюлярная токс.' },
  { key:'liv2', label:'🫁 Холестаз' },
  { key:'liv3', label:'🫁 Пренеопластический' },
  { key:'ren1', label:'🫘 Гемодинамическое нефроп.' },
  { key:'ren2', label:'🫘 Гиперфильтрация' },
  { key:'ren3', label:'🫘 Протеинурия' },
  { key:'ren4', label:'🫘 Водно-электролитный' },
  { key:'cns1', label:'🧠 Нейромедиаторная дизрег.' },
  { key:'cns2', label:'🧠 Оксидативный стресс' },
  { key:'cns3', label:'🧠 Апоптоз' },
  { key:'cns4', label:'🧠 Нейроэндокринная' },
  { key:'cns5', label:'🧠 Нейроглюкопения' },
  { key:'cns6', label:'🧠 Внутричерепная гиперт.' },
  { key:'rep1', label:'🧬 Супрессия GnRH/LH/FSH' },
  { key:'rep2', label:'🧬 ↓ Интратестикулярного T' },
  { key:'rep3', label:'🧬 Сперматогенез' },
  { key:'rep4', label:'🧬 Эстрогенный сдвиг' },
  { key:'rep5', label:'🧬 Постцикловая супрессия' },
  { key:'hem1', label:'🩸 Эритроцитоз' },
  { key:'hem2', label:'🩸 Инсулинорезистентность' },
  { key:'hem3', label:'🩸 Гипогликемия' },
  { key:'hem4', label:'🩸 Гипокалиемия' },
  { key:'hem5', label:'🩸 Водно-электролитный сдвиг' },
];

export const SYMPTOMS: { label: string; goal: GoalType }[] = [
  { label:'😰 Тревожность', goal:'stress' },
  { label:'😴 Бессонница', goal:'sleep' },
  { label:'⚡ Усталость', goal:'energy' },
  { label:'😐 Апатия', goal:'mood' },
  { label:'🤯 Перегруз', goal:'stress' },
  { label:'🤔 Забывчивость', goal:'brain' },
  { label:'😡 Раздражительность', goal:'stress' },
  { label:'🍔 Тяга к еде', goal:'digestion' },
  { label:'💪 Мышечная слабость', goal:'recovery' },
  { label:'🤕 Частые болезни', goal:'immunity' },
];

export interface LabMarker { id: string; label: string; group: string; organs: string[]; mechanisms: string[]; ref?: string; }

export const LAB_MARKERS: LabMarker[] = [
  { id:'alt_ast', label:'АЛТ / АСТ', group:'🫁 Печень', organs:['LIVER'], mechanisms:['ANTIOXIDANT','LIVER_DETOX','GLUTATHIONE'], ref:'<40 Ед/л' },
  { id:'ggt', label:'ГГТ', group:'🫁 Печень', organs:['LIVER','GALLBLADDER'], mechanisms:['CHOLERETIC','ANTIOXIDANT'], ref:'<55 Ед/л' },
  { id:'homocysteine', label:'Гомоцистеин', group:'🧬 Метилирование', organs:['BLOOD','VESSELS'], mechanisms:['METHYLATION','ANTIOXIDANT'], ref:'5-15 мкмоль/л' },
  { id:'bp', label:'Давление (сист/диаст)', group:'❤️ ССС', organs:['HEART','VESSELS'], mechanisms:['BLOOD_PRESSURE','VASODILATION'], ref:'<130/80' },
  { id:'hr', label:'ЧСС', group:'❤️ ССС', organs:['HEART'], mechanisms:['BLOOD_PRESSURE','COQ10'], ref:'60-80 уд/мин' },
  { id:'ldl_hdl_tg', label:'LDL / HDL / ТГ', group:'❤️ ССС', organs:['HEART','VESSELS','LIVER'], mechanisms:['LIPID','ANTIOXIDANT','FAT_OXIDATION'], ref:'LDL<3.0 HDL>1.0 ТГ<1.7' },
  { id:'glucose_hba1c', label:'Глюкоза / HbA1c', group:'⚡ Метаболизм', organs:['PANCREAS','LIVER'], mechanisms:['AMPK_ACTIVATION','METABOLIC'], ref:'3.3-5.5 / <5.7%' },
  { id:'creatinine_urea', label:'Креатинин / Мочевина', group:'🫘 Почки', organs:['KIDNEYS'], mechanisms:['RENAL_PROTECTION'], ref:'62-106 / 2.5-8.3' },
  { id:'tsh_ft3_ft4', label:'ТТГ / Т3св / Т4св', group:'⚖️ Эндокринная', organs:['THYROID','PITUITARY'], mechanisms:['THYROID_HORMONE'], ref:'TTG 0.4-4.0' },
  { id:'t_e2', label:'Тестостерон / Эстрадиол', group:'⚖️ Эндокринная', organs:['ENDOCRINE','REPRODUCTIVE'], mechanisms:['TESTOSTERONE','AROMATASE'], ref:'8-30 / <160 пмоль/л' },
  { id:'prolactin', label:'Пролактин', group:'⚖️ Эндокринная', organs:['PITUITARY','BRAIN'], mechanisms:['DOPAMINE'], ref:'86-324 мМЕ/л' },
  { id:'cortisol', label:'Кортизол', group:'⚖️ Эндокринная', organs:['ADRENALS','BRAIN'], mechanisms:['CORTISOL','ADAPTOGENIC'], ref:'150-660 нмоль/л' },
  { id:'ferritin_iron', label:'Ферритин / Железо', group:'🩸 Кровь', organs:['BLOOD','LIVER'], mechanisms:['ANTIOXIDANT'], ref:'30-400 / 11-32' },
  { id:'b12_folate', label:'B12 / Фолат', group:'🩸 Кровь', organs:['BLOOD','NERVES'], mechanisms:['METHYLATION','ENERGY_PRODUCTION'], ref:'200-900 пг/мл' },
  { id:'crp', label:'СРБ (воспаление)', group:'🛡️ Иммунитет', organs:['IMMUNE_SYSTEM','LIVER'], mechanisms:['ANTI_INFLAMMATORY','ANTIOXIDANT'], ref:'<5 мг/л' },
  { id:'vitamin_d', label:'Витамин D', group:'🛡️ Иммунитет', organs:['IMMUNE_SYSTEM','BONES'], mechanisms:['VITAMIN_D_RECEPTOR'], ref:'30-100 нг/мл' },
  { id:'prostate_psa', label:'ПСА', group:'🔴 Простата', organs:['PROSTATE'], mechanisms:['5AR_INHIBITION','ANTI_ANDROGENIC'], ref:'<4 нг/мл' },
  { id:'dht', label:'DHT', group:'🔴 Простата', organs:['PROSTATE','HAIR','SKIN'], mechanisms:['5AR_INHIBITION'], ref:'250-990 пг/мл' },
  { id:'uric_acid', label:'Мочевая кислота', group:'🫘 Почки', organs:['KIDNEYS','JOINTS'], mechanisms:['URIC_ACID','ANTIOXIDANT'], ref:'200-420 мкмоль/л' },
];

export const GROUP_LABELS = ['🫁 Печень','🧬 Метилирование','❤️ ССС','⚡ Метаболизм','🫘 Почки','⚖️ Эндокринная','🩸 Кровь','🛡️ Иммунитет','🔴 Простата'];

/* ─── Styles ─── */
export const inputS: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 10,
  background: '#202023', border: '1px solid rgba(255,255,255,0.06)',
  color: '#fff', fontSize: 11, boxSizing: 'border-box', outline: 'none',
};

export const selectS: React.CSSProperties = { ...inputS, appearance: 'none' };

/* ─── Shared Components ─── */
export const GlassCard: React.FC<{ title?: string; icon?: string; color?: string; children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }> = ({ title, icon, color, children, style, onClick }) => (
  <div onClick={onClick} style={{ borderRadius: 12, overflow: 'hidden', background: '#18181b', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 1px 12px rgba(0,0,0,0.25)', marginBottom: 6, cursor: onClick ? 'pointer' : undefined, ...style }}>
    {color && <div style={{ height: 3, background: `linear-gradient(90deg, ${color}, ${color}66, transparent)` }} />}
    {title && <div style={{ padding: '10px 14px 0', fontSize: 12, color: color || 'rgba(255,255,255,0.75)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>{icon && <span>{icon}</span>}{title}</div>}
    <div style={{ padding: title ? '8px 14px 12px' : 10 }}>{children}</div>
  </div>
);

export const PillBtn: React.FC<{ active?: boolean; onClick: () => void; color?: string; children: React.ReactNode; small?: boolean }> = ({ active, onClick, color, children, small }) => (
  <button onClick={onClick} style={{
    padding: small ? '4px 10px' : '6px 14px', borderRadius: 20, fontSize: small ? 8 : 10, cursor: 'pointer', fontWeight: 600,
    whiteSpace: 'nowrap', letterSpacing: '-0.1px', transition: 'all 0.2s',
    background: active ? (color ? `${color}18` : 'rgba(0,230,138,0.12)') : '#202023',
    border: active ? `1px solid ${color || '#00e68a'}` : '1px solid rgba(255,255,255,0.06)',
    color: active ? (color || '#00e68a') : '#fff',
    boxShadow: active ? `0 0 12px ${(color || '#00e68a')}22` : 'none',
  }}>{children}</button>
);

export const Slider: React.FC<{ value: number; onChange: (v: number) => void; label: string; emoji?: string }> = ({ value, onChange, label, emoji }) => (
  <div style={{ marginBottom: 6 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>
      <span>{emoji} {label}</span><span style={{ fontWeight: 700, color: '#00e68a' }}>{value}/10</span>
    </div>
    <input type="range" min={0} max={10} value={value} onChange={e => onChange(+e.target.value)}
      style={{ width: '100%', height: 4, borderRadius: 2, background: '#202023', accentColor: '#00e68a', outline: 'none' }} />
  </div>
);

export function StatBox({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div style={{ padding: '5px 7px', borderRadius: 8, background: color + '08', border: '1px solid ' + color + '20', textAlign: 'center' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 6, color }}>{label}</div>
      {sub && <div style={{ fontSize: 5, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

export function toFinderProfile(bp: BioStackProfile): FinderProfile {
  return {
    age: bp.age, weight: bp.weight, height: bp.height, sex: bp.sex,
    experience: bp.experience,
    goals: [],
    aasStatus: 'none',
    healthConditions: bp.healthConditions,
    budget: 'medium', avoidIds: bp.avoidIds, maxStackSize: 8,
  };
}

export const PRICE_RUB: Record<string, number> = {
  nac: 650, milk_thistle: 400, tudca: 900, omega3: 800, coq10: 1200, magnesium: 350,
  zinc: 200, vitamin_d3: 300, vitamin_c: 250, vitamin_e: 350, selenium: 200,
  berberine: 600, curcumin: 500, alpha_lipoic: 700, collagen: 1200, glucosamine: 800,
  msm: 500, chondroitin: 900, ashwagandha: 600, rhodiola: 550, theanine: 450,
  glycine: 300, creatine: 400, l_carnitine: 700, taurine: 350, inositol: 500,
  probiotics: 1200, glutamine: 500, astragalus: 600, borax: 200, potassium: 250,
  calcium: 300, citicoline: 1200, alpha_gpc: 900, huperzine_a: 400, noopept: 800,
  piracetam: 500, lions_mane: 900, phosphatidylserine: 900, magnesium_l_threonate: 1200,
  serrapeptase: 900, nattokinase: 800, bromelain: 500, vitamin_a: 200,
  zinc_carnosine: 800, l_glutamine: 600, tongkat_ali: 1200, kefir: 300, chia: 400,
  flax_oil: 400, idebenone: 800, pqq: 900, bone_broth: 300, gelatin: 350,
  schisandra: 500, fadogia: 900, shilajit: 800,
};

export function estCost(id: string): number {
  if (PRICE_RUB[id]) return PRICE_RUB[id];
  const c = SUPPORT_CATALOG_DATA[id];
  if (!c) return 500;
  const tm: Record<string, number> = { core: 800, standard: 500, advanced: 300, specialty: 1200 };
  return tm[c.tier as string] || 500;
}

/* ─── Animation CSS ─── */
/* ─── Toast ─── */
let toastTimer: ReturnType<typeof setTimeout> | null = null;
export function showToast(msg: string, type: 'success' | 'error' | 'info' = 'info') {
  const el = document.getElementById('bio-toast');
  if (!el) return;
  const colors = { success: '#00e68a', error: '#ef4444', info: '#60a5fa' };
  el.textContent = msg;
  el.style.display = 'block';
  el.style.background = `${colors[type]}15`;
  el.style.borderColor = `${colors[type]}30`;
  el.style.color = colors[type];
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

/* ─── ConfirmModal ─── */
export function ConfirmModal({ title, text, confirmLabel, cancelLabel, onConfirm, onCancel, confirmColor }: {
  title: string; text: string; confirmLabel?: string; cancelLabel?: string;
  onConfirm: () => void; onCancel: () => void; confirmColor?: string;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)' }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ width: '88%', maxWidth: 320, borderRadius: 14, background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{ height: 3, background: `linear-gradient(90deg, ${confirmColor || '#00e68a'}, ${confirmColor || '#00e68a'}66, transparent)` }} />
        <div style={{ padding: '14px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{title}</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4, marginBottom: 12 }}>{text}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onCancel} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: 10,
            }}>{cancelLabel || 'Отмена'}</button>
            <button onClick={onConfirm} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
              background: `${confirmColor || '#00e68a'}18`, border: `1px solid ${confirmColor || '#00e68a'}30`, color: confirmColor || '#00e68a', fontWeight: 700, fontSize: 10,
            }}>{confirmLabel || 'Подтвердить'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── SkeletonLoader ─── */
export function SkeletonLoader({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          borderRadius: 10, height: 56, background: '#18181b',
          border: '1px solid rgba(255,255,255,0.04)',
          animation: 'bioPulse 1.5s ease-in-out infinite',
          opacity: 1 - i * 0.1,
        }} />
      ))}
    </div>
  );
}

/* ─── Toast container element — call once at app init ─── */
export function initBioToast() {
  if (document.getElementById('bio-toast')) return;
  const div = document.createElement('div');
  div.id = 'bio-toast';
  div.style.cssText = `
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
    z-index: 9999; display: none;
    padding: 10px 20px; border-radius: 12px;
    font-size: 11px; font-weight: 600;
    border: 1px solid; backdrop-filter: blur(8px);
    max-width: 90%; text-align: center;
    transition: all 0.2s;
  `;
  document.body.appendChild(div);
}

export const BIO_ANIM_CSS = `
@keyframes bioFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes bioFadeOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-6px); } }
@keyframes bioSlideDown { from { max-height: 0; opacity: 0; } to { max-height: 600px; opacity: 1; } }
@keyframes bioSlideUp { from { max-height: 600px; opacity: 1; } to { max-height: 0; opacity: 0; } }
@keyframes bioPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes bioScaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.bio-fade { animation: bioFadeIn 0.25s ease-out both; }
.bio-fade-fast { animation: bioFadeIn 0.15s ease-out both; }
.bio-card { transition: all 0.2s ease; }
.bio-card:hover { border-color: rgba(0,230,138,0.12) !important; }
.bio-chip { transition: all 0.15s ease; }
.bio-chip:hover { transform: scale(1.05); }
.bio-dragging { opacity: 0.4; transform: scale(0.98); }
.bio-drag-over { border-top: 2px solid #00e68a !important; }
`;

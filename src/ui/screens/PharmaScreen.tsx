import React, { useState, useMemo } from 'react';
import { PHARMA_DB, SUBSTANCES_BY_CLASS } from '../../core/pharma-database';
import { calculateDose } from '../../engines/dosage.engine';
import { simulateCourse, steadyStatePeak, steadyStateTrough, eliminationConstant } from '../../engines/pk-pd.engine';
import { calculateMultiSubstancePKPD } from '../../engines/pkpd-superposition.engine';
import { checkDrugInteractions } from '../../engines/pharma-interactions.engine';
import { PHARMA_DETAILS, type PharmaDetail } from '../../data/pharma-details';
import type { PharmaSubstance, CourseEntry, PD } from '../../core/types';
import { SYNERGY_PAIRS, type SynergyPair } from '../../engines/support.engine';
import { SYSTEM_INFO } from '../../core/risk-info';
import { PharmaCourseScreen } from './PharmaCourseScreen';

type Tab = 'catalog' | 'pkpd' | 'dosage' | 'interactions' | 'course';

const SYSTEM_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(SYSTEM_INFO).map(([k, v]) => [k, v.label.split(' ').slice(0, 2).join(' ')])
);

const CLASS_LABELS: Record<string, string> = {
  testosterone: 'Тестостерон',
  trenbolone: 'Тренболон',
  nandrolone: 'Нандролон',
  boldenone: 'Болденон',
  primobolan: 'Примоболан',
  oral_17aa: 'Оральные 17-α',
  sarm: 'SARMs',
  peptide_ghrh: 'Пептиды GHRH',
  peptide_ghrp: 'Пептиды GHRP',
  igf1: 'ИГФ-1',
  mgf: 'МГФ',
  insulin: 'Инсулины',
  pct_serm: 'СЕРМ (ПКТ)',
  pct_aromatase: 'Ингибиторы ароматазы',
  pct_dopamine: 'Допаминовые агонисты',
  pct_gonadotropin: 'Гонадотропины (ХГЧ)',
  drostanolone: 'Дростанолон (Мастерон)',
  peptide_gnrh: 'Пептиды GNRH',
  peptide_fat_loss: 'Пептиды для жироудаления',
  peptide_other: 'Другие пептиды',
};

const PD_LABELS: Record<keyof PD, string> = {
  AR_affinity: 'Сродство к AR',
  aromatization: 'Ароматизация',
  five_alpha_reduction: '5α-восстановление',
  progestogenic: 'Прогестогенная акт.',
  hepatotoxicity: 'Гепатотоксичность',
  lipid_impact: 'Влияние на липиды',
  hct_impact: 'Влияние на HCT',
  neuro_toxicity: 'Нейротоксичность',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff1744',
  warning: '#ff9100',
  info: '#2979ff',
};

const INTERACTION_TYPE_LABELS: Record<string, string> = {
  synergy: 'Синергия',
  conflict: 'Конфликт',
  danger: 'Опасность',
  caution: 'Осторожность',
};

const pdBarColor = (key: keyof PD, val: number): string => {
  if (key === 'hepatotoxicity') return val >= 2.5 ? '#ff1744' : val >= 1.5 ? '#ff9100' : '#4caf50';
  if (key === 'aromatization') return val >= 0.7 ? '#ff5252' : '#4caf50';
  if (key === 'progestogenic') return val >= 0.3 ? '#ff9100' : '#4caf50';
  if (key === 'neuro_toxicity') return val >= 0.3 ? '#ff1744' : val >= 0.1 ? '#ff9100' : '#4caf50';
  if (key === 'lipid_impact') return val <= -0.5 ? '#ff1744' : '#4caf50';
  if (key === 'hct_impact') return val >= 4 ? '#ff1744' : '#4caf50';
  return '#2979ff';
};

const formatHalfLife = (hours: number): string => {
  if (hours >= 168) return `${(hours / 168).toFixed(1)} нед`;
  if (hours >= 24) return `${(hours / 24).toFixed(1)} дн`;
  return `${hours.toFixed(1)} ч`;
};

const PHARMA_CLASSES = [
  'testosterone', 'trenbolone', 'nandrolone', 'boldenone', 'primobolan', 'oral_17aa',
  'sarm', 'peptide_ghrh', 'peptide_ghrp', 'igf1', 'mgf', 'insulin', 'pct_serm',
  'pct_aromatase', 'pct_dopamine', 'pct_gonadotropin', 'drostanolone', 'peptide_gnrh',
  'peptide_fat_loss', 'peptide_other'
] as const;

type PharmaClass = typeof PHARMA_CLASSES[number];

export const PharmaScreen: React.FC = () => {
  const [tab, setTab] = useState<Tab>('catalog');

  // Filter to show only pharma substances (exclude support classes)
  const pharmaSubstances = useMemo(() => {
    return Object.values(PHARMA_DB).filter(s => 
      PHARMA_CLASSES.includes(s.class as PharmaClass)
    );
  }, []);

  return (
    <div className="screen pharma">
      <h2>Фармакология</h2>
      <div className="tab-bar" style={{ marginBottom: 8 }}>
        {([
          ['catalog', '📖 Каталог'],
          ['pkpd', '⚙️ PK/PD'],
          ['dosage', '📊 Доза'],
          ['interactions', '⚡ Взаимод.'],
          ['course', '💊 Курс'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`tab-btn ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'catalog' && <CatalogTab />}
      {tab === 'pkpd' && <PKPDSimulationTab />}
      {tab === 'dosage' && <DosageCalculatorTab />}
      {tab === 'interactions' && <InteractionCheckerTab />}
      {tab === 'course' && <PharmaCourseScreen />}
    </div>
  );
};

const SYSTEM_LABELS_INVEST: Record<string, string> = {
  hepatic: 'Печень', cardio: 'Сердечно-сосудистая', endocrine: 'Эндокринная',
  lipid: 'Липидный обмен', renal: 'Почки', hematic: 'Кроветворение', immune: 'Иммунная',
  neuro: 'Нервная', reproductive: 'Репродуктивная', musculoskeletal: 'Суставы и связки'
};

interface Investigation {
  id: string;
  name: string;
  system: string;
  freq: string;
  markers: string;
  reason: string;
}

const INVESTIGATIONS_DATA: Investigation[] = [
  { id: 'echo_kg', name: 'ЭХО-КГ (Эхокардиография)', system: 'cardio', freq: 'Каждые 8 нед на курсе; перед курсом и после ПКТ', markers: 'Фракция выброса ЛЖ, толщина стенок ЖКЛ, клапаны, диастолическая функция, ФС, доля выброса', reason: 'ААБ вызывают гипертрофию ЛЖ, диастолическую дисфункцию, изменения клапанов. ЭХО-КГ — золотой стандарт мониторинга.' },
  { id: 'ekg', name: 'ЭКГ (Электрокардиография)', system: 'cardio', freq: 'Каждые 4 нед на курсе', markers: 'QTc, гипертрофия ЛЖ, аритмии, ишемия, блокады', reason: 'Ранняя диагностика аритмий (пролонгация QT), признаков гипертрофии и ишемии. Доступен и информативен.' },
  { id: 'usg_abd', name: 'УЗИ органов брюшной полости', system: 'hepatic', freq: 'Перед курсом, на 4-й неделе, после ПКТ', markers: 'Размеры печени, эхогенность, циррозный пучок, поджелудочная, селезёнка, почки, надпочечники', reason: 'Стеатоз, гепатомегалия, холестаз, кисты, инфекции. Обязательное базовое обследование.' },
  { id: 'usg_kidney', name: 'УЗИ почек и мочевыводящих путей', system: 'renal', freq: 'Перед курсом, при повышении креатинина', markers: 'Размеры почек, корковый слой, КЩФ, конкременты, скорость фильтрации (расчёт)', reason: 'Тренболон и другие ААБ — нефротоксичны. Ранняя диагностика структурных изменений.' },
  { id: 'usg_prostate', name: 'УЗИ предстательной железы (ТРУЗИ)', system: 'reproductive', freq: 'Перед курсом и после ПКТ (у мужчин)', markers: 'Объём предстательной железы, структура, PSA-зоны, конкременты', reason: 'ААБ (особенно тестостерон) вызывают гиперплазию предстательной железы. Мониторинг обязательный при >30 лет.' },
  { id: 'usg_thyroid', name: 'УЗИ щитовидной железы', system: 'endocrine', freq: 'Перед курсом (базовое), при симптомах', markers: 'Объём, структура, узлы, кровоток, лимфоузлы', reason: 'ААБ подавляют HPT-ось. Сверхфизиологические дозы тестостерона снижают TSH. Базовое УЗИ обязательно.' },
  { id: 'usg_heart_24h', name: 'Холтер-ЭКГ (24ч мониторинг)', system: 'cardio', freq: 'При симптомах аритмии на курсе', markers: 'Суточная ЧСС, эпизоды тахикардии/брадикардии, паузы, ST-депрессия', reason: 'Тренболон, кленбутерол, Т3 — высокий риск аритмий. Холтер — единственный способ выявить паразитарные нарушения.' },
  { id: 'mri_brain', name: 'МРТ головного мозга', system: 'neuro', freq: 'При стойких головных болях, нарушениях зрения', markers: 'Гипофиз (как/какоразмер), белое вещество, сосуды, объёмные образования', reason: 'ААБ могут вызывать гипофизарную недостаточность через подавление HPT. МРТ — при подозрении.' },
  { id: 'densitometry', name: 'Денситометрия (DEXA)', system: 'musculoskeletal', freq: 'Базовое; через 6 месяцев курса', markers: 'Минеральная плотность костей (T-score, Z-score), композиция тела', reason: 'ААБ в ПКТ-периоде (гипогонадизм) → риск остеопороза. Декса-зона, ароматазы-ингибиторы дополняют BMD.' },
  { id: 'usg_joints', name: 'УЗИ суставов', system: 'musculoskeletal', freq: 'При болях/хрусте в суставах', markers: 'Синовиальная жидкость, хрящ (толщина), кости, связки, сухожилия, сухожилия, воспаление', reason: 'Тренболон и Винстрол — риск сухожилий и повреждений. УЗИ позволяет объективно оценить состояние.' },
  { id: 'spirometry', name: 'Спирометрия', system: 'cardio', freq: 'Базовое; при одышке на курсе', markers: 'FEV1, FVC, FEV1/FVC (индекс Тиффно), PEF', reason: 'Оральные ААБ (17-α алкилированные) могут вызывать бронхоспазм. Контроль при жалобах.' },
  { id: 'abd_ct', name: 'КТ органов брюшной полости', system: 'hepatic', freq: 'При подозрении на гепатоцеллюлярную аденому', markers: 'Очаговые образования печени, adrenal incidentaloma, липаденома', reason: 'Уточняющий метод при нахождениях УЗИ. ААБ теоретически повышают риск гепатоцеллюлярной аденомы.' },
  { id: 'ambp', name: 'СМАД (24ч мониторинг АД)', system: 'cardio', freq: 'Каждые 4 нед на курсе при ААБ-индуцированной гипертензии', markers: 'Среднее систолическое/диастолическое, суточный индекс, утренний подъём, нарушения ритма', reason: 'ААБ повышают АД через ренин-ангиотензин, объём, сосудистый тонус. СМАД — точнее измерений.' },
];

const InvestigationsTab: React.FC = () => {
  const [collapsedSystems, setCollapsedSystems] = useState<Record<string, boolean>>({});
  const [invDone, setInvDone] = useState<Record<string, boolean>>({});

  const toggleSystem = (system: string) => {
    setCollapsedSystems(prev => ({ ...prev, [system]: !prev[system] }));
  };

  const toggleInv = (id: string) => {
    setInvDone(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const groupedBySystem = INVESTIGATIONS_DATA.reduce((acc, inv) => {
    if (!acc[inv.system]) acc[inv.system] = [];
    acc[inv.system].push(inv);
    return acc;
  }, {} as Record<string, Investigation[]>);

  return (
    <div className="card" style={{ fontSize: 12 }}>
      <h3 style={{ margin: '0 0 12px', color: 'var(--accent)' }}>Исследования и обследования</h3>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>Инструктивные и аппаратные исследования для мониторинга на курсе и в ПКТ</p>

      <div style={{ display: 'grid', gap: 8 }}>
        {Object.entries(groupedBySystem).map(([system, investigations]) => {
          const isCollapsed = collapsedSystems[system] || false;
          return (
            <div key={system} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-secondary)' }}>
              <div 
                style={{ 
                  padding: '10px 12px', 
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-tertiary)',
                }}
                onClick={() => toggleSystem(system)}
              >
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                  {SYSTEM_LABELS_INVEST[system] || system} 
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-dim)' }}>({investigations.length} исслед.)</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {isCollapsed ? '▼' : '▲'}
                </span>
              </div>
              {!isCollapsed && (
                <div style={{ padding: '8px 12px' }}>
                  {investigations.map(inv => {
                    const isDone = invDone[inv.id] ?? false;
                    return (
                      <div key={inv.id} style={{ 
                        background: isDone ? 'rgba(0,230,138,0.08)' : 'var(--bg-secondary)',
                        borderRadius: 8, 
                        padding: '10px 12px', 
                        border: isDone ? '1px solid var(--success)' : '1px solid var(--border)',
                        marginBottom: 8,
                        transition: 'all .2s'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 12, color: isDone ? 'var(--success)' : 'var(--text)', marginBottom: 2 }}>{inv.name}</div>
                            <div style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'inline-block' }}>{SYSTEM_LABELS_INVEST[inv.system] || inv.system}</div>
                          </div>
                          <button onClick={() => toggleInv(inv.id)} style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                            background: isDone ? 'var(--success-dim)' : 'var(--bg-tertiary)',
                            color: isDone ? 'var(--success)' : 'var(--text-dim)',
                            border: isDone ? '1px solid var(--success)' : '1px solid var(--border)',
                          }}>
                            {isDone ? 'Пройдено ✓' : 'Не пройдено'}
                          </button>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 2, fontWeight: 500 }}>Зачастота: {inv.freq}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}><b>Параметры:</b> {inv.markers}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.4 }}>{inv.reason}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CatalogTab: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter to show only pharma substances
  const pharmaSubstances = useMemo(() => {
    return Object.values(PHARMA_DB).filter(s => 
      PHARMA_CLASSES.includes(s.class as PharmaClass)
    );
  }, []);

  const filteredList = useMemo(() => {
    let list = filterClass === 'all' ? pharmaSubstances : pharmaSubstances.filter(s => s.class === filterClass);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || (s.class && s.class.toLowerCase().includes(q)));
    }
    return list;
  }, [filterClass, searchQuery, pharmaSubstances]);

  const selected = selectedId ? PHARMA_DB[selectedId] : null;
  const detail = selectedId ? PHARMA_DETAILS[selectedId] : undefined;

  return (
    <div className="catalog-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12 }}>
      <div style={{ maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', paddingRight: 4 }}>
        <input type="text" placeholder="Поиск препарата..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }} />
        <div className="pharma-class-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          <button onClick={() => setFilterClass('all')} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, border: filterClass === 'all' ? '1px solid var(--accent)' : '1px solid var(--border)', background: filterClass === 'all' ? 'rgba(0,230,138,0.15)' : 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Все</button>
          {PHARMA_CLASSES.map(cls => (
            <button key={cls} onClick={() => setFilterClass(cls)} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, border: filterClass === cls ? '1px solid var(--accent)' : '1px solid var(--border)', background: filterClass === cls ? 'rgba(0,230,138,0.15)' : 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>{CLASS_LABELS[cls] || cls}</button>
          ))}
        </div>
        {filteredList.map(s => (
          <div key={s.id} onClick={() => setSelectedId(s.id)} style={{
            padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
            background: selectedId === s.id ? 'rgba(0,230,138,0.12)' : 'var(--bg-secondary)',
            border: selectedId === s.id ? '1px solid var(--accent)' : '1px solid transparent',
          }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{CLASS_LABELS[s.class] || s.class}</div>
          </div>
        ))}
        {filteredList.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)' }}>
            {searchQuery ? 'Ничего не найдено' : 'Нет фарма препаратов'}
          </div>
        )}
      </div>
      <div style={{ maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>
        {selected ? <DrugDetailCard sub={selected} detail={detail} /> : (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💊</div>
            <div>Выберите препарат из списка</div>
          </div>
        )}
      </div>
    </div>
  );
};

const DrugDetailCard: React.FC<{ sub: PharmaSubstance; detail?: PharmaDetail }> = ({ sub, detail }) => {
  const pd = sub.pd;
  const pdEntries = Object.entries(pd) as [keyof PD, number][];

  const riskLabels: string[] = [];
  if (pd.hepatotoxicity >= 2) riskLabels.push('Гепатотоксичность высокая');
  if (pd.aromatization >= 0.7) riskLabels.push('Высокая ароматизация → эстрогенные побочки');
  if (pd.progestogenic >= 0.3) riskLabels.push('Прогестогенная активность → риск пролактина');
  if (pd.neuro_toxicity >= 0.3) riskLabels.push('Нейротоксичность');
  if (pd.lipid_impact <= -0.5) riskLabels.push('Сильное ухудшение липидного профиля');
  if (pd.hct_impact >= 4) riskLabels.push('Значительный рост HCT');

  const effectLabels: string[] = [];
  if (pd.AR_affinity >= 1.0) effectLabels.push('Высокая AR-активация');
  else if (pd.AR_affinity >= 0.7) effectLabels.push('Умеренная AR-активация');
  if (pd.five_alpha_reduction >= 0.5) effectLabels.push('Подвержен 5α-редуктазе');
  if (pd.aromatization === 0) effectLabels.push('Не ароматизируется');
  if (sub.class === 'sarm') effectLabels.push('Селективная AR-модуляция');

  return (
    <div className="card" style={{ fontSize: 12, lineHeight: 1.6 }}>
      <h3 style={{ margin: '0 0 8px', color: 'var(--accent)' }}>{sub.name}</h3>
      <div className="pharma-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 8 }}>
        <span>Класс:</span><span style={{ fontWeight: 600 }}>{CLASS_LABELS[sub.class] || sub.class}</span>
        <span>T½:</span><span style={{ fontWeight: 600 }}>{formatHalfLife(sub.pk.halfLifeHours)}</span>
        <span>Биодоступность:</span><span style={{ fontWeight: 600 }}>{(sub.pk.bioavailability * 100).toFixed(0)}%</span>
        <span>Vd:</span><span style={{ fontWeight: 600 }}>{sub.pk.Vd} л</span>
        <span>Эстеры:</span><span style={{ fontWeight: 600 }}>{sub.esters?.join(', ') || '—'}</span>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Фармакодинамика</div>
        {pdEntries.map(([key, val]) => {
          const absVal = Math.abs(val);
          const maxScale = key === 'AR_affinity' ? 2 : key === 'hct_impact' ? 6 : key === 'hepatotoxicity' ? 4 : 1.2;
          const pct = Math.min(100, (absVal / maxScale) * 100);
          return (
            <div key={key} style={{ marginBottom: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{PD_LABELS[key]}</span>
                <span style={{ color: pdBarColor(key, val) }}>{val.toFixed(2)}</span>
              </div>
              <div style={{ background: 'var(--border)', borderRadius: 2, height: 4 }}>
                <div style={{ width: `${pct}%`, background: pdBarColor(key, val), height: 4, borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>

      {effectLabels.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>Эффекты: </span>
          <span style={{ color: '#4caf50' }}>{effectLabels.join(' · ')}</span>
        </div>
      )}
      {riskLabels.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>Риски: </span>
          <span style={{ color: '#ff5252' }}>{riskLabels.join(' · ')}</span>
        </div>
      )}

      {detail && (
        <>
          {detail.description && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Описание</div>
              <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>{detail.description}</div>
            </div>
          )}
          {detail.mechanism && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Механизм действия</div>
              <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>{detail.mechanism}</div>
            </div>
          )}
          {detail.dosageRange && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Диапазон дозировок</div>
              <div className="pharma-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
                <span>Минимум:</span><span>{detail.dosageRange.min} {detail.dosageRange.unit}</span>
                <span>Максимум:</span><span style={{ color: '#ff9100' }}>{detail.dosageRange.max} {detail.dosageRange.unit}</span>
                <span>Частота:</span><span>{detail.dosageRange.frequency}</span>
              </div>
            </div>
          )}
          {detail.synergies && detail.synergies.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Синергия и комбинации</div>
              {detail.synergies.map((s, i) => (
                <div key={i} style={{ marginBottom: 4, padding: '4px 8px', borderRadius: 4, background: s.type === 'synergistic' ? 'rgba(0,230,138,0.08)' : s.type === 'antagonistic' ? 'rgba(255,23,68,0.08)' : 'rgba(41,121,255,0.08)' }}>
                  <span style={{ fontWeight: 600, color: s.type === 'synergistic' ? '#00e68a' : s.type === 'antagonistic' ? '#ff1744' : '#2979ff' }}>
                    {s.type === 'synergistic' ? '⊕' : s.type === 'antagonistic' ? '⊖' : '→'} {PHARMA_DB[s.with]?.name || s.with}
                  </span>
                  <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>{s.desc}</span>
                </div>
              ))}
            </div>
          )}
          {detail.sideEffects && detail.sideEffects.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Побочные эффекты</div>
              {detail.sideEffects.map((se, i) => (
                <div key={i} style={{ marginBottom: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{se.effect}</span>
                  <span style={{ color: se.frequency === 'common' ? '#ff9100' : se.frequency === 'rare' ? '#2979ff' : '#ff1744', fontWeight: 600, fontSize: 11 }}>
                    {se.frequency === 'common' ? 'Часто' : se.frequency === 'rare' ? 'Редко' : 'Очень редко'}
                  </span>
                </div>
              ))}
            </div>
          )}
          {sub.research && sub.research.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📚</span><span>Исследования</span>
              </div>
              {sub.research.map((r, i) => (
                <div key={i} style={{ marginBottom: 8, padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{r.study}</span>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.1)', color: '#00e68a' }}>{r.year}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>{r.conclusion}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface DrugDose {
  substanceId: string;
  doseMg: number;
  frequencyDays: number[];
  totalWeeks: number;
}

const DRUG_COLORS = ['#7c4dff', '#ff1744', '#00e68a', '#ff9100', '#3b82f6', '#f44336', '#4caf50', '#9c27b0', '#ff5722', '#2196f3'];
const DAY_SHORT = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const PKPDSimulationTab: React.FC = () => {
  const [drugDoses, setDrugDoses] = useState<DrugDose[]>([
    { substanceId: 'test_enan', doseMg: 250, frequencyDays: [1, 4], totalWeeks: 12 },
  ]);
  const [simResult, setSimResult] = useState<{
    points: { week: number; cp: number; effect: number; tol: number }[];
    perDrug: { substanceId: string; name: string; points: { week: number; cp: number }[] }[];
    peak: number; trough: number; ssDays: number;
  } | null>(null);

  // Filter to show only pharma substances
  const allSubstances = useMemo(() => {
    return Object.values(PHARMA_DB).filter(s => 
      PHARMA_CLASSES.includes(s.class as PharmaClass)
    );
  }, []);

  const addDrug = () => {
    const lastId = drugDoses.length > 0 ? drugDoses[drugDoses.length - 1].substanceId : 'test_enan';
    setDrugDoses([...drugDoses, { substanceId: lastId, doseMg: 250, frequencyDays: [1, 4], totalWeeks: 12 }]);
  };

  const removeDrug = (idx: number) => {
    setDrugDoses(drugDoses.filter((_, i) => i !== idx));
  };

  const updateDrug = (idx: number, field: keyof DrugDose, value: string | number | number[]) => {
    const updated = [...drugDoses];
    updated[idx] = { ...updated[idx], [field]: value };
    setDrugDoses(updated);
  };

  const buildEntries = (doses: DrugDose[]): CourseEntry[] => {
    const result: CourseEntry[] = [];
    doses.forEach((dd) => {
      const scheduleSet = new Set(dd.frequencyDays);
      for (let w = 0; w < dd.totalWeeks; w++) {
        for (let d = 1; d <= 7; d++) {
          if (scheduleSet.has(d)) {
            result.push({
              id: `${dd.substanceId}-${w}-${d}`,
              substanceId: dd.substanceId,
              doseValue: dd.doseMg,
              doseUnit: 'mg',
              frequency: `${scheduleSet.size}x/week`,
              startWeek: 0,
              endWeek: dd.totalWeeks,
            });
          }
        }
      }
    });
    return result;
  };

  const runSimulation = () => {
    const maxWeeks = Math.max(...drugDoses.map(d => d.totalWeeks));
    const allEntries = buildEntries(drugDoses);
    if (allEntries.length === 0) return;

    const superpositionResult = calculateMultiSubstancePKPD(allEntries, maxWeeks);

    // Per-drug simulations
    const perDrug: { substanceId: string; name: string; points: { week: number; cp: number }[] }[] = [];
    drugDoses.forEach((dd) => {
      const singleEntries = buildEntries([dd]);
      const singleResult = calculateMultiSubstancePKPD(singleEntries, maxWeeks);
      const sub = PHARMA_DB[dd.substanceId];
      perDrug.push({
        substanceId: dd.substanceId,
        name: sub?.name || dd.substanceId,
        points: singleResult.map(p => ({ week: p.week, cp: p.cp })),
      });
    });

    const firstDrug = PHARMA_DB[drugDoses[0].substanceId];
    let peak = 0;
    let trough = Infinity;
    let ssDays = 0;

    if (firstDrug && drugDoses[0].frequencyDays.length > 0) {
      const intervalH = (168 / drugDoses[0].frequencyDays.length);
      try {
        peak = steadyStatePeak({
          dose: drugDoses[0].doseMg,
          bioavailability: firstDrug.pk.bioavailability * 100,
          Vd: firstDrug.pk.Vd,
          tHalfHours: firstDrug.pk.halfLifeHours,
          intervalHours: intervalH,
        });
        trough = steadyStateTrough({
          dose: drugDoses[0].doseMg,
          bioavailability: firstDrug.pk.bioavailability * 100,
          Vd: firstDrug.pk.Vd,
          tHalfHours: firstDrug.pk.halfLifeHours,
          intervalHours: intervalH,
        });
      } catch { peak = 0; trough = 0; }

      const k = eliminationConstant(firstDrug.pk.halfLifeHours);
      ssDays = Math.ceil(5 * (firstDrug.pk.halfLifeHours / 24));
    }

    setSimResult({ points: superpositionResult, perDrug, peak, trough, ssDays });
  };

  const chart = useMemo(() => {
    if (!simResult || simResult.points.length === 0) return null;
    const W = 600;
    const H = 220;
    const PAD = 34;
    const pts = simResult.points;
    const maxCp = Math.max(...pts.map(p => p.cp), ...simResult.perDrug.flatMap(d => d.points.map(p => p.cp)), 1);
    const maxWeek = pts[pts.length - 1].week;

    const toX = (w: number) => PAD + (w / maxWeek) * (W - 2 * PAD);
    const toY = (cp: number) => H - PAD - (cp / maxCp) * (H - 2 * PAD);

    // Combined (total) concentration line
    const totalPathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.week).toFixed(1)},${toY(p.cp).toFixed(1)}`).join(' ');
    // Effect line
    const effectPathD = pts.map((p, i) => {
      const ey = H - PAD - (p.effect / 100) * (H - 2 * PAD);
      return `${i === 0 ? 'M' : 'L'}${toX(p.week).toFixed(1)},${ey.toFixed(1)}`;
    }).join(' ');

    // Per-drug lines
    const perDrugPaths = simResult.perDrug.map((drug, di) => {
      const color = DRUG_COLORS[di % DRUG_COLORS.length];
      const d = drug.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.week).toFixed(1)},${toY(p.cp).toFixed(1)}`).join(' ');
      return { substanceId: drug.substanceId, name: drug.name, d, color };
    });

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((frac) => {
      const y = H - PAD - frac * (H - 2 * PAD);
      return `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="var(--border)" stroke-width="0.5"/>`;
    });

    const weekMarkers: string[] = [];
    const step = maxWeek <= 12 ? 1 : maxWeek <= 24 ? 2 : 4;
    for (let w = 0; w <= maxWeek; w += step) {
      const x = toX(w);
      weekMarkers.push(`<text x="${x}" y="${H - PAD + 14}" fill="var(--text-dim)" font-size="9" text-anchor="middle">${w}</text>`);
    }

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
        {gridLines.map((l, i) => <g key={i} dangerouslySetInnerHTML={{ __html: l }} />)}
        {/* Per-drug lines (dashed, behind total) */}
        {perDrugPaths.map((pd, i) => (
          <g key={pd.substanceId}>
            <path d={pd.d} fill="none" stroke={pd.color} strokeWidth="1" strokeDasharray="3 2" opacity={0.6} />
          </g>
        ))}
        {/* Total line */}
        <path d={totalPathD} fill="none" stroke="var(--accent, #7c4dff)" strokeWidth="2.5" opacity={0.9} />
        <path d={effectPathD} fill="none" stroke="#4caf50" strokeWidth="1.5" strokeDasharray="4 2" opacity={0.8} />
        {weekMarkers.map((m, i) => <g key={`w${i}`} dangerouslySetInnerHTML={{ __html: m }} />)}
        {/* Legend */}
        <text x={PAD} y={11} fill="var(--accent)" fontSize="9" fontWeight={700}>Суммарная концентрация</text>
        {perDrugPaths.map((pd, i) => (
          <text key={pd.substanceId} x={PAD + (i > 0 ? 130 : 0)} y={i === 0 ? 22 : 11}
            fill={pd.color} fontSize="8" opacity={0.8}>
            ― {pd.name}
          </text>
        ))}
        <text x={W - PAD} y={11} fill="#4caf50" fontSize="9" textAnchor="end">Эффект %</text>
        <text x={W / 2} y={H - 2} fill="var(--text-dim)" fontSize="9" textAnchor="middle">Недели</text>
      </svg>
    );
  }, [simResult]);

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {drugDoses.map((dd, idx) => (
          <div key={idx} className="card" style={{ padding: 8, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <select
                value={dd.substanceId}
                onChange={(e) => updateDrug(idx, 'substanceId', e.target.value)}
                style={{ fontSize: 12, flex: 1, marginRight: 8 }}
              >
                {allSubstances.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {drugDoses.length > 1 && (
                <button className="btn" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => removeDrug(idx)}>✕</button>
              )}
            </div>
            <div className="pharma-dosage-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Доза (мг)</label>
                <input type="number" value={dd.doseMg} onChange={(e) => updateDrug(idx, 'doseMg', Number(e.target.value))} style={{ width: '100%', fontSize: 12 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2, display: 'block' }}>Дни инъекций</label>
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {[1,2,3,4,5,6,7].map(d => {
                    const active = dd.frequencyDays.includes(d);
                    return (
                      <button key={d} type="button" onClick={() => {
                        const next = active ? dd.frequencyDays.filter(x => x !== d) : [...dd.frequencyDays, d].sort();
                        updateDrug(idx, 'frequencyDays', next);
                      }} style={{
                        width: 26, height: 26, borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                        background: active ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: active ? '#000' : 'var(--text-dim)',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      }}>{DAY_SHORT[d]}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Недель</label>
                <input type="number" value={dd.totalWeeks} onChange={(e) => updateDrug(idx, 'totalWeeks', Number(e.target.value))} style={{ width: '100%', fontSize: 12 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn" onClick={runSimulation}>Симуляция</button>
        <button className="btn" onClick={addDrug}>+ Препарат</button>
      </div>

      {simResult && (
        <div>
          <div className="card" style={{ fontSize: 12, marginBottom: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div><span style={{ color: 'var(--text-dim)' }}>Cmax стацион.:</span><br/><strong>{simResult.peak.toFixed(1)} мг/л</strong></div>
              <div><span style={{ color: 'var(--text-dim)' }}>Cmin стацион.:</span><br/><strong>{simResult.trough.toFixed(1)} мг/л</strong></div>
              <div><span style={{ color: 'var(--text-dim)' }}>Стацион. ≈:</span><br/><strong>{simResult.ssDays} дн</strong></div>
            </div>
            {simResult.peak > 50 && (
              <div style={{ color: '#ff1744', marginTop: 6, fontWeight: 600 }}>⚠ Высокая пиковая концентрация — риск побочных эффектов</div>
            )}
            {simResult.points.length > 0 && simResult.points[simResult.points.length - 1].tol > 0.3 && (
              <div style={{ color: '#ff9100', marginTop: 4 }}>⚠ Значительная толерантность ({(simResult.points[simResult.points.length - 1].tol * 100).toFixed(0)}%)</div>
            )}
          </div>
          <div className="card" style={{ padding: 4 }}>
            {chart}
          </div>
        </div>
      )}
    </div>
  );
};

const DosageCalculatorTab: React.FC = () => {
  const allPharma = Object.values(PHARMA_DB).filter((s) => PHARMA_CLASSES.includes(s.class as PharmaClass));
  const [drug, setDrug] = useState('');
  const [mgKg, setMgKg] = useState(2);
  const [weight, setWeight] = useState(90);
  const [concentration, setConcentration] = useState(250);
  const [result, setResult] = useState<string | null>(null);

  const run = () => {
    if (!drug) return;
    const sub = PHARMA_DB[drug];
    const baseMg = mgKg * weight;
    const dose = calculateDose({
      targetDoseMg: baseMg,
      concentrationMgPerMl: concentration,
      roundingStepMl: 0.01,
      syringeVolumeMl: 1,
      divisionsPerMl: 100,
    });
    setResult(
      `${sub?.name ?? drug}\n` +
      `Базовая доза: ${baseMg.toFixed(1)} мг (${mgKg} мг/кг, вес ${weight} кг)\n` +
      `Объём инъекции: ${dose.volumeMl} мл\n` +
      `Деления шприца: ${dose.divisions}\n` +
      `Доз на флакон: ${dose.dosesPerVial || '—'}\n` +
      (dose.flags.length ? `⚠ ${dose.flags.join(', ')}` : '✓ Готово к введению')
    );
  };

  return (
    <div>
      <div className="card">
        <select value={drug} onChange={(e) => setDrug(e.target.value)}>
          <option value="">Выберите препарат</option>
          {allPharma.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({CLASS_LABELS[p.class] || p.class})</option>
          ))}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <input type="number" value={mgKg} onChange={(e) => setMgKg(Number(e.target.value))} placeholder="мг/кг" />
          <input type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value))} placeholder="Вес (кг)" />
          <input type="number" value={concentration} onChange={(e) => setConcentration(Number(e.target.value))} placeholder="мг/мл" />
        </div>
        <button onClick={run} className="btn">Рассчитать</button>
      </div>
      {result && <pre className="output" style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{result}</pre>}
    </div>
  );
};

const InteractionCheckerTab: React.FC = () => {
  // Filter to show only pharma substances
  const allSubstances = useMemo(() => {
    return Object.values(PHARMA_DB).filter(s => 
      PHARMA_CLASSES.includes(s.class as PharmaClass)
    );
  }, []);
  const [selectedIds, setSelectedIds] = useState<string[]>(['', '']);

  const addDrug = () => setSelectedIds([...selectedIds, '']);
  const removeDrug = (idx: number) => setSelectedIds(selectedIds.filter((_, i) => i !== idx));
  const updateDrug = (idx: number, value: string) => {
    const updated = [...selectedIds];
    updated[idx] = value;
    setSelectedIds(updated);
  };

  const alerts = useMemo(() => {
    const validIds = selectedIds.filter(Boolean);
    if (validIds.length < 2) return null;

    const course: CourseEntry[] = validIds.map((id, i) => ({
      id: `${id}-${i}`,
      substanceId: id,
      doseValue: 300,
      doseUnit: 'mg/wk',
      frequency: '2x/week',
      startWeek: 0,
      endWeek: 12,
    }));

    return checkDrugInteractions(course);
  }, [selectedIds]);

  const hasAlerts = alerts && alerts.length > 0;

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {selectedIds.map((id, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8 }}>
            <select value={id} onChange={(e) => updateDrug(idx, e.target.value)} style={{ flex: 1, fontSize: 12 }}>
              <option value="">Выберите препарат</option>
              {allSubstances.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {selectedIds.length > 2 && (
              <button className="btn" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => removeDrug(idx)}>✕</button>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn" onClick={addDrug}>+ Препарат</button>
      </div>

      {alerts === null && (
        <div className="card" style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
          Выберите минимум 2 препарата для проверки взаимодействий
        </div>
      )}

      {alerts !== null && !hasAlerts && (
        <div className="card" style={{ fontSize: 12, color: '#4caf50', textAlign: 'center' }}>
          ✓ Критических взаимодействий не обнаружено
        </div>
      )}

      {hasAlerts && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts!.map((alert, i) => (
            <div
              key={i}
              className="card"
              style={{
                borderLeft: `4px solid ${SEVERITY_COLORS[alert.type] || '#666'}`,
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{
                  fontWeight: 700,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  color: SEVERITY_COLORS[alert.type],
                  padding: '2px 8px',
                  borderRadius: 3,
                  background: `${SEVERITY_COLORS[alert.type]}22`,
                }}>
                  {alert.type === 'critical' ? 'КРИТИЧЕСКОЕ' : alert.type === 'warning' ? 'ПРЕДУПРЕЖДЕНИЕ' : 'ИНФО'}
                </span>
                <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                  {alert.drugs.join(' + ')}
                </span>
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>Механизм:</span> {alert.mechanism}
              </div>
              <div>
                <span style={{ fontWeight: 600 }}>Рекомендация:</span> {alert.recommendation}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Synergies Section */}
      {SYNERGY_PAIRS.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>💥 Синергии и комбинации</h3>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>
            Ключевые синергетические пары между препаратами
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
            {SYNERGY_PAIRS.map((pair, i) => {
              const synergyColors: Record<string, string> = {
                synergistic: 'rgba(0,230,138,0.1)',
                additive: 'rgba(59,130,246,0.1)',
                potentiative: 'rgba(249,115,22,0.1)',
                complementary: 'rgba(168,85,247,0.1)',
              };
              const synergyColorsText: Record<string, string> = {
                synergistic: '#00e68a',
                additive: '#3b82f6',
                potentiative: '#f97316',
                complementary: '#a855f7',
              };
              
              return (
                <div key={i} style={{
                  background: synergyColors[pair.synergyType] || 'rgba(255,255,255,0.03)',
                  borderRadius: 6,
                  padding: '10px 12px',
                  border: '1px solid ' + (synergyColorsText[pair.synergyType] || '#888') + '40',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: synergyColorsText[pair.synergyType] + '20',
                      color: synergyColorsText[pair.synergyType],
                      textTransform: 'uppercase',
                    }}>
                      {(() => {
                        switch (pair.synergyType) {
                          case 'synergistic': return '⊕ Синергия';
                          case 'additive': return '+ Аддитивно';
                          case 'potentiative': return '↗ Усиление';
                          case 'complementary': return '↔ Дополнение';
                          default: return '↔ Дополнение';
                        }
                      })()}
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: synergyColorsText[pair.synergyType],
                    }}>
                      Сила: {Math.round(pair.strength * 100)}%
                    </span>
                  </div>
                  
                  <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-light)' }}>
                    {pair.mechanism}
                  </div>
                  
                  {pair.clinicalNote && (
                    <div style={{
                      marginTop: 6,
                      fontSize: 10,
                      color: '#22c55e',
                      fontStyle: 'italic',
                    }}>
                      💡 {pair.clinicalNote}
                    </div>
                  )}
                  
                  {pair.affectedSystems && pair.affectedSystems.length > 0 && (
                    <div style={{
                      marginTop: 6,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 3,
                    }}>
                      {pair.affectedSystems.map(sys => (
                        <span key={sys} style={{
                          fontSize: 8,
                          padding: '1px 4px',
                          borderRadius: 3,
                          background: 'rgba(255,255,255,0.1)',
                          color: 'var(--text-dim)',
                        }}>
                          {SYSTEM_LABELS[sys] || sys}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
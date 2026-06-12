import React, { useState } from 'react';
import { UCUM_MAP } from '../../../core/constants';

interface InvestigationItem {
  id: string;
  name: string;
  type: string;
  description: string;
  frequency: string;
  markers: string[];
  isInstrumental: boolean;
}

const TYPE_CONFIG: Record<string, { label: string }> = {
  blood: { label: 'Общий анализ крови' },
  biochemistry: { label: 'Биохимия' },
  hormones: { label: 'Гормональный профиль' },
  immunology: { label: 'Иммунология / Воспаление' },
  lipids: { label: 'Липидный профиль' },
  metabolic: { label: 'Метаболизм / Витамины' },
  minerals: { label: 'Минералы / Электролиты' },
  instrumental: { label: 'Инструментальные исследования' },
};

const INVESTIGATIONS: InvestigationItem[] = [
  { id: 'cbc', name: 'Общий анализ крови', type: 'blood',
    description: 'Базовый гематологический скрининг. Оценка эритропоэза, тромбоцитарного и лейкоцитарного ростков.',
    frequency: 'Каждые 3-6 мес на курсе',
    markers: ['HGB', 'HCT', 'WBC', 'PLT'], isInstrumental: false },
  { id: 'cbc_ext', name: 'Общий анализ крови (расширенный)', type: 'blood',
    description: 'Полная гемограмма с эритроцитарными индексами и RDW.',
    frequency: 'Каждые 6 мес',
    markers: ['HGB', 'HCT', 'WBC', 'PLT', 'RBC', 'MCV', 'MCH', 'MCHC', 'RDW'], isInstrumental: false },
  { id: 'leukocyte_formula', name: 'Лейкоцитарная формула', type: 'blood',
    description: 'Дифференцированный подсчёт лейкоцитов: нейтрофилы, лимфоциты, моноциты, эозинофилы, базофилы.',
    frequency: 'Каждые 3-6 мес',
    markers: ['WBC'], isInstrumental: false },

  { id: 'liver_panel', name: 'Печёночные пробы', type: 'biochemistry',
    description: 'Оценка цитолиза, холестаза и синтетической функции печени. Ключевой контроль гепатотоксичности ААС.',
    frequency: 'Каждые 3-6 мес на курсе',
    markers: ['ALT', 'AST', 'GGT', 'ALP', 'BIL', 'ALB', 'TP'], isInstrumental: false },
  { id: 'renal_panel', name: 'Почечный профиль', type: 'biochemistry',
    description: 'Функция почек, азотемия, фильтрация. Контроль нефротоксичности.',
    frequency: 'Каждые 3-6 мес',
    markers: ['CREATININE', 'UREA', 'EGFR', 'UA'], isInstrumental: false },
  { id: 'enzymes', name: 'Ферменты сыворотки', type: 'biochemistry',
    description: 'Дополнительные ферменты для оценки повреждения тканей.',
    frequency: 'По показаниям',
    markers: ['LDH', 'CK'], isInstrumental: false },

  { id: 'hormone_basic', name: 'Базовый гормональный профиль', type: 'hormones',
    description: 'Оценка HPTA-оси: андрогены, эстрогены, гонадотропины, ГСПГ. Базовый контроль на курсе.',
    frequency: 'Каждые 4-6 нед на курсе, через 4-6 нед после ПКТ',
    markers: ['TT', 'FT', 'E2', 'PRL', 'LH', 'FSH', 'SHBG'], isInstrumental: false },
  { id: 'hormone_thyroid', name: 'Тиреоидный профиль', type: 'hormones',
    description: 'Функция щитовидной железы. Контроль на фоне препаратов, влияющих на ось HPT.',
    frequency: '1 раз/3-6 мес',
    markers: ['TSH', 'FT3', 'FT4'], isInstrumental: false },
  { id: 'hormone_adrenal', name: 'Надпочечниковый профиль', type: 'hormones',
    description: 'Гормоны коры надпочечников и анаболического статуса.',
    frequency: '1 раз/6 мес',
    markers: ['CORTISOL', 'DHEA_S', 'IGF1'], isInstrumental: false },
  { id: 'hormone_fertility', name: 'Фертильность / Репродукция', type: 'hormones',
    description: 'Маркёры фертильности, функции тестикул и овариального резерва.',
    frequency: 'Через 3-4 мес после отмены ААС',
    markers: ['AMH', 'INHB', 'PSA', 'PROG'], isInstrumental: false },

  { id: 'inflammation', name: 'Маркёры воспаления', type: 'immunology',
    description: 'Неспецифические маркёры системного воспаления и иммунного ответа.',
    frequency: '1 раз/3-6 мес',
    markers: ['CRP', 'FIBRINOGEN', 'D_DIMER'], isInstrumental: false },

  { id: 'lipid_basic', name: 'Липидограмма (базовая)', type: 'lipids',
    description: 'Базовый скрининг атерогенности плазмы. Контроль дислипидемии на ААС и ГХСБ.',
    frequency: 'Каждые 3-6 мес',
    markers: ['LDL', 'HDL', 'TG'], isInstrumental: false },

  { id: 'diabetes_screen', name: 'Скрининг диабета / ИР', type: 'metabolic',
    description: 'Оценка углеводного обмена, инсулинорезистентности и риска метаболического синдрома.',
    frequency: 'Каждые 3-6 мес',
    markers: ['GLU', 'INS', 'HOMA', 'HbA1c'], isInstrumental: false },
  { id: 'vitamins', name: 'Витамины и микронутриенты', type: 'metabolic',
    description: 'Ключевые витамины для метаболизма, иммунитета и эндокринной функции.',
    frequency: '1 раз/6 мес',
    markers: ['VITD', 'B12', 'FOL'], isInstrumental: false },
  { id: 'bone_metabolism', name: 'Костный обмен', type: 'metabolic',
    description: 'Маркёры костного метаболизма и риска остеопороза на длительной ГХСБ.',
    frequency: '1 раз/год',
    markers: ['CA', 'P', 'MG', 'VITD'], isInstrumental: false },

  { id: 'electrolytes', name: 'Электролиты плазмы', type: 'minerals',
    description: 'Контроль водно-электролитного баланса, функции почек, надпочечников.',
    frequency: 'Каждые 3-6 мес',
    markers: ['NA', 'K', 'CA', 'P', 'MG'], isInstrumental: false },
  { id: 'iron_panel', name: 'Обмен железа', type: 'minerals',
    description: 'Маркёры дефицита или перегрузки железом. Контроль гемохроматоза на ААС.',
    frequency: '1 раз/3-6 мес',
    markers: ['FERRITIN', 'TIBC'], isInstrumental: false },

  { id: 'echo_kg', name: 'Эхокардиограмма (Эхо-КГ)', type: 'instrumental',
    description: 'Структура сердца, фракция выброса, клапаны, размеры камер. ААС влияют на массу миокарда ЛЖ.',
    frequency: '1 раз/год на курсе',
    markers: ['ECHO_EF', 'ECHO_LV_MASS', 'ECHO_LA'], isInstrumental: true },
  { id: 'ekg', name: 'Электрокардиограмма (ЭКГ)', type: 'instrumental',
    description: 'Скрининг аритмий, гипертрофии ЛЖ, ишемии, блокад. Контроль QTc на фоне ААС.',
    frequency: 'Каждые 3-6 мес',
    markers: ['HR', 'QTc'], isInstrumental: true },
  { id: 'holter', name: 'Холтер (суточное мониторирование ЭКГ)', type: 'instrumental',
    description: 'Аритмии, ишемия, вариабельность ритма. При симптомах: сердцебиение, одышка, предобмороки.',
    frequency: 'По показаниям',
    markers: ['HR'], isInstrumental: true },
  { id: 'usg_abd', name: 'УЗИ органов брюшной полости', type: 'instrumental',
    description: 'Размеры печени, эхогенность, очаги, диффузные изменения. Контроль гепатотоксичности, скрининг НАЖБП.',
    frequency: '1 раз/6 мес на курсе',
    markers: [], isInstrumental: true },
  { id: 'fibroscan', name: 'Фиброскан (эластография печени)', type: 'instrumental',
    description: 'Степень фиброза и стеатоза (кПа, CAP). При длительном приёме ААС или повышенных трансаминазах.',
    frequency: '1 раз/год',
    markers: [], isInstrumental: true },
  { id: 'usg_kidney', name: 'УЗИ почек', type: 'instrumental',
    description: 'Размеры, структура, конкременты, кровоток. Контроль нефротоксичности и МКБ.',
    frequency: '1 раз/год',
    markers: [], isInstrumental: true },
  { id: 'mri_brain', name: 'МРТ головного мозга', type: 'instrumental',
    description: 'Очаги, атрофия, гипофиз, гипоталамус. При неврологической симптоматике или подозрении на аденому гипофиза.',
    frequency: 'По показаниям',
    markers: [], isInstrumental: true },
  { id: 'eeg', name: 'Электроэнцефалограмма (ЭЭГ)', type: 'instrumental',
    description: 'Биоэлектрическая активность, эпиактивность. При судорогах, нарушениях сна, когнитивных жалобах.',
    frequency: 'По показаниям',
    markers: [], isInstrumental: true },
  { id: 'usg_thyroid', name: 'УЗИ щитовидной железы', type: 'instrumental',
    description: 'Размеры, узлы, структура, кровоток. Контроль на фоне препаратов, влияющих на ось HPT.',
    frequency: '1 раз/год',
    markers: [], isInstrumental: true },
  { id: 'usg_prostate', name: 'УЗИ простаты (ТРУЗИ)', type: 'instrumental',
    description: 'Объём, структура, узлы, остаточная моча. Скрининг ДГПЖ на фоне андрогенов.',
    frequency: '1 раз/год после 40',
    markers: ['PSA'], isInstrumental: true },
  { id: 'spermiogram', name: 'Спермограмма', type: 'instrumental',
    description: 'Концентрация, подвижность, морфология, MAR-тест. Оценка фертильности после курса ААС.',
    frequency: 'Через 3-4 мес после отмены',
    markers: [], isInstrumental: true },
  { id: 'densitometry', name: 'Денситометрия (DXA)', type: 'instrumental',
    description: 'Минеральная плотность костей (T-критерий). Контроль костной массы на длительной ГХСБ и антиэстрогенах.',
    frequency: '1 раз/1-2 года',
    markers: ['VITD', 'CA'], isInstrumental: true },
  { id: 'usg_joints', name: 'УЗИ суставов', type: 'instrumental',
    description: 'Выпот, синовит, энтезопатии, эрозии. При суставных болях на фоне ААС или ГХСБ.',
    frequency: 'По показаниям',
    markers: [], isInstrumental: true },
  { id: 'blood_pressure_monitor', name: 'Мониторинг артериального давления', type: 'instrumental',
    description: 'Контроль АД для скрининга гипертензии на фоне ААС и ГХСБ.',
    frequency: 'Еженедельно на курсе',
    markers: ['BP_SYSTOLIC', 'BP_DIASTOLIC'], isInstrumental: true },
];

export const LabsInvestigations: React.FC = () => {
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const t of Object.keys(TYPE_CONFIG)) init[t] = true;
    return init;
  });
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const toggleType = (type: string) => setExpandedTypes(prev => ({ ...prev, [type]: !prev[type] }));
  const toggleCard = (id: string) => setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));

  const typeOrder = Object.keys(TYPE_CONFIG);
  const grouped = typeOrder.map(t => ({ type: t, items: INVESTIGATIONS.filter(i => i.type === t) })).filter(g => g.items.length > 0);

  const totalCount = INVESTIGATIONS.length;

  return (
    <div style={{ height: 'calc(100vh - 100px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 13, fontWeight: 700, padding: '8px 0 4px', flexShrink: 0 }}>Обследования и панели</div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8, flexShrink: 0 }}>
        {totalCount} исследований и лабораторных панелей для мониторинга на курсе
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {grouped.map(g => (
          <div key={g.type} className="card" style={{ marginBottom: 8, padding: 0, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div onClick={() => toggleType(g.type)} style={{
              padding: '10px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--bg-secondary)', userSelect: 'none', borderBottom: expandedTypes[g.type] ? '1px solid var(--border)' : 'none',
            }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{TYPE_CONFIG[g.type].label}</span>
                <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-dim)' }}>{g.items.length}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', transition: 'transform 0.2s', transform: expandedTypes[g.type] ? 'rotate(180deg)' : 'none' }}>▼</span>
            </div>
            {expandedTypes[g.type] && (
              <div style={{ padding: '6px 10px 10px' }}>
                {g.items.map(inv => {
                  const expanded = expandedCards[inv.id] || false;
                  return (
                    <div key={inv.id} onClick={() => toggleCard(inv.id)} style={{
                      background: expanded ? 'rgba(0,230,138,0.04)' : 'var(--bg-secondary)',
                      borderRadius: 10, padding: '10px 12px', marginBottom: 6, cursor: 'pointer',
                      border: expanded ? '1px solid rgba(0,230,138,0.2)' : '1px solid var(--border)',
                      transition: 'all 0.15s',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: expanded ? 8 : 0 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, color: expanded ? 'var(--accent)' : 'var(--text)', marginBottom: 3 }}>{inv.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.35, marginBottom: 4 }}>{inv.description}</div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600, background: 'rgba(0,230,138,0.08)', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>⏱ {inv.frequency}</span>
                            <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                              {inv.markers.length > 0 ? `${inv.markers.length} маркеров` : `${inv.isInstrumental ? 'Инструментальное исследование' : 'Описательная оценка'}`}
                            </span>
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0, marginLeft: 8, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▾</span>
                      </div>
                      {expanded && (
                        <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                          {inv.isInstrumental ? (
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.4 }}>
                              {inv.markers.length > 0 ? (
                                <>
                                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>Контролируемые параметры:</div>
                                  {inv.markers.map(code => {
                                    const info = UCUM_MAP[code];
                                    return (
                                      <div key={code} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 10, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <span style={{ color: 'var(--text)' }}>{info?.name || code}</span>
                                        {info && <span style={{ color: 'var(--text-dim)' }}>{info.lln}–{info.uln} {info.prefUnit}</span>}
                                      </div>
                                    );
                                  })}
                                </>
                              ) : (
                                <div style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: 10 }}>Описательное исследование — оценивается врачом по заключению</div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>Входящие маркеры:</div>
                              <div style={{ display: 'grid', gap: 2 }}>
                                {inv.markers.map(code => {
                                  const info = UCUM_MAP[code];
                                  return (
                                    <div key={code} style={{
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                      padding: '3px 6px', borderRadius: 4, fontSize: 10,
                                      background: 'rgba(255,255,255,0.02)',
                                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                                    }}>
                                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{info?.name || code}</span>
                                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-dim)' }}>{info?.lln || '—'}–{info?.uln || '—'}</span>
                                        <span style={{ color: 'var(--text-dim)', fontSize: 9 }}>{info?.prefUnit || ''}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {inv.markers.length === 0 && (
                                <div style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>Маркеры определяются индивидуально</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { SYSTEM_INFO } from '../../../core/risk-info';

interface Investigation {
  id: string;
  name: string;
  system: string;
  freq: string;
  markers: string;
  reason: string;
}

const SYSTEM_LABELS_INVEST: Record<string, string> = {
  cardio: '❤️ Сердечно-сосудистая',
  hepatic: '🫁 Печень',
  renal: '🫘 Почки',
  neuro: '🧠 Нервная',
  endocrine: '🦋 Эндокринная',
  reproductive: '🔬 Репродуктивная',
  musculoskeletal: '🦴 Костно-мышечная',
  hematologic: '🩸 Кроветворение',
};

const INVESTIGATIONS_DATA: Investigation[] = [
  { id: 'echo_kg', name: 'ЭХО-КГ (Эхокардиография)', system: 'cardio', freq: 'Каждые 8 нед на курсе; перед курсом и после ПКТ', markers: 'Фракция выброса ЛЖ, толщина стенок ЖКЛ, клапаны, диастолическая функция', reason: 'ААС вызывают гипертрофию ЛЖ, диастолическую дисфункцию, изменения клапанов. ЭХО-КГ — золотой стандарт мониторинга.' },
  { id: 'ekg', name: 'ЭКГ (Электрокардиография)', system: 'cardio', freq: 'Каждые 4 нед на курсе', markers: 'QTc, гипертрофия ЛЖ, аритмии, ишемия, блокады', reason: 'Ранняя диагностика аритмий (пролонгация QT), признаков гипертрофии и ишемии.' },
  { id: 'usg_heart_24h', name: 'Холтер-ЭКГ (24ч мониторинг)', system: 'cardio', freq: 'При симптомах аритмии на курсе', markers: 'Суточная ЧСС, эпизоды тахикардии/брадикардии, паузы, ST-депрессия', reason: 'Тренболон, кленбутерол, Т3 — высокий риск аритмий. Холтер — единственный способ выявить пароксизмальные нарушения.' },
  { id: 'usg_abd', name: 'УЗИ органов брюшной полости', system: 'hepatic', freq: 'Перед курсом, на 4-й неделе, после ПКТ', markers: 'Размеры печени, эхогенность, поджелудочная, селезёнка, почки', reason: 'Стеатоз, гепатомегалия, холестаз, кисты. Обязательное базовое обследование.' },
  { id: 'fibroscan', name: 'Фиброскан (эластография печени)', system: 'hepatic', freq: 'Перед курсом и после ПКТ', markers: 'Эластичность печени (кПа), CAP-значение (стеатоз)', reason: 'Количественная оценка фиброза и стеатоза без инвазии. Чувствительнее УЗИ для ранних стадий.' },
  { id: 'usg_kidney', name: 'УЗИ почек и мочевыводящих путей', system: 'renal', freq: 'Перед курсом, при повышении креатинина', markers: 'Размеры почек, корковый слой, конкременты, скорость фильтрации', reason: 'Тренболон и другие ААС — нефротоксичны. Ранняя диагностика структурных изменений.' },
  { id: 'mri_brain', name: 'МРТ головного мозга', system: 'neuro', freq: 'При стойких головных болях, нарушениях зрения', markers: 'Гипофиз, белое вещество, сосуды, объёмные образования', reason: 'ААС могут вызывать гипофизарную недостаточность через подавление HPT оси.' },
  { id: 'eeg', name: 'ЭЭГ (Электроэнцефалография)', system: 'neuro', freq: 'При судорогах, изменениях сознания', markers: 'Ритмы, эпи-активность, медленные волны', reason: 'Некоторые ААС и пептиды могут провоцировать судорожную готовность.' },
  { id: 'usg_thyroid', name: 'УЗИ щитовидной железы', system: 'endocrine', freq: 'Перед курсом (базовое), при симптомах', markers: 'Объём, структура, узлы, кровоток', reason: 'ААС подавляют HPT-ось. Сверхфизиологические дозы тестостерона снижают TSH.' },
  { id: 'usg_prostate', name: 'УЗИ предстательной железы (ТРУЗИ)', system: 'reproductive', freq: 'Перед курсом и после ПКТ (у мужчин)', markers: 'Объём предстательной железы, структура, PSA-зоны', reason: 'ААС вызывают гиперплазию предстательной железы. Мониторинг обязательный при >30 лет.' },
  { id: 'spermiogram', name: 'Спермограмма', system: 'reproductive', freq: 'Перед курсом, после ПКТ (через 12 нед)', markers: 'Объём, концентрация, подвижность, морфология, фрагментация ДНК', reason: 'ААС подавляют сперматогенез. Спермограмма — прямой маркёр восстановления ГГГ оси.' },
  { id: 'densitometry', name: 'Денситометрия (DEXA)', system: 'musculoskeletal', freq: 'Базовое; через 6 месяцев курса', markers: 'Минеральная плотность костей (T-score, Z-score), композиция тела', reason: 'Гипогонадизм в ПКТ-периоде → риск остеопороза. DEXA — золотой стандарт.' },
  { id: 'usg_joints', name: 'УЗИ суставов', system: 'musculoskeletal', freq: 'При болях/хрусте в суставах', markers: 'Синовит, хондромаляция, мениски, связки, бурсит', reason: 'Ароматизирующиеся ААС → дефицит эстрогена → суставные проблемы. УЗИ выявляет ранние изменения.' },
  { id: 'blood_smear', name: 'Мазок крови (миелограмма)', system: 'hematologic', freq: 'При стойкой анемии или лейкопении', markers: 'Эритроциты, лейкоциты, тромбоциты, формы клеток', reason: 'ААС подавляют кроветворение через механизм обратной связи. Миелограмма при аномальных анализах.' },
];

export const LabsInvestigations: React.FC = () => {
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

  const totalDone = Object.values(invDone).filter(Boolean).length;
  const totalAll = INVESTIGATIONS_DATA.length;

  return (
    <div className="labs-investigations">
      <div className="card">
        <h3>🔬 Исследования и обследования</h3>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
          Инструментальные и аппаратные исследования для мониторинга на курсе и в ПКТ
        </p>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{ width: `${totalAll > 0 ? (totalDone / totalAll * 100) : 0}%`, background: 'var(--accent)', height: '100%', borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{totalDone}/{totalAll}</span>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          {Object.entries(groupedBySystem).map(([system, investigations]) => {
            const isCollapsed = collapsedSystems[system] || false;
            const doneCount = investigations.filter(inv => invDone[inv.id]).length;
            return (
              <div key={system} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--bg-secondary)',
                  }}
                  onClick={() => toggleSystem(system)}
                >
                  <div style={{ fontWeight: 600, fontSize: 12 }}>
                    {SYSTEM_LABELS_INVEST[system] || system}
                    <span style={{ marginLeft: 6, fontSize: 10, color: doneCount === investigations.length ? 'var(--accent)' : 'var(--text-dim)' }}>
                      {doneCount}/{investigations.length}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {isCollapsed ? '▼' : '▲'}
                  </span>
                </div>
                {!isCollapsed && (
                  <div style={{ padding: '6px 10px' }}>
                    {investigations.map(inv => {
                      const isDone = invDone[inv.id] ?? false;
                      return (
                        <div key={inv.id} style={{
                          background: isDone ? 'rgba(0,230,138,0.06)' : 'var(--bg-secondary)',
                          borderRadius: 6,
                          padding: '8px 10px',
                          border: isDone ? '1px solid rgba(0,230,138,0.3)' : '1px solid var(--border)',
                          marginBottom: 6,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 11, color: isDone ? 'var(--accent)' : 'var(--text)' }}>{inv.name}</div>
                            </div>
                            <button onClick={() => toggleInv(inv.id)} style={{
                              padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600, cursor: 'pointer',
                              background: isDone ? 'rgba(0,230,138,0.15)' : 'var(--bg-tertiary)',
                              color: isDone ? 'var(--accent)' : 'var(--text-dim)',
                              border: isDone ? '1px solid rgba(0,230,138,0.3)' : '1px solid var(--border)',
                              whiteSpace: 'nowrap',
                            }}>
                              {isDone ? '✓' : '✗'}
                            </button>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 2 }}>⏱ {inv.freq}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}><b>Параметры:</b> {inv.markers}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.3 }}>{inv.reason}</div>
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
    </div>
  );
};

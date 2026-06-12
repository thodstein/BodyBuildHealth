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
  cardio: 'Сердце',
  hepatic: 'Печень',
  renal: 'Почки',
  neuro: 'Нервная',
  endocrine: 'Эндокринная',
  reproductive: 'Репродуктивная',
  musculoskeletal: 'Мышечная',
  hematologic: 'Кровь',
};

const INVESTIGATIONS_DATA: Investigation[] = [
  { id: 'echo_kg', name: 'Эхокардиограмма (Эхо-КГ)', system: 'cardio', freq: '1 раз/год на курсе', markers: 'Структура сердца, фракция выброса, клапаны, размеры камер', reason: 'ААС и ГХСБ влияют на массу миокарда ЛЖ' },
  { id: 'ekg', name: 'Электрокардиограмма (ЭКГ)', system: 'cardio', freq: 'Каждые 3-6 мес', markers: 'QTc, гипертрофия ЛЖ, аритмии, ишемия, блокады', reason: 'Скрининг аритмий и гипертрофии на фоне ААС' },
  { id: 'usg_heart_24h', name: 'Холтер (суточное мониторирование ЭКГ)', system: 'cardio', freq: 'По показаниям', markers: 'Аритмии, ишемия, вариабельность ритма', reason: 'При симптомах: сердцебиение, одышка, предобмороки' },
  { id: 'usg_abd', name: 'УЗИ органов брюшной полости', system: 'hepatic', freq: '1 раз/6 мес на курсе', markers: 'Размеры печени, эхогенность, очаги, диффузные изменения', reason: 'Контроль гепатотоксичности ААС, скрининг НАЖБП' },
  { id: 'fibroscan', name: 'Фиброскан (эластография печени)', system: 'hepatic', freq: '1 раз/год', markers: 'Степень фиброза и стеатоза (кПа, CAP)', reason: 'При длительном приёме ААС или повышенных трансаминазах' },
  { id: 'usg_kidney', name: 'УЗИ почек', system: 'renal', freq: '1 раз/год', markers: 'Размеры, структура, конкременты, кровоток', reason: 'Контроль нефротоксичности и мочекаменной болезни' },
  { id: 'mri_brain', name: 'МРТ головного мозга', system: 'neuro', freq: 'По показаниям', markers: 'Очаги, атрофия, гипофиз, гипоталамус', reason: 'При неврологической симптоматике или подозрении на аденому гипофиза' },
  { id: 'eeg', name: 'Электроэнцефалограмма (ЭЭГ)', system: 'neuro', freq: 'По показаниям', markers: 'Биоэлектрическая активность, эпиактивность', reason: 'При судорогах, нарушениях сна, когнитивных жалобах' },
  { id: 'usg_thyroid', name: 'УЗИ щитовидной железы', system: 'endocrine', freq: '1 раз/год', markers: 'Размеры, узлы, структура, кровоток', reason: 'Контроль на фоне препаратов, влияющих на ось HPT, и йодсодержащих' },
  { id: 'usg_prostate', name: 'УЗИ простаты (ТРУЗИ/трансабдоминально)', system: 'reproductive', freq: '1 раз/год после 40', markers: 'Объём, структура, узлы, остаточная моча', reason: 'Скрининг ДГПЖ на фоне андрогенов' },
  { id: 'spermiogram', name: 'Спермограмма', system: 'reproductive', freq: 'Через 3-4 мес после отмены', markers: 'Концентрация, подвижность, морфология, MAR-тест', reason: 'Оценка фертильности после курса ААС' },
  { id: 'densitometry', name: 'Денситометрия (DXA)', system: 'musculoskeletal', freq: '1 раз/1-2 года', markers: 'Минеральная плотность костей (T-критерий)', reason: 'Контроль костной массы на длительной ГХСБ и антиэстрогенах' },
  { id: 'usg_joints', name: 'УЗИ суставов', system: 'musculoskeletal', freq: 'По показаниям', markers: 'Выпот, синовит, энтезопатии, эрозии', reason: 'При суставных болях на фоне ААС или ГХСБ' },
  { id: 'blood_smear', name: 'Мазок крови (лейкоцитарная формула)', system: 'hematologic', freq: 'Каждые 3-6 мес', markers: 'Нейтрофилы, лимфоциты, моноциты, эозинофилы, базофилы, бласты', reason: 'Оценка лейкопоэза и иммунного ответа на фоне ААС' },
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

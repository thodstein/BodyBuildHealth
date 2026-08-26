import React from 'react';
import { REQUIRED_LABS_PER_PHASE } from '../../../core/constants';
import { LABS_ACCENT, LABS_CARD, LabsSectionHeader, LabsBadge } from './LabsUI';

const PHASE_LABELS: Record<string, string> = {
  baseline: 'Базовый',
  on_cycle: 'На курсе',
  bridge: 'Мост',
  pct: 'ПКТ',
  post_pct: 'После ПКТ',
};

const PHASE_DESCRIPTIONS: Record<string, string> = {
  baseline: 'Скрининг здоровья, база для сравнения на курсе',
  on_cycle: 'Ежемесячный контроль на фоне приёма препаратов',
  bridge: 'Контроль восстановления между курсами',
  pct: 'Мониторинг восстановления оси HPTA',
  post_pct: 'Финальная проверка после завершения ПКТ',
};

const PHASE_ACCENT: Record<string, string> = {
  baseline: '#3b82f6', on_cycle: LABS_ACCENT, bridge: '#a855f7', pct: '#f97316', post_pct: '#ec4899',
};

const LAB_DESCRIPTIONS: Record<string, string> = {
  'ALT': 'Чувствительный маркёр повреждения гепатоцитов',
  'AST': 'Маркёр повреждения печени и мышц',
  'GGT': 'Маркёр холестаза, алкогольного и токсического поражения',
  'HCT': 'Показывает объёмную долю эритроцитов, повышается на ААС',
  'HGB': 'Гемоглобин — транспорт кислорода',
  'PLT': 'Тромбоциты, свёртываемость крови',
  'WBC': 'Лейкоциты — иммунный статус',
  'TT': 'Общий тестостерон',
  'FT3': 'Свободный трийодтиронин',
  'FT4': 'Свободный тироксин',
  'TSH': 'Тиреотропный гормон гипофиза',
  'E2': 'Эстрадиол — ключевой эстроген',
  'PRL': 'Пролактин — может расти на некоторых ААС',
  'LH': 'Лютеинизирующий гормон гипофиза',
  'FSH': 'Фолликулостимулирующий гормон',
  'SHBG': 'Глобулин, связывающий половые гормоны',
  'CRP': 'С-реактивный белок — системное воспаление',
  'HbA1c': 'Гликированный гемоглобин — средний уровень глюкозы за 3 мес',
  'FERRITIN': 'Депозит железа, часто повышен на курсе',
  'VITD': 'Витамин D — влияет на иммунитет, кости, тестостерон',
  'LDL': '«Плохой» холестерин, растёт на многих ААС',
  'HDL': '«Хороший» холестерин, падает на оральных ААС',
  'TG': 'Триглицериды — липидный профиль',
  'GLU': 'Глюкоза крови натощак',
  'INS': 'Инсулин — маркёр инсулинорезистентности',
  'HOMA': 'HOMA-IR — индекс инсулинорезистентности',
  'CREATININE': 'Маркёр функции почек',
  'UA': 'Мочевая кислота — пуриновый обмен',
};

export const LabsSchedule: React.FC = () => {
  return (
    <div>
      <div style={{ ...LABS_CARD, background:'rgba(20,22,30,0.42)', backdropFilter:'blur(10px)' }}>
        <LabsSectionHeader icon="📅" title="График сдачи анализов" subtitle="Рекомендуемый график по фазам курса — каждая фаза требует свой набор маркеров" />
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', marginBottom:12, lineHeight:1.4, padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
          Совет: сдавайте базовый скрининг до курса и каждые 4 недели на курсе. Маркеры с ℹ️ — наведите для подсказки.
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {Object.entries(REQUIRED_LABS_PER_PHASE).map(([phase, labs]) => {
            const phaseLabel = PHASE_LABELS[phase] || phase;
            const phaseDesc = PHASE_DESCRIPTIONS[phase] || '';
            const accent = PHASE_ACCENT[phase] || LABS_ACCENT;
            return (
              <div key={phase} style={{ borderRadius:14, overflow:'hidden', border:`1px solid ${accent}18`, background:'rgba(255,255,255,0.02)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background: accent+'10', borderBottom:`1px solid ${accent}14` }}>
                  <span style={{ width:28, height:28, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', background: accent+'18', border:`1px solid ${accent}22`, fontSize:12, fontWeight:800, color:accent }}>{phaseLabel.slice(0,1)}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:800, fontSize:12, color:'#fff' }}>{phaseLabel}</div>
                    {phaseDesc && <div style={{ fontSize:9, color:'rgba(255,255,255,0.55)', marginTop:1 }}>{phaseDesc}</div>}
                  </div>
                  <LabsBadge color={accent}>{labs.length} маркеров</LabsBadge>
                </div>
                <div style={{ padding:'10px 10px 8px' }}>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    {labs.map((code: string) => (
                      <span key={code} style={{
                        background: accent+'10',
                        border: `1px solid ${accent}22`,
                        padding:'4px 8px',
                        borderRadius:999,
                        fontSize:10, fontWeight:700,
                        color: 'rgba(255,255,255,0.82)',
                        display:'inline-flex', alignItems:'center', gap:4,
                      }}>
                        {code}
                        {LAB_DESCRIPTIONS[code] && <span style={{ fontSize:8, opacity:0.7 }} title={LAB_DESCRIPTIONS[code]}>ℹ️</span>}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

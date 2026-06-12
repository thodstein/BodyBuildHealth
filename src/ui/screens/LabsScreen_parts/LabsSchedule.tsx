import React from 'react';
import { REQUIRED_LABS_PER_PHASE } from '../../../core/constants';

const PHASE_LABELS: Record<string, string> = {
  baseline: 'Базовый',
  on_cycle: 'На курсе',
  bridge: 'Бридж',
  pct: 'ПКТ',
  post_pct: 'После ПКТ',
  course_bridge_course: 'Курс+Бридж',
};

const PHASE_DESCRIPTIONS: Record<string, string> = {
  baseline: 'Скрининг здоровья, база для сравнения на курсе',
  on_cycle: 'Ежемесячный контроль на фоне приёма препаратов',
  bridge: 'Контроль восстановления между курсами',
  pct: 'Мониторинг восстановления оси HPTA',
  post_pct: 'Финальная проверка после завершения ПКТ',
  course_bridge_course: 'Затяжной курс с перемычкой',
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
  'CORTISOL': '',
  'IGF1': '',
  'ALP': '',
  'BILIRUBIN_TOTAL': '',
  'BIL_T': '',
  'PROTEIN_TOTAL': '',
  'BUN': '',
  'EGFR': '',
};

export const LabsSchedule: React.FC = () => {
  return (
    <div className="labs-schedule">
      <div className="card">
        <h3>📅 График сдачи анализов</h3>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
          Рекомендуемый график сдачи анализов по фазам курса. Каждая фаза требует определённый набор маркеров.
        </p>

        {Object.entries(REQUIRED_LABS_PER_PHASE).map(([phase, labs]) => {
          const phaseLabel = PHASE_LABELS[phase] || phase;
          const phaseDesc = PHASE_DESCRIPTIONS[phase] || '';

          return (
            <div key={phase} style={{ marginBottom: 16, background: 'var(--bg-secondary)', padding: 12, borderRadius: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)', marginBottom: 4 }}>
                {phaseLabel}
              </div>
              {phaseDesc && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>{phaseDesc}</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {labs.map((code: string) => (
                  <span key={code} style={{
                    background: 'rgba(0,230,138,0.1)',
                    border: '1px solid rgba(0,230,138,0.3)',
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    color: 'var(--text)',
                  }}>
                    {code}
                    {LAB_DESCRIPTIONS[code] && (
                      <span style={{ fontSize: 9, color: 'var(--text-dim)', marginLeft: 4 }} title={LAB_DESCRIPTIONS[code]}>ℹ️</span>
                    )}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                Всего маркеров: {labs.length}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

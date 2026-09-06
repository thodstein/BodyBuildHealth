import React, { useState } from 'react';
import { UCUM_MAP } from '../../../core/constants';

interface LabCatalogEntry {
  code: string;
  name: string;
  unit: string;
  min: number;
  max: number;
  system: string;
  description: string;
}

const LAB_SYSTEM_MAP: Record<string, string> = {
  'ALT': 'hepatic', 'AST': 'hepatic', 'GGT': 'hepatic', 'ALP': 'hepatic',
  'BILIRUBIN_TOTAL': 'hepatic', 'BIL_T': 'hepatic', 'BIL': 'hepatic', 'ALB': 'hepatic',
  'CREATININE': 'renal', 'BUN': 'renal', 'EGFR': 'renal', 'PROTEIN_TOTAL': 'renal',
  'TP': 'renal', 'UA': 'renal',
  'TSH': 'endocrine', 'FT3': 'endocrine', 'FT4': 'endocrine',
  'TT': 'endocrine', 'E2': 'endocrine', 'PRL': 'endocrine',
  'LH': 'endocrine', 'FSH': 'endocrine', 'SHBG': 'endocrine',
  'CORTISOL': 'endocrine', 'INS': 'metabolic', 'HOMA': 'metabolic',
  'IGF1': 'endocrine', 'DHEA_S': 'reproductive',
  'HGB': 'hematologic', 'HCT': 'hematologic', 'PLT': 'hematologic', 'WBC': 'hematologic',
  'LDL': 'cardio', 'HDL': 'cardio', 'TG': 'cardio', 'GLU': 'metabolic', 'GLUCOSE': 'metabolic',
  'HBA1C': 'metabolic', 'HOMOCYSTEINE': 'neuro',
  'FERRITIN': 'hematologic', 'VITD': 'metabolic', 'CALCIDIOL': 'metabolic',
  'CRP': 'cardio', 'PROGESTERONE': 'reproductive', 'AMH': 'reproductive', 'INHB': 'reproductive',
  'PSA': 'reproductive',
};

const LAB_DESCRIPTIONS: Record<string, string> = {
  'ALT': 'Аланинаминотрансфераза. Ключевой маркёр повреждения печени. Повышается при гепатотоксичности ААС.',
  'AST': 'Аспартатаминотрансфераза. Маркёр повреждения печени и мышц. Соотношение AST/ALT — дифференциальная диагностика.',
  'GGT': 'Гамма-глутамилтрансфераза. Чувствительный маркёр холестаза и алкогольного поражения. Повышается при приёме оральных ААС.',
  'HCT': 'Гематокрит. Объёмная доля эритроцитов. Повышается на ААС — риск тромбоза при >52%.',
  'HGB': 'Гемоглобин. Транспорт кислорода. Повышается на эритропоэтиках и ААС.',
  'PLT': 'Тромбоциты. Участвуют в свёртывании. Снижаются при некоторых ААС и антикоагулянтах.',
  'WBC': 'Лейкоциты. Показатель иммунного статуса и воспаления.',
  'TT': 'Общий тестостерон. Сумма свободного и связанного с SHBG и альбумином тестостерона.',
  'E2': 'Эстрадиол. Основной эстроген. Ароматизируется из тестостерона. Контролировать на курсе.',
  'PRL': 'Пролактин. Может расти на нандролоне, тренболоне и некоторых ААС.',
  'LH': 'Лютеинизирующий гормон. Стимулирует выработку тестостерона в тестикулах. Подавлен на курсе.',
  'FSH': 'Фолликулостимулирующий гормон. Стимулирует сперматогенез. Подавлен на курсе.',
  'SHBG': 'Глобулин, связывающий половые гормоны. Снижается на оральных ААС, повышается при гипертиреозе.',
  'CRP': 'С-реактивный белок. Неспецифический маркёр воспаления. Высокий — фактор сердечно-сосудистого риска.',
  'HBA1C': 'Гликированный гемоглобин. Средний уровень глюкозы за 3 месяца. Скрининг диабета.',
  'LDL': 'Липопротеины низкой плотности. «Плохой» холестерин. Растёт на многих ААС и ГХСБ.',
  'HDL': 'Липопротеины высокой плотности. «Хороший» холестерин. Падает на оральных ААС и некоторых инъекционных.',
  'TG': 'Триглицериды. Растут на ААС, особенно при потреблении простых углеводов.',
  'GLU': 'Глюкоза крови натощак. Скрининг инсулинорезистентности и диабета.',
  'INS': 'Инсулин. Повышен при инсулинорезистентности. Гормон роста и набора массы.',
  'HOMA': 'HOMA-IR. Инсулин × Глюкоза / 22.5. >2.7 — инсулинорезистентность.',
  'CREATININE': 'Креатинин. Продукт распада креатина. Маркёр функции почек.',
  'CORTISOL': 'Кортизол. Гормон стресса. Подавляется некоторыми ААС и ГХСБ.',
  'IGF1': 'Инсулиноподобный фактор роста-1. Опосредует эффекты ГР. Маркёр анаболического статуса.',
  'TSH': 'Тиреотропный гормон. Регулирует функцию щитовидной железы.',
  'FT3': 'Свободный трийодтиронин. Активная форма гормона щитовидной железы.',
  'FT4': 'Свободный тироксин. Предшественник T3. Контроль функции щитовидной железы.',
  'FERRITIN': 'Ферритин. Депозит железа в организме. Повышен при воспалении, гемохроматозе, на курсе.',
  'VITD': '25(OH) витамин D. Влияет на иммунитет, экспрессию генов, уровень тестостерона, здоровье костей.',
  'ALP': 'Щелочная фосфатаза. Маркёр холестаза и костного обмена.',
  'BILIRUBIN_TOTAL': 'Билирубин общий. Продукт распада гема. Маркёр функции печени и гемолиза.',
  'PROTEIN_TOTAL': 'Общий белок плазмы. Отражает нутритивный статус и функцию печени.',
  'BUN': 'Мочевина крови. Маркёр функции почек и катаболизма белка.',
  'EGFR': 'Расчётная скорость клубочковой фильтрации. Ключевой маркёр функции почек.',
  'HOMOCYSTEINE': 'Гомоцистеин. Фактор риска тромбоза и сердечно-сосудистых заболеваний.',
  'UA': 'Мочевая кислота. Пуриновый обмен. Повышается на ААС — риск подагры.',
  'DHEA_S': 'ДГЭА-С. Надпочечниковый андроген. Предшественник тестостерона.',
  'AMH': 'Антимюллеров гормон. Маркёр овариального резерва и функции тестикул.',
  'INHB': 'Ингибин B. Маркёр сперматогенеза и функции тестикул.',
  'PSA': 'Простатический специфический антиген. Скрининг патологии простаты.',
};

// Build catalog entries from UCUM_MAP
const catalogEntries: LabCatalogEntry[] = Object.entries(UCUM_MAP).map(([code, info]) => ({
  code,
  name: info.name,
  unit: info.prefUnit,
  min: info.lln,
  max: info.uln,
  system: LAB_SYSTEM_MAP[code] || '',
  description: LAB_DESCRIPTIONS[code] || '',
}));

export const LabsCatalog: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filterSystem, setFilterSystem] = useState<string>('all');

  const systems = [...new Set(catalogEntries.map(e => e.system))].sort();

  const filtered = catalogEntries.filter(e => {
    const matchSearch = !search ||
      (e.code||'').toLowerCase().includes(search.toLowerCase()) ||
      (e.name||'').toLowerCase().includes(search.toLowerCase()) ||
      (e.description||'').toLowerCase().includes(search.toLowerCase());
    const matchSystem = filterSystem === 'all' || e.system === filterSystem;
    return matchSearch && matchSystem;
  });

  return (
    <div className="labs-catalog">
      <div className="card">
        <h3>📖 Каталог анализов</h3>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
          Справочник лабораторных маркеров с референсными значениями и описаниями. Всего: {catalogEntries.length} маркеров.
        </p>

        {/* Search */}
        <input
          type="text"
          placeholder=""
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', marginBottom: 8, fontSize: 13 }}
        />

        {/* System filter */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
          <button
            onClick={() => setFilterSystem('all')}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: filterSystem === 'all' ? 'var(--accent)' : 'transparent', color: filterSystem === 'all' ? '#000' : 'var(--text)', fontSize: 11, cursor: 'pointer' }}
          >
            Все ({catalogEntries.length})
          </button>
          {systems.map(sys => {
            const count = catalogEntries.filter(e => e.system === sys).length;
            return (
              <button
                key={sys}
                onClick={() => setFilterSystem(sys)}
                style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: filterSystem === sys ? 'var(--accent)' : 'transparent', color: filterSystem === sys ? '#000' : 'var(--text)', fontSize: 11, cursor: 'pointer' }}
              >
                {sys} ({count})
              </button>
            );
          })}
        </div>

        {/* Entries */}
        <div style={{ display: 'grid', gap: 6 }}>
          {filtered.map(entry => (
            <div key={entry.code} style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{entry.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>({entry.code})</span>
                </div>
                <div style={{ fontSize: 11, background: 'rgba(var(--labs-accent-rgb, 0,230,138),0.1)', padding: '2px 8px', borderRadius: 4 }}>
                  {entry.min}–{entry.max} {entry.unit}
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2 }}>{entry.system}</div>
              {entry.description && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{entry.description}</div>
              )}
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)' }}>
            Ничего не найдено по запросу «{search}»
          </div>
        )}
      </div>
    </div>
  );
};

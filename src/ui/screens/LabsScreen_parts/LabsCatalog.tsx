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
  'ALT': 'Печень', 'AST': 'Печень', 'GGT': 'Печень', 'ALP': 'Печень',
  'BILIRUBIN_TOTAL': 'Печень', 'BIL_T': 'Печень', 'BIL': 'Печень', 'ALB': 'Печень',
  'CREATININE': 'Почки', 'BUN': 'Почки', 'EGFR': 'Почки', 'PROTEIN_TOTAL': 'Почки',
  'TP': 'Почки', 'UA': 'Почки',
  'TSH': 'Эндокринная', 'FT3': 'Эндокринная', 'FT4': 'Эндокринная',
  'TT': 'Эндокринная', 'E2': 'Эндокринная', 'PRL': 'Эндокринная',
  'LH': 'Эндокринная', 'FSH': 'Эндокринная', 'SHBG': 'Эндокринная',
  'CORTISOL': 'Эндокринная', 'INS': 'Эндокринная', 'HOMA': 'Эндокринная',
  'IGF1': 'Эндокринная', 'DHEA_S': 'Эндокринная',
  'HGB': 'Кроветворение', 'HCT': 'Кроветворение', 'PLT': 'Кроветворение', 'WBC': 'Кроветворение',
  'LDL': 'Липиды', 'HDL': 'Липиды', 'TG': 'Липиды', 'GLU': 'Липиды', 'GLUCOSE': 'Липиды',
  'HBA1C': 'Углеводный обмен', 'HOMOCYSTEINE': 'Сосуды',
  'FERRITIN': 'Железо', 'VITD': 'Витамины', 'CALCIDIOL': 'Витамины',
  'CRP': 'Воспаление', 'PROGESTERONE': 'Репродуктивная', 'AMH': 'Репродуктивная', 'INHB': 'Репродуктивная',
  'PSA': 'Репродуктивная',
};

const LAB_DESCRIPTIONS: Record<string, string> = {
  'ALT': 'Аланинаминотрансфераза. Фермент-маркёр цитолиза гепатоцитов. Повышение указывает на повреждение печени, особенно при приёме 17α-алкилированных ААС.',
  'AST': 'Аспартатаминотрансфераза. Повышается при повреждении печени и мышц. Отношение АСТ/АЛТ > 1 указывает на мышечное происхождение.',
  'GGT': 'Γ-глутамилтрансфераза. Чувствительный маркёр холестаза и алкогольного поражения. Повышается при приёме оральных ААС.',
  'HCT': 'Гематокрит. Доля эритроцитов в объёме крови. Повышение (>54%) увеличивает риск тромбоза.',
  'HGB': 'Гемоглобин. Белок, переносящий кислород. Повышение на курсе — нормальный ответ на ААС.',
  'PLT': 'Тромбоциты. Клетки свёртывающей системы. Изменения указывают на иммунную или печёночную патологию.',
  'WBC': 'Лейкоциты. Клетки иммунной системы. Повышение — воспаление, снижение — иммуносупрессия.',
  'TT': 'Тестостерон общий. Основной маркёр андрогенного статуса. На курсе — экзогенный, на ПКТ — отслеживание восстановления.',
  'E2': 'Эстрадиол. Контроль ароматизации. Повышение → гинекомастия, задержка жидкости, эмоциональная нестабильность.',
  'PRL': 'Пролактин. Маркёр прогестагенной активности (тренболон, норандростерон). Повышение → гинекомастия, подавление либидо.',
  'LH': 'Лютеинизирующий гормон. Стимулирует клетки Лейдига → синтез тестостерона. На курсе подавлен, на ПКТ — отслеживание восстановления.',
  'FSH': 'Фолликулостимулирующий гормон. Стимулирует сперматогенез. Подавляется на курсе, восстанавливается на ПКТ.',
  'SHBG': 'ГСПГ. Связывает половые гормоны. Высокий эстроген → повышение ГСПГ → снижение свободного T.',
  'CRP': 'С-реактивный белок. Острофазовый маркёр воспаления. >5 мг/л — системное воспаление.',
  'HBA1C': 'Гликированный гемоглобин. Средний уровень глюкозы за 3 месяца. >5.7% — предиабет.',
  'LDL': 'ЛПНП. «Плохой» холестерин. ААС значительно повышают ЛПНП → кардиоваскулярный риск.',
  'HDL': 'ЛПВП. «Хороший» холестерин. ААС снижают ЛПВП → ухудшение соотношения ЛПНП/ЛПВП.',
  'TG': 'Триглицериды. Маркёр метаболического здоровья. Высокие ТГ + низкие ЛПВП = метаболический синдром.',
  'GLU': 'Глюкоза натощак. Базовый маркёр углеводного обмена. >5.6 ммоль/л — нарушенная толерантность.',
  'INS': 'Инсулин. Маркёр инсулинорезистентности в комбинации с глюкозой.',
  'HOMA': 'HOMA-IR. Инсулин × Глюкоза / 22.5. >2.7 — инсулинорезистентность.',
  'CREATININE': 'Креатинин. Маркёр функции почек. Повышается при приёме ААС за счёт увеличения мышечной массы и креатина.',
  'CORTISOL': 'Кортизол. Катаболический гормон. Повышение = стресс, снижение = надпочечниковая недостаточность.',
  'IGF1': 'Инсулиноподобный фактор роста-1. Маркёр активности GH оси.',
  'TSH': 'ТТГ. Регулятор щитовидной железы. Повышение = гипотиреоз, снижение = гипертиреоз.',
  'FT3': 'Т3 свободный. Активная форма трийодтиронина. Регулирует метаболизм.',
  'FT4': 'Т4 свободный. Тироксин — про-гормон, конвертируется в Т3.',
  'FERRITIN': 'Ферритин. Запасы железа + острофазовый белок. Низкий = дефицит железа, высокий = воспаление.',
  'VITD': 'Витамин D. Иммунитет, кости, гормональная регуляция. <30 нг/мл = дефицит.',
  'ALP': 'Щёлочная фосфатаза. Маркёр холестаза и костного метаболизма.',
  'BILIRUBIN_TOTAL': 'Билирубин общий. Маркёр функции печени и жёлчеоттока.',
  'PROTEIN_TOTAL': 'Общий белок. Синтетическая функция печени, онкотическое давление.',
  'BUN': 'Мочевина азот. Маркёр функции почек и белкового обмена.',
  'EGFR': 'СКФ. Скорость клубочковой фильтрации — золотой стандарт оценки функции почек.',
  'HOMOCYSTEINE': 'Гомоцистеин. Маркёр кардиоваскулярного риска и нейротоксичности.',
  'UA': 'Мочевая кислота. Подагра, метаболический синдром.',
  'DHEA_S': 'ДГЭА-С. Предшественник половых гормонов надпочечников.',
  'AMH': 'Антимюллеров гормон. Маркёр овариального резерва (женщины).',
  'INHB': 'Ингибин Б. Маркёр сперматогенеза (мужчины).',
  'PSA': 'Простат-специфический антиген. Маркёр здоровья простаты.',
};

// Build catalog entries from UCUM_MAP
const catalogEntries: LabCatalogEntry[] = Object.entries(UCUM_MAP).map(([code, info]) => ({
  code,
  name: info.name,
  unit: info.prefUnit,
  min: info.lln,
  max: info.uln,
  system: LAB_SYSTEM_MAP[code] || 'Другие',
  description: LAB_DESCRIPTIONS[code] || '',
}));

export const LabsCatalog: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filterSystem, setFilterSystem] = useState<string>('all');

  const systems = [...new Set(catalogEntries.map(e => e.system))].sort();

  const filtered = catalogEntries.filter(e => {
    const matchSearch = !search ||
      e.code.toLowerCase().includes(search.toLowerCase()) ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase());
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
          placeholder="🔍 Поиск по коду, названию или описанию..."
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
                <div style={{ fontSize: 11, background: 'rgba(0,230,138,0.1)', padding: '2px 8px', borderRadius: 4 }}>
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

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { UCUM_MAP } from '../../../core/constants';
import type { LabPoint } from '../../../core/types';
import { db } from '../../../core/db';
import { notifyDataChange } from '../../../core/data-link';
import { LABS_ACCENT, LABS_CARD, LABS_CARD_FLAT, LABS_SYS_COLOR, LABS_SYS_LABEL, LABS_SYS_ICON, LabsBadge } from './LabsUI';

const uid = () => { try { return crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`; } catch { return `${Date.now()}_${Math.random().toString(36).slice(2)}`; } };

// ── Investigations data ──
interface InvestigationItem {
  id: string; name: string; type: string; description: string;
  frequency: string; markers: string[]; isInstrumental: boolean;
}
const INVEST_TYPE_CONFIG: Record<string, { label: string }> = {
  blood: { label: 'Общий анализ крови' },
  biochemistry: { label: 'Биохимия' },
  hormones: { label: 'Гормональный профиль' },
  immunology: { label: 'Иммунология / Воспаление' },
  lipids: { label: 'Липидный профиль' },
  metabolic: { label: 'Метаболизм / Витамины' },
  minerals: { label: 'Минералы / Электролиты' },
  urinalysis: { label: 'Моча' },
  instrumental: { label: 'Инструментальные исследования' },
};
const INVESTIGATIONS: InvestigationItem[] = [
  { id:'cbc', name:'Общий анализ крови', type:'blood', description:'Базовый гематологический скрининг. Оценка эритропоэза, тромбоцитарного и лейкоцитарного ростков.', frequency:'Каждые 3-6 мес на курсе', markers:['HGB','HCT','WBC','PLT'], isInstrumental:false },
  { id:'cbc_ext', name:'Общий анализ крови (расширенный)', type:'blood', description:'Полная гемограмма с эритроцитарными индексами и RDW.', frequency:'Каждые 6 мес', markers:['HGB','HCT','WBC','PLT','RBC','MCV','MCH','MCHC','RDW'], isInstrumental:false },
  { id:'leukocyte_formula', name:'Лейкоцитарная формула', type:'blood', description:'Дифференцированный подсчёт лейкоцитов.', frequency:'Каждые 3-6 мес', markers:['WBC'], isInstrumental:false },
  { id:'liver_panel', name:'Печёночные пробы', type:'biochemistry', description:'Оценка цитолиза, холестаза и синтетической функции печени. Ключевой контроль гепатотоксичности ААС.', frequency:'Каждые 3-6 мес на курсе', markers:['ALT','AST','GGT','ALP','BIL','ALB','TP'], isInstrumental:false },
  { id:'renal_panel', name:'Почечный профиль', type:'biochemistry', description:'Функция почек, азотемия, фильтрация. Контроль нефротоксичности.', frequency:'Каждые 3-6 мес', markers:['CREATININE','UREA','EGFR','UA'], isInstrumental:false },
  { id:'enzymes', name:'Ферменты сыворотки', type:'biochemistry', description:'Дополнительные ферменты для оценки повреждения тканей.', frequency:'По показаниям', markers:['LDH','CK'], isInstrumental:false },
  { id:'hormone_basic', name:'Базовый гормональный профиль', type:'hormones', description:'Оценка HPTA-оси: андрогены, эстрогены, гонадотропины, ГСПГ.', frequency:'Каждые 4-6 нед на курсе', markers:['TT','FT','E2','PRL','LH','FSH','SHBG'], isInstrumental:false },
  { id:'hormone_thyroid', name:'Тиреоидный профиль', type:'hormones', description:'Функция щитовидной железы.', frequency:'1 раз/3-6 мес', markers:['TSH','FT3','FT4'], isInstrumental:false },
  { id:'hormone_adrenal', name:'Надпочечниковый профиль', type:'hormones', description:'Гормоны коры надпочечников и анаболического статуса.', frequency:'1 раз/6 мес', markers:['CORTISOL','DHEA_S','IGF1'], isInstrumental:false },
  { id:'hormone_fertility', name:'Фертильность / Репродукция', type:'hormones', description:'Маркёры фертильности, функции тестикул и овариального резерва.', frequency:'Через 3-4 мес после отмены ААС', markers:['AMH','INHB','PSA','PROG'], isInstrumental:false },
  { id:'inflammation', name:'Маркёры воспаления', type:'immunology', description:'Неспецифические маркёры системного воспаления и иммунного ответа.', frequency:'1 раз/3-6 мес', markers:['CRP','FIBRINOGEN','D_DIMER'], isInstrumental:false },
  { id:'lipid_basic', name:'Липидограмма (базовая)', type:'lipids', description:'Базовый скрининг атерогенности плазмы.', frequency:'Каждые 3-6 мес', markers:['LDL','HDL','TG'], isInstrumental:false },
  { id:'diabetes_screen', name:'Скрининг диабета / ИР', type:'metabolic', description:'Оценка углеводного обмена и инсулинорезистентности.', frequency:'Каждые 3-6 мес', markers:['GLU','INS','HOMA','HbA1c'], isInstrumental:false },
  { id:'vitamins', name:'Витамины и микронутриенты', type:'metabolic', description:'Ключевые витамины для метаболизма и иммунитета.', frequency:'1 раз/6 мес', markers:['VITD','B12','FOL'], isInstrumental:false },
  { id:'bone_metabolism', name:'Костный обмен', type:'metabolic', description:'Маркёры костного метаболизма и риска остеопороза.', frequency:'1 раз/год', markers:['CA','P','MG','VITD'], isInstrumental:false },
  { id:'electrolytes', name:'Электролиты плазмы', type:'minerals', description:'Контроль водно-электролитного баланса.', frequency:'Каждые 3-6 мес', markers:['NA','K','CA','P','MG'], isInstrumental:false },
  { id:'iron_panel', name:'Обмен железа', type:'minerals', description:'Маркёры дефицита или перегрузки железом.', frequency:'1 раз/3-6 мес', markers:['FERRITIN','TIBC'], isInstrumental:false },
  { id:'urinalysis', name:'Общий анализ мочи (ОАМ)', type:'urinalysis', description:'Скрининг мочевыводящих путей и функции почек: плотность, pH, белок, глюкоза, кетоны, кровь, лейкоциты, эритроциты, эпителий, цилиндры и нитриты.', frequency:'Каждые 4 недели на курсе и перед началом курса', markers:['URINE_SG','URINE_PH','URINE_PROTEIN_QR','URINE_GLUCOSE_QR','URINE_KETONES_QR','URINE_BILIRUBIN_QR','UROBILINOGEN_QR','URINE_NITRITE_QR','URINE_LEU_QR','URINE_BLOOD_QR','URINE_LEU','URINE_ERY','URINE_EPITHELIAL','URINE_CYLINDERS'], isInstrumental:false },
  { id:'echo_kg', name:'Эхокардиограмма (Эхо-КГ)', type:'instrumental', description:'Структура сердца, фракция выброса, клапаны, размеры камер.', frequency:'1 раз/год на курсе', markers:['ECHO_EF','ECHO_LV_MASS','ECHO_LA'], isInstrumental:true },
  { id:'ekg', name:'Электрокардиограмма (ЭКГ)', type:'instrumental', description:'Скрининг аритмий, гипертрофии ЛЖ, ишемии.', frequency:'Каждые 3-6 мес', markers:['HR','QTc'], isInstrumental:true },
  { id:'holter', name:'Холтер (суточное мониторирование ЭКГ)', type:'instrumental', description:'Аритмии, ишемия, вариабельность ритма.', frequency:'По показаниям', markers:['HR'], isInstrumental:true },
  { id:'usg_abd', name:'УЗИ органов брюшной полости', type:'instrumental', description:'Размеры печени, эхогенность, очаги.', frequency:'1 раз/6 мес на курсе', markers:[], isInstrumental:true },
  { id:'fibroscan', name:'Фиброскан (эластография печени)', type:'instrumental', description:'Степень фиброза и стеатоза (кПа, CAP).', frequency:'1 раз/год', markers:[], isInstrumental:true },
  { id:'usg_kidney', name:'УЗИ почек', type:'instrumental', description:'Размеры, структура, конкременты, кровоток.', frequency:'1 раз/год', markers:[], isInstrumental:true },
  { id:'mri_brain', name:'МРТ головного мозга', type:'instrumental', description:'Очаги, атрофия, гипофиз. При неврологической симптоматике.', frequency:'По показаниям', markers:[], isInstrumental:true },
  { id:'eeg', name:'Электроэнцефалограмма (ЭЭГ)', type:'instrumental', description:'Биоэлектрическая активность, эпиактивность.', frequency:'По показаниям', markers:[], isInstrumental:true },
  { id:'usg_thyroid', name:'УЗИ щитовидной железы', type:'instrumental', description:'Размеры, узлы, структура, кровоток.', frequency:'1 раз/год', markers:[], isInstrumental:true },
  { id:'usg_prostate', name:'УЗИ простаты (ТРУЗИ)', type:'instrumental', description:'Объём, структура, узлы.', frequency:'1 раз/год после 40', markers:['PSA'], isInstrumental:true },
  { id:'spermiogram', name:'Спермограмма', type:'instrumental', description:'Концентрация, подвижность, морфология, MAR-тест.', frequency:'Через 3-4 мес после отмены', markers:[], isInstrumental:true },
  { id:'densitometry', name:'Денситометрия (DXA)', type:'instrumental', description:'Минеральная плотность костей (T-критерий).', frequency:'1 раз/1-2 года', markers:['VITD','CA'], isInstrumental:true },
  { id:'usg_joints', name:'УЗИ суставов', type:'instrumental', description:'Выпот, синовит, энтезопатии, эрозии.', frequency:'По показаниям', markers:[], isInstrumental:true },
  { id:'blood_pressure_monitor', name:'Мониторинг артериального давления', type:'instrumental', description:'Контроль АД для скрининга гипертензии на фоне ААС и ГХСБ.', frequency:'Еженедельно на курсе', markers:['BP_SYSTOLIC','BP_DIASTOLIC'], isInstrumental:true },
];

const sysLabels: Record<string, string> = {
  cardio: 'Сердечно-сосудистая', hepatic: 'Печень', renal: 'Почки',
  neuro: 'Нервная система', endocrine: 'Эндокринная', hematologic: 'Кровь',
  reproductive: 'Репродуктивная', musculoskeletal: 'Мышечная', metabolic: 'Метаболизм',
  other: 'Прочее',
};

const sysColors: Record<string, string> = {
  hepatic: '#22c55e', renal: '#3b82f6', endocrine: '#a855f7',
  hematologic: '#ef4444', cardio: '#f97316', metabolic: '#eab308',
  reproductive: '#ec4899', neuro: '#14b8a6', other: '#6b7280',
};

const sysIcons: Record<string, string> = {
  hepatic: '\uD83E\uDEC1', renal: '\uD83E\uDED8', endocrine: '\uD83E\uDDEC', hematologic: '\uD83E\uDE78',
  cardio: '\u2764\uFE0F', metabolic: '\u26A1', reproductive: '\uD83E\uDDEB', neuro: '\uD83E\uDDE0', other: '\uD83D\uDCCB',
};

const LAB_SYSTEM_GROUPS: Record<string, string[]> = {
  hepatic: ['ALT','AST','GGT','ALP','BILIRUBIN_TOTAL','BIL','ALB','LDH','BILIRUBIN_DIRECT','BILIRUBIN_INDIRECT'],
  renal: ['CREATININE','BUN','EGFR','PROTEIN_TOTAL','TP','UA','UACR','K','NA','CA','P','MG'],
  endocrine: ['TT','TSH','FT3','FT4','E2','PRL','LH','FSH','SHBG','CORTISOL','INS','HOMA','IGF1','TOTAL_T3','TOTAL_T4','TG_AB','TPO_AB','THYROGLOBULIN'],
  hematologic: ['HGB','HCT','PLT','WBC','RBC','MCV','MCH','MCHC','RDW','IRON','TRANSFERRIN','TIBC','IRON_SAT','FERRITIN'],
  cardio: ['LDL','HDL','TG','APOB','APOA1','NON_HDL','LP_A','CRP','hsCRP','FIBRINOGEN','D_DIMER'],
  metabolic: ['GLUCOSE','GLU','HBA1C','INSULIN','HOMA_IR','VITD','VITAMIN_D','CALCIDIOL','B12','VITAMIN_B12','FOLATE'],
  reproductive: ['PSA','DHEA_S','AMH','INHIBIN_B','PROGESTERONE','DHT','FT','TESTOSTERONE','ESTRADIOL'],
  neuro: ['HOMOCYSTEINE','BDNF','SEROTONIN','DOPAMINE','GABA','VITAMIN_B12','FOLATE'],
};

const CATALOG_LAB_DESCRIPTIONS: Record<string, string> = {
  'ALT': 'Аланинаминотрансфераза. Ключевой маркёр повреждения печени. Повышается при гепатотоксичности ААС.',
  'AST': 'Аспартатаминотрансфераза. Маркёр повреждения печени и мышц. Соотношение AST/ALT — дифференциальная диагностика.',
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
  'BIL': 'Билирубин общий. Продукт распада гема. Маркёр функции печени и гемолиза.',
  'ALB': 'Альбумин. Белок плазмы, отражает нутритивный статус и функцию печени.',
  'TP': 'Общий белок плазмы. Отражает нутритивный статус и функцию печени.',
  'EGFR': 'Расчётная скорость клубочковой фильтрации. Ключевой маркёр функции почек.',
  'UA': 'Мочевая кислота. Пуриновый обмен. Повышается на ААС — риск подагры.',
  'DHEA_S': 'ДГЭА-С. Надпочечниковый андроген. Предшественник тестостерона.',
  'AMH': 'Антимюллеров гормон. Маркёр овариального резерва и функции тестикул.',
  'PSA': 'Простатический специфический антиген. Скрининг патологии простаты.',
  'K': 'Калий. Основной внутриклеточный катион. Контроль электролитов на курсе.',
  'NA': 'Натрий. Основной внеклеточный катион. Регуляция водного баланса.',
  'CA': 'Кальций. Минерал для костей и мышечного сокращения.',
  'P': 'Фосфор. Участвует в энергетическом обмене и костной ткани.',
  'MG': 'Магний. Кофактор многих ферментов. Влияет на сон и восстановление.',
  'B12': 'Витамин B12. Кобаламин. Участвует в кроветворении и работе нервной системы.',
  'FOL': 'Фолат. Витамин B9. Участвует в синтезе ДНК и гомоцистеиновом обмене.',
  'TIBC': 'Общая железосвязывающая способность. Маркёр метаболизма железа.',
  'D_DIMER': 'D-димер. Продукт распада фибрина. Маркёр тромбообразования.',
  'FIBRINOGEN': 'Фибриноген. Фактор свёртывания. Повышается при воспалении.',
  'TROPONIN': 'Тропонин. Маркёр повреждения миокарда. Высокая специфичность.',
  'BNP': 'Натрийуретический пептид. Маркёр сердечной недостаточности.',
};

const PHASE_LABELS: Record<string, string> = {
  baseline: 'Базовый', on_cycle: 'На курсе', bridge: 'Мост',
  pct: 'ПКТ', post_pct: 'После ПКТ',
};

const systemOrder = ['hepatic','renal','endocrine','hematologic','cardio','metabolic','reproductive','neuro','other'];

type CatalogEntry = {
  code: string; name: string; unit: string; uln: number; lln: number;
  system: string; description: string;
};

function deviationColor(value: number, info: { uln: number; lln: number }): string {
  if (value > info.uln) return '#ef4444';
  if (value < info.lln) return '#f97316';
  return 'var(--accent)';
}

export default function LabsCatalogTab({
  labs,
  selectedPhase,
  onPhaseChange,
  tick,
}: {
  labs: LabPoint[];
  selectedPhase: string;
  onPhaseChange: (phase: string) => void;
  tick: number;
}) {
  const [search, setSearch] = useState('');
  const [filterSys, setFilterSys] = useState('all');
  const [detailEntry, setDetailEntry] = useState<CatalogEntry | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [openSystems, setOpenSystems] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    systemOrder.forEach(s => { init[s] = true; });
    return init;
  });
  const [catalogMode, setCatalogMode] = useState<'markers' | 'investigations'>('markers');
  const [invExpandedTypes, setInvExpandedTypes] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const t of Object.keys(INVEST_TYPE_CONFIG)) init[t] = true;
    return init;
  });
  const [invExpandedCards, setInvExpandedCards] = useState<Record<string, boolean>>({});

  const phaseLabs = useMemo(() => {
    return labs.filter(l => !l.archived && (!l.phase || l.phase === selectedPhase));
  }, [labs, selectedPhase]);

  const existingCodes = useMemo(() => {
    const map: Record<string, LabPoint> = {};
    for (const l of phaseLabs) {
      const code = l.code.toUpperCase();
      if (!map[code]) map[code] = l;
    }
    return map;
  }, [phaseLabs]);

  const catalogEntries = useMemo(() => {
    const map: Record<string, CatalogEntry> = {};
    for (const [sys, codes] of Object.entries(LAB_SYSTEM_GROUPS)) {
      for (const code of codes) {
        if (map[code]) continue;
        const info = UCUM_MAP[code];
        if (info) {
          map[code] = {
            code, name: info.name, unit: info.prefUnit, uln: info.uln, lln: info.lln, system: sys,
            description: CATALOG_LAB_DESCRIPTIONS[code] || '',
          };
        }
      }
    }
    for (const code of Object.keys(UCUM_MAP)) {
      if (map[code]) continue;
      const info = UCUM_MAP[code];
      map[code] = {
        code, name: info.name, unit: info.prefUnit, uln: info.uln, lln: info.lln, system: 'other',
        description: CATALOG_LAB_DESCRIPTIONS[code] || '',
      };
    }
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const filtered = useMemo(() => {
    let entries = catalogEntries;
    if (search) {
      const q = search.toLowerCase();
      entries = entries.filter(e => (e.code||'').toLowerCase().includes(q) || (e.name||'').toLowerCase().includes(q));
    }
    if (filterSys !== 'all') {
      entries = entries.filter(e => e.system === filterSys);
    }
    return entries;
  }, [catalogEntries, search, filterSys]);

  const grouped = useMemo(() => {
    const g: Record<string, CatalogEntry[]> = {};
    for (const e of filtered) {
      if (!g[e.system]) g[e.system] = [];
      g[e.system].push(e);
    }
    return g;
  }, [filtered]);

  useEffect(() => {
    const prefill: Record<string, string> = {};
    for (const entry of catalogEntries) {
      const upper = entry.code.toUpperCase();
      const existing = existingCodes[upper];
      if (existing) {
        prefill[upper] = String(existing.value);
      }
    }
    setValues(prev => {
      const merged = { ...prefill };
      for (const k of Object.keys(prev)) {
        if (prev[k] !== '' && !merged[k]) merged[k] = prev[k];
      }
      return merged;
    });
  }, [selectedPhase, tick]);

  const handleValueChange = useCallback((code: string, val: string) => {
    setValues(prev => ({ ...prev, [code]: val }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      await db.init();
      let count = 0;
      const toArchive = labs.filter(l => !l.archived && (!l.phase || l.phase === selectedPhase));
      for (const lab of toArchive) {
        await db.put('labs_log', { ...lab, archived: true });
      }
      for (const [code, valStr] of Object.entries(values)) {
        const val = parseFloat(valStr);
        if (!valStr || isNaN(val)) continue;
        const info = UCUM_MAP[code.toUpperCase()];
        const lab: LabPoint = {
          id: uid(),
          code: code.toUpperCase(),
          name: info?.name || code,
          value: val,
          unit: info?.prefUnit || '',
          date: new Date().toISOString().split('T')[0],
          phase: selectedPhase,
        };
        await db.put('labs_log', lab);
        count++;
      }
      if (count > 0) notifyDataChange();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      console.error('Save failed', e);
    }
    setSaving(false);
  }, [values, selectedPhase, labs]);

  const filledCount = useMemo(() => {
    return Object.values(values).filter(v => v.trim() !== '').length;
  }, [values]);

  const visibleSysCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of filtered) {
      counts[e.system] = (counts[e.system] || 0) + 1;
    }
    return counts;
  }, [filtered]);

  return (
    <div className="labs-labscatalog">
      {/* Header — premium */}
      <div style={{ ...LABS_CARD, padding:12, marginBottom:10, background:'rgba(20,22,30,0.42)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:36, height:36, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', background: catalogMode==='markers'? 'rgba(0,230,138,0.14)' : 'rgba(168,85,247,0.14)', border:`1px solid ${catalogMode==='markers'?'rgba(0,230,138,0.18)':'rgba(168,85,247,0.18)'}`, fontSize:16 }}>{catalogMode === 'markers' ? '📖' : '🩺'}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>{catalogMode === 'markers' ? 'Каталог маркеров' : 'Обследования'}</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', marginTop:1 }}>{catalogMode === 'markers' ? `${catalogEntries.length} маркеров • ${filledCount} заполнено для «${PHASE_LABELS[selectedPhase]}»` : `${INVESTIGATIONS.length} панелей • группировка по типу исследования`}</div>
        </div>
        <LabsBadge color={catalogMode==='markers'? LABS_ACCENT : '#a855f7'}>{catalogMode === 'markers' ? `${catalogEntries.length}` : `${INVESTIGATIONS.length}`}</LabsBadge>
      </div>

      {/* Mode toggle — segmented glass */}
      <div style={{ display:'flex', gap:4, padding:4, borderRadius:14, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', marginBottom:10 }}>
        <button onClick={() => setCatalogMode('markers')} style={{
          flex:1, padding:'8px 0', fontSize:11, fontWeight:800, cursor:'pointer', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          background: catalogMode === 'markers' ? LABS_ACCENT : 'transparent', color: catalogMode === 'markers' ? '#000' : 'rgba(255,255,255,0.62)', border:'none', boxShadow: catalogMode==='markers'?'0 6px 16px rgba(0,230,138,0.22)':'none'
        }}>📊 Маркеры</button>
        <button onClick={() => setCatalogMode('investigations')} style={{
          flex:1, padding:'8px 0', fontSize:11, fontWeight:800, cursor:'pointer', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          background: catalogMode === 'investigations' ? '#a855f7' : 'transparent', color: catalogMode === 'investigations' ? '#fff' : 'rgba(255,255,255,0.62)', border:'none', boxShadow: catalogMode==='investigations'?'0 6px 16px rgba(168,85,247,0.22)':'none'
        }}>📋 Обследования</button>
      </div>

      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.4 }}>
        {catalogMode === 'markers'
          ? 'Справочник лабораторных маркеров с референсами, описаниями и вводом значений. Группировка по системам организма.'
          : `${INVESTIGATIONS.length} исследований и лабораторных панелей для мониторинга на курсе.`}
      </div>

      {/* ── INVESTIGATIONS MODE ── */}
      {catalogMode === 'investigations' && (() => {
        const typeOrder = Object.keys(INVEST_TYPE_CONFIG);
        const grouped = typeOrder.map(t => ({ type: t, items: INVESTIGATIONS.filter(i => i.type === t) })).filter(g => g.items.length > 0);
        return (
          <div>
            {grouped.map(g => (
              <div key={g.type} style={{ marginBottom:8, borderRadius:14, overflow:'hidden', border:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)' }}>
                <button onClick={() => setInvExpandedTypes(prev => ({ ...prev, [g.type]: !prev[g.type] }))} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center', width:'100%', padding:'10px 12px',
                  cursor:'pointer', background: invExpandedTypes[g.type]? 'rgba(255,255,255,0.04)' : 'transparent', border:'none', color:'#fff', fontSize:12, fontWeight:800, textAlign:'left',
                  borderBottom: invExpandedTypes[g.type] ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ width:26, height:26, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(168,85,247,0.14)', border:'1px solid rgba(168,85,247,0.18)', fontSize:10 }}>{g.items.length}</span>
                    <span>{INVEST_TYPE_CONFIG[g.type].label}</span>
                  </div>
                  <span style={{ width:22, height:22, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', fontSize:10, transition:'transform 0.2s', transform: invExpandedTypes[g.type] ? 'rotate(180deg)' : 'none' }}>▾</span>
                </button>
                {invExpandedTypes[g.type] && (
                  <div style={{ padding: '6px 10px 10px' }}>
                    {g.items.map(inv => {
                      const expanded = invExpandedCards[inv.id] || false;
                      return (
                        <div key={inv.id} onClick={() => setInvExpandedCards(prev => ({ ...prev, [inv.id]: !prev[inv.id] }))} style={{
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
                                <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600, background: 'rgba(0,230,138,0.08)', padding: '2px 6px', borderRadius: 4 }}>⏱ {inv.frequency}</span>
                                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                                  {inv.markers.length > 0 ? `${inv.markers.length} маркеров` : `${inv.isInstrumental ? 'Инструментальное' : 'Описательная оценка'}`}
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
        );
      })()}

      {/* ── MARKERS MODE ── */}
      {catalogMode === 'markers' && (<>
      {/* Phase selector */}
      <div style={{ display:'flex', gap:4, padding:4, borderRadius:14, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', overflowX:'auto', marginBottom:10, scrollbarWidth:'none' }}>
        {Object.entries(PHASE_LABELS).map(([key, label]) => {
          const active = selectedPhase===key;
          return (
            <button key={key} onClick={() => onPhaseChange(key)} style={{
              padding:'7px 10px', borderRadius:10, fontSize:10, fontWeight:800, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
              background: active? LABS_ACCENT : 'transparent', color: active?'#000':'rgba(255,255,255,0.62)', border:'none', boxShadow: active?'0 4px 12px rgba(0,230,138,0.18)':'none'
            }}>{label}</button>
          );
        })}
      </div>

      {/* Search — premium */}
      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
        <div style={{ flex:1, position:'relative' }}>
          <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:12, opacity:0.6 }}>🔍</span>
          <input
            type="text"
            placeholder="Поиск по маркеру, коду..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width:'100%', padding:'9px 10px 9px 30px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:12, color:'#fff', fontSize:11, boxSizing:'border-box', outline:'none',
            }}
          />
          {search && <button onClick={()=>setSearch('')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.6)', borderRadius:999, width:20, height:20, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, cursor:'pointer' }}>✕</button>}
        </div>
        <button onClick={handleSave} disabled={saving || filledCount === 0} style={{
          padding:'9px 14px', borderRadius:12, border:'none', cursor: (saving || filledCount === 0) ? 'not-allowed' : 'pointer',
          background: saved ? '#22c55e' : filledCount > 0 ? LABS_ACCENT : 'rgba(255,255,255,0.06)',
          color: saved ? '#fff' : filledCount > 0 ? '#000' : 'rgba(255,255,255,0.45)',
          fontWeight:800, fontSize:11, transition:'all 0.2s', whiteSpace:'nowrap', boxShadow: filledCount>0? '0 6px 16px rgba(0,230,138,0.18)' : 'none',
        }}>
          {saving ? '⏳' : saved ? '✓ Сохранено' : `💾 ${filledCount}`}
        </button>
      </div>

      {/* System filter chips — premium */}
      <div style={{ display:'flex', gap:6, overflowX:'auto', marginBottom:10, scrollbarWidth:'none', paddingBottom:4 }}>
        <button onClick={() => { setFilterSys('all'); }} style={{
          padding:'7px 12px', borderRadius:999, fontSize:10, fontWeight:800, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
          background: filterSys === 'all' ? LABS_ACCENT : 'rgba(255,255,255,0.06)',
          color: filterSys === 'all' ? '#000' : 'rgba(255,255,255,0.62)',
          border:`1px solid ${filterSys === 'all' ? LABS_ACCENT : 'rgba(255,255,255,0.08)'}`,
        }}>Все {filterSys==='all' && `• ${filtered.length}`}</button>
        {systemOrder.map(sys => {
          const active = filterSys===sys;
          return (
            <button key={sys} onClick={() => setFilterSys(sys === filterSys ? 'all' : sys)} style={{
              padding:'7px 12px', borderRadius:999, fontSize:10, fontWeight:800, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', gap:4,
              background: active? sysColors[sys]+'18' : 'rgba(255,255,255,0.05)', color: active? sysColors[sys] : 'rgba(255,255,255,0.58)', border:`1px solid ${active? sysColors[sys]+'30' : 'rgba(255,255,255,0.06)'}`,
            }}>
              <span>{sysIcons[sys] || ''}</span> {sysLabels[sys] || sys}
            </button>
          );
        })}
      </div>

      {/* Filled count — premium */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <div style={{ flex:1, height:4, background:'rgba(255,255,255,0.06)', borderRadius:999, overflow:'hidden' }}><div style={{ width:`${catalogEntries.length? Math.round(filledCount/catalogEntries.length*100):0}%`, height:'100%', background: filledCount===catalogEntries.length? LABS_ACCENT : '#eab308', transition:'width 0.4s' }} /></div>
        <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.55)', whiteSpace:'nowrap' }}>{filledCount} / {catalogEntries.length} • фаза «{PHASE_LABELS[selectedPhase] || selectedPhase}»</span>
      </div>

      {/* System groups */}
      {systemOrder.map(sys => {
        const entries = grouped[sys];
        if (!entries || entries.length === 0) return null;
        const isOpen = openSystems[sys] !== false;
        const sysFilled = entries.filter(e => values[e.code] && values[e.code].trim() !== '').length;
        return (
          <div key={sys} style={{ marginBottom:8, borderRadius:14, overflow:'hidden', border:`1px solid ${sysColors[sys]}16`, background:'rgba(255,255,255,0.02)' }}>
            <button onClick={() => setOpenSystems(prev => ({ ...prev, [sys]: !prev[sys] }))} style={{
              display:'flex', alignItems:'center', gap:8, width:'100%', padding:'10px 12px', cursor:'pointer',
              background: isOpen? sysColors[sys]+'10' : 'transparent', border:'none', color:'#fff', fontSize:12, fontWeight:800, textAlign:'left', borderBottom: isOpen? `1px solid ${sysColors[sys]}12` : 'none',
            }}>
              <span style={{ width:22, height:22, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background: sysColors[sys]+'16', border:`1px solid ${sysColors[sys]}22`, fontSize:9, transition:'transform 0.2s', transform: isOpen?'rotate(90deg)':'rotate(0deg)', flexShrink:0 }}>▶</span>
              <span style={{ fontSize:15, flexShrink:0 }}>{sysIcons[sys] || '📋'}</span>
              <span style={{ flex:1 }}>{sysLabels[sys] || sys}</span>
              <span style={{ fontSize:9, fontWeight:800, padding:'3px 8px', borderRadius:999, background: sysFilled===entries.length? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.06)', border:`1px solid ${sysFilled===entries.length? 'rgba(0,230,138,0.18)' : 'rgba(255,255,255,0.08)'}`, color: sysFilled===entries.length? LABS_ACCENT : 'rgba(255,255,255,0.55)' }}>
                {sysFilled}/{entries.length}
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: '4px 10px 10px' }}>
                <div style={{ display: 'grid', gap: 3 }}>
                  {entries.map(entry => {
                    const upper = entry.code.toUpperCase();
                    const info = UCUM_MAP[upper];
                    const existing = existingCodes[upper];
                    const val = values[upper] ?? '';
                    const numVal = parseFloat(val);
                    const hasVal = val.trim() !== '' && !isNaN(numVal);
                    return (
                      <div key={entry.code} style={{
                        display:'flex', alignItems:'center', gap:8, padding:'8px 9px', borderRadius:11,
                        background: hasVal? 'rgba(0,230,138,0.08)' : existing? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)',
                        border:`1px solid ${hasVal? 'rgba(0,230,138,0.16)' : existing? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.06)'}`,
                        borderLeft:`3px solid ${hasVal? deviationColor(numVal, {uln:entry.uln,lln:entry.lln}) : sysColors[sys]+'AA'}`,
                        cursor:'pointer', transition:'transform 0.12s',
                      }} onClick={() => setDetailEntry(entry)}>
                        {/* Code chip */}
                        <div style={{
                          width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: sysColors[sys] + '18', color: sysColors[sys], fontWeight: 700, fontSize: 9, flexShrink: 0,
                        }}>
                          {entry.code.slice(0, 3)}
                        </div>
                        {/* Name + ref */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 10, marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {entry.name}
                          </div>
                          <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>
                            {entry.lln}–{entry.uln} {entry.unit}
                          </div>
                        </div>
                        {/* Value input */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, minWidth: 130 }}>
                          <input
                            value={val}
                            onChange={e => { e.stopPropagation(); handleValueChange(upper, e.target.value); }}
                            onClick={e => e.stopPropagation()}
                            placeholder={existing ? String(existing.value) : '—'}
                            type="number"
                            step="any"
                            style={{
                              width: 55, padding: '3px 6px', background: 'rgba(0,0,0,0.25)',
                              border: `1px solid ${hasVal ? deviationColor(numVal, {uln:entry.uln,lln:entry.lln}) : 'var(--border)'}`,
                              borderRadius: 5, color: hasVal ? deviationColor(numVal, {uln:entry.uln,lln:entry.lln}) : 'var(--text-dim)',
                              fontSize: 10, fontWeight: 600, textAlign: 'right',
                            }}
                          />
                          <span style={{ fontSize: 7, color: 'var(--text-dim)', width: 24, textAlign: 'left' }}>
                            {entry.unit}
                          </span>
                          <span style={{ fontSize: 8, width: 30, textAlign: 'center', color: hasVal ? deviationColor(numVal, {uln:entry.uln,lln:entry.lln}) : 'var(--text-dim)' }}>
                            {hasVal ? (numVal > entry.uln ? '▲' : numVal < entry.lln ? '▼' : '✓') : existing ? '📋' : '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {catalogEntries.length > 0 && Object.keys(grouped).length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 12 }}>
          Ничего не найдено
        </div>
      )}

      {/* Detail modal */}
      {detailEntry && (() => {
        const info = UCUM_MAP[detailEntry.code];
        const upper = detailEntry.code.toUpperCase();
        const existing = existingCodes[upper];
        const val = values[upper] ?? '';
        const numVal = parseFloat(val);
        const hasVal = val.trim() !== '' && !isNaN(numVal);
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }} onClick={() => setDetailEntry(null)}>
            <div style={{ width: '100%', maxWidth: 420, zIndex: 201, background: 'var(--bg)', borderRadius: 20, padding: '16px 18px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: sysColors[detailEntry.system] + '20', color: sysColors[detailEntry.system], fontWeight: 700, fontSize: 12,
                  }}>
                    {detailEntry.code.slice(0, 3)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{detailEntry.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{detailEntry.code}</div>
                  </div>
                </div>
                <button onClick={() => setDetailEntry(null)} style={{ background: 'var(--bg-secondary)', border: 'none', color: 'var(--text-dim)', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>✕</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                <div style={{ padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>Система</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{sysLabels[detailEntry.system] || detailEntry.system}</div>
                </div>
                <div style={{ padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>Референс</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{detailEntry.lln}–{detailEntry.uln}</div>
                </div>
                <div style={{ padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>Единица</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{detailEntry.unit || '—'}</div>
                </div>
                {info && info.coeff !== 1 && (
                  <div style={{ padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>Коэффициент</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{info.coeff}</div>
                  </div>
                )}
              </div>

              {/* Quick input in detail */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(0,230,138,0.06)', borderRadius: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 600, flexShrink: 0 }}>Значение:</span>
                <input
                  value={val}
                  onChange={e => handleValueChange(upper, e.target.value)}
                  placeholder={existing ? String(existing.value) : ''}
                  type="number" step="any"
                  style={{
                    flex: 1, padding: '6px 10px', background: 'rgba(0,0,0,0.3)',
                    border: `1px solid ${hasVal ? deviationColor(numVal, {uln:detailEntry.uln,lln:detailEntry.lln}) : 'var(--border)'}`,
                    borderRadius: 8, color: hasVal ? deviationColor(numVal, {uln:detailEntry.uln,lln:detailEntry.lln}) : 'var(--text-dim)',
                    fontSize: 13, fontWeight: 700, textAlign: 'right',
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>{detailEntry.unit}</span>
                {hasVal && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                    color: numVal > detailEntry.uln ? '#ef4444' : numVal < detailEntry.lln ? '#f97316' : 'var(--accent)',
                  }}>
                    {numVal > detailEntry.uln ? '↑ Выше нормы' : numVal < detailEntry.lln ? '↓ Ниже нормы' : '✓ В норме'}
                  </span>
                )}
              </div>

              {existing && (
                <div style={{ padding: '6px 10px', background: 'rgba(59,130,246,0.1)', borderRadius: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 9, color: '#3b82f6' }}>Текущее значение в фазе: {existing.value} {existing.unit}</span>
                </div>
              )}

              {detailEntry.description && (
                <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                  {detailEntry.description}
                </div>
              )}
            </div>
          </div>
        );
      })()}
      </>)}
    </div>
  );
}

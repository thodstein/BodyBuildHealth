import { SUPPLEMENTS_DB } from './support-db/supplements';
import { PHARMACY_DB } from './support-db/pharmacy-db';
import { PHARMA_LAB_MARKERS } from './pharma-lab-marker-map';
import { PHARMA_DB } from '../core/pharma-database';
import { UCUM_MAP } from '../core/constants';

export interface LabEffect {
  marker: string;
  direction: 'up' | 'down' | 'normalize';
  strength: number;
  reason: string;
}

export interface DrugLabInfo {
  drugId: string;
  effects: LabEffect[];
  source: 'tz_mech' | 'explicit' | 'pharma_class';
}

const TZ_MECH_TO_LAB: Record<string, LabEffect[]> = {
  'cv1': [
    { marker: 'NT_PROBNP', direction: 'down', strength: 0.3, reason: 'Снижение ремоделирования миокарда' },
    { marker: 'ECHO_LV_MASS', direction: 'down', strength: 0.3, reason: 'Регресс гипертрофии ЛЖ' },
  ],
  'cv2': [
    { marker: 'LDL', direction: 'down', strength: 0.3, reason: 'Снижение ЛПНП' },
    { marker: 'HDL', direction: 'up', strength: 0.2, reason: 'Повышение ЛПВП' },
    { marker: 'TG', direction: 'down', strength: 0.2, reason: 'Снижение триглицеридов' },
    { marker: 'APO_B', direction: 'down', strength: 0.2, reason: 'Снижение аполипопротеина B' },
  ],
  'cv3': [
    { marker: 'BP_SYSTOLIC', direction: 'down', strength: 0.3, reason: 'Снижение АД (Na/H2O)' },
    { marker: 'BP_DIASTOLIC', direction: 'down', strength: 0.3, reason: 'Снижение АД' },
  ],
  'cv4': [
    { marker: 'FIBRINOGEN', direction: 'down', strength: 0.3, reason: 'Антитромботический эффект' },
    { marker: 'D_DIMER', direction: 'down', strength: 0.2, reason: 'Снижение фибринолиза' },
    { marker: 'PLT', direction: 'down', strength: 0.2, reason: 'Антиагрегантный эффект' },
  ],
  'cv5': [
    { marker: 'HR', direction: 'down', strength: 0.3, reason: 'Снижение ЧСС' },
    { marker: 'BP_SYSTOLIC', direction: 'down', strength: 0.2, reason: 'Антиаритмический эффект' },
  ],
  'liv1': [
    { marker: 'ALT', direction: 'down', strength: 0.3, reason: 'Гепатопротекция (цитолиз)' },
    { marker: 'AST', direction: 'down', strength: 0.3, reason: 'Гепатопротекция (цитолиз)' },
    { marker: 'GGT', direction: 'down', strength: 0.2, reason: 'Снижение цитолиза' },
  ],
  'liv2': [
    { marker: 'GGT', direction: 'down', strength: 0.3, reason: 'Улучшение желчеоттока' },
    { marker: 'ALP', direction: 'down', strength: 0.3, reason: 'Снижение холестаза' },
    { marker: 'BIL', direction: 'down', strength: 0.2, reason: 'Снижение билирубина' },
    { marker: 'DBIL', direction: 'down', strength: 0.2, reason: 'Снижение прямого билирубина' },
  ],
  'liv3': [
    { marker: 'ALT', direction: 'down', strength: 0.2, reason: 'Антифибротический эффект' },
    { marker: 'AST', direction: 'down', strength: 0.2, reason: 'Антифибротический эффект' },
  ],
  'ren1': [
    { marker: 'CREATININE', direction: 'down', strength: 0.3, reason: 'Снижение внутриклубочкового давления' },
    { marker: 'EGFR', direction: 'up', strength: 0.3, reason: 'Улучшение СКФ' },
    { marker: 'UREA', direction: 'down', strength: 0.2, reason: 'Снижение мочевины' },
  ],
  'ren2': [
    { marker: 'CREATININE', direction: 'down', strength: 0.2, reason: 'Снижение гиперфильтрации' },
    { marker: 'EGFR', direction: 'up', strength: 0.2, reason: 'Нормализация СКФ' },
  ],
  'ren3': [
    { marker: 'PROTEIN_URINE', direction: 'down', strength: 0.3, reason: 'Снижение протеинурии' },
    { marker: 'MICROALB', direction: 'down', strength: 0.3, reason: 'Снижение микроальбуминурии' },
  ],
  'ren4': [
    { marker: 'K', direction: 'up', strength: 0.3, reason: 'Нормализация калия' },
    { marker: 'NA', direction: 'down', strength: 0.2, reason: 'Выведение натрия' },
    { marker: 'MG', direction: 'up', strength: 0.2, reason: 'Нормализация магния' },
  ],
  'cns1': [
    { marker: 'CORTISOL', direction: 'down', strength: 0.2, reason: 'Модуляция нейромедиаторов' },
  ],
  'cns2': [
    { marker: 'CRP', direction: 'down', strength: 0.2, reason: 'Антиоксидантная защита ЦНС' },
  ],
  'cns3': [
    { marker: 'CRP', direction: 'down', strength: 0.1, reason: 'Нейропротекция (антиапоптоз)' },
  ],
  'cns4': [
    { marker: 'TSH', direction: 'normalize', strength: 0.3, reason: 'Нормализация нейроэндокринной оси' },
    { marker: 'FT4', direction: 'normalize', strength: 0.2, reason: 'Нормализация Т4' },
    { marker: 'CORTISOL', direction: 'down', strength: 0.2, reason: 'Регуляция кортизола' },
  ],
  'cns5': [
    { marker: 'GLU', direction: 'up', strength: 0.2, reason: 'Предотвращение нейроглюкопении' },
  ],
  'cns6': [
    { marker: 'BP_SYSTOLIC', direction: 'down', strength: 0.1, reason: 'Снижение внутричерепного давления' },
  ],
  'rep1': [
    { marker: 'LH', direction: 'up', strength: 0.3, reason: 'Восстановление ГГЯ-оси (LH)' },
    { marker: 'FSH', direction: 'up', strength: 0.3, reason: 'Восстановление ГГЯ-оси (FSH)' },
    { marker: 'TT', direction: 'up', strength: 0.3, reason: 'Восстановление тестостерона' },
  ],
  'rep2': [
    { marker: 'TT', direction: 'up', strength: 0.3, reason: 'Повышение интратестикулярного T' },
    { marker: 'FT', direction: 'up', strength: 0.3, reason: 'Повышение свободного T' },
  ],
  'rep3': [
    { marker: 'INHB', direction: 'up', strength: 0.3, reason: 'Улучшение сперматогенеза (ингибин Б)' },
    { marker: 'FSH', direction: 'up', strength: 0.2, reason: 'Стимуляция сперматогенеза' },
  ],
  'rep4': [
    { marker: 'E2', direction: 'down', strength: 0.3, reason: 'Снижение эстрогенного сдвига' },
    { marker: 'PRL', direction: 'down', strength: 0.2, reason: 'Контроль пролактина' },
  ],
  'rep5': [
    { marker: 'LH', direction: 'up', strength: 0.3, reason: 'Восстановление постцикловой ГГЯ-оси' },
    { marker: 'FSH', direction: 'up', strength: 0.3, reason: 'Восстановление ФСГ' },
    { marker: 'TT', direction: 'up', strength: 0.4, reason: 'Восстановление тестостерона' },
  ],
  'hem1': [
    { marker: 'HCT', direction: 'down', strength: 0.3, reason: 'Снижение эритроцитоза' },
    { marker: 'HGB', direction: 'down', strength: 0.3, reason: 'Снижение гемоглобина' },
  ],
  'hem2': [
    { marker: 'GLU', direction: 'down', strength: 0.3, reason: 'Снижение глюкозы (инсулиночувств.)' },
    { marker: 'INS', direction: 'down', strength: 0.3, reason: 'Снижение инсулина' },
    { marker: 'HOMA', direction: 'down', strength: 0.3, reason: 'Снижение HOMA-IR' },
    { marker: 'HbA1c', direction: 'down', strength: 0.2, reason: 'Снижение гликированного Hb' },
  ],
  'hem3': [
    { marker: 'GLU', direction: 'up', strength: 0.3, reason: 'Предотвращение гипогликемии' },
  ],
  'hem4': [
    { marker: 'K', direction: 'up', strength: 0.3, reason: 'Нормализация калия' },
  ],
  'hem5': [
    { marker: 'K', direction: 'up', strength: 0.2, reason: 'Нормализация электролитов (K)' },
    { marker: 'NA', direction: 'down', strength: 0.2, reason: 'Нормализация электролитов (Na)' },
    { marker: 'MG', direction: 'up', strength: 0.2, reason: 'Нормализация магния' },
  ],
};

export { TZ_MECH_TO_LAB };

const EXPLICIT_LAB_EFFECTS: Record<string, LabEffect[]> = {
  nac: [
    { marker: 'ALT', direction: 'down', strength: 0.4, reason: '↑GSH, ↓цитолиза гепатоцитов' },
    { marker: 'AST', direction: 'down', strength: 0.4, reason: '↑GSH, ↓цитолиза' },
    { marker: 'GGT', direction: 'down', strength: 0.2, reason: 'Антиоксидантная защита' },
    { marker: 'HOMOCYSTEINE', direction: 'down', strength: 0.15, reason: 'Донатор SH-групп, ↓гомоцистеина' },
  ],
  tudca: [
    { marker: 'GGT', direction: 'down', strength: 0.4, reason: '↑BSEP, ↓холестаза' },
    { marker: 'ALP', direction: 'down', strength: 0.35, reason: 'Улучшение желчеоттока' },
    { marker: 'BIL', direction: 'down', strength: 0.25, reason: '↓билирубина при холестазе' },
    { marker: 'DBIL', direction: 'down', strength: 0.25, reason: '↓прямого билирубина' },
    { marker: 'ALT', direction: 'down', strength: 0.2, reason: '↓ER-стресса гепатоцитов' },
  ],
  milk_thistle: [
    { marker: 'ALT', direction: 'down', strength: 0.3, reason: 'Силимарин ↓цитолиза' },
    { marker: 'AST', direction: 'down', strength: 0.3, reason: 'Стабилизация мембран' },
  ],
  omega3: [
    { marker: 'TG', direction: 'down', strength: 0.3, reason: '↓ТГ 20-30%' },
    { marker: 'HDL', direction: 'up', strength: 0.2, reason: '↑ЛПВП' },
    { marker: 'LDL', direction: 'down', strength: 0.1, reason: 'Мягкое ↓ЛПНП' },
    { marker: 'FIBRINOGEN', direction: 'down', strength: 0.15, reason: '↓агрегации тромбоцитов' },
    { marker: 'HOMA', direction: 'down', strength: 0.15, reason: '↑инсулиночувствительности' },
    { marker: 'CRP', direction: 'down', strength: 0.15, reason: '↓воспаления' },
  ],
  coq10: [
    { marker: 'LDL', direction: 'down', strength: 0.1, reason: '↓оксидации ЛПНП' },
    { marker: 'CRP', direction: 'down', strength: 0.1, reason: '↓оксидативного стресса' },
  ],
  magnesium: [
    { marker: 'BP_SYSTOLIC', direction: 'down', strength: 0.15, reason: '↓тонуса сосудов' },
    { marker: 'BP_DIASTOLIC', direction: 'down', strength: 0.15, reason: '↓АД' },
    { marker: 'HR', direction: 'down', strength: 0.15, reason: '↓QT, ↓аритмий' },
    { marker: 'K', direction: 'up', strength: 0.2, reason: 'Регуляция K+ каналов' },
    { marker: 'MG', direction: 'up', strength: 0.4, reason: 'Прямое восполнение' },
  ],
  zinc: [
    { marker: 'TT', direction: 'up', strength: 0.15, reason: 'Кофактор стероидогенеза' },
    { marker: 'INHB', direction: 'up', strength: 0.2, reason: 'Поддержка сперматогенеза' },
  ],
  selenium: [
    { marker: 'CRP', direction: 'down', strength: 0.1, reason: 'Селенопротеины, ↓воспаления' },
  ],
  vitamin_d3: [
    { marker: 'TT', direction: 'up', strength: 0.1, reason: '↑эндогенного T через VDR' },
    { marker: 'HOMA', direction: 'down', strength: 0.1, reason: '↑инсулиночувствительности' },
    { marker: 'CRP', direction: 'down', strength: 0.1, reason: '↓воспаления' },
  ],
  vitamin_k2: [
    { marker: 'LDL', direction: 'down', strength: 0.08, reason: '↓кальцификации сосудов (MGP)' },
  ],
  berberine: [
    { marker: 'GLU', direction: 'down', strength: 0.3, reason: 'AMPK, ↓глюкозы' },
    { marker: 'INS', direction: 'down', strength: 0.3, reason: '↑инсулиночувствительности' },
    { marker: 'HOMA', direction: 'down', strength: 0.3, reason: '↓HOMA-IR' },
    { marker: 'HbA1c', direction: 'down', strength: 0.2, reason: '↓гликированного Hb' },
    { marker: 'LDL', direction: 'down', strength: 0.2, reason: '↓ЛПНП' },
    { marker: 'TG', direction: 'down', strength: 0.15, reason: '↓ТГ' },
  ],
  curcumin: [
    { marker: 'LDL', direction: 'down', strength: 0.15, reason: '↓ЛПНП' },
    { marker: 'GLU', direction: 'down', strength: 0.2, reason: '↓глюкозы' },
    { marker: 'CRP', direction: 'down', strength: 0.15, reason: '↓воспаления (NF-κB)' },
  ],
  alpha_lipoic: [
    { marker: 'GLU', direction: 'down', strength: 0.2, reason: '↑GLUT4, ↓глюкозы' },
    { marker: 'HOMA', direction: 'down', strength: 0.2, reason: '↑инсулиночувствительности' },
    { marker: 'CRP', direction: 'down', strength: 0.1, reason: 'Антиоксидант' },
  ],
  aspirin: [
    { marker: 'FIBRINOGEN', direction: 'down', strength: 0.15, reason: '↓агрегации (COX-1)' },
    { marker: 'D_DIMER', direction: 'down', strength: 0.1, reason: 'Антитромботический' },
    { marker: 'PLT', direction: 'down', strength: 0.15, reason: 'Антиагрегант' },
  ],
  telmisartan: [
    { marker: 'BP_SYSTOLIC', direction: 'down', strength: 0.4, reason: 'ARB, ↓АД' },
    { marker: 'BP_DIASTOLIC', direction: 'down', strength: 0.4, reason: 'ARB, ↓АД' },
    { marker: 'CREATININE', direction: 'down', strength: 0.2, reason: 'Нефропротекция' },
    { marker: 'EGFR', direction: 'up', strength: 0.25, reason: '↑СКФ' },
    { marker: 'PROTEIN_URINE', direction: 'down', strength: 0.3, reason: '↓протеинурии' },
    { marker: 'MICROALB', direction: 'down', strength: 0.3, reason: '↓микроальбуминурии' },
    { marker: 'HOMA', direction: 'down', strength: 0.2, reason: 'PPAR-γ, ↑инсулиночувств.' },
  ],
  nebivolol: [
    { marker: 'BP_SYSTOLIC', direction: 'down', strength: 0.3, reason: 'β1-блокада + NO' },
    { marker: 'BP_DIASTOLIC', direction: 'down', strength: 0.3, reason: '↓АД' },
    { marker: 'HR', direction: 'down', strength: 0.3, reason: '↓ЧСС' },
  ],
  atorvastatin: [
    { marker: 'LDL', direction: 'down', strength: 0.5, reason: '↓ЛПНП 50%' },
    { marker: 'TG', direction: 'down', strength: 0.2, reason: '↓ТГ' },
    { marker: 'CRP', direction: 'down', strength: 0.15, reason: 'Плеотропный эффект' },
    { marker: 'APO_B', direction: 'down', strength: 0.4, reason: '↓Аполипопротеина B' },
  ],
  rosuvastatin: [
    { marker: 'LDL', direction: 'down', strength: 0.55, reason: '↓ЛПНП 55%' },
    { marker: 'TG', direction: 'down', strength: 0.2, reason: '↓ТГ' },
    { marker: 'APO_B', direction: 'down', strength: 0.45, reason: '↓АпоB' },
  ],
  anastrozole: [
    { marker: 'E2', direction: 'down', strength: 0.5, reason: 'Ингибитор ароматазы, ↓E2' },
    { marker: 'TT', direction: 'up', strength: 0.15, reason: '↑T (↓обратной связи)' },
  ],
  tamoxifen: [
    { marker: 'E2', direction: 'down', strength: 0.3, reason: 'Блокада ER, ↓эстрогенного эффекта' },
    { marker: 'LH', direction: 'up', strength: 0.3, reason: 'PCT: ↑ЛГ' },
    { marker: 'FSH', direction: 'up', strength: 0.3, reason: 'PCT: ↑ФСГ' },
    { marker: 'TT', direction: 'up', strength: 0.3, reason: 'PCT: ↑T' },
  ],
  cabergoline: [
    { marker: 'PRL', direction: 'down', strength: 0.5, reason: 'D2-агонист, ↓пролактина' },
    { marker: 'TT', direction: 'up', strength: 0.15, reason: '↓пролактина → ↑T' },
  ],
  hcg: [
    { marker: 'TT', direction: 'up', strength: 0.4, reason: 'Аналог ЛГ, ↑T' },
    { marker: 'FT', direction: 'up', strength: 0.4, reason: '↑свободного T' },
    { marker: 'LH', direction: 'down', strength: 0.2, reason: 'Замещение ЛГ (↓эндогенного)' },
    { marker: 'INHB', direction: 'up', strength: 0.3, reason: '↑ингибина B' },
    { marker: 'E2', direction: 'up', strength: 0.15, reason: 'Ароматизация экзогенного T' },
  ],
  clomi: [
    { marker: 'LH', direction: 'up', strength: 0.35, reason: 'SERM, ↑ЛГ' },
    { marker: 'FSH', direction: 'up', strength: 0.35, reason: 'SERM, ↑ФСГ' },
    { marker: 'TT', direction: 'up', strength: 0.35, reason: 'PCT: ↑T' },
  ],
  metformin: [
    { marker: 'GLU', direction: 'down', strength: 0.3, reason: 'AMPK, ↓глюкозы' },
    { marker: 'INS', direction: 'down', strength: 0.3, reason: '↓инсулина' },
    { marker: 'HOMA', direction: 'down', strength: 0.35, reason: '↓HOMA-IR' },
    { marker: 'HbA1c', direction: 'down', strength: 0.2, reason: '↓гликированного Hb' },
  ],
  garlic: [
    { marker: 'BP_SYSTOLIC', direction: 'down', strength: 0.1, reason: '↓АД (аллицин)' },
    { marker: 'LDL', direction: 'down', strength: 0.05, reason: 'Мягкое ↓ЛПНП' },
  ],
  ashwagandha: [
    { marker: 'CORTISOL', direction: 'down', strength: 0.2, reason: 'Адаптоген, ↓кортизола' },
    { marker: 'TT', direction: 'up', strength: 0.1, reason: '↑T (стресс-модуляция)' },
  ],
  finasteride: [
    { marker: 'DHT', direction: 'down', strength: 0.5, reason: 'Ингибитор 5α-редуктазы' },
    { marker: 'TT', direction: 'up', strength: 0.05, reason: '↑T (↓конверсии в DHT)' },
  ],
  taurine: [
    { marker: 'BP_SYSTOLIC', direction: 'down', strength: 0.1, reason: 'Осморегулятор' },
    { marker: 'HR', direction: 'down', strength: 0.15, reason: 'Антиаритмический' },
  ],
  l_carnitine: [
    { marker: 'TG', direction: 'down', strength: 0.1, reason: 'β-окисление ЖК' },
    { marker: 'HOMA', direction: 'down', strength: 0.05, reason: '↑инсулиночувств.' },
  ],
  folate: [
    { marker: 'HOMOCYSTEINE', direction: 'down', strength: 0.2, reason: '↓гомоцистеина' },
  ],
  vitamin_b12: [
    { marker: 'HOMOCYSTEINE', direction: 'down', strength: 0.15, reason: 'Кофактор метилирования' },
  ],
  vitamin_b6: [
    { marker: 'HOMOCYSTEINE', direction: 'down', strength: 0.1, reason: 'Кофактор метилирования' },
  ],
  lisinopril: [
    { marker: 'BP_SYSTOLIC', direction: 'down', strength: 0.35, reason: 'АПФ-ингибитор' },
    { marker: 'BP_DIASTOLIC', direction: 'down', strength: 0.35, reason: '↓АД' },
    { marker: 'PROTEIN_URINE', direction: 'down', strength: 0.25, reason: '↓протеинурии' },
  ],
  losartan: [
    { marker: 'BP_SYSTOLIC', direction: 'down', strength: 0.4, reason: 'ARB, ↓АД' },
    { marker: 'BP_DIASTOLIC', direction: 'down', strength: 0.4, reason: '↓АД' },
    { marker: 'PROTEIN_URINE', direction: 'down', strength: 0.35, reason: '↓протеинурии' },
    { marker: 'EGFR', direction: 'up', strength: 0.2, reason: '↑СКФ' },
  ],
  carvedilol: [
    { marker: 'BP_SYSTOLIC', direction: 'down', strength: 0.3, reason: 'β1/β2-блокада' },
    { marker: 'HR', direction: 'down', strength: 0.25, reason: '↓ЧСС' },
  ],
  warfarin: [
    { marker: 'INR', direction: 'up', strength: 0.5, reason: 'Антикоагулянт, ↑МНО' },
    { marker: 'FIBRINOGEN', direction: 'down', strength: 0.2, reason: '↓свертываемости' },
  ],
  clopidogrel: [
    { marker: 'PLT', direction: 'down', strength: 0.3, reason: 'Антиагрегант' },
  ],
  levothyroxine: [
    { marker: 'TSH', direction: 'down', strength: 0.4, reason: 'T4, ↓ТТГ' },
    { marker: 'FT4', direction: 'up', strength: 0.4, reason: 'Замещение T4' },
  ],
  fluoxetine: [
    { marker: 'CORTISOL', direction: 'down', strength: 0.1, reason: 'СИОЗС, модуляция стресса' },
  ],
};

export { EXPLICIT_LAB_EFFECTS };

function inferPharmaLabEffects(drugId: string): LabEffect[] {
  const drug = (PHARMA_DB as unknown as Record<string, { class?: string; pd?: Record<string, number>; form?: string }>)[drugId];
  if (!drug) return [];

  const cls = drug.class || '';
  const pd = drug.pd || {};
  const effects: LabEffect[] = [];

  if (cls === 'testosterone') {
    effects.push(
      { marker: 'E2', direction: 'up', strength: 0.4, reason: 'Ароматизация → ↑E2' },
      { marker: 'HCT', direction: 'up', strength: 0.4, reason: '↑эритропоэза' },
      { marker: 'HGB', direction: 'up', strength: 0.35, reason: '↑гемоглобина' },
      { marker: 'LH', direction: 'down', strength: 0.5, reason: 'Подавление HPG-оси' },
      { marker: 'FSH', direction: 'down', strength: 0.5, reason: 'Подавление HPG-оси' },
      { marker: 'TT', direction: 'up', strength: 0.6, reason: 'Экзогенный T' },
      { marker: 'HDL', direction: 'down', strength: 0.25, reason: '↓ЛПВП' },
      { marker: 'LDL', direction: 'up', strength: 0.15, reason: '↑ЛПНП' },
      { marker: 'BP_SYSTOLIC', direction: 'up', strength: 0.15, reason: 'Задержка Na/H₂O' },
    );
  }

  if (cls === 'trenbolone') {
    effects.push(
      { marker: 'PRL', direction: 'up', strength: 0.3, reason: 'Прогестагенная активность → ↑пролактина' },
      { marker: 'HCT', direction: 'up', strength: 0.4, reason: '↑эритропоэза' },
      { marker: 'LH', direction: 'down', strength: 0.6, reason: 'Полное подавление HPTA' },
      { marker: 'FSH', direction: 'down', strength: 0.6, reason: 'Полное подавление HPTA' },
      { marker: 'TT', direction: 'down', strength: 0.5, reason: 'Подавление эндогенного T' },
      { marker: 'HDL', direction: 'down', strength: 0.35, reason: '↓ЛПВП' },
      { marker: 'LDL', direction: 'up', strength: 0.25, reason: '↑ЛПНП' },
      { marker: 'ALT', direction: 'up', strength: 0.2, reason: 'Гепатотоксичность' },
      { marker: 'AST', direction: 'up', strength: 0.2, reason: 'Гепатотоксичность' },
      { marker: 'BP_SYSTOLIC', direction: 'up', strength: 0.25, reason: 'Вазоконстрикция' },
      { marker: 'HR', direction: 'up', strength: 0.15, reason: '↑ЧСС' },
    );
  }

  if (cls === 'nandrolone') {
    effects.push(
      { marker: 'PRL', direction: 'up', strength: 0.25, reason: 'Прогестагенная активность' },
      { marker: 'HCT', direction: 'up', strength: 0.3, reason: '↑эритропоэза' },
      { marker: 'LH', direction: 'down', strength: 0.5, reason: 'Подавление HPTA' },
      { marker: 'FSH', direction: 'down', strength: 0.5, reason: 'Подавление HPTA' },
      { marker: 'TT', direction: 'down', strength: 0.4, reason: 'Подавление эндогенного T' },
      { marker: 'HDL', direction: 'down', strength: 0.3, reason: '↓ЛПВП' },
      { marker: 'LDL', direction: 'up', strength: 0.2, reason: '↑ЛПНП' },
    );
  }

  if (cls === 'dht' || cls === 'dht_derivative') {
    effects.push(
      { marker: 'DHT', direction: 'up', strength: 0.5, reason: 'DHT-производное' },
      { marker: 'HDL', direction: 'down', strength: 0.3, reason: '↓ЛПВП' },
      { marker: 'LDL', direction: 'up', strength: 0.2, reason: '↑ЛПНП' },
      { marker: 'LH', direction: 'down', strength: 0.4, reason: 'Подавление HPTA' },
    );
  }

  if (drug.form === 'oral' && (cls === 'aas' || cls === 'testosterone' || cls === 'trenbolone' || cls === 'nandrolone' || cls === 'dht' || cls === 'dht_derivative')) {
    effects.push(
      { marker: 'ALT', direction: 'up', strength: 0.3, reason: '17α-алкилированный, гепатотоксичность' },
      { marker: 'AST', direction: 'up', strength: 0.3, reason: '17α-алкилированный, гепатотоксичность' },
      { marker: 'GGT', direction: 'up', strength: 0.2, reason: '17α-алкилированный' },
      { marker: 'BIL', direction: 'up', strength: 0.15, reason: 'Холестаз при 17α' },
    );
  }

  return effects;
}

function getMechsForSupportDrug(drugId: string): string[] {
  const sup = (SUPPLEMENTS_DB as Record<string, Array<{ mechId: string }>>)[drugId];
  if (sup) return sup.map(e => e.mechId);

  const pharm = (PHARMACY_DB as Record<string, Array<{ mechId: string }>>)[drugId];
  if (pharm) return pharm.map(e => e.mechId);

  return [];
}

export function getLabEffectsForDrug(drugId: string): DrugLabInfo {
  const explicit = EXPLICIT_LAB_EFFECTS[drugId];
  if (explicit) return { drugId, effects: explicit, source: 'explicit' };

  const pharmaEffects = inferPharmaLabEffects(drugId);
  if (pharmaEffects.length > 0) return { drugId, effects: pharmaEffects, source: 'pharma_class' };

  const mechIds = getMechsForSupportDrug(drugId);
  if (mechIds.length > 0) {
    const effects: LabEffect[] = [];
    const seen = new Set<string>();
    for (const mechId of mechIds) {
      const mechEffects = TZ_MECH_TO_LAB[mechId];
      if (mechEffects) {
        for (const eff of mechEffects) {
          const key = `${eff.marker}_${eff.direction}`;
          if (!seen.has(key)) {
            seen.add(key);
            effects.push(eff);
          }
        }
      }
    }
    if (effects.length > 0) return { drugId, effects, source: 'tz_mech' };
  }

  return { drugId, effects: [], source: 'tz_mech' };
}

export function getDrugsForMarker(marker: string): Array<{ drugId: string; effect: LabEffect; source: string }> {
  const results: Array<{ drugId: string; effect: LabEffect; source: string }> = [];

  for (const drugId of Object.keys(EXPLICIT_LAB_EFFECTS)) {
    for (const eff of EXPLICIT_LAB_EFFECTS[drugId]) {
      if (eff.marker === marker) results.push({ drugId, effect: eff, source: 'explicit' });
    }
  }

  for (const drugId of Object.keys(PHARMA_DB as Record<string, { class?: string }>)) {
    const info = getLabEffectsForDrug(drugId);
    if (info.source === 'pharma_class') {
      for (const eff of info.effects) {
        if (eff.marker === marker) results.push({ drugId, effect: eff, source: info.source });
      }
    }
  }

  for (const drugId of Object.keys(SUPPLEMENTS_DB)) {
    const info = getLabEffectsForDrug(drugId);
    if (info.source === 'tz_mech') {
      for (const eff of info.effects) {
        if (eff.marker === marker) results.push({ drugId, effect: eff, source: info.source });
      }
    }
  }

  for (const drugId of Object.keys(PHARMACY_DB)) {
    const info = getLabEffectsForDrug(drugId);
    if (info.source === 'tz_mech') {
      for (const eff of info.effects) {
        if (eff.marker === marker) results.push({ drugId, effect: eff, source: info.source });
      }
    }
  }

  const seen = new Set<string>();
  return results.filter(r => {
    const key = `${r.drugId}_${r.effect.marker}_${r.effect.direction}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getDrugsToNormalizeMarker(marker: string, isHigh: boolean): Array<{ drugId: string; effect: LabEffect; source: string }> {
  const all = getDrugsForMarker(marker);
  const wantedDirection = isHigh ? 'down' : 'up';
  return all
    .filter(r => r.effect.direction === wantedDirection || r.effect.direction === 'normalize')
    .sort((a, b) => b.effect.strength - a.effect.strength);
}

export function getMarkerName(marker: string): string {
  const entry = (UCUM_MAP as Record<string, { name?: string }>)[marker];
  return entry?.name || marker;
}

// ── АПТЕЧНЫЕ ПРЕПАРАТЫ (Фармакология) с маппингом на 28 механизмов ТЗ ──
// TzSupportEntry type is defined in risk-engine-tz-db.ts, but we import it from there
import type { TzSupportEntry } from './types';

export const PHARMACY_DB: Record<string, TzSupportEntry[]> = {
  // ═══ СТАТИНЫ ═══
  atorvastatin: [ { organId:'cardio', mechId:'cv2', k:0.50, q:'A', source:'Снижение ЛПНП 50%, ↓ СС-событий' }, { organId:'cardio', mechId:'cv1', k:0.15, q:'B', source:'Плеотропный эффект: ↓ воспаления, ↓ ремоделирования' } ],
  rosuvastatin: [ { organId:'cardio', mechId:'cv2', k:0.55, q:'A', source:'Снижение ЛПНП 55%' }, { organId:'cardio', mechId:'cv1', k:0.15, q:'B', source:'Плеотропный эффект: ↓ ремоделирования' } ],
  simvastatin: [ { organId:'cardio', mechId:'cv2', k:0.40, q:'A', source:'Снижение ЛПНП 40%' } ],
  pravastatin: [ { organId:'cardio', mechId:'cv2', k:0.30, q:'A', source:'Снижение ЛПНП 30%' } ],
  pitavastatin: [ { organId:'cardio', mechId:'cv2', k:0.40, q:'A', source:'Снижение ЛПНП 40%' } ],
  // ═══ АПФ-ИНГИБИТОРЫ ═══
  lisinopril: [ { organId:'cardio', mechId:'cv3', k:0.35, q:'A', source:'АПФ-ингибитор, ↓ АД' }, { organId:'renal', mechId:'ren1', k:0.30, q:'A', source:'↓ внутриклубочкового давления' }, { organId:'renal', mechId:'ren2', k:0.25, q:'A', source:'↓ гиперфильтрации (efferent vasodilation)' }, { organId:'renal', mechId:'ren3', k:0.30, q:'A', source:'↓ протеинурии' } ],
  enalapril: [ { organId:'cardio', mechId:'cv3', k:0.35, q:'A', source:'АПФ-ингибитор, ↓ АД' }, { organId:'renal', mechId:'ren2', k:0.25, q:'A', source:'↓ гиперфильтрации' } ],
  ramipril: [ { organId:'cardio', mechId:'cv3', k:0.35, q:'A', source:'АПФ-ингибитор, ↓ АД' }, { organId:'renal', mechId:'ren1', k:0.30, q:'A', source:'↓ внутриклубочкового давления' }, { organId:'renal', mechId:'ren2', k:0.25, q:'A', source:'↓ гиперфильтрации' }, { organId:'renal', mechId:'ren3', k:0.30, q:'A', source:'↓ протеинурии' } ],
  perindopril: [ { organId:'cardio', mechId:'cv3', k:0.35, q:'A', source:'АПФ-ингибитор, ↓ АД' }, { organId:'renal', mechId:'ren2', k:0.25, q:'A', source:'↓ гиперфильтрации' } ],
  captopril: [ { organId:'cardio', mechId:'cv3', k:0.35, q:'A', source:'АПФ-ингибитор, ↓ АД' }, { organId:'renal', mechId:'ren2', k:0.25, q:'A', source:'↓ гиперфильтрации' } ],
  // ═══ БРА (САРТАНЫ) ═══
  losartan: [ { organId:'cardio', mechId:'cv3', k:0.45, q:'A', source:'ARB, ↓ АД' }, { organId:'renal', mechId:'ren1', k:0.35, q:'A', source:'↓ внутриклубочкового давления' }, { organId:'renal', mechId:'ren2', k:0.30, q:'A', source:'↓ гиперфильтрации (efferent vasodilation)' }, { organId:'renal', mechId:'ren3', k:0.40, q:'A', source:'↓ протеинурии' } ],
  valsartan: [ { organId:'cardio', mechId:'cv3', k:0.45, q:'A', source:'ARB, ↓ АД' }, { organId:'renal', mechId:'ren1', k:0.35, q:'A', source:'↓ внутриклубочкового давления' }, { organId:'renal', mechId:'ren2', k:0.30, q:'A', source:'↓ гиперфильтрации' }, { organId:'renal', mechId:'ren3', k:0.40, q:'A', source:'↓ протеинурии' } ],
  irbesartan: [ { organId:'cardio', mechId:'cv3', k:0.45, q:'A', source:'ARB, ↓ АД' }, { organId:'renal', mechId:'ren1', k:0.35, q:'A', source:'↓ внутриклубочкового давления' }, { organId:'renal', mechId:'ren2', k:0.30, q:'A', source:'↓ гиперфильтрации' }, { organId:'renal', mechId:'ren3', k:0.40, q:'A', source:'↓ протеинурии' } ],
  olmesartan: [ { organId:'cardio', mechId:'cv3', k:0.45, q:'A', source:'ARB, ↓ АД' }, { organId:'renal', mechId:'ren1', k:0.35, q:'A', source:'↓ внутриклубочкового давления' }, { organId:'renal', mechId:'ren2', k:0.30, q:'A', source:'↓ гиперфильтрации' }, { organId:'renal', mechId:'ren3', k:0.40, q:'A', source:'↓ протеинурии' } ],
  candesartan: [ { organId:'cardio', mechId:'cv3', k:0.45, q:'A', source:'ARB, ↓ АД' }, { organId:'renal', mechId:'ren1', k:0.35, q:'A', source:'↓ внутриклубочкового давления' }, { organId:'renal', mechId:'ren2', k:0.30, q:'A', source:'↓ гиперфильтрации' }, { organId:'renal', mechId:'ren3', k:0.40, q:'A', source:'↓ протеинурии' } ],
  // ═══ БЕТА-БЛОКАТОРЫ ═══
  metoprolol: [ { organId:'cardio', mechId:'cv5', k:0.30, q:'A', source:'β1-блокада, ↓ ЧСС' }, { organId:'cardio', mechId:'cv3', k:0.25, q:'A', source:'↓ АД' } ],
  atenolol: [ { organId:'cardio', mechId:'cv5', k:0.30, q:'A', source:'β1-блокада, ↓ ЧСС' }, { organId:'cardio', mechId:'cv3', k:0.25, q:'A', source:'↓ АД' } ],
  bisoprolol: [ { organId:'cardio', mechId:'cv5', k:0.35, q:'A', source:'β1-блокада, ↓ ЧСС' }, { organId:'cardio', mechId:'cv3', k:0.25, q:'A', source:'↓ АД' } ],
  carvedilol: [ { organId:'cardio', mechId:'cv5', k:0.30, q:'A', source:'β1/β2-блокада' }, { organId:'cardio', mechId:'cv3', k:0.30, q:'A', source:'↓ АД' }, { organId:'cardio', mechId:'cv1', k:0.20, q:'B', source:'↓ ремоделирования' } ],
  propranolol: [ { organId:'cardio', mechId:'cv5', k:0.25, q:'A', source:'β-блокада' }, { organId:'cns', mechId:'cns1', k:0.10, q:'C', source:'↓ тревоги' } ],
  // ═══ БЛОКАТОРЫ КАЛЬЦИЕВЫХ КАНАЛОВ ═══
  amlodipine: [ { organId:'cardio', mechId:'cv3', k:0.30, q:'A', source:'CCB, ↓ АД' } ],
  nifedipine: [ { organId:'cardio', mechId:'cv3', k:0.30, q:'A', source:'CCB, ↓ АД' } ],
  verapamil: [ { organId:'cardio', mechId:'cv5', k:0.20, q:'A', source:'CCB, ↓ ЧСС' } ],
  diltiazem: [ { organId:'cardio', mechId:'cv5', k:0.20, q:'A', source:'CCB, ↓ ЧСС' } ],
  // ═══ ДИУРЕТИКИ ═══
  furosemide: [ { organId:'cardio', mechId:'cv3', k:0.30, q:'A', source:'Петлевой диуретик, ↓ АД' }, { organId:'renal', mechId:'ren4', k:0.20, q:'A', source:'Выведение Na/K' }, { organId:'hematologic', mechId:'hem5', k:0.25, q:'A', source:'Электролитный сдвиг (Na/K/Mg)' } ],
  hydrochlorothiazide: [ { organId:'cardio', mechId:'cv3', k:0.25, q:'A', source:'Тиазид, ↓ АД' }, { organId:'hematologic', mechId:'hem4', k:0.15, q:'B', source:'↓ K+' }, { organId:'hematologic', mechId:'hem5', k:0.20, q:'B', source:'Электролитный сдвиг (Na/K)' } ],
  chlorthalidone: [ { organId:'cardio', mechId:'cv3', k:0.25, q:'A', source:'Тиазид, ↓ АД' }, { organId:'hematologic', mechId:'hem4', k:0.15, q:'B', source:'↓ K+' }, { organId:'hematologic', mechId:'hem5', k:0.20, q:'B', source:'Электролитный сдвиг (Na/K)' } ],
  // ═══ АНТИКОАГУЛЯНТЫ ═══
  warfarin: [ { organId:'cardio', mechId:'cv4', k:0.50, q:'A', source:'Антикоагулянт' } ],
  rivaroxaban: [ { organId:'cardio', mechId:'cv4', k:0.45, q:'A', source:'Ингибитор Xa' } ],
  apixaban: [ { organId:'cardio', mechId:'cv4', k:0.45, q:'A', source:'Ингибитор Xa' } ],
  dabigatran: [ { organId:'cardio', mechId:'cv4', k:0.40, q:'A', source:'Ингибитор тромбина' } ],
  // ═══ АНТИАГРЕГАНТЫ ═══
  clopidogrel: [ { organId:'cardio', mechId:'cv4', k:0.35, q:'A', source:'Антиагрегант' } ],
  ticagrelor: [ { organId:'cardio', mechId:'cv4', k:0.35, q:'A', source:'Антиагрегант' } ],
  // ═══ АНТИДЕПРЕССАНТЫ ═══
  fluoxetine: [ { organId:'cns', mechId:'cns1', k:0.10, q:'B', source:'СИОЗС' } ],
  sertraline: [ { organId:'cns', mechId:'cns1', k:0.10, q:'B', source:'СИОЗС' } ],
  citalopram: [ { organId:'cns', mechId:'cns1', k:0.10, q:'B', source:'СИОЗС' } ],
  escitalopram: [ { organId:'cns', mechId:'cns1', k:0.10, q:'B', source:'СИОЗС' } ],
  venlafaxine: [ { organId:'cns', mechId:'cns1', k:0.10, q:'B', source:'СИОЗСиН' } ],
  duloxetine: [ { organId:'cns', mechId:'cns1', k:0.10, q:'B', source:'СИОЗСиН' } ],
  // ═══ АНТИПСИХОТИКИ ═══
  olanzapine: [ { organId:'hematologic', mechId:'hem2', k:0.20, q:'B', source:'↑ глюкозы' }, { organId:'cns', mechId:'cns1', k:0.20, q:'B', source:'D2/5-HT2-антагонист' } ],
  quetiapine: [ { organId:'hematologic', mechId:'hem2', k:0.20, q:'B', source:'↑ глюкозы' }, { organId:'cns', mechId:'cns1', k:0.20, q:'B', source:'D2/5-HT2-антагонист' } ],
  risperidone: [ { organId:'cns', mechId:'cns1', k:0.25, q:'B', source:'D2-антагонист' } ],
  aripiprazole: [ { organId:'cns', mechId:'cns1', k:0.15, q:'B', source:'Частичный D2-агонист' } ],
  haloperidol: [ { organId:'cns', mechId:'cns1', k:0.30, q:'B', source:'D2-антагонист' } ],
  // ═══ АНКСИОЛИТИКИ ═══
  alprazolam: [ { organId:'cns', mechId:'cns1', k:0.20, q:'B', source:'БДР-агонист' } ],
  diazepam: [ { organId:'cns', mechId:'cns1', k:0.20, q:'B', source:'БДР-агонист' } ],
  lorazepam: [ { organId:'cns', mechId:'cns1', k:0.20, q:'B', source:'БДР-агонист' } ],
  clonazepam: [ { organId:'cns', mechId:'cns1', k:0.20, q:'B', source:'БДР-агонист' } ],
  buspirone: [ { organId:'cns', mechId:'cns1', k:0.10, q:'B', source:'5-HT1A-агонист' } ],
  // ═══ НПВС ═══
  ibuprofen: [ { organId:'cardio', mechId:'cv4', k:0.10, q:'C', source:'↓ агрегации, ↑ АД' } ],
  naproxen: [ { organId:'cardio', mechId:'cv4', k:0.10, q:'C', source:'↓ агрегации' } ],
  celecoxib: [ { organId:'cardio', mechId:'cv4', k:0.05, q:'C', source:'КОКС-2' } ],
  diclofenac: [ { organId:'cardio', mechId:'cv4', k:0.10, q:'C', source:'НПВС' } ],
  // ═══ КОРТИКОСТЕРОИДЫ ═══
  prednisone: [ { organId:'hematologic', mechId:'hem2', k:0.30, q:'B', source:'ГКС, ↑ глюкозы' } ],
  dexamethasone: [ { organId:'hematologic', mechId:'hem2', k:0.30, q:'B', source:'ГКС, ↑ глюкозы' } ],
  hydrocortisone: [ { organId:'hematologic', mechId:'hem2', k:0.20, q:'B', source:'ГКС, ↑ глюкозы' } ],
  methylprednisolone: [ { organId:'hematologic', mechId:'hem2', k:0.30, q:'B', source:'ГКС, ↑ глюкозы' } ],
  // ═══ ПРОТИВОСУДОРОЖНЫЕ ═══
  valproate: [ { organId:'cns', mechId:'cns1', k:0.10, q:'B', source:'↑ GABA' } ],
  lamotrigine: [ { organId:'cns', mechId:'cns1', k:0.10, q:'B', source:'Стабилизатор мембран' } ],
  carbamazepine: [ { organId:'hepatic', mechId:'liv1', k:0.10, q:'C', source:'Индуктор CYP450' } ],
  phenytoin: [ { organId:'hepatic', mechId:'liv1', k:0.10, q:'C', source:'Индуктор CYP450' } ],
  // ═══ ТИРЕОИДНЫЕ ПРЕПАРАТЫ ═══
  levothyroxine: [ { organId:'hematologic', mechId:'hem2', k:0.05, q:'C', source:'T4, ↑ метаболизма' } ],
  liothyronine: [ { organId:'hematologic', mechId:'hem2', k:0.10, q:'C', source:'T3, ↑ метаболизма' } ],
  methimazole: [ { organId:'hematologic', mechId:'hem2', k:0.05, q:'C', source:'Антитиреоидный' } ],
  propylthiouracil: [ { organId:'hematologic', mechId:'hem2', k:0.05, q:'C', source:'Антитиреоидный' } ],
  // ═══ САХАРОСНИЖАЮЩИЕ ═══
  metformin: [ { organId:'hematologic', mechId:'hem2', k:0.30, q:'A', source:'↓ глюкозы, ↑ HOMA-IR, AMPK' }, { organId:'hematologic', mechId:'hem3', k:0.15, q:'C', source:'Стабилизация гликемии (↓ колебаний глюкозы)' }, { organId:'renal', mechId:'ren2', k:0.15, q:'C', source:'AMPK ↓ гиперфильтрации' } ],
  pioglitazone: [ { organId:'hematologic', mechId:'hem2', k:0.35, q:'A', source:'Тиазолидиндион, PPAR-γ' }, { organId:'hematologic', mechId:'hem3', k:0.15, q:'C', source:'Стабилизация гликемии' } ],
  acarbose: [ { organId:'hematologic', mechId:'hem2', k:0.20, q:'B', source:'↓ постпрандиальной глюкозы (α-глюкозидаза)' }, { organId:'hematologic', mechId:'hem3', k:0.20, q:'B', source:'Предотвращение постпрандиальной гипогликемии (замедление всасывания)' } ],
  // ═══ ИММУНОСУПРЕССАНТЫ ═══
  tacrolimus: [ { organId:'renal', mechId:'ren1', k:0.10, q:'B', source:'Кальциневриновый ингибитор' } ],
  cyclosporine: [ { organId:'renal', mechId:'ren1', k:0.15, q:'B', source:'Кальциневриновый ингибитор' } ],
  mycophenolate: [ { organId:'hematologic', mechId:'hem1', k:0.05, q:'C', source:'Иммуносупрессор (экспертно)' } ],
  azathioprine: [ { organId:'hepatic', mechId:'liv1', k:0.10, q:'B', source:'Гепатотоксичность' } ],
};

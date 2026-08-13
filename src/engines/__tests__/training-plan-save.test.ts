/** training-plan-save.test.ts — движок сохранения тренировочных миксов/пресетов:
 *  анализ препаратов → рекомендации, дневник, избранное БАД, очередь в калькулятор. */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyzeMixUsage,
  saveMixToDiaryAndFavorites,
  saveMixToDiary,
  readDiaryMixes,
  deleteDiaryMix,
  addSubstancesToFavorites,
  readFavRecommendations,
  saveRecommendationToFavorites,
  deleteFavRecommendation,
  queueMixToSupportPlan,
  readSupportPlanQueue,
  removeFromSupportPlanQueue,
  getSupportPlanQueueIds,
  analyzePresetEffect,
  subscribePlanQueueChanged,
  getMixIntake,
  toggleMixPhaseIntake,
  analyzeMixEffectiveness,
  MIX_DIARY_KEY,
  FAVORITES_KEY,
  FAV_REC_KEY,
  PLAN_QUEUE_KEY,
  type PlanSubstance,
  type SaveMixInput,
} from '../training-plan-save.engine';

const JOINT_SUBS: PlanSubstance[] = [
  { id: 'collagen', name: 'Коллаген', dose: '15', unit: 'г', mg: 15000, timing: 'pre' },
  { id: 'glucosamine', name: 'Глюкозамин', dose: '1500', unit: 'мг', mg: 1500, timing: 'pre' },
  { id: 'msm', name: 'MSM', dose: '3', unit: 'г', mg: 3000, timing: 'pre' },
  { id: 'vitamin_c', name: 'Витамин C', dose: '1000', unit: 'мг', mg: 1000, timing: 'pre' },
  { id: 'curcumin', name: 'Куркумин', dose: '800', unit: 'мг', mg: 800, timing: 'post' },
  { id: 'omega3', name: 'Омега-3', dose: '3', unit: 'г', mg: 3000, timing: 'post' },
];

const jointInput = (): SaveMixInput => ({
  title: 'Пресет: Суставы и связки',
  kind: 'preset',
  goal: 'joint',
  timing: 'pre',
  score: 82,
  label: 'Отлично',
  weightKg: 80,
  substances: JOINT_SUBS,
});

beforeEach(() => {
  localStorage.clear();
});

describe('analyzeMixUsage', () => {
  it('формирует рекомендации по каждому веществу набора', () => {
    const rec = analyzeMixUsage(jointInput());
    expect(rec.id).toMatch(/^rec_/);
    expect(rec.title).toBe('Пресет: Суставы и связки');
    expect(rec.kind).toBe('preset');
    expect(rec.substances.length).toBe(6);
    for (const s of rec.substances) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.dose).toBeTruthy();
    }
  });

  it('находит вещества в каталоге (found=true) с советами и мониторингом', () => {
    const rec = analyzeMixUsage(jointInput());
    const collagen = rec.substances.find(x => x.id === 'collagen');
    expect(collagen).toBeTruthy();
    expect(collagen!.found).toBe(true);
    expect(collagen!.timing).toContain('30–60 мин');
    expect(collagen!.advice.length).toBeGreaterThan(0);
    expect(Array.isArray(collagen!.warnings)).toBe(true);
    expect(Array.isArray(collagen!.monitoring)).toBe(true);
  });

  it('не падает на неизвестных веществах (found=false)', () => {
    const rec = analyzeMixUsage({ ...jointInput(), substances: [{ id: 'zzz_unknown', name: 'Неизвестное', dose: '1', unit: 'мг', mg: 1 }] });
    expect(rec.substances[0].found).toBe(false);
    expect(rec.substances[0].name).toBe('Неизвестное');
  });

  it('детектирует конфликты между веществами набора', () => {
    // железа + кальций/таурин в одном наборе — конфликт из каталога
    const rec = analyzeMixUsage({
      ...jointInput(),
      substances: [
        { id: 'iron', name: 'Железо', dose: '25', unit: 'мг', mg: 25 },
        { id: 'calcium', name: 'Кальций', dose: '500', unit: 'мг', mg: 500 },
      ],
    });
    const hasConflict = rec.interactions.length > 0;
    expect(hasConflict || rec.general.some(g => g.includes('конфликт'))).toBe(true);
  });

  it('собирает синергии внутри набора', () => {
    const rec = analyzeMixUsage(jointInput());
    const synLine = rec.general.find(g => g.includes('синерги'));
    // если каталог не содержит синергий для набора — общая рекомендация всё равно есть
    expect(rec.general.length).toBeGreaterThan(0);
    expect(typeof synLine).toBe('string');
  });

  it('регистронезависимо находит id каталога (NAC vs nac)', () => {
    const rec = analyzeMixUsage({ ...jointInput(), substances: [{ id: 'NAC', name: 'NAC', dose: '600', unit: 'мг', mg: 600 }] });
    expect(rec.substances[0].id).toBe('nac');
    expect(rec.substances[0].found).toBe(true);
  });

  it('добавляет предупреждение о лаборатории', () => {
    const rec = analyzeMixUsage(jointInput());
    expect(rec.general.some(g => g.includes('лаборатори'))).toBe(true);
  });

  it('учитывает фарму курса: конфликт вещества микса с курсом попадает в warnings', () => {
    const rec = analyzeMixUsage({
      ...jointInput(),
      substances: [{ id: 'zinc', name: 'Цинк', dose: '25', unit: 'мг', mg: 25 }],
      course: [{ id: 'iron', name: 'Железо' }],
    });
    const zinc = rec.substances.find(x => x.id === 'zinc')!;
    expect(zinc.warnings.some(w => w.includes('Железо'))).toBe(true);
    expect(rec.general.some(g => g.includes('Учтена фарма курса'))).toBe(true);
    expect(rec.general.some(g => g.includes('взаимодействия'))).toBe(true);
  });

  it('учитывает фарму курса без конфликтов', () => {
    const rec = analyzeMixUsage({
      ...jointInput(),
      course: [{ id: 'zzz_unknown_drug', name: 'Тест' }],
    });
    expect(rec.general.some(g => g.includes('Учтена фарма курса (1 препарат.) — конфликтов с миксам не выявлено'))).toBe(true);
  });

  it('не добавляет блок про курс, если курс не передан', () => {
    const rec = analyzeMixUsage(jointInput());
    expect(rec.general.some(g => g.includes('Учтена фарма курса'))).toBe(false);
  });
});

describe('saveMixToDiary / readDiaryMixes', () => {
  it('сохраняет запись в дневник (prepend) и удаляет', () => {
    const r1 = saveMixToDiary({ ...jointInput(), title: 'Микс A' });
    const r2 = saveMixToDiary({ ...jointInput(), title: 'Микс B' });
    const arr = readDiaryMixes();
    expect(arr.length).toBe(2);
    expect(arr[0].id).toBe(r2.id);
    expect(arr[0].title).toBe('Микс B');
    expect(arr[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(arr[0].substances.length).toBe(6);
    deleteDiaryMix(r2.id);
    expect(readDiaryMixes().length).toBe(1);
    expect(readDiaryMixes()[0].id).toBe(r1.id);
  });

  it('cap = 20 записей', () => {
    for (let i = 0; i < 25; i++) saveMixToDiary({ ...jointInput(), title: `Микс ${i}` });
    expect(readDiaryMixes().length).toBe(20);
  });

  it('устойчив к битому localStorage', () => {
    localStorage.setItem(MIX_DIARY_KEY, '{{{');
    expect(readDiaryMixes()).toEqual([]);
    const r = saveMixToDiary(jointInput());
    expect(readDiaryMixes()[0].id).toBe(r.id);
  });
});

describe('addSubstancesToFavorites', () => {
  it('добавляет вещества в избранное БАД с дедупом', () => {
    expect(addSubstancesToFavorites(['collagen', 'msm', 'collagen', ' glucosamine '])).toBe(3);
    const favs = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    expect(favs).toEqual(expect.arrayContaining(['collagen', 'msm', 'glucosamine']));
    expect(favs.length).toBe(3);
    expect(addSubstancesToFavorites(['collagen', 'omega3'])).toBe(1);
    expect(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]').length).toBe(4);
  });

  it('канонизирует id (регистр/дефисы)', () => {
    addSubstancesToFavorites(['Omega-3', 'OMEGA_3']);
    const favs = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    expect(favs).toEqual(['omega_3']);
  });
});

describe('рекомендации в избранном', () => {
  it('сохраняет рекомендацию и удаляет', () => {
    const rec = analyzeMixUsage(jointInput());
    saveRecommendationToFavorites(rec);
    expect(readFavRecommendations().length).toBe(1);
    expect(readFavRecommendations()[0].id).toBe(rec.id);
    deleteFavRecommendation(rec.id);
    expect(readFavRecommendations().length).toBe(0);
  });

  it('cap = 20 рекомендаций', () => {
    for (let i = 0; i < 25; i++) saveRecommendationToFavorites(analyzeMixUsage({ ...jointInput(), title: `Рек ${i}` }));
    expect(readFavRecommendations().length).toBe(20);
    expect(readFavRecommendations()[0].title).toBe('Рек 24');
  });
});

describe('очередь в калькулятор поддержки', () => {
  it('добавляет запись в очередь и читает id', () => {
    const rec = analyzeMixUsage(jointInput());
    const entry = queueMixToSupportPlan(rec);
    expect(entry.recId).toBe(rec.id);
    expect(entry.ids.length).toBe(6);
    const queue = readSupportPlanQueue();
    expect(queue.length).toBe(1);
    const ids = getSupportPlanQueueIds();
    expect(ids.length).toBe(6);
    expect(ids).toEqual(expect.arrayContaining(['collagen', 'omega3']));
  });

  it('дедуплицирует по recId и кап 10', () => {
    for (let i = 0; i < 12; i++) {
      const rec = analyzeMixUsage({ ...jointInput(), title: `Микс ${i}`, substances: i % 2 === 0 ? JOINT_SUBS : [{ id: 'creatine', name: 'Креатин', dose: '5', unit: 'г', mg: 5000 }] });
      queueMixToSupportPlan(rec);
    }
    expect(readSupportPlanQueue().length).toBe(10);
  });

  it('не добавляет в очередь набор без найденных веществ', () => {
    const rec = analyzeMixUsage({ ...jointInput(), substances: [{ id: 'zzz', name: 'x', dose: '1', unit: 'мг', mg: 1 }] });
    queueMixToSupportPlan(rec);
    expect(readSupportPlanQueue().length).toBe(0);
  });

  it('удаляет запись из очереди', () => {
    const rec = analyzeMixUsage(jointInput());
    queueMixToSupportPlan(rec);
    removeFromSupportPlanQueue(rec.id);
    expect(readSupportPlanQueue().length).toBe(0);
    expect(getSupportPlanQueueIds().length).toBe(0);
  });
});

describe('saveMixToDiaryAndFavorites (комплексный флоу)', () => {
  it('сохраняет всё: дневник + избранное + рекомендация', () => {
    const res = saveMixToDiaryAndFavorites(jointInput());
    // дневник
    expect(readDiaryMixes().length).toBe(1);
    expect(readDiaryMixes()[0].recommendations).not.toBeNull();
    expect(readDiaryMixes()[0].recommendations!.id).toBe(res.rec.id);
    // избранное
    const favs = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    expect(favs.length).toBe(res.addedFavCount);
    expect(favs.length).toBe(6);
    // рекомендации
    expect(readFavRecommendations().length).toBe(1);
    expect(readFavRecommendations()[0].id).toBe(res.rec.id);
  });

  it('повторное сохранение того же набора не дублирует избранное', () => {
    saveMixToDiaryAndFavorites(jointInput());
    const res2 = saveMixToDiaryAndFavorites(jointInput());
    expect(res2.addedFavCount).toBe(0);
    expect(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]').length).toBe(6);
    expect(readDiaryMixes().length).toBe(2);
  });

  it('не ломает совместимость с legacy-записями he_training_mixes', () => {
    localStorage.setItem(MIX_DIARY_KEY, JSON.stringify([{ goal: 'pump', timing: 'pre', score: 50, label: 'Хорошо', date: '06.08.2026' }]));
    saveMixToDiaryAndFavorites(jointInput());
    const arr = readDiaryMixes();
    expect(arr.length).toBe(2);
    // legacy-запись сохраняется как есть
    expect((arr[1] as any).goal).toBe('pump');
    expect(arr[0].substances.length).toBe(6);
  });

  it('полный флоу с согласием: дневник+избранное+рекомендации+очередь плана', () => {
    const res = saveMixToDiaryAndFavorites(jointInput());
    queueMixToSupportPlan(res.rec);
    expect(readSupportPlanQueue().length).toBe(1);
    expect(getSupportPlanQueueIds().length).toBe(6);
    expect(localStorage.getItem(PLAN_QUEUE_KEY)).toBeTruthy();
    expect(localStorage.getItem(FAV_REC_KEY)).toBeTruthy();
    expect(localStorage.getItem(MIX_DIARY_KEY)).toBeTruthy();
    expect(localStorage.getItem(FAVORITES_KEY)).toBeTruthy();
  });

  it('эмитит событие изменения очереди (для зеркала в he_general_plan)', () => {
    let calls = 0;
    const unsub = subscribePlanQueueChanged(() => calls++);
    const rec = analyzeMixUsage(jointInput());
    queueMixToSupportPlan(rec);
    expect(calls).toBe(1);
    removeFromSupportPlanQueue(rec.id);
    expect(calls).toBe(2);
    unsub();
    queueMixToSupportPlan(rec);
    expect(calls).toBe(2);
  });
});

describe('analyzePresetEffect (эффект пресета через неделю)', () => {
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  it('сон: среднее до и после пресета (goal=sleep)', () => {
    localStorage.setItem('he_sleep_diary', JSON.stringify([
      { date: daysAgo(10), hours: 6.5 },
      { date: daysAgo(9), hours: 6.8 },
      { date: daysAgo(8), hours: 7.0 },
      { date: daysAgo(1), hours: 7.4 },
      { date: daysAgo(0), hours: 7.6 },
    ]));
    const record = saveMixToDiary({ ...jointInput(), goal: 'sleep', kind: 'preset' }, daysAgo(3));
    const eff = analyzePresetEffect(record);
    expect(eff).not.toBeNull();
    expect(eff!.type).toBe('sleep');
    expect(eff!.before).toBeGreaterThan(0);
    expect(eff!.delta).toBeGreaterThan(0);
    expect(eff!.samplesBefore).toBeGreaterThanOrEqual(3);
  });

  it('вес: только для goal=fat_loss', () => {
    localStorage.setItem('he_weight_log', JSON.stringify([
      { date: daysAgo(10), weight: 82 },
      { date: daysAgo(9), weight: 81.5 },
      { date: daysAgo(8), weight: 81.2 },
    ]));
    const record = saveMixToDiary({ ...jointInput(), goal: 'fat_loss', kind: 'preset' }, daysAgo(3));
    const eff = analyzePresetEffect(record);
    expect(eff).not.toBeNull();
    expect(eff!.type).toBe('weight');
  });

  it('возвращает null, если данных до пресета меньше 3', () => {
    localStorage.setItem('he_sleep_diary', JSON.stringify([{ date: daysAgo(1), hours: 7.0 }]));
    const record = saveMixToDiary({ ...jointInput(), goal: 'sleep', kind: 'preset' }, daysAgo(3));
    expect(analyzePresetEffect(record)).toBeNull();
  });

  it('возвращает null для тренировочного микса (не пресет)', () => {
    const record = saveMixToDiary({ ...jointInput(), kind: 'mix', goal: 'pump' });
    expect(analyzePresetEffect(record)).toBeNull();
  });

  it('устойчив к битым дневникам', () => {
    localStorage.setItem('he_sleep_diary', '{{{{');
    const record = saveMixToDiary({ ...jointInput(), goal: 'sleep', kind: 'preset' }, daysAgo(3));
    expect(analyzePresetEffect(record)).toBeNull();
  });
});

describe('getMixIntake / toggleMixPhaseIntake (единый слой фаз приёма)', () => {
  it('возвращает пустой объект без записей', () => {
    expect(getMixIntake('2026-08-13')).toEqual({});
  });

  it('включает и выключает фазу приёма на дату', () => {
    const after1 = toggleMixPhaseIntake('2026-08-13', 'mix_1', 'pre');
    expect(after1.mix_1.pre).toBe(true);
    expect(getMixIntake('2026-08-13').mix_1.pre).toBe(true);
    const after2 = toggleMixPhaseIntake('2026-08-13', 'mix_1', 'post');
    expect(after2.mix_1.post).toBe(true);
    expect(after2.mix_1.pre).toBe(true);
    const after3 = toggleMixPhaseIntake('2026-08-13', 'mix_1', 'pre');
    expect(after3.mix_1.pre).toBe(false);
  });

  it('не пересекается по датам', () => {
    toggleMixPhaseIntake('2026-08-13', 'mix_1', 'pre');
    toggleMixPhaseIntake('2026-08-14', 'mix_1', 'post');
    expect(getMixIntake('2026-08-13').mix_1.post).toBeUndefined();
    expect(getMixIntake('2026-08-14').mix_1.pre).toBeUndefined();
  });

  it('устойчив к битому дневнику поддержки', () => {
    localStorage.setItem('he_support_diary', '{{{');
    expect(getMixIntake('2026-08-13')).toEqual({});
    toggleMixPhaseIntake('2026-08-13', 'mix_1', 'pre');
    expect(getMixIntake('2026-08-13').mix_1.pre).toBe(true);
  });
});

describe('analyzeMixEffectiveness (микс → качество сессии)', () => {
  const seedIntake = (dates: string[]) => {
    for (const d of dates) toggleMixPhaseIntake(d, 'mix_1', 'pre');
  };

  it('сравнивает RPE/объём/длительность в дни с миксом и без', () => {
    seedIntake(['2026-08-10', '2026-08-11']);
    const result = analyzeMixEffectiveness([
      { date: '2026-08-10', overallRPE: 8, duration: 70, totalVolume: 12000 }, // с миксом
      { date: '2026-08-11', overallRPE: 9, duration: 80, totalVolume: 14000 }, // с миксом
      { date: '2026-08-12', overallRPE: 7, duration: 60, totalVolume: 10000 }, // без
      { date: '2026-08-13', overallRPE: 6, duration: 55, totalVolume: 9000 },  // без
    ]);
    expect(result).not.toBeNull();
    expect(result!.withMix.sessions).toBe(2);
    expect(result!.withoutMix.sessions).toBe(2);
    expect(result!.withMix.avgRpe).toBe(8.5);
    expect(result!.withoutMix.avgRpe).toBe(6.5);
    expect(result!.rpeDelta).toBe(2);
    expect(result!.volumeDelta).toBeGreaterThan(0);
  });

  it('возвращает null без тренировок', () => {
    expect(analyzeMixEffectiveness([])).toBeNull();
    expect(analyzeMixEffectiveness(null as unknown as { date: string }[])).toBeNull();
  });

  it('возвращает null, если миксы не принимались ни в один день', () => {
    const result = analyzeMixEffectiveness([
      { date: '2026-08-12', overallRPE: 7, totalVolume: 10000 },
      { date: '2026-08-13', overallRPE: 6, totalVolume: 9000 },
    ]);
    expect(result).toBeNull();
  });

  it('возвращает null, если миксы принимались во все дни', () => {
    seedIntake(['2026-08-12', '2026-08-13']);
    const result = analyzeMixEffectiveness([
      { date: '2026-08-12', overallRPE: 7, totalVolume: 10000 },
      { date: '2026-08-13', overallRPE: 6, totalVolume: 9000 },
    ]);
    expect(result).toBeNull();
  });

  it('считает объём из exercises, если totalVolume не задан', () => {
    seedIntake(['2026-08-10']);
    const result = analyzeMixEffectiveness([
      { date: '2026-08-10', overallRPE: 8, exercises: [{ totalVolume: 5000 }, { totalVolume: 3000 }] },
      { date: '2026-08-12', overallRPE: 7, exercises: [{ totalVolume: 4000 }] },
    ]);
    expect(result).not.toBeNull();
    expect(result!.withMix.avgVolume).toBe(8000);
    expect(result!.withoutMix.avgVolume).toBe(4000);
  });
});

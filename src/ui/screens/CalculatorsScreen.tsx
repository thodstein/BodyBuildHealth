import React, { useState, useEffect } from 'react';
import { calculateDose } from '../../engines/dosage.engine';
import { SYRINGE_SPECS, DRUG_THRESHOLDS } from '../../core/constants';
import { calcNutrition } from '../../engines/nutrition.engine';
import { calculateSupport, generateSupportStack } from '../../engines/support.engine';
import { PHARMA_DB, SUBSTANCES_BY_CLASS } from '../../core/pharma-database';
import { getProfile } from '../../core/profile-manager';
import { db } from '../../core/db';
import type { DoseRequest, NutritionInput, CourseEntry } from '../../core/types';

const PAL_OPTIONS = [
  { value: 1.2, label: 'Минимальная (сидячий образ жизни)' },
  { value: 1.375, label: 'Лёгкая (1-3 дня/неделя)' },
  { value: 1.55, label: 'Умеренная (3-5 дней/неделя)' },
  { value: 1.725, label: 'Высокая (6-7 дней/неделя)' },
  { value: 1.9, label: 'Экстремальная (2 раза/день)' },
];

const DRUG_OPTIONS = Object.keys(DRUG_THRESHOLDS);

interface CalcProps {
  initialTab?: 'fitness' | 'nutrition' | 'health' | 'support';
}

export const CalculatorsScreen: React.FC<CalcProps> = ({ initialTab = 'fitness' }) => {
  const [activeTab, setActiveTab] = useState<'fitness' | 'nutrition' | 'health' | 'support'>(initialTab);

  const [bmiWeight, setBmiWeight] = useState(70);
  const [bmiHeight, setBmiHeight] = useState(175);
  const [bmiResult, setBmiResult] = useState<number | null>(null);

  const [bmrWeight, setBmrWeight] = useState(70);
  const [bmrHeight, setBmrHeight] = useState(175);
  const [bmrAge, setBmrAge] = useState(25);
  const [bmrSex, setBmrSex] = useState<'male' | 'female'>('male');
  const [bmrResult, setBmrResult] = useState<number | null>(null);

  const [bmrKmWeight, setBmrKmWeight] = useState(70);
  const [bmrKmBodyFat, setBmrKmBodyFat] = useState(15);
  const [bmrKmResult, setBmrKmResult] = useState<number | null>(null);

  const [tdeeBmr, setTdeeBmr] = useState(1700);
  const [tdeePal, setTdeePal] = useState(1.55);
  const [tdeeResult, setTdeeResult] = useState<number | null>(null);

  const [doseTarget, setDoseTarget] = useState(200);
  const [doseConcentration, setDoseConcentration] = useState(250);
  const [doseSyringe, setDoseSyringe] = useState<number>(1.0);
  const [doseResult, setDoseResult] = useState<{ volumeMl: number; divisions: number; dosesPerVial: number; flags: string[] } | null>(null);

  const [aiEntries, setAiEntries] = useState<{ drug: string; doseMgWeek: number }[]>([{ drug: 'testosterone_enanthate', doseMgWeek: 300 }]);
  const [aiResult, setAiResult] = useState<number | null>(null);

  const [deficitTdee, setDeficitTdee] = useState(2500);
  const [deficitTarget, setDeficitTarget] = useState(2000);
  const [deficitResult, setDeficitResult] = useState<{ deficit: number; rateKgWeek: number } | null>(null);

  const [macroWeight, setMacroWeight] = useState(70);
  const [macroHeight, setMacroHeight] = useState(175);
  const [macroAge, setMacroAge] = useState(25);
  const [macroSex, setMacroSex] = useState<'male' | 'female'>('male');
  const [macroPal, setMacroPal] = useState(1.55);
  const [macroGoal, setMacroGoal] = useState('maintenance');
  const [macroResult, setMacroResult] = useState<{ kcal: number; protein: number; fats: number; carbs: number; water: number; fiber: number } | null>(null);

  const [homaGlucose, setHomaGlucose] = useState(5.0);
  const [homaInsulin, setHomaInsulin] = useState(10);
  const [homaResult, setHomaResult] = useState<{ index: number; resistant: boolean } | null>(null);

  const [caTotal, setCaTotal] = useState(2.2);
  const [caAlbumin, setCaAlbumin] = useState(35);
  const [caResult, setCaResult] = useState<number | null>(null);

  const [aiTotalChol, setAiTotalChol] = useState(5.0);
  const [aiHdl, setAiHdl] = useState(1.2);
  const [aiResult2, setAiResult2] = useState<{ index: number; highRisk: boolean } | null>(null);

  const [gripKg, setGripKg] = useState(45);
  const [gripSex, setGripSex] = useState<'male' | 'female'>('male');
  const [gripAge, setGripAge] = useState(30);
  const [gripResult, setGripResult] = useState<{ percentile: number; level: string } | null>(null);

  const [hrvValue, setHrvValue] = useState(50);
  const [stressResult, setStressResult] = useState<{ stress: number; level: string } | null>(null);

  const [supportDrugs, setSupportDrugs] = useState<string[]>([]);
  const [supportGoal, setSupportGoal] = useState('muscle_gain');
  const [supportResult, setSupportResult] = useState<ReturnType<typeof calculateSupport> | null>(null);

  useEffect(() => {
    const s = getProfile().settings;
    if (!s) return;
    const w = s.weight || 70;
    const h = s.height || 175;
    const a = s.age || 25;
    const sex = s.sex || 'male';
    const goal = s.goal || s.primaryGoal || 'maintenance';
    setBmiWeight(w); setBmiHeight(h);
    setBmrWeight(w); setBmrHeight(h); setBmrAge(a); setBmrSex(sex);
    setBmrKmWeight(w); if (s.bodyFat) setBmrKmBodyFat(s.bodyFat);
    setMacroWeight(w); setMacroHeight(h); setMacroAge(a); setMacroSex(sex); setMacroGoal(goal);
    setGripSex(sex); setGripAge(a);
    const goalMap: Record<string, string> = { bulk: 'muscle_gain', cut: 'fat_loss', strength: 'strength', endurance: 'endurance', recomp: 'recomp', maintenance: 'maintenance' };
    if (goalMap[goal]) setSupportGoal(goalMap[goal]);
    db.init().then(() => db.getAll<CourseEntry>('course_log')).then(entries => {
      if (entries.length > 0) setSupportDrugs(entries.map(e => e.substanceId));
    }).catch(() => {});
  }, []);

  const calcSupport = () => {
    const result = calculateSupport({
      substances: supportDrugs,
      goals: [supportGoal],
      drugDoses: Object.fromEntries(supportDrugs.map(id => [id, PHARMA_DB[id] ? 1 : 1]))
    });
    setSupportResult(result);
  };

  const calcBMI = () => {
    const hm = bmiHeight / 100;
    setBmiResult(bmiWeight / (hm * hm));
  };

  const calcBMR = () => {
    if (bmrSex === 'male') setBmrResult(10 * bmrWeight + 6.25 * bmrHeight - 5 * bmrAge + 5);
    else setBmrResult(10 * bmrWeight + 6.25 * bmrHeight - 5 * bmrAge - 161);
  };

  const calcBMR_KM = () => {
    const lbm = bmrKmWeight * (100 - bmrKmBodyFat) / 100;
    setBmrKmResult(370 + 21.6 * lbm);
  };

  const calcTDEE = () => setTdeeResult(tdeeBmr * tdeePal);

  const calcDose = () => {
    const req: DoseRequest = {
      targetDoseMg: doseTarget,
      concentrationMgPerMl: doseConcentration,
      syringeVolumeMl: doseSyringe,
    };
    setDoseResult(calculateDose(req));
  };

  const calcAI = () => {
    let total = 0;
    aiEntries.forEach(e => {
      const dt = DRUG_THRESHOLDS[e.drug];
      if (dt) total += e.doseMgWeek * dt.androgenicity / 100;
    });
    setAiResult(total);
  };

  const calcDeficit = () => {
    const deficit = deficitTdee - deficitTarget;
    setDeficitResult({ deficit, rateKgWeek: deficit / 7700 });
  };

  const calcMacros = () => {
    const input: NutritionInput = {
      weightKg: macroWeight,
      heightCm: macroHeight,
      age: macroAge,
      sex: macroSex,
      pal: macroPal,
      goal: macroGoal,
    };
    const t = calcNutrition(input);
    setMacroResult({ kcal: t.kcal, protein: t.protein, fats: t.fats, carbs: t.carbs, water: t.water, fiber: t.fiber });
  };

  const calcHOMA = () => {
    const index = (homaGlucose * homaInsulin) / 22.5;
    setHomaResult({ index, resistant: index > 2.5 });
  };

  const calcCa = () => {
    setCaResult(caTotal + 0.8 * (4.0 - caAlbumin));
  };

  const calcAtherogenic = () => {
    const index = (aiTotalChol - aiHdl) / aiHdl;
    setAiResult2({ index, highRisk: index > 3 });
  };

  const calcGrip = () => {
    let ref: number;
    if (gripSex === 'male') {
      ref = 50 - (gripAge - 30) * 0.3;
    } else {
      ref = 30 - (gripAge - 30) * 0.2;
    }
    const pct = Math.min(100, Math.max(0, (gripKg / ref) * 100));
    let level = 'Низкий';
    if (pct >= 80) level = 'Отличный';
    else if (pct >= 60) level = 'Средний';
    else if (pct >= 40) level = 'Ниже среднего';
    setGripResult({ percentile: Math.round(pct), level });
  };

  const calcStress = () => {
    const stress = Math.max(0, Math.min(100, 100 - (hrvValue - 20) * 2));
    let level = 'Низкий';
    if (stress >= 70) level = 'Высокий';
    else if (stress >= 30) level = 'Умеренный';
    setStressResult({ stress: Math.round(stress), level });
  };

  const addAiEntry = () => setAiEntries([...aiEntries, { drug: 'testosterone_enenthate', doseMgWeek: 300 }]);
  const removeAiEntry = (i: number) => setAiEntries(aiEntries.filter((_, idx) => idx !== i));
  const updateAiEntry = (i: number, field: 'drug' | 'doseMgWeek', val: string | number) => {
    const next = [...aiEntries];
    if (field === 'drug') next[i] = { ...next[i], drug: val as string };
    else next[i] = { ...next[i], doseMgWeek: val as number };
    setAiEntries(next);
  };

  const bmiCategory = (v: number) => v < 18.5 ? 'Недостаточный вес' : v < 25 ? 'Норма' : v < 30 ? 'Избыточный вес' : 'Ожирение';

  return (
    <div className="screen calculators">
      <div className="calculators-header">
        <h2>Калькуляторы и формулы</h2>
        <p>Инструменты для расчёта показателей здоровья и производительности</p>
      </div>

      <div className="calc-tabs">
        <button className={'calc-tab-btn' + (activeTab === 'fitness' ? ' active' : '')} onClick={() => setActiveTab('fitness')}>Фитнес</button>
        <button className={'calc-tab-btn' + (activeTab === 'nutrition' ? ' active' : '')} onClick={() => setActiveTab('nutrition')}>Питание</button>
        <button className={'calc-tab-btn' + (activeTab === 'health' ? ' active' : '')} onClick={() => setActiveTab('health')}>Здоровье</button>
        <button className={'calc-tab-btn' + (activeTab === 'support' ? ' active' : '')} onClick={() => setActiveTab('support')}>Поддержка</button>
      </div>

      {activeTab === 'fitness' && (
        <div className="calculator-panel">
          <h3>Фитнес калькуляторы</h3>
          <div className="calculator-group">

            <div className="calculator-item">
              <h4>Индекс массы тела (BMI)</h4>
              <p className="description">Вес / Рост² — оценка массы тела</p>
              <div className="input-group">
                <label>Вес (кг): <input type="number" value={bmiWeight} onChange={e => setBmiWeight(Number(e.target.value))} /></label>
                <label>Рост (см): <input type="number" value={bmiHeight} onChange={e => setBmiHeight(Number(e.target.value))} /></label>
                <button onClick={calcBMI}>Рассчитать</button>
              </div>
              {bmiResult !== null && (
                <div className="result">
                  <span className="label">BMI:</span> <span className="value">{bmiResult.toFixed(1)}</span>
                  <span className="interpretation"> — {bmiCategory(bmiResult)}</span>
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>BMR (Миффлин-Сан Жеор)</h4>
              <p className="description">Базовый метаболизм: 10×вес + 6.25×рост − 5×возраст ± 161</p>
              <div className="input-group">
                <label>Вес (кг): <input type="number" value={bmrWeight} onChange={e => setBmrWeight(Number(e.target.value))} /></label>
                <label>Рост (см): <input type="number" value={bmrHeight} onChange={e => setBmrHeight(Number(e.target.value))} /></label>
                <label>Возраст: <input type="number" value={bmrAge} onChange={e => setBmrAge(Number(e.target.value))} /></label>
                <label>Пол:
                  <select value={bmrSex} onChange={e => setBmrSex(e.target.value as 'male' | 'female')}>
                    <option value="male">Мужской</option>
                    <option value="female">Женский</option>
                  </select>
                </label>
                <button onClick={calcBMR}>Рассчитать</button>
              </div>
              {bmrResult !== null && (
                <div className="result">
                  <span className="label">BMR:</span> <span className="value">{bmrResult.toFixed(0)} ккал/день</span>
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>BMR (Кэтч-Мкардл)</h4>
              <p className="description">370 + 21.6 × LBM — для людей с известным % жира</p>
              <div className="input-group">
                <label>Вес (кг): <input type="number" value={bmrKmWeight} onChange={e => setBmrKmWeight(Number(e.target.value))} /></label>
                <label>Толщина жира (%): <input type="number" step="0.1" value={bmrKmBodyFat} onChange={e => setBmrKmBodyFat(Number(e.target.value))} /></label>
                <button onClick={calcBMR_KM}>Рассчитать</button>
              </div>
              {bmrKmResult !== null && (
                <div className="result">
                  <span className="label">BMR (Katch-McArdle):</span> <span className="value">{bmrKmResult.toFixed(0)} ккал/день</span>
                  <span className="interpretation"> — LBM: {(bmrKmWeight * (100 - bmrKmBodyFat) / 100).toFixed(1)} кг</span>
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>TDEE</h4>
              <p className="description">BMR × PAL — общий дневной расход энергии</p>
              <div className="input-group">
                <label>BMR (ккал): <input type="number" value={tdeeBmr} onChange={e => setTdeeBmr(Number(e.target.value))} /></label>
                <label>Уровень активности:
                  <select value={tdeePal} onChange={e => setTdeePal(Number(e.target.value))}>
                    {PAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <button onClick={calcTDEE}>Рассчитать</button>
              </div>
              {tdeeResult !== null && (
                <div className="result">
                  <span className="label">TDEE:</span> <span className="value">{tdeeResult.toFixed(0)} ккал/день</span>
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>Дозировка препарата</h4>
              <p className="description">Расчёт объёма инъекции по дозе и концентрации</p>
              <div className="input-group">
                <label>Целевая доза (мг): <input type="number" value={doseTarget} onChange={e => setDoseTarget(Number(e.target.value))} /></label>
                <label>Концентрация (мг/мл): <input type="number" value={doseConcentration} onChange={e => setDoseConcentration(Number(e.target.value))} /></label>
                <label>Шприц (мл):
                  <select value={doseSyringe} onChange={e => setDoseSyringe(Number(e.target.value))}>
                    {Object.keys(SYRINGE_SPECS).map(k => <option key={k} value={k}>{k} мл</option>)}
                  </select>
                </label>
                <button onClick={calcDose}>Рассчитать</button>
              </div>
              {doseResult !== null && (
                <div className="result">
                  <div><span className="label">Объём:</span> <span className="value">{doseResult.volumeMl} мл</span></div>
                  <div><span className="label">Деления:</span> <span className="value">{doseResult.divisions}</span></div>
                  <div><span className="label">Доз во флаконе:</span> <span className="value">{doseResult.dosesPerVial}</span></div>
                  {doseResult.flags.length > 0 && <div className="interpretation">⚠ {doseResult.flags.join(', ')}</div>}
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>Андрогенный индекс стека</h4>
              <p className="description">Σ (доза × AR_affinity / 100) — суммарная андрогенная нагрузка</p>
              <div className="input-group">
                {aiEntries.map((entry, i) => (
                  <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <select value={entry.drug} onChange={e => updateAiEntry(i, 'drug', e.target.value)}>
                      {DRUG_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input type="number" value={entry.doseMgWeek} onChange={e => updateAiEntry(i, 'doseMgWeek', Number(e.target.value))} placeholder="мг/нед" style={{ width: 80 }} />
                    <span>мг/нед</span>
                    {aiEntries.length > 1 && <button onClick={() => removeAiEntry(i)}>✕</button>}
                  </div>
                ))}
                <button onClick={addAiEntry}>+ Добавить препарат</button>
                <button onClick={calcAI}>Рассчитать</button>
              </div>
              {aiResult !== null && (
                <div className="result">
                  <span className="label">Андрогенный индекс:</span> <span className="value">{aiResult.toFixed(2)}</span>
                  <span className="interpretation"> — {aiResult > 3 ? 'Высокая нагрузка' : aiResult > 1.5 ? 'Умеренная нагрузка' : 'Низкая нагрузка'}</span>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {activeTab === 'nutrition' && (
        <div className="calculator-panel">
          <h3>Питание</h3>
          <div className="calculator-group">

            <div className="calculator-item">
              <h4>Калорийный дефицит</h4>
              <p className="description">TDEE − целевые ккал → скорость потери веса</p>
              <div className="input-group">
                <label>TDEE (ккал/день): <input type="number" value={deficitTdee} onChange={e => setDeficitTdee(Number(e.target.value))} /></label>
                <label>Целевые ккал/день: <input type="number" value={deficitTarget} onChange={e => setDeficitTarget(Number(e.target.value))} /></label>
                <button onClick={calcDeficit}>Рассчитать</button>
              </div>
              {deficitResult !== null && (
                <div className="result">
                  <div><span className="label">Дефицит:</span> <span className="value">{deficitResult.deficit} ккал/день</span></div>
                  <div><span className="label">Потеря веса:</span> <span className="value">{deficitResult.rateKgWeek.toFixed(2)} кг/нед</span></div>
                  <span className="interpretation">
                    {deficitResult.deficit <= 0 ? 'Профицит или поддержка' :
                     deficitResult.deficit < 500 ? 'Мягкий дефицит' :
                     deficitResult.deficit < 1000 ? 'Умеренный дефицит' : 'Агрессивный дефицит'}
                  </span>
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>Макросы (расчёт БЖУ)</h4>
              <p className="description">Полный расчёт БЖУ и микроэлементов по двигу nutrition</p>
              <div className="input-group">
                <label>Вес (кг): <input type="number" value={macroWeight} onChange={e => setMacroWeight(Number(e.target.value))} /></label>
                <label>Рост (см): <input type="number" value={macroHeight} onChange={e => setMacroHeight(Number(e.target.value))} /></label>
                <label>Возраст: <input type="number" value={macroAge} onChange={e => setMacroAge(Number(e.target.value))} /></label>
                <label>Пол:
                  <select value={macroSex} onChange={e => setMacroSex(e.target.value as 'male' | 'female')}>
                    <option value="male">Мужской</option>
                    <option value="female">Женский</option>
                  </select>
                </label>
                <label>PAL:
                  <select value={macroPal} onChange={e => setMacroPal(Number(e.target.value))}>
                    {PAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <label>Цель:
                  <select value={macroGoal} onChange={e => setMacroGoal(e.target.value)}>
                    <option value="bulk">Набор массы</option>
                    <option value="cut">Снижение веса</option>
                    <option value="maintenance">Поддержание</option>
                    <option value="recomp">Рекомпозиция</option>
                    <option value="rehab">Реабилитация</option>
                  </select>
                </label>
                <button onClick={calcMacros}>Рассчитать</button>
              </div>
              {macroResult !== null && (
                <div className="result">
                  <div><span className="label">Ккал:</span> <span className="value">{macroResult.kcal}</span></div>
                  <div><span className="label">Белки:</span> <span className="value">{macroResult.protein} г</span></div>
                  <div><span className="label">Жиры:</span> <span className="value">{macroResult.fats} г</span></div>
                  <div><span className="label">Углеводы:</span> <span className="value">{macroResult.carbs} г</span></div>
                  <div><span className="label">Вода:</span> <span className="value">{macroResult.water} л</span></div>
                  <div><span className="label">Клетчатка:</span> <span className="value">{macroResult.fiber} г</span></div>
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>HOMA-IR</h4>
              <p className="description">(Глюкоза × Инсулин) / 22.5 — индекс инсулинорезистентности</p>
              <div className="input-group">
                <label>Глюкоза (ммоль/л): <input type="number" step="0.1" value={homaGlucose} onChange={e => setHomaGlucose(Number(e.target.value))} /></label>
                <label>Инсулин (μЕ/мл): <input type="number" step="0.1" value={homaInsulin} onChange={e => setHomaInsulin(Number(e.target.value))} /></label>
                <button onClick={calcHOMA}>Рассчитать</button>
              </div>
              {homaResult !== null && (
                <div className="result">
                  <span className="label">HOMA-IR:</span> <span className="value">{homaResult.index.toFixed(2)}</span>
                  <span className="interpretation"> — {homaResult.resistant ? '⚡ Инсулинорезистентность (>2.5)' : '✅ Норма'}</span>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {activeTab === 'health' && (
        <div className="calculator-panel">
          <h3>Здоровье</h3>
          <div className="calculator-group">

            <div className="calculator-item">
              <h4>Кальций скорректированный</h4>
              <p className="description">Ca_общ + 0.8 × (4.0 − альбумин) — коррекция на белок</p>
              <div className="input-group">
                <label>Общий Ca (ммоль/л): <input type="number" step="0.01" value={caTotal} onChange={e => setCaTotal(Number(e.target.value))} /></label>
                <label>Альбумин (г/дл): <input type="number" step="0.1" value={caAlbumin} onChange={e => setCaAlbumin(Number(e.target.value))} /></label>
                <button onClick={calcCa}>Рассчитать</button>
              </div>
              {caResult !== null && (
                <div className="result">
                  <span className="label">Скорректированный Ca:</span> <span className="value">{caResult.toFixed(2)} ммоль/л</span>
                  <span className="interpretation"> — {caResult < 2.1 ? 'Гипокальциемия' : caResult > 2.6 ? 'Гиперкальциемия' : 'Норма'}</span>
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>Атерогенный индекс</h4>
              <p className="description">(Общий холестерин − HDL) / HDL — риск атеросклероза</p>
              <div className="input-group">
                <label>Общий холестерин (ммоль/л): <input type="number" step="0.01" value={aiTotalChol} onChange={e => setAiTotalChol(Number(e.target.value))} /></label>
                <label>HDL (ммоль/л): <input type="number" step="0.01" value={aiHdl} onChange={e => setAiHdl(Number(e.target.value))} /></label>
                <button onClick={calcAtherogenic}>Рассчитать</button>
              </div>
              {aiResult2 !== null && (
                <div className="result">
                  <span className="label">Атерогенный индекс:</span> <span className="value">{aiResult2.index.toFixed(2)}</span>
                  <span className="interpretation"> — {aiResult2.highRisk ? '⚠ Высокий риск (>3)' : '✅ Допустимый'}</span>
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>Сила хвата</h4>
              <p className="description">Оценка общей силы по кистевой динамометрии</p>
              <div className="input-group">
                <label>Сила хвата (кг): <input type="number" value={gripKg} onChange={e => setGripKg(Number(e.target.value))} /></label>
                <label>Пол:
                  <select value={gripSex} onChange={e => setGripSex(e.target.value as 'male' | 'female')}>
                    <option value="male">Мужской</option>
                    <option value="female">Женский</option>
                  </select>
                </label>
                <label>Возраст: <input type="number" value={gripAge} onChange={e => setGripAge(Number(e.target.value))} /></label>
                <button onClick={calcGrip}>Оценить</button>
              </div>
              {gripResult !== null && (
                <div className="result">
                  <span className="label">Процентиль:</span> <span className="value">{gripResult.percentile}%</span>
                  <span className="interpretation"> — {gripResult.level}</span>
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>Стресс (HRV)</h4>
              <p className="description">Оценка стресса по вариабельности сердечного ритма</p>
              <div className="input-group">
                <label>RMSSD / HRV (мс): <input type="number" value={hrvValue} onChange={e => setHrvValue(Number(e.target.value))} /></label>
                <button onClick={calcStress}>Оценить</button>
              </div>
              {stressResult !== null && (
                <div className="result">
                  <span className="label">Уровень стресса:</span> <span className="value">{stressResult.stress}%</span>
                  <span className="interpretation"> — {stressResult.level}</span>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {activeTab === 'support' && (
        <div className="calculator-panel">
          <h3>Калькулятор поддержки органов</h3>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>Рассчитайте уровень защиты органов при текущем курсе и получите рекомендации по поддержке</p>

          <div className="calculator-item">
            <h4>Цель</h4>
            <select className="input" value={supportGoal} onChange={e => setSupportGoal(e.target.value)} style={{ marginBottom: 8 }}>
              <option value="muscle_gain">Набор мышечной массы</option>
              <option value="fat_loss">Сжигание жира</option>
              <option value="strength">Сила</option>
              <option value="endurance">Выносливость</option>
              <option value="recomp">Рекомпозиция</option>
              <option value="maintenance">Поддержание</option>
              <option value="pct">ПКТ / восстановление</option>
            </select>

            <h4>Препараты на курсе</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 200, overflowY: 'auto', marginBottom: 8 }}>
              {Object.entries(SUBSTANCES_BY_CLASS).map(([cls, subs]) => subs.map(s => (
                <button key={s.id} style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 6, border: `1px solid ${supportDrugs.includes(s.id) ? 'var(--accent)' : 'var(--border)'}`,
                  background: supportDrugs.includes(s.id) ? 'var(--accent-dim)' : 'var(--bg-secondary)', color: supportDrugs.includes(s.id) ? 'var(--accent)' : 'var(--text-dim)', cursor: 'pointer'
                }} onClick={() => setSupportDrugs(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])}>
                  {s.name}
                </button>
              )))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>Выбрано: {supportDrugs.length}</p>

            <button className="btn" onClick={calcSupport} disabled={supportDrugs.length === 0}>Рассчитать поддержку</button>
          </div>

          {supportResult && (
            <div className="calculator-item" style={{ marginTop: 12 }}>
              <h4>Результаты расчёта поддержки</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Базовый риск</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--danger)' }}>{supportResult.riskBeforeSupport.toFixed(1)}%</div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Риск с поддержкой</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--success)' }}>{supportResult.riskAfterSupport.toFixed(1)}%</div>
                </div>
              </div>

              <h4 style={{ marginBottom: 8 }}>Защита по системам органов:</h4>
              <div style={{ display: 'grid', gap: 6 }}>
                {Object.entries(supportResult.organSupport).map(([organ, score]) => {
                  const pct = Math.min(100, Math.max(0, score * 100));
                  const color = pct < 30 ? 'var(--danger)' : pct < 60 ? 'var(--warning)' : 'var(--success)';
                  const labels: Record<string, string> = {
                    cardio: 'Сердечно-сосудистая', hepatic: 'Печень', renal: 'Почки',
                    neuro: 'Нервная система', endocrine: 'Эндокринная',
                    hematologic: 'Кроветворение', reproductive: 'Репродуктивная'
                  };
                  return (
                    <div key={organ}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span>{labels[organ] ?? organ}</span>
                        <span style={{ color, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                      </div>
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 3, height: 6 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {supportResult.recommendations.length > 0 && (
                <>
                  <h4 style={{ margin: '12px 0 8px' }}>Рекомендации по поддержке:</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {supportResult.recommendations.map((r, i) => (
                      <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 10, fontSize: 12 }}>
                        <div style={{ fontWeight: 600 }}>{r.title}</div>
                        <div style={{ color: 'var(--text-dim)' }}>{r.text}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
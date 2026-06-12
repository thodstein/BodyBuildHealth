import React, { useState, useEffect } from 'react';
import { calculateDose } from '../../engines/dosage.engine';
import { SYRINGE_SPECS, DRUG_THRESHOLDS } from '../../core/constants';
import { calcNutrition } from '../../engines/nutrition.engine';
import { useDataLink } from '../../core/data-link';
import type { DoseRequest, NutritionInput } from '../../core/types';

const PAL_OPTIONS = [
  { value: 1.2, label: '' },
  { value: 1.375, label: '' },
  { value: 1.55, label: '' },
  { value: 1.725, label: '' },
  { value: 1.9, label: '' },
];

const DRUG_OPTIONS = Object.keys(DRUG_THRESHOLDS);

interface CalcProps {
  initialTab?: 'fitness' | 'nutrition' | 'health';
}

export const CalculatorsScreen: React.FC<CalcProps> = ({ initialTab = 'fitness' }) => {
  const linked = useDataLink();
  const [activeTab, setActiveTab] = useState<'fitness' | 'nutrition' | 'health'>(initialTab);

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

  useEffect(() => {
    const s = linked.profile?.settings;
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
  }, []);
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
    let level = '';
    if (pct >= 80) level = '';
    else if (pct >= 60) level = '';
    else if (pct >= 40) level = '';
    setGripResult({ percentile: Math.round(pct), level });
  };

  const calcStress = () => {
    const stress = Math.max(0, Math.min(100, 100 - (hrvValue - 20) * 2));
    let level = '';
    if (stress >= 70) level = '';
    else if (stress >= 30) level = '';
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

  const bmiCategory = (v: number) => v < 18.5 ? '' : v < 25 ? '' : v < 30 ? '' : '';

  return (
    <div className="screen calculators">
      <div className="calculators-header">
        <h2>РљР°Р»СЊРєСѓР»СЏС‚РѕСЂС‹ Рё С„РѕСЂРјСѓР»С‹</h2>
        <p>РРЅСЃС‚СЂСѓРјРµРЅС‚С‹ РґР»СЏ СЂР°СЃС‡С‘С‚Р° РїРѕРєР°Р·Р°С‚РµР»РµР№ Р·РґРѕСЂРѕРІСЊСЏ Рё РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚Рё</p>
      </div>

      <div className="calc-tabs">
        <button className={'calc-tab-btn' + (activeTab === 'fitness' ? ' active' : '')} onClick={() => setActiveTab('fitness')}>Р¤РёС‚РЅРµСЃ</button>
        <button className={'calc-tab-btn' + (activeTab === 'nutrition' ? ' active' : '')} onClick={() => setActiveTab('nutrition')}>РџРёС‚Р°РЅРёРµ</button>
        <button className={'calc-tab-btn' + (activeTab === 'health' ? ' active' : '')} onClick={() => setActiveTab('health')}>Р—РґРѕСЂРѕРІСЊРµ</button>
      </div>

      {activeTab === 'fitness' && (
        <div className="calculator-panel">
          <h3>Р¤РёС‚РЅРµСЃ РєР°Р»СЊРєСѓР»СЏС‚РѕСЂС‹</h3>
          <div className="calculator-group">

            <div className="calculator-item">
              <h4>РРЅРґРµРєСЃ РјР°СЃСЃС‹ С‚РµР»Р° (BMI)</h4>
              <p className="description">Р’РµСЃ / Р РѕСЃС‚ВІ вЂ” РѕС†РµРЅРєР° РјР°СЃСЃС‹ С‚РµР»Р°</p>
              <div className="input-group">
                <label>Р’РµСЃ (РєРі): <input type="number" value={bmiWeight} onChange={e => setBmiWeight(Number(e.target.value))} /></label>
                <label>Р РѕСЃС‚ (СЃРј): <input type="number" value={bmiHeight} onChange={e => setBmiHeight(Number(e.target.value))} /></label>
                <button onClick={calcBMI}>Р Р°СЃСЃС‡РёС‚Р°С‚СЊ</button>
              </div>
              {bmiResult !== null && (
                <div className="result">
                  <span className="label">BMI:</span> <span className="value">{bmiResult.toFixed(1)}</span>
                  <span className="interpretation"> вЂ” {bmiCategory(bmiResult)}</span>
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>BMR (РњРёС„С„Р»РёРЅ-РЎР°РЅ Р–РµРѕСЂ)</h4>
              <p className="description">Р‘Р°Р·РѕРІС‹Р№ РјРµС‚Р°Р±РѕР»РёР·Рј: 10Г—РІРµСЃ + 6.25Г—СЂРѕСЃС‚ в€’ 5Г—РІРѕР·СЂР°СЃС‚ В± 161</p>
              <div className="input-group">
                <label>Р’РµСЃ (РєРі): <input type="number" value={bmrWeight} onChange={e => setBmrWeight(Number(e.target.value))} /></label>
                <label>Р РѕСЃС‚ (СЃРј): <input type="number" value={bmrHeight} onChange={e => setBmrHeight(Number(e.target.value))} /></label>
                <label>Р’РѕР·СЂР°СЃС‚: <input type="number" value={bmrAge} onChange={e => setBmrAge(Number(e.target.value))} /></label>
                <label>РџРѕР»:
                  <select value={bmrSex} onChange={e => setBmrSex(e.target.value as 'male' | 'female')}>
                    <option value="male">РњСѓР¶СЃРєРѕР№</option>
                    <option value="female">Р–РµРЅСЃРєРёР№</option>
                  </select>
                </label>
                <button onClick={calcBMR}>Р Р°СЃСЃС‡РёС‚Р°С‚СЊ</button>
              </div>
              {bmrResult !== null && (
                <div className="result">
                  <span className="label">BMR:</span> <span className="value">{bmrResult.toFixed(0)} РєРєР°Р»/РґРµРЅСЊ</span>
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>BMR (РљСЌС‚С‡-РњРєР°СЂРґР»)</h4>
              <p className="description">370 + 21.6 Г— LBM вЂ” РґР»СЏ Р»СЋРґРµР№ СЃ РёР·РІРµСЃС‚РЅС‹Рј % Р¶РёСЂР°</p>
              <div className="input-group">
                <label>Р’РµСЃ (РєРі): <input type="number" value={bmrKmWeight} onChange={e => setBmrKmWeight(Number(e.target.value))} /></label>
                <label>РўРѕР»С‰РёРЅР° Р¶РёСЂР° (%): <input type="number" step="0.1" value={bmrKmBodyFat} onChange={e => setBmrKmBodyFat(Number(e.target.value))} /></label>
                <button onClick={calcBMR_KM}>Р Р°СЃСЃС‡РёС‚Р°С‚СЊ</button>
              </div>
              {bmrKmResult !== null && (
                <div className="result">
                  <span className="label">BMR (Katch-McArdle):</span> <span className="value">{bmrKmResult.toFixed(0)} РєРєР°Р»/РґРµРЅСЊ</span>
                  <span className="interpretation"> вЂ” LBM: {(bmrKmWeight * (100 - bmrKmBodyFat) / 100).toFixed(1)} РєРі</span>
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>TDEE</h4>
              <p className="description">BMR Г— PAL вЂ” РѕР±С‰РёР№ РґРЅРµРІРЅРѕР№ СЂР°СЃС…РѕРґ СЌРЅРµСЂРіРёРё</p>
              <div className="input-group">
                <label>BMR (РєРєР°Р»): <input type="number" value={tdeeBmr} onChange={e => setTdeeBmr(Number(e.target.value))} /></label>
                <label>РЈСЂРѕРІРµРЅСЊ Р°РєС‚РёРІРЅРѕСЃС‚Рё:
                  <select value={tdeePal} onChange={e => setTdeePal(Number(e.target.value))}>
                    {PAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <button onClick={calcTDEE}>Р Р°СЃСЃС‡РёС‚Р°С‚СЊ</button>
              </div>
              {tdeeResult !== null && (
                <div className="result">
                  <span className="label">TDEE:</span> <span className="value">{tdeeResult.toFixed(0)} РєРєР°Р»/РґРµРЅСЊ</span>
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>Р”РѕР·РёСЂРѕРІРєР° РїСЂРµРїР°СЂР°С‚Р°</h4>
              <p className="description">Р Р°СЃС‡С‘С‚ РѕР±СЉС‘РјР° РёРЅСЉРµРєС†РёРё РїРѕ РґРѕР·Рµ Рё РєРѕРЅС†РµРЅС‚СЂР°С†РёРё</p>
              <div className="input-group">
                <label>Р¦РµР»РµРІР°СЏ РґРѕР·Р° (РјРі): <input type="number" value={doseTarget} onChange={e => setDoseTarget(Number(e.target.value))} /></label>
                <label>РљРѕРЅС†РµРЅС‚СЂР°С†РёСЏ (РјРі/РјР»): <input type="number" value={doseConcentration} onChange={e => setDoseConcentration(Number(e.target.value))} /></label>
                <label>РЁРїСЂРёС† (РјР»):
                  <select value={doseSyringe} onChange={e => setDoseSyringe(Number(e.target.value))}>
                    {Object.keys(SYRINGE_SPECS).map(k => <option key={k} value={k}>{k} РјР»</option>)}
                  </select>
                </label>
                <button onClick={calcDose}>Р Р°СЃСЃС‡РёС‚Р°С‚СЊ</button>
              </div>
              {doseResult !== null && (
                <div className="result">
                  <div><span className="label">РћР±СЉС‘Рј:</span> <span className="value">{doseResult.volumeMl} РјР»</span></div>
                  <div><span className="label">Р”РµР»РµРЅРёСЏ:</span> <span className="value">{doseResult.divisions}</span></div>
                  <div><span className="label">Р”РѕР· РІРѕ С„Р»Р°РєРѕРЅРµ:</span> <span className="value">{doseResult.dosesPerVial}</span></div>
                  {doseResult.flags.length > 0 && <div className="interpretation">вљ  {doseResult.flags.join(', ')}</div>}
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>РђРЅРґСЂРѕРіРµРЅРЅС‹Р№ РёРЅРґРµРєСЃ СЃС‚РµРєР°</h4>
              <p className="description">ОЈ (РґРѕР·Р° Г— AR_affinity / 100) вЂ” СЃСѓРјРјР°СЂРЅР°СЏ Р°РЅРґСЂРѕРіРµРЅРЅР°СЏ РЅР°РіСЂСѓР·РєР°</p>
              <div className="input-group">
                {aiEntries.map((entry, i) => (
                  <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <select value={entry.drug} onChange={e => updateAiEntry(i, 'drug', e.target.value)}>
                      {DRUG_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input type="number" value={entry.doseMgWeek} onChange={e => updateAiEntry(i, 'doseMgWeek', Number(e.target.value))} placeholder="" style={{ width: 80 }} />
                    <span>РјРі/РЅРµРґ</span>
                    {aiEntries.length > 1 && <button onClick={() => removeAiEntry(i)}>вњ•</button>}
                  </div>
                ))}
                <button onClick={addAiEntry}>+ Р”РѕР±Р°РІРёС‚СЊ РїСЂРµРїР°СЂР°С‚</button>
                <button onClick={calcAI}>Р Р°СЃСЃС‡РёС‚Р°С‚СЊ</button>
              </div>
              {aiResult !== null && (
                <div className="result">
                  <span className="label">РђРЅРґСЂРѕРіРµРЅРЅС‹Р№ РёРЅРґРµРєСЃ:</span> <span className="value">{aiResult.toFixed(2)}</span>
                  <span className="interpretation"> вЂ” {aiResult > 3 ? '' : aiResult > 1.5 ? '' : ''}</span>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {activeTab === 'nutrition' && (
        <div className="calculator-panel">
          <h3>РџРёС‚Р°РЅРёРµ</h3>
          <div className="calculator-group">

            <div className="calculator-item">
              <h4>РљР°Р»РѕСЂРёР№РЅС‹Р№ РґРµС„РёС†РёС‚</h4>
              <p className="description">TDEE в€’ С†РµР»РµРІС‹Рµ РєРєР°Р» в†’ СЃРєРѕСЂРѕСЃС‚СЊ РїРѕС‚РµСЂРё РІРµСЃР°</p>
              <div className="input-group">
                <label>TDEE (РєРєР°Р»/РґРµРЅСЊ): <input type="number" value={deficitTdee} onChange={e => setDeficitTdee(Number(e.target.value))} /></label>
                <label>Р¦РµР»РµРІС‹Рµ РєРєР°Р»/РґРµРЅСЊ: <input type="number" value={deficitTarget} onChange={e => setDeficitTarget(Number(e.target.value))} /></label>
                <button onClick={calcDeficit}>Р Р°СЃСЃС‡РёС‚Р°С‚СЊ</button>
              </div>
              {deficitResult !== null && (
                <div className="result">
                  <div><span className="label">Р”РµС„РёС†РёС‚:</span> <span className="value">{deficitResult.deficit} РєРєР°Р»/РґРµРЅСЊ</span></div>
                  <div><span className="label">РџРѕС‚РµСЂСЏ РІРµСЃР°:</span> <span className="value">{deficitResult.rateKgWeek.toFixed(2)} РєРі/РЅРµРґ</span></div>
                  <span className="interpretation">
                    {deficitResult.deficit <= 0 ? '' :
                     deficitResult.deficit < 500 ? '' :
                     deficitResult.deficit < 1000 ? '' : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>РњР°РєСЂРѕСЃС‹ (СЂР°СЃС‡С‘С‚ Р‘Р–РЈ)</h4>
              <p className="description">РџРѕР»РЅС‹Р№ СЂР°СЃС‡С‘С‚ Р‘Р–РЈ Рё РјРёРєСЂРѕСЌР»РµРјРµРЅС‚РѕРІ РїРѕ РґРІРёРіСѓ nutrition</p>
              <div className="input-group">
                <label>Р’РµСЃ (РєРі): <input type="number" value={macroWeight} onChange={e => setMacroWeight(Number(e.target.value))} /></label>
                <label>Р РѕСЃС‚ (СЃРј): <input type="number" value={macroHeight} onChange={e => setMacroHeight(Number(e.target.value))} /></label>
                <label>Р’РѕР·СЂР°СЃС‚: <input type="number" value={macroAge} onChange={e => setMacroAge(Number(e.target.value))} /></label>
                <label>РџРѕР»:
                  <select value={macroSex} onChange={e => setMacroSex(e.target.value as 'male' | 'female')}>
                    <option value="male">РњСѓР¶СЃРєРѕР№</option>
                    <option value="female">Р–РµРЅСЃРєРёР№</option>
                  </select>
                </label>
                <label>PAL:
                  <select value={macroPal} onChange={e => setMacroPal(Number(e.target.value))}>
                    {PAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <label>Р¦РµР»СЊ:
                  <select value={macroGoal} onChange={e => setMacroGoal(e.target.value)}>
                    <option value="bulk">РќР°Р±РѕСЂ РјР°СЃСЃС‹</option>
                    <option value="cut">РЎРЅРёР¶РµРЅРёРµ РІРµСЃР°</option>
                    <option value="maintenance">РџРѕРґРґРµСЂР¶Р°РЅРёРµ</option>
                    <option value="recomp">Р РµРєРѕРјРїРѕР·РёС†РёСЏ</option>
                    <option value="rehab">Р РµР°Р±РёР»РёС‚Р°С†РёСЏ</option>
                  </select>
                </label>
                <button onClick={calcMacros}>Р Р°СЃСЃС‡РёС‚Р°С‚СЊ</button>
              </div>
              {macroResult !== null && (
                <div className="result">
                  <div><span className="label">РљРєР°Р»:</span> <span className="value">{macroResult.kcal}</span></div>
                  <div><span className="label">Р‘РµР»РєРё:</span> <span className="value">{macroResult.protein} Рі</span></div>
                  <div><span className="label">Р–РёСЂС‹:</span> <span className="value">{macroResult.fats} Рі</span></div>
                  <div><span className="label">РЈРіР»РµРІРѕРґС‹:</span> <span className="value">{macroResult.carbs} Рі</span></div>
                  <div><span className="label">Р’РѕРґР°:</span> <span className="value">{macroResult.water} Р»</span></div>
                  <div><span className="label">РљР»РµС‚С‡Р°С‚РєР°:</span> <span className="value">{macroResult.fiber} Рі</span></div>
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>HOMA-IR</h4>
              <p className="description">(Р“Р»СЋРєРѕР·Р° Г— РРЅСЃСѓР»РёРЅ) / 22.5 вЂ” РёРЅРґРµРєСЃ РёРЅСЃСѓР»РёРЅРѕСЂРµР·РёСЃС‚РµРЅС‚РЅРѕСЃС‚Рё</p>
              <div className="input-group">
                <label>Р“Р»СЋРєРѕР·Р° (РјРјРѕР»СЊ/Р»): <input type="number" step="0.1" value={homaGlucose} onChange={e => setHomaGlucose(Number(e.target.value))} /></label>
                <label>РРЅСЃСѓР»РёРЅ (ОјР•/РјР»): <input type="number" step="0.1" value={homaInsulin} onChange={e => setHomaInsulin(Number(e.target.value))} /></label>
                <button onClick={calcHOMA}>Р Р°СЃСЃС‡РёС‚Р°С‚СЊ</button>
              </div>
              {homaResult !== null && (
                <div className="result">
                  <span className="label">HOMA-IR:</span> <span className="value">{homaResult.index.toFixed(2)}</span>
                  <span className="interpretation"> вЂ” {homaResult.resistant ? 'вљЎ РРЅСЃСѓР»РёРЅРѕСЂРµР·РёСЃС‚РµРЅС‚РЅРѕСЃС‚СЊ (>2.5)' : 'вњ… РќРѕСЂРјР°'}</span>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {activeTab === 'health' && (
        <div className="calculator-panel">
          <h3>Р—РґРѕСЂРѕРІСЊРµ</h3>
          <div className="calculator-group">

            <div className="calculator-item">
              <h4>РљР°Р»СЊС†РёР№ СЃРєРѕСЂСЂРµРєС‚РёСЂРѕРІР°РЅРЅС‹Р№</h4>
              <p className="description">Ca_РѕР±С‰ + 0.8 Г— (4.0 в€’ Р°Р»СЊР±СѓРјРёРЅ) вЂ” РєРѕСЂСЂРµРєС†РёСЏ РЅР° Р±РµР»РѕРє</p>
              <div className="input-group">
                <label>РћР±С‰РёР№ Ca (РјРјРѕР»СЊ/Р»): <input type="number" step="0.01" value={caTotal} onChange={e => setCaTotal(Number(e.target.value))} /></label>
                <label>РђР»СЊР±СѓРјРёРЅ (Рі/РґР»): <input type="number" step="0.1" value={caAlbumin} onChange={e => setCaAlbumin(Number(e.target.value))} /></label>
                <button onClick={calcCa}>Р Р°СЃСЃС‡РёС‚Р°С‚СЊ</button>
              </div>
              {caResult !== null && (
                <div className="result">
                  <span className="label">РЎРєРѕСЂСЂРµРєС‚РёСЂРѕРІР°РЅРЅС‹Р№ Ca:</span> <span className="value">{caResult.toFixed(2)} РјРјРѕР»СЊ/Р»</span>
                  <span className="interpretation"> вЂ” {caResult < 2.1 ? '' : caResult > 2.6 ? '' : ''}</span>
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>РђС‚РµСЂРѕРіРµРЅРЅС‹Р№ РёРЅРґРµРєСЃ</h4>
              <p className="description">(РћР±С‰РёР№ С…РѕР»РµСЃС‚РµСЂРёРЅ в€’ HDL) / HDL вЂ” СЂРёСЃРє Р°С‚РµСЂРѕСЃРєР»РµСЂРѕР·Р°</p>
              <div className="input-group">
                <label>РћР±С‰РёР№ С…РѕР»РµСЃС‚РµСЂРёРЅ (РјРјРѕР»СЊ/Р»): <input type="number" step="0.01" value={aiTotalChol} onChange={e => setAiTotalChol(Number(e.target.value))} /></label>
                <label>HDL (РјРјРѕР»СЊ/Р»): <input type="number" step="0.01" value={aiHdl} onChange={e => setAiHdl(Number(e.target.value))} /></label>
                <button onClick={calcAtherogenic}>Р Р°СЃСЃС‡РёС‚Р°С‚СЊ</button>
              </div>
              {aiResult2 !== null && (
                <div className="result">
                  <span className="label">РђС‚РµСЂРѕРіРµРЅРЅС‹Р№ РёРЅРґРµРєСЃ:</span> <span className="value">{aiResult2.index.toFixed(2)}</span>
                  <span className="interpretation"> вЂ” {aiResult2.highRisk ? 'вљ  Р’С‹СЃРѕРєРёР№ СЂРёСЃРє (>3)' : 'вњ… Р”РѕРїСѓСЃС‚РёРјС‹Р№'}</span>
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>РЎРёР»Р° С…РІР°С‚Р°</h4>
              <p className="description">РћС†РµРЅРєР° РѕР±С‰РµР№ СЃРёР»С‹ РїРѕ РєРёСЃС‚РµРІРѕР№ РґРёРЅР°РјРѕРјРµС‚СЂРёРё</p>
              <div className="input-group">
                <label>РЎРёР»Р° С…РІР°С‚Р° (РєРі): <input type="number" value={gripKg} onChange={e => setGripKg(Number(e.target.value))} /></label>
                <label>РџРѕР»:
                  <select value={gripSex} onChange={e => setGripSex(e.target.value as 'male' | 'female')}>
                    <option value="male">РњСѓР¶СЃРєРѕР№</option>
                    <option value="female">Р–РµРЅСЃРєРёР№</option>
                  </select>
                </label>
                <label>Р’РѕР·СЂР°СЃС‚: <input type="number" value={gripAge} onChange={e => setGripAge(Number(e.target.value))} /></label>
                <button onClick={calcGrip}>РћС†РµРЅРёС‚СЊ</button>
              </div>
              {gripResult !== null && (
                <div className="result">
                  <span className="label">РџСЂРѕС†РµРЅС‚РёР»СЊ:</span> <span className="value">{gripResult.percentile}%</span>
                  <span className="interpretation"> вЂ” {gripResult.level}</span>
                </div>
              )}
            </div>

            <div className="calculator-item">
              <h4>РЎС‚СЂРµСЃСЃ (HRV)</h4>
              <p className="description">РћС†РµРЅРєР° СЃС‚СЂРµСЃСЃР° РїРѕ РІР°СЂРёР°Р±РµР»СЊРЅРѕСЃС‚Рё СЃРµСЂРґРµС‡РЅРѕРіРѕ СЂРёС‚РјР°</p>
              <div className="input-group">
                <label>RMSSD / HRV (РјСЃ): <input type="number" value={hrvValue} onChange={e => setHrvValue(Number(e.target.value))} /></label>
                <button onClick={calcStress}>РћС†РµРЅРёС‚СЊ</button>
              </div>
              {stressResult !== null && (
                <div className="result">
                  <span className="label">РЈСЂРѕРІРµРЅСЊ СЃС‚СЂРµСЃСЃР°:</span> <span className="value">{stressResult.stress}%</span>
                  <span className="interpretation"> вЂ” {stressResult.level}</span>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

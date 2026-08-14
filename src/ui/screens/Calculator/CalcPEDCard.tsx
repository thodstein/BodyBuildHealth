// ════════════════════════════════════════════════════════════════════
//  CalcPEDCard — карточка ввода PED с попапами + кнопкой "добавить препарат"
// ════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { classifyPed } from '../../../data/ped-potency-table';
import { resolvePedAlias } from '../../../data/ped-alias-map';
import { GLASS } from './Calc.types';

interface Props {
  state: any;
  onStateChange: (next: any) => void;
}

const PED_LIST: Array<[string, string]> = [
  ['test_enan', 'Тестостерон энантат'],
  ['test_cyp', 'Тестостерон ципионат'],
  ['test_prop', 'Тестостерон пропионат'],
  ['test_undec', 'Тестостерон ундеканоат'],
  ['test_susp', 'Тестостерон суспензия'],
  ['sustanon', 'Сустанон'],
  ['nandrolone_decanoate', 'Нандролон деканоат'],
  ['nandrolone_phenylprop', 'Нандролон фенилпроп'],
  ['trenbolone_enan', 'Тренболон энантат'],
  ['trenbolone_acetate', 'Тренболон ацетат'],
  ['tren_hex', 'Тренболон гексагидробензилкарбонат'],
  ['parabolan', 'Параболан (тренболон гекса)'],
  ['boldenone_undecylenate', 'Болденон'],
  ['dhb', 'Дигидроболденон (DHB)'],
  ['dhb_acetate', 'DHB ацетат'],
  ['dhb_propionate', 'DHB пропионат'],
  ['dhb_cyp', 'DHB ципионат'],
  ['masteron_enan', 'Мастерон (ДГТ)'],
  ['masteron_prop', 'Мастерон проп'],
  ['primobolan_enan', 'Примоболан'],
  ['methenolone_acetate', 'Примоболан ор'],
  ['oxymetholone', 'Анаполон (Anadrol)'],
  ['methandienone', 'Метан (Dianabol)'],
  ['stanozolol_oral', 'Стромба (Winny ор)'],
  ['stanozolol_inj', 'Винстрол инж'],
  ['oxandrolone', 'Анавар (Oxandrolone)'],
  ['turinabol', 'Туинабол (орал)'],
  ['superdrol', 'Superdrol'],
  ['halotestin', 'Голотестин'],
  ['trestolone', 'Трестолон (MENT)'],
  ['mesterolone', 'Провирон (местеролон)'],
  ['ostarine', 'Ostarine (SARM)'],
  ['lgd', 'Ligandrol LGD-4033'],
  ['rad140', 'RAD-140'],
  ['s23', 'S-23'],
  ['mk677', 'MK-677 (ибутаморен)'],
  ['cjc1295', 'CJC-1295'],
  ['ghrp6', 'GHRP-6'],
  ['ipamorelin', 'Ipamorelin'],
  ['semaglutide', 'Семаглутид (GLP-1)'],
  ['tirzepatide', 'Тирзепатид (GLP-1)'],
  ['somatropin', 'ГР (somatropin)'],
  ['insulin_rapid', 'Инсулин (rapid)'],
  ['insulin_lantus', 'Инсулин (long)'],
  ['igf1_lr3', 'IGF-1 LR3'],
  ['igf1_des', 'IGF-1 DES'],
  ['mgf', 'MGF'],
  ['clenbuterol', 'Кленбутерол'],
  ['t3', 'T3 (лиотиронин)'],
  ['t4', 'T4 (левотироксин)'],
];

export const CalcPEDCard: React.FC<Props> = ({ state, onStateChange }) => {
  const [open, setOpen] = useState(false);
  const [pedPopup, setPedPopup] = useState(false);
  const [addPedId, setAddPedId] = useState('');
  const [addPedMg, setAddPedMg] = useState('');
  const [addPedForm, setAddPedForm] = useState<'inject' | 'oral' | 'subq'>('inject');

  const aasList: Array<{ id: string; mgPerWeek?: number; iuPerDay?: number; mcgPerDay?: number; form?: string }> = (state.pharma?.aas || []);

  const extraPed = (() => {
    const pedDoses: Array<{ id: string; pClass: string; mgPerWeek?: number; iuPerDay?: number; mcgPerDay?: number; form?: string }> = [];
    const ghIU = (state.pharma as any).ghIU || 0;
    if (ghIU > 0) pedDoses.push({ id: 'somatropin', pClass: 'gh', iuPerDay: ghIU, form: 'subq' });
    const insulinIU = (state.pharma as any).insulinIU || 0;
    if (insulinIU > 0) pedDoses.push({ id: 'insulin_rapid', pClass: 'insulin', iuPerDay: insulinIU, form: 'subq' });
    const igfMcg = (state.pharma as any).igfMcg || 0;
    if (igfMcg > 0) pedDoses.push({ id: 'igf1_lr3', pClass: 'igf', mcgPerDay: igfMcg, form: 'subq' });
    const clenMcg = (state.pharma as any).clenMcg || 0;
    if (clenMcg > 0) pedDoses.push({ id: 'clenbuterol', pClass: 'clenbut', mcgPerDay: clenMcg, form: 'oral' });
    const t3Mcg = (state.pharma as any).t3Mcg || 0;
    if (t3Mcg > 0) pedDoses.push({ id: 't3', pClass: 't3', mcgPerDay: t3Mcg, form: 'oral' });
    return pedDoses;
  })();

  const removeAas = (idx: number) => {
    const next = [...aasList];
    next.splice(idx, 1);
    onStateChange({ ...state, pharma: { ...state.pharma, aas: next } });
  };

  const addAas = () => {
    if (!addPedId.trim()) return;
    const canonId = resolvePedAlias(addPedId);
    const pClass = classifyPed(canonId);
    const formVal = pClass.includes('oral') ? 'oral' : addPedForm;
    let entry: any = { id: canonId, form: formVal };
    if (formVal === 'oral') entry.mgPerWeek = Number(addPedMg) || 50;
    else entry.mgPerWeek = Number(addPedMg) || 500;
    onStateChange({ ...state, pharma: { ...state.pharma, aas: [...aasList, entry] } });
    setAddPedId(''); setAddPedMg(''); setPedPopup(false);
  };

  const changeMg = (idx: number, mg: number) => {
    const next = [...aasList];
    next[idx] = { ...next[idx], mgPerWeek: mg };
    onStateChange({ ...state, pharma: { ...state.pharma, aas: next } });
  };

  return (
    <div style={{ ...GLASS, padding: 10, marginBottom: 8 }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>💊 Курс (PED)</span>
        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
          {aasList.length} ААС · {extraPed.length} доп · {open ? '▲' : '▼'}
        </span>
      </div>

      {open && (
        <div style={{ marginTop: 8 }}>

          {/* Список текущих PED */}
          {aasList.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {aasList.map((a, i) => {
                const ped = PED_LIST.find(([id]) => id === a.id.toLowerCase());
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, padding: '3px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.2)' }}>
                    <span style={{ flex: 1, fontSize: 9, color: 'var(--text)', fontWeight: 600 }}>{ped ? ped[1] : a.id}</span>
                    <input type="number" value={a.mgPerWeek ?? ''} onChange={e => changeMg(i, Number(e.target.value))}
                      style={{ width: 60, padding: '3px 5px', fontSize: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', borderRadius: 4 }} placeholder="мг/нед" />
                    <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>мг/нед</span>
                    <button onClick={() => removeAas(i)} style={{ background: 'rgba(239,68,68,0.12)', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 8, padding: '2px 5px', borderRadius: 4 }}>✕</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Доп PED (GH/insulin/IGF/clen/T3) — компактно */}
          {extraPed.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Дополнительные PED</div>
              {extraPed.map((p, i) => {
                const labels: Record<string, string> = { gh: 'GH', insulin: 'Инсулин', igf: 'IGF-1 LR3', clenbut: 'Кленбут', t3: 'T3' };
                const doseVal = p.iuPerDay ? `${p.iuPerDay} МЕ/день` : p.mcgPerDay ? `${p.mcgPerDay} мкг/день` : '';
                return (
                  <div key={i} style={{ fontSize: 8, padding: '2px 8px', color: 'var(--text-light)' }}>
                    • {labels[p.pClass] || p.id} {doseVal}
                  </div>
                );
              })}
            </div>
          )}

          {/* Кнопка добавить препарат */}
          <button onClick={() => setPedPopup(true)} style={{ width: '100%', padding: '8px', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer', background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span style={{fontSize:12}}>➕</span>
            <span>Добавить препарат</span>
          </button>

          {/* Автозаполнение из фарма-курса */}
          <button
            onClick={() => {
              try {
                const courseData = JSON.parse(localStorage.getItem('he_pharma_course') || '{}');
                const courseAas = (courseData.aas || courseData.drugs || []) as any[];
                if (courseAas.length === 0) {
                  alert('Фарма-курс пуст — нет данных для автозаполнения');
                  return;
                }
                const mapped = courseAas.map((a: any) => ({
                  id: (a.id || a.nameId || '').toLowerCase(),
                  form: (a.form === 'oral' ? 'oral' : 'inject'),
                  mgPerWeek: a.mgPerWeek || a.dosePerWeek || (a.dose ? Number(String(a.dose).replace(/\D/g, '')) * 7 : 500),
                })).filter((x: any) => x.id);
                onStateChange({ ...state, pharma: { ...state.pharma, aas: mapped } });
              } catch {
                alert('Не удалось загрузить фарма-курс');
              }
            }}
            style={{ width: '100%', marginTop: 4, padding: '6px', borderRadius: 8, fontSize: 8, fontWeight: 600, cursor: 'pointer', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span style={{fontSize:11}}>🔄</span>
            <span>Автозаполнение из фарма-курса</span>
          </button>

          {/* Попап добавления препарата */}
          {pedPopup && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }} onClick={() => setPedPopup(false)}>
              <div onClick={e => e.stopPropagation()} style={{ width: '88%', maxWidth: 340, borderRadius: 16, background: '#1a1a1d', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: 3, background: 'linear-gradient(90deg,#00e68a,#00c853)' }} />
                <div style={{ padding: 16, overflowY: 'auto' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#00e68a', marginBottom: 8 }}>➕ Добавить препарат</div>

                  <select value={addPedId} onChange={e => setAddPedId(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 9, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', marginBottom: 8 }}>
                    <option value="">— выбрать препарат —</option>
                    {PED_LIST.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>

                  {addPedId && (
                    <>
                      <input type="number" value={addPedMg} onChange={e => setAddPedMg(e.target.value)} placeholder="Доза (мг/недель)"
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 9, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', marginBottom: 6 }} />
                      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                        {(['inject', 'oral', 'subq'] as const).map(f => (
                          <button key={f} onClick={() => setAddPedForm(f)}
                            style={{ flex: 1, padding: '5px', borderRadius: 6, fontSize: 8, fontWeight: 600, cursor: 'pointer',
                              border: addPedForm === f ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                              background: addPedForm === f ? 'rgba(0,230,138,0.1)' : 'transparent',
                              color: addPedForm === f ? '#00e68a' : 'var(--text-dim)' }}>
                            {f === 'inject' ? 'Инж' : f === 'oral' ? 'Орал' : 'П/к'}
                          </button>
                        ))}
                      </div>
                      <button onClick={addAas} style={{ width: '100%', padding: '10px', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', border: 'none', color: '#000' }}>✅ Добавить</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
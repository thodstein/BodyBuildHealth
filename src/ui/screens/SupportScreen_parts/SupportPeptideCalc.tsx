// @ts-nocheck
/**
 * SupportPeptideCalc.tsx — извлечено из SupportScreen.tsx
 * Секция: protocols
 */
import React from 'react';
import { PopupBool, PopupNumber, PopupSelect } from '../../components/PopupXxx';
import { PEPTIDE_LIST, PEPTIDE_DB, computeDilution, computeEffectiveDose, computePK, generatePeptideProtocol, ROUTE_LABELS, SYRINGE_TYPES } from '../../../engines/peptide-calculator.engine';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportPeptideCalc: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const {
    peptideId,
    setPeptideId,
    pepAmount,
    setPepAmount,
    pepDose,
    setPepDose,
    pepVial,
    setPepVial,
    pepSyringe,
    setPepSyringe,
    pepConcentration,
    setPepConcentration,
    pepProtocol,
    setPepProtocol,
    pepShowSchedule,
    setPepShowSchedule,
    pepShowReconstitution,
    setPepShowReconstitution,
    pepShowDilution,
    setPepShowDilution,
    goBack
  } = s;

  return (
        <div style={{ padding:'0 0 80px', height:'100vh', display:'flex', flexDirection:'column' }}>
          <h2 style={{ margin:'0 0 4px', fontSize:16, fontWeight:800, color:'#a78bfa' }}>🧬 Пептидный калькулятор</h2>
          <p style={{ fontSize:10, color:'var(--text-dim)', margin:'0 0 12px' }}>Расчёт дозировок, баков, разведения и протоколов пептидов.</p>
          <div style={{ flex:1, overflowY:'auto', paddingRight:4 }}>
            {/* Peptide Selection */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
              <h4 style={{ margin:'0 0 8px', fontSize:12, color:'var(--text)' }}>🧪 Выберите пептид</h4>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:12 }}>
                {PEPTIDE_LIST.map((p: any) => (
                  <button key={p.id} onClick={() => { setPeptideId(p.id); setPepAmount(2); setPepDose(100); }} style={{
                    padding:'6px 10px', borderRadius:16, fontSize:9, fontWeight:600, whiteSpace:'nowrap', cursor:'pointer',
                    background: peptideId === p.id ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: peptideId === p.id ? '#000' : 'var(--text-dim)',
                    border: `1px solid ${peptideId === p.id ? 'var(--accent)' : 'var(--border)'}`,
                  }}>{p.name}</button>
                ))}
              </div>
              {peptideId && (() => {
                const sel = PEPTIDE_LIST.find((p: any) => p.id === peptideId);
                if (!sel) return null;
                const routesStr = (sel.routes||[]).map((r: any) => ROUTE_LABELS[r]||r).join(', ') || '—';
                const riskColor = sel.riskLevel === 'high' ? '#ef4444' : sel.riskLevel === 'medium' ? '#f59e0b' : '#22c55e';
                const riskLabel = sel.riskLevel === 'high' ? 'Высокий' : sel.riskLevel === 'medium' ? 'Средний' : sel.riskLevel === 'low' ? 'Низкий' : '—';
                return (
                  <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.15)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#a78bfa', marginBottom:2 }}>{sel.name || sel.shortName || '—'}</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.4, marginBottom:3 }}>
                      <b>Эффекты:</b> {(sel.effects || []).join(', ') || '—'}
                    </div>
                    <div style={{ fontSize:8, color:'#a78bfa', marginBottom:2 }}>
                      <b>T½:</b> {sel.tHalfHours || '—'} ч · <b>Класс:</b> {sel.className || '—'} · <b>Пути:</b> {routesStr}
                    </div>
                    {(sel.mechanisms||[]).length > 0 && (
                      <div style={{ fontSize:8, color:'rgba(255,255,255,0.9)', marginBottom:2, lineHeight:1.3 }}>
                        <b>Механизмы:</b> {(sel.mechanisms||[]).join(', ') || '—'}
                      </div>
                    )}
                    <div style={{ fontSize:8, marginTop:2, display:'flex', gap:8, flexWrap:'wrap' }}>
                      <span style={{ color: 'var(--text-dim)' }}><b>Во флаконе:</b> {sel.amountMg || '—'} мг</span>
                      <span style={{ color: riskColor, fontWeight:600 }}><b>Риск:</b> {riskLabel}</span>
                      {(sel.riskNotes||[]).length > 0 && (
                        <span style={{ color:'#f59e0b', fontSize:7, maxWidth:180, lineHeight:1.2, display:'inline-block' }}>
                          ⚠ {(sel.riskNotes||[]).slice(0,3).join('; ') || '—'}
                        </span>
                      )}
                    </div>
                    {sel.bioavailability && Object.keys(sel.bioavailability).length > 0 && (
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:2 }}>
                        <b>Биодоступность:</b> {Object.entries(sel.bioavailability).map(([k, v]: [any, any]) => `${ROUTE_LABELS[k]||k}: ${v.avg}%`).join(', ') || '—'}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Dilution Calculator */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
              <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#60a5fa' }}>💧 Калькулятор разведения</h4>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <PopupNumber label="💊 Кол-во пептида" value={pepAmount} min={0.1} max={100} step={0.1} suffix="мг" onChange={v => setPepAmount(Math.max(0.1, v))} />
                <PopupNumber label="💧 Объём бака" value={pepDilution} min={0.1} max={50} step={0.1} suffix="мл" onChange={v => setPepDilution(Math.max(0.1, v))} />
                <PopupNumber label="💉 Дозировка" value={pepDose} min={1} max={10000} step={10} suffix="мкг" onChange={v => setPepDose(Math.max(1, v))} />
                <PopupSelect label="💉 Шприц" value={pepSyringe} options={Object.entries(SYRINGE_TYPES).map(([k, v]: [any, any]) => ({ id: k, label: v.label }))} onChange={v => setPepSyringe(v as keyof typeof SYRINGE_TYPES)} />
              </div>
              {(() => {
                const conc = pepAmount / pepDilution; // mg/mL
                const doseMg = pepDose / 1000; // mcg -> mg
                const doseMl = doseMg / conc;
                const syringeInfo = SYRINGE_TYPES[pepSyringe];
                const units = syringeInfo ? doseMl * syringeInfo.unitsPerMl : doseMl * 100;
                return (
                  <div style={{ marginTop:10, padding:'10px 12px', borderRadius:8, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
                    <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>📐 Результат разведения</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:9 }}>
                      <div>Концентрация: <b style={{ color:'#60a5fa' }}>{conc.toFixed(2)} мг/мл</b></div>
                      <div>Объем дозы: <b style={{ color:'#60a5fa' }}>{doseMl.toFixed(3)} мл</b></div>
                      <div>Единиц (IU): <b style={{ color:'#60a5fa' }}>{units.toFixed(0)} IU</b></div>
                      <div>Доз на флакон: <b style={{ color:'#60a5fa' }}>{pepDilution > 0 && doseMl > 0 ? Math.floor(pepDilution / doseMl) : 0}</b></div>
                    </div>
                    <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2 }}>Наберите {units.toFixed(0)} IU ({doseMl.toFixed(3)} мл) для дозы {pepDose} мкг</div>
                  </div>
                );
              })()}
            </div>

            {/* PK Display */}
            {peptideId && (() => {
              const sel = PEPTIDE_LIST.find((p: any) => p.id === peptideId);
              if (!sel) return null;
              const tHalf = sel.tHalfHours || 4;
              const peakTime = tHalf * 0.33;
              const steadyState = tHalf * 5;
              const clearanceTime = tHalf * 6;
              return (
                <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
                  <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#a78bfa' }}>📈 Фармакокинетика (PK)</h4>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.1)' }}>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>Период полувыведения (T½)</div>
                      <div style={{ fontSize:16, fontWeight:800, color:'#a78bfa' }}>{tHalf.toFixed(1)} ч</div>
                    </div>
                    <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.1)' }}>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>Пик концентрации (Cmax)</div>
                      <div style={{ fontSize:16, fontWeight:800, color:'#a78bfa' }}>{peakTime.toFixed(1)} ч</div>
                    </div>
                    <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.1)' }}>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>Стабильное состояние (5×T½)</div>
                      <div style={{ fontSize:16, fontWeight:800, color:'#a78bfa' }}>{steadyState.toFixed(1)} ч</div>
                    </div>
                    <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.1)' }}>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>Полный клиренс (6×T½)</div>
                      <div style={{ fontSize:16, fontWeight:800, color:'#a78bfa' }}>{clearanceTime.toFixed(1)} ч</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Dosing Schedule */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
              <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#f59e0b' }}>📅 График дозирования</h4>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
                {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((day: any) => {
                  const active = pepSchedule.includes(day);
                  return (
                    <button key={day} onClick={() => setPepSchedule(active ? pepSchedule.filter((d: any) => d !== day) : [...pepSchedule, day])} style={{
                      padding:'6px 10px', borderRadius:8, fontSize:9, fontWeight:600, cursor:'pointer',
                      background: active ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: active ? '#000' : 'var(--text-dim)',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    }}>{day}</button>
                  );
                })}
              </div>
              <div>
                <PopupNumber label="📅 Длительность (дней)" value={pepTotalDays} min={1} max={365} step={1} suffix="дн" onChange={v => setPepTotalDays(Math.max(1, v))} />
              </div>
              <div style={{ marginTop:8, padding:'10px 12px', borderRadius:8, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
                <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>📊 Итого</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:9 }}>
                  <div>Доз в неделю: <b style={{ color:'#f59e0b' }}>{pepSchedule.length}</b></div>
                  <div>Всего доз: <b style={{ color:'#f59e0b' }}>{Math.round(pepTotalDays / 7 * pepSchedule.length)}</b></div>
                  <div>Недельный расход: <b style={{ color:'#f59e0b' }}>{(pepSchedule.length * pepDose / 1000).toFixed(1)} мг</b></div>
                  <div>Общий расход: <b style={{ color:'#f59e0b' }}>{(pepTotalDays / 7 * pepSchedule.length * pepDose / 1000).toFixed(1)} мг</b></div>
                </div>
              </div>
            </div>
          </div>

      {/* ===== MODAL OVERLAY ===== */}
      {showModal && <SupportModals
        showModal={showModal} setShowModal={setShowModal}
        modalLevel={modalLevel} setModalLevel={setModalLevel}
        modalSearch={modalSearch} setModalSearch={setModalSearch}
        modalSelected={modalSelected} setModalSelected={setModalSelected}
        modalAddMode={modalAddMode} setModalAddMode={setModalAddMode}
        showSavedPicker={showSavedPicker} setShowSavedPicker={setShowSavedPicker}
        setEnhancedSubs={setEnhancedSubs}
        setBoostEnabled={setBoostEnabled}
        setSupportLevel={setSupportLevel}
        setManualLevelSelected={setManualLevelSelected}
        calcSupport={calcSupport}
        catalogSupport={catalogSupport}
        allSupport={allSupport}
        catalogSubstances={catalogSubstances}
        jointMode={jointMode}
        setJointMode={setJointMode}
        boostEnabled={boostEnabled}
        getStackDisplayName={getStackDisplayName}
        savedStacks={savedStacks}
        MECH_TRANSLATIONS_RU={MECH_TRANSLATIONS_RU}
        SUPPORT_LEVELS={SUPPORT_LEVELS}
        courseWeekState={courseWeekState}
        setCourseWeekState={setCourseWeekState}
        maxCourseWeek={Math.max(2, ...((linked.course || []).map((c: any) => (c.endWeek || 12) - (c.startWeek || 0))), 12)}
        onWeekChange={(newWeek: number) => {
          if (calcDone && calcResult) {
            calcSupport(supportLevel);
            setWeekChangeMsg(`Неделя ${newWeek}: план пересчитан с учётом накопленного риска.`);
            setTimeout(() => setWeekChangeMsg(''), 4000);
          }
        }}
      />}

      {/* ===== STACK BUILDER FLOATING BADGE ===== */}
      {stackBuilder.length > 0 && (
        <div style={{ position:'sticky', bottom:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'8px 14px', borderRadius:16, background:'rgba(0,0,0,0.6)', border:'1px solid rgba(0,230,138,0.3)', boxShadow:'0 4px 20px rgba(0,0,0,0.5)' }}>
          <span style={{ fontSize:10, fontWeight:700, color:'#00e68a' }}>🧮 Стек: {stackBuilder.length} веществ</span>
          <button onClick={() => setStackBuilder([])} style={{ padding:'4px 10px', borderRadius:8, fontSize:9, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', fontWeight:600 }}>Очистить</button>
          <button onClick={saveBuilderStack} style={{ padding:'4px 10px', borderRadius:8, fontSize:9, cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', border:'none', color:'#000', fontWeight:700 }}>Сохранить</button>
        </div>
      )}
    </div>
  );
};

/** StrengthAnalysisHub.tsx — ЕДИНЫЙ полированный хаб «Анализ силы» без дублей.
 * Объединяет: 1RM (7 формул, консенсус) + VBT (скорость) + Отн. сила (×BW) + Нормативы (DOTS/Wilks/IPF GL) + Аналитика (процентили/соотношения/MEV).
 * Один входной снапшот (пол/вес/присед/жим/тяга/жим стоя) питает все секции — без повтора ввода. Белый текст, стекло, градиенты.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { OneRmCalcTab } from './OneRmCalcTab';
import { VBTCalcTab } from './VBTCalcTab';
import { PlNormsCalcTab } from './PlNormsCalcTab';
import { StrengthAnalyticsCard } from './StrengthAnalyticsCard';
import { PopupNumber, PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import { getProfile } from '../../../core/profile-manager';
import { relativeStrengthFullReport, dotsScore, wilksScore, ipfGLPoints } from '../../../engines/pro/relative-strength.engine';
import { buildStrengthReportText, buildStrengthPrintHtml } from '../../../engines/pro/strength-export.engine';
import type { Sex } from '../../../engines/pro/relative-strength.engine';

const ACCENT = '#00e68a';
const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.42)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', transition:'all 0.18s ease' };
const CARD: React.CSSProperties = { ...GLASS, borderRadius: 14, padding: 12, marginBottom: 10, transition:'all 0.18s ease' };
const DIM = '#fff';
const SMALL: React.CSSProperties = { fontSize: 10, color: '#fff', lineHeight: 1.45 };

type StrengthAnalysisHubMode = '1rm' | 'vbt' | 'norms' | 'analytics';

export interface HubSnapshot { sex: Sex; bw: number; squat: number; bench: number; dead: number; ohp: number }
const MODE_DEFS: Array<{ m: StrengthAnalysisHubMode; label: string; icon: string; desc: string; accent: string }> = [
  { m: '1rm', label: '1RM', icon: '🎯', desc: '7 формул, консенсус', accent: '#00e68a' },
  { m: 'vbt', label: 'VBT', icon: '⚡', desc: 'Скорость штанги', accent: '#3b82f6' },
  { m: 'norms', label: 'Нормативы', icon: '🏆', desc: 'Разряды + DOTS/Wilks/IPF GL', accent: '#f59e0b' },
  { m: 'analytics', label: 'Аналитика', icon: '📊', desc: 'Процентили, соотношения, MEV', accent: '#22c55e' },
];

const SNAP_KEY = 'he_strength_hub_snapshot_v1';

export const StrengthAnalysisHub: React.FC<{ initialMode?: StrengthAnalysisHubMode }> = ({ initialMode }) => {
  const [mode, setMode] = useState<StrengthAnalysisHubMode>(initialMode ?? '1rm');
  // единый снапшот — питает relstr/norms/analytics без дубля ввода
  const [sex, setSex] = useState<Sex>(() => { try { return (getProfile().settings as any)?.personal?.sex === 'female' ? 'female' : 'male'; } catch { return 'male'; } });
  const [bw, setBw] = useState<number>(() => { try { return Number((getProfile().settings as any)?.personal?.weight) || 83; } catch { return 83; } });
  const [squat, setSquat] = useState<number>(() => { try { return Number((getProfile() as any)?.settings?.strengthBaselines?.squat) || 180; } catch { return 180; } });
  const [bench, setBench] = useState<number>(() => { try { return Number((getProfile() as any)?.settings?.strengthBaselines?.bench) || 120; } catch { return 120; } });
  const [dead, setDead] = useState<number>(() => { try { return Number((getProfile() as any)?.settings?.strengthBaselines?.dead) || 220; } catch { return 220; } });
  const [ohp, setOhp] = useState<number>(60);

  // load snapshot
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SNAP_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.sex) setSex(s.sex);
        if (typeof s.bw === 'number') setBw(s.bw);
        if (typeof s.squat === 'number') setSquat(s.squat);
        if (typeof s.bench === 'number') setBench(s.bench);
        if (typeof s.dead === 'number') setDead(s.dead);
        if (typeof s.ohp === 'number') setOhp(s.ohp);
        return;
      }
    } catch {}
    try {
      const p: any = getProfile()?.settings;
      if (p?.personal?.sex) setSex(p.personal.sex === 'female' ? 'female' : 'male');
      if (p?.personal?.weight) setBw(Number(p.personal.weight));
      if (p?.strengthBaselines?.squat) setSquat(Number(p.strengthBaselines.squat));
      if (p?.strengthBaselines?.bench) setBench(Number(p.strengthBaselines.bench));
      if (p?.strengthBaselines?.dead) setDead(Number(p.strengthBaselines.dead));
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(SNAP_KEY, JSON.stringify({ sex, bw, squat, bench, dead, ohp })); } catch {}
  }, [sex, bw, squat, bench, dead, ohp]);

  const total = squat + bench + dead;
  const snapshot: HubSnapshot = useMemo(() => ({ sex, bw, squat, bench, dead, ohp }), [sex, bw, squat, bench, dead, ohp]);
  const patchHub = React.useCallback((patch: Partial<HubSnapshot>) => {
    if (patch.sex) setSex(patch.sex);
    if (typeof patch.bw === 'number') setBw(patch.bw);
    if (typeof patch.squat === 'number') setSquat(patch.squat);
    if (typeof patch.bench === 'number') setBench(patch.bench);
    if (typeof patch.dead === 'number') setDead(patch.dead);
    if (typeof patch.ohp === 'number') setOhp(patch.ohp);
  }, []);
  const report = useMemo(() => relativeStrengthFullReport(squat, bench, dead, bw, sex), [squat, bench, dead, bw, sex]);
  const dots = useMemo(() => dotsScore(total, bw, sex), [total, bw, sex]);
  const wilks = useMemo(() => wilksScore(total, bw, sex), [total, bw, sex]);
  const ipfgl = useMemo(() => ipfGLPoints(total, bw, sex), [total, bw, sex]);

  return (
    <div className="train-strength" style={{ padding: '10px 8px 18px', color: '#fff', maxWidth: 760, margin: '0 auto' }}>
      {/* header */}
      <div style={{ ...CARD, padding:'14px 14px 12px', background:'linear-gradient(135deg,rgba(0,230,138,0.10),rgba(168,85,247,0.07))', border:'1px solid rgba(0,230,138,0.18)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-18, right:-18, width:110, height:110, borderRadius:110, background:'radial-gradient(circle,rgba(0,230,138,0.16),transparent 70%)', pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <div style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:900, fontSize:16 }}>🏋️</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:900, color:'#fff', lineHeight:1 }}>Анализ силы — единый центр</div>
            <div style={{ fontSize:10, color:'#fff', lineHeight:1.3 }}>Один снапшот (пол/вес/присед/жим/тяга) → 1RM + VBT + отн. сила + нормативы + аналитика. Без дублей.</div>
          </div>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:20, background:'rgba(0,230,138,0.12)', border:'1px solid rgba(0,230,138,0.22)', color:ACCENT, fontWeight:800, whiteSpace:'nowrap' }}>без дублей</span>
        </div>
        <div style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', lineHeight:1.45 }}>
          <b style={{ color:'#fff' }}>Как работает:</b> вверху — единый ввод (пол/вес/3 движения). Он один раз питает все 4 секции ниже. <span style={{ color:ACCENT }}>1RM</span> — 7 формул + консенсус, <span style={{ color:'#3b82f6' }}>VBT</span> — скорость, <span style={{ color:'#f59e0b' }}>нормативы</span> — DOTS/Wilks/IPF GL, <span style={{ color:'#22c55e' }}>аналитика</span> — процентили. Переключение вкладок не сбрасывает ввод.
        </div>
      </div>

      {/* единый снапшот */}
      <div style={{ ...CARD, border:'1px solid rgba(0,230,138,0.16)', background:'linear-gradient(135deg,rgba(0,230,138,0.07),rgba(255,255,255,0.02))' }}>
        <div style={{ fontSize:13, fontWeight:800, color:ACCENT, marginBottom:6 }}>🎛 Единый снапшот — ваши данные (питает все секции)</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
          <PopupSelect label="Пол" value={sex} options={[{id:'male',label:'♂ Мужчина'},{id:'female',label:'♀ Женщина'}]} onChange={v=> setSex(v as Sex)} />
          <PopupNumber label="Вес тела, кг" value={bw} min={30} max={250} suffix=" кг" onChange={setBw} />
          <div style={{ display:'flex', alignItems:'end', justifyContent:'center', paddingBottom:2 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:10, color:'#fff' }}>Тотал</div>
              <div style={{ fontSize:18, fontWeight:900, color:ACCENT }}>{total} <span style={{ fontSize:10, color:'#fff' }}>кг</span></div>
            </div>
          </div>
          <PopupNumber label="Присед, кг" value={squat} min={0} suffix=" кг" onChange={setSquat} />
          <PopupNumber label="Жим, кг" value={bench} min={0} suffix=" кг" onChange={setBench} />
          <PopupNumber label="Тяга, кг" value={dead} min={0} suffix=" кг" onChange={setDead} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:8 }}>
          <PopupNumber label="Жим стоя, кг" value={ohp} min={0} suffix=" кг" onChange={setOhp} />
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize:10, color:'#fff' }}>DOTS</span><b style={{ color:ACCENT }}>{dots}</b>
            <span style={{ fontSize:10, color:'#fff' }}>· Wilks</span><b style={{ color:'#fff' }}>{wilks}</b>
            <span style={{ fontSize:10, color:'#fff' }}>· IPF GL</span><b style={{ color:'#fff' }}>{ipfgl}</b>
          </div>
        </div>
        <div style={{ fontSize:10, color:'#fff', marginTop:8, padding:'7px 10px', borderRadius:9, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
          Отн. сила: <b style={{ color:'#a855f7' }}>{report.relative}×BW</b> · класс <b style={{ color:ACCENT }}>{report.classification.label}</b> · {sex === 'male' ? '♂ мужские' : '♀ женские'} коэф. · Тотал {total} кг при {bw} кг
        </div>
      </div>

      {/* summary strip */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6, marginBottom:10 }}>
        <div style={{ ...CARD, marginBottom:0, padding:10, borderLeft:`3px solid ${ACCENT}`, minHeight:68 }}>
          <div style={{ fontSize:9, fontWeight:800, color:ACCENT, letterSpacing:0.4, textTransform:'uppercase' }}>🎯 Тотал</div>
          <div style={{ fontSize:18, fontWeight:900, color:'#fff' }}>{total} <span style={{ fontSize:10, color:'#fff' }}>кг</span></div>
          <div style={{ fontSize:10, color:'#fff' }}>{report.relative}×BW</div>
        </div>
        <div style={{ ...CARD, marginBottom:0, padding:10, borderLeft:`3px solid #3b82f6`, minHeight:68 }}>
          <div style={{ fontSize:9, fontWeight:800, color:'#3b82f6', letterSpacing:0.4, textTransform:'uppercase' }}>🏆 DOTS / Wilks</div>
          <div style={{ fontSize:16, fontWeight:900, color:'#fff' }}>{dots} <span style={{ fontSize:10, color:'#fff' }}>/ {wilks}</span></div>
          <div style={{ fontSize:10, color:'#fff' }}>IPF GL {ipfgl}</div>
        </div>
        <div style={{ ...CARD, marginBottom:0, padding:10, borderLeft:`3px solid #a855f7`, minHeight:68 }}>
          <div style={{ fontSize:9, fontWeight:800, color:'#a855f7', letterSpacing:0.4, textTransform:'uppercase' }}>📊 Уровень</div>
          <div style={{ fontSize:14, fontWeight:900, color:'#fff', whiteSpace:'nowrap' }}>{report.classification.label}</div>
          <div style={{ fontSize:10, color:'#fff' }}>{report.lifts.squat.class} / {report.lifts.bench.class} / {report.lifts.deadlift.class}</div>
        </div>
        <div style={{ ...CARD, marginBottom:0, padding:10, borderLeft:`3px solid #f59e0b`, minHeight:68 }}>
          <div style={{ fontSize:9, fontWeight:800, color:'#f59e0b', letterSpacing:0.4, textTransform:'uppercase' }}>⚖️ Присед / Жим / Тяга</div>
          <div style={{ fontSize:11, fontWeight:800, color:'#fff' }}>{squat} / {bench} / {dead}</div>
          <div style={{ fontSize:10, color:'#fff' }}>{ohp} стоя</div>
        </div>
      </div>

      {/* экспорт */}
      <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
        <button
          onClick={() => {
            const text = buildStrengthReportText({ sex, bw, squat, bench, dead, ohp, total, dots, wilks, ipfgl, relative: report.relative, levelLabel: report.classification.label, lifts: { squat: { rs: report.lifts.squat.rs, label: report.lifts.squat.label }, bench: { rs: report.lifts.bench.rs, label: report.lifts.bench.label }, deadlift: { rs: report.lifts.deadlift.rs, label: report.lifts.deadlift.label } } });
            try { navigator.clipboard.writeText(text); } catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
            try { (window as any).showToast?.('📋 Сводка скопирована тренеру'); } catch {}
          }}
          style={{ flex:'1 1 160px', padding:'8px 10px', borderRadius:10, border:'1px solid rgba(0,230,138,0.22)', background:'rgba(0,230,138,0.10)', color:ACCENT, fontWeight:800, fontSize:11, cursor:'pointer' }}
        >
          📋 Копировать сводку тренеру
        </button>
        <button
          onClick={() => {
            const html = buildStrengthPrintHtml({ sex, bw, squat, bench, dead, ohp, total, dots, wilks, ipfgl, relative: report.relative, levelLabel: report.classification.label, lifts: { squat: { rs: report.lifts.squat.rs, label: report.lifts.squat.label }, bench: { rs: report.lifts.bench.rs, label: report.lifts.bench.label }, deadlift: { rs: report.lifts.deadlift.rs, label: report.lifts.deadlift.label } } });
            const w = window.open('', '_blank');
            if (!w) { try { (window as any).showToast?.('⚠️ Разрешите всплывающие окна для печати'); } catch {} return; }
            w.document.write(html);
            w.document.close();
          }}
          style={{ flex:'1 1 140px', padding:'8px 10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.04)', color:'#fff', fontWeight:700, fontSize:11, cursor:'pointer' }}
        >
          🖨 Печать / PDF
        </button>
      </div>

      {/* sticky nav */}
      <div style={{ position:'sticky', top:0, zIndex:5, margin:'-2px -8px 10px', padding:'8px 8px 8px', background:'rgba(10,10,12,0.72)', backdropFilter:'blur(10px)', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none' }}>
        {MODE_DEFS.map(({ m, label, icon, desc, accent }) => (
          <button key={m} onClick={() => setMode(m)} title={desc} style={{
            flex:'0 0 auto', display:'flex', alignItems:'center', gap:6, padding:'7px 11px', borderRadius:20, cursor:'pointer', fontSize:11, fontWeight:800, whiteSpace:'nowrap',
            border: mode === m ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.08)',
            background: mode === m ? `${accent}18` : 'rgba(255,255,255,0.04)',
            color: mode === m ? accent : '#fff', transition:'all 0.16s',
          }}>
            <span>{icon}</span> {label}
          </button>
        ))}
      </div>

      {/* content */}
      <div style={{ ...CARD, padding:0, overflow:'hidden', background:'rgba(24,24,27,0.30)' }}>
        <div style={{ padding:'8px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background: `${MODE_DEFS.find(x=>x.m===mode)!.accent}18`, border:`1px solid ${MODE_DEFS.find(x=>x.m===mode)!.accent}33`, fontSize:14 }}>{MODE_DEFS.find(x=>x.m===mode)!.icon}</span>
          <div>
            <div style={{ fontSize:12, fontWeight:900, color: MODE_DEFS.find(x=>x.m===mode)!.accent }}>{MODE_DEFS.find(x=>x.m===mode)!.label} · {MODE_DEFS.find(x=>x.m===mode)!.desc}</div>
            <div style={{ fontSize:10, color:'#fff' }}>{mode === '1rm' ? 'Вес×повторы → 1RM' : mode === 'vbt' ? 'Скорость штанги → %1RM/вес' : mode === 'norms' ? 'Разряды + очки' : 'Процентили и объём'}</div>
          </div>
        </div>
        <div style={{ padding: 10 }}>
          {mode === '1rm' && <OneRmCalcTab snapshot={snapshot} onHubPatch={patchHub} />}
          {mode === 'vbt' && <VBTCalcTab snapshot={snapshot} onHubPatch={patchHub} />}
          {mode === 'norms' && <PlNormsCalcTab snapshot={snapshot} onSnapshotChange={patchHub} />}
          {mode === 'analytics' && <StrengthAnalyticsCard snapshot={snapshot} />}
        </div>
      </div>

      <div style={{ fontSize:10, color:'#fff', textAlign:'center', marginTop:10, opacity:0.9, lineHeight:1.45 }}>
        Единый хаб без дублей — ввод пол/вес/тотал один раз, все секции читают один снапшот. Формулы: Epley/Brzycki/Lander/Lombardi/Mayhew/O'Conner/Wathen (1RM), Gonzalez-Badillo VBT, DOTS/Wilks/IPF GL (2019), Rippetoe/Kilgore + Israetel MEV/MAV/MRV.
      </div>
    </div>
  );
};

export default StrengthAnalysisHub;

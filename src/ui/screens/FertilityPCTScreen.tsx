import React, { useState, useMemo, useEffect } from 'react';
import { calcFertility } from '../../engines/fertility.engine';
import type { FertilityInput, FertilityResult, LabPoint, CourseEntry } from '../../core/types';
import { FERTILITY_TARGET, FERTILITY_TAU_WEEKS } from '../../core/constants';
import { db } from '../../core/db';
import { getProfile } from '../../core/profile-manager';
import { generatePCTPlan } from '../../engines/pct-planner.engine';
import { PHARMA_DB } from '../../core/pharma-database';

type FertTab = 'semen' | 'hormones' | 'structure' | 'pct-plan' | 'analyses';

const s: Record<string, React.CSSProperties> = {
  card: { background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, marginBottom: 12 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 },
  row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 8 },
  label: { fontSize: 11, opacity: 0.7, marginBottom: 2 },
  input: { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 14, boxSizing: 'border-box' as const },
  btn: { padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 12, cursor: 'pointer' },
  btnActive: { padding: '6px 12px', borderRadius: 8, border: '1px solid #00e68a', background: 'rgba(0,230,138,0.15)', color: '#00e68a', fontSize: 12, cursor: 'pointer' },
  barTrack: { height: 10, borderRadius: 5, background: 'var(--border)', overflow: 'hidden', margin: '4px 0' },
  check: { width: 18, height: 18, accentColor: '#00e68a' },
};

const VARICOCELE = [
  { id: 'none', label: 'Нет' }, { id: 'grade1', label: '1 степень' },
  { id: 'grade2', label: '2 степень' }, { id: 'grade3', label: '3 степень' }
] as const;

export const FertilityPCTScreen: React.FC = () => {
  const [tab, setTab] = useState<FertTab>('semen');

  const [volume, setVolume] = useState('');
  const [concentration, setConcentration] = useState('');
  const [totalCount, setTotalCount] = useState('');
  const [pr, setPr] = useState('');
  const [np, setNp] = useState('');
  const [immotile, setImmotile] = useState('');
  const [morphology, setMorphology] = useState('');
  const [viability, setViability] = useState('');
  const [ph, setPh] = useState('7.4');
  const [viscosity, setViscosity] = useState(false);
  const [mar, setMar] = useState('');
  const [leukocytes, setLeukocytes] = useState('');
  const [agglutination, setAgglutination] = useState(false);
  const [fructose, setFructose] = useState('');
  const [zincMmol, setZincMmol] = useState('');
  const [dfi, setDfi] = useState('');
  const [varicocele, setVaricocele] = useState<'none' | 'grade1' | 'grade2' | 'grade3'>('none');

  const [tt, setTt] = useState('');
  const [ft, setFt] = useState('');
  const [e2, setE2] = useState('');
  const [lh, setLh] = useState('');
  const [fsh, setFsh] = useState('');
  const [prl, setPrl] = useState('');
  const [shbg, setShbg] = useState('');
  const [inhb, setInhb] = useState('');
  const [amh, setAmh] = useState('');

  // ─── PCT Plan ───
  const [pctCourse, setPctCourse] = useState<CourseEntry[]>([]);
  const [pctPlan, setPctPlan] = useState<ReturnType<typeof generatePCTPlan> | null>(null);
  const CLASS_COLORS: Record<string, string> = { pct_serm: '#22c55e', pct_aromatase: '#ef4444', pct_dopamine: '#eab308', pct_gonadotropin: '#3b82f6' };
  const CLASS_LABEL_PCT: Record<string, string> = { pct_serm: 'СЕРМ', pct_aromatase: 'Ингиб.ароматазы', pct_dopamine: 'Дофамин', pct_gonadotropin: 'Гонадотропин' };
  useEffect(() => {
    db.init().then(() => db.getAll<CourseEntry>('course_log')).then(data => setPctCourse(data)).catch(() => {});
  }, []);

  const [allLabs, setAllLabs] = useState<Record<string, string>>({});
  useEffect(() => {
    const loadLabs = async () => {
      try {
        const profile = getProfile();
        const entries = await db.getAll<LabPoint>('labs_log');
        const codeMap: Record<string, React.Dispatch<React.SetStateAction<string>>> = {
          TT: setTt, FT: setFt, E2: setE2, LH: setLh, FSH: setFsh,
          PRL: setPrl, SHBG: setShbg, INHB: setInhb, AMH: setAmh
        };
        const codeToKey: Record<string, string> = { TT: 'ng/dL', FT: 'pg/mL', E2: 'pg/mL', LH: 'mIU/mL', FSH: 'mIU/mL', PRL: 'ng/mL', SHBG: 'nmol/L', INHB: 'pg/mL', AMH: 'ng/mL' };
        const labData: Record<string, string> = {};
        entries
          .filter(e => e.patientId === (profile.id || 'current-user'))
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
          .forEach(e => {
            const setter = codeMap[e.code];
            if (setter && e.value !== undefined) setter(String(e.value));
            if (e.value !== undefined) labData[e.code] = String(e.value);
          });
        setAllLabs(labData);
      } catch {}
    };
    loadLabs();
  }, []);

  const input: FertilityInput = useMemo(() => ({
    volumeMl: parseFloat(volume) || 0,
    concentrationMlMln: parseFloat(concentration) || 0,
    totalCountMln: parseFloat(totalCount) || 0,
    prPercent: parseFloat(pr) || 0,
    npPercent: parseFloat(np) || undefined,
    immotilePercent: parseFloat(immotile) || undefined,
    morphologyPercent: parseFloat(morphology) || 0,
    viabilityPercent: parseFloat(viability) || undefined,
    ph: parseFloat(ph) || 7.4,
    viscosity,
    marPercent: parseFloat(mar) || undefined,
    leukocytesMlMln: parseFloat(leukocytes) || undefined,
    agglutination,
    fructose: parseFloat(fructose) || undefined,
    zincMmol: parseFloat(zincMmol) || undefined,
    dfi: parseFloat(dfi) || undefined,
    varicocele,
    lh: parseFloat(lh) || undefined,
    fsh: parseFloat(fsh) || undefined,
    tt: parseFloat(tt) || undefined,
    ft: parseFloat(ft) || undefined,
    e2: parseFloat(e2) || undefined,
    prl: parseFloat(prl) || undefined,
    shbg: parseFloat(shbg) || undefined,
    inhb: parseFloat(inhb) || undefined,
    amh: parseFloat(amh) || undefined,
  }), [volume, concentration, totalCount, pr, np, immotile, morphology, viability, ph, viscosity, mar, leukocytes, agglutination, fructose, zincMmol, dfi, varicocele, tt, ft, e2, lh, fsh, prl, shbg, inhb, amh]);

  const result: FertilityResult = useMemo(() => calcFertility(input), [input]);

  const scoreColor = result.ifScore >= 60 ? '#00e68a' : result.ifScore >= 30 ? '#ff9800' : '#f44336';
  const scoreBg = result.ifScore >= 60 ? 'rgba(0,230,138,0.12)' : result.ifScore >= 30 ? 'rgba(255,152,0,0.12)' : 'rgba(244,67,54,0.12)';

  const recoveryPoints = useMemo(() => {
    const pts: { week: number; score: number }[] = [];
    const tau = FERTILITY_TAU_WEEKS;
    const target = FERTILITY_TARGET;
    for (let w = 0; w <= 24; w += 1) {
      pts.push({ week: w, score: Math.round(result.ifScore + (target - result.ifScore) * (1 - Math.exp(-w / tau))) });
    }
    return pts;
  }, [result.ifScore]);

  const chartW = 340, chartH = 160, padL = 36, padR = 12, padT = 12, padB = 28;
  const plotW = chartW - padL - padR, plotH = chartH - padT - padB;
  const maxWeek = 24, maxScore = 100;
  const toX = (w: number) => padL + (w / maxWeek) * plotW;
  const toY = (sc: number) => padT + plotH - (sc / maxScore) * plotH;
  const polyline = recoveryPoints.map(p => `${toX(p.week)},${toY(p.score)}`).join(' ');
  const areaPoints = polyline + ` ${toX(maxWeek)},${toY(0)} ${toX(0)},${toY(0)}`;

  const field = (label: string, val: string, set: React.Dispatch<React.SetStateAction<string>>, placeholder: string, step = '0.1') => (
    <div className="form-group">
      <label>{label}</label>
      <input type="number" step={step} value={val} onChange={e => set(e.target.value)} placeholder={placeholder} />
    </div>
  );

  const fertTabs: { id: FertTab; label: string }[] = [
    { id: 'semen', label: 'Спермограмма' }, { id: 'hormones', label: 'Гормоны' }, { id: 'structure', label: 'DFI/Структура' }, { id: 'pct-plan', label: 'ПКТ план' }, { id: 'analyses', label: '🧪 Анализы' }
  ];

  return (
    <div className="screen fertility-pct">
      <h2>Фертильность и ПКТ</h2>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {fertTabs.map(t => <button key={t.id} className={`tab-button ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

      {tab === 'semen' && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 8px' }}>Спермограмма расширенная</h4>
          <div style={s.row}>
            <div>{field('', volume, setVolume, '1.5')}</div>
            <div>{field('', concentration, setConcentration, '16')}</div>
          </div>
          <div style={s.row}>
            <div>{field('', totalCount, setTotalCount, '39')}</div>
            <div>{field('PR подвижность (%) ≥30', pr, setPr, '30')}</div>
          </div>
          <div style={s.row}>
            <div>{field('NP подвижность (%)', np, setNp, '10')}</div>
            <div>{field('', immotile, setImmotile, '0')}</div>
          </div>
          <div style={s.row}>
            <div>{field('', morphology, setMorphology, '4')}</div>
            <div>{field('', viability, setViability, '58')}</div>
          </div>
          <div style={s.row}>
            <div>{field('pH 7.2–8.0', ph, setPh, '7.4')}</div>
            <div>{field('', fructose, setFructose, '13')}</div>
          </div>
          <div style={s.row}>
            <div>{field('', zincMmol, setZincMmol, '2')}</div>
            <div>{field('MAR-тест (%) <50', mar, setMar, '0')}</div>
          </div>
          <div style={s.row}>
            <div>{field('', leukocytes, setLeukocytes, '0')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label><input type="checkbox" style={s.check} checked={viscosity} onChange={e => setViscosity(e.target.checked)} /> Вязкость</label>
              <label><input type="checkbox" style={s.check} checked={agglutination} onChange={e => setAgglutination(e.target.checked)} /> Агглютинация</label>
            </div>
          </div>
        </div>
      )}

      {tab === 'hormones' && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 8px' }}>Гормоны крови (10 маркеров)</h4>
          <p style={{ fontSize: 11, opacity: 0.6, margin: '0 0 8px' }}>Автозаполнение из LabsScreen</p>
          <div style={s.row}>
            <div>{field('', lh, setLh, '5')}</div>
            <div>{field('', fsh, setFsh, '4')}</div>
          </div>
          <div style={s.row}>
            <div>{field('', tt, setTt, '500')}</div>
            <div>{field('', ft, setFt, '15')}</div>
          </div>
          <div style={s.row}>
            <div>{field('', e2, setE2, '25')}</div>
            <div>{field('', prl, setPrl, '8')}</div>
          </div>
          <div style={s.row}>
            <div>{field('', shbg, setShbg, '30')}</div>
            <div>{field('', inhb, setInhb, '150')}</div>
          </div>
          <div style={s.row}>
            <div>{field('', amh, setAmh, '4')}</div>
            <div></div>
          </div>
        </div>
      )}

      {tab === 'structure' && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 8px' }}>DFI и структурные факторы</h4>
          <div style={s.row}>
            <div>{field('DFI (%) ≤15 норма', dfi, setDfi, '0')}</div>
            <div>
              <span style={s.label}>Варикоцеле</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {VARICOCELE.map(v => <button key={v.id} style={varicocele === v.id ? s.btnActive : s.btn} onClick={() => setVaricocele(v.id)}>{v.label}</button>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── PCT TIMER ─── */}
      {tab === 'pct-plan' && pctPlan && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>⏳ Таймер ПКТ</div>
            {(() => {
              const minWeek = pctCourse.length > 0 ? Math.min(...pctCourse.map(e => e.startWeek)) : 0;
              const maxWeek = pctCourse.length > 0 ? Math.max(...pctCourse.map(e => e.endWeek)) : 0;
              const pctWeek = pctPlan.pctStartWeek;
              const totalCourseWeeks = maxWeek - minWeek;
              return (
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#ec4899' }}>
                    Неделя <span style={{ fontSize: 36 }}>{pctWeek}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                    Старт ПКТ через {Math.max(1, pctWeek - maxWeek)} нед после курса
                  </div>
                  <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', maxWidth: 240, marginLeft: 'auto', marginRight: 'auto' }}>
                    <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, (pctWeek / (totalCourseWeeks + 12)) * 100)}%`, background: 'linear-gradient(90deg, #ec4899, #8b5cf6)', transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 6, fontSize: 10, color: 'var(--text-dim)' }}>
                    <span>Курс: {minWeek}-{maxWeek} нед</span>
                    <span>ПКТ: {pctWeek}+ нед</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─── PCT PLAN TAB ─── */}
      {tab === 'pct-plan' && (
        <div>
          {pctCourse.length === 0 ? (
            <div style={s.card}>
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>💊</div>
                <div>Курс не найден</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Добавьте препараты во вкладке Фармакология {'>'} Курс</div>
              </div>
            </div>
          ) : !pctPlan ? (
            <div style={s.card}>
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
                  Активных веществ в курсе: {pctCourse.length}
                </div>
                <button onClick={() => { const plan = generatePCTPlan(pctCourse, Math.max(...pctCourse.map(c => c.endWeek))); setPctPlan(plan); }} style={{
                  padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  background: 'linear-gradient(135deg, #00e68a, #00c77a)', color: '#000', border: 'none',
                }}>
                  🔄 Сгенерировать ПКТ
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={s.card}>
                <h4 style={{ margin: '0 0 8px' }}>План ПКТ</h4>
                <div style={{ fontSize: 12, marginBottom: 6 }}>
                  Начало: <b>неделя {pctPlan.pctStartWeek}</b>
                </div>
                {pctPlan.warnings.length > 0 && (
                  <div style={{ background: 'rgba(255,152,0,0.1)', borderRadius: 6, padding: '8px 10px', marginBottom: 8 }}>
                    {pctPlan.warnings.map((w: string, i: number) => (
                      <div key={i} style={{ fontSize: 10, color: '#ff9800' }}>⚠ {w}</div>
                    ))}
                  </div>
                )}
                {pctPlan.pctProtocol.map((p: any, i: number) => (
                  <div key={i} style={{
                    background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px', marginBottom: 6,
                    borderLeft: `3px solid ${CLASS_COLORS[p.class] || '#666'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{PHARMA_DB[p.substanceId]?.name || p.substanceId}</span>
                        <span style={{ fontSize: 9, marginLeft: 6, padding: '2px 6px', borderRadius: 4, background: `${CLASS_COLORS[p.class] || '#666'}22`, color: CLASS_COLORS[p.class] || '#666' }}>{CLASS_LABEL_PCT[p.class] || p.class}</span>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{p.doseValue}{p.doseUnit}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                      {p.timing || `${p.frequency}`} | Нед {p.startWeek}-{p.endWeek}
                    </div>
                  </div>
                ))}
                <button onClick={() => setPctPlan(null)} style={{ marginTop: 8, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11 }}>✕ Сбросить</button>
              </div>
              <div style={s.card}>
                <h4 style={{ margin: '0 0 8px' }}>Восстановление фертильности</h4>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>Рекомендации для восстановления после курса</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { icon: '📅', label: 'Длительность', desc: `${pctPlan.pctProtocol.reduce((max: number, p: any) => Math.max(max, p.endWeek || 0), 0) - pctPlan.pctStartWeek + 1} недель` },
                    { icon: '💊', label: 'Препараты', desc: `${pctPlan.pctProtocol.length} препаратов в протоколе` },
                    { icon: '📊', label: 'Мониторинг', desc: 'Контроль гормонов каждые 2-4 нед' },
                    { icon: '🧬', label: 'Цель', desc: 'LH/ФСГ > 5, тестостерон > 15 нмоль/л' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 16 }}>{item.icon}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'analyses' && (
        <div>
          {(() => {
            const BEFORE_PCT = [
              { code:'LH', name:'LH', range:'1.7-8.6 mIU/mL' },
              { code:'FSH', name:'FSH (Фолликулостимулирующий гормон)', range:'1.5-12.4 mIU/mL' },
              { code:'TT', name:'Тестостерон общий', range:'300-1000 ng/dL' },
              { code:'FT', name:'Тестостерон свободный', range:'5.0-21.0 pg/mL' },
              { code:'E2', name:'Эстрадиол (E2)', range:'11-44 pg/mL' },
              { code:'PRL', name:'Пролактин', range:'4.0-15.2 ng/mL' },
              { code:'SHBG', name:'SHBG (ГСПГ)', range:'18-54 nmol/L' },
              { code:'TSH', name:'TSH (ТТГ)', range:'0.4-4.0 mIU/L' },
              { code:'FT4', name:'Свободный T4', range:'0.8-1.8 ng/dL' },
              { code:'FT3', name:'Свободный T3', range:'2.3-4.2 pg/mL' },
              { code:'CORT', name:'Кортизол (утро)', range:'6.2-19.4 mkg/dL' },
              { code:'DHEAS', name:'DHEA-S (ДГЭА-С)', range:'80-560 mkg/dL' },
              { code:'CBC', name:'Общий анализ крови (CBC)', range:'Гемоглобин/лейкоциты/тромбоциты' },
              { code:'ALT', name:'АЛТ (ALT)', range:'< 45 U/L' },
              { code:'AST', name:'АСТ (AST)', range:'< 40 U/L' },
              { code:'GGT', name:'ГГТ (GGT)', range:'< 60 U/L' },
              { code:'CREAT', name:'Креатинин', range:'0.7-1.3 mg/dL' },
              { code:'EGFR', name:'eGFR (СКФ)', range:'> 90 mL/min' },
              { code:'LIPID', name:'Липидный профиль', range:'ХС/ЛПНП/ЛПВП/ТГ' },
              { code:'PSA', name:'ПСА (простат-специфический антиген)', range:'< 4.0 ng/mL' },
              { code:'VITD', name:'25-OH Витамин D', range:'30-100 ng/mL' },
              { code:'FERR', name:'Ферритин', range:'30-400 ng/mL' },
            ];
            const AFTER_PCT = [
              { code:'LH', name:'LH (повторно)', range:'1.7-8.6 mIU/mL' },
              { code:'FSH', name:'FSH (повторно)', range:'1.5-12.4 mIU/mL' },
              { code:'TT', name:'Тестостерон общий (повторно)', range:'300-1000 ng/dL' },
              { code:'FT', name:'Тестостерон свободный (повторно)', range:'5.0-21.0 pg/mL' },
              { code:'E2', name:'Эстрадиол E2 (повторно)', range:'11-44 pg/mL' },
              { code:'PRL', name:'Пролактин (повторно)', range:'4.0-15.2 ng/mL' },
              { code:'SHBG', name:'SHBG (повторно)', range:'18-54 nmol/L' },
              { code:'TSH', name:'TSH (повторно)', range:'0.4-4.0 mIU/L' },
              { code:'FT4', name:'Свободный T4 (повторно)', range:'0.8-1.8 ng/dL' },
              { code:'FT3', name:'Свободный T3 (повторно)', range:'2.3-4.2 pg/mL' },
              { code:'CORT', name:'Кортизол (повторно)', range:'6.2-19.4 mkg/dL' },
              { code:'DHEAS', name:'DHEA-S (повторно)', range:'80-560 mkg/dL' },
              { code:'CBC', name:'Общий анализ крови (повторно)', range:'Гемоглобин/лейкоциты/тромбоциты' },
              { code:'ALT', name:'АЛТ ALT (повторно)', range:'< 45 U/L' },
              { code:'AST', name:'АСТ AST (повторно)', range:'< 40 U/L' },
              { code:'GGT', name:'ГГТ GGT (повторно)', range:'< 60 U/L' },
              { code:'CREAT', name:'Креатинин (повторно)', range:'0.7-1.3 mg/dL' },
              { code:'EGFR', name:'eGFR СКФ (повторно)', range:'> 90 mL/min' },
              { code:'LIPID', name:'Липидный профиль (повторно)', range:'ХС/ЛПНП/ЛПВП/ТГ' },
              { code:'PSA', name:'ПСА (повторно)', range:'< 4.0 ng/mL' },
              { code:'VITD', name:'25-OH Витамин D (повторно)', range:'30-100 ng/mL' },
              { code:'FERR', name:'Ферритин (повторно)', range:'30-400 ng/mL' },
              { code:'SPERM', name:'Спермограмма', range:'Объём ≥1.5 мл, конц. ≥15 млн/мл, PR ≥32%' },
            ];
            const renderChecklist = (title: string, subtitle: string, items: typeof BEFORE_PCT, borderColor: string) => {
              const has = items.filter(i => allLabs[i.code]);
              const total = items.length;
              return (
                <div style={{ ...s.card, borderLeft: `3px solid ${borderColor}` }}>
                  <h4 style={{ margin:'0 0 2px', fontSize:13, color:borderColor }}>{title}</h4>
                  <div style={{ fontSize:10, color:'var(--text-dim)', marginBottom:8 }}>{subtitle} · {has.length}/{total} сдано</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {items.map(item => {
                      const hasData = !!allLabs[item.code];
                      const val = allLabs[item.code];
                      return (
                        <div key={item.code} style={{
                          display:'flex', alignItems:'center', gap:8, padding:'6px 8px',
                          borderRadius:8, background: hasData ? 'rgba(0,230,138,0.06)' : 'var(--bg-secondary)',
                          border: `1px solid ${hasData ? 'rgba(0,230,138,0.2)' : 'var(--border)'}`,
                        }}>
                          <div style={{
                            width:20, height:20, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center',
                            background: hasData ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.05)',
                            fontSize:12, flexShrink:0,
                          }}>{hasData ? '✓' : '○'}</div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:11, fontWeight: hasData ? 600 : 400, color: hasData ? 'var(--text-light)' : 'var(--text-dim)' }}>
                              {item.name}
                            </div>
                            <div style={{ fontSize:8, color:'var(--text-dim)' }}>
                              {hasData ? (val && val !== 'true' ? `Значение: ${val}` : 'Есть данные') : `Норма: ${item.range}`}
                            </div>
                          </div>
                          {hasData && <div style={{ fontSize:9, color:'#00e68a', fontWeight:600 }}>✓</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            };
            return (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ fontSize:11, color:'var(--text-dim)', marginBottom:2 }}>
                  Автоматическая проверка по данным из LabsScreen. Заполните анализы во вкладке Анализы главного экрана.
                </div>
                {renderChecklist('До ПКТ', 'Обязательный минимум перед началом ПКТ', BEFORE_PCT, '#f59e0b')}
                {renderChecklist('После ПКТ (4-6 нед)', 'Контроль через 4-6 недель после завершения ПКТ', AFTER_PCT, '#22c55e')}
              </div>
            );
          })()}
        </div>
      )}

      <div style={{ ...s.card, borderColor: scoreColor, background: scoreBg, border: `1px solid ${scoreColor}` }}>
        <h3 style={{ color: scoreColor, margin: '0 0 8px' }}>Индекс фертильности: {result.ifScore}</h3>
        <p style={{ color: scoreColor, margin: '0 0 4px' }}>{result.interpretation}</p>
        <div style={s.barTrack}>
          <div style={{ height: '100%', borderRadius: 5, background: scoreColor, width: `${result.ifScore}%`, transition: 'width 0.3s' }} />
        </div>

        {result.spermIndex !== undefined && (
          <div style={{ marginTop: 12 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 13 }}>Суб-индексы IF v2</h4>
            {[
              { label: 'Сперма', value: result.spermIndex },
              { label: 'Гормоны', value: result.hormonalIndex ?? 0 },
              { label: 'Структура', value: result.structuralIndex ?? 0 },
            ].map(si => (
              <div key={si.label} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>{si.label}</span>
                  <span style={{ fontWeight: 600 }}>{si.value}</span>
                </div>
                <div style={s.barTrack}>
                  <div style={{ height: '100%', borderRadius: 5, background: si.value >= 60 ? '#00e68a' : si.value >= 30 ? '#ff9800' : '#f44336', width: `${si.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {result.warnings && result.warnings.length > 0 && (
          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(244,67,54,0.15)', border: '1px solid #f44336' }}>
            {result.warnings.map(w => <div key={w} style={{ fontSize: 12, color: '#f44336' }}>{w}</div>)}
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: result.forecast6w >= 60 ? '#00e68a' : '#ff9800' }}>{result.forecast6w}</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Прогноз 6 нед</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: result.forecast12w >= 60 ? '#00e68a' : '#ff9800' }}>{result.forecast12w}</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Прогноз 12 нед</div>
          </div>
        </div>
      </div>

      <div style={s.card}>
        <h4 style={{ margin: '0 0 8px' }}>Прогноз восстановления</h4>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', maxWidth: 380 }}>
          {[0, 25, 50, 75, 100].map(v => <line key={v} x1={padL} y1={toY(v)} x2={padL + plotW} y2={toY(v)} stroke="var(--border)" strokeWidth={0.5} />)}
          {[0, 6, 12, 18, 24].map(w => <text key={w} x={toX(w)} y={chartH - 4} textAnchor="middle" fill="var(--text-secondary)" fontSize={10}>{w}</text>)}
          <text x={chartW / 2} y={chartH} textAnchor="middle" fill="var(--text-secondary)" fontSize={10}>Недели</text>
          <polygon points={areaPoints} fill={scoreColor} opacity={0.15} />
          <polyline points={polyline} fill="none" stroke={scoreColor} strokeWidth={2} />
          <line x1={padL} y1={toY(60)} x2={padL + plotW} y2={toY(60)} stroke="#00e68a" strokeWidth={1} strokeDasharray="4,3" />
          <line x1={padL} y1={toY(30)} x2={padL + plotW} y2={toY(30)} stroke="#ff9800" strokeWidth={1} strokeDasharray="4,3" />
          <circle cx={toX(0)} cy={toY(result.ifScore)} r={4} fill={scoreColor} />
          <circle cx={toX(12)} cy={toY(result.forecast12w)} r={4} fill={scoreColor} />
        </svg>
      </div>

      <div style={s.card}>
        <h4 style={{ margin: '0 0 8px' }}>Рекомендации по ПКТ и восстановлению</h4>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          <h5>HCG на цикле</h5>
          <p>500–1000 МЕ 2–3 раза в неделю начиная с 3-й недели цикла.</p>
          <h5>ПКТ: Кломифен</h5>
          <p>50 мг/день — 2 нед, затем 25 мг/день — 2 нед.</p>
          <h5>ПКТ: Тамоксифен (альтернатива)</h5>
          <p>20 мг/день — 4 недели.</p>
          <h5>Нутритивная поддержка</h5>
          <ul><li>Цинк 30 мг/день</li><li>Селен 100 мкг/день</li><li>L-карнитин 1 г/день</li><li>CoQ10 200 мг/день</li><li>Витамин E 400 МЕ/день</li></ul>
        </div>
      </div>
    </div>
  );
};